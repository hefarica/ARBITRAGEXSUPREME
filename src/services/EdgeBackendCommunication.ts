/**
 * ArbitrageX Supreme V3.0 - Edge Backend Communication Service
 * 
 * Servicio para comunicación entre Cloudflare Edge y CONTABO VPS Backend
 * Maneja WebSocket/HTTP connections, rate limiting y error recovery
 */

import { EdgeKVService, WorkflowState, AgentState } from './EdgeKVService';

export interface ContaboEndpoints {
  baseUrl: string;
  websocketUrl: string;
  endpoints: {
    health: string;
    startWorkflow: string;
    stopWorkflow: string;
    getWorkflowStatus: string;
    getAgentStatus: string;
    getSystemMetrics: string;
  };
}

export interface BackendResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
  requestId: string;
}

export interface WorkflowStartRequest {
  workflowId: string;
  config: {
    opportunityId?: string;
    tokenPair?: string;
    minProfitThreshold: number;
    maxGasPrice: number;
    riskTolerance: 'low' | 'medium' | 'high';
    autoExecute?: boolean;
  };
  metadata?: Record<string, any>;
}

export interface WorkflowStopRequest {
  workflowId: string;
  reason: 'user_requested' | 'error' | 'timeout' | 'system_shutdown';
  forceStop?: boolean;
}

export class EdgeBackendCommunication {
  private kvService: EdgeKVService;
  private endpoints: ContaboEndpoints;
  private authToken?: string;
  private retryConfig = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 10000
  };

  constructor(kvService: EdgeKVService, endpoints: ContaboEndpoints, authToken?: string) {
    this.kvService = kvService;
    this.endpoints = endpoints;
    this.authToken = authToken;
  }

  /**
   * Verificar salud del backend CONTABO VPS
   */
  async checkBackendHealth(): Promise<BackendResponse<any>> {
    const cacheKey = 'backend_health_check';
    
    try {
      // Intentar obtener del cache primero
      const cached = await this.kvService.getCachedApiResponse('health', '');
      if (cached) {
        return cached;
      }

      const response = await this.makeRequest('GET', this.endpoints.endpoints.health);
      
      // Cachear respuesta de salud por 30 segundos
      await this.kvService.cacheApiResponse('health', '', response, { expirationTtl: 30 });
      
      // Actualizar métricas de salud del sistema
      const systemHealth = await this.kvService.getSystemHealth();
      if (systemHealth) {
        systemHealth.contaboVpsHealth = response.success ? 'healthy' : 'error';
        systemHealth.lastCheck = Date.now();
        await this.kvService.setSystemHealth(systemHealth);
      }

      return response;
    } catch (error) {
      const errorResponse: BackendResponse = {
        success: false,
        error: `Backend health check failed: ${error}`,
        timestamp: Date.now(),
        requestId: this.generateRequestId()
      };

      // Actualizar estado de salud en KV
      const systemHealth = await this.kvService.getSystemHealth();
      if (systemHealth) {
        systemHealth.contaboVpsHealth = 'error';
        systemHealth.lastCheck = Date.now();
        await this.kvService.setSystemHealth(systemHealth);
      }

      return errorResponse;
    }
  }

  /**
   * Iniciar workflow en el backend CONTABO
   */
  async startWorkflow(request: WorkflowStartRequest): Promise<BackendResponse<any>> {
    try {
      // Verificar rate limiting
      const rateLimitKey = `start_workflow:${request.workflowId}`;
      const currentCount = await this.kvService.incrementRateLimit(rateLimitKey, 60);
      
      if (currentCount > 5) { // Máximo 5 intentos por minuto
        return {
          success: false,
          error: 'Rate limit exceeded for workflow start requests',
          timestamp: Date.now(),
          requestId: this.generateRequestId()
        };
      }

      // Adquirir lock distribuido para evitar inicio doble
      const lockKey = `workflow_start:${request.workflowId}`;
      const lockAcquired = await this.kvService.acquireLock(lockKey, 60);
      
      if (!lockAcquired) {
        return {
          success: false,
          error: 'Workflow is already being started',
          timestamp: Date.now(),
          requestId: this.generateRequestId()
        };
      }

      try {
        // Hacer la petición al backend
        const response = await this.makeRequest('POST', this.endpoints.endpoints.startWorkflow, request);
        
        if (response.success) {
          // Actualizar estado en KV
          const workflowState: WorkflowState = {
            workflowId: request.workflowId,
            status: 'starting',
            config: request.config,
            agentsStatus: {
              flashbotsDetective: 'starting',
              riskGuardian: 'starting',
              strategyOptimizer: 'starting'
            },
            startTime: Date.now(),
            lastUpdate: Date.now()
          };

          await this.kvService.setWorkflowState(request.workflowId, workflowState);
          await this.kvService.addActiveWorkflow(request.workflowId);

          // Incrementar contador de workflows iniciados
          await this.kvService.incrementCounter('workflows_started', 1, 24);
        }

        return response;
      } finally {
        // Liberar lock
        await this.kvService.releaseLock(lockKey);
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to start workflow: ${error}`,
        timestamp: Date.now(),
        requestId: this.generateRequestId()
      };
    }
  }

  /**
   * Detener workflow en el backend
   */
  async stopWorkflow(request: WorkflowStopRequest): Promise<BackendResponse<any>> {
    try {
      // Adquirir lock para evitar múltiples paradas
      const lockKey = `workflow_stop:${request.workflowId}`;
      const lockAcquired = await this.kvService.acquireLock(lockKey, 30);
      
      if (!lockAcquired) {
        return {
          success: false,
          error: 'Workflow is already being stopped',
          timestamp: Date.now(),
          requestId: this.generateRequestId()
        };
      }

      try {
        const response = await this.makeRequest('POST', this.endpoints.endpoints.stopWorkflow, request);
        
        if (response.success) {
          // Actualizar estado en KV
          const currentState = await this.kvService.getWorkflowState(request.workflowId);
          if (currentState) {
            currentState.status = 'stopped';
            currentState.stopTime = Date.now();
            currentState.lastUpdate = Date.now();
            
            if (response.data?.executionSummary) {
              currentState.executionSummary = response.data.executionSummary;
            }

            await this.kvService.setWorkflowState(request.workflowId, currentState);
          }

          await this.kvService.removeActiveWorkflow(request.workflowId);
          
          // Incrementar contador de workflows detenidos
          await this.kvService.incrementCounter('workflows_stopped', 1, 24);
        }

        return response;
      } finally {
        await this.kvService.releaseLock(lockKey);
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to stop workflow: ${error}`,
        timestamp: Date.now(),
        requestId: this.generateRequestId()
      };
    }
  }

  /**
   * Obtener estado del workflow del backend
   */
  async getWorkflowStatus(workflowId: string, useCache: boolean = true): Promise<BackendResponse<WorkflowState>> {
    try {
      const cacheKey = `workflow_status_${workflowId}`;
      
      // Intentar cache primero si está habilitado
      if (useCache) {
        const cached = await this.kvService.getCachedApiResponse('workflow_status', workflowId);
        if (cached) {
          return cached;
        }
      }

      const response = await this.makeRequest('GET', `${this.endpoints.endpoints.getWorkflowStatus}/${workflowId}`);
      
      if (response.success && response.data) {
        // Actualizar estado en KV
        await this.kvService.setWorkflowState(workflowId, response.data);
        
        // Cachear respuesta por 10 segundos
        await this.kvService.cacheApiResponse('workflow_status', workflowId, response, { expirationTtl: 10 });
      }

      return response;
    } catch (error) {
      return {
        success: false,
        error: `Failed to get workflow status: ${error}`,
        timestamp: Date.now(),
        requestId: this.generateRequestId()
      };
    }
  }

  /**
   * Obtener estado de todos los agentes
   */
  async getAllAgentsStatus(workflowId?: string, useCache: boolean = true): Promise<BackendResponse<Record<string, AgentState>>> {
    try {
      const cacheKey = workflowId ? `agents_status_${workflowId}` : 'agents_status_global';
      
      if (useCache) {
        const cached = await this.kvService.getCachedApiResponse('agents_status', cacheKey);
        if (cached) {
          return cached;
        }
      }

      const url = workflowId 
        ? `${this.endpoints.endpoints.getAgentStatus}?workflowId=${workflowId}`
        : this.endpoints.endpoints.getAgentStatus;

      const response = await this.makeRequest('GET', url);
      
      if (response.success && response.data) {
        // Actualizar estados individuales en KV
        for (const [agentId, agentState] of Object.entries(response.data as Record<string, AgentState>)) {
          await this.kvService.setAgentState(agentId, agentState as AgentState, workflowId);
        }
        
        // Cachear respuesta por 5 segundos
        await this.kvService.cacheApiResponse('agents_status', cacheKey, response, { expirationTtl: 5 });
      }

      return response;
    } catch (error) {
      return {
        success: false,
        error: `Failed to get agents status: ${error}`,
        timestamp: Date.now(),
        requestId: this.generateRequestId()
      };
    }
  }

  /**
   * Obtener métricas del sistema del backend
   */
  async getSystemMetrics(useCache: boolean = true): Promise<BackendResponse<any>> {
    try {
      if (useCache) {
        const cached = await this.kvService.getCachedApiResponse('system_metrics', '');
        if (cached) {
          return cached;
        }
      }

      const response = await this.makeRequest('GET', this.endpoints.endpoints.getSystemMetrics);
      
      if (response.success && response.data) {
        // Actualizar métricas live en KV
        await this.kvService.setLiveMetrics(response.data);
        
        // Cachear por 30 segundos
        await this.kvService.cacheApiResponse('system_metrics', '', response, { expirationTtl: 30 });
      }

      return response;
    } catch (error) {
      return {
        success: false,
        error: `Failed to get system metrics: ${error}`,
        timestamp: Date.now(),
        requestId: this.generateRequestId()
      };
    }
  }

  /**
   * Configurar webhook para recibir actualizaciones del backend
   */
  async setupWebhook(webhookUrl: string, events: string[]): Promise<BackendResponse<any>> {
    try {
      const request = {
        webhookUrl,
        events,
        authToken: this.authToken
      };

      const response = await this.makeRequest('POST', `${this.endpoints.baseUrl}/webhooks/setup`, request);
      
      if (response.success) {
        // Guardar configuración del webhook
        await this.kvService.setConfig('webhook_config', request);
      }

      return response;
    } catch (error) {
      return {
        success: false,
        error: `Failed to setup webhook: ${error}`,
        timestamp: Date.now(),
        requestId: this.generateRequestId()
      };
    }
  }

  /**
   * Procesar webhook recibido del backend
   */
  async processWebhookUpdate(payload: any): Promise<boolean> {
    try {
      const { eventType, workflowId, agentId, data } = payload;

      switch (eventType) {
        case 'workflow_status_update':
          if (workflowId && data) {
            await this.kvService.setWorkflowState(workflowId, data);
            
            // Invalidar cache relacionado
            await this.invalidateWorkflowCache(workflowId);
          }
          break;

        case 'agent_status_update':
          if (agentId && data) {
            await this.kvService.setAgentState(agentId, data, workflowId);
          }
          break;

        case 'system_metrics_update':
          if (data) {
            await this.kvService.setLiveMetrics(data);
          }
          break;

        case 'opportunity_detected':
          if (data) {
            await this.kvService.cacheOpportunity(data.opportunityId, data);
            await this.kvService.incrementCounter('opportunities_detected', 1, 1);
          }
          break;

        case 'workflow_completed':
          if (workflowId && data) {
            const state = await this.kvService.getWorkflowState(workflowId);
            if (state) {
              state.status = 'completed';
              state.stopTime = Date.now();
              state.executionSummary = data.summary;
              await this.kvService.setWorkflowState(workflowId, state);
            }
            await this.kvService.removeActiveWorkflow(workflowId);
            await this.kvService.incrementCounter('workflows_completed', 1, 24);
          }
          break;
      }

      return true;
    } catch (error) {
      console.error('Failed to process webhook update:', error);
      return false;
    }
  }

  /**
   * Método HTTP genérico con retry y error handling
   */
  private async makeRequest(method: string, url: string, body?: any): Promise<BackendResponse<any>> {
    const requestId = this.generateRequestId();
    
    for (let attempt = 0; attempt < this.retryConfig.maxRetries; attempt++) {
      try {
        const options: RequestInit = {
          method,
          headers: {
            'Content-Type': 'application/json',
            'X-Request-ID': requestId,
            ...(this.authToken && { 'Authorization': `Bearer ${this.authToken}` })
          },
          ...(body && { body: JSON.stringify(body) })
        };

        // Añadir timeout
        const timeoutController = new AbortController();
        const timeoutId = setTimeout(() => timeoutController.abort(), 30000); // 30 segundos

        options.signal = timeoutController.signal;

        const response = await fetch(url, options);
        clearTimeout(timeoutId);

        const responseData = await response.json() as any;

        if (response.ok) {
          return {
            success: true,
            data: responseData,
            timestamp: Date.now(),
            requestId
          };
        } else {
          throw new Error(`HTTP ${response.status}: ${responseData.error || 'Unknown error'}`);
        }
      } catch (error) {
        if (attempt === this.retryConfig.maxRetries - 1) {
          // Último intento fallido
          await this.kvService.incrementCounter('backend_request_failures', 1, 1);
          
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            timestamp: Date.now(),
            requestId
          };
        }

        // Esperar antes del siguiente intento
        const delay = Math.min(
          this.retryConfig.baseDelay * Math.pow(2, attempt),
          this.retryConfig.maxDelay
        );
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // Nunca debería llegar aquí, pero por si acaso
    return {
      success: false,
      error: 'Max retries exceeded',
      timestamp: Date.now(),
      requestId
    };
  }

  /**
   * Invalidar cache relacionado con un workflow
   */
  private async invalidateWorkflowCache(workflowId: string): Promise<void> {
    const cacheKeys = [
      `workflow_status_${workflowId}`,
      `agents_status_${workflowId}`,
    ];

    for (const key of cacheKeys) {
      // En KV no podemos invalidar directamente, pero podemos marcar como inválido
      await this.kvService.setConfig(`cache_invalid:${key}`, true, { expirationTtl: 60 });
    }
  }

  /**
   * Generar ID único para requests
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Obtener estadísticas de comunicación
   */
  async getCommunicationStats(): Promise<any> {
    const stats = {
      totalRequests: await this.kvService.getCounter('backend_requests', 24),
      failedRequests: await this.kvService.getCounter('backend_request_failures', 24),
      workflowsStarted: await this.kvService.getCounter('workflows_started', 24),
      workflowsStopped: await this.kvService.getCounter('workflows_stopped', 24),
      workflowsCompleted: await this.kvService.getCounter('workflows_completed', 24),
      opportunitiesDetected: await this.kvService.getCounter('opportunities_detected', 1),
      cacheStats: await this.kvService.getKVStats(),
      timestamp: Date.now()
    };

    return stats;
  }

  /**
   * Limpiar recursos y cerrar conexiones
   */
  async cleanup(): Promise<void> {
    // Cleanup logic si es necesario
    // Por ahora, solo limpiamos locks antiguos
    const lockKeys = await this.kvService.listKeys('lock:', 100);
    
    for (const lockKey of lockKeys) {
      // Los locks tienen TTL automático, pero podemos hacer cleanup manual
      // const lockData = await this.kvService.kv.get(lockKey);
      // if (!lockData) {
      //   // Lock ya expiró, no hay nada que hacer
      //   continue;
      // }
    }
  }
}

/**
 * Factory function para crear instancia del servicio
 */
export function createEdgeBackendCommunication(
  kvService: EdgeKVService,
  contaboBaseUrl: string,
  authToken?: string
): EdgeBackendCommunication {
  const endpoints: ContaboEndpoints = {
    baseUrl: contaboBaseUrl,
    websocketUrl: contaboBaseUrl.replace('http', 'ws') + '/ws',
    endpoints: {
      health: `${contaboBaseUrl}/health`,
      startWorkflow: `${contaboBaseUrl}/api/multiagent/start`,
      stopWorkflow: `${contaboBaseUrl}/api/multiagent/stop`,
      getWorkflowStatus: `${contaboBaseUrl}/api/multiagent/status`,
      getAgentStatus: `${contaboBaseUrl}/api/agents/status`,
      getSystemMetrics: `${contaboBaseUrl}/api/system/metrics`
    }
  };

  return new EdgeBackendCommunication(kvService, endpoints, authToken);
}
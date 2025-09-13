/**
 * ArbitrageX Supreme V3.0 - Edge KV Service
 * 
 * Servicio centralizado para manejo de Cloudflare KV storage
 * Optimizado para caching distribuido de alta performance
 */

export interface CacheOptions {
  expirationTtl?: number;
  metadata?: Record<string, any>;
}

export interface WorkflowState {
  workflowId: string;
  status: 'starting' | 'active' | 'completed' | 'stopped' | 'error';
  config: any;
  agentsStatus: {
    flashbotsDetective: 'starting' | 'active' | 'error' | 'stopped';
    riskGuardian: 'starting' | 'active' | 'error' | 'stopped';
    strategyOptimizer: 'starting' | 'active' | 'error' | 'stopped';
  };
  progress?: number;
  currentPhase?: string;
  startTime: number;
  lastUpdate: number;
  executionMetrics?: any;
  executionSummary?: any;
  stopTime?: number;
}

export interface AgentState {
  agentId: string;
  status: 'idle' | 'processing' | 'active' | 'error';
  responseTime: number;
  accuracy: number;
  lastActivity: number;
  lastResult?: any;
  processingCount: number;
  errorCount: number;
}

export interface SystemHealth {
  contaboVpsHealth: 'healthy' | 'degraded' | 'error';
  cloudflareEdgeHealth: 'healthy' | 'degraded' | 'error';
  databaseHealth: 'healthy' | 'degraded' | 'error';
  lastCheck: number;
  activeWorkflows: number;
  systemHealth: number;
  averageLatency: number;
  totalProfitToday: number;
}

export class EdgeKVService {
  private kv: KVNamespace;
  private defaultTtl: number = 300; // 5 minutos default

  constructor(kvNamespace: KVNamespace) {
    this.kv = kvNamespace;
  }

  // Métodos para workflows
  async setWorkflowState(workflowId: string, state: WorkflowState, options?: CacheOptions): Promise<void> {
    const key = `workflow:${workflowId}`;
    const ttl = options?.expirationTtl || 86400; // 24 horas para workflows
    
    await this.kv.put(key, JSON.stringify(state), { 
      expirationTtl: ttl,
      metadata: options?.metadata 
    });
  }

  async getWorkflowState(workflowId: string): Promise<WorkflowState | null> {
    const key = `workflow:${workflowId}`;
    const data = await this.kv.get(key);
    
    return data ? JSON.parse(data) : null;
  }

  async deleteWorkflowState(workflowId: string): Promise<void> {
    const key = `workflow:${workflowId}`;
    await this.kv.delete(key);
  }

  async listActiveWorkflows(): Promise<string[]> {
    const activeWorkflowsData = await this.kv.get('system:active_workflows');
    return activeWorkflowsData ? JSON.parse(activeWorkflowsData) : [];
  }

  async addActiveWorkflow(workflowId: string): Promise<void> {
    const activeWorkflows = await this.listActiveWorkflows();
    if (!activeWorkflows.includes(workflowId)) {
      activeWorkflows.push(workflowId);
      await this.kv.put('system:active_workflows', JSON.stringify(activeWorkflows), { 
        expirationTtl: 86400 
      });
    }
  }

  async removeActiveWorkflow(workflowId: string): Promise<void> {
    const activeWorkflows = await this.listActiveWorkflows();
    const filtered = activeWorkflows.filter(id => id !== workflowId);
    await this.kv.put('system:active_workflows', JSON.stringify(filtered), { 
      expirationTtl: 86400 
    });
  }

  // Métodos para agentes
  async setAgentState(agentId: string, state: AgentState, workflowId?: string, options?: CacheOptions): Promise<void> {
    const key = workflowId ? `agent:${agentId}:${workflowId}` : `agent:${agentId}:latest`;
    const ttl = options?.expirationTtl || 3600; // 1 hora para estados de agentes
    
    await this.kv.put(key, JSON.stringify(state), { 
      expirationTtl: ttl,
      metadata: options?.metadata 
    });
  }

  async getAgentState(agentId: string, workflowId?: string): Promise<AgentState | null> {
    const key = workflowId ? `agent:${agentId}:${workflowId}` : `agent:${agentId}:latest`;
    const data = await this.kv.get(key);
    
    return data ? JSON.parse(data) : null;
  }

  async getAllAgentsState(workflowId?: string): Promise<Record<string, AgentState>> {
    const agents = ['flashbots-detective', 'risk-guardian', 'strategy-optimizer'];
    const states: Record<string, AgentState> = {};
    
    for (const agentId of agents) {
      const state = await this.getAgentState(agentId, workflowId);
      if (state) {
        states[agentId] = state;
      }
    }
    
    return states;
  }

  // Métodos para salud del sistema
  async setSystemHealth(health: SystemHealth, options?: CacheOptions): Promise<void> {
    const ttl = options?.expirationTtl || 300; // 5 minutos para salud del sistema
    
    await this.kv.put('system:health', JSON.stringify(health), { 
      expirationTtl: ttl,
      metadata: options?.metadata 
    });
  }

  async getSystemHealth(): Promise<SystemHealth | null> {
    const data = await this.kv.get('system:health');
    return data ? JSON.parse(data) : null;
  }

  // Métodos para métricas en tiempo real
  async setLiveMetrics(metrics: any, options?: CacheOptions): Promise<void> {
    const ttl = options?.expirationTtl || 60; // 1 minuto para métricas live
    
    await this.kv.put('system:live_metrics', JSON.stringify({
      ...metrics,
      timestamp: Date.now()
    }), { 
      expirationTtl: ttl,
      metadata: options?.metadata 
    });
  }

  async getLiveMetrics(): Promise<any> {
    const data = await this.kv.get('system:live_metrics');
    return data ? JSON.parse(data) : null;
  }

  // Métodos para configuración
  async setConfig(key: string, value: any, options?: CacheOptions): Promise<void> {
    const configKey = `config:${key}`;
    const ttl = options?.expirationTtl || 3600; // 1 hora para configuración
    
    await this.kv.put(configKey, JSON.stringify(value), { 
      expirationTtl: ttl,
      metadata: options?.metadata 
    });
  }

  async getConfig(key: string): Promise<any> {
    const configKey = `config:${key}`;
    const data = await this.kv.get(configKey);
    return data ? JSON.parse(data) : null;
  }

  // Métodos para cache de oportunidades
  async cacheOpportunity(opportunityId: string, opportunity: any, options?: CacheOptions): Promise<void> {
    const key = `opportunity:${opportunityId}`;
    const ttl = options?.expirationTtl || 1800; // 30 minutos para oportunidades
    
    await this.kv.put(key, JSON.stringify({
      ...opportunity,
      cached_at: Date.now()
    }), { 
      expirationTtl: ttl,
      metadata: options?.metadata 
    });
  }

  async getCachedOpportunity(opportunityId: string): Promise<any> {
    const key = `opportunity:${opportunityId}`;
    const data = await this.kv.get(key);
    return data ? JSON.parse(data) : null;
  }

  // Métodos para cache de respuestas de API
  async cacheApiResponse(endpoint: string, params: string, response: any, options?: CacheOptions): Promise<void> {
    const key = `api_cache:${endpoint}:${this.hashParams(params)}`;
    const ttl = options?.expirationTtl || this.defaultTtl;
    
    await this.kv.put(key, JSON.stringify({
      response,
      cached_at: Date.now(),
      endpoint,
      params
    }), { 
      expirationTtl: ttl,
      metadata: options?.metadata 
    });
  }

  async getCachedApiResponse(endpoint: string, params: string): Promise<any> {
    const key = `api_cache:${endpoint}:${this.hashParams(params)}`;
    const data = await this.kv.get(key);
    
    if (!data) return null;
    
    const cached = JSON.parse(data);
    
    // Verificar si el cache no está muy viejo (además del TTL)
    const maxAge = 600000; // 10 minutos máximo
    if (Date.now() - cached.cached_at > maxAge) {
      await this.kv.delete(key);
      return null;
    }
    
    return cached.response;
  }

  // Métodos para rate limiting
  async incrementRateLimit(identifier: string, windowSeconds: number = 60): Promise<number> {
    const key = `rate_limit:${identifier}:${Math.floor(Date.now() / (windowSeconds * 1000))}`;
    
    let count = 1;
    const existing = await this.kv.get(key);
    
    if (existing) {
      count = parseInt(existing) + 1;
    }
    
    await this.kv.put(key, count.toString(), { expirationTtl: windowSeconds + 10 });
    return count;
  }

  async getRateLimit(identifier: string, windowSeconds: number = 60): Promise<number> {
    const key = `rate_limit:${identifier}:${Math.floor(Date.now() / (windowSeconds * 1000))}`;
    const data = await this.kv.get(key);
    return data ? parseInt(data) : 0;
  }

  // Métodos para sesiones y locks distribuidos
  async acquireLock(lockKey: string, ttlSeconds: number = 30): Promise<boolean> {
    const key = `lock:${lockKey}`;
    const lockValue = `${Date.now()}-${Math.random()}`;
    
    // Intentar adquirir el lock
    const existing = await this.kv.get(key);
    if (existing) {
      return false; // Lock ya existe
    }
    
    await this.kv.put(key, lockValue, { expirationTtl: ttlSeconds });
    
    // Verificar que realmente obtuvimos el lock
    const verification = await this.kv.get(key);
    return verification === lockValue;
  }

  async releaseLock(lockKey: string): Promise<void> {
    const key = `lock:${lockKey}`;
    await this.kv.delete(key);
  }

  // Métodos para estadísticas agregadas
  async incrementCounter(counterKey: string, increment: number = 1, windowHours: number = 24): Promise<number> {
    const key = `counter:${counterKey}:${Math.floor(Date.now() / (windowHours * 3600000))}`;
    
    let count = increment;
    const existing = await this.kv.get(key);
    
    if (existing) {
      count = parseInt(existing) + increment;
    }
    
    await this.kv.put(key, count.toString(), { expirationTtl: windowHours * 3600 + 300 });
    return count;
  }

  async getCounter(counterKey: string, windowHours: number = 24): Promise<number> {
    const key = `counter:${counterKey}:${Math.floor(Date.now() / (windowHours * 3600000))}`;
    const data = await this.kv.get(key);
    return data ? parseInt(data) : 0;
  }

  // Métodos de utilidad
  async listKeys(prefix: string, limit: number = 1000): Promise<string[]> {
    const result = await this.kv.list({ prefix, limit });
    return result.keys.map(key => key.name);
  }

  async bulkDelete(keys: string[]): Promise<void> {
    const deletePromises = keys.map(key => this.kv.delete(key));
    await Promise.all(deletePromises);
  }

  async getKeyMetadata(key: string): Promise<any> {
    const result = await this.kv.getWithMetadata(key);
    return result.metadata;
  }

  // Helpers privados
  private hashParams(params: string): string {
    // Simple hash para parámetros de cache
    let hash = 0;
    for (let i = 0; i < params.length; i++) {
      const char = params.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  // Método para cleanup de cache expirado
  async cleanupExpiredCache(prefixes: string[] = ['api_cache:', 'opportunity:', 'rate_limit:']): Promise<number> {
    let deletedCount = 0;
    
    for (const prefix of prefixes) {
      const keys = await this.listKeys(prefix);
      
      for (const key of keys) {
        const data = await this.kv.get(key);
        if (!data) {
          // Key ya expiró, pero está en la lista, eliminar del listado
          deletedCount++;
        }
      }
    }
    
    return deletedCount;
  }

  // Método para estadísticas del KV store
  async getKVStats(): Promise<any> {
    const prefixes = ['workflow:', 'agent:', 'system:', 'config:', 'opportunity:', 'api_cache:', 'lock:', 'counter:'];
    const stats: Record<string, number> = {};
    
    for (const prefix of prefixes) {
      const keys = await this.listKeys(prefix, 100);
      stats[prefix.replace(':', '')] = keys.length;
    }
    
    return {
      keysByPrefix: stats,
      totalEstimatedKeys: Object.values(stats).reduce((sum, count) => sum + count, 0),
      timestamp: Date.now()
    };
  }
}
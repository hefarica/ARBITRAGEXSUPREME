/**
 * ArbitrageX Supreme V3.0 - Cloudflare Edge API
 * POST /api/multiagent/start - Iniciar sistema multiagente
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { EdgeKVService } from '../../../services/EdgeKVService';
import { EdgeBackendCommunication } from '../../../services/EdgeBackendCommunication';

type Bindings = {
  DB: D1Database;
  KV: KVNamespace;
  R2: R2Bucket;
  CONTABO_VPS_URL: string;
  CONTABO_API_KEY: string;
};

type Variables = {
  kvService: EdgeKVService;
  backendComm: EdgeBackendCommunication;
};

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use('*', cors());

export interface MultiAgentStartRequest {
  config: {
    opportunityId?: string;
    tokenPair?: string;
    minProfitThreshold: number;
    maxGasPrice: number;
    riskTolerance: 'low' | 'medium' | 'high';
    autoExecute?: boolean;
  };
  agentsConfig?: {
    flashbotsDetective: { enabled: boolean; sensitivity?: number };
    riskGuardian: { enabled: boolean; maxRiskScore?: number };
    strategyOptimizer: { enabled: boolean; aggressiveness?: number };
  };
}

export interface MultiAgentStartResponse {
  success: boolean;
  workflowId: string;
  message: string;
  estimatedCompletionTime: number;
  agentsStatus: {
    flashbotsDetective: 'starting' | 'active' | 'error';
    riskGuardian: 'starting' | 'active' | 'error';
    strategyOptimizer: 'starting' | 'active' | 'error';
  };
  monitoringUrl: string;
}

app.post('/start', async (c) => {
  try {
    const startTime = Date.now();
    
    // Obtener servicios del contexto
    const kvService = c.get('kvService');
    const backendComm = c.get('backendComm');
    
    // Validar request
    const requestData: MultiAgentStartRequest = await c.req.json();
    
    if (!requestData.config || typeof requestData.config.minProfitThreshold !== 'number') {
      return c.json({ 
        success: false, 
        error: 'Invalid configuration. minProfitThreshold is required.' 
      }, 400);
    }

    // Generar workflow ID único
    const workflowId = `arbitrage_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    // Configuración default para agentes
    const defaultAgentsConfig = {
      flashbotsDetective: { enabled: true, sensitivity: 0.8 },
      riskGuardian: { enabled: true, maxRiskScore: 7.0 },
      strategyOptimizer: { enabled: true, aggressiveness: 0.7 }
    };
    
    const agentsConfig = { ...defaultAgentsConfig, ...requestData.agentsConfig };

    // Preparar request para el backend usando el servicio
    const workflowRequest = {
      workflowId,
      config: requestData.config,
      metadata: {
        agentsConfig,
        requestId: crypto.randomUUID(),
        timestamp: startTime,
        source: 'cloudflare_edge'
      }
    };

    // Usar servicio de comunicación backend
    const backendResponse = await backendComm.startWorkflow(workflowRequest);

    if (!backendResponse.success) {
      throw new Error(`Backend communication failed: ${backendResponse.error}`);
    }

    // Guardar estado inicial en D1 database
    await c.env.DB.prepare(`
      INSERT INTO workflow_executions (
        workflow_id, config, agents_config, status, created_at, edge_request_id
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      workflowId,
      JSON.stringify(requestData.config),
      JSON.stringify(agentsConfig),
      'starting',
      new Date().toISOString(),
      workflowRequest.metadata.requestId
    ).run();

    // El estado en KV ya se maneja automáticamente por el EdgeBackendCommunication service
    
    // Respuesta exitosa
    const response: MultiAgentStartResponse = {
      success: true,
      workflowId: workflowId,
      message: 'Multiagent arbitrage system started successfully',
      estimatedCompletionTime: startTime + 30000, // 30 segundos estimados
      agentsStatus: {
        flashbotsDetective: 'starting',
        riskGuardian: 'starting',
        strategyOptimizer: 'starting'
      },
      monitoringUrl: `/api/sse/multiagent-updates?workflowId=${workflowId}`
    };

    // Log de auditoría usando el servicio KV
    await kvService.incrementCounter('workflows_started_via_api', 1, 24);
    
    console.log(`[EDGE] Multiagent system started: ${workflowId}`, {
      config: requestData.config,
      processingTime: Date.now() - startTime,
      backendResponse: backendResponse.success
    });

    return c.json(response);

  } catch (error) {
    console.error('[EDGE] Error starting multiagent system:', error);
    
    // Incrementar contador de errores si tenemos acceso al servicio KV
    try {
      const kvService = c.get('kvService');
      await kvService.incrementCounter('workflow_start_errors', 1, 24);
    } catch (kvError) {
      console.error('[EDGE] Failed to increment error counter:', kvError);
    }
    
    return c.json({
      success: false,
      error: 'Failed to start multiagent system',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now()
    }, 500);
  }
});

export default app;
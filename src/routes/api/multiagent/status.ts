/**
 * ArbitrageX Supreme V3.0 - Cloudflare Edge API
 * GET /api/multiagent/status - Estado del sistema multiagente
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

export interface MultiAgentStatusResponse {
  success: boolean;
  system: {
    status: 'idle' | 'active' | 'stopping' | 'error';
    activeWorkflows: number;
    totalWorkflowsToday: number;
    systemHealth: number; // 0-100
    lastUpdate: number;
  };
  agents: {
    flashbotsDetective: AgentStatus;
    riskGuardian: AgentStatus;
    strategyOptimizer: AgentStatus;
  };
  performance: {
    averageLatency: number;
    successRate: number;
    totalProfitToday: number;
    opportunitiesProcessedToday: number;
  };
  infrastructure: {
    contaboVpsHealth: 'healthy' | 'degraded' | 'error';
    cloudflareEdgeHealth: 'healthy' | 'degraded' | 'error';
    databaseHealth: 'healthy' | 'degraded' | 'error';
  };
}

export interface AgentStatus {
  id: string;
  name: string;
  status: 'idle' | 'processing' | 'active' | 'error';
  lastActivity: number;
  responseTime: number; // ms
  accuracy: number; // percentage
  processedCount: number;
  errorCount: number;
}

app.get('/status', async (c) => {
  try {
    const requestTime = Date.now();
    const todayStart = new Date().setHours(0, 0, 0, 0);
    
    // Obtener servicios del contexto
    const kvService = c.get('kvService');
    const backendComm = c.get('backendComm');

    // Obtener workflows activos usando el servicio KV
    const activeWorkflows = await kvService.listActiveWorkflows();

    // Obtener estadísticas del día desde D1
    const todayStats = await c.env.DB.prepare(`
      SELECT 
        COUNT(*) as total_workflows,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_workflows,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_workflows,
        SUM(CASE WHEN execution_summary IS NOT NULL THEN 
          JSON_EXTRACT(execution_summary, '$.totalProfit') ELSE 0 END) as total_profit,
        AVG(CASE WHEN execution_summary IS NOT NULL THEN 
          JSON_EXTRACT(execution_summary, '$.duration') ELSE NULL END) as avg_duration
      FROM workflow_executions 
      WHERE created_at >= ?
    `).bind(new Date(todayStart).toISOString()).first();

    // Obtener estado del sistema usando el servicio KV
    let systemHealth = await kvService.getSystemHealth();
    if (!systemHealth) {
      systemHealth = {
        contaboVpsHealth: 'healthy',
        cloudflareEdgeHealth: 'healthy', 
        databaseHealth: 'healthy',
        lastCheck: Date.now(),
        activeWorkflows: activeWorkflows.length,
        systemHealth: 100,
        averageLatency: 0,
        totalProfitToday: 0
      };
    }

    // Comunicación con CONTABO VPS para obtener estado de agentes usando el servicio
    let agentsStatus = {
      flashbotsDetective: createDefaultAgentStatus('flashbots-detective', 'Flashbots Detective'),
      riskGuardian: createDefaultAgentStatus('risk-guardian', 'Risk Guardian'),
      strategyOptimizer: createDefaultAgentStatus('strategy-optimizer', 'Strategy Optimizer')
    };

    try {
      // Usar el servicio de comunicación backend
      const backendAgentsResponse = await backendComm.getAllAgentsStatus(undefined, true);
      
      if (backendAgentsResponse.success && backendAgentsResponse.data) {
        const agentsData = backendAgentsResponse.data;
        agentsStatus = {
          flashbotsDetective: mapEdgeAgentStatus(agentsData['flashbots-detective'], 'flashbots-detective', 'Flashbots Detective'),
          riskGuardian: mapEdgeAgentStatus(agentsData['risk-guardian'], 'risk-guardian', 'Risk Guardian'),
          strategyOptimizer: mapEdgeAgentStatus(agentsData['strategy-optimizer'], 'strategy-optimizer', 'Strategy Optimizer')
        };
      }
    } catch (backendError) {
      console.warn('[EDGE] Could not fetch agent status from backend:', backendError);
      systemHealth.contaboVpsHealth = 'degraded';
    }

    // Calcular métricas de performance
    const successfulWorkflows = (todayStats?.completed_workflows as number) || 0;
    const totalWorkflows = (todayStats?.total_workflows as number) || 0;
    const successRate = totalWorkflows > 0 ? (successfulWorkflows / totalWorkflows) * 100 : 100;
    
    // Determinar estado general del sistema
    const systemStatus = determineSystemStatus(activeWorkflows.length, systemHealth);
    
    // Calcular health score del sistema
    const systemHealthScore = calculateSystemHealthScore(systemHealth, agentsStatus);

    // Respuesta completa
    const response: MultiAgentStatusResponse = {
      success: true,
      system: {
        status: systemStatus,
        activeWorkflows: activeWorkflows.length,
        totalWorkflowsToday: totalWorkflows,
        systemHealth: systemHealthScore,
        lastUpdate: Date.now()
      },
      agents: agentsStatus,
      performance: {
        averageLatency: (todayStats?.avg_duration as number) || 0,
        successRate: Math.round(successRate * 100) / 100,
        totalProfitToday: (todayStats?.total_profit as number) || 0,
        opportunitiesProcessedToday: (totalWorkflows as number)
      },
      infrastructure: {
        contaboVpsHealth: systemHealth.contaboVpsHealth,
        cloudflareEdgeHealth: 'healthy', // Asumimos healthy si llegamos aquí
        databaseHealth: systemHealth.databaseHealth
      }
    };

    // Actualizar timestamp de última consulta usando el servicio KV
    await kvService.setConfig('last_status_check', {
      timestamp: Date.now(),
      requestLatency: Date.now() - requestTime
    }, { expirationTtl: 300 });
    
    // Actualizar métricas live
    await kvService.setLiveMetrics({
      activeWorkflows: activeWorkflows.length,
      systemHealthScore: systemHealthScore,
      lastStatusCheck: Date.now(),
      responseLatency: Date.now() - requestTime
    });

    return c.json(response);

  } catch (error) {
    console.error('[EDGE] Error getting multiagent status:', error);
    
    return c.json({
      success: false,
      error: 'Failed to get multiagent status',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now()
    }, 500);
  }
});

// Helper functions
function createDefaultAgentStatus(id: string, name: string): AgentStatus {
  return {
    id: id,
    name: name,
    status: 'idle',
    lastActivity: Date.now(),
    responseTime: 0,
    accuracy: 95.0,
    processedCount: 0,
    errorCount: 0
  };
}

function mapContaboAgentStatus(contaboAgent: any, id: string, name: string): AgentStatus {
  if (!contaboAgent) return createDefaultAgentStatus(id, name);
  
  return {
    id: id,
    name: name,
    status: contaboAgent.status || 'idle',
    lastActivity: contaboAgent.lastActivity || Date.now(),
    responseTime: contaboAgent.responseTime || 0,
    accuracy: contaboAgent.accuracy || 95.0,
    processedCount: contaboAgent.processedCount || 0,
    errorCount: contaboAgent.errorCount || 0
  };
}

// Nueva función para mapear agentes desde el EdgeBackendCommunication service
function mapEdgeAgentStatus(edgeAgent: any, id: string, name: string): AgentStatus {
  if (!edgeAgent) return createDefaultAgentStatus(id, name);
  
  return {
    id: id,
    name: name,
    status: edgeAgent.status || 'idle',
    lastActivity: edgeAgent.lastActivity || Date.now(),
    responseTime: edgeAgent.responseTime || 0,
    accuracy: edgeAgent.accuracy || 95.0,
    processedCount: edgeAgent.processingCount || 0,
    errorCount: edgeAgent.errorCount || 0
  };
}

function determineSystemStatus(activeWorkflows: number, systemHealth: any): 'idle' | 'active' | 'stopping' | 'error' {
  if (systemHealth.contaboVpsHealth === 'error' || systemHealth.databaseHealth === 'error') {
    return 'error';
  }
  
  if (activeWorkflows > 0) {
    return 'active';
  }
  
  return 'idle';
}

function calculateSystemHealthScore(systemHealth: any, agentsStatus: any): number {
  let score = 100;
  
  // Penalizar por problemas de infraestructura
  if (systemHealth.contaboVpsHealth === 'degraded') score -= 20;
  if (systemHealth.contaboVpsHealth === 'error') score -= 50;
  if (systemHealth.databaseHealth === 'degraded') score -= 15;
  if (systemHealth.databaseHealth === 'error') score -= 40;
  
  // Penalizar por problemas de agentes
  Object.values(agentsStatus).forEach((agent: any) => {
    if (agent.status === 'error') score -= 15;
    if (agent.errorCount > 0) score -= Math.min(agent.errorCount * 2, 10);
  });
  
  return Math.max(0, Math.min(100, Math.round(score)));
}

export default app;
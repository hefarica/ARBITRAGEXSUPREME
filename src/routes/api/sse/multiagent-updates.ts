/**
 * ArbitrageX Supreme V3.0 - Cloudflare Edge API
 * GET /api/sse/multiagent-updates - Server-Sent Events para updates en tiempo real
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { streamSSE } from 'hono/streaming';

type Bindings = {
  DB: D1Database;
  KV: KVNamespace;
  R2: R2Bucket;
  CONTABO_VPS_URL: string;
  CONTABO_API_KEY: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use('*', cors());

export interface MultiAgentUpdate {
  type: 'system_status' | 'agent_update' | 'workflow_progress' | 'opportunity_detected' | 'execution_complete' | 'error';
  timestamp: number;
  data: any;
  workflowId?: string;
  agentId?: string;
}

app.get('/multiagent-updates', (c) => {
  const workflowId = c.req.query('workflowId');
  const includeSystem = c.req.query('includeSystem') !== 'false';
  
  return streamSSE(c, async (stream) => {
    let isActive = true;
    let updateInterval: any;
    
    // Headers para SSE
    c.header('Content-Type', 'text/event-stream');
    c.header('Cache-Control', 'no-cache');
    c.header('Connection', 'keep-alive');
    
    console.log(`[EDGE SSE] Client connected. WorkflowId: ${workflowId}, IncludeSystem: ${includeSystem}`);
    
    // Enviar mensaje inicial
    await stream.writeSSE({
      data: JSON.stringify({
        type: 'connection_established',
        timestamp: Date.now(),
        data: {
          message: 'Connected to ArbitrageX multiagent updates',
          workflowId: workflowId,
          includeSystem: includeSystem
        }
      }),
      event: 'connected'
    });

    // Función para obtener y enviar updates
    const sendUpdates = async () => {
      if (!isActive) return;
      
      try {
        // 1. Estado del sistema (si se solicita)
        if (includeSystem) {
          const systemUpdate = await getSystemStatusUpdate(c.env);
          if (systemUpdate) {
            await stream.writeSSE({
              data: JSON.stringify(systemUpdate),
              event: 'system_update',
              id: `system_${Date.now()}`
            });
          }
        }

        // 2. Updates específicos de workflow
        if (workflowId) {
          const workflowUpdates = await getWorkflowUpdates(c.env, workflowId);
          for (const update of workflowUpdates) {
            if (!isActive) break;
            await stream.writeSSE({
              data: JSON.stringify(update),
              event: 'workflow_update',
              id: `workflow_${workflowId}_${Date.now()}`
            });
          }
        }

        // 3. Updates de agentes activos
        const agentUpdates = await getAgentUpdates(c.env, workflowId);
        for (const update of agentUpdates) {
          if (!isActive) break;
          await stream.writeSSE({
            data: JSON.stringify(update),
            event: 'agent_update', 
            id: `agent_${update.agentId}_${Date.now()}`
          });
        }

        // 4. Oportunidades recientes detectadas
        const opportunityUpdates = await getOpportunityUpdates(c.env);
        for (const update of opportunityUpdates) {
          if (!isActive) break;
          await stream.writeSSE({
            data: JSON.stringify(update),
            event: 'opportunity_detected',
            id: `opportunity_${Date.now()}`
          });
        }

      } catch (error) {
        console.error('[EDGE SSE] Error sending updates:', error);
        
        await stream.writeSSE({
          data: JSON.stringify({
            type: 'error',
            timestamp: Date.now(),
            data: {
              message: 'Error fetching updates',
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          }),
          event: 'error'
        });
      }
    };

    // Enviar updates inicial
    await sendUpdates();

    // Configurar interval para updates periódicos
    updateInterval = setInterval(async () => {
      await sendUpdates();
    }, 2000); // Updates cada 2 segundos

    // Heartbeat para mantener conexión viva
    const heartbeatInterval = setInterval(async () => {
      if (!isActive) return;
      
      try {
        await stream.writeSSE({
          data: JSON.stringify({
            type: 'heartbeat',
            timestamp: Date.now(),
            data: { status: 'connected' }
          }),
          event: 'heartbeat'
        });
      } catch (error) {
        console.log('[EDGE SSE] Heartbeat failed, client likely disconnected');
        isActive = false;
      }
    }, 30000); // Heartbeat cada 30 segundos

    // Cleanup al cerrar conexión
    stream.onAbort(() => {
      isActive = false;
      if (updateInterval) clearInterval(updateInterval);
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      console.log(`[EDGE SSE] Client disconnected. WorkflowId: ${workflowId}`);
    });

  });
});

// Helper functions para obtener diferentes tipos de updates

async function getSystemStatusUpdate(env: Bindings): Promise<MultiAgentUpdate | null> {
  try {
    // Obtener métricas del sistema desde KV
    const systemMetrics = await env.KV.get('system:live_metrics');
    if (!systemMetrics) return null;

    const metrics = JSON.parse(systemMetrics);
    
    return {
      type: 'system_status',
      timestamp: Date.now(),
      data: {
        activeWorkflows: metrics.activeWorkflows || 0,
        systemHealth: metrics.systemHealth || 100,
        averageLatency: metrics.averageLatency || 0,
        totalProfitToday: metrics.totalProfitToday || 0,
        infrastructure: {
          contaboVpsHealth: metrics.contaboVpsHealth || 'healthy',
          cloudflareEdgeHealth: 'healthy',
          databaseHealth: metrics.databaseHealth || 'healthy'
        }
      }
    };
  } catch (error) {
    console.error('Error getting system status update:', error);
    return null;
  }
}

async function getWorkflowUpdates(env: Bindings, workflowId: string): Promise<MultiAgentUpdate[]> {
  const updates: MultiAgentUpdate[] = [];
  
  try {
    // Obtener estado actual del workflow desde KV
    const workflowData = await env.KV.get(`workflow:${workflowId}`);
    if (!workflowData) return updates;

    const workflow = JSON.parse(workflowData);
    
    // Check si hay cambios recientes (último minuto)
    const recentThreshold = Date.now() - 60000; // 1 minuto
    if (workflow.lastUpdate && workflow.lastUpdate > recentThreshold) {
      updates.push({
        type: 'workflow_progress',
        timestamp: workflow.lastUpdate,
        workflowId: workflowId,
        data: {
          status: workflow.status,
          progress: workflow.progress || 0,
          currentPhase: workflow.currentPhase || 'initialization',
          agentsStatus: workflow.agentsStatus,
          executionMetrics: workflow.executionMetrics || {}
        }
      });
    }

    // Verificar si el workflow ha completado
    if (workflow.status === 'completed' || workflow.status === 'stopped') {
      updates.push({
        type: 'execution_complete',
        timestamp: workflow.completedAt || Date.now(),
        workflowId: workflowId,
        data: {
          finalStatus: workflow.status,
          executionSummary: workflow.executionSummary || {},
          duration: workflow.stopTime ? workflow.stopTime - workflow.startTime : 0,
          profit: workflow.executionSummary?.totalProfit || 0
        }
      });
    }

  } catch (error) {
    console.error('Error getting workflow updates:', error);
  }
  
  return updates;
}

async function getAgentUpdates(env: Bindings, workflowId?: string): Promise<MultiAgentUpdate[]> {
  const updates: MultiAgentUpdate[] = [];
  
  try {
    const agents = ['flashbots-detective', 'risk-guardian', 'strategy-optimizer'];
    
    for (const agentId of agents) {
      const agentKey = workflowId ? `agent:${agentId}:${workflowId}` : `agent:${agentId}:latest`;
      const agentData = await env.KV.get(agentKey);
      
      if (agentData) {
        const agent = JSON.parse(agentData);
        
        // Solo incluir si hay actividad reciente (últimos 5 minutos)
        const recentThreshold = Date.now() - 300000;
        if (agent.lastActivity && agent.lastActivity > recentThreshold) {
          updates.push({
            type: 'agent_update',
            timestamp: agent.lastActivity,
            workflowId: workflowId,
            agentId: agentId,
            data: {
              status: agent.status,
              responseTime: agent.responseTime || 0,
              accuracy: agent.accuracy || 95,
              lastResult: agent.lastResult || null,
              processingCount: agent.processingCount || 0
            }
          });
        }
      }
    }

  } catch (error) {
    console.error('Error getting agent updates:', error);
  }
  
  return updates;
}

async function getOpportunityUpdates(env: Bindings): Promise<MultiAgentUpdate[]> {
  const updates: MultiAgentUpdate[] = [];
  
  try {
    // Obtener oportunidades recientes detectadas (últimos 2 minutos)
    const recentThreshold = new Date(Date.now() - 120000).toISOString();
    
    const opportunities = await env.DB.prepare(`
      SELECT * FROM opportunities_detected 
      WHERE created_at > ? 
      ORDER BY created_at DESC 
      LIMIT 5
    `).bind(recentThreshold).all();

    for (const opportunity of opportunities.results) {
      updates.push({
        type: 'opportunity_detected',
        timestamp: new Date(opportunity.created_at as string).getTime(),
        data: {
          tokenPair: opportunity.token_pair,
          profitUsd: opportunity.profit_usd,
          dexRoutes: JSON.parse((opportunity.dex_routes as string) || '[]'),
          confidence: opportunity.confidence || 0,
          riskScore: opportunity.risk_score || 0,
          status: opportunity.status || 'detected'
        }
      });
    }

  } catch (error) {
    console.error('Error getting opportunity updates:', error);
  }
  
  return updates;
}

export default app;
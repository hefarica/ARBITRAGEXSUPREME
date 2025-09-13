/**
 * ArbitrageX Supreme V3.0 - Cloudflare Edge API
 * POST /api/multiagent/stop - Detener sistema multiagente
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

export interface MultiAgentStopRequest {
  workflowId: string;
  reason?: string;
  forceStop?: boolean;
}

export interface MultiAgentStopResponse {
  success: boolean;
  workflowId: string;
  message: string;
  stopTime: number;
  finalStatus: string;
  executionSummary?: {
    duration: number;
    opportunitiesProcessed: number;
    successfulExecutions: number;
    totalProfit: number;
    finalState: string;
  };
}

app.post('/stop', async (c) => {
  try {
    const stopTime = Date.now();
    
    // Obtener servicios del contexto
    const kvService = c.get('kvService');
    const backendComm = c.get('backendComm');
    
    // Validar request
    const requestData: MultiAgentStopRequest = await c.req.json();
    
    if (!requestData.workflowId) {
      return c.json({ 
        success: false, 
        error: 'workflowId is required' 
      }, 400);
    }

    // Verificar que el workflow existe y está activo usando el servicio KV
    const workflow = await kvService.getWorkflowState(requestData.workflowId);
    
    if (!workflow) {
      return c.json({
        success: false,
        error: 'Workflow not found or already stopped',
        workflowId: requestData.workflowId
      }, 404);
    }
    
    if (workflow.status === 'stopped' || workflow.status === 'completed') {
      return c.json({
        success: false,
        error: `Workflow is already ${workflow.status}`,
        workflowId: requestData.workflowId,
        finalStatus: workflow.status
      }, 400);
    }

    // Preparar request para detener workflow usando el servicio de comunicación
    const stopRequest = {
      workflowId: requestData.workflowId,
      reason: (requestData.reason as any) || 'user_requested',
      forceStop: requestData.forceStop || false
    };

    // Usar servicio de comunicación backend
    const backendResponse = await backendComm.stopWorkflow(stopRequest);

    if (!backendResponse.success) {
      throw new Error(`Backend stop workflow failed: ${backendResponse.error}`);
    }

    const contaboResult = backendResponse.data;

    // Obtener resumen de ejecución de la base de datos
    const executionData = await c.env.DB.prepare(`
      SELECT * FROM workflow_executions 
      WHERE workflow_id = ? 
      ORDER BY created_at DESC 
      LIMIT 1
    `).bind(requestData.workflowId).first();

    let executionSummary = undefined;
    
    if (executionData && contaboResult.executionSummary) {
      const startTime = new Date(executionData.created_at as string).getTime();
      executionSummary = {
        duration: stopTime - startTime,
        opportunitiesProcessed: contaboResult.executionSummary.opportunitiesProcessed || 0,
        successfulExecutions: contaboResult.executionSummary.successfulExecutions || 0,
        totalProfit: contaboResult.executionSummary.totalProfit || 0,
        finalState: contaboResult.executionSummary.finalState || 'stopped'
      };
    }

    // Actualizar estado en D1 database
    await c.env.DB.prepare(`
      UPDATE workflow_executions 
      SET status = ?, stopped_at = ?, execution_summary = ?
      WHERE workflow_id = ?
    `).bind(
      'stopped',
      new Date().toISOString(),
      executionSummary ? JSON.stringify(executionSummary) : null,
      requestData.workflowId
    ).run();

    // El estado se actualiza automáticamente por el EdgeBackendCommunication service
    // Pero también actualizamos manualmente para asegurar consistencia
    const updatedWorkflow = {
      ...workflow,
      status: 'stopped' as const,
      stopTime: stopTime,
      stopReason: requestData.reason || 'Manual stop',
      executionSummary: executionSummary,
      agentsStatus: {
        flashbotsDetective: 'stopped' as const,
        riskGuardian: 'stopped' as const,
        strategyOptimizer: 'stopped' as const
      },
      lastUpdate: Date.now()
    };

    await kvService.setWorkflowState(requestData.workflowId, updatedWorkflow, { expirationTtl: 86400 });

    // Respuesta exitosa
    const response: MultiAgentStopResponse = {
      success: true,
      workflowId: requestData.workflowId,
      message: 'Multiagent system stopped successfully',
      stopTime: stopTime,
      finalStatus: 'stopped',
      executionSummary: executionSummary
    };

    // Log de auditoría y métricas
    await kvService.incrementCounter('workflows_stopped_via_api', 1, 24);
    
    console.log(`[EDGE] Multiagent system stopped: ${requestData.workflowId}`, {
      reason: requestData.reason,
      executionSummary: executionSummary,
      processingTime: Date.now() - stopTime,
      backendSuccess: backendResponse.success
    });

    return c.json(response);

  } catch (error) {
    console.error('[EDGE] Error stopping multiagent system:', error);
    
    // Incrementar contador de errores
    try {
      const kvService = c.get('kvService');
      await kvService.incrementCounter('workflow_stop_errors', 1, 24);
    } catch (kvError) {
      console.error('[EDGE] Failed to increment error counter:', kvError);
    }
    
    return c.json({
      success: false,
      error: 'Failed to stop multiagent system',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now()
    }, 500);
  }
});

export default app;
/**
 * ArbitrageX Supreme V3.0 - Cloudflare Edge Main Router
 * 
 * Este es el punto de entrada principal para la API edge de Cloudflare
 * que conecta el frontend Lovable con el backend multiagente CONTABO
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { secureHeaders } from 'hono/secure-headers';
import { serveStatic } from 'hono/cloudflare-workers';

// Importar servicios de edge
import { EdgeKVService } from './services/EdgeKVService';
import { EdgeBackendCommunication, createEdgeBackendCommunication } from './services/EdgeBackendCommunication';

// Importar todos los endpoints de la API
import multiagentStart from './routes/api/multiagent/start';
import multiagentStop from './routes/api/multiagent/stop'; 
import multiagentStatus from './routes/api/multiagent/status';
import sseUpdates from './routes/api/sse/multiagent-updates';

// Tipos para Cloudflare bindings
type Bindings = {
  DB: D1Database;
  KV: KVNamespace;
  R2: R2Bucket;
  CONTABO_VPS_URL: string;
  CONTABO_API_KEY: string;
  CORS_ALLOWED_ORIGINS: string;
  LOG_LEVEL: string;
  MAX_CONCURRENT_WORKFLOWS: string;
  MIN_PROFIT_THRESHOLD_USD: string;
};

// Tipos para variables del contexto
type Variables = {
  kvService: EdgeKVService;
  backendComm: EdgeBackendCommunication;
};

// Crear app principal de Hono
const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Middleware global
app.use('*', logger());
app.use('*', secureHeaders());

// Middleware para inicializar servicios edge
app.use('*', async (c, next) => {
  // Inicializar servicios edge y exponerlos en el contexto
  const kvService = new EdgeKVService(c.env.KV);
  const backendComm = createEdgeBackendCommunication(
    kvService,
    c.env.CONTABO_VPS_URL,
    c.env.CONTABO_API_KEY
  );
  
  // Hacer servicios disponibles en el contexto
  c.set('kvService', kvService);
  c.set('backendComm', backendComm);
  
  await next();
});

// Configurar CORS dinámico basado en environment
app.use('/api/*', async (c, next) => {
  const allowedOrigins = c.env.CORS_ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
  
  return cors({
    origin: allowedOrigins,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Edge-Request-ID'],
    maxAge: 86400, // 24 horas
    credentials: true
  })(c, next);
});

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    service: 'ArbitrageX Supreme V3.0 Edge',
    version: '3.0.0',
    timestamp: Date.now(),
    environment: c.env.LOG_LEVEL || 'production',
    components: {
      workers: 'operational',
      d1_database: 'operational', 
      kv_storage: 'operational',
      r2_storage: 'operational'
    }
  });
});

// API Routes para sistema multiagente
app.route('/api/multiagent', multiagentStart);
app.route('/api/multiagent', multiagentStop);
app.route('/api/multiagent', multiagentStatus);

// Server-Sent Events para updates en tiempo real
app.route('/api/sse', sseUpdates);

// Endpoint para métricas de sistema
app.get('/api/metrics', async (c) => {
  try {
    // Obtener métricas desde D1 y KV
    const todayStart = new Date().setHours(0, 0, 0, 0);
    
    const dailyMetrics = await c.env.DB.prepare(`
      SELECT 
        COUNT(*) as total_workflows,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful_workflows,
        SUM(CASE WHEN execution_summary IS NOT NULL THEN 
          CAST(JSON_EXTRACT(execution_summary, '$.totalProfit') AS REAL) ELSE 0 END) as total_profit
      FROM workflow_executions 
      WHERE created_at >= ?
    `).bind(new Date(todayStart).toISOString()).first() as any;

    const systemHealth = await c.env.KV.get('system:health');
    const activeWorkflows = await c.env.KV.get('system:active_workflows');

    return c.json({
      success: true,
      data: {
        daily: {
          totalWorkflows: (dailyMetrics?.total_workflows as number) || 0,
          successfulWorkflows: (dailyMetrics?.successful_workflows as number) || 0,
          totalProfit: (dailyMetrics?.total_profit as number) || 0,
          successRate: dailyMetrics?.total_workflows 
            ? ((dailyMetrics.successful_workflows as number) / (dailyMetrics.total_workflows as number)) * 100 
            : 100
        },
        system: systemHealth ? JSON.parse(systemHealth) : { health: 100 },
        active: activeWorkflows ? JSON.parse(activeWorkflows) : []
      },
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('[EDGE] Error fetching metrics:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to fetch metrics' 
    }, 500);
  }
});

// Endpoint para configuración del sistema
app.get('/api/config', async (c) => {
  try {
    const config = await c.env.DB.prepare(`
      SELECT config_key, config_value, config_type 
      FROM system_config 
      WHERE config_key NOT LIKE '%secret%' 
      AND config_key NOT LIKE '%key%'
      AND config_key NOT LIKE '%password%'
    `).all();

    const configMap: Record<string, any> = {};
    
    for (const item of config.results) {
      const key = item.config_key as string;
      let value = item.config_value;
      
      // Convertir tipos
      if (item.config_type === 'number') {
        value = parseFloat(value as string);
      } else if (item.config_type === 'boolean') {
        value = value === 'true';
      } else if (item.config_type === 'json') {
        value = JSON.parse(value as string);
      }
      
      configMap[key] = value;
    }

    return c.json({
      success: true,
      config: configMap,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('[EDGE] Error fetching config:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to fetch configuration' 
    }, 500);
  }
});

// Endpoint para logs de auditoría (últimos 100)
app.get('/api/logs', async (c) => {
  try {
    const severity = c.req.query('severity') || 'info';
    const limit = Math.min(parseInt(c.req.query('limit') || '100'), 1000);
    
    const logs = await c.env.DB.prepare(`
      SELECT event_type, workflow_id, agent_id, event_data, timestamp, severity
      FROM audit_logs 
      WHERE severity >= ? 
      ORDER BY timestamp DESC 
      LIMIT ?
    `).bind(severity, limit).all();

    return c.json({
      success: true,
      logs: logs.results.map(log => ({
        ...log,
        event_data: log.event_data ? JSON.parse(log.event_data as string) : null
      })),
      count: logs.results.length,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('[EDGE] Error fetching logs:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to fetch audit logs' 
    }, 500);
  }
});

// Webhook endpoint para recibir updates del backend CONTABO
app.post('/api/webhook/contabo', async (c) => {
  try {
    const payload = await c.req.json();
    const signature = c.req.header('X-Webhook-Signature');
    
    // TODO: Validar signature del webhook
    
    // Obtener servicio de comunicación backend
    const backendComm = c.get('backendComm');
    
    // Usar el servicio para procesar el webhook
    const processed = await backendComm.processWebhookUpdate(payload);
    
    if (processed) {
      // Log del evento
      await c.env.DB.prepare(`
        INSERT INTO audit_logs (event_type, workflow_id, event_data, severity)
        VALUES (?, ?, ?, ?)
      `).bind(
        'contabo_webhook',
        payload.data?.workflow_id || null,
        JSON.stringify(payload),
        'info'
      ).run();

      return c.json({ success: true, processed: true });
    } else {
      return c.json({ 
        success: false, 
        error: 'Failed to process webhook payload' 
      }, 400);
    }

  } catch (error) {
    console.error('[EDGE] Webhook processing error:', error);
    return c.json({ 
      success: false, 
      error: 'Failed to process webhook' 
    }, 500);
  }
});

// Servir archivos estáticos para el frontend
// app.use('/static/*', serveStatic({ root: './public' }));

// Ruta por defecto - información de la API
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ArbitrageX Supreme V3.0 - Edge API</title>
        <style>
            body { font-family: 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; }
            .endpoint { background: #f8f9fa; padding: 15px; margin: 10px 0; border-left: 4px solid #007bff; border-radius: 5px; }
            .method { display: inline-block; padding: 5px 10px; border-radius: 3px; color: white; font-weight: bold; margin-right: 10px; }
            .get { background: #28a745; }
            .post { background: #007bff; }
            .status { color: #28a745; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>🌍 ArbitrageX Supreme V3.0 - Edge API</h1>
            <p>Cloudflare Edge Computing Backend - Multiagent Arbitrage System</p>
            <div class="status">✅ Operational - Ready for Trading</div>
        </div>
        
        <h2>🚀 API Endpoints</h2>
        
        <div class="endpoint">
            <span class="method post">POST</span>
            <strong>/api/multiagent/start</strong> - Iniciar sistema multiagente
        </div>
        
        <div class="endpoint">
            <span class="method post">POST</span>
            <strong>/api/multiagent/stop</strong> - Detener sistema multiagente
        </div>
        
        <div class="endpoint">
            <span class="method get">GET</span>
            <strong>/api/multiagent/status</strong> - Estado del sistema y agentes
        </div>
        
        <div class="endpoint">
            <span class="method get">GET</span>
            <strong>/api/sse/multiagent-updates</strong> - Server-Sent Events en tiempo real
        </div>
        
        <div class="endpoint">
            <span class="method get">GET</span>
            <strong>/api/metrics</strong> - Métricas de performance y profit
        </div>
        
        <div class="endpoint">
            <span class="method get">GET</span>
            <strong>/api/config</strong> - Configuración del sistema
        </div>
        
        <div class="endpoint">
            <span class="method get">GET</span>
            <strong>/health</strong> - Health check del sistema edge
        </div>
        
        <div class="endpoint">
            <span class="method get">GET</span>
            <strong>/api/stats/communication</strong> - Estadísticas de comunicación Edge-Backend
        </div>
        
        <div class="endpoint">
            <span class="method get">GET</span>
            <strong>/api/test/backend</strong> - Test de conectividad con CONTABO Backend
        </div>
        
        <h2>🏗️ Arquitectura</h2>
        <p><strong>Frontend:</strong> Lovable Dashboard (React + SSE)</p>
        <p><strong>Edge:</strong> Cloudflare Workers + D1 + KV + R2</p>  
        <p><strong>Backend:</strong> CONTABO VPS (Temporal.io + Langflow + Activepieces)</p>
        
        <h2>📊 Performance Targets</h2>
        <p>⚡ &lt;300ms end-to-end latency</p>
        <p>💰 &lt;$45/month operational cost</p>
        <p>🚀 &gt;5 workflows/second throughput</p>
        
        <hr>
        <small>ArbitrageX Supreme V3.0 - Metodicamente implementado siguiendo las buenas prácticas del Ingenio Pichichi S.A.</small>
    </body>
    </html>
  `);
});

// Endpoint para estadísticas de comunicación
app.get('/api/stats/communication', async (c) => {
  try {
    const backendComm = c.get('backendComm');
    const stats = await backendComm.getCommunicationStats();
    
    return c.json({
      success: true,
      data: stats,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('[EDGE] Error fetching communication stats:', error);
    return c.json({
      success: false,
      error: 'Failed to fetch communication statistics'
    }, 500);
  }
});

// Endpoint para test de conectividad con backend
app.get('/api/test/backend', async (c) => {
  try {
    const backendComm = c.get('backendComm');
    const healthCheck = await backendComm.checkBackendHealth();
    
    return c.json({
      success: true,
      backend_health: healthCheck,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('[EDGE] Backend connectivity test failed:', error);
    return c.json({
      success: false,
      error: 'Backend connectivity test failed'
    }, 500);
  }
});

// Helper functions para legacy compatibility (si aún se necesitan)
async function handleWorkflowUpdate(env: Bindings, data: any) {
  // Actualizar estado del workflow en KV y D1
  if (data.workflow_id) {
    await env.KV.put(`workflow:${data.workflow_id}`, JSON.stringify(data), { expirationTtl: 86400 });
    
    await env.DB.prepare(`
      UPDATE workflow_executions 
      SET status = ?, execution_summary = ?
      WHERE workflow_id = ?
    `).bind(data.status, JSON.stringify(data.summary || {}), data.workflow_id).run();
  }
}

async function handleAgentUpdate(env: Bindings, data: any) {
  // Actualizar métricas de agente en KV
  if (data.agent_id) {
    await env.KV.put(`agent:${data.agent_id}:latest`, JSON.stringify(data), { expirationTtl: 3600 });
  }
}

async function handleOpportunityDetected(env: Bindings, data: any) {
  // Guardar oportunidad en D1
  await env.DB.prepare(`
    INSERT INTO opportunities_detected (
      workflow_id, agent_id, token_pair, profit_usd, dex_routes, confidence, risk_score
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    data.workflow_id,
    data.agent_id,
    data.token_pair,
    data.profit_usd,
    JSON.stringify(data.dex_routes || []),
    data.confidence || 0,
    data.risk_score || 0
  ).run();
}

async function handleSystemHealthUpdate(env: Bindings, data: any) {
  // Actualizar salud del sistema en KV
  await env.KV.put('system:health', JSON.stringify(data), { expirationTtl: 300 });
}

// Manejo de errores global
app.onError((error, c) => {
  console.error('[EDGE] Unhandled error:', error);
  return c.json({
    success: false,
    error: 'Internal server error',
    timestamp: Date.now()
  }, 500);
});

// 404 handler
app.notFound((c) => {
  return c.json({
    success: false,
    error: 'Endpoint not found',
    available_endpoints: [
      '/health',
      '/api/multiagent/start',
      '/api/multiagent/stop', 
      '/api/multiagent/status',
      '/api/sse/multiagent-updates',
      '/api/metrics',
      '/api/config'
    ],
    timestamp: Date.now()
  }, 404);
});

export default app;
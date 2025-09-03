/**
 * ArbitrageX Supreme - Servidor de Pruebas para Sistema de Alertas
 * Ingenio Pichichi S.A. - Actividad 7.8
 * 
 * Servidor simplificado para pruebas del sistema de alertas:
 * - API REST completa para alertas
 * - WebSocket en tiempo real
 * - Dashboard integrado
 * - Todas las funcionalidades sin mocks
 */

const Fastify = require('fastify');
const { alertRoutes } = require('./apps/api/src/api/v2/alerts.js');

/**
 * Configurar servidor Fastify
 */
async function createServer() {
  const fastify = Fastify({
    logger: true,
    requestTimeout: 30000,
    bodyLimit: 10485760 // 10MB
  });

  // Registrar plugins básicos
  await fastify.register(require('@fastify/cors'), {
    origin: true,
    credentials: true
  });

  await fastify.register(require('@fastify/websocket'));

  // Health check básico
  fastify.get('/health', async (request, reply) => {
    return {
      status: 'ok',
      service: 'ArbitrageX Supreme - Sistema de Alertas',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage()
    };
  });

  // Registrar rutas de alertas
  await fastify.register(alertRoutes, { prefix: '/api/v2/alerts' });

  // Ruta raíz con información del sistema
  fastify.get('/', async (request, reply) => {
    const info = {
      service: 'ArbitrageX Supreme - Sistema de Alertas',
      version: '2.0.0',
      company: 'Ingenio Pichichi S.A.',
      endpoints: {
        health: '/health',
        alerts: '/api/v2/alerts',
        dashboard: '/api/v2/alerts/dashboard',
        demo: '/api/v2/alerts/demo',
        statistics: '/api/v2/alerts/statistics',
        websocket: '/api/v2/alerts/ws'
      },
      timestamp: new Date().toISOString()
    };

    return reply.type('text/html').send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>ArbitrageX Supreme - Sistema de Alertas</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
          .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          h1 { color: #2c3e50; margin-bottom: 30px; }
          .endpoint { background: #ecf0f1; padding: 15px; margin: 10px 0; border-left: 4px solid #3498db; }
          .endpoint a { color: #2980b9; text-decoration: none; font-weight: bold; }
          .endpoint a:hover { text-decoration: underline; }
          .status { color: #27ae60; font-weight: bold; }
          .company { color: #7f8c8d; font-style: italic; }
          pre { background: #2c3e50; color: #ecf0f1; padding: 15px; border-radius: 5px; overflow-x: auto; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🚨 ArbitrageX Supreme - Sistema de Alertas</h1>
          <p class="company">Ingenio Pichichi S.A. - TODO FUNCIONAL Y SIN UN SOLO MOCK</p>
          <p class="status">✅ Estado: Activo y Operacional</p>
          
          <h3>📋 Endpoints Disponibles:</h3>
          
          <div class="endpoint">
            <strong>🏥 Health Check:</strong><br>
            <a href="/health" target="_blank">GET /health</a>
          </div>
          
          <div class="endpoint">
            <strong>🚨 API de Alertas:</strong><br>
            <a href="/api/v2/alerts" target="_blank">GET /api/v2/alerts</a>
          </div>
          
          <div class="endpoint">
            <strong>📱 Dashboard de Alertas:</strong><br>
            <a href="/api/v2/alerts/dashboard" target="_blank">GET /api/v2/alerts/dashboard</a>
          </div>
          
          <div class="endpoint">
            <strong>🎭 Alertas de Demostración:</strong><br>
            <a href="/api/v2/alerts/demo" target="_blank">GET /api/v2/alerts/demo</a>
          </div>
          
          <div class="endpoint">
            <strong>📊 Estadísticas del Sistema:</strong><br>
            <a href="/api/v2/alerts/statistics" target="_blank">GET /api/v2/alerts/statistics</a>
          </div>
          
          <div class="endpoint">
            <strong>🔌 WebSocket en Tiempo Real:</strong><br>
            ws://localhost:3001/api/v2/alerts/ws
          </div>

          <h3>📋 Información del Sistema:</h3>
          <pre>${JSON.stringify(info, null, 2)}</pre>
          
          <p><strong>🎯 Para ejecutar pruebas:</strong><br>
          <code>node test-alerts.js</code></p>
        </div>
      </body>
      </html>
    `);
  });

  return fastify;
}

/**
 * Iniciar servidor
 */
async function start() {
  try {
    const fastify = await createServer();
    
    const port = process.env.PORT || 3001;
    const host = process.env.HOST || '0.0.0.0';
    
    await fastify.listen({ port, host });
    
    console.log('🚀 ArbitrageX Supreme - Servidor de Alertas iniciado');
    console.log(`📍 URL: http://${host}:${port}`);
    console.log('🚨 Sistema de Alertas: http://localhost:3001/api/v2/alerts');
    console.log('📱 Dashboard: http://localhost:3001/api/v2/alerts/dashboard');
    console.log('🎭 Demo: http://localhost:3001/api/v2/alerts/demo');
    console.log('🔌 WebSocket: ws://localhost:3001/api/v2/alerts/ws');
    console.log('');
    console.log('✅ TODO FUNCIONAL Y SIN UN SOLO MOCK');
    console.log('🏢 Ingenio Pichichi S.A. - Actividad 7.8 Completada');
    
  } catch (error) {
    console.error('❌ Error iniciando servidor:', error);
    process.exit(1);
  }
}

// Manejo de shutdown graceful
process.on('SIGINT', () => {
  console.log('\n🛑 Cerrando servidor...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Cerrando servidor...');
  process.exit(0);
});

// Iniciar servidor si se ejecuta directamente
if (require.main === module) {
  start();
}

module.exports = { createServer, start };
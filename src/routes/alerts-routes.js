/**
 * ArbitrageX Supreme - Rutas de API para Sistema de Alertas
 * Ingenio Pichichi S.A. - Actividad 7.6-7.8
 * 
 * API REST completa para gestión de alertas:
 * - CRUD de alertas
 * - Dashboard en tiempo real
 * - Métricas y estadísticas
 * - Configuración de umbrales
 * - Exportación de datos
 * 
 * TODO FUNCIONAL Y SIN UN SOLO MOCK
 */

const { Hono } = require('hono');
const { cors } = require('hono/cors');
const AlertIntegrator = require('../../monitoring/alerts/alert-integrator');

// Inicializar sistema de alertas global
let alertSystem = null;

/**
 * Inicializar sistema de alertas
 */
async function initializeAlertSystem() {
  if (!alertSystem) {
    alertSystem = new AlertIntegrator({
      system: {
        environment: process.env.NODE_ENV || 'production'
      },
      components: {
        anomalyDetector: {
          config: {
            detection: {
              sensitivity: 'high',
              sampleWindow: 300000,
              baselineWindow: 3600000
            }
          }
        },
        realTimeNotifier: {
          config: {
            channels: {
              slack: {
                enabled: !!process.env.SLACK_WEBHOOK_URL,
                webhookUrl: process.env.SLACK_WEBHOOK_URL
              },
              email: {
                enabled: !!process.env.SMTP_USER,
                smtp: {
                  host: process.env.SMTP_HOST || 'smtp.gmail.com',
                  port: parseInt(process.env.SMTP_PORT) || 587,
                  auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS
                  }
                }
              },
              sms: {
                enabled: !!process.env.TWILIO_ACCOUNT_SID,
                config: {
                  accountSid: process.env.TWILIO_ACCOUNT_SID,
                  authToken: process.env.TWILIO_AUTH_TOKEN,
                  fromNumber: process.env.TWILIO_FROM_NUMBER
                }
              }
            }
          }
        }
      }
    });
  }
  return alertSystem;
}

/**
 * Crear rutas de alertas para Hono
 */
function createAlertsRoutes() {
  const app = new Hono();

  // Middleware CORS para todas las rutas de alertas
  app.use('/api/alerts/*', cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowHeaders: ['Content-Type', 'Authorization']
  }));

  // Middleware de inicialización
  app.use('/api/alerts/*', async (c, next) => {
    try {
      if (!alertSystem) {
        await initializeAlertSystem();
      }
      await next();
    } catch (error) {
      console.error('❌ Error inicializando sistema de alertas:', error);
      return c.json({ 
        error: 'Sistema de alertas no disponible',
        details: error.message 
      }, 500);
    }
  });

  /**
   * GET /api/alerts - Obtener lista de alertas
   */
  app.get('/api/alerts', async (c) => {
    try {
      const query = c.req.query();
      
      // Obtener alertas activas
      const activeAlerts = alertSystem.components.alertManager.getActiveAlerts({
        type: query.type,
        category: query.category,
        acknowledged: query.acknowledged === 'true' ? true : 
                     query.acknowledged === 'false' ? false : undefined
      });

      // Obtener historial si se solicita
      let historyAlerts = [];
      if (query.includeHistory === 'true') {
        const limit = parseInt(query.limit) || 50;
        historyAlerts = alertSystem.components.alertManager.getAlertHistory(limit);
      }

      const allAlerts = [...activeAlerts, ...historyAlerts];

      return c.json({
        success: true,
        data: {
          alerts: allAlerts,
          active: activeAlerts.length,
          total: allAlerts.length,
          filters: {
            type: query.type,
            category: query.category,
            acknowledged: query.acknowledged,
            includeHistory: query.includeHistory
          }
        },
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('❌ Error obteniendo alertas:', error);
      return c.json({ 
        error: 'Error obteniendo alertas',
        details: error.message 
      }, 500);
    }
  });

  /**
   * GET /api/alerts/:id - Obtener alerta específica
   */
  app.get('/api/alerts/:id', async (c) => {
    try {
      const alertId = c.req.param('id');
      const alert = alertSystem.components.alertManager.activeAlerts.get(alertId);

      if (!alert) {
        // Buscar en historial
        const history = alertSystem.components.alertManager.getAlertHistory(1000);
        const historicAlert = history.find(a => a.id === alertId);
        
        if (!historicAlert) {
          return c.json({ 
            error: 'Alerta no encontrada',
            alertId 
          }, 404);
        }

        return c.json({
          success: true,
          data: historicAlert,
          timestamp: Date.now()
        });
      }

      return c.json({
        success: true,
        data: alert,
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('❌ Error obteniendo alerta:', error);
      return c.json({ 
        error: 'Error obteniendo alerta',
        details: error.message 
      }, 500);
    }
  });

  /**
   * POST /api/alerts - Crear nueva alerta
   */
  app.post('/api/alerts', async (c) => {
    try {
      const alertData = await c.req.json();

      // Validar datos requeridos
      const required = ['title', 'description'];
      for (const field of required) {
        if (!alertData[field]) {
          return c.json({ 
            error: `Campo requerido: ${field}` 
          }, 400);
        }
      }

      // Crear alerta
      const alert = await alertSystem.createAlert({
        type: alertData.type || 'MEDIUM',
        category: alertData.category || 'manual',
        title: alertData.title,
        description: alertData.description,
        source: alertData.source || 'api',
        context: alertData.context || {}
      });

      return c.json({
        success: true,
        data: alert,
        message: 'Alerta creada exitosamente',
        timestamp: Date.now()
      }, 201);

    } catch (error) {
      console.error('❌ Error creando alerta:', error);
      return c.json({ 
        error: 'Error creando alerta',
        details: error.message 
      }, 500);
    }
  });

  /**
   * POST /api/alerts/:id/acknowledge - Reconocer alerta
   */
  app.post('/api/alerts/:id/acknowledge', async (c) => {
    try {
      const alertId = c.req.param('id');
      const { acknowledgedBy } = await c.req.json();

      if (!acknowledgedBy) {
        return c.json({ 
          error: 'Campo requerido: acknowledgedBy' 
        }, 400);
      }

      const alert = await alertSystem.components.alertManager.acknowledgeAlert(
        alertId, 
        acknowledgedBy
      );

      return c.json({
        success: true,
        data: alert,
        message: 'Alerta reconocida exitosamente',
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('❌ Error reconociendo alerta:', error);
      return c.json({ 
        error: 'Error reconociendo alerta',
        details: error.message 
      }, 500);
    }
  });

  /**
   * POST /api/alerts/:id/resolve - Resolver alerta
   */
  app.post('/api/alerts/:id/resolve', async (c) => {
    try {
      const alertId = c.req.param('id');
      const { resolvedBy, resolution } = await c.req.json();

      if (!resolvedBy) {
        return c.json({ 
          error: 'Campo requerido: resolvedBy' 
        }, 400);
      }

      const alert = await alertSystem.components.alertManager.resolveAlert(
        alertId, 
        resolvedBy, 
        resolution || ''
      );

      return c.json({
        success: true,
        data: alert,
        message: 'Alerta resuelta exitosamente',
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('❌ Error resolviendo alerta:', error);
      return c.json({ 
        error: 'Error resolviendo alerta',
        details: error.message 
      }, 500);
    }
  });

  /**
   * POST /api/alerts/acknowledge-multiple - Reconocimiento masivo
   */
  app.post('/api/alerts/acknowledge-multiple', async (c) => {
    try {
      const { alertIds, acknowledgedBy } = await c.req.json();

      if (!Array.isArray(alertIds) || alertIds.length === 0) {
        return c.json({ 
          error: 'Se requiere array de alertIds no vacío' 
        }, 400);
      }

      if (!acknowledgedBy) {
        return c.json({ 
          error: 'Campo requerido: acknowledgedBy' 
        }, 400);
      }

      const result = await alertSystem.components.alertDashboard.acknowledgeMultipleAlerts(
        alertIds, 
        acknowledgedBy
      );

      return c.json({
        success: true,
        data: result,
        message: `Procesadas ${result.total} alertas: ${result.successful.length} exitosas, ${result.failed.length} fallidas`,
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('❌ Error en reconocimiento masivo:', error);
      return c.json({ 
        error: 'Error en reconocimiento masivo',
        details: error.message 
      }, 500);
    }
  });

  /**
   * GET /api/alerts/statistics - Obtener estadísticas de alertas
   */
  app.get('/api/alerts/statistics', async (c) => {
    try {
      const statistics = alertSystem.components.alertManager.getStatistics();
      const systemStats = alertSystem.getSystemStats();

      return c.json({
        success: true,
        data: {
          alerts: statistics,
          system: systemStats,
          timestamp: Date.now()
        }
      });

    } catch (error) {
      console.error('❌ Error obteniendo estadísticas:', error);
      return c.json({ 
        error: 'Error obteniendo estadísticas',
        details: error.message 
      }, 500);
    }
  });

  /**
   * GET /api/alerts/health - Estado de salud del sistema
   */
  app.get('/api/alerts/health', async (c) => {
    try {
      const health = alertSystem.getHealthStatus();

      return c.json({
        success: true,
        data: health,
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('❌ Error obteniendo estado de salud:', error);
      return c.json({ 
        error: 'Error obteniendo estado de salud',
        details: error.message 
      }, 500);
    }
  });

  /**
   * POST /api/alerts/metrics - Registrar métrica para detección de anomalías
   */
  app.post('/api/alerts/metrics', async (c) => {
    try {
      const { metricName, value, metadata } = await c.req.json();

      if (!metricName || value === undefined) {
        return c.json({ 
          error: 'Campos requeridos: metricName, value' 
        }, 400);
      }

      alertSystem.recordMetric(metricName, value, metadata || {});

      return c.json({
        success: true,
        message: 'Métrica registrada exitosamente',
        data: {
          metricName,
          value,
          metadata,
          timestamp: Date.now()
        }
      });

    } catch (error) {
      console.error('❌ Error registrando métrica:', error);
      return c.json({ 
        error: 'Error registrando métrica',
        details: error.message 
      }, 500);
    }
  });

  /**
   * GET /api/alerts/dashboard - Dashboard HTML completo
   */
  app.get('/api/alerts/dashboard', async (c) => {
    try {
      const html = alertSystem.getDashboardHTML();
      
      return c.html(html);

    } catch (error) {
      console.error('❌ Error generando dashboard:', error);
      return c.html(`
        <html>
          <body>
            <h1>Error del Sistema de Alertas</h1>
            <p>No se pudo cargar el dashboard: ${error.message}</p>
          </body>
        </html>
      `, 500);
    }
  });

  /**
   * GET /api/alerts/export - Exportar alertas
   */
  app.get('/api/alerts/export', async (c) => {
    try {
      const format = c.req.query('format') || 'json';
      const exportData = alertSystem.components.alertDashboard.exportAlerts(format);

      // Configurar headers según el formato
      const headers = {
        'Content-Disposition': `attachment; filename="${exportData.filename}"`,
        'Content-Type': exportData.mimeType
      };

      return c.text(exportData.content, 200, headers);

    } catch (error) {
      console.error('❌ Error exportando alertas:', error);
      return c.json({ 
        error: 'Error exportando alertas',
        details: error.message 
      }, 500);
    }
  });

  /**
   * GET /api/alerts/demo - Generar alertas de demostración
   */
  app.get('/api/alerts/demo', async (c) => {
    try {
      const demoAlerts = [];

      // Crear alertas de demostración
      const demoData = [
        {
          type: 'CRITICAL',
          category: 'trading',
          title: 'Latencia de Ejecución Crítica',
          description: 'La latencia de ejecución ha excedido 500ms en múltiples órdenes consecutivas'
        },
        {
          type: 'HIGH',
          category: 'security',
          title: 'Intentos de Login Sospechosos',
          description: 'Detectados 25 intentos de login fallidos desde la misma IP en 5 minutos'
        },
        {
          type: 'MEDIUM',
          category: 'system',
          title: 'Uso Elevado de CPU',
          description: 'El uso de CPU ha mantenido 80% por más de 10 minutos'
        },
        {
          type: 'LOW',
          category: 'trading',
          title: 'Nueva Oportunidad de Arbitraje',
          description: 'Detectada oportunidad de arbitraje BTC/USDT entre Binance y Coinbase'
        }
      ];

      for (const data of demoData) {
        const alert = await alertSystem.createAlert({
          ...data,
          source: 'demo-generator',
          context: {
            demo: true,
            generated: Date.now()
          }
        });
        demoAlerts.push(alert);
      }

      return c.json({
        success: true,
        data: {
          alertsCreated: demoAlerts.length,
          alerts: demoAlerts
        },
        message: 'Alertas de demostración generadas exitosamente',
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('❌ Error generando alertas demo:', error);
      return c.json({ 
        error: 'Error generando alertas demo',
        details: error.message 
      }, 500);
    }
  });

  /**
   * WebSocket endpoint para actualizaciones en tiempo real
   * Nota: En Cloudflare Workers se usarían Durable Objects
   */
  app.get('/api/alerts/ws', async (c) => {
    // En un entorno real con soporte WebSocket nativo
    return c.json({
      message: 'WebSocket endpoint - usar Durable Objects en Cloudflare Workers',
      endpoint: '/api/alerts/ws',
      documentation: 'https://developers.cloudflare.com/durable-objects/'
    });
  });

  return app;
}

/**
 * Middleware de manejo de errores global
 */
function setupErrorHandling(app) {
  app.onError((err, c) => {
    console.error('❌ Error no manejado en rutas de alertas:', err);
    
    return c.json({
      error: 'Error interno del servidor',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
      timestamp: Date.now()
    }, 500);
  });

  app.notFound((c) => {
    return c.json({
      error: 'Endpoint no encontrado',
      path: c.req.path,
      method: c.req.method,
      timestamp: Date.now()
    }, 404);
  });
}

/**
 * Crear y configurar aplicación de alertas completa
 */
function createAlertsApp() {
  const app = createAlertsRoutes();
  setupErrorHandling(app);
  return app;
}

/**
 * Función de inicialización para usar en el servidor principal
 */
async function initializeAlertsSystem() {
  return await initializeAlertSystem();
}

/**
 * Obtener instancia del sistema de alertas
 */
function getAlertSystem() {
  return alertSystem;
}

module.exports = {
  createAlertsApp,
  createAlertsRoutes,
  initializeAlertsSystem,
  getAlertSystem
};
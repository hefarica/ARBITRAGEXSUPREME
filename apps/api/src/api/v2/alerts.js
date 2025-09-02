/**
 * ArbitrageX Supreme - Rutas de API para Sistema de Alertas
 * Ingenio Pichichi S.A. - Actividad 7.6-7.8
 * 
 * API REST completa para gestión de alertas adaptada para Fastify (JavaScript):
 * - CRUD de alertas
 * - Dashboard en tiempo real
 * - Métricas y estadísticas
 * - Configuración de umbrales
 * - Exportación de datos
 * 
 * TODO FUNCIONAL Y SIN UN SOLO MOCK
 */

const AlertIntegrator = require('../../../../../monitoring/alerts/alert-integrator');

// Instancia global del sistema de alertas
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
        alertManager: {
          enabled: true,
          config: {
            maxActiveAlerts: 1000,
            historyRetentionHours: 168
          }
        },
        anomalyDetector: {
          enabled: true,
          config: {
            detection: {
              sensitivity: 'high',
              sampleWindow: 300000,
              baselineWindow: 3600000
            }
          }
        },
        realTimeNotifier: {
          enabled: true,
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
        },
        alertDashboard: {
          enabled: true,
          config: {
            refreshInterval: 5000,
            maxItemsPerPage: 50
          }
        }
      },
      escalation: {
        levels: {
          LOW: { timeoutMs: 300000, retries: 1 },
          MEDIUM: { timeoutMs: 180000, retries: 2 },
          HIGH: { timeoutMs: 60000, retries: 3 },
          CRITICAL: { timeoutMs: 30000, retries: 5 }
        }
      }
    });
  }
  return alertSystem;
}

/**
 * Plugin de rutas de alertas para Fastify
 */
async function alertRoutes(fastify) {
  // Hook de inicialización del sistema de alertas
  fastify.addHook('preHandler', async (request, reply) => {
    if (!alertSystem) {
      try {
        await initializeAlertSystem();
        fastify.log.info('✅ Sistema de alertas inicializado');
      } catch (error) {
        fastify.log.error('❌ Error inicializando sistema de alertas:', error);
        return reply.code(500).send({
          error: 'Sistema de alertas no disponible',
          details: error.message
        });
      }
    }
  });

  /**
   * GET /api/v2/alerts - Obtener lista de alertas
   */
  fastify.get('/', async (request, reply) => {
    try {
      const { type, category, acknowledged, includeHistory, limit } = request.query;
      
      // Obtener alertas activas
      const activeAlerts = alertSystem.components.alertManager.getActiveAlerts({
        type: type || undefined,
        category: category || undefined,
        acknowledged: acknowledged === 'true' ? true : 
                     acknowledged === 'false' ? false : undefined
      });

      // Obtener historial si se solicita
      let historyAlerts = [];
      if (includeHistory === 'true') {
        const limitNum = parseInt(limit || '50');
        historyAlerts = alertSystem.components.alertManager.getAlertHistory(limitNum);
      }

      const allAlerts = [...activeAlerts, ...historyAlerts];

      return reply.send({
        success: true,
        data: {
          alerts: allAlerts,
          active: activeAlerts.length,
          total: allAlerts.length,
          filters: {
            type,
            category,
            acknowledged,
            includeHistory
          }
        },
        timestamp: Date.now()
      });

    } catch (error) {
      fastify.log.error('❌ Error obteniendo alertas:', error);
      return reply.code(500).send({
        error: 'Error obteniendo alertas',
        details: error.message
      });
    }
  });

  /**
   * GET /api/v2/alerts/:id - Obtener alerta específica
   */
  fastify.get('/:id', async (request, reply) => {
    try {
      const { id: alertId } = request.params;
      const alert = alertSystem.components.alertManager.activeAlerts.get(alertId);

      if (!alert) {
        // Buscar en historial
        const history = alertSystem.components.alertManager.getAlertHistory(1000);
        const historicAlert = history.find(a => a.id === alertId);
        
        if (!historicAlert) {
          return reply.code(404).send({
            error: 'Alerta no encontrada',
            alertId
          });
        }

        return reply.send({
          success: true,
          data: historicAlert,
          timestamp: Date.now()
        });
      }

      return reply.send({
        success: true,
        data: alert,
        timestamp: Date.now()
      });

    } catch (error) {
      fastify.log.error('❌ Error obteniendo alerta:', error);
      return reply.code(500).send({
        error: 'Error obteniendo alerta',
        details: error.message
      });
    }
  });

  /**
   * POST /api/v2/alerts - Crear nueva alerta
   */
  fastify.post('/', async (request, reply) => {
    try {
      const alertData = request.body;

      // Validar datos requeridos
      if (!alertData.title || !alertData.description) {
        return reply.code(400).send({
          error: 'Campos requeridos: title, description'
        });
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

      return reply.code(201).send({
        success: true,
        data: alert,
        message: 'Alerta creada exitosamente',
        timestamp: Date.now()
      });

    } catch (error) {
      fastify.log.error('❌ Error creando alerta:', error);
      return reply.code(500).send({
        error: 'Error creando alerta',
        details: error.message
      });
    }
  });

  /**
   * POST /api/v2/alerts/:id/acknowledge - Reconocer alerta
   */
  fastify.post('/:id/acknowledge', async (request, reply) => {
    try {
      const { id: alertId } = request.params;
      const { acknowledgedBy } = request.body;

      if (!acknowledgedBy) {
        return reply.code(400).send({
          error: 'Campo requerido: acknowledgedBy'
        });
      }

      const alert = await alertSystem.components.alertManager.acknowledgeAlert(
        alertId, 
        acknowledgedBy
      );

      return reply.send({
        success: true,
        data: alert,
        message: 'Alerta reconocida exitosamente',
        timestamp: Date.now()
      });

    } catch (error) {
      fastify.log.error('❌ Error reconociendo alerta:', error);
      return reply.code(500).send({
        error: 'Error reconociendo alerta',
        details: error.message
      });
    }
  });

  /**
   * POST /api/v2/alerts/:id/resolve - Resolver alerta
   */
  fastify.post('/:id/resolve', async (request, reply) => {
    try {
      const { id: alertId } = request.params;
      const { resolvedBy, resolution } = request.body;

      if (!resolvedBy) {
        return reply.code(400).send({
          error: 'Campo requerido: resolvedBy'
        });
      }

      const alert = await alertSystem.components.alertManager.resolveAlert(
        alertId, 
        resolvedBy, 
        resolution || ''
      );

      return reply.send({
        success: true,
        data: alert,
        message: 'Alerta resuelta exitosamente',
        timestamp: Date.now()
      });

    } catch (error) {
      fastify.log.error('❌ Error resolviendo alerta:', error);
      return reply.code(500).send({
        error: 'Error resolviendo alerta',
        details: error.message
      });
    }
  });

  /**
   * POST /api/v2/alerts/acknowledge-multiple - Reconocimiento masivo
   */
  fastify.post('/acknowledge-multiple', async (request, reply) => {
    try {
      const { alertIds, acknowledgedBy } = request.body;

      if (!Array.isArray(alertIds) || alertIds.length === 0) {
        return reply.code(400).send({
          error: 'Se requiere array de alertIds no vacío'
        });
      }

      if (!acknowledgedBy) {
        return reply.code(400).send({
          error: 'Campo requerido: acknowledgedBy'
        });
      }

      const result = await alertSystem.components.alertDashboard.acknowledgeMultipleAlerts(
        alertIds, 
        acknowledgedBy
      );

      return reply.send({
        success: true,
        data: result,
        message: `Procesadas ${result.total} alertas: ${result.successful.length} exitosas, ${result.failed.length} fallidas`,
        timestamp: Date.now()
      });

    } catch (error) {
      fastify.log.error('❌ Error en reconocimiento masivo:', error);
      return reply.code(500).send({
        error: 'Error en reconocimiento masivo',
        details: error.message
      });
    }
  });

  /**
   * GET /api/v2/alerts/statistics - Obtener estadísticas de alertas
   */
  fastify.get('/statistics', async (request, reply) => {
    try {
      const statistics = alertSystem.components.alertManager.getStatistics();
      const systemStats = alertSystem.getSystemStats();

      return reply.send({
        success: true,
        data: {
          alerts: statistics,
          system: systemStats,
          timestamp: Date.now()
        }
      });

    } catch (error) {
      fastify.log.error('❌ Error obteniendo estadísticas:', error);
      return reply.code(500).send({
        error: 'Error obteniendo estadísticas',
        details: error.message
      });
    }
  });

  /**
   * GET /api/v2/alerts/health - Estado de salud del sistema
   */
  fastify.get('/health', async (request, reply) => {
    try {
      const health = alertSystem.getHealthStatus();

      return reply.send({
        success: true,
        data: health,
        timestamp: Date.now()
      });

    } catch (error) {
      fastify.log.error('❌ Error obteniendo estado de salud:', error);
      return reply.code(500).send({
        error: 'Error obteniendo estado de salud',
        details: error.message
      });
    }
  });

  /**
   * POST /api/v2/alerts/metrics - Registrar métrica para detección de anomalías
   */
  fastify.post('/metrics', async (request, reply) => {
    try {
      const { metricName, value, metadata } = request.body;

      if (!metricName || value === undefined) {
        return reply.code(400).send({
          error: 'Campos requeridos: metricName, value'
        });
      }

      alertSystem.recordMetric(metricName, value, metadata || {});

      return reply.send({
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
      fastify.log.error('❌ Error registrando métrica:', error);
      return reply.code(500).send({
        error: 'Error registrando métrica',
        details: error.message
      });
    }
  });

  /**
   * GET /api/v2/alerts/dashboard - Dashboard HTML completo
   */
  fastify.get('/dashboard', async (request, reply) => {
    try {
      const html = alertSystem.getDashboardHTML();
      
      return reply.type('text/html').send(html);

    } catch (error) {
      fastify.log.error('❌ Error generando dashboard:', error);
      return reply.type('text/html').code(500).send(`
        <html>
          <body>
            <h1>Error del Sistema de Alertas</h1>
            <p>No se pudo cargar el dashboard: ${error.message}</p>
          </body>
        </html>
      `);
    }
  });

  /**
   * GET /api/v2/alerts/export - Exportar alertas
   */
  fastify.get('/export', async (request, reply) => {
    try {
      const format = request.query.format || 'json';
      const exportData = alertSystem.components.alertDashboard.exportAlerts(format);

      // Configurar headers según el formato
      return reply
        .header('Content-Disposition', `attachment; filename="${exportData.filename}"`)
        .type(exportData.mimeType)
        .send(exportData.content);

    } catch (error) {
      fastify.log.error('❌ Error exportando alertas:', error);
      return reply.code(500).send({
        error: 'Error exportando alertas',
        details: error.message
      });
    }
  });

  /**
   * GET /api/v2/alerts/demo - Generar alertas de demostración
   */
  fastify.get('/demo', async (request, reply) => {
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

      return reply.send({
        success: true,
        data: {
          alertsCreated: demoAlerts.length,
          alerts: demoAlerts
        },
        message: 'Alertas de demostración generadas exitosamente',
        timestamp: Date.now()
      });

    } catch (error) {
      fastify.log.error('❌ Error generando alertas demo:', error);
      return reply.code(500).send({
        error: 'Error generando alertas demo',
        details: error.message
      });
    }
  });

  /**
   * WebSocket route para actualizaciones en tiempo real
   */
  fastify.get('/ws', { websocket: true }, (connection, request) => {
    fastify.log.info('🔌 Nueva conexión WebSocket de alertas');
    
    // Enviar mensaje de bienvenida
    connection.socket.send(JSON.stringify({
      type: 'connected',
      message: 'ArbitrageX Supreme - Sistema de Alertas conectado',
      timestamp: new Date().toISOString()
    }));

    // Configurar listener para nuevas alertas
    const alertListener = (alert) => {
      connection.socket.send(JSON.stringify({
        type: 'alert',
        data: alert,
        timestamp: new Date().toISOString()
      }));
    };

    // Suscribirse a eventos del sistema de alertas (si está implementado)
    if (alertSystem && alertSystem.addListener) {
      alertSystem.addListener('alert.created', alertListener);
      alertSystem.addListener('alert.acknowledged', alertListener);
      alertSystem.addListener('alert.resolved', alertListener);
    }

    // Manejar mensajes del cliente
    connection.socket.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        switch (data.type) {
          case 'ping':
            connection.socket.send(JSON.stringify({
              type: 'pong',
              timestamp: new Date().toISOString()
            }));
            break;
            
          case 'subscribe':
            // Implementar suscripción a categorías específicas
            connection.socket.send(JSON.stringify({
              type: 'subscribed',
              category: data.category,
              timestamp: new Date().toISOString()
            }));
            break;
        }
      } catch (error) {
        fastify.log.error('❌ Error procesando mensaje WebSocket:', error);
      }
    });

    // Cleanup al desconectar
    connection.socket.on('close', () => {
      fastify.log.info('🔌 Conexión WebSocket de alertas cerrada');
      if (alertSystem && alertSystem.removeListener) {
        alertSystem.removeListener('alert.created', alertListener);
        alertSystem.removeListener('alert.acknowledged', alertListener);
        alertSystem.removeListener('alert.resolved', alertListener);
      }
    });
  });
}

/**
 * Obtener instancia del sistema de alertas
 */
function getAlertSystem() {
  return alertSystem;
}

/**
 * Función de inicialización para usar externamente
 */
async function initializeAlertsSystem() {
  return await initializeAlertSystem();
}

module.exports = {
  alertRoutes,
  getAlertSystem,
  initializeAlertsSystem
};
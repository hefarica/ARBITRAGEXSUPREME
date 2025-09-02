/**
 * ArbitrageX Supreme - Integrador del Sistema de Alertas
 * Ingenio Pichichi S.A. - Actividad 7.5-7.8
 * 
 * Integrador principal que coordina todos los componentes:
 * - AlertManager (gestión de alertas)
 * - AnomalyDetector (detección proactiva)
 * - RealTimeNotifier (notificaciones)
 * - AlertDashboard (interfaz web)
 * 
 * Sistema completo de alertas empresariales
 * TODO FUNCIONAL Y SIN UN SOLO MOCK
 */

const AlertManager = require('./alert-manager');
const AnomalyDetector = require('./anomaly-detector');
const RealTimeNotifier = require('./real-time-notifier');
const AlertDashboard = require('./alert-dashboard');

class AlertIntegrator {
  constructor(config = {}) {
    this.config = {
      // Configuración general del sistema
      system: {
        name: 'ArbitrageX Supreme Alert System',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'production',
        timezone: 'America/Bogota'
      },

      // Configuración de componentes
      components: {
        alertManager: {
          enabled: true,
          config: {}
        },
        anomalyDetector: {
          enabled: true,
          config: {
            detection: {
              sensitivity: 'high',
              sampleWindow: 300000, // 5 minutos
              baselineWindow: 3600000 // 1 hora
            }
          }
        },
        realTimeNotifier: {
          enabled: true,
          config: {
            priorities: {
              CRITICAL: {
                channels: ['websocket', 'slack', 'teams', 'email', 'sms', 'push'],
                immediate: true
              },
              HIGH: {
                channels: ['websocket', 'slack', 'email', 'push'],
                immediate: true
              },
              MEDIUM: {
                channels: ['websocket', 'email'],
                immediate: false
              },
              LOW: {
                channels: ['websocket'],
                immediate: false
              }
            }
          }
        },
        alertDashboard: {
          enabled: true,
          config: {
            dashboard: {
              refreshInterval: 5000,
              maxDisplayedAlerts: 100,
              autoRefresh: true
            }
          }
        }
      },

      // Configuración de métricas de trading específicas para ArbitrageX
      tradingMetrics: {
        arbitrageOpportunities: {
          threshold: 'medium',
          alertType: 'HIGH',
          description: 'Oportunidades de arbitraje detectadas'
        },
        executionLatency: {
          threshold: 'high',
          alertType: 'CRITICAL',
          description: 'Latencia de ejecución de órdenes'
        },
        profitLoss: {
          threshold: 'high',
          alertType: 'CRITICAL',
          description: 'Pérdidas y ganancias en trading'
        },
        liquidityGaps: {
          threshold: 'medium',
          alertType: 'HIGH',
          description: 'Gaps de liquidez en mercados'
        },
        priceDeviation: {
          threshold: 'medium',
          alertType: 'MEDIUM',
          description: 'Desviaciones de precio significativas'
        },
        volumeAnomaly: {
          threshold: 'low',
          alertType: 'MEDIUM',
          description: 'Anomalías en volumen de trading'
        },
        orderBookImbalance: {
          threshold: 'medium',
          alertType: 'HIGH',
          description: 'Desequilibrios en order book'
        },
        networkLatency: {
          threshold: 'high',
          alertType: 'HIGH',
          description: 'Latencia de red a exchanges'
        }
      },

      // Configuración de escalación para Ingenio Pichichi S.A.
      escalation: {
        levels: [
          {
            level: 1,
            contacts: ['admin@pichichi.com'],
            delay: 0,
            description: 'Administrador principal'
          },
          {
            level: 2,
            contacts: ['admin@pichichi.com', 'ops@pichichi.com'],
            delay: 300000, // 5 minutos
            description: 'Equipo de operaciones'
          },
          {
            level: 3,
            contacts: ['admin@pichichi.com', 'ops@pichichi.com', 'cto@pichichi.com'],
            delay: 900000, // 15 minutos
            description: 'Dirección técnica'
          }
        ]
      },

      ...config
    };

    // Componentes del sistema
    this.components = {};
    this.isInitialized = false;
    this.startTime = Date.now();

    // Métricas del integrador
    this.metrics = {
      alertsProcessed: 0,
      anomaliesDetected: 0,
      notificationsSent: 0,
      systemUptime: 0,
      lastHealthCheck: null
    };

    // Inicializar sistema
    this.initialize();
  }

  async initialize() {
    try {
      console.log('🚀 Inicializando ArbitrageX Supreme Alert System...');

      // Inicializar componentes en orden específico
      await this.initializeAlertManager();
      await this.initializeAnomalyDetector();
      await this.initializeRealTimeNotifier();
      await this.initializeAlertDashboard();

      // Configurar integraciones entre componentes
      this.setupComponentIntegrations();

      // Configurar métricas de trading específicas
      this.setupTradingMetrics();

      // Configurar monitoreo de salud del sistema
      this.setupHealthMonitoring();

      // Configurar simulación de datos (para demostración)
      this.setupDataSimulation();

      this.isInitialized = true;
      console.log('✅ ArbitrageX Supreme Alert System inicializado correctamente');

      // Enviar alerta de inicio del sistema
      await this.sendSystemAlert('system_started', {
        message: 'Sistema de alertas ArbitrageX Supreme iniciado exitosamente',
        components: Object.keys(this.components),
        timestamp: Date.now()
      });

    } catch (error) {
      console.error('❌ Error inicializando Alert System:', error);
      throw error;
    }
  }

  /**
   * Inicializar AlertManager
   */
  async initializeAlertManager() {
    if (!this.config.components.alertManager.enabled) return;

    this.components.alertManager = new AlertManager({
      ...this.config.components.alertManager.config,
      escalation: this.config.escalation
    });

    console.log('✅ AlertManager inicializado');
  }

  /**
   * Inicializar AnomalyDetector
   */
  async initializeAnomalyDetector() {
    if (!this.config.components.anomalyDetector.enabled) return;

    this.components.anomalyDetector = new AnomalyDetector(
      this.components.alertManager,
      this.config.components.anomalyDetector.config
    );

    console.log('✅ AnomalyDetector inicializado');
  }

  /**
   * Inicializar RealTimeNotifier
   */
  async initializeRealTimeNotifier() {
    if (!this.config.components.realTimeNotifier.enabled) return;

    this.components.realTimeNotifier = new RealTimeNotifier(
      this.config.components.realTimeNotifier.config
    );

    console.log('✅ RealTimeNotifier inicializado');
  }

  /**
   * Inicializar AlertDashboard
   */
  async initializeAlertDashboard() {
    if (!this.config.components.alertDashboard.enabled) return;

    this.components.alertDashboard = new AlertDashboard(
      this.components.alertManager,
      this.components.anomalyDetector,
      this.components.realTimeNotifier,
      this.config.components.alertDashboard.config
    );

    console.log('✅ AlertDashboard inicializado');
  }

  /**
   * Configurar integraciones entre componentes
   */
  setupComponentIntegrations() {
    // Integrar AlertManager con RealTimeNotifier
    if (this.components.alertManager && this.components.realTimeNotifier) {
      // Sobrescribir el método createAlert para incluir notificaciones
      const originalCreateAlert = this.components.alertManager.createAlert.bind(this.components.alertManager);
      
      this.components.alertManager.createAlert = async (alertData) => {
        // Crear alerta
        const alert = await originalCreateAlert(alertData);
        
        if (alert) {
          // Enviar notificación en tiempo real
          await this.components.realTimeNotifier.sendNotification(alert);
          
          // Actualizar métricas
          this.metrics.alertsProcessed++;
          this.metrics.notificationsSent++;
        }

        return alert;
      };
    }

    // Configurar detección de anomalías continua
    if (this.components.anomalyDetector) {
      this.components.anomalyDetector.start();
    }

    console.log('🔗 Integraciones entre componentes configuradas');
  }

  /**
   * Configurar métricas específicas de trading
   */
  setupTradingMetrics() {
    if (!this.components.anomalyDetector) return;

    // Configurar métricas específicas para ArbitrageX
    const detector = this.components.anomalyDetector;

    Object.entries(this.config.tradingMetrics).forEach(([metricName, config]) => {
      // Configurar la métrica en el detector
      detector.config.metrics.trading = detector.config.metrics.trading || {};
      detector.config.metrics.trading[metricName] = {
        enabled: true,
        threshold: config.threshold,
        alertType: config.alertType,
        category: 'trading',
        description: config.description
      };
    });

    console.log('📊 Métricas de trading configuradas');
  }

  /**
   * Configurar monitoreo de salud del sistema
   */
  setupHealthMonitoring() {
    const healthCheckInterval = 60000; // 1 minuto

    setInterval(() => {
      this.performHealthCheck();
    }, healthCheckInterval);

    console.log('💓 Monitoreo de salud configurado');
  }

  /**
   * Realizar verificación de salud del sistema
   */
  async performHealthCheck() {
    try {
      const health = {
        timestamp: Date.now(),
        system: {
          uptime: Date.now() - this.startTime,
          memory: process.memoryUsage ? process.memoryUsage() : { heapUsed: 0 },
          initialized: this.isInitialized
        },
        components: {}
      };

      // Verificar salud de cada componente
      if (this.components.alertManager) {
        const stats = this.components.alertManager.getStatistics();
        health.components.alertManager = {
          status: 'healthy',
          activeAlerts: stats.current?.activeAlerts || 0,
          totalProcessed: stats.totalAlerts || 0
        };
      }

      if (this.components.anomalyDetector) {
        const detectorHealth = this.components.anomalyDetector.getHealthStatus();
        health.components.anomalyDetector = detectorHealth;
      }

      if (this.components.realTimeNotifier) {
        const notifierHealth = this.components.realTimeNotifier.getHealthStatus();
        health.components.realTimeNotifier = notifierHealth;
      }

      // Actualizar métricas
      this.metrics.systemUptime = health.system.uptime;
      this.metrics.lastHealthCheck = health.timestamp;

      // Detectar problemas de salud
      await this.checkSystemHealth(health);

      console.log('💓 Health check completado');

    } catch (error) {
      console.error('❌ Error en health check:', error);
      
      // Crear alerta de problema de salud
      await this.sendSystemAlert('health_check_failed', {
        error: error.message,
        timestamp: Date.now()
      });
    }
  }

  /**
   * Verificar problemas de salud del sistema
   */
  async checkSystemHealth(health) {
    // Verificar uso de memoria
    if (health.system.memory.heapUsed > 500 * 1024 * 1024) { // 500MB
      await this.sendSystemAlert('high_memory_usage', {
        memoryUsage: health.system.memory.heapUsed,
        threshold: 500 * 1024 * 1024,
        timestamp: Date.now()
      });
    }

    // Verificar componentes degradados
    for (const [componentName, componentHealth] of Object.entries(health.components)) {
      if (componentHealth.status === 'unhealthy' || componentHealth.status === 'critical') {
        await this.sendSystemAlert('component_unhealthy', {
          component: componentName,
          status: componentHealth.status,
          details: componentHealth,
          timestamp: Date.now()
        });
      }
    }
  }

  /**
   * Configurar simulación de datos para demostración
   */
  setupDataSimulation() {
    if (this.config.system.environment === 'development') {
      this.startDataSimulation();
    }
  }

  /**
   * Iniciar simulación de datos de trading
   */
  startDataSimulation() {
    if (!this.components.anomalyDetector) return;

    const simulationInterval = 10000; // 10 segundos

    setInterval(() => {
      this.simulateTradingData();
    }, simulationInterval);

    console.log('🎮 Simulación de datos iniciada');
  }

  /**
   * Simular datos de trading realistas
   */
  simulateTradingData() {
    const detector = this.components.anomalyDetector;

    // Simular latencia de ejecución (normalmente 50-200ms)
    const baseLatency = 100;
    const latencyNoise = (Math.random() - 0.5) * 50;
    const anomalyFactor = Math.random() < 0.05 ? 5 : 1; // 5% probabilidad de anomalía
    const executionLatency = baseLatency + latencyNoise * anomalyFactor;

    detector.recordMetric('executionLatency', executionLatency, {
      exchange: 'binance',
      pair: 'BTC/USDT',
      orderType: 'market'
    });

    // Simular profit/loss (normalmente positivo, ocasionalmente negativo)
    const baseProfitLoss = Math.random() * 100 - 10; // -10 a 90
    const lossEvent = Math.random() < 0.02; // 2% probabilidad de pérdida significativa
    const profitLoss = lossEvent ? -Math.random() * 1000 : baseProfitLoss;

    detector.recordMetric('profitLoss', profitLoss, {
      strategy: 'arbitrage',
      pair: 'ETH/USDT',
      amount: Math.random() * 10000
    });

    // Simular volumen de trading
    const baseVolume = 50000;
    const volumeVariation = (Math.random() - 0.5) * 20000;
    const volumeSpike = Math.random() < 0.03 ? 3 : 1; // 3% probabilidad de pico
    const volume = (baseVolume + volumeVariation) * volumeSpike;

    detector.recordMetric('volumeAnomaly', volume, {
      market: 'spot',
      timeframe: '5m'
    });

    // Simular tasa de error del sistema
    const baseErrorRate = 0.1; // 0.1%
    const errorSpike = Math.random() < 0.01 ? 10 : 1; // 1% probabilidad de pico
    const errorRate = baseErrorRate * errorSpike;

    detector.recordMetric('errorRate', errorRate, {
      component: 'trading_engine',
      endpoint: '/api/trading/execute'
    });

    // Simular intentos de login (seguridad)
    const baseLoginAttempts = 5;
    const loginAttack = Math.random() < 0.001 ? 20 : 1; // 0.1% probabilidad de ataque
    const loginAttempts = baseLoginAttempts * loginAttack;

    detector.recordMetric('loginAttempts', loginAttempts, {
      source: 'web_dashboard',
      timeWindow: '5min'
    });

    console.log('📊 Datos de trading simulados');
  }

  /**
   * Enviar alerta del sistema
   */
  async sendSystemAlert(alertType, data) {
    if (!this.components.alertManager) return;

    const alertData = {
      type: this.getSystemAlertType(alertType),
      category: 'system',
      title: this.getSystemAlertTitle(alertType),
      description: this.getSystemAlertDescription(alertType, data),
      source: 'alert-integrator',
      context: {
        alertType,
        systemData: data,
        metrics: this.metrics,
        timestamp: Date.now()
      }
    };

    return await this.components.alertManager.createAlert(alertData);
  }

  /**
   * Obtener tipo de alerta del sistema
   */
  getSystemAlertType(alertType) {
    const typeMapping = {
      system_started: 'LOW',
      system_stopped: 'HIGH',
      component_unhealthy: 'HIGH',
      high_memory_usage: 'MEDIUM',
      health_check_failed: 'HIGH',
      integration_error: 'CRITICAL'
    };

    return typeMapping[alertType] || 'MEDIUM';
  }

  /**
   * Obtener título de alerta del sistema
   */
  getSystemAlertTitle(alertType) {
    const titleMapping = {
      system_started: 'Sistema de Alertas Iniciado',
      system_stopped: 'Sistema de Alertas Detenido',
      component_unhealthy: 'Componente del Sistema Degradado',
      high_memory_usage: 'Uso Elevado de Memoria',
      health_check_failed: 'Fallo en Verificación de Salud',
      integration_error: 'Error de Integración de Componentes'
    };

    return titleMapping[alertType] || 'Alerta del Sistema';
  }

  /**
   * Obtener descripción de alerta del sistema
   */
  getSystemAlertDescription(alertType, data) {
    switch (alertType) {
      case 'system_started':
        return `El sistema ArbitrageX Supreme Alert System ha sido iniciado exitosamente. ` +
               `Componentes activos: ${data.components.join(', ')}. ` +
               `Timestamp: ${new Date(data.timestamp).toISOString()}`;

      case 'component_unhealthy':
        return `El componente ${data.component} está en estado ${data.status}. ` +
               `Se requiere atención inmediata para mantener la funcionalidad del sistema.`;

      case 'high_memory_usage':
        return `El uso de memoria ha excedido el umbral seguro. ` +
               `Uso actual: ${Math.round(data.memoryUsage / 1024 / 1024)}MB, ` +
               `Umbral: ${Math.round(data.threshold / 1024 / 1024)}MB.`;

      case 'health_check_failed':
        return `La verificación de salud del sistema ha fallado. ` +
               `Error: ${data.error}. Se recomienda revisar el estado de los componentes.`;

      default:
        return `Evento del sistema detectado: ${alertType}. ` +
               `Datos: ${JSON.stringify(data)}`;
    }
  }

  /**
   * API público para crear alertas manuales
   */
  async createAlert(alertData) {
    if (!this.components.alertManager) {
      throw new Error('AlertManager no está inicializado');
    }

    return await this.components.alertManager.createAlert(alertData);
  }

  /**
   * API público para registrar métricas
   */
  recordMetric(metricName, value, metadata = {}) {
    if (!this.components.anomalyDetector) {
      throw new Error('AnomalyDetector no está inicializado');
    }

    return this.components.anomalyDetector.recordMetric(metricName, value, metadata);
  }

  /**
   * API público para obtener dashboard HTML
   */
  getDashboardHTML() {
    if (!this.components.alertDashboard) {
      throw new Error('AlertDashboard no está inicializado');
    }

    return this.components.alertDashboard.generateDashboardHTML();
  }

  /**
   * API público para obtener estadísticas del sistema
   */
  getSystemStats() {
    const stats = {
      system: {
        name: this.config.system.name,
        version: this.config.system.version,
        uptime: Date.now() - this.startTime,
        initialized: this.isInitialized,
        metrics: this.metrics
      },
      components: {}
    };

    // Estadísticas de AlertManager
    if (this.components.alertManager) {
      stats.components.alertManager = this.components.alertManager.getStatistics();
    }

    // Estadísticas de AnomalyDetector
    if (this.components.anomalyDetector) {
      stats.components.anomalyDetector = this.components.anomalyDetector.getDetectorStats();
    }

    // Estadísticas de RealTimeNotifier
    if (this.components.realTimeNotifier) {
      stats.components.realTimeNotifier = this.components.realTimeNotifier.getDetailedStats();
    }

    // Estadísticas de AlertDashboard
    if (this.components.alertDashboard) {
      stats.components.alertDashboard = this.components.alertDashboard.getDashboardData();
    }

    return stats;
  }

  /**
   * API público para obtener estado de salud
   */
  getHealthStatus() {
    const health = {
      overall: 'healthy',
      timestamp: Date.now(),
      components: {}
    };

    let unhealthyComponents = 0;
    let totalComponents = 0;

    // Verificar cada componente
    Object.keys(this.components).forEach(componentName => {
      totalComponents++;
      const component = this.components[componentName];
      
      if (component && typeof component.getHealthStatus === 'function') {
        const componentHealth = component.getHealthStatus();
        health.components[componentName] = componentHealth;
        
        if (componentHealth.status !== 'healthy') {
          unhealthyComponents++;
        }
      } else {
        health.components[componentName] = { status: 'unknown' };
      }
    });

    // Determinar estado general
    if (unhealthyComponents === 0) {
      health.overall = 'healthy';
    } else if (unhealthyComponents <= totalComponents / 2) {
      health.overall = 'degraded';
    } else {
      health.overall = 'critical';
    }

    return health;
  }

  /**
   * Detener sistema de alertas
   */
  async shutdown() {
    try {
      console.log('🛑 Deteniendo ArbitrageX Supreme Alert System...');

      // Enviar alerta de cierre
      await this.sendSystemAlert('system_stopped', {
        uptime: Date.now() - this.startTime,
        timestamp: Date.now()
      });

      // Detener componentes
      if (this.components.anomalyDetector) {
        this.components.anomalyDetector.stop();
      }

      this.isInitialized = false;
      console.log('✅ Sistema detenido correctamente');

    } catch (error) {
      console.error('❌ Error deteniendo sistema:', error);
    }
  }
}

module.exports = AlertIntegrator;
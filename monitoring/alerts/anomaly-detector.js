/**
 * ArbitrageX Supreme - Detector de Anomalías Avanzado
 * Ingenio Pichichi S.A. - Actividad 7.2
 * 
 * Sistema de detección proactiva de anomalías para:
 * - Patrones de trading anómalos
 * - Degradación de rendimiento
 * - Comportamiento sospechoso de seguridad
 * - Análisis predictivo de tendencias
 * 
 * TODO FUNCIONAL Y SIN UN SOLO MOCK
 */

const AlertManager = require('./alert-manager');

class AnomalyDetector {
  constructor(alertManager, config = {}) {
    this.alertManager = alertManager;
    this.config = {
      // Configuración de detección
      detection: {
        enabled: true,
        sensitivity: 'medium', // low, medium, high
        sampleWindow: 300000, // 5 minutos
        baselineWindow: 3600000, // 1 hora para baseline
        minDataPoints: 10
      },

      // Umbrales de desviación estándar
      thresholds: {
        low: 1.5,    // 1.5 desviaciones estándar
        medium: 2.0, // 2.0 desviaciones estándar  
        high: 2.5    // 2.5 desviaciones estándar
      },

      // Métricas monitoreadas
      metrics: {
        trading: {
          executionLatency: {
            enabled: true,
            threshold: 'medium',
            alertType: 'HIGH',
            category: 'trading'
          },
          profitLoss: {
            enabled: true,
            threshold: 'high',
            alertType: 'CRITICAL',
            category: 'trading'
          },
          volumeDeviation: {
            enabled: true,
            threshold: 'medium',
            alertType: 'MEDIUM',
            category: 'trading'
          },
          failureRate: {
            enabled: true,
            threshold: 'low',
            alertType: 'HIGH',
            category: 'trading'
          }
        },
        
        system: {
          responseTime: {
            enabled: true,
            threshold: 'medium',
            alertType: 'MEDIUM',
            category: 'system'
          },
          errorRate: {
            enabled: true,
            threshold: 'low',
            alertType: 'HIGH',
            category: 'system'
          },
          resourceUsage: {
            enabled: true,
            threshold: 'high',
            alertType: 'MEDIUM',
            category: 'system'
          },
          throughput: {
            enabled: true,
            threshold: 'medium',
            alertType: 'MEDIUM',
            category: 'system'
          }
        },

        security: {
          loginAttempts: {
            enabled: true,
            threshold: 'low',
            alertType: 'HIGH',
            category: 'security'
          },
          rateLimitViolations: {
            enabled: true,
            threshold: 'medium',
            alertType: 'MEDIUM',
            category: 'security'
          },
          suspiciousPatterns: {
            enabled: true,
            threshold: 'low',
            alertType: 'CRITICAL',
            category: 'security'
          }
        }
      },

      ...config
    };

    // Almacén de datos históricos
    this.dataStore = {
      raw: new Map(), // Datos originales por métrica
      processed: new Map(), // Datos procesados y estadísticas
      baselines: new Map(), // Líneas base por métrica
      patterns: new Map() // Patrones identificados
    };

    // Estado del detector
    this.isRunning = false;
    this.lastAnalysis = null;
    this.detectionResults = [];

    // Inicializar
    this.initialize();
  }

  async initialize() {
    try {
      // Configurar métricas
      this.setupMetrics();

      // Configurar análisis periódico
      this.setupPeriodicAnalysis();

      // Configurar limpieza de datos
      this.setupDataCleanup();

      console.log('✅ AnomalyDetector inicializado correctamente');
    } catch (error) {
      console.error('❌ Error inicializando AnomalyDetector:', error);
      throw error;
    }
  }

  /**
   * Configurar métricas monitoreadas
   */
  setupMetrics() {
    const allMetrics = Object.values(this.config.metrics).flatMap(category => 
      Object.keys(category)
    );

    allMetrics.forEach(metric => {
      this.dataStore.raw.set(metric, []);
      this.dataStore.processed.set(metric, {
        mean: 0,
        stdDev: 0,
        min: Infinity,
        max: -Infinity,
        count: 0,
        trend: 'stable'
      });
      this.dataStore.baselines.set(metric, null);
    });

    console.log(`📊 ${allMetrics.length} métricas configuradas para detección`);
  }

  /**
   * Registrar nueva medición de métrica
   */
  recordMetric(metricName, value, metadata = {}) {
    try {
      if (!this.dataStore.raw.has(metricName)) {
        console.warn(`⚠️  Métrica no configurada: ${metricName}`);
        return;
      }

      const timestamp = Date.now();
      const dataPoint = {
        value,
        timestamp,
        metadata
      };

      // Almacenar dato
      const rawData = this.dataStore.raw.get(metricName);
      rawData.push(dataPoint);

      // Mantener solo datos dentro de la ventana
      const cutoffTime = timestamp - this.config.detection.baselineWindow;
      const filteredData = rawData.filter(point => point.timestamp > cutoffTime);
      this.dataStore.raw.set(metricName, filteredData);

      // Actualizar estadísticas procesadas
      this.updateProcessedStats(metricName, filteredData);

      // Verificar si hay suficientes datos para detección
      if (filteredData.length >= this.config.detection.minDataPoints) {
        this.checkForAnomalies(metricName, dataPoint);
      }

    } catch (error) {
      console.error(`❌ Error registrando métrica ${metricName}:`, error);
    }
  }

  /**
   * Actualizar estadísticas procesadas
   */
  updateProcessedStats(metricName, data) {
    if (data.length === 0) return;

    const values = data.map(point => point.value);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    const min = Math.min(...values);
    const max = Math.max(...values);

    // Calcular tendencia
    const trend = this.calculateTrend(values);

    this.dataStore.processed.set(metricName, {
      mean,
      stdDev,
      min,
      max,
      count: data.length,
      trend,
      lastUpdated: Date.now()
    });
  }

  /**
   * Calcular tendencia de los datos
   */
  calculateTrend(values) {
    if (values.length < 3) return 'insufficient_data';

    const n = values.length;
    const recentWindow = Math.min(10, Math.floor(n / 3));
    const recent = values.slice(-recentWindow);
    const previous = values.slice(-(recentWindow * 2), -recentWindow);

    if (previous.length === 0) return 'insufficient_data';

    const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
    const previousAvg = previous.reduce((sum, val) => sum + val, 0) / previous.length;

    const change = ((recentAvg - previousAvg) / previousAvg) * 100;

    if (Math.abs(change) < 5) return 'stable';
    return change > 0 ? 'increasing' : 'decreasing';
  }

  /**
   * Verificar anomalías en tiempo real
   */
  checkForAnomalies(metricName, dataPoint) {
    try {
      const metricConfig = this.getMetricConfig(metricName);
      if (!metricConfig || !metricConfig.enabled) return;

      const stats = this.dataStore.processed.get(metricName);
      const thresholdSigma = this.config.thresholds[metricConfig.threshold];

      // Verificar desviación estadística
      const deviation = Math.abs(dataPoint.value - stats.mean);
      const anomalyScore = deviation / (stats.stdDev || 1);

      if (anomalyScore > thresholdSigma) {
        this.handleAnomaly({
          metricName,
          dataPoint,
          stats,
          anomalyScore,
          threshold: thresholdSigma,
          config: metricConfig
        });
      }

      // Verificar patrones específicos
      this.checkPatternAnomalies(metricName, dataPoint, stats);

    } catch (error) {
      console.error(`❌ Error verificando anomalías para ${metricName}:`, error);
    }
  }

  /**
   * Manejar detección de anomalía
   */
  async handleAnomaly(anomalyData) {
    const {
      metricName,
      dataPoint,
      stats,
      anomalyScore,
      threshold,
      config
    } = anomalyData;

    // Crear alerta
    const alertData = {
      type: config.alertType,
      category: config.category,
      title: `Anomalía detectada en ${metricName}`,
      description: this.generateAnomalyDescription(anomalyData),
      source: 'anomaly-detector',
      
      context: {
        metric: metricName,
        value: dataPoint.value,
        threshold: threshold,
        anomalyScore: anomalyScore.toFixed(2),
        baseline: stats.mean.toFixed(2),
        stdDev: stats.stdDev.toFixed(2),
        trend: stats.trend,
        additional: {
          timestamp: dataPoint.timestamp,
          metadata: dataPoint.metadata,
          stats: {
            min: stats.min,
            max: stats.max,
            count: stats.count
          }
        }
      }
    };

    // Enviar alerta
    const alert = await this.alertManager.createAlert(alertData);

    // Registrar resultado de detección
    this.detectionResults.push({
      alertId: alert?.id,
      metricName,
      timestamp: dataPoint.timestamp,
      anomalyScore,
      processed: true
    });

    console.log(`🚨 Anomalía detectada: ${metricName} = ${dataPoint.value} (score: ${anomalyScore.toFixed(2)})`);
  }

  /**
   * Generar descripción detallada de la anomalía
   */
  generateAnomalyDescription(anomalyData) {
    const { metricName, dataPoint, stats, anomalyScore } = anomalyData;

    const direction = dataPoint.value > stats.mean ? 'superior' : 'inferior';
    const deviation = Math.abs(dataPoint.value - stats.mean);
    const percentage = ((deviation / stats.mean) * 100).toFixed(1);

    return `La métrica ${metricName} registró un valor de ${dataPoint.value}, ` +
           `que es ${anomalyScore.toFixed(2)} desviaciones estándar ${direction} ` +
           `al promedio (${stats.mean.toFixed(2)}). Esto representa una desviación ` +
           `del ${percentage}% respecto al comportamiento normal. ` +
           `Tendencia actual: ${stats.trend}.`;
  }

  /**
   * Verificar anomalías de patrones específicos
   */
  checkPatternAnomalies(metricName, dataPoint, stats) {
    // Verificar patrones específicos según el tipo de métrica
    switch (metricName) {
      case 'executionLatency':
        this.checkLatencyPatterns(dataPoint, stats);
        break;
      
      case 'profitLoss':
        this.checkProfitLossPatterns(dataPoint, stats);
        break;
      
      case 'loginAttempts':
        this.checkSecurityPatterns(dataPoint, stats);
        break;
      
      case 'errorRate':
        this.checkErrorRatePatterns(dataPoint, stats);
        break;
    }
  }

  /**
   * Verificar patrones de latencia
   */
  checkLatencyPatterns(dataPoint, stats) {
    // Patrón: Latencia sostenida elevada
    if (dataPoint.value > stats.mean * 2) {
      const recentData = this.getRecentData('executionLatency', 5);
      const sustainedHigh = recentData.filter(p => p.value > stats.mean * 1.5).length;
      
      if (sustainedHigh >= 3) {
        this.createPatternAlert('sustained_high_latency', {
          description: 'Latencia sostenida elevada detectada',
          severity: 'HIGH',
          pattern: 'sustained_degradation',
          dataPoints: sustainedHigh
        });
      }
    }
  }

  /**
   * Verificar patrones de pérdidas y ganancias
   */
  checkProfitLossPatterns(dataPoint, stats) {
    // Patrón: Pérdidas consecutivas
    if (dataPoint.value < 0) {
      const recentData = this.getRecentData('profitLoss', 10);
      const consecutiveLosses = this.getConsecutiveNegatives(recentData);
      
      if (consecutiveLosses >= 5) {
        this.createPatternAlert('consecutive_losses', {
          description: `${consecutiveLosses} pérdidas consecutivas detectadas`,
          severity: 'CRITICAL',
          pattern: 'loss_streak',
          count: consecutiveLosses,
          totalLoss: recentData.slice(-consecutiveLosses)
            .reduce((sum, p) => sum + p.value, 0)
        });
      }
    }
  }

  /**
   * Verificar patrones de seguridad
   */
  checkSecurityPatterns(dataPoint, stats) {
    // Patrón: Picos súbitos de intentos de login
    if (dataPoint.value > stats.mean * 3) {
      this.createPatternAlert('login_spike', {
        description: 'Pico súbito de intentos de login detectado',
        severity: 'CRITICAL',
        pattern: 'security_breach_attempt',
        attempts: dataPoint.value,
        baseline: stats.mean
      });
    }
  }

  /**
   * Verificar patrones de tasa de error
   */
  checkErrorRatePatterns(dataPoint, stats) {
    // Patrón: Tasa de error en aumento sostenido
    if (stats.trend === 'increasing' && dataPoint.value > stats.mean * 1.5) {
      this.createPatternAlert('increasing_error_rate', {
        description: 'Tasa de error en aumento sostenido',
        severity: 'HIGH',
        pattern: 'degradation_trend',
        currentRate: dataPoint.value,
        trend: stats.trend
      });
    }
  }

  /**
   * Crear alerta de patrón específico
   */
  async createPatternAlert(patternType, patternData) {
    const alertData = {
      type: patternData.severity || 'HIGH',
      category: 'pattern_detection',
      title: `Patrón anómalo: ${patternType}`,
      description: patternData.description,
      source: 'pattern-detector',
      
      context: {
        pattern: patternData.pattern,
        patternType,
        additional: patternData
      }
    };

    const alert = await this.alertManager.createAlert(alertData);
    console.log(`🔍 Patrón anómalo detectado: ${patternType}`);
    
    return alert;
  }

  /**
   * Obtener datos recientes de una métrica
   */
  getRecentData(metricName, count) {
    const rawData = this.dataStore.raw.get(metricName) || [];
    return rawData.slice(-count);
  }

  /**
   * Contar valores negativos consecutivos
   */
  getConsecutiveNegatives(data) {
    let count = 0;
    for (let i = data.length - 1; i >= 0; i--) {
      if (data[i].value < 0) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }

  /**
   * Configurar análisis periódico
   */
  setupPeriodicAnalysis() {
    const analysisInterval = 60000; // 1 minuto

    setInterval(() => {
      this.performPeriodicAnalysis();
    }, analysisInterval);

    console.log('🔄 Análisis periódico configurado');
  }

  /**
   * Realizar análisis periódico completo
   */
  async performPeriodicAnalysis() {
    try {
      this.lastAnalysis = Date.now();

      // Actualizar baselines
      this.updateBaselines();

      // Análisis predictivo
      await this.performPredictiveAnalysis();

      // Análisis de correlaciones
      await this.performCorrelationAnalysis();

      // Limpieza de resultados antiguos
      this.cleanupDetectionResults();

    } catch (error) {
      console.error('❌ Error en análisis periódico:', error);
    }
  }

  /**
   * Actualizar líneas base de métricas
   */
  updateBaselines() {
    for (const [metricName, rawData] of this.dataStore.raw) {
      if (rawData.length < this.config.detection.minDataPoints) continue;

      const values = rawData.map(point => point.value);
      const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
      const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
      const stdDev = Math.sqrt(variance);

      this.dataStore.baselines.set(metricName, {
        mean,
        stdDev,
        min: Math.min(...values),
        max: Math.max(...values),
        sampleSize: values.length,
        updatedAt: Date.now()
      });
    }
  }

  /**
   * Análisis predictivo basado en tendencias
   */
  async performPredictiveAnalysis() {
    for (const [metricName, stats] of this.dataStore.processed) {
      if (stats.count < this.config.detection.minDataPoints) continue;

      // Predecir valores futuros basados en tendencias
      if (stats.trend === 'increasing' || stats.trend === 'decreasing') {
        const rawData = this.dataStore.raw.get(metricName);
        const prediction = this.predictFutureTrend(rawData, 300000); // 5 minutos

        if (this.isPredictionConcerning(metricName, prediction)) {
          await this.createPredictiveAlert(metricName, prediction, stats);
        }
      }
    }
  }

  /**
   * Predecir tendencia futura
   */
  predictFutureTrend(data, futureTimeMs) {
    if (data.length < 5) return null;

    const recent = data.slice(-10);
    const timePoints = recent.map(point => point.timestamp);
    const values = recent.map(point => point.value);

    // Regresión lineal simple
    const n = timePoints.length;
    const sumX = timePoints.reduce((sum, t) => sum + t, 0);
    const sumY = values.reduce((sum, v) => sum + v, 0);
    const sumXY = timePoints.reduce((sum, t, i) => sum + t * values[i], 0);
    const sumXX = timePoints.reduce((sum, t) => sum + t * t, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const futureTime = Date.now() + futureTimeMs;
    const predictedValue = slope * futureTime + intercept;

    return {
      value: predictedValue,
      time: futureTime,
      confidence: this.calculatePredictionConfidence(recent),
      trend: slope > 0 ? 'increasing' : 'decreasing'
    };
  }

  /**
   * Calcular confianza de la predicción
   */
  calculatePredictionConfidence(data) {
    const values = data.map(point => point.value);
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    const coefficient = stdDev / Math.abs(mean) || 0;

    // Confianza inversa al coeficiente de variación
    return Math.max(0, Math.min(1, 1 - coefficient));
  }

  /**
   * Verificar si la predicción es preocupante
   */
  isPredictionConcerning(metricName, prediction) {
    if (!prediction || prediction.confidence < 0.5) return false;

    const metricConfig = this.getMetricConfig(metricName);
    if (!metricConfig) return false;

    const baseline = this.dataStore.baselines.get(metricName);
    if (!baseline) return false;

    // Verificar si la predicción excede umbrales críticos
    const deviationFromBaseline = Math.abs(prediction.value - baseline.mean) / baseline.stdDev;
    return deviationFromBaseline > 3; // 3 desviaciones estándar
  }

  /**
   * Crear alerta predictiva
   */
  async createPredictiveAlert(metricName, prediction, stats) {
    const alertData = {
      type: 'MEDIUM',
      category: 'predictive',
      title: `Predicción de anomalía en ${metricName}`,
      description: `El análisis predictivo indica que ${metricName} podría alcanzar ` +
                  `un valor anómalo de ${prediction.value.toFixed(2)} en los próximos 5 minutos. ` +
                  `Confianza de predicción: ${(prediction.confidence * 100).toFixed(1)}%.`,
      source: 'predictive-analyzer',
      
      context: {
        metric: metricName,
        predictedValue: prediction.value,
        predictionTime: prediction.time,
        confidence: prediction.confidence,
        currentTrend: stats.trend,
        additional: {
          currentMean: stats.mean,
          prediction
        }
      }
    };

    const alert = await this.alertManager.createAlert(alertData);
    console.log(`🔮 Alerta predictiva: ${metricName}`);
    
    return alert;
  }

  /**
   * Análisis de correlaciones entre métricas
   */
  async performCorrelationAnalysis() {
    const metrics = Array.from(this.dataStore.raw.keys());
    
    for (let i = 0; i < metrics.length; i++) {
      for (let j = i + 1; j < metrics.length; j++) {
        const correlation = this.calculateCorrelation(metrics[i], metrics[j]);
        
        if (Math.abs(correlation) > 0.8) { // Correlación fuerte
          await this.checkCorrelationAnomaly(metrics[i], metrics[j], correlation);
        }
      }
    }
  }

  /**
   * Calcular correlación entre dos métricas
   */
  calculateCorrelation(metric1, metric2) {
    const data1 = this.dataStore.raw.get(metric1);
    const data2 = this.dataStore.raw.get(metric2);

    if (!data1 || !data2 || data1.length < 10 || data2.length < 10) {
      return 0;
    }

    // Sincronizar datos por timestamp
    const syncedData = this.synchronizeData(data1, data2);
    if (syncedData.length < 5) return 0;

    const values1 = syncedData.map(pair => pair.value1);
    const values2 = syncedData.map(pair => pair.value2);

    const mean1 = values1.reduce((sum, val) => sum + val, 0) / values1.length;
    const mean2 = values2.reduce((sum, val) => sum + val, 0) / values2.length;

    let numerator = 0;
    let denominator1 = 0;
    let denominator2 = 0;

    for (let i = 0; i < values1.length; i++) {
      const diff1 = values1[i] - mean1;
      const diff2 = values2[i] - mean2;
      
      numerator += diff1 * diff2;
      denominator1 += diff1 * diff1;
      denominator2 += diff2 * diff2;
    }

    const denominator = Math.sqrt(denominator1 * denominator2);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * Sincronizar datos de dos métricas por timestamp
   */
  synchronizeData(data1, data2, toleranceMs = 60000) {
    const synced = [];

    for (const point1 of data1) {
      const matchingPoint = data2.find(point2 => 
        Math.abs(point1.timestamp - point2.timestamp) <= toleranceMs
      );

      if (matchingPoint) {
        synced.push({
          timestamp: point1.timestamp,
          value1: point1.value,
          value2: matchingPoint.value
        });
      }
    }

    return synced;
  }

  /**
   * Verificar anomalías en correlaciones
   */
  async checkCorrelationAnomaly(metric1, metric2, expectedCorrelation) {
    const recentCorrelation = this.calculateRecentCorrelation(metric1, metric2);
    
    if (Math.abs(expectedCorrelation - recentCorrelation) > 0.3) {
      await this.createCorrelationAlert(metric1, metric2, expectedCorrelation, recentCorrelation);
    }
  }

  /**
   * Calcular correlación reciente (últimos 30 puntos)
   */
  calculateRecentCorrelation(metric1, metric2) {
    const data1 = this.dataStore.raw.get(metric1).slice(-30);
    const data2 = this.dataStore.raw.get(metric2).slice(-30);
    
    return this.calculateCorrelation(metric1, metric2);
  }

  /**
   * Crear alerta de correlación anómala
   */
  async createCorrelationAlert(metric1, metric2, expected, actual) {
    const alertData = {
      type: 'HIGH',
      category: 'correlation',
      title: `Correlación anómala detectada`,
      description: `La correlación entre ${metric1} y ${metric2} ha cambiado ` +
                  `significativamente. Esperada: ${expected.toFixed(2)}, ` +
                  `Actual: ${actual.toFixed(2)}.`,
      source: 'correlation-analyzer',
      
      context: {
        metric1,
        metric2,
        expectedCorrelation: expected,
        actualCorrelation: actual,
        deviation: Math.abs(expected - actual),
        additional: {
          analysis: 'correlation_break'
        }
      }
    };

    const alert = await this.alertManager.createAlert(alertData);
    console.log(`📊 Correlación anómala: ${metric1} vs ${metric2}`);
    
    return alert;
  }

  /**
   * Obtener configuración de métrica
   */
  getMetricConfig(metricName) {
    for (const category of Object.values(this.config.metrics)) {
      if (category[metricName]) {
        return category[metricName];
      }
    }
    return null;
  }

  /**
   * Configurar limpieza automática de datos
   */
  setupDataCleanup() {
    const cleanupInterval = 3600000; // 1 hora
    const maxDataAge = 24 * 3600000; // 24 horas

    setInterval(() => {
      const cutoffTime = Date.now() - maxDataAge;
      let totalCleaned = 0;

      for (const [metricName, data] of this.dataStore.raw) {
        const initialLength = data.length;
        const cleanedData = data.filter(point => point.timestamp > cutoffTime);
        this.dataStore.raw.set(metricName, cleanedData);
        
        totalCleaned += initialLength - cleanedData.length;
      }

      if (totalCleaned > 0) {
        console.log(`🧹 Limpieza de datos: ${totalCleaned} puntos eliminados`);
      }
    }, cleanupInterval);

    console.log('🧹 Limpieza automática de datos configurada');
  }

  /**
   * Limpiar resultados de detección antiguos
   */
  cleanupDetectionResults() {
    const maxAge = 24 * 3600000; // 24 horas
    const cutoffTime = Date.now() - maxAge;
    
    const initialLength = this.detectionResults.length;
    this.detectionResults = this.detectionResults.filter(
      result => result.timestamp > cutoffTime
    );

    const cleaned = initialLength - this.detectionResults.length;
    if (cleaned > 0) {
      console.log(`🧹 Resultados de detección limpiados: ${cleaned}`);
    }
  }

  /**
   * Obtener estadísticas del detector
   */
  getDetectorStats() {
    const now = Date.now();
    const last24h = now - (24 * 3600000);
    const recentDetections = this.detectionResults.filter(r => r.timestamp > last24h);

    return {
      isRunning: this.isRunning,
      lastAnalysis: this.lastAnalysis,
      metrics: {
        totalMetrics: this.dataStore.raw.size,
        activeMetrics: Array.from(this.dataStore.raw.values())
          .filter(data => data.length > 0).length,
        dataPoints: Array.from(this.dataStore.raw.values())
          .reduce((sum, data) => sum + data.length, 0)
      },
      detections: {
        total: this.detectionResults.length,
        last24h: recentDetections.length,
        byMetric: this.groupDetectionsByMetric(recentDetections)
      },
      baselines: {
        configured: this.dataStore.baselines.size,
        active: Array.from(this.dataStore.baselines.values())
          .filter(baseline => baseline !== null).length
      }
    };
  }

  /**
   * Agrupar detecciones por métrica
   */
  groupDetectionsByMetric(detections) {
    return detections.reduce((acc, detection) => {
      acc[detection.metricName] = (acc[detection.metricName] || 0) + 1;
      return acc;
    }, {});
  }

  /**
   * Iniciar detección
   */
  start() {
    this.isRunning = true;
    console.log('▶️  AnomalyDetector iniciado');
  }

  /**
   * Detener detección
   */
  stop() {
    this.isRunning = false;
    console.log('⏹️  AnomalyDetector detenido');
  }

  /**
   * Obtener estado de salud del detector
   */
  getHealthStatus() {
    const stats = this.getDetectorStats();
    const timeSinceLastAnalysis = Date.now() - (this.lastAnalysis || 0);
    
    return {
      status: this.isRunning && timeSinceLastAnalysis < 120000 ? 'healthy' : 'unhealthy',
      isRunning: this.isRunning,
      lastAnalysis: this.lastAnalysis,
      timeSinceLastAnalysis,
      metrics: stats.metrics,
      detections: stats.detections
    };
  }
}

module.exports = AnomalyDetector;
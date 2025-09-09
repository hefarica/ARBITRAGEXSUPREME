import { register, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';
import Redis from 'ioredis';
import winston from 'winston';
import { RelayType, RelayInfo, BundleResult, RelaySubmissionResult } from '../types/relay.js';

export class RelayMetricsService {
  private redis: Redis;
  private logger: winston.Logger;

  // Prometheus Metrics - Bundle Submissions
  private bundleSubmissionCounter: Counter<string>;
  private bundleSubmissionDuration: Histogram<string>;
  private relayResponseTime: Histogram<string>;
  private relaySuccessRate: Gauge<string>;
  
  // Prometheus Metrics - Relay Health
  private relayHealthGauge: Gauge<string>;
  private relayUptimeGauge: Gauge<string>;
  private consecutiveFailures: Gauge<string>;
  
  // Prometheus Metrics - Inclusion Tracking
  private inclusionCounter: Counter<string>;
  private inclusionDelayHistogram: Histogram<string>;
  private inclusionRate: Gauge<string>;
  
  // Prometheus Metrics - MEV Performance
  private mevBundlesTotal: Counter<string>;
  private bundleCompetitionRate: Gauge<string>;
  private relayPriorityScore: Gauge<string>;
  
  constructor(redis: Redis, logger: winston.Logger) {
    this.redis = redis;
    this.logger = logger;

    // Configurar métricas por defecto de Node.js
    collectDefaultMetrics({
      prefix: 'relays_client_',
      register
    });

    this.initializeMetrics();
  }

  /**
   * Inicializar todas las métricas de Prometheus
   */
  private initializeMetrics(): void {
    // ========================================================================
    // Bundle Submission Metrics
    // ========================================================================
    this.bundleSubmissionCounter = new Counter({
      name: 'relays_client_bundle_submissions_total',
      help: 'Total number of bundle submissions by relay and status',
      labelNames: ['relay_type', 'relay_id', 'strategy', 'status', 'chain_id'],
      registers: [register]
    });

    this.bundleSubmissionDuration = new Histogram({
      name: 'relays_client_bundle_submission_duration_ms',
      help: 'Duration of bundle submission process in milliseconds',
      labelNames: ['relay_type', 'strategy', 'chain_id'],
      buckets: [50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000],
      registers: [register]
    });

    this.relayResponseTime = new Histogram({
      name: 'relays_client_relay_response_time_ms',
      help: 'Response time from individual relays in milliseconds',
      labelNames: ['relay_type', 'relay_id'],
      buckets: [25, 50, 100, 200, 500, 1000, 2000, 5000, 10000],
      registers: [register]
    });

    // ========================================================================
    // Relay Health Metrics
    // ========================================================================
    this.relayHealthGauge = new Gauge({
      name: 'relays_client_relay_health_status',
      help: 'Health status of relays (1=healthy, 0=unhealthy)',
      labelNames: ['relay_type', 'relay_id', 'relay_name'],
      registers: [register]
    });

    this.relaySuccessRate = new Gauge({
      name: 'relays_client_relay_success_rate_percentage',
      help: 'Success rate percentage of relay submissions',
      labelNames: ['relay_type', 'relay_id'],
      registers: [register]
    });

    this.relayUptimeGauge = new Gauge({
      name: 'relays_client_relay_uptime_percentage',
      help: 'Uptime percentage of relays',
      labelNames: ['relay_type', 'relay_id'],
      registers: [register]
    });

    this.consecutiveFailures = new Gauge({
      name: 'relays_client_relay_consecutive_failures',
      help: 'Number of consecutive failures for each relay',
      labelNames: ['relay_type', 'relay_id'],
      registers: [register]
    });

    // ========================================================================
    // Inclusion Tracking Metrics
    // ========================================================================
    this.inclusionCounter = new Counter({
      name: 'relays_client_bundle_inclusions_total',
      help: 'Total number of bundle inclusions by relay and outcome',
      labelNames: ['relay_type', 'strategy', 'outcome', 'chain_id'],
      registers: [register]
    });

    this.inclusionDelayHistogram = new Histogram({
      name: 'relays_client_inclusion_delay_blocks',
      help: 'Number of blocks delay for bundle inclusion',
      labelNames: ['relay_type', 'strategy', 'chain_id'],
      buckets: [0, 1, 2, 3, 4, 5, 8, 10, 15, 20],
      registers: [register]
    });

    this.inclusionRate = new Gauge({
      name: 'relays_client_inclusion_rate_percentage',
      help: 'Bundle inclusion rate percentage by relay',
      labelNames: ['relay_type', 'relay_id', 'strategy'],
      registers: [register]
    });

    // ========================================================================
    // MEV Performance Metrics
    // ========================================================================
    this.mevBundlesTotal = new Counter({
      name: 'relays_client_mev_bundles_total',
      help: 'Total MEV bundles processed by type',
      labelNames: ['relay_type', 'bundle_type', 'strategy'],
      registers: [register]
    });

    this.bundleCompetitionRate = new Gauge({
      name: 'relays_client_bundle_competition_rate',
      help: 'Bundle competition rate (bundles per block)',
      labelNames: ['relay_type', 'chain_id'],
      registers: [register]
    });

    this.relayPriorityScore = new Gauge({
      name: 'relays_client_relay_priority_score',
      help: 'Dynamic priority score for relay selection',
      labelNames: ['relay_type', 'relay_id'],
      registers: [register]
    });

    this.logger.info('✅ Métricas de Prometheus inicializadas para relays-client');
  }

  /**
   * Registrar envío de bundle
   */
  recordBundleSubmission(
    bundleResult: BundleResult,
    relayResults: RelaySubmissionResult[]
  ): void {
    // Registrar métricas por cada relay usado
    relayResults.forEach(result => {
      // Counter de submissions
      this.bundleSubmissionCounter
        .labels(
          result.relay_type,
          result.relay_id,
          bundleResult.strategy,
          result.status,
          bundleResult.chain_id.toString()
        )
        .inc();

      // Response time del relay
      this.relayResponseTime
        .labels(result.relay_type, result.relay_id)
        .observe(result.response_time_ms);
    });

    // Duración total del bundle submission
    this.bundleSubmissionDuration
      .labels(
        'multi_relay', // Tipo especial para submissions multi-relay
        bundleResult.strategy,
        bundleResult.chain_id.toString()
      )
      .observe(bundleResult.total_time_ms);

    // MEV Bundle counter
    this.mevBundlesTotal
      .labels(
        'multi_relay',
        this.getBundleType(bundleResult),
        bundleResult.strategy
      )
      .inc();

    this.logger.debug(
      `📊 Métricas de bundle registradas: ${bundleResult.bundle_id} ` +
      `(${relayResults.length} relays, ${bundleResult.total_time_ms}ms)`
    );
  }

  /**
   * Actualizar métricas de salud de relay
   */
  updateRelayHealth(relayInfo: RelayInfo): void {
    const labels = [
      relayInfo.config.type,
      relayInfo.config.relay_id,
      relayInfo.config.name
    ];

    // Estado de salud (1=healthy, 0=unhealthy)
    const healthValue = relayInfo.status === 'active' || relayInfo.status === 'degraded' ? 1 : 0;
    this.relayHealthGauge.labels(...labels).set(healthValue);

    // Success rate
    this.relaySuccessRate
      .labels(relayInfo.config.type, relayInfo.config.relay_id)
      .set(relayInfo.success_rate_percentage);

    // Consecutive failures
    this.consecutiveFailures
      .labels(relayInfo.config.type, relayInfo.config.relay_id)
      .set(relayInfo.consecutive_failures);

    // Uptime (calculado como success rate para simplicidad)
    this.relayUptimeGauge
      .labels(relayInfo.config.type, relayInfo.config.relay_id)
      .set(relayInfo.success_rate_percentage);

    // Priority score dinámico
    const priorityScore = this.calculateDynamicPriority(relayInfo);
    this.relayPriorityScore
      .labels(relayInfo.config.type, relayInfo.config.relay_id)
      .set(priorityScore);
  }

  /**
   * Registrar inclusión de bundle
   */
  recordBundleInclusion(
    bundleResult: BundleResult,
    inclusionDelayBlocks: number,
    relayTypes: RelayType[]
  ): void {
    const outcome = bundleResult.inclusion_status === 'included' ? 'included' : 'missed';

    relayTypes.forEach(relayType => {
      // Counter de inclusiones
      this.inclusionCounter
        .labels(
          relayType,
          bundleResult.strategy,
          outcome,
          bundleResult.chain_id.toString()
        )
        .inc();

      // Histograma de delay solo para inclusiones exitosas
      if (outcome === 'included' && inclusionDelayBlocks >= 0) {
        this.inclusionDelayHistogram
          .labels(
            relayType,
            bundleResult.strategy,
            bundleResult.chain_id.toString()
          )
          .observe(inclusionDelayBlocks);
      }
    });

    this.logger.debug(
      `📊 Inclusión registrada: ${bundleResult.bundle_id} ${outcome} ` +
      `(delay: ${inclusionDelayBlocks} bloques)`
    );
  }

  /**
   * Actualizar tasa de inclusión por relay
   */
  async updateInclusionRates(): Promise<void> {
    try {
      // Obtener métricas de inclusión desde Redis
      const inclusionMetrics = await this.getInclusionMetricsFromRedis();
      
      Object.entries(inclusionMetrics).forEach(([relayType, metrics]: [string, any]) => {
        if (metrics && metrics.inclusion_rate !== undefined) {
          // Actualizar gauge de inclusion rate
          this.inclusionRate
            .labels(relayType, metrics.relay_id || 'unknown', 'all')
            .set(metrics.inclusion_rate);
        }
      });

    } catch (error) {
      this.logger.error('❌ Error actualizando tasas de inclusión:', error);
    }
  }

  /**
   * Actualizar métricas de competencia de bundles
   */
  updateBundleCompetition(chainId: number, bundlesPerBlock: number): void {
    // Actualizar por cada tipo de relay activo
    const activeRelayTypes: RelayType[] = ['flashbots', 'bloxroute', 'eden'];
    
    activeRelayTypes.forEach(relayType => {
      this.bundleCompetitionRate
        .labels(relayType, chainId.toString())
        .set(bundlesPerBlock);
    });
  }

  /**
   * Calcular score de prioridad dinámico
   */
  private calculateDynamicPriority(relayInfo: RelayInfo): number {
    const baseScore = relayInfo.config.priority;
    const successRateMultiplier = relayInfo.success_rate_percentage / 100;
    const responseTimeMultiplier = Math.max(0.1, 1 - (relayInfo.average_response_time_ms / 10000));
    const failurePenalty = Math.max(0.1, 1 - (relayInfo.consecutive_failures * 0.2));
    
    return baseScore * successRateMultiplier * responseTimeMultiplier * failurePenalty;
  }

  /**
   * Obtener tipo de bundle para métricas
   */
  private getBundleType(bundleResult: BundleResult): string {
    const txCount = bundleResult.relay_results.length;
    
    if (txCount === 1) return 'single_tx';
    if (txCount <= 3) return 'small_bundle';
    if (txCount <= 10) return 'medium_bundle';
    return 'large_bundle';
  }

  /**
   * Obtener métricas de inclusión desde Redis
   */
  private async getInclusionMetricsFromRedis(): Promise<Record<string, any>> {
    try {
      const pattern = 'relays-client:metrics:inclusion:*';
      const keys = await this.redis.keys(pattern);
      const metrics: Record<string, any> = {};

      for (const key of keys) {
        const relayType = key.split(':').pop();
        if (relayType) {
          const data = await this.redis.get(key);
          if (data) {
            metrics[relayType] = JSON.parse(data);
          }
        }
      }

      return metrics;
    } catch (error) {
      this.logger.error('❌ Error obteniendo métricas de inclusión:', error);
      return {};
    }
  }

  /**
   * Generar reporte de métricas consolidado
   */
  async generateMetricsReport(): Promise<any> {
    const report = {
      timestamp: new Date().toISOString(),
      bundle_metrics: {
        total_submissions: 0,
        successful_submissions: 0,
        failed_submissions: 0,
        average_response_time_ms: 0
      },
      relay_metrics: {},
      inclusion_metrics: {},
      system_health: {
        healthy_relays: 0,
        degraded_relays: 0,
        failed_relays: 0,
        overall_success_rate: 0
      }
    };

    try {
      // Obtener métricas de Prometheus
      const prometheusMetrics = await this.getPrometheusMetricsData();
      
      // Obtener métricas de Redis
      const inclusionMetrics = await this.getInclusionMetricsFromRedis();
      
      // Procesar y consolidar datos
      report.inclusion_metrics = inclusionMetrics;
      
      return report;
    } catch (error) {
      this.logger.error('❌ Error generando reporte de métricas:', error);
      return report;
    }
  }

  /**
   * Obtener datos de métricas de Prometheus
   */
  private async getPrometheusMetricsData(): Promise<any> {
    try {
      const metrics = register.getMetricsAsArray();
      const metricsData: Record<string, any> = {};

      metrics.forEach(metric => {
        metricsData[metric.name] = {
          help: metric.help,
          type: metric.type,
          values: metric.get()
        };
      });

      return metricsData;
    } catch (error) {
      this.logger.error('❌ Error obteniendo datos de Prometheus:', error);
      return {};
    }
  }

  /**
   * Obtener métricas en formato Prometheus
   */
  async getPrometheusMetrics(): Promise<string> {
    try {
      // Actualizar métricas dinámicas antes de export
      await this.updateInclusionRates();
      
      return await register.metrics();
    } catch (error) {
      this.logger.error('❌ Error obteniendo métricas de Prometheus:', error);
      throw error;
    }
  }

  /**
   * Registrar evento personalizado
   */
  recordCustomEvent(
    eventName: string,
    labels: Record<string, string>,
    value: number = 1
  ): void {
    try {
      const metricName = `relays_client_custom_${eventName.replace(/[^a-zA-Z0-9_]/g, '_')}`;
      
      let metric = register.getSingleMetric(metricName) as Counter<string>;
      
      if (!metric) {
        metric = new Counter({
          name: metricName,
          help: `Custom relay metric: ${eventName}`,
          labelNames: Object.keys(labels),
          registers: [register]
        });
      }

      metric.labels(labels).inc(value);
      
      this.logger.debug(`📊 Evento personalizado registrado: ${eventName}`, labels);
    } catch (error) {
      this.logger.error(`❌ Error registrando evento ${eventName}:`, error);
    }
  }

  /**
   * Obtener top relays por performance
   */
  async getTopRelaysByPerformance(limit: number = 5): Promise<any[]> {
    try {
      const inclusionMetrics = await this.getInclusionMetricsFromRedis();
      
      const rankedRelays = Object.entries(inclusionMetrics)
        .map(([relayType, metrics]: [string, any]) => ({
          relay_type: relayType,
          inclusion_rate: metrics.inclusion_rate || 0,
          average_delay: metrics.average_inclusion_delay || 0,
          success_rate: metrics.success_rate || 0,
          performance_score: this.calculatePerformanceScore(metrics)
        }))
        .sort((a, b) => b.performance_score - a.performance_score)
        .slice(0, limit);

      return rankedRelays;
    } catch (error) {
      this.logger.error('❌ Error obteniendo top relays:', error);
      return [];
    }
  }

  /**
   * Calcular score de performance
   */
  private calculatePerformanceScore(metrics: any): number {
    const inclusionWeight = 0.4;
    const speedWeight = 0.3;
    const reliabilityWeight = 0.3;
    
    const inclusionScore = (metrics.inclusion_rate || 0) / 100;
    const speedScore = Math.max(0, 1 - ((metrics.average_inclusion_delay || 10) / 10));
    const reliabilityScore = (metrics.success_rate || 0) / 100;
    
    return (inclusionScore * inclusionWeight) + 
           (speedScore * speedWeight) + 
           (reliabilityScore * reliabilityWeight);
  }

  /**
   * Reset de métricas
   */
  resetMetrics(): void {
    register.clear();
    this.initializeMetrics();
    this.logger.info('🔄 Métricas de relay client reiniciadas');
  }

  /**
   * Obtener estadísticas de Redis
   */
  async getRedisStats(): Promise<any> {
    try {
      const info = await this.redis.info('memory');
      const keyspace = await this.redis.info('keyspace');
      
      return {
        memory: this.parseRedisInfo(info),
        keyspace: this.parseRedisInfo(keyspace),
        connection_status: 'connected'
      };
    } catch (error) {
      return {
        connection_status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Parsear información de Redis
   */
  private parseRedisInfo(info: string): Record<string, string> {
    const result: Record<string, string> = {};
    
    info.split('\n').forEach(line => {
      const [key, value] = line.split(':');
      if (key && value) {
        result[key.trim()] = value.trim();
      }
    });
    
    return result;
  }
}
import { register, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';
import Redis from 'ioredis';
import winston from 'winston';
import { SimulationStrategy, PerformanceMetrics, AnvilInstance } from '../types/simulation.js';

export class MetricsService {
  private redis: Redis;
  private logger: winston.Logger;

  // Prometheus Metrics
  private simulationCounter: Counter<string>;
  private simulationDuration: Histogram<string>;
  private simulationGasUsed: Histogram<string>;
  private activeInstances: Gauge<string>;
  private simulationErrors: Counter<string>;
  private profitMetric: Histogram<string>;
  private instanceHealthGauge: Gauge<string>;

  constructor(redis: Redis, logger: winston.Logger) {
    this.redis = redis;
    this.logger = logger;

    // Configurar métricas por defecto de Node.js
    collectDefaultMetrics({
      prefix: 'sim_ctl_',
      register
    });

    this.initializeMetrics();
  }

  /**
   * Inicializar métricas de Prometheus
   */
  private initializeMetrics(): void {
    // Contador de simulaciones por estrategia y resultado
    this.simulationCounter = new Counter({
      name: 'sim_ctl_simulations_total',
      help: 'Total number of simulations executed',
      labelNames: ['strategy', 'status', 'chain_id'],
      registers: [register]
    });

    // Histogram de duración de simulaciones
    this.simulationDuration = new Histogram({
      name: 'sim_ctl_simulation_duration_ms',
      help: 'Duration of simulation execution in milliseconds',
      labelNames: ['strategy', 'chain_id'],
      buckets: [10, 50, 100, 500, 1000, 5000, 10000, 30000, 60000],
      registers: [register]
    });

    // Histogram de gas usado en simulaciones
    this.simulationGasUsed = new Histogram({
      name: 'sim_ctl_simulation_gas_used',
      help: 'Gas used in simulation transactions',
      labelNames: ['strategy', 'chain_id'],
      buckets: [21000, 50000, 100000, 500000, 1000000, 5000000, 10000000],
      registers: [register]
    });

    // Gauge de instancias activas
    this.activeInstances = new Gauge({
      name: 'sim_ctl_active_instances',
      help: 'Number of active Anvil instances',
      labelNames: ['strategy', 'status'],
      registers: [register]
    });

    // Contador de errores
    this.simulationErrors = new Counter({
      name: 'sim_ctl_simulation_errors_total',
      help: 'Total number of simulation errors',
      labelNames: ['strategy', 'error_type', 'chain_id'],
      registers: [register]
    });

    // Histogram de profit
    this.profitMetric = new Histogram({
      name: 'sim_ctl_simulation_profit_eth',
      help: 'Simulation profit in ETH',
      labelNames: ['strategy', 'chain_id'],
      buckets: [-1, -0.1, -0.01, 0, 0.01, 0.1, 0.5, 1, 5, 10],
      registers: [register]
    });

    // Gauge de salud de instancias
    this.instanceHealthGauge = new Gauge({
      name: 'sim_ctl_instance_health',
      help: 'Health status of Anvil instances (1=healthy, 0=unhealthy)',
      labelNames: ['instance_id', 'strategy', 'chain_id'],
      registers: [register]
    });

    this.logger.info('✅ Métricas de Prometheus inicializadas para ArbitrageX Supreme V3.0');
  }

  /**
   * Registrar simulación completada
   */
  recordSimulation(
    strategy: SimulationStrategy,
    chainId: number,
    status: 'success' | 'failed' | 'timeout' | 'error',
    durationMs: number,
    gasUsed: string,
    profitEth?: string
  ): void {
    // Incrementar contador
    this.simulationCounter
      .labels(strategy, status, chainId.toString())
      .inc();

    // Registrar duración
    this.simulationDuration
      .labels(strategy, chainId.toString())
      .observe(durationMs);

    // Registrar gas usado
    const gasAmount = parseInt(gasUsed, 10);
    if (!isNaN(gasAmount)) {
      this.simulationGasUsed
        .labels(strategy, chainId.toString())
        .observe(gasAmount);
    }

    // Registrar profit si está disponible
    if (profitEth) {
      const profit = parseFloat(profitEth);
      if (!isNaN(profit)) {
        this.profitMetric
          .labels(strategy, chainId.toString())
          .observe(profit);
      }
    }

    this.logger.debug(
      `📊 Métrica registrada: ${strategy} ${status} ` +
      `(${durationMs}ms, gas: ${gasUsed}, profit: ${profitEth || 'N/A'})`
    );
  }

  /**
   * Registrar error de simulación
   */
  recordSimulationError(
    strategy: SimulationStrategy,
    chainId: number,
    errorType: string
  ): void {
    this.simulationErrors
      .labels(strategy, errorType, chainId.toString())
      .inc();

    this.logger.debug(`❌ Error registrado: ${strategy} ${errorType} chain ${chainId}`);
  }

  /**
   * Actualizar estado de instancias
   */
  updateInstanceMetrics(instances: AnvilInstance[]): void {
    // Resetear métricas de instancias
    this.activeInstances.reset();
    this.instanceHealthGauge.reset();

    // Contar instancias por estrategia y estado
    const instanceCounts: Record<string, Record<string, number>> = {};

    instances.forEach(instance => {
      const strategy = this.getStrategyByPort(instance.config.port);
      const status = instance.status;

      if (!instanceCounts[strategy]) {
        instanceCounts[strategy] = {};
      }
      
      instanceCounts[strategy][status] = (instanceCounts[strategy][status] || 0) + 1;

      // Actualizar gauge de salud
      const healthValue = instance.status === 'running' ? 1 : 0;
      this.instanceHealthGauge
        .labels(instance.instance_id, strategy, instance.config.chain_id.toString())
        .set(healthValue);
    });

    // Actualizar gauge de instancias activas
    Object.entries(instanceCounts).forEach(([strategy, statusCounts]) => {
      Object.entries(statusCounts).forEach(([status, count]) => {
        this.activeInstances
          .labels(strategy, status)
          .set(count);
      });
    });
  }

  /**
   * Determinar estrategia por puerto (misma lógica que AnvilManager)
   */
  private getStrategyByPort(port: number): string {
    const strategyPortRanges = {
      'A': { start: 8545, end: 8554 },
      'C': { start: 8555, end: 8564 },
      'D': { start: 8565, end: 8574 },
      'F': { start: 8575, end: 8584 }
    };

    for (const [strategy, range] of Object.entries(strategyPortRanges)) {
      if (port >= range.start && port <= range.end) {
        return strategy;
      }
    }
    return 'unknown';
  }

  /**
   * Generar reporte de métricas agregadas
   */
  async generateMetricsReport(): Promise<any> {
    const strategies: SimulationStrategy[] = ['A', 'C', 'D', 'F'];
    const report: any = {
      timestamp: new Date().toISOString(),
      strategies: {},
      system: {
        total_simulations: 0,
        total_instances: 0,
        healthy_instances: 0,
        average_success_rate: 0
      }
    };

    let totalSimulations = 0;
    let totalSuccessRate = 0;
    let strategiesCount = 0;

    for (const strategy of strategies) {
      try {
        const metricsKey = `sim-ctl:metrics:${strategy}`;
        const metricsData = await this.redis.get(metricsKey);
        
        if (metricsData) {
          const metrics: PerformanceMetrics = JSON.parse(metricsData);
          
          report.strategies[strategy] = {
            total_simulations: metrics.total_simulations,
            successful_simulations: metrics.successful_simulations,
            failed_simulations: metrics.failed_simulations,
            success_rate: metrics.success_rate_percentage,
            average_execution_time_ms: metrics.average_execution_time_ms,
            total_gas_used: metrics.total_gas_used,
            total_profit_eth: metrics.total_profit_eth,
            last_updated: metrics.last_updated
          };

          totalSimulations += metrics.total_simulations;
          totalSuccessRate += metrics.success_rate_percentage;
          strategiesCount++;
        } else {
          report.strategies[strategy] = {
            total_simulations: 0,
            successful_simulations: 0,
            failed_simulations: 0,
            success_rate: 0,
            average_execution_time_ms: 0,
            total_gas_used: "0",
            total_profit_eth: "0",
            last_updated: null
          };
        }
      } catch (error) {
        this.logger.error(`❌ Error obteniendo métricas para estrategia ${strategy}:`, error);
      }
    }

    report.system.total_simulations = totalSimulations;
    report.system.average_success_rate = strategiesCount > 0 ? totalSuccessRate / strategiesCount : 0;

    return report;
  }

  /**
   * Obtener métricas en formato Prometheus
   */
  async getPrometheusMetrics(): Promise<string> {
    try {
      return await register.metrics();
    } catch (error) {
      this.logger.error('❌ Error obteniendo métricas de Prometheus:', error);
      throw error;
    }
  }

  /**
   * Limpiar métricas
   */
  clearMetrics(): void {
    register.clear();
    this.initializeMetrics();
    this.logger.info('🧹 Métricas de Prometheus limpiadas y reinicializadas');
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
      this.logger.error('❌ Error obteniendo estadísticas de Redis:', error);
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

  /**
   * Registrar evento personalizado
   */
  recordCustomEvent(
    eventName: string,
    labels: Record<string, string>,
    value: number = 1
  ): void {
    try {
      // Crear métrica temporal si no existe
      const metricName = `sim_ctl_custom_${eventName.replace(/[^a-zA-Z0-9_]/g, '_')}`;
      
      let metric = register.getSingleMetric(metricName) as Counter<string>;
      
      if (!metric) {
        metric = new Counter({
          name: metricName,
          help: `Custom metric: ${eventName}`,
          labelNames: Object.keys(labels),
          registers: [register]
        });
      }

      metric.labels(labels).inc(value);
      
      this.logger.debug(`📊 Evento personalizado: ${eventName}`, labels);
    } catch (error) {
      this.logger.error(`❌ Error registrando evento ${eventName}:`, error);
    }
  }

  /**
   * Obtener summary de performance
   */
  async getPerformanceSummary(): Promise<any> {
    const metricsReport = await this.generateMetricsReport();
    const redisStats = await this.getRedisStats();
    
    return {
      ...metricsReport,
      redis: redisStats,
      prometheus_metrics_count: register.getMetricsAsArray().length
    };
  }
}
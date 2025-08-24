// ArbitrageX Pro 2025 - Monitoring Service
// Performance monitoring and metrics collection

import { Logger } from './logger';

interface Metric {
  name: string;
  value: number;
  timestamp: Date;
  tags?: Record<string, string>;
}

interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: Date;
  success: boolean;
  tenantId?: string;
  metadata?: Record<string, any>;
}

export class MonitoringService {
  private logger = new Logger('MonitoringService');
  private metrics: Metric[] = [];
  private performanceMetrics: PerformanceMetric[] = [];
  private readonly maxMetricsHistory = 10000;
  
  // Counters
  private counters = new Map<string, number>();
  private gauges = new Map<string, number>();

  // ==========================================================================
  // METRICS COLLECTION
  // ==========================================================================

  recordMetric(name: string, value: number, tags?: Record<string, string>): void {
    const metric: Metric = {
      name,
      value,
      timestamp: new Date(),
      tags,
    };

    this.metrics.push(metric);
    
    // Keep only recent metrics
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.maxMetricsHistory);
    }

    // Log significant metrics
    if (this.shouldLogMetric(name, value)) {
      this.logger.debug(`Metric recorded: ${name} = ${value}`, { tags });
    }
  }

  incrementCounter(name: string, increment: number = 1, tags?: Record<string, string>): void {
    const key = this.getMetricKey(name, tags);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + increment);
    
    this.recordMetric(name, current + increment, tags);
  }

  setGauge(name: string, value: number, tags?: Record<string, string>): void {
    const key = this.getMetricKey(name, tags);
    this.gauges.set(key, value);
    
    this.recordMetric(name, value, tags);
  }

  // ==========================================================================
  // PERFORMANCE MONITORING
  // ==========================================================================

  startTimer(operation: string): () => PerformanceMetric {
    const startTime = Date.now();
    
    return (success = true, tenantId?: string, metadata?: Record<string, any>): PerformanceMetric => {
      const duration = Date.now() - startTime;
      
      const metric: PerformanceMetric = {
        operation,
        duration,
        timestamp: new Date(),
        success,
        tenantId,
        metadata,
      };

      this.recordPerformanceMetric(metric);
      return metric;
    };
  }

  async timeAsync<T>(
    operation: string,
    fn: () => Promise<T>,
    tenantId?: string,
    metadata?: Record<string, any>
  ): Promise<T> {
    const endTimer = this.startTimer(operation);
    
    try {
      const result = await fn();
      endTimer(true, tenantId, metadata);
      return result;
    } catch (error) {
      endTimer(false, tenantId, {
        ...metadata,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  recordPerformanceMetric(metric: PerformanceMetric): void {
    this.performanceMetrics.push(metric);
    
    // Keep only recent performance metrics
    if (this.performanceMetrics.length > this.maxMetricsHistory) {
      this.performanceMetrics = this.performanceMetrics.slice(-this.maxMetricsHistory);
    }

    // Record as regular metrics for aggregation
    this.recordMetric(`performance.${metric.operation}.duration`, metric.duration, {
      success: metric.success.toString(),
      tenant: metric.tenantId || 'unknown',
    });

    // Log slow operations
    if (metric.duration > 1000) { // > 1 second
      this.logger.warn(`Slow operation detected: ${metric.operation}`, {
        duration: `${metric.duration}ms`,
        success: metric.success,
        tenantId: metric.tenantId,
      });
    }
  }

  // ==========================================================================
  // ARBITRAGE-SPECIFIC MONITORING
  // ==========================================================================

  recordOpportunityDetected(
    tenantId: string,
    blockchain: string,
    strategy: string,
    profitPercentage: number
  ): void {
    this.incrementCounter('arbitrage.opportunities.detected', 1, {
      tenant: tenantId,
      blockchain,
      strategy,
    });

    this.setGauge('arbitrage.opportunities.profit_percentage', profitPercentage, {
      tenant: tenantId,
      blockchain,
      strategy,
    });
  }

  recordExecutionAttempt(
    tenantId: string,
    blockchain: string,
    strategy: string,
    success: boolean,
    executionTimeMs: number,
    profit?: number
  ): void {
    const tags = {
      tenant: tenantId,
      blockchain,
      strategy,
      success: success.toString(),
    };

    this.incrementCounter('arbitrage.executions.attempted', 1, tags);
    
    if (success) {
      this.incrementCounter('arbitrage.executions.successful', 1, tags);
      
      if (profit !== undefined) {
        this.recordMetric('arbitrage.executions.profit', profit, tags);
      }
    } else {
      this.incrementCounter('arbitrage.executions.failed', 1, tags);
    }

    this.recordMetric('arbitrage.executions.duration_ms', executionTimeMs, tags);
  }

  recordGasCost(
    blockchain: string,
    gasUsed: number,
    gasPriceGwei: number,
    costUsd: number
  ): void {
    const tags = { blockchain };

    this.recordMetric('blockchain.gas.used', gasUsed, tags);
    this.recordMetric('blockchain.gas.price_gwei', gasPriceGwei, tags);
    this.recordMetric('blockchain.gas.cost_usd', costUsd, tags);
  }

  recordPriceUpdate(
    blockchain: string,
    tokenAddress: string,
    dex: string,
    priceUsd: number
  ): void {
    const tags = {
      blockchain,
      token: tokenAddress,
      dex,
    };

    this.recordMetric('blockchain.price.usd', priceUsd, tags);
    this.setGauge('blockchain.price.latest_usd', priceUsd, tags);
  }

  // ==========================================================================
  // SYSTEM MONITORING
  // ==========================================================================

  recordSystemMetrics(): void {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // Memory metrics
    this.setGauge('system.memory.heap_used', memUsage.heapUsed);
    this.setGauge('system.memory.heap_total', memUsage.heapTotal);
    this.setGauge('system.memory.external', memUsage.external);
    this.setGauge('system.memory.rss', memUsage.rss);

    // CPU metrics
    this.setGauge('system.cpu.user', cpuUsage.user);
    this.setGauge('system.cpu.system', cpuUsage.system);

    // Process metrics
    this.setGauge('system.process.uptime', process.uptime());
  }

  recordApiMetrics(
    method: string,
    route: string,
    statusCode: number,
    responseTimeMs: number,
    tenantId?: string
  ): void {
    const tags = {
      method,
      route,
      status: statusCode.toString(),
      tenant: tenantId || 'unknown',
    };

    this.incrementCounter('api.requests.total', 1, tags);
    this.recordMetric('api.requests.response_time_ms', responseTimeMs, tags);

    if (statusCode >= 400) {
      this.incrementCounter('api.requests.errors', 1, tags);
    }
  }

  recordDatabaseMetrics(
    operation: string,
    durationMs: number,
    success: boolean,
    tenantId?: string
  ): void {
    const tags = {
      operation,
      success: success.toString(),
      tenant: tenantId || 'unknown',
    };

    this.incrementCounter('database.operations.total', 1, tags);
    this.recordMetric('database.operations.duration_ms', durationMs, tags);

    if (!success) {
      this.incrementCounter('database.operations.errors', 1, tags);
    }
  }

  // ==========================================================================
  // ALERTING
  // ==========================================================================

  checkAlerts(): void {
    // Check for high error rates
    const errorRate = this.calculateErrorRate();
    if (errorRate > 0.1) { // 10% error rate
      this.logger.warn('High error rate detected', { errorRate });
    }

    // Check for slow operations
    const slowOperations = this.getSlowOperations();
    if (slowOperations.length > 0) {
      this.logger.warn('Slow operations detected', { 
        count: slowOperations.length,
        operations: slowOperations.map(op => op.operation),
      });
    }

    // Check memory usage
    const memUsage = process.memoryUsage();
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
    if (heapUsedMB > 500) { // 500MB
      this.logger.warn('High memory usage detected', { heapUsedMB });
    }
  }

  // ==========================================================================
  // ANALYTICS AND REPORTING
  // ==========================================================================

  getMetricsSummary(timeRangeMs: number = 3600000): { // Default: 1 hour
    [metricName: string]: {
      count: number;
      avg: number;
      min: number;
      max: number;
      sum: number;
    };
  } {
    const cutoff = new Date(Date.now() - timeRangeMs);
    const recentMetrics = this.metrics.filter(m => m.timestamp >= cutoff);
    
    const summary: Record<string, any> = {};

    // Group metrics by name
    const metricGroups = new Map<string, number[]>();
    
    recentMetrics.forEach(metric => {
      if (!metricGroups.has(metric.name)) {
        metricGroups.set(metric.name, []);
      }
      metricGroups.get(metric.name)!.push(metric.value);
    });

    // Calculate statistics for each metric
    metricGroups.forEach((values, name) => {
      const sum = values.reduce((a, b) => a + b, 0);
      const avg = sum / values.length;
      const min = Math.min(...values);
      const max = Math.max(...values);

      summary[name] = {
        count: values.length,
        avg: Math.round(avg * 100) / 100,
        min,
        max,
        sum: Math.round(sum * 100) / 100,
      };
    });

    return summary;
  }

  getPerformanceSummary(timeRangeMs: number = 3600000): {
    [operation: string]: {
      count: number;
      avgDuration: number;
      minDuration: number;
      maxDuration: number;
      successRate: number;
    };
  } {
    const cutoff = new Date(Date.now() - timeRangeMs);
    const recentMetrics = this.performanceMetrics.filter(m => m.timestamp >= cutoff);
    
    const summary: Record<string, any> = {};

    // Group by operation
    const operationGroups = new Map<string, PerformanceMetric[]>();
    
    recentMetrics.forEach(metric => {
      if (!operationGroups.has(metric.operation)) {
        operationGroups.set(metric.operation, []);
      }
      operationGroups.get(metric.operation)!.push(metric);
    });

    // Calculate statistics for each operation
    operationGroups.forEach((metrics, operation) => {
      const durations = metrics.map(m => m.duration);
      const successCount = metrics.filter(m => m.success).length;
      
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const minDuration = Math.min(...durations);
      const maxDuration = Math.max(...durations);
      const successRate = successCount / metrics.length;

      summary[operation] = {
        count: metrics.length,
        avgDuration: Math.round(avgDuration * 100) / 100,
        minDuration,
        maxDuration,
        successRate: Math.round(successRate * 10000) / 10000,
      };
    });

    return summary;
  }

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  private getMetricKey(name: string, tags?: Record<string, string>): string {
    if (!tags || Object.keys(tags).length === 0) {
      return name;
    }
    
    const tagString = Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join(',');
    
    return `${name}[${tagString}]`;
  }

  private shouldLogMetric(name: string, value: number): boolean {
    // Log critical metrics or unusual values
    const criticalMetrics = [
      'arbitrage.executions.profit',
      'arbitrage.executions.failed',
      'api.requests.errors',
      'system.memory.heap_used',
    ];
    
    return criticalMetrics.some(pattern => name.includes(pattern)) ||
           value > 10000 ||
           (name.includes('error') && value > 0);
  }

  private calculateErrorRate(): number {
    const recentMetrics = this.metrics.filter(
      m => m.timestamp >= new Date(Date.now() - 300000) // Last 5 minutes
    );
    
    const totalRequests = recentMetrics.filter(m => m.name === 'api.requests.total').length;
    const errorRequests = recentMetrics.filter(m => m.name === 'api.requests.errors').length;
    
    return totalRequests > 0 ? errorRequests / totalRequests : 0;
  }

  private getSlowOperations(): PerformanceMetric[] {
    const cutoff = new Date(Date.now() - 600000); // Last 10 minutes
    return this.performanceMetrics.filter(
      m => m.timestamp >= cutoff && m.duration > 5000 // > 5 seconds
    );
  }

  // ==========================================================================
  // EXPORT METHODS
  // ==========================================================================

  exportMetrics(): Metric[] {
    return [...this.metrics];
  }

  exportPerformanceMetrics(): PerformanceMetric[] {
    return [...this.performanceMetrics];
  }

  clearMetrics(): void {
    this.metrics = [];
    this.performanceMetrics = [];
    this.counters.clear();
    this.gauges.clear();
    this.logger.info('All metrics cleared');
  }
}
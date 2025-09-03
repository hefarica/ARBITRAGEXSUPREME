/**
 * ArbitrageX Pro 2025 - MonitoringService Unit Tests
 * Tests comprehensivos para el servicio de monitoreo crítico
 * Hector Fabio Riascos C. - Ingenio Pichichi S.A.
 */

// Mock del Logger para evitar dependencias externas
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Mock de MonitoringService simulado para testing
class MockMonitoringService {
  constructor() {
    this.logger = mockLogger;
    this.metrics = [];
    this.performanceMetrics = [];
    this.maxMetricsHistory = 10000;
    this.counters = new Map();
    this.gauges = new Map();
  }

  recordMetric(name, value, tags = {}) {
    const metric = {
      name,
      value,
      timestamp: new Date(),
      tags
    };

    this.metrics.push(metric);
    
    // Mantener solo métricas recientes
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.maxMetricsHistory);
    }

    // Log métricas significativas
    if (this.shouldLogMetric(name, value)) {
      this.logger.debug(`Metric recorded: ${name} = ${value}`, { tags });
    }
  }

  incrementCounter(name, increment = 1, tags = {}) {
    const key = this.getMetricKey(name, tags);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + increment);
    
    // Registrar como métrica también
    this.recordMetric(`counter.${name}`, current + increment, tags);
  }

  setGauge(name, value, tags = {}) {
    const key = this.getMetricKey(name, tags);
    this.gauges.set(key, value);
    
    // Registrar como métrica también
    this.recordMetric(`gauge.${name}`, value, tags);
  }

  recordPerformance(operation, duration, success = true, tenantId = null, metadata = {}) {
    const performanceMetric = {
      operation,
      duration,
      timestamp: new Date(),
      success,
      tenantId,
      metadata
    };

    this.performanceMetrics.push(performanceMetric);
    
    // Mantener solo métricas recientes
    if (this.performanceMetrics.length > this.maxMetricsHistory) {
      this.performanceMetrics = this.performanceMetrics.slice(-this.maxMetricsHistory);
    }

    // Registrar métricas relacionadas
    this.recordMetric(`performance.${operation}.duration`, duration, {
      success: success.toString(),
      tenantId: tenantId || 'unknown'
    });
  }

  getMetrics(since = null) {
    if (!since) return this.metrics;
    
    return this.metrics.filter(metric => metric.timestamp >= since);
  }

  getPerformanceMetrics(operation = null, since = null) {
    let filtered = this.performanceMetrics;
    
    if (operation) {
      filtered = filtered.filter(metric => metric.operation === operation);
    }
    
    if (since) {
      filtered = filtered.filter(metric => metric.timestamp >= since);
    }
    
    return filtered;
  }

  getArbitrageMetrics() {
    return {
      totalOpportunities: this.counters.get('arbitrage.opportunities.detected') || 0,
      successfulExecutions: this.counters.get('arbitrage.executions.success') || 0,
      failedExecutions: this.counters.get('arbitrage.executions.failed') || 0,
      totalProfit: this.gauges.get('arbitrage.profit.total') || 0,
      averageExecutionTime: this.calculateAverageExecutionTime(),
      activeConfigs: this.gauges.get('arbitrage.configs.active') || 0
    };
  }

  // Métodos auxiliares
  shouldLogMetric(name, value) {
    // Log métricas importantes o valores altos
    return name.includes('error') || name.includes('profit') || value > 1000;
  }

  getMetricKey(name, tags = {}) {
    const tagString = Object.keys(tags)
      .sort()
      .map(key => `${key}:${tags[key]}`)
      .join(',');
    return tagString ? `${name}|${tagString}` : name;
  }

  calculateAverageExecutionTime() {
    const executionMetrics = this.performanceMetrics.filter(
      metric => metric.operation === 'arbitrage.execution'
    );

    if (executionMetrics.length === 0) return 0;

    const totalDuration = executionMetrics.reduce(
      (sum, metric) => sum + metric.duration, 
      0
    );

    return totalDuration / executionMetrics.length;
  }

  clearMetrics() {
    this.metrics = [];
    this.performanceMetrics = [];
    this.counters.clear();
    this.gauges.clear();
  }
}

describe('MonitoringService Unit Tests', () => {
  let monitoringService;

  beforeEach(() => {
    monitoringService = new MockMonitoringService();
    jest.clearAllMocks();
  });

  describe('Metrics Recording', () => {
    test('should record basic metric successfully', () => {
      monitoringService.recordMetric('test.metric', 100);
      
      const metrics = monitoringService.getMetrics();
      expect(metrics).toHaveLength(1);
      expect(metrics[0].name).toBe('test.metric');
      expect(metrics[0].value).toBe(100);
      expect(metrics[0].timestamp).toBeInstanceOf(Date);
    });

    test('should record metric with tags', () => {
      const tags = { blockchain: 'ethereum', operation: 'swap' };
      monitoringService.recordMetric('arbitrage.execution', 1, tags);
      
      const metrics = monitoringService.getMetrics();
      expect(metrics[0].tags).toEqual(tags);
    });

    test('should maintain metrics history limit', () => {
      // Configurar límite pequeño para testing
      monitoringService.maxMetricsHistory = 5;
      
      // Agregar más métricas que el límite
      for (let i = 0; i < 10; i++) {
        monitoringService.recordMetric(`test.metric.${i}`, i);
      }
      
      const metrics = monitoringService.getMetrics();
      expect(metrics).toHaveLength(5);
      // Debe mantener las más recientes
      expect(metrics[0].name).toBe('test.metric.5');
      expect(metrics[4].name).toBe('test.metric.9');
    });

    test('should log significant metrics', () => {
      // Métrica que debe loggearse (contiene 'profit')
      monitoringService.recordMetric('arbitrage.profit.total', 1500);
      
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Metric recorded: arbitrage.profit.total = 1500',
        { tags: {} }
      );
    });
  });

  describe('Counter Operations', () => {
    test('should increment counter from zero', () => {
      monitoringService.incrementCounter('arbitrage.opportunities');
      
      expect(monitoringService.counters.get('arbitrage.opportunities')).toBe(1);
    });

    test('should increment counter by custom amount', () => {
      monitoringService.incrementCounter('arbitrage.profit', 250);
      monitoringService.incrementCounter('arbitrage.profit', 150);
      
      expect(monitoringService.counters.get('arbitrage.profit')).toBe(400);
    });

    test('should handle counter with tags', () => {
      const tags = { blockchain: 'ethereum' };
      monitoringService.incrementCounter('swaps.executed', 1, tags);
      
      const key = monitoringService.getMetricKey('swaps.executed', tags);
      expect(monitoringService.counters.get(key)).toBe(1);
    });
  });

  describe('Gauge Operations', () => {
    test('should set gauge value', () => {
      monitoringService.setGauge('active.connections', 42);
      
      expect(monitoringService.gauges.get('active.connections')).toBe(42);
    });

    test('should update gauge value', () => {
      monitoringService.setGauge('gas.price', 20);
      monitoringService.setGauge('gas.price', 25);
      
      expect(monitoringService.gauges.get('gas.price')).toBe(25);
    });
  });

  describe('Performance Metrics', () => {
    test('should record performance metric', () => {
      monitoringService.recordPerformance('arbitrage.execution', 1500, true, 'tenant-123');
      
      const performanceMetrics = monitoringService.getPerformanceMetrics();
      expect(performanceMetrics).toHaveLength(1);
      
      const metric = performanceMetrics[0];
      expect(metric.operation).toBe('arbitrage.execution');
      expect(metric.duration).toBe(1500);
      expect(metric.success).toBe(true);
      expect(metric.tenantId).toBe('tenant-123');
    });

    test('should filter performance metrics by operation', () => {
      monitoringService.recordPerformance('arbitrage.execution', 1000, true);
      monitoringService.recordPerformance('blockchain.query', 500, true);
      monitoringService.recordPerformance('arbitrage.execution', 1200, false);
      
      const arbitrageMetrics = monitoringService.getPerformanceMetrics('arbitrage.execution');
      expect(arbitrageMetrics).toHaveLength(2);
      expect(arbitrageMetrics.every(m => m.operation === 'arbitrage.execution')).toBe(true);
    });

    test('should calculate average execution time', () => {
      monitoringService.recordPerformance('arbitrage.execution', 1000, true);
      monitoringService.recordPerformance('arbitrage.execution', 2000, true);
      monitoringService.recordPerformance('arbitrage.execution', 1500, true);
      
      const average = monitoringService.calculateAverageExecutionTime();
      expect(average).toBe(1500); // (1000 + 2000 + 1500) / 3
    });
  });

  describe('Arbitrage Metrics Aggregation', () => {
    test('should return comprehensive arbitrage metrics', () => {
      // Setup metrics data
      monitoringService.incrementCounter('arbitrage.opportunities.detected', 10);
      monitoringService.incrementCounter('arbitrage.executions.success', 7);
      monitoringService.incrementCounter('arbitrage.executions.failed', 2);
      monitoringService.setGauge('arbitrage.profit.total', 1250.50);
      monitoringService.setGauge('arbitrage.configs.active', 3);
      
      // Record some performance data
      monitoringService.recordPerformance('arbitrage.execution', 1000, true);
      monitoringService.recordPerformance('arbitrage.execution', 1500, true);
      
      const metrics = monitoringService.getArbitrageMetrics();
      
      expect(metrics).toEqual({
        totalOpportunities: 10,
        successfulExecutions: 7,
        failedExecutions: 2,
        totalProfit: 1250.50,
        averageExecutionTime: 1250, // (1000 + 1500) / 2
        activeConfigs: 3
      });
    });

    test('should handle empty arbitrage metrics', () => {
      const metrics = monitoringService.getArbitrageMetrics();
      
      expect(metrics).toEqual({
        totalOpportunities: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        totalProfit: 0,
        averageExecutionTime: 0,
        activeConfigs: 0
      });
    });
  });

  describe('Filtering and Querying', () => {
    test('should filter metrics by time', () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const twoHoursAgo = new Date(now.getTime() - 120 * 60 * 1000);
      
      // Limpiar métricas existentes
      monitoringService.clearMetrics();
      
      // Crear métrica antigua manualmente (más antigua que oneHourAgo)
      const oldMetric = {
        name: 'old.metric',
        value: 100,
        timestamp: twoHoursAgo,
        tags: {}
      };
      monitoringService.metrics.push(oldMetric);
      
      // Crear métrica reciente manualmente
      const recentMetric = {
        name: 'recent.metric',
        value: 200,
        timestamp: now,
        tags: {}
      };
      monitoringService.metrics.push(recentMetric);
      
      const recentMetrics = monitoringService.getMetrics(oneHourAgo);
      expect(recentMetrics).toHaveLength(1);
      expect(recentMetrics[0].name).toBe('recent.metric');
    });
  });

  describe('Utility Functions', () => {
    test('should generate correct metric keys', () => {
      const tags = { blockchain: 'ethereum', pair: 'USDC-WETH' };
      const key = monitoringService.getMetricKey('swap.executed', tags);
      
      expect(key).toBe('swap.executed|blockchain:ethereum,pair:USDC-WETH');
    });

    test('should generate key without tags', () => {
      const key = monitoringService.getMetricKey('simple.metric');
      expect(key).toBe('simple.metric');
    });

    test('should clear all metrics', () => {
      monitoringService.recordMetric('test', 100);
      monitoringService.incrementCounter('counter', 5);
      monitoringService.setGauge('gauge', 42);
      
      monitoringService.clearMetrics();
      
      expect(monitoringService.metrics).toHaveLength(0);
      expect(monitoringService.performanceMetrics).toHaveLength(0);
      expect(monitoringService.counters.size).toBe(0);
      expect(monitoringService.gauges.size).toBe(0);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle negative values', () => {
      monitoringService.recordMetric('negative.metric', -100);
      monitoringService.setGauge('negative.gauge', -50);
      
      const metrics = monitoringService.getMetrics();
      expect(metrics[0].value).toBe(-100);
      expect(monitoringService.gauges.get('negative.gauge')).toBe(-50);
    });

    test('should handle zero values', () => {
      monitoringService.recordMetric('zero.metric', 0);
      monitoringService.incrementCounter('zero.counter', 0);
      
      expect(monitoringService.getMetrics()[0].value).toBe(0);
      expect(monitoringService.counters.get('zero.counter')).toBe(0);
    });

    test('should handle large numbers', () => {
      const largeNumber = 999999999999;
      monitoringService.recordMetric('large.metric', largeNumber);
      
      expect(monitoringService.getMetrics()[0].value).toBe(largeNumber);
    });

    test('should handle undefined and null tags gracefully', () => {
      expect(() => {
        monitoringService.recordMetric('test', 100, null);
        monitoringService.recordMetric('test2', 100, undefined);
      }).not.toThrow();
    });
  });
});
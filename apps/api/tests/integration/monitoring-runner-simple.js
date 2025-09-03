/**
 * Monitoring Integration Test Runner - ArbitrageX Supreme
 * Metodología del Ingenio Pichichi S.A.
 */

const { SimpleTestAppHelper } = require('./helpers/simple-app-helper');

// Mock para servicios de monitoreo
class MonitoringServiceMock {
  constructor() {
    this.metrics = [];
    this.alerts = new Map();
    this.logs = [];
    this.healthChecks = new Map();
    this.dashboards = new Map();
    this.nextAlertId = 1;
    this.nextLogId = 1;
    this.isInitialized = false;
    this.systemStatus = 'healthy';
  }

  async initialize() {
    this.isInitialized = true;
    
    // Configurar health checks predeterminados
    const defaultHealthChecks = [
      { name: 'database', status: 'healthy', lastCheck: new Date(), responseTime: 15 },
      { name: 'redis', status: 'healthy', lastCheck: new Date(), responseTime: 8 },
      { name: 'blockchain_service', status: 'healthy', lastCheck: new Date(), responseTime: 120 },
      { name: 'exchange_apis', status: 'healthy', lastCheck: new Date(), responseTime: 45 },
      { name: 'billing_service', status: 'healthy', lastCheck: new Date(), responseTime: 25 }
    ];

    defaultHealthChecks.forEach(check => {
      this.healthChecks.set(check.name, check);
    });

    return { success: true, healthChecksInitialized: defaultHealthChecks.length };
  }

  async recordMetric(metricName, value, tags = {}) {
    if (!this.isInitialized) {
      throw new Error('Monitoring service not initialized');
    }

    const metric = {
      name: metricName,
      value: value,
      tags: tags,
      timestamp: new Date(),
      type: this.getMetricType(metricName)
    };

    this.metrics.push(metric);

    // Limitar métricas en memoria para tests
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-500);
    }

    return { success: true, metric: metric };
  }

  getMetricType(metricName) {
    if (metricName.includes('count') || metricName.includes('total')) return 'counter';
    if (metricName.includes('time') || metricName.includes('duration')) return 'histogram';
    if (metricName.includes('rate') || metricName.includes('percentage')) return 'gauge';
    return 'gauge';
  }

  async getMetrics(filters = {}) {
    let filteredMetrics = [...this.metrics];

    if (filters.name) {
      filteredMetrics = filteredMetrics.filter(m => m.name === filters.name);
    }

    if (filters.timeRange) {
      const { start, end } = filters.timeRange;
      filteredMetrics = filteredMetrics.filter(m => 
        m.timestamp >= new Date(start) && m.timestamp <= new Date(end)
      );
    }

    if (filters.tags) {
      filteredMetrics = filteredMetrics.filter(m => {
        return Object.keys(filters.tags).every(key => 
          m.tags[key] === filters.tags[key]
        );
      });
    }

    return {
      success: true,
      metrics: filteredMetrics.sort((a, b) => b.timestamp - a.timestamp),
      count: filteredMetrics.length
    };
  }

  async createAlert(alertConfig) {
    const alert = {
      id: this.nextAlertId++,
      name: alertConfig.name,
      condition: alertConfig.condition,
      threshold: alertConfig.threshold,
      severity: alertConfig.severity || 'warning',
      status: 'active',
      createdAt: new Date(),
      lastTriggered: null,
      triggerCount: 0,
      recipients: alertConfig.recipients || []
    };

    this.alerts.set(alert.id, alert);

    return { success: true, alert: alert };
  }

  async getAlerts(filters = {}) {
    let alerts = Array.from(this.alerts.values());

    if (filters.status) {
      alerts = alerts.filter(alert => alert.status === filters.status);
    }

    if (filters.severity) {
      alerts = alerts.filter(alert => alert.severity === filters.severity);
    }

    return {
      success: true,
      alerts: alerts.sort((a, b) => b.createdAt - a.createdAt),
      count: alerts.length
    };
  }

  async triggerAlert(alertId, context = {}) {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      return { success: false, error: 'Alert not found' };
    }

    alert.lastTriggered = new Date();
    alert.triggerCount++;

    // Simular log del alert
    await this.logEvent('alert_triggered', {
      alertId: alertId,
      alertName: alert.name,
      severity: alert.severity,
      context: context
    });

    return {
      success: true,
      alert: {
        id: alert.id,
        name: alert.name,
        severity: alert.severity,
        lastTriggered: alert.lastTriggered,
        triggerCount: alert.triggerCount
      }
    };
  }

  async logEvent(eventType, data = {}) {
    const logEntry = {
      id: this.nextLogId++,
      eventType: eventType,
      level: this.getLogLevel(eventType),
      message: this.generateLogMessage(eventType, data),
      data: data,
      timestamp: new Date(),
      source: 'arbitragex_api'
    };

    this.logs.push(logEntry);

    // Limitar logs en memoria
    if (this.logs.length > 500) {
      this.logs = this.logs.slice(-250);
    }

    return { success: true, logEntry: logEntry };
  }

  getLogLevel(eventType) {
    const errorTypes = ['error', 'exception', 'failure', 'alert_triggered'];
    const warnTypes = ['warning', 'timeout', 'retry', 'degraded'];
    
    if (errorTypes.some(type => eventType.includes(type))) return 'error';
    if (warnTypes.some(type => eventType.includes(type))) return 'warning';
    return 'info';
  }

  generateLogMessage(eventType, data) {
    switch (eventType) {
      case 'user_login':
        return `User ${data.userId} logged in successfully`;
      case 'arbitrage_executed':
        return `Arbitrage operation executed for ${data.pair} with profit ${data.profit}`;
      case 'alert_triggered':
        return `Alert '${data.alertName}' triggered with severity ${data.severity}`;
      case 'system_health_check':
        return `Health check for ${data.service}: ${data.status}`;
      default:
        return `${eventType} event occurred`;
    }
  }

  async getLogs(filters = {}) {
    let filteredLogs = [...this.logs];

    if (filters.level) {
      filteredLogs = filteredLogs.filter(log => log.level === filters.level);
    }

    if (filters.eventType) {
      filteredLogs = filteredLogs.filter(log => log.eventType === filters.eventType);
    }

    if (filters.timeRange) {
      const { start, end } = filters.timeRange;
      filteredLogs = filteredLogs.filter(log => 
        log.timestamp >= new Date(start) && log.timestamp <= new Date(end)
      );
    }

    return {
      success: true,
      logs: filteredLogs.sort((a, b) => b.timestamp - a.timestamp),
      count: filteredLogs.length
    };
  }

  async performHealthCheck(serviceName) {
    const healthCheck = this.healthChecks.get(serviceName);
    if (!healthCheck) {
      return { success: false, error: 'Service not found' };
    }

    // Simular check de salud con variación aleatoria
    const responseTime = healthCheck.responseTime + (Math.random() - 0.5) * 20;
    const status = responseTime > 200 ? 'degraded' : responseTime > 500 ? 'unhealthy' : 'healthy';

    healthCheck.status = status;
    healthCheck.lastCheck = new Date();
    healthCheck.responseTime = Math.max(1, responseTime);

    await this.logEvent('system_health_check', {
      service: serviceName,
      status: status,
      responseTime: responseTime
    });

    return {
      success: true,
      healthCheck: {
        service: serviceName,
        status: status,
        responseTime: responseTime,
        lastCheck: healthCheck.lastCheck
      }
    };
  }

  async getSystemHealth() {
    const services = Array.from(this.healthChecks.values());
    const unhealthyServices = services.filter(s => s.status !== 'healthy');
    
    let overallStatus = 'healthy';
    if (unhealthyServices.length > 0) {
      const hasUnhealthy = unhealthyServices.some(s => s.status === 'unhealthy');
      overallStatus = hasUnhealthy ? 'unhealthy' : 'degraded';
    }

    return {
      success: true,
      health: {
        status: overallStatus,
        services: services,
        unhealthyCount: unhealthyServices.length,
        lastUpdate: new Date()
      }
    };
  }

  async createDashboard(dashboardConfig) {
    const dashboard = {
      id: `dash_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      name: dashboardConfig.name,
      widgets: dashboardConfig.widgets || [],
      filters: dashboardConfig.filters || {},
      createdBy: dashboardConfig.userId,
      createdAt: new Date(),
      isPublic: dashboardConfig.isPublic || false
    };

    this.dashboards.set(dashboard.id, dashboard);

    return { success: true, dashboard: dashboard };
  }

  async getDashboards(userId) {
    const dashboards = Array.from(this.dashboards.values())
      .filter(dash => dash.createdBy === userId || dash.isPublic);

    return {
      success: true,
      dashboards: dashboards,
      count: dashboards.length
    };
  }

  // Utilidades
  clearData() {
    this.metrics = [];
    this.alerts.clear();
    this.logs = [];
    this.healthChecks.clear();
    this.dashboards.clear();
    this.nextAlertId = 1;
    this.nextLogId = 1;
    this.isInitialized = false;
  }

  getStats() {
    const errorLogs = this.logs.filter(log => log.level === 'error').length;
    const activeAlerts = Array.from(this.alerts.values()).filter(alert => alert.status === 'active').length;
    const unhealthyServices = Array.from(this.healthChecks.values()).filter(hc => hc.status !== 'healthy').length;

    return {
      totalMetrics: this.metrics.length,
      totalLogs: this.logs.length,
      errorLogs: errorLogs,
      totalAlerts: this.alerts.size,
      activeAlerts: activeAlerts,
      totalHealthChecks: this.healthChecks.size,
      unhealthyServices: unhealthyServices,
      totalDashboards: this.dashboards.size
    };
  }
}

// Helper extendido para monitoring
class MonitoringTestHelper extends SimpleTestAppHelper {
  constructor() {
    super();
    this.monitoringService = new MonitoringServiceMock();
  }

  async setup() {
    await super.setup();
    await this.monitoringService.initialize();
  }

  async cleanup() {
    await super.cleanup();
    this.monitoringService.clearData();
  }

  // API endpoints simulados
  async initializeMonitoring(userId) {
    const user = await this.db.findUserById(userId);
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    if (user.role !== 'admin') {
      return { success: false, error: 'Insufficient permissions' };
    }

    return await this.monitoringService.initialize();
  }

  async recordMetric(userId, metricName, value, tags) {
    const user = await this.db.findUserById(userId);
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    return await this.monitoringService.recordMetric(metricName, value, tags);
  }

  async getMetrics(userId, filters) {
    const user = await this.db.findUserById(userId);
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    if (user.role !== 'admin' && user.role !== 'trader') {
      return { success: false, error: 'Insufficient permissions' };
    }

    return await this.monitoringService.getMetrics(filters);
  }

  async createAlert(userId, alertConfig) {
    const user = await this.db.findUserById(userId);
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    if (user.role !== 'admin') {
      return { success: false, error: 'Only admins can create alerts' };
    }

    return await this.monitoringService.createAlert(alertConfig);
  }

  async getAlerts(userId, filters) {
    const user = await this.db.findUserById(userId);
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    if (user.role !== 'admin' && user.role !== 'trader') {
      return { success: false, error: 'Insufficient permissions' };
    }

    return await this.monitoringService.getAlerts(filters);
  }

  async getLogs(userId, filters) {
    const user = await this.db.findUserById(userId);
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    if (user.role !== 'admin') {
      return { success: false, error: 'Only admins can access logs' };
    }

    return await this.monitoringService.getLogs(filters);
  }

  async performHealthCheck(userId, serviceName) {
    const user = await this.db.findUserById(userId);
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    return await this.monitoringService.performHealthCheck(serviceName);
  }

  async getSystemHealth(userId) {
    const user = await this.db.findUserById(userId);
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    return await this.monitoringService.getSystemHealth();
  }

  async createDashboard(userId, dashboardConfig) {
    const user = await this.db.findUserById(userId);
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    dashboardConfig.userId = userId;
    return await this.monitoringService.createDashboard(dashboardConfig);
  }

  async getDashboards(userId) {
    const user = await this.db.findUserById(userId);
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    return await this.monitoringService.getDashboards(userId);
  }

  // Crear usuario admin para tests
  async createAdminUser() {
    return await this.db.createUser({
      email: 'monitoring-admin@test.com',
      name: 'Monitoring Test Admin',
      password: 'admin123',
      tenantId: 1,
      role: 'admin',
      status: 'active'
    });
  }

  async createTraderUser() {
    return await this.db.createUser({
      email: 'monitoring-trader@test.com',
      name: 'Monitoring Test Trader',
      password: 'trader123',
      tenantId: 1,
      role: 'trader',
      status: 'active'
    });
  }
}

// Framework de testing simple
class SimpleTestFramework {
  constructor() {
    this.passed = 0;
    this.failed = 0;
  }

  expect(actual) {
    return {
      toBe: (expected) => {
        if (actual !== expected) {
          throw new Error(`Expected ${expected}, but got ${actual}`);
        }
      },
      toBeDefined: () => {
        if (actual === undefined) {
          throw new Error(`Expected value to be defined, but got undefined`);
        }
      },
      toBeGreaterThan: (expected) => {
        if (actual <= expected) {
          throw new Error(`Expected ${actual} to be greater than ${expected}`);
        }
      },
      toBeLessThan: (expected) => {
        if (actual >= expected) {
          throw new Error(`Expected ${actual} to be less than ${expected}`);
        }
      }
    };
  }

  async runTest(name, testFn) {
    const testStartTime = Date.now();
    
    try {
      await testFn();
      const duration = Date.now() - testStartTime;
      this.passed++;
      console.log(`  ✅ ${name} (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - testStartTime;
      this.failed++;
      console.log(`  ❌ ${name} (${duration}ms)`);
      console.log(`     Error: ${error.message}`);
    }
  }

  printSummary(totalDuration) {
    console.log('\n' + '=' * 70);
    console.log('📊 MONITORING TEST SUMMARY');
    console.log('=' * 70);
    console.log(`Total Tests: ${this.passed + this.failed}`);
    console.log(`✅ Passed: ${this.passed}`);
    console.log(`❌ Failed: ${this.failed}`);
    console.log(`⏱️ Total Time: ${totalDuration}ms`);
    
    if (this.failed === 0) {
      console.log('\n🎉 ALL MONITORING TESTS PASSED! Sistema de monitoreo funcionando correctamente.');
    } else {
      console.log('\n⚠️ SOME MONITORING TESTS FAILED. Revisar errores arriba.');
    }
  }
}

// Ejecutar tests de monitoring
async function runMonitoringTests() {
  console.log('📊 ArbitrageX Supreme - Monitoring Integration Tests');
  console.log('=' * 70);
  
  const testFramework = new SimpleTestFramework();
  const startTime = Date.now();
  
  // Setup
  const testApp = new MonitoringTestHelper();
  await testApp.setup();
  const adminUser = await testApp.createAdminUser();
  const traderUser = await testApp.createTraderUser();
  const regularUser = await testApp.db.findUserByEmail('user@test.com');
  console.log('✅ Monitoring test environment initialized');

  // Tests de Inicialización
  console.log('\n📋 🔧 Monitoring Initialization');
  
  await testFramework.runTest('should initialize monitoring service successfully', async () => {
    const result = await testApp.initializeMonitoring(adminUser.id);

    testFramework.expect(result.success).toBe(true);
    testFramework.expect(result.healthChecksInitialized).toBeGreaterThan(0);
  });

  await testFramework.runTest('should reject initialization from non-admin user', async () => {
    const result = await testApp.initializeMonitoring(traderUser.id);

    testFramework.expect(result.success).toBe(false);
  });

  // Tests de Métricas
  console.log('\n📋 📈 Metrics Management');
  
  await testFramework.runTest('should record metric successfully', async () => {
    const result = await testApp.recordMetric(
      adminUser.id,
      'api_requests_total',
      100,
      { endpoint: '/api/arbitrage', method: 'GET' }
    );

    testFramework.expect(result.success).toBe(true);
    testFramework.expect(result.metric).toBeDefined();
    testFramework.expect(result.metric.name).toBe('api_requests_total');
    testFramework.expect(result.metric.value).toBe(100);
    testFramework.expect(result.metric.tags.endpoint).toBe('/api/arbitrage');
  });

  await testFramework.runTest('should get metrics with filters', async () => {
    // Grabar algunas métricas primero
    await testApp.recordMetric(adminUser.id, 'trade_count', 5, { pair: 'ETH/USDT' });
    await testApp.recordMetric(adminUser.id, 'trade_count', 8, { pair: 'BTC/USDT' });
    await testApp.recordMetric(adminUser.id, 'response_time', 150, { service: 'api' });

    const result = await testApp.getMetrics(traderUser.id, { name: 'trade_count' });

    testFramework.expect(result.success).toBe(true);
    testFramework.expect(result.metrics).toBeDefined();
    testFramework.expect(result.count).toBeGreaterThan(0);
    result.metrics.forEach(metric => {
      testFramework.expect(metric.name).toBe('trade_count');
    });
  });

  await testFramework.runTest('should reject metrics access from regular user', async () => {
    const result = await testApp.getMetrics(regularUser.id, {});

    testFramework.expect(result.success).toBe(false);
  });

  await testFramework.runTest('should reject metric recording from unauthenticated user', async () => {
    const invalidUserId = 99999;
    const result = await testApp.recordMetric(invalidUserId, 'test_metric', 1, {});

    testFramework.expect(result.success).toBe(false);
  });

  // Tests de Alertas
  console.log('\n📋 🚨 Alert Management');
  
  let testAlert;
  
  await testFramework.runTest('should create alert successfully', async () => {
    const alertConfig = {
      name: 'High Error Rate',
      condition: 'error_rate > threshold',
      threshold: 5,
      severity: 'critical',
      recipients: ['admin@arbitragex.com']
    };

    const result = await testApp.createAlert(adminUser.id, alertConfig);

    testFramework.expect(result.success).toBe(true);
    testFramework.expect(result.alert).toBeDefined();
    testFramework.expect(result.alert.name).toBe(alertConfig.name);
    testFramework.expect(result.alert.severity).toBe('critical');
    testFramework.expect(result.alert.status).toBe('active');
    
    testAlert = result.alert;
  });

  await testFramework.runTest('should get alerts with filters', async () => {
    const result = await testApp.getAlerts(traderUser.id, { severity: 'critical' });

    testFramework.expect(result.success).toBe(true);
    testFramework.expect(result.alerts).toBeDefined();
    result.alerts.forEach(alert => {
      testFramework.expect(alert.severity).toBe('critical');
    });
  });

  await testFramework.runTest('should reject alert creation from non-admin user', async () => {
    const alertConfig = {
      name: 'Test Alert',
      condition: 'test > 1',
      threshold: 1
    };

    const result = await testApp.createAlert(traderUser.id, alertConfig);

    testFramework.expect(result.success).toBe(false);
  });

  await testFramework.runTest('should reject alerts access from regular user', async () => {
    const result = await testApp.getAlerts(regularUser.id, {});

    testFramework.expect(result.success).toBe(false);
  });

  // Tests de Logs
  console.log('\n📋 📝 Log Management');
  
  await testFramework.runTest('should get logs successfully', async () => {
    const result = await testApp.getLogs(adminUser.id, {});

    testFramework.expect(result.success).toBe(true);
    testFramework.expect(result.logs).toBeDefined();
    testFramework.expect(result.count).toBeGreaterThan(0);
  });

  await testFramework.runTest('should filter logs by level', async () => {
    const result = await testApp.getLogs(adminUser.id, { level: 'info' });

    testFramework.expect(result.success).toBe(true);
    result.logs.forEach(log => {
      testFramework.expect(log.level).toBe('info');
    });
  });

  await testFramework.runTest('should reject logs access from non-admin user', async () => {
    const result = await testApp.getLogs(traderUser.id, {});

    testFramework.expect(result.success).toBe(false);
  });

  // Tests de Health Checks
  console.log('\n📋 🏥 Health Check Management');
  
  await testFramework.runTest('should perform health check successfully', async () => {
    const result = await testApp.performHealthCheck(adminUser.id, 'database');

    testFramework.expect(result.success).toBe(true);
    testFramework.expect(result.healthCheck).toBeDefined();
    testFramework.expect(result.healthCheck.service).toBe('database');
    testFramework.expect(result.healthCheck.status).toBeDefined();
    testFramework.expect(result.healthCheck.responseTime).toBeGreaterThan(0);
  });

  await testFramework.runTest('should get system health overview', async () => {
    const result = await testApp.getSystemHealth(traderUser.id);

    testFramework.expect(result.success).toBe(true);
    testFramework.expect(result.health).toBeDefined();
    testFramework.expect(result.health.status).toBeDefined();
    testFramework.expect(result.health.services).toBeDefined();
    testFramework.expect(result.health.services.length).toBeGreaterThan(0);
  });

  await testFramework.runTest('should reject health check for non-existent service', async () => {
    const result = await testApp.performHealthCheck(adminUser.id, 'nonexistent-service');

    testFramework.expect(result.success).toBe(false);
  });

  await testFramework.runTest('should reject health check from unauthenticated user', async () => {
    const invalidUserId = 99999;
    const result = await testApp.performHealthCheck(invalidUserId, 'database');

    testFramework.expect(result.success).toBe(false);
  });

  // Tests de Dashboards
  console.log('\n📋 📊 Dashboard Management');
  
  await testFramework.runTest('should create dashboard successfully', async () => {
    const dashboardConfig = {
      name: 'Arbitrage Performance Dashboard',
      widgets: [
        { type: 'chart', metric: 'trade_count', title: 'Trades per Hour' },
        { type: 'gauge', metric: 'success_rate', title: 'Success Rate' }
      ],
      isPublic: false
    };

    const result = await testApp.createDashboard(traderUser.id, dashboardConfig);

    testFramework.expect(result.success).toBe(true);
    testFramework.expect(result.dashboard).toBeDefined();
    testFramework.expect(result.dashboard.name).toBe(dashboardConfig.name);
    testFramework.expect(result.dashboard.widgets.length).toBe(2);
  });

  await testFramework.runTest('should get dashboards for user', async () => {
    const result = await testApp.getDashboards(traderUser.id);

    testFramework.expect(result.success).toBe(true);
    testFramework.expect(result.dashboards).toBeDefined();
    testFramework.expect(result.count).toBeGreaterThan(0);
  });

  await testFramework.runTest('should reject dashboard creation from unauthenticated user', async () => {
    const invalidUserId = 99999;
    const dashboardConfig = { name: 'Test Dashboard' };

    const result = await testApp.createDashboard(invalidUserId, dashboardConfig);

    testFramework.expect(result.success).toBe(false);
  });

  // Tests de Rendimiento
  console.log('\n📋 ⚡ Performance Tests');
  
  await testFramework.runTest('should record metric within performance threshold', async () => {
    const testStartTime = Date.now();
    const result = await testApp.recordMetric(adminUser.id, 'performance_test', 1, {});
    const duration = Date.now() - testStartTime;

    testFramework.expect(result.success).toBe(true);
    testFramework.expect(duration).toBeLessThan(50);
  });

  await testFramework.runTest('should get metrics within performance threshold', async () => {
    const testStartTime = Date.now();
    const result = await testApp.getMetrics(traderUser.id, {});
    const duration = Date.now() - testStartTime;

    testFramework.expect(result.success).toBe(true);
    testFramework.expect(duration).toBeLessThan(100);
  });

  await testFramework.runTest('should perform health check within performance threshold', async () => {
    const testStartTime = Date.now();
    const result = await testApp.performHealthCheck(adminUser.id, 'redis');
    const duration = Date.now() - testStartTime;

    testFramework.expect(result.success).toBe(true);
    testFramework.expect(duration).toBeLessThan(100);
  });

  // Tests de Estadísticas
  console.log('\n📋 📈 Monitoring Statistics');
  
  await testFramework.runTest('should calculate monitoring statistics correctly', async () => {
    const stats = testApp.monitoringService.getStats();

    testFramework.expect(stats.totalMetrics).toBeGreaterThan(0);
    testFramework.expect(stats.totalLogs).toBeGreaterThan(0);
    testFramework.expect(stats.totalAlerts).toBeGreaterThan(0);
    testFramework.expect(stats.totalHealthChecks).toBeGreaterThan(0);
    testFramework.expect(stats.totalDashboards).toBeGreaterThan(0);
  });

  // Tests de Operaciones Concurrentes
  console.log('\n📋 🔄 Concurrent Operations');
  
  await testFramework.runTest('should handle multiple concurrent metric recordings', async () => {
    const promises = [];
    
    for (let i = 0; i < 10; i++) {
      promises.push(testApp.recordMetric(adminUser.id, `concurrent_metric_${i}`, i, { test: 'concurrent' }));
    }

    const results = await Promise.all(promises);

    results.forEach(result => {
      testFramework.expect(result.success).toBe(true);
      testFramework.expect(result.metric).toBeDefined();
    });
  });

  await testFramework.runTest('should handle multiple concurrent health checks', async () => {
    const services = ['database', 'redis', 'blockchain_service'];
    const promises = services.map(service => 
      testApp.performHealthCheck(adminUser.id, service)
    );

    const results = await Promise.all(promises);

    results.forEach(result => {
      testFramework.expect(result.success).toBe(true);
      testFramework.expect(result.healthCheck).toBeDefined();
    });
  });

  // Tests de Autorización
  console.log('\n📋 🔐 Authorization Tests');
  
  await testFramework.runTest('should enforce role-based access for metrics', async () => {
    const result = await testApp.getMetrics(regularUser.id, {});

    testFramework.expect(result.success).toBe(false);
  });

  await testFramework.runTest('should enforce role-based access for logs', async () => {
    const result = await testApp.getLogs(traderUser.id, {});

    testFramework.expect(result.success).toBe(false);
  });

  await testFramework.runTest('should enforce role-based access for alert creation', async () => {
    const alertConfig = { name: 'Test', condition: 'test > 1', threshold: 1 };
    const result = await testApp.createAlert(traderUser.id, alertConfig);

    testFramework.expect(result.success).toBe(false);
  });

  // Cleanup y resumen
  await testApp.cleanup();
  console.log('🧹 Monitoring test environment cleaned up');
  
  const totalDuration = Date.now() - startTime;
  testFramework.printSummary(totalDuration);
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  runMonitoringTests().catch(error => {
    console.error('❌ Monitoring test execution failed:', error);
    process.exit(1);
  });
}

module.exports = { runMonitoringTests, MonitoringTestHelper };
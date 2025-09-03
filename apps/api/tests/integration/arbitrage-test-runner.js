/**
 * Arbitrage Test Runner - ArbitrageX Supreme
 * Test runner específico para endpoints de arbitraje
 * Metodología del Ingenio Pichichi S.A.
 */

const { ArbitrageTestHelper } = require('./arbitrage.integration.test');

// Framework de testing simple
class SimpleTestFramework {
  constructor() {
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
    this.results = [];
    this.currentSuite = '';
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

  test(name, testFn) {
    this.tests.push({ name, testFn, suite: this.currentSuite });
  }

  describe(suiteName, suiteFn) {
    this.currentSuite = suiteName;
    console.log(`\n📋 ${suiteName}`);
    suiteFn();
  }

  async runAll() {
    console.log('⚡ ArbitrageX Supreme - Arbitrage Integration Tests');
    console.log('=' * 70);
    
    const startTime = Date.now();

    for (const test of this.tests) {
      await this.runTest(test);
    }

    const duration = Date.now() - startTime;
    this.printSummary(duration);
  }

  async runTest(test) {
    const testStartTime = Date.now();
    
    try {
      await test.testFn();
      const duration = Date.now() - testStartTime;
      
      this.passed++;
      this.results.push({
        name: test.name,
        suite: test.suite,
        status: 'PASSED',
        duration: duration,
        error: null
      });
      
      console.log(`  ✅ ${test.name} (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - testStartTime;
      
      this.failed++;
      this.results.push({
        name: test.name,
        suite: test.suite,
        status: 'FAILED',
        duration: duration,
        error: error.message
      });
      
      console.log(`  ❌ ${test.name} (${duration}ms)`);
      console.log(`     Error: ${error.message}`);
    }
  }

  printSummary(totalDuration) {
    console.log('\n' + '=' * 70);
    console.log('📊 ARBITRAGE TEST SUMMARY');
    console.log('=' * 70);
    console.log(`Total Tests: ${this.tests.length}`);
    console.log(`✅ Passed: ${this.passed}`);
    console.log(`❌ Failed: ${this.failed}`);
    console.log(`⏱️ Total Time: ${totalDuration}ms`);
    
    if (this.failed === 0) {
      console.log('\n🎉 ALL ARBITRAGE TESTS PASSED! Sistema de arbitraje funcionando correctamente.');
    } else {
      console.log('\n⚠️ SOME ARBITRAGE TESTS FAILED. Revisar errores arriba.');
    }

    // Mostrar estadísticas por suite
    const suites = {};
    this.results.forEach(result => {
      if (!suites[result.suite]) {
        suites[result.suite] = { passed: 0, failed: 0, total: 0 };
      }
      suites[result.suite].total++;
      if (result.status === 'PASSED') {
        suites[result.suite].passed++;
      } else {
        suites[result.suite].failed++;
      }
    });

    console.log('\n📈 RESULTS BY SUITE:');
    Object.keys(suites).forEach(suiteName => {
      const suite = suites[suiteName];
      const percentage = Math.round((suite.passed / suite.total) * 100);
      console.log(`  ${suiteName}: ${suite.passed}/${suite.total} (${percentage}%)`);
    });
  }
}

// Crear instancia global
const testFramework = new SimpleTestFramework();
global.expect = testFramework.expect.bind(testFramework);
global.test = testFramework.test.bind(testFramework);
global.describe = testFramework.describe.bind(testFramework);

// Tests de Integración de Arbitraje
async function runArbitrageTests() {
  let testApp;
  let traderUser;

  // Setup
  testApp = new ArbitrageTestHelper();
  await testApp.setup();
  traderUser = await testApp.createTraderUser();
  console.log('✅ Arbitrage test environment initialized');

  // Tests de Escaneo de Oportunidades
  describe('🔍 Opportunity Scanning', () => {
    test('should scan for arbitrage opportunities successfully', async () => {
      const scanParams = {
        pairs: ['ETH/USDT', 'BTC/USDT'],
        minProfitPercentage: 1.0,
        maxRisk: 'medium'
      };

      const result = await testApp.scanOpportunities(traderUser.id, scanParams);

      expect(result.success).toBe(true);
      expect(result.opportunities).toBeDefined();
      expect(result.count).toBeGreaterThan(0);
      expect(result.scanTime).toBeDefined();

      if (result.opportunities.length > 0) {
        const opp = result.opportunities[0];
        expect(opp.pair).toBeDefined();
        expect(opp.buyExchange).toBeDefined();
        expect(opp.sellExchange).toBeDefined();
        expect(opp.buyPrice).toBeGreaterThan(0);
        expect(opp.sellPrice).toBeGreaterThan(0);
        expect(opp.profitPercentage).toBeGreaterThan(1.0);
      }
    });

    test('should filter opportunities by minimum profit percentage', async () => {
      const scanParams = {
        pairs: ['ETH/USDT'],
        minProfitPercentage: 5.0
      };

      const result = await testApp.scanOpportunities(traderUser.id, scanParams);

      expect(result.success).toBe(true);
      result.opportunities.forEach(opp => {
        expect(opp.profitPercentage).toBeGreaterThan(5.0);
      });
    });

    test('should reject scan request from unauthenticated user', async () => {
      const invalidUserId = 99999;
      const scanParams = { pairs: ['ETH/USDT'] };

      const result = await testApp.scanOpportunities(invalidUserId, scanParams);

      expect(result.success).toBe(false);
    });
  });

  // Tests de Ejecución de Arbitraje
  describe('🎯 Arbitrage Execution', () => {
    test('should execute arbitrage opportunity successfully', async () => {
      const scanResult = await testApp.scanOpportunities(traderUser.id, {
        pairs: ['ETH/USDT'],
        minProfitPercentage: 1.0
      });
      expect(scanResult.success).toBe(true);
      expect(scanResult.opportunities.length).toBeGreaterThan(0);

      const opportunity = scanResult.opportunities[0];
      const executionParams = {
        amount: Math.min(5, opportunity.volume * 0.5)
      };

      const result = await testApp.executeArbitrage(traderUser.id, opportunity.id, executionParams);

      expect(result.success).toBe(true);
      expect(result.execution).toBeDefined();
      expect(result.execution.profit).toBeGreaterThan(0);
      expect(result.netProfit).toBeDefined();
    });

    test('should reject execution with invalid amount', async () => {
      const scanResult = await testApp.scanOpportunities(traderUser.id, { pairs: ['ETH/USDT'] });
      const opportunity = scanResult.opportunities[0];
      
      const invalidParams = { amount: -5 };

      const result = await testApp.executeArbitrage(traderUser.id, opportunity.id, invalidParams);

      expect(result.success).toBe(false);
    });

    test('should reject execution from user without trader permissions', async () => {
      const regularUser = await testApp.db.findUserByEmail('user@test.com');
      const scanResult = await testApp.scanOpportunities(traderUser.id, { pairs: ['ETH/USDT'] });
      const opportunity = scanResult.opportunities[0];

      const result = await testApp.executeArbitrage(regularUser.id, opportunity.id, { amount: 1 });

      expect(result.success).toBe(false);
    });
  });

  // Tests de Historial de Ejecución
  describe('📊 Execution History', () => {
    test('should retrieve arbitrage execution history', async () => {
      const scanResult = await testApp.scanOpportunities(traderUser.id, { pairs: ['ETH/USDT'] });
      const opportunity = scanResult.opportunities[0];
      
      await testApp.executeArbitrage(traderUser.id, opportunity.id, { amount: 1 });

      const result = await testApp.getArbitrageHistory(traderUser.id, {});

      expect(result.success).toBe(true);
      expect(result.executions).toBeDefined();
      expect(result.count).toBeGreaterThan(0);
    });

    test('should filter history by status', async () => {
      const filters = { status: 'completed' };

      const result = await testApp.getArbitrageHistory(traderUser.id, filters);

      expect(result.success).toBe(true);
      result.executions.forEach(execution => {
        expect(execution.status).toBe('completed');
      });
    });

    test('should reject history request from unauthenticated user', async () => {
      const invalidUserId = 99999;

      const result = await testApp.getArbitrageHistory(invalidUserId, {});

      expect(result.success).toBe(false);
    });
  });

  // Tests de Evaluación de Riesgo
  describe('🛡️ Risk Assessment', () => {
    test('should provide risk assessment for opportunity', async () => {
      const scanResult = await testApp.scanOpportunities(traderUser.id, { pairs: ['ETH/USDT'] });
      const opportunity = scanResult.opportunities[0];

      const result = await testApp.getRiskAssessment(traderUser.id, opportunity.id);

      expect(result.success).toBe(true);
      expect(result.assessment).toBeDefined();
      expect(result.assessment.riskLevel).toBeDefined();
      expect(result.assessment.recommendation).toBeDefined();
      expect(result.assessment.maxRecommendedAmount).toBeGreaterThan(0);
    });

    test('should reject risk assessment for non-existent opportunity', async () => {
      const invalidOpportunityId = 99999;

      const result = await testApp.getRiskAssessment(traderUser.id, invalidOpportunityId);

      expect(result.success).toBe(false);
    });
  });

  // Tests de Rendimiento
  describe('⚡ Performance Tests', () => {
    test('should scan opportunities within performance threshold', async () => {
      const scanParams = { pairs: ['ETH/USDT', 'BTC/USDT'] };
      const startTime = Date.now();

      const result = await testApp.scanOpportunities(traderUser.id, scanParams);
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(200);
    });

    test('should execute arbitrage within performance threshold', async () => {
      const scanResult = await testApp.scanOpportunities(traderUser.id, { pairs: ['ETH/USDT'] });
      const opportunity = scanResult.opportunities[0];
      const startTime = Date.now();

      const result = await testApp.executeArbitrage(traderUser.id, opportunity.id, { amount: 1 });
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(300);
    });
  });

  // Tests de Estadísticas
  describe('📈 Statistics and Metrics', () => {
    test('should calculate arbitrage statistics correctly', async () => {
      const scanResult = await testApp.scanOpportunities(traderUser.id, { pairs: ['ETH/USDT'] });
      
      for (let i = 0; i < 3; i++) {
        if (scanResult.opportunities[i]) {
          await testApp.executeArbitrage(traderUser.id, scanResult.opportunities[i].id, { amount: 1 });
        }
      }

      const stats = testApp.arbitrageService.getStats();

      expect(stats.totalOpportunities).toBeGreaterThan(0);
      expect(stats.totalExecutions).toBeGreaterThan(0);
      expect(stats.totalProfit).toBeGreaterThan(0);
      expect(stats.averageProfit).toBeGreaterThan(0);
    });
  });

  // Tests de Operaciones Concurrentes
  describe('🔄 Concurrent Operations', () => {
    test('should handle multiple concurrent opportunity scans', async () => {
      const scanParams = { pairs: ['ETH/USDT'] };
      const promises = [];

      for (let i = 0; i < 5; i++) {
        promises.push(testApp.scanOpportunities(traderUser.id, scanParams));
      }

      const results = await Promise.all(promises);

      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.opportunities).toBeDefined();
      });
    });
  });

  // Ejecutar todos los tests
  await testFramework.runAll();

  // Cleanup
  await testApp.cleanup();
  console.log('🧹 Arbitrage test environment cleaned up');
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  runArbitrageTests().catch(error => {
    console.error('❌ Arbitrage test execution failed:', error);
    process.exit(1);
  });
}

module.exports = { runArbitrageTests };
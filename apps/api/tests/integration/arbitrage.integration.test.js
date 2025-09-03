/**
 * Integration Tests - Arbitrage API Endpoints
 * ArbitrageX Supreme Enterprise - Ingenio Pichichi S.A.
 * 
 * Tests metodológicos para endpoints de arbitraje siguiendo las mejores prácticas
 */

const { SimpleTestAppHelper } = require('./helpers/simple-app-helper');

// Mock extendido para operaciones de arbitraje
class ArbitrageServiceMock {
  constructor() {
    this.opportunities = new Map();
    this.executions = new Map();
    this.nextOpportunityId = 1;
    this.nextExecutionId = 1;
    this.isEnabled = true;
  }

  // Gestión de oportunidades
  async scanForOpportunities(params) {
    if (!this.isEnabled) {
      throw new Error('Arbitrage service disabled');
    }

    const opportunities = [];
    const pairs = params.pairs || ['ETH/USDT', 'BTC/USDT'];
    
    for (const pair of pairs) {
      const opportunity = {
        id: this.nextOpportunityId++,
        pair: pair,
        buyExchange: 'binance',
        sellExchange: 'coinbase',
        buyPrice: 2000 + Math.random() * 100,
        sellPrice: 2050 + Math.random() * 100,
        profit: 50 + Math.random() * 50,
        profitPercentage: 2.5 + Math.random() * 2,
        volume: 10 + Math.random() * 90,
        risk: Math.random() < 0.7 ? 'low' : 'medium',
        timestamp: new Date(),
        expires: new Date(Date.now() + 5 * 60 * 1000) // 5 minutos
      };
      
      // Solo incluir si es rentable
      if (opportunity.profitPercentage >= params.minProfitPercentage) {
        opportunities.push(opportunity);
        this.opportunities.set(opportunity.id, opportunity);
      }
    }

    return {
      success: true,
      opportunities: opportunities,
      count: opportunities.length,
      scanTime: Date.now()
    };
  }

  async executeArbitrage(opportunityId, executionParams) {
    const opportunity = this.opportunities.get(opportunityId);
    if (!opportunity) {
      return {
        success: false,
        error: 'Opportunity not found or expired'
      };
    }

    if (new Date() > opportunity.expires) {
      return {
        success: false,
        error: 'Opportunity expired'
      };
    }

    // Simular validaciones
    if (executionParams.amount <= 0) {
      return {
        success: false,
        error: 'Invalid amount'
      };
    }

    if (executionParams.amount > opportunity.volume) {
      return {
        success: false,
        error: 'Amount exceeds available volume'
      };
    }

    // Simular ejecución
    const execution = {
      id: this.nextExecutionId++,
      opportunityId: opportunityId,
      amount: executionParams.amount,
      buyOrder: {
        exchange: opportunity.buyExchange,
        price: opportunity.buyPrice,
        amount: executionParams.amount,
        status: 'filled'
      },
      sellOrder: {
        exchange: opportunity.sellExchange,
        price: opportunity.sellPrice,
        amount: executionParams.amount,
        status: 'filled'
      },
      profit: (opportunity.sellPrice - opportunity.buyPrice) * executionParams.amount,
      status: 'completed',
      executedAt: new Date(),
      fees: {
        buy: opportunity.buyPrice * executionParams.amount * 0.001,
        sell: opportunity.sellPrice * executionParams.amount * 0.001
      }
    };

    this.executions.set(execution.id, execution);

    return {
      success: true,
      execution: execution,
      netProfit: execution.profit - execution.fees.buy - execution.fees.sell
    };
  }

  async getExecutionHistory(userId, filters = {}) {
    const executions = Array.from(this.executions.values());
    
    let filtered = executions;
    
    if (filters.status) {
      filtered = filtered.filter(ex => ex.status === filters.status);
    }
    
    if (filters.pair) {
      filtered = filtered.filter(ex => {
        const opportunity = this.opportunities.get(ex.opportunityId);
        return opportunity && opportunity.pair === filters.pair;
      });
    }

    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom);
      filtered = filtered.filter(ex => ex.executedAt >= from);
    }

    return {
      success: true,
      executions: filtered.sort((a, b) => b.executedAt - a.executedAt),
      count: filtered.length
    };
  }

  async getRiskAssessment(opportunityId) {
    const opportunity = this.opportunities.get(opportunityId);
    if (!opportunity) {
      return {
        success: false,
        error: 'Opportunity not found'
      };
    }

    const assessment = {
      opportunityId: opportunityId,
      riskLevel: opportunity.risk,
      factors: {
        priceVolatility: Math.random() * 10,
        liquidityRisk: Math.random() * 5,
        exchangeRisk: Math.random() * 3,
        executionRisk: Math.random() * 4
      },
      recommendation: opportunity.risk === 'low' ? 'execute' : 'caution',
      maxRecommendedAmount: opportunity.volume * 0.8,
      confidence: 0.75 + Math.random() * 0.2
    };

    return {
      success: true,
      assessment: assessment
    };
  }

  // Utilidades
  setServiceEnabled(enabled) {
    this.isEnabled = enabled;
  }

  clearData() {
    this.opportunities.clear();
    this.executions.clear();
    this.nextOpportunityId = 1;
    this.nextExecutionId = 1;
  }

  getStats() {
    const executions = Array.from(this.executions.values());
    const completedExecutions = executions.filter(ex => ex.status === 'completed');
    
    return {
      totalOpportunities: this.opportunities.size,
      totalExecutions: this.executions.size,
      completedExecutions: completedExecutions.length,
      totalProfit: completedExecutions.reduce((sum, ex) => sum + ex.profit, 0),
      averageProfit: completedExecutions.length > 0 
        ? completedExecutions.reduce((sum, ex) => sum + ex.profit, 0) / completedExecutions.length 
        : 0
    };
  }
}

// Helper extendido para tests de arbitraje
class ArbitrageTestHelper extends SimpleTestAppHelper {
  constructor() {
    super();
    this.arbitrageService = new ArbitrageServiceMock();
  }

  async setup() {
    await super.setup();
    this.arbitrageService.setServiceEnabled(true);
  }

  async cleanup() {
    await super.cleanup();
    this.arbitrageService.clearData();
  }

  // API endpoints simulados
  async scanOpportunities(userId, scanParams) {
    // Validar autenticación
    const user = await this.db.findUserById(userId);
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    return await this.arbitrageService.scanForOpportunities(scanParams);
  }

  async executeArbitrage(userId, opportunityId, executionParams) {
    // Validar autenticación y permisos
    const user = await this.db.findUserById(userId);
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    if (user.role !== 'trader' && user.role !== 'admin') {
      return { success: false, error: 'Insufficient permissions' };
    }

    return await this.arbitrageService.executeArbitrage(opportunityId, executionParams);
  }

  async getArbitrageHistory(userId, filters) {
    const user = await this.db.findUserById(userId);
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    return await this.arbitrageService.getExecutionHistory(userId, filters);
  }

  async getRiskAssessment(userId, opportunityId) {
    const user = await this.db.findUserById(userId);
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    return await this.arbitrageService.getRiskAssessment(opportunityId);
  }

  // Configurar usuario trader para tests
  async createTraderUser() {
    const traderUser = await this.db.createUser({
      email: 'trader@test.com',
      name: 'Test Trader',
      password: 'trader123',
      tenantId: 1,
      role: 'trader',
      status: 'active'
    });

    return traderUser;
  }
}

describe('⚡ Arbitrage Integration Tests', () => {
  let testApp;
  let traderUser;
  let startTime;

  beforeAll(async () => {
    testApp = new ArbitrageTestHelper();
    await testApp.setup();
    traderUser = await testApp.createTraderUser();
    console.log('✅ Arbitrage test environment initialized');
  });

  afterAll(async () => {
    if (testApp) {
      await testApp.cleanup();
      console.log('🧹 Arbitrage test environment cleaned up');
    }
  });

  beforeEach(() => {
    startTime = Date.now();
  });

  afterEach(() => {
    const duration = Date.now() - startTime;
    console.log(`⏱️ Test completed in ${duration}ms`);
  });

  describe('🔍 Opportunity Scanning', () => {
    test('should scan for arbitrage opportunities successfully', async () => {
      // Arrange
      const scanParams = {
        pairs: ['ETH/USDT', 'BTC/USDT'],
        minProfitPercentage: 1.0,
        maxRisk: 'medium'
      };

      // Act
      const result = await testApp.scanOpportunities(traderUser.id, scanParams);

      // Assert
      expect(result.success).toBe(true);
      expect(result.opportunities).toBeDefined();
      expect(result.count).toBeGreaterThan(0);
      expect(result.scanTime).toBeDefined();
      
      // Verificar estructura de oportunidades
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
      // Arrange
      const scanParams = {
        pairs: ['ETH/USDT'],
        minProfitPercentage: 5.0 // Alto porcentaje para filtrar
      };

      // Act
      const result = await testApp.scanOpportunities(traderUser.id, scanParams);

      // Assert
      expect(result.success).toBe(true);
      result.opportunities.forEach(opp => {
        expect(opp.profitPercentage).toBeGreaterThan(5.0);
      });
    });

    test('should reject scan request from unauthenticated user', async () => {
      // Arrange
      const invalidUserId = 99999;
      const scanParams = { pairs: ['ETH/USDT'] };

      // Act
      const result = await testApp.scanOpportunities(invalidUserId, scanParams);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('User not authenticated');
    });

    test('should handle service unavailability gracefully', async () => {
      // Arrange
      testApp.arbitrageService.setServiceEnabled(false);
      const scanParams = { pairs: ['ETH/USDT'] };

      // Act & Assert
      try {
        await testApp.scanOpportunities(traderUser.id, scanParams);
        // Si llegamos aquí, el test debería fallar
        expect(false).toBe(true);
      } catch (error) {
        expect(error.message).toBe('Arbitrage service disabled');
      }

      // Restaurar servicio
      testApp.arbitrageService.setServiceEnabled(true);
    });
  });

  describe('🎯 Arbitrage Execution', () => {
    test('should execute arbitrage opportunity successfully', async () => {
      // Arrange - Primero escanear oportunidades
      const scanResult = await testApp.scanOpportunities(traderUser.id, {
        pairs: ['ETH/USDT'],
        minProfitPercentage: 1.0
      });
      expect(scanResult.success).toBe(true);
      expect(scanResult.opportunities.length).toBeGreaterThan(0);

      const opportunity = scanResult.opportunities[0];
      const executionParams = {
        amount: Math.min(5, opportunity.volume * 0.5) // 50% del volumen disponible
      };

      // Act
      const result = await testApp.executeArbitrage(traderUser.id, opportunity.id, executionParams);

      // Assert
      expect(result.success).toBe(true);
      expect(result.execution).toBeDefined();
      expect(result.execution.buyOrder.status).toBe('filled');
      expect(result.execution.sellOrder.status).toBe('filled');
      expect(result.execution.profit).toBeGreaterThan(0);
      expect(result.netProfit).toBeDefined();
    });

    test('should reject execution with invalid amount', async () => {
      // Arrange
      const scanResult = await testApp.scanOpportunities(traderUser.id, { pairs: ['ETH/USDT'] });
      const opportunity = scanResult.opportunities[0];
      
      const invalidParams = {
        amount: -5 // Cantidad negativa
      };

      // Act
      const result = await testApp.executeArbitrage(traderUser.id, opportunity.id, invalidParams);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid amount');
    });

    test('should reject execution exceeding available volume', async () => {
      // Arrange
      const scanResult = await testApp.scanOpportunities(traderUser.id, { pairs: ['ETH/USDT'] });
      const opportunity = scanResult.opportunities[0];
      
      const excessiveParams = {
        amount: opportunity.volume * 2 // Doble del volumen disponible
      };

      // Act
      const result = await testApp.executeArbitrage(traderUser.id, opportunity.id, excessiveParams);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Amount exceeds available volume');
    });

    test('should reject execution from user without trader permissions', async () => {
      // Arrange
      const regularUser = await testApp.db.findUserByEmail('user@test.com');
      const scanResult = await testApp.scanOpportunities(traderUser.id, { pairs: ['ETH/USDT'] });
      const opportunity = scanResult.opportunities[0];

      // Act
      const result = await testApp.executeArbitrage(regularUser.id, opportunity.id, { amount: 1 });

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Insufficient permissions');
    });

    test('should reject execution of expired opportunity', async () => {
      // Arrange
      const scanResult = await testApp.scanOpportunities(traderUser.id, { pairs: ['ETH/USDT'] });
      const opportunity = scanResult.opportunities[0];
      
      // Simular expiración modificando el timestamp
      opportunity.expires = new Date(Date.now() - 1000); // Expirada hace 1 segundo

      // Act
      const result = await testApp.executeArbitrage(traderUser.id, opportunity.id, { amount: 1 });

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Opportunity expired');
    });
  });

  describe('📊 Execution History', () => {
    test('should retrieve arbitrage execution history', async () => {
      // Arrange - Ejecutar algunas operaciones primero
      const scanResult = await testApp.scanOpportunities(traderUser.id, { pairs: ['ETH/USDT'] });
      const opportunity = scanResult.opportunities[0];
      
      await testApp.executeArbitrage(traderUser.id, opportunity.id, { amount: 1 });

      // Act
      const result = await testApp.getArbitrageHistory(traderUser.id, {});

      // Assert
      expect(result.success).toBe(true);
      expect(result.executions).toBeDefined();
      expect(result.count).toBeGreaterThan(0);
      expect(result.executions[0].status).toBe('completed');
    });

    test('should filter history by status', async () => {
      // Arrange
      const filters = { status: 'completed' };

      // Act
      const result = await testApp.getArbitrageHistory(traderUser.id, filters);

      // Assert
      expect(result.success).toBe(true);
      result.executions.forEach(execution => {
        expect(execution.status).toBe('completed');
      });
    });

    test('should filter history by date range', async () => {
      // Arrange
      const dateFrom = new Date().toISOString();
      const filters = { dateFrom: dateFrom };

      // Act
      const result = await testApp.getArbitrageHistory(traderUser.id, filters);

      // Assert
      expect(result.success).toBe(true);
      // Todas las ejecuciones deberían ser después de dateFrom
      result.executions.forEach(execution => {
        expect(execution.executedAt >= new Date(dateFrom)).toBe(true);
      });
    });

    test('should reject history request from unauthenticated user', async () => {
      // Arrange
      const invalidUserId = 99999;

      // Act
      const result = await testApp.getArbitrageHistory(invalidUserId, {});

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('User not authenticated');
    });
  });

  describe('🛡️ Risk Assessment', () => {
    test('should provide risk assessment for opportunity', async () => {
      // Arrange
      const scanResult = await testApp.scanOpportunities(traderUser.id, { pairs: ['ETH/USDT'] });
      const opportunity = scanResult.opportunities[0];

      // Act
      const result = await testApp.getRiskAssessment(traderUser.id, opportunity.id);

      // Assert
      expect(result.success).toBe(true);
      expect(result.assessment).toBeDefined();
      expect(result.assessment.riskLevel).toBeDefined();
      expect(result.assessment.factors).toBeDefined();
      expect(result.assessment.recommendation).toBeDefined();
      expect(result.assessment.maxRecommendedAmount).toBeGreaterThan(0);
      expect(result.assessment.confidence).toBeGreaterThan(0);
      expect(result.assessment.confidence).toBeLessThan(1);
    });

    test('should reject risk assessment for non-existent opportunity', async () => {
      // Arrange
      const invalidOpportunityId = 99999;

      // Act
      const result = await testApp.getRiskAssessment(traderUser.id, invalidOpportunityId);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Opportunity not found');
    });

    test('should reject risk assessment from unauthenticated user', async () => {
      // Arrange
      const invalidUserId = 99999;
      const scanResult = await testApp.scanOpportunities(traderUser.id, { pairs: ['ETH/USDT'] });
      const opportunity = scanResult.opportunities[0];

      // Act
      const result = await testApp.getRiskAssessment(invalidUserId, opportunity.id);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('User not authenticated');
    });
  });

  describe('⚡ Performance Tests', () => {
    test('should scan opportunities within performance threshold', async () => {
      // Arrange
      const scanParams = { pairs: ['ETH/USDT', 'BTC/USDT'] };
      const startTime = Date.now();

      // Act
      const result = await testApp.scanOpportunities(traderUser.id, scanParams);
      const duration = Date.now() - startTime;

      // Assert
      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(200); // Menos de 200ms
    });

    test('should execute arbitrage within performance threshold', async () => {
      // Arrange
      const scanResult = await testApp.scanOpportunities(traderUser.id, { pairs: ['ETH/USDT'] });
      const opportunity = scanResult.opportunities[0];
      const startTime = Date.now();

      // Act
      const result = await testApp.executeArbitrage(traderUser.id, opportunity.id, { amount: 1 });
      const duration = Date.now() - startTime;

      // Assert
      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(300); // Menos de 300ms
    });
  });

  describe('📈 Statistics and Metrics', () => {
    test('should calculate arbitrage statistics correctly', async () => {
      // Arrange - Ejecutar varias operaciones
      const scanResult = await testApp.scanOpportunities(traderUser.id, { pairs: ['ETH/USDT'] });
      
      for (let i = 0; i < 3; i++) {
        if (scanResult.opportunities[i]) {
          await testApp.executeArbitrage(traderUser.id, scanResult.opportunities[i].id, { amount: 1 });
        }
      }

      // Act
      const stats = testApp.arbitrageService.getStats();

      // Assert
      expect(stats.totalOpportunities).toBeGreaterThan(0);
      expect(stats.totalExecutions).toBeGreaterThan(0);
      expect(stats.completedExecutions).toBe(stats.totalExecutions);
      expect(stats.totalProfit).toBeGreaterThan(0);
      expect(stats.averageProfit).toBeGreaterThan(0);
    });
  });

  describe('🔄 Concurrent Operations', () => {
    test('should handle multiple concurrent opportunity scans', async () => {
      // Arrange
      const scanParams = { pairs: ['ETH/USDT'] };
      const promises = [];

      // Act - Múltiples scans concurrentes
      for (let i = 0; i < 5; i++) {
        promises.push(testApp.scanOpportunities(traderUser.id, scanParams));
      }

      const results = await Promise.all(promises);

      // Assert
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.opportunities).toBeDefined();
      });
    });
  });
});

// Exportar para uso en otros tests
module.exports = {
  ArbitrageTestHelper,
  ArbitrageServiceMock
};
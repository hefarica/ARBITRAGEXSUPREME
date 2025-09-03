/**
 * ArbitrageX Pro 2025 - E2E Tests Setup
 * Configuración específica para tests end-to-end
 */

import { createE2ETestEnvironment } from './test-environment';

const e2eEnvironment = createE2ETestEnvironment();

beforeAll(async () => {
  await e2eEnvironment.setup();
  console.log('🧪 E2E test environment ready');
});

afterAll(async () => {
  await e2eEnvironment.teardown();
  console.log('🧪 E2E test environment cleaned up');
});

beforeEach(async () => {
  // Limpiar DB antes de cada test E2E
  await e2eEnvironment.cleanDatabase();
});

// Helpers para E2E tests
global.e2eHelpers = {
  setupCompleteScenario: async () => {
    const prisma = e2eEnvironment.getPrisma();
    if (!prisma) throw new Error('Prisma not available');
    
    // Crear tenant
    const tenant = await prisma.tenant.create({
      data: {
        name: 'E2E Test Company',
        slug: 'e2e-test',
        status: 'ACTIVE'
      }
    });

    // Crear usuario
    const user = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: 'admin@e2e-test.com',
        firstName: 'E2E',
        lastName: 'Admin',
        role: 'ADMIN',
        status: 'ACTIVE'
      }
    });

    // Crear configuración de arbitraje
    const config = await prisma.arbitrageConfig.create({
      data: {
        tenantId: tenant.id,
        name: 'E2E Test Strategy',
        strategies: ['triangular', 'cross_chain'],
        blockchains: ['ethereum', 'bsc'],
        riskSettings: { maxSlippage: 0.01 },
        minProfitThreshold: 0.02,
        maxPositionSize: '1000000000000000000', // 1 ETH
        isActive: true
      }
    });

    return { tenant, user, config };
  },

  simulateArbitrageOpportunity: async (configId: string) => {
    const prisma = e2eEnvironment.getPrisma();
    if (!prisma) throw new Error('Prisma not available');
    
    return prisma.arbitrageOpportunity.create({
      data: {
        configId,
        strategyName: 'Cross Chain Arbitrage',
        blockchainFrom: 'ethereum',
        blockchainTo: 'bsc',
        tokenIn: '0xA0b86a33E6417c8C4A6E4c1f11b8e3B0b9a0a2a3',
        tokenOut: '0xB0b86a33E6417c8C4A6E4c1f11b8e3B0b9a0a2a4',
        tokenSymbol: 'USDC',
        amountIn: '1000000000000000000',
        expectedAmountOut: '1050000000000000000',
        profitAmount: '50000000000000000',
        profitPercentage: 5.0,
        profitUsd: 150.0,
        confidenceScore: 0.95,
        gasEstimate: '150000',
        dexPath: [],
        status: 'DETECTED',
        expiresAt: new Date(Date.now() + 300000) // 5 minutos
      }
    });
  }
};
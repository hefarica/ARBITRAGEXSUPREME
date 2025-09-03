/**
 * ArbitrageX Pro 2025 - Jest Setup Configuration
 * Configuración global para todos los tests
 * Hector Fabio Riascos C. - Ingenio Pichichi S.A.
 */

import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';

// Configurar variables de entorno para testing
config({ path: '.env.test' });

// Configurar timeout global
jest.setTimeout(30000);

// Variables globales para tests
declare global {
  var prisma: PrismaClient;
  var testDatabase: string;
}

// Base de datos de testing
const testDatabaseUrl = process.env.DATABASE_TEST_URL || 'postgresql://arbitragex:password@localhost:5432/arbitragex_test';

// Setup antes de todos los tests
beforeAll(async () => {
  // Configurar Prisma para testing
  global.prisma = new PrismaClient({
    datasources: {
      db: {
        url: testDatabaseUrl
      }
    },
    log: process.env.NODE_ENV === 'test' ? [] : ['query', 'info', 'warn', 'error']
  });

  // Conectar a la base de datos
  await global.prisma.$connect();
  
  console.log('🧪 Jest Setup: Connected to test database');
});

// Cleanup después de todos los tests
afterAll(async () => {
  if (global.prisma) {
    await global.prisma.$disconnect();
    console.log('🧪 Jest Setup: Disconnected from test database');
  }
});

// Setup antes de cada test
beforeEach(async () => {
  // Limpiar datos entre tests si es necesario
  // await global.prisma.arbitrageExecution.deleteMany();
  // await global.prisma.arbitrageOpportunity.deleteMany();
});

// Cleanup después de cada test
afterEach(async () => {
  // Cleanup específico por test si es necesario
});

// Configuraciones globales de Jest
expect.extend({
  // Custom matchers personalizados
  toBeValidUUID(received: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid UUID`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid UUID`,
        pass: false,
      };
    }
  },

  toBeValidTimestamp(received: any) {
    const isValidDate = received instanceof Date && !isNaN(received.getTime());
    const pass = isValidDate;
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid timestamp`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid timestamp`,
        pass: false,
      };
    }
  }
});

// Tipos para custom matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidUUID(): R;
      toBeValidTimestamp(): R;
    }
  }
}

// Mock por defecto para servicios externos
jest.mock('@arbitragex/blockchain-connectors', () => ({
  EthereumConnector: jest.fn(),
  BSCConnector: jest.fn(),
  PolygonConnector: jest.fn()
}));

// Configurar console para tests
const originalConsole = global.console;

global.console = {
  ...originalConsole,
  // Silenciar logs durante tests a menos que sea explícito
  log: process.env.JEST_VERBOSE === 'true' ? originalConsole.log : jest.fn(),
  info: process.env.JEST_VERBOSE === 'true' ? originalConsole.info : jest.fn(),
  warn: originalConsole.warn,
  error: originalConsole.error
};

// Helpers para testing
export const testHelpers = {
  // Generar datos mock
  mockArbitrageOpportunity: (overrides = {}) => ({
    id: 'test-opportunity-id',
    configId: 'test-config-id',
    strategyName: 'Test Strategy',
    blockchainFrom: 'ethereum',
    blockchainTo: 'bsc',
    tokenIn: '0x1234...',
    tokenOut: '0x5678...',
    tokenSymbol: 'USDC',
    amountIn: '1000000000000000000', // 1 ETH in wei
    expectedAmountOut: '1050000000000000000', // 1.05 ETH
    profitAmount: '50000000000000000', // 0.05 ETH
    profitPercentage: 5.0,
    profitUsd: 150.0,
    confidenceScore: 0.95,
    gasEstimate: '150000',
    dexPath: [],
    status: 'DETECTED',
    expiresAt: new Date(Date.now() + 300000), // 5 minutos
    detectedAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  }),

  // Limpiar base de datos de testing
  async cleanDatabase() {
    if (global.prisma) {
      await global.prisma.arbitrageExecution.deleteMany();
      await global.prisma.arbitrageOpportunity.deleteMany();
      await global.prisma.arbitrageConfig.deleteMany();
      await global.prisma.apiKey.deleteMany();
      await global.prisma.user.deleteMany();
      await global.prisma.subscription.deleteMany();
      await global.prisma.tenant.deleteMany();
    }
  },

  // Crear tenant de testing
  async createTestTenant() {
    return global.prisma.tenant.create({
      data: {
        name: 'Test Tenant',
        slug: 'test-tenant',
        status: 'ACTIVE'
      }
    });
  }
};

console.log('🧪 Jest Enterprise Setup completed successfully');
/**
 * ArbitrageX Pro 2025 - Integration Tests Setup
 * Configuración específica para tests de integración
 */

import { createIntegrationTestEnvironment } from './test-environment';

const integrationEnvironment = createIntegrationTestEnvironment();

beforeAll(async () => {
  await integrationEnvironment.setup();
  console.log('🧪 Integration test environment ready');
});

afterAll(async () => {
  await integrationEnvironment.teardown();
  console.log('🧪 Integration test environment cleaned up');
});

beforeEach(async () => {
  // Limpiar DB antes de cada test de integración
  await integrationEnvironment.cleanDatabase();
});

// Helpers para integration tests
global.integrationHelpers = {
  createTestTenant: async () => {
    const prisma = integrationEnvironment.getPrisma();
    if (!prisma) throw new Error('Prisma not available');
    
    return prisma.tenant.create({
      data: {
        name: 'Integration Test Tenant',
        slug: 'integration-test',
        status: 'ACTIVE'
      }
    });
  },

  createTestUser: async (tenantId: string) => {
    const prisma = integrationEnvironment.getPrisma();
    if (!prisma) throw new Error('Prisma not available');
    
    return prisma.user.create({
      data: {
        tenantId,
        email: 'test@integration.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'USER',
        status: 'ACTIVE'
      }
    });
  }
};
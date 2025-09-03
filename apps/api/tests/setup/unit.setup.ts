/**
 * ArbitrageX Pro 2025 - Unit Tests Setup
 * Configuración específica para tests unitarios
 */

import { createUnitTestEnvironment } from './test-environment';

const unitEnvironment = createUnitTestEnvironment();

beforeAll(async () => {
  await unitEnvironment.setup();
  console.log('🧪 Unit test environment ready');
});

afterAll(async () => {
  await unitEnvironment.teardown();
  console.log('🧪 Unit test environment cleaned up');
});

// Mock global para unit tests
global.mockBlockchainConnector = {
  getBalance: jest.fn().mockResolvedValue('1000000000000000000'),
  getGasPrice: jest.fn().mockResolvedValue('20000000000'),
  executeArbitrage: jest.fn().mockResolvedValue({
    success: true,
    txHash: '0x1234567890abcdef',
    gasUsed: '150000'
  })
};

global.mockRedis = {
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1)
};
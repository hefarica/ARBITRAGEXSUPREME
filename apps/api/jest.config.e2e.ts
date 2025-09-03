/**
 * ArbitrageX Pro 2025 - Jest E2E Tests Configuration
 * Configuración específica para tests end-to-end
 */

import type { Config } from 'jest';
import baseConfig from './jest.config.enterprise';

const config: Config = {
  ...baseConfig,
  
  // Solo tests E2E
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.e2e.test.ts',
    '<rootDir>/tests/e2e/**/*.test.ts'
  ],

  // Timeout largo para E2E tests
  testTimeout: 60000,

  // Setup específico para E2E tests
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup/jest.setup.ts',
    '<rootDir>/tests/setup/e2e.setup.ts'
  ],

  // Un solo worker para E2E (evitar conflicts)
  maxWorkers: 1,

  // Correr en serie
  runInBand: true,

  // No coverage para E2E (se enfoca en functionality)
  collectCoverage: false
};

export default config;
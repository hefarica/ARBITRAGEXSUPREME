/**
 * ArbitrageX Pro 2025 - Jest Integration Tests Configuration
 * Configuración específica para tests de integración
 */

import type { Config } from 'jest';
import baseConfig from './jest.config.enterprise';

const config: Config = {
  ...baseConfig,
  
  // Solo tests de integración
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.integration.test.ts',
    '<rootDir>/tests/integration/**/*.test.ts'
  ],

  // Timeout más largo para integration tests
  testTimeout: 15000,

  // Setup específico para integration tests
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup/jest.setup.ts',
    '<rootDir>/tests/setup/integration.setup.ts'
  ],

  // Menos workers para integration tests (usan DB)
  maxWorkers: '25%',

  // Correr en serie para evitar conflicts de DB
  runInBand: true
};

export default config;
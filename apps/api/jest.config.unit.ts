/**
 * ArbitrageX Pro 2025 - Jest Unit Tests Configuration
 * Configuración específica para tests unitarios
 */

import type { Config } from 'jest';
import baseConfig from './jest.config.enterprise';

const config: Config = {
  ...baseConfig,
  
  // Solo tests unitarios
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.unit.test.ts',
    '<rootDir>/tests/unit/**/*.test.ts'
  ],

  // No coverage para mocks
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/**/*.interface.ts',
    '!src/**/*.type.ts',
    '!src/**/*.enum.ts',
    '!src/**/*.constant.ts',
    '!src/**/__tests__/**',
    '!src/**/tests/**'
  ],

  // Timeout más corto para unit tests
  testTimeout: 5000,

  // Setup específico para unit tests
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup/jest.setup.ts',
    '<rootDir>/tests/setup/unit.setup.ts'
  ],

  // Más workers para unit tests (son rápidos)
  maxWorkers: '75%'
};

export default config;
/**
 * ArbitrageX Supreme - Root Jest Configuration
 * Ingenio Pichichi S.A. - Testing Framework Empresarial
 * Configuración centralizada para testing sin mocks - TODO FUNCIONAL
 */

const { createJestConfig } = require('./config/jest/jest.base.config');

module.exports = {
  displayName: 'ArbitrageX Supreme Root',
  
  // Configuración para monorepo
  projects: [
    '<rootDir>/apps/catalyst/jest.config.js',
    '<rootDir>/apps/web/jest.config.js',
    '<rootDir>/packages/*/jest.config.js',
    '<rootDir>/services/*/jest.config.js',
  ],

  // Configuración global
  collectCoverageFrom: [
    'apps/**/*.{js,jsx,ts,tsx}',
    'packages/**/*.{js,jsx,ts,tsx}',
    'services/**/*.{js,jsx,ts,tsx}',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/coverage/**',
    '!**/*.d.ts',
    '!**/*.config.{js,ts}',
  ],

  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json'],
  
  // Umbrales de cobertura empresariales
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85,
    },
  },

  // Configuración de timeout para pruebas complejas
  testTimeout: 60000,
  
  // Variables de entorno globales para testing
  setupFilesAfterEnv: ['<rootDir>/config/jest/global-setup.ts'],
  
  // Configuración para pruebas en paralelo
  maxWorkers: '50%',
  
  verbose: true,
  bail: false,
  
  // Configuración para testing sin mocks
  clearMocks: false,
  restoreMocks: false,
  
  // Notificaciones de testing
  notify: true,
  notifyMode: 'failure-change',
}
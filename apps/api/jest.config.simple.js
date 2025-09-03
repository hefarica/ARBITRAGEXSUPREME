/**
 * ArbitrageX Pro 2025 - Jest Simple Configuration
 * Configuración básica funcional para testing
 */

module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.test.ts'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/'
  ],
  collectCoverage: false,
  verbose: true,
  clearMocks: true,
  resetMocks: true,
  testTimeout: 10000,
  moduleFileExtensions: ['js', 'ts', 'json'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      useESM: false
    }]
  }
};
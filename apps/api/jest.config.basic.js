/**
 * ArbitrageX Pro 2025 - Jest Basic Configuration
 * Configuración básica solo JavaScript
 */

module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/tests/**/*.test.js'
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/'
  ],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'html'],
  verbose: true,
  clearMocks: true,
  resetMocks: true,
  testTimeout: 10000
};
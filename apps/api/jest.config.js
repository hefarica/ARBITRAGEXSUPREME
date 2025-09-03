/**
 * ArbitrageX Pro 2025 - Jest Enterprise Configuration
 * Configuración completa de testing con coverage thresholds
 * Hector Fabio Riascos C. - Ingenio Pichichi S.A.
 */

module.exports = {
  // Preset para TypeScript
  preset: 'ts-jest',
  testEnvironment: 'node',

  // Directorio raíz para tests
  rootDir: '.',
  
  // Patrones de archivos de test
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.test.ts',
    '<rootDir>/src/**/*.test.ts',
    '<rootDir>/tests/unit/**/*.test.ts',
    '<rootDir>/tests/integration/**/*.test.ts',
    '<rootDir>/tests/e2e/**/*.test.ts'
  ],

  // Ignorar estos patrones
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/.next/',
    '/coverage/'
  ],

  // Configuración de coverage - ENTERPRISE THRESHOLDS
  collectCoverage: false, // Habilitado solo cuando se necesite
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'text-summary',
    'lcov',
    'html'
  ],

  // THRESHOLDS ENTERPRISE - 80%+ COVERAGE REQUERIDO
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  // Patrones de archivos para coverage
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

  // Configuración de módulos
  moduleFileExtensions: ['ts', 'js', 'json'],
  
  // Resolución de paths
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1'
  },

  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup/jest.setup.ts'
  ],

  // Timeouts
  testTimeout: 30000,
  
  // Configuraciones adicionales para enterprise
  verbose: true,
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true,

  // Configuración para tests paralelos
  maxWorkers: '50%',
  
  // Configuración de cache
  cache: true,

  // Transform
  transform: {
    '^.+\\.ts$': 'ts-jest'
  }
};
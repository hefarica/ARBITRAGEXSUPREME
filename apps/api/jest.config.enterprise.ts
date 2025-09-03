/**
 * ArbitrageX Pro 2025 - Jest Enterprise Configuration
 * Configuración completa de testing con coverage thresholds y TypeScript
 * Hector Fabio Riascos C. - Ingenio Pichichi S.A.
 */

import type { Config } from 'jest';

const config: Config = {
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
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'text-summary',
    'lcov',
    'html',
    'json',
    'clover'
  ],

  // THRESHOLDS ENTERPRISE - 80%+ COVERAGE REQUERIDO
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    // Thresholds específicos para servicios críticos
    './src/services/': {
      branches: 85,
      functions: 85,
      lines: 85,
      statements: 85
    },
    './src/shared/': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
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
    '!src/**/tests/**',
    '!src/main.ts',
    '!src/app.module.ts'
  ],

  // Configuración de módulos
  moduleFileExtensions: ['ts', 'js', 'json'],
  
  // Resolución de paths
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@controllers/(.*)$': '<rootDir>/src/controllers/$1',
    '^@middleware/(.*)$': '<rootDir>/src/middleware/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@config/(.*)$': '<rootDir>/src/config/$1'
  },

  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup/jest.setup.ts'
  ],

  // Configuración de TypeScript
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: {
        compilerOptions: {
          module: 'commonjs',
          target: 'es2020',
          lib: ['es2020'],
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: true
        }
      }
    }]
  },

  // Timeouts
  testTimeout: 30000,
  
  // Configuraciones adicionales para enterprise
  verbose: true,
  clearMocks: true,
  restoreMocks: true,
  resetMocks: true,

  // Para debugging
  errorOnDeprecated: true,
  
  // Reportes adicionales
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'coverage',
      outputName: 'junit.xml'
    }],
    ['jest-html-reporters', {
      publicPath: 'coverage',
      filename: 'report.html',
      expand: true
    }]
  ],

  // Configuración para watch mode
  watchPathIgnorePatterns: [
    '/node_modules/',
    '/coverage/',
    '/dist/'
  ],

  // Configuración para tests paralelos
  maxWorkers: '50%',
  
  // Configuración de cache
  cache: true,
  cacheDirectory: '.jest-cache',

  // Configuración global para tests
  globals: {
    'ts-jest': {
      isolatedModules: true,
      useESM: false
    }
  }
};

export default config;
/**
 * ArbitrageX Supreme - Base Jest Configuration
 * Ingenio Pichichi S.A. - Configuración base reutilizable
 */

const path = require('path');

const createJestConfig = (packageName, options = {}) => {
  const baseConfig = {
    displayName: packageName,
    
    // Entorno de testing
    testEnvironment: options.testEnvironment || 'node',
    
    // Configuración de archivos
    setupFilesAfterEnv: [
      '<rootDir>/../../config/jest/global-setup.ts',
      ...(options.setupFiles || [])
    ],
    
    // Patrones de archivos de prueba
    testMatch: [
      '<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}',
      '<rootDir>/src/**/*.{test,spec}.{js,jsx,ts,tsx}',
      '<rootDir>/tests/**/*.{test,spec}.{js,jsx,ts,tsx}',
    ],
    
    // Archivos a ignorar
    testPathIgnorePatterns: [
      '<rootDir>/node_modules/',
      '<rootDir>/dist/',
      '<rootDir>/build/',
      '<rootDir>/.next/',
      '<rootDir>/coverage/',
    ],
    
    // Configuración de cobertura
    collectCoverageFrom: [
      'src/**/*.{js,jsx,ts,tsx}',
      '!src/**/*.d.ts',
      '!src/**/*.config.{js,ts}',
      '!src/**/index.{js,ts}',
      '!src/test/**',
      ...(options.collectCoverageFrom || [])
    ],
    
    // Mapeo de módulos
    moduleNameMapper: {
      '^@/(.*)$': '<rootDir>/src/$1',
      '^~/(.*)$': '<rootDir>/$1',
      ...(options.moduleNameMapping || {})
    },
    
    // Transformaciones
    transform: {
      '^.+\\.(ts|tsx)$': ['ts-jest', {
        tsconfig: '<rootDir>/tsconfig.json',
        isolatedModules: true,
      }],
      '^.+\\.(js|jsx)$': ['babel-jest'],
      ...(options.transform || {})
    },
    
    // Configuración de TypeScript
    preset: 'ts-jest',
    
    // Extensiones de archivos
    moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
    
    // Configuración de timeout
    testTimeout: options.testTimeout || 30000,
    
    // Configuración avanzada
    verbose: true,
    clearMocks: false, // No limpiar mocks automáticamente
    restoreMocks: false, // No restaurar mocks automáticamente
    
    // Configuración para testing real sin mocks
    testEnvironmentOptions: {
      url: 'http://localhost:3000',
    },
    
    // Variables de entorno específicas para testing
    globals: {
      'ts-jest': {
        isolatedModules: true,
        tsconfig: {
          jsx: 'react-jsx',
        },
      },
    },
  };
  
  return {
    ...baseConfig,
    ...options,
  };
};

module.exports = { createJestConfig };
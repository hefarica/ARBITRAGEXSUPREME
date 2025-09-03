/**
 * ArbitrageX Supreme - Playwright E2E Configuration
 * Ingenio Pichichi S.A. - Configuración para pruebas End-to-End
 * Testing completo sin mocks - TODO FUNCIONAL
 */

import { defineConfig, devices } from '@playwright/test';
import path from 'path';

// Configuración de puertos y URLs
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

export default defineConfig({
  // Directorio de pruebas E2E
  testDir: './tests/e2e',
  
  // Configuración de archivos
  testMatch: '**/*.e2e.{ts,js}',
  
  // Configuración de ejecución
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : '50%',
  
  // Configuración de reportes
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['line'],
  ],
  
  // Configuración global
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 30000,
    navigationTimeout: 60000,
    
    // Headers para testing real
    extraHTTPHeaders: {
      'x-testing-mode': 'e2e',
      'x-user-agent': 'ArbitrageX-Supreme-E2E-Tests',
    },
  },

  // Configuración de proyectos para diferentes navegadores
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Configuración específica para testing DeFi
        permissions: ['clipboard-read', 'clipboard-write'],
        geolocation: { longitude: -74.006, latitude: 40.7128 }, // NYC para testing
      },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    
    // Testing móvil
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  // Configuración del servidor de desarrollo
  webServer: {
    command: 'npm run dev',
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      NODE_ENV: 'test',
      TESTING_MODE: 'e2e',
    },
  },

  // Directorios de salida
  outputDir: 'test-results',
  
  // Configuración de timeout global
  timeout: 120000,
  expect: {
    timeout: 30000,
  },
  
  // Configuración para testing real sin mocks
  globalSetup: './tests/e2e/global-setup.ts',
  globalTeardown: './tests/e2e/global-teardown.ts',
  
  // Configuración de metadatos
  metadata: {
    project: 'ArbitrageX Supreme',
    company: 'Ingenio Pichichi S.A.',
    methodology: 'Cumplidor, disciplinado, organizado',
    testingApproach: 'Real testing - No mocks',
  },
});
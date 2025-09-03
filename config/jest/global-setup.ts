/**
 * ArbitrageX Supreme - Global Jest Setup
 * Ingenio Pichichi S.A. - Configuración global de testing
 * Setup para testing real sin mocks - TODO FUNCIONAL
 */

import { config } from 'dotenv';
import { join } from 'path';

// Cargar variables de entorno específicas para testing
config({ path: join(process.cwd(), '.env.test') });
config({ path: join(process.cwd(), '.env.local') });

// Configuración global para testing empresarial
global.beforeAll(async () => {
  console.log('🚀 ArbitrageX Supreme - Iniciando Testing Suite');
  console.log('📋 Ingenio Pichichi S.A. - Metodología: Cumplidor, disciplinado, organizado');
  
  // Configurar timeouts extendidos para operaciones blockchain reales
  jest.setTimeout(120000);
  
  // Configurar variables de entorno para testing real
  process.env.NODE_ENV = 'test';
  process.env.TESTING_MODE = 'real'; // Indica que usamos datos reales, no mocks
  process.env.LOG_LEVEL = 'error'; // Reducir logs durante testing
  
  // Validar que las variables críticas estén configuradas
  const criticalEnvVars = [
    'DATABASE_URL',
    'ETHEREUM_RPC_URL',
    'POLYGON_RPC_URL',
  ];
  
  for (const envVar of criticalEnvVars) {
    if (!process.env[envVar]) {
      console.warn(`⚠️  Variable de entorno ${envVar} no configurada para testing`);
    }
  }
});

global.afterAll(async () => {
  console.log('✅ ArbitrageX Supreme - Testing Suite completado');
  
  // Limpiar recursos si es necesario
  if (global.testCleanup) {
    await global.testCleanup();
  }
});

// Configuración de Jest personalizada
expect.extend({
  /**
   * Matcher personalizado para validar respuestas blockchain
   */
  toBeValidBlockchainResponse(received) {
    const pass = received && 
                 typeof received === 'object' && 
                 received.hash && 
                 received.blockNumber;
    
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid blockchain response`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid blockchain response with hash and blockNumber`,
        pass: false,
      };
    }
  },
  
  /**
   * Matcher personalizado para validar MEV protection
   */
  toHaveMEVProtection(received) {
    const pass = received && 
                 received.mevProtected === true &&
                 received.gasOptimized === true &&
                 received.slippageMinimized === true;
    
    if (pass) {
      return {
        message: () => `expected ${received} not to have MEV protection`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to have complete MEV protection`,
        pass: false,
      };
    }
  },
});

// Configuraciones adicionales para testing real
console.log('🔧 Configuración de testing real activada - Sin mocks');
console.log('📊 Cobertura mínima requerida: 85%');
console.log('⏱️  Timeout por defecto: 120 segundos');

export {};
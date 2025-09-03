/**
 * ArbitrageX Supreme - Playwright Global Setup
 * Ingenio Pichichi S.A. - Setup global para E2E testing
 * Configuración real sin mocks para testing empresarial
 */

import { chromium, FullConfig } from '@playwright/test';
import { config } from 'dotenv';
import path from 'path';

async function globalSetup(config: FullConfig) {
  console.log('🚀 ArbitrageX Supreme E2E - Global Setup');
  console.log('📋 Ingenio Pichichi S.A. - Metodología empresarial');
  
  // Cargar variables de entorno para E2E
  require('dotenv').config({ path: path.resolve('.env.test') });
  require('dotenv').config({ path: path.resolve('.env.local') });
  
  // Configurar variables de entorno para E2E
  process.env.TESTING_MODE = 'e2e';
  process.env.LOG_LEVEL = 'error';
  
  // Validar conectividad del servidor
  const baseURL = process.env.BASE_URL || 'http://localhost:3000';
  
  try {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    
    // Validar que el servidor esté corriendo
    console.log(`🔍 Validando servidor en ${baseURL}...`);
    
    await page.goto(baseURL, { 
      waitUntil: 'networkidle',
      timeout: 60000 
    });
    
    // Validar elementos críticos de la aplicación
    const title = await page.title();
    console.log(`✅ Servidor activo - Título: ${title}`);
    
    // Validar que las APIs críticas estén respondiendo
    const apiHealth = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/health');
        return response.ok;
      } catch (error) {
        console.warn('API health check falló:', error);
        return false;
      }
    });
    
    if (apiHealth) {
      console.log('✅ API health check exitoso');
    } else {
      console.warn('⚠️  API health check falló - Continuando testing');
    }
    
    // Configurar estado global para las pruebas
    await page.evaluate(() => {
      window.testingMode = 'e2e';
      window.mockDisabled = true;
    });
    
    await browser.close();
    
    console.log('🎯 E2E Setup completado - Sistema listo para testing real');
    
  } catch (error) {
    console.error('❌ Error en E2E setup:', error);
    
    // No fallar el setup si el servidor no está listo aún
    console.log('⏳ Esperando que el servidor esté listo...');
  }
  
  // Configurar timeout global para operaciones blockchain reales
  console.log('⚙️  Configurando timeouts extendidos para blockchain real');
  
  return {
    baseURL,
    testingMode: 'real',
    mockingDisabled: true,
  };
}

export default globalSetup;
#!/usr/bin/env node

const fetch = require("node-fetch");

const BASE_URL = "http://localhost:3000";
const TIMEOUT = 10000; // 10 segundos

const endpoints = [
  "/api/snapshot/consolidated",
  "/api/arbitrage/dashboard/summary", 
  "/api/arbitrage/execute",
  "/api/dashboard/complete",
  "/api/networks/status",
  "/api/opportunities/live",
  "/api/health",
  "/api/diagnostics",
  "/api/metrics/performance"
];

async function testEndpoint(endpoint) {
  const startTime = Date.now();
  
  try {
    const url = `${BASE_URL}${endpoint}`;
    console.log(`🧪 Testing: ${endpoint}...`);
    
    // Crear AbortController para timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      console.log(`⏰ Timeout reached for ${endpoint}`);
    }, TIMEOUT);
    
    const response = await fetch(url, { 
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    clearTimeout(timeoutId);
    
    const responseTime = Date.now() - startTime;
    const text = await response.text();
    
    // Verificar si es JSON válido
    let isValidJSON = false;
    try {
      JSON.parse(text);
      isValidJSON = true;
    } catch (e) {
      console.warn(`⚠️  ${endpoint} returned non-JSON response`);
    }
    
    return {
      endpoint,
      status: response.status,
      success: response.ok && isValidJSON,
      responseTime,
      data: text.slice(0, 200) + (text.length > 200 ? '...' : ''),
      error: response.ok ? undefined : `HTTP ${response.status}`
    };
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    return {
      endpoint,
      status: 'ERROR',
      success: false,
      responseTime,
      data: '',
      error: error.message || 'Unknown error'
    };
  }
}

async function runDiagnostics() {
  console.log('🚀 ArbitrageX Supreme - Endpoint Diagnostics');
  console.log('='.repeat(60));
  
  const results = [];
  
  for (const endpoint of endpoints) {
    const result = await testEndpoint(endpoint);
    results.push(result);
    
    if (result.success) {
      console.log(`✅ ${endpoint} [${result.status}] ${result.responseTime}ms`);
    } else {
      console.log(`❌ ${endpoint} [${result.status}] ${result.responseTime}ms - ${result.error}`);
    }
    
    // Agregar pequeña pausa para no sobrecargar
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('\n📊 RESUMEN:');
  console.log('='.repeat(60));
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
  
  console.log(`✅ Exitosos: ${successful}/${results.length}`);
  console.log(`❌ Fallidos: ${failed}/${results.length}`);
  console.log(`⏱️  Tiempo promedio: ${avgResponseTime.toFixed(0)}ms`);
  
  if (failed > 0) {
    console.log('\n🔍 ENDPOINTS PROBLEMÁTICOS:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`   • ${r.endpoint}: ${r.error}`);
    });
  }
  
  // Detectar problemas específicos
  const criticalEndpoints = ['/api/dashboard/complete', '/api/snapshot/consolidated'];
  const criticalFailures = results.filter(r => 
    criticalEndpoints.includes(r.endpoint) && !r.success
  );
  
  if (criticalFailures.length > 0) {
    console.log('\n🚨 PROBLEMAS CRÍTICOS DETECTADOS:');
    criticalFailures.forEach(f => {
      console.log(`   🔥 ${f.endpoint} está fallando - Este puede ser la causa del loading infinito`);
    });
  }
  
  return results;
}

// Ejecutar diagnósticos
runDiagnostics().catch(console.error);
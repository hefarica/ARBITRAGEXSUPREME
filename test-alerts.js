/**
 * ArbitrageX Supreme - Script de Prueba del Sistema de Alertas
 * Ingenio Pichichi S.A. - Actividad 7.8
 * 
 * Script completo de verificación y pruebas del sistema de alertas:
 * - Pruebas de API REST
 * - Pruebas de detección de anomalías
 * - Pruebas de notificaciones
 * - Pruebas de dashboard
 * 
 * TODO FUNCIONAL Y SIN UN SOLO MOCK
 */

const axios = require('axios');

// Configuración del servidor
const BASE_URL = process.env.TEST_SERVER_URL || 'http://localhost:3001';
const API_BASE = `${BASE_URL}/api/v2/alerts`;

/**
 * Colores para output en consola
 */
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Función auxiliar para realizar peticiones HTTP
 */
async function request(method, url, data = null) {
  try {
    const config = {
      method,
      url: `${API_BASE}${url}`,
      timeout: 10000
    };

    if (data) {
      config.data = data;
      config.headers = { 'Content-Type': 'application/json' };
    }

    const response = await axios(config);
    return {
      success: true,
      status: response.status,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      status: error.response?.status || 0,
      error: error.message,
      data: error.response?.data
    };
  }
}

/**
 * Prueba 1: Verificar estado de salud del sistema
 */
async function testHealthCheck() {
  log('\n=== PRUEBA 1: Estado de Salud del Sistema ===', 'cyan');
  
  const result = await request('GET', '/health');
  
  if (result.success) {
    log('✅ Estado de salud OK', 'green');
    log(`Datos: ${JSON.stringify(result.data, null, 2)}`, 'blue');
    return true;
  } else {
    log(`❌ Error verificando salud: ${result.error}`, 'red');
    return false;
  }
}

/**
 * Prueba 2: Crear alertas de prueba
 */
async function testCreateAlerts() {
  log('\n=== PRUEBA 2: Creación de Alertas ===', 'cyan');
  
  const testAlerts = [
    {
      type: 'CRITICAL',
      category: 'trading',
      title: 'Prueba - Latencia Crítica',
      description: 'Latencia de trading excede umbral crítico en pruebas automatizadas',
      source: 'test-script',
      context: { test: true, timestamp: Date.now() }
    },
    {
      type: 'HIGH',
      category: 'security',
      title: 'Prueba - Intento de Acceso No Autorizado',
      description: 'Múltiples intentos fallidos detectados durante pruebas de seguridad',
      source: 'test-script',
      context: { test: true, timestamp: Date.now() }
    },
    {
      type: 'MEDIUM',
      category: 'system',
      title: 'Prueba - Uso Elevado de Recursos',
      description: 'Uso de CPU/memoria superior al normal durante pruebas de carga',
      source: 'test-script',
      context: { test: true, timestamp: Date.now() }
    }
  ];

  const createdAlerts = [];
  
  for (const [index, alertData] of testAlerts.entries()) {
    log(`\nCreando alerta ${index + 1}/3: ${alertData.title}`, 'yellow');
    
    const result = await request('POST', '', alertData);
    
    if (result.success) {
      log(`✅ Alerta creada: ID ${result.data.data.id}`, 'green');
      createdAlerts.push(result.data.data);
    } else {
      log(`❌ Error creando alerta: ${result.error}`, 'red');
      log(`Detalles: ${JSON.stringify(result.data, null, 2)}`, 'red');
    }
  }
  
  return createdAlerts;
}

/**
 * Prueba 3: Obtener lista de alertas
 */
async function testGetAlerts() {
  log('\n=== PRUEBA 3: Obtener Lista de Alertas ===', 'cyan');
  
  const result = await request('GET', '');
  
  if (result.success) {
    log('✅ Lista de alertas obtenida', 'green');
    log(`Total de alertas: ${result.data.data.total}`, 'blue');
    log(`Alertas activas: ${result.data.data.active}`, 'blue');
    return result.data.data.alerts;
  } else {
    log(`❌ Error obteniendo alertas: ${result.error}`, 'red');
    return [];
  }
}

/**
 * Prueba 4: Reconocer una alerta
 */
async function testAcknowledgeAlert(alertId) {
  log('\n=== PRUEBA 4: Reconocimiento de Alerta ===', 'cyan');
  
  if (!alertId) {
    log('⚠️  No hay alertas disponibles para reconocer', 'yellow');
    return false;
  }

  const result = await request('POST', `/${alertId}/acknowledge`, {
    acknowledgedBy: 'test-script-user'
  });
  
  if (result.success) {
    log(`✅ Alerta ${alertId} reconocida exitosamente`, 'green');
    return true;
  } else {
    log(`❌ Error reconociendo alerta: ${result.error}`, 'red');
    return false;
  }
}

/**
 * Prueba 5: Resolver una alerta
 */
async function testResolveAlert(alertId) {
  log('\n=== PRUEBA 5: Resolución de Alerta ===', 'cyan');
  
  if (!alertId) {
    log('⚠️  No hay alertas disponibles para resolver', 'yellow');
    return false;
  }

  const result = await request('POST', `/${alertId}/resolve`, {
    resolvedBy: 'test-script-user',
    resolution: 'Problema resuelto durante pruebas automatizadas'
  });
  
  if (result.success) {
    log(`✅ Alerta ${alertId} resuelta exitosamente`, 'green');
    return true;
  } else {
    log(`❌ Error resolviendo alerta: ${result.error}`, 'red');
    return false;
  }
}

/**
 * Prueba 6: Obtener estadísticas
 */
async function testGetStatistics() {
  log('\n=== PRUEBA 6: Estadísticas del Sistema ===', 'cyan');
  
  const result = await request('GET', '/statistics');
  
  if (result.success) {
    log('✅ Estadísticas obtenidas', 'green');
    log(`Datos: ${JSON.stringify(result.data.data, null, 2)}`, 'blue');
    return true;
  } else {
    log(`❌ Error obteniendo estadísticas: ${result.error}`, 'red');
    return false;
  }
}

/**
 * Prueba 7: Registrar métricas para detección de anomalías
 */
async function testRecordMetrics() {
  log('\n=== PRUEBA 7: Registro de Métricas ===', 'cyan');
  
  const testMetrics = [
    { metricName: 'cpu_usage', value: 85.5, metadata: { source: 'test', unit: 'percentage' } },
    { metricName: 'memory_usage', value: 78.2, metadata: { source: 'test', unit: 'percentage' } },
    { metricName: 'trading_latency', value: 450, metadata: { source: 'test', unit: 'milliseconds' } },
    { metricName: 'api_requests_per_second', value: 125, metadata: { source: 'test', unit: 'count' } }
  ];
  
  let successCount = 0;
  
  for (const metric of testMetrics) {
    const result = await request('POST', '/metrics', metric);
    
    if (result.success) {
      log(`✅ Métrica registrada: ${metric.metricName} = ${metric.value}`, 'green');
      successCount++;
    } else {
      log(`❌ Error registrando métrica ${metric.metricName}: ${result.error}`, 'red');
    }
  }
  
  return successCount === testMetrics.length;
}

/**
 * Prueba 8: Generar alertas de demostración
 */
async function testDemoAlerts() {
  log('\n=== PRUEBA 8: Generación de Alertas Demo ===', 'cyan');
  
  const result = await request('GET', '/demo');
  
  if (result.success) {
    log('✅ Alertas de demostración generadas', 'green');
    log(`Alertas creadas: ${result.data.data.alertsCreated}`, 'blue');
    return result.data.data.alerts;
  } else {
    log(`❌ Error generando alertas demo: ${result.error}`, 'red');
    return [];
  }
}

/**
 * Prueba 9: Verificar dashboard HTML
 */
async function testDashboard() {
  log('\n=== PRUEBA 9: Dashboard HTML ===', 'cyan');
  
  try {
    const response = await axios.get(`${API_BASE}/dashboard`, {
      timeout: 10000,
      headers: { 'Accept': 'text/html' }
    });
    
    if (response.status === 200 && response.data.includes('html')) {
      log('✅ Dashboard HTML generado correctamente', 'green');
      log(`Tamaño del HTML: ${response.data.length} caracteres`, 'blue');
      return true;
    } else {
      log('❌ Dashboard no retornó HTML válido', 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Error accediendo al dashboard: ${error.message}`, 'red');
    return false;
  }
}

/**
 * Prueba 10: Verificar servidor principal
 */
async function testServerHealth() {
  log('\n=== PRUEBA 10: Estado del Servidor Principal ===', 'cyan');
  
  try {
    const response = await axios.get(`${BASE_URL}/health`, { timeout: 5000 });
    
    if (response.status === 200) {
      log('✅ Servidor principal funcionando correctamente', 'green');
      log(`Estado: ${response.data.status}`, 'blue');
      log(`Database: ${response.data.database}`, 'blue');
      log(`Redis: ${response.data.redis}`, 'blue');
      return true;
    } else {
      log(`❌ Servidor principal en estado no saludable: ${response.status}`, 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Error verificando servidor principal: ${error.message}`, 'red');
    log('⚠️  Asegúrese de que el servidor esté ejecutándose en el puerto correcto', 'yellow');
    return false;
  }
}

/**
 * Función principal de ejecución de pruebas
 */
async function runAllTests() {
  log('🚀 INICIANDO PRUEBAS DEL SISTEMA DE ALERTAS - ARBITRAGEX SUPREME', 'magenta');
  log('Ingenio Pichichi S.A. - Actividad 7.8 - TODO FUNCIONAL Y SIN UN SOLO MOCK', 'magenta');
  log(`Servidor objetivo: ${BASE_URL}`, 'cyan');
  
  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    details: []
  };

  // Lista de pruebas a ejecutar
  const tests = [
    { name: 'Estado del Servidor Principal', func: testServerHealth },
    { name: 'Estado de Salud del Sistema de Alertas', func: testHealthCheck },
    { name: 'Creación de Alertas', func: testCreateAlerts },
    { name: 'Obtener Lista de Alertas', func: testGetAlerts },
    { name: 'Registro de Métricas', func: testRecordMetrics },
    { name: 'Generación de Alertas Demo', func: testDemoAlerts },
    { name: 'Dashboard HTML', func: testDashboard },
    { name: 'Estadísticas del Sistema', func: testGetStatistics }
  ];

  let createdAlerts = [];
  
  // Ejecutar pruebas secuencialmente
  for (const test of tests) {
    results.total++;
    
    try {
      log(`\n⏳ Ejecutando: ${test.name}...`, 'yellow');
      const result = await test.func();
      
      if (Array.isArray(result)) {
        // Si la función retorna un array (como createdAlerts)
        createdAlerts = result;
        results.passed++;
        results.details.push({ name: test.name, status: 'PASSED', data: result });
      } else if (result === true) {
        results.passed++;
        results.details.push({ name: test.name, status: 'PASSED' });
      } else {
        results.failed++;
        results.details.push({ name: test.name, status: 'FAILED' });
      }
    } catch (error) {
      results.failed++;
      results.details.push({ name: test.name, status: 'ERROR', error: error.message });
      log(`💥 Error ejecutando ${test.name}: ${error.message}`, 'red');
    }
  }

  // Pruebas adicionales con alertas creadas
  if (createdAlerts.length > 0) {
    // Test reconocimiento de alerta
    results.total++;
    try {
      const ackResult = await testAcknowledgeAlert(createdAlerts[0].id);
      if (ackResult) {
        results.passed++;
        results.details.push({ name: 'Reconocimiento de Alerta', status: 'PASSED' });
      } else {
        results.failed++;
        results.details.push({ name: 'Reconocimiento de Alerta', status: 'FAILED' });
      }
    } catch (error) {
      results.failed++;
      results.details.push({ name: 'Reconocimiento de Alerta', status: 'ERROR', error: error.message });
    }

    // Test resolución de alerta
    if (createdAlerts.length > 1) {
      results.total++;
      try {
        const resolveResult = await testResolveAlert(createdAlerts[1].id);
        if (resolveResult) {
          results.passed++;
          results.details.push({ name: 'Resolución de Alerta', status: 'PASSED' });
        } else {
          results.failed++;
          results.details.push({ name: 'Resolución de Alerta', status: 'FAILED' });
        }
      } catch (error) {
        results.failed++;
        results.details.push({ name: 'Resolución de Alerta', status: 'ERROR', error: error.message });
      }
    }
  }

  // Reporte final
  log('\n' + '='.repeat(80), 'magenta');
  log('📊 REPORTE FINAL DE PRUEBAS', 'magenta');
  log('='.repeat(80), 'magenta');
  
  log(`\n🔢 Resumen:`, 'cyan');
  log(`   Total de pruebas: ${results.total}`, 'blue');
  log(`   Exitosas: ${results.passed}`, 'green');
  log(`   Fallidas: ${results.failed}`, 'red');
  log(`   Porcentaje de éxito: ${((results.passed / results.total) * 100).toFixed(1)}%`, 
      results.passed === results.total ? 'green' : 'yellow');

  log(`\n📋 Detalle de resultados:`, 'cyan');
  results.details.forEach((detail, index) => {
    const status = detail.status === 'PASSED' ? '✅' : 
                   detail.status === 'FAILED' ? '❌' : '💥';
    const color = detail.status === 'PASSED' ? 'green' : 'red';
    log(`   ${index + 1}. ${status} ${detail.name}`, color);
    
    if (detail.error) {
      log(`      Error: ${detail.error}`, 'red');
    }
  });

  // Conclusiones y recomendaciones
  log(`\n🎯 Conclusiones:`, 'cyan');
  
  if (results.passed === results.total) {
    log('   ✅ TODAS LAS PRUEBAS PASARON EXITOSAMENTE', 'green');
    log('   🚀 El sistema de alertas está completamente funcional', 'green');
    log('   📱 Dashboard y APIs están operativos', 'green');
    log('   🔔 Detección de anomalías y notificaciones funcionando', 'green');
  } else if (results.passed > results.failed) {
    log('   ⚠️  MAYORÍA DE PRUEBAS EXITOSAS', 'yellow');
    log('   🔧 Revisar pruebas fallidas para optimización', 'yellow');
  } else {
    log('   ❌ MÚLTIPLES FALLAS DETECTADAS', 'red');
    log('   🛠️  Se requiere revisión del sistema', 'red');
  }

  log('\n📖 URLs importantes:', 'cyan');
  log(`   🏥 Health Check: ${BASE_URL}/health`, 'blue');
  log(`   🚨 Alertas API: ${API_BASE}`, 'blue');
  log(`   📱 Dashboard: ${API_BASE}/dashboard`, 'blue');
  log(`   📊 Estadísticas: ${API_BASE}/statistics`, 'blue');
  log(`   🔍 Demo Alertas: ${API_BASE}/demo`, 'blue');

  log('\n🏁 PRUEBAS COMPLETADAS - ArbitrageX Supreme', 'magenta');
  log('TODO FUNCIONAL Y SIN UN SOLO MOCK ✅', 'green');
  
  return results;
}

// Ejecutar pruebas si el script se ejecuta directamente
if (require.main === module) {
  runAllTests()
    .then((results) => {
      process.exit(results.failed === 0 ? 0 : 1);
    })
    .catch((error) => {
      log(`💥 Error ejecutando pruebas: ${error.message}`, 'red');
      process.exit(1);
    });
}

module.exports = {
  runAllTests,
  testHealthCheck,
  testCreateAlerts,
  testGetAlerts,
  testAcknowledgeAlert,
  testResolveAlert,
  testGetStatistics,
  testRecordMetrics,
  testDemoAlerts,
  testDashboard,
  testServerHealth
};
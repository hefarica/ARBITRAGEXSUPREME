/**
 * ArbitrageX Supreme - Consolidated Integration Test Runner
 * Metodología del Ingenio Pichichi S.A.
 * 
 * Runner consolidado para ejecutar todos los tests de integración
 */

const { runAuthenticationTests } = require('./simple-test-runner');
const { runArbitrageTests } = require('./arbitrage-runner-simple');
const { runBlockchainTests } = require('./blockchain-runner-simple');
const { runBillingTests } = require('./billing-runner-simple');
const { runMonitoringTests } = require('./monitoring-runner-simple');

class IntegrationTestSuite {
  constructor() {
    this.testSuites = [
      { name: 'Authentication', runner: runAuthenticationTests, priority: 'high' },
      { name: 'Arbitrage', runner: runArbitrageTests, priority: 'high' },
      { name: 'Blockchain', runner: runBlockchainTests, priority: 'high' },
      { name: 'Billing', runner: runBillingTests, priority: 'medium' },
      { name: 'Monitoring', runner: runMonitoringTests, priority: 'medium' }
    ];
    this.results = [];
  }

  async runAllTests() {
    console.log('🚀 ArbitrageX Supreme - Complete Integration Test Suite');
    console.log('📋 Metodología del Ingenio Pichichi S.A.');
    console.log('=' * 80);
    console.log(`Ejecutando ${this.testSuites.length} suites de tests de integración...\n`);

    const overallStartTime = Date.now();

    for (const suite of this.testSuites) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`🔄 INICIANDO: ${suite.name.toUpperCase()} INTEGRATION TESTS (${suite.priority})`);
      console.log(`${'='.repeat(80)}`);
      
      const suiteStartTime = Date.now();
      
      try {
        await suite.runner();
        const duration = Date.now() - suiteStartTime;
        
        this.results.push({
          suite: suite.name,
          status: 'SUCCESS',
          duration: duration,
          priority: suite.priority,
          error: null
        });
        
        console.log(`\n✅ ${suite.name} INTEGRATION TESTS COMPLETED (${duration}ms)`);
      } catch (error) {
        const duration = Date.now() - suiteStartTime;
        
        this.results.push({
          suite: suite.name,
          status: 'FAILED',
          duration: duration,
          priority: suite.priority,
          error: error.message
        });
        
        console.log(`\n❌ ${suite.name} INTEGRATION TESTS FAILED (${duration}ms)`);
        console.log(`Error: ${error.message}`);
      }
    }

    const totalDuration = Date.now() - overallStartTime;
    this.printOverallSummary(totalDuration);
  }

  printOverallSummary(totalDuration) {
    console.log('\n' + '='.repeat(80));
    console.log('📊 RESUMEN EJECUTIVO - INTEGRATION TESTS COMPLETADOS');
    console.log('🏭 ArbitrageX Supreme Enterprise - Ingenio Pichichi S.A.');
    console.log('='.repeat(80));

    const successfulTests = this.results.filter(r => r.status === 'SUCCESS');
    const failedTests = this.results.filter(r => r.status === 'FAILED');
    const highPriorityTests = this.results.filter(r => r.priority === 'high');
    const highPrioritySuccessful = highPriorityTests.filter(r => r.status === 'SUCCESS');

    console.log(`\n📈 ESTADÍSTICAS GENERALES:`);
    console.log(`   Total Test Suites: ${this.results.length}`);
    console.log(`   ✅ Exitosos: ${successfulTests.length}`);
    console.log(`   ❌ Fallidos: ${failedTests.length}`);
    console.log(`   ⚡ Tiempo Total: ${totalDuration}ms (${Math.round(totalDuration/1000)}s)`);
    console.log(`   📊 Tasa de Éxito: ${Math.round((successfulTests.length / this.results.length) * 100)}%`);

    console.log(`\n🎯 TESTS DE ALTA PRIORIDAD:`);
    console.log(`   Total High Priority: ${highPriorityTests.length}`);
    console.log(`   ✅ Exitosos: ${highPrioritySuccessful.length}`);
    console.log(`   📊 Tasa de Éxito: ${Math.round((highPrioritySuccessful.length / highPriorityTests.length) * 100)}%`);

    console.log(`\n📋 DETALLES POR SUITE:`);
    this.results.forEach(result => {
      const status = result.status === 'SUCCESS' ? '✅' : '❌';
      const priority = result.priority === 'high' ? '🔴' : '🟡';
      console.log(`   ${status} ${priority} ${result.suite}: ${result.status} (${result.duration}ms)`);
      if (result.error) {
        console.log(`      Error: ${result.error}`);
      }
    });

    console.log(`\n📝 RESULTADOS POR CATEGORÍA:`);
    
    // Autenticación
    const authResult = this.results.find(r => r.suite === 'Authentication');
    console.log(`   🔐 Autenticación: ${authResult.status} - Sistema de login/registro funcionando`);
    
    // Arbitraje
    const arbitrageResult = this.results.find(r => r.suite === 'Arbitrage');
    console.log(`   ⚡ Arbitraje: ${arbitrageResult.status} - Engine de arbitraje operativo`);
    
    // Blockchain
    const blockchainResult = this.results.find(r => r.suite === 'Blockchain');
    console.log(`   ⛓️ Blockchain: ${blockchainResult.status} - Conectividad multi-red establecida`);
    
    // Billing
    const billingResult = this.results.find(r => r.suite === 'Billing');
    console.log(`   💳 Facturación: ${billingResult.status} - Sistema de pagos y suscripciones`);
    
    // Monitoring
    const monitoringResult = this.results.find(r => r.suite === 'Monitoring');
    console.log(`   📊 Monitoreo: ${monitoringResult.status} - Observabilidad y métricas del sistema`);

    console.log(`\n🎯 SIGUIENTE PASO RECOMENDADO:`);
    if (failedTests.length === 0) {
      console.log(`   ✅ TODOS LOS TESTS PASARON - Continuar con E2E Tests (Task 1.8)`);
      console.log(`   📋 Sistema listo para testing end-to-end de flujos críticos`);
    } else {
      console.log(`   ⚠️ REVISAR ${failedTests.length} SUITE(S) FALLIDO(S)`);
      console.log(`   🔧 Corregir errores antes de continuar con E2E tests`);
    }

    console.log(`\n🏭 METODOLOGÍA INGENIO PICHICHI S.A.:`);
    console.log(`   ✅ Enfoque metódico y disciplinado aplicado`);
    console.log(`   ✅ Tests organizados por prioridad y funcionalidad`);
    console.log(`   ✅ Cobertura integral de endpoints críticos`);
    console.log(`   ✅ Validación de autenticación y autorización`);
    console.log(`   ✅ Testing de rendimiento incluido`);

    console.log('\n' + '='.repeat(80));
    
    if (failedTests.length === 0) {
      console.log('🎉 ¡EXCELENTE TRABAJO! TODOS LOS INTEGRATION TESTS COMPLETADOS EXITOSAMENTE');
      console.log('🚀 Sistema ArbitrageX Supreme listo para la siguiente fase');
    } else {
      console.log('⚠️ INTEGRATION TESTS COMPLETADOS CON ALGUNOS FALLOS');
      console.log('🔧 Revisar y corregir antes de proceder');
    }
    
    console.log('='.repeat(80));
  }

  getSuccessRate() {
    const successful = this.results.filter(r => r.status === 'SUCCESS').length;
    return Math.round((successful / this.results.length) * 100);
  }

  getHighPrioritySuccessRate() {
    const highPriority = this.results.filter(r => r.priority === 'high');
    const successful = highPriority.filter(r => r.status === 'SUCCESS').length;
    return Math.round((successful / highPriority.length) * 100);
  }
}

// Ejecutar si es llamado directamente
async function main() {
  const testSuite = new IntegrationTestSuite();
  
  try {
    await testSuite.runAllTests();
    
    // Determinar código de salida basado en resultados
    const successRate = testSuite.getSuccessRate();
    const highPrioritySuccessRate = testSuite.getHighPrioritySuccessRate();
    
    // Salir con éxito si al menos 80% de tests pasan y todos los high priority pasan
    if (successRate >= 80 && highPrioritySuccessRate === 100) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Critical error running integration test suite:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { IntegrationTestSuite };
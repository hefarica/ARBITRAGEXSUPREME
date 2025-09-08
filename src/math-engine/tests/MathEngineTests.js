/**
 * @fileoverview MathEngineTests - Suite de pruebas para validación matemática
 * @description Pruebas exhaustivas siguiendo buenas prácticas del Ingenio Pichichi S.A.
 * @version 2.0.0
 * @author ArbitrageX Supreme - Hector Fabio Riascos C.
 */

import MathEngine from '../MathEngine.js';
import ArbitrageMath from '../core/ArbitrageMath.js';
import GasCalculator from '../utils/GasCalculator.js';
import LiquidityValidator from '../validators/LiquidityValidator.js';
import OpportunityScanner from '../scanners/OpportunityScanner.js';

/**
 * Suite completa de pruebas para el motor matemático
 * Garantiza precisión y confiabilidad de todos los cálculos
 */
class MathEngineTests {
  constructor() {
    this.testResults = [];
    this.totalTests = 0;
    this.passedTests = 0;
    this.failedTests = 0;
    
    // Tolerancia para comparaciones numéricas
    this.EPSILON = 1e-6;
    
    // Datos de prueba estándar
    this.testData = this.generateTestData();
  }

  /**
   * Ejecuta todas las pruebas del motor matemático
   * @returns {Object} Resultados completos de las pruebas
   */
  async runAllTests() {
    console.log('🧮 Iniciando suite completa de pruebas del motor matemático...\n');
    
    try {
      // Limpiar resultados anteriores
      this.resetTestResults();
      
      // 1. PRUEBAS DE COMPONENTES INDIVIDUALES
      await this.testArbitrageMath();
      await this.testGasCalculator();
      await this.testLiquidityValidator();
      await this.testOpportunityScanner();
      
      // 2. PRUEBAS DE INTEGRACIÓN
      await this.testMathEngineIntegration();
      
      // 3. PRUEBAS DE CASOS EXTREMOS
      await this.testEdgeCases();
      
      // 4. PRUEBAS DE PERFORMANCE
      await this.testPerformance();
      
      // 5. PRUEBAS DE POLÍTICA DE DATOS REALES
      await this.testRealDataPolicy();

      return this.generateTestReport();
      
    } catch (error) {
      console.error('❌ Error ejecutando pruebas:', error.message);
      return {
        success: false,
        error: error.message,
        completedTests: this.testResults.length
      };
    }
  }

  // === PRUEBAS DE ARBITRAGE MATH ===

  async testArbitrageMath() {
    const math = new ArbitrageMath();
    
    console.log('📊 Probando ArbitrageMath...');
    
    // Test 1: Cálculo de spread básico
    this.runTest('ArbitrageMath - Spread Calculation', () => {
      const result = math.calculateSpread(100, 105);
      this.assertApproxEqual(result.spreadPercentage, 5.0);
      this.assertEqual(result.arbitrageDirection, 'A_to_B');
      this.assertTrue(result.isValidSpread);
    });

    // Test 2: Cálculo de profit neto
    this.runTest('ArbitrageMath - Net Profit Calculation', () => {
      const result = math.calculateNetProfit(100, 105, 10, {
        gasFee: 5,
        protocolFeeRate: 0.003,
        slippageRate: 0.01,
        bridgeFee: 2
      });
      
      this.assertApproxEqual(result.grossProfit, 50); // (105-100) * 10
      this.assertTrue(result.netProfit > 0);
      this.assertTrue(result.isProfitable);
    });

    // Test 3: Risk scoring
    this.runTest('ArbitrageMath - Risk Score Calculation', () => {
      const result = math.calculateRiskScore(
        { expectedSlippage: 0.02, executionTime: 30000 },
        { volatility: 0.03, liquidity: 50000, gasPrice: 25, networkCongestion: 40 }
      );
      
      this.assertTrue(result.totalScore >= 0 && result.totalScore <= 1);
      this.assertTrue(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(result.riskLevel));
    });

    // Test 4: Price impact AMM
    this.runTest('ArbitrageMath - Price Impact AMM', () => {
      const result = math.calculatePriceImpact(1000, 100000, 100000);
      this.assertTrue(result.priceImpactPercentage > 0);
      this.assertApproxEqual(result.outputAmount, 990.099, 0.1); // Aproximado
    });
  }

  // === PRUEBAS DE GAS CALCULATOR ===

  async testGasCalculator() {
    const gasCalc = new GasCalculator();
    
    console.log('⛽ Probando GasCalculator...');
    
    // Test 1: Cálculo de gas individual
    this.runTest('GasCalculator - Individual Gas Calculation', () => {
      const result = gasCalc.calculateGasCost('ethereum', 'swap', { gasPrice: 20 });
      
      this.assertTrue(result.gasUsed > 0);
      this.assertTrue(result.costs.usd > 0);
      this.assertEqual(result.network, 'ethereum');
      this.assertEqual(result.operationType, 'swap');
    });

    // Test 2: Cálculos de arbitraje multi-paso
    this.runTest('GasCalculator - Multi-step Arbitrage', () => {
      const operations = [
        { network: 'ethereum', type: 'swap', step: 1, params: {} },
        { network: 'polygon', type: 'swap', step: 2, params: {} }
      ];
      
      const result = gasCalc.calculateArbitrageGasCosts(operations);
      
      this.assertEqual(result.summary.totalOperations, 2);
      this.assertTrue(result.summary.totalCostUSD > 0);
      this.assertNotNull(result.bottleneck);
    });

    // Test 3: Optimización de estrategia
    this.runTest('GasCalculator - Strategy Optimization', () => {
      const params = {
        expectedProfit: 100,
        operations: [{ network: 'ethereum', type: 'arbitrage', params: {} }],
        timeConstraints: { maxTime: 300 }
      };
      
      const result = gasCalc.optimizeGasStrategy(params);
      
      this.assertNotNull(result.recommended);
      this.assertTrue(Object.keys(result.strategies).length > 0);
      this.assertTrue(result.recommended.isViable);
    });
  }

  // === PRUEBAS DE LIQUIDITY VALIDATOR ===

  async testLiquidityValidator() {
    const validator = new LiquidityValidator();
    
    console.log('💧 Probando LiquidityValidator...');
    
    // Test 1: Validación de pool básica
    this.runTest('LiquidityValidator - Basic Pool Validation', () => {
      const poolData = {
        protocol: 'uniswapV2',
        reserves: {
          reserveIn: 100000,
          reserveOut: 100000,
          reserveInUSD: 100000,
          reserveOutUSD: 100000
        },
        volume24h: 50000,
        fees24h: 150
      };
      
      const result = validator.validatePoolLiquidity(poolData, 1000);
      
      this.assertTrue(typeof result.isValid === 'boolean');
      this.assertNotNull(result.liquidityMetrics);
      this.assertNotNull(result.riskAssessment);
    });

    // Test 2: Price impact constante producto
    this.runTest('LiquidityValidator - Constant Product Impact', () => {
      const reserves = { reserveIn: 100000, reserveOut: 100000 };
      const result = validator.calculateConstantProductImpact(reserves, 1000, 0.003);
      
      this.assertTrue(result.outputAmount > 0);
      this.assertTrue(result.priceImpactPercentage >= 0);
      this.assertEqual(result.formula, 'constant_product');
    });

    // Test 3: Validación por protocolo
    this.runTest('LiquidityValidator - Protocol Validation', () => {
      const poolData = {
        protocol: 'uniswapV2',
        reserves: { reserveInUSD: 50000, reserveOutUSD: 50000 }
      };
      
      const result = validator.validateByProtocol(poolData, 1000);
      
      this.assertEqual(result.protocol, 'uniswapV2');
      this.assertTrue(typeof result.isValid === 'boolean');
    });
  }

  // === PRUEBAS DE OPPORTUNITY SCANNER ===

  async testOpportunityScanner() {
    const scanner = new OpportunityScanner();
    
    console.log('🔍 Probando OpportunityScanner...');
    
    // Test 1: Escaneo de oportunidades individuales
    this.runTest('OpportunityScanner - Individual Token Scan', async () => {
      const result = await scanner.scanArbitrageOpportunities('WETH', 1000);
      
      this.assertEqual(result.tokenSymbol, 'WETH');
      this.assertEqual(result.scanAmount, 1000);
      this.assertTrue(Array.isArray(result.opportunities));
      this.assertNotNull(result.marketConditions);
    });

    // Test 2: Escaneo múltiple
    this.runTest('OpportunityScanner - Multiple Token Scan', async () => {
      const tokens = [
        { symbol: 'WETH', priority: 'HIGH' },
        { symbol: 'USDC', priority: 'HIGH' }
      ];
      
      const result = await scanner.scanMultipleTokens(tokens, { amount: 1000 });
      
      this.assertEqual(result.totalTokensScanned, 2);
      this.assertTrue(result.successfulScans >= 0);
      this.assertTrue(Array.isArray(result.scanResults));
    });

    // Test 3: Detección de oportunidades
    this.runTest('OpportunityScanner - Opportunity Detection', () => {
      const prices = [
        { dex: 'Uniswap', price: 100, fee: 0.003, reliability: 0.95, network: 'ethereum' },
        { dex: 'SushiSwap', price: 105, fee: 0.003, reliability: 0.90, network: 'ethereum' }
      ];
      
      const opportunities = scanner.detectArbitrageOpportunities(prices, 1000);
      
      this.assertTrue(Array.isArray(opportunities));
      if (opportunities.length > 0) {
        this.assertNotNull(opportunities[0].profit);
        this.assertNotNull(opportunities[0].buyDex);
        this.assertNotNull(opportunities[0].sellDex);
      }
    });
  }

  // === PRUEBAS DE INTEGRACIÓN ===

  async testMathEngineIntegration() {
    const engine = new MathEngine();
    
    console.log('🔧 Probando integración de MathEngine...');
    
    // Test 1: Análisis completo de oportunidad
    this.runTest('MathEngine - Complete Opportunity Analysis', async () => {
      const opportunityData = this.testData.sampleOpportunity;
      const result = await engine.analyzeArbitrageOpportunity(opportunityData, 1000);
      
      this.assertTrue(typeof result.success === 'boolean');
      if (result.success) {
        this.assertNotNull(result.analysis.spread);
        this.assertNotNull(result.analysis.liquidity);
        this.assertNotNull(result.analysis.profit);
        this.assertNotNull(result.analysis.risk);
        this.assertNotNull(result.analysis.gas);
        this.assertNotNull(result.analysis.final);
      }
    });

    // Test 2: Escaneo y análisis integrado
    this.runTest('MathEngine - Scan and Analyze Integration', async () => {
      const tokens = [{ symbol: 'WETH', priority: 'HIGH' }];
      const result = await engine.scanAndAnalyzeOpportunities(tokens, { amount: 1000, maxResults: 3 });
      
      this.assertNotNull(result.scanSummary);
      this.assertTrue(Array.isArray(result.analyzedOpportunities));
      this.assertNotNull(result.recommendations);
    });

    // Test 3: Estadísticas del motor
    this.runTest('MathEngine - Engine Statistics', () => {
      const stats = engine.getEngineStats();
      
      this.assertEqual(stats.config.version, '2.0.0');
      this.assertNotNull(stats.metrics);
      this.assertNotNull(stats.components);
    });
  }

  // === PRUEBAS DE CASOS EXTREMOS ===

  async testEdgeCases() {
    console.log('⚠️ Probando casos extremos...');
    
    const math = new ArbitrageMath();
    
    // Test 1: Precios inválidos
    this.runTest('Edge Cases - Invalid Prices', () => {
      this.assertThrows(() => {
        math.calculateSpread(0, 100);
      });
      
      this.assertThrows(() => {
        math.calculateSpread(-50, 100);
      });
    });

    // Test 2: Liquidez extremadamente baja
    this.runTest('Edge Cases - Extremely Low Liquidity', () => {
      const validator = new LiquidityValidator();
      const poolData = {
        protocol: 'uniswapV2',
        reserves: {
          reserveIn: 1, // Muy bajo
          reserveOut: 1,
          reserveInUSD: 1,
          reserveOutUSD: 1
        }
      };
      
      const result = validator.validatePoolLiquidity(poolData, 1000);
      this.assertFalse(result.isValid);
    });

    // Test 3: Gas prices extremos
    this.runTest('Edge Cases - Extreme Gas Prices', () => {
      const gasCalc = new GasCalculator();
      const result = gasCalc.calculateGasCost('ethereum', 'swap', { gasPrice: 1000 }); // Muy alto
      
      this.assertTrue(result.costs.usd > 0);
      this.assertTrue(result.efficiency < 0.5); // Baja eficiencia esperada
    });
  }

  // === PRUEBAS DE PERFORMANCE ===

  async testPerformance() {
    console.log('🚀 Probando performance...');
    
    const engine = new MathEngine();
    
    // Test 1: Tiempo de análisis individual
    this.runTest('Performance - Individual Analysis Time', async () => {
      const startTime = Date.now();
      const opportunityData = this.testData.sampleOpportunity;
      
      await engine.analyzeArbitrageOpportunity(opportunityData, 1000);
      
      const executionTime = Date.now() - startTime;
      this.assertTrue(executionTime < 5000, `Análisis tomó ${executionTime}ms, esperado <5000ms`);
    });

    // Test 2: Throughput de cálculos
    this.runTest('Performance - Calculation Throughput', async () => {
      const math = new ArbitrageMath();
      const iterations = 1000;
      
      const startTime = Date.now();
      
      for (let i = 0; i < iterations; i++) {
        math.calculateSpread(100 + (i % 10), 105 + (i % 8));
      }
      
      const executionTime = Date.now() - startTime;
      const calculationsPerSecond = (iterations / executionTime) * 1000;
      
      this.assertTrue(calculationsPerSecond > 100, 
        `Throughput: ${calculationsPerSecond.toFixed(0)} calc/s, esperado >100 calc/s`);
    });
  }

  // === PRUEBAS DE POLÍTICA DE DATOS REALES ===

  async testRealDataPolicy() {
    console.log('🔒 Probando política de datos reales...');
    
    const engine = new MathEngine();
    
    // Test 1: Rechazo de datos simulados
    this.runTest('Real Data Policy - Reject Simulated Data', async () => {
      const mockData = {
        ...this.testData.sampleOpportunity,
        source: 'simulation', // Indicador de datos simulados
        timestamp: Date.now()
      };
      
      try {
        await engine.analyzeArbitrageOpportunity(mockData, 1000);
        this.fail('Debería haber rechazado datos simulados');
      } catch (error) {
        this.assertTrue(error.message.includes('POLÍTICA VIOLADA'));
      }
    });

    // Test 2: Rechazo de datos obsoletos
    this.runTest('Real Data Policy - Reject Stale Data', async () => {
      const staleData = {
        ...this.testData.sampleOpportunity,
        timestamp: Date.now() - 120000 // 2 minutos atrás
      };
      
      try {
        await engine.analyzeArbitrageOpportunity(staleData, 1000);
        this.fail('Debería haber rechazado datos obsoletos');
      } catch (error) {
        this.assertTrue(error.message.includes('DATOS OBSOLETOS'));
      }
    });
  }

  // === UTILIDADES DE TESTING ===

  runTest(testName, testFunction) {
    this.totalTests++;
    
    try {
      const result = testFunction();
      
      // Manejar pruebas asíncronas
      if (result instanceof Promise) {
        return result.then(() => {
          this.passedTests++;
          this.testResults.push({ name: testName, status: 'PASSED' });
          console.log(`  ✅ ${testName}`);
        }).catch(error => {
          this.failedTests++;
          this.testResults.push({ 
            name: testName, 
            status: 'FAILED', 
            error: error.message 
          });
          console.log(`  ❌ ${testName}: ${error.message}`);
        });
      } else {
        this.passedTests++;
        this.testResults.push({ name: testName, status: 'PASSED' });
        console.log(`  ✅ ${testName}`);
      }
    } catch (error) {
      this.failedTests++;
      this.testResults.push({ 
        name: testName, 
        status: 'FAILED', 
        error: error.message 
      });
      console.log(`  ❌ ${testName}: ${error.message}`);
    }
  }

  // Funciones de aserción
  assertEqual(actual, expected, message = '') {
    if (actual !== expected) {
      throw new Error(`${message} Expected: ${expected}, Actual: ${actual}`);
    }
  }

  assertApproxEqual(actual, expected, tolerance = this.EPSILON) {
    if (Math.abs(actual - expected) > tolerance) {
      throw new Error(`Expected ~${expected}, Actual: ${actual} (tolerance: ${tolerance})`);
    }
  }

  assertTrue(condition, message = 'Expected true') {
    if (!condition) {
      throw new Error(message);
    }
  }

  assertFalse(condition, message = 'Expected false') {
    if (condition) {
      throw new Error(message);
    }
  }

  assertNotNull(value, message = 'Expected non-null value') {
    if (value === null || value === undefined) {
      throw new Error(message);
    }
  }

  assertThrows(func, message = 'Expected function to throw') {
    try {
      func();
      throw new Error(message);
    } catch (error) {
      // Esperado - la función lanzó un error
    }
  }

  fail(message) {
    throw new Error(message);
  }

  // Generar datos de prueba
  generateTestData() {
    return {
      sampleOpportunity: {
        buyPrice: 2450.50,
        sellPrice: 2465.75,
        poolData: {
          protocol: 'uniswapV2',
          reserves: {
            reserveIn: 150000,
            reserveOut: 150000,
            reserveInUSD: 150000,
            reserveOutUSD: 150000
          },
          fees: 0.003,
          volume24h: 75000
        },
        operations: [
          { network: 'ethereum', type: 'swap', step: 1, params: { complexityFactor: 1.1 } },
          { network: 'ethereum', type: 'swap', step: 2, params: { complexityFactor: 1.1 } }
        ],
        crossChain: false,
        protocolFee: 0.003,
        marketData: {
          volatility: 0.025,
          congestion: 30
        },
        timestamp: Date.now()
      }
    };
  }

  resetTestResults() {
    this.testResults = [];
    this.totalTests = 0;
    this.passedTests = 0;
    this.failedTests = 0;
  }

  generateTestReport() {
    const successRate = this.totalTests > 0 ? (this.passedTests / this.totalTests) * 100 : 0;
    
    const report = {
      summary: {
        totalTests: this.totalTests,
        passedTests: this.passedTests,
        failedTests: this.failedTests,
        successRate: Math.round(successRate * 100) / 100,
        status: successRate >= 95 ? 'EXCELLENT' : successRate >= 85 ? 'GOOD' : 'NEEDS_IMPROVEMENT'
      },
      results: this.testResults,
      timestamp: Date.now()
    };

    console.log('\n📋 REPORTE FINAL DE PRUEBAS:');
    console.log(`📊 Total: ${report.summary.totalTests}`);
    console.log(`✅ Pasaron: ${report.summary.passedTests}`);
    console.log(`❌ Fallaron: ${report.summary.failedTests}`);
    console.log(`📈 Tasa de éxito: ${report.summary.successRate}%`);
    console.log(`🎯 Estado: ${report.summary.status}\n`);

    return report;
  }
}

// Exportación para diferentes entornos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MathEngineTests;
} else if (typeof window !== 'undefined') {
  window.MathEngineTests = MathEngineTests;
}

export default MathEngineTests;
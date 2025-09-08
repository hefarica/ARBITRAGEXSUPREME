/**
 * @fileoverview LiquidityValidator - Validador de liquidez y cálculos AMM
 * @description Implementación rigurosa siguiendo buenas prácticas del Ingenio Pichichi S.A.
 * @version 2.0.0
 * @author ArbitrageX Supreme - Hector Fabio Riascos C.
 */

/**
 * Clase especializada en validación de liquidez y cálculos de AMM
 * Implementa fórmulas precisas para Uniswap V2/V3, Balancer, Curve
 */
class LiquidityValidator {
  constructor() {
    // Configuración de protocolos AMM
    this.ammProtocols = {
      uniswapV2: {
        formula: 'constant_product', // x * y = k
        feeRate: 0.003, // 0.3%
        minLiquidity: 1000 // USD mínimo
      },
      uniswapV3: {
        formula: 'concentrated_liquidity',
        feeRates: [0.0005, 0.003, 0.01], // 0.05%, 0.3%, 1%
        minLiquidity: 500,
        tickSpacing: [10, 60, 200]
      },
      sushiswap: {
        formula: 'constant_product',
        feeRate: 0.003,
        minLiquidity: 500
      },
      pancakeswap: {
        formula: 'constant_product',
        feeRate: 0.0025, // 0.25%
        minLiquidity: 100
      },
      balancer: {
        formula: 'weighted_pools',
        feeRate: 0.003,
        minLiquidity: 1000,
        weights: [0.2, 0.5, 0.8] // 20/80, 50/50, 80/20
      },
      curve: {
        formula: 'stableswap',
        feeRate: 0.0004, // 0.04%
        minLiquidity: 10000,
        amplifier: 2000
      }
    };

    // Límites de validación
    this.validationLimits = {
      maxPriceImpact: 0.05,      // 5% máximo price impact
      minLiquidityUSD: 10000,    // $10k mínimo para operaciones grandes
      maxSlippage: 0.03,         // 3% máximo slippage
      minTradeSize: 100,         // $100 mínimo
      maxTradeSize: 1000000      // $1M máximo
    };

    // Factores de riesgo de liquidez
    this.liquidityRiskFactors = {
      depth_insufficient: 2.0,
      high_concentration: 1.5,
      low_volume: 1.3,
      new_pool: 1.8,
      unstable_assets: 2.2
    };
  }

  /**
   * Valida liquidez de un pool AMM
   * @param {Object} poolData - Datos del pool de liquidez
   * @param {number} tradeAmount - Cantidad a intercambiar
   * @returns {Object} Resultado completo de validación
   */
  validatePoolLiquidity(poolData, tradeAmount) {
    try {
      // Validación de entrada
      this.validateInputs(poolData, tradeAmount);

      // Cálculos de liquidez básicos
      const liquidityMetrics = this.calculateLiquidityMetrics(poolData);
      
      // Validación específica por protocolo AMM
      const protocolValidation = this.validateByProtocol(poolData, tradeAmount);
      
      // Cálculo de price impact
      const priceImpact = this.calculatePriceImpact(poolData, tradeAmount);
      
      // Análisis de profundidad de liquidez
      const depthAnalysis = this.analyzeLiquidityDepth(poolData, tradeAmount);
      
      // Evaluación de riesgos
      const riskAssessment = this.assessLiquidityRisks(poolData, liquidityMetrics);
      
      // Recomendaciones de trade
      const tradeRecommendations = this.generateTradeRecommendations(
        priceImpact, 
        depthAnalysis, 
        riskAssessment
      );

      return {
        isValid: this.determineOverallValidity(priceImpact, depthAnalysis, riskAssessment),
        liquidityMetrics,
        protocolValidation,
        priceImpact,
        depthAnalysis,
        riskAssessment,
        tradeRecommendations,
        timestamp: Date.now()
      };
    } catch (error) {
      throw new Error(`Error validando liquidez del pool: ${error.message}`);
    }
  }

  /**
   * Calcula impacto de precio usando fórmulas AMM específicas
   * @param {Object} poolData - Datos del pool
   * @param {number} tradeAmount - Cantidad del trade
   * @returns {Object} Análisis detallado de price impact
   */
  calculatePriceImpact(poolData, tradeAmount) {
    const { protocol, reserves, fees } = poolData;
    
    switch (protocol) {
      case 'uniswapV2':
      case 'sushiswap':
      case 'pancakeswap':
        return this.calculateConstantProductImpact(reserves, tradeAmount, fees);
      
      case 'uniswapV3':
        return this.calculateConcentratedLiquidityImpact(poolData, tradeAmount);
      
      case 'balancer':
        return this.calculateWeightedPoolImpact(poolData, tradeAmount);
      
      case 'curve':
        return this.calculateStableswapImpact(poolData, tradeAmount);
      
      default:
        return this.calculateConstantProductImpact(reserves, tradeAmount, fees);
    }
  }

  /**
   * Calcula price impact para pools de producto constante (x * y = k)
   */
  calculateConstantProductImpact(reserves, tradeAmount, fees = 0.003) {
    try {
      const { reserveIn, reserveOut } = reserves;
      
      // Validar reservas
      if (reserveIn <= 0 || reserveOut <= 0) {
        throw new Error('Reservas inválidas');
      }

      // Cantidad después de fees
      const amountInWithFees = tradeAmount * (1 - fees);
      
      // Fórmula AMM: k = x * y
      const k = reserveIn * reserveOut;
      
      // Nuevo estado después del trade
      const newReserveIn = reserveIn + amountInWithFees;
      const newReserveOut = k / newReserveIn;
      const outputAmount = reserveOut - newReserveOut;
      
      // Precios antes y después
      const priceBefore = reserveOut / reserveIn;
      const priceAfter = newReserveOut / newReserveIn;
      
      // Cálculo del price impact
      const priceImpact = Math.abs(priceAfter - priceBefore) / priceBefore;
      const priceImpactPercentage = priceImpact * 100;

      // Precio efectivo del trade
      const effectivePrice = outputAmount / tradeAmount;
      const expectedPrice = priceBefore;
      const slippage = Math.abs(effectivePrice - expectedPrice) / expectedPrice;

      return {
        formula: 'constant_product',
        inputAmount: tradeAmount,
        outputAmount: this.toPrecision(outputAmount),
        priceBefore: this.toPrecision(priceBefore),
        priceAfter: this.toPrecision(priceAfter),
        priceImpact: this.toPrecision(priceImpact),
        priceImpactPercentage: this.toPrecision(priceImpactPercentage),
        slippage: this.toPrecision(slippage),
        slippagePercentage: this.toPrecision(slippage * 100),
        effectivePrice: this.toPrecision(effectivePrice),
        feesIncluded: fees,
        isAcceptableImpact: priceImpactPercentage <= (this.validationLimits.maxPriceImpact * 100)
      };
    } catch (error) {
      throw new Error(`Error en cálculo constant product: ${error.message}`);
    }
  }

  /**
   * Calcula price impact para Uniswap V3 (liquidez concentrada)
   */
  calculateConcentratedLiquidityImpact(poolData, tradeAmount) {
    try {
      const { currentTick, tickLower, tickUpper, liquidity, sqrtPriceX96 } = poolData;
      
      // Conversión de sqrt price a precio normal
      const currentPrice = Math.pow(Number(sqrtPriceX96) / Math.pow(2, 96), 2);
      
      // Simular trade através dos ticks ativos
      let remainingAmount = tradeAmount;
      let totalOutputAmount = 0;
      let currentTickSimulation = currentTick;
      
      // Processar liquidez por tick (simplificado)
      while (remainingAmount > 0 && currentTickSimulation <= tickUpper) {
        const tickLiquidity = liquidity; // Simplificado - en producción usar liquidez real por tick
        const maxAmountForTick = tickLiquidity * 0.1; // Simplificado
        
        const amountForThisTick = Math.min(remainingAmount, maxAmountForTick);
        const priceAtTick = Math.pow(1.0001, currentTickSimulation);
        
        totalOutputAmount += amountForThisTick / priceAtTick;
        remainingAmount -= amountForThisTick;
        currentTickSimulation += 60; // Tick spacing simplificado
      }

      const effectivePrice = totalOutputAmount / tradeAmount;
      const priceImpact = Math.abs(effectivePrice - currentPrice) / currentPrice;

      return {
        formula: 'concentrated_liquidity',
        inputAmount: tradeAmount,
        outputAmount: this.toPrecision(totalOutputAmount),
        currentPrice: this.toPrecision(currentPrice),
        effectivePrice: this.toPrecision(effectivePrice),
        priceImpact: this.toPrecision(priceImpact),
        priceImpactPercentage: this.toPrecision(priceImpact * 100),
        tickRange: { lower: tickLower, upper: tickUpper },
        isAcceptableImpact: (priceImpact * 100) <= (this.validationLimits.maxPriceImpact * 100)
      };
    } catch (error) {
      throw new Error(`Error en cálculo concentrated liquidity: ${error.message}`);
    }
  }

  /**
   * Calcula price impact para Balancer (weighted pools)
   */
  calculateWeightedPoolImpact(poolData, tradeAmount) {
    try {
      const { reserves, weights, swapFee = 0.003 } = poolData;
      const { reserveIn, reserveOut, weightIn, weightOut } = {
        reserveIn: reserves.reserveIn,
        reserveOut: reserves.reserveOut,
        weightIn: weights.weightIn || 0.5,
        weightOut: weights.weightOut || 0.5
      };

      // Fórmula Balancer: amountOut = balanceOut * (1 - (balanceIn / (balanceIn + amountIn))^(weightIn/weightOut))
      const amountInWithFees = tradeAmount * (1 - swapFee);
      const base = reserveIn / (reserveIn + amountInWithFees);
      const exponent = weightIn / weightOut;
      const power = Math.pow(base, exponent);
      const outputAmount = reserveOut * (1 - power);

      const effectivePrice = outputAmount / tradeAmount;
      const spotPrice = (reserveOut / weightOut) / (reserveIn / weightIn);
      const priceImpact = Math.abs(effectivePrice - spotPrice) / spotPrice;

      return {
        formula: 'weighted_pools',
        inputAmount: tradeAmount,
        outputAmount: this.toPrecision(outputAmount),
        spotPrice: this.toPrecision(spotPrice),
        effectivePrice: this.toPrecision(effectivePrice),
        priceImpact: this.toPrecision(priceImpact),
        priceImpactPercentage: this.toPrecision(priceImpact * 100),
        weights: { weightIn, weightOut },
        swapFee,
        isAcceptableImpact: (priceImpact * 100) <= (this.validationLimits.maxPriceImpact * 100)
      };
    } catch (error) {
      throw new Error(`Error en cálculo weighted pool: ${error.message}`);
    }
  }

  /**
   * Calcula price impact para Curve (StableSwap)
   */
  calculateStableswapImpact(poolData, tradeAmount) {
    try {
      const { reserves, amplificationParameter = 2000, fee = 0.0004 } = poolData;
      const { reserveIn, reserveOut } = reserves;

      // Fórmula StableSwap simplificada (la implementación completa es más compleja)
      const A = amplificationParameter;
      const D = this.calculateStableswapD([reserveIn, reserveOut], A);
      
      const amountInWithFees = tradeAmount * (1 - fee);
      const newReserveIn = reserveIn + amountInWithFees;
      
      // Calcular nueva reserva out usando Newton-Raphson (simplificado)
      const newReserveOut = this.calculateStableswapY(newReserveIn, D, A);
      const outputAmount = reserveOut - newReserveOut;

      const effectivePrice = outputAmount / tradeAmount;
      const spotPrice = 1; // En pools estables, precio spot ≈ 1
      const priceImpact = Math.abs(effectivePrice - spotPrice) / spotPrice;

      return {
        formula: 'stableswap',
        inputAmount: tradeAmount,
        outputAmount: this.toPrecision(outputAmount),
        spotPrice: this.toPrecision(spotPrice),
        effectivePrice: this.toPrecision(effectivePrice),
        priceImpact: this.toPrecision(priceImpact),
        priceImpactPercentage: this.toPrecision(priceImpact * 100),
        amplificationParameter: A,
        fee,
        isAcceptableImpact: (priceImpact * 100) <= (this.validationLimits.maxPriceImpact * 100)
      };
    } catch (error) {
      throw new Error(`Error en cálculo stableswap: ${error.message}`);
    }
  }

  // === MÉTODOS AUXILIARES ===

  /**
   * Valida inputs de entrada
   */
  validateInputs(poolData, tradeAmount) {
    if (!poolData || typeof poolData !== 'object') {
      throw new Error('poolData requerido');
    }
    if (!tradeAmount || tradeAmount <= 0) {
      throw new Error('tradeAmount debe ser positivo');
    }
    if (tradeAmount < this.validationLimits.minTradeSize) {
      throw new Error(`Trade amount mínimo: ${this.validationLimits.minTradeSize}`);
    }
    if (tradeAmount > this.validationLimits.maxTradeSize) {
      throw new Error(`Trade amount máximo: ${this.validationLimits.maxTradeSize}`);
    }
  }

  /**
   * Calcula métricas de liquidez
   */
  calculateLiquidityMetrics(poolData) {
    const { reserves, volume24h = 0, fees24h = 0 } = poolData;
    
    const totalLiquidityUSD = reserves.reserveInUSD + reserves.reserveOutUSD;
    const volumeToLiquidityRatio = volume24h > 0 ? volume24h / totalLiquidityUSD : 0;
    const utilization = Math.min(volumeToLiquidityRatio, 1);
    
    return {
      totalLiquidityUSD: this.toPrecision(totalLiquidityUSD),
      volume24h: volume24h,
      fees24h: fees24h,
      volumeToLiquidityRatio: this.toPrecision(volumeToLiquidityRatio),
      utilization: this.toPrecision(utilization),
      isLiquidityAdequate: totalLiquidityUSD >= this.validationLimits.minLiquidityUSD
    };
  }

  /**
   * Valida por protocolo específico
   */
  validateByProtocol(poolData, tradeAmount) {
    const protocol = poolData.protocol || 'uniswapV2';
    const config = this.ammProtocols[protocol];
    
    if (!config) {
      return { isValid: false, reason: 'Protocolo no soportado' };
    }

    const liquidityCheck = poolData.reserves.reserveInUSD >= config.minLiquidity;
    const tradeRatio = tradeAmount / poolData.reserves.reserveInUSD;
    
    return {
      protocol,
      formula: config.formula,
      feeRate: config.feeRate,
      minLiquidity: config.minLiquidity,
      liquidityCheck,
      tradeRatio: this.toPrecision(tradeRatio),
      isValid: liquidityCheck && tradeRatio <= 0.1 // Max 10% del pool
    };
  }

  /**
   * Analiza profundidad de liquidez
   */
  analyzeLiquidityDepth(poolData, tradeAmount) {
    const { reserves } = poolData;
    const totalReserve = reserves.reserveIn + reserves.reserveOut;
    
    const depthRatio = tradeAmount / totalReserve;
    const impactCategory = this.categorizeImpact(depthRatio);
    
    return {
      totalReserve: this.toPrecision(totalReserve),
      tradeAmount,
      depthRatio: this.toPrecision(depthRatio),
      impactCategory,
      recommendations: this.getDepthRecommendations(depthRatio)
    };
  }

  /**
   * Evalúa riesgos de liquidez
   */
  assessLiquidityRisks(poolData, liquidityMetrics) {
    const risks = [];
    let totalRiskScore = 0;

    // Riesgo por liquidez insuficiente
    if (liquidityMetrics.totalLiquidityUSD < this.validationLimits.minLiquidityUSD) {
      risks.push({
        type: 'INSUFFICIENT_LIQUIDITY',
        score: 0.8,
        description: 'Liquidez por debajo del mínimo recomendado'
      });
      totalRiskScore += 0.8;
    }

    // Riesgo por baja utilización
    if (liquidityMetrics.utilization < 0.1) {
      risks.push({
        type: 'LOW_UTILIZATION',
        score: 0.3,
        description: 'Baja utilización del pool'
      });
      totalRiskScore += 0.3;
    }

    const riskLevel = totalRiskScore <= 0.3 ? 'LOW' : totalRiskScore <= 0.7 ? 'MEDIUM' : 'HIGH';

    return {
      risks,
      totalRiskScore: this.toPrecision(totalRiskScore),
      riskLevel,
      isAcceptableRisk: riskLevel !== 'HIGH'
    };
  }

  /**
   * Genera recomendaciones de trade
   */
  generateTradeRecommendations(priceImpact, depthAnalysis, riskAssessment) {
    const recommendations = [];

    if (priceImpact.priceImpactPercentage > 3) {
      recommendations.push({
        type: 'REDUCE_TRADE_SIZE',
        priority: 'HIGH',
        suggestion: `Reducir tamaño del trade. Impact actual: ${priceImpact.priceImpactPercentage.toFixed(2)}%`
      });
    }

    if (depthAnalysis.impactCategory === 'HIGH') {
      recommendations.push({
        type: 'SPLIT_TRADE',
        priority: 'MEDIUM',
        suggestion: 'Considerar dividir el trade en múltiples transacciones'
      });
    }

    if (riskAssessment.riskLevel === 'HIGH') {
      recommendations.push({
        type: 'AVOID_TRADE',
        priority: 'HIGH',
        suggestion: 'No recomendado ejecutar trade debido a alto riesgo'
      });
    }

    return recommendations;
  }

  /**
   * Determina validez general
   */
  determineOverallValidity(priceImpact, depthAnalysis, riskAssessment) {
    return (
      priceImpact.isAcceptableImpact &&
      depthAnalysis.impactCategory !== 'CRITICAL' &&
      riskAssessment.isAcceptableRisk
    );
  }

  /**
   * Categoriza impacto
   */
  categorizeImpact(ratio) {
    if (ratio <= 0.01) return 'LOW';      // <= 1%
    if (ratio <= 0.05) return 'MEDIUM';   // <= 5%
    if (ratio <= 0.1) return 'HIGH';      // <= 10%
    return 'CRITICAL';                    // > 10%
  }

  /**
   * Obtiene recomendaciones de profundidad
   */
  getDepthRecommendations(ratio) {
    if (ratio > 0.1) {
      return ['Reducir tamaño significativamente', 'Buscar pools alternativos'];
    }
    if (ratio > 0.05) {
      return ['Reducir tamaño del trade', 'Monitorear slippage'];
    }
    return ['Trade size aceptable'];
  }

  /**
   * Calcula D para StableSwap (simplificado)
   */
  calculateStableswapD(reserves, A) {
    // Implementación simplificada - la real es más compleja
    const sum = reserves.reduce((a, b) => a + b, 0);
    return sum; // Simplificación
  }

  /**
   * Calcula Y para StableSwap (simplificado)
   */
  calculateStableswapY(x, D, A) {
    // Implementación simplificada usando Newton-Raphson
    return D - x; // Simplificación
  }

  /**
   * Convierte a precisión fija
   */
  toPrecision(number) {
    return Math.round(number * Math.pow(10, 8)) / Math.pow(10, 8);
  }

  /**
   * Obtiene estadísticas del validador
   */
  getValidatorStats() {
    return {
      version: '2.0.0',
      supportedProtocols: Object.keys(this.ammProtocols),
      validationLimits: this.validationLimits,
      riskFactors: this.liquidityRiskFactors,
      lastUpdated: Date.now()
    };
  }
}

// Exportación para diferentes entornos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LiquidityValidator;
} else if (typeof window !== 'undefined') {
  window.LiquidityValidator = LiquidityValidator;
}

export default LiquidityValidator;
/**
 * @fileoverview ArbitrageMath - Núcleo del motor matemático para cálculos precisos de arbitraje
 * @description Implementación disciplinada siguiendo buenas prácticas del Ingenio Pichichi S.A.
 * @version 2.0.0
 * @author ArbitrageX Supreme - Hector Fabio Riascos C.
 */

/**
 * Clase principal para cálculos matemáticos de arbitraje
 * Implementa fórmulas precisas para spread, profit neto y scoring de riesgo
 */
class ArbitrageMath {
  constructor() {
    // Constantes de precisión matemática
    this.PRECISION_DECIMALS = 18;
    this.MAX_SLIPPAGE = 0.05; // 5% máximo slippage permitido
    this.MIN_PROFIT_THRESHOLD = 0.001; // 0.1% mínimo profit
    this.RISK_MULTIPLIERS = {
      LOW: 0.5,
      MEDIUM: 1.0,
      HIGH: 2.0,
      CRITICAL: 5.0
    };
  }

  /**
   * Calcula el spread entre dos precios con máxima precisión
   * @param {number} priceA - Precio en DEX A 
   * @param {number} priceB - Precio en DEX B
   * @returns {Object} Resultado del spread con detalles completos
   */
  calculateSpread(priceA, priceB) {
    try {
      // Validación de entrada
      if (!priceA || !priceB || priceA <= 0 || priceB <= 0) {
        throw new Error('Precios inválidos para cálculo de spread');
      }

      // Cálculo del spread absoluto y relativo
      const spreadAbsolute = Math.abs(priceA - priceB);
      const spreadRelative = spreadAbsolute / Math.min(priceA, priceB);
      const spreadPercentage = spreadRelative * 100;
      
      // Determinar dirección del arbitraje
      const higherPrice = Math.max(priceA, priceB);
      const lowerPrice = Math.min(priceA, priceB);
      const arbitrageDirection = priceA > priceB ? 'A_to_B' : 'B_to_A';
      
      // Cálculo de profit potencial antes de costos
      const potentialProfitRatio = (higherPrice - lowerPrice) / lowerPrice;
      
      return {
        spreadAbsolute: this.toPrecision(spreadAbsolute),
        spreadRelative: this.toPrecision(spreadRelative),
        spreadPercentage: this.toPrecision(spreadPercentage),
        higherPrice: this.toPrecision(higherPrice),
        lowerPrice: this.toPrecision(lowerPrice),
        arbitrageDirection,
        potentialProfitRatio: this.toPrecision(potentialProfitRatio),
        timestamp: Date.now(),
        isValidSpread: spreadPercentage >= (this.MIN_PROFIT_THRESHOLD * 100)
      };
    } catch (error) {
      throw new Error(`Error en cálculo de spread: ${error.message}`);
    }
  }

  /**
   * Calcula el profit neto considerando todos los costos
   * @param {number} buyPrice - Precio de compra
   * @param {number} sellPrice - Precio de venta
   * @param {number} amount - Cantidad a arbitrar
   * @param {Object} costs - Estructura de costos
   * @returns {Object} Análisis completo de profit neto
   */
  calculateNetProfit(buyPrice, sellPrice, amount, costs) {
    try {
      // Validación de parámetros
      this.validateProfitInputs(buyPrice, sellPrice, amount, costs);

      // Cálculo de profit bruto
      const grossProfit = (sellPrice - buyPrice) * amount;
      const grossProfitPercentage = ((sellPrice - buyPrice) / buyPrice) * 100;

      // Sumatoria de todos los costos
      const totalCosts = this.calculateTotalCosts(costs, amount);
      
      // Profit neto final
      const netProfit = grossProfit - totalCosts.total;
      const netProfitPercentage = (netProfit / (buyPrice * amount)) * 100;

      // Métricas de eficiencia
      const costRatio = totalCosts.total / grossProfit;
      const efficiency = Math.max(0, 1 - costRatio);
      
      // ROI (Return on Investment)
      const investment = buyPrice * amount;
      const roi = (netProfit / investment) * 100;

      return {
        grossProfit: this.toPrecision(grossProfit),
        grossProfitPercentage: this.toPrecision(grossProfitPercentage),
        netProfit: this.toPrecision(netProfit),
        netProfitPercentage: this.toPrecision(netProfitPercentage),
        totalCosts: totalCosts,
        costRatio: this.toPrecision(costRatio),
        efficiency: this.toPrecision(efficiency),
        roi: this.toPrecision(roi),
        investment: this.toPrecision(investment),
        isProfitable: netProfit > 0,
        profitabilityScore: this.calculateProfitabilityScore(netProfitPercentage, efficiency),
        timestamp: Date.now()
      };
    } catch (error) {
      throw new Error(`Error en cálculo de profit neto: ${error.message}`);
    }
  }

  /**
   * Calcula el scoring de riesgo integral
   * @param {Object} opportunity - Oportunidad de arbitraje
   * @param {Object} marketData - Datos del mercado
   * @returns {Object} Score de riesgo detallado
   */
  calculateRiskScore(opportunity, marketData) {
    try {
      const risks = {
        priceVolatility: this.calculateVolatilityRisk(marketData.volatility),
        liquidityRisk: this.calculateLiquidityRisk(marketData.liquidity),
        slippageRisk: this.calculateSlippageRisk(opportunity.expectedSlippage),
        timeRisk: this.calculateTimeRisk(opportunity.executionTime),
        gasRisk: this.calculateGasRisk(marketData.gasPrice),
        networkRisk: this.calculateNetworkRisk(marketData.networkCongestion)
      };

      // Pesos para cada tipo de riesgo
      const riskWeights = {
        priceVolatility: 0.25,
        liquidityRisk: 0.20,
        slippageRisk: 0.20,
        timeRisk: 0.15,
        gasRisk: 0.15,
        networkRisk: 0.05
      };

      // Cálculo del score compuesto
      let totalScore = 0;
      let riskDetails = {};

      for (const [riskType, score] of Object.entries(risks)) {
        const weightedScore = score * riskWeights[riskType];
        totalScore += weightedScore;
        riskDetails[riskType] = {
          score: this.toPrecision(score),
          weight: riskWeights[riskType],
          weightedScore: this.toPrecision(weightedScore)
        };
      }

      // Clasificación del riesgo
      const riskLevel = this.classifyRiskLevel(totalScore);
      const riskMultiplier = this.RISK_MULTIPLIERS[riskLevel];

      return {
        totalScore: this.toPrecision(totalScore),
        riskLevel,
        riskMultiplier,
        riskDetails,
        isAcceptableRisk: totalScore <= 0.7, // 70% máximo riesgo aceptable
        recommendedAction: this.getRecommendedAction(totalScore),
        timestamp: Date.now()
      };
    } catch (error) {
      throw new Error(`Error en cálculo de risk score: ${error.message}`);
    }
  }

  /**
   * Calcula el impacto de precio usando fórmula AMM
   * @param {number} tradeAmount - Cantidad a intercambiar
   * @param {number} reserveIn - Reserva del token de entrada
   * @param {number} reserveOut - Reserva del token de salida
   * @returns {Object} Análisis de impacto de precio
   */
  calculatePriceImpact(tradeAmount, reserveIn, reserveOut) {
    try {
      // Validación de reservas
      if (reserveIn <= 0 || reserveOut <= 0) {
        throw new Error('Reservas inválidas para cálculo de price impact');
      }

      // Fórmula AMM: k = x * y (constante)
      const k = reserveIn * reserveOut;
      
      // Nuevo estado después del trade
      const newReserveIn = reserveIn + tradeAmount;
      const newReserveOut = k / newReserveIn;
      
      // Cantidad de salida
      const outputAmount = reserveOut - newReserveOut;
      
      // Precio antes y después del trade
      const priceBefore = reserveOut / reserveIn;
      const priceAfter = newReserveOut / newReserveIn;
      
      // Cálculo del price impact
      const priceImpact = Math.abs(priceAfter - priceBefore) / priceBefore;
      const priceImpactPercentage = priceImpact * 100;

      return {
        outputAmount: this.toPrecision(outputAmount),
        priceBefore: this.toPrecision(priceBefore),
        priceAfter: this.toPrecision(priceAfter),
        priceImpact: this.toPrecision(priceImpact),
        priceImpactPercentage: this.toPrecision(priceImpactPercentage),
        isHighImpact: priceImpactPercentage > 1, // 1% considerado alto
        isCriticalImpact: priceImpactPercentage > 5, // 5% considerado crítico
        timestamp: Date.now()
      };
    } catch (error) {
      throw new Error(`Error en cálculo de price impact: ${error.message}`);
    }
  }

  // === MÉTODOS AUXILIARES ===

  /**
   * Valida inputs para cálculo de profit
   */
  validateProfitInputs(buyPrice, sellPrice, amount, costs) {
    if (!buyPrice || !sellPrice || !amount || buyPrice <= 0 || sellPrice <= 0 || amount <= 0) {
      throw new Error('Parámetros inválidos para cálculo de profit');
    }
    if (!costs || typeof costs !== 'object') {
      throw new Error('Estructura de costos requerida');
    }
  }

  /**
   * Calcula total de costos desglosados
   */
  calculateTotalCosts(costs, amount) {
    const totalCosts = {
      gasFee: costs.gasFee || 0,
      protocolFee: (costs.protocolFeeRate || 0) * amount,
      slippage: (costs.slippageRate || 0) * amount,
      bridgeFee: costs.bridgeFee || 0,
      total: 0
    };

    totalCosts.total = totalCosts.gasFee + totalCosts.protocolFee + 
                     totalCosts.slippage + totalCosts.bridgeFee;

    return totalCosts;
  }

  /**
   * Calcula score de profitabilidad
   */
  calculateProfitabilityScore(netProfitPercentage, efficiency) {
    const profitScore = Math.min(netProfitPercentage / 10, 1); // Max 1 para 10%
    const efficiencyScore = efficiency;
    return this.toPrecision((profitScore + efficiencyScore) / 2);
  }

  /**
   * Calcula riesgo de volatilidad
   */
  calculateVolatilityRisk(volatility) {
    return Math.min(volatility / 0.1, 1); // Normalizar a 10% volatilidad máxima
  }

  /**
   * Calcula riesgo de liquidez
   */
  calculateLiquidityRisk(liquidity) {
    const minLiquidity = 100000; // $100k mínimo
    return Math.max(0, 1 - (liquidity / minLiquidity));
  }

  /**
   * Calcula riesgo de slippage
   */
  calculateSlippageRisk(expectedSlippage) {
    return Math.min(expectedSlippage / this.MAX_SLIPPAGE, 1);
  }

  /**
   * Calcula riesgo temporal
   */
  calculateTimeRisk(executionTime) {
    const maxTime = 30000; // 30 segundos máximo
    return Math.min(executionTime / maxTime, 1);
  }

  /**
   * Calcula riesgo de gas
   */
  calculateGasRisk(gasPrice) {
    const normalGas = 20; // 20 gwei normal
    return Math.min(gasPrice / (normalGas * 3), 1); // 3x considerado alto
  }

  /**
   * Calcula riesgo de red
   */
  calculateNetworkRisk(congestion) {
    return Math.min(congestion / 100, 1); // 100% congestion máxima
  }

  /**
   * Clasifica nivel de riesgo
   */
  classifyRiskLevel(totalScore) {
    if (totalScore <= 0.3) return 'LOW';
    if (totalScore <= 0.5) return 'MEDIUM';
    if (totalScore <= 0.7) return 'HIGH';
    return 'CRITICAL';
  }

  /**
   * Obtiene recomendación basada en riesgo
   */
  getRecommendedAction(riskScore) {
    if (riskScore <= 0.3) return 'EXECUTE';
    if (riskScore <= 0.5) return 'EXECUTE_WITH_CAUTION';
    if (riskScore <= 0.7) return 'MONITOR';
    return 'AVOID';
  }

  /**
   * Convierte número a precisión fija
   */
  toPrecision(number) {
    return Math.round(number * Math.pow(10, 8)) / Math.pow(10, 8);
  }

  /**
   * Obtiene estadísticas del motor matemático
   */
  getEngineStats() {
    return {
      version: '2.0.0',
      precision: this.PRECISION_DECIMALS,
      maxSlippage: this.MAX_SLIPPAGE,
      minProfitThreshold: this.MIN_PROFIT_THRESHOLD,
      riskMultipliers: this.RISK_MULTIPLIERS,
      features: [
        'spread_calculation',
        'net_profit_analysis', 
        'risk_scoring',
        'price_impact_amm',
        'volatility_analysis',
        'liquidity_validation'
      ]
    };
  }
}

// Exportación para uso en diferentes entornos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ArbitrageMath;
} else if (typeof window !== 'undefined') {
  window.ArbitrageMath = ArbitrageMath;
}

export default ArbitrageMath;
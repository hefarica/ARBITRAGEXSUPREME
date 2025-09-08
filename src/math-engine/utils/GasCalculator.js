/**
 * @fileoverview GasCalculator - Calculadora de gas en tiempo real para transacciones de arbitraje
 * @description Implementación metódica siguiendo buenas prácticas del Ingenio Pichichi S.A.
 * @version 2.0.0
 * @author ArbitrageX Supreme - Hector Fabio Riascos C.
 */

/**
 * Clase especializada en cálculos de gas para operaciones multi-chain
 * Maneja estimación, optimización y predicción de costos de gas
 */
class GasCalculator {
  constructor() {
    // Configuración de gas por red
    this.networkConfigs = {
      ethereum: {
        chainId: 1,
        gasLimit: {
          transfer: 21000,
          swap: 150000,
          flashloan: 300000,
          arbitrage: 450000,
          complex: 800000
        },
        baseFee: 20, // gwei
        priorityFee: 2, // gwei
        maxFeeMultiplier: 2
      },
      polygon: {
        chainId: 137,
        gasLimit: {
          transfer: 21000,
          swap: 120000,
          flashloan: 250000,
          arbitrage: 350000,
          complex: 600000
        },
        baseFee: 30, // gwei
        priorityFee: 30, // gwei
        maxFeeMultiplier: 1.5
      },
      bsc: {
        chainId: 56,
        gasLimit: {
          transfer: 21000,
          swap: 100000,
          flashloan: 200000,
          arbitrage: 300000,
          complex: 500000
        },
        baseFee: 3, // gwei
        priorityFee: 1, // gwei
        maxFeeMultiplier: 1.2
      },
      arbitrum: {
        chainId: 42161,
        gasLimit: {
          transfer: 21000,
          swap: 180000,
          flashloan: 400000,
          arbitrage: 600000,
          complex: 1000000
        },
        baseFee: 0.1, // gwei
        priorityFee: 0.01, // gwei
        maxFeeMultiplier: 1.1
      }
    };

    // Precios de tokens nativos en USD (actualizar vía API)
    this.tokenPrices = {
      ethereum: 2500, // ETH/USD
      polygon: 0.8,   // MATIC/USD
      bsc: 300,       // BNB/USD
      arbitrum: 2500  // ETH/USD (Arbitrum usa ETH)
    };

    // Factores de optimización
    this.optimizationFactors = {
      batchTransactions: 0.7,    // 30% ahorro con batch
      gasTokens: 0.85,           // 15% ahorro con CHI tokens
      flashLoans: 1.2,           // 20% overhead por flash loans
      crossChain: 1.5,           // 50% overhead cross-chain
      highCongestion: 2.0        // 100% aumento en congestión
    };
  }

  /**
   * Calcula costos de gas para una operación específica
   * @param {string} network - Red blockchain (ethereum, polygon, bsc, arbitrum)
   * @param {string} operationType - Tipo de operación (transfer, swap, arbitrage, etc.)
   * @param {Object} params - Parámetros adicionales
   * @returns {Object} Cálculo detallado de costos de gas
   */
  calculateGasCost(network, operationType, params = {}) {
    try {
      // Validación de entrada
      this.validateInputs(network, operationType);
      
      const config = this.networkConfigs[network];
      const currentGasPrice = params.gasPrice || this.estimateCurrentGasPrice(network);
      const gasLimit = this.calculateGasLimit(network, operationType, params);

      // Cálculo base de gas
      const gasUsed = gasLimit * (params.gasUsageRatio || 0.8); // 80% uso típico
      const gasCostWei = gasUsed * currentGasPrice * Math.pow(10, 9); // Convert gwei to wei
      const gasCostEth = gasCostWei / Math.pow(10, 18); // Convert wei to ETH
      const gasCostUSD = gasCostEth * this.tokenPrices[network];

      // Aplicar factores de optimización
      const optimizedCosts = this.applyOptimizations(gasCostUSD, params.optimizations || []);

      // Cálculos de prioridad y timing
      const priorityLevels = this.calculatePriorityLevels(network, currentGasPrice);

      // Estimación de tiempo de confirmación
      const confirmationTime = this.estimateConfirmationTime(network, currentGasPrice);

      return {
        network,
        operationType,
        gasLimit,
        gasUsed: Math.round(gasUsed),
        gasPrice: {
          current: currentGasPrice,
          base: config.baseFee,
          priority: config.priorityFee,
          unit: 'gwei'
        },
        costs: {
          wei: Math.round(gasCostWei),
          native: this.toPrecision(gasCostEth),
          usd: this.toPrecision(gasCostUSD),
          optimized: optimizedCosts
        },
        priorityLevels,
        confirmationTime,
        efficiency: this.calculateEfficiency(gasCostUSD, params.transactionValue || 1000),
        timestamp: Date.now()
      };
    } catch (error) {
      throw new Error(`Error calculando gas cost: ${error.message}`);
    }
  }

  /**
   * Calcula costos agregados para operación de arbitraje multi-paso
   * @param {Array} operations - Array de operaciones secuenciales
   * @returns {Object} Cálculo agregado de costos
   */
  calculateArbitrageGasCosts(operations) {
    try {
      let totalCostUSD = 0;
      let totalGasUsed = 0;
      let operationDetails = [];
      let bottleneckOperation = null;
      let maxConfirmationTime = 0;

      // Procesar cada operación
      for (const operation of operations) {
        const gasCost = this.calculateGasCost(
          operation.network,
          operation.type,
          operation.params
        );

        totalCostUSD += gasCost.costs.optimized.totalUSD;
        totalGasUsed += gasCost.gasUsed;
        
        operationDetails.push({
          step: operation.step || operationDetails.length + 1,
          network: operation.network,
          type: operation.type,
          gasCost: gasCost.costs.optimized.totalUSD,
          confirmationTime: gasCost.confirmationTime.fast
        });

        // Identificar cuello de botella
        if (gasCost.confirmationTime.fast > maxConfirmationTime) {
          maxConfirmationTime = gasCost.confirmationTime.fast;
          bottleneckOperation = operation;
        }
      }

      // Calcular métricas agregadas
      const averageCostPerOperation = totalCostUSD / operations.length;
      const costDistribution = this.calculateCostDistribution(operationDetails);
      
      // Factor de riesgo por tiempo total
      const totalTimeRisk = this.calculateTimeRisk(maxConfirmationTime);

      return {
        summary: {
          totalOperations: operations.length,
          totalCostUSD: this.toPrecision(totalCostUSD),
          totalGasUsed,
          averageCostPerOperation: this.toPrecision(averageCostPerOperation),
          maxConfirmationTime
        },
        operationDetails,
        bottleneck: {
          operation: bottleneckOperation,
          timeSeconds: maxConfirmationTime,
          riskFactor: totalTimeRisk
        },
        costDistribution,
        recommendations: this.generateOptimizationRecommendations(operationDetails),
        riskAssessment: this.assessGasRisk(totalCostUSD, maxConfirmationTime),
        timestamp: Date.now()
      };
    } catch (error) {
      throw new Error(`Error calculando arbitrage gas costs: ${error.message}`);
    }
  }

  /**
   * Optimiza estrategia de gas para máxima eficiencia
   * @param {Object} arbitrageParams - Parámetros del arbitraje
   * @returns {Object} Estrategia optimizada de gas
   */
  optimizeGasStrategy(arbitrageParams) {
    try {
      const { expectedProfit, operations, timeConstraints } = arbitrageParams;

      // Calcular costos base
      const baseCosts = this.calculateArbitrageGasCosts(operations);

      // Estrategias de optimización disponibles
      const strategies = {
        standard: {
          name: 'Standard Execution',
          gasCosts: baseCosts.summary.totalCostUSD,
          timeToExecute: baseCosts.summary.maxConfirmationTime,
          successRate: 0.85,
          modifications: []
        },
        
        batch: {
          name: 'Batch Transactions',
          gasCosts: baseCosts.summary.totalCostUSD * this.optimizationFactors.batchTransactions,
          timeToExecute: baseCosts.summary.maxConfirmationTime * 1.1,
          successRate: 0.90,
          modifications: ['batch_operations']
        },

        highPriority: {
          name: 'High Priority Gas',
          gasCosts: baseCosts.summary.totalCostUSD * 1.5,
          timeToExecute: baseCosts.summary.maxConfirmationTime * 0.3,
          successRate: 0.95,
          modifications: ['priority_gas']
        },

        flashloan: {
          name: 'Flash Loan Optimization',
          gasCosts: baseCosts.summary.totalCostUSD * this.optimizationFactors.flashLoans * 0.9,
          timeToExecute: baseCosts.summary.maxConfirmationTime * 0.8,
          successRate: 0.88,
          modifications: ['flash_loans', 'reduced_steps']
        }
      };

      // Evaluar cada estrategia
      let bestStrategy = null;
      let bestScore = -1;

      for (const [key, strategy] of Object.entries(strategies)) {
        const netProfit = expectedProfit - strategy.gasCosts;
        const profitRatio = netProfit / expectedProfit;
        const timeScore = this.calculateTimeScore(strategy.timeToExecute, timeConstraints.maxTime);
        
        // Score compuesto (profit ratio * success rate * time score)
        const compositeScore = profitRatio * strategy.successRate * timeScore;
        
        strategy.netProfit = this.toPrecision(netProfit);
        strategy.profitRatio = this.toPrecision(profitRatio);
        strategy.compositeScore = this.toPrecision(compositeScore);
        strategy.isViable = netProfit > 0 && strategy.timeToExecute <= timeConstraints.maxTime;

        if (compositeScore > bestScore && strategy.isViable) {
          bestScore = compositeScore;
          bestStrategy = { key, ...strategy };
        }
      }

      return {
        baseCosts: baseCosts.summary,
        strategies,
        recommended: bestStrategy,
        optimizationOpportunities: this.identifyOptimizationOpportunities(baseCosts),
        riskAnalysis: this.analyzeGasRisks(strategies),
        timestamp: Date.now()
      };
    } catch (error) {
      throw new Error(`Error optimizando gas strategy: ${error.message}`);
    }
  }

  // === MÉTODOS AUXILIARES ===

  /**
   * Valida inputs de entrada
   */
  validateInputs(network, operationType) {
    if (!this.networkConfigs[network]) {
      throw new Error(`Red no soportada: ${network}`);
    }
    if (!this.networkConfigs[network].gasLimit[operationType]) {
      throw new Error(`Tipo de operación no soportado: ${operationType}`);
    }
  }

  /**
   * Estima precio actual de gas basado en red y congestión
   */
  estimateCurrentGasPrice(network) {
    const config = this.networkConfigs[network];
    const congestionMultiplier = 1 + (Math.random() * 0.5); // Simular variabilidad
    return config.baseFee * congestionMultiplier;
  }

  /**
   * Calcula límite de gas dinámico
   */
  calculateGasLimit(network, operationType, params) {
    const baseLimit = this.networkConfigs[network].gasLimit[operationType];
    const complexityMultiplier = params.complexityFactor || 1;
    return Math.round(baseLimit * complexityMultiplier);
  }

  /**
   * Aplica optimizaciones de gas
   */
  applyOptimizations(baseCostUSD, optimizations) {
    let optimizedCost = baseCostUSD;
    let appliedOptimizations = [];

    for (const optimization of optimizations) {
      if (this.optimizationFactors[optimization]) {
        optimizedCost *= this.optimizationFactors[optimization];
        appliedOptimizations.push(optimization);
      }
    }

    return {
      totalUSD: this.toPrecision(optimizedCost),
      savings: this.toPrecision(baseCostUSD - optimizedCost),
      savingsPercentage: this.toPrecision(((baseCostUSD - optimizedCost) / baseCostUSD) * 100),
      appliedOptimizations
    };
  }

  /**
   * Calcula niveles de prioridad de gas
   */
  calculatePriorityLevels(network, currentGasPrice) {
    return {
      slow: {
        gasPrice: Math.round(currentGasPrice * 0.8),
        estimatedTime: '5-10 minutes',
        costMultiplier: 0.8
      },
      standard: {
        gasPrice: Math.round(currentGasPrice),
        estimatedTime: '2-5 minutes',
        costMultiplier: 1.0
      },
      fast: {
        gasPrice: Math.round(currentGasPrice * 1.3),
        estimatedTime: '30-60 seconds',
        costMultiplier: 1.3
      },
      instant: {
        gasPrice: Math.round(currentGasPrice * 2),
        estimatedTime: '10-30 seconds',
        costMultiplier: 2.0
      }
    };
  }

  /**
   * Estima tiempo de confirmación
   */
  estimateConfirmationTime(network, gasPrice) {
    const config = this.networkConfigs[network];
    const baseTime = network === 'ethereum' ? 60 : 10; // segundos base
    const priceRatio = gasPrice / config.baseFee;
    
    return {
      fast: Math.round(baseTime / Math.max(priceRatio, 0.5)),
      standard: Math.round(baseTime * 2 / Math.max(priceRatio, 0.5)),
      slow: Math.round(baseTime * 5 / Math.max(priceRatio, 0.5))
    };
  }

  /**
   * Calcula eficiencia de gas
   */
  calculateEfficiency(gasCostUSD, transactionValue) {
    const costRatio = gasCostUSD / transactionValue;
    return this.toPrecision(Math.max(0, 1 - costRatio));
  }

  /**
   * Calcula distribución de costos
   */
  calculateCostDistribution(operationDetails) {
    const totalCost = operationDetails.reduce((sum, op) => sum + op.gasCost, 0);
    
    return operationDetails.map(op => ({
      ...op,
      percentage: this.toPrecision((op.gasCost / totalCost) * 100)
    }));
  }

  /**
   * Calcula riesgo temporal
   */
  calculateTimeRisk(maxTime) {
    const maxAcceptableTime = 300; // 5 minutos
    return Math.min(maxTime / maxAcceptableTime, 2);
  }

  /**
   * Calcula score de tiempo
   */
  calculateTimeScore(executionTime, maxTime) {
    if (executionTime > maxTime) return 0;
    return 1 - (executionTime / maxTime);
  }

  /**
   * Genera recomendaciones de optimización
   */
  generateOptimizationRecommendations(operationDetails) {
    const recommendations = [];
    
    // Identificar operación más costosa
    const mostExpensive = operationDetails.reduce((max, op) => 
      op.gasCost > max.gasCost ? op : max
    );
    
    if (mostExpensive.gasCost > 50) {
      recommendations.push({
        type: 'HIGH_COST_OPERATION',
        operation: mostExpensive,
        suggestion: 'Considerar usar red de menor costo o batch transactions'
      });
    }

    return recommendations;
  }

  /**
   * Evalúa riesgo de gas
   */
  assessGasRisk(totalCostUSD, maxTime) {
    let riskLevel = 'LOW';
    let riskFactors = [];

    if (totalCostUSD > 100) {
      riskLevel = 'HIGH';
      riskFactors.push('HIGH_COST');
    }

    if (maxTime > 300) {
      riskLevel = 'HIGH';
      riskFactors.push('SLOW_EXECUTION');
    }

    return { riskLevel, riskFactors };
  }

  /**
   * Identifica oportunidades de optimización
   */
  identifyOptimizationOpportunities(baseCosts) {
    const opportunities = [];
    
    if (baseCosts.totalCostUSD > 50) {
      opportunities.push({
        type: 'BATCH_OPERATIONS',
        savings: baseCosts.totalCostUSD * 0.3,
        description: 'Agrupar transacciones para reducir costos'
      });
    }

    return opportunities;
  }

  /**
   * Analiza riesgos de estrategias de gas
   */
  analyzeGasRisks(strategies) {
    return Object.entries(strategies).map(([key, strategy]) => ({
      strategy: key,
      riskLevel: strategy.gasCosts > 100 ? 'HIGH' : 'MEDIUM',
      factors: {
        costRisk: strategy.gasCosts / 100,
        timeRisk: strategy.timeToExecute / 300,
        successRisk: 1 - strategy.successRate
      }
    }));
  }

  /**
   * Convierte a precisión fija
   */
  toPrecision(number) {
    return Math.round(number * Math.pow(10, 6)) / Math.pow(10, 6);
  }

  /**
   * Obtiene estadísticas del calculador
   */
  getCalculatorStats() {
    return {
      version: '2.0.0',
      supportedNetworks: Object.keys(this.networkConfigs),
      operationTypes: Object.keys(this.networkConfigs.ethereum.gasLimit),
      optimizationFactors: this.optimizationFactors,
      lastUpdated: Date.now()
    };
  }
}

// Exportación para diferentes entornos
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GasCalculator;
} else if (typeof window !== 'undefined') {
  window.GasCalculator = GasCalculator;
}

export default GasCalculator;
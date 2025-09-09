import winston from 'winston';
import Decimal from 'decimal.js';
import { evaluate } from 'mathjs';
import { ReconciliationConfig } from '../types/reconciliation.js';

interface SimulationData {
  gross_profit_eth: string;
  net_profit_eth: string;
  gas_used: string;
  gas_price_gwei: string;
  execution_time_ms: number;
  block_number: number;
  success: boolean;
  simulation_hash?: string;
}

interface ExecutionData {
  actual_profit_eth: string;
  actual_gas_used: string;
  actual_gas_price_gwei: string;
  inclusion_block: number;
  transaction_status: string;
  relay_used?: string;
  inclusion_delay_blocks: number;
}

interface VarianceAnalysisResult {
  profit_variance_percentage: number;
  profit_difference_eth: string;
  profit_difference_usd?: string;
  gas_variance_percentage: number;
  gas_difference: string;
  gas_cost_difference_eth: string;
  execution_delay_ms: number;
  block_delay: number;
  overall_parity_score: number;
  reconciliation_status: 'perfect_match' | 'minor_variance' | 'significant_variance' | 'major_discrepancy';
}

export class VarianceAnalyzer {
  private logger: winston.Logger;
  private config: ReconciliationConfig;
  
  // Configuración de análisis estadístico
  private readonly ETH_TO_USD_ESTIMATE = 2000; // Estimación para cálculos USD
  private readonly PERFECT_MATCH_THRESHOLD = 0.001; // 0.1%
  private readonly GWEI_TO_WEI = new Decimal(10).pow(9);
  private readonly WEI_TO_ETH = new Decimal(10).pow(18);

  constructor(logger: winston.Logger, config: ReconciliationConfig) {
    this.logger = logger;
    this.config = config;
  }

  /**
   * Analizar varianza entre simulación y ejecución
   */
  async analyze(
    simulationData: SimulationData,
    executionData?: ExecutionData
  ): Promise<VarianceAnalysisResult> {
    
    this.logger.debug('🔍 Iniciando análisis de varianza sim↔exec');

    // Si no hay datos de ejecución, considerarlo como falla total
    if (!executionData) {
      return this.handleMissingExecutionData(simulationData);
    }

    // Validar que ambos datasets sean válidos
    this.validateInputData(simulationData, executionData);

    // 1. Análisis de varianza de profit
    const profitAnalysis = this.analyzeProfitVariance(simulationData, executionData);
    
    // 2. Análisis de varianza de gas
    const gasAnalysis = this.analyzeGasVariance(simulationData, executionData);
    
    // 3. Análisis de timing/delay
    const timingAnalysis = this.analyzeTimingVariance(simulationData, executionData);
    
    // 4. Calcular score de parity general
    const parityScore = this.calculateParityScore(profitAnalysis, gasAnalysis, timingAnalysis);
    
    // 5. Determinar estado de reconciliación
    const reconciliationStatus = this.determineReconciliationStatus(
      profitAnalysis.variance_percentage,
      gasAnalysis.variance_percentage,
      parityScore
    );

    const result: VarianceAnalysisResult = {
      profit_variance_percentage: profitAnalysis.variance_percentage,
      profit_difference_eth: profitAnalysis.difference_eth,
      profit_difference_usd: profitAnalysis.difference_usd,
      
      gas_variance_percentage: gasAnalysis.variance_percentage,
      gas_difference: gasAnalysis.difference_units,
      gas_cost_difference_eth: gasAnalysis.cost_difference_eth,
      
      execution_delay_ms: timingAnalysis.delay_ms,
      block_delay: timingAnalysis.block_delay,
      
      overall_parity_score: parityScore,
      reconciliation_status: reconciliationStatus
    };

    this.logger.debug(
      `📊 Análisis completado: ${reconciliationStatus} ` +
      `(profit: ${profitAnalysis.variance_percentage.toFixed(2)}%, ` +
      `gas: ${gasAnalysis.variance_percentage.toFixed(2)}%, ` +
      `parity: ${parityScore.toFixed(1)})`
    );

    return result;
  }

  /**
   * Manejar caso donde no hay datos de ejecución
   */
  private handleMissingExecutionData(simulationData: SimulationData): VarianceAnalysisResult {
    return {
      profit_variance_percentage: -100, // -100% indica no ejecución
      profit_difference_eth: `-${simulationData.net_profit_eth}`,
      profit_difference_usd: `-${new Decimal(simulationData.net_profit_eth).mul(this.ETH_TO_USD_ESTIMATE).toString()}`,
      
      gas_variance_percentage: -100,
      gas_difference: `-${simulationData.gas_used}`,
      gas_cost_difference_eth: this.calculateGasCostEth(simulationData.gas_used, simulationData.gas_price_gwei),
      
      execution_delay_ms: 0,
      block_delay: 0,
      
      overall_parity_score: 0,
      reconciliation_status: 'major_discrepancy'
    };
  }

  /**
   * Validar datos de entrada
   */
  private validateInputData(simulationData: SimulationData, executionData: ExecutionData): void {
    // Validar simulationData
    if (!simulationData.net_profit_eth || !simulationData.gas_used) {
      throw new Error('❌ Simulation data incompleta');
    }

    // Validar executionData  
    if (!executionData.actual_profit_eth || !executionData.actual_gas_used) {
      throw new Error('❌ Execution data incompleta');
    }

    // Validar que los números sean válidos
    try {
      new Decimal(simulationData.net_profit_eth);
      new Decimal(executionData.actual_profit_eth);
      new Decimal(simulationData.gas_used);
      new Decimal(executionData.actual_gas_used);
    } catch (error) {
      throw new Error(`❌ Datos numéricos inválidos: ${error}`);
    }
  }

  /**
   * Analizar varianza de profit
   */
  private analyzeProfitVariance(
    simulationData: SimulationData,
    executionData: ExecutionData
  ): {
    variance_percentage: number,
    difference_eth: string,
    difference_usd: string,
    simulation_profit: Decimal,
    execution_profit: Decimal
  } {
    const simProfit = new Decimal(simulationData.net_profit_eth);
    const execProfit = new Decimal(executionData.actual_profit_eth);
    
    const difference = execProfit.sub(simProfit);
    const differenceAbs = difference.abs();
    
    // Calcular varianza porcentual
    // Si simulation profit es 0, usar valor absoluto de la diferencia como base
    let variancePercentage = 0;
    if (simProfit.abs().gt(0.001)) { // Evitar división por valores muy pequeños
      variancePercentage = difference.div(simProfit).mul(100).toNumber();
    } else if (execProfit.abs().gt(0.001)) {
      // Si sim profit ~= 0 pero exec profit > 0, es una varianza significativa
      variancePercentage = execProfit.gt(0) ? 999 : -999; // Valores extremos para indicar varianza máxima
    }

    const differenceUsd = difference.mul(this.ETH_TO_USD_ESTIMATE);

    return {
      variance_percentage: variancePercentage,
      difference_eth: difference.toString(),
      difference_usd: differenceUsd.toString(),
      simulation_profit: simProfit,
      execution_profit: execProfit
    };
  }

  /**
   * Analizar varianza de gas
   */
  private analyzeGasVariance(
    simulationData: SimulationData,
    executionData: ExecutionData
  ): {
    variance_percentage: number,
    difference_units: string,
    cost_difference_eth: string,
    simulation_gas: Decimal,
    execution_gas: Decimal
  } {
    const simGas = new Decimal(simulationData.gas_used);
    const execGas = new Decimal(executionData.actual_gas_used);
    
    const gasDifference = execGas.sub(simGas);
    
    // Calcular varianza porcentual de gas
    let gasVariancePercentage = 0;
    if (simGas.gt(0)) {
      gasVariancePercentage = gasDifference.div(simGas).mul(100).toNumber();
    }

    // Calcular diferencia en costo (ETH)
    const simGasPrice = new Decimal(simulationData.gas_price_gwei);
    const execGasPrice = new Decimal(executionData.actual_gas_price_gwei);
    
    const simGasCostWei = simGas.mul(simGasPrice).mul(this.GWEI_TO_WEI);
    const execGasCostWei = execGas.mul(execGasPrice).mul(this.GWEI_TO_WEI);
    
    const gasCostDifferenceEth = execGasCostWei.sub(simGasCostWei).div(this.WEI_TO_ETH);

    return {
      variance_percentage: gasVariancePercentage,
      difference_units: gasDifference.toString(),
      cost_difference_eth: gasCostDifferenceEth.toString(),
      simulation_gas: simGas,
      execution_gas: execGas
    };
  }

  /**
   * Analizar varianza de timing
   */
  private analyzeTimingVariance(
    simulationData: SimulationData,
    executionData: ExecutionData
  ): {
    delay_ms: number,
    block_delay: number,
    timing_score: number
  } {
    // Block delay
    const blockDelay = executionData.inclusion_delay_blocks || 0;
    
    // Estimation de execution delay en ms (12s por bloque promedio en Ethereum)
    const estimatedDelayMs = blockDelay * 12000;
    
    // Timing score basado en qué tan cerca estuvo de la predicción
    let timingScore = 100;
    if (blockDelay > 0) {
      // Penalizar por cada bloque de delay
      timingScore = Math.max(0, 100 - (blockDelay * 20));
    }

    return {
      delay_ms: estimatedDelayMs,
      block_delay: blockDelay,
      timing_score: timingScore
    };
  }

  /**
   * Calcular score general de parity
   */
  private calculateParityScore(
    profitAnalysis: any,
    gasAnalysis: any,
    timingAnalysis: any
  ): number {
    // Pesos para diferentes componentes
    const PROFIT_WEIGHT = 0.5;
    const GAS_WEIGHT = 0.3;
    const TIMING_WEIGHT = 0.2;

    // Score de profit (inversamente proporcional a la varianza)
    const maxProfitVariance = 50; // 50% máximo esperado
    const profitScore = Math.max(0, 100 - (Math.abs(profitAnalysis.variance_percentage) / maxProfitVariance * 100));

    // Score de gas (inversamente proporcional a la varianza)
    const maxGasVariance = 30; // 30% máximo esperado
    const gasScore = Math.max(0, 100 - (Math.abs(gasAnalysis.variance_percentage) / maxGasVariance * 100));

    // Score de timing (ya viene calculado)
    const timingScore = timingAnalysis.timing_score;

    // Calcular score ponderado
    const overallScore = (
      profitScore * PROFIT_WEIGHT +
      gasScore * GAS_WEIGHT +
      timingScore * TIMING_WEIGHT
    );

    return Math.max(0, Math.min(100, overallScore));
  }

  /**
   * Determinar estado de reconciliación basado en umbrales
   */
  private determineReconciliationStatus(
    profitVariance: number,
    gasVariance: number,
    parityScore: number
  ): 'perfect_match' | 'minor_variance' | 'significant_variance' | 'major_discrepancy' {
    
    const profitVarianceAbs = Math.abs(profitVariance);
    const gasVarianceAbs = Math.abs(gasVariance);

    // Perfect match: varianzas muy bajas y parity score alto
    if (
      profitVarianceAbs <= this.PERFECT_MATCH_THRESHOLD * 100 &&
      gasVarianceAbs <= this.PERFECT_MATCH_THRESHOLD * 100 &&
      parityScore >= 95
    ) {
      return 'perfect_match';
    }

    // Major discrepancy: varianza muy alta o parity score muy bajo
    if (
      profitVarianceAbs >= this.config.major_discrepancy_threshold * 100 ||
      gasVarianceAbs >= this.config.major_discrepancy_threshold * 100 ||
      parityScore < 50
    ) {
      return 'major_discrepancy';
    }

    // Significant variance: varianza moderadamente alta
    if (
      profitVarianceAbs >= this.config.significant_variance_threshold * 100 ||
      gasVarianceAbs >= this.config.significant_variance_threshold * 100 ||
      parityScore < 80
    ) {
      return 'significant_variance';
    }

    // Minor variance: varianza baja pero detectable
    return 'minor_variance';
  }

  /**
   * Calcular costo de gas en ETH
   */
  private calculateGasCostEth(gasUsed: string, gasPriceGwei: string): string {
    const gas = new Decimal(gasUsed);
    const priceGwei = new Decimal(gasPriceGwei);
    
    const costWei = gas.mul(priceGwei).mul(this.GWEI_TO_WEI);
    const costEth = costWei.div(this.WEI_TO_ETH);
    
    return costEth.toString();
  }

  /**
   * Análisis estadístico avanzado (para investigaciones detalladas)
   */
  async performAdvancedStatisticalAnalysis(
    simulationData: SimulationData,
    executionData: ExecutionData,
    historicalData?: any[]
  ): Promise<any> {
    
    const basicAnalysis = await this.analyze(simulationData, executionData);
    
    // Análisis de correlación si tenemos datos históricos
    let correlationAnalysis = null;
    if (historicalData && historicalData.length >= 10) {
      correlationAnalysis = this.calculateCorrelations(historicalData);
    }

    // Análisis de outliers
    const outlierAnalysis = this.detectOutliers(basicAnalysis);
    
    // Análisis de confianza estadística
    const confidenceAnalysis = this.calculateConfidenceIntervals(basicAnalysis);
    
    return {
      basic_analysis: basicAnalysis,
      correlation_analysis: correlationAnalysis,
      outlier_analysis: outlierAnalysis,
      confidence_analysis: confidenceAnalysis,
      
      // Métricas avanzadas
      statistical_significance: this.calculateStatisticalSignificance(basicAnalysis),
      variance_stability: this.assessVarianceStability(basicAnalysis),
      prediction_accuracy: this.calculatePredictionAccuracy(basicAnalysis)
    };
  }

  /**
   * Calcular correlaciones entre variables
   */
  private calculateCorrelations(historicalData: any[]): any {
    // Implementación simplificada - en producción usaríamos librerías estadísticas más robustas
    return {
      profit_gas_correlation: 0.85, // Ejemplo: alta correlación entre profit y gas usado
      timing_success_correlation: -0.45, // Ejemplo: correlación negativa entre delay y éxito
      variance_market_correlation: 0.23 // Ejemplo: correlación con condiciones de mercado
    };
  }

  /**
   * Detectar outliers estadísticos
   */
  private detectOutliers(analysis: VarianceAnalysisResult): any {
    const profitOutlier = Math.abs(analysis.profit_variance_percentage) > 25;
    const gasOutlier = Math.abs(analysis.gas_variance_percentage) > 20;
    const parityOutlier = analysis.overall_parity_score < 60;

    return {
      is_profit_outlier: profitOutlier,
      is_gas_outlier: gasOutlier,
      is_parity_outlier: parityOutlier,
      outlier_severity: profitOutlier || gasOutlier || parityOutlier ? 'high' : 'none',
      requires_investigation: profitOutlier || gasOutlier
    };
  }

  /**
   * Calcular intervalos de confianza
   */
  private calculateConfidenceIntervals(analysis: VarianceAnalysisResult): any {
    // Implementación simplificada usando desviación estándar estimada
    const profitStdDev = 2.5; // 2.5% desviación estándar típica
    const gasStdDev = 5.0; // 5% desviación estándar típica

    return {
      profit_confidence_95: {
        lower_bound: analysis.profit_variance_percentage - (1.96 * profitStdDev),
        upper_bound: analysis.profit_variance_percentage + (1.96 * profitStdDev)
      },
      gas_confidence_95: {
        lower_bound: analysis.gas_variance_percentage - (1.96 * gasStdDev),
        upper_bound: analysis.gas_variance_percentage + (1.96 * gasStdDev)
      },
      confidence_level: analysis.overall_parity_score >= 90 ? 'high' : 
                       analysis.overall_parity_score >= 70 ? 'medium' : 'low'
    };
  }

  /**
   * Calcular significancia estadística
   */
  private calculateStatisticalSignificance(analysis: VarianceAnalysisResult): any {
    const profitZScore = analysis.profit_variance_percentage / 2.5; // Usando std dev estimada
    const gasZScore = analysis.gas_variance_percentage / 5.0;

    return {
      profit_z_score: profitZScore,
      gas_z_score: gasZScore,
      profit_p_value: this.calculatePValue(Math.abs(profitZScore)),
      gas_p_value: this.calculatePValue(Math.abs(gasZScore)),
      is_statistically_significant: Math.abs(profitZScore) > 1.96 || Math.abs(gasZScore) > 1.96
    };
  }

  /**
   * Aproximación simple de p-value
   */
  private calculatePValue(zScore: number): number {
    // Implementación muy simplificada - en producción usar librerías estadísticas
    if (zScore > 3) return 0.001;
    if (zScore > 2.5) return 0.01;
    if (zScore > 1.96) return 0.05;
    if (zScore > 1.5) return 0.1;
    return 0.2;
  }

  /**
   * Evaluar estabilidad de varianza
   */
  private assessVarianceStability(analysis: VarianceAnalysisResult): string {
    const totalVariance = Math.abs(analysis.profit_variance_percentage) + 
                         Math.abs(analysis.gas_variance_percentage);
    
    if (totalVariance < 2) return 'very_stable';
    if (totalVariance < 5) return 'stable';
    if (totalVariance < 15) return 'moderate';
    if (totalVariance < 30) return 'unstable';
    return 'very_unstable';
  }

  /**
   * Calcular accuracy de predicción
   */
  private calculatePredictionAccuracy(analysis: VarianceAnalysisResult): number {
    // Accuracy basada en qué tan cerca estuvo la predicción
    const profitAccuracy = Math.max(0, 100 - Math.abs(analysis.profit_variance_percentage));
    const gasAccuracy = Math.max(0, 100 - Math.abs(analysis.gas_variance_percentage));
    
    return (profitAccuracy + gasAccuracy) / 2;
  }
}
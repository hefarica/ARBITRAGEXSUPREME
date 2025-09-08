/**
 * ArbitrageX Supreme - Sistema de Análisis y Machine Learning
 * Ingenio Pichichi S.A. - Actividades 13-20
 * 
 * Análisis predictivo, patrones de mercado y optimización de estrategias
 */

// Types para análisis y ML
export interface MarketData {
  timestamp: number
  tokenPair: string
  price: number
  volume: number
  liquidity: number
  volatility: number
  gasPrice: number
}

export interface OpportunityPattern {
  id: string
  name: string
  description: string
  conditions: PatternCondition[]
  confidence: number
  historicalSuccessRate: number
  avgProfitBps: number
  frequency: number // oportunidades por día
}

export interface PatternCondition {
  metric: string
  operator: 'gt' | 'lt' | 'eq' | 'between' | 'trend'
  value: number | [number, number]
  weight: number // 0-1, importancia en el patrón
}

export interface PredictionResult {
  timestamp: number
  tokenPair: string
  strategy: string
  confidence: number // 0-100
  predictedProfit: number
  predictedExecutionTime: number
  riskScore: number // 0-10
  factors: {
    name: string
    impact: number // -1 to 1
    description: string
  }[]
}

export interface BacktestResult {
  strategy: string
  period: { start: number; end: number }
  totalTrades: number
  successfulTrades: number
  successRate: number
  totalProfit: number
  totalLoss: number
  netProfit: number
  maxDrawdown: number
  sharpeRatio: number
  avgTradeTime: number
  profitFactor: number
}

/**
 * Analizador de Patrones de Mercado
 */
export class MarketAnalyzer {
  private marketData: MarketData[] = []
  private patterns: Map<string, OpportunityPattern> = new Map()
  private predictions: PredictionResult[] = []

  constructor() {
    this.initializePatterns()
  }

  /**
   * Inicializar patrones de oportunidades conocidos
   */
  private initializePatterns(): void {
    const patterns: OpportunityPattern[] = [
      {
        id: 'high-volatility-arbitrage',
        name: 'Arbitraje en Alta Volatilidad',
        description: 'Diferencias de precio durante picos de volatilidad',
        conditions: [
          { metric: 'volatility', operator: 'gt', value: 0.05, weight: 0.4 },
          { metric: 'volume', operator: 'gt', value: 1000000, weight: 0.3 },
          { metric: 'gasPrice', operator: 'lt', value: 50, weight: 0.3 }
        ],
        confidence: 85,
        historicalSuccessRate: 78,
        avgProfitBps: 150, // 1.5%
        frequency: 12
      },
      {
        id: 'low-gas-opportunity',
        name: 'Oportunidad de Gas Bajo',
        description: 'Arbitrajes rentables durante períodos de gas bajo',
        conditions: [
          { metric: 'gasPrice', operator: 'lt', value: 25, weight: 0.5 },
          { metric: 'liquidity', operator: 'gt', value: 500000, weight: 0.3 },
          { metric: 'price', operator: 'between', value: [0.01, 100], weight: 0.2 }
        ],
        confidence: 92,
        historicalSuccessRate: 88,
        avgProfitBps: 80, // 0.8%
        frequency: 8
      },
      {
        id: 'dex-imbalance',
        name: 'Desequilibrio entre DEXs',
        description: 'Diferencias significativas de precio entre exchanges',
        conditions: [
          { metric: 'volume', operator: 'between', value: [100000, 10000000], weight: 0.4 },
          { metric: 'volatility', operator: 'between', value: [0.02, 0.08], weight: 0.3 },
          { metric: 'liquidity', operator: 'gt', value: 1000000, weight: 0.3 }
        ],
        confidence: 75,
        historicalSuccessRate: 65,
        avgProfitBps: 200, // 2%
        frequency: 15
      }
    ]

    patterns.forEach(pattern => {
      this.patterns.set(pattern.id, pattern)
    })
  }

  /**
   * Añadir datos de mercado
   */
  addMarketData(data: MarketData[]): void {
    this.marketData.push(...data)
    
    // Mantener solo los últimos 10,000 puntos de datos
    if (this.marketData.length > 10000) {
      this.marketData = this.marketData.slice(-10000)
    }
  }

  /**
   * Analizar patrones en los datos actuales
   */
  analyzePatterns(): {
    detectedPatterns: string[]
    confidence: number
    predictions: PredictionResult[]
  } {
    if (this.marketData.length < 10) {
      return { detectedPatterns: [], confidence: 0, predictions: [] }
    }

    const recentData = this.marketData.slice(-50) // Últimos 50 puntos
    const detectedPatterns: string[] = []
    let totalConfidence = 0

    // Evaluar cada patrón
    this.patterns.forEach((pattern, patternId) => {
      const patternScore = this.evaluatePattern(pattern, recentData)
      
      if (patternScore > 0.7) { // Umbral de confianza del 70%
        detectedPatterns.push(patternId)
        totalConfidence += patternScore * pattern.confidence
      }
    })

    const avgConfidence = detectedPatterns.length > 0 ? 
      totalConfidence / detectedPatterns.length : 0

    // Generar predicciones
    const predictions = this.generatePredictions(recentData, detectedPatterns)

    return {
      detectedPatterns,
      confidence: avgConfidence,
      predictions
    }
  }

  /**
   * Evaluar un patrón específico contra los datos
   */
  private evaluatePattern(pattern: OpportunityPattern, data: MarketData[]): number {
    if (data.length === 0) return 0

    const latestData = data[data.length - 1]
    let totalScore = 0
    let totalWeight = 0

    pattern.conditions.forEach(condition => {
      const value = this.getMetricValue(latestData, condition.metric)
      const conditionMet = this.evaluateCondition(condition, value, data)
      
      if (conditionMet) {
        totalScore += condition.weight
      }
      totalWeight += condition.weight
    })

    return totalWeight > 0 ? totalScore / totalWeight : 0
  }

  /**
   * Obtener valor de métrica de los datos de mercado
   */
  private getMetricValue(data: MarketData, metric: string): number {
    switch (metric) {
      case 'price': return data.price
      case 'volume': return data.volume
      case 'liquidity': return data.liquidity
      case 'volatility': return data.volatility
      case 'gasPrice': return data.gasPrice
      default: return 0
    }
  }

  /**
   * Evaluar condición específica
   */
  private evaluateCondition(condition: PatternCondition, value: number, data: MarketData[]): boolean {
    switch (condition.operator) {
      case 'gt':
        return value > (condition.value as number)
      case 'lt':
        return value < (condition.value as number)
      case 'eq':
        return Math.abs(value - (condition.value as number)) < 0.001
      case 'between':
        const [min, max] = condition.value as [number, number]
        return value >= min && value <= max
      case 'trend':
        return this.evaluateTrend(data, condition.metric) > (condition.value as number)
      default:
        return false
    }
  }

  /**
   * Evaluar tendencia de una métrica
   */
  private evaluateTrend(data: MarketData[], metric: string): number {
    if (data.length < 5) return 0

    const recent = data.slice(-5)
    const values = recent.map(d => this.getMetricValue(d, metric))
    
    // Calcular pendiente simple
    let slope = 0
    for (let i = 1; i < values.length; i++) {
      slope += values[i] - values[i - 1]
    }
    
    return slope / (values.length - 1)
  }

  /**
   * Generar predicciones basadas en patrones detectados
   */
  private generatePredictions(data: MarketData[], detectedPatterns: string[]): PredictionResult[] {
    const predictions: PredictionResult[] = []
    const latestData = data[data.length - 1]

    detectedPatterns.forEach(patternId => {
      const pattern = this.patterns.get(patternId)
      if (!pattern) return

      // Generar predicción para este patrón
      const prediction: PredictionResult = {
        timestamp: Date.now(),
        tokenPair: latestData.tokenPair,
        strategy: this.mapPatternToStrategy(patternId),
        confidence: pattern.confidence * this.calculateMarketConditionFactor(data),
        predictedProfit: this.estimateProfit(pattern, latestData),
        predictedExecutionTime: this.estimateExecutionTime(pattern, latestData),
        riskScore: this.calculateRiskScore(pattern, data),
        factors: this.identifyKeyFactors(pattern, latestData)
      }

      predictions.push(prediction)
    })

    return predictions
  }

  /**
   * Mapear patrón a estrategia de ejecución
   */
  private mapPatternToStrategy(patternId: string): string {
    const strategyMap: { [key: string]: string } = {
      'high-volatility-arbitrage': 'INTRA_DEX',
      'low-gas-opportunity': 'FLASH_LOAN',
      'dex-imbalance': 'INTER_DEX'
    }
    
    return strategyMap[patternId] || 'INTRA_DEX'
  }

  /**
   * Calcular factor de condiciones del mercado
   */
  private calculateMarketConditionFactor(data: MarketData[]): number {
    if (data.length < 5) return 0.5

    const recent = data.slice(-5)
    
    // Factor basado en volatilidad (más volatilidad = más oportunidades pero más riesgo)
    const avgVolatility = recent.reduce((sum, d) => sum + d.volatility, 0) / recent.length
    const volatilityFactor = Math.min(1, avgVolatility * 10) // Normalizar
    
    // Factor basado en volumen (más volumen = mejores oportunidades)
    const avgVolume = recent.reduce((sum, d) => sum + d.volume, 0) / recent.length
    const volumeFactor = Math.min(1, avgVolume / 1000000) // Normalizar a 1M
    
    // Factor basado en gas (gas bajo = mejor)
    const avgGas = recent.reduce((sum, d) => sum + d.gasPrice, 0) / recent.length
    const gasFactor = Math.max(0, 1 - (avgGas / 100)) // Normalizar a 100 Gwei
    
    return (volatilityFactor * 0.4 + volumeFactor * 0.4 + gasFactor * 0.2)
  }

  /**
   * Estimar ganancia basada en el patrón
   */
  private estimateProfit(pattern: OpportunityPattern, data: MarketData): number {
    const baseProfitBps = pattern.avgProfitBps
    const volumeFactor = Math.min(2, data.volume / 1000000) // Max 2x multiplier
    const liquidityFactor = Math.min(1.5, data.liquidity / 500000) // Max 1.5x multiplier
    
    const estimatedProfitBps = baseProfitBps * volumeFactor * liquidityFactor
    
    // Convertir a USD (asumiendo precio token)
    return (estimatedProfitBps / 10000) * data.price * 100 // Base 100 tokens
  }

  /**
   * Estimar tiempo de ejecución
   */
  private estimateExecutionTime(pattern: OpportunityPattern, data: MarketData): number {
    // Base tiempo de ejecución (5-30 segundos)
    let baseTime = 15
    
    // Ajustar por gas price (más gas = más rápido)
    const gasFactor = Math.min(2, data.gasPrice / 50)
    
    // Ajustar por volatilidad (más volatilidad = más urgencia)
    const volatilityFactor = Math.max(0.5, 2 - data.volatility * 20)
    
    return baseTime * volatilityFactor / gasFactor
  }

  /**
   * Calcular score de riesgo
   */
  private calculateRiskScore(pattern: OpportunityPattern, data: MarketData[]): number {
    const latestData = data[data.length - 1]
    
    let riskScore = 5 // Base medio
    
    // Riesgo por volatilidad
    riskScore += latestData.volatility * 20
    
    // Riesgo por gas alto
    if (latestData.gasPrice > 75) riskScore += 2
    
    // Riesgo por baja liquidez
    if (latestData.liquidity < 100000) riskScore += 3
    
    // Ajustar por éxito histórico del patrón
    riskScore *= (1 - pattern.historicalSuccessRate / 100)
    
    return Math.max(1, Math.min(10, riskScore))
  }

  /**
   * Identificar factores clave
   */
  private identifyKeyFactors(pattern: OpportunityPattern, data: MarketData): PredictionResult['factors'] {
    return [
      {
        name: 'Volatilidad',
        impact: data.volatility > 0.05 ? 0.8 : -0.3,
        description: `Volatilidad ${data.volatility > 0.05 ? 'alta' : 'baja'} favorece arbitrajes`
      },
      {
        name: 'Gas Price',
        impact: data.gasPrice < 50 ? 0.6 : -0.4,
        description: `Gas ${data.gasPrice < 50 ? 'bajo' : 'alto'} afecta rentabilidad`
      },
      {
        name: 'Liquidez',
        impact: data.liquidity > 1000000 ? 0.7 : -0.2,
        description: `Liquidez ${data.liquidity > 1000000 ? 'alta' : 'baja'} para ejecución`
      },
      {
        name: 'Volumen',
        impact: data.volume > 500000 ? 0.5 : -0.1,
        description: `Volumen ${data.volume > 500000 ? 'alto' : 'bajo'} indica actividad`
      }
    ]
  }

  // ============================================
  // API PÚBLICA
  // ============================================

  getPatterns(): OpportunityPattern[] {
    return Array.from(this.patterns.values())
  }

  addPattern(pattern: OpportunityPattern): void {
    this.patterns.set(pattern.id, pattern)
  }

  getRecentPredictions(count = 10): PredictionResult[] {
    return this.predictions.slice(-count)
  }

  /**
   * Realizar backtest de estrategia
   */
  backtest(strategy: string, startTime: number, endTime: number): BacktestResult {
    const relevantData = this.marketData.filter(
      d => d.timestamp >= startTime && d.timestamp <= endTime
    )

    if (relevantData.length < 10) {
      throw new Error('Insufficient data for backtesting')
    }

    // Simular trades basados en la estrategia
    const trades = this.simulateTrades(strategy, relevantData)
    
    return this.calculateBacktestMetrics(strategy, trades, startTime, endTime)
  }

  /**
   * Simular trades para backtesting
   */
  private simulateTrades(strategy: string, data: MarketData[]): {
    timestamp: number
    profit: number
    executionTime: number
    successful: boolean
  }[] {
    const trades = []
    
    for (let i = 10; i < data.length; i += 5) { // Cada 5 puntos simular trade
      const slice = data.slice(i - 10, i)
      const analysis = this.analyzePatterns()
      
      if (analysis.confidence > 60) { // Solo trades con confianza > 60%
        const prediction = analysis.predictions.find(p => p.strategy === strategy)
        
        if (prediction) {
          const successful = Math.random() < (prediction.confidence / 100)
          const profit = successful ? prediction.predictedProfit : -prediction.predictedProfit * 0.3
          
          trades.push({
            timestamp: data[i].timestamp,
            profit,
            executionTime: prediction.predictedExecutionTime,
            successful
          })
        }
      }
    }
    
    return trades
  }

  /**
   * Calcular métricas de backtest
   */
  private calculateBacktestMetrics(
    strategy: string, 
    trades: any[], 
    startTime: number, 
    endTime: number
  ): BacktestResult {
    const totalTrades = trades.length
    const successfulTrades = trades.filter(t => t.successful).length
    const successRate = totalTrades > 0 ? (successfulTrades / totalTrades) * 100 : 0
    
    const profits = trades.filter(t => t.profit > 0).map(t => t.profit)
    const losses = trades.filter(t => t.profit < 0).map(t => Math.abs(t.profit))
    
    const totalProfit = profits.reduce((sum, p) => sum + p, 0)
    const totalLoss = losses.reduce((sum, l) => sum + l, 0)
    const netProfit = totalProfit - totalLoss
    
    const maxDrawdown = this.calculateMaxDrawdown(trades)
    const sharpeRatio = this.calculateSharpeRatio(trades)
    const avgTradeTime = trades.reduce((sum, t) => sum + t.executionTime, 0) / totalTrades
    const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? 10 : 0

    return {
      strategy,
      period: { start: startTime, end: endTime },
      totalTrades,
      successfulTrades,
      successRate,
      totalProfit,
      totalLoss,
      netProfit,
      maxDrawdown,
      sharpeRatio,
      avgTradeTime,
      profitFactor
    }
  }

  private calculateMaxDrawdown(trades: any[]): number {
    let maxDrawdown = 0
    let peak = 0
    let runningProfit = 0

    for (const trade of trades) {
      runningProfit += trade.profit
      if (runningProfit > peak) {
        peak = runningProfit
      }
      const drawdown = peak - runningProfit
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown
      }
    }

    return maxDrawdown
  }

  private calculateSharpeRatio(trades: any[]): number {
    if (trades.length < 2) return 0

    const returns = trades.map(t => t.profit)
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length
    
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (returns.length - 1)
    const stdDev = Math.sqrt(variance)
    
    return stdDev > 0 ? avgReturn / stdDev : 0
  }
}

// Exportar instancia singleton
export const marketAnalyzer = new MarketAnalyzer()
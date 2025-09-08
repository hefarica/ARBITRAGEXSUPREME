/**
 * ArbitrageX Supreme - Sistema de Optimización de Estrategias
 * Ingenio Pichichi S.A. - Actividades 13-20
 * 
 * Optimización automática de parámetros y estrategias adaptativas
 */

import { MarketAnalyzer, BacktestResult, MarketData } from './analytics'

// Types para optimización
export interface StrategyParameters {
  id: string
  name: string
  parameters: {
    [key: string]: {
      value: number
      min: number
      max: number
      step: number
      description: string
    }
  }
}

export interface OptimizationTarget {
  metric: 'netProfit' | 'successRate' | 'sharpeRatio' | 'profitFactor'
  weight: number
  minimize?: boolean // false = maximizar (default)
}

export interface OptimizationResult {
  strategyId: string
  optimizedParameters: { [key: string]: number }
  performance: BacktestResult
  score: number
  iterations: number
  convergenceTime: number
  improvements: {
    parameter: string
    oldValue: number
    newValue: number
    impact: number
  }[]
}

export interface AdaptiveConfiguration {
  enabled: boolean
  adaptationInterval: number // milliseconds
  performanceWindow: number // number of trades to consider
  minSampleSize: number
  maxParameterChange: number // percentage
}

/**
 * Optimizador de Estrategias con Algoritmos Genéticos
 */
export class StrategyOptimizer {
  private analyzer: MarketAnalyzer
  private strategies: Map<string, StrategyParameters> = new Map()
  private optimizationHistory: Map<string, OptimizationResult[]> = new Map()
  private adaptiveConfig: AdaptiveConfiguration

  constructor(analyzer: MarketAnalyzer) {
    this.analyzer = analyzer
    this.adaptiveConfig = {
      enabled: true,
      adaptationInterval: 3600000, // 1 hora
      performanceWindow: 100,
      minSampleSize: 20,
      maxParameterChange: 0.2 // 20%
    }
    this.initializeDefaultStrategies()
  }

  /**
   * Inicializar estrategias por defecto con parámetros optimizables
   */
  private initializeDefaultStrategies(): void {
    const defaultStrategies: StrategyParameters[] = [
      {
        id: 'INTRA_DEX',
        name: 'Arbitraje Intra-DEX',
        parameters: {
          minProfitBps: {
            value: 50,
            min: 10,
            max: 500,
            step: 5,
            description: 'Beneficio mínimo en basis points'
          },
          maxSlippageBps: {
            value: 300,
            min: 50,
            max: 1000,
            step: 25,
            description: 'Slippage máximo permitido en basis points'
          },
          gasMultiplier: {
            value: 1.2,
            min: 1.0,
            max: 2.0,
            step: 0.1,
            description: 'Multiplicador de gas para ejecución rápida'
          },
          timeoutSeconds: {
            value: 30,
            min: 5,
            max: 120,
            step: 5,
            description: 'Timeout de ejecución en segundos'
          },
          minLiquidity: {
            value: 100000,
            min: 10000,
            max: 1000000,
            step: 10000,
            description: 'Liquidez mínima requerida en USD'
          }
        }
      },
      {
        id: 'INTER_DEX',
        name: 'Arbitraje Inter-DEX',
        parameters: {
          minProfitBps: {
            value: 80,
            min: 20,
            max: 800,
            step: 10,
            description: 'Beneficio mínimo en basis points'
          },
          maxPriceImpact: {
            value: 0.02,
            min: 0.005,
            max: 0.1,
            step: 0.005,
            description: 'Impacto máximo de precio'
          },
          bridgeTimeout: {
            value: 60,
            min: 30,
            max: 300,
            step: 15,
            description: 'Timeout para bridges en segundos'
          },
          maxGasPrice: {
            value: 100,
            min: 20,
            max: 500,
            step: 10,
            description: 'Precio máximo de gas en Gwei'
          },
          confidenceThreshold: {
            value: 0.75,
            min: 0.5,
            max: 0.95,
            step: 0.05,
            description: 'Umbral de confianza mínimo'
          }
        }
      },
      {
        id: 'FLASH_LOAN',
        name: 'Flash Loan Arbitrage',
        parameters: {
          minProfitBps: {
            value: 30,
            min: 5,
            max: 300,
            step: 5,
            description: 'Beneficio mínimo en basis points'
          },
          flashLoanFee: {
            value: 0.0009,
            min: 0.0001,
            max: 0.01,
            step: 0.0001,
            description: 'Fee de flash loan'
          },
          maxLeverage: {
            value: 3,
            min: 1,
            max: 10,
            step: 1,
            description: 'Apalancamiento máximo'
          },
          executionBuffer: {
            value: 1.5,
            min: 1.1,
            max: 3.0,
            step: 0.1,
            description: 'Buffer de seguridad para ejecución'
          },
          protocolRisk: {
            value: 0.1,
            min: 0.01,
            max: 0.5,
            step: 0.01,
            description: 'Factor de riesgo del protocolo'
          }
        }
      }
    ]

    defaultStrategies.forEach(strategy => {
      this.strategies.set(strategy.id, strategy)
    })
  }

  /**
   * Optimizar estrategia usando algoritmo genético
   */
  async optimizeStrategy(
    strategyId: string,
    targets: OptimizationTarget[],
    options: {
      populationSize?: number
      generations?: number
      mutationRate?: number
      crossoverRate?: number
      eliteSize?: number
    } = {}
  ): Promise<OptimizationResult> {
    const strategy = this.strategies.get(strategyId)
    if (!strategy) {
      throw new Error(`Strategy ${strategyId} not found`)
    }

    const opts = {
      populationSize: 50,
      generations: 100,
      mutationRate: 0.1,
      crossoverRate: 0.8,
      eliteSize: 5,
      ...options
    }

    console.log(`🔧 Optimizando estrategia ${strategyId}...`)
    const startTime = Date.now()

    // Generar población inicial
    let population = this.generateInitialPopulation(strategy, opts.populationSize)
    let bestIndividual = population[0]
    let bestScore = -Infinity

    const improvements: OptimizationResult['improvements'] = []

    for (let generation = 0; generation < opts.generations; generation++) {
      // Evaluar fitness de toda la población
      const scores = await Promise.all(
        population.map(individual => this.evaluateFitness(individual, strategyId, targets))
      )

      // Encontrar el mejor individuo de esta generación
      for (let i = 0; i < population.length; i++) {
        if (scores[i] > bestScore) {
          const oldParams = { ...bestIndividual }
          bestIndividual = { ...population[i] }
          bestScore = scores[i]

          // Registrar mejoras significativas
          Object.keys(bestIndividual).forEach(param => {
            const oldValue = oldParams[param] || strategy.parameters[param].value
            const newValue = bestIndividual[param]
            if (Math.abs(newValue - oldValue) / oldValue > 0.05) { // 5% change
              improvements.push({
                parameter: param,
                oldValue,
                newValue,
                impact: (newValue - oldValue) / oldValue
              })
            }
          })
        }
      }

      // Selección, crossover y mutación
      population = this.evolvePopulation(
        population, 
        scores, 
        strategy, 
        opts
      )

      // Log progreso cada 10 generaciones
      if (generation % 10 === 0) {
        console.log(`Generación ${generation}: Best score = ${bestScore.toFixed(4)}`)
      }
    }

    // Ejecutar backtest final con mejores parámetros
    const finalBacktest = await this.runBacktestWithParameters(bestIndividual, strategyId)

    const result: OptimizationResult = {
      strategyId,
      optimizedParameters: bestIndividual,
      performance: finalBacktest,
      score: bestScore,
      iterations: opts.generations,
      convergenceTime: Date.now() - startTime,
      improvements
    }

    // Guardar en historial
    if (!this.optimizationHistory.has(strategyId)) {
      this.optimizationHistory.set(strategyId, [])
    }
    this.optimizationHistory.get(strategyId)!.push(result)

    console.log(`✅ Optimización completada en ${result.convergenceTime}ms`)
    console.log(`📈 Score mejorado: ${bestScore.toFixed(4)}`)
    console.log(`🔄 ${improvements.length} parámetros optimizados`)

    return result
  }

  /**
   * Generar población inicial aleatoria
   */
  private generateInitialPopulation(
    strategy: StrategyParameters, 
    size: number
  ): { [key: string]: number }[] {
    const population = []

    for (let i = 0; i < size; i++) {
      const individual: { [key: string]: number } = {}
      
      Object.entries(strategy.parameters).forEach(([param, config]) => {
        // Generar valor aleatorio dentro del rango
        const range = config.max - config.min
        const randomValue = config.min + Math.random() * range
        
        // Redondear al step más cercano
        individual[param] = Math.round(randomValue / config.step) * config.step
      })
      
      population.push(individual)
    }

    return population
  }

  /**
   * Evaluar fitness de un individuo
   */
  private async evaluateFitness(
    individual: { [key: string]: number },
    strategyId: string,
    targets: OptimizationTarget[]
  ): Promise<number> {
    try {
      // Ejecutar backtest con estos parámetros
      const backtest = await this.runBacktestWithParameters(individual, strategyId)
      
      // Calcular score compuesto basado en targets
      let totalScore = 0
      let totalWeight = 0

      targets.forEach(target => {
        let metricValue: number
        
        switch (target.metric) {
          case 'netProfit':
            metricValue = backtest.netProfit
            break
          case 'successRate':
            metricValue = backtest.successRate
            break
          case 'sharpeRatio':
            metricValue = backtest.sharpeRatio
            break
          case 'profitFactor':
            metricValue = backtest.profitFactor
            break
          default:
            metricValue = 0
        }

        // Normalizar y aplicar peso
        const normalizedValue = target.minimize ? -metricValue : metricValue
        totalScore += normalizedValue * target.weight
        totalWeight += target.weight
      })

      return totalWeight > 0 ? totalScore / totalWeight : 0
    } catch (error) {
      console.error('Error evaluating fitness:', error)
      return -Infinity // Penalizar parámetros que causan errores
    }
  }

  /**
   * Ejecutar backtest con parámetros específicos
   */
  private async runBacktestWithParameters(
    parameters: { [key: string]: number },
    strategyId: string
  ): Promise<BacktestResult> {
    // Simular aplicación de parámetros y backtest
    // En una implementación real, esto actualizaría los contratos y ejecutaría un backtest
    
    const endTime = Date.now()
    const startTime = endTime - (7 * 24 * 60 * 60 * 1000) // 7 días atrás
    
    return this.analyzer.backtest(strategyId, startTime, endTime)
  }

  /**
   * Evolucionar población (selección, crossover, mutación)
   */
  private evolvePopulation(
    population: { [key: string]: number }[],
    scores: number[],
    strategy: StrategyParameters,
    opts: any
  ): { [key: string]: number }[] {
    const newPopulation = []

    // Elitismo - conservar mejores individuos
    const sortedIndices = scores
      .map((score, index) => ({ score, index }))
      .sort((a, b) => b.score - a.score)
      .slice(0, opts.eliteSize)

    sortedIndices.forEach(({ index }) => {
      newPopulation.push({ ...population[index] })
    })

    // Generar resto de población
    while (newPopulation.length < opts.populationSize) {
      // Selección por torneo
      const parent1 = this.tournamentSelection(population, scores, 3)
      const parent2 = this.tournamentSelection(population, scores, 3)

      // Crossover
      let offspring1, offspring2
      if (Math.random() < opts.crossoverRate) {
        [offspring1, offspring2] = this.crossover(parent1, parent2, strategy)
      } else {
        offspring1 = { ...parent1 }
        offspring2 = { ...parent2 }
      }

      // Mutación
      if (Math.random() < opts.mutationRate) {
        this.mutate(offspring1, strategy, opts.mutationRate)
      }
      if (Math.random() < opts.mutationRate) {
        this.mutate(offspring2, strategy, opts.mutationRate)
      }

      newPopulation.push(offspring1)
      if (newPopulation.length < opts.populationSize) {
        newPopulation.push(offspring2)
      }
    }

    return newPopulation
  }

  /**
   * Selección por torneo
   */
  private tournamentSelection(
    population: { [key: string]: number }[],
    scores: number[],
    tournamentSize: number
  ): { [key: string]: number } {
    let bestIndex = Math.floor(Math.random() * population.length)
    let bestScore = scores[bestIndex]

    for (let i = 1; i < tournamentSize; i++) {
      const candidateIndex = Math.floor(Math.random() * population.length)
      if (scores[candidateIndex] > bestScore) {
        bestIndex = candidateIndex
        bestScore = scores[candidateIndex]
      }
    }

    return { ...population[bestIndex] }
  }

  /**
   * Crossover uniforme
   */
  private crossover(
    parent1: { [key: string]: number },
    parent2: { [key: string]: number },
    strategy: StrategyParameters
  ): [{ [key: string]: number }, { [key: string]: number }] {
    const offspring1: { [key: string]: number } = {}
    const offspring2: { [key: string]: number } = {}

    Object.keys(strategy.parameters).forEach(param => {
      if (Math.random() < 0.5) {
        offspring1[param] = parent1[param]
        offspring2[param] = parent2[param]
      } else {
        offspring1[param] = parent2[param]
        offspring2[param] = parent1[param]
      }
    })

    return [offspring1, offspring2]
  }

  /**
   * Mutación gaussiana
   */
  private mutate(
    individual: { [key: string]: number },
    strategy: StrategyParameters,
    mutationRate: number
  ): void {
    Object.entries(strategy.parameters).forEach(([param, config]) => {
      if (Math.random() < mutationRate) {
        // Mutación gaussiana con 10% del rango como desviación estándar
        const range = config.max - config.min
        const stdDev = range * 0.1
        const mutation = this.gaussianRandom() * stdDev
        
        let newValue = individual[param] + mutation
        
        // Mantener dentro de límites
        newValue = Math.max(config.min, Math.min(config.max, newValue))
        
        // Redondear al step más cercano
        individual[param] = Math.round(newValue / config.step) * config.step
      }
    })
  }

  /**
   * Generar número aleatorio con distribución gaussiana
   */
  private gaussianRandom(): number {
    // Box-Muller transform
    const u = 0.9999 * Math.random() + 0.0001 // Evitar 0
    const v = 0.9999 * Math.random() + 0.0001
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
  }

  /**
   * Adaptación automática de parámetros
   */
  async adaptStrategy(strategyId: string): Promise<OptimizationResult | null> {
    if (!this.adaptiveConfig.enabled) return null

    const strategy = this.strategies.get(strategyId)
    if (!strategy) return null

    // Verificar si hay suficientes datos para adaptación
    const recentTrades = this.getRecentTradePerformance(strategyId)
    if (recentTrades.length < this.adaptiveConfig.minSampleSize) {
      return null
    }

    console.log(`🔄 Adaptación automática iniciada para ${strategyId}`)

    // Targets adaptativos basados en performance reciente
    const targets: OptimizationTarget[] = [
      { metric: 'successRate', weight: 0.4 },
      { metric: 'netProfit', weight: 0.3 },
      { metric: 'sharpeRatio', weight: 0.3 }
    ]

    // Optimización ligera (menos generaciones para adaptación rápida)
    return await this.optimizeStrategy(strategyId, targets, {
      populationSize: 20,
      generations: 30,
      mutationRate: 0.15,
      crossoverRate: 0.7
    })
  }

  /**
   * Obtener performance reciente de trades
   */
  private getRecentTradePerformance(strategyId: string): any[] {
    // En implementación real, esto consultaría la base de datos de trades
    // Por ahora, simular datos
    const trades = []
    const now = Date.now()
    
    for (let i = 0; i < 50; i++) {
      trades.push({
        timestamp: now - (i * 60000), // Cada minuto
        strategy: strategyId,
        profit: (Math.random() - 0.3) * 1000, // -300 a +700
        successful: Math.random() > 0.25 // 75% success rate
      })
    }
    
    return trades.slice(0, this.adaptiveConfig.performanceWindow)
  }

  // ============================================
  // API PÚBLICA
  // ============================================

  getStrategy(strategyId: string): StrategyParameters | undefined {
    return this.strategies.get(strategyId)
  }

  getAllStrategies(): StrategyParameters[] {
    return Array.from(this.strategies.values())
  }

  getOptimizationHistory(strategyId: string): OptimizationResult[] {
    return this.optimizationHistory.get(strategyId) || []
  }

  setAdaptiveConfiguration(config: Partial<AdaptiveConfiguration>): void {
    this.adaptiveConfig = { ...this.adaptiveConfig, ...config }
  }

  getAdaptiveConfiguration(): AdaptiveConfiguration {
    return { ...this.adaptiveConfig }
  }

  /**
   * Aplicar parámetros optimizados a una estrategia
   */
  applyOptimizedParameters(strategyId: string, parameters: { [key: string]: number }): boolean {
    const strategy = this.strategies.get(strategyId)
    if (!strategy) return false

    // Validar parámetros antes de aplicar
    for (const [param, value] of Object.entries(parameters)) {
      const config = strategy.parameters[param]
      if (!config) continue

      if (value < config.min || value > config.max) {
        console.warn(`Parámetro ${param} fuera de rango: ${value} (${config.min}-${config.max})`)
        return false
      }
    }

    // Aplicar parámetros
    Object.entries(parameters).forEach(([param, value]) => {
      if (strategy.parameters[param]) {
        strategy.parameters[param].value = value
      }
    })

    console.log(`✅ Parámetros aplicados a estrategia ${strategyId}`)
    return true
  }
}

// Crear instancia con el analizador
import { marketAnalyzer } from './analytics'
export const strategyOptimizer = new StrategyOptimizer(marketAnalyzer)
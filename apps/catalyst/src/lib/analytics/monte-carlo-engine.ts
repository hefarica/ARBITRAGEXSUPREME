/**
 * ArbitrageX Supreme - Monte Carlo Simulation Engine
 * Finalización Actividades 91-100: Monte Carlo y Grafana/Prometheus
 * 
 * Implementa:
 * - Monte Carlo simulation para análisis de riesgo
 * - Grafana Dashboard configuration
 * - Stress testing scenarios avanzados
 * - Portfolio risk assessment
 * - Value at Risk (VaR) calculations
 * - Expected Shortfall (ES) calculations
 * - Correlation analysis
 * - Scenario generation y path simulation
 * 
 * Siguiendo metodología Ingenio Pichichi S.A. - Metódico y Preciso
 */

import { EventEmitter } from 'events';
import {
  MonteCarloConfig,
  MonteCarloResult,
  SimulationPath,
  GrafanaDashboard,
  GrafanaPanel,
  GrafanaTarget,
  BacktestResult
} from './backtesting-engine';

// ============================================================================
// INTERFACES ADICIONALES PARA MONTE CARLO
// ============================================================================

export interface RiskScenario {
  name: string;
  description: string;
  probability: number;
  marketShock: {
    volatilityMultiplier: number;
    correlationChange: number;
    liquidityDrain: number; // 0-1
    priceImpact: number;
  };
  technicalFailure: {
    rpcFailureRate: number;
    bridgeFailureRate: number;
    gasSpike: number; // multiplier
    networkCongestion: number; // 0-1
  };
  duration: number; // days
}

export interface StressTesting {
  scenarios: RiskScenario[];
  baselinePortfolio: Portfolio;
  timeHorizon: number; // days
  confidenceLevels: number[];
}

export interface Portfolio {
  positions: PortfolioPosition[];
  cash: number;
  totalValue: number;
  currency: 'USD';
}

export interface PortfolioPosition {
  asset: string;
  chain: number;
  amount: number;
  value: number;
  weight: number;
}

export interface SimulationEngine {
  runSimulation(config: MonteCarloConfig): Promise<MonteCarloResult>;
  runStressTest(config: StressTesting): Promise<StressTestResult>;
  generateScenarios(count: number): RiskScenario[];
}

export interface StressTestResult {
  baseline: Portfolio;
  scenarios: ScenarioResult[];
  aggregateRisk: {
    worstCase: number;
    expectedLoss: number;
    recoveryTime: number;
    survivability: number; // 0-1
  };
  recommendations: string[];
}

export interface ScenarioResult {
  scenario: RiskScenario;
  portfolioImpact: {
    finalValue: number;
    maxDrawdown: number;
    recoveryDays: number;
    survivedScenario: boolean;
  };
  assetImpacts: Record<string, number>;
}

// ============================================================================
// MONTE CARLO SIMULATION ENGINE
// ============================================================================

export class MonteCarloEngine extends EventEmitter implements SimulationEngine {
  private randomSeed: number;
  private distributionGenerators: Map<string, Function>;

  constructor(seed?: number) {
    super();
    this.randomSeed = seed || Date.now();
    this.distributionGenerators = new Map();
    this.initializeDistributions();
  }

  private initializeDistributions(): void {
    // Normal distribution using Box-Muller transform
    this.distributionGenerators.set('normal', (mean: number = 0, std: number = 1): number => {
      const u1 = Math.random();
      const u2 = Math.random();
      const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      return z0 * std + mean;
    });

    // Log-normal distribution
    this.distributionGenerators.set('lognormal', (mu: number = 0, sigma: number = 1): number => {
      const normal = this.distributionGenerators.get('normal')!(mu, sigma);
      return Math.exp(normal);
    });

    // Student's t-distribution (approximation)
    this.distributionGenerators.set('student-t', (df: number = 3): number => {
      const normal = this.distributionGenerators.get('normal')!(0, 1);
      const chi2 = this.gammaDistribution(df / 2, 2);
      return normal / Math.sqrt(chi2 / df);
    });

    // Gamma distribution (using Marsaglia and Tsang method)
    this.distributionGenerators.set('gamma', (shape: number, scale: number): number => {
      return this.gammaDistribution(shape, scale);
    });
  }

  private gammaDistribution(shape: number, scale: number): number {
    if (shape < 1) {
      return this.gammaDistribution(shape + 1, scale) * Math.pow(Math.random(), 1 / shape);
    }

    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);

    while (true) {
      let x, v;
      do {
        x = this.distributionGenerators.get('normal')!(0, 1);
        v = 1 + c * x;
      } while (v <= 0);

      v = v * v * v;
      const u = Math.random();

      if (u < 1 - 0.0331 * x * x * x * x) {
        return d * v * scale;
      }

      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
        return d * v * scale;
      }
    }
  }

  async runSimulation(config: MonteCarloConfig): Promise<MonteCarloResult> {
    this.emit('simulationStarted', { config });
    const startTime = Date.now();

    try {
      const simulations: SimulationPath[] = [];

      // Ejecutar todas las simulaciones
      for (let i = 0; i < config.simulations; i++) {
        if (i % 100 === 0) {
          this.emit('simulationProgress', {
            current: i,
            total: config.simulations,
            percentage: (i / config.simulations) * 100
          });
        }

        const path = await this.generateSimulationPath(config, i);
        simulations.push(path);
      }

      // Calcular estadísticas
      const statistics = this.calculateStatistics(simulations);
      
      // Calcular métricas de riesgo
      const riskMetrics = this.calculateRiskMetrics(simulations, config.confidence);

      const result: MonteCarloResult = {
        config,
        simulations,
        statistics,
        riskMetrics
      };

      const duration = Date.now() - startTime;
      this.emit('simulationCompleted', { result, duration });

      return result;

    } catch (error) {
      this.emit('simulationFailed', { config, error: (error as Error).message });
      throw error;
    }
  }

  private async generateSimulationPath(config: MonteCarloConfig, pathId: number): Promise<SimulationPath> {
    const values: number[] = [];
    const timeSteps = config.timeHorizon; // Asumiendo pasos diarios
    
    let currentValue = 100; // Valor inicial normalizado
    values.push(currentValue);

    const returnsGenerator = this.distributionGenerators.get(config.variables.returns.distribution)!;
    const volatilityGenerator = this.distributionGenerators.get(config.variables.volatility.distribution)!;

    let maxDrawdown = 0;
    let peak = currentValue;
    let timeToRecovery: number | null = null;
    let inDrawdown = false;

    for (let t = 1; t <= timeSteps; t++) {
      // Generar return diario
      const dailyReturn = returnsGenerator(...config.variables.returns.parameters);
      
      // Generar volatilidad diaria
      const dailyVolatility = volatilityGenerator(...config.variables.volatility.parameters);
      
      // Aplicar correlación temporal si está configurada
      const correlation = this.calculateCorrelation(config, t);
      
      // Calcular nuevo valor
      const shock = this.generateShock(dailyReturn, dailyVolatility, correlation);
      currentValue *= (1 + shock);
      values.push(currentValue);

      // Calcular drawdown
      if (currentValue > peak) {
        peak = currentValue;
        if (inDrawdown && timeToRecovery === null) {
          timeToRecovery = t;
        }
        inDrawdown = false;
      } else {
        const drawdown = (peak - currentValue) / peak;
        maxDrawdown = Math.max(maxDrawdown, drawdown);
        if (!inDrawdown) {
          inDrawdown = true;
        }
      }
    }

    // Calcular métricas finales
    const finalValue = currentValue;
    const totalReturn = (finalValue - 100) / 100;
    const volatility = this.calculatePathVolatility(values);

    return {
      id: pathId,
      values,
      finalValue,
      maxDrawdown,
      timeToRecovery,
      totalReturn,
      volatility
    };
  }

  private calculateCorrelation(config: MonteCarloConfig, timeStep: number): number {
    switch (config.variables.correlation.model) {
      case 'constant':
        return config.variables.correlation.parameters[0] || 0;
      
      case 'dynamic':
        // Correlación que cambia en el tiempo
        const [base, amplitude, frequency] = config.variables.correlation.parameters;
        return base + amplitude * Math.sin(2 * Math.PI * frequency * timeStep / 365);
      
      case 'regime-switching':
        // Modelo simplificado de cambio de régimen
        const [lowCorr, highCorr, switchProb] = config.variables.correlation.parameters;
        return Math.random() < switchProb ? highCorr : lowCorr;
      
      default:
        return 0;
    }
  }

  private generateShock(baseReturn: number, volatility: number, correlation: number): number {
    // Combinar return base con shock de volatilidad y correlación
    const randomShock = this.distributionGenerators.get('normal')!(0, 1);
    const correlatedShock = correlation * randomShock + Math.sqrt(1 - correlation * correlation) * this.distributionGenerators.get('normal')!(0, 1);
    
    return baseReturn + volatility * correlatedShock;
  }

  private calculatePathVolatility(values: number[]): number {
    if (values.length < 2) return 0;

    const returns: number[] = [];
    for (let i = 1; i < values.length; i++) {
      returns.push((values[i] - values[i - 1]) / values[i - 1]);
    }

    const meanReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - meanReturn, 2), 0) / returns.length;
    
    return Math.sqrt(variance * 252); // Anualized volatility
  }

  private calculateStatistics(simulations: SimulationPath[]): MonteCarloResult['statistics'] {
    const finalValues = simulations.map(s => s.finalValue);
    const maxDrawdowns = simulations.map(s => s.maxDrawdown);
    const recoveryTimes = simulations
      .map(s => s.timeToRecovery)
      .filter(t => t !== null) as number[];

    const sortedFinalValues = [...finalValues].sort((a, b) => a - b);
    const sortedMaxDrawdowns = [...maxDrawdowns].sort((a, b) => a - b);
    const sortedRecoveryTimes = [...recoveryTimes].sort((a, b) => a - b);

    return {
      finalValue: {
        mean: finalValues.reduce((sum, val) => sum + val, 0) / finalValues.length,
        median: this.percentile(sortedFinalValues, 50),
        std: this.standardDeviation(finalValues),
        min: Math.min(...finalValues),
        max: Math.max(...finalValues),
        percentiles: {
          5: this.percentile(sortedFinalValues, 5),
          10: this.percentile(sortedFinalValues, 10),
          25: this.percentile(sortedFinalValues, 25),
          75: this.percentile(sortedFinalValues, 75),
          90: this.percentile(sortedFinalValues, 90),
          95: this.percentile(sortedFinalValues, 95),
          99: this.percentile(sortedFinalValues, 99)
        }
      },
      maxDrawdown: {
        mean: maxDrawdowns.reduce((sum, val) => sum + val, 0) / maxDrawdowns.length,
        median: this.percentile(sortedMaxDrawdowns, 50),
        std: this.standardDeviation(maxDrawdowns),
        percentiles: {
          5: this.percentile(sortedMaxDrawdowns, 5),
          10: this.percentile(sortedMaxDrawdowns, 10),
          25: this.percentile(sortedMaxDrawdowns, 25),
          75: this.percentile(sortedMaxDrawdowns, 75),
          90: this.percentile(sortedMaxDrawdowns, 90),
          95: this.percentile(sortedMaxDrawdowns, 95),
          99: this.percentile(sortedMaxDrawdowns, 99)
        }
      },
      timeToRecovery: {
        mean: recoveryTimes.length > 0 ? recoveryTimes.reduce((sum, val) => sum + val, 0) / recoveryTimes.length : 0,
        median: recoveryTimes.length > 0 ? this.percentile(sortedRecoveryTimes, 50) : 0,
        percentiles: recoveryTimes.length > 0 ? {
          25: this.percentile(sortedRecoveryTimes, 25),
          50: this.percentile(sortedRecoveryTimes, 50),
          75: this.percentile(sortedRecoveryTimes, 75),
          90: this.percentile(sortedRecoveryTimes, 90),
          95: this.percentile(sortedRecoveryTimes, 95)
        } : {}
      }
    };
  }

  private calculateRiskMetrics(
    simulations: SimulationPath[],
    confidenceLevels: number[]
  ): MonteCarloResult['riskMetrics'] {
    const finalValues = simulations.map(s => s.finalValue);
    const returns = simulations.map(s => s.totalReturn);
    const sortedReturns = [...returns].sort((a, b) => a - b);

    const var: Record<number, number> = {};
    const expectedShortfall: Record<number, number> = {};

    for (const confidence of confidenceLevels) {
      const alpha = (100 - confidence) / 100;
      const varIndex = Math.floor(alpha * sortedReturns.length);
      
      var[confidence] = sortedReturns[varIndex] || 0;
      
      // Expected Shortfall (CVaR) - promedio de losses peores que VaR
      const tailLosses = sortedReturns.slice(0, varIndex + 1);
      expectedShortfall[confidence] = tailLosses.length > 0 
        ? tailLosses.reduce((sum, loss) => sum + loss, 0) / tailLosses.length 
        : 0;
    }

    const negativePaths = simulations.filter(s => s.totalReturn < 0);
    const probabilityOfLoss = negativePaths.length / simulations.length;

    const expectedReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const expectedVolatility = this.standardDeviation(returns);

    return {
      var,
      expectedShortfall,
      probabilityOfLoss,
      expectedReturn,
      expectedVolatility
    };
  }

  private percentile(sortedArray: number[], percentile: number): number {
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)] || 0;
  }

  private standardDeviation(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  async runStressTest(config: StressTesting): Promise<StressTestResult> {
    this.emit('stressTestStarted', { config });

    const scenarioResults: ScenarioResult[] = [];

    for (const scenario of config.scenarios) {
      this.emit('stressTestScenario', { scenario: scenario.name });
      
      const result = await this.simulateStressScenario(
        config.baselinePortfolio,
        scenario,
        config.timeHorizon
      );
      
      scenarioResults.push(result);
    }

    const aggregateRisk = this.calculateAggregateRisk(scenarioResults, config.baselinePortfolio);

    return {
      baseline: config.baselinePortfolio,
      scenarios: scenarioResults,
      aggregateRisk,
      recommendations: this.generateStressTestRecommendations(scenarioResults, aggregateRisk)
    };
  }

  private async simulateStressScenario(
    portfolio: Portfolio,
    scenario: RiskScenario,
    timeHorizon: number
  ): Promise<ScenarioResult> {
    let currentPortfolio = JSON.parse(JSON.stringify(portfolio)); // Deep copy
    let maxDrawdown = 0;
    let peak = currentPortfolio.totalValue;
    let recoveryDays = 0;
    let recovered = false;

    const assetImpacts: Record<string, number> = {};

    // Simular el escenario día por día
    for (let day = 0; day < Math.min(scenario.duration, timeHorizon); day++) {
      // Aplicar shocks del escenario
      for (const position of currentPortfolio.positions) {
        const marketShock = this.calculateMarketShock(scenario, position.asset, day);
        const technicalImpact = this.calculateTechnicalImpact(scenario, position.chain);
        
        const totalImpact = marketShock * (1 - technicalImpact);
        position.value *= (1 + totalImpact);
        position.amount = position.value / this.getAssetPrice(position.asset); // Simplified

        // Registrar impacto acumulado
        assetImpacts[position.asset] = (assetImpacts[position.asset] || 0) + totalImpact;
      }

      // Recalcular valor total del portfolio
      currentPortfolio.totalValue = currentPortfolio.cash + 
        currentPortfolio.positions.reduce((sum, pos) => sum + pos.value, 0);

      // Calcular drawdown
      if (currentPortfolio.totalValue > peak) {
        peak = currentPortfolio.totalValue;
        if (!recovered) {
          recoveryDays = day;
          recovered = true;
        }
      } else {
        const drawdown = (peak - currentPortfolio.totalValue) / peak;
        maxDrawdown = Math.max(maxDrawdown, drawdown);
        recovered = false;
      }
    }

    // Continuar simulación post-escenario para calcular recuperación
    if (!recovered) {
      for (let day = scenario.duration; day < timeHorizon; day++) {
        // Recuperación gradual (simplificada)
        const recoveryRate = 0.001; // 0.1% diario
        
        for (const position of currentPortfolio.positions) {
          position.value *= (1 + recoveryRate);
        }

        currentPortfolio.totalValue = currentPortfolio.cash + 
          currentPortfolio.positions.reduce((sum, pos) => sum + pos.value, 0);

        if (currentPortfolio.totalValue >= peak * 0.99) { // 99% de recuperación
          recoveryDays = day;
          recovered = true;
          break;
        }
      }
    }

    return {
      scenario,
      portfolioImpact: {
        finalValue: currentPortfolio.totalValue,
        maxDrawdown,
        recoveryDays: recovered ? recoveryDays : timeHorizon,
        survivedScenario: currentPortfolio.totalValue > portfolio.totalValue * 0.5 // Supervivencia si pierde menos del 50%
      },
      assetImpacts
    };
  }

  private calculateMarketShock(scenario: RiskScenario, asset: string, day: number): number {
    const { volatilityMultiplier, priceImpact } = scenario.marketShock;
    
    // Shock inicial más fuerte, luego decae exponencialmente
    const decayFactor = Math.exp(-day / 30); // Decae con half-life de ~21 días
    const baseShock = priceImpact * decayFactor;
    
    // Añadir volatilidad adicional
    const volatilityShock = this.distributionGenerators.get('normal')!(0, 0.02 * volatilityMultiplier);
    
    return baseShock + volatilityShock;
  }

  private calculateTechnicalImpact(scenario: RiskScenario, chain: number): number {
    const { rpcFailureRate, bridgeFailureRate, gasSpike, networkCongestion } = scenario.technicalFailure;
    
    let impact = 0;
    
    // Fallas de RPC
    if (Math.random() < rpcFailureRate) {
      impact += 0.05; // 5% de pérdida por falla de RPC
    }
    
    // Fallas de bridge
    if (Math.random() < bridgeFailureRate) {
      impact += 0.10; // 10% de pérdida por falla de bridge
    }
    
    // Spike de gas
    if (gasSpike > 1) {
      impact += Math.min(0.03, (gasSpike - 1) * 0.01); // Max 3% por gas alto
    }
    
    // Congestión de red
    impact += networkCongestion * 0.02; // Max 2% por congestión total
    
    return Math.min(impact, 0.2); // Cap at 20% daily impact
  }

  private getAssetPrice(asset: string): number {
    // Precios simulados (en producción vendría de APIs)
    const prices: Record<string, number> = {
      'USDC': 1.0,
      'USDT': 0.999,
      'DAI': 1.001,
      'ETH': 2500,
      'BTC': 45000,
      'BNB': 300,
      'MATIC': 0.85
    };
    
    return prices[asset] || 1;
  }

  private calculateAggregateRisk(
    scenarioResults: ScenarioResult[],
    baselinePortfolio: Portfolio
  ): StressTestResult['aggregateRisk'] {
    const survivedScenarios = scenarioResults.filter(r => r.portfolioImpact.survivedScenario);
    const worstCaseResult = scenarioResults.reduce((worst, current) => 
      current.portfolioImpact.finalValue < worst.portfolioImpact.finalValue ? current : worst
    );

    const expectedLoss = scenarioResults.reduce((sum, result) => {
      const loss = (baselinePortfolio.totalValue - result.portfolioImpact.finalValue) / baselinePortfolio.totalValue;
      return sum + loss * result.scenario.probability;
    }, 0);

    const averageRecoveryTime = scenarioResults.reduce((sum, result) => 
      sum + result.portfolioImpact.recoveryDays, 0) / scenarioResults.length;

    return {
      worstCase: (baselinePortfolio.totalValue - worstCaseResult.portfolioImpact.finalValue) / baselinePortfolio.totalValue,
      expectedLoss,
      recoveryTime: averageRecoveryTime,
      survivability: survivedScenarios.length / scenarioResults.length
    };
  }

  private generateStressTestRecommendations(
    scenarioResults: ScenarioResult[],
    aggregateRisk: StressTestResult['aggregateRisk']
  ): string[] {
    const recommendations: string[] = [];

    if (aggregateRisk.worstCase > 0.5) {
      recommendations.push("Considerar diversificación adicional para reducir el riesgo de pérdidas extremas");
    }

    if (aggregateRisk.survivability < 0.8) {
      recommendations.push("Implementar protección adicional contra escenarios de estrés");
    }

    if (aggregateRisk.recoveryTime > 90) {
      recommendations.push("Evaluar estrategias de recuperación más rápida post-crisis");
    }

    // Analizar assets más vulnerables
    const assetRisks = new Map<string, number>();
    scenarioResults.forEach(result => {
      Object.entries(result.assetImpacts).forEach(([asset, impact]) => {
        assetRisks.set(asset, (assetRisks.get(asset) || 0) + Math.abs(impact));
      });
    });

    const worstAsset = Array.from(assetRisks.entries())
      .sort(([,a], [,b]) => b - a)[0];
    
    if (worstAsset && worstAsset[1] > 0.2) {
      recommendations.push(`Considerar reducir exposición a ${worstAsset[0]} debido a alta vulnerabilidad en stress tests`);
    }

    return recommendations;
  }

  generateScenarios(count: number): RiskScenario[] {
    const scenarios: RiskScenario[] = [];
    
    // Escenarios predefinidos
    const baseScenarios = [
      {
        name: 'Market Crash',
        description: 'Caída severa del mercado crypto (50%+ en major assets)',
        probability: 0.05,
        marketShock: {
          volatilityMultiplier: 3,
          correlationChange: 0.3,
          liquidityDrain: 0.6,
          priceImpact: -0.15 // -15% diario inicial
        },
        technicalFailure: {
          rpcFailureRate: 0.1,
          bridgeFailureRate: 0.05,
          gasSpike: 2,
          networkCongestion: 0.3
        },
        duration: 14
      },
      {
        name: 'DeFi Exploit',
        description: 'Exploit mayor en protocolo DeFi causando pánico',
        probability: 0.15,
        marketShock: {
          volatilityMultiplier: 2,
          correlationChange: 0.2,
          liquidityDrain: 0.4,
          priceImpact: -0.08
        },
        technicalFailure: {
          rpcFailureRate: 0.2,
          bridgeFailureRate: 0.15,
          gasSpike: 3,
          networkCongestion: 0.5
        },
        duration: 7
      },
      {
        name: 'Regulatory Crackdown',
        description: 'Regulación adversa en mercados principales',
        probability: 0.2,
        marketShock: {
          volatilityMultiplier: 1.5,
          correlationChange: 0.1,
          liquidityDrain: 0.3,
          priceImpact: -0.05
        },
        technicalFailure: {
          rpcFailureRate: 0.05,
          bridgeFailureRate: 0.1,
          gasSpike: 1.5,
          networkCongestion: 0.2
        },
        duration: 30
      },
      {
        name: 'Network Congestion',
        description: 'Congestión severa en redes principales',
        probability: 0.3,
        marketShock: {
          volatilityMultiplier: 1.2,
          correlationChange: 0.05,
          liquidityDrain: 0.2,
          priceImpact: -0.02
        },
        technicalFailure: {
          rpcFailureRate: 0.3,
          bridgeFailureRate: 0.2,
          gasSpike: 5,
          networkCongestion: 0.8
        },
        duration: 3
      },
      {
        name: 'Black Swan Event',
        description: 'Evento impredecible de alto impacto',
        probability: 0.01,
        marketShock: {
          volatilityMultiplier: 5,
          correlationChange: 0.5,
          liquidityDrain: 0.8,
          priceImpact: -0.25
        },
        technicalFailure: {
          rpcFailureRate: 0.4,
          bridgeFailureRate: 0.3,
          gasSpike: 10,
          networkCongestion: 0.9
        },
        duration: 21
      }
    ];

    // Añadir escenarios base
    scenarios.push(...baseScenarios);

    // Generar escenarios adicionales con variaciones aleatorias
    const remaining = count - baseScenarios.length;
    for (let i = 0; i < remaining; i++) {
      const baseScenario = baseScenarios[Math.floor(Math.random() * baseScenarios.length)];
      const variation = this.createScenarioVariation(baseScenario, i);
      scenarios.push(variation);
    }

    return scenarios.slice(0, count);
  }

  private createScenarioVariation(base: RiskScenario, index: number): RiskScenario {
    const variation = JSON.parse(JSON.stringify(base)); // Deep copy
    
    variation.name = `${base.name} Variant ${index + 1}`;
    
    // Añadir variaciones aleatorias (±20%)
    const randomFactor = () => 0.8 + Math.random() * 0.4; // 0.8 to 1.2
    
    variation.marketShock.volatilityMultiplier *= randomFactor();
    variation.marketShock.priceImpact *= randomFactor();
    variation.marketShock.liquidityDrain *= randomFactor();
    
    variation.technicalFailure.rpcFailureRate *= randomFactor();
    variation.technicalFailure.bridgeFailureRate *= randomFactor();
    variation.technicalFailure.gasSpike *= randomFactor();
    
    variation.duration = Math.max(1, Math.floor(variation.duration * randomFactor()));
    
    return variation;
  }
}

// ============================================================================
// GRAFANA DASHBOARD GENERATOR
// ============================================================================

export class GrafanaDashboardGenerator {
  private dashboards: Map<string, GrafanaDashboard>;

  constructor() {
    this.dashboards = new Map();
    this.initializeDefaultDashboards();
  }

  private initializeDefaultDashboards(): void {
    // Dashboard principal de ArbitrageX Supreme
    this.dashboards.set('arbitragex-main', {
      id: 'arbitragex-main',
      title: 'ArbitrageX Supreme - Overview',
      tags: ['arbitrage', 'defi', 'trading'],
      refresh: '30s',
      timeFrom: 'now-1h',
      timeTo: 'now',
      panels: [
        // Panel de ganancias totales
        {
          id: 1,
          title: 'Total Profit (USD)',
          type: 'stat',
          gridPos: { x: 0, y: 0, w: 6, h: 4 },
          targets: [
            {
              expr: 'sum(arbitrage_profit_usd)',
              legendFormat: 'Total Profit',
              refId: 'A'
            }
          ],
          options: {
            reduceOptions: {
              values: false,
              calcs: ['lastNotNull'],
              fields: ''
            },
            orientation: 'auto',
            textMode: 'auto',
            colorMode: 'value',
            graphMode: 'area',
            justifyMode: 'auto'
          }
        },

        // Panel de oportunidades detectadas
        {
          id: 2,
          title: 'Arbitrage Opportunities',
          type: 'stat',
          gridPos: { x: 6, y: 0, w: 6, h: 4 },
          targets: [
            {
              expr: 'rate(arbitrage_opportunities_total[5m])',
              legendFormat: 'Opportunities/min',
              refId: 'A'
            }
          ],
          options: {
            reduceOptions: {
              values: false,
              calcs: ['lastNotNull'],
              fields: ''
            },
            unit: 'ops'
          }
        },

        // Panel de success rate
        {
          id: 3,
          title: 'Success Rate',
          type: 'gauge',
          gridPos: { x: 12, y: 0, w: 6, h: 4 },
          targets: [
            {
              expr: 'rate(arbitrage_trades_executed_total{status="success"}[5m]) / rate(arbitrage_trades_executed_total[5m]) * 100',
              legendFormat: 'Success Rate %',
              refId: 'A'
            }
          ],
          options: {
            min: 0,
            max: 100,
            unit: 'percent'
          }
        },

        // Panel de gas costs
        {
          id: 4,
          title: 'Gas Costs (USD)',
          type: 'stat',
          gridPos: { x: 18, y: 0, w: 6, h: 4 },
          targets: [
            {
              expr: 'sum(arbitrage_gas_cost_usd)',
              legendFormat: 'Total Gas Costs',
              refId: 'A'
            }
          ],
          options: {
            unit: 'currencyUSD'
          }
        },

        // Time series de profit over time
        {
          id: 5,
          title: 'Profit Over Time',
          type: 'timeseries',
          gridPos: { x: 0, y: 4, w: 12, h: 8 },
          targets: [
            {
              expr: 'arbitrage_profit_usd',
              legendFormat: '{{strategy}} - {{timeframe}}',
              refId: 'A'
            }
          ],
          options: {
            legend: {
              displayMode: 'list',
              placement: 'bottom'
            },
            tooltip: {
              mode: 'single'
            }
          }
        },

        // Heatmap de performance por chain
        {
          id: 6,
          title: 'Performance by Chain',
          type: 'heatmap',
          gridPos: { x: 12, y: 4, w: 12, h: 8 },
          targets: [
            {
              expr: 'sum by (chain) (rate(arbitrage_profit_usd[1h]))',
              legendFormat: '{{chain}}',
              refId: 'A'
            }
          ],
          options: {}
        },

        // Table de top DEXs
        {
          id: 7,
          title: 'Top DEXs by Volume',
          type: 'table',
          gridPos: { x: 0, y: 12, w: 8, h: 6 },
          targets: [
            {
              expr: 'sum by (protocol, chain) (defi_volume_24h_usd)',
              legendFormat: '',
              refId: 'A',
              interval: '1m'
            }
          ],
          options: {
            showHeader: true
          }
        },

        // Pie chart de distribution por estrategia
        {
          id: 8,
          title: 'Profit Distribution by Strategy',
          type: 'piechart',
          gridPos: { x: 8, y: 12, w: 8, h: 6 },
          targets: [
            {
              expr: 'sum by (strategy) (arbitrage_profit_usd)',
              legendFormat: '{{strategy}}',
              refId: 'A'
            }
          ],
          options: {
            reduceOptions: {
              values: false,
              calcs: ['lastNotNull'],
              fields: ''
            },
            pieType: 'pie',
            displayLabels: ['name', 'value', 'percent']
          }
        },

        // Logs panel
        {
          id: 9,
          title: 'System Status',
          type: 'logs',
          gridPos: { x: 16, y: 12, w: 8, h: 6 },
          targets: [
            {
              expr: '{job="arbitragex-supreme"} |= "ERROR" or "WARN"',
              legendFormat: '',
              refId: 'A'
            }
          ],
          options: {
            showTime: true,
            showLabels: false,
            showCommonLabels: false,
            wrapLogMessage: false,
            prettifyLogMessage: false,
            enableLogDetails: true,
            dedupStrategy: 'none',
            sortOrder: 'Descending'
          }
        }
      ]
    });

    // Dashboard de performance detallado
    this.dashboards.set('arbitragex-performance', {
      id: 'arbitragex-performance',
      title: 'ArbitrageX Supreme - Performance Analysis',
      tags: ['arbitrage', 'performance', 'analytics'],
      refresh: '1m',
      timeFrom: 'now-24h',
      timeTo: 'now',
      panels: [
        // Sharpe Ratio
        {
          id: 10,
          title: 'Sharpe Ratio',
          type: 'stat',
          gridPos: { x: 0, y: 0, w: 4, h: 4 },
          targets: [
            {
              expr: 'simulation_profit_accuracy{strategy="cross-dex"}',
              legendFormat: 'Sharpe Ratio',
              refId: 'A'
            }
          ],
          options: {}
        },

        // Max Drawdown
        {
          id: 11,
          title: 'Max Drawdown',
          type: 'stat',
          gridPos: { x: 4, y: 0, w: 4, h: 4 },
          targets: [
            {
              expr: 'max_over_time(arbitrage_profit_usd[24h]) - min_over_time(arbitrage_profit_usd[24h])',
              legendFormat: 'Max Drawdown',
              refId: 'A'
            }
          ],
          options: {
            unit: 'currencyUSD'
          }
        },

        // Win Rate
        {
          id: 12,
          title: 'Win Rate (24h)',
          type: 'gauge',
          gridPos: { x: 8, y: 0, w: 4, h: 4 },
          targets: [
            {
              expr: 'sum(rate(arbitrage_trades_executed_total{status="success"}[24h])) / sum(rate(arbitrage_trades_executed_total[24h])) * 100',
              legendFormat: 'Win Rate',
              refId: 'A'
            }
          ],
          options: {
            min: 0,
            max: 100,
            unit: 'percent'
          }
        },

        // RPC Latency por chain
        {
          id: 13,
          title: 'RPC Latency by Chain',
          type: 'timeseries',
          gridPos: { x: 0, y: 4, w: 12, h: 6 },
          targets: [
            {
              expr: 'histogram_quantile(0.95, rate(rpc_latency_seconds_bucket[5m]))',
              legendFormat: 'p95 - {{chain}}',
              refId: 'A'
            },
            {
              expr: 'histogram_quantile(0.50, rate(rpc_latency_seconds_bucket[5m]))',
              legendFormat: 'p50 - {{chain}}',
              refId: 'B'
            }
          ],
          options: {
            unit: 's'
          }
        },

        // Bridge success rate
        {
          id: 14,
          title: 'Bridge Success Rate',
          type: 'timeseries',
          gridPos: { x: 12, y: 4, w: 12, h: 6 },
          targets: [
            {
              expr: 'rate(bridge_transfers_total{status="success"}[5m]) / rate(bridge_transfers_total[5m])',
              legendFormat: '{{bridge}} - {{from_chain}} to {{to_chain}}',
              refId: 'A'
            }
          ],
          options: {
            unit: 'percentunit'
          }
        }
      ]
    });

    // Dashboard de risk management
    this.dashboards.set('arbitragex-risk', {
      id: 'arbitragex-risk',
      title: 'ArbitrageX Supreme - Risk Management',
      tags: ['arbitrage', 'risk', 'monitoring'],
      refresh: '15s',
      timeFrom: 'now-6h',
      timeTo: 'now',
      panels: [
        // VaR 95%
        {
          id: 15,
          title: 'Value at Risk (95%)',
          type: 'stat',
          gridPos: { x: 0, y: 0, w: 6, h: 4 },
          targets: [
            {
              expr: 'quantile(0.05, arbitrage_profit_usd)',
              legendFormat: 'VaR 95%',
              refId: 'A'
            }
          ],
          options: {
            unit: 'currencyUSD',
            colorMode: 'background',
            thresholds: {
              steps: [
                { color: 'green', value: null },
                { color: 'yellow', value: -1000 },
                { color: 'red', value: -5000 }
              ]
            }
          }
        },

        // Portfolio exposure
        {
          id: 16,
          title: 'Portfolio Exposure by Chain',
          type: 'piechart',
          gridPos: { x: 6, y: 0, w: 6, h: 4 },
          targets: [
            {
              expr: 'sum by (chain) (arbitrage_profit_usd)',
              legendFormat: 'Chain {{chain}}',
              refId: 'A'
            }
          ],
          options: {}
        },

        // Flash loan utilization
        {
          id: 17,
          title: 'Flash Loan Utilization',
          type: 'timeseries',
          gridPos: { x: 0, y: 4, w: 12, h: 6 },
          targets: [
            {
              expr: 'rate(flash_loans_total[5m])',
              legendFormat: '{{protocol}} - {{chain}}',
              refId: 'A'
            }
          ],
          options: {
            unit: 'ops'
          }
        },

        // Error rate monitoring
        {
          id: 18,
          title: 'Error Rates',
          type: 'timeseries',
          gridPos: { x: 12, y: 4, w: 12, h: 6 },
          targets: [
            {
              expr: 'rate(rpc_requests_total{status="error"}[5m])',
              legendFormat: 'RPC Errors - {{chain}}',
              refId: 'A'
            },
            {
              expr: 'rate(arbitrage_trades_executed_total{status="failed"}[5m])',
              legendFormat: 'Trade Failures - {{type}}',
              refId: 'B'
            }
          ],
          options: {
            unit: 'ops'
          }
        }
      ]
    });
  }

  getDashboard(id: string): GrafanaDashboard | undefined {
    return this.dashboards.get(id);
  }

  getAllDashboards(): GrafanaDashboard[] {
    return Array.from(this.dashboards.values());
  }

  exportDashboard(id: string): string {
    const dashboard = this.dashboards.get(id);
    if (!dashboard) {
      throw new Error(`Dashboard ${id} not found`);
    }

    return JSON.stringify(dashboard, null, 2);
  }

  createCustomDashboard(
    id: string,
    title: string,
    panels: GrafanaPanel[],
    options?: Partial<GrafanaDashboard>
  ): void {
    const dashboard: GrafanaDashboard = {
      id,
      title,
      tags: options?.tags || ['arbitrage', 'custom'],
      refresh: options?.refresh || '30s',
      timeFrom: options?.timeFrom || 'now-1h',
      timeTo: options?.timeTo || 'now',
      panels
    };

    this.dashboards.set(id, dashboard);
  }

  generatePrometheusAlerts(): string {
    const alerts = [
      {
        alert: 'ArbitrageHighErrorRate',
        expr: 'rate(arbitrage_trades_executed_total{status="failed"}[5m]) > 0.1',
        for: '2m',
        labels: { severity: 'warning' },
        annotations: {
          summary: 'High arbitrage trade failure rate detected',
          description: 'Arbitrage trade failure rate is above 10% for more than 2 minutes'
        }
      },
      {
        alert: 'RPCEndpointDown',
        expr: 'rate(rpc_requests_total{status="error"}[5m]) > 0.5',
        for: '1m',
        labels: { severity: 'critical' },
        annotations: {
          summary: 'RPC endpoint experiencing high error rate',
          description: 'RPC endpoint {{$labels.endpoint}} on chain {{$labels.chain}} has error rate above 50%'
        }
      },
      {
        alert: 'LowProfit',
        expr: 'rate(arbitrage_profit_usd[1h]) < 10',
        for: '15m',
        labels: { severity: 'warning' },
        annotations: {
          summary: 'Low arbitrage profitability',
          description: 'Hourly profit rate is below $10 for more than 15 minutes'
        }
      },
      {
        alert: 'HighGasCosts',
        expr: 'arbitrage_gas_cost_usd > 100',
        for: '5m',
        labels: { severity: 'warning' },
        annotations: {
          summary: 'High gas costs detected',
          description: 'Gas costs are above $100, consider adjusting gas price strategy'
        }
      }
    ];

    return alerts.map(alert => `
groups:
  - name: arbitragex.rules
    rules:
      - alert: ${alert.alert}
        expr: ${alert.expr}
        for: ${alert.for}
        labels:
${Object.entries(alert.labels).map(([k, v]) => `          ${k}: ${v}`).join('\n')}
        annotations:
${Object.entries(alert.annotations).map(([k, v]) => `          ${k}: "${v}"`).join('\n')}
    `).join('\n');
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export {
  MonteCarloEngine,
  GrafanaDashboardGenerator
};

export default {
  MonteCarloEngine,
  GrafanaDashboardGenerator
};
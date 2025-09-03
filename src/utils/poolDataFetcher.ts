/**
 * ArbitrageX Supreme - Pool Data Fetcher
 * 
 * Módulo especializado en obtención de datos específicos de pools de liquidez
 * Enfoque metodico en análisis profundo de pools para oportunidades de arbitraje
 * 
 * Funcionalidades:
 * - Análisis detallado de pools individuales
 * - Cálculo de métricas avanzadas (IL, APY, volatilidad)
 * - Monitoreo de cambios en liquidez en tiempo real
 * - Detección de oportunidades de yield farming
 * - Integración con múltiples protocolos AMM
 */

import { ethers, JsonRpcProvider, Contract } from 'ethers';
import { DexHelpers } from './dexHelpers';
import { dexDataFetcher } from './dexDataFetcher';
import type {
  Chain,
  DexInfo,
  TokenInfo,
  LiquidityPool,
  PoolMetrics,
  PoolAnalysis,
  YieldOpportunity,
  ImpermanentLossData,
  PoolHistoricalData,
  LiquidityPosition,
  FeesAnalysis,
  VolatilityMetrics
} from '../apps/web/types/defi';

// ============================================================================
// CONFIGURACIONES ESPECÍFICAS PARA POOLS
// ============================================================================

// Configuraciones por tipo de pool
const POOL_CONFIGS = {
  'uniswap-v2': {
    minLiquidityUSD: 1000,
    maxPriceImpact: 0.05, // 5%
    minVolume24h: 500,
    feeRate: 0.003
  },
  'uniswap-v3': {
    minLiquidityUSD: 5000,
    maxPriceImpact: 0.03, // 3%
    minVolume24h: 1000,
    feeRates: [0.0001, 0.0005, 0.003, 0.01] // 0.01%, 0.05%, 0.3%, 1%
  },
  'curve': {
    minLiquidityUSD: 10000,
    maxPriceImpact: 0.01, // 1%
    minVolume24h: 2000,
    amplificationParameter: 100
  },
  'balancer': {
    minLiquidityUSD: 5000,
    maxPriceImpact: 0.02, // 2%
    minVolume24h: 1000,
    weights: [0.2, 0.8] // Ejemplo de pesos
  }
};

// ABIs específicos para diferentes tipos de pools
const POOL_ABIS = {
  UNISWAP_V2_PAIR: [
    'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
    'function price0CumulativeLast() external view returns (uint256)',
    'function price1CumulativeLast() external view returns (uint256)',
    'function kLast() external view returns (uint256)',
    'function totalSupply() external view returns (uint256)',
    'function token0() external view returns (address)',
    'function token1() external view returns (address)',
    'function balanceOf(address owner) external view returns (uint256)'
  ],
  UNISWAP_V3_POOL: [
    'function liquidity() external view returns (uint128)',
    'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
    'function feeGrowthGlobal0X128() external view returns (uint256)',
    'function feeGrowthGlobal1X128() external view returns (uint256)',
    'function protocolFees() external view returns (uint128 token0, uint128 token1)',
    'function positions(bytes32 key) external view returns (uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)'
  ],
  CURVE_POOL: [
    'function get_virtual_price() external view returns (uint256)',
    'function A() external view returns (uint256)',
    'function A_precise() external view returns (uint256)',
    'function get_dy(int128 i, int128 j, uint256 dx) external view returns (uint256)',
    'function balances(uint256) external view returns (uint256)',
    'function coins(uint256) external view returns (address)'
  ],
  BALANCER_POOL: [
    'function getPoolId() external view returns (bytes32)',
    'function getNormalizedWeights() external view returns (uint256[] memory)',
    'function getSwapFeePercentage() external view returns (uint256)',
    'function totalSupply() external view returns (uint256)'
  ]
};

// ============================================================================
// CLASE PRINCIPAL - POOL DATA FETCHER
// ============================================================================

export class PoolDataFetcher {
  private cache: Map<string, { data: unknown; timestamp: number }> = new Map();
  private readonly cacheTimeout: number = 5000; // 5 segundos
  private priceFeeds: Map<string, number[]> = new Map(); // Para tracking histórico

  constructor() {
    // Limpiar cache periódicamente
    setInterval(() => this.cleanExpiredCache(), 30000); // cada 30s
  }

  // ============================================================================
  // ANÁLISIS COMPLETO DE POOLS
  // ============================================================================

  /**
   * Analiza un pool específico con métricas completas
   */
  async analyzePool(
    poolAddress: string,
    dex: DexInfo,
    timeframe: '1h' | '24h' | '7d' | '30d' = '24h'
  ): Promise<PoolAnalysis> {
    console.log(`🔍 Analyzing pool ${DexHelpers.truncateAddress(poolAddress)} on ${dex.name}`);

    try {
      // Obtener datos base del pool
      const poolData = await this.getPoolData(poolAddress, dex);
      
      // Calcular métricas avanzadas
      const [
        metrics,
        impermanentLoss,
        yieldOpportunity,
        feesAnalysis,
        volatilityMetrics,
        historicalData
      ] = await Promise.all([
        this.calculatePoolMetrics(poolData, dex),
        this.calculateImpermanentLoss(poolData, timeframe),
        this.analyzeYieldOpportunity(poolData, dex),
        this.analyzePoolFees(poolData, dex, timeframe),
        this.calculateVolatilityMetrics(poolData, timeframe),
        this.getPoolHistoricalData(poolAddress, dex.chain, timeframe)
      ]);

      const analysis: PoolAnalysis = {
        pool: poolData,
        metrics,
        impermanentLoss,
        yieldOpportunity,
        feesAnalysis,
        volatilityMetrics,
        historicalData,
        timestamp: Date.now(),
        confidence: this.calculateAnalysisConfidence(poolData, metrics),
        recommendations: this.generateRecommendations(metrics, impermanentLoss, yieldOpportunity)
      };

      console.log(`✅ Pool analysis completed for ${poolData.token0.symbol}/${poolData.token1.symbol}`);
      return analysis;

    } catch (error) {
      console.error(`❌ Error analyzing pool ${poolAddress}:`, error);
      throw new Error(`Pool analysis failed: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  /**
   * Obtiene datos base de un pool específico
   */
  async getPoolData(poolAddress: string, dex: DexInfo): Promise<LiquidityPool> {
    const cacheKey = `pool_data_${poolAddress}_${dex.name}`;
    const cached = this.getCached<LiquidityPool>(cacheKey);
    if (cached) return cached;

    try {
      let poolData: LiquidityPool;

      switch (dex.type) {
        case 'uniswap-v2':
        case 'sushiswap':
          poolData = await this.getUniswapV2PoolData(poolAddress, dex);
          break;
        case 'uniswap-v3':
          poolData = await this.getUniswapV3PoolData(poolAddress, dex);
          break;
        case 'curve':
          poolData = await this.getCurvePoolData(poolAddress, dex);
          break;
        case 'balancer':
          poolData = await this.getBalancerPoolData(poolAddress, dex);
          break;
        default:
          throw new Error(`Unsupported DEX type: ${dex.type}`);
      }

      this.setCached(cacheKey, poolData);
      return poolData;

    } catch (error) {
      console.error(`Error fetching pool data for ${poolAddress}:`, error);
      throw error;
    }
  }

  /**
   * Obtiene datos de pool Uniswap V2
   */
  private async getUniswapV2PoolData(
    poolAddress: string,
    dex: DexInfo
  ): Promise<LiquidityPool> {
    const provider = new ethers.JsonRpcProvider(this.getRpcUrl(dex.chain));
    const poolContract = new Contract(poolAddress, POOL_ABIS.UNISWAP_V2_PAIR, provider);

    const [
      reserves,
      token0Address,
      token1Address,
      totalSupply,
      price0Cumulative,
      price1Cumulative
    ] = await Promise.all([
      poolContract.getReserves(),
      poolContract.token0(),
      poolContract.token1(),
      poolContract.totalSupply(),
      poolContract.price0CumulativeLast(),
      poolContract.price1CumulativeLast()
    ]);

    // Obtener información de tokens
    const [token0Info, token1Info] = await Promise.all([
      dexDataFetcher.getTokenInfo(token0Address, dex.chain),
      dexDataFetcher.getTokenInfo(token1Address, dex.chain)
    ]);

    return {
      address: poolAddress,
      token0: token0Info,
      token1: token1Info,
      reserve0: reserves[0],
      reserve1: reserves[1],
      totalSupply,
      dex: dex.name,
      chain: dex.chain,
      fee: dex.fee,
      reserveUSD: 0, // Calcular basado en precios
      volume24h: 0, // Obtener de subgrafo
      txCount: 0,
      price0CumulativeLast: price0Cumulative,
      price1CumulativeLast: price1Cumulative,
      blockTimestampLast: reserves[2]
    };
  }

  /**
   * Obtiene datos de pool Uniswap V3
   */
  private async getUniswapV3PoolData(
    poolAddress: string,
    dex: DexInfo
  ): Promise<LiquidityPool> {
    const provider = new ethers.JsonRpcProvider(this.getRpcUrl(dex.chain));
    const poolContract = new Contract(poolAddress, POOL_ABIS.UNISWAP_V3_POOL, provider);

    const [
      liquidity,
      slot0,
      feeGrowthGlobal0,
      feeGrowthGlobal1
    ] = await Promise.all([
      poolContract.liquidity(),
      poolContract.slot0(),
      poolContract.feeGrowthGlobal0X128(),
      poolContract.feeGrowthGlobal1X128()
    ]);

    // Obtener información de tokens desde The Graph (más eficiente)
    const graphData = await this.getV3PoolFromGraph(poolAddress, dex.chain);

    return {
      address: poolAddress,
      token0: graphData.token0,
      token1: graphData.token1,
      liquidity,
      sqrtPriceX96: slot0[0],
      tick: slot0[1],
      dex: dex.name,
      chain: dex.chain,
      fee: graphData.fee,
      reserveUSD: graphData.reserveUSD,
      volume24h: graphData.volume24h,
      txCount: graphData.txCount,
      feeGrowthGlobal0X128: feeGrowthGlobal0,
      feeGrowthGlobal1X128: feeGrowthGlobal1
    };
  }

  /**
   * Obtiene datos de pool Curve
   */
  private async getCurvePoolData(
    poolAddress: string,
    dex: DexInfo
  ): Promise<LiquidityPool> {
    const provider = new ethers.JsonRpcProvider(this.getRpcUrl(dex.chain));
    const poolContract = new Contract(poolAddress, POOL_ABIS.CURVE_POOL, provider);

    const [
      virtualPrice,
      amplificationParam,
      balance0,
      balance1,
      token0Address,
      token1Address
    ] = await Promise.all([
      poolContract.get_virtual_price(),
      poolContract.A_precise(),
      poolContract.balances(0),
      poolContract.balances(1),
      poolContract.coins(0),
      poolContract.coins(1)
    ]);

    const [token0Info, token1Info] = await Promise.all([
      dexDataFetcher.getTokenInfo(token0Address, dex.chain),
      dexDataFetcher.getTokenInfo(token1Address, dex.chain)
    ]);

    return {
      address: poolAddress,
      token0: token0Info,
      token1: token1Info,
      reserve0: balance0,
      reserve1: balance1,
      dex: dex.name,
      chain: dex.chain,
      fee: 0.0004, // Curve típicamente 0.04%
      virtualPrice,
      amplificationParameter: amplificationParam,
      reserveUSD: 0, // Calcular
      volume24h: 0, // Obtener de API
      txCount: 0
    };
  }

  /**
   * Obtiene datos de pool Balancer
   */
  private async getBalancerPoolData(
    poolAddress: string,
    dex: DexInfo
  ): Promise<LiquidityPool> {
    // Implementación similar para Balancer
    // Por brevedad, retornamos un placeholder
    throw new Error('Balancer pool data fetching not implemented yet');
  }

  // ============================================================================
  // CÁLCULO DE MÉTRICAS AVANZADAS
  // ============================================================================

  /**
   * Calcula métricas avanzadas del pool
   */
  async calculatePoolMetrics(
    pool: LiquidityPool,
    dex: DexInfo
  ): Promise<PoolMetrics> {
    const currentPrice = this.calculatePoolPrice(pool);
    const liquidity = this.calculatePoolLiquidity(pool);
    const utilization = this.calculateLiquidityUtilization(pool);
    const efficiency = this.calculateCapitalEfficiency(pool);
    const depth = this.calculateMarketDepth(pool);

    return {
      currentPrice,
      priceChange24h: await this.calculate24hPriceChange(pool),
      liquidity,
      liquidityChange24h: await this.calculate24hLiquidityChange(pool),
      volume24h: pool.volume24h || 0,
      volumeChange24h: await this.calculate24hVolumeChange(pool),
      fees24h: this.calculateFees24h(pool),
      apy: await this.calculateAPY(pool, dex),
      utilization,
      efficiency,
      depth,
      priceImpact1k: this.calculatePriceImpact(pool, ethers.parseEther('1000')),
      priceImpact10k: this.calculatePriceImpact(pool, ethers.parseEther('10000')),
      priceImpact100k: this.calculatePriceImpact(pool, ethers.parseEther('100000'))
    };
  }

  /**
   * Calcula precio actual del pool
   */
  private calculatePoolPrice(pool: LiquidityPool): number {
    if (pool.sqrtPriceX96) {
      // Uniswap V3
      const sqrtPrice = Number(pool.sqrtPriceX96) / (2 ** 96);
      return sqrtPrice ** 2;
    } else if (pool.reserve0 && pool.reserve1) {
      // Uniswap V2 style
      const reserve0Normalized = Number(pool.reserve0) / (10 ** pool.token0.decimals);
      const reserve1Normalized = Number(pool.reserve1) / (10 ** pool.token1.decimals);
      return reserve1Normalized / reserve0Normalized;
    }
    return 0;
  }

  /**
   * Calcula liquidez total del pool en USD
   */
  private calculatePoolLiquidity(pool: LiquidityPool): number {
    if (pool.reserveUSD) {
      return pool.reserveUSD;
    }
    
    // Calcular basado en reservas si no está disponible
    // Esto requeriría precios de tokens externos
    return 0;
  }

  /**
   * Calcula utilización de liquidez
   */
  private calculateLiquidityUtilization(pool: LiquidityPool): number {
    if (!pool.volume24h || !pool.reserveUSD) return 0;
    return pool.volume24h / pool.reserveUSD;
  }

  /**
   * Calcula eficiencia de capital
   */
  private calculateCapitalEfficiency(pool: LiquidityPool): number {
    if (pool.liquidity && pool.sqrtPriceX96) {
      // Para V3: capital efficiency basado en liquidez concentrada
      return 1; // Placeholder - implementar cálculo real
    }
    
    // Para V2: eficiencia basada en utilización
    return this.calculateLiquidityUtilization(pool);
  }

  /**
   * Calcula profundidad de mercado
   */
  private calculateMarketDepth(pool: LiquidityPool): number {
    if (!pool.reserve0 || !pool.reserve1) return 0;
    
    const geometricMean = Math.sqrt(
      Number(pool.reserve0) * Number(pool.reserve1)
    );
    
    return geometricMean / (10 ** 18); // Normalizado
  }

  /**
   * Calcula impacto de precio para una cantidad específica
   */
  private calculatePriceImpact(pool: LiquidityPool, amount: bigint): number {
    if (!pool.reserve0 || !pool.reserve1) return 1;

    return DexHelpers.calculatePriceImpact(
      amount,
      pool.reserve0,
      pool.reserve1,
      pool.fee
    );
  }

  // ============================================================================
  // ANÁLISIS DE PÉRDIDA IMPERMANENTE
  // ============================================================================

  /**
   * Calcula pérdida impermanente histórica
   */
  async calculateImpermanentLoss(
    pool: LiquidityPool,
    timeframe: string
  ): Promise<ImpermanentLossData> {
    try {
      const historicalPrice = await this.getHistoricalPoolPrice(pool, timeframe);
      const currentPrice = this.calculatePoolPrice(pool);
      
      if (!historicalPrice || historicalPrice === 0) {
        return {
          currentIL: 0,
          maxIL: 0,
          averageIL: 0,
          ilHistory: [],
          timeframe
        };
      }

      const priceRatio = currentPrice / historicalPrice;
      const currentIL = this.calculateILForPriceRatio(priceRatio);

      // Obtener historial completo para máximo y promedio
      const priceHistory = await this.getPoolPriceHistory(pool, timeframe);
      const ilHistory = priceHistory.map(({ price, timestamp }) => ({
        il: this.calculateILForPriceRatio(price / historicalPrice),
        timestamp
      }));

      const maxIL = Math.max(...ilHistory.map(h => h.il));
      const averageIL = ilHistory.reduce((sum, h) => sum + h.il, 0) / ilHistory.length;

      return {
        currentIL,
        maxIL,
        averageIL,
        ilHistory,
        timeframe
      };

    } catch (error) {
      console.error('Error calculating impermanent loss:', error);
      return {
        currentIL: 0,
        maxIL: 0,
        averageIL: 0,
        ilHistory: [],
        timeframe
      };
    }
  }

  /**
   * Calcula IL para un ratio de precio específico
   */
  private calculateILForPriceRatio(priceRatio: number): number {
    if (priceRatio <= 0) return 0;
    
    // Fórmula de pérdida impermanente: 2√(r)/(1+r) - 1
    // donde r es el ratio de precio
    const sqrtRatio = Math.sqrt(priceRatio);
    const il = (2 * sqrtRatio) / (1 + priceRatio) - 1;
    
    return Math.abs(il); // Retornar valor absoluto
  }

  // ============================================================================
  // ANÁLISIS DE OPORTUNIDADES DE YIELD
  // ============================================================================

  /**
   * Analiza oportunidades de yield farming
   */
  async analyzeYieldOpportunity(
    pool: LiquidityPool,
    dex: DexInfo
  ): Promise<YieldOpportunity> {
    const baseAPY = await this.calculateAPY(pool, dex);
    const incentives = await this.getPoolIncentives(pool, dex);
    const risks = this.assessPoolRisks(pool);
    
    const totalAPY = baseAPY + (incentives?.additionalAPY || 0);
    const riskAdjustedAPY = totalAPY * (1 - risks.totalRiskScore);

    return {
      baseAPY,
      incentiveAPY: incentives?.additionalAPY || 0,
      totalAPY,
      riskAdjustedAPY,
      impermanentLossRisk: risks.impermanentLossRisk,
      liquidityRisk: risks.liquidityRisk,
      smartContractRisk: risks.smartContractRisk,
      totalRiskScore: risks.totalRiskScore,
      recommendation: this.generateYieldRecommendation(totalAPY, risks.totalRiskScore),
      incentives: incentives?.details || []
    };
  }

  /**
   * Calcula APY base del pool
   */
  private async calculateAPY(pool: LiquidityPool, dex: DexInfo): Promise<number> {
    if (!pool.volume24h || !pool.reserveUSD) return 0;

    // APY = (Volume24h * Fee) / TVL * 365
    const dailyFees = pool.volume24h * pool.fee;
    const dailyReturn = dailyFees / pool.reserveUSD;
    const apy = dailyReturn * 365;

    return apy * 100; // Convertir a porcentaje
  }

  /**
   * Obtiene incentivos adicionales del pool
   */
  private async getPoolIncentives(
    pool: LiquidityPool,
    dex: DexInfo
  ): Promise<{ additionalAPY: number; details: any[] } | null> {
    // Implementar integración con programas de incentivos
    // Sushiswap, Curve, Balancer, etc.
    return null;
  }

  /**
   * Evalúa riesgos del pool
   */
  private assessPoolRisks(pool: LiquidityPool): {
    impermanentLossRisk: number;
    liquidityRisk: number;
    smartContractRisk: number;
    totalRiskScore: number;
  } {
    // Riesgo de pérdida impermanente basado en volatilidad
    const ilRisk = this.calculateILRisk(pool);
    
    // Riesgo de liquidez basado en profundidad
    const liquidityRisk = this.calculateLiquidityRisk(pool);
    
    // Riesgo de smart contract basado en protocolo
    const scRisk = this.calculateSmartContractRisk(pool);
    
    const totalRiskScore = (ilRisk + liquidityRisk + scRisk) / 3;

    return {
      impermanentLossRisk: ilRisk,
      liquidityRisk,
      smartContractRisk: scRisk,
      totalRiskScore
    };
  }

  private calculateILRisk(pool: LiquidityPool): number {
    // Basado en correlación de tokens y volatilidad
    // Tokens más correlacionados = menor riesgo IL
    // Por ahora, placeholder basado en tipo de tokens
    return 0.3; // 30% de riesgo base
  }

  private calculateLiquidityRisk(pool: LiquidityPool): number {
    if (!pool.reserveUSD) return 0.8; // Alto riesgo si no hay datos
    
    if (pool.reserveUSD > 10000000) return 0.1; // Bajo riesgo
    if (pool.reserveUSD > 1000000) return 0.3;  // Riesgo medio
    return 0.7; // Alto riesgo para pools pequeños
  }

  private calculateSmartContractRisk(pool: LiquidityPool): number {
    // Riesgo basado en protocolo
    const protocolRisks: Record<string, number> = {
      'uniswap': 0.1,
      'sushiswap': 0.2,
      'curve': 0.15,
      'balancer': 0.25,
      'pancakeswap': 0.3
    };

    return protocolRisks[pool.dex.toLowerCase()] || 0.5;
  }

  // ============================================================================
  // ANÁLISIS DE FEES Y VOLATILIDAD
  // ============================================================================

  /**
   * Analiza fees generados por el pool
   */
  async analyzePoolFees(
    pool: LiquidityPool,
    dex: DexInfo,
    timeframe: string
  ): Promise<FeesAnalysis> {
    const fees24h = this.calculateFees24h(pool);
    const feeHistory = await this.getFeesHistory(pool, timeframe);
    
    return {
      fees24h,
      feesHistory: feeHistory,
      averageFees: feeHistory.reduce((sum, f) => sum + f.amount, 0) / feeHistory.length,
      feeGrowthRate: this.calculateFeeGrowthRate(feeHistory),
      feeEfficiency: fees24h / (pool.reserveUSD || 1)
    };
  }

  private calculateFees24h(pool: LiquidityPool): number {
    if (!pool.volume24h) return 0;
    return pool.volume24h * pool.fee;
  }

  /**
   * Calcula métricas de volatilidad
   */
  async calculateVolatilityMetrics(
    pool: LiquidityPool,
    timeframe: string
  ): Promise<VolatilityMetrics> {
    const priceHistory = await this.getPoolPriceHistory(pool, timeframe);
    
    if (priceHistory.length < 2) {
      return {
        volatility: 0,
        sharpeRatio: 0,
        maxDrawdown: 0,
        beta: 0
      };
    }

    const returns = this.calculateReturns(priceHistory);
    const volatility = this.calculateVolatility(returns);
    const sharpeRatio = this.calculateSharpeRatio(returns, volatility);
    const maxDrawdown = this.calculateMaxDrawdown(priceHistory);
    const beta = await this.calculateBeta(priceHistory, pool);

    return {
      volatility,
      sharpeRatio,
      maxDrawdown,
      beta
    };
  }

  private calculateReturns(priceHistory: { price: number; timestamp: number }[]): number[] {
    const returns: number[] = [];
    
    for (let i = 1; i < priceHistory.length; i++) {
      const currentPrice = priceHistory[i].price;
      const previousPrice = priceHistory[i - 1].price;
      
      if (previousPrice > 0) {
        returns.push((currentPrice - previousPrice) / previousPrice);
      }
    }
    
    return returns;
  }

  private calculateVolatility(returns: number[]): number {
    if (returns.length < 2) return 0;
    
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
    
    return Math.sqrt(variance) * Math.sqrt(365); // Anualized
  }

  private calculateSharpeRatio(returns: number[], volatility: number): number {
    if (volatility === 0) return 0;
    
    const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const annualizedReturn = meanReturn * 365;
    const riskFreeRate = 0.02; // 2% risk-free rate
    
    return (annualizedReturn - riskFreeRate) / volatility;
  }

  private calculateMaxDrawdown(priceHistory: { price: number; timestamp: number }[]): number {
    let maxDrawdown = 0;
    let peak = priceHistory[0].price;
    
    for (const point of priceHistory) {
      if (point.price > peak) {
        peak = point.price;
      }
      
      const drawdown = (peak - point.price) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }
    
    return maxDrawdown;
  }

  private async calculateBeta(
    priceHistory: { price: number; timestamp: number }[],
    pool: LiquidityPool
  ): Promise<number> {
    // Placeholder - requiere datos del mercado base (ETH/BTC)
    return 1;
  }

  // ============================================================================
  // UTILIDADES Y HELPERS
  // ============================================================================

  private getCached<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    const isExpired = Date.now() - entry.timestamp > this.cacheTimeout;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }

  private setCached<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  private cleanExpiredCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.cacheTimeout) {
        this.cache.delete(key);
      }
    }
  }

  private getRpcUrl(chain: string): string {
    const rpcMap: Record<string, string> = {
      ethereum: 'https://eth-mainnet.alchemyapi.io/v2/demo',
      polygon: 'https://polygon-rpc.com',
      arbitrum: 'https://arb1.arbitrum.io/rpc',
      optimism: 'https://mainnet.optimism.io',
      avalanche: 'https://api.avax.network/ext/bc/C/rpc'
    };

    return rpcMap[chain] || rpcMap.ethereum;
  }

  // Placeholder methods - implementar según necesidades
  private async calculate24hPriceChange(pool: LiquidityPool): Promise<number> { return 0; }
  private async calculate24hLiquidityChange(pool: LiquidityPool): Promise<number> { return 0; }
  private async calculate24hVolumeChange(pool: LiquidityPool): Promise<number> { return 0; }
  private async getHistoricalPoolPrice(pool: LiquidityPool, timeframe: string): Promise<number> { return 0; }
  private async getPoolPriceHistory(pool: LiquidityPool, timeframe: string): Promise<{ price: number; timestamp: number }[]> { return []; }
  private async getPoolHistoricalData(address: string, chain: string, timeframe: string): Promise<PoolHistoricalData> { 
    return { priceHistory: [], volumeHistory: [], liquidityHistory: [] }; 
  }
  private async getFeesHistory(pool: LiquidityPool, timeframe: string): Promise<{ amount: number; timestamp: number }[]> { return []; }
  private calculateFeeGrowthRate(feeHistory: { amount: number; timestamp: number }[]): number { return 0; }
  private async getV3PoolFromGraph(address: string, chain: string): Promise<any> { return {}; }
  private calculateAnalysisConfidence(pool: LiquidityPool, metrics: PoolMetrics): number { return 0.8; }
  private generateRecommendations(metrics: PoolMetrics, il: ImpermanentLossData, yield_: YieldOpportunity): string[] { return []; }
  private generateYieldRecommendation(apy: number, risk: number): string { return 'HOLD'; }
}

// ============================================================================
// INSTANCIA SINGLETON EXPORTADA
// ============================================================================

export const poolDataFetcher = new PoolDataFetcher();
export default poolDataFetcher;
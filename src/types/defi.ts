/**
 * ArbitrageX Supreme - Definiciones de Tipos TypeScript
 * 
 * Tipos centralizados para todo el sistema de arbitraje DeFi
 * Incluye tipos para DEXs, lending, pools, oportunidades y métricas
 */

// ============================================================================
// TIPOS BÁSICOS Y CHAINS
// ============================================================================

export type Chain = 
  | 'ethereum'
  | 'bsc' 
  | 'polygon'
  | 'arbitrum'
  | 'optimism'
  | 'avalanche'
  | 'base'
  | 'fantom'
  | 'gnosis'
  | 'celo'
  | 'moonbeam'
  | 'cronos'
  | 'aurora'
  | 'harmony'
  | 'kava'
  | 'metis'
  | 'evmos'
  | 'oasis'
  | 'milkomeda'
  | 'telos';

export type ArbitrageStrategy = 
  | 'intra-dex'
  | 'inter-dex'
  | 'cross-chain'
  | 'flash-loan'
  | 'liquidation'
  | 'funding-rate'
  | 'statistical'
  | 'governance'
  | 'synthetic'
  | 'options'
  | 'perpetual'
  | 'mev';

// ============================================================================
// INFORMACIÓN DE TOKENS Y DEXs
// ============================================================================

export interface TokenInfo {
  address: string;
  symbol: string;
  name?: string;
  decimals: number;
  chain: Chain;
  logoUri?: string;
  priceUSD?: number;
}

export interface DexInfo {
  id: string;
  name: string;
  type: 'AMM-V2' | 'AMM-V3' | 'StableSwap' | 'Orderbook' | 'CFMM';
  chain: Chain;
  router: string;
  factory: string;
  fee: number;
  feeTiers?: number[];
  supportsFlashLoans: boolean;
  concentratedLiquidity: boolean;
  tvlUSD?: number;
  subgraphUrl?: string;
}

export interface LendingInfo {
  id: string;
  name: string;
  protocol: 'Aave' | 'Compound' | 'Maker' | 'Euler' | 'Morpho' | 'Venus' | 'Radiant' | 'Benqi' | 'Geist' | 'Scream';
  chain: Chain;
  lendingPoolAddress: string;
  flashLoanPoolAddress?: string;
  supportsFlashLoans: boolean;
  maxLoanToValue: number;
  tvlUSD?: number;
  borrowRateAPR?: number;
}

// ============================================================================
// POOLS DE LIQUIDEZ Y PRECIOS
// ============================================================================

export interface LiquidityPool {
  address: string;
  token0: TokenInfo;
  token1: TokenInfo;
  reserve0?: bigint;
  reserve1?: bigint;
  liquidity?: bigint;
  sqrtPriceX96?: bigint;
  tick?: number;
  totalSupply?: bigint;
  dex: string;
  chain: Chain;
  fee: number;
  reserveUSD: number;
  volume24h: number;
  txCount: number;
  
  // Campos adicionales para diferentes tipos de pools
  virtualPrice?: bigint;
  amplificationParameter?: bigint;
  feeGrowthGlobal0X128?: bigint;
  feeGrowthGlobal1X128?: bigint;
  price0CumulativeLast?: bigint;
  price1CumulativeLast?: bigint;
  blockTimestampLast?: number;
}

export interface PriceData {
  dex: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  amountOut: bigint;
  priceImpact: number;
  liquidity: bigint;
  reserveIn: bigint;
  reserveOut: bigint;
  fee: number;
  timestamp: number;
}

export interface PoolReserves {
  reserve0: bigint;
  reserve1: bigint;
  blockTimestampLast: number;
  token0: string;
  token1: string;
}

// ============================================================================
// RUTAS Y OPORTUNIDADES DE ARBITRAJE
// ============================================================================

export interface SwapRoute {
  path: TokenInfo[];
  dexes: DexInfo[];
  expectedOutput: bigint;
  priceImpact: number;
  gasEstimate: bigint;
  confidence: number;
}

export interface ArbitrageOpportunity {
  id: string;
  strategy: ArbitrageStrategy;
  sourceChain: Chain;
  targetChain?: Chain;
  tokenA: TokenInfo;
  tokenB: TokenInfo;
  routes: SwapRoute[];
  expectedProfit: bigint;
  profitMargin?: number;
  confidence: number;
  riskScore: number;
  estimatedExecutionTime?: number;
  liquidityDepth?: number;
  timestamp: number;
  score?: number;
}

export interface CrossChainRoute {
  sourceChain: Chain;
  targetChain: Chain;
  bridgeProtocol: string;
  bridgeFee: number;
  estimatedTime: number;
  minAmount: bigint;
  maxAmount: bigint;
}

// ============================================================================
// ANÁLISIS Y MÉTRICAS DE POOLS
// ============================================================================

export interface PoolMetrics {
  currentPrice: number;
  priceChange24h: number;
  liquidity: number;
  liquidityChange24h: number;
  volume24h: number;
  volumeChange24h: number;
  fees24h: number;
  apy: number;
  utilization: number;
  efficiency: number;
  depth: number;
  priceImpact1k: number;
  priceImpact10k: number;
  priceImpact100k: number;
}

export interface ImpermanentLossData {
  currentIL: number;
  maxIL: number;
  averageIL: number;
  ilHistory: Array<{ il: number; timestamp: number }>;
  timeframe: string;
}

export interface YieldOpportunity {
  baseAPY: number;
  incentiveAPY: number;
  totalAPY: number;
  riskAdjustedAPY: number;
  impermanentLossRisk: number;
  liquidityRisk: number;
  smartContractRisk: number;
  totalRiskScore: number;
  recommendation: string;
  incentives: any[];
}

export interface FeesAnalysis {
  fees24h: number;
  feesHistory: Array<{ amount: number; timestamp: number }>;
  averageFees: number;
  feeGrowthRate: number;
  feeEfficiency: number;
}

export interface VolatilityMetrics {
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  beta: number;
}

export interface PoolAnalysis {
  pool: LiquidityPool;
  metrics: PoolMetrics;
  impermanentLoss: ImpermanentLossData;
  yieldOpportunity: YieldOpportunity;
  feesAnalysis: FeesAnalysis;
  volatilityMetrics: VolatilityMetrics;
  historicalData: PoolHistoricalData;
  timestamp: number;
  confidence: number;
  recommendations: string[];
}

export interface PoolHistoricalData {
  priceHistory: Array<{ price: number; timestamp: number }>;
  volumeHistory: Array<{ volume: number; timestamp: number }>;
  liquidityHistory: Array<{ liquidity: number; timestamp: number }>;
}

// ============================================================================
// BATCH OPERATIONS Y MULTI-CHAIN
// ============================================================================

export interface BatchFetchConfig {
  maxConcurrent?: number;
  batchSize?: number;
  timeout?: number;
  retries?: number;
}

export interface PoolBatchResult {
  chain: Chain;
  pools: LiquidityPool[];
  totalFound: number;
  filtered: number;
  errors: any[];
  executionTime: number;
  fromCache: boolean;
}

export interface MultiChainBatchResult {
  results: Map<Chain, PoolBatchResult>;
  totalPools: number;
  successfulChains: number;
  failedChains: number;
  executionTime: number;
  errors: Array<{ chain: Chain; error: string }>;
}

export interface PoolFilterCriteria {
  tokenA?: string;
  tokenB?: string;
  minLiquidityUSD?: number;
  minVolume24h?: number;
  dexes?: DexInfo[];
  chains?: Chain[];
  limit?: number;
}

export interface BatchProgress {
  completed: number;
  total: number;
  currentChain?: Chain;
  estimatedTimeRemaining: number;
}

export interface BatchMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  throughput: number;
  cacheHitRate: number;
}

// ============================================================================
// AGREGADOR DE DATOS Y CONFIGURACIÓN
// ============================================================================

export interface AggregatorConfig {
  refreshInterval: number;
  minProfitThreshold: bigint;
  maxSlippage: number;
  maxPriceImpact: number;
  minConfidence: number;
  maxExecutionTime: number;
  enableCrossChain: boolean;
  enableStatistical: boolean;
  maxConcurrentAnalysis: number;
}

export interface MarketConditions {
  overallVolatility: number;
  liquidityIndex: number;
  networkCongestion: number;
  favorableForArbitrage: boolean;
  recommendedStrategies: ArbitrageStrategy[];
  gasConditions: number;
  timestamp: number;
}

export interface MultiChainArbitrageResult {
  opportunities: ArbitrageOpportunity[];
  totalScanned: number;
  profitable: number;
  averageProfit: number;
  topOpportunity: ArbitrageOpportunity | null;
  executionTime: number;
  chains: Chain[];
  strategies: ArbitrageStrategy[];
  marketConditions: MarketConditions;
  gasEstimates: Map<string, GasEstimate>;
  crossChainRoutes: CrossChainRoute[];
}

export interface OpportunityFilter {
  minProfitUSD?: number;
  maxRiskScore?: number;
  chains?: Chain[];
  strategies?: ArbitrageStrategy[];
  maxResults?: number;
}

// ============================================================================
// ANÁLISIS DE RENTABILIDAD Y RIESGO
// ============================================================================

export interface ProfitabilityAnalysis {
  grossProfitUSD: number;
  gasCostUSD: number;
  slippageCostUSD: number;
  platformFeesUSD: number;
  netProfitUSD: number;
  roi: number;
  profitMargin: number;
  breakEvenGasPrice: number;
  isProfitable: boolean;
  confidence: number;
}

export interface RiskAssessment {
  priceRisk: number;
  liquidityRisk: number;
  executionRisk: number;
  slippageRisk: number;
  gasPriceRisk: number;
  totalRiskScore: number;
  riskLevel: string;
  recommendations: string[];
  maxRecommendedSize: number;
}

export interface GasEstimate {
  gasLimit: bigint;
  gasPrice: bigint;
  totalCostUSD: number;
}

// ============================================================================
// SNAPSHOTS Y ALERTAS
// ============================================================================

export interface ArbitrageSnapshot {
  timestamp: number;
  activeOpportunities: ArbitrageOpportunity[];
  marketConditions: MarketConditions;
  metrics: ArbitrageMetrics;
  alerts: ArbitrageAlert[];
  systemHealth: any;
}

export interface ArbitrageAlert {
  id: string;
  type: 'opportunity' | 'error' | 'warning' | 'info';
  severity: 'critical' | 'warning' | 'info';
  message: string;
  timestamp: number;
  data?: any;
}

export interface ArbitrageMetrics {
  totalOpportunitiesFound: number;
  profitableOpportunities: number;
  totalVolumeAnalyzed: number;
  averageExecutionTime: number;
  successRate: number;
  totalProfitGenerated: number;
  averageProfitPerTrade: number;
  riskAdjustedReturns: number;
  uptime: number;
  errorsCount: number;
  performanceMetrics: {
    avgResponseTime: number;
    peakMemoryUsage: number;
    cacheHitRate: number;
  };
}

// ============================================================================
// API SNAPSHOTS Y RESPUESTAS
// ============================================================================

export interface ConsolidatedSnapshot {
  timestamp: number;
  executionTime: number;
  
  // Datos principales
  arbitrageData: MultiChainArbitrageResult | null;
  systemHealth: SystemHealth;
  blockchainSummaries: BlockchainSummary[];
  performanceMetrics: PerformanceMetrics;
  alerts: AlertSummary;
  
  // Métricas agregadas
  totalOpportunities: number;
  profitableOpportunities: number;
  totalTVL: number;
  averageProfitability: number;
  
  // Estados de error
  errors: Array<{ component: string; error: string }>;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  uptime: number;
  responseTime: number;
  components: Array<{ name: string; status: string }>;
  version: string;
  lastCheck: number;
}

export interface BlockchainSummary {
  chainId: number;
  chainName: string;
  nativeToken: string;
  totalTVL: number;
  dexMetrics: {
    totalDexes: number;
    totalTVL: number;
    averageTVL: number;
    flashLoanSupport: number;
    topDexes: Array<{ name: string; tvl: number; type: string }>;
  };
  lendingMetrics: {
    totalProtocols: number;
    totalTVL: number;
    averageBorrowRate: number;
    flashLoanSupport: number;
    topProtocols: Array<{ name: string; tvl: number; borrowRate: number }>;
  };
  opportunities: number;
  lastUpdate: number;
}

export interface PerformanceMetrics {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageResponseTime: number;
  throughput: number;
  uptime: number;
  memoryUsage: NodeJS.MemoryUsage;
  cacheStats: { size: number; keys: string[] };
  lastReset: number;
}

export interface AlertSummary {
  total: number;
  critical: number;
  warning: number;
  info: number;
  alerts: ArbitrageAlert[];
}

// ============================================================================
// TIPOS PARA THE GRAPH Y APIs EXTERNAS
// ============================================================================

export interface GraphQLQuery {
  query: string;
  variables?: Record<string, any>;
}

export interface DefiLlamaResponse {
  coins: Record<string, {
    decimals: number;
    price: number;
    symbol: string;
    timestamp: number;
    confidence: number;
  }>;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export interface RateLimitConfig {
  requestsPerSecond: number;
  burstLimit: number;
  windowMs: number;
}

export interface MulticallRequest {
  target: string;
  callData: string;
}

export interface LiquidityPosition {
  poolAddress: string;
  owner: string;
  tokenId?: bigint;
  liquidity: bigint;
  tickLower?: number;
  tickUpper?: number;
  feeGrowthInside0LastX128?: bigint;
  feeGrowthInside1LastX128?: bigint;
}

export interface PoolScanResult {
  pools: LiquidityPool[];
  totalScanned: number;
  criteria: PoolFilterCriteria;
  executionTime: number;
  fromCache: boolean;
}

// ============================================================================
// EXPORT DEFAULT PARA COMPATIBILIDAD
// ============================================================================

export default {
  // Re-export all types for convenience
  Chain,
  ArbitrageStrategy,
  TokenInfo,
  DexInfo,
  LendingInfo,
  LiquidityPool,
  ArbitrageOpportunity,
  ConsolidatedSnapshot,
  SystemHealth,
  BlockchainSummary,
  PerformanceMetrics
};
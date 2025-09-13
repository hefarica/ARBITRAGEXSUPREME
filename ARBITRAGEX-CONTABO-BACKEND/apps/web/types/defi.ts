import { BigNumber } from 'ethers';

// ============================================================================
// TIPOS BÁSICOS Y PRIMITIVOS
// ============================================================================

// Tipos de cadenas blockchain soportadas
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

// Tipos de estrategias de arbitraje
export type ArbitrageStrategy = 
  | 'intra-dex'
  | 'inter-dex'
  | 'cross-chain'
  | 'flash-loan'
  | 'liquidation'
  | 'funding-rate'
  | 'statistical'
  | 'governance'
  | 'synthetic';

// Tipos de tokens estándar
export type TokenType = 'native' | 'erc20' | 'wrapped' | 'stable' | 'lp';

// ============================================================================
// INTERFACES DE PROTOCOLOS Y TOKENS
// ============================================================================

// Información básica de tokens
export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  chainId: number;
  logoURI?: string;
  priceUSD?: number;
  type?: TokenType;
}

// Información de precios
export interface PriceData {
  address: string;
  symbol: string;
  priceUsd: number;
  priceChange24h?: number;
  volume24h?: number;
  marketCap?: number;
  timestamp: number;
}

// General Protocol Information
export interface ProtocolDetails {
  id: string;
  name: string;
  type: 'DEX' | 'Lending' | 'Bridge' | 'Oracle' | 'Yield' | 'Insurance';
  category?: string;
  description?: string;
  website?: string;
  documentation?: string;
  github?: string;
  audit?: string;
  riskScore?: number;
  tvlUSD?: number;
  volume24hUSD?: number;
  [key: string]: unknown; // Para campos adicionales específicos del protocolo
}

// Información específica de DEX
export interface DexInfo {
  id: string;
  name: string;
  chain: Chain;
  type: 'uniswap-v2' | 'uniswap-v3' | 'curve' | 'balancer' | 'sushiswap' | 'dodo' | 'kyber' | 'bancor';
  version: string;
  routerAddress: string;
  factoryAddress: string;
  fee: number; // Fee percentage (e.g., 0.003 for 0.3%)
  feeTiers?: number[]; // Para V3 protocols
  subgraphUrl?: string;
  website?: string;
  supportsFlashLoans: boolean;
  supportsMultiHop: boolean;
  tvlUSD?: number;
  volume24hUSD?: number;
  txCount24h?: number;
  riskScore?: number;
}

// Información de pools de liquidez
export interface LiquidityPool {
  address: string;
  dex: string;
  chain: Chain;
  token0: TokenInfo;
  token1: TokenInfo;
  reserve0: bigint;
  reserve1: bigint;
  totalSupply?: bigint;
  fee: number;
  reserveUSD: number;
  volume24h: number;
  volume7d?: number;
  txCount: number;
  apy?: number;
  
  // V3 specific
  liquidity?: bigint;
  sqrtPriceX96?: bigint;
  tick?: number;
  feeGrowthGlobal0X128?: bigint;
  feeGrowthGlobal1X128?: bigint;
  
  // Curve specific
  virtualPrice?: bigint;
  amplificationParameter?: bigint;
  
  // Timestamps
  blockTimestampLast?: number;
  createdAt?: number;
  updatedAt?: number;
  
  // Precios acumulados (V2)
  price0CumulativeLast?: bigint;
  price1CumulativeLast?: bigint;
}

// Snapshot of a specific protocol's state (e.g., TVL, key metrics)
export interface ProtocolSnapshot {
  protocolId: string;
  name: string;
  type: 'DEX' | 'Lending' | 'Bridge' | 'Oracle' | 'Yield' | 'Insurance';
  tvlUSD?: number;
  volume24hUSD?: number;
  interestRates?: {
    supplyAPR: number;
    borrowAPR: number;
  };
  apy?: number;
  totalUsers?: number;
  timestamp: number;
  details: Record<string, unknown>;
}

// ============================================================================
// TIPOS DE ARBITRAJE Y OPORTUNIDADES
// ============================================================================

// Import the unified ArbitrageOpportunity interface from arbitrage.ts to avoid conflicts
import type { ArbitrageOpportunity } from './arbitrage'
export type { ArbitrageOpportunity } from './arbitrage'

// Análisis de rentabilidad
export interface ProfitabilityAnalysis {
  grossProfitUSD: number;
  gasCostUSD: number;
  slippageCostUSD: number;
  platformFeesUSD: number;
  netProfitUSD: number;
  roi: number; // Return on Investment %
  profitMargin: number; // %
  breakEvenGasPrice: number;
  isProfitable: boolean;
  confidence: number; // 0-1
}

// Evaluación de riesgos
export interface RiskAssessment {
  priceRisk: number; // 0-1
  liquidityRisk: number; // 0-1
  executionRisk: number; // 0-1
  slippageRisk: number; // 0-1
  gasPriceRisk: number; // 0-1
  totalRiskScore: number; // 0-1
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  recommendations: string[];
  maxRecommendedSize: number; // USD
}

// Condiciones de mercado
export interface MarketConditions {
  overallVolatility: number; // 0-1
  liquidityIndex: number; // 0-1
  networkCongestion: number; // 0-1
  favorableForArbitrage: boolean;
  recommendedStrategies: ArbitrageStrategy[];
  gasConditions: number; // 0-1
  timestamp: number;
}

// Estimación de gas
export interface GasEstimate {
  gasLimit: bigint;
  gasPrice: bigint;
  totalCostUSD: number;
  estimatedTime?: number; // seconds
  confidence?: number; // 0-1
}

// Ruta cross-chain
export interface CrossChainRoute {
  fromChain: Chain;
  toChain: Chain;
  bridges: string[];
  estimatedTime: number; // seconds
  estimatedCost: number; // USD
  reliability: number; // 0-1
}

// Financial metrics for a chain or globally
export interface FinancialMetric {
  name: string;
  value: number;
  unit: string; // e.g., 'USD', 'ETH', '%'
  timestamp: number;
}

// Aggregated data for a single blockchain
export interface ChainData {
  chainId: number;
  chainName: string;
  lastUpdated: number; // Unix timestamp
  protocolSnapshots: ProtocolSnapshot[];
  arbitrageOpportunities: ArbitrageOpportunity[];
  financialMetrics: FinancialMetric[];
  topTokens: string[]; // List of top N tokens by volume/liquidity on this chain
}

// Overall summary for the entire multi-chain network
export interface NetworkSummary {
  totalChainsMonitored: number;
  activeChains: number;
  totalGlobalTvlUSD: number;
  totalArbitrageOpportunitiesDetected: number;
  totalProfitableArbitrageOpportunities: number;
  lastGlobalUpdate: number;
  // Potentially more aggregate metrics like total volume, average profit, etc.
}

// Types related to contract interaction (simplified)
export interface TokenPrice {
    address: string;
    symbol: string;
    priceUsd: number;
}

// Additional types for API responses
export interface ArbitrageSnapshot {
  opportunities: ArbitrageOpportunity[];
  profitable: number;
  totalValue: number;
  averageProfit: number;
  byChain: { [chainId: number]: ArbitrageOpportunity[] };
  timestamp: number;
}

// ============================================================================
// RESULTADOS Y MÉTRICAS DE ARBITRAJE
// ============================================================================

export interface MultiChainArbitrageResult {
  opportunities: ArbitrageOpportunity[];
  totalScanned: number;
  profitable: number;
  totalValue?: number;
  averageProfit: number;
  topOpportunity: ArbitrageOpportunity | null;
  executionTime: number;
  chains: Chain[];
  strategies: ArbitrageStrategy[];
  marketConditions: MarketConditions;
  gasEstimates: Map<string, GasEstimate>;
  crossChainRoutes: CrossChainRoute[];
  byStrategy?: { [strategy: string]: ArbitrageOpportunity[] };
  byChain?: { [chainId: number]: ArbitrageOpportunity[] };
  timestamp: number;
}

// Métricas del agregador
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

// Snapshot de arbitraje
export interface ArbitrageSnapshot {
  timestamp: number;
  activeOpportunities: ArbitrageOpportunity[];
  marketConditions: MarketConditions;
  metrics: ArbitrageMetrics;
  alerts: ArbitrageAlert[];
  systemHealth: SystemHealth;
}

// Alerta de arbitraje
export interface ArbitrageAlert {
  id: string;
  type: 'opportunity' | 'risk' | 'system' | 'market';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  opportunity?: ArbitrageOpportunity;
  timestamp: number;
  acknowledged?: boolean;
}

export interface ConsolidatedSnapshot {
  timestamp: number;
  executionTime: number;
  
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
  
  // Estados de error si los hay
  errors: Array<{ component: string; error: string }>;
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
    topDexes: Array<{
      name: string;
      tvl: number;
      type: string;
    }>;
  };
  lendingMetrics: {
    totalProtocols: number;
    totalTVL: number;
    averageBorrowRate: number;
    flashLoanSupport: number;
    topProtocols: Array<{
      name: string;
      tvl: number;
      borrowRate: number;
    }>;
  };
  opportunities: number;
  lastUpdate: number;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  uptime: number;
  responseTime: number;
  components: Array<{ name: string; status: string }>;
  version: string;
  lastCheck: number;
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

// ============================================================================
// CONFIGURACIONES Y FILTROS
// ============================================================================

// Configuración del agregador
export interface AggregatorConfig {
  refreshInterval: number; // milliseconds
  minProfitThreshold: bigint;
  maxSlippage: number; // 0-1
  maxPriceImpact: number; // 0-1
  minConfidence: number; // 0-1
  maxExecutionTime: number; // milliseconds
  enableCrossChain: boolean;
  enableStatistical: boolean;
  maxConcurrentAnalysis: number;
}

// Filtros de oportunidades
export interface OpportunityFilter {
  minProfitUSD?: number;
  maxRiskScore?: number;
  chains?: Chain[];
  strategies?: ArbitrageStrategy[];
  maxResults?: number;
  timeframe?: '1h' | '24h' | '7d';
}

// ============================================================================
// TIPOS DE POOL Y ANÁLISIS AVANZADO
// ============================================================================

// Métricas de pools
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

// Análisis completo de pool
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

// Datos de pérdida impermanente
export interface ImpermanentLossData {
  currentIL: number;
  maxIL: number;
  averageIL: number;
  ilHistory: Array<{ il: number; timestamp: number }>;
  timeframe: string;
}

// Oportunidad de yield
export interface YieldOpportunity {
  baseAPY: number;
  incentiveAPY: number;
  totalAPY: number;
  riskAdjustedAPY: number;
  impermanentLossRisk: number;
  liquidityRisk: number;
  smartContractRisk: number;
  totalRiskScore: number;
  recommendation: 'BUY' | 'HOLD' | 'SELL' | 'AVOID';
  incentives: Array<{
    token: string;
    apy: number;
    endDate?: number;
  }>;
}

// Análisis de fees
export interface FeesAnalysis {
  fees24h: number;
  feesHistory: Array<{ amount: number; timestamp: number }>;
  averageFees: number;
  feeGrowthRate: number;
  feeEfficiency: number;
}

// Métricas de volatilidad
export interface VolatilityMetrics {
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  beta: number;
}

// Datos históricos de pool
export interface PoolHistoricalData {
  priceHistory: Array<{ price: number; timestamp: number }>;
  volumeHistory: Array<{ volume: number; timestamp: number }>;
  liquidityHistory: Array<{ liquidity: number; timestamp: number }>;
}

// Posición de liquidez
export interface LiquidityPosition {
  owner: string;
  pool: string;
  tokenId?: number; // Para V3
  liquidity: bigint;
  token0Amount: bigint;
  token1Amount: bigint;
  uncollectedFees0?: bigint;
  uncollectedFees1?: bigint;
  tickLower?: number;
  tickUpper?: number;
}

// ============================================================================
// TIPOS DE BATCH Y FETCHING
// ============================================================================

// Configuración de batch fetching
export interface BatchFetchConfig {
  maxConcurrent?: number;
  batchSize?: number;
  timeout?: number;
  retries?: number;
}

// Criterios de filtro de pools
export interface PoolFilterCriteria {
  minLiquidityUSD?: number;
  minVolume24h?: number;
  tokenA?: string;
  tokenB?: string;
  dexes?: DexInfo[];
  limit?: number;
}

// Resultado de batch de pools
export interface PoolBatchResult {
  chain: Chain;
  pools: LiquidityPool[];
  totalFound: number;
  filtered: number;
  errors: Array<{ dex: string; error: string }>;
  executionTime: number;
  fromCache: boolean;
}

// Resultado multi-chain de batch
export interface MultiChainBatchResult {
  results: Map<Chain, PoolBatchResult>;
  totalPools: number;
  successfulChains: number;
  failedChains: number;
  executionTime: number;
  errors: Array<{ chain: Chain; error: string }>;
}

// Progreso de batch
export interface BatchProgress {
  currentStep: string;
  completedItems: number;
  totalItems: number;
  percentage: number;
  estimatedTimeRemaining?: number;
}

// Configuración de rate limiting
export interface RateLimitConfig {
  requestsPerSecond: number;
  burstLimit: number;
  cooldownMs: number;
}

// Request de multicall
export interface MulticallRequest {
  target: string;
  callData: string;
}

// Métricas de batch
export interface BatchMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  rateLimitHits: number;
  cacheHits: number;
  cacheMisses: number;
}

// Resultado de scan de pool
export interface PoolScanResult {
  address: string;
  success: boolean;
  data?: LiquidityPool;
  error?: string;
  executionTime: number;
}

export interface AlertSummary {
  total: number;
  critical: number;
  warning: number;
  info: number;
  alerts: Array<{
    id: string;
    severity: 'critical' | 'warning' | 'info';
    message: string;
    component: string;
    timestamp: number;
  }>;
}
/**
 * ArbitrageX Supreme - Type Definitions Enterprise
 * Based on TSD Maestro v2.0.0 - 20 Blockchains + 14 Strategies
 * Ingenio Pichichi S.A. - Sistema sin datos Mock
 */

// Note: Using bigint instead of ethers BigNumber for Next.js compatibility

// ============================================
// BLOCKCHAIN CONFIGURATIONS (20 Networks)
// ============================================

export interface BlockchainConfig {
  chainId: number
  name: string
  symbol: string
  nativeCurrency: {
    name: string
    symbol: string
    decimals: number
  }
  rpcUrls: {
    primary: string
    fallback: string[]
  }
  blockExplorers: {
    default: {
      name: string
      url: string
    }
  }
  gasConfig: {
    gasLimit: number
    maxFeePerGas?: string
    maxPriorityFeePerGas?: string
    gasPrice?: string
    gasMultiplier: number
  }
  networkSpecs: {
    avgBlockTime: number // milliseconds
    confirmations: number
    timeout: number
    maxReorgDepth: number
  }
  dexes: DEXConfig[]
  lending: LendingConfig[]
}

// ============================================
// DEX PROTOCOL CONFIGURATIONS
// ============================================

export interface DEXConfig {
  name: string
  type: DEXType
  version: string
  addresses: {
    router?: string
    factory?: string
    quoter?: string
    positionManager?: string
    vault?: string
  }
  fees: {
    tiers?: number[] // UniswapV3: [500, 3000, 10000]
    defaultFee?: number
  }
  pools: Record<string, string>
  supportsMultihop: boolean
  maxHops: number
}

export enum DEXType {
  UNISWAP_V2 = 'UNISWAP_V2',
  UNISWAP_V3 = 'UNISWAP_V3',
  CURVE = 'CURVE',
  BALANCER_V2 = 'BALANCER_V2',
  SUSHISWAP = 'SUSHISWAP',
  PANCAKESWAP_V2 = 'PANCAKESWAP_V2',
  PANCAKESWAP_V3 = 'PANCAKESWAP_V3',
  TRADER_JOE = 'TRADER_JOE',
  QUICKSWAP = 'QUICKSWAP',
  CAMELOT = 'CAMELOT',
  AERODROME = 'AERODROME',
  VELODROME = 'VELODROME'
}

// ============================================
// LENDING PROTOCOL CONFIGURATIONS
// ============================================

export interface LendingConfig {
  name: string
  type: LendingType
  version: string
  addresses: {
    pool: string
    dataProvider?: string
    oracle?: string
    configurator?: string
    rewards?: string
  }
  flashLoan: {
    supported: boolean
    fee: number // percentage (0.09 = 0.09%)
    maxAmount?: string
  }
  assets: Record<string, string> // symbol -> address
}

export enum LendingType {
  AAVE_V3 = 'AAVE_V3',
  COMPOUND_V3 = 'COMPOUND_V3',
  SPARK = 'SPARK',
  EULER = 'EULER',
  MORPHO = 'MORPHO',
  VENUS = 'VENUS',
  RADIANT = 'RADIANT',
  BENQI = 'BENQI',
  GEIST = 'GEIST'
}

// ============================================
// ARBITRAGE STRATEGY TYPES (14 Types)
// ============================================

export enum ArbitrageStrategyType {
  INTRA_DEX = 'INTRA_DEX',                      // #1: Same DEX different pools
  INTER_DEX_2_ASSET = 'INTER_DEX_2_ASSET',      // #2: Different DEX 2 assets
  INTER_DEX_3_ASSET = 'INTER_DEX_3_ASSET',      // #3: Different DEX 3 assets  
  CROSS_CHAIN = 'CROSS_CHAIN',                  // #4: Cross-chain arbitrage
  STABLECOIN_DEPEG = 'STABLECOIN_DEPEG',        // #5: Stablecoin depeg
  LIQUIDATION = 'LIQUIDATION',                  // #6: Liquidation arbitrage
  YIELD_FARMING = 'YIELD_FARMING',              // #7: Yield farming arb
  MEV_SANDWICH = 'MEV_SANDWICH',                // #8: MEV sandwich
  OPTIONS = 'OPTIONS',                          // #9: Options arbitrage
  PERPETUALS_BASIS = 'PERPETUALS_BASIS',        // #10: Perpetuals basis
  FLASH_MINT = 'FLASH_MINT',                    // #11: Flash mint arbitrage
  GOVERNANCE_TOKEN = 'GOVERNANCE_TOKEN',        // #12: Governance token arb
  BRIDGE = 'BRIDGE',                            // #13: Bridge arbitrage
  STATISTICAL = 'STATISTICAL'                   // #14: Statistical arbitrage
}

export interface ArbitrageStrategy {
  id: string
  name: string
  type: ArbitrageStrategyType
  complexity: 'Básica' | 'Intermedia' | 'Avanzada' | 'Experta'
  roiMin: number // percentage
  roiExpected: number[] // [min, max] percentage
  executionTime: number[] // [min, max] seconds
  gasCost: string // estimated gas cost
  riskLevel: 'Bajo' | 'Medio' | 'Alto' | 'Muy Alto'
  description: string
  contractAddress?: string
  isActive: boolean
}

// ============================================
// ARBITRAGE EXECUTION PARAMETERS
// ============================================

export interface ArbitrageParams {
  strategyType: ArbitrageStrategyType
  tokenA: string
  tokenB: string
  tokenC?: string // For 3-asset arbitrage
  flashLoanAmount: bigint
  flashLoanProvider: string
  dexRouter1: string
  dexRouter2: string
  dexRouter3?: string
  minProfit: bigint
  maxSlippage: number // basis points (300 = 3%)
  deadline: number
  walletDestino: string
  swapData1: string // encoded swap data
  swapData2: string
  swapData3?: string
  extraData?: string
}

export interface FlashLoanData {
  params: ArbitrageParams
  initiator: string
  chainId: number
  blockNumber: number
  timestamp: number
}

// ============================================
// QUOTE AND EXECUTION RESULTS
// ============================================

export interface QuoteParams {
  tokenIn: string
  tokenOut: string
  amountIn: bigint
  dexType: DEXType
  slippageTolerance: number
  options?: {
    recipient?: string
    deadline?: number
    feeTier?: number // For UniswapV3
  }
}

export interface QuoteResult {
  amountOut: bigint
  priceImpact: number // percentage
  fee: bigint
  route: string[]
  gasEstimate: bigint
  confidence: number // 0-100
  dexUsed: string
  poolAddress?: string
  spotPrice: bigint
  effectivePrice: bigint
}

export interface SwapParams {
  tokenIn: string
  tokenOut: string
  amountIn: bigint
  minAmountOut: bigint
  recipient: string
  deadline: number
  slippageTolerance: number
  dexRouter: string
  swapData: string
}

export interface ExecutionResult {
  success: boolean
  transactionHash: string
  gasUsed: bigint
  gasCost: bigint
  profit: bigint
  netProfit: bigint
  executionTime: number
  error?: string
  blockNumber: number
  timestamp: number
}

// ============================================
// N8N + TENDERLY + GELATO INTEGRATION
// ============================================

export interface N8NWorkflow {
  id: string
  name: string
  description: string
  triggers: N8NTrigger[]
  nodes: N8NNode[]
  isActive: boolean
}

export interface N8NTrigger {
  type: 'webhook' | 'cron' | 'manual'
  config: Record<string, any>
}

export interface N8NNode {
  id: string
  type: 'arbitrage-detector' | 'tenderly-simulator' | 'gelato-executor' | 'profit-calculator'
  config: Record<string, any>
}

export interface TenderlySimulation {
  id: string
  projectId: string
  simulationUrl: string
  status: 'pending' | 'success' | 'failed'
  result: {
    success: boolean
    gasUsed: string
    profit: string
    error?: string
    traces: any[]
  }
  metadata: {
    chainId: number
    blockNumber: number
    timestamp: number
  }
}

export interface GelatoTask {
  taskId: string
  execAddress: string
  execSelector: string
  execData: string
  moduleData: {
    modules: number[]
    args: string[]
  }
  feeToken: string
  status: 'pending' | 'exec' | 'cancelled'
}

// ============================================
// EXTERNAL API INTEGRATIONS
// ============================================

export interface PriceData {
  token: string
  price: number
  priceUsd: number
  change24h: number
  volume24h: number
  marketCap: number
  lastUpdated: number
  source: string[]
}

export interface LiquidityData {
  tokenA: string
  tokenB: string
  reserveA: bigint
  reserveB: bigint
  liquidity: bigint
  fee: number
  apr: number
  pool: string
  dex: string
  chainId: number
}

export interface OpportunityData {
  id: string
  strategy: ArbitrageStrategyType
  tokenPair: string
  profitUsd: number
  profitPercentage: number
  gasEstimate: bigint
  gasCostUsd: number
  netProfitUsd: number
  confidence: number
  riskScore: number
  executionTimeEstimate: number
  detectedAt: number
  expiresAt: number
  chainId: number
  dexes: string[]
  pools: string[]
}

// ============================================
// VALIDATION AND ERROR HANDLING
// ============================================

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  gasEstimate?: bigint
  requiredApprovals?: Array<{
    token: string
    spender: string
    amount: bigint
  }>
}

export interface ErrorInfo {
  code: string
  message: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  category: 'validation' | 'execution' | 'network' | 'protocol'
  retryable: boolean
  metadata?: Record<string, any>
}

// ============================================
// SYSTEM MONITORING AND METRICS
// ============================================

export interface SystemMetrics {
  totalOpportunities: number
  activeStrategies: number
  successRate: number
  totalProfit: number
  totalGasCost: number
  netProfit: number
  averageExecutionTime: number
  uptime: number
  errorRate: number
  lastUpdate: number
}

export interface ProtocolHealth {
  protocol: string
  chainId: number
  isHealthy: boolean
  latency: number
  errorRate: number
  lastCheck: number
  endpoints: Array<{
    url: string
    status: 'online' | 'offline' | 'degraded'
    latency: number
  }>
}

export interface ChainHealth {
  chainId: number
  name: string
  isHealthy: boolean
  blockHeight: number
  avgBlockTime: number
  gasPrice: bigint
  lastBlock: number
  rpcStatus: 'online' | 'offline' | 'degraded'
  protocolsHealthy: number
  protocolsTotal: number
}

// ============================================
// SECURITY AND COMPLIANCE
// ============================================

export interface SecurityConfig {
  maxSlippage: number // basis points
  minProfit: bigint // minimum profit in USD
  maxGasCost: bigint // maximum gas cost in USD
  emergencyStop: boolean
  whitelistedTokens: string[]
  blacklistedTokens: string[]
  maxFlashLoanAmount: Record<string, bigint> // per token
  riskLimits: {
    maxDailyVolume: bigint
    maxSingleTrade: bigint
    maxDrawdown: number // percentage
  }
}

export interface AuditLog {
  id: string
  timestamp: number
  action: string
  user: string
  params: Record<string, any>
  result: 'success' | 'failed'
  gasUsed?: bigint
  profit?: bigint
  error?: string
  metadata?: Record<string, any>
}

// ============================================
// USER AND WALLET MANAGEMENT
// ============================================

export interface UserConfig {
  address: string
  walletDestino: string
  riskProfile: 'conservative' | 'moderate' | 'aggressive'
  maxSlippage: number
  minROI: number
  enabledStrategies: ArbitrageStrategyType[]
  enabledChains: number[]
  dailyLimits: {
    maxTrades: number
    maxVolume: bigint
    maxGasCost: bigint
  }
  notifications: {
    email?: string
    discord?: string
    telegram?: string
  }
}

export interface WalletConnection {
  address: string
  chainId: number
  connector: 'metamask' | 'walletconnect' | 'coinbase'
  isConnected: boolean
  balances: Record<string, bigint>
  nonce: number
  lastActivity: number
}

// ============================================
// ARBITRAGE OPPORTUNITY (Missing Type)
// ============================================

export interface ArbitrageOpportunity {
  id: string
  strategy: ArbitrageStrategy
  tokenIn: string
  tokenOut: string
  amountIn: number
  expectedAmountOut: number
  expectedProfit: number
  path: string[]
  pools: any[] // Pool configurations
  chainId: number
  gasEstimate: number
  confidenceScore: number
  timestamp: number
  expiresAt: number
}
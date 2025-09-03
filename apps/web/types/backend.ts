/**
 * ArbitrageX Supreme - Backend Types
 * 
 * Definiciones de tipos específicas para el backend y servicios
 * Incluye tipos para fetchers, agregadores y utilidades
 */

import type { Chain, TokenInfo, LiquidityPool, DexInfo } from './defi';

// ============================================================================
// TIPOS PARA DEX HELPERS
// ============================================================================

export interface SwapRoute {
  path: string[];
  amountIn: bigint;
  amountOut: bigint;
  priceImpact: number;
  fee: number;
  gasEstimate?: bigint;
}

export interface PriceQuote {
  inputToken: TokenInfo;
  outputToken: TokenInfo;
  inputAmount: bigint;
  outputAmount: bigint;
  priceImpact: number;
  route: SwapRoute;
  gasEstimate: bigint;
  timestamp: number;
}

export interface LiquidityAnalysis {
  pool: LiquidityPool;
  depth: number;
  concentration: number;
  efficiency: number;
  stability: number;
  riskScore: number;
}

// ============================================================================
// TIPOS PARA DATA FETCHERS
// ============================================================================

export interface FetcherConfig {
  rpcUrl: string;
  subgraphUrl?: string;
  apiKey?: string;
  rateLimitMs: number;
  timeout: number;
  retries: number;
  cacheTtl: number;
}

export interface SubgraphQuery {
  query: string;
  variables?: Record<string, unknown>;
  operationName?: string;
}

export interface SubgraphResponse<T = unknown> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
  }>;
}

export interface TokenPair {
  token0: TokenInfo;
  token1: TokenInfo;
  reserves: {
    reserve0: bigint;
    reserve1: bigint;
  };
  price: number;
  priceInverted: number;
}

export interface PoolReserves {
  reserve0: bigint;
  reserve1: bigint;
  blockTimestampLast: number;
}

// ============================================================================
// TIPOS PARA NETWORK CONFIGS
// ============================================================================

export interface NetworkConfig {
  chainId: number;
  name: string;
  shortName: string;
  nativeToken: {
    symbol: string;
    name: string;
    decimals: number;
  };
  wrappedToken: {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
  };
  rpcUrl: string;
  blockExplorer: string;
  subgraphUrl?: string;
  multicallAddress?: string;
  averageBlockTime: number; // seconds
  gasPrice: {
    fast: number;
    standard: number;
    safe: number;
  };
  maxGasLimit: number;
}

// ============================================================================
// TIPOS PARA CACHE Y STORAGE
// ============================================================================

export interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
  ttl: number;
  key: string;
}

export interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
  keys: string[];
}

export interface StorageAdapter<T = unknown> {
  get(key: string): Promise<T | null>;
  set(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
  exists(key: string): Promise<boolean>;
  keys(pattern?: string): Promise<string[]>;
}

// ============================================================================
// TIPOS PARA VALIDACIÓN Y ERRORES
// ============================================================================

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: unknown;
}

export interface ApiError {
  message: string;
  code: string;
  status: number;
  details?: Record<string, unknown>;
  timestamp: number;
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
  retryCondition?: (error: Error) => boolean;
}

// ============================================================================
// TIPOS PARA EVENTOS Y LOGS
// ============================================================================

export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  timestamp: number;
  context?: Record<string, unknown>;
  error?: Error;
  component?: string;
}

export interface EventEmitter<T extends Record<string, unknown[]>> {
  on<K extends keyof T>(event: K, listener: (...args: T[K]) => void): void;
  off<K extends keyof T>(event: K, listener: (...args: T[K]) => void): void;
  emit<K extends keyof T>(event: K, ...args: T[K]): void;
}

// ============================================================================
// TIPOS PARA UTILIDADES MATEMÁTICAS
// ============================================================================

export interface PriceCalculation {
  price: number;
  priceImpact: number;
  slippage: number;
  minimumReceived: bigint;
  route: string[];
}

export interface LiquidityCalculation {
  token0Amount: bigint;
  token1Amount: bigint;
  lpTokens: bigint;
  priceImpact: number;
  share: number;
}

export interface FeeCalculation {
  protocolFee: bigint;
  lpFee: bigint;
  totalFee: bigint;
  feePercentage: number;
}

// ============================================================================
// TIPOS PARA MONITOREO Y HEALTH CHECK
// ============================================================================

export interface HealthCheck {
  component: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime?: number;
  error?: string;
  lastCheck: number;
  uptime?: number;
}

export interface SystemMetrics {
  memory: NodeJS.MemoryUsage;
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  network: {
    bytesReceived: number;
    bytesSent: number;
  };
  timestamp: number;
}

// ============================================================================
// TIPOS PARA CONFIGURACIÓN DE SERVICIOS
// ============================================================================

export interface ServiceConfig {
  name: string;
  version: string;
  environment: 'development' | 'staging' | 'production';
  port: number;
  host: string;
  cors: {
    origin: string | string[];
    credentials: boolean;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  logging: {
    level: string;
    format: 'json' | 'text';
  };
  database?: {
    url: string;
    poolSize: number;
    timeout: number;
  };
}

// ============================================================================
// TIPOS PARA TESTING Y MOCKING
// ============================================================================

export interface MockData<T = unknown> {
  data: T;
  delay?: number;
  shouldFail?: boolean;
  errorMessage?: string;
}

export interface TestConfig {
  timeout: number;
  retries: number;
  parallel: boolean;
  mockExternalServices: boolean;
  seedData?: Record<string, unknown>;
}

// ============================================================================
// EXPORT HELPERS
// ============================================================================

// Helper para crear configuraciones por defecto
export const createDefaultConfig = <T extends Record<string, unknown>>(
  defaults: T,
  overrides?: Partial<T>
): T => {
  return { ...defaults, ...overrides };
};

// Helper para validar tipos en runtime
export const isValidAddress = (address: string): boolean => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

export const isValidChain = (chain: string): chain is Chain => {
  const validChains: Chain[] = [
    'ethereum', 'bsc', 'polygon', 'arbitrum', 'optimism', 'avalanche',
    'base', 'fantom', 'gnosis', 'celo', 'moonbeam', 'cronos', 'aurora',
    'harmony', 'kava', 'metis', 'evmos', 'oasis', 'milkomeda', 'telos'
  ];
  return validChains.includes(chain as Chain);
};

// Helper para convertir entre tipos de números
export const toBigInt = (value: string | number | bigint): bigint => {
  return typeof value === 'bigint' ? value : BigInt(value);
};

export const fromBigInt = (value: bigint, decimals = 18): number => {
  return Number(value) / Math.pow(10, decimals);
};
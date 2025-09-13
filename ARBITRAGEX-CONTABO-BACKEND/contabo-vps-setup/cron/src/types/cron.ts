/**
 * ArbitrageX Supreme V3.0 - Cron Service Type Definitions
 * Real-Only Policy - All types for data update operations
 */

import { z } from 'zod';

/**
 * Job execution status tracking
 */
export enum JobStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped'
}

/**
 * Job priority levels for execution ordering
 */
export enum JobPriority {
  CRITICAL = 1,  // Market data, prices
  HIGH = 2,      // Pool liquidity, gas prices  
  MEDIUM = 3,    // Strategy performance, reconciliation
  LOW = 4        // Historical data, cleanup
}

/**
 * Supported blockchain networks
 */
export const ChainIdSchema = z.enum([
  '1',     // Ethereum Mainnet
  '137',   // Polygon
  '56',    // BSC
  '42161', // Arbitrum One
  '10',    // Optimism
  '8453',  // Base
  '43114', // Avalanche
  '250',   // Fantom
  '100',   // Gnosis
  '1284',  // Moonbeam
  '42220', // Celo
  '1666600000', // Harmony
  '25'     // Cronos
]);

export type ChainId = z.infer<typeof ChainIdSchema>;

/**
 * Market data update schemas
 */
export const TokenPriceSchema = z.object({
  token_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  symbol: z.string(),
  decimals: z.number().int().min(0).max(18),
  price_usd: z.string(), // BigNumber as string for precision
  price_eth: z.string(),
  volume_24h: z.string(),
  market_cap: z.string().optional(),
  timestamp: z.string().datetime(),
  source: z.enum(['coingecko', 'dexscreener', 'uniswap', 'chainlink']),
  chain_id: ChainIdSchema
});

export type TokenPrice = z.infer<typeof TokenPriceSchema>;

/**
 * Liquidity pool data schemas
 */
export const PoolLiquiditySchema = z.object({
  pool_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  dex_name: z.string(),
  token0_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  token1_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  token0_symbol: z.string(),
  token1_symbol: z.string(),
  reserve0: z.string(), // BigNumber as string
  reserve1: z.string(), // BigNumber as string
  total_liquidity_usd: z.string(),
  fee_tier: z.number(), // in basis points
  volume_24h: z.string(),
  last_updated: z.string().datetime(),
  chain_id: ChainIdSchema
});

export type PoolLiquidity = z.infer<typeof PoolLiquiditySchema>;

/**
 * Gas price data schemas
 */
export const GasPriceDataSchema = z.object({
  chain_id: ChainIdSchema,
  slow_gwei: z.string(),
  standard_gwei: z.string(),
  fast_gwei: z.string(),
  instant_gwei: z.string(),
  base_fee_gwei: z.string().optional(),
  priority_fee_gwei: z.string().optional(),
  block_number: z.number().int().positive(),
  timestamp: z.string().datetime(),
  source: z.enum(['ethgasstation', 'blocknative', 'flashbots', 'chainlink'])
});

export type GasPriceData = z.infer<typeof GasPriceDataSchema>;

/**
 * MEV opportunity tracking schemas
 */
export const MEVOpportunitySchema = z.object({
  opportunity_id: z.string().uuid(),
  strategy_type: z.enum([
    'arbitrage', 'sandwich', 'liquidation', 'backrun', 
    'frontrun', 'jit_liquidity', 'cross_chain_arb'
  ]),
  chain_id: ChainIdSchema,
  block_number: z.number().int().positive(),
  transaction_hash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional(),
  estimated_profit_eth: z.string(),
  estimated_profit_usd: z.string(),
  gas_cost_eth: z.string(),
  net_profit_eth: z.string(),
  tokens_involved: z.array(z.string()),
  pools_involved: z.array(z.string()),
  detected_at: z.string().datetime(),
  executed: z.boolean(),
  execution_result: z.object({
    success: z.boolean(),
    actual_profit_eth: z.string().optional(),
    actual_gas_cost: z.string().optional(),
    execution_time_ms: z.number().optional(),
    failure_reason: z.string().optional()
  }).optional()
});

export type MEVOpportunity = z.infer<typeof MEVOpportunitySchema>;

/**
 * Cron job configuration schema
 */
export const CronJobConfigSchema = z.object({
  job_name: z.string(),
  description: z.string(),
  schedule: z.string(), // Cron expression
  priority: z.nativeEnum(JobPriority),
  enabled: z.boolean().default(true),
  timeout_minutes: z.number().int().positive().default(30),
  retry_attempts: z.number().int().min(0).max(5).default(3),
  retry_delay_seconds: z.number().int().positive().default(60),
  chains: z.array(ChainIdSchema).optional(),
  dependencies: z.array(z.string()).default([]), // Job names that must complete first
  alerting: z.object({
    on_failure: z.boolean().default(true),
    on_long_duration: z.boolean().default(true),
    duration_threshold_minutes: z.number().int().positive().default(15)
  }).default({})
});

export type CronJobConfig = z.infer<typeof CronJobConfigSchema>;

/**
 * Job execution result schema
 */
export const JobExecutionResultSchema = z.object({
  job_name: z.string(),
  execution_id: z.string().uuid(),
  status: z.nativeEnum(JobStatus),
  started_at: z.string().datetime(),
  completed_at: z.string().datetime().optional(),
  duration_ms: z.number().int().min(0).optional(),
  records_processed: z.number().int().min(0).default(0),
  records_updated: z.number().int().min(0).default(0),
  records_failed: z.number().int().min(0).default(0),
  error_message: z.string().optional(),
  error_stack: z.string().optional(),
  metadata: z.record(z.any()).default({}),
  next_execution: z.string().datetime().optional()
});

export type JobExecutionResult = z.infer<typeof JobExecutionResultSchema>;

/**
 * Data source configuration for external APIs
 */
export const DataSourceConfigSchema = z.object({
  name: z.string(),
  base_url: z.string().url(),
  api_key: z.string().optional(),
  rate_limit_per_minute: z.number().int().positive().default(60),
  timeout_seconds: z.number().int().positive().default(30),
  retry_attempts: z.number().int().min(0).max(5).default(3),
  supported_chains: z.array(ChainIdSchema),
  endpoints: z.record(z.string(), z.string()), // endpoint_name -> path mapping
  headers: z.record(z.string(), z.string()).default({})
});

export type DataSourceConfig = z.infer<typeof DataSourceConfigSchema>;

/**
 * Chain configuration for multi-chain operations
 */
export const ChainConfigSchema = z.object({
  chain_id: ChainIdSchema,
  name: z.string(),
  rpc_urls: z.array(z.string().url()),
  ws_urls: z.array(z.string().url()).optional(),
  explorer_url: z.string().url(),
  native_token: z.object({
    symbol: z.string(),
    decimals: z.number().int().positive(),
    coingecko_id: z.string().optional()
  }),
  wrapped_native_token: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  usdc_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  usdt_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  weth_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  major_dexes: z.array(z.object({
    name: z.string(),
    router_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    factory_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    fee_tiers: z.array(z.number()).default([3000]) // in basis points
  })),
  block_time_seconds: z.number().positive(),
  finality_blocks: z.number().int().positive(),
  gas_price_multiplier: z.number().positive().default(1.0),
  enabled: z.boolean().default(true)
});

export type ChainConfig = z.infer<typeof ChainConfigSchema>;

/**
 * System health metrics schema
 */
export const SystemHealthMetricsSchema = z.object({
  timestamp: z.string().datetime(),
  database: z.object({
    connection_count: z.number().int().min(0),
    query_duration_ms: z.number().min(0),
    deadlocks_count: z.number().int().min(0),
    cache_hit_ratio: z.number().min(0).max(1)
  }),
  redis: z.object({
    memory_usage_mb: z.number().min(0),
    connected_clients: z.number().int().min(0),
    keyspace_hits: z.number().int().min(0),
    keyspace_misses: z.number().int().min(0),
    operations_per_second: z.number().min(0)
  }),
  system: z.object({
    cpu_usage_percent: z.number().min(0).max(100),
    memory_usage_percent: z.number().min(0).max(100),
    disk_usage_percent: z.number().min(0).max(100),
    load_average: z.array(z.number().min(0)).length(3) // 1m, 5m, 15m
  }),
  network: z.object({
    rpc_response_time_ms: z.record(ChainIdSchema, z.number().min(0)),
    successful_requests: z.record(ChainIdSchema, z.number().int().min(0)),
    failed_requests: z.record(ChainIdSchema, z.number().int().min(0))
  })
});

export type SystemHealthMetrics = z.infer<typeof SystemHealthMetricsSchema>;

/**
 * Job scheduling and coordination types
 */
export interface JobScheduler {
  scheduleJob(config: CronJobConfig, handler: JobHandler): void;
  unscheduleJob(jobName: string): void;
  getJobStatus(jobName: string): JobExecutionResult | null;
  getAllJobs(): Map<string, CronJobConfig>;
  executeJobNow(jobName: string): Promise<JobExecutionResult>;
}

export interface JobHandler {
  (context: JobExecutionContext): Promise<JobExecutionResult>;
}

export interface JobExecutionContext {
  jobName: string;
  executionId: string;
  config: CronJobConfig;
  logger: any; // Winston logger instance
  database: any; // Database connection
  redis: any; // Redis client
  metrics: any; // Metrics collector
  startTime: Date;
}

/**
 * Data update strategies
 */
export enum UpdateStrategy {
  FULL_REFRESH = 'full_refresh',      // Complete data reload
  INCREMENTAL = 'incremental',        // Only new/changed data
  SMART_SYNC = 'smart_sync',         // Intelligent delta detection
  REAL_TIME = 'real_time'            // Continuous updates
}

/**
 * External data source response schemas
 */
export const CoinGeckoPriceResponseSchema = z.object({
  id: z.string(),
  symbol: z.string(),
  name: z.string(),
  current_price: z.number(),
  market_cap: z.number(),
  total_volume: z.number(),
  price_change_percentage_24h: z.number(),
  last_updated: z.string()
});

export const UniswapV3PoolSchema = z.object({
  id: z.string(),
  token0: z.object({
    id: z.string(),
    symbol: z.string(),
    decimals: z.string()
  }),
  token1: z.object({
    id: z.string(),
    symbol: z.string(), 
    decimals: z.string()
  }),
  liquidity: z.string(),
  sqrtPrice: z.string(),
  tick: z.string(),
  feeTier: z.string(),
  volumeUSD: z.string(),
  tvlUSD: z.string()
});

/**
 * Error handling types
 */
export interface CronError extends Error {
  jobName: string;
  executionId: string;
  retryable: boolean;
  context?: Record<string, any>;
}

export class CronJobError extends Error implements CronError {
  constructor(
    message: string,
    public jobName: string,
    public executionId: string,
    public retryable: boolean = true,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'CronJobError';
  }
}

export class DataSourceError extends Error implements CronError {
  constructor(
    message: string,
    public jobName: string,
    public executionId: string,
    public retryable: boolean = true,
    public dataSource?: string,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'DataSourceError';
  }
}
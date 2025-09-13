import { z } from 'zod';

// =============================================================================
// CORE DATA SYNC TYPES
// =============================================================================

export const ChainInfoSchema = z.object({
  chain_id: z.number().int().positive(),
  name: z.string().min(1),
  symbol: z.string().min(1),
  rpc_url: z.string().url(),
  explorer_url: z.string().url(),
  block_time_seconds: z.number().positive(),
  gas_limit_default: z.number().int().positive(),
  gas_price_oracle_url: z.string().url().optional(),
  native_token_contract: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  
  // Network health metrics
  is_active: z.boolean().default(true),
  last_block_number: z.number().int().nonnegative(),
  avg_gas_price_gwei: z.number().nonnegative(),
  network_congestion: z.enum(['low', 'medium', 'high']).default('medium'),
  
  // Data freshness
  last_updated: z.date(),
  sync_status: z.enum(['synced', 'syncing', 'error', 'stale']).default('synced'),
  next_update_scheduled: z.date().optional(),
});

export const DexInfoSchema = z.object({
  dex_id: z.string().min(1),
  name: z.string().min(1),
  chain_id: z.number().int().positive(),
  protocol_type: z.enum(['uniswap_v2', 'uniswap_v3', 'curve', 'balancer', 'sushiswap', '1inch', 'other']),
  
  // Contract addresses
  router_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  factory_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  quoter_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  
  // Protocol configuration
  fee_tiers: z.array(z.number()).default([]),
  supports_flash_swaps: z.boolean().default(false),
  supports_multi_hop: z.boolean().default(false),
  min_liquidity_threshold_usd: z.number().nonnegative().default(10000),
  
  // Liquidity and volume metrics
  total_value_locked_usd: z.number().nonnegative(),
  daily_volume_usd: z.number().nonnegative(),
  weekly_volume_usd: z.number().nonnegative(),
  pair_count: z.number().int().nonnegative(),
  active_pair_count: z.number().int().nonnegative(),
  
  // API endpoints
  subgraph_url: z.string().url().optional(),
  api_endpoint: z.string().url().optional(),
  websocket_url: z.string().optional(),
  
  // Operational status
  is_active: z.boolean().default(true),
  health_status: z.enum(['healthy', 'degraded', 'down']).default('healthy'),
  last_successful_sync: z.date(),
  error_count_24h: z.number().int().nonnegative().default(0),
  
  last_updated: z.date(),
  sync_status: z.enum(['synced', 'syncing', 'error', 'stale']).default('synced'),
});

export const LendingProtocolSchema = z.object({
  protocol_id: z.string().min(1),
  name: z.string().min(1),
  chain_id: z.number().int().positive(),
  protocol_type: z.enum(['aave_v2', 'aave_v3', 'compound_v2', 'compound_v3', 'euler', 'morpho', 'other']),
  
  // Contract addresses
  lending_pool_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  data_provider_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  oracle_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  
  // Protocol features
  supports_flash_loans: z.boolean().default(false),
  supports_variable_rates: z.boolean().default(false),
  supports_stable_rates: z.boolean().default(false),
  flash_loan_fee_bps: z.number().min(0).max(10000).optional(), // Basis points
  
  // Financial metrics
  total_liquidity_usd: z.number().nonnegative(),
  total_borrows_usd: z.number().nonnegative(),
  utilization_rate: z.number().min(0).max(1),
  avg_supply_apy: z.number().nonnegative(),
  avg_borrow_apy: z.number().nonnegative(),
  
  // Asset count and diversity
  supported_assets_count: z.number().int().nonnegative(),
  active_assets_count: z.number().int().nonnegative(),
  
  // API and data sources
  subgraph_url: z.string().url().optional(),
  api_endpoint: z.string().url().optional(),
  
  // Operational status
  is_active: z.boolean().default(true),
  health_status: z.enum(['healthy', 'degraded', 'down']).default('healthy'),
  last_successful_sync: z.date(),
  error_count_24h: z.number().int().nonnegative().default(0),
  
  last_updated: z.date(),
  sync_status: z.enum(['synced', 'syncing', 'error', 'stale']).default('synced'),
});

export const AssetInfoSchema = z.object({
  asset_id: z.string().min(1), // Unique identifier (e.g., "eth_usdc", "polygon_wmatic")
  token_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  chain_id: z.number().int().positive(),
  
  // Basic token information
  symbol: z.string().min(1),
  name: z.string().min(1),
  decimals: z.number().int().min(0).max(18),
  
  // Market data
  price_usd: z.number().nonnegative(),
  market_cap_usd: z.number().nonnegative().optional(),
  volume_24h_usd: z.number().nonnegative(),
  price_change_24h_percentage: z.number(),
  
  // Liquidity metrics
  total_liquidity_usd: z.number().nonnegative(),
  liquidity_sources: z.array(z.object({
    dex_id: z.string(),
    pair_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    liquidity_usd: z.number().nonnegative(),
    volume_24h_usd: z.number().nonnegative(),
  })).default([]),
  
  // Trading pairs and opportunities
  major_pairs: z.array(z.object({
    pair_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    dex_id: z.string(),
    quote_token: z.string(),
    liquidity_usd: z.number().nonnegative(),
    fee_tier: z.number().optional(),
  })).default([]),
  
  // Arbitrage relevance
  arbitrage_score: z.number().min(0).max(100).default(0), // 0-100 scoring
  volatility_24h: z.number().nonnegative().default(0),
  spread_opportunities: z.number().int().nonnegative().default(0),
  
  // Data quality and freshness
  price_sources: z.array(z.string()).default([]),
  data_confidence: z.number().min(0).max(1).default(1), // 0-1 confidence score
  last_price_update: z.date(),
  
  // Operational flags
  is_active: z.boolean().default(true),
  is_stablecoin: z.boolean().default(false),
  is_wrapped_native: z.boolean().default(false),
  has_sufficient_liquidity: z.boolean().default(false),
  
  last_updated: z.date(),
  sync_status: z.enum(['synced', 'syncing', 'error', 'stale']).default('synced'),
});

// =============================================================================
// SYNC JOB AND EXECUTION TYPES
// =============================================================================

export const SyncJobSchema = z.object({
  job_id: z.string().uuid(),
  job_type: z.enum(['chains', 'dexs', 'lending', 'assets', 'prices', 'full_sync']),
  job_name: z.string().min(1),
  
  // Execution scheduling
  cron_expression: z.string().min(1), // e.g., "0 * * * *" for hourly
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  timeout_seconds: z.number().int().positive().default(1800), // 30 minutes
  
  // Target configuration
  target_chains: z.array(z.number()).optional(), // Specific chains to sync
  target_protocols: z.array(z.string()).optional(), // Specific protocols/dexs
  batch_size: z.number().int().positive().default(50),
  
  // Execution state
  status: z.enum(['scheduled', 'running', 'completed', 'failed', 'cancelled']).default('scheduled'),
  last_execution: z.date().optional(),
  next_execution: z.date().optional(),
  execution_count: z.number().int().nonnegative().default(0),
  failure_count: z.number().int().nonnegative().default(0),
  
  // Results and metrics
  last_duration_seconds: z.number().nonnegative().optional(),
  records_processed: z.number().int().nonnegative().default(0),
  records_updated: z.number().int().nonnegative().default(0),
  records_failed: z.number().int().nonnegative().default(0),
  
  // Configuration
  retry_attempts: z.number().int().min(0).max(10).default(3),
  retry_delay_seconds: z.number().int().positive().default(60),
  enable_notifications: z.boolean().default(false),
  
  created_at: z.date(),
  updated_at: z.date(),
});

export const SyncExecutionSchema = z.object({
  execution_id: z.string().uuid(),
  job_id: z.string().uuid(),
  
  // Execution details
  started_at: z.date(),
  completed_at: z.date().optional(),
  duration_seconds: z.number().nonnegative().optional(),
  
  // Results
  status: z.enum(['running', 'completed', 'failed', 'timeout', 'cancelled']),
  records_processed: z.number().int().nonnegative(),
  records_updated: z.number().int().nonnegative(),
  records_failed: z.number().int().nonnegative(),
  
  // Error handling
  error_message: z.string().optional(),
  error_stack: z.string().optional(),
  retry_count: z.number().int().nonnegative().default(0),
  
  // Performance metrics
  avg_processing_time_ms: z.number().nonnegative().optional(),
  memory_usage_mb: z.number().nonnegative().optional(),
  api_calls_made: z.number().int().nonnegative().default(0),
  
  // Progress tracking
  progress_percentage: z.number().min(0).max(100).default(0),
  current_phase: z.string().optional(),
  phases_completed: z.array(z.string()).default([]),
  
  created_at: z.date(),
});

// =============================================================================
// DATA SOURCE AND API TYPES
// =============================================================================

export const DataSourceConfigSchema = z.object({
  source_id: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(['rpc', 'subgraph', 'rest_api', 'websocket', 'database']),
  
  // Connection details
  endpoint_url: z.string().url(),
  api_key: z.string().optional(),
  rate_limit_per_second: z.number().positive().default(10),
  timeout_seconds: z.number().positive().default(30),
  
  // Health and reliability
  is_active: z.boolean().default(true),
  reliability_score: z.number().min(0).max(1).default(1),
  avg_response_time_ms: z.number().nonnegative().default(0),
  error_rate_24h: z.number().min(0).max(1).default(0),
  
  // Usage tracking
  requests_24h: z.number().int().nonnegative().default(0),
  successful_requests_24h: z.number().int().nonnegative().default(0),
  last_successful_request: z.date().optional(),
  
  // Configuration
  headers: z.record(z.string()).optional(),
  retry_attempts: z.number().int().min(0).max(10).default(3),
  
  last_updated: z.date(),
});

// =============================================================================
// API REQUEST/RESPONSE SCHEMAS
// =============================================================================

export const CreateSyncJobRequestSchema = z.object({
  job_type: z.enum(['chains', 'dexs', 'lending', 'assets', 'prices', 'full_sync']),
  job_name: z.string().min(1),
  cron_expression: z.string().min(1),
  priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  timeout_seconds: z.number().int().positive().default(1800),
  target_chains: z.array(z.number()).optional(),
  target_protocols: z.array(z.string()).optional(),
  batch_size: z.number().int().positive().default(50),
  retry_attempts: z.number().int().min(0).max(10).default(3),
  enable_notifications: z.boolean().default(false),
});

export const SyncStatusQuerySchema = z.object({
  job_type: z.enum(['chains', 'dexs', 'lending', 'assets', 'prices', 'full_sync']).optional(),
  status: z.enum(['scheduled', 'running', 'completed', 'failed', 'cancelled']).optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(1000).default(100),
  offset: z.number().int().min(0).default(0),
});

export const DataQualityReportSchema = z.object({
  report_id: z.string().uuid(),
  generated_at: z.date(),
  timeframe_hours: z.number().int().positive().default(24),
  
  // Overall metrics
  total_records: z.number().int().nonnegative(),
  stale_records: z.number().int().nonnegative(),
  error_records: z.number().int().nonnegative(),
  data_freshness_score: z.number().min(0).max(100),
  
  // Per-category breakdown
  chains: z.object({
    total: z.number().int().nonnegative(),
    active: z.number().int().nonnegative(),
    synced: z.number().int().nonnegative(),
    errors: z.number().int().nonnegative(),
  }),
  dexs: z.object({
    total: z.number().int().nonnegative(),
    active: z.number().int().nonnegative(),
    healthy: z.number().int().nonnegative(),
    degraded: z.number().int().nonnegative(),
  }),
  lending_protocols: z.object({
    total: z.number().int().nonnegative(),
    active: z.number().int().nonnegative(),
    healthy: z.number().int().nonnegative(),
    degraded: z.number().int().nonnegative(),
  }),
  assets: z.object({
    total: z.number().int().nonnegative(),
    active: z.number().int().nonnegative(),
    price_synced: z.number().int().nonnegative(),
    stale_prices: z.number().int().nonnegative(),
  }),
  
  // Data source health
  data_sources: z.array(z.object({
    source_id: z.string(),
    health_status: z.enum(['healthy', 'degraded', 'down']),
    reliability_score: z.number().min(0).max(1),
    last_successful_sync: z.date().optional(),
  })),
  
  // Issues and recommendations
  critical_issues: z.array(z.string()),
  warnings: z.array(z.string()),
  recommendations: z.array(z.string()),
});

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type ChainInfo = z.infer<typeof ChainInfoSchema>;
export type DexInfo = z.infer<typeof DexInfoSchema>;
export type LendingProtocol = z.infer<typeof LendingProtocolSchema>;
export type AssetInfo = z.infer<typeof AssetInfoSchema>;
export type SyncJob = z.infer<typeof SyncJobSchema>;
export type SyncExecution = z.infer<typeof SyncExecutionSchema>;
export type DataSourceConfig = z.infer<typeof DataSourceConfigSchema>;
export type CreateSyncJobRequest = z.infer<typeof CreateSyncJobRequestSchema>;
export type SyncStatusQuery = z.infer<typeof SyncStatusQuerySchema>;
export type DataQualityReport = z.infer<typeof DataQualityReportSchema>;
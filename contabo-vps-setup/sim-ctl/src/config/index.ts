import { z } from 'zod';

// =============================================================================
// ENVIRONMENT CONFIGURATION SCHEMA
// =============================================================================

const ConfigSchema = z.object({
  // Service Configuration
  service: z.object({
    name: z.string().default('sim-ctl'),
    version: z.string().default('3.0.0'),
    environment: z.enum(['development', 'production']).default('development'),
    port: z.number().int().min(1).max(65535).default(3003),
    host: z.string().default('0.0.0.0'),
    log_level: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  }),

  // Redis Configuration
  redis: z.object({
    url: z.string().url().default('redis://localhost:6379'),
    key_prefix: z.string().default('simctl:'),
    ttl_seconds: z.number().int().positive().default(3600), // 1 hour
  }),

  // Anvil Configuration
  anvil: z.object({
    binary_path: z.string().default('/usr/local/bin/anvil'),
    data_dir: z.string().default('/tmp/anvil-instances'),
    max_instances: z.number().int().min(1).max(50).default(10),
    instance_timeout_seconds: z.number().int().positive().default(3600), // 1 hour
    heartbeat_interval_ms: z.number().int().positive().default(10000), // 10 seconds
    cleanup_interval_ms: z.number().int().positive().default(60000), // 1 minute
    port_range_start: z.number().int().min(1024).default(8545),
    port_range_end: z.number().int().max(65535).default(8595),
    default_chain_id: z.number().int().positive().default(31337),
  }),

  // Simulation Configuration
  simulation: z.object({
    max_execution_time_ms: z.number().int().positive().default(5000), // 5 seconds
    default_gas_limit: z.number().int().positive().default(30000000),
    default_gas_price: z.string().default('20000000000'), // 20 gwei
    max_slippage: z.number().min(0).max(1).default(0.05), // 5%
    profit_threshold_usd: z.number().positive().default(10), // $10 minimum
  }),

  // Chain Configuration
  chains: z.object({
    ethereum: z.object({
      rpc_url: z.string().url(),
      chain_id: z.number().default(1),
      native_token: z.string().default('ETH'),
      block_time_seconds: z.number().default(12),
    }),
    arbitrum: z.object({
      rpc_url: z.string().url(),
      chain_id: z.number().default(42161),
      native_token: z.string().default('ETH'),
      block_time_seconds: z.number().default(0.25),
    }),
    polygon: z.object({
      rpc_url: z.string().url(),
      chain_id: z.number().default(137),
      native_token: z.string().default('MATIC'),
      block_time_seconds: z.number().default(2),
    }),
    bsc: z.object({
      rpc_url: z.string().url(),
      chain_id: z.number().default(56),
      native_token: z.string().default('BNB'),
      block_time_seconds: z.number().default(3),
    }),
  }),

  // Real-Only Policy Configuration
  real_only: z.object({
    enabled: z.boolean().default(true),
    allowed_test_chains: z.array(z.number()).default([31337, 1337]), // Local anvil chains
    block_mocks: z.boolean().default(true),
    require_real_rpcs: z.boolean().default(true),
    validate_chain_data: z.boolean().default(true),
  }),

  // Monitoring Configuration
  monitoring: z.object({
    metrics_enabled: z.boolean().default(true),
    prometheus_port: z.number().int().min(1).max(65535).default(9093),
    health_check_interval_ms: z.number().int().positive().default(30000), // 30 seconds
    alert_on_failure_count: z.number().int().positive().default(3),
  }),
});

// =============================================================================
// CONFIGURATION LOADER
// =============================================================================

function loadConfig(): z.infer<typeof ConfigSchema> {
  const envConfig = {
    service: {
      name: process.env.SIM_CTL_NAME || 'sim-ctl',
      version: process.env.SIM_CTL_VERSION || '3.0.0',
      environment: process.env.NODE_ENV || 'development',
      port: parseInt(process.env.SIM_CTL_PORT || '3003'),
      host: process.env.SIM_CTL_HOST || '0.0.0.0',
      log_level: process.env.LOG_LEVEL || 'info',
    },
    redis: {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      key_prefix: process.env.REDIS_KEY_PREFIX || 'simctl:',
      ttl_seconds: parseInt(process.env.REDIS_TTL || '3600'),
    },
    anvil: {
      binary_path: process.env.ANVIL_BINARY_PATH || '/usr/local/bin/anvil',
      data_dir: process.env.ANVIL_DATA_DIR || '/tmp/anvil-instances',
      max_instances: parseInt(process.env.ANVIL_MAX_INSTANCES || '10'),
      instance_timeout_seconds: parseInt(process.env.ANVIL_INSTANCE_TIMEOUT || '3600'),
      heartbeat_interval_ms: parseInt(process.env.ANVIL_HEARTBEAT_INTERVAL || '10000'),
      cleanup_interval_ms: parseInt(process.env.ANVIL_CLEANUP_INTERVAL || '60000'),
      port_range_start: parseInt(process.env.ANVIL_PORT_START || '8545'),
      port_range_end: parseInt(process.env.ANVIL_PORT_END || '8595'),
      default_chain_id: parseInt(process.env.ANVIL_DEFAULT_CHAIN_ID || '31337'),
    },
    simulation: {
      max_execution_time_ms: parseInt(process.env.SIM_MAX_EXECUTION_TIME || '5000'),
      default_gas_limit: parseInt(process.env.SIM_DEFAULT_GAS_LIMIT || '30000000'),
      default_gas_price: process.env.SIM_DEFAULT_GAS_PRICE || '20000000000',
      max_slippage: parseFloat(process.env.SIM_MAX_SLIPPAGE || '0.05'),
      profit_threshold_usd: parseFloat(process.env.SIM_PROFIT_THRESHOLD || '10'),
    },
    chains: {
      ethereum: {
        rpc_url: process.env.ETHEREUM_RPC_URL || 'https://eth-mainnet.alchemyapi.io/v2/YOUR-API-KEY',
        chain_id: parseInt(process.env.ETHEREUM_CHAIN_ID || '1'),
        native_token: process.env.ETHEREUM_NATIVE_TOKEN || 'ETH',
        block_time_seconds: parseFloat(process.env.ETHEREUM_BLOCK_TIME || '12'),
      },
      arbitrum: {
        rpc_url: process.env.ARBITRUM_RPC_URL || 'https://arb-mainnet.g.alchemy.com/v2/YOUR-API-KEY',
        chain_id: parseInt(process.env.ARBITRUM_CHAIN_ID || '42161'),
        native_token: process.env.ARBITRUM_NATIVE_TOKEN || 'ETH',
        block_time_seconds: parseFloat(process.env.ARBITRUM_BLOCK_TIME || '0.25'),
      },
      polygon: {
        rpc_url: process.env.POLYGON_RPC_URL || 'https://polygon-mainnet.g.alchemy.com/v2/YOUR-API-KEY',
        chain_id: parseInt(process.env.POLYGON_CHAIN_ID || '137'),
        native_token: process.env.POLYGON_NATIVE_TOKEN || 'MATIC',
        block_time_seconds: parseFloat(process.env.POLYGON_BLOCK_TIME || '2'),
      },
      bsc: {
        rpc_url: process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org',
        chain_id: parseInt(process.env.BSC_CHAIN_ID || '56'),
        native_token: process.env.BSC_NATIVE_TOKEN || 'BNB',
        block_time_seconds: parseFloat(process.env.BSC_BLOCK_TIME || '3'),
      },
    },
    real_only: {
      enabled: process.env.REAL_ONLY_ENABLED !== 'false',
      allowed_test_chains: (process.env.REAL_ONLY_ALLOWED_TEST_CHAINS || '31337,1337')
        .split(',').map(id => parseInt(id.trim())),
      block_mocks: process.env.REAL_ONLY_BLOCK_MOCKS !== 'false',
      require_real_rpcs: process.env.REAL_ONLY_REQUIRE_REAL_RPCS !== 'false',
      validate_chain_data: process.env.REAL_ONLY_VALIDATE_CHAIN_DATA !== 'false',
    },
    monitoring: {
      metrics_enabled: process.env.MONITORING_ENABLED !== 'false',
      prometheus_port: parseInt(process.env.PROMETHEUS_PORT || '9093'),
      health_check_interval_ms: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000'),
      alert_on_failure_count: parseInt(process.env.ALERT_FAILURE_COUNT || '3'),
    },
  };

  return ConfigSchema.parse(envConfig);
}

// =============================================================================
// EXPORTS
// =============================================================================

export const config = loadConfig();
export type Config = z.infer<typeof ConfigSchema>;
export { ConfigSchema };
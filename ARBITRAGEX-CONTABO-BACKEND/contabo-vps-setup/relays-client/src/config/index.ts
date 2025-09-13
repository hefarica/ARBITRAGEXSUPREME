import { z } from 'zod';

// =============================================================================
// ENVIRONMENT CONFIGURATION SCHEMA
// =============================================================================

const ConfigSchema = z.object({
  // Service Configuration
  service: z.object({
    name: z.string().default('relays-client'),
    version: z.string().default('3.0.0'),
    environment: z.enum(['development', 'production']).default('development'),
    port: z.number().int().min(1).max(65535).default(3004),
    host: z.string().default('0.0.0.0'),
    log_level: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  }),

  // Redis Configuration
  redis: z.object({
    url: z.string().url().default('redis://localhost:6379'),
    key_prefix: z.string().default('relays:'),
    ttl_seconds: z.number().int().positive().default(3600), // 1 hour
  }),

  // Ethereum Network Configuration
  ethereum: z.object({
    rpc_url: z.string().url(),
    chain_id: z.number().int().positive().default(1),
    gas_limit_multiplier: z.number().positive().default(1.2),
    gas_price_multiplier: z.number().positive().default(1.1),
    max_gas_price_gwei: z.number().positive().default(500), // 500 gwei max
    block_confirmation_threshold: z.number().int().positive().default(1),
  }),

  // Relay Providers Configuration
  relays: z.object({
    // Flashbots Configuration
    flashbots: z.object({
      enabled: z.boolean().default(true),
      relay_url: z.string().url().default('https://relay.flashbots.net'),
      signing_key: z.string().min(64), // 32 bytes hex
      reputation_key: z.string().min(1).optional(),
      max_bundle_size: z.number().int().min(1).max(50).default(10),
      timeout_ms: z.number().int().positive().default(30000),
      retry_attempts: z.number().int().min(0).max(10).default(3),
      min_bid_increment_wei: z.string().default('1000000000'), // 1 gwei
      bundle_simulation_enabled: z.boolean().default(true),
    }),

    // bloXroute Configuration
    bloxroute: z.object({
      enabled: z.boolean().default(true),
      api_url: z.string().url().default('https://mev.api.blxrbdn.com'),
      auth_header: z.string().min(1), // Authorization header value
      max_bundle_size: z.number().int().min(1).max(50).default(15),
      timeout_ms: z.number().int().positive().default(25000),
      retry_attempts: z.number().int().min(0).max(10).default(2),
      profit_threshold_wei: z.string().default('10000000000000000'), // 0.01 ETH
    }),

    // Eden Network Configuration
    eden: z.object({
      enabled: z.boolean().default(true),
      rpc_url: z.string().url().default('https://api.edennetwork.io/v1/rpc'),
      slot_url: z.string().url().default('https://api.edennetwork.io/v1/slots'),
      api_key: z.string().min(1),
      max_bundle_size: z.number().int().min(1).max(50).default(8),
      timeout_ms: z.number().int().positive().default(20000),
      retry_attempts: z.number().int().min(0).max(10).default(2),
      staking_token: z.string().default('EDEN'),
      min_stake_amount: z.string().default('100000000000000000000'), // 100 EDEN
    }),

    // Manifold Finance Configuration (Additional Relay)
    manifold: z.object({
      enabled: z.boolean().default(false),
      api_url: z.string().url().default('https://api.manifoldfinance.com/v1'),
      api_key: z.string().min(1).optional(),
      max_bundle_size: z.number().int().min(1).max(50).default(12),
      timeout_ms: z.number().int().positive().default(22000),
      retry_attempts: z.number().int().min(0).max(10).default(2),
    }),
  }),

  // Bundle Management Configuration
  bundles: z.object({
    max_concurrent_bundles: z.number().int().min(1).max(1000).default(100),
    bundle_ttl_seconds: z.number().int().positive().default(300), // 5 minutes
    auto_resubmission_enabled: z.boolean().default(true),
    max_resubmission_attempts: z.number().int().min(0).max(20).default(5),
    profit_threshold_usd: z.number().positive().default(50), // $50 minimum
    gas_price_buffer_percentage: z.number().min(0).max(100).default(10), // 10% buffer
  }),

  // Real-Only Policy Configuration
  real_only: z.object({
    enabled: z.boolean().default(true),
    allowed_test_chains: z.array(z.number()).default([31337, 1337]), // Local test chains
    block_simulation_mode: z.boolean().default(false),
    require_signed_transactions: z.boolean().default(true),
    validate_relay_endpoints: z.boolean().default(true),
    enforce_mainnet_only: z.boolean().default(true),
  }),

  // Monitoring Configuration
  monitoring: z.object({
    metrics_enabled: z.boolean().default(true),
    prometheus_port: z.number().int().min(1).max(65535).default(9094),
    health_check_interval_ms: z.number().int().positive().default(30000), // 30 seconds
    bundle_tracking_enabled: z.boolean().default(true),
    relay_performance_tracking: z.boolean().default(true),
    alert_on_failure_rate: z.number().min(0).max(1).default(0.5), // 50% failure rate
    alert_on_low_inclusion_rate: z.number().min(0).max(1).default(0.1), // 10% inclusion rate
  }),

  // Security Configuration
  security: z.object({
    max_bundle_value_eth: z.number().positive().default(1000), // 1000 ETH max
    require_bundle_simulation: z.boolean().default(true),
    signing_key_rotation_enabled: z.boolean().default(false),
    rate_limit_per_minute: z.number().int().positive().default(100),
    whitelist_enabled: z.boolean().default(false),
    allowed_contract_addresses: z.array(z.string()).default([]),
  }),
});

// =============================================================================
// CONFIGURATION LOADER
// =============================================================================

function loadConfig(): z.infer<typeof ConfigSchema> {
  const envConfig = {
    service: {
      name: process.env.RELAYS_CLIENT_NAME || 'relays-client',
      version: process.env.RELAYS_CLIENT_VERSION || '3.0.0',
      environment: process.env.NODE_ENV || 'development',
      port: parseInt(process.env.RELAYS_CLIENT_PORT || '3004'),
      host: process.env.RELAYS_CLIENT_HOST || '0.0.0.0',
      log_level: process.env.LOG_LEVEL || 'info',
    },
    redis: {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      key_prefix: process.env.REDIS_KEY_PREFIX || 'relays:',
      ttl_seconds: parseInt(process.env.REDIS_TTL || '3600'),
    },
    ethereum: {
      rpc_url: process.env.ETHEREUM_RPC_URL || 'https://eth-mainnet.alchemyapi.io/v2/YOUR-API-KEY',
      chain_id: parseInt(process.env.ETHEREUM_CHAIN_ID || '1'),
      gas_limit_multiplier: parseFloat(process.env.GAS_LIMIT_MULTIPLIER || '1.2'),
      gas_price_multiplier: parseFloat(process.env.GAS_PRICE_MULTIPLIER || '1.1'),
      max_gas_price_gwei: parseFloat(process.env.MAX_GAS_PRICE_GWEI || '500'),
      block_confirmation_threshold: parseInt(process.env.BLOCK_CONFIRMATION_THRESHOLD || '1'),
    },
    relays: {
      flashbots: {
        enabled: process.env.FLASHBOTS_ENABLED !== 'false',
        relay_url: process.env.FLASHBOTS_RELAY_URL || 'https://relay.flashbots.net',
        signing_key: process.env.FLASHBOTS_SIGNING_KEY || '',
        reputation_key: process.env.FLASHBOTS_REPUTATION_KEY,
        max_bundle_size: parseInt(process.env.FLASHBOTS_MAX_BUNDLE_SIZE || '10'),
        timeout_ms: parseInt(process.env.FLASHBOTS_TIMEOUT || '30000'),
        retry_attempts: parseInt(process.env.FLASHBOTS_RETRY_ATTEMPTS || '3'),
        min_bid_increment_wei: process.env.FLASHBOTS_MIN_BID_INCREMENT || '1000000000',
        bundle_simulation_enabled: process.env.FLASHBOTS_SIMULATION_ENABLED !== 'false',
      },
      bloxroute: {
        enabled: process.env.BLOXROUTE_ENABLED !== 'false',
        api_url: process.env.BLOXROUTE_API_URL || 'https://mev.api.blxrbdn.com',
        auth_header: process.env.BLOXROUTE_AUTH_HEADER || '',
        max_bundle_size: parseInt(process.env.BLOXROUTE_MAX_BUNDLE_SIZE || '15'),
        timeout_ms: parseInt(process.env.BLOXROUTE_TIMEOUT || '25000'),
        retry_attempts: parseInt(process.env.BLOXROUTE_RETRY_ATTEMPTS || '2'),
        profit_threshold_wei: process.env.BLOXROUTE_PROFIT_THRESHOLD || '10000000000000000',
      },
      eden: {
        enabled: process.env.EDEN_ENABLED !== 'false',
        rpc_url: process.env.EDEN_RPC_URL || 'https://api.edennetwork.io/v1/rpc',
        slot_url: process.env.EDEN_SLOT_URL || 'https://api.edennetwork.io/v1/slots',
        api_key: process.env.EDEN_API_KEY || '',
        max_bundle_size: parseInt(process.env.EDEN_MAX_BUNDLE_SIZE || '8'),
        timeout_ms: parseInt(process.env.EDEN_TIMEOUT || '20000'),
        retry_attempts: parseInt(process.env.EDEN_RETRY_ATTEMPTS || '2'),
        staking_token: process.env.EDEN_STAKING_TOKEN || 'EDEN',
        min_stake_amount: process.env.EDEN_MIN_STAKE_AMOUNT || '100000000000000000000',
      },
      manifold: {
        enabled: process.env.MANIFOLD_ENABLED === 'true',
        api_url: process.env.MANIFOLD_API_URL || 'https://api.manifoldfinance.com/v1',
        api_key: process.env.MANIFOLD_API_KEY,
        max_bundle_size: parseInt(process.env.MANIFOLD_MAX_BUNDLE_SIZE || '12'),
        timeout_ms: parseInt(process.env.MANIFOLD_TIMEOUT || '22000'),
        retry_attempts: parseInt(process.env.MANIFOLD_RETRY_ATTEMPTS || '2'),
      },
    },
    bundles: {
      max_concurrent_bundles: parseInt(process.env.MAX_CONCURRENT_BUNDLES || '100'),
      bundle_ttl_seconds: parseInt(process.env.BUNDLE_TTL_SECONDS || '300'),
      auto_resubmission_enabled: process.env.AUTO_RESUBMISSION_ENABLED !== 'false',
      max_resubmission_attempts: parseInt(process.env.MAX_RESUBMISSION_ATTEMPTS || '5'),
      profit_threshold_usd: parseFloat(process.env.PROFIT_THRESHOLD_USD || '50'),
      gas_price_buffer_percentage: parseFloat(process.env.GAS_PRICE_BUFFER_PERCENTAGE || '10'),
    },
    real_only: {
      enabled: process.env.REAL_ONLY_ENABLED !== 'false',
      allowed_test_chains: (process.env.REAL_ONLY_ALLOWED_TEST_CHAINS || '31337,1337')
        .split(',').map(id => parseInt(id.trim())),
      block_simulation_mode: process.env.REAL_ONLY_BLOCK_SIMULATION === 'true',
      require_signed_transactions: process.env.REAL_ONLY_REQUIRE_SIGNED !== 'false',
      validate_relay_endpoints: process.env.REAL_ONLY_VALIDATE_ENDPOINTS !== 'false',
      enforce_mainnet_only: process.env.REAL_ONLY_ENFORCE_MAINNET !== 'false',
    },
    monitoring: {
      metrics_enabled: process.env.MONITORING_ENABLED !== 'false',
      prometheus_port: parseInt(process.env.PROMETHEUS_PORT || '9094'),
      health_check_interval_ms: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000'),
      bundle_tracking_enabled: process.env.BUNDLE_TRACKING_ENABLED !== 'false',
      relay_performance_tracking: process.env.RELAY_PERFORMANCE_TRACKING !== 'false',
      alert_on_failure_rate: parseFloat(process.env.ALERT_FAILURE_RATE || '0.5'),
      alert_on_low_inclusion_rate: parseFloat(process.env.ALERT_LOW_INCLUSION_RATE || '0.1'),
    },
    security: {
      max_bundle_value_eth: parseFloat(process.env.MAX_BUNDLE_VALUE_ETH || '1000'),
      require_bundle_simulation: process.env.REQUIRE_BUNDLE_SIMULATION !== 'false',
      signing_key_rotation_enabled: process.env.SIGNING_KEY_ROTATION_ENABLED === 'true',
      rate_limit_per_minute: parseInt(process.env.RATE_LIMIT_PER_MINUTE || '100'),
      whitelist_enabled: process.env.WHITELIST_ENABLED === 'true',
      allowed_contract_addresses: (process.env.ALLOWED_CONTRACT_ADDRESSES || '')
        .split(',').map(addr => addr.trim()).filter(addr => addr.length > 0),
    },
  };

  return ConfigSchema.parse(envConfig);
}

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

export function validateRelayConfiguration(config: any): string[] {
  const errors: string[] = [];

  // Check if at least one relay is enabled
  const enabledRelays = Object.values(config.relays).filter((relay: any) => relay.enabled);
  if (enabledRelays.length === 0) {
    errors.push('At least one relay provider must be enabled');
  }

  // Validate Flashbots configuration
  if (config.relays.flashbots.enabled && !config.relays.flashbots.signing_key) {
    errors.push('Flashbots signing key is required when Flashbots is enabled');
  }

  // Validate bloXroute configuration
  if (config.relays.bloxroute.enabled && !config.relays.bloxroute.auth_header) {
    errors.push('bloXroute auth header is required when bloXroute is enabled');
  }

  // Validate Eden configuration
  if (config.relays.eden.enabled && !config.relays.eden.api_key) {
    errors.push('Eden API key is required when Eden is enabled');
  }

  // Validate Ethereum RPC
  if (!config.ethereum.rpc_url || config.ethereum.rpc_url.includes('YOUR-API-KEY')) {
    errors.push('Valid Ethereum RPC URL is required');
  }

  // Validate Real-Only Policy compliance
  if (config.real_only.enabled && config.real_only.enforce_mainnet_only) {
    if (config.ethereum.chain_id !== 1) {
      errors.push('Real-Only Policy requires mainnet (chain_id: 1) when enforce_mainnet_only is true');
    }
  }

  return errors;
}

// =============================================================================
// EXPORTS
// =============================================================================

export const config = loadConfig();
export type Config = z.infer<typeof ConfigSchema>;
export { ConfigSchema };
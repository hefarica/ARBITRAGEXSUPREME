import { z } from 'zod';

// =============================================================================
// ENVIRONMENT CONFIGURATION SCHEMA
// =============================================================================

const ConfigSchema = z.object({
  // Service Configuration
  service: z.object({
    name: z.string().default('recon'),
    version: z.string().default('3.0.0'),
    environment: z.enum(['development', 'production']).default('development'),
    port: z.number().int().min(1).max(65535).default(3005),
    host: z.string().default('0.0.0.0'),
    log_level: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  }),

  // Database Configuration
  database: z.object({
    host: z.string().default('localhost'),
    port: z.number().int().min(1).max(65535).default(5432),
    database: z.string().default('arbitragex_recon'),
    username: z.string().default('postgres'),
    password: z.string().min(1),
    ssl: z.boolean().default(false),
    max_connections: z.number().int().min(1).max(100).default(20),
    idle_timeout_ms: z.number().int().positive().default(30000),
    connection_timeout_ms: z.number().int().positive().default(10000),
  }),

  // Redis Configuration
  redis: z.object({
    url: z.string().url().default('redis://localhost:6379'),
    key_prefix: z.string().default('recon:'),
    ttl_seconds: z.number().int().positive().default(3600), // 1 hour
  }),

  // Reconciliation Configuration
  reconciliation: z.object({
    // Thresholds
    default_profit_threshold_percentage: z.number().positive().default(5), // 5%
    default_gas_threshold_percentage: z.number().positive().default(10), // 10%
    critical_variance_threshold_percentage: z.number().positive().default(50), // 50%
    
    // Processing settings
    auto_reconciliation_enabled: z.boolean().default(true),
    reconciliation_delay_ms: z.number().int().positive().default(30000), // 30 seconds
    batch_processing_enabled: z.boolean().default(true),
    batch_size: z.number().int().min(1).max(1000).default(100),
    batch_interval_ms: z.number().int().positive().default(60000), // 1 minute
    
    // Investigation triggers
    auto_investigation_enabled: z.boolean().default(true),
    investigation_threshold_usd: z.number().positive().default(100), // $100
    investigation_variance_threshold: z.number().positive().default(20), // 20%
    
    // Data retention
    event_retention_days: z.number().int().positive().default(365), // 1 year
    reconciliation_retention_days: z.number().int().positive().default(730), // 2 years
    investigation_retention_days: z.number().int().positive().default(1095), // 3 years
  }),

  // Price Feed Configuration
  price_feeds: z.object({
    eth_price_source: z.enum(['coingecko', 'chainlink', 'uniswap_v3', 'manual']).default('coingecko'),
    update_interval_ms: z.number().int().positive().default(60000), // 1 minute
    price_deviation_threshold: z.number().min(0).max(1).default(0.05), // 5%
    fallback_sources: z.array(z.enum(['coingecko', 'chainlink', 'uniswap_v3'])).default(['chainlink', 'uniswap_v3']),
    
    // External API configuration
    coingecko_api_key: z.string().optional(),
    chainlink_rpc_url: z.string().url().optional(),
    uniswap_subgraph_url: z.string().url().optional(),
  }),

  // External Services Configuration
  external_services: z.object({
    // Integration with other ArbitrageX components
    sim_ctl_url: z.string().url().default('http://sim-ctl:3003'),
    relays_client_url: z.string().url().default('http://relays-client:3004'),
    searcher_rs_url: z.string().url().default('http://searcher-rs:8080'),
    
    // API timeouts
    service_timeout_ms: z.number().int().positive().default(30000),
    retry_attempts: z.number().int().min(0).max(10).default(3),
    retry_delay_ms: z.number().int().positive().default(5000),
    
    // Health check settings
    health_check_interval_ms: z.number().int().positive().default(60000), // 1 minute
    service_availability_threshold: z.number().min(0).max(1).default(0.9), // 90%
  }),

  // Real-Only Policy Configuration
  real_only: z.object({
    enabled: z.boolean().default(true),
    allowed_test_chains: z.array(z.number()).default([31337, 1337]),
    require_real_prices: z.boolean().default(true),
    validate_transaction_hashes: z.boolean().default(true),
    block_synthetic_events: z.boolean().default(true),
    enforce_mainnet_only: z.boolean().default(true),
  }),

  // Monitoring Configuration
  monitoring: z.object({
    metrics_enabled: z.boolean().default(true),
    prometheus_port: z.number().int().min(1).max(65535).default(9095),
    
    // Alert thresholds
    reconciliation_rate_threshold: z.number().min(0).max(1).default(0.95), // 95%
    variance_rate_threshold: z.number().min(0).max(1).default(0.1), // 10%
    processing_latency_threshold_ms: z.number().int().positive().default(5000), // 5 seconds
    error_rate_threshold: z.number().min(0).max(1).default(0.05), // 5%
    
    // Health monitoring
    health_check_interval_ms: z.number().int().positive().default(30000), // 30 seconds
    system_health_components: z.array(z.string()).default(['database', 'redis', 'price_feeds', 'external_services']),
  }),

  // Security Configuration
  security: z.object({
    api_rate_limit_per_minute: z.number().int().positive().default(1000),
    require_api_key: z.boolean().default(false),
    api_key: z.string().optional(),
    trusted_sources: z.array(z.string()).default(['sim-ctl', 'relays-client', 'searcher-rs']),
    data_encryption_enabled: z.boolean().default(false),
    audit_log_enabled: z.boolean().default(true),
  }),

  // Performance Configuration
  performance: z.object({
    // Caching
    enable_event_caching: z.boolean().default(true),
    cache_ttl_seconds: z.number().int().positive().default(300), // 5 minutes
    
    // Database optimization
    enable_connection_pooling: z.boolean().default(true),
    query_timeout_ms: z.number().int().positive().default(30000),
    enable_query_optimization: z.boolean().default(true),
    
    // Processing optimization
    parallel_processing_enabled: z.boolean().default(true),
    max_concurrent_reconciliations: z.number().int().min(1).max(100).default(10),
    background_processing_enabled: z.boolean().default(true),
  }),

  // Notification Configuration
  notifications: z.object({
    enabled: z.boolean().default(true),
    
    // Slack integration
    slack_webhook_url: z.string().url().optional(),
    slack_channel: z.string().default('#arbitragex-alerts'),
    
    // Email integration
    email_enabled: z.boolean().default(false),
    smtp_host: z.string().optional(),
    smtp_port: z.number().int().min(1).max(65535).default(587),
    smtp_username: z.string().optional(),
    smtp_password: z.string().optional(),
    alert_email_recipients: z.array(z.string()).default([]),
    
    // Alert thresholds for notifications
    critical_variance_notification: z.boolean().default(true),
    investigation_required_notification: z.boolean().default(true),
    system_health_notification: z.boolean().default(true),
  }),
});

// =============================================================================
// CONFIGURATION LOADER
// =============================================================================

function loadConfig(): z.infer<typeof ConfigSchema> {
  const envConfig = {
    service: {
      name: process.env.RECON_NAME || 'recon',
      version: process.env.RECON_VERSION || '3.0.0',
      environment: process.env.NODE_ENV || 'development',
      port: parseInt(process.env.RECON_PORT || '3005'),
      host: process.env.RECON_HOST || '0.0.0.0',
      log_level: process.env.LOG_LEVEL || 'info',
    },
    database: {
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      database: process.env.POSTGRES_DB || 'arbitragex_recon',
      username: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || '',
      ssl: process.env.POSTGRES_SSL === 'true',
      max_connections: parseInt(process.env.POSTGRES_MAX_CONNECTIONS || '20'),
      idle_timeout_ms: parseInt(process.env.POSTGRES_IDLE_TIMEOUT || '30000'),
      connection_timeout_ms: parseInt(process.env.POSTGRES_CONNECTION_TIMEOUT || '10000'),
    },
    redis: {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      key_prefix: process.env.REDIS_KEY_PREFIX || 'recon:',
      ttl_seconds: parseInt(process.env.REDIS_TTL || '3600'),
    },
    reconciliation: {
      default_profit_threshold_percentage: parseFloat(process.env.DEFAULT_PROFIT_THRESHOLD || '5'),
      default_gas_threshold_percentage: parseFloat(process.env.DEFAULT_GAS_THRESHOLD || '10'),
      critical_variance_threshold_percentage: parseFloat(process.env.CRITICAL_VARIANCE_THRESHOLD || '50'),
      
      auto_reconciliation_enabled: process.env.AUTO_RECONCILIATION_ENABLED !== 'false',
      reconciliation_delay_ms: parseInt(process.env.RECONCILIATION_DELAY || '30000'),
      batch_processing_enabled: process.env.BATCH_PROCESSING_ENABLED !== 'false',
      batch_size: parseInt(process.env.BATCH_SIZE || '100'),
      batch_interval_ms: parseInt(process.env.BATCH_INTERVAL || '60000'),
      
      auto_investigation_enabled: process.env.AUTO_INVESTIGATION_ENABLED !== 'false',
      investigation_threshold_usd: parseFloat(process.env.INVESTIGATION_THRESHOLD_USD || '100'),
      investigation_variance_threshold: parseFloat(process.env.INVESTIGATION_VARIANCE_THRESHOLD || '20'),
      
      event_retention_days: parseInt(process.env.EVENT_RETENTION_DAYS || '365'),
      reconciliation_retention_days: parseInt(process.env.RECONCILIATION_RETENTION_DAYS || '730'),
      investigation_retention_days: parseInt(process.env.INVESTIGATION_RETENTION_DAYS || '1095'),
    },
    price_feeds: {
      eth_price_source: process.env.ETH_PRICE_SOURCE || 'coingecko',
      update_interval_ms: parseInt(process.env.PRICE_UPDATE_INTERVAL || '60000'),
      price_deviation_threshold: parseFloat(process.env.PRICE_DEVIATION_THRESHOLD || '0.05'),
      fallback_sources: (process.env.PRICE_FALLBACK_SOURCES || 'chainlink,uniswap_v3').split(','),
      
      coingecko_api_key: process.env.COINGECKO_API_KEY,
      chainlink_rpc_url: process.env.CHAINLINK_RPC_URL,
      uniswap_subgraph_url: process.env.UNISWAP_SUBGRAPH_URL,
    },
    external_services: {
      sim_ctl_url: process.env.SIM_CTL_URL || 'http://sim-ctl:3003',
      relays_client_url: process.env.RELAYS_CLIENT_URL || 'http://relays-client:3004',
      searcher_rs_url: process.env.SEARCHER_RS_URL || 'http://searcher-rs:8080',
      
      service_timeout_ms: parseInt(process.env.SERVICE_TIMEOUT || '30000'),
      retry_attempts: parseInt(process.env.RETRY_ATTEMPTS || '3'),
      retry_delay_ms: parseInt(process.env.RETRY_DELAY || '5000'),
      
      health_check_interval_ms: parseInt(process.env.HEALTH_CHECK_INTERVAL || '60000'),
      service_availability_threshold: parseFloat(process.env.SERVICE_AVAILABILITY_THRESHOLD || '0.9'),
    },
    real_only: {
      enabled: process.env.REAL_ONLY_ENABLED !== 'false',
      allowed_test_chains: (process.env.REAL_ONLY_ALLOWED_TEST_CHAINS || '31337,1337')
        .split(',').map(id => parseInt(id.trim())),
      require_real_prices: process.env.REAL_ONLY_REQUIRE_REAL_PRICES !== 'false',
      validate_transaction_hashes: process.env.REAL_ONLY_VALIDATE_TX_HASHES !== 'false',
      block_synthetic_events: process.env.REAL_ONLY_BLOCK_SYNTHETIC !== 'false',
      enforce_mainnet_only: process.env.REAL_ONLY_ENFORCE_MAINNET !== 'false',
    },
    monitoring: {
      metrics_enabled: process.env.MONITORING_ENABLED !== 'false',
      prometheus_port: parseInt(process.env.PROMETHEUS_PORT || '9095'),
      
      reconciliation_rate_threshold: parseFloat(process.env.RECONCILIATION_RATE_THRESHOLD || '0.95'),
      variance_rate_threshold: parseFloat(process.env.VARIANCE_RATE_THRESHOLD || '0.1'),
      processing_latency_threshold_ms: parseInt(process.env.PROCESSING_LATENCY_THRESHOLD || '5000'),
      error_rate_threshold: parseFloat(process.env.ERROR_RATE_THRESHOLD || '0.05'),
      
      health_check_interval_ms: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30000'),
      system_health_components: (process.env.SYSTEM_HEALTH_COMPONENTS || 'database,redis,price_feeds,external_services').split(','),
    },
    security: {
      api_rate_limit_per_minute: parseInt(process.env.API_RATE_LIMIT || '1000'),
      require_api_key: process.env.REQUIRE_API_KEY === 'true',
      api_key: process.env.API_KEY,
      trusted_sources: (process.env.TRUSTED_SOURCES || 'sim-ctl,relays-client,searcher-rs').split(','),
      data_encryption_enabled: process.env.DATA_ENCRYPTION_ENABLED === 'true',
      audit_log_enabled: process.env.AUDIT_LOG_ENABLED !== 'false',
    },
    performance: {
      enable_event_caching: process.env.ENABLE_EVENT_CACHING !== 'false',
      cache_ttl_seconds: parseInt(process.env.CACHE_TTL_SECONDS || '300'),
      
      enable_connection_pooling: process.env.ENABLE_CONNECTION_POOLING !== 'false',
      query_timeout_ms: parseInt(process.env.QUERY_TIMEOUT || '30000'),
      enable_query_optimization: process.env.ENABLE_QUERY_OPTIMIZATION !== 'false',
      
      parallel_processing_enabled: process.env.PARALLEL_PROCESSING_ENABLED !== 'false',
      max_concurrent_reconciliations: parseInt(process.env.MAX_CONCURRENT_RECONCILIATIONS || '10'),
      background_processing_enabled: process.env.BACKGROUND_PROCESSING_ENABLED !== 'false',
    },
    notifications: {
      enabled: process.env.NOTIFICATIONS_ENABLED !== 'false',
      
      slack_webhook_url: process.env.SLACK_WEBHOOK_URL,
      slack_channel: process.env.SLACK_CHANNEL || '#arbitragex-alerts',
      
      email_enabled: process.env.EMAIL_ENABLED === 'true',
      smtp_host: process.env.SMTP_HOST,
      smtp_port: parseInt(process.env.SMTP_PORT || '587'),
      smtp_username: process.env.SMTP_USERNAME,
      smtp_password: process.env.SMTP_PASSWORD,
      alert_email_recipients: (process.env.ALERT_EMAIL_RECIPIENTS || '').split(',').filter(email => email.length > 0),
      
      critical_variance_notification: process.env.CRITICAL_VARIANCE_NOTIFICATION !== 'false',
      investigation_required_notification: process.env.INVESTIGATION_REQUIRED_NOTIFICATION !== 'false',
      system_health_notification: process.env.SYSTEM_HEALTH_NOTIFICATION !== 'false',
    },
  };

  return ConfigSchema.parse(envConfig);
}

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

export function validateReconConfiguration(config: any): string[] {
  const errors: string[] = [];

  // Validate database connection
  if (!config.database.password) {
    errors.push('Database password is required');
  }

  // Validate price feed configuration
  if (config.price_feeds.eth_price_source === 'coingecko' && !config.price_feeds.coingecko_api_key) {
    errors.push('CoinGecko API key is required when using CoinGecko as price source');
  }

  // Validate notification configuration
  if (config.notifications.enabled) {
    if (!config.notifications.slack_webhook_url && !config.notifications.email_enabled) {
      errors.push('At least one notification method (Slack or email) must be configured when notifications are enabled');
    }
    
    if (config.notifications.email_enabled) {
      if (!config.notifications.smtp_host || !config.notifications.smtp_username || !config.notifications.smtp_password) {
        errors.push('SMTP configuration is incomplete for email notifications');
      }
    }
  }

  // Validate Real-Only Policy compliance
  if (config.real_only.enabled && config.real_only.enforce_mainnet_only) {
    // Additional mainnet-specific validations would go here
  }

  // Validate performance settings
  if (config.performance.max_concurrent_reconciliations > config.database.max_connections) {
    errors.push('max_concurrent_reconciliations cannot exceed database max_connections');
  }

  return errors;
}

// =============================================================================
// EXPORTS
// =============================================================================

export const config = loadConfig();
export type Config = z.infer<typeof ConfigSchema>;
export { ConfigSchema };
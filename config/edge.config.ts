/**
 * ArbitrageX Supreme V3.0 - Edge Configuration
 * Centralized configuration management for Cloudflare Workers
 */

export interface EdgeConfig {
  // Environment
  environment: 'development' | 'staging' | 'production';
  version: string;
  
  // API Configuration
  api: {
    baseUrl: string;
    timeout: number;
    retries: number;
    retryDelay: number;
  };
  
  // Backend Services
  backend: {
    contaboUrl: string;
    healthCheckPath: string;
    timeout: number;
    maxRetries: number;
  };
  
  // Rate Limiting
  rateLimit: {
    enabled: boolean;
    windowSize: number; // seconds
    maxRequests: number;
    penaltyDuration: number; // seconds
  };
  
  // Caching
  cache: {
    enabled: boolean;
    defaultTtl: number; // seconds
    maxSize: number;
    compressionThreshold: number; // bytes
  };
  
  // Security
  security: {
    enableJWT: boolean;
    enableAPIKey: boolean;
    enableThreatDetection: boolean;
    enableCSRF: boolean;
    maxRequestSize: number; // bytes
    allowedOrigins: string[];
  };
  
  // Monitoring
  monitoring: {
    enabled: boolean;
    metricsInterval: number; // seconds
    healthCheckInterval: number; // seconds
    alertThresholds: {
      errorRate: number;
      responseTime: number;
      requestVolume: number;
    };
  };
  
  // Load Balancing
  loadBalancer: {
    algorithm: 'round-robin' | 'weighted' | 'least-connections' | 'health-based';
    healthCheckTimeout: number;
    servers: Array<{
      id: string;
      url: string;
      weight: number;
    }>;
  };
  
  // WebSocket
  websocket: {
    enabled: boolean;
    maxConnections: number;
    heartbeatInterval: number; // seconds
    connectionTimeout: number; // seconds
  };
  
  // Logging
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    enableConsole: boolean;
    enableRemote: boolean;
    remoteEndpoint?: string;
  };
  
  // Features
  features: {
    enableAnalytics: boolean;
    enableRealTimeUpdates: boolean;
    enableAdvancedCaching: boolean;
    enableGeoRouting: boolean;
  };
}

/**
 * Development configuration
 */
export const DEVELOPMENT_CONFIG: EdgeConfig = {
  environment: 'development',
  version: '3.0.0-dev',
  
  api: {
    baseUrl: 'http://localhost:8000',
    timeout: 30000,
    retries: 3,
    retryDelay: 1000
  },
  
  backend: {
    contaboUrl: 'http://localhost:8000',
    healthCheckPath: '/health',
    timeout: 5000,
    maxRetries: 3
  },
  
  rateLimit: {
    enabled: false, // Disabled for development
    windowSize: 60,
    maxRequests: 1000,
    penaltyDuration: 300
  },
  
  cache: {
    enabled: true,
    defaultTtl: 300, // 5 minutes
    maxSize: 1000,
    compressionThreshold: 1024
  },
  
  security: {
    enableJWT: false, // Relaxed for development
    enableAPIKey: false,
    enableThreatDetection: false,
    enableCSRF: false,
    maxRequestSize: 10 * 1024 * 1024, // 10MB
    allowedOrigins: ['*'] // Allow all origins in development
  },
  
  monitoring: {
    enabled: true,
    metricsInterval: 60,
    healthCheckInterval: 30,
    alertThresholds: {
      errorRate: 0.1, // 10%
      responseTime: 2000, // 2 seconds
      requestVolume: 1000
    }
  },
  
  loadBalancer: {
    algorithm: 'round-robin',
    healthCheckTimeout: 5000,
    servers: [
      {
        id: 'dev-backend-1',
        url: 'http://localhost:8000',
        weight: 1
      }
    ]
  },
  
  websocket: {
    enabled: true,
    maxConnections: 100,
    heartbeatInterval: 30,
    connectionTimeout: 60
  },
  
  logging: {
    level: 'debug',
    enableConsole: true,
    enableRemote: false
  },
  
  features: {
    enableAnalytics: true,
    enableRealTimeUpdates: true,
    enableAdvancedCaching: true,
    enableGeoRouting: false
  }
};

/**
 * Staging configuration
 */
export const STAGING_CONFIG: EdgeConfig = {
  environment: 'staging',
  version: '3.0.0-staging',
  
  api: {
    baseUrl: 'https://staging-api.arbitragex.app',
    timeout: 30000,
    retries: 3,
    retryDelay: 1000
  },
  
  backend: {
    contaboUrl: 'https://staging-backend.arbitragex.app',
    healthCheckPath: '/health',
    timeout: 5000,
    maxRetries: 3
  },
  
  rateLimit: {
    enabled: true,
    windowSize: 60,
    maxRequests: 500,
    penaltyDuration: 300
  },
  
  cache: {
    enabled: true,
    defaultTtl: 600, // 10 minutes
    maxSize: 5000,
    compressionThreshold: 1024
  },
  
  security: {
    enableJWT: true,
    enableAPIKey: true,
    enableThreatDetection: true,
    enableCSRF: true,
    maxRequestSize: 5 * 1024 * 1024, // 5MB
    allowedOrigins: [
      'https://staging.arbitragex.app',
      'https://staging-dashboard.arbitragex.app'
    ]
  },
  
  monitoring: {
    enabled: true,
    metricsInterval: 30,
    healthCheckInterval: 15,
    alertThresholds: {
      errorRate: 0.05, // 5%
      responseTime: 1500, // 1.5 seconds
      requestVolume: 2000
    }
  },
  
  loadBalancer: {
    algorithm: 'health-based',
    healthCheckTimeout: 5000,
    servers: [
      {
        id: 'staging-backend-1',
        url: 'https://staging-backend-1.arbitragex.app',
        weight: 1
      },
      {
        id: 'staging-backend-2',
        url: 'https://staging-backend-2.arbitragex.app',
        weight: 1
      }
    ]
  },
  
  websocket: {
    enabled: true,
    maxConnections: 500,
    heartbeatInterval: 30,
    connectionTimeout: 60
  },
  
  logging: {
    level: 'info',
    enableConsole: true,
    enableRemote: true,
    remoteEndpoint: 'https://logs.arbitragex.app/staging'
  },
  
  features: {
    enableAnalytics: true,
    enableRealTimeUpdates: true,
    enableAdvancedCaching: true,
    enableGeoRouting: true
  }
};

/**
 * Production configuration
 */
export const PRODUCTION_CONFIG: EdgeConfig = {
  environment: 'production',
  version: '3.0.0',
  
  api: {
    baseUrl: 'https://api.arbitragex.app',
    timeout: 30000,
    retries: 5,
    retryDelay: 2000
  },
  
  backend: {
    contaboUrl: 'https://backend.arbitragex.app',
    healthCheckPath: '/health',
    timeout: 5000,
    maxRetries: 5
  },
  
  rateLimit: {
    enabled: true,
    windowSize: 60,
    maxRequests: 100,
    penaltyDuration: 600
  },
  
  cache: {
    enabled: true,
    defaultTtl: 1800, // 30 minutes
    maxSize: 10000,
    compressionThreshold: 512
  },
  
  security: {
    enableJWT: true,
    enableAPIKey: true,
    enableThreatDetection: true,
    enableCSRF: true,
    maxRequestSize: 2 * 1024 * 1024, // 2MB
    allowedOrigins: [
      'https://arbitragex.app',
      'https://www.arbitragex.app',
      'https://dashboard.arbitragex.app'
    ]
  },
  
  monitoring: {
    enabled: true,
    metricsInterval: 15,
    healthCheckInterval: 10,
    alertThresholds: {
      errorRate: 0.02, // 2%
      responseTime: 1000, // 1 second
      requestVolume: 5000
    }
  },
  
  loadBalancer: {
    algorithm: 'health-based',
    healthCheckTimeout: 3000,
    servers: [
      {
        id: 'prod-backend-1',
        url: 'https://backend-1.arbitragex.app',
        weight: 2
      },
      {
        id: 'prod-backend-2',
        url: 'https://backend-2.arbitragex.app',
        weight: 2
      },
      {
        id: 'prod-backend-3',
        url: 'https://backend-3.arbitragex.app',
        weight: 1
      }
    ]
  },
  
  websocket: {
    enabled: true,
    maxConnections: 2000,
    heartbeatInterval: 30,
    connectionTimeout: 60
  },
  
  logging: {
    level: 'warn',
    enableConsole: false,
    enableRemote: true,
    remoteEndpoint: 'https://logs.arbitragex.app/production'
  },
  
  features: {
    enableAnalytics: true,
    enableRealTimeUpdates: true,
    enableAdvancedCaching: true,
    enableGeoRouting: true
  }
};

/**
 * Get configuration based on environment
 */
export function getConfig(environment?: string): EdgeConfig {
  const env = environment || 'development';
  
  switch (env.toLowerCase()) {
    case 'production':
    case 'prod':
      return PRODUCTION_CONFIG;
    case 'staging':
    case 'stage':
      return STAGING_CONFIG;
    case 'development':
    case 'dev':
    default:
      return DEVELOPMENT_CONFIG;
  }
}

/**
 * Get configuration from environment variables
 */
export function getConfigFromEnv(env: any): EdgeConfig {
  const environment = env.ENVIRONMENT || 'development';
  const baseConfig = getConfig(environment);
  
  // Override with environment variables if present
  return {
    ...baseConfig,
    
    api: {
      ...baseConfig.api,
      baseUrl: env.API_BASE_URL || baseConfig.api.baseUrl,
      timeout: parseInt(env.API_TIMEOUT) || baseConfig.api.timeout,
      retries: parseInt(env.API_RETRIES) || baseConfig.api.retries
    },
    
    backend: {
      ...baseConfig.backend,
      contaboUrl: env.BACKEND_URL || baseConfig.backend.contaboUrl,
      timeout: parseInt(env.BACKEND_TIMEOUT) || baseConfig.backend.timeout
    },
    
    rateLimit: {
      ...baseConfig.rateLimit,
      enabled: env.RATE_LIMIT_ENABLED === 'true' || baseConfig.rateLimit.enabled,
      maxRequests: parseInt(env.RATE_LIMIT_MAX_REQUESTS) || baseConfig.rateLimit.maxRequests
    },
    
    security: {
      ...baseConfig.security,
      enableJWT: env.ENABLE_JWT === 'true' || baseConfig.security.enableJWT,
      enableAPIKey: env.ENABLE_API_KEY === 'true' || baseConfig.security.enableAPIKey,
      allowedOrigins: env.ALLOWED_ORIGINS ? 
        env.ALLOWED_ORIGINS.split(',').map((origin: string) => origin.trim()) : 
        baseConfig.security.allowedOrigins
    },
    
    monitoring: {
      ...baseConfig.monitoring,
      enabled: env.MONITORING_ENABLED === 'true' || baseConfig.monitoring.enabled
    },
    
    logging: {
      ...baseConfig.logging,
      level: env.LOG_LEVEL || baseConfig.logging.level,
      remoteEndpoint: env.LOG_REMOTE_ENDPOINT || baseConfig.logging.remoteEndpoint
    }
  };
}

/**
 * Validate configuration
 */
export function validateConfig(config: EdgeConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Validate API configuration
  if (!config.api.baseUrl) {
    errors.push('API base URL is required');
  }
  
  if (config.api.timeout <= 0) {
    errors.push('API timeout must be positive');
  }
  
  // Validate backend configuration
  if (!config.backend.contaboUrl) {
    errors.push('Backend URL is required');
  }
  
  // Validate rate limiting
  if (config.rateLimit.enabled) {
    if (config.rateLimit.maxRequests <= 0) {
      errors.push('Rate limit max requests must be positive');
    }
    
    if (config.rateLimit.windowSize <= 0) {
      errors.push('Rate limit window size must be positive');
    }
  }
  
  // Validate security
  if (config.security.allowedOrigins.length === 0) {
    errors.push('At least one allowed origin is required');
  }
  
  if (config.security.maxRequestSize <= 0) {
    errors.push('Max request size must be positive');
  }
  
  // Validate load balancer
  if (config.loadBalancer.servers.length === 0) {
    errors.push('At least one backend server is required');
  }
  
  config.loadBalancer.servers.forEach((server, index) => {
    if (!server.id) {
      errors.push(`Server ${index} is missing ID`);
    }
    
    if (!server.url) {
      errors.push(`Server ${index} is missing URL`);
    }
    
    if (server.weight <= 0) {
      errors.push(`Server ${index} weight must be positive`);
    }
  });
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get feature flags from configuration
 */
export function getFeatureFlags(config: EdgeConfig): Record<string, boolean> {
  return {
    analytics: config.features.enableAnalytics,
    realTimeUpdates: config.features.enableRealTimeUpdates,
    advancedCaching: config.features.enableAdvancedCaching,
    geoRouting: config.features.enableGeoRouting,
    rateLimit: config.rateLimit.enabled,
    security: config.security.enableJWT || config.security.enableAPIKey,
    monitoring: config.monitoring.enabled,
    websocket: config.websocket.enabled
  };
}

/**
 * Create configuration summary for debugging
 */
export function getConfigSummary(config: EdgeConfig): Record<string, any> {
  return {
    environment: config.environment,
    version: config.version,
    apiUrl: config.api.baseUrl,
    backendUrl: config.backend.contaboUrl,
    rateLimitEnabled: config.rateLimit.enabled,
    securityEnabled: config.security.enableJWT || config.security.enableAPIKey,
    monitoringEnabled: config.monitoring.enabled,
    cacheEnabled: config.cache.enabled,
    websocketEnabled: config.websocket.enabled,
    serverCount: config.loadBalancer.servers.length,
    features: getFeatureFlags(config)
  };
}

/**
 * Default export for easy importing
 */
export default {
  getConfig,
  getConfigFromEnv,
  validateConfig,
  getFeatureFlags,
  getConfigSummary,
  DEVELOPMENT_CONFIG,
  STAGING_CONFIG,
  PRODUCTION_CONFIG
};

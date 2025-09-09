/**
 * Recon Service Entry Point
 * 
 * Main entry point for the ArbitrageX Supreme V3.0 PnL Reconciliation System.
 * Implements Real-Only policy with comprehensive error handling and graceful shutdown.
 * 
 * Features:
 * - Graceful startup and shutdown
 * - Signal handling for container environments
 * - Health monitoring and metrics
 * - Comprehensive error logging
 */

import { ReconServer, createServerConfig } from './server';
import winston from 'winston';

/**
 * Process signal handlers for graceful shutdown
 */
let server: ReconServer | null = null;
let logger: winston.Logger;

/**
 * Initialize logger for application startup
 */
function initializeLogger(): winston.Logger {
  return winston.createLogger({
    level: process.env.RECON_LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      }),
      new winston.transports.File({ 
        filename: '/var/log/recon/startup.log',
        level: 'info'
      }),
      new winston.transports.File({ 
        filename: '/var/log/recon/error.log',
        level: 'error'
      })
    ]
  });
}

/**
 * Graceful shutdown handler
 */
async function gracefulShutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  
  if (server) {
    try {
      await server.stop();
      logger.info('Server shutdown completed');
    } catch (error) {
      logger.error('Error during server shutdown', {
        error: error instanceof Error ? error.message : String(error)
      });
      process.exit(1);
    }
  }
  
  process.exit(0);
}

/**
 * Unhandled error handlers
 */
function setupErrorHandlers(): void {
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('Unhandled Rejection', {
      reason: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined
    });
    process.exit(1);
  });
}

/**
 * Setup signal handlers for graceful shutdown
 */
function setupSignalHandlers(): void {
  const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT', 'SIGUSR1', 'SIGUSR2'];
  
  signals.forEach((signal) => {
    process.on(signal, () => {
      gracefulShutdown(signal).catch((error) => {
        logger.error('Graceful shutdown failed', {
          signal,
          error: error instanceof Error ? error.message : String(error)
        });
        process.exit(1);
      });
    });
  });
}

/**
 * Validate environment configuration
 */
function validateEnvironment(): boolean {
  const requiredEnvVars = [
    'POSTGRES_HOST',
    'POSTGRES_DB',
    'POSTGRES_USER',
    'POSTGRES_PASSWORD'
  ];

  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    logger.error('Missing required environment variables', {
      missing_variables: missingVars,
      help: 'Please check your .env file or container environment configuration'
    });
    return false;
  }

  return true;
}

/**
 * Display startup banner with system information
 */
function displayStartupBanner(): void {
  const banner = `
╔══════════════════════════════════════════════════════════════╗
║                  ArbitrageX Supreme V3.0                     ║
║                 PnL Reconciliation System                    ║
║                      Real-Only Policy                        ║
╠══════════════════════════════════════════════════════════════╣
║  Component: Recon (PnL Reconciliation & Investigation)       ║
║  Version:   1.0.0                                            ║
║  Environment: ${(process.env.NODE_ENV || 'development').padEnd(7)}                                ║
║  Port:      ${(process.env.RECON_PORT || '8001').padEnd(7)}                                ║
║  Log Level: ${(process.env.RECON_LOG_LEVEL || 'info').padEnd(7)}                                ║
╚══════════════════════════════════════════════════════════════╝
  `;
  
  console.log(banner);
  
  logger.info('Starting ArbitrageX Recon Service', {
    component: 'recon',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    port: process.env.RECON_PORT || '8001',
    log_level: process.env.RECON_LOG_LEVEL || 'info',
    node_version: process.version,
    pid: process.pid
  });
}

/**
 * Main application startup
 */
async function main(): Promise<void> {
  try {
    // Initialize logger first
    logger = initializeLogger();
    
    // Display startup information
    displayStartupBanner();
    
    // Setup error and signal handlers
    setupErrorHandlers();
    setupSignalHandlers();
    
    // Validate environment configuration
    if (!validateEnvironment()) {
      process.exit(1);
    }
    
    // Create server configuration
    const config = createServerConfig();
    logger.info('Server configuration loaded', {
      postgres_host: config.postgres.host,
      postgres_port: config.postgres.port,
      postgres_database: config.postgres.database,
      recon_port: config.port,
      batch_size: config.reconciliation.batch_size,
      max_investigations: config.reconciliation.max_concurrent_investigations
    });
    
    // Create and start server
    server = new ReconServer(config);
    await server.start();
    
    logger.info('ArbitrageX Recon Service started successfully', {
      status: 'running',
      health_endpoint: `http://${config.host}:${config.port}/health`,
      metrics_endpoint: `http://${config.host}:${config.port}/metrics`,
      reconciliation_endpoint: `http://${config.host}:${config.port}/reconcile`,
      webhook_endpoint: `http://${config.host}:${config.port}/events/execution`
    });
    
    // Keep the process running
    logger.info('Service ready to accept reconciliation requests');
    
  } catch (error) {
    logger.error('Failed to start ArbitrageX Recon Service', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    process.exit(1);
  }
}

/**
 * Health check for container orchestration
 */
async function healthCheck(): Promise<void> {
  if (process.argv.includes('--health-check')) {
    try {
      const config = createServerConfig();
      const response = await fetch(`http://${config.host}:${config.port}/health`);
      
      if (response.ok) {
        const health = await response.json();
        console.log(JSON.stringify(health, null, 2));
        process.exit(health.status === 'healthy' ? 0 : 1);
      } else {
        console.error('Health check failed:', response.status);
        process.exit(1);
      }
    } catch (error) {
      console.error('Health check error:', error);
      process.exit(1);
    }
  }
}

// Handle health check requests
healthCheck();

// Start the application if not in health check mode
if (!process.argv.includes('--health-check')) {
  main().catch((error) => {
    console.error('Application startup failed:', error);
    process.exit(1);
  });
}
/**
 * ArbitrageX Supreme V3.0 - Cron Service Main Entry Point
 * Real-Only Policy - Production cron service for automated data updates
 * 
 * Responsibilities:
 * - Hourly data updates (prices, liquidity, gas)
 * - Market monitoring and opportunity detection
 * - System health checks and maintenance
 * - Real-time metrics and monitoring integration
 */

import { Pool } from 'pg';
import { createClient } from 'redis';
import { createLogger, format, transports } from 'winston';
import { register, Counter, Histogram, Gauge } from 'prom-client';
import Fastify from 'fastify';
import dotenv from 'dotenv';

import { ArbitrageXJobScheduler } from './services/jobScheduler';
import { TokenPriceUpdater, LiquidityPoolUpdater, GasPriceUpdater } from './services/dataUpdaters';
import {
  CronJobConfig,
  JobPriority,
  JobExecutionContext,
  JobExecutionResult,
  JobStatus,
  ChainId
} from './types/cron';

// Load environment variables
dotenv.config();

interface CronServiceConfig {
  database: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    max_connections: number;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
  };
  server: {
    port: number;
    host: string;
  };
  logging: {
    level: string;
    file_path: string;
  };
  chains: {
    enabled_chains: ChainId[];
  };
}

class ArbitrageXCronService {
  private config: CronServiceConfig;
  private database: Pool;
  private redis: any;
  private logger: any;
  private scheduler: ArbitrageXJobScheduler;
  private server: any;
  
  // Data updaters
  private tokenPriceUpdater: TokenPriceUpdater;
  private liquidityPoolUpdater: LiquidityPoolUpdater;
  private gasPriceUpdater: GasPriceUpdater;
  
  // Metrics
  private metricsCollector = {
    jobsScheduled: new Counter({
      name: 'cron_jobs_scheduled_total',
      help: 'Total number of cron jobs scheduled',
      labelNames: ['job_name', 'priority']
    }),
    jobsCompleted: new Counter({
      name: 'cron_jobs_completed_total',
      help: 'Total number of cron jobs completed',
      labelNames: ['job_name', 'status']
    }),
    jobDuration: new Histogram({
      name: 'cron_job_duration_seconds',
      help: 'Duration of cron job execution',
      labelNames: ['job_name'],
      buckets: [0.1, 0.5, 1, 5, 10, 30, 60, 300, 600, 1800, 3600]
    }),
    activeJobs: new Gauge({
      name: 'cron_active_jobs',
      help: 'Number of currently active cron jobs'
    }),
    recordsProcessed: new Counter({
      name: 'cron_records_processed_total',
      help: 'Total number of records processed by cron jobs',
      labelNames: ['job_name', 'record_type']
    }),
    
    // Convenience methods for scheduler
    incrementCounter: (name: string, labels: Record<string, string>) => {
      switch (name) {
        case 'cron_jobs_scheduled_total':
          this.metricsCollector.jobsScheduled.inc(labels);
          break;
        case 'cron_jobs_completed_total':
          this.metricsCollector.jobsCompleted.inc(labels);
          break;
        case 'cron_records_processed_total':
          this.metricsCollector.recordsProcessed.inc(labels);
          break;
      }
    },
    
    observeHistogram: (name: string, value: number, labels: Record<string, string>) => {
      if (name === 'cron_job_duration_seconds') {
        this.metricsCollector.jobDuration.observe(labels, value);
      }
    }
  };

  constructor() {
    this.config = this.loadConfiguration();
    this.setupLogger();
    this.printStartupBanner();
  }

  /**
   * Initialize and start the cron service
   */
  async start(): Promise<void> {
    try {
      this.logger.info('Starting ArbitrageX Cron Service...');

      // Initialize connections
      await this.initializeDatabase();
      await this.initializeRedis();
      
      // Initialize data updaters
      this.tokenPriceUpdater = new TokenPriceUpdater(this.database, this.redis, this.logger);
      this.liquidityPoolUpdater = new LiquidityPoolUpdater(this.database, this.redis, this.logger);
      this.gasPriceUpdater = new GasPriceUpdater(this.database, this.redis, this.logger);
      
      // Initialize job scheduler
      this.scheduler = new ArbitrageXJobScheduler(
        this.database,
        this.redis,
        this.logger,
        this.metricsCollector,
        5 // max concurrent jobs
      );
      
      // Schedule all cron jobs
      await this.scheduleCronJobs();
      
      // Start HTTP server for health checks and metrics
      await this.startHttpServer();
      
      this.logger.info('ArbitrageX Cron Service started successfully', {
        database_host: this.config.database.host,
        redis_host: this.config.redis.host,
        server_port: this.config.server.port,
        enabled_chains: this.config.chains.enabled_chains
      });

      // Setup graceful shutdown
      this.setupGracefulShutdown();

    } catch (error) {
      this.logger.error('Failed to start cron service', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      process.exit(1);
    }
  }

  /**
   * Load configuration from environment variables
   */
  private loadConfiguration(): CronServiceConfig {
    return {
      database: {
        host: process.env.POSTGRES_HOST || 'localhost',
        port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
        database: process.env.POSTGRES_DB || 'arbitragex_recon',
        user: process.env.POSTGRES_USER || 'arbitragex',
        password: process.env.POSTGRES_PASSWORD || 'secure_password',
        max_connections: parseInt(process.env.POSTGRES_MAX_CONNECTIONS || '10', 10)
      },
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0', 10)
      },
      server: {
        port: parseInt(process.env.CRON_PORT || '8005', 10),
        host: process.env.CRON_HOST || '0.0.0.0'
      },
      logging: {
        level: process.env.CRON_LOG_LEVEL || 'info',
        file_path: process.env.CRON_LOG_PATH || '/var/log/arbitragex/cron.log'
      },
      chains: {
        enabled_chains: (process.env.ENABLED_CHAINS || '1,137,56,42161,10').split(',') as ChainId[]
      }
    };
  }

  /**
   * Setup Winston logger
   */
  private setupLogger(): void {
    this.logger = createLogger({
      level: this.config.logging.level,
      format: format.combine(
        format.timestamp(),
        format.errors({ stack: true }),
        format.json()
      ),
      transports: [
        new transports.Console({
          format: format.combine(
            format.colorize(),
            format.simple()
          )
        }),
        new transports.File({
          filename: this.config.logging.file_path,
          maxsize: 100 * 1024 * 1024, // 100MB
          maxFiles: 5
        }),
        new transports.File({
          filename: '/var/log/arbitragex/cron-error.log',
          level: 'error',
          maxsize: 50 * 1024 * 1024, // 50MB
          maxFiles: 3
        })
      ]
    });
  }

  /**
   * Print startup banner
   */
  private printStartupBanner(): void {
    const banner = `
╔══════════════════════════════════════════════════════════════╗
║                  ArbitrageX Supreme V3.0                     ║
║                     Cron Service                             ║
║                    Real-Only Policy                          ║
╠══════════════════════════════════════════════════════════════╣
║  Component: Data Updater & Scheduler                         ║
║  Version:   3.0.0                                            ║
║  Environment: ${(process.env.NODE_ENV || 'production').padEnd(7)}                               ║
║  Chains:    ${this.config.chains.enabled_chains.length} chains enabled                            ║
║  Port:      ${this.config.server.port.toString().padEnd(7)}                               ║
╚══════════════════════════════════════════════════════════════╝
    `;
    console.log(banner);
  }

  /**
   * Initialize database connection
   */
  private async initializeDatabase(): Promise<void> {
    this.database = new Pool({
      host: this.config.database.host,
      port: this.config.database.port,
      database: this.config.database.database,
      user: this.config.database.user,
      password: this.config.database.password,
      max: this.config.database.max_connections,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    });

    // Test connection
    try {
      const client = await this.database.connect();
      await client.query('SELECT NOW()');
      client.release();
      this.logger.info('Database connection established');
    } catch (error) {
      throw new Error(`Database connection failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Initialize Redis connection
   */
  private async initializeRedis(): Promise<void> {
    this.redis = createClient({
      socket: {
        host: this.config.redis.host,
        port: this.config.redis.port
      },
      password: this.config.redis.password,
      database: this.config.redis.db
    });

    this.redis.on('error', (err: Error) => {
      this.logger.error('Redis connection error', { error: err.message });
    });

    await this.redis.connect();
    this.logger.info('Redis connection established');
  }

  /**
   * Schedule all cron jobs
   */
  private async scheduleCronJobs(): Promise<void> {
    this.logger.info('Scheduling cron jobs...');

    // High-frequency jobs (every 1-5 minutes)
    
    // Token prices - every 2 minutes for competitive pricing
    this.scheduler.scheduleJob({
      job_name: 'token_price_update',
      description: 'Update token prices from multiple sources',
      schedule: '*/2 * * * *', // Every 2 minutes
      priority: JobPriority.CRITICAL,
      timeout_minutes: 5,
      retry_attempts: 3,
      alerting: {
        on_failure: true,
        on_long_duration: true,
        duration_threshold_minutes: 3
      }
    }, this.tokenPriceUpdater.updateTokenPrices.bind(this.tokenPriceUpdater));

    // Gas prices - every 1 minute for optimal execution
    this.scheduler.scheduleJob({
      job_name: 'gas_price_update', 
      description: 'Update gas prices for all chains',
      schedule: '* * * * *', // Every minute
      priority: JobPriority.CRITICAL,
      timeout_minutes: 2,
      retry_attempts: 5,
      alerting: {
        on_failure: true,
        on_long_duration: true,
        duration_threshold_minutes: 1
      }
    }, this.gasPriceUpdater.updateGasPrices.bind(this.gasPriceUpdater));

    // Medium-frequency jobs (every 5-15 minutes)

    // Liquidity pools - every 5 minutes
    this.scheduler.scheduleJob({
      job_name: 'liquidity_pool_update',
      description: 'Update DEX liquidity pool data',
      schedule: '*/5 * * * *', // Every 5 minutes
      priority: JobPriority.HIGH,
      timeout_minutes: 10,
      retry_attempts: 3,
      dependencies: [], // Can run independently
      alerting: {
        on_failure: true,
        on_long_duration: true,
        duration_threshold_minutes: 8
      }
    }, this.liquidityPoolUpdater.updateLiquidityPools.bind(this.liquidityPoolUpdater));

    // MEV opportunity scanner - every 3 minutes
    this.scheduler.scheduleJob({
      job_name: 'mev_opportunity_scan',
      description: 'Scan and analyze MEV opportunities',
      schedule: '*/3 * * * *', // Every 3 minutes
      priority: JobPriority.HIGH,
      timeout_minutes: 8,
      retry_attempts: 2,
      dependencies: ['token_price_update', 'liquidity_pool_update'],
      alerting: {
        on_failure: true,
        on_long_duration: true,
        duration_threshold_minutes: 5
      }
    }, this.handleMEVOpportunityScan.bind(this));

    // Low-frequency jobs (hourly, daily)

    // Strategy performance analysis - every hour
    this.scheduler.scheduleJob({
      job_name: 'strategy_performance_analysis',
      description: 'Analyze strategy performance and update parameters',
      schedule: '0 * * * *', // Every hour at minute 0
      priority: JobPriority.MEDIUM,
      timeout_minutes: 20,
      retry_attempts: 2,
      alerting: {
        on_failure: true,
        on_long_duration: true,
        duration_threshold_minutes: 15
      }
    }, this.handleStrategyPerformanceAnalysis.bind(this));

    // System health monitoring - every 15 minutes
    this.scheduler.scheduleJob({
      job_name: 'system_health_check',
      description: 'Monitor system health and performance metrics',
      schedule: '*/15 * * * *', // Every 15 minutes
      priority: JobPriority.MEDIUM,
      timeout_minutes: 5,
      retry_attempts: 1,
      alerting: {
        on_failure: false, // Don't alert on health check failures
        on_long_duration: true,
        duration_threshold_minutes: 3
      }
    }, this.handleSystemHealthCheck.bind(this));

    // Database cleanup - daily at 2 AM UTC
    this.scheduler.scheduleJob({
      job_name: 'database_cleanup',
      description: 'Clean up old data and optimize database',
      schedule: '0 2 * * *', // Daily at 2 AM UTC
      priority: JobPriority.LOW,
      timeout_minutes: 60,
      retry_attempts: 1,
      alerting: {
        on_failure: true,
        on_long_duration: true,
        duration_threshold_minutes: 45
      }
    }, this.handleDatabaseCleanup.bind(this));

    this.logger.info('All cron jobs scheduled successfully');
  }

  /**
   * MEV Opportunity Scan Handler
   */
  private async handleMEVOpportunityScan(context: JobExecutionContext): Promise<JobExecutionResult> {
    const { executionId, startTime } = context;

    // Implementation would scan for MEV opportunities
    // This is a placeholder for the actual implementation
    
    const endTime = new Date();
    return {
      job_name: 'mev_opportunity_scan',
      execution_id: executionId,
      status: JobStatus.COMPLETED,
      started_at: startTime.toISOString(),
      completed_at: endTime.toISOString(),
      duration_ms: endTime.getTime() - startTime.getTime(),
      records_processed: 0,
      records_updated: 0,
      records_failed: 0,
      metadata: {
        opportunities_found: 0,
        chains_scanned: this.config.chains.enabled_chains.length
      }
    };
  }

  /**
   * Strategy Performance Analysis Handler
   */
  private async handleStrategyPerformanceAnalysis(context: JobExecutionContext): Promise<JobExecutionResult> {
    const { executionId, startTime } = context;

    // Implementation would analyze strategy performance
    // This is a placeholder for the actual implementation
    
    const endTime = new Date();
    return {
      job_name: 'strategy_performance_analysis',
      execution_id: executionId,
      status: JobStatus.COMPLETED,
      started_at: startTime.toISOString(),
      completed_at: endTime.toISOString(),
      duration_ms: endTime.getTime() - startTime.getTime(),
      records_processed: 0,
      records_updated: 0,
      records_failed: 0,
      metadata: {
        strategies_analyzed: 0,
        performance_alerts: 0
      }
    };
  }

  /**
   * System Health Check Handler
   */
  private async handleSystemHealthCheck(context: JobExecutionContext): Promise<JobExecutionResult> {
    const { executionId, startTime } = context;

    try {
      // Check database health
      await this.database.query('SELECT 1');
      
      // Check Redis health
      await this.redis.ping();
      
      // Update system metrics
      this.metricsCollector.activeJobs.set(this.scheduler.getAllJobs().size);

      const endTime = new Date();
      return {
        job_name: 'system_health_check',
        execution_id: executionId,
        status: JobStatus.COMPLETED,
        started_at: startTime.toISOString(),
        completed_at: endTime.toISOString(),
        duration_ms: endTime.getTime() - startTime.getTime(),
        records_processed: 1,
        records_updated: 1,
        records_failed: 0,
        metadata: {
          database_healthy: true,
          redis_healthy: true,
          active_jobs: this.scheduler.getAllJobs().size
        }
      };

    } catch (error) {
      const endTime = new Date();
      return {
        job_name: 'system_health_check',
        execution_id: executionId,
        status: JobStatus.FAILED,
        started_at: startTime.toISOString(),
        completed_at: endTime.toISOString(),
        duration_ms: endTime.getTime() - startTime.getTime(),
        records_processed: 0,
        records_updated: 0,
        records_failed: 1,
        error_message: error instanceof Error ? error.message : String(error),
        metadata: {}
      };
    }
  }

  /**
   * Database Cleanup Handler
   */
  private async handleDatabaseCleanup(context: JobExecutionContext): Promise<JobExecutionResult> {
    const { executionId, startTime } = context;
    let recordsProcessed = 0;

    try {
      // Clean up old price data (keep only last 7 days)
      const priceCleanup = await this.database.query(`
        DELETE FROM token_prices 
        WHERE created_at < NOW() - INTERVAL '7 days'
      `);
      recordsProcessed += priceCleanup.rowCount || 0;

      // Clean up old execution logs (keep only last 30 days)
      const logCleanup = await this.database.query(`
        DELETE FROM cron_job_executions 
        WHERE created_at < NOW() - INTERVAL '30 days'
      `);
      recordsProcessed += logCleanup.rowCount || 0;

      // Vacuum and analyze tables
      await this.database.query('VACUUM ANALYZE token_prices');
      await this.database.query('VACUUM ANALYZE cron_job_executions');

      const endTime = new Date();
      return {
        job_name: 'database_cleanup',
        execution_id: executionId,
        status: JobStatus.COMPLETED,
        started_at: startTime.toISOString(),
        completed_at: endTime.toISOString(),
        duration_ms: endTime.getTime() - startTime.getTime(),
        records_processed: recordsProcessed,
        records_updated: recordsProcessed,
        records_failed: 0,
        metadata: {
          tables_vacuumed: 2,
          old_records_deleted: recordsProcessed
        }
      };

    } catch (error) {
      const endTime = new Date();
      return {
        job_name: 'database_cleanup',
        execution_id: executionId,
        status: JobStatus.FAILED,
        started_at: startTime.toISOString(),
        completed_at: endTime.toISOString(),
        duration_ms: endTime.getTime() - startTime.getTime(),
        records_processed: recordsProcessed,
        records_updated: recordsProcessed,
        records_failed: 0,
        error_message: error instanceof Error ? error.message : String(error),
        metadata: {}
      };
    }
  }

  /**
   * Start HTTP server for health checks and metrics
   */
  private async startHttpServer(): Promise<void> {
    this.server = Fastify({
      logger: false
    });

    // Health check endpoint
    this.server.get('/health', async (request, reply) => {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        jobs: {
          scheduled: this.scheduler.getAllJobs().size,
          active: 0 // Would need to track active jobs
        },
        services: {
          database: 'healthy',
          redis: 'healthy'
        }
      };

      try {
        await this.database.query('SELECT 1');
      } catch {
        health.services.database = 'unhealthy';
        health.status = 'degraded';
      }

      try {
        await this.redis.ping();
      } catch {
        health.services.redis = 'unhealthy';
        health.status = 'degraded';
      }

      reply.status(health.status === 'healthy' ? 200 : 503).send(health);
    });

    // Metrics endpoint
    this.server.get('/metrics', async (request, reply) => {
      reply.type('text/plain').send(await register.metrics());
    });

    // Job status endpoint
    this.server.get('/jobs', async (request, reply) => {
      const jobs = Array.from(this.scheduler.getAllJobs().entries()).map(([name, config]) => ({
        name,
        schedule: config.schedule,
        enabled: config.enabled,
        last_execution: this.scheduler.getJobStatus(name)
      }));
      
      reply.send({ jobs });
    });

    // Manual job trigger endpoint
    this.server.post('/jobs/:jobName/trigger', async (request, reply) => {
      const { jobName } = request.params as { jobName: string };
      
      try {
        const result = await this.scheduler.executeJobNow(jobName);
        reply.send({ result });
      } catch (error) {
        reply.status(404).send({ 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    });

    await this.server.listen({ 
      port: this.config.server.port, 
      host: this.config.server.host 
    });

    this.logger.info('HTTP server started', {
      port: this.config.server.port,
      host: this.config.server.host
    });
  }

  /**
   * Setup graceful shutdown
   */
  private setupGracefulShutdown(): void {
    const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT', 'SIGUSR1', 'SIGUSR2'];
    
    signals.forEach(signal => {
      process.on(signal, async () => {
        this.logger.info(`Received ${signal}, shutting down gracefully...`);
        
        try {
          // Stop HTTP server
          if (this.server) {
            await this.server.close();
          }
          
          // Stop job scheduler
          if (this.scheduler) {
            await this.scheduler.shutdown();
          }
          
          // Close database connections
          if (this.database) {
            await this.database.end();
          }
          
          // Close Redis connection
          if (this.redis) {
            await this.redis.quit();
          }
          
          this.logger.info('Graceful shutdown completed');
          process.exit(0);
          
        } catch (error) {
          this.logger.error('Error during shutdown', {
            error: error instanceof Error ? error.message : String(error)
          });
          process.exit(1);
        }
      });
    });
  }
}

// Start the service if this file is executed directly
if (require.main === module) {
  const cronService = new ArbitrageXCronService();
  cronService.start().catch((error) => {
    console.error('Failed to start cron service:', error);
    process.exit(1);
  });
}

export { ArbitrageXCronService };
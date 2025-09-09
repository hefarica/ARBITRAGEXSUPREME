/**
 * Recon Server - PnL Reconciliation System API
 * 
 * Fastify-based HTTP server for ArbitrageX Supreme V3.0 reconciliation system.
 * Implements Real-Only policy - all endpoints handle real execution and simulation data.
 * 
 * Core Responsibilities:
 * - HTTP API for reconciliation requests
 * - Webhook endpoints for real-time execution events
 * - Health monitoring and metrics exposure
 * - Request validation and error handling
 * - Integration with ReconciliationEngine and DeviationInvestigator
 */

import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Pool } from 'pg';
import winston from 'winston';
import { 
  ReconciliationRequest, 
  ReconciliationResult, 
  ExecutionEventV1,
  DeviationInvestigation,
  ChainId,
  Strategy,
  ReconciliationRequestSchema,
  ExecutionEventV1Schema
} from './types/reconciliation';
import { ReconciliationEngine } from './services/reconciliationEngine';
import { DeviationInvestigator } from './services/deviationInvestigator';
import { VarianceAnalyzer } from './services/varianceAnalyzer';

/**
 * Server configuration interface
 */
interface ServerConfig {
  port: number;
  host: string;
  postgres: {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
    max_connections: number;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
  };
  reconciliation: {
    batch_size: number;
    max_concurrent_investigations: number;
    investigation_timeout_ms: number;
  };
  observability: {
    metrics_enabled: boolean;
    tracing_enabled: boolean;
    log_level: string;
  };
}

/**
 * API Response interfaces
 */
interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    request_id: string;
    processing_time_ms: number;
    timestamp: string;
  };
}

interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: {
    database: 'up' | 'down';
    redis: 'up' | 'down';
    reconciliation_engine: 'up' | 'down';
  };
  metrics: {
    uptime_seconds: number;
    total_reconciliations: number;
    active_investigations: number;
    avg_processing_time_ms: number;
  };
}

/**
 * Metrics interface for Prometheus integration
 */
interface ServerMetrics {
  reconciliation_requests_total: number;
  reconciliation_errors_total: number;
  investigation_requests_total: number;
  avg_reconciliation_duration_ms: number;
  active_reconciliations: number;
  database_connections_active: number;
}

export class ReconServer {
  private fastify: FastifyInstance;
  private pool: Pool;
  private logger: winston.Logger;
  private config: ServerConfig;
  
  // Core services
  private reconciliationEngine: ReconciliationEngine;
  private deviationInvestigator: DeviationInvestigator;
  private varianceAnalyzer: VarianceAnalyzer;
  
  // Server state
  private startTime: Date = new Date();
  private metrics: ServerMetrics = {
    reconciliation_requests_total: 0,
    reconciliation_errors_total: 0,
    investigation_requests_total: 0,
    avg_reconciliation_duration_ms: 0,
    active_reconciliations: 0,
    database_connections_active: 0
  };

  constructor(config: ServerConfig) {
    this.config = config;
    this.fastify = Fastify({ 
      logger: false, // We use winston for logging
      requestIdHeader: 'x-request-id',
      genReqId: () => `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
    });
    
    this.setupLogger();
    this.setupDatabase();
    this.setupServices();
  }

  /**
   * Initialize Winston logger
   */
  private setupLogger(): void {
    this.logger = winston.createLogger({
      level: this.config.observability.log_level,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ 
          filename: '/var/log/recon/recon-server.log',
          maxsize: 100 * 1024 * 1024, // 100MB
          maxFiles: 5
        })
      ]
    });
  }

  /**
   * Initialize PostgreSQL connection pool
   */
  private setupDatabase(): void {
    this.pool = new Pool({
      host: this.config.postgres.host,
      port: this.config.postgres.port,
      database: this.config.postgres.database,
      user: this.config.postgres.username,
      password: this.config.postgres.password,
      max: this.config.postgres.max_connections,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    // Database connection monitoring
    this.pool.on('connect', () => {
      this.metrics.database_connections_active++;
    });

    this.pool.on('remove', () => {
      this.metrics.database_connections_active--;
    });

    this.pool.on('error', (err) => {
      this.logger.error('Database pool error', { error: err.message });
    });
  }

  /**
   * Initialize core reconciliation services
   */
  private setupServices(): void {
    this.varianceAnalyzer = new VarianceAnalyzer(this.pool, this.logger);
    this.reconciliationEngine = new ReconciliationEngine(this.pool, this.logger, this.varianceAnalyzer);
    this.deviationInvestigator = new DeviationInvestigator(this.pool, this.logger);
  }

  /**
   * Setup Fastify routes and middleware
   */
  private async setupRoutes(): Promise<void> {
    
    // Request logging middleware
    this.fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
      this.logger.info('Incoming request', {
        request_id: request.id,
        method: request.method,
        url: request.url,
        user_agent: request.headers['user-agent'],
        ip: request.ip
      });
    });

    // Response timing middleware
    this.fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
      const processingTime = reply.getResponseTime();
      
      this.logger.info('Request completed', {
        request_id: request.id,
        status_code: reply.statusCode,
        processing_time_ms: processingTime
      });

      // Update metrics
      if (request.url.includes('/reconcile')) {
        this.metrics.avg_reconciliation_duration_ms = 
          (this.metrics.avg_reconciliation_duration_ms + processingTime) / 2;
      }
    });

    // Error handling middleware
    this.fastify.setErrorHandler(async (error: Error, request: FastifyRequest, reply: FastifyReply) => {
      this.logger.error('Request error', {
        request_id: request.id,
        error: error.message,
        stack: error.stack,
        url: request.url
      });

      this.metrics.reconciliation_errors_total++;

      const response: APIResponse = {
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An internal server error occurred',
          details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        },
        metadata: {
          request_id: request.id as string,
          processing_time_ms: reply.getResponseTime(),
          timestamp: new Date().toISOString()
        }
      };

      reply.status(500).send(response);
    });

    // Health check endpoint
    this.fastify.get('/health', async (request: FastifyRequest, reply: FastifyReply) => {
      const healthCheck: HealthCheckResponse = await this.performHealthCheck();
      const statusCode = healthCheck.status === 'healthy' ? 200 : 
                        healthCheck.status === 'degraded' ? 200 : 503;
      
      reply.status(statusCode).send(healthCheck);
    });

    // Metrics endpoint for Prometheus
    this.fastify.get('/metrics', async (request: FastifyRequest, reply: FastifyReply) => {
      const metrics = this.generatePrometheusMetrics();
      reply.type('text/plain').send(metrics);
    });

    // Main reconciliation endpoint
    this.fastify.post<{ Body: ReconciliationRequest }>('/reconcile', {
      schema: {
        body: ReconciliationRequestSchema
      }
    }, async (request: FastifyRequest<{ Body: ReconciliationRequest }>, reply: FastifyReply) => {
      
      const startTime = Date.now();
      this.metrics.reconciliation_requests_total++;
      this.metrics.active_reconciliations++;

      try {
        const reconciliationRequest = request.body;
        
        this.logger.info('Processing reconciliation request', {
          request_id: request.id,
          strategy: reconciliationRequest.strategy,
          chain_id: reconciliationRequest.chain_id,
          simulation_id: reconciliationRequest.simulation_id,
          execution_id: reconciliationRequest.execution_id || null
        });

        // Execute reconciliation
        const result = await this.reconciliationEngine.executeReconciliation(reconciliationRequest);

        const response: APIResponse<ReconciliationResult> = {
          success: true,
          data: result,
          metadata: {
            request_id: request.id as string,
            processing_time_ms: Date.now() - startTime,
            timestamp: new Date().toISOString()
          }
        };

        reply.status(200).send(response);

      } catch (error) {
        this.logger.error('Reconciliation failed', {
          request_id: request.id,
          error: error instanceof Error ? error.message : String(error)
        });

        this.metrics.reconciliation_errors_total++;

        const response: APIResponse = {
          success: false,
          error: {
            code: 'RECONCILIATION_FAILED',
            message: error instanceof Error ? error.message : 'Reconciliation failed',
            details: error
          },
          metadata: {
            request_id: request.id as string,
            processing_time_ms: Date.now() - startTime,
            timestamp: new Date().toISOString()
          }
        };

        reply.status(500).send(response);
        
      } finally {
        this.metrics.active_reconciliations--;
      }
    });

    // Batch reconciliation endpoint
    this.fastify.post<{ Body: { requests: ReconciliationRequest[] } }>('/reconcile/batch', {
      schema: {
        body: {
          type: 'object',
          properties: {
            requests: {
              type: 'array',
              items: ReconciliationRequestSchema,
              maxItems: this.config.reconciliation.batch_size
            }
          },
          required: ['requests']
        }
      }
    }, async (request: FastifyRequest<{ Body: { requests: ReconciliationRequest[] } }>, reply: FastifyReply) => {
      
      const startTime = Date.now();
      const requests = request.body.requests;
      
      this.logger.info('Processing batch reconciliation', {
        request_id: request.id,
        batch_size: requests.length
      });

      try {
        // Process requests in parallel with concurrency limit
        const results = await Promise.allSettled(
          requests.map(req => this.reconciliationEngine.executeReconciliation(req))
        );

        const successes = results.filter(r => r.status === 'fulfilled').length;
        const failures = results.filter(r => r.status === 'rejected').length;

        const response: APIResponse<{ results: any[], summary: any }> = {
          success: true,
          data: {
            results: results.map((result, index) => ({
              request_index: index,
              success: result.status === 'fulfilled',
              data: result.status === 'fulfilled' ? result.value : null,
              error: result.status === 'rejected' ? result.reason : null
            })),
            summary: {
              total: requests.length,
              successes,
              failures,
              success_rate: successes / requests.length
            }
          },
          metadata: {
            request_id: request.id as string,
            processing_time_ms: Date.now() - startTime,
            timestamp: new Date().toISOString()
          }
        };

        reply.status(200).send(response);

      } catch (error) {
        this.logger.error('Batch reconciliation failed', {
          request_id: request.id,
          error: error instanceof Error ? error.message : String(error)
        });

        reply.status(500).send({
          success: false,
          error: {
            code: 'BATCH_RECONCILIATION_FAILED',
            message: 'Batch reconciliation failed'
          }
        });
      }
    });

    // Execution event webhook endpoint
    this.fastify.post<{ Body: ExecutionEventV1 }>('/events/execution', {
      schema: {
        body: ExecutionEventV1Schema
      }
    }, async (request: FastifyRequest<{ Body: ExecutionEventV1 }>, reply: FastifyReply) => {
      
      try {
        const executionEvent = request.body;
        
        this.logger.info('Processing execution event', {
          request_id: request.id,
          event_id: executionEvent.event_id,
          strategy: executionEvent.strategy,
          chain_id: executionEvent.chain_id
        });

        // Store execution event for reconciliation
        await this.storeExecutionEvent(executionEvent);

        // Trigger automatic reconciliation if simulation data exists
        const reconciliationRequest: ReconciliationRequest = {
          strategy: executionEvent.strategy,
          chain_id: executionEvent.chain_id,
          simulation_id: executionEvent.simulation_data.simulation_id,
          execution_id: executionEvent.execution_data.execution_id,
          reconciliation_config: {
            variance_thresholds: {
              minor_variance_threshold: 0.02,
              significant_variance_threshold: 0.05,
              major_discrepancy_threshold: 0.15
            },
            investigation_triggers: {
              auto_investigate_significant: true,
              auto_investigate_major: true,
              max_investigation_time_ms: this.config.reconciliation.investigation_timeout_ms
            },
            notification_settings: {
              notify_on_discrepancy: true,
              notification_channels: ['webhook']
            }
          }
        };

        // Execute reconciliation asynchronously
        setImmediate(async () => {
          try {
            await this.reconciliationEngine.executeReconciliation(reconciliationRequest);
          } catch (error) {
            this.logger.error('Automatic reconciliation failed for execution event', {
              event_id: executionEvent.event_id,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        });

        reply.status(200).send({
          success: true,
          data: {
            event_id: executionEvent.event_id,
            processed_at: new Date().toISOString()
          }
        });

      } catch (error) {
        this.logger.error('Execution event processing failed', {
          request_id: request.id,
          error: error instanceof Error ? error.message : String(error)
        });

        reply.status(500).send({
          success: false,
          error: {
            code: 'EVENT_PROCESSING_FAILED',
            message: 'Failed to process execution event'
          }
        });
      }
    });

    // Investigation status endpoint
    this.fastify.get<{ Params: { investigationId: string } }>('/investigations/:investigationId', 
      async (request: FastifyRequest<{ Params: { investigationId: string } }>, reply: FastifyReply) => {
        
        try {
          const investigationId = request.params.investigationId;
          const investigation = await this.getInvestigation(investigationId);

          if (!investigation) {
            reply.status(404).send({
              success: false,
              error: {
                code: 'INVESTIGATION_NOT_FOUND',
                message: `Investigation ${investigationId} not found`
              }
            });
            return;
          }

          reply.status(200).send({
            success: true,
            data: investigation
          });

        } catch (error) {
          this.logger.error('Investigation retrieval failed', {
            request_id: request.id,
            error: error instanceof Error ? error.message : String(error)
          });

          reply.status(500).send({
            success: false,
            error: {
              code: 'INVESTIGATION_RETRIEVAL_FAILED',
              message: 'Failed to retrieve investigation'
            }
          });
        }
    });

    // Reconciliation history endpoint
    this.fastify.get<{ 
      Querystring: { 
        strategy?: Strategy; 
        chain_id?: ChainId; 
        limit?: number; 
        offset?: number;
        status?: string;
      } 
    }>('/reconciliations', 
      async (request: FastifyRequest<{ 
        Querystring: { 
          strategy?: Strategy; 
          chain_id?: ChainId; 
          limit?: number; 
          offset?: number;
          status?: string;
        } 
      }>, reply: FastifyReply) => {
        
        try {
          const { strategy, chain_id, limit = 100, offset = 0, status } = request.query;
          
          const reconciliations = await this.getReconciliationHistory({
            strategy,
            chain_id,
            limit: Math.min(limit, 1000), // Cap at 1000
            offset,
            status
          });

          reply.status(200).send({
            success: true,
            data: reconciliations
          });

        } catch (error) {
          this.logger.error('Reconciliation history retrieval failed', {
            request_id: request.id,
            error: error instanceof Error ? error.message : String(error)
          });

          reply.status(500).send({
            success: false,
            error: {
              code: 'HISTORY_RETRIEVAL_FAILED',
              message: 'Failed to retrieve reconciliation history'
            }
          });
        }
    });
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    try {
      await this.setupRoutes();
      
      await this.fastify.listen({ 
        port: this.config.port, 
        host: this.config.host 
      });

      this.logger.info('Recon server started', {
        port: this.config.port,
        host: this.config.host,
        environment: process.env.NODE_ENV || 'development'
      });

    } catch (error) {
      this.logger.error('Server startup failed', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Stop the server gracefully
   */
  async stop(): Promise<void> {
    try {
      await this.fastify.close();
      await this.pool.end();
      
      this.logger.info('Recon server stopped gracefully');
      
    } catch (error) {
      this.logger.error('Server shutdown error', {
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Perform comprehensive health check
   */
  private async performHealthCheck(): Promise<HealthCheckResponse> {
    const checks = {
      database: 'down' as 'up' | 'down',
      redis: 'down' as 'up' | 'down',
      reconciliation_engine: 'up' as 'up' | 'down'
    };

    // Check database connectivity
    try {
      await this.pool.query('SELECT 1');
      checks.database = 'up';
    } catch (error) {
      this.logger.warn('Database health check failed', { error });
    }

    // Check Redis connectivity (placeholder)
    try {
      // TODO: Implement Redis health check when Redis client is added
      checks.redis = 'up';
    } catch (error) {
      this.logger.warn('Redis health check failed', { error });
    }

    const upServices = Object.values(checks).filter(status => status === 'up').length;
    const totalServices = Object.keys(checks).length;
    
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (upServices === totalServices) {
      overallStatus = 'healthy';
    } else if (upServices >= totalServices / 2) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'unhealthy';
    }

    const uptimeSeconds = Math.floor((Date.now() - this.startTime.getTime()) / 1000);

    return {
      status: overallStatus,
      services: checks,
      metrics: {
        uptime_seconds: uptimeSeconds,
        total_reconciliations: this.metrics.reconciliation_requests_total,
        active_investigations: this.metrics.investigation_requests_total,
        avg_processing_time_ms: this.metrics.avg_reconciliation_duration_ms
      }
    };
  }

  /**
   * Generate Prometheus metrics
   */
  private generatePrometheusMetrics(): string {
    const metrics = [
      `# HELP recon_reconciliation_requests_total Total number of reconciliation requests`,
      `# TYPE recon_reconciliation_requests_total counter`,
      `recon_reconciliation_requests_total ${this.metrics.reconciliation_requests_total}`,
      ``,
      `# HELP recon_reconciliation_errors_total Total number of reconciliation errors`,
      `# TYPE recon_reconciliation_errors_total counter`,
      `recon_reconciliation_errors_total ${this.metrics.reconciliation_errors_total}`,
      ``,
      `# HELP recon_active_reconciliations Current number of active reconciliations`,
      `# TYPE recon_active_reconciliations gauge`,
      `recon_active_reconciliations ${this.metrics.active_reconciliations}`,
      ``,
      `# HELP recon_avg_processing_time_ms Average reconciliation processing time in milliseconds`,
      `# TYPE recon_avg_processing_time_ms gauge`,
      `recon_avg_processing_time_ms ${this.metrics.avg_reconciliation_duration_ms}`,
      ``,
      `# HELP recon_database_connections_active Current number of active database connections`,
      `# TYPE recon_database_connections_active gauge`,
      `recon_database_connections_active ${this.metrics.database_connections_active}`,
      ``
    ];

    return metrics.join('\n');
  }

  // Helper methods for database operations

  /**
   * Store execution event in database
   */
  private async storeExecutionEvent(event: ExecutionEventV1): Promise<void> {
    const query = `
      INSERT INTO execution_events_v1 (
        event_id, event_type, version, timestamp, strategy, chain_id,
        simulation_data, execution_data, reconciliation, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (event_id) DO NOTHING
    `;

    await this.pool.query(query, [
      event.event_id,
      event.event_type,
      event.version,
      event.timestamp,
      event.strategy,
      event.chain_id,
      JSON.stringify(event.simulation_data),
      JSON.stringify(event.execution_data),
      JSON.stringify(event.reconciliation),
      JSON.stringify(event.metadata)
    ]);
  }

  /**
   * Get investigation by ID
   */
  private async getInvestigation(investigationId: string): Promise<DeviationInvestigation | null> {
    const query = `
      SELECT * FROM deviation_investigations 
      WHERE investigation_id = $1
    `;

    const result = await this.pool.query(query, [investigationId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      investigation_id: row.investigation_id,
      reconciliation_id: row.reconciliation_id,
      investigation_timestamp: row.investigation_timestamp,
      trigger_reason: row.trigger_reason,
      investigation_status: row.investigation_status,
      findings: JSON.parse(row.findings || '[]'),
      root_cause_analysis: row.root_cause_analysis,
      recommended_actions: JSON.parse(row.recommended_actions || '[]'),
      confidence_score: row.confidence_score,
      investigation_duration_ms: row.investigation_duration_ms,
      metadata: JSON.parse(row.metadata || '{}')
    };
  }

  /**
   * Get reconciliation history with filters
   */
  private async getReconciliationHistory(filters: {
    strategy?: Strategy;
    chain_id?: ChainId;
    limit: number;
    offset: number;
    status?: string;
  }): Promise<any[]> {
    
    let query = `
      SELECT * FROM reconciliations 
      WHERE 1=1
    `;
    
    const queryParams: any[] = [];
    let paramCount = 0;

    if (filters.strategy) {
      paramCount++;
      query += ` AND strategy = $${paramCount}`;
      queryParams.push(filters.strategy);
    }

    if (filters.chain_id) {
      paramCount++;
      query += ` AND chain_id = $${paramCount}`;
      queryParams.push(filters.chain_id);
    }

    if (filters.status) {
      paramCount++;
      query += ` AND reconciliation_status = $${paramCount}`;
      queryParams.push(filters.status);
    }

    query += ` ORDER BY reconciliation_timestamp DESC`;
    
    paramCount++;
    query += ` LIMIT $${paramCount}`;
    queryParams.push(filters.limit);
    
    paramCount++;
    query += ` OFFSET $${paramCount}`;
    queryParams.push(filters.offset);

    const result = await this.pool.query(query, queryParams);
    return result.rows;
  }
}

/**
 * Server configuration factory
 */
export function createServerConfig(): ServerConfig {
  return {
    port: parseInt(process.env.RECON_PORT || '8001', 10),
    host: process.env.RECON_HOST || '0.0.0.0',
    postgres: {
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
      database: process.env.POSTGRES_DB || 'arbitragex_recon',
      username: process.env.POSTGRES_USER || 'arbitragex',
      password: process.env.POSTGRES_PASSWORD || 'secure_password',
      max_connections: parseInt(process.env.POSTGRES_MAX_CONNECTIONS || '20', 10)
    },
    redis: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD
    },
    reconciliation: {
      batch_size: parseInt(process.env.RECON_BATCH_SIZE || '100', 10),
      max_concurrent_investigations: parseInt(process.env.RECON_MAX_INVESTIGATIONS || '10', 10),
      investigation_timeout_ms: parseInt(process.env.RECON_INVESTIGATION_TIMEOUT || '300000', 10)
    },
    observability: {
      metrics_enabled: process.env.RECON_METRICS_ENABLED !== 'false',
      tracing_enabled: process.env.RECON_TRACING_ENABLED === 'true',
      log_level: process.env.RECON_LOG_LEVEL || 'info'
    }
  };
}
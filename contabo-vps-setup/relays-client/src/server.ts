import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Redis from 'ioredis';
import winston from 'winston';
import { z } from 'zod';

// Services
import { RelayManager } from './services/relayManager.js';
import { BundleEngine } from './services/bundleEngine.js';
import { InclusionTracker } from './services/inclusionTracker.js';
import { RelayMetricsService } from './services/metricsService.js';

// Types
import {
  BundleRequestSchema,
  BundleRequest,
  BundleResult,
  RelayConfig,
  RelayInfo,
  RelayType,
  FailoverConfig
} from './types/relay.js';

// Configuración del servidor
const server: FastifyInstance = Fastify({
  logger: false, // Usamos winston
  trustProxy: true,
  bodyLimit: 52428800, // 50MB para bundles grandes
  keepAliveTimeout: 65000,
  connectionTimeout: 60000
});

// Configuración de logging
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
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
      filename: '/app/logs/relays-client.log',
      maxsize: 10485760, // 10MB
      maxFiles: 5
    })
  ]
});

// Configuración de Redis
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  lazyConnect: true
});

// Servicios principales
let relayManager: RelayManager;
let bundleEngine: BundleEngine;
let inclusionTracker: InclusionTracker;
let metricsService: RelayMetricsService;

/**
 * Configuración inicial del servidor
 */
async function setupServer(): Promise<void> {
  // Middleware de seguridad
  await server.register(helmet, {
    contentSecurityPolicy: false
  });

  // CORS
  await server.register(cors, {
    origin: process.env.NODE_ENV === 'production' 
      ? ['https://your-frontend-domain.com']
      : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  });

  // Rate limiting más permisivo para MEV operations
  await server.register(rateLimit, {
    max: parseInt(process.env.RATE_LIMIT_MAX || '500'),
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({
      error: 'Rate limit exceeded',
      message: 'Too many requests for MEV operations, please try again later'
    })
  });

  // Swagger documentation
  await server.register(swagger, {
    swagger: {
      info: {
        title: 'ArbitrageX Supreme V3.0 - Multi-Relay Client API',
        description: 'API para gestión de bundles MEV en múltiples relays (Flashbots/bloXroute/Eden)',
        version: '3.0.0'
      },
      host: process.env.API_HOST || 'localhost:3004',
      schemes: ['http', 'https'],
      consumes: ['application/json'],
      produces: ['application/json'],
      tags: [
        { name: 'bundles', description: 'Envío y gestión de bundles MEV' },
        { name: 'relays', description: 'Gestión y configuración de relays' },
        { name: 'tracking', description: 'Tracking de inclusión de bundles' },
        { name: 'metrics', description: 'Métricas y performance de relays' },
        { name: 'health', description: 'Health checks y estado del sistema' }
      ]
    }
  });

  await server.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'full',
      deepLinking: false
    }
  });

  // Configuración de failover
  const failoverConfig: FailoverConfig = {
    strategy: (process.env.FAILOVER_STRATEGY as any) || 'priority_based',
    max_consecutive_failures: parseInt(process.env.MAX_CONSECUTIVE_FAILURES || '3'),
    failure_backoff_seconds: parseInt(process.env.FAILURE_BACKOFF_SECONDS || '60'),
    health_check_interval_seconds: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30'),
    circuit_breaker_threshold: parseFloat(process.env.CIRCUIT_BREAKER_THRESHOLD || '0.1'),
    recovery_time_seconds: parseInt(process.env.RECOVERY_TIME_SECONDS || '300')
  };

  // Inicializar servicios
  relayManager = new RelayManager(redis, logger, failoverConfig);
  bundleEngine = new BundleEngine(redis, logger, relayManager);
  inclusionTracker = new InclusionTracker(redis, logger);
  metricsService = new RelayMetricsService(redis, logger);

  logger.info('🔧 Servicios de relays-client inicializados correctamente');
}

/**
 * Schemas de validación
 */
const RelayConfigRequestSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['flashbots', 'bloxroute', 'eden', 'beaver', 'titan']),
  endpoint: z.string().url(),
  auth_header: z.string().optional(),
  api_key: z.string().optional(),
  signing_key: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional(),
  priority: z.number().int().min(1).max(10).default(5),
  weight: z.number().min(0).max(1).default(1),
  timeout_ms: z.number().int().min(1000).max(30000).default(5000),
  enabled: z.boolean().default(true)
});

const RelayActionSchema = z.object({
  action: z.enum(['enable', 'disable', 'reset_stats'])
});

// ============================================================================
// ENDPOINTS DE BUNDLE MANAGEMENT
// ============================================================================

/**
 * POST /bundles/submit
 * Enviar bundle a múltiples relays
 */
server.post<{ Body: BundleRequest }>('/bundles/submit', {
  schema: {
    tags: ['bundles'],
    summary: 'Enviar bundle MEV a múltiples relays',
    description: 'Envía un bundle de transacciones a relays seleccionados con failover automático',
    body: {
      type: 'object',
      properties: {
        bundle_id: { type: 'string', format: 'uuid' },
        strategy: { type: 'string', enum: ['A', 'C', 'D', 'F'] },
        chain_id: { type: 'number', minimum: 1 },
        target_block: { type: 'number', minimum: 1 },
        max_block: { type: 'number', minimum: 1 },
        transactions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              to: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
              data: { type: 'string', pattern: '^0x[a-fA-F0-9]*$' },
              value: { type: 'string', default: '0' },
              gas_limit: { type: 'string' },
              max_fee_per_gas: { type: 'string' },
              max_priority_fee_per_gas: { type: 'string' },
              signed_transaction: { type: 'string', pattern: '^0x[a-fA-F0-9]+$' }
            },
            required: ['to', 'data', 'gas_limit']
          }
        },
        relay_preferences: {
          type: 'array',
          items: { type: 'string', enum: ['flashbots', 'bloxroute', 'eden', 'beaver', 'titan'] }
        },
        mev_protection: { type: 'boolean', default: true },
        timeout_seconds: { type: 'number', minimum: 1, maximum: 300, default: 30 },
        real_only: { type: 'boolean', default: true }
      },
      required: ['bundle_id', 'strategy', 'chain_id', 'target_block', 'transactions']
    }
  }
}, async (request: FastifyRequest<{ Body: BundleRequest }>, reply: FastifyReply) => {
  try {
    // Validar request con Zod
    const validatedRequest = BundleRequestSchema.parse(request.body);
    
    logger.info(
      `📦 Nueva submission de bundle: ${validatedRequest.bundle_id} ` +
      `(estrategia ${validatedRequest.strategy}, chain ${validatedRequest.chain_id})`
    );

    // Enviar bundle
    const result = await bundleEngine.submitBundle(validatedRequest);
    
    // Registrar métricas
    metricsService.recordBundleSubmission(result, result.relay_results);
    
    // Iniciar tracking si fue exitoso
    if (result.overall_status === 'success' || result.overall_status === 'partial_success') {
      await inclusionTracker.startBundleTracking(result);
    }

    reply.code(200).send({
      bundle_id: result.bundle_id,
      overall_status: result.overall_status,
      successful_relays: result.successful_relays,
      failed_relays: result.failed_relays,
      total_time_ms: result.total_time_ms,
      relay_results: result.relay_results,
      inclusion_status: result.inclusion_status,
      error_summary: result.error_summary
    });

  } catch (error) {
    logger.error('❌ Error en /bundles/submit:', error);
    
    if (error instanceof z.ZodError) {
      reply.code(400).send({
        error: 'Validation Error',
        details: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      });
    } else {
      reply.code(500).send({
        error: 'Internal Server Error',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
});

/**
 * GET /bundles/result/:id
 * Obtener resultado de bundle
 */
server.get<{ Params: { id: string } }>('/bundles/result/:id', {
  schema: {
    tags: ['bundles'],
    summary: 'Obtener resultado de bundle',
    params: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' }
      }
    }
  }
}, async (request, reply) => {
  try {
    const bundleId = request.params.id;
    const result = await bundleEngine.getBundleResult(bundleId);
    
    if (!result) {
      reply.code(404).send({
        error: 'Not Found',
        message: `Bundle ${bundleId} no encontrado`
      });
      return;
    }
    
    // Incluir eventos de tracking si están disponibles
    const trackingEvents = await inclusionTracker.getBundleTrackingEvents(bundleId);
    
    reply.code(200).send({
      ...result,
      tracking_events: trackingEvents
    });
  } catch (error) {
    logger.error(`❌ Error obteniendo resultado ${request.params.id}:`, error);
    reply.code(500).send({ error: 'Internal Server Error' });
  }
});

/**
 * DELETE /bundles/cancel/:id
 * Cancelar bundle activo
 */
server.delete<{ Params: { id: string } }>('/bundles/cancel/:id', {
  schema: {
    tags: ['bundles'],
    summary: 'Cancelar bundle activo'
  }
}, async (request, reply) => {
  try {
    const bundleId = request.params.id;
    const cancelled = await bundleEngine.cancelBundle(bundleId);
    
    if (cancelled) {
      reply.code(200).send({
        message: `Bundle ${bundleId} cancelado`,
        cancelled: true
      });
    } else {
      reply.code(404).send({
        error: 'Not Found',
        message: `Bundle ${bundleId} no está activo`
      });
    }
  } catch (error) {
    logger.error(`❌ Error cancelando bundle ${request.params.id}:`, error);
    reply.code(500).send({ error: 'Internal Server Error' });
  }
});

/**
 * GET /bundles/active
 * Obtener bundles activos
 */
server.get('/bundles/active', {
  schema: {
    tags: ['bundles'],
    summary: 'Obtener bundles activos'
  }
}, async (request, reply) => {
  try {
    const activeBundles = bundleEngine.getActiveBundles();
    const trackingStats = await inclusionTracker.getTrackingStatistics();
    
    reply.code(200).send({
      active_bundles: activeBundles,
      total_active: activeBundles.length,
      tracking_statistics: trackingStats
    });
  } catch (error) {
    logger.error('❌ Error obteniendo bundles activos:', error);
    reply.code(500).send({ error: 'Internal Server Error' });
  }
});

// ============================================================================
// ENDPOINTS DE RELAY MANAGEMENT
// ============================================================================

/**
 * GET /relays
 * Obtener todos los relays
 */
server.get('/relays', {
  schema: {
    tags: ['relays'],
    summary: 'Obtener información de todos los relays'
  }
}, async (request, reply) => {
  try {
    const relays = relayManager.getAllRelays();
    
    // Actualizar métricas de salud
    relays.forEach(relay => {
      metricsService.updateRelayHealth(relay);
    });
    
    reply.code(200).send({
      relays,
      total: relays.length,
      by_status: relays.reduce((acc: any, relay) => {
        acc[relay.status] = (acc[relay.status] || 0) + 1;
        return acc;
      }, {}),
      by_type: relays.reduce((acc: any, relay) => {
        acc[relay.config.type] = (acc[relay.config.type] || 0) + 1;
        return acc;
      }, {})
    });
  } catch (error) {
    logger.error('❌ Error obteniendo relays:', error);
    reply.code(500).send({ error: 'Internal Server Error' });
  }
});

/**
 * POST /relays
 * Agregar nuevo relay
 */
server.post<{ Body: z.infer<typeof RelayConfigRequestSchema> }>('/relays', {
  schema: {
    tags: ['relays'],
    summary: 'Agregar nuevo relay',
    body: {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 1 },
        type: { type: 'string', enum: ['flashbots', 'bloxroute', 'eden', 'beaver', 'titan'] },
        endpoint: { type: 'string', format: 'uri' },
        auth_header: { type: 'string' },
        api_key: { type: 'string' },
        signing_key: { type: 'string', pattern: '^0x[a-fA-F0-9]{64}$' },
        priority: { type: 'number', minimum: 1, maximum: 10 },
        weight: { type: 'number', minimum: 0, maximum: 1 },
        timeout_ms: { type: 'number', minimum: 1000, maximum: 30000 },
        enabled: { type: 'boolean' }
      },
      required: ['name', 'type', 'endpoint']
    }
  }
}, async (request, reply) => {
  try {
    const validated = RelayConfigRequestSchema.parse(request.body);
    
    const relayConfig: RelayConfig = {
      relay_id: crypto.randomUUID(),
      ...validated,
      max_block_delay: 0,
      retry_attempts: 2
    };
    
    await relayManager.addRelay(relayConfig);
    
    reply.code(201).send({
      relay_id: relayConfig.relay_id,
      message: 'Relay agregado correctamente'
    });
  } catch (error) {
    logger.error('❌ Error agregando relay:', error);
    reply.code(500).send({
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /relays/:id
 * Obtener relay específico
 */
server.get<{ Params: { id: string } }>('/relays/:id', {
  schema: {
    tags: ['relays'],
    summary: 'Obtener relay específico'
  }
}, async (request, reply) => {
  try {
    const relay = relayManager.getRelay(request.params.id);
    
    if (!relay) {
      reply.code(404).send({
        error: 'Not Found',
        message: `Relay ${request.params.id} no encontrado`
      });
      return;
    }
    
    reply.code(200).send(relay);
  } catch (error) {
    logger.error(`❌ Error obteniendo relay ${request.params.id}:`, error);
    reply.code(500).send({ error: 'Internal Server Error' });
  }
});

/**
 * POST /relays/:id/action
 * Ejecutar acción en relay
 */
server.post<{ 
  Params: { id: string }, 
  Body: z.infer<typeof RelayActionSchema> 
}>('/relays/:id/action', {
  schema: {
    tags: ['relays'],
    summary: 'Ejecutar acción en relay',
    body: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['enable', 'disable', 'reset_stats'] }
      }
    }
  }
}, async (request, reply) => {
  try {
    const relayId = request.params.id;
    const { action } = RelayActionSchema.parse(request.body);
    
    switch (action) {
      case 'enable':
        await relayManager.toggleRelay(relayId, true);
        break;
      case 'disable':
        await relayManager.toggleRelay(relayId, false);
        break;
      case 'reset_stats':
        // Implementar reset de estadísticas
        logger.info(`🔄 Reset de estadísticas para relay ${relayId}`);
        break;
    }
    
    reply.code(200).send({
      message: `Acción ${action} ejecutada en relay ${relayId}`
    });
  } catch (error) {
    logger.error(`❌ Error ejecutando acción en relay ${request.params.id}:`, error);
    reply.code(500).send({ error: 'Internal Server Error' });
  }
});

// ============================================================================
// ENDPOINTS DE TRACKING
// ============================================================================

/**
 * GET /tracking/statistics
 * Obtener estadísticas de tracking
 */
server.get('/tracking/statistics', {
  schema: {
    tags: ['tracking'],
    summary: 'Estadísticas de tracking de inclusión'
  }
}, async (request, reply) => {
  try {
    const stats = await inclusionTracker.getTrackingStatistics();
    reply.code(200).send(stats);
  } catch (error) {
    logger.error('❌ Error obteniendo estadísticas de tracking:', error);
    reply.code(500).send({ error: 'Internal Server Error' });
  }
});

/**
 * GET /tracking/bundle/:id/events
 * Obtener eventos de tracking de bundle
 */
server.get<{ Params: { id: string } }>('/tracking/bundle/:id/events', {
  schema: {
    tags: ['tracking'],
    summary: 'Eventos de tracking de bundle'
  }
}, async (request, reply) => {
  try {
    const events = await inclusionTracker.getBundleTrackingEvents(request.params.id);
    reply.code(200).send({
      bundle_id: request.params.id,
      events,
      total_events: events.length
    });
  } catch (error) {
    logger.error(`❌ Error obteniendo eventos de ${request.params.id}:`, error);
    reply.code(500).send({ error: 'Internal Server Error' });
  }
});

/**
 * POST /tracking/bundle/:id/force-check
 * Forzar verificación de bundle
 */
server.post<{ Params: { id: string } }>('/tracking/bundle/:id/force-check', {
  schema: {
    tags: ['tracking'],
    summary: 'Forzar verificación de inclusión de bundle'
  }
}, async (request, reply) => {
  try {
    const success = await inclusionTracker.forceCheckBundle(request.params.id);
    
    if (success) {
      reply.code(200).send({
        message: `Verificación forzada para bundle ${request.params.id}`,
        checked: true
      });
    } else {
      reply.code(404).send({
        error: 'Not Found',
        message: `Bundle ${request.params.id} no está siendo tracked`
      });
    }
  } catch (error) {
    logger.error(`❌ Error forzando check ${request.params.id}:`, error);
    reply.code(500).send({ error: 'Internal Server Error' });
  }
});

// ============================================================================
// ENDPOINTS DE MÉTRICAS
// ============================================================================

/**
 * GET /metrics
 * Métricas de Prometheus
 */
server.get('/metrics', {
  schema: {
    tags: ['metrics'],
    summary: 'Métricas de Prometheus'
  }
}, async (request, reply) => {
  try {
    const metrics = await metricsService.getPrometheusMetrics();
    reply.type('text/plain').send(metrics);
  } catch (error) {
    logger.error('❌ Error obteniendo métricas de Prometheus:', error);
    reply.code(500).send({ error: 'Internal Server Error' });
  }
});

/**
 * GET /metrics/report
 * Reporte detallado de métricas
 */
server.get('/metrics/report', {
  schema: {
    tags: ['metrics'],
    summary: 'Reporte detallado de métricas'
  }
}, async (request, reply) => {
  try {
    const report = await metricsService.generateMetricsReport();
    reply.code(200).send(report);
  } catch (error) {
    logger.error('❌ Error generando reporte de métricas:', error);
    reply.code(500).send({ error: 'Internal Server Error' });
  }
});

/**
 * GET /metrics/top-relays
 * Top relays por performance
 */
server.get('/metrics/top-relays', {
  schema: {
    tags: ['metrics'],
    summary: 'Top relays por performance'
  }
}, async (request, reply) => {
  try {
    const topRelays = await metricsService.getTopRelaysByPerformance(10);
    reply.code(200).send({
      top_relays: topRelays,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('❌ Error obteniendo top relays:', error);
    reply.code(500).send({ error: 'Internal Server Error' });
  }
});

// ============================================================================
// ENDPOINTS DE HEALTH CHECK
// ============================================================================

/**
 * GET /health
 * Health check básico
 */
server.get('/health', {
  schema: {
    tags: ['health'],
    summary: 'Health check básico'
  }
}, async (request, reply) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '3.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    memory: {
      used: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
      total: Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) / 100
    }
  };

  reply.code(200).send(health);
});

/**
 * GET /health/detailed
 * Health check detallado
 */
server.get('/health/detailed', {
  schema: {
    tags: ['health'],
    summary: 'Health check detallado con estado de servicios'
  }
}, async (request, reply) => {
  try {
    const relays = relayManager.getAllRelays();
    const activeBundles = bundleEngine.getActiveBundles();
    const trackingStats = await inclusionTracker.getTrackingStatistics();
    const redisStats = await metricsService.getRedisStats();

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '3.0.0',
      services: {
        redis: {
          status: redisStats.connection_status,
          details: redisStats
        },
        relay_manager: {
          status: 'running',
          total_relays: relays.length,
          active_relays: relays.filter(r => r.status === 'active').length,
          failed_relays: relays.filter(r => r.status === 'failed').length
        },
        bundle_engine: {
          status: 'running',
          active_bundles: activeBundles.length
        },
        inclusion_tracker: {
          status: 'running',
          tracking_statistics: trackingStats
        },
        metrics_service: {
          status: 'running',
          prometheus_metrics_available: true
        }
      },
      system: {
        uptime_seconds: process.uptime(),
        memory_usage_mb: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
        cpu_usage: process.cpuUsage(),
        environment: process.env.NODE_ENV || 'development'
      }
    };

    reply.code(200).send(health);
  } catch (error) {
    logger.error('❌ Error en health check detallado:', error);
    reply.code(503).send({
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /health/ready
 * Readiness probe
 */
server.get('/health/ready', {
  schema: {
    tags: ['health'],
    summary: 'Readiness probe para Kubernetes'
  }
}, async (request, reply) => {
  try {
    // Verificar Redis
    await redis.ping();
    
    // Verificar que tengamos relays disponibles
    const availableRelays = relayManager.getAvailableRelays();
    const readiness = {
      ready: availableRelays.length > 0,
      checks: {
        redis_connection: true,
        available_relays: availableRelays.length,
        relay_types_available: [...new Set(availableRelays.map(r => r.config.type))]
      }
    };

    if (readiness.ready) {
      reply.code(200).send(readiness);
    } else {
      reply.code(503).send(readiness);
    }
  } catch (error) {
    logger.error('❌ Error en readiness probe:', error);
    reply.code(503).send({
      ready: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================================================
// INICIALIZACIÓN Y STARTUP
// ============================================================================

/**
 * Inicialización del servidor
 */
async function start(): Promise<void> {
  try {
    // Configurar servidor
    await setupServer();
    
    // Conectar Redis
    await redis.connect();
    logger.info('✅ Redis conectado correctamente');
    
    // Configurar graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`🛑 Recibida señal ${signal}, iniciando graceful shutdown...`);
      
      try {
        await bundleEngine.shutdown();
        await inclusionTracker.shutdown();
        await relayManager.shutdown();
        await redis.quit();
        await server.close();
        
        logger.info('✅ Graceful shutdown completado');
        process.exit(0);
      } catch (error) {
        logger.error('❌ Error durante graceful shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Iniciar servidor
    const port = parseInt(process.env.PORT || '3004');
    const host = process.env.HOST || '0.0.0.0';
    
    await server.listen({ port, host });
    
    logger.info(
      `🚀 ArbitrageX Supreme V3.0 - Multi-Relay Client iniciado en ${host}:${port}\n` +
      `📖 Documentación: http://${host}:${port}/docs\n` +
      `📊 Métricas: http://${host}:${port}/metrics\n` +
      `💚 Health: http://${host}:${port}/health\n` +
      `🔗 Relays soportados: Flashbots, bloXroute, Eden Network, Beaver Build, Titan Builder`
    );

  } catch (error) {
    logger.error('❌ Error iniciando servidor:', error);
    process.exit(1);
  }
}

// Iniciar aplicación
start();
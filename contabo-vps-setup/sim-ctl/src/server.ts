import Fastify, { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Redis from 'ioredis';
import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

// Services
import { AnvilManager } from './services/anvilManager.js';
import { SimulationEngine } from './services/simulationEngine.js';
import { MetricsService } from './services/metricsService.js';

// Types
import {
  SimulationRequestSchema,
  SimulationRequest,
  SimulationResult,
  AnvilInstance,
  SimulationStrategy,
  AnvilInstanceStatus,
  PerformanceMetrics
} from './types/simulation.js';

// Configuración del servidor
const server: FastifyInstance = Fastify({
  logger: false, // Usamos winston
  trustProxy: true,
  bodyLimit: 10485760, // 10MB
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
      filename: '/app/logs/sim-ctl.log',
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
let anvilManager: AnvilManager;
let simulationEngine: SimulationEngine;
let metricsService: MetricsService;

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

  // Rate limiting
  await server.register(rateLimit, {
    max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
    timeWindow: '1 minute',
    errorResponseBuilder: () => ({
      error: 'Rate limit exceeded',
      message: 'Too many requests, please try again later'
    })
  });

  // Swagger documentation
  await server.register(swagger, {
    swagger: {
      info: {
        title: 'ArbitrageX Supreme V3.0 - Simulation Controller API',
        description: 'Anvil-Real Simulation Controller para estrategias de arbitraje',
        version: '3.0.0'
      },
      host: process.env.API_HOST || 'localhost:3002',
      schemes: ['http', 'https'],
      consumes: ['application/json'],
      produces: ['application/json'],
      tags: [
        { name: 'simulation', description: 'Endpoints de simulación' },
        { name: 'instances', description: 'Gestión de instancias Anvil' },
        { name: 'metrics', description: 'Métricas y monitoreo' },
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

  // Inicializar servicios
  anvilManager = new AnvilManager(redis, logger);
  simulationEngine = new SimulationEngine(redis, logger, anvilManager);
  metricsService = new MetricsService(redis, logger);

  logger.info('🔧 Servicios de sim-ctl inicializados correctamente');
}

/**
 * Schemas de validación para endpoints
 */
const CreateInstanceRequestSchema = z.object({
  strategy: z.enum(['A', 'C', 'D', 'F']),
  chain_id: z.number().int().positive().optional()
});

const InstanceActionSchema = z.object({
  action: z.enum(['start', 'stop', 'restart'])
});

// ============================================================================
// ENDPOINTS DE SIMULACIÓN
// ============================================================================

/**
 * POST /simulation/execute
 * Ejecutar simulación de arbitraje
 */
server.post<{ Body: SimulationRequest }>('/simulation/execute', {
  schema: {
    tags: ['simulation'],
    summary: 'Ejecutar simulación de arbitraje',
    body: {
      type: 'object',
      properties: {
        simulation_id: { type: 'string', format: 'uuid' },
        strategy: { type: 'string', enum: ['A', 'C', 'D', 'F'] },
        chain_id: { type: 'number', minimum: 1 },
        fork_block_number: { type: 'number', minimum: 1 },
        transactions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              to: { type: 'string', pattern: '^0x[a-fA-F0-9]{40}$' },
              data: { type: 'string', pattern: '^0x[a-fA-F0-9]*$' },
              value: { type: 'string', default: '0' },
              gas_limit: { type: 'string' },
              gas_price: { type: 'string' }
            },
            required: ['to', 'data']
          }
        },
        timeout_seconds: { type: 'number', minimum: 1, maximum: 300, default: 60 },
        real_only: { type: 'boolean', default: true }
      },
      required: ['simulation_id', 'strategy', 'chain_id', 'transactions']
    },
    response: {
      200: {
        type: 'object',
        properties: {
          simulation_id: { type: 'string' },
          instance_id: { type: 'string' },
          strategy: { type: 'string' },
          status: { type: 'string' },
          execution_time_ms: { type: 'number' }
        }
      },
      400: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          details: { type: 'string' }
        }
      }
    }
  }
}, async (request: FastifyRequest<{ Body: SimulationRequest }>, reply: FastifyReply) => {
  try {
    // Validar request con Zod
    const validatedRequest = SimulationRequestSchema.parse(request.body);
    
    logger.info(
      `🔬 Nueva simulación recibida: ${validatedRequest.simulation_id} ` +
      `(estrategia ${validatedRequest.strategy})`
    );

    // Ejecutar simulación
    const result = await simulationEngine.executeSimulation(validatedRequest);
    
    // Registrar métricas
    metricsService.recordSimulation(
      result.strategy,
      result.chain_id,
      result.status,
      result.execution_time_ms,
      result.gas_used,
      result.profitability?.net_profit
    );

    reply.code(200).send({
      simulation_id: result.simulation_id,
      instance_id: result.instance_id,
      strategy: result.strategy,
      status: result.status,
      execution_time_ms: result.execution_time_ms,
      block_number: result.block_number,
      gas_used: result.gas_used,
      profitability: result.profitability,
      transaction_results: result.transaction_results,
      error_message: result.error_message
    });

  } catch (error) {
    logger.error('❌ Error en /simulation/execute:', error);
    
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
 * GET /simulation/result/:id
 * Obtener resultado de simulación
 */
server.get<{ Params: { id: string } }>('/simulation/result/:id', {
  schema: {
    tags: ['simulation'],
    summary: 'Obtener resultado de simulación',
    params: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' }
      },
      required: ['id']
    }
  }
}, async (request, reply) => {
  try {
    const simulationId = request.params.id;
    const result = await simulationEngine.getSimulationResult(simulationId);
    
    if (!result) {
      reply.code(404).send({
        error: 'Not Found',
        message: `Simulación ${simulationId} no encontrada`
      });
      return;
    }
    
    reply.code(200).send(result);
  } catch (error) {
    logger.error(`❌ Error obteniendo resultado ${request.params.id}:`, error);
    reply.code(500).send({
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /simulation/cancel/:id
 * Cancelar simulación activa
 */
server.delete<{ Params: { id: string } }>('/simulation/cancel/:id', {
  schema: {
    tags: ['simulation'],
    summary: 'Cancelar simulación activa'
  }
}, async (request, reply) => {
  try {
    const simulationId = request.params.id;
    const cancelled = await simulationEngine.cancelSimulation(simulationId);
    
    if (cancelled) {
      reply.code(200).send({
        message: `Simulación ${simulationId} cancelada`,
        cancelled: true
      });
    } else {
      reply.code(404).send({
        error: 'Not Found',
        message: `Simulación ${simulationId} no está activa`
      });
    }
  } catch (error) {
    logger.error(`❌ Error cancelando simulación ${request.params.id}:`, error);
    reply.code(500).send({ error: 'Internal Server Error' });
  }
});

// ============================================================================
// ENDPOINTS DE INSTANCIAS ANVIL
// ============================================================================

/**
 * GET /instances
 * Obtener todas las instancias Anvil
 */
server.get('/instances', {
  schema: {
    tags: ['instances'],
    summary: 'Obtener todas las instancias Anvil'
  }
}, async (request, reply) => {
  try {
    const instances = anvilManager.getAllInstances();
    
    // Actualizar métricas
    metricsService.updateInstanceMetrics(instances);
    
    reply.code(200).send({
      instances,
      total: instances.length,
      by_status: instances.reduce((acc: any, instance) => {
        acc[instance.status] = (acc[instance.status] || 0) + 1;
        return acc;
      }, {})
    });
  } catch (error) {
    logger.error('❌ Error obteniendo instancias:', error);
    reply.code(500).send({ error: 'Internal Server Error' });
  }
});

/**
 * POST /instances
 * Crear nueva instancia Anvil
 */
server.post<{ Body: z.infer<typeof CreateInstanceRequestSchema> }>('/instances', {
  schema: {
    tags: ['instances'],
    summary: 'Crear nueva instancia Anvil',
    body: {
      type: 'object',
      properties: {
        strategy: { type: 'string', enum: ['A', 'C', 'D', 'F'] },
        chain_id: { type: 'number', minimum: 1 }
      },
      required: ['strategy']
    }
  }
}, async (request, reply) => {
  try {
    const validated = CreateInstanceRequestSchema.parse(request.body);
    const instanceId = await anvilManager.createInstance(validated.strategy, validated.chain_id);
    
    reply.code(201).send({
      instance_id: instanceId,
      message: 'Instancia creada correctamente'
    });
  } catch (error) {
    logger.error('❌ Error creando instancia:', error);
    reply.code(500).send({
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /instances/:id
 * Obtener instancia específica
 */
server.get<{ Params: { id: string } }>('/instances/:id', {
  schema: {
    tags: ['instances'],
    summary: 'Obtener instancia específica'
  }
}, async (request, reply) => {
  try {
    const instance = anvilManager.getInstance(request.params.id);
    
    if (!instance) {
      reply.code(404).send({
        error: 'Not Found',
        message: `Instancia ${request.params.id} no encontrada`
      });
      return;
    }
    
    reply.code(200).send(instance);
  } catch (error) {
    logger.error(`❌ Error obteniendo instancia ${request.params.id}:`, error);
    reply.code(500).send({ error: 'Internal Server Error' });
  }
});

/**
 * POST /instances/:id/action
 * Ejecutar acción en instancia (start, stop, restart)
 */
server.post<{ 
  Params: { id: string }, 
  Body: z.infer<typeof InstanceActionSchema> 
}>('/instances/:id/action', {
  schema: {
    tags: ['instances'],
    summary: 'Ejecutar acción en instancia',
    body: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['start', 'stop', 'restart'] }
      },
      required: ['action']
    }
  }
}, async (request, reply) => {
  try {
    const instanceId = request.params.id;
    const { action } = InstanceActionSchema.parse(request.body);
    
    switch (action) {
      case 'stop':
        await anvilManager.stopInstance(instanceId);
        break;
      case 'restart':
        await anvilManager.restartInstance(instanceId);
        break;
      default:
        reply.code(400).send({
          error: 'Bad Request',
          message: `Acción ${action} no soportada`
        });
        return;
    }
    
    reply.code(200).send({
      message: `Acción ${action} ejecutada en instancia ${instanceId}`
    });
  } catch (error) {
    logger.error(`❌ Error ejecutando acción en instancia ${request.params.id}:`, error);
    reply.code(500).send({
      error: 'Internal Server Error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
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
 * GET /metrics/performance
 * Summary de performance del sistema
 */
server.get('/metrics/performance', {
  schema: {
    tags: ['metrics'],
    summary: 'Summary de performance del sistema'
  }
}, async (request, reply) => {
  try {
    const summary = await metricsService.getPerformanceSummary();
    reply.code(200).send(summary);
  } catch (error) {
    logger.error('❌ Error obteniendo performance summary:', error);
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
    const instances = anvilManager.getAllInstances();
    const activeSimulations = simulationEngine.getActiveSimulations();
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
        anvil_manager: {
          status: 'running',
          total_instances: instances.length,
          running_instances: instances.filter(i => i.status === 'running').length,
          failed_instances: instances.filter(i => i.status === 'error').length
        },
        simulation_engine: {
          status: 'running',
          active_simulations: activeSimulations.length,
          simulation_ids: activeSimulations
        },
        metrics_service: {
          status: 'running',
          prometheus_metrics: (await metricsService.getPrometheusMetrics()).split('\n').length
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
    // Verificar que Redis esté conectado
    await redis.ping();
    
    // Verificar que haya al menos una instancia por estrategia
    const strategies: SimulationStrategy[] = ['A', 'C', 'D', 'F'];
    const readiness = {
      ready: true,
      checks: {} as Record<string, boolean>
    };

    for (const strategy of strategies) {
      const instances = await anvilManager.getInstancesByStrategy(strategy);
      const runningInstances = instances.filter(i => i.status === 'running');
      readiness.checks[`strategy_${strategy}`] = runningInstances.length > 0;
      
      if (runningInstances.length === 0) {
        readiness.ready = false;
      }
    }

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

    // Inicializar pools de instancias Anvil
    await anvilManager.initializePools();
    
    // Configurar graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`🛑 Recibida señal ${signal}, iniciando graceful shutdown...`);
      
      try {
        await simulationEngine.shutdown();
        await anvilManager.shutdown();
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
    const port = parseInt(process.env.PORT || '3002');
    const host = process.env.HOST || '0.0.0.0';
    
    await server.listen({ port, host });
    
    logger.info(
      `🚀 ArbitrageX Supreme V3.0 - Simulation Controller iniciado en ${host}:${port}\n` +
      `📖 Documentación: http://${host}:${port}/docs\n` +
      `📊 Métricas: http://${host}:${port}/metrics\n` +
      `💚 Health: http://${host}:${port}/health`
    );

  } catch (error) {
    logger.error('❌ Error iniciando servidor:', error);
    process.exit(1);
  }
}

// Iniciar aplicación
start();
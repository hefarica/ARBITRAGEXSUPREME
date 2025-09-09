// ================================
// ArbitrageX Supreme V3.0 - Selector API
// API de selección/score (servicio frontal del selector)
// ================================

import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUI from '@fastify/swagger-ui';
import { createClient } from 'redis';
import axios from 'axios';
import { z } from 'zod';
import dotenv from 'dotenv';
import promClient from 'prom-client';

dotenv.config();

// ================================
// Configuración y Tipos
// ================================

interface ServerConfig {
  port: number;
  host: string;
  searcherRsUrl: string;
  redisUrl: string;
  logLevel: string;
  environment: string;
}

interface SelectionCandidate {
  id: string;
  strategyType: string;
  chainId: number;
  primaryToken: string;
  secondaryToken: string;
  venuePrimary: string;
  venueSecondary?: string;
  estimatedProfitUsd: number;
  confidenceScore: number;
  executionCostUsd: number;
  netProfitUsd: number;
  riskLevel: 'Low' | 'Medium' | 'High' | 'Critical';
  selectionReasons: Array<{
    category: string;
    description: string;
    scoreImpact: number;
    confidence: number;
  }>;
  rejectionReasons: Array<{
    category: string;
    description: string;
    isFatal: boolean;
    thresholdValue?: number;
    actualValue?: number;
  }>;
  metadata: Record<string, any>;
}

interface CandidatesRequest {
  strategyType: string;
  chainIds?: number[];
  minProfitUsd?: number;
  maxRiskLevel?: string;
  limit?: number;
}

// Schemas de validación
const candidatesRequestSchema = z.object({
  strategyType: z.string().min(1),
  chainIds: z.array(z.number()).optional(),
  minProfitUsd: z.number().min(0).optional(),
  maxRiskLevel: z.enum(['Low', 'Medium', 'High', 'Critical']).optional(),
  limit: z.number().min(1).max(1000).optional().default(100),
});

// ================================
// Métricas Prometheus
// ================================

const register = new promClient.Register();

const apiRequestsTotal = new promClient.Counter({
  name: 'selector_api_requests_total',
  help: 'Total number of API requests',
  labelNames: ['method', 'endpoint', 'status_code'],
  registers: [register],
});

const apiRequestDuration = new promClient.Histogram({
  name: 'selector_api_request_duration_seconds',
  help: 'API request duration in seconds',
  labelNames: ['method', 'endpoint'],
  registers: [register],
});

const candidatesGenerated = new promClient.Gauge({
  name: 'selector_candidates_generated_total',
  help: 'Number of candidates generated',
  labelNames: ['strategy_type'],
  registers: [register],
});

const searcherRsLatency = new promClient.Histogram({
  name: 'selector_searcher_rs_latency_seconds',
  help: 'Latency of calls to searcher-rs',
  registers: [register],
});

// ================================
// Configuración del Servidor
// ================================

function loadConfig(): ServerConfig {
  return {
    port: parseInt(process.env.PORT || '3000'),
    host: process.env.HOST || '0.0.0.0',
    searcherRsUrl: process.env.SEARCHER_RS_URL || 'http://searcher-rs:3001',
    redisUrl: process.env.REDIS_URL || 'redis://redis:6379/1',
    logLevel: process.env.LOG_LEVEL || 'info',
    environment: process.env.NODE_ENV || 'production',
  };
}

// ================================
// Cliente Redis
// ================================

async function createRedisClient(redisUrl: string) {
  const client = createClient({ url: redisUrl });
  
  client.on('error', (err) => {
    console.error('Redis Client Error:', err);
  });
  
  client.on('connect', () => {
    console.log('✅ Redis client connected');
  });
  
  await client.connect();
  return client;
}

// ================================
// Servicio de Selección
// ================================

class SelectorService {
  private searcherRsUrl: string;
  private redisClient: any;
  
  constructor(searcherRsUrl: string, redisClient: any) {
    this.searcherRsUrl = searcherRsUrl;
    this.redisClient = redisClient;
  }

  async getCandidates(request: CandidatesRequest): Promise<{
    candidates: SelectionCandidate[];
    metadata: {
      totalCandidates: number;
      processingTimeMs: number;
      cacheHit: boolean;
      strategyType: string;
    };
  }> {
    const startTime = Date.now();
    const cacheKey = `candidates:${JSON.stringify(request)}`;
    
    try {
      // Intentar obtener desde cache
      const cached = await this.redisClient.get(cacheKey);
      if (cached) {
        const result = JSON.parse(cached);
        result.metadata.cacheHit = true;
        result.metadata.processingTimeMs = Date.now() - startTime;
        return result;
      }

      // Llamar al searcher-rs para generar candidatos
      const searcherTimer = searcherRsLatency.startTimer();
      const response = await axios.post(
        `${this.searcherRsUrl}/api/v1/selectors/generate-candidates`,
        request,
        {
          timeout: 5000,
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      searcherTimer();

      const candidates: SelectionCandidate[] = response.data.candidates || [];
      
      // Aplicar filtros adicionales
      const filteredCandidates = this.applyFilters(candidates, request);
      
      const result = {
        candidates: filteredCandidates,
        metadata: {
          totalCandidates: filteredCandidates.length,
          processingTimeMs: Date.now() - startTime,
          cacheHit: false,
          strategyType: request.strategyType,
        },
      };

      // Cachear resultado por 30 segundos
      await this.redisClient.setEx(cacheKey, 30, JSON.stringify(result));

      // Actualizar métricas
      candidatesGenerated
        .labels({ strategy_type: request.strategyType })
        .set(filteredCandidates.length);

      return result;

    } catch (error) {
      console.error('Error generating candidates:', error);
      throw new Error(`Failed to generate candidates: ${error.message}`);
    }
  }

  private applyFilters(
    candidates: SelectionCandidate[],
    request: CandidatesRequest
  ): SelectionCandidate[] {
    let filtered = candidates;

    // Filtrar por chainIds si se especifica
    if (request.chainIds && request.chainIds.length > 0) {
      filtered = filtered.filter(c => request.chainIds!.includes(c.chainId));
    }

    // Filtrar por profit mínimo
    if (request.minProfitUsd !== undefined) {
      filtered = filtered.filter(c => c.estimatedProfitUsd >= request.minProfitUsd!);
    }

    // Filtrar por nivel de riesgo máximo
    if (request.maxRiskLevel) {
      const riskLevels = ['Low', 'Medium', 'High', 'Critical'];
      const maxRiskIndex = riskLevels.indexOf(request.maxRiskLevel);
      filtered = filtered.filter(c => 
        riskLevels.indexOf(c.riskLevel) <= maxRiskIndex
      );
    }

    // Ordenar por profit neto descendente
    filtered.sort((a, b) => b.netProfitUsd - a.netProfitUsd);

    // Aplicar límite
    if (request.limit) {
      filtered = filtered.slice(0, request.limit);
    }

    return filtered;
  }

  async getHealthStatus(): Promise<{
    status: 'healthy' | 'unhealthy';
    services: {
      searcherRs: boolean;
      redis: boolean;
    };
    uptime: number;
    version: string;
  }> {
    const startTime = Date.now();
    const services = {
      searcherRs: false,
      redis: false,
    };

    // Verificar searcher-rs
    try {
      await axios.get(`${this.searcherRsUrl}/health`, { timeout: 2000 });
      services.searcherRs = true;
    } catch (error) {
      console.warn('Searcher-rs health check failed:', error.message);
    }

    // Verificar Redis
    try {
      await this.redisClient.ping();
      services.redis = true;
    } catch (error) {
      console.warn('Redis health check failed:', error.message);
    }

    const allHealthy = Object.values(services).every(Boolean);

    return {
      status: allHealthy ? 'healthy' : 'unhealthy',
      services,
      uptime: process.uptime(),
      version: '3.0.0',
    };
  }
}

// ================================
// Configuración del Servidor Fastify
// ================================

async function createServer(): Promise<FastifyInstance> {
  const config = loadConfig();
  
  const server = fastify({
    logger: {
      level: config.logLevel,
      transport: config.environment === 'development' ? {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      } : undefined,
    },
  });

  // Middleware básico
  await server.register(helmet);
  await server.register(cors, {
    origin: true,
    methods: ['GET', 'POST'],
  });

  // Rate limiting
  await server.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // Swagger documentation
  await server.register(swagger, {
    swagger: {
      info: {
        title: 'ArbitrageX Selector API',
        description: 'API de selección y scoring para estrategias de arbitraje',
        version: '3.0.0',
      },
      host: 'localhost:3000',
      schemes: ['http', 'https'],
      consumes: ['application/json'],
      produces: ['application/json'],
    },
  });

  await server.register(swaggerUI, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'full',
      deepLinking: false,
    },
    uiHooks: {
      onRequest: function (request, reply, next) {
        next();
      },
      preHandler: function (request, reply, next) {
        next();
      },
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
  });

  return server;
}

// ================================
// Rutas de la API
// ================================

async function registerRoutes(
  server: FastifyInstance, 
  selectorService: SelectorService
) {
  // Middleware de métricas
  server.addHook('onRequest', async (request) => {
    request.startTime = Date.now();
  });

  server.addHook('onResponse', async (request, reply) => {
    const duration = (Date.now() - request.startTime!) / 1000;
    const endpoint = request.routerPath || request.url;
    
    apiRequestsTotal
      .labels({
        method: request.method,
        endpoint,
        status_code: reply.statusCode.toString(),
      })
      .inc();

    apiRequestDuration
      .labels({
        method: request.method,
        endpoint,
      })
      .observe(duration);
  });

  // Ruta principal: obtener candidatos
  server.post<{
    Body: CandidatesRequest;
  }>('/selector/candidates', {
    schema: {
      description: 'Obtener candidatos de arbitraje con razones de selección',
      tags: ['Selection'],
      body: {
        type: 'object',
        required: ['strategyType'],
        properties: {
          strategyType: {
            type: 'string',
            description: 'Tipo de estrategia (A, C, D, F)',
            enum: ['A', 'C', 'D', 'F', 'dex_arbitrage', 'cross_chain_arbitrage', 'delta_neutral', 'flash_loan_arbitrage'],
          },
          chainIds: {
            type: 'array',
            items: { type: 'number' },
            description: 'IDs de chains a considerar (opcional)',
          },
          minProfitUsd: {
            type: 'number',
            minimum: 0,
            description: 'Profit mínimo en USD (opcional)',
          },
          maxRiskLevel: {
            type: 'string',
            enum: ['Low', 'Medium', 'High', 'Critical'],
            description: 'Nivel máximo de riesgo (opcional)',
          },
          limit: {
            type: 'number',
            minimum: 1,
            maximum: 1000,
            default: 100,
            description: 'Número máximo de candidatos a retornar',
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            candidates: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  strategyType: { type: 'string' },
                  chainId: { type: 'number' },
                  estimatedProfitUsd: { type: 'number' },
                  confidenceScore: { type: 'number' },
                  riskLevel: { type: 'string' },
                },
              },
            },
            metadata: {
              type: 'object',
              properties: {
                totalCandidates: { type: 'number' },
                processingTimeMs: { type: 'number' },
                cacheHit: { type: 'boolean' },
                strategyType: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    try {
      // Validar request body
      const validatedRequest = candidatesRequestSchema.parse(request.body);
      
      const result = await selectorService.getCandidates(validatedRequest);
      
      reply.code(200).send(result);
    } catch (error) {
      server.log.error(error);
      reply.code(500).send({
        error: 'Internal Server Error',
        message: error.message,
      });
    }
  });

  // Health check
  server.get('/health', {
    schema: {
      description: 'Health check del servicio',
      tags: ['Health'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['healthy', 'unhealthy'] },
            services: { type: 'object' },
            uptime: { type: 'number' },
            version: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const health = await selectorService.getHealthStatus();
    
    const statusCode = health.status === 'healthy' ? 200 : 503;
    reply.code(statusCode).send(health);
  });

  // Métricas Prometheus
  server.get('/metrics', async (request, reply) => {
    reply.type('text/plain').send(await register.metrics());
  });

  // Root endpoint
  server.get('/', async (request, reply) => {
    reply.send({
      name: 'ArbitrageX Selector API',
      version: '3.0.0',
      description: 'API de selección/score (servicio frontal del selector)',
      endpoints: {
        candidates: 'POST /selector/candidates',
        health: 'GET /health',
        metrics: 'GET /metrics',
        docs: 'GET /docs',
      },
    });
  });
}

// ================================
// Inicio del Servidor
// ================================

async function start() {
  try {
    const config = loadConfig();
    
    console.log('🚀 Iniciando ArbitrageX Selector API v3.0.0');
    console.log(`📊 Modo: ${config.environment}`);
    console.log(`🔗 Searcher-rs URL: ${config.searcherRsUrl}`);
    
    // Inicializar Redis
    const redisClient = await createRedisClient(config.redisUrl);
    
    // Crear servidor
    const server = await createServer();
    
    // Crear servicio
    const selectorService = new SelectorService(config.searcherRsUrl, redisClient);
    
    // Registrar rutas
    await registerRoutes(server, selectorService);
    
    // Iniciar servidor
    await server.listen({ port: config.port, host: config.host });
    
    console.log(`✅ Selector API iniciado en http://${config.host}:${config.port}`);
    console.log(`📚 Documentación disponible en http://${config.host}:${config.port}/docs`);
    
    // Graceful shutdown
    const signals = ['SIGINT', 'SIGTERM'];
    signals.forEach((signal) => {
      process.on(signal, async () => {
        console.log(`🛑 Recibida señal ${signal}, cerrando servidor...`);
        
        await server.close();
        await redisClient.quit();
        
        console.log('✅ Servidor cerrado correctamente');
        process.exit(0);
      });
    });
    
  } catch (error) {
    console.error('❌ Error iniciando servidor:', error);
    process.exit(1);
  }
}

// Declaración de tipos para request
declare module 'fastify' {
  interface FastifyRequest {
    startTime?: number;
  }
}

// Inicio de la aplicación
if (require.main === module) {
  start();
}

export { start, createServer };
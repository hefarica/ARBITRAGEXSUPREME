// ArbitrageX Pro 2025 - Main API Server
// Enterprise-grade Fastify server with multi-tenant architecture

import Fastify, { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import websocket from '@fastify/websocket';
import Redis from 'ioredis';

// Route imports
import { authRoutes } from './api/v2/auth';
import { tenantRoutes } from './api/v2/tenant';
import { arbitrageRoutes } from './api/v2/arbitrage';
import { blockchainRoutes } from './api/v2/blockchain';
import { billingRoutes } from './api/v2/billing';
import { dashboardRoutes } from './api/v2/dashboard';
import { webhookRoutes } from './api/webhooks';

// Service imports
import { TenantService } from './saas/tenant/tenant.service';
import { AuthService } from './saas/auth/auth.service';
import { BillingService } from './saas/billing/billing.service';
import { ArbitrageService } from './core/arbitrage/arbitrage.service';
import { BlockchainService } from './core/blockchain/blockchain.service';

// Shared imports
import { DatabaseService } from './shared/database/database.service';
import { CacheService } from './shared/cache/cache.service';
import { EventService } from './shared/events/event.service';
import { MonitoringService } from './shared/monitoring/monitoring.service';
import { SecurityService } from './shared/security/security.service';

// Types
interface AppConfig {
  port: number;
  host: string;
  environment: string;
  cors: {
    origin: string[];
    credentials: boolean;
  };
  jwt: {
    secret: string;
    expiresIn: string;
  };
  rateLimit: {
    max: number;
    timeWindow: string;
  };
}

class ArbitrageXServer {
  private fastify: FastifyInstance;
  private prisma: PrismaClient;
  private redis: Redis;
  private config: AppConfig;

  constructor() {
    this.config = this.loadConfig();
    this.fastify = Fastify({
      logger: {
        level: process.env.LOG_LEVEL || 'info',
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        },
      },
      requestTimeout: 30000,
      bodyLimit: 10485760, // 10MB
    });

    this.prisma = new PrismaClient({
      log: ['query', 'info', 'warn', 'error'],
    });

    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
  }

  private loadConfig(): AppConfig {
    return {
      port: parseInt(process.env.PORT || '3001', 10),
      host: process.env.HOST || '0.0.0.0',
      environment: process.env.NODE_ENV || 'development',
      cors: {
        origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
        credentials: true,
      },
      jwt: {
        secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
        expiresIn: process.env.JWT_EXPIRES_IN || '24h',
      },
      rateLimit: {
        max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
        timeWindow: process.env.RATE_LIMIT_WINDOW || '1 minute',
      },
    };
  }

  private async registerPlugins(): Promise<void> {
    // Security plugins
    await this.fastify.register(helmet, {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
    });

    // CORS
    await this.fastify.register(cors, this.config.cors);

    // JWT Authentication
    await this.fastify.register(jwt, {
      secret: this.config.jwt.secret,
      sign: {
        expiresIn: this.config.jwt.expiresIn,
      },
    });

    // Rate Limiting
    await this.fastify.register(rateLimit, {
      max: this.config.rateLimit.max,
      timeWindow: this.config.rateLimit.timeWindow,
      keyGenerator: (request) => {
        return request.headers['x-tenant-id'] as string || request.ip;
      },
    });

    // WebSocket support for real-time features
    await this.fastify.register(websocket);

    // Health check
    this.fastify.get('/health', async (request, reply) => {
      const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: 'ok',
        redis: 'ok',
        memory: process.memoryUsage(),
      };

      try {
        await this.prisma.$queryRaw`SELECT 1`;
      } catch (error) {
        health.database = 'error';
        health.status = 'error';
      }

      try {
        await this.redis.ping();
      } catch (error) {
        health.redis = 'error';
        health.status = 'error';
      }

      const statusCode = health.status === 'ok' ? 200 : 503;
      return reply.code(statusCode).send(health);
    });

    // Readiness check
    this.fastify.get('/ready', async (request, reply) => {
      return reply.send({ status: 'ready', timestamp: new Date().toISOString() });
    });

    // Metrics endpoint for Prometheus
    this.fastify.get('/metrics', async (request, reply) => {
      // Basic metrics - in production, use proper Prometheus client
      const metrics = {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        timestamp: new Date().toISOString(),
      };
      return reply.send(metrics);
    });
  }

  private async registerServices(): Promise<void> {
    // Register core services as singletons
    const databaseService = new DatabaseService(this.prisma);
    const cacheService = new CacheService(this.redis);
    const eventService = new EventService();
    const monitoringService = new MonitoringService();
    const securityService = new SecurityService();

    // Register business services
    const tenantService = new TenantService(databaseService, cacheService);
    const authService = new AuthService(databaseService, cacheService, securityService);
    const billingService = new BillingService(databaseService, eventService);
    const arbitrageService = new ArbitrageService(databaseService, cacheService, eventService);
    const blockchainService = new BlockchainService(databaseService, cacheService);

    // Make services available to routes via decorators
    this.fastify.decorate('db', databaseService);
    this.fastify.decorate('cache', cacheService);
    this.fastify.decorate('events', eventService);
    this.fastify.decorate('monitoring', monitoringService);
    this.fastify.decorate('security', securityService);
    this.fastify.decorate('tenantService', tenantService);
    this.fastify.decorate('authService', authService);
    this.fastify.decorate('billingService', billingService);
    this.fastify.decorate('arbitrageService', arbitrageService);
    this.fastify.decorate('blockchainService', blockchainService);
  }

  private async registerRoutes(): Promise<void> {
    // API v2 routes (current)
    await this.fastify.register(authRoutes, { prefix: '/api/v2/auth' });
    await this.fastify.register(tenantRoutes, { prefix: '/api/v2/tenant' });
    await this.fastify.register(arbitrageRoutes, { prefix: '/api/v2/arbitrage' });
    await this.fastify.register(blockchainRoutes, { prefix: '/api/v2/blockchain' });
    await this.fastify.register(dashboardRoutes, { prefix: '/api/v2/dashboard' });
    await this.fastify.register(billingRoutes, { prefix: '/api/v2/billing' });

    // Webhook routes
    await this.fastify.register(webhookRoutes, { prefix: '/api/webhooks' });

    // WebSocket route for real-time updates
    this.fastify.register(async function (fastify) {
      fastify.get('/ws', { websocket: true }, (connection, request) => {
        connection.socket.on('message', message => {
          // Handle WebSocket messages
          const data = JSON.parse(message.toString());
          
          // Echo back for now - implement real-time arbitrage updates
          connection.socket.send(JSON.stringify({
            type: 'echo',
            data: data,
            timestamp: new Date().toISOString(),
          }));
        });

        // Send welcome message
        connection.socket.send(JSON.stringify({
          type: 'connected',
          message: 'ArbitrageX Pro 2025 WebSocket Connected',
          timestamp: new Date().toISOString(),
        }));
      });
    });
  }

  private async setupGracefulShutdown(): Promise<void> {
    const gracefulShutdown = async (signal: string) => {
      this.fastify.log.info(`Received ${signal}, closing server...`);
      
      try {
        await this.fastify.close();
        await this.prisma.$disconnect();
        await this.redis.disconnect();
        process.exit(0);
      } catch (error) {
        this.fastify.log.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  }

  public async start(): Promise<void> {
    try {
      // Connect to Redis
      await this.redis.connect();
      this.fastify.log.info('Connected to Redis');

      // Test database connection
      await this.prisma.$connect();
      this.fastify.log.info('Connected to database');

      // Register everything
      await this.registerPlugins();
      await this.registerServices();
      await this.registerRoutes();
      await this.setupGracefulShutdown();

      // Start server
      await this.fastify.listen({
        port: this.config.port,
        host: this.config.host,
      });

      this.fastify.log.info(`🚀 ArbitrageX Pro 2025 API Server running on ${this.config.host}:${this.config.port}`);
      this.fastify.log.info(`📊 Environment: ${this.config.environment}`);
      this.fastify.log.info(`🔗 Health Check: http://${this.config.host}:${this.config.port}/health`);
      this.fastify.log.info(`📈 Metrics: http://${this.config.host}:${this.config.port}/metrics`);

    } catch (error) {
      this.fastify.log.error('Failed to start server:', error);
      process.exit(1);
    }
  }
}

// Start the server
const server = new ArbitrageXServer();
server.start();

// Export for testing
export { ArbitrageXServer };
/**
 * ArbitrageX Supreme V3.0 - Main Cloudflare Worker Entry Point
 * Routes requests to appropriate handlers
 */

import { Request as CFRequest, Response as CFResponse } from '@cloudflare/workers-types';
import { handleCORS, createErrorResponse } from './utils/validation';
import { logRequest, logError } from './utils/logger';

// Import all handlers
import opportunitiesHandler from './api-proxy/opportunities';
import executionsHandler from './api-proxy/executions';
import strategiesHandler from './api-proxy/strategies';
import analyticsHandler from './api-proxy/analytics';
import websocketHandler from './websocket/handler';

interface Env {
  BACKEND_API_URL: string;
  BACKEND_API_KEY: string;
  RATE_LIMIT_KV: KVNamespace;
  OPPORTUNITIES_CACHE: KVNamespace;
  EXECUTIONS_CACHE: KVNamespace;
  STRATEGIES_CACHE: KVNamespace;
  ANALYTICS_CACHE: KVNamespace;
  WEBSOCKET_KV: KVNamespace;
  API_KEYS_KV: KVNamespace;
  ANALYTICS_KV: KVNamespace;
  ERROR_LOGS_KV: KVNamespace;
  METRICS_KV: KVNamespace;
  ARBITRAGEX_DB: D1Database;
}

export default {
  async fetch(request: CFRequest, env: Env, ctx: ExecutionContext): Promise<CFResponse> {
    const startTime = Date.now();
    
    try {
      // Handle CORS preflight requests
      const corsResponse = handleCORS(request);
      if (corsResponse) {
        return corsResponse;
      }

      // Log incoming request
      await logRequest(request, env);

      const url = new URL(request.url);
      const pathname = url.pathname;

      // Route requests to appropriate handlers
      switch (true) {
        // WebSocket endpoints
        case pathname.startsWith('/ws'):
          return await websocketHandler.fetch(request, env, ctx);

        // Opportunities API
        case pathname.startsWith('/opportunities'):
          return await opportunitiesHandler.fetch(request, env, ctx);

        // Executions API
        case pathname.startsWith('/executions'):
          return await executionsHandler.fetch(request, env, ctx);

        // Strategies API
        case pathname.startsWith('/strategies'):
          return await strategiesHandler.fetch(request, env, ctx);

        // Analytics API
        case pathname.startsWith('/analytics'):
          return await analyticsHandler.fetch(request, env, ctx);

        // Health check endpoint
        case pathname === '/health':
          return await handleHealthCheck(request, env);

        // API status endpoint
        case pathname === '/status':
          return await handleStatusCheck(request, env);

        // Root endpoint - API documentation
        case pathname === '/':
          return handleRootEndpoint();

        // Default - not found
        default:
          return createErrorResponse('Endpoint not found', 404);
      }

    } catch (error) {
      await logError(error as Error, request, env);
      return createErrorResponse('Internal server error', 500);
    } finally {
      // Log performance metrics
      const duration = Date.now() - startTime;
      if (duration > 1000) { // Log slow requests
        console.log(`Slow request: ${request.method} ${request.url} took ${duration}ms`);
      }
    }
  },

  // Scheduled event handler for cron jobs
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    switch (event.cron) {
      case '*/5 * * * *': // Every 5 minutes
        await handleCacheCleanup(env, ctx);
        break;
      
      case '0 * * * *': // Every hour
        await handleMetricsAggregation(env, ctx);
        break;
      
      case '0 0 * * *': // Daily at midnight
        await handleAnalyticsReport(env, ctx);
        break;
    }
  },
};

async function handleHealthCheck(request: CFRequest, env: Env): Promise<CFResponse> {
  try {
    // Check backend connectivity
    const backendHealthUrl = `${env.BACKEND_API_URL}/health`;
    const backendResponse = await fetch(backendHealthUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${env.BACKEND_API_KEY}`,
      },
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    const backendHealthy = backendResponse.ok;

    // Check KV stores
    const kvHealthy = await checkKVHealth(env);

    // Check D1 database
    const dbHealthy = await checkDatabaseHealth(env);

    const overallHealthy = backendHealthy && kvHealthy && dbHealthy;

    const healthStatus = {
      status: overallHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      checks: {
        backend: {
          status: backendHealthy ? 'healthy' : 'unhealthy',
          response_time: backendHealthy ? 'ok' : 'timeout',
        },
        kv_stores: {
          status: kvHealthy ? 'healthy' : 'unhealthy',
        },
        database: {
          status: dbHealthy ? 'healthy' : 'unhealthy',
        },
      },
      version: '3.0.0',
      environment: env.ENVIRONMENT || 'unknown',
    };

    return new Response(JSON.stringify(healthStatus), {
      status: overallHealthy ? 200 : 503,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
    });

  } catch (error) {
    return new Response(JSON.stringify({
      status: 'unhealthy',
      error: 'Health check failed',
      timestamp: new Date().toISOString(),
    }), {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}

async function handleStatusCheck(request: CFRequest, env: Env): Promise<CFResponse> {
  try {
    // Get basic statistics
    const stats = {
      service: 'ArbitrageX Supreme Edge Computing',
      version: '3.0.0',
      timestamp: new Date().toISOString(),
      environment: env.ENVIRONMENT || 'unknown',
      uptime: Date.now(), // Simplified uptime
      endpoints: {
        opportunities: '/opportunities',
        executions: '/executions',
        strategies: '/strategies',
        analytics: '/analytics',
        websocket: '/ws',
        health: '/health',
      },
      features: [
        'Real-time opportunity detection',
        'MEV execution tracking',
        'Strategy performance analytics',
        'WebSocket real-time updates',
        'Multi-chain support',
        'Edge caching',
        'Rate limiting',
        'Authentication',
      ],
    };

    return new Response(JSON.stringify(stats), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
      },
    });

  } catch (error) {
    return createErrorResponse('Status check failed', 500);
  }
}

function handleRootEndpoint(): CFResponse {
  const apiDocs = {
    name: 'ArbitrageX Supreme V3.0 Edge API',
    version: '3.0.0',
    description: 'Cloudflare Workers-powered edge computing API for MEV arbitrage operations',
    documentation: 'https://docs.arbitragex.com',
    endpoints: {
      opportunities: {
        path: '/opportunities',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        description: 'Manage arbitrage opportunities',
      },
      executions: {
        path: '/executions',
        methods: ['GET', 'POST', 'PUT'],
        description: 'Track MEV execution results',
      },
      strategies: {
        path: '/strategies',
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        description: 'Manage trading strategies',
      },
      analytics: {
        path: '/analytics',
        methods: ['GET'],
        description: 'Performance analytics and metrics',
      },
      websocket: {
        path: '/ws',
        protocol: 'WebSocket',
        description: 'Real-time updates and notifications',
      },
    },
    authentication: {
      methods: ['API Key', 'JWT Bearer Token'],
      headers: ['X-API-Key', 'Authorization'],
    },
    rate_limits: {
      default: '100 requests/hour',
      authenticated: '1000 requests/hour',
      websocket: '50 connections/IP',
    },
  };

  return new Response(JSON.stringify(apiDocs, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

async function checkKVHealth(env: Env): Promise<boolean> {
  try {
    // Test a simple KV operation
    const testKey = `health_check:${Date.now()}`;
    await env.RATE_LIMIT_KV.put(testKey, 'test', { expirationTtl: 60 });
    const result = await env.RATE_LIMIT_KV.get(testKey);
    await env.RATE_LIMIT_KV.delete(testKey);
    return result === 'test';
  } catch (error) {
    return false;
  }
}

async function checkDatabaseHealth(env: Env): Promise<boolean> {
  try {
    // Test a simple database query
    const result = await env.ARBITRAGEX_DB.prepare('SELECT 1 as test').first();
    return result?.test === 1;
  } catch (error) {
    return false;
  }
}

// Scheduled event handlers
async function handleCacheCleanup(env: Env, ctx: ExecutionContext): Promise<void> {
  console.log('Running cache cleanup...');
  
  // This is a simplified cleanup - in production you'd want more sophisticated logic
  try {
    // Clean up expired entries, stale connections, etc.
    // Implementation would depend on your specific caching strategy
    console.log('Cache cleanup completed');
  } catch (error) {
    console.error('Cache cleanup failed:', error);
  }
}

async function handleMetricsAggregation(env: Env, ctx: ExecutionContext): Promise<void> {
  console.log('Running metrics aggregation...');
  
  try {
    // Aggregate hourly metrics
    const timestamp = new Date().toISOString();
    const metricsKey = `hourly_metrics:${timestamp}`;
    
    // Store aggregated metrics
    await env.METRICS_KV.put(metricsKey, JSON.stringify({
      timestamp,
      // Add your metrics here
    }), {
      expirationTtl: 86400 * 7, // Keep for 7 days
    });
    
    console.log('Metrics aggregation completed');
  } catch (error) {
    console.error('Metrics aggregation failed:', error);
  }
}

async function handleAnalyticsReport(env: Env, ctx: ExecutionContext): Promise<void> {
  console.log('Running daily analytics report...');
  
  try {
    // Generate daily analytics report
    const timestamp = new Date().toISOString();
    const reportKey = `daily_report:${timestamp.split('T')[0]}`;
    
    // Store daily report
    await env.ANALYTICS_KV.put(reportKey, JSON.stringify({
      date: timestamp.split('T')[0],
      timestamp,
      // Add your analytics data here
    }), {
      expirationTtl: 86400 * 30, // Keep for 30 days
    });
    
    console.log('Daily analytics report completed');
  } catch (error) {
    console.error('Daily analytics report failed:', error);
  }
}

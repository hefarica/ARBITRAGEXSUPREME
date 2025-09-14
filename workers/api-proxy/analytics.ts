/**
 * ArbitrageX Supreme V3.0 - Analytics API Proxy
 * Cloudflare Worker for proxying analytics data from backend
 */

import { Request as CFRequest, Response as CFResponse } from '@cloudflare/workers-types';
import { validateRequest, createErrorResponse, createSuccessResponse, validateTimeRange, validatePagination } from '../utils/validation';
import { logRequest, logError, logPerformance } from '../utils/logger';
import { authenticateRequest, rateLimitCheck } from '../utils/auth_helper';

interface Env {
  BACKEND_API_URL: string;
  BACKEND_API_KEY: string;
  RATE_LIMIT_KV: KVNamespace;
  ANALYTICS_CACHE: KVNamespace;
  ANALYTICS_KV: KVNamespace;
}

interface AnalyticsQuery {
  metric?: string;
  chain_id?: string;
  strategy_type?: string;
  start_time?: string;
  end_time?: string;
  granularity?: string;
  limit?: string;
}

interface AnalyticsMetric {
  timestamp: string;
  metric_name: string;
  value: number;
  chain_id?: number;
  strategy_type?: string;
  metadata?: Record<string, any>;
}

interface AnalyticsSummary {
  total_opportunities: number;
  total_executions: number;
  success_rate: number;
  total_profit: string;
  average_profit: string;
  gas_efficiency: number;
  top_strategies: Array<{
    strategy_type: string;
    profit: string;
    executions: number;
  }>;
  chain_distribution: Array<{
    chain_id: number;
    chain_name: string;
    profit: string;
    executions: number;
  }>;
}

export default {
  async fetch(request: CFRequest, env: Env, ctx: ExecutionContext): Promise<CFResponse> {
    const startTime = Date.now();
    const url = new URL(request.url);
    const method = request.method;
    
    // Log incoming request
    await logRequest(request, env);

    try {
      // Rate limiting check
      const rateLimitResult = await rateLimitCheck(request, env, 50); // Lower limit for analytics
      if (!rateLimitResult.allowed) {
        return createErrorResponse('Rate limit exceeded', 429);
      }

      // Route handling
      switch (true) {
        case method === 'GET' && url.pathname === '/analytics/summary':
          const summaryResult = await handleAnalyticsSummary(request, env);
          await logPerformance('analytics_summary', Date.now() - startTime, request, env);
          return summaryResult;
        
        case method === 'GET' && url.pathname === '/analytics/metrics':
          const metricsResult = await handleAnalyticsMetrics(request, env);
          await logPerformance('analytics_metrics', Date.now() - startTime, request, env);
          return metricsResult;
        
        case method === 'GET' && url.pathname === '/analytics/performance':
          const perfResult = await handlePerformanceAnalytics(request, env);
          await logPerformance('performance_analytics', Date.now() - startTime, request, env);
          return perfResult;
        
        case method === 'GET' && url.pathname === '/analytics/profit':
          const profitResult = await handleProfitAnalytics(request, env);
          await logPerformance('profit_analytics', Date.now() - startTime, request, env);
          return profitResult;
        
        case method === 'GET' && url.pathname === '/analytics/chains':
          const chainsResult = await handleChainAnalytics(request, env);
          await logPerformance('chain_analytics', Date.now() - startTime, request, env);
          return chainsResult;
        
        case method === 'GET' && url.pathname === '/analytics/strategies':
          const strategiesResult = await handleStrategyAnalytics(request, env);
          await logPerformance('strategy_analytics', Date.now() - startTime, request, env);
          return strategiesResult;
        
        default:
          return createErrorResponse('Endpoint not found', 404);
      }
    } catch (error) {
      await logError(error as Error, request, env);
      return createErrorResponse('Internal server error', 500);
    }
  },
};

async function handleAnalyticsSummary(request: CFRequest, env: Env): Promise<CFResponse> {
  const url = new URL(request.url);
  const startTime = url.searchParams.get('start_time');
  const endTime = url.searchParams.get('end_time');
  const chainId = url.searchParams.get('chain_id');

  // Validate time range
  const timeValidation = validateTimeRange(startTime || undefined, endTime || undefined);
  if (!timeValidation.valid) {
    return createErrorResponse(timeValidation.error!, 400);
  }

  // Check cache first
  const cacheKey = `analytics_summary:${startTime || '24h'}:${endTime || 'now'}:${chainId || 'all'}`;
  const cached = await env.ANALYTICS_CACHE.get(cacheKey);
  
  if (cached) {
    const cachedData = JSON.parse(cached);
    return createSuccessResponse(cachedData, {
      'Cache-Control': 'public, max-age=600',
      'X-Cache': 'HIT'
    });
  }

  try {
    const backendUrl = new URL('/api/v1/analytics/summary', env.BACKEND_API_URL);
    
    if (startTime) backendUrl.searchParams.set('start_time', startTime);
    if (endTime) backendUrl.searchParams.set('end_time', endTime);
    if (chainId) backendUrl.searchParams.set('chain_id', chainId);

    const backendResponse = await fetch(backendUrl.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${env.BACKEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!backendResponse.ok) {
      throw new Error(`Backend responded with ${backendResponse.status}`);
    }

    const data = await backendResponse.json();

    // Cache summary for 10 minutes
    await env.ANALYTICS_CACHE.put(cacheKey, JSON.stringify(data), {
      expirationTtl: 600,
    });

    return createSuccessResponse(data, {
      'Cache-Control': 'public, max-age=600',
      'X-Cache': 'MISS'
    });

  } catch (error) {
    return createErrorResponse('Failed to fetch analytics summary', 502);
  }
}

async function handleAnalyticsMetrics(request: CFRequest, env: Env): Promise<CFResponse> {
  const url = new URL(request.url);
  const queryParams = Object.fromEntries(url.searchParams.entries()) as AnalyticsQuery;

  // Validate query parameters
  const timeValidation = validateTimeRange(queryParams.start_time, queryParams.end_time);
  if (!timeValidation.valid) {
    return createErrorResponse(timeValidation.error!, 400);
  }

  const paginationValidation = validatePagination(queryParams.limit);
  if (!paginationValidation.valid) {
    return createErrorResponse(paginationValidation.error!, 400);
  }

  // Check cache first
  const cacheKey = `analytics_metrics:${JSON.stringify(queryParams)}`;
  const cached = await env.ANALYTICS_CACHE.get(cacheKey);
  
  if (cached) {
    const cachedData = JSON.parse(cached);
    return createSuccessResponse(cachedData, {
      'Cache-Control': 'public, max-age=300',
      'X-Cache': 'HIT'
    });
  }

  try {
    const backendUrl = new URL('/api/v1/analytics/metrics', env.BACKEND_API_URL);
    
    // Forward query parameters
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value) backendUrl.searchParams.set(key, value);
    });

    const backendResponse = await fetch(backendUrl.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${env.BACKEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!backendResponse.ok) {
      throw new Error(`Backend responded with ${backendResponse.status}`);
    }

    const data = await backendResponse.json();

    // Cache metrics for 5 minutes
    await env.ANALYTICS_CACHE.put(cacheKey, JSON.stringify(data), {
      expirationTtl: 300,
    });

    return createSuccessResponse(data, {
      'Cache-Control': 'public, max-age=300',
      'X-Cache': 'MISS'
    });

  } catch (error) {
    return createErrorResponse('Failed to fetch analytics metrics', 502);
  }
}

async function handlePerformanceAnalytics(request: CFRequest, env: Env): Promise<CFResponse> {
  const url = new URL(request.url);
  const period = url.searchParams.get('period') || '24h';
  const chainId = url.searchParams.get('chain_id');

  // Check cache first
  const cacheKey = `performance_analytics:${period}:${chainId || 'all'}`;
  const cached = await env.ANALYTICS_CACHE.get(cacheKey);
  
  if (cached) {
    const cachedData = JSON.parse(cached);
    return createSuccessResponse(cachedData, {
      'Cache-Control': 'public, max-age=900',
      'X-Cache': 'HIT'
    });
  }

  try {
    const backendUrl = new URL('/api/v1/analytics/performance', env.BACKEND_API_URL);
    backendUrl.searchParams.set('period', period);
    if (chainId) backendUrl.searchParams.set('chain_id', chainId);

    const backendResponse = await fetch(backendUrl.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${env.BACKEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!backendResponse.ok) {
      throw new Error(`Backend responded with ${backendResponse.status}`);
    }

    const data = await backendResponse.json();

    // Cache performance analytics for 15 minutes
    await env.ANALYTICS_CACHE.put(cacheKey, JSON.stringify(data), {
      expirationTtl: 900,
    });

    return createSuccessResponse(data, {
      'Cache-Control': 'public, max-age=900',
      'X-Cache': 'MISS'
    });

  } catch (error) {
    return createErrorResponse('Failed to fetch performance analytics', 502);
  }
}

async function handleProfitAnalytics(request: CFRequest, env: Env): Promise<CFResponse> {
  const url = new URL(request.url);
  const startTime = url.searchParams.get('start_time');
  const endTime = url.searchParams.get('end_time');
  const granularity = url.searchParams.get('granularity') || 'hour';

  // Validate time range
  const timeValidation = validateTimeRange(startTime || undefined, endTime || undefined);
  if (!timeValidation.valid) {
    return createErrorResponse(timeValidation.error!, 400);
  }

  // Check cache first
  const cacheKey = `profit_analytics:${startTime || '24h'}:${endTime || 'now'}:${granularity}`;
  const cached = await env.ANALYTICS_CACHE.get(cacheKey);
  
  if (cached) {
    const cachedData = JSON.parse(cached);
    return createSuccessResponse(cachedData, {
      'Cache-Control': 'public, max-age=600',
      'X-Cache': 'HIT'
    });
  }

  try {
    const backendUrl = new URL('/api/v1/analytics/profit', env.BACKEND_API_URL);
    
    if (startTime) backendUrl.searchParams.set('start_time', startTime);
    if (endTime) backendUrl.searchParams.set('end_time', endTime);
    backendUrl.searchParams.set('granularity', granularity);

    const backendResponse = await fetch(backendUrl.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${env.BACKEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!backendResponse.ok) {
      throw new Error(`Backend responded with ${backendResponse.status}`);
    }

    const data = await backendResponse.json();

    // Cache profit analytics for 10 minutes
    await env.ANALYTICS_CACHE.put(cacheKey, JSON.stringify(data), {
      expirationTtl: 600,
    });

    return createSuccessResponse(data, {
      'Cache-Control': 'public, max-age=600',
      'X-Cache': 'MISS'
    });

  } catch (error) {
    return createErrorResponse('Failed to fetch profit analytics', 502);
  }
}

async function handleChainAnalytics(request: CFRequest, env: Env): Promise<CFResponse> {
  const url = new URL(request.url);
  const period = url.searchParams.get('period') || '7d';

  // Check cache first
  const cacheKey = `chain_analytics:${period}`;
  const cached = await env.ANALYTICS_CACHE.get(cacheKey);
  
  if (cached) {
    const cachedData = JSON.parse(cached);
    return createSuccessResponse(cachedData, {
      'Cache-Control': 'public, max-age=1800',
      'X-Cache': 'HIT'
    });
  }

  try {
    const backendUrl = new URL('/api/v1/analytics/chains', env.BACKEND_API_URL);
    backendUrl.searchParams.set('period', period);

    const backendResponse = await fetch(backendUrl.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${env.BACKEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!backendResponse.ok) {
      throw new Error(`Backend responded with ${backendResponse.status}`);
    }

    const data = await backendResponse.json();

    // Cache chain analytics for 30 minutes
    await env.ANALYTICS_CACHE.put(cacheKey, JSON.stringify(data), {
      expirationTtl: 1800,
    });

    return createSuccessResponse(data, {
      'Cache-Control': 'public, max-age=1800',
      'X-Cache': 'MISS'
    });

  } catch (error) {
    return createErrorResponse('Failed to fetch chain analytics', 502);
  }
}

async function handleStrategyAnalytics(request: CFRequest, env: Env): Promise<CFResponse> {
  const url = new URL(request.url);
  const period = url.searchParams.get('period') || '7d';
  const chainId = url.searchParams.get('chain_id');

  // Check cache first
  const cacheKey = `strategy_analytics:${period}:${chainId || 'all'}`;
  const cached = await env.ANALYTICS_CACHE.get(cacheKey);
  
  if (cached) {
    const cachedData = JSON.parse(cached);
    return createSuccessResponse(cachedData, {
      'Cache-Control': 'public, max-age=1200',
      'X-Cache': 'HIT'
    });
  }

  try {
    const backendUrl = new URL('/api/v1/analytics/strategies', env.BACKEND_API_URL);
    backendUrl.searchParams.set('period', period);
    if (chainId) backendUrl.searchParams.set('chain_id', chainId);

    const backendResponse = await fetch(backendUrl.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${env.BACKEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!backendResponse.ok) {
      throw new Error(`Backend responded with ${backendResponse.status}`);
    }

    const data = await backendResponse.json();

    // Cache strategy analytics for 20 minutes
    await env.ANALYTICS_CACHE.put(cacheKey, JSON.stringify(data), {
      expirationTtl: 1200,
    });

    return createSuccessResponse(data, {
      'Cache-Control': 'public, max-age=1200',
      'X-Cache': 'MISS'
    });

  } catch (error) {
    return createErrorResponse('Failed to fetch strategy analytics', 502);
  }
}

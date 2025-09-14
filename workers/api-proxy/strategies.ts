/**
 * ArbitrageX Supreme V3.0 - Strategies API Proxy
 * Cloudflare Worker for proxying strategy data from backend
 */

import { Request as CFRequest, Response as CFResponse } from '@cloudflare/workers-types';
import { validateRequest, createErrorResponse, createSuccessResponse, validatePagination } from '../utils/validation';
import { logRequest, logError, logPerformance } from '../utils/logger';
import { authenticateRequest, rateLimitCheck } from '../utils/auth_helper';

interface Env {
  BACKEND_API_URL: string;
  BACKEND_API_KEY: string;
  RATE_LIMIT_KV: KVNamespace;
  STRATEGIES_CACHE: KVNamespace;
}

interface StrategyQuery {
  type?: string;
  chain_id?: string;
  active?: string;
  limit?: string;
  offset?: string;
}

interface Strategy {
  id: string;
  name: string;
  type: 'arbitrage' | 'sandwich' | 'liquidation' | 'triangular' | 'flash_loan';
  description: string;
  chain_ids: number[];
  active: boolean;
  parameters: Record<string, any>;
  performance_metrics: {
    total_executions: number;
    successful_executions: number;
    total_profit: string;
    average_profit: string;
    success_rate: number;
  };
  created_at: string;
  updated_at: string;
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
      const rateLimitResult = await rateLimitCheck(request, env, 150);
      if (!rateLimitResult.allowed) {
        return createErrorResponse('Rate limit exceeded', 429);
      }

      // Route handling
      switch (true) {
        case method === 'GET' && url.pathname === '/strategies':
          const result = await handleListStrategies(request, env);
          await logPerformance('list_strategies', Date.now() - startTime, request, env);
          return result;
        
        case method === 'GET' && url.pathname.match(/^\/strategies\/[^\/]+$/):
          const strategyId = url.pathname.split('/')[2];
          const getResult = await handleGetStrategy(strategyId, env);
          await logPerformance('get_strategy', Date.now() - startTime, request, env);
          return getResult;
        
        case method === 'GET' && url.pathname === '/strategies/performance':
          const perfResult = await handleStrategyPerformance(request, env);
          await logPerformance('strategy_performance', Date.now() - startTime, request, env);
          return perfResult;
        
        case method === 'POST' && url.pathname === '/strategies':
          const createResult = await handleCreateStrategy(request, env);
          await logPerformance('create_strategy', Date.now() - startTime, request, env);
          return createResult;
        
        case method === 'PUT' && url.pathname.match(/^\/strategies\/[^\/]+$/):
          const updateId = url.pathname.split('/')[2];
          const updateResult = await handleUpdateStrategy(updateId, request, env);
          await logPerformance('update_strategy', Date.now() - startTime, request, env);
          return updateResult;
        
        case method === 'DELETE' && url.pathname.match(/^\/strategies\/[^\/]+$/):
          const deleteId = url.pathname.split('/')[2];
          const deleteResult = await handleDeleteStrategy(deleteId, env);
          await logPerformance('delete_strategy', Date.now() - startTime, request, env);
          return deleteResult;
        
        default:
          return createErrorResponse('Endpoint not found', 404);
      }
    } catch (error) {
      await logError(error as Error, request, env);
      return createErrorResponse('Internal server error', 500);
    }
  },
};

async function handleListStrategies(request: CFRequest, env: Env): Promise<CFResponse> {
  const url = new URL(request.url);
  const queryParams = Object.fromEntries(url.searchParams.entries()) as StrategyQuery;

  // Validate query parameters
  const paginationValidation = validatePagination(queryParams.limit, queryParams.offset);
  if (!paginationValidation.valid) {
    return createErrorResponse(paginationValidation.error!, 400);
  }

  // Check cache first
  const cacheKey = `strategies:${JSON.stringify(queryParams)}`;
  const cached = await env.STRATEGIES_CACHE.get(cacheKey);
  
  if (cached) {
    const cachedData = JSON.parse(cached);
    return createSuccessResponse(cachedData, {
      'Cache-Control': 'public, max-age=300',
      'X-Cache': 'HIT'
    });
  }

  try {
    // Proxy to backend
    const backendUrl = new URL('/api/v1/strategies', env.BACKEND_API_URL);
    
    // Forward query parameters
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value) backendUrl.searchParams.set(key, value);
    });

    const backendResponse = await fetch(backendUrl.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${env.BACKEND_API_KEY}`,
        'Content-Type': 'application/json',
        'User-Agent': 'ArbitrageX-Edge/1.0',
      },
    });

    if (!backendResponse.ok) {
      throw new Error(`Backend responded with ${backendResponse.status}`);
    }

    const data = await backendResponse.json();

    // Cache the response for 5 minutes (strategies don't change frequently)
    await env.STRATEGIES_CACHE.put(cacheKey, JSON.stringify(data), {
      expirationTtl: 300,
    });

    return createSuccessResponse(data, {
      'Cache-Control': 'public, max-age=300',
      'X-Cache': 'MISS'
    });

  } catch (error) {
    return createErrorResponse('Failed to fetch strategies', 502);
  }
}

async function handleGetStrategy(strategyId: string, env: Env): Promise<CFResponse> {
  // Validate strategy ID
  if (!strategyId || strategyId.length < 3) {
    return createErrorResponse('Invalid strategy ID', 400);
  }

  // Check cache first
  const cacheKey = `strategy:${strategyId}`;
  const cached = await env.STRATEGIES_CACHE.get(cacheKey);
  
  if (cached) {
    const cachedData = JSON.parse(cached);
    return createSuccessResponse(cachedData, {
      'Cache-Control': 'public, max-age=600',
      'X-Cache': 'HIT'
    });
  }

  try {
    const backendUrl = `${env.BACKEND_API_URL}/api/v1/strategies/${strategyId}`;
    
    const backendResponse = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${env.BACKEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (backendResponse.status === 404) {
      return createErrorResponse('Strategy not found', 404);
    }

    if (!backendResponse.ok) {
      throw new Error(`Backend responded with ${backendResponse.status}`);
    }

    const data = await backendResponse.json();

    // Cache individual strategy for 10 minutes
    await env.STRATEGIES_CACHE.put(cacheKey, JSON.stringify(data), {
      expirationTtl: 600,
    });

    return createSuccessResponse(data, {
      'Cache-Control': 'public, max-age=600',
      'X-Cache': 'MISS'
    });

  } catch (error) {
    return createErrorResponse('Failed to fetch strategy', 502);
  }
}

async function handleStrategyPerformance(request: CFRequest, env: Env): Promise<CFResponse> {
  const url = new URL(request.url);
  const strategyType = url.searchParams.get('type');
  const chainId = url.searchParams.get('chain_id');
  const period = url.searchParams.get('period') || '24h';

  // Check cache first
  const cacheKey = `strategy_performance:${strategyType || 'all'}:${chainId || 'all'}:${period}`;
  const cached = await env.STRATEGIES_CACHE.get(cacheKey);
  
  if (cached) {
    const cachedData = JSON.parse(cached);
    return createSuccessResponse(cachedData, {
      'Cache-Control': 'public, max-age=600',
      'X-Cache': 'HIT'
    });
  }

  try {
    const backendUrl = new URL('/api/v1/strategies/performance', env.BACKEND_API_URL);
    
    if (strategyType) backendUrl.searchParams.set('type', strategyType);
    if (chainId) backendUrl.searchParams.set('chain_id', chainId);
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

    // Cache performance data for 10 minutes
    await env.STRATEGIES_CACHE.put(cacheKey, JSON.stringify(data), {
      expirationTtl: 600,
    });

    return createSuccessResponse(data, {
      'Cache-Control': 'public, max-age=600',
      'X-Cache': 'MISS'
    });

  } catch (error) {
    return createErrorResponse('Failed to fetch strategy performance', 502);
  }
}

async function handleCreateStrategy(request: CFRequest, env: Env): Promise<CFResponse> {
  // Authentication required for write operations
  const authResult = await authenticateRequest(request, env);
  if (!authResult.valid) {
    return createErrorResponse('Unauthorized', 401);
  }

  try {
    const body = await request.json() as Partial<Strategy>;
    
    // Validate strategy data
    const validation = validateStrategyData(body);
    if (!validation.valid) {
      return createErrorResponse(validation.error!, 400);
    }

    const backendUrl = `${env.BACKEND_API_URL}/api/v1/strategies`;
    
    const backendResponse = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.BACKEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!backendResponse.ok) {
      throw new Error(`Backend responded with ${backendResponse.status}`);
    }

    const data = await backendResponse.json();

    // Invalidate cache
    await invalidateStrategiesCache(env);

    return createSuccessResponse(data, {}, 201);

  } catch (error) {
    return createErrorResponse('Failed to create strategy', 502);
  }
}

async function handleUpdateStrategy(
  strategyId: string, 
  request: CFRequest, 
  env: Env
): Promise<CFResponse> {
  // Authentication required
  const authResult = await authenticateRequest(request, env);
  if (!authResult.valid) {
    return createErrorResponse('Unauthorized', 401);
  }

  try {
    const body = await request.json() as Partial<Strategy>;
    
    const backendUrl = `${env.BACKEND_API_URL}/api/v1/strategies/${strategyId}`;
    
    const backendResponse = await fetch(backendUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${env.BACKEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (backendResponse.status === 404) {
      return createErrorResponse('Strategy not found', 404);
    }

    if (!backendResponse.ok) {
      throw new Error(`Backend responded with ${backendResponse.status}`);
    }

    const data = await backendResponse.json();

    // Invalidate cache
    await env.STRATEGIES_CACHE.delete(`strategy:${strategyId}`);
    await invalidateStrategiesCache(env);

    return createSuccessResponse(data);

  } catch (error) {
    return createErrorResponse('Failed to update strategy', 502);
  }
}

async function handleDeleteStrategy(strategyId: string, env: Env): Promise<CFResponse> {
  // Authentication required
  const authResult = await authenticateRequest(request, env);
  if (!authResult.valid) {
    return createErrorResponse('Unauthorized', 401);
  }

  try {
    const backendUrl = `${env.BACKEND_API_URL}/api/v1/strategies/${strategyId}`;
    
    const backendResponse = await fetch(backendUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${env.BACKEND_API_KEY}`,
      },
    });

    if (backendResponse.status === 404) {
      return createErrorResponse('Strategy not found', 404);
    }

    if (!backendResponse.ok) {
      throw new Error(`Backend responded with ${backendResponse.status}`);
    }

    // Invalidate cache
    await env.STRATEGIES_CACHE.delete(`strategy:${strategyId}`);
    await invalidateStrategiesCache(env);

    return createSuccessResponse({ message: 'Strategy deleted successfully' });

  } catch (error) {
    return createErrorResponse('Failed to delete strategy', 502);
  }
}

// Helper functions
function validateStrategyData(data: Partial<Strategy>): { valid: boolean; error?: string } {
  if (!data.name) {
    return { valid: false, error: 'name is required' };
  }
  
  if (!data.type) {
    return { valid: false, error: 'type is required' };
  }
  
  const validTypes = ['arbitrage', 'sandwich', 'liquidation', 'triangular', 'flash_loan'];
  if (!validTypes.includes(data.type)) {
    return { valid: false, error: 'invalid strategy type' };
  }
  
  if (!data.chain_ids || !Array.isArray(data.chain_ids) || data.chain_ids.length === 0) {
    return { valid: false, error: 'chain_ids array is required' };
  }
  
  return { valid: true };
}

async function invalidateStrategiesCache(env: Env): Promise<void> {
  const commonKeys = [
    'strategies:{}',
    'strategies:{"active":"true"}',
    'strategy_performance:all:all:24h',
    'strategy_performance:all:all:7d',
  ];
  
  await Promise.all(
    commonKeys.map(key => env.STRATEGIES_CACHE.delete(key))
  );
}

/**
 * ArbitrageX Supreme V3.0 - Executions API Proxy
 * Cloudflare Worker for proxying execution data from backend
 */

import { Request as CFRequest, Response as CFResponse } from '@cloudflare/workers-types';
import { validateRequest, createErrorResponse, createSuccessResponse, validatePagination, validateTimeRange } from '../utils/validation';
import { logRequest, logError, logPerformance } from '../utils/logger';
import { authenticateRequest, rateLimitCheck } from '../utils/auth_helper';

interface Env {
  BACKEND_API_URL: string;
  BACKEND_API_KEY: string;
  RATE_LIMIT_KV: KVNamespace;
  EXECUTIONS_CACHE: KVNamespace;
  ANALYTICS_KV: KVNamespace;
}

interface ExecutionQuery {
  chain_id?: string;
  strategy_type?: string;
  status?: string;
  start_time?: string;
  end_time?: string;
  limit?: string;
  offset?: string;
}

interface Execution {
  id: string;
  opportunity_id: string;
  chain_id: number;
  strategy_type: string;
  status: 'pending' | 'submitted' | 'confirmed' | 'failed';
  transaction_hash?: string;
  block_number?: number;
  gas_used?: string;
  gas_price: string;
  actual_profit?: string;
  expected_profit: string;
  execution_time: number;
  created_at: string;
  updated_at: string;
  metadata: Record<string, any>;
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
      const rateLimitResult = await rateLimitCheck(request, env, 200); // Higher limit for executions
      if (!rateLimitResult.allowed) {
        return createErrorResponse('Rate limit exceeded', 429);
      }

      // Route handling
      switch (true) {
        case method === 'GET' && url.pathname === '/executions':
          const result = await handleListExecutions(request, env);
          await logPerformance('list_executions', Date.now() - startTime, request, env);
          return result;
        
        case method === 'GET' && url.pathname.match(/^\/executions\/[^\/]+$/):
          const executionId = url.pathname.split('/')[2];
          const getResult = await handleGetExecution(executionId, env);
          await logPerformance('get_execution', Date.now() - startTime, request, env);
          return getResult;
        
        case method === 'GET' && url.pathname === '/executions/stats':
          const statsResult = await handleExecutionStats(request, env);
          await logPerformance('execution_stats', Date.now() - startTime, request, env);
          return statsResult;
        
        case method === 'POST' && url.pathname === '/executions':
          const createResult = await handleCreateExecution(request, env);
          await logPerformance('create_execution', Date.now() - startTime, request, env);
          return createResult;
        
        case method === 'PUT' && url.pathname.match(/^\/executions\/[^\/]+$/):
          const updateId = url.pathname.split('/')[2];
          const updateResult = await handleUpdateExecution(updateId, request, env);
          await logPerformance('update_execution', Date.now() - startTime, request, env);
          return updateResult;
        
        default:
          return createErrorResponse('Endpoint not found', 404);
      }
    } catch (error) {
      await logError(error as Error, request, env);
      return createErrorResponse('Internal server error', 500);
    }
  },
};

async function handleListExecutions(request: CFRequest, env: Env): Promise<CFResponse> {
  const url = new URL(request.url);
  const queryParams = Object.fromEntries(url.searchParams.entries()) as ExecutionQuery;

  // Validate query parameters
  const paginationValidation = validatePagination(queryParams.limit, queryParams.offset);
  if (!paginationValidation.valid) {
    return createErrorResponse(paginationValidation.error!, 400);
  }

  const timeValidation = validateTimeRange(queryParams.start_time, queryParams.end_time);
  if (!timeValidation.valid) {
    return createErrorResponse(timeValidation.error!, 400);
  }

  // Check cache first
  const cacheKey = `executions:${JSON.stringify(queryParams)}`;
  const cached = await env.EXECUTIONS_CACHE.get(cacheKey);
  
  if (cached) {
    const cachedData = JSON.parse(cached);
    return createSuccessResponse(cachedData, {
      'Cache-Control': 'public, max-age=60',
      'X-Cache': 'HIT'
    });
  }

  try {
    // Proxy to backend
    const backendUrl = new URL('/api/v1/executions', env.BACKEND_API_URL);
    
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

    // Cache the response for 1 minute
    await env.EXECUTIONS_CACHE.put(cacheKey, JSON.stringify(data), {
      expirationTtl: 60,
    });

    return createSuccessResponse(data, {
      'Cache-Control': 'public, max-age=60',
      'X-Cache': 'MISS'
    });

  } catch (error) {
    return createErrorResponse('Failed to fetch executions', 502);
  }
}

async function handleGetExecution(executionId: string, env: Env): Promise<CFResponse> {
  // Validate execution ID
  if (!executionId || executionId.length < 10) {
    return createErrorResponse('Invalid execution ID', 400);
  }

  // Check cache first
  const cacheKey = `execution:${executionId}`;
  const cached = await env.EXECUTIONS_CACHE.get(cacheKey);
  
  if (cached) {
    const cachedData = JSON.parse(cached);
    return createSuccessResponse(cachedData, {
      'Cache-Control': 'public, max-age=120',
      'X-Cache': 'HIT'
    });
  }

  try {
    const backendUrl = `${env.BACKEND_API_URL}/api/v1/executions/${executionId}`;
    
    const backendResponse = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${env.BACKEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (backendResponse.status === 404) {
      return createErrorResponse('Execution not found', 404);
    }

    if (!backendResponse.ok) {
      throw new Error(`Backend responded with ${backendResponse.status}`);
    }

    const data = await backendResponse.json();

    // Cache individual execution for 2 minutes
    await env.EXECUTIONS_CACHE.put(cacheKey, JSON.stringify(data), {
      expirationTtl: 120,
    });

    return createSuccessResponse(data, {
      'Cache-Control': 'public, max-age=120',
      'X-Cache': 'MISS'
    });

  } catch (error) {
    return createErrorResponse('Failed to fetch execution', 502);
  }
}

async function handleExecutionStats(request: CFRequest, env: Env): Promise<CFResponse> {
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
  const cacheKey = `execution_stats:${startTime || 'all'}:${endTime || 'all'}:${chainId || 'all'}`;
  const cached = await env.EXECUTIONS_CACHE.get(cacheKey);
  
  if (cached) {
    const cachedData = JSON.parse(cached);
    return createSuccessResponse(cachedData, {
      'Cache-Control': 'public, max-age=300',
      'X-Cache': 'HIT'
    });
  }

  try {
    const backendUrl = new URL('/api/v1/executions/stats', env.BACKEND_API_URL);
    
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

    // Cache stats for 5 minutes
    await env.EXECUTIONS_CACHE.put(cacheKey, JSON.stringify(data), {
      expirationTtl: 300,
    });

    return createSuccessResponse(data, {
      'Cache-Control': 'public, max-age=300',
      'X-Cache': 'MISS'
    });

  } catch (error) {
    return createErrorResponse('Failed to fetch execution stats', 502);
  }
}

async function handleCreateExecution(request: CFRequest, env: Env): Promise<CFResponse> {
  // Authentication required for write operations
  const authResult = await authenticateRequest(request, env);
  if (!authResult.valid) {
    return createErrorResponse('Unauthorized', 401);
  }

  try {
    const body = await request.json() as Partial<Execution>;
    
    // Validate execution data
    const validation = validateExecutionData(body);
    if (!validation.valid) {
      return createErrorResponse(validation.error!, 400);
    }

    const backendUrl = `${env.BACKEND_API_URL}/api/v1/executions`;
    
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
    await invalidateExecutionsCache(env);

    return createSuccessResponse(data, {}, 201);

  } catch (error) {
    return createErrorResponse('Failed to create execution', 502);
  }
}

async function handleUpdateExecution(
  executionId: string, 
  request: CFRequest, 
  env: Env
): Promise<CFResponse> {
  // Authentication required
  const authResult = await authenticateRequest(request, env);
  if (!authResult.valid) {
    return createErrorResponse('Unauthorized', 401);
  }

  try {
    const body = await request.json() as Partial<Execution>;
    
    const backendUrl = `${env.BACKEND_API_URL}/api/v1/executions/${executionId}`;
    
    const backendResponse = await fetch(backendUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${env.BACKEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (backendResponse.status === 404) {
      return createErrorResponse('Execution not found', 404);
    }

    if (!backendResponse.ok) {
      throw new Error(`Backend responded with ${backendResponse.status}`);
    }

    const data = await backendResponse.json();

    // Invalidate cache
    await env.EXECUTIONS_CACHE.delete(`execution:${executionId}`);
    await invalidateExecutionsCache(env);

    return createSuccessResponse(data);

  } catch (error) {
    return createErrorResponse('Failed to update execution', 502);
  }
}

// Helper functions
function validateExecutionData(data: Partial<Execution>): { valid: boolean; error?: string } {
  if (!data.opportunity_id) {
    return { valid: false, error: 'opportunity_id is required' };
  }
  
  if (!data.strategy_type) {
    return { valid: false, error: 'strategy_type is required' };
  }
  
  if (!data.expected_profit) {
    return { valid: false, error: 'expected_profit is required' };
  }
  
  if (!data.gas_price) {
    return { valid: false, error: 'gas_price is required' };
  }
  
  return { valid: true };
}

async function invalidateExecutionsCache(env: Env): Promise<void> {
  // In a real implementation, we would have a more sophisticated cache invalidation
  const commonKeys = [
    'executions:{}',
    'executions:{"limit":"10"}',
    'executions:{"limit":"20"}',
    'execution_stats:all:all:all',
  ];
  
  await Promise.all(
    commonKeys.map(key => env.EXECUTIONS_CACHE.delete(key))
  );
}

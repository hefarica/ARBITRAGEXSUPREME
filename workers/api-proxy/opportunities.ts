/**
 * ArbitrageX Supreme V3.0 - Opportunities API Proxy
 * Cloudflare Worker for proxying opportunities data from backend
 */

import { Request as CFRequest, Response as CFResponse } from '@cloudflare/workers-types';
import { validateRequest, createErrorResponse, createSuccessResponse } from '../utils/validation';
import { logRequest, logError } from '../utils/logger';
import { authenticateRequest } from '../utils/auth_helper';

interface Env {
  BACKEND_API_URL: string;
  BACKEND_API_KEY: string;
  RATE_LIMIT_KV: KVNamespace;
  OPPORTUNITIES_CACHE: KVNamespace;
}

interface OpportunityQuery {
  chain_id?: string;
  strategy_type?: string;
  min_profit?: string;
  limit?: string;
  status?: string;
}

interface Opportunity {
  id: string;
  chain_id: number;
  strategy_type: string;
  tokens: string[];
  pools: string[];
  expected_profit: string;
  gas_cost: string;
  confidence: number;
  deadline: number;
  created_at: string;
  metadata: Record<string, any>;
}

export default {
  async fetch(request: CFRequest, env: Env, ctx: ExecutionContext): Promise<CFResponse> {
    const url = new URL(request.url);
    const method = request.method;
    
    // Log incoming request
    await logRequest(request, env);

    try {
      // Rate limiting check
      const rateLimitResult = await checkRateLimit(request, env);
      if (!rateLimitResult.allowed) {
        return createErrorResponse('Rate limit exceeded', 429);
      }

      // Route handling
      switch (true) {
        case method === 'GET' && url.pathname === '/opportunities':
          return await handleListOpportunities(request, env);
        
        case method === 'GET' && url.pathname.match(/^\/opportunities\/[^\/]+$/):
          const opportunityId = url.pathname.split('/')[2];
          return await handleGetOpportunity(opportunityId, env);
        
        case method === 'POST' && url.pathname === '/opportunities':
          return await handleCreateOpportunity(request, env);
        
        case method === 'PUT' && url.pathname.match(/^\/opportunities\/[^\/]+$/):
          const updateId = url.pathname.split('/')[2];
          return await handleUpdateOpportunity(updateId, request, env);
        
        case method === 'DELETE' && url.pathname.match(/^\/opportunities\/[^\/]+$/):
          const deleteId = url.pathname.split('/')[2];
          return await handleDeleteOpportunity(deleteId, env);
        
        default:
          return createErrorResponse('Endpoint not found', 404);
      }
    } catch (error) {
      await logError(error as Error, request, env);
      return createErrorResponse('Internal server error', 500);
    }
  },
};

async function handleListOpportunities(request: CFRequest, env: Env): Promise<CFResponse> {
  const url = new URL(request.url);
  const queryParams = Object.fromEntries(url.searchParams.entries()) as OpportunityQuery;

  // Validate query parameters
  const validation = validateOpportunityQuery(queryParams);
  if (!validation.valid) {
    return createErrorResponse(validation.error!, 400);
  }

  // Check cache first
  const cacheKey = `opportunities:${JSON.stringify(queryParams)}`;
  const cached = await env.OPPORTUNITIES_CACHE.get(cacheKey);
  
  if (cached) {
    const cachedData = JSON.parse(cached);
    return createSuccessResponse(cachedData, {
      'Cache-Control': 'public, max-age=30',
      'X-Cache': 'HIT'
    });
  }

  try {
    // Proxy to backend
    const backendUrl = new URL('/api/v1/opportunities', env.BACKEND_API_URL);
    
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

    // Cache the response for 30 seconds
    await env.OPPORTUNITIES_CACHE.put(cacheKey, JSON.stringify(data), {
      expirationTtl: 30,
    });

    return createSuccessResponse(data, {
      'Cache-Control': 'public, max-age=30',
      'X-Cache': 'MISS'
    });

  } catch (error) {
    await logError(error as Error, request, env);
    return createErrorResponse('Failed to fetch opportunities', 502);
  }
}

async function handleGetOpportunity(opportunityId: string, env: Env): Promise<CFResponse> {
  // Validate opportunity ID
  if (!opportunityId || opportunityId.length < 10) {
    return createErrorResponse('Invalid opportunity ID', 400);
  }

  // Check cache first
  const cacheKey = `opportunity:${opportunityId}`;
  const cached = await env.OPPORTUNITIES_CACHE.get(cacheKey);
  
  if (cached) {
    const cachedData = JSON.parse(cached);
    return createSuccessResponse(cachedData, {
      'Cache-Control': 'public, max-age=60',
      'X-Cache': 'HIT'
    });
  }

  try {
    const backendUrl = `${env.BACKEND_API_URL}/api/v1/opportunities/${opportunityId}`;
    
    const backendResponse = await fetch(backendUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${env.BACKEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (backendResponse.status === 404) {
      return createErrorResponse('Opportunity not found', 404);
    }

    if (!backendResponse.ok) {
      throw new Error(`Backend responded with ${backendResponse.status}`);
    }

    const data = await backendResponse.json();

    // Cache individual opportunity for 1 minute
    await env.OPPORTUNITIES_CACHE.put(cacheKey, JSON.stringify(data), {
      expirationTtl: 60,
    });

    return createSuccessResponse(data, {
      'Cache-Control': 'public, max-age=60',
      'X-Cache': 'MISS'
    });

  } catch (error) {
    return createErrorResponse('Failed to fetch opportunity', 502);
  }
}

async function handleCreateOpportunity(request: CFRequest, env: Env): Promise<CFResponse> {
  // Authentication required for write operations
  const authResult = await authenticateRequest(request, env);
  if (!authResult.valid) {
    return createErrorResponse('Unauthorized', 401);
  }

  try {
    const body = await request.json() as Partial<Opportunity>;
    
    // Validate opportunity data
    const validation = validateOpportunityData(body);
    if (!validation.valid) {
      return createErrorResponse(validation.error!, 400);
    }

    const backendUrl = `${env.BACKEND_API_URL}/api/v1/opportunities`;
    
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
    await invalidateOpportunitiesCache(env);

    return createSuccessResponse(data, {}, 201);

  } catch (error) {
    return createErrorResponse('Failed to create opportunity', 502);
  }
}

async function handleUpdateOpportunity(
  opportunityId: string, 
  request: CFRequest, 
  env: Env
): Promise<CFResponse> {
  // Authentication required
  const authResult = await authenticateRequest(request, env);
  if (!authResult.valid) {
    return createErrorResponse('Unauthorized', 401);
  }

  try {
    const body = await request.json() as Partial<Opportunity>;
    
    const backendUrl = `${env.BACKEND_API_URL}/api/v1/opportunities/${opportunityId}`;
    
    const backendResponse = await fetch(backendUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${env.BACKEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (backendResponse.status === 404) {
      return createErrorResponse('Opportunity not found', 404);
    }

    if (!backendResponse.ok) {
      throw new Error(`Backend responded with ${backendResponse.status}`);
    }

    const data = await backendResponse.json();

    // Invalidate cache
    await env.OPPORTUNITIES_CACHE.delete(`opportunity:${opportunityId}`);
    await invalidateOpportunitiesCache(env);

    return createSuccessResponse(data);

  } catch (error) {
    return createErrorResponse('Failed to update opportunity', 502);
  }
}

async function handleDeleteOpportunity(opportunityId: string, env: Env): Promise<CFResponse> {
  try {
    const backendUrl = `${env.BACKEND_API_URL}/api/v1/opportunities/${opportunityId}`;
    
    const backendResponse = await fetch(backendUrl, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${env.BACKEND_API_KEY}`,
      },
    });

    if (backendResponse.status === 404) {
      return createErrorResponse('Opportunity not found', 404);
    }

    if (!backendResponse.ok) {
      throw new Error(`Backend responded with ${backendResponse.status}`);
    }

    // Invalidate cache
    await env.OPPORTUNITIES_CACHE.delete(`opportunity:${opportunityId}`);
    await invalidateOpportunitiesCache(env);

    return createSuccessResponse({ message: 'Opportunity deleted successfully' });

  } catch (error) {
    return createErrorResponse('Failed to delete opportunity', 502);
  }
}

// Helper functions
async function checkRateLimit(request: CFRequest, env: Env): Promise<{ allowed: boolean }> {
  const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rateLimitKey = `rate_limit:${clientIP}`;
  
  const current = await env.RATE_LIMIT_KV.get(rateLimitKey);
  const count = current ? parseInt(current) : 0;
  
  if (count >= 100) { // 100 requests per minute
    return { allowed: false };
  }
  
  await env.RATE_LIMIT_KV.put(rateLimitKey, (count + 1).toString(), {
    expirationTtl: 60,
  });
  
  return { allowed: true };
}

function validateOpportunityQuery(query: OpportunityQuery): { valid: boolean; error?: string } {
  if (query.chain_id && isNaN(Number(query.chain_id))) {
    return { valid: false, error: 'Invalid chain_id' };
  }
  
  if (query.limit && (isNaN(Number(query.limit)) || Number(query.limit) > 100)) {
    return { valid: false, error: 'Invalid limit (max 100)' };
  }
  
  return { valid: true };
}

function validateOpportunityData(data: Partial<Opportunity>): { valid: boolean; error?: string } {
  if (!data.strategy_type) {
    return { valid: false, error: 'strategy_type is required' };
  }
  
  if (!data.tokens || !Array.isArray(data.tokens) || data.tokens.length === 0) {
    return { valid: false, error: 'tokens array is required' };
  }
  
  if (!data.expected_profit) {
    return { valid: false, error: 'expected_profit is required' };
  }
  
  return { valid: true };
}

async function invalidateOpportunitiesCache(env: Env): Promise<void> {
  // In a real implementation, we would have a more sophisticated cache invalidation
  // For now, we'll just delete some common cache keys
  const commonKeys = [
    'opportunities:{}',
    'opportunities:{"limit":"10"}',
    'opportunities:{"limit":"20"}',
  ];
  
  await Promise.all(
    commonKeys.map(key => env.OPPORTUNITIES_CACHE.delete(key))
  );
}

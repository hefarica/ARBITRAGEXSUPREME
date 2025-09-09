/**
 * ArbitrageX Supreme V3.0 - API Worker
 * Cloudflare Worker para manejar requests de API
 * Ingenio Pichichi S.A.
 */

import { Router } from 'itty-router';

// Crear router
const router = Router();

// Headers CORS
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Middleware para CORS
const corsOptions = (request) =>
  request.method === 'OPTIONS'
    ? new Response(null, { headers: corsHeaders })
    : null;

// Health check endpoint
router.get('/health', () => {
  return new Response(JSON.stringify({
    status: 'healthy',
    service: 'ArbitrageX API Worker',
    version: '3.0.0',
    timestamp: new Date().toISOString(),
    uptime: Date.now()
  }), {
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
});

// Arbitrage opportunities endpoint
router.get('/api/opportunities', async (request, env) => {
  try {
    // Get opportunities from KV cache
    const cached = await env.ARBITRAGEX_CACHE.get('opportunities:latest');
    
    if (cached) {
      return new Response(cached, {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=30',
          ...corsHeaders
        }
      });
    }

    // If no cache, return empty array
    const opportunities = [];
    
    return new Response(JSON.stringify({
      success: true,
      data: opportunities,
      cached: false,
      timestamp: new Date().toISOString()
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch opportunities',
      message: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
});

// Market data endpoint
router.get('/api/markets/:blockchain/:token', async (request, env) => {
  try {
    const { blockchain, token } = request.params;
    
    // Get market data from KV cache
    const cacheKey = `market:${blockchain}:${token}`;
    const cached = await env.ARBITRAGEX_CACHE.get(cacheKey);
    
    if (cached) {
      return new Response(cached, {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=60',
          ...corsHeaders
        }
      });
    }

    // Mock market data if no cache
    const marketData = {
      blockchain,
      token,
      price: Math.random() * 1000,
      volume24h: Math.random() * 1000000,
      liquidity: Math.random() * 10000000,
      timestamp: new Date().toISOString()
    };
    
    return new Response(JSON.stringify({
      success: true,
      data: marketData,
      cached: false
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to fetch market data',
      message: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
});

// Execute arbitrage endpoint  
router.post('/api/arbitrage/execute', async (request, env) => {
  try {
    const body = await request.json();
    
    // Validate request
    if (!body.strategy || !body.amount) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required fields: strategy, amount'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }

    // Log execution request to D1
    const executionId = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    
    await env.ARBITRAGEX_DB.prepare(`
      INSERT INTO arbitrage_executions (id, strategy, amount, status, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `).bind(executionId, body.strategy, body.amount, 'pending', timestamp).run();

    // Return execution response
    return new Response(JSON.stringify({
      success: true,
      executionId,
      status: 'pending',
      message: 'Arbitrage execution initiated',
      timestamp
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to execute arbitrage',
      message: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
});

// 404 handler
router.all('*', () => {
  return new Response(JSON.stringify({
    success: false,
    error: 'Endpoint not found'
  }), {
    status: 404,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
});

// Main event listener
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request, event));
});

async function handleRequest(request, env) {
  // Handle CORS preflight
  const corsResponse = corsOptions(request);
  if (corsResponse) return corsResponse;
  
  try {
    return await router.handle(request, env);
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error',
      message: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

export default {
  async fetch(request, env, ctx) {
    return handleRequest(request, env);
  }
};
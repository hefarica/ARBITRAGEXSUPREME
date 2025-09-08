/**
 * ArbitrageX Supreme V3.0 - Opportunities API Proxy
 * Cloudflare Edge Function for Backend API Acceleration
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { cache } from 'hono/cache';

interface Env {
  OPPORTUNITIES_CACHE: D1Database;
  API_CACHE: KVNamespace;
  CONTABO_BACKEND_URL: string;
  CONTABO_API_KEY: string;
  CORS_ORIGINS: string;
}

const app = new Hono<{ Bindings: Env }>();

// ========================================
// CORS Configuration for Frontend
// ========================================
app.use('/api/proxy/opportunities/*', cors({
  origin: (origin, c) => {
    const allowedOrigins = c.env.CORS_ORIGINS.split(',');
    return allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  },
  allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  exposeHeaders: ['X-Total-Count', 'X-Cache-Status'],
  maxAge: 86400,
  credentials: true,
}));

// ========================================
// Cache Middleware
// ========================================
app.use('/api/proxy/opportunities', cache({
  cacheName: 'opportunities-cache',
  cacheControl: 'max-age=5', // 5 seconds for real-time data
  vary: ['Authorization', 'X-API-Key', 'Accept-Encoding'],
}));

// ========================================
// Get Live Opportunities (Cached)
// ========================================
app.get('/api/proxy/opportunities', async (c) => {
  try {
    const { limit = '100', chain, status = 'pending', min_profit } = c.req.query();
    
    // Check KV cache first
    const cacheKey = `opportunities:${chain}:${status}:${min_profit}:${limit}`;
    const cached = await c.env.API_CACHE.get(cacheKey);
    
    if (cached) {
      const parsedCache = JSON.parse(cached);
      return c.json({
        success: true,
        data: parsedCache.data,
        pagination: parsedCache.pagination,
        cache: { hit: true, ttl: parsedCache.ttl }
      });
    }

    // Check D1 cache
    const d1Query = `
      SELECT * FROM cached_opportunities 
      WHERE (? IS NULL OR chain = ?) 
      AND (? IS NULL OR execution_status = ?)
      AND (? IS NULL OR estimated_profit >= ?)
      ORDER BY estimated_profit DESC, risk_score ASC
      LIMIT ?
    `;
    
    const d1Results = await c.env.OPPORTUNITIES_CACHE.prepare(d1Query)
      .bind(chain, chain, status, status, min_profit, min_profit, parseInt(limit))
      .all();

    if (d1Results.results.length > 0) {
      const response = {
        success: true,
        data: d1Results.results,
        pagination: {
          page: 1,
          limit: parseInt(limit),
          total: d1Results.results.length,
          hasNext: false
        },
        cache: { hit: true, source: 'd1', ttl: 30 }
      };

      // Cache in KV for faster access
      await c.env.API_CACHE.put(cacheKey, JSON.stringify(response), { expirationTtl: 30 });
      return c.json(response);
    }

    // Fallback to Contabo backend
    const backendUrl = `${c.env.CONTABO_BACKEND_URL}/api/opportunities`;
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit);
    if (chain) params.append('chain', chain);
    if (status) params.append('status', status);
    if (min_profit) params.append('min_profit', min_profit);

    const backendResponse = await fetch(`${backendUrl}?${params.toString()}`, {
      headers: {
        'Authorization': c.req.header('Authorization') || '',
        'X-API-Key': c.env.CONTABO_API_KEY,
        'User-Agent': 'ArbitrageX-Edge/3.0',
        'Accept': 'application/json',
      },
    });

    if (!backendResponse.ok) {
      throw new Error(`Backend error: ${backendResponse.status}`);
    }

    const data = await backendResponse.json();

    // Cache successful response
    if (data.success && data.data?.length > 0) {
      // Cache in D1 for medium-term storage
      const insertQuery = `
        INSERT OR REPLACE INTO cached_opportunities 
        (opportunity_id, chain, dex_a, dex_b, token_pair, price_difference, 
         volume, estimated_profit, risk_score, execution_status, expiry_time, cached_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      for (const opportunity of data.data) {
        await c.env.OPPORTUNITIES_CACHE.prepare(insertQuery)
          .bind(
            opportunity.opportunity_id,
            opportunity.chain,
            opportunity.dex_a,
            opportunity.dex_b,
            opportunity.token_pair,
            opportunity.price_difference,
            opportunity.volume,
            opportunity.estimated_profit,
            opportunity.risk_score,
            opportunity.execution_status,
            opportunity.expiry_time,
            new Date().toISOString()
          ).run();
      }

      // Cache in KV for fast access
      const cacheData = { ...data, cache: { hit: false, ttl: 30 } };
      await c.env.API_CACHE.put(cacheKey, JSON.stringify(cacheData), { expirationTtl: 30 });
    }

    return c.json({
      ...data,
      cache: { hit: false, source: 'backend' }
    });

  } catch (error) {
    console.error('Opportunities proxy error:', error);
    
    return c.json({
      success: false,
      error: {
        code: 'PROXY_ERROR',
        message: 'Failed to fetch opportunities',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// ========================================
// Execute Opportunity (Direct Proxy)
// ========================================
app.post('/api/proxy/opportunities/:id/execute', async (c) => {
  try {
    const opportunityId = c.req.param('id');
    const body = await c.req.json();

    const backendUrl = `${c.env.CONTABO_BACKEND_URL}/api/opportunities/${opportunityId}/execute`;
    
    const backendResponse = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': c.req.header('Authorization') || '',
        'X-API-Key': c.env.CONTABO_API_KEY,
        'User-Agent': 'ArbitrageX-Edge/3.0',
      },
      body: JSON.stringify(body),
    });

    if (!backendResponse.ok) {
      throw new Error(`Backend execution error: ${backendResponse.status}`);
    }

    const data = await backendResponse.json();

    // Clear cache for this opportunity
    if (data.success) {
      const cacheKeys = await c.env.API_CACHE.list({ prefix: 'opportunities:' });
      for (const key of cacheKeys.keys) {
        await c.env.API_CACHE.delete(key.name);
      }

      // Update D1 cache status
      await c.env.OPPORTUNITIES_CACHE.prepare(`
        UPDATE cached_opportunities 
        SET execution_status = 'executed', updated_at = ?
        WHERE opportunity_id = ?
      `).bind(new Date().toISOString(), opportunityId).run();
    }

    return c.json(data);

  } catch (error) {
    console.error('Opportunity execution proxy error:', error);
    
    return c.json({
      success: false,
      error: {
        code: 'EXECUTION_PROXY_ERROR',
        message: 'Failed to execute opportunity',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      timestamp: new Date().toISOString()
    }, 500);
  }
});

// ========================================
// Health Check
// ========================================
app.get('/api/proxy/opportunities/health', async (c) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      kv_cache: 'unknown',
      d1_cache: 'unknown',
      backend_connection: 'unknown'
    },
    performance: {
      kv_latency: 0,
      d1_latency: 0,
      backend_latency: 0
    }
  };

  try {
    // Test KV cache
    const kvStart = Date.now();
    await c.env.API_CACHE.get('health-check');
    health.performance.kv_latency = Date.now() - kvStart;
    health.services.kv_cache = 'healthy';
  } catch {
    health.services.kv_cache = 'unhealthy';
  }

  try {
    // Test D1 cache
    const d1Start = Date.now();
    await c.env.OPPORTUNITIES_CACHE.prepare('SELECT 1').first();
    health.performance.d1_latency = Date.now() - d1Start;
    health.services.d1_cache = 'healthy';
  } catch {
    health.services.d1_cache = 'unhealthy';
  }

  try {
    // Test backend connection
    const backendStart = Date.now();
    const response = await fetch(`${c.env.CONTABO_BACKEND_URL}/api/health`, {
      headers: { 'X-API-Key': c.env.CONTABO_API_KEY }
    });
    health.performance.backend_latency = Date.now() - backendStart;
    health.services.backend_connection = response.ok ? 'healthy' : 'unhealthy';
  } catch {
    health.services.backend_connection = 'unhealthy';
  }

  const overallHealthy = Object.values(health.services).every(status => status === 'healthy');
  health.status = overallHealthy ? 'healthy' : 'degraded';

  return c.json(health);
});

export default app;
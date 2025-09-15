/**
 * ArbitrageX Supreme V3.0 - Rate Limiter Worker
 * Advanced rate limiting with DDoS protection and adaptive throttling
 */

export interface Env {
  RATE_LIMITER_KV: KVNamespace;
  RATE_LIMITER_DURABLE_OBJECT: DurableObjectNamespace;
}

interface RateLimitConfig {
  requests: number;
  window: number; // seconds
  burst: number;
  penalty: number; // seconds
}

interface ClientInfo {
  ip: string;
  userAgent: string;
  country?: string;
  asn?: string;
}

class RateLimitCounter {
  private state: DurableObjectState;
  private env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const clientId = url.searchParams.get('clientId');
    const endpoint = url.searchParams.get('endpoint');
    
    if (!clientId || !endpoint) {
      return new Response('Missing clientId or endpoint', { status: 400 });
    }

    const config = this.getEndpointConfig(endpoint);
    const now = Date.now();
    const windowStart = Math.floor(now / (config.window * 1000)) * (config.window * 1000);
    
    const key = `${clientId}:${endpoint}:${windowStart}`;
    const current = await this.state.storage.get<number>(key) || 0;
    
    // Check if rate limit exceeded
    if (current >= config.requests) {
      // Apply penalty
      const penaltyKey = `penalty:${clientId}:${endpoint}`;
      const penaltyUntil = now + (config.penalty * 1000);
      await this.state.storage.put(penaltyKey, penaltyUntil);
      
      return new Response(JSON.stringify({
        allowed: false,
        remaining: 0,
        resetTime: windowStart + (config.window * 1000),
        penaltyUntil
      }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': config.requests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': Math.ceil((windowStart + config.window * 1000) / 1000).toString(),
          'Retry-After': config.penalty.toString()
        }
      });
    }

    // Check penalty status
    const penaltyKey = `penalty:${clientId}:${endpoint}`;
    const penaltyUntil = await this.state.storage.get<number>(penaltyKey);
    if (penaltyUntil && now < penaltyUntil) {
      return new Response(JSON.stringify({
        allowed: false,
        remaining: 0,
        resetTime: penaltyUntil,
        penaltyUntil
      }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': Math.ceil((penaltyUntil - now) / 1000).toString()
        }
      });
    }

    // Increment counter
    await this.state.storage.put(key, current + 1);
    
    // Set TTL for cleanup
    const ttl = windowStart + (config.window * 2 * 1000); // Double window for safety
    await this.state.storage.setAlarm(ttl);

    const remaining = Math.max(0, config.requests - current - 1);
    
    return new Response(JSON.stringify({
      allowed: true,
      remaining,
      resetTime: windowStart + (config.window * 1000),
      penaltyUntil: null
    }), {
      headers: {
        'Content-Type': 'application/json',
        'X-RateLimit-Limit': config.requests.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': Math.ceil((windowStart + config.window * 1000) / 1000).toString()
      }
    });
  }

  async alarm() {
    // Cleanup old entries
    const now = Date.now();
    const keys = await this.state.storage.list();
    
    for (const [key, value] of keys) {
      if (typeof key === 'string' && key.includes(':')) {
        const parts = key.split(':');
        if (parts.length >= 3) {
          const timestamp = parseInt(parts[parts.length - 1]);
          if (!isNaN(timestamp) && now > timestamp + 3600000) { // 1 hour cleanup
            await this.state.storage.delete(key);
          }
        }
      }
    }
  }

  private getEndpointConfig(endpoint: string): RateLimitConfig {
    const configs: Record<string, RateLimitConfig> = {
      'opportunities': { requests: 100, window: 60, burst: 10, penalty: 300 },
      'executions': { requests: 50, window: 60, burst: 5, penalty: 600 },
      'analytics': { requests: 200, window: 60, burst: 20, penalty: 180 },
      'websocket': { requests: 10, window: 60, burst: 2, penalty: 900 },
      'strategies': { requests: 30, window: 60, burst: 3, penalty: 400 },
      'default': { requests: 60, window: 60, burst: 6, penalty: 300 }
    };
    
    return configs[endpoint] || configs.default;
  }
}

export { RateLimitCounter };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const clientInfo = extractClientInfo(request);
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleCORS();
    }

    try {
      // Extract endpoint from path
      const endpoint = extractEndpoint(url.pathname);
      const clientId = await generateClientId(clientInfo, env);
      
      // Check rate limit using Durable Object
      const durableObjectId = env.RATE_LIMITER_DURABLE_OBJECT.idFromName(clientId);
      const durableObject = env.RATE_LIMITER_DURABLE_OBJECT.get(durableObjectId);
      
      const rateLimitUrl = new URL(request.url);
      rateLimitUrl.searchParams.set('clientId', clientId);
      rateLimitUrl.searchParams.set('endpoint', endpoint);
      
      const rateLimitRequest = new Request(rateLimitUrl.toString(), {
        method: 'GET'
      });
      
      const rateLimitResponse = await durableObject.fetch(rateLimitRequest);
      const rateLimitResult = await rateLimitResponse.json() as any;
      
      if (!rateLimitResult.allowed) {
        return new Response(JSON.stringify({
          error: 'Rate limit exceeded',
          message: 'Too many requests. Please slow down.',
          retryAfter: rateLimitResponse.headers.get('Retry-After'),
          resetTime: rateLimitResult.resetTime
        }), {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'X-RateLimit-Limit': rateLimitResponse.headers.get('X-RateLimit-Limit') || '',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': rateLimitResponse.headers.get('X-RateLimit-Reset') || '',
            'Retry-After': rateLimitResponse.headers.get('Retry-After') || '60'
          }
        });
      }

      // Rate limit passed - return success with headers
      return new Response(JSON.stringify({
        allowed: true,
        remaining: rateLimitResult.remaining,
        resetTime: rateLimitResult.resetTime,
        clientId: clientId.substring(0, 8) + '...' // Partial client ID for debugging
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'X-RateLimit-Limit': rateLimitResponse.headers.get('X-RateLimit-Limit') || '',
          'X-RateLimit-Remaining': rateLimitResponse.headers.get('X-RateLimit-Remaining') || '',
          'X-RateLimit-Reset': rateLimitResponse.headers.get('X-RateLimit-Reset') || ''
        }
      });

    } catch (error) {
      console.error('Rate limiter error:', error);
      
      return new Response(JSON.stringify({
        error: 'Rate limiter service error',
        message: 'Internal service error. Please try again later.'
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }
};

function extractClientInfo(request: Request): ClientInfo {
  const clientIP = request.headers.get('CF-Connecting-IP') || 
                   request.headers.get('X-Forwarded-For') || 
                   'unknown';
  
  return {
    ip: clientIP,
    userAgent: request.headers.get('User-Agent') || 'unknown',
    country: request.headers.get('CF-IPCountry') || undefined,
    asn: request.headers.get('CF-ASN') || undefined
  };
}

function extractEndpoint(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return 'default';
  
  // Map common paths to endpoints
  const pathMappings: Record<string, string> = {
    'api': 'api',
    'opportunities': 'opportunities',
    'executions': 'executions',
    'analytics': 'analytics',
    'ws': 'websocket',
    'websocket': 'websocket',
    'strategies': 'strategies'
  };
  
  return pathMappings[segments[0]] || 'default';
}

async function generateClientId(clientInfo: ClientInfo, env: Env): Promise<string> {
  // Create a stable client ID based on IP + User Agent
  const data = `${clientInfo.ip}:${clientInfo.userAgent}`;
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = new Uint8Array(hashBuffer);
  const hashHex = Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('');
  
  return hashHex;
}

function handleCORS(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
      'Access-Control-Max-Age': '86400'
    }
  });
}

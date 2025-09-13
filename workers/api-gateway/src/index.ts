/**
 * 🚪 API GATEWAY - ArbitrageX Supreme V3.0
 * 
 * METODOLOGÍA: INGENIO PICHICHI S.A.
 * - Disciplinado: Routing inteligente a backend Contabo
 * - Organizado: Rate limiting y security por endpoint
 * - Metodológico: Fallbacks y error handling robusto
 * 
 * RESPONSABILIDAD: 
 * - Route API requests to Contabo backend
 * - Apply rate limiting and DDoS protection
 * - Handle request/response transformation
 * - Provide fallback mechanisms
 * 
 * @version 3.0.0 - CLOUDFLARE EDGE ONLY
 * @author ArbitrageX Supreme Engineering Team
 */

export interface Env {
  CONTABO_BACKEND_URL: string;
  RATE_LIMIT_MAX: string;
  API_KEY_SECRET: string;
}

interface RateLimitState {
  requests: number;
  resetTime: number;
}

// Rate limiting storage (in-memory for Worker)
const rateLimitMap = new Map<string, RateLimitState>();

// Backend endpoints configuration
const BACKEND_ROUTES = {
  '/api/opportunities': { 
    method: ['GET'], 
    rateLimit: 100, // requests per minute
    cache: 15 // seconds
  },
  '/api/execute': { 
    method: ['POST'], 
    rateLimit: 10, // requests per minute
    cache: 0 // no cache for execution
  },
  '/api/portfolio': { 
    method: ['GET'], 
    rateLimit: 60, // requests per minute
    cache: 300 // 5 minutes
  },
  '/api/analytics': { 
    method: ['GET'], 
    rateLimit: 30, // requests per minute
    cache: 600 // 10 minutes
  },
  '/api/health': { 
    method: ['GET'], 
    rateLimit: 1000, // requests per minute
    cache: 60 // 1 minute
  }
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    // Enable CORS for all requests
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
      'Access-Control-Max-Age': '86400',
    };
    
    if (request.method === 'OPTIONS') {
      return new Response(null, { 
        status: 200, 
        headers: corsHeaders 
      });
    }
    
    // Health check for API Gateway itself
    if (url.pathname === '/gateway/health') {
      return new Response(JSON.stringify({
        status: 'healthy',
        service: 'api-gateway',
        version: '3.0.0',
        timestamp: Date.now(),
        backend_url: env.CONTABO_BACKEND_URL || 'not_configured'
      }), {
        status: 200,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      });
    }
    
    // Route API requests to backend
    if (url.pathname.startsWith('/api/')) {
      return handleApiRequest(request, env, corsHeaders);
    }
    
    // Default response
    return new Response('ArbitrageX API Gateway - Route not found', { 
      status: 404,
      headers: corsHeaders
    });
  }
};

/**
 * Handle API requests with rate limiting and backend routing
 */
async function handleApiRequest(request: Request, env: Env, corsHeaders: any): Promise<Response> {
  const url = new URL(request.url);
  const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
  const userAgent = request.headers.get('User-Agent') || 'unknown';
  
  try {
    // Validate backend URL is configured
    if (!env.CONTABO_BACKEND_URL) {
      return new Response(JSON.stringify({
        error: 'Backend not configured',
        code: 'BACKEND_NOT_CONFIGURED'
      }), {
        status: 503,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        }
      });
    }
    
    // Find route configuration
    const routeConfig = findRouteConfig(url.pathname);
    if (!routeConfig) {
      return new Response(JSON.stringify({
        error: 'Route not found',
        path: url.pathname,
        available_routes: Object.keys(BACKEND_ROUTES)
      }), {
        status: 404,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        }
      });
    }
    
    // Validate HTTP method
    if (!routeConfig.method.includes(request.method)) {
      return new Response(JSON.stringify({
        error: 'Method not allowed',
        allowed_methods: routeConfig.method
      }), {
        status: 405,
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        }
      });
    }
    
    // Apply rate limiting
    const rateLimitResult = await applyRateLimit(clientIP, url.pathname, routeConfig.rateLimit);
    if (!rateLimitResult.allowed) {
      return new Response(JSON.stringify({
        error: 'Rate limit exceeded',
        limit: routeConfig.rateLimit,
        reset_time: rateLimitResult.resetTime
      }), {
        status: 429,
        headers: { 
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': routeConfig.rateLimit.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': rateLimitResult.resetTime.toString(),
          ...corsHeaders 
        }
      });
    }
    
    // Proxy request to Contabo backend
    const backendResponse = await proxyToBackend(request, env.CONTABO_BACKEND_URL);
    
    // Add rate limit headers to successful response
    const responseHeaders = new Headers(backendResponse.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      responseHeaders.set(key, value);
    });
    responseHeaders.set('X-RateLimit-Limit', routeConfig.rateLimit.toString());
    responseHeaders.set('X-RateLimit-Remaining', (routeConfig.rateLimit - rateLimitResult.currentCount).toString());
    responseHeaders.set('X-Served-By', 'cloudflare-edge-gateway');
    
    return new Response(backendResponse.body, {
      status: backendResponse.status,
      statusText: backendResponse.statusText,
      headers: responseHeaders
    });
    
  } catch (error) {
    console.error('API Gateway Error:', error);
    
    return new Response(JSON.stringify({
      error: 'Gateway error',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now()
    }), {
      status: 502,
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      }
    });
  }
}

/**
 * Find route configuration for a path
 */
function findRouteConfig(pathname: string) {
  // Exact match first
  if (BACKEND_ROUTES[pathname]) {
    return BACKEND_ROUTES[pathname];
  }
  
  // Pattern matching for dynamic routes
  for (const [route, config] of Object.entries(BACKEND_ROUTES)) {
    if (pathname.startsWith(route.replace('*', ''))) {
      return config;
    }
  }
  
  return null;
}

/**
 * Apply rate limiting based on client IP and endpoint
 */
async function applyRateLimit(clientIP: string, endpoint: string, limit: number): Promise<{
  allowed: boolean;
  currentCount: number;
  resetTime: number;
}> {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute window
  const resetTime = Math.ceil(now / windowMs) * windowMs;
  const key = `${clientIP}:${endpoint}`;
  
  let state = rateLimitMap.get(key);
  
  // Initialize or reset if window expired
  if (!state || now >= state.resetTime) {
    state = {
      requests: 1,
      resetTime: resetTime
    };
    rateLimitMap.set(key, state);
    
    return {
      allowed: true,
      currentCount: 1,
      resetTime: resetTime
    };
  }
  
  // Increment request count
  state.requests += 1;
  rateLimitMap.set(key, state);
  
  return {
    allowed: state.requests <= limit,
    currentCount: state.requests,
    resetTime: state.resetTime
  };
}

/**
 * Proxy request to Contabo backend
 */
async function proxyToBackend(request: Request, backendUrl: string): Promise<Response> {
  const url = new URL(request.url);
  
  // Construct backend URL
  const backendRequestUrl = new URL(url.pathname + url.search, backendUrl);
  
  // Forward headers (excluding Cloudflare-specific headers)
  const forwardHeaders = new Headers();
  const excludeHeaders = ['cf-ray', 'cf-connecting-ip', 'cf-ipcountry', 'cf-visitor'];
  
  request.headers.forEach((value, key) => {
    if (!excludeHeaders.includes(key.toLowerCase()) && !key.toLowerCase().startsWith('cf-')) {
      forwardHeaders.set(key, value);
    }
  });
  
  // Add backend identification headers
  forwardHeaders.set('X-Forwarded-For', request.headers.get('CF-Connecting-IP') || 'unknown');
  forwardHeaders.set('X-Forwarded-Proto', 'https');
  forwardHeaders.set('X-Gateway', 'cloudflare-edge');
  
  // Create backend request
  const backendRequest = new Request(backendRequestUrl.toString(), {
    method: request.method,
    headers: forwardHeaders,
    body: request.body,
    // @ts-ignore - duplex is valid for streaming
    duplex: 'half'
  });
  
  // Set timeout for backend requests
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
  
  try {
    const response = await fetch(backendRequest, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    return response;
    
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      return new Response(JSON.stringify({
        error: 'Backend timeout',
        message: 'Backend request timed out after 30 seconds'
      }), {
        status: 504,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({
      error: 'Backend connection failed',
      message: error instanceof Error ? error.message : 'Unknown backend error'
    }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Cleanup rate limit map periodically (runs in Worker's background)
setInterval(() => {
  const now = Date.now();
  for (const [key, state] of rateLimitMap.entries()) {
    if (now >= state.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 60000); // Clean every minute
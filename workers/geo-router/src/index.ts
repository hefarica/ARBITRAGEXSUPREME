/**
 * ArbitrageX Supreme V3.0 - Geo-Router Edge Worker
 * Target: <5ms routing decision + <25ms edge-to-backend
 * Ingenio Pichichi S.A. - Ultra-Low Latency Architecture
 */

export interface Env {
  // Regional backend URLs
  US_EAST_BACKEND: string;
  EU_CENTRAL_BACKEND: string;
  AP_NORTHEAST_BACKEND: string;
  
  // Service bindings
  RATE_LIMITER: DurableObjectNamespace;
  ANALYTICS: AnalyticsEngineDataset;
  
  // KV for configuration
  GEO_CONFIG: KVNamespace;
  
  // Secrets
  JWT_SECRET: string;
  API_KEY: string;
}

interface RegionConfig {
  name: string;
  backend_url: string;
  health_check_url: string;
  latency_threshold_ms: number;
  capacity: number;
  enabled: boolean;
}

interface RequestMetrics {
  colo: string;
  country: string;
  region: string;
  latency_ms: number;
  backend_region: string;
  cache_hit: boolean;
  method: string;
  path: string;
  timestamp: number;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const startTime = Date.now();
    
    // Enable HTTP/3 and set performance headers
    const headers = new Headers({
      'Alt-Svc': 'h3=":443"; ma=86400',
      'Server': 'ArbitrageX-Edge/3.0',
      'X-Edge-Location': request.cf?.colo as string || 'unknown',
    });

    try {
      // 1. Fast path for static assets and health checks
      if (request.method === 'GET') {
        const url = new URL(request.url);
        
        if (url.pathname === '/health') {
          return new Response('OK', { status: 200, headers });
        }
        
        if (url.pathname.startsWith('/static/')) {
          return handleStaticAsset(request, headers);
        }
      }

      // 2. Authentication and rate limiting
      const authResult = await authenticateRequest(request, env);
      if (!authResult.success) {
        return new Response(JSON.stringify({ error: authResult.error }), {
          status: 401,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }

      // 3. Geo-based backend selection (target: <1ms)
      const geoStart = Date.now();
      const selectedRegion = await selectOptimalRegion(request, env);
      const geoLatency = Date.now() - geoStart;

      // 4. Route to regional backend with HTTP/3 optimization
      const routeStart = Date.now();
      const response = await routeToBackend(request, selectedRegion, env, ctx);
      const routeLatency = Date.now() - routeStart;

      // 5. Add performance headers and metrics
      const totalLatency = Date.now() - startTime;
      response.headers.set('X-Edge-Latency-Ms', totalLatency.toString());
      response.headers.set('X-Geo-Selection-Ms', geoLatency.toString());
      response.headers.set('X-Backend-Latency-Ms', routeLatency.toString());
      response.headers.set('X-Selected-Region', selectedRegion.name);

      // 6. Log metrics for monitoring
      ctx.waitUntil(logRequestMetrics({
        colo: request.cf?.colo as string,
        country: request.cf?.country as string,
        region: request.cf?.region as string,
        latency_ms: totalLatency,
        backend_region: selectedRegion.name,
        cache_hit: false,
        method: request.method,
        path: new URL(request.url).pathname,
        timestamp: Date.now(),
      }, env));

      return response;

    } catch (error) {
      console.error('Geo-router error:', error);
      
      return new Response(JSON.stringify({ 
        error: 'Internal server error',
        trace_id: crypto.randomUUID()
      }), {
        status: 500,
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }
  },

  // WebSocket handler for real-time connections
  async webSocketHandler(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    if (url.pathname === '/ws/opportunities') {
      return handleOpportunityWebSocket(request, env);
    }
    
    if (url.pathname === '/ws/control') {
      return handleControlWebSocket(request, env);
    }
    
    return new Response('WebSocket endpoint not found', { status: 404 });
  }
};

/**
 * Select optimal backend region based on geography and health
 */
async function selectOptimalRegion(request: Request, env: Env): Promise<RegionConfig> {
  const cf = request.cf;
  const clientRegion = cf?.region as string || 'unknown';
  const clientColo = cf?.colo as string || 'unknown';

  // Regional mapping with latency priorities
  const regionMappings: Record<string, string[]> = {
    'us-east': ['US_EAST_BACKEND'],
    'us-west': ['US_EAST_BACKEND'], // Cross-country acceptable for US
    'europe': ['EU_CENTRAL_BACKEND', 'US_EAST_BACKEND'],
    'asia': ['AP_NORTHEAST_BACKEND', 'EU_CENTRAL_BACKEND'],
    'oceania': ['AP_NORTHEAST_BACKEND', 'US_EAST_BACKEND'],
    'africa': ['EU_CENTRAL_BACKEND', 'US_EAST_BACKEND'],
    'south-america': ['US_EAST_BACKEND', 'EU_CENTRAL_BACKEND'],
  };

  // Get cached region configs
  const configs = await getRegionConfigs(env);
  
  // Determine client's macro-region
  let macroRegion = 'us-east'; // Default fallback
  if (clientRegion) {
    if (clientRegion.includes('europe') || clientRegion.includes('africa')) {
      macroRegion = 'europe';
    } else if (clientRegion.includes('asia') || clientRegion.includes('oceania')) {
      macroRegion = 'asia';
    } else if (clientRegion.includes('south-america')) {
      macroRegion = 'south-america';
    }
  }

  // Select best available backend
  const preferredBackends = regionMappings[macroRegion] || ['US_EAST_BACKEND'];
  
  for (const backendKey of preferredBackends) {
    const config = configs[backendKey];
    if (config && config.enabled) {
      // TODO: Add health check and capacity validation
      return config;
    }
  }

  // Fallback to first available backend
  const availableConfigs = Object.values(configs).filter(c => c.enabled);
  if (availableConfigs.length > 0) {
    return availableConfigs[0];
  }

  throw new Error('No healthy backend regions available');
}

/**
 * Route request to selected backend with optimizations
 */
async function routeToBackend(
  request: Request, 
  region: RegionConfig, 
  env: Env, 
  ctx: ExecutionContext
): Promise<Response> {
  const url = new URL(request.url);
  const backendUrl = new URL(url.pathname + url.search, region.backend_url);

  // Clone request with backend URL
  const backendRequest = new Request(backendUrl.toString(), {
    method: request.method,
    headers: request.headers,
    body: request.body,
  });

  // Add edge headers
  backendRequest.headers.set('X-Forwarded-For', request.headers.get('CF-Connecting-IP') || '');
  backendRequest.headers.set('X-Edge-Region', region.name);
  backendRequest.headers.set('X-Client-Colo', request.cf?.colo as string || '');

  // Fetch with timeout and HTTP/3 optimization
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

  try {
    const response = await fetch(backendRequest, {
      signal: controller.signal,
      cf: {
        // Enable HTTP/3 and optimize for latency
        h2: true,
        h3: true,
        cacheTtl: 0, // No edge caching for dynamic API responses
        cacheEverything: false,
      }
    });

    clearTimeout(timeoutId);

    // Clone response and add CORS headers
    const modifiedResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });

    // Add CORS and performance headers
    modifiedResponse.headers.set('Access-Control-Allow-Origin', '*');
    modifiedResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    modifiedResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
    modifiedResponse.headers.set('X-Backend-Region', region.name);

    return modifiedResponse;

  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Handle WebSocket connections for real-time opportunities
 */
async function handleOpportunityWebSocket(request: Request, env: Env): Promise<Response> {
  // Upgrade to WebSocket
  const upgradeHeader = request.headers.get('Upgrade');
  if (!upgradeHeader || upgradeHeader !== 'websocket') {
    return new Response('Expected Upgrade: websocket', { status: 426 });
  }

  const webSocketPair = new WebSocketPair();
  const [client, server] = Object.values(webSocketPair);

  server.accept();

  // Handle WebSocket messages
  server.addEventListener('message', async (event) => {
    try {
      const message = JSON.parse(event.data as string);
      
      switch (message.type) {
        case 'subscribe':
          // Subscribe to opportunity streams
          await subscribeToOpportunities(server, message.filters);
          break;
          
        case 'unsubscribe':
          await unsubscribeFromOpportunities(server, message.filters);
          break;
          
        case 'ping':
          server.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          break;
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
      server.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
    }
  });

  server.addEventListener('close', () => {
    console.log('WebSocket connection closed');
  });

  return new Response(null, {
    status: 101,
    webSocket: client,
  });
}

/**
 * Authentication helper
 */
async function authenticateRequest(request: Request, env: Env): Promise<{ success: boolean; error?: string }> {
  const authHeader = request.headers.get('Authorization');
  const apiKey = request.headers.get('X-API-Key');

  if (apiKey && apiKey === env.API_KEY) {
    return { success: true };
  }

  if (authHeader?.startsWith('Bearer ')) {
    // TODO: Validate JWT token
    return { success: true };
  }

  return { success: false, error: 'Missing or invalid authentication' };
}

/**
 * Get cached region configurations
 */
async function getRegionConfigs(env: Env): Promise<Record<string, RegionConfig>> {
  // TODO: Implement KV-based config caching with TTL
  return {
    'US_EAST_BACKEND': {
      name: 'us-east-1',
      backend_url: env.US_EAST_BACKEND || 'https://api-us.arbitragex.com',
      health_check_url: '/health',
      latency_threshold_ms: 100,
      capacity: 1000,
      enabled: true,
    },
    'EU_CENTRAL_BACKEND': {
      name: 'eu-central-1',
      backend_url: env.EU_CENTRAL_BACKEND || 'https://api-eu.arbitragex.com',
      health_check_url: '/health',
      latency_threshold_ms: 100,
      capacity: 800,
      enabled: true,
    },
    'AP_NORTHEAST_BACKEND': {
      name: 'ap-northeast-1',
      backend_url: env.AP_NORTHEAST_BACKEND || 'https://api-ap.arbitragex.com',
      health_check_url: '/health',
      latency_threshold_ms: 120,
      capacity: 600,
      enabled: true,
    },
  };
}

// Helper functions
async function handleStaticAsset(request: Request, headers: Headers): Promise<Response> {
  // Serve static assets with aggressive caching
  return new Response('Static asset', { 
    status: 200, 
    headers: { ...headers, 'Cache-Control': 'public, max-age=3600' }
  });
}

async function subscribeToOpportunities(ws: WebSocket, filters: any): Promise<void> {
  // TODO: Implement opportunity subscription logic
  ws.send(JSON.stringify({ type: 'subscribed', filters }));
}

async function unsubscribeFromOpportunities(ws: WebSocket, filters: any): Promise<void> {
  // TODO: Implement opportunity unsubscription logic  
  ws.send(JSON.stringify({ type: 'unsubscribed', filters }));
}

async function handleControlWebSocket(request: Request, env: Env): Promise<Response> {
  // TODO: Implement control WebSocket for admin operations
  return new Response('Control WebSocket not implemented', { status: 501 });
}

async function logRequestMetrics(metrics: RequestMetrics, env: Env): Promise<void> {
  // Log to Analytics Engine for monitoring
  env.ANALYTICS.writeDataPoint({
    blobs: [
      metrics.colo,
      metrics.country,
      metrics.region,
      metrics.backend_region,
      metrics.method,
      metrics.path,
    ],
    doubles: [
      metrics.latency_ms,
      metrics.timestamp,
    ],
    indexes: [
      metrics.cache_hit ? 'cache_hit' : 'cache_miss',
    ],
  });
}
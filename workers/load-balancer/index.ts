/**
 * ArbitrageX Supreme V3.0 - Load Balancer Worker
 * Intelligent load balancing with health checks and failover for Backend services
 */

export interface Env {
  LOAD_BALANCER_KV: KVNamespace;
  BACKEND_SERVERS: string; // JSON array of backend servers
  HEALTH_CHECK_INTERVAL: string; // seconds
}

interface BackendServer {
  id: string;
  url: string;
  weight: number;
  healthy: boolean;
  lastHealthCheck: number;
  responseTime: number;
  errorCount: number;
  requestCount: number;
}

interface LoadBalancerConfig {
  algorithm: 'round-robin' | 'weighted' | 'least-connections' | 'health-based';
  healthCheckPath: string;
  healthCheckTimeout: number;
  maxRetries: number;
  retryDelay: number;
}

interface RequestMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  lastRequestTime: number;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleCORS();
    }

    try {
      const operation = url.pathname.split('/').pop();
      
      switch (operation) {
        case 'health':
          return await handleHealthCheck(env);
        case 'status':
          return await handleStatus(env);
        case 'servers':
          return await handleServers(request, env);
        case 'metrics':
          return await handleMetrics(env);
        default:
          // Main load balancing logic
          return await handleLoadBalancing(request, env, ctx);
      }
    } catch (error) {
      console.error('Load balancer error:', error);
      
      return new Response(JSON.stringify({
        error: 'Load balancer service error',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    // Periodic health checks
    ctx.waitUntil(performHealthChecks(env));
  }
};

async function handleLoadBalancing(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const startTime = Date.now();
  const config = getLoadBalancerConfig();
  
  // Get available backend servers
  const servers = await getBackendServers(env);
  const healthyServers = servers.filter(server => server.healthy);
  
  if (healthyServers.length === 0) {
    return new Response(JSON.stringify({
      error: 'No healthy backend servers available',
      message: 'All backend servers are currently unavailable. Please try again later.',
      timestamp: Date.now()
    }), {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Retry-After': '30'
      }
    });
  }

  // Select backend server using configured algorithm
  const selectedServer = await selectBackendServer(healthyServers, config, env);
  
  if (!selectedServer) {
    return new Response(JSON.stringify({
      error: 'Server selection failed',
      message: 'Unable to select a backend server',
      timestamp: Date.now()
    }), {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  // Forward request to selected backend
  let attempt = 0;
  let lastError: Error | null = null;
  
  while (attempt < config.maxRetries) {
    try {
      const backendUrl = new URL(request.url);
      backendUrl.protocol = new URL(selectedServer.url).protocol;
      backendUrl.host = new URL(selectedServer.url).host;
      
      // Create forwarded request
      const forwardedRequest = new Request(backendUrl.toString(), {
        method: request.method,
        headers: {
          ...Object.fromEntries(request.headers.entries()),
          'X-Forwarded-For': request.headers.get('CF-Connecting-IP') || 'unknown',
          'X-Forwarded-Proto': backendUrl.protocol.slice(0, -1),
          'X-Forwarded-Host': request.headers.get('Host') || 'unknown',
          'X-Load-Balancer': 'ArbitrageX-Edge'
        },
        body: request.body
      });

      const response = await fetch(forwardedRequest, {
        signal: AbortSignal.timeout(30000) // 30 second timeout
      });

      const responseTime = Date.now() - startTime;
      
      // Update server metrics
      await updateServerMetrics(selectedServer, true, responseTime, env);
      
      // Add load balancer headers
      const responseHeaders = new Headers(response.headers);
      responseHeaders.set('X-Load-Balancer', 'ArbitrageX-Edge');
      responseHeaders.set('X-Backend-Server', selectedServer.id);
      responseHeaders.set('X-Response-Time', responseTime.toString());
      responseHeaders.set('Access-Control-Allow-Origin', '*');
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders
      });

    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      attempt++;
      
      // Update server metrics for failed request
      await updateServerMetrics(selectedServer, false, Date.now() - startTime, env);
      
      if (attempt < config.maxRetries) {
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, config.retryDelay * attempt));
        
        // Try to select a different server for retry
        const otherServers = healthyServers.filter(s => s.id !== selectedServer.id);
        if (otherServers.length > 0) {
          const newServer = await selectBackendServer(otherServers, config, env);
          if (newServer) {
            selectedServer.id = newServer.id;
            selectedServer.url = newServer.url;
          }
        }
      }
    }
  }

  // All retries failed
  return new Response(JSON.stringify({
    error: 'Backend request failed',
    message: `All ${config.maxRetries} attempts failed. Last error: ${lastError?.message}`,
    server: selectedServer.id,
    timestamp: Date.now()
  }), {
    status: 502,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

async function selectBackendServer(
  servers: BackendServer[], 
  config: LoadBalancerConfig, 
  env: Env
): Promise<BackendServer | null> {
  
  if (servers.length === 0) return null;
  if (servers.length === 1) return servers[0];

  switch (config.algorithm) {
    case 'round-robin':
      return await selectRoundRobin(servers, env);
    
    case 'weighted':
      return selectWeighted(servers);
    
    case 'least-connections':
      return selectLeastConnections(servers);
    
    case 'health-based':
      return selectHealthBased(servers);
    
    default:
      return servers[0];
  }
}

async function selectRoundRobin(servers: BackendServer[], env: Env): Promise<BackendServer> {
  const key = 'round-robin-index';
  const currentIndex = await env.LOAD_BALANCER_KV.get(key);
  const index = currentIndex ? (parseInt(currentIndex) + 1) % servers.length : 0;
  
  await env.LOAD_BALANCER_KV.put(key, index.toString());
  
  return servers[index];
}

function selectWeighted(servers: BackendServer[]): BackendServer {
  const totalWeight = servers.reduce((sum, server) => sum + server.weight, 0);
  const random = Math.random() * totalWeight;
  
  let currentWeight = 0;
  for (const server of servers) {
    currentWeight += server.weight;
    if (random <= currentWeight) {
      return server;
    }
  }
  
  return servers[0];
}

function selectLeastConnections(servers: BackendServer[]): BackendServer {
  return servers.reduce((best, current) => 
    current.requestCount < best.requestCount ? current : best
  );
}

function selectHealthBased(servers: BackendServer[]): BackendServer {
  // Score based on response time and error rate
  const scored = servers.map(server => {
    const errorRate = server.requestCount > 0 ? server.errorCount / server.requestCount : 0;
    const responseTimeScore = Math.max(0, 1000 - server.responseTime) / 1000;
    const errorScore = Math.max(0, 1 - errorRate);
    const score = (responseTimeScore * 0.6) + (errorScore * 0.4);
    
    return { server, score };
  });
  
  scored.sort((a, b) => b.score - a.score);
  return scored[0].server;
}

async function updateServerMetrics(
  server: BackendServer, 
  success: boolean, 
  responseTime: number, 
  env: Env
): Promise<void> {
  const key = `server-metrics:${server.id}`;
  const existing = await env.LOAD_BALANCER_KV.get(key, 'json') as RequestMetrics | null;
  
  const metrics: RequestMetrics = existing || {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    averageResponseTime: 0,
    lastRequestTime: 0
  };
  
  metrics.totalRequests++;
  if (success) {
    metrics.successfulRequests++;
  } else {
    metrics.failedRequests++;
  }
  
  // Update average response time
  metrics.averageResponseTime = 
    (metrics.averageResponseTime * (metrics.totalRequests - 1) + responseTime) / metrics.totalRequests;
  
  metrics.lastRequestTime = Date.now();
  
  await env.LOAD_BALANCER_KV.put(key, JSON.stringify(metrics));
}

async function getBackendServers(env: Env): Promise<BackendServer[]> {
  try {
    const serversJson = env.BACKEND_SERVERS || '[]';
    const serverConfigs = JSON.parse(serversJson) as Array<{
      id: string;
      url: string;
      weight?: number;
    }>;
    
    const servers: BackendServer[] = [];
    
    for (const config of serverConfigs) {
      const healthKey = `health:${config.id}`;
      const healthData = await env.LOAD_BALANCER_KV.get(healthKey, 'json') as {
        healthy: boolean;
        lastCheck: number;
        responseTime: number;
      } | null;
      
      const metricsKey = `server-metrics:${config.id}`;
      const metrics = await env.LOAD_BALANCER_KV.get(metricsKey, 'json') as RequestMetrics | null;
      
      servers.push({
        id: config.id,
        url: config.url,
        weight: config.weight || 1,
        healthy: healthData?.healthy ?? true,
        lastHealthCheck: healthData?.lastCheck ?? 0,
        responseTime: healthData?.responseTime ?? 0,
        errorCount: metrics?.failedRequests ?? 0,
        requestCount: metrics?.totalRequests ?? 0
      });
    }
    
    return servers;
  } catch (error) {
    console.error('Error loading backend servers:', error);
    return [];
  }
}

async function performHealthChecks(env: Env): Promise<void> {
  const servers = await getBackendServers(env);
  const config = getLoadBalancerConfig();
  
  for (const server of servers) {
    try {
      const healthUrl = new URL(config.healthCheckPath, server.url);
      const startTime = Date.now();
      
      const response = await fetch(healthUrl.toString(), {
        method: 'GET',
        signal: AbortSignal.timeout(config.healthCheckTimeout)
      });
      
      const responseTime = Date.now() - startTime;
      const healthy = response.ok;
      
      const healthData = {
        healthy,
        lastCheck: Date.now(),
        responseTime
      };
      
      await env.LOAD_BALANCER_KV.put(`health:${server.id}`, JSON.stringify(healthData));
      
      console.log(`Health check for ${server.id}: ${healthy ? 'HEALTHY' : 'UNHEALTHY'} (${responseTime}ms)`);
      
    } catch (error) {
      console.error(`Health check failed for ${server.id}:`, error);
      
      const healthData = {
        healthy: false,
        lastCheck: Date.now(),
        responseTime: config.healthCheckTimeout
      };
      
      await env.LOAD_BALANCER_KV.put(`health:${server.id}`, JSON.stringify(healthData));
    }
  }
}

async function handleHealthCheck(env: Env): Promise<Response> {
  const servers = await getBackendServers(env);
  const healthyCount = servers.filter(s => s.healthy).length;
  
  return new Response(JSON.stringify({
    status: healthyCount > 0 ? 'healthy' : 'unhealthy',
    totalServers: servers.length,
    healthyServers: healthyCount,
    unhealthyServers: servers.length - healthyCount,
    servers: servers.map(s => ({
      id: s.id,
      url: s.url,
      healthy: s.healthy,
      responseTime: s.responseTime,
      lastHealthCheck: s.lastHealthCheck
    })),
    timestamp: Date.now()
  }), {
    status: healthyCount > 0 ? 200 : 503,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

async function handleStatus(env: Env): Promise<Response> {
  const config = getLoadBalancerConfig();
  
  return new Response(JSON.stringify({
    service: 'ArbitrageX Load Balancer',
    version: '3.0.0',
    algorithm: config.algorithm,
    healthCheckPath: config.healthCheckPath,
    healthCheckTimeout: config.healthCheckTimeout,
    maxRetries: config.maxRetries,
    retryDelay: config.retryDelay,
    timestamp: Date.now()
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

async function handleServers(request: Request, env: Env): Promise<Response> {
  const servers = await getBackendServers(env);
  
  return new Response(JSON.stringify({
    servers,
    count: servers.length,
    healthy: servers.filter(s => s.healthy).length,
    timestamp: Date.now()
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

async function handleMetrics(env: Env): Promise<Response> {
  const servers = await getBackendServers(env);
  const metrics: Record<string, any> = {};
  
  for (const server of servers) {
    const key = `server-metrics:${server.id}`;
    const serverMetrics = await env.LOAD_BALANCER_KV.get(key, 'json') as RequestMetrics | null;
    
    if (serverMetrics) {
      metrics[server.id] = {
        ...serverMetrics,
        successRate: serverMetrics.totalRequests > 0 ? 
          serverMetrics.successfulRequests / serverMetrics.totalRequests : 0,
        errorRate: serverMetrics.totalRequests > 0 ? 
          serverMetrics.failedRequests / serverMetrics.totalRequests : 0
      };
    }
  }
  
  return new Response(JSON.stringify({
    metrics,
    timestamp: Date.now()
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

function getLoadBalancerConfig(): LoadBalancerConfig {
  return {
    algorithm: 'health-based',
    healthCheckPath: '/health',
    healthCheckTimeout: 5000,
    maxRetries: 3,
    retryDelay: 1000
  };
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

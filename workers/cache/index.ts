/**
 * ArbitrageX Supreme V3.0 - Cache Worker
 * High-performance caching with intelligent invalidation and edge optimization
 */

export interface Env {
  CACHE_KV: KVNamespace;
  CACHE_DURABLE_OBJECT: DurableObjectNamespace;
}

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
  version: string;
  tags: string[];
  hitCount: number;
  lastAccessed: number;
}

interface CacheConfig {
  ttl: number;
  maxSize: number;
  compressionThreshold: number;
  tags: string[];
}

class CacheManager {
  private state: DurableObjectState;
  private env: Env;
  private cache: Map<string, CacheEntry>;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.cache = new Map();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;
    
    try {
      switch (method) {
        case 'GET':
          return await this.handleGet(url);
        case 'POST':
          return await this.handleSet(request);
        case 'DELETE':
          return await this.handleDelete(url);
        case 'PATCH':
          return await this.handleInvalidate(request);
        default:
          return new Response('Method not allowed', { status: 405 });
      }
    } catch (error) {
      console.error('Cache manager error:', error);
      return new Response(JSON.stringify({
        error: 'Cache service error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private async handleGet(url: URL): Promise<Response> {
    const key = url.searchParams.get('key');
    if (!key) {
      return new Response('Missing key parameter', { status: 400 });
    }

    // Check memory cache first
    let entry = this.cache.get(key);
    
    // If not in memory, check KV storage
    if (!entry) {
      const kvData = await this.env.CACHE_KV.get(key, 'json');
      if (kvData) {
        entry = kvData as CacheEntry;
        this.cache.set(key, entry);
      }
    }

    if (!entry) {
      return new Response(JSON.stringify({
        hit: false,
        data: null
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check TTL
    const now = Date.now();
    if (now > entry.timestamp + entry.ttl) {
      // Expired - remove from cache
      this.cache.delete(key);
      await this.env.CACHE_KV.delete(key);
      
      return new Response(JSON.stringify({
        hit: false,
        data: null,
        expired: true
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Update access statistics
    entry.hitCount++;
    entry.lastAccessed = now;
    this.cache.set(key, entry);
    
    // Update KV asynchronously
    this.env.CACHE_KV.put(key, JSON.stringify(entry));

    return new Response(JSON.stringify({
      hit: true,
      data: entry.data,
      metadata: {
        timestamp: entry.timestamp,
        ttl: entry.ttl,
        version: entry.version,
        tags: entry.tags,
        hitCount: entry.hitCount,
        age: now - entry.timestamp
      }
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `max-age=${Math.floor((entry.timestamp + entry.ttl - now) / 1000)}`,
        'X-Cache-Hit': 'true',
        'X-Cache-Version': entry.version
      }
    });
  }

  private async handleSet(request: Request): Promise<Response> {
    const body = await request.json() as {
      key: string;
      data: any;
      config?: Partial<CacheConfig>;
    };

    if (!body.key || body.data === undefined) {
      return new Response('Missing key or data', { status: 400 });
    }

    const config = this.getDefaultConfig(body.config);
    const now = Date.now();
    
    const entry: CacheEntry = {
      data: body.data,
      timestamp: now,
      ttl: config.ttl,
      version: this.generateVersion(),
      tags: config.tags,
      hitCount: 0,
      lastAccessed: now
    };

    // Store in memory cache
    this.cache.set(body.key, entry);
    
    // Store in KV with TTL
    const kvTtl = Math.floor(config.ttl / 1000);
    await this.env.CACHE_KV.put(body.key, JSON.stringify(entry), {
      expirationTtl: kvTtl
    });

    // Cleanup old entries if cache is getting large
    if (this.cache.size > config.maxSize) {
      await this.cleanup();
    }

    return new Response(JSON.stringify({
      success: true,
      key: body.key,
      version: entry.version,
      expiresAt: now + config.ttl
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async handleDelete(url: URL): Promise<Response> {
    const key = url.searchParams.get('key');
    if (!key) {
      return new Response('Missing key parameter', { status: 400 });
    }

    // Remove from memory cache
    const existed = this.cache.delete(key);
    
    // Remove from KV
    await this.env.CACHE_KV.delete(key);

    return new Response(JSON.stringify({
      success: true,
      existed
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async handleInvalidate(request: Request): Promise<Response> {
    const body = await request.json() as {
      tags?: string[];
      pattern?: string;
      all?: boolean;
    };

    let invalidatedCount = 0;

    if (body.all) {
      // Clear all cache
      this.cache.clear();
      // Note: KV doesn't support bulk delete, so we rely on TTL expiration
      invalidatedCount = this.cache.size;
    } else if (body.tags && body.tags.length > 0) {
      // Invalidate by tags
      for (const [key, entry] of this.cache.entries()) {
        if (entry.tags.some(tag => body.tags!.includes(tag))) {
          this.cache.delete(key);
          await this.env.CACHE_KV.delete(key);
          invalidatedCount++;
        }
      }
    } else if (body.pattern) {
      // Invalidate by pattern
      const regex = new RegExp(body.pattern);
      for (const [key, entry] of this.cache.entries()) {
        if (regex.test(key)) {
          this.cache.delete(key);
          await this.env.CACHE_KV.delete(key);
          invalidatedCount++;
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      invalidatedCount
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async cleanup(): Promise<void> {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());
    
    // Sort by last accessed (LRU)
    entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
    
    // Remove oldest 25% of entries
    const toRemove = Math.floor(entries.length * 0.25);
    for (let i = 0; i < toRemove; i++) {
      const [key] = entries[i];
      this.cache.delete(key);
      await this.env.CACHE_KV.delete(key);
    }
  }

  private getDefaultConfig(override?: Partial<CacheConfig>): CacheConfig {
    return {
      ttl: 300000, // 5 minutes
      maxSize: 1000,
      compressionThreshold: 1024,
      tags: [],
      ...override
    };
  }

  private generateVersion(): string {
    return `v${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

export { CacheManager };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, DELETE, PATCH, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400'
        }
      });
    }

    try {
      // Route to appropriate cache operation
      const operation = url.pathname.split('/').pop();
      
      switch (operation) {
        case 'get':
          return await handleDirectGet(request, env);
        case 'set':
          return await handleDirectSet(request, env);
        case 'delete':
          return await handleDirectDelete(request, env);
        case 'invalidate':
          return await handleDirectInvalidate(request, env);
        case 'stats':
          return await handleStats(request, env);
        default:
          // Use Durable Object for complex operations
          const durableObjectId = env.CACHE_DURABLE_OBJECT.idFromName('cache-manager');
          const durableObject = env.CACHE_DURABLE_OBJECT.get(durableObjectId);
          return await durableObject.fetch(request);
      }
    } catch (error) {
      console.error('Cache worker error:', error);
      
      return new Response(JSON.stringify({
        error: 'Cache service error',
        message: error instanceof Error ? error.message : 'Unknown error'
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

async function handleDirectGet(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const key = url.searchParams.get('key');
  
  if (!key) {
    return new Response('Missing key parameter', { status: 400 });
  }

  const cached = await env.CACHE_KV.get(key, 'json');
  
  if (!cached) {
    return new Response(JSON.stringify({
      hit: false,
      data: null
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const entry = cached as CacheEntry;
  const now = Date.now();
  
  // Check TTL
  if (now > entry.timestamp + entry.ttl) {
    await env.CACHE_KV.delete(key);
    return new Response(JSON.stringify({
      hit: false,
      data: null,
      expired: true
    }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({
    hit: true,
    data: entry.data,
    metadata: {
      age: now - entry.timestamp,
      version: entry.version
    }
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `max-age=${Math.floor((entry.timestamp + entry.ttl - now) / 1000)}`,
      'X-Cache-Hit': 'true'
    }
  });
}

async function handleDirectSet(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as {
    key: string;
    data: any;
    ttl?: number;
  };

  if (!body.key || body.data === undefined) {
    return new Response('Missing key or data', { status: 400 });
  }

  const ttl = body.ttl || 300000; // 5 minutes default
  const now = Date.now();
  
  const entry: CacheEntry = {
    data: body.data,
    timestamp: now,
    ttl,
    version: `v${now}`,
    tags: [],
    hitCount: 0,
    lastAccessed: now
  };

  await env.CACHE_KV.put(body.key, JSON.stringify(entry), {
    expirationTtl: Math.floor(ttl / 1000)
  });

  return new Response(JSON.stringify({
    success: true,
    key: body.key,
    expiresAt: now + ttl
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handleDirectDelete(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const key = url.searchParams.get('key');
  
  if (!key) {
    return new Response('Missing key parameter', { status: 400 });
  }

  await env.CACHE_KV.delete(key);

  return new Response(JSON.stringify({
    success: true
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handleDirectInvalidate(request: Request, env: Env): Promise<Response> {
  // For direct invalidation, we can only delete specific keys
  // Pattern-based invalidation requires the Durable Object
  return new Response(JSON.stringify({
    error: 'Use Durable Object endpoint for pattern-based invalidation'
  }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' }
  });
}

async function handleStats(request: Request, env: Env): Promise<Response> {
  // Basic stats - in production, you'd want more sophisticated metrics
  return new Response(JSON.stringify({
    service: 'ArbitrageX Cache Worker',
    version: '3.0.0',
    timestamp: Date.now(),
    features: [
      'KV Storage',
      'Durable Objects',
      'TTL Management',
      'Tag-based Invalidation',
      'LRU Cleanup'
    ]
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

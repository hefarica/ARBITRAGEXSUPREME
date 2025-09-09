import Redis from 'ioredis';
import pino from 'pino';
import { config } from '@/config';
import { AnvilInstance, SimulationResult, AnvilMetrics } from '@/types/simulation';

// =============================================================================
// REDIS CLIENT SERVICE
// =============================================================================

export class RedisClient {
  private client: Redis;
  private logger: pino.Logger;

  constructor(logger: pino.Logger) {
    this.logger = logger.child({ service: 'redis-client' });
    this.client = new Redis(config.redis.url, {
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    this.setupEventHandlers();
  }

  /**
   * Setup Redis event handlers
   */
  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      this.logger.info('Connected to Redis');
    });

    this.client.on('error', (error) => {
      this.logger.error({ error: error.message }, 'Redis connection error');
    });

    this.client.on('close', () => {
      this.logger.warn('Redis connection closed');
    });

    this.client.on('reconnecting', () => {
      this.logger.info('Reconnecting to Redis');
    });
  }

  /**
   * Connect to Redis
   */
  async connect(): Promise<void> {
    try {
      await this.client.connect();
      this.logger.info('Redis client connected successfully');
    } catch (error) {
      this.logger.error({ error: error.message }, 'Failed to connect to Redis');
      throw error;
    }
  }

  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    try {
      await this.client.quit();
      this.logger.info('Redis client disconnected');
    } catch (error) {
      this.logger.error({ error: error.message }, 'Error disconnecting from Redis');
    }
  }

  // =============================================================================
  // ANVIL INSTANCE CACHING
  // =============================================================================

  /**
   * Cache Anvil instance
   */
  async cacheAnvilInstance(instance: AnvilInstance): Promise<void> {
    const key = `${config.redis.key_prefix}instance:${instance.id}`;
    try {
      await this.client.setex(
        key,
        config.redis.ttl_seconds,
        JSON.stringify({
          ...instance,
          created_at: instance.created_at.toISOString(),
          last_heartbeat: instance.last_heartbeat?.toISOString(),
        })
      );
      this.logger.debug({ instance_id: instance.id }, 'Cached Anvil instance');
    } catch (error) {
      this.logger.error({
        instance_id: instance.id,
        error: error.message
      }, 'Failed to cache Anvil instance');
    }
  }

  /**
   * Get cached Anvil instance
   */
  async getCachedAnvilInstance(instanceId: string): Promise<AnvilInstance | null> {
    const key = `${config.redis.key_prefix}instance:${instanceId}`;
    try {
      const cached = await this.client.get(key);
      if (!cached) {
        return null;
      }

      const parsed = JSON.parse(cached);
      return {
        ...parsed,
        created_at: new Date(parsed.created_at),
        last_heartbeat: parsed.last_heartbeat ? new Date(parsed.last_heartbeat) : undefined,
      };
    } catch (error) {
      this.logger.error({
        instance_id: instanceId,
        error: error.message
      }, 'Failed to get cached Anvil instance');
      return null;
    }
  }

  /**
   * Remove cached Anvil instance
   */
  async removeCachedAnvilInstance(instanceId: string): Promise<void> {
    const key = `${config.redis.key_prefix}instance:${instanceId}`;
    try {
      await this.client.del(key);
      this.logger.debug({ instance_id: instanceId }, 'Removed cached Anvil instance');
    } catch (error) {
      this.logger.error({
        instance_id: instanceId,
        error: error.message
      }, 'Failed to remove cached Anvil instance');
    }
  }

  /**
   * List all cached instances
   */
  async listCachedInstances(): Promise<AnvilInstance[]> {
    const pattern = `${config.redis.key_prefix}instance:*`;
    try {
      const keys = await this.client.keys(pattern);
      const instances: AnvilInstance[] = [];

      if (keys.length > 0) {
        const values = await this.client.mget(...keys);
        for (const value of values) {
          if (value) {
            try {
              const parsed = JSON.parse(value);
              instances.push({
                ...parsed,
                created_at: new Date(parsed.created_at),
                last_heartbeat: parsed.last_heartbeat ? new Date(parsed.last_heartbeat) : undefined,
              });
            } catch (parseError) {
              this.logger.warn({ error: parseError.message }, 'Failed to parse cached instance');
            }
          }
        }
      }

      return instances;
    } catch (error) {
      this.logger.error({ error: error.message }, 'Failed to list cached instances');
      return [];
    }
  }

  // =============================================================================
  // SIMULATION RESULTS CACHING
  // =============================================================================

  /**
   * Cache simulation result
   */
  async cacheSimulationResult(result: SimulationResult): Promise<void> {
    const key = `${config.redis.key_prefix}simulation:${result.simulation_id}`;
    try {
      await this.client.setex(
        key,
        config.redis.ttl_seconds,
        JSON.stringify({
          ...result,
          created_at: result.created_at.toISOString(),
        })
      );
      this.logger.debug({ simulation_id: result.simulation_id }, 'Cached simulation result');
    } catch (error) {
      this.logger.error({
        simulation_id: result.simulation_id,
        error: error.message
      }, 'Failed to cache simulation result');
    }
  }

  /**
   * Get cached simulation result
   */
  async getCachedSimulationResult(simulationId: string): Promise<SimulationResult | null> {
    const key = `${config.redis.key_prefix}simulation:${simulationId}`;
    try {
      const cached = await this.client.get(key);
      if (!cached) {
        return null;
      }

      const parsed = JSON.parse(cached);
      return {
        ...parsed,
        created_at: new Date(parsed.created_at),
      };
    } catch (error) {
      this.logger.error({
        simulation_id: simulationId,
        error: error.message
      }, 'Failed to get cached simulation result');
      return null;
    }
  }

  // =============================================================================
  // METRICS CACHING
  // =============================================================================

  /**
   * Cache instance metrics
   */
  async cacheInstanceMetrics(metrics: AnvilMetrics): Promise<void> {
    const key = `${config.redis.key_prefix}metrics:${metrics.instance_id}`;
    try {
      await this.client.setex(
        key,
        300, // 5 minutes TTL for metrics
        JSON.stringify({
          ...metrics,
          last_updated: metrics.last_updated.toISOString(),
        })
      );
      this.logger.debug({ instance_id: metrics.instance_id }, 'Cached instance metrics');
    } catch (error) {
      this.logger.error({
        instance_id: metrics.instance_id,
        error: error.message
      }, 'Failed to cache instance metrics');
    }
  }

  /**
   * Get cached instance metrics
   */
  async getCachedInstanceMetrics(instanceId: string): Promise<AnvilMetrics | null> {
    const key = `${config.redis.key_prefix}metrics:${instanceId}`;
    try {
      const cached = await this.client.get(key);
      if (!cached) {
        return null;
      }

      const parsed = JSON.parse(cached);
      return {
        ...parsed,
        last_updated: new Date(parsed.last_updated),
      };
    } catch (error) {
      this.logger.error({
        instance_id: instanceId,
        error: error.message
      }, 'Failed to get cached instance metrics');
      return null;
    }
  }

  // =============================================================================
  // GENERAL CACHING UTILITIES
  // =============================================================================

  /**
   * Set with TTL
   */
  async setWithTTL(key: string, value: any, ttlSeconds?: number): Promise<void> {
    const fullKey = `${config.redis.key_prefix}${key}`;
    const ttl = ttlSeconds || config.redis.ttl_seconds;
    
    try {
      await this.client.setex(fullKey, ttl, JSON.stringify(value));
    } catch (error) {
      this.logger.error({ key: fullKey, error: error.message }, 'Failed to set cache value');
      throw error;
    }
  }

  /**
   * Get cached value
   */
  async get<T>(key: string): Promise<T | null> {
    const fullKey = `${config.redis.key_prefix}${key}`;
    
    try {
      const cached = await this.client.get(fullKey);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      this.logger.error({ key: fullKey, error: error.message }, 'Failed to get cache value');
      return null;
    }
  }

  /**
   * Delete cached value
   */
  async del(key: string): Promise<void> {
    const fullKey = `${config.redis.key_prefix}${key}`;
    
    try {
      await this.client.del(fullKey);
    } catch (error) {
      this.logger.error({ key: fullKey, error: error.message }, 'Failed to delete cache value');
    }
  }

  /**
   * Increment counter
   */
  async incr(key: string, ttlSeconds?: number): Promise<number> {
    const fullKey = `${config.redis.key_prefix}${key}`;
    
    try {
      const result = await this.client.incr(fullKey);
      
      if (ttlSeconds && result === 1) {
        // Set TTL only on first increment
        await this.client.expire(fullKey, ttlSeconds);
      }
      
      return result;
    } catch (error) {
      this.logger.error({ key: fullKey, error: error.message }, 'Failed to increment counter');
      throw error;
    }
  }

  /**
   * Add to set
   */
  async sadd(key: string, ...members: string[]): Promise<number> {
    const fullKey = `${config.redis.key_prefix}${key}`;
    
    try {
      return await this.client.sadd(fullKey, ...members);
    } catch (error) {
      this.logger.error({ key: fullKey, error: error.message }, 'Failed to add to set');
      throw error;
    }
  }

  /**
   * Get set members
   */
  async smembers(key: string): Promise<string[]> {
    const fullKey = `${config.redis.key_prefix}${key}`;
    
    try {
      return await this.client.smembers(fullKey);
    } catch (error) {
      this.logger.error({ key: fullKey, error: error.message }, 'Failed to get set members');
      return [];
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
    try {
      const startTime = Date.now();
      await this.client.ping();
      const latency = Date.now() - startTime;
      
      return { healthy: true, latency };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }

  /**
   * Get Redis client for advanced operations
   */
  getClient(): Redis {
    return this.client;
  }
}
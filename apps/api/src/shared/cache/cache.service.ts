// ArbitrageX Pro 2025 - Cache Service
// High-performance Redis caching layer for arbitrage data

import Redis from 'ioredis';
import { Logger } from '../monitoring/logger';

export class CacheService {
  private logger = new Logger('CacheService');
  
  constructor(private redis: Redis) {}

  // ==========================================================================
  // BASIC CACHE OPERATIONS
  // ==========================================================================

  async get<T = any>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      this.logger.error('Cache get failed', { key, error });
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<boolean> {
    try {
      const serialized = JSON.stringify(value);
      
      if (ttlSeconds) {
        await this.redis.setex(key, ttlSeconds, serialized);
      } else {
        await this.redis.set(key, serialized);
      }
      
      return true;
    } catch (error) {
      this.logger.error('Cache set failed', { key, error });
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      const result = await this.redis.del(key);
      return result > 0;
    } catch (error) {
      this.logger.error('Cache delete failed', { key, error });
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.redis.exists(key);
      return result > 0;
    } catch (error) {
      this.logger.error('Cache exists check failed', { key, error });
      return false;
    }
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    try {
      const result = await this.redis.expire(key, seconds);
      return result === 1;
    } catch (error) {
      this.logger.error('Cache expire failed', { key, seconds, error });
      return false;
    }
  }

  // ==========================================================================
  // TENANT-SPECIFIC CACHING
  // ==========================================================================

  private getTenantKey(tenantId: string, key: string): string {
    return `tenant:${tenantId}:${key}`;
  }

  async getTenantCache<T = any>(tenantId: string, key: string): Promise<T | null> {
    return this.get<T>(this.getTenantKey(tenantId, key));
  }

  async setTenantCache(tenantId: string, key: string, value: any, ttlSeconds?: number): Promise<boolean> {
    return this.set(this.getTenantKey(tenantId, key), value, ttlSeconds);
  }

  async delTenantCache(tenantId: string, key: string): Promise<boolean> {
    return this.del(this.getTenantKey(tenantId, key));
  }

  async invalidateTenantCache(tenantId: string, pattern?: string): Promise<number> {
    try {
      const searchPattern = pattern 
        ? this.getTenantKey(tenantId, pattern)
        : this.getTenantKey(tenantId, '*');
      
      const keys = await this.redis.keys(searchPattern);
      
      if (keys.length === 0) {
        return 0;
      }
      
      const result = await this.redis.del(...keys);
      this.logger.info('Invalidated tenant cache', { tenantId, pattern, keysDeleted: result });
      
      return result;
    } catch (error) {
      this.logger.error('Tenant cache invalidation failed', { tenantId, pattern, error });
      return 0;
    }
  }

  // ==========================================================================
  // ARBITRAGE-SPECIFIC CACHING
  // ==========================================================================

  async cacheArbitrageOpportunities(tenantId: string, opportunities: any[], ttlSeconds = 60): Promise<boolean> {
    const key = `arbitrage:opportunities`;
    return this.setTenantCache(tenantId, key, opportunities, ttlSeconds);
  }

  async getCachedArbitrageOpportunities(tenantId: string): Promise<any[] | null> {
    const key = `arbitrage:opportunities`;
    return this.getTenantCache<any[]>(tenantId, key);
  }

  async cacheTokenPrice(blockchain: string, tokenAddress: string, price: any, ttlSeconds = 30): Promise<boolean> {
    const key = `price:${blockchain}:${tokenAddress}`;
    return this.set(key, price, ttlSeconds);
  }

  async getCachedTokenPrice(blockchain: string, tokenAddress: string): Promise<any | null> {
    const key = `price:${blockchain}:${tokenAddress}`;
    return this.get(key);
  }

  async cacheDexLiquidity(dex: string, pair: string, liquidity: any, ttlSeconds = 60): Promise<boolean> {
    const key = `liquidity:${dex}:${pair}`;
    return this.set(key, liquidity, ttlSeconds);
  }

  async getCachedDexLiquidity(dex: string, pair: string): Promise<any | null> {
    const key = `liquidity:${dex}:${pair}`;
    return this.get(key);
  }

  // ==========================================================================
  // SESSION MANAGEMENT
  // ==========================================================================

  async setUserSession(userId: string, sessionData: any, ttlSeconds = 86400): Promise<boolean> {
    const key = `session:${userId}`;
    return this.set(key, sessionData, ttlSeconds);
  }

  async getUserSession(userId: string): Promise<any | null> {
    const key = `session:${userId}`;
    return this.get(key);
  }

  async deleteUserSession(userId: string): Promise<boolean> {
    const key = `session:${userId}`;
    return this.del(key);
  }

  async extendUserSession(userId: string, ttlSeconds = 86400): Promise<boolean> {
    const key = `session:${userId}`;
    return this.expire(key, ttlSeconds);
  }

  // ==========================================================================
  // RATE LIMITING
  // ==========================================================================

  async checkRateLimit(identifier: string, maxRequests: number, windowSeconds: number): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
  }> {
    try {
      const key = `rate_limit:${identifier}`;
      const now = Date.now();
      const window = Math.floor(now / (windowSeconds * 1000));
      const windowKey = `${key}:${window}`;

      const current = await this.redis.incr(windowKey);
      
      if (current === 1) {
        await this.redis.expire(windowKey, windowSeconds);
      }

      const remaining = Math.max(0, maxRequests - current);
      const resetTime = (window + 1) * windowSeconds * 1000;

      return {
        allowed: current <= maxRequests,
        remaining,
        resetTime,
      };
    } catch (error) {
      this.logger.error('Rate limit check failed', { identifier, error });
      // Fail open - allow request if cache is down
      return {
        allowed: true,
        remaining: maxRequests,
        resetTime: Date.now() + windowSeconds * 1000,
      };
    }
  }

  // ==========================================================================
  // LOCK MANAGEMENT (for distributed locks)
  // ==========================================================================

  async acquireLock(lockKey: string, ttlSeconds = 10, retryTimes = 3): Promise<string | null> {
    const lockValue = `lock:${Date.now()}:${Math.random()}`;
    const key = `lock:${lockKey}`;

    for (let i = 0; i < retryTimes; i++) {
      try {
        const result = await this.redis.set(key, lockValue, 'EX', ttlSeconds, 'NX');
        
        if (result === 'OK') {
          return lockValue;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)));
      } catch (error) {
        this.logger.error('Lock acquisition attempt failed', { lockKey, attempt: i + 1, error });
      }
    }

    return null;
  }

  async releaseLock(lockKey: string, lockValue: string): Promise<boolean> {
    const key = `lock:${lockKey}`;
    
    try {
      // Use Lua script to ensure atomic release
      const luaScript = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
      
      const result = await this.redis.eval(luaScript, 1, key, lockValue) as number;
      return result === 1;
    } catch (error) {
      this.logger.error('Lock release failed', { lockKey, error });
      return false;
    }
  }

  // ==========================================================================
  // PUB/SUB FOR REAL-TIME UPDATES
  // ==========================================================================

  async publishArbitrageUpdate(tenantId: string, update: any): Promise<number> {
    try {
      const channel = `arbitrage:${tenantId}`;
      const message = JSON.stringify({
        ...update,
        timestamp: new Date().toISOString(),
      });
      
      return await this.redis.publish(channel, message);
    } catch (error) {
      this.logger.error('Failed to publish arbitrage update', { tenantId, error });
      return 0;
    }
  }

  async subscribeToArbitrageUpdates(tenantId: string, callback: (message: any) => void): Promise<void> {
    const subscriber = this.redis.duplicate();
    const channel = `arbitrage:${tenantId}`;
    
    subscriber.subscribe(channel);
    
    subscriber.on('message', (receivedChannel, message) => {
      if (receivedChannel === channel) {
        try {
          const parsedMessage = JSON.parse(message);
          callback(parsedMessage);
        } catch (error) {
          this.logger.error('Failed to parse arbitrage update message', { channel, error });
        }
      }
    });
  }

  // ==========================================================================
  // CACHE STATISTICS AND MONITORING
  // ==========================================================================

  async getCacheStats(): Promise<any> {
    try {
      const info = await this.redis.info('memory');
      const keyspace = await this.redis.info('keyspace');
      
      return {
        memory: this.parseRedisInfo(info),
        keyspace: this.parseRedisInfo(keyspace),
        connected: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to get cache stats', { error });
      return {
        connected: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      };
    }
  }

  private parseRedisInfo(info: string): Record<string, any> {
    const result: Record<string, any> = {};
    
    info.split('\r\n').forEach(line => {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        result[key] = isNaN(Number(value)) ? value : Number(value);
      }
    });
    
    return result;
  }

  // ==========================================================================
  // HEALTH CHECK
  // ==========================================================================

  async healthCheck(): Promise<{ status: string; latency?: number; error?: string }> {
    const start = Date.now();
    
    try {
      await this.redis.ping();
      const latency = Date.now() - start;
      
      return {
        status: 'healthy',
        latency,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // ==========================================================================
  // CLEANUP
  // ==========================================================================

  async disconnect(): Promise<void> {
    try {
      await this.redis.disconnect();
    } catch (error) {
      this.logger.error('Failed to disconnect from Redis', { error });
    }
  }
}
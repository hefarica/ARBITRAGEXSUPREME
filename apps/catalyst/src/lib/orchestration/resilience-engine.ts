/**
 * ArbitrageX Supreme - Resilience & Orchestration Engine
 * Actividades 81-85: Sistema avanzado de orquestación resiliente
 * 
 * Implementa:
 * - Redis Retry Policies con backoff exponencial
 * - API Gateway Circuit Breakers avanzados
 * - Distributed Locks para coordinación multi-instancia
 * - Health Checks avanzados con métricas detalladas
 * - Sistema de alertas en tiempo real
 * 
 * Siguiendo metodología Ingenio Pichichi S.A. - Disciplinado y Organizado
 */

import { EventEmitter } from 'events';
import Redis from 'ioredis';

// ============================================================================
// INTERFACES Y TIPOS
// ============================================================================

export interface RetryPolicy {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
  retryableErrors: string[];
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  monitoringWindow: number;
  volumeThreshold: number;
  errorThreshold: number;
  halfOpenMaxCalls: number;
}

export interface DistributedLockConfig {
  ttl: number;
  retryDelay: number;
  retryCount: number;
  drift: number;
  unlockScript: string;
}

export interface HealthCheckConfig {
  interval: number;
  timeout: number;
  retries: number;
  criticalServices: string[];
  warningThresholds: Record<string, number>;
  errorThresholds: Record<string, number>;
}

export interface AlertConfig {
  channels: AlertChannel[];
  escalation: EscalationRule[];
  cooldown: number;
  rateLimits: Record<string, number>;
}

export interface AlertChannel {
  type: 'email' | 'slack' | 'webhook' | 'sms';
  endpoint: string;
  template: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface EscalationRule {
  condition: string;
  delay: number;
  actions: string[];
}

export interface HealthMetrics {
  service: string;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  responseTime: number;
  errorRate: number;
  throughput: number;
  timestamp: number;
  details: Record<string, any>;
}

export interface CircuitBreakerState {
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failures: number;
  successes: number;
  lastFailureTime: number;
  nextAttempt: number;
  metrics: {
    totalRequests: number;
    failedRequests: number;
    successfulRequests: number;
    averageResponseTime: number;
  };
}

// ============================================================================
// REDIS RETRY POLICY ENGINE
// ============================================================================

export class RedisRetryEngine {
  private redis: Redis;
  private policies: Map<string, RetryPolicy>;
  private metrics: Map<string, any>;

  constructor(redisConfig: any) {
    this.redis = new Redis(redisConfig);
    this.policies = new Map();
    this.metrics = new Map();
    
    // Configuraciones de retry por defecto para diferentes operaciones
    this.setupDefaultPolicies();
  }

  private setupDefaultPolicies(): void {
    // Política para operaciones críticas de arbitraje
    this.policies.set('arbitrage-critical', {
      maxAttempts: 5,
      baseDelay: 100,
      maxDelay: 5000,
      backoffMultiplier: 2,
      jitter: true,
      retryableErrors: ['TIMEOUT', 'CONNECTION_LOST', 'REDIS_ERROR']
    });

    // Política para operaciones de trading
    this.policies.set('trading-operations', {
      maxAttempts: 3,
      baseDelay: 50,
      maxDelay: 1000,
      backoffMultiplier: 1.5,
      jitter: true,
      retryableErrors: ['NETWORK_ERROR', 'RATE_LIMIT', 'TEMPORARY_FAILURE']
    });

    // Política para sync de precios
    this.policies.set('price-sync', {
      maxAttempts: 10,
      baseDelay: 200,
      maxDelay: 10000,
      backoffMultiplier: 1.8,
      jitter: true,
      retryableErrors: ['API_RATE_LIMIT', 'PROVIDER_ERROR', 'NETWORK_TIMEOUT']
    });
  }

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    policyName: string,
    context: string = 'default'
  ): Promise<T> {
    const policy = this.policies.get(policyName);
    if (!policy) {
      throw new Error(`Retry policy not found: ${policyName}`);
    }

    let lastError: Error;
    const startTime = Date.now();

    for (let attempt = 1; attempt <= policy.maxAttempts; attempt++) {
      try {
        const result = await operation();
        
        // Registrar éxito
        await this.recordSuccess(policyName, context, attempt, Date.now() - startTime);
        return result;
        
      } catch (error) {
        lastError = error as Error;
        
        // Verificar si el error es reintentable
        if (!this.isRetryableError(error as Error, policy)) {
          await this.recordFailure(policyName, context, attempt, error as Error, false);
          throw error;
        }

        // Si es el último intento, no hacer delay
        if (attempt === policy.maxAttempts) {
          await this.recordFailure(policyName, context, attempt, error as Error, false);
          break;
        }

        // Calcular delay con backoff exponencial y jitter
        const delay = this.calculateDelay(policy, attempt);
        await this.sleep(delay);
        
        await this.recordFailure(policyName, context, attempt, error as Error, true);
      }
    }

    throw lastError!;
  }

  private isRetryableError(error: Error, policy: RetryPolicy): boolean {
    const errorMessage = error.message.toUpperCase();
    return policy.retryableErrors.some(retryableError => 
      errorMessage.includes(retryableError)
    );
  }

  private calculateDelay(policy: RetryPolicy, attempt: number): number {
    let delay = policy.baseDelay * Math.pow(policy.backoffMultiplier, attempt - 1);
    delay = Math.min(delay, policy.maxDelay);
    
    if (policy.jitter) {
      // Agregar jitter del ±25%
      const jitterRange = delay * 0.25;
      delay += (Math.random() - 0.5) * 2 * jitterRange;
    }
    
    return Math.max(delay, 0);
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async recordSuccess(
    policy: string,
    context: string,
    attempts: number,
    duration: number
  ): Promise<void> {
    const key = `retry:success:${policy}:${context}`;
    const data = {
      timestamp: Date.now(),
      attempts,
      duration,
      success: true
    };
    
    await this.redis.lpush(key, JSON.stringify(data));
    await this.redis.ltrim(key, 0, 999); // Mantener últimos 1000 registros
    await this.redis.expire(key, 86400); // Expire en 24 horas
  }

  private async recordFailure(
    policy: string,
    context: string,
    attempt: number,
    error: Error,
    willRetry: boolean
  ): Promise<void> {
    const key = `retry:failure:${policy}:${context}`;
    const data = {
      timestamp: Date.now(),
      attempt,
      error: error.message,
      willRetry,
      success: false
    };
    
    await this.redis.lpush(key, JSON.stringify(data));
    await this.redis.ltrim(key, 0, 999);
    await this.redis.expire(key, 86400);
  }

  async getRetryMetrics(policy: string, context: string): Promise<any> {
    const successKey = `retry:success:${policy}:${context}`;
    const failureKey = `retry:failure:${policy}:${context}`;
    
    const [successData, failureData] = await Promise.all([
      this.redis.lrange(successKey, 0, -1),
      this.redis.lrange(failureKey, 0, -1)
    ]);

    const successes = successData.map(d => JSON.parse(d));
    const failures = failureData.map(d => JSON.parse(d));

    return {
      totalOperations: successes.length + failures.length,
      successRate: successes.length / (successes.length + failures.length) || 0,
      averageAttempts: successes.reduce((acc, s) => acc + s.attempts, 0) / successes.length || 0,
      averageDuration: successes.reduce((acc, s) => acc + s.duration, 0) / successes.length || 0,
      recentFailures: failures.filter(f => Date.now() - f.timestamp < 300000) // Últimos 5 min
    };
  }
}

// ============================================================================
// CIRCUIT BREAKER AVANZADO
// ============================================================================

export class AdvancedCircuitBreaker extends EventEmitter {
  private config: CircuitBreakerConfig;
  private state: CircuitBreakerState;
  private redis: Redis;
  private name: string;
  private metrics: any[];
  private timer?: NodeJS.Timeout;

  constructor(name: string, config: CircuitBreakerConfig, redis: Redis) {
    super();
    this.name = name;
    this.config = config;
    this.redis = redis;
    this.metrics = [];
    
    this.state = {
      state: 'CLOSED',
      failures: 0,
      successes: 0,
      lastFailureTime: 0,
      nextAttempt: 0,
      metrics: {
        totalRequests: 0,
        failedRequests: 0,
        successfulRequests: 0,
        averageResponseTime: 0
      }
    };

    this.startMetricsCollection();
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // Verificar si el circuit breaker permite la operación
    if (!this.canExecute()) {
      throw new Error(`Circuit breaker ${this.name} is OPEN`);
    }

    const startTime = Date.now();
    
    try {
      const result = await operation();
      await this.onSuccess(Date.now() - startTime);
      return result;
    } catch (error) {
      await this.onFailure(Date.now() - startTime, error as Error);
      throw error;
    }
  }

  private canExecute(): boolean {
    if (this.state.state === 'CLOSED') {
      return true;
    }
    
    if (this.state.state === 'OPEN') {
      if (Date.now() >= this.state.nextAttempt) {
        this.state.state = 'HALF_OPEN';
        this.state.successes = 0;
        this.emit('stateChanged', 'HALF_OPEN');
        return true;
      }
      return false;
    }
    
    // HALF_OPEN state
    return this.state.successes < this.config.halfOpenMaxCalls;
  }

  private async onSuccess(responseTime: number): Promise<void> {
    this.state.successes++;
    this.state.metrics.totalRequests++;
    this.state.metrics.successfulRequests++;
    this.updateAverageResponseTime(responseTime);

    await this.recordMetric(true, responseTime);

    if (this.state.state === 'HALF_OPEN' && 
        this.state.successes >= this.config.halfOpenMaxCalls) {
      this.reset();
    }
  }

  private async onFailure(responseTime: number, error: Error): Promise<void> {
    this.state.failures++;
    this.state.metrics.totalRequests++;
    this.state.metrics.failedRequests++;
    this.state.lastFailureTime = Date.now();
    this.updateAverageResponseTime(responseTime);

    await this.recordMetric(false, responseTime, error);

    if (this.state.state === 'HALF_OPEN') {
      this.open();
    } else if (this.shouldTrip()) {
      this.open();
    }
  }

  private shouldTrip(): boolean {
    if (this.state.metrics.totalRequests < this.config.volumeThreshold) {
      return false;
    }

    const errorRate = this.state.metrics.failedRequests / this.state.metrics.totalRequests;
    return errorRate >= this.config.errorThreshold;
  }

  private open(): void {
    this.state.state = 'OPEN';
    this.state.nextAttempt = Date.now() + this.config.resetTimeout;
    this.emit('stateChanged', 'OPEN');
    this.emit('circuitOpened', {
      name: this.name,
      failures: this.state.failures,
      errorRate: this.state.metrics.failedRequests / this.state.metrics.totalRequests
    });
  }

  private reset(): void {
    this.state.state = 'CLOSED';
    this.state.failures = 0;
    this.state.successes = 0;
    this.state.metrics = {
      totalRequests: 0,
      failedRequests: 0,
      successfulRequests: 0,
      averageResponseTime: 0
    };
    this.emit('stateChanged', 'CLOSED');
    this.emit('circuitReset', { name: this.name });
  }

  private updateAverageResponseTime(responseTime: number): void {
    const total = this.state.metrics.totalRequests;
    const current = this.state.metrics.averageResponseTime;
    this.state.metrics.averageResponseTime = 
      ((current * (total - 1)) + responseTime) / total;
  }

  private async recordMetric(
    success: boolean, 
    responseTime: number, 
    error?: Error
  ): Promise<void> {
    const metric = {
      timestamp: Date.now(),
      success,
      responseTime,
      error: error?.message,
      circuitState: this.state.state
    };

    const key = `circuit:metrics:${this.name}`;
    await this.redis.lpush(key, JSON.stringify(metric));
    await this.redis.ltrim(key, 0, 9999); // Últimas 10k métricas
    await this.redis.expire(key, 86400);
  }

  private startMetricsCollection(): void {
    this.timer = setInterval(async () => {
      const now = Date.now();
      const windowStart = now - this.config.monitoringWindow;

      // Limpiar métricas antiguas
      this.metrics = this.metrics.filter(m => m.timestamp >= windowStart);

      // Calcular métricas actuales
      const windowMetrics = await this.getWindowMetrics(windowStart);
      
      // Actualizar estado basado en ventana deslizante
      if (windowMetrics.totalRequests >= this.config.volumeThreshold) {
        const errorRate = windowMetrics.failedRequests / windowMetrics.totalRequests;
        
        if (this.state.state === 'CLOSED' && errorRate >= this.config.errorThreshold) {
          this.open();
        }
      }
    }, 5000); // Revisar cada 5 segundos
  }

  private async getWindowMetrics(windowStart: number): Promise<any> {
    const key = `circuit:metrics:${this.name}`;
    const metricsData = await this.redis.lrange(key, 0, -1);
    
    const windowMetrics = metricsData
      .map(d => JSON.parse(d))
      .filter(m => m.timestamp >= windowStart);

    return {
      totalRequests: windowMetrics.length,
      failedRequests: windowMetrics.filter(m => !m.success).length,
      successfulRequests: windowMetrics.filter(m => m.success).length,
      averageResponseTime: windowMetrics.reduce((acc, m) => acc + m.responseTime, 0) / windowMetrics.length || 0
    };
  }

  getState(): CircuitBreakerState {
    return { ...this.state };
  }

  async getDetailedMetrics(): Promise<any> {
    const key = `circuit:metrics:${this.name}`;
    const metricsData = await this.redis.lrange(key, 0, 999);
    
    const metrics = metricsData.map(d => JSON.parse(d));
    const now = Date.now();
    
    return {
      state: this.state,
      recentMetrics: metrics.filter(m => now - m.timestamp < 300000), // Últimos 5 min
      hourlyMetrics: metrics.filter(m => now - m.timestamp < 3600000), // Última hora
      errorDistribution: this.calculateErrorDistribution(metrics),
      responseTimePercentiles: this.calculatePercentiles(metrics)
    };
  }

  private calculateErrorDistribution(metrics: any[]): Record<string, number> {
    const errors: Record<string, number> = {};
    
    metrics
      .filter(m => !m.success && m.error)
      .forEach(m => {
        errors[m.error] = (errors[m.error] || 0) + 1;
      });
    
    return errors;
  }

  private calculatePercentiles(metrics: any[]): Record<string, number> {
    const responseTimes = metrics
      .filter(m => m.success)
      .map(m => m.responseTime)
      .sort((a, b) => a - b);

    if (responseTimes.length === 0) return {};

    return {
      p50: this.percentile(responseTimes, 50),
      p90: this.percentile(responseTimes, 90),
      p95: this.percentile(responseTimes, 95),
      p99: this.percentile(responseTimes, 99)
    };
  }

  private percentile(sortedArray: number[], percentile: number): number {
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[index] || 0;
  }

  destroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.removeAllListeners();
  }
}

// ============================================================================
// DISTRIBUTED LOCK SYSTEM
// ============================================================================

export class DistributedLockSystem {
  private redis: Redis;
  private locks: Map<string, any>;
  private config: DistributedLockConfig;

  constructor(redis: Redis, config?: Partial<DistributedLockConfig>) {
    this.redis = redis;
    this.locks = new Map();
    
    this.config = {
      ttl: 30000, // 30 segundos por defecto
      retryDelay: 100,
      retryCount: 10,
      drift: 0.01, // 1% drift
      unlockScript: `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `,
      ...config
    };
  }

  async acquireLock(
    resource: string, 
    ttl?: number,
    retryCount?: number
  ): Promise<DistributedLock> {
    const lockTtl = ttl || this.config.ttl;
    const maxRetries = retryCount || this.config.retryCount;
    const token = this.generateToken();
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const acquired = await this.attemptLock(resource, token, lockTtl);
      
      if (acquired) {
        const lock = new DistributedLock(
          resource, 
          token, 
          lockTtl, 
          this, 
          Date.now()
        );
        
        this.locks.set(resource, lock);
        return lock;
      }
      
      // Esperar antes del siguiente intento
      await this.sleep(this.config.retryDelay * (attempt + 1));
    }
    
    throw new Error(`Failed to acquire lock for resource: ${resource}`);
  }

  private async attemptLock(
    resource: string, 
    token: string, 
    ttl: number
  ): Promise<boolean> {
    const key = `lock:${resource}`;
    
    // Usar SET con NX (only if not exists) y PX (expire in milliseconds)
    const result = await this.redis.set(key, token, 'PX', ttl, 'NX');
    return result === 'OK';
  }

  async releaseLock(resource: string, token: string): Promise<boolean> {
    const key = `lock:${resource}`;
    
    // Usar script Lua para liberación atómica
    const result = await this.redis.eval(
      this.config.unlockScript,
      1,
      key,
      token
    ) as number;
    
    if (result === 1) {
      this.locks.delete(resource);
      return true;
    }
    
    return false;
  }

  async extendLock(
    resource: string, 
    token: string, 
    additionalTtl: number
  ): Promise<boolean> {
    const key = `lock:${resource}`;
    
    // Script para extender lock solo si el token coincide
    const extendScript = `
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("pexpire", KEYS[1], ARGV[2])
      else
        return 0
      end
    `;
    
    const result = await this.redis.eval(
      extendScript,
      1,
      key,
      token,
      additionalTtl.toString()
    ) as number;
    
    return result === 1;
  }

  async isLocked(resource: string): Promise<boolean> {
    const key = `lock:${resource}`;
    const exists = await this.redis.exists(key);
    return exists === 1;
  }

  async getLockInfo(resource: string): Promise<any> {
    const key = `lock:${resource}`;
    const [token, ttl] = await Promise.all([
      this.redis.get(key),
      this.redis.pttl(key)
    ]);
    
    return {
      resource,
      token,
      ttl,
      isLocked: token !== null,
      expiresAt: ttl > 0 ? Date.now() + ttl : null
    };
  }

  async getAllLocks(): Promise<any[]> {
    const pattern = 'lock:*';
    const keys = await this.redis.keys(pattern);
    
    const locks = await Promise.all(
      keys.map(async (key) => {
        const resource = key.replace('lock:', '');
        return this.getLockInfo(resource);
      })
    );
    
    return locks.filter(lock => lock.isLocked);
  }

  private generateToken(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2)}`;
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export class DistributedLock {
  private resource: string;
  private token: string;
  private ttl: number;
  private lockSystem: DistributedLockSystem;
  private acquiredAt: number;
  private autoRenewTimer?: NodeJS.Timeout;

  constructor(
    resource: string,
    token: string,
    ttl: number,
    lockSystem: DistributedLockSystem,
    acquiredAt: number
  ) {
    this.resource = resource;
    this.token = token;
    this.ttl = ttl;
    this.lockSystem = lockSystem;
    this.acquiredAt = acquiredAt;
  }

  async release(): Promise<boolean> {
    if (this.autoRenewTimer) {
      clearInterval(this.autoRenewTimer);
    }
    
    return this.lockSystem.releaseLock(this.resource, this.token);
  }

  async extend(additionalTtl: number): Promise<boolean> {
    return this.lockSystem.extendLock(this.resource, this.token, additionalTtl);
  }

  startAutoRenewal(renewInterval: number = this.ttl / 2): void {
    this.autoRenewTimer = setInterval(async () => {
      try {
        await this.extend(this.ttl);
      } catch (error) {
        console.error(`Failed to renew lock ${this.resource}:`, error);
      }
    }, renewInterval);
  }

  getInfo(): any {
    return {
      resource: this.resource,
      token: this.token,
      ttl: this.ttl,
      acquiredAt: this.acquiredAt,
      age: Date.now() - this.acquiredAt
    };
  }
}

// ============================================================================
// HEALTH CHECK SYSTEM AVANZADO
// ============================================================================

export class AdvancedHealthCheckSystem extends EventEmitter {
  private config: HealthCheckConfig;
  private redis: Redis;
  private services: Map<string, ServiceHealthChecker>;
  private overallStatus: 'healthy' | 'warning' | 'critical' | 'unknown';
  private metrics: HealthMetrics[];
  private checkTimer?: NodeJS.Timeout;

  constructor(config: HealthCheckConfig, redis: Redis) {
    super();
    this.config = config;
    this.redis = redis;
    this.services = new Map();
    this.overallStatus = 'unknown';
    this.metrics = [];
    
    this.startHealthChecks();
  }

  registerService(
    name: string, 
    checker: () => Promise<Partial<HealthMetrics>>
  ): void {
    const serviceChecker = new ServiceHealthChecker(name, checker, this.config);
    this.services.set(name, serviceChecker);
    
    serviceChecker.on('statusChanged', (metrics) => {
      this.handleServiceStatusChange(name, metrics);
    });
  }

  private async startHealthChecks(): Promise<void> {
    this.checkTimer = setInterval(async () => {
      await this.performHealthChecks();
    }, this.config.interval);
    
    // Realizar check inicial
    await this.performHealthChecks();
  }

  private async performHealthChecks(): Promise<void> {
    const checkPromises = Array.from(this.services.entries()).map(
      async ([name, checker]) => {
        try {
          return await checker.performCheck();
        } catch (error) {
          console.error(`Health check failed for ${name}:`, error);
          return {
            service: name,
            status: 'critical' as const,
            responseTime: this.config.timeout,
            errorRate: 1,
            throughput: 0,
            timestamp: Date.now(),
            details: { error: (error as Error).message }
          };
        }
      }
    );

    const results = await Promise.all(checkPromises);
    this.metrics = results;

    // Calcular estado general
    const newOverallStatus = this.calculateOverallStatus(results);
    
    if (newOverallStatus !== this.overallStatus) {
      const previousStatus = this.overallStatus;
      this.overallStatus = newOverallStatus;
      
      this.emit('overallStatusChanged', {
        from: previousStatus,
        to: newOverallStatus,
        timestamp: Date.now()
      });
    }

    // Guardar métricas en Redis
    await this.storeMetrics(results);
  }

  private calculateOverallStatus(
    metrics: HealthMetrics[]
  ): 'healthy' | 'warning' | 'critical' | 'unknown' {
    if (metrics.length === 0) return 'unknown';

    const criticalServices = metrics.filter(m => 
      this.config.criticalServices.includes(m.service)
    );

    // Si hay servicios críticos en estado crítico, el sistema es crítico
    if (criticalServices.some(m => m.status === 'critical')) {
      return 'critical';
    }

    // Si hay algún servicio en estado crítico
    if (metrics.some(m => m.status === 'critical')) {
      return 'critical';
    }

    // Si hay servicios críticos en warning
    if (criticalServices.some(m => m.status === 'warning')) {
      return 'warning';
    }

    // Si hay algún servicio en warning
    if (metrics.some(m => m.status === 'warning')) {
      return 'warning';
    }

    // Si todos los servicios críticos están healthy
    if (criticalServices.every(m => m.status === 'healthy')) {
      return 'healthy';
    }

    return 'unknown';
  }

  private async handleServiceStatusChange(
    serviceName: string, 
    metrics: HealthMetrics
  ): Promise<void> {
    this.emit('serviceStatusChanged', {
      service: serviceName,
      metrics,
      timestamp: Date.now()
    });

    // Alertas específicas por servicio
    if (metrics.status === 'critical') {
      this.emit('serviceCritical', {
        service: serviceName,
        metrics,
        timestamp: Date.now()
      });
    }
  }

  private async storeMetrics(metrics: HealthMetrics[]): Promise<void> {
    const timestamp = Date.now();
    
    for (const metric of metrics) {
      const key = `health:${metric.service}`;
      const data = { ...metric, timestamp };
      
      await this.redis.lpush(key, JSON.stringify(data));
      await this.redis.ltrim(key, 0, 999); // Últimas 1000 métricas
      await this.redis.expire(key, 86400); // 24 horas
    }

    // Guardar estado general
    const overallKey = 'health:overall';
    const overallData = {
      status: this.overallStatus,
      timestamp,
      serviceCount: metrics.length,
      healthyServices: metrics.filter(m => m.status === 'healthy').length,
      warningServices: metrics.filter(m => m.status === 'warning').length,
      criticalServices: metrics.filter(m => m.status === 'critical').length
    };
    
    await this.redis.lpush(overallKey, JSON.stringify(overallData));
    await this.redis.ltrim(overallKey, 0, 999);
    await this.redis.expire(overallKey, 86400);
  }

  async getHealthReport(): Promise<any> {
    return {
      overallStatus: this.overallStatus,
      timestamp: Date.now(),
      services: this.metrics,
      summary: {
        total: this.metrics.length,
        healthy: this.metrics.filter(m => m.status === 'healthy').length,
        warning: this.metrics.filter(m => m.status === 'warning').length,
        critical: this.metrics.filter(m => m.status === 'critical').length,
        averageResponseTime: this.metrics.reduce((acc, m) => acc + m.responseTime, 0) / this.metrics.length || 0
      }
    };
  }

  async getServiceHistory(
    serviceName: string, 
    hours: number = 24
  ): Promise<HealthMetrics[]> {
    const key = `health:${serviceName}`;
    const data = await this.redis.lrange(key, 0, -1);
    
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    
    return data
      .map(d => JSON.parse(d))
      .filter(m => m.timestamp >= cutoff)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  destroy(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
    }
    
    this.services.forEach(service => service.destroy());
    this.removeAllListeners();
  }
}

class ServiceHealthChecker extends EventEmitter {
  private name: string;
  private checker: () => Promise<Partial<HealthMetrics>>;
  private config: HealthCheckConfig;
  private lastStatus: 'healthy' | 'warning' | 'critical' | 'unknown';
  private consecutiveFailures: number;

  constructor(
    name: string,
    checker: () => Promise<Partial<HealthMetrics>>,
    config: HealthCheckConfig
  ) {
    super();
    this.name = name;
    this.checker = checker;
    this.config = config;
    this.lastStatus = 'unknown';
    this.consecutiveFailures = 0;
  }

  async performCheck(): Promise<HealthMetrics> {
    const startTime = Date.now();
    let attempt = 0;
    let lastError: Error | undefined;

    // Reintentar según configuración
    while (attempt < this.config.retries) {
      try {
        const result = await Promise.race([
          this.checker(),
          this.timeoutPromise()
        ]);

        const responseTime = Date.now() - startTime;
        const metrics: HealthMetrics = {
          service: this.name,
          status: this.determineStatus(result, responseTime),
          responseTime,
          errorRate: 0,
          throughput: 0,
          timestamp: Date.now(),
          details: {},
          ...result
        };

        this.consecutiveFailures = 0;
        
        if (metrics.status !== this.lastStatus) {
          this.lastStatus = metrics.status;
          this.emit('statusChanged', metrics);
        }

        return metrics;

      } catch (error) {
        lastError = error as Error;
        attempt++;
        
        if (attempt < this.config.retries) {
          await this.sleep(1000); // Esperar 1 segundo entre reintentos
        }
      }
    }

    // Si llegamos aquí, todos los intentos fallaron
    this.consecutiveFailures++;
    const responseTime = Date.now() - startTime;
    
    const metrics: HealthMetrics = {
      service: this.name,
      status: 'critical',
      responseTime,
      errorRate: 1,
      throughput: 0,
      timestamp: Date.now(),
      details: { 
        error: lastError?.message || 'Unknown error',
        consecutiveFailures: this.consecutiveFailures,
        attempts: attempt
      }
    };

    if (metrics.status !== this.lastStatus) {
      this.lastStatus = metrics.status;
      this.emit('statusChanged', metrics);
    }

    return metrics;
  }

  private async timeoutPromise(): Promise<never> {
    await new Promise(resolve => setTimeout(resolve, this.config.timeout));
    throw new Error('Health check timeout');
  }

  private determineStatus(
    result: Partial<HealthMetrics>, 
    responseTime: number
  ): 'healthy' | 'warning' | 'critical' {
    // Si el resultado ya incluye un status, usarlo
    if (result.status) {
      return result.status;
    }

    // Verificar thresholds de tiempo de respuesta
    const warningThreshold = this.config.warningThresholds[this.name] || 1000;
    const errorThreshold = this.config.errorThresholds[this.name] || 5000;

    if (responseTime > errorThreshold) {
      return 'critical';
    }
    
    if (responseTime > warningThreshold) {
      return 'warning';
    }

    // Verificar error rate si está disponible
    if (result.errorRate !== undefined) {
      if (result.errorRate > 0.1) { // > 10% error rate
        return 'critical';
      }
      if (result.errorRate > 0.05) { // > 5% error rate
        return 'warning';
      }
    }

    return 'healthy';
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  destroy(): void {
    this.removeAllListeners();
  }
}

// ============================================================================
// ALERT SYSTEM EN TIEMPO REAL
// ============================================================================

export class RealTimeAlertSystem extends EventEmitter {
  private config: AlertConfig;
  private redis: Redis;
  private channels: Map<string, AlertChannel>;
  private rateLimits: Map<string, number>;
  private escalationTimers: Map<string, NodeJS.Timeout>;
  private alertHistory: Map<string, any[]>;

  constructor(config: AlertConfig, redis: Redis) {
    super();
    this.config = config;
    this.redis = redis;
    this.channels = new Map();
    this.rateLimits = new Map();
    this.escalationTimers = new Map();
    this.alertHistory = new Map();

    this.setupChannels();
    this.startRateLimitReset();
  }

  private setupChannels(): void {
    this.config.channels.forEach(channel => {
      this.channels.set(channel.type, channel);
    });
  }

  async sendAlert(
    alertId: string,
    message: string,
    priority: 'low' | 'medium' | 'high' | 'critical',
    data?: any
  ): Promise<void> {
    // Verificar rate limiting
    if (this.isRateLimited(alertId, priority)) {
      console.warn(`Alert ${alertId} rate limited`);
      return;
    }

    // Crear objeto de alerta
    const alert = {
      id: alertId,
      message,
      priority,
      timestamp: Date.now(),
      data: data || {},
      channels: []
    };

    // Determinar canales basado en prioridad
    const targetChannels = this.getChannelsForPriority(priority);

    // Enviar a cada canal
    const sendPromises = targetChannels.map(async (channel) => {
      try {
        await this.sendToChannel(channel, alert);
        alert.channels.push(channel.type);
      } catch (error) {
        console.error(`Failed to send alert to ${channel.type}:`, error);
      }
    });

    await Promise.all(sendPromises);

    // Registrar en historial
    await this.recordAlert(alert);

    // Configurar escalación si es necesario
    if (priority === 'critical' || priority === 'high') {
      this.setupEscalation(alertId, alert);
    }

    // Actualizar rate limiting
    this.updateRateLimit(alertId, priority);

    this.emit('alertSent', alert);
  }

  private isRateLimited(alertId: string, priority: string): boolean {
    const key = `${alertId}:${priority}`;
    const limit = this.config.rateLimits[priority] || 10;
    const current = this.rateLimits.get(key) || 0;
    
    return current >= limit;
  }

  private updateRateLimit(alertId: string, priority: string): void {
    const key = `${alertId}:${priority}`;
    const current = this.rateLimits.get(key) || 0;
    this.rateLimits.set(key, current + 1);
  }

  private getChannelsForPriority(
    priority: 'low' | 'medium' | 'high' | 'critical'
  ): AlertChannel[] {
    return this.config.channels.filter(channel => {
      const priorities = ['low', 'medium', 'high', 'critical'];
      const channelPriorityIndex = priorities.indexOf(channel.priority);
      const alertPriorityIndex = priorities.indexOf(priority);
      
      return channelPriorityIndex <= alertPriorityIndex;
    });
  }

  private async sendToChannel(channel: AlertChannel, alert: any): Promise<void> {
    const formattedMessage = this.formatMessage(channel, alert);

    switch (channel.type) {
      case 'email':
        await this.sendEmail(channel, formattedMessage, alert);
        break;
      case 'slack':
        await this.sendSlack(channel, formattedMessage, alert);
        break;
      case 'webhook':
        await this.sendWebhook(channel, formattedMessage, alert);
        break;
      case 'sms':
        await this.sendSMS(channel, formattedMessage, alert);
        break;
      default:
        throw new Error(`Unknown channel type: ${channel.type}`);
    }
  }

  private formatMessage(channel: AlertChannel, alert: any): string {
    // Usar template personalizado o formato por defecto
    if (channel.template) {
      return this.processTemplate(channel.template, alert);
    }

    return `[${alert.priority.toUpperCase()}] ${alert.message}\n` +
           `Time: ${new Date(alert.timestamp).toISOString()}\n` +
           `Alert ID: ${alert.id}`;
  }

  private processTemplate(template: string, alert: any): string {
    return template
      .replace(/{{id}}/g, alert.id)
      .replace(/{{message}}/g, alert.message)
      .replace(/{{priority}}/g, alert.priority)
      .replace(/{{timestamp}}/g, new Date(alert.timestamp).toISOString())
      .replace(/{{data\.([\w.]+)}}/g, (match, path) => {
        return this.getNestedValue(alert.data, path) || '';
      });
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private async sendEmail(
    channel: AlertChannel, 
    message: string, 
    alert: any
  ): Promise<void> {
    // Implementación de email (simulada para este ejemplo)
    console.log(`EMAIL ALERT to ${channel.endpoint}:`, message);
    
    // En implementación real, usar servicio como SendGrid, SES, etc.
    const emailData = {
      to: channel.endpoint,
      subject: `[ArbitrageX] ${alert.priority.toUpperCase()} Alert: ${alert.id}`,
      body: message,
      timestamp: Date.now()
    };

    await this.redis.lpush('alerts:email:sent', JSON.stringify(emailData));
  }

  private async sendSlack(
    channel: AlertChannel, 
    message: string, 
    alert: any
  ): Promise<void> {
    // Implementación de Slack webhook
    console.log(`SLACK ALERT to ${channel.endpoint}:`, message);

    const slackPayload = {
      text: message,
      attachments: [{
        color: this.getSlackColor(alert.priority),
        fields: [
          { title: 'Alert ID', value: alert.id, short: true },
          { title: 'Priority', value: alert.priority, short: true },
          { title: 'Time', value: new Date(alert.timestamp).toISOString(), short: false }
        ]
      }]
    };

    // En implementación real, hacer HTTP POST al webhook de Slack
    await this.redis.lpush('alerts:slack:sent', JSON.stringify({
      endpoint: channel.endpoint,
      payload: slackPayload,
      timestamp: Date.now()
    }));
  }

  private async sendWebhook(
    channel: AlertChannel, 
    message: string, 
    alert: any
  ): Promise<void> {
    console.log(`WEBHOOK ALERT to ${channel.endpoint}:`, message);

    const webhookPayload = {
      alert: alert,
      message: message,
      timestamp: Date.now()
    };

    // En implementación real, hacer HTTP POST al endpoint
    await this.redis.lpush('alerts:webhook:sent', JSON.stringify({
      endpoint: channel.endpoint,
      payload: webhookPayload,
      timestamp: Date.now()
    }));
  }

  private async sendSMS(
    channel: AlertChannel, 
    message: string, 
    alert: any
  ): Promise<void> {
    // Implementación de SMS (simulada)
    console.log(`SMS ALERT to ${channel.endpoint}:`, message);

    const smsData = {
      to: channel.endpoint,
      message: message.substring(0, 160), // Limitar a 160 caracteres
      timestamp: Date.now()
    };

    await this.redis.lpush('alerts:sms:sent', JSON.stringify(smsData));
  }

  private getSlackColor(priority: string): string {
    switch (priority) {
      case 'critical': return 'danger';
      case 'high': return 'warning';
      case 'medium': return 'good';
      case 'low': return '#36a64f';
      default: return '#36a64f';
    }
  }

  private setupEscalation(alertId: string, alert: any): void {
    // Limpiar escalación existente
    const existingTimer = this.escalationTimers.get(alertId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Configurar nueva escalación
    this.config.escalation.forEach((rule, index) => {
      const timer = setTimeout(async () => {
        await this.executeEscalationRule(alertId, alert, rule);
      }, rule.delay);

      this.escalationTimers.set(`${alertId}:${index}`, timer);
    });
  }

  private async executeEscalationRule(
    alertId: string, 
    alert: any, 
    rule: EscalationRule
  ): Promise<void> {
    console.log(`Executing escalation rule for ${alertId}:`, rule);

    // Verificar condición (en implementación real, evaluar la condición)
    const shouldEscalate = await this.evaluateEscalationCondition(rule.condition, alert);

    if (shouldEscalate) {
      for (const action of rule.actions) {
        await this.executeEscalationAction(action, alert);
      }
    }
  }

  private async evaluateEscalationCondition(
    condition: string, 
    alert: any
  ): Promise<boolean> {
    // Implementación simple - en producción usar un evaluador más robusto
    switch (condition) {
      case 'not_resolved':
        return true; // Siempre escalar si no está resuelto
      case 'critical_service':
        return alert.data?.service === 'critical';
      default:
        return false;
    }
  }

  private async executeEscalationAction(action: string, alert: any): Promise<void> {
    switch (action) {
      case 'notify_oncall':
        await this.sendAlert(
          `${alert.id}:escalated`, 
          `ESCALATED: ${alert.message}`, 
          'critical',
          { ...alert.data, escalated: true }
        );
        break;
      case 'create_incident':
        console.log(`Creating incident for alert ${alert.id}`);
        break;
      default:
        console.warn(`Unknown escalation action: ${action}`);
    }
  }

  private async recordAlert(alert: any): Promise<void> {
    // Guardar en Redis para auditoría
    await this.redis.lpush('alerts:history', JSON.stringify(alert));
    await this.redis.ltrim('alerts:history', 0, 9999);
    await this.redis.expire('alerts:history', 604800); // 7 días

    // Actualizar historial en memoria
    const history = this.alertHistory.get(alert.id) || [];
    history.push(alert);
    this.alertHistory.set(alert.id, history.slice(-100)); // Últimas 100
  }

  private startRateLimitReset(): void {
    // Reset rate limits cada hora
    setInterval(() => {
      this.rateLimits.clear();
    }, 3600000);
  }

  async getAlertHistory(alertId?: string, hours: number = 24): Promise<any[]> {
    const key = 'alerts:history';
    const data = await this.redis.lrange(key, 0, -1);
    
    const cutoff = Date.now() - (hours * 60 * 60 * 1000);
    
    let alerts = data
      .map(d => JSON.parse(d))
      .filter(alert => alert.timestamp >= cutoff);

    if (alertId) {
      alerts = alerts.filter(alert => alert.id === alertId);
    }

    return alerts.sort((a, b) => b.timestamp - a.timestamp);
  }

  async getAlertStats(hours: number = 24): Promise<any> {
    const alerts = await this.getAlertHistory(undefined, hours);

    const stats = {
      total: alerts.length,
      byPriority: {
        critical: alerts.filter(a => a.priority === 'critical').length,
        high: alerts.filter(a => a.priority === 'high').length,
        medium: alerts.filter(a => a.priority === 'medium').length,
        low: alerts.filter(a => a.priority === 'low').length
      },
      byChannel: {} as Record<string, number>,
      timeline: this.generateTimeline(alerts, hours)
    };

    // Contar por canal
    alerts.forEach(alert => {
      alert.channels.forEach((channel: string) => {
        stats.byChannel[channel] = (stats.byChannel[channel] || 0) + 1;
      });
    });

    return stats;
  }

  private generateTimeline(alerts: any[], hours: number): any[] {
    const buckets = 12; // 12 períodos
    const bucketSize = (hours * 60 * 60 * 1000) / buckets;
    const now = Date.now();
    
    const timeline = [];
    
    for (let i = 0; i < buckets; i++) {
      const bucketEnd = now - (i * bucketSize);
      const bucketStart = bucketEnd - bucketSize;
      
      const bucketAlerts = alerts.filter(alert => 
        alert.timestamp >= bucketStart && alert.timestamp < bucketEnd
      );

      timeline.unshift({
        start: bucketStart,
        end: bucketEnd,
        count: bucketAlerts.length,
        critical: bucketAlerts.filter(a => a.priority === 'critical').length
      });
    }

    return timeline;
  }

  destroy(): void {
    // Limpiar timers de escalación
    this.escalationTimers.forEach(timer => clearTimeout(timer));
    this.escalationTimers.clear();
    
    this.removeAllListeners();
  }
}

// ============================================================================
// MAIN RESILIENCE ENGINE
// ============================================================================

export class ResilienceEngine extends EventEmitter {
  private redis: Redis;
  private retryEngine: RedisRetryEngine;
  private circuitBreakers: Map<string, AdvancedCircuitBreaker>;
  private lockSystem: DistributedLockSystem;
  private healthSystem: AdvancedHealthCheckSystem;
  private alertSystem: RealTimeAlertSystem;
  private isInitialized: boolean = false;

  constructor(redisConfig: any) {
    super();
    
    this.redis = new Redis(redisConfig);
    this.circuitBreakers = new Map();
    this.isInitialized = false;
  }

  async initialize(config: {
    retryPolicies?: Record<string, RetryPolicy>;
    circuitBreakers?: Record<string, CircuitBreakerConfig>;
    lockConfig?: Partial<DistributedLockConfig>;
    healthConfig?: HealthCheckConfig;
    alertConfig?: AlertConfig;
  }): Promise<void> {
    try {
      // Inicializar componentes
      this.retryEngine = new RedisRetryEngine(this.redis);
      this.lockSystem = new DistributedLockSystem(this.redis, config.lockConfig);
      
      if (config.healthConfig) {
        this.healthSystem = new AdvancedHealthCheckSystem(config.healthConfig, this.redis);
        this.setupHealthSystemEvents();
      }

      if (config.alertConfig) {
        this.alertSystem = new RealTimeAlertSystem(config.alertConfig, this.redis);
      }

      // Configurar circuit breakers
      if (config.circuitBreakers) {
        for (const [name, cbConfig] of Object.entries(config.circuitBreakers)) {
          const cb = new AdvancedCircuitBreaker(name, cbConfig, this.redis);
          this.circuitBreakers.set(name, cb);
          this.setupCircuitBreakerEvents(name, cb);
        }
      }

      // Configurar políticas de retry personalizadas
      if (config.retryPolicies) {
        for (const [name, policy] of Object.entries(config.retryPolicies)) {
          this.retryEngine['policies'].set(name, policy);
        }
      }

      this.isInitialized = true;
      this.emit('initialized');
      
    } catch (error) {
      this.emit('initializationError', error);
      throw error;
    }
  }

  private setupHealthSystemEvents(): void {
    this.healthSystem.on('overallStatusChanged', (event) => {
      this.emit('systemHealthChanged', event);
      
      if (this.alertSystem) {
        this.alertSystem.sendAlert(
          'system-health-change',
          `System health changed from ${event.from} to ${event.to}`,
          event.to === 'critical' ? 'critical' : 'high',
          event
        );
      }
    });

    this.healthSystem.on('serviceCritical', (event) => {
      if (this.alertSystem) {
        this.alertSystem.sendAlert(
          `service-critical-${event.service}`,
          `Service ${event.service} is in critical state`,
          'critical',
          event
        );
      }
    });
  }

  private setupCircuitBreakerEvents(name: string, cb: AdvancedCircuitBreaker): void {
    cb.on('circuitOpened', (event) => {
      this.emit('circuitBreakerOpened', { name, ...event });
      
      if (this.alertSystem) {
        this.alertSystem.sendAlert(
          `circuit-breaker-open-${name}`,
          `Circuit breaker ${name} opened due to failures`,
          'high',
          event
        );
      }
    });

    cb.on('circuitReset', (event) => {
      this.emit('circuitBreakerReset', { name, ...event });
      
      if (this.alertSystem) {
        this.alertSystem.sendAlert(
          `circuit-breaker-reset-${name}`,
          `Circuit breaker ${name} reset to closed state`,
          'medium',
          event
        );
      }
    });
  }

  // Métodos de acceso directo a componentes
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    policyName: string,
    context?: string
  ): Promise<T> {
    this.ensureInitialized();
    return this.retryEngine.executeWithRetry(operation, policyName, context);
  }

  async executeWithCircuitBreaker<T>(
    operation: () => Promise<T>,
    breakerName: string
  ): Promise<T> {
    this.ensureInitialized();
    const breaker = this.circuitBreakers.get(breakerName);
    if (!breaker) {
      throw new Error(`Circuit breaker not found: ${breakerName}`);
    }
    return breaker.execute(operation);
  }

  async acquireLock(
    resource: string,
    ttl?: number,
    retryCount?: number
  ): Promise<DistributedLock> {
    this.ensureInitialized();
    return this.lockSystem.acquireLock(resource, ttl, retryCount);
  }

  registerHealthCheck(
    serviceName: string,
    checker: () => Promise<Partial<HealthMetrics>>
  ): void {
    this.ensureInitialized();
    if (this.healthSystem) {
      this.healthSystem.registerService(serviceName, checker);
    }
  }

  async sendAlert(
    alertId: string,
    message: string,
    priority: 'low' | 'medium' | 'high' | 'critical',
    data?: any
  ): Promise<void> {
    this.ensureInitialized();
    if (this.alertSystem) {
      await this.alertSystem.sendAlert(alertId, message, priority, data);
    }
  }

  // Métodos de combinación para operaciones complejas
  async executeResilientOperation<T>(
    operation: () => Promise<T>,
    options: {
      retryPolicy?: string;
      circuitBreaker?: string;
      lock?: string;
      lockTtl?: number;
      context?: string;
    }
  ): Promise<T> {
    this.ensureInitialized();
    
    let lock: DistributedLock | undefined;
    
    try {
      // Adquirir lock si se especifica
      if (options.lock) {
        lock = await this.acquireLock(options.lock, options.lockTtl);
      }

      // Crear operación wrapper que aplica retry y circuit breaker
      const wrappedOperation = async (): Promise<T> => {
        if (options.circuitBreaker) {
          return this.executeWithCircuitBreaker(operation, options.circuitBreaker);
        }
        return operation();
      };

      // Ejecutar con retry si se especifica
      if (options.retryPolicy) {
        return await this.executeWithRetry(
          wrappedOperation, 
          options.retryPolicy, 
          options.context
        );
      }

      return await wrappedOperation();

    } finally {
      // Liberar lock
      if (lock) {
        await lock.release();
      }
    }
  }

  // Métricas y monitoreo
  async getSystemMetrics(): Promise<any> {
    this.ensureInitialized();
    
    const [
      healthReport,
      alertStats,
      circuitBreakerStates,
      lockInfo
    ] = await Promise.all([
      this.healthSystem?.getHealthReport() || null,
      this.alertSystem?.getAlertStats() || null,
      this.getCircuitBreakerStates(),
      this.lockSystem.getAllLocks()
    ]);

    return {
      timestamp: Date.now(),
      health: healthReport,
      alerts: alertStats,
      circuitBreakers: circuitBreakerStates,
      locks: lockInfo,
      redis: {
        status: this.redis.status,
        memory: await this.redis.memory('usage') || 0
      }
    };
  }

  private async getCircuitBreakerStates(): Promise<Record<string, any>> {
    const states: Record<string, any> = {};
    
    for (const [name, breaker] of this.circuitBreakers) {
      states[name] = {
        state: breaker.getState(),
        metrics: await breaker.getDetailedMetrics()
      };
    }
    
    return states;
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('ResilienceEngine not initialized. Call initialize() first.');
    }
  }

  async destroy(): Promise<void> {
    // Destruir componentes
    this.circuitBreakers.forEach(cb => cb.destroy());
    this.healthSystem?.destroy();
    this.alertSystem?.destroy();
    
    // Cerrar conexión Redis
    await this.redis.quit();
    
    this.removeAllListeners();
  }
}

// ============================================================================
// EXPORT DEFAULT
// ============================================================================

export default ResilienceEngine;
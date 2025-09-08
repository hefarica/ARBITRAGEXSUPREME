/**
 * ArbitrageX Supreme - Advanced Rate Limiting Middleware
 * Ingenio Pichichi S.A. - Rate limiting avanzado con múltiples estrategias
 * 
 * Implementación metodica y disciplinada para:
 * - Rate limiting por IP
 * - Rate limiting por usuario
 * - Rate limiting por endpoint
 * - Sliding window algorithm
 * - Burst protection
 */

import { NextRequest } from 'next/server'

export interface RateLimitConfig {
  windowMs: number // Ventana de tiempo en ms
  max: number // Máximo requests en la ventana
  keyGenerator?: (request: NextRequest) => string
  skipSuccessfulRequests?: boolean
  skipFailedRequests?: boolean
  message?: string
  standardHeaders?: boolean
  legacyHeaders?: boolean
}

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  resetTime: number
  retryAfter?: number
}

// Cache en memoria (en producción usar Redis/Memcached)
const rateLimitStore = new Map<string, RateLimitEntry>()

interface RateLimitEntry {
  totalHits: number
  resetTime: number
  firstRequestTime: number
}

/**
 * Sliding Window Rate Limiter
 */
export class SlidingWindowRateLimit {
  protected config: RateLimitConfig

  constructor(config: RateLimitConfig) {
    this.config = {
      keyGenerator: (req) => this.getClientIdentifier(req),
      message: 'Too many requests, please try again later',
      standardHeaders: true,
      legacyHeaders: false,
      ...config
    }
  }

  async check(request: NextRequest): Promise<RateLimitResult> {
    const key = this.config.keyGenerator!(request)
    const now = Date.now()
    
    // Limpiar entradas expiradas
    this.cleanupExpiredEntries(now)
    
    let entry = rateLimitStore.get(key)
    
    if (!entry || now > entry.resetTime) {
      // Nueva ventana
      entry = {
        totalHits: 1,
        resetTime: now + this.config.windowMs,
        firstRequestTime: now
      }
      rateLimitStore.set(key, entry)
      
      return {
        success: true,
        limit: this.config.max,
        remaining: this.config.max - 1,
        resetTime: entry.resetTime
      }
    }
    
    // Ventana existente
    if (entry.totalHits >= this.config.max) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000)
      
      console.warn(`⚠️ Rate limit exceeded for key: ${key}`)
      
      return {
        success: false,
        limit: this.config.max,
        remaining: 0,
        resetTime: entry.resetTime,
        retryAfter
      }
    }
    
    // Incrementar contador
    entry.totalHits += 1
    rateLimitStore.set(key, entry)
    
    return {
      success: true,
      limit: this.config.max,
      remaining: this.config.max - entry.totalHits,
      resetTime: entry.resetTime
    }
  }

  private getClientIdentifier(request: NextRequest): string {
    // Priorizar diferentes fuentes de identificación
    const forwarded = request.headers.get('x-forwarded-for')
    const realIP = request.headers.get('x-real-ip')
    const cfConnectingIP = request.headers.get('cf-connecting-ip')
    
    // Si hay autenticación, usar el user ID
    const auth = request.headers.get('authorization')
    if (auth) {
      const userHash = this.hashString(auth)
      return `user_${userHash}`
    }
    
    // Usar la IP más confiable
    const ip = cfConnectingIP || realIP || forwarded?.split(',')[0] || 'unknown'
    return `ip_${ip}`
  }

  private hashString(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36)
  }

  private cleanupExpiredEntries(now: number): void {
    rateLimitStore.forEach((entry, key) => {
      if (now > entry.resetTime) {
        rateLimitStore.delete(key)
      }
    })
  }
}

/**
 * Burst Protection Rate Limiter
 * Previene ráfagas de requests en períodos muy cortos
 */
export class BurstProtectionRateLimit {
  private shortWindow: SlidingWindowRateLimit
  private longWindow: SlidingWindowRateLimit

  constructor(
    shortConfig: { windowMs: number; max: number },
    longConfig: { windowMs: number; max: number }
  ) {
    this.shortWindow = new SlidingWindowRateLimit(shortConfig)
    this.longWindow = new SlidingWindowRateLimit(longConfig)
  }

  async check(request: NextRequest): Promise<RateLimitResult> {
    // Verificar ventana corta (burst protection)
    const shortResult = await this.shortWindow.check(request)
    if (!shortResult.success) {
      return {
        ...shortResult,
        retryAfter: 1 // Retry in 1 second for burst protection
      }
    }

    // Verificar ventana larga
    const longResult = await this.longWindow.check(request)
    return longResult
  }
}

/**
 * Configuraciones predefinidas de rate limiting
 */
export const RateLimitConfigs = {
  // Muy restrictivo para operaciones críticas (ejecuciones)
  CRITICAL: new SlidingWindowRateLimit({
    windowMs: 60 * 1000, // 1 minuto
    max: 3, // 3 requests por minuto
    message: 'Critical operation rate limit exceeded'
  }),

  // Restrictivo para simulaciones
  SIMULATION: new BurstProtectionRateLimit(
    { windowMs: 10 * 1000, max: 5 }, // 5 requests per 10 seconds
    { windowMs: 60 * 1000, max: 20 }  // 20 requests per minute
  ),

  // Moderado para APIs generales
  GENERAL: new SlidingWindowRateLimit({
    windowMs: 60 * 1000, // 1 minuto
    max: 100, // 100 requests por minuto
    message: 'API rate limit exceeded'
  }),

  // Permisivo para lecturas públicas
  PUBLIC_READ: new SlidingWindowRateLimit({
    windowMs: 60 * 1000, // 1 minuto
    max: 200, // 200 requests por minuto
    message: 'Public API rate limit exceeded'
  }),

  // Muy restrictivo para autenticación
  AUTH: new SlidingWindowRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5, // 5 intentos por 15 minutos
    message: 'Authentication rate limit exceeded'
  })
}

/**
 * Rate Limiter personalizado por endpoint
 */
export class EndpointRateLimit {
  private limiters: Map<string, SlidingWindowRateLimit> = new Map()

  constructor(private defaultConfig: RateLimitConfig) {}

  setEndpointLimit(endpoint: string, config: RateLimitConfig): void {
    this.limiters.set(endpoint, new SlidingWindowRateLimit(config))
  }

  async checkEndpoint(request: NextRequest, endpoint: string): Promise<RateLimitResult> {
    let limiter = this.limiters.get(endpoint)
    
    if (!limiter) {
      // Usar configuración por defecto
      limiter = new SlidingWindowRateLimit(this.defaultConfig)
      this.limiters.set(endpoint, limiter)
    }

    return await limiter.check(request)
  }
}

/**
 * Rate Limiter adaptativo
 * Ajusta los límites basado en la carga del sistema
 */
export class AdaptiveRateLimit extends SlidingWindowRateLimit {
  private baseMax: number
  private currentMultiplier: number = 1.0

  constructor(config: RateLimitConfig) {
    super(config)
    this.baseMax = config.max
  }

  updateSystemLoad(cpuUsage: number, memoryUsage: number): void {
    // Reducir límites si el sistema está sobrecargado
    if (cpuUsage > 80 || memoryUsage > 85) {
      this.currentMultiplier = 0.5 // Reducir a la mitad
    } else if (cpuUsage > 60 || memoryUsage > 70) {
      this.currentMultiplier = 0.7 // Reducir 30%
    } else {
      this.currentMultiplier = 1.0 // Límites normales
    }

    // Actualizar la configuración
    this.config.max = Math.floor(this.baseMax * this.currentMultiplier)
  }

  getSystemStatus(): { cpuUsage: number; memoryUsage: number; multiplier: number } {
    // En producción, obtener métricas reales del sistema
    const cpuUsage = Math.random() * 100
    const memoryUsage = Math.random() * 100
    
    return {
      cpuUsage,
      memoryUsage,
      multiplier: this.currentMultiplier
    }
  }
}

/**
 * Rate Limiter distribuido (para múltiples instancias)
 */
export class DistributedRateLimit {
  constructor(
    private config: RateLimitConfig,
    private redisClient?: any // En producción usar cliente Redis
  ) {}

  async check(request: NextRequest): Promise<RateLimitResult> {
    if (!this.redisClient) {
      // Fallback a rate limiter local
      const localLimiter = new SlidingWindowRateLimit(this.config)
      return await localLimiter.check(request)
    }

    // Implementación con Redis para entornos distribuidos
    // TODO: Implementar lógica Redis cuando esté disponible
    throw new Error('Distributed rate limiting requires Redis client')
  }
}

/**
 * Helper para obtener headers de rate limiting estándar
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': Math.ceil(result.resetTime / 1000).toString()
  }

  if (result.retryAfter) {
    headers['Retry-After'] = result.retryAfter.toString()
  }

  return headers
}
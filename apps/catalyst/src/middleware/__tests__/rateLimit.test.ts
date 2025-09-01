/**
 * @fileoverview Tests unitarios para middleware de rate limiting
 * Ingenio Pichichi S.A. - ArbitrageX Supreme
 * Tests completos para sistema de limitación de velocidad con sliding window
 */

import { NextRequest, NextResponse } from 'next/server'
import { createRateLimit, RateLimitConfig } from '../rateLimit'

// Mock Redis/KV para testing
const mockKVStore = new Map<string, any>()

const mockKV = {
  get: jest.fn().mockImplementation((key: string) => {
    const value = mockKVStore.get(key)
    return Promise.resolve(value ? JSON.stringify(value) : null)
  }),
  put: jest.fn().mockImplementation((key: string, value: string, options?: any) => {
    mockKVStore.set(key, JSON.parse(value))
    return Promise.resolve()
  }),
  delete: jest.fn().mockImplementation((key: string) => {
    mockKVStore.delete(key)
    return Promise.resolve()
  }),
}

// Mock environment con KV
const mockEnv = {
  KV: mockKV,
}

describe('Rate Limit Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockKVStore.clear()
    jest.spyOn(Date, 'now').mockReturnValue(1000000) // Fixed timestamp
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('Configuración Básica', () => {
    it('debe crear rate limiter con configuración por defecto', () => {
      const rateLimit = createRateLimit()
      expect(rateLimit).toBeDefined()
      expect(typeof rateLimit).toBe('function')
    })

    it('debe aceptar configuración personalizada', () => {
      const config: RateLimitConfig = {
        windowMs: 60000, // 1 minuto
        maxRequests: 100,
        keyGenerator: (req) => `custom-${req.ip}`,
      }

      const rateLimit = createRateLimit(config)
      expect(rateLimit).toBeDefined()
    })
  })

  describe('Sliding Window Algorithm', () => {
    it('debe permitir requests dentro del límite', async () => {
      const config: RateLimitConfig = {
        windowMs: 60000,
        maxRequests: 5,
      }
      const rateLimit = createRateLimit(config)

      const req = new NextRequest('https://example.com/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.1' }
      })

      // Primera request
      const result1 = await rateLimit(req, mockEnv as any)
      expect(result1.allowed).toBe(true)
      expect(result1.remaining).toBe(4)

      // Segunda request
      const result2 = await rateLimit(req, mockEnv as any)
      expect(result2.allowed).toBe(true)
      expect(result2.remaining).toBe(3)
    })

    it('debe bloquear requests que excedan el límite', async () => {
      const config: RateLimitConfig = {
        windowMs: 60000,
        maxRequests: 2,
      }
      const rateLimit = createRateLimit(config)

      const req = new NextRequest('https://example.com/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.1' }
      })

      // Requests dentro del límite
      const result1 = await rateLimit(req, mockEnv as any)
      expect(result1.allowed).toBe(true)

      const result2 = await rateLimit(req, mockEnv as any)
      expect(result2.allowed).toBe(true)

      // Request que excede el límite
      const result3 = await rateLimit(req, mockEnv as any)
      expect(result3.allowed).toBe(false)
      expect(result3.remaining).toBe(0)
      expect(result3.resetTime).toBeGreaterThan(0)
    })

    it('debe limpiar ventana deslizante correctamente', async () => {
      const config: RateLimitConfig = {
        windowMs: 60000,
        maxRequests: 3,
      }
      const rateLimit = createRateLimit(config)

      const req = new NextRequest('https://example.com/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.1' }
      })

      // Llenar el límite
      await rateLimit(req, mockEnv as any)
      await rateLimit(req, mockEnv as any)
      await rateLimit(req, mockEnv as any)

      // Verificar que está bloqueado
      const blockedResult = await rateLimit(req, mockEnv as any)
      expect(blockedResult.allowed).toBe(false)

      // Avanzar tiempo más allá de la ventana
      jest.spyOn(Date, 'now').mockReturnValue(1000000 + 70000) // +70 segundos

      // Debería permitir requests nuevamente
      const allowedResult = await rateLimit(req, mockEnv as any)
      expect(allowedResult.allowed).toBe(true)
      expect(allowedResult.remaining).toBe(2)
    })
  })

  describe('Generación de Claves', () => {
    it('debe usar IP por defecto', async () => {
      const rateLimit = createRateLimit()

      const req = new NextRequest('https://example.com/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.1' }
      })

      await rateLimit(req, mockEnv as any)

      expect(mockKV.get).toHaveBeenCalledWith('ratelimit:192.168.1.1')
    })

    it('debe usar generador de claves personalizado', async () => {
      const config: RateLimitConfig = {
        keyGenerator: (req) => {
          const userId = req.headers.get('x-user-id')
          return `user:${userId || 'anonymous'}`
        },
      }
      const rateLimit = createRateLimit(config)

      const req = new NextRequest('https://example.com/api/test', {
        headers: { 
          'x-forwarded-for': '192.168.1.1',
          'x-user-id': 'user123'
        }
      })

      await rateLimit(req, mockEnv as any)

      expect(mockKV.get).toHaveBeenCalledWith('ratelimit:user:user123')
    })

    it('debe manejar IPs múltiples en x-forwarded-for', async () => {
      const rateLimit = createRateLimit()

      const req = new NextRequest('https://example.com/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.1, 10.0.0.1, 172.16.0.1' }
      })

      await rateLimit(req, mockEnv as any)

      // Debe usar la primera IP
      expect(mockKV.get).toHaveBeenCalledWith('ratelimit:192.168.1.1')
    })
  })

  describe('Burst Protection', () => {
    it('debe aplicar burst protection', async () => {
      const config: RateLimitConfig = {
        windowMs: 60000,
        maxRequests: 10,
        burstLimit: 5,
        burstWindowMs: 1000,
      }
      const rateLimit = createRateLimit(config)

      const req = new NextRequest('https://example.com/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.1' }
      })

      // Enviar requests rápidas (burst)
      const promises = Array(7).fill(null).map(() => 
        rateLimit(req, mockEnv as any)
      )

      const results = await Promise.all(promises)

      // Primeras 5 deben ser permitidas (burstLimit)
      expect(results.slice(0, 5).every(r => r.allowed)).toBe(true)
      
      // Las siguientes deben ser bloqueadas
      expect(results.slice(5).every(r => !r.allowed)).toBe(true)
    })

    it('debe resetear burst después del tiempo', async () => {
      const config: RateLimitConfig = {
        windowMs: 60000,
        maxRequests: 10,
        burstLimit: 2,
        burstWindowMs: 1000,
      }
      const rateLimit = createRateLimit(config)

      const req = new NextRequest('https://example.com/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.1' }
      })

      // Llenar burst limit
      await rateLimit(req, mockEnv as any)
      await rateLimit(req, mockEnv as any)

      // Siguiente debe ser bloqueada
      const blockedResult = await rateLimit(req, mockEnv as any)
      expect(blockedResult.allowed).toBe(false)

      // Avanzar tiempo
      jest.spyOn(Date, 'now').mockReturnValue(1000000 + 2000)

      // Debe permitir nuevamente
      const allowedResult = await rateLimit(req, mockEnv as any)
      expect(allowedResult.allowed).toBe(true)
    })
  })

  describe('Headers de Respuesta', () => {
    it('debe incluir headers informativos', async () => {
      const config: RateLimitConfig = {
        windowMs: 60000,
        maxRequests: 5,
      }
      const rateLimit = createRateLimit(config)

      const req = new NextRequest('https://example.com/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.1' }
      })

      const result = await rateLimit(req, mockEnv as any)

      expect(result.headers).toEqual({
        'X-RateLimit-Limit': '5',
        'X-RateLimit-Remaining': '4',
        'X-RateLimit-Reset': expect.any(String),
        'X-RateLimit-Window': '60000',
      })
    })

    it('debe incluir Retry-After cuando esté bloqueado', async () => {
      const config: RateLimitConfig = {
        windowMs: 60000,
        maxRequests: 1,
      }
      const rateLimit = createRateLimit(config)

      const req = new NextRequest('https://example.com/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.1' }
      })

      // Primer request
      await rateLimit(req, mockEnv as any)

      // Segundo request (bloqueado)
      const result = await rateLimit(req, mockEnv as any)

      expect(result.headers['Retry-After']).toBeDefined()
      expect(parseInt(result.headers['Retry-After']!)).toBeGreaterThan(0)
    })
  })

  describe('Manejo de Errores', () => {
    it('debe manejar errores de KV gracefully', async () => {
      mockKV.get.mockRejectedValueOnce(new Error('KV Error'))

      const rateLimit = createRateLimit()

      const req = new NextRequest('https://example.com/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.1' }
      })

      // No debe fallar, debe permitir la request
      const result = await rateLimit(req, mockEnv as any)
      expect(result.allowed).toBe(true)
    })

    it('debe manejar KV store no disponible', async () => {
      const envWithoutKV = {}
      const rateLimit = createRateLimit()

      const req = new NextRequest('https://example.com/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.1' }
      })

      // Debe permitir la request sin rate limiting
      const result = await rateLimit(req, envWithoutKV as any)
      expect(result.allowed).toBe(true)
    })

    it('debe manejar datos corruptos en KV', async () => {
      mockKV.get.mockResolvedValueOnce('invalid json data')

      const rateLimit = createRateLimit()

      const req = new NextRequest('https://example.com/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.1' }
      })

      // Debe tratar como primera request
      const result = await rateLimit(req, mockEnv as any)
      expect(result.allowed).toBe(true)
    })
  })

  describe('Casos de Uso Específicos', () => {
    it('debe manejar rate limiting por endpoint', async () => {
      const strictConfig: RateLimitConfig = {
        windowMs: 60000,
        maxRequests: 2,
        keyGenerator: (req) => {
          const ip = req.headers.get('x-forwarded-for') || req.ip || 'unknown'
          const path = new URL(req.url).pathname
          return `${ip}:${path}`
        },
      }

      const rateLimit = createRateLimit(strictConfig)

      const req1 = new NextRequest('https://example.com/api/execute', {
        headers: { 'x-forwarded-for': '192.168.1.1' }
      })

      const req2 = new NextRequest('https://example.com/api/simulate', {
        headers: { 'x-forwarded-for': '192.168.1.1' }
      })

      // Diferentes endpoints deben tener límites separados
      await rateLimit(req1, mockEnv as any)
      await rateLimit(req1, mockEnv as any)

      const result1 = await rateLimit(req1, mockEnv as any)
      expect(result1.allowed).toBe(false) // Bloqueado para /api/execute

      const result2 = await rateLimit(req2, mockEnv as any)
      expect(result2.allowed).toBe(true) // Permitido para /api/simulate
    })

    it('debe implementar whitelist de IPs', async () => {
      const config: RateLimitConfig = {
        windowMs: 60000,
        maxRequests: 1,
        skip: (req) => {
          const ip = req.headers.get('x-forwarded-for') || req.ip
          const whitelist = ['127.0.0.1', '192.168.1.100']
          return whitelist.includes(ip || '')
        },
      }

      const rateLimit = createRateLimit(config)

      const whitelistedReq = new NextRequest('https://example.com/api/test', {
        headers: { 'x-forwarded-for': '127.0.0.1' }
      })

      const normalReq = new NextRequest('https://example.com/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.1' }
      })

      // Whitelisted IP debe ser siempre permitida
      const result1 = await rateLimit(whitelistedReq, mockEnv as any)
      const result2 = await rateLimit(whitelistedReq, mockEnv as any)
      
      expect(result1.allowed).toBe(true)
      expect(result2.allowed).toBe(true)

      // Normal IP debe respetar límites
      const result3 = await rateLimit(normalReq, mockEnv as any)
      const result4 = await rateLimit(normalReq, mockEnv as any)

      expect(result3.allowed).toBe(true)
      expect(result4.allowed).toBe(false)
    })
  })

  describe('Métricas y Monitoreo', () => {
    it('debe proporcionar estadísticas de uso', async () => {
      const rateLimit = createRateLimit()

      const req = new NextRequest('https://example.com/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.1' }
      })

      const result = await rateLimit(req, mockEnv as any)

      expect(result.stats).toEqual({
        totalRequests: 1,
        allowedRequests: 1,
        blockedRequests: 0,
        currentWindow: expect.any(Number),
      })
    })

    it('debe trackear requests bloqueadas', async () => {
      const config: RateLimitConfig = {
        windowMs: 60000,
        maxRequests: 1,
      }
      const rateLimit = createRateLimit(config)

      const req = new NextRequest('https://example.com/api/test', {
        headers: { 'x-forwarded-for': '192.168.1.1' }
      })

      await rateLimit(req, mockEnv as any)
      const result = await rateLimit(req, mockEnv as any)

      expect(result.stats.blockedRequests).toBe(1)
    })
  })
})
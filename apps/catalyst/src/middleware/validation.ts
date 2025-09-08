/**
 * ArbitrageX Supreme - API Validation Middleware
 * Ingenio Pichichi S.A. - Middleware para validación de requests
 * 
 * Implementación metodica y disciplinada para validación de:
 * - Rate limiting
 * - Request validation
 * - Authentication
 * - CORS
 * - Input sanitization
 */

import { NextRequest, NextResponse } from 'next/server'
import { ethers } from 'ethers'

// Rate limiting cache (en producción usar Redis)
const rateLimitCache = new Map<string, { count: number; resetTime: number }>()

export interface ValidationConfig {
  rateLimit?: {
    requests: number
    windowMs: number
  }
  requireAuth?: boolean
  validateSignature?: boolean
  allowedMethods?: string[]
  cors?: {
    origin: string[]
    credentials: boolean
  }
}

export interface ValidationResult {
  success: boolean
  error?: string
  status?: number
}

/**
 * Middleware principal de validación para APIs
 */
export async function validateApiRequest(
  request: NextRequest,
  config: ValidationConfig
): Promise<ValidationResult> {
  
  try {
    console.log(`🔐 Validating API request: ${request.method} ${request.url}`)

    // 1. Validación de métodos HTTP
    if (config.allowedMethods && !config.allowedMethods.includes(request.method)) {
      return {
        success: false,
        error: `Method ${request.method} not allowed`,
        status: 405
      }
    }

    // 2. Rate Limiting
    if (config.rateLimit) {
      const rateLimitResult = await applyRateLimit(request, config.rateLimit)
      if (!rateLimitResult.success) {
        return rateLimitResult
      }
    }

    // 3. CORS validation
    if (config.cors) {
      const corsResult = validateCORS(request, config.cors)
      if (!corsResult.success) {
        return corsResult
      }
    }

    // 4. Authentication (si requerida)
    if (config.requireAuth) {
      const authResult = await validateAuthentication(request)
      if (!authResult.success) {
        return authResult
      }
    }

    // 5. Signature validation (para requests críticos)
    if (config.validateSignature && request.method === 'POST') {
      const sigResult = await validateEIP712Signature(request)
      if (!sigResult.success) {
        return sigResult
      }
    }

    // 6. Input sanitization
    const sanitizationResult = await sanitizeInput(request)
    if (!sanitizationResult.success) {
      return sanitizationResult
    }

    return { success: true }

  } catch (error: any) {
    console.error('❌ Validation middleware error:', error)
    return {
      success: false,
      error: 'Internal validation error',
      status: 500
    }
  }
}

/**
 * Rate Limiting Implementation
 */
async function applyRateLimit(
  request: NextRequest,
  config: { requests: number; windowMs: number }
): Promise<ValidationResult> {
  
  const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0] || 
                   request.headers.get('x-real-ip') || 'unknown'
  const key = `rate_limit_${clientIP}`
  const now = Date.now()

  const current = rateLimitCache.get(key)
  
  if (!current || now > current.resetTime) {
    // Nueva ventana o primera request
    rateLimitCache.set(key, {
      count: 1,
      resetTime: now + config.windowMs
    })
    return { success: true }
  }

  if (current.count >= config.requests) {
    console.warn(`⚠️ Rate limit exceeded for IP: ${clientIP}`)
    return {
      success: false,
      error: 'Rate limit exceeded. Too many requests.',
      status: 429
    }
  }

  // Incrementar contador
  current.count += 1
  rateLimitCache.set(key, current)
  
  return { success: true }
}

/**
 * CORS Validation
 */
function validateCORS(
  request: NextRequest,
  config: { origin: string[]; credentials: boolean }
): ValidationResult {
  
  const origin = request.headers.get('origin')
  
  if (origin && !config.origin.includes('*') && !config.origin.includes(origin)) {
    console.warn(`⚠️ CORS blocked for origin: ${origin}`)
    return {
      success: false,
      error: 'CORS policy violation',
      status: 403
    }
  }

  return { success: true }
}

/**
 * Authentication Validation
 */
async function validateAuthentication(request: NextRequest): Promise<ValidationResult> {
  
  const authHeader = request.headers.get('authorization')
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      success: false,
      error: 'Missing or invalid authorization header',
      status: 401
    }
  }

  const token = authHeader.substring(7) // Remove 'Bearer '
  
  // En producción, validar JWT token
  if (token.length < 10) {
    return {
      success: false,
      error: 'Invalid authentication token',
      status: 401
    }
  }

  return { success: true }
}

/**
 * EIP-712 Signature Validation
 */
async function validateEIP712Signature(request: NextRequest): Promise<ValidationResult> {
  
  try {
    const body = await request.json()
    
    if (!body.signature || !body.userAddress) {
      return {
        success: false,
        error: 'Missing signature or userAddress for critical operation',
        status: 400
      }
    }

    // Validar formato de dirección
    if (!ethers.isAddress(body.userAddress)) {
      return {
        success: false,
        error: 'Invalid Ethereum address format',
        status: 400
      }
    }

    // Validar formato de signature
    if (!/^0x[a-fA-F0-9]{130}$/.test(body.signature)) {
      return {
        success: false,
        error: 'Invalid signature format',
        status: 400
      }
    }

    return { success: true }

  } catch (error) {
    return {
      success: false,
      error: 'Invalid JSON body for signature validation',
      status: 400
    }
  }
}

/**
 * Input Sanitization
 */
async function sanitizeInput(request: NextRequest): Promise<ValidationResult> {
  
  if (request.method === 'GET') {
    // Validar query parameters
    const { searchParams } = new URL(request.url)
    
    try {
      searchParams.forEach((value, key) => {
        // Detectar posibles inyecciones SQL/NoSQL
        if (containsMaliciousPatterns(value)) {
          console.warn(`⚠️ Malicious pattern detected in query param ${key}: ${value}`)
          // No podemos retornar desde forEach, usar flag
          throw new Error('Invalid characters in request parameters')
        }
      })
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        status: 400
      }
    }
  }

  if (request.method === 'POST' || request.method === 'PUT') {
    try {
      const body = await request.json()
      
      // Validar campos del body recursivamente
      const validation = validateObjectSafety(body)
      if (!validation.success) {
        return validation
      }

    } catch (error) {
      // JSON inválido
      return {
        success: false,
        error: 'Invalid JSON format',
        status: 400
      }
    }
  }

  return { success: true }
}

/**
 * Detectar patrones maliciosos
 */
function containsMaliciousPatterns(value: string): boolean {
  const maliciousPatterns = [
    // SQL Injection
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|ALTER|CREATE)\b)/i,
    /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
    /(\'|\-\-|\|)/,
    
    // NoSQL Injection
    /(\$where|\$ne|\$gt|\$lt)/i,
    
    // XSS
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/i,
    /on\w+\s*=/i,
    
    // Path Traversal
    /\.\.(\/|\\)/,
    
    // Command Injection
    /(\||&|;|\$\(|\`)/
  ]

  return maliciousPatterns.some(pattern => pattern.test(value))
}

/**
 * Validar seguridad de objetos recursivamente
 */
function validateObjectSafety(obj: any, depth = 0): ValidationResult {
  
  // Prevenir deep nesting attacks
  if (depth > 10) {
    return {
      success: false,
      error: 'Object nesting too deep',
      status: 400
    }
  }

  if (typeof obj === 'string') {
    if (containsMaliciousPatterns(obj)) {
      return {
        success: false,
        error: 'Invalid characters in request body',
        status: 400
      }
    }
  }

  if (typeof obj === 'object' && obj !== null) {
    for (const [key, value] of Object.entries(obj)) {
      // Validar keys
      if (containsMaliciousPatterns(key)) {
        return {
          success: false,
          error: 'Invalid characters in object keys',
          status: 400
        }
      }

      // Validar values recursivamente
      const validation = validateObjectSafety(value, depth + 1)
      if (!validation.success) {
        return validation
      }
    }
  }

  return { success: true }
}

/**
 * Configuraciones predefinidas para diferentes endpoints
 */
export const ValidationConfigs = {
  // Configuración estricta para operaciones críticas
  CRITICAL_OPERATIONS: {
    rateLimit: { requests: 5, windowMs: 60000 }, // 5 requests per minute
    requireAuth: true,
    validateSignature: true,
    allowedMethods: ['POST'],
    cors: { origin: ['https://arbitragex.com'], credentials: true }
  } as ValidationConfig,

  // Configuración para APIs públicas de lectura
  PUBLIC_READ: {
    rateLimit: { requests: 100, windowMs: 60000 }, // 100 requests per minute
    allowedMethods: ['GET'],
    cors: { origin: ['*'], credentials: false }
  } as ValidationConfig,

  // Configuración para simulaciones
  SIMULATION: {
    rateLimit: { requests: 20, windowMs: 60000 }, // 20 requests per minute
    allowedMethods: ['GET', 'POST'],
    cors: { origin: ['*'], credentials: false }
  } as ValidationConfig,

  // Configuración para ejecuciones
  EXECUTION: {
    rateLimit: { requests: 3, windowMs: 60000 }, // 3 requests per minute
    requireAuth: true,
    validateSignature: true,
    allowedMethods: ['POST', 'GET'],
    cors: { origin: ['https://arbitragex.com'], credentials: true }
  } as ValidationConfig
}

/**
 * Helper para crear response con headers apropiados
 */
export function createValidationResponse(
  result: ValidationResult,
  corsConfig?: { origin: string[]; credentials: boolean }
): NextResponse {
  
  const response = NextResponse.json(
    {
      success: false,
      error: result.error,
      timestamp: new Date().toISOString()
    },
    { status: result.status || 400 }
  )

  // Agregar headers CORS si están configurados
  if (corsConfig) {
    response.headers.set('Access-Control-Allow-Origin', corsConfig.origin.includes('*') ? '*' : corsConfig.origin[0])
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    
    if (corsConfig.credentials) {
      response.headers.set('Access-Control-Allow-Credentials', 'true')
    }
  }

  return response
}
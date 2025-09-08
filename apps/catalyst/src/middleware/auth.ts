/**
 * ArbitrageX Supreme - Authentication Middleware
 * Ingenio Pichichi S.A. - Middleware de autenticación y autorización
 * 
 * Implementación metodica y disciplinada para:
 * - JWT authentication
 * - EIP-712 signature verification
 * - API key validation
 * - Role-based access control (RBAC)
 * - Session management
 */

import { NextRequest } from 'next/server'
import { ethers } from 'ethers'
// Web Crypto API compatible with Edge Runtime

export interface AuthConfig {
  requireAuth: boolean
  allowedRoles?: string[]
  requireSignature?: boolean
  apiKeyRequired?: boolean
  sessionTimeout?: number // in minutes
}

export interface AuthResult {
  success: boolean
  user?: AuthenticatedUser
  error?: string
  status?: number
}

export interface AuthenticatedUser {
  address: string
  role: string
  permissions: string[]
  sessionId?: string
  apiKey?: string
  isVerified: boolean
  lastActivity: number
}

export interface JWTPayload {
  sub: string // subject (user address)
  iss: string // issuer
  aud: string // audience
  exp: number // expiration time
  iat: number // issued at
  role: string
  permissions: string[]
}

// Session cache (en producción usar Redis)
const sessionCache = new Map<string, AuthenticatedUser>()
const apiKeyCache = new Map<string, AuthenticatedUser>()

/**
 * Middleware principal de autenticación
 */
export async function authenticateRequest(
  request: NextRequest,
  config: AuthConfig
): Promise<AuthResult> {
  
  try {
    console.log(`🔐 Authenticating request: ${request.method} ${request.url}`)

    if (!config.requireAuth) {
      return { success: true }
    }

    // 1. Verificar API Key si es requerida
    if (config.apiKeyRequired) {
      const apiKeyResult = await validateApiKey(request)
      if (apiKeyResult.user) {
        return checkPermissions(apiKeyResult.user, config)
      }
      if (!apiKeyResult.success) {
        return apiKeyResult
      }
    }

    // 2. Verificar JWT Token
    const jwtResult = await validateJWTToken(request)
    if (jwtResult.user) {
      return checkPermissions(jwtResult.user, config)
    }

    // 3. Verificar EIP-712 Signature si es requerida
    if (config.requireSignature) {
      const signatureResult = await validateSignatureAuth(request)
      if (signatureResult.user) {
        return checkPermissions(signatureResult.user, config)
      }
      if (!signatureResult.success) {
        return signatureResult
      }
    }

    // Si llegamos aquí, no hay autenticación válida
    return {
      success: false,
      error: 'Authentication required',
      status: 401
    }

  } catch (error: any) {
    console.error('❌ Authentication error:', error)
    return {
      success: false,
      error: 'Authentication failed',
      status: 500
    }
  }
}

/**
 * Validar API Key
 */
async function validateApiKey(request: NextRequest): Promise<AuthResult> {
  
  const apiKey = request.headers.get('x-api-key')
  
  if (!apiKey) {
    return { success: false } // No API key provided, try other auth methods
  }

  // Verificar en cache
  const cachedUser = apiKeyCache.get(apiKey)
  if (cachedUser) {
    // Verificar si la sesión no ha expirado
    if (Date.now() - cachedUser.lastActivity < 60 * 60 * 1000) { // 1 hora
      cachedUser.lastActivity = Date.now()
      return { success: true, user: cachedUser }
    } else {
      apiKeyCache.delete(apiKey)
    }
  }

  // Validar API key (en producción consultar base de datos)
  const isValidApiKey = await validateApiKeyInDatabase(apiKey)
  
  if (!isValidApiKey) {
    return {
      success: false,
      error: 'Invalid API key',
      status: 401
    }
  }

  // Crear usuario temporal para API key
  const user: AuthenticatedUser = {
    address: 'api_key_user',
    role: 'api_user',
    permissions: ['read', 'simulate'],
    apiKey,
    isVerified: true,
    lastActivity: Date.now()
  }

  apiKeyCache.set(apiKey, user)
  
  return { success: true, user }
}

/**
 * Validar JWT Token
 */
async function validateJWTToken(request: NextRequest): Promise<AuthResult> {
  
  const authHeader = request.headers.get('authorization')
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { success: false } // No JWT token, try other auth methods
  }

  const token = authHeader.substring(7) // Remove 'Bearer '

  try {
    // En producción, usar biblioteca JWT real como 'jose' o 'jsonwebtoken'
    const payload = parseJWTToken(token)
    
    if (!payload) {
      return {
        success: false,
        error: 'Invalid JWT token',
        status: 401
      }
    }

    // Verificar expiración
    if (Date.now() > payload.exp * 1000) {
      return {
        success: false,
        error: 'JWT token expired',
        status: 401
      }
    }

    // Crear usuario autenticado
    const user: AuthenticatedUser = {
      address: payload.sub,
      role: payload.role,
      permissions: payload.permissions,
      isVerified: true,
      lastActivity: Date.now()
    }

    return { success: true, user }

  } catch (error) {
    return {
      success: false,
      error: 'JWT token validation failed',
      status: 401
    }
  }
}

/**
 * Validar autenticación por signature EIP-712
 */
async function validateSignatureAuth(request: NextRequest): Promise<AuthResult> {
  
  if (request.method !== 'POST') {
    return { success: false } // Signature auth only for POST requests
  }

  try {
    const body = await request.json()
    
    if (!body.signature || !body.userAddress || !body.timestamp) {
      return {
        success: false,
        error: 'Missing signature, userAddress, or timestamp',
        status: 400
      }
    }

    // Verificar que el timestamp no sea muy antiguo (5 minutos)
    const now = Date.now()
    if (now - body.timestamp > 5 * 60 * 1000) {
      return {
        success: false,
        error: 'Signature timestamp too old',
        status: 401
      }
    }

    // Verificar la signature EIP-712
    const isValidSignature = await verifyEIP712Auth(body)
    
    if (!isValidSignature) {
      return {
        success: false,
        error: 'Invalid signature',
        status: 401
      }
    }

    // Crear sesión temporal
    const sessionId = await createSessionId(body.userAddress)
    
    const user: AuthenticatedUser = {
      address: body.userAddress.toLowerCase(),
      role: 'user',
      permissions: ['read', 'simulate', 'execute'],
      sessionId,
      isVerified: true,
      lastActivity: now
    }

    // Guardar en cache de sesión
    sessionCache.set(sessionId, user)
    
    return { success: true, user }

  } catch (error) {
    return {
      success: false,
      error: 'Signature authentication failed',
      status: 401
    }
  }
}

/**
 * Verificar EIP-712 signature para autenticación
 */
async function verifyEIP712Auth(authData: any): Promise<boolean> {
  
  try {
    const domain = {
      name: 'ArbitrageX Supreme',
      version: '1',
      chainId: 1, // Mainnet por defecto
      verifyingContract: '0x0000000000000000000000000000000000000000'
    }

    const types = {
      Authentication: [
        { name: 'userAddress', type: 'address' },
        { name: 'timestamp', type: 'uint256' },
        { name: 'nonce', type: 'uint256' }
      ]
    }

    const value = {
      userAddress: authData.userAddress,
      timestamp: authData.timestamp,
      nonce: authData.nonce || 0
    }

    // Verificar signature
    const recoveredAddress = ethers.verifyTypedData(domain, types, value, authData.signature)
    
    return recoveredAddress.toLowerCase() === authData.userAddress.toLowerCase()

  } catch (error) {
    console.error('❌ EIP-712 verification failed:', error)
    return false
  }
}

/**
 * Verificar permisos basados en roles
 */
function checkPermissions(user: AuthenticatedUser, config: AuthConfig): AuthResult {
  
  // Verificar roles permitidos
  if (config.allowedRoles && config.allowedRoles.length > 0) {
    if (!config.allowedRoles.includes(user.role)) {
      return {
        success: false,
        error: `Access denied. Required roles: ${config.allowedRoles.join(', ')}`,
        status: 403
      }
    }
  }

  return { success: true, user }
}

/**
 * Crear ID de sesión único
 */
async function createSessionId(userAddress: string): Promise<string> {
  const timestamp = Date.now().toString()
  const random = Math.random().toString(36)
  const data = `${userAddress}_${timestamp}_${random}`
  
  // Use Web Crypto API for Edge Runtime compatibility
  const encoder = new TextEncoder()
  const dataBuffer = encoder.encode(data)
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Parse JWT token (implementación simple para desarrollo)
 */
function parseJWTToken(token: string): JWTPayload | null {
  
  try {
    const parts = token.split('.')
    if (parts.length !== 3) {
      return null
    }

    // Decodificar payload (en producción verificar signature también)
    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString()
    )

    return payload as JWTPayload

  } catch (error) {
    return null
  }
}

/**
 * Validar API key en base de datos (mock implementation)
 */
async function validateApiKeyInDatabase(apiKey: string): Promise<boolean> {
  
  // En producción, consultar base de datos real
  const validApiKeys = [
    'ak_live_test123456789',
    'ak_test_development123',
    'ak_prod_arbitragex456'
  ]

  return validApiKeys.includes(apiKey)
}

/**
 * Configuraciones predefinidas de autenticación
 */
export const AuthConfigs = {
  // Operaciones públicas (solo lectura)
  PUBLIC: {
    requireAuth: false
  } as AuthConfig,

  // APIs generales (requieren autenticación básica)
  AUTHENTICATED: {
    requireAuth: true,
    allowedRoles: ['user', 'admin', 'api_user'],
    sessionTimeout: 60 // 1 hora
  } as AuthConfig,

  // Operaciones críticas (requieren signature)
  CRITICAL: {
    requireAuth: true,
    requireSignature: true,
    allowedRoles: ['user', 'admin'],
    sessionTimeout: 30 // 30 minutos
  } as AuthConfig,

  // APIs administrativas
  ADMIN_ONLY: {
    requireAuth: true,
    allowedRoles: ['admin'],
    apiKeyRequired: true,
    sessionTimeout: 120 // 2 horas
  } as AuthConfig,

  // APIs de desarrollador (solo API key)
  API_KEY_ONLY: {
    requireAuth: true,
    apiKeyRequired: true,
    allowedRoles: ['api_user', 'admin']
  } as AuthConfig
}

/**
 * Helper para obtener usuario de la request autenticada
 */
export function getAuthenticatedUser(request: NextRequest): AuthenticatedUser | null {
  
  // Intentar obtener de diferentes fuentes
  const sessionId = request.headers.get('x-session-id')
  if (sessionId) {
    return sessionCache.get(sessionId) || null
  }

  const apiKey = request.headers.get('x-api-key')
  if (apiKey) {
    return apiKeyCache.get(apiKey) || null
  }

  return null
}

/**
 * Limpiar sesiones expiradas
 */
export function cleanupExpiredSessions(): void {
  
  const now = Date.now()
  const timeout = 60 * 60 * 1000 // 1 hora

  sessionCache.forEach((user, sessionId) => {
    if (now - user.lastActivity > timeout) {
      sessionCache.delete(sessionId)
    }
  })

  apiKeyCache.forEach((user, apiKey) => {
    if (now - user.lastActivity > timeout) {
      apiKeyCache.delete(apiKey)
    }
  })
}

// Limpiar sesiones cada 5 minutos
setInterval(cleanupExpiredSessions, 5 * 60 * 1000)
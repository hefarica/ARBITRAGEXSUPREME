/**
 * ArbitrageX Supreme - Main Middleware
 * Ingenio Pichichi S.A. - Middleware principal para Next.js App Router
 * 
 * Implementación metodica y disciplinada que integra:
 * - Rate limiting
 * - Authentication
 * - CORS
 * - Input validation
 * - Security headers
 * - Request logging
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateApiRequest, ValidationConfigs, createValidationResponse } from './middleware/validation'
import { RateLimitConfigs, getRateLimitHeaders } from './middleware/rateLimit'
import { authenticateRequest, AuthConfigs } from './middleware/auth'

// Configuración de middleware por ruta
const ROUTE_CONFIGS = {
  // API Routes
  '/api/simulate': {
    validation: ValidationConfigs.SIMULATION,
    auth: AuthConfigs.AUTHENTICATED,
    rateLimit: RateLimitConfigs.SIMULATION
  },
  '/api/execute': {
    validation: ValidationConfigs.CRITICAL_OPERATIONS,
    auth: AuthConfigs.CRITICAL,
    rateLimit: RateLimitConfigs.CRITICAL
  },
  '/api/status': {
    validation: ValidationConfigs.PUBLIC_READ,
    auth: AuthConfigs.PUBLIC,
    rateLimit: RateLimitConfigs.PUBLIC_READ
  },
  '/api/risk': {
    validation: ValidationConfigs.SIMULATION,
    auth: AuthConfigs.AUTHENTICATED,
    rateLimit: RateLimitConfigs.GENERAL
  },
  '/api/dashboard': {
    validation: ValidationConfigs.PUBLIC_READ,
    auth: AuthConfigs.AUTHENTICATED,
    rateLimit: RateLimitConfigs.GENERAL
  },
  '/api/discovery': {
    validation: ValidationConfigs.PUBLIC_READ,
    auth: AuthConfigs.PUBLIC,
    rateLimit: RateLimitConfigs.PUBLIC_READ
  }
}

/**
 * Middleware principal de Next.js
 */
export async function middleware(request: NextRequest) {
  const start = Date.now()
  const { pathname, searchParams } = request.nextUrl
  
  const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0] || 
                   request.headers.get('x-real-ip') || 
                   'unknown IP'
  console.log(`🌐 ${request.method} ${pathname} - ${clientIP}`)

  try {
    // Skip middleware for static assets and Next.js internals
    if (shouldSkipMiddleware(pathname)) {
      return NextResponse.next()
    }

    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return handleCORSPreflight(request)
    }

    // Get route configuration
    const config = getRouteConfig(pathname)
    
    if (!config) {
      // No special config, apply basic security headers and continue
      const response = NextResponse.next()
      addSecurityHeaders(response)
      return response
    }

    // Apply rate limiting
    if (config.rateLimit) {
      const rateLimitResult = await config.rateLimit.check(request)
      
      if (!rateLimitResult.success) {
        const response = NextResponse.json(
          {
            success: false,
            error: 'Rate limit exceeded',
            retryAfter: rateLimitResult.retryAfter,
            timestamp: new Date().toISOString()
          },
          { status: 429 }
        )
        
        // Add rate limit headers
        const headers = getRateLimitHeaders(rateLimitResult)
        Object.entries(headers).forEach(([key, value]) => {
          response.headers.set(key, value)
        })
        
        addSecurityHeaders(response)
        return response
      }
    }

    // Apply input validation
    if (config.validation) {
      const validationResult = await validateApiRequest(request, config.validation)
      
      if (!validationResult.success) {
        const response = createValidationResponse(
          validationResult,
          config.validation.cors
        )
        addSecurityHeaders(response)
        return response
      }
    }

    // Apply authentication
    if (config.auth) {
      const authResult = await authenticateRequest(request, config.auth)
      
      if (!authResult.success) {
        const response = NextResponse.json(
          {
            success: false,
            error: authResult.error,
            timestamp: new Date().toISOString()
          },
          { status: authResult.status || 401 }
        )
        
        addSecurityHeaders(response)
        return response
      }
      
      // Add user info to headers for downstream handlers
      if (authResult.user) {
        const userHeaders = new Headers(request.headers)
        userHeaders.set('x-user-address', authResult.user.address)
        userHeaders.set('x-user-role', authResult.user.role)
        userHeaders.set('x-user-permissions', JSON.stringify(authResult.user.permissions))
        
        // Create new request with updated headers
        const newRequest = new NextRequest(request.url, {
          method: request.method,
          headers: userHeaders,
          body: request.body
        })
        
        const response = NextResponse.next({
          request: newRequest
        })
        
        addSecurityHeaders(response)
        return response
      }
    }

    // All checks passed, continue to the API route
    const response = NextResponse.next()
    addSecurityHeaders(response)
    
    // Log request completion
    const duration = Date.now() - start
    console.log(`✅ ${request.method} ${pathname} completed in ${duration}ms`)
    
    return response

  } catch (error: any) {
    console.error('❌ Middleware error:', error)
    
    const response = NextResponse.json(
      {
        success: false,
        error: 'Internal middleware error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
    
    addSecurityHeaders(response)
    return response
  }
}

/**
 * Determinar si se debe saltar el middleware
 */
function shouldSkipMiddleware(pathname: string): boolean {
  const skipPatterns = [
    // Static assets
    '/_next/',
    '/favicon.ico',
    '/robots.txt',
    '/sitemap.xml',
    
    // Public assets
    '/images/',
    '/icons/',
    '/static/',
    
    // Next.js internals
    '/__nextjs_original-stack-frame',
    '/__webpack_hmr'
  ]

  return skipPatterns.some(pattern => pathname.startsWith(pattern))
}

/**
 * Obtener configuración para una ruta específica
 */
function getRouteConfig(pathname: string) {
  // Exact match first
  if (pathname in ROUTE_CONFIGS) {
    return ROUTE_CONFIGS[pathname as keyof typeof ROUTE_CONFIGS]
  }

  // Pattern matching for API routes
  for (const [pattern, config] of Object.entries(ROUTE_CONFIGS)) {
    if (pathname.startsWith(pattern)) {
      return config
    }
  }

  return null
}

/**
 * Manejar requests CORS preflight
 */
function handleCORSPreflight(request: NextRequest): NextResponse {
  
  const origin = request.headers.get('origin') || '*'
  
  const response = new NextResponse(null, { status: 200 })
  
  // Basic CORS headers
  response.headers.set('Access-Control-Allow-Origin', origin)
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 
    'Content-Type, Authorization, X-API-Key, X-Session-ID, X-Requested-With'
  )
  response.headers.set('Access-Control-Max-Age', '86400') // 24 hours
  
  addSecurityHeaders(response)
  return response
}

/**
 * Agregar headers de seguridad estándar
 */
function addSecurityHeaders(response: NextResponse): void {
  
  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  
  // HTTPS enforcement (en producción)
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }
  
  // Content Security Policy
  response.headers.set('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdn.jsdelivr.net; " +
    "style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data: https:; " +
    "connect-src 'self' https: wss:; " +
    "object-src 'none'; " +
    "base-uri 'self';"
  )
  
  // API-specific headers
  response.headers.set('X-Powered-By', 'ArbitrageX Supreme v2.0.0')
  response.headers.set('X-Response-Time', Date.now().toString())
}

/**
 * Configuración para el matcher de Next.js
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets in /images/, /icons/, /static/
     */
    '/((?!_next/static|_next/image|favicon.ico|images/|icons/|static/).*)',
  ],
}
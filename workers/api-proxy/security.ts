// ArbitrageX Supreme V3.3 (RLI) - Security API Proxy Worker
// Maneja solicitudes a la API de seguridad (Anti-Rug System)

import { getBackendUrl } from './utils'
import { logRequest } from './middleware'

export interface TokenSecurityInfo {
  token_address: string
  symbol: string
  security_score: number
  warning_flags: string[]
  is_blacklisted: boolean
  is_whitelisted: boolean
  security_details?: any
}

export interface ApiResponse<T> {
  success: boolean
  message?: string
  data?: T
  timestamp: number
}

export async function handleSecurityRequest(request: Request, env: any): Promise<Response> {
  const url = new URL(request.url)
  const path = url.pathname
  
  // Log request
  logRequest(request, 'security')
  
  // Redirigir al backend basado en la ruta
  try {
    if (path.includes('/token/')) {
      // Solicitud de información de seguridad de token
      return await handleTokenSecurity(request, env)
    } else if (path.includes('/blacklist')) {
      // Solicitud de lista de tokens en blacklist
      return await handleBlacklist(request, env)
    } else if (path.includes('/pair/')) {
      // Solicitud de evaluación de seguridad de par
      return await handlePairSecurity(request, env)
    } else {
      // Ruta no reconocida
      return new Response(JSON.stringify({
        success: false,
        message: 'Invalid security API endpoint',
        timestamp: Date.now()
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS'
        }
      })
    }
  } catch (error) {
    console.error(`Error in security API proxy: ${error}`)
    return new Response(JSON.stringify({
      success: false,
      message: 'Error processing security request',
      error: error.message,
      timestamp: Date.now()
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    })
  }
}

// Handler para información de seguridad de tokens
async function handleTokenSecurity(request: Request, env: any): Promise<Response> {
  const url = new URL(request.url)
  const pathParts = url.pathname.split('/')
  
  // Extraer chain_id y token_address de la URL
  if (pathParts.length < 6) {
    return new Response(JSON.stringify({
      success: false,
      message: 'Invalid token security endpoint',
      timestamp: Date.now()
    }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }
  
  const chainId = pathParts[4]
  const tokenAddress = pathParts[5]
  
  // Verificar que tokenAddress tenga formato de dirección Ethereum
  if (!/^0x[a-fA-F0-9]{40}$/.test(tokenAddress)) {
    return new Response(JSON.stringify({
      success: false,
      message: 'Invalid token address format',
      timestamp: Date.now()
    }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }
  
  // Intentar obtener de caché primero
  const cacheKey = `security:token:${chainId}:${tokenAddress.toLowerCase()}`
  
  // Verificar si tenemos respuesta en cache
  const cachedResponse = await env.SECURITY_CACHE.get(cacheKey)
  if (cachedResponse) {
    return new Response(cachedResponse, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'max-age=300',
        'Access-Control-Allow-Origin': '*',
        'X-Cache': 'HIT'
      }
    })
  }
  
  // Si no hay caché, consultar backend
  const backendUrl = getBackendUrl(env)
  const apiPath = `/api/security/token/${chainId}/${tokenAddress}`
  
  const response = await fetch(`${backendUrl}${apiPath}`, {
    headers: {
      'Accept': 'application/json',
      'X-ArbitrageX-Client': 'cloudflare-worker'
    }
  })
  
  const responseData = await response.text()
  
  // Almacenar en caché si es exitoso
  if (response.ok) {
    // Caché por 5 minutos (300 segundos)
    await env.SECURITY_CACHE.put(cacheKey, responseData, { expirationTtl: 300 })
  }
  
  // Devolver respuesta
  return new Response(responseData, {
    status: response.status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'X-Cache': 'MISS'
    }
  })
}

// Handler para lista de tokens en blacklist
async function handleBlacklist(request: Request, env: any): Promise<Response> {
  // Intentar obtener de caché primero
  const cacheKey = 'security:blacklist'
  
  // Verificar si tenemos respuesta en cache
  const cachedResponse = await env.SECURITY_CACHE.get(cacheKey)
  if (cachedResponse) {
    return new Response(cachedResponse, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'max-age=600', // 10 minutos
        'Access-Control-Allow-Origin': '*',
        'X-Cache': 'HIT'
      }
    })
  }
  
  // Si no hay caché, consultar backend
  const backendUrl = getBackendUrl(env)
  const apiPath = '/api/security/blacklist'
  
  const response = await fetch(`${backendUrl}${apiPath}`, {
    headers: {
      'Accept': 'application/json',
      'X-ArbitrageX-Client': 'cloudflare-worker'
    }
  })
  
  const responseData = await response.text()
  
  // Almacenar en caché si es exitoso
  if (response.ok) {
    // Caché por 10 minutos (600 segundos)
    await env.SECURITY_CACHE.put(cacheKey, responseData, { expirationTtl: 600 })
  }
  
  // Devolver respuesta
  return new Response(responseData, {
    status: response.status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'X-Cache': 'MISS'
    }
  })
}

// Handler para evaluación de seguridad de pares
async function handlePairSecurity(request: Request, env: any): Promise<Response> {
  const url = new URL(request.url)
  const pathParts = url.pathname.split('/')
  
  // Extraer chain_id y pair_id de la URL
  if (pathParts.length < 6) {
    return new Response(JSON.stringify({
      success: false,
      message: 'Invalid pair security endpoint',
      timestamp: Date.now()
    }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }
  
  const chainId = pathParts[4]
  const pairId = pathParts[5]
  
  // Intentar obtener de caché primero
  const cacheKey = `security:pair:${chainId}:${pairId.toLowerCase()}`
  
  // Verificar si tenemos respuesta en cache
  const cachedResponse = await env.SECURITY_CACHE.get(cacheKey)
  if (cachedResponse) {
    return new Response(cachedResponse, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'max-age=300',
        'Access-Control-Allow-Origin': '*',
        'X-Cache': 'HIT'
      }
    })
  }
  
  // Si no hay caché, consultar backend
  const backendUrl = getBackendUrl(env)
  const apiPath = `/api/security/pair/${chainId}/${pairId}`
  
  const response = await fetch(`${backendUrl}${apiPath}`, {
    headers: {
      'Accept': 'application/json',
      'X-ArbitrageX-Client': 'cloudflare-worker'
    }
  })
  
  const responseData = await response.text()
  
  // Almacenar en caché si es exitoso
  if (response.ok) {
    // Caché por 5 minutos (300 segundos)
    await env.SECURITY_CACHE.put(cacheKey, responseData, { expirationTtl: 300 })
  }
  
  // Devolver respuesta
  return new Response(responseData, {
    status: response.status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'X-Cache': 'MISS'
    }
  })
}

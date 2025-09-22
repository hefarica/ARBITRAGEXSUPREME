// ArbitrageX Supreme V3.3 (RLI) - Oracle API Proxy Worker
// Maneja solicitudes a la API de oráculos de precios

import { getBackendUrl } from './utils'
import { logRequest } from './middleware'

export interface OraclePriceResponse {
  base_token: string
  quote_token: string
  price: number
  confidence: number
  sources_count: number
  is_fresh: boolean
  last_verified: number
}

export interface ApiResponse<T> {
  success: boolean
  message?: string
  data?: T
  timestamp: number
}

export async function handleOracleRequest(request: Request, env: any): Promise<Response> {
  const url = new URL(request.url)
  const path = url.pathname
  
  // Log request
  logRequest(request, 'oracle')
  
  // Redirigir al backend basado en la ruta
  try {
    if (path.includes('/price/')) {
      // Solicitud de precio de oráculo
      return await handleOraclePrice(request, env)
    } else if (path.includes('/confidence/')) {
      // Solicitud de confianza de precio
      return await handlePriceConfidence(request, env)
    } else {
      // Ruta no reconocida
      return new Response(JSON.stringify({
        success: false,
        message: 'Invalid oracle API endpoint',
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
    console.error(`Error in oracle API proxy: ${error}`)
    return new Response(JSON.stringify({
      success: false,
      message: 'Error processing oracle request',
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

// Handler para precios de oráculos
async function handleOraclePrice(request: Request, env: any): Promise<Response> {
  const url = new URL(request.url)
  const pathParts = url.pathname.split('/')
  
  // Extraer chain_id, base_token y quote_token de la URL
  if (pathParts.length < 7) {
    return new Response(JSON.stringify({
      success: false,
      message: 'Invalid oracle price endpoint',
      timestamp: Date.now()
    }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }
  
  const chainId = pathParts[4]
  const baseToken = pathParts[5]
  const quoteToken = pathParts[6]
  
  // Intentar obtener de caché primero
  const cacheKey = `oracle:price:${chainId}:${baseToken.toLowerCase()}:${quoteToken.toLowerCase()}`
  
  // Verificar si tenemos respuesta en cache
  const cachedResponse = await env.ORACLE_CACHE.get(cacheKey)
  if (cachedResponse) {
    // Verificar si la caché es reciente (menos de 30 segundos)
    const cachedData = JSON.parse(cachedResponse)
    const cacheTtl = cachedData.cacheTtl || 0
    
    if (Date.now() - cacheTtl < 30000) { // 30 segundos
      return new Response(cachedResponse, {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'max-age=30', // 30 segundos
          'Access-Control-Allow-Origin': '*',
          'X-Cache': 'HIT'
        }
      })
    }
  }
  
  // Si no hay caché o está expirada, consultar backend
  const backendUrl = getBackendUrl(env)
  const apiPath = `/api/oracle/price/${chainId}/${baseToken}/${quoteToken}`
  
  const response = await fetch(`${backendUrl}${apiPath}`, {
    headers: {
      'Accept': 'application/json',
      'X-ArbitrageX-Client': 'cloudflare-worker'
    }
  })
  
  let responseData = await response.text()
  
  // Almacenar en caché si es exitoso
  if (response.ok) {
    try {
      // Añadir timestamp de caché a la respuesta
      const jsonData = JSON.parse(responseData)
      jsonData.cacheTtl = Date.now()
      responseData = JSON.stringify(jsonData)
      
      // Caché por 30 segundos - precios cambian rápidamente
      await env.ORACLE_CACHE.put(cacheKey, responseData, { expirationTtl: 30 })
    } catch (e) {
      console.error('Error parsing oracle response', e)
    }
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

// Handler para confianza de precios
async function handlePriceConfidence(request: Request, env: any): Promise<Response> {
  const url = new URL(request.url)
  const pathParts = url.pathname.split('/')
  
  // Extraer chain_id, token_a y token_b de la URL
  if (pathParts.length < 7) {
    return new Response(JSON.stringify({
      success: false,
      message: 'Invalid price confidence endpoint',
      timestamp: Date.now()
    }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }
  
  const chainId = pathParts[4]
  const tokenA = pathParts[5]
  const tokenB = pathParts[6]
  
  // El parámetro dex_price_ratio es obligatorio
  const dexPriceRatio = url.searchParams.get('dex_price_ratio')
  
  if (!dexPriceRatio) {
    return new Response(JSON.stringify({
      success: false,
      message: 'Missing required dex_price_ratio parameter',
      timestamp: Date.now()
    }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }
  
  // No cacheamos esta llamada ya que depende de un precio en DEX que es específico
  // para cada solicitud y puede cambiar rápidamente
  
  // Consultar backend
  const backendUrl = getBackendUrl(env)
  const apiPath = `/api/oracle/confidence/${chainId}/${tokenA}/${tokenB}?dex_price_ratio=${dexPriceRatio}`
  
  const response = await fetch(`${backendUrl}${apiPath}`, {
    headers: {
      'Accept': 'application/json',
      'X-ArbitrageX-Client': 'cloudflare-worker'
    }
  })
  
  const responseData = await response.text()
  
  // Devolver respuesta
  return new Response(responseData, {
    status: response.status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  })
}

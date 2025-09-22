// ArbitrageX Supreme V3.3 (RLI) - Liquidity API Proxy Worker
// Maneja solicitudes a la API de análisis de liquidez

import { getBackendUrl } from './utils'
import { logRequest } from './middleware'

export interface LiquidityDepthAnalysis {
  pair_id: string
  chain_id: number
  dex_name: string
  token0_symbol: string
  token1_symbol: string
  impact_metrics: Array<{
    amount_usd: number
    impact_percent: number
    direction: 'buy' | 'sell'
  }>
  avg_slippage_per_1k_usd: number
  max_single_trade_usd: number
  liquidity_distribution_score: number
  overall_health_score: number
  last_updated: string
}

export interface ApiResponse<T> {
  success: boolean
  message?: string
  data?: T
  timestamp: number
}

export async function handleLiquidityRequest(request: Request, env: any): Promise<Response> {
  const url = new URL(request.url)
  const path = url.pathname
  
  // Log request
  logRequest(request, 'liquidity')
  
  // Redirigir al backend basado en la ruta
  try {
    if (path.includes('/depth/')) {
      // Solicitud de análisis de profundidad de liquidez
      return await handleLiquidityDepth(request, env)
    } else if (path.includes('/concentration/')) {
      // Solicitud de análisis de concentración de liquidez
      return await handleLiquidityConcentration(request, env)
    } else if (path.includes('/top-pairs')) {
      // Solicitud de mejores pares por liquidez
      return await handleTopLiquidityPairs(request, env)
    } else {
      // Ruta no reconocida
      return new Response(JSON.stringify({
        success: false,
        message: 'Invalid liquidity API endpoint',
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
    console.error(`Error in liquidity API proxy: ${error}`)
    return new Response(JSON.stringify({
      success: false,
      message: 'Error processing liquidity request',
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

// Handler para análisis de profundidad de liquidez
async function handleLiquidityDepth(request: Request, env: any): Promise<Response> {
  const url = new URL(request.url)
  const pathParts = url.pathname.split('/')
  
  // Extraer chain_id y pair_id de la URL
  if (pathParts.length < 6) {
    return new Response(JSON.stringify({
      success: false,
      message: 'Invalid liquidity depth endpoint',
      timestamp: Date.now()
    }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }
  
  const chainId = pathParts[4]
  const pairId = pathParts[5]
  
  // Intentar obtener de caché primero
  const cacheKey = `liquidity:depth:${chainId}:${pairId.toLowerCase()}`
  
  // Verificar si tenemos respuesta en cache
  const cachedResponse = await env.LIQUIDITY_CACHE.get(cacheKey)
  if (cachedResponse) {
    return new Response(cachedResponse, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'max-age=120', // 2 minutos
        'Access-Control-Allow-Origin': '*',
        'X-Cache': 'HIT'
      }
    })
  }
  
  // Si no hay caché, consultar backend
  const backendUrl = getBackendUrl(env)
  const apiPath = `/api/liquidity/depth/${chainId}/${pairId}`
  
  const response = await fetch(`${backendUrl}${apiPath}`, {
    headers: {
      'Accept': 'application/json',
      'X-ArbitrageX-Client': 'cloudflare-worker'
    }
  })
  
  const responseData = await response.text()
  
  // Almacenar en caché si es exitoso
  if (response.ok) {
    // Caché por 2 minutos (120 segundos) - la liquidez cambia rápido
    await env.LIQUIDITY_CACHE.put(cacheKey, responseData, { expirationTtl: 120 })
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

// Handler para análisis de concentración de liquidez
async function handleLiquidityConcentration(request: Request, env: any): Promise<Response> {
  const url = new URL(request.url)
  const pathParts = url.pathname.split('/')
  
  // Extraer chain_id y pair_id de la URL
  if (pathParts.length < 6) {
    return new Response(JSON.stringify({
      success: false,
      message: 'Invalid liquidity concentration endpoint',
      timestamp: Date.now()
    }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }
  
  const chainId = pathParts[4]
  const pairId = pathParts[5]
  
  // Intentar obtener de caché primero
  const cacheKey = `liquidity:concentration:${chainId}:${pairId.toLowerCase()}`
  
  // Verificar si tenemos respuesta en cache
  const cachedResponse = await env.LIQUIDITY_CACHE.get(cacheKey)
  if (cachedResponse) {
    return new Response(cachedResponse, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'max-age=300', // 5 minutos
        'Access-Control-Allow-Origin': '*',
        'X-Cache': 'HIT'
      }
    })
  }
  
  // Si no hay caché, consultar backend
  const backendUrl = getBackendUrl(env)
  const apiPath = `/api/liquidity/concentration/${chainId}/${pairId}`
  
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
    await env.LIQUIDITY_CACHE.put(cacheKey, responseData, { expirationTtl: 300 })
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

// Handler para mejores pares por liquidez
async function handleTopLiquidityPairs(request: Request, env: any): Promise<Response> {
  const url = new URL(request.url)
  
  // Obtener parámetros de consulta
  const limit = url.searchParams.get('limit') || '10'
  
  // Intentar obtener de caché primero
  const cacheKey = `liquidity:top-pairs:${limit}`
  
  // Verificar si tenemos respuesta en cache
  const cachedResponse = await env.LIQUIDITY_CACHE.get(cacheKey)
  if (cachedResponse) {
    return new Response(cachedResponse, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'max-age=180', // 3 minutos
        'Access-Control-Allow-Origin': '*',
        'X-Cache': 'HIT'
      }
    })
  }
  
  // Si no hay caché, consultar backend
  const backendUrl = getBackendUrl(env)
  const apiPath = `/api/liquidity/top-pairs?limit=${limit}`
  
  const response = await fetch(`${backendUrl}${apiPath}`, {
    headers: {
      'Accept': 'application/json',
      'X-ArbitrageX-Client': 'cloudflare-worker'
    }
  })
  
  const responseData = await response.text()
  
  // Almacenar en caché si es exitoso
  if (response.ok) {
    // Caché por 3 minutos (180 segundos)
    await env.LIQUIDITY_CACHE.put(cacheKey, responseData, { expirationTtl: 180 })
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

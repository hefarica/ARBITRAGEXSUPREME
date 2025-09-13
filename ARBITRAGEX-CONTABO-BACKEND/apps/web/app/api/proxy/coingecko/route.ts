import { NextRequest, NextResponse } from 'next/server'

// Proxy para CoinGecko API - resuelve problemas de CORS
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const ids = searchParams.get('ids')
  const vs_currencies = searchParams.get('vs_currencies') || 'usd'
  const include_24hr_change = searchParams.get('include_24hr_change') || 'true'

  if (!ids) {
    return NextResponse.json({
      error: 'Missing required parameter: ids'
    }, { status: 400 })
  }

  try {
    // Usar la API pública de CoinGecko a través del servidor Next.js (sin CORS)
    const coingeckoUrl = new URL('https://api.coingecko.com/api/v3/simple/price')
    coingeckoUrl.searchParams.set('ids', ids)
    coingeckoUrl.searchParams.set('vs_currencies', vs_currencies)
    coingeckoUrl.searchParams.set('include_24hr_change', include_24hr_change)

    const response = await fetch(coingeckoUrl.toString(), {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'ArbitrageX-Pro/1.0',
      },
      // Cache por 60 segundos
      next: { revalidate: 60 }
    })

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()

    // Agregar headers de CORS
    return NextResponse.json(data, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Cache-Control': 's-maxage=60, stale-while-revalidate=300', // Cache 1 min
      }
    })

  } catch (error) {
    console.error('CoinGecko proxy error:', error)
    
    return NextResponse.json({
      error: 'Failed to fetch from CoinGecko',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { 
      status: 502,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    })
  }
}

// Manejar preflight OPTIONS para CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  })
}
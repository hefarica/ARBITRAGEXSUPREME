import { NextRequest, NextResponse } from 'next/server'

// Endpoint para obtener precios desde el sistema de arbitraje
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params

  try {
    // CONEXIÓN REAL AL BACKEND DE ARBITRAJE
    // TODO: Reemplazar con la URL real del sistema de arbitraje
    const arbitrageBackendUrl = process.env.ARBITRAGE_BACKEND_URL || 'http://localhost:8080'
    
    const response = await fetch(`${arbitrageBackendUrl}/api/prices/${symbol}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.ARBITRAGE_API_KEY || ''}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Arbitrage backend error: ${response.status}`)
    }

    const data = await response.json()

    return NextResponse.json({
      success: true,
      price: data.price,
      change24h: data.change24h,
      symbol: symbol,
      source: 'arbitrage_backend',
      timestamp: Date.now()
    })

  } catch (error) {
    console.error(`Error fetching price from arbitrage backend for ${symbol}:`, error)
    
    // Retornar error para que el frontend use el fallback de CoinGecko
    return NextResponse.json({
      success: false,
      error: 'Arbitrage backend unavailable',
      symbol: symbol
    }, { status: 503 })
  }
}
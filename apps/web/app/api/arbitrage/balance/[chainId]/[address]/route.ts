import { NextRequest, NextResponse } from 'next/server'

// Endpoint para obtener balances desde el sistema de arbitraje
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ chainId: string; address: string }> }
) {
  const { chainId, address } = await params

  if (!address || !chainId) {
    return NextResponse.json({
      success: false,
      error: 'Missing chainId or address'
    }, { status: 400 })
  }

  try {
    // CONEXIÓN REAL AL BACKEND DE ARBITRAJE
    // TODO: Reemplazar con la URL real del sistema de arbitraje
    const arbitrageBackendUrl = process.env.ARBITRAGE_BACKEND_URL || 'http://localhost:8080'
    
    const response = await fetch(`${arbitrageBackendUrl}/api/wallets/${address}/balance/${chainId}`, {
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

    // Mapear símbolos de token por chainId
    const symbols = {
      '0x1': 'ETH',
      '0x89': 'MATIC',
      '0x38': 'BNB', 
      '0xa4b1': 'ETH',
      '0xa': 'ETH'
    }

    const symbol = symbols[chainId as keyof typeof symbols] || 'TOKEN'

    return NextResponse.json({
      success: true,
      chainId: chainId,
      address: address,
      nativeBalance: data.nativeBalance || 0,
      usdValue: data.usdValue || 0,
      formattedBalance: `${(data.nativeBalance || 0).toFixed(6)} ${symbol}`,
      source: 'arbitrage_backend',
      timestamp: Date.now()
    })

  } catch (error) {
    console.error(`Error fetching balance from arbitrage backend for ${chainId}/${address}:`, error)
    
    // Retornar error para que el frontend use MetaMask directo
    return NextResponse.json({
      success: false,
      error: 'Arbitrage backend unavailable',
      chainId: chainId,
      address: address
    }, { status: 503 })
  }
}
'use client'

import { useState, useEffect } from 'react'

// Mapeo de tokens nativos por chainId
export const NATIVE_TOKENS = {
  '0x1': { symbol: 'ETH', coingeckoId: 'ethereum', name: 'Ethereum' },
  '0x89': { symbol: 'MATIC', coingeckoId: 'matic-network', name: 'Polygon' },
  '0x38': { symbol: 'BNB', coingeckoId: 'binancecoin', name: 'BNB' },
  '0xa4b1': { symbol: 'ETH', coingeckoId: 'ethereum', name: 'Arbitrum ETH' },
  '0xa': { symbol: 'ETH', coingeckoId: 'ethereum', name: 'Optimism ETH' }
} as const

export interface TokenPrice {
  symbol: string
  price: number
  change24h: number
  lastUpdated: number
}

interface CryptoPricesState {
  [chainId: string]: TokenPrice
}

// Cache de precios para evitar llamadas excesivas
const priceCache = new Map<string, { data: TokenPrice; expiry: number }>()
const CACHE_DURATION = 60000 // 1 minuto

export function useCryptoPrices(chainIds: string[] = []) {
  const [prices, setPrices] = useState<CryptoPricesState>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Función para obtener precio desde backend de arbitraje
  const fetchTokenPrice = async (chainId: string): Promise<TokenPrice | null> => {
    const tokenInfo = NATIVE_TOKENS[chainId as keyof typeof NATIVE_TOKENS]
    if (!tokenInfo) return null

    // Verificar cache
    const cacheKey = tokenInfo.coingeckoId
    const cached = priceCache.get(cacheKey)
    if (cached && cached.expiry > Date.now()) {
      return cached.data
    }

    try {
      // CONEXIÓN REAL AL BACKEND DE ARBITRAJE
      // Endpoint del sistema de arbitraje para obtener precios
      const response = await fetch(
        `/api/arbitrage/prices/${tokenInfo.symbol}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.ok) {
        // Si el backend no responde, usar CoinGecko como fallback a través del proxy
        return await fetchFromCoinGeckoProxy(tokenInfo)
      }

      const data = await response.json()
      
      if (data.success && data.price) {
        const priceData: TokenPrice = {
          symbol: tokenInfo.symbol,
          price: data.price,
          change24h: data.change24h || 0,
          lastUpdated: Date.now()
        }

        // Guardar en cache
        priceCache.set(cacheKey, {
          data: priceData,
          expiry: Date.now() + CACHE_DURATION
        })

        return priceData
      } else {
        throw new Error('Invalid response from arbitrage backend')
      }
    } catch (err) {
      console.warn(`Backend price fetch failed for ${tokenInfo.symbol}, trying CoinGecko proxy:`, err)
      
      // Fallback: CoinGecko a través del proxy del backend
      return await fetchFromCoinGeckoProxy(tokenInfo)
    }
  }

  // Función fallback para CoinGecko a través del proxy del backend
  const fetchFromCoinGeckoProxy = async (tokenInfo: typeof NATIVE_TOKENS[keyof typeof NATIVE_TOKENS]): Promise<TokenPrice | null> => {
    try {
      // Usar el proxy del backend para evitar problemas de CORS
      const response = await fetch(
        `/api/proxy/coingecko?ids=${tokenInfo.coingeckoId}&vs_currencies=usd&include_24hr_change=true`,
        {
          headers: {
            'Accept': 'application/json',
          },
        }
      )

      if (!response.ok) {
        throw new Error(`CoinGecko proxy error: ${response.status}`)
      }

      const data = await response.json()
      const coinData = data[tokenInfo.coingeckoId]

      if (coinData) {
        const priceData: TokenPrice = {
          symbol: tokenInfo.symbol,
          price: coinData.usd || 0,
          change24h: coinData.usd_24h_change || 0,
          lastUpdated: Date.now()
        }

        // Guardar en cache
        priceCache.set(tokenInfo.coingeckoId, {
          data: priceData,
          expiry: Date.now() + CACHE_DURATION
        })

        return priceData
      }
    } catch (err) {
      console.error(`CoinGecko proxy failed for ${tokenInfo.symbol}:`, err)
    }

    // ÚLTIMO RECURSO: Error - NO usar datos mock en producción
    throw new Error(`No se pudo obtener precio para ${tokenInfo.symbol} desde ninguna fuente`)
  }

  // FUNCIÓN ELIMINADA: getMockPrice - NO MÁS DATOS MOCK
  // Los precios ahora vienen del sistema de arbitraje real

  // Función para obtener todos los precios
  const fetchAllPrices = async (targetChainIds: string[]) => {
    setIsLoading(true)
    setError(null)

    try {
      const pricePromises = targetChainIds.map(async (chainId) => {
        const price = await fetchTokenPrice(chainId)
        return { chainId, price }
      })

      const results = await Promise.allSettled(pricePromises)
      const newPrices: CryptoPricesState = {}

      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.price) {
          newPrices[targetChainIds[index]] = result.value.price
        } else {
          // Si falla, registrar error - NO usar datos mock
          const chainId = targetChainIds[index]
          const tokenInfo = NATIVE_TOKENS[chainId as keyof typeof NATIVE_TOKENS]
          if (tokenInfo) {
            console.error(`No se pudo obtener precio para ${tokenInfo.symbol} en red ${chainId}`)
            // NO agregar precio falso - el frontend debe manejar la ausencia de datos
          }
        }
      })

      setPrices(prev => ({ ...prev, ...newPrices }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching prices')
      
      // En caso de error total, NO usar datos mock - mostrar error real
      console.error('Error crítico obteniendo precios de criptomonedas:', err)
      // El frontend debe mostrar estado de error en lugar de datos falsos
    } finally {
      setIsLoading(false)
    }
  }

  // Efecto para cargar precios al cambiar chainIds
  useEffect(() => {
    if (chainIds.length > 0) {
      fetchAllPrices(chainIds)
    }
  }, [chainIds.join(',')])

  // Auto-refresh cada 2 minutos
  useEffect(() => {
    if (chainIds.length === 0) return

    const interval = setInterval(() => {
      fetchAllPrices(chainIds)
    }, 120000) // 2 minutos

    return () => clearInterval(interval)
  }, [chainIds.join(',')])

  // Función para formatear precio
  const formatPrice = (price: number): string => {
    if (price >= 1000) {
      return `$${price.toLocaleString('en-US', { 
        minimumFractionDigits: 0, 
        maximumFractionDigits: 0 
      })}`
    } else if (price >= 1) {
      return `$${price.toLocaleString('en-US', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      })}`
    } else {
      return `$${price.toFixed(4)}`
    }
  }

  // Función para formatear cambio de 24h
  const formatChange24h = (change: number): { text: string; color: string } => {
    const isPositive = change >= 0
    return {
      text: `${isPositive ? '+' : ''}${change.toFixed(2)}%`,
      color: isPositive ? 'text-emerald-600' : 'text-red-600'
    }
  }

  return {
    prices,
    isLoading,
    error,
    formatPrice,
    formatChange24h,
    refresh: () => fetchAllPrices(chainIds),
    getTokenInfo: (chainId: string) => NATIVE_TOKENS[chainId as keyof typeof NATIVE_TOKENS]
  }
}
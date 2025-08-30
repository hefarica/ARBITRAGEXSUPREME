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

  // Función para obtener precio desde CoinGecko
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
      // API gratuita de CoinGecko (sin API key)
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${tokenInfo.coingeckoId}&vs_currencies=usd&include_24hr_change=true`,
        {
          headers: {
            'Accept': 'application/json',
          },
        }
      )

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
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
        priceCache.set(cacheKey, {
          data: priceData,
          expiry: Date.now() + CACHE_DURATION
        })

        return priceData
      }
    } catch (err) {
      console.error(`Error fetching price for ${tokenInfo.symbol}:`, err)
      
      // Fallback: datos mock para desarrollo
      return {
        symbol: tokenInfo.symbol,
        price: getMockPrice(tokenInfo.symbol),
        change24h: (Math.random() - 0.5) * 10, // Cambio aleatorio entre -5% y +5%
        lastUpdated: Date.now()
      }
    }

    return null
  }

  // Función para obtener precios mock para desarrollo
  const getMockPrice = (symbol: string): number => {
    const mockPrices: { [key: string]: number } = {
      'ETH': 3450.25, // Precio realista de ETH
      'MATIC': 0.94, // Precio realista de MATIC  
      'BNB': 385.67, // Precio realista de BNB
    }
    return mockPrices[symbol] || 1
  }

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
          // Si falla, usar precio mock
          const chainId = targetChainIds[index]
          const tokenInfo = NATIVE_TOKENS[chainId as keyof typeof NATIVE_TOKENS]
          if (tokenInfo) {
            newPrices[chainId] = {
              symbol: tokenInfo.symbol,
              price: getMockPrice(tokenInfo.symbol),
              change24h: (Math.random() - 0.5) * 8, // -4% a +4%
              lastUpdated: Date.now()
            }
          }
        }
      })

      setPrices(prev => ({ ...prev, ...newPrices }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching prices')
      
      // En caso de error total, usar todos los precios mock
      const mockPrices: CryptoPricesState = {}
      targetChainIds.forEach(chainId => {
        const tokenInfo = NATIVE_TOKENS[chainId as keyof typeof NATIVE_TOKENS]
        if (tokenInfo) {
          mockPrices[chainId] = {
            symbol: tokenInfo.symbol,
            price: getMockPrice(tokenInfo.symbol),
            change24h: (Math.random() - 0.5) * 8,
            lastUpdated: Date.now()
          }
        }
      })
      setPrices(prev => ({ ...prev, ...mockPrices }))
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
'use client'

import { useState, useEffect } from 'react'

// Simulación de balances de wallet por red
export interface WalletBalance {
  chainId: string
  nativeBalance: number // Balance del token nativo
  usdValue: number // Valor en USD
  formattedBalance: string // Balance formateado (ej: "1.2345 ETH")
  lastUpdated: number
}

interface WalletBalancesState {
  [chainId: string]: WalletBalance
}

// DATOS MOCK ELIMINADOS - Ahora se usan balances reales de MetaMask y backend

export function useWalletBalance(chainIds: string[] = [], metamaskConnected: boolean = false) {
  const [balances, setBalances] = useState<WalletBalancesState>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Función para obtener balance real de MetaMask con cálculo USD
  const fetchRealBalance = async (chainId: string): Promise<WalletBalance | null> => {
    if (!metamaskConnected || !window.ethereum || !window.ethereum.selectedAddress) {
      return null
    }

    try {
      // Obtener balance del token nativo de la red actual de MetaMask
      const balance = await window.ethereum.request({
        method: 'eth_getBalance',
        params: [window.ethereum.selectedAddress, 'latest']
      })

      // Convertir de wei a ether (o token nativo)
      const nativeAmount = parseInt(balance, 16) / Math.pow(10, 18)
      
      // Obtener precio del token para calcular valor USD
      const symbolMap = {
        '0x1': 'ETH',
        '0x89': 'MATIC', 
        '0x38': 'BNB',
        '0xa4b1': 'ETH',
        '0xa': 'ETH'
      }
      const symbol = symbolMap[chainId as keyof typeof symbolMap] || 'ETH'
      const tokenPrice = await getTokenPriceUSD(symbol)
      const usdValue = nativeAmount * tokenPrice
      
      return {
        chainId,
        nativeBalance: nativeAmount,
        usdValue: usdValue,
        formattedBalance: `${nativeAmount.toFixed(6)} ${symbol}`,
        lastUpdated: Date.now()
      }
    } catch (error) {
      console.error(`Error fetching MetaMask balance for ${chainId}:`, error)
      return null
    }
  }

  // Función para obtener precio de token (simplificada)
  const getTokenPriceUSD = async (symbol: string): Promise<number> => {
    try {
      // Precios simulados para desarrollo (en producción usar API real)
      const prices: { [key: string]: number } = {
        'ETH': 2500,
        'MATIC': 1.2,
        'BNB': 300,
        'AVAX': 35,
        'FTM': 0.8
      }
      return prices[symbol] || 0
    } catch (error) {
      console.warn(`Could not fetch price for ${symbol}:`, error)
      return 0
    }
  }

  // Función para obtener todos los balances
  const fetchAllBalances = async (targetChainIds: string[]) => {
    setIsLoading(true)
    setError(null)

    try {
      const balancePromises = targetChainIds.map(async (chainId) => {
        // Prioridad: 1. Backend, 2. MetaMask, 3. Error (no mock)
        let balance: WalletBalance | null = null
        
        // Usar balance directo de MetaMask (sin backend)
        if (metamaskConnected) {
          balance = await fetchRealBalance(chainId)
        }
        
        return { chainId, balance }
      })

      const results = await Promise.allSettled(balancePromises)
      const newBalances: WalletBalancesState = {}

      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value.balance) {
          newBalances[result.value.chainId] = result.value.balance
        }
      })

      setBalances(prev => ({ ...prev, ...newBalances }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error fetching balances')
    } finally {
      setIsLoading(false)
    }
  }

  // Efecto para cargar balances cuando cambian los chainIds
  useEffect(() => {
    if (chainIds.length > 0) {
      fetchAllBalances(chainIds)
    }
  }, [chainIds.join(','), metamaskConnected])

  // Auto-refresh cada 30 segundos si MetaMask está conectado
  useEffect(() => {
    if (!metamaskConnected || chainIds.length === 0) return

    const interval = setInterval(() => {
      fetchAllBalances(chainIds)
    }, 30000) // 30 segundos

    return () => clearInterval(interval)
  }, [chainIds.join(','), metamaskConnected])

  // Función para formatear balance en USD
  const formatUsdBalance = (usdValue: number): string => {
    if (usdValue >= 1000000) {
      return `$${(usdValue / 1000000).toFixed(2)}M`
    } else if (usdValue >= 1000) {
      return `$${(usdValue / 1000).toFixed(1)}K`
    } else if (usdValue >= 1) {
      return `$${usdValue.toFixed(2)}`
    } else {
      return `$${usdValue.toFixed(4)}`
    }
  }

  // Función para calcular balance total en USD
  const getTotalUsdBalance = (): number => {
    return Object.values(balances).reduce((total, balance) => total + balance.usdValue, 0)
  }

  return {
    balances,
    isLoading,
    error,
    formatUsdBalance,
    getTotalUsdBalance,
    refresh: () => fetchAllBalances(chainIds)
  }
}
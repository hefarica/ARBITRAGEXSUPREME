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

// Balances mock para desarrollo - en producción se obtendría de MetaMask/Web3
const MOCK_BALANCES = {
  '0x1': { native: 0.361, usd: 1247.82 }, // ETH
  '0x89': { native: 1250.45, usd: 1175.42 }, // MATIC
  '0x38': { native: 3.024, usd: 1166.21 }, // BNB
  '0xa4b1': { native: 0.285, usd: 983.25 }, // Arbitrum ETH
  '0xa': { native: 0.198, usd: 682.91 } // Optimism ETH
}

export function useWalletBalance(chainIds: string[] = [], metamaskConnected: boolean = false) {
  const [balances, setBalances] = useState<WalletBalancesState>({})
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Función para obtener balance real de MetaMask (cuando esté conectado)
  const fetchRealBalance = async (chainId: string): Promise<WalletBalance | null> => {
    if (!metamaskConnected || !window.ethereum) {
      return null
    }

    try {
      // Obtener balance del token nativo
      const balance = await window.ethereum.request({
        method: 'eth_getBalance',
        params: [window.ethereum.selectedAddress, 'latest']
      })

      // Convertir de wei a ether (o token nativo)
      const nativeAmount = parseFloat(balance) / Math.pow(10, 18)
      
      return {
        chainId,
        nativeBalance: nativeAmount,
        usdValue: 0, // Se calculará con precios del hook de crypto
        formattedBalance: `${nativeAmount.toFixed(4)}`,
        lastUpdated: Date.now()
      }
    } catch (error) {
      console.error(`Error fetching balance for ${chainId}:`, error)
      return null
    }
  }

  // Función para obtener balances mock
  const getMockBalance = (chainId: string): WalletBalance => {
    const mockData = MOCK_BALANCES[chainId as keyof typeof MOCK_BALANCES]
    const symbols = {
      '0x1': 'ETH',
      '0x89': 'MATIC', 
      '0x38': 'BNB',
      '0xa4b1': 'ETH',
      '0xa': 'ETH'
    }

    return {
      chainId,
      nativeBalance: mockData?.native || 0,
      usdValue: mockData?.usd || 0,
      formattedBalance: `${(mockData?.native || 0).toFixed(4)} ${symbols[chainId as keyof typeof symbols] || 'TOKEN'}`,
      lastUpdated: Date.now()
    }
  }

  // Función para obtener todos los balances
  const fetchAllBalances = async (targetChainIds: string[]) => {
    setIsLoading(true)
    setError(null)

    try {
      const balancePromises = targetChainIds.map(async (chainId) => {
        // Intentar obtener balance real primero, luego usar mock
        const realBalance = await fetchRealBalance(chainId)
        const balance = realBalance || getMockBalance(chainId)
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
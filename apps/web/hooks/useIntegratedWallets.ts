'use client'

import { useState, useEffect, useCallback } from 'react'
import { useMetaMaskOptimized } from '@/hooks/useMetaMaskOptimized'

// Interfaces TypeScript para Billeteras Integradas
export interface WalletInfo {
  id: string
  name: string
  address: string
  network: string
  type: 'hot' | 'cold' | 'hardware' | 'multisig'
  status: 'active' | 'inactive' | 'compromised' | 'monitoring'
  balance_usd: number
  native_balance: number
  native_token: string
  token_count: number
  last_activity: string
  created_at: string
  is_connected: boolean
  risk_level: 'low' | 'medium' | 'high'
  is_metamask?: boolean // Nuevo campo para identificar MetaMask
}

export interface WalletToken {
  token_address: string
  symbol: string
  name: string
  balance: number
  balance_usd: number
  price_usd: number
  change_24h: number
  network: string
}

export interface WalletStats {
  total_wallets: number
  active_wallets: number
  total_balance_usd: number
  total_tokens: number
  hot_wallets: number
  cold_wallets: number
  average_balance: number
  highest_balance: number
}

// Mapeo de chainId a nombre de red
const NETWORK_MAPPING: { [key: string]: string } = {
  '0x1': 'ethereum',
  '0x89': 'polygon',
  '0x38': 'bsc',
  '0xa4b1': 'arbitrum',
  '0xa': 'optimism'
}

// Mapeo de chainId a token nativo
const TOKEN_MAPPING: { [key: string]: string } = {
  '0x1': 'ETH',
  '0x89': 'MATIC',
  '0x38': 'BNB',
  '0xa4b1': 'ETH',
  '0xa': 'ETH'
}

// Mapeo de red a nombre completo del token
const TOKEN_NAME_MAPPING: { [key: string]: string } = {
  'ethereum': 'Ethereum',
  'polygon': 'Polygon',
  'bsc': 'Binance Coin',
  'arbitrum': 'Ethereum (Arbitrum)',
  'optimism': 'Ethereum (Optimism)'
}

// Precio estimado en USD para cálculos rápidos (debería venir de una API real)
const ESTIMATED_PRICES: { [key: string]: number } = {
  'ETH': 2400,
  'MATIC': 0.8,
  'BNB': 240
}

export function useIntegratedWallets() {
  const [apiWallets, setApiWallets] = useState<WalletInfo[]>([])
  const [allWallets, setAllWallets] = useState<WalletInfo[]>([])
  const [tokens, setTokens] = useState<{ [walletId: string]: WalletToken[] }>({})
  const [stats, setStats] = useState<WalletStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  // Hook de MetaMask optimizado
  const metamask = useMetaMaskOptimized()

  // Función para crear billetera de MetaMask automáticamente
  const createMetaMaskWallet = useCallback((): WalletInfo | null => {
    if (!metamask.isConnected || !metamask.address) return null

    const networkName = NETWORK_MAPPING[metamask.chainId || '0x1'] || 'ethereum'
    const nativeToken = TOKEN_MAPPING[metamask.chainId || '0x1'] || 'ETH'
    const estimatedPrice = ESTIMATED_PRICES[nativeToken] || 2400

    return {
      id: `metamask-${metamask.address.toLowerCase()}`,
      name: `MetaMask (${metamask.chainName})`,
      address: metamask.address,
      network: networkName,
      type: 'hot',
      status: 'active',
      balance_usd: (parseFloat(metamask.balance || '0')) * estimatedPrice,
      native_balance: parseFloat(metamask.balance || '0'),
      native_token: nativeToken,
      token_count: 1,
      last_activity: new Date().toISOString(),
      created_at: new Date().toISOString(),
      is_connected: true,
      risk_level: 'low',
      is_metamask: true
    }
  }, [metamask.isConnected, metamask.address, metamask.chainId, metamask.chainName, metamask.balance])

  // Función para crear token nativo de MetaMask
  const createMetaMaskToken = useCallback((wallet: WalletInfo): WalletToken => {
    return {
      token_address: '0x0000000000000000000000000000000000000000',
      symbol: wallet.native_token,
      name: TOKEN_NAME_MAPPING[wallet.network] || 'Ethereum',
      balance: wallet.native_balance,
      balance_usd: wallet.balance_usd,
      price_usd: wallet.balance_usd > 0 ? wallet.balance_usd / wallet.native_balance : 0,
      change_24h: 0, // No tenemos datos históricos en tiempo real
      network: wallet.network
    }
  }, [])

  // Función para obtener billeteras de API
  const fetchApiWallets = useCallback(async () => {
    try {
      const walletsResponse = await fetch('/api/proxy/api/v2/wallets/list')
      if (walletsResponse.ok) {
        const walletsData = await walletsResponse.json()
        return walletsData.data || walletsData.wallets || []
      }
    } catch (error) {
      console.log('API de billeteras no disponible:', error)
    }
    return []
  }, [])

  // Función para obtener estadísticas de API
  const fetchApiStats = useCallback(async () => {
    try {
      const statsResponse = await fetch('/api/proxy/api/v2/wallets/stats')
      if (statsResponse.ok) {
        const statsData = await statsResponse.json()
        return statsData.data || statsData
      }
    } catch (error) {
      console.log('API de estadísticas no disponible:', error)
    }
    return null
  }, [])

  // Función para calcular estadísticas combinadas
  const calculateCombinedStats = useCallback((wallets: WalletInfo[]): WalletStats => {
    return {
      total_wallets: wallets.length,
      active_wallets: wallets.filter(w => w.status === 'active').length,
      total_balance_usd: wallets.reduce((sum, w) => sum + w.balance_usd, 0),
      total_tokens: wallets.reduce((sum, w) => sum + w.token_count, 0),
      hot_wallets: wallets.filter(w => w.type === 'hot').length,
      cold_wallets: wallets.filter(w => w.type === 'cold').length,
      average_balance: wallets.length > 0 
        ? wallets.reduce((sum, w) => sum + w.balance_usd, 0) / wallets.length 
        : 0,
      highest_balance: Math.max(...wallets.map(w => w.balance_usd), 0)
    }
  }, [])

  // Función principal para obtener y combinar datos
  const fetchIntegratedData = useCallback(async () => {
    try {
      setError(null)

      // Obtener billeteras de API
      const apiWalletsData = await fetchApiWallets()
      setApiWallets(apiWalletsData)

      // Crear lista combinada
      let combinedWallets = [...apiWalletsData]

      // Agregar MetaMask si está conectado
      const metamaskWallet = createMetaMaskWallet()
      if (metamaskWallet) {
        // Verificar si MetaMask ya existe en la API
        const existsInApi = apiWalletsData.some((wallet: { address: string }) => 
          wallet.address.toLowerCase() === metamaskWallet.address.toLowerCase()
        )

        if (!existsInApi) {
          // Agregar MetaMask al inicio de la lista
          combinedWallets.unshift(metamaskWallet)
        }
      }

      setAllWallets(combinedWallets)

      // Obtener tokens para cada billetera
      const tokensData: { [walletId: string]: WalletToken[] } = {}
      
      for (const wallet of combinedWallets.slice(0, 5)) {
        if (wallet.is_metamask) {
          // Para MetaMask, crear token nativo automáticamente
          tokensData[wallet.id] = [createMetaMaskToken(wallet)]
        } else {
          // Para billeteras de API, obtener tokens normalmente
          try {
            const tokensResponse = await fetch(`/api/proxy/api/v2/wallets/${wallet.id}/tokens`)
            if (tokensResponse.ok) {
              const tokenData = await tokensResponse.json()
              tokensData[wallet.id] = tokenData.data || tokenData.tokens || []
            }
          } catch (err) {
            console.warn(`Error loading tokens for wallet ${wallet.id}:`, err)
            tokensData[wallet.id] = []
          }
        }
      }

      setTokens(tokensData)

      // Obtener o calcular estadísticas
      const apiStats = await fetchApiStats()
      const calculatedStats = calculateCombinedStats(combinedWallets)
      setStats(apiStats || calculatedStats)

      setLastUpdate(new Date())

    } catch (err) {
      console.error('Error fetching integrated wallets data:', err)
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }, [fetchApiWallets, fetchApiStats, createMetaMaskWallet, createMetaMaskToken, calculateCombinedStats])

  // Effect principal - se ejecuta cuando cambia el estado de MetaMask
  useEffect(() => {
    fetchIntegratedData()
  }, [fetchIntegratedData, metamask.isConnected, metamask.address, metamask.chainId])

  // Auto-refresh cada 30 segundos
  useEffect(() => {
    const interval = setInterval(fetchIntegratedData, 30000)
    return () => clearInterval(interval)
  }, [fetchIntegratedData])

  // Auto-conectar MetaMask si estaba conectado anteriormente
  useEffect(() => {
    if (metamask.isMetaMaskInstalled && !metamask.isConnected) {
      const wasConnected = localStorage.getItem('metamask_connected')
      if (wasConnected === 'true') {
        console.log('🔄 Reconectando MetaMask automáticamente...')
        metamask.connect()
      }
    }
  }, [metamask.isMetaMaskInstalled, metamask.isConnected, metamask.connect])

  return {
    // Datos principales
    wallets: allWallets,
    apiWallets,
    tokens,
    stats,
    loading,
    error,
    lastUpdate,

    // Funciones
    refetch: fetchIntegratedData,

    // Estado de MetaMask
    metamask,

    // Funciones de utilidad
    isMetaMaskWallet: (walletId: string) => walletId.startsWith('metamask-'),
    getMetaMaskWallet: () => allWallets.find(w => w.is_metamask),
    hasMetaMask: () => allWallets.some(w => w.is_metamask)
  }
}
'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'

// Tipos mejorados para MetaMask
interface EthereumProvider {
  isMetaMask?: boolean
  request: (args: { method: string; params?: any[] }) => Promise<any>
  on: (eventName: string, handler: (args: any) => void) => void
  removeListener: (eventName: string, handler: (args: any) => void) => void
  selectedAddress: string | null
  chainId: string | null
}

declare global {
  interface Window {
    ethereum?: EthereumProvider
  }
}

export interface MetaMaskState {
  isConnected: boolean
  address: string | null
  chainId: string | null
  chainName: string
  balance: string | null
  isLoading: boolean
  error: string | null
  networkSupported: boolean
}

// Redes soportadas con configuración completa
const SUPPORTED_NETWORKS = {
  '0x1': {
    name: 'Ethereum Mainnet',
    symbol: 'ETH',
    decimals: 18,
    rpcUrls: ['https://eth-mainnet.g.alchemy.com/v2/demo'],
    blockExplorerUrls: ['https://etherscan.io'],
    supported: true
  },
  '0x89': {
    name: 'Polygon Mainnet',
    symbol: 'MATIC',
    decimals: 18,
    rpcUrls: ['https://polygon-rpc.com'],
    blockExplorerUrls: ['https://polygonscan.com'],
    supported: true
  },
  '0x38': {
    name: 'BSC Mainnet',
    symbol: 'BNB',
    decimals: 18,
    rpcUrls: ['https://bsc-dataseed1.binance.org'],
    blockExplorerUrls: ['https://bscscan.com'],
    supported: true
  },
  '0xa4b1': {
    name: 'Arbitrum One',
    symbol: 'ETH',
    decimals: 18,
    rpcUrls: ['https://arb1.arbitrum.io/rpc'],
    blockExplorerUrls: ['https://arbiscan.io'],
    supported: true
  },
  '0xa': {
    name: 'Optimism',
    symbol: 'ETH',
    decimals: 18,
    rpcUrls: ['https://mainnet.optimism.io'],
    blockExplorerUrls: ['https://optimistic.etherscan.io'],
    supported: true
  }
} as const

export function useMetaMaskOptimized() {
  const [state, setState] = useState<MetaMaskState>({
    isConnected: false,
    address: null,
    chainId: null,
    chainName: 'No conectado',
    balance: null,
    isLoading: false,
    error: null,
    networkSupported: false,
  })

  // Memoizar verificación de MetaMask
  const isMetaMaskInstalled = useMemo(() => {
    return typeof window !== 'undefined' && window.ethereum?.isMetaMask
  }, [])

  // Optimización: Cache de balances con tiempo de expiración
  const balanceCache = useMemo(() => new Map<string, { balance: string; timestamp: number }>(), [])
  const CACHE_DURATION = 30000 // 30 segundos

  // Obtener balance con caché
  const getBalance = useCallback(async (address: string): Promise<string> => {
    if (!window.ethereum) return '0'
    
    const cacheKey = `${address}-${state.chainId}`
    const cached = balanceCache.get(cacheKey)
    const now = Date.now()
    
    // Usar cache si está disponible y no ha expirado
    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
      return cached.balance
    }
    
    try {
      const balance = await window.ethereum.request({
        method: 'eth_getBalance',
        params: [address, 'latest']
      })
      
      // Conversión más precisa de Wei a ETH
      const balanceInEth = Number(BigInt(balance)) / Math.pow(10, 18)
      const formattedBalance = balanceInEth.toFixed(6)
      
      // Actualizar cache
      balanceCache.set(cacheKey, { balance: formattedBalance, timestamp: now })
      
      return formattedBalance
    } catch (error) {
      console.error('Error getting balance:', error)
      return '0'
    }
  }, [state.chainId, balanceCache])

  // Verificar si la red es soportada
  const isNetworkSupported = useCallback((chainId: string) => {
    return chainId in SUPPORTED_NETWORKS
  }, [])

  // Conectar con manejo de errores mejorado
  const connect = useCallback(async () => {
    if (!isMetaMaskInstalled) {
      setState(prev => ({ 
        ...prev, 
        error: 'MetaMask no está instalado. Instálalo desde https://metamask.io' 
      }))
      return false
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      // Solicitar conexión
      const accounts = await window.ethereum!.request({
        method: 'eth_requestAccounts'
      })

      if (accounts.length > 0) {
        const address = accounts[0]
        const chainId = await window.ethereum!.request({ method: 'eth_chainId' })
        const networkSupported = isNetworkSupported(chainId)
        const balance = await getBalance(address)

        const networkConfig = SUPPORTED_NETWORKS[chainId as keyof typeof SUPPORTED_NETWORKS]
        const chainName = networkConfig?.name || `Unsupported Chain (${chainId})`

        setState(prev => ({
          ...prev,
          isConnected: true,
          address,
          chainId,
          chainName,
          balance,
          networkSupported,
          isLoading: false,
          error: networkSupported ? null : 'Red no soportada para arbitraje'
        }))

        // Persistir conexión
        localStorage.setItem('metamask_connected', 'true')
        localStorage.setItem('metamask_address', address)
        localStorage.setItem('metamask_chainId', chainId)

        // Evento personalizado para notificar conexión
        window.dispatchEvent(new CustomEvent('metamask-connected', { 
          detail: { address, chainId, networkSupported } 
        }))

        console.log('✅ MetaMask conectado:', { address, chainId, balance, networkSupported })
        return true
      }
    } catch (error: any) {
      console.error('❌ Error conectando MetaMask:', error)
      
      let errorMessage = 'Error conectando con MetaMask'
      if (error.code === 4001) {
        errorMessage = 'Conexión rechazada por el usuario'
      } else if (error.code === -32002) {
        errorMessage = 'Solicitud pendiente. Revisa MetaMask.'
      }
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }))
      return false
    }

    setState(prev => ({ ...prev, isLoading: false }))
    return false
  }, [isMetaMaskInstalled, getBalance, isNetworkSupported])

  // Desconectar optimizado
  const disconnect = useCallback(() => {
    setState({
      isConnected: false,
      address: null,
      chainId: null,
      chainName: 'No conectado',
      balance: null,
      isLoading: false,
      error: null,
      networkSupported: false,
    })

    // Limpiar localStorage y cache
    localStorage.removeItem('metamask_connected')
    localStorage.removeItem('metamask_address')
    localStorage.removeItem('metamask_chainId')
    balanceCache.clear()

    // Evento personalizado
    window.dispatchEvent(new CustomEvent('metamask-disconnected'))

    console.log('🔌 MetaMask desconectado')
  }, [balanceCache])

  // Cambiar de red con validación
  const switchNetwork = useCallback(async (chainId: string) => {
    if (!window.ethereum) return false

    if (!isNetworkSupported(chainId)) {
      setState(prev => ({ ...prev, error: 'Red no soportada' }))
      return false
    }

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId }]
      })
      return true
    } catch (error: any) {
      // Si la red no existe, intentar agregarla
      if (error.code === 4902) {
        const networkConfig = SUPPORTED_NETWORKS[chainId as keyof typeof SUPPORTED_NETWORKS]
        if (networkConfig) {
          return await addNetwork({
            chainId,
            chainName: networkConfig.name,
            nativeCurrency: {
              name: networkConfig.symbol,
              symbol: networkConfig.symbol,
              decimals: networkConfig.decimals
            },
            rpcUrls: networkConfig.rpcUrls,
            blockExplorerUrls: networkConfig.blockExplorerUrls
          })
        }
      }
      
      console.error('Error switching network:', error)
      setState(prev => ({ ...prev, error: `Error cambiando red: ${error.message}` }))
      return false
    }
  }, [isNetworkSupported])

  // Agregar nueva red
  const addNetwork = useCallback(async (networkConfig: {
    chainId: string
    chainName: string
    nativeCurrency: { name: string; symbol: string; decimals: number }
    rpcUrls: string[]
    blockExplorerUrls?: string[]
  }) => {
    if (!window.ethereum) return false

    try {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [networkConfig]
      })
      return true
    } catch (error: any) {
      console.error('Error adding network:', error)
      setState(prev => ({ ...prev, error: `Error agregando red: ${error.message}` }))
      return false
    }
  }, [])

  // Refresh optimizado con throttling
  const refresh = useCallback(async () => {
    if (!state.address || state.isLoading) return

    setState(prev => ({ ...prev, isLoading: true }))

    try {
      const balance = await getBalance(state.address)
      setState(prev => ({ ...prev, balance, isLoading: false }))
    } catch (error) {
      console.error('Error refreshing balance:', error)
      setState(prev => ({ ...prev, isLoading: false }))
    }
  }, [state.address, state.isLoading, getBalance])

  // Event listeners optimizados
  useEffect(() => {
    if (!isMetaMaskInstalled) return

    const handleAccountsChanged = (accounts: string[]) => {
      console.log('🔄 Accounts changed:', accounts)
      if (accounts.length === 0) {
        disconnect()
      } else if (accounts[0] !== state.address) {
        connect()
      }
    }

    const handleChainChanged = (chainId: string) => {
      console.log('🔄 Chain changed:', chainId)
      const networkSupported = isNetworkSupported(chainId)
      const networkConfig = SUPPORTED_NETWORKS[chainId as keyof typeof SUPPORTED_NETWORKS]
      const chainName = networkConfig?.name || `Unsupported Chain (${chainId})`
      
      setState(prev => ({
        ...prev,
        chainId,
        chainName,
        networkSupported,
        error: networkSupported ? null : 'Red no soportada para arbitraje'
      }))
      
      // Limpiar cache de balance al cambiar red
      balanceCache.clear()
      
      // Actualizar balance
      if (state.address) {
        getBalance(state.address).then(balance => {
          setState(prev => ({ ...prev, balance }))
        })
      }
    }

    const handleDisconnect = () => {
      console.log('🔌 MetaMask disconnected')
      disconnect()
    }

    // Registrar listeners
    window.ethereum!.on('accountsChanged', handleAccountsChanged)
    window.ethereum!.on('chainChanged', handleChainChanged)
    window.ethereum!.on('disconnect', handleDisconnect)

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged)
        window.ethereum.removeListener('chainChanged', handleChainChanged)
        window.ethereum.removeListener('disconnect', handleDisconnect)
      }
    }
  }, [state.address, connect, disconnect, getBalance, isNetworkSupported, balanceCache])

  // Reconexión automática mejorada
  useEffect(() => {
    const wasConnected = localStorage.getItem('metamask_connected')
    const savedAddress = localStorage.getItem('metamask_address')
    
    if (wasConnected === 'true' && savedAddress && isMetaMaskInstalled) {
      window.ethereum!.request({ method: 'eth_accounts' })
        .then((accounts: string[]) => {
          if (accounts.includes(savedAddress)) {
            connect()
          } else {
            localStorage.removeItem('metamask_connected')
            localStorage.removeItem('metamask_address')
            localStorage.removeItem('metamask_chainId')
          }
        })
        .catch(() => {
          localStorage.removeItem('metamask_connected')
          localStorage.removeItem('metamask_address')
          localStorage.removeItem('metamask_chainId')
        })
    }
  }, [connect, isMetaMaskInstalled])

  return {
    ...state,
    isMetaMaskInstalled,
    connect,
    disconnect,
    switchNetwork,
    addNetwork,
    refresh,
    supportedNetworks: SUPPORTED_NETWORKS,
    // Nuevas funciones
    switchToSupportedNetwork: () => switchNetwork('0x1'), // Ethereum por defecto
    isNetworkSupported,
  }
}
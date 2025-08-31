'use client'

import { useState, useEffect, useCallback } from 'react'
import { arbitrageService } from '@/services/arbitrageService'
import { getNetworkConfig, getMissingNetworks, isNetworkInstalled, ALL_SUPPORTED_NETWORKS } from '@/lib/networkConfigs'
import type { NetworkConfig, MetaMaskState } from '@/types/network'

// Interface moved to /types/network.ts

export interface UseMetaMaskReturn extends MetaMaskState {
  connect: () => Promise<void>
  disconnect: () => void
  switchNetwork: (chainId: string) => Promise<void>
  addNetwork: (chainId: string) => Promise<boolean>
  signTransaction: (transaction: any) => Promise<string>
  refreshNetworks: () => Promise<void>
  isNetworkMissing: (chainId: string) => boolean
  isLoading: boolean
  error: string | null
}

declare global {
  interface Window {
    ethereum?: any
  }
}

export function useMetaMask(): UseMetaMaskReturn {
  const [state, setState] = useState<MetaMaskState>({
    isInstalled: false,
    isConnected: false,
    accounts: [],
    chainId: null,
    address: null,
    balance: undefined, // balance es opcional (string | undefined)
    installedNetworks: [],
    missingNetworks: ALL_SUPPORTED_NETWORKS,
    supportedNetworks: ALL_SUPPORTED_NETWORKS
  })

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Network mapping removed - using chainId directly now

  // Check if MetaMask is installed
  const checkMetaMask = useCallback(() => {
    const isInstalled = typeof window !== 'undefined' && 
                        typeof window.ethereum !== 'undefined' &&
                        window.ethereum.isMetaMask

    setState(prev => ({ ...prev, isInstalled }))
    return isInstalled
  }, [])

  // Get account balance
  const getBalance = useCallback(async (account: string): Promise<string | undefined> => {
    try {
      if (!window.ethereum) return undefined
      
      const balance = await window.ethereum.request({
        method: 'eth_getBalance',
        params: [account, 'latest']
      })
      
      // Convert from Wei to Ether
      const balanceInEth = parseInt(balance, 16) / Math.pow(10, 18)
      return balanceInEth.toFixed(4)
    } catch (err) {
      console.error('Error getting balance:', err)
      return undefined
    }
  }, [])

  // Update account info
  const updateAccountInfo = useCallback(async (accounts: string[]) => {
    if (accounts.length === 0) {
      setState(prev => ({
        ...prev,
        isConnected: false,
        accounts: [],
        address: null,
        balance: undefined
      }))
      return
    }

    const chainId = await window.ethereum.request({ method: 'eth_chainId' })
    const balance = await getBalance(accounts[0])

    setState(prev => ({
      ...prev,
      isConnected: true,
      accounts,
      chainId: parseInt(chainId as string, 16),
      address: accounts[0],
      balance
    }))

    // Notify backend about wallet connection
    try {
      // Derive network name from chainId for service compatibility
      const getNetworkNameFromChainId = (chainId: string): string => {
        const networks: { [key: string]: string } = {
          '0x1': 'Ethereum Mainnet',
          '0x38': 'BSC Mainnet',
          '0x89': 'Polygon Mainnet',
          '0xa4b1': 'Arbitrum One',
          '0xa': 'Optimism'
        }
        return networks[chainId] || `Unknown Network (${chainId})`
      }

      await arbitrageService.connectWallet({
        address: accounts[0],
        chainId: chainId as string,
        networkName: getNetworkNameFromChainId(chainId as string)
      })
    } catch (err) {
      console.error('Error notifying backend about wallet connection:', err)
    }
  }, [getBalance])

  // Connect to MetaMask
  const connect = useCallback(async () => {
    if (!checkMetaMask()) {
      setError('MetaMask is not installed. Please install MetaMask to continue.')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      })
      
      await updateAccountInfo(accounts)
      
    } catch (err: any) {
      console.error('Error connecting to MetaMask:', err)
      setError(err.message || 'Failed to connect to MetaMask')
    } finally {
      setIsLoading(false)
    }
  }, [checkMetaMask, updateAccountInfo])

  // Disconnect from MetaMask
  const disconnect = useCallback(() => {
    setState(prev => ({
      ...prev,
      isConnected: false,
      accounts: [],
      chainId: null,
      address: null,
      balance: undefined
    }))
    
    // Notify backend about wallet disconnection
    arbitrageService.disconnectWallet().catch(console.error)
  }, [])

  // Switch network
  const switchNetwork = useCallback(async (targetChainId: string) => {
    if (!window.ethereum) {
      setError('MetaMask is not installed')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: targetChainId }]
      })
    } catch (err: any) {
      console.error('Error switching network:', err)
      setError(err.message || 'Failed to switch network')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Sign transaction
  const signTransaction = useCallback(async (transaction: any): Promise<string> => {
    if (!window.ethereum || !state.isConnected) {
      throw new Error('MetaMask is not connected')
    }

    setIsLoading(true)
    setError(null)

    try {
      const txHash = await window.ethereum.request({
        method: 'eth_sendTransaction',
        params: [transaction]
      })
      
      return txHash
    } catch (err: any) {
      console.error('Error signing transaction:', err)
      setError(err.message || 'Failed to sign transaction')
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [state.isConnected])

  // Detectar redes instaladas en MetaMask
  const detectInstalledNetworks = useCallback(async (): Promise<string[]> => {
    if (!window.ethereum) return []

    const installedChainIds: string[] = []

    // Intentar detectar redes probando cada una
    for (const network of ALL_SUPPORTED_NETWORKS) {
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: network.chainId }]
        })
        installedChainIds.push(network.chainId)
      } catch (err: any) {
        // Red no instalada o error al cambiar
        if (err.code === 4902) {
          // Red no agregada aún
          continue
        }
      }
    }

    return installedChainIds
  }, [])

  // Agregar red a MetaMask
  const addNetwork = useCallback(async (chainId: string): Promise<boolean> => {
    if (!window.ethereum) {
      setError('MetaMask is not installed')
      return false
    }

    const networkConfig = getNetworkConfig(chainId)
    if (!networkConfig) {
      setError('Network configuration not found')
      return false
    }

    // Validar que MetaMask esté conectado
    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' })
      if (!accounts || accounts.length === 0) {
        setError('MetaMask no está conectado. Por favor conecta tu wallet primero.')
        return false
      }
    } catch (connectError) {
      setError('Error al verificar conexión con MetaMask')
      return false
    }

    setIsLoading(true)
    setError(null)

    try {
      // Intentar agregar la red
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: networkConfig.chainId,
          chainName: networkConfig.chainName,
          nativeCurrency: networkConfig.nativeCurrency,
          rpcUrls: networkConfig.rpcUrls,
          blockExplorerUrls: networkConfig.blockExplorerUrls,
          iconUrls: networkConfig.iconUrls
        }]
      })

      // Actualizar estado de redes después de agregar
      await refreshNetworks()
      
      console.log(`✅ Red ${networkConfig.chainName} agregada exitosamente`)
      return true

    } catch (err: any) {
      console.error(`Error adding network ${networkConfig.chainName}:`, err)
      
      // Manejar diferentes tipos de errores de MetaMask
      if (err.code === 4001) {
        setError('Usuario rechazó agregar la red')
      } else if (err.code === -32602) {
        setError('Parámetros de red inválidos')
      } else if (err.code === -32603) {
        setError('Error interno de MetaMask')
      } else if (err.code === 4902) {
        setError('Red no reconocida por MetaMask')
      } else if (typeof err === 'object' && Object.keys(err).length === 0) {
        // Error vacío {} - posible problema de conectividad
        setError('Error de conexión con MetaMask. Verifica que MetaMask esté desbloqueado.')
      } else if (err.message && typeof err.message === 'string') {
        setError(err.message)
      } else {
        setError(`Error desconocido al agregar la red ${networkConfig.chainName}`)
      }
      
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Refrescar detección de redes
  const refreshNetworks = useCallback(async () => {
    if (!window.ethereum) return

    try {
      const installedChainIds = await detectInstalledNetworks()
      const missingNetworks = getMissingNetworks(installedChainIds)

      setState(prev => ({
        ...prev,
        installedNetworks: installedChainIds,
        missingNetworks
      }))

      console.log(`📡 Redes detectadas: ${installedChainIds.length}/20 instaladas`)
      
    } catch (err) {
      console.error('Error refreshing networks:', err)
    }
  }, [detectInstalledNetworks])

  // Verificar si una red específica falta
  const isNetworkMissing = useCallback((chainId: string): boolean => {
    return !isNetworkInstalled(chainId, state.installedNetworks)
  }, [state.installedNetworks])

  // Initialize MetaMask connection
  useEffect(() => {
    if (typeof window === 'undefined') return

    checkMetaMask()

    if (window.ethereum) {
      // Check if already connected
      window.ethereum.request({ method: 'eth_accounts' })
        .then((accounts: string[]) => {
          if (accounts.length > 0) {
            updateAccountInfo(accounts)
          }
        })
        .catch(console.error)

      // Detectar redes instaladas al inicio
      refreshNetworks()

      // Listen for account changes
      const handleAccountsChanged = (accounts: string[]) => {
        updateAccountInfo(accounts)
      }

      // Listen for chain changes
      const handleChainChanged = (chainId: string) => {
        setState(prev => ({
          ...prev,
          chainId: parseInt(chainId, 16)
        }))
        
        // Reload balance for new network
        if (state.accounts.length > 0) {
          getBalance(state.accounts[0]).then(balance => {
            setState(prev => ({ ...prev, balance }))
          })
        }
      }

      window.ethereum.on('accountsChanged', handleAccountsChanged)
      window.ethereum.on('chainChanged', handleChainChanged)

      // Cleanup listeners
      return () => {
        if (window.ethereum.removeListener) {
          window.ethereum.removeListener('accountsChanged', handleAccountsChanged)
          window.ethereum.removeListener('chainChanged', handleChainChanged)
        }
      }
    }
  }, [checkMetaMask, updateAccountInfo, getBalance, state.accounts, refreshNetworks])

  return {
    ...state,
    connect,
    disconnect,
    switchNetwork,
    addNetwork,
    signTransaction,
    refreshNetworks,
    isNetworkMissing,
    isLoading,
    error
  }
}
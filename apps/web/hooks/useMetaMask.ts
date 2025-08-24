'use client'

import { useState, useEffect } from 'react'

// Tipos para MetaMask
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
}

// Mapeo de Chain IDs a nombres de redes
const CHAIN_NAMES: { [key: string]: string } = {
  '0x1': 'Ethereum Mainnet',
  '0x89': 'Polygon Mainnet',
  '0x38': 'BSC Mainnet',
  '0xa4b1': 'Arbitrum One',
  '0xa': 'Optimism',
  '0xa86a': 'Avalanche C-Chain',
  '0x2105': 'Base',
  '0xfa': 'Fantom Opera',
}

export function useMetaMask() {
  const [state, setState] = useState<MetaMaskState>({
    isConnected: false,
    address: null,
    chainId: null,
    chainName: 'No conectado',
    balance: null,
    isLoading: false,
    error: null,
  })

  // Verificar si MetaMask está instalado
  const isMetaMaskInstalled = () => {
    return typeof window !== 'undefined' && window.ethereum?.isMetaMask
  }

  // Obtener balance de la cuenta
  const getBalance = async (address: string): Promise<string> => {
    if (!window.ethereum) return '0'
    
    try {
      const balance = await window.ethereum.request({
        method: 'eth_getBalance',
        params: [address, 'latest']
      })
      
      // Convertir de Wei a ETH
      const balanceInEth = parseInt(balance, 16) / Math.pow(10, 18)
      return balanceInEth.toFixed(4)
    } catch (error) {
      console.error('Error getting balance:', error)
      return '0'
    }
  }

  // Conectar a MetaMask
  const connect = async () => {
    if (!isMetaMaskInstalled()) {
      setState(prev => ({ 
        ...prev, 
        error: 'MetaMask no está instalado. Instálalo desde https://metamask.io' 
      }))
      return false
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const accounts = await window.ethereum!.request({
        method: 'eth_requestAccounts'
      })

      if (accounts.length > 0) {
        const address = accounts[0]
        const chainId = await window.ethereum!.request({ method: 'eth_chainId' })
        const balance = await getBalance(address)

        setState(prev => ({
          ...prev,
          isConnected: true,
          address,
          chainId,
          chainName: CHAIN_NAMES[chainId] || `Chain ${chainId}`,
          balance,
          isLoading: false,
        }))

        // Guardar conexión en localStorage
        localStorage.setItem('metamask_connected', 'true')
        localStorage.setItem('metamask_address', address)

        console.log('✅ MetaMask conectado:', { address, chainId, balance })
        return true
      }
    } catch (error: any) {
      console.error('❌ Error conectando MetaMask:', error)
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Error conectando con MetaMask',
      }))
      return false
    }

    setState(prev => ({ ...prev, isLoading: false }))
    return false
  }

  // Desconectar MetaMask
  const disconnect = () => {
    setState({
      isConnected: false,
      address: null,
      chainId: null,
      chainName: 'No conectado',
      balance: null,
      isLoading: false,
      error: null,
    })

    // Limpiar localStorage
    localStorage.removeItem('metamask_connected')
    localStorage.removeItem('metamask_address')

    console.log('🔌 MetaMask desconectado')
  }

  // Cambiar de red
  const switchNetwork = async (chainId: string) => {
    if (!window.ethereum) return false

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId }]
      })
      return true
    } catch (error: any) {
      console.error('Error switching network:', error)
      setState(prev => ({ ...prev, error: `Error cambiando red: ${error.message}` }))
      return false
    }
  }

  // Agregar nueva red
  const addNetwork = async (networkConfig: {
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
  }

  // Manejar eventos de MetaMask
  useEffect(() => {
    if (!isMetaMaskInstalled()) return

    const handleAccountsChanged = (accounts: string[]) => {
      console.log('🔄 Accounts changed:', accounts)
      if (accounts.length === 0) {
        disconnect()
      } else if (accounts[0] !== state.address) {
        // Reconectar con la nueva cuenta
        connect()
      }
    }

    const handleChainChanged = (chainId: string) => {
      console.log('🔄 Chain changed:', chainId)
      setState(prev => ({
        ...prev,
        chainId,
        chainName: CHAIN_NAMES[chainId] || `Chain ${chainId}`,
      }))
      
      // Actualizar balance después del cambio de red
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

    // Registrar event listeners
    window.ethereum!.on('accountsChanged', handleAccountsChanged)
    window.ethereum!.on('chainChanged', handleChainChanged)
    window.ethereum!.on('disconnect', handleDisconnect)

    // Cleanup
    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged)
        window.ethereum.removeListener('chainChanged', handleChainChanged)
        window.ethereum.removeListener('disconnect', handleDisconnect)
      }
    }
  }, [state.address])

  // Reconectar automáticamente si estaba conectado anteriormente
  useEffect(() => {
    const wasConnected = localStorage.getItem('metamask_connected')
    const savedAddress = localStorage.getItem('metamask_address')
    
    if (wasConnected === 'true' && savedAddress && isMetaMaskInstalled()) {
      // Verificar si la cuenta aún está disponible
      window.ethereum!.request({ method: 'eth_accounts' })
        .then((accounts: string[]) => {
          if (accounts.includes(savedAddress)) {
            connect()
          } else {
            // Limpiar datos si la cuenta ya no está disponible
            localStorage.removeItem('metamask_connected')
            localStorage.removeItem('metamask_address')
          }
        })
        .catch(() => {
          localStorage.removeItem('metamask_connected')
          localStorage.removeItem('metamask_address')
        })
    }
  }, [])

  return {
    ...state,
    isMetaMaskInstalled: isMetaMaskInstalled(),
    connect,
    disconnect,
    switchNetwork,
    addNetwork,
    refresh: () => {
      if (state.address) {
        getBalance(state.address).then(balance => {
          setState(prev => ({ ...prev, balance }))
        })
      }
    }
  }
}
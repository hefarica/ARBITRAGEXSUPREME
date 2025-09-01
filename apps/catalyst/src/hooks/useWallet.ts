/**
 * ArbitrageX Supreme - useWallet Hook
 * Ingenio Pichichi S.A. - Hook para conexión y gestión de wallets
 * 
 * Implementación metodica y disciplinada para conexión segura de wallets
 * con soporte para MetaMask, WalletConnect y otros providers
 */

import { useState, useEffect, useCallback } from 'react'
import { ethers } from 'ethers'

// Types
export interface WalletState {
  address: string | null
  balance: string | null
  chainId: number | null
  isConnected: boolean
  isConnecting: boolean
  error: string | null
  provider: ethers.BrowserProvider | null
  signer: ethers.JsonRpcSigner | null
}

export interface UseWalletReturn extends WalletState {
  connect: () => Promise<void>
  disconnect: () => void
  switchChain: (chainId: number) => Promise<void>
  signMessage: (message: string) => Promise<string>
  signTypedData: (domain: any, types: any, value: any) => Promise<string>
}

// Supported wallet providers
export const SUPPORTED_WALLETS = {
  METAMASK: 'metamask',
  WALLET_CONNECT: 'walletconnect',
  COINBASE: 'coinbase',
} as const

export type SupportedWallet = typeof SUPPORTED_WALLETS[keyof typeof SUPPORTED_WALLETS]

/**
 * Hook principal para gestión de wallets
 * Implementa conexión segura, firma de mensajes y transacciones
 */
export const useWallet = (): UseWalletReturn => {
  const [state, setState] = useState<WalletState>({
    address: null,
    balance: null,
    chainId: null,
    isConnected: false,
    isConnecting: false,
    error: null,
    provider: null,
    signer: null,
  })

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  const resetState = useCallback(() => {
    setState({
      address: null,
      balance: null,
      chainId: null,
      isConnected: false,
      isConnecting: false,
      error: null,
      provider: null,
      signer: null,
    })
  }, [])

  const updateError = useCallback((error: string) => {
    setState(prev => ({ ...prev, error, isConnecting: false }))
  }, [])

  // ============================================
  // WALLET CONNECTION
  // ============================================

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      updateError('MetaMask no está instalado. Por favor instálalo desde https://metamask.io/')
      return
    }

    setState(prev => ({ ...prev, isConnecting: true, error: null }))

    try {
      // Request account access
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts'
      })

      if (!accounts || accounts.length === 0) {
        updateError('No se pudo acceder a ninguna cuenta')
        return
      }

      // Initialize provider and signer
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const address = await signer.getAddress()
      const balance = await provider.getBalance(address)
      const network = await provider.getNetwork()

      setState({
        address,
        balance: ethers.formatEther(balance),
        chainId: Number(network.chainId),
        isConnected: true,
        isConnecting: false,
        error: null,
        provider,
        signer,
      })

      // Store connection in localStorage for persistence
      localStorage.setItem('arbitragex_wallet_connected', 'true')
      localStorage.setItem('arbitragex_wallet_address', address)

    } catch (error: any) {
      console.error('Error connecting wallet:', error)
      updateError(error.message || 'Error al conectar la wallet')
    }
  }, [updateError])

  // ============================================
  // WALLET DISCONNECTION
  // ============================================

  const disconnect = useCallback(() => {
    resetState()
    localStorage.removeItem('arbitragex_wallet_connected')
    localStorage.removeItem('arbitragex_wallet_address')
  }, [resetState])

  // ============================================
  // CHAIN SWITCHING
  // ============================================

  const switchChain = useCallback(async (chainId: number) => {
    if (!window.ethereum || !state.provider) {
      updateError('Wallet no conectada')
      return
    }

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${chainId.toString(16)}` }],
      })

      // Update chain ID in state
      setState(prev => ({ ...prev, chainId }))

    } catch (error: any) {
      console.error('Error switching chain:', error)
      updateError(error.message || 'Error al cambiar de red')
    }
  }, [state.provider, updateError])

  // ============================================
  // MESSAGE SIGNING (Regular)
  // ============================================

  const signMessage = useCallback(async (message: string): Promise<string> => {
    if (!state.signer) {
      throw new Error('Wallet no conectada')
    }

    try {
      const signature = await state.signer.signMessage(message)
      return signature
    } catch (error: any) {
      console.error('Error signing message:', error)
      throw new Error(error.message || 'Error al firmar mensaje')
    }
  }, [state.signer])

  // ============================================
  // TYPED DATA SIGNING (EIP-712)
  // ============================================

  const signTypedData = useCallback(async (
    domain: any,
    types: any,
    value: any
  ): Promise<string> => {
    if (!state.signer) {
      throw new Error('Wallet no conectada')
    }

    try {
      const signature = await state.signer.signTypedData(domain, types, value)
      return signature
    } catch (error: any) {
      console.error('Error signing typed data:', error)
      throw new Error(error.message || 'Error al firmar datos tipados')
    }
  }, [state.signer])

  // ============================================
  // EFFECTS & EVENT LISTENERS
  // ============================================

  useEffect(() => {
    // Auto-connect if previously connected
    const wasConnected = localStorage.getItem('arbitragex_wallet_connected')
    if (wasConnected === 'true' && window.ethereum) {
      connect()
    }

    // Listen for account changes
    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnect()
      } else if (accounts[0] !== state.address) {
        connect() // Reconnect with new account
      }
    }

    // Listen for chain changes
    const handleChainChanged = (chainId: string) => {
      setState(prev => ({ 
        ...prev, 
        chainId: parseInt(chainId, 16) 
      }))
    }

    // Add event listeners
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountsChanged)
      window.ethereum.on('chainChanged', handleChainChanged)
    }

    // Cleanup
    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged)
        window.ethereum.removeListener('chainChanged', handleChainChanged)
      }
    }
  }, [connect, disconnect, state.address])

  // ============================================
  // RETURN HOOK INTERFACE
  // ============================================

  return {
    ...state,
    connect,
    disconnect,
    switchChain,
    signMessage,
    signTypedData,
  }
}

// ============================================
// TYPES FOR WINDOW.ETHEREUM
// ============================================

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>
      on: (event: string, callback: (...args: any[]) => void) => void
      removeListener: (event: string, callback: (...args: any[]) => void) => void
      isMetaMask?: boolean
    }
  }
}
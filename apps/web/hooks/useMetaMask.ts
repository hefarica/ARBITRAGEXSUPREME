'use client'

import { useState, useEffect, useCallback } from 'react'
import { arbitrageService } from '@/services/arbitrageService'

export interface MetaMaskState {
  isInstalled: boolean
  isConnected: boolean
  accounts: string[]
  chainId: string | null
  balance: string | null
  networkName: string | null
}

export interface UseMetaMaskReturn extends MetaMaskState {
  connect: () => Promise<void>
  disconnect: () => void
  switchNetwork: (chainId: string) => Promise<void>
  signTransaction: (transaction: any) => Promise<string>
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
    balance: null,
    networkName: null
  })

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Network mapping
  const getNetworkName = (chainId: string): string => {
    const networks: { [key: string]: string } = {
      '0x1': 'Ethereum Mainnet',
      '0xaa36a7': 'Ethereum Sepolia',
      '0x38': 'BSC Mainnet',
      '0x61': 'BSC Testnet',
      '0x89': 'Polygon Mainnet',
      '0x13881': 'Polygon Mumbai',
      '0xa4b1': 'Arbitrum One',
      '0xa': 'Optimism',
      '0x2105': 'Base'
    }
    return networks[chainId] || `Unknown Network (${chainId})`
  }

  // Check if MetaMask is installed
  const checkMetaMask = useCallback(() => {
    const isInstalled = typeof window !== 'undefined' && 
                        typeof window.ethereum !== 'undefined' &&
                        window.ethereum.isMetaMask

    setState(prev => ({ ...prev, isInstalled }))
    return isInstalled
  }, [])

  // Get account balance
  const getBalance = useCallback(async (account: string): Promise<string | null> => {
    try {
      if (!window.ethereum) return null
      
      const balance = await window.ethereum.request({
        method: 'eth_getBalance',
        params: [account, 'latest']
      })
      
      // Convert from Wei to Ether
      const balanceInEth = parseInt(balance, 16) / Math.pow(10, 18)
      return balanceInEth.toFixed(4)
    } catch (err) {
      console.error('Error getting balance:', err)
      return null
    }
  }, [])

  // Update account info
  const updateAccountInfo = useCallback(async (accounts: string[]) => {
    if (accounts.length === 0) {
      setState(prev => ({
        ...prev,
        isConnected: false,
        accounts: [],
        balance: null
      }))
      return
    }

    const chainId = await window.ethereum.request({ method: 'eth_chainId' })
    const balance = await getBalance(accounts[0])
    const networkName = getNetworkName(chainId)

    setState(prev => ({
      ...prev,
      isConnected: true,
      accounts,
      chainId,
      balance,
      networkName
    }))

    // Notify backend about wallet connection
    try {
      await arbitrageService.connectWallet({
        address: accounts[0],
        chainId,
        networkName
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
      balance: null,
      networkName: null
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

      // Listen for account changes
      const handleAccountsChanged = (accounts: string[]) => {
        updateAccountInfo(accounts)
      }

      // Listen for chain changes
      const handleChainChanged = (chainId: string) => {
        setState(prev => ({
          ...prev,
          chainId,
          networkName: getNetworkName(chainId)
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
  }, [checkMetaMask, updateAccountInfo, getBalance, state.accounts])

  return {
    ...state,
    connect,
    disconnect,
    switchNetwork,
    signTransaction,
    isLoading,
    error
  }
}
/**
 * @fileoverview Hook para gestión de operaciones de arbitraje
 * Ingenio Pichichi S.A. - ArbitrageX Supreme
 * Hook para simulación y ejecución de operaciones de arbitraje DeFi
 */

import { useState, useCallback } from 'react'
import { ethers } from 'ethers'
import { useWallet } from './useWallet'
import type { ArbitrageParams, ArbitrageResult } from '@/types'

interface GasEstimate {
  gasLimit: string
  gasPrice: string
  totalCost: string
}

interface UseArbitrageReturn {
  // Estado
  isSimulating: boolean
  isExecuting: boolean
  simulationResult: ArbitrageResult | null
  executionResult: ArbitrageResult | null
  error: string | null
  gasEstimate: GasEstimate | null
  
  // Funciones
  simulateArbitrage: (params: ArbitrageParams) => Promise<void>
  executeArbitrage: (params: ArbitrageParams) => Promise<void>
  estimateGas: (params: ArbitrageParams) => Promise<void>
  reset: () => void
}

export function useArbitrage(): UseArbitrageReturn {
  const { isConnected, chainId } = useWallet()
  
  // Estado
  const [isSimulating, setIsSimulating] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)
  const [simulationResult, setSimulationResult] = useState<ArbitrageResult | null>(null)
  const [executionResult, setExecutionResult] = useState<ArbitrageResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [gasEstimate, setGasEstimate] = useState<GasEstimate | null>(null)

  // Validación de parámetros
  const validateParams = useCallback((params: ArbitrageParams): boolean => {
    if (!params.amount || params.amount === '') {
      setError('Invalid arbitrage parameters')
      return false
    }

    if (!ethers.isAddress(params.tokenA.address) || !ethers.isAddress(params.tokenB.address)) {
      setError('Invalid token addresses')
      return false
    }

    return true
  }, [])

  // Simulación de arbitraje
  const simulateArbitrage = useCallback(async (params: ArbitrageParams) => {
    if (!isConnected) {
      setError('Wallet not connected')
      return
    }

    if (!validateParams(params)) {
      return
    }

    setIsSimulating(true)
    setError(null)

    try {
      const response = await fetch('/api/arbitrage/simulate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Simulation failed')
      }

      const result: ArbitrageResult = await response.json()
      setSimulationResult(result)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Network error'
      setError(errorMessage)
    } finally {
      setIsSimulating(false)
    }
  }, [isConnected, validateParams])

  // Ejecución de arbitraje
  const executeArbitrage = useCallback(async (params: ArbitrageParams) => {
    if (!isConnected) {
      setError('Wallet not connected')
      return
    }

    if (!simulationResult) {
      setError('Please simulate arbitrage first')
      return
    }

    setIsExecuting(true)
    setError(null)

    try {
      const response = await fetch('/api/arbitrage/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Execution failed')
      }

      const result: ArbitrageResult = await response.json()
      setExecutionResult(result)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Network error'
      setError(errorMessage)
    } finally {
      setIsExecuting(false)
    }
  }, [isConnected, simulationResult])

  // Estimación de gas
  const estimateGas = useCallback(async (params: ArbitrageParams) => {
    if (!validateParams(params)) {
      return
    }

    try {
      const response = await fetch('/api/arbitrage/gas-estimate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Cannot estimate gas')
      }

      const estimate: GasEstimate = await response.json()
      setGasEstimate(estimate)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Cannot estimate gas'
      setError(errorMessage)
    }
  }, [validateParams])

  // Reset del estado
  const reset = useCallback(() => {
    setSimulationResult(null)
    setExecutionResult(null)
    setError(null)
    setGasEstimate(null)
    setIsSimulating(false)
    setIsExecuting(false)
  }, [])

  return {
    isSimulating,
    isExecuting,
    simulationResult,
    executionResult,
    error,
    gasEstimate,
    simulateArbitrage,
    executeArbitrage,
    estimateGas,
    reset,
  }
}
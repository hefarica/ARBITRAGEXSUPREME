'use client'

import { useState, useCallback, useEffect } from 'react'
import { useMetaMask } from './useMetaMask'
import { web3ArbitrageService, type ExecutionParams, type ExecutionResult, type GasEstimation } from '@/services/web3ArbitrageService'
import type { ArbitrageOpportunity } from '@/types/arbitrage'

// ============================================================================
// INTERFACES PARA EL HOOK
// ============================================================================

export interface ExecutionState {
  isExecuting: boolean
  isEstimating: boolean
  gasEstimation: GasEstimation | null
  lastExecution: ExecutionResult | null
  error: string | null
}

export interface ExecutionHistory {
  id: string
  timestamp: number
  opportunity: ArbitrageOpportunity
  result: ExecutionResult
  gasUsed?: number
  profit?: string
}

export interface UserStats {
  totalProfit: string
  totalTrades: number
  successRate: number
  totalGasUsed: string
}

// ============================================================================
// HOOK PRINCIPAL DE EJECUCIÓN
// ============================================================================

export function useArbitrageExecution() {
  const { isConnected, accounts, chainId, switchNetwork } = useMetaMask()
  
  const [state, setState] = useState<ExecutionState>({
    isExecuting: false,
    isEstimating: false,
    gasEstimation: null,
    lastExecution: null,
    error: null
  })

  const [executionHistory, setExecutionHistory] = useState<ExecutionHistory[]>([])
  const [userStats, setUserStats] = useState<UserStats>({
    totalProfit: '0',
    totalTrades: 0,
    successRate: 0,
    totalGasUsed: '0'
  })

  const [slippageTolerance, setSlippageTolerance] = useState(0.5) // 0.5% por defecto

  // ============================================================================
  // INICIALIZACIÓN WEB3
  // ============================================================================

  useEffect(() => {
    if (isConnected && typeof window !== 'undefined' && window.ethereum) {
      web3ArbitrageService.initialize(window.ethereum).catch(console.error)
    }
  }, [isConnected])

  // ============================================================================
  // ESTIMACIÓN DE GAS Y RENTABILIDAD
  // ============================================================================

  const estimateGasAndProfit = useCallback(async (
    opportunity: ArbitrageOpportunity
  ): Promise<GasEstimation | null> => {
    if (!isConnected || !accounts[0] || !chainId) {
      setState(prev => ({ ...prev, error: 'Wallet no conectado' }))
      return null
    }

    setState(prev => ({ 
      ...prev, 
      isEstimating: true, 
      error: null,
      gasEstimation: null 
    }))

    try {
      const params: ExecutionParams = {
        opportunity,
        userAddress: accounts[0],
        chainId: chainId?.toString() ?? '1',
        slippageTolerance: slippageTolerance / 100, // Convertir a decimal
        gasLimit: undefined
      }

      const estimation = await web3ArbitrageService.estimateGasAndProfit(params)
      
      setState(prev => ({ 
        ...prev, 
        gasEstimation: estimation,
        error: estimation.isProfitable ? null : 'Arbitraje no rentable después del gas'
      }))

      return estimation

    } catch (error: any) {
      console.error('Error estimando gas:', error)
      setState(prev => ({ 
        ...prev, 
        error: `Error en estimación: ${error.message}`,
        gasEstimation: null
      }))
      return null

    } finally {
      setState(prev => ({ ...prev, isEstimating: false }))
    }
  }, [isConnected, accounts, chainId, slippageTolerance])

  // ============================================================================
  // EJECUCIÓN DE ARBITRAJE
  // ============================================================================

  const executeArbitrage = useCallback(async (
    opportunity: ArbitrageOpportunity,
    forceExecution: boolean = false
  ): Promise<ExecutionResult> => {
    if (!isConnected || !accounts[0] || !chainId) {
      const error = 'Wallet no conectado'
      setState(prev => ({ ...prev, error }))
      return { success: false, error }
    }

    // Verificar si la red es soportada
    if (!web3ArbitrageService.isNetworkSupported(chainId?.toString() ?? '1')) {
      const error = `Red ${chainId} no soportada. Cambia a una red compatible.`
      setState(prev => ({ ...prev, error }))
      return { success: false, error }
    }

    setState(prev => ({ 
      ...prev, 
      isExecuting: true, 
      error: null,
      lastExecution: null
    }))

    try {
      // 1. Estimar gas si no se ha hecho o si se fuerza
      let gasEstimation = state.gasEstimation
      if (!gasEstimation || forceExecution) {
        gasEstimation = await estimateGasAndProfit(opportunity)
        if (!gasEstimation) {
          throw new Error('No se pudo estimar gas')
        }
      }

      // 2. Verificar rentabilidad (solo si no se fuerza)
      if (!forceExecution && !gasEstimation.isProfitable) {
        throw new Error(`No rentable: pérdida de $${Math.abs(parseFloat(gasEstimation.estimatedProfit))}`)
      }

      // 3. Preparar parámetros de ejecución
      const params: ExecutionParams = {
        opportunity,
        userAddress: accounts[0],
        chainId: chainId?.toString() ?? '1',
        slippageTolerance: slippageTolerance / 100,
        gasLimit: gasEstimation.gasLimit,
        gasPrice: gasEstimation.gasPrice
      }

      console.log('🚀 Iniciando ejecución de arbitraje...', {
        strategy: opportunity.strategy,
        expectedProfit: opportunity.profitAmount,
        gasEstimate: gasEstimation.gasCostUSD,
        netProfit: gasEstimation.estimatedProfit
      })

      // 4. Ejecutar arbitraje
      const result = await web3ArbitrageService.executeArbitrage(params)

      // 5. Actualizar estado
      setState(prev => ({ 
        ...prev, 
        lastExecution: result,
        error: result.success ? null : result.error || 'Error desconocido'
      }))

      // 6. Agregar a historial si fue exitoso
      if (result.success) {
        const historyEntry: ExecutionHistory = {
          id: result.txHash || Date.now().toString(),
          timestamp: Date.now(),
          opportunity,
          result,
          gasUsed: result.gasUsed,
          profit: result.profit
        }
        
        setExecutionHistory(prev => [historyEntry, ...prev.slice(0, 49)]) // Mantener últimos 50
        
        // Actualizar stats del usuario
        await updateUserStats()
      }

      return result

    } catch (error: any) {
      console.error('❌ Error ejecutando arbitraje:', error)
      
      const errorMessage = error.message || 'Error desconocido en ejecución'
      setState(prev => ({ ...prev, error: errorMessage }))
      
      return { success: false, error: errorMessage }

    } finally {
      setState(prev => ({ ...prev, isExecuting: false }))
    }
  }, [isConnected, accounts, chainId, slippageTolerance, state.gasEstimation, estimateGasAndProfit])

  // ============================================================================
  // CAMBIO DE RED AUTOMÁTICO
  // ============================================================================

  const executeWithNetworkSwitch = useCallback(async (
    opportunity: ArbitrageOpportunity,
    targetChainId: string
  ): Promise<ExecutionResult> => {
    try {
      // Verificar si necesitamos cambiar de red
      if (chainId?.toString() !== targetChainId) {
        console.log(`🔄 Cambiando a red ${targetChainId}...`)
        await switchNetwork(targetChainId)
        
        // Esperar un momento para que se complete el cambio
        await new Promise(resolve => setTimeout(resolve, 2000))
      }

      // Ejecutar arbitraje en la red correcta
      return await executeArbitrage(opportunity)

    } catch (error: any) {
      const errorMessage = `Error cambiando de red: ${error.message}`
      setState(prev => ({ ...prev, error: errorMessage }))
      return { success: false, error: errorMessage }
    }
  }, [chainId, switchNetwork, executeArbitrage])

  // ============================================================================
  // ESTADÍSTICAS DEL USUARIO
  // ============================================================================

  const updateUserStats = useCallback(async () => {
    if (!isConnected || !accounts[0] || !chainId) return

    try {
      const stats = await web3ArbitrageService.getUserStats(accounts[0], chainId?.toString() ?? '1')
      
      // Agregar métricas del historial local
      const localStats = executionHistory.reduce((acc, entry) => {
        acc.totalTrades += 1
        acc.successfulTrades += entry.result.success ? 1 : 0
        acc.totalGasUsed += entry.gasUsed || 0
        return acc
      }, { totalTrades: 0, successfulTrades: 0, totalGasUsed: 0 })

      setUserStats({
        totalProfit: stats.totalProfit,
        totalTrades: Math.max(stats.totalTrades, localStats.totalTrades),
        successRate: localStats.totalTrades > 0 ? localStats.successfulTrades / localStats.totalTrades * 100 : 0,
        totalGasUsed: localStats.totalGasUsed.toString()
      })

    } catch (error) {
      console.error('Error actualizando stats:', error)
    }
  }, [isConnected, accounts, chainId, executionHistory])

  // Actualizar stats periódicamente
  useEffect(() => {
    if (isConnected) {
      updateUserStats()
      const interval = setInterval(updateUserStats, 30000) // Cada 30 segundos
      return () => clearInterval(interval)
    }
  }, [isConnected, updateUserStats])

  // ============================================================================
  // UTILIDADES
  // ============================================================================

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }))
  }, [])

  const clearHistory = useCallback(() => {
    setExecutionHistory([])
    setUserStats({
      totalProfit: '0',
      totalTrades: 0,
      successRate: 0,
      totalGasUsed: '0'
    })
  }, [])

  const getExecutionById = useCallback((id: string) => {
    return executionHistory.find(entry => entry.id === id)
  }, [executionHistory])

  const isNetworkSupported = useCallback((chainId: string) => {
    return web3ArbitrageService.isNetworkSupported(chainId)
  }, [])

  const getSupportedNetworks = useCallback(() => {
    return web3ArbitrageService.getSupportedNetworks()
  }, [])

  const getNetworkInfo = useCallback((chainId: string) => {
    return web3ArbitrageService.getNetworkInfo(chainId)
  }, [])

  // ============================================================================
  // VALIDACIONES
  // ============================================================================

  const canExecute = useCallback((opportunity: Partial<ArbitrageOpportunity>): {
    canExecute: boolean
    reason?: string
  } => {
    // Validaciones de campos obligatorios de ArbitrageOpportunity
    if (!opportunity.description) {
      return { canExecute: false, reason: 'Falta descripción de la oportunidad' }
    }
    
    if (!opportunity.path || opportunity.path.length === 0) {
      return { canExecute: false, reason: 'Ruta de ejecución inválida' }
    }
    
    if (!opportunity.protocols || opportunity.protocols.length === 0) {
      return { canExecute: false, reason: 'Protocolos no definidos' }
    }
    
    if (!opportunity.chainId) {
      return { canExecute: false, reason: 'ChainId no válido' }
    }
    
    if (!opportunity.amount && !opportunity.profitUSD) {
      return { canExecute: false, reason: 'Monto o profit no definido' }
    }
    if (!isConnected) {
      return { canExecute: false, reason: 'Wallet no conectado' }
    }

    if (!accounts[0]) {
      return { canExecute: false, reason: 'No hay cuenta seleccionada' }
    }

    if (!chainId) {
      return { canExecute: false, reason: 'Red no detectada' }
    }

    if (!isNetworkSupported(chainId?.toString() ?? '1')) {
      return { canExecute: false, reason: 'Red no soportada' }
    }

    if (state.isExecuting) {
      return { canExecute: false, reason: 'Otra ejecución en progreso' }
    }

    // Verificar expiración
    if (opportunity.expiresAt && new Date(opportunity.expiresAt) < new Date()) {
      return { canExecute: false, reason: 'Oportunidad expirada' }
    }

    return { canExecute: true }
  }, [isConnected, accounts, chainId, isNetworkSupported, state.isExecuting])

  // ============================================================================
  // RETURN INTERFACE
  // ============================================================================

  return {
    // Estado principal
    isExecuting: state.isExecuting,
    isEstimating: state.isEstimating,
    gasEstimation: state.gasEstimation,
    lastExecution: state.lastExecution,
    error: state.error,

    // Funciones principales
    estimateGasAndProfit,
    executeArbitrage,
    executeWithNetworkSwitch,

    // Configuración
    slippageTolerance,
    setSlippageTolerance,

    // Historial y estadísticas
    executionHistory,
    userStats,
    updateUserStats,

    // Utilidades
    clearError,
    clearHistory,
    getExecutionById,
    canExecute,

    // Red y soporte
    isNetworkSupported,
    getSupportedNetworks,
    getNetworkInfo,

    // Estado de conexión
    isConnected,
    currentChainId: chainId,
    userAddress: accounts[0]
  }
}
'use client'

import { useState, useEffect, useCallback } from 'react'
import { ConsolidatedSnapshot, BlockchainSummary, ArbitrageOpportunity } from '@/types/defi'

interface SnapshotState {
  data: ConsolidatedSnapshot | null
  isLoading: boolean
  error: string | null
  lastUpdated: number | null
}

export function useArbitrageSnapshot() {
  const [state, setState] = useState<SnapshotState>({
    data: null,
    isLoading: false,
    error: null,
    lastUpdated: null
  })

  // Función para obtener el snapshot consolidado
  const fetchSnapshot = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const response = await fetch('/api/snapshot/consolidated', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Snapshot API error: ${response.status}`)
      }

      const result = await response.json()

      if (result.success) {
        setState({
          data: result.data,
          isLoading: false,
          error: null,
          lastUpdated: Date.now()
        })
      } else {
        throw new Error(result.message || 'Failed to fetch snapshot')
      }
    } catch (error) {
      console.error('Error fetching arbitrage snapshot:', error)
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }))
    }
  }, [])

  // Auto-fetch al montar el componente
  useEffect(() => {
    fetchSnapshot()
  }, [fetchSnapshot])

  // Auto-refresh cada 5 segundos (matching the cache TTL)
  useEffect(() => {
    const interval = setInterval(() => {
      if (!state.isLoading) {
        fetchSnapshot()
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [state.isLoading, fetchSnapshot])

  // ============================================================================
  // FUNCIONES DERIVADAS PARA ANÁLISIS DE DATOS
  // ============================================================================

  // Obtener resumen de oportunidades por blockchain
  const getOpportunitiesByChain = useCallback((): { [chainId: number]: ArbitrageOpportunity[] } => {
    if (!state.data?.arbitrageData) return {}
    return state.data.arbitrageData.byChain || {}
  }, [state.data])

  // Obtener TVL total agregado
  const getTotalTVL = useCallback((): number => {
    if (!state.data?.blockchainSummaries) return 0
    return state.data.blockchainSummaries.reduce((sum, chain) => sum + (chain.totalTVL || 0), 0)
  }, [state.data])

  // Obtener oportunidades más rentables
  const getTopOpportunities = useCallback((): ArbitrageOpportunity[] => {
    if (!state.data?.arbitrageData?.opportunities) return []
    
    return [...state.data.arbitrageData.opportunities]
      .sort((a, b) => b.profitUSD - a.profitUSD)
      .slice(0, 10)
  }, [state.data])

  // Obtener blockchains más rentables
  const getTopChainsByTVL = useCallback((): BlockchainSummary[] => {
    if (!state.data?.blockchainSummaries) return []
    
    return [...state.data.blockchainSummaries]
      .sort((a, b) => b.totalTVL - a.totalTVL)
  }, [state.data])

  // Calcular métricas agregadas por tipo de DEX
  const getDEXMetricsByType = useCallback((): { [type: string]: { count: number, tvl: number } } => {
    if (!state.data?.blockchainSummaries) return {}
    
    const metrics: { [type: string]: { count: number, tvl: number } } = {}
    
    state.data.blockchainSummaries.forEach(chain => {
      chain.dexMetrics.topDexes.forEach(dex => {
        if (!metrics[dex.type]) {
          metrics[dex.type] = { count: 0, tvl: 0 }
        }
        metrics[dex.type].count += 1
        metrics[dex.type].tvl += dex.tvl
      })
    })
    
    return metrics
  }, [state.data])

  // Calcular métricas de lending por protocolo
  const getLendingMetrics = useCallback((): { totalTVL: number, avgBorrowRate: number, totalProtocols: number } => {
    if (!state.data?.blockchainSummaries) return { totalTVL: 0, avgBorrowRate: 0, totalProtocols: 0 }
    
    let totalTVL = 0
    let totalBorrowRate = 0
    let totalProtocols = 0
    
    state.data.blockchainSummaries.forEach(chain => {
      totalTVL += chain.lendingMetrics.totalTVL
      totalBorrowRate += chain.lendingMetrics.averageBorrowRate * chain.lendingMetrics.totalProtocols
      totalProtocols += chain.lendingMetrics.totalProtocols
    })
    
    return {
      totalTVL,
      avgBorrowRate: totalProtocols > 0 ? totalBorrowRate / totalProtocols : 0,
      totalProtocols
    }
  }, [state.data])

  // Formatear valores monetarios
  const formatCurrency = useCallback((value: number, decimals: number = 2): string => {
    if (value >= 1_000_000_000) {
      return `$${(value / 1_000_000_000).toFixed(decimals)}B`
    } else if (value >= 1_000_000) {
      return `$${(value / 1_000_000).toFixed(decimals)}M`
    } else if (value >= 1_000) {
      return `$${(value / 1_000).toFixed(decimals)}K`
    } else {
      return `$${value.toFixed(decimals)}`
    }
  }, [])

  // Formatear porcentajes
  const formatPercentage = useCallback((value: number, decimals: number = 2): string => {
    return `${value.toFixed(decimals)}%`
  }, [])

  // Verificar si hay datos frescos (menos de 1 minuto)
  const isDataFresh = useCallback((): boolean => {
    if (!state.data) return false
    const now = Date.now()
    const dataAge = now - state.data.timestamp
    return dataAge < 60000 // 1 minuto
  }, [state.data])

  return {
    // Estado básico
    data: state.data,
    isLoading: state.isLoading,
    error: state.error,
    lastUpdated: state.lastUpdated,
    
    // Funciones de control
    refresh: fetchSnapshot,
    
    // Funciones derivadas de análisis
    getOpportunitiesByChain,
    getTotalTVL,
    getTopOpportunities,
    getTopChainsByTVL,
    getDEXMetricsByType,
    getLendingMetrics,
    
    // Funciones de formateo
    formatCurrency,
    formatPercentage,
    
    // Verificadores de estado
    hasError: !!state.error,
    isReady: !!state.data && !state.isLoading && !state.error,
    isDataFresh: isDataFresh(),
    
    // Datos derivados para fácil acceso
    systemHealth: state.data?.systemHealth || null,
    blockchainSummaries: state.data?.blockchainSummaries || [],
    arbitrageOpportunities: state.data?.arbitrageData?.opportunities || [],
    totalOpportunities: state.data?.totalOpportunities || 0,
    profitableOpportunities: state.data?.profitableOpportunities || 0,
    averageProfitability: state.data?.averageProfitability || 0,
    executionTime: state.data?.executionTime || 0
  }
}
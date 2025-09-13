'use client'

import { useState, useEffect } from 'react'
import { 
  DashboardSummary,
  DashboardSummaryResponse,
  ApiError,
  Chain
} from '../types/api'

// Legacy interface for backward compatibility
export interface DashboardData {
  totalNetworks: number
  connectedNetworks: number
  totalBalance: number
  activeArbitrageOpportunities: number
  blockchainNetworks: string[]
  networkIntegration: {
    implemented: number
    connected: number
    syncPercentage: number
  }
  balanceByNetwork: { [chainId: string]: number }
  systemStatus: 'active' | 'error' | 'maintenance' | 'unknown'
  lastUpdate: number
}

interface DashboardState {
  data: DashboardSummary | null
  legacyData: DashboardData | null
  isLoading: boolean
  error: string | null
}

export function useDashboardData() {
  const [state, setState] = useState<DashboardState>({
    data: null,
    legacyData: null,
    isLoading: false,
    error: null
  })

  // Función para obtener datos del dashboard desde el backend de arbitraje
  const fetchDashboardData = async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const response = await fetch('/api/v2/dashboard/summary', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken') || ''}`,
        },
      })

      if (!response.ok) {
        throw new Error(`Dashboard API error: ${response.status}`)
      }

      const result: DashboardSummaryResponse | ApiError = await response.json()

      if (result.success) {
        const dashboardResult = result as DashboardSummaryResponse
        const summary = dashboardResult.summary
        
        // Transform to legacy format for backward compatibility
        const legacyData: DashboardData = {
          totalNetworks: summary.activeBlockchains,
          connectedNetworks: summary.activeBlockchains,
          totalBalance: summary.totalProfitUsd,
          activeArbitrageOpportunities: summary.totalOpportunities,
          blockchainNetworks: Object.keys(summary.profitByChain),
          networkIntegration: {
            implemented: summary.activeBlockchains,
            connected: summary.activeBlockchains,
            syncPercentage: 95 // Mock percentage
          },
          balanceByNetwork: summary.profitByChain as { [chainId: string]: number },
          systemStatus: 'active',
          lastUpdate: Date.now()
        }
        
        setState({
          data: summary,
          legacyData,
          isLoading: false,
          error: null
        })
      } else {
        const errorResult = result as ApiError
        throw new Error(errorResult.error || 'Failed to fetch dashboard data')
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }))
    }
  }

  // Auto-fetch al montar el componente
  useEffect(() => {
    fetchDashboardData()
  }, [])

  // Auto-refresh cada 30 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      if (!state.isLoading) {
        fetchDashboardData()
      }
    }, 30000)

    return () => clearInterval(interval)
  }, [state.isLoading])

  // Función para formatear balance total
  const formatTotalBalance = (): string => {
    if (!state.data) return '$0.00'
    
    const balance = state.data.totalBalance
    if (balance >= 1000000) {
      return `$${(balance / 1000000).toFixed(2)}M`
    } else if (balance >= 1000) {
      return `$${(balance / 1000).toFixed(1)}K`
    } else {
      return `$${balance.toFixed(2)}`
    }
  }

  // Función para obtener estado del sistema con color
  const getSystemStatus = (): { text: string; color: string } => {
    if (!state.data) return { text: 'Desconocido', color: 'text-gray-500' }
    
    switch (state.data.systemStatus) {
      case 'active':
        return { text: 'Activo', color: 'text-emerald-600' }
      case 'error':
        return { text: 'Error', color: 'text-red-600' }
      case 'maintenance':
        return { text: 'Mantenimiento', color: 'text-yellow-600' }
      default:
        return { text: 'Desconocido', color: 'text-gray-500' }
    }
  }

  // Función para obtener porcentaje de sincronización
  const getSyncPercentage = (): number => {
    if (!state.data) return 0
    return state.data.networkIntegration.syncPercentage
  }

  return {
    // Estado (new API)
    data: state.data,
    summary: state.data,
    
    // Estado (legacy compatibility)
    legacyData: state.legacyData,
    
    // Loading and error states
    isLoading: state.isLoading,
    error: state.error,

    // Funciones de utilidad
    formatTotalBalance,
    getSystemStatus,
    getSyncPercentage,
    
    // Función para refrescar datos
    refresh: fetchDashboardData,

    // Verificadores de estado
    hasError: !!state.error,
    isReady: !!(state.data || state.legacyData) && !state.isLoading && !state.error,
    
    // Additional utility functions for new API
    getTotalOpportunities: () => state.data?.totalOpportunities || 0,
    getSuccessfulExecutions: () => state.data?.successfulExecutions || 0,
    getAverageProfitPercentage: () => state.data?.averageProfitPercentage || 0,
    getTopPerformingChain: () => state.data?.topPerformingChain || 'ethereum' as Chain,
    getRecentExecutions: () => state.data?.recentExecutions || [],
    getProfitByChain: () => state.data?.profitByChain || {},
    getExecutionsByHour: () => state.data?.executionsByHour || []
  }
}
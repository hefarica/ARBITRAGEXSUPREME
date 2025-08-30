'use client'

import { useState, useEffect } from 'react'

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
  data: DashboardData | null
  isLoading: boolean
  error: string | null
}

export function useDashboardData() {
  const [state, setState] = useState<DashboardState>({
    data: null,
    isLoading: false,
    error: null
  })

  // Función para obtener datos del dashboard desde el backend de arbitraje
  const fetchDashboardData = async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }))

    try {
      const response = await fetch('/api/arbitrage/dashboard/summary', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Dashboard API error: ${response.status}`)
      }

      const result = await response.json()

      if (result.success) {
        setState({
          data: result.dashboard,
          isLoading: false,
          error: null
        })
      } else {
        throw new Error(result.error || 'Failed to fetch dashboard data')
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
    // Estado
    data: state.data,
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
    isReady: !!state.data && !state.isLoading && !state.error
  }
}
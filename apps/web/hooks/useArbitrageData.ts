'use client'

import useSWR from 'swr'

// API base URL - puerto 3001 donde corre el backend
const API_BASE_URL = 'http://localhost:3001/api/v2'

// Fetcher function for SWR
const fetcher = (url: string) => fetch(url).then((res) => res.json())

// Types based on the actual API responses
export interface NetworkStatus {
  id: string
  name: string
  symbol: string
  connected: boolean
  blockNumber: number
  blockTime: number
  gasPrice: string
  lastCheck: string
  explorerUrl: string
  nativeCurrency: {
    name: string
    symbol: string
    decimals: number
  }
  hasWebSocket: boolean
  rpcStatus: string
}

export interface ArbitrageOpportunity {
  id: string
  strategy: string
  blockchainFrom: string
  blockchainTo: string
  tokenIn: string
  tokenOut: string
  amountIn: string
  expectedAmountOut: string
  profitAmount: string
  profitPercentage: number
  gasEstimate: string
  confidence: number
  expiresAt: string
  detected_at: string
  source: string
  dexPath: Array<{
    exchange: string
    poolAddress: string
    fee: number
  }>
  networkDetails: {
    from: NetworkStatus
    to: NetworkStatus
  }
}

export interface DashboardMetrics {
  totals: {
    tenants: number
    users: number
    active_configs: number
    active_opportunities: number
  }
  blockchain: {
    networks: number
    active_connections: number
    live_opportunities: number
    total_volume_24h: number
    successful_arbitrages_24h: number
    avg_execution_time: string
    network_uptime: string
  }
  real_time_metrics: {
    live_scanning: boolean
    opportunities_per_minute: string
    profit_rate: string
    market_efficiency: string
  }
  recent_performance: {
    opportunities_24h: number
    total_potential_profit_24h: number
    avg_profit_percentage_24h: number
    live_profit_potential: string
  }
  recent_opportunities: Array<{
    profit_percentage: string
    profit_usd: string
    strategy_name: string
    blockchain_from: string
    blockchain_to: string
  }>
  top_live_opportunities: ArbitrageOpportunity[]
}

// Custom hooks for each data endpoint
export function useNetworks() {
  const { data, error, isLoading, mutate } = useSWR(
    `${API_BASE_URL}/blockchain/networks`,
    fetcher,
    {
      refreshInterval: 30000, // Refresh every 30 seconds
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    }
  )

  return {
    networks: data?.networks || [],
    totalNetworks: data?.total || 0,
    activeConnections: data?.active_connections || 0,
    isLoading,
    error,
    refresh: mutate,
  }
}

export function useOpportunities() {
  const { data, error, isLoading, mutate } = useSWR(
    `${API_BASE_URL}/arbitrage/opportunities`,
    fetcher,
    {
      refreshInterval: 5000, // Refresh every 5 seconds for real-time data
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    }
  )

  return {
    opportunities: data?.opportunities || [],
    totalOpportunities: data?.total || 0,
    breakdown: data?.breakdown || {},
    marketConditions: data?.market_conditions || {},
    isLoading,
    error,
    refresh: mutate,
  }
}

export function useDashboardMetrics() {
  const { data, error, isLoading, mutate } = useSWR(
    `${API_BASE_URL}/analytics/dashboard`,
    fetcher,
    {
      refreshInterval: 10000, // Refresh every 10 seconds
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    }
  )

  return {
    metrics: data?.dashboard as DashboardMetrics,
    isLoading,
    error,
    refresh: mutate,
  }
}

// Combined hook for all dashboard data
export function useArbitrageData() {
  const networksData = useNetworks()
  const opportunitiesData = useOpportunities()
  const metricsData = useDashboardMetrics()

  const isLoading = networksData.isLoading || opportunitiesData.isLoading || metricsData.isLoading
  const hasError = networksData.error || opportunitiesData.error || metricsData.error

  const refresh = () => {
    networksData.refresh()
    opportunitiesData.refresh()
    metricsData.refresh()
  }

  return {
    // Networks data
    networks: networksData.networks,
    totalNetworks: networksData.totalNetworks,
    activeConnections: networksData.activeConnections,
    
    // Opportunities data
    opportunities: opportunitiesData.opportunities,
    totalOpportunities: opportunitiesData.totalOpportunities,
    breakdown: opportunitiesData.breakdown,
    marketConditions: opportunitiesData.marketConditions,
    
    // Metrics data
    metrics: metricsData.metrics,
    
    // Loading and error states
    isLoading,
    hasError,
    error: hasError ? (networksData.error || opportunitiesData.error || metricsData.error) : null,
    
    // Refresh function
    refresh,
  }
}
import useSWR from 'swr'
import axios from 'axios'

const API_BASE_URL = 'http://localhost:8000'

const fetcher = async (url: string) => {
  try {
    const response = await axios.get(url)
    return response.data
  } catch (error) {
    console.error('Error fetching data:', error)
    throw error
  }
}

export function useNetworkStats() {
  const { data, error, mutate } = useSWR(`${API_BASE_URL}/api/v2/blockchain/status`, fetcher, {
    refreshInterval: 5000, // Actualizar cada 5 segundos
    revalidateOnFocus: true,
  })

  // Transform networks object to array
  const networksArray = data?.networks ? Object.entries(data.networks).map(([id, network]: [string, any]) => ({
    id,
    name: network.name,
    status: network.connected ? 'active' : 'inactive',
    connections: network.connected ? 1 : 0,
    avgLatency: Math.floor(Math.random() * 200) + 50, // Simulated latency
    blockNumber: network.blockNumber,
    gasPrice: network.gasPrice,
    performance: network.performance
  })) : []

  return {
    data: networksArray,
    totalNetworks: data?.summary?.total_networks || 0,
    activeConnections: data?.summary?.connected_networks || 0,
    isLoading: !error && !data,
    isError: error,
    mutate
  }
}

export function useArbitrageOpportunities() {
  const { data, error, mutate } = useSWR(`${API_BASE_URL}/api/v2/arbitrage/opportunities`, fetcher, {
    refreshInterval: 3000, // Actualizar cada 3 segundos
    revalidateOnFocus: true,
  })

  // Transform opportunities to match expected format
  const opportunities = data?.opportunities?.map((opp: any) => ({
    id: opp.id,
    tokenA: opp.tokenIn || 'N/A',
    tokenB: opp.tokenOut || 'N/A', 
    exchangeA: opp.dexPath?.[0]?.exchange || 'Unknown',
    exchangeB: opp.dexPath?.[1]?.exchange || 'Unknown',
    profitAmount: parseFloat(opp.profitAmount || '0'),
    profitPercentage: opp.profitPercentage || 0,
    network: opp.networkDetails?.from?.name || opp.blockchainFrom || 'Unknown',
    timestamp: opp.detected_at || new Date().toISOString(),
    strategy: opp.strategy || 'cross_exchange',
    confidence: opp.confidence || 0.8
  })) || []

  return {
    data: opportunities,
    totalProfit: parseFloat(data?.breakdown?.total_potential_profit || '0'),
    averageProfit: parseFloat(data?.breakdown?.avg_profit_percentage || '0'),
    isLoading: !error && !data,
    isError: error,
    mutate
  }
}

export function useDashboardMetrics() {
  const { data, error, mutate } = useSWR(`${API_BASE_URL}/api/v2/status`, fetcher, {
    refreshInterval: 10000, // Actualizar cada 10 segundos
    revalidateOnFocus: true,
  })

  return {
    data: data || {},
    totalProfit: 0, // Will be calculated from opportunities
    profitToday: 0,
    profitChange: 12.5, // Simulated data
    executedTrades: 147, // Simulated data
    successRate: 96.7, // Simulated data
    isLoading: !error && !data,
    isError: error,
    mutate
  }
}

export function useHealthCheck() {
  const { data, error } = useSWR(`${API_BASE_URL}/health`, fetcher, {
    refreshInterval: 30000, // Actualizar cada 30 segundos
  })

  return {
    isHealthy: data?.status === 'ok',
    apiVersion: data?.version || 'unknown',
    uptime: data?.uptime || 0,
    isLoading: !error && !data,
    isError: error
  }
}
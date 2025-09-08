'use client'

import React, { useEffect, useState } from 'react'
// import { DashboardLayout } from './dashboard-layout' // Archivo no encontrado
import { MetricsCards } from './metrics-cards'
import { OpportunitiesTable } from './opportunities-table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  TrendingUp, 
  TrendingDown, 
  Network, 
  Activity, 
  Zap,
  AlertCircle,
  CheckCircle,
  Clock,
  RefreshCw
} from 'lucide-react'
import { cn, formatCurrency, formatPercentage, getNetworkStatusColor, getProfitColor, formatTimeAgo, getNetworkColor } from '@/lib/utils'

// Enhanced demo data generator with more realistic patterns
const generateEnhancedDemoData = () => {
  const baseMetrics = {
    totalProfit: 45678.32 + (Math.random() - 0.5) * 5000,
    totalProfitChange: (Math.random() - 0.3) * 20,
    dailyVolume: 1250000 + (Math.random() - 0.5) * 200000,
    dailyVolumeChange: (Math.random() - 0.3) * 15,
    activeOpportunities: Math.floor(Math.random() * 50) + 15,
    activeOpportunitiesChange: Math.floor((Math.random() - 0.5) * 10),
    successRate: 0.87 + (Math.random() - 0.5) * 0.1,
    successRateChange: (Math.random() - 0.5) * 0.05,
    avgExecutionTime: 850 + Math.floor((Math.random() - 0.5) * 300),
    avgExecutionTimeChange: Math.floor((Math.random() - 0.5) * 100),
    networksOnline: 9 + Math.floor(Math.random() * 3),
    networksOnlineChange: Math.floor((Math.random() - 0.5) * 2)
  }

  const networks = [
    { id: 'ethereum', name: 'Ethereum', status: 'active', connections: 3, avgLatency: 120, blockNumber: 20500000, gasPrice: '15 gwei' },
    { id: 'bsc', name: 'BSC', status: 'active', connections: 2, avgLatency: 95, blockNumber: 42100000, gasPrice: '3 gwei' },
    { id: 'polygon', name: 'Polygon', status: 'active', connections: 2, avgLatency: 80, blockNumber: 62800000, gasPrice: '30 gwei' },
    { id: 'arbitrum', name: 'Arbitrum', status: 'active', connections: 1, avgLatency: 45, blockNumber: 265400000, gasPrice: '0.1 gwei' },
    { id: 'optimism', name: 'Optimism', status: 'active', connections: 1, avgLatency: 65, blockNumber: 128900000, gasPrice: '0.001 gwei' },
    { id: 'avalanche', name: 'Avalanche', status: 'active', connections: 1, avgLatency: 85, blockNumber: 53200000, gasPrice: '25 nAVAX' },
    { id: 'solana', name: 'Solana', status: 'active', connections: 1, avgLatency: 200, blockNumber: 298700000, gasPrice: '5000 lamports' },
    { id: 'fantom', name: 'Fantom', status: 'active', connections: 1, avgLatency: 90, blockNumber: 92400000, gasPrice: '20 gwei' },
    { id: 'base', name: 'Base', status: 'active', connections: 1, avgLatency: 55, blockNumber: 22100000, gasPrice: '0.05 gwei' },
    { id: 'cardano', name: 'Cardano', status: 'maintenance', connections: 0, avgLatency: 0, blockNumber: 0, gasPrice: 'N/A' },
    { id: 'bitcoin', name: 'Bitcoin', status: 'maintenance', connections: 0, avgLatency: 0, blockNumber: 0, gasPrice: 'N/A' },
    { id: 'cosmos', name: 'Cosmos', status: 'inactive', connections: 0, avgLatency: 0, blockNumber: 0, gasPrice: 'N/A' },
  ]

  const tokenPairs = [
    ['USDT', 'USDC'], ['ETH', 'WETH'], ['BTC', 'WBTC'], ['DAI', 'USDC'],
    ['MATIC', 'ETH'], ['BNB', 'ETH'], ['AVAX', 'USDC'], ['SOL', 'USDT']
  ]

  const exchanges = [
    'Uniswap', 'PancakeSwap', 'SushiSwap', 'Curve', 'Balancer', 
    'Trader Joe', 'QuickSwap', 'Raydium', 'Orca', 'Jupiter'
  ]

  const strategies = ['cross_exchange', 'triangular', 'statistical', 'liquidation']
  const riskLevels: ('low' | 'medium' | 'high')[] = ['low', 'medium', 'high']
  const statuses: ('active' | 'executing' | 'completed' | 'failed')[] = ['active', 'executing', 'completed', 'failed']

  const opportunities = Array.from({ length: Math.floor(Math.random() * 30) + 20 }, (_, i) => {
    const [tokenA, tokenB] = tokenPairs[Math.floor(Math.random() * tokenPairs.length)]
    const exchangeA = exchanges[Math.floor(Math.random() * exchanges.length)]
    let exchangeB = exchanges[Math.floor(Math.random() * exchanges.length)]
    while (exchangeB === exchangeA) {
      exchangeB = exchanges[Math.floor(Math.random() * exchanges.length)]
    }
    
    const profitPercentage = Math.random() * 8 + 0.5
    const volume = Math.random() * 50000 + 1000
    const profitAmount = (volume * profitPercentage) / 100
    
    return {
      id: (i + 1).toString(),
      tokenA,
      tokenB,
      exchangeA,
      exchangeB,
      profitAmount,
      profitPercentage,
      network: networks[Math.floor(Math.random() * 9)].name, // Only active networks
      timestamp: new Date(Date.now() - Math.random() * 3600000).toISOString(),
      strategy: strategies[Math.floor(Math.random() * strategies.length)],
      risk: riskLevels[Math.floor(Math.random() * riskLevels.length)],
      status: statuses[Math.floor(Math.random() * statuses.length)],
      volume,
      gasEstimate: Math.floor(Math.random() * 100) + 10
    }
  })

  return {
    metrics: baseMetrics,
    networks,
    opportunities
  }
}

export function ProfessionalDashboard() {
  const [data, setData] = useState(generateEnhancedDemoData())
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(new Date())

  // Real-time updates every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setData(generateEnhancedDemoData())
      setLastUpdate(new Date())
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  const handleRefresh = () => {
    setIsRefreshing(true)
    setData(generateEnhancedDemoData())
    setLastUpdate(new Date())
    setTimeout(() => setIsRefreshing(false), 1000)
  }

  const activeNetworks = data.networks.filter(n => n.status === 'active')
  const inactiveNetworks = data.networks.filter(n => n.status !== 'active')

  return (
    <div className="space-y-6 p-6">
      {/* Header simplificado */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard de Arbitraje</h1>
        <p className="text-sm text-gray-600">Actualizado {formatTimeAgo(lastUpdate.toISOString())}</p>
        <button 
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {isRefreshing ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>
      
      <div className="space-y-6">
        {/* Metrics Cards */}
        <MetricsCards data={data.metrics} />

        {/* Networks Status and Opportunities */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Networks Status */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center space-x-2">
                <Network className="w-5 h-5 text-emerald-600" />
                <span>Estado de Redes</span>
              </CardTitle>
              <CardDescription>
                Conexiones blockchain en tiempo real
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Active Networks */}
                <div>
                  <h4 className="text-sm font-medium text-slate-700 mb-2 flex items-center">
                    <CheckCircle className="w-4 h-4 text-emerald-500 mr-2" />
                    Activas ({activeNetworks.length})
                  </h4>
                  <div className="space-y-2">
                    {activeNetworks.slice(0, 6).map((network) => (
                      <div key={network.id} className="flex items-center justify-between p-2 bg-emerald-50 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                          <span className="text-sm font-medium text-slate-800">{network.name}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-slate-600">{network.avgLatency}ms</div>
                          <Badge variant="outline" className="text-xs bg-emerald-100 text-emerald-800 border-emerald-200">
                            {network.connections} conn
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Inactive/Maintenance Networks */}
                {inactiveNetworks.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-slate-700 mb-2 flex items-center">
                      <AlertCircle className="w-4 h-4 text-amber-500 mr-2" />
                      Inactivas ({inactiveNetworks.length})
                    </h4>
                    <div className="space-y-2">
                      {inactiveNetworks.map((network) => (
                        <div key={network.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                            <span className="text-sm text-slate-600">{network.name}</span>
                          </div>
                          <Badge variant="outline" className="text-xs bg-amber-100 text-amber-800 border-amber-200">
                            {network.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center space-x-2">
                <Activity className="w-5 h-5 text-emerald-600" />
                <span>Estadísticas Rápidas</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {/* Best Opportunities */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-slate-700">Mejores Oportunidades</h4>
                  {data.opportunities
                    .filter(opp => opp.status === 'active')
                    .sort((a, b) => b.profitPercentage - a.profitPercentage)
                    .slice(0, 3)
                    .map((opp, index) => (
                      <div key={opp.id} className="flex items-center justify-between p-3 bg-gradient-to-r from-emerald-50 to-emerald-100 rounded-lg border border-emerald-200">
                        <div>
                          <div className="font-medium text-slate-900 text-sm">
                            {opp.tokenA}/{opp.tokenB}
                          </div>
                          <div className="text-xs text-slate-600">
                            {opp.exchangeA} → {opp.exchangeB}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-emerald-700">
                            {formatPercentage(opp.profitPercentage)}
                          </div>
                          <Badge variant="outline" className={getNetworkColor(opp.network)}>
                            {opp.network}
                          </Badge>
                        </div>
                      </div>
                    ))}
                </div>

                {/* Recent Activity */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-slate-700">Actividad Reciente</h4>
                  {data.opportunities
                    .filter(opp => opp.status === 'completed')
                    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                    .slice(0, 3)
                    .map((opp, index) => (
                      <div key={opp.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div>
                          <div className="font-medium text-slate-900 text-sm">
                            {opp.tokenA}/{opp.tokenB}
                          </div>
                          <div className="text-xs text-slate-600">
                            {formatTimeAgo(opp.timestamp)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium text-emerald-600">
                            {formatCurrency(opp.profitAmount)}
                          </div>
                          <Badge variant="outline" className="text-xs bg-emerald-100 text-emerald-800 border-emerald-200">
                            Completado
                          </Badge>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Opportunities Table */}
        <OpportunitiesTable opportunities={data.opportunities} />
      </div>
    </div>
  )
}
'use client'

import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn, formatCurrency, formatPercentage, getNetworkStatusColor, getProfitColor } from '@/lib/utils'
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Network, 
  Activity, 
  Zap,
  RefreshCw,
  Settings,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react'

// Demo data that simulates the real API responses
const generateDemoData = () => {
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

  const opportunities = [
    {
      id: '1',
      tokenA: 'USDT',
      tokenB: 'USDC',
      exchangeA: 'Uniswap',
      exchangeB: 'PancakeSwap',
      profitAmount: 384.22,
      profitPercentage: 4.06,
      network: 'Ethereum',
      timestamp: new Date().toISOString(),
      strategy: 'cross_exchange',
      confidence: 0.89
    },
    {
      id: '2',
      tokenA: 'ETH',
      tokenB: 'WETH',
      exchangeA: 'SushiSwap',
      exchangeB: 'QuickSwap',
      profitAmount: 245.80,
      profitPercentage: 3.03,
      network: 'Polygon',
      timestamp: new Date().toISOString(),
      strategy: 'cross_chain_arbitrage',
      confidence: 0.91
    },
    {
      id: '3',
      tokenA: 'UNI',
      tokenB: 'UNI',
      exchangeA: 'Trader Joe',
      exchangeB: 'QuickSwap',
      profitAmount: 180.40,
      profitPercentage: 2.55,
      network: 'Avalanche',
      timestamp: new Date().toISOString(),
      strategy: 'cross_chain_arbitrage',
      confidence: 0.78
    },
    {
      id: '4',
      tokenA: 'DAI',
      tokenB: 'DAI',
      exchangeA: 'Uniswap V3',
      exchangeB: 'SushiSwap',
      profitAmount: 136.20,
      profitPercentage: 1.99,
      network: 'Ethereum',
      timestamp: new Date().toISOString(),
      strategy: 'triangular_arbitrage',
      confidence: 0.97
    },
    {
      id: '5',
      tokenA: 'WBTC',
      tokenB: 'WBTC',
      exchangeA: 'Jupiter',
      exchangeB: 'Trader Joe',
      profitAmount: 134.87,
      profitPercentage: 1.81,
      network: 'Solana',
      timestamp: new Date().toISOString(),
      strategy: 'triangular_arbitrage',
      confidence: 0.93
    },
    {
      id: '6',
      tokenA: 'LINK',
      tokenB: 'LINK',
      exchangeA: 'Jupiter',
      exchangeB: 'Trader Joe',
      profitAmount: 97.66,
      profitPercentage: 1.32,
      network: 'Solana',
      timestamp: new Date().toISOString(),
      strategy: 'cross_exchange',
      confidence: 0.79
    },
    {
      id: '7',
      tokenA: 'WBTC',
      tokenB: 'WBTC',
      exchangeA: 'Uniswap V3',
      exchangeB: 'Uniswap V3',
      profitAmount: 84.15,
      profitPercentage: 1.15,
      network: 'Arbitrum',
      timestamp: new Date().toISOString(),
      strategy: 'cross_exchange',
      confidence: 0.94
    },
    {
      id: '8',
      tokenA: 'AAVE',
      tokenB: 'AAVE',
      exchangeA: 'SpiritSwap',
      exchangeB: 'Raydium',
      profitAmount: 51.03,
      profitPercentage: 0.87,
      network: 'Fantom',
      timestamp: new Date().toISOString(),
      strategy: 'flash_loan_arbitrage',
      confidence: 0.87
    }
  ]

  return { networks, opportunities }
}

export function DashboardDemo() {
  const [data, setData] = useState(generateDemoData())
  const [isHealthy, setIsHealthy] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(new Date())
  const [isLoading, setIsLoading] = useState(false)

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate slight changes in data
      const newData = generateDemoData()
      // Randomly update some values
      newData.opportunities.forEach(opp => {
        opp.profitAmount = parseFloat((opp.profitAmount * (0.95 + Math.random() * 0.1)).toFixed(2))
        opp.profitPercentage = parseFloat((opp.profitPercentage * (0.95 + Math.random() * 0.1)).toFixed(3))
      })
      
      newData.networks.forEach(network => {
        if (network.status === 'active') {
          network.avgLatency = Math.floor(network.avgLatency * (0.9 + Math.random() * 0.2))
          network.blockNumber += Math.floor(Math.random() * 3)
        }
      })

      setData(newData)
      setLastUpdate(new Date())
    }, 3000) // Update every 3 seconds

    return () => clearInterval(interval)
  }, [])

  const refreshAll = () => {
    setIsLoading(true)
    setTimeout(() => {
      setData(generateDemoData())
      setLastUpdate(new Date())
      setIsLoading(false)
    }, 1000)
  }

  // Calculate statistics
  const activeNetworks = data.networks.filter(n => n.status === 'active').length
  const totalConnections = data.networks.reduce((sum, n) => sum + n.connections, 0)
  const totalProfit = data.opportunities.reduce((sum, opp) => sum + opp.profitAmount, 0)
  const avgProfit = data.opportunities.length > 0 
    ? data.opportunities.reduce((sum, opp) => sum + opp.profitPercentage, 0) / data.opportunities.length 
    : 0

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-3xl font-bold text-gray-900">ArbitrageX Pro 2025</h1>
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-sm text-gray-600">
                Sistema Online • Demo v2.0.0
              </span>
            </div>
          </div>
          <p className="text-gray-600">Dashboard de Arbitraje DeFi Enterprise - Datos en Tiempo Real</p>
          <p className="text-xs text-gray-500">
            Última actualización: {lastUpdate.toLocaleTimeString()}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Configuración
          </Button>
          <Button size="sm" onClick={refreshAll} disabled={isLoading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ganancia Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(totalProfit)}
            </div>
            <p className="text-xs text-green-600">
              +12.5% desde ayer
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Redes Blockchain</CardTitle>
            <Network className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <span className="text-green-600">{activeNetworks}</span>
              <span className="text-gray-400">/12</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {totalConnections} conexiones activas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Oportunidades Activas</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.opportunities.length}</div>
            <p className="text-xs text-muted-foreground">
              Detectadas en tiempo real
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ganancia Promedio</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatPercentage(avgProfit)}
            </div>
            <p className="text-xs text-muted-foreground">
              Por oportunidad
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Estadísticas adicionales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trades Ejecutados</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">147</div>
            <p className="text-xs text-muted-foreground">Total ejecutados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasa de Éxito</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">96.7%</div>
            <p className="text-xs text-muted-foreground">Trades exitosos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uptime Sistema</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">24h 15m</div>
            <p className="text-xs text-muted-foreground">Tiempo activo</p>
          </CardContent>
        </Card>
      </div>

      {/* Estado de las redes */}
      <Card>
        <CardHeader>
          <CardTitle>Estado de Redes Blockchain</CardTitle>
          <CardDescription>
            Monitoreo en tiempo real de conectividad y rendimiento de 12 redes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.networks.map((network) => (
              <div key={network.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors">
                <div className="flex items-center space-x-3">
                  <div className={cn(
                    "w-3 h-3 rounded-full",
                    network.status === 'active' ? 'bg-green-500' :
                    network.status === 'maintenance' ? 'bg-yellow-500' : 'bg-red-500'
                  )} />
                  <div>
                    <p className="font-medium">{network.name}</p>
                    <p className="text-sm text-gray-500">
                      {network.connections} conexiones • {network.avgLatency}ms
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <Badge 
                    variant={
                      network.status === 'active' ? 'success' :
                      network.status === 'maintenance' ? 'warning' : 'destructive'
                    }
                  >
                    {network.status}
                  </Badge>
                  <p className="text-xs text-gray-500 mt-1">
                    {network.gasPrice}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Oportunidades de arbitraje */}
      <Card>
        <CardHeader>
          <CardTitle>Oportunidades de Arbitraje en Tiempo Real</CardTitle>
          <CardDescription>
            Detectadas automáticamente a través de todas las redes blockchain activas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.opportunities.map((opportunity) => (
              <div key={opportunity.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Zap className="h-4 w-4 text-yellow-500" />
                    <span className="font-medium">
                      {opportunity.tokenA}/{opportunity.tokenB}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500">
                    {opportunity.exchangeA} → {opportunity.exchangeB}
                  </div>
                  <Badge variant="outline">{opportunity.network}</Badge>
                  <Badge variant="secondary">{opportunity.strategy}</Badge>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <div className={cn("font-medium", getProfitColor(opportunity.profitAmount))}>
                      {formatCurrency(opportunity.profitAmount)}
                    </div>
                    <div className={cn("text-sm", getProfitColor(opportunity.profitPercentage))}>
                      {formatPercentage(opportunity.profitPercentage)} • {(opportunity.confidence * 100).toFixed(1)}% conf.
                    </div>
                  </div>
                  <Button size="sm" variant="outline">
                    Ejecutar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
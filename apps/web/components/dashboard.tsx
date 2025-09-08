'use client'

import React from 'react'
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
  Settings
} from 'lucide-react'

interface NetworkStatus {
  id: string
  name: string
  status: 'active' | 'inactive' | 'maintenance'
  connections: number
  avgLatency: number
}

interface ArbitrageOpportunity {
  id: string
  tokenA: string
  tokenB: string
  exchangeA: string
  exchangeB: string
  profitAmount: number
  profitPercentage: number
  network: string
  timestamp: string
}

interface DashboardProps {
  networks?: NetworkStatus[]
  opportunities?: ArbitrageOpportunity[]
  totalProfit?: number
  activeConnections?: number
  isLoading?: boolean
}

const defaultNetworks: NetworkStatus[] = [
  { id: '1', name: 'Ethereum', status: 'active', connections: 3, avgLatency: 120 },
  { id: '2', name: 'BSC', status: 'active', connections: 2, avgLatency: 95 },
  { id: '3', name: 'Polygon', status: 'active', connections: 2, avgLatency: 80 },
  { id: '4', name: 'Arbitrum', status: 'maintenance', connections: 0, avgLatency: 0 },
  { id: '5', name: 'Solana', status: 'active', connections: 1, avgLatency: 200 },
]

const defaultOpportunities: ArbitrageOpportunity[] = [
  {
    id: '1',
    tokenA: 'USDT',
    tokenB: 'USDC',
    exchangeA: 'Uniswap',
    exchangeB: 'PancakeSwap',
    profitAmount: 245.80,
    profitPercentage: 1.25,
    network: 'Ethereum',
    timestamp: new Date().toISOString()
  },
  {
    id: '2',
    tokenA: 'ETH',
    tokenB: 'WETH',
    exchangeA: 'SushiSwap',
    exchangeB: 'QuickSwap',
    profitAmount: 180.40,
    profitPercentage: 2.15,
    network: 'Polygon',
    timestamp: new Date().toISOString()
  }
]

export function Dashboard({ 
  networks = defaultNetworks, 
  opportunities = defaultOpportunities,
  totalProfit = 780.40,
  activeConnections = 9,
  isLoading = false 
}: DashboardProps) {
  const activeNetworks = networks.filter(n => n.status === 'active').length
  const avgProfitPercentage = opportunities.length > 0 
    ? opportunities.reduce((sum, opp) => sum + opp.profitPercentage, 0) / opportunities.length 
    : 0

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">ArbitrageX Pro 2025</h1>
          <p className="text-gray-600">Dashboard de Arbitraje DeFi Enterprise</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Configuración
          </Button>
          <Button size="sm">
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
            <p className="text-xs text-muted-foreground">
              +12.5% desde ayer
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Redes Activas</CardTitle>
            <Network className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeNetworks}/12</div>
            <p className="text-xs text-muted-foreground">
              {activeConnections} conexiones totales
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Oportunidades</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{opportunities.length}</div>
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
              {formatPercentage(avgProfitPercentage)}
            </div>
            <p className="text-xs text-muted-foreground">
              Por oportunidad
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Estado de las redes */}
      <Card>
        <CardHeader>
          <CardTitle>Estado de Redes Blockchain</CardTitle>
          <CardDescription>
            Monitoreo en tiempo real de conectividad y rendimiento
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {networks.map((network) => (
              <div key={network.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={cn(
                    "w-3 h-3 rounded-full",
                    network.status === 'active' ? 'bg-green-500' :
                    network.status === 'maintenance' ? 'bg-yellow-500' : 'bg-red-500'
                  )} />
                  <div>
                    <p className="font-medium">{network.name}</p>
                    <p className="text-sm text-gray-500">
                      {network.connections} conexiones
                    </p>
                  </div>
                </div>
                <Badge 
                  variant={
                    network.status === 'active' ? 'success' :
                    network.status === 'maintenance' ? 'warning' : 'destructive'
                  }
                >
                  {network.status}
                </Badge>
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
            Detectadas automáticamente a través de todas las redes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {opportunities.map((opportunity) => (
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
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <div className={cn("font-medium", getProfitColor(opportunity.profitAmount))}>
                      {formatCurrency(opportunity.profitAmount)}
                    </div>
                    <div className={cn("text-sm", getProfitColor(opportunity.profitPercentage))}>
                      {formatPercentage(opportunity.profitPercentage)}
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
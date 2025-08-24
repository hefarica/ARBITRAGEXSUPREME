'use client'

import React from 'react'
import { DashboardLayout } from './dashboard-layout'
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
  RefreshCw,
  DollarSign,
  BarChart3,
  Target,
  Timer,
  ExternalLink,
  Play,
  Pause,
  ArrowUpDown,
  Filter,
  Search,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react'
import { cn, formatCurrency, formatPercentage, getNetworkStatusColor, getProfitColor, formatTimeAgo, getNetworkColor } from '@/lib/utils'
import { useArbitrageData, type ArbitrageOpportunity } from '@/hooks/useArbitrageData'
import { MetaMaskConnector } from '@/components/metamask-connector'

// Metrics Cards Component for Real Data - iOS Montserrat Style
function RealTimeMetricsCards({ metrics }: { metrics: any }) {
  if (!metrics) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="animate-pulse ios-glass">
            <CardContent className="p-6">
              <div className="h-16 bg-slate-200 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const metricsData = [
    {
      title: "Ganancia Potencial 24h",
      value: formatCurrency(metrics.recent_performance?.total_potential_profit_24h || 0),
      change: metrics.recent_performance?.avg_profit_percentage_24h || 0,
      changeType: 'positive' as const,
      icon: DollarSign,
      subtitle: "Total disponible hoy",
      trend: 'up' as const
    },
    {
      title: "Oportunidades Activas",
      value: metrics.blockchain?.live_opportunities?.toString() || '0',
      change: 0,
      changeType: 'positive' as const,
      icon: Target,
      subtitle: "En tiempo real",
      trend: 'up' as const
    },
    {
      title: "Redes Blockchain",
      value: `${metrics.blockchain?.active_connections || 0}/${metrics.blockchain?.networks || 0}`,
      change: 0,
      changeType: 'positive' as const,
      icon: Network,
      subtitle: "Conexiones activas",
      trend: 'up' as const
    },
    {
      title: "Volumen 24h", 
      value: formatCurrency(metrics.blockchain?.total_volume_24h || 0),
      change: 0,
      changeType: 'positive' as const,
      icon: BarChart3,
      subtitle: "Procesado total",
      trend: 'up' as const
    },
    {
      title: "Tiempo Ejecución",
      value: metrics.blockchain?.avg_execution_time || '0ms',
      change: 0,
      changeType: 'positive' as const,
      icon: Timer,
      subtitle: "Promedio de trades",
      trend: 'up' as const
    },
    {
      title: "Arbitrajes Exitosos",
      value: metrics.blockchain?.successful_arbitrages_24h?.toString() || '0',
      change: 0,
      changeType: 'positive' as const,
      icon: TrendingUp,
      subtitle: "Últimas 24h",
      trend: 'up' as const
    }
  ]

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {metricsData.map((metric, index) => {
        const getTrendIcon = () => {
          if (metric.trend === 'up') return ArrowUpRight
          return null
        }

        const TrendIcon = getTrendIcon()
        const Icon = metric.icon

        return (
          <Card key={index} className="relative overflow-hidden ios-glass hover:shadow-lg transition-all duration-200">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="ios-metric-label">{metric.title}</CardTitle>
                <div className="p-2 rounded-lg bg-emerald-100">
                  <Icon className="w-4 h-4 text-emerald-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                <div className="flex items-baseline space-x-2">
                  <span className="ios-metric-value text-slate-900">{metric.value}</span>
                  {TrendIcon && (
                    <div className="flex items-center space-x-1 text-sm text-emerald-600">
                      <TrendIcon className="w-3 h-3" />
                    </div>
                  )}
                </div>
                {metric.subtitle && (
                  <p className="ios-caption text-slate-600">{metric.subtitle}</p>
                )}
              </div>
            </CardContent>
            
            <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-emerald-500 to-emerald-400" />
          </Card>
        )
      })}
    </div>
  )
}

// Real Time Opportunities Table
function RealTimeOpportunitiesTable({ opportunities }: { opportunities: ArbitrageOpportunity[] }) {
  if (!opportunities || opportunities.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Oportunidades de Arbitraje en Tiempo Real</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <div className="text-slate-400 mb-2">
              <Search className="w-12 h-12 mx-auto" />
            </div>
            <p className="text-slate-600">No hay oportunidades activas en este momento</p>
            <p className="text-sm text-slate-500 mt-1">
              El sistema está escaneando las redes blockchain continuamente
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const getRiskColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-emerald-100 text-emerald-800 border-emerald-200'
    if (confidence >= 0.6) return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    return 'bg-red-100 text-red-800 border-red-200'
  }

  const getRiskLevel = (confidence: number) => {
    if (confidence >= 0.8) return 'low'
    if (confidence >= 0.6) return 'medium'
    return 'high'
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Oportunidades de Arbitraje en Tiempo Real</CardTitle>
          <div className="flex items-center space-x-2">
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
              {opportunities.length} detectadas
            </Badge>
            <Badge variant="outline" className="animate-pulse">
              <div className="w-2 h-2 bg-emerald-500 rounded-full mr-2"></div>
              Live
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left p-4 ios-caption text-slate-600">TOKEN/RED</th>
                <th className="text-left p-4 ios-caption text-slate-600">GANANCIA</th>
                <th className="text-left p-4 ios-caption text-slate-600">ESTRATEGIA</th>
                <th className="text-left p-4 ios-caption text-slate-600">CONFIANZA</th>
                <th className="text-left p-4 ios-caption text-slate-600">EXPIRA</th>
                <th className="text-right p-4 ios-caption text-slate-600">ACCIONES</th>
              </tr>
            </thead>
            <tbody>
              {opportunities.slice(0, 10).map((opp) => (
                <tr key={opp.id} className="border-b hover:bg-slate-50 transition-colors">
                  <td className="p-4">
                    <div className="space-y-1">
                      <div className="ios-subheading text-slate-900">
                        {opp.tokenIn}/{opp.tokenOut}
                      </div>
                      <div className="ios-body text-slate-600 flex items-center space-x-2">
                        <Badge variant="outline" className={`${getNetworkColor(opp.blockchainFrom)} ios-caption`}>
                          {opp.blockchainFrom}
                        </Badge>
                        <ArrowUpDown className="w-3 h-3" />
                        <Badge variant="outline" className={`${getNetworkColor(opp.blockchainTo)} ios-caption`}>
                          {opp.blockchainTo}
                        </Badge>
                      </div>
                    </div>
                  </td>
                  
                  <td className="p-4">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <TrendingUp className="w-4 h-4 text-emerald-600" />
                        <span className="ios-subheading text-emerald-600">
                          {formatPercentage(opp.profitPercentage)}
                        </span>
                      </div>
                      <div className="ios-body text-slate-600">
                        {formatCurrency(parseFloat(opp.profitAmount))}
                      </div>
                    </div>
                  </td>
                  
                  <td className="p-4">
                    <div className="text-sm">
                      <div className="font-medium text-slate-900 capitalize">
                        {opp.strategy.replace(/_/g, ' ')}
                      </div>
                      <div className="text-slate-600">
                        Gas: {opp.gasEstimate} units
                      </div>
                    </div>
                  </td>
                  
                  <td className="p-4">
                    <Badge variant="outline" className={getRiskColor(opp.confidence)}>
                      {getRiskLevel(opp.confidence)} ({Math.round(opp.confidence * 100)}%)
                    </Badge>
                  </td>
                  
                  <td className="p-4">
                    <div className="text-sm text-slate-600">
                      {formatTimeAgo(opp.expiresAt)}
                    </div>
                  </td>
                  
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                        <Play className="w-3 h-3 mr-1" />
                        Ejecutar
                      </Button>
                      <Button size="sm" variant="outline">
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

export function RealTimeDashboard() {
  const { 
    networks, 
    opportunities, 
    metrics, 
    isLoading, 
    hasError, 
    error, 
    refresh 
  } = useArbitrageData()

  const handleRefresh = () => {
    refresh()
  }

  if (hasError) {
    return (
      <DashboardLayout
        title="Error de Conexión"
        subtitle="No se puede conectar con el backend"
      >
        <Card className="p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Error de Conexión</h2>
          <p className="text-slate-600 mb-4">
            No se puede conectar con el servidor backend. Verifique que el servicio esté ejecutándose en el puerto 3001.
          </p>
          <Button onClick={handleRefresh} className="bg-emerald-600 hover:bg-emerald-700">
            <RefreshCw className="w-4 h-4 mr-2" />
            Reintentar Conexión
          </Button>
        </Card>
      </DashboardLayout>
    )
  }

  const activeNetworks = networks.filter((n: any) => n.connected)
  const inactiveNetworks = networks.filter((n: any) => !n.connected)

  return (
    <DashboardLayout
      title="Dashboard de Arbitraje en Tiempo Real"
      subtitle="Datos reales de blockchain conectado"
      onRefresh={handleRefresh}
      isRefreshing={isLoading}
    >
      <div className="space-y-6">
        {/* MetaMask Wallet Connection */}
        <div className="grid gap-6 lg:grid-cols-4">
          <div className="lg:col-span-3">
            {/* Real-Time Metrics */}
            <RealTimeMetricsCards metrics={metrics} />
          </div>
          <div className="lg:col-span-1">
            <MetaMaskConnector showDetails={true} />
          </div>
        </div>

        {/* Networks and Quick Stats */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Networks Status */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center space-x-2">
                <Network className="w-5 h-5 text-emerald-600" />
                <span>Redes Blockchain</span>
              </CardTitle>
              <CardDescription>
                Conexiones en tiempo real
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
                    {activeNetworks.slice(0, 6).map((network: any) => (
                      <div key={network.id} className="flex items-center justify-between p-2 bg-emerald-50 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                          <span className="text-sm font-medium text-slate-800">{network.name}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-slate-600">#{network.blockNumber}</div>
                          <Badge variant="outline" className="text-xs bg-emerald-100 text-emerald-800 border-emerald-200">
                            {network.rpcStatus}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Inactive Networks */}
                {inactiveNetworks.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-slate-700 mb-2 flex items-center">
                      <AlertCircle className="w-4 h-4 text-amber-500 mr-2" />
                      Inactivas ({inactiveNetworks.length})
                    </h4>
                    <div className="space-y-2">
                      {inactiveNetworks.map((network: any) => (
                        <div key={network.id} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                            <span className="text-sm text-slate-600">{network.name}</span>
                          </div>
                          <Badge variant="outline" className="text-xs bg-amber-100 text-amber-800 border-amber-200">
                            {network.rpcStatus}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Real-Time Performance */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center space-x-2">
                <Activity className="w-5 h-5 text-emerald-600" />
                <span>Rendimiento en Tiempo Real</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {/* Live Metrics */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-slate-700">Métricas Live</h4>
                  {metrics?.real_time_metrics && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-lg">
                        <span className="text-sm text-slate-600">Escaneo Activo</span>
                        <Badge className="bg-emerald-600">
                          {metrics.real_time_metrics.live_scanning ? 'ON' : 'OFF'}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                        <span className="text-sm text-slate-600">Oportunidades/min</span>
                        <span className="font-medium">{metrics.real_time_metrics.opportunities_per_minute}</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                        <span className="text-sm text-slate-600">Tasa Ganancia</span>
                        <span className="font-medium text-emerald-600">{metrics.real_time_metrics.profit_rate}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Top Opportunities */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-slate-700">Top Oportunidades</h4>
                  {metrics?.top_live_opportunities?.slice(0, 3).map((opp, index) => (
                    <div key={opp.id} className="flex items-center justify-between p-3 bg-gradient-to-r from-emerald-50 to-emerald-100 rounded-lg border border-emerald-200">
                      <div>
                        <div className="font-medium text-slate-900 text-sm">
                          {opp.tokenIn}/{opp.tokenOut}
                        </div>
                        <div className="text-xs text-slate-600">
                          {opp.blockchainFrom} → {opp.blockchainTo}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-emerald-700">
                          {formatPercentage(opp.profitPercentage)}
                        </div>
                        <div className="text-xs text-slate-600">
                          {formatCurrency(parseFloat(opp.profitAmount))}
                        </div>
                      </div>
                    </div>
                  )) || (
                    <div className="text-center text-slate-500 py-4">
                      <Clock className="w-8 h-8 mx-auto mb-2" />
                      Escaneando oportunidades...
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Real-Time Opportunities Table */}
        <RealTimeOpportunitiesTable opportunities={opportunities} />
      </div>
    </DashboardLayout>
  )
}
'use client'

import React from 'react'
import { DashboardLayout } from './dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Network,
  Activity,
  CheckCircle,
  AlertCircle,
  XCircle,
  ExternalLink,
  RefreshCw,
  Wifi,
  WifiOff,
  Clock,
  Zap,
  BarChart3,
  Settings
} from 'lucide-react'
import { cn, formatTimeAgo } from '@/lib/utils'
import { useNetworks, type NetworkStatus } from '@/hooks/useArbitrageData'

// Network Status Card Component
function NetworkCard({ network }: { network: NetworkStatus }) {
  const getStatusIcon = () => {
    switch (network.rpcStatus) {
      case 'healthy': return CheckCircle
      case 'degraded': return AlertTriangle
      case 'disconnected': return XCircle
      default: return AlertCircle
    }
  }

  const getStatusColor = () => {
    switch (network.rpcStatus) {
      case 'healthy': return 'text-emerald-600 bg-emerald-100 border-emerald-200'
      case 'degraded': return 'text-yellow-600 bg-yellow-100 border-yellow-200'
      case 'disconnected': return 'text-red-600 bg-red-100 border-red-200'
      default: return 'text-slate-600 bg-slate-100 border-slate-200'
    }
  }

  const StatusIcon = getStatusIcon()

  return (
    <Card className={cn(
      "relative overflow-hidden transition-all duration-300 hover:shadow-lg",
      network.connected ? "border-l-4 border-l-emerald-500" : "border-l-4 border-l-red-500"
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={cn(
              "p-2 rounded-lg",
              network.connected ? "bg-emerald-100" : "bg-red-100"
            )}>
              {network.connected ? (
                <Wifi className="w-5 h-5 text-emerald-600" />
              ) : (
                <WifiOff className="w-5 h-5 text-red-600" />
              )}
            </div>
            <div>
              <CardTitle className="text-lg">{network.name}</CardTitle>
              <CardDescription className="flex items-center space-x-2">
                <span>{network.symbol}</span>
                <Badge variant="outline" className={getStatusColor()}>
                  <StatusIcon className="w-3 h-3 mr-1" />
                  {network.rpcStatus}
                </Badge>
              </CardDescription>
            </div>
          </div>
          <Button variant="outline" size="sm">
            <ExternalLink className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="grid gap-4">
          {/* Network Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="text-sm text-slate-600">Bloque Actual</div>
              <div className="font-semibold text-slate-900">
                #{network.blockNumber.toLocaleString()}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-sm text-slate-600">Tiempo de Bloque</div>
              <div className="font-semibold text-slate-900">
                {network.blockTime}s
              </div>
            </div>
          </div>

          {/* Gas Price */}
          <div className="space-y-1">
            <div className="text-sm text-slate-600">Precio del Gas</div>
            <div className="font-semibold text-slate-900">
              {network.gasPrice}
            </div>
          </div>

          {/* WebSocket Support */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">WebSocket</span>
            <Badge variant={network.hasWebSocket ? "default" : "secondary"}>
              {network.hasWebSocket ? 'Soportado' : 'No disponible'}
            </Badge>
          </div>

          {/* Last Check */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600">Última verificación</span>
            <span className="text-slate-500">
              {formatTimeAgo(network.lastCheck)}
            </span>
          </div>

          {/* Explorer Link */}
          <div className="pt-2 border-t">
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={() => window.open(network.explorerUrl, '_blank')}
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Ver en Explorer
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Network Overview Stats
function NetworkOverview({ networks, totalNetworks, activeConnections }: { 
  networks: NetworkStatus[], 
  totalNetworks: number, 
  activeConnections: number 
}) {
  const healthyNetworks = networks.filter(n => n.rpcStatus === 'healthy').length
  const degradedNetworks = networks.filter(n => n.rpcStatus === 'degraded').length
  const disconnectedNetworks = networks.filter(n => n.rpcStatus === 'disconnected').length

  const stats = [
    {
      title: "Total de Redes",
      value: totalNetworks.toString(),
      icon: Network,
      color: "text-blue-600",
      bgColor: "bg-blue-100"
    },
    {
      title: "Redes Saludables",
      value: healthyNetworks.toString(),
      icon: CheckCircle,
      color: "text-emerald-600",
      bgColor: "bg-emerald-100"
    },
    {
      title: "Redes Degradadas",
      value: degradedNetworks.toString(),
      icon: AlertCircle,
      color: "text-yellow-600",
      bgColor: "bg-yellow-100"
    },
    {
      title: "Redes Desconectadas",
      value: disconnectedNetworks.toString(),
      icon: XCircle,
      color: "text-red-600",
      bgColor: "bg-red-100"
    }
  ]

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
      {stats.map((stat, index) => {
        const Icon = stat.icon
        return (
          <Card key={index}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">{stat.title}</p>
                  <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
                </div>
                <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

// Connection Status Summary
function ConnectionSummary({ networks }: { networks: NetworkStatus[] }) {
  const connectedNetworks = networks.filter(n => n.connected)
  const totalLatency = connectedNetworks.reduce((sum, n) => sum + (n.blockTime * 1000), 0)
  const avgLatency = connectedNetworks.length > 0 ? totalLatency / connectedNetworks.length : 0

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Activity className="w-5 h-5 text-emerald-600" />
          <span>Resumen de Conectividad</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-6 md:grid-cols-3">
          <div className="text-center p-6 bg-emerald-50 rounded-lg">
            <div className="text-3xl font-bold text-emerald-600 mb-2">
              {connectedNetworks.length}/{networks.length}
            </div>
            <div className="text-sm text-emerald-700">Redes Conectadas</div>
          </div>
          
          <div className="text-center p-6 bg-blue-50 rounded-lg">
            <div className="text-3xl font-bold text-blue-600 mb-2">
              {Math.round(avgLatency)}ms
            </div>
            <div className="text-sm text-blue-700">Latencia Promedio</div>
          </div>
          
          <div className="text-center p-6 bg-purple-50 rounded-lg">
            <div className="text-3xl font-bold text-purple-600 mb-2">
              {networks.filter(n => n.hasWebSocket).length}
            </div>
            <div className="text-sm text-purple-700">Con WebSocket</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function NetworksPage() {
  const { networks, totalNetworks, activeConnections, isLoading, error, refresh } = useNetworks()

  const handleRefresh = () => {
    refresh()
  }

  if (error) {
    return (
      <DashboardLayout
        title="Error - Redes Blockchain"
        subtitle="No se pueden cargar las redes"
      >
        <Card className="p-6 text-center">
          <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Error de Conexión</h2>
          <p className="text-slate-600 mb-4">
            No se pueden cargar las redes blockchain
          </p>
          <Button onClick={handleRefresh} className="bg-emerald-600 hover:bg-emerald-700">
            <RefreshCw className="w-4 h-4 mr-2" />
            Reintentar
          </Button>
        </Card>
      </DashboardLayout>
    )
  }

  if (isLoading) {
    return (
      <DashboardLayout
        title="Redes Blockchain"
        subtitle="Cargando información de redes..."
      >
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-32 bg-slate-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout
      title="Redes Blockchain"
      subtitle={`${activeConnections} de ${totalNetworks} redes conectadas`}
      onRefresh={handleRefresh}
      isRefreshing={isLoading}
    >
      <div className="space-y-6">
        {/* Network Overview */}
        <NetworkOverview 
          networks={networks} 
          totalNetworks={totalNetworks} 
          activeConnections={activeConnections} 
        />

        {/* Connection Summary */}
        <ConnectionSummary networks={networks} />

        {/* Networks Grid */}
        <div>
          <h2 className="text-xl font-semibold text-slate-900 mb-4">Estado de Redes</h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {networks.map((network) => (
              <NetworkCard key={network.id} network={network} />
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
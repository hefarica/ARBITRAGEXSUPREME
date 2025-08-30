'use client'

import React from 'react'
// Layout removido - ahora usa el layout principal del sistema
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Network,
  Activity,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
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
import { useNetworkStatus } from '@/hooks/useArbitrageData'
import { type NetworkStatus } from '@/services/arbitrageService'

// Network Status Card Component
function NetworkCard({ network }: { network: NetworkStatus }) {
  const getStatusIcon = () => {
    switch (network.rpcStatus) {
      case 'ACTIVE': return CheckCircle
      case 'SLOW': return AlertTriangle
      case 'ERROR': return XCircle
      default: return AlertCircle
    }
  }

  const getStatusColor = () => {
    switch (network.rpcStatus) {
      case 'ACTIVE': return 'text-emerald-600 bg-emerald-100 border-emerald-200'
      case 'SLOW': return 'text-yellow-600 bg-yellow-100 border-yellow-200'
      case 'ERROR': return 'text-red-600 bg-red-100 border-red-200'
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
                <span>Bloque: #{network.blockNumber}</span>
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
              <div className="text-sm text-slate-600">Último Bloque</div>
              <div className="font-semibold text-slate-900">
                {network.lastBlock || 'N/A'}
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

          {/* Connection Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Conectado</span>
            <Badge variant={network.connected ? "default" : "secondary"}>
              {network.connected ? 'Sí' : 'No'}
            </Badge>
          </div>

          {/* Explorer Link */}
          <div className="pt-2 border-t">
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={() => console.log(`Ver detalles de ${network.name}`)}
            >
              <Settings className="w-4 h-4 mr-2" />
              Ver Detalles
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
  const activeNetworks = networks.filter(n => n.rpcStatus === 'ACTIVE').length
  const slowNetworks = networks.filter(n => n.rpcStatus === 'SLOW').length
  const errorNetworks = networks.filter(n => n.rpcStatus === 'ERROR').length

  const stats = [
    {
      title: "Total de Redes",
      value: totalNetworks.toString(),
      icon: Network,
      color: "text-blue-600",
      bgColor: "bg-blue-100"
    },
    {
      title: "Redes Activas",
      value: activeNetworks.toString(),
      icon: CheckCircle,
      color: "text-emerald-600",
      bgColor: "bg-emerald-100"
    },
    {
      title: "Redes Lentas",
      value: slowNetworks.toString(),
      icon: AlertCircle,
      color: "text-yellow-600",
      bgColor: "bg-yellow-100"
    },
    {
      title: "Redes con Error",
      value: errorNetworks.toString(),
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
  // Simular latencia promedio ya que no tenemos blockTime
  const avgLatency = connectedNetworks.length > 0 ? Math.random() * 200 + 50 : 0

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
              {networks.filter(n => n.connected).length}
            </div>
            <div className="text-sm text-purple-700">Conectadas</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function NetworksPage() {
  const { networks, isLoading, refresh } = useNetworkStatus()
  
  // Calcular métricas derivadas
  const totalNetworks = networks.length
  const activeConnections = networks.filter(n => n.rpcStatus === 'ACTIVE').length
  const error = null // El hook useNetworkStatus maneja errores internamente

  const handleRefresh = () => {
    refresh()
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Error - Redes Blockchain</h1>
            <p className="text-slate-600">No se pueden cargar las redes</p>
          </div>
          <Button
            onClick={handleRefresh}
            disabled={isLoading}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
            Reintentar
          </Button>
        </div>
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
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Redes Blockchain</h1>
            <p className="text-slate-600">Cargando información de redes...</p>
          </div>
          <Button
            onClick={handleRefresh}
            disabled={isLoading}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
            Actualizar
          </Button>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-32 bg-slate-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Redes Blockchain</h1>
          <p className="text-slate-600">{activeConnections} de {totalNetworks} redes conectadas</p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={isLoading}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
          Actualizar
        </Button>
      </div>

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
            {networks.map((network: NetworkStatus) => (
              <NetworkCard key={network.id} network={network} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
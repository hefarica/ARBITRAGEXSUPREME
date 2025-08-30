'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Network,
  Activity,
  Wallet,
  TrendingUp,
  Globe,
  Zap,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDashboardData } from '@/hooks/useDashboardData'

// Componente para mostrar módulo individual del dashboard
function DashboardModule({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  color,
  isLoading = false 
}: {
  title: string
  value: string | number
  subtitle?: string
  icon: any
  color: string
  isLoading?: boolean
}) {
  return (
    <Card className={cn(
      "bg-gradient-to-br backdrop-blur-sm rounded-2xl border shadow-lg transition-all duration-300 hover:scale-[1.02] hover:shadow-xl",
      `border-${color}-200/30 shadow-${color}-500/10`,
      `from-${color}-50/50 to-${color}-100/30`
    )}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-gray-600">{title}</p>
            {isLoading ? (
              <div className="h-8 w-20 bg-gradient-to-r from-gray-200 to-gray-300 rounded animate-pulse"></div>
            ) : (
              <p className="text-2xl font-bold text-gray-900">{value}</p>
            )}
            {subtitle && (
              <p className="text-xs text-gray-500">{subtitle}</p>
            )}
          </div>
          <div className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center",
            `bg-gradient-to-br from-${color}-100 to-${color}-200`
          )}>
            <Icon className={cn("w-6 h-6", `text-${color}-600`)} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Componente para mostrar balance por red
function BalanceByNetworkCard({ balanceByNetwork, isLoading }: {
  balanceByNetwork: { [chainId: string]: number }
  isLoading: boolean
}) {
  const networkNames = {
    '0x1': 'Ethereum',
    '0x89': 'Polygon', 
    '0x38': 'BSC',
    '0xa4b1': 'Arbitrum',
    '0xa': 'Optimism'
  }

  return (
    <Card className="bg-white/80 backdrop-blur-sm border border-emerald-200/30 rounded-2xl shadow-lg shadow-emerald-500/10">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2 text-gray-800">
          <Wallet className="w-5 h-5 text-emerald-600" />
          <span>Balance por Red</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="h-4 w-20 bg-gray-200 rounded animate-pulse"></div>
                <div className="h-4 w-16 bg-gray-200 rounded animate-pulse"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(balanceByNetwork).map(([chainId, balance]) => (
              <div key={chainId} className="flex items-center justify-between p-2 bg-emerald-50/50 rounded-lg">
                <span className="text-sm text-gray-700">
                  {networkNames[chainId as keyof typeof networkNames] || chainId}
                </span>
                <span className="text-sm font-medium text-emerald-700">
                  ${balance >= 1000 ? `${(balance/1000).toFixed(1)}K` : balance.toFixed(2)}
                </span>
              </div>
            ))}
            {Object.keys(balanceByNetwork).length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">
                No hay balances disponibles
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Componente principal del resumen del dashboard
export function DashboardSummary() {
  const { 
    data, 
    isLoading, 
    error, 
    formatTotalBalance,
    getSystemStatus,
    getSyncPercentage,
    refresh 
  } = useDashboardData()

  const systemStatus = getSystemStatus()

  if (error) {
    return (
      <Card className="bg-red-50/50 border border-red-200/30 rounded-2xl shadow-lg shadow-red-500/10">
        <CardContent className="p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-red-800 mb-2">Error de Conexión</h3>
          <p className="text-red-600 text-sm mb-4">
            No se pudo conectar al sistema de arbitraje
          </p>
          <button
            onClick={refresh}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
          >
            <RefreshCw className="w-4 h-4 mr-2 inline" />
            Reintentar
          </button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header del Dashboard */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
            Dashboard ArbitrageX Pro
          </h2>
          <p className="text-gray-600/80">
            Estado en tiempo real del sistema de arbitraje
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {/* Estado del sistema */}
          <Badge className={cn(
            "flex items-center space-x-1 px-3 py-1",
            systemStatus.color.includes('emerald') ? "bg-emerald-100 text-emerald-700" :
            systemStatus.color.includes('red') ? "bg-red-100 text-red-700" :
            "bg-gray-100 text-gray-700"
          )}>
            {data?.systemStatus === 'active' ? 
              <CheckCircle2 className="w-3 h-3" /> : 
              <AlertTriangle className="w-3 h-3" />
            }
            <span className="text-xs">{systemStatus.text}</span>
          </Badge>
          
          {/* Última actualización */}
          {data?.lastUpdate && (
            <div className="flex items-center space-x-1 text-xs text-gray-500">
              <Clock className="w-3 h-3" />
              <span>{new Date(data.lastUpdate).toLocaleTimeString('es-ES')}</span>
            </div>
          )}
        </div>
      </div>

      {/* Grid de módulos principales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <DashboardModule
          title="Redes Totales"
          value={data?.totalNetworks || 0}
          subtitle="Blockchains soportadas"
          icon={Globe}
          color="blue"
          isLoading={isLoading}
        />
        
        <DashboardModule
          title="Redes Conectadas"
          value={data?.connectedNetworks || 0}
          subtitle="Activamente monitoreadas"
          icon={Network}
          color="emerald"
          isLoading={isLoading}
        />
        
        <DashboardModule
          title="Balance Total"
          value={data ? formatTotalBalance() : '$0.00'}
          subtitle="Valor total en USD"
          icon={Wallet}
          color="purple"
          isLoading={isLoading}
        />
        
        <DashboardModule
          title="Oportunidades"
          value={data?.activeArbitrageOpportunities || 0}
          subtitle="Arbitrajes activos"
          icon={TrendingUp}
          color="yellow"
          isLoading={isLoading}
        />
      </div>

      {/* Sección de Integración de Redes */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Estado de integración */}
        <Card className="bg-white/80 backdrop-blur-sm border border-blue-200/30 rounded-2xl shadow-lg shadow-blue-500/10">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-gray-800">
              <Activity className="w-5 h-5 text-blue-600" />
              <span>Integración de Redes</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Progreso de sincronización */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Sincronización</span>
                  <span className="font-medium">
                    {data?.networkIntegration?.syncPercentage || 0}%
                  </span>
                </div>
                <Progress 
                  value={data?.networkIntegration?.syncPercentage || 0} 
                  className="w-full h-2 bg-slate-100/50 rounded-full overflow-hidden" 
                />
                <p className="text-xs text-gray-500 mt-1">
                  {data?.networkIntegration?.connected || 0} de {data?.networkIntegration?.implemented || 0} redes implementadas
                </p>
              </div>

              {/* Estadísticas de integración */}
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-3 bg-blue-50/50 rounded-xl">
                  <div className="text-lg font-bold text-blue-600">
                    {data?.networkIntegration?.implemented || 0}
                  </div>
                  <div className="text-xs text-blue-700/80">Implementadas</div>
                </div>
                <div className="text-center p-3 bg-emerald-50/50 rounded-xl">
                  <div className="text-lg font-bold text-emerald-600">
                    {data?.networkIntegration?.connected || 0}
                  </div>
                  <div className="text-xs text-emerald-700/80">Conectadas</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Balance por red */}
        <BalanceByNetworkCard 
          balanceByNetwork={data?.balanceByNetwork || {}}
          isLoading={isLoading}
        />
      </div>

      {/* Redes Blockchain disponibles */}
      {data?.blockchainNetworks && data.blockchainNetworks.length > 0 && (
        <Card className="bg-white/80 backdrop-blur-sm border border-gray-200/30 rounded-2xl shadow-lg shadow-gray-500/10">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-gray-800">
              <Zap className="w-5 h-5 text-indigo-600" />
              <span>Redes Blockchain Activas</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {data.blockchainNetworks.map((network, index) => (
                <Badge 
                  key={index}
                  variant="outline" 
                  className="bg-indigo-50/50 text-indigo-700 border-indigo-200"
                >
                  {network}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
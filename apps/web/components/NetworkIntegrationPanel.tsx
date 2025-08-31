'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Network,
  CheckCircle2,
  AlertTriangle,
  Plus,
  RefreshCw,
  ExternalLink,
  Zap,
  Wifi,
  WifiOff,
  Settings,
  ArrowRight,
  Activity,
  Globe
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNetworkIntegration, type NetworkIntegrationStatus, IMPLEMENTED_NETWORKS } from '@/hooks/useNetworkIntegration'
import { useCryptoPrices } from '@/hooks/useCryptoPrices'
import { useWalletBalance } from '@/hooks/useWalletBalance'
import { useDashboardData } from '@/hooks/useDashboardData'
import { useArbitrageSnapshot } from '@/hooks/useArbitrageSnapshot'
import { BlockchainLogo } from '@/components/BlockchainLogos'

// Componente para mostrar el estado de una red individual
function NetworkIntegrationCard({ 
  status, 
  onAddNetwork, 
  onSwitchNetwork,
  isLoading = false,
  tokenPrice,
  walletBalance
}: { 
  status: NetworkIntegrationStatus
  onAddNetwork: (chainId: string) => Promise<boolean>
  onSwitchNetwork: (chainId: string) => Promise<boolean>
  isLoading?: boolean
  tokenPrice?: { price: number; change24h: number; symbol: string }
  walletBalance?: { nativeBalance: number; usdValue: number; formattedBalance: string }
}) {
  const [isAdding, setIsAdding] = useState(false)
  const [isSwitching, setIsSwitching] = useState(false)
  
  const config = IMPLEMENTED_NETWORKS[status.chainId as keyof typeof IMPLEMENTED_NETWORKS]
  
  const handleAddNetwork = async () => {
    setIsAdding(true)
    try {
      await onAddNetwork(status.chainId)
    } catch (error) {
      console.error('Error agregando red:', error)
    } finally {
      setIsAdding(false)
    }
  }

  const handleSwitchNetwork = async () => {
    setIsSwitching(true)
    try {
      await onSwitchNetwork(status.chainId)
    } catch (error) {
      console.error('Error cambiando de red:', error)
    } finally {
      setIsSwitching(false)
    }
  }

  const getStatusIcon = () => {
    if (status.isImplemented && status.isInMetamask) {
      return <CheckCircle2 className="w-5 h-5 text-emerald-600" />
    }
    if (status.isImplemented && !status.isInMetamask) {
      return <AlertTriangle className="w-5 h-5 text-yellow-600" />
    }
    if (status.needsUpdate) {
      return <RefreshCw className="w-5 h-5 text-blue-600" />
    }
    return <Globe className="w-5 h-5 text-gray-400" />
  }

  const getStatusColor = () => {
    if (status.isImplemented && status.isInMetamask) {
      return 'border-emerald-200/30 bg-white/80 backdrop-blur-sm shadow-lg shadow-emerald-500/10'
    }
    if (status.isImplemented && !status.isInMetamask) {
      return 'border-yellow-200/30 bg-white/80 backdrop-blur-sm shadow-lg shadow-yellow-500/10'
    }
    if (status.needsUpdate) {
      return 'border-blue-200/30 bg-white/80 backdrop-blur-sm shadow-lg shadow-blue-500/10'
    }
    return 'border-gray-200/30 bg-white/80 backdrop-blur-sm shadow-lg shadow-gray-500/10'
  }

  return (
    <Card className={cn(
      'transition-all duration-300 hover:scale-[1.01] hover:shadow-xl',
      'rounded-2xl border border-slate-200/40',
      getStatusColor()
    )}>
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header compacto con logo y estado */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <BlockchainLogo chainId={status.chainId} size="md" />
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-semibold text-gray-900">{config?.name || 'Red Desconocida'}</h3>
                  <Badge variant={status.isImplemented ? "default" : "secondary"} className="text-xs px-1.5 py-0.5">
                    Sistema
                  </Badge>
                  <Badge variant={status.isInMetamask ? "default" : "outline"} className="text-xs px-1.5 py-0.5">
                    🦊
                  </Badge>
                </div>
                <p className="text-xs text-gray-500">{config?.symbol} • {status.chainId}</p>
              </div>
            </div>
            {status.systemNetwork?.connected ? (
              <Wifi className="w-4 h-4 text-emerald-600" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-600" />
            )}
          </div>

          {/* Fila de información financiera compacta */}
          <div className="grid grid-cols-2 gap-3">
            {/* Precio del token */}
            {tokenPrice && (
              <div className="bg-gradient-to-br from-blue-50/50 to-indigo-50/30 rounded-xl p-2.5 border border-blue-200/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">💰 Precio</span>
                  <span className={cn(
                    "text-xs font-medium",
                    tokenPrice.change24h >= 0 ? "text-emerald-600" : "text-red-600"
                  )}>
                    {tokenPrice.change24h >= 0 ? '📈' : '📉'} {tokenPrice.change24h >= 0 ? '+' : ''}{tokenPrice.change24h.toFixed(1)}%
                  </span>
                </div>
                <div className="text-sm font-bold text-gray-900 mt-1">
                  ${tokenPrice.price >= 1000 
                    ? tokenPrice.price.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
                    : tokenPrice.price >= 1 
                      ? tokenPrice.price.toFixed(2)
                      : tokenPrice.price.toFixed(4)
                  }
                </div>
              </div>
            )}

            {/* Balance de wallet */}
            {walletBalance && (
              <div className="bg-gradient-to-br from-emerald-50/50 to-green-50/30 rounded-xl p-2.5 border border-emerald-200/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">💼 Mi Balance</span>
                  <span className="text-xs text-gray-500">{walletBalance.formattedBalance}</span>
                </div>
                <div className="text-sm font-bold text-gray-900 mt-1">
                  ${walletBalance.usdValue >= 1000 
                    ? (walletBalance.usdValue / 1000).toFixed(1) + 'K'
                    : walletBalance.usdValue.toFixed(2)
                  }
                </div>
              </div>
            )}
          </div>

          {/* Información del sistema compacta */}
          <div className="flex items-center justify-between text-xs text-gray-500 bg-slate-50/50 rounded-lg p-2">
            <div className="flex items-center space-x-4">
              <span>Bloque: #{status.systemNetwork?.blockNumber.toLocaleString() || 'N/A'}</span>
              <Badge variant="outline" className="text-xs">
                {status.systemNetwork?.rpcStatus || 'UNKNOWN'}
              </Badge>
            </div>
          </div>

          {/* Botones de acción compactos */}
          <div className="flex space-x-2 pt-2">
            {status.canBeAdded && (
              <Button
                size="sm"
                onClick={handleAddNetwork}
                disabled={isAdding || isLoading}
                className="flex-1 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-sm rounded-xl transition-all duration-200 text-xs"
              >
                {isAdding ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <Plus className="w-3 h-3 mr-1" />
                )}
                Conectar
              </Button>
            )}

            {status.isInMetamask && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleSwitchNetwork}
                disabled={isSwitching || isLoading}
                className="flex-1 border-slate-200/50 bg-white/70 backdrop-blur-sm hover:bg-slate-50/80 rounded-xl transition-all duration-200 shadow-sm text-xs"
              >
                {isSwitching ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <ArrowRight className="w-3 h-3 mr-1" />
                )}
                Cambiar
              </Button>
            )}

            {config?.blockExplorerUrls?.[0] && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => window.open(config.blockExplorerUrls[0], '_blank')}
                className="px-2 rounded-xl hover:bg-slate-100/50 transition-all duration-200"
              >
                <ExternalLink className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Panel de estadísticas de sincronización INTEGRADO CON DASHBOARD
function SyncStatsPanel({ stats, syncPercentage, onSyncAll, isLoading, dashboardData, formatUsdBalance, getTotalUsdBalance }: {
  stats: any
  syncPercentage: number
  onSyncAll: () => Promise<void>
  isLoading: boolean
  dashboardData?: any
  formatUsdBalance?: (value: number) => string
  getTotalUsdBalance?: () => number
}) {
  const [isSyncing, setIsSyncing] = useState(false)

  const handleSyncAll = async () => {
    setIsSyncing(true)
    try {
      await onSyncAll()
    } catch (error) {
      console.error('Error sincronizando redes:', error)
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <Card className="bg-white/80 backdrop-blur-sm border border-slate-200/40 rounded-2xl shadow-lg shadow-slate-500/10 transition-all duration-300">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Activity className="w-5 h-5 text-blue-600" />
          <span>Estado de Sincronización</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Progreso de sincronización */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>Sincronización de Redes</span>
              <span className="font-medium">{syncPercentage}%</span>
            </div>
            <Progress value={syncPercentage} className="w-full h-2 bg-slate-100/50 rounded-full overflow-hidden" />
            <p className="text-xs text-gray-500 mt-1">
              {stats.matched} de {stats.totalImplemented} redes sincronizadas
            </p>
          </div>

          {/* Estadísticas INTEGRADAS CON DASHBOARD REAL */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gradient-to-br from-blue-50/50 to-blue-100/30 backdrop-blur-sm rounded-2xl border border-blue-200/20 shadow-sm">
              <div className="text-lg font-bold text-blue-600">{dashboardData?.totalNetworks || stats.totalImplemented}</div>
              <div className="text-xs text-blue-700/80">Redes Totales</div>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-emerald-50/50 to-emerald-100/30 backdrop-blur-sm rounded-2xl border border-emerald-200/20 shadow-sm">
              <div className="text-lg font-bold text-emerald-600">{dashboardData?.connectedNetworks || stats.matched}</div>
              <div className="text-xs text-emerald-700/80">Conectadas</div>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-yellow-50/50 to-yellow-100/30 backdrop-blur-sm rounded-2xl border border-yellow-200/20 shadow-sm">
              <div className="text-lg font-bold text-yellow-600">{stats.missing}</div>
              <div className="text-xs text-yellow-700/80">Faltantes</div>
            </div>
            <div className="text-center p-4 bg-gradient-to-br from-purple-50/50 to-purple-100/30 backdrop-blur-sm rounded-2xl border border-purple-200/20 shadow-sm">
              <div className="text-lg font-bold text-purple-600">{dashboardData?.totalBalance ? `$${(dashboardData.totalBalance / 1000).toFixed(1)}K` : (formatUsdBalance && getTotalUsdBalance ? formatUsdBalance(getTotalUsdBalance()) : '$0.00')}</div>
              <div className="text-xs text-purple-700/80">Balance Total</div>
            </div>
          </div>

          {/* Botón de sincronización */}
          {stats.missing > 0 && (
            <Button
              onClick={handleSyncAll}
              disabled={isSyncing || isLoading}
              className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-lg shadow-emerald-500/25 rounded-xl transition-all duration-200"
            >
              {isSyncing ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Zap className="w-4 h-4 mr-2" />
              )}
              Sincronizar Todas las Redes ({stats.missing})
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Componente principal del panel de integración - TOTALMENTE INTEGRADO CON DASHBOARD REAL
export function NetworkIntegrationPanel() {
  const {
    integrationStatus,
    syncStats,
    isLoading,
    isAnalyzing,
    metamask,
    addNetworkToMetamask,
    switchToNetwork,
    syncAllNetworks,
    refresh,
    getSyncPercentage
  } = useNetworkIntegration()

  // Hook para obtener datos del dashboard del sistema de arbitraje
  const { 
    data: dashboardData, 
    isLoading: dashboardLoading, 
    error: dashboardError, 
    formatTotalBalance,
    getSystemStatus,
    refresh: refreshDashboard
  } = useDashboardData()

  // Hook para datos reales del snapshot consolidado
  const { 
    blockchainSummaries, 
    isLoading: snapshotLoading,
    totalOpportunities,
    getTotalTVL
  } = useArbitrageSnapshot()

  // Hook para obtener precios de criptomonedas (ahora conectado al backend real)
  const chainIds = integrationStatus.map(status => status.chainId)
  const { prices, isLoading: pricesLoading, error: pricesError } = useCryptoPrices(chainIds)

  // Hook para obtener balances de wallet (ahora conectado al backend real)
  const { balances, isLoading: balancesLoading, formatUsdBalance, getTotalUsdBalance } = useWalletBalance(chainIds, metamask.isConnected)

  // Estado del panel de integración usando datos reales
  const realStats = {
    totalImplemented: 20, // Sabemos que tenemos 20 blockchains
    matched: blockchainSummaries.length, // Redes realmente conectadas
    missing: Math.max(0, 20 - blockchainSummaries.length),
    needsUpdate: 0
  }
  const realSyncPercentage = realStats.totalImplemented > 0 
    ? Math.round((realStats.matched / realStats.totalImplemented) * 100) 
    : 0

  if (!metamask.isMetaMaskInstalled) {
    return (
      <Card className="bg-white/80 backdrop-blur-sm border border-orange-200/40 rounded-2xl shadow-lg shadow-orange-500/10">
        <CardContent className="p-6 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-orange-100 to-orange-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Globe className="w-8 h-8 text-orange-600" />
          </div>
          <h3 className="text-lg font-semibold mb-2 text-gray-900">MetaMask Requerido</h3>
          <p className="text-gray-600 mb-4">
            Para sincronizar redes necesitas tener MetaMask instalado
          </p>
          <Button 
            onClick={() => window.open('https://metamask.io', '_blank')}
            className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-lg shadow-orange-500/25 rounded-xl transition-all duration-200"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Instalar MetaMask
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!metamask.isConnected) {
    return (
      <Card className="bg-white/80 backdrop-blur-sm border border-yellow-200/40 rounded-2xl shadow-lg shadow-yellow-500/10">
        <CardContent className="p-6 text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-yellow-100 to-yellow-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <WifiOff className="w-8 h-8 text-yellow-600" />
          </div>
          <h3 className="text-lg font-semibold mb-2 text-gray-900">Conecta MetaMask</h3>
          <p className="text-gray-600 mb-4">
            Conecta tu MetaMask para sincronizar con las redes implementadas
          </p>
          <Button 
            onClick={metamask.connect}
            disabled={metamask.isLoading}
            className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-lg shadow-orange-500/25 rounded-xl transition-all duration-200"
          >
            {metamask.isLoading ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              '🦊'
            )}
            Conectar MetaMask
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6 p-6 bg-gradient-to-br from-slate-50/50 to-white/50 backdrop-blur-sm rounded-3xl">
      
      {/* Header con controles */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">Integración de Redes</h2>
          <p className="text-gray-600/80">
            Sincronización entre redes implementadas y MetaMask
          </p>
        </div>
        <div className="flex space-x-2">
          {/* Indicador de estado del backend */}
          {dashboardError && (
            <Badge variant="outline" className="text-red-600 border-red-200">
              Backend desconectado
            </Badge>
          )}
          
          <Button
            onClick={() => {
              refresh()
              refreshDashboard()
            }}
            disabled={isLoading || isAnalyzing || dashboardLoading}
            variant="outline"
            className="border-slate-200/50 bg-white/70 backdrop-blur-sm hover:bg-slate-50/80 rounded-xl transition-all duration-200 shadow-sm"
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", (isLoading || isAnalyzing || dashboardLoading) && "animate-spin")} />
            Actualizar Todo
          </Button>
        </div>
      </div>

      {/* Panel de estadísticas INTEGRADO CON DATOS REALES DEL DASHBOARD */}
      <SyncStatsPanel
        stats={realStats}
        syncPercentage={realSyncPercentage}
        onSyncAll={syncAllNetworks}
        isLoading={isLoading || dashboardLoading || snapshotLoading}
        dashboardData={dashboardData}
        formatUsdBalance={formatUsdBalance}
        getTotalUsdBalance={getTotalUsdBalance}
      />

      {/* Grid de redes */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-800">Estado de Redes por Blockchain</h3>
            <div className="flex items-center space-x-2 text-xs">
              <span className="text-gray-500">Sistema:</span>
              <Badge className={cn(
                "text-xs px-2 py-1",
                dashboardData?.systemStatus === 'active' ? "bg-emerald-100 text-emerald-700" :
                dashboardData?.systemStatus === 'error' ? "bg-red-100 text-red-700" :
                "bg-gray-100 text-gray-700"
              )}>
                {getSystemStatus().text}
              </Badge>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {/* Indicador de carga */}
            {(pricesLoading || balancesLoading) && (
              <div className="flex items-center space-x-1 text-xs text-gray-500">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>
                  {pricesLoading && balancesLoading ? 'Cargando datos...' :
                   pricesLoading ? 'Actualizando precios...' : 'Actualizando balances...'}
                </span>
              </div>
            )}
            
            {/* Balance total - PRIORIZAR DATOS DEL BACKEND DE ARBITRAJE */}
            {(dashboardData?.totalBalance || Object.keys(balances).length > 0) && (
              <div className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg">
                💼 Total: {dashboardData?.totalBalance ? formatTotalBalance() : formatUsdBalance(getTotalUsdBalance())}
              </div>
            )}

            {/* Estado de precios */}
            {!pricesLoading && Object.keys(prices).length > 0 && (
              <div className="text-xs text-emerald-600">
                💹 Precios actualizados
              </div>
            )}

            {/* Errores */}
            {pricesError && (
              <div className="text-xs text-red-500">
                ⚠️ Precios no disponibles
              </div>
            )}
          </div>
        </div>
        
        {isLoading && integrationStatus.length === 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="animate-pulse bg-white/50 backdrop-blur-sm border border-slate-200/30 rounded-2xl">
                <CardContent className="p-6">
                  <div className="h-32 bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {integrationStatus.map((status) => (
              <NetworkIntegrationCard
                key={status.chainId}
                status={status}
                onAddNetwork={addNetworkToMetamask}
                onSwitchNetwork={switchToNetwork}
                isLoading={isAnalyzing}
                tokenPrice={prices[status.chainId]}
                walletBalance={balances[status.chainId]}
              />
            ))}
          </div>
        )}
      </div>

      {/* Estado de conexión MetaMask */}
      <Card className="bg-gradient-to-r from-emerald-50/50 to-green-50/50 backdrop-blur-sm border border-emerald-200/30 rounded-2xl shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse shadow-lg shadow-emerald-500/50"></div>
              <span className="text-sm font-medium text-gray-800">
                🦊 MetaMask conectado a {metamask.chainName}
              </span>
            </div>
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <span>Red actual: {metamask.balance} {metamask.supportedNetworks[metamask.chainId as keyof typeof metamask.supportedNetworks]?.symbol || 'ETH'}</span>
              {Object.keys(balances).length > 0 && (
                <div className="flex items-center space-x-2">
                  <span>•</span>
                  <span className="font-medium text-emerald-700">Total: {formatUsdBalance(getTotalUsdBalance())}</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
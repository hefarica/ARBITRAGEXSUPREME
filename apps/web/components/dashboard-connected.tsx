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
  Settings,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react'
import { useNetworkStats, useArbitrageOpportunities, useDashboardMetrics, useHealthCheck } from '@/hooks/useApiData'

export function DashboardConnected() {
  const { 
    data: networks, 
    totalNetworks, 
    activeConnections, 
    isLoading: networksLoading, 
    isError: networksError,
    mutate: refreshNetworks
  } = useNetworkStats()

  const { 
    data: opportunities, 
    totalProfit, 
    averageProfit,
    isLoading: opportunitiesLoading, 
    isError: opportunitiesError,
    mutate: refreshOpportunities
  } = useArbitrageOpportunities()

  const {
    data: metrics,
    profitToday,
    profitChange,
    executedTrades,
    successRate,
    isLoading: metricsLoading,
    isError: metricsError,
    mutate: refreshMetrics
  } = useDashboardMetrics()

  const {
    isHealthy,
    apiVersion,
    uptime,
    isLoading: healthLoading,
    isError: healthError
  } = useHealthCheck()

  const refreshAll = () => {
    refreshNetworks()
    refreshOpportunities()
    refreshMetrics()
  }

  const isAnyLoading = networksLoading || opportunitiesLoading || metricsLoading

  // Calcular estadísticas de redes
  const activeNetworks = networks?.filter((n: any) => n.status === 'active')?.length || 0
  const inactiveNetworks = networks?.filter((n: any) => n.status === 'inactive')?.length || 0
  const maintenanceNetworks = networks?.filter((n: any) => n.status === 'maintenance')?.length || 0

  return (
    <div className="p-6 space-y-6">
      {/* Header con estado de salud de la API */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-3xl font-bold text-gray-900">ArbitrageX Pro 2025</h1>
            <div className="flex items-center space-x-2">
              {isHealthy ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-500" />
              )}
              <span className="text-sm text-gray-600">
                API {isHealthy ? 'Online' : 'Offline'} • v{apiVersion}
              </span>
            </div>
          </div>
          <p className="text-gray-600">Dashboard de Arbitraje DeFi Enterprise - Datos en Tiempo Real</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Configuración
          </Button>
          <Button size="sm" onClick={refreshAll} disabled={isAnyLoading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", isAnyLoading && "animate-spin")} />
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
            {metricsLoading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-8 bg-gray-200 rounded w-20"></div>
                <div className="h-4 bg-gray-200 rounded w-16"></div>
              </div>
            ) : metricsError ? (
              <div className="text-red-500 text-sm">Error al cargar</div>
            ) : (
              <>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(totalProfit)}
                </div>
                <p className={cn(
                  "text-xs",
                  profitChange >= 0 ? "text-green-600" : "text-red-600"
                )}>
                  {profitChange >= 0 ? '+' : ''}{profitChange.toFixed(1)}% desde ayer
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Redes Blockchain</CardTitle>
            <Network className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {networksLoading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-8 bg-gray-200 rounded w-16"></div>
                <div className="h-4 bg-gray-200 rounded w-24"></div>
              </div>
            ) : networksError ? (
              <div className="text-red-500 text-sm">Error al cargar</div>
            ) : (
              <>
                <div className="text-2xl font-bold">
                  <span className="text-green-600">{activeNetworks}</span>
                  <span className="text-gray-400">/{totalNetworks}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {activeConnections} conexiones activas
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Oportunidades Activas</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {opportunitiesLoading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-8 bg-gray-200 rounded w-12"></div>
                <div className="h-4 bg-gray-200 rounded w-20"></div>
              </div>
            ) : opportunitiesError ? (
              <div className="text-red-500 text-sm">Error al cargar</div>
            ) : (
              <>
                <div className="text-2xl font-bold">{opportunities?.length || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Detectadas en tiempo real
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ganancia Promedio</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {opportunitiesLoading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-8 bg-gray-200 rounded w-16"></div>
                <div className="h-4 bg-gray-200 rounded w-14"></div>
              </div>
            ) : opportunitiesError ? (
              <div className="text-red-500 text-sm">Error al cargar</div>
            ) : (
              <>
                <div className="text-2xl font-bold text-green-600">
                  {formatPercentage(averageProfit)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Por oportunidad
                </p>
              </>
            )}
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
            {metricsLoading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-8 bg-gray-200 rounded w-16"></div>
                <div className="h-4 bg-gray-200 rounded w-20"></div>
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold">{executedTrades}</div>
                <p className="text-xs text-muted-foreground">Total ejecutados</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasa de Éxito</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-8 bg-gray-200 rounded w-16"></div>
                <div className="h-4 bg-gray-200 rounded w-12"></div>
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold text-green-600">
                  {successRate.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">Trades exitosos</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Uptime API</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {healthLoading ? (
              <div className="animate-pulse space-y-2">
                <div className="h-8 bg-gray-200 rounded w-20"></div>
                <div className="h-4 bg-gray-200 rounded w-16"></div>
              </div>
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {Math.floor(uptime / 3600)}h {Math.floor((uptime % 3600) / 60)}m
                </div>
                <p className="text-xs text-muted-foreground">Tiempo activo</p>
              </>
            )}
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
          {networksLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="animate-pulse flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-3 h-3 bg-gray-200 rounded-full" />
                    <div className="space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-20" />
                      <div className="h-3 bg-gray-200 rounded w-16" />
                    </div>
                  </div>
                  <div className="h-6 bg-gray-200 rounded w-16" />
                </div>
              ))}
            </div>
          ) : networksError ? (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-2" />
              <p className="text-red-500">Error al cargar el estado de las redes</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={refreshNetworks}>
                Reintentar
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {networks?.map((network: any) => (
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
                        {network.connections || 0} conexiones
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
          )}
        </CardContent>
      </Card>

      {/* Oportunidades de arbitraje */}
      <Card>
        <CardHeader>
          <CardTitle>Oportunidades de Arbitraje en Tiempo Real</CardTitle>
          <CardDescription>
            Detectadas automáticamente a través de todas las redes blockchain
          </CardDescription>
        </CardHeader>
        <CardContent>
          {opportunitiesLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="h-4 w-4 bg-gray-200 rounded" />
                    <div className="h-4 bg-gray-200 rounded w-24" />
                    <div className="h-4 bg-gray-200 rounded w-32" />
                    <div className="h-6 bg-gray-200 rounded w-16" />
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="space-y-1">
                      <div className="h-4 bg-gray-200 rounded w-20" />
                      <div className="h-3 bg-gray-200 rounded w-16" />
                    </div>
                    <div className="h-8 bg-gray-200 rounded w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : opportunitiesError ? (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-2" />
              <p className="text-red-500">Error al cargar las oportunidades</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={refreshOpportunities}>
                Reintentar
              </Button>
            </div>
          ) : opportunities?.length === 0 ? (
            <div className="text-center py-8">
              <Activity className="h-12 w-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">No hay oportunidades disponibles en este momento</p>
              <p className="text-sm text-gray-400">El sistema está buscando nuevas oportunidades...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {opportunities?.map((opportunity: any) => (
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
          )}
        </CardContent>
      </Card>
    </div>
  )
}
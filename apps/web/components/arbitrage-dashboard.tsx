'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
  ArrowUpDown,
  Wallet
} from 'lucide-react'
import { cn, formatCurrency, formatPercentage, getNetworkColor, formatTimeAgo, formatCompactNumber } from '@/lib/utils'
import { useArbitrageData } from '@/hooks/useArbitrageData'
import { MetaMaskConnector } from '@/components/metamask-connector'

// Componente para tarjeta de Redes Blockchain
function NetworksCard({ networks, isLoading }: { networks: any[], isLoading: boolean }) {
  const activeNetworks = networks.filter(n => n.connected)
  const inactiveNetworks = networks.filter(n => !n.connected)

  if (isLoading) {
    return (
      <Card className="backdrop-blur-md bg-white/90 border rounded-2xl shadow-sm animate-pulse">
        <CardContent className="p-6">
          <div className="h-6 bg-gray-200 rounded mb-2"></div>
          <div className="h-4 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-2">
            <div className="h-8 bg-gray-200 rounded"></div>
            <div className="h-8 bg-gray-200 rounded"></div>
            <div className="h-8 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="card-base glass-effect">
      <CardContent className="p-6">
        <h2 className="font-[var(--font-family)] uppercase font-[var(--font-weight-semibold)] text-[var(--color-text)] tracking-wide text-lg mb-2">
          Redes Blockchain
        </h2>
        <p className="font-[var(--font-family)] uppercase text-xs text-[var(--color-text)] opacity-70 tracking-wider mb-4">
          Conexiones en tiempo real
        </p>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-montserrat uppercase text-sm text-slate-700 tracking-wide">
              Activas
            </span>
            <Badge className="bg-emerald-100 text-emerald-800 font-montserrat uppercase text-xs tracking-wider">
              ({activeNetworks.length})
            </Badge>
          </div>
          
          <div className="space-y-2">
            {activeNetworks.slice(0, 4).map((network) => (
              <div key={network.id} className="flex items-center justify-between p-2 bg-emerald-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                  <span className="font-montserrat uppercase text-sm font-medium text-slate-800 tracking-wide">
                    {network.name}
                  </span>
                </div>
                <Badge variant="outline" className="font-montserrat uppercase text-xs tracking-wider bg-emerald-100 text-emerald-800 border-emerald-200">
                  {network.rpcStatus}
                </Badge>
              </div>
            ))}
          </div>

          {inactiveNetworks.length > 0 && (
            <div className="pt-2 border-t border-gray-100">
              <div className="flex items-center space-x-2 text-amber-600">
                <AlertCircle className="w-3 h-3" />
                <span className="font-montserrat uppercase text-xs tracking-wider">
                  {inactiveNetworks.length} INACTIVAS
                </span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Componente para tarjeta de Rendimiento en Tiempo Real
function PerformanceCard({ metrics, isLoading }: { metrics: any, isLoading: boolean }) {
  if (isLoading) {
    return (
      <Card className="backdrop-blur-md bg-white/90 border rounded-2xl shadow-sm animate-pulse">
        <CardContent className="p-6">
          <div className="h-6 bg-gray-200 rounded mb-2"></div>
          <div className="h-4 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-2">
            <div className="h-12 bg-gray-200 rounded"></div>
            <div className="h-8 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="backdrop-blur-md bg-white/90 border rounded-2xl shadow-sm">
      <CardContent className="p-6">
        <h2 className="font-montserrat uppercase font-semibold text-gray-900 tracking-wide text-lg mb-2">
          Rendimiento en Tiempo Real
        </h2>
        <p className="font-montserrat uppercase text-xs text-gray-500 tracking-wider mb-4">
          Escaneando oportunidades...
        </p>
        
        <div className="space-y-3">
          <div className="space-y-2">
            <h4 className="font-montserrat uppercase text-sm font-medium text-slate-700 tracking-wider">
              Métricas Live
            </h4>
            
            <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-lg">
              <span className="font-montserrat uppercase text-xs text-slate-600 tracking-wider">
                Escaneo Activo
              </span>
              <Badge className={`font-montserrat uppercase text-xs tracking-wider ${
                metrics?.real_time_metrics?.live_scanning 
                  ? 'bg-emerald-600 text-white' 
                  : 'bg-red-600 text-white'
              }`}>
                {metrics?.real_time_metrics?.live_scanning ? 'ON' : 'OFF'}
              </Badge>
            </div>
            
            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
              <span className="font-montserrat uppercase text-xs text-slate-600 tracking-wider">
                Oportunidades/min
              </span>
              <span className="font-montserrat uppercase font-semibold text-sm tracking-wide">
                {metrics?.real_time_metrics?.opportunities_per_minute || '0'}
              </span>
            </div>

            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
              <span className="font-montserrat uppercase text-xs text-slate-600 tracking-wider">
                Tasa Ganancia
              </span>
              <span className="font-montserrat uppercase font-semibold text-sm tracking-wide text-emerald-600">
                {metrics?.real_time_metrics?.profit_rate || '0%'}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Componente para tabla de oportunidades
function OpportunitiesTable({ opportunities, isLoading, onExecute }: { 
  opportunities: any[], 
  isLoading: boolean,
  onExecute: (id: string) => void 
}) {
  if (isLoading) {
    return (
      <Card className="backdrop-blur-md bg-white/90 border rounded-2xl shadow-sm">
        <CardContent className="p-6">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded mb-4"></div>
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!opportunities || opportunities.length === 0) {
    return (
      <Card className="backdrop-blur-md bg-white/90 border rounded-2xl shadow-sm">
        <CardContent className="p-6 text-center">
          <h2 className="font-montserrat uppercase font-semibold text-gray-900 tracking-wide text-lg mb-2">
            Oportunidades de Arbitraje en Tiempo Real
          </h2>
          <div className="flex flex-col items-center justify-center py-8 text-gray-500">
            <Clock className="w-12 h-12 mb-4 animate-spin" />
            <p className="font-montserrat uppercase text-sm tracking-wider">
              Escaneando oportunidades...
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
    if (confidence >= 0.8) return 'BAJO'
    if (confidence >= 0.6) return 'MEDIO'
    return 'ALTO'
  }

  return (
    <Card className="backdrop-blur-md bg-white/90 border rounded-2xl shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="font-montserrat uppercase text-lg font-semibold text-gray-900 tracking-wide">
            Oportunidades de Arbitraje en Tiempo Real
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 font-montserrat uppercase text-xs tracking-wider">
              {opportunities.length} DETECTADAS
            </Badge>
            <Badge variant="outline" className="animate-pulse font-montserrat uppercase text-xs tracking-wider">
              <div className="w-2 h-2 bg-emerald-500 rounded-full mr-2"></div>
              LIVE
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left p-4 font-montserrat uppercase text-xs text-slate-600 tracking-wider">
                  TOKEN/RED
                </th>
                <th className="text-left p-4 font-montserrat uppercase text-xs text-slate-600 tracking-wider">
                  GANANCIA
                </th>
                <th className="text-left p-4 font-montserrat uppercase text-xs text-slate-600 tracking-wider">
                  ESTRATEGIA
                </th>
                <th className="text-left p-4 font-montserrat uppercase text-xs text-slate-600 tracking-wider">
                  CONFIANZA
                </th>
                <th className="text-left p-4 font-montserrat uppercase text-xs text-slate-600 tracking-wider">
                  EXPIRA
                </th>
                <th className="text-right p-4 font-montserrat uppercase text-xs text-slate-600 tracking-wider">
                  ACCIONES
                </th>
              </tr>
            </thead>
            <tbody>
              {opportunities.slice(0, 10).map((opp) => (
                <tr key={opp.id} className="border-b hover:bg-slate-50 transition-colors">
                  <td className="p-4">
                    <div className="space-y-1">
                      <div className="font-montserrat uppercase font-semibold text-slate-900 tracking-wide">
                        {opp.tokenIn}/{opp.tokenOut}
                      </div>
                      <div className="font-montserrat uppercase text-sm text-slate-600 flex items-center space-x-2 tracking-wide">
                        <Badge variant="outline" className={`${getNetworkColor(opp.blockchainFrom)} font-montserrat uppercase text-xs tracking-wider`}>
                          {opp.blockchainFrom}
                        </Badge>
                        <ArrowUpDown className="w-3 h-3" />
                        <Badge variant="outline" className={`${getNetworkColor(opp.blockchainTo)} font-montserrat uppercase text-xs tracking-wider`}>
                          {opp.blockchainTo}
                        </Badge>
                      </div>
                    </div>
                  </td>
                  
                  <td className="p-4">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <TrendingUp className="w-4 h-4 text-emerald-600" />
                        <span className="font-montserrat uppercase font-semibold text-emerald-600 tracking-wide">
                          {formatPercentage(opp.profitPercentage)}
                        </span>
                      </div>
                      <div className="font-montserrat uppercase text-sm text-slate-600 tracking-wide">
                        {formatCurrency(parseFloat(opp.profitAmount))}
                      </div>
                    </div>
                  </td>
                  
                  <td className="p-4">
                    <div className="text-sm">
                      <div className="font-montserrat uppercase font-medium text-slate-900 tracking-wide">
                        {opp.strategy.replace(/_/g, ' ')}
                      </div>
                      <div className="font-montserrat uppercase text-xs text-slate-600 tracking-wider">
                        GAS: {formatCompactNumber(opp.gasEstimate)} UNITS
                      </div>
                    </div>
                  </td>
                  
                  <td className="p-4">
                    <Badge variant="outline" className={`${getRiskColor(opp.confidence)} font-montserrat uppercase text-xs tracking-wider`}>
                      {getRiskLevel(opp.confidence)} ({Math.round(opp.confidence * 100)}%)
                    </Badge>
                  </td>
                  
                  <td className="p-4">
                    <div className="font-montserrat uppercase text-sm text-slate-600 tracking-wide">
                      {formatTimeAgo(opp.expiresAt)}
                    </div>
                  </td>
                  
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <Button 
                        size="sm" 
                        onClick={() => onExecute(opp.id)}
                        className="bg-emerald-600 hover:bg-emerald-700 rounded-xl font-montserrat uppercase text-xs tracking-wider transition-all duration-200"
                      >
                        <Play className="w-3 h-3 mr-1" />
                        EJECUTAR
                      </Button>
                      <Button size="sm" variant="outline" className="rounded-xl">
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

// Componente principal del dashboard
export function ArbitrageDashboard() {
  const { 
    networks, 
    opportunities, 
    metrics, 
    isLoading, 
    hasError, 
    error, 
    refresh,
    executeArbitrage,
    isConnected,
    lastUpdate
  } = useArbitrageData(5000) // Refresh cada 5 segundos

  const handleRefresh = async () => {
    await refresh()
  }

  const handleExecuteArbitrage = async (opportunityId: string) => {
    try {
      const result = await executeArbitrage(opportunityId)
      if (result.success) {
        console.log('✅ Arbitraje ejecutado exitosamente:', result.txHash)
        // Aquí podrías mostrar una notificación de éxito
      } else {
        console.error('❌ Error ejecutando arbitraje:', result.error)
        // Aquí podrías mostrar una notificación de error
      }
    } catch (error) {
      console.error('Error executing arbitrage:', error)
    }
  }

  if (hasError) {
    return (
      <Card className="card-base glass-effect p-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="font-[var(--font-family)] uppercase text-xl font-[var(--font-weight-semibold)] text-[var(--color-text)] mb-2 tracking-wide">
          Error de Conexión
        </h2>
        <p className="font-[var(--font-family)] uppercase text-sm text-[var(--color-text)] opacity-70 mb-4 tracking-wider">
          No se puede conectar con el servidor backend.
        </p>
        <Button 
          onClick={handleRefresh} 
          className="primary-button"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          <span className="font-[var(--font-family)] uppercase tracking-wider">Reintentar Conexión</span>
        </Button>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top Grid: 3 Main Cards + MetaMask */}
      <div className="grid gap-6 lg:grid-cols-4">
        {/* Redes Blockchain Card */}
        <NetworksCard networks={networks} isLoading={isLoading} />

        {/* Rendimiento en Tiempo Real Card */}
        <PerformanceCard metrics={metrics} isLoading={isLoading} />

        {/* Third Card - Estadísticas */}
        <Card className="card-base glass-effect">
          <CardContent className="p-6">
            <h2 className="font-[var(--font-family)] font-[var(--font-weight-semibold)] uppercase text-[var(--color-text)] tracking-wide text-lg mb-2">
              Estadísticas
            </h2>
            <p className="font-[var(--font-family)] uppercase text-xs text-[var(--color-text)] opacity-70 tracking-wider mb-4">
              Métricas generales
            </p>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-[var(--color-hover)] rounded-lg">
                <span className="font-[var(--font-family)] uppercase text-xs text-[var(--color-text)] opacity-70 tracking-wider">
                  Volumen 24h
                </span>
                <span className="font-[var(--font-family)] uppercase font-[var(--font-weight-semibold)] text-sm tracking-wide text-[var(--color-text)]">
                  {formatCurrency(metrics?.blockchain?.total_volume_24h || 0)}
                </span>
              </div>
              
              <div className="flex justify-between items-center p-3 bg-[var(--color-hover)] rounded-lg">
                <span className="font-[var(--font-family)] uppercase text-xs text-[var(--color-text)] opacity-70 tracking-wider">
                  Arbitrajes 24h
                </span>
                <span className="font-[var(--font-family)] uppercase font-[var(--font-weight-semibold)] text-sm tracking-wide text-[var(--color-text)]">
                  {metrics?.blockchain?.successful_arbitrages_24h || 0}
                </span>
              </div>

              <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-lg">
                <span className="font-[var(--font-family)] uppercase text-xs text-slate-600 tracking-wider">
                  Ganancia Potencial
                </span>
                <span className="font-[var(--font-family)] uppercase font-[var(--font-weight-semibold)] text-sm tracking-wide text-emerald-600">
                  {formatCurrency(metrics?.recent_performance?.total_potential_profit_24h || 0)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* MetaMask Wallet */}
        <MetaMaskConnector showDetails={false} />
      </div>

      {/* Full Width Opportunities Table */}
      <OpportunitiesTable 
        opportunities={opportunities} 
        isLoading={isLoading}
        onExecute={handleExecuteArbitrage}
      />

      {/* Connection Status Footer */}
      {lastUpdate && (
        <div className="text-center">
          <p className="font-[var(--font-family)] uppercase text-xs text-[var(--color-text)] opacity-60 tracking-wider">
            Última actualización: {lastUpdate.toLocaleTimeString('es-ES')}
          </p>
        </div>
      )}
    </div>
  )
}
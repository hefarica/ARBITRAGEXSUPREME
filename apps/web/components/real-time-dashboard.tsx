'use client'

import React from 'react'
// import { DashboardLayout } from './dashboard-layout' // Archivo no encontrado
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
import { useArbitrageData } from '@/hooks/useArbitrageData'
import { type ArbitrageOpportunity } from '@/services/arbitrageService'
import { MetaMaskConnector } from '@/components/metamask-connector'

// Real Time Opportunities Table
function RealTimeOpportunitiesTable({ opportunities }: { opportunities: ArbitrageOpportunity[] }) {
  if (!opportunities || opportunities.length === 0) {
    return (
      <Card className="backdrop-blur-md bg-white/90 border rounded-2xl shadow-sm">
        <CardContent className="p-6 text-center text-gray-500">
          <h2 className="font-montserrat uppercase font-semibold text-gray-900 tracking-wide text-lg mb-2">Oportunidades de Arbitraje en Tiempo Real</h2>
          <p className="font-montserrat uppercase text-xs text-gray-500 tracking-wider">Escaneando oportunidades...</p>
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
    <Card className="backdrop-blur-md bg-white/90 border rounded-2xl shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="font-montserrat uppercase text-lg font-semibold text-gray-900 tracking-wide">Oportunidades de Arbitraje en Tiempo Real</CardTitle>
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
                <th className="text-left p-4 font-montserrat uppercase text-xs text-slate-600 tracking-wider">TOKEN/RED</th>
                <th className="text-left p-4 font-montserrat uppercase text-xs text-slate-600 tracking-wider">GANANCIA</th>
                <th className="text-left p-4 font-montserrat uppercase text-xs text-slate-600 tracking-wider">ESTRATEGIA</th>
                <th className="text-left p-4 font-montserrat uppercase text-xs text-slate-600 tracking-wider">CONFIANZA</th>
                <th className="text-left p-4 font-montserrat uppercase text-xs text-slate-600 tracking-wider">EXPIRA</th>
                <th className="text-right p-4 font-montserrat uppercase text-xs text-slate-600 tracking-wider">ACCIONES</th>
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
                      <div className="font-montserrat uppercase font-medium text-slate-900 capitalize tracking-wide">
                        {opp.strategy.replace(/_/g, ' ')}
                      </div>
                      <div className="font-montserrat uppercase text-xs text-slate-600 tracking-wider">
                        Gas: {opp.gasEstimate} units
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
                      <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 rounded-xl font-montserrat uppercase text-xs tracking-wider">
                        <Play className="w-3 h-3 mr-1" />
                        EJECUTAR
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
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Error de Conexión</h1>
          <p className="text-sm text-gray-600">No se puede conectar con el backend</p>
        </div>
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
      </div>
    )
  }

  const activeNetworks = networks.filter((n: any) => n.connected)
  const inactiveNetworks = networks.filter((n: any) => !n.connected)

  return (
    <div className="space-y-6 p-6">
      {/* Header simplificado */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard de Arbitraje en Tiempo Real</h1>
        <p className="text-sm text-gray-600">Datos reales de blockchain conectado</p>
        <button 
          onClick={handleRefresh}
          disabled={isLoading}
          className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {isLoading ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>
        {/* Top Grid: 3 Main Cards + MetaMask */}
        <div className="grid gap-6 lg:grid-cols-4">
          {/* Redes Blockchain Card */}
          <Card className="backdrop-blur-md bg-white/90 border rounded-2xl shadow-sm">
            <CardContent className="p-6">
              <h2 className="font-montserrat uppercase font-semibold text-gray-900 tracking-wide text-lg mb-2">Redes Blockchain</h2>
              <p className="font-montserrat uppercase text-xs text-gray-500 tracking-wider mb-4">Conexiones en tiempo real</p>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-montserrat uppercase text-sm text-slate-700 tracking-wide">Activas</span>
                  <Badge className="bg-emerald-100 text-emerald-800 font-montserrat uppercase text-xs tracking-wider">
                    ({activeNetworks.length})
                  </Badge>
                </div>
                
                {activeNetworks.slice(0, 3).map((network: any) => (
                  <div key={network.id} className="flex items-center space-x-2 p-2 bg-emerald-50 rounded-lg">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                    <span className="font-montserrat uppercase text-sm font-medium text-slate-800 tracking-wide">{network.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Rendimiento en Tiempo Real Card */}
          <Card className="backdrop-blur-md bg-white/90 border rounded-2xl shadow-sm">
            <CardContent className="p-6">
              <h2 className="font-montserrat uppercase font-semibold text-gray-900 tracking-wide text-lg mb-2">Rendimiento en Tiempo Real</h2>
              <p className="font-montserrat uppercase text-xs text-gray-500 tracking-wider mb-4">Escaneando oportunidades</p>
              
              <div className="space-y-3">
                <div className="space-y-2">
                  <h4 className="font-montserrat uppercase text-sm font-medium text-slate-700 tracking-wider">Métricas Live</h4>
                  
                  <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-lg">
                    <span className="font-montserrat uppercase text-xs text-slate-600 tracking-wider">Escaneo Activo</span>
                    <Badge className="bg-emerald-600 font-montserrat uppercase text-xs tracking-wider">
                      {metrics?.real_time_metrics?.live_scanning ? 'ON' : 'OFF'}
                    </Badge>
                  </div>
                  
                  <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                    <span className="font-montserrat uppercase text-xs text-slate-600 tracking-wider">Oportunidades/min</span>
                    <span className="font-montserrat uppercase font-semibold text-sm tracking-wide">{metrics?.real_time_metrics?.opportunities_per_minute || '0'}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Estadísticas Card */}
          <Card className="backdrop-blur-md bg-white/90 border rounded-2xl shadow-sm">
            <CardContent className="p-6">
              <h2 className="font-montserrat uppercase font-semibold text-gray-900 tracking-wide text-lg mb-2">Estadísticas</h2>
              <p className="font-montserrat uppercase text-xs text-gray-500 tracking-wider mb-4">Métricas generales</p>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                  <span className="font-montserrat uppercase text-xs text-slate-600 tracking-wider">Total Volumen 24h</span>
                  <span className="font-montserrat uppercase font-semibold text-sm tracking-wide">${metrics?.blockchain?.total_volume_24h || '0'}</span>
                </div>
                
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                  <span className="font-montserrat uppercase text-xs text-slate-600 tracking-wider">Arbitrajes Exitosos</span>
                  <span className="font-montserrat uppercase font-semibold text-sm tracking-wide">{metrics?.blockchain?.successful_arbitrages_24h || '0'}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* MetaMask Wallet */}
          <MetaMaskConnector showDetails={false} />
        </div>

        {/* Full Width Opportunities Table */}
        <RealTimeOpportunitiesTable opportunities={opportunities} />
      </div>
    </div>
  )
}
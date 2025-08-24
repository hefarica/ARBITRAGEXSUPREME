'use client'

import React, { useState } from 'react'
import { DashboardLayout } from './dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  TrendingUp, 
  TrendingDown, 
  ExternalLink,
  Clock,
  Zap,
  AlertTriangle,
  Filter,
  Search,
  ArrowUpDown,
  Play,
  Pause,
  BarChart3,
  DollarSign,
  Activity
} from 'lucide-react'
import { cn, formatCurrency, formatPercentage, formatTimeAgo, getNetworkColor } from '@/lib/utils'
import { useOpportunities, type ArbitrageOpportunity } from '@/hooks/useArbitrageData'
import { Pagination } from '@/components/ui/pagination'
import { MetaMaskConnector } from '@/components/metamask-connector'
import { useMetaMask } from '@/hooks/useMetaMask'

// Enhanced Opportunities Table with filters and detailed view
function EnhancedOpportunitiesTable({ opportunities, isLoading, pagination, onPageChange, onExecute, isConnected }: { 
  opportunities: ArbitrageOpportunity[], 
  isLoading: boolean,
  pagination?: any,
  onPageChange: (page: number) => void,
  onExecute: (opp: ArbitrageOpportunity) => void,
  isConnected: boolean
}) {
  const [sortField, setSortField] = useState<keyof ArbitrageOpportunity>('profitPercentage')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'executing'>('all')
  const [filterStrategy, setFilterStrategy] = useState<string>('all')

  const handleSort = (field: keyof ArbitrageOpportunity) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  // Get unique strategies for filter
  const strategies = Array.from(new Set(opportunities.map(opp => opp.strategy)))

  const filteredAndSortedOpportunities = opportunities
    .filter(opp => {
      const statusMatch = filterStatus === 'all' || opp.source === filterStatus
      const strategyMatch = filterStrategy === 'all' || opp.strategy === filterStrategy
      return statusMatch && strategyMatch
    })
    .sort((a, b) => {
      const aVal = a[sortField]
      const bVal = b[sortField]
      const direction = sortDirection === 'asc' ? 1 : -1
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return (aVal - bVal) * direction
      }
      return String(aVal).localeCompare(String(bVal)) * direction
    })

  const getRiskColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-emerald-100 text-emerald-800 border-emerald-200'
    if (confidence >= 0.6) return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    return 'bg-red-100 text-red-800 border-red-200'
  }

  const getRiskLevel = (confidence: number) => {
    if (confidence >= 0.8) return 'Bajo'
    if (confidence >= 0.6) return 'Medio'
    return 'Alto'
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cargando Oportunidades...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-16 bg-slate-200 rounded"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-2xl font-bold">Oportunidades de Arbitraje</CardTitle>
          <div className="flex items-center space-x-2">
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
              {filteredAndSortedOpportunities.length} oportunidades
            </Badge>
            <Badge variant="outline" className="animate-pulse">
              <div className="w-2 h-2 bg-emerald-500 rounded-full mr-2"></div>
              En vivo
            </Badge>
          </div>
        </div>
        
        {/* Filters */}
        <div className="flex flex-wrap gap-4 mt-6">
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-slate-600">Estado:</label>
            <select 
              value={filterStatus} 
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="px-3 py-1 border border-slate-300 rounded-md text-sm"
            >
              <option value="all">Todas</option>
              <option value="active">Activas</option>
              <option value="executing">Ejecutando</option>
            </select>
          </div>
          
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium text-slate-600">Estrategia:</label>
            <select 
              value={filterStrategy} 
              onChange={(e) => setFilterStrategy(e.target.value)}
              className="px-3 py-1 border border-slate-300 rounded-md text-sm"
            >
              <option value="all">Todas</option>
              {strategies.map(strategy => (
                <option key={strategy} value={strategy}>
                  {strategy.replace(/_/g, ' ').toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left p-4 font-medium text-slate-600">Token/Redes</th>
                <th 
                  className="text-left p-4 font-medium text-slate-600 cursor-pointer hover:bg-slate-100"
                  onClick={() => handleSort('profitPercentage')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Ganancia</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="text-left p-4 font-medium text-slate-600">Estrategia</th>
                <th className="text-left p-4 font-medium text-slate-600">Riesgo</th>
                <th 
                  className="text-left p-4 font-medium text-slate-600 cursor-pointer hover:bg-slate-100"
                  onClick={() => handleSort('expiresAt')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Expira</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="text-left p-4 font-medium text-slate-600">Volumen</th>
                <th className="text-right p-4 font-medium text-slate-600">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedOpportunities.map((opp) => (
                <tr key={opp.id} className="border-b hover:bg-slate-50 transition-colors">
                  <td className="p-4">
                    <div className="space-y-2">
                      {/* Mostrar ruta triangular si existe */}
                      {opp.strategy === 'triangular_arbitrage' && opp.triangularPath ? (
                        <div>
                          <div className="font-medium text-slate-900">
                            {opp.triangularPath.route}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            {opp.triangularPath.steps.map((step, idx) => (
                              <span key={idx}>
                                {step.from} → {step.to} ({step.dex})
                                {idx < opp.triangularPath!.steps.length - 1 ? ' • ' : ''}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="font-medium text-slate-900">
                          {opp.tokenIn}/{opp.tokenOut}
                        </div>
                      )}
                      
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className={getNetworkColor(opp.blockchainFrom)}>
                          {opp.blockchainFrom}
                        </Badge>
                        {opp.blockchainFrom !== opp.blockchainTo && (
                          <>
                            <ArrowUpDown className="w-3 h-3" />
                            <Badge variant="outline" className={getNetworkColor(opp.blockchainTo)}>
                              {opp.blockchainTo}
                            </Badge>
                          </>
                        )}
                        {opp.strategy === 'triangular_arbitrage' && (
                          <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-200">
                            Triangular
                          </Badge>
                        )}
                      </div>
                      
                      {opp.dexPath && (
                        <div className="text-xs text-slate-500">
                          {opp.strategy === 'triangular_arbitrage' ? (
                            // Para triangular, mostrar la secuencia completa
                            opp.dexPath.map((path, idx) => (
                              <span key={idx}>
                                {path.exchange}{path.pair ? ` (${path.pair})` : ''}
                                {idx < opp.dexPath.length - 1 ? ' → ' : ''}
                              </span>
                            ))
                          ) : (
                            // Para otros tipos, mostrar como antes
                            opp.dexPath.map(path => path.exchange).join(' → ')
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                  
                  <td className="p-4">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <TrendingUp className="w-4 h-4 text-emerald-600" />
                        <span className="font-bold text-emerald-600">
                          {formatPercentage(opp.profitPercentage)}
                        </span>
                      </div>
                      <div className="text-sm text-slate-600">
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
                    <div className="text-sm">
                      <div className="text-slate-900">
                        {formatTimeAgo(opp.expiresAt)}
                      </div>
                      <div className="text-xs text-slate-500">
                        {new Date(opp.expiresAt).toLocaleTimeString()}
                      </div>
                    </div>
                  </td>
                  
                  <td className="p-4">
                    <div className="text-sm">
                      <div className="font-medium text-slate-900">
                        {formatCurrency(parseFloat(opp.amountIn))}
                      </div>
                      <div className="text-slate-600">
                        → {formatCurrency(parseFloat(opp.expectedAmountOut))}
                      </div>
                    </div>
                  </td>
                  
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <Button 
                        size="sm" 
                        onClick={() => onExecute(opp)}
                        disabled={!isConnected}
                        className={cn(
                          "bg-emerald-600 hover:bg-emerald-700",
                          !isConnected && "bg-slate-400 hover:bg-slate-400 cursor-not-allowed"
                        )}
                      >
                        <Play className="w-3 h-3 mr-1" />
                        {isConnected ? 'Ejecutar' : 'Conectar Wallet'}
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
        
        {filteredAndSortedOpportunities.length === 0 && !isLoading && (
          <div className="text-center py-12">
            <div className="text-slate-400 mb-2">
              <Search className="w-12 h-12 mx-auto" />
            </div>
            <p className="text-slate-600">No se encontraron oportunidades</p>
            <p className="text-sm text-slate-500 mt-1">
              Ajusta los filtros o espera a que se detecten nuevas oportunidades
            </p>
          </div>
        )}
        
        {/* Paginación */}
        {pagination && pagination.totalPages > 1 && (
          <div className="p-4 border-t bg-slate-50">
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={onPageChange}
              showing={pagination.showing}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Statistics Cards for Opportunities page
function OpportunityStats({ opportunities }: { opportunities: ArbitrageOpportunity[] }) {
  const totalProfit = opportunities.reduce((sum, opp) => sum + parseFloat(opp.profitAmount), 0)
  const avgProfitPercentage = opportunities.length > 0 
    ? opportunities.reduce((sum, opp) => sum + opp.profitPercentage, 0) / opportunities.length 
    : 0
  const highRiskCount = opportunities.filter(opp => opp.confidence < 0.6).length
  const totalVolume = opportunities.reduce((sum, opp) => sum + parseFloat(opp.amountIn), 0)

  const stats = [
    {
      title: "Ganancia Total Potencial",
      value: formatCurrency(totalProfit),
      icon: DollarSign,
      color: "text-emerald-600",
      bgColor: "bg-emerald-100"
    },
    {
      title: "Ganancia Promedio",
      value: formatPercentage(avgProfitPercentage),
      icon: TrendingUp,
      color: "text-blue-600",
      bgColor: "bg-blue-100"
    },
    {
      title: "Oportunidades Alto Riesgo",
      value: highRiskCount.toString(),
      icon: AlertTriangle,
      color: "text-red-600",
      bgColor: "bg-red-100"
    },
    {
      title: "Volumen Total",
      value: formatCurrency(totalVolume),
      icon: BarChart3,
      color: "text-purple-600",
      bgColor: "bg-purple-100"
    }
  ]

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
      {stats.map((stat, index) => {
        const Icon = stat.icon
        return (
          <Card key={index}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">{stat.title}</p>
                  <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
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

export function RealTimeOpportunitiesPage() {
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(8) // Máximo 8 por página como solicitaste
  
  const { opportunities, totalOpportunities, breakdown, pagination, isLoading, error, refresh } = useOpportunities(currentPage, itemsPerPage)
  const { isConnected, address, chainName } = useMetaMask()

  const handleRefresh = () => {
    refresh()
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handleExecuteArbitrage = async (opp: ArbitrageOpportunity) => {
    if (!isConnected || !address) {
      alert('Por favor conecta tu wallet MetaMask primero')
      return
    }

    if (opp.strategy === 'triangular_arbitrage' && opp.triangularPath) {
      alert(`Ejecutando Triangular Arbitrage: ${opp.triangularPath.route}\n\nEsto es una simulación. En producción, se ejecutarían las transacciones reales.`)
    } else {
      alert(`Ejecutando Arbitraje: ${opp.tokenIn} → ${opp.tokenOut}\n\nEsto es una simulación. En producción, se ejecutarían las transacciones reales.`)
    }
  }

  if (error) {
    return (
      <DashboardLayout
        title="Error - Oportunidades"
        subtitle="No se pueden cargar las oportunidades"
      >
        <Card className="p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Error de Conexión</h2>
          <p className="text-slate-600 mb-4">
            No se pueden cargar las oportunidades de arbitraje
          </p>
          <Button onClick={handleRefresh} className="bg-emerald-600 hover:bg-emerald-700">
            <TrendingUp className="w-4 h-4 mr-2" />
            Reintentar
          </Button>
        </Card>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout
      title="Oportunidades de Arbitraje"
      subtitle={`${totalOpportunities} oportunidades detectadas en tiempo real`}
      onRefresh={handleRefresh}
      isRefreshing={isLoading}
    >
      <div className="space-y-6">
        {/* MetaMask Connection and Statistics */}
        <div className="grid gap-6 lg:grid-cols-4">
          <div className="lg:col-span-3">
            <OpportunityStats opportunities={opportunities} />
          </div>
          <div className="lg:col-span-1">
            <MetaMaskConnector compact={false} showDetails={true} />
          </div>
        </div>

        {/* Market Overview */}
        {breakdown && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="w-5 h-5 text-emerald-600" />
                <span>Resumen del Mercado</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="text-center p-4 bg-emerald-50 rounded-lg">
                  <div className="text-2xl font-bold text-emerald-600">
                    {breakdown.live_blockchain_opportunities || 0}
                  </div>
                  <div className="text-sm text-emerald-700">Oportunidades Live</div>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {breakdown.avg_profit_percentage || '0.00'}%
                  </div>
                  <div className="text-sm text-blue-700">Ganancia Promedio</div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    {formatCurrency(parseFloat(breakdown.total_potential_profit || '0'))}
                  </div>
                  <div className="text-sm text-purple-700">Ganancia Potencial Total</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Enhanced Opportunities Table */}
        <EnhancedOpportunitiesTable 
          opportunities={opportunities} 
          isLoading={isLoading}
          pagination={pagination}
          onPageChange={handlePageChange}
          onExecute={handleExecuteArbitrage}
          isConnected={isConnected}
        />
      </div>
    </DashboardLayout>
  )
}
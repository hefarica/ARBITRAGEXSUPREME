'use client'

import React, { useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Network, 
  Activity, 
  Zap,
  RefreshCw,
  Settings,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  Globe,
  PieChart,
  BarChart3,
  Wallet,
  LineChart,
  Target,
  Shield,
  Timer
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useArbitrageSnapshot } from '@/hooks/useArbitrageSnapshot'

// ============================================================================
// MEMOIZED COMPONENTS FOR ANTI-FLICKER OPTIMIZATION
// ============================================================================

// Memoized Arbitrage Opportunity Row Component
const ArbitrageOpportunityRow = React.memo(({ 
  chain, 
  index, 
  opportunitiesByChain, 
  formatCurrency, 
  formatPercentage 
}: {
  chain: any;
  index: number;
  opportunitiesByChain: any;
  formatCurrency: (value: number) => string;
  formatPercentage: (value: number) => string;
}) => {
  const chainKey = String(chain.chainId || '')
  const opportunities = (opportunitiesByChain as any)[chainKey] || []
  const totalProfit = opportunities.reduce((sum: number, opp: any) => sum + (opp.profitUSD ?? 0), 0)
  const avgROI = opportunities.length > 0 
    ? opportunities.reduce((sum: number, opp: any) => sum + (opp.profitPercentage ?? 0), 0) / opportunities.length 
    : 0

  return (
    <tr 
      className={cn(
        "hover:bg-gradient-to-r hover:from-indigo-50/50 hover:to-blue-50/50 transition-all duration-200",
        index % 2 === 0 ? "bg-white" : "bg-gray-50/30"
      )}
    >
      <td className="px-6 py-4">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-100 to-blue-200 rounded-full flex items-center justify-center">
            <Globe className="w-4 h-4 text-indigo-600" />
          </div>
          <div>
            <div className="font-semibold text-gray-900">{chain.chainName}</div>
            <div className="text-xs text-gray-500">Chain ID: {chain.chainId}</div>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 text-right">
        <div className="font-semibold text-gray-900">{opportunities.length}</div>
        <div className="text-xs text-gray-500">detectadas</div>
      </td>
      <td className="px-6 py-4 text-right">
        <div className="font-semibold text-emerald-600">{formatCurrency(totalProfit)}</div>
        <div className="text-xs text-gray-500">estimado</div>
      </td>
      <td className="px-6 py-4 text-right">
        <div className={cn(
          "font-semibold",
          avgROI > 2 ? "text-emerald-600" : avgROI > 1 ? "text-yellow-600" : "text-gray-600"
        )}>
          {formatPercentage(avgROI)}
        </div>
        <div className="text-xs text-gray-500">promedio</div>
      </td>
      <td className="px-6 py-4 text-right">
        <div className="font-semibold text-blue-600">{formatCurrency(chain.totalTVL)}</div>
        <div className="text-xs text-gray-500">liquidez</div>
      </td>
      <td className="px-6 py-4 text-center">
        <Badge 
          variant={opportunities.length > 0 ? "default" : "secondary"}
          className={cn(
            opportunities.length > 0 
              ? "bg-emerald-100 text-emerald-700 border-emerald-300" 
              : "bg-gray-100 text-gray-600 border-gray-300"
          )}
        >
          {opportunities.length > 0 ? 'Activo' : 'Inactivo'}
        </Badge>
      </td>
    </tr>
  );
})

// Memoized DEX Protocol Row Component
const DEXProtocolRow = React.memo(({ 
  chain, 
  index, 
  formatCurrency 
}: {
  chain: any;
  index: number;
  formatCurrency: (value: number) => string;
}) => (
  <tr 
    className={cn(
      "hover:bg-gradient-to-r hover:from-emerald-50/50 hover:to-green-50/50 transition-all duration-200",
      index % 2 === 0 ? "bg-white" : "bg-gray-50/30"
    )}
  >
    <td className="px-6 py-4">
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 bg-gradient-to-br from-emerald-100 to-green-200 rounded-full flex items-center justify-center">
          <Network className="w-4 h-4 text-emerald-600" />
        </div>
        <div>
          <div className="font-semibold text-gray-900">{chain.chainName}</div>
          <div className="text-xs text-gray-500">{chain.nativeToken}</div>
        </div>
      </div>
    </td>
    <td className="px-6 py-4 text-right">
      <div className="font-semibold text-gray-900">{chain.dexMetrics.totalDexes}</div>
      <div className="text-xs text-gray-500">protocolos</div>
    </td>
    <td className="px-6 py-4 text-right">
      <div className="font-semibold text-emerald-600">{formatCurrency(chain.dexMetrics.totalTVL)}</div>
      <div className="text-xs text-gray-500">liquidez</div>
    </td>
    <td className="px-6 py-4 text-right">
      <div className="font-semibold text-blue-600">{chain.dexMetrics.flashLoanSupport}</div>
      <div className="text-xs text-gray-500">soportados</div>
    </td>
    <td className="px-6 py-4">
      <div className="space-y-1">
        {chain.dexMetrics.topDexes.slice(0, 2).map((dex: any, i: number) => (
          <div key={`${chain.chainId}-${dex.name}-${i}`} className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">{dex.name}</span>
            <Badge variant="outline" className="text-xs">
              {dex.type}
            </Badge>
          </div>
        ))}
      </div>
    </td>
    <td className="px-6 py-4 text-right">
      <div className="font-semibold text-purple-600">{formatCurrency(chain.dexMetrics.averageTVL)}</div>
      <div className="text-xs text-gray-500">por DEX</div>
    </td>
  </tr>
))

// Memoized Lending Protocol Row Component
const LendingProtocolRow = React.memo(({ 
  chain, 
  index, 
  formatCurrency, 
  formatPercentage 
}: {
  chain: any;
  index: number;
  formatCurrency: (value: number) => string;
  formatPercentage: (value: number) => string;
}) => (
  <tr 
    className={cn(
      "hover:bg-gradient-to-r hover:from-orange-50/50 hover:to-yellow-50/50 transition-all duration-200",
      index % 2 === 0 ? "bg-white" : "bg-gray-50/30"
    )}
  >
    <td className="px-6 py-4">
      <div className="flex items-center space-x-3">
        <div className="w-8 h-8 bg-gradient-to-br from-orange-100 to-yellow-200 rounded-full flex items-center justify-center">
          <Database className="w-4 h-4 text-orange-600" />
        </div>
        <div>
          <div className="font-semibold text-gray-900">{chain.chainName}</div>
          <div className="text-xs text-gray-500">{chain.nativeToken}</div>
        </div>
      </div>
    </td>
    <td className="px-6 py-4 text-right">
      <div className="font-semibold text-gray-900">{chain.lendingMetrics.totalProtocols}</div>
      <div className="text-xs text-gray-500">activos</div>
    </td>
    <td className="px-6 py-4 text-right">
      <div className="font-semibold text-orange-600">{formatCurrency(chain.lendingMetrics.totalTVL)}</div>
      <div className="text-xs text-gray-500">depositado</div>
    </td>
    <td className="px-6 py-4 text-right">
      <div className={cn(
        "font-semibold",
        chain.lendingMetrics.averageBorrowRate > 5 ? "text-red-600" : 
        chain.lendingMetrics.averageBorrowRate > 3 ? "text-yellow-600" : "text-green-600"
      )}>
        {formatPercentage(chain.lendingMetrics.averageBorrowRate)}
      </div>
      <div className="text-xs text-gray-500">borrow APR</div>
    </td>
    <td className="px-6 py-4 text-right">
      <div className="font-semibold text-blue-600">{chain.lendingMetrics.flashLoanSupport}</div>
      <div className="text-xs text-gray-500">soportados</div>
    </td>
    <td className="px-6 py-4">
      <div className="space-y-1">
        {chain.lendingMetrics.topProtocols.slice(0, 2).map((protocol: any, i: number) => (
          <div key={`${chain.chainId}-${protocol.name}-${i}`} className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">{protocol.name}</span>
            <span className="text-xs text-gray-500">{formatPercentage(protocol.borrowRate)}</span>
          </div>
        ))}
      </div>
    </td>
  </tr>
))

// ============================================================================
// TABLA DE OPORTUNIDADES DE ARBITRAJE POR BLOCKCHAIN
// ============================================================================

function ArbitrageOpportunitiesTable() {
  const { 
    blockchainSummaries, 
    getOpportunitiesByChain, 
    formatCurrency, 
    formatPercentage,
    isLoading 
  } = useArbitrageSnapshot()

  // Memoized data processing for performance
  const opportunitiesByChain = useMemo(() => getOpportunitiesByChain(), [getOpportunitiesByChain])
  
  // Memoized total calculations
  const totals = useMemo(() => {
    const totalOpportunities = blockchainSummaries.reduce((sum: number, chain: any) => {
      const chainKey = String(chain.chainId || '')
      const opportunities = (opportunitiesByChain as any)[chainKey] || []
      return sum + opportunities.length
    }, 0)
    
    const totalProfit = blockchainSummaries.reduce((sum: number, chain: any) => {
      const opportunities = ((opportunitiesByChain as any)[String(chain.chainId || '')] || [])
      return sum + opportunities.reduce((chainSum: number, opp: any) => chainSum + (opp.profitUSD ?? 0), 0)
    }, 0)
    
    const totalTVL = blockchainSummaries.reduce((sum, chain) => sum + chain.totalTVL, 0)
    const activeNetworks = blockchainSummaries.length
    
    return { totalOpportunities, totalProfit, totalTVL, activeNetworks }
  }, [blockchainSummaries, opportunitiesByChain])

  return (
    <Card className="bg-white/95 backdrop-blur-sm border border-indigo-200/30 shadow-xl">
      <CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50 border-b">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2 text-gray-800">
              <Target className="w-5 h-5 text-indigo-600" />
              <span>Oportunidades de Arbitraje por Blockchain</span>
            </CardTitle>
            <CardDescription className="text-gray-600">
              Análisis detallado de rentabilidad por red y estrategia
            </CardDescription>
          </div>
          {isLoading && <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50/80 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Blockchain
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Oportunidades
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Profit Potencial
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  ROI Promedio
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  TVL Total
                </th>
                <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {blockchainSummaries.map((chain, index) => (
                <ArbitrageOpportunityRow 
                  key={`arbitrage-${chain.chainId}-${chain.chainName}`}
                  chain={chain}
                  index={index}
                  opportunitiesByChain={opportunitiesByChain}
                  formatCurrency={formatCurrency}
                  formatPercentage={formatPercentage}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* Fila de totales - optimizada con datos memoizados */}
        <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border-t border-indigo-200/50 p-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-indigo-600">
                {totals.totalOpportunities}
              </div>
              <div className="text-sm text-gray-600">Total Oportunidades</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-600">
                {formatCurrency(totals.totalProfit)}
              </div>
              <div className="text-sm text-gray-600">Profit Total Potencial</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrency(totals.totalTVL)}
              </div>
              <div className="text-sm text-gray-600">TVL Agregado</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {totals.activeNetworks}
              </div>
              <div className="text-sm text-gray-600">Redes Activas</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================================
// TABLA DE PROTOCOLOS DEX POR BLOCKCHAIN
// ============================================================================

function DEXProtocolsTable() {
  const { 
    blockchainSummaries, 
    getDEXMetricsByType, 
    formatCurrency, 
    isLoading 
  } = useArbitrageSnapshot()

  // Memoized data processing for performance
  const dexMetrics = useMemo(() => getDEXMetricsByType(), [getDEXMetricsByType])

  return (
    <Card className="bg-white/95 backdrop-blur-sm border border-emerald-200/30 shadow-xl">
      <CardHeader className="bg-gradient-to-r from-emerald-50 to-green-50 border-b">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2 text-gray-800">
              <BarChart3 className="w-5 h-5 text-emerald-600" />
              <span>Análisis de Protocolos DEX por Blockchain</span>
            </CardTitle>
            <CardDescription className="text-gray-600">
              Distribución de liquidez y tipos de AMM por red
            </CardDescription>
          </div>
          {isLoading && <RefreshCw className="w-4 h-4 animate-spin text-emerald-600" />}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50/80 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Blockchain
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Total DEX
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  TVL DEX
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Flash Loans
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Top DEX
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Avg TVL
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {blockchainSummaries.map((chain, index) => (
                <DEXProtocolRow 
                  key={`dex-${chain.chainId}-${chain.chainName}`}
                  chain={chain}
                  index={index}
                  formatCurrency={formatCurrency}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* Resumen de tipos de DEX */}
        <div className="bg-gradient-to-r from-emerald-50 to-green-50 border-t border-emerald-200/50 p-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Distribución por Tipo de AMM</h4>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Object.entries(dexMetrics).map(([type, metrics]) => (
              <div key={type} className="text-center p-3 bg-white/50 rounded-lg">
                <div className="font-bold text-emerald-600">{metrics.count}</div>
                <div className="text-xs text-gray-600 mb-1">{type}</div>
                <div className="text-xs text-gray-500">{formatCurrency(metrics.tvl)}</div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================================
// TABLA DE PROTOCOLOS DE LENDING POR BLOCKCHAIN
// ============================================================================

function LendingProtocolsTable() {
  const { 
    blockchainSummaries, 
    getLendingMetrics, 
    formatCurrency, 
    formatPercentage,
    isLoading 
  } = useArbitrageSnapshot()

  // Memoized data processing for performance
  const lendingMetrics = useMemo(() => getLendingMetrics(), [getLendingMetrics])

  return (
    <Card className="bg-white/95 backdrop-blur-sm border border-orange-200/30 shadow-xl">
      <CardHeader className="bg-gradient-to-r from-orange-50 to-yellow-50 border-b">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2 text-gray-800">
              <Wallet className="w-5 h-5 text-orange-600" />
              <span>Protocolos de Lending por Blockchain</span>
            </CardTitle>
            <CardDescription className="text-gray-600">
              Análisis de tasas de interés y oportunidades de arbitraje de lending
            </CardDescription>
          </div>
          {isLoading && <RefreshCw className="w-4 h-4 animate-spin text-orange-600" />}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50/80 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Blockchain
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Protocolos
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  TVL Lending
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Tasa Promedio
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Flash Loans
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Top Protocolos
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {blockchainSummaries.map((chain, index) => (
                <LendingProtocolRow 
                  key={`lending-${chain.chainId}-${chain.chainName}`}
                  chain={chain}
                  index={index}
                  formatCurrency={formatCurrency}
                  formatPercentage={formatPercentage}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* Resumen de métricas de lending */}
        <div className="bg-gradient-to-r from-orange-50 to-yellow-50 border-t border-orange-200/50 p-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="text-center p-3 bg-white/50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">{formatCurrency(lendingMetrics.totalTVL)}</div>
              <div className="text-sm text-gray-600">TVL Total Lending</div>
            </div>
            <div className="text-center p-3 bg-white/50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">{formatPercentage(lendingMetrics.avgBorrowRate)}</div>
              <div className="text-sm text-gray-600">Tasa Promedio Global</div>
            </div>
            <div className="text-center p-3 bg-white/50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{lendingMetrics.totalProtocols}</div>
              <div className="text-sm text-gray-600">Protocolos Totales</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================================
// COMPONENTE PRINCIPAL DEL DASHBOARD EMPRESARIAL
// ============================================================================

export function EnhancedArbitrageDashboard() {
  const { 
    data,
    isLoading, 
    error, 
    refresh,
    systemHealth,
    totalOpportunities,
    profitableOpportunities,
    averageProfitability,
    executionTime,
    formatCurrency,
    isDataFresh,
    lastUpdated
  } = useArbitrageSnapshot()

  // Debug logs
  React.useEffect(() => {
    console.log('🎯 [DEBUG] Dashboard data updated:', {
      hasData: !!data,
      totalOpportunities,
      profitableOpportunities,
      isLoading,
      error,
      lastUpdated: lastUpdated ? new Date(lastUpdated).toLocaleString('es-ES') : 'null',
      dataTimestamp: data?.timestamp ? new Date(data.timestamp).toLocaleString('es-ES') : 'null',
      isDataFresh
    })
  }, [data, totalOpportunities, profitableOpportunities, isLoading, error, lastUpdated, isDataFresh])

  if (error) {
    return (
      <Card className="bg-red-50/50 border border-red-200/30 rounded-2xl shadow-lg shadow-red-500/10">
        <CardContent className="p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-red-800 mb-2">Error de Conexión</h3>
          <p className="text-red-600 text-sm mb-4">
            No se pudo obtener el snapshot consolidado: {error}
          </p>
          <Button
            onClick={refresh}
            className="bg-red-500 text-white hover:bg-red-600"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Reintentar
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50 p-4 lg:p-6">
      {/* Header del Dashboard */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-800 via-blue-700 to-purple-700 bg-clip-text text-transparent">
              ArbitrageX Supreme Dashboard
            </h1>
            <p className="text-gray-600 mt-2">
              Sistema de Arbitraje DeFi Multi-Chain - Análisis Contable Empresarial en Tiempo Real
            </p>
          </div>
          <div className="flex items-center space-x-4">
            {/* Estado del sistema */}
            <Badge className={cn(
              "flex items-center space-x-2 px-4 py-2 text-sm",
              systemHealth?.status === 'healthy' ? "bg-emerald-100 text-emerald-700 border-emerald-300" :
              systemHealth?.status === 'degraded' ? "bg-yellow-100 text-yellow-700 border-yellow-300" :
              "bg-red-100 text-red-700 border-red-300"
            )}>
              {systemHealth?.status === 'healthy' ? 
                <CheckCircle2 className="w-4 h-4" /> : 
                <AlertTriangle className="w-4 h-4" />
              }
              <span>
                {systemHealth?.status === 'healthy' ? 'Sistema Activo' : 
                 systemHealth?.status === 'degraded' ? 'Sistema Degradado' : 'Sistema Error'}
              </span>
            </Badge>
            
            {/* Indicadores de tiempo */}
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <Timer className="w-4 h-4" />
              <span>Ejecutado en {executionTime}ms</span>
            </div>
            
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <Clock className="w-4 h-4" />
              <span className={cn(isDataFresh ? "text-emerald-600" : "text-orange-600")}>
                {lastUpdated ? new Date(lastUpdated).toLocaleString('es-ES', {
                  hour: '2-digit',
                  minute: '2-digit', 
                  second: '2-digit',
                  day: 'numeric',
                  month: 'short'
                }) : '--:--:--'}
              </span>
            </div>

            <Button 
              onClick={refresh} 
              disabled={isLoading}
              className="bg-indigo-600 text-white hover:bg-indigo-700"
            >
              <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
              Actualizar
            </Button>
          </div>
        </div>

        {/* Métricas principales */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-gradient-to-br from-indigo-50 to-blue-100 border border-indigo-200/50 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-indigo-600 font-medium">Oportunidades Totales</p>
                  <p className="text-3xl font-bold text-indigo-800">{totalOpportunities}</p>
                  <p className="text-xs text-indigo-600/70">detectadas</p>
                </div>
                <Target className="w-8 h-8 text-indigo-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-50 to-green-100 border border-emerald-200/50 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-emerald-600 font-medium">Oportunidades Rentables</p>
                  <p className="text-3xl font-bold text-emerald-800">{profitableOpportunities}</p>
                  <p className="text-xs text-emerald-600/70">ejecutables</p>
                </div>
                <TrendingUp className="w-8 h-8 text-emerald-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-violet-100 border border-purple-200/50 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-purple-600 font-medium">Rentabilidad Promedio</p>
                  <p className="text-3xl font-bold text-purple-800">{formatCurrency(averageProfitability)}</p>
                  <p className="text-xs text-purple-600/70">por oportunidad</p>
                </div>
                <LineChart className="w-8 h-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-yellow-100 border border-orange-200/50 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-orange-600 font-medium">Estado del Sistema</p>
                  <p className="text-lg font-bold text-orange-800">
                    {systemHealth?.status === 'healthy' ? 'Optimal' : 
                     systemHealth?.status === 'degraded' ? 'Degraded' : 'Error'}
                  </p>
                  <p className="text-xs text-orange-600/70">
                    Uptime: {systemHealth ? Math.round(systemHealth.uptime / 3600) : 0}h
                  </p>
                </div>
                <Shield className="w-8 h-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tablas detalladas */}
      <div className="space-y-8">
        {/* Tabla de Oportunidades de Arbitraje */}
        <ArbitrageOpportunitiesTable />
        
        {/* Tabla de Protocolos DEX */}
        <DEXProtocolsTable />
        
        {/* Tabla de Protocolos de Lending */}
        <LendingProtocolsTable />
      </div>

      {/* Footer con información adicional */}
      <div className="mt-8 p-6 bg-white/80 backdrop-blur-sm border border-gray-200/30 rounded-2xl shadow-lg">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-center">
          <div>
            <h4 className="text-lg font-semibold text-gray-800 mb-2">Cobertura Global</h4>
            <p className="text-gray-600 text-sm">
              Monitoreo simultáneo de {data?.blockchainSummaries?.length || 0} blockchains principales
              con más de 100+ protocolos DeFi integrados para máxima detección de oportunidades.
            </p>
          </div>
          <div>
            <h4 className="text-lg font-semibold text-gray-800 mb-2">Tiempo Real</h4>
            <p className="text-gray-600 text-sm">
              Actualizaciones cada 5 segundos con cache inteligente. Latencia promedio de {systemHealth?.responseTime || 0}ms
              para detectar y ejecutar arbitrajes antes que la competencia.
            </p>
          </div>
          <div>
            <h4 className="text-lg font-semibold text-gray-800 mb-2">Seguridad Empresarial</h4>
            <p className="text-gray-600 text-sm">
              Contratos auditados con OpenZeppelin, integración LayerZero para cross-chain,
              y sistemas de monitoreo 24/7 para máxima confiabilidad.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
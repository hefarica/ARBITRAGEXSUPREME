'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import {
  PieChart,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
  Eye,
  RefreshCw,
  Search,
  Filter,
  ArrowUpDown,
  Wallet,
  BarChart3,
  Target,
  Clock,
  AlertTriangle,
  CheckCircle
} from 'lucide-react'

// Interfaces TypeScript para Portfolio
interface PortfolioAsset {
  id: string
  symbol: string
  name: string
  network: string
  balance: number
  value_usd: number
  price_usd: number
  change_24h: number
  allocation_percentage: number
  last_updated: string
  wallet_address: string
}

interface PortfolioPosition {
  id: string
  pair: string
  type: 'arbitrage' | 'liquidity' | 'staking'
  entry_price: number
  current_price: number
  quantity: number
  pnl: number
  pnl_percentage: number
  status: 'active' | 'closed' | 'pending'
  network: string
  created_at: string
}

interface PortfolioMetrics {
  total_value_usd: number
  total_pnl_24h: number
  total_pnl_percentage_24h: number
  active_positions: number
  total_assets: number
  profit_loss_ratio: number
  win_rate: number
  average_roi: number
}

// Hook para datos del portfolio
function usePortfolioData() {
  const [assets, setAssets] = useState<PortfolioAsset[]>([])
  const [positions, setPositions] = useState<PortfolioPosition[]>([])
  const [metrics, setMetrics] = useState<PortfolioMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  const fetchPortfolioData = async () => {
    try {
      setError(null)
      
      // Obtener métricas del portfolio
      const metricsResponse = await fetch('/api/proxy/api/v2/portfolio/metrics')
      if (!metricsResponse.ok) throw new Error('Error al cargar métricas del portfolio')
      const metricsData = await metricsResponse.json()
      setMetrics(metricsData.data || metricsData)

      // Obtener assets del portfolio
      const assetsResponse = await fetch('/api/proxy/api/v2/portfolio/assets')
      if (!assetsResponse.ok) throw new Error('Error al cargar assets del portfolio')
      const assetsData = await assetsResponse.json()
      setAssets(assetsData.data || assetsData.assets || [])

      // Obtener posiciones activas
      const positionsResponse = await fetch('/api/proxy/api/v2/portfolio/positions')
      if (!positionsResponse.ok) throw new Error('Error al cargar posiciones del portfolio')
      const positionsData = await positionsResponse.json()
      setPositions(positionsData.data || positionsData.positions || [])

      setLastUpdate(new Date())
    } catch (err) {
      console.error('Error fetching portfolio data:', err)
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPortfolioData()
    
    // Auto-refresh cada 30 segundos
    const interval = setInterval(fetchPortfolioData, 30000)
    return () => clearInterval(interval)
  }, [])

  return { assets, positions, metrics, loading, error, lastUpdate, refetch: fetchPortfolioData }
}

// Componente de métricas del portfolio
function PortfolioMetricsCards({ metrics, loading }: { metrics: PortfolioMetrics | null, loading: boolean }) {
  if (loading || !metrics) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`
    if (num >= 1000) return `$${(num / 1000).toFixed(2)}K`
    return `$${num.toFixed(2)}`
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {/* Valor Total */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Valor Total</p>
              <p className="text-3xl font-bold">{formatNumber(metrics.total_value_usd)}</p>
            </div>
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* PnL 24h */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">PnL 24h</p>
              <p className={`text-3xl font-bold ${metrics.total_pnl_24h >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {metrics.total_pnl_24h >= 0 ? '+' : ''}{formatNumber(metrics.total_pnl_24h)}
              </p>
              <p className={`text-sm ${metrics.total_pnl_percentage_24h >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {metrics.total_pnl_percentage_24h >= 0 ? '+' : ''}{metrics.total_pnl_percentage_24h.toFixed(2)}%
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              {metrics.total_pnl_24h >= 0 ? 
                <TrendingUp className="w-6 h-6 text-emerald-600" /> : 
                <TrendingDown className="w-6 h-6 text-red-600" />
              }
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Posiciones Activas */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Posiciones Activas</p>
              <p className="text-3xl font-bold">{metrics.active_positions}</p>
              <p className="text-sm text-gray-500">{metrics.total_assets} assets totales</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <Target className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tasa de Éxito */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Tasa de Éxito</p>
              <p className="text-3xl font-bold">{metrics.win_rate.toFixed(1)}%</p>
              <p className="text-sm text-gray-500">ROI promedio: {metrics.average_roi.toFixed(2)}%</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Componente de tabla de assets
function AssetsTable({ assets }: { assets: PortfolioAsset[] }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<keyof PortfolioAsset>('value_usd')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const filteredAndSortedAssets = assets
    .filter(asset => 
      asset.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      asset.network.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const aVal = a[sortBy]
      const bVal = b[sortBy]
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal
      }
      return sortOrder === 'asc' ? 
        String(aVal).localeCompare(String(bVal)) : 
        String(bVal).localeCompare(String(aVal))
    })

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle>Assets del Portfolio</CardTitle>
            <CardDescription>Distribución de assets y balances por red</CardDescription>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
              <Input
                placeholder="Buscar assets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2 font-medium">Asset</th>
                <th className="text-left p-2 font-medium">Red</th>
                <th className="text-right p-2 font-medium cursor-pointer" onClick={() => {
                  if (sortBy === 'balance') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
                  else { setSortBy('balance'); setSortOrder('desc') }
                }}>
                  Balance <ArrowUpDown className="w-4 h-4 inline ml-1" />
                </th>
                <th className="text-right p-2 font-medium cursor-pointer" onClick={() => {
                  if (sortBy === 'value_usd') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
                  else { setSortBy('value_usd'); setSortOrder('desc') }
                }}>
                  Valor USD <ArrowUpDown className="w-4 h-4 inline ml-1" />
                </th>
                <th className="text-right p-2 font-medium cursor-pointer" onClick={() => {
                  if (sortBy === 'change_24h') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
                  else { setSortBy('change_24h'); setSortOrder('desc') }
                }}>
                  Cambio 24h <ArrowUpDown className="w-4 h-4 inline ml-1" />
                </th>
                <th className="text-right p-2 font-medium">Asignación</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedAssets.map((asset) => (
                <tr key={asset.id} className="border-b hover:bg-gray-50">
                  <td className="p-2">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                        <Wallet className="w-4 h-4 text-gray-600" />
                      </div>
                      <div>
                        <p className="font-medium">{asset.symbol}</p>
                        <p className="text-sm text-gray-500">{asset.name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-2">
                    <Badge variant="outline" className="text-xs">
                      {asset.network}
                    </Badge>
                  </td>
                  <td className="p-2 text-right">
                    <p className="font-medium">{asset.balance.toFixed(6)}</p>
                    <p className="text-sm text-gray-500">${asset.price_usd.toFixed(4)}</p>
                  </td>
                  <td className="p-2 text-right">
                    <p className="font-medium">${asset.value_usd.toLocaleString()}</p>
                  </td>
                  <td className="p-2 text-right">
                    <span className={`font-medium ${asset.change_24h >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {asset.change_24h >= 0 ? '+' : ''}{asset.change_24h.toFixed(2)}%
                    </span>
                  </td>
                  <td className="p-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-20 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-emerald-500 h-2 rounded-full"
                          style={{ width: `${asset.allocation_percentage}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-medium">{asset.allocation_percentage.toFixed(1)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredAndSortedAssets.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              {assets.length === 0 ? 'No hay assets en el portfolio' : 'No se encontraron assets'}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Componente de posiciones activas
function ActivePositions({ positions }: { positions: PortfolioPosition[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Posiciones Activas</CardTitle>
        <CardDescription>Operaciones de arbitraje y trading en curso</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {positions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Activity className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>No hay posiciones activas</p>
            </div>
          ) : (
            positions.map((position) => (
              <div key={position.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className="font-medium">{position.pair}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge 
                        variant={position.type === 'arbitrage' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {position.type}
                      </Badge>
                      <Badge 
                        variant={position.status === 'active' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {position.status}
                      </Badge>
                      <span className="text-sm text-gray-500">{position.network}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-medium ${position.pnl >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {position.pnl >= 0 ? '+' : ''}${position.pnl.toFixed(2)}
                    </p>
                    <p className={`text-sm ${position.pnl_percentage >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {position.pnl_percentage >= 0 ? '+' : ''}{position.pnl_percentage.toFixed(2)}%
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Precio Entrada</p>
                    <p className="font-medium">${position.entry_price.toFixed(4)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Precio Actual</p>
                    <p className="font-medium">${position.current_price.toFixed(4)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Cantidad</p>
                    <p className="font-medium">{position.quantity.toFixed(4)}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Componente principal de la página de Portfolio
export function RealTimePortfolioPage() {
  const { assets, positions, metrics, loading, error, lastUpdate, refetch } = usePortfolioData()

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Portfolio</h1>
            <p className="text-gray-600">Gestión de assets y posiciones de arbitraje</p>
            <p className="text-sm text-gray-500">
              Última actualización: {lastUpdate.toLocaleTimeString()}
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={refetch} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <div>
                  <p className="font-medium text-red-900">Error de Conectividad</p>
                  <p className="text-red-700">{error}</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2 border-red-300 text-red-700 hover:bg-red-100"
                    onClick={refetch}
                  >
                    Reintentar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Métricas del Portfolio */}
        <PortfolioMetricsCards metrics={metrics} loading={loading} />

        {/* Contenido Principal con Tabs */}
        <Tabs defaultValue="assets" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="assets">Assets</TabsTrigger>
            <TabsTrigger value="positions">Posiciones</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="assets" className="space-y-6">
            <AssetsTable assets={assets} />
          </TabsContent>

          <TabsContent value="positions" className="space-y-6">
            <ActivePositions positions={positions} />
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Analytics del Portfolio</CardTitle>
                <CardDescription>Análisis avanzado y estadísticas de rendimiento</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-gray-500">
                  <BarChart3 className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>Analytics avanzados próximamente</p>
                  <p className="text-sm">Gráficos de rendimiento, diversificación y análisis de riesgo</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
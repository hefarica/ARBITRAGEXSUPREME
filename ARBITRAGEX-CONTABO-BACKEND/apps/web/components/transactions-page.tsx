'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  History,
  ArrowUpRight,
  ArrowDownLeft,
  DollarSign,
  Clock,
  CheckCircle,
  AlertTriangle,
  X,
  RefreshCw,
  Search,
  Filter,
  ArrowUpDown,
  ExternalLink,
  TrendingUp,
  Activity
} from 'lucide-react'

// Interfaces TypeScript para Transacciones
interface Transaction {
  id: string
  hash: string
  type: 'arbitrage' | 'swap' | 'deposit' | 'withdrawal' | 'fee'
  status: 'pending' | 'confirmed' | 'failed' | 'cancelled'
  from_address: string
  to_address: string
  from_token: string
  to_token: string
  from_amount: number
  to_amount: number
  network: string
  gas_fee: number
  profit_loss: number
  timestamp: string
  block_number?: number
  confirmation_count?: number
}

interface TransactionStats {
  total_transactions: number
  successful_transactions: number
  pending_transactions: number
  failed_transactions: number
  total_volume_24h: number
  total_profit_24h: number
  average_gas_fee: number
  success_rate: number
}

// Hook para datos de transacciones
function useTransactionsData() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [stats, setStats] = useState<TransactionStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  const fetchTransactionsData = async () => {
    try {
      setError(null)
      
      // Obtener estadísticas de transacciones
      const statsResponse = await fetch('/api/proxy/api/v2/transactions/stats')
      if (!statsResponse.ok) throw new Error('Error al cargar estadísticas de transacciones')
      const statsData = await statsResponse.json()
      setStats(statsData.data || statsData)

      // Obtener historial de transacciones
      const transactionsResponse = await fetch('/api/proxy/api/v2/transactions/history')
      if (!transactionsResponse.ok) throw new Error('Error al cargar historial de transacciones')
      const transactionsData = await transactionsResponse.json()
      setTransactions(transactionsData.data || transactionsData.transactions || [])

      setLastUpdate(new Date())
    } catch (err) {
      console.error('Error fetching transactions data:', err)
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTransactionsData()
    
    // Auto-refresh cada 15 segundos
    const interval = setInterval(fetchTransactionsData, 15000)
    return () => clearInterval(interval)
  }, [])

  return { transactions, stats, loading, error, lastUpdate, refetch: fetchTransactionsData }
}

// Componente de estadísticas de transacciones
function TransactionStatsCards({ stats, loading }: { stats: TransactionStats | null, loading: boolean }) {
  if (loading || !stats) {
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

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {/* Total Transacciones */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Transacciones</p>
              <p className="text-3xl font-bold">{stats.total_transactions}</p>
              <p className="text-sm text-emerald-600">
                Éxito: {stats.success_rate.toFixed(1)}%
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <History className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Volumen 24h */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Volumen 24h</p>
              <p className="text-3xl font-bold">
                ${stats.total_volume_24h >= 1000 ? 
                  `${(stats.total_volume_24h / 1000).toFixed(1)}K` : 
                  stats.total_volume_24h.toFixed(0)}
              </p>
            </div>
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Profit 24h */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Profit 24h</p>
              <p className={`text-3xl font-bold ${stats.total_profit_24h >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {stats.total_profit_24h >= 0 ? '+' : ''}${stats.total_profit_24h.toFixed(2)}
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Estado Transacciones */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Estado</p>
              <div className="space-y-1 mt-2">
                <div className="flex justify-between text-sm">
                  <span className="text-emerald-600">Exitosas:</span>
                  <span className="font-medium">{stats.successful_transactions}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-yellow-600">Pendientes:</span>
                  <span className="font-medium">{stats.pending_transactions}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-red-600">Fallidas:</span>
                  <span className="font-medium">{stats.failed_transactions}</span>
                </div>
              </div>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <Activity className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Componente de tabla de transacciones
function TransactionsTable({ transactions }: { transactions: Transaction[] }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<keyof Transaction>('timestamp')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const filteredAndSortedTransactions = transactions
    .filter(tx => {
      const matchesSearch = tx.hash.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           tx.from_token.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           tx.to_token.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           tx.network.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = statusFilter === 'all' || tx.status === statusFilter
      const matchesType = typeFilter === 'all' || tx.type === typeFilter
      return matchesSearch && matchesStatus && matchesType
    })
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

  const getStatusIcon = (status: Transaction['status']) => {
    switch (status) {
      case 'confirmed': return <CheckCircle className="w-4 h-4 text-emerald-600" />
      case 'pending': return <Clock className="w-4 h-4 text-yellow-600" />
      case 'failed': return <X className="w-4 h-4 text-red-600" />
      case 'cancelled': return <AlertTriangle className="w-4 h-4 text-gray-600" />
      default: return <Clock className="w-4 h-4 text-gray-600" />
    }
  }

  const getStatusBadge = (status: Transaction['status']) => {
    const variants = {
      confirmed: 'bg-emerald-100 text-emerald-800',
      pending: 'bg-yellow-100 text-yellow-800',
      failed: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-800'
    }
    return variants[status] || variants.pending
  }

  const getTypeBadge = (type: Transaction['type']) => {
    const variants = {
      arbitrage: 'bg-blue-100 text-blue-800',
      swap: 'bg-green-100 text-green-800',
      deposit: 'bg-purple-100 text-purple-800',
      withdrawal: 'bg-orange-100 text-orange-800',
      fee: 'bg-gray-100 text-gray-800'
    }
    return variants[type] || variants.swap
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle>Historial de Transacciones</CardTitle>
            <CardDescription>Registro completo de todas las transacciones</CardDescription>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
              <Input
                placeholder="Buscar por hash, token, red..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="confirmed">Exitosas</SelectItem>
                <SelectItem value="pending">Pendientes</SelectItem>
                <SelectItem value="failed">Fallidas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="arbitrage">Arbitraje</SelectItem>
                <SelectItem value="swap">Swap</SelectItem>
                <SelectItem value="deposit">Depósito</SelectItem>
                <SelectItem value="withdrawal">Retiro</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2 font-medium">Transacción</th>
                <th className="text-left p-2 font-medium">Tipo</th>
                <th className="text-left p-2 font-medium">Estado</th>
                <th className="text-left p-2 font-medium">From → To</th>
                <th className="text-right p-2 font-medium">Cantidad</th>
                <th className="text-right p-2 font-medium">Gas Fee</th>
                <th className="text-right p-2 font-medium cursor-pointer" onClick={() => {
                  if (sortBy === 'profit_loss') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
                  else { setSortBy('profit_loss'); setSortOrder('desc') }
                }}>
                  P&L <ArrowUpDown className="w-4 h-4 inline ml-1" />
                </th>
                <th className="text-right p-2 font-medium cursor-pointer" onClick={() => {
                  if (sortBy === 'timestamp') setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
                  else { setSortBy('timestamp'); setSortOrder('desc') }
                }}>
                  Fecha <ArrowUpDown className="w-4 h-4 inline ml-1" />
                </th>
                <th className="text-center p-2 font-medium">Acción</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedTransactions.map((tx) => (
                <tr key={tx.id} className="border-b hover:bg-gray-50">
                  <td className="p-2">
                    <div>
                      <p className="font-mono text-sm font-medium">
                        {tx.hash.substring(0, 8)}...{tx.hash.substring(tx.hash.length - 6)}
                      </p>
                      <div className="flex items-center gap-1 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {tx.network}
                        </Badge>
                        {tx.block_number && (
                          <span className="text-xs text-gray-500">#{tx.block_number}</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-2">
                    <Badge variant="outline" className={`text-xs ${getTypeBadge(tx.type)}`}>
                      {tx.type}
                    </Badge>
                  </td>
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(tx.status)}
                      <Badge variant="outline" className={`text-xs ${getStatusBadge(tx.status)}`}>
                        {tx.status}
                      </Badge>
                    </div>
                  </td>
                  <td className="p-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{tx.from_token}</span>
                      <ArrowUpRight className="w-3 h-3 text-gray-400" />
                      <span className="font-medium">{tx.to_token}</span>
                    </div>
                  </td>
                  <td className="p-2 text-right">
                    <div className="text-sm">
                      <p className="font-medium">{tx.from_amount.toFixed(6)} {tx.from_token}</p>
                      <p className="text-gray-500">{tx.to_amount.toFixed(6)} {tx.to_token}</p>
                    </div>
                  </td>
                  <td className="p-2 text-right">
                    <p className="text-sm font-medium">${tx.gas_fee.toFixed(4)}</p>
                  </td>
                  <td className="p-2 text-right">
                    <span className={`font-medium ${tx.profit_loss >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {tx.profit_loss >= 0 ? '+' : ''}${tx.profit_loss.toFixed(4)}
                    </span>
                  </td>
                  <td className="p-2 text-right">
                    <div className="text-sm">
                      <p className="font-medium">{new Date(tx.timestamp).toLocaleDateString()}</p>
                      <p className="text-gray-500">{new Date(tx.timestamp).toLocaleTimeString()}</p>
                    </div>
                  </td>
                  <td className="p-2 text-center">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredAndSortedTransactions.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              {transactions.length === 0 ? 'No hay transacciones registradas' : 'No se encontraron transacciones'}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Componente principal de la página de Transacciones
export function RealTimeTransactionsPage() {
  const { transactions, stats, loading, error, lastUpdate, refetch } = useTransactionsData()

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Transacciones</h1>
            <p className="text-gray-600">Historial completo de operaciones de arbitraje</p>
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

        {/* Estadísticas de Transacciones */}
        <TransactionStatsCards stats={stats} loading={loading} />

        {/* Tabla de Transacciones */}
        <TransactionsTable transactions={transactions} />
      </div>
    </div>
  )
}
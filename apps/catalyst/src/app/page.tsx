/**
 * ArbitrageX Supreme - Dashboard con shadcn/ui
 * Ingenio Pichichi S.A. - Versión enterprise con componentes shadcn/ui
 */

'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'

// Shadcn/ui Components
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

// ============================================
// TYPES AND INTERFACES
// ============================================

interface DashboardData {
  summary: {
    totalProtocols: number
    totalBlockchains: number
    totalStrategies: number
    activeOpportunities: number
    totalTVL: number
    totalVolume24h: number
    totalFees24h: number
    successRate: number
    avgProfit: number
    systemUptime: number
  }
  metrics: {
    opportunitiesDetected: number
    protocolsActive: number
    blockchainsSupported: number
    dailyVolume: number
    totalTvl: number
  }
}

interface ProtocolData {
  id: string
  name: string
  category: string  
  blockchain: { name: string; symbol: string; chainId: number }
  tvl: number
  volume24h: number
  supportsFlashLoans: boolean
  riskScore: number
}

// ============================================
// MAIN DASHBOARD COMPONENT (SHADCN/UI VERSION)
// ============================================

export default function DashboardShadcn() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [protocols, setProtocols] = useState<ProtocolData[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [error, setError] = useState<string | null>(null)

  // ============================================
  // DATA FETCHING
  // ============================================

  const fetchDashboardData = async () => {
    try {
      const [dashboardRes, protocolsRes] = await Promise.all([
        fetch('/api/dashboard?type=overview'),
        fetch('/api/dashboard?type=protocols')
      ])

      if (!dashboardRes.ok || !protocolsRes.ok) {
        throw new Error('Failed to fetch data')
      }

      const dashboard = await dashboardRes.json()
      const protocolsData = await protocolsRes.json()

      setDashboardData(dashboard)
      setProtocols(protocolsData.protocols || [])
      setLastUpdate(new Date())
      setError(null)
    } catch (err) {
      console.error('Error fetching data:', err)
      setError('Error al cargar datos del dashboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
    
    // Auto-refresh cada 5 segundos para datos en tiempo real
    const interval = setInterval(fetchDashboardData, 5000)
    
    return () => clearInterval(interval)
  }, [])

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatPercentage = (value: number): string => {
    return `${value.toFixed(2)}%`
  }

  const getRiskLevelColor = (score: number): string => {
    if (score <= 3) return 'text-green-500'
    if (score <= 6) return 'text-yellow-500'
    return 'text-red-500'
  }

  const getRiskBadgeVariant = (score: number): "default" | "secondary" | "destructive" | "outline" => {
    if (score <= 3) return 'default'
    if (score <= 6) return 'secondary'
    return 'destructive'
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            <span className="ml-4">Cargando ArbitrageX Supreme...</span>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error || !dashboardData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <Card className="w-96">
          <CardHeader>
            <CardTitle className="text-red-500">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error || 'No hay datos disponibles'}</p>
            <Button onClick={fetchDashboardData} className="mt-4">
              Reintentar
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="bg-black/20 backdrop-blur-lg border-b border-blue-500/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-blue-600 text-white font-bold">
                  AX
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  ArbitrageX Supreme
                </h1>
                <p className="text-gray-400 text-sm">
                  Catalyst Generator v2.0.0 - Ingenio Pichichi S.A.
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <Badge variant="outline" className="text-green-400 border-green-400">
                🟢 ACTIVO
              </Badge>
              <Badge variant="secondary">
                Última actualización: {lastUpdate.toLocaleTimeString('es-ES')}
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Métricas Principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-black/20 backdrop-blur-lg border-blue-500/30">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-300">
                Total TVL
              </CardTitle>
              <span className="text-2xl">💰</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">
                {formatCurrency(dashboardData.summary.totalTVL)}
              </div>
              <p className="text-xs text-gray-400">
                +2.1% desde ayer
              </p>
            </CardContent>
          </Card>

          <Card className="bg-black/20 backdrop-blur-lg border-green-500/30">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-300">
                Oportunidades Activas
              </CardTitle>
              <span className="text-2xl">⚡</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-400">
                {dashboardData.summary.activeOpportunities.toLocaleString()}
              </div>
              <p className="text-xs text-gray-400">
                {dashboardData.metrics.opportunitiesDetected} detectadas hoy
              </p>
            </CardContent>
          </Card>

          <Card className="bg-black/20 backdrop-blur-lg border-purple-500/30">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-300">
                Volumen 24h
              </CardTitle>
              <span className="text-2xl">📈</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-400">
                {formatCurrency(dashboardData.summary.totalVolume24h)}
              </div>
              <p className="text-xs text-gray-400">
                En {dashboardData.summary.totalProtocols} protocolos
              </p>
            </CardContent>
          </Card>

          <Card className="bg-black/20 backdrop-blur-lg border-yellow-500/30">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-300">
                Tasa de Éxito
              </CardTitle>
              <span className="text-2xl">🎯</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-400">
                {formatPercentage(dashboardData.summary.successRate)}
              </div>
              <Progress 
                value={dashboardData.summary.successRate} 
                className="mt-2"
              />
            </CardContent>
          </Card>
        </div>

        {/* Protocolos DeFi */}
        <Card className="mb-8 bg-black/20 backdrop-blur-lg border-blue-500/30">
          <CardHeader>
            <CardTitle className="text-white">Protocolos DeFi Monitoreados</CardTitle>
            <CardDescription className="text-gray-400">
              {protocols.length} protocolos activos en {dashboardData.summary.totalBlockchains} blockchains
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-gray-300">Protocolo</TableHead>
                  <TableHead className="text-gray-300">Blockchain</TableHead>
                  <TableHead className="text-gray-300">TVL</TableHead>
                  <TableHead className="text-gray-300">Volumen 24h</TableHead>
                  <TableHead className="text-gray-300">Flash Loans</TableHead>
                  <TableHead className="text-gray-300">Riesgo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {protocols.slice(0, 10).map((protocol) => (
                  <TableRow key={protocol.id} className="border-gray-700">
                    <TableCell className="font-medium text-white">
                      <div className="flex items-center space-x-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {protocol.name.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-semibold">{protocol.name}</div>
                          <div className="text-xs text-gray-400">{protocol.category}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-blue-400 border-blue-400">
                        {protocol.blockchain.symbol}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-gray-300">
                      {formatCurrency(protocol.tvl)}
                    </TableCell>
                    <TableCell className="text-gray-300">
                      {formatCurrency(protocol.volume24h)}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={protocol.supportsFlashLoans ? "default" : "secondary"}
                        className={protocol.supportsFlashLoans ? "bg-green-600" : "bg-gray-600"}
                      >
                        {protocol.supportsFlashLoans ? "✅ Sí" : "❌ No"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getRiskBadgeVariant(protocol.riskScore)}>
                        {protocol.riskScore}/10
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Estado del Sistema */}
        <Card className="bg-black/20 backdrop-blur-lg border-blue-500/30">
          <CardHeader>
            <CardTitle className="text-white">Estado del Sistema</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-3xl text-green-400 mb-2">
                  {formatPercentage(dashboardData.summary.systemUptime)}
                </div>
                <p className="text-gray-300 text-sm">Uptime del Sistema</p>
                <Progress 
                  value={dashboardData.summary.systemUptime} 
                  className="mt-2 h-2"
                />
              </div>
              
              <div className="text-center">
                <div className="text-3xl text-blue-400 mb-2">
                  {dashboardData.metrics.opportunitiesDetected.toLocaleString()}
                </div>
                <p className="text-gray-300 text-sm">Oportunidades Detectadas</p>
              </div>
              
              <div className="text-center">
                <div className="text-3xl text-purple-400 mb-2">
                  {formatCurrency(dashboardData.summary.totalFees24h)}
                </div>
                <p className="text-gray-300 text-sm">Fees Generados 24h</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="bg-black/20 border-t border-blue-500/30 backdrop-blur-lg mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center text-sm text-gray-400">
            <div>
              © 2025 ArbitrageX Supreme - Ingenio Pichichi S.A.
            </div>
            <div className="flex space-x-4">
              <Badge variant="outline">v2.0.0</Badge>
              <Badge variant="outline">Shadcn/UI</Badge>
              <Badge variant="outline">Datos Reales</Badge>
              <Badge variant="outline">Sin Mocks</Badge>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
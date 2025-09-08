/**
 * ArbitrageX Supreme - Main Dashboard
 * Ingenio Pichichi S.A. - Dashboard principal enterprise sin mocks
 */

'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'

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
// MAIN DASHBOARD COMPONENT
// ============================================

export default function ArbitrageXDashboard() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [protocolsData, setProtocolsData] = useState<ProtocolData[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [error, setError] = useState<string | null>(null)

  // ========================================
  // DATA FETCHING - Datos reales desde API
  // ========================================

  const fetchDashboardData = async () => {
    try {
      const [dashboardRes, protocolsRes] = await Promise.all([
        fetch('/api/dashboard?endpoint=overview'),
        fetch('/api/dashboard?endpoint=protocols')
      ])

      if (!dashboardRes.ok || !protocolsRes.ok) {
        throw new Error('Failed to fetch data')
      }

      const dashboardResult = await dashboardRes.json()
      const protocolsResult = await protocolsRes.json()

      if (dashboardResult.success) {
        setDashboardData(dashboardResult.data)
      }

      if (protocolsResult.success) {
        setProtocolsData(protocolsResult.data.protocols)
      }

      setLastUpdate(new Date())
      setError(null)
    } catch (err) {
      console.error('❌ Error fetching dashboard data:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  // Auto-refresh cada 30 segundos
  useEffect(() => {
    fetchDashboardData()
    
    const interval = setInterval(() => {
      fetchDashboardData()
    }, 30000) // 30 segundos

    return () => clearInterval(interval)
  }, [])

  // ========================================
  // UTILITY FUNCTIONS
  // ========================================

  const formatCurrency = (value: number) => {
    if (value >= 1e9) {
      return `$${(value / 1e9).toFixed(2)}B`
    } else if (value >= 1e6) {
      return `$${(value / 1e6).toFixed(2)}M`
    } else if (value >= 1e3) {
      return `$${(value / 1e3).toFixed(2)}K`
    } else {
      return `$${value.toFixed(2)}`
    }
  }

  const formatPercentage = (value: number) => `${value.toFixed(2)}%`

  const getProtocolCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'dex_amm':
        return '🔄'
      case 'lending':
        return '🏦'
      case 'bridge':
        return '🌉'
      case 'derivatives':
        return '📊'
      default:
        return '🔗'
    }
  }

  const getRiskLevelColor = (riskScore: number) => {
    if (riskScore <= 3) return 'text-green-600'
    if (riskScore <= 6) return 'text-yellow-600'
    return 'text-red-600'
  }

  // ========================================
  // LOADING AND ERROR STATES
  // ========================================

  if (loading && !dashboardData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-400 mb-4"></div>
          <h2 className="text-2xl font-bold text-white mb-2">ArbitrageX Supreme</h2>
          <p className="text-gray-300">Cargando datos reales del sistema...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-900 to-purple-900 flex items-center justify-center">
        <div className="bg-red-900/30 border border-red-600 rounded-lg p-8 max-w-md">
          <h2 className="text-xl font-bold text-red-400 mb-4">❌ Error del Sistema</h2>
          <p className="text-gray-300 mb-4">{error}</p>
          <button 
            onClick={() => {
              setError(null)
              setLoading(true)
              fetchDashboardData()
            }}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  if (!dashboardData) {
    return <div>No data available</div>
  }

  // ========================================
  // MAIN RENDER
  // ========================================

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
      {/* Header */}
      <header className="bg-black/20 border-b border-blue-500/30 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-2xl font-bold text-white">A</span>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-white">ArbitrageX Supreme</h1>
                <p className="text-gray-300">Ingenio Pichichi S.A. - Sistema Enterprise</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4 text-sm text-gray-300">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span>Sistema Activo</span>
              </div>
              <div>
                Última actualización: {lastUpdate.toLocaleTimeString()}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-black/20 backdrop-blur-lg border border-blue-500/30 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-300 text-sm">TVL Total</p>
                <p className="text-2xl font-bold text-white">
                  {formatCurrency(dashboardData.summary.totalTVL)}
                </p>
              </div>
              <div className="text-3xl">💰</div>
            </div>
            <p className="text-green-400 text-sm mt-2">
              +{dashboardData.summary.totalProtocols} protocolos activos
            </p>
          </div>

          <div className="bg-black/20 backdrop-blur-lg border border-blue-500/30 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-300 text-sm">Volumen 24h</p>
                <p className="text-2xl font-bold text-white">
                  {formatCurrency(dashboardData.summary.totalVolume24h)}
                </p>
              </div>
              <div className="text-3xl">📊</div>
            </div>
            <p className="text-blue-400 text-sm mt-2">
              {dashboardData.summary.totalBlockchains} blockchains
            </p>
          </div>

          <div className="bg-black/20 backdrop-blur-lg border border-blue-500/30 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-300 text-sm">Oportunidades</p>
                <p className="text-2xl font-bold text-white">
                  {dashboardData.summary.activeOpportunities}
                </p>
              </div>
              <div className="text-3xl">🎯</div>
            </div>
            <p className="text-green-400 text-sm mt-2">
              {formatPercentage(dashboardData.summary.successRate)} éxito
            </p>
          </div>

          <div className="bg-black/20 backdrop-blur-lg border border-blue-500/30 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-300 text-sm">Profit Promedio</p>
                <p className="text-2xl font-bold text-white">
                  ${dashboardData.summary.avgProfit.toFixed(2)}
                </p>
              </div>
              <div className="text-3xl">⚡</div>
            </div>
            <p className="text-purple-400 text-sm mt-2">
              {dashboardData.summary.totalStrategies} estrategias
            </p>
          </div>
        </div>

        {/* Protocols Table */}
        <div className="bg-black/20 backdrop-blur-lg border border-blue-500/30 rounded-lg overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-blue-500/30">
            <h3 className="text-xl font-semibold text-white">Protocolos DeFi Activos</h3>
            <p className="text-gray-300 text-sm">Datos reales sin mocks - Actualización cada 30s</p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-blue-900/20">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Protocolo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Categoría
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Blockchain
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    TVL
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Volumen 24h
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Flash Loans
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Riesgo
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-500/20">
                {protocolsData.map((protocol) => (
                  <tr key={protocol.id} className="hover:bg-blue-900/10">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="text-2xl mr-3">
                          {getProtocolCategoryIcon(protocol.category)}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-white">
                            {protocol.name}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-900/30 text-blue-300">
                        {protocol.category.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      <div className="flex items-center">
                        <span className="mr-2">{protocol.blockchain.symbol}</span>
                        <span>{protocol.blockchain.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                      {formatCurrency(protocol.tvl)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                      {formatCurrency(protocol.volume24h)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {protocol.supportsFlashLoans ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-900/30 text-green-300">
                          ✅ Sí
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-900/30 text-gray-400">
                          ❌ No
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm font-medium ${getRiskLevelColor(protocol.riskScore)}`}>
                        {protocol.riskScore}/10
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* System Status */}
        <div className="bg-black/20 backdrop-blur-lg border border-blue-500/30 rounded-lg p-6">
          <h3 className="text-xl font-semibold text-white mb-4">Estado del Sistema</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl text-green-400 mb-2">
                {formatPercentage(dashboardData.summary.systemUptime)}
              </div>
              <p className="text-gray-300 text-sm">Uptime del Sistema</p>
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
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-black/20 border-t border-blue-500/30 backdrop-blur-lg mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center text-sm text-gray-400">
            <div>
              © 2025 ArbitrageX Supreme - Ingenio Pichichi S.A.
            </div>
            <div className="flex space-x-4">
              <span>v2.0.0</span>
              <span>•</span>
              <span>Datos Reales</span>
              <span>•</span>
              <span>Sin Mocks</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
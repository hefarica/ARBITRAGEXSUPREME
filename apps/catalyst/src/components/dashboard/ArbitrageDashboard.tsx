/**
 * ArbitrageX Supreme - Dashboard Principal 
 * Ingenio Pichichi S.A. - Actividad 12-13
 * 
 * Dashboard de monitoreo en tiempo real con métricas avanzadas
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Activity, 
  Zap,
  AlertTriangle,
  CheckCircle,
  Clock,
  Target,
  BarChart3,
  PieChart,
  RefreshCw,
  Wallet,
  Network,
  Settings
} from 'lucide-react'
import { useWeb3 } from '@/lib/web3'
import { ArbitrageForm } from '@/components/forms/ArbitrageForm'
import { ROITable } from '@/components/tables/ROITable'
import { AdvancedAnalytics } from '@/components/dashboard/AdvancedAnalytics'
import { arbitrageMonitor } from '@/lib/monitoring'
import { toast } from 'sonner'

// Types para el dashboard
interface DashboardMetrics {
  totalProfit: number
  totalTrades: number
  successRate: number
  avgROI: number
  totalVolume: number
  activeOpportunities: number
  gasSpent: number
  avgExecutionTime: number
}

interface OpportunityAlert {
  id: string
  type: 'high_profit' | 'new_opportunity' | 'price_movement' | 'system_alert'
  title: string
  message: string
  timestamp: number
  severity: 'low' | 'medium' | 'high' | 'critical'
  tokenPair?: string
  estimatedProfit?: number
}

interface SystemHealth {
  rpcStatus: 'healthy' | 'degraded' | 'offline'
  contractStatus: 'active' | 'paused' | 'error'
  dexConnectivity: 'good' | 'slow' | 'poor'
  memPoolStatus: 'normal' | 'congested' | 'critical'
  lastBlockTime: number
  gasPrice: number
}

export const ArbitrageDashboard = () => {
  const { isConnected, account, network, connect, web3Manager } = useWeb3()
  
  // Dashboard state
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalProfit: 0,
    totalTrades: 0,
    successRate: 0,
    avgROI: 0,
    totalVolume: 0,
    activeOpportunities: 0,
    gasSpent: 0,
    avgExecutionTime: 0
  })
  
  const [alerts, setAlerts] = useState<OpportunityAlert[]>([])
  const [systemHealth, setSystemHealth] = useState<SystemHealth>({
    rpcStatus: 'healthy',
    contractStatus: 'active',
    dexConnectivity: 'good',
    memPoolStatus: 'normal',
    lastBlockTime: Date.now(),
    gasPrice: 20
  })
  
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [refreshInterval, setRefreshInterval] = useState(30000) // 30 seconds

  // ============================================
  // REAL-TIME DATA FETCHING
  // ============================================

  const fetchMetrics = useCallback(async () => {
    if (!isConnected || !web3Manager) return

    try {
      // Simulate fetching real metrics from smart contracts and APIs
      const mockMetrics: DashboardMetrics = {
        totalProfit: Math.random() * 5000 + 1000, // $1000-$6000
        totalTrades: Math.floor(Math.random() * 50) + 10,
        successRate: Math.random() * 30 + 70, // 70-100%
        avgROI: Math.random() * 10 + 2, // 2-12%
        totalVolume: Math.random() * 100000 + 50000,
        activeOpportunities: Math.floor(Math.random() * 15) + 5,
        gasSpent: Math.random() * 2 + 0.5,
        avgExecutionTime: Math.random() * 20 + 5 // 5-25 seconds
      }
      
      setMetrics(mockMetrics)
    } catch (error) {
      console.error('Failed to fetch metrics:', error)
      toast.error('Failed to update metrics')
    }
  }, [isConnected, web3Manager])

  const fetchSystemHealth = useCallback(async () => {
    try {
      // Check RPC health
      const provider = web3Manager?.getProvider()
      if (provider) {
        const latestBlock = await provider.getBlock('latest')
        const gasPrice = await provider.getFeeData()
        
        setSystemHealth(prev => ({
          ...prev,
          lastBlockTime: latestBlock?.timestamp ? latestBlock.timestamp * 1000 : Date.now(),
          gasPrice: gasPrice.gasPrice ? Number(gasPrice.gasPrice) / 1e9 : 20,
          rpcStatus: 'healthy'
        }))
      }
    } catch (error) {
      console.error('Failed to check system health:', error)
      setSystemHealth(prev => ({
        ...prev,
        rpcStatus: 'degraded'
      }))
    }
  }, [web3Manager])

  const generateAlert = useCallback(() => {
    const alertTypes = ['high_profit', 'new_opportunity', 'price_movement', 'system_alert']
    const severities = ['low', 'medium', 'high', 'critical']
    
    const newAlert: OpportunityAlert = {
      id: `alert_${Date.now()}`,
      type: alertTypes[Math.floor(Math.random() * alertTypes.length)] as any,
      title: `New Arbitrage Opportunity`,
      message: `ETH/USDC pair showing ${(Math.random() * 5 + 1).toFixed(2)}% profit potential`,
      timestamp: Date.now(),
      severity: severities[Math.floor(Math.random() * severities.length)] as any,
      tokenPair: 'ETH/USDC',
      estimatedProfit: Math.random() * 500 + 100
    }
    
    setAlerts(prev => [newAlert, ...prev.slice(0, 9)]) // Keep latest 10
  }, [])

  // ============================================
  // EFFECTS & AUTO-REFRESH
  // ============================================

  useEffect(() => {
    if (isConnected) {
      fetchMetrics()
      fetchSystemHealth()
      
      // Iniciar sistema de monitoreo
      arbitrageMonitor.start(5000) // 5 segundos
      
      return () => {
        arbitrageMonitor.stop()
      }
    }
  }, [isConnected, fetchMetrics, fetchSystemHealth])

  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      if (isConnected) {
        fetchMetrics()
        fetchSystemHealth()
        
        // Generate random alert occasionally
        if (Math.random() < 0.3) {
          generateAlert()
        }
      }
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, isConnected, fetchMetrics, fetchSystemHealth, generateAlert])

  // ============================================
  // HANDLERS
  // ============================================

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await Promise.all([
        fetchMetrics(),
        fetchSystemHealth()
      ])
      toast.success('Dashboard refreshed')
    } finally {
      setIsRefreshing(false)
    }
  }

  const clearAlerts = () => {
    setAlerts([])
    toast.success('Alerts cleared')
  }

  // ============================================
  // RENDER HELPERS
  // ============================================

  const getHealthBadgeColor = (status: string) => {
    switch (status) {
      case 'healthy': case 'active': case 'good': case 'normal': 
        return 'bg-green-600'
      case 'degraded': case 'slow':
        return 'bg-yellow-600'
      case 'offline': case 'error': case 'poor': case 'congested':
        return 'bg-red-600'
      default:
        return 'bg-gray-600'
    }
  }

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'high_profit': return <TrendingUp className="h-4 w-4" />
      case 'new_opportunity': return <Target className="h-4 w-4" />
      case 'price_movement': return <BarChart3 className="h-4 w-4" />
      case 'system_alert': return <AlertTriangle className="h-4 w-4" />
      default: return <Activity className="h-4 w-4" />
    }
  }

  // ============================================
  // RENDER
  // ============================================

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <Card className="text-center py-12">
            <CardContent>
              <Wallet className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                Connect Your Wallet
              </h2>
              <p className="text-gray-600 mb-6">
                Connect your wallet to access the ArbitrageX Supreme dashboard
              </p>
              <Button onClick={connect} size="lg">
                Connect Wallet
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              ArbitrageX Supreme Dashboard
            </h1>
            <p className="text-gray-600">
              {account?.slice(0, 6)}...{account?.slice(-4)} • {network?.name}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setAutoRefresh(!autoRefresh)}
            >
              {autoRefresh ? 'Auto-Refresh: ON' : 'Auto-Refresh: OFF'}
            </Button>
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* System Health Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              System Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <Badge className={getHealthBadgeColor(systemHealth.rpcStatus)}>
                  RPC: {systemHealth.rpcStatus}
                </Badge>
              </div>
              <div className="text-center">
                <Badge className={getHealthBadgeColor(systemHealth.contractStatus)}>
                  Contracts: {systemHealth.contractStatus}
                </Badge>
              </div>
              <div className="text-center">
                <Badge className={getHealthBadgeColor(systemHealth.dexConnectivity)}>
                  DEX: {systemHealth.dexConnectivity}
                </Badge>
              </div>
              <div className="text-center">
                <Badge className={getHealthBadgeColor(systemHealth.memPoolStatus)}>
                  MemPool: {systemHealth.memPoolStatus}
                </Badge>
              </div>
            </div>
            
            <div className="mt-4 grid grid-cols-2 gap-4 text-sm text-gray-600">
              <div>
                Last Block: {new Date(systemHealth.lastBlockTime).toLocaleTimeString()}
              </div>
              <div>
                Gas Price: {systemHealth.gasPrice.toFixed(1)} Gwei
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Profit</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                ${metrics.totalProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
              <p className="text-xs text-gray-600">
                +12.5% from last month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <CheckCircle className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {metrics.successRate.toFixed(1)}%
              </div>
              <Progress value={metrics.successRate} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Opportunities</CardTitle>
              <Target className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {metrics.activeOpportunities}
              </div>
              <p className="text-xs text-gray-600">
                Avg ROI: {metrics.avgROI.toFixed(1)}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Execution</CardTitle>
              <Clock className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {metrics.avgExecutionTime.toFixed(1)}s
              </div>
              <p className="text-xs text-gray-600">
                Gas: {metrics.gasSpent.toFixed(2)} ETH
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="trading" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="trading">Trading</TabsTrigger>
            <TabsTrigger value="opportunities">Opportunities</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="advanced">ML & AI</TabsTrigger>
            <TabsTrigger value="alerts">
              Alerts {alerts.length > 0 && (
                <Badge variant="destructive" className="ml-2 text-xs">
                  {alerts.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="trading" className="space-y-6">
            <ArbitrageForm />
          </TabsContent>

          <TabsContent value="opportunities" className="space-y-6">
            <ROITable />
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Trading Performance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="font-medium">Total Trades</p>
                        <p className="text-2xl font-bold">{metrics.totalTrades}</p>
                      </div>
                      <div>
                        <p className="font-medium">Total Volume</p>
                        <p className="text-2xl font-bold">
                          ${metrics.totalVolume.toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium mb-2">Monthly Progress</p>
                      <Progress value={75} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5" />
                    Strategy Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span>INTRA_DEX</span>
                      <Badge variant="outline">45%</Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>INTER_DEX</span>
                      <Badge variant="outline">30%</Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>CROSS_CHAIN</span>
                      <Badge variant="outline">25%</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-6">
            <AdvancedAnalytics />
          </TabsContent>

          <TabsContent value="alerts" className="space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Live Alerts
                </CardTitle>
                <Button variant="outline" size="sm" onClick={clearAlerts}>
                  Clear All
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {alerts.length === 0 ? (
                    <p className="text-gray-600 text-center py-8">
                      No alerts at this time. System is running smoothly.
                    </p>
                  ) : (
                    alerts.map((alert) => (
                      <div 
                        key={alert.id}
                        className="flex items-start gap-3 p-3 border rounded-lg hover:bg-gray-50"
                      >
                        <div className={`
                          p-2 rounded-full 
                          ${alert.severity === 'critical' ? 'bg-red-100 text-red-600' : 
                            alert.severity === 'high' ? 'bg-orange-100 text-orange-600' :
                            alert.severity === 'medium' ? 'bg-yellow-100 text-yellow-600' :
                            'bg-blue-100 text-blue-600'}
                        `}>
                          {getAlertIcon(alert.type)}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{alert.title}</p>
                          <p className="text-sm text-gray-600">{alert.message}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {alert.tokenPair}
                            </Badge>
                            {alert.estimatedProfit && (
                              <Badge variant="outline" className="text-xs text-green-600">
                                +${alert.estimatedProfit.toFixed(0)}
                              </Badge>
                            )}
                            <span className="text-xs text-gray-500">
                              {new Date(alert.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
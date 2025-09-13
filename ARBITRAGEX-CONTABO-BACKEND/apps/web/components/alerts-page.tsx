'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import {
  Bell,
  Plus,
  AlertTriangle,
  CheckCircle,
  Info,
  X,
  RefreshCw,
  Search,
  Filter,
  Settings,
  Volume2,
  VolumeX,
  Clock,
  TrendingUp,
  TrendingDown,
  Activity,
  DollarSign,
  Zap,
  Target
} from 'lucide-react'

// Interfaces TypeScript para Alertas
interface Alert {
  id: string
  title: string
  message: string
  type: 'price' | 'volume' | 'arbitrage' | 'network' | 'wallet' | 'system'
  severity: 'low' | 'medium' | 'high' | 'critical'
  status: 'active' | 'acknowledged' | 'resolved' | 'dismissed'
  triggered_at: string
  resolved_at?: string
  conditions: {
    parameter: string
    operator: string
    value: number
    current_value?: number
  }
  network?: string
  pair?: string
  source: string
  actions_taken?: string[]
}

interface AlertRule {
  id: string
  name: string
  description: string
  type: Alert['type']
  conditions: Alert['conditions']
  enabled: boolean
  notification_channels: ('email' | 'sms' | 'webhook' | 'browser')[]
  created_at: string
  last_triggered?: string
  trigger_count: number
}

interface AlertStats {
  total_alerts: number
  active_alerts: number
  critical_alerts: number
  resolved_today: number
  total_rules: number
  active_rules: number
  average_response_time: number
  success_rate: number
}

// Hook para datos de alertas
function useAlertsData() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [rules, setRules] = useState<AlertRule[]>([])
  const [stats, setStats] = useState<AlertStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  const fetchAlertsData = async () => {
    try {
      setError(null)
      
      // Obtener estadísticas de alertas
      const statsResponse = await fetch('/api/proxy/api/v2/alerts/stats')
      if (!statsResponse.ok) throw new Error('Error al cargar estadísticas de alertas')
      const statsData = await statsResponse.json()
      setStats(statsData.data || statsData)

      // Obtener alertas activas
      const alertsResponse = await fetch('/api/proxy/api/v2/alerts/active')
      if (!alertsResponse.ok) throw new Error('Error al cargar alertas activas')
      const alertsData = await alertsResponse.json()
      setAlerts(alertsData.data || alertsData.alerts || [])

      // Obtener reglas de alerta
      const rulesResponse = await fetch('/api/proxy/api/v2/alerts/rules')
      if (!rulesResponse.ok) throw new Error('Error al cargar reglas de alerta')
      const rulesData = await rulesResponse.json()
      setRules(rulesData.data || rulesData.rules || [])

      setLastUpdate(new Date())
    } catch (err) {
      console.error('Error fetching alerts data:', err)
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAlertsData()
    
    // Auto-refresh cada 10 segundos para alertas
    const interval = setInterval(fetchAlertsData, 10000)
    return () => clearInterval(interval)
  }, [])

  return { alerts, rules, stats, loading, error, lastUpdate, refetch: fetchAlertsData }
}

// Componente de estadísticas de alertas
function AlertStatsCards({ stats, loading }: { stats: AlertStats | null, loading: boolean }) {
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
      {/* Alertas Activas */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Alertas Activas</p>
              <p className="text-3xl font-bold">{stats.active_alerts}</p>
              <p className={`text-sm ${stats.critical_alerts > 0 ? 'text-red-600' : 'text-gray-500'}`}>
                {stats.critical_alerts} críticas
              </p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <Bell className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Total Alertas */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Alertas</p>
              <p className="text-3xl font-bold">{stats.total_alerts}</p>
              <p className="text-sm text-emerald-600">
                {stats.resolved_today} resueltas hoy
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Activity className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reglas Activas */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Reglas Activas</p>
              <p className="text-3xl font-bold">{stats.active_rules}</p>
              <p className="text-sm text-gray-500">
                de {stats.total_rules} totales
              </p>
            </div>
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
              <Target className="w-6 h-6 text-emerald-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tiempo de Respuesta */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Tiempo Respuesta</p>
              <p className="text-3xl font-bold">{stats.average_response_time}s</p>
              <p className="text-sm text-emerald-600">
                Éxito: {stats.success_rate.toFixed(1)}%
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <Zap className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Componente de lista de alertas
function AlertsList({ alerts }: { alerts: Alert[] }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  const filteredAlerts = alerts.filter(alert => {
    const matchesSearch = alert.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         alert.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         alert.source.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesSeverity = severityFilter === 'all' || alert.severity === severityFilter
    const matchesType = typeFilter === 'all' || alert.type === typeFilter
    return matchesSearch && matchesSeverity && matchesType
  })

  const getSeverityColor = (severity: Alert['severity']) => {
    switch (severity) {
      case 'low': return 'bg-blue-100 text-blue-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'high': return 'bg-orange-100 text-orange-800'
      case 'critical': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getSeverityIcon = (severity: Alert['severity']) => {
    switch (severity) {
      case 'low': return <Info className="w-4 h-4" />
      case 'medium': return <AlertTriangle className="w-4 h-4" />
      case 'high': return <AlertTriangle className="w-4 h-4" />
      case 'critical': return <X className="w-4 h-4" />
      default: return <Info className="w-4 h-4" />
    }
  }

  const getTypeColor = (type: Alert['type']) => {
    switch (type) {
      case 'price': return 'bg-emerald-100 text-emerald-800'
      case 'volume': return 'bg-blue-100 text-blue-800'
      case 'arbitrage': return 'bg-purple-100 text-purple-800'
      case 'network': return 'bg-orange-100 text-orange-800'
      case 'wallet': return 'bg-cyan-100 text-cyan-800'
      case 'system': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const handleAcknowledge = async (alertId: string) => {
    try {
      await fetch(`/api/proxy/api/v2/alerts/${alertId}/acknowledge`, { method: 'POST' })
      // Refresh data
      window.location.reload()
    } catch (err) {
      console.error('Error acknowledging alert:', err)
    }
  }

  const handleResolve = async (alertId: string) => {
    try {
      await fetch(`/api/proxy/api/v2/alerts/${alertId}/resolve`, { method: 'POST' })
      // Refresh data
      window.location.reload()
    } catch (err) {
      console.error('Error resolving alert:', err)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle>Alertas Activas</CardTitle>
            <CardDescription>Monitoreo y gestión de alertas del sistema</CardDescription>
          </div>
          <div className="flex gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
              <Input
                placeholder="Buscar alertas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Severidad" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="critical">Crítica</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="medium">Media</SelectItem>
                <SelectItem value="low">Baja</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="price">Precio</SelectItem>
                <SelectItem value="volume">Volumen</SelectItem>
                <SelectItem value="arbitrage">Arbitraje</SelectItem>
                <SelectItem value="network">Red</SelectItem>
                <SelectItem value="wallet">Billetera</SelectItem>
                <SelectItem value="system">Sistema</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {filteredAlerts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <CheckCircle className="w-12 h-12 mx-auto mb-2 text-emerald-300" />
              <p>{alerts.length === 0 ? 'No hay alertas activas' : 'No se encontraron alertas'}</p>
              <p className="text-sm">El sistema está funcionando normalmente</p>
            </div>
          ) : (
            filteredAlerts.map((alert) => (
              <div key={alert.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {getSeverityIcon(alert.severity)}
                      <h4 className="font-medium">{alert.title}</h4>
                      <Badge variant="outline" className={`text-xs ${getSeverityColor(alert.severity)}`}>
                        {alert.severity}
                      </Badge>
                      <Badge variant="outline" className={`text-xs ${getTypeColor(alert.type)}`}>
                        {alert.type}
                      </Badge>
                    </div>
                    <p className="text-gray-600 mb-2">{alert.message}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>Fuente: {alert.source}</span>
                      {alert.network && <span>Red: {alert.network}</span>}
                      {alert.pair && <span>Par: {alert.pair}</span>}
                      <span>
                        <Clock className="w-4 h-4 inline mr-1" />
                        {new Date(alert.triggered_at).toLocaleString()}
                      </span>
                    </div>
                    {alert.conditions.current_value && (
                      <div className="mt-2 text-sm">
                        <span className="text-gray-600">Condición: </span>
                        <span className="font-medium">
                          {alert.conditions.parameter} {alert.conditions.operator} {alert.conditions.value}
                        </span>
                        <span className="text-gray-600"> (Actual: </span>
                        <span className={`font-medium ${
                          alert.severity === 'critical' || alert.severity === 'high' ? 'text-red-600' : 'text-orange-600'
                        }`}>
                          {alert.conditions.current_value}
                        </span>
                        <span className="text-gray-600">)</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 ml-4">
                    {alert.status === 'active' && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAcknowledge(alert.id)}
                        >
                          Reconocer
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleResolve(alert.id)}
                        >
                          Resolver
                        </Button>
                      </>
                    )}
                  </div>
                </div>
                {alert.actions_taken && alert.actions_taken.length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-sm font-medium text-gray-600 mb-1">Acciones tomadas:</p>
                    <ul className="text-sm text-gray-600 space-y-1">
                      {alert.actions_taken.map((action, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <CheckCircle className="w-3 h-3 text-emerald-600" />
                          {action}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Componente de reglas de alerta
function AlertRules({ rules }: { rules: AlertRule[] }) {
  const toggleRule = async (ruleId: string, enabled: boolean) => {
    try {
      await fetch(`/api/proxy/api/v2/alerts/rules/${ruleId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      })
      // Refresh data
      window.location.reload()
    } catch (err) {
      console.error('Error toggling rule:', err)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Reglas de Alerta</CardTitle>
            <CardDescription>Configuración de condiciones de monitoreo</CardDescription>
          </div>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Nueva Regla
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {rules.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Settings className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>No hay reglas de alerta configuradas</p>
            </div>
          ) : (
            rules.map((rule) => (
              <div key={rule.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-medium">{rule.name}</h4>
                      <Switch
                        checked={rule.enabled}
                        onCheckedChange={(checked) => toggleRule(rule.id, checked)}
                      />
                      <Badge variant="outline" className="text-xs">
                        {rule.type}
                      </Badge>
                    </div>
                    <p className="text-gray-600 mb-2">{rule.description}</p>
                    <div className="text-sm text-gray-500">
                      <p>
                        Condición: {rule.conditions.parameter} {rule.conditions.operator} {rule.conditions.value}
                      </p>
                      <p>
                        Canales: {rule.notification_channels.join(', ')}
                      </p>
                      <p>
                        Activaciones: {rule.trigger_count} veces
                        {rule.last_triggered && (
                          <span> | Última: {new Date(rule.last_triggered).toLocaleDateString()}</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    Editar
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Componente principal de la página de Alertas
export function RealTimeAlertsPage() {
  const { alerts, rules, stats, loading, error, lastUpdate, refetch } = useAlertsData()

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Alertas</h1>
            <p className="text-gray-600">Sistema de monitoreo y notificaciones</p>
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

        {/* Estadísticas de Alertas */}
        <AlertStatsCards stats={stats} loading={loading} />

        {/* Contenido Principal con Tabs */}
        <Tabs defaultValue="alerts" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="alerts">Alertas Activas</TabsTrigger>
            <TabsTrigger value="rules">Reglas de Alerta</TabsTrigger>
          </TabsList>

          <TabsContent value="alerts" className="space-y-6">
            <AlertsList alerts={alerts} />
          </TabsContent>

          <TabsContent value="rules" className="space-y-6">
            <AlertRules rules={rules} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
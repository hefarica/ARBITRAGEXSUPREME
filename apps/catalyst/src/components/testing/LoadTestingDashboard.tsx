'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { 
  Zap, 
  Play, 
  Pause, 
  Stop,
  Settings,
  Activity,
  TrendingUp,
  TrendingDown,
  Clock,
  Users,
  Database,
  Server,
  Network,
  Eye,
  Download,
  Upload,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  BarChart3,
  LineChart,
  PieChart,
  Target,
  Gauge,
  Timer,
  Cpu,
  MemoryStick,
  HardDrive,
  Wifi,
  Globe,
  Code,
  FileText,
  Calendar,
  Filter,
  Search
} from 'lucide-react'

// Tipos específicos del dashboard
interface LoadTestConfig {
  id: string
  name: string
  description: string
  type: 'load' | 'stress' | 'spike' | 'volume' | 'endurance' | 'capacity'
  target: {
    baseUrl: string
    endpoints: EndpointConfig[]
  }
  scenarios: TestScenario[]
  maxUsers: number
  duration: number
  rampUpTime: number
  rampDownTime: number
  thresholds: PerformanceThresholds
  status: 'draft' | 'ready' | 'running' | 'completed' | 'failed'
  createdAt: Date
  lastRun?: Date
  tags: string[]
}

interface EndpointConfig {
  id: string
  path: string
  method: string
  weight: number
  expectedStatus: number[]
}

interface TestScenario {
  id: string
  name: string
  description: string
  userCount: number
  steps: TestStep[]
  weight: number
}

interface TestStep {
  id: string
  name: string
  type: 'request' | 'think_time' | 'validation'
  config: any
}

interface PerformanceThresholds {
  responseTime: { warning: number; critical: number }
  errorRate: { warning: number; critical: number }
  throughput: { warning: number; critical: number }
}

interface LoadTestExecution {
  id: string
  configId: string
  status: 'initializing' | 'running' | 'ramping_down' | 'completed' | 'failed' | 'cancelled'
  startTime: Date
  endTime?: Date
  duration: number
  progress: number
  currentUsers: number
  targetUsers: number
  metrics: ExecutionMetrics
  errors: TestError[]
  warnings: TestWarning[]
  logs: LogEntry[]
}

interface ExecutionMetrics {
  requests: {
    total: number
    successful: number
    failed: number
    rate: number
  }
  performance: {
    avgResponseTime: number
    p50ResponseTime: number
    p95ResponseTime: number
    p99ResponseTime: number
    minResponseTime: number
    maxResponseTime: number
  }
  throughput: {
    requestsPerSecond: number
    bytesPerSecond: number
    peakThroughput: number
  }
  errors: {
    total: number
    rate: number
    byStatus: Record<string, number>
    byEndpoint: Record<string, number>
  }
  resources: {
    cpu: number
    memory: number
    network: number
    connections: number
  }
}

interface TestError {
  id: string
  timestamp: Date
  type: string
  message: string
  endpoint?: string
  statusCode?: number
  severity: 'low' | 'medium' | 'high' | 'critical'
}

interface TestWarning {
  id: string
  timestamp: Date
  type: string
  message: string
  threshold?: string
  value?: number
  impact: 'low' | 'medium' | 'high'
}

interface LogEntry {
  timestamp: Date
  level: 'debug' | 'info' | 'warn' | 'error'
  message: string
  component: string
  data?: any
}

// Componente principal del dashboard
export function LoadTestingDashboard() {
  const [configurations, setConfigurations] = useState<LoadTestConfig[]>([])
  const [executions, setExecutions] = useState<LoadTestExecution[]>([])
  const [selectedConfig, setSelectedConfig] = useState<LoadTestConfig | null>(null)
  const [selectedExecution, setSelectedExecution] = useState<LoadTestExecution | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [filters, setFilters] = useState({
    type: 'all',
    status: 'all',
    search: ''
  })

  // Cargar datos iniciales
  useEffect(() => {
    loadConfigurations()
    loadExecutions()
  }, [])

  // Actualizar ejecuciones activas cada 5 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      const activeExecutions = executions.filter(e => 
        ['initializing', 'running', 'ramping_down'].includes(e.status)
      )
      if (activeExecutions.length > 0) {
        updateActiveExecutions()
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [executions])

  const loadConfigurations = async () => {
    setLoading(true)
    try {
      // Simular carga de configuraciones
      const mockConfigs: LoadTestConfig[] = [
        {
          id: '1',
          name: 'ArbitrageX API Load Test',
          description: 'Test de carga para endpoints críticos de trading',
          type: 'load',
          target: {
            baseUrl: 'https://api.arbitragex.com',
            endpoints: [
              { id: '1', path: '/api/v1/trades', method: 'POST', weight: 40, expectedStatus: [200, 201] },
              { id: '2', path: '/api/v1/orders', method: 'GET', weight: 30, expectedStatus: [200] },
              { id: '3', path: '/api/v1/portfolio', method: 'GET', weight: 20, expectedStatus: [200] },
              { id: '4', path: '/api/v1/markets', method: 'GET', weight: 10, expectedStatus: [200] }
            ]
          },
          scenarios: [
            {
              id: '1',
              name: 'High Frequency Trading',
              description: 'Simulación de trading de alta frecuencia',
              userCount: 500,
              steps: [],
              weight: 60
            },
            {
              id: '2',
              name: 'Portfolio Monitoring',
              description: 'Usuarios monitoreando portafolios',
              userCount: 300,
              steps: [],
              weight: 40
            }
          ],
          maxUsers: 1000,
          duration: 600, // 10 minutos
          rampUpTime: 120, // 2 minutos
          rampDownTime: 60, // 1 minuto
          thresholds: {
            responseTime: { warning: 500, critical: 2000 },
            errorRate: { warning: 1, critical: 5 },
            throughput: { warning: 100, critical: 50 }
          },
          status: 'ready',
          createdAt: new Date(Date.now() - 86400000), // Ayer
          lastRun: new Date(Date.now() - 3600000), // Hace 1 hora
          tags: ['api', 'trading', 'critical']
        },
        {
          id: '2',
          name: 'Frontend Stress Test',
          description: 'Prueba de estrés para la aplicación web',
          type: 'stress',
          target: {
            baseUrl: 'https://app.arbitragex.com',
            endpoints: [
              { id: '1', path: '/', method: 'GET', weight: 50, expectedStatus: [200] },
              { id: '2', path: '/dashboard', method: 'GET', weight: 30, expectedStatus: [200] },
              { id: '3', path: '/trading', method: 'GET', weight: 20, expectedStatus: [200] }
            ]
          },
          scenarios: [
            {
              id: '1',
              name: 'Normal User Behavior',
              description: 'Navegación normal de usuarios',
              userCount: 800,
              steps: [],
              weight: 70
            },
            {
              id: '2',
              name: 'Power Users',
              description: 'Usuarios avanzados con uso intensivo',
              userCount: 200,
              steps: [],
              weight: 30
            }
          ],
          maxUsers: 2000,
          duration: 900, // 15 minutos
          rampUpTime: 180, // 3 minutos
          rampDownTime: 120, // 2 minutos
          thresholds: {
            responseTime: { warning: 1000, critical: 3000 },
            errorRate: { warning: 2, critical: 8 },
            throughput: { warning: 200, critical: 100 }
          },
          status: 'draft',
          createdAt: new Date(Date.now() - 172800000), // Hace 2 días
          tags: ['frontend', 'stress', 'user-experience']
        }
      ]
      setConfigurations(mockConfigs)
    } catch (error) {
      console.error('Error loading configurations:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadExecutions = async () => {
    try {
      // Simular carga de ejecuciones
      const mockExecutions: LoadTestExecution[] = [
        {
          id: '1',
          configId: '1',
          status: 'completed',
          startTime: new Date(Date.now() - 3600000),
          endTime: new Date(Date.now() - 3000000),
          duration: 600000,
          progress: 100,
          currentUsers: 0,
          targetUsers: 1000,
          metrics: {
            requests: {
              total: 45678,
              successful: 45234,
              failed: 444,
              rate: 76.13
            },
            performance: {
              avgResponseTime: 245,
              p50ResponseTime: 180,
              p95ResponseTime: 650,
              p99ResponseTime: 1200,
              minResponseTime: 45,
              maxResponseTime: 2800
            },
            throughput: {
              requestsPerSecond: 76.13,
              bytesPerSecond: 2456789,
              peakThroughput: 95.4
            },
            errors: {
              total: 444,
              rate: 0.97,
              byStatus: { '500': 234, '503': 156, '504': 54 },
              byEndpoint: { '/api/v1/trades': 278, '/api/v1/orders': 166 }
            },
            resources: {
              cpu: 67.5,
              memory: 78.2,
              network: 45.6,
              connections: 892
            }
          },
          errors: [
            {
              id: '1',
              timestamp: new Date(Date.now() - 3300000),
              type: 'timeout',
              message: 'Request timeout after 30 seconds',
              endpoint: '/api/v1/trades',
              statusCode: 504,
              severity: 'medium'
            }
          ],
          warnings: [
            {
              id: '1',
              timestamp: new Date(Date.now() - 3400000),
              type: 'threshold',
              message: 'Response time exceeded warning threshold',
              threshold: 'responseTime.warning',
              value: 650,
              impact: 'medium'
            }
          ],
          logs: []
        },
        {
          id: '2',
          configId: '1',
          status: 'running',
          startTime: new Date(Date.now() - 300000), // Hace 5 minutos
          duration: 300000,
          progress: 50,
          currentUsers: 650,
          targetUsers: 1000,
          metrics: {
            requests: {
              total: 12345,
              successful: 12289,
              failed: 56,
              rate: 68.5
            },
            performance: {
              avgResponseTime: 189,
              p50ResponseTime: 165,
              p95ResponseTime: 456,
              p99ResponseTime: 890,
              minResponseTime: 52,
              maxResponseTime: 1456
            },
            throughput: {
              requestsPerSecond: 68.5,
              bytesPerSecond: 1876543,
              peakThroughput: 82.3
            },
            errors: {
              total: 56,
              rate: 0.45,
              byStatus: { '500': 34, '503': 22 },
              byEndpoint: { '/api/v1/trades': 34, '/api/v1/orders': 22 }
            },
            resources: {
              cpu: 45.2,
              memory: 56.8,
              network: 34.5,
              connections: 650
            }
          },
          errors: [],
          warnings: [],
          logs: []
        }
      ]
      setExecutions(mockExecutions)
    } catch (error) {
      console.error('Error loading executions:', error)
    }
  }

  const updateActiveExecutions = async () => {
    // Simular actualización de ejecuciones activas
    setExecutions(prev => prev.map(execution => {
      if (execution.status === 'running') {
        const elapsed = Date.now() - execution.startTime.getTime()
        const totalDuration = configurations.find(c => c.id === execution.configId)?.duration || 600
        const progress = Math.min((elapsed / 1000) / totalDuration * 100, 100)
        
        return {
          ...execution,
          duration: elapsed,
          progress,
          // Simular actualización de métricas
          metrics: {
            ...execution.metrics,
            requests: {
              ...execution.metrics.requests,
              total: execution.metrics.requests.total + Math.floor(Math.random() * 100),
              rate: 65 + Math.random() * 20
            }
          }
        }
      }
      return execution
    }))
  }

  const createConfiguration = useCallback(async (config: Partial<LoadTestConfig>) => {
    const newConfig: LoadTestConfig = {
      id: Date.now().toString(),
      name: config.name || 'Nueva Configuración',
      description: config.description || '',
      type: config.type || 'load',
      target: config.target || { baseUrl: '', endpoints: [] },
      scenarios: config.scenarios || [],
      maxUsers: config.maxUsers || 100,
      duration: config.duration || 300,
      rampUpTime: config.rampUpTime || 60,
      rampDownTime: config.rampDownTime || 60,
      thresholds: config.thresholds || {
        responseTime: { warning: 1000, critical: 3000 },
        errorRate: { warning: 5, critical: 10 },
        throughput: { warning: 100, critical: 50 }
      },
      status: 'draft',
      createdAt: new Date(),
      tags: config.tags || []
    }

    setConfigurations(prev => [...prev, newConfig])
    return newConfig
  }, [])

  const runTest = useCallback(async (configId: string) => {
    const config = configurations.find(c => c.id === configId)
    if (!config) return

    const execution: LoadTestExecution = {
      id: Date.now().toString(),
      configId,
      status: 'initializing',
      startTime: new Date(),
      duration: 0,
      progress: 0,
      currentUsers: 0,
      targetUsers: config.maxUsers,
      metrics: {
        requests: { total: 0, successful: 0, failed: 0, rate: 0 },
        performance: {
          avgResponseTime: 0, p50ResponseTime: 0, p95ResponseTime: 0, 
          p99ResponseTime: 0, minResponseTime: 0, maxResponseTime: 0
        },
        throughput: { requestsPerSecond: 0, bytesPerSecond: 0, peakThroughput: 0 },
        errors: { total: 0, rate: 0, byStatus: {}, byEndpoint: {} },
        resources: { cpu: 0, memory: 0, network: 0, connections: 0 }
      },
      errors: [],
      warnings: [],
      logs: []
    }

    setExecutions(prev => [...prev, execution])

    // Simular inicio del test después de 2 segundos
    setTimeout(() => {
      setExecutions(prev => prev.map(e => 
        e.id === execution.id ? { ...e, status: 'running' } : e
      ))
    }, 2000)

    return execution.id
  }, [configurations])

  const stopTest = useCallback(async (executionId: string) => {
    setExecutions(prev => prev.map(execution => 
      execution.id === executionId 
        ? { 
            ...execution, 
            status: 'cancelled',
            endTime: new Date(),
            progress: execution.progress
          }
        : execution
    ))
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'text-gray-600 bg-gray-50'
      case 'ready': return 'text-blue-600 bg-blue-50'
      case 'initializing': return 'text-yellow-600 bg-yellow-50'
      case 'running': return 'text-green-600 bg-green-50'
      case 'ramping_down': return 'text-orange-600 bg-orange-50'
      case 'completed': return 'text-green-600 bg-green-50'
      case 'failed': return 'text-red-600 bg-red-50'
      case 'cancelled': return 'text-gray-600 bg-gray-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'load': return 'text-blue-600 bg-blue-50'
      case 'stress': return 'text-red-600 bg-red-50'
      case 'spike': return 'text-orange-600 bg-orange-50'
      case 'volume': return 'text-purple-600 bg-purple-50'
      case 'endurance': return 'text-green-600 bg-green-50'
      case 'capacity': return 'text-indigo-600 bg-indigo-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50'
      case 'high': return 'text-orange-600 bg-orange-50'
      case 'medium': return 'text-yellow-600 bg-yellow-50'
      case 'low': return 'text-blue-600 bg-blue-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const filteredConfigurations = configurations.filter(config => {
    const matchesType = filters.type === 'all' || config.type === filters.type
    const matchesStatus = filters.status === 'all' || config.status === filters.status
    const matchesSearch = filters.search === '' || 
      config.name.toLowerCase().includes(filters.search.toLowerCase()) ||
      config.description.toLowerCase().includes(filters.search.toLowerCase()) ||
      config.tags.some(tag => tag.toLowerCase().includes(filters.search.toLowerCase()))
    
    return matchesType && matchesStatus && matchesSearch
  })

  const activeExecutions = executions.filter(e => 
    ['initializing', 'running', 'ramping_down'].includes(e.status)
  )

  const recentExecutions = executions
    .filter(e => e.status === 'completed')
    .sort((a, b) => (b.endTime?.getTime() || 0) - (a.endTime?.getTime() || 0))
    .slice(0, 5)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Load Testing Dashboard</h2>
          <p className="text-gray-600">Gestión integral de pruebas de carga y rendimiento</p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={() => loadConfigurations()} variant="outline" disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Button onClick={() => setIsCreating(true)} className="bg-blue-600 hover:bg-blue-700">
            <Zap className="w-4 h-4 mr-2" />
            Nueva Prueba
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="configurations">Configuraciones</TabsTrigger>
          <TabsTrigger value="executions">Ejecuciones</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
          <TabsTrigger value="results">Resultados</TabsTrigger>
          <TabsTrigger value="reports">Reportes</TabsTrigger>
        </TabsList>

        {/* Dashboard Principal */}
        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Tests Activos</p>
                    <p className="text-2xl font-bold text-green-600">{activeExecutions.length}</p>
                  </div>
                  <Activity className="w-8 h-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Configuraciones</p>
                    <p className="text-2xl font-bold">{configurations.length}</p>
                  </div>
                  <Settings className="w-8 h-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Usuarios Virtuales</p>
                    <p className="text-2xl font-bold text-orange-600">
                      {activeExecutions.reduce((sum, e) => sum + e.currentUsers, 0)}
                    </p>
                  </div>
                  <Users className="w-8 h-8 text-orange-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">RPS Actual</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {Math.round(activeExecutions.reduce((sum, e) => sum + e.metrics.throughput.requestsPerSecond, 0))}
                    </p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tests Activos */}
          <Card>
            <CardHeader>
              <CardTitle>Tests Activos</CardTitle>
              <CardDescription>Pruebas de carga ejecutándose actualmente</CardDescription>
            </CardHeader>
            <CardContent>
              {activeExecutions.length > 0 ? (
                <div className="space-y-4">
                  {activeExecutions.map(execution => {
                    const config = configurations.find(c => c.id === execution.configId)
                    return (
                      <div key={execution.id} className="p-4 border rounded-lg">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="font-medium">{config?.name}</h4>
                            <div className="flex items-center space-x-2 mt-1">
                              <Badge variant="outline" className={getStatusColor(execution.status)}>
                                {execution.status}
                              </Badge>
                              <Badge variant="outline" className={getTypeColor(config?.type || 'load')}>
                                {config?.type}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            <Button size="sm" variant="outline">
                              <Eye className="w-4 h-4 mr-1" />
                              Monitorear
                            </Button>
                            <Button 
                              size="sm" 
                              variant="destructive"
                              onClick={() => stopTest(execution.id)}
                            >
                              <Stop className="w-4 h-4 mr-1" />
                              Detener
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                          <div className="text-center p-2 bg-blue-50 rounded">
                            <p className="text-xs text-blue-600">Usuarios Activos</p>
                            <p className="font-bold text-blue-800">{execution.currentUsers}</p>
                          </div>
                          <div className="text-center p-2 bg-green-50 rounded">
                            <p className="text-xs text-green-600">RPS</p>
                            <p className="font-bold text-green-800">
                              {Math.round(execution.metrics.throughput.requestsPerSecond)}
                            </p>
                          </div>
                          <div className="text-center p-2 bg-yellow-50 rounded">
                            <p className="text-xs text-yellow-600">Tiempo Resp. (ms)</p>
                            <p className="font-bold text-yellow-800">
                              {Math.round(execution.metrics.performance.avgResponseTime)}
                            </p>
                          </div>
                          <div className="text-center p-2 bg-red-50 rounded">
                            <p className="text-xs text-red-600">Error Rate %</p>
                            <p className="font-bold text-red-800">
                              {execution.metrics.errors.rate.toFixed(2)}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Progreso del test</span>
                            <span>{Math.round(execution.progress)}%</span>
                          </div>
                          <Progress value={execution.progress} className="w-full" />
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>
                              Iniciado: {execution.startTime.toLocaleTimeString()}
                            </span>
                            <span>
                              Duración: {Math.round(execution.duration / 1000 / 60)}m
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Activity className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-600">No hay tests activos</p>
                  <p className="text-sm text-gray-500">Inicia una nueva prueba para comenzar el monitoreo</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Últimos Resultados */}
          <Card>
            <CardHeader>
              <CardTitle>Últimos Resultados</CardTitle>
              <CardDescription>Resultados de las pruebas más recientes</CardDescription>
            </CardHeader>
            <CardContent>
              {recentExecutions.length > 0 ? (
                <div className="space-y-3">
                  {recentExecutions.map(execution => {
                    const config = configurations.find(c => c.id === execution.configId)
                    return (
                      <div key={execution.id} className="flex items-center justify-between p-3 border rounded">
                        <div>
                          <h5 className="font-medium">{config?.name}</h5>
                          <div className="flex items-center space-x-4 text-sm text-gray-600">
                            <span>
                              {execution.endTime?.toLocaleDateString()} {execution.endTime?.toLocaleTimeString()}
                            </span>
                            <span>
                              {Math.round(execution.duration / 1000 / 60)}m {Math.round((execution.duration / 1000) % 60)}s
                            </span>
                            <span>{execution.targetUsers} usuarios</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <div className="text-right text-sm">
                            <p className="text-gray-600">
                              {Math.round(execution.metrics.performance.avgResponseTime)}ms avg
                            </p>
                            <p className="text-gray-600">
                              {execution.metrics.errors.rate.toFixed(2)}% errors
                            </p>
                          </div>
                          <Badge variant="outline" className={getStatusColor(execution.status)}>
                            {execution.status}
                          </Badge>
                          <Button size="sm" variant="outline">
                            <FileText className="w-4 h-4 mr-1" />
                            Reporte
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-8">
                  <BarChart3 className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-600">No hay resultados disponibles</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Configuraciones */}
        <TabsContent value="configurations" className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Search className="w-4 h-4 text-gray-500" />
                <Input
                  placeholder="Buscar configuraciones..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="w-64"
                />
              </div>
              <Select value={filters.type} onValueChange={(value) => setFilters(prev => ({ ...prev, type: value }))}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tipos</SelectItem>
                  <SelectItem value="load">Load</SelectItem>
                  <SelectItem value="stress">Stress</SelectItem>
                  <SelectItem value="spike">Spike</SelectItem>
                  <SelectItem value="volume">Volume</SelectItem>
                  <SelectItem value="endurance">Endurance</SelectItem>
                  <SelectItem value="capacity">Capacity</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filters.status} onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="ready">Ready</SelectItem>
                  <SelectItem value="running">Running</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="text-sm text-gray-600">
              {filteredConfigurations.length} configuraciones
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredConfigurations.map(config => (
              <Card key={config.id} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold mb-1">{config.name}</h3>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className={getTypeColor(config.type)}>
                          {config.type}
                        </Badge>
                        <Badge variant="outline" className={getStatusColor(config.status)}>
                          {config.status}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <p className="text-sm text-gray-600 mb-3">{config.description}</p>

                  <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                    <div>
                      <span className="text-gray-600">Max usuarios:</span>
                      <p className="font-medium">{config.maxUsers}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Duración:</span>
                      <p className="font-medium">{Math.round(config.duration / 60)}m</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Endpoints:</span>
                      <p className="font-medium">{config.target.endpoints.length}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Escenarios:</span>
                      <p className="font-medium">{config.scenarios.length}</p>
                    </div>
                  </div>

                  {config.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {config.tags.map(tag => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-3 border-t">
                    <div className="text-xs text-gray-500">
                      {config.lastRun ? (
                        <span>Última ejecución: {config.lastRun.toLocaleDateString()}</span>
                      ) : (
                        <span>Nunca ejecutado</span>
                      )}
                    </div>
                    <div className="flex space-x-1">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setSelectedConfig(config)}
                      >
                        <Settings className="w-4 h-4" />
                      </Button>
                      <Button 
                        size="sm"
                        onClick={() => runTest(config.id)}
                        disabled={config.status !== 'ready'}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Play className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Ejecuciones */}
        <TabsContent value="executions" className="space-y-4">
          <div className="space-y-4">
            {executions.map(execution => {
              const config = configurations.find(c => c.id === execution.configId)
              return (
                <Card key={execution.id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-semibold">{config?.name}</h3>
                        <div className="flex items-center space-x-2 mt-1">
                          <Badge variant="outline" className={getStatusColor(execution.status)}>
                            {execution.status}
                          </Badge>
                          <Badge variant="outline" className={getTypeColor(config?.type || 'load')}>
                            {config?.type}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right text-sm text-gray-600">
                        <p>ID: {execution.id}</p>
                        <p>{execution.startTime.toLocaleString()}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="text-center p-3 bg-blue-50 rounded-lg">
                        <Users className="w-5 h-5 mx-auto text-blue-600 mb-1" />
                        <p className="text-sm text-blue-600">Usuarios</p>
                        <p className="font-bold text-blue-800">{execution.currentUsers}/{execution.targetUsers}</p>
                      </div>
                      <div className="text-center p-3 bg-green-50 rounded-lg">
                        <TrendingUp className="w-5 h-5 mx-auto text-green-600 mb-1" />
                        <p className="text-sm text-green-600">RPS</p>
                        <p className="font-bold text-green-800">
                          {Math.round(execution.metrics.throughput.requestsPerSecond)}
                        </p>
                      </div>
                      <div className="text-center p-3 bg-yellow-50 rounded-lg">
                        <Clock className="w-5 h-5 mx-auto text-yellow-600 mb-1" />
                        <p className="text-sm text-yellow-600">Resp. Time</p>
                        <p className="font-bold text-yellow-800">
                          {Math.round(execution.metrics.performance.avgResponseTime)}ms
                        </p>
                      </div>
                      <div className="text-center p-3 bg-red-50 rounded-lg">
                        <AlertTriangle className="w-5 h-5 mx-auto text-red-600 mb-1" />
                        <p className="text-sm text-red-600">Errores</p>
                        <p className="font-bold text-red-800">
                          {execution.metrics.errors.rate.toFixed(2)}%
                        </p>
                      </div>
                    </div>

                    {execution.status === 'running' && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Progreso</span>
                          <span>{Math.round(execution.progress)}%</span>
                        </div>
                        <Progress value={execution.progress} className="w-full" />
                      </div>
                    )}

                    <div className="flex justify-between items-center mt-4 pt-4 border-t">
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <span>Requests: {execution.metrics.requests.total.toLocaleString()}</span>
                        <span>Errores: {execution.metrics.errors.total}</span>
                        <span>Duración: {Math.round(execution.duration / 1000 / 60)}m</span>
                      </div>
                      <div className="flex space-x-2">
                        {execution.status === 'running' && (
                          <Button size="sm" variant="destructive" onClick={() => stopTest(execution.id)}>
                            <Stop className="w-4 h-4 mr-1" />
                            Detener
                          </Button>
                        )}
                        <Button size="sm" variant="outline">
                          <Eye className="w-4 h-4 mr-1" />
                          Ver Detalles
                        </Button>
                        <Button size="sm" variant="outline">
                          <Download className="w-4 h-4 mr-1" />
                          Reporte
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        {/* Monitoring */}
        <TabsContent value="monitoring" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Métricas en Tiempo Real</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
                  <div className="text-center">
                    <LineChart className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-500">Gráfico de métricas en tiempo real</p>
                    <p className="text-sm text-gray-400">RPS, Response Time, Error Rate</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recursos del Sistema</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Cpu className="w-4 h-4 text-blue-600" />
                      <span className="text-sm">CPU</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Progress value={45.2} className="w-24" />
                      <span className="text-sm font-medium">45.2%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <MemoryStick className="w-4 h-4 text-green-600" />
                      <span className="text-sm">Memoria</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Progress value={67.8} className="w-24" />
                      <span className="text-sm font-medium">67.8%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Network className="w-4 h-4 text-purple-600" />
                      <span className="text-sm">Red</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Progress value={34.5} className="w-24" />
                      <span className="text-sm font-medium">34.5%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <HardDrive className="w-4 h-4 text-orange-600" />
                      <span className="text-sm">Disco</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Progress value={12.3} className="w-24" />
                      <span className="text-sm font-medium">12.3%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Resultados */}
        <TabsContent value="results" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Análisis de Resultados</CardTitle>
              <CardDescription>
                Análisis detallado de los resultados de las pruebas de carga
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-96 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
                <div className="text-center">
                  <BarChart3 className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                  <p className="text-lg text-gray-500 mb-2">Análisis de Resultados</p>
                  <p className="text-gray-400">Gráficos comparativos, tendencias y análisis de performance</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reportes */}
        <TabsContent value="reports" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="p-4 text-center">
                <FileText className="w-12 h-12 mx-auto text-blue-600 mb-4" />
                <h3 className="font-semibold mb-2">Reporte Ejecutivo</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Resumen de alto nivel para stakeholders
                </p>
                <Button className="w-full">
                  <Download className="w-4 h-4 mr-2" />
                  Generar
                </Button>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="p-4 text-center">
                <BarChart3 className="w-12 h-12 mx-auto text-green-600 mb-4" />
                <h3 className="font-semibold mb-2">Análisis Técnico</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Análisis detallado de métricas y performance
                </p>
                <Button className="w-full">
                  <Download className="w-4 h-4 mr-2" />
                  Generar
                </Button>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="p-4 text-center">
                <TrendingUp className="w-12 h-12 mx-auto text-purple-600 mb-4" />
                <h3 className="font-semibold mb-2">Tendencias</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Análisis de tendencias históricas
                </p>
                <Button className="w-full">
                  <Download className="w-4 h-4 mr-2" />
                  Generar
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal de Creación de Configuración */}
      {isCreating && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Crear Nueva Configuración</CardTitle>
              <CardDescription>
                Configure los parámetros para una nueva prueba de carga
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="testName">Nombre de la Prueba</Label>
                  <Input id="testName" placeholder="Ej: API Load Test" />
                </div>
                <div>
                  <Label htmlFor="testType">Tipo de Prueba</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="load">Load Test</SelectItem>
                      <SelectItem value="stress">Stress Test</SelectItem>
                      <SelectItem value="spike">Spike Test</SelectItem>
                      <SelectItem value="volume">Volume Test</SelectItem>
                      <SelectItem value="endurance">Endurance Test</SelectItem>
                      <SelectItem value="capacity">Capacity Test</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="baseUrl">URL Base</Label>
                <Input id="baseUrl" placeholder="https://api.arbitragex.com" />
              </div>

              <div>
                <Label htmlFor="description">Descripción</Label>
                <Textarea 
                  id="description"
                  placeholder="Descripción de la prueba de carga..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="maxUsers">Usuarios Máximos</Label>
                  <Input id="maxUsers" type="number" placeholder="1000" />
                </div>
                <div>
                  <Label htmlFor="duration">Duración (min)</Label>
                  <Input id="duration" type="number" placeholder="10" />
                </div>
                <div>
                  <Label htmlFor="rampUpTime">Ramp Up (min)</Label>
                  <Input id="rampUpTime" type="number" placeholder="2" />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={() => setIsCreating(false)}>
                  Cancelar
                </Button>
                <Button onClick={() => {
                  // Crear configuración con los valores del formulario
                  setIsCreating(false)
                }}>
                  Crear Configuración
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

export default LoadTestingDashboard
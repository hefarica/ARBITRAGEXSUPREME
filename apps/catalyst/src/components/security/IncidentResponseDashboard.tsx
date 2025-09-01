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
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock,
  Users,
  Phone,
  MessageSquare,
  FileText,
  Activity,
  TrendingUp,
  Eye,
  RefreshCw,
  Filter,
  Search,
  Play,
  Pause,
  Stop,
  Settings,
  Download,
  Upload,
  Zap,
  Bug,
  Lock,
  Unlock,
  Database,
  Server,
  Globe,
  Wifi,
  HardDrive,
  Network
} from 'lucide-react'

// Tipos para el sistema de respuesta a incidentes
interface SecurityIncident {
  id: string
  title: string
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  status: 'new' | 'assigned' | 'investigating' | 'containing' | 'eradicating' | 'recovering' | 'resolved' | 'closed'
  category: 'malware' | 'phishing' | 'data_breach' | 'dos' | 'unauthorized_access' | 'insider_threat' | 'system_compromise' | 'social_engineering'
  source: 'automated' | 'user_report' | 'monitoring' | 'third_party' | 'audit'
  affectedAssets: Asset[]
  assignedTo: string[]
  reportedBy: string
  createdAt: Date
  updatedAt: Date
  resolvedAt?: Date
  timeline: TimelineEvent[]
  artifacts: Artifact[]
  communication: Communication[]
  containment: ContainmentAction[]
  impact: ImpactAssessment
  playbook?: string
  tags: string[]
}

interface Asset {
  id: string
  name: string
  type: 'server' | 'database' | 'application' | 'network' | 'endpoint' | 'cloud_service'
  criticality: 'low' | 'medium' | 'high' | 'critical'
  location: string
  owner: string
  status: 'healthy' | 'compromised' | 'isolated' | 'offline'
}

interface TimelineEvent {
  id: string
  timestamp: Date
  event: string
  description: string
  actor: string
  category: 'detection' | 'analysis' | 'containment' | 'communication' | 'recovery' | 'lesson_learned'
  evidence?: string[]
}

interface Artifact {
  id: string
  name: string
  type: 'log' | 'screenshot' | 'file' | 'network_capture' | 'memory_dump' | 'forensic_image'
  path: string
  hash: string
  size: number
  collectedAt: Date
  collectedBy: string
  chainOfCustody: ChainOfCustodyEntry[]
}

interface ChainOfCustodyEntry {
  id: string
  timestamp: Date
  action: 'collected' | 'transferred' | 'analyzed' | 'stored'
  actor: string
  location: string
  notes: string
}

interface Communication {
  id: string
  timestamp: Date
  type: 'internal' | 'external' | 'customer' | 'regulatory' | 'media'
  recipient: string
  sender: string
  subject: string
  content: string
  status: 'draft' | 'sent' | 'delivered' | 'read'
}

interface ContainmentAction {
  id: string
  timestamp: Date
  action: string
  asset: string
  executedBy: string
  result: 'success' | 'failed' | 'partial'
  notes: string
  rollbackPlan?: string
}

interface ImpactAssessment {
  confidentiality: 'none' | 'low' | 'medium' | 'high'
  integrity: 'none' | 'low' | 'medium' | 'high'
  availability: 'none' | 'low' | 'medium' | 'high'
  financialImpact: number
  affectedUsers: number
  dataRecordsAffected: number
  systemsAffected: number
  downtime: number // en minutos
  complianceImpact: string[]
}

interface IncidentPlaybook {
  id: string
  name: string
  category: SecurityIncident['category']
  steps: PlaybookStep[]
  estimatedTime: number
  requiredRoles: string[]
  triggerConditions: string[]
  escalationCriteria: string[]
}

interface PlaybookStep {
  id: string
  order: number
  title: string
  description: string
  owner: string
  estimatedTime: number
  dependencies: string[]
  actions: PlaybookAction[]
  completionCriteria: string[]
}

interface PlaybookAction {
  id: string
  type: 'manual' | 'automated' | 'communication' | 'analysis'
  description: string
  command?: string
  parameters?: Record<string, any>
  expectedResult: string
}

interface IncidentMetrics {
  totalIncidents: number
  openIncidents: number
  meanTimeToDetection: number // MTTD en minutos
  meanTimeToResponse: number // MTTR en minutos
  meanTimeToResolution: number // MTTR en minutos
  incidentsByCategory: Record<string, number>
  incidentsBySeverity: Record<string, number>
  trendsLastMonth: {
    incidents: number[]
    detectionTimes: number[]
    responseTimes: number[]
  }
}

// Componente principal del Incident Response Dashboard
export function IncidentResponseDashboard() {
  const [incidents, setIncidents] = useState<SecurityIncident[]>([])
  const [selectedIncident, setSelectedIncident] = useState<SecurityIncident | null>(null)
  const [playbooks, setPlaybooks] = useState<IncidentPlaybook[]>([])
  const [metrics, setMetrics] = useState<IncidentMetrics | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [filterSeverity, setFilterSeverity] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')

  // Cargar datos
  useEffect(() => {
    loadIncidents()
    loadPlaybooks()
    loadMetrics()
  }, [])

  const loadIncidents = async () => {
    setLoading(true)
    try {
      // Simular carga de incidentes
      const mockIncidents: SecurityIncident[] = [
        {
          id: '1',
          title: 'Suspicious API Access Pattern Detected',
          description: 'Unusual API access patterns detected from multiple IP addresses attempting to access trading endpoints',
          severity: 'high',
          status: 'investigating',
          category: 'unauthorized_access',
          source: 'automated',
          affectedAssets: [
            {
              id: '1',
              name: 'ArbitrageX API Gateway',
              type: 'application',
              criticality: 'critical',
              location: 'AWS us-east-1',
              owner: 'API Team',
              status: 'healthy'
            }
          ],
          assignedTo: ['Security Team', 'DevOps Team'],
          reportedBy: 'SIEM System',
          createdAt: new Date(Date.now() - 3600000),
          updatedAt: new Date(Date.now() - 1800000),
          timeline: [
            {
              id: '1',
              timestamp: new Date(Date.now() - 3600000),
              event: 'Incident Created',
              description: 'SIEM alert triggered for suspicious API access patterns',
              actor: 'SIEM System',
              category: 'detection'
            },
            {
              id: '2',
              timestamp: new Date(Date.now() - 3300000),
              event: 'Initial Analysis',
              description: 'Security analyst confirmed suspicious patterns from 15 unique IP addresses',
              actor: 'John Doe',
              category: 'analysis'
            }
          ],
          artifacts: [],
          communication: [],
          containment: [
            {
              id: '1',
              timestamp: new Date(Date.now() - 3000000),
              action: 'Rate limiting enabled for suspicious IPs',
              asset: 'API Gateway',
              executedBy: 'DevOps Team',
              result: 'success',
              notes: 'Applied temporary rate limiting rules'
            }
          ],
          impact: {
            confidentiality: 'low',
            integrity: 'none',
            availability: 'low',
            financialImpact: 0,
            affectedUsers: 0,
            dataRecordsAffected: 0,
            systemsAffected: 1,
            downtime: 0,
            complianceImpact: []
          },
          playbook: 'unauthorized_access_playbook',
          tags: ['api', 'brute_force', 'automated']
        },
        {
          id: '2',
          title: 'Potential Data Exfiltration Attempt',
          description: 'Large volume data download detected from privileged account outside business hours',
          severity: 'critical',
          status: 'containing',
          category: 'data_breach',
          source: 'monitoring',
          affectedAssets: [
            {
              id: '2',
              name: 'Trading Database',
              type: 'database',
              criticality: 'critical',
              location: 'AWS us-east-1',
              owner: 'Database Team',
              status: 'compromised'
            }
          ],
          assignedTo: ['CISO', 'Security Team', 'Legal Team'],
          reportedBy: 'DLP System',
          createdAt: new Date(Date.now() - 7200000),
          updatedAt: new Date(Date.now() - 600000),
          timeline: [],
          artifacts: [],
          communication: [],
          containment: [],
          impact: {
            confidentiality: 'high',
            integrity: 'medium',
            availability: 'none',
            financialImpact: 50000,
            affectedUsers: 1250,
            dataRecordsAffected: 15000,
            systemsAffected: 2,
            downtime: 0,
            complianceImpact: ['GDPR', 'SOX']
          },
          playbook: 'data_breach_playbook',
          tags: ['data_breach', 'insider_threat', 'critical']
        }
      ]
      setIncidents(mockIncidents)
    } catch (error) {
      console.error('Error loading incidents:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadPlaybooks = async () => {
    try {
      const mockPlaybooks: IncidentPlaybook[] = [
        {
          id: 'unauthorized_access_playbook',
          name: 'Unauthorized Access Response',
          category: 'unauthorized_access',
          steps: [
            {
              id: '1',
              order: 1,
              title: 'Initial Assessment',
              description: 'Assess the scope and impact of unauthorized access',
              owner: 'Security Analyst',
              estimatedTime: 30,
              dependencies: [],
              actions: [
                {
                  id: '1',
                  type: 'analysis',
                  description: 'Review access logs and identify affected systems',
                  expectedResult: 'Complete list of affected systems and access patterns'
                }
              ],
              completionCriteria: ['Scope documented', 'Impact assessed']
            }
          ],
          estimatedTime: 240,
          requiredRoles: ['Security Analyst', 'System Administrator'],
          triggerConditions: ['Suspicious login patterns', 'Failed authentication alerts'],
          escalationCriteria: ['Multiple systems affected', 'Critical data accessed']
        }
      ]
      setPlaybooks(mockPlaybooks)
    } catch (error) {
      console.error('Error loading playbooks:', error)
    }
  }

  const loadMetrics = async () => {
    try {
      const mockMetrics: IncidentMetrics = {
        totalIncidents: 127,
        openIncidents: 8,
        meanTimeToDetection: 45,
        meanTimeToResponse: 15,
        meanTimeToResolution: 480,
        incidentsByCategory: {
          'malware': 15,
          'phishing': 23,
          'data_breach': 8,
          'dos': 12,
          'unauthorized_access': 35,
          'insider_threat': 6,
          'system_compromise': 18,
          'social_engineering': 10
        },
        incidentsBySeverity: {
          'low': 45,
          'medium': 52,
          'high': 25,
          'critical': 5
        },
        trendsLastMonth: {
          incidents: [5, 8, 12, 6, 9, 15, 11, 7, 13, 9, 6, 8, 10, 14, 9, 11, 7, 12, 8, 15, 9, 6, 11, 13, 8, 10, 12, 7, 9, 14],
          detectionTimes: [30, 45, 25, 60, 35, 40, 50, 30, 45, 55, 40, 35, 45, 50, 30, 40, 55, 35, 45, 40, 50, 35, 40, 45, 30, 50, 40, 35, 45, 50],
          responseTimes: [10, 15, 8, 20, 12, 15, 18, 10, 15, 22, 15, 12, 15, 18, 10, 15, 20, 12, 15, 15, 18, 12, 15, 15, 10, 18, 15, 12, 15, 18]
        }
      }
      setMetrics(mockMetrics)
    } catch (error) {
      console.error('Error loading metrics:', error)
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200'
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200'
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200'
      default: return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'text-purple-600 bg-purple-50'
      case 'assigned': return 'text-blue-600 bg-blue-50'
      case 'investigating': return 'text-yellow-600 bg-yellow-50'
      case 'containing': return 'text-orange-600 bg-orange-50'
      case 'eradicating': return 'text-red-600 bg-red-50'
      case 'recovering': return 'text-indigo-600 bg-indigo-50'
      case 'resolved': return 'text-green-600 bg-green-50'
      case 'closed': return 'text-gray-600 bg-gray-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'malware': return <Bug className="w-4 h-4" />
      case 'phishing': return <MessageSquare className="w-4 h-4" />
      case 'data_breach': return <Database className="w-4 h-4" />
      case 'dos': return <Zap className="w-4 h-4" />
      case 'unauthorized_access': return <Lock className="w-4 h-4" />
      case 'insider_threat': return <Users className="w-4 h-4" />
      case 'system_compromise': return <Server className="w-4 h-4" />
      case 'social_engineering': return <Phone className="w-4 h-4" />
      default: return <Shield className="w-4 h-4" />
    }
  }

  const getAssetIcon = (type: string) => {
    switch (type) {
      case 'server': return <Server className="w-4 h-4" />
      case 'database': return <Database className="w-4 h-4" />
      case 'application': return <Globe className="w-4 h-4" />
      case 'network': return <Network className="w-4 h-4" />
      case 'endpoint': return <HardDrive className="w-4 h-4" />
      case 'cloud_service': return <Wifi className="w-4 h-4" />
      default: return <Shield className="w-4 h-4" />
    }
  }

  const filteredIncidents = incidents.filter(incident => {
    const matchesSearch = searchTerm === '' || 
      incident.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      incident.description.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesSeverity = filterSeverity === 'all' || incident.severity === filterSeverity
    const matchesStatus = filterStatus === 'all' || incident.status === filterStatus
    
    return matchesSearch && matchesSeverity && matchesStatus
  })

  const updateIncidentStatus = useCallback((incidentId: string, newStatus: SecurityIncident['status']) => {
    setIncidents(prev => prev.map(incident => 
      incident.id === incidentId 
        ? { ...incident, status: newStatus, updatedAt: new Date() }
        : incident
    ))
  }, [])

  const assignIncident = useCallback((incidentId: string, assignees: string[]) => {
    setIncidents(prev => prev.map(incident => 
      incident.id === incidentId 
        ? { ...incident, assignedTo: assignees, updatedAt: new Date() }
        : incident
    ))
  }, [])

  const escalateIncident = useCallback((incidentId: string) => {
    setIncidents(prev => prev.map(incident => 
      incident.id === incidentId 
        ? { 
            ...incident, 
            severity: incident.severity === 'low' ? 'medium' : 
                     incident.severity === 'medium' ? 'high' : 'critical',
            updatedAt: new Date()
          }
        : incident
    ))
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Incident Response Dashboard</h2>
          <p className="text-gray-600">Gestión centralizada de respuesta a incidentes de seguridad</p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={() => loadIncidents()} variant="outline" disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Button className="bg-red-600 hover:bg-red-700">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Nuevo Incidente
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="incidents">Incidentes</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="playbooks">Playbooks</TabsTrigger>
          <TabsTrigger value="communications">Comunicaciones</TabsTrigger>
          <TabsTrigger value="reports">Reportes</TabsTrigger>
        </TabsList>

        {/* Dashboard Principal */}
        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Incidentes Totales</p>
                    <p className="text-2xl font-bold">{metrics?.totalIncidents || 0}</p>
                  </div>
                  <Shield className="w-8 h-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Incidentes Abiertos</p>
                    <p className="text-2xl font-bold text-red-600">{metrics?.openIncidents || 0}</p>
                  </div>
                  <AlertTriangle className="w-8 h-8 text-red-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">MTTD (min)</p>
                    <p className="text-2xl font-bold text-yellow-600">{metrics?.meanTimeToDetection || 0}</p>
                  </div>
                  <Eye className="w-8 h-8 text-yellow-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">MTTR (min)</p>
                    <p className="text-2xl font-bold text-green-600">{metrics?.meanTimeToResponse || 0}</p>
                  </div>
                  <Activity className="w-8 h-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Incidentes Críticos Activos */}
          <Card>
            <CardHeader>
              <CardTitle>Incidentes Críticos Activos</CardTitle>
              <CardDescription>Incidentes que requieren atención inmediata</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {incidents.filter(i => i.severity === 'critical' && i.status !== 'closed').map(incident => (
                  <Alert key={incident.id} className="border-red-200 bg-red-50">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <AlertTitle className="text-red-800">
                      {incident.title}
                    </AlertTitle>
                    <AlertDescription className="text-red-700">
                      <div className="flex justify-between items-center mt-2">
                        <div className="flex items-center space-x-4 text-sm">
                          <Badge variant="outline" className={getSeverityColor(incident.severity)}>
                            {incident.severity}
                          </Badge>
                          <Badge variant="outline" className={getStatusColor(incident.status)}>
                            {incident.status}
                          </Badge>
                          <span>Reportado: {incident.createdAt.toLocaleTimeString()}</span>
                        </div>
                        <Button size="sm" onClick={() => setSelectedIncident(incident)}>
                          <Eye className="w-4 h-4 mr-1" />
                          Ver Detalles
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Gráficos de Métricas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Incidentes por Categoría</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {metrics && Object.entries(metrics.incidentsByCategory).map(([category, count]) => (
                    <div key={category} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {getCategoryIcon(category)}
                        <span className="text-sm capitalize">{category.replace('_', ' ')}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${(count / Math.max(...Object.values(metrics.incidentsByCategory))) * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium w-8">{count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Tendencias de Respuesta</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-48 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
                  <div className="text-center">
                    <TrendingUp className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-500">Gráfico de tendencias de respuesta</p>
                    <p className="text-sm text-gray-400">Tiempo de detección y respuesta</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Lista de Incidentes */}
        <TabsContent value="incidents" className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Search className="w-4 h-4 text-gray-500" />
                <Input
                  placeholder="Buscar incidentes..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-64"
                />
              </div>
              <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toda severidad</SelectItem>
                  <SelectItem value="critical">Crítica</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="medium">Media</SelectItem>
                  <SelectItem value="low">Baja</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="new">Nuevo</SelectItem>
                  <SelectItem value="investigating">Investigando</SelectItem>
                  <SelectItem value="containing">Conteniendo</SelectItem>
                  <SelectItem value="resolved">Resuelto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="text-sm text-gray-600">
              {filteredIncidents.length} incidentes encontrados
            </div>
          </div>

          <div className="space-y-4">
            {filteredIncidents.map(incident => (
              <Card key={incident.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        {getCategoryIcon(incident.category)}
                        <h3 className="font-semibold">{incident.title}</h3>
                        <Badge variant="outline" className={getSeverityColor(incident.severity)}>
                          {incident.severity}
                        </Badge>
                        <Badge variant="outline" className={getStatusColor(incident.status)}>
                          {incident.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{incident.description}</p>
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <span>ID: {incident.id}</span>
                        <span>Reportado: {incident.createdAt.toLocaleString()}</span>
                        <span>Por: {incident.reportedBy}</span>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <Button size="sm" variant="outline" onClick={() => setSelectedIncident(incident)}>
                        <Eye className="w-4 h-4 mr-1" />
                        Ver
                      </Button>
                      <Select onValueChange={(status) => updateIncidentStatus(incident.id, status as SecurityIncident['status'])}>
                        <SelectTrigger className="w-32">
                          <SelectValue placeholder="Cambiar estado" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="assigned">Asignar</SelectItem>
                          <SelectItem value="investigating">Investigar</SelectItem>
                          <SelectItem value="containing">Contener</SelectItem>
                          <SelectItem value="resolved">Resolver</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Asignado a:</span>
                      <p className="font-medium">{incident.assignedTo.join(', ')}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Activos afectados:</span>
                      <p className="font-medium">{incident.affectedAssets.length} sistemas</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Última actualización:</span>
                      <p className="font-medium">{incident.updatedAt.toLocaleString()}</p>
                    </div>
                  </div>

                  {incident.affectedAssets.length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <h4 className="font-medium text-sm mb-2">Activos Afectados:</h4>
                      <div className="flex flex-wrap gap-2">
                        {incident.affectedAssets.map(asset => (
                          <div key={asset.id} className="flex items-center space-x-1 text-xs bg-gray-100 rounded px-2 py-1">
                            {getAssetIcon(asset.type)}
                            <span>{asset.name}</span>
                            <Badge 
                              variant="outline" 
                              className={`ml-1 text-xs ${
                                asset.status === 'compromised' ? 'text-red-600 bg-red-50' :
                                asset.status === 'isolated' ? 'text-yellow-600 bg-yellow-50' :
                                asset.status === 'offline' ? 'text-gray-600 bg-gray-50' :
                                'text-green-600 bg-green-50'
                              }`}
                            >
                              {asset.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {incident.impact.financialImpact > 0 && (
                    <Alert className="mt-3">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Impacto Estimado</AlertTitle>
                      <AlertDescription className="text-sm">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                          <div>Financiero: ${incident.impact.financialImpact.toLocaleString()}</div>
                          <div>Usuarios: {incident.impact.affectedUsers.toLocaleString()}</div>
                          <div>Registros: {incident.impact.dataRecordsAffected.toLocaleString()}</div>
                          <div>Sistemas: {incident.impact.systemsAffected}</div>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Timeline */}
        <TabsContent value="timeline" className="space-y-4">
          {selectedIncident ? (
            <Card>
              <CardHeader>
                <CardTitle>Timeline - {selectedIncident.title}</CardTitle>
                <CardDescription>Cronología completa del incidente</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {selectedIncident.timeline.map((event, index) => (
                    <div key={event.id} className="flex items-start space-x-4">
                      <div className="flex flex-col items-center">
                        <div className="w-3 h-3 bg-blue-600 rounded-full" />
                        {index < selectedIncident.timeline.length - 1 && (
                          <div className="w-0.5 h-16 bg-gray-300 mt-2" />
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-medium">{event.event}</h4>
                          <span className="text-sm text-gray-500">
                            {event.timestamp.toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">{event.description}</p>
                        <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                          <span>Por: {event.actor}</span>
                          <Badge variant="outline" className="text-xs">
                            {event.category}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Clock className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-600 mb-2">Selecciona un incidente</h3>
                <p className="text-gray-500">Selecciona un incidente para ver su timeline detallado</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Playbooks */}
        <TabsContent value="playbooks" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {playbooks.map(playbook => (
              <Card key={playbook.id} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2 mb-3">
                    {getCategoryIcon(playbook.category)}
                    <h3 className="font-semibold">{playbook.name}</h3>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-600">Categoría:</span>
                      <p className="font-medium capitalize">{playbook.category.replace('_', ' ')}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Tiempo estimado:</span>
                      <p className="font-medium">{playbook.estimatedTime} min</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Pasos:</span>
                      <p className="font-medium">{playbook.steps.length} acciones</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Roles requeridos:</span>
                      <p className="font-medium">{playbook.requiredRoles.join(', ')}</p>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t">
                    <Button className="w-full" size="sm">
                      <Play className="w-4 h-4 mr-2" />
                      Ejecutar Playbook
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Comunicaciones */}
        <TabsContent value="communications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Centro de Comunicaciones</CardTitle>
              <CardDescription>Gestión de comunicaciones internas y externas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-3">Plantillas de Comunicación</h4>
                  <div className="space-y-2">
                    <Button variant="outline" className="w-full justify-start">
                      <Users className="w-4 h-4 mr-2" />
                      Notificación Interna
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      <Phone className="w-4 h-4 mr-2" />
                      Alerta a Clientes
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      <FileText className="w-4 h-4 mr-2" />
                      Reporte Regulatorio
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      <MessageSquare className="w-4 h-4 mr-2" />
                      Comunicado de Prensa
                    </Button>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-medium mb-3">Comunicaciones Recientes</h4>
                  <div className="space-y-3">
                    <div className="p-3 border rounded-lg">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-medium text-sm">Notificación de Seguridad</span>
                        <Badge variant="outline">Enviado</Badge>
                      </div>
                      <p className="text-xs text-gray-600">Equipo de IT - 14:30</p>
                    </div>
                    <div className="p-3 border rounded-lg">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-medium text-sm">Alerta a Stakeholders</span>
                        <Badge variant="outline">Borrador</Badge>
                      </div>
                      <p className="text-xs text-gray-600">Ejecutivos - Pendiente</p>
                    </div>
                  </div>
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
                <h3 className="font-semibold mb-2">Reporte de Incidente</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Reporte detallado de un incidente específico
                </p>
                <Button className="w-full">
                  <Download className="w-4 h-4 mr-2" />
                  Generar
                </Button>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="p-4 text-center">
                <TrendingUp className="w-12 h-12 mx-auto text-green-600 mb-4" />
                <h3 className="font-semibold mb-2">Métricas Mensual</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Resumen mensual de incidentes y métricas
                </p>
                <Button className="w-full">
                  <Download className="w-4 h-4 mr-2" />
                  Generar
                </Button>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="p-4 text-center">
                <Shield className="w-12 h-12 mx-auto text-purple-600 mb-4" />
                <h3 className="font-semibold mb-2">Dashboard Ejecutivo</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Resumen ejecutivo para stakeholders
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

      {/* Modal de Detalles del Incidente */}
      {selectedIncident && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>{selectedIncident.title}</CardTitle>
                  <CardDescription>
                    Incidente #{selectedIncident.id} - {selectedIncident.category}
                  </CardDescription>
                </div>
                <Button variant="outline" onClick={() => setSelectedIncident(null)}>
                  <XCircle className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <Label>Severidad</Label>
                    <Badge variant="outline" className={getSeverityColor(selectedIncident.severity)}>
                      {selectedIncident.severity}
                    </Badge>
                  </div>
                  <div>
                    <Label>Estado</Label>
                    <Badge variant="outline" className={getStatusColor(selectedIncident.status)}>
                      {selectedIncident.status}
                    </Badge>
                  </div>
                  <div>
                    <Label>Reportado por</Label>
                    <p className="text-sm">{selectedIncident.reportedBy}</p>
                  </div>
                  <div>
                    <Label>Creado</Label>
                    <p className="text-sm">{selectedIncident.createdAt.toLocaleString()}</p>
                  </div>
                </div>

                <div>
                  <Label>Descripción</Label>
                  <p className="text-sm text-gray-600 mt-1">{selectedIncident.description}</p>
                </div>

                <div>
                  <Label>Asignado a</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {selectedIncident.assignedTo.map(assignee => (
                      <Badge key={assignee} variant="outline">{assignee}</Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Activos Afectados</Label>
                  <div className="mt-2 space-y-2">
                    {selectedIncident.affectedAssets.map(asset => (
                      <div key={asset.id} className="flex items-center justify-between p-2 border rounded">
                        <div className="flex items-center space-x-2">
                          {getAssetIcon(asset.type)}
                          <span className="font-medium">{asset.name}</span>
                          <Badge variant="outline">{asset.type}</Badge>
                        </div>
                        <Badge 
                          variant="outline" 
                          className={
                            asset.status === 'compromised' ? 'text-red-600 bg-red-50' :
                            asset.status === 'isolated' ? 'text-yellow-600 bg-yellow-50' :
                            'text-green-600 bg-green-50'
                          }
                        >
                          {asset.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end space-x-2">
                  <Button variant="outline">
                    <Settings className="w-4 h-4 mr-2" />
                    Editar
                  </Button>
                  <Button>
                    <Play className="w-4 h-4 mr-2" />
                    Ejecutar Playbook
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

export default IncidentResponseDashboard
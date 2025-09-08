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
import { 
  Shield, 
  Bug, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Play,
  Pause,
  RefreshCw,
  Download,
  Settings,
  Target,
  Zap,
  Lock,
  Key,
  Database,
  Globe,
  Code,
  Eye,
  FileText,
  Clock,
  TrendingUp,
  Activity
} from 'lucide-react'

// Tipos para el sistema de penetration testing
interface PenetrationTest {
  id: string
  name: string
  type: 'network' | 'web' | 'api' | 'infrastructure' | 'social' | 'wireless'
  target: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  severity: 'low' | 'medium' | 'high' | 'critical'
  progress: number
  startTime?: Date
  endTime?: Date
  duration?: number
  findings: Finding[]
  methodology: string[]
  tools: string[]
  scope: TestScope
  results: TestResults
}

interface Finding {
  id: string
  title: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  type: string
  description: string
  impact: string
  recommendation: string
  cve?: string
  cvss?: number
  evidence: Evidence[]
  status: 'open' | 'confirmed' | 'false_positive' | 'resolved'
  discoveredAt: Date
  lastUpdated: Date
}

interface Evidence {
  id: string
  type: 'screenshot' | 'log' | 'code' | 'network' | 'file'
  content: string
  metadata: Record<string, any>
  timestamp: Date
}

interface TestScope {
  targets: string[]
  excludedTargets: string[]
  ports: number[]
  protocols: string[]
  credentials?: {
    username: string
    password: string
    domain?: string
  }
  timeWindow: {
    start: Date
    end: Date
  }
  intensity: 'passive' | 'normal' | 'aggressive'
}

interface TestResults {
  summary: {
    totalFindings: number
    criticalFindings: number
    highFindings: number
    mediumFindings: number
    lowFindings: number
  }
  coverage: {
    targetsScanned: number
    portsScanned: number
    servicesIdentified: number
    vulnerabilitiesFound: number
  }
  performance: {
    duration: number
    requestsSent: number
    responsesReceived: number
    errorsEncountered: number
  }
  compliance: {
    owasp: number
    nist: number
    iso27001: number
  }
}

interface TestTemplate {
  id: string
  name: string
  description: string
  type: PenetrationTest['type']
  methodology: string[]
  tools: string[]
  scope: Partial<TestScope>
  estimatedDuration: number
}

// Componente principal del panel de penetration testing
export function PenetrationTestingPanel() {
  const [tests, setTests] = useState<PenetrationTest[]>([])
  const [selectedTest, setSelectedTest] = useState<PenetrationTest | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [templates, setTemplates] = useState<TestTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  // Cargar tests y templates
  useEffect(() => {
    loadTests()
    loadTemplates()
  }, [])

  const loadTests = async () => {
    setLoading(true)
    try {
      // Simular carga de tests desde API
      const mockTests: PenetrationTest[] = [
        {
          id: '1',
          name: 'ArbitrageX API Security Test',
          type: 'api',
          target: 'https://api.arbitragex.com',
          status: 'completed',
          severity: 'high',
          progress: 100,
          startTime: new Date(Date.now() - 3600000),
          endTime: new Date(),
          duration: 3600,
          findings: [
            {
              id: '1',
              title: 'SQL Injection in Trade Endpoint',
              severity: 'critical',
              type: 'injection',
              description: 'SQL injection vulnerability found in /api/v1/trades endpoint',
              impact: 'Potential database compromise and data exfiltration',
              recommendation: 'Implement parameterized queries and input validation',
              cve: 'CVE-2023-1234',
              cvss: 9.8,
              evidence: [],
              status: 'open',
              discoveredAt: new Date(Date.now() - 1800000),
              lastUpdated: new Date()
            }
          ],
          methodology: ['OWASP Testing Guide', 'NIST SP 800-115'],
          tools: ['Burp Suite', 'OWASP ZAP', 'SQLMap'],
          scope: {
            targets: ['https://api.arbitragex.com'],
            excludedTargets: [],
            ports: [80, 443],
            protocols: ['HTTP', 'HTTPS'],
            timeWindow: {
              start: new Date(Date.now() - 3600000),
              end: new Date()
            },
            intensity: 'normal'
          },
          results: {
            summary: {
              totalFindings: 12,
              criticalFindings: 2,
              highFindings: 3,
              mediumFindings: 4,
              lowFindings: 3
            },
            coverage: {
              targetsScanned: 1,
              portsScanned: 2,
              servicesIdentified: 5,
              vulnerabilitiesFound: 12
            },
            performance: {
              duration: 3600,
              requestsSent: 1250,
              responsesReceived: 1248,
              errorsEncountered: 2
            },
            compliance: {
              owasp: 85,
              nist: 78,
              iso27001: 82
            }
          }
        }
      ]
      setTests(mockTests)
    } catch (error) {
      console.error('Error loading tests:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadTemplates = async () => {
    try {
      const mockTemplates: TestTemplate[] = [
        {
          id: '1',
          name: 'OWASP Top 10 Web Application Test',
          description: 'Comprehensive test covering OWASP Top 10 vulnerabilities',
          type: 'web',
          methodology: ['OWASP Testing Guide v4.2'],
          tools: ['Burp Suite', 'OWASP ZAP', 'Nikto'],
          scope: {
            ports: [80, 443, 8080, 8443],
            protocols: ['HTTP', 'HTTPS'],
            intensity: 'normal'
          },
          estimatedDuration: 7200
        },
        {
          id: '2',
          name: 'API Security Assessment',
          description: 'Focused testing on REST API endpoints and GraphQL',
          type: 'api',
          methodology: ['OWASP API Security Top 10'],
          tools: ['Postman', 'Insomnia', 'GraphQL Voyager'],
          scope: {
            ports: [80, 443],
            protocols: ['HTTP', 'HTTPS'],
            intensity: 'normal'
          },
          estimatedDuration: 5400
        },
        {
          id: '3',
          name: 'Network Infrastructure Scan',
          description: 'Network-level vulnerability assessment',
          type: 'network',
          methodology: ['NIST SP 800-115', 'OSSTMM'],
          tools: ['Nmap', 'OpenVAS', 'Nessus'],
          scope: {
            ports: [],
            protocols: ['TCP', 'UDP'],
            intensity: 'passive'
          },
          estimatedDuration: 10800
        }
      ]
      setTemplates(mockTemplates)
    } catch (error) {
      console.error('Error loading templates:', error)
    }
  }

  const createTest = useCallback((template: TestTemplate, customConfig: Partial<PenetrationTest>) => {
    const newTest: PenetrationTest = {
      id: Date.now().toString(),
      name: customConfig.name || template.name,
      type: template.type,
      target: customConfig.target || '',
      status: 'pending',
      severity: 'medium',
      progress: 0,
      findings: [],
      methodology: template.methodology,
      tools: template.tools,
      scope: {
        ...template.scope,
        targets: customConfig.target ? [customConfig.target] : [],
        excludedTargets: [],
        timeWindow: {
          start: new Date(),
          end: new Date(Date.now() + template.estimatedDuration * 1000)
        }
      } as TestScope,
      results: {
        summary: {
          totalFindings: 0,
          criticalFindings: 0,
          highFindings: 0,
          mediumFindings: 0,
          lowFindings: 0
        },
        coverage: {
          targetsScanned: 0,
          portsScanned: 0,
          servicesIdentified: 0,
          vulnerabilitiesFound: 0
        },
        performance: {
          duration: 0,
          requestsSent: 0,
          responsesReceived: 0,
          errorsEncountered: 0
        },
        compliance: {
          owasp: 0,
          nist: 0,
          iso27001: 0
        }
      }
    }

    setTests(prev => [...prev, newTest])
    return newTest
  }, [])

  const startTest = useCallback(async (testId: string) => {
    setTests(prev => prev.map(test => 
      test.id === testId 
        ? { 
            ...test, 
            status: 'running', 
            startTime: new Date(),
            progress: 0
          }
        : test
    ))

    // Simular progreso del test
    const progressInterval = setInterval(() => {
      setTests(prev => prev.map(test => {
        if (test.id === testId && test.status === 'running') {
          const newProgress = Math.min(test.progress + Math.random() * 10, 100)
          if (newProgress >= 100) {
            clearInterval(progressInterval)
            return {
              ...test,
              status: 'completed',
              progress: 100,
              endTime: new Date(),
              duration: Date.now() - (test.startTime?.getTime() || Date.now())
            }
          }
          return { ...test, progress: newProgress }
        }
        return test
      }))
    }, 1000)
  }, [])

  const stopTest = useCallback((testId: string) => {
    setTests(prev => prev.map(test => 
      test.id === testId 
        ? { 
            ...test, 
            status: 'cancelled',
            endTime: new Date(),
            duration: Date.now() - (test.startTime?.getTime() || Date.now())
          }
        : test
    ))
  }, [])

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50'
      case 'high': return 'text-orange-600 bg-orange-50'
      case 'medium': return 'text-yellow-600 bg-yellow-50'
      case 'low': return 'text-blue-600 bg-blue-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4" />
      case 'running': return <Activity className="w-4 h-4 animate-pulse" />
      case 'completed': return <CheckCircle className="w-4 h-4" />
      case 'failed': return <XCircle className="w-4 h-4" />
      case 'cancelled': return <XCircle className="w-4 h-4" />
      default: return <Clock className="w-4 h-4" />
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Panel de Penetration Testing</h2>
          <p className="text-gray-600">Gestión avanzada de pruebas de penetración y auditorías de seguridad</p>
        </div>
        <div className="flex space-x-2">
          <Button 
            onClick={() => setIsCreating(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Target className="w-4 h-4 mr-2" />
            Nuevo Test
          </Button>
          <Button 
            onClick={loadTests}
            variant="outline"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="active">Tests Activos</TabsTrigger>
          <TabsTrigger value="results">Resultados</TabsTrigger>
          <TabsTrigger value="findings">Hallazgos</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        {/* Resumen General */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Tests Ejecutados</p>
                    <p className="text-2xl font-bold">{tests.length}</p>
                  </div>
                  <Shield className="w-8 h-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Tests Activos</p>
                    <p className="text-2xl font-bold text-green-600">
                      {tests.filter(t => t.status === 'running').length}
                    </p>
                  </div>
                  <Activity className="w-8 h-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Vulnerabilidades Críticas</p>
                    <p className="text-2xl font-bold text-red-600">
                      {tests.reduce((sum, test) => sum + test.results.summary.criticalFindings, 0)}
                    </p>
                  </div>
                  <AlertTriangle className="w-8 h-8 text-red-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Cobertura Promedio</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {tests.length > 0 
                        ? Math.round(tests.reduce((sum, test) => sum + test.results.compliance.owasp, 0) / tests.length) 
                        : 0}%
                    </p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico de tendencias */}
          <Card>
            <CardHeader>
              <CardTitle>Tendencias de Seguridad</CardTitle>
              <CardDescription>
                Evolución de vulnerabilidades y cobertura de tests en el tiempo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
                <div className="text-center">
                  <TrendingUp className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500">Gráfico de tendencias de seguridad</p>
                  <p className="text-sm text-gray-400">Integración con biblioteca de gráficos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tests Activos */}
        <TabsContent value="active" className="space-y-4">
          {tests.filter(test => test.status === 'running' || test.status === 'pending').map(test => (
            <Card key={test.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center space-x-2 mb-2">
                      {getStatusIcon(test.status)}
                      <h3 className="font-semibold">{test.name}</h3>
                      <Badge variant="outline" className={getSeverityColor(test.severity)}>
                        {test.severity}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">Target: {test.target}</p>
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <span>Tipo: {test.type}</span>
                      <span>Herramientas: {test.tools.join(', ')}</span>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    {test.status === 'pending' && (
                      <Button 
                        size="sm" 
                        onClick={() => startTest(test.id)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <Play className="w-4 h-4 mr-1" />
                        Iniciar
                      </Button>
                    )}
                    {test.status === 'running' && (
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={() => stopTest(test.id)}
                      >
                        <Pause className="w-4 h-4 mr-1" />
                        Detener
                      </Button>
                    )}
                    <Button size="sm" variant="outline">
                      <Eye className="w-4 h-4 mr-1" />
                      Ver Detalles
                    </Button>
                  </div>
                </div>

                {test.status === 'running' && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progreso del test</span>
                      <span>{Math.round(test.progress)}%</span>
                    </div>
                    <Progress value={test.progress} className="w-full" />
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Requests enviados:</span>
                        <p className="font-medium">{test.results.performance.requestsSent}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Vulnerabilidades:</span>
                        <p className="font-medium">{test.results.summary.totalFindings}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Tiempo transcurrido:</span>
                        <p className="font-medium">
                          {test.startTime 
                            ? Math.round((Date.now() - test.startTime.getTime()) / 1000 / 60) 
                            : 0} min
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {tests.filter(test => test.status === 'running' || test.status === 'pending').length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <Target className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-600 mb-2">No hay tests activos</h3>
                <p className="text-gray-500 mb-4">Inicia un nuevo test de penetración para comenzar</p>
                <Button onClick={() => setIsCreating(true)}>
                  <Target className="w-4 h-4 mr-2" />
                  Crear Nuevo Test
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Resultados */}
        <TabsContent value="results" className="space-y-4">
          {tests.filter(test => test.status === 'completed').map(test => (
            <Card key={test.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-semibold mb-2">{test.name}</h3>
                    <p className="text-sm text-gray-600 mb-2">Target: {test.target}</p>
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <span>Completado: {test.endTime?.toLocaleDateString()}</span>
                      <span>Duración: {Math.round((test.duration || 0) / 1000 / 60)} min</span>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button size="sm" variant="outline">
                      <Download className="w-4 h-4 mr-1" />
                      Reporte
                    </Button>
                    <Button size="sm" variant="outline">
                      <FileText className="w-4 h-4 mr-1" />
                      Detalles
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="text-center p-3 bg-red-50 rounded-lg">
                    <p className="text-2xl font-bold text-red-600">
                      {test.results.summary.criticalFindings}
                    </p>
                    <p className="text-sm text-red-600">Críticas</p>
                  </div>
                  <div className="text-center p-3 bg-orange-50 rounded-lg">
                    <p className="text-2xl font-bold text-orange-600">
                      {test.results.summary.highFindings}
                    </p>
                    <p className="text-sm text-orange-600">Altas</p>
                  </div>
                  <div className="text-center p-3 bg-yellow-50 rounded-lg">
                    <p className="text-2xl font-bold text-yellow-600">
                      {test.results.summary.mediumFindings}
                    </p>
                    <p className="text-sm text-yellow-600">Medias</p>
                  </div>
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <p className="text-2xl font-bold text-blue-600">
                      {test.results.summary.lowFindings}
                    </p>
                    <p className="text-sm text-blue-600">Bajas</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Cobertura OWASP:</span>
                    <div className="flex items-center space-x-2 mt-1">
                      <Progress value={test.results.compliance.owasp} className="flex-1" />
                      <span className="font-medium">{test.results.compliance.owasp}%</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Cobertura NIST:</span>
                    <div className="flex items-center space-x-2 mt-1">
                      <Progress value={test.results.compliance.nist} className="flex-1" />
                      <span className="font-medium">{test.results.compliance.nist}%</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-600">Cobertura ISO27001:</span>
                    <div className="flex items-center space-x-2 mt-1">
                      <Progress value={test.results.compliance.iso27001} className="flex-1" />
                      <span className="font-medium">{test.results.compliance.iso27001}%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Hallazgos */}
        <TabsContent value="findings" className="space-y-4">
          {tests.flatMap(test => test.findings).map(finding => (
            <Card key={finding.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="flex items-center space-x-2 mb-2">
                      <Badge variant="outline" className={getSeverityColor(finding.severity)}>
                        {finding.severity}
                      </Badge>
                      <h3 className="font-semibold">{finding.title}</h3>
                      {finding.cve && (
                        <Badge variant="outline">{finding.cve}</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{finding.description}</p>
                  </div>
                  <div className="text-right">
                    {finding.cvss && (
                      <div className="text-sm">
                        <span className="text-gray-600">CVSS:</span>
                        <span className="font-medium ml-1">{finding.cvss}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <h4 className="font-medium mb-1">Impacto:</h4>
                    <p className="text-gray-600">{finding.impact}</p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Recomendación:</h4>
                    <p className="text-gray-600">{finding.recommendation}</p>
                  </div>
                </div>

                <div className="flex justify-between items-center mt-4 pt-4 border-t">
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <span>Descubierto: {finding.discoveredAt.toLocaleDateString()}</span>
                    <span>Estado: {finding.status}</span>
                  </div>
                  <div className="flex space-x-2">
                    <Button size="sm" variant="outline">
                      <Bug className="w-4 h-4 mr-1" />
                      Ver Evidencia
                    </Button>
                    <Button size="sm" variant="outline">
                      <Settings className="w-4 h-4 mr-1" />
                      Gestionar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {tests.flatMap(test => test.findings).length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <Bug className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-600 mb-2">No hay hallazgos disponibles</h3>
                <p className="text-gray-500">Ejecuta tests de penetración para identificar vulnerabilidades</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Templates */}
        <TabsContent value="templates" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map(template => (
              <Card key={template.id} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-semibold">{template.name}</h3>
                    <Badge variant="outline">{template.type}</Badge>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                  
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-600">Metodología:</span>
                      <p className="font-medium">{template.methodology.join(', ')}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Herramientas:</span>
                      <p className="font-medium">{template.tools.join(', ')}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Duración estimada:</span>
                      <p className="font-medium">{Math.round(template.estimatedDuration / 60)} minutos</p>
                    </div>
                  </div>

                  <Button 
                    className="w-full mt-4"
                    onClick={() => {
                      // Abrir modal de configuración del test
                      setIsCreating(true)
                    }}
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    Usar Template
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal de creación de test */}
      {isCreating && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Crear Nuevo Test de Penetración</CardTitle>
              <CardDescription>
                Configura los parámetros para el nuevo test de seguridad
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="testName">Nombre del Test</Label>
                  <Input id="testName" placeholder="Ej: API Security Test" />
                </div>
                <div>
                  <Label htmlFor="testType">Tipo de Test</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="web">Web Application</SelectItem>
                      <SelectItem value="api">API Security</SelectItem>
                      <SelectItem value="network">Network Infrastructure</SelectItem>
                      <SelectItem value="infrastructure">Infrastructure</SelectItem>
                      <SelectItem value="social">Social Engineering</SelectItem>
                      <SelectItem value="wireless">Wireless Security</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="target">Target/Objetivo</Label>
                <Input id="target" placeholder="https://api.arbitragex.com" />
              </div>

              <div>
                <Label htmlFor="template">Template Base</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map(template => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="intensity">Intensidad</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar intensidad" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="passive">Pasiva</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="aggressive">Agresiva</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch id="autoStart" />
                  <Label htmlFor="autoStart">Iniciar automáticamente</Label>
                </div>
              </div>

              <div>
                <Label htmlFor="scope">Scope/Alcance</Label>
                <Textarea 
                  id="scope"
                  placeholder="Define el alcance del test, exclusiones, etc."
                  rows={3}
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4">
                <Button variant="outline" onClick={() => setIsCreating(false)}>
                  Cancelar
                </Button>
                <Button onClick={() => {
                  // Crear el test con la configuración
                  setIsCreating(false)
                }}>
                  Crear Test
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

export default PenetrationTestingPanel
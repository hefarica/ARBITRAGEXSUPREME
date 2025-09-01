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
import { Checkbox } from '@/components/ui/checkbox'
import { 
  Shield, 
  FileCheck, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock,
  Download,
  Settings,
  BarChart3,
  FileText,
  Scale,
  Lock,
  Key,
  Database,
  Globe,
  Users,
  Activity,
  TrendingUp,
  Eye,
  RefreshCw,
  Filter,
  Search
} from 'lucide-react'

// Tipos para el sistema de compliance y auditoría
interface ComplianceFramework {
  id: string
  name: string
  version: string
  description: string
  categories: ComplianceCategory[]
  totalControls: number
  implementedControls: number
  complianceScore: number
  lastAudit: Date
  nextAudit: Date
  status: 'compliant' | 'non_compliant' | 'partially_compliant' | 'not_assessed'
}

interface ComplianceCategory {
  id: string
  name: string
  description: string
  controls: ComplianceControl[]
  weight: number
  score: number
}

interface ComplianceControl {
  id: string
  code: string
  title: string
  description: string
  requirement: string
  implementation: string
  evidence: Evidence[]
  status: 'implemented' | 'partial' | 'not_implemented' | 'not_applicable'
  riskLevel: 'low' | 'medium' | 'high' | 'critical'
  owner: string
  dueDate: Date
  lastReview: Date
  reviewNotes: string
  artifacts: Artifact[]
}

interface Evidence {
  id: string
  type: 'document' | 'screenshot' | 'log' | 'code' | 'certificate'
  title: string
  description: string
  filePath: string
  uploadDate: Date
  reviewer?: string
  reviewStatus: 'pending' | 'approved' | 'rejected'
}

interface Artifact {
  id: string
  name: string
  type: 'policy' | 'procedure' | 'documentation' | 'certificate' | 'report'
  filePath: string
  version: string
  owner: string
  lastUpdated: Date
  status: 'current' | 'outdated' | 'draft'
}

interface AuditResult {
  id: string
  frameworkId: string
  auditorName: string
  auditDate: Date
  scope: string[]
  findings: AuditFinding[]
  overallScore: number
  recommendations: Recommendation[]
  nextAuditDate: Date
  status: 'draft' | 'final' | 'under_review'
}

interface AuditFinding {
  id: string
  controlId: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  description: string
  impact: string
  recommendation: string
  evidence: Evidence[]
  status: 'open' | 'in_progress' | 'resolved' | 'accepted_risk'
  assignee: string
  dueDate: Date
}

interface Recommendation {
  id: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  title: string
  description: string
  implementation: string
  effort: string
  timeline: string
  cost: string
  benefits: string
  status: 'proposed' | 'approved' | 'in_progress' | 'completed' | 'rejected'
}

// Componente principal de Compliance Audit
export function ComplianceAudit() {
  const [frameworks, setFrameworks] = useState<ComplianceFramework[]>([])
  const [selectedFramework, setSelectedFramework] = useState<ComplianceFramework | null>(null)
  const [auditResults, setAuditResults] = useState<AuditResult[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')

  // Cargar frameworks y resultados de auditoría
  useEffect(() => {
    loadFrameworks()
    loadAuditResults()
  }, [])

  const loadFrameworks = async () => {
    setLoading(true)
    try {
      // Simular carga de frameworks de compliance
      const mockFrameworks: ComplianceFramework[] = [
        {
          id: '1',
          name: 'ISO 27001:2022',
          version: '2022',
          description: 'Information Security Management System',
          categories: [
            {
              id: '1',
              name: 'Information Security Policies',
              description: 'Policies for information security management',
              controls: [
                {
                  id: '1',
                  code: 'A.5.1.1',
                  title: 'Information Security Policy',
                  description: 'A set of policies for information security shall be defined',
                  requirement: 'Management shall provide direction and support for information security',
                  implementation: 'Information Security Policy document created and approved',
                  evidence: [],
                  status: 'implemented',
                  riskLevel: 'high',
                  owner: 'CISO',
                  dueDate: new Date(2024, 11, 31),
                  lastReview: new Date(2024, 5, 15),
                  reviewNotes: 'Policy updated to include new regulatory requirements',
                  artifacts: []
                }
              ],
              weight: 0.15,
              score: 85
            },
            {
              id: '2',
              name: 'Asset Management',
              description: 'Proper handling of information assets',
              controls: [
                {
                  id: '2',
                  code: 'A.8.1.1',
                  title: 'Inventory of Assets',
                  description: 'Assets associated with information and information processing facilities shall be identified',
                  requirement: 'An inventory of assets shall be maintained',
                  implementation: 'CMDB system implemented with automated asset discovery',
                  evidence: [],
                  status: 'implemented',
                  riskLevel: 'medium',
                  owner: 'IT Manager',
                  dueDate: new Date(2024, 11, 31),
                  lastReview: new Date(2024, 6, 10),
                  reviewNotes: 'Asset inventory updated quarterly',
                  artifacts: []
                }
              ],
              weight: 0.12,
              score: 92
            }
          ],
          totalControls: 93,
          implementedControls: 78,
          complianceScore: 84,
          lastAudit: new Date(2024, 4, 15),
          nextAudit: new Date(2025, 4, 15),
          status: 'compliant'
        },
        {
          id: '2',
          name: 'SOC 2 Type II',
          version: '2017',
          description: 'System and Organization Controls 2',
          categories: [
            {
              id: '3',
              name: 'Security',
              description: 'Protection against unauthorized access',
              controls: [
                {
                  id: '3',
                  code: 'CC6.1',
                  title: 'Logical and Physical Access Controls',
                  description: 'The entity implements logical access security software',
                  requirement: 'Entity has implemented access controls to prevent or detect unauthorized access',
                  implementation: 'Multi-factor authentication and role-based access control implemented',
                  evidence: [],
                  status: 'implemented',
                  riskLevel: 'high',
                  owner: 'Security Team',
                  dueDate: new Date(2024, 11, 31),
                  lastReview: new Date(2024, 5, 20),
                  reviewNotes: 'Access controls reviewed and updated',
                  artifacts: []
                }
              ],
              weight: 0.25,
              score: 88
            }
          ],
          totalControls: 64,
          implementedControls: 58,
          complianceScore: 91,
          lastAudit: new Date(2024, 3, 10),
          nextAudit: new Date(2025, 3, 10),
          status: 'compliant'
        },
        {
          id: '3',
          name: 'GDPR',
          version: '2018',
          description: 'General Data Protection Regulation',
          categories: [
            {
              id: '4',
              name: 'Data Processing',
              description: 'Lawful processing of personal data',
              controls: [
                {
                  id: '4',
                  code: 'Art.6',
                  title: 'Lawfulness of Processing',
                  description: 'Processing shall be lawful only if certain conditions are met',
                  requirement: 'At least one of the lawful bases for processing must apply',
                  implementation: 'Data processing inventory with legal basis documentation',
                  evidence: [],
                  status: 'partial',
                  riskLevel: 'critical',
                  owner: 'DPO',
                  dueDate: new Date(2024, 11, 31),
                  lastReview: new Date(2024, 6, 5),
                  reviewNotes: 'Need to update consent mechanisms',
                  artifacts: []
                }
              ],
              weight: 0.20,
              score: 75
            }
          ],
          totalControls: 47,
          implementedControls: 35,
          complianceScore: 74,
          lastAudit: new Date(2024, 2, 20),
          nextAudit: new Date(2024, 8, 20),
          status: 'partially_compliant'
        }
      ]
      setFrameworks(mockFrameworks)
      if (mockFrameworks.length > 0) {
        setSelectedFramework(mockFrameworks[0])
      }
    } catch (error) {
      console.error('Error loading frameworks:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadAuditResults = async () => {
    try {
      const mockResults: AuditResult[] = [
        {
          id: '1',
          frameworkId: '1',
          auditorName: 'KPMG Cyber Security',
          auditDate: new Date(2024, 4, 15),
          scope: ['All ISO 27001 controls', 'Technical infrastructure', 'Policies and procedures'],
          findings: [
            {
              id: '1',
              controlId: '1',
              severity: 'medium',
              title: 'Password Policy Enforcement',
              description: 'Password complexity requirements not consistently enforced across all systems',
              impact: 'Potential for weak passwords leading to unauthorized access',
              recommendation: 'Implement centralized password policy management',
              evidence: [],
              status: 'in_progress',
              assignee: 'IT Security Team',
              dueDate: new Date(2024, 8, 30)
            }
          ],
          overallScore: 84,
          recommendations: [
            {
              id: '1',
              priority: 'high',
              title: 'Implement Security Awareness Training',
              description: 'Regular security awareness training for all employees',
              implementation: 'Quarterly training sessions with testing and certification',
              effort: '40 hours/quarter',
              timeline: '3 months',
              cost: '$15,000/year',
              benefits: 'Reduced security incidents and improved compliance',
              status: 'approved'
            }
          ],
          nextAuditDate: new Date(2025, 4, 15),
          status: 'final'
        }
      ]
      setAuditResults(mockResults)
    } catch (error) {
      console.error('Error loading audit results:', error)
    }
  }

  const getComplianceColor = (score: number) => {
    if (score >= 90) return 'text-green-600 bg-green-50'
    if (score >= 75) return 'text-yellow-600 bg-yellow-50'
    if (score >= 60) return 'text-orange-600 bg-orange-50'
    return 'text-red-600 bg-red-50'
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'compliant': return 'text-green-600 bg-green-50'
      case 'partially_compliant': return 'text-yellow-600 bg-yellow-50'
      case 'non_compliant': return 'text-red-600 bg-red-50'
      case 'not_assessed': return 'text-gray-600 bg-gray-50'
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

  const getControlStatusIcon = (status: string) => {
    switch (status) {
      case 'implemented': return <CheckCircle className="w-4 h-4 text-green-600" />
      case 'partial': return <Clock className="w-4 h-4 text-yellow-600" />
      case 'not_implemented': return <XCircle className="w-4 h-4 text-red-600" />
      case 'not_applicable': return <XCircle className="w-4 h-4 text-gray-600" />
      default: return <Clock className="w-4 h-4 text-gray-600" />
    }
  }

  const filteredControls = selectedFramework?.categories.flatMap(category => 
    category.controls.filter(control => {
      const matchesSearch = searchTerm === '' || 
        control.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        control.code.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesStatus = filterStatus === 'all' || control.status === filterStatus
      
      return matchesSearch && matchesStatus
    })
  ) || []

  const exportReport = useCallback((frameworkId: string) => {
    // Simular exportación de reporte
    console.log(`Exporting compliance report for framework ${frameworkId}`)
  }, [])

  const generateAuditReport = useCallback((auditId: string) => {
    // Simular generación de reporte de auditoría
    console.log(`Generating audit report for ${auditId}`)
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Auditoría de Compliance</h2>
          <p className="text-gray-600">Gestión integral de frameworks de compliance y auditorías de seguridad</p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={() => loadFrameworks()} variant="outline" disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700">
            <FileCheck className="w-4 h-4 mr-2" />
            Nueva Auditoría
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Resumen</TabsTrigger>
          <TabsTrigger value="frameworks">Frameworks</TabsTrigger>
          <TabsTrigger value="controls">Controles</TabsTrigger>
          <TabsTrigger value="audits">Auditorías</TabsTrigger>
          <TabsTrigger value="findings">Hallazgos</TabsTrigger>
          <TabsTrigger value="reports">Reportes</TabsTrigger>
        </TabsList>

        {/* Resumen General */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Frameworks Activos</p>
                    <p className="text-2xl font-bold">{frameworks.length}</p>
                  </div>
                  <Scale className="w-8 h-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Compliance Promedio</p>
                    <p className="text-2xl font-bold text-green-600">
                      {frameworks.length > 0 
                        ? Math.round(frameworks.reduce((sum, f) => sum + f.complianceScore, 0) / frameworks.length)
                        : 0}%
                    </p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Controles Implementados</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {frameworks.reduce((sum, f) => sum + f.implementedControls, 0)}
                    </p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Auditorías Completadas</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {auditResults.filter(a => a.status === 'final').length}
                    </p>
                  </div>
                  <FileCheck className="w-8 h-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Dashboard de Compliance */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Estado de Frameworks</CardTitle>
                <CardDescription>Nivel de compliance por framework</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {frameworks.map(framework => (
                  <div key={framework.id} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-medium">{framework.name}</span>
                        <Badge 
                          variant="outline" 
                          className={`ml-2 ${getStatusColor(framework.status)}`}
                        >
                          {framework.status}
                        </Badge>
                      </div>
                      <span className="font-bold">{framework.complianceScore}%</span>
                    </div>
                    <Progress value={framework.complianceScore} className="h-2" />
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>{framework.implementedControls}/{framework.totalControls} controles</span>
                      <span>Próxima auditoría: {framework.nextAudit.toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Hallazgos Recientes</CardTitle>
                <CardDescription>Últimos hallazgos de auditorías</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {auditResults.flatMap(audit => audit.findings).slice(0, 5).map(finding => (
                  <div key={finding.id} className="flex justify-between items-start p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <Badge variant="outline" className={getSeverityColor(finding.severity)}>
                          {finding.severity}
                        </Badge>
                        <span className="font-medium text-sm">{finding.title}</span>
                      </div>
                      <p className="text-sm text-gray-600">{finding.description}</p>
                      <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                        <span>Asignado a: {finding.assignee}</span>
                        <span>Vence: {finding.dueDate.toLocaleDateString()}</span>
                      </div>
                    </div>
                    <Badge variant="outline" className={getStatusColor(finding.status)}>
                      {finding.status}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Métricas de Compliance */}
          <Card>
            <CardHeader>
              <CardTitle>Métricas de Compliance</CardTitle>
              <CardDescription>Análisis detallado del estado de compliance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg">
                <div className="text-center">
                  <BarChart3 className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500">Gráfico de métricas de compliance</p>
                  <p className="text-sm text-gray-400">Integración con biblioteca de gráficos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Frameworks */}
        <TabsContent value="frameworks" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {frameworks.map(framework => (
              <Card key={framework.id} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold">{framework.name}</h3>
                      <p className="text-sm text-gray-600">Versión {framework.version}</p>
                    </div>
                    <Badge variant="outline" className={getStatusColor(framework.status)}>
                      {framework.status}
                    </Badge>
                  </div>

                  <p className="text-sm text-gray-600 mb-4">{framework.description}</p>

                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Compliance Score</span>
                        <span className="font-medium">{framework.complianceScore}%</span>
                      </div>
                      <Progress value={framework.complianceScore} className="h-2" />
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Controles totales:</span>
                        <p className="font-medium">{framework.totalControls}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Implementados:</span>
                        <p className="font-medium text-green-600">{framework.implementedControls}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Última auditoría:</span>
                        <p className="font-medium">{framework.lastAudit.toLocaleDateString()}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Próxima auditoría:</span>
                        <p className="font-medium">{framework.nextAudit.toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between mt-4 pt-4 border-t">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setSelectedFramework(framework)}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      Ver Detalles
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={() => exportReport(framework.id)}
                    >
                      <Download className="w-4 h-4 mr-1" />
                      Exportar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Controles */}
        <TabsContent value="controls" className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Search className="w-4 h-4 text-gray-500" />
                <Input
                  placeholder="Buscar controles..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-64"
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="implemented">Implementado</SelectItem>
                  <SelectItem value="partial">Parcial</SelectItem>
                  <SelectItem value="not_implemented">No implementado</SelectItem>
                  <SelectItem value="not_applicable">No aplicable</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="text-sm text-gray-600">
              {filteredControls.length} controles encontrados
            </div>
          </div>

          <div className="space-y-4">
            {filteredControls.map(control => (
              <Card key={control.id}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        {getControlStatusIcon(control.status)}
                        <Badge variant="outline">{control.code}</Badge>
                        <h3 className="font-semibold">{control.title}</h3>
                        <Badge variant="outline" className={getSeverityColor(control.riskLevel)}>
                          {control.riskLevel}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{control.description}</p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="text-gray-600">Owner: <span className="font-medium">{control.owner}</span></p>
                      <p className="text-gray-600">Vence: {control.dueDate.toLocaleDateString()}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <h4 className="font-medium mb-1">Requerimiento:</h4>
                      <p className="text-gray-600">{control.requirement}</p>
                    </div>
                    <div>
                      <h4 className="font-medium mb-1">Implementación:</h4>
                      <p className="text-gray-600">{control.implementation}</p>
                    </div>
                  </div>

                  {control.reviewNotes && (
                    <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                      <h4 className="font-medium text-sm mb-1">Notas de revisión:</h4>
                      <p className="text-sm text-gray-600">{control.reviewNotes}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Última revisión: {control.lastReview.toLocaleDateString()}
                      </p>
                    </div>
                  )}

                  <div className="flex justify-between items-center mt-4 pt-4 border-t">
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <span>Evidencias: {control.evidence.length}</span>
                      <span>Artefactos: {control.artifacts.length}</span>
                    </div>
                    <div className="flex space-x-2">
                      <Button size="sm" variant="outline">
                        <FileText className="w-4 h-4 mr-1" />
                        Evidencia
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
          </div>
        </TabsContent>

        {/* Auditorías */}
        <TabsContent value="audits" className="space-y-4">
          {auditResults.map(audit => (
            <Card key={audit.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="font-semibold">
                        Auditoría {frameworks.find(f => f.id === audit.frameworkId)?.name}
                      </h3>
                      <Badge variant="outline" className={getStatusColor(audit.status)}>
                        {audit.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">Auditor: {audit.auditorName}</p>
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <span>Fecha: {audit.auditDate.toLocaleDateString()}</span>
                      <span>Score: {audit.overallScore}%</span>
                      <span>Hallazgos: {audit.findings.length}</span>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button size="sm" variant="outline">
                      <Eye className="w-4 h-4 mr-1" />
                      Ver Detalles
                    </Button>
                    <Button size="sm" onClick={() => generateAuditReport(audit.id)}>
                      <Download className="w-4 h-4 mr-1" />
                      Reporte
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <p className="text-2xl font-bold text-blue-600">{audit.overallScore}%</p>
                    <p className="text-sm text-blue-600">Score General</p>
                  </div>
                  <div className="text-center p-3 bg-orange-50 rounded-lg">
                    <p className="text-2xl font-bold text-orange-600">{audit.findings.length}</p>
                    <p className="text-sm text-orange-600">Hallazgos</p>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">{audit.recommendations.length}</p>
                    <p className="text-sm text-green-600">Recomendaciones</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-medium">Alcance:</h4>
                  <ul className="text-sm text-gray-600 list-disc list-inside">
                    {audit.scope.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </div>

                {audit.findings.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-medium mb-2">Hallazgos principales:</h4>
                    <div className="space-y-2">
                      {audit.findings.slice(0, 3).map(finding => (
                        <div key={finding.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline" className={getSeverityColor(finding.severity)}>
                              {finding.severity}
                            </Badge>
                            <span className="text-sm">{finding.title}</span>
                          </div>
                          <Badge variant="outline" className={getStatusColor(finding.status)}>
                            {finding.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Hallazgos */}
        <TabsContent value="findings" className="space-y-4">
          {auditResults.flatMap(audit => audit.findings).map(finding => (
            <Card key={finding.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="flex items-center space-x-2 mb-2">
                      <Badge variant="outline" className={getSeverityColor(finding.severity)}>
                        {finding.severity}
                      </Badge>
                      <h3 className="font-semibold">{finding.title}</h3>
                      <Badge variant="outline" className={getStatusColor(finding.status)}>
                        {finding.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{finding.description}</p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="text-gray-600">Asignado: <span className="font-medium">{finding.assignee}</span></p>
                    <p className="text-gray-600">Vence: {finding.dueDate.toLocaleDateString()}</p>
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
                  <div className="text-sm text-gray-500">
                    Control: {finding.controlId} | Evidencias: {finding.evidence.length}
                  </div>
                  <div className="flex space-x-2">
                    <Button size="sm" variant="outline">
                      <FileText className="w-4 h-4 mr-1" />
                      Evidencia
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
        </TabsContent>

        {/* Reportes */}
        <TabsContent value="reports" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="p-4 text-center">
                <FileText className="w-12 h-12 mx-auto text-blue-600 mb-4" />
                <h3 className="font-semibold mb-2">Reporte Ejecutivo</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Resumen ejecutivo del estado de compliance
                </p>
                <Button className="w-full">
                  <Download className="w-4 h-4 mr-2" />
                  Generar Reporte
                </Button>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="p-4 text-center">
                <BarChart3 className="w-12 h-12 mx-auto text-green-600 mb-4" />
                <h3 className="font-semibold mb-2">Métricas Detalladas</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Análisis detallado de métricas de compliance
                </p>
                <Button className="w-full">
                  <Download className="w-4 h-4 mr-2" />
                  Generar Reporte
                </Button>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="p-4 text-center">
                <Scale className="w-12 h-12 mx-auto text-purple-600 mb-4" />
                <h3 className="font-semibold mb-2">Auditoría Completa</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Reporte completo de auditoría de compliance
                </p>
                <Button className="w-full">
                  <Download className="w-4 h-4 mr-2" />
                  Generar Reporte
                </Button>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="p-4 text-center">
                <AlertTriangle className="w-12 h-12 mx-auto text-orange-600 mb-4" />
                <h3 className="font-semibold mb-2">Hallazgos y Riesgos</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Reporte de hallazgos y análisis de riesgos
                </p>
                <Button className="w-full">
                  <Download className="w-4 h-4 mr-2" />
                  Generar Reporte
                </Button>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="p-4 text-center">
                <TrendingUp className="w-12 h-12 mx-auto text-indigo-600 mb-4" />
                <h3 className="font-semibold mb-2">Tendencias</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Análisis de tendencias de compliance
                </p>
                <Button className="w-full">
                  <Download className="w-4 h-4 mr-2" />
                  Generar Reporte
                </Button>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-md transition-shadow">
              <CardContent className="p-4 text-center">
                <Users className="w-12 h-12 mx-auto text-teal-600 mb-4" />
                <h3 className="font-semibold mb-2">Plan de Acción</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Plan de acción y remediation roadmap
                </p>
                <Button className="w-full">
                  <Download className="w-4 h-4 mr-2" />
                  Generar Reporte
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default ComplianceAudit
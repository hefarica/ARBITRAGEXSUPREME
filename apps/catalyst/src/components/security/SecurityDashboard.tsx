// ===================================================================
// ARBITRAGEX SUPREME - DASHBOARD DE SEGURIDAD Y AUDITORÍA
// Actividades 51-55: Security Dashboard Interface
// Ingenio Pichichi S.A. - Hector Fabio Riascos C.
// ===================================================================

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Play,
  Pause,
  RotateCcw,
  Search,
  Filter,
  Download,
  Upload,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Zap,
  Activity,
  FileText,
  Settings,
  Target,
  Scan,
  Bug,
  Server,
  Database,
  Globe,
  Code,
  Users,
  Key
} from 'lucide-react';
import {
  vulnerabilityScanner,
  SecurityVulnerability,
  SecurityScan,
  SecurityMetrics,
  RiskLevel,
  VulnerabilityType
} from '@/lib/security';

// ============================================================================
// INTERFACES
// ============================================================================

interface SecurityFilters {
  severity: RiskLevel[];
  type: VulnerabilityType[];
  status: string[];
}

interface ScanProgress {
  scanId: string;
  currentTest: string;
  progress: number;
  vulnerabilitiesFound: number;
  isRunning: boolean;
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function SecurityDashboard(): JSX.Element {
  // Estados
  const [vulnerabilities, setVulnerabilities] = useState<SecurityVulnerability[]>([]);
  const [scans, setScans] = useState<SecurityScan[]>([]);
  const [metrics, setMetrics] = useState<SecurityMetrics>({
    totalScans: 0,
    vulnerabilitiesFound: 0,
    criticalVulnerabilities: 0,
    securityScore: 100,
    lastScanDate: 0,
    averageRiskScore: 0,
    securityEvents24h: 0,
    blockedAttacks24h: 0
  });
  
  const [filters, setFilters] = useState<SecurityFilters>({
    severity: [],
    type: [],
    status: []
  });
  
  const [selectedVulnerability, setSelectedVulnerability] = useState<SecurityVulnerability | null>(null);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [scanTarget, setScanTarget] = useState('https://arbitragexsupreme.com');
  const [isScanning, setIsScanning] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // ========================================================================
  // EFECTOS
  // ========================================================================

  useEffect(() => {
    // Cargar datos iniciales
    loadSecurityData();
    
    // Event listeners
    const handleScanStarted = (data: any) => {
      setScanProgress({
        scanId: data.scanId,
        currentTest: 'Initializing...',
        progress: 0,
        vulnerabilitiesFound: 0,
        isRunning: true
      });
      setIsScanning(true);
    };

    const handleScanProgress = (data: any) => {
      setScanProgress(prev => prev ? {
        ...prev,
        currentTest: data.testType,
        progress: prev.progress + 10,
        vulnerabilitiesFound: prev.vulnerabilitiesFound + data.vulnerabilitiesFound
      } : null);
    };

    const handleScanCompleted = (data: any) => {
      setScanProgress(prev => prev ? {
        ...prev,
        progress: 100,
        isRunning: false
      } : null);
      setIsScanning(false);
      loadSecurityData();
      
      setTimeout(() => setScanProgress(null), 3000);
    };

    const handleScanFailed = (data: any) => {
      setScanProgress(null);
      setIsScanning(false);
    };

    vulnerabilityScanner.on('scan:started', handleScanStarted);
    vulnerabilityScanner.on('scan:progress', handleScanProgress);
    vulnerabilityScanner.on('scan:completed', handleScanCompleted);
    vulnerabilityScanner.on('scan:failed', handleScanFailed);

    // Intervalo de actualización
    const interval = setInterval(loadSecurityData, 30000);

    // Cleanup
    return () => {
      clearInterval(interval);
      vulnerabilityScanner.off('scan:started', handleScanStarted);
      vulnerabilityScanner.off('scan:progress', handleScanProgress);
      vulnerabilityScanner.off('scan:completed', handleScanCompleted);
      vulnerabilityScanner.off('scan:failed', handleScanFailed);
    };
  }, []);

  // Recargar cuando cambien los filtros
  useEffect(() => {
    loadVulnerabilities();
  }, [filters]);

  // ========================================================================
  // FUNCIONES
  // ========================================================================

  const loadSecurityData = useCallback(() => {
    loadVulnerabilities();
    loadScans();
    loadMetrics();
  }, []);

  const loadVulnerabilities = useCallback(() => {
    const vulnData = vulnerabilityScanner.getVulnerabilities({
      severity: filters.severity.length > 0 ? filters.severity : undefined,
      type: filters.type.length > 0 ? filters.type : undefined,
      status: filters.status.length > 0 ? filters.status : undefined
    });
    setVulnerabilities(vulnData);
  }, [filters]);

  const loadScans = useCallback(() => {
    const scanData = vulnerabilityScanner.getScans();
    setScans(scanData.slice(0, 10)); // Últimos 10 escaneos
  }, []);

  const loadMetrics = useCallback(() => {
    const metricsData = vulnerabilityScanner.getMetrics();
    setMetrics(metricsData);
  }, []);

  const handleStartScan = useCallback(async () => {
    if (isScanning) return;
    
    try {
      await vulnerabilityScanner.startScan(scanTarget, 'automated', {
        testTypes: ['sql_injection', 'xss', 'csrf', 'authentication', 'authorization'],
        aggressiveMode: false,
        timeout: 600000 // 10 minutos
      });
    } catch (error) {
      console.error('Error starting scan:', error);
      alert('Error al iniciar el escaneo: ' + error.message);
    }
  }, [scanTarget, isScanning]);

  const handleStopScan = useCallback(async () => {
    if (!scanProgress) return;
    
    try {
      await vulnerabilityScanner.stopScan(scanProgress.scanId);
      setScanProgress(null);
      setIsScanning(false);
    } catch (error) {
      console.error('Error stopping scan:', error);
    }
  }, [scanProgress]);

  const handleMarkAsFixed = useCallback((vulnerabilityId: string) => {
    // En una implementación real, esto actualizaría el estado en el scanner
    setVulnerabilities(prev => 
      prev.map(vuln => 
        vuln.id === vulnerabilityId 
          ? { ...vuln, status: 'fixed' }
          : vuln
      )
    );
  }, []);

  const handleExportReport = useCallback(() => {
    const reportData = {
      generatedAt: new Date().toISOString(),
      metrics,
      vulnerabilities: vulnerabilities.slice(0, 50), // Top 50
      scans: scans.slice(0, 5) // Últimos 5 escaneos
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `security-report-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [metrics, vulnerabilities, scans]);

  // Funciones de utilidad
  const getSeverityColor = (severity: RiskLevel): string => {
    switch (severity) {
      case 'critical': return 'text-red-700';
      case 'high': return 'text-red-600';
      case 'medium': return 'text-yellow-600';
      case 'low': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  const getSeverityBadge = (severity: RiskLevel): 'default' | 'secondary' | 'destructive' => {
    switch (severity) {
      case 'critical':
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      default: return 'default';
    }
  };

  const getVulnerabilityIcon = (type: VulnerabilityType) => {
    switch (type) {
      case 'sql_injection': return <Database className="w-4 h-4" />;
      case 'xss': return <Code className="w-4 h-4" />;
      case 'csrf': return <Shield className="w-4 h-4" />;
      case 'authentication': return <Key className="w-4 h-4" />;
      case 'authorization': return <Users className="w-4 h-4" />;
      case 'data_exposure': return <Eye className="w-4 h-4" />;
      case 'encryption': return <Lock className="w-4 h-4" />;
      case 'api_security': return <Globe className="w-4 h-4" />;
      default: return <Bug className="w-4 h-4" />;
    }
  };

  const getSecurityScoreColor = (score: number): string => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    if (score >= 50) return 'text-orange-600';
    return 'text-red-600';
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleString();
  };

  // Datos para gráficos
  const vulnerabilityDistribution = [
    { name: 'Críticas', value: vulnerabilities.filter(v => v.severity === 'critical').length, color: '#dc2626' },
    { name: 'Altas', value: vulnerabilities.filter(v => v.severity === 'high').length, color: '#ef4444' },
    { name: 'Medias', value: vulnerabilities.filter(v => v.severity === 'medium').length, color: '#f59e0b' },
    { name: 'Bajas', value: vulnerabilities.filter(v => v.severity === 'low').length, color: '#3b82f6' }
  ].filter(item => item.value > 0);

  const typeDistribution = Object.entries(
    vulnerabilities.reduce((acc, vuln) => {
      acc[vuln.type] = (acc[vuln.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([type, count]) => ({ type, count }));

  const securityTrend = scans.slice(-10).map((scan, index) => ({
    scan: index + 1,
    score: Math.max(0, 100 - scan.summary.riskScore),
    vulnerabilities: scan.summary.totalVulnerabilities
  }));

  const radarData = [
    { metric: 'Autenticación', value: Math.max(0, 100 - vulnerabilities.filter(v => v.type === 'authentication').length * 20) },
    { metric: 'Autorización', value: Math.max(0, 100 - vulnerabilities.filter(v => v.type === 'authorization').length * 20) },
    { metric: 'Encriptación', value: Math.max(0, 100 - vulnerabilities.filter(v => v.type === 'encryption').length * 20) },
    { metric: 'Validación', value: Math.max(0, 100 - vulnerabilities.filter(v => v.type === 'input_validation').length * 20) },
    { metric: 'API Security', value: Math.max(0, 100 - vulnerabilities.filter(v => v.type === 'api_security').length * 20) },
    { metric: 'Sesiones', value: Math.max(0, 100 - vulnerabilities.filter(v => v.type === 'session_management').length * 20) }
  ];

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Security Dashboard</h2>
          <p className="text-gray-600">Auditoría de seguridad y testing de vulnerabilidades</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <Button
            onClick={handleExportReport}
            variant="outline"
            size="sm"
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
          
          <Button
            onClick={() => setShowFilters(!showFilters)}
            variant="outline"
            size="sm"
          >
            <Filter className="w-4 h-4 mr-2" />
            Filtros
          </Button>
        </div>
      </div>

      {/* Security Score Overview */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security Score</CardTitle>
            <Shield className={`w-4 h-4 ${getSecurityScoreColor(metrics.securityScore)}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${getSecurityScoreColor(metrics.securityScore)}`}>
              {metrics.securityScore.toFixed(0)}
            </div>
            <Progress value={metrics.securityScore} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.securityScore >= 90 ? 'Excelente' :
               metrics.securityScore >= 70 ? 'Buena' :
               metrics.securityScore >= 50 ? 'Regular' : 'Crítica'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Vulnerabilidades</CardTitle>
            <Bug className="w-4 h-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.vulnerabilitiesFound}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.criticalVulnerabilities} críticas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Últimas 24h</CardTitle>
            <Activity className="w-4 h-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.securityEvents24h}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.blockedAttacks24h} bloqueados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Escaneos</CardTitle>
            <Scan className="w-4 h-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalScans}</div>
            <p className="text-xs text-muted-foreground">
              Último: {metrics.lastScanDate > 0 ? formatDate(metrics.lastScanDate) : 'Nunca'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Riesgo Promedio</CardTitle>
            <Target className="w-4 h-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.averageRiskScore.toFixed(1)}</div>
            <Progress value={metrics.averageRiskScore * 10} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Scan Progress */}
      {scanProgress && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center">
                <Activity className="w-5 h-5 mr-2 text-blue-600" />
                Escaneo en Progreso
              </span>
              <Button
                onClick={handleStopScan}
                variant="outline"
                size="sm"
              >
                <Pause className="w-4 h-4 mr-2" />
                Detener
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Progreso: {scanProgress.progress}%</span>
                <span className="text-sm text-gray-600">{scanProgress.vulnerabilitiesFound} vulnerabilidades encontradas</span>
              </div>
              <Progress value={scanProgress.progress} />
              <p className="text-sm text-gray-600">
                Ejecutando: {scanProgress.currentTest}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filtros */}
      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle>Filtros de Vulnerabilidades</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium">Severidad</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {(['critical', 'high', 'medium', 'low'] as RiskLevel[]).map(severity => (
                    <Badge
                      key={severity}
                      variant={filters.severity.includes(severity) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => {
                        setFilters(prev => ({
                          ...prev,
                          severity: prev.severity.includes(severity)
                            ? prev.severity.filter(s => s !== severity)
                            : [...prev.severity, severity]
                        }));
                      }}
                    >
                      {severity}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Tipo</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {(['sql_injection', 'xss', 'csrf', 'authentication'] as VulnerabilityType[]).map(type => (
                    <Badge
                      key={type}
                      variant={filters.type.includes(type) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => {
                        setFilters(prev => ({
                          ...prev,
                          type: prev.type.includes(type)
                            ? prev.type.filter(t => t !== type)
                            : [...prev.type, type]
                        }));
                      }}
                    >
                      {type.replace('_', ' ')}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Estado</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {['open', 'fixed', 'accepted'].map(status => (
                    <Badge
                      key={status}
                      variant={filters.status.includes(status) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => {
                        setFilters(prev => ({
                          ...prev,
                          status: prev.status.includes(status)
                            ? prev.status.filter(s => s !== status)
                            : [...prev.status, status]
                        }));
                      }}
                    >
                      {status}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="mt-4 pt-4 border-t flex justify-end">
              <Button
                onClick={() => setFilters({ severity: [], type: [], status: [] })}
                variant="outline"
                size="sm"
              >
                Limpiar Filtros
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs Container */}
      <Tabs defaultValue="scanner" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="scanner">Escáner</TabsTrigger>
          <TabsTrigger value="vulnerabilities">Vulnerabilidades</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="policies">Políticas</TabsTrigger>
        </TabsList>

        {/* Scanner Tab */}
        <TabsContent value="scanner" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Scan Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Scan className="w-5 h-5 mr-2" />
                  Configuración de Escaneo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Target URL</label>
                  <input
                    type="url"
                    value={scanTarget}
                    onChange={(e) => setScanTarget(e.target.value)}
                    placeholder="https://arbitragexsupreme.com"
                    className="w-full px-3 py-2 border rounded-md"
                    disabled={isScanning}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Tipos de Test</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'sql_injection', label: 'SQL Injection', icon: <Database className="w-4 h-4" /> },
                      { id: 'xss', label: 'XSS', icon: <Code className="w-4 h-4" /> },
                      { id: 'csrf', label: 'CSRF', icon: <Shield className="w-4 h-4" /> },
                      { id: 'auth', label: 'Authentication', icon: <Key className="w-4 h-4" /> },
                    ].map(test => (
                      <div key={test.id} className="flex items-center p-2 border rounded">
                        {test.icon}
                        <span className="ml-2 text-sm">{test.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={handleStartScan}
                  disabled={isScanning || !scanTarget}
                  className="w-full"
                >
                  {isScanning ? (
                    <>
                      <Activity className="w-4 h-4 mr-2 animate-spin" />
                      Escaneando...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Iniciar Escaneo
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Recent Scans */}
            <Card>
              <CardHeader>
                <CardTitle>Escaneos Recientes</CardTitle>
              </CardHeader>
              <CardContent>
                {scans.length === 0 ? (
                  <div className="text-center py-8">
                    <Scan className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No hay escaneos disponibles</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {scans.map((scan) => (
                      <div
                        key={scan.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{scan.target}</p>
                          <p className="text-sm text-gray-600">{scan.type}</p>
                          <p className="text-xs text-gray-500">
                            {formatDate(scan.startTime)}
                          </p>
                        </div>
                        
                        <div className="text-right">
                          <Badge variant={
                            scan.status === 'completed' ? 'default' :
                            scan.status === 'running' ? 'secondary' :
                            scan.status === 'failed' ? 'destructive' : 'outline'
                          }>
                            {scan.status}
                          </Badge>
                          
                          <p className="text-sm mt-1">
                            {scan.summary.totalVulnerabilities} vulnerabilidades
                          </p>
                          
                          <p className="text-xs text-gray-500">
                            Score: {Math.max(0, 100 - scan.summary.riskScore)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Vulnerabilities Tab */}
        <TabsContent value="vulnerabilities" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Vulnerabilities List */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Vulnerabilidades Encontradas</span>
                    <Badge variant="secondary">{vulnerabilities.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {vulnerabilities.length === 0 ? (
                    <div className="text-center py-8">
                      <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
                      <p className="text-gray-500">No se encontraron vulnerabilidades</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {vulnerabilities.map((vulnerability) => (
                        <div
                          key={vulnerability.id}
                          className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                            selectedVulnerability?.id === vulnerability.id
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => setSelectedVulnerability(vulnerability)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start space-x-3">
                              <div className={getSeverityColor(vulnerability.severity)}>
                                {getVulnerabilityIcon(vulnerability.type)}
                              </div>
                              
                              <div className="flex-1">
                                <div className="flex items-center space-x-2">
                                  <h4 className="font-medium">{vulnerability.title}</h4>
                                  <Badge variant={getSeverityBadge(vulnerability.severity)}>
                                    {vulnerability.severity}
                                  </Badge>
                                </div>
                                
                                <p className="text-sm text-gray-600 mt-1">
                                  {vulnerability.description}
                                </p>
                                
                                <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                                  <span>{vulnerability.type.replace('_', ' ')}</span>
                                  <span>{vulnerability.location}</span>
                                  <span>{formatDate(vulnerability.discoveredAt)}</span>
                                </div>
                              </div>
                            </div>

                            {vulnerability.status === 'open' && (
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMarkAsFixed(vulnerability.id);
                                }}
                                variant="outline"
                                size="sm"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Vulnerability Details */}
            <div>
              <Card>
                <CardHeader>
                  <CardTitle>Detalles de Vulnerabilidad</CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedVulnerability ? (
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium">{selectedVulnerability.title}</h4>
                        <Badge variant={getSeverityBadge(selectedVulnerability.severity)} className="mt-1">
                          {selectedVulnerability.severity}
                        </Badge>
                      </div>

                      <div>
                        <h5 className="font-medium text-sm mb-2">Descripción</h5>
                        <p className="text-sm text-gray-600">{selectedVulnerability.description}</p>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Tipo:</span>
                          <span>{selectedVulnerability.type.replace('_', ' ')}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Ubicación:</span>
                          <span className="truncate ml-2">{selectedVulnerability.location}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Estado:</span>
                          <span>{selectedVulnerability.status}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Descubierta:</span>
                          <span>{formatDate(selectedVulnerability.discoveredAt)}</span>
                        </div>
                      </div>

                      <div>
                        <h5 className="font-medium text-sm mb-2">Evidencia</h5>
                        <p className="text-xs bg-gray-100 p-2 rounded font-mono">
                          {selectedVulnerability.evidence}
                        </p>
                      </div>

                      <div>
                        <h5 className="font-medium text-sm mb-2">Remediación</h5>
                        <p className="text-sm text-gray-600">{selectedVulnerability.remediation}</p>
                      </div>

                      {selectedVulnerability.tags.length > 0 && (
                        <div>
                          <h5 className="font-medium text-sm mb-2">Tags</h5>
                          <div className="flex flex-wrap gap-1">
                            {selectedVulnerability.tags.map(tag => (
                              <Badge key={tag} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {selectedVulnerability.status === 'open' && (
                        <div className="pt-4 border-t">
                          <Button
                            onClick={() => handleMarkAsFixed(selectedVulnerability.id)}
                            className="w-full"
                            size="sm"
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Marcar como Corregida
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Eye className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">Selecciona una vulnerabilidad para ver detalles</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Vulnerability Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Distribución por Severidad</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={vulnerabilityDistribution}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {vulnerabilityDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Security Radar */}
            <Card>
              <CardHeader>
                <CardTitle>Security Posture</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="metric" />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} />
                    <Radar
                      name="Security Score"
                      dataKey="value"
                      stroke="#3b82f6"
                      fill="#3b82f6"
                      fillOpacity={0.3}
                    />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Type Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Vulnerabilidades por Tipo</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={typeDistribution}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="type" angle={-45} textAnchor="end" height={80} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Security Trend */}
            <Card>
              <CardHeader>
                <CardTitle>Tendencia de Seguridad</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={securityTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="scan" />
                    <YAxis yAxisId="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Line yAxisId="left" type="monotone" dataKey="score" stroke="#10b981" name="Security Score" />
                    <Bar yAxisId="right" dataKey="vulnerabilities" fill="#ef4444" name="Vulnerabilities" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Policies Tab */}
        <TabsContent value="policies" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Políticas de Seguridad</span>
                <Button size="sm">
                  <Settings className="w-4 h-4 mr-2" />
                  Nueva Política
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Default Security Policy</h4>
                      <p className="text-sm text-gray-600">Políticas estándar de seguridad</p>
                      <p className="text-xs text-gray-500 mt-1">2 reglas activas</p>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Badge variant="default">Activa</Badge>
                      <Badge variant="secondary">Bloqueo</Badge>
                    </div>
                  </div>
                </div>

                <div className="text-center py-8 text-gray-500">
                  <Settings className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                  <p>Funcionalidad de políticas en desarrollo</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
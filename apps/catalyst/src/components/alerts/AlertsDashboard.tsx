// ===================================================================
// ARBITRAGEX SUPREME - DASHBOARD DE ALERTAS Y NOTIFICACIONES
// Actividades 46-50: Advanced Alerts Dashboard Interface
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
  Cell
} from 'recharts';
import {
  AlertTriangle,
  Bell,
  Clock,
  CheckCircle,
  XCircle,
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
  Filter,
  Zap,
  Activity,
  Settings,
  Send,
  Users,
  MessageSquare,
  Mail,
  Smartphone,
  Webhook,
  Slack,
  RefreshCw,
  Plus,
  Edit,
  Trash2
} from 'lucide-react';
import {
  alertManager,
  Alert,
  AlertRule,
  NotificationRule,
  AlertSeverity,
  AlertStatus,
  AlertMetrics
} from '@/lib/alerts';

// ============================================================================
// INTERFACES
// ============================================================================

interface AlertFilters {
  severity: AlertSeverity[];
  status: AlertStatus[];
  category: string[];
  source: string[];
  timeRange: string;
}

interface NotificationTest {
  channel: string;
  recipient: string;
  message: string;
  status: 'pending' | 'sent' | 'failed';
  timestamp: number;
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function AlertsDashboard(): JSX.Element {
  // Estados
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [metrics, setMetrics] = useState<AlertMetrics>({
    totalAlerts: 0,
    activeAlerts: 0,
    alertsByCategory: {},
    alertsBySeverity: { info: 0, warning: 0, error: 0, critical: 0 },
    alertsPerMinute: 0,
    avgResolutionTime: 0,
    notificationsSent: 0,
    failedNotifications: 0
  });
  
  const [filters, setFilters] = useState<AlertFilters>({
    severity: [],
    status: [],
    category: [],
    source: [],
    timeRange: '24h'
  });
  
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [testNotifications, setTestNotifications] = useState<NotificationTest[]>([]);

  // ========================================================================
  // EFECTOS
  // ========================================================================

  useEffect(() => {
    // Cargar datos iniciales
    loadAlertsData();
    loadRulesData();
    
    // Event listeners
    const handleAlertCreated = (data: any) => {
      loadAlertsData();
    };

    const handleAlertResolved = (data: any) => {
      loadAlertsData();
    };

    const handleMetricsUpdated = (data: any) => {
      setMetrics(data.metrics);
    };

    alertManager.on('alert:created', handleAlertCreated);
    alertManager.on('alert:resolved', handleAlertResolved);
    alertManager.on('metrics:updated', handleMetricsUpdated);

    // Intervalos de actualización
    const alertsInterval = setInterval(loadAlertsData, 15000);
    const metricsInterval = setInterval(() => {
      setMetrics(alertManager.getMetrics());
    }, 5000);

    // Cleanup
    return () => {
      clearInterval(alertsInterval);
      clearInterval(metricsInterval);
      alertManager.off('alert:created', handleAlertCreated);
      alertManager.off('alert:resolved', handleAlertResolved);
      alertManager.off('metrics:updated', handleMetricsUpdated);
    };
  }, []);

  // Recargar cuando cambien los filtros
  useEffect(() => {
    loadAlertsData();
  }, [filters]);

  // ========================================================================
  // FUNCIONES
  // ========================================================================

  const loadAlertsData = useCallback(() => {
    const alertsData = alertManager.getAlerts({
      status: filters.status.length > 0 ? filters.status : undefined,
      severity: filters.severity.length > 0 ? filters.severity : undefined,
      category: filters.category.length > 0 ? filters.category : undefined,
      source: filters.source.length > 0 ? filters.source : undefined,
      limit: 100
    });
    
    setAlerts(alertsData);
  }, [filters]);

  const loadRulesData = useCallback(() => {
    // En una implementación real, esto cargaría las reglas desde el alertManager
    // Por ahora simulamos datos
    const rulesData: AlertRule[] = [
      {
        id: 'rule_1',
        name: 'High CPU Usage',
        description: 'CPU usage above 80%',
        query: 'cpu_usage > 80',
        condition: {
          type: 'threshold',
          operator: 'gt',
          value: 80,
          missingDataPolicy: 'no_data'
        },
        severity: 'warning',
        evaluationInterval: 30000,
        forDuration: 60000,
        labels: { category: 'system' },
        annotations: {},
        enabled: true,
        silenceAfterResolve: 300000,
        maxAlerts: 10,
        rateLimit: { count: 5, window: 300000 }
      }
    ];
    
    setRules(rulesData);
  }, []);

  const handleResolveAlert = useCallback(async (alertId: string) => {
    try {
      await alertManager.resolveAlert(alertId, 'Manually resolved from dashboard');
      loadAlertsData();
    } catch (error) {
      console.error('Error resolving alert:', error);
    }
  }, [loadAlertsData]);

  const handleSilenceAlert = useCallback(async (alertId: string, duration: number) => {
    try {
      alertManager.silenceAlert(alertId, duration, 'Silenced from dashboard');
      loadAlertsData();
    } catch (error) {
      console.error('Error silencing alert:', error);
    }
  }, [loadAlertsData]);

  const handleTestNotification = useCallback(async (channel: string, recipient: string) => {
    const test: NotificationTest = {
      channel,
      recipient,
      message: 'Test notification from ArbitrageX Supreme',
      status: 'pending',
      timestamp: Date.now()
    };
    
    setTestNotifications(prev => [test, ...prev.slice(0, 9)]);
    
    try {
      // Simular envío de notificación de prueba
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Actualizar estado a enviado
      setTestNotifications(prev => 
        prev.map(t => 
          t.timestamp === test.timestamp 
            ? { ...t, status: 'sent' as const }
            : t
        )
      );
    } catch (error) {
      // Actualizar estado a fallido
      setTestNotifications(prev => 
        prev.map(t => 
          t.timestamp === test.timestamp 
            ? { ...t, status: 'failed' as const }
            : t
        )
      );
    }
  }, []);

  const handleRefreshData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        loadAlertsData(),
        loadRulesData()
      ]);
    } finally {
      setIsRefreshing(false);
    }
  }, [loadAlertsData, loadRulesData]);

  // Funciones de utilidad
  const getSeverityColor = (severity: AlertSeverity): string => {
    switch (severity) {
      case 'critical': return 'text-red-600';
      case 'error': return 'text-red-500';
      case 'warning': return 'text-yellow-600';
      case 'info': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  const getSeverityBadge = (severity: AlertSeverity): 'default' | 'secondary' | 'destructive' => {
    switch (severity) {
      case 'critical':
      case 'error': return 'destructive';
      case 'warning': return 'secondary';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: AlertStatus) => {
    switch (status) {
      case 'active': return <AlertTriangle className="w-4 h-4" />;
      case 'resolved': return <CheckCircle className="w-4 h-4" />;
      case 'silenced': return <VolumeX className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const formatDuration = (ms: number): string => {
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
    if (ms < 86400000) return `${Math.round(ms / 3600000)}h`;
    return `${Math.round(ms / 86400000)}d`;
  };

  // Datos para gráficos
  const severityData = Object.entries(metrics.alertsBySeverity).map(([severity, count]) => ({
    name: severity,
    value: count,
    color: severity === 'critical' ? '#dc2626' : 
           severity === 'error' ? '#ef4444' :
           severity === 'warning' ? '#f59e0b' : '#3b82f6'
  }));

  const categoryData = Object.entries(metrics.alertsByCategory).map(([category, count]) => ({
    category,
    count
  }));

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Alertas y Notificaciones</h2>
          <p className="text-gray-600">Sistema de alertas en tiempo real para ArbitrageX Supreme</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <Button
            onClick={() => setShowFilters(!showFilters)}
            variant="outline"
            size="sm"
          >
            <Filter className="w-4 h-4 mr-2" />
            Filtros
          </Button>
          
          <Button
            onClick={handleRefreshData}
            disabled={isRefreshing}
            size="sm"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Métricas Principales */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Alertas</CardTitle>
            <Bell className="w-4 h-4 text-gray-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalAlerts}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Activas</CardTitle>
            <AlertTriangle className="w-4 h-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{metrics.activeAlerts}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Críticas</CardTitle>
            <Zap className="w-4 h-4 text-red-700" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">{metrics.alertsBySeverity.critical}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolución Promedio</CardTitle>
            <Clock className="w-4 h-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(metrics.avgResolutionTime)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Notificaciones</CardTitle>
            <Send className="w-4 h-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{metrics.notificationsSent}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fallidas</CardTitle>
            <XCircle className="w-4 h-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{metrics.failedNotifications}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle>Filtros de Alertas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-sm font-medium">Severidad</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {(['info', 'warning', 'error', 'critical'] as AlertSeverity[]).map(severity => (
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
                <label className="text-sm font-medium">Estado</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {(['active', 'resolved', 'silenced'] as AlertStatus[]).map(status => (
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

              <div>
                <label className="text-sm font-medium">Rango de Tiempo</label>
                <select 
                  value={filters.timeRange}
                  onChange={(e) => setFilters(prev => ({ ...prev, timeRange: e.target.value }))}
                  className="w-full mt-2 px-3 py-2 border rounded-md"
                >
                  <option value="1h">Última hora</option>
                  <option value="6h">Últimas 6 horas</option>
                  <option value="24h">Último día</option>
                  <option value="7d">Última semana</option>
                  <option value="30d">Último mes</option>
                </select>
              </div>

              <div className="flex items-end">
                <Button
                  onClick={() => setFilters({
                    severity: [],
                    status: [],
                    category: [],
                    source: [],
                    timeRange: '24h'
                  })}
                  variant="outline"
                  size="sm"
                >
                  Limpiar Filtros
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs Container */}
      <Tabs defaultValue="alerts" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="alerts">Alertas</TabsTrigger>
          <TabsTrigger value="rules">Reglas</TabsTrigger>
          <TabsTrigger value="notifications">Notificaciones</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Tab de Alertas */}
        <TabsContent value="alerts" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Lista de Alertas */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Alertas Recientes</span>
                    <Badge variant="secondary">{alerts.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {alerts.length === 0 ? (
                    <div className="text-center py-8">
                      <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
                      <p className="text-gray-500">No hay alertas que mostrar</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {alerts.map((alert) => (
                        <div
                          key={alert.id}
                          className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                            selectedAlert?.id === alert.id
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => setSelectedAlert(alert)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start space-x-3">
                              <div className={getSeverityColor(alert.severity)}>
                                {getStatusIcon(alert.status)}
                              </div>
                              
                              <div className="flex-1">
                                <div className="flex items-center space-x-2">
                                  <h4 className="font-medium">{alert.title}</h4>
                                  <Badge variant={getSeverityBadge(alert.severity)}>
                                    {alert.severity}
                                  </Badge>
                                  {alert.count > 1 && (
                                    <Badge variant="secondary">
                                      {alert.count}x
                                    </Badge>
                                  )}
                                </div>
                                
                                <p className="text-sm text-gray-600 mt-1">
                                  {alert.description}
                                </p>
                                
                                <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                                  <span>{alert.category}</span>
                                  <span>{alert.source}</span>
                                  <span>{new Date(alert.createdAt).toLocaleString()}</span>
                                </div>
                              </div>
                            </div>

                            {alert.status === 'active' && (
                              <div className="flex items-center space-x-2">
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSilenceAlert(alert.id, 3600000); // 1 hora
                                  }}
                                  variant="outline"
                                  size="sm"
                                >
                                  <VolumeX className="w-4 h-4" />
                                </Button>
                                <Button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleResolveAlert(alert.id);
                                  }}
                                  variant="outline"
                                  size="sm"
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Detalles de Alerta Seleccionada */}
            <div>
              <Card>
                <CardHeader>
                  <CardTitle>Detalles de Alerta</CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedAlert ? (
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium">{selectedAlert.title}</h4>
                        <Badge variant={getSeverityBadge(selectedAlert.severity)} className="mt-1">
                          {selectedAlert.severity}
                        </Badge>
                      </div>

                      <div>
                        <p className="text-sm text-gray-600">{selectedAlert.description}</p>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Estado:</span>
                          <span>{selectedAlert.status}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Categoría:</span>
                          <span>{selectedAlert.category}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Fuente:</span>
                          <span>{selectedAlert.source}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Contador:</span>
                          <span>{selectedAlert.count}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Creada:</span>
                          <span>{new Date(selectedAlert.createdAt).toLocaleString()}</span>
                        </div>
                        {selectedAlert.resolvedAt && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Resuelta:</span>
                            <span>{new Date(selectedAlert.resolvedAt).toLocaleString()}</span>
                          </div>
                        )}
                      </div>

                      {selectedAlert.tags.length > 0 && (
                        <div>
                          <p className="text-sm text-gray-500 mb-2">Tags:</p>
                          <div className="flex flex-wrap gap-1">
                            {selectedAlert.tags.map(tag => (
                              <Badge key={tag} variant="outline" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {selectedAlert.status === 'active' && (
                        <div className="space-y-2 pt-4 border-t">
                          <Button
                            onClick={() => handleResolveAlert(selectedAlert.id)}
                            className="w-full"
                            size="sm"
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Resolver Alerta
                          </Button>
                          
                          <Button
                            onClick={() => handleSilenceAlert(selectedAlert.id, 3600000)}
                            variant="outline"
                            className="w-full"
                            size="sm"
                          >
                            <VolumeX className="w-4 h-4 mr-2" />
                            Silenciar 1h
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Eye className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">Selecciona una alerta para ver detalles</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Tab de Reglas */}
        <TabsContent value="rules" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Reglas de Alertas</CardTitle>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Nueva Regla
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {rules.map((rule) => (
                  <div key={rule.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="font-medium">{rule.name}</h4>
                          <Badge variant={rule.enabled ? 'default' : 'secondary'}>
                            {rule.enabled ? 'Activa' : 'Inactiva'}
                          </Badge>
                          <Badge variant={getSeverityBadge(rule.severity)}>
                            {rule.severity}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{rule.description}</p>
                        <p className="text-xs text-gray-500 mt-2">
                          Query: <code className="bg-gray-100 px-1 rounded">{rule.query}</code>
                        </p>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Button variant="outline" size="sm">
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" size="sm">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab de Notificaciones */}
        <TabsContent value="notifications" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Canales de Notificación */}
            <Card>
              <CardHeader>
                <CardTitle>Canales de Notificación</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { name: 'Slack', icon: MessageSquare, enabled: true, endpoint: '#alerts' },
                    { name: 'Email', icon: Mail, enabled: true, endpoint: 'admin@pichichi.com' },
                    { name: 'SMS', icon: Smartphone, enabled: false, endpoint: '+57 300 123 4567' },
                    { name: 'Webhook', icon: Webhook, enabled: true, endpoint: 'https://api.pichichi.com/alerts' },
                  ].map((channel) => (
                    <div key={channel.name} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <channel.icon className={`w-5 h-5 ${channel.enabled ? 'text-green-600' : 'text-gray-400'}`} />
                        <div>
                          <p className="font-medium">{channel.name}</p>
                          <p className="text-sm text-gray-500">{channel.endpoint}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Badge variant={channel.enabled ? 'default' : 'secondary'}>
                          {channel.enabled ? 'Activo' : 'Inactivo'}
                        </Badge>
                        <Button
                          onClick={() => handleTestNotification(channel.name.toLowerCase(), channel.endpoint)}
                          variant="outline"
                          size="sm"
                        >
                          Test
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Historial de Tests */}
            <Card>
              <CardHeader>
                <CardTitle>Historial de Tests</CardTitle>
              </CardHeader>
              <CardContent>
                {testNotifications.length === 0 ? (
                  <div className="text-center py-8">
                    <Send className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No hay tests recientes</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {testNotifications.map((test, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <p className="font-medium">{test.channel}</p>
                          <p className="text-sm text-gray-600">{test.recipient}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(test.timestamp).toLocaleString()}
                          </p>
                        </div>
                        
                        <Badge 
                          variant={
                            test.status === 'sent' ? 'default' :
                            test.status === 'failed' ? 'destructive' : 'secondary'
                          }
                        >
                          {test.status === 'pending' && <RefreshCw className="w-3 h-3 mr-1 animate-spin" />}
                          {test.status === 'sent' && <CheckCircle className="w-3 h-3 mr-1" />}
                          {test.status === 'failed' && <XCircle className="w-3 h-3 mr-1" />}
                          {test.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab de Analytics */}
        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Distribución por Severidad */}
            <Card>
              <CardHeader>
                <CardTitle>Distribución por Severidad</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={severityData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {severityData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Alertas por Categoría */}
            <Card>
              <CardHeader>
                <CardTitle>Alertas por Categoría</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={categoryData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="category" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Métricas de Performance */}
          <Card>
            <CardHeader>
              <CardTitle>Métricas de Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <Activity className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-blue-600">{metrics.alertsPerMinute.toFixed(1)}</p>
                  <p className="text-sm text-gray-600">Alertas/min</p>
                </div>
                
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-green-600">{metrics.notificationsSent}</p>
                  <p className="text-sm text-gray-600">Enviadas</p>
                </div>
                
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <XCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-red-600">{metrics.failedNotifications}</p>
                  <p className="text-sm text-gray-600">Fallidas</p>
                </div>
                
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <Clock className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-purple-600">
                    {formatDuration(metrics.avgResolutionTime)}
                  </p>
                  <p className="text-sm text-gray-600">Resolución Avg</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
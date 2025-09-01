// ===================================================================
// ARBITRAGEX SUPREME - DASHBOARD DE PERFORMANCE
// Actividades 31-35: Interface de Monitoreo de Performance
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
  Activity,
  Zap,
  Database,
  Globe,
  Monitor,
  Cpu,
  HardDrive,
  Network,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Settings,
  RefreshCw
} from 'lucide-react';
import {
  performanceMonitor,
  intelligentCache,
  queryOptimizer,
  PerformanceMetrics,
  CacheStats
} from '@/lib/performance';

// ============================================================================
// INTERFACES
// ============================================================================

interface PerformanceAlert {
  id: string;
  type: 'warning' | 'error' | 'info';
  message: string;
  timestamp: number;
  resolved: boolean;
}

interface SystemHealth {
  overall: number;
  api: number;
  cache: number;
  database: number;
  network: number;
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function PerformanceDashboard(): JSX.Element {
  // Estados
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    apiResponseTime: 0,
    blockchainLatency: 0,
    databaseQueryTime: 0,
    cacheHitRate: 0,
    memoryUsage: 0,
    cpuUsage: 0,
    networkLatency: 0,
    activeConnections: 0
  });

  const [cacheStats, setCacheStats] = useState<CacheStats>({
    hits: 0,
    misses: 0,
    hitRate: 0,
    totalSize: 0,
    entryCount: 0,
    averageResponseTime: 0,
    memoryUsage: 0
  });

  const [alerts, setAlerts] = useState<PerformanceAlert[]>([]);
  const [history, setHistory] = useState<PerformanceMetrics[]>([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(5000);

  // ========================================================================
  // EFECTOS
  // ========================================================================

  useEffect(() => {
    // Inicializar monitoreo
    performanceMonitor.startMonitoring(refreshInterval);
    setIsMonitoring(true);

    // Event listeners
    const handleMetricsUpdate = () => {
      setMetrics(performanceMonitor.getMetrics());
      setHistory(performanceMonitor.getHistory());
    };

    const handleCacheUpdate = () => {
      setCacheStats(intelligentCache.getStats());
    };

    const handleAlert = (alertData: any) => {
      const newAlert: PerformanceAlert = {
        id: Date.now().toString(),
        type: alertData.severity || 'warning',
        message: alertData.message || alertData.ruleName,
        timestamp: alertData.timestamp,
        resolved: false
      };
      setAlerts(prev => [newAlert, ...prev.slice(0, 49)]); // Mantener últimas 50
    };

    // Intervalos de actualización
    const metricsInterval = setInterval(handleMetricsUpdate, 2000);
    const cacheInterval = setInterval(handleCacheUpdate, 3000);

    // Event listeners
    performanceMonitor.on('rule:triggered', handleAlert);
    performanceMonitor.on('metrics:error', handleAlert);
    intelligentCache.on('cache:evicted', handleAlert);

    // Cleanup
    return () => {
      clearInterval(metricsInterval);
      clearInterval(cacheInterval);
      performanceMonitor.off('rule:triggered', handleAlert);
      performanceMonitor.off('metrics:error', handleAlert);
      intelligentCache.off('cache:evicted', handleAlert);
    };
  }, [refreshInterval]);

  // ========================================================================
  // FUNCIONES
  // ========================================================================

  const toggleMonitoring = useCallback(() => {
    if (isMonitoring) {
      performanceMonitor.stopMonitoring();
      setIsMonitoring(false);
    } else {
      performanceMonitor.startMonitoring(refreshInterval);
      setIsMonitoring(true);
    }
  }, [isMonitoring, refreshInterval]);

  const clearCache = useCallback(async () => {
    await intelligentCache.clear();
    setCacheStats(intelligentCache.getStats());
  }, []);

  const resolveAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId ? { ...alert, resolved: true } : alert
    ));
  }, []);

  const calculateSystemHealth = useCallback((): SystemHealth => {
    // Calcular salud general basada en métricas
    const apiHealth = Math.max(0, 100 - (metrics.apiResponseTime / 50)); // 5s = 0%
    const cacheHealth = cacheStats.hitRate * 100;
    const networkHealth = Math.max(0, 100 - (metrics.networkLatency / 10)); // 1s = 0%
    const memoryHealth = Math.max(0, 100 - (metrics.memoryUsage / 10)); // 1GB = 0%
    
    const overall = (apiHealth + cacheHealth + networkHealth + memoryHealth) / 4;

    return {
      overall,
      api: apiHealth,
      cache: cacheHealth,
      database: Math.max(0, 100 - (metrics.databaseQueryTime / 20)), // 2s = 0%
      network: networkHealth
    };
  }, [metrics, cacheStats]);

  const getHealthColor = (value: number): string => {
    if (value >= 80) return 'text-green-600';
    if (value >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getHealthBadgeColor = (value: number): 'default' | 'secondary' | 'destructive' => {
    if (value >= 80) return 'default';
    if (value >= 60) return 'secondary';
    return 'destructive';
  };

  const formatBytes = (bytes: number): string => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Math.round(bytes / Math.pow(1024, i) * 100) / 100} ${sizes[i]}`;
  };

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  // Datos para gráficos
  const systemHealth = calculateSystemHealth();
  const chartData = history.slice(-20).map((point, index) => ({
    time: index,
    api: point.apiResponseTime,
    blockchain: point.blockchainLatency,
    memory: point.memoryUsage,
    cpu: point.cpuUsage,
    network: point.networkLatency
  }));

  const pieData = [
    { name: 'Cache Hits', value: cacheStats.hits, color: '#10b981' },
    { name: 'Cache Misses', value: cacheStats.misses, color: '#ef4444' }
  ];

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Performance Dashboard</h2>
          <p className="text-gray-600">Monitoreo en tiempo real del sistema ArbitrageX Supreme</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <select 
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(Number(e.target.value))}
            className="px-3 py-2 border rounded-md"
          >
            <option value={1000}>1s</option>
            <option value={2000}>2s</option>
            <option value={5000}>5s</option>
            <option value={10000}>10s</option>
          </select>
          
          <Button
            onClick={toggleMonitoring}
            variant={isMonitoring ? "destructive" : "default"}
            size="sm"
          >
            {isMonitoring ? (
              <>
                <XCircle className="w-4 h-4 mr-2" />
                Detener
              </>
            ) : (
              <>
                <Activity className="w-4 h-4 mr-2" />
                Iniciar
              </>
            )}
          </Button>
        </div>
      </div>

      {/* System Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Salud General</CardTitle>
            <Monitor className={`w-4 h-4 ${getHealthColor(systemHealth.overall)}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemHealth.overall.toFixed(1)}%</div>
            <Progress value={systemHealth.overall} className="mt-2" />
            <Badge variant={getHealthBadgeColor(systemHealth.overall)} className="mt-2">
              {systemHealth.overall >= 80 ? 'Excelente' : 
               systemHealth.overall >= 60 ? 'Buena' : 'Crítica'}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">API</CardTitle>
            <Globe className={`w-4 h-4 ${getHealthColor(systemHealth.api)}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemHealth.api.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatDuration(metrics.apiResponseTime)}
            </p>
            <Progress value={systemHealth.api} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cache</CardTitle>
            <Zap className={`w-4 h-4 ${getHealthColor(systemHealth.cache)}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemHealth.cache.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {cacheStats.hits + cacheStats.misses} requests
            </p>
            <Progress value={systemHealth.cache} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Database</CardTitle>
            <Database className={`w-4 h-4 ${getHealthColor(systemHealth.database)}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemHealth.database.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatDuration(metrics.databaseQueryTime)}
            </p>
            <Progress value={systemHealth.database} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Red</CardTitle>
            <Network className={`w-4 h-4 ${getHealthColor(systemHealth.network)}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemHealth.network.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatDuration(metrics.networkLatency)}
            </p>
            <Progress value={systemHealth.network} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Tabs Container */}
      <Tabs defaultValue="metrics" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="metrics">Métricas</TabsTrigger>
          <TabsTrigger value="cache">Cache</TabsTrigger>
          <TabsTrigger value="alerts">Alertas</TabsTrigger>
          <TabsTrigger value="optimization">Optimización</TabsTrigger>
        </TabsList>

        {/* Métricas Tab */}
        <TabsContent value="metrics" className="space-y-6">
          {/* Live Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
                <Cpu className="w-4 h-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.cpuUsage.toFixed(1)}%</div>
                <Progress value={metrics.cpuUsage} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Memory</CardTitle>
                <HardDrive className="w-4 h-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatBytes(metrics.memoryUsage * 1024 * 1024)}</div>
                <Progress value={(metrics.memoryUsage / 1024) * 100} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Connections</CardTitle>
                <Network className="w-4 h-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.activeConnections}</div>
                <p className="text-xs text-muted-foreground mt-1">Conexiones activas</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Blockchain</CardTitle>
                <Clock className="w-4 h-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatDuration(metrics.blockchainLatency)}</div>
                <p className="text-xs text-muted-foreground mt-1">Latencia promedio</p>
              </CardContent>
            </Card>
          </div>

          {/* Performance Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Response Times</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="api" stroke="#3b82f6" name="API" />
                    <Line type="monotone" dataKey="blockchain" stroke="#ef4444" name="Blockchain" />
                    <Line type="monotone" dataKey="network" stroke="#10b981" name="Network" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Resource Usage</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="memory" stackId="1" stroke="#8b5cf6" fill="#8b5cf6" name="Memory (MB)" />
                    <Area type="monotone" dataKey="cpu" stackId="1" stroke="#f59e0b" fill="#f59e0b" name="CPU %" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Cache Tab */}
        <TabsContent value="cache" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Hit Rate</CardTitle>
                <TrendingUp className="w-4 h-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(cacheStats.hitRate * 100).toFixed(1)}%</div>
                <Progress value={cacheStats.hitRate * 100} className="mt-2" />
                <p className="text-xs text-muted-foreground mt-2">
                  {cacheStats.hits} hits / {cacheStats.misses} misses
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cache Size</CardTitle>
                <HardDrive className="w-4 h-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatBytes(cacheStats.totalSize)}</div>
                <p className="text-xs text-muted-foreground mt-2">
                  {cacheStats.entryCount} entries
                </p>
                <Button onClick={clearCache} variant="outline" size="sm" className="mt-2">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Clear Cache
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Response</CardTitle>
                <Clock className="w-4 h-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatDuration(cacheStats.averageResponseTime)}</div>
              </CardContent>
            </Card>
          </div>

          {/* Cache Hit/Miss Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Cache Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>

                <div className="flex flex-col justify-center space-y-4">
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center">
                      <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                      <span className="font-medium">Cache Hits</span>
                    </div>
                    <span className="text-xl font-bold text-green-600">{cacheStats.hits}</span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <div className="flex items-center">
                      <XCircle className="w-5 h-5 text-red-600 mr-2" />
                      <span className="font-medium">Cache Misses</span>
                    </div>
                    <span className="text-xl font-bold text-red-600">{cacheStats.misses}</span>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center">
                      <BarChart3 className="w-5 h-5 text-blue-600 mr-2" />
                      <span className="font-medium">Total Requests</span>
                    </div>
                    <span className="text-xl font-bold text-blue-600">
                      {cacheStats.hits + cacheStats.misses}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Alerts Tab */}
        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <AlertTriangle className="w-5 h-5 mr-2" />
                System Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              {alerts.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
                  <p className="text-gray-500">No hay alertas activas</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {alerts.slice(0, 20).map((alert) => (
                    <div
                      key={alert.id}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        alert.resolved 
                          ? 'bg-gray-50 border-gray-200' 
                          : alert.type === 'error' 
                          ? 'bg-red-50 border-red-200'
                          : alert.type === 'warning'
                          ? 'bg-yellow-50 border-yellow-200'
                          : 'bg-blue-50 border-blue-200'
                      }`}
                    >
                      <div className="flex items-center">
                        {alert.type === 'error' && <XCircle className="w-5 h-5 text-red-600 mr-2" />}
                        {alert.type === 'warning' && <AlertTriangle className="w-5 h-5 text-yellow-600 mr-2" />}
                        {alert.type === 'info' && <CheckCircle className="w-5 h-5 text-blue-600 mr-2" />}
                        
                        <div>
                          <p className={`font-medium ${alert.resolved ? 'line-through text-gray-500' : ''}`}>
                            {alert.message}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(alert.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {!alert.resolved && (
                        <Button
                          onClick={() => resolveAlert(alert.id)}
                          variant="outline"
                          size="sm"
                        >
                          Resolver
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Optimization Tab */}
        <TabsContent value="optimization" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Settings className="w-5 h-5 mr-2" />
                Query Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Array.from(queryOptimizer.getQueryStats().entries()).map(([queryKey, stats]) => (
                  <div key={queryKey} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">{queryKey}</p>
                      <p className="text-sm text-gray-500">
                        {stats.count} executions • Avg: {formatDuration(stats.avgTime)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">{formatDuration(stats.totalTime)}</p>
                      <p className="text-xs text-gray-500">Total time</p>
                    </div>
                  </div>
                ))}
                
                {queryOptimizer.getQueryStats().size === 0 && (
                  <div className="text-center py-8">
                    <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">No hay datos de queries disponibles</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
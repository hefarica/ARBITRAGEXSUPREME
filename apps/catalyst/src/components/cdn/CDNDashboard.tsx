// ===================================================================
// ARBITRAGEX SUPREME - DASHBOARD CDN Y DISTRIBUCIÓN GLOBAL
// Actividades 36-40: CDN Management Interface
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
  ComposedChart
} from 'recharts';
import {
  Globe,
  Zap,
  HardDrive,
  Network,
  Clock,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Activity,
  Server,
  Shield,
  Trash2,
  Download,
  Upload,
  Eye,
  MapPin,
  BarChart3,
  Settings
} from 'lucide-react';
import {
  globalCDN,
  edgeCache,
  CDNMetrics,
  CDNRegion
} from '@/lib/cdn';

// ============================================================================
// INTERFACES
// ============================================================================

interface GeolocationData {
  country: string;
  city: string;
  lat: number;
  lng: number;
}

interface CacheOperation {
  id: string;
  type: 'purge' | 'invalidate' | 'preload';
  patterns: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  timestamp: number;
  result?: { success: boolean; count: number };
}

// ============================================================================
// COMPONENTE PRINCIPAL
// ============================================================================

export default function CDNDashboard(): JSX.Element {
  // Estados
  const [metrics, setMetrics] = useState<CDNMetrics>({
    requests: 0,
    bandwidth: 0,
    cacheHitRate: 0,
    errorRate: 0,
    avgLatency: 0,
    availability: 100,
    topPaths: [],
    topCountries: []
  });

  const [regions, setRegions] = useState<CDNRegion[]>([]);
  const [cacheOperations, setCacheOperations] = useState<CacheOperation[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [userLocation, setUserLocation] = useState<GeolocationData | null>(null);
  const [purgePattern, setPurgePattern] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ========================================================================
  // EFECTOS
  // ========================================================================

  useEffect(() => {
    // Inicializar datos
    loadInitialData();
    
    // Event listeners para CDN
    const handleMetricsUpdate = (data: any) => {
      setMetrics(data.metrics);
    };

    const handleRegionUpdate = (data: any) => {
      loadRegionsData();
    };

    const handleCachePurged = (data: any) => {
      const operation: CacheOperation = {
        id: Date.now().toString(),
        type: 'purge',
        patterns: data.patterns,
        status: 'completed',
        timestamp: data.timestamp,
        result: { success: true, count: data.purged }
      };
      setCacheOperations(prev => [operation, ...prev.slice(0, 19)]);
    };

    globalCDN.on('metrics:updated', handleMetricsUpdate);
    globalCDN.on('region:updated', handleRegionUpdate);
    globalCDN.on('cache:purged', handleCachePurged);

    // Intervalos de actualización
    const metricsInterval = setInterval(loadMetricsData, 5000);
    const regionsInterval = setInterval(loadRegionsData, 10000);

    // Obtener geolocalización del usuario
    getUserLocation();

    // Cleanup
    return () => {
      clearInterval(metricsInterval);
      clearInterval(regionsInterval);
      globalCDN.off('metrics:updated', handleMetricsUpdate);
      globalCDN.off('region:updated', handleRegionUpdate);
      globalCDN.off('cache:purged', handleCachePurged);
    };
  }, []);

  // ========================================================================
  // FUNCIONES
  // ========================================================================

  const loadInitialData = useCallback(async () => {
    await Promise.all([
      loadMetricsData(),
      loadRegionsData()
    ]);
  }, []);

  const loadMetricsData = useCallback(async () => {
    try {
      const cdnMetrics = globalCDN.getMetrics();
      setMetrics(cdnMetrics);
    } catch (error) {
      console.error('Error loading CDN metrics:', error);
    }
  }, []);

  const loadRegionsData = useCallback(async () => {
    try {
      const regionsData = globalCDN.getRegionStats();
      setRegions(regionsData);
      
      if (!selectedRegion && regionsData.length > 0) {
        setSelectedRegion(regionsData[0].id);
      }
    } catch (error) {
      console.error('Error loading regions data:', error);
    }
  }, [selectedRegion]);

  const getUserLocation = useCallback(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          // En producción, esto llamaría a un servicio de geolocalización inversa
          const mockLocation: GeolocationData = {
            country: 'US',
            city: 'New York',
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setUserLocation(mockLocation);
          
          // Obtener región óptima
          const optimalRegion = await globalCDN.getOptimalRegion({
            lat: mockLocation.lat,
            lng: mockLocation.lng
          });
          setSelectedRegion(optimalRegion.id);
        },
        () => {
          // Fallback a ubicación por defecto
          setUserLocation({
            country: 'US',
            city: 'Unknown',
            lat: 40.7128,
            lng: -74.0060
          });
        }
      );
    }
  }, []);

  const handlePurgeCache = useCallback(async () => {
    if (!purgePattern.trim()) return;

    const operation: CacheOperation = {
      id: Date.now().toString(),
      type: 'purge',
      patterns: [purgePattern],
      status: 'running',
      timestamp: Date.now()
    };

    setCacheOperations(prev => [operation, ...prev]);

    try {
      const result = await globalCDN.purgeCache([purgePattern]);
      
      setCacheOperations(prev => prev.map(op =>
        op.id === operation.id
          ? { ...op, status: 'completed', result }
          : op
      ));

      setPurgePattern('');
    } catch (error) {
      setCacheOperations(prev => prev.map(op =>
        op.id === operation.id
          ? { ...op, status: 'failed', result: { success: false, count: 0 } }
          : op
      ));
    }
  }, [purgePattern]);

  const handleRefreshData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadInitialData();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadInitialData]);

  const getRegionStatusColor = (status: string): string => {
    switch (status) {
      case 'active': return 'text-green-600';
      case 'maintenance': return 'text-yellow-600';
      case 'offline': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getRegionStatusBadge = (status: string): 'default' | 'secondary' | 'destructive' => {
    switch (status) {
      case 'active': return 'default';
      case 'maintenance': return 'secondary';
      case 'offline': return 'destructive';
      default: return 'secondary';
    }
  };

  const formatBytes = (bytes: number): string => {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Math.round(bytes / Math.pow(1024, i) * 100) / 100} ${sizes[i]}`;
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  // Datos para gráficos
  const selectedRegionData = regions.find(r => r.id === selectedRegion);
  const healthReport = globalCDN.getHealthReport();

  const regionChartData = regions.map(region => ({
    name: region.name.split('(')[0].trim(),
    latency: region.latency,
    load: region.load,
    status: region.status === 'active' ? 1 : 0
  }));

  const trafficData = metrics.topPaths.map((path, index) => ({
    path: path.path.length > 20 ? `${path.path.substring(0, 20)}...` : path.path,
    requests: path.requests,
    percentage: (path.requests / metrics.requests) * 100
  }));

  const geoData = metrics.topCountries.map(country => ({
    country: country.country,
    requests: country.requests,
    percentage: (country.requests / metrics.requests) * 100
  }));

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">CDN Dashboard</h2>
          <p className="text-gray-600">Gestión global de distribución de contenido</p>
          {userLocation && (
            <p className="text-sm text-gray-500">
              <MapPin className="w-4 h-4 inline mr-1" />
              Tu ubicación: {userLocation.city}, {userLocation.country}
            </p>
          )}
        </div>
        
        <Button
          onClick={handleRefreshData}
          disabled={isRefreshing}
          size="sm"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Actualizar
        </Button>
      </div>

      {/* Métricas generales */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Requests</CardTitle>
            <Activity className="w-4 h-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(metrics.requests)}</div>
            <p className="text-xs text-muted-foreground">Total requests</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bandwidth</CardTitle>
            <Download className="w-4 h-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBytes(metrics.bandwidth)}</div>
            <p className="text-xs text-muted-foreground">Total transferido</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cache Hit Rate</CardTitle>
            <Zap className="w-4 h-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(metrics.cacheHitRate * 100).toFixed(1)}%</div>
            <Progress value={metrics.cacheHitRate * 100} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Latency</CardTitle>
            <Clock className="w-4 h-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.avgLatency.toFixed(0)}ms</div>
            <p className="text-xs text-muted-foreground">Promedio global</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Availability</CardTitle>
            <CheckCircle className="w-4 h-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.availability.toFixed(1)}%</div>
            <Progress value={metrics.availability} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Tabs Container */}
      <Tabs defaultValue="regions" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="regions">Regiones</TabsTrigger>
          <TabsTrigger value="cache">Cache Management</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="security">Seguridad</TabsTrigger>
        </TabsList>

        {/* Regiones Tab */}
        <TabsContent value="regions" className="space-y-6">
          {/* Selector de región */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Globe className="w-5 h-5 mr-2" />
                Regiones CDN
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Lista de regiones */}
                <div className="space-y-3">
                  {regions.map((region) => (
                    <div
                      key={region.id}
                      className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                        selectedRegion === region.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => setSelectedRegion(region.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{region.name}</h4>
                          <p className="text-sm text-gray-500">
                            {region.location.city}, {region.location.country}
                          </p>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          <Badge variant={getRegionStatusBadge(region.status)}>
                            {region.status}
                          </Badge>
                          <div className="text-right">
                            <p className="text-sm font-medium">{region.latency}ms</p>
                            <p className="text-xs text-gray-500">{region.load}% load</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>Load</span>
                          <span>{region.load}%</span>
                        </div>
                        <Progress value={region.load} className="h-2" />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Detalles de región seleccionada */}
                <div>
                  {selectedRegionData && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">{selectedRegionData.name}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-gray-500">Estado</p>
                            <Badge variant={getRegionStatusBadge(selectedRegionData.status)}>
                              {selectedRegionData.status}
                            </Badge>
                          </div>
                          
                          <div>
                            <p className="text-sm text-gray-500">Latencia</p>
                            <p className="font-medium">{selectedRegionData.latency}ms</p>
                          </div>
                          
                          <div>
                            <p className="text-sm text-gray-500">Capacidad</p>
                            <p className="font-medium">{formatNumber(selectedRegionData.capacity)} req/s</p>
                          </div>
                          
                          <div>
                            <p className="text-sm text-gray-500">Carga actual</p>
                            <p className="font-medium">{selectedRegionData.load}%</p>
                          </div>
                        </div>

                        <div>
                          <p className="text-sm text-gray-500 mb-2">Endpoint</p>
                          <code className="text-xs bg-gray-100 p-2 rounded block">
                            {selectedRegionData.endpoint}
                          </code>
                        </div>

                        <div>
                          <p className="text-sm text-gray-500 mb-2">Ubicación</p>
                          <p className="text-sm">
                            {selectedRegionData.location.city}, {selectedRegionData.location.country}
                            <br />
                            <span className="text-xs text-gray-400">
                              {selectedRegionData.location.lat}, {selectedRegionData.location.lng}
                            </span>
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Gráfico de performance por región */}
          <Card>
            <CardHeader>
              <CardTitle>Performance por Región</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <ComposedChart data={regionChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Bar yAxisId="left" dataKey="latency" fill="#3b82f6" name="Latencia (ms)" />
                  <Line yAxisId="right" type="monotone" dataKey="load" stroke="#ef4444" name="Carga (%)" />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cache Management Tab */}
        <TabsContent value="cache" className="space-y-6">
          {/* Controles de cache */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Trash2 className="w-5 h-5 mr-2" />
                Cache Management
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-4">
                <input
                  type="text"
                  value={purgePattern}
                  onChange={(e) => setPurgePattern(e.target.value)}
                  placeholder="Ej: /assets/*, *.css, /api/users/*"
                  className="flex-1 px-3 py-2 border rounded-md"
                />
                <Button onClick={handlePurgeCache} disabled={!purgePattern.trim()}>
                  Purgar Cache
                </Button>
              </div>
              
              <div className="mt-4 text-sm text-gray-600">
                <p>Patrones soportados:</p>
                <ul className="list-disc list-inside mt-2">
                  <li><code>/assets/*</code> - Todos los archivos en /assets/</li>
                  <li><code>*.css</code> - Todos los archivos CSS</li>
                  <li><code>/api/users/*</code> - Todas las rutas de usuarios API</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Historial de operaciones */}
          <Card>
            <CardHeader>
              <CardTitle>Historial de Operaciones</CardTitle>
            </CardHeader>
            <CardContent>
              {cacheOperations.length === 0 ? (
                <div className="text-center py-8">
                  <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">No hay operaciones recientes</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cacheOperations.slice(0, 10).map((operation) => (
                    <div
                      key={operation.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center">
                        {operation.status === 'completed' && <CheckCircle className="w-5 h-5 text-green-600 mr-2" />}
                        {operation.status === 'failed' && <XCircle className="w-5 h-5 text-red-600 mr-2" />}
                        {operation.status === 'running' && <RefreshCw className="w-5 h-5 text-blue-600 mr-2 animate-spin" />}
                        
                        <div>
                          <p className="font-medium capitalize">{operation.type}</p>
                          <p className="text-sm text-gray-500">
                            {operation.patterns.join(', ')}
                          </p>
                          <p className="text-xs text-gray-400">
                            {new Date(operation.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      
                      {operation.result && (
                        <div className="text-right">
                          <p className="text-sm font-medium">
                            {operation.result.count} items
                          </p>
                          <Badge variant={operation.result.success ? 'default' : 'destructive'}>
                            {operation.result.success ? 'Éxito' : 'Error'}
                          </Badge>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Paths */}
            <Card>
              <CardHeader>
                <CardTitle>Top Paths</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={trafficData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="path" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="requests" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Geographic Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Distribución Geográfica</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={geoData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="requests"
                      label={({ country, percentage }) => `${country}: ${percentage.toFixed(1)}%`}
                    >
                      {geoData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={`hsl(${index * 45}, 70%, 60%)`} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Cache Performance */}
          <Card>
            <CardHeader>
              <CardTitle>Cache Performance Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {(metrics.cacheHitRate * 100).toFixed(1)}%
                  </p>
                  <p className="text-sm text-gray-500">Hit Rate</p>
                </div>
                
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">
                    {metrics.avgLatency.toFixed(0)}ms
                  </p>
                  <p className="text-sm text-gray-500">Avg Latency</p>
                </div>
                
                <div className="text-center">
                  <p className="text-2xl font-bold text-purple-600">
                    {formatBytes(metrics.bandwidth)}
                  </p>
                  <p className="text-sm text-gray-500">Bandwidth</p>
                </div>
                
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-600">
                    {(metrics.errorRate * 100).toFixed(2)}%
                  </p>
                  <p className="text-sm text-gray-500">Error Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shield className="w-5 h-5 mr-2" />
                Security Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                  <p className="font-medium">SSL/TLS</p>
                  <p className="text-sm text-gray-600">Activo en todas las regiones</p>
                </div>
                
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <Shield className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                  <p className="font-medium">WAF</p>
                  <p className="text-sm text-gray-600">Protección activa</p>
                </div>
                
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <Network className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                  <p className="font-medium">DDoS Protection</p>
                  <p className="text-sm text-gray-600">Monitoreo automático</p>
                </div>
              </div>
              
              <div className="mt-6">
                <h4 className="font-medium mb-3">System Health Score</h4>
                <div className="flex items-center justify-between">
                  <Progress value={healthReport.overall} className="flex-1 mr-4" />
                  <span className="text-2xl font-bold">{healthReport.overall}%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
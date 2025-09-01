/**
 * ArbitrageX Supreme - Dashboard de Análisis Avanzado
 * Ingenio Pichichi S.A. - Actividades 13-20
 * 
 * Panel avanzado con ML, optimización y análisis predictivo
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Brain, 
  TrendingUp, 
  Zap, 
  Target, 
  BarChart3, 
  LineChart, 
  Settings, 
  AlertTriangle,
  CheckCircle,
  Clock,
  Cpu,
  Activity,
  RefreshCw,
  Play,
  Pause,
  Maximize
} from 'lucide-react'
import { useArbitrageMonitoring } from '@/lib/monitoring'
import { marketAnalyzer } from '@/lib/analytics'
import { strategyOptimizer } from '@/lib/optimizer'
import { toast } from 'sonner'

// Types para el componente
interface AnalyticsData {
  patterns: {
    detected: string[]
    confidence: number
    predictions: any[]
  }
  optimization: {
    running: boolean
    progress: number
    bestScore: number
    iterations: number
  }
  performance: {
    avgLatency: number
    avgThroughput: number
    avgErrorRate: number
    totalOpportunities: number
    totalProfit: number
  }
}

export const AdvancedAnalytics = () => {
  const { metrics, alerts, systemHealth, acknowledgeAlert, getPerformanceStats } = useArbitrageMonitoring()
  
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData>({
    patterns: { detected: [], confidence: 0, predictions: [] },
    optimization: { running: false, progress: 0, bestScore: 0, iterations: 0 },
    performance: { avgLatency: 0, avgThroughput: 0, avgErrorRate: 0, totalOpportunities: 0, totalProfit: 0 }
  })
  
  const [selectedStrategy, setSelectedStrategy] = useState('INTRA_DEX')
  const [optimizationHistory, setOptimizationHistory] = useState<any[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [autoOptimization, setAutoOptimization] = useState(false)

  // ============================================
  // DATA FETCHING & ANALYSIS
  // ============================================

  const runPatternAnalysis = useCallback(async () => {
    if (isAnalyzing) return
    
    setIsAnalyzing(true)
    try {
      // Simular datos de mercado para análisis
      const mockMarketData = Array.from({ length: 100 }, (_, i) => ({
        timestamp: Date.now() - (i * 60000),
        tokenPair: 'ETH/USDC',
        price: 2000 + Math.random() * 200 - 100,
        volume: Math.random() * 10000000 + 1000000,
        liquidity: Math.random() * 50000000 + 10000000,
        volatility: Math.random() * 0.1 + 0.01,
        gasPrice: Math.random() * 50 + 20
      }))

      // Añadir datos al analizador
      marketAnalyzer.addMarketData(mockMarketData)
      
      // Ejecutar análisis de patrones
      const patterns = marketAnalyzer.analyzePatterns()
      
      setAnalyticsData(prev => ({
        ...prev,
        patterns: {
          detected: patterns.detectedPatterns,
          confidence: patterns.confidence,
          predictions: patterns.predictions
        }
      }))

      toast.success(`Análisis completado: ${patterns.detectedPatterns.length} patrones detectados`)
    } catch (error) {
      console.error('Error en análisis:', error)
      toast.error('Error en análisis de patrones')
    } finally {
      setIsAnalyzing(false)
    }
  }, [isAnalyzing])

  const runOptimization = useCallback(async (strategyId: string) => {
    try {
      setAnalyticsData(prev => ({
        ...prev,
        optimization: { ...prev.optimization, running: true, progress: 0 }
      }))

      toast.info(`Iniciando optimización de ${strategyId}...`)

      // Configurar targets de optimización
      const targets = [
        { metric: 'netProfit' as const, weight: 0.4 },
        { metric: 'successRate' as const, weight: 0.3 },
        { metric: 'sharpeRatio' as const, weight: 0.3 }
      ]

      // Simular progreso de optimización
      const progressInterval = setInterval(() => {
        setAnalyticsData(prev => ({
          ...prev,
          optimization: {
            ...prev.optimization,
            progress: Math.min(100, prev.optimization.progress + Math.random() * 10 + 5)
          }
        }))
      }, 500)

      // Ejecutar optimización
      const result = await strategyOptimizer.optimizeStrategy(strategyId, targets, {
        populationSize: 30,
        generations: 50,
        mutationRate: 0.1
      })

      clearInterval(progressInterval)

      setAnalyticsData(prev => ({
        ...prev,
        optimization: {
          running: false,
          progress: 100,
          bestScore: result.score,
          iterations: result.iterations
        }
      }))

      // Actualizar historial
      setOptimizationHistory(prev => [result, ...prev.slice(0, 9)])

      toast.success(`Optimización completada! Score: ${result.score.toFixed(4)}`)
    } catch (error) {
      console.error('Error en optimización:', error)
      toast.error('Error en optimización de estrategia')
      
      setAnalyticsData(prev => ({
        ...prev,
        optimization: { ...prev.optimization, running: false }
      }))
    }
  }, [])

  const runBacktest = useCallback(async (strategyId: string) => {
    try {
      toast.info('Ejecutando backtest...')
      
      const endTime = Date.now()
      const startTime = endTime - (7 * 24 * 60 * 60 * 1000) // 7 días

      const result = marketAnalyzer.backtest(strategyId, startTime, endTime)
      
      toast.success(`Backtest completado: ${result.successRate.toFixed(1)}% éxito, ${result.netProfit.toFixed(0)} profit`)
      
      return result
    } catch (error) {
      console.error('Error en backtest:', error)
      toast.error('Error ejecutando backtest')
    }
  }, [])

  // ============================================
  // EFFECTS
  // ============================================

  useEffect(() => {
    // Actualizar estadísticas de rendimiento
    if (metrics) {
      const perfStats = getPerformanceStats()
      setAnalyticsData(prev => ({
        ...prev,
        performance: perfStats
      }))
    }
  }, [metrics, getPerformanceStats])

  useEffect(() => {
    // Auto-análisis cada 2 minutos si está habilitado
    if (autoOptimization) {
      const interval = setInterval(() => {
        runPatternAnalysis()
      }, 120000) // 2 minutos

      return () => clearInterval(interval)
    }
  }, [autoOptimization, runPatternAnalysis])

  // ============================================
  // RENDER HELPERS
  // ============================================

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-500'
    if (confidence >= 60) return 'text-yellow-500'
    return 'text-red-500'
  }

  const getPatternBadgeColor = (pattern: string) => {
    switch (pattern) {
      case 'high-volatility-arbitrage': return 'bg-red-600'
      case 'low-gas-opportunity': return 'bg-green-600'
      case 'dex-imbalance': return 'bg-blue-600'
      default: return 'bg-gray-600'
    }
  }

  const formatPatternName = (pattern: string) => {
    const names = {
      'high-volatility-arbitrage': 'Alta Volatilidad',
      'low-gas-opportunity': 'Gas Bajo',
      'dex-imbalance': 'Desequilibrio DEX'
    }
    return names[pattern as keyof typeof names] || pattern
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="space-y-6">
      {/* Header de Control */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Análisis Avanzado</h2>
          <p className="text-gray-600">
            Machine Learning • Optimización • Análisis Predictivo
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoOptimization(!autoOptimization)}
          >
            {autoOptimization ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
            Auto-Análisis {autoOptimization ? 'ON' : 'OFF'}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={runPatternAnalysis}
            disabled={isAnalyzing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isAnalyzing ? 'animate-spin' : ''}`} />
            Analizar
          </Button>
        </div>
      </div>

      {/* Métricas de Performance */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Latencia Promedio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analyticsData.performance.avgLatency.toFixed(0)}ms
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Throughput
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analyticsData.performance.avgThroughput.toFixed(1)} TPS
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Tasa de Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analyticsData.performance.avgErrorRate.toFixed(2)}%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Target className="h-4 w-4" />
              Oportunidades
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {analyticsData.performance.totalOpportunities}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Profit Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${analyticsData.performance.totalProfit.toFixed(0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs Principales */}
      <Tabs defaultValue="patterns" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="patterns">Patrones ML</TabsTrigger>
          <TabsTrigger value="optimization">Optimización</TabsTrigger>
          <TabsTrigger value="predictions">Predicciones</TabsTrigger>
          <TabsTrigger value="backtesting">Backtesting</TabsTrigger>
        </TabsList>

        {/* Tab: Análisis de Patrones */}
        <TabsContent value="patterns" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  Patrones Detectados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Confianza General:</span>
                    <span className={`font-bold ${getConfidenceColor(analyticsData.patterns.confidence)}`}>
                      {analyticsData.patterns.confidence.toFixed(1)}%
                    </span>
                  </div>
                  
                  <Progress value={analyticsData.patterns.confidence} />
                  
                  <div className="space-y-2">
                    {analyticsData.patterns.detected.length > 0 ? (
                      analyticsData.patterns.detected.map((pattern, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <span className="text-sm">{formatPatternName(pattern)}</span>
                          <Badge className={getPatternBadgeColor(pattern)}>
                            Detectado
                          </Badge>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 text-center py-4">
                        No hay patrones detectados. Ejecuta análisis para buscar oportunidades.
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LineChart className="h-5 w-5" />
                  Predicciones Activas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analyticsData.patterns.predictions.length > 0 ? (
                    analyticsData.patterns.predictions.slice(0, 4).map((prediction, index) => (
                      <div key={index} className="p-3 border rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-semibold text-sm">{prediction.strategy}</p>
                            <p className="text-xs text-gray-600">{prediction.tokenPair}</p>
                          </div>
                          <Badge 
                            variant={prediction.confidence > 70 ? "default" : "secondary"}
                          >
                            {prediction.confidence.toFixed(0)}%
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-gray-600">Profit:</span>
                            <span className="ml-1 font-medium text-green-600">
                              ${prediction.predictedProfit.toFixed(0)}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-600">Tiempo:</span>
                            <span className="ml-1 font-medium">
                              {prediction.predictedExecutionTime.toFixed(0)}s
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-center py-4">
                      No hay predicciones disponibles
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab: Optimización */}
        <TabsContent value="optimization" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Control de Optimización
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Estrategia a Optimizar:
                  </label>
                  <select 
                    value={selectedStrategy}
                    onChange={(e) => setSelectedStrategy(e.target.value)}
                    className="w-full p-2 border rounded"
                  >
                    <option value="INTRA_DEX">Arbitraje Intra-DEX</option>
                    <option value="INTER_DEX">Arbitraje Inter-DEX</option>
                    <option value="FLASH_LOAN">Flash Loan Arbitrage</option>
                  </select>
                </div>

                {analyticsData.optimization.running ? (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progreso de Optimización:</span>
                      <span>{analyticsData.optimization.progress.toFixed(0)}%</span>
                    </div>
                    <Progress value={analyticsData.optimization.progress} />
                  </div>
                ) : (
                  <Button 
                    onClick={() => runOptimization(selectedStrategy)}
                    className="w-full"
                  >
                    <Cpu className="h-4 w-4 mr-2" />
                    Iniciar Optimización
                  </Button>
                )}

                {analyticsData.optimization.bestScore > 0 && (
                  <div className="p-3 bg-green-50 rounded-lg">
                    <p className="text-sm font-medium text-green-800">
                      Mejor Score: {analyticsData.optimization.bestScore.toFixed(4)}
                    </p>
                    <p className="text-xs text-green-600">
                      {analyticsData.optimization.iterations} iteraciones
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Historial de Optimización
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {optimizationHistory.length > 0 ? (
                    optimizationHistory.map((result, index) => (
                      <div key={index} className="p-2 border rounded text-sm">
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{result.strategyId}</span>
                          <Badge variant="outline">
                            Score: {result.score.toFixed(4)}
                          </Badge>
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          {result.improvements.length} parámetros optimizados
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-center py-4">
                      No hay historial de optimización
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab: Predicciones */}
        <TabsContent value="predictions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Predicciones Detalladas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {analyticsData.patterns.predictions.map((prediction, index) => (
                  <div key={index} className="p-4 border rounded-lg">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-semibold">{prediction.tokenPair}</h4>
                        <p className="text-sm text-gray-600">Estrategia: {prediction.strategy}</p>
                      </div>
                      <div className="text-right">
                        <Badge 
                          variant={prediction.confidence > 80 ? "default" : 
                                   prediction.confidence > 60 ? "secondary" : "outline"}
                        >
                          {prediction.confidence.toFixed(0)}% confianza
                        </Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Profit Estimado</p>
                        <p className="font-bold text-green-600">
                          ${prediction.predictedProfit.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Tiempo Ejecución</p>
                        <p className="font-bold">
                          {prediction.predictedExecutionTime.toFixed(1)}s
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Score de Riesgo</p>
                        <p className={`font-bold ${
                          prediction.riskScore <= 3 ? 'text-green-600' :
                          prediction.riskScore <= 6 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {prediction.riskScore.toFixed(1)}/10
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-600">Factores Clave</p>
                        <p className="font-bold">
                          {prediction.factors?.length || 0} factores
                        </p>
                      </div>
                    </div>

                    {prediction.factors && prediction.factors.length > 0 && (
                      <div className="mt-3 pt-3 border-t">
                        <p className="text-xs font-medium text-gray-600 mb-2">Factores Influyentes:</p>
                        <div className="flex flex-wrap gap-1">
                          {prediction.factors.slice(0, 3).map((factor: any, idx: number) => (
                            <Badge 
                              key={idx} 
                              variant="outline" 
                              className={`text-xs ${
                                factor.impact > 0 ? 'text-green-600' : 'text-red-600'
                              }`}
                            >
                              {factor.name}: {factor.impact > 0 ? '+' : ''}{factor.impact.toFixed(2)}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                
                {analyticsData.patterns.predictions.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No hay predicciones disponibles</p>
                    <p className="text-sm">Ejecuta un análisis de patrones para generar predicciones</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Backtesting */}
        <TabsContent value="backtesting" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Maximize className="h-5 w-5" />
                Sistema de Backtesting
              </CardTitle>
              <CardDescription>
                Prueba histórica de estrategias con datos reales de mercado
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button 
                  onClick={() => runBacktest('INTRA_DEX')}
                  variant="outline"
                  className="h-20 flex-col"
                >
                  <Target className="h-6 w-6 mb-2" />
                  Test Intra-DEX
                </Button>
                
                <Button 
                  onClick={() => runBacktest('INTER_DEX')}
                  variant="outline"
                  className="h-20 flex-col"
                >
                  <BarChart3 className="h-6 w-6 mb-2" />
                  Test Inter-DEX
                </Button>
                
                <Button 
                  onClick={() => runBacktest('FLASH_LOAN')}
                  variant="outline"
                  className="h-20 flex-col"
                >
                  <Zap className="h-6 w-6 mb-2" />
                  Test Flash Loan
                </Button>
              </div>
              
              <div className="text-center text-gray-500">
                <p>Selecciona una estrategia para ejecutar backtesting histórico</p>
                <p className="text-sm">Los resultados incluyen métricas de performance, drawdown y Sharpe ratio</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
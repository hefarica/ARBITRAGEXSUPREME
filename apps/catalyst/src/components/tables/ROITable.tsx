/**
 * ArbitrageX Supreme - ROI Table Component  
 * Ingenio Pichichi S.A. - Tabla de métricas de ROI y liquidez
 * 
 * Implementación metodica y disciplinada para visualización de
 * oportunidades de arbitraje con métricas de rentabilidad
 */

'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Target, 
  Shield, 
  Clock, 
  RefreshCw, 
  Filter, 
  Search, 
  Play, 
  Pause, 
  AlertTriangle, 
  CheckCircle,
  ArrowUp,
  ArrowDown,
  Zap,
  Activity
} from 'lucide-react'
import { useArbitrage } from '@/hooks'
import type { ArbitrageOpportunity } from '@/types/arbitrage'

// Types específicos de la tabla
interface ROIMetrics {
  roi: number
  profitUSD: number
  volumeUSD: number
  liquidityScore: number
  riskScore: number
  gasEfficiency: number
  timeToExecution: number
  confidenceScore: number
}

interface TableFilters {
  minROI: number
  maxRisk: number
  minProfit: number
  strategy: string
  blockchain: string
  sortBy: keyof ROIMetrics
  sortOrder: 'asc' | 'desc'
}

export const ROITable = () => {
  const { 
    opportunities, 
    isScanning, 
    refreshOpportunities, 
    selectOpportunity,
    selectedOpportunity,
    executeArbitrage,
    simulateExecution 
  } = useArbitrage()

  // Table state
  const [filters, setFilters] = useState<TableFilters>({
    minROI: 0.5, // 0.5% minimum
    maxRisk: 7, // Risk 0-7
    minProfit: 10, // $10 minimum
    strategy: 'all',
    blockchain: 'all',
    sortBy: 'roi',
    sortOrder: 'desc'
  })

  const [isExecuting, setIsExecuting] = useState(false)
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set())

  // ============================================
  // COMPUTED DATA & FILTERING
  // ============================================

  const processedOpportunities = useMemo(() => {
    return opportunities
      .map(opportunity => {
        // Calculate ROI metrics
        const roi = opportunity.expectedAmountOut > 0 
          ? ((opportunity.expectedAmountOut - opportunity.amountIn) / opportunity.amountIn) * 100
          : 0

        const profitUSD = opportunity.expectedProfit || 0
        const volumeUSD = opportunity.amountIn || 0
        
        // Mock additional metrics (would be calculated from real data)
        const liquidityScore = Math.max(0, Math.min(100, 
          (volumeUSD / 1000) * 10 + (opportunity.confidenceScore || 50)
        ))
        
        const gasEfficiency = Math.max(0, Math.min(100,
          100 - (opportunity.gasEstimate / 500000) * 100
        ))

        const timeToExecution = Math.floor(Math.random() * 30) + 5 // 5-35 seconds

        return {
          ...opportunity,
          metrics: {
            roi,
            profitUSD,
            volumeUSD,
            liquidityScore,
            riskScore: 10 - (opportunity.confidenceScore / 10), // Inverse of confidence
            gasEfficiency,
            timeToExecution,
            confidenceScore: opportunity.confidenceScore || 50
          } as ROIMetrics
        }
      })
      .filter(opp => {
        const metrics = opp.metrics as ROIMetrics
        return (
          metrics.roi >= filters.minROI &&
          metrics.riskScore <= filters.maxRisk &&
          metrics.profitUSD >= filters.minProfit &&
          (filters.strategy === 'all' || opp.strategy.type === filters.strategy) &&
          (filters.blockchain === 'all' || opp.chainId.toString() === filters.blockchain)
        )
      })
      .sort((a, b) => {
        const aVal = (a.metrics as ROIMetrics)[filters.sortBy]
        const bVal = (b.metrics as ROIMetrics)[filters.sortBy]
        
        if (filters.sortOrder === 'asc') {
          return aVal - bVal
        }
        return bVal - aVal
      })
  }, [opportunities, filters])

  // ============================================
  // EVENT HANDLERS
  // ============================================

  const handleFilterChange = (key: keyof TableFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const handleSort = (column: keyof ROIMetrics) => {
    setFilters(prev => ({
      ...prev,
      sortBy: column,
      sortOrder: prev.sortBy === column && prev.sortOrder === 'desc' ? 'asc' : 'desc'
    }))
  }

  const handleRowSelection = (opportunityId: string) => {
    setSelectedRows(prev => {
      const newSet = new Set(prev)
      if (newSet.has(opportunityId)) {
        newSet.delete(opportunityId)
      } else {
        newSet.add(opportunityId)
      }
      return newSet
    })
  }

  const handleExecuteSelected = async () => {
    if (selectedRows.size === 0) return

    setIsExecuting(true)
    try {
      for (const opportunityId of Array.from(selectedRows)) {
        const opportunity = processedOpportunities.find(op => op.id === opportunityId)
        if (opportunity) {
          await executeArbitrage(opportunity)
        }
      }
      setSelectedRows(new Set())
    } catch (error) {
      console.error('Batch execution error:', error)
    } finally {
      setIsExecuting(false)
    }
  }

  const handleSimulateRow = async (opportunity: ArbitrageOpportunity & { metrics: ROIMetrics }) => {
    try {
      await simulateExecution(opportunity)
    } catch (error) {
      console.error('Simulation error:', error)
    }
  }

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }

  const formatPercentage = (value: number): string => {
    return `${value.toFixed(2)}%`
  }

  const getRiskBadgeVariant = (risk: number): "default" | "secondary" | "destructive" => {
    if (risk <= 3) return 'default' // Low risk - green
    if (risk <= 6) return 'secondary' // Medium risk - yellow
    return 'destructive' // High risk - red
  }

  const getROIBadgeVariant = (roi: number): "default" | "secondary" | "destructive" => {
    if (roi >= 5) return 'default' // High ROI - green
    if (roi >= 1) return 'secondary' // Medium ROI - yellow
    return 'destructive' // Low ROI - red
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-600" />
            ROI & Liquidez - Oportunidades de Arbitraje
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={refreshOpportunities}
              disabled={isScanning}
              className="flex items-center gap-2"
            >
              {isScanning ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Escaneando...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Actualizar
                </>
              )}
            </Button>
            {selectedRows.size > 0 && (
              <Button
                onClick={handleExecuteSelected}
                disabled={isExecuting}
                className="bg-green-600 hover:bg-green-700 flex items-center gap-2"
              >
                {isExecuting ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Ejecutando...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4" />
                    Ejecutar {selectedRows.size}
                  </>
                )}
              </Button>
            )}
          </div>
        </CardTitle>
        <CardDescription>
          {processedOpportunities.length} oportunidades encontradas • Actualización en tiempo real cada 5s
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Filtros */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 p-4 bg-gray-50 rounded-lg">
          <div className="space-y-2">
            <label className="text-sm font-medium">ROI Mínimo (%)</label>
            <Input
              type="number"
              step="0.1"
              value={filters.minROI}
              onChange={(e) => handleFilterChange('minROI', parseFloat(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Riesgo Máx</label>
            <Input
              type="number"
              min="0"
              max="10"
              value={filters.maxRisk}
              onChange={(e) => handleFilterChange('maxRisk', parseInt(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Profit Mín ($)</label>
            <Input
              type="number"
              value={filters.minProfit}
              onChange={(e) => handleFilterChange('minProfit', parseFloat(e.target.value))}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Estrategia</label>
            <Select value={filters.strategy} onValueChange={(value) => handleFilterChange('strategy', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="INTRA_DEX">Intra-DEX</SelectItem>
                <SelectItem value="INTER_DEX">Inter-DEX</SelectItem>
                <SelectItem value="CROSS_CHAIN">Cross-Chain</SelectItem>
                <SelectItem value="FLASH_LOAN">Flash Loan</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Blockchain</label>
            <Select value={filters.blockchain} onValueChange={(value) => handleFilterChange('blockchain', value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="1">Ethereum</SelectItem>
                <SelectItem value="56">BSC</SelectItem>
                <SelectItem value="137">Polygon</SelectItem>
                <SelectItem value="42161">Arbitrum</SelectItem>
                <SelectItem value="10">Optimism</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={() => setFilters({
                minROI: 0.5,
                maxRisk: 7,
                minProfit: 10,
                strategy: 'all',
                blockchain: 'all',
                sortBy: 'roi',
                sortOrder: 'desc'
              })}
            >
              🔄 Reset
            </Button>
          </div>
        </div>

        {/* Tabla de Oportunidades */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <input 
                    type="checkbox"
                    checked={selectedRows.size === processedOpportunities.length && processedOpportunities.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedRows(new Set(processedOpportunities.map(op => op.id)))
                      } else {
                        setSelectedRows(new Set())
                      }
                    }}
                  />
                </TableHead>
                <TableHead>Par/Estrategia</TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('roi')}
                >
                  ROI {filters.sortBy === 'roi' && (filters.sortOrder === 'desc' ? '↓' : '↑')}
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('profitUSD')}
                >
                  Profit {filters.sortBy === 'profitUSD' && (filters.sortOrder === 'desc' ? '↓' : '↑')}
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('volumeUSD')}
                >
                  Volumen {filters.sortBy === 'volumeUSD' && (filters.sortOrder === 'desc' ? '↓' : '↑')}
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('liquidityScore')}
                >
                  Liquidez {filters.sortBy === 'liquidityScore' && (filters.sortOrder === 'desc' ? '↓' : '↑')}
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('riskScore')}
                >
                  Riesgo {filters.sortBy === 'riskScore' && (filters.sortOrder === 'desc' ? '↓' : '↑')}
                </TableHead>
                <TableHead 
                  className="cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort('gasEfficiency')}
                >
                  Gas Eff {filters.sortBy === 'gasEfficiency' && (filters.sortOrder === 'desc' ? '↓' : '↑')}
                </TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {processedOpportunities.map((opportunity) => {
                const metrics = opportunity.metrics as ROIMetrics
                const isSelected = selectedRows.has(opportunity.id)
                
                return (
                  <TableRow 
                    key={opportunity.id}
                    className={`cursor-pointer hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}
                    onClick={() => selectOpportunity(opportunity)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleRowSelection(opportunity.id)}
                      />
                    </TableCell>

                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium text-sm">
                          {opportunity.tokenIn.slice(0, 6)}...{opportunity.tokenIn.slice(-4)} →{' '}
                          {opportunity.tokenOut.slice(0, 6)}...{opportunity.tokenOut.slice(-4)}
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {opportunity.strategy.type}
                        </Badge>
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge variant={getROIBadgeVariant(metrics.roi)}>
                        {formatPercentage(metrics.roi)}
                      </Badge>
                    </TableCell>

                    <TableCell className="font-medium text-green-600">
                      {formatCurrency(metrics.profitUSD)}
                    </TableCell>

                    <TableCell>
                      {formatCurrency(metrics.volumeUSD)}
                    </TableCell>

                    <TableCell>
                      <div className="space-y-1">
                        <Progress value={metrics.liquidityScore} className="h-2" />
                        <span className="text-xs text-gray-500">{metrics.liquidityScore.toFixed(0)}%</span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge variant={getRiskBadgeVariant(metrics.riskScore)}>
                        {metrics.riskScore.toFixed(1)}/10
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <div className="space-y-1">
                        <Progress value={metrics.gasEfficiency} className="h-2" />
                        <span className="text-xs text-gray-500">{metrics.gasEfficiency.toFixed(0)}%</span>
                      </div>
                    </TableCell>

                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSimulateRow(opportunity)}
                          className="text-xs"
                        >
                          🧪 Sim
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => executeArbitrage(opportunity)}
                          className="text-xs bg-green-600 hover:bg-green-700"
                        >
                          ⚡ Exec
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}

              {processedOpportunities.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                    {isScanning ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                        Buscando oportunidades...
                      </div>
                    ) : (
                      'No se encontraron oportunidades con los filtros actuales'
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Resumen de Métricas */}
        {processedOpportunities.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {processedOpportunities.length}
              </div>
              <div className="text-sm text-gray-600">Oportunidades</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {formatPercentage(processedOpportunities.reduce((sum, op) => sum + (op.metrics as ROIMetrics).roi, 0) / processedOpportunities.length)}
              </div>
              <div className="text-sm text-gray-600">ROI Promedio</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {formatCurrency(processedOpportunities.reduce((sum, op) => sum + (op.metrics as ROIMetrics).profitUSD, 0))}
              </div>
              <div className="text-sm text-gray-600">Profit Total</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {(processedOpportunities.reduce((sum, op) => sum + (op.metrics as ROIMetrics).riskScore, 0) / processedOpportunities.length).toFixed(1)}/10
              </div>
              <div className="text-sm text-gray-600">Riesgo Promedio</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
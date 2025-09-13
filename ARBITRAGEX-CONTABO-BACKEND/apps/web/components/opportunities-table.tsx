'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  TrendingUp, 
  TrendingDown, 
  ExternalLink,
  Clock,
  Zap,
  AlertTriangle,
  Filter,
  Search,
  ArrowUpDown,
  Play,
  Pause
} from 'lucide-react'
import { cn, formatCurrency, formatPercentage } from '@/lib/utils'
import { AntiFlickerTable, formatters } from '@/components/ui/anti-flicker'
import { ArbitrageOpportunity } from '../types/api'

// Legacy interface for backward compatibility
interface LegacyOpportunity {
  id: string
  tokenA: string
  tokenB: string
  exchangeA: string
  exchangeB: string
  profitAmount: number
  profitPercentage: number
  network: string
  timestamp: string
  strategy: string
  risk: 'low' | 'medium' | 'high'
  status: 'active' | 'executing' | 'completed' | 'failed'
  volume: number
  gasEstimate: number
}

interface OpportunitiesTableProps {
  opportunities?: (ArbitrageOpportunity | LegacyOpportunity)[]
  data?: ArbitrageOpportunity[]
  className?: string
  isLoading?: boolean
  error?: string | null
  onExecute?: (opportunityId: string) => void
}

function getRiskColor(risk: 'low' | 'medium' | 'high') {
  switch (risk) {
    case 'low': return 'bg-emerald-100 text-emerald-800 border-emerald-200'
    case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    case 'high': return 'bg-red-100 text-red-800 border-red-200'
    default: return 'bg-slate-100 text-slate-800 border-slate-200'
  }
}

function getStatusColor(status: 'active' | 'executing' | 'completed' | 'failed') {
  switch (status) {
    case 'active': return 'bg-blue-100 text-blue-800 border-blue-200'
    case 'executing': return 'bg-orange-100 text-orange-800 border-orange-200'
    case 'completed': return 'bg-emerald-100 text-emerald-800 border-emerald-200'
    case 'failed': return 'bg-red-100 text-red-800 border-red-200'
    default: return 'bg-slate-100 text-slate-800 border-slate-200'
  }
}

function getStatusIcon(status: 'active' | 'executing' | 'completed' | 'failed') {
  switch (status) {
    case 'active': return Clock
    case 'executing': return Zap
    case 'completed': return TrendingUp
    case 'failed': return AlertTriangle
    default: return Clock
  }
}

export function OpportunitiesTable({ 
  opportunities = [], 
  data = [], 
  className, 
  isLoading = false,
  error = null,
  onExecute 
}: OpportunitiesTableProps) {
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'executing'>('all')

  // Use new API data if available, fallback to legacy
  const tableData = data.length > 0 ? data : opportunities

  // Transform API data to table format
  const transformedData = tableData.map(opp => {
    // Handle both API and legacy formats
    if ('tokenSymbol' in opp) {
      // New API format
      return {
        id: opp.id,
        tokenA: opp.tokenSymbol,
        tokenB: 'USD',
        exchangeA: opp.executionPath?.[0] || 'DEX A',
        exchangeB: opp.executionPath?.[1] || 'DEX B',
        profitAmount: opp.profitUsd,
        profitPercentage: opp.profitPercentage,
        network: opp.blockchain,
        timestamp: opp.createdAt,
        strategy: opp.strategy,
        risk: opp.riskLevel,
        status: 'active' as const,
        volume: parseFloat(opp.maximumAmount),
        gasEstimate: parseInt(opp.estimatedGas) / 1000000000 // Convert to Gwei
      }
    } else {
      // Legacy format
      return opp as LegacyOpportunity
    }
  })

  const filteredData = transformedData.filter(opp => 
    filterStatus === 'all' || opp.status === filterStatus
  )

  // Define table columns with anti-flicker support
  const columns = [
    {
      key: 'pair',
      label: 'Pair',
      render: (item: any) => (
        <div className="flex items-center space-x-3">
          <div>
            <div className="text-sm font-medium text-slate-900">
              {item.tokenA}/{item.tokenB}
            </div>
            <div className="text-sm text-slate-600">
              {item.exchangeA} → {item.exchangeB}
            </div>
          </div>
        </div>
      )
    },
    {
      key: 'strategy',
      label: 'Estrategia',
      render: (item: any) => (
        <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
          {item.strategy.replace('_', ' ')}
        </Badge>
      )
    },
    {
      key: 'profit',
      label: 'Profit',
      render: (item: any) => (
        <div className="text-sm">
          <div className="flex items-center space-x-1">
            <TrendingUp className="w-3 h-3 text-emerald-500" />
            <span className="font-medium text-emerald-600">
              {formatters.percentage(item.profitPercentage)}
            </span>
          </div>
          <div className="text-sm text-slate-600">
            {formatters.currency(item.profitAmount)}
          </div>
        </div>
      )
    },
    {
      key: 'network',
      label: 'Red',
      render: (item: any) => (
        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
          {item.network}
        </Badge>
      )
    },
    {
      key: 'risk',
      label: 'Riesgo',
      render: (item: any) => (
        <Badge variant="outline" className={getRiskColor(item.risk)}>
          {item.risk}
        </Badge>
      )
    },
    {
      key: 'status',
      label: 'Estado',
      render: (item: any) => {
        const StatusIcon = getStatusIcon(item.status)
        return (
          <div className="flex items-center space-x-2">
            <StatusIcon className="w-4 h-4" />
            <Badge variant="outline" className={getStatusColor(item.status)}>
              {item.status}
            </Badge>
          </div>
        )
      }
    },
    {
      key: 'volume',
      label: 'Volumen',
      render: (item: any) => (
        <div className="text-sm">
          <div className="font-medium text-slate-900">
            {formatters.currency(item.volume)}
          </div>
          <div className="text-slate-600">
            Gas: {item.gasEstimate.toFixed(1)} gwei
          </div>
        </div>
      )
    },
    {
      key: 'actions',
      label: 'Acciones',
      className: 'text-right',
      render: (item: any) => (
        <div className="flex items-center justify-end space-x-2">
          {item.status === 'active' && (
            <Button 
              size="sm" 
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => onExecute?.(item.id)}
            >
              <Play className="w-3 h-3 mr-1" />
              Ejecutar
            </Button>
          )}
          {item.status === 'executing' && (
            <Button size="sm" variant="outline">
              <Pause className="w-3 h-3 mr-1" />
              Pausar
            </Button>
          )}
          <Button size="sm" variant="outline">
            <ExternalLink className="w-3 h-3" />
          </Button>
        </div>
      )
    }
  ]

  return (
    <Card className={cn(
      "bg-white/80 backdrop-blur-sm border border-slate-200/30 rounded-2xl shadow-lg",
      className
    )}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2 text-slate-800">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            <span>Oportunidades de Arbitraje</span>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
              {filteredData.length}
            </Badge>
          </CardTitle>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="outline" 
              size="sm"
              onClick={() => setFilterStatus('all')}
              className={cn(
                filterStatus === 'all' && 'bg-blue-50 text-blue-700 border-blue-200'
              )}
            >
              Todas ({tableData.length})
            </Button>
            <Button
              variant="outline"
              size="sm" 
              onClick={() => setFilterStatus('active')}
              className={cn(
                filterStatus === 'active' && 'bg-blue-50 text-blue-700 border-blue-200'
              )}
            >
              Activas ({filteredData.filter(o => o.status === 'active').length})
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFilterStatus('executing')}
              className={cn(
                filterStatus === 'executing' && 'bg-blue-50 text-blue-700 border-blue-200'
              )}
            >
              Ejecutándose ({filteredData.filter(o => o.status === 'executing').length})
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <AntiFlickerTable
          data={filteredData}
          columns={columns}
          isLoading={isLoading}
          error={error}
          keyExtractor={(item) => item.id}
          onRowClick={(item) => console.log('Selected opportunity:', item)}
          enableHighlight={true}
          highlightDuration={2000}
        />
      </CardContent>
    </Card>
  )
}
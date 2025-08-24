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

interface Opportunity {
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
  opportunities: Opportunity[]
  className?: string
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

export function OpportunitiesTable({ opportunities, className }: OpportunitiesTableProps) {
  const [sortField, setSortField] = useState<keyof Opportunity>('profitPercentage')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'executing'>('all')

  const handleSort = (field: keyof Opportunity) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const filteredAndSortedOpportunities = opportunities
    .filter(opp => filterStatus === 'all' || opp.status === filterStatus)
    .sort((a, b) => {
      const aVal = a[sortField]
      const bVal = b[sortField]
      const direction = sortDirection === 'asc' ? 1 : -1
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return (aVal - bVal) * direction
      }
      return String(aVal).localeCompare(String(bVal)) * direction
    })

  return (
    <Card className={cn("", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">Oportunidades de Arbitraje</CardTitle>
          <div className="flex items-center space-x-2">
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
              {filteredAndSortedOpportunities.length} activas
            </Badge>
            <Button variant="outline" size="sm">
              <Filter className="w-4 h-4 mr-2" />
              Filtros
            </Button>
          </div>
        </div>
        
        {/* Filter Tabs */}
        <div className="flex space-x-2 mt-4">
          {[
            { key: 'all', label: 'Todas' },
            { key: 'active', label: 'Activas' },
            { key: 'executing', label: 'Ejecutando' }
          ].map((filter) => (
            <Button
              key={filter.key}
              variant={filterStatus === filter.key ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterStatus(filter.key as any)}
              className={cn(
                filterStatus === filter.key && "bg-emerald-600 hover:bg-emerald-700"
              )}
            >
              {filter.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left p-4 font-medium text-slate-600">Par/Exchange</th>
                <th 
                  className="text-left p-4 font-medium text-slate-600 cursor-pointer hover:bg-slate-100"
                  onClick={() => handleSort('profitPercentage')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Ganancia</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="text-left p-4 font-medium text-slate-600">Red</th>
                <th className="text-left p-4 font-medium text-slate-600">Riesgo</th>
                <th className="text-left p-4 font-medium text-slate-600">Estado</th>
                <th 
                  className="text-left p-4 font-medium text-slate-600 cursor-pointer hover:bg-slate-100"
                  onClick={() => handleSort('volume')}
                >
                  <div className="flex items-center space-x-1">
                    <span>Volumen</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="text-right p-4 font-medium text-slate-600">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedOpportunities.map((opportunity) => {
                const StatusIcon = getStatusIcon(opportunity.status)
                return (
                  <tr key={opportunity.id} className="border-b hover:bg-slate-50 transition-colors">
                    <td className="p-4">
                      <div className="space-y-1">
                        <div className="font-medium text-slate-900">
                          {opportunity.tokenA}/{opportunity.tokenB}
                        </div>
                        <div className="text-sm text-slate-600 flex items-center space-x-2">
                          <span>{opportunity.exchangeA}</span>
                          <ExternalLink className="w-3 h-3" />
                          <span>{opportunity.exchangeB}</span>
                        </div>
                      </div>
                    </td>
                    
                    <td className="p-4">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <TrendingUp className="w-4 h-4 text-emerald-600" />
                          <span className="font-semibold text-emerald-600">
                            {formatPercentage(opportunity.profitPercentage)}
                          </span>
                        </div>
                        <div className="text-sm text-slate-600">
                          {formatCurrency(opportunity.profitAmount)}
                        </div>
                      </div>
                    </td>
                    
                    <td className="p-4">
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                        {opportunity.network}
                      </Badge>
                    </td>
                    
                    <td className="p-4">
                      <Badge variant="outline" className={getRiskColor(opportunity.risk)}>
                        {opportunity.risk}
                      </Badge>
                    </td>
                    
                    <td className="p-4">
                      <div className="flex items-center space-x-2">
                        <StatusIcon className="w-4 h-4" />
                        <Badge variant="outline" className={getStatusColor(opportunity.status)}>
                          {opportunity.status}
                        </Badge>
                      </div>
                    </td>
                    
                    <td className="p-4">
                      <div className="text-sm">
                        <div className="font-medium text-slate-900">
                          {formatCurrency(opportunity.volume)}
                        </div>
                        <div className="text-slate-600">
                          Gas: {opportunity.gasEstimate} gwei
                        </div>
                      </div>
                    </td>
                    
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        {opportunity.status === 'active' && (
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                            <Play className="w-3 h-3 mr-1" />
                            Ejecutar
                          </Button>
                        )}
                        {opportunity.status === 'executing' && (
                          <Button size="sm" variant="outline">
                            <Pause className="w-3 h-3 mr-1" />
                            Pausar
                          </Button>
                        )}
                        <Button size="sm" variant="outline">
                          <ExternalLink className="w-3 h-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        
        {filteredAndSortedOpportunities.length === 0 && (
          <div className="text-center py-12">
            <div className="text-slate-400 mb-2">
              <Search className="w-12 h-12 mx-auto" />
            </div>
            <p className="text-slate-600">No se encontraron oportunidades</p>
            <p className="text-sm text-slate-500 mt-1">
              Ajusta los filtros o espera a que se detecten nuevas oportunidades
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
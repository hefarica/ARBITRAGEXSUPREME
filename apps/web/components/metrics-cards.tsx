'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Activity, 
  Zap,
  Target,
  Timer,
  BarChart3,
  Percent,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react'
import { cn, formatCurrency, formatPercentage } from '@/lib/utils'

interface MetricCardProps {
  title: string
  value: string
  change?: number
  changeType?: 'positive' | 'negative' | 'neutral'
  icon: React.ElementType
  subtitle?: string
  trend?: 'up' | 'down' | 'stable'
  className?: string
}

function MetricCard({ 
  title, 
  value, 
  change, 
  changeType = 'neutral', 
  icon: Icon, 
  subtitle,
  trend,
  className 
}: MetricCardProps) {
  const getTrendIcon = () => {
    if (trend === 'up') return ArrowUpRight
    if (trend === 'down') return ArrowDownRight
    return null
  }

  const TrendIcon = getTrendIcon()

  return (
    <Card className={cn("relative overflow-hidden", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-slate-600">{title}</CardTitle>
          <div className={cn(
            "p-2 rounded-lg",
            changeType === 'positive' && "bg-emerald-100",
            changeType === 'negative' && "bg-red-100",
            changeType === 'neutral' && "bg-slate-100"
          )}>
            <Icon className={cn(
              "w-4 h-4",
              changeType === 'positive' && "text-emerald-600",
              changeType === 'negative' && "text-red-600",
              changeType === 'neutral' && "text-slate-600"
            )} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-slate-900">{value}</span>
            {change !== undefined && TrendIcon && (
              <div className={cn(
                "flex items-center space-x-1 text-sm",
                changeType === 'positive' && "text-emerald-600",
                changeType === 'negative' && "text-red-600",
                changeType === 'neutral' && "text-slate-600"
              )}>
                <TrendIcon className="w-3 h-3" />
                <span>{formatPercentage(Math.abs(change))}</span>
              </div>
            )}
          </div>
          {subtitle && (
            <p className="text-sm text-slate-600">{subtitle}</p>
          )}
        </div>
      </CardContent>
      
      {/* Gradient overlay for visual appeal */}
      <div className={cn(
        "absolute inset-x-0 bottom-0 h-1",
        changeType === 'positive' && "bg-gradient-to-r from-emerald-500 to-emerald-400",
        changeType === 'negative' && "bg-gradient-to-r from-red-500 to-red-400",
        changeType === 'neutral' && "bg-gradient-to-r from-slate-500 to-slate-400"
      )} />
    </Card>
  )
}

interface MetricsCardsProps {
  data: {
    totalProfit: number
    totalProfitChange: number
    dailyVolume: number
    dailyVolumeChange: number
    activeOpportunities: number
    activeOpportunitiesChange: number
    successRate: number
    successRateChange: number
    avgExecutionTime: number
    avgExecutionTimeChange: number
    networksOnline: number
    networksOnlineChange: number
  }
}

export function MetricsCards({ data }: MetricsCardsProps) {
  const metrics = [
    {
      title: "Ganancia Total",
      value: formatCurrency(data.totalProfit),
      change: data.totalProfitChange,
      changeType: data.totalProfitChange >= 0 ? 'positive' : 'negative' as const,
      icon: DollarSign,
      subtitle: "Últimas 24h",
      trend: data.totalProfitChange >= 0 ? 'up' : 'down' as const
    },
    {
      title: "Volumen Diario",
      value: formatCurrency(data.dailyVolume),
      change: data.dailyVolumeChange,
      changeType: data.dailyVolumeChange >= 0 ? 'positive' : 'negative' as const,
      icon: BarChart3,
      subtitle: "Volumen procesado",
      trend: data.dailyVolumeChange >= 0 ? 'up' : 'down' as const
    },
    {
      title: "Oportunidades Activas",
      value: data.activeOpportunities.toString(),
      change: data.activeOpportunitiesChange,
      changeType: data.activeOpportunitiesChange >= 0 ? 'positive' : 'negative' as const,
      icon: Target,
      subtitle: "En tiempo real",
      trend: data.activeOpportunitiesChange >= 0 ? 'up' : 'down' as const
    },
    {
      title: "Tasa de Éxito",
      value: formatPercentage(data.successRate),
      change: data.successRateChange,
      changeType: data.successRateChange >= 0 ? 'positive' : 'negative' as const,
      icon: TrendingUp,
      subtitle: "Promedio 7 días",
      trend: data.successRateChange >= 0 ? 'up' : 'down' as const
    },
    {
      title: "Tiempo Promedio",
      value: `${data.avgExecutionTime}ms`,
      change: data.avgExecutionTimeChange,
      changeType: data.avgExecutionTimeChange <= 0 ? 'positive' : 'negative' as const,
      icon: Timer,
      subtitle: "Ejecución de trades",
      trend: data.avgExecutionTimeChange <= 0 ? 'up' : 'down' as const
    },
    {
      title: "Redes Online",
      value: `${data.networksOnline}/12`,
      change: data.networksOnlineChange,
      changeType: data.networksOnlineChange >= 0 ? 'positive' : 'negative' as const,
      icon: Activity,
      subtitle: "Estado de conexión",
      trend: data.networksOnlineChange >= 0 ? 'up' : 'down' as const
    }
  ]

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {metrics.map((metric, index) => (
        <MetricCard key={index} {...metric} />
      ))}
    </div>
  )
}
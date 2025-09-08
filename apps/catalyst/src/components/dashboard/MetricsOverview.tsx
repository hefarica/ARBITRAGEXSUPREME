'use client'

import { useEffect, useState } from 'react'

interface Metric {
  id: string
  label: string
  value: string
  change: string
  changeType: 'positive' | 'negative' | 'neutral'
  icon: string
}

export default function MetricsOverview() {
  const [metrics, setMetrics] = useState<Metric[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Simulate API call
    const loadMetrics = async () => {
      setIsLoading(true)
      
      // Simulated data - will be replaced with real API calls
      const mockMetrics: Metric[] = [
        {
          id: 'total-opportunities',
          label: 'Oportunidades Activas',
          value: '247',
          change: '+12.5%',
          changeType: 'positive',
          icon: '⚡'
        },
        {
          id: 'total-protocols',
          label: 'Protocolos Conectados',
          value: '450',
          change: '+8',
          changeType: 'positive',
          icon: '🔗'
        },
        {
          id: 'total-profit',
          label: 'Beneficio 24h',
          value: '$12,847',
          change: '+23.7%',
          changeType: 'positive',
          icon: '💰'
        },
        {
          id: 'active-strategies',
          label: 'Estrategias Ejecutando',
          value: '12',
          change: '0%',
          changeType: 'neutral',
          icon: '🎯'
        },
        {
          id: 'gas-efficiency',
          label: 'Eficiencia de Gas',
          value: '94.2%',
          change: '+2.1%',
          changeType: 'positive',
          icon: '⛽'
        },
        {
          id: 'success-rate',
          label: 'Tasa de Éxito',
          value: '89.4%',
          change: '-1.2%',
          changeType: 'negative',
          icon: '✅'
        }
      ]
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      setMetrics(mockMetrics)
      setIsLoading(false)
    }

    loadMetrics()
  }, [])

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="metric-card animate-pulse">
            <div className="loading-pulse h-8 w-8 mx-auto mb-4"></div>
            <div className="loading-pulse h-6 w-16 mx-auto mb-2"></div>
            <div className="loading-pulse h-4 w-20 mx-auto"></div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {metrics.map((metric) => (
        <div 
          key={metric.id} 
          className="metric-card anti-flicker hover:scale-105 transform transition-transform duration-200"
        >
          <div className="text-3xl mb-3">{metric.icon}</div>
          <div className="metric-value">{metric.value}</div>
          <div className="metric-label mb-2">{metric.label}</div>
          <div className={`text-sm font-medium flex items-center justify-center space-x-1 ${
            metric.changeType === 'positive' 
              ? 'text-success-600 dark:text-success-400' 
              : metric.changeType === 'negative'
              ? 'text-danger-600 dark:text-danger-400'
              : 'text-gray-600 dark:text-gray-400'
          }`}>
            <span>
              {metric.changeType === 'positive' && '↗️'}
              {metric.changeType === 'negative' && '↘️'}
              {metric.changeType === 'neutral' && '➡️'}
            </span>
            <span>{metric.change}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
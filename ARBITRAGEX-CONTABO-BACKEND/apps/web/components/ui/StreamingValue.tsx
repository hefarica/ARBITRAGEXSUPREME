'use client'

import React, { useEffect, useState, useRef } from 'react'
import { cn } from '@/lib/utils'

// ============================================================================
// COMPONENTES STREAMING ANTI-FLICKER
// ============================================================================

interface StreamingValueProps {
  value: any
  previousValue?: any
  formatter?: (val: any) => string
  className?: string
  highlightChanges?: boolean
  prefix?: string
  suffix?: string
  animationDuration?: number
}

// 🎯 Componente principal para valores streaming
export function StreamingValue({ 
  value, 
  previousValue, 
  formatter, 
  className = '', 
  highlightChanges = true,
  prefix = '',
  suffix = '',
  animationDuration = 3000
}: StreamingValueProps) {
  const [displayValue, setDisplayValue] = useState(value)
  const [isAnimating, setIsAnimating] = useState(false)
  const [changeType, setChangeType] = useState<'increase' | 'decrease' | 'none'>('none')
  const previousValueRef = useRef(value)
  
  useEffect(() => {
    if (value !== previousValueRef.current) {
      const prev = previousValueRef.current
      
      // Determinar tipo de cambio
      if (typeof value === 'number' && typeof prev === 'number') {
        if (value > prev) {
          setChangeType('increase')
        } else if (value < prev) {
          setChangeType('decrease')
        } else {
          setChangeType('none')
        }
      } else {
        setChangeType('none')
      }
      
      // Actualizar valor y animar
      setDisplayValue(value)
      previousValueRef.current = value
      
      if (highlightChanges) {
        setIsAnimating(true)
        setTimeout(() => setIsAnimating(false), animationDuration)
      }
    }
  }, [value, highlightChanges, animationDuration])
  
  // Formatear valor para display
  const formattedValue = formatter ? formatter(displayValue) : String(displayValue)
  
  // Clases de animación
  const animationClass = highlightChanges && isAnimating
    ? changeType === 'increase' 
      ? 'animate-highlight-green'
      : changeType === 'decrease'
        ? 'animate-highlight-red'
        : ''
    : ''
  
  return (
    <span className={cn(
      'streaming-value transition-all duration-300 ease-out',
      animationClass,
      className
    )}>
      {prefix}{formattedValue}{suffix}
    </span>
  )
}

// 📊 Componente para métricas con iconos
export function StreamingMetric({ 
  value, 
  label, 
  icon: Icon, 
  formatter,
  className = '',
  highlightChanges = true
}: {
  value: any
  label: string
  icon?: React.ComponentType<any>
  formatter?: (val: any) => string
  className?: string
  highlightChanges?: boolean
}) {
  return (
    <div className={cn('flex items-center space-x-2', className)}>
      {Icon && <Icon className="w-4 h-4 text-gray-500" />}
      <div className="flex flex-col">
        <StreamingValue
          value={value}
          formatter={formatter}
          highlightChanges={highlightChanges}
          className="font-semibold"
        />
        <span className="text-xs text-gray-500">{label}</span>
      </div>
    </div>
  )
}

// 📋 Componente para celdas de tabla
export function StreamingTableCell({ 
  value, 
  className = '', 
  highlightChanges = true,
  formatter
}: {
  value: any
  className?: string
  highlightChanges?: boolean
  formatter?: (val: any) => string
}) {
  return (
    <StreamingValue
      value={value}
      formatter={formatter}
      className={cn('block', className)}
      highlightChanges={highlightChanges}
    />
  )
}

// 📡 Indicador de streaming activo
export function StreamingIndicator({ 
  isStreaming, 
  className = '' 
}: { 
  isStreaming: boolean
  className?: string 
}) {
  return (
    <div className={cn('flex items-center space-x-1', className)}>
      <div className={cn(
        'w-2 h-2 rounded-full transition-all duration-300',
        isStreaming 
          ? 'bg-emerald-500 animate-pulse' 
          : 'bg-gray-300'
      )} />
      <span className={cn(
        'text-xs font-medium transition-colors duration-300',
        isStreaming ? 'text-emerald-600' : 'text-gray-500'
      )}>
        {isStreaming ? 'LIVE' : 'OFFLINE'}
      </span>
    </div>
  )
}

// 🔄 Indicador de estado de conexión
export function ConnectionStatus({ 
  connectionState,
  className = ''
}: { 
  connectionState: 'loading' | 'error' | 'updating' | 'connected' | 'idle'
  className?: string
}) {
  const getStatusColor = () => {
    switch (connectionState) {
      case 'connected': return 'text-emerald-600 bg-emerald-100'
      case 'updating': return 'text-blue-600 bg-blue-100'
      case 'loading': return 'text-yellow-600 bg-yellow-100'
      case 'error': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }
  
  const getStatusText = () => {
    switch (connectionState) {
      case 'connected': return 'Conectado'
      case 'updating': return 'Actualizando'
      case 'loading': return 'Cargando'
      case 'error': return 'Error'
      default: return 'Inactivo'
    }
  }
  
  return (
    <span className={cn(
      'px-2 py-1 rounded-full text-xs font-medium',
      getStatusColor(),
      className
    )}>
      {getStatusText()}
    </span>
  )
}
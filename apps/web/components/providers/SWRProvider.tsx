'use client'

import React from 'react'
import { SWRConfig, SWRConfiguration } from 'swr'
import { SWRAntiFlickerConfig } from '@/hooks/useSWRAntiFlicker'

// ============================================================================
// CONFIGURACIÓN GLOBAL SWR ANTI-FLICKER
// ============================================================================

const globalConfig: SWRConfiguration = {
  ...SWRAntiFlickerConfig.config,
  fetcher: SWRAntiFlickerConfig.fetcher,
  
  // Configuración específica para sistema financiero streaming
  refreshInterval: 5000,           // ⏰ EXACTAMENTE cada 5 segundos
  revalidateOnFocus: false,        // No interrumpir el flujo
  revalidateOnReconnect: true,     // Reconectar automáticamente
  keepPreviousData: true,          // 🔑 ANTI-FLICKER: nunca mostrar pantalla vacía
  dedupingInterval: 4000,          // Evitar requests duplicados
  
  // Retry inteligente con exponential backoff
  errorRetryCount: 5,
  retry: (failureCount: number, error: any) => {
    if (failureCount >= 5) return false
    
    // Exponential backoff: 1s, 2s, 4s, 8s, 16s
    const delay = Math.min(1000 * Math.pow(2, failureCount), 16000)
    
    console.warn(`🔄 SWR Retry ${failureCount + 1}/5 in ${delay}ms for:`, error.message)
    
    return new Promise((resolve) => setTimeout(resolve, delay))
  },
  
  // Logging mejorado para debugging
  onError: (error, key) => {
    console.error('🔴 SWR Global Error:', { key, error: error.message })
  },
  
  onSuccess: (data, key) => {
    console.log('✅ SWR Global Success (5s refresh):', { 
      key, 
      dataSize: JSON.stringify(data).length,
      timestamp: new Date().toLocaleTimeString()
    })
  },
  
  onLoadingSlow: (key) => {
    console.warn('⏳ SWR Loading Slow:', key)
  }
}

// ============================================================================
// PROVIDER COMPONENT
// ============================================================================

interface SWRProviderProps {
  children: React.ReactNode
}

export function SWRProvider({ children }: SWRProviderProps) {
  return (
    <SWRConfig value={globalConfig}>
      {children}
    </SWRConfig>
  )
}

export default SWRProvider
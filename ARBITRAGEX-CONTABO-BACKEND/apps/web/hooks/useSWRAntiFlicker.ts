'use client'

import useSWR, { SWRConfiguration } from 'swr'
import { useRef, useCallback, useMemo } from 'react'

// ============================================================================
// CONFIGURACIÓN GLOBAL SWR ANTIPARPADEO - CADA 5 SEGUNDOS EXACTO
// ============================================================================

const defaultSWRConfig: SWRConfiguration = {
  refreshInterval: 5000,           // ⏱️ EXACTAMENTE cada 5 segundos
  revalidateOnFocus: false,        // No revalidar al enfocar ventana
  revalidateOnReconnect: true,     // Sí revalidar al reconectar
  dedupingInterval: 4000,          // Deduplicar requests por 4 segundos
  errorRetryCount: 5,              // Máximo 5 reintentos
  errorRetryInterval: 3000,        // Esperar 3 segundos entre reintentos
  keepPreviousData: true,          // 🔑 CLAVE: mantener datos previos (anti-flicker)
  suspense: false,                 // No usar suspense por compatibilidad
  // Retry con backoff exponencial
  retry: (failureCount, error) => {
    if (failureCount >= 5) return false
    // Backoff exponencial: 1s, 2s, 4s, 8s, 16s
    const delay = Math.min(1000 * Math.pow(2, failureCount), 16000)
    return new Promise((resolve) => setTimeout(resolve, delay))
  },
  onError: (error) => {
    console.warn('🔴 SWR Error:', error.message)
  },
  onSuccess: (data) => {
    console.log('✅ SWR Data updated silently (5s interval)')
  }
}

// ============================================================================
// FETCHER OPTIMIZADO CON MANEJO DE ERRORES
// ============================================================================

const fetcher = async (url: string) => {
  console.log('🔄 SWR Fetching (5s refresh):', url)
  
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout
  
  try {
    // Get auth token for API v2 endpoints
    const authToken = localStorage.getItem('accessToken') || '';
    const isApiV2 = url.includes('/api/v2/');
    
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };
    
    // Add authorization header for v2 endpoints
    if (isApiV2 && authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers,
      cache: 'no-cache' // Siempre datos frescos
    })
    
    clearTimeout(timeoutId)
    
    if (!response.ok) {
      // Handle authentication errors gracefully
      if (response.status === 401 && isApiV2) {
        console.warn('🔐 Authentication required for API v2 endpoint');
        throw new Error('Authentication required');
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const data = await response.json()
    
    // Log successful data updates
    if (data.success !== false) {
      console.log('✅ SWR Data updated silently (5s interval):', url);
    }
    
    return data
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error) {
      throw new Error(`Fetch failed: ${error.message}`)
    }
    throw error
  }
}

// ============================================================================
// HOOK PRINCIPAL PARA ANTIPARPADEO
// ============================================================================

export function useSWRAntiFlicker<T = any>(
  key: string | null, 
  customConfig?: Partial<SWRConfiguration>
) {
  // Combinar configuración por defecto con custom
  const config = useMemo(() => ({
    ...defaultSWRConfig,
    ...customConfig
  }), [customConfig])
  
  // Hook SWR principal
  const { data, error, isLoading, isValidating, mutate } = useSWR<T>(
    key, 
    fetcher, 
    config
  )
  
  // Referencia para detectar cambios de datos
  const prevDataRef = useRef<T>()
  const hasDataChanged = useRef(false)
  
  // Detectar cambios en los datos
  if (data && JSON.stringify(data) !== JSON.stringify(prevDataRef.current)) {
    hasDataChanged.current = true
    prevDataRef.current = data
  } else {
    hasDataChanged.current = false
  }
  
  // Estados de conexión mejorados
  const connectionState = useMemo(() => {
    if (isLoading && !data) return 'loading'
    if (error && !data) return 'error'
    if (isValidating && data) return 'updating'
    if (data) return 'connected'
    return 'idle'
  }, [isLoading, isValidating, error, data])
  
  // Función para refrescar manualmente
  const refresh = useCallback(() => {
    mutate()
  }, [mutate])
  
  // Estado del sistema streaming
  const streamingState = useMemo(() => ({
    isConnected: connectionState === 'connected' || connectionState === 'updating',
    isUpdating: isValidating,
    hasError: !!error,
    hasData: !!data,
    hasChanges: hasDataChanged.current,
    connectionState
  }), [connectionState, isValidating, error, data])
  
  return {
    data,
    error,
    isLoading,
    isValidating,
    refresh,
    streaming: streamingState,
    // Utilidades adicionales
    isEmpty: !data,
    isStale: !!error && !!data, // Hay datos pero con error (datos obsoletos)
    lastUpdate: data ? new Date().getTime() : null
  }
}

// ============================================================================
// HOOKS ESPECIALIZADOS - TODOS CON REFRESH CADA 5 SEGUNDOS
// ============================================================================

// 🎯 Hook para oportunidades de arbitraje (CADA 5 SEGUNDOS)
export function useArbitrageOpportunities() {
  return useSWRAntiFlicker('/api/v2/arbitrage/opportunities', {
    refreshInterval: 5000, // Exactamente 5 segundos
    dedupingInterval: 4000
  })
}

// 📊 Hook para dashboard summary (CADA 5 SEGUNDOS) 
export function useDashboardSummary() {
  return useSWRAntiFlicker('/api/v2/dashboard/summary', {
    refreshInterval: 5000 // Exactamente 5 segundos
  })
}

// 🌐 Hook para network status (CADA 5 SEGUNDOS)
export function useNetworkStatus() {
  return useSWRAntiFlicker('/api/v2/blockchain/network-status', {
    refreshInterval: 5000 // Exactamente 5 segundos
  })
}

// ⚡ Hook para métricas de performance (CADA 5 SEGUNDOS)
export function usePerformanceMetrics() {
  return useSWRAntiFlicker('/api/v2/dashboard/metrics', {
    refreshInterval: 5000 // Exactamente 5 segundos
  })
}

// 📊 Hook para datos de protocolos (CADA 5 SEGUNDOS)
export function useProtocolsData() {
  return useSWRAntiFlicker('/api/v2/dashboard/protocols', {
    refreshInterval: 5000 // Exactamente 5 segundos
  })
}

// 📈 Hook para ejecuciones de arbitraje (CADA 5 SEGUNDOS)
export function useArbitrageExecutions() {
  return useSWRAntiFlicker('/api/v2/arbitrage/executions', {
    refreshInterval: 5000 // Exactamente 5 segundos
  })
}

// 🔗 Hook para blockchains soportadas (CADA 5 SEGUNDOS)
export function useSupportedBlockchains() {
  return useSWRAntiFlicker('/api/v2/blockchain/supported', {
    refreshInterval: 5000 // Exactamente 5 segundos
  })
}

// 🔧 Hook genérico con configuración personalizada
export function useRealtimeData<T>(endpoint: string, interval = 5000) {
  return useSWRAntiFlicker<T>(endpoint, {
    refreshInterval: interval
  })
}

// ============================================================================
// PROVIDER PARA CONFIGURACIÓN GLOBAL (OPCIONAL)
// ============================================================================

export const SWRAntiFlickerConfig = {
  config: defaultSWRConfig,
  fetcher
}
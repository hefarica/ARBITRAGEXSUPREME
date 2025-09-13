'use client'

import useSWR from 'swr'

// API base URL - usando proxy de Next.js para evitar problemas de CORS
const API_BASE_URL = '/api/proxy/api/v2'

// Fetcher function for SWR
const fetcher = (url: string) => fetch(url).then((res) => res.json())

export interface SidebarCounts {
  opportunities: number
  wallets: number
  alerts: number
}

// Hook para obtener conteos dinámicos para el sidebar
export function useSidebarCounts() {
  // Obtener oportunidades activas SIN PAGINACIÓN - usar clave única para evitar conflictos de cache
  const { data: opportunitiesData, error: opportunitiesError } = useSWR(
    `${API_BASE_URL}/arbitrage/opportunities?sidebar=true&all=true`,
    async (url) => {
      // Remover parámetros de la URL antes de hacer la petición para obtener TODAS las oportunidades
      const cleanUrl = url.split('?')[0]
      const response = await fetch(cleanUrl)
      return response.json()
    },
    {
      refreshInterval: 10000, // Refresh every 10 seconds
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    }
  )

  // Obtener billeteras (usando endpoint de networks por ahora, ajustaremos según la respuesta del backend)
  const { data: walletsData, error: walletsError } = useSWR(
    `${API_BASE_URL}/blockchain/networks`,
    fetcher,
    {
      refreshInterval: 30000, // Refresh every 30 seconds
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    }
  )

  // Obtener métricas del dashboard para alertas y otros conteos
  const { data: metricsData, error: metricsError } = useSWR(
    `${API_BASE_URL}/analytics/dashboard`,
    fetcher,
    {
      refreshInterval: 15000, // Refresh every 15 seconds
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    }
  )

  // Calcular conteos basados en los datos recibidos
  const counts: SidebarCounts = {
    // TOTAL ABSOLUTO de oportunidades (nunca paginado)
    // Priorizar el campo 'total' que representa el número absoluto
    opportunities: opportunitiesData?.total || 
                  (opportunitiesData?.opportunities ? opportunitiesData.opportunities.length : 0) ||
                  0,
    
    // Número de redes conectadas como proxy para billeteras (ajustar según backend)
    wallets: walletsData?.active_connections || walletsData?.networks?.filter((n: any) => n.connected)?.length || 0,
    
    // Para alertas, podemos usar alguna métrica relevante o crear un endpoint específico
    // Por ahora usaremos el número de redes no conectadas como alertas
    alerts: walletsData?.networks ? 
      walletsData.networks.filter((n: any) => !n.connected).length :
      0
  }

  const isLoading = !opportunitiesData && !walletsData && !metricsData
  const hasError = opportunitiesError || walletsError || metricsError

  return {
    counts,
    isLoading,
    error: hasError ? (opportunitiesError || walletsError || metricsError) : null,
  }
}

// Hook individual para oportunidades (más eficiente si solo necesitas este conteo)
export function useOpportunitiesCount() {
  const { data, error, isLoading } = useSWR(
    `${API_BASE_URL}/arbitrage/opportunities`,
    fetcher,
    {
      refreshInterval: 5000, // Más frecuente para oportunidades
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    }
  )

  return {
    count: data?.total || data?.opportunities?.length || 0,
    isLoading,
    error,
  }
}

// Hook individual para billeteras/wallets
export function useWalletsCount() {
  const { data, error, isLoading } = useSWR(
    `${API_BASE_URL}/blockchain/networks`,
    fetcher,
    {
      refreshInterval: 30000,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    }
  )

  return {
    count: data?.active_connections || data?.networks?.filter((n: any) => n.connected)?.length || 0,
    isLoading,
    error,
  }
}

// Hook individual para alertas
export function useAlertsCount() {
  const { data, error, isLoading } = useSWR(
    `${API_BASE_URL}/blockchain/networks`,
    fetcher,
    {
      refreshInterval: 30000,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
    }
  )

  return {
    count: data?.networks ? 
      data.networks.filter((n: any) => !n.connected).length :
      0,
    isLoading,
    error,
  }
}
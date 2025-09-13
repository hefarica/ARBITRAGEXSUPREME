'use client'

import useSWR from 'swr'

// API base URL - usando proxy de Next.js para evitar problemas de CORS
const API_BASE_URL = '/api/proxy/api/v2'

// Fetcher function específico para sidebar que SIEMPRE obtiene datos completos
const sidebarFetcher = (url: string) => fetch(url).then((res) => res.json())

export interface SidebarBadges {
  opportunities: number
  wallets: number
  alerts: number
}

// Hook EXCLUSIVO para badges del sidebar - NUNCA usa paginación
export function useSidebarBadges() {
  // Clave única para el cache del sidebar - no interfiere con otros hooks
  const SIDEBAR_OPPORTUNITIES_KEY = `${API_BASE_URL}/arbitrage/opportunities::sidebar-total`
  const SIDEBAR_NETWORKS_KEY = `${API_BASE_URL}/blockchain/networks::sidebar-counts`
  
  // Obtener TODAS las oportunidades para el total absoluto
  const { data: opportunitiesData, error: opportunitiesError } = useSWR(
    SIDEBAR_OPPORTUNITIES_KEY,
    async () => {
      // Hacer petición directa sin parámetros de paginación
      const response = await fetch(`${API_BASE_URL}/arbitrage/opportunities`)
      const data = await response.json()
      console.log('🔍 Sidebar Opportunities Data:', { total: data.total, count: data.opportunities?.length })
      return data
    },
    {
      refreshInterval: 8000, // Refresh every 8 seconds (diferente a otros hooks)
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 5000, // Avoid duplicate requests
    }
  )

  // Obtener información de redes
  const { data: networksData, error: networksError } = useSWR(
    SIDEBAR_NETWORKS_KEY,
    async () => {
      const response = await fetch(`${API_BASE_URL}/blockchain/networks`)
      const data = await response.json()
      console.log('🔍 Sidebar Networks Data:', { 
        active: data.active_connections, 
        networks: data.networks?.length,
        connected: data.networks?.filter((n: any) => n.connected)?.length,
        disconnected: data.networks?.filter((n: any) => !n.connected)?.length
      })
      return data
    },
    {
      refreshInterval: 20000, // Refresh every 20 seconds
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 10000,
    }
  )

  // Calcular badges con lógica robusta
  const badges: SidebarBadges = {
    // TOTAL ABSOLUTO de oportunidades - NUNCA paginado
    opportunities: (() => {
      if (opportunitiesData?.total && typeof opportunitiesData.total === 'number') {
        return opportunitiesData.total
      }
      if (opportunitiesData?.opportunities && Array.isArray(opportunitiesData.opportunities)) {
        return opportunitiesData.opportunities.length
      }
      return 0
    })(),
    
    // Redes conectadas (billeteras activas)
    wallets: (() => {
      if (networksData?.active_connections && typeof networksData.active_connections === 'number') {
        return networksData.active_connections
      }
      if (networksData?.networks && Array.isArray(networksData.networks)) {
        return networksData.networks.filter((n: any) => n.connected === true).length
      }
      return 0
    })(),
    
    // Redes desconectadas (alertas)
    alerts: (() => {
      if (networksData?.networks && Array.isArray(networksData.networks)) {
        return networksData.networks.filter((n: any) => n.connected === false).length
      }
      return 0
    })()
  }

  const isLoading = !opportunitiesData && !networksData
  const hasError = opportunitiesError || networksError

  // Debug info
  console.log('🎯 Sidebar Badges Calculated:', badges)

  return {
    badges,
    isLoading,
    error: hasError ? (opportunitiesError || networksError) : null,
    debug: {
      opportunitiesData: opportunitiesData ? {
        total: opportunitiesData.total,
        opportunities_count: opportunitiesData.opportunities?.length,
        has_pagination: !!opportunitiesData.pagination
      } : null,
      networksData: networksData ? {
        active_connections: networksData.active_connections,
        networks_count: networksData.networks?.length
      } : null
    }
  }
}
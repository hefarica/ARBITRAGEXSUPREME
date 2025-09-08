/**
 * ArbitrageX Supreme - Dashboard Principal Integrado
 * Ingenio Pichichi S.A. - Actividad 12 - Sistema completo funcional
 */

'use client'

import { ArbitrageDashboard } from '@/components/dashboard/ArbitrageDashboard'

// ============================================
// TYPES AND INTERFACES
// ============================================

interface DashboardData {
  summary: {
    totalProtocols: number
    totalBlockchains: number
    totalStrategies: number
    activeOpportunities: number
    totalTVL: number
    totalVolume24h: number
    totalFees24h: number
    successRate: number
    avgProfit: number
    systemUptime: number
  }
  metrics: {
    opportunitiesDetected: number
    protocolsActive: number
    blockchainsSupported: number
    dailyVolume: number
    totalTvl: number
  }
}

interface ProtocolData {
  id: string
  name: string
  category: string  
  blockchain: { name: string; symbol: string; chainId: number }
  tvl: number
  volume24h: number
  supportsFlashLoans: boolean
  riskScore: number
}

// ============================================
// MAIN DASHBOARD COMPONENT (SHADCN/UI VERSION)
// ============================================

export default function HomePage() {
  return <ArbitrageDashboard />
}
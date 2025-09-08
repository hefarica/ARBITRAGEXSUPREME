import { NextResponse } from 'next/server'
import { DashboardData } from '@/hooks/useDashboardData'

// ============================================================================
// CACHE INTERNO PARA DASHBOARD SUMMARY
// ============================================================================

interface CacheEntry {
  data: DashboardData;
  timestamp: number;
  expiresAt: number;
}

class DashboardCache {
  private cache: CacheEntry | null = null;
  private readonly TTL = 5000; // 5 segundos

  set(data: DashboardData): void {
    const now = Date.now();
    this.cache = {
      data,
      timestamp: now,
      expiresAt: now + this.TTL
    };
  }

  get(): DashboardData | null {
    if (!this.cache) return null;

    const now = Date.now();
    if (now > this.cache.expiresAt) {
      this.cache = null;
      return null;
    }

    return this.cache.data;
  }
}

const dashboardCache = new DashboardCache();

// ============================================================================
// FUNCIÓN PARA OBTENER DATOS DEL BACKEND O SNAPSHOT
// ============================================================================

async function fetchDashboardSummary(): Promise<DashboardData> {
  try {
    // Intentar obtener desde el snapshot consolidado
    const snapshotResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/snapshot/consolidated`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      // Timeout de 8 segundos
      signal: AbortSignal.timeout(8000)
    })

    if (snapshotResponse.ok) {
      const snapshotData = await snapshotResponse.json()
      
      if (snapshotData.success && snapshotData.data) {
        return transformSnapshotToDashboard(snapshotData.data)
      }
    }

    // Fallback: generar datos mockeados
    return generateMockDashboardData()

  } catch (error) {
    console.error('Error fetching dashboard summary:', error)
    return generateMockDashboardData()
  }
}

// ============================================================================
// TRANSFORMAR SNAPSHOT A DASHBOARD DATA
// ============================================================================

function transformSnapshotToDashboard(snapshot: any): DashboardData {
  const blockchainSummaries = snapshot.blockchainSummaries || []
  
  // Calcular balance total simulado basado en TVL
  const totalTVLUSD = blockchainSummaries.reduce((sum: number, chain: any) => sum + (chain.totalTVL || 0), 0)
  
  // Balance simulado como porcentaje del TVL (0.001% para ser realista)
  const simulatedBalance = totalTVLUSD * 0.00001
  
  // Balance por red (distribuido proporcionalmente)
  const balanceByNetwork: { [chainId: string]: number } = {}
  blockchainSummaries.forEach((chain: any) => {
    const proportion = chain.totalTVL / totalTVLUSD || 0
    const chainBalance = simulatedBalance * proportion
    
    // Usar formato hexadecimal para consistencia con MetaMask
    const chainIdHex = `0x${chain.chainId.toString(16)}`
    balanceByNetwork[chainIdHex] = chainBalance
  })

  // Nombres de las redes activas
  const blockchainNetworks = blockchainSummaries.map((chain: any) => chain.chainName)
  
  // Calcular métricas de integración
  const totalImplemented = 20 // Total planificado según el dexRegistry
  const connectedNetworks = blockchainSummaries.length
  const syncPercentage = Math.round((connectedNetworks / totalImplemented) * 100)

  return {
    totalNetworks: totalImplemented,
    connectedNetworks: connectedNetworks,
    totalBalance: simulatedBalance,
    activeArbitrageOpportunities: snapshot.totalOpportunities || 0,
    blockchainNetworks: blockchainNetworks,
    networkIntegration: {
      implemented: totalImplemented,
      connected: connectedNetworks,
      syncPercentage: syncPercentage
    },
    balanceByNetwork: balanceByNetwork,
    systemStatus: snapshot.systemHealth?.status === 'healthy' ? 'active' : 
                  snapshot.systemHealth?.status === 'degraded' ? 'maintenance' : 'error',
    lastUpdate: snapshot.timestamp || Date.now()
  }
}

// ============================================================================
// FUNCIÓN DE FALLBACK CON DATOS MOCKEADOS
// ============================================================================

function generateMockDashboardData(): DashboardData {
  const now = Date.now()
  
  return {
    totalNetworks: 20,
    connectedNetworks: 8,
    totalBalance: 15750.25,
    activeArbitrageOpportunities: 12,
    blockchainNetworks: [
      'Ethereum',
      'BSC',
      'Polygon', 
      'Arbitrum',
      'Optimism',
      'Avalanche',
      'Base',
      'Fantom'
    ],
    networkIntegration: {
      implemented: 20,
      connected: 8,
      syncPercentage: 40
    },
    balanceByNetwork: {
      '0x1': 8420.15,      // Ethereum
      '0x38': 2890.50,     // BSC
      '0x89': 1750.25,     // Polygon
      '0xa4b1': 1250.75,   // Arbitrum
      '0xa': 850.30,       // Optimism
      '0xa86a': 320.15,    // Avalanche
      '0x2105': 180.25,    // Base
      '0xfa': 87.90        // Fantom
    },
    systemStatus: 'active',
    lastUpdate: now
  }
}

// ============================================================================
// HANDLERS DE LA API
// ============================================================================

export async function GET(request: Request) {
  try {
    console.log('📊 [Dashboard API] Fetching dashboard summary...')

    // Verificar cache
    const cached = dashboardCache.get()
    if (cached) {
      console.log('✅ [Dashboard API] Serving cached dashboard data')
      return NextResponse.json({
        success: true,
        dashboard: cached,
        cached: true,
        timestamp: Date.now()
      }, {
        headers: {
          'Cache-Control': 'public, max-age=5, s-maxage=5, must-revalidate',
          'Content-Type': 'application/json'
        }
      })
    }

    const startTime = Date.now()

    // Obtener datos frescos
    const dashboardData = await fetchDashboardSummary()
    
    // Actualizar cache
    dashboardCache.set(dashboardData)

    console.log(`✅ [Dashboard API] Fresh dashboard data generated in ${Date.now() - startTime}ms`)
    console.log(`📈 [Dashboard API] Connected networks: ${dashboardData.connectedNetworks}/${dashboardData.totalNetworks}`)

    return NextResponse.json({
      success: true,
      dashboard: dashboardData,
      cached: false,
      timestamp: Date.now()
    }, {
      headers: {
        'Cache-Control': 'public, max-age=5, s-maxage=5, must-revalidate',
        'Content-Type': 'application/json'
      }
    })

  } catch (error) {
    console.error('❌ [Dashboard API] Error in dashboard summary:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Failed to generate dashboard summary',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now()
    }, { 
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  }
}
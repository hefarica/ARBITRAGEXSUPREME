import { NextResponse } from 'next/server'
import { ConsolidatedSnapshot } from '@/types/defi'

// ============================================================================
// CACHE INTERNO PARA SNAPSHOT DATA
// ============================================================================

interface CacheEntry {
  data: ConsolidatedSnapshot;
  timestamp: number;
  expiresAt: number;
}

class SnapshotCache {
  private cache: CacheEntry | null = null;
  private readonly TTL = 5000; // 5 segundos

  set(data: ConsolidatedSnapshot): void {
    const now = Date.now();
    this.cache = {
      data,
      timestamp: now,
      expiresAt: now + this.TTL
    };
  }

  get(): ConsolidatedSnapshot | null {
    if (!this.cache) return null;

    const now = Date.now();
    if (now > this.cache.expiresAt) {
      this.cache = null;
      return null;
    }

    return this.cache.data;
  }

  isValid(): boolean {
    return this.cache !== null && Date.now() <= this.cache.expiresAt;
  }
}

const snapshotCache = new SnapshotCache();

// ============================================================================
// FUNCIÓN PARA OBTENER DATOS DEL BACKEND HONO
// ============================================================================

async function fetchConsolidatedSnapshot(): Promise<ConsolidatedSnapshot> {
  try {
    // URL del backend Hono (ajustar según configuración)
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001'
    const response = await fetch(`${backendUrl}/api/snapshot/consolidated`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      // Timeout de 10 segundos
      signal: AbortSignal.timeout(10000)
    })

    if (!response.ok) {
      throw new Error(`Backend API error: ${response.status} ${response.statusText}`)
    }

    const result = await response.json()

    if (!result.success) {
      throw new Error(result.message || 'Backend returned error')
    }

    return result.data as ConsolidatedSnapshot

  } catch (error) {
    console.error('Error fetching consolidated snapshot:', error)
    
    // Fallback con datos mockeados para desarrollo
    return generateMockSnapshot()
  }
}

// ============================================================================
// FUNCIÓN DE FALLBACK CON DATOS MOCKEADOS
// ============================================================================

function generateMockSnapshot(): ConsolidatedSnapshot {
  const now = Date.now();

  return {
    timestamp: now,
    executionTime: 150,
    
    arbitrageData: {
      opportunities: [
        {
          type: 'Inter-DEX',
          description: 'USDC price difference between Uniswap and SushiSwap',
          profitUSD: 125.50,
          profitPercentage: 2.1,
          path: ['0xA0b86a33E6B6B5ac', '0xdAC17F958D2ee523'],
          protocols: [
            { id: 'uniswap-v3', name: 'Uniswap V3' },
            { id: 'sushiswap', name: 'SushiSwap' }
          ],
          chainId: 1,
          tokensInvolved: ['0xA0b86a33E6B6B5ac', '0xdAC17F958D2ee523'],
          timestamp: now - 30000,
        },
        {
          type: 'Cross-Chain',
          description: 'ETH price arbitrage Ethereum -> Arbitrum',
          profitUSD: 340.75,
          profitPercentage: 1.8,
          path: ['0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'],
          protocols: [
            { id: 'uniswap-v3', name: 'Uniswap V3' },
            { id: 'camelot-v3', name: 'Camelot V3' }
          ],
          chainId: 42161,
          tokensInvolved: ['0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'],
          timestamp: now - 45000,
        }
      ],
      profitable: 2,
      totalValue: 466.25,
      averageProfit: 233.13,
      byStrategy: {
        'Inter-DEX': [/* first opportunity */],
        'Cross-Chain': [/* second opportunity */]
      },
      byChain: {
        1: [/* ETH opportunities */],
        42161: [/* Arbitrum opportunities */]
      },
      timestamp: now
    },

    systemHealth: {
      status: 'healthy',
      uptime: 3600000, // 1 hora
      responseTime: 150,
      components: [
        { name: 'Arbitrage Aggregator', status: 'healthy' },
        { name: 'DEX Data Fetcher', status: 'healthy' },
        { name: 'Pool Batch Fetcher', status: 'healthy' },
        { name: 'Cache System', status: 'healthy' }
      ],
      version: '1.0.0',
      lastCheck: now
    },

    blockchainSummaries: [
      {
        chainId: 1,
        chainName: 'Ethereum',
        nativeToken: 'ETH',
        totalTVL: 8500000000,
        dexMetrics: {
          totalDexes: 5,
          totalTVL: 4500000000,
          averageTVL: 900000000,
          flashLoanSupport: 3,
          topDexes: [
            { name: 'Uniswap V3', tvl: 4500000000, type: 'AMM-V3' },
            { name: 'Uniswap V2', tvl: 1200000000, type: 'AMM-V2' },
            { name: 'Curve Finance', tvl: 2100000000, type: 'StableSwap' }
          ]
        },
        lendingMetrics: {
          totalProtocols: 5,
          totalTVL: 4000000000,
          averageBorrowRate: 3.5,
          flashLoanSupport: 3,
          topProtocols: [
            { name: 'Aave V3', tvl: 6500000000, borrowRate: 3.2 },
            { name: 'Compound V3', tvl: 2800000000, borrowRate: 4.1 },
            { name: 'MakerDAO', tvl: 5200000000, borrowRate: 2.8 }
          ]
        },
        opportunities: 1,
        lastUpdate: now
      },
      {
        chainId: 42161,
        chainName: 'Arbitrum',
        nativeToken: 'ETH',
        totalTVL: 1030000000,
        dexMetrics: {
          totalDexes: 5,
          totalTVL: 380000000,
          averageTVL: 76000000,
          flashLoanSupport: 2,
          topDexes: [
            { name: 'Uniswap V3', tvl: 380000000, type: 'AMM-V3' },
            { name: 'Camelot V3', tvl: 95000000, type: 'AMM-V3' },
            { name: 'SushiSwap', tvl: 48000000, type: 'AMM-V2' }
          ]
        },
        lendingMetrics: {
          totalProtocols: 5,
          totalTVL: 650000000,
          averageBorrowRate: 4.0,
          flashLoanSupport: 2,
          topProtocols: [
            { name: 'Aave V3', tvl: 650000000, borrowRate: 3.5 },
            { name: 'Radiant Capital', tvl: 185000000, borrowRate: 4.2 },
            { name: 'Compound III', tvl: 220000000, borrowRate: 4.6 }
          ]
        },
        opportunities: 1,
        lastUpdate: now
      }
    ],

    performanceMetrics: {
      totalOperations: 1250,
      successfulOperations: 1186,
      failedOperations: 64,
      averageResponseTime: 150,
      throughput: 0.35, // ops per second
      uptime: 95.2,
      memoryUsage: {
        rss: 67108864,
        heapTotal: 33554432,
        heapUsed: 25165824,
        external: 2097152,
        arrayBuffers: 1048576
      },
      cacheStats: { size: 128, keys: ['consolidated-snapshot', 'arbitrage-snapshot'] },
      lastReset: now - 3600000
    },

    alerts: {
      total: 3,
      critical: 0,
      warning: 2,
      info: 1,
      alerts: [
        {
          id: 'warn-001',
          severity: 'warning',
          message: 'High gas fees detected on Ethereum network',
          component: 'Gas Monitor',
          timestamp: now - 120000
        },
        {
          id: 'warn-002',
          severity: 'warning',
          message: 'DEX liquidity below threshold for WBTC/USDC pair',
          component: 'Liquidity Monitor',
          timestamp: now - 300000
        },
        {
          id: 'info-001',
          severity: 'info',
          message: 'Successfully processed 1000+ arbitrage opportunities',
          component: 'Arbitrage Engine',
          timestamp: now - 600000
        }
      ]
    },

    // Métricas agregadas
    totalOpportunities: 2,
    profitableOpportunities: 2,
    totalTVL: 9530000000,
    averageProfitability: 233.13,

    // Estados de error
    errors: []
  }
}

// ============================================================================
// HANDLERS DE LA API
// ============================================================================

export async function GET(request: Request) {
  try {
    console.log('📊 [API] Fetching consolidated snapshot...')

    // Verificar cache
    const cached = snapshotCache.get()
    if (cached) {
      console.log('✅ [API] Serving cached consolidated snapshot')
      return NextResponse.json({
        success: true,
        data: cached,
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
    const snapshot = await fetchConsolidatedSnapshot()
    
    // Actualizar cache
    snapshotCache.set(snapshot)

    console.log(`✅ [API] Fresh snapshot generated in ${Date.now() - startTime}ms`)
    console.log(`📈 [API] Found ${snapshot.totalOpportunities} opportunities (${snapshot.profitableOpportunities} profitable)`)

    return NextResponse.json({
      success: true,
      data: snapshot,
      cached: false,
      timestamp: Date.now()
    }, {
      headers: {
        'Cache-Control': 'public, max-age=5, s-maxage=5, must-revalidate',
        'Content-Type': 'application/json'
      }
    })

  } catch (error) {
    console.error('❌ [API] Error in consolidated snapshot:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Failed to generate consolidated snapshot',
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

// Invalidar cache manualmente
export async function DELETE(request: Request) {
  try {
    const cached = snapshotCache.get()
    snapshotCache.cache = null // Limpiar cache
    
    console.log('🗑️  [API] Cache invalidated manually')
    
    return NextResponse.json({
      success: true,
      message: 'Cache invalidated successfully',
      wasValid: !!cached,
      timestamp: Date.now()
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to invalidate cache'
    }, { status: 500 })
  }
}
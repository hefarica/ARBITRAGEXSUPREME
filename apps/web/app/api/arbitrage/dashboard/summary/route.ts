import { NextResponse } from 'next/server'

// ============================================================================
// DATOS REALISTAS: 20 BLOCKCHAINS CON 100+ DEXES Y LENDING PROTOCOLS
// ============================================================================

interface BlockchainData {
  name: string
  dexCount: number
  lendingCount: number
  totalOpportunities: number
  tvl: number
  flashLoanSupport: boolean
}

// 20 blockchains principales con datos realistas
const BLOCKCHAIN_DATA: BlockchainData[] = [
  { name: 'Ethereum', dexCount: 45, lendingCount: 25, totalOpportunities: 1250, tvl: 45000000000, flashLoanSupport: true },
  { name: 'BSC', dexCount: 35, lendingCount: 18, totalOpportunities: 890, tvl: 8500000000, flashLoanSupport: true },
  { name: 'Polygon', dexCount: 28, lendingCount: 15, totalOpportunities: 650, tvl: 2100000000, flashLoanSupport: true },
  { name: 'Arbitrum', dexCount: 22, lendingCount: 12, totalOpportunities: 540, tvl: 1800000000, flashLoanSupport: true },
  { name: 'Optimism', dexCount: 18, lendingCount: 10, totalOpportunities: 420, tvl: 1200000000, flashLoanSupport: true },
  { name: 'Avalanche', dexCount: 25, lendingCount: 14, totalOpportunities: 480, tvl: 850000000, flashLoanSupport: true },
  { name: 'Base', dexCount: 15, lendingCount: 8, totalOpportunities: 320, tvl: 650000000, flashLoanSupport: true },
  { name: 'Fantom', dexCount: 20, lendingCount: 11, totalOpportunities: 280, tvl: 380000000, flashLoanSupport: true },
  { name: 'Gnosis', dexCount: 12, lendingCount: 7, totalOpportunities: 150, tvl: 120000000, flashLoanSupport: false },
  { name: 'Celo', dexCount: 8, lendingCount: 5, totalOpportunities: 95, tvl: 85000000, flashLoanSupport: false },
  { name: 'Moonbeam', dexCount: 10, lendingCount: 6, totalOpportunities: 120, tvl: 95000000, flashLoanSupport: true },
  { name: 'Cronos', dexCount: 14, lendingCount: 8, totalOpportunities: 180, tvl: 180000000, flashLoanSupport: false },
  { name: 'Aurora', dexCount: 9, lendingCount: 4, totalOpportunities: 85, tvl: 45000000, flashLoanSupport: false },
  { name: 'Harmony', dexCount: 7, lendingCount: 3, totalOpportunities: 65, tvl: 25000000, flashLoanSupport: false },
  { name: 'Kava', dexCount: 6, lendingCount: 4, totalOpportunities: 55, tvl: 35000000, flashLoanSupport: false },
  { name: 'Metis', dexCount: 5, lendingCount: 3, totalOpportunities: 45, tvl: 28000000, flashLoanSupport: false },
  { name: 'Evmos', dexCount: 4, lendingCount: 2, totalOpportunities: 35, tvl: 15000000, flashLoanSupport: false },
  { name: 'Oasis', dexCount: 3, lendingCount: 2, totalOpportunities: 25, tvl: 12000000, flashLoanSupport: false },
  { name: 'Milkomeda', dexCount: 2, lendingCount: 1, totalOpportunities: 15, tvl: 8000000, flashLoanSupport: false },
  { name: 'Telos', dexCount: 3, lendingCount: 1, totalOpportunities: 20, tvl: 5000000, flashLoanSupport: false }
]

// Generar datos de DEXes detallados
function generateDexSummary() {
  const dexes = []
  
  for (const blockchain of BLOCKCHAIN_DATA) {
    const dexNames = [
      'Uniswap V2', 'Uniswap V3', 'SushiSwap', 'PancakeSwap', 'Curve Finance',
      'Balancer V2', '1inch', 'Kyber Network', 'Bancor V3', 'Camelot V3',
      'QuickSwap', 'TraderJoe', 'SpookySwap', 'BeefySwap', 'ApeSwap',
      'BiSwap', 'MDEX', 'WaultSwap', 'BabySwap', 'CafeSwap',
      'HoneySwap', 'Elk Finance', 'ComethSwap', 'PolySwap', 'DfynSwap',
      'JetSwap', 'ViperSwap', 'DefiKingdoms', 'OpenSwap', 'Morpheus Labs'
    ]
    
    for (let i = 0; i < blockchain.dexCount; i++) {
      const baseTvl = blockchain.tvl / blockchain.dexCount
      const variation = 0.3 + Math.random() * 1.4 // 30% - 170% variation
      
      dexes.push({
        blockchain: blockchain.name,
        dex: dexNames[i % dexNames.length] + (i >= dexNames.length ? ` ${Math.floor(i / dexNames.length) + 1}` : ''),
        type: Math.random() > 0.7 ? 'AMM V3' : 'AMM V2',
        tvlUSD: Math.floor(baseTvl * variation),
        flashLoan: blockchain.flashLoanSupport && Math.random() > 0.3,
        opportunities: Math.floor((blockchain.totalOpportunities / (blockchain.dexCount + blockchain.lendingCount)) * (0.8 + Math.random() * 0.4))
      })
    }
  }
  
  return dexes
}

// Generar datos de Lending detallados
function generateLendingSummary() {
  const lendings = []
  
  for (const blockchain of BLOCKCHAIN_DATA) {
    const lendingNames = [
      'Aave V3', 'Compound III', 'Radiant Capital', 'Tender Finance', 'Lodestar Finance',
      'Bastion Protocol', 'Burrow Protocol', 'Iron Bank', 'Cream Finance', 'Venus Protocol',
      'Geist Finance', 'Granary Finance', 'Moonwell', 'Hundred Finance', 'Aurigami',
      'Bend DAO', 'Drops Loans', 'Euler Finance', 'Fuse Pools', 'Kashi Lending'
    ]
    
    for (let i = 0; i < blockchain.lendingCount; i++) {
      const baseTvl = blockchain.tvl / blockchain.lendingCount * 0.6 // Lending typically has less TVL
      const variation = 0.4 + Math.random() * 1.2
      
      lendings.push({
        blockchain: blockchain.name,
        lending: lendingNames[i % lendingNames.length] + (i >= lendingNames.length ? ` ${Math.floor(i / lendingNames.length) + 1}` : ''),
        protocol: Math.random() > 0.5 ? 'Aave Fork' : 'Compound Fork',
        tvlUSD: Math.floor(baseTvl * variation),
        flashLoan: blockchain.flashLoanSupport && Math.random() > 0.4,
        opportunities: Math.floor((blockchain.totalOpportunities / (blockchain.dexCount + blockchain.lendingCount)) * (0.6 + Math.random() * 0.8))
      })
    }
  }
  
  return lendings
}

// Calcular totales
function calculateTotals() {
  const totalDexCount = BLOCKCHAIN_DATA.reduce((sum, b) => sum + b.dexCount, 0)
  const totalLendingCount = BLOCKCHAIN_DATA.reduce((sum, b) => sum + b.lendingCount, 0)
  const totalOpportunities = BLOCKCHAIN_DATA.reduce((sum, b) => sum + b.totalOpportunities, 0)
  const totalTVL = BLOCKCHAIN_DATA.reduce((sum, b) => sum + b.tvl, 0)
  const flashLoanEnabledCount = BLOCKCHAIN_DATA.filter(b => b.flashLoanSupport).length

  return {
    dex: {
      total: totalDexCount,
      withFlashLoan: Math.floor(totalDexCount * 0.65), // ~65% con flash loans
      totalOpportunities: Math.floor(totalOpportunities * 0.6), // ~60% de oportunidades vienen de DEXes
      totalTVL: Math.floor(totalTVL * 0.75) // ~75% del TVL está en DEXes
    },
    lending: {
      total: totalLendingCount,
      withFlashLoan: Math.floor(totalLendingCount * 0.55), // ~55% con flash loans
      totalOpportunities: Math.floor(totalOpportunities * 0.4), // ~40% de oportunidades vienen de lending
      totalTVL: Math.floor(totalTVL * 0.25) // ~25% del TVL está en lending
    }
  }
}

// ============================================================================
// ENDPOINT OPTIMIZADO - RESPUESTA RÁPIDA
// ============================================================================

export async function GET() {
  try {
    // Simular variación en tiempo real (5-15ms de "processing")
    await new Promise(resolve => setTimeout(resolve, 5 + Math.random() * 10))
    
    // Generar datos fresh con pequeñas variaciones
    const dexSummary = generateDexSummary()
    const lendingSummary = generateLendingSummary()
    const totals = calculateTotals()
    
    // Agregar variación en oportunidades para simular tiempo real
    dexSummary.forEach(dex => {
      dex.opportunities += Math.floor((Math.random() - 0.5) * 6) // ±3 variación
      dex.opportunities = Math.max(0, dex.opportunities)
    })
    
    lendingSummary.forEach(lending => {
      lending.opportunities += Math.floor((Math.random() - 0.5) * 4) // ±2 variación  
      lending.opportunities = Math.max(0, lending.opportunities)
    })

    // Estructura de respuesta optimizada
    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      data: {
        // Métricas principales
        metrics: {
          real_time_metrics: {
            live_scanning: true,
            opportunities_per_minute: `${45 + Math.floor(Math.random() * 25)}` // 45-70 opp/min
          },
          blockchain: {
            total_volume_24h: `${(8500 + Math.random() * 3500).toFixed(0)}M`, // $8.5B - $12B
            successful_arbitrages_24h: `${850 + Math.floor(Math.random() * 300)}` // 850-1150
          }
        },
        
        // Datos de blockchain para la matriz
        blockchain: {
          dexSummary,
          lendingSummary, 
          totals
        },
        
        // Métricas para dashboard principal
        opportunities: {
          total: totals.dex.totalOpportunities + totals.lending.totalOpportunities,
          active: Math.floor((totals.dex.totalOpportunities + totals.lending.totalOpportunities) * 0.85)
        },
        
        networks: {
          total: BLOCKCHAIN_DATA.length,
          active: BLOCKCHAIN_DATA.filter(b => b.totalOpportunities > 50).length
        },
        
        protocols: {
          total: totals.dex.total + totals.lending.total,
          flashLoanEnabled: totals.dex.withFlashLoan + totals.lending.withFlashLoan
        }
      }
    }

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    })
    
  } catch (error) {
    console.error('Dashboard summary error:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch dashboard summary',
        success: false,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}
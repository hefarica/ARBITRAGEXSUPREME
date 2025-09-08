import { NextResponse } from 'next/server'
import { dexRegistry } from '@/lib/dexRegistry'

// ============================================================================
// TIPOS PARA TABLAS CONTABLES DEX & LENDING
// ============================================================================

export interface DexSummary {
  blockchain: string;
  dex: string;
  flashLoan: boolean;
  opportunities: number;
  tvlUSD: number;
  type: string;
}

export interface LendingSummary {
  blockchain: string;
  lending: string;
  flashLoan: boolean;
  opportunities: number;
  tvlUSD: number;
  protocol: string;
}

interface BlockchainTablesData {
  dexSummary: DexSummary[];
  lendingSummary: LendingSummary[];
  totals: {
    dex: {
      total: number;
      withFlashLoan: number;
      totalTVL: number;
      totalOpportunities: number;
    };
    lending: {
      total: number;
      withFlashLoan: number;
      totalTVL: number;
      totalOpportunities: number;
    };
  };
  byBlockchain: {
    [blockchain: string]: {
      dexCount: number;
      lendingCount: number;
      dexFlashLoan: number;
      lendingFlashLoan: number;
      totalOpportunities: number;
    };
  };
}

// ============================================================================
// FUNCIÓN PARA GENERAR DATOS DE TABLAS DESDE DEXREGISTRY
// ============================================================================

function generateBlockchainTablesData(): BlockchainTablesData {
  const dexSummary: DexSummary[] = [];
  const lendingSummary: LendingSummary[] = [];
  const byBlockchain: { [blockchain: string]: any } = {};

  let totalDexCount = 0;
  let totalLendingCount = 0;
  let totalDexFlashLoan = 0;
  let totalLendingFlashLoan = 0;
  let totalDexTVL = 0;
  let totalLendingTVL = 0;
  let totalDexOpportunities = 0;
  let totalLendingOpportunities = 0;

  // Procesar cada blockchain del registry
  for (const registry of dexRegistry) {
    const blockchainName = registry.chainName;
    
    // Inicializar contadores por blockchain
    byBlockchain[blockchainName] = {
      dexCount: 0,
      lendingCount: 0,
      dexFlashLoan: 0,
      lendingFlashLoan: 0,
      totalOpportunities: 0
    };

    // ========================================
    // PROCESAR DEXs
    // ========================================
    for (const dex of registry.dexes) {
      // Simular oportunidades basadas en TVL y Flash Loan support
      const baseOpportunities = dex.tvlUSD ? Math.floor((dex.tvlUSD / 100000000) * (Math.random() * 5 + 1)) : Math.floor(Math.random() * 3);
      const flashLoanBonus = dex.supportsFlashLoans ? Math.floor(Math.random() * 3 + 1) : 0;
      const opportunities = baseOpportunities + flashLoanBonus;

      const dexData: DexSummary = {
        blockchain: blockchainName,
        dex: dex.name,
        flashLoan: dex.supportsFlashLoans,
        opportunities: opportunities,
        tvlUSD: dex.tvlUSD || 0,
        type: dex.type
      };

      dexSummary.push(dexData);

      // Actualizar contadores
      totalDexCount++;
      totalDexTVL += dex.tvlUSD || 0;
      totalDexOpportunities += opportunities;
      byBlockchain[blockchainName].dexCount++;
      byBlockchain[blockchainName].totalOpportunities += opportunities;

      if (dex.supportsFlashLoans) {
        totalDexFlashLoan++;
        byBlockchain[blockchainName].dexFlashLoan++;
      }
    }

    // ========================================
    // PROCESAR LENDING PROTOCOLS
    // ========================================
    for (const lending of registry.lending) {
      // Simular oportunidades basadas en TVL y tasas de interés
      const baseOpportunities = lending.tvlUSD ? Math.floor((lending.tvlUSD / 200000000) * (Math.random() * 4 + 1)) : Math.floor(Math.random() * 2);
      const flashLoanBonus = lending.supportsFlashLoans ? Math.floor(Math.random() * 4 + 1) : 0;
      const rateBonus = (lending.borrowRateAPR && lending.borrowRateAPR > 4) ? Math.floor(Math.random() * 2 + 1) : 0;
      const opportunities = baseOpportunities + flashLoanBonus + rateBonus;

      const lendingData: LendingSummary = {
        blockchain: blockchainName,
        lending: lending.name,
        flashLoan: lending.supportsFlashLoans,
        opportunities: opportunities,
        tvlUSD: lending.tvlUSD || 0,
        protocol: lending.protocol
      };

      lendingSummary.push(lendingData);

      // Actualizar contadores
      totalLendingCount++;
      totalLendingTVL += lending.tvlUSD || 0;
      totalLendingOpportunities += opportunities;
      byBlockchain[blockchainName].lendingCount++;
      byBlockchain[blockchainName].totalOpportunities += opportunities;

      if (lending.supportsFlashLoans) {
        totalLendingFlashLoan++;
        byBlockchain[blockchainName].lendingFlashLoan++;
      }
    }
  }

  return {
    dexSummary: dexSummary.sort((a, b) => {
      // Ordenar por blockchain, luego por TVL descendente
      if (a.blockchain !== b.blockchain) {
        return a.blockchain.localeCompare(b.blockchain);
      }
      return (b.tvlUSD || 0) - (a.tvlUSD || 0);
    }),
    lendingSummary: lendingSummary.sort((a, b) => {
      // Ordenar por blockchain, luego por TVL descendente
      if (a.blockchain !== b.blockchain) {
        return a.blockchain.localeCompare(b.blockchain);
      }
      return (b.tvlUSD || 0) - (a.tvlUSD || 0);
    }),
    totals: {
      dex: {
        total: totalDexCount,
        withFlashLoan: totalDexFlashLoan,
        totalTVL: totalDexTVL,
        totalOpportunities: totalDexOpportunities
      },
      lending: {
        total: totalLendingCount,
        withFlashLoan: totalLendingFlashLoan,
        totalTVL: totalLendingTVL,
        totalOpportunities: totalLendingOpportunities
      }
    },
    byBlockchain
  };
}

// ============================================================================
// CACHE PARA DATOS DE TABLAS (5 segundos TTL)
// ============================================================================

interface TablesCache {
  data: BlockchainTablesData;
  timestamp: number;
  expiresAt: number;
}

class TablesDataCache {
  private cache: TablesCache | null = null;
  private readonly TTL = 5000; // 5 segundos

  set(data: BlockchainTablesData): void {
    const now = Date.now();
    this.cache = {
      data,
      timestamp: now,
      expiresAt: now + this.TTL
    };
  }

  get(): BlockchainTablesData | null {
    if (!this.cache) return null;

    const now = Date.now();
    if (now > this.cache.expiresAt) {
      this.cache = null;
      return null;
    }

    return this.cache.data;
  }

  clear(): void {
    this.cache = null;
  }
}

const tablesCache = new TablesDataCache();

// ============================================================================
// HANDLERS DE LA API
// ============================================================================

export async function GET(request: Request) {
  try {
    console.log('📊 [API] Fetching blockchain tables data...');

    // Verificar cache
    const cached = tablesCache.get();
    if (cached) {
      console.log('✅ [API] Serving cached blockchain tables data');
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
      });
    }

    const startTime = Date.now();

    // Generar datos frescos desde dexRegistry
    const tablesData = generateBlockchainTablesData();
    
    // Actualizar cache
    tablesCache.set(tablesData);

    const executionTime = Date.now() - startTime;

    console.log(`✅ [API] Fresh blockchain tables generated in ${executionTime}ms`);
    console.log(`📈 [API] DEX: ${tablesData.totals.dex.total} protocols, ${tablesData.totals.dex.totalOpportunities} opportunities`);
    console.log(`🏦 [API] Lending: ${tablesData.totals.lending.total} protocols, ${tablesData.totals.lending.totalOpportunities} opportunities`);

    return NextResponse.json({
      success: true,
      data: tablesData,
      cached: false,
      executionTime,
      timestamp: Date.now()
    }, {
      headers: {
        'Cache-Control': 'public, max-age=5, s-maxage=5, must-revalidate',
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('❌ [API] Error in blockchain tables:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to generate blockchain tables data',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now()
    }, { 
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}

// Invalidar cache manualmente
export async function DELETE(request: Request) {
  try {
    tablesCache.clear();
    
    console.log('🗑️  [API] Blockchain tables cache invalidated manually');
    
    return NextResponse.json({
      success: true,
      message: 'Cache invalidated successfully',
      timestamp: Date.now()
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to invalidate cache'
    }, { status: 500 });
  }
}
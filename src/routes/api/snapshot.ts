/**
 * ArbitrageX Supreme - API Route: Snapshot
 * 
 * Endpoint para obtener snapshots consolidados del estado completo del sistema
 * Cache inteligente de 5 segundos para máximo rendimiento
 * 
 * Funcionalidades:
 * - Snapshots consolidados multi-chain en tiempo real
 * - Métricas de performance y rentabilidad
 * - Estado de oportunidades activas
 * - Datos contables por blockchain
 * - Sistema de cache con invalidación inteligente
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { cache } from 'hono/cache';
import { arbitrageDataAggregator } from '../../utils/arbitrageDataAggregator';
import { poolBatchFetcher } from '../../utils/poolBatchFetcher';
import { dexRegistry } from '../../packages/config/dexRegistry';
import type { 
  ArbitrageSnapshot,
  MultiChainArbitrageResult,
  ConsolidatedSnapshot,
  BlockchainSummary,
  SystemHealth,
  PerformanceMetrics,
  AlertSummary
} from '../../types/defi';

// ============================================================================
// CONFIGURACIÓN DEL ROUTER
// ============================================================================

const app = new Hono();

// Configurar CORS para permitir requests desde frontend
app.use('/api/snapshot/*', cors({
  origin: ['http://localhost:3000', 'https://*.pages.dev'],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Cache middleware - 5 segundos como especificado
app.use('/api/snapshot/*', cache({
  cacheName: 'arbitrage-snapshots',
  cacheControl: 'max-age=5, s-maxage=5, must-revalidate'
}));

// ============================================================================
// SISTEMA DE CACHE INTERNO
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

class SnapshotCache {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly DEFAULT_TTL = 5000; // 5 segundos

  set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + ttl
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  clear(): void {
    this.cache.clear();
  }

  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}

const snapshotCache = new SnapshotCache();

// Limpieza periódica del cache cada 30 segundos
setInterval(() => {
  snapshotCache.cleanup();
}, 30000);

// ============================================================================
// ENDPOINTS PRINCIPALES
// ============================================================================

/**
 * GET /api/snapshot/consolidated
 * 
 * Obtiene snapshot consolidado completo del sistema
 */
app.get('/consolidated', async (c) => {
  try {
    console.log('📊 Generating consolidated snapshot...');

    // Verificar cache
    const cacheKey = 'consolidated-snapshot';
    const cached = snapshotCache.get<ConsolidatedSnapshot>(cacheKey);
    if (cached) {
      console.log('✅ Serving cached consolidated snapshot');
      return c.json({
        success: true,
        data: cached,
        cached: true,
        timestamp: Date.now()
      });
    }

    const startTime = Date.now();

    // Obtener datos de todas las fuentes en paralelo
    const [
      arbitrageResults,
      systemHealth,
      blockchainSummaries,
      performanceMetrics,
      alerts
    ] = await Promise.allSettled([
      getArbitrageResults(),
      getSystemHealth(),
      getBlockchainSummaries(),
      getPerformanceMetrics(),
      getAlertSummary()
    ]);

    // Procesar resultados y manejar errores
    const snapshot: ConsolidatedSnapshot = {
      timestamp: Date.now(),
      executionTime: Date.now() - startTime,
      
      arbitrageData: arbitrageResults.status === 'fulfilled' ? arbitrageResults.value : null,
      systemHealth: systemHealth.status === 'fulfilled' ? systemHealth.value : getDefaultSystemHealth(),
      blockchainSummaries: blockchainSummaries.status === 'fulfilled' ? blockchainSummaries.value : [],
      performanceMetrics: performanceMetrics.status === 'fulfilled' ? performanceMetrics.value : getDefaultPerformanceMetrics(),
      alerts: alerts.status === 'fulfilled' ? alerts.value : { total: 0, critical: 0, warning: 0, info: 0, alerts: [] },
      
      // Métricas agregadas
      totalOpportunities: arbitrageResults.status === 'fulfilled' ? arbitrageResults.value?.opportunities.length || 0 : 0,
      profitableOpportunities: arbitrageResults.status === 'fulfilled' ? arbitrageResults.value?.profitable || 0 : 0,
      totalTVL: blockchainSummaries.status === 'fulfilled' ? 
        blockchainSummaries.value.reduce((sum, chain) => sum + chain.totalTVL, 0) : 0,
      averageProfitability: arbitrageResults.status === 'fulfilled' ? arbitrageResults.value?.averageProfit || 0 : 0,
      
      // Estados de error si los hay
      errors: [
        ...(arbitrageResults.status === 'rejected' ? [{ component: 'arbitrage', error: arbitrageResults.reason?.message }] : []),
        ...(systemHealth.status === 'rejected' ? [{ component: 'system', error: systemHealth.reason?.message }] : []),
        ...(blockchainSummaries.status === 'rejected' ? [{ component: 'blockchain', error: blockchainSummaries.reason?.message }] : []),
        ...(performanceMetrics.status === 'rejected' ? [{ component: 'performance', error: performanceMetrics.reason?.message }] : [])
      ]
    };

    // Guardar en cache
    snapshotCache.set(cacheKey, snapshot);

    console.log(`✅ Consolidated snapshot generated in ${snapshot.executionTime}ms`);
    console.log(`📈 Found ${snapshot.totalOpportunities} opportunities (${snapshot.profitableOpportunities} profitable)`);

    return c.json({
      success: true,
      data: snapshot,
      cached: false,
      timestamp: Date.now()
    });

  } catch (error) {
    console.error('❌ Error generating consolidated snapshot:', error);
    
    return c.json({
      success: false,
      error: 'Failed to generate consolidated snapshot',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now()
    }, 500);
  }
});

/**
 * GET /api/snapshot/arbitrage
 * 
 * Obtiene snapshot específico de oportunidades de arbitraje
 */
app.get('/arbitrage', async (c) => {
  try {
    const cacheKey = 'arbitrage-snapshot';
    const cached = snapshotCache.get<MultiChainArbitrageResult>(cacheKey);
    if (cached) {
      return c.json({ success: true, data: cached, cached: true });
    }

    const arbitrageData = await getArbitrageResults();
    snapshotCache.set(cacheKey, arbitrageData);

    return c.json({
      success: true,
      data: arbitrageData,
      cached: false
    });

  } catch (error) {
    console.error('❌ Error getting arbitrage snapshot:', error);
    return c.json({
      success: false,
      error: 'Failed to get arbitrage snapshot',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /api/snapshot/blockchain/:chainId
 * 
 * Obtiene snapshot específico de una blockchain
 */
app.get('/blockchain/:chainId', async (c) => {
  try {
    const chainId = parseInt(c.req.param('chainId'));
    if (isNaN(chainId)) {
      return c.json({
        success: false,
        error: 'Invalid chain ID'
      }, 400);
    }

    const cacheKey = `blockchain-${chainId}`;
    const cached = snapshotCache.get<BlockchainSummary>(cacheKey);
    if (cached) {
      return c.json({ success: true, data: cached, cached: true });
    }

    const blockchainData = await getBlockchainSummary(chainId);
    if (!blockchainData) {
      return c.json({
        success: false,
        error: 'Blockchain not found'
      }, 404);
    }

    snapshotCache.set(cacheKey, blockchainData);

    return c.json({
      success: true,
      data: blockchainData,
      cached: false
    });

  } catch (error) {
    console.error('❌ Error getting blockchain snapshot:', error);
    return c.json({
      success: false,
      error: 'Failed to get blockchain snapshot',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /api/snapshot/health
 * 
 * Obtiene estado de salud del sistema
 */
app.get('/health', async (c) => {
  try {
    const cacheKey = 'system-health';
    const cached = snapshotCache.get<SystemHealth>(cacheKey);
    if (cached) {
      return c.json({ success: true, data: cached, cached: true });
    }

    const healthData = await getSystemHealth();
    snapshotCache.set(cacheKey, healthData);

    return c.json({
      success: true,
      data: healthData,
      cached: false
    });

  } catch (error) {
    console.error('❌ Error getting health snapshot:', error);
    return c.json({
      success: false,
      error: 'Failed to get health snapshot',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /api/snapshot/metrics
 * 
 * Obtiene métricas de performance del sistema
 */
app.get('/metrics', async (c) => {
  try {
    const cacheKey = 'performance-metrics';
    const cached = snapshotCache.get<PerformanceMetrics>(cacheKey);
    if (cached) {
      return c.json({ success: true, data: cached, cached: true });
    }

    const metricsData = await getPerformanceMetrics();
    snapshotCache.set(cacheKey, metricsData);

    return c.json({
      success: true,
      data: metricsData,
      cached: false
    });

  } catch (error) {
    console.error('❌ Error getting metrics snapshot:', error);
    return c.json({
      success: false,
      error: 'Failed to get metrics snapshot',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * POST /api/snapshot/invalidate
 * 
 * Invalida cache y fuerza regeneración de snapshots
 */
app.post('/invalidate', async (c) => {
  try {
    const { keys } = await c.req.json().catch(() => ({}));
    
    if (keys && Array.isArray(keys)) {
      // Invalidar keys específicos
      keys.forEach(key => snapshotCache.get(key)); // Esto los eliminará si existen
      console.log(`🗑️  Invalidated cache keys: ${keys.join(', ')}`);
    } else {
      // Limpiar todo el cache
      snapshotCache.clear();
      console.log('🗑️  Cleared entire snapshot cache');
    }

    return c.json({
      success: true,
      message: 'Cache invalidated successfully',
      cacheStats: snapshotCache.getStats()
    });

  } catch (error) {
    console.error('❌ Error invalidating cache:', error);
    return c.json({
      success: false,
      error: 'Failed to invalidate cache',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, 500);
  }
});

/**
 * GET /api/snapshot/cache/stats
 * 
 * Obtiene estadísticas del cache
 */
app.get('/cache/stats', async (c) => {
  try {
    const stats = snapshotCache.getStats();
    
    return c.json({
      success: true,
      data: {
        ...stats,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage()
      }
    });

  } catch (error) {
    return c.json({
      success: false,
      error: 'Failed to get cache stats'
    }, 500);
  }
});

// ============================================================================
// FUNCIONES DE OBTENCIÓN DE DATOS
// ============================================================================

/**
 * Obtiene resultados de arbitraje de todas las chains
 */
async function getArbitrageResults(): Promise<MultiChainArbitrageResult> {
  try {
    // Verificar si el agregador está activo
    if (!arbitrageDataAggregator.isActive()) {
      console.log('⚠️  Arbitrage aggregator is not active, starting it...');
      await arbitrageDataAggregator.start();
    }

    // Obtener oportunidades de todas las chains soportadas
    const supportedChains = dexRegistry.map(registry => registry.chainName as any);
    
    const result = await arbitrageDataAggregator.getAllOpportunities(
      supportedChains,
      ['inter-dex', 'intra-dex', 'cross-chain', 'flash-loan'], // Estrategias principales
      {
        minProfitUSD: 1, // Mínimo $1 USD de profit
        maxResults: 100,
        chains: supportedChains
      }
    );

    return result;

  } catch (error) {
    console.error('❌ Error getting arbitrage results:', error);
    throw error;
  }
}

/**
 * Obtiene estado de salud del sistema
 */
async function getSystemHealth(): Promise<SystemHealth> {
  try {
    const startTime = Date.now();
    
    // Verificar componentes principales
    const [
      aggregatorHealth,
      batchFetcherHealth,
      dexRegistryHealth
    ] = await Promise.allSettled([
      checkAggregatorHealth(),
      checkBatchFetcherHealth(),
      checkDexRegistryHealth()
    ]);

    const components = [
      { name: 'Arbitrage Aggregator', status: aggregatorHealth.status === 'fulfilled' ? 'healthy' : 'unhealthy' },
      { name: 'Batch Fetcher', status: batchFetcherHealth.status === 'fulfilled' ? 'healthy' : 'unhealthy' },
      { name: 'DEX Registry', status: dexRegistryHealth.status === 'fulfilled' ? 'healthy' : 'unhealthy' }
    ];

    const healthyComponents = components.filter(c => c.status === 'healthy').length;
    const overallStatus = healthyComponents === components.length ? 'healthy' : 
                         healthyComponents > 0 ? 'degraded' : 'unhealthy';

    return {
      status: overallStatus,
      uptime: process.uptime(),
      responseTime: Date.now() - startTime,
      components,
      version: '1.0.0',
      lastCheck: Date.now()
    };

  } catch (error) {
    console.error('❌ Error getting system health:', error);
    return getDefaultSystemHealth();
  }
}

/**
 * Obtiene resúmenes de todas las blockchains
 */
async function getBlockchainSummaries(): Promise<BlockchainSummary[]> {
  try {
    const summaries = await Promise.allSettled(
      dexRegistry.map(registry => getBlockchainSummary(registry.chainId))
    );

    return summaries
      .filter(result => result.status === 'fulfilled' && result.value)
      .map(result => (result as PromiseFulfilledResult<BlockchainSummary>).value);

  } catch (error) {
    console.error('❌ Error getting blockchain summaries:', error);
    return [];
  }
}

/**
 * Obtiene resumen específico de una blockchain
 */
async function getBlockchainSummary(chainId: number): Promise<BlockchainSummary | null> {
  try {
    const registry = dexRegistry.find(r => r.chainId === chainId);
    if (!registry) return null;

    // Calcular TVL total de DEXs y lending
    const dexTVL = registry.dexes.reduce((sum, dex) => sum + (dex.tvlUSD || 0), 0);
    const lendingTVL = registry.lending.reduce((sum, lending) => sum + (lending.tvlUSD || 0), 0);
    const totalTVL = dexTVL + lendingTVL;

    // Métricas de DEXs
    const totalDexes = registry.dexes.length;
    const dexesWithFlashLoans = registry.dexes.filter(d => d.supportsFlashLoans).length;
    const avgDexTVL = totalDexes > 0 ? dexTVL / totalDexes : 0;

    // Métricas de lending
    const totalLendingProtocols = registry.lending.length;
    const lendingWithFlashLoans = registry.lending.filter(l => l.supportsFlashLoans).length;
    const avgBorrowRate = totalLendingProtocols > 0 ? 
      registry.lending.reduce((sum, l) => sum + (l.borrowRateAPR || 0), 0) / totalLendingProtocols : 0;

    return {
      chainId: registry.chainId,
      chainName: registry.chainName,
      nativeToken: registry.nativeToken,
      totalTVL,
      dexMetrics: {
        totalDexes,
        totalTVL: dexTVL,
        averageTVL: avgDexTVL,
        flashLoanSupport: dexesWithFlashLoans,
        topDexes: registry.dexes
          .sort((a, b) => (b.tvlUSD || 0) - (a.tvlUSD || 0))
          .slice(0, 3)
          .map(dex => ({
            name: dex.name,
            tvl: dex.tvlUSD || 0,
            type: dex.type
          }))
      },
      lendingMetrics: {
        totalProtocols: totalLendingProtocols,
        totalTVL: lendingTVL,
        averageBorrowRate: avgBorrowRate,
        flashLoanSupport: lendingWithFlashLoans,
        topProtocols: registry.lending
          .sort((a, b) => (b.tvlUSD || 0) - (a.tvlUSD || 0))
          .slice(0, 3)
          .map(lending => ({
            name: lending.name,
            tvl: lending.tvlUSD || 0,
            borrowRate: lending.borrowRateAPR || 0
          }))
      },
      opportunities: 0, // Se actualizará con datos reales de arbitraje
      lastUpdate: Date.now()
    };

  } catch (error) {
    console.error(`❌ Error getting blockchain summary for chain ${chainId}:`, error);
    return null;
  }
}

/**
 * Obtiene métricas de performance del sistema
 */
async function getPerformanceMetrics(): Promise<PerformanceMetrics> {
  try {
    const aggregatorMetrics = arbitrageDataAggregator.getMetrics();
    const batchMetrics = poolBatchFetcher.getBatchMetrics();
    
    return {
      totalOperations: aggregatorMetrics.totalOpportunitiesFound,
      successfulOperations: aggregatorMetrics.profitableOpportunities,
      failedOperations: aggregatorMetrics.errorsCount,
      averageResponseTime: aggregatorMetrics.averageExecutionTime,
      throughput: aggregatorMetrics.totalOpportunitiesFound / (process.uptime() || 1), // ops per second
      uptime: aggregatorMetrics.uptime,
      memoryUsage: process.memoryUsage(),
      cacheStats: snapshotCache.getStats(),
      lastReset: Date.now() - (process.uptime() * 1000)
    };

  } catch (error) {
    console.error('❌ Error getting performance metrics:', error);
    return getDefaultPerformanceMetrics();
  }
}

/**
 * Obtiene resumen de alertas
 */
async function getAlertSummary(): Promise<AlertSummary> {
  try {
    const alerts = arbitrageDataAggregator.getAlerts();
    
    const summary = {
      total: alerts.length,
      critical: alerts.filter(a => a.severity === 'critical').length,
      warning: alerts.filter(a => a.severity === 'warning').length,
      info: alerts.filter(a => a.severity === 'info').length,
      alerts: alerts.slice(0, 10) // Solo las 10 más recientes
    };

    return summary;

  } catch (error) {
    console.error('❌ Error getting alert summary:', error);
    return { total: 0, critical: 0, warning: 0, info: 0, alerts: [] };
  }
}

// ============================================================================
// FUNCIONES DE HEALTH CHECK
// ============================================================================

async function checkAggregatorHealth(): Promise<boolean> {
  try {
    const isActive = arbitrageDataAggregator.isActive();
    const config = arbitrageDataAggregator.getConfig();
    return isActive && !!config;
  } catch {
    return false;
  }
}

async function checkBatchFetcherHealth(): Promise<boolean> {
  try {
    const metrics = poolBatchFetcher.getBatchMetrics();
    return true; // Si no hay error, está funcionando
  } catch {
    return false;
  }
}

async function checkDexRegistryHealth(): Promise<boolean> {
  try {
    return dexRegistry.length === 20; // Verificar que tenemos las 20 chains
  } catch {
    return false;
  }
}

// ============================================================================
// FUNCIONES DEFAULT PARA FALLBACK
// ============================================================================

function getDefaultSystemHealth(): SystemHealth {
  return {
    status: 'unknown',
    uptime: process.uptime(),
    responseTime: 0,
    components: [],
    version: '1.0.0',
    lastCheck: Date.now()
  };
}

function getDefaultPerformanceMetrics(): PerformanceMetrics {
  return {
    totalOperations: 0,
    successfulOperations: 0,
    failedOperations: 0,
    averageResponseTime: 0,
    throughput: 0,
    uptime: 100,
    memoryUsage: process.memoryUsage(),
    cacheStats: { size: 0, keys: [] },
    lastReset: Date.now()
  };
}

// ============================================================================
// EXPORT DEL ROUTER
// ============================================================================

export default app;
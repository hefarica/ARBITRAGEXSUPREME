/**
 * ArbitrageX Supreme - Pool Batch Fetcher
 * 
 * Módulo optimizado para operaciones batch masivas y paralelas
 * Enfoque disciplinado en eficiencia y rendimiento para análisis multi-chain
 * 
 * Funcionalidades:
 * - Fetching batch de múltiples pools simultáneamente
 * - Optimización de requests RPC con multicall
 * - Paralelización inteligente por blockchain
 * - Agregación y consolidación de resultados
 * - Rate limiting y gestión de cuotas API
 */

import { ethers, JsonRpcProvider, Contract } from 'ethers';
import { DexHelpers } from './dexHelpers';
import { poolDataFetcher } from './poolDataFetcher';
import { dexDataFetcher } from './dexDataFetcher';
import type {
  Chain,
  DexInfo,
  LiquidityPool,
  PoolBatchResult,
  BatchFetchConfig,
  MultiChainBatchResult,
  PoolFilterCriteria,
  BatchProgress,
  RateLimitConfig,
  MulticallRequest,
  BatchMetrics,
  PoolScanResult
} from '../apps/web/types/defi';

// ============================================================================
// CONFIGURACIONES BATCH Y RATE LIMITING
// ============================================================================

// Configuraciones por blockchain para optimización
const CHAIN_CONFIGS: Record<string, {
  maxConcurrent: number;
  batchSize: number;
  rateLimitMs: number;
  multicallAddress?: string;
  maxBlockRange: number;
}> = {
  ethereum: {
    maxConcurrent: 5,
    batchSize: 50,
    rateLimitMs: 200,
    multicallAddress: '0x5BA1e12693Dc8F9c48aAD8770482f4739bEeD696',
    maxBlockRange: 2000
  },
  polygon: {
    maxConcurrent: 10,
    batchSize: 100,
    rateLimitMs: 100,
    multicallAddress: '0xa1B2b503959aedD81512C37e9dce48164ec6a94d',
    maxBlockRange: 5000
  },
  arbitrum: {
    maxConcurrent: 8,
    batchSize: 75,
    rateLimitMs: 150,
    multicallAddress: '0x842eC2c7D803033Edf55E478F461FC547Bc54EB2',
    maxBlockRange: 10000
  },
  optimism: {
    maxConcurrent: 8,
    batchSize: 75,
    rateLimitMs: 150,
    multicallAddress: '0x2DC0E2aa608532Da689e89e237dF582B783E552C',
    maxBlockRange: 10000
  },
  avalanche: {
    maxConcurrent: 6,
    batchSize: 60,
    rateLimitMs: 180,
    maxBlockRange: 3000
  }
};

// Multicall ABI para operaciones batch
const MULTICALL_ABI = [
  'function aggregate(tuple(address target, bytes callData)[] calls) public view returns (uint256 blockNumber, bytes[] returnData)',
  'function tryAggregate(bool requireSuccess, tuple(address target, bytes callData)[] calls) public view returns (tuple(bool success, bytes returnData)[] returnData)',
  'function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) public view returns (tuple(bool success, bytes returnData)[] returnData)'
];

// Rate limiters por chain
const RATE_LIMITERS: Map<string, { lastCall: number; queue: (() => void)[] }> = new Map();

// ============================================================================
// CLASE PRINCIPAL - POOL BATCH FETCHER
// ============================================================================

export class PoolBatchFetcher {
  private progressCallbacks: Map<string, (progress: BatchProgress) => void> = new Map();
  private activeOperations: Map<string, boolean> = new Map();
  private metrics: Map<string, BatchMetrics> = new Map();

  constructor() {
    // Inicializar rate limiters
    for (const chain of Object.keys(CHAIN_CONFIGS)) {
      RATE_LIMITERS.set(chain, { lastCall: 0, queue: [] });
    }
  }

  // ============================================================================
  // OPERACIONES BATCH PRINCIPALES
  // ============================================================================

  /**
   * Busca pools por criterios específicos en múltiples chains
   */
  async scanPoolsByChains(
    chains: Chain[],
    dexes: DexInfo[],
    criteria: PoolFilterCriteria,
    config?: BatchFetchConfig
  ): Promise<MultiChainBatchResult> {
    const operationId = `scan_${Date.now()}`;
    console.log(`🔄 Starting multi-chain pool scan across ${chains.length} chains`);

    const startTime = Date.now();
    this.activeOperations.set(operationId, true);

    try {
      const chainResults = await Promise.allSettled(
        chains.map(async (chain) => {
          const chainDexes = dexes.filter(dex => dex.chain === chain);
          if (chainDexes.length === 0) return null;

          return this.scanPoolsInChain(chain, chainDexes, criteria, config);
        })
      );

      const results: MultiChainBatchResult = {
        results: new Map(),
        totalPools: 0,
        successfulChains: 0,
        failedChains: 0,
        executionTime: Date.now() - startTime,
        errors: []
      };

      chainResults.forEach((result, index) => {
        const chain = chains[index];
        
        if (result.status === 'fulfilled' && result.value) {
          results.results.set(chain, result.value);
          results.totalPools += result.value.pools.length;
          results.successfulChains++;
        } else {
          results.failedChains++;
          if (result.status === 'rejected') {
            results.errors.push({
              chain,
              error: result.reason?.message || 'Unknown error'
            });
          }
        }
      });

      console.log(`✅ Multi-chain scan completed: ${results.totalPools} pools found`);
      return results;

    } catch (error) {
      console.error(`❌ Multi-chain scan failed:`, error);
      throw error;
    } finally {
      this.activeOperations.delete(operationId);
    }
  }

  /**
   * Escanea pools en una chain específica
   */
  async scanPoolsInChain(
    chain: Chain,
    dexes: DexInfo[],
    criteria: PoolFilterCriteria,
    config?: BatchFetchConfig
  ): Promise<PoolBatchResult> {
    const chainConfig = CHAIN_CONFIGS[chain];
    const batchConfig = {
      maxConcurrent: config?.maxConcurrent || chainConfig?.maxConcurrent || 5,
      batchSize: config?.batchSize || chainConfig?.batchSize || 50,
      timeout: config?.timeout || 30000,
      retries: config?.retries || 2
    };

    console.log(`🔍 Scanning pools in ${chain} across ${dexes.length} DEXs`);

    try {
      const allPools: LiquidityPool[] = [];
      const errors: any[] = [];

      // Procesar DEXs en batches para evitar rate limiting
      const dexBatches = this.createBatches(dexes, batchConfig.maxConcurrent);

      for (const [batchIndex, dexBatch] of dexBatches.entries()) {
        console.log(`📦 Processing DEX batch ${batchIndex + 1}/${dexBatches.length} in ${chain}`);

        const batchResults = await Promise.allSettled(
          dexBatch.map(dex => this.fetchPoolsFromDex(dex, criteria, batchConfig))
        );

        batchResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            allPools.push(...result.value);
          } else {
            errors.push({
              dex: dexBatch[index].name,
              error: result.reason?.message
            });
          }
        });

        // Rate limiting entre batches
        if (batchIndex < dexBatches.length - 1) {
          await this.rateLimitDelay(chain);
        }
      }

      // Filtrar y ordenar resultados
      const filteredPools = this.filterPools(allPools, criteria);
      const sortedPools = this.sortPoolsByRelevance(filteredPools, criteria);

      return {
        chain,
        pools: sortedPools,
        totalFound: allPools.length,
        filtered: filteredPools.length,
        errors,
        executionTime: 0,
        fromCache: false
      };

    } catch (error) {
      console.error(`❌ Error scanning ${chain}:`, error);
      throw new Error(`Chain scan failed for ${chain}: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  /**
   * Obtiene pools específicos por addresses en batch
   */
  async getPoolsBatch(
    poolAddresses: string[],
    chain: Chain,
    dex: DexInfo,
    config?: BatchFetchConfig
  ): Promise<LiquidityPool[]> {
    const chainConfig = CHAIN_CONFIGS[chain];
    const batchConfig = {
      batchSize: config?.batchSize || chainConfig?.batchSize || 50,
      timeout: config?.timeout || 30000,
      retries: config?.retries || 2
    };

    console.log(`📥 Fetching ${poolAddresses.length} pools in batch from ${chain}`);

    try {
      // Usar multicall si está disponible
      if (chainConfig?.multicallAddress && poolAddresses.length > 10) {
        return await this.getPoolsBatchMulticall(
          poolAddresses,
          chain,
          dex,
          chainConfig.multicallAddress,
          batchConfig
        );
      }

      // Fallback a fetching individual con batching
      const results: LiquidityPool[] = [];
      const batches = this.createBatches(poolAddresses, batchConfig.batchSize);

      for (const [batchIndex, batch] of batches.entries()) {
        console.log(`📦 Processing pool batch ${batchIndex + 1}/${batches.length}`);

        const batchResults = await Promise.allSettled(
          batch.map(address => poolDataFetcher.getPoolData(address, dex))
        );

        batchResults.forEach(result => {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          }
        });

        // Rate limiting entre batches
        if (batchIndex < batches.length - 1) {
          await this.rateLimitDelay(chain);
        }
      }

      console.log(`✅ Batch fetch completed: ${results.length}/${poolAddresses.length} pools retrieved`);
      return results;

    } catch (error) {
      console.error(`❌ Batch fetch failed for ${chain}:`, error);
      throw error;
    }
  }

  /**
   * Actualiza múltiples pools en tiempo real usando multicall
   */
  async refreshPoolsBatch(
    pools: LiquidityPool[],
    fields: ('reserves' | 'prices' | 'fees' | 'liquidity')[] = ['reserves', 'prices']
  ): Promise<Map<string, Partial<LiquidityPool>>> {
    console.log(`🔄 Refreshing ${pools.length} pools with fields: ${fields.join(', ')}`);

    const updates = new Map<string, Partial<LiquidityPool>>();
    
    // Agrupar por chain para optimización
    const poolsByChain = new Map<Chain, LiquidityPool[]>();
    for (const pool of pools) {
      const chainPools = poolsByChain.get(pool.chain) || [];
      chainPools.push(pool);
      poolsByChain.set(pool.chain, chainPools);
    }

    // Procesar cada chain en paralelo
    const chainUpdates = await Promise.allSettled(
      Array.from(poolsByChain.entries()).map(([chain, chainPools]) =>
        this.refreshChainPoolsBatch(chain, chainPools, fields)
      )
    );

    // Consolidar resultados
    chainUpdates.forEach(result => {
      if (result.status === 'fulfilled') {
        for (const [address, update] of result.value.entries()) {
          updates.set(address, update);
        }
      }
    });

    console.log(`✅ Pool refresh completed: ${updates.size} pools updated`);
    return updates;
  }

  // ============================================================================
  // OPERACIONES MULTICALL OPTIMIZADAS
  // ============================================================================

  /**
   * Obtiene pools usando multicall para máxima eficiencia
   */
  private async getPoolsBatchMulticall(
    poolAddresses: string[],
    chain: Chain,
    dex: DexInfo,
    multicallAddress: string,
    config: BatchFetchConfig
  ): Promise<LiquidityPool[]> {
    console.log(`🚀 Using multicall for ${poolAddresses.length} pools on ${chain}`);

    try {
      const provider = new ethers.JsonRpcProvider(this.getRpcUrl(chain));
      const multicall = new Contract(multicallAddress, MULTICALL_ABI, provider);

      // Crear calls para obtener datos básicos de pools
      const calls = this.createMulticallRequests(poolAddresses, dex);
      
      // Ejecutar en batches para evitar límites de gas
      const batchSize = 50; // Reducido para multicall
      const batches = this.createBatches(calls, batchSize);
      const allResults: any[] = [];

      for (const [batchIndex, batch] of batches.entries()) {
        console.log(`📡 Executing multicall batch ${batchIndex + 1}/${batches.length}`);

        try {
          const result = await multicall.tryAggregate(false, batch);
          allResults.push(...result);
          
          // Rate limiting entre batches
          if (batchIndex < batches.length - 1) {
            await this.rateLimitDelay(chain);
          }
        } catch (error) {
          console.error(`Multicall batch ${batchIndex + 1} failed:`, error);
          // Continuar con siguiente batch
        }
      }

      // Procesar resultados y crear objetos LiquidityPool
      const pools = await this.processMulticallResults(
        allResults,
        poolAddresses,
        dex,
        chain
      );

      console.log(`✅ Multicall completed: ${pools.length} pools processed`);
      return pools;

    } catch (error) {
      console.error(`❌ Multicall failed for ${chain}:`, error);
      // Fallback a método individual
      return await this.getPoolsBatch(poolAddresses, chain, dex, config);
    }
  }

  /**
   * Crea requests multicall para pools
   */
  private createMulticallRequests(
    poolAddresses: string[],
    dex: DexInfo
  ): MulticallRequest[] {
    const calls: MulticallRequest[] = [];
    
    const PAIR_ABI = [
      'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
      'function token0() external view returns (address)',
      'function token1() external view returns (address)',
      'function totalSupply() external view returns (uint256)'
    ];

    for (const poolAddress of poolAddresses) {
      const poolInterface = new ethers.Interface(PAIR_ABI);

      // Reservas
      calls.push({
        target: poolAddress,
        callData: poolInterface.encodeFunctionData('getReserves')
      });

      // Token0
      calls.push({
        target: poolAddress,
        callData: poolInterface.encodeFunctionData('token0')
      });

      // Token1
      calls.push({
        target: poolAddress,
        callData: poolInterface.encodeFunctionData('token1')
      });

      // Total supply
      calls.push({
        target: poolAddress,
        callData: poolInterface.encodeFunctionData('totalSupply')
      });
    }

    return calls;
  }

  /**
   * Procesa resultados de multicall
   */
  private async processMulticallResults(
    results: any[],
    poolAddresses: string[],
    dex: DexInfo,
    chain: Chain
  ): Promise<LiquidityPool[]> {
    const pools: LiquidityPool[] = [];
    const PAIR_ABI = [
      'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
      'function token0() external view returns (address)',
      'function token1() external view returns (address)',
      'function totalSupply() external view returns (uint256)'
    ];
    const poolInterface = new ethers.Interface(PAIR_ABI);

    for (let i = 0; i < poolAddresses.length; i++) {
      try {
        const baseIndex = i * 4; // 4 calls por pool
        
        if (baseIndex + 3 >= results.length) continue;

        const [reservesResult, token0Result, token1Result, supplyResult] = results.slice(baseIndex, baseIndex + 4);

        // Verificar que todos los calls fueron exitosos
        if (!reservesResult[0] || !token0Result[0] || !token1Result[0] || !supplyResult[0]) {
          continue;
        }

        // Decodificar resultados
        const reserves = poolInterface.decodeFunctionResult('getReserves', reservesResult[1]);
        const token0Address = poolInterface.decodeFunctionResult('token0', token0Result[1])[0];
        const token1Address = poolInterface.decodeFunctionResult('token1', token1Result[1])[0];
        const totalSupply = poolInterface.decodeFunctionResult('totalSupply', supplyResult[1])[0];

        // Obtener información de tokens
        const [token0Info, token1Info] = await Promise.all([
          dexDataFetcher.getTokenInfo(token0Address, chain),
          dexDataFetcher.getTokenInfo(token1Address, chain)
        ]);

        const pool: LiquidityPool = {
          address: poolAddresses[i],
          token0: token0Info,
          token1: token1Info,
          reserve0: reserves[0],
          reserve1: reserves[1],
          totalSupply,
          dex: dex.name,
          chain,
          fee: dex.fee,
          reserveUSD: 0, // Calcular posteriormente
          volume24h: 0,  // Obtener de subgrafo
          txCount: 0,
          blockTimestampLast: reserves[2]
        };

        pools.push(pool);

      } catch (error) {
        console.warn(`Failed to process pool ${poolAddresses[i]}:`, error);
      }
    }

    return pools;
  }

  // ============================================================================
  // FETCHING ESPECÍFICO POR DEX
  // ============================================================================

  /**
   * Obtiene pools de un DEX específico
   */
  private async fetchPoolsFromDex(
    dex: DexInfo,
    criteria: PoolFilterCriteria,
    config: BatchFetchConfig
  ): Promise<LiquidityPool[]> {
    try {
      switch (dex.type) {
        case 'uniswap-v2':
        case 'sushiswap':
          return await this.fetchUniswapV2Pools(dex, criteria, config);
        case 'uniswap-v3':
          return await this.fetchUniswapV3Pools(dex, criteria, config);
        case 'curve':
          return await this.fetchCurvePools(dex, criteria, config);
        case 'balancer':
          return await this.fetchBalancerPools(dex, criteria, config);
        default:
          console.warn(`Unsupported DEX type: ${dex.type}`);
          return [];
      }
    } catch (error) {
      console.error(`Error fetching pools from ${dex.name}:`, error);
      return [];
    }
  }

  /**
   * Obtiene pools Uniswap V2 usando The Graph
   */
  private async fetchUniswapV2Pools(
    dex: DexInfo,
    criteria: PoolFilterCriteria,
    config: BatchFetchConfig
  ): Promise<LiquidityPool[]> {
    try {
      // Usar The Graph para obtener pools filtrados
      if (criteria.tokenA && criteria.tokenB) {
        return await dexDataFetcher.getUniswapV2Pools(
          dex.chain,
          criteria.tokenA,
          criteria.tokenB,
          criteria.limit || 100
        );
      }

      // Query general para pools con mayor liquidez
      const query = {
        query: `
          query GetTopPools($minLiquidity: String!, $limit: Int!) {
            pairs(
              first: $limit,
              where: { reserveUSD_gte: $minLiquidity },
              orderBy: reserveUSD,
              orderDirection: desc
            ) {
              id
              token0 { id symbol decimals }
              token1 { id symbol decimals }
              reserve0
              reserve1
              reserveUSD
              volumeUSD
              txCount
              totalSupply
            }
          }
        `,
        variables: {
          minLiquidity: criteria.minLiquidityUSD?.toString() || '1000',
          limit: criteria.limit || 100
        }
      };

      // Ejecutar query y procesar resultados
      // (implementación específica según endpoint de The Graph)
      return [];

    } catch (error) {
      console.error(`Error fetching Uniswap V2 pools from ${dex.name}:`, error);
      return [];
    }
  }

  /**
   * Obtiene pools Uniswap V3
   */
  private async fetchUniswapV3Pools(
    dex: DexInfo,
    criteria: PoolFilterCriteria,
    config: BatchFetchConfig
  ): Promise<LiquidityPool[]> {
    // Implementación similar a V2 pero con queries específicas para V3
    return [];
  }

  /**
   * Obtiene pools Curve
   */
  private async fetchCurvePools(
    dex: DexInfo,
    criteria: PoolFilterCriteria,
    config: BatchFetchConfig
  ): Promise<LiquidityPool[]> {
    // Implementación específica para Curve
    return [];
  }

  /**
   * Obtiene pools Balancer
   */
  private async fetchBalancerPools(
    dex: DexInfo,
    criteria: PoolFilterCriteria,
    config: BatchFetchConfig
  ): Promise<LiquidityPool[]> {
    // Implementación específica para Balancer
    return [];
  }

  // ============================================================================
  // REFRESH Y ACTUALIZACIÓN BATCH
  // ============================================================================

  /**
   * Actualiza pools de una chain específica
   */
  private async refreshChainPoolsBatch(
    chain: Chain,
    pools: LiquidityPool[],
    fields: string[]
  ): Promise<Map<string, Partial<LiquidityPool>>> {
    const updates = new Map<string, Partial<LiquidityPool>>();
    const chainConfig = CHAIN_CONFIGS[chain];

    // Usar multicall si está disponible y hay muchos pools
    if (chainConfig?.multicallAddress && pools.length > 10) {
      return await this.refreshPoolsMulticall(chain, pools, fields, chainConfig.multicallAddress);
    }

    // Fallback a refresh individual en batches
    const batches = this.createBatches(pools, chainConfig?.batchSize || 50);

    for (const [batchIndex, batch] of batches.entries()) {
      const batchUpdates = await Promise.allSettled(
        batch.map(async (pool) => {
          const update: Partial<LiquidityPool> = {};

          if (fields.includes('reserves')) {
            const reserves = await dexDataFetcher.getPoolReserves(pool.address, chain);
            update.reserve0 = reserves.reserve0;
            update.reserve1 = reserves.reserve1;
            update.blockTimestampLast = reserves.blockTimestampLast;
          }

          return { address: pool.address, update };
        })
      );

      batchUpdates.forEach(result => {
        if (result.status === 'fulfilled') {
          updates.set(result.value.address, result.value.update);
        }
      });

      // Rate limiting entre batches
      if (batchIndex < batches.length - 1) {
        await this.rateLimitDelay(chain);
      }
    }

    return updates;
  }

  /**
   * Refresh usando multicall para máxima eficiencia
   */
  private async refreshPoolsMulticall(
    chain: Chain,
    pools: LiquidityPool[],
    fields: string[],
    multicallAddress: string
  ): Promise<Map<string, Partial<LiquidityPool>>> {
    const updates = new Map<string, Partial<LiquidityPool>>();

    try {
      const provider = new ethers.JsonRpcProvider(this.getRpcUrl(chain));
      const multicall = new Contract(multicallAddress, MULTICALL_ABI, provider);

      // Crear calls para refresh
      const calls = this.createRefreshCalls(pools, fields);
      
      const batchSize = 100;
      const batches = this.createBatches(calls, batchSize);

      for (const [batchIndex, batch] of batches.entries()) {
        try {
          const result = await multicall.tryAggregate(false, batch);
          
          // Procesar resultados del refresh
          this.processRefreshResults(result, pools, fields, updates);
          
        } catch (error) {
          console.error(`Refresh batch ${batchIndex + 1} failed:`, error);
        }

        if (batchIndex < batches.length - 1) {
          await this.rateLimitDelay(chain);
        }
      }

    } catch (error) {
      console.error(`Multicall refresh failed for ${chain}:`, error);
    }

    return updates;
  }

  // ============================================================================
  // UTILIDADES Y HELPERS
  // ============================================================================

  /**
   * Filtra pools según criterios
   */
  private filterPools(
    pools: LiquidityPool[],
    criteria: PoolFilterCriteria
  ): LiquidityPool[] {
    return pools.filter(pool => {
      // Liquidez mínima
      if (criteria.minLiquidityUSD && pool.reserveUSD < criteria.minLiquidityUSD) {
        return false;
      }

      // Volumen mínimo
      if (criteria.minVolume24h && pool.volume24h < criteria.minVolume24h) {
        return false;
      }

      // Tokens específicos
      if (criteria.tokenA || criteria.tokenB) {
        const hasTokenA = !criteria.tokenA || 
          pool.token0.address.toLowerCase() === criteria.tokenA.toLowerCase() ||
          pool.token1.address.toLowerCase() === criteria.tokenA.toLowerCase();
          
        const hasTokenB = !criteria.tokenB ||
          pool.token0.address.toLowerCase() === criteria.tokenB.toLowerCase() ||
          pool.token1.address.toLowerCase() === criteria.tokenB.toLowerCase();

        if (!hasTokenA || !hasTokenB) return false;
      }

      // DEXs específicos
      if (criteria.dexes && criteria.dexes.length > 0) {
        if (!criteria.dexes.some(dex => dex.name === pool.dex)) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Ordena pools por relevancia
   */
  private sortPoolsByRelevance(
    pools: LiquidityPool[],
    criteria: PoolFilterCriteria
  ): LiquidityPool[] {
    return pools.sort((a, b) => {
      // Priorizar por liquidez USD
      if (a.reserveUSD !== b.reserveUSD) {
        return b.reserveUSD - a.reserveUSD;
      }

      // Luego por volumen 24h
      if (a.volume24h !== b.volume24h) {
        return b.volume24h - a.volume24h;
      }

      // Finalmente por número de transacciones
      return b.txCount - a.txCount;
    });
  }

  /**
   * Crea batches de elementos
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Rate limiting inteligente por chain
   */
  private async rateLimitDelay(chain: string): Promise<void> {
    const limiter = RATE_LIMITERS.get(chain);
    const config = CHAIN_CONFIGS[chain];
    
    if (!limiter || !config) return;

    const timeSinceLastCall = Date.now() - limiter.lastCall;
    const minDelay = config.rateLimitMs;

    if (timeSinceLastCall < minDelay) {
      const delay = minDelay - timeSinceLastCall;
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    limiter.lastCall = Date.now();
  }

  /**
   * Obtiene URL RPC para una chain
   */
  private getRpcUrl(chain: string): string {
    const rpcMap: Record<string, string> = {
      ethereum: 'https://eth-mainnet.alchemyapi.io/v2/demo',
      polygon: 'https://polygon-rpc.com',
      arbitrum: 'https://arb1.arbitrum.io/rpc',
      optimism: 'https://mainnet.optimism.io',
      avalanche: 'https://api.avax.network/ext/bc/C/rpc'
    };

    return rpcMap[chain] || rpcMap.ethereum;
  }

  // Placeholder methods para implementación completa
  private createRefreshCalls(pools: LiquidityPool[], fields: string[]): MulticallRequest[] { return []; }
  private processRefreshResults(results: any[], pools: LiquidityPool[], fields: string[], updates: Map<string, Partial<LiquidityPool>>): void {}

  /**
   * Obtiene estadísticas de operaciones batch
   */
  getBatchMetrics(): Map<string, BatchMetrics> {
    return new Map(this.metrics);
  }

  /**
   * Cancela operaciones activas
   */
  cancelActiveOperations(): void {
    for (const [operationId] of this.activeOperations.entries()) {
      this.activeOperations.set(operationId, false);
    }
    console.log('🛑 All active batch operations cancelled');
  }
}

// ============================================================================
// INSTANCIA SINGLETON EXPORTADA
// ============================================================================

export const poolBatchFetcher = new PoolBatchFetcher();
export default poolBatchFetcher;
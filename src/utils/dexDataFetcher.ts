/**
 * ArbitrageX Supreme - DEX Data Fetcher
 * 
 * Módulo especializado para obtención de datos de DEXs y protocolos DeFi
 * Enfoque metodico en agregación eficiente de datos multi-chain
 */

import { ethers, JsonRpcProvider, Contract } from 'ethers';
import { DexHelpers } from './dexHelpers';
import type { Chain, TokenInfo, LiquidityPool, DexInfo, PriceData } from '../apps/web/types/defi';
import type { 
  FetcherConfig, 
  SubgraphQuery, 
  SubgraphResponse, 
  TokenPair, 
  PoolReserves 
} from '../apps/web/types/backend';

// ============================================================================
// CONFIGURACIONES Y ABIs
// ============================================================================

// ABIs esenciales para fetching de datos
const ERC20_ABI = [
  'function name() external view returns (string)',
  'function symbol() external view returns (string)', 
  'function decimals() external view returns (uint8)',
  'function totalSupply() external view returns (uint256)',
  'function balanceOf(address owner) external view returns (uint256)'
];

const UNISWAP_V2_PAIR_ABI = [
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
  'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function totalSupply() external view returns (uint256)',
  'function balanceOf(address owner) external view returns (uint256)',
  'function price0CumulativeLast() external view returns (uint256)',
  'function price1CumulativeLast() external view returns (uint256)'
];

const UNISWAP_V2_FACTORY_ABI = [
  'function getPair(address tokenA, address tokenB) external view returns (address pair)',
  'function allPairs(uint) external view returns (address pair)',
  'function allPairsLength() external view returns (uint)'
];

// URLs de RPC por chain
const RPC_URLS: Record<Chain, string> = {
  ethereum: 'https://eth-mainnet.alchemyapi.io/v2/demo',
  bsc: 'https://bsc-dataseed1.binance.org/',
  polygon: 'https://polygon-rpc.com/',
  arbitrum: 'https://arb1.arbitrum.io/rpc',
  optimism: 'https://mainnet.optimism.io',
  avalanche: 'https://api.avax.network/ext/bc/C/rpc',
  base: 'https://mainnet.base.org',
  fantom: 'https://rpc.ftm.tools/',
  gnosis: 'https://rpc.gnosischain.com/',
  celo: 'https://forno.celo.org',
  moonbeam: 'https://rpc.api.moonbeam.network',
  cronos: 'https://evm.cronos.org/',
  aurora: 'https://mainnet.aurora.dev',
  harmony: 'https://api.harmony.one',
  kava: 'https://evm.kava.io',
  metis: 'https://andromeda.metis.io/?owner=1088',
  evmos: 'https://eth.bd.evmos.org:8545/',
  oasis: 'https://emerald.oasis.dev/',
  milkomeda: 'https://rpc-mainnet-cardano-evm.c1.milkomeda.com',
  telos: 'https://mainnet.telos.net/evm'
};

// Configuraciones por defecto
const DEFAULT_CONFIG: FetcherConfig = {
  rpcUrl: '',
  rateLimitMs: 200,
  timeout: 10000,
  retries: 3,
  cacheTtl: 30000 // 30 segundos
};

// ============================================================================
// CLASE PRINCIPAL - DEX DATA FETCHER
// ============================================================================

export class DexDataFetcher {
  private configs: Map<Chain, FetcherConfig> = new Map();
  private providers: Map<Chain, JsonRpcProvider> = new Map();
  private cache: Map<string, { data: unknown; timestamp: number; ttl: number }> = new Map();
  
  constructor() {
    // Inicializar configuraciones por chain
    Object.entries(RPC_URLS).forEach(([chain, rpcUrl]) => {
      this.configs.set(chain as Chain, {
        ...DEFAULT_CONFIG,
        rpcUrl
      });
    });
    
    // Limpiar cache periódicamente
    setInterval(() => this.cleanExpiredCache(), 60000); // cada minuto
  }

  // ============================================================================
  // GESTIÓN DE PROVIDERS Y CACHE
  // ============================================================================

  /**
   * Obtiene o crea un provider para una chain
   */
  private getProvider(chain: Chain): JsonRpcProvider {
    if (!this.providers.has(chain)) {
      const config = this.configs.get(chain);
      if (!config?.rpcUrl) {
        throw new Error(`No RPC URL configured for chain: ${chain}`);
      }
      
      const provider = new ethers.JsonRpcProvider(config.rpcUrl);
      this.providers.set(chain, provider);
    }
    
    return this.providers.get(chain)!;
  }

  /**
   * Obtiene datos del cache o null si no existe/expiró
   */
  private getCached<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    const isExpired = Date.now() - entry.timestamp > entry.ttl;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }

  /**
   * Guarda datos en cache
   */
  private setCached<T>(key: string, data: T, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || DEFAULT_CONFIG.cacheTtl
    });
  }

  /**
   * Limpia entradas expiradas del cache
   */
  private cleanExpiredCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  // ============================================================================
  // OBTENCIÓN DE INFORMACIÓN DE TOKENS
  // ============================================================================

  /**
   * Obtiene información completa de un token
   */
  async getTokenInfo(tokenAddress: string, chain: Chain): Promise<TokenInfo> {
    const cacheKey = `token_${chain}_${tokenAddress.toLowerCase()}`;
    const cached = this.getCached<TokenInfo>(cacheKey);
    if (cached) return cached;

    try {
      const provider = this.getProvider(chain);
      const tokenContract = new Contract(tokenAddress, ERC20_ABI, provider);
      
      const [name, symbol, decimals] = await Promise.all([
        tokenContract.name(),
        tokenContract.symbol(),
        tokenContract.decimals()
      ]);

      const tokenInfo: TokenInfo = {
        address: tokenAddress,
        name,
        symbol,
        decimals: Number(decimals),
        chainId: this.getChainId(chain)
      };

      this.setCached(cacheKey, tokenInfo, 300000); // 5 minutos de cache para tokens
      return tokenInfo;

    } catch (error) {
      console.error(`Error fetching token info for ${tokenAddress} on ${chain}:`, error);
      
      // Fallback con información básica
      return {
        address: tokenAddress,
        name: 'Unknown Token',
        symbol: 'UNKNOWN',
        decimals: 18,
        chainId: this.getChainId(chain)
      };
    }
  }

  /**
   * Obtiene información de múltiples tokens en batch
   */
  async getTokensInfo(tokenAddresses: string[], chain: Chain): Promise<TokenInfo[]> {
    return Promise.all(
      tokenAddresses.map(address => this.getTokenInfo(address, chain))
    );
  }

  /**
   * Obtiene el precio USD de un token (placeholder - integrar con precio APIs)
   */
  async getTokenPrice(tokenAddress: string, chain: Chain): Promise<PriceData | null> {
    // TODO: Integrar con APIs de precios como CoinGecko, CMC, etc.
    console.warn('Token price fetching not implemented yet');
    return null;
  }

  // ============================================================================
  // OBTENCIÓN DE DATOS DE POOLS
  // ============================================================================

  /**
   * Obtiene las reservas de un pool Uniswap V2
   */
  async getPoolReserves(poolAddress: string, chain: Chain): Promise<PoolReserves> {
    const cacheKey = `reserves_${chain}_${poolAddress.toLowerCase()}`;
    const cached = this.getCached<PoolReserves>(cacheKey);
    if (cached) return cached;

    try {
      const provider = this.getProvider(chain);
      const poolContract = new Contract(poolAddress, UNISWAP_V2_PAIR_ABI, provider);
      
      const reserves = await poolContract.getReserves();
      
      const poolReserves: PoolReserves = {
        reserve0: reserves[0],
        reserve1: reserves[1],
        blockTimestampLast: reserves[2]
      };

      this.setCached(cacheKey, poolReserves, 5000); // 5 segundos de cache para reservas
      return poolReserves;

    } catch (error) {
      console.error(`Error fetching pool reserves for ${poolAddress} on ${chain}:`, error);
      throw error;
    }
  }

  /**
   * Obtiene información completa de un pool
   */
  async getPoolInfo(poolAddress: string, dex: DexInfo): Promise<LiquidityPool> {
    try {
      const provider = this.getProvider(dex.chain);
      const poolContract = new Contract(poolAddress, UNISWAP_V2_PAIR_ABI, provider);
      
      // Obtener información básica del pool
      const [token0Address, token1Address, reserves, totalSupply] = await Promise.all([
        poolContract.token0(),
        poolContract.token1(),
        poolContract.getReserves(),
        poolContract.totalSupply()
      ]);

      // Obtener información de los tokens
      const [token0Info, token1Info] = await Promise.all([
        this.getTokenInfo(token0Address, dex.chain),
        this.getTokenInfo(token1Address, dex.chain)
      ]);

      const pool: LiquidityPool = {
        address: poolAddress,
        dex: dex.name,
        chain: dex.chain,
        token0: token0Info,
        token1: token1Info,
        reserve0: reserves[0],
        reserve1: reserves[1],
        totalSupply,
        fee: dex.fee,
        reserveUSD: 0, // TODO: Calcular basado en precios
        volume24h: 0, // TODO: Obtener de subgraph
        txCount: 0,
        blockTimestampLast: reserves[2]
      };

      return pool;

    } catch (error) {
      console.error(`Error fetching pool info for ${poolAddress}:`, error);
      throw error;
    }
  }

  /**
   * Busca pools que contengan tokens específicos
   */
  async findPoolsWithTokens(
    tokenA: string,
    tokenB: string,
    chain: Chain,
    dexes: DexInfo[]
  ): Promise<LiquidityPool[]> {
    const pools: LiquidityPool[] = [];

    for (const dex of dexes.filter(d => d.chain === chain)) {
      try {
        const provider = this.getProvider(chain);
        const factory = new Contract(dex.factoryAddress, UNISWAP_V2_FACTORY_ABI, provider);
        
        // Buscar pool directo
        const pairAddress = await factory.getPair(tokenA, tokenB);
        
        if (pairAddress !== ethers.ZeroAddress) {
          const pool = await this.getPoolInfo(pairAddress, dex);
          pools.push(pool);
        }
        
      } catch (error) {
        console.warn(`Error searching pools in ${dex.name}:`, error);
      }
    }

    return pools;
  }

  // ============================================================================
  // INTEGRACIÓN CON THE GRAPH
  // ============================================================================

  /**
   * Ejecuta una query en The Graph
   */
  async querySubgraph<T = unknown>(
    subgraphUrl: string,
    query: SubgraphQuery
  ): Promise<SubgraphResponse<T>> {
    try {
      const response = await fetch(subgraphUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(query)
      });

      if (!response.ok) {
        throw new Error(`Subgraph request failed: ${response.statusText}`);
      }

      return await response.json();
      
    } catch (error) {
      console.error('Subgraph query error:', error);
      return { errors: [{ message: error instanceof Error ? error.message : 'Unknown error' }] };
    }
  }

  /**
   * Obtiene pools de Uniswap V2 usando The Graph
   */
  async getUniswapV2Pools(
    chain: Chain,
    tokenA?: string,
    tokenB?: string,
    limit: number = 100
  ): Promise<LiquidityPool[]> {
    // Placeholder - implementar integración real con The Graph
    console.warn('Uniswap V2 subgraph integration not implemented yet');
    return [];
  }

  /**
   * Obtiene datos históricos de un pool
   */
  async getPoolHistoricalData(
    poolAddress: string,
    chain: Chain,
    timeframe: '1h' | '24h' | '7d' = '24h'
  ): Promise<Array<{ timestamp: number; price: number; volume: number; liquidity: number }>> {
    // Placeholder - implementar integración con subgraph
    console.warn('Historical data fetching not implemented yet');
    return [];
  }

  // ============================================================================
  // ANÁLISIS DE PRECIOS Y ARBITRAJE
  // ============================================================================

  /**
   * Compara precios entre diferentes DEXs para un par de tokens
   */
  async comparePricesAcrossDexes(
    tokenA: string,
    tokenB: string,
    chain: Chain,
    dexes: DexInfo[]
  ): Promise<Array<{ dex: string; price: number; pool: LiquidityPool }>> {
    const priceComparisons: Array<{ dex: string; price: number; pool: LiquidityPool }> = [];

    for (const dex of dexes.filter(d => d.chain === chain)) {
      try {
        const pools = await this.findPoolsWithTokens(tokenA, tokenB, chain, [dex]);
        
        for (const pool of pools) {
          const price = DexHelpers.getTokenPrice(
            pool.token0,
            pool.token1,
            pool.reserve0,
            pool.reserve1
          );

          priceComparisons.push({
            dex: dex.name,
            price,
            pool
          });
        }
        
      } catch (error) {
        console.warn(`Error comparing prices on ${dex.name}:`, error);
      }
    }

    // Ordenar por precio
    return priceComparisons.sort((a, b) => a.price - b.price);
  }

  /**
   * Detecta oportunidades de arbitraje simples
   */
  async detectSimpleArbitrage(
    tokenA: string,
    tokenB: string,
    chain: Chain,
    dexes: DexInfo[],
    minProfitThreshold: number = 0.01 // 1%
  ): Promise<Array<{
    buyDex: string;
    sellDex: string;
    buyPrice: number;
    sellPrice: number;
    profitPercent: number;
    buyPool: LiquidityPool;
    sellPool: LiquidityPool;
  }>> {
    const priceComparisons = await this.comparePricesAcrossDexes(tokenA, tokenB, chain, dexes);
    const opportunities: Array<{
      buyDex: string;
      sellDex: string;
      buyPrice: number;
      sellPrice: number;
      profitPercent: number;
      buyPool: LiquidityPool;
      sellPool: LiquidityPool;
    }> = [];

    // Comparar todos los pares de precios
    for (let i = 0; i < priceComparisons.length; i++) {
      for (let j = i + 1; j < priceComparisons.length; j++) {
        const lower = priceComparisons[i];
        const higher = priceComparisons[j];
        
        const profitPercent = (higher.price - lower.price) / lower.price;
        
        if (profitPercent >= minProfitThreshold) {
          opportunities.push({
            buyDex: lower.dex,
            sellDex: higher.dex,
            buyPrice: lower.price,
            sellPrice: higher.price,
            profitPercent,
            buyPool: lower.pool,
            sellPool: higher.pool
          });
        }
      }
    }

    return opportunities.sort((a, b) => b.profitPercent - a.profitPercent);
  }

  // ============================================================================
  // UTILIDADES Y HELPERS
  // ============================================================================

  /**
   * Convierte chain name a chainId
   */
  private getChainId(chain: Chain): number {
    const chainIds: Record<Chain, number> = {
      ethereum: 1,
      bsc: 56,
      polygon: 137,
      arbitrum: 42161,
      optimism: 10,
      avalanche: 43114,
      base: 8453,
      fantom: 250,
      gnosis: 100,
      celo: 42220,
      moonbeam: 1284,
      cronos: 25,
      aurora: 1313161554,
      harmony: 1666600000,
      kava: 2222,
      metis: 1088,
      evmos: 9001,
      oasis: 42262,
      milkomeda: 2001,
      telos: 40
    };

    return chainIds[chain] || 1;
  }

  /**
   * Verifica si una chain está soportada
   */
  isSupportedChain(chain: string): chain is Chain {
    return chain in RPC_URLS;
  }

  /**
   * Obtiene estadísticas del cache
   */
  getCacheStats(): { size: number; chains: string[]; keys: string[] } {
    return {
      size: this.cache.size,
      chains: Array.from(this.providers.keys()),
      keys: Array.from(this.cache.keys())
    };
  }

  /**
   * Limpia todo el cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Actualiza la configuración de una chain
   */
  updateChainConfig(chain: Chain, config: Partial<FetcherConfig>): void {
    const currentConfig = this.configs.get(chain) || DEFAULT_CONFIG;
    this.configs.set(chain, { ...currentConfig, ...config });
    
    // Recrear provider si cambió la URL
    if (config.rpcUrl) {
      this.providers.delete(chain);
    }
  }
}

// ============================================================================
// INSTANCIA SINGLETON EXPORTADA
// ============================================================================

export const dexDataFetcher = new DexDataFetcher();
export default dexDataFetcher;
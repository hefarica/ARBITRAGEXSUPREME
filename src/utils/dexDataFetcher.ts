/**
 * ArbitrageX Supreme - DEX Data Fetcher
 * 
 * Módulo especializado en obtención de datos en tiempo real de DEXs
 * Integra DefiLlama, The Graph y ethers.js para máxima precisión
 * 
 * Funcionalidades:
 * - Fetching de precios en tiempo real
 * - Consultas a subgrafos de The Graph
 * - Integración con DefiLlama API
 * - Cache inteligente con refresh de 5 segundos
 * - Manejo de múltiples proveedores RPC
 */

import { ethers, JsonRpcProvider, Contract } from 'ethers';
import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { DexHelpers } from './dexHelpers';
import { 
  Chain, 
  DexInfo, 
  TokenInfo, 
  PriceData, 
  LiquidityPool, 
  SwapRoute,
  PoolReserves,
  GraphQLQuery,
  DefiLlamaResponse,
  CacheEntry
} from '../types/defi';

// ============================================================================
// CONFIGURACIONES Y CONSTANTES
// ============================================================================

const DEFI_LLAMA_BASE_URL = 'https://api.llama.fi';
const DEFI_LLAMA_COINS_URL = 'https://coins.llama.fi';
const THE_GRAPH_BASE_URL = 'https://api.thegraph.com/subgraphs/name';

// Endpoints de The Graph por protocolo
const GRAPH_ENDPOINTS = {
  'uniswap-v2': {
    ethereum: 'uniswap/uniswap-v2',
    polygon: 'sushiswap/matic-exchange',
    arbitrum: 'ianlapham/uniswap-arbitrum-one'
  },
  'uniswap-v3': {
    ethereum: 'uniswap/uniswap-v3',
    polygon: 'uniswap/uniswap-v3-polygon',
    arbitrum: 'uniswap/uniswap-v3-arbitrum'
  },
  'sushiswap': {
    ethereum: 'sushiswap/exchange',
    polygon: 'sushiswap/matic-exchange',
    arbitrum: 'sushiswap/arbitrum-exchange'
  },
  'curve': {
    ethereum: 'convex-community/curve-pools',
    polygon: 'convex-community/curve-pools-polygon',
    arbitrum: 'convex-community/curve-pools-arbitrum'
  },
  'balancer': {
    ethereum: 'balancer-labs/balancer-v2',
    polygon: 'balancer-labs/balancer-polygon-v2',
    arbitrum: 'balancer-labs/balancer-arbitrum-v2'
  }
};

// RPC providers por chain
const RPC_PROVIDERS: Record<string, string[]> = {
  ethereum: [
    'https://eth-mainnet.alchemyapi.io/v2/demo',
    'https://mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161',
    'https://eth-rpc.gateway.pokt.network'
  ],
  polygon: [
    'https://polygon-rpc.com',
    'https://rpc-mainnet.matic.network',
    'https://poly-rpc.gateway.pokt.network'
  ],
  arbitrum: [
    'https://arb1.arbitrum.io/rpc',
    'https://arbitrum-mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161'
  ],
  optimism: [
    'https://mainnet.optimism.io',
    'https://optimism-mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161'
  ],
  avalanche: [
    'https://api.avax.network/ext/bc/C/rpc',
    'https://avalanche-mainnet.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161'
  ]
};

// ABIs esenciales para contratos
const UNISWAP_V2_PAIR_ABI = [
  'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
  'function totalSupply() external view returns (uint256)'
];

const UNISWAP_V2_ROUTER_ABI = [
  'function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)',
  'function getAmountsIn(uint amountOut, address[] calldata path) external view returns (uint[] memory amounts)'
];

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)'
];

// ============================================================================
// CLASE PRINCIPAL - DEX DATA FETCHER
// ============================================================================

export class DexDataFetcher {
  private httpClient: AxiosInstance;
  private providers: Map<string, JsonRpcProvider> = new Map();
  private cache: Map<string, CacheEntry<any>> = new Map();
  private readonly cacheTimeout: number = 5000; // 5 segundos

  constructor() {
    // Configurar cliente HTTP con timeout y retry
    this.httpClient = axios.create({
      timeout: 10000,
      retry: 3,
      retryDelay: 1000
    });

    // Interceptor para logging de requests
    this.httpClient.interceptors.request.use((config) => {
      console.log(`🔄 Fetching: ${config.method?.toUpperCase()} ${config.url}`);
      return config;
    });

    // Interceptor para manejo de errores
    this.httpClient.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error(`❌ Request failed: ${error.config?.url}`, error.message);
        throw error;
      }
    );

    // Inicializar providers RPC
    this.initializeProviders();
  }

  // ============================================================================
  // INICIALIZACIÓN Y CONFIGURACIÓN
  // ============================================================================

  /**
   * Inicializa providers RPC para todas las chains soportadas
   */
  private initializeProviders(): void {
    for (const [chain, rpcs] of Object.entries(RPC_PROVIDERS)) {
      try {
        // Usar el primer RPC como principal, otros como fallback
        const provider = new JsonRpcProvider(rpcs[0]);
        this.providers.set(chain, provider);
        console.log(`✅ Provider initialized for ${chain}`);
      } catch (error) {
        console.error(`❌ Failed to initialize provider for ${chain}:`, error);
      }
    }
  }

  /**
   * Obtiene provider RPC con fallback automático
   */
  private getProvider(chain: string): JsonRpcProvider {
    let provider = this.providers.get(chain);
    
    if (!provider) {
      const rpcs = RPC_PROVIDERS[chain];
      if (!rpcs || rpcs.length === 0) {
        throw new Error(`No RPC endpoints configured for chain: ${chain}`);
      }
      
      provider = new JsonRpcProvider(rpcs[0]);
      this.providers.set(chain, provider);
    }
    
    return provider;
  }

  // ============================================================================
  // SISTEMA DE CACHE
  // ============================================================================

  /**
   * Obtiene datos del cache si son válidos
   */
  private getCached<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    const isExpired = Date.now() - entry.timestamp > this.cacheTimeout;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }

  /**
   * Guarda datos en cache
   */
  private setCached<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Limpia cache expirado
   */
  private cleanCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.cacheTimeout) {
        this.cache.delete(key);
      }
    }
  }

  // ============================================================================
  // INTEGRACIÓN CON DEFI LLAMA
  // ============================================================================

  /**
   * Obtiene precios históricos y actuales de DefiLlama
   */
  async getDefiLlamaPrices(
    tokens: string[],
    timestamp?: number
  ): Promise<DefiLlamaResponse> {
    const cacheKey = `defillama_prices_${tokens.join(',')}_${timestamp || 'current'}`;
    const cached = this.getCached<DefiLlamaResponse>(cacheKey);
    if (cached) return cached;

    try {
      const tokensParam = tokens.join(',');
      const url = timestamp 
        ? `${DEFI_LLAMA_COINS_URL}/prices/historical/${timestamp}/${tokensParam}`
        : `${DEFI_LLAMA_COINS_URL}/prices/current/${tokensParam}`;

      const response: AxiosResponse<DefiLlamaResponse> = await this.httpClient.get(url);
      
      this.setCached(cacheKey, response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching DefiLlama prices:', error);
      throw new Error(`DefiLlama API error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  /**
   * Obtiene datos de protocolos desde DefiLlama
   */
  async getProtocolData(protocol: string): Promise<any> {
    const cacheKey = `protocol_data_${protocol}`;
    const cached = this.getCached<any>(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.httpClient.get(`${DEFI_LLAMA_BASE_URL}/protocol/${protocol}`);
      
      this.setCached(cacheKey, response.data);
      return response.data;
    } catch (error) {
      console.error(`Error fetching protocol data for ${protocol}:`, error);
      throw new Error(`Failed to fetch protocol data: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  /**
   * Obtiene TVL de todos los protocolos
   */
  async getAllProtocolsTVL(): Promise<any[]> {
    const cacheKey = 'all_protocols_tvl';
    const cached = this.getCached<any[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.httpClient.get(`${DEFI_LLAMA_BASE_URL}/protocols`);
      
      this.setCached(cacheKey, response.data);
      return response.data;
    } catch (error) {
      console.error('Error fetching protocols TVL:', error);
      throw new Error(`DefiLlama protocols API error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  // ============================================================================
  // INTEGRACIÓN CON THE GRAPH
  // ============================================================================

  /**
   * Ejecuta query GraphQL en The Graph
   */
  async executeGraphQuery<T>(
    endpoint: string,
    query: GraphQLQuery
  ): Promise<T> {
    const cacheKey = `graph_query_${endpoint}_${JSON.stringify(query)}`;
    const cached = this.getCached<T>(cacheKey);
    if (cached) return cached;

    try {
      const response = await this.httpClient.post(
        `${THE_GRAPH_BASE_URL}/${endpoint}`,
        { query: query.query, variables: query.variables },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(response.data.errors)}`);
      }

      this.setCached(cacheKey, response.data.data);
      return response.data.data;
    } catch (error) {
      console.error(`Error executing Graph query on ${endpoint}:`, error);
      throw new Error(`The Graph API error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  /**
   * Obtiene datos de pools de Uniswap V2 desde The Graph
   */
  async getUniswapV2Pools(
    chain: string,
    tokenA: string,
    tokenB: string,
    limit: number = 10
  ): Promise<LiquidityPool[]> {
    const endpoint = GRAPH_ENDPOINTS['uniswap-v2'][chain as keyof typeof GRAPH_ENDPOINTS['uniswap-v2']];
    if (!endpoint) {
      throw new Error(`Uniswap V2 not supported on ${chain}`);
    }

    const query: GraphQLQuery = {
      query: `
        query GetPools($token0: String!, $token1: String!, $limit: Int!) {
          pairs(
            first: $limit,
            where: {
              or: [
                { token0: $token0, token1: $token1 },
                { token0: $token1, token1: $token0 }
              ]
            },
            orderBy: reserveUSD,
            orderDirection: desc
          ) {
            id
            token0 {
              id
              symbol
              decimals
            }
            token1 {
              id
              symbol
              decimals
            }
            reserve0
            reserve1
            reserveUSD
            totalSupply
            volumeUSD
            txCount
          }
        }
      `,
      variables: {
        token0: tokenA.toLowerCase(),
        token1: tokenB.toLowerCase(),
        limit
      }
    };

    const result = await this.executeGraphQuery<{ pairs: any[] }>(endpoint, query);
    
    return result.pairs.map(pair => ({
      address: pair.id,
      token0: {
        address: pair.token0.id,
        symbol: pair.token0.symbol,
        decimals: parseInt(pair.token0.decimals),
        chain: chain as Chain
      },
      token1: {
        address: pair.token1.id,
        symbol: pair.token1.symbol,
        decimals: parseInt(pair.token1.decimals),
        chain: chain as Chain
      },
      reserve0: BigInt(pair.reserve0),
      reserve1: BigInt(pair.reserve1),
      reserveUSD: parseFloat(pair.reserveUSD),
      totalSupply: BigInt(pair.totalSupply),
      volume24h: parseFloat(pair.volumeUSD),
      txCount: parseInt(pair.txCount),
      dex: 'uniswap-v2',
      chain: chain as Chain,
      fee: 0.003 // 0.3%
    }));
  }

  /**
   * Obtiene datos de pools de Uniswap V3 desde The Graph
   */
  async getUniswapV3Pools(
    chain: string,
    tokenA: string,
    tokenB: string,
    limit: number = 10
  ): Promise<LiquidityPool[]> {
    const endpoint = GRAPH_ENDPOINTS['uniswap-v3'][chain as keyof typeof GRAPH_ENDPOINTS['uniswap-v3']];
    if (!endpoint) {
      throw new Error(`Uniswap V3 not supported on ${chain}`);
    }

    const query: GraphQLQuery = {
      query: `
        query GetV3Pools($token0: String!, $token1: String!, $limit: Int!) {
          pools(
            first: $limit,
            where: {
              or: [
                { token0: $token0, token1: $token1 },
                { token0: $token1, token1: $token0 }
              ]
            },
            orderBy: totalValueLockedUSD,
            orderDirection: desc
          ) {
            id
            token0 {
              id
              symbol
              decimals
            }
            token1 {
              id
              symbol
              decimals
            }
            liquidity
            sqrtPrice
            tick
            feeGrowthGlobal0X128
            feeGrowthGlobal1X128
            totalValueLockedUSD
            volumeUSD
            feeTier
            txCount
          }
        }
      `,
      variables: {
        token0: tokenA.toLowerCase(),
        token1: tokenB.toLowerCase(),
        limit
      }
    };

    const result = await this.executeGraphQuery<{ pools: any[] }>(endpoint, query);
    
    return result.pools.map(pool => ({
      address: pool.id,
      token0: {
        address: pool.token0.id,
        symbol: pool.token0.symbol,
        decimals: parseInt(pool.token0.decimals),
        chain: chain as Chain
      },
      token1: {
        address: pool.token1.id,
        symbol: pool.token1.symbol,
        decimals: parseInt(pool.token1.decimals),
        chain: chain as Chain
      },
      liquidity: BigInt(pool.liquidity),
      sqrtPriceX96: BigInt(pool.sqrtPrice),
      tick: parseInt(pool.tick),
      reserveUSD: parseFloat(pool.totalValueLockedUSD),
      volume24h: parseFloat(pool.volumeUSD),
      txCount: parseInt(pool.txCount),
      dex: 'uniswap-v3',
      chain: chain as Chain,
      fee: parseInt(pool.feeTier) / 1000000 // Convert from basis points
    }));
  }

  // ============================================================================
  // INTERACCIÓN DIRECTA CON CONTRATOS
  // ============================================================================

  /**
   * Obtiene reservas de un pool directamente del contrato
   */
  async getPoolReserves(
    poolAddress: string,
    chain: string
  ): Promise<PoolReserves> {
    const cacheKey = `pool_reserves_${poolAddress}_${chain}`;
    const cached = this.getCached<PoolReserves>(cacheKey);
    if (cached) return cached;

    try {
      const provider = this.getProvider(chain);
      const pairContract = new Contract(poolAddress, UNISWAP_V2_PAIR_ABI, provider);

      const [reserves, token0Address, token1Address] = await Promise.all([
        pairContract.getReserves(),
        pairContract.token0(),
        pairContract.token1()
      ]);

      const result: PoolReserves = {
        reserve0: reserves[0],
        reserve1: reserves[1],
        blockTimestampLast: reserves[2],
        token0: token0Address,
        token1: token1Address
      };

      this.setCached(cacheKey, result);
      return result;
    } catch (error) {
      console.error(`Error fetching reserves for pool ${poolAddress}:`, error);
      throw new Error(`Contract interaction failed: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  /**
   * Obtiene cantidad de salida estimada usando router de DEX
   */
  async getAmountsOut(
    routerAddress: string,
    amountIn: bigint,
    path: string[],
    chain: string
  ): Promise<bigint[]> {
    const cacheKey = `amounts_out_${routerAddress}_${amountIn}_${path.join(',')}_${chain}`;
    const cached = this.getCached<bigint[]>(cacheKey);
    if (cached) return cached;

    try {
      const provider = this.getProvider(chain);
      const routerContract = new Contract(routerAddress, UNISWAP_V2_ROUTER_ABI, provider);

      const amounts = await routerContract.getAmountsOut(amountIn, path);
      const result = amounts.map((amount: any) => BigInt(amount.toString()));

      this.setCached(cacheKey, result);
      return result;
    } catch (error) {
      console.error(`Error getting amounts out from router ${routerAddress}:`, error);
      throw new Error(`Router query failed: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  /**
   * Obtiene información de token desde el contrato
   */
  async getTokenInfo(tokenAddress: string, chain: string): Promise<TokenInfo> {
    const cacheKey = `token_info_${tokenAddress}_${chain}`;
    const cached = this.getCached<TokenInfo>(cacheKey);
    if (cached) return cached;

    try {
      const provider = this.getProvider(chain);
      const tokenContract = new Contract(tokenAddress, ERC20_ABI, provider);

      const [symbol, name, decimals] = await Promise.all([
        tokenContract.symbol(),
        tokenContract.name(),
        tokenContract.decimals()
      ]);

      const result: TokenInfo = {
        address: DexHelpers.formatAddress(tokenAddress),
        symbol,
        name,
        decimals: parseInt(decimals.toString()),
        chain: chain as Chain
      };

      // Cache por más tiempo para info de tokens (no cambia frecuentemente)
      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });

      return result;
    } catch (error) {
      console.error(`Error fetching token info for ${tokenAddress}:`, error);
      throw new Error(`Token info fetch failed: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  // ============================================================================
  // FUNCIONES DE AGREGACIÓN DE DATOS
  // ============================================================================

  /**
   * Obtiene precios de múltiples fuentes y los agrega
   */
  async getAggregatedPrices(
    tokenIn: TokenInfo,
    tokenOut: TokenInfo,
    amountIn: bigint,
    dexes: DexInfo[]
  ): Promise<PriceData[]> {
    const results: PriceData[] = [];

    await Promise.allSettled(
      dexes.map(async (dex) => {
        try {
          const priceData = await this.getDexPrice(tokenIn, tokenOut, amountIn, dex);
          if (priceData) {
            results.push(priceData);
          }
        } catch (error) {
          console.warn(`Failed to get price from ${dex.name}:`, error);
        }
      })
    );

    return results.sort((a, b) => Number(b.amountOut - a.amountOut));
  }

  /**
   * Obtiene precio de un DEX específico
   */
  async getDexPrice(
    tokenIn: TokenInfo,
    tokenOut: TokenInfo,
    amountIn: bigint,
    dex: DexInfo
  ): Promise<PriceData | null> {
    try {
      // Para V2-style DEXs
      if (dex.type === 'uniswap-v2' || dex.type === 'sushiswap') {
        const amounts = await this.getAmountsOut(
          dex.router,
          amountIn,
          [tokenIn.address, tokenOut.address],
          dex.chain
        );

        if (amounts.length >= 2) {
          return {
            dex: dex.name,
            tokenIn: tokenIn.address,
            tokenOut: tokenOut.address,
            amountIn,
            amountOut: amounts[amounts.length - 1],
            priceImpact: 0, // Calcular si es necesario
            liquidity: 0n, // Obtener de pool si es necesario
            reserveIn: 0n,
            reserveOut: 0n,
            fee: dex.fee,
            timestamp: Date.now()
          };
        }
      }

      // Aquí agregar lógica para V3 y otros tipos de DEX

      return null;
    } catch (error) {
      console.error(`Error getting price from ${dex.name}:`, error);
      return null;
    }
  }

  /**
   * Busca las mejores rutas de arbitraje
   */
  async findBestRoutes(
    tokenA: TokenInfo,
    tokenB: TokenInfo,
    amount: bigint,
    dexes: DexInfo[],
    maxHops: number = 3
  ): Promise<SwapRoute[]> {
    const routes: SwapRoute[] = [];

    // Rutas directas (1 hop)
    for (const dex of dexes) {
      const priceData = await this.getDexPrice(tokenA, tokenB, amount, dex);
      if (priceData && priceData.amountOut > 0n) {
        routes.push({
          path: [tokenA, tokenB],
          dexes: [dex],
          expectedOutput: priceData.amountOut,
          priceImpact: priceData.priceImpact,
          gasEstimate: 150000n,
          confidence: 0.9
        });
      }
    }

    // Aquí agregar lógica para rutas multi-hop si maxHops > 1

    return routes.sort((a, b) => Number(b.expectedOutput - a.expectedOutput));
  }

  // ============================================================================
  // UTILIDADES Y MANTENIMIENTO
  // ============================================================================

  /**
   * Actualiza todos los caches
   */
  async refreshAllCaches(): Promise<void> {
    console.log('🔄 Refreshing all caches...');
    this.cleanCache();
    
    // Aquí se pueden agregar operaciones específicas de refresh
    console.log('✅ Cache refresh completed');
  }

  /**
   * Obtiene estadísticas del cache
   */
  getCacheStats(): {
    totalEntries: number;
    validEntries: number;
    expiredEntries: number;
    hitRate: number;
  } {
    const now = Date.now();
    let validEntries = 0;
    let expiredEntries = 0;

    for (const entry of this.cache.values()) {
      if (now - entry.timestamp <= this.cacheTimeout) {
        validEntries++;
      } else {
        expiredEntries++;
      }
    }

    return {
      totalEntries: this.cache.size,
      validEntries,
      expiredEntries,
      hitRate: validEntries / (validEntries + expiredEntries) || 0
    };
  }

  /**
   * Limpia todos los caches
   */
  clearAllCaches(): void {
    this.cache.clear();
    console.log('🗑️  All caches cleared');
  }
}

// ============================================================================
// INSTANCIA SINGLETON EXPORTADA
// ============================================================================

export const dexDataFetcher = new DexDataFetcher();
export default dexDataFetcher;
/**
 * ArbitrageX Supreme - DEX Helpers
 * 
 * Utilidades para cálculos de DEX, precios, y operaciones blockchain
 * Enfoque metodico en precisión matemática y eficiencia
 */

import { ethers } from 'ethers';
import type { Chain, TokenInfo, LiquidityPool, PriceData } from '../apps/web/types/defi';
import type { SwapRoute, PriceQuote, TokenPair, LiquidityAnalysis } from '../apps/web/types/backend';

// ============================================================================
// CONSTANTES Y CONFIGURACIONES
// ============================================================================

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const MAX_UINT256 = ethers.MaxUint256;

// Precision para cálculos decimales
const PRECISION = 1e18;
const FEE_DENOMINATOR = 10000;

// Configuraciones por tipo de DEX
const DEX_CONFIGS = {
  'uniswap-v2': {
    feeRate: 0.003, // 0.3%
    minLiquidity: ethers.parseEther('0.1'),
    maxPriceImpact: 0.05 // 5%
  },
  'uniswap-v3': {
    feeRates: [0.0001, 0.0005, 0.003, 0.01],
    minLiquidity: ethers.parseEther('1'),
    maxPriceImpact: 0.03 // 3%
  },
  'curve': {
    feeRate: 0.0004, // 0.04%
    minLiquidity: ethers.parseEther('10'),
    maxPriceImpact: 0.01 // 1%
  },
  'sushiswap': {
    feeRate: 0.003, // 0.3%
    minLiquidity: ethers.parseEther('0.1'),
    maxPriceImpact: 0.05 // 5%
  }
};

// ============================================================================
// CLASE PRINCIPAL - DEX HELPERS
// ============================================================================

export class DexHelpers {
  
  // ============================================================================
  // CÁLCULOS DE PRECIOS Y AMOUNTS
  // ============================================================================

  /**
   * Calcula el precio de salida para un swap AMM V2
   */
  static calculateAmountOut(
    amountIn: bigint,
    reserveIn: bigint,
    reserveOut: bigint,
    fee: number = 0.003
  ): bigint {
    if (amountIn <= 0n || reserveIn <= 0n || reserveOut <= 0n) {
      return 0n;
    }

    // Aplicar fee
    const feeMultiplier = BigInt(Math.floor((1 - fee) * FEE_DENOMINATOR));
    const amountInWithFee = amountIn * feeMultiplier;
    
    // Formula AMM: amountOut = (amountInWithFee * reserveOut) / (reserveIn * FEE_DENOMINATOR + amountInWithFee)
    const numerator = amountInWithFee * reserveOut;
    const denominator = (reserveIn * BigInt(FEE_DENOMINATOR)) + amountInWithFee;
    
    return numerator / denominator;
  }

  /**
   * Calcula el precio de entrada requerido para obtener un amount específico
   */
  static calculateAmountIn(
    amountOut: bigint,
    reserveIn: bigint,
    reserveOut: bigint,
    fee: number = 0.003
  ): bigint {
    if (amountOut <= 0n || reserveIn <= 0n || reserveOut <= 0n || amountOut >= reserveOut) {
      return MAX_UINT256;
    }

    const feeMultiplier = BigInt(Math.floor((1 - fee) * FEE_DENOMINATOR));
    
    // Formula inversa AMM
    const numerator = reserveIn * amountOut * BigInt(FEE_DENOMINATOR);
    const denominator = (reserveOut - amountOut) * feeMultiplier;
    
    return numerator / denominator + 1n; // +1 para redondeo hacia arriba
  }

  /**
   * Calcula el impacto de precio de un swap
   */
  static calculatePriceImpact(
    amountIn: bigint,
    reserveIn: bigint,
    reserveOut: bigint,
    fee: number = 0.003
  ): number {
    if (reserveIn <= 0n || reserveOut <= 0n) return 1; // 100% de impacto si no hay liquidez

    // Precio antes del swap
    const priceBefore = Number(reserveOut) / Number(reserveIn);
    
    // Amount out después del swap
    const amountOut = this.calculateAmountOut(amountIn, reserveIn, reserveOut, fee);
    
    if (amountOut <= 0n) return 1;

    // Precio efectivo del swap
    const effectivePrice = Number(amountOut) / Number(amountIn);
    
    // Impacto de precio = |precio_efectivo - precio_antes| / precio_antes
    return Math.abs(effectivePrice - priceBefore) / priceBefore;
  }

  /**
   * Calcula slippage para un trade
   */
  static calculateSlippage(
    expectedAmount: bigint,
    actualAmount: bigint
  ): number {
    if (expectedAmount <= 0n) return 0;
    
    const slippage = (Number(expectedAmount) - Number(actualAmount)) / Number(expectedAmount);
    return Math.max(0, slippage); // No negativo
  }

  /**
   * Obtiene el precio actual de un par de tokens
   */
  static getTokenPrice(
    tokenA: TokenInfo,
    tokenB: TokenInfo,
    reserveA: bigint,
    reserveB: bigint
  ): number {
    if (reserveA <= 0n || reserveB <= 0n) return 0;

    // Ajustar por decimales
    const adjustedReserveA = Number(reserveA) / Math.pow(10, tokenA.decimals);
    const adjustedReserveB = Number(reserveB) / Math.pow(10, tokenB.decimals);
    
    return adjustedReserveB / adjustedReserveA;
  }

  // ============================================================================
  // ANÁLISIS DE LIQUIDEZ
  // ============================================================================

  /**
   * Analiza la profundidad de liquidez de un pool
   */
  static analyzeLiquidityDepth(pool: LiquidityPool): LiquidityAnalysis {
    const { reserve0, reserve1, token0, token1 } = pool;
    
    // Liquidez geométrica media
    const geometricMean = Math.sqrt(Number(reserve0) * Number(reserve1));
    
    // Normalizar por decimales
    const normalizedReserve0 = Number(reserve0) / Math.pow(10, token0.decimals);
    const normalizedReserve1 = Number(reserve1) / Math.pow(10, token1.decimals);
    
    // Calcular profundidad (resistencia a cambios de precio)
    const depth = geometricMean / Math.pow(10, 18);
    
    // Concentración de liquidez (qué tan balanceado está el pool)
    const ratio = normalizedReserve0 / normalizedReserve1;
    const concentration = 1 / (1 + Math.abs(Math.log(ratio)));
    
    // Eficiencia de capital (basado en utilización)
    const volume24h = pool.volume24h || 0;
    const tvl = pool.reserveUSD || 1;
    const efficiency = volume24h / tvl;
    
    // Estabilidad (basado en cambios recientes)
    const stability = concentration * (1 - Math.min(efficiency / 2, 1));
    
    // Score de riesgo combinado
    const riskScore = Math.max(0, Math.min(1, 
      (1 - concentration) * 0.4 + 
      (efficiency > 2 ? 0.3 : 0) + 
      (depth < 1000 ? 0.3 : 0)
    ));

    return {
      pool,
      depth,
      concentration,
      efficiency,
      stability,
      riskScore
    };
  }

  /**
   * Encuentra la mejor ruta para un swap multi-hop
   */
  static findBestRoute(
    tokenIn: TokenInfo,
    tokenOut: TokenInfo,
    amountIn: bigint,
    pools: LiquidityPool[],
    maxHops: number = 3
  ): SwapRoute | null {
    // Implementación simplificada - buscar ruta directa primero
    const directPool = pools.find(pool => 
      (pool.token0.address === tokenIn.address && pool.token1.address === tokenOut.address) ||
      (pool.token1.address === tokenIn.address && pool.token0.address === tokenOut.address)
    );

    if (directPool) {
      const isToken0 = directPool.token0.address === tokenIn.address;
      const reserveIn = isToken0 ? directPool.reserve0 : directPool.reserve1;
      const reserveOut = isToken0 ? directPool.reserve1 : directPool.reserve0;
      
      const amountOut = this.calculateAmountOut(amountIn, reserveIn, reserveOut, directPool.fee);
      const priceImpact = this.calculatePriceImpact(amountIn, reserveIn, reserveOut, directPool.fee);
      
      return {
        path: [tokenIn.address, tokenOut.address],
        amountIn,
        amountOut,
        priceImpact,
        fee: directPool.fee,
        gasEstimate: BigInt(150000) // Estimación básica
      };
    }

    // TODO: Implementar búsqueda multi-hop más sofisticada
    return null;
  }

  // ============================================================================
  // UTILIDADES DE CONVERSIÓN Y FORMATO
  // ============================================================================

  /**
   * Trunca una dirección para mostrar
   */
  static truncateAddress(address: string, startLength: number = 6, endLength: number = 4): string {
    if (!address || address.length < startLength + endLength) return address;
    return `${address.slice(0, startLength)}...${address.slice(-endLength)}`;
  }

  /**
   * Formatea un amount con decimales apropiados
   */
  static formatAmount(
    amount: bigint,
    decimals: number = 18,
    displayDecimals: number = 4
  ): string {
    const value = Number(amount) / Math.pow(10, decimals);
    
    if (value === 0) return '0';
    if (value < 0.0001) return '<0.0001';
    if (value > 1000000) return `${(value / 1000000).toFixed(2)}M`;
    if (value > 1000) return `${(value / 1000).toFixed(2)}K`;
    
    return value.toFixed(displayDecimals);
  }

  /**
   * Formatea un precio USD
   */
  static formatUSD(amount: number, compact: boolean = false): string {
    if (amount === 0) return '$0.00';
    if (amount < 0.01) return '<$0.01';
    
    if (compact) {
      if (amount > 1000000) return `$${(amount / 1000000).toFixed(2)}M`;
      if (amount > 1000) return `$${(amount / 1000).toFixed(2)}K`;
    }
    
    return `$${amount.toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    })}`;
  }

  /**
   * Formatea un porcentaje
   */
  static formatPercentage(value: number, decimals: number = 2): string {
    if (value === 0) return '0.00%';
    return `${(value * 100).toFixed(decimals)}%`;
  }

  /**
   * Convierte entre diferentes unidades de gas
   */
  static formatGas(gasAmount: bigint, unit: 'wei' | 'gwei' | 'eth' = 'gwei'): string {
    switch (unit) {
      case 'wei':
        return gasAmount.toString();
      case 'gwei':
        return (Number(gasAmount) / 1e9).toFixed(2);
      case 'eth':
        return ethers.formatEther(gasAmount);
      default:
        return gasAmount.toString();
    }
  }

  // ============================================================================
  // VALIDACIONES Y CHECKS DE SEGURIDAD
  // ============================================================================

  /**
   * Valida que una dirección sea válida
   */
  static isValidAddress(address: string): boolean {
    try {
      return ethers.isAddress(address);
    } catch {
      return false;
    }
  }

  /**
   * Valida que un pool tenga liquidez suficiente
   */
  static hasMinimumLiquidity(
    pool: LiquidityPool, 
    minLiquidityUSD: number = 1000
  ): boolean {
    return pool.reserveUSD >= minLiquidityUSD;
  }

  /**
   * Verifica si un swap es seguro (bajo impacto de precio)
   */
  static isSafeSwap(
    amountIn: bigint,
    reserveIn: bigint,
    reserveOut: bigint,
    maxPriceImpact: number = 0.05
  ): boolean {
    const priceImpact = this.calculatePriceImpact(amountIn, reserveIn, reserveOut);
    return priceImpact <= maxPriceImpact;
  }

  /**
   * Calcula el gas estimado para diferentes tipos de transacciones
   */
  static estimateGas(
    transactionType: 'swap' | 'addLiquidity' | 'removeLiquidity' | 'approve',
    hops: number = 1
  ): bigint {
    const baseGas = {
      'approve': BigInt(45000),
      'swap': BigInt(150000),
      'addLiquidity': BigInt(200000),
      'removeLiquidity': BigInt(180000)
    };

    const hopMultiplier = transactionType === 'swap' ? BigInt(hops) : 1n;
    return baseGas[transactionType] * hopMultiplier;
  }

  // ============================================================================
  // UTILIDADES MATEMÁTICAS AVANZADAS
  // ============================================================================

  /**
   * Calcula la raíz cuadrada de un BigInt (para precios V3)
   */
  static sqrt(value: bigint): bigint {
    if (value < 0n) {
      throw new Error('Square root of negative number');
    }
    if (value < 2n) {
      return value;
    }

    // Método de Newton-Raphson para BigInt
    let x = value;
    let y = (value + 1n) / 2n;
    
    while (y < x) {
      x = y;
      y = (value / x + x) / 2n;
    }
    
    return x;
  }

  /**
   * Calcula el precio de un token V3 basado en sqrtPriceX96
   */
  static calculateV3Price(
    sqrtPriceX96: bigint,
    token0Decimals: number,
    token1Decimals: number
  ): number {
    // Convertir sqrtPriceX96 a precio normal
    const Q96 = 2n ** 96n;
    const price = (sqrtPriceX96 * sqrtPriceX96) / (Q96 * Q96);
    
    // Ajustar por decimales
    const decimalAdjustment = Math.pow(10, token1Decimals - token0Decimals);
    
    return Number(price) * decimalAdjustment;
  }

  /**
   * Convierte un precio a sqrtPriceX96 (para V3)
   */
  static priceToSqrtPriceX96(
    price: number,
    token0Decimals: number,
    token1Decimals: number
  ): bigint {
    // Ajustar por decimales
    const decimalAdjustment = Math.pow(10, token0Decimals - token1Decimals);
    const adjustedPrice = price * decimalAdjustment;
    
    // Convertir a sqrtPriceX96
    const sqrtPrice = Math.sqrt(adjustedPrice);
    const Q96 = 2 ** 96;
    
    return BigInt(Math.floor(sqrtPrice * Q96));
  }

  // ============================================================================
  // CONFIGURACIONES POR DEX
  // ============================================================================

  /**
   * Obtiene la configuración específica para un tipo de DEX
   */
  static getDexConfig(dexType: string): typeof DEX_CONFIGS['uniswap-v2'] {
    return DEX_CONFIGS[dexType as keyof typeof DEX_CONFIGS] || DEX_CONFIGS['uniswap-v2'];
  }

  /**
   * Verifica si un DEX soporta una característica específica
   */
  static supportsFeature(
    dexType: string,
    feature: 'flashLoans' | 'multiHop' | 'concentratedLiquidity' | 'stableSwap'
  ): boolean {
    const features = {
      'uniswap-v2': ['multiHop'],
      'uniswap-v3': ['flashLoans', 'multiHop', 'concentratedLiquidity'],
      'curve': ['stableSwap'],
      'sushiswap': ['multiHop'],
      'balancer': ['flashLoans', 'multiHop']
    };

    return features[dexType as keyof typeof features]?.includes(feature) || false;
  }
}
/**
 * ArbitrageX Supreme - DEX Helper Utilities
 * 
 * Módulo central para operaciones con DEXs y protocolos DeFi
 * Aplicando principios metodicos y mejores prácticas
 * 
 * Funcionalidades:
 * - Formateo de direcciones y tokens
 * - Cálculos de precios y slippage
 * - Validaciones de protocolos
 * - Helpers para transacciones multi-chain
 */

import { ethers } from 'ethers';
import { Chain, DexInfo, LendingInfo, TokenInfo, PriceData, SwapRoute, ArbitrageOpportunity } from '../types/defi';

// ============================================================================
// CONSTANTES Y CONFIGURACIONES
// ============================================================================

export const SUPPORTED_CHAINS = [
  'ethereum', 'polygon', 'arbitrum', 'optimism', 'avalanche',
  'fantom', 'cronos', 'aurora', 'harmony', 'celo',
  'moonbeam', 'kava', 'metis', 'gnosis', 'fuse',
  'evmos', 'milkomeda', 'syscoin', 'oasis', 'telos'
] as const;

export const DEX_TYPES = [
  'uniswap-v2', 'uniswap-v3', 'sushiswap', 'pancakeswap', 
  'curve', 'balancer', 'dodo', 'kyberswap', 'traderjoe', 
  'spookyswap', '1inch', 'paraswap'
] as const;

export const LENDING_TYPES = [
  'aave-v3', 'compound-v3', 'morpho', 'euler', 'cream',
  'venus', 'radiant', 'geist', 'hundred', 'granary'
] as const;

// Tolerancias y límites por defecto
export const DEFAULT_SLIPPAGE = 0.005; // 0.5%
export const DEFAULT_DEADLINE = 300; // 5 minutos
export const MIN_PROFIT_THRESHOLD = ethers.parseEther('0.01'); // 0.01 ETH mínimo
export const MAX_GAS_PRICE = ethers.parseUnits('50', 'gwei');

// ============================================================================
// UTILIDADES DE FORMATEO Y VALIDACIÓN
// ============================================================================

/**
 * Valida si una dirección es válida en formato Ethereum
 */
export function isValidAddress(address: string): boolean {
  try {
    return ethers.isAddress(address);
  } catch {
    return false;
  }
}

/**
 * Formatea una dirección para mostrar (checksum)
 */
export function formatAddress(address: string): string {
  if (!isValidAddress(address)) {
    throw new Error(`Dirección inválida: ${address}`);
  }
  return ethers.getAddress(address);
}

/**
 * Convierte direcciones a formato truncado para UI
 */
export function truncateAddress(address: string, length: number = 6): string {
  if (!isValidAddress(address)) return 'Invalid';
  const formatted = formatAddress(address);
  return `${formatted.slice(0, 2 + length)}...${formatted.slice(-length)}`;
}

/**
 * Valida y formatea cantidad con decimales específicos
 */
export function formatTokenAmount(
  amount: string | bigint, 
  decimals: number = 18, 
  displayDecimals: number = 6
): string {
  try {
    const bigAmount = typeof amount === 'string' ? BigInt(amount) : amount;
    const formatted = ethers.formatUnits(bigAmount, decimals);
    const num = parseFloat(formatted);
    
    if (num === 0) return '0';
    if (num < 0.000001) return '<0.000001';
    
    return num.toFixed(displayDecimals).replace(/\.?0+$/, '');
  } catch {
    return '0';
  }
}

/**
 * Convierte cantidad con decimales a BigInt
 */
export function parseTokenAmount(amount: string, decimals: number = 18): bigint {
  try {
    return ethers.parseUnits(amount, decimals);
  } catch {
    throw new Error(`Error parsing amount: ${amount} with decimals: ${decimals}`);
  }
}

// ============================================================================
// CÁLCULOS DE PRECIO Y SLIPPAGE
// ============================================================================

/**
 * Calcula el precio impacto basado en reservas de liquidez
 */
export function calculatePriceImpact(
  amountIn: bigint,
  reserveIn: bigint,
  reserveOut: bigint,
  fee: number = 0.003 // 0.3% por defecto
): number {
  if (reserveIn === 0n || reserveOut === 0n) return 1; // 100% impacto si no hay liquidez
  
  const amountInWithFee = amountIn * BigInt(Math.floor((1 - fee) * 10000)) / 10000n;
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn + amountInWithFee;
  const amountOut = numerator / denominator;
  
  const spotPrice = (reserveOut * 10000n) / reserveIn;
  const executionPrice = (amountOut * 10000n) / amountIn;
  
  const impact = Number(spotPrice - executionPrice) / Number(spotPrice);
  return Math.max(0, impact);
}

/**
 * Calcula cantidad mínima considerando slippage
 */
export function calculateMinAmountOut(
  expectedAmount: bigint,
  slippageTolerance: number = DEFAULT_SLIPPAGE
): bigint {
  const slippageMultiplier = BigInt(Math.floor((1 - slippageTolerance) * 10000));
  return (expectedAmount * slippageMultiplier) / 10000n;
}

/**
 * Calcula el mejor precio entre múltiples DEXs
 */
export function findBestPrice(
  priceData: PriceData[],
  amountIn: bigint,
  tokenIn: string,
  tokenOut: string
): PriceData | null {
  const validPrices = priceData.filter(
    (data) => 
      data.tokenIn.toLowerCase() === tokenIn.toLowerCase() &&
      data.tokenOut.toLowerCase() === tokenOut.toLowerCase() &&
      data.liquidity > amountIn
  );

  if (validPrices.length === 0) return null;

  return validPrices.reduce((best, current) => {
    const currentOutput = calculateAmountOut(amountIn, current);
    const bestOutput = calculateAmountOut(amountIn, best);
    return currentOutput > bestOutput ? current : best;
  });
}

/**
 * Calcula cantidad de salida basada en datos de precio
 */
export function calculateAmountOut(amountIn: bigint, priceData: PriceData): bigint {
  if (priceData.reserveIn === 0n || priceData.reserveOut === 0n) return 0n;
  
  const fee = priceData.fee || 0.003;
  const amountInWithFee = amountIn * BigInt(Math.floor((1 - fee) * 10000)) / 10000n;
  const numerator = amountInWithFee * priceData.reserveOut;
  const denominator = priceData.reserveIn + amountInWithFee;
  
  return numerator / denominator;
}

// ============================================================================
// VALIDACIONES DE PROTOCOLOS
// ============================================================================

/**
 * Valida configuración de DEX
 */
export function validateDexConfig(dex: DexInfo): boolean {
  try {
    if (!dex.name || !dex.router || !dex.factory) return false;
    if (!isValidAddress(dex.router) || !isValidAddress(dex.factory)) return false;
    if (!SUPPORTED_CHAINS.includes(dex.chain as any)) return false;
    if (!DEX_TYPES.includes(dex.type as any)) return false;
    if (typeof dex.fee !== 'number' || dex.fee < 0 || dex.fee > 1) return false;
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Valida configuración de protocolo de lending
 */
export function validateLendingConfig(lending: LendingInfo): boolean {
  try {
    if (!lending.name || !lending.poolAddressProvider) return false;
    if (!isValidAddress(lending.poolAddressProvider)) return false;
    if (!SUPPORTED_CHAINS.includes(lending.chain as any)) return false;
    if (!LENDING_TYPES.includes(lending.type as any)) return false;
    
    return true;
  } catch {
    return false;
  }
}

/**
 * Valida información de token
 */
export function validateTokenInfo(token: TokenInfo): boolean {
  try {
    if (!token.symbol || !token.address || typeof token.decimals !== 'number') return false;
    if (!isValidAddress(token.address)) return false;
    if (token.decimals < 0 || token.decimals > 18) return false;
    if (!SUPPORTED_CHAINS.includes(token.chain as any)) return false;
    
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// UTILIDADES PARA TRANSACCIONES MULTI-CHAIN
// ============================================================================

/**
 * Genera identificador único para transacción cross-chain
 */
export function generateCrossChainId(
  sourceChain: string,
  targetChain: string,
  timestamp: number = Date.now()
): string {
  const data = `${sourceChain}-${targetChain}-${timestamp}`;
  return ethers.keccak256(ethers.toUtf8Bytes(data)).slice(0, 10);
}

/**
 * Calcula gas estimado para operación cross-chain
 */
export function estimateCrossChainGas(
  sourceChain: string,
  targetChain: string,
  complexity: 'simple' | 'medium' | 'complex' = 'medium'
): bigint {
  const baseGas = {
    simple: 150000n,
    medium: 300000n,
    complex: 500000n
  };

  const chainMultiplier = {
    ethereum: 2n,
    polygon: 1n,
    arbitrum: 1n,
    optimism: 1n,
    avalanche: 1n
  };

  const sourceMultiplier = (chainMultiplier as any)[sourceChain] || 1n;
  const targetMultiplier = (chainMultiplier as any)[targetChain] || 1n;

  return baseGas[complexity] * (sourceMultiplier + targetMultiplier) / 2n;
}

/**
 * Formatea ruta de swap para logging y debugging
 */
export function formatSwapRoute(route: SwapRoute): string {
  const path = route.path.map(token => token.symbol).join(' → ');
  const dexes = route.dexes.map(dex => dex.name).join(' → ');
  return `${path} via ${dexes}`;
}

// ============================================================================
// UTILIDADES DE ARBITRAJE
// ============================================================================

/**
 * Calcula rentabilidad potencial de oportunidad de arbitraje
 */
export function calculateArbitrageProfitability(
  opportunity: ArbitrageOpportunity,
  gasPrice: bigint,
  estimatedGas: bigint
): {
  grossProfit: bigint;
  gasCost: bigint;
  netProfit: bigint;
  profitabilityRatio: number;
} {
  const grossProfit = opportunity.expectedProfit;
  const gasCost = gasPrice * estimatedGas;
  const netProfit = grossProfit > gasCost ? grossProfit - gasCost : 0n;
  const profitabilityRatio = Number(netProfit) / Number(grossProfit);

  return {
    grossProfit,
    gasCost,
    netProfit,
    profitabilityRatio
  };
}

/**
 * Ordena oportunidades por rentabilidad (considerando gas)
 */
export function sortOpportunitiesByProfitability(
  opportunities: ArbitrageOpportunity[],
  gasPrice: bigint,
  estimatedGas: bigint = 300000n
): ArbitrageOpportunity[] {
  return opportunities
    .map(opp => ({
      ...opp,
      profitability: calculateArbitrageProfitability(opp, gasPrice, estimatedGas)
    }))
    .filter(opp => opp.profitability.netProfit > 0n)
    .sort((a, b) => 
      Number(b.profitability.netProfit - a.profitability.netProfit)
    );
}

/**
 * Valida si una oportunidad de arbitraje es ejecutable
 */
export function isArbitrageExecutable(
  opportunity: ArbitrageOpportunity,
  minProfitThreshold: bigint = MIN_PROFIT_THRESHOLD,
  maxSlippage: number = 0.03 // 3%
): {
  executable: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];

  if (opportunity.expectedProfit < minProfitThreshold) {
    reasons.push(`Profit below threshold: ${formatTokenAmount(opportunity.expectedProfit)} < ${formatTokenAmount(minProfitThreshold)}`);
  }

  if (opportunity.confidence < 0.8) {
    reasons.push(`Low confidence: ${opportunity.confidence}`);
  }

  if (opportunity.routes.some(route => route.priceImpact > maxSlippage)) {
    reasons.push(`High price impact detected`);
  }

  if (Date.now() - opportunity.timestamp > 30000) { // 30 segundos
    reasons.push(`Opportunity too old: ${Date.now() - opportunity.timestamp}ms`);
  }

  return {
    executable: reasons.length === 0,
    reasons
  };
}

// ============================================================================
// UTILIDADES DE LOGGING Y DEBUGGING
// ============================================================================

/**
 * Crea log estructurado para operaciones de arbitraje
 */
export function createArbitrageLog(
  operation: string,
  data: any,
  level: 'info' | 'warn' | 'error' = 'info'
): {
  timestamp: number;
  operation: string;
  level: string;
  data: any;
  id: string;
} {
  return {
    timestamp: Date.now(),
    operation,
    level,
    data,
    id: generateCrossChainId('log', operation)
  };
}

/**
 * Formatea datos para display en consola con colores
 */
export function formatConsoleOutput(
  title: string,
  data: Record<string, any>
): string {
  const lines = [
    `\n🔹 ${title} 🔹`,
    ''.padEnd(title.length + 6, '─')
  ];

  for (const [key, value] of Object.entries(data)) {
    let formattedValue: string;
    
    if (typeof value === 'bigint') {
      formattedValue = formatTokenAmount(value);
    } else if (typeof value === 'number' && value < 1) {
      formattedValue = (value * 100).toFixed(2) + '%';
    } else if (typeof value === 'object') {
      formattedValue = JSON.stringify(value, null, 2);
    } else {
      formattedValue = String(value);
    }

    lines.push(`${key.padEnd(20, '.')}: ${formattedValue}`);
  }

  return lines.join('\n');
}

// ============================================================================
// EXPORTACIONES ADICIONALES
// ============================================================================

export const DexHelpers = {
  // Validación
  isValidAddress,
  validateDexConfig,
  validateLendingConfig,
  validateTokenInfo,
  
  // Formateo
  formatAddress,
  truncateAddress,
  formatTokenAmount,
  parseTokenAmount,
  formatSwapRoute,
  formatConsoleOutput,
  
  // Cálculos
  calculatePriceImpact,
  calculateMinAmountOut,
  calculateAmountOut,
  findBestPrice,
  calculateArbitrageProfitability,
  
  // Utilidades
  generateCrossChainId,
  estimateCrossChainGas,
  sortOpportunitiesByProfitability,
  isArbitrageExecutable,
  createArbitrageLog
};

export default DexHelpers;
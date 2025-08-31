// Tipos específicos para ArbitrageOpportunity con compatibilidad
import type { ArbitrageOpportunity as BaseArbitrageOpportunity } from './defi'

// Interfaz principal unificada para ArbitrageOpportunity
export interface ArbitrageOpportunity {
  // Campos obligatorios básicos
  id: string;
  description: string;
  path: string[];
  protocols: Array<{ id: string; name: string; type?: string; }>;
  chainId: number;
  
  // Campos de ganancia (al menos uno debe existir)
  profitUSD?: number;
  profitPercentage?: number;
  profitAmount?: string;
  amount?: string | number;
  
  // Campos de tokens y blockchain
  tokenIn?: string;
  tokenOut?: string;
  tokenA?: string;
  tokenB?: string;
  tokenC?: string;
  tokensInvolved?: string[];
  
  // Campos de estrategia y ejecución
  type?: 'Intra-DEX' | 'Inter-DEX' | 'Cross-Chain' | 'Lending Rate' | 'Flash Loan' | 'Perpetual' | 'MEV' | 'Options' | 'Synthetic' | 'Governance' | 'Insurance' | 'Statistical' | string;
  strategy?: string;
  
  // Campos de exchanges y protocolos
  exchangeA?: string;
  exchangeB?: string;
  source?: string;
  destination?: string;
  
  // Campos de blockchain y cadenas
  blockchainFrom?: string;
  blockchainTo?: string;
  chainIds?: number[];
  
  // Campos de tiempo y validez
  timestamp?: number;
  expiresAt?: string | Date | number;
  deadline?: number;
  
  // Campos de confianza y métricas
  confidence?: number;
  roi?: number;
  priority?: 'low' | 'medium' | 'high' | string;
  
  // Campos técnicos
  gasEstimate?: string | number;
  minAmountOut?: number;
  expectedProfit?: number;
  routeData?: string;
  liquidity?: number;
  amountIn?: number;
  volume?: string;
  
  // Campos de precios
  priceFrom?: number;
  priceTo?: number;
  
  // Campos adicionales del backend legacy
  details?: unknown;
  
  // Permitir propiedades adicionales para flexibilidad
  [key: string]: unknown;
}

// Interfaz específica para respuestas de API de oportunidades en vivo
export interface LiveOpportunityResponse {
  opportunities: ArbitrageOpportunity[];
  count: number;
  timestamp: string;
  status: 'success' | 'error';
  scan_time_ms?: number;
  error?: string;
}

// Tipo para validación parcial
export type PartialArbitrageOpportunity = Partial<ArbitrageOpportunity>;

// Función de validación de campos obligatorios
export function hasRequiredFields(opp: unknown): opp is ArbitrageOpportunity {
  if (!opp || typeof opp !== 'object') return false;
  
  const obj = opp as Record<string, unknown>;
  
  return (
    typeof obj.description === 'string' &&
    Array.isArray(obj.path) &&
    Array.isArray(obj.protocols) &&
    typeof obj.chainId === 'number' &&
    (typeof obj.amount === 'string' || typeof obj.amount === 'number' || typeof obj.profitUSD === 'number')
  );
}

// Función utilitaria para convertir cualquier objeto a ArbitrageOpportunity válido
export function toArbitrageOpportunity(opp: unknown): ArbitrageOpportunity | null {
  if (!hasRequiredFields(opp)) return null;
  return opp as ArbitrageOpportunity;
}
import { BigNumber } from 'ethers';

// General Protocol Information
export interface ProtocolDetails {
  id: string;
  name: string;
  type: string; // e.g., 'DEX', 'Lending', 'Bridge', 'Oracle'
  [key: string]: any; // Allows for additional, protocol-specific details
}

// Snapshot of a specific protocol's state (e.g., TVL, key metrics)
export interface ProtocolSnapshot {
  protocolId: string;
  name: string;
  type: 'DEX' | 'Lending' | 'Bridge' | 'Oracle' | 'Other';
  tvlUSD?: number; // Total Value Locked in USD
  volume24hUSD?: number; // 24-hour trading volume in USD (for DEXs)
  interestRates?: {
    supplyAPR: number;
    borrowAPR: number;
  };
  details: any; // Raw details from the original DexInfo or LendingInfo
}

// Import the unified ArbitrageOpportunity interface from arbitrage.ts to avoid conflicts
import type { ArbitrageOpportunity } from './arbitrage'
export type { ArbitrageOpportunity } from './arbitrage'

// Financial metrics for a chain or globally
export interface FinancialMetric {
  name: string;
  value: number;
  unit: string; // e.g., 'USD', 'ETH', '%'
  timestamp: number;
}

// Aggregated data for a single blockchain
export interface ChainData {
  chainId: number;
  chainName: string;
  lastUpdated: number; // Unix timestamp
  protocolSnapshots: ProtocolSnapshot[];
  arbitrageOpportunities: ArbitrageOpportunity[];
  financialMetrics: FinancialMetric[];
  topTokens: string[]; // List of top N tokens by volume/liquidity on this chain
}

// Overall summary for the entire multi-chain network
export interface NetworkSummary {
  totalChainsMonitored: number;
  activeChains: number;
  totalGlobalTvlUSD: number;
  totalArbitrageOpportunitiesDetected: number;
  totalProfitableArbitrageOpportunities: number;
  lastGlobalUpdate: number;
  // Potentially more aggregate metrics like total volume, average profit, etc.
}

// Types related to contract interaction (simplified)
export interface TokenPrice {
    address: string;
    symbol: string;
    priceUsd: number;
}

// Additional types for API responses
export interface ArbitrageSnapshot {
  opportunities: ArbitrageOpportunity[];
  profitable: number;
  totalValue: number;
  averageProfit: number;
  byChain: { [chainId: number]: ArbitrageOpportunity[] };
  timestamp: number;
}

export interface MultiChainArbitrageResult {
  opportunities: ArbitrageOpportunity[];
  profitable: number;
  totalValue: number;
  averageProfit: number;
  byStrategy: { [strategy: string]: ArbitrageOpportunity[] };
  byChain: { [chainId: number]: ArbitrageOpportunity[] };
  timestamp: number;
}

export interface ConsolidatedSnapshot {
  timestamp: number;
  executionTime: number;
  
  arbitrageData: MultiChainArbitrageResult | null;
  systemHealth: SystemHealth;
  blockchainSummaries: BlockchainSummary[];
  performanceMetrics: PerformanceMetrics;
  alerts: AlertSummary;
  
  // Métricas agregadas
  totalOpportunities: number;
  profitableOpportunities: number;
  totalTVL: number;
  averageProfitability: number;
  
  // Estados de error si los hay
  errors: Array<{ component: string; error: string }>;
}

export interface BlockchainSummary {
  chainId: number;
  chainName: string;
  nativeToken: string;
  totalTVL: number;
  dexMetrics: {
    totalDexes: number;
    totalTVL: number;
    averageTVL: number;
    flashLoanSupport: number;
    topDexes: Array<{
      name: string;
      tvl: number;
      type: string;
    }>;
  };
  lendingMetrics: {
    totalProtocols: number;
    totalTVL: number;
    averageBorrowRate: number;
    flashLoanSupport: number;
    topProtocols: Array<{
      name: string;
      tvl: number;
      borrowRate: number;
    }>;
  };
  opportunities: number;
  lastUpdate: number;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  uptime: number;
  responseTime: number;
  components: Array<{ name: string; status: string }>;
  version: string;
  lastCheck: number;
}

export interface PerformanceMetrics {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageResponseTime: number;
  throughput: number;
  uptime: number;
  memoryUsage: NodeJS.MemoryUsage;
  cacheStats: { size: number; keys: string[] };
  lastReset: number;
}

export interface AlertSummary {
  total: number;
  critical: number;
  warning: number;
  info: number;
  alerts: Array<{
    id: string;
    severity: 'critical' | 'warning' | 'info';
    message: string;
    component: string;
    timestamp: number;
  }>;
}
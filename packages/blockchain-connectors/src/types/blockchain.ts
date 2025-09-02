// ArbitrageX Pro 2025 - Blockchain Types
// Definiciones de tipos para conectores blockchain

export interface BlockchainConfig {
  id: string;
  name: string;
  symbol: string;
  rpcUrl: string;
  wsUrl?: string;
  backupRpcUrl?: string;
  chainId?: number | string;
  explorerUrl?: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  blockTime: number; // segundos promedio por bloque
  confirmations: number; // confirmaciones requeridas
  universalContract?: string; // Contrato universal para arbitraje
  hybridBridge?: string; // Dirección del bridge híbrido
  arbitrageExecutor?: string; // Dirección del executor de arbitraje
  privateKey?: string; // Clave privada para transacciones (desarrollo)
  gasPrice?: string | number; // Precio de gas por defecto para transacciones
}

export interface TokenBalance {
  address: string;
  symbol: string;
  balance: string;
  decimals: number;
  usdValue?: number;
}

export interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  gasPrice?: string;
  gasUsed?: string;
  blockNumber: number;
  timestamp: number;
  status: 'pending' | 'confirmed' | 'failed';
}

export interface BlockchainConnector {
  config: BlockchainConfig;
  
  // Conexión y estado
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  getBlockNumber(): Promise<number>;
  getBalance(address: string): Promise<string>;
  
  // Información de tokens
  getTokenBalance(tokenAddress: string, walletAddress: string): Promise<TokenBalance>;
  getTokenPrice(tokenAddress: string): Promise<number>;
  
  // Transacciones
  getTransaction(hash: string): Promise<Transaction>;
  sendTransaction(to: string, value: string, data?: string): Promise<string>;
  estimateGas(to: string, value: string, data?: string): Promise<string>;
  
  // DEX específico
  getPoolInfo(poolAddress: string): Promise<any>;
  getSwapQuote(tokenIn: string, tokenOut: string, amountIn: string): Promise<any>;
  
  // Eventos y monitoreo
  subscribeToBlocks(callback: (blockNumber: number) => void): void;
  subscribeToAddress(address: string, callback: (transaction: Transaction) => void): void;
}

// Re-exportar desde la interfaz centralizada del frontend para evitar duplicación
// Esta interfaz está definida en apps/web/types/arbitrage.ts
export interface ArbitrageOpportunity {
  id: string;
  description: string;
  path: string[];
  protocols: Array<{ id: string; name: string; type?: string; }>;
  chainId: number;
  tokensInvolved?: string[];
  timestamp?: number;
  tokenIn: string;
  tokenOut: string;
  blockchainFrom: string;
  blockchainTo: string;
  profitPercentage?: number;
  profitAmount?: string | number;
  profitUSD?: number;
  strategy?: string;
  confidence?: number;
  gasEstimate?: number | string;
  expiresAt?: Date;
  priceFrom?: number;
  priceTo?: number;
  volume?: string | number;
  
  // Propiedades adicionales para compatibilidad con blockchain connectors
  amountIn?: string;
  expectedAmountOut?: string;
  expectedProfit?: number | string;
  tokenA?: string; // Para triangular arbitrage
  tokenB?: string; // Para triangular arbitrage
  exchanges?: Array<{ id: string; name: string; }>;
  tokens?: string[];
  amounts?: string[];
  liquidity?: number;
  deadline?: number;
  
  dexPath?: {
    exchange: string;
    poolAddress: string;
    fee?: number;
    pair?: string;
  }[];
  
  triangularPath?: {
    tokenA: string;
    tokenB: string;
    tokenC: string;
    route: string;
    steps: {
      from: string;
      to: string;
      dex: string;
    }[];
  };
}

export interface DEXInfo {
  name: string;
  address: string;
  factoryAddress?: string;
  routerAddress?: string;
  supportedTokens: string[];
  fees: {
    swap: number;
    withdraw?: number;
  };
}

// Resultado de ejecución de arbitraje (sincronizado con apps/web/types/api.ts)
export interface ExecutionResult {
  success: boolean;
  transactionHash?: string;
  gasUsed?: number;
  actualProfit?: number;
  errorMessage?: string;
  executionTime?: number;
  details?: unknown;
  
  // Propiedades adicionales para compatibilidad con blockchain connectors
  profit?: number;
  gasCost?: number;
}
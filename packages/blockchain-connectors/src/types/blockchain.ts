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

export interface ArbitrageOpportunity {
  id: string;
  strategy: string;
  blockchainFrom: string;
  blockchainTo: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  expectedAmountOut: string;
  profitAmount: string;
  profitPercentage: number;
  gasEstimate: string;
  confidence: number;
  expiresAt: Date;
  dexPath: {
    exchange: string;
    poolAddress: string;
    fee?: number;
    pair?: string; // Par de tokens para este swap (ej: "ETH/USDC")
  }[];
  // Información específica para triangular arbitrage
  triangularPath?: {
    tokenA: string;
    tokenB: string;
    tokenC: string;
    route: string; // Descripción legible: "ETH → USDC → DAI → ETH"
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
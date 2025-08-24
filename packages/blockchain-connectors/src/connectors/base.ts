// ArbitrageX Pro 2025 - Base Blockchain Connector
// Clase base para todos los conectores blockchain

import { BlockchainConfig, BlockchainConnector, Transaction, TokenBalance } from '../types/blockchain';

export abstract class BaseBlockchainConnector implements BlockchainConnector {
  public config: BlockchainConfig;
  protected connected: boolean = false;
  protected provider: any;
  protected websocket: any;

  constructor(config: BlockchainConfig) {
    this.config = config;
  }

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract getBlockNumber(): Promise<number>;
  abstract getBalance(address: string): Promise<string>;
  abstract getTokenBalance(tokenAddress: string, walletAddress: string): Promise<TokenBalance>;
  abstract getTokenPrice(tokenAddress: string): Promise<number>;
  abstract getTransaction(hash: string): Promise<Transaction>;
  abstract sendTransaction(to: string, value: string, data?: string): Promise<string>;
  abstract estimateGas(to: string, value: string, data?: string): Promise<string>;
  abstract getPoolInfo(poolAddress: string): Promise<any>;
  abstract getSwapQuote(tokenIn: string, tokenOut: string, amountIn: string): Promise<any>;

  isConnected(): boolean {
    return this.connected;
  }

  subscribeToBlocks(callback: (blockNumber: number) => void): void {
    // Implementación base - override en conectores específicos
    console.log(`Block subscription not implemented for ${this.config.name}`);
  }

  subscribeToAddress(address: string, callback: (transaction: Transaction) => void): void {
    // Implementación base - override en conectores específicos
    console.log(`Address subscription not implemented for ${this.config.name}`);
  }

  protected async withRetry<T>(
    operation: () => Promise<T>, 
    maxRetries: number = 3,
    delayMs: number = 1000
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        console.warn(`${this.config.name} operation failed (attempt ${attempt}/${maxRetries}):`, error);
        
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, delayMs * attempt));
        }
      }
    }
    
    throw lastError!;
  }

  protected async switchToBackupRpc(): Promise<void> {
    if (this.config.backupRpcUrl) {
      console.log(`${this.config.name}: Switching to backup RPC: ${this.config.backupRpcUrl}`);
      // Override en conectores específicos para implementar cambio de RPC
    }
  }

  protected formatBalance(balance: string, decimals: number): string {
    const divisor = Math.pow(10, decimals);
    return (parseInt(balance) / divisor).toString();
  }

  protected parseBalance(balance: string, decimals: number): string {
    const multiplier = Math.pow(10, decimals);
    return (parseFloat(balance) * multiplier).toString();
  }

  protected log(message: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    const timestamp = new Date().toISOString();
    console[level](`[${timestamp}] ${this.config.name}: ${message}`);
  }
}
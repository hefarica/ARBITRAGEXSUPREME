// ArbitrageX Pro 2025 - Solana Blockchain Connector
// Conector real para Solana mainnet/devnet con @solana/web3.js

import { 
  Connection, 
  PublicKey, 
  LAMPORTS_PER_SOL,
  ParsedAccountData,
  ParsedTransactionWithMeta,
  VersionedTransactionResponse
} from '@solana/web3.js';
import { BaseBlockchainConnector } from './base';
import { BlockchainConfig, Transaction, TokenBalance } from '../types/blockchain';

export class SolanaConnector extends BaseBlockchainConnector {
  private connection: Connection;

  constructor(config: BlockchainConfig) {
    super(config);
    this.connection = new Connection(config.rpcUrl, {
      commitment: 'confirmed',
      wsEndpoint: config.wsUrl
    });
  }

  async connect(): Promise<void> {
    try {
      // Verificar conexión obteniendo información del cluster
      const version = await this.connection.getVersion();
      const slot = await this.connection.getSlot();
      
      this.log(`Connected to Solana cluster: ${version['solana-core']} (Slot: ${slot})`);
      this.connected = true;
    } catch (error) {
      this.log(`Connection failed: ${error}`, 'error');
      if (this.config.backupRpcUrl) {
        await this.switchToBackupRpc();
      }
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      // Solana web3.js no requiere desconexión explícita
      this.connected = false;
      this.log('Disconnected');
    } catch (error) {
      this.log(`Disconnect error: ${error}`, 'error');
    }
  }

  async getBlockNumber(): Promise<number> {
    return await this.withRetry(async () => {
      return await this.connection.getSlot();
    });
  }

  async getBalance(address: string): Promise<string> {
    return await this.withRetry(async () => {
      const publicKey = new PublicKey(address);
      const balance = await this.connection.getBalance(publicKey);
      return (balance / LAMPORTS_PER_SOL).toString();
    });
  }

  async getTokenBalance(tokenAddress: string, walletAddress: string): Promise<TokenBalance> {
    return await this.withRetry(async () => {
      const walletPublicKey = new PublicKey(walletAddress);
      const tokenPublicKey = new PublicKey(tokenAddress);

      // Obtener todas las cuentas de token asociadas
      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
        walletPublicKey,
        { mint: tokenPublicKey }
      );

      if (tokenAccounts.value.length === 0) {
        return {
          address: tokenAddress,
          symbol: 'UNKNOWN',
          balance: '0',
          decimals: 0
        };
      }

      const accountInfo = tokenAccounts.value[0].account.data as ParsedAccountData;
      const tokenInfo = accountInfo.parsed.info;

      return {
        address: tokenAddress,
        symbol: tokenInfo.mint, // En Solana, usar mint address como símbolo por defecto
        balance: tokenInfo.tokenAmount.uiAmountString || '0',
        decimals: tokenInfo.tokenAmount.decimals
      };
    });
  }

  async getTokenPrice(tokenAddress: string): Promise<number> {
    return await this.withRetry(async () => {
      // TODO: Integrar con Jupiter API o CoinGecko para precios reales
      return 1.0; // Precio placeholder
    });
  }

  async getTransaction(hash: string): Promise<Transaction> {
    return await this.withRetry(async () => {
      const tx = await this.connection.getParsedTransaction(hash, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0
      });

      if (!tx) {
        throw new Error(`Transaction not found: ${hash}`);
      }

      // Extraer información básica de la transacción
      const meta = tx.meta;
      const message = tx.transaction.message;
      
      return {
        hash,
        from: message.accountKeys[0].pubkey.toString(),
        to: message.accountKeys.length > 1 ? message.accountKeys[1].pubkey.toString() : '',
        value: meta?.preBalances && meta?.postBalances 
          ? ((meta.preBalances[0] - meta.postBalances[0]) / LAMPORTS_PER_SOL).toString()
          : '0',
        gasUsed: meta?.fee ? meta.fee.toString() : undefined,
        blockNumber: tx.slot,
        timestamp: tx.blockTime ? tx.blockTime * 1000 : Date.now(),
        status: meta?.err ? 'failed' : 'confirmed'
      };
    });
  }

  async sendTransaction(to: string, value: string, data?: string): Promise<string> {
    throw new Error('Send transaction requires wallet integration - not implemented in read-only connector');
  }

  async estimateGas(to: string, value: string, data?: string): Promise<string> {
    return await this.withRetry(async () => {
      // En Solana, las fees son mucho más predecibles
      const recentBlockhash = await this.connection.getLatestBlockhash();
      // Fee típica en Solana (5000 lamports = 0.000005 SOL)
      return '5000';
    });
  }

  async getPoolInfo(poolAddress: string): Promise<any> {
    return await this.withRetry(async () => {
      try {
        const publicKey = new PublicKey(poolAddress);
        const accountInfo = await this.connection.getAccountInfo(publicKey);

        if (!accountInfo) {
          throw new Error('Pool account not found');
        }

        // Para pools de Raydium/Orca, necesitaríamos parsear la data específica
        return {
          poolAddress,
          owner: accountInfo.owner.toString(),
          lamports: accountInfo.lamports,
          dataLength: accountInfo.data.length,
          // TODO: Parsear data específica del pool según el programa
          note: 'Raw account info - specific pool parsing not implemented'
        };
      } catch (error) {
        this.log(`Pool info failed for ${poolAddress}: ${error}`, 'warn');
        return {
          poolAddress,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });
  }

  async getSwapQuote(tokenIn: string, tokenOut: string, amountIn: string): Promise<any> {
    return await this.withRetry(async () => {
      // TODO: Integrar con Jupiter API para quotes reales
      return {
        tokenIn,
        tokenOut,
        amountIn,
        amountOut: (parseFloat(amountIn) * 0.995).toString(), // Mock con 0.5% slippage
        priceImpact: 0.2,
        fee: 0.005,
        route: ['jupiter'], // Jupiter es el principal aggregator en Solana
        gasEstimate: '5000' // 5000 lamports típicos
      };
    });
  }

  subscribeToBlocks(callback: (blockNumber: number) => void): void {
    this.connection.onSlotChange((slotInfo) => {
      this.log(`New slot: ${slotInfo.slot}`);
      callback(slotInfo.slot);
    });
  }

  subscribeToAddress(address: string, callback: (transaction: Transaction) => void): void {
    try {
      const publicKey = new PublicKey(address);
      
      this.connection.onAccountChange(publicKey, (accountInfo, context) => {
        this.log(`Account change detected for ${address} at slot ${context.slot}`);
        // En Solana, necesitaríamos monitorear transacciones específicas
        // Por ahora, logueamos el cambio de cuenta
      });
    } catch (error) {
      this.log(`Invalid address for subscription: ${address}`, 'error');
    }
  }

  protected async switchToBackupRpc(): Promise<void> {
    if (this.config.backupRpcUrl) {
      this.log(`Switching to backup RPC: ${this.config.backupRpcUrl}`);
      this.connection = new Connection(this.config.backupRpcUrl, {
        commitment: 'confirmed',
        wsEndpoint: this.config.wsUrl
      });
      await this.connect();
    }
  }

  // Métodos específicos de Solana
  async getProgramAccounts(programId: string): Promise<any[]> {
    return await this.withRetry(async () => {
      const publicKey = new PublicKey(programId);
      const accounts = await this.connection.getProgramAccounts(publicKey);
      return accounts.map(account => ({
        pubkey: account.pubkey.toString(),
        account: {
          owner: account.account.owner.toString(),
          lamports: account.account.lamports,
          dataLength: account.account.data.length
        }
      }));
    });
  }

  async getTokenSupply(tokenMint: string): Promise<any> {
    return await this.withRetry(async () => {
      const publicKey = new PublicKey(tokenMint);
      const supply = await this.connection.getTokenSupply(publicKey);
      return {
        mint: tokenMint,
        amount: supply.value.amount,
        decimals: supply.value.decimals,
        uiAmount: supply.value.uiAmount,
        uiAmountString: supply.value.uiAmountString
      };
    });
  }
}
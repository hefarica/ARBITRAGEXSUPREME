// ArbitrageX Pro 2025 - Ethereum Blockchain Connector
// Conector real para Ethereum mainnet/testnet con ethers.js

import { ethers, JsonRpcProvider, WebSocketProvider } from 'ethers';
import { BaseBlockchainConnector } from './base';
import { BlockchainConfig, Transaction, TokenBalance } from '../types/blockchain';

export class EthereumConnector extends BaseBlockchainConnector {
  protected provider: JsonRpcProvider;
  private wsProvider?: WebSocketProvider;

  constructor(config: BlockchainConfig) {
    super(config);
    this.provider = new JsonRpcProvider(config.rpcUrl);
    if (config.wsUrl) {
      this.wsProvider = new WebSocketProvider(config.wsUrl);
    }
  }

  async connect(): Promise<void> {
    try {
      // Verificar conexión HTTP
      const network = await this.provider.getNetwork();
      this.log(`Connected to Ethereum network: ${network.name} (Chain ID: ${network.chainId})`);
      
      // Verificar conexión WebSocket si está disponible
      if (this.wsProvider) {
        await this.wsProvider.getNetwork();
        this.log('WebSocket connection established');
      }
      
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
      if (this.wsProvider) {
        this.wsProvider.destroy();
      }
      this.connected = false;
      this.log('Disconnected');
    } catch (error) {
      this.log(`Disconnect error: ${error}`, 'error');
    }
  }

  async getBlockNumber(): Promise<number> {
    return await this.withRetry(async () => {
      return await this.provider.getBlockNumber();
    });
  }

  async getBalance(address: string): Promise<string> {
    return await this.withRetry(async () => {
      const balance = await this.provider.getBalance(address);
      return ethers.formatEther(balance);
    });
  }

  async getTokenBalance(tokenAddress: string, walletAddress: string): Promise<TokenBalance> {
    return await this.withRetry(async () => {
      // ERC-20 ABI básico para balanceOf y decimals
      const erc20Abi = [
        'function balanceOf(address) view returns (uint256)',
        'function decimals() view returns (uint8)',
        'function symbol() view returns (string)'
      ];

      const contract = new ethers.Contract(tokenAddress, erc20Abi, this.provider);
      
      const [balance, decimals, symbol] = await Promise.all([
        contract.balanceOf(walletAddress),
        contract.decimals(),
        contract.symbol()
      ]);

      return {
        address: tokenAddress,
        symbol,
        balance: ethers.formatUnits(balance, decimals),
        decimals
      };
    });
  }

  async getTokenPrice(tokenAddress: string): Promise<number> {
    // Implementar integración con price feed (CoinGecko, ChainLink, etc.)
    // Por ahora retorna precio mock
    return await this.withRetry(async () => {
      // TODO: Integrar con API real de precios
      return 1.0; // Precio placeholder
    });
  }

  async getTransaction(hash: string): Promise<Transaction> {
    return await this.withRetry(async () => {
      const tx = await this.provider.getTransaction(hash);
      const receipt = await this.provider.getTransactionReceipt(hash);
      
      if (!tx) {
        throw new Error(`Transaction not found: ${hash}`);
      }

      return {
        hash: tx.hash,
        from: tx.from,
        to: tx.to || '',
        value: ethers.formatEther(tx.value),
        gasPrice: tx.gasPrice ? ethers.formatUnits(tx.gasPrice, 'gwei') : undefined,
        gasUsed: receipt ? receipt.gasUsed.toString() : undefined,
        blockNumber: tx.blockNumber || 0,
        timestamp: Date.now(), // TODO: Get block timestamp
        status: receipt ? (receipt.status === 1 ? 'confirmed' : 'failed') : 'pending'
      };
    });
  }

  async sendTransaction(to: string, value: string, data?: string): Promise<string> {
    throw new Error('Send transaction requires wallet integration - not implemented in read-only connector');
  }

  async estimateGas(to: string, value: string, data?: string): Promise<string> {
    return await this.withRetry(async () => {
      const gasEstimate = await this.provider.estimateGas({
        to,
        value: ethers.parseEther(value),
        data
      });
      return gasEstimate.toString();
    });
  }

  async getPoolInfo(poolAddress: string): Promise<any> {
    return await this.withRetry(async () => {
      // Uniswap V2/V3 pool ABI básico
      const poolAbi = [
        'function getReserves() view returns (uint112, uint112, uint32)',
        'function token0() view returns (address)',
        'function token1() view returns (address)',
        'function fee() view returns (uint24)'
      ];

      const contract = new ethers.Contract(poolAddress, poolAbi, this.provider);
      
      try {
        const [reserves, token0, token1] = await Promise.all([
          contract.getReserves(),
          contract.token0(),
          contract.token1()
        ]);

        return {
          poolAddress,
          token0,
          token1,
          reserve0: reserves[0].toString(),
          reserve1: reserves[1].toString(),
          lastUpdate: reserves[2]
        };
      } catch (error) {
        // Podría ser un pool V3 u otro formato
        this.log(`Pool info failed for ${poolAddress}: ${error}`, 'warn');
        return {
          poolAddress,
          error: 'Pool format not supported or invalid address'
        };
      }
    });
  }

  async getSwapQuote(tokenIn: string, tokenOut: string, amountIn: string): Promise<any> {
    return await this.withRetry(async () => {
      // TODO: Integrar con Uniswap Router para quotes reales
      return {
        tokenIn,
        tokenOut,
        amountIn,
        amountOut: (parseFloat(amountIn) * 0.997).toString(), // Mock con 0.3% fee
        priceImpact: 0.1,
        fee: 0.003,
        route: ['direct'],
        gasEstimate: '150000'
      };
    });
  }

  subscribeToBlocks(callback: (blockNumber: number) => void): void {
    if (this.wsProvider) {
      this.wsProvider.on('block', (blockNumber: number) => {
        this.log(`New block: ${blockNumber}`);
        callback(blockNumber);
      });
    } else {
      this.log('WebSocket not available for block subscription', 'warn');
    }
  }

  subscribeToAddress(address: string, callback: (transaction: Transaction) => void): void {
    if (this.wsProvider) {
      // Filtro para transacciones hacia la dirección
      const filter = {
        address: address
      };
      
      this.wsProvider.on(filter, (log) => {
        this.log(`Transaction detected for ${address}: ${log.transactionHash}`);
        this.getTransaction(log.transactionHash).then(callback).catch(error => {
          this.log(`Error processing transaction ${log.transactionHash}: ${error}`, 'error');
        });
      });
    } else {
      this.log('WebSocket not available for address subscription', 'warn');
    }
  }

  protected async switchToBackupRpc(): Promise<void> {
    if (this.config.backupRpcUrl) {
      this.log(`Switching to backup RPC: ${this.config.backupRpcUrl}`);
      this.provider = new JsonRpcProvider(this.config.backupRpcUrl);
      await this.connect();
    }
  }
}
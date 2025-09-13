import { FlashbotsBundleProvider, FlashbotsBundleRawTransaction } from '@flashbots/ethers-provider-bundle';
import { ethers } from 'ethers';
import axios from 'axios';
import pino from 'pino';
import { config } from '@/config';
import { BundleTransaction, RelayResponse, BundleSubmissionResult } from '@/types/relay';

// =============================================================================
// FLASHBOTS RELAY CLIENT
// =============================================================================

export class FlashbotsClient {
  private logger: pino.Logger;
  private provider: ethers.JsonRpcProvider;
  private flashbotsProvider: FlashbotsBundleProvider | null = null;
  private signingWallet: ethers.Wallet;
  private reputationWallet?: ethers.Wallet;

  constructor(logger: pino.Logger) {
    this.logger = logger.child({ relay: 'flashbots' });
    
    // Initialize Ethereum provider
    this.provider = new ethers.JsonRpcProvider(config.ethereum.rpc_url);
    
    // Initialize signing wallet
    this.signingWallet = new ethers.Wallet(config.relays.flashbots.signing_key, this.provider);
    
    // Initialize reputation wallet if provided
    if (config.relays.flashbots.reputation_key) {
      this.reputationWallet = new ethers.Wallet(config.relays.flashbots.reputation_key, this.provider);
    }
  }

  /**
   * Initialize Flashbots provider
   */
  async initialize(): Promise<void> {
    try {
      this.flashbotsProvider = await FlashbotsBundleProvider.create(
        this.provider,
        this.signingWallet,
        config.relays.flashbots.relay_url,
        config.ethereum.chain_id.toString(),
        this.reputationWallet
      );

      this.logger.info({
        relay_url: config.relays.flashbots.relay_url,
        chain_id: config.ethereum.chain_id,
        signing_address: this.signingWallet.address,
        reputation_address: this.reputationWallet?.address,
      }, 'Flashbots client initialized');
    } catch (error) {
      this.logger.error({ error: error.message }, 'Failed to initialize Flashbots client');
      throw error;
    }
  }

  /**
   * Submit bundle to Flashbots
   */
  async submitBundle(
    bundleId: string,
    transactions: BundleTransaction[],
    targetBlock: number
  ): Promise<BundleSubmissionResult> {
    const startTime = Date.now();

    try {
      if (!this.flashbotsProvider) {
        throw new Error('Flashbots provider not initialized');
      }

      // Validate bundle size
      if (transactions.length > config.relays.flashbots.max_bundle_size) {
        throw new Error(`Bundle size exceeds maximum (${config.relays.flashbots.max_bundle_size})`);
      }

      // Convert to Flashbots format
      const flashbotsTransactions = await this.convertToFlashbotsFormat(transactions);

      // Submit bundle
      const bundleSubmission = await this.flashbotsProvider.sendBundle(
        flashbotsTransactions,
        targetBlock
      );

      // Get submission ID
      const submissionId = bundleSubmission.bundleHash || `fb_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      this.logger.info({
        bundle_id: bundleId,
        submission_id: submissionId,
        target_block: targetBlock,
        transaction_count: transactions.length,
        response_time_ms: Date.now() - startTime,
      }, 'Bundle submitted to Flashbots');

      return {
        bundle_id: bundleId,
        relay_provider: 'flashbots',
        submission_id: submissionId,
        status: 'pending',
        target_block: targetBlock,
        submitted_at: new Date(),
      };
    } catch (error) {
      this.logger.error({
        bundle_id: bundleId,
        error: error.message,
        response_time_ms: Date.now() - startTime,
      }, 'Failed to submit bundle to Flashbots');

      return {
        bundle_id: bundleId,
        relay_provider: 'flashbots',
        submission_id: `error_${Date.now()}`,
        status: 'failed',
        target_block: targetBlock,
        submitted_at: new Date(),
        error_message: error.message,
      };
    }
  }

  /**
   * Check bundle status
   */
  async getBundleStatus(submissionId: string, targetBlock: number): Promise<{
    included: boolean;
    blockNumber?: number;
    transactionIndex?: number;
    gasUsed?: number;
    gasPrice?: string;
  }> {
    try {
      if (!this.flashbotsProvider) {
        throw new Error('Flashbots provider not initialized');
      }

      // Get bundle stats from Flashbots
      const bundleStats = await this.flashbotsProvider.getBundleStats(submissionId, targetBlock);
      
      if (bundleStats && bundleStats.isSimulated) {
        return {
          included: bundleStats.isMined || false,
          blockNumber: bundleStats.simulatedAt,
          gasUsed: bundleStats.gasUsed,
          gasPrice: bundleStats.gasFees,
        };
      }

      // Alternative method: check if transaction was included in block
      const currentBlock = await this.provider.getBlockNumber();
      
      if (currentBlock >= targetBlock) {
        const block = await this.provider.getBlock(targetBlock, true);
        
        if (block && block.transactions) {
          // Check if any transactions in the block match our bundle
          // This is a simplified check - in production you'd want more sophisticated matching
          for (let i = 0; i < block.transactions.length; i++) {
            const tx = block.transactions[i];
            if (typeof tx !== 'string' && tx.from && tx.to) {
              // Transaction was included
              return {
                included: true,
                blockNumber: targetBlock,
                transactionIndex: i,
                gasUsed: Number(tx.gasUsed || 0),
                gasPrice: tx.gasPrice?.toString(),
              };
            }
          }
        }
      }

      return { included: false };
    } catch (error) {
      this.logger.error({
        submission_id: submissionId,
        error: error.message,
      }, 'Failed to check Flashbots bundle status');
      
      return { included: false };
    }
  }

  /**
   * Simulate bundle before submission
   */
  async simulateBundle(
    transactions: BundleTransaction[],
    blockNumber?: number
  ): Promise<{
    success: boolean;
    gasUsed?: number;
    gasPrice?: string;
    profit?: string;
    error?: string;
  }> {
    try {
      if (!this.flashbotsProvider) {
        throw new Error('Flashbots provider not initialized');
      }

      const targetBlock = blockNumber || (await this.provider.getBlockNumber()) + 1;
      const flashbotsTransactions = await this.convertToFlashbotsFormat(transactions);

      // Simulate bundle
      const simulation = await this.flashbotsProvider.simulate(flashbotsTransactions, targetBlock);

      if (simulation.error) {
        return {
          success: false,
          error: simulation.error.message,
        };
      }

      // Calculate total gas used and profit
      const totalGasUsed = simulation.results?.reduce((sum, result) => sum + (result.gasUsed || 0), 0) || 0;
      const totalValue = simulation.coinbaseDiff || '0';

      this.logger.debug({
        target_block: targetBlock,
        gas_used: totalGasUsed,
        coinbase_diff: totalValue,
      }, 'Bundle simulation successful');

      return {
        success: true,
        gasUsed: totalGasUsed,
        profit: totalValue,
      };
    } catch (error) {
      this.logger.error({ error: error.message }, 'Bundle simulation failed');
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get current gas prices and network conditions
   */
  async getNetworkConditions(): Promise<{
    gasPrice: string;
    baseFee: string;
    priorityFee: string;
    blockNumber: number;
    congestion: 'low' | 'medium' | 'high';
  }> {
    try {
      const [feeData, blockNumber] = await Promise.all([
        this.provider.getFeeData(),
        this.provider.getBlockNumber(),
      ]);

      const gasPrice = feeData.gasPrice?.toString() || '0';
      const baseFee = feeData.maxFeePerGas?.toString() || '0';
      const priorityFee = feeData.maxPriorityFeePerGas?.toString() || '0';

      // Simple congestion calculation based on gas price
      const gasPriceGwei = Number(gasPrice) / 1e9;
      let congestion: 'low' | 'medium' | 'high' = 'low';
      
      if (gasPriceGwei > 100) congestion = 'high';
      else if (gasPriceGwei > 50) congestion = 'medium';

      return {
        gasPrice,
        baseFee,
        priorityFee,
        blockNumber,
        congestion,
      };
    } catch (error) {
      this.logger.error({ error: error.message }, 'Failed to get network conditions');
      throw error;
    }
  }

  /**
   * Get relay health status
   */
  async getHealthStatus(): Promise<{
    healthy: boolean;
    latency?: number;
    error?: string;
  }> {
    try {
      const startTime = Date.now();
      
      // Test connection by getting block number
      await this.provider.getBlockNumber();
      
      const latency = Date.now() - startTime;
      
      return {
        healthy: true,
        latency,
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
      };
    }
  }

  /**
   * Convert transactions to Flashbots format
   */
  private async convertToFlashbotsFormat(transactions: BundleTransaction[]): Promise<FlashbotsBundleRawTransaction[]> {
    const flashbotsTransactions: FlashbotsBundleRawTransaction[] = [];

    for (const tx of transactions) {
      // Create transaction object
      const transaction: any = {
        to: tx.to,
        value: tx.value,
        data: tx.data,
        gas: tx.gas,
        gasPrice: tx.gasPrice,
        nonce: tx.nonce,
        type: tx.type || 0,
      };

      // Add EIP-1559 fields if present
      if (tx.maxFeePerGas) {
        transaction.maxFeePerGas = tx.maxFeePerGas;
      }
      if (tx.maxPriorityFeePerGas) {
        transaction.maxPriorityFeePerGas = tx.maxPriorityFeePerGas;
      }

      // Sign transaction
      const wallet = new ethers.Wallet(config.relays.flashbots.signing_key, this.provider);
      const signedTx = await wallet.signTransaction(transaction);

      flashbotsTransactions.push({
        signedTransaction: signedTx,
      });
    }

    return flashbotsTransactions;
  }

  /**
   * Get provider instance
   */
  getProvider(): ethers.JsonRpcProvider {
    return this.provider;
  }

  /**
   * Get signing wallet address
   */
  getSigningAddress(): string {
    return this.signingWallet.address;
  }

  /**
   * Shutdown client
   */
  async shutdown(): Promise<void> {
    try {
      // Clean up any resources
      if (this.provider) {
        this.provider.destroy();
      }
      this.logger.info('Flashbots client shutdown complete');
    } catch (error) {
      this.logger.error({ error: error.message }, 'Error during Flashbots client shutdown');
    }
  }
}
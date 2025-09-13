import axios, { AxiosInstance } from 'axios';
import { ethers } from 'ethers';
import pino from 'pino';
import { config } from '@/config';
import { BundleTransaction, BundleSubmissionResult } from '@/types/relay';

// =============================================================================
// EDEN NETWORK RELAY CLIENT
// =============================================================================

export class EdenClient {
  private logger: pino.Logger;
  private httpClient: AxiosInstance;
  private slotClient: AxiosInstance;
  private provider: ethers.JsonRpcProvider;

  constructor(logger: pino.Logger) {
    this.logger = logger.child({ relay: 'eden' });
    
    // Initialize Ethereum provider
    this.provider = new ethers.JsonRpcProvider(config.ethereum.rpc_url);
    
    // Initialize HTTP clients
    this.httpClient = axios.create({
      baseURL: config.relays.eden.rpc_url,
      timeout: config.relays.eden.timeout_ms,
      headers: {
        'Authorization': `Bearer ${config.relays.eden.api_key}`,
        'Content-Type': 'application/json',
      },
    });

    this.slotClient = axios.create({
      baseURL: config.relays.eden.slot_url,
      timeout: config.relays.eden.timeout_ms,
      headers: {
        'Authorization': `Bearer ${config.relays.eden.api_key}`,
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  /**
   * Setup HTTP interceptors
   */
  private setupInterceptors(): void {
    const setupClientInterceptors = (client: AxiosInstance, clientName: string) => {
      client.interceptors.request.use(
        (requestConfig) => {
          this.logger.debug({
            client: clientName,
            method: requestConfig.method?.toUpperCase(),
            url: requestConfig.url,
          }, 'Eden API request');
          return requestConfig;
        },
        (error) => {
          this.logger.error({
            client: clientName,
            error: error.message,
          }, 'Eden request error');
          return Promise.reject(error);
        }
      );

      client.interceptors.response.use(
        (response) => {
          this.logger.debug({
            client: clientName,
            status: response.status,
            url: response.config.url,
          }, 'Eden API response');
          return response;
        },
        (error) => {
          this.logger.error({
            client: clientName,
            status: error.response?.status,
            message: error.response?.data?.message || error.message,
            url: error.config?.url,
          }, 'Eden API error');
          return Promise.reject(error);
        }
      );
    };

    setupClientInterceptors(this.httpClient, 'rpc');
    setupClientInterceptors(this.slotClient, 'slot');
  }

  /**
   * Initialize Eden client
   */
  async initialize(): Promise<void> {
    try {
      // Test authentication and get network info
      await this.getNetworkInfo();
      
      this.logger.info({
        rpc_url: config.relays.eden.rpc_url,
        slot_url: config.relays.eden.slot_url,
        chain_id: config.ethereum.chain_id,
      }, 'Eden Network client initialized');
    } catch (error) {
      this.logger.error({ error: error.message }, 'Failed to initialize Eden client');
      throw error;
    }
  }

  /**
   * Submit bundle to Eden Network
   */
  async submitBundle(
    bundleId: string,
    transactions: BundleTransaction[],
    targetBlock: number
  ): Promise<BundleSubmissionResult> {
    const startTime = Date.now();

    try {
      // Validate bundle size
      if (transactions.length > config.relays.eden.max_bundle_size) {
        throw new Error(`Bundle size exceeds maximum (${config.relays.eden.max_bundle_size})`);
      }

      // Get available slot for the target block
      const slot = await this.getAvailableSlot(targetBlock);
      if (!slot) {
        throw new Error('No available slots for target block');
      }

      // Sign transactions
      const signedTransactions = await this.signTransactions(transactions);

      // Prepare bundle payload for Eden Network
      const bundlePayload = {
        jsonrpc: '2.0',
        method: 'eth_sendBundle',
        params: [
          {
            txs: signedTransactions,
            blockNumber: `0x${targetBlock.toString(16)}`,
            minTimestamp: Math.floor(Date.now() / 1000),
            maxTimestamp: Math.floor(Date.now() / 1000) + 120, // 2 minutes
            revertingTxHashes: [], // Transactions that can revert without failing the bundle
          }
        ],
        id: bundleId,
      };

      // Submit bundle
      const response = await this.httpClient.post('/', bundlePayload);
      
      if (response.data.error) {
        throw new Error(response.data.error.message || 'Eden submission failed');
      }

      const submissionId = response.data.result || `eden_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      this.logger.info({
        bundle_id: bundleId,
        submission_id: submissionId,
        target_block: targetBlock,
        slot_id: slot.id,
        transaction_count: transactions.length,
        response_time_ms: Date.now() - startTime,
      }, 'Bundle submitted to Eden Network');

      return {
        bundle_id: bundleId,
        relay_provider: 'eden',
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
      }, 'Failed to submit bundle to Eden Network');

      return {
        bundle_id: bundleId,
        relay_provider: 'eden',
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
      // Query bundle status from Eden Network
      const statusPayload = {
        jsonrpc: '2.0',
        method: 'eth_getBundleByHash',
        params: [submissionId],
        id: 1,
      };

      const response = await this.httpClient.post('/', statusPayload);
      
      if (response.data.result) {
        const bundle = response.data.result;
        
        if (bundle.inclusion && bundle.inclusion.block) {
          return {
            included: true,
            blockNumber: parseInt(bundle.inclusion.block, 16),
            transactionIndex: bundle.inclusion.index,
            gasUsed: bundle.gasUsed ? parseInt(bundle.gasUsed, 16) : undefined,
            gasPrice: bundle.gasPrice,
          };
        }
      }

      // Fallback: check blockchain directly
      const currentBlock = await this.provider.getBlockNumber();
      
      if (currentBlock >= targetBlock + 3) { // Allow 3 blocks grace period
        const block = await this.provider.getBlock(targetBlock, true);
        
        if (block && block.transactions) {
          // Simple inclusion check - in production would need more sophisticated matching
          for (let i = 0; i < block.transactions.length; i++) {
            const tx = block.transactions[i];
            if (typeof tx !== 'string' && tx.hash) {
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
      }, 'Failed to check Eden bundle status');
      
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
      const targetBlock = blockNumber || (await this.provider.getBlockNumber()) + 1;
      
      // Sign transactions for simulation
      const signedTransactions = await this.signTransactions(transactions);

      // Prepare simulation payload
      const simulationPayload = {
        jsonrpc: '2.0',
        method: 'eth_callBundle',
        params: [
          {
            txs: signedTransactions,
            blockNumber: `0x${targetBlock.toString(16)}`,
            stateBlockNumber: `0x${(targetBlock - 1).toString(16)}`,
          }
        ],
        id: 1,
      };

      // Submit simulation request
      const response = await this.httpClient.post('/', simulationPayload);

      if (response.data.error) {
        return {
          success: false,
          error: response.data.error.message || 'Simulation failed',
        };
      }

      const result = response.data.result;
      
      if (result && result.results) {
        const totalGasUsed = result.results.reduce((sum: number, res: any) => {
          return sum + (res.gasUsed ? parseInt(res.gasUsed, 16) : 0);
        }, 0);

        return {
          success: true,
          gasUsed: totalGasUsed,
          profit: result.coinbaseDiff || '0',
        };
      }

      return {
        success: false,
        error: 'Invalid simulation result',
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
   * Get available slot for target block
   */
  async getAvailableSlot(targetBlock: number): Promise<{
    id: string;
    block: number;
    priority: number;
    cost: string;
  } | null> {
    try {
      const response = await this.slotClient.get(`/slots/${targetBlock}`);
      
      if (response.data && response.data.slots && response.data.slots.length > 0) {
        // Find the best available slot
        const availableSlots = response.data.slots.filter((slot: any) => slot.available);
        
        if (availableSlots.length === 0) {
          return null;
        }

        // Sort by priority (higher is better) and cost (lower is better)
        availableSlots.sort((a: any, b: any) => {
          if (a.priority !== b.priority) {
            return b.priority - a.priority;
          }
          return parseInt(a.cost) - parseInt(b.cost);
        });

        return availableSlots[0];
      }

      return null;
    } catch (error) {
      this.logger.error({
        target_block: targetBlock,
        error: error.message,
      }, 'Failed to get available slot');
      return null;
    }
  }

  /**
   * Get current network conditions and staking info
   */
  async getNetworkConditions(): Promise<{
    gasPrice: string;
    baseFee: string;
    priorityFee: string;
    blockNumber: number;
    congestion: 'low' | 'medium' | 'high';
    stakingInfo?: {
      totalStaked: string;
      userStaked: string;
      apr: number;
    };
  }> {
    try {
      const [feeData, blockNumber] = await Promise.all([
        this.provider.getFeeData(),
        this.provider.getBlockNumber(),
      ]);

      const gasPrice = feeData.gasPrice?.toString() || '0';
      const baseFee = feeData.maxFeePerGas?.toString() || '0';
      const priorityFee = feeData.maxPriorityFeePerGas?.toString() || '0';

      // Get Eden Network specific data
      let stakingInfo;
      try {
        const stakingResponse = await this.slotClient.get('/staking/info');
        stakingInfo = {
          totalStaked: stakingResponse.data.totalStaked || '0',
          userStaked: stakingResponse.data.userStaked || '0',
          apr: stakingResponse.data.apr || 0,
        };
      } catch (error) {
        // Staking info not available
      }

      // Determine congestion level
      const gasPriceGwei = Number(gasPrice) / 1e9;
      let congestion: 'low' | 'medium' | 'high' = 'low';
      
      if (gasPriceGwei > 200) congestion = 'high';
      else if (gasPriceGwei > 100) congestion = 'medium';

      return {
        gasPrice,
        baseFee,
        priorityFee,
        blockNumber,
        congestion,
        stakingInfo,
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
      
      // Test RPC connectivity
      const rpcPayload = {
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
        id: 1,
      };
      
      await this.httpClient.post('/', rpcPayload);
      
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
   * Get network information
   */
  async getNetworkInfo(): Promise<{
    chainId: number;
    blockNumber: number;
    networkVersion: string;
    protocolVersion: string;
  }> {
    try {
      const requests = [
        { jsonrpc: '2.0', method: 'eth_chainId', params: [], id: 1 },
        { jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 2 },
        { jsonrpc: '2.0', method: 'net_version', params: [], id: 3 },
        { jsonrpc: '2.0', method: 'eth_protocolVersion', params: [], id: 4 },
      ];

      const responses = await Promise.all(
        requests.map(request => this.httpClient.post('/', request))
      );

      return {
        chainId: parseInt(responses[0].data.result, 16),
        blockNumber: parseInt(responses[1].data.result, 16),
        networkVersion: responses[2].data.result,
        protocolVersion: responses[3].data.result,
      };
    } catch (error) {
      this.logger.error({ error: error.message }, 'Failed to get network info');
      throw error;
    }
  }

  /**
   * Get EDEN token staking status
   */
  async getStakingStatus(): Promise<{
    isStaked: boolean;
    stakedAmount: string;
    requiredAmount: string;
    stakingRewards: string;
    nextRewardTime?: Date;
  }> {
    try {
      const response = await this.slotClient.get('/staking/status');
      
      const data = response.data;
      const stakedAmount = data.stakedAmount || '0';
      const requiredAmount = config.relays.eden.min_stake_amount;
      
      return {
        isStaked: BigInt(stakedAmount) >= BigInt(requiredAmount),
        stakedAmount,
        requiredAmount,
        stakingRewards: data.pendingRewards || '0',
        nextRewardTime: data.nextRewardTime ? new Date(data.nextRewardTime) : undefined,
      };
    } catch (error) {
      this.logger.error({ error: error.message }, 'Failed to get staking status');
      
      // Return default status
      return {
        isStaked: false,
        stakedAmount: '0',
        requiredAmount: config.relays.eden.min_stake_amount,
        stakingRewards: '0',
      };
    }
  }

  /**
   * Sign transactions
   */
  private async signTransactions(transactions: BundleTransaction[]): Promise<string[]> {
    const signedTxs: string[] = [];
    
    for (const tx of transactions) {
      try {
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

        // Sign transaction (using a dummy wallet for this example)
        // In production, use the actual wallet that owns the 'from' address
        const wallet = new ethers.Wallet(config.relays.flashbots.signing_key, this.provider);
        const signedTx = await wallet.signTransaction(transaction);
        
        signedTxs.push(signedTx);
      } catch (error) {
        this.logger.error({
          tx_to: tx.to,
          error: error.message,
        }, 'Failed to sign transaction');
        throw error;
      }
    }

    return signedTxs;
  }

  /**
   * Shutdown client
   */
  async shutdown(): Promise<void> {
    try {
      // Clean up resources
      if (this.provider) {
        this.provider.destroy();
      }
      this.logger.info('Eden Network client shutdown complete');
    } catch (error) {
      this.logger.error({ error: error.message }, 'Error during Eden Network client shutdown');
    }
  }
}
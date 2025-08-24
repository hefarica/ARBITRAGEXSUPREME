// ArbitrageX Pro 2025 - Blockchain Service Integration
// Servicio que integra los conectores blockchain con la API

import { BlockchainManager, getNetworkConfigs, ArbitrageOpportunity } from '@arbitragex/blockchain-connectors';

export class BlockchainIntegrationService {
  private blockchainManager: BlockchainManager;
  private initialized: boolean = false;

  constructor() {
    const networkConfigs = getNetworkConfigs();
    this.blockchainManager = new BlockchainManager({
      networks: networkConfigs,
      enableWebSocket: true,
      retryAttempts: 3,
      healthCheckInterval: 30000
    });
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      console.log('🔗 Initializing Blockchain Integration Service...');
      await this.blockchainManager.initialize();
      this.initialized = true;
      console.log('✅ Blockchain Integration Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Blockchain Integration Service:', error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    try {
      console.log('🛑 Shutting down Blockchain Integration Service...');
      await this.blockchainManager.shutdown();
      this.initialized = false;
      console.log('✅ Blockchain Integration Service shutdown complete');
    } catch (error) {
      console.error('❌ Error during Blockchain Integration Service shutdown:', error);
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async getNetworkStatus(): Promise<any> {
    if (!this.initialized) {
      await this.initialize();
    }
    return await this.blockchainManager.getNetworkStatus();
  }

  async getSupportedBlockchains(): Promise<any[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    const status = await this.blockchainManager.getNetworkStatus();
    const connectors = this.blockchainManager.getConnectors();

    return connectors.map(connector => {
      const networkStatus = status[connector.config.id] || {};
      return {
        id: connector.config.id,
        name: connector.config.name,
        symbol: connector.config.symbol,
        connected: connector.isConnected(),
        blockNumber: networkStatus.blockNumber || 0,
        blockTime: connector.config.blockTime,
        explorerUrl: connector.config.explorerUrl,
        nativeCurrency: connector.config.nativeCurrency,
        hasWebSocket: !!connector.config.wsUrl,
        lastCheck: networkStatus.lastCheck || new Date().toISOString()
      };
    });
  }

  async getArbitrageOpportunities(): Promise<ArbitrageOpportunity[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const opportunities = await this.blockchainManager.scanForArbitrageOpportunities();
      console.log(`🎯 Found ${opportunities.length} arbitrage opportunities`);
      return opportunities;
    } catch (error) {
      console.error('❌ Error scanning for arbitrage opportunities:', error);
      return [];
    }
  }

  async getBlockchainBalance(blockchainId: string, address: string): Promise<string | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    const connector = this.blockchainManager.getConnector(blockchainId);
    if (!connector) {
      throw new Error(`Blockchain ${blockchainId} not supported or not connected`);
    }

    try {
      return await connector.getBalance(address);
    } catch (error) {
      console.error(`❌ Error getting balance for ${blockchainId}:${address}:`, error);
      throw error;
    }
  }

  async getTokenBalance(blockchainId: string, tokenAddress: string, walletAddress: string): Promise<any> {
    if (!this.initialized) {
      await this.initialize();
    }

    const connector = this.blockchainManager.getConnector(blockchainId);
    if (!connector) {
      throw new Error(`Blockchain ${blockchainId} not supported or not connected`);
    }

    try {
      return await connector.getTokenBalance(tokenAddress, walletAddress);
    } catch (error) {
      console.error(`❌ Error getting token balance for ${blockchainId}:${tokenAddress}:`, error);
      throw error;
    }
  }

  async getTransaction(blockchainId: string, txHash: string): Promise<any> {
    if (!this.initialized) {
      await this.initialize();
    }

    const connector = this.blockchainManager.getConnector(blockchainId);
    if (!connector) {
      throw new Error(`Blockchain ${blockchainId} not supported or not connected`);
    }

    try {
      return await connector.getTransaction(txHash);
    } catch (error) {
      console.error(`❌ Error getting transaction ${txHash} on ${blockchainId}:`, error);
      throw error;
    }
  }

  async getSwapQuote(
    blockchainId: string, 
    tokenIn: string, 
    tokenOut: string, 
    amountIn: string
  ): Promise<any> {
    if (!this.initialized) {
      await this.initialize();
    }

    const connector = this.blockchainManager.getConnector(blockchainId);
    if (!connector) {
      throw new Error(`Blockchain ${blockchainId} not supported or not connected`);
    }

    try {
      return await connector.getSwapQuote(tokenIn, tokenOut, amountIn);
    } catch (error) {
      console.error(`❌ Error getting swap quote on ${blockchainId}:`, error);
      throw error;
    }
  }

  async estimateGas(
    blockchainId: string,
    to: string,
    value: string,
    data?: string
  ): Promise<string> {
    if (!this.initialized) {
      await this.initialize();
    }

    const connector = this.blockchainManager.getConnector(blockchainId);
    if (!connector) {
      throw new Error(`Blockchain ${blockchainId} not supported or not connected`);
    }

    try {
      return await connector.estimateGas(to, value, data);
    } catch (error) {
      console.error(`❌ Error estimating gas on ${blockchainId}:`, error);
      throw error;
    }
  }

  getActiveNetworks(): string[] {
    if (!this.initialized) {
      return [];
    }
    return this.blockchainManager.getActiveNetworks();
  }

  async healthCheck(): Promise<{
    status: string;
    networks: number;
    activeConnections: number;
    opportunities: number;
    lastScan: string;
    networks_detail: any;
  }> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const networkStatus = await this.getNetworkStatus();
      const activeConnections = Object.values(networkStatus).filter(
        (status: any) => status.connected
      ).length;
      
      const opportunities = await this.getArbitrageOpportunities();

      return {
        status: 'operational',
        networks: Object.keys(networkStatus).length,
        activeConnections,
        opportunities: opportunities.length,
        lastScan: new Date().toISOString(),
        networks_detail: networkStatus
      };
    } catch (error) {
      console.error('❌ Blockchain service health check failed:', error);
      return {
        status: 'error',
        networks: 0,
        activeConnections: 0,
        opportunities: 0,
        lastScan: new Date().toISOString(),
        networks_detail: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }
}

// Singleton instance
export const blockchainService = new BlockchainIntegrationService();
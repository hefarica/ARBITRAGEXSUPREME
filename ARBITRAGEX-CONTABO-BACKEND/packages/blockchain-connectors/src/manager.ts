// ArbitrageX Pro 2025 - Blockchain Manager
// Manager principal para todos los conectores blockchain

import { BlockchainConfig, BlockchainConnector, ArbitrageOpportunity, TokenBalance, Transaction } from './types/blockchain';
import { EthereumConnector } from './connectors/ethereum';
import { SolanaConnector } from './connectors/solana';
import { BaseBlockchainConnector } from './connectors/base';

export interface BlockchainManagerConfig {
  networks: BlockchainConfig[];
  enableWebSocket?: boolean;
  retryAttempts?: number;
  healthCheckInterval?: number;
}

export class BlockchainManager {
  private connectors: Map<string, BlockchainConnector> = new Map();
  private config: BlockchainManagerConfig;
  private healthCheckTimer?: NodeJS.Timeout;

  constructor(config: BlockchainManagerConfig) {
    this.config = {
      enableWebSocket: true,
      retryAttempts: 3,
      healthCheckInterval: 30000, // 30 segundos
      ...config
    };
  }

  async initialize(): Promise<void> {
    console.log('🚀 Initializing Blockchain Manager...');
    
    for (const networkConfig of this.config.networks) {
      try {
        const connector = this.createConnector(networkConfig);
        await connector.connect();
        this.connectors.set(networkConfig.id, connector);
        console.log(`✅ ${networkConfig.name} connector initialized`);
      } catch (error) {
        console.error(`❌ Failed to initialize ${networkConfig.name}:`, error);
        // Continúa con otros conectores aunque uno falle
      }
    }

    // Iniciar health checks periódicos
    if (this.config.healthCheckInterval && this.config.healthCheckInterval > 0) {
      this.startHealthChecks();
    }

    console.log(`🎯 Blockchain Manager initialized with ${this.connectors.size} active connectors`);
  }

  async shutdown(): Promise<void> {
    console.log('🛑 Shutting down Blockchain Manager...');
    
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    const disconnectPromises = Array.from(this.connectors.values()).map(async (connector) => {
      try {
        await connector.disconnect();
      } catch (error) {
        console.error(`Error disconnecting ${connector.config.name}:`, error);
      }
    });

    await Promise.all(disconnectPromises);
    this.connectors.clear();
    console.log('✅ Blockchain Manager shutdown complete');
  }

  private createConnector(config: BlockchainConfig): BlockchainConnector {
    switch (config.id) {
      case 'ethereum':
      case 'bsc':
      case 'polygon':
      case 'arbitrum':
      case 'optimism':
      case 'avalanche':
      case 'fantom':
      case 'base':
        return new EthereumConnector(config);
      
      case 'solana':
        return new SolanaConnector(config);
      
      // TODO: Implementar otros conectores
      case 'cardano':
      case 'bitcoin':
      case 'cosmos':
        console.warn(`⚠️ ${config.name} connector not yet implemented, using mock`);
        return new MockConnector(config);
      
      default:
        throw new Error(`Unsupported blockchain: ${config.id}`);
    }
  }

  getConnector(blockchainId: string): BlockchainConnector | undefined {
    return this.connectors.get(blockchainId);
  }

  getConnectors(): BlockchainConnector[] {
    return Array.from(this.connectors.values());
  }

  getActiveNetworks(): string[] {
    return Array.from(this.connectors.keys());
  }

  async getNetworkStatus(): Promise<{ [key: string]: any }> {
    const status: { [key: string]: any } = {};

    for (const [networkId, connector] of this.connectors) {
      try {
        const blockNumber = await connector.getBlockNumber();
        status[networkId] = {
          name: connector.config.name,
          connected: connector.isConnected(),
          blockNumber,
          rpcUrl: connector.config.rpcUrl,
          hasWebSocket: !!connector.config.wsUrl,
          lastCheck: new Date().toISOString()
        };
      } catch (error) {
        status[networkId] = {
          name: connector.config.name,
          connected: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          rpcUrl: connector.config.rpcUrl,
          lastCheck: new Date().toISOString()
        };
      }
    }

    return status;
  }

  async scanForArbitrageOpportunities(): Promise<ArbitrageOpportunity[]> {
    const opportunities: ArbitrageOpportunity[] = [];
    const connectorArray = Array.from(this.connectors.values());

    // Buscar oportunidades de arbitraje entre diferentes chains
    for (let i = 0; i < connectorArray.length; i++) {
      for (let j = i + 1; j < connectorArray.length; j++) {
        const connector1 = connectorArray[i];
        const connector2 = connectorArray[j];

        try {
          const crossChainOpportunities = await this.findCrossChainOpportunities(
            connector1, 
            connector2
          );
          opportunities.push(...crossChainOpportunities);
        } catch (error) {
          console.error(`Error scanning ${connector1.config.name} <-> ${connector2.config.name}:`, error);
        }
      }
    }

    // Buscar oportunidades dentro de la misma chain
    for (const connector of connectorArray) {
      try {
        const intraChainOpportunities = await this.findIntraChainOpportunities(connector);
        opportunities.push(...intraChainOpportunities);
      } catch (error) {
        console.error(`Error scanning intra-chain opportunities on ${connector.config.name}:`, error);
      }
    }

    return opportunities.sort((a, b) => b.profitPercentage - a.profitPercentage);
  }

  private async findCrossChainOpportunities(
    connector1: BlockchainConnector, 
    connector2: BlockchainConnector
  ): Promise<ArbitrageOpportunity[]> {
    // TODO: Implementar lógica real de detección de arbitraje cross-chain
    // Por ahora retorna oportunidades mock
    
    const commonTokens = ['USDC', 'USDT', 'WETH', 'WBTC'];
    const opportunities: ArbitrageOpportunity[] = [];

    for (const token of commonTokens) {
      // Simular diferencia de precios
      const priceDiff = Math.random() * 0.05; // Hasta 5% diferencia
      
      if (priceDiff > 0.01) { // Solo oportunidades > 1%
        opportunities.push({
          id: `cross_${connector1.config.id}_${connector2.config.id}_${token}_${Date.now()}`,
          strategy: 'cross_chain_arbitrage',
          blockchainFrom: connector1.config.id,
          blockchainTo: connector2.config.id,
          tokenIn: token,
          tokenOut: token,
          amountIn: '1000',
          expectedAmountOut: (1000 * (1 + priceDiff)).toString(),
          profitAmount: (1000 * priceDiff).toString(),
          profitPercentage: priceDiff * 100,
          gasEstimate: '50000',
          confidence: 0.8 + (Math.random() * 0.2),
          expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutos
          dexPath: [
            { exchange: `DEX_${connector1.config.id}`, poolAddress: `0x${Math.random().toString(16).substr(2, 40)}` },
            { exchange: `DEX_${connector2.config.id}`, poolAddress: `0x${Math.random().toString(16).substr(2, 40)}` }
          ]
        });
      }
    }

    return opportunities;
  }

  private async findIntraChainOpportunities(connector: BlockchainConnector): Promise<ArbitrageOpportunity[]> {
    // TODO: Implementar lógica real de detección de arbitraje intra-chain
    // Por ahora retorna oportunidades mock basadas en DEXs del mismo chain
    
    const opportunities: ArbitrageOpportunity[] = [];
    const dexPairs = [
      ['Uniswap', 'SushiSwap'],
      ['PancakeSwap', 'Biswap'],
      ['QuickSwap', 'SushiSwap'],
      ['Jupiter', 'Raydium']
    ];

    for (const [dex1, dex2] of dexPairs) {
      const priceDiff = Math.random() * 0.03; // Hasta 3% diferencia intra-chain
      
      if (priceDiff > 0.005) { // Solo oportunidades > 0.5%
        // Definir triángulos de tokens realistas para triangular arbitrage
        const triangularPaths = [
          { tokens: ['ETH', 'USDC', 'DAI'], dexes: ['Uniswap', 'SushiSwap', 'Curve'] },
          { tokens: ['WBTC', 'ETH', 'USDT'], dexes: ['Balancer', 'Uniswap', 'Curve'] },
          { tokens: ['USDC', 'WETH', 'UNI'], dexes: ['SushiSwap', 'Uniswap', 'PancakeSwap'] },
          { tokens: ['DAI', 'USDC', 'FRAX'], dexes: ['Curve', 'Balancer', 'Uniswap'] },
          { tokens: ['MATIC', 'USDC', 'WETH'], dexes: ['QuickSwap', 'SushiSwap', 'Curve'] }
        ];

        const randomPath = triangularPaths[Math.floor(Math.random() * triangularPaths.length)];
        const [tokenA, tokenB, tokenC] = randomPath.tokens;
        const [dexA, dexB, dexC] = randomPath.dexes;

        opportunities.push({
          id: `tri_${connector.config.id}_${tokenA}_${tokenB}_${tokenC}_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          strategy: 'triangular_arbitrage',
          blockchainFrom: connector.config.id,
          blockchainTo: connector.config.id,
          tokenIn: tokenA,
          tokenOut: tokenA, // Regresa al token inicial
          amountIn: (Math.random() * 2000 + 500).toFixed(2), // Entre 500-2500
          expectedAmountOut: ((Math.random() * 2000 + 500) * (1 + priceDiff)).toFixed(2),
          profitAmount: ((Math.random() * 2000 + 500) * priceDiff).toFixed(2),
          profitPercentage: priceDiff * 100,
          gasEstimate: (Math.random() * 300000 + 200000).toString(), // Gas más alto para 3 swaps
          confidence: 0.75 + (Math.random() * 0.2), // Confianza algo menor por complejidad
          expiresAt: new Date(Date.now() + 3 * 60 * 1000), // 3 minutos (más corto por volatilidad)
          // Ruta triangular completa: A → B → C → A
          dexPath: [
            { 
              exchange: dexA, 
              poolAddress: `0x${Math.random().toString(16).substr(2, 13)}`, 
              fee: 0.003,
              pair: `${tokenA}/${tokenB}`
            },
            { 
              exchange: dexB, 
              poolAddress: `0x${Math.random().toString(16).substr(2, 13)}`, 
              fee: 0.003,
              pair: `${tokenB}/${tokenC}`
            },
            { 
              exchange: dexC, 
              poolAddress: `0x${Math.random().toString(16).substr(2, 13)}`, 
              fee: 0.003,
              pair: `${tokenC}/${tokenA}`
            }
          ],
          // Información adicional del triángulo
          triangularPath: {
            tokenA,
            tokenB, 
            tokenC,
            route: `${tokenA} → ${tokenB} → ${tokenC} → ${tokenA}`,
            steps: [
              { from: tokenA, to: tokenB, dex: dexA },
              { from: tokenB, to: tokenC, dex: dexB },
              { from: tokenC, to: tokenA, dex: dexC }
            ]
          }
        });
      }
    }

    return opportunities;
  }

  private startHealthChecks(): void {
    this.healthCheckTimer = setInterval(async () => {
      console.log('🔍 Running blockchain health checks...');
      
      for (const [networkId, connector] of this.connectors) {
        try {
          if (!connector.isConnected()) {
            console.warn(`⚠️ ${connector.config.name} disconnected, attempting reconnection...`);
            await connector.connect();
          }
          
          // Test basic functionality
          await connector.getBlockNumber();
        } catch (error) {
          console.error(`❌ Health check failed for ${connector.config.name}:`, error);
        }
      }
    }, this.config.healthCheckInterval);
  }
}

// Mock connector para blockchains no implementados aún
class MockConnector extends BaseBlockchainConnector {
  async connect(): Promise<void> {
    this.connected = true;
    this.log('Mock connector connected');
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.log('Mock connector disconnected');
  }

  async getBlockNumber(): Promise<number> {
    return Math.floor(Date.now() / 1000);
  }

  async getBalance(address: string): Promise<string> {
    return '0.0';
  }

  async getTokenBalance(tokenAddress: string, walletAddress: string): Promise<TokenBalance> {
    return {
      address: tokenAddress,
      symbol: 'MOCK',
      balance: '0.0',
      decimals: 18
    };
  }

  async getTokenPrice(tokenAddress: string): Promise<number> {
    return 1.0;
  }

  async getTransaction(hash: string): Promise<Transaction> {
    return {
      hash,
      from: '0x0000000000000000000000000000000000000000',
      to: '0x0000000000000000000000000000000000000000',
      value: '0',
      blockNumber: 0,
      timestamp: Date.now(),
      status: 'confirmed'
    };
  }

  async sendTransaction(to: string, value: string, data?: string): Promise<string> {
    throw new Error('Mock connector - send not implemented');
  }

  async estimateGas(to: string, value: string, data?: string): Promise<string> {
    return '21000';
  }

  async getPoolInfo(poolAddress: string): Promise<any> {
    return { poolAddress, mock: true };
  }

  async getSwapQuote(tokenIn: string, tokenOut: string, amountIn: string): Promise<any> {
    return {
      tokenIn,
      tokenOut,
      amountIn,
      amountOut: amountIn,
      mock: true
    };
  }
}


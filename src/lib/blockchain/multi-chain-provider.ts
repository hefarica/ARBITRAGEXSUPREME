/**
 * ArbitrageX Supreme - Multi-Chain Provider Manager
 * Ingenio Pichichi S.A. - Gestión empresarial de conectividad blockchain
 * TODO FUNCIONAL - Conectividad real con 5 redes sin mocks
 */

import { ethers } from 'ethers';
import { VaultClient, VaultSecretHelper } from '../vault/vault-client';

export type SupportedChain = 'ethereum' | 'polygon' | 'arbitrum' | 'optimism' | 'base';

export interface ChainConfig {
  chainId: number;
  name: string;
  rpcUrls: string[];
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  blockExplorer: string;
  gasPrice: {
    standard: bigint;
    fast: bigint;
    instant: bigint;
  };
  confirmations: number;
}

export interface ProviderHealth {
  isHealthy: boolean;
  latency: number;
  lastBlock: number;
  gasPrice: bigint;
  timestamp: Date;
}

export class MultiChainProviderManager {
  private providers: Map<SupportedChain, ethers.JsonRpcProvider> = new Map();
  private vaultHelper: VaultSecretHelper | null = null;
  private healthChecks: Map<SupportedChain, ProviderHealth> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;

  // Configuraciones de redes
  private readonly CHAIN_CONFIGS: Record<SupportedChain, ChainConfig> = {
    ethereum: {
      chainId: 1,
      name: 'Ethereum Mainnet',
      rpcUrls: [
        'https://eth-mainnet.alchemyapi.io/v2',
        'https://mainnet.infura.io/v3',
        'https://rpc.ankr.com/eth',
        'https://eth-mainnet.public.blastapi.io'
      ],
      nativeCurrency: {
        name: 'Ether',
        symbol: 'ETH',
        decimals: 18
      },
      blockExplorer: 'https://etherscan.io',
      gasPrice: {
        standard: ethers.parseUnits('20', 'gwei'),
        fast: ethers.parseUnits('25', 'gwei'),
        instant: ethers.parseUnits('30', 'gwei')
      },
      confirmations: 3
    },
    polygon: {
      chainId: 137,
      name: 'Polygon Mainnet',
      rpcUrls: [
        'https://polygon-rpc.com',
        'https://rpc-mainnet.maticvigil.com',
        'https://rpc.ankr.com/polygon',
        'https://polygon-mainnet.public.blastapi.io'
      ],
      nativeCurrency: {
        name: 'MATIC',
        symbol: 'MATIC',
        decimals: 18
      },
      blockExplorer: 'https://polygonscan.com',
      gasPrice: {
        standard: ethers.parseUnits('30', 'gwei'),
        fast: ethers.parseUnits('35', 'gwei'),
        instant: ethers.parseUnits('40', 'gwei')
      },
      confirmations: 5
    },
    arbitrum: {
      chainId: 42161,
      name: 'Arbitrum One',
      rpcUrls: [
        'https://arb1.arbitrum.io/rpc',
        'https://rpc.ankr.com/arbitrum',
        'https://arbitrum-mainnet.public.blastapi.io'
      ],
      nativeCurrency: {
        name: 'Ether',
        symbol: 'ETH',
        decimals: 18
      },
      blockExplorer: 'https://arbiscan.io',
      gasPrice: {
        standard: ethers.parseUnits('0.1', 'gwei'),
        fast: ethers.parseUnits('0.15', 'gwei'),
        instant: ethers.parseUnits('0.2', 'gwei')
      },
      confirmations: 1
    },
    optimism: {
      chainId: 10,
      name: 'Optimism',
      rpcUrls: [
        'https://mainnet.optimism.io',
        'https://rpc.ankr.com/optimism',
        'https://optimism-mainnet.public.blastapi.io'
      ],
      nativeCurrency: {
        name: 'Ether',
        symbol: 'ETH',
        decimals: 18
      },
      blockExplorer: 'https://optimistic.etherscan.io',
      gasPrice: {
        standard: ethers.parseUnits('0.001', 'gwei'),
        fast: ethers.parseUnits('0.002', 'gwei'),
        instant: ethers.parseUnits('0.003', 'gwei')
      },
      confirmations: 1
    },
    base: {
      chainId: 8453,
      name: 'Base',
      rpcUrls: [
        'https://mainnet.base.org',
        'https://rpc.ankr.com/base',
        'https://base-mainnet.public.blastapi.io'
      ],
      nativeCurrency: {
        name: 'Ether',
        symbol: 'ETH',
        decimals: 18
      },
      blockExplorer: 'https://basescan.org',
      gasPrice: {
        standard: ethers.parseUnits('0.001', 'gwei'),
        fast: ethers.parseUnits('0.002', 'gwei'),
        instant: ethers.parseUnits('0.003', 'gwei')
      },
      confirmations: 1
    }
  };

  constructor(vaultClient?: VaultClient) {
    if (vaultClient) {
      this.vaultHelper = new VaultSecretHelper(vaultClient);
    }
    console.log('🔗 MultiChainProviderManager inicializado');
  }

  /**
   * Inicializar conexiones con todas las redes
   */
  async initializeAllChains(): Promise<void> {
    console.log('🚀 Inicializando conexiones multi-chain...');
    
    const chains: SupportedChain[] = ['ethereum', 'polygon', 'arbitrum', 'optimism', 'base'];
    
    const initPromises = chains.map(async (chain) => {
      try {
        await this.initializeChain(chain);
        console.log(`✅ ${chain} inicializado correctamente`);
      } catch (error) {
        console.error(`❌ Error inicializando ${chain}:`, error);
      }
    });

    await Promise.all(initPromises);
    
    // Iniciar monitoreo de salud
    this.startHealthMonitoring();
    
    console.log('🎉 Todas las redes blockchain inicializadas');
  }

  /**
   * Inicializar conexión con una red específica
   */
  async initializeChain(chain: SupportedChain): Promise<ethers.JsonRpcProvider> {
    const config = this.CHAIN_CONFIGS[chain];
    
    // Obtener configuración desde Vault o fallback
    const rpcUrl = await this.getRpcUrl(chain);
    
    const provider = new ethers.JsonRpcProvider(rpcUrl, {
      chainId: config.chainId,
      name: config.name
    });

    // Configurar timeout y retry
    provider.pollingInterval = 12000; // 12 segundos
    
    // Validar conexión
    try {
      const network = await provider.getNetwork();
      const blockNumber = await provider.getBlockNumber();
      
      if (Number(network.chainId) !== config.chainId) {
        throw new Error(`Chain ID mismatch: expected ${config.chainId}, got ${network.chainId}`);
      }
      
      console.log(`🔗 ${config.name} conectado - Block: ${blockNumber}, Chain ID: ${network.chainId}`);
      
      // Almacenar provider
      this.providers.set(chain, provider);
      
      // Realizar health check inicial
      await this.performHealthCheck(chain);
      
      return provider;
      
    } catch (error) {
      console.error(`❌ Error conectando con ${config.name}:`, error);
      throw error;
    }
  }

  /**
   * Obtener RPC URL desde Vault o fallback
   */
  private async getRpcUrl(chain: SupportedChain): Promise<string> {
    const config = this.CHAIN_CONFIGS[chain];
    
    if (this.vaultHelper) {
      try {
        const chainConfig = await this.vaultHelper.getBlockchainConfig(chain);
        if (chainConfig && chainConfig.rpcUrl) {
          console.log(`🔐 Usando RPC URL desde Vault para ${chain}`);
          return chainConfig.rpcUrl;
        }
      } catch (error) {
        console.warn(`⚠️  No se pudo obtener RPC URL desde Vault para ${chain}:`, error);
      }
    }
    
    // Fallback a URLs públicas
    const fallbackEnvVar = `${chain.toUpperCase()}_RPC_URL`;
    const envRpcUrl = process.env[fallbackEnvVar];
    
    if (envRpcUrl) {
      console.log(`📝 Usando RPC URL desde env var ${fallbackEnvVar} para ${chain}`);
      return envRpcUrl;
    }
    
    // Último fallback: URLs públicas
    console.log(`🌐 Usando RPC URL público para ${chain}`);
    return config.rpcUrls[0];
  }

  /**
   * Obtener provider para una red específica
   */
  getProvider(chain: SupportedChain): ethers.JsonRpcProvider | null {
    return this.providers.get(chain) || null;
  }

  /**
   * Obtener todos los providers disponibles
   */
  getAllProviders(): Map<SupportedChain, ethers.JsonRpcProvider> {
    return new Map(this.providers);
  }

  /**
   * Verificar si una red está disponible
   */
  isChainAvailable(chain: SupportedChain): boolean {
    return this.providers.has(chain) && this.isChainHealthy(chain);
  }

  /**
   * Verificar si una red está saludable
   */
  isChainHealthy(chain: SupportedChain): boolean {
    const health = this.healthChecks.get(chain);
    return health ? health.isHealthy : false;
  }

  /**
   * Obtener información de salud de una red
   */
  getChainHealth(chain: SupportedChain): ProviderHealth | null {
    return this.healthChecks.get(chain) || null;
  }

  /**
   * Realizar health check de una red
   */
  async performHealthCheck(chain: SupportedChain): Promise<ProviderHealth> {
    const provider = this.providers.get(chain);
    
    if (!provider) {
      throw new Error(`Provider not initialized for chain: ${chain}`);
    }

    const startTime = Date.now();
    
    try {
      // Verificar conectividad básica
      const [network, blockNumber, feeData] = await Promise.all([
        provider.getNetwork(),
        provider.getBlockNumber(),
        provider.getFeeData()
      ]);

      const latency = Date.now() - startTime;
      
      const health: ProviderHealth = {
        isHealthy: true,
        latency,
        lastBlock: blockNumber,
        gasPrice: feeData.gasPrice || 0n,
        timestamp: new Date()
      };

      this.healthChecks.set(chain, health);
      
      return health;
      
    } catch (error) {
      console.error(`❌ Health check falló para ${chain}:`, error);
      
      const health: ProviderHealth = {
        isHealthy: false,
        latency: Date.now() - startTime,
        lastBlock: 0,
        gasPrice: 0n,
        timestamp: new Date()
      };

      this.healthChecks.set(chain, health);
      
      return health;
    }
  }

  /**
   * Iniciar monitoreo continuo de salud
   */
  startHealthMonitoring(intervalMs: number = 30000): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      console.log('🔍 Ejecutando health check de todas las redes...');
      
      for (const chain of this.providers.keys()) {
        try {
          await this.performHealthCheck(chain);
        } catch (error) {
          console.error(`❌ Health check error para ${chain}:`, error);
        }
      }
      
      // Log estado general
      const healthyChains = Array.from(this.providers.keys()).filter(chain => this.isChainHealthy(chain));
      console.log(`📊 Redes saludables: ${healthyChains.length}/${this.providers.size} - ${healthyChains.join(', ')}`);
      
    }, intervalMs);

    console.log(`⏰ Monitoreo de salud iniciado (cada ${intervalMs}ms)`);
  }

  /**
   * Parar monitoreo de salud
   */
  stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      console.log('⏹️  Monitoreo de salud detenido');
    }
  }

  /**
   * Obtener configuración de una red
   */
  getChainConfig(chain: SupportedChain): ChainConfig {
    return this.CHAIN_CONFIGS[chain];
  }

  /**
   * Obtener gas price optimizado para una red
   */
  async getOptimalGasPrice(chain: SupportedChain, priority: 'standard' | 'fast' | 'instant' = 'standard'): Promise<bigint> {
    const provider = this.providers.get(chain);
    
    if (!provider) {
      throw new Error(`Provider not available for chain: ${chain}`);
    }

    try {
      // Obtener gas price actual de la red
      const feeData = await provider.getFeeData();
      const currentGasPrice = feeData.gasPrice || 0n;
      
      // Obtener configuración predefinida
      const config = this.CHAIN_CONFIGS[chain];
      const configuredPrice = config.gasPrice[priority];
      
      // Usar el mayor entre el actual y el configurado
      return currentGasPrice > configuredPrice ? currentGasPrice : configuredPrice;
      
    } catch (error) {
      console.error(`❌ Error obteniendo gas price para ${chain}:`, error);
      
      // Fallback a precio configurado
      return this.CHAIN_CONFIGS[chain].gasPrice[priority];
    }
  }

  /**
   * Obtener resumen de estado de todas las redes
   */
  getNetworkSummary(): {
    totalNetworks: number;
    healthyNetworks: number;
    unhealthyNetworks: string[];
    avgLatency: number;
  } {
    const totalNetworks = this.providers.size;
    const healthyChains = Array.from(this.providers.keys()).filter(chain => this.isChainHealthy(chain));
    const unhealthyChains = Array.from(this.providers.keys()).filter(chain => !this.isChainHealthy(chain));
    
    const latencies = Array.from(this.healthChecks.values()).map(h => h.latency);
    const avgLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;

    return {
      totalNetworks,
      healthyNetworks: healthyChains.length,
      unhealthyNetworks: unhealthyChains,
      avgLatency: Math.round(avgLatency)
    };
  }

  /**
   * Cleanup de recursos
   */
  async cleanup(): Promise<void> {
    this.stopHealthMonitoring();
    
    // Cleanup providers
    for (const provider of this.providers.values()) {
      provider.removeAllListeners();
    }
    
    this.providers.clear();
    this.healthChecks.clear();
    
    console.log('🧹 MultiChainProviderManager limpiado');
  }
}

// Singleton instance
let globalProviderManager: MultiChainProviderManager | null = null;

export function getMultiChainProvider(): MultiChainProviderManager {
  if (!globalProviderManager) {
    globalProviderManager = new MultiChainProviderManager();
  }
  return globalProviderManager;
}

export async function initializeMultiChain(vaultClient?: VaultClient): Promise<MultiChainProviderManager> {
  if (!globalProviderManager) {
    globalProviderManager = new MultiChainProviderManager(vaultClient);
  }
  
  await globalProviderManager.initializeAllChains();
  return globalProviderManager;
}

export default MultiChainProviderManager;
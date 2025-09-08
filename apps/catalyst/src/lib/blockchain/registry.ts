/**
 * ArbitrageX Supreme - Blockchain Registry
 * Ingenio Pichichi S.A. - Registro de 20+ Blockchains Soportadas
 * 
 * Sistema de registro disciplinado y organizado para todas las blockchains
 * con configuración metodica de RPCs, exploradores y parámetros técnicos
 */

export interface BlockchainConfig {
  chainId: number
  name: string
  symbol: string
  rpcUrl: string
  explorerUrl: string
  nativeCurrency: string
  isTestnet: boolean
  isActive: boolean
  gasTokenSymbol: string
  
  // Parámetros Técnicos
  blockTime: number // segundos por bloque
  confirmations: number
  maxGasPrice?: string // en Gwei
  
  // Configuración de Flash Loans
  flashLoanProviders?: string[]
  avgGasCost: number // USD promedio
  
  // URLs Adicionales
  websiteUrl?: string
  docsUrl?: string
  
  // Configuración DeFi
  majorDexes: string[]
  lendingProtocols: string[]
}

/**
 * REGISTRO COMPLETO DE BLOCKCHAINS SOPORTADAS
 * Cosecha metodica de 20+ cadenas principales para maximizar oportunidades
 */
export const BLOCKCHAIN_REGISTRY: Record<string, BlockchainConfig> = {
  // ========================================
  // TIER 1 - BLOCKCHAINS PRINCIPALES 
  // ========================================
  
  ethereum: {
    chainId: 1,
    name: 'Ethereum Mainnet',
    symbol: 'ETH',
    rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/demo',
    explorerUrl: 'https://etherscan.io',
    nativeCurrency: 'ETH',
    isTestnet: false,
    isActive: true,
    gasTokenSymbol: 'ETH',
    blockTime: 12,
    confirmations: 12,
    maxGasPrice: '100',
    flashLoanProviders: ['Aave V3', 'Balancer V2', 'dYdX', 'Euler'],
    avgGasCost: 15.0,
    websiteUrl: 'https://ethereum.org',
    docsUrl: 'https://ethereum.org/developers',
    majorDexes: ['Uniswap V3', 'Uniswap V2', 'SushiSwap', '1inch', 'Curve'],
    lendingProtocols: ['Aave V3', 'Compound V3', 'Euler', 'MorphoBlue']
  },

  bsc: {
    chainId: 56,
    name: 'BNB Smart Chain',
    symbol: 'BNB',
    rpcUrl: process.env.BSC_RPC_URL || 'https://bsc-dataseed1.binance.org/',
    explorerUrl: 'https://bscscan.com',
    nativeCurrency: 'BNB',
    isTestnet: false,
    isActive: true,
    gasTokenSymbol: 'BNB',
    blockTime: 3,
    confirmations: 15,
    maxGasPrice: '20',
    flashLoanProviders: ['PancakeSwap V3', 'Venus', 'Radiant'],
    avgGasCost: 0.5,
    websiteUrl: 'https://www.bnbchain.org',
    docsUrl: 'https://docs.bnbchain.org',
    majorDexes: ['PancakeSwap V3', 'PancakeSwap V2', 'Biswap', 'ApeSwap', 'Ellipsis'],
    lendingProtocols: ['Venus', 'Radiant', 'Alpaca Finance', 'ForTube']
  },

  polygon: {
    chainId: 137,
    name: 'Polygon',
    symbol: 'MATIC',
    rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com/',
    explorerUrl: 'https://polygonscan.com',
    nativeCurrency: 'MATIC',
    isTestnet: false,
    isActive: true,
    gasTokenSymbol: 'MATIC',
    blockTime: 2,
    confirmations: 20,
    maxGasPrice: '500',
    flashLoanProviders: ['Aave V3', 'Balancer V2', 'QuickSwap'],
    avgGasCost: 0.01,
    websiteUrl: 'https://polygon.technology',
    docsUrl: 'https://docs.polygon.technology',
    majorDexes: ['QuickSwap V3', 'SushiSwap', 'Curve', 'Balancer V2', 'Uniswap V3'],
    lendingProtocols: ['Aave V3', 'Compound V3', 'Granary', 'Market']
  },

  arbitrum: {
    chainId: 42161,
    name: 'Arbitrum One',
    symbol: 'ETH',
    rpcUrl: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
    explorerUrl: 'https://arbiscan.io',
    nativeCurrency: 'ETH',
    isTestnet: false,
    isActive: true,
    gasTokenSymbol: 'ETH',
    blockTime: 1,
    confirmations: 10,
    maxGasPrice: '5',
    flashLoanProviders: ['Aave V3', 'Balancer V2', 'Radiant'],
    avgGasCost: 1.0,
    websiteUrl: 'https://arbitrum.io',
    docsUrl: 'https://docs.arbitrum.io',
    majorDexes: ['Uniswap V3', 'SushiSwap', 'Curve', 'Balancer V2', 'Camelot'],
    lendingProtocols: ['Aave V3', 'Radiant', 'Compound V3', 'Granary']
  },

  optimism: {
    chainId: 10,
    name: 'Optimism',
    symbol: 'ETH',
    rpcUrl: process.env.OPTIMISM_RPC_URL || 'https://mainnet.optimism.io',
    explorerUrl: 'https://optimistic.etherscan.io',
    nativeCurrency: 'ETH',
    isTestnet: false,
    isActive: true,
    gasTokenSymbol: 'ETH',
    blockTime: 2,
    confirmations: 10,
    maxGasPrice: '5',
    flashLoanProviders: ['Aave V3', 'Balancer V2'],
    avgGasCost: 0.5,
    websiteUrl: 'https://optimism.io',
    docsUrl: 'https://docs.optimism.io',
    majorDexes: ['Uniswap V3', 'Curve', 'Balancer V2', 'Velodrome'],
    lendingProtocols: ['Aave V3', 'Compound V3', 'Granary']
  },

  // ========================================
  // TIER 2 - BLOCKCHAINS EMERGENTES
  // ========================================

  avalanche: {
    chainId: 43114,
    name: 'Avalanche C-Chain',
    symbol: 'AVAX',
    rpcUrl: process.env.AVALANCHE_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc',
    explorerUrl: 'https://snowtrace.io',
    nativeCurrency: 'AVAX',
    isTestnet: false,
    isActive: true,
    gasTokenSymbol: 'AVAX',
    blockTime: 2,
    confirmations: 15,
    maxGasPrice: '30',
    flashLoanProviders: ['Aave V3', 'Benqi'],
    avgGasCost: 0.25,
    websiteUrl: 'https://avax.network',
    docsUrl: 'https://docs.avax.network',
    majorDexes: ['Trader Joe', 'Pangolin', 'SushiSwap', 'Curve'],
    lendingProtocols: ['Aave V3', 'Benqi', 'Granary']
  },

  fantom: {
    chainId: 250,
    name: 'Fantom Opera',
    symbol: 'FTM',
    rpcUrl: process.env.FANTOM_RPC_URL || 'https://rpc.ftm.tools/',
    explorerUrl: 'https://ftmscan.com',
    nativeCurrency: 'FTM',
    isTestnet: false,
    isActive: true,
    gasTokenSymbol: 'FTM',
    blockTime: 1,
    confirmations: 10,
    maxGasPrice: '500',
    flashLoanProviders: ['Geist Finance', 'SpiritSwap'],
    avgGasCost: 0.05,
    websiteUrl: 'https://fantom.foundation',
    docsUrl: 'https://docs.fantom.foundation',
    majorDexes: ['SpookySwap', 'SpiritSwap', 'SushiSwap', 'Curve'],
    lendingProtocols: ['Geist Finance', 'Scream', 'Tarot']
  },

  base: {
    chainId: 8453,
    name: 'Base',
    symbol: 'ETH',
    rpcUrl: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
    explorerUrl: 'https://basescan.org',
    nativeCurrency: 'ETH',
    isTestnet: false,
    isActive: true,
    gasTokenSymbol: 'ETH',
    blockTime: 2,
    confirmations: 10,
    maxGasPrice: '5',
    flashLoanProviders: ['Aave V3'],
    avgGasCost: 0.3,
    websiteUrl: 'https://base.org',
    docsUrl: 'https://docs.base.org',
    majorDexes: ['Uniswap V3', 'SushiSwap', 'Curve', 'BaseSwap'],
    lendingProtocols: ['Aave V3', 'Compound V3']
  },

  // ========================================
  // TIER 3 - BLOCKCHAINS ESPECIALIZADAS
  // ========================================

  celo: {
    chainId: 42220,
    name: 'Celo',
    symbol: 'CELO',
    rpcUrl: process.env.CELO_RPC_URL || 'https://forno.celo.org',
    explorerUrl: 'https://celoscan.io',
    nativeCurrency: 'CELO',
    isTestnet: false,
    isActive: true,
    gasTokenSymbol: 'CELO',
    blockTime: 5,
    confirmations: 10,
    flashLoanProviders: ['Ubeswap'],
    avgGasCost: 0.01,
    websiteUrl: 'https://celo.org',
    docsUrl: 'https://docs.celo.org',
    majorDexes: ['Ubeswap', 'SushiSwap'],
    lendingProtocols: ['Moola Market']
  },

  gnosis: {
    chainId: 100,
    name: 'Gnosis Chain',
    symbol: 'xDAI',
    rpcUrl: process.env.GNOSIS_RPC_URL || 'https://rpc.gnosischain.com',
    explorerUrl: 'https://gnosisscan.io',
    nativeCurrency: 'xDAI',
    isTestnet: false,
    isActive: true,
    gasTokenSymbol: 'xDAI',
    blockTime: 5,
    confirmations: 10,
    flashLoanProviders: [],
    avgGasCost: 0.001,
    websiteUrl: 'https://gnosis.io',
    docsUrl: 'https://docs.gnosischain.com',
    majorDexes: ['Honeyswap', 'SushiSwap', 'Curve'],
    lendingProtocols: []
  },

  moonbeam: {
    chainId: 1284,
    name: 'Moonbeam',
    symbol: 'GLMR',
    rpcUrl: process.env.MOONBEAM_RPC_URL || 'https://rpc.api.moonbeam.network',
    explorerUrl: 'https://moonscan.io',
    nativeCurrency: 'GLMR',
    isTestnet: false,
    isActive: true,
    gasTokenSymbol: 'GLMR',
    blockTime: 12,
    confirmations: 10,
    flashLoanProviders: [],
    avgGasCost: 0.1,
    websiteUrl: 'https://moonbeam.network',
    docsUrl: 'https://docs.moonbeam.network',
    majorDexes: ['StellaSwap', 'BeamSwap', 'SushiSwap'],
    lendingProtocols: ['Moonwell']
  },

  aurora: {
    chainId: 1313161554,
    name: 'Aurora',
    symbol: 'ETH',
    rpcUrl: process.env.AURORA_RPC_URL || 'https://mainnet.aurora.dev',
    explorerUrl: 'https://aurorascan.dev',
    nativeCurrency: 'ETH',
    isTestnet: false,
    isActive: true,
    gasTokenSymbol: 'ETH',
    blockTime: 1,
    confirmations: 10,
    flashLoanProviders: [],
    avgGasCost: 0.001,
    websiteUrl: 'https://aurora.dev',
    docsUrl: 'https://docs.aurora.dev',
    majorDexes: ['Trisolaris', 'WannaSwap', 'NearPad'],
    lendingProtocols: ['Aurigami', 'Bastion']
  },

  // ========================================
  // TESTNETS - Para Desarrollo y Pruebas
  // ========================================

  goerli: {
    chainId: 5,
    name: 'Ethereum Goerli',
    symbol: 'ETH',
    rpcUrl: process.env.GOERLI_RPC_URL || 'https://goerli.infura.io/v3/demo',
    explorerUrl: 'https://goerli.etherscan.io',
    nativeCurrency: 'ETH',
    isTestnet: true,
    isActive: false, // Disabled by default in production
    gasTokenSymbol: 'ETH',
    blockTime: 15,
    confirmations: 5,
    flashLoanProviders: ['Aave V3 Testnet'],
    avgGasCost: 0,
    websiteUrl: 'https://ethereum.org',
    docsUrl: 'https://ethereum.org/developers',
    majorDexes: ['Uniswap V3 Testnet'],
    lendingProtocols: ['Aave V3 Testnet']
  },

  mumbai: {
    chainId: 80001,
    name: 'Polygon Mumbai',
    symbol: 'MATIC',
    rpcUrl: process.env.MUMBAI_RPC_URL || 'https://rpc-mumbai.maticvigil.com',
    explorerUrl: 'https://mumbai.polygonscan.com',
    nativeCurrency: 'MATIC',
    isTestnet: true,
    isActive: false,
    gasTokenSymbol: 'MATIC',
    blockTime: 2,
    confirmations: 10,
    flashLoanProviders: [],
    avgGasCost: 0,
    websiteUrl: 'https://polygon.technology',
    docsUrl: 'https://docs.polygon.technology',
    majorDexes: ['QuickSwap Testnet'],
    lendingProtocols: []
  }
}

/**
 * UTILIDADES DEL REGISTRO DE BLOCKCHAINS
 * Funciones organizadas para la gestión eficiente de cadenas
 */

export class BlockchainRegistry {
  /**
   * Obtiene todas las blockchains activas (no testnets)
   */
  static getActiveMainnets(): BlockchainConfig[] {
    return Object.values(BLOCKCHAIN_REGISTRY).filter(
      chain => chain.isActive && !chain.isTestnet
    )
  }

  /**
   * Obtiene blockchains por tipo de protocolo soportado
   */
  static getChainsByFlashLoanSupport(): BlockchainConfig[] {
    return Object.values(BLOCKCHAIN_REGISTRY).filter(
      chain => chain.isActive && chain.flashLoanProviders && chain.flashLoanProviders.length > 0
    )
  }

  /**
   * Obtiene blockchain por Chain ID
   */
  static getByChainId(chainId: number): BlockchainConfig | undefined {
    return Object.values(BLOCKCHAIN_REGISTRY).find(chain => chain.chainId === chainId)
  }

  /**
   * Obtiene blockchains ordenadas por costo de gas
   */
  static getChainsByGasCost(): BlockchainConfig[] {
    return Object.values(BLOCKCHAIN_REGISTRY)
      .filter(chain => chain.isActive && !chain.isTestnet)
      .sort((a, b) => a.avgGasCost - b.avgGasCost)
  }

  /**
   * Cuenta total de protocolos soportados
   */
  static getTotalProtocolCount(): number {
    return Object.values(BLOCKCHAIN_REGISTRY)
      .filter(chain => chain.isActive && !chain.isTestnet)
      .reduce((count, chain) => {
        return count + chain.majorDexes.length + chain.lendingProtocols.length
      }, 0)
  }

  /**
   * Obtiene estadísticas del registro
   */
  static getRegistryStats() {
    const allChains = Object.values(BLOCKCHAIN_REGISTRY)
    const activeMainnets = allChains.filter(chain => chain.isActive && !chain.isTestnet)
    const flashLoanChains = allChains.filter(chain => 
      chain.flashLoanProviders && chain.flashLoanProviders.length > 0
    )

    return {
      totalChains: allChains.length,
      activeMainnets: activeMainnets.length,
      testnets: allChains.filter(chain => chain.isTestnet).length,
      flashLoanSupported: flashLoanChains.length,
      totalProtocols: this.getTotalProtocolCount(),
      averageGasCost: activeMainnets.reduce((sum, chain) => sum + chain.avgGasCost, 0) / activeMainnets.length
    }
  }
}
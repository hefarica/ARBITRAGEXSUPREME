// ArbitrageX Pro 2025 - Blockchain Network Configurations
// Configuraciones para las 12 blockchains soportadas

import { BlockchainConfig } from '../types/blockchain';

export const MAINNET_CONFIGS: BlockchainConfig[] = [
  {
    id: 'ethereum',
    name: 'Ethereum',
    symbol: 'ETH',
    rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/demo',
    wsUrl: process.env.ETHEREUM_WS_URL || 'wss://eth-mainnet.g.alchemy.com/v2/demo',
    backupRpcUrl: process.env.ETHEREUM_BACKUP_RPC || 'https://mainnet.infura.io/v3/demo',
    chainId: 1,
    explorerUrl: 'https://etherscan.io',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18
    },
    blockTime: 12,
    confirmations: 12
  },
  {
    id: 'bsc',
    name: 'Binance Smart Chain',
    symbol: 'BNB',
    rpcUrl: process.env.BSC_RPC_URL || 'https://bsc-dataseed1.binance.org/',
    backupRpcUrl: process.env.BSC_BACKUP_RPC || 'https://bsc-dataseed2.binance.org/',
    chainId: 56,
    explorerUrl: 'https://bscscan.com',
    nativeCurrency: {
      name: 'Binance Coin',
      symbol: 'BNB',
      decimals: 18
    },
    blockTime: 3,
    confirmations: 15
  },
  {
    id: 'polygon',
    name: 'Polygon',
    symbol: 'MATIC',
    rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-mainnet.g.alchemy.com/v2/demo',
    backupRpcUrl: process.env.POLYGON_BACKUP_RPC || 'https://polygon-rpc.com/',
    chainId: 137,
    explorerUrl: 'https://polygonscan.com',
    nativeCurrency: {
      name: 'Polygon',
      symbol: 'MATIC',
      decimals: 18
    },
    blockTime: 2,
    confirmations: 30
  },
  {
    id: 'arbitrum',
    name: 'Arbitrum',
    symbol: 'ETH',
    rpcUrl: process.env.ARBITRUM_RPC_URL || 'https://arb-mainnet.g.alchemy.com/v2/demo',
    backupRpcUrl: process.env.ARBITRUM_BACKUP_RPC || 'https://arb1.arbitrum.io/rpc',
    chainId: 42161,
    explorerUrl: 'https://arbiscan.io',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18
    },
    blockTime: 1,
    confirmations: 1
  },
  {
    id: 'optimism',
    name: 'Optimism',
    symbol: 'ETH',
    rpcUrl: process.env.OPTIMISM_RPC_URL || 'https://opt-mainnet.g.alchemy.com/v2/demo',
    backupRpcUrl: process.env.OPTIMISM_BACKUP_RPC || 'https://mainnet.optimism.io',
    chainId: 10,
    explorerUrl: 'https://optimistic.etherscan.io',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18
    },
    blockTime: 2,
    confirmations: 12
  },
  {
    id: 'avalanche',
    name: 'Avalanche',
    symbol: 'AVAX',
    rpcUrl: process.env.AVALANCHE_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc',
    backupRpcUrl: process.env.AVALANCHE_BACKUP_RPC || 'https://rpc.ankr.com/avalanche',
    chainId: 43114,
    explorerUrl: 'https://snowtrace.io',
    nativeCurrency: {
      name: 'Avalanche',
      symbol: 'AVAX',
      decimals: 18
    },
    blockTime: 2,
    confirmations: 1
  },
  {
    id: 'solana',
    name: 'Solana',
    symbol: 'SOL',
    rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
    wsUrl: process.env.SOLANA_WS_URL || 'wss://api.mainnet-beta.solana.com',
    explorerUrl: 'https://explorer.solana.com',
    nativeCurrency: {
      name: 'Solana',
      symbol: 'SOL',
      decimals: 9
    },
    blockTime: 0.4,
    confirmations: 1
  },
  {
    id: 'fantom',
    name: 'Fantom',
    symbol: 'FTM',
    rpcUrl: process.env.FANTOM_RPC_URL || 'https://rpc.ftm.tools/',
    backupRpcUrl: process.env.FANTOM_BACKUP_RPC || 'https://rpc.ankr.com/fantom',
    chainId: 250,
    explorerUrl: 'https://ftmscan.com',
    nativeCurrency: {
      name: 'Fantom',
      symbol: 'FTM',
      decimals: 18
    },
    blockTime: 1,
    confirmations: 5
  },
  {
    id: 'base',
    name: 'Base',
    symbol: 'ETH',
    rpcUrl: process.env.BASE_RPC_URL || 'https://base-mainnet.g.alchemy.com/v2/demo',
    backupRpcUrl: process.env.BASE_BACKUP_RPC || 'https://mainnet.base.org',
    chainId: 8453,
    explorerUrl: 'https://basescan.org',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18
    },
    blockTime: 2,
    confirmations: 1
  },
  {
    id: 'cardano',
    name: 'Cardano',
    symbol: 'ADA',
    rpcUrl: process.env.CARDANO_RPC_URL || 'https://cardano-mainnet.blockfrost.io/api/v0',
    explorerUrl: 'https://cardanoscan.io',
    nativeCurrency: {
      name: 'Cardano',
      symbol: 'ADA',
      decimals: 6
    },
    blockTime: 20,
    confirmations: 5
  },
  {
    id: 'bitcoin',
    name: 'Bitcoin',
    symbol: 'BTC',
    rpcUrl: process.env.BITCOIN_RPC_URL || 'https://blockstream.info/api',
    backupRpcUrl: process.env.BITCOIN_BACKUP_RPC || 'https://api.blockcypher.com/v1/btc/main',
    explorerUrl: 'https://blockstream.info',
    nativeCurrency: {
      name: 'Bitcoin',
      symbol: 'BTC',
      decimals: 8
    },
    blockTime: 600,
    confirmations: 6
  },
  {
    id: 'cosmos',
    name: 'Cosmos Hub',
    symbol: 'ATOM',
    rpcUrl: process.env.COSMOS_RPC_URL || 'https://cosmos-rpc.polkachu.com',
    explorerUrl: 'https://www.mintscan.io/cosmos',
    nativeCurrency: {
      name: 'Cosmos',
      symbol: 'ATOM',
      decimals: 6
    },
    blockTime: 6,
    confirmations: 1
  }
];

export const TESTNET_CONFIGS: BlockchainConfig[] = [
  {
    id: 'ethereum',
    name: 'Ethereum Sepolia',
    symbol: 'ETH',
    rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/demo',
    wsUrl: process.env.ETHEREUM_WS_URL || 'wss://eth-sepolia.g.alchemy.com/v2/demo',
    backupRpcUrl: process.env.ETHEREUM_BACKUP_RPC || 'https://sepolia.infura.io/v3/demo',
    chainId: 11155111,
    explorerUrl: 'https://sepolia.etherscan.io',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18
    },
    blockTime: 12,
    confirmations: 3
  },
  {
    id: 'bsc',
    name: 'BSC Testnet',
    symbol: 'tBNB',
    rpcUrl: process.env.BSC_RPC_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545/',
    backupRpcUrl: process.env.BSC_BACKUP_RPC || 'https://data-seed-prebsc-2-s1.binance.org:8545/',
    chainId: 97,
    explorerUrl: 'https://testnet.bscscan.com',
    nativeCurrency: {
      name: 'Test BNB',
      symbol: 'tBNB',
      decimals: 18
    },
    blockTime: 3,
    confirmations: 3
  },
  {
    id: 'solana',
    name: 'Solana Devnet',
    symbol: 'SOL',
    rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
    wsUrl: process.env.SOLANA_WS_URL || 'wss://api.devnet.solana.com',
    explorerUrl: 'https://explorer.solana.com/?cluster=devnet',
    nativeCurrency: {
      name: 'Solana',
      symbol: 'SOL',
      decimals: 9
    },
    blockTime: 0.4,
    confirmations: 1
  },
  {
    id: 'polygon',
    name: 'Polygon Mumbai',
    symbol: 'MATIC',
    rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-mumbai.g.alchemy.com/v2/demo',
    backupRpcUrl: process.env.POLYGON_BACKUP_RPC || 'https://rpc-mumbai.maticvigil.com',
    chainId: 80001,
    explorerUrl: 'https://mumbai.polygonscan.com',
    nativeCurrency: {
      name: 'Polygon',
      symbol: 'MATIC',
      decimals: 18
    },
    blockTime: 2,
    confirmations: 10
  },
  {
    id: 'arbitrum',
    name: 'Arbitrum Goerli',
    symbol: 'ETH',
    rpcUrl: process.env.ARBITRUM_RPC_URL || 'https://arb-goerli.g.alchemy.com/v2/demo',
    backupRpcUrl: process.env.ARBITRUM_BACKUP_RPC || 'https://goerli-rollup.arbitrum.io/rpc',
    chainId: 421613,
    explorerUrl: 'https://goerli.arbiscan.io',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18
    },
    blockTime: 1,
    confirmations: 1
  },
  {
    id: 'optimism',
    name: 'Optimism Goerli',
    symbol: 'ETH',
    rpcUrl: process.env.OPTIMISM_RPC_URL || 'https://opt-goerli.g.alchemy.com/v2/demo',
    backupRpcUrl: process.env.OPTIMISM_BACKUP_RPC || 'https://goerli.optimism.io',
    chainId: 420,
    explorerUrl: 'https://goerli-optimism.etherscan.io',
    nativeCurrency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18
    },
    blockTime: 2,
    confirmations: 3
  }
];

// Función para obtener configuraciones según el entorno
export function getNetworkConfigs(): BlockchainConfig[] {
  const isProduction = process.env.NODE_ENV === 'production';
  return isProduction ? MAINNET_CONFIGS : TESTNET_CONFIGS;
}

// Función para obtener configuración específica de una blockchain
export function getNetworkConfig(networkId: string): BlockchainConfig | undefined {
  const configs = getNetworkConfigs();
  return configs.find(config => config.id === networkId);
}

// Configuraciones de DEXs por blockchain
export const DEX_CONFIGS = {
  ethereum: [
    {
      name: 'Uniswap V3',
      routerAddress: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      factoryAddress: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
      fees: [0.0005, 0.003, 0.01] // 0.05%, 0.3%, 1%
    },
    {
      name: 'SushiSwap',
      routerAddress: '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F',
      factoryAddress: '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac',
      fees: [0.003] // 0.3%
    }
  ],
  bsc: [
    {
      name: 'PancakeSwap V3',
      routerAddress: '0x13f4EA83D0bd40E75C8222255bc855a974568Dd4',
      factoryAddress: '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865',
      fees: [0.0001, 0.0005, 0.0025, 0.01] // 0.01%, 0.05%, 0.25%, 1%
    },
    {
      name: 'Biswap',
      routerAddress: '0x3a6d8cA21D1CF76F653A67577FA0D27453350dD8',
      factoryAddress: '0x858E3312ed3A876947EA49d572A7C42DE08af7EE',
      fees: [0.001] // 0.1%
    }
  ],
  polygon: [
    {
      name: 'QuickSwap',
      routerAddress: '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff',
      factoryAddress: '0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32',
      fees: [0.003] // 0.3%
    }
  ],
  solana: [
    {
      name: 'Jupiter',
      programId: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
      fees: [0.0025] // 0.25% promedio
    },
    {
      name: 'Raydium',
      programId: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8',
      fees: [0.0025] // 0.25%
    }
  ]
};

// Tokens comunes por blockchain para arbitraje
export const COMMON_TOKENS = {
  ethereum: {
    'USDC': '0xA0b86a33E6441c4C5C0d4c1E8C9b1871C23AE1eF',
    'USDT': '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    'WETH': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    'WBTC': '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599'
  },
  bsc: {
    'USDC': '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    'USDT': '0x55d398326f99059fF775485246999027B3197955',
    'WBNB': '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
    'BTCB': '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c'
  },
  polygon: {
    'USDC': '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
    'USDT': '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    'WMATIC': '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
    'WETH': '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619'
  },
  solana: {
    'USDC': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    'USDT': 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    'SOL': 'So11111111111111111111111111111111111111112',
    'WSOL': 'So11111111111111111111111111111111111111112'
  }
};
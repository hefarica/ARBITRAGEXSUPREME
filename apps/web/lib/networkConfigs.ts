/**
 * Configuraciones completas de las 20 blockchains soportadas por ArbitrageX
 * Para integración inteligente con MetaMask usando wallet_addEthereumChain
 */

export interface NetworkConfig {
  chainId: string
  chainName: string
  nativeCurrency: {
    name: string
    symbol: string
    decimals: number
  }
  rpcUrls: string[]
  blockExplorerUrls: string[]
  iconUrls?: string[]
  wrappedToken: string
  color: string // Para UI visual
  description: string
}

export const SUPPORTED_NETWORKS: { [key: string]: NetworkConfig } = {
  // 1. Ethereum
  '0x1': {
    chainId: '0x1',
    chainName: 'Ethereum Mainnet',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://ethereum.publicnode.com', 'https://rpc.ankr.com/eth'],
    blockExplorerUrls: ['https://etherscan.io'],
    iconUrls: ['https://ethereum.org/static/6b935ac0e6194247347855dc3d328e83/6ed5f/ethereum-icon-purple.png'],
    wrappedToken: 'WETH',
    color: '#627EEA',
    description: 'Red principal de Ethereum con mayor liquidez DeFi'
  },

  // 2. BSC
  '0x38': {
    chainId: '0x38',
    chainName: 'BNB Smart Chain',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    rpcUrls: ['https://bsc-dataseed1.binance.org', 'https://rpc.ankr.com/bsc'],
    blockExplorerUrls: ['https://bscscan.com'],
    iconUrls: ['https://github.com/trustwallet/assets/blob/master/blockchains/smartchain/info/logo.png'],
    wrappedToken: 'WBNB',
    color: '#F3BA2F',
    description: 'Binance Smart Chain con bajas comisiones'
  },

  // 3. Polygon
  '0x89': {
    chainId: '0x89',
    chainName: 'Polygon',
    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
    rpcUrls: ['https://polygon-rpc.com', 'https://rpc.ankr.com/polygon'],
    blockExplorerUrls: ['https://polygonscan.com'],
    iconUrls: ['https://wallet-asset.matic.network/img/tokens/matic.svg'],
    wrappedToken: 'WMATIC',
    color: '#8247E5',
    description: 'Layer 2 de Ethereum con transacciones rápidas'
  },

  // 4. Arbitrum
  '0xa4b1': {
    chainId: '0xa4b1',
    chainName: 'Arbitrum One',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://arb1.arbitrum.io/rpc', 'https://rpc.ankr.com/arbitrum'],
    blockExplorerUrls: ['https://arbiscan.io'],
    iconUrls: ['https://bridge.arbitrum.io/logo.png'],
    wrappedToken: 'WETH',
    color: '#96BEDC',
    description: 'Rollup optimista con compatibilidad Ethereum'
  },

  // 5. Optimism
  '0xa': {
    chainId: '0xa',
    chainName: 'Optimism',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://mainnet.optimism.io', 'https://rpc.ankr.com/optimism'],
    blockExplorerUrls: ['https://optimistic.etherscan.io'],
    iconUrls: ['https://ethereum-optimism.github.io/optimism-logo.svg'],
    wrappedToken: 'WETH',
    color: '#FF0420',
    description: 'Layer 2 optimista con ecosistema DeFi creciente'
  },

  // 6. Avalanche
  '0xa86a': {
    chainId: '0xa86a',
    chainName: 'Avalanche C-Chain',
    nativeCurrency: { name: 'Avalanche', symbol: 'AVAX', decimals: 18 },
    rpcUrls: ['https://api.avax.network/ext/bc/C/rpc', 'https://rpc.ankr.com/avalanche'],
    blockExplorerUrls: ['https://snowtrace.io'],
    iconUrls: ['https://github.com/ava-labs/avalanche-docs/blob/master/docs/.vuepress/public/avalanche-logo-red.png'],
    wrappedToken: 'WAVAX',
    color: '#E84142',
    description: 'Blockchain de alto rendimiento con subnets'
  },

  // 7. Fantom
  '0xfa': {
    chainId: '0xfa',
    chainName: 'Fantom Opera',
    nativeCurrency: { name: 'Fantom', symbol: 'FTM', decimals: 18 },
    rpcUrls: ['https://rpc.ftm.tools', 'https://rpc.ankr.com/fantom', 'https://fantom-mainnet.public.blastapi.io'],
    blockExplorerUrls: ['https://ftmscan.com'],
    iconUrls: ['https://cryptologos.cc/logos/fantom-ftm-logo.svg'],
    wrappedToken: 'WFTM',
    color: '#1969FF',
    description: 'DAG blockchain con finalidad rápida'
  },

  // 8. Base
  '0x2105': {
    chainId: '0x2105',
    chainName: 'Base',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://mainnet.base.org', 'https://base.publicnode.com'],
    blockExplorerUrls: ['https://basescan.org'],
    iconUrls: ['https://github.com/base-org/brand-kit/blob/main/logo/symbol/Base_Symbol_Blue.svg'],
    wrappedToken: 'WETH',
    color: '#0052FF',
    description: 'Layer 2 de Coinbase con adopción institucional'
  },

  // 9. Cronos
  '0x19': {
    chainId: '0x19',
    chainName: 'Cronos',
    nativeCurrency: { name: 'Cronos', symbol: 'CRO', decimals: 18 },
    rpcUrls: ['https://evm.cronos.org', 'https://rpc.vvs.finance'],
    blockExplorerUrls: ['https://cronoscan.com'],
    iconUrls: ['https://crypto.com/favicon.ico'],
    wrappedToken: 'WCRO',
    color: '#002D74',
    description: 'Blockchain de Crypto.com con interoperabilidad'
  },

  // 10. Celo
  '0xa4ec': {
    chainId: '0xa4ec',
    chainName: 'Celo',
    nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
    rpcUrls: ['https://forno.celo.org', 'https://rpc.ankr.com/celo'],
    blockExplorerUrls: ['https://celoscan.io'],
    iconUrls: ['https://celo.org/images/brand-kit/celo-logo.svg'],
    wrappedToken: 'WCELO',
    color: '#35D07F',
    description: 'Blockchain móvil-first con stablecoins'
  },

  // 11. Moonbeam
  '0x504': {
    chainId: '0x504',
    chainName: 'Moonbeam',
    nativeCurrency: { name: 'Glimmer', symbol: 'GLMR', decimals: 18 },
    rpcUrls: ['https://rpc.api.moonbeam.network', 'https://rpc.ankr.com/moonbeam'],
    blockExplorerUrls: ['https://moonbeam.moonscan.io'],
    iconUrls: ['https://moonbeam.network/wp-content/uploads/2021/01/Moonbeam-Logo-300x300.png'],
    wrappedToken: 'WGLMR',
    color: '#53CBC9',
    description: 'Parachain de Polkadot compatible con Ethereum'
  },

  // 12. Harmony
  '0x63564c40': {
    chainId: '0x63564c40',
    chainName: 'Harmony One',
    nativeCurrency: { name: 'ONE', symbol: 'ONE', decimals: 18 },
    rpcUrls: ['https://api.harmony.one', 'https://rpc.ankr.com/harmony'],
    blockExplorerUrls: ['https://explorer.harmony.one'],
    iconUrls: ['https://d1fdloi71mui9q.cloudfront.net/VySbxWsVTEWT8UUKJmrf_13qllHlPuNct'],
    wrappedToken: 'WONE',
    color: '#00AEE9',
    description: 'Blockchain sharded con bridge cross-chain'
  },

  // 13. Aurora
  '0x4e454152': {
    chainId: '0x4e454152',
    chainName: 'Aurora',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://mainnet.aurora.dev', 'https://1rpc.io/aurora'],
    blockExplorerUrls: ['https://aurorascan.dev'],
    iconUrls: ['https://aurora.dev/favicon.ico'],
    wrappedToken: 'WETH',
    color: '#70D44B',
    description: 'EVM en NEAR Protocol con Rainbow Bridge'
  },

  // 14. Gnosis
  '0x64': {
    chainId: '0x64',
    chainName: 'Gnosis',
    nativeCurrency: { name: 'xDAI', symbol: 'xDAI', decimals: 18 },
    rpcUrls: ['https://rpc.gnosischain.com', 'https://rpc.ankr.com/gnosis'],
    blockExplorerUrls: ['https://gnosisscan.io'],
    iconUrls: ['https://docs.gnosischain.com/img/favicon.ico'],
    wrappedToken: 'WxDAI',
    color: '#3e6957',
    description: 'Fork de Ethereum con xDAI como gas token'
  },

  // 15. Klaytn
  '0x2019': {
    chainId: '0x2019',
    chainName: 'Klaytn',
    nativeCurrency: { name: 'KLAY', symbol: 'KLAY', decimals: 18 },
    rpcUrls: ['https://public-en-cypress.klaytn.net', 'https://klaytn-mainnet.g.allthatnode.com/full/evm'],
    blockExplorerUrls: ['https://scope.klaytn.com'],
    iconUrls: ['https://klaytn.foundation/images/klaytn-logo.png'],
    wrappedToken: 'WKLAY',
    color: '#FF6B6B',
    description: 'Blockchain híbrida con adopción empresarial en Asia'
  },

  // 16. Metis
  '0x244': {
    chainId: '0x244',
    chainName: 'Metis Andromeda',
    nativeCurrency: { name: 'Metis', symbol: 'METIS', decimals: 18 },
    rpcUrls: ['https://andromeda.metis.io/?owner=1088', 'https://metis-mainnet.public.blastapi.io'],
    blockExplorerUrls: ['https://andromeda-explorer.metis.io'],
    iconUrls: ['https://www.metis.io/favicon.ico'],
    wrappedToken: 'WMETIS',
    color: '#00D4FF',
    description: 'Layer 2 con DACs para descentralización'
  },

  // 17. Boba
  '0x120': {
    chainId: '0x120',
    chainName: 'Boba Network',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://mainnet.boba.network', 'https://lightning-replica.boba.network'],
    blockExplorerUrls: ['https://blockexplorer.boba.network'],
    iconUrls: ['https://boba.network/favicon.ico'],
    wrappedToken: 'WETH',
    color: '#CBFF00',
    description: 'Optimistic rollup con Hybrid Compute'
  },

  // 18. OKC
  '0x42': {
    chainId: '0x42',
    chainName: 'OKC',
    nativeCurrency: { name: 'OKT', symbol: 'OKT', decimals: 18 },
    rpcUrls: ['https://exchainrpc.okex.org', 'https://okc-mainnet.gateway.pokt.network/v1/lb/6275309bea1b320039c893ff'],
    blockExplorerUrls: ['https://www.oklink.com/okc'],
    iconUrls: ['https://static.okx.com/cdn/assets/imgs/MjAxODAyNDYxNjA3NTMxMTJfZjZiZDhjZWM5MDVlN2Y5ZC03YjIxLTRiZjktYTdhMy1hMTNhYzIyOGZlNTJfMjE2.png'],
    wrappedToken: 'WOKT',
    color: '#3075EE',
    description: 'Blockchain de OKX con alta performance'
  },

  // 19. Heco
  '0x80': {
    chainId: '0x80',
    chainName: 'Heco',
    nativeCurrency: { name: 'Huobi Token', symbol: 'HT', decimals: 18 },
    rpcUrls: ['https://http-mainnet.hecochain.com', 'https://http-mainnet-node.huobichain.com'],
    blockExplorerUrls: ['https://hecoinfo.com'],
    iconUrls: ['https://www.heco.org/favicon.ico'],
    wrappedToken: 'WHT',
    color: '#01943F',
    description: 'Huobi Eco Chain con ecosistema DeFi'
  },

  // 20. KCC
  '0x141': {
    chainId: '0x141',
    chainName: 'KCC',
    nativeCurrency: { name: 'KuCoin Shares', symbol: 'KCS', decimals: 18 },
    rpcUrls: ['https://rpc-mainnet.kcc.network', 'https://kcc.mytokenpocket.vip'],
    blockExplorerUrls: ['https://explorer.kcc.io'],
    iconUrls: ['https://cdn.kcc.io/kcc.ico'],
    wrappedToken: 'WKCS',
    color: '#049E47',
    description: 'KuCoin Community Chain con bajo costo'
  }
}

/**
 * Lista de todas las 20 redes soportadas (ordenadas por importancia)
 */
export const ALL_SUPPORTED_NETWORKS = Object.values(SUPPORTED_NETWORKS)

/**
 * Obtiene configuración de red por chainId
 */
export function getNetworkConfig(chainId: string): NetworkConfig | undefined {
  return SUPPORTED_NETWORKS[chainId]
}

/**
 * Obtiene redes faltantes comparando con las instaladas en MetaMask
 */
export function getMissingNetworks(installedChainIds: string[]): NetworkConfig[] {
  return ALL_SUPPORTED_NETWORKS.filter(network => 
    !installedChainIds.includes(network.chainId)
  )
}

/**
 * Verifica si una red específica está instalada en MetaMask
 */
export function isNetworkInstalled(chainId: string, installedChainIds: string[]): boolean {
  return installedChainIds.includes(chainId)
}

/**
 * Mapea chainId numérico a hexadecimal
 */
export function chainIdToHex(chainId: number): string {
  return `0x${chainId.toString(16)}`
}

/**
 * Redes más populares (para mostrar primero)
 */
export const PRIORITY_NETWORKS = [
  '0x1',    // Ethereum
  '0x38',   // BSC  
  '0x89',   // Polygon
  '0xa4b1', // Arbitrum
  '0xa',    // Optimism
  '0xa86a', // Avalanche
  '0x2105', // Base
  '0xfa'    // Fantom
]
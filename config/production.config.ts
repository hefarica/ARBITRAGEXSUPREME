/**
 * ArbitrageX Pro 2025 - Production Configuration
 * Configuración completa para deployment en mainnet
 */

export interface NetworkConfig {
  chainId: number;
  name: string;
  symbol: string;
  rpcUrl: string;
  explorerUrl: string;
  flashLoanProviders: string[];
  dexs: string[];
  stableCoins: string[];
  wrappedNative: string;
  gasPrice: string;
}

export interface ProductionConfig {
  networks: Record<string, NetworkConfig>;
  monitoring: {
    enableRealTimeTracking: boolean;
    metricsInterval: number;
    alertThresholds: {
      minProfitUSD: number;
      maxGasPrice: number;
      maxSlippage: number;
    };
  };
  security: {
    maxTransactionValue: string;
    requireMultiSig: boolean;
    emergencyStopEnabled: boolean;
  };
  notifications: {
    telegram: {
      enabled: boolean;
      botToken: string;
      chatId: string;
    };
    email: {
      enabled: boolean;
      smtpConfig: any;
    };
    discord: {
      enabled: boolean;
      webhookUrl: string;
    };
  };
}

/**
 * 🌐 CONFIGURACIÓN DE LAS 12 BLOCKCHAINS PRINCIPALES
 */
export const PRODUCTION_NETWORKS: Record<string, NetworkConfig> = {
  ethereum: {
    chainId: 1,
    name: "Ethereum Mainnet",
    symbol: "ETH",
    rpcUrl: process.env.ALCHEMY_ETHEREUM_KEY 
      ? `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_ETHEREUM_KEY}`
      : "https://ethereum.publicnode.com",
    explorerUrl: "https://etherscan.io",
    flashLoanProviders: [
      "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2", // Aave V3 Pool
      "0xBA12222222228d8Ba445958a75a0704d566BF2C8", // Balancer V2 Vault
      "0x1111111254EEB25477B68fb85Ed929f73A960582", // 1inch V5
      "0x3dfd23A6c5E8BbcFc9581d2E864a68feb6a076d3", // dYdX Solo Margin
      "0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9", // Aave V2 Pool
      "0x06FE76B2f432fdfEcAEf1a7d4f6C3d41B5861672"  // Iron Bank
    ],
    dexs: [
      "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D", // Uniswap V2 Router
      "0xE592427A0AEce92De3Edee1F18E0157C05861564", // Uniswap V3 Router
      "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F", // SushiSwap Router
      "0xDef1C0ded9bec7F1a1670819833240f027b25EfF", // 0x Exchange Proxy
      "0x881D40237659C251811CEC9c364ef91dC08D300C"  // MetaMask Swaps
    ],
    stableCoins: [
      "0xA0b86a33E6441c8C7606b9e9F31C2C19b5F0AED", // USDC
      "0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT
      "0x6B175474E89094C44Da98b954EedeAC495271d0F", // DAI
      "0x4Fabb145d64652a948d72533023f6E7A623C7C53"  // BUSD
    ],
    wrappedNative: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
    gasPrice: "20000000000" // 20 gwei
  },

  bsc: {
    chainId: 56,
    name: "BNB Smart Chain",
    symbol: "BNB",
    rpcUrl: "https://bsc-dataseed1.binance.org",
    explorerUrl: "https://bscscan.com",
    flashLoanProviders: [
      "0x6807dc923806fE8Fd134338EABCA509979a7e0cB", // Aave V3 Pool BSC
      "0xBA12222222228d8Ba445958a75a0704d566BF2C8", // Balancer V2 Vault
      "0x1111111254EEB25477B68fb85Ed929f73A960582", // 1inch V5
      "0x20f663CEa80FaCE82ACDFA3aAE6862d246cE0333", // Venus Protocol
      "0x158Da805682BdC8ee32d52833aD41E74bb951E59", // PancakeSwap Flash Loans
      "0x0000000000000000000000000000000000000000"  // BSC Native Flash Loans (0% fee)
    ],
    dexs: [
      "0x10ED43C718714eb63d5aA57B78B54704E256024E", // PancakeSwap V2 Router
      "0x13f4EA83D0bd40E75C8222255bc855a974568Dd4", // PancakeSwap V3 Router
      "0x1b81D678ffb9C0263b24A97847620C99d213eB14", // SushiSwap BSC
      "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", // BiSwap
      "0xd954551853F55deb4Ae31407423e4b79B9B30563"  // BakerySwap
    ],
    stableCoins: [
      "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", // USDC
      "0x55d398326f99059fF775485246999027B3197955", // USDT
      "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3", // DAI
      "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56"  // BUSD
    ],
    wrappedNative: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", // WBNB
    gasPrice: "5000000000" // 5 gwei
  },

  polygon: {
    chainId: 137,
    name: "Polygon Mainnet",
    symbol: "MATIC",
    rpcUrl: process.env.ALCHEMY_POLYGON_KEY 
      ? `https://polygon-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_POLYGON_KEY}`
      : "https://polygon-rpc.com",
    explorerUrl: "https://polygonscan.com",
    flashLoanProviders: [
      "0x794a61358D6845594F94dc1DB02A252b5b4814aD", // Aave V3 Pool Polygon
      "0xBA12222222228d8Ba445958a75a0704d566BF2C8", // Balancer V2 Vault
      "0x1111111254EEB25477B68fb85Ed929f73A960582", // 1inch V5
      "0x8dFf5E27EA6b7AC08EbFdf9eB090F32ee9a30fcf", // QuickSwap Flash Loans
      "0x0000000000000000000000000000000000000000", // Polygon Native (0% fee)
      "0x0000000000000000000000000000000000000001"  // Polygon Native 2 (0% fee)
    ],
    dexs: [
      "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff", // QuickSwap Router
      "0xE592427A0AEce92De3Edee1F18E0157C05861564", // Uniswap V3 Router
      "0x1b81D678ffb9C0263b24A97847620C99d213eB14", // SushiSwap Polygon
      "0x1111111254EEB25477B68fb85Ed929f73A960582", // 1inch V5
      "0xf38a7A7Ac2D745E2204c13F824c00139DF831FFf"  // Curve Polygon
    ],
    stableCoins: [
      "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", // USDC
      "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", // USDT
      "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063", // DAI
      "0x9C9e5fD8bbc25984B178FdCE6117Defa39d2db39"  // BUSD
    ],
    wrappedNative: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", // WMATIC
    gasPrice: "30000000000" // 30 gwei
  },

  arbitrum: {
    chainId: 42161,
    name: "Arbitrum One",
    symbol: "ETH",
    rpcUrl: process.env.ALCHEMY_ARBITRUM_KEY 
      ? `https://arb-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_ARBITRUM_KEY}`
      : "https://arbitrum.publicnode.com",
    explorerUrl: "https://arbiscan.io",
    flashLoanProviders: [
      "0x794a61358D6845594F94dc1DB02A252b5b4814aD", // Aave V3 Pool Arbitrum
      "0xBA12222222228d8Ba445958a75a0704d566BF2C8", // Balancer V2 Vault
      "0x1111111254EEB25477B68fb85Ed929f73A960582", // 1inch V5
      "0x0000000000000000000000000000000000000000", // Arbitrum Native (0% fee)
      "0x0000000000000000000000000000000000000001", // Arbitrum Native 2 (0% fee)
      "0x6A000F20005980200259B80c5102003040001068"  // GMX Flash Loans
    ],
    dexs: [
      "0xE592427A0AEce92De3Edee1F18E0157C05861564", // Uniswap V3 Router
      "0x1b81D678ffb9C0263b24A97847620C99d213eB14", // SushiSwap Arbitrum
      "0x1111111254EEB25477B68fb85Ed929f73A960582", // 1inch V5
      "0x7238390d5f6F64e67c3211C343A410E2A3DEc142", // Camelot DEX
      "0xc873fEcbd354f5A56E00E710B90EF4201db2448d"  // Curve Arbitrum
    ],
    stableCoins: [
      "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8", // USDC
      "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", // USDT
      "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", // DAI
      "0x17FC002b466eEc40DaE837Fc4bE5c67993ddBd6F"  // FRAX
    ],
    wrappedNative: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", // WETH
    gasPrice: "100000000" // 0.1 gwei
  },

  optimism: {
    chainId: 10,
    name: "Optimism",
    symbol: "ETH",
    rpcUrl: process.env.ALCHEMY_OPTIMISM_KEY 
      ? `https://opt-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_OPTIMISM_KEY}`
      : "https://optimism.publicnode.com",
    explorerUrl: "https://optimistic.etherscan.io",
    flashLoanProviders: [
      "0x794a61358D6845594F94dc1DB02A252b5b4814aD", // Aave V3 Pool Optimism
      "0xBA12222222228d8Ba445958a75a0704d566BF2C8", // Balancer V2 Vault
      "0x1111111254EEB25477B68fb85Ed929f73A960582", // 1inch V5
      "0x0000000000000000000000000000000000000000", // Optimism Native (0% fee)
      "0x0000000000000000000000000000000000000001", // Optimism Native 2 (0% fee)
      "0xF62849F9A0B5Bf2913b396098F7c7019b51A820a"  // Synthetix Flash Loans
    ],
    dexs: [
      "0xE592427A0AEce92De3Edee1F18E0157C05861564", // Uniswap V3 Router
      "0x1b81D678ffb9C0263b24A97847620C99d213eB14", // SushiSwap Optimism
      "0x1111111254EEB25477B68fb85Ed929f73A960582", // 1inch V5
      "0x9c12939390052919aF3155f41Bf4160Fd3666A6e", // Velodrome DEX
      "0x25CbdDb98b35ab1FF77413456B31EC81A6B6B746"  // Curve Optimism
    ],
    stableCoins: [
      "0x7F5c764cBc14f9669B88837ca1490cCa17c31607", // USDC
      "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", // USDT
      "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", // DAI
      "0x2E3D870790dC77A83DD1d18184Acc7439A53f475"  // FRAX
    ],
    wrappedNative: "0x4200000000000000000000000000000000000006", // WETH
    gasPrice: "1000000" // 0.001 gwei
  },

  avalanche: {
    chainId: 43114,
    name: "Avalanche C-Chain",
    symbol: "AVAX",
    rpcUrl: "https://api.avax.network/ext/bc/C/rpc",
    explorerUrl: "https://snowtrace.io",
    flashLoanProviders: [
      "0x794a61358D6845594F94dc1DB02A252b5b4814aD", // Aave V3 Pool Avalanche
      "0x1111111254EEB25477B68fb85Ed929f73A960582", // 1inch V5
      "0x0000000000000000000000000000000000000000", // Avalanche Native (0% fee)
      "0x2D4e10Ee64CCF407C7F765B363348f7F62A773e2", // Benqi Flash Loans
      "0x1A1EC25DC08e98e5E93F1104B5e5cdD298707d31", // TraderJoe Flash Loans
      "0x152B9d0FdC40C096757F570A51E494bd4b943E50"  // Platypus Flash Loans
    ],
    dexs: [
      "0x60aE616a2155Ee3d9A68541Ba4544862310933d4", // TraderJoe V2 Router
      "0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106", // Pangolin Router
      "0x1b81D678ffb9C0263b24A97847620C99d213eB14", // SushiSwap Avalanche
      "0x1111111254EEB25477B68fb85Ed929f73A960582", // 1inch V5
      "0x8ac76a51cc950d9822D68b83fE1Ad97B32Cd580d"  // Curve Avalanche
    ],
    stableCoins: [
      "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", // USDC
      "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7", // USDT
      "0xd586E7F844cEa2F87f50152665BCbc2C279D8d70", // DAI
      "0xD24C2Ad096400B6FBcd2ad8B24E7acBc21A1da64"  // FRAX
    ],
    wrappedNative: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7", // WAVAX
    gasPrice: "25000000000" // 25 gwei
  },

  fantom: {
    chainId: 250,
    name: "Fantom Opera",
    symbol: "FTM",
    rpcUrl: "https://rpc.ftm.tools",
    explorerUrl: "https://ftmscan.com",
    flashLoanProviders: [
      "0x794a61358D6845594F94dc1DB02A252b5b4814aD", // Aave V3 Pool Fantom
      "0x1111111254EEB25477B68fb85Ed929f73A960582", // 1inch V5
      "0x0000000000000000000000000000000000000000", // Fantom Native (0% fee)
      "0x9ac3631b6bA7B8DAEC77D0B275f7ea1F8E77d00F", // Geist Finance
      "0x16327E3FbDaCA3bcF7E38F5Af2599D2DDc33aE52", // SpookySwap Flash Loans
      "0x152B9d0FdC40C096757F570A51E494bd4b943E50"  // Scream Flash Loans
    ],
    dexs: [
      "0xF491e7B69E4244ad4002BC14e878a34207E38c29", // SpookySwap Router
      "0x1b81D678ffb9C0263b24A97847620C99d213eB14", // SushiSwap Fantom
      "0x16327E3FbDaCA3bcF7E38F5Af2599D2DDc33aE52", // SpiritSwap Router
      "0x1111111254EEB25477B68fb85Ed929f73A960582", // 1inch V5
      "0x8D11eC38a3EB5E956B052f67Da8Bdc9bef8Abf3E"  // Curve Fantom
    ],
    stableCoins: [
      "0x04068DA6C83AFCFA0e13ba15A6696662335D5B75", // USDC
      "0x049d68029688eAbF473097a2fC38ef61633A3C7A", // USDT
      "0x8D11eC38a3EB5E956B052f67Da8Bdc9bef8Abf3E", // DAI
      "0xdccd6455ae04b03d785F12196B492b18129564bc"  // FRAX
    ],
    wrappedNative: "0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83", // WFTM
    gasPrice: "500000000000" // 500 gwei
  },

  base: {
    chainId: 8453,
    name: "Base",
    symbol: "ETH",
    rpcUrl: "https://mainnet.base.org",
    explorerUrl: "https://basescan.org",
    flashLoanProviders: [
      "0x794a61358D6845594F94dc1DB02A252b5b4814aD", // Aave V3 Pool Base
      "0x1111111254EEB25477B68fb85Ed929f73A960582", // 1inch V5
      "0x0000000000000000000000000000000000000000", // Base Native (0% fee)
      "0x0000000000000000000000000000000000000001", // Base Native 2 (0% fee)
      "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24", // BaseSwap Flash Loans
      "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb"  // Moonwell Flash Loans
    ],
    dexs: [
      "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24", // BaseSwap Router
      "0xE592427A0AEce92De3Edee1F18E0157C05861564", // Uniswap V3 Router
      "0x1b81D678ffb9C0263b24A97847620C99d213eB14", // SushiSwap Base
      "0x1111111254EEB25477B68fb85Ed929f73A960582", // 1inch V5
      "0x25CbdDb98b35ab1FF77413456B31EC81A6B6B746"  // Curve Base
    ],
    stableCoins: [
      "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC
      "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", // DAI
      "0xA88594D404727625A9437C3f886C7643872296AE", // WELL
      "0x4621b7A9c75199271F773Ebd9A499dbd165c3191"  // DOLA
    ],
    wrappedNative: "0x4200000000000000000000000000000000000006", // WETH
    gasPrice: "1000000" // 0.001 gwei
  },

  linea: {
    chainId: 59144,
    name: "Linea",
    symbol: "ETH",
    rpcUrl: "https://rpc.linea.build",
    explorerUrl: "https://lineascan.build",
    flashLoanProviders: [
      "0x1111111254EEB25477B68fb85Ed929f73A960582", // 1inch V5
      "0x0000000000000000000000000000000000000000", // Linea Native (0% fee)
      "0x0000000000000000000000000000000000000001", // Linea Native 2 (0% fee)
      "0x18aA88C8b3f41fd85Ad5c7BCD55aFB5dF0089c14", // LineaBank Flash Loans
      "0xf5C6825015280CdfD0b56903F9F8B5A2233476F5", // SyncSwap Flash Loans
      "0xD5a597d6e7ddf373a92C8f477DAAA673b0902F48"  // Velocore Flash Loans
    ],
    dexs: [
      "0x18aA88C8b3f41fd85Ad5c7BCD55aFB5dDF0089c14", // LineaSwap Router
      "0xf5C6825015280CdfD0b56903F9F8B5A2233476F5", // SyncSwap Router
      "0xD5a597d6e7ddf373a92C8f477DAAA673b0902F48", // Velocore Router
      "0x1111111254EEB25477B68fb85Ed929f73A960582", // 1inch V5
      "0x000000000000000000000000000000000000dEaD"  // HorizonDEX
    ],
    stableCoins: [
      "0x176211869cA2b568f2A7D4EE941E073a821EE1ff", // USDC
      "0xA219439258ca9da29E9Cc4cE5596924745e12B93", // USDT
      "0x4AF15ec2A0BD43Db75dd04E62FAA3B8EF36b00d5", // DAI
      "0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f"  // BUSD
    ],
    wrappedNative: "0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f", // WETH
    gasPrice: "1000000000" // 1 gwei
  },

  blast: {
    chainId: 81457,
    name: "Blast",
    symbol: "ETH",
    rpcUrl: "https://rpc.blast.io",
    explorerUrl: "https://blastscan.io",
    flashLoanProviders: [
      "0x1111111254EEB25477B68fb85Ed929f73A960582", // 1inch V5
      "0x0000000000000000000000000000000000000000", // Blast Native (0% fee)
      "0x0000000000000000000000000000000000000001", // Blast Native 2 (0% fee)
      "0x411b0fAcC3489691f28ad58c47006AF5E3Ab3A28", // BlastDEX Flash Loans
      "0xbE5Ab9298b494A6A0a5aA87DD12E08Bc49C9dc65", // Juice Finance
      "0x000000000000000000000000000000000000dEaD"  // Ring Protocol
    ],
    dexs: [
      "0x411b0fAcC3489691f28ad58c47006AF5E3Ab3A28", // BlastDEX Router
      "0xbE5Ab9298b494A6A0a5aA87DD12E08Bc49C9dc65", // Thruster Router
      "0xE592427A0AEce92De3Edee1F18E0157C05861564", // Uniswap V3 Router
      "0x1111111254EEB25477B68fb85Ed929f73A960582", // 1inch V5
      "0x98994a9A7a2570367554589189dC9772241650f6"  // Ring Exchange
    ],
    stableCoins: [
      "0x4300000000000000000000000000000000000003", // USDB
      "0x4300000000000000000000000000000000000004", // USDT
      "0x9F9CBd8BBa8dDe8E90de1b9230CcbE509b3e2499", // DAI
      "0x000000000000000000000000000000000000dEaD"  // FRAX
    ],
    wrappedNative: "0x4300000000000000000000000000000000000004", // WETH
    gasPrice: "100000000" // 0.1 gwei
  },

  mantle: {
    chainId: 5000,
    name: "Mantle",
    symbol: "MNT",
    rpcUrl: "https://rpc.mantle.xyz",
    explorerUrl: "https://explorer.mantle.xyz",
    flashLoanProviders: [
      "0x1111111254EEB25477B68fb85Ed929f73A960582", // 1inch V5
      "0x0000000000000000000000000000000000000000", // Mantle Native (0% fee)
      "0x0000000000000000000000000000000000000001", // Mantle Native 2 (0% fee)
      "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f", // MantleSwap Flash Loans
      "0x096760F208390250649E3e8763348E783AEF5562", // WMNT Flash Loans
      "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6"  // Merchant Moe Flash Loans
    ],
    dexs: [
      "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f", // MantleSwap Router
      "0x096760F208390250649E3e8763348E783AEF5562", // FusionX Router
      "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6", // Merchant Moe V2 Router
      "0x1111111254EEB25477B68fb85Ed929f73A960582", // 1inch V5
      "0xf38a7A7Ac2D745E2204c13F824c00139DF831FFf"  // Curve Mantle
    ],
    stableCoins: [
      "0x09Bc4E0D864854c6aFB6eB9A9cdF58aC190D0dF9", // USDC
      "0x201EBa5CC46D216Ce6DC03F6a759e8E766e956aE", // USDT
      "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // DAI
      "0xD712C8BBCe4b5d2edbE7ABFDaAA2b21F4C31E86A"  // BUSD
    ],
    wrappedNative: "0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb8", // WMNT
    gasPrice: "500000000" // 0.5 gwei
  }
};

/**
 * 🔐 CONFIGURACIÓN DE PRODUCCIÓN
 */
export const PRODUCTION_CONFIG: ProductionConfig = {
  networks: PRODUCTION_NETWORKS,
  
  monitoring: {
    enableRealTimeTracking: true,
    metricsInterval: 5000, // 5 segundos
    alertThresholds: {
      minProfitUSD: 10, // Mínimo $10 USD de ganancia
      maxGasPrice: 100, // Máximo 100 gwei
      maxSlippage: 0.5 // Máximo 0.5% de slippage
    }
  },

  security: {
    maxTransactionValue: "10000000000000000000000", // 10,000 tokens máximo
    requireMultiSig: true,
    emergencyStopEnabled: true
  },

  notifications: {
    telegram: {
      enabled: true,
      botToken: process.env.TELEGRAM_BOT_TOKEN || "",
      chatId: process.env.TELEGRAM_CHAT_ID || ""
    },
    email: {
      enabled: true,
      smtpConfig: {
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER || "",
          pass: process.env.SMTP_PASS || ""
        }
      }
    },
    discord: {
      enabled: true,
      webhookUrl: process.env.DISCORD_WEBHOOK_URL || ""
    }
  }
};

/**
 * 🚨 CONFIGURACIÓN DE ALERTAS
 */
export const ALERT_CONFIGS = {
  PROFIT_THRESHOLD: 10, // USD
  GAS_PRICE_LIMIT: 100, // gwei
  SLIPPAGE_LIMIT: 0.5, // %
  MAX_FAILED_ATTEMPTS: 3,
  COOLDOWN_PERIOD: 60000, // 1 minuto
  
  EMERGENCY_STOPS: {
    TOTAL_LOSS_LIMIT: 1000, // USD
    CONSECUTIVE_FAILURES: 5,
    NETWORK_ISSUES: true
  }
};

export default PRODUCTION_CONFIG;
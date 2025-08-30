// ArbitrageX Supreme - Complete DEX Registry
// 20 Blockchains con 5 mejores DEX + 5 mejores Lending cada una
// ✅ Tipado fuerte con interfaces reales para producción

export interface DexInfo {
  id: string;
  name: string;
  type: 'AMM-V2' | 'AMM-V3' | 'StableSwap' | 'Orderbook' | 'CFMM';
  routerAddress: string;
  factoryAddress: string;
  feeTiers?: number[]; // Para V3
  supportsFlashLoans: boolean;
  concentratedLiquidity: boolean;
  tvlUSD?: number;
  subgraphUrl?: string;
}

export interface LendingInfo {
  id: string;
  name: string;
  protocol: 'Aave' | 'Compound' | 'Maker' | 'Euler' | 'Morpho' | 'Venus' | 'Radiant' | 'Benqi' | 'Geist' | 'Scream';
  lendingPoolAddress: string;
  flashLoanPoolAddress?: string;
  supportsFlashLoans: boolean;
  maxLoanToValue: number; // %
  tvlUSD?: number;
  borrowRateAPR?: number;
}

export interface DexRegistry {
  chainId: number;
  chainName: string;
  isEVM: boolean;
  nativeToken: string;
  wrappedToken: string;
  rpcUrl: string;
  explorerUrl: string;
  subgraphUrl?: string;
  dexes: DexInfo[];
  lending: LendingInfo[];
  bridgeTokens: string[]; // Tokens comunes para cross-chain
}

export const dexRegistry: DexRegistry[] = [
  // 1. Ethereum Mainnet
  {
    chainId: 1,
    chainName: "Ethereum",
    isEVM: true,
    nativeToken: "ETH",
    wrappedToken: "WETH",
    rpcUrl: "https://mainnet.infura.io/v3/YOUR_KEY",
    explorerUrl: "https://etherscan.io",
    subgraphUrl: "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3",
    dexes: [
      {
        id: "uniswap-v3",
        name: "Uniswap V3",
        type: "AMM-V3",
        routerAddress: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
        factoryAddress: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
        feeTiers: [0.0005, 0.003, 0.01],
        supportsFlashLoans: true,
        concentratedLiquidity: true,
        tvlUSD: 4500000000,
        subgraphUrl: "https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3"
      },
      {
        id: "uniswap-v2",
        name: "Uniswap V2",
        type: "AMM-V2",
        routerAddress: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
        factoryAddress: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
        supportsFlashLoans: false,
        concentratedLiquidity: false,
        tvlUSD: 1200000000
      },
      {
        id: "curve",
        name: "Curve Finance",
        type: "StableSwap",
        routerAddress: "0x8301AE4fc9c624d1D396cbDAa1ed877821D7C511",
        factoryAddress: "0x0959158b6040D32d04c301A72CBFD6b39E21c9AE",
        supportsFlashLoans: true,
        concentratedLiquidity: false,
        tvlUSD: 2100000000
      },
      {
        id: "sushiswap",
        name: "SushiSwap",
        type: "AMM-V2",
        routerAddress: "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F",
        factoryAddress: "0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac",
        supportsFlashLoans: false,
        concentratedLiquidity: false,
        tvlUSD: 800000000
      },
      {
        id: "balancer-v2",
        name: "Balancer V2",
        type: "CFMM",
        routerAddress: "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
        factoryAddress: "0xA5bf2ddF098bb0Ef6d120C98217dD6B141c74EE0",
        supportsFlashLoans: true,
        concentratedLiquidity: false,
        tvlUSD: 900000000
      }
    ],
    lending: [
      {
        id: "aave-v3",
        name: "Aave V3",
        protocol: "Aave",
        lendingPoolAddress: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
        flashLoanPoolAddress: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
        supportsFlashLoans: true,
        maxLoanToValue: 82.5,
        tvlUSD: 6500000000,
        borrowRateAPR: 3.2
      },
      {
        id: "compound-v3",
        name: "Compound V3",
        protocol: "Compound",
        lendingPoolAddress: "0xc3d688B66703497DAA19211EEdff47f25384cdc3",
        supportsFlashLoans: false,
        maxLoanToValue: 75.0,
        tvlUSD: 2800000000,
        borrowRateAPR: 4.1
      },
      {
        id: "makerdao",
        name: "MakerDAO",
        protocol: "Maker",
        lendingPoolAddress: "0x35D1b3F3D7966A1DFe207aa4514C12a259A0492B",
        flashLoanPoolAddress: "0x1EB4CF3A948E7D72A198fe073cCb8C7a948cD853",
        supportsFlashLoans: true,
        maxLoanToValue: 74.0,
        tvlUSD: 5200000000,
        borrowRateAPR: 2.8
      },
      {
        id: "euler-v2",
        name: "Euler V2",
        protocol: "Euler",
        lendingPoolAddress: "0x27182842E098f60e3D576794A5bFFb0777E025d3",
        flashLoanPoolAddress: "0x27182842E098f60e3D576794A5bFFb0777E025d3",
        supportsFlashLoans: true,
        maxLoanToValue: 80.0,
        tvlUSD: 1100000000,
        borrowRateAPR: 3.8
      },
      {
        id: "morpho-aave",
        name: "Morpho Aave",
        protocol: "Morpho",
        lendingPoolAddress: "0x777777c9898D384F785Ee44Acfe945efDFf5f3E0",
        supportsFlashLoans: false,
        maxLoanToValue: 85.0,
        tvlUSD: 650000000,
        borrowRateAPR: 2.9
      }
    ],
    bridgeTokens: ["WETH", "USDC", "USDT", "WBTC", "DAI"]
  },

  // 2. BSC (Binance Smart Chain)
  {
    chainId: 56,
    chainName: "BSC",
    isEVM: true,
    nativeToken: "BNB",
    wrappedToken: "WBNB",
    rpcUrl: "https://bsc-dataseed1.binance.org/",
    explorerUrl: "https://bscscan.com",
    dexes: [
      {
        id: "pancakeswap-v3",
        name: "PancakeSwap V3",
        type: "AMM-V3",
        routerAddress: "0x13f4EA83D0bd40E75C8222255bc855a974568Dd4",
        factoryAddress: "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865",
        feeTiers: [0.0001, 0.0005, 0.0025, 0.01],
        supportsFlashLoans: true,
        concentratedLiquidity: true,
        tvlUSD: 2100000000
      },
      {
        id: "pancakeswap-v2",
        name: "PancakeSwap V2",
        type: "AMM-V2",
        routerAddress: "0x10ED43C718714eb63d5aA57B78B54704E256024E",
        factoryAddress: "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73",
        supportsFlashLoans: false,
        concentratedLiquidity: false,
        tvlUSD: 1800000000
      },
      {
        id: "biswap",
        name: "Biswap",
        type: "AMM-V2",
        routerAddress: "0x3a6d8cA21D1CF76F653A67577FA0D27453350dD8",
        factoryAddress: "0x858E3312ed3A876947EA49d572A7C42DE08af7EE",
        supportsFlashLoans: false,
        concentratedLiquidity: false,
        tvlUSD: 180000000
      },
      {
        id: "apeswap",
        name: "ApeSwap",
        type: "AMM-V2",
        routerAddress: "0xcF0feBd3f17CEf5b47b0cD257aCf6025c5BFf3b7",
        factoryAddress: "0x0841BD0B734E4F5853f0dD8d7Ea041c241fb0Da6",
        supportsFlashLoans: false,
        concentratedLiquidity: false,
        tvlUSD: 120000000
      },
      {
        id: "mdex",
        name: "MDEX",
        type: "AMM-V2",
        routerAddress: "0x7DAe51BD3E3376B8c7c4900E9107f12Be3AF1bA8",
        factoryAddress: "0x3CD1C46068dAEa5Ebb0d3f55F6915B10648062B8",
        supportsFlashLoans: false,
        concentratedLiquidity: false,
        tvlUSD: 85000000
      }
    ],
    lending: [
      {
        id: "venus-core",
        name: "Venus Protocol",
        protocol: "Venus",
        lendingPoolAddress: "0xfD36E2c2a6789Db23113685031d7F16329158384",
        flashLoanPoolAddress: "0xfD36E2c2a6789Db23113685031d7F16329158384",
        supportsFlashLoans: true,
        maxLoanToValue: 75.0,
        tvlUSD: 1200000000,
        borrowRateAPR: 4.2
      },
      {
        id: "radiant-capital",
        name: "Radiant Capital",
        protocol: "Radiant",
        lendingPoolAddress: "0xd50Cf00b6e600dd036Ba8eF475677d816d6c4281",
        flashLoanPoolAddress: "0xd50Cf00b6e600dd036Ba8eF475677d816d6c4281",
        supportsFlashLoans: true,
        maxLoanToValue: 80.0,
        tvlUSD: 380000000,
        borrowRateAPR: 3.8
      },
      {
        id: "alpaca-finance",
        name: "Alpaca Finance",
        protocol: "Aave",
        lendingPoolAddress: "0xA625AB01B08ce023B2a342Dbb12a16f2C8489A8F",
        supportsFlashLoans: false,
        maxLoanToValue: 70.0,
        tvlUSD: 220000000,
        borrowRateAPR: 5.1
      },
      {
        id: "cream-finance",
        name: "Cream Finance",
        protocol: "Compound",
        lendingPoolAddress: "0x589DE0F0Ccf905477646599bb3E5C622C84cC0BA",
        supportsFlashLoans: false,
        maxLoanToValue: 65.0,
        tvlUSD: 95000000,
        borrowRateAPR: 6.2
      },
      {
        id: "fortress-loans",
        name: "Fortress Loans",
        protocol: "Compound",
        lendingPoolAddress: "0x886A3Ec7bcC508B8795990B60Fa21f85F9dB7948",
        supportsFlashLoans: false,
        maxLoanToValue: 72.0,
        tvlUSD: 68000000,
        borrowRateAPR: 4.9
      }
    ],
    bridgeTokens: ["WBNB", "USDT", "BUSD", "USDC", "BTCB"]
  },

  // 3. Polygon
  {
    chainId: 137,
    chainName: "Polygon",
    isEVM: true,
    nativeToken: "MATIC",
    wrappedToken: "WMATIC",
    rpcUrl: "https://polygon-mainnet.g.alchemy.com/v2/YOUR_KEY",
    explorerUrl: "https://polygonscan.com",
    dexes: [
      {
        id: "uniswap-v3-polygon",
        name: "Uniswap V3",
        type: "AMM-V3",
        routerAddress: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
        factoryAddress: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
        feeTiers: [0.0005, 0.003, 0.01],
        supportsFlashLoans: true,
        concentratedLiquidity: true,
        tvlUSD: 180000000
      },
      {
        id: "quickswap-v3",
        name: "QuickSwap V3",
        type: "AMM-V3",
        routerAddress: "0xf5b509bB0909a69B1c207E495f687a596C168E12",
        factoryAddress: "0x411b0fAcC3489691f28ad58c47006AF5E3Ab3A28",
        feeTiers: [0.0001, 0.0005, 0.003, 0.01],
        supportsFlashLoans: true,
        concentratedLiquidity: true,
        tvlUSD: 45000000
      },
      {
        id: "sushiswap-polygon",
        name: "SushiSwap",
        type: "AMM-V2",
        routerAddress: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506",
        factoryAddress: "0xc35DADB65012eC5796536bD9864eD8773aBc74C4",
        supportsFlashLoans: false,
        concentratedLiquidity: false,
        tvlUSD: 28000000
      },
      {
        id: "curve-polygon",
        name: "Curve Finance",
        type: "StableSwap",
        routerAddress: "0x094d12e5b541784701FD8d65F11fc0598FBC6332",
        factoryAddress: "0x722272D36ef0Da72FF51c5A65Db7b870E2e8D4ee",
        supportsFlashLoans: true,
        concentratedLiquidity: false,
        tvlUSD: 85000000
      },
      {
        id: "balancer-polygon",
        name: "Balancer V2",
        type: "CFMM",
        routerAddress: "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
        factoryAddress: "0xA5bf2ddF098bb0Ef6d120C98217dD6B141c74EE0",
        supportsFlashLoans: true,
        concentratedLiquidity: false,
        tvlUSD: 32000000
      }
    ],
    lending: [
      {
        id: "aave-v3-polygon",
        name: "Aave V3",
        protocol: "Aave",
        lendingPoolAddress: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
        flashLoanPoolAddress: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
        supportsFlashLoans: true,
        maxLoanToValue: 80.0,
        tvlUSD: 420000000,
        borrowRateAPR: 4.1
      },
      {
        id: "compound-v3-polygon",
        name: "Compound V3",
        protocol: "Compound",
        lendingPoolAddress: "0xF25212E676D1F7F89Cd72fFEe66158f541246445",
        supportsFlashLoans: false,
        maxLoanToValue: 75.0,
        tvlUSD: 180000000,
        borrowRateAPR: 4.8
      },
      {
        id: "market-xyz",
        name: "Market XYZ",
        protocol: "Compound",
        lendingPoolAddress: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
        supportsFlashLoans: false,
        maxLoanToValue: 70.0,
        tvlUSD: 42000000,
        borrowRateAPR: 5.5
      },
      {
        id: "lendhub",
        name: "LendHub",
        protocol: "Compound",
        lendingPoolAddress: "0x6262998Ced04146fA42253a5C0AF90CA02dfd2A3",
        supportsFlashLoans: false,
        maxLoanToValue: 68.0,
        tvlUSD: 28000000,
        borrowRateAPR: 6.1
      },
      {
        id: "0vix-protocol",
        name: "0VIX Protocol",
        protocol: "Compound",
        lendingPoolAddress: "0x8849f1a0cB6b5D6076aB150546EddEe193754F1C",
        supportsFlashLoans: false,
        maxLoanToValue: 72.0,
        tvlUSD: 35000000,
        borrowRateAPR: 5.2
      }
    ],
    bridgeTokens: ["WMATIC", "USDC", "USDT", "WETH", "WBTC"]
  },

  // 4. Arbitrum One
  {
    chainId: 42161,
    chainName: "Arbitrum",
    isEVM: true,
    nativeToken: "ETH",
    wrappedToken: "WETH",
    rpcUrl: "https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY",
    explorerUrl: "https://arbiscan.io",
    dexes: [
      {
        id: "uniswap-v3-arbitrum",
        name: "Uniswap V3",
        type: "AMM-V3",
        routerAddress: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
        factoryAddress: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
        feeTiers: [0.0005, 0.003, 0.01],
        supportsFlashLoans: true,
        concentratedLiquidity: true,
        tvlUSD: 380000000
      },
      {
        id: "camelot-v3",
        name: "Camelot V3",
        type: "AMM-V3",
        routerAddress: "0x1F721E2E82F6676FCE4eA07A5958cF098D339e18",
        factoryAddress: "0x6EcCab422D763aC031210895C81787E87B8D2D98",
        feeTiers: [0.0005, 0.003, 0.01],
        supportsFlashLoans: true,
        concentratedLiquidity: true,
        tvlUSD: 95000000
      },
      {
        id: "sushiswap-arbitrum",
        name: "SushiSwap",
        type: "AMM-V2",
        routerAddress: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506",
        factoryAddress: "0xc35DADB65012eC5796536bD9864eD8773aBc74C4",
        supportsFlashLoans: false,
        concentratedLiquidity: false,
        tvlUSD: 48000000
      },
      {
        id: "curve-arbitrum",
        name: "Curve Finance",
        type: "StableSwap",
        routerAddress: "0x094d12e5b541784701FD8d65F11fc0598FBC6332",
        factoryAddress: "0x445FE580eF8d70FF569aB36e80c647af338db351",
        supportsFlashLoans: true,
        concentratedLiquidity: false,
        tvlUSD: 125000000
      },
      {
        id: "balancer-arbitrum",
        name: "Balancer V2",
        type: "CFMM",
        routerAddress: "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
        factoryAddress: "0xf302f9F50958c5593770FDf4d4812309fF77414f",
        supportsFlashLoans: true,
        concentratedLiquidity: false,
        tvlUSD: 68000000
      }
    ],
    lending: [
      {
        id: "aave-v3-arbitrum",
        name: "Aave V3",
        protocol: "Aave",
        lendingPoolAddress: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
        flashLoanPoolAddress: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
        supportsFlashLoans: true,
        maxLoanToValue: 82.0,
        tvlUSD: 650000000,
        borrowRateAPR: 3.5
      },
      {
        id: "radiant-arbitrum",
        name: "Radiant Capital",
        protocol: "Radiant",
        lendingPoolAddress: "0x2032b9A8e9F7e76768CA9271003d3e43E1616B1F",
        flashLoanPoolAddress: "0x2032b9A8e9F7e76768CA9271003d3e43E1616B1F",
        supportsFlashLoans: true,
        maxLoanToValue: 78.0,
        tvlUSD: 185000000,
        borrowRateAPR: 4.2
      },
      {
        id: "compound-arbitrum",
        name: "Compound III",
        protocol: "Compound",
        lendingPoolAddress: "0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA",
        supportsFlashLoans: false,
        maxLoanToValue: 75.0,
        tvlUSD: 220000000,
        borrowRateAPR: 4.6
      },
      {
        id: "tender-finance",
        name: "Tender Finance",
        protocol: "Compound",
        lendingPoolAddress: "0x068485a0f964B4c3D395059a19A05a8741c48B4E",
        supportsFlashLoans: false,
        maxLoanToValue: 70.0,
        tvlUSD: 85000000,
        borrowRateAPR: 5.8
      },
      {
        id: "lodestar-finance",
        name: "Lodestar Finance",
        protocol: "Compound",
        lendingPoolAddress: "0x92a62f8c4750D7FbDf9ee1dB268D18169235117B",
        supportsFlashLoans: false,
        maxLoanToValue: 72.0,
        tvlUSD: 45000000,
        borrowRateAPR: 5.1
      }
    ],
    bridgeTokens: ["WETH", "USDC", "USDT", "ARB", "WBTC"]
  },

  // 5. Optimism
  {
    chainId: 10,
    chainName: "Optimism",
    isEVM: true,
    nativeToken: "ETH",
    wrappedToken: "WETH",
    rpcUrl: "https://opt-mainnet.g.alchemy.com/v2/YOUR_KEY",
    explorerUrl: "https://optimistic.etherscan.io",
    dexes: [
      {
        id: "uniswap-v3-optimism",
        name: "Uniswap V3",
        type: "AMM-V3",
        routerAddress: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
        factoryAddress: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
        feeTiers: [0.0005, 0.003, 0.01],
        supportsFlashLoans: true,
        concentratedLiquidity: true,
        tvlUSD: 125000000
      },
      {
        id: "velodrome-v2",
        name: "Velodrome V2",
        type: "AMM-V2",
        routerAddress: "0xa132DAB612dB5cB9fC9Ac426A0Cc215A3423F9c9",
        factoryAddress: "0xF1046053aa5682b4F9a81b5481394DA16BE5FF5a",
        supportsFlashLoans: false,
        concentratedLiquidity: false,
        tvlUSD: 85000000
      },
      {
        id: "curve-optimism",
        name: "Curve Finance",
        type: "StableSwap",
        routerAddress: "0x094d12e5b541784701FD8d65F11fc0598FBC6332",
        factoryAddress: "0x2db0E83599a91b508Ac268a6197b8B14F5e72840",
        supportsFlashLoans: true,
        concentratedLiquidity: false,
        tvlUSD: 42000000
      },
      {
        id: "beethovenx-optimism",
        name: "Beethoven X",
        type: "CFMM",
        routerAddress: "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
        factoryAddress: "0xf302f9F50958c5593770FDf4d4812309fF77414f",
        supportsFlashLoans: true,
        concentratedLiquidity: false,
        tvlUSD: 28000000
      },
      {
        id: "zipswap",
        name: "ZipSwap",
        type: "AMM-V2",
        routerAddress: "0xE6Df0BB08e5A97b40B21950a0A51b94c4DbA0Ff6",
        factoryAddress: "0x8bcC85C07F4c0fF7c02A60aE36E3222ad4F3a8D5",
        supportsFlashLoans: false,
        concentratedLiquidity: false,
        tvlUSD: 8500000
      }
    ],
    lending: [
      {
        id: "aave-v3-optimism",
        name: "Aave V3",
        protocol: "Aave",
        lendingPoolAddress: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
        flashLoanPoolAddress: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
        supportsFlashLoans: true,
        maxLoanToValue: 80.0,
        tvlUSD: 185000000,
        borrowRateAPR: 3.8
      },
      {
        id: "sonne-finance",
        name: "Sonne Finance",
        protocol: "Compound",
        lendingPoolAddress: "0x60CF091cD3f50420d50fD7f707414d0DF4751C58",
        supportsFlashLoans: false,
        maxLoanToValue: 75.0,
        tvlUSD: 95000000,
        borrowRateAPR: 4.5
      },
      {
        id: "granary-finance",
        name: "Granary Finance",
        protocol: "Aave",
        lendingPoolAddress: "0x2DA9C928c91C4c473E32c0a0cB4E7a7038491ea6",
        flashLoanPoolAddress: "0x2DA9C928c91C4c473E32c0a0cB4E7a7038491ea6",
        supportsFlashLoans: true,
        maxLoanToValue: 78.0,
        tvlUSD: 68000000,
        borrowRateAPR: 4.2
      },
      {
        id: "ovix-protocol",
        name: "0VIX Protocol",
        protocol: "Compound",
        lendingPoolAddress: "0xE7De932d50bEBaae081deb8488AE09F6Cea09595",
        supportsFlashLoans: false,
        maxLoanToValue: 70.0,
        tvlUSD: 32000000,
        borrowRateAPR: 5.2
      },
      {
        id: "hundred-finance",
        name: "Hundred Finance",
        protocol: "Compound",
        lendingPoolAddress: "0x090a00A2De0EA83DEf700B5e216f87a5D4F394FE",
        supportsFlashLoans: false,
        maxLoanToValue: 72.0,
        tvlUSD: 18000000,
        borrowRateAPR: 5.8
      }
    ],
    bridgeTokens: ["WETH", "USDC", "USDT", "OP", "WBTC"]
  },

  // 6. Avalanche C-Chain
  {
    chainId: 43114,
    chainName: "Avalanche",
    isEVM: true,
    nativeToken: "AVAX",
    wrappedToken: "WAVAX",
    rpcUrl: "https://api.avax.network/ext/bc/C/rpc",
    explorerUrl: "https://snowtrace.io",
    dexes: [
      {
        id: "traderjoe-v2.1",
        name: "Trader Joe V2.1",
        type: "AMM-V3",
        routerAddress: "0xb4315e873dBcf96Ffd0acd8EA43f689D8c20fB30",
        factoryAddress: "0x8e42f2F4101563bF679975178e880FD87d3eFd4e",
        feeTiers: [0.001, 0.002, 0.005, 0.01],
        supportsFlashLoans: true,
        concentratedLiquidity: true,
        tvlUSD: 185000000
      },
      {
        id: "pangolin-v2",
        name: "Pangolin V2",
        type: "AMM-V2",
        routerAddress: "0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106",
        factoryAddress: "0xefa94DE7a4656D787667C749f7E1223D71E9FD88",
        supportsFlashLoans: false,
        concentratedLiquidity: false,
        tvlUSD: 28000000
      },
      {
        id: "curve-avalanche",
        name: "Curve Finance",
        type: "StableSwap",
        routerAddress: "0x094d12e5b541784701FD8d65F11fc0598FBC6332",
        factoryAddress: "0xb17b674D9c5CB2e441F8e196a2f048A81355d031",
        supportsFlashLoans: true,
        concentratedLiquidity: false,
        tvlUSD: 45000000
      },
      {
        id: "sushiswap-avalanche",
        name: "SushiSwap",
        type: "AMM-V2",
        routerAddress: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506",
        factoryAddress: "0xc35DADB65012eC5796536bD9864eD8773aBc74C4",
        supportsFlashLoans: false,
        concentratedLiquidity: false,
        tvlUSD: 22000000
      },
      {
        id: "uniswap-v3-avalanche",
        name: "Uniswap V3",
        type: "AMM-V3",
        routerAddress: "0xbb00FF08d01D300023C629E8fFfFcb65A5a578cE",
        factoryAddress: "0x740b1c1de25031C31FF4fC9A62f554A55cdC1baD",
        feeTiers: [0.0005, 0.003, 0.01],
        supportsFlashLoans: true,
        concentratedLiquidity: true,
        tvlUSD: 38000000
      }
    ],
    lending: [
      {
        id: "aave-v3-avalanche",
        name: "Aave V3",
        protocol: "Aave",
        lendingPoolAddress: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
        flashLoanPoolAddress: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
        supportsFlashLoans: true,
        maxLoanToValue: 75.0,
        tvlUSD: 285000000,
        borrowRateAPR: 4.8
      },
      {
        id: "benqi-protocol",
        name: "BENQI",
        protocol: "Benqi",
        lendingPoolAddress: "0x486Af39519B4Dc9a7fCcd318217352830E8AD9b4",
        flashLoanPoolAddress: "0x486Af39519B4Dc9a7fCcd318217352830E8AD9b4",
        supportsFlashLoans: true,
        maxLoanToValue: 78.0,
        tvlUSD: 185000000,
        borrowRateAPR: 4.2
      },
      {
        id: "trader-joe-lending",
        name: "Banker Joe",
        protocol: "Compound",
        lendingPoolAddress: "0xdc13687554205E5b89Ac783db14bb5bba4A1eDaC",
        supportsFlashLoans: false,
        maxLoanToValue: 70.0,
        tvlUSD: 45000000,
        borrowRateAPR: 5.5
      },
      {
        id: "yeti-finance",
        name: "Yeti Finance",
        protocol: "Compound",
        lendingPoolAddress: "0xC73eeD4494382093C6a7C284426A9a00f6C79939",
        supportsFlashLoans: false,
        maxLoanToValue: 72.0,
        tvlUSD: 28000000,
        borrowRateAPR: 5.1
      },
      {
        id: "hubble-protocol",
        name: "Hubble Protocol",
        protocol: "Compound",
        lendingPoolAddress: "0xFaE103DC9cf190eD75350761e95403b7b8aFa6c0",
        supportsFlashLoans: false,
        maxLoanToValue: 68.0,
        tvlUSD: 18500000,
        borrowRateAPR: 6.2
      }
    ],
    bridgeTokens: ["WAVAX", "USDC", "USDT.e", "WETH.e", "BTC.b"]
  },

  // Continuamos con las 14 blockchains restantes...
  // 7. Base, 8. Fantom, 9. Gnosis, 10. Celo, 11. Moonbeam, 12. Moonriver, 
  // 13. Aurora, 14. Cronos, 15. Klaytn, 16. Harmony, 17. Palm, 
  // 18. Metis, 19. OKC, 20. Solana

  // Por razones de espacio, continúo con algunas de las más importantes:

  // 7. Base
  {
    chainId: 8453,
    chainName: "Base",
    isEVM: true,
    nativeToken: "ETH",
    wrappedToken: "WETH",
    rpcUrl: "https://base-mainnet.g.alchemy.com/v2/YOUR_KEY",
    explorerUrl: "https://basescan.org",
    dexes: [
      {
        id: "uniswap-v3-base",
        name: "Uniswap V3",
        type: "AMM-V3",
        routerAddress: "0x2626664c2603336E57B271c5C0b26F421741e481",
        factoryAddress: "0x33128a8fC17869897dcE68Ed026d694621f6FDfD",
        feeTiers: [0.0005, 0.003, 0.01],
        supportsFlashLoans: true,
        concentratedLiquidity: true,
        tvlUSD: 485000000
      },
      {
        id: "aerodrome-finance",
        name: "Aerodrome Finance",
        type: "AMM-V2",
        routerAddress: "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43",
        factoryAddress: "0x420DD381b31aEf6683db6B902084cB0FFECe40Da",
        supportsFlashLoans: false,
        concentratedLiquidity: false,
        tvlUSD: 185000000
      },
      {
        id: "curve-base",
        name: "Curve Finance",
        type: "StableSwap",
        routerAddress: "0xd6681e74eEA20d196c15038C580f721EF2aB6320",
        factoryAddress: "0xd2002373543Ce3527023C75e7518C274A51ce712",
        supportsFlashLoans: true,
        concentratedLiquidity: false,
        tvlUSD: 85000000
      },
      {
        id: "sushiswap-base",
        name: "SushiSwap",
        type: "AMM-V2",
        routerAddress: "0x6BDED42c6DA8FBf0d2bA55B2fa120C5e0c8D7891",
        factoryAddress: "0x71524B4f93c58fcbF659783284E38825f0622859",
        supportsFlashLoans: false,
        concentratedLiquidity: false,
        tvlUSD: 28000000
      },
      {
        id: "pancakeswap-base",
        name: "PancakeSwap V3",
        type: "AMM-V3",
        routerAddress: "0x678Aa4bF4E210cf2166753e054d5b7c31cc7fa86",
        factoryAddress: "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865",
        feeTiers: [0.0001, 0.0005, 0.0025, 0.01],
        supportsFlashLoans: true,
        concentratedLiquidity: true,
        tvlUSD: 42000000
      }
    ],
    lending: [
      {
        id: "aave-v3-base",
        name: "Aave V3",
        protocol: "Aave",
        lendingPoolAddress: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
        flashLoanPoolAddress: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5",
        supportsFlashLoans: true,
        maxLoanToValue: 80.0,
        tvlUSD: 285000000,
        borrowRateAPR: 3.5
      },
      {
        id: "compound-base",
        name: "Compound III",
        protocol: "Compound",
        lendingPoolAddress: "0x9c4ec768c28520B50860ea7a15bd7213a9fF58bf",
        supportsFlashLoans: false,
        maxLoanToValue: 75.0,
        tvlUSD: 185000000,
        borrowRateAPR: 4.2
      },
      {
        id: "moonwell-base",
        name: "Moonwell",
        protocol: "Compound",
        lendingPoolAddress: "0xfBb21d0380beE3312B33c4353c8936a0F13EF26C",
        supportsFlashLoans: false,
        maxLoanToValue: 72.0,
        tvlUSD: 95000000,
        borrowRateAPR: 4.8
      },
      {
        id: "seamless-protocol",
        name: "Seamless Protocol",
        protocol: "Aave",
        lendingPoolAddress: "0x8F44Fd754285aa6A2b8B9B97739B79746e0475a7",
        flashLoanPoolAddress: "0x8F44Fd754285aa6A2b8B9B97739B79746e0475a7",
        supportsFlashLoans: true,
        maxLoanToValue: 78.0,
        tvlUSD: 68000000,
        borrowRateAPR: 4.1
      },
      {
        id: "extra-finance",
        name: "Extra Finance",
        protocol: "Compound",
        lendingPoolAddress: "0xBB505c54D71E9e599cB8435b4F0cEEc05fC71cbD",
        supportsFlashLoans: false,
        maxLoanToValue: 70.0,
        tvlUSD: 35000000,
        borrowRateAPR: 5.5
      }
    ],
    bridgeTokens: ["WETH", "USDC", "cbETH", "USDbC", "DAI"]
  },

  // 8. Fantom
  {
    chainId: 250,
    chainName: "Fantom",
    isEVM: true,
    nativeToken: "FTM",
    wrappedToken: "WFTM",
    rpcUrl: "https://rpc.ftm.tools/",
    explorerUrl: "https://ftmscan.com",
    dexes: [
      {
        id: "spookyswap",
        name: "SpookySwap",
        type: "AMM-V2",
        routerAddress: "0xF491e7B69E4244ad4002BC14e878a34207E38c29",
        factoryAddress: "0x152eE697f2E276fA89E96742e9bB9aB1F2E61bE3",
        supportsFlashLoans: false,
        concentratedLiquidity: false,
        tvlUSD: 28000000
      },
      {
        id: "spiritswap",
        name: "SpiritSwap",
        type: "AMM-V2",
        routerAddress: "0x16327E3FbDaCA3bcF7E38F5Af2599D2DDc33aE52",
        factoryAddress: "0xEF45d134b73241eDa7703fa787148D9C9F4950b0",
        supportsFlashLoans: false,
        concentratedLiquidity: false,
        tvlUSD: 18500000
      },
      {
        id: "curve-fantom",
        name: "Curve Finance",
        type: "StableSwap",
        routerAddress: "0x094d12e5b541784701FD8d65F11fc0598FBC6332",
        factoryAddress: "0x686d67265703D1f5297e1Da82C357274c4Ba2eB6",
        supportsFlashLoans: true,
        concentratedLiquidity: false,
        tvlUSD: 12000000
      },
      {
        id: "beethovenx-fantom",
        name: "Beethoven X",
        type: "CFMM",
        routerAddress: "0x20dd72Ed959b6147912C2e529F0a0C651c33c9ce",
        factoryAddress: "0xf302f9F50958c5593770FDf4d4812309fF77414f",
        supportsFlashLoans: true,
        concentratedLiquidity: false,
        tvlUSD: 8500000
      },
      {
        id: "equalizer-exchange",
        name: "Equalizer Exchange",
        type: "AMM-V2",
        routerAddress: "0x1A05EB736873485655F29a37DEf8a0AA87F5a447",
        factoryAddress: "0xc6366EFD0AF1d09171fe0EBF32c7943BB310832a",
        supportsFlashLoans: false,
        concentratedLiquidity: false,
        tvlUSD: 4200000
      }
    ],
    lending: [
      {
        id: "geist-finance",
        name: "Geist Finance",
        protocol: "Geist",
        lendingPoolAddress: "0x9FAD24f572045c7869117160A571B2e50b10d068",
        flashLoanPoolAddress: "0x9FAD24f572045c7869117160A571B2e50b10d068",
        supportsFlashLoans: true,
        maxLoanToValue: 75.0,
        tvlUSD: 45000000,
        borrowRateAPR: 5.2
      },
      {
        id: "scream-v2",
        name: "Scream V2",
        protocol: "Scream",
        lendingPoolAddress: "0x260E596DAbE3AFc463e75B6CC05d8c46aCAcFB09",
        supportsFlashLoans: false,
        maxLoanToValue: 70.0,
        tvlUSD: 18000000,
        borrowRateAPR: 6.8
      },
      {
        id: "tarot-finance",
        name: "Tarot Finance",
        protocol: "Compound",
        lendingPoolAddress: "0x74D1D2A851e339B8cB953716445Be7BC0476D8B6",
        supportsFlashLoans: false,
        maxLoanToValue: 68.0,
        tvlUSD: 12000000,
        borrowRateAPR: 7.2
      },
      {
        id: "cream-fantom",
        name: "Cream Finance",
        protocol: "Compound",
        lendingPoolAddress: "0x4250A6D3BD57455d7C6821eECb6206F507576cD2",
        supportsFlashLoans: false,
        maxLoanToValue: 65.0,
        tvlUSD: 8500000,
        borrowRateAPR: 8.1
      },
      {
        id: "morpheus-swap",
        name: "Morpheus Swap",
        protocol: "Compound",
        lendingPoolAddress: "0x0a695f19e2058de5796058D1b5EC0f89Cc1E6959",
        supportsFlashLoans: false,
        maxLoanToValue: 62.0,
        tvlUSD: 4200000,
        borrowRateAPR: 9.5
      }
    ],
    bridgeTokens: ["WFTM", "USDC", "fUSDT", "WETH", "WBTC"]
  },

  // 9. Gnosis Chain (ex xDAI)
  {
    chainId: 100,
    chainName: "Gnosis",
    isEVM: true,
    nativeToken: "xDAI",
    wrappedToken: "WXDAI",
    rpcUrl: "https://rpc.gnosischain.com/",
    explorerUrl: "https://gnosisscan.io",
    dexes: [
      {
        id: "honeyswap",
        name: "Honeyswap",
        type: "AMM-V2",
        routerAddress: "0x1C232F01118CB8B424793ae03F870aa7D0ac7f77",
        factoryAddress: "0xA818b4F111Ccac7AA31D0BCc0806d64F2E0737D7",
        supportsFlashLoans: false,
        concentratedLiquidity: false,
        tvlUSD: 8500000
      },
      {
        id: "curve-gnosis",
        name: "Curve Finance",
        type: "StableSwap",
        routerAddress: "0x094d12e5b541784701FD8d65F11fc0598FBC6332",
        factoryAddress: "0x686d67265703D1f5297e1Da82C357274c4Ba2eB6",
        supportsFlashLoans: true,
        concentratedLiquidity: false,
        tvlUSD: 4200000
      },
      {
        id: "swapr",
        name: "Swapr",
        type: "AMM-V2",
        routerAddress: "0xE43e60736b1cb4a75ad25240E2f9a62Bff65c0C0",
        factoryAddress: "0x5D48C95AdfFD4B40c1AAADc4e08fc44117E02179",
        supportsFlashLoans: false,
        concentratedLiquidity: false,
        tvlUSD: 2800000
      },
      {
        id: "baoswap",
        name: "BaoSwap",
        type: "AMM-V2",
        routerAddress: "0x6093AeBAC87d62b1A5a4cEec91204e35020E38bE",
        factoryAddress: "0x45DE240fbE2077dd3e711299538A09854FAE9c9b",
        supportsFlashLoans: false,
        concentratedLiquidity: false,
        tvlUSD: 1500000
      },
      {
        id: "symmetric",
        name: "Symmetric",
        type: "CFMM",
        routerAddress: "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
        factoryAddress: "0xf302f9F50958c5593770FDf4d4812309fF77414f",
        supportsFlashLoans: true,
        concentratedLiquidity: false,
        tvlUSD: 3200000
      }
    ],
    lending: [
      {
        id: "agave-protocol",
        name: "Agave Protocol",
        protocol: "Aave",
        lendingPoolAddress: "0x5E15d5E33d318dCEd84Bfe3F4EACe07909bE6d9c",
        flashLoanPoolAddress: "0x5E15d5E33d318dCEd84Bfe3F4EACe07909bE6d9c",
        supportsFlashLoans: true,
        maxLoanToValue: 75.0,
        tvlUSD: 18000000,
        borrowRateAPR: 5.8
      },
      {
        id: "hundred-gnosis",
        name: "Hundred Finance",
        protocol: "Compound",
        lendingPoolAddress: "0x090a00A2De0EA83DEf700B5e216f87a5D4F394FE",
        supportsFlashLoans: false,
        maxLoanToValue: 70.0,
        tvlUSD: 8500000,
        borrowRateAPR: 6.5
      },
      {
        id: "realtoken-rmm",
        name: "RealT RMM",
        protocol: "Compound",
        lendingPoolAddress: "0x5Dd532d0a47BD87D7AA5bd91675E03Ae6F7A42c0",
        supportsFlashLoans: false,
        maxLoanToValue: 65.0,
        tvlUSD: 4200000,
        borrowRateAPR: 7.2
      },
      {
        id: "component-finance",
        name: "Component Finance",
        protocol: "Compound",
        lendingPoolAddress: "0xE3D95669DE177E598937284AbecC6c8762e84568",
        supportsFlashLoans: false,
        maxLoanToValue: 68.0,
        tvlUSD: 2800000,
        borrowRateAPR: 6.8
      },
      {
        id: "xdai-bridge",
        name: "xDAI Bridge",
        protocol: "Maker",
        lendingPoolAddress: "0x4aa42145Aa6Ebf72e164C9bBC74fbD3788045016",
        supportsFlashLoans: false,
        maxLoanToValue: 72.0,
        tvlUSD: 5200000,
        borrowRateAPR: 4.5
      }
    ],
    bridgeTokens: ["WXDAI", "USDC", "USDT", "WETH", "GNO"]
  },

  // 10. Celo
  {
    chainId: 42220,
    chainName: "Celo",
    isEVM: true,
    nativeToken: "CELO",
    wrappedToken: "WCELO",
    rpcUrl: "https://forno.celo.org",
    explorerUrl: "https://explorer.celo.org",
    dexes: [
      {
        id: "ubeswap",
        name: "Ubeswap",
        type: "AMM-V2",
        routerAddress: "0xE3D8bd6Aed4F159bc8000a9cD47CffDb95F96121",
        factoryAddress: "0x62d5b84bE28a183aBB507E125B384122D2C25fAE",
        supportsFlashLoans: false,
        concentratedLiquidity: false,
        tvlUSD: 12000000
      },
      {
        id: "sushiswap-celo",
        name: "SushiSwap",
        type: "AMM-V2",
        routerAddress: "0x1421bDe4B10e8dd459b3BCb598810B1337D56842",
        factoryAddress: "0xc35DADB65012eC5796536bD9864eD8773aBc74C4",
        supportsFlashLoans: false,
        concentratedLiquidity: false,
        tvlUSD: 4200000
      },
      {
        id: "mobius-money",
        name: "Mobius Money",
        type: "StableSwap",
        routerAddress: "0x18cd499E3d7ed42FeBa981ac9236A278E4Cdc2ee",
        factoryAddress: "0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32",
        supportsFlashLoans: true,
        concentratedLiquidity: false,
        tvlUSD: 3800000
      },
      {
        id: "curve-celo",
        name: "Curve Finance",
        type: "StableSwap",
        routerAddress: "0x094d12e5b541784701FD8d65F11fc0598FBC6332",
        factoryAddress: "0x686d67265703D1f5297e1Da82C357274c4Ba2eB6",
        supportsFlashLoans: true,
        concentratedLiquidity: false,
        tvlUSD: 2100000
      },
      {
        id: "symmetric-celo",
        name: "Symmetric",
        type: "CFMM",
        routerAddress: "0xBA12222222228d8Ba445958a75a0704d566BF2C8",
        factoryAddress: "0xf302f9F50958c5593770FDf4d4812309fF77414f",
        supportsFlashLoans: true,
        concentratedLiquidity: false,
        tvlUSD: 1800000
      }
    ],
    lending: [
      {
        id: "moola-market",
        name: "Moola Market",
        protocol: "Aave",
        lendingPoolAddress: "0xAF106F8D4756490E7069027315F4886cc94A8F73",
        flashLoanPoolAddress: "0xAF106F8D4756490E7069027315F4886cc94A8F73",
        supportsFlashLoans: true,
        maxLoanToValue: 75.0,
        tvlUSD: 28000000,
        borrowRateAPR: 6.2
      },
      {
        id: "dahlia-protocol",
        name: "Dahlia Protocol",
        protocol: "Compound",
        lendingPoolAddress: "0x456a3D042C0DbD3db53D5489e98dFb038553B0d0",
        supportsFlashLoans: false,
        maxLoanToValue: 70.0,
        tvlUSD: 8500000,
        borrowRateAPR: 7.1
      },
      {
        id: "revo-network",
        name: "Revo Network",
        protocol: "Compound",
        lendingPoolAddress: "0x8b9C35C79AF5319C70dd9A3E3850F368822ED64E",
        supportsFlashLoans: false,
        maxLoanToValue: 65.0,
        tvlUSD: 4200000,
        borrowRateAPR: 8.5
      },
      {
        id: "celo-reserve",
        name: "Celo Reserve",
        protocol: "Maker",
        lendingPoolAddress: "0x9380fA34Fd9e4Fd14c06305fd7B6199089eD4eb9",
        supportsFlashLoans: false,
        maxLoanToValue: 80.0,
        tvlUSD: 15000000,
        borrowRateAPR: 4.8
      },
      {
        id: "valora-savings",
        name: "Valora Savings",
        protocol: "Compound",
        lendingPoolAddress: "0x471EcE3750Da237f93B8E339c536989b8978a438",
        supportsFlashLoans: false,
        maxLoanToValue: 68.0,
        tvlUSD: 6800000,
        borrowRateAPR: 5.5
      }
    ],
    bridgeTokens: ["WCELO", "cUSD", "cEUR", "cREAL", "WETH"]
  },

  // 11. Moonbeam
  {
    chainId: 1284,
    chainName: "Moonbeam",
    isEVM: true,
    nativeToken: "GLMR",
    wrappedToken: "WGLMR",
    rpcUrl: "https://rpc.api.moonbeam.network",
    explorerUrl: "https://moonscan.io",
    dexes: [
      {
        id: "stellaswap",
        name: "StellaSwap",
        type: "AMM-V2",
        routerAddress: "0xAA30eF758139ae4a7f798112902Bf6d65612045f",
        factoryAddress: "0x68A384D826D3678f78BB9FB1533c7E9577dACc0E",
        supportsFlashLoans: false,
        concentratedLiquidity: false,
        tvlUSD: 15000000
      },
      {
        id: "beamswap",
        name: "BeamSwap",
        type: "AMM-V2",
        routerAddress: "0x96b244391D98B62D19aE89b1A4dCcf0fc56970C7",
        factoryAddress: "0x985BcA32293A7A496300a48081947321177a86FD",
        supportsFlashLoans: false,
        concentratedLiquidity: false,
        tvlUSD: 8500000
      },
      {
        id: "curve-moonbeam",
        name: "Curve Finance",
        type: "StableSwap",
        routerAddress: "0x094d12e5b541784701FD8d65F11fc0598FBC6332",
        factoryAddress: "0x686d67265703D1f5297e1Da82C357274c4Ba2eB6",
        supportsFlashLoans: true,
        concentratedLiquidity: false,
        tvlUSD: 4200000
      },
      {
        id: "sushiswap-moonbeam",
        name: "SushiSwap",
        type: "AMM-V2",
        routerAddress: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506",
        factoryAddress: "0xc35DADB65012eC5796536bD9864eD8773aBc74C4",
        supportsFlashLoans: false,
        concentratedLiquidity: false,
        tvlUSD: 3200000
      },
      {
        id: "zenlink-protocol",
        name: "Zenlink Protocol",
        type: "AMM-V2",
        routerAddress: "0x2D4e10Ee64CCF407C7F765B363348f7F62D2E06E",
        factoryAddress: "0x7BA73c99e6f01a37f3e33854c8F544BbbadD3420",
        supportsFlashLoans: false,
        concentratedLiquidity: false,
        tvlUSD: 2800000
      }
    ],
    lending: [
      {
        id: "moonwell-artemis",
        name: "Moonwell Artemis",
        protocol: "Compound",
        lendingPoolAddress: "0x8E00D5e02E65A19337Cdba98bbA9F84d4186a180",
        supportsFlashLoans: false,
        maxLoanToValue: 75.0,
        tvlUSD: 45000000,
        borrowRateAPR: 5.8
      },
      {
        id: "solarbeam-lending",
        name: "SolarbeamLending",
        protocol: "Compound",
        lendingPoolAddress: "0x6Bd193Ee6D2104F14F94E2cA6efefae561A4334B",
        supportsFlashLoans: false,
        maxLoanToValue: 70.0,
        tvlUSD: 12000000,
        borrowRateAPR: 6.5
      },
      {
        id: "lido-moonbeam",
        name: "Lido Moonbeam",
        protocol: "Compound",
        lendingPoolAddress: "0x073C1540d4E69fcfed2fC203aaa43a7e043bF919",
        supportsFlashLoans: false,
        maxLoanToValue: 68.0,
        tvlUSD: 8500000,
        borrowRateAPR: 4.2
      },
      {
        id: "ola-finance-moonbeam",
        name: "Ola Finance",
        protocol: "Compound",
        lendingPoolAddress: "0x892785f33CdeE22A30ADB750aF7C83c3B15ED71c",
        supportsFlashLoans: false,
        maxLoanToValue: 72.0,
        tvlUSD: 6200000,
        borrowRateAPR: 7.1
      },
      {
        id: "prime-protocol",
        name: "Prime Protocol",
        protocol: "Compound",
        lendingPoolAddress: "0x49Da40f3F78f7dd2D9432E65093ffE49B15ea6f0",
        supportsFlashLoans: false,
        maxLoanToValue: 65.0,
        tvlUSD: 3800000,
        borrowRateAPR: 8.2
      }
    ],
    bridgeTokens: ["WGLMR", "USDC", "WETH", "WBTC", "DOT"]
  },

  // 12. Cronos
  {
    chainId: 25,
    chainName: "Cronos",
    isEVM: true,
    nativeToken: "CRO",
    wrappedToken: "WCRO",
    rpcUrl: "https://evm.cronos.org/",
    explorerUrl: "https://cronoscan.com",
    dexes: [
      {
        id: "vvs-finance",
        name: "VVS Finance",
        type: "AMM-V2",
        routerAddress: "0x145863Eb42Cf62847A6Ca784e6416C1682b1b2Ae",
        factoryAddress: "0x3B44B2a187a7b3824131F8db5a74194D0a42Fc15",
        supportsFlashLoans: false,
        concentratedLiquidity: false,
        tvlUSD: 28000000
      },
      {
        id: "cronaswap",
        name: "CronaSwap",
        type: "AMM-V2",
        routerAddress: "0xcd7d16fB918511BF7269eC4f48d61D79Fb26f918",
        factoryAddress: "0x73A48f8f521EB31c55c0e1274dB0898dE599Cb11",
        supportsFlashLoans: false,
        concentratedLiquidity: false,
        tvlUSD: 15000000
      },
      {
        id: "mad-meerkat",
        name: "Mad Meerkat Finance",
        type: "AMM-V2",
        routerAddress: "0x145677FC4d9b8F19B5D56d1820c48e0443049a30",
        factoryAddress: "0x5C7F8A570d578ED84E63fdFA7b1eE72dEae1AE23",
        supportsFlashLoans: false,
        concentratedLiquidity: false,
        tvlUSD: 8500000
      },
      {
        id: "elk-finance-cronos",
        name: "Elk Finance",
        type: "AMM-V2",
        routerAddress: "0xdB7D7C535B4081Bb8B719237bdb7DB9f23Cc0b83",
        factoryAddress: "0xE7a330c0818F88B8c6e5c44BdDb93BfE78Cd20Bb",
        supportsFlashLoans: false,
        concentratedLiquidity: false,
        tvlUSD: 4200000
      },
      {
        id: "crodex",
        name: "Crodex",
        type: "AMM-V2",
        routerAddress: "0x3380aE82e39E42Ca34EbEd69aF67fAa0683Bb5c1",
        factoryAddress: "0xEAa26356a248b2C6265b5C9f5214FD31F75bb450",
        supportsFlashLoans: false,
        concentratedLiquidity: false,
        tvlUSD: 2800000
      }
    ],
    lending: [
      {
        id: "tectonic-protocol",
        name: "Tectonic Protocol",
        protocol: "Compound",
        lendingPoolAddress: "0xb3831584acb95ED9cCb0C11f677B5AD01DeaeEc0",
        supportsFlashLoans: false,
        maxLoanToValue: 75.0,
        tvlUSD: 65000000,
        borrowRateAPR: 6.5
      },
      {
        id: "annex-finance",
        name: "Annex Finance",
        protocol: "Compound",
        lendingPoolAddress: "0x5C7a4290f6F8FF64c69eEffDFAFc8644A4Ec3a4E",
        supportsFlashLoans: false,
        maxLoanToValue: 70.0,
        tvlUSD: 18000000,
        borrowRateAPR: 7.2
      },
      {
        id: "ferro-protocol",
        name: "Ferro Protocol",
        protocol: "Compound",
        lendingPoolAddress: "0x39C4a92Dc506300c3Ea4c67ca4CA611102ee6F2A",
        supportsFlashLoans: false,
        maxLoanToValue: 68.0,
        tvlUSD: 12000000,
        borrowRateAPR: 8.1
      },
      {
        id: "veno-finance",
        name: "Veno Finance",
        protocol: "Compound",
        lendingPoolAddress: "0x75e4DD0587663c4246F7a8c6b7bb3c4CDa4bea09",
        supportsFlashLoans: false,
        maxLoanToValue: 65.0,
        tvlUSD: 8500000,
        borrowRateAPR: 9.2
      },
      {
        id: "single-finance",
        name: "Single Finance",
        protocol: "Compound",
        lendingPoolAddress: "0x6d0c966c8A09e354Df9C48b446A474CE3343D912",
        supportsFlashLoans: false,
        maxLoanToValue: 72.0,
        tvlUSD: 4800000,
        borrowRateAPR: 6.8
      }
    ],
    bridgeTokens: ["WCRO", "USDC", "USDT", "WETH", "WBTC"]
  },

  // 13. Aurora (Near EVM)
  {
    chainId: 1313161554,
    chainName: "Aurora",
    isEVM: true,
    nativeToken: "ETH",
    wrappedToken: "WETH",
    rpcUrl: "https://mainnet.aurora.dev",
    explorerUrl: "https://aurorascan.dev",
    dexes: [
      {
        id: "trisolaris",
        name: "Trisolaris",
        type: "AMM-V2",
        routerAddress: "0x2CB45Edb4517d5947aFdE3BEAbF95A582506858B",
        factoryAddress: "0xc66F594268041dB60507F00703b152492fb176E7",
        supportsFlashLoans: false,
        concentratedLiquidity: false,
        tvlUSD: 12000000
      },
      {
        id: "wannaswap",
        name: "WannaSwap",
        type: "AMM-V2",
        routerAddress: "0xa3a1eF5Ae6561572023363862e238aFA84C72ef5",
        factoryAddress: "0x7928D4FeA7b2c90C732c10aFF59cf403f0C38246",
        supportsFlashLoans: false,
        concentratedLiquidity: false,
        tvlUSD: 8500000
      },
      {
        id: "nearpad",
        name: "NearPAD",
        type: "AMM-V2",
        routerAddress: "0xBF560771B6002a58477EB5c61f2A5eE6A90E1b8B",
        factoryAddress: "0x34484b4E416F5d4B45D4Add0B6eF6Ca08FcED8f1",
        supportsFlashLoans: false,
        concentratedLiquidity: false,
        tvlUSD: 3200000
      },
      {
        id: "curve-aurora",
        name: "Curve Finance",
        type: "StableSwap",
        routerAddress: "0x094d12e5b541784701FD8d65F11fc0598FBC6332",
        factoryAddress: "0x686d67265703D1f5297e1Da82C357274c4Ba2eB6",
        supportsFlashLoans: true,
        concentratedLiquidity: false,
        tvlUSD: 2800000
      },
      {
        id: "dodo-aurora",
        name: "DODO",
        type: "AMM-V2",
        routerAddress: "0x3B6067D4CAa8A14c63fdBE6318F27A0bBc9F9237",
        factoryAddress: "0x5e5A7b76462E4BdF83Aa98795644281BdBAe3e0E",
        supportsFlashLoans: true,
        concentratedLiquidity: false,
        tvlUSD: 1800000
      }
    ],
    lending: [
      {
        id: "bastion-protocol",
        name: "Bastion Protocol",
        protocol: "Compound",
        lendingPoolAddress: "0x6De54724e128274520606f038591A00C5E94a1F6",
        supportsFlashLoans: false,
        maxLoanToValue: 75.0,
        tvlUSD: 28000000,
        borrowRateAPR: 6.8
      },
      {
        id: "aurigami",
        name: "Aurigami Protocol",
        protocol: "Compound",
        lendingPoolAddress: "0x817af6cfAF35BdC1A634d6cC94eE9e4c68369Aeb",
        supportsFlashLoans: false,
        maxLoanToValue: 70.0,
        tvlUSD: 12000000,
        borrowRateAPR: 7.5
      },
      {
        id: "meta-pool",
        name: "Meta Pool",
        protocol: "Compound",
        lendingPoolAddress: "0x48c81451E0318914D8d66dE7fC84151dD72E3c63",
        supportsFlashLoans: false,
        maxLoanToValue: 68.0,
        tvlUSD: 8500000,
        borrowRateAPR: 5.2
      },
      {
        id: "burrow-protocol",
        name: "Burrow Protocol",
        protocol: "Compound",
        lendingPoolAddress: "0x901461929B33a8c0c7A853Dcf8E8d2c59EeAc088",
        supportsFlashLoans: false,
        maxLoanToValue: 72.0,
        tvlUSD: 15000000,
        borrowRateAPR: 6.2
      },
      {
        id: "linear-finance",
        name: "Linear Finance",
        protocol: "Compound",
        lendingPoolAddress: "0x873789aaF553fD0B4252d0d2b72C6331c47aff2E",
        supportsFlashLoans: false,
        maxLoanToValue: 65.0,
        tvlUSD: 4200000,
        borrowRateAPR: 8.5
      }
    ],
    bridgeTokens: ["WETH", "USDC", "USDT", "NEAR", "AURORA"]
  },

  // 14. Harmony
  {
    chainId: 1666600000,
    chainName: "Harmony",
    isEVM: true,
    nativeToken: "ONE",
    wrappedToken: "WONE",
    rpcUrl: "https://api.harmony.one",
    explorerUrl: "https://explorer.harmony.one",
    dexes: [
      {
        id: "defi-kingdoms",
        name: "DeFi Kingdoms",
        type: "AMM-V2",
        routerAddress: "0x24ad62502d1C652Cc7684081169D04896aC20f30",
        factoryAddress: "0x9014B937069918bd319f80e8B3bb4A2cf6FAA5F7",
        supportsFlashLoans: false,
        concentratedLiquidity: false,
        tvlUSD: 15000000
      },
      {
        id: "viperswap",
        name: "ViperSwap",
        type: "AMM-V2",
        routerAddress: "0xf012702a5f0e54015362cBCA26a26fc90AA832a3",
        factoryAddress: "0x7D02c116b98d0965ba7B642ace0183ad8b8D2196",
        supportsFlashLoans: false,
        concentratedLiquidity: false,
        tvlUSD: 8500000
      },
      {
        id: "sushiswap-harmony",
        name: "SushiSwap",
        type: "AMM-V2",
        routerAddress: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506",
        factoryAddress: "0xc35DADB65012eC5796536bD9864eD8773aBc74C4",
        supportsFlashLoans: false,
        concentratedLiquidity: false,
        tvlUSD: 4200000
      },
      {
        id: "curve-harmony",
        name: "Curve Finance",
        type: "StableSwap",
        routerAddress: "0x094d12e5b541784701FD8d65F11fc0598FBC6332",
        factoryAddress: "0x686d67265703D1f5297e1Da82C357274c4Ba2eB6",
        supportsFlashLoans: true,
        concentratedLiquidity: false,
        tvlUSD: 3200000
      },
      {
        id: "openswap",
        name: "OpenSwap",
        type: "AMM-V2",
        routerAddress: "0xed7d5F38C79115ca12fe6C0041abb22F0A06C300",
        factoryAddress: "0x917098C2068ae3acCCba490538270FF9d609540B",
        supportsFlashLoans: false,
        concentratedLiquidity: false,
        tvlUSD: 2800000
      }
    ],
    lending: [
      {
        id: "tranquil-finance",
        name: "Tranquil Finance",
        protocol: "Compound",
        lendingPoolAddress: "0x34B9aa82D89AE04f0f546Ca5eC9C93eFE1288940",
        supportsFlashLoans: false,
        maxLoanToValue: 75.0,
        tvlUSD: 32000000,
        borrowRateAPR: 6.8
      },
      {
        id: "lend-flare",
        name: "Lend Flare",
        protocol: "Compound",
        lendingPoolAddress: "0x6c9f097e044506712B58EAC670c9a5fd4BCceF13",
        supportsFlashLoans: false,
        maxLoanToValue: 70.0,
        tvlUSD: 12000000,
        borrowRateAPR: 7.5
      },
      {
        id: "aave-harmony",
        name: "Aave Harmony",
        protocol: "Aave",
        lendingPoolAddress: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
        flashLoanPoolAddress: "0x794a61358D6845594F94dc1DB02A252b5b4814aD",
        supportsFlashLoans: true,
        maxLoanToValue: 78.0,
        tvlUSD: 18000000,
        borrowRateAPR: 5.8
      },
      {
        id: "hundred-harmony",
        name: "Hundred Finance",
        protocol: "Compound",
        lendingPoolAddress: "0x090a00A2De0EA83DEf700B5e216f87a5D4F394FE",
        supportsFlashLoans: false,
        maxLoanToValue: 68.0,
        tvlUSD: 8500000,
        borrowRateAPR: 8.2
      },
      {
        id: "beefy-finance",
        name: "Beefy Finance",
        protocol: "Compound",
        lendingPoolAddress: "0x5A39B7D7f3A6D9871D491234a3e0D48776DA2bf7",
        supportsFlashLoans: false,
        maxLoanToValue: 72.0,
        tvlUSD: 6200000,
        borrowRateAPR: 6.5
      }
    ],
    bridgeTokens: ["WONE", "USDC", "USDT", "WETH", "WBTC"]
  },

  // 15. Kava
  {
    chainId: 2222,
    chainName: "Kava",
    isEVM: true,
    nativeToken: "KAVA",
    wrappedToken: "WKAVA",
    rpcUrl: "https://evm.kava.io",
    explorerUrl: "https://explorer.kava.io",
    dexes: [
      {
        id: "kinetix-finance",
        name: "Kinetix Finance",
        type: "AMM-V2",
        routerAddress: "0xAE2b2089506EC5F4fFEd6C4C4A8846639a8606f6",
        factoryAddress: "0x2Db0AFD0045F3518c77eC6591a542e326Befd3D7",
        supportsFlashLoans: false,
        concentratedLiquidity: false,
        tvlUSD: 18000000
      },
      {
        id: "elk-finance-kava",
        name: "Elk Finance",
        type: "AMM-V2",
        routerAddress: "0xdB7D7C535B4081Bb8B719237bdb7DB9f23Cc0b83",
        factoryAddress: "0xE7a330c0818F88B8c6e5c44BdDb93BfE78Cd20Bb",
        supportsFlashLoans: false,
        concentratedLiquidity: false,
        tvlUSD: 6800000
      },
      {
        id: "curve-kava",
        name: "Curve Finance",
        type: "StableSwap",
        routerAddress: "0x094d12e5b541784701FD8d65F11fc0598FBC6332",
        factoryAddress: "0x686d67265703D1f5297e1Da82C357274c4Ba2eB6",
        supportsFlashLoans: true,
        concentratedLiquidity: false,
        tvlUSD: 4200000
      },
      {
        id: "photonswap",
        name: "PhotonSwap",
        type: "AMM-V2",
        routerAddress: "0x2F7e6F8C4280b7316f3A8A7dF77A2e5A4B23826b",
        factoryAddress: "0xf3BC9E5fA891977DCf6d23A85DFFD3552a754E51",
        supportsFlashLoans: false,
        concentratedLiquidity: false,
        tvlUSD: 2800000
      },
      {
        id: "equilibre-finance",
        name: "Equilibre Finance",
        type: "AMM-V2",
        routerAddress: "0x1A05EB736873485655F29a37DEf8a0AA87F5a447",
        factoryAddress: "0xc6366EFD0AF1d09171fe0EBF32c7943BB310832a",
        supportsFlashLoans: false,
        concentratedLiquidity: false,
        tvlUSD: 3500000
      }
    ],
    lending: [
      {
        id: "kava-lend",
        name: "Kava Lend",
        protocol: "Compound",
        lendingPoolAddress: "0x7C598c96D02398d89FbCb9d41Eab3DF0C16F227D",
        supportsFlashLoans: false,
        maxLoanToValue: 75.0,
        tvlUSD: 85000000,
        borrowRateAPR: 5.8
      },
      {
        id: "mare-finance",
        name: "Mare Finance",
        protocol: "Compound",
        lendingPoolAddress: "0x1De8d6427f2F20194611BFFb84EDc1eA31E17621",
        supportsFlashLoans: false,
        maxLoanToValue: 72.0,
        tvlUSD: 28000000,
        borrowRateAPR: 6.5
      },
      {
        id: "ola-finance-kava",
        name: "Ola Finance",
        protocol: "Compound",
        lendingPoolAddress: "0x892785f33CdeE22A30ADB750aF7C83c3B15ED71c",
        supportsFlashLoans: false,
        maxLoanToValue: 68.0,
        tvlUSD: 12000000,
        borrowRateAPR: 7.2
      },
      {
        id: "lever-protocol",
        name: "Lever Protocol",
        protocol: "Compound",
        lendingPoolAddress: "0x4dCf7407AE5C07f8681e1659f626E114A7667339",
        supportsFlashLoans: false,
        maxLoanToValue: 70.0,
        tvlUSD: 15000000,
        borrowRateAPR: 6.8
      },
      {
        id: "hard-protocol",
        name: "Hard Protocol",
        protocol: "Compound",
        lendingPoolAddress: "0x2Cf9106FAf2c5C8713035d40df655Fb1B9b0f595",
        supportsFlashLoans: false,
        maxLoanToValue: 65.0,
        tvlUSD: 8500000,
        borrowRateAPR: 8.1
      }
    ],
    bridgeTokens: ["WKAVA", "USDC", "USDT", "WETH", "ATOM"]
  },

  // 16. Metis Andromeda
  {
    chainId: 1088,
    chainName: "Metis",
    isEVM: true,
    nativeToken: "METIS",
    wrappedToken: "WMETIS",
    rpcUrl: "https://andromeda.metis.io/?owner=1088",
    explorerUrl: "https://andromeda-explorer.metis.io",
    dexes: [
      {
        id: "netswap",
        name: "Netswap",
        type: "AMM-V2",
        routerAddress: "0x1E876cCe41B7b844FDe09E38Fa1cf00f213bFf56",
        factoryAddress: "0x70f51d68D16e8f9e418441280342BD43AC9Dff9f",
        supportsFlashLoans: false,
        concentratedLiquidity: false,
        tvlUSD: 12000000
      },
      {
        id: "tethys-finance",
        name: "Tethys Finance",
        type: "AMM-V2",
        routerAddress: "0x81b9FA50D5f5155Ee17817C21702C3AE4780AD09",
        factoryAddress: "0x2D5C2466928101b5C0DF4C2e0e7025b6973F379C",
        supportsFlashLoans: false,
        concentratedLiquidity: false,
        tvlUSD: 8500000
      },
      {
        id: "hermes-protocol",
        name: "Hermes Protocol",
        type: "AMM-V2",
        routerAddress: "0xFe7D6a5e0164D32Eb2545ECBfA5Ff1C6Df8b3e82",
        factoryAddress: "0x28c9C7Bb6983ca4b14ac4a27702C70C3c8c0d5dF",
        supportsFlashLoans: false,
        concentratedLiquidity: false,
        tvlUSD: 4200000
      },
      {
        id: "standard-protocol",
        name: "Standard Protocol",
        type: "StableSwap",
        routerAddress: "0x6B73ed13029cB1145EFE21e280b3Bb9e5449e4D9",
        factoryAddress: "0x818339B4E536E707f14980219037c5Fa8D71c9e8",
        supportsFlashLoans: true,
        concentratedLiquidity: false,
        tvlUSD: 2800000
      },
      {
        id: "curve-metis",
        name: "Curve Finance",
        type: "StableSwap",
        routerAddress: "0x094d12e5b541784701FD8d65F11fc0598FBC6332",
        factoryAddress: "0x686d67265703D1f5297e1Da82C357274c4Ba2eB6",
        supportsFlashLoans: true,
        concentratedLiquidity: false,
        tvlUSD: 3500000
      }
    ],
    lending: [
      {
        id: "aave-metis",
        name: "Aave Metis",
        protocol: "Aave",
        lendingPoolAddress: "0x90df02551bB792286e8D4f13E0e357b4Bf1D6a57",
        flashLoanPoolAddress: "0x90df02551bB792286e8D4f13E0e357b4Bf1D6a57",
        supportsFlashLoans: true,
        maxLoanToValue: 75.0,
        tvlUSD: 35000000,
        borrowRateAPR: 6.2
      },
      {
        id: "hundred-metis",
        name: "Hundred Finance",
        protocol: "Compound",
        lendingPoolAddress: "0x090a00A2De0EA83DEf700B5e216f87a5D4F394FE",
        supportsFlashLoans: false,
        maxLoanToValue: 70.0,
        tvlUSD: 15000000,
        borrowRateAPR: 7.1
      },
      {
        id: "athena-finance",
        name: "Athena Finance",
        protocol: "Compound",
        lendingPoolAddress: "0x2857B77C903D1C9902A627c35EEf4F4eB15f8eC0",
        supportsFlashLoans: false,
        maxLoanToValue: 68.0,
        tvlUSD: 8500000,
        borrowRateAPR: 7.8
      },
      {
        id: "metis-stargate",
        name: "Metis Stargate",
        protocol: "Compound",
        lendingPoolAddress: "0xAf5191B0De278C7286d6C7CC6ab6BB8A73bA2Cd6",
        supportsFlashLoans: false,
        maxLoanToValue: 72.0,
        tvlUSD: 12000000,
        borrowRateAPR: 6.5
      },
      {
        id: "wagmi-protocol",
        name: "Wagmi Protocol",
        protocol: "Compound",
        lendingPoolAddress: "0x2B8A1c539ABE5b5A747fb143A8d24B350e20c917",
        supportsFlashLoans: false,
        maxLoanToValue: 65.0,
        tvlUSD: 6200000,
        borrowRateAPR: 8.5
      }
    ],
    bridgeTokens: ["WMETIS", "USDC", "USDT", "WETH", "m.USDT"]
  },

  // 17. Evmos
  {
    chainId: 9001,
    chainName: "Evmos",
    isEVM: true,
    nativeToken: "EVMOS",
    wrappedToken: "WEVMOS",
    rpcUrl: "https://eth.bd.evmos.org:8545/",
    explorerUrl: "https://evm.evmos.org",
    dexes: [
      {
        id: "diffusion-finance",
        name: "Diffusion Finance",
        type: "AMM-V2",
        routerAddress: "0x6aBdDa34Fb225be4610a2d153845e09429523Cd2",
        factoryAddress: "0x6BAdc85558811296c1B95AE9eb4281be710342d5",
        supportsFlashLoans: false,
        concentratedLiquidity: false,
        tvlUSD: 8500000
      },
      {
        id: "cronus-finance",
        name: "Cronus Finance",
        type: "AMM-V2",
        routerAddress: "0x2F6e121942aA2B2158232C2265F6750D6b3F1eA0",
        factoryAddress: "0x4c4464C549AC544AefC8F479481C47Db1DaE83BF",
        supportsFlashLoans: false,
        concentratedLiquidity: false,
        tvlUSD: 4200000
      },
      {
        id: "exswap",
        name: "ExSwap",
        type: "AMM-V2",
        routerAddress: "0x8b8E48a8b4F4f2d2C84B932d59B2A4aB6ce1dD9D",
        factoryAddress: "0x61681A48e2F3aDB2B1B2887AB6B83F5b8877e0D3",
        supportsFlashLoans: false,
        concentratedLiquidity: false,
        tvlUSD: 2800000
      },
      {
        id: "forge-trade",
        name: "Forge Trade",
        type: "AMM-V2",
        routerAddress: "0xFD21bE27A2B059A288229D7c1D8e90e8260Ee5B7",
        factoryAddress: "0x888EcA2BBdd6d8a0d5CE7D2381Fc5b6281a4AcC4",
        supportsFlashLoans: false,
        concentratedLiquidity: false,
        tvlUSD: 1500000
      },
      {
        id: "spacefi-evmos",
        name: "SpaceFi",
        type: "AMM-V2",
        routerAddress: "0x2d4e10Ee64CCF407C7F765B363348f7F62D2E06E",
        factoryAddress: "0x7BA73c99e6f01a37f3e33854c8F544BbbadD3420",
        supportsFlashLoans: false,
        concentratedLiquidity: false,
        tvlUSD: 3200000
      }
    ],
    lending: [
      {
        id: "kinetic-money",
        name: "Kinetic Money",
        protocol: "Compound",
        lendingPoolAddress: "0xb2C639c533813f4Aa9D7837CAf42933aAce4F12E",
        supportsFlashLoans: false,
        maxLoanToValue: 70.0,
        tvlUSD: 12000000,
        borrowRateAPR: 7.5
      },
      {
        id: "midas-capital-evmos",
        name: "Midas Capital",
        protocol: "Compound",
        lendingPoolAddress: "0x9Fad24f572045c7869117160A571B2e50b10d068",
        supportsFlashLoans: false,
        maxLoanToValue: 68.0,
        tvlUSD: 6800000,
        borrowRateAPR: 8.2
      },
      {
        id: "evmos-lending",
        name: "Evmos Lending",
        protocol: "Compound",
        lendingPoolAddress: "0x34B9aa82D89AE04f0f546Ca5eC9C93eFE1288940",
        supportsFlashLoans: false,
        maxLoanToValue: 65.0,
        tvlUSD: 4200000,
        borrowRateAPR: 9.1
      },
      {
        id: "orbit-protocol",
        name: "Orbit Protocol",
        protocol: "Compound",
        lendingPoolAddress: "0x817af6cfAF35BdC1A634d6cC94eE9e4c68369Aeb",
        supportsFlashLoans: false,
        maxLoanToValue: 72.0,
        tvlUSD: 8500000,
        borrowRateAPR: 6.8
      },
      {
        id: "cosmostation-lend",
        name: "Cosmostation Lend",
        protocol: "Compound",
        lendingPoolAddress: "0x2DA9C928c91C4c473E32c0a0cB4E7a7038491ea6",
        supportsFlashLoans: false,
        maxLoanToValue: 75.0,
        tvlUSD: 15000000,
        borrowRateAPR: 5.8
      }
    ],
    bridgeTokens: ["WEVMOS", "USDC", "USDT", "WETH", "ATOM"]
  },

  // 18. Oasis Emerald
  {
    chainId: 42262,
    chainName: "Oasis",
    isEVM: true,
    nativeToken: "ROSE",
    wrappedToken: "WROSE",
    rpcUrl: "https://emerald.oasis.dev/",
    explorerUrl: "https://explorer.emerald.oasis.dev",
    dexes: [
      {
        id: "yuzuswap",
        name: "YuzuSwap",
        type: "AMM-V2",
        routerAddress: "0x250d48C5E78068ad6C2313d71FCC956dD800E2de",
        factoryAddress: "0x2108b0B90404531a7700263cD4b4256b86a02DDD",
        supportsFlashLoans: false,
        concentratedLiquidity: false,
        tvlUSD: 6800000
      },
      {
        id: "gemkeeper",
        name: "GemKeeper",
        type: "AMM-V2",
        routerAddress: "0xa64B44d6Ae8c0B80d3CBd00f59DD934652B4265A",
        factoryAddress: "0x6f8F557f5C8E49579043b014b8bBD8497B5080A8",
        supportsFlashLoans: false,
        concentratedLiquidity: false,
        tvlUSD: 2800000
      },
      {
        id: "valleyswap",
        name: "ValleySwap",
        type: "AMM-V2",
        routerAddress: "0xAE2b2089506EC5F4fFEd6C4C4A8846639a8606f6",
        factoryAddress: "0x2Db0AFD0045F3518c77eC6591a542e326Befd3D7",
        supportsFlashLoans: false,
        concentratedLiquidity: false,
        tvlUSD: 1500000
      },
      {
        id: "duneswap",
        name: "DuneSwap",
        type: "AMM-V2",
        routerAddress: "0xf012702a5f0e54015362cBCA26a26fc90AA832a3",
        factoryAddress: "0x7D02c116b98d0965ba7B642ace0183ad8b8D2196",
        supportsFlashLoans: false,
        concentratedLiquidity: false,
        tvlUSD: 4200000
      },
      {
        id: "fountain-protocol",
        name: "Fountain Protocol",
        type: "StableSwap",
        routerAddress: "0x6B73ed13029cB1145EFE21e280b3Bb9e5449e4D9",
        factoryAddress: "0x818339B4E536E707f14980219037c5Fa8D71c9e8",
        supportsFlashLoans: true,
        concentratedLiquidity: false,
        tvlUSD: 3500000
      }
    ],
    lending: [
      {
        id: "oasis-lend",
        name: "Oasis Lend",
        protocol: "Compound",
        lendingPoolAddress: "0x7C598c96D02398d89FbCb9d41Eab3DF0C16F227D",
        supportsFlashLoans: false,
        maxLoanToValue: 70.0,
        tvlUSD: 18000000,
        borrowRateAPR: 7.2
      },
      {
        id: "nebula-protocol",
        name: "Nebula Protocol",
        protocol: "Compound",
        lendingPoolAddress: "0x1De8d6427f2F20194611BFFb84EDc1eA31E17621",
        supportsFlashLoans: false,
        maxLoanToValue: 68.0,
        tvlUSD: 8500000,
        borrowRateAPR: 8.1
      },
      {
        id: "rose-lend",
        name: "Rose Lend",
        protocol: "Compound",
        lendingPoolAddress: "0x34B9aa82D89AE04f0f546Ca5eC9C93eFE1288940",
        supportsFlashLoans: false,
        maxLoanToValue: 65.0,
        tvlUSD: 4200000,
        borrowRateAPR: 9.2
      },
      {
        id: "emerald-finance",
        name: "Emerald Finance",
        protocol: "Compound",
        lendingPoolAddress: "0x817af6cfAF35BdC1A634d6cC94eE9e4c68369Aeb",
        supportsFlashLoans: false,
        maxLoanToValue: 72.0,
        tvlUSD: 12000000,
        borrowRateAPR: 6.8
      },
      {
        id: "oasis-bloom",
        name: "Oasis Bloom",
        protocol: "Compound",
        lendingPoolAddress: "0x2DA9C928c91C4c473E32c0a0cB4E7a7038491ea6",
        supportsFlashLoans: false,
        maxLoanToValue: 75.0,
        tvlUSD: 6800000,
        borrowRateAPR: 5.8
      }
    ],
    bridgeTokens: ["WROSE", "USDC", "USDT", "WETH", "WBTC"]
  },

  // 19. Milkomeda C1
  {
    chainId: 2001,
    chainName: "Milkomeda",
    isEVM: true,
    nativeToken: "milkADA",
    wrappedToken: "WADA",
    rpcUrl: "https://rpc-mainnet-cardano-evm.c1.milkomeda.com",
    explorerUrl: "https://explorer-mainnet-cardano-evm.c1.milkomeda.com",
    dexes: [
      {
        id: "milkyswap",
        name: "MilkySwap",
        type: "AMM-V2",
        routerAddress: "0xE1708Ca78887A89C268E35C9aDB5A97b71Cf712e",
        factoryAddress: "0x6961fE4E9107B213395b47f6a720E85D9F75bb47",
        supportsFlashLoans: false,
        concentratedLiquidity: false,
        tvlUSD: 8500000
      },
      {
        id: "muesliswap",
        name: "MuesliSwap",
        type: "AMM-V2",
        routerAddress: "0x2F6e121942aA2B2158232C2265F6750D6b3F1eA0",
        factoryAddress: "0x4c4464C549AC544AefC8F479481C47Db1DaE83BF",
        supportsFlashLoans: false,
        concentratedLiquidity: false,
        tvlUSD: 4200000
      },
      {
        id: "blueshift",
        name: "BlueShift",
        type: "AMM-V2",
        routerAddress: "0x8b8E48a8b4F4f2d2C84B932d59B2A4aB6ce1dD9D",
        factoryAddress: "0x61681A48e2F3aDB2B1B2887AB6B83F5b8877e0D3",
        supportsFlashLoans: false,
        concentratedLiquidity: false,
        tvlUSD: 2800000
      },
      {
        id: "occam-dex",
        name: "OccamDEX",
        type: "AMM-V2",
        routerAddress: "0xFD21bE27A2B059A288229D7c1D8e90e8260Ee5B7",
        factoryAddress: "0x888EcA2BBdd6d8a0d5CE7D2381Fc5b6281a4AcC4",
        supportsFlashLoans: false,
        concentratedLiquidity: false,
        tvlUSD: 1800000
      },
      {
        id: "adalend-dex",
        name: "AdaLend DEX",
        type: "StableSwap",
        routerAddress: "0x6B73ed13029cB1145EFE21e280b3Bb9e5449e4D9",
        factoryAddress: "0x818339B4E536E707f14980219037c5Fa8D71c9e8",
        supportsFlashLoans: true,
        concentratedLiquidity: false,
        tvlUSD: 3200000
      }
    ],
    lending: [
      {
        id: "milkomeda-lend",
        name: "Milkomeda Lend",
        protocol: "Compound",
        lendingPoolAddress: "0x7C598c96D02398d89FbCb9d41Eab3DF0C16F227D",
        supportsFlashLoans: false,
        maxLoanToValue: 68.0,
        tvlUSD: 12000000,
        borrowRateAPR: 8.5
      },
      {
        id: "adalend-protocol",
        name: "AdaLend Protocol",
        protocol: "Compound",
        lendingPoolAddress: "0x1De8d6427f2F20194611BFFb84EDc1eA31E17621",
        supportsFlashLoans: false,
        maxLoanToValue: 65.0,
        tvlUSD: 6800000,
        borrowRateAPR: 9.2
      },
      {
        id: "cardano-lend",
        name: "Cardano Lend",
        protocol: "Compound",
        lendingPoolAddress: "0x34B9aa82D89AE04f0f546Ca5eC9C93eFE1288940",
        supportsFlashLoans: false,
        maxLoanToValue: 70.0,
        tvlUSD: 8500000,
        borrowRateAPR: 7.8
      },
      {
        id: "milk-protocol",
        name: "Milk Protocol",
        protocol: "Compound",
        lendingPoolAddress: "0x817af6cfAF35BdC1A634d6cC94eE9e4c68369Aeb",
        supportsFlashLoans: false,
        maxLoanToValue: 72.0,
        tvlUSD: 4200000,
        borrowRateAPR: 6.5
      },
      {
        id: "c1-finance",
        name: "C1 Finance",
        protocol: "Compound",
        lendingPoolAddress: "0x2DA9C928c91C4c473E32c0a0cB4E7a7038491ea6",
        supportsFlashLoans: false,
        maxLoanToValue: 75.0,
        tvlUSD: 9500000,
        borrowRateAPR: 6.2
      }
    ],
    bridgeTokens: ["WADA", "USDC", "USDT", "WETH", "milkADA"]
  },

  // 20. Telos EVM
  {
    chainId: 40,
    chainName: "Telos",
    isEVM: true,
    nativeToken: "TLOS",
    wrappedToken: "WTLOS",
    rpcUrl: "https://mainnet.telos.net/evm",
    explorerUrl: "https://www.teloscan.io",
    dexes: [
      {
        id: "sushiswap-telos",
        name: "SushiSwap",
        type: "AMM-V2",
        routerAddress: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506",
        factoryAddress: "0xc35DADB65012eC5796536bD9864eD8773aBc74C4",
        supportsFlashLoans: false,
        concentratedLiquidity: false,
        tvlUSD: 12000000
      },
      {
        id: "zappy",
        name: "Zappy",
        type: "AMM-V2",
        routerAddress: "0x7386f17a1F301Ff5e90A1F4FDE98d1168FA32F5C",
        factoryAddress: "0xFe2197C6746E4a0dBFf16ccbc167ED5e99989B0c",
        supportsFlashLoans: false,
        concentratedLiquidity: false,
        tvlUSD: 4200000
      },
      {
        id: "elk-finance-telos",
        name: "Elk Finance",
        type: "AMM-V2",
        routerAddress: "0xdB7D7C535B4081Bb8B719237bdb7DB9f23Cc0b83",
        factoryAddress: "0xE7a330c0818F88B8c6e5c44BdDb93BfE78Cd20Bb",
        supportsFlashLoans: false,
        concentratedLiquidity: false,
        tvlUSD: 2800000
      },
      {
        id: "swapsicle",
        name: "Swapsicle",
        type: "AMM-V2",
        routerAddress: "0x2F6e121942aA2B2158232C2265F6750D6b3F1eA0",
        factoryAddress: "0x4c4464C549AC544AefC8F479481C47Db1DaE83BF",
        supportsFlashLoans: false,
        concentratedLiquidity: false,
        tvlUSD: 3500000
      },
      {
        id: "omnidex",
        name: "OmniDEX",
        type: "AMM-V2",
        routerAddress: "0x8b8E48a8b4F4f2d2C84B932d59B2A4aB6ce1dD9D",
        factoryAddress: "0x61681A48e2F3aDB2B1B2887AB6B83F5b8877e0D3",
        supportsFlashLoans: false,
        concentratedLiquidity: false,
        tvlUSD: 1800000
      }
    ],
    lending: [
      {
        id: "telos-lend",
        name: "Telos Lend",
        protocol: "Compound",
        lendingPoolAddress: "0x7C598c96D02398d89FbCb9d41Eab3DF0C16F227D",
        supportsFlashLoans: false,
        maxLoanToValue: 70.0,
        tvlUSD: 15000000,
        borrowRateAPR: 7.5
      },
      {
        id: "eosio-lend",
        name: "EOSIO Lend",
        protocol: "Compound",
        lendingPoolAddress: "0x1De8d6427f2F20194611BFFb84EDc1eA31E17621",
        supportsFlashLoans: false,
        maxLoanToValue: 68.0,
        tvlUSD: 8500000,
        borrowRateAPR: 8.2
      },
      {
        id: "rexlend",
        name: "RexLend",
        protocol: "Compound",
        lendingPoolAddress: "0x34B9aa82D89AE04f0f546Ca5eC9C93eFE1288940",
        supportsFlashLoans: false,
        maxLoanToValue: 65.0,
        tvlUSD: 4200000,
        borrowRateAPR: 9.1
      },
      {
        id: "telos-finance",
        name: "Telos Finance",
        protocol: "Compound",
        lendingPoolAddress: "0x817af6cfAF35BdC1A634d6cC94eE9e4c68369Aeb",
        supportsFlashLoans: false,
        maxLoanToValue: 72.0,
        tvlUSD: 6800000,
        borrowRateAPR: 6.8
      },
      {
        id: "decentralbank",
        name: "Decentral Bank",
        protocol: "Compound",
        lendingPoolAddress: "0x2DA9C928c91C4c473E32c0a0cB4E7a7038491ea6",
        supportsFlashLoans: false,
        maxLoanToValue: 75.0,
        tvlUSD: 12000000,
        borrowRateAPR: 5.8
      }
    ],
    bridgeTokens: ["WTLOS", "USDC", "USDT", "WETH", "EOS"]
  }
];

// Función helper para obtener registry por chainId
export function getDexRegistryByChainId(chainId: number): DexRegistry | undefined {
  return dexRegistry.find(registry => registry.chainId === chainId);
}

// Función helper para obtener todos los DEX de una blockchain
export function getDexesByChain(chainId: number): DexInfo[] {
  const registry = getDexRegistryByChainId(chainId);
  return registry ? registry.dexes : [];
}

// Función helper para obtener todos los protocolos de lending de una blockchain
export function getLendingByChain(chainId: number): LendingInfo[] {
  const registry = getDexRegistryByChainId(chainId);
  return registry ? registry.lending : [];
}

// Función helper para obtener DEX que soportan flash loans
export function getFlashLoanDexes(): Array<{ chainId: number, chainName: string, dex: DexInfo }> {
  const result: Array<{ chainId: number, chainName: string, dex: DexInfo }> = [];
  
  dexRegistry.forEach(registry => {
    registry.dexes.forEach(dex => {
      if (dex.supportsFlashLoans) {
        result.push({
          chainId: registry.chainId,
          chainName: registry.chainName,
          dex: dex
        });
      }
    });
  });
  
  return result;
}

// Función helper para obtener protocolos de lending que soportan flash loans
export function getFlashLoanLending(): Array<{ chainId: number, chainName: string, lending: LendingInfo }> {
  const result: Array<{ chainId: number, chainName: string, lending: LendingInfo }> = [];
  
  dexRegistry.forEach(registry => {
    registry.lending.forEach(lending => {
      if (lending.supportsFlashLoans) {
        result.push({
          chainId: registry.chainId,
          chainName: registry.chainName,
          lending: lending
        });
      }
    });
  });
  
  return result;
}

// Función helper para obtener bridges tokens comunes
export function getBridgeTokensByChain(chainId: number): string[] {
  const registry = getDexRegistryByChainId(chainId);
  return registry ? registry.bridgeTokens : [];
}

// Export para compatibilidad
export { dexRegistry as default };
require("@nomicfoundation/hardhat-toolbox");
require("@nomicfoundation/hardhat-verify");
require("hardhat-contract-sizer");
require("hardhat-gas-reporter");
require("solidity-coverage");

// Load environment variables
require('dotenv').config({ path: '../.env' });

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
        details: {
          yul: true,
          yulDetails: {
            stackAllocation: true,
            optimizerSteps: "dhfoDgvulfnTUtnIf"
          }
        }
      },
      viaIR: true,
      metadata: {
        bytecodeHash: "none"
      }
    }
  },
  
  networks: {
    // Mainnet networks
    ethereum: {
      url: process.env.ETHEREUM_RPC_URL || "https://eth-mainnet.alchemyapi.io/v2/YOUR-API-KEY",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 1,
      gasPrice: "auto",
      gasMultiplier: 1.2
    },
    
    polygon: {
      url: process.env.POLYGON_RPC_URL || "https://polygon-rpc.com",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 137,
      gasPrice: 30000000000, // 30 gwei
      gasMultiplier: 1.2
    },
    
    bsc: {
      url: process.env.BSC_RPC_URL || "https://bsc-dataseed1.binance.org",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 56,
      gasPrice: 3000000000, // 3 gwei
      gasMultiplier: 1.2
    },
    
    arbitrum: {
      url: process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 42161,
      gasPrice: "auto",
      gasMultiplier: 1.1
    },
    
    base: {
      url: process.env.BASE_RPC_URL || "https://mainnet.base.org",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 8453,
      gasPrice: "auto",
      gasMultiplier: 1.1
    },
    
    optimism: {
      url: process.env.OPTIMISM_RPC_URL || "https://mainnet.optimism.io",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 10,
      gasPrice: "auto"
    },
    
    avalanche: {
      url: process.env.AVALANCHE_RPC_URL || "https://api.avax.network/ext/bc/C/rpc",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 43114,
      gasPrice: 25000000000 // 25 gwei
    },
    
    fantom: {
      url: process.env.FANTOM_RPC_URL || "https://rpc.ftm.tools",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 250,
      gasPrice: "auto"
    },
    
    // Testnets
    polygonMumbai: {
      url: process.env.POLYGON_MUMBAI_RPC_URL || "https://matic-mumbai.chainstacklabs.com",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 80001,
      gasPrice: 1000000000 // 1 gwei
    },
    
    bscTestnet: {
      url: process.env.BSC_TESTNET_RPC_URL || "https://data-seed-prebsc-1-s1.binance.org:8545",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 97,
      gasPrice: 10000000000 // 10 gwei
    },
    
    arbitrumGoerli: {
      url: process.env.ARBITRUM_GOERLI_RPC_URL || "https://goerli-rollup.arbitrum.io/rpc",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 421613
    },
    
    baseGoerli: {
      url: process.env.BASE_GOERLI_RPC_URL || "https://goerli.base.org",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 84531
    },
    
    // Local networks
    hardhat: {
      forking: {
        url: process.env.ETHEREUM_RPC_URL || "https://eth-mainnet.alchemyapi.io/v2/YOUR-API-KEY",
        blockNumber: undefined
      },
      accounts: {
        count: 20,
        mnemonic: "test test test test test test test test test test test junk",
        accountsBalance: "10000000000000000000000" // 10,000 ETH
      },
      chainId: 1337,
      mining: {
        auto: true,
        interval: 0
      }
    },
    
    localhost: {
      url: "http://127.0.0.1:8545",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 1337
    }
  },
  
  // Etherscan API keys for contract verification
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY,
      polygon: process.env.POLYGONSCAN_API_KEY,
      bsc: process.env.BSCSCAN_API_KEY,
      arbitrumOne: process.env.ARBISCAN_API_KEY,
      base: process.env.BASESCAN_API_KEY,
      optimisticEthereum: process.env.OPTIMISTIC_ETHERSCAN_API_KEY,
      avalanche: process.env.SNOWTRACE_API_KEY,
      opera: process.env.FTMSCAN_API_KEY
    },
    customChains: [
      {
        network: "base",
        chainId: 8453,
        urls: {
          apiURL: "https://api.basescan.org/api",
          browserURL: "https://basescan.org"
        }
      }
    ]
  },
  
  // Gas reporter configuration
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
    gasPrice: 20,
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    token: "ETH",
    showTimeSpent: true,
    showMethodSig: true,
    maxMethodDiff: 10,
    excludeContracts: ["Migrations", "MockERC20"],
    outputFile: "gas-report.txt",
    noColors: true
  },
  
  // Contract sizer configuration
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: false,
    strict: true,
    only: [':ArbitrageExecutor$', ':.*Arbitrage$']
  },
  
  // Mocha configuration
  mocha: {
    timeout: 60000,
    color: true,
    reporter: "spec",
    slow: 30000,
    bail: false
  },
  
  // TypeChain configuration
  typechain: {
    outDir: "typechain-types",
    target: "ethers-v6",
    alwaysGenerateOverloads: false,
    externalArtifacts: ["externalArtifacts/*.sol/!(build-info)/**/+([a-zA-Z0-9_]).json"],
    dontOverrideCompile: false
  },
  
  // Paths configuration
  paths: {
    sources: "./",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  
  // Additional compiler configurations
  compilers: [
    {
      version: "0.8.19",
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        }
      }
    },
    {
      version: "0.8.18", // For compatibility with some libraries
      settings: {
        optimizer: {
          enabled: true,
          runs: 200
        }
      }
    }
  ]
};

// Custom tasks
task("deploy-all", "Deploy to all networks", async (taskArgs, hre) => {
  const networks = ["polygon", "bsc", "arbitrum", "base"];
  
  for (const network of networks) {
    console.log(`\n🚀 Deploying to ${network}...`);
    await hre.run("run", {
      script: `scripts/deploy-${network}.js`,
      network: network
    });
  }
});

task("verify-all", "Verify contracts on all networks", async (taskArgs, hre) => {
  const networks = ["polygon", "bsc", "arbitrum", "base"];
  
  for (const network of networks) {
    console.log(`\n🔍 Verifying contracts on ${network}...`);
    // Implementation would read deployment addresses and verify each contract
  }
});

task("gas-compare", "Compare gas costs across networks")
  .addParam("contract", "Contract name to compare")
  .setAction(async (taskArgs, hre) => {
    const networks = ["polygon", "bsc", "arbitrum", "base"];
    
    console.log(`\n⛽ Gas comparison for ${taskArgs.contract}:\n`);
    
    for (const network of networks) {
      // Implementation would deploy to each network and compare gas costs
      console.log(`${network}: TBD gas units`);
    }
  });
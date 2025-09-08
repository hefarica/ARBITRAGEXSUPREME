require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

// RPC URLs
const POLYGON_RPC = process.env.POLYGON_RPC || "https://polygon-rpc.com";
const BSC_RPC = process.env.BSC_RPC || "https://bsc-dataseed.binance.org";
const ARBITRUM_RPC = process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc";
const ETHEREUM_RPC = process.env.ETHEREUM_RPC || "https://eth.llamarpc.com";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true
    }
  },

  networks: {
    hardhat: {
      chainId: 31337,
      gas: 12000000,
      blockGasLimit: 12000000,
      allowUnlimitedContractSize: true,
    },

    // MAINNETS
    polygon: {
      url: POLYGON_RPC,
      chainId: 137,
      accounts: [PRIVATE_KEY],
      gas: "auto",
      gasPrice: "auto",
      timeout: 300000
    },

    bsc: {
      url: BSC_RPC,
      chainId: 56,
      accounts: [PRIVATE_KEY],
      gas: "auto", 
      gasPrice: "auto",
      timeout: 300000
    },

    arbitrum: {
      url: ARBITRUM_RPC,
      chainId: 42161,
      accounts: [PRIVATE_KEY],
      gas: "auto",
      gasPrice: "auto", 
      timeout: 300000
    },

    ethereum: {
      url: ETHEREUM_RPC,
      chainId: 1,
      accounts: [PRIVATE_KEY],
      gas: "auto",
      gasPrice: "auto",
      timeout: 300000
    },

    // TESTNETS
    mumbai: {
      url: "https://rpc-mumbai.maticvigil.com",
      chainId: 80001,
      accounts: [PRIVATE_KEY],
      gas: "auto",
      gasPrice: "auto"
    },

    bscTestnet: {
      url: "https://data-seed-prebsc-1-s1.binance.org:8545",
      chainId: 97,
      accounts: [PRIVATE_KEY],
      gas: "auto",
      gasPrice: "auto"
    }
  },

  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
    coinmarketcap: process.env.COINMARKETCAP_API_KEY
  },

  paths: {
    sources: "./contracts-new",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },

  mocha: {
    timeout: 300000
  }
};
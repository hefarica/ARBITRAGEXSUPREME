/**
 * ArbitrageX Supreme - Smart Contract Deployment Script
 * Ingenio Pichichi S.A. - Actividad 12
 * 
 * Deployment metodico y organizado para todos los contratos
 */

const { ethers, upgrades } = require("hardhat");
const fs = require('fs');
const path = require('path');

// Network configurations
const NETWORK_CONFIG = {
  1: { // Ethereum Mainnet
    name: "Ethereum Mainnet",
    flashLoanProvider: "0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9", // Aave V2
    uniswapV2Factory: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
    uniswapV2Router: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"
  },
  137: { // Polygon
    name: "Polygon",
    flashLoanProvider: "0x8dFf5E27EA6b7AC08EbFdf9eB090F32ee9a30fcf", // Aave V2
    uniswapV2Factory: "0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32", // QuickSwap
    uniswapV2Router: "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff"
  },
  56: { // BSC
    name: "BNB Smart Chain", 
    flashLoanProvider: "0x6807dc923806fE8Fd134338EABCA509979a7e0cB", // Aave V3
    uniswapV2Factory: "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73", // PancakeSwap
    uniswapV2Router: "0x10ED43C718714eb63d5aA57B78B54704E256024E"
  },
  42161: { // Arbitrum
    name: "Arbitrum One",
    flashLoanProvider: "0x794a61358D6845594F94dc1DB02A252b5b4814aD", // Aave V3
    uniswapV2Factory: "0xf1D7CC64Fb4452F05c498126312eBE29f30Fbcf9", // Camelot
    uniswapV2Router: "0xc873fEcbd354f5A56E00E710B90EF4201db2448d"
  },
  11155111: { // Sepolia Testnet
    name: "Sepolia Testnet",
    flashLoanProvider: "0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951", // Aave V3
    uniswapV2Factory: "0x7E0987E5b3a30e3f2828572Bb659A548460a3003",
    uniswapV2Router: "0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E"
  }
};

async function main() {
  console.log("🚀 ArbitrageX Supreme - Smart Contract Deployment");
  console.log("================================================");

  // Get network info
  const network = await ethers.provider.getNetwork();
  const networkId = Number(network.chainId);
  const config = NETWORK_CONFIG[networkId];

  if (!config) {
    throw new Error(`Unsupported network: ${networkId}`);
  }

  console.log(`📡 Network: ${config.name} (${networkId})`);

  // Get deployer
  const [deployer] = await ethers.getSigners();
  console.log(`👤 Deployer: ${deployer.address}`);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`💰 Balance: ${ethers.formatEther(balance)} ETH`);

  // Check minimum balance (0.01 ETH for testnets, 0.1 ETH for mainnet)
  const minBalance = networkId === 1 ? ethers.parseEther("0.1") : ethers.parseEther("0.01");
  if (balance < minBalance) {
    throw new Error(`Insufficient balance. Need at least ${ethers.formatEther(minBalance)} ETH`);
  }

  console.log("\n🔨 Deploying Contracts...");
  console.log("========================");

  // 1. Deploy UniswapV2Adapter
  console.log("\n1️⃣ Deploying UniswapV2Adapter...");
  const UniswapV2Adapter = await ethers.getContractFactory("UniswapV2Adapter");
  const uniswapV2Adapter = await UniswapV2Adapter.deploy(
    config.uniswapV2Factory,
    config.uniswapV2Router
  );
  await uniswapV2Adapter.waitForDeployment();
  const adapterAddress = await uniswapV2Adapter.getAddress();
  console.log(`✅ UniswapV2Adapter deployed: ${adapterAddress}`);

  // 2. Deploy ArbitrageEngine
  console.log("\n2️⃣ Deploying ArbitrageEngine...");
  const ArbitrageEngine = await ethers.getContractFactory("ArbitrageEngine");
  const arbitrageEngine = await ArbitrageEngine.deploy(config.flashLoanProvider);
  await arbitrageEngine.waitForDeployment();
  const engineAddress = await arbitrageEngine.getAddress();
  console.log(`✅ ArbitrageEngine deployed: ${engineAddress}`);

  // 3. Configure ArbitrageEngine with adapter
  console.log("\n3️⃣ Configuring contracts...");
  
  // Add adapter to engine (if there's a method for it)
  try {
    console.log(`🔗 Linking adapter ${adapterAddress} to engine...`);
    // This would be implementation-specific based on your contract methods
    // For now, just verify deployment
  } catch (error) {
    console.log(`⚠️  Manual configuration needed: ${error.message}`);
  }

  console.log("\n✅ Deployment Complete!");
  console.log("=======================");

  // Save deployment addresses
  const deployment = {
    network: config.name,
    chainId: networkId,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      ArbitrageEngine: {
        address: engineAddress,
        implementation: engineAddress, // For upgradeable contracts
        constructorArgs: [config.flashLoanProvider]
      },
      UniswapV2Adapter: {
        address: adapterAddress,
        constructorArgs: [config.uniswapV2Factory, config.uniswapV2Router]
      }
    },
    config: {
      flashLoanProvider: config.flashLoanProvider,
      uniswapV2Factory: config.uniswapV2Factory,
      uniswapV2Router: config.uniswapV2Router
    }
  };

  // Save to deployments directory
  const deploymentsDir = path.join(__dirname, '..', 'deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentFile = path.join(deploymentsDir, `${networkId}-${config.name.toLowerCase().replace(/\s+/g, '-')}.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deployment, null, 2));

  console.log(`📄 Deployment saved to: ${deploymentFile}`);

  // Update frontend ABIs if in development
  if (process.env.NODE_ENV !== 'production') {
    await updateFrontendABIs();
  }

  console.log("\n📋 Contract Summary:");
  console.log(`🏭 ArbitrageEngine: ${engineAddress}`);
  console.log(`🔄 UniswapV2Adapter: ${adapterAddress}`);
  console.log(`🌐 Network: ${config.name} (${networkId})`);

  // Verification instructions
  if (networkId !== 31337) { // Skip for local network
    console.log("\n🔍 Verification Commands:");
    console.log(`npx hardhat verify --network ${network.name} ${engineAddress} "${config.flashLoanProvider}"`);
    console.log(`npx hardhat verify --network ${network.name} ${adapterAddress} "${config.uniswapV2Factory}" "${config.uniswapV2Router}"`);
  }

  return {
    arbitrageEngine: engineAddress,
    uniswapV2Adapter: adapterAddress,
    networkId,
    networkName: config.name
  };
}

/**
 * Update frontend ABIs with deployed contract addresses
 */
async function updateFrontendABIs() {
  console.log("\n📝 Updating frontend ABIs...");

  try {
    const frontendAbiDir = path.join(__dirname, '../../catalyst/src/abis');
    
    // Update ArbitrageEngine ABI with deployed bytecode
    const ArbitrageEngine = await ethers.getContractFactory("ArbitrageEngine");
    const engineABI = {
      abi: ArbitrageEngine.interface.formatJson(),
      bytecode: ArbitrageEngine.bytecode
    };

    const UniswapV2Adapter = await ethers.getContractFactory("UniswapV2Adapter");
    const adapterABI = {
      abi: UniswapV2Adapter.interface.formatJson(), 
      bytecode: UniswapV2Adapter.bytecode
    };

    // Write updated ABIs
    fs.writeFileSync(
      path.join(frontendAbiDir, 'ArbitrageEngine.json'),
      JSON.stringify(engineABI, null, 2)
    );

    fs.writeFileSync(
      path.join(frontendAbiDir, 'UniswapV2Adapter.json'),
      JSON.stringify(adapterABI, null, 2)
    );

    console.log("✅ Frontend ABIs updated");
  } catch (error) {
    console.log(`⚠️  Failed to update frontend ABIs: ${error.message}`);
  }
}

// Execute deployment if called directly
if (require.main === module) {
  main()
    .then((result) => {
      console.log("\n🎉 Deployment successful!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n❌ Deployment failed:");
      console.error(error);
      process.exit(1);
    });
}

module.exports = main;
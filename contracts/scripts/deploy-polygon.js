const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying ArbitrageX Pro 2025 to Polygon...");
  
  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log(`📝 Deploying contracts with account: ${deployer.address}`);
  
  // Check deployer balance
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log(`💰 Account balance: ${ethers.formatEther(balance)} MATIC`);
  
  if (balance < ethers.parseEther("1")) {
    console.warn("⚠️  Warning: Low balance, deployment might fail");
  }
  
  // Deploy ArbitrageExecutor (core contract)
  console.log("\n1️⃣ Deploying ArbitrageExecutor...");
  const ArbitrageExecutor = await ethers.getContractFactory("ArbitrageExecutor");
  const arbitrageExecutor = await ArbitrageExecutor.deploy(deployer.address);
  await arbitrageExecutor.waitForDeployment();
  
  const executorAddress = await arbitrageExecutor.getAddress();
  console.log(`✅ ArbitrageExecutor deployed to: ${executorAddress}`);
  
  // Deploy PolygonArbitrage (network-specific contract)
  console.log("\n2️⃣ Deploying PolygonArbitrage...");
  const PolygonArbitrage = await ethers.getContractFactory("PolygonArbitrage");
  const polygonArbitrage = await PolygonArbitrage.deploy();
  await polygonArbitrage.waitForDeployment();
  
  const polygonAddress = await polygonArbitrage.getAddress();
  console.log(`✅ PolygonArbitrage deployed to: ${polygonAddress}`);
  
  // Configure PolygonArbitrage
  console.log("\n3️⃣ Configuring PolygonArbitrage...");
  
  // Set authorized executor (backend service)
  const backendAddress = process.env.BACKEND_EXECUTOR_ADDRESS || deployer.address;
  await polygonArbitrage.setAuthorizedExecutor(backendAddress, true);
  console.log(`✅ Authorized executor set: ${backendAddress}`);
  
  // Set flash loan providers
  const aavePoolPolygon = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
  const balancerVaultPolygon = "0xBA12222222228d8Ba445958a75a0704d566BF2C8";
  
  await polygonArbitrage.setFlashLoanProvider(0, aavePoolPolygon); // AAVE_V3
  await polygonArbitrage.setFlashLoanProvider(1, balancerVaultPolygon); // BALANCER_V2
  console.log("✅ Flash loan providers configured");
  
  // Set DEX routers
  const quickswapRouter = "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff";
  const sushiswapRouter = "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506";
  const uniswapV3Router = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
  
  await polygonArbitrage.setDEXRouter(ethers.keccak256(ethers.toUtf8Bytes("QUICKSWAP")), quickswapRouter);
  await polygonArbitrage.setDEXRouter(ethers.keccak256(ethers.toUtf8Bytes("SUSHISWAP")), sushiswapRouter);
  await polygonArbitrage.setDEXRouter(ethers.keccak256(ethers.toUtf8Bytes("UNISWAP_V3")), uniswapV3Router);
  console.log("✅ DEX routers configured");
  
  // Set gas and profit parameters optimized for Polygon
  await polygonArbitrage.setMaxGasPrice(ethers.parseUnits("100", "gwei")); // 100 gwei max
  await polygonArbitrage.setMinProfitBps(30); // 0.3% minimum profit
  console.log("✅ Gas and profit parameters set");
  
  // Display deployment summary
  console.log("\n📋 POLYGON DEPLOYMENT SUMMARY");
  console.log("═".repeat(50));
  console.log(`Network: Polygon (${hre.network.name})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`ArbitrageExecutor: ${executorAddress}`);
  console.log(`PolygonArbitrage: ${polygonAddress}`);
  console.log(`Gas Price: ${ethers.formatUnits(await deployer.provider.getGasPrice(), "gwei")} gwei`);
  
  // Calculate deployment costs
  const deploymentTx1 = await arbitrageExecutor.deploymentTransaction();
  const deploymentTx2 = await polygonArbitrage.deploymentTransaction();
  
  if (deploymentTx1 && deploymentTx2) {
    const receipt1 = await deploymentTx1.wait();
    const receipt2 = await deploymentTx2.wait();
    const totalGasUsed = receipt1.gasUsed + receipt2.gasUsed;
    const gasPrice = deploymentTx1.gasPrice || await deployer.provider.getGasPrice();
    const totalCost = totalGasUsed * gasPrice;
    
    console.log(`Total Gas Used: ${totalGasUsed.toString()}`);
    console.log(`Total Cost: ${ethers.formatEther(totalCost)} MATIC`);
  }
  
  // Save deployment addresses
  const deployment = {
    network: "polygon",
    chainId: 137,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      ArbitrageExecutor: executorAddress,
      PolygonArbitrage: polygonAddress
    },
    configuration: {
      maxGasPrice: "100000000000", // 100 gwei
      minProfitBps: "30", // 0.3%
      flashLoanProviders: {
        aave: aavePoolPolygon,
        balancer: balancerVaultPolygon
      },
      dexRouters: {
        quickswap: quickswapRouter,
        sushiswap: sushiswapRouter,
        uniswapV3: uniswapV3Router
      }
    }
  };
  
  const fs = require("fs");
  const deploymentPath = "./deployments";
  if (!fs.existsSync(deploymentPath)) {
    fs.mkdirSync(deploymentPath);
  }
  
  fs.writeFileSync(
    `${deploymentPath}/polygon-deployment.json`, 
    JSON.stringify(deployment, null, 2)
  );
  
  console.log(`✅ Deployment info saved to: ${deploymentPath}/polygon-deployment.json`);
  
  // Verification instructions
  console.log("\n🔍 VERIFICATION COMMANDS");
  console.log("═".repeat(50));
  console.log(`npx hardhat verify --network polygon ${executorAddress} "${deployer.address}"`);
  console.log(`npx hardhat verify --network polygon ${polygonAddress}`);
  
  console.log("\n🎉 Polygon deployment completed successfully!");
  
  // Return deployment info for integration
  return {
    arbitrageExecutor: executorAddress,
    polygonArbitrage: polygonAddress,
    network: "polygon"
  };
}

// Handle script execution
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("❌ Deployment failed:", error);
      process.exit(1);
    });
}

module.exports = main;
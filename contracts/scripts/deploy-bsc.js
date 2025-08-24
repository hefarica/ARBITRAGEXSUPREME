const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying ArbitrageX Pro 2025 to BSC...");
  
  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log(`📝 Deploying contracts with account: ${deployer.address}`);
  
  // Check deployer balance
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log(`💰 Account balance: ${ethers.formatEther(balance)} BNB`);
  
  if (balance < ethers.parseEther("0.1")) {
    console.warn("⚠️  Warning: Low balance, deployment might fail");
  }
  
  // Deploy ArbitrageExecutor (core contract)
  console.log("\n1️⃣ Deploying ArbitrageExecutor...");
  const ArbitrageExecutor = await ethers.getContractFactory("ArbitrageExecutor");
  const arbitrageExecutor = await ArbitrageExecutor.deploy(deployer.address);
  await arbitrageExecutor.waitForDeployment();
  
  const executorAddress = await arbitrageExecutor.getAddress();
  console.log(`✅ ArbitrageExecutor deployed to: ${executorAddress}`);
  
  // Deploy BSCArbitrage (network-specific contract)
  console.log("\n2️⃣ Deploying BSCArbitrage...");
  const BSCArbitrage = await ethers.getContractFactory("BSCArbitrage");
  const bscArbitrage = await BSCArbitrage.deploy();
  await bscArbitrage.waitForDeployment();
  
  const bscAddress = await bscArbitrage.getAddress();
  console.log(`✅ BSCArbitrage deployed to: ${bscAddress}`);
  
  // Configure BSCArbitrage
  console.log("\n3️⃣ Configuring BSCArbitrage...");
  
  // Set authorized executor (backend service)
  const backendAddress = process.env.BACKEND_EXECUTOR_ADDRESS || deployer.address;
  await bscArbitrage.setAuthorizedExecutor(backendAddress, true);
  console.log(`✅ Authorized executor set: ${backendAddress}`);
  
  // Set flash loan providers (BSC has limited options initially)
  const dodoProxyBSC = "0x8F8Dd7DB1bDA5eD3da8C9daf3bfa471c12d58486";
  
  await bscArbitrage.setFlashLoanProvider(3, dodoProxyBSC); // DODO
  console.log("✅ Flash loan providers configured");
  
  // Set DEX routers
  const pancakeV2Router = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
  const pancakeV3Router = "0x13f4EA83D0bd40E75C8222255bc855a974568Dd4";
  const biswapRouter = "0x3a6d8cA21D1CF76F653A67577FA0D27453350dD8";
  const sushiswapRouter = "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506";
  const oneInchRouter = "0x11111112542D85B3EF69AE05771c2dCCff3596AE";
  
  await bscArbitrage.setDEXRouter(ethers.keccak256(ethers.toUtf8Bytes("PANCAKESWAP_V2")), pancakeV2Router);
  await bscArbitrage.setDEXRouter(ethers.keccak256(ethers.toUtf8Bytes("PANCAKESWAP_V3")), pancakeV3Router);
  await bscArbitrage.setDEXRouter(ethers.keccak256(ethers.toUtf8Bytes("BISWAP")), biswapRouter);
  await bscArbitrage.setDEXRouter(ethers.keccak256(ethers.toUtf8Bytes("SUSHISWAP")), sushiswapRouter);
  await bscArbitrage.setDEXRouter(ethers.keccak256(ethers.toUtf8Bytes("ONE_INCH_BSC")), oneInchRouter);
  console.log("✅ DEX routers configured");
  
  // Set gas and profit parameters optimized for BSC
  await bscArbitrage.setMaxGasPrice(ethers.parseUnits("20", "gwei")); // 20 gwei max (BSC is cheaper)
  await bscArbitrage.setMinProfitBps(25); // 0.25% minimum profit
  console.log("✅ Gas and profit parameters set");
  
  // Display deployment summary
  console.log("\n📋 BSC DEPLOYMENT SUMMARY");
  console.log("═".repeat(50));
  console.log(`Network: BSC (${hre.network.name})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`ArbitrageExecutor: ${executorAddress}`);
  console.log(`BSCArbitrage: ${bscAddress}`);
  console.log(`Gas Price: ${ethers.formatUnits(await deployer.provider.getGasPrice(), "gwei")} gwei`);
  
  // Calculate deployment costs
  const deploymentTx1 = await arbitrageExecutor.deploymentTransaction();
  const deploymentTx2 = await bscArbitrage.deploymentTransaction();
  
  if (deploymentTx1 && deploymentTx2) {
    const receipt1 = await deploymentTx1.wait();
    const receipt2 = await deploymentTx2.wait();
    const totalGasUsed = receipt1.gasUsed + receipt2.gasUsed;
    const gasPrice = deploymentTx1.gasPrice || await deployer.provider.getGasPrice();
    const totalCost = totalGasUsed * gasPrice;
    
    console.log(`Total Gas Used: ${totalGasUsed.toString()}`);
    console.log(`Total Cost: ${ethers.formatEther(totalCost)} BNB`);
  }
  
  // Save deployment addresses
  const deployment = {
    network: "bsc",
    chainId: 56,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      ArbitrageExecutor: executorAddress,
      BSCArbitrage: bscAddress
    },
    configuration: {
      maxGasPrice: "20000000000", // 20 gwei
      minProfitBps: "25", // 0.25%
      flashLoanProviders: {
        dodo: dodoProxyBSC
      },
      dexRouters: {
        pancakeV2: pancakeV2Router,
        pancakeV3: pancakeV3Router,
        biswap: biswapRouter,
        sushiswap: sushiswapRouter,
        oneInch: oneInchRouter
      }
    }
  };
  
  const fs = require("fs");
  const deploymentPath = "./deployments";
  if (!fs.existsSync(deploymentPath)) {
    fs.mkdirSync(deploymentPath);
  }
  
  fs.writeFileSync(
    `${deploymentPath}/bsc-deployment.json`, 
    JSON.stringify(deployment, null, 2)
  );
  
  console.log(`✅ Deployment info saved to: ${deploymentPath}/bsc-deployment.json`);
  
  // Verification instructions
  console.log("\n🔍 VERIFICATION COMMANDS");
  console.log("═".repeat(50));
  console.log(`npx hardhat verify --network bsc ${executorAddress} "${deployer.address}"`);
  console.log(`npx hardhat verify --network bsc ${bscAddress}`);
  
  console.log("\n🎉 BSC deployment completed successfully!");
  
  // BSC-specific post-deployment tests
  console.log("\n🧪 Running BSC-specific tests...");
  
  try {
    // Test PancakeSwap connectivity
    const pancakeTest = await bscArbitrage.getBSCOptimalPath(
      "0x55d398326f99059fF775485246999027B3197955", // USDT
      "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", // USDC
      ethers.parseUnits("1000", 6)
    );
    console.log("✅ PancakeSwap connectivity test passed");
    
    // Test gas optimization
    const gasInfo = await bscArbitrage.getBSCNetworkInfo();
    console.log(`✅ BSC gas limit: ${gasInfo.gasLimit}`);
    console.log(`✅ Current gas price: ${ethers.formatUnits(gasInfo.gasPrice, "gwei")} gwei`);
    
  } catch (error) {
    console.warn("⚠️ Post-deployment tests failed:", error.message);
  }
  
  // Return deployment info for integration
  return {
    arbitrageExecutor: executorAddress,
    bscArbitrage: bscAddress,
    network: "bsc"
  };
}

// Handle script execution
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("❌ BSC Deployment failed:", error);
      process.exit(1);
    });
}

module.exports = main;
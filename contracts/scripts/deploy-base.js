const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying ArbitrageX Pro 2025 to Base L2...");
  
  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log(`📝 Deploying contracts with account: ${deployer.address}`);
  
  // Check deployer balance
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log(`💰 Account balance: ${ethers.formatEther(balance)} ETH`);
  
  if (balance < ethers.parseEther("0.005")) {
    console.warn("⚠️  Warning: Low balance, deployment might fail");
  }
  
  // Deploy ArbitrageExecutor (core contract)
  console.log("\n1️⃣ Deploying ArbitrageExecutor...");
  const ArbitrageExecutor = await ethers.getContractFactory("ArbitrageExecutor");
  const arbitrageExecutor = await ArbitrageExecutor.deploy(deployer.address);
  await arbitrageExecutor.waitForDeployment();
  
  const executorAddress = await arbitrageExecutor.getAddress();
  console.log(`✅ ArbitrageExecutor deployed to: ${executorAddress}`);
  
  // Deploy BaseArbitrage (Coinbase L2-specific contract)
  console.log("\n2️⃣ Deploying BaseArbitrage...");
  const BaseArbitrage = await ethers.getContractFactory("BaseArbitrage");
  const baseArbitrage = await BaseArbitrage.deploy();
  await baseArbitrage.waitForDeployment();
  
  const baseAddress = await baseArbitrage.getAddress();
  console.log(`✅ BaseArbitrage deployed to: ${baseAddress}`);
  
  // Configure BaseArbitrage
  console.log("\n3️⃣ Configuring BaseArbitrage for Coinbase L2...");
  
  // Set authorized executor (backend service)
  const backendAddress = process.env.BACKEND_EXECUTOR_ADDRESS || deployer.address;
  await baseArbitrage.setAuthorizedExecutor(backendAddress, true);
  console.log(`✅ Authorized executor set: ${backendAddress}`);
  
  // Set flash loan providers on Base (limited initially)
  const uniswapV3RouterBase = "0x2626664c2603336E57B271c5C0b26F421741e481";
  
  await baseArbitrage.setFlashLoanProvider(2, uniswapV3RouterBase); // UNISWAP_V3
  console.log("✅ Flash loan providers configured for Base");
  
  // Set DEX routers
  const sushiswapRouterBase = "0x6BDED42c6DA8FBf0d2bA55B2fa120C5e0c8D7891";
  const pancakeV3RouterBase = "0x678Aa4bF4E210cf2166753e054d5b7c31cc7fa86";
  const baseswapRouter = "0x327Df1E6de05895d2ab08513aaDD9313Fe505d86";
  const aerodromeRouter = "0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43";
  const oneInchRouterBase = "0x11111112542D85B3EF69AE05771c2dCCff3596AE";
  
  await baseArbitrage.setDEXRouter(ethers.keccak256(ethers.toUtf8Bytes("UNISWAP_V3_BASE")), uniswapV3RouterBase);
  await baseArbitrage.setDEXRouter(ethers.keccak256(ethers.toUtf8Bytes("SUSHISWAP_BASE")), sushiswapRouterBase);
  await baseArbitrage.setDEXRouter(ethers.keccak256(ethers.toUtf8Bytes("PANCAKESWAP_V3_BASE")), pancakeV3RouterBase);
  await baseArbitrage.setDEXRouter(ethers.keccak256(ethers.toUtf8Bytes("BASESWAP")), baseswapRouter);
  await baseArbitrage.setDEXRouter(ethers.keccak256(ethers.toUtf8Bytes("AERODROME")), aerodromeRouter);
  await baseArbitrage.setDEXRouter(ethers.keccak256(ethers.toUtf8Bytes("ONE_INCH_BASE")), oneInchRouterBase);
  console.log("✅ DEX routers configured for Base");
  
  // Set ultra-low gas parameters for Base L2
  await baseArbitrage.setMaxGasPrice(ethers.parseUnits("3", "gwei")); // 3 gwei max (cheapest L2)
  await baseArbitrage.setMinProfitBps(10); // 0.1% minimum profit (ultra-low due to gas)
  console.log("✅ Ultra-low gas parameters set for Base");
  
  // Display deployment summary
  console.log("\n📋 BASE L2 DEPLOYMENT SUMMARY");
  console.log("═".repeat(50));
  console.log(`Network: Base L2 (${hre.network.name})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`ArbitrageExecutor: ${executorAddress}`);
  console.log(`BaseArbitrage: ${baseAddress}`);
  console.log(`Gas Price: ${ethers.formatUnits(await deployer.provider.getGasPrice(), "gwei")} gwei`);
  
  // Calculate deployment costs for Base L2
  const deploymentTx1 = await arbitrageExecutor.deploymentTransaction();
  const deploymentTx2 = await baseArbitrage.deploymentTransaction();
  
  if (deploymentTx1 && deploymentTx2) {
    const receipt1 = await deploymentTx1.wait();
    const receipt2 = await deploymentTx2.wait();
    const totalGasUsed = receipt1.gasUsed + receipt2.gasUsed;
    const gasPrice = deploymentTx1.gasPrice || await deployer.provider.getGasPrice();
    const totalCost = totalGasUsed * gasPrice;
    
    console.log(`Total L2 Gas Used: ${totalGasUsed.toString()}`);
    console.log(`Total L2 Cost: ${ethers.formatEther(totalCost)} ETH`);
    console.log(`💰 Ultra-low deployment cost on Base!`);
  }
  
  // Test Base-specific features
  console.log("\n🧪 Testing Base L2 Coinbase features...");
  
  try {
    // Test gas info
    const gasInfo = await baseArbitrage.getBaseGasInfo();
    console.log(`✅ Current gas price: ${ethers.formatUnits(gasInfo.gasPrice, "gwei")} gwei`);
    console.log(`✅ Gas limit: ${gasInfo.gasLimit.toString()}`);
    console.log(`✅ L1 fee estimate: ${ethers.formatEther(gasInfo.l1Fee)} ETH`);
    
    // Test Base-specific opportunities
    const opportunities = await baseArbitrage.checkBaseOpportunities();
    console.log(`✅ Stablecoin arbitrage available: ${opportunities.hasStablecoinArb}`);
    console.log(`✅ ETH/cbETH arbitrage available: ${opportunities.hasETHArb}`);
    console.log(`✅ Cross-DEX opportunities: ${opportunities.hasCrossDEXArb}`);
    
    // Test optimal path for Base tokens
    const WETH = "0x4200000000000000000000000000000000000006";
    const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
    const optimalPath = await baseArbitrage.getBaseOptimalPath(WETH, USDC, ethers.parseEther("1"));
    console.log("✅ Base optimal arbitrage path calculation working");
    
  } catch (error) {
    console.warn("⚠️ Base L2 feature tests failed:", error.message);
  }
  
  // Save deployment addresses
  const deployment = {
    network: "base",
    chainId: 8453,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      ArbitrageExecutor: executorAddress,
      BaseArbitrage: baseAddress
    },
    configuration: {
      maxGasPrice: "3000000000", // 3 gwei (ultra-low)
      minProfitBps: "10", // 0.1% (ultra-low threshold)
      flashLoanProviders: {
        uniswapV3: uniswapV3RouterBase
      },
      dexRouters: {
        uniswapV3: uniswapV3RouterBase,
        sushiswap: sushiswapRouterBase,
        pancakeV3: pancakeV3RouterBase,
        baseswap: baseswapRouter,
        aerodrome: aerodromeRouter,
        oneInch: oneInchRouterBase
      }
    },
    baseFeatures: {
      coinbaseIntegration: true,
      ultraLowGas: true,
      stablecoinArbitrage: "USDC/USDbC",
      ethVariants: "WETH/cbETH",
      nativeDEX: "Aerodrome"
    }
  };
  
  const fs = require("fs");
  const deploymentPath = "./deployments";
  if (!fs.existsSync(deploymentPath)) {
    fs.mkdirSync(deploymentPath);
  }
  
  fs.writeFileSync(
    `${deploymentPath}/base-deployment.json`, 
    JSON.stringify(deployment, null, 2)
  );
  
  console.log(`✅ Deployment info saved to: ${deploymentPath}/base-deployment.json`);
  
  // Verification instructions
  console.log("\n🔍 VERIFICATION COMMANDS");
  console.log("═".repeat(50));
  console.log(`npx hardhat verify --network base ${executorAddress} "${deployer.address}"`);
  console.log(`npx hardhat verify --network base ${baseAddress}`);
  
  console.log("\n🎉 Base L2 deployment completed successfully!");
  console.log("🚀 Ready for ultra-low-cost arbitrage on Coinbase's L2!");
  console.log("💡 Special features: USDC/USDbC and WETH/cbETH arbitrage enabled!");
  
  // Return deployment info for integration
  return {
    arbitrageExecutor: executorAddress,
    baseArbitrage: baseAddress,
    network: "base"
  };
}

// Handle script execution
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("❌ Base L2 deployment failed:", error);
      process.exit(1);
    });
}

module.exports = main;
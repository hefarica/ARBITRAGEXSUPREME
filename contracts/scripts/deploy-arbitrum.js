const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
  console.log("🚀 Deploying ArbitrageX Pro 2025 to Arbitrum...");
  
  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log(`📝 Deploying contracts with account: ${deployer.address}`);
  
  // Check deployer balance
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log(`💰 Account balance: ${ethers.formatEther(balance)} ETH`);
  
  if (balance < ethers.parseEther("0.01")) {
    console.warn("⚠️  Warning: Low balance, deployment might fail");
  }
  
  // Deploy ArbitrageExecutor (core contract)
  console.log("\n1️⃣ Deploying ArbitrageExecutor...");
  const ArbitrageExecutor = await ethers.getContractFactory("ArbitrageExecutor");
  const arbitrageExecutor = await ArbitrageExecutor.deploy(deployer.address);
  await arbitrageExecutor.waitForDeployment();
  
  const executorAddress = await arbitrageExecutor.getAddress();
  console.log(`✅ ArbitrageExecutor deployed to: ${executorAddress}`);
  
  // Deploy ArbitrumArbitrage (L2-specific contract)
  console.log("\n2️⃣ Deploying ArbitrumArbitrage...");
  const ArbitrumArbitrage = await ethers.getContractFactory("ArbitrumArbitrage");
  const arbitrumArbitrage = await ArbitrumArbitrage.deploy();
  await arbitrumArbitrage.waitForDeployment();
  
  const arbitrumAddress = await arbitrumArbitrage.getAddress();
  console.log(`✅ ArbitrumArbitrage deployed to: ${arbitrumAddress}`);
  
  // Configure ArbitrumArbitrage
  console.log("\n3️⃣ Configuring ArbitrumArbitrage for L2 optimization...");
  
  // Set authorized executor (backend service)
  const backendAddress = process.env.BACKEND_EXECUTOR_ADDRESS || deployer.address;
  await arbitrumArbitrage.setAuthorizedExecutor(backendAddress, true);
  console.log(`✅ Authorized executor set: ${backendAddress}`);
  
  // Set flash loan providers on Arbitrum
  const aavePoolArbitrum = "0x794a61358D6845594F94dc1DB02A252b5b4814aD";
  const balancerVaultArbitrum = "0xBA12222222228d8Ba445958a75a0704d566BF2C8";
  const uniswapV3Router = "0xE592427A0AEce92De3Edee1F18E0157C05861564";
  
  await arbitrumArbitrage.setFlashLoanProvider(0, aavePoolArbitrum); // AAVE_V3
  await arbitrumArbitrage.setFlashLoanProvider(1, balancerVaultArbitrum); // BALANCER_V2
  await arbitrumArbitrage.setFlashLoanProvider(2, uniswapV3Router); // UNISWAP_V3
  console.log("✅ Flash loan providers configured for Arbitrum");
  
  // Set DEX routers
  const sushiswapRouter = "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506";
  const camelotRouter = "0xc873fEcbd354f5A56E00E710B90EF4201db2448d";
  const gmxRouter = "0xaBBc5F99639c9B6bCb58544862310933d4";
  const oneInchRouter = "0x11111112542D85B3EF69AE05771c2dCCff3596AE";
  
  await arbitrumArbitrage.setDEXRouter(ethers.keccak256(ethers.toUtf8Bytes("UNISWAP_V3_ARB")), uniswapV3Router);
  await arbitrumArbitrage.setDEXRouter(ethers.keccak256(ethers.toUtf8Bytes("SUSHISWAP_ARB")), sushiswapRouter);
  await arbitrumArbitrage.setDEXRouter(ethers.keccak256(ethers.toUtf8Bytes("CAMELOT")), camelotRouter);
  await arbitrumArbitrage.setDEXRouter(ethers.keccak256(ethers.toUtf8Bytes("GMX")), gmxRouter);
  await arbitrumArbitrage.setDEXRouter(ethers.keccak256(ethers.toUtf8Bytes("ONE_INCH_ARB")), oneInchRouter);
  console.log("✅ DEX routers configured for Arbitrum");
  
  // Set L2-optimized parameters
  await arbitrumArbitrage.setMaxGasPrice(ethers.parseUnits("5", "gwei")); // 5 gwei max for L2
  await arbitrumArbitrage.setMinProfitBps(15); // 0.15% minimum profit (L2 advantage)
  console.log("✅ L2-optimized parameters set");
  
  // Display deployment summary
  console.log("\n📋 ARBITRUM DEPLOYMENT SUMMARY");
  console.log("═".repeat(50));
  console.log(`Network: Arbitrum L2 (${hre.network.name})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`ArbitrageExecutor: ${executorAddress}`);
  console.log(`ArbitrumArbitrage: ${arbitrumAddress}`);
  console.log(`Gas Price: ${ethers.formatUnits(await deployer.provider.getGasPrice(), "gwei")} gwei`);
  
  // Calculate L1 + L2 costs for Arbitrum
  const deploymentTx1 = await arbitrageExecutor.deploymentTransaction();
  const deploymentTx2 = await arbitrumArbitrage.deploymentTransaction();
  
  if (deploymentTx1 && deploymentTx2) {
    const receipt1 = await deploymentTx1.wait();
    const receipt2 = await deploymentTx2.wait();
    const totalGasUsed = receipt1.gasUsed + receipt2.gasUsed;
    const gasPrice = deploymentTx1.gasPrice || await deployer.provider.getGasPrice();
    const totalCost = totalGasUsed * gasPrice;
    
    console.log(`Total L2 Gas Used: ${totalGasUsed.toString()}`);
    console.log(`Total L2 Cost: ${ethers.formatEther(totalCost)} ETH`);
    console.log(`L1 Data Cost: ~${ethers.formatEther(totalCost / 10n)} ETH (estimated)`);
  }
  
  // Test Arbitrum-specific features
  console.log("\n🧪 Testing Arbitrum L2 features...");
  
  try {
    // Test gas cost calculation
    const gasCosts = await arbitrumArbitrage.getArbitrumGasCosts(200000);
    console.log(`✅ L2 Gas Cost: ${ethers.formatEther(gasCosts.l2Cost)} ETH`);
    console.log(`✅ L1 Data Cost: ${ethers.formatEther(gasCosts.l1Cost)} ETH`);
    console.log(`✅ Total Cost: ${ethers.formatEther(gasCosts.totalCost)} ETH`);
    
    // Test optimal path finding
    const WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
    const USDC = "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8";
    const optimalPath = await arbitrumArbitrage.getArbitrumOptimalPath(WETH, USDC, ethers.parseEther("1"));
    console.log("✅ Optimal arbitrage path calculation working");
    
  } catch (error) {
    console.warn("⚠️ L2 feature tests failed:", error.message);
  }
  
  // Save deployment addresses
  const deployment = {
    network: "arbitrum",
    chainId: 42161,
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      ArbitrageExecutor: executorAddress,
      ArbitrumArbitrage: arbitrumAddress
    },
    configuration: {
      maxGasPrice: "5000000000", // 5 gwei
      minProfitBps: "15", // 0.15%
      flashLoanProviders: {
        aave: aavePoolArbitrum,
        balancer: balancerVaultArbitrum,
        uniswapV3: uniswapV3Router
      },
      dexRouters: {
        uniswapV3: uniswapV3Router,
        sushiswap: sushiswapRouter,
        camelot: camelotRouter,
        gmx: gmxRouter,
        oneInch: oneInchRouter
      }
    },
    l2Features: {
      lowGasCosts: true,
      highThroughput: true,
      ethereumSecurity: true
    }
  };
  
  const fs = require("fs");
  const deploymentPath = "./deployments";
  if (!fs.existsSync(deploymentPath)) {
    fs.mkdirSync(deploymentPath);
  }
  
  fs.writeFileSync(
    `${deploymentPath}/arbitrum-deployment.json`, 
    JSON.stringify(deployment, null, 2)
  );
  
  console.log(`✅ Deployment info saved to: ${deploymentPath}/arbitrum-deployment.json`);
  
  // Verification instructions
  console.log("\n🔍 VERIFICATION COMMANDS");
  console.log("═".repeat(50));
  console.log(`npx hardhat verify --network arbitrum ${executorAddress} "${deployer.address}"`);
  console.log(`npx hardhat verify --network arbitrum ${arbitrumAddress}`);
  
  console.log("\n🎉 Arbitrum L2 deployment completed successfully!");
  console.log("💡 Ready for high-frequency, low-cost arbitrage on Layer 2!");
  
  // Return deployment info for integration
  return {
    arbitrageExecutor: executorAddress,
    arbitrumArbitrage: arbitrumAddress,
    network: "arbitrum"
  };
}

// Handle script execution
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("❌ Arbitrum deployment failed:", error);
      process.exit(1);
    });
}

module.exports = main;
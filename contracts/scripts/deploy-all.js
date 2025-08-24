const hre = require("hardhat");
const { ethers } = require("hardhat");

// Import individual deployment scripts
const deployPolygon = require("./deploy-polygon");
const deployBSC = require("./deploy-bsc");
const deployArbitrum = require("./deploy-arbitrum");
const deployBase = require("./deploy-base");

/**
 * @title Deploy All Networks
 * @dev Master deployment script for ArbitrageX Pro 2025 Smart Contracts
 * @author ArbitrageX Team
 */
async function main() {
  console.log("🚀 ARBITRAGEX PRO 2025 - MULTI-CHAIN DEPLOYMENT");
  console.log("═".repeat(60));
  console.log("🎯 Deploying smart contracts to 4 low-gas blockchains");
  console.log("⚡ Priority: Polygon → BSC → Arbitrum → Base");
  console.log("");

  const deployments = {};
  const deploymentOrder = [
    { name: "Polygon", network: "polygon", deployer: deployPolygon },
    { name: "BSC", network: "bsc", deployer: deployBSC },
    { name: "Arbitrum", network: "arbitrum", deployer: deployArbitrum },
    { name: "Base", network: "base", deployer: deployBase }
  ];

  let totalSuccessful = 0;
  let totalFailed = 0;
  const deploymentResults = [];

  for (let i = 0; i < deploymentOrder.length; i++) {
    const { name, network, deployer } = deploymentOrder[i];
    
    console.log(`\n${'🚀'.repeat(3)} DEPLOYING TO ${name.toUpperCase()} (${i + 1}/${deploymentOrder.length}) ${'🚀'.repeat(3)}`);
    console.log("─".repeat(60));

    try {
      // Switch to target network
      console.log(`🔗 Switching to ${network} network...`);
      
      // Check if we're on the correct network
      const currentNetwork = hre.network.name;
      if (currentNetwork !== network && currentNetwork !== "hardhat") {
        console.warn(`⚠️  Current network (${currentNetwork}) doesn't match target (${network})`);
        console.log(`💡 Run: hardhat run scripts/deploy-${network}.js --network ${network}`);
        
        deploymentResults.push({
          network: name,
          status: "skipped",
          reason: "Network mismatch"
        });
        continue;
      }

      // Execute deployment
      const result = await deployer();
      
      deployments[network] = {
        network: name,
        chainId: getChainId(network),
        contracts: result,
        status: "success",
        timestamp: new Date().toISOString()
      };

      deploymentResults.push({
        network: name,
        status: "success",
        contracts: result
      });

      totalSuccessful++;
      console.log(`✅ ${name} deployment completed successfully!`);
      
      // Add delay between deployments to avoid rate limiting
      if (i < deploymentOrder.length - 1) {
        console.log("⏳ Waiting 3 seconds before next deployment...");
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

    } catch (error) {
      console.error(`❌ ${name} deployment failed:`, error.message);
      
      deploymentResults.push({
        network: name,
        status: "failed",
        error: error.message
      });

      totalFailed++;
      
      // Continue with next deployment even if one fails
      console.log("🔄 Continuing with next network...");
    }
  }

  // Generate comprehensive deployment report
  console.log("\n" + "═".repeat(60));
  console.log("📋 MULTI-CHAIN DEPLOYMENT SUMMARY");
  console.log("═".repeat(60));
  
  console.log(`✅ Successful deployments: ${totalSuccessful}/${deploymentOrder.length}`);
  console.log(`❌ Failed deployments: ${totalFailed}/${deploymentOrder.length}`);
  console.log(`📊 Success rate: ${((totalSuccessful / deploymentOrder.length) * 100).toFixed(1)}%`);

  console.log("\n📋 DEPLOYMENT DETAILS:");
  console.log("─".repeat(60));

  deploymentResults.forEach(result => {
    const statusIcon = result.status === "success" ? "✅" : 
                      result.status === "failed" ? "❌" : "⏭️";
    
    console.log(`${statusIcon} ${result.network}: ${result.status.toUpperCase()}`);
    
    if (result.contracts) {
      console.log(`   └── ArbitrageExecutor: ${result.contracts.arbitrageExecutor}`);
      console.log(`   └── Network Contract: ${result.contracts[Object.keys(result.contracts)[1]]}`);
    }
    
    if (result.error) {
      console.log(`   └── Error: ${result.error}`);
    }
  });

  // Save master deployment file
  const masterDeployment = {
    timestamp: new Date().toISOString(),
    version: "2.0.0",
    deployer: process.env.DEPLOYER_ADDRESS || "Unknown",
    networks: deployments,
    summary: {
      totalNetworks: deploymentOrder.length,
      successful: totalSuccessful,
      failed: totalFailed,
      successRate: ((totalSuccessful / deploymentOrder.length) * 100).toFixed(1) + "%"
    },
    gasOptimization: {
      polygon: { maxGas: "100 gwei", minProfit: "0.30%" },
      bsc: { maxGas: "20 gwei", minProfit: "0.25%" },
      arbitrum: { maxGas: "5 gwei", minProfit: "0.15%" },
      base: { maxGas: "3 gwei", minProfit: "0.10%" }
    },
    flashLoanSupport: {
      polygon: ["Aave V3", "Balancer V2"],
      bsc: ["DODO"],
      arbitrum: ["Aave V3", "Balancer V2", "Uniswap V3"],
      base: ["Uniswap V3"]
    }
  };

  const fs = require("fs");
  const deploymentPath = "./deployments";
  if (!fs.existsSync(deploymentPath)) {
    fs.mkdirSync(deploymentPath);
  }

  fs.writeFileSync(
    `${deploymentPath}/master-deployment.json`,
    JSON.stringify(masterDeployment, null, 2)
  );

  console.log(`\n💾 Master deployment file saved: ${deploymentPath}/master-deployment.json`);

  // Generate deployment integration guide
  console.log("\n🔧 INTEGRATION GUIDE:");
  console.log("─".repeat(60));
  
  console.log("1. 📋 Copy contract addresses from deployment files");
  console.log("2. 🔗 Update backend configuration with new addresses");
  console.log("3. 🧪 Run integration tests on testnets first");
  console.log("4. 📊 Monitor gas costs and adjust parameters if needed");
  console.log("5. 🚀 Enable arbitrage strategies gradually");

  if (totalSuccessful === deploymentOrder.length) {
    console.log("\n🎉 ALL DEPLOYMENTS SUCCESSFUL!");
    console.log("🌟 ArbitrageX Pro 2025 smart contracts are now live on 4 blockchains!");
    console.log("⚡ Ready for hybrid JavaScript + Solidity arbitrage!");
  } else if (totalSuccessful > 0) {
    console.log("\n⚠️  PARTIAL DEPLOYMENT COMPLETED");
    console.log(`✅ ${totalSuccessful} networks deployed successfully`);
    console.log(`❌ ${totalFailed} networks need retry`);
    console.log("🔄 Re-run individual deployment scripts for failed networks");
  } else {
    console.log("\n❌ ALL DEPLOYMENTS FAILED");
    console.log("🔍 Check network configurations and try again");
  }

  console.log("\n📚 Next steps:");
  console.log("   1. Verify contracts on block explorers");
  console.log("   2. Test arbitrage functions on testnets");
  console.log("   3. Integrate with existing JavaScript backend");
  console.log("   4. Deploy monitoring and alerting");
  console.log("   5. Start with small amounts and scale up");

  return {
    deployments,
    summary: masterDeployment.summary,
    results: deploymentResults
  };
}

function getChainId(network) {
  const chainIds = {
    ethereum: 1,
    polygon: 137,
    bsc: 56,
    arbitrum: 42161,
    base: 8453,
    optimism: 10,
    avalanche: 43114,
    fantom: 250
  };
  return chainIds[network] || 0;
}

// Handle script execution
if (require.main === module) {
  main()
    .then(() => {
      console.log("\n🏁 Multi-chain deployment process completed!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n💥 Multi-chain deployment process failed:", error);
      process.exit(1);
    });
}

module.exports = main;
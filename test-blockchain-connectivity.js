#!/usr/bin/env node
/**
 * ArbitrageX Pro 2025 - Blockchain Connectivity Test
 * Tests blockchain connections with real RPC endpoints
 */

require('dotenv').config({ path: './apps/api/.env' });

const { ethers } = require('ethers');

const NETWORKS = {
  ethereum: {
    name: 'Ethereum Mainnet',
    rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/demo',
    chainId: 1
  },
  bsc: {
    name: 'BNB Smart Chain',
    rpcUrl: process.env.BSC_RPC_URL || 'https://bsc-dataseed1.binance.org',
    chainId: 56
  },
  polygon: {
    name: 'Polygon Mainnet',
    rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-mainnet.g.alchemy.com/v2/demo',
    chainId: 137
  },
  arbitrum: {
    name: 'Arbitrum One',
    rpcUrl: process.env.ARBITRUM_RPC_URL || 'https://arb-mainnet.g.alchemy.com/v2/demo',
    chainId: 42161
  },
  optimism: {
    name: 'Optimism',
    rpcUrl: process.env.OPTIMISM_RPC_URL || 'https://opt-mainnet.g.alchemy.com/v2/demo',
    chainId: 10
  }
};

async function testNetworkConnection(networkId, config) {
  console.log(`\n🔍 Testing ${config.name}...`);
  
  try {
    const provider = new ethers.JsonRpcProvider(config.rpcUrl);
    
    // Test 1: Get network info
    const network = await provider.getNetwork();
    console.log(`  ✅ Network connected: Chain ID ${network.chainId}`);
    
    // Test 2: Get latest block
    const blockNumber = await provider.getBlockNumber();
    console.log(`  ✅ Latest block: ${blockNumber}`);
    
    // Test 3: Get block details
    const block = await provider.getBlock('latest');
    console.log(`  ✅ Block timestamp: ${new Date(block.timestamp * 1000).toISOString()}`);
    
    // Test 4: Check gas price
    const gasPrice = await provider.getFeeData();
    const gasPriceGwei = ethers.formatUnits(gasPrice.gasPrice || 0, 'gwei');
    console.log(`  ✅ Gas price: ${gasPriceGwei} gwei`);
    
    return {
      networkId,
      name: config.name,
      status: 'connected',
      chainId: Number(network.chainId),
      blockNumber,
      gasPrice: gasPriceGwei,
      timestamp: new Date(block.timestamp * 1000).toISOString()
    };
  } catch (error) {
    console.log(`  ❌ Connection failed: ${error.message}`);
    return {
      networkId,
      name: config.name,
      status: 'failed',
      error: error.message
    };
  }
}

async function testAllNetworks() {
  console.log('🚀 ArbitrageX Pro 2025 - Blockchain Connectivity Test');
  console.log('=' .repeat(60));
  
  const results = [];
  
  for (const [networkId, config] of Object.entries(NETWORKS)) {
    const result = await testNetworkConnection(networkId, config);
    results.push(result);
  }
  
  console.log('\n📊 CONNECTIVITY SUMMARY');
  console.log('=' .repeat(60));
  
  const connected = results.filter(r => r.status === 'connected');
  const failed = results.filter(r => r.status === 'failed');
  
  console.log(`✅ Connected: ${connected.length}/${results.length} networks`);
  console.log(`❌ Failed: ${failed.length}/${results.length} networks`);
  
  if (connected.length > 0) {
    console.log('\n🟢 CONNECTED NETWORKS:');
    connected.forEach(r => {
      console.log(`  • ${r.name} (Chain ${r.chainId}): Block ${r.blockNumber}, Gas ${r.gasPrice} gwei`);
    });
  }
  
  if (failed.length > 0) {
    console.log('\n🔴 FAILED NETWORKS:');
    failed.forEach(r => {
      console.log(`  • ${r.name}: ${r.error}`);
    });
  }
  
  console.log('\n🎯 NEXT STEPS:');
  if (failed.length > 0 && failed.some(f => f.error.includes('demo'))) {
    console.log('  1. Get free Alchemy API keys: https://alchemy.com');
    console.log('  2. Update .env file with real API keys');
    console.log('  3. Re-run this test');
  } else if (connected.length >= 3) {
    console.log('  ✅ Blockchain connectivity is ready!');
    console.log('  ✅ ArbitrageX can scan for opportunities');
    console.log('  🚀 Ready to start the API server');
  } else {
    console.log('  ⚠️  Need at least 3 connected networks for optimal arbitrage');
    console.log('  📝 Check RPC endpoint configuration');
  }
  
  console.log('\n' + '=' .repeat(60));
  console.log(`🕒 Test completed at: ${new Date().toISOString()}`);
  
  return {
    total: results.length,
    connected: connected.length,
    failed: failed.length,
    results,
    ready: connected.length >= 3
  };
}

// Run the test
testAllNetworks().catch(console.error);
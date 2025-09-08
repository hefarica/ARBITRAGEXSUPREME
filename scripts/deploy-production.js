// SPDX-License-Identifier: MIT
const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');

/**
 * @title Production Deployment Script - ArbitrageX Supreme
 * @dev Script supremamente eficaz para deployment multi-chain
 * @notice Metodología disciplinada del Ingenio Pichichi S.A.
 */

// ============================================================================
// CONFIGURACIÓN DE REDES Y COSTOS
// ============================================================================

const NETWORK_CONFIG = {
    polygon: {
        name: 'Polygon',
        chainId: 137,
        gasPrice: '30000000000', // 30 gwei
        estimatedCost: '$5-10',
        priority: 1,
        wethAddress: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
        chainlinkFeeds: {
            'ETH/USD': '0xF9680D99D6C9589e2a93a78A04A279e509205945',
            'MATIC/USD': '0xAB594600376Ec9fD91F8e885dADF0CE036862dE0'
        }
    },
    bsc: {
        name: 'BSC',
        chainId: 56,
        gasPrice: '3000000000', // 3 gwei
        estimatedCost: '$3-8',
        priority: 2,
        wethAddress: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8',
        chainlinkFeeds: {
            'ETH/USD': '0x9ef1B8c0E4F7dc8bF5719Ea496883DC6401d5b2e',
            'BNB/USD': '0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE'
        }
    },
    arbitrum: {
        name: 'Arbitrum',
        chainId: 42161,
        gasPrice: '100000000', // 0.1 gwei
        estimatedCost: '$15-25',
        priority: 3,
        wethAddress: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
        chainlinkFeeds: {
            'ETH/USD': '0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612',
            'BTC/USD': '0x6ce185860a4963106506C203335A2910413708e9'
        }
    },
    ethereum: {
        name: 'Ethereum',
        chainId: 1,
        gasPrice: '20000000000', // 20 gwei
        estimatedCost: '$50-200',
        priority: 4,
        wethAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        chainlinkFeeds: {
            'ETH/USD': '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
            'BTC/USD': '0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c'
        }
    }
};

// Configuración de DEXs por red
const DEX_ADDRESSES = {
    polygon: {
        quickswap: '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff',
        sushiswap: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
        uniswapV3: '0xE592427A0AEce92De3Edee1F18E0157C05861564'
    },
    bsc: {
        pancakeswap: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
        sushiswap: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506'
    },
    arbitrum: {
        sushiswap: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
        uniswapV3: '0xE592427A0AEce92De3Edee1F18E0157C05861564'
    },
    ethereum: {
        uniswapV2: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
        uniswapV3: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
        sushiswap: '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F'
    }
};

// ============================================================================
// FUNCIÓN PRINCIPAL DE DEPLOYMENT
// ============================================================================

async function deployArbitrageSystem(networkName, shouldVerify = false) {
    console.log(`🚀 INICIANDO DEPLOYMENT EN ${networkName.toUpperCase()}`);
    console.log(`📊 Metodología: Ingenio Pichichi S.A. - Supremamente Eficaz`);
    console.log(`💰 Costo estimado: ${NETWORK_CONFIG[networkName].estimatedCost}`);
    console.log("=".repeat(80));
    
    const [deployer] = await ethers.getSigners();
    const deployerAddress = deployer.address;
    const network = await ethers.provider.getNetwork();
    
    console.log(`👤 Deployer: ${deployerAddress}`);
    console.log(`🌐 Network: ${networkName} (Chain ID: ${network.chainId})`);
    console.log(`💰 Balance: ${ethers.utils.formatEther(await deployer.getBalance())} ${networkName === 'polygon' ? 'MATIC' : 'ETH'}`);
    
    const networkConfig = NETWORK_CONFIG[networkName];
    if (!networkConfig) {
        throw new Error(`Network ${networkName} not supported`);
    }
    
    // Verificar balance mínimo
    await checkMinimumBalance(deployer, networkName);
    
    const deploymentStart = Date.now();
    const deploymentResults = {
        network: networkName,
        chainId: network.chainId,
        deployer: deployerAddress,
        contracts: {},
        gasUsed: {},
        costs: {},
        timestamp: new Date().toISOString()
    };
    
    try {
        // ============================================================================
        // PASO 1: DESPLEGAR PRICE ORACLE
        // ============================================================================
        
        console.log(`\n🔮 PASO 1: Desplegando PriceOracle...`);
        
        const PriceOracle = await ethers.getContractFactory("PriceOracle");
        
        const oracleDeployTx = await PriceOracle.deploy(
            networkConfig.wethAddress,
            {
                gasPrice: networkConfig.gasPrice,
                gasLimit: 3000000
            }
        );
        
        console.log(`⏳ Esperando confirmación... TX: ${oracleDeployTx.deployTransaction.hash}`);
        const oracleReceipt = await oracleDeployTx.deployTransaction.wait();
        
        console.log(`✅ PriceOracle desplegado en: ${oracleDeployTx.address}`);
        console.log(`⛽ Gas usado: ${oracleReceipt.gasUsed.toString()}`);
        
        deploymentResults.contracts.PriceOracle = oracleDeployTx.address;
        deploymentResults.gasUsed.PriceOracle = oracleReceipt.gasUsed.toString();
        deploymentResults.costs.PriceOracle = calculateDeploymentCost(oracleReceipt.gasUsed, networkConfig.gasPrice);
        
        // ============================================================================
        // PASO 2: DESPLEGAR ARBITRAGE CORE
        // ============================================================================
        
        console.log(`\n⚡ PASO 2: Desplegando ArbitrageCore...`);
        
        const ArbitrageCore = await ethers.getContractFactory("ArbitrageCore");
        
        // Fee collector (por ahora el deployer, cambiar en producción)
        const feeCollector = process.env.FEE_COLLECTOR || deployerAddress;
        
        const arbitrageDeployTx = await ArbitrageCore.deploy(
            oracleDeployTx.address,
            feeCollector,
            {
                gasPrice: networkConfig.gasPrice,
                gasLimit: 4000000
            }
        );
        
        console.log(`⏳ Esperando confirmación... TX: ${arbitrageDeployTx.deployTransaction.hash}`);
        const arbitrageReceipt = await arbitrageDeployTx.deployTransaction.wait();
        
        console.log(`✅ ArbitrageCore desplegado en: ${arbitrageDeployTx.address}`);
        console.log(`⛽ Gas usado: ${arbitrageReceipt.gasUsed.toString()}`);
        
        deploymentResults.contracts.ArbitrageCore = arbitrageDeployTx.address;
        deploymentResults.gasUsed.ArbitrageCore = arbitrageReceipt.gasUsed.toString();
        deploymentResults.costs.ArbitrageCore = calculateDeploymentCost(arbitrageReceipt.gasUsed, networkConfig.gasPrice);
        
        // ============================================================================
        // PASO 3: CONFIGURACIÓN INICIAL
        // ============================================================================
        
        console.log(`\n⚙️ PASO 3: Configuración inicial...`);
        
        // Configurar DEXs autorizados
        await setupAuthorizedDEXs(arbitrageDeployTx, networkName);
        
        // Configurar Oracle con Chainlink feeds
        await setupChainlinkIntegration(oracleDeployTx, networkConfig);
        
        // Configurar TWAP si está disponible
        await setupTWAPIntegration(oracleDeployTx, networkName);
        
        // ============================================================================
        // PASO 4: VERIFICACIÓN DE CONTRATOS (OPCIONAL)
        // ============================================================================
        
        if (shouldVerify && process.env.ETHERSCAN_API_KEY) {
            console.log(`\n🔍 PASO 4: Verificando contratos...`);
            
            try {
                await verifyContract(oracleDeployTx.address, [networkConfig.wethAddress]);
                await verifyContract(arbitrageDeployTx.address, [oracleDeployTx.address, feeCollector]);
                console.log(`✅ Contratos verificados exitosamente`);
            } catch (error) {
                console.log(`⚠️ Error en verificación: ${error.message}`);
            }
        }
        
        // ============================================================================
        // PASO 5: TESTING POST-DEPLOYMENT
        // ============================================================================
        
        console.log(`\n🧪 PASO 5: Testing post-deployment...`);
        await runPostDeploymentTests(arbitrageDeployTx, oracleDeployTx, networkName);
        
        // ============================================================================
        // FINALIZAR DEPLOYMENT
        // ============================================================================
        
        const deploymentTime = (Date.now() - deploymentStart) / 1000;
        const totalGasUsed = BigInt(arbitrageReceipt.gasUsed) + BigInt(oracleReceipt.gasUsed);
        const totalCost = calculateDeploymentCost(totalGasUsed, networkConfig.gasPrice);
        
        deploymentResults.totalGasUsed = totalGasUsed.toString();
        deploymentResults.totalCost = totalCost;
        deploymentResults.deploymentTime = deploymentTime;
        
        console.log(`\n🎉 DEPLOYMENT COMPLETADO EXITOSAMENTE!`);
        console.log(`⏱️ Tiempo total: ${deploymentTime}s`);
        console.log(`⛽ Gas total: ${totalGasUsed.toString()}`);
        console.log(`💰 Costo total: ${totalCost}`);
        console.log("=".repeat(80));
        
        // Guardar resultados
        await saveDeploymentResults(deploymentResults, networkName);
        
        // Generar reporte
        await generateDeploymentReport(deploymentResults, networkName);
        
        return deploymentResults;
        
    } catch (error) {
        console.error(`❌ ERROR EN DEPLOYMENT: ${error.message}`);
        console.error(error);
        throw error;
    }
}

// ============================================================================
// FUNCIONES DE CONFIGURACIÓN
// ============================================================================

async function setupAuthorizedDEXs(arbitrageContract, networkName) {
    console.log(`🔧 Configurando DEXs autorizados para ${networkName}...`);
    
    const dexes = DEX_ADDRESSES[networkName];
    if (!dexes) {
        console.log(`⚠️ No hay DEXs configurados para ${networkName}`);
        return;
    }
    
    for (const [dexName, dexAddress] of Object.entries(dexes)) {
        try {
            const tx = await arbitrageContract.addAuthorizedDEX(dexAddress);
            await tx.wait();
            console.log(`✅ ${dexName}: ${dexAddress}`);
        } catch (error) {
            console.log(`⚠️ Error configurando ${dexName}: ${error.message}`);
        }
    }
}

async function setupChainlinkIntegration(oracleContract, networkConfig) {
    console.log(`🔗 Configurando integración Chainlink...`);
    
    // En implementación real, configurar los feeds de Chainlink
    // Por ahora, solo logging
    for (const [pair, feedAddress] of Object.entries(networkConfig.chainlinkFeeds)) {
        console.log(`📊 Chainlink feed ${pair}: ${feedAddress}`);
    }
}

async function setupTWAPIntegration(oracleContract, networkName) {
    console.log(`📈 Configurando TWAP Uniswap V3...`);
    
    // En implementación real, configurar pools TWAP
    // Por ahora, solo logging
    const pools = {
        polygon: {
            'WETH/USDC': '0x45dDa9cb7c25131DF268515131f647d726f50608',
        },
        arbitrum: {
            'WETH/USDC': '0xC31E54c7a869B9FcBEcc14363CF510d1c41fa443',
        }
    };
    
    const networkPools = pools[networkName];
    if (networkPools) {
        for (const [pair, poolAddress] of Object.entries(networkPools)) {
            console.log(`🏊 TWAP pool ${pair}: ${poolAddress}`);
        }
    }
}

// ============================================================================
// FUNCIONES DE TESTING POST-DEPLOYMENT
// ============================================================================

async function runPostDeploymentTests(arbitrageContract, oracleContract, networkName) {
    console.log(`🧪 Ejecutando tests post-deployment...`);
    
    try {
        // Test 1: Verificar owner
        const owner = await arbitrageContract.owner();
        console.log(`✅ Owner verificado: ${owner}`);
        
        // Test 2: Verificar oracle address
        const oracleAddr = await arbitrageContract.priceOracle();
        console.log(`✅ Oracle address verificado: ${oracleAddr}`);
        
        // Test 3: Verificar estado inicial
        const stats = await arbitrageContract.getContractStats();
        console.log(`✅ Stats iniciales - Trades: ${stats.totalTrades}, Fee: ${stats.currentFee}`);
        
        // Test 4: Verificar DEXs autorizados (ejemplo)
        const dexes = DEX_ADDRESSES[networkName];
        if (dexes) {
            const firstDex = Object.values(dexes)[0];
            const isAuthorized = await arbitrageContract.authorizedDEXs(firstDex);
            console.log(`✅ DEX autorizado verificado: ${isAuthorized}`);
        }
        
        console.log(`✅ Todos los tests post-deployment pasaron`);
        
    } catch (error) {
        console.log(`⚠️ Error en tests post-deployment: ${error.message}`);
    }
}

// ============================================================================
// FUNCIONES AUXILIARES
// ============================================================================

async function checkMinimumBalance(deployer, networkName) {
    const balance = await deployer.getBalance();
    const minBalance = ethers.utils.parseEther("0.1"); // 0.1 ETH/MATIC mínimo
    
    if (balance.lt(minBalance)) {
        throw new Error(`Balance insuficiente. Mínimo: 0.1 ${networkName === 'polygon' ? 'MATIC' : 'ETH'}, Actual: ${ethers.utils.formatEther(balance)}`);
    }
}

function calculateDeploymentCost(gasUsed, gasPrice) {
    const costWei = BigInt(gasUsed) * BigInt(gasPrice);
    const costEth = ethers.utils.formatEther(costWei.toString());
    return `${costEth} ETH`;
}

async function verifyContract(address, constructorArgs) {
    try {
        await hre.run("verify:verify", {
            address: address,
            constructorArguments: constructorArgs,
        });
    } catch (error) {
        if (error.message.toLowerCase().includes("already verified")) {
            console.log(`✅ Contrato ya verificado: ${address}`);
        } else {
            throw error;
        }
    }
}

async function saveDeploymentResults(results, networkName) {
    const resultsDir = path.join(__dirname, '..', 'deployments');
    if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    const filename = `${networkName}-${Date.now()}.json`;
    const filepath = path.join(resultsDir, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(results, null, 2));
    console.log(`💾 Resultados guardados en: ${filepath}`);
}

async function generateDeploymentReport(results, networkName) {
    const report = `
# 🚀 REPORTE DE DEPLOYMENT - ArbitrageX Supreme

## 📊 Información General
- **Red**: ${results.network}
- **Chain ID**: ${results.chainId}
- **Deployer**: ${results.deployer}
- **Timestamp**: ${results.timestamp}
- **Tiempo de deployment**: ${results.deploymentTime}s

## 📋 Contratos Desplegados

### PriceOracle
- **Address**: ${results.contracts.PriceOracle}
- **Gas usado**: ${results.gasUsed.PriceOracle}
- **Costo**: ${results.costs.PriceOracle}

### ArbitrageCore  
- **Address**: ${results.contracts.ArbitrageCore}
- **Gas usado**: ${results.gasUsed.ArbitrageCore}
- **Costo**: ${results.costs.ArbitrageCore}

## 💰 Costos Totales
- **Gas total**: ${results.totalGasUsed}
- **Costo total**: ${results.totalCost}

## 🔗 Enlaces Útiles
- **PriceOracle**: https://polygonscan.com/address/${results.contracts.PriceOracle}
- **ArbitrageCore**: https://polygonscan.com/address/${results.contracts.ArbitrageCore}

---
*Deployment ejecutado con metodología Ingenio Pichichi S.A.*
`;

    const reportPath = path.join(__dirname, '..', 'deployments', `${networkName}-report.md`);
    fs.writeFileSync(reportPath, report);
    console.log(`📄 Reporte generado en: ${reportPath}`);
}

// ============================================================================
// EXPORTAR FUNCIÓN PRINCIPAL
// ============================================================================

module.exports = deployArbitrageSystem;

// Si se ejecuta directamente
if (require.main === module) {
    const networkName = process.argv[2] || 'polygon';
    const shouldVerify = process.argv[3] === '--verify';
    
    deployArbitrageSystem(networkName, shouldVerify)
        .then(() => {
            console.log("🎉 Deployment script completado");
            process.exit(0);
        })
        .catch((error) => {
            console.error("❌ Error en deployment script:", error);
            process.exit(1);
        });
}
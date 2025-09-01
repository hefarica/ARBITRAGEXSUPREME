/**
 * @fileoverview Script de despliegue para ArbitrageX Supreme
 * Ingenio Pichichi S.A. - Smart Contracts Deployment
 */

const { ethers, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Configuración por red
const NETWORK_CONFIG = {
  mainnet: {
    WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    UNISWAP_V2_ROUTER: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
    UNISWAP_V2_FACTORY: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
    AAVE_V3_POOL: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2"
  },
  goerli: {
    WETH: "0xB4FBF271143F4FBf085499aB2B7219eB725d9b57",
    UNISWAP_V2_ROUTER: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
    UNISWAP_V2_FACTORY: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
    AAVE_V3_POOL: "0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951"
  },
  sepolia: {
    WETH: "0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14",
    UNISWAP_V2_ROUTER: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
    UNISWAP_V2_FACTORY: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
    AAVE_V3_POOL: "0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951"
  },
  polygon: {
    WETH: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", // WMATIC
    UNISWAP_V2_ROUTER: "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff", // QuickSwap
    UNISWAP_V2_FACTORY: "0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32",
    AAVE_V3_POOL: "0x794a61358D6845594F94dc1DB02A252b5b4814aD"
  },
  hardhat: {
    // Para testing local con fork
    WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    UNISWAP_V2_ROUTER: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
    UNISWAP_V2_FACTORY: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f",
    AAVE_V3_POOL: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2"
  }
};

async function main() {
  console.log("🚀 Iniciando despliegue de ArbitrageX Supreme...");
  console.log("📡 Red:", network.name);
  
  const [deployer] = await ethers.getSigners();
  console.log("👤 Deployer:", deployer.address);
  console.log("💰 Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");

  const config = NETWORK_CONFIG[network.name];
  if (!config) {
    throw new Error(`Configuración no encontrada para la red: ${network.name}`);
  }

  const deployments = {};
  const gasUsed = {};

  try {
    // 1. Desplegar ArbitrageEngine
    console.log("\n📄 Desplegando ArbitrageEngine...");
    const ArbitrageEngine = await ethers.getContractFactory("ArbitrageEngine");
    const arbitrageEngine = await ArbitrageEngine.deploy(deployer.address);
    await arbitrageEngine.waitForDeployment();
    
    const engineAddress = await arbitrageEngine.getAddress();
    deployments.ArbitrageEngine = engineAddress;
    console.log("✅ ArbitrageEngine desplegado en:", engineAddress);

    // 2. Desplegar UniswapV2Adapter
    console.log("\n📄 Desplegando UniswapV2Adapter...");
    const UniswapV2Adapter = await ethers.getContractFactory("UniswapV2Adapter");
    const uniswapAdapter = await UniswapV2Adapter.deploy(
      config.UNISWAP_V2_ROUTER,
      config.UNISWAP_V2_FACTORY,
      config.WETH
    );
    await uniswapAdapter.waitForDeployment();
    
    const adapterAddress = await uniswapAdapter.getAddress();
    deployments.UniswapV2Adapter = adapterAddress;
    console.log("✅ UniswapV2Adapter desplegado en:", adapterAddress);

    // 3. Desplegar AaveFlashLoanProvider
    console.log("\n📄 Desplegando AaveFlashLoanProvider...");
    const AaveFlashLoanProvider = await ethers.getContractFactory("AaveFlashLoanProvider");
    const aaveProvider = await AaveFlashLoanProvider.deploy(config.AAVE_V3_POOL);
    await aaveProvider.waitForDeployment();
    
    const providerAddress = await aaveProvider.getAddress();
    deployments.AaveFlashLoanProvider = providerAddress;
    console.log("✅ AaveFlashLoanProvider desplegado en:", providerAddress);

    // 4. Configuración inicial
    console.log("\n⚙️ Configurando contratos...");

    // Registrar estrategia Uniswap V2
    console.log("📝 Registrando estrategia INTRA_DEX...");
    const registerTx = await arbitrageEngine.registerStrategy("INTRA_DEX", adapterAddress);
    await registerTx.wait();
    console.log("✅ Estrategia INTRA_DEX registrada");

    // Agregar flash loan provider
    console.log("📝 Agregando proveedor de flash loans...");
    const addProviderTx = await arbitrageEngine.addFlashLoanProvider(providerAddress);
    await addProviderTx.wait();
    console.log("✅ Proveedor de flash loans agregado");

    // Configurar tokens soportados en AaveFlashLoanProvider
    if (network.name !== "hardhat") {
      console.log("📝 Configurando tokens soportados...");
      
      const commonTokens = {
        mainnet: [
          "0xA0b86a33E6441cF2b6B82397548632b7F293c98B", // USDC
          "0x6B175474E89094C44Da98b954EedeAC495271d0F", // DAI
          "0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT
          config.WETH // WETH
        ],
        goerli: [config.WETH],
        sepolia: [config.WETH],
        polygon: [
          "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", // USDC
          "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063", // DAI
          config.WETH // WMATIC
        ]
      };

      const tokens = commonTokens[network.name] || [config.WETH];
      for (const token of tokens) {
        try {
          const updateTx = await aaveProvider.updateAssetSupport(token, true);
          await updateTx.wait();
          console.log(`✅ Token ${token} agregado como soportado`);
        } catch (error) {
          console.log(`⚠️ Error agregando token ${token}:`, error.message);
        }
      }
    }

    // Autorizar ArbitrageEngine como caller
    console.log("📝 Autorizando ArbitrageEngine...");
    const authTx = await arbitrageEngine.updateAuthorizedCaller(deployer.address, true);
    await authTx.wait();
    console.log("✅ ArbitrageEngine autorizado");

    // 5. Verificar despliegue
    console.log("\n🔍 Verificando despliegue...");
    
    const strategy = await arbitrageEngine.getStrategy("INTRA_DEX");
    console.log("🔗 Estrategia INTRA_DEX:", strategy);
    
    const balance = await arbitrageEngine.getTokenBalance(config.WETH);
    console.log("💰 Balance WETH:", balance.toString());

    // 6. Guardar direcciones de contratos
    const deploymentsDir = path.join(__dirname, "../deployments");
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    const deploymentData = {
      network: network.name,
      chainId: (await ethers.provider.getNetwork()).chainId,
      timestamp: new Date().toISOString(),
      deployer: deployer.address,
      contracts: deployments,
      config: config,
      gasUsed: gasUsed
    };

    const deploymentFile = path.join(deploymentsDir, `${network.name}.json`);
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentData, null, 2));
    console.log("📄 Direcciones guardadas en:", deploymentFile);

    // 7. Generar TypeScript types
    const typesContent = `
// ArbitrageX Supreme Contract Addresses
// Network: ${network.name}
// Generated: ${new Date().toISOString()}

export const CONTRACTS = {
  ArbitrageEngine: "${deployments.ArbitrageEngine}",
  UniswapV2Adapter: "${deployments.UniswapV2Adapter}",
  AaveFlashLoanProvider: "${deployments.AaveFlashLoanProvider}"
} as const;

export const CONFIG = ${JSON.stringify(config, null, 2)} as const;

export const NETWORK = "${network.name}";
export const CHAIN_ID = ${(await ethers.provider.getNetwork()).chainId};
`;

    const typesFile = path.join(deploymentsDir, `${network.name}.types.ts`);
    fs.writeFileSync(typesFile, typesContent);
    console.log("📄 Types generados en:", typesFile);

    console.log("\n🎉 ¡Despliegue completado exitosamente!");
    console.log("🔗 ArbitrageEngine:", deployments.ArbitrageEngine);
    console.log("🔗 UniswapV2Adapter:", deployments.UniswapV2Adapter);
    console.log("🔗 AaveFlashLoanProvider:", deployments.AaveFlashLoanProvider);

    // 8. Instrucciones de verificación
    if (network.name !== "hardhat" && network.name !== "localhost") {
      console.log("\n📋 Para verificar contratos ejecuta:");
      console.log(`npx hardhat verify --network ${network.name} ${deployments.ArbitrageEngine} "${deployer.address}"`);
      console.log(`npx hardhat verify --network ${network.name} ${deployments.UniswapV2Adapter} "${config.UNISWAP_V2_ROUTER}" "${config.UNISWAP_V2_FACTORY}" "${config.WETH}"`);
      console.log(`npx hardhat verify --network ${network.name} ${deployments.AaveFlashLoanProvider} "${config.AAVE_V3_POOL}"`);
    }

  } catch (error) {
    console.error("❌ Error durante el despliegue:", error);
    process.exit(1);
  }
}

// Manejo de errores
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("💥 Error fatal:", error);
    process.exit(1);
  });
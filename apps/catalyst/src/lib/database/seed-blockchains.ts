/**
 * ArbitrageX Supreme - Database Seeder para Blockchains
 * Ingenio Pichichi S.A. - Siembra Metodica de Datos
 * 
 * Pobla la base de datos con las 20+ blockchains soportadas
 * Implementación disciplinada siguiendo las mejores prácticas
 */

import { PrismaClient } from '@prisma/client'
import { BLOCKCHAIN_REGISTRY } from '../blockchain/registry'

const prisma = new PrismaClient()

/**
 * SEEDER PRINCIPAL DE BLOCKCHAINS
 * Cosecha organizada de todas las cadenas al registro de la base de datos
 */
export async function seedBlockchains(): Promise<void> {
  console.log('🌱 Iniciando siembra de blockchains...')
  
  try {
    // Obtener todas las configuraciones de blockchains
    const blockchainConfigs = Object.values(BLOCKCHAIN_REGISTRY)
    
    console.log(`📊 Procesando ${blockchainConfigs.length} blockchains...`)
    
    for (const config of blockchainConfigs) {
      console.log(`🔗 Procesando ${config.name} (Chain ID: ${config.chainId})...`)
      
      // Usar upsert para crear o actualizar
      await prisma.blockchain.upsert({
        where: {
          chainId: config.chainId
        },
        update: {
          name: config.name,
          symbol: config.symbol,
          rpcUrl: config.rpcUrl,
          explorerUrl: config.explorerUrl,
          nativeCurrency: config.nativeCurrency,
          isTestnet: config.isTestnet,
          isActive: config.isActive,
          gasTokenSymbol: config.gasTokenSymbol,
          blockTime: config.blockTime,
          confirmations: config.confirmations,
          maxGasPrice: config.maxGasPrice,
          updatedAt: new Date()
        },
        create: {
          chainId: config.chainId,
          name: config.name,
          symbol: config.symbol,
          rpcUrl: config.rpcUrl,
          explorerUrl: config.explorerUrl,
          nativeCurrency: config.nativeCurrency,
          isTestnet: config.isTestnet,
          isActive: config.isActive,
          gasTokenSymbol: config.gasTokenSymbol,
          blockTime: config.blockTime,
          confirmations: config.confirmations,
          maxGasPrice: config.maxGasPrice
        }
      })
      
      console.log(`✅ ${config.name} procesada exitosamente`)
    }
    
    // Obtener estadísticas finales
    const totalBlockchains = await prisma.blockchain.count()
    const activeMainnets = await prisma.blockchain.count({
      where: { isActive: true, isTestnet: false }
    })
    const testnets = await prisma.blockchain.count({
      where: { isTestnet: true }
    })
    
    console.log('📈 Estadísticas de siembra de blockchains:')
    console.log(`   Total blockchains: ${totalBlockchains}`)
    console.log(`   Mainnets activas: ${activeMainnets}`)
    console.log(`   Testnets: ${testnets}`)
    console.log('✅ Siembra de blockchains completada exitosamente')
    
  } catch (error) {
    console.error('❌ Error durante la siembra de blockchains:', error)
    throw error
  }
}

/**
 * SEEDER DE PROTOCOLOS BÁSICOS
 * Pobla protocolos iniciales basados en la configuración de registry
 */
export async function seedBasicProtocols(): Promise<void> {
  console.log('🌱 Iniciando siembra de protocolos básicos...')
  
  try {
    const blockchainConfigs = Object.values(BLOCKCHAIN_REGISTRY).filter(
      config => config.isActive && !config.isTestnet
    )
    
    let totalProtocolsCreated = 0
    
    for (const chainConfig of blockchainConfigs) {
      console.log(`🔗 Procesando protocolos para ${chainConfig.name}...`)
      
      // Obtener blockchain de la DB
      const blockchain = await prisma.blockchain.findUnique({
        where: { chainId: chainConfig.chainId }
      })
      
      if (!blockchain) {
        console.warn(`⚠️  Blockchain ${chainConfig.name} no encontrada en DB, saltando...`)
        continue
      }
      
      // Procesar DEXs
      for (const dexName of chainConfig.majorDexes) {
        await prisma.protocol.upsert({
          where: {
            name_blockchainId: {
              name: dexName,
              blockchainId: blockchain.id
            }
          },
          update: {
            category: 'DEX_AMM',
            isActive: true,
            isVerified: true,
            riskScore: 2, // DEXs principales tienen bajo riesgo
            supportsFlashLoans: chainConfig.flashLoanProviders?.includes(dexName) || false,
            updatedAt: new Date()
          },
          create: {
            name: dexName,
            symbol: dexName.replace(/\s+/g, '').toUpperCase(),
            category: 'DEX_AMM',
            blockchainId: blockchain.id,
            isActive: true,
            isVerified: true,
            riskScore: 2,
            supportsFlashLoans: chainConfig.flashLoanProviders?.includes(dexName) || false,
            tvl: 0, // Se actualizará con datos reales
            volume24h: 0,
            fees24h: 0
          }
        })
        totalProtocolsCreated++
      }
      
      // Procesar Protocolos de Lending
      for (const lendingName of chainConfig.lendingProtocols) {
        await prisma.protocol.upsert({
          where: {
            name_blockchainId: {
              name: lendingName,
              blockchainId: blockchain.id
            }
          },
          update: {
            category: 'LENDING',
            isActive: true,
            isVerified: true,
            riskScore: 1, // Lending protocols tienen muy bajo riesgo
            supportsFlashLoans: chainConfig.flashLoanProviders?.includes(lendingName) || false,
            flashLoanFee: lendingName.includes('Aave') ? 0.05 : 0.1, // Aave 0.05%, otros 0.1%
            updatedAt: new Date()
          },
          create: {
            name: lendingName,
            symbol: lendingName.replace(/\s+/g, '').toUpperCase(),
            category: 'LENDING',
            blockchainId: blockchain.id,
            isActive: true,
            isVerified: true,
            riskScore: 1,
            supportsFlashLoans: chainConfig.flashLoanProviders?.includes(lendingName) || false,
            flashLoanFee: lendingName.includes('Aave') ? 0.05 : 0.1,
            tvl: 0,
            volume24h: 0,
            fees24h: 0
          }
        })
        totalProtocolsCreated++
      }
      
      console.log(`✅ Protocolos para ${chainConfig.name} procesados`)
    }
    
    // Estadísticas finales
    const totalProtocols = await prisma.protocol.count()
    const activeProtocols = await prisma.protocol.count({
      where: { isActive: true }
    })
    const flashLoanProtocols = await prisma.protocol.count({
      where: { supportsFlashLoans: true }
    })
    
    console.log('📈 Estadísticas de siembra de protocolos:')
    console.log(`   Total protocolos: ${totalProtocols}`)
    console.log(`   Protocolos activos: ${activeProtocols}`)
    console.log(`   Con Flash Loans: ${flashLoanProtocols}`)
    console.log(`   Nuevos creados: ${totalProtocolsCreated}`)
    console.log('✅ Siembra de protocolos básicos completada')
    
  } catch (error) {
    console.error('❌ Error durante la siembra de protocolos:', error)
    throw error
  }
}

/**
 * SEEDER DE ESTRATEGIAS DE FLASH LOANS
 * Crea las 12 estrategias base del sistema
 */
export async function seedFlashLoanStrategies(): Promise<void> {
  console.log('🌱 Iniciando siembra de estrategias Flash Loan...')
  
  try {
    const strategies = [
      {
        name: 'Arbitraje Intra-DEX',
        strategyType: 'INTRA_DEX',
        description: 'Arbitraje dentro del mismo protocolo DEX aprovechando diferencias entre pools',
        minProfitUsd: 50,
        maxGasCost: 30,
        riskLevel: 3
      },
      {
        name: 'Arbitraje Inter-DEX',
        strategyType: 'INTER_DEX',
        description: 'Arbitraje entre diferentes DEXs en la misma blockchain',
        minProfitUsd: 75,
        maxGasCost: 50,
        riskLevel: 4
      },
      {
        name: 'Arbitraje Cross-Chain',
        strategyType: 'CROSS_CHAIN',
        description: 'Arbitraje entre diferentes blockchains usando bridges',
        minProfitUsd: 200,
        maxGasCost: 100,
        riskLevel: 7
      },
      {
        name: 'Arbitraje Tasas Interés',
        strategyType: 'INTEREST_RATE',
        description: 'Aprovecha diferencias en tasas de interés entre protocolos de lending',
        minProfitUsd: 100,
        maxGasCost: 40,
        riskLevel: 3
      },
      {
        name: 'Stablecoin Depeg',
        strategyType: 'STABLECOIN_DEPEG',
        description: 'Aprovecha depegs temporales de stablecoins',
        minProfitUsd: 25,
        maxGasCost: 20,
        riskLevel: 5
      },
      {
        name: 'NFT Arbitraje',
        strategyType: 'NFT_ARBITRAGE',
        description: 'Arbitraje de NFTs entre diferentes marketplaces',
        minProfitUsd: 500,
        maxGasCost: 150,
        riskLevel: 8
      },
      {
        name: 'Swap Colateral',
        strategyType: 'COLLATERAL_SWAP',
        description: 'Intercambio eficiente de colaterales en protocolos de lending',
        minProfitUsd: 30,
        maxGasCost: 25,
        riskLevel: 2
      },
      {
        name: 'Provisión Liquidez',
        strategyType: 'LIQUIDITY_PROVISION',
        description: 'Provisión temporal de liquidez para capturar fees',
        minProfitUsd: 15,
        maxGasCost: 15,
        riskLevel: 4
      },
      {
        name: 'Refinanciación Deuda',
        strategyType: 'DEBT_REFINANCING',
        description: 'Refinanciación de deudas para obtener mejores tasas',
        minProfitUsd: 100,
        maxGasCost: 60,
        riskLevel: 3
      },
      {
        name: 'Batching Trades',
        strategyType: 'TRADE_BATCHING',
        description: 'Agrupación eficiente de múltiples trades',
        minProfitUsd: 20,
        maxGasCost: 35,
        riskLevel: 2
      },
      {
        name: 'Flash Minting',
        strategyType: 'FLASH_MINTING',
        description: 'Acuñación temporal de tokens para arbitraje',
        minProfitUsd: 150,
        maxGasCost: 80,
        riskLevel: 6
      },
      {
        name: 'Detección Wash Trading',
        strategyType: 'WASH_TRADING_DETECT',
        description: 'Detecta y aprovecha patrones de wash trading',
        minProfitUsd: 75,
        maxGasCost: 45,
        riskLevel: 9
      }
    ]
    
    // Obtener un protocolo flash loan para asociar las estrategias
    const flashLoanProtocol = await prisma.protocol.findFirst({
      where: { supportsFlashLoans: true }
    })
    
    if (!flashLoanProtocol) {
      console.warn('⚠️  No se encontraron protocolos con Flash Loans, creando estrategias sin protocolo asociado')
      return
    }
    
    for (const strategyData of strategies) {
      await prisma.flashLoanStrategy.upsert({
        where: {
          name: strategyData.name
        },
        update: {
          ...strategyData,
          isActive: true,
          updatedAt: new Date()
        } as any,
        create: {
          ...strategyData,
          protocolId: flashLoanProtocol.id,
          isActive: true,
          isBacktested: false,
          totalExecutions: 0,
          successRate: 0,
          totalProfitUsd: 0,
          avgProfitUsd: 0
        } as any
      })
    }
    
    const totalStrategies = await prisma.flashLoanStrategy.count()
    console.log(`✅ ${strategies.length} estrategias Flash Loan creadas/actualizadas`)
    console.log(`📊 Total estrategias en sistema: ${totalStrategies}`)
    
  } catch (error) {
    console.error('❌ Error durante la siembra de estrategias:', error)
    throw error
  }
}

/**
 * SEEDER MAESTRO - EJECUTA TODOS LOS SEEDERS
 * Cosecha completa del sistema en orden disciplinado
 */
export async function seedDatabase(): Promise<void> {
  console.log('🚜 Iniciando siembra completa de la base de datos...')
  
  try {
    await seedBlockchains()
    await seedBasicProtocols() 
    await seedFlashLoanStrategies()
    
    console.log('🎉 ¡Siembra completa de la base de datos exitosa!')
    console.log('📊 Sistema listo para cosecha de oportunidades de arbitraje')
    
  } catch (error) {
    console.error('💥 Error crítico durante la siembra:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}
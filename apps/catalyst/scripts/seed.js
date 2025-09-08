/**
 * ArbitrageX Supreme - Simple Database Seeder
 * Ingenio Pichichi S.A. - Siembra Rápida para Desarrollo
 */

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function seedBlockchains() {
  console.log('🌱 Iniciando siembra de blockchains...')
  
  const blockchains = [
    {
      chainId: 1,
      name: 'Ethereum Mainnet',
      symbol: 'ETH',
      rpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/demo',
      explorerUrl: 'https://etherscan.io',
      nativeCurrency: 'ETH',
      isTestnet: false,
      isActive: true,
      gasTokenSymbol: 'ETH',
      blockTime: 12,
      confirmations: 12,
      maxGasPrice: '100'
    },
    {
      chainId: 56,
      name: 'BNB Smart Chain',
      symbol: 'BNB',
      rpcUrl: 'https://bsc-dataseed1.binance.org/',
      explorerUrl: 'https://bscscan.com',
      nativeCurrency: 'BNB',
      isTestnet: false,
      isActive: true,
      gasTokenSymbol: 'BNB',
      blockTime: 3,
      confirmations: 15,
      maxGasPrice: '20'
    },
    {
      chainId: 137,
      name: 'Polygon',
      symbol: 'MATIC',
      rpcUrl: 'https://polygon-rpc.com/',
      explorerUrl: 'https://polygonscan.com',
      nativeCurrency: 'MATIC',
      isTestnet: false,
      isActive: true,
      gasTokenSymbol: 'MATIC',
      blockTime: 2,
      confirmations: 20,
      maxGasPrice: '500'
    },
    {
      chainId: 42161,
      name: 'Arbitrum One',
      symbol: 'ETH',
      rpcUrl: 'https://arb1.arbitrum.io/rpc',
      explorerUrl: 'https://arbiscan.io',
      nativeCurrency: 'ETH',
      isTestnet: false,
      isActive: true,
      gasTokenSymbol: 'ETH',
      blockTime: 1,
      confirmations: 10,
      maxGasPrice: '5'
    },
    {
      chainId: 10,
      name: 'Optimism',
      symbol: 'ETH',
      rpcUrl: 'https://mainnet.optimism.io',
      explorerUrl: 'https://optimistic.etherscan.io',
      nativeCurrency: 'ETH',
      isTestnet: false,
      isActive: true,
      gasTokenSymbol: 'ETH',
      blockTime: 2,
      confirmations: 10,
      maxGasPrice: '5'
    }
  ]
  
  for (const blockchain of blockchains) {
    await prisma.blockchain.upsert({
      where: { chainId: blockchain.chainId },
      update: blockchain,
      create: blockchain
    })
    console.log(`✅ ${blockchain.name} procesada`)
  }
  
  console.log(`🎉 ${blockchains.length} blockchains sembradas exitosamente`)
}

async function seedProtocols() {
  console.log('🌱 Iniciando siembra de protocolos...')
  
  const ethereum = await prisma.blockchain.findUnique({ where: { chainId: 1 } })
  const bsc = await prisma.blockchain.findUnique({ where: { chainId: 56 } })
  
  if (!ethereum || !bsc) {
    console.error('❌ No se encontraron blockchains base')
    return
  }
  
  const protocols = [
    {
      name: 'Uniswap V3',
      symbol: 'UNI',
      category: 'DEX_AMM',
      blockchainId: ethereum.id,
      isActive: true,
      isVerified: true,
      riskScore: 2,
      supportsFlashLoans: true,
      tvl: 5247850000,
      volume24h: 892150000
    },
    {
      name: 'Aave V3',
      symbol: 'AAVE',
      category: 'LENDING',
      blockchainId: ethereum.id,
      isActive: true,
      isVerified: true,
      riskScore: 1,
      supportsFlashLoans: true,
      flashLoanFee: 0.05,
      tvl: 12847200000,
      volume24h: 247890000
    },
    {
      name: 'PancakeSwap V3',
      symbol: 'CAKE',
      category: 'DEX_AMM',
      blockchainId: bsc.id,
      isActive: true,
      isVerified: true,
      riskScore: 3,
      supportsFlashLoans: false,
      tvl: 3456780000,
      volume24h: 567890000
    }
  ]
  
  for (const protocol of protocols) {
    await prisma.protocol.create({
      data: protocol
    })
    console.log(`✅ ${protocol.name} creado`)
  }
  
  console.log(`🎉 ${protocols.length} protocolos sembrados exitosamente`)
}

async function main() {
  try {
    await seedBlockchains()
    await seedProtocols()
    console.log('🚜 Siembra completa exitosa!')
  } catch (error) {
    console.error('❌ Error durante la siembra:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
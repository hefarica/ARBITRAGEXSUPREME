'use client'

/**
 * ArbitrageX Pro 2025 - Web3 Arbitrage Execution Service
 * Sistema del Ingenio Pichichi S.A - Implementación metodica de ejecución
 */

import { ethers } from 'ethers'
import { ArbitrageOpportunity } from '@/types/defi'

// ============================================================================
// CONFIGURACIÓN DE CONTRATOS Y REDES
// ============================================================================

export const SUPPORTED_NETWORKS = {
  // Ethereum Mainnet
  '0x1': {
    name: 'Ethereum Mainnet',
    rpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/your-api-key',
    explorerUrl: 'https://etherscan.io',
    arbitrageContract: '0x0000000000000000000000000000000000000000', // Deploy contract address
    nativeToken: 'ETH',
    wrappedToken: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' // WETH
  },
  // BSC Mainnet  
  '0x38': {
    name: 'BSC Mainnet',
    rpcUrl: 'https://bsc-dataseed1.binance.org/',
    explorerUrl: 'https://bscscan.com',
    arbitrageContract: '0x0000000000000000000000000000000000000000',
    nativeToken: 'BNB',
    wrappedToken: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c' // WBNB
  },
  // Polygon Mainnet
  '0x89': {
    name: 'Polygon Mainnet',
    rpcUrl: 'https://polygon-rpc.com/',
    explorerUrl: 'https://polygonscan.com',
    arbitrageContract: '0x0000000000000000000000000000000000000000',
    nativeToken: 'MATIC',
    wrappedToken: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270' // WMATIC
  },
  // Arbitrum One
  '0xa4b1': {
    name: 'Arbitrum One',
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    explorerUrl: 'https://arbiscan.io',
    arbitrageContract: '0x0000000000000000000000000000000000000000',
    nativeToken: 'ETH',
    wrappedToken: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1' // WETH
  }
} as const

// ABI simplificado del contrato de arbitraje
export const ARBITRAGE_CONTRACT_ABI = [
  // Función para arbitraje simple
  {
    "inputs": [
      {
        "components": [
          { "internalType": "address", "name": "tokenIn", "type": "address" },
          { "internalType": "address", "name": "tokenOut", "type": "address" },
          { "internalType": "uint256", "name": "amountIn", "type": "uint256" },
          { "internalType": "uint256", "name": "minAmountOut", "type": "uint256" },
          { "internalType": "address[]", "name": "dexAddresses", "type": "address[]" },
          { "internalType": "bytes[]", "name": "callData", "type": "bytes[]" },
          { "internalType": "uint256", "name": "deadline", "type": "uint256" },
          { "internalType": "string", "name": "strategy", "type": "string" }
        ],
        "internalType": "struct ArbitrageExecutor.ArbitrageParams",
        "name": "params",
        "type": "tuple"
      }
    ],
    "name": "executeSimpleArbitrage",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // Función para arbitraje triangular
  {
    "inputs": [
      { "internalType": "address[]", "name": "tokens", "type": "address[]" },
      { "internalType": "uint256[]", "name": "amounts", "type": "uint256[]" },
      { "internalType": "address[]", "name": "dexAddresses", "type": "address[]" },
      { "internalType": "bytes[]", "name": "swapData", "type": "bytes[]" },
      { "internalType": "uint256", "name": "deadline", "type": "uint256" }
    ],
    "name": "executeTriangularArbitrage",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // Eventos
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "user", "type": "address" },
      { "indexed": true, "internalType": "address", "name": "tokenIn", "type": "address" },
      { "indexed": true, "internalType": "address", "name": "tokenOut", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "amountIn", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "amountOut", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "profit", "type": "uint256" },
      { "indexed": false, "internalType": "string", "name": "strategy", "type": "string" },
      { "indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256" }
    ],
    "name": "ArbitrageExecuted",
    "type": "event"
  },
  // Funciones de consulta
  {
    "inputs": [{ "internalType": "address", "name": "user", "type": "address" }],
    "name": "getUserProfit",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getContractStats",
    "outputs": [
      { "internalType": "uint256", "name": "totalTrades", "type": "uint256" },
      { "internalType": "uint256", "name": "totalProfits", "type": "uint256" },
      { "internalType": "uint256", "name": "currentFee", "type": "uint256" },
      { "internalType": "bool", "name": "isPaused", "type": "bool" }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const

// ============================================================================
// INTERFACES PARA EJECUCIÓN
// ============================================================================

export interface ExecutionParams {
  opportunity: ArbitrageOpportunity
  userAddress: string
  chainId: string
  slippageTolerance: number // 0.5% = 0.005
  gasLimit?: number
  gasPrice?: string
}

export interface ExecutionResult {
  success: boolean
  txHash?: string
  profit?: string
  gasUsed?: number
  error?: string
  explorerUrl?: string
}

export interface GasEstimation {
  gasLimit: number
  gasPrice: string
  gasCostETH: string
  gasCostUSD: string
  totalCostUSD: string
  estimatedProfit: string
  isProfitable: boolean
}

// ============================================================================
// SERVICIO PRINCIPAL DE WEB3 ARBITRAGE
// ============================================================================

class Web3ArbitrageService {
  private provider: ethers.providers.Web3Provider | null = null
  private signer: ethers.Signer | null = null

  // ============================================================================
  // INICIALIZACIÓN Y CONEXIÓN
  // ============================================================================

  async initialize(ethereum: any): Promise<void> {
    if (!ethereum) {
      throw new Error('MetaMask no está disponible')
    }

    this.provider = new ethers.providers.Web3Provider(ethereum)
    this.signer = this.provider.getSigner()

    console.log('✅ Web3ArbitrageService inicializado correctamente')
  }

  // ============================================================================
  // ESTIMACIÓN DE GAS Y RENTABILIDAD
  // ============================================================================

  async estimateGasAndProfit(params: ExecutionParams): Promise<GasEstimation> {
    if (!this.provider || !this.signer) {
      throw new Error('Web3 no inicializado. Conecta MetaMask primero.')
    }

    try {
      const network = SUPPORTED_NETWORKS[params.chainId as keyof typeof SUPPORTED_NETWORKS]
      if (!network) {
        throw new Error(`Red ${params.chainId} no soportada`)
      }

      // 1. Obtener contrato de arbitraje
      const contract = new ethers.Contract(
        network.arbitrageContract,
        ARBITRAGE_CONTRACT_ABI,
        this.signer
      )

      // 2. Preparar parámetros para el contrato
      const contractParams = await this.buildContractParams(params.opportunity, params)

      // 3. Estimar gas
      let gasLimit: number
      try {
        if (params.opportunity.strategy === 'triangular_arbitrage') {
          const gasEstimate = await contract.estimateGas.executeTriangularArbitrage(
            contractParams.triangular.tokens,
            contractParams.triangular.amounts,
            contractParams.triangular.dexAddresses,
            contractParams.triangular.swapData,
            contractParams.deadline
          )
          gasLimit = Number(gasEstimate)
        } else {
          const gasEstimate = await contract.estimateGas.executeSimpleArbitrage(contractParams.simple)
          gasLimit = Number(gasEstimate)
        }
        gasLimit = Math.ceil(gasLimit * 1.2) // +20% buffer
      } catch (error) {
        console.warn('No se pudo estimar gas, usando estimación conservadora')
        gasLimit = params.opportunity.strategy === 'triangular_arbitrage' ? 500000 : 300000
      }

      // 4. Obtener precio del gas
      const gasPrice = await this.provider.getGasPrice()
      const gasPriceGwei = ethers.utils.formatUnits(gasPrice, 'gwei')

      // 5. Calcular costos
      const gasCostWei = gasPrice.mul(gasLimit)
      const gasCostETH = ethers.utils.formatEther(gasCostWei)
      
      // Obtener precio de ETH (simulado - en producción usar API de precios)
      const ethPriceUSD = 2500 // Precio simulado de ETH en USD
      const gasCostUSD = (parseFloat(gasCostETH) * ethPriceUSD).toFixed(2)

      // 6. Calcular rentabilidad
      const expectedProfitUSD = parseFloat(params.opportunity.profitAmount?.toString() ?? '0') || 0
      const netProfitUSD = expectedProfitUSD - parseFloat(gasCostUSD)
      const isProfitable = netProfitUSD > 0

      return {
        gasLimit,
        gasPrice: gasPriceGwei,
        gasCostETH,
        gasCostUSD,
        totalCostUSD: gasCostUSD,
        estimatedProfit: netProfitUSD.toFixed(2),
        isProfitable
      }

    } catch (error: any) {
      console.error('Error estimando gas:', error)
      throw new Error(`Error en estimación de gas: ${error.message}`)
    }
  }

  // ============================================================================
  // EJECUCIÓN DE ARBITRAJE
  // ============================================================================

  async executeArbitrage(params: ExecutionParams): Promise<ExecutionResult> {
    if (!this.provider || !this.signer) {
      throw new Error('Web3 no inicializado. Conecta MetaMask primero.')
    }

    try {
      console.log('🚀 Iniciando ejecución de arbitraje...', {
        strategy: params.opportunity.strategy,
        tokenIn: params.opportunity.tokenIn,
        tokenOut: params.opportunity.tokenOut,
        expectedProfit: params.opportunity.profitAmount
      })

      const network = SUPPORTED_NETWORKS[params.chainId as keyof typeof SUPPORTED_NETWORKS]
      if (!network) {
        throw new Error(`Red ${params.chainId} no soportada`)
      }

      // 1. Verificar que el contrato esté desplegado
      if (network.arbitrageContract === '0x0000000000000000000000000000000000000000') {
        throw new Error(`Contrato de arbitraje no desplegado en ${network.name}`)
      }

      // 2. Crear instancia del contrato
      const contract = new ethers.Contract(
        network.arbitrageContract,
        ARBITRAGE_CONTRACT_ABI,
        this.signer
      )

      // 3. Verificar estado del contrato
      const stats = await contract.getContractStats()
      if (stats.isPaused) {
        throw new Error('El contrato de arbitraje está pausado')
      }

      // 4. Preparar parámetros
      const contractParams = await this.buildContractParams(params.opportunity, params)

      // 5. Estimar gas
      const gasEstimation = await this.estimateGasAndProfit(params)
      if (!gasEstimation.isProfitable) {
        throw new Error(`Arbitraje no rentable después del gas. Pérdida estimada: $${Math.abs(parseFloat(gasEstimation.estimatedProfit))}`)
      }

      // 6. Ejecutar transacción
      let tx: ethers.ContractTransaction

      if (params.opportunity.strategy === 'triangular_arbitrage') {
        console.log('Ejecutando arbitraje triangular...')
        tx = await contract.executeTriangularArbitrage(
          contractParams.triangular.tokens,
          contractParams.triangular.amounts,
          contractParams.triangular.dexAddresses,
          contractParams.triangular.swapData,
          contractParams.deadline,
          {
            gasLimit: gasEstimation.gasLimit,
            gasPrice: ethers.utils.parseUnits(gasEstimation.gasPrice, 'gwei')
          }
        )
      } else {
        console.log('Ejecutando arbitraje simple...')
        tx = await contract.executeSimpleArbitrage(contractParams.simple, {
          gasLimit: gasEstimation.gasLimit,
          gasPrice: ethers.utils.parseUnits(gasEstimation.gasPrice, 'gwei')
        })
      }

      console.log(`📡 Transacción enviada: ${tx.hash}`)

      // 7. Esperar confirmación
      const receipt = await tx.wait()
      console.log(`✅ Transacción confirmada en bloque: ${receipt.blockNumber}`)

      // 8. Procesar eventos para obtener ganancia real
      const arbitrageEvent = receipt.events?.find(
        event => event.event === 'ArbitrageExecuted'
      )

      const realProfit = arbitrageEvent?.args?.profit 
        ? ethers.utils.formatUnits(arbitrageEvent.args.profit, 18)
        : gasEstimation.estimatedProfit

      return {
        success: true,
        txHash: tx.hash,
        profit: realProfit,
        gasUsed: receipt.gasUsed.toNumber(),
        explorerUrl: `${network.explorerUrl}/tx/${tx.hash}`
      }

    } catch (error: any) {
      console.error('❌ Error ejecutando arbitraje:', error)

      // Parsear errores comunes
      let errorMessage = error.message || 'Error desconocido'
      
      if (errorMessage.includes('insufficient funds')) {
        errorMessage = 'Fondos insuficientes para cubrir gas y tokens'
      } else if (errorMessage.includes('slippage')) {
        errorMessage = 'Slippage demasiado alto. Ajusta la tolerancia.'
      } else if (errorMessage.includes('deadline')) {
        errorMessage = 'La oportunidad ha expirado'
      } else if (errorMessage.includes('user rejected')) {
        errorMessage = 'Transacción rechazada por el usuario'
      }

      return {
        success: false,
        error: errorMessage
      }
    }
  }

  // ============================================================================
  // FUNCIONES AUXILIARES
  // ============================================================================

  private async buildContractParams(opportunity: ArbitrageOpportunity, params: ExecutionParams) {
    const deadline = Math.floor(Date.now() / 1000) + 600 // 10 minutos

    // Para arbitraje simple
    const simpleParams = {
      tokenIn: this.getTokenAddress(opportunity.tokenIn ?? 'USDC', params.chainId),
      tokenOut: this.getTokenAddress(opportunity.tokenOut ?? 'USDT', params.chainId),
      amountIn: ethers.utils.parseEther(opportunity.profitAmount?.toString() ?? '0.1'), // Cantidad simulada
      minAmountOut: ethers.utils.parseEther('0'), // Calcular con slippage
      dexAddresses: [
        '0x0000000000000000000000000000000000000001', // DEX 1 simulado
        '0x0000000000000000000000000000000000000002'  // DEX 2 simulado
      ],
      callData: [
        '0x', // Datos de swap 1
        '0x'  // Datos de swap 2
      ],
      deadline,
      strategy: opportunity.strategy
    }

    // Para arbitraje triangular
    const triangularParams = {
      tokens: [
        this.getTokenAddress(opportunity.tokenIn ?? 'USDC', params.chainId),
        '0xA0b86a33E6441b9435B674C88d5f662c673067bD', // Token intermedio (USDC)
        this.getTokenAddress(opportunity.tokenOut ?? 'USDT', params.chainId)
      ],
      amounts: [
        ethers.utils.parseEther('0.1'), // Amount in
        ethers.utils.parseEther('0'),   // Min amount intermediate
        ethers.utils.parseEther('0'),   // Min amount out
        ethers.utils.parseEther('0')    // Min final amount
      ],
      dexAddresses: [
        '0x0000000000000000000000000000000000000001',
        '0x0000000000000000000000000000000000000002',
        '0x0000000000000000000000000000000000000003'
      ],
      swapData: ['0x', '0x', '0x']
    }

    return {
      simple: simpleParams,
      triangular: triangularParams,
      deadline
    }
  }

  private getTokenAddress(tokenSymbol: string, chainId: string): string {
    // Mapping de tokens por red (simplificado)
    const tokenAddresses: { [chainId: string]: { [symbol: string]: string } } = {
      '0x1': { // Ethereum
        'WETH': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        'USDC': '0xA0b86a33E6441b9435B674C88d5f662c673067bD',
        'USDT': '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        'DAI': '0x6B175474E89094C44Da98b954EedeAC495271d0F'
      },
      '0x38': { // BSC
        'WBNB': '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
        'USDC': '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
        'USDT': '0x55d398326f99059fF775485246999027B3197955',
        'DAI': '0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3'
      }
    }

    return tokenAddresses[chainId]?.[tokenSymbol] || '0x0000000000000000000000000000000000000000'
  }

  // ============================================================================
  // FUNCIONES DE CONSULTA
  // ============================================================================

  async getUserStats(userAddress: string, chainId: string): Promise<{
    totalProfit: string
    totalTrades: number
    successRate: number
  }> {
    if (!this.provider) {
      throw new Error('Web3 no inicializado')
    }

    try {
      const network = SUPPORTED_NETWORKS[chainId as keyof typeof SUPPORTED_NETWORKS]
      if (!network || network.arbitrageContract === '0x0000000000000000000000000000000000000000') {
        return { totalProfit: '0', totalTrades: 0, successRate: 0 }
      }

      const contract = new ethers.Contract(
        network.arbitrageContract,
        ARBITRAGE_CONTRACT_ABI,
        this.provider
      )

      const userProfit = await contract.getUserProfit(userAddress)
      
      // En producción, obtener estas métricas de eventos o subgraph
      return {
        totalProfit: ethers.utils.formatEther(userProfit),
        totalTrades: 0, // Implementar conteo desde eventos
        successRate: 0  // Implementar cálculo desde eventos
      }
    } catch (error) {
      console.error('Error obteniendo stats del usuario:', error)
      return { totalProfit: '0', totalTrades: 0, successRate: 0 }
    }
  }

  async getContractStats(chainId: string): Promise<{
    totalTrades: number
    totalProfits: string
    currentFee: number
    isPaused: boolean
  }> {
    if (!this.provider) {
      throw new Error('Web3 no inicializado')
    }

    try {
      const network = SUPPORTED_NETWORKS[chainId as keyof typeof SUPPORTED_NETWORKS]
      if (!network || network.arbitrageContract === '0x0000000000000000000000000000000000000000') {
        return { totalTrades: 0, totalProfits: '0', currentFee: 0, isPaused: true }
      }

      const contract = new ethers.Contract(
        network.arbitrageContract,
        ARBITRAGE_CONTRACT_ABI,
        this.provider
      )

      const stats = await contract.getContractStats()
      
      return {
        totalTrades: stats.totalTrades.toNumber(),
        totalProfits: ethers.utils.formatEther(stats.totalProfits),
        currentFee: stats.currentFee.toNumber() / 100, // Convert basis points to percentage
        isPaused: stats.isPaused
      }
    } catch (error) {
      console.error('Error obteniendo stats del contrato:', error)
      return { totalTrades: 0, totalProfits: '0', currentFee: 0, isPaused: true }
    }
  }

  // ============================================================================
  // UTILIDADES
  // ============================================================================

  getSupportedNetworks(): string[] {
    return Object.keys(SUPPORTED_NETWORKS)
  }

  getNetworkInfo(chainId: string) {
    return SUPPORTED_NETWORKS[chainId as keyof typeof SUPPORTED_NETWORKS] || null
  }

  isNetworkSupported(chainId: string): boolean {
    return chainId in SUPPORTED_NETWORKS
  }
}

// ============================================================================
// EXPORT SINGLETON
// ============================================================================

export const web3ArbitrageService = new Web3ArbitrageService()
export default web3ArbitrageService
'use client'

// Servicio optimizado para operaciones Web3
export class Web3Service {
  private static instance: Web3Service
  private provider: any = null
  private signer: any = null

  static getInstance(): Web3Service {
    if (!Web3Service.instance) {
      Web3Service.instance = new Web3Service()
    }
    return Web3Service.instance
  }

  // Verificar si MetaMask está disponible
  isMetaMaskAvailable(): boolean {
    return typeof window !== 'undefined' && !!window.ethereum?.isMetaMask
  }

  // Obtener el proveedor actual
  async getProvider() {
    if (!this.isMetaMaskAvailable()) {
      throw new Error('MetaMask no está instalado')
    }

    if (!this.provider) {
      // Lazy loading dinámico de ethers solo cuando se necesita
      const { ethers } = await import('ethers')
      this.provider = new ethers.providers.Web3Provider(window.ethereum)
    }

    return this.provider
  }

  // Obtener el signer (firma de transacciones)
  async getSigner() {
    const provider = await this.getProvider()
    if (!this.signer) {
      this.signer = await provider.getSigner()
    }
    return this.signer
  }

  // Reiniciar conexiones (útil cuando se cambia de cuenta)
  reset() {
    this.provider = null
    this.signer = null
  }

  // Obtener balance con mejor precisión
  async getBalance(address: string): Promise<string> {
    try {
      const provider = await this.getProvider()
      const { ethers } = await import('ethers')
      
      const balance = await provider.getBalance(address)
      return ethers.utils.formatEther(balance)
    } catch (error) {
      console.error('Error getting balance:', error)
      throw error
    }
  }

  // Obtener información de la red
  async getNetworkInfo() {
    try {
      const provider = await this.getProvider()
      const network = await provider.getNetwork()
      
      return {
        chainId: '0x' + network.chainId.toString(16),
        name: network.name,
        chainIdNumber: Number(network.chainId)
      }
    } catch (error) {
      console.error('Error getting network info:', error)
      throw error
    }
  }

  // Estimar gas para una transacción
  async estimateGas(transaction: any): Promise<bigint> {
    try {
      const provider = await this.getProvider()
      return await provider.estimateGas(transaction)
    } catch (error) {
      console.error('Error estimating gas:', error)
      throw error
    }
  }

  // Obtener precio del gas actual
  async getGasPrice(): Promise<bigint> {
    try {
      const provider = await this.getProvider()
      const feeData = await provider.getFeeData()
      return feeData.gasPrice || BigInt(0)
    } catch (error) {
      console.error('Error getting gas price:', error)
      throw error
    }
  }

  // Obtener nonce de la cuenta
  async getNonce(address: string): Promise<number> {
    try {
      const provider = await this.getProvider()
      return await provider.getTransactionCount(address)
    } catch (error) {
      console.error('Error getting nonce:', error)
      throw error
    }
  }

  // Firmar mensaje
  async signMessage(message: string): Promise<string> {
    try {
      const signer = await this.getSigner()
      return await signer.signMessage(message)
    } catch (error) {
      console.error('Error signing message:', error)
      throw error
    }
  }

  // Enviar transacción
  async sendTransaction(transaction: any) {
    try {
      const signer = await this.getSigner()
      const tx = await signer.sendTransaction(transaction)
      return tx
    } catch (error) {
      console.error('Error sending transaction:', error)
      throw error
    }
  }

  // Interactuar con contrato inteligente
  async getContract(address: string, abi: any) {
    try {
      const { ethers } = await import('ethers')
      const provider = await this.getProvider()
      return new ethers.Contract(address, abi, provider)
    } catch (error) {
      console.error('Error creating contract instance:', error)
      throw error
    }
  }

  // Obtener contrato con signer (para transacciones)
  async getContractWithSigner(address: string, abi: any) {
    try {
      const { ethers } = await import('ethers')
      const signer = await this.getSigner()
      return new ethers.Contract(address, abi, signer)
    } catch (error) {
      console.error('Error creating contract with signer:', error)
      throw error
    }
  }

  // Verificar si una dirección es válida
  isValidAddress(address: string): boolean {
    try {
      return /^0x[a-fA-F0-9]{40}$/.test(address)
    } catch {
      return false
    }
  }

  // Formatear dirección (checksum)
  async formatAddress(address: string): Promise<string> {
    try {
      const { ethers } = await import('ethers')
      return ethers.utils.getAddress(address)
    } catch (error) {
      console.error('Error formatting address:', error)
      return address
    }
  }

  // Obtener logs de eventos
  async getLogs(filter: any) {
    try {
      const provider = await this.getProvider()
      return await provider.getLogs(filter)
    } catch (error) {
      console.error('Error getting logs:', error)
      throw error
    }
  }

  // Escuchar eventos en tiempo real
  async listenToEvents(contractAddress: string, abi: any, eventName: string, callback: (event: any) => void) {
    try {
      const contract = await this.getContract(contractAddress, abi)
      contract.on(eventName, callback)
      
      // Retornar función de cleanup
      return () => {
        contract.off(eventName, callback)
      }
    } catch (error) {
      console.error('Error setting up event listener:', error)
      throw error
    }
  }

  // Obtener información del bloque actual
  async getCurrentBlock() {
    try {
      const provider = await this.getProvider()
      return await provider.getBlock('latest')
    } catch (error) {
      console.error('Error getting current block:', error)
      throw error
    }
  }

  // Esperar confirmación de transacción
  async waitForTransaction(txHash: string, confirmations: number = 1) {
    try {
      const provider = await this.getProvider()
      return await provider.waitForTransaction(txHash, confirmations)
    } catch (error) {
      console.error('Error waiting for transaction:', error)
      throw error
    }
  }
}

// Hook para usar el servicio Web3
export function useWeb3Service() {
  return Web3Service.getInstance()
}
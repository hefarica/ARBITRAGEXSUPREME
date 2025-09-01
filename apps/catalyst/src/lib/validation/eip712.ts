/**
 * ArbitrageX Supreme - EIP-712 Validation System
 * Ingenio Pichichi S.A. - Sistema de firmas tipadas para seguridad enterprise
 * 
 * Implementación metodica y disciplinada de EIP-712 para validación
 * de payloads críticos en transacciones de arbitraje
 */

import { ethers } from 'ethers'

// ============================================
// EIP-712 DOMAIN TYPES
// ============================================

export interface EIP712Domain {
  name: string
  version: string
  chainId: number
  verifyingContract: string
}

// ============================================
// ARBITRAGE PAYLOAD TYPES
// ============================================

export interface ArbitragePayload {
  opportunityId: string
  tokenIn: string
  tokenOut: string
  amountIn: string
  minAmountOut: string
  deadline: number
  recipient: string
  nonce: number
}

export interface ExecutionPayload {
  strategy: string
  path: string[]
  amounts: string[]
  gasLimit: string
  maxGasPrice: string
  slippageTolerance: number
  timestamp: number
  nonce: number
}

// ============================================
// EIP-712 TYPE DEFINITIONS
// ============================================

export const ARBITRAGE_TYPES = {
  ArbitrageOrder: [
    { name: 'opportunityId', type: 'string' },
    { name: 'tokenIn', type: 'address' },
    { name: 'tokenOut', type: 'address' },
    { name: 'amountIn', type: 'uint256' },
    { name: 'minAmountOut', type: 'uint256' },
    { name: 'deadline', type: 'uint256' },
    { name: 'recipient', type: 'address' },
    { name: 'nonce', type: 'uint256' }
  ]
}

export const EXECUTION_TYPES = {
  ExecutionOrder: [
    { name: 'strategy', type: 'string' },
    { name: 'path', type: 'address[]' },
    { name: 'amounts', type: 'uint256[]' },
    { name: 'gasLimit', type: 'uint256' },
    { name: 'maxGasPrice', type: 'uint256' },
    { name: 'slippageTolerance', type: 'uint256' },
    { name: 'timestamp', type: 'uint256' },
    { name: 'nonce', type: 'uint256' }
  ]
}

// ============================================
// DOMAIN CONFIGURATIONS
// ============================================

export const ARBITRAGE_DOMAINS: Record<number, EIP712Domain> = {
  1: { // Ethereum Mainnet
    name: 'ArbitrageX Supreme',
    version: '2.0.0',
    chainId: 1,
    verifyingContract: '0x0000000000000000000000000000000000000000' // Will be updated with actual contract
  },
  56: { // BSC Mainnet
    name: 'ArbitrageX Supreme',
    version: '2.0.0',
    chainId: 56,
    verifyingContract: '0x0000000000000000000000000000000000000000'
  },
  137: { // Polygon Mainnet
    name: 'ArbitrageX Supreme',
    version: '2.0.0',
    chainId: 137,
    verifyingContract: '0x0000000000000000000000000000000000000000'
  },
  42161: { // Arbitrum One
    name: 'ArbitrageX Supreme',
    version: '2.0.0',
    chainId: 42161,
    verifyingContract: '0x0000000000000000000000000000000000000000'
  },
  10: { // Optimism
    name: 'ArbitrageX Supreme',
    version: '2.0.0',
    chainId: 10,
    verifyingContract: '0x0000000000000000000000000000000000000000'
  }
}

// ============================================
// EIP-712 SIGNATURE UTILS
// ============================================

export class EIP712Validator {
  private domain: EIP712Domain
  private chainId: number

  constructor(chainId: number) {
    this.chainId = chainId
    this.domain = ARBITRAGE_DOMAINS[chainId]
    
    if (!this.domain) {
      throw new Error(`Unsupported chain ID: ${chainId}`)
    }
  }

  /**
   * Generate EIP-712 hash for arbitrage payload
   */
  async hashArbitragePayload(payload: ArbitragePayload): Promise<string> {
    const types = {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' }
      ],
      ...ARBITRAGE_TYPES
    }

    const value = {
      opportunityId: payload.opportunityId,
      tokenIn: payload.tokenIn,
      tokenOut: payload.tokenOut,
      amountIn: payload.amountIn,
      minAmountOut: payload.minAmountOut,
      deadline: payload.deadline,
      recipient: payload.recipient,
      nonce: payload.nonce
    }

    return ethers.TypedDataEncoder.hash(this.domain, types, value)
  }

  /**
   * Generate EIP-712 hash for execution payload
   */
  async hashExecutionPayload(payload: ExecutionPayload): Promise<string> {
    const types = {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' }
      ],
      ...EXECUTION_TYPES
    }

    const value = {
      strategy: payload.strategy,
      path: payload.path,
      amounts: payload.amounts,
      gasLimit: payload.gasLimit,
      maxGasPrice: payload.maxGasPrice,
      slippageTolerance: payload.slippageTolerance,
      timestamp: payload.timestamp,
      nonce: payload.nonce
    }

    return ethers.TypedDataEncoder.hash(this.domain, types, value)
  }

  /**
   * Sign arbitrage payload with wallet
   */
  async signArbitragePayload(
    payload: ArbitragePayload,
    signer: ethers.Signer
  ): Promise<string> {
    const types = {
      ...ARBITRAGE_TYPES
    }

    const value = {
      opportunityId: payload.opportunityId,
      tokenIn: payload.tokenIn,
      tokenOut: payload.tokenOut,
      amountIn: payload.amountIn,
      minAmountOut: payload.minAmountOut,
      deadline: payload.deadline,
      recipient: payload.recipient,
      nonce: payload.nonce
    }

    return await signer.signTypedData(this.domain, types, value)
  }

  /**
   * Sign execution payload with wallet
   */
  async signExecutionPayload(
    payload: ExecutionPayload,
    signer: ethers.Signer
  ): Promise<string> {
    const types = {
      ...EXECUTION_TYPES
    }

    const value = {
      strategy: payload.strategy,
      path: payload.path,
      amounts: payload.amounts,
      gasLimit: payload.gasLimit,
      maxGasPrice: payload.maxGasPrice,
      slippageTolerance: payload.slippageTolerance,
      timestamp: payload.timestamp,
      nonce: payload.nonce
    }

    return await signer.signTypedData(this.domain, types, value)
  }

  /**
   * Verify signature against payload
   */
  async verifyArbitrageSignature(
    payload: ArbitragePayload,
    signature: string,
    expectedSigner: string
  ): Promise<boolean> {
    try {
      const types = {
        ...ARBITRAGE_TYPES
      }

      const value = {
        opportunityId: payload.opportunityId,
        tokenIn: payload.tokenIn,
        tokenOut: payload.tokenOut,
        amountIn: payload.amountIn,
        minAmountOut: payload.minAmountOut,
        deadline: payload.deadline,
        recipient: payload.recipient,
        nonce: payload.nonce
      }

      const recoveredAddress = ethers.verifyTypedData(
        this.domain,
        types,
        value,
        signature
      )

      return recoveredAddress.toLowerCase() === expectedSigner.toLowerCase()
    } catch (error) {
      console.error('Signature verification failed:', error)
      return false
    }
  }

  /**
   * Verify execution signature
   */
  async verifyExecutionSignature(
    payload: ExecutionPayload,
    signature: string,
    expectedSigner: string
  ): Promise<boolean> {
    try {
      const types = {
        ...EXECUTION_TYPES
      }

      const value = {
        strategy: payload.strategy,
        path: payload.path,
        amounts: payload.amounts,
        gasLimit: payload.gasLimit,
        maxGasPrice: payload.maxGasPrice,
        slippageTolerance: payload.slippageTolerance,
        timestamp: payload.timestamp,
        nonce: payload.nonce
      }

      const recoveredAddress = ethers.verifyTypedData(
        this.domain,
        types,
        value,
        signature
      )

      return recoveredAddress.toLowerCase() === expectedSigner.toLowerCase()
    } catch (error) {
      console.error('Execution signature verification failed:', error)
      return false
    }
  }

  /**
   * Update domain contract address
   */
  updateContract(contractAddress: string) {
    this.domain.verifyingContract = contractAddress
  }

  /**
   * Get current domain
   */
  getDomain(): EIP712Domain {
    return { ...this.domain }
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Create validator for specific chain
 */
export function createEIP712Validator(chainId: number): EIP712Validator {
  return new EIP712Validator(chainId)
}

/**
 * Validate payload structure
 */
export function validateArbitragePayload(payload: any): payload is ArbitragePayload {
  return (
    typeof payload.opportunityId === 'string' &&
    typeof payload.tokenIn === 'string' &&
    typeof payload.tokenOut === 'string' &&
    typeof payload.amountIn === 'string' &&
    typeof payload.minAmountOut === 'string' &&
    typeof payload.deadline === 'number' &&
    typeof payload.recipient === 'string' &&
    typeof payload.nonce === 'number'
  )
}

/**
 * Validate execution payload structure
 */
export function validateExecutionPayload(payload: any): payload is ExecutionPayload {
  return (
    typeof payload.strategy === 'string' &&
    Array.isArray(payload.path) &&
    Array.isArray(payload.amounts) &&
    typeof payload.gasLimit === 'string' &&
    typeof payload.maxGasPrice === 'string' &&
    typeof payload.slippageTolerance === 'number' &&
    typeof payload.timestamp === 'number' &&
    typeof payload.nonce === 'number'
  )
}

/**
 * Generate nonce for payload
 */
export function generateNonce(): number {
  return Math.floor(Date.now() / 1000) + Math.floor(Math.random() * 1000000)
}

/**
 * Generate deadline (5 minutes from now)
 */
export function generateDeadline(): number {
  return Math.floor(Date.now() / 1000) + 300 // 5 minutes
}
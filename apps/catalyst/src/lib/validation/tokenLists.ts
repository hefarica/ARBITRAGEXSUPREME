/**
 * ArbitrageX Supreme - Token Lists & Validation
 * Ingenio Pichichi S.A. - Sistema de listas blancas/negras de tokens
 * 
 * Implementación metodica y disciplinada para validación de tokens
 * con listas blancas, negras y verificación de seguridad
 */

// ============================================
// TOKEN LIST INTERFACES
// ============================================

export interface TokenInfo {
  address: string
  name: string
  symbol: string
  decimals: number
  chainId: number
  logoURI?: string
  verified: boolean
  riskScore: number // 0-10 (0 = safest, 10 = highest risk)
  tags: string[]
  source: 'manual' | 'uniswap' | 'coingecko' | 'defillama' | 'chainlink'
  addedAt: number
  lastUpdated: number
}

export interface TokenList {
  name: string
  version: string
  timestamp: number
  tokens: TokenInfo[]
  logoURI?: string
  keywords?: string[]
}

export interface TokenValidationResult {
  isValid: boolean
  isWhitelisted: boolean
  isBlacklisted: boolean
  riskScore: number
  reasons: string[]
  token?: TokenInfo
}

// ============================================
// WHITELIST TOKENS (VERIFIED & SAFE)
// ============================================

export const WHITELIST_TOKENS: Record<number, TokenInfo[]> = {
  // Ethereum Mainnet
  1: [
    {
      address: '0xA0b86a33E6441c8C4295eaFb5EaF81e7596b6Ba8', // WETH
      name: 'Wrapped Ether',
      symbol: 'WETH',
      decimals: 18,
      chainId: 1,
      verified: true,
      riskScore: 0,
      tags: ['native', 'stablecoin-like'],
      source: 'manual',
      addedAt: Date.now(),
      lastUpdated: Date.now()
    },
    {
      address: '0xA0b86a33E6441c8C4295eaFb5EaF81e7596b6Ba8', // USDC
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 6,
      chainId: 1,
      verified: true,
      riskScore: 1,
      tags: ['stablecoin', 'fiat'],
      source: 'manual',
      addedAt: Date.now(),
      lastUpdated: Date.now()
    },
    {
      address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
      name: 'Tether USD',
      symbol: 'USDT',
      decimals: 6,
      chainId: 1,
      verified: true,
      riskScore: 2,
      tags: ['stablecoin', 'fiat'],
      source: 'manual',
      addedAt: Date.now(),
      lastUpdated: Date.now()
    },
    {
      address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', // DAI
      name: 'Dai Stablecoin',
      symbol: 'DAI',
      decimals: 18,
      chainId: 1,
      verified: true,
      riskScore: 1,
      tags: ['stablecoin', 'defi'],
      source: 'manual',
      addedAt: Date.now(),
      lastUpdated: Date.now()
    }
  ],
  
  // BSC Mainnet
  56: [
    {
      address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // WBNB
      name: 'Wrapped BNB',
      symbol: 'WBNB',
      decimals: 18,
      chainId: 56,
      verified: true,
      riskScore: 0,
      tags: ['native'],
      source: 'manual',
      addedAt: Date.now(),
      lastUpdated: Date.now()
    },
    {
      address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', // USDC
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 18,
      chainId: 56,
      verified: true,
      riskScore: 1,
      tags: ['stablecoin', 'fiat'],
      source: 'manual',
      addedAt: Date.now(),
      lastUpdated: Date.now()
    }
  ],
  
  // Polygon Mainnet
  137: [
    {
      address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // WMATIC
      name: 'Wrapped Matic',
      symbol: 'WMATIC',
      decimals: 18,
      chainId: 137,
      verified: true,
      riskScore: 0,
      tags: ['native'],
      source: 'manual',
      addedAt: Date.now(),
      lastUpdated: Date.now()
    }
  ]
}

// ============================================
// BLACKLIST TOKENS (SCAMS & HIGH RISK)
// ============================================

export const BLACKLIST_TOKENS: Record<number, string[]> = {
  1: [ // Ethereum Mainnet
    '0x0000000000000000000000000000000000000000', // Zero address
    // Add known scam/rug pull tokens here
  ],
  56: [ // BSC Mainnet
    '0x0000000000000000000000000000000000000000',
    // Add BSC scam tokens
  ],
  137: [ // Polygon
    '0x0000000000000000000000000000000000000000',
    // Add Polygon scam tokens
  ]
}

// ============================================
// ROI & RISK LIMITS
// ============================================

export interface RiskLimits {
  minProfitUSD: number
  maxProfitUSD: number
  minROIPercent: number
  maxROIPercent: number
  maxSlippagePercent: number
  maxGasPriceGwei: number
  maxRiskScore: number
  maxAmountUSD: number
}

export const DEFAULT_RISK_LIMITS: RiskLimits = {
  minProfitUSD: 10, // $10 minimum profit
  maxProfitUSD: 100000, // $100k maximum profit
  minROIPercent: 0.5, // 0.5% minimum ROI
  maxROIPercent: 1000, // 1000% maximum ROI (prevents extreme outliers)
  maxSlippagePercent: 5, // 5% maximum slippage
  maxGasPriceGwei: 100, // 100 Gwei maximum
  maxRiskScore: 7, // Risk score 0-7 allowed (8-10 blocked)
  maxAmountUSD: 50000 // $50k maximum trade size
}

export const RISK_PROFILES: Record<string, RiskLimits> = {
  CONSERVATIVE: {
    minProfitUSD: 50,
    maxProfitUSD: 10000,
    minROIPercent: 1,
    maxROIPercent: 100,
    maxSlippagePercent: 2,
    maxGasPriceGwei: 50,
    maxRiskScore: 4,
    maxAmountUSD: 10000
  },
  MODERATE: {
    minProfitUSD: 25,
    maxProfitUSD: 50000,
    minROIPercent: 0.75,
    maxROIPercent: 300,
    maxSlippagePercent: 3,
    maxGasPriceGwei: 75,
    maxRiskScore: 6,
    maxAmountUSD: 25000
  },
  AGGRESSIVE: {
    minProfitUSD: 10,
    maxProfitUSD: 100000,
    minROIPercent: 0.5,
    maxROIPercent: 1000,
    maxSlippagePercent: 5,
    maxGasPriceGwei: 100,
    maxRiskScore: 8,
    maxAmountUSD: 100000
  }
}

// ============================================
// TOKEN VALIDATION CLASS
// ============================================

export class TokenValidator {
  private whitelist: Map<string, TokenInfo>
  private blacklist: Set<string>
  private riskLimits: RiskLimits
  private chainId: number

  constructor(chainId: number, riskProfile: keyof typeof RISK_PROFILES = 'MODERATE') {
    this.chainId = chainId
    this.riskLimits = RISK_PROFILES[riskProfile]
    
    // Initialize whitelist
    this.whitelist = new Map()
    const tokens = WHITELIST_TOKENS[chainId] || []
    tokens.forEach(token => {
      this.whitelist.set(token.address.toLowerCase(), token)
    })
    
    // Initialize blacklist
    this.blacklist = new Set()
    const blacklisted = BLACKLIST_TOKENS[chainId] || []
    blacklisted.forEach(address => {
      this.blacklist.add(address.toLowerCase())
    })
  }

  /**
   * Validate single token
   */
  async validateToken(tokenAddress: string): Promise<TokenValidationResult> {
    const address = tokenAddress.toLowerCase()
    const reasons: string[] = []

    // Check blacklist first
    if (this.blacklist.has(address)) {
      return {
        isValid: false,
        isWhitelisted: false,
        isBlacklisted: true,
        riskScore: 10,
        reasons: ['Token is blacklisted']
      }
    }

    // Check whitelist
    const whitelistedToken = this.whitelist.get(address)
    if (whitelistedToken) {
      return {
        isValid: true,
        isWhitelisted: true,
        isBlacklisted: false,
        riskScore: whitelistedToken.riskScore,
        reasons: ['Token is whitelisted'],
        token: whitelistedToken
      }
    }

    // For non-whitelisted tokens, perform additional checks
    let riskScore = 5 // Default medium risk
    let isValid = true

    // Check if it's a zero address or similar
    if (address === '0x0000000000000000000000000000000000000000') {
      return {
        isValid: false,
        isWhitelisted: false,
        isBlacklisted: false,
        riskScore: 10,
        reasons: ['Invalid token address (zero address)']
      }
    }

    // Check address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
      return {
        isValid: false,
        isWhitelisted: false,
        isBlacklisted: false,
        riskScore: 10,
        reasons: ['Invalid token address format']
      }
    }

    // Risk assessment for unknown tokens
    if (riskScore > this.riskLimits.maxRiskScore) {
      isValid = false
      reasons.push(`Token risk score (${riskScore}) exceeds maximum allowed (${this.riskLimits.maxRiskScore})`)
    }

    return {
      isValid,
      isWhitelisted: false,
      isBlacklisted: false,
      riskScore,
      reasons: reasons.length > 0 ? reasons : ['Unknown token - proceed with caution']
    }
  }

  /**
   * Validate token pair for arbitrage
   */
  async validateTokenPair(tokenA: string, tokenB: string): Promise<{
    tokenA: TokenValidationResult
    tokenB: TokenValidationResult
    pairValid: boolean
    reasons: string[]
  }> {
    const [resultA, resultB] = await Promise.all([
      this.validateToken(tokenA),
      this.validateToken(tokenB)
    ])

    const reasons: string[] = []
    let pairValid = resultA.isValid && resultB.isValid

    // Additional pair-specific checks
    if (tokenA.toLowerCase() === tokenB.toLowerCase()) {
      pairValid = false
      reasons.push('Cannot arbitrage same token')
    }

    // Check combined risk
    const combinedRisk = Math.max(resultA.riskScore, resultB.riskScore)
    if (combinedRisk > this.riskLimits.maxRiskScore) {
      pairValid = false
      reasons.push(`Combined risk score too high: ${combinedRisk}`)
    }

    return {
      tokenA: resultA,
      tokenB: resultB,
      pairValid,
      reasons
    }
  }

  /**
   * Validate ROI parameters
   */
  validateROI(profitUSD: number, roiPercent: number, amountUSD: number): {
    isValid: boolean
    reasons: string[]
  } {
    const reasons: string[] = []
    let isValid = true

    if (profitUSD < this.riskLimits.minProfitUSD) {
      isValid = false
      reasons.push(`Profit $${profitUSD} below minimum $${this.riskLimits.minProfitUSD}`)
    }

    if (profitUSD > this.riskLimits.maxProfitUSD) {
      isValid = false
      reasons.push(`Profit $${profitUSD} exceeds maximum $${this.riskLimits.maxProfitUSD}`)
    }

    if (roiPercent < this.riskLimits.minROIPercent) {
      isValid = false
      reasons.push(`ROI ${roiPercent}% below minimum ${this.riskLimits.minROIPercent}%`)
    }

    if (roiPercent > this.riskLimits.maxROIPercent) {
      isValid = false
      reasons.push(`ROI ${roiPercent}% exceeds maximum ${this.riskLimits.maxROIPercent}%`)
    }

    if (amountUSD > this.riskLimits.maxAmountUSD) {
      isValid = false
      reasons.push(`Amount $${amountUSD} exceeds maximum $${this.riskLimits.maxAmountUSD}`)
    }

    return { isValid, reasons }
  }

  /**
   * Add token to whitelist
   */
  addToWhitelist(token: TokenInfo) {
    this.whitelist.set(token.address.toLowerCase(), token)
  }

  /**
   * Add token to blacklist
   */
  addToBlacklist(tokenAddress: string) {
    const address = tokenAddress.toLowerCase()
    this.blacklist.add(address)
    this.whitelist.delete(address) // Remove from whitelist if present
  }

  /**
   * Update risk limits
   */
  updateRiskLimits(newLimits: Partial<RiskLimits>) {
    this.riskLimits = { ...this.riskLimits, ...newLimits }
  }

  /**
   * Get current risk limits
   */
  getRiskLimits(): RiskLimits {
    return { ...this.riskLimits }
  }

  /**
   * Get whitelist size
   */
  getWhitelistSize(): number {
    return this.whitelist.size
  }

  /**
   * Get blacklist size
   */
  getBlacklistSize(): number {
    return this.blacklist.size
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Create token validator for chain
 */
export function createTokenValidator(
  chainId: number, 
  riskProfile: keyof typeof RISK_PROFILES = 'MODERATE'
): TokenValidator {
  return new TokenValidator(chainId, riskProfile)
}

/**
 * Load token list from external source
 */
export async function loadTokenList(url: string): Promise<TokenList> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to load token list: ${response.statusText}`)
    }
    return await response.json()
  } catch (error) {
    console.error('Error loading token list:', error)
    throw error
  }
}

/**
 * Merge multiple token lists
 */
export function mergeTokenLists(...lists: TokenList[]): TokenList {
  const mergedTokens = new Map<string, TokenInfo>()
  
  lists.forEach(list => {
    list.tokens.forEach(token => {
      const key = `${token.chainId}_${token.address.toLowerCase()}`
      const existing = mergedTokens.get(key)
      
      // Keep the most recently updated token
      if (!existing || token.lastUpdated > existing.lastUpdated) {
        mergedTokens.set(key, token)
      }
    })
  })

  return {
    name: 'ArbitrageX Supreme Merged List',
    version: '1.0.0',
    timestamp: Date.now(),
    tokens: Array.from(mergedTokens.values())
  }
}
/**
 * ArbitrageX Supreme - Test Utilities
 * Ingenio Pichichi S.A. - Utilidades para testing de componentes React
 * 
 * Implementación metodica y disciplinada para:
 * - Render helpers
 * - Mock data factories
 * - Custom matchers
 * - Testing utilities
 */

import React from 'react'
import { render as rtlRender, RenderOptions } from '@testing-library/react'
import { ThemeProvider } from '@/components/providers/theme-provider'

// Mock data factories
export const createMockArbitrageOpportunity = (overrides = {}) => ({
  id: 'test-opportunity-1',
  strategyType: 'INTRA_DEX',
  profitEstimateUsd: 125.50,
  profitPercentage: 2.5,
  tokenSymbol: 'USDC',
  sourcePriceUsd: 1.001,
  targetPriceUsd: 1.026,
  gasEstimate: '150000',
  gasCostUsd: 25.30,
  slippageEstimate: 0.5,
  status: 'READY',
  detectedAt: new Date('2024-01-15T10:00:00Z'),
  executedAt: null,
  isExecuted: false,
  protocol: {
    name: 'Uniswap V3',
    symbol: 'UNI',
    riskScore: 3
  },
  sourcePool: {
    token0Symbol: 'USDC',
    token1Symbol: 'ETH',
    tvl: 1500000,
    volume24h: 500000
  },
  blockchain: {
    chainId: 1,
    name: 'Ethereum',
    symbol: 'ETH'
  },
  ...overrides
})

export const createMockSimulationResult = (overrides = {}) => ({
  simulationId: 'sim_test_123',
  isValid: true,
  profitEstimate: 100.25,
  netProfit: 75.25,
  totalGasCost: 25.00,
  riskScore: 4,
  confidence: 85.5,
  warnings: ['Low liquidity detected'],
  executionPath: [
    { protocol: 'Uniswap', action: 'swap', token: 'USDC' },
    { protocol: 'SushiSwap', action: 'swap', token: 'ETH' }
  ],
  marketConditions: {
    slippageImpact: 0.2,
    liquidityAvailable: 850.5,
    priceImpact: 0.1,
    volatilityScore: 3.2
  },
  validUntil: Date.now() + 300000, // 5 minutes
  ...overrides
})

export const createMockGasEstimate = (overrides = {}) => ({
  operation: 'flashLoan',
  estimatedGas: 180000,
  gasPrice: 25,
  gasCostUSD: 45.50,
  confidence: 92.5,
  chainId: 1,
  ...overrides
})

export const createMockUser = (overrides = {}) => ({
  address: '0x1234567890123456789012345678901234567890',
  role: 'user',
  permissions: ['read', 'simulate', 'execute'],
  isVerified: true,
  lastActivity: Date.now(),
  ...overrides
})

export const createMockProtocol = (overrides = {}) => ({
  id: 'protocol-1',
  name: 'Uniswap V3',
  symbol: 'UNI',
  category: 'DEX_AMM',
  tvl: 5000000,
  volume24h: 1000000,
  riskScore: 3,
  isActive: true,
  isVerified: true,
  supportsFlashLoans: true,
  flashLoanFee: 0.09,
  blockchain: {
    chainId: 1,
    name: 'Ethereum'
  },
  ...overrides
})

// Custom render function with providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  theme?: 'light' | 'dark' | 'system'
}

export function render(
  ui: React.ReactElement,
  options: CustomRenderOptions = {}
) {
  const { theme = 'light', ...renderOptions } = options

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <ThemeProvider
        attribute="class"
        defaultTheme={theme}
        enableSystem={false}
      >
        {children}
      </ThemeProvider>
    )
  }

  return rtlRender(ui, { wrapper: Wrapper, ...renderOptions })
}

// Custom hooks testing utilities
export const createMockHookReturn = {
  useWallet: (overrides = {}) => ({
    address: '0x1234567890123456789012345678901234567890',
    chainId: 1,
    isConnected: true,
    isConnecting: false,
    isError: false,
    error: null,
    connect: jest.fn(),
    disconnect: jest.fn(),
    switchChain: jest.fn(),
    signMessage: jest.fn().mockResolvedValue('0xsignature...'),
    signTypedData: jest.fn().mockResolvedValue('0xsignature...'),
    ...overrides
  }),

  useArbitrage: (overrides = {}) => ({
    opportunities: [createMockArbitrageOpportunity()],
    isScanning: false,
    isLoading: false,
    error: null,
    filters: {
      minProfitUsd: 10,
      maxRiskScore: 7,
      strategyTypes: ['INTRA_DEX']
    },
    startScanning: jest.fn(),
    stopScanning: jest.fn(),
    refreshOpportunities: jest.fn(),
    updateFilters: jest.fn(),
    executeOpportunity: jest.fn(),
    ...overrides
  }),

  useSimulation: (overrides = {}) => ({
    simulationResult: createMockSimulationResult(),
    gasEstimates: [createMockGasEstimate()],
    isLoading: false,
    error: null,
    simulationConfig: {
      iterations: 1000,
      slippageTolerance: 1.0,
      gasMultiplier: 1.2,
      confidenceThreshold: 80
    },
    runSimulation: jest.fn(),
    clearSimulation: jest.fn(),
    updateConfig: jest.fn(),
    ...overrides
  })
}

// API Response mocks
export const createMockApiResponse = {
  success: (data: any) => ({
    success: true,
    data,
    timestamp: new Date().toISOString()
  }),

  error: (error: string, status = 400) => ({
    success: false,
    error,
    status,
    timestamp: new Date().toISOString()
  }),

  simulateApi: (data: any) => ({
    success: true,
    data: {
      simulationId: 'sim_test_123',
      isValid: true,
      profitEstimate: 100.25,
      ...data
    }
  }),

  executeApi: (data: any) => ({
    success: true,
    data: {
      transactionHash: '0xtxhash...',
      status: 'success',
      actualProfit: 98.50,
      gasCost: 24.75,
      ...data
    }
  })
}

// Form testing utilities
export const fillForm = {
  arbitrageForm: async (user: any, values: any) => {
    const { tokenIn = 'USDC', tokenOut = 'ETH', amountIn = '1000', slippageTolerance = '1.0' } = values

    if (tokenIn) {
      const tokenInInput = await user.findByLabelText(/token in/i)
      await user.clear(tokenInInput)
      await user.type(tokenInInput, tokenIn)
    }

    if (tokenOut) {
      const tokenOutInput = await user.findByLabelText(/token out/i)
      await user.clear(tokenOutInput)
      await user.type(tokenOutInput, tokenOut)
    }

    if (amountIn) {
      const amountInput = await user.findByLabelText(/amount in/i)
      await user.clear(amountInput)
      await user.type(amountInput, amountIn)
    }

    if (slippageTolerance) {
      const slippageInput = await user.findByLabelText(/slippage tolerance/i)
      await user.clear(slippageInput)
      await user.type(slippageInput, slippageTolerance)
    }
  }
}

// Wait utilities
export const waitFor = {
  elementToBeVisible: async (element: HTMLElement, timeout = 5000) => {
    return new Promise((resolve, reject) => {
      const startTime = Date.now()
      const checkVisibility = () => {
        if (element.style.display !== 'none' && element.offsetHeight > 0) {
          resolve(element)
        } else if (Date.now() - startTime > timeout) {
          reject(new Error(`Element not visible after ${timeout}ms`))
        } else {
          setTimeout(checkVisibility, 100)
        }
      }
      checkVisibility()
    })
  }
}

// Custom matchers
export const customMatchers = {
  toBeValidEthereumAddress: (received: string) => {
    const pass = /^0x[a-fA-F0-9]{40}$/.test(received)
    return {
      message: () =>
        `expected ${received} ${pass ? 'not ' : ''}to be a valid Ethereum address`,
      pass
    }
  },

  toBeValidTransactionHash: (received: string) => {
    const pass = /^0x[a-fA-F0-9]{64}$/.test(received)
    return {
      message: () =>
        `expected ${received} ${pass ? 'not ' : ''}to be a valid transaction hash`,
      pass
    }
  }
}

// Re-export everything from testing-library
export * from '@testing-library/react'
export { default as userEvent } from '@testing-library/user-event'
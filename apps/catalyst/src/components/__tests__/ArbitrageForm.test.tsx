/**
 * ArbitrageX Supreme - ArbitrageForm Tests
 * Ingenio Pichichi S.A. - Tests unitarios para ArbitrageForm
 * 
 * Implementación metodica y disciplinada de tests para:
 * - Rendering del formulario
 * - Validación de inputs
 * - Interacciones del usuario
 * - Estados de loading/error
 * - Integración con hooks
 */

import React from 'react'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ArbitrageForm } from '../forms/ArbitrageForm'
import { 
  render, 
  createMockHookReturn,
  createMockSimulationResult,
  createMockUser
} from '@/test/utils'

// Mock de los hooks
const mockUseWallet = jest.fn()
const mockUseArbitrage = jest.fn()
const mockUseSimulation = jest.fn()

jest.mock('@/hooks', () => ({
  useWallet: () => mockUseWallet(),
  useArbitrage: () => mockUseArbitrage(),
  useSimulation: () => mockUseSimulation(),
}))

jest.mock('@/lib/validation', () => ({
  createTokenValidator: () => ({
    validateTokenPair: jest.fn().mockResolvedValue({ isValid: true, errors: [] })
  }),
  createEIP712Validator: () => ({
    signArbitragePayload: jest.fn().mockResolvedValue('0xsignature...')
  })
}))

describe('ArbitrageForm', () => {
  const defaultMockUser = createMockUser()
  
  beforeEach(() => {
    // Reset mocks
    mockUseWallet.mockReturnValue(createMockHookReturn.useWallet({ 
      address: defaultMockUser.address,
      isConnected: true 
    }))
    
    mockUseArbitrage.mockReturnValue(createMockHookReturn.useArbitrage())
    
    mockUseSimulation.mockReturnValue(createMockHookReturn.useSimulation({
      simulationResult: null,
      isLoading: false
    }))
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render the form with all required fields', () => {
      render(<ArbitrageForm />)

      // Verificar título
      expect(screen.getByText(/ArbitrageX Supreme - Trading Form/i)).toBeInTheDocument()

      // Verificar campos principales
      expect(screen.getByLabelText(/token in/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/token out/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/amount in/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/slippage tolerance/i)).toBeInTheDocument()

      // Verificar botones
      expect(screen.getByRole('button', { name: /simulate/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /execute/i })).toBeInTheDocument()
    })

    it('should show connection prompt when wallet is not connected', () => {
      mockUseWallet.mockReturnValue(createMockHookReturn.useWallet({ 
        isConnected: false,
        address: null 
      }))

      render(<ArbitrageForm />)

      expect(screen.getByText(/connect wallet/i)).toBeInTheDocument()
    })

    it('should disable execute button when no simulation result', () => {
      render(<ArbitrageForm />)

      const executeButton = screen.getByRole('button', { name: /execute/i })
      expect(executeButton).toBeDisabled()
    })
  })

  describe('Form Validation', () => {
    const user = userEvent.setup()

    it('should validate token input fields', async () => {
      render(<ArbitrageForm />)

      const tokenInInput = screen.getByLabelText(/token in/i)
      
      // Test empty input
      await user.clear(tokenInInput)
      await user.tab()
      
      expect(screen.getByText(/token in es requerido/i)).toBeInTheDocument()
    })

    it('should validate amount input', async () => {
      render(<ArbitrageForm />)

      const amountInput = screen.getByLabelText(/amount in/i)
      
      // Test invalid amount
      await user.clear(amountInput)
      await user.type(amountInput, '-100')
      await user.tab()
      
      expect(screen.getByText(/amount debe ser mayor a 0/i)).toBeInTheDocument()
    })

    it('should validate slippage tolerance range', async () => {
      render(<ArbitrageForm />)

      const slippageInput = screen.getByLabelText(/slippage tolerance/i)
      
      // Test invalid slippage (too high)
      await user.clear(slippageInput)
      await user.type(slippageInput, '15')
      await user.tab()
      
      expect(screen.getByText(/slippage debe estar entre 0.1% y 10%/i)).toBeInTheDocument()
    })

    it('should prevent same token selection', async () => {
      render(<ArbitrageForm />)

      const tokenInInput = screen.getByLabelText(/token in/i)
      const tokenOutInput = screen.getByLabelText(/token out/i)
      
      await user.type(tokenInInput, 'USDC')
      await user.type(tokenOutInput, 'USDC')
      await user.tab()
      
      expect(screen.getByText(/tokens deben ser diferentes/i)).toBeInTheDocument()
    })
  })

  describe('Token Swap Functionality', () => {
    const user = userEvent.setup()

    it('should swap tokens when swap button is clicked', async () => {
      render(<ArbitrageForm />)

      const tokenInInput = screen.getByLabelText(/token in/i)
      const tokenOutInput = screen.getByLabelText(/token out/i)
      const swapButton = screen.getByRole('button', { name: /intercambiar tokens/i })

      // Set initial values
      await user.type(tokenInInput, 'USDC')
      await user.type(tokenOutInput, 'ETH')

      // Click swap
      await user.click(swapButton)

      // Verify tokens were swapped
      expect(tokenInInput).toHaveValue('ETH')
      expect(tokenOutInput).toHaveValue('USDC')
    })
  })

  describe('Simulation', () => {
    const user = userEvent.setup()
    const mockRunSimulation = jest.fn()

    beforeEach(() => {
      mockUseSimulation.mockReturnValue(createMockHookReturn.useSimulation({
        runSimulation: mockRunSimulation,
        isLoading: false,
        simulationResult: null
      }))
    })

    it('should call runSimulation when simulate button is clicked', async () => {
      render(<ArbitrageForm />)

      // Fill form
      await user.type(screen.getByLabelText(/token in/i), 'USDC')
      await user.type(screen.getByLabelText(/token out/i), 'ETH')
      await user.type(screen.getByLabelText(/amount in/i), '1000')

      // Click simulate
      await user.click(screen.getByRole('button', { name: /simulate/i }))

      expect(mockRunSimulation).toHaveBeenCalledWith(
        expect.objectContaining({
          tokenIn: 'USDC',
          tokenOut: 'ETH',
          amountIn: '1000'
        })
      )
    })

    it('should show loading state during simulation', () => {
      mockUseSimulation.mockReturnValue(createMockHookReturn.useSimulation({
        isLoading: true,
        simulationResult: null
      }))

      render(<ArbitrageForm />)

      expect(screen.getByText(/simulating.../i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /simulating.../i })).toBeDisabled()
    })

    it('should display simulation results when available', () => {
      const mockResult = createMockSimulationResult({
        profitEstimate: 125.50,
        netProfit: 100.25,
        riskScore: 4,
        confidence: 85.5
      })

      mockUseSimulation.mockReturnValue(createMockHookReturn.useSimulation({
        simulationResult: mockResult,
        isLoading: false
      }))

      render(<ArbitrageForm />)

      expect(screen.getByText(/simulation results/i)).toBeInTheDocument()
      expect(screen.getByText(/\$125.50/)).toBeInTheDocument() // Profit estimate
      expect(screen.getByText(/\$100.25/)).toBeInTheDocument() // Net profit
      expect(screen.getByText(/85.5%/)).toBeInTheDocument() // Confidence
    })

    it('should enable execute button when valid simulation exists', () => {
      mockUseSimulation.mockReturnValue(createMockHookReturn.useSimulation({
        simulationResult: createMockSimulationResult({ isValid: true }),
        isLoading: false
      }))

      render(<ArbitrageForm />)

      const executeButton = screen.getByRole('button', { name: /execute/i })
      expect(executeButton).not.toBeDisabled()
    })
  })

  describe('Execution', () => {
    const user = userEvent.setup()
    const mockExecuteOpportunity = jest.fn()

    beforeEach(() => {
      mockUseArbitrage.mockReturnValue(createMockHookReturn.useArbitrage({
        executeOpportunity: mockExecuteOpportunity
      }))

      mockUseSimulation.mockReturnValue(createMockHookReturn.useSimulation({
        simulationResult: createMockSimulationResult({ isValid: true }),
        isLoading: false
      }))
    })

    it('should call executeOpportunity when execute button is clicked', async () => {
      render(<ArbitrageForm />)

      const executeButton = screen.getByRole('button', { name: /execute/i })
      await user.click(executeButton)

      expect(mockExecuteOpportunity).toHaveBeenCalled()
    })

    it('should show execution loading state', () => {
      mockUseArbitrage.mockReturnValue(createMockHookReturn.useArbitrage({
        isLoading: true
      }))

      render(<ArbitrageForm />)

      expect(screen.getByText(/executing.../i)).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('should display wallet connection errors', () => {
      mockUseWallet.mockReturnValue(createMockHookReturn.useWallet({
        isConnected: false,
        isError: true,
        error: new Error('Wallet connection failed')
      }))

      render(<ArbitrageForm />)

      expect(screen.getByText(/wallet connection failed/i)).toBeInTheDocument()
    })

    it('should display simulation errors', () => {
      mockUseSimulation.mockReturnValue(createMockHookReturn.useSimulation({
        isLoading: false,
        error: 'Simulation failed: Insufficient liquidity',
        simulationResult: null
      }))

      render(<ArbitrageForm />)

      expect(screen.getByText(/simulation failed: insufficient liquidity/i)).toBeInTheDocument()
    })

    it('should display arbitrage execution errors', () => {
      mockUseArbitrage.mockReturnValue(createMockHookReturn.useArbitrage({
        isLoading: false,
        error: 'Execution failed: Transaction reverted'
      }))

      render(<ArbitrageForm />)

      expect(screen.getByText(/execution failed: transaction reverted/i)).toBeInTheDocument()
    })
  })

  describe('Strategy Type Selection', () => {
    const user = userEvent.setup()

    it('should allow strategy type selection', async () => {
      render(<ArbitrageForm />)

      const strategySelect = screen.getByRole('combobox', { name: /strategy type/i })
      await user.click(strategySelect)

      expect(screen.getByText(/intra_dex/i)).toBeInTheDocument()
      expect(screen.getByText(/inter_dex/i)).toBeInTheDocument()
      expect(screen.getByText(/cross_chain/i)).toBeInTheDocument()
    })
  })

  describe('Gas Configuration', () => {
    const user = userEvent.setup()

    it('should allow gas price adjustment', async () => {
      render(<ArbitrageForm />)

      const gasPriceInput = screen.getByLabelText(/gas price multiplier/i)
      
      await user.clear(gasPriceInput)
      await user.type(gasPriceInput, '1.5')

      expect(gasPriceInput).toHaveValue('1.5')
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<ArbitrageForm />)

      expect(screen.getByLabelText(/token in/i)).toHaveAttribute('aria-required', 'true')
      expect(screen.getByLabelText(/token out/i)).toHaveAttribute('aria-required', 'true')
      expect(screen.getByLabelText(/amount in/i)).toHaveAttribute('aria-required', 'true')
    })

    it('should be keyboard navigable', async () => {
      const user = userEvent.setup()
      render(<ArbitrageForm />)

      const tokenInInput = screen.getByLabelText(/token in/i)
      
      await user.tab()
      expect(tokenInInput).toHaveFocus()

      await user.tab()
      expect(screen.getByLabelText(/token out/i)).toHaveFocus()
    })
  })
})
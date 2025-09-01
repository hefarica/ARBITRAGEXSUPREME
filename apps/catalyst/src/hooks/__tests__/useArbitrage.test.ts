/**
 * @fileoverview Tests unitarios para el hook useArbitrage
 * Ingenio Pichichi S.A. - ArbitrageX Supreme
 * Tests completos para funcionalidad de arbitraje con simulación y ejecución
 */

import { renderHook, act, waitFor } from '@testing-library/react'
import { ethers } from 'ethers'
import { useArbitrage } from '../useArbitrage'
import { useWallet } from '../useWallet'
import type { ArbitrageParams, ArbitrageResult } from '@/types'

// Mocks
jest.mock('../useWallet')
jest.mock('ethers', () => ({
  ethers: {
    BrowserProvider: jest.fn(),
    Contract: jest.fn(),
    formatUnits: jest.fn(),
    parseUnits: jest.fn(),
    isAddress: jest.fn(),
    verifyTypedData: jest.fn(),
  },
}))

// Mock global fetch
global.fetch = jest.fn()

const mockUseWallet = useWallet as jest.MockedFunction<typeof useWallet>
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>

describe('useArbitrage Hook', () => {
  const mockWalletData = {
    account: '0x742d35Cc6634C0532925a3b8D890319d397C71eF',
    chainId: 1,
    provider: {} as any,
    signer: {} as any,
    isConnected: true,
    isConnecting: false,
    connect: jest.fn(),
    disconnect: jest.fn(),
    switchChain: jest.fn(),
    signMessage: jest.fn(),
    error: null,
  }

  const mockArbitrageParams: ArbitrageParams = {
    strategyType: 'INTRA_DEX',
    sourceChain: 'ethereum',
    targetChain: 'ethereum',
    tokenA: {
      address: '0xA0b86a33E6441cF2b6B82397548632b7F293c98',
      symbol: 'USDC',
      decimals: 6,
      balance: '1000.0',
    },
    tokenB: {
      address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
      symbol: 'DAI',
      decimals: 18,
      balance: '1000.0',
    },
    amount: '100',
    slippage: 0.5,
    deadline: 300,
    gasSettings: {
      gasPrice: '20',
      gasLimit: '300000',
      priorityFee: '2',
    },
  }

  const mockArbitrageResult: ArbitrageResult = {
    id: 'arb-123',
    success: true,
    profit: '5.25',
    gasUsed: '250000',
    transactionHash: '0xabc123...',
    executionTime: 1500,
    priceImpact: 0.15,
    effectiveSlippage: 0.12,
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseWallet.mockReturnValue(mockWalletData)
    
    // Mock successful API responses
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(mockArbitrageResult),
    } as any)
  })

  describe('Inicialización', () => {
    it('debe inicializar con estado por defecto', () => {
      const { result } = renderHook(() => useArbitrage())

      expect(result.current.isSimulating).toBe(false)
      expect(result.current.isExecuting).toBe(false)
      expect(result.current.simulationResult).toBeNull()
      expect(result.current.executionResult).toBeNull()
      expect(result.current.error).toBeNull()
      expect(result.current.gasEstimate).toBeNull()
    })

    it('debe proporcionar funciones de simulación y ejecución', () => {
      const { result } = renderHook(() => useArbitrage())

      expect(typeof result.current.simulateArbitrage).toBe('function')
      expect(typeof result.current.executeArbitrage).toBe('function')
      expect(typeof result.current.estimateGas).toBe('function')
      expect(typeof result.current.reset).toBe('function')
    })
  })

  describe('Simulación de Arbitraje', () => {
    it('debe simular arbitraje exitosamente', async () => {
      const { result } = renderHook(() => useArbitrage())

      const simulationPromise = act(async () => {
        await result.current.simulateArbitrage(mockArbitrageParams)
      })

      // Verificar estado de carga
      expect(result.current.isSimulating).toBe(true)
      expect(result.current.error).toBeNull()

      await simulationPromise

      await waitFor(() => {
        expect(result.current.isSimulating).toBe(false)
        expect(result.current.simulationResult).toEqual(mockArbitrageResult)
        expect(result.current.error).toBeNull()
      })

      // Verificar llamada a API
      expect(mockFetch).toHaveBeenCalledWith('/api/arbitrage/simulate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mockArbitrageParams),
      })
    })

    it('debe manejar errores de simulación', async () => {
      const errorMessage = 'Insufficient liquidity'
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: jest.fn().mockResolvedValue({ error: errorMessage }),
      } as any)

      const { result } = renderHook(() => useArbitrage())

      await act(async () => {
        await result.current.simulateArbitrage(mockArbitrageParams)
      })

      await waitFor(() => {
        expect(result.current.isSimulating).toBe(false)
        expect(result.current.simulationResult).toBeNull()
        expect(result.current.error).toBe(errorMessage)
      })
    })

    it('debe validar wallet conectado antes de simular', async () => {
      mockUseWallet.mockReturnValue({
        ...mockWalletData,
        isConnected: false,
      })

      const { result } = renderHook(() => useArbitrage())

      await act(async () => {
        await result.current.simulateArbitrage(mockArbitrageParams)
      })

      await waitFor(() => {
        expect(result.current.error).toBe('Wallet not connected')
        expect(mockFetch).not.toHaveBeenCalled()
      })
    })
  })

  describe('Ejecución de Arbitraje', () => {
    it('debe ejecutar arbitraje exitosamente', async () => {
      const { result } = renderHook(() => useArbitrage())

      const executionPromise = act(async () => {
        await result.current.executeArbitrage(mockArbitrageParams)
      })

      // Verificar estado de carga
      expect(result.current.isExecuting).toBe(true)
      expect(result.current.error).toBeNull()

      await executionPromise

      await waitFor(() => {
        expect(result.current.isExecuting).toBe(false)
        expect(result.current.executionResult).toEqual(mockArbitrageResult)
        expect(result.current.error).toBeNull()
      })

      // Verificar llamada a API
      expect(mockFetch).toHaveBeenCalledWith('/api/arbitrage/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mockArbitrageParams),
      })
    })

    it('debe manejar errores de ejecución', async () => {
      const errorMessage = 'Transaction failed'
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: jest.fn().mockResolvedValue({ error: errorMessage }),
      } as any)

      const { result } = renderHook(() => useArbitrage())

      await act(async () => {
        await result.current.executeArbitrage(mockArbitrageParams)
      })

      await waitFor(() => {
        expect(result.current.isExecuting).toBe(false)
        expect(result.current.executionResult).toBeNull()
        expect(result.current.error).toBe(errorMessage)
      })
    })

    it('debe requerir simulación exitosa antes de ejecutar', async () => {
      const { result } = renderHook(() => useArbitrage())

      await act(async () => {
        await result.current.executeArbitrage(mockArbitrageParams)
      })

      await waitFor(() => {
        expect(result.current.error).toBe('Please simulate arbitrage first')
        expect(mockFetch).not.toHaveBeenCalled()
      })
    })

    it('debe ejecutar después de simulación exitosa', async () => {
      const { result } = renderHook(() => useArbitrage())

      // Primero simular
      await act(async () => {
        await result.current.simulateArbitrage(mockArbitrageParams)
      })

      await waitFor(() => {
        expect(result.current.simulationResult).toEqual(mockArbitrageResult)
      })

      // Luego ejecutar
      await act(async () => {
        await result.current.executeArbitrage(mockArbitrageParams)
      })

      await waitFor(() => {
        expect(result.current.executionResult).toEqual(mockArbitrageResult)
        expect(mockFetch).toHaveBeenCalledTimes(2) // Simulate + Execute
      })
    })
  })

  describe('Estimación de Gas', () => {
    it('debe estimar gas correctamente', async () => {
      const gasEstimate = {
        gasLimit: '300000',
        gasPrice: '20000000000',
        totalCost: '0.006',
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(gasEstimate),
      } as any)

      const { result } = renderHook(() => useArbitrage())

      await act(async () => {
        await result.current.estimateGas(mockArbitrageParams)
      })

      await waitFor(() => {
        expect(result.current.gasEstimate).toEqual(gasEstimate)
        expect(result.current.error).toBeNull()
      })

      expect(mockFetch).toHaveBeenCalledWith('/api/arbitrage/gas-estimate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mockArbitrageParams),
      })
    })

    it('debe manejar errores de estimación de gas', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: jest.fn().mockResolvedValue({ error: 'Cannot estimate gas' }),
      } as any)

      const { result } = renderHook(() => useArbitrage())

      await act(async () => {
        await result.current.estimateGas(mockArbitrageParams)
      })

      await waitFor(() => {
        expect(result.current.gasEstimate).toBeNull()
        expect(result.current.error).toBe('Cannot estimate gas')
      })
    })
  })

  describe('Funciones de Utilidad', () => {
    it('debe resetear estado correctamente', () => {
      const { result } = renderHook(() => useArbitrage())

      // Establecer algún estado
      act(() => {
        ;(result.current as any)._setSimulationResult(mockArbitrageResult)
        ;(result.current as any)._setError('Some error')
      })

      // Resetear
      act(() => {
        result.current.reset()
      })

      expect(result.current.simulationResult).toBeNull()
      expect(result.current.executionResult).toBeNull()
      expect(result.current.error).toBeNull()
      expect(result.current.gasEstimate).toBeNull()
      expect(result.current.isSimulating).toBe(false)
      expect(result.current.isExecuting).toBe(false)
    })
  })

  describe('Casos Edge y Validación', () => {
    it('debe manejar respuesta de red inválida', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const { result } = renderHook(() => useArbitrage())

      await act(async () => {
        await result.current.simulateArbitrage(mockArbitrageParams)
      })

      await waitFor(() => {
        expect(result.current.error).toBe('Network error')
        expect(result.current.isSimulating).toBe(false)
      })
    })

    it('debe validar parámetros de arbitraje', async () => {
      const invalidParams = {
        ...mockArbitrageParams,
        amount: '', // Cantidad inválida
      }

      const { result } = renderHook(() => useArbitrage())

      await act(async () => {
        await result.current.simulateArbitrage(invalidParams)
      })

      await waitFor(() => {
        expect(result.current.error).toBe('Invalid arbitrage parameters')
        expect(mockFetch).not.toHaveBeenCalled()
      })
    })

    it('debe manejar cambios de chain durante ejecución', async () => {
      const { result } = renderHook(() => useArbitrage())

      // Simular cambio de chain durante ejecución
      let resolveExecution: (value: any) => void
      const executionPromise = new Promise((resolve) => {
        resolveExecution = resolve
      })

      mockFetch.mockReturnValueOnce(executionPromise as any)

      act(() => {
        result.current.executeArbitrage(mockArbitrageParams)
      })

      // Cambiar chainId en el wallet
      mockUseWallet.mockReturnValue({
        ...mockWalletData,
        chainId: 137, // Polygon
      })

      // Resolver la ejecución
      resolveExecution({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(mockArbitrageResult),
      })

      await waitFor(() => {
        expect(result.current.error).toBe('Chain changed during execution')
      })
    })
  })

  describe('Integración con Ethers.js', () => {
    it('debe verificar direcciones de tokens', async () => {
      const { ethers: mockEthers } = jest.requireMock('ethers')
      mockEthers.isAddress
        .mockReturnValueOnce(true)  // tokenA
        .mockReturnValueOnce(false) // tokenB - inválido

      const { result } = renderHook(() => useArbitrage())

      const invalidParams = {
        ...mockArbitrageParams,
        tokenB: {
          ...mockArbitrageParams.tokenB,
          address: 'invalid-address',
        },
      }

      await act(async () => {
        await result.current.simulateArbitrage(invalidParams)
      })

      await waitFor(() => {
        expect(result.current.error).toBe('Invalid token addresses')
        expect(mockEthers.isAddress).toHaveBeenCalledTimes(2)
      })
    })
  })
})
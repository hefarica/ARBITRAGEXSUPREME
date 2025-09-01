/**
 * @fileoverview Tests unitarios para el hook useSimulation
 * Ingenio Pichichi S.A. - ArbitrageX Supreme
 * Tests completos para funcionalidad de simulación de arbitraje
 */

import { renderHook, act, waitFor } from '@testing-library/react'
import { useSimulation } from '../useSimulation'
import { useWallet } from '../useWallet'
import type { SimulationParams, SimulationResult } from '@/types'

// Mocks
jest.mock('../useWallet')
jest.mock('next/router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    pathname: '/simulation',
  }),
}))

// Mock global fetch
global.fetch = jest.fn()

const mockUseWallet = useWallet as jest.MockedFunction<typeof useWallet>
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>

describe('useSimulation Hook', () => {
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

  const mockSimulationParams: SimulationParams = {
    strategyType: 'INTER_DEX',
    sourceChain: 'ethereum',
    targetChain: 'polygon',
    tokenPair: {
      tokenA: {
        address: '0xA0b86a33E6441cF2b6B82397548632b7F293c98',
        symbol: 'USDC',
        decimals: 6,
      },
      tokenB: {
        address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        symbol: 'DAI',
        decimals: 18,
      },
    },
    amount: '1000',
    scenarios: ['optimistic', 'realistic', 'pessimistic'],
    timeframes: [60, 300, 900], // 1min, 5min, 15min
  }

  const mockSimulationResult: SimulationResult = {
    id: 'sim-456',
    timestamp: Date.now(),
    success: true,
    scenarios: {
      optimistic: {
        profit: '125.50',
        roi: 12.55,
        confidence: 0.85,
        gasUsed: '280000',
        priceImpact: 0.08,
      },
      realistic: {
        profit: '85.30',
        roi: 8.53,
        confidence: 0.92,
        gasUsed: '285000',
        priceImpact: 0.12,
      },
      pessimistic: {
        profit: '45.20',
        roi: 4.52,
        confidence: 0.98,
        gasUsed: '290000',
        priceImpact: 0.18,
      },
    },
    marketData: {
      liquidity: '2500000',
      volume24h: '15000000',
      volatility: 0.15,
      spread: 0.05,
    },
    recommendations: [
      'Consider reducing amount to minimize price impact',
      'Monitor market conditions for better timing',
    ],
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseWallet.mockReturnValue(mockWalletData)
    
    // Mock successful API responses
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(mockSimulationResult),
    } as any)
  })

  describe('Inicialización', () => {
    it('debe inicializar con estado por defecto', () => {
      const { result } = renderHook(() => useSimulation())

      expect(result.current.isRunning).toBe(false)
      expect(result.current.results).toEqual([])
      expect(result.current.currentResult).toBeNull()
      expect(result.current.error).toBeNull()
      expect(result.current.progress).toBe(0)
    })

    it('debe proporcionar funciones de simulación', () => {
      const { result } = renderHook(() => useSimulation())

      expect(typeof result.current.runSimulation).toBe('function')
      expect(typeof result.current.runBatchSimulation).toBe('function')
      expect(typeof result.current.saveResult).toBe('function')
      expect(typeof result.current.loadResults).toBe('function')
      expect(typeof result.current.clearResults).toBe('function')
    })
  })

  describe('Simulación Individual', () => {
    it('debe ejecutar simulación exitosamente', async () => {
      const { result } = renderHook(() => useSimulation())

      const simulationPromise = act(async () => {
        await result.current.runSimulation(mockSimulationParams)
      })

      // Verificar estado de carga
      expect(result.current.isRunning).toBe(true)
      expect(result.current.error).toBeNull()

      await simulationPromise

      await waitFor(() => {
        expect(result.current.isRunning).toBe(false)
        expect(result.current.currentResult).toEqual(mockSimulationResult)
        expect(result.current.results).toHaveLength(1)
        expect(result.current.results[0]).toEqual(mockSimulationResult)
        expect(result.current.error).toBeNull()
      })

      // Verificar llamada a API
      expect(mockFetch).toHaveBeenCalledWith('/api/simulation/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(mockSimulationParams),
      })
    })

    it('debe actualizar progreso durante simulación', async () => {
      let progressCallback: ((progress: number) => void) | undefined

      // Mock fetch con progreso simulado
      mockFetch.mockImplementationOnce(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            // Simular actualizaciones de progreso
            if (progressCallback) {
              progressCallback(25)
              setTimeout(() => progressCallback!(50), 100)
              setTimeout(() => progressCallback!(75), 200)
              setTimeout(() => progressCallback!(100), 300)
            }
            resolve({
              ok: true,
              status: 200,
              json: jest.fn().mockResolvedValue(mockSimulationResult),
            } as any)
          }, 400)
        })
      })

      const { result } = renderHook(() => useSimulation())

      // Capturar callback de progreso
      const originalRunSimulation = result.current.runSimulation
      jest.spyOn(result.current, 'runSimulation').mockImplementation((params, onProgress) => {
        progressCallback = onProgress
        return originalRunSimulation(params, onProgress)
      })

      await act(async () => {
        await result.current.runSimulation(mockSimulationParams, (progress) => {
          // El progreso debe estar entre 0 y 100
          expect(progress).toBeGreaterThanOrEqual(0)
          expect(progress).toBeLessThanOrEqual(100)
        })
      })

      await waitFor(() => {
        expect(result.current.progress).toBe(100)
      })
    })

    it('debe manejar errores de simulación', async () => {
      const errorMessage = 'Simulation failed'
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: jest.fn().mockResolvedValue({ error: errorMessage }),
      } as any)

      const { result } = renderHook(() => useSimulation())

      await act(async () => {
        await result.current.runSimulation(mockSimulationParams)
      })

      await waitFor(() => {
        expect(result.current.isRunning).toBe(false)
        expect(result.current.currentResult).toBeNull()
        expect(result.current.error).toBe(errorMessage)
        expect(result.current.results).toHaveLength(0)
      })
    })
  })

  describe('Simulación por Lotes', () => {
    it('debe ejecutar múltiples simulaciones', async () => {
      const batchParams = [
        mockSimulationParams,
        { ...mockSimulationParams, amount: '2000' },
        { ...mockSimulationParams, amount: '3000' },
      ]

      const batchResults = batchParams.map((_, index) => ({
        ...mockSimulationResult,
        id: `sim-${index + 1}`,
      }))

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue(batchResults[0]),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue(batchResults[1]),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue(batchResults[2]),
        } as any)

      const { result } = renderHook(() => useSimulation())

      await act(async () => {
        await result.current.runBatchSimulation(batchParams)
      })

      await waitFor(() => {
        expect(result.current.isRunning).toBe(false)
        expect(result.current.results).toHaveLength(3)
        expect(result.current.error).toBeNull()
      })

      expect(mockFetch).toHaveBeenCalledTimes(3)
    })

    it('debe manejar errores parciales en simulación por lotes', async () => {
      const batchParams = [
        mockSimulationParams,
        { ...mockSimulationParams, amount: '2000' },
      ]

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: jest.fn().mockResolvedValue(mockSimulationResult),
        } as any)
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: jest.fn().mockResolvedValue({ error: 'Second simulation failed' }),
        } as any)

      const { result } = renderHook(() => useSimulation())

      await act(async () => {
        await result.current.runBatchSimulation(batchParams)
      })

      await waitFor(() => {
        expect(result.current.results).toHaveLength(1) // Solo uno exitoso
        expect(result.current.error).toBe('Some simulations failed')
      })
    })
  })

  describe('Persistencia de Resultados', () => {
    it('debe guardar resultado correctamente', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: jest.fn().mockResolvedValue({ success: true, id: 'saved-123' }),
      } as any)

      const { result } = renderHook(() => useSimulation())

      // Primero establecer un resultado actual
      act(() => {
        ;(result.current as any)._setCurrentResult(mockSimulationResult)
      })

      await act(async () => {
        await result.current.saveResult('Test Simulation')
      })

      expect(mockFetch).toHaveBeenCalledWith('/api/simulation/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Test Simulation',
          result: mockSimulationResult,
          userId: mockWalletData.account,
        }),
      })
    })

    it('debe cargar resultados guardados', async () => {
      const savedResults = [mockSimulationResult]
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue(savedResults),
      } as any)

      const { result } = renderHook(() => useSimulation())

      await act(async () => {
        await result.current.loadResults()
      })

      await waitFor(() => {
        expect(result.current.results).toEqual(savedResults)
      })

      expect(mockFetch).toHaveBeenCalledWith(
        `/api/simulation/load?userId=${mockWalletData.account}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )
    })

    it('debe limpiar resultados localmente', () => {
      const { result } = renderHook(() => useSimulation())

      // Establecer algunos resultados
      act(() => {
        ;(result.current as any)._setResults([mockSimulationResult])
        ;(result.current as any)._setCurrentResult(mockSimulationResult)
      })

      // Limpiar
      act(() => {
        result.current.clearResults()
      })

      expect(result.current.results).toEqual([])
      expect(result.current.currentResult).toBeNull()
    })
  })

  describe('Validación y Casos Edge', () => {
    it('debe validar wallet conectado', async () => {
      mockUseWallet.mockReturnValue({
        ...mockWalletData,
        isConnected: false,
      })

      const { result } = renderHook(() => useSimulation())

      await act(async () => {
        await result.current.runSimulation(mockSimulationParams)
      })

      await waitFor(() => {
        expect(result.current.error).toBe('Wallet not connected')
        expect(mockFetch).not.toHaveBeenCalled()
      })
    })

    it('debe validar parámetros de simulación', async () => {
      const invalidParams = {
        ...mockSimulationParams,
        amount: '', // Cantidad inválida
      }

      const { result } = renderHook(() => useSimulation())

      await act(async () => {
        await result.current.runSimulation(invalidParams)
      })

      await waitFor(() => {
        expect(result.current.error).toBe('Invalid simulation parameters')
        expect(mockFetch).not.toHaveBeenCalled()
      })
    })

    it('debe manejar errores de red', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const { result } = renderHook(() => useSimulation())

      await act(async () => {
        await result.current.runSimulation(mockSimulationParams)
      })

      await waitFor(() => {
        expect(result.current.error).toBe('Network error')
        expect(result.current.isRunning).toBe(false)
      })
    })

    it('debe cancelar simulación en progreso', async () => {
      let rejectSimulation: (reason?: any) => void
      const simulationPromise = new Promise((_, reject) => {
        rejectSimulation = reject
      })

      mockFetch.mockReturnValueOnce(simulationPromise as any)

      const { result } = renderHook(() => useSimulation())

      // Iniciar simulación
      act(() => {
        result.current.runSimulation(mockSimulationParams)
      })

      expect(result.current.isRunning).toBe(true)

      // Cancelar simulación
      act(() => {
        ;(result.current as any).cancelSimulation()
      })

      // Simular rechazo de la promesa
      rejectSimulation(new Error('Simulation cancelled'))

      await waitFor(() => {
        expect(result.current.isRunning).toBe(false)
        expect(result.current.error).toBe('Simulation cancelled')
      })
    })
  })

  describe('Análisis de Resultados', () => {
    it('debe calcular estadísticas de resultados múltiples', () => {
      const multipleResults = [
        { ...mockSimulationResult, scenarios: { ...mockSimulationResult.scenarios, realistic: { ...mockSimulationResult.scenarios.realistic, profit: '100', roi: 10 } } },
        { ...mockSimulationResult, scenarios: { ...mockSimulationResult.scenarios, realistic: { ...mockSimulationResult.scenarios.realistic, profit: '200', roi: 20 } } },
        { ...mockSimulationResult, scenarios: { ...mockSimulationResult.scenarios, realistic: { ...mockSimulationResult.scenarios.realistic, profit: '150', roi: 15 } } },
      ]

      const { result } = renderHook(() => useSimulation())

      act(() => {
        ;(result.current as any)._setResults(multipleResults)
      })

      const stats = result.current.getStatistics()

      expect(stats).toEqual({
        totalSimulations: 3,
        averageROI: 15,
        bestROI: 20,
        worstROI: 10,
        totalProfit: '450',
        successRate: 1.0,
      })
    })

    it('debe comparar simulaciones', () => {
      const { result } = renderHook(() => useSimulation())

      const comparison = result.current.compareResults([
        mockSimulationResult,
        { ...mockSimulationResult, id: 'sim-2' },
      ])

      expect(comparison).toHaveProperty('profits')
      expect(comparison).toHaveProperty('rois')
      expect(comparison).toHaveProperty('risks')
      expect(comparison).toHaveProperty('recommendations')
    })
  })

  describe('Integración con LocalStorage', () => {
    beforeEach(() => {
      // Mock localStorage
      const localStorageMock = {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
      }
      Object.defineProperty(window, 'localStorage', {
        value: localStorageMock,
      })
    })

    it('debe guardar y cargar desde localStorage', () => {
      const { result } = renderHook(() => useSimulation())

      // Guardar resultados
      act(() => {
        ;(result.current as any)._setResults([mockSimulationResult])
        ;(result.current as any).saveToLocalStorage()
      })

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'arbitrageX-simulations',
        JSON.stringify([mockSimulationResult])
      )

      // Cargar resultados
      ;(localStorage.getItem as jest.Mock).mockReturnValue(
        JSON.stringify([mockSimulationResult])
      )

      act(() => {
        ;(result.current as any).loadFromLocalStorage()
      })

      expect(result.current.results).toEqual([mockSimulationResult])
    })
  })
})
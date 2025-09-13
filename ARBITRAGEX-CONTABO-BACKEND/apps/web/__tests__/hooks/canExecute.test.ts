/**
 * Tests unitarios para la función canExecute
 * 
 * Prueba distintos casos:
 * - Oportunidad completa y válida
 * - Oportunidades incompletas (faltan campos)
 * - Oportunidades inválidas (datos erróneos)
 * - Validaciones de wallet y conexión
 */

import { renderHook, act } from '@testing-library/react'
import { useArbitrageExecution } from '@/hooks/useArbitrageExecution'
import type { ArbitrageOpportunity } from '@/types/arbitrage'

// Mock del hook useMetaMask
jest.mock('@/hooks/useMetaMask', () => ({
  useMetaMask: jest.fn(() => ({
    isConnected: true,
    accounts: ['0x1234567890abcdef'],
    chainId: 1,
    address: '0x1234567890abcdef'
  }))
}))

// Mock del servicio web3ArbitrageService
jest.mock('@/services/web3ArbitrageService', () => ({
  web3ArbitrageService: {
    execute: jest.fn(),
    estimateGas: jest.fn()
  }
}))

describe('canExecute Function', () => {
  // Datos de prueba
  const validOpportunity: ArbitrageOpportunity = {
    id: 'test-1',
    type: 'Inter-DEX',
    description: 'Test arbitrage opportunity',
    profitUSD: 100,
    path: ['0xToken1', '0xToken2'],
    protocols: [
      { id: 'uniswap', name: 'Uniswap V2' },
      { id: 'sushiswap', name: 'SushiSwap' }
    ],
    chainId: 1,
    tokensInvolved: ['0xToken1', '0xToken2'],
    timestamp: Date.now(),
    amount: '1000'
  }

  const incompleteOpportunity: Partial<ArbitrageOpportunity> = {
    id: 'test-2',
    type: 'Inter-DEX',
    // Falta description
    profitUSD: 50,
    path: ['0xToken1'],
    // Faltan protocols
    chainId: 1
  }

  const invalidOpportunity: Partial<ArbitrageOpportunity> = {
    id: 'test-3',
    description: '', // Descripción vacía
    path: [], // Path vacío
    protocols: [], // Protocols vacío
    chainId: 0, // ChainId inválido
    // Sin amount ni profitUSD
  }

  let mockUseMetaMask: jest.MockedFunction<any>

  beforeEach(() => {
    mockUseMetaMask = require('@/hooks/useMetaMask').useMetaMask
    jest.clearAllMocks()
  })

  describe('Casos exitosos', () => {
    it('debe permitir ejecutar una oportunidad completa y válida', () => {
      const { result } = renderHook(() => useArbitrageExecution())
      
      act(() => {
        const validation = result.current.canExecute(validOpportunity)
        
        expect(validation.canExecute).toBe(true)
        expect(validation.reason).toBeUndefined()
      })
    })

    it('debe permitir ejecutar con profitUSD en lugar de amount', () => {
      const { result } = renderHook(() => useArbitrageExecution())
      
      const oppWithProfitUSD = { ...validOpportunity }
      delete oppWithProfitUSD.amount
      
      act(() => {
        const validation = result.current.canExecute(oppWithProfitUSD)
        
        expect(validation.canExecute).toBe(true)
        expect(validation.reason).toBeUndefined()
      })
    })
  })

  describe('Casos de fallo - Campos faltantes', () => {
    it('debe fallar si falta la descripción', () => {
      const { result } = renderHook(() => useArbitrageExecution())
      
      act(() => {
        const validation = result.current.canExecute(incompleteOpportunity)
        
        expect(validation.canExecute).toBe(false)
        expect(validation.reason).toContain('Falta descripción')
      })
    })

    it('debe fallar si el path está vacío', () => {
      const { result } = renderHook(() => useArbitrageExecution())
      
      const oppWithEmptyPath = {
        ...validOpportunity,
        path: []
      }
      
      act(() => {
        const validation = result.current.canExecute(oppWithEmptyPath)
        
        expect(validation.canExecute).toBe(false)
        expect(validation.reason).toContain('Ruta de ejecución inválida')
      })
    })

    it('debe fallar si faltan protocols', () => {
      const { result } = renderHook(() => useArbitrageExecution())
      
      const oppWithoutProtocols = {
        ...validOpportunity,
        protocols: []
      }
      
      act(() => {
        const validation = result.current.canExecute(oppWithoutProtocols)
        
        expect(validation.canExecute).toBe(false)
        expect(validation.reason).toContain('Protocolos no definidos')
      })
    })

    it('debe fallar si chainId es inválido', () => {
      const { result } = renderHook(() => useArbitrageExecution())
      
      const oppWithInvalidChainId = {
        ...validOpportunity,
        chainId: 0
      }
      
      act(() => {
        const validation = result.current.canExecute(oppWithInvalidChainId)
        
        expect(validation.canExecute).toBe(false)
        expect(validation.reason).toContain('ChainId no válido')
      })
    })

    it('debe fallar si no hay amount ni profitUSD', () => {
      const { result } = renderHook(() => useArbitrageExecution())
      
      const oppWithoutAmount = { ...validOpportunity }
      delete oppWithoutAmount.amount
      delete oppWithoutAmount.profitUSD
      
      act(() => {
        const validation = result.current.canExecute(oppWithoutAmount)
        
        expect(validation.canExecute).toBe(false)
        expect(validation.reason).toContain('Monto o profit no definido')
      })
    })
  })

  describe('Casos de fallo - Wallet desconectado', () => {
    beforeEach(() => {
      mockUseMetaMask.mockReturnValue({
        isConnected: false,
        accounts: [],
        chainId: null,
        address: null
      })
    })

    it('debe fallar si wallet no está conectado', () => {
      const { result } = renderHook(() => useArbitrageExecution())
      
      act(() => {
        const validation = result.current.canExecute(validOpportunity)
        
        expect(validation.canExecute).toBe(false)
        expect(validation.reason).toContain('Wallet no conectado')
      })
    })
  })

  describe('Casos de fallo - Sin cuenta seleccionada', () => {
    beforeEach(() => {
      mockUseMetaMask.mockReturnValue({
        isConnected: true,
        accounts: [], // Sin cuentas
        chainId: 1,
        address: null
      })
    })

    it('debe fallar si no hay cuenta seleccionada', () => {
      const { result } = renderHook(() => useArbitrageExecution())
      
      act(() => {
        const validation = result.current.canExecute(validOpportunity)
        
        expect(validation.canExecute).toBe(false)
        expect(validation.reason).toContain('No hay cuenta seleccionada')
      })
    })
  })

  describe('Casos de fallo - Red no detectada', () => {
    beforeEach(() => {
      mockUseMetaMask.mockReturnValue({
        isConnected: true,
        accounts: ['0x1234567890abcdef'],
        chainId: null, // Sin red
        address: '0x1234567890abcdef'
      })
    })

    it('debe fallar si no se detecta la red', () => {
      const { result } = renderHook(() => useArbitrageExecution())
      
      act(() => {
        const validation = result.current.canExecute(validOpportunity)
        
        expect(validation.canExecute).toBe(false)
        expect(validation.reason).toContain('Red no detectada')
      })
    })
  })

  describe('Casos de fallo - Oportunidad expirada', () => {
    it('debe fallar si la oportunidad está expirada', () => {
      const { result } = renderHook(() => useArbitrageExecution())
      
      const expiredOpportunity = {
        ...validOpportunity,
        expiresAt: new Date(Date.now() - 60000) // Expiró hace 1 minuto
      }
      
      act(() => {
        const validation = result.current.canExecute(expiredOpportunity)
        
        expect(validation.canExecute).toBe(false)
        expect(validation.reason).toContain('Oportunidad expirada')
      })
    })

    it('debe permitir ejecutar si la oportunidad no está expirada', () => {
      const { result } = renderHook(() => useArbitrageExecution())
      
      const futureOpportunity = {
        ...validOpportunity,
        expiresAt: new Date(Date.now() + 60000) // Expira en 1 minuto
      }
      
      act(() => {
        const validation = result.current.canExecute(futureOpportunity)
        
        expect(validation.canExecute).toBe(true)
        expect(validation.reason).toBeUndefined()
      })
    })
  })

  describe('Casos extremos', () => {
    it('debe manejar objeto completamente vacío', () => {
      const { result } = renderHook(() => useArbitrageExecution())
      
      act(() => {
        const validation = result.current.canExecute({})
        
        expect(validation.canExecute).toBe(false)
        expect(validation.reason).toContain('Falta descripción')
      })
    })

    it('debe manejar null y undefined', () => {
      const { result } = renderHook(() => useArbitrageExecution())
      
      act(() => {
        const validationNull = result.current.canExecute(null as any)
        const validationUndefined = result.current.canExecute(undefined as any)
        
        expect(validationNull.canExecute).toBe(false)
        expect(validationUndefined.canExecute).toBe(false)
      })
    })
  })
})
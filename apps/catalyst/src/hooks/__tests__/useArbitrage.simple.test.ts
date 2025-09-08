/**
 * @fileoverview Tests unitarios simplificados para useArbitrage
 * Ingenio Pichichi S.A. - ArbitrageX Supreme
 */

import { renderHook, act } from '@testing-library/react'

// Mock del hook useWallet
const mockUseWallet = {
  isConnected: true,
  chainId: 1,
  account: '0x123...',
}

jest.mock('../useWallet', () => ({
  useWallet: () => mockUseWallet,
}))

// Mock global fetch
global.fetch = jest.fn()

describe('useArbitrage Hook (Simplified)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, profit: '10.0' }),
    })
  })

  it('debe tener la estructura correcta del hook', () => {
    // Import dinámico para evitar problemas de inicialización
    const { useArbitrage } = require('../useArbitrage')
    const { result } = renderHook(() => useArbitrage())

    expect(result.current).toEqual({
      isSimulating: false,
      isExecuting: false,
      simulationResult: null,
      executionResult: null,
      error: null,
      gasEstimate: null,
      simulateArbitrage: expect.any(Function),
      executeArbitrage: expect.any(Function),
      estimateGas: expect.any(Function),
      reset: expect.any(Function),
    })
  })

  it('debe resetear el estado correctamente', () => {
    const { useArbitrage } = require('../useArbitrage')
    const { result } = renderHook(() => useArbitrage())

    act(() => {
      result.current.reset()
    })

    expect(result.current.error).toBeNull()
    expect(result.current.simulationResult).toBeNull()
  })
})
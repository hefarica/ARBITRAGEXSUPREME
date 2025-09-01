/**
 * @fileoverview Tests unitarios simplificados para ArbitrageForm
 * Ingenio Pichichi S.A. - ArbitrageX Supreme
 */

import { render, screen } from '@testing-library/react'
import ArbitrageForm from '../forms/ArbitrageForm'

// Mocks básicos
jest.mock('../../hooks/useWallet', () => ({
  useWallet: () => ({
    isConnected: false,
    connect: jest.fn(),
    account: null,
  }),
}))

jest.mock('../../hooks/useArbitrage', () => ({
  useArbitrage: () => ({
    isSimulating: false,
    simulationResult: null,
    simulateArbitrage: jest.fn(),
    executeArbitrage: jest.fn(),
    error: null,
    reset: jest.fn(),
  }),
}))

describe('ArbitrageForm (Simplified)', () => {
  it('debe renderizar el formulario correctamente', () => {
    render(<ArbitrageForm />)
    
    // Verificar que se renderiza sin errores
    expect(screen.getByRole('button', { name: /connect wallet/i })).toBeInTheDocument()
  })

  it('debe mostrar mensaje de wallet desconectado', () => {
    render(<ArbitrageForm />)
    
    expect(screen.getByText(/connect your wallet/i)).toBeInTheDocument()
  })
})
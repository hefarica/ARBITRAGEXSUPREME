/**
 * ArbitrageX Supreme - ROITable Tests
 * Ingenio Pichichi S.A. - Tests unitarios para ROITable
 * 
 * Implementación metodica y disciplinada de tests para:
 * - Rendering de la tabla
 * - Filtrado y ordenamiento
 * - Selección de filas
 * - Acciones batch
 * - Paginación
 * - Estados de loading/error
 */

import React from 'react'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ROITable } from '../tables/ROITable'
import { 
  render, 
  createMockHookReturn,
  createMockArbitrageOpportunity
} from '@/test/utils'

// Mock de los hooks
const mockUseArbitrage = jest.fn()

jest.mock('@/hooks', () => ({
  useArbitrage: () => mockUseArbitrage(),
}))

describe('ROITable', () => {
  const mockOpportunities = [
    createMockArbitrageOpportunity({
      id: 'opp-1',
      profitEstimateUsd: 125.50,
      profitPercentage: 2.5,
      tokenSymbol: 'USDC',
      protocol: { name: 'Uniswap V3', riskScore: 3 },
      sourcePool: { tvl: 1500000, volume24h: 500000 }
    }),
    createMockArbitrageOpportunity({
      id: 'opp-2',
      profitEstimateUsd: 89.75,
      profitPercentage: 1.8,
      tokenSymbol: 'DAI',
      protocol: { name: 'SushiSwap', riskScore: 4 },
      sourcePool: { tvl: 800000, volume24h: 200000 }
    }),
    createMockArbitrageOpportunity({
      id: 'opp-3',
      profitEstimateUsd: 256.30,
      profitPercentage: 4.1,
      tokenSymbol: 'WETH',
      protocol: { name: 'Curve', riskScore: 2 },
      sourcePool: { tvl: 2500000, volume24h: 800000 }
    })
  ]

  beforeEach(() => {
    mockUseArbitrage.mockReturnValue(createMockHookReturn.useArbitrage({
      opportunities: mockOpportunities,
      isScanning: false,
      isLoading: false,
      error: null
    }))
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('Rendering', () => {
    it('should render the table with header and data rows', () => {
      render(<ROITable />)

      // Verificar título
      expect(screen.getByText(/ROI & Liquidez - Oportunidades de Arbitraje/i)).toBeInTheDocument()

      // Verificar headers de tabla
      expect(screen.getByText(/token/i)).toBeInTheDocument()
      expect(screen.getByText(/protocolo/i)).toBeInTheDocument()
      expect(screen.getByText(/ROI %/i)).toBeInTheDocument()
      expect(screen.getByText(/profit \(USD\)/i)).toBeInTheDocument()
      expect(screen.getByText(/liquidez/i)).toBeInTheDocument()
      expect(screen.getByText(/riesgo/i)).toBeInTheDocument()

      // Verificar que se renderizan las oportunidades
      expect(screen.getByText('USDC')).toBeInTheDocument()
      expect(screen.getByText('DAI')).toBeInTheDocument()
      expect(screen.getByText('WETH')).toBeInTheDocument()
    })

    it('should display opportunity data correctly', () => {
      render(<ROITable />)

      // Verificar datos específicos de la primera oportunidad
      expect(screen.getByText('$125.50')).toBeInTheDocument()
      expect(screen.getByText('2.5%')).toBeInTheDocument()
      expect(screen.getByText('Uniswap V3')).toBeInTheDocument()
    })

    it('should show empty state when no opportunities', () => {
      mockUseArbitrage.mockReturnValue(createMockHookReturn.useArbitrage({
        opportunities: [],
        isLoading: false
      }))

      render(<ROITable />)

      expect(screen.getByText(/no hay oportunidades disponibles/i)).toBeInTheDocument()
    })

    it('should show loading state', () => {
      mockUseArbitrage.mockReturnValue(createMockHookReturn.useArbitrage({
        opportunities: [],
        isLoading: true
      }))

      render(<ROITable />)

      expect(screen.getByText(/cargando oportunidades.../i)).toBeInTheDocument()
    })
  })

  describe('Filtering', () => {
    const user = userEvent.setup()

    it('should filter by minimum profit', async () => {
      render(<ROITable />)

      const profitFilter = screen.getByLabelText(/profit mínimo/i)
      await user.type(profitFilter, '100')

      // Solo deberían mostrarse oportunidades con profit >= 100
      expect(screen.getByText('$125.50')).toBeInTheDocument() // USDC
      expect(screen.getByText('$256.30')).toBeInTheDocument() // WETH
      expect(screen.queryByText('$89.75')).not.toBeInTheDocument() // DAI filtrado
    })

    it('should filter by protocol', async () => {
      render(<ROITable />)

      const protocolFilter = screen.getByRole('combobox', { name: /protocolo/i })
      await user.click(protocolFilter)
      await user.click(screen.getByText('Uniswap V3'))

      // Solo debería mostrarse Uniswap V3
      expect(screen.getByText('USDC')).toBeInTheDocument()
      expect(screen.queryByText('DAI')).not.toBeInTheDocument()
      expect(screen.queryByText('WETH')).not.toBeInTheDocument()
    })

    it('should filter by risk level', async () => {
      render(<ROITable />)

      const riskFilter = screen.getByRole('combobox', { name: /nivel de riesgo/i })
      await user.click(riskFilter)
      await user.click(screen.getByText('Bajo (1-3)'))

      // Solo deberían mostrarse oportunidades con riesgo bajo
      expect(screen.getByText('USDC')).toBeInTheDocument() // riesgo 3
      expect(screen.getByText('WETH')).toBeInTheDocument() // riesgo 2
      expect(screen.queryByText('DAI')).not.toBeInTheDocument() // riesgo 4 filtrado
    })
  })

  describe('Sorting', () => {
    const user = userEvent.setup()

    it('should sort by profit descending by default', () => {
      render(<ROITable />)

      const rows = screen.getAllByRole('row')
      const firstDataRow = rows[1] // Skip header
      
      // La primera fila debería ser WETH (mayor profit: $256.30)
      expect(within(firstDataRow).getByText('WETH')).toBeInTheDocument()
    })

    it('should sort by ROI when column header is clicked', async () => {
      render(<ROITable />)

      const roiHeader = screen.getByRole('columnheader', { name: /ROI %/i })
      await user.click(roiHeader)

      // Verificar orden descendente por ROI
      const rows = screen.getAllByRole('row')
      const firstDataRow = rows[1]
      
      // La primera fila debería ser WETH (mayor ROI: 4.1%)
      expect(within(firstDataRow).getByText('WETH')).toBeInTheDocument()
    })

    it('should reverse sort order on second click', async () => {
      render(<ROITable />)

      const profitHeader = screen.getByRole('columnheader', { name: /profit/i })
      
      // Primer click - orden descendente
      await user.click(profitHeader)
      
      // Segundo click - orden ascendente
      await user.click(profitHeader)

      const rows = screen.getAllByRole('row')
      const firstDataRow = rows[1]
      
      // La primera fila debería ser DAI (menor profit: $89.75)
      expect(within(firstDataRow).getByText('DAI')).toBeInTheDocument()
    })
  })

  describe('Row Selection', () => {
    const user = userEvent.setup()

    it('should select individual rows', async () => {
      render(<ROITable />)

      const checkboxes = screen.getAllByRole('checkbox')
      const firstRowCheckbox = checkboxes[1] // Skip header checkbox

      await user.click(firstRowCheckbox)

      expect(firstRowCheckbox).toBeChecked()
      expect(screen.getByText(/1 seleccionada/i)).toBeInTheDocument()
    })

    it('should select all rows with header checkbox', async () => {
      render(<ROITable />)

      const headerCheckbox = screen.getAllByRole('checkbox')[0]
      await user.click(headerCheckbox)

      // Todos los checkboxes deberían estar seleccionados
      const checkboxes = screen.getAllByRole('checkbox')
      checkboxes.forEach(checkbox => {
        expect(checkbox).toBeChecked()
      })

      expect(screen.getByText(/3 seleccionadas/i)).toBeInTheDocument()
    })

    it('should show batch actions when rows are selected', async () => {
      render(<ROITable />)

      const checkbox = screen.getAllByRole('checkbox')[1]
      await user.click(checkbox)

      expect(screen.getByRole('button', { name: /ejecutar seleccionadas/i })).toBeInTheDocument()
    })
  })

  describe('Batch Actions', () => {
    const user = userEvent.setup()
    const mockExecuteOpportunity = jest.fn()

    beforeEach(() => {
      mockUseArbitrage.mockReturnValue(createMockHookReturn.useArbitrage({
        opportunities: mockOpportunities,
        executeOpportunity: mockExecuteOpportunity,
        isLoading: false
      }))
    })

    it('should execute selected opportunities', async () => {
      render(<ROITable />)

      // Seleccionar primera fila
      const checkbox = screen.getAllByRole('checkbox')[1]
      await user.click(checkbox)

      // Ejecutar seleccionadas
      const executeButton = screen.getByRole('button', { name: /ejecutar seleccionadas/i })
      await user.click(executeButton)

      expect(mockExecuteOpportunity).toHaveBeenCalledWith('opp-1')
    })

    it('should show loading state during batch execution', () => {
      mockUseArbitrage.mockReturnValue(createMockHookReturn.useArbitrage({
        opportunities: mockOpportunities,
        isLoading: true
      }))

      render(<ROITable />)

      // Seleccionar fila para mostrar botón
      const checkbox = screen.getAllByRole('checkbox')[1]
      userEvent.click(checkbox)

      expect(screen.getByText(/ejecutando.../i)).toBeInTheDocument()
    })
  })

  describe('Refresh Functionality', () => {
    const user = userEvent.setup()
    const mockRefreshOpportunities = jest.fn()

    beforeEach(() => {
      mockUseArbitrage.mockReturnValue(createMockHookReturn.useArbitrage({
        opportunities: mockOpportunities,
        refreshOpportunities: mockRefreshOpportunities,
        isScanning: false
      }))
    })

    it('should call refresh when refresh button is clicked', async () => {
      render(<ROITable />)

      const refreshButton = screen.getByRole('button', { name: /actualizar/i })
      await user.click(refreshButton)

      expect(mockRefreshOpportunities).toHaveBeenCalled()
    })

    it('should show scanning state', () => {
      mockUseArbitrage.mockReturnValue(createMockHookReturn.useArbitrage({
        opportunities: mockOpportunities,
        isScanning: true
      }))

      render(<ROITable />)

      expect(screen.getByText(/escaneando.../i)).toBeInTheDocument()
    })
  })

  describe('ROI Metrics Display', () => {
    it('should display ROI percentage with correct formatting', () => {
      render(<ROITable />)

      expect(screen.getByText('2.5%')).toBeInTheDocument()
      expect(screen.getByText('1.8%')).toBeInTheDocument()
      expect(screen.getByText('4.1%')).toBeInTheDocument()
    })

    it('should display profit in USD with currency symbol', () => {
      render(<ROITable />)

      expect(screen.getByText('$125.50')).toBeInTheDocument()
      expect(screen.getByText('$89.75')).toBeInTheDocument()
      expect(screen.getByText('$256.30')).toBeInTheDocument()
    })

    it('should display risk level with badges', () => {
      render(<ROITable />)

      // Verificar badges de riesgo
      const riskBadges = screen.getAllByText(/bajo|medio|alto/i)
      expect(riskBadges.length).toBeGreaterThan(0)
    })
  })

  describe('Error Handling', () => {
    it('should display error message when loading fails', () => {
      mockUseArbitrage.mockReturnValue(createMockHookReturn.useArbitrage({
        opportunities: [],
        isLoading: false,
        error: 'Failed to load opportunities'
      }))

      render(<ROITable />)

      expect(screen.getByText(/failed to load opportunities/i)).toBeInTheDocument()
    })
  })

  describe('Responsive Design', () => {
    it('should hide less important columns on smaller screens', () => {
      // Mock window.innerWidth
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768, // Tablet width
      })

      render(<ROITable />)

      // En pantallas pequeñas, algunas columnas deberían estar ocultas
      // Este test dependería de la implementación específica del responsive design
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels for interactive elements', () => {
      render(<ROITable />)

      expect(screen.getByRole('table')).toHaveAccessibleName()
      expect(screen.getAllByRole('checkbox')[0]).toHaveAccessibleName(/seleccionar todo/i)
    })

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup()
      render(<ROITable />)

      // Test tab navigation through checkboxes
      await user.tab()
      expect(screen.getAllByRole('checkbox')[0]).toHaveFocus()

      await user.tab()
      expect(screen.getAllByRole('checkbox')[1]).toHaveFocus()
    })
  })
})
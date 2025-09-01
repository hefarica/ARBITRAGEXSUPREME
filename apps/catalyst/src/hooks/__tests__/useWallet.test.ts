/**
 * ArbitrageX Supreme - useWallet Hook Tests
 * Ingenio Pichichi S.A. - Tests unitarios para useWallet
 * 
 * Implementación metodica y disciplinada de tests para:
 * - Conexión de wallet
 * - Cambio de chain
 * - Firma de mensajes
 * - Firma EIP-712
 * - Estados de error
 * - Desconexión
 */

import { renderHook, act, waitFor } from '@testing-library/react'
import { useWallet } from '../useWallet'

// Mock de window.ethereum
const mockEthereum = {
  isMetaMask: true,
  request: jest.fn(),
  on: jest.fn(),
  removeListener: jest.fn(),
  selectedAddress: null,
  chainId: null,
}

// Setup window.ethereum mock
Object.defineProperty(window, 'ethereum', {
  value: mockEthereum,
  writable: true,
})

describe('useWallet', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockEthereum.selectedAddress = null
    mockEthereum.chainId = null
  })

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useWallet())

      expect(result.current.address).toBeNull()
      expect(result.current.chainId).toBeNull()
      expect(result.current.isConnected).toBe(false)
      expect(result.current.isConnecting).toBe(false)
      expect(result.current.isError).toBe(false)
      expect(result.current.error).toBeNull()
    })

    it('should detect existing connection on mount', async () => {
      mockEthereum.selectedAddress = '0x123456789'
      mockEthereum.chainId = '0x1'
      mockEthereum.request
        .mockResolvedValueOnce(['0x123456789']) // eth_accounts
        .mockResolvedValueOnce('0x1') // eth_chainId

      const { result } = renderHook(() => useWallet())

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })

      expect(result.current.address).toBe('0x123456789')
      expect(result.current.chainId).toBe(1)
    })
  })

  describe('Connection', () => {
    it('should connect wallet successfully', async () => {
      mockEthereum.request
        .mockResolvedValueOnce(['0x123456789']) // eth_requestAccounts
        .mockResolvedValueOnce('0x1') // eth_chainId

      const { result } = renderHook(() => useWallet())

      act(() => {
        result.current.connect()
      })

      expect(result.current.isConnecting).toBe(true)

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })

      expect(result.current.address).toBe('0x123456789')
      expect(result.current.chainId).toBe(1)
      expect(result.current.isConnecting).toBe(false)
      expect(mockEthereum.request).toHaveBeenCalledWith({
        method: 'eth_requestAccounts'
      })
    })

    it('should handle connection rejection', async () => {
      const rejectionError = new Error('User rejected the request')
      mockEthereum.request.mockRejectedValueOnce(rejectionError)

      const { result } = renderHook(() => useWallet())

      act(() => {
        result.current.connect()
      })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toBe(rejectionError)
      expect(result.current.isConnected).toBe(false)
      expect(result.current.isConnecting).toBe(false)
    })

    it('should handle no ethereum provider', () => {
      // Temporarily remove ethereum
      const originalEthereum = window.ethereum
      delete (window as any).ethereum

      const { result } = renderHook(() => useWallet())

      act(() => {
        result.current.connect()
      })

      expect(result.current.isError).toBe(true)
      expect(result.current.error?.message).toContain('MetaMask not detected')

      // Restore ethereum
      window.ethereum = originalEthereum
    })
  })

  describe('Chain Switching', () => {
    it('should switch chain successfully', async () => {
      // Setup connected wallet
      mockEthereum.selectedAddress = '0x123456789'
      mockEthereum.chainId = '0x1'
      mockEthereum.request
        .mockResolvedValueOnce(['0x123456789']) // Initial accounts check
        .mockResolvedValueOnce('0x1') // Initial chainId
        .mockResolvedValueOnce(null) // wallet_switchEthereumChain
        .mockResolvedValueOnce('0x89') // New chainId check

      const { result } = renderHook(() => useWallet())

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })

      act(() => {
        result.current.switchChain(137) // Polygon
      })

      await waitFor(() => {
        expect(result.current.chainId).toBe(137)
      })

      expect(mockEthereum.request).toHaveBeenCalledWith({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x89' }]
      })
    })

    it('should handle unsupported chain error', async () => {
      mockEthereum.selectedAddress = '0x123456789'
      mockEthereum.request
        .mockResolvedValueOnce(['0x123456789'])
        .mockResolvedValueOnce('0x1')
        .mockRejectedValueOnce({ code: 4902 }) // Unrecognized chain ID

      const { result } = renderHook(() => useWallet())

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })

      act(() => {
        result.current.switchChain(1337) // Custom chain
      })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error?.message).toContain('Chain not supported')
    })
  })

  describe('Message Signing', () => {
    it('should sign personal message', async () => {
      mockEthereum.selectedAddress = '0x123456789'
      mockEthereum.request
        .mockResolvedValueOnce(['0x123456789'])
        .mockResolvedValueOnce('0x1')
        .mockResolvedValueOnce('0xsignature123')

      const { result } = renderHook(() => useWallet())

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })

      let signature: string | undefined

      await act(async () => {
        signature = await result.current.signMessage('Hello World')
      })

      expect(signature).toBe('0xsignature123')
      expect(mockEthereum.request).toHaveBeenCalledWith({
        method: 'personal_sign',
        params: ['Hello World', '0x123456789']
      })
    })

    it('should handle signing rejection', async () => {
      mockEthereum.selectedAddress = '0x123456789'
      mockEthereum.request
        .mockResolvedValueOnce(['0x123456789'])
        .mockResolvedValueOnce('0x1')
        .mockRejectedValueOnce(new Error('User rejected signing'))

      const { result } = renderHook(() => useWallet())

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })

      await expect(
        act(async () => {
          await result.current.signMessage('Hello World')
        })
      ).rejects.toThrow('User rejected signing')
    })
  })

  describe('EIP-712 Signing', () => {
    const typedData = {
      domain: {
        name: 'ArbitrageX',
        version: '1',
        chainId: 1,
        verifyingContract: '0x0000000000000000000000000000000000000000'
      },
      types: {
        TestMessage: [
          { name: 'message', type: 'string' },
          { name: 'value', type: 'uint256' }
        ]
      },
      value: {
        message: 'Hello',
        value: 42
      }
    }

    it('should sign typed data', async () => {
      mockEthereum.selectedAddress = '0x123456789'
      mockEthereum.request
        .mockResolvedValueOnce(['0x123456789'])
        .mockResolvedValueOnce('0x1')
        .mockResolvedValueOnce('0xeip712signature')

      const { result } = renderHook(() => useWallet())

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })

      let signature: string | undefined

      await act(async () => {
        signature = await result.current.signTypedData(typedData)
      })

      expect(signature).toBe('0xeip712signature')
      expect(mockEthereum.request).toHaveBeenCalledWith({
        method: 'eth_signTypedData_v4',
        params: ['0x123456789', JSON.stringify(typedData)]
      })
    })
  })

  describe('Disconnection', () => {
    it('should disconnect wallet', async () => {
      mockEthereum.selectedAddress = '0x123456789'
      mockEthereum.request
        .mockResolvedValueOnce(['0x123456789'])
        .mockResolvedValueOnce('0x1')

      const { result } = renderHook(() => useWallet())

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })

      act(() => {
        result.current.disconnect()
      })

      expect(result.current.isConnected).toBe(false)
      expect(result.current.address).toBeNull()
      expect(result.current.chainId).toBeNull()
    })
  })

  describe('Event Listeners', () => {
    it('should set up ethereum event listeners on mount', () => {
      renderHook(() => useWallet())

      expect(mockEthereum.on).toHaveBeenCalledWith('accountsChanged', expect.any(Function))
      expect(mockEthereum.on).toHaveBeenCalledWith('chainChanged', expect.any(Function))
      expect(mockEthereum.on).toHaveBeenCalledWith('disconnect', expect.any(Function))
    })

    it('should handle account change event', async () => {
      let accountsChangedHandler: Function

      mockEthereum.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'accountsChanged') {
          accountsChangedHandler = handler
        }
      })

      mockEthereum.request
        .mockResolvedValueOnce(['0x123456789'])
        .mockResolvedValueOnce('0x1')

      const { result } = renderHook(() => useWallet())

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })

      // Simulate account change
      act(() => {
        accountsChangedHandler!(['0x987654321'])
      })

      expect(result.current.address).toBe('0x987654321')
    })

    it('should handle chain change event', async () => {
      let chainChangedHandler: Function

      mockEthereum.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'chainChanged') {
          chainChangedHandler = handler
        }
      })

      mockEthereum.request
        .mockResolvedValueOnce(['0x123456789'])
        .mockResolvedValueOnce('0x1')

      const { result } = renderHook(() => useWallet())

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })

      // Simulate chain change
      act(() => {
        chainChangedHandler!('0x89') // Polygon
      })

      expect(result.current.chainId).toBe(137)
    })
  })

  describe('Error Recovery', () => {
    it('should clear errors on successful connection', async () => {
      // First, cause an error
      mockEthereum.request.mockRejectedValueOnce(new Error('Connection failed'))

      const { result } = renderHook(() => useWallet())

      act(() => {
        result.current.connect()
      })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      // Then succeed
      mockEthereum.request
        .mockResolvedValueOnce(['0x123456789'])
        .mockResolvedValueOnce('0x1')

      act(() => {
        result.current.connect()
      })

      await waitFor(() => {
        expect(result.current.isConnected).toBe(true)
      })

      expect(result.current.isError).toBe(false)
      expect(result.current.error).toBeNull()
    })
  })
})
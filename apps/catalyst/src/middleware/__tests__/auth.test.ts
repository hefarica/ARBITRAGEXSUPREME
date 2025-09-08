/**
 * @fileoverview Tests unitarios para middleware de autenticación
 * Ingenio Pichichi S.A. - ArbitrageX Supreme
 * Tests completos para sistema de autenticación multi-método
 */

import { NextRequest } from 'next/server'
import { verifyAuth, createAuthToken, validateApiKey, verifySignature } from '../auth'
import { ethers } from 'ethers'
import jwt from 'jsonwebtoken'

// Mocks
jest.mock('ethers')
jest.mock('jsonwebtoken')

const mockEthers = ethers as jest.Mocked<typeof ethers>
const mockJwt = jwt as jest.Mocked<typeof jwt>

// Mock environment
const mockEnv = {
  JWT_SECRET: 'test-jwt-secret-key-for-testing-only',
  API_KEYS: JSON.stringify([
    { key: 'test-api-key-123', permissions: ['read', 'write'], userId: 'user-1' },
    { key: 'readonly-key-456', permissions: ['read'], userId: 'user-2' },
  ]),
}

describe('Auth Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('JWT Authentication', () => {
    it('debe verificar JWT válido exitosamente', async () => {
      const mockPayload = {
        userId: 'user-123',
        address: '0x742d35Cc6634C0532925a3b8D890319d397C71eF',
        role: 'user',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      }

      mockJwt.verify.mockReturnValue(mockPayload as any)

      const req = new NextRequest('https://example.com/api/test', {
        headers: {
          'Authorization': 'Bearer valid-jwt-token'
        }
      })

      const result = await verifyAuth(req, mockEnv as any)

      expect(result.success).toBe(true)
      expect(result.user).toEqual({
        id: mockPayload.userId,
        address: mockPayload.address,
        role: mockPayload.role,
        authMethod: 'jwt',
      })
      expect(mockJwt.verify).toHaveBeenCalledWith('valid-jwt-token', mockEnv.JWT_SECRET)
    })

    it('debe rechazar JWT inválido', async () => {
      mockJwt.verify.mockImplementation(() => {
        throw new Error('Invalid token')
      })

      const req = new NextRequest('https://example.com/api/test', {
        headers: {
          'Authorization': 'Bearer invalid-jwt-token'
        }
      })

      const result = await verifyAuth(req, mockEnv as any)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid JWT token')
    })

    it('debe rechazar JWT expirado', async () => {
      mockJwt.verify.mockImplementation(() => {
        const error = new Error('jwt expired')
        ;(error as any).name = 'TokenExpiredError'
        throw error
      })

      const req = new NextRequest('https://example.com/api/test', {
        headers: {
          'Authorization': 'Bearer expired-jwt-token'
        }
      })

      const result = await verifyAuth(req, mockEnv as any)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Token expired')
    })

    it('debe crear JWT token correctamente', () => {
      const userData = {
        userId: 'user-123',
        address: '0x742d35Cc6634C0532925a3b8D890319d397C71eF',
        role: 'admin' as const,
      }

      mockJwt.sign.mockReturnValue('generated-jwt-token')

      const token = createAuthToken(userData, mockEnv.JWT_SECRET)

      expect(token).toBe('generated-jwt-token')
      expect(mockJwt.sign).toHaveBeenCalledWith(
        userData,
        mockEnv.JWT_SECRET,
        { expiresIn: '24h' }
      )
    })
  })

  describe('API Key Authentication', () => {
    it('debe validar API key correctamente', async () => {
      const req = new NextRequest('https://example.com/api/test', {
        headers: {
          'X-API-Key': 'test-api-key-123'
        }
      })

      const result = await validateApiKey(req, mockEnv as any)

      expect(result.success).toBe(true)
      expect(result.keyInfo).toEqual({
        key: 'test-api-key-123',
        permissions: ['read', 'write'],
        userId: 'user-1',
      })
    })

    it('debe rechazar API key inválida', async () => {
      const req = new NextRequest('https://example.com/api/test', {
        headers: {
          'X-API-Key': 'invalid-api-key'
        }
      })

      const result = await validateApiKey(req, mockEnv as any)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid API key')
    })

    it('debe verificar permisos de API key', async () => {
      const req = new NextRequest('https://example.com/api/test', {
        headers: {
          'X-API-Key': 'readonly-key-456'
        }
      })

      const result = await validateApiKey(req, mockEnv as any, 'write')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Insufficient permissions')
    })

    it('debe permitir acceso con permisos suficientes', async () => {
      const req = new NextRequest('https://example.com/api/test', {
        headers: {
          'X-API-Key': 'test-api-key-123'
        }
      })

      const result = await validateApiKey(req, mockEnv as any, 'write')

      expect(result.success).toBe(true)
    })
  })

  describe('EIP-712 Signature Authentication', () => {
    it('debe verificar firma EIP-712 válida', async () => {
      const mockAddress = '0x742d35Cc6634C0532925a3b8D890319d397C71eF'
      mockEthers.verifyTypedData.mockReturnValue(mockAddress)

      const signatureData = {
        domain: {
          name: 'ArbitrageX Supreme',
          version: '1',
          chainId: 1,
        },
        types: {
          AuthRequest: [
            { name: 'address', type: 'address' },
            { name: 'nonce', type: 'uint256' },
            { name: 'timestamp', type: 'uint256' },
          ],
        },
        message: {
          address: mockAddress,
          nonce: 12345,
          timestamp: Date.now(),
        },
        signature: '0x1234567890abcdef...',
      }

      const req = new NextRequest('https://example.com/api/test', {
        method: 'POST',
        body: JSON.stringify(signatureData),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const result = await verifySignature(req, mockEnv as any)

      expect(result.success).toBe(true)
      expect(result.address).toBe(mockAddress)
      expect(mockEthers.verifyTypedData).toHaveBeenCalledWith(
        signatureData.domain,
        signatureData.types,
        signatureData.message,
        signatureData.signature
      )
    })

    it('debe rechazar firma inválida', async () => {
      const mockAddress = '0x742d35Cc6634C0532925a3b8D890319d397C71eF'
      const differentAddress = '0x1234567890123456789012345678901234567890'
      
      mockEthers.verifyTypedData.mockReturnValue(differentAddress)

      const signatureData = {
        domain: {
          name: 'ArbitrageX Supreme',
          version: '1',
          chainId: 1,
        },
        types: {
          AuthRequest: [
            { name: 'address', type: 'address' },
            { name: 'nonce', type: 'uint256' },
            { name: 'timestamp', type: 'uint256' },
          ],
        },
        message: {
          address: mockAddress,
          nonce: 12345,
          timestamp: Date.now(),
        },
        signature: '0x1234567890abcdef...',
      }

      const req = new NextRequest('https://example.com/api/test', {
        method: 'POST',
        body: JSON.stringify(signatureData),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const result = await verifySignature(req, mockEnv as any)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid signature')
    })

    it('debe validar timestamp de firma', async () => {
      const mockAddress = '0x742d35Cc6634C0532925a3b8D890319d397C71eF'
      mockEthers.verifyTypedData.mockReturnValue(mockAddress)

      const oldTimestamp = Date.now() - (10 * 60 * 1000) // 10 minutos atrás

      const signatureData = {
        domain: {
          name: 'ArbitrageX Supreme',
          version: '1',
          chainId: 1,
        },
        types: {
          AuthRequest: [
            { name: 'address', type: 'address' },
            { name: 'nonce', type: 'uint256' },
            { name: 'timestamp', type: 'uint256' },
          ],
        },
        message: {
          address: mockAddress,
          nonce: 12345,
          timestamp: oldTimestamp,
        },
        signature: '0x1234567890abcdef...',
      }

      const req = new NextRequest('https://example.com/api/test', {
        method: 'POST',
        body: JSON.stringify(signatureData),
        headers: {
          'Content-Type': 'application/json'
        }
      })

      const result = await verifySignature(req, mockEnv as any)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Signature expired')
    })
  })

  describe('Multi-Method Authentication', () => {
    it('debe probar métodos en orden de prioridad', async () => {
      // JWT tiene mayor prioridad que API key
      const mockPayload = {
        userId: 'user-jwt',
        address: '0x742d35Cc6634C0532925a3b8D890319d397C71eF',
        role: 'user',
      }

      mockJwt.verify.mockReturnValue(mockPayload as any)

      const req = new NextRequest('https://example.com/api/test', {
        headers: {
          'Authorization': 'Bearer valid-jwt-token',
          'X-API-Key': 'test-api-key-123', // También presente pero debe ser ignorado
        }
      })

      const result = await verifyAuth(req, mockEnv as any)

      expect(result.success).toBe(true)
      expect(result.user?.authMethod).toBe('jwt')
      expect(result.user?.id).toBe('user-jwt')
    })

    it('debe usar API key si JWT no está presente', async () => {
      const req = new NextRequest('https://example.com/api/test', {
        headers: {
          'X-API-Key': 'test-api-key-123'
        }
      })

      const result = await verifyAuth(req, mockEnv as any)

      expect(result.success).toBe(true)
      expect(result.user?.authMethod).toBe('api_key')
      expect(result.user?.id).toBe('user-1')
    })

    it('debe fallar si ningún método es válido', async () => {
      const req = new NextRequest('https://example.com/api/test', {
        headers: {} // Sin headers de autenticación
      })

      const result = await verifyAuth(req, mockEnv as any)

      expect(result.success).toBe(false)
      expect(result.error).toBe('No authentication provided')
    })
  })

  describe('Role-Based Access Control', () => {
    it('debe verificar rol de usuario para JWT', async () => {
      const mockPayload = {
        userId: 'user-123',
        address: '0x742d35Cc6634C0532925a3b8D890319d397C71eF',
        role: 'admin',
      }

      mockJwt.verify.mockReturnValue(mockPayload as any)

      const req = new NextRequest('https://example.com/api/admin/users', {
        headers: {
          'Authorization': 'Bearer valid-jwt-token'
        }
      })

      const result = await verifyAuth(req, mockEnv as any, 'admin')

      expect(result.success).toBe(true)
      expect(result.user?.role).toBe('admin')
    })

    it('debe denegar acceso con rol insuficiente', async () => {
      const mockPayload = {
        userId: 'user-123',
        address: '0x742d35Cc6634C0532925a3b8D890319d397C71eF',
        role: 'user',
      }

      mockJwt.verify.mockReturnValue(mockPayload as any)

      const req = new NextRequest('https://example.com/api/admin/users', {
        headers: {
          'Authorization': 'Bearer valid-jwt-token'
        }
      })

      const result = await verifyAuth(req, mockEnv as any, 'admin')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Insufficient role permissions')
    })
  })

  describe('Session Management', () => {
    it('debe manejar sesiones con cookies', async () => {
      const req = new NextRequest('https://example.com/api/test', {
        headers: {
          'Cookie': 'session=valid-session-id'
        }
      })

      // Mock session validation
      const mockEnvWithSessions = {
        ...mockEnv,
        SESSIONS: JSON.stringify({
          'valid-session-id': {
            userId: 'user-session',
            address: '0x742d35Cc6634C0532925a3b8D890319d397C71eF',
            role: 'user',
            createdAt: Date.now(),
            expiresAt: Date.now() + 86400000, // 24h
          }
        })
      }

      const result = await verifyAuth(req, mockEnvWithSessions as any)

      expect(result.success).toBe(true)
      expect(result.user?.id).toBe('user-session')
      expect(result.user?.authMethod).toBe('session')
    })

    it('debe rechazar sesiones expiradas', async () => {
      const req = new NextRequest('https://example.com/api/test', {
        headers: {
          'Cookie': 'session=expired-session-id'
        }
      })

      const mockEnvWithSessions = {
        ...mockEnv,
        SESSIONS: JSON.stringify({
          'expired-session-id': {
            userId: 'user-session',
            address: '0x742d35Cc6634C0532925a3b8D890319d397C71eF',
            role: 'user',
            createdAt: Date.now() - 172800000, // 48h ago
            expiresAt: Date.now() - 86400000,  // Expired 24h ago
          }
        })
      }

      const result = await verifyAuth(req, mockEnvWithSessions as any)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Session expired')
    })
  })

  describe('Rate Limiting por Usuario', () => {
    it('debe incluir información del usuario para rate limiting', async () => {
      const mockPayload = {
        userId: 'user-123',
        address: '0x742d35Cc6634C0532925a3b8D890319d397C71eF',
        role: 'user',
      }

      mockJwt.verify.mockReturnValue(mockPayload as any)

      const req = new NextRequest('https://example.com/api/test', {
        headers: {
          'Authorization': 'Bearer valid-jwt-token'
        }
      })

      const result = await verifyAuth(req, mockEnv as any)

      expect(result.success).toBe(true)
      expect(result.rateLimitKey).toBe(`user:${mockPayload.userId}`)
    })

    it('debe usar IP para usuarios no autenticados', async () => {
      const req = new NextRequest('https://example.com/api/public', {
        headers: {
          'X-Forwarded-For': '192.168.1.1'
        }
      })

      const result = await verifyAuth(req, mockEnv as any, null, true) // allowAnonymous

      expect(result.success).toBe(true)
      expect(result.rateLimitKey).toBe('ip:192.168.1.1')
    })
  })

  describe('Casos Edge', () => {
    it('debe manejar headers malformados', async () => {
      const req = new NextRequest('https://example.com/api/test', {
        headers: {
          'Authorization': 'Bearer' // Sin token
        }
      })

      const result = await verifyAuth(req, mockEnv as any)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Malformed authorization header')
    })

    it('debe manejar JSON malformado en signatures', async () => {
      const req = new NextRequest('https://example.com/api/test', {
        method: 'POST',
        body: 'invalid json',
        headers: {
          'Content-Type': 'application/json',
          'X-Signature': 'present'
        }
      })

      const result = await verifySignature(req, mockEnv as any)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid request body')
    })

    it('debe manejar configuración de environment faltante', async () => {
      const emptyEnv = {}

      const req = new NextRequest('https://example.com/api/test', {
        headers: {
          'Authorization': 'Bearer some-token'
        }
      })

      const result = await verifyAuth(req, emptyEnv as any)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Authentication not configured')
    })
  })
})
/**
 * @fileoverview Tests unitarios para middleware de validación
 * Ingenio Pichichi S.A. - ArbitrageX Supreme
 * Tests completos para sistema de validación y sanitización de entrada
 */

import { NextRequest } from 'next/server'
import { 
  validateInput, 
  sanitizeInput, 
  detectMaliciousPatterns,
  validateArbitrageParams,
  validateSimulationParams 
} from '../validation'

describe('Validation Middleware', () => {
  describe('Sanitización Básica', () => {
    it('debe sanitizar scripts maliciosos', () => {
      const maliciousInput = '<script>alert("xss")</script>Hello World'
      const sanitized = sanitizeInput(maliciousInput)
      
      expect(sanitized).toBe('Hello World')
      expect(sanitized).not.toContain('<script>')
      expect(sanitized).not.toContain('alert')
    })

    it('debe sanitizar inyección SQL', () => {
      const sqlInjection = "'; DROP TABLE users; --"
      const sanitized = sanitizeInput(sqlInjection)
      
      expect(sanitized).toBe("' DROP TABLE users --")
      expect(sanitized).not.toContain(';')
    })

    it('debe sanitizar comandos del sistema', () => {
      const commandInjection = 'user && rm -rf /'
      const sanitized = sanitizeInput(commandInjection)
      
      expect(sanitized).toBe('user  rm -rf /')
      expect(sanitized).not.toContain('&&')
    })

    it('debe preservar texto legítimo', () => {
      const legitimateText = 'Hello, this is a normal message with numbers 123 and symbols !@#'
      const sanitized = sanitizeInput(legitimateText)
      
      expect(sanitized).toBe(legitimateText)
    })

    it('debe manejar strings vacíos y null', () => {
      expect(sanitizeInput('')).toBe('')
      expect(sanitizeInput(null as any)).toBe('')
      expect(sanitizeInput(undefined as any)).toBe('')
    })
  })

  describe('Detección de Patrones Maliciosos', () => {
    it('debe detectar inyección SQL', () => {
      const patterns = [
        "' OR '1'='1",
        'UNION SELECT * FROM users',
        '; DROP DATABASE test;',
        '1\' AND 1=1--',
      ]

      patterns.forEach(pattern => {
        const result = detectMaliciousPatterns(pattern)
        expect(result.isMalicious).toBe(true)
        expect(result.type).toBe('sql_injection')
      })
    })

    it('debe detectar XSS', () => {
      const patterns = [
        '<script>alert("xss")</script>',
        'javascript:alert(1)',
        '<img src=x onerror=alert(1)>',
        '<svg onload=alert(1)>',
      ]

      patterns.forEach(pattern => {
        const result = detectMaliciousPatterns(pattern)
        expect(result.isMalicious).toBe(true)
        expect(result.type).toBe('xss')
      })
    })

    it('debe detectar inyección NoSQL', () => {
      const patterns = [
        '{"$ne": null}',
        '{"$regex": ".*"}',
        '{"$where": "this.username == this.password"}',
      ]

      patterns.forEach(pattern => {
        const result = detectMaliciousPatterns(pattern)
        expect(result.isMalicious).toBe(true)
        expect(result.type).toBe('nosql_injection')
      })
    })

    it('debe detectar LDAP injection', () => {
      const patterns = [
        '*)(uid=*',
        '*)(&(objectClass=*',
        '*))(|(cn=*',
      ]

      patterns.forEach(pattern => {
        const result = detectMaliciousPatterns(pattern)
        expect(result.isMalicious).toBe(true)
        expect(result.type).toBe('ldap_injection')
      })
    })

    it('debe detectar Path Traversal', () => {
      const patterns = [
        '../../../etc/passwd',
        '..\\..\\windows\\system32',
        '....//....//etc/shadow',
      ]

      patterns.forEach(pattern => {
        const result = detectMaliciousPatterns(pattern)
        expect(result.isMalicious).toBe(true)
        expect(result.type).toBe('path_traversal')
      })
    })

    it('debe permitir contenido legítimo', () => {
      const legitimatePatterns = [
        'Hello World',
        '1000.50',
        'user@example.com',
        'https://example.com/api/data',
        'Normal text with punctuation!',
      ]

      legitimatePatterns.forEach(pattern => {
        const result = detectMaliciousPatterns(pattern)
        expect(result.isMalicious).toBe(false)
      })
    })
  })

  describe('Validación de Request', () => {
    it('debe validar request GET exitosamente', async () => {
      const req = new NextRequest('https://example.com/api/test?param=value', {
        method: 'GET'
      })

      const result = await validateInput(req)

      expect(result.isValid).toBe(true)
      expect(result.sanitizedData).toEqual({
        query: { param: 'value' },
        body: null
      })
    })

    it('debe validar request POST exitosamente', async () => {
      const validBody = {
        tokenA: '0xA0b86a33E6441cF2b6B82397548632b7F293c98',
        tokenB: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        amount: '1000.50'
      }

      const req = new NextRequest('https://example.com/api/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(validBody)
      })

      const result = await validateInput(req)

      expect(result.isValid).toBe(true)
      expect(result.sanitizedData.body).toEqual(validBody)
    })

    it('debe rechazar query parameters maliciosos', async () => {
      const req = new NextRequest("https://example.com/api/test?param=' OR '1'='1", {
        method: 'GET'
      })

      const result = await validateInput(req)

      expect(result.isValid).toBe(false)
      expect(result.violations).toContainEqual({
        field: 'query.param',
        type: 'sql_injection',
        value: "' OR '1'='1"
      })
    })

    it('debe rechazar body malicioso', async () => {
      const maliciousBody = {
        tokenA: '<script>alert("xss")</script>',
        amount: '1000'
      }

      const req = new NextRequest('https://example.com/api/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(maliciousBody)
      })

      const result = await validateInput(req)

      expect(result.isValid).toBe(false)
      expect(result.violations).toContainEqual({
        field: 'body.tokenA',
        type: 'xss',
        value: '<script>alert("xss")</script>'
      })
    })

    it('debe manejar JSON malformado', async () => {
      const req = new NextRequest('https://example.com/api/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: 'invalid json {'
      })

      const result = await validateInput(req)

      expect(result.isValid).toBe(false)
      expect(result.error).toBe('Invalid JSON format')
    })

    it('debe validar headers', async () => {
      const req = new NextRequest('https://example.com/api/test', {
        method: 'GET',
        headers: {
          'X-Custom-Header': '<script>alert("xss")</script>'
        }
      })

      const result = await validateInput(req)

      expect(result.isValid).toBe(false)
      expect(result.violations).toContainEqual({
        field: 'headers.x-custom-header',
        type: 'xss',
        value: '<script>alert("xss")</script>'
      })
    })
  })

  describe('Validación de Parámetros de Arbitraje', () => {
    it('debe validar parámetros de arbitraje correctos', () => {
      const validParams = {
        strategyType: 'INTRA_DEX' as const,
        sourceChain: 'ethereum',
        targetChain: 'ethereum',
        tokenA: {
          address: '0xA0b86a33E6441cF2b6B82397548632b7F293c98',
          symbol: 'USDC',
          decimals: 6,
          balance: '1000.0'
        },
        tokenB: {
          address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
          symbol: 'DAI',
          decimals: 18,
          balance: '1000.0'
        },
        amount: '100.50',
        slippage: 0.5,
        deadline: 300,
        gasSettings: {
          gasPrice: '20',
          gasLimit: '300000',
          priorityFee: '2'
        }
      }

      const result = validateArbitrageParams(validParams)

      expect(result.isValid).toBe(true)
      expect(result.sanitizedParams).toEqual(validParams)
    })

    it('debe rechazar direcciones de token inválidas', () => {
      const invalidParams = {
        strategyType: 'INTRA_DEX' as const,
        sourceChain: 'ethereum',
        targetChain: 'ethereum',
        tokenA: {
          address: 'invalid-address',
          symbol: 'USDC',
          decimals: 6,
          balance: '1000.0'
        },
        tokenB: {
          address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
          symbol: 'DAI',
          decimals: 18,
          balance: '1000.0'
        },
        amount: '100.50',
        slippage: 0.5,
        deadline: 300,
        gasSettings: {
          gasPrice: '20',
          gasLimit: '300000',
          priorityFee: '2'
        }
      }

      const result = validateArbitrageParams(invalidParams)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContainEqual({
        field: 'tokenA.address',
        message: 'Invalid Ethereum address format'
      })
    })

    it('debe validar rangos de valores', () => {
      const invalidParams = {
        strategyType: 'INTRA_DEX' as const,
        sourceChain: 'ethereum',
        targetChain: 'ethereum',
        tokenA: {
          address: '0xA0b86a33E6441cF2b6B82397548632b7F293c98',
          symbol: 'USDC',
          decimals: 6,
          balance: '1000.0'
        },
        tokenB: {
          address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
          symbol: 'DAI',
          decimals: 18,
          balance: '1000.0'
        },
        amount: '-100', // Cantidad negativa
        slippage: 150, // Slippage > 100%
        deadline: -300, // Deadline negativo
        gasSettings: {
          gasPrice: '0', // Gas price 0
          gasLimit: '50000', // Gas limit muy bajo
          priorityFee: '-1' // Priority fee negativo
        }
      }

      const result = validateArbitrageParams(invalidParams)

      expect(result.isValid).toBe(false)
      expect(result.errors).toHaveLength(6) // Todos los errores de validación
    })

    it('debe sanitizar strings en parámetros', () => {
      const paramsWithMaliciousStrings = {
        strategyType: 'INTRA_DEX' as const,
        sourceChain: 'ethereum<script>alert("xss")</script>',
        targetChain: 'ethereum',
        tokenA: {
          address: '0xA0b86a33E6441cF2b6B82397548632b7F293c98',
          symbol: 'USDC<img src=x onerror=alert(1)>',
          decimals: 6,
          balance: '1000.0'
        },
        tokenB: {
          address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
          symbol: 'DAI',
          decimals: 18,
          balance: '1000.0'
        },
        amount: '100.50',
        slippage: 0.5,
        deadline: 300,
        gasSettings: {
          gasPrice: '20',
          gasLimit: '300000',
          priorityFee: '2'
        }
      }

      const result = validateArbitrageParams(paramsWithMaliciousStrings)

      expect(result.isValid).toBe(true)
      expect(result.sanitizedParams?.sourceChain).toBe('ethereum')
      expect(result.sanitizedParams?.tokenA.symbol).toBe('USDC')
    })
  })

  describe('Validación de Parámetros de Simulación', () => {
    it('debe validar parámetros de simulación correctos', () => {
      const validParams = {
        strategyType: 'INTER_DEX' as const,
        sourceChain: 'ethereum',
        targetChain: 'polygon',
        tokenPair: {
          tokenA: {
            address: '0xA0b86a33E6441cF2b6B82397548632b7F293c98',
            symbol: 'USDC',
            decimals: 6
          },
          tokenB: {
            address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
            symbol: 'DAI',
            decimals: 18
          }
        },
        amount: '1000',
        scenarios: ['optimistic', 'realistic', 'pessimistic'] as const,
        timeframes: [60, 300, 900]
      }

      const result = validateSimulationParams(validParams)

      expect(result.isValid).toBe(true)
      expect(result.sanitizedParams).toEqual(validParams)
    })

    it('debe rechazar escenarios inválidos', () => {
      const invalidParams = {
        strategyType: 'INTER_DEX' as const,
        sourceChain: 'ethereum',
        targetChain: 'polygon',
        tokenPair: {
          tokenA: {
            address: '0xA0b86a33E6441cF2b6B82397548632b7F293c98',
            symbol: 'USDC',
            decimals: 6
          },
          tokenB: {
            address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
            symbol: 'DAI',
            decimals: 18
          }
        },
        amount: '1000',
        scenarios: ['invalid_scenario'] as any,
        timeframes: [60, 300, 900]
      }

      const result = validateSimulationParams(invalidParams)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContainEqual({
        field: 'scenarios',
        message: 'Invalid scenario type: invalid_scenario'
      })
    })

    it('debe validar timeframes', () => {
      const invalidParams = {
        strategyType: 'INTER_DEX' as const,
        sourceChain: 'ethereum',
        targetChain: 'polygon',
        tokenPair: {
          tokenA: {
            address: '0xA0b86a33E6441cF2b6B82397548632b7F293c98',
            symbol: 'USDC',
            decimals: 6
          },
          tokenB: {
            address: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
            symbol: 'DAI',
            decimals: 18
          }
        },
        amount: '1000',
        scenarios: ['optimistic'] as const,
        timeframes: [0, -60, 7200] // Invalid timeframes
      }

      const result = validateSimulationParams(invalidParams)

      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.field === 'timeframes')).toBe(true)
    })
  })

  describe('Casos Edge y Rendimiento', () => {
    it('debe manejar objetos anidados profundamente', () => {
      const deepObject = {
        level1: {
          level2: {
            level3: {
              level4: {
                malicious: '<script>alert("deep xss")</script>'
              }
            }
          }
        }
      }

      const sanitized = sanitizeInput(JSON.stringify(deepObject))
      expect(sanitized).not.toContain('<script>')
    })

    it('debe manejar arrays con elementos maliciosos', () => {
      const maliciousArray = [
        'normal string',
        '<script>alert("xss")</script>',
        "'; DROP TABLE users; --",
        'another normal string'
      ]

      const result = detectMaliciousPatterns(JSON.stringify(maliciousArray))
      expect(result.isMalicious).toBe(true)
    })

    it('debe ser eficiente con strings largos', () => {
      const longString = 'a'.repeat(10000) + '<script>alert("xss")</script>'
      
      const startTime = Date.now()
      const result = detectMaliciousPatterns(longString)
      const endTime = Date.now()

      expect(result.isMalicious).toBe(true)
      expect(endTime - startTime).toBeLessThan(100) // Debe ser rápido
    })

    it('debe manejar caracteres Unicode', () => {
      const unicodeString = 'Hello 世界 🌍 مرحبا здравствуй'
      const sanitized = sanitizeInput(unicodeString)
      
      expect(sanitized).toBe(unicodeString)
    })

    it('debe escapar caracteres especiales correctamente', () => {
      const specialChars = '&<>"\'/'
      const sanitized = sanitizeInput(specialChars)
      
      // Debe escapar pero no eliminar completamente
      expect(sanitized).toBeDefined()
      expect(sanitized.length).toBeGreaterThan(0)
    })
  })
})
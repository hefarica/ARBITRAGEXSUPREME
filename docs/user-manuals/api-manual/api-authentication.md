# Autenticación API - ArbitrageX Supreme

## 🔐 Visión General de Autenticación

ArbitrageX Supreme implementa un sistema de autenticación multicapa que garantiza la seguridad máxima para operaciones de trading automatizado y acceso programático a la plataforma. Soportamos múltiples métodos de autenticación según el tipo de usuario y casos de uso.

## 🗝️ Métodos de Autenticación

### 1. API Key Authentication (Recomendado)

El método más común para aplicaciones y bots de trading automatizado.

#### Generación de API Keys

```typescript
// Generar API Key desde el dashboard
const apiKeyConfig = {
  name: "Trading Bot Main",
  description: "Bot principal de arbitraje",
  permissions: [
    "trading:read",
    "trading:write", 
    "portfolio:read",
    "market_data:read"
  ],
  restrictions: {
    ipWhitelist: ["192.168.1.100", "10.0.0.5"],
    rateLimit: {
      requestsPerMinute: 1000,
      burstLimit: 100
    },
    tradingLimits: {
      maxOrderValue: 50000,      // $50,000 máximo por orden
      maxDailyVolume: 500000,    // $500,000 máximo diario
      allowedAssets: ["ETH", "USDC", "WBTC", "MATIC"]
    }
  },
  expiration: "2025-12-31T23:59:59Z" // Opcional
}
```

#### Estructura de API Key

```typescript
interface ApiKeyResponse {
  keyId: string              // Identificador público de la key
  secretKey: string          // Secret (mostrado solo una vez)
  permissions: string[]      // Permisos asignados
  createdAt: string         // Fecha de creación
  expiresAt?: string        // Fecha de expiración (opcional)
  restrictions: KeyRestrictions
}

// Ejemplo de respuesta
{
  "keyId": "ak_live_YOUR_API_KEY_HERE",
  "secretKey": "sk_live_YOUR_SECRET_KEY_HERE",
  "permissions": ["trading:read", "trading:write", "portfolio:read"],
  "createdAt": "2024-12-01T10:30:00Z",
  "expiresAt": "2025-12-31T23:59:59Z",
  "restrictions": {
    "ipWhitelist": ["192.168.1.100"],
    "rateLimit": {
      "requestsPerMinute": 1000,
      "burstLimit": 100
    }
  }
}
```

#### Uso de API Key

```typescript
// Headers requeridos para autenticación
const headers = {
  'X-API-Key': 'ak_live_YOUR_API_KEY_HERE',
  'X-API-Secret': 'sk_live_YOUR_SECRET_KEY_HERE',
  'X-Timestamp': Date.now().toString(),
  'X-Signature': calculateSignature(payload),
  'Content-Type': 'application/json'
}

// Función para calcular firma HMAC
function calculateSignature(
  method: string,
  path: string, 
  timestamp: string,
  body: string,
  secret: string
): string {
  const message = `${method}${path}${timestamp}${body}`
  return crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex')
}

// Ejemplo de request autenticado
const response = await fetch('https://api.arbitragex.com/v1/trading/opportunities', {
  method: 'GET',
  headers: {
    'X-API-Key': apiKey,
    'X-API-Secret': apiSecret,
    'X-Timestamp': timestamp,
    'X-Signature': signature
  }
})
```

### 2. JWT Token Authentication

Para aplicaciones web y sesiones temporales.

#### Obtención de JWT Token

```typescript
// Endpoint de login
POST /api/auth/login

// Request body
{
  "email": "trader@ejemplo.com",
  "password": "password_segura",
  "mfaCode": "123456",  // Si 2FA está habilitado
  "deviceId": "device_12345"
}

// Response
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600,      // 1 hora
    "tokenType": "Bearer",
    "user": {
      "id": "usr_12345",
      "email": "trader@ejemplo.com",
      "role": "trader",
      "permissions": ["trading:read", "trading:write"]
    }
  }
}
```

#### Uso de JWT Token

```typescript
// Header de autorización
const headers = {
  'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  'Content-Type': 'application/json'
}

// Renovación automática de token
async function refreshToken(refreshToken: string): Promise<AuthResponse> {
  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  })
  return response.json()
}
```

### 3. OAuth 2.0 (Aplicaciones de Terceros)

Para integraciones con aplicaciones externas y marketplaces.

#### Flujo de Autorización

```typescript
// 1. Redirectar usuario a página de autorización
const authUrl = new URL('https://api.arbitragex.com/oauth/authorize')
authUrl.searchParams.append('client_id', 'your_client_id')
authUrl.searchParams.append('redirect_uri', 'https://your-app.com/callback')
authUrl.searchParams.append('response_type', 'code')
authUrl.searchParams.append('scope', 'trading:read portfolio:read')
authUrl.searchParams.append('state', 'random_state_string')

window.location.href = authUrl.toString()

// 2. Intercambiar código por token
const tokenResponse = await fetch('https://api.arbitragex.com/oauth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: 'your_client_id',
    client_secret: 'your_client_secret',
    code: 'received_auth_code',
    redirect_uri: 'https://your-app.com/callback'
  })
})

// Response
{
  "access_token": "oauth_token_xyz",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "oauth_refresh_xyz",
  "scope": "trading:read portfolio:read"
}
```

### 4. Wallet Signature Authentication

Para aplicaciones DeFi y conexiones directas de wallet.

#### Autenticación con MetaMask

```typescript
import { ethers } from 'ethers'

async function authenticateWithWallet(): Promise<string> {
  // 1. Conectar wallet
  const provider = new ethers.BrowserProvider(window.ethereum)
  await provider.send("eth_requestAccounts", [])
  const signer = await provider.getSigner()
  const address = await signer.getAddress()
  
  // 2. Obtener nonce del servidor
  const nonceResponse = await fetch(`/api/auth/nonce/${address}`)
  const { nonce } = await nonceResponse.json()
  
  // 3. Firmar mensaje
  const message = `ArbitrageX Supreme Authentication\nNonce: ${nonce}\nTimestamp: ${Date.now()}`
  const signature = await signer.signMessage(message)
  
  // 4. Verificar firma y obtener token
  const authResponse = await fetch('/api/auth/wallet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      address,
      message,
      signature,
      nonce
    })
  })
  
  const { accessToken } = await authResponse.json()
  return accessToken
}
```

## 🛡️ Configuración de Seguridad

### Rate Limiting

```typescript
// Límites por tipo de endpoint
const rateLimits = {
  // Datos de mercado (lectura)
  marketData: {
    requestsPerMinute: 2000,
    burstLimit: 200,
    windowSize: 60 // segundos
  },
  
  // Trading (escritura)
  trading: {
    requestsPerMinute: 100,
    burstLimit: 20,
    windowSize: 60
  },
  
  // Autenticación
  auth: {
    requestsPerMinute: 20,
    burstLimit: 5,
    windowSize: 60,
    lockoutThreshold: 10,     // Intentos fallidos
    lockoutDuration: 900      // 15 minutos
  },
  
  // Portfolio y consultas
  portfolio: {
    requestsPerMinute: 500,
    burstLimit: 50,
    windowSize: 60
  }
}

// Headers de respuesta para rate limiting
{
  "X-RateLimit-Limit": "1000",
  "X-RateLimit-Remaining": "999", 
  "X-RateLimit-Reset": "1640995200",
  "X-RateLimit-Window": "60"
}
```

### IP Whitelisting

```typescript
// Configurar IP whitelist por API key
const ipWhitelistConfig = {
  enabled: true,
  addresses: [
    "192.168.1.100",          // Servidor principal
    "10.0.0.5",               // Servidor backup
    "203.0.113.0/24"          // Rango de red empresarial
  ],
  enforcement: "strict",       // "strict" | "warn" | "disabled"
  violations: {
    logAll: true,
    alertThreshold: 5,        // Alertar después de 5 intentos
    blockDuration: 3600       // Bloquear 1 hora
  }
}
```

### Scopes y Permisos

```typescript
// Sistema de permisos granulares
const availableScopes = {
  // Lectura de datos
  "market_data:read": "Leer datos de mercado y precios",
  "portfolio:read": "Ver portfolio y balances", 
  "trading:read": "Ver trades y órdenes",
  "analytics:read": "Acceder a analytics y reportes",
  
  // Escritura/Ejecución
  "trading:write": "Ejecutar trades y órdenes",
  "portfolio:write": "Modificar configuración de portfolio",
  "settings:write": "Modificar configuración de cuenta",
  
  // Administración
  "admin:users": "Gestionar usuarios (solo admin)",
  "admin:system": "Configuración de sistema (solo admin)",
  
  // Especiales
  "webhook:manage": "Configurar webhooks",
  "api_keys:manage": "Gestionar API keys",
  "audit:read": "Acceso a logs de auditoría"
}

// Validación de permisos en endpoints
function requireScope(requiredScope: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userScopes = req.user?.scopes || []
    
    if (!userScopes.includes(requiredScope)) {
      return res.status(403).json({
        error: "insufficient_scope",
        message: `Required scope: ${requiredScope}`,
        userScopes: userScopes
      })
    }
    
    next()
  }
}
```

## 📡 Webhooks Authentication

### Configuración de Webhooks

```typescript
// Registrar webhook endpoint
POST /api/webhooks

{
  "url": "https://your-app.com/webhooks/arbitragex",
  "events": [
    "trade.completed",
    "opportunity.detected", 
    "portfolio.updated",
    "system.alert"
  ],
  "secret": "webhook_secret_key_12345",
  "active": true,
  "retries": {
    "maxAttempts": 3,
    "backoffMultiplier": 2,
    "initialDelay": 1000
  }
}
```

### Verificación de Webhook Signature

```typescript
// Verificar firma de webhook en tu servidor
function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  
  const receivedSignature = signature.replace('sha256=', '')
  
  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature, 'hex'),
    Buffer.from(receivedSignature, 'hex')
  )
}

// Ejemplo de handler de webhook
app.post('/webhooks/arbitragex', (req, res) => {
  const signature = req.headers['x-arbitragex-signature']
  const payload = JSON.stringify(req.body)
  
  if (!verifyWebhookSignature(payload, signature, WEBHOOK_SECRET)) {
    return res.status(401).json({ error: 'Invalid signature' })
  }
  
  // Procesar evento de webhook
  const { event, data } = req.body
  
  switch (event) {
    case 'trade.completed':
      handleTradeCompleted(data)
      break
    case 'opportunity.detected':
      handleOpportunityDetected(data)
      break
    // ... más eventos
  }
  
  res.status(200).json({ received: true })
})
```

## 🔍 Testing y Debugging

### Sandbox Environment

```typescript
// Endpoints de sandbox para testing
const sandboxConfig = {
  baseUrl: "https://api-sandbox.arbitragex.com",
  authentication: {
    apiKey: "ak_test_sandbox123",
    apiSecret: "sk_test_sandbox456"
  },
  features: {
    mockData: true,           // Datos de mercado simulados
    paperTrading: true,       // Trading simulado
    unlimitedRequests: true,  // Sin límites de rate
    resetDatabase: true       // Reset daily a las 00:00 UTC
  }
}

// Test API key (sandbox)
const testApiKey = {
  keyId: "ak_test_7d2f8e9a1c4b6m3n",
  secretKey: "sk_test_9x8v7c6b5n4m3l2k1j0h9g8f7e6d5c4b",
  environment: "sandbox",
  permissions: "all"
}
```

### Herramientas de Testing

```typescript
// SDK de testing incluido
import { ArbitrageXTestClient } from '@arbitragex/test-sdk'

const testClient = new ArbitrageXTestClient({
  apiKey: 'ak_test_sandbox123',
  apiSecret: 'sk_test_sandbox456',
  environment: 'sandbox'
})

// Casos de prueba comunes
describe('ArbitrageX API Authentication', () => {
  test('should authenticate with valid API key', async () => {
    const response = await testClient.auth.verify()
    expect(response.valid).toBe(true)
  })
  
  test('should reject invalid signature', async () => {
    const badClient = new ArbitrageXTestClient({
      apiKey: 'invalid_key',
      apiSecret: 'invalid_secret'
    })
    
    await expect(badClient.trading.getOpportunities())
      .rejects.toThrow('Authentication failed')
  })
  
  test('should respect rate limits', async () => {
    const requests = Array(101).fill(null).map(() => 
      testClient.market.getPrices()
    )
    
    const results = await Promise.allSettled(requests)
    const rejected = results.filter(r => r.status === 'rejected')
    
    expect(rejected.length).toBeGreaterThan(0)
    expect(rejected[0].reason.message).toContain('Rate limit exceeded')
  })
})
```

## 📚 SDKs Oficiales

### JavaScript/TypeScript SDK

```bash
npm install @arbitragex/sdk
```

```typescript
import { ArbitrageXClient } from '@arbitragex/sdk'

const client = new ArbitrageXClient({
  apiKey: process.env.ARBITRAGEX_API_KEY,
  apiSecret: process.env.ARBITRAGEX_API_SECRET,
  environment: 'production', // 'production' | 'sandbox'
  
  // Configuración opcional
  config: {
    timeout: 30000,           // 30 segundos timeout
    retries: 3,               // 3 reintentos automáticos
    rateLimit: {
      enabled: true,
      requestsPerSecond: 10   // Cliente-side rate limiting
    }
  }
})

// Uso básico
const opportunities = await client.trading.getOpportunities()
const portfolio = await client.portfolio.getBalance()
const trade = await client.trading.executeTrade({
  opportunityId: 'opp_12345',
  amount: 1000
})
```

### Python SDK

```bash
pip install arbitragex-python
```

```python
from arbitragex import ArbitrageXClient

client = ArbitrageXClient(
    api_key=os.getenv('ARBITRAGEX_API_KEY'),
    api_secret=os.getenv('ARBITRAGEX_API_SECRET'),
    environment='production'
)

# Uso básico
opportunities = client.trading.get_opportunities()
portfolio = client.portfolio.get_balance()
trade = client.trading.execute_trade(
    opportunity_id='opp_12345',
    amount=1000
)
```

### Go SDK

```go
import "github.com/arbitragex/go-sdk"

client := arbitragex.NewClient(arbitragex.Config{
    APIKey:      os.Getenv("ARBITRAGEX_API_KEY"),
    APISecret:   os.Getenv("ARBITRAGEX_API_SECRET"),
    Environment: "production",
})

// Uso básico
opportunities, err := client.Trading.GetOpportunities(ctx)
portfolio, err := client.Portfolio.GetBalance(ctx)
trade, err := client.Trading.ExecuteTrade(ctx, arbitragex.TradeRequest{
    OpportunityID: "opp_12345",
    Amount:        1000,
})
```

## ⚠️ Mejores Prácticas de Seguridad

### 1. Gestión Segura de Credenciales

```typescript
// ❌ MAL - Nunca hardcodear credenciales
const client = new ArbitrageXClient({
  apiKey: 'ak_live_YOUR_API_KEY_HERE',
  apiSecret: 'sk_live_YOUR_SECRET_KEY_HERE'
})

// ✅ BIEN - Usar variables de entorno
const client = new ArbitrageXClient({
  apiKey: process.env.ARBITRAGEX_API_KEY,
  apiSecret: process.env.ARBITRAGEX_API_SECRET
})

// ✅ MEJOR - Usar vault de secretos
import { getSecret } from '@/lib/vault'

const client = new ArbitrageXClient({
  apiKey: await getSecret('arbitragex/api-key'),
  apiSecret: await getSecret('arbitragex/api-secret')
})
```

### 2. Rotación de API Keys

```typescript
// Estrategia de rotación automática
const keyRotationStrategy = {
  frequency: '30days',           // Rotar cada 30 días
  gracePeriod: '7days',         // 7 días de gracia para keys antiguas
  notification: {
    before: '7days',            // Notificar 7 días antes
    channels: ['email', 'slack']
  },
  
  automation: {
    enabled: true,
    backupKeys: 2,              // Mantener 2 keys de backup
    testNewKey: true,           // Probar nueva key antes de activar
    rollback: {
      enabled: true,
      conditions: ['high_error_rate', 'authentication_failures']
    }
  }
}
```

### 3. Monitoreo de Seguridad

```typescript
// Configurar alertas de seguridad
const securityMonitoring = {
  alerts: {
    unusualActivity: {
      enabled: true,
      thresholds: {
        requestVolumeIncrease: 200,    // 200% aumento en requests
        newIPAddresses: 5,             // Más de 5 IPs nuevas por día
        failedAuthAttempts: 10         // 10 intentos fallidos seguidos
      }
    },
    
    suspiciousPatterns: {
      enabled: true,
      patterns: [
        'rapid_fire_requests',         // Requests muy rápidos
        'unusual_endpoints',           // Endpoints no comunes
        'geographic_anomaly',          // Requests desde nueva geografía
        'time_based_anomaly'          // Requests fuera de horarios normales
      ]
    }
  },
  
  logging: {
    level: 'detailed',               // 'basic' | 'detailed' | 'debug'
    retention: '90days',             // Retener logs 90 días
    encryption: true,                // Encriptar logs sensibles
    compliance: ['SOC2', 'GDPR']    // Compliance requirements
  }
}
```

### 4. Implementación de Circuit Breaker

```typescript
// Circuit breaker para proteger contra failures
class ApiCircuitBreaker {
  private failureCount = 0
  private lastFailureTime = 0
  private state: 'closed' | 'open' | 'half-open' = 'closed'
  
  constructor(
    private failureThreshold = 5,
    private timeout = 60000,        // 1 minuto
    private retryDelay = 5000      // 5 segundos
  ) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime < this.timeout) {
        throw new Error('Circuit breaker is open')
      }
      this.state = 'half-open'
    }
    
    try {
      const result = await fn()
      this.reset()
      return result
    } catch (error) {
      this.recordFailure()
      throw error
    }
  }
  
  private recordFailure() {
    this.failureCount++
    this.lastFailureTime = Date.now()
    
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'open'
    }
  }
  
  private reset() {
    this.failureCount = 0
    this.state = 'closed'
  }
}
```

## 📞 Soporte y Troubleshooting

### Códigos de Error Comunes

```typescript
const errorCodes = {
  // Autenticación
  'AUTH_001': 'Invalid API key',
  'AUTH_002': 'Invalid signature', 
  'AUTH_003': 'Timestamp too old/future',
  'AUTH_004': 'Insufficient permissions',
  'AUTH_005': 'Rate limit exceeded',
  'AUTH_006': 'IP not whitelisted',
  'AUTH_007': 'API key expired',
  'AUTH_008': 'Account suspended',
  
  // Trading
  'TRD_001': 'Insufficient balance',
  'TRD_002': 'Invalid opportunity ID',
  'TRD_003': 'Opportunity expired',
  'TRD_004': 'Slippage too high',
  'TRD_005': 'Gas price too low',
  
  // Sistema
  'SYS_001': 'Maintenance mode',
  'SYS_002': 'Service temporarily unavailable',
  'SYS_003': 'Internal server error'
}
```

### Soporte Técnico

```typescript
const supportChannels = {
  documentation: "https://docs.arbitragex.com",
  apiStatus: "https://status.arbitragex.com",
  discord: "https://discord.gg/arbitragex",
  email: "api-support@arbitragex.com",
  
  // Soporte enterprise
  enterprise: {
    phone: "+1-800-ARBITRAGE",
    slack: "arbitragex-support.slack.com",
    dedicatedManager: "enterprise@arbitragex.com",
    sla: "4h response time"
  }
}
```

Esta guía de autenticación te proporciona todo lo necesario para integrar de forma segura con la API de ArbitrageX Supreme. Recuerda seguir las mejores prácticas de seguridad y monitorear activamente el uso de tus credenciales de API.

**Siguiente Lectura Recomendada**: [Trading API](./trading-api.md)
# ArbitrageX Supreme - API Documentation para Lovable.dev

## 🎯 Información General del Proyecto

**Proyecto**: ArbitrageX Supreme  
**Backend**: PostgreSQL + Prisma ORM + Fastify  
**Arquitectura**: Multi-tenant enterprise trading system  
**Base URL**: `https://api.arbitragexsupreme.com/api/v2`  
**Autenticación**: JWT Tokens (HTTP-Only Cookies + Bearer Headers)

---

## 🔐 Autenticación

### Login
```typescript
POST /api/v2/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword123",
  "tenantSlug": "ingenio-pichichi" // Opcional
}

Response:
{
  "success": true,
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "tenantId": "tenant_456",
    "role": "trader"
  },
  "permissions": ["arbitrage:read", "arbitrage:execute"],
  "features": ["multi_chain_trading", "real_time_data"]
}
```

### Register
```typescript
POST /api/v2/auth/register
Content-Type: application/json

{
  "email": "newuser@example.com",
  "password": "securepassword123",
  "firstName": "Hector",
  "lastName": "Riascos",
  "tenantSlug": "ingenio-pichichi",
  "inviteToken": "optional_invite_token"
}
```

### Get User Profile
```typescript
GET /api/v2/auth/me
Authorization: Bearer <token>

Response:
{
  "success": true,
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "tenantId": "tenant_456",
    "role": "trader"
  },
  "permissions": ["arbitrage:read", "arbitrage:execute"]
}
```

### Refresh Token
```typescript
POST /api/v2/auth/refresh
Content-Type: application/json

{
  "refreshToken": "refresh_token_here" // Opcional si está en cookie
}
```

### Logout
```typescript
POST /api/v2/auth/logout
Authorization: Bearer <token>
```

---

## 🔗 Arbitrage Endpoints

### Get Network Status
```typescript
GET /api/v2/arbitrage/network-status

Response:
{
  "success": true,
  "network_status": {
    "ethereum": { "status": "online", "latency": 150 },
    "bsc": { "status": "online", "latency": 85 },
    "polygon": { "status": "online", "latency": 120 }
  },
  "supported_blockchains": [
    "ethereum", "bsc", "polygon", "arbitrum", "optimism", 
    "avalanche", "base", "fantom", "gnosis", "celo"
  ],
  "active_networks": 20,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Get Arbitrage Opportunities
```typescript
GET /api/v2/arbitrage/opportunities
Authorization: Bearer <token>
Query Parameters:
- chains: string (comma-separated, e.g., "ethereum,bsc,polygon")
- strategies: string (comma-separated, e.g., "triangular_arbitrage,cross_dex")
- minProfitUsd: number (minimum profit in USD)
- maxRiskLevel: "low" | "medium" | "high"
- limit: number (default: 50, max: 100)
- offset: number (default: 0)
- minProfit: number (minimum profit percentage)
- strategy: string (single strategy filter)

Response:
{
  "success": true,
  "opportunities": [
    {
      "id": "arb_eth_001",
      "strategy": "triangular_arbitrage",
      "blockchain_from": "ethereum",
      "blockchain_to": "arbitrum",
      "token_in": "USDC",
      "token_out": "USDT",
      "amount_in": 1000.0,
      "expected_amount_out": 1025.50,
      "profit_amount": 25.50,
      "profit_percentage": 2.55,
      "confidence_score": 0.85,
      "gas_estimate": "150000",
      "expires_at": "2024-01-15T10:35:00Z",
      "dex_path": ["Uniswap V3", "SushiSwap"],
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 1,
  "total_available": 45,
  "filters_applied": {
    "chains": "ethereum,bsc",
    "minProfit": 2.0,
    "strategy": "triangular_arbitrage",
    "limit": 50
  },
  "scan_timestamp": "2024-01-15T10:30:00Z"
}
```

### Execute Arbitrage
```typescript
POST /api/v2/arbitrage/execute
Authorization: Bearer <token>
Content-Type: application/json

{
  "opportunityId": "arb_eth_001",
  "slippageTolerance": 0.5, // 0.5%
  "amount": "1000.00" // Opcional
}

Response:
{
  "success": true,
  "execution": {
    "id": "exec_1705401000_1234",
    "opportunityId": "arb_eth_001",
    "status": "PENDING",
    "actualProfitUsd": 0,
    "actualProfitPercentage": 0,
    "executionTimeMs": 0,
    "gasUsed": "0",
    "gasPriceGwei": "0",
    "totalGasCost": "0",
    "slippageActual": 0,
    "executedAt": "2024-01-15T10:30:00Z"
  },
  "message": "Arbitrage execution initiated"
}
```

### Get Executions History
```typescript
GET /api/v2/arbitrage/executions
Authorization: Bearer <token>
Query Parameters:
- status: "PENDING" | "SUCCESS" | "FAILED" | "CANCELLED"
- opportunityId: string
- limit: number (default: 50)
- offset: number (default: 0)

Response:
{
  "success": true,
  "executions": [
    {
      "id": "exec_001",
      "opportunityId": "arb_eth_001",
      "status": "SUCCESS",
      "actualProfitUsd": 120.30,
      "actualProfitPercentage": 2.41,
      "executionTimeMs": 1250,
      "gasUsed": "147832",
      "gasPriceGwei": "25.5",
      "totalGasCost": "0.00377316",
      "slippageActual": 0.18,
      "transactionHash": "0x1f4e2c7d8a9b3f6e8d2c5a7b9e1f4d6c8a2b5e7f9d1c3a6b8e4f7d2a5c8b9e1f",
      "executedAt": "2024-01-15T09:30:00Z",
      "completedAt": "2024-01-15T09:30:01Z"
    }
  ],
  "total": 1,
  "stats": {
    "successRate": 85.5,
    "totalProfitUsd": 2450.75,
    "averageExecutionTime": 1150,
    "totalGasSpent": "0.12345678"
  }
}
```

### Get Execution Details
```typescript
GET /api/v2/arbitrage/executions/:executionId
Authorization: Bearer <token>

Response:
{
  "success": true,
  "execution": {
    "id": "exec_001",
    "opportunityId": "arb_eth_001",
    "status": "SUCCESS",
    "actualProfitUsd": 120.30,
    "actualProfitPercentage": 2.41,
    "executionTimeMs": 1250,
    "gasUsed": "147832",
    "gasPriceGwei": "25.5",
    "totalGasCost": "0.00377316",
    "slippageActual": 0.18,
    "transactionHash": "0x1f4e...",
    "executedAt": "2024-01-15T09:30:00Z",
    "completedAt": "2024-01-15T09:30:01Z"
  }
}
```

### Cancel Execution
```typescript
POST /api/v2/arbitrage/executions/:executionId/cancel
Authorization: Bearer <token>

Response:
{
  "success": true,
  "message": "Execution exec_001 cancelled successfully"
}
```

---

## 📊 Dashboard Endpoints

### Get Dashboard Summary
```typescript
GET /api/v2/dashboard/summary
Authorization: Bearer <token>

Response:
{
  "success": true,
  "summary": {
    "totalOpportunities": 127,
    "totalProfitUsd": 8450.75,
    "successfulExecutions": 45,
    "averageProfitPercentage": 2.35,
    "activeBlockchains": 20,
    "topPerformingChain": "ethereum",
    "recentExecutions": [
      {
        "id": "exec_eth_001",
        "status": "SUCCESS",
        "actualProfitUsd": 245.75,
        "actualProfitPercentage": 2.85,
        "executedAt": "2024-01-15T10:25:00Z"
      }
    ],
    "profitByChain": {
      "ethereum": 2450.50,
      "bsc": 1850.25,
      "polygon": 1200.75,
      "arbitrum": 950.25
    },
    "executionsByHour": [
      {
        "hour": "09:00",
        "executions": 5,
        "profit": 325.50
      },
      {
        "hour": "10:00",
        "executions": 8,
        "profit": 450.75
      }
    ]
  },
  "lastUpdated": "2024-01-15T10:30:00Z"
}
```

---

## 🔗 Blockchain Endpoints

### Get Blockchain Networks
```typescript
GET /api/v2/blockchain/networks
Authorization: Bearer <token>

Response:
{
  "success": true,
  "networks": [
    {
      "id": "ethereum",
      "name": "Ethereum Mainnet",
      "chainId": 1,
      "status": "online",
      "latency": 150,
      "gasPrice": "25.5",
      "supportedProtocols": ["Uniswap V3", "SushiSwap", "Balancer"],
      "tvl": "45000000000"
    },
    {
      "id": "bsc",
      "name": "BNB Smart Chain",
      "chainId": 56,
      "status": "online",
      "latency": 85,
      "gasPrice": "5.2",
      "supportedProtocols": ["PancakeSwap V3", "Biswap"],
      "tvl": "12000000000"
    }
  ]
}
```

---

## 💰 Billing Endpoints

### Get Subscription Status
```typescript
GET /api/v2/billing/subscription
Authorization: Bearer <token>

Response:
{
  "success": true,
  "subscription": {
    "id": "sub_123",
    "plan": "pro",
    "status": "active",
    "currentPeriodStart": "2024-01-01T00:00:00Z",
    "currentPeriodEnd": "2024-02-01T00:00:00Z",
    "usage": {
      "executionsUsed": 125,
      "executionsLimit": 1000,
      "chainsAccess": 20,
      "realTimeData": true
    },
    "features": [
      "multi_chain_trading",
      "real_time_data",
      "advanced_analytics",
      "priority_support"
    ]
  }
}
```

---

## 🚨 Alerts Endpoints

### Get Alerts
```typescript
GET /api/v2/alerts
Authorization: Bearer <token>
Query Parameters:
- type: "opportunity" | "execution" | "system" | "security"
- status: "active" | "resolved"
- limit: number
- offset: number

Response:
{
  "success": true,
  "alerts": [
    {
      "id": "alert_001",
      "type": "opportunity",
      "severity": "medium",
      "title": "High Profit Opportunity Detected",
      "message": "Found 5.2% profit opportunity on ETH/USDC pair",
      "data": {
        "opportunityId": "arb_eth_001",
        "profitPercentage": 5.2
      },
      "status": "active",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 1
}
```

---

## 🔧 Data Types & Models

### ArbitrageOpportunity
```typescript
interface ArbitrageOpportunity {
  id: string;
  strategy: 'triangular_arbitrage' | 'cross_dex' | 'flash_loan';
  blockchain_from: string;
  blockchain_to: string;
  token_in: string;
  token_out: string;
  amount_in: number;
  expected_amount_out: number;
  profit_amount: number;
  profit_percentage: number;
  confidence_score: number;
  gas_estimate: string;
  expires_at: string;
  dex_path: string[];
  created_at: string;
}
```

### ArbitrageExecution
```typescript
interface ArbitrageExecution {
  id: string;
  opportunityId: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  actualProfitUsd: number;
  actualProfitPercentage: number;
  executionTimeMs: number;
  gasUsed: string;
  gasPriceGwei: string;
  totalGasCost: string;
  slippageActual: number;
  transactionHash?: string;
  failureReason?: string;
  executedAt: string;
  completedAt?: string;
}
```

### AuthUser
```typescript
interface AuthUser {
  id: string;
  email: string;
  tenantId: string;
  role: 'admin' | 'trader' | 'viewer';
}
```

---

## 🌐 Supported Blockchains

ArbitrageX Supreme soporta **20 blockchains principales**:

1. **Ethereum** (ethereum)
2. **BNB Smart Chain** (bsc)  
3. **Polygon** (polygon)
4. **Arbitrum** (arbitrum)
5. **Optimism** (optimism)
6. **Avalanche** (avalanche)
7. **Base** (base)
8. **Fantom** (fantom)
9. **Gnosis Chain** (gnosis)
10. **Celo** (celo)
11. **Moonbeam** (moonbeam)
12. **Cronos** (cronos)
13. **Aurora** (aurora)
14. **Harmony** (harmony)
15. **Kava** (kava)
16. **Metis** (metis)
17. **Evmos** (evmos)
18. **Oasis** (oasis)
19. **Milkomeda** (milkomeda)
20. **Telos** (telos)

---

## ⚡ Estrategias de Arbitraje

### Estrategias Soportadas:
- **triangular_arbitrage**: Arbitraje triangular dentro de un DEX
- **cross_dex**: Arbitraje entre diferentes DEXs
- **flash_loan**: Arbitraje con préstamos flash
- **cross_chain**: Arbitraje entre diferentes blockchains

---

## 🔒 Autenticación & Seguridad

### Headers Requeridos:
```typescript
{
  "Authorization": "Bearer <jwt_token>",
  "Content-Type": "application/json",
  "X-Tenant-ID": "tenant_id" // Opcional para multi-tenancy
}
```

### Cookies (Automáticas):
- `accessToken`: JWT token (HTTP-Only)
- `refreshToken`: Refresh token (HTTP-Only)

### Permisos Disponibles:
- `arbitrage:read` - Ver oportunidades
- `arbitrage:execute` - Ejecutar arbitrajes
- `dashboard:read` - Ver dashboard  
- `billing:read` - Ver facturación
- `alerts:read` - Ver alertas
- `admin:all` - Acceso completo (solo admin)

---

## 📱 Frontend Recommendations para Lovable.dev

### Páginas Principales Sugeridas:
1. **Dashboard** - Overview completo con métricas
2. **Opportunities** - Lista de oportunidades en tiempo real
3. **Executions** - Historial de ejecuciones
4. **Networks** - Estado de blockchains
5. **Profile** - Perfil de usuario y configuración
6. **Billing** - Suscripción y facturación
7. **Alerts** - Notificaciones y alertas

### Componentes Clave:
- **OpportunityCard** - Tarjeta de oportunidad de arbitraje
- **ExecutionStatus** - Estado de ejecución en tiempo real
- **ProfitChart** - Gráfico de ganancias por hora/día
- **NetworkStatusGrid** - Grid de estado de redes
- **AlertNotification** - Componente de alertas

### Tecnologías Recomendadas:
- **React** con TypeScript
- **TailwindCSS** para estilos
- **Recharts** para gráficos
- **React Query** para data fetching
- **Zustand** para state management

---

## 🚀 URLs de Producción

- **API Base**: `https://api.arbitragexsupreme.com`
- **WebSocket**: `wss://ws.arbitragexsupreme.com`
- **Documentation**: `https://docs.arbitragexsupreme.com`

---

## 📧 Soporte y Contacto

**Desarrollador**: Hector Fabio Riascos C.  
**Empresa**: Ingenio Pichichi S.A.  
**Email**: soporte@arbitragexsupreme.com  
**Metodología**: Buenas prácticas de cosecha de caña aplicadas al desarrollo de software

---

*Esta documentación está diseñada para ser utilizada directamente en Lovable.dev para crear un frontend completo y funcional para ArbitrageX Supreme.*
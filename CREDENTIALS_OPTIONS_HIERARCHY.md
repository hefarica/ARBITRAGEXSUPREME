# ESTRUCTURA JERÁRQUICA DE CREDENCIALES Y OPCIONES DE SERVICIOS
## Ingenio Pichichi S.A. - Sistema de Trading DeFi

---

## 📊 JERARQUÍA DE SERVICIOS POR CREDENCIALES REQUERIDAS

### CATEGORÍA A: SERVICIOS SIN CREDENCIALES (ACCESO LIBRE)
```
└── DeFiLlama API
    ├── 📋 Credenciales Requeridas: NINGUNA
    ├── 🔗 Endpoint: https://api.llama.fi/
    ├── 💰 Costo: GRATUITO
    ├── 🚀 Límites: Sin restricciones estrictas
    └── 📦 Opciones Disponibles:
        ├── ✅ Acceso básico completo
        ├── ✅ Datos TVL de todos los protocolos
        ├── ✅ Históricos de yields
        └── ✅ Rankings de protocolos DeFi
```

---

### CATEGORÍA B: SERVICIOS CON API KEY GRATUITA
> **Registro requerido - Sin costo**

#### B.1 - BLOCKCHAIN EXPLORERS
```
├── Etherscan (Ethereum)
│   ├── 📋 Credenciales Requeridas:
│   │   └── 🔑 API Key (Gratuita)
│   ├── 🌐 Registro: https://etherscan.io/apis
│   ├── 💰 Opciones de Planes:
│   │   ├── 🆓 Free Plan
│   │   │   ├── Límite: 5 requests/segundo
│   │   │   ├── Rate limit: 100,000 requests/día
│   │   │   └── Funciones: Básicas completas
│   │   ├── 💎 Developer Plan ($99/mes)
│   │   │   ├── Límite: 25 requests/segundo  
│   │   │   ├── Rate limit: 500,000 requests/día
│   │   │   └── Funciones: API premium + soporte
│   │   └── 🏢 Enterprise Plan ($499/mes)
│   │       ├── Límite: 100 requests/segundo
│   │       ├── Rate limit: Ilimitadas
│   │       └── Funciones: Acceso completo + SLA
│   └── 🔧 Implementación:
│       ├── Variable: ETHERSCAN_API_KEY
│       └── Uso: MetaMaskService.ts, transacciones Ethereum
│
├── BSCScan (Binance Smart Chain)
│   ├── 📋 Credenciales Requeridas:
│   │   └── 🔑 API Key (Gratuita)
│   ├── 🌐 Registro: https://bscscan.com/apis
│   ├── 💰 Opciones de Planes:
│   │   ├── 🆓 Free Plan
│   │   │   ├── Límite: 5 requests/segundo
│   │   │   └── Rate limit: 100,000 requests/día
│   │   └── 💎 Pro Plans (Similares a Etherscan)
│   └── 🔧 Implementación:
│       ├── Variable: BSCSCAN_API_KEY
│       └── Uso: Multi-chain support BSC
│
├── Polygonscan (Polygon)
│   ├── 📋 Credenciales Requeridas:
│   │   └── 🔑 API Key (Gratuita)
│   ├── 🌐 Registro: https://polygonscan.com/apis
│   ├── 💰 Opciones: Similares estructura Etherscan
│   └── 🔧 Implementación:
│       ├── Variable: POLYGONSCAN_API_KEY
│       └── Uso: Transacciones Polygon network
│
├── Arbiscan (Arbitrum)
│   ├── 📋 Credenciales Requeridas:
│   │   └── 🔑 API Key (Gratuita)
│   ├── 🌐 Registro: https://arbiscan.io/apis
│   ├── 💰 Opciones: Similares estructura Etherscan
│   └── 🔧 Implementación:
│       ├── Variable: ARBISCAN_API_KEY
│       └── Uso: Transacciones Arbitrum network
│
└── Optimistic Etherscan (Optimism)
    ├── 📋 Credenciales Requeridas:
    │   └── 🔑 API Key (Gratuita)
    ├── 🌐 Registro: https://optimistic.etherscan.io/apis
    ├── 💰 Opciones: Similares estructura Etherscan
    └── 🔧 Implementación:
        ├── Variable: OPTIMISM_API_KEY
        └── Uso: Transacciones Optimism network
```

#### B.2 - TRADING Y DEX AGGREGATION
```
└── 1inch API
    ├── 📋 Credenciales Requeridas:
    │   └── 🔑 API Key (Gratuita con registro)
    ├── 🌐 Registro: https://portal.1inch.dev/
    ├── 💰 Opciones de Planes:
    │   ├── 🆓 Free Tier
    │   │   ├── Límite: 100 requests/minuto
    │   │   ├── Rate limit: 1,000 requests/día
    │   │   ├── Networks: Ethereum, BSC, Polygon
    │   │   └── Funciones: Agregación básica, quotes, swaps
    │   ├── 💎 Growth Plan ($99/mes)
    │   │   ├── Límite: 1,000 requests/minuto
    │   │   ├── Rate limit: 50,000 requests/día
    │   │   ├── Networks: Todas las redes soportadas
    │   │   └── Funciones: APIs avanzadas + analytics
    │   ├── 🏢 Pro Plan ($499/mes)
    │   │   ├── Límite: 5,000 requests/minuto
    │   │   ├── Rate limit: 500,000 requests/día
    │   │   └── Funciones: Acceso completo + webhooks
    │   └── 🚀 Enterprise (Precio custom)
    │       ├── Límites: Personalizados
    │       ├── SLA: Garantizado
    │       └── Soporte: Dedicado
    └── 🔧 Implementación:
        ├── Variable: ONEINCH_API_KEY
        ├── Uso: BacktestingService.ts, mejores precios
        └── Redes: Ethereum, BSC, Polygon, Arbitrum, Optimism
```

---

### CATEGORÍA C: SERVICIOS PREMIUM CON MÚLTIPLES TIERS
> **Planes pagos con características escalables**

#### C.1 - DATOS DE PRECIOS Y MARKET DATA
```
└── CoinGecko API
    ├── 📋 Credenciales Requeridas:
    │   └── 🔑 API Key (Según plan)
    ├── 🌐 Registro: https://www.coingecko.com/api/pricing
    ├── 💰 Jerarquía de Opciones:
    │   ├── 🆓 Demo Plan (GRATUITO)
    │   │   ├── 📊 Límites:
    │   │   │   ├── 30 requests/minuto
    │   │   │   ├── 10,000 requests/mes
    │   │   │   └── Rate limiting estricto
    │   │   ├── 🔧 Funciones:
    │   │   │   ├── ✅ Precios actuales básicos
    │   │   │   ├── ✅ Lista de monedas
    │   │   │   ├── ❌ Datos históricos limitados
    │   │   │   └── ❌ Market cap histórico
    │   │   └── 🎯 Recomendado: Solo testing inicial
    │   │
    │   ├── 💎 Analyst Plan ($199/mes)
    │   │   ├── 📊 Límites:
    │   │   │   ├── 500 requests/minuto
    │   │   │   ├── 100,000 requests/mes
    │   │   │   └── Burst capacity: 1000 req/min
    │   │   ├── 🔧 Funciones:
    │   │   │   ├── ✅ Datos históricos completos (365 días)
    │   │   │   ├── ✅ OHLCV data
    │   │   │   ├── ✅ Market cap histórico
    │   │   │   ├── ✅ Volume data
    │   │   │   └── ✅ Trending coins
    │   │   └── 🎯 Recomendado: Aplicaciones profesionales
    │   │
    │   ├── 🏢 Lite Plan ($499/mes)
    │   │   ├── 📊 Límites:
    │   │   │   ├── 1,000 requests/minuto
    │   │   │   ├── 500,000 requests/mes
    │   │   │   └── Priority queue access
    │   │   ├── 🔧 Funciones adicionales:
    │   │   │   ├── ✅ Todo de Analyst +
    │   │   │   ├── ✅ NFT data
    │   │   │   ├── ✅ DeFi protocols data
    │   │   │   ├── ✅ Exchange tickers
    │   │   │   └── ✅ Global market data
    │   │   └── 🎯 Recomendado: Empresas medianas
    │   │
    │   └── 🚀 Pro Plan ($1,999/mes)
    │       ├── 📊 Límites:
    │       │   ├── 10,000 requests/minuto
    │       │   ├── 3,000,000 requests/mes
    │       │   └── Dedicated infrastructure
    │       ├── 🔧 Funciones premium:
    │       │   ├── ✅ Todo de Lite +
    │       │   ├── ✅ Real-time WebSocket feeds
    │       │   ├── ✅ Custom endpoints
    │       │   ├── ✅ White-label solutions
    │       │   └── ✅ 24/7 dedicated support
    │       └── 🎯 Recomendado: Exchanges, institucionales
    │
    └── 🔧 Implementación:
        ├── Variable: COINGECKO_API_KEY
        ├── Uso: PriceService.ts (reemplaza mock data)
        ├── Endpoints críticos:
        │   ├── /simple/price (precios actuales)
        │   ├── /coins/{id}/history (históricos)
        │   ├── /coins/{id}/market_chart (charts)
        │   └── /exchanges/tickers (liquidity data)
        └── 🎯 Plan Recomendado: Analyst ($199/mes)
```

#### C.2 - INFRAESTRUCTURA BLOCKCHAIN
```
├── Alchemy
│   ├── 📋 Credenciales Requeridas:
│   │   ├── 🔑 API Key
│   │   └── 🆔 Project ID
│   ├── 🌐 Registro: https://dashboard.alchemy.com/
│   ├── 💰 Jerarquía de Opciones:
│   │   ├── 🆓 Free Plan
│   │   │   ├── 📊 Límites:
│   │   │   │   ├── 300 Compute Units/segundo
│   │   │   │   ├── 300M Compute Units/mes
│   │   │   │   └── 5 apps máximo
│   │   │   ├── 🌐 Networks:
│   │   │   │   ├── ✅ Ethereum (Mainnet + Testnets)
│   │   │   │   ├── ✅ Polygon (Mainnet + Testnets)
│   │   │   │   ├── ✅ Arbitrum (Mainnet + Testnets)
│   │   │   │   └── ✅ Optimism (Mainnet + Testnets)
│   │   │   └── 🔧 Funciones:
│   │   │       ├── ✅ JSON-RPC endpoints
│   │   │       ├── ✅ WebSocket support
│   │   │       ├── ❌ Enhanced APIs
│   │   │       └── ❌ Notify webhooks
│   │   │
│   │   ├── 💎 Growth Plan ($199/mes)
│   │   │   ├── 📊 Límites:
│   │   │   │   ├── 1,500 Compute Units/segundo
│   │   │   │   ├── 1.5B Compute Units/mes
│   │   │   │   └── Apps ilimitadas
│   │   │   ├── 🔧 Funciones adicionales:
│   │   │   │   ├── ✅ Todo de Free +
│   │   │   │   ├── ✅ Enhanced APIs (getNFTs, getTransfers)
│   │   │   │   ├── ✅ Notify webhooks (10 webhooks)
│   │   │   │   ├── ✅ Archive data access
│   │   │   │   └── ✅ Priority support
│   │   │   └── 🎯 Recomendado: Aplicaciones en producción
│   │   │
│   │   ├── 🏢 Scale Plan ($499/mes)
│   │   │   ├── 📊 Límites:
│   │   │   │   ├── 4,000 Compute Units/segundo
│   │   │   │   ├── 4B Compute Units/mes
│   │   │   │   └── Burst capacity disponible
│   │   │   ├── 🔧 Funciones premium:
│   │   │   │   ├── ✅ Todo de Growth +
│   │   │   │   ├── ✅ 100 Notify webhooks
│   │   │   │   ├── ✅ Custom retention policies
│   │   │   │   ├── ✅ Advanced analytics
│   │   │   │   └── ✅ Dedicated account manager
│   │   │   └── 🎯 Recomendado: Empresas establecidas
│   │   │
│   │   └── 🚀 Enterprise (Precio custom)
│   │       ├── 📊 Límites: Personalizados según necesidades
│   │       ├── 🔧 Funciones enterprise:
│   │       │   ├── ✅ SLA garantizado
│   │       │   ├── ✅ Dedicated infrastructure
│   │       │   ├── ✅ Custom integrations
│   │       │   ├── ✅ White-glove onboarding
│   │       │   └── ✅ 24/7 phone support
│   │       └── 🎯 Recomendado: Institucionales, exchanges
│   │
│   └── 🔧 Implementación:
│       ├── Variables:
│       │   ├── ALCHEMY_API_KEY
│       │   └── ALCHEMY_PROJECT_ID
│       ├── Uso: MetaMaskService.ts, multi-chain support
│       └── 🎯 Plan Recomendado: Growth ($199/mes)
│
└── Infura (Alternativa a Alchemy)
    ├── 📋 Credenciales Requeridas:
    │   ├── 🆔 Project ID
    │   └── 🔐 API Secret
    ├── 🌐 Registro: https://infura.io/
    ├── 💰 Jerarquía de Opciones:
    │   ├── 🆓 Core Plan (GRATUITO)
    │   │   ├── 📊 Límites:
    │   │   │   ├── 100,000 requests/día
    │   │   │   ├── 10 requests/segundo
    │   │   │   └── 3 proyectos máximo
    │   │   ├── 🌐 Networks: Ethereum, Polygon, IPFS
    │   │   └── 🔧 Funciones básicas completas
    │   │
    │   ├── 💎 Developer Plan ($50/mes)
    │   │   ├── 📊 Límites:
    │   │   │   ├── 300,000 requests/día
    │   │   │   ├── 50 requests/segundo
    │   │   │   └── 10 proyectos máximo
    │   │   ├── 🌐 Networks: +Arbitrum, Optimism
    │   │   └── 🔧 Funciones: +Analytics dashboard
    │   │
    │   ├── 🏢 Team Plan ($225/mes)
    │   │   ├── 📊 Límites:
    │   │   │   ├── 1M requests/día
    │   │   │   ├── 200 requests/segundo
    │   │   │   └── 50 proyectos máximo
    │   │   └── 🔧 Funciones: +Team collaboration
    │   │
    │   └── 🚀 Growth Plan ($1,000/mes)
    │       ├── 📊 Límites: 10M requests/día
    │       ├── 🔧 Funciones premium completas
    │       └── 🎯 Recomendado: Aplicaciones enterprise
    │
    └── 🔧 Implementación:
        ├── Variables:
        │   ├── INFURA_PROJECT_ID
        │   └── INFURA_API_SECRET
        ├── Uso: Alternativa más económica a Alchemy
        └── 🎯 Plan Recomendado: Developer ($50/mes)
```

#### C.3 - TIEMPO REAL Y WEBSOCKETS
```
└── Pusher (WebSocket Service)
    ├── 📋 Credenciales Requeridas:
    │   ├── 🆔 App ID
    │   ├── 🔑 Key (Pública)
    │   ├── 🔐 Secret (Privada)
    │   └── 🌍 Cluster
    ├── 🌐 Registro: https://pusher.com/
    ├── 💰 Jerarquía de Opciones:
    │   ├── 🆓 Channels Sandbox (GRATUITO)
    │   │   ├── 📊 Límites:
    │   │   │   ├── 100 conexiones concurrentes
    │   │   │   ├── 200,000 mensajes/día
    │   │   │   └── SSL habilitado
    │   │   ├── 🔧 Funciones:
    │   │   │   ├── ✅ Real-time messaging
    │   │   │   ├── ✅ Public/Private channels
    │   │   │   ├── ✅ Presence channels
    │   │   │   └── ✅ Client events
    │   │   └── 🎯 Recomendado: Desarrollo y testing
    │   │
    │   ├── 💎 Pro Plan ($49/mes)
    │   │   ├── 📊 Límites:
    │   │   │   ├── 500 conexiones concurrentes
    │   │   │   ├── 1M mensajes/día
    │   │   │   ├── Unlimited channels
    │   │   │   └── Message batching
    │   │   ├── 🔧 Funciones adicionales:
    │   │   │   ├── ✅ Todo de Sandbox +
    │   │   │   ├── ✅ Webhooks
    │   │   │   ├── ✅ Message history
    │   │   │   ├── ✅ Analytics dashboard
    │   │   │   └── ✅ Email support
    │   │   └── 🎯 Recomendado: Aplicaciones pequeñas-medianas
    │   │
    │   ├── 🏢 Startup Plan ($99/mes)
    │   │   ├── 📊 Límites:
    │   │   │   ├── 2,000 conexiones concurrentes
    │   │   │   ├── 5M mensajes/día
    │   │   │   └── Advanced security features
    │   │   ├── 🔧 Funciones premium:
    │   │   │   ├── ✅ Todo de Pro +
    │   │   │   ├── ✅ Advanced analytics
    │   │   │   ├── ✅ Custom domains
    │   │   │   ├── ✅ Priority support
    │   │   │   └── ✅ Higher throughput
    │   │   └── 🎯 Recomendado: Aplicaciones en crecimiento
    │   │
    │   └── 🚀 Business Plan ($299/mes)
    │       ├── 📊 Límites:
    │       │   ├── 10,000 conexiones concurrentes
    │       │   ├── 25M mensajes/día
    │       │   └── Enterprise security
    │       ├── 🔧 Funciones enterprise:
    │       │   ├── ✅ Todo de Startup +
    │       │   ├── ✅ Dedicated clusters available
    │       │   ├── ✅ Advanced integrations
    │       │   ├── ✅ Phone support
    │       │   └── ✅ Custom SLA options
    │       └── 🎯 Recomendado: Aplicaciones enterprise
    │
    └── 🔧 Implementación:
        ├── Variables:
        │   ├── PUSHER_APP_ID=your_app_id
        │   ├── PUSHER_KEY=your_key  
        │   ├── PUSHER_SECRET=your_secret
        │   └── PUSHER_CLUSTER=us2 (ejemplo)
        ├── Uso: WebSocketService.ts (reemplaza mock)
        └── 🎯 Plan Recomendado: Pro ($49/mes)
```

---

### CATEGORÍA D: SERVICIOS ENTERPRISE Y ANALYTICS
> **Soluciones profesionales para análisis avanzado**

#### D.1 - ANÁLISIS BLOCKCHAIN PROFESIONAL
```
├── Dune Analytics
│   ├── 📋 Credenciales Requeridas:
│   │   └── 🔑 API Key (Bearer token)
│   ├── 🌐 Registro: https://dune.com/pricing
│   ├── 💰 Jerarquía de Opciones:
│   │   ├── 🆓 Free Plan
│   │   │   ├── 📊 Límites:
│   │   │   │   ├── Query executions: Limitadas
│   │   │   │   ├── Data export: Solo CSV pequeños
│   │   │   │   └── API access: ❌ No disponible
│   │   │   ├── 🔧 Funciones:
│   │   │   │   ├── ✅ Dashboard viewing
│   │   │   │   ├── ✅ Public query forking
│   │   │   │   └── ❌ API programático
│   │   │   └── 🎯 Limitado para desarrollo
│   │   │
│   │   ├── 💎 Plus Plan ($390/mes)
│   │   │   ├── 📊 Límites:
│   │   │   │   ├── 1,000 query executions/mes
│   │   │   │   ├── 10GB data download/mes
│   │   │   │   ├── 15 minutos query timeout
│   │   │   │   └── 3 refresh requests/hora por query
│   │   │   ├── 🔧 Funciones:
│   │   │   │   ├── ✅ API Access completo
│   │   │   │   ├── ✅ Private dashboards
│   │   │   │   ├── ✅ Advanced visualizations
│   │   │   │   ├── ✅ Data exports (CSV, JSON)
│   │   │   │   └── ✅ Email support
│   │   │   └── 🎯 Recomendado: Análisis profesional
│   │   │
│   │   ├── 🏢 Premium Plan ($790/mes)
│   │   │   ├── 📊 Límites:
│   │   │   │   ├── 5,000 query executions/mes
│   │   │   │   ├── 100GB data download/mes
│   │   │   │   ├── 30 minutos query timeout
│   │   │   │   └── 10 refresh requests/hora
│   │   │   ├── 🔧 Funciones adicionales:
│   │   │   │   ├── ✅ Todo de Plus +
│   │   │   │   ├── ✅ Priority query processing
│   │   │   │   ├── ✅ Advanced team collaboration
│   │   │   │   ├── ✅ Custom data retention
│   │   │   │   └── ✅ Priority support
│   │   │   └── 🎯 Recomendado: Equipos medianos
│   │   │
│   │   └── 🚀 Enterprise (Precio custom)
│   │       ├── 📊 Límites: Personalizados
│   │       ├── 🔧 Funciones enterprise:
│   │       │   ├── ✅ Unlimited executions
│   │       │   ├── ✅ Dedicated infrastructure
│   │       │   ├── ✅ Custom integrations
│   │       │   ├── ✅ SSO/SAML
│   │       │   ├── ✅ Advanced security
│   │       │   └── ✅ Dedicated success manager
│   │       └── 🎯 Recomendado: Institucionales
│   │
│   └── 🔧 Implementación:
│       ├── Variable: DUNE_API_KEY
│       ├── Headers: "X-Dune-API-Key: bearer_token"
│       ├── Uso: Análisis on-chain personalizado
│       ├── Endpoints críticos:
│       │   ├── POST /api/v1/query/{id}/execute
│       │   ├── GET /api/v1/execution/{id}/status  
│       │   ├── GET /api/v1/execution/{id}/results
│       │   └── GET /api/v1/query/{id}/results
│       └── 🎯 Plan Recomendado: Plus ($390/mes)
│
└── Nansen
    ├── 📋 Credenciales Requeridas:
    │   └── 🔑 API Key (X-API-KEY header)
    ├── 🌐 Registro: https://pro.nansen.ai/
    ├── 💰 Jerarquía de Opciones:
    │   ├── 💎 Alpha Plan ($150/mes)
    │   │   ├── 📊 Límites:
    │   │   │   ├── 1,000 API requests/mes
    │   │   │   ├── Rate limit: 5 requests/segundo
    │   │   │   └── Data refresh: Cada 24 horas
    │   │   ├── 🔧 Funciones:
    │   │   │   ├── ✅ Wallet labels básicas
    │   │   │   ├── ✅ Token flows
    │   │   │   ├── ✅ Smart money tracking
    │   │   │   ├── ✅ Hot contracts
    │   │   │   └── ❌ Real-time alerts
    │   │   └── 🎯 Recomendado: Traders individuales
    │   │
    │   ├── 🏢 Pro Plan ($500/mes)
    │   │   ├── 📊 Límites:
    │   │   │   ├── 10,000 API requests/mes
    │   │   │   ├── Rate limit: 20 requests/segundo
    │   │   │   └── Data refresh: Cada 4 horas
    │   │   ├── 🔧 Funciones adicionales:
    │   │   │   ├── ✅ Todo de Alpha +
    │   │   │   ├── ✅ Real-time alerts
    │   │   │   ├── ✅ Advanced analytics
    │   │   │   ├── ✅ Portfolio tracking
    │   │   │   ├── ✅ Custom dashboards
    │   │   │   └── ✅ Historical data (1 año)
    │   │   └── 🎯 Recomendado: Trading profesional
    │   │
    │   └── 🚀 Enterprise (Precio custom)
    │       ├── 📊 Límites: Unlimited requests
    │       ├── 🔧 Funciones enterprise:
    │       │   ├── ✅ Real-time data feeds
    │       │   ├── ✅ Custom label creation
    │       │   ├── ✅ Bulk data exports
    │       │   ├── ✅ Dedicated infrastructure
    │       │   ├── ✅ Custom integrations
    │       │   └── ✅ 24/7 support
    │       └── 🎯 Recomendado: Instituciones, funds
    │
    └── 🔧 Implementación:
        ├── Variable: NANSEN_API_KEY
        ├── Headers: "X-API-KEY: your_api_key"
        ├── Uso: Market intelligence premium
        ├── Endpoints críticos:
        │   ├── GET /api/v1/wallets/{address}/labels
        │   ├── GET /api/v1/tokens/{address}/smart-money
        │   ├── GET /api/v1/contracts/hot
        │   └── GET /api/v1/tokens/{address}/flows
        └── 🎯 Plan Recomendado: Alpha ($150/mes)
```

---

## 📋 CHECKLIST DE REGISTRO Y CONFIGURACIÓN

### FASE 1: SERVICIOS GRATUITOS (0-2 horas)
```
□ 1. DeFiLlama API
  └── ✅ No requiere registro
  └── ✅ Acceso inmediato

□ 2. Blockchain Explorers (APIs gratuitas)
  ├── □ Etherscan: Registrarse en https://etherscan.io/apis
  ├── □ BSCScan: Registrarse en https://bscscan.com/apis
  ├── □ Polygonscan: Registrarse en https://polygonscan.com/apis
  ├── □ Arbiscan: Registrarse en https://arbiscan.io/apis
  └── □ Optimistic: Registrarse en https://optimistic.etherscan.io/apis

□ 3. 1inch API
  ├── □ Registrarse en https://portal.1inch.dev/
  ├── □ Obtener API Key gratuita
  └── □ Documentar límites: 100 req/min, 1000 req/día
```

### FASE 2: SERVICIOS BÁSICOS PREMIUM (2-4 horas)
```
□ 4. Infura (Opción económica)
  ├── □ Registrarse en https://infura.io/
  ├── □ Crear proyecto nuevo
  ├── □ Seleccionar Developer Plan ($50/mes)
  ├── □ Obtener Project ID y API Secret
  └── □ Configurar networks: Ethereum, Polygon, Arbitrum, Optimism

□ 5. Pusher WebSocket
  ├── □ Registrarse en https://pusher.com/
  ├── □ Crear nueva app
  ├── □ Seleccionar Pro Plan ($49/mes)
  ├── □ Obtener credenciales:
  │   ├── □ App ID
  │   ├── □ Key (pública)
  │   ├── □ Secret (privada)
  │   └── □ Cluster (región)
  └── □ Configurar channels para precio updates
```

### FASE 3: SERVICIOS PROFESIONALES (4-8 horas)
```
□ 6. CoinGecko Pro
  ├── □ Registrarse en https://www.coingecko.com/api/pricing
  ├── □ Seleccionar Analyst Plan ($199/mes)
  ├── □ Obtener API Key
  ├── □ Documentar límites: 500 req/min, 100K req/mes
  └── □ Probar endpoints críticos

□ 7. Alchemy (Alternativa premium a Infura)
  ├── □ Registrarse en https://dashboard.alchemy.com/
  ├── □ Crear nuevo proyecto
  ├── □ Seleccionar Growth Plan ($199/mes)
  ├── □ Obtener API Key y Project ID para cada red:
  │   ├── □ Ethereum Mainnet
  │   ├── □ Polygon Mainnet
  │   ├── □ Arbitrum Mainnet
  │   └── □ Optimism Mainnet
  └── □ Configurar webhooks si necesario
```

### FASE 4: SERVICIOS ENTERPRISE (8+ horas)
```
□ 8. Dune Analytics
  ├── □ Registrarse en https://dune.com/pricing
  ├── □ Seleccionar Plus Plan ($390/mes)
  ├── □ Obtener API Key (Bearer token)
  ├── □ Configurar queries personalizados
  └── □ Probar endpoints de ejecución

□ 9. Nansen
  ├── □ Registrarse en https://pro.nansen.ai/
  ├── □ Seleccionar Alpha Plan ($150/mes)
  ├── □ Obtener API Key
  ├── □ Configurar X-API-KEY headers
  └── □ Probar smart money endpoints
```

---

## 💰 RESUMEN DE COSTOS POR CONFIGURACIÓN

### CONFIGURACIÓN MÍNIMA FUNCIONAL ($0/mes)
```
✅ Servicios incluidos:
├── DeFiLlama API (Gratuito)
├── Etherscan APIs (Gratuito - todos)
├── 1inch API Free Tier (Gratuito)
└── Total mensual: $0

🎯 Funcionalidad desbloqueada:
├── ✅ Datos DeFi básicos reales
├── ✅ Transacciones blockchain verificadas
├── ✅ Trading con agregación básica
└── ❌ Sin tiempo real, datos limitados
```

### CONFIGURACIÓN PROFESIONAL BÁSICA ($99/mes)
```
✅ Servicios incluidos:
├── Todo de Configuración Mínima ($0)
├── Infura Developer ($50/mes)  
├── Pusher Pro ($49/mes)
└── Total mensual: $99

🎯 Funcionalidad desbloqueada:
├── ✅ Infraestructura blockchain estable
├── ✅ WebSocket real-time updates
├── ✅ Multi-chain support optimizado
└── ✅ Experiencia de usuario mejorada
```

### CONFIGURACIÓN PROFESIONAL COMPLETA ($348/mes)
```
✅ Servicios incluidos:
├── Todo de Configuración Básica ($99)
├── CoinGecko Analyst ($199/mes)
├── Alchemy Growth upgrade (+$149/mes vs Infura)
└── Total mensual: $348

🎯 Funcionalidad desbloqueada:
├── ✅ Datos de precios premium completos
├── ✅ Infraestructura enterprise-grade
├── ✅ Históricos completos y analytics
└── ✅ Backtesting con datos reales precisos
```

### CONFIGURACIÓN ENTERPRISE ($888/mes)
```
✅ Servicios incluidos:
├── Todo de Configuración Completa ($348)
├── Dune Analytics Plus ($390/mes)
├── Nansen Alpha ($150/mes)
└── Total mensual: $888

🎯 Funcionalidad desbloqueada:
├── ✅ Análisis on-chain personalizado
├── ✅ Smart money tracking
├── ✅ Market intelligence avanzada
└── ✅ Dashboards profesionales custom
```

---

## 🔧 VARIABLES DE ENTORNO REQUERIDAS

### Archivo .dev.vars (Desarrollo Local)
```bash
# === SERVICIOS GRATUITOS ===
# 1inch API
ONEINCH_API_KEY=your_1inch_api_key_here

# Blockchain Explorers
ETHERSCAN_API_KEY=your_etherscan_api_key_here
BSCSCAN_API_KEY=your_bscscan_api_key_here  
POLYGONSCAN_API_KEY=your_polygonscan_api_key_here
ARBISCAN_API_KEY=your_arbiscan_api_key_here
OPTIMISM_API_KEY=your_optimism_api_key_here

# === SERVICIOS PREMIUM NIVEL 2 ===
# Infura (Opción económica)
INFURA_PROJECT_ID=your_infura_project_id_here
INFURA_API_SECRET=your_infura_api_secret_here

# O Alchemy (Opción premium)
ALCHEMY_API_KEY=your_alchemy_api_key_here
ALCHEMY_PROJECT_ID=your_alchemy_project_id_here

# Pusher WebSocket
PUSHER_APP_ID=your_pusher_app_id_here
PUSHER_KEY=your_pusher_key_here
PUSHER_SECRET=your_pusher_secret_here
PUSHER_CLUSTER=us2

# === SERVICIOS PREMIUM NIVEL 3 ===
# CoinGecko Pro
COINGECKO_API_KEY=your_coingecko_pro_api_key_here

# === SERVICIOS ENTERPRISE ===
# Dune Analytics
DUNE_API_KEY=your_dune_bearer_token_here

# Nansen
NANSEN_API_KEY=your_nansen_api_key_here
```

### Comandos Cloudflare Secrets (Producción)
```bash
# Gratuitos
npx wrangler pages secret put ONEINCH_API_KEY --project-name webapp
npx wrangler pages secret put ETHERSCAN_API_KEY --project-name webapp
npx wrangler pages secret put BSCSCAN_API_KEY --project-name webapp
npx wrangler pages secret put POLYGONSCAN_API_KEY --project-name webapp
npx wrangler pages secret put ARBISCAN_API_KEY --project-name webapp
npx wrangler pages secret put OPTIMISM_API_KEY --project-name webapp

# Premium Básicos
npx wrangler pages secret put INFURA_PROJECT_ID --project-name webapp
npx wrangler pages secret put INFURA_API_SECRET --project-name webapp
npx wrangler pages secret put PUSHER_APP_ID --project-name webapp
npx wrangler pages secret put PUSHER_KEY --project-name webapp
npx wrangler pages secret put PUSHER_SECRET --project-name webapp
npx wrangler pages secret put PUSHER_CLUSTER --project-name webapp

# Premium Avanzados  
npx wrangler pages secret put COINGECKO_API_KEY --project-name webapp
npx wrangler pages secret put ALCHEMY_API_KEY --project-name webapp

# Enterprise
npx wrangler pages secret put DUNE_API_KEY --project-name webapp
npx wrangler pages secret put NANSEN_API_KEY --project-name webapp
```

---

**Elaborado por:** Sistema de Gestión Ingenio Pichichi S.A.  
**Fecha:** 11 de Septiembre, 2025  
**Versión:** 2.0 - Jerarquía Detallada de Credenciales y Opciones
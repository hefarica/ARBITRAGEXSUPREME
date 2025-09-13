# ESTRUCTURA JERÁRQUICA DE SERVICIOS
## Ingenio Pichichi S.A. - Sistema de Trading DeFi

### 📊 CLASIFICACIÓN POR NIVELES DE SERVICIO

## NIVEL 1: SERVICIOS CRÍTICOS (ESENCIALES)
> **Prioridad Máxima** - Funcionalidad básica del sistema

### 1.1 DATOS DE PRECIOS Y TRADING
```
├── CoinGecko Pro API
│   ├── Funcionalidad: Precios en tiempo real, datos históricos
│   ├── Plan Requerido: Pro ($199/mes)
│   ├── Límites: 10,000 requests/mes
│   ├── Credenciales: API Key
│   └── Implementación: Reemplaza mock en PriceService.ts
│
├── 1inch API
│   ├── Funcionalidad: Agregación de DEX, mejores precios
│   ├── Plan Requerido: Gratuito (límites básicos)
│   ├── Límites: 100 requests/minuto
│   ├── Credenciales: API Key gratuita
│   └── Implementación: Reemplaza simulación en BacktestingService.ts
```

### 1.2 BLOCKCHAIN INFRASTRUCTURE
```
├── Etherscan API
│   ├── Funcionalidad: Datos de transacciones Ethereum
│   ├── Plan Requerido: Gratuito
│   ├── Límites: 5 requests/segundo
│   ├── Credenciales: API Key gratuita
│   └── Implementación: MetaMaskService.ts extensiones
│
├── BSCScan API
│   ├── Funcionalidad: Datos de Binance Smart Chain
│   ├── Plan Requerido: Gratuito
│   ├── Límites: 5 requests/segundo
│   ├── Credenciales: API Key gratuita
│   └── Implementación: Multi-chain support
```

---

## NIVEL 2: SERVICIOS IMPORTANTES (MEJORA SIGNIFICATIVA)
> **Alta Prioridad** - Mejora experiencia usuario y funcionalidad

### 2.1 TIEMPO REAL Y COMUNICACIÓN
```
├── Pusher (WebSocket Real)
│   ├── Funcionalidad: WebSocket real-time updates
│   ├── Plan Requerido: Sandbox ($49/mes)
│   ├── Límites: 100 conexiones concurrentes
│   ├── Credenciales: App ID, Key, Secret, Cluster
│   ├── Implementación: Reemplaza WebSocketService.ts simulado
│   └── Ventajas: 
│       ├── Actualizaciones instantáneas de precios
│       ├── Notificaciones push
│       └── Estado de conexión real
```

### 2.2 ANÁLISIS DEFI AVANZADO
```
├── DeFiLlama API
│   ├── Funcionalidad: TVL, protocolos DeFi, rendimientos
│   ├── Plan Requerido: Gratuito
│   ├── Límites: Sin límites estrictos
│   ├── Credenciales: No requiere API key
│   ├── Implementación: Nueva funcionalidad en DashboardService.ts
│   └── Datos Proporcionados:
│       ├── Total Value Locked (TVL)
│       ├── APY de protocolos
│       ├── Volúmenes de trading
│       └── Rankings de protocolos
```

### 2.3 INFRAESTRUCTURA BLOCKCHAIN PREMIUM
```
├── Alchemy API
│   ├── Funcionalidad: Nodos optimizados, webhooks
│   ├── Plan Requerido: Growth ($199/mes)
│   ├── Límites: 300M compute units/mes
│   ├── Credenciales: API Key, Project ID
│   └── Redes: Ethereum, Polygon, Arbitrum, Optimism
│
├── Infura API (Alternativa)
│   ├── Funcionalidad: Acceso a redes blockchain
│   ├── Plan Requerido: Core ($50/mes)
│   ├── Límites: 100K requests/día
│   ├── Credenciales: Project ID, API Secret
│   └── Redes: Ethereum, Polygon, Arbitrum, Optimism
```

---

## NIVEL 3: SERVICIOS AVANZADOS (CARACTERÍSTICAS PREMIUM)
> **Prioridad Media** - Funcionalidades de análisis profesional

### 3.1 ANÁLISIS DE DATOS PROFESIONAL
```
├── Dune Analytics API
│   ├── Funcionalidad: Queries SQL personalizados, dashboards
│   ├── Plan Requerido: Plus ($390/mes)
│   ├── Límites: 1000 query executions/mes
│   ├── Credenciales: API Key
│   ├── Implementación: Nueva sección analytics
│   └── Capacidades:
│       ├── Análisis on-chain personalizado
│       ├── Métricas de protocolos DeFi
│       ├── Tracking de whale movements
│       └── Análisis de flujos de capital
```

### 3.2 INTELIGENCIA DE MERCADO
```
├── Nansen API
│   ├── Funcionalidad: Análisis de wallet, labels, flows
│   ├── Plan Requerido: Alpha ($150/mes)
│   ├── Límites: Según plan
│   ├── Credenciales: API Key
│   ├── Implementación: Nueva funcionalidad premium
│   └── Insights:
│       ├── Smart Money tracking
│       ├── Token flows analysis
│       ├── Wallet labeling
│       └── Market intelligence
```

---

## 💰 ESTRUCTURA DE COSTOS POR IMPLEMENTACIÓN

### OPCIÓN A: IMPLEMENTACIÓN BÁSICA ($0/mes)
```
Servicios Incluidos:
├── 1inch API (Gratuito)
├── Etherscan APIs (Gratuito)  
├── BSCScan API (Gratuito)
├── DeFiLlama API (Gratuito)
└── Total: $0/mes

Funcionalidad Desbloqueada:
├── ✅ Trading real con mejores precios
├── ✅ Datos de blockchain verificados
├── ✅ Análisis básico de protocolos DeFi
└── ✅ Backtesting con datos reales limitados
```

### OPCIÓN B: IMPLEMENTACIÓN PROFESIONAL ($298/mes)
```
Servicios Incluidos:
├── Todo de Opción A ($0)
├── CoinGecko Pro ($199/mes)
├── Pusher Sandbox ($49/mes)
├── Infura Core ($50/mes)
└── Total: $298/mes

Funcionalidad Desbloqueada:
├── ✅ Precios en tiempo real premium
├── ✅ WebSocket real para actualizaciones
├── ✅ Infraestructura blockchain optimizada
├── ✅ Datos históricos completos
└── ✅ Backtesting con precisión profesional
```

### OPCIÓN C: IMPLEMENTACIÓN ENTERPRISE ($788/mes)
```
Servicios Incluidos:
├── Todo de Opción B ($298)
├── Dune Analytics Plus ($390/mes)
├── Alchemy Growth ($199/mes - upgrade)
├── Nansen Alpha ($150/mes)
├── Menos Infura (-$50/mes)
└── Total: $787/mes

Funcionalidad Desbloqueada:
├── ✅ Análisis on-chain personalizado
├── ✅ Inteligencia de mercado avanzada  
├── ✅ Infraestructura enterprise
├── ✅ Smart money tracking
└── ✅ Dashboards profesionales personalizados
```

---

## 🔧 IMPLEMENTACIÓN TÉCNICA POR FASES

### FASE 1: SERVICIOS CRÍTICOS (Semana 1-2)
```
Orden de Implementación:
1. ├── Configurar 1inch API en BacktestingService.ts
2. ├── Integrar Etherscan APIs en MetaMaskService.ts
3. ├── Implementar DeFiLlama en DashboardService.ts
4. └── Testing y validación de datos reales
```

### FASE 2: SERVICIOS IMPORTANTES (Semana 3-4)
```
Orden de Implementación:
1. ├── Setup CoinGecko Pro en PriceService.ts
2. ├── Migrar a Pusher para WebSocketService.ts
3. ├── Configurar Infura/Alchemy para multi-chain
4. └── Optimización de performance y caching
```

### FASE 3: SERVICIOS AVANZADOS (Semana 5-6)
```
Orden de Implementación:
1. ├── Integrar Dune Analytics para queries custom
2. ├── Implementar Nansen para market intelligence
3. ├── Crear dashboards avanzados
4. └── Testing completo y optimización final
```

---

## 📋 CHECKLIST DE CREDENCIALES REQUERIDAS

### NIVEL 1 - CRÍTICO
- [ ] 1inch API Key (Gratuito)
- [ ] Etherscan API Key (Gratuito)
- [ ] BSCScan API Key (Gratuito)
- [ ] Polygonscan API Key (Gratuito)
- [ ] Arbiscan API Key (Gratuito)
- [ ] Optimistic Etherscan API Key (Gratuito)

### NIVEL 2 - IMPORTANTE  
- [ ] CoinGecko Pro API Key ($199/mes)
- [ ] Pusher App ID, Key, Secret, Cluster ($49/mes)
- [ ] Infura Project ID y Secret ($50/mes)
  - O Alternativamente:
- [ ] Alchemy API Key y Project ID ($199/mes)

### NIVEL 3 - AVANZADO
- [ ] Dune Analytics API Key ($390/mes)
- [ ] Nansen API Key ($150/mes)

---

## ⚙️ CONFIGURACIÓN DE VARIABLES DE ENTORNO

### Estructura de .dev.vars (Desarrollo Local)
```bash
# NIVEL 1 - APIs Gratuitas
ONEINCH_API_KEY=your_1inch_key
ETHERSCAN_API_KEY=your_etherscan_key
BSCSCAN_API_KEY=your_bscscan_key
POLYGONSCAN_API_KEY=your_polygonscan_key
ARBISCAN_API_KEY=your_arbiscan_key
OPTIMISM_API_KEY=your_optimism_key

# NIVEL 2 - APIs Premium
COINGECKO_API_KEY=your_coingecko_pro_key
PUSHER_APP_ID=your_pusher_app_id
PUSHER_KEY=your_pusher_key
PUSHER_SECRET=your_pusher_secret
PUSHER_CLUSTER=your_pusher_cluster
INFURA_PROJECT_ID=your_infura_project_id
INFURA_API_SECRET=your_infura_secret

# NIVEL 3 - APIs Enterprise
DUNE_API_KEY=your_dune_api_key
NANSEN_API_KEY=your_nansen_api_key
```

### Comandos Cloudflare Secrets (Producción)
```bash
# NIVEL 1
npx wrangler pages secret put ONEINCH_API_KEY --project-name webapp
npx wrangler pages secret put ETHERSCAN_API_KEY --project-name webapp
npx wrangler pages secret put BSCSCAN_API_KEY --project-name webapp

# NIVEL 2
npx wrangler pages secret put COINGECKO_API_KEY --project-name webapp
npx wrangler pages secret put PUSHER_APP_ID --project-name webapp
npx wrangler pages secret put PUSHER_KEY --project-name webapp
npx wrangler pages secret put PUSHER_SECRET --project-name webapp

# NIVEL 3
npx wrangler pages secret put DUNE_API_KEY --project-name webapp
npx wrangler pages secret put NANSEN_API_KEY --project-name webapp
```

---

## 📈 ROADMAP DE MIGRACIÓN

### MES 1: Fundación (Opción A - $0/mes)
- Implementar APIs gratuitas
- Validar funcionalidad básica
- Establecer métricas de performance

### MES 2: Escalamiento (Opción B - $298/mes)
- Upgrade a servicios premium
- Implementar tiempo real
- Optimizar experiencia de usuario

### MES 3+: Profesionalización (Opción C - $787/mes)
- Análisis avanzado
- Inteligencia de mercado
- Dashboards enterprise

---

**Elaborado por:** Sistema de Gestión Ingenio Pichichi S.A.  
**Fecha:** 11 de Septiembre, 2025  
**Versión:** 1.0 - Estructura Jerárquica de Servicios
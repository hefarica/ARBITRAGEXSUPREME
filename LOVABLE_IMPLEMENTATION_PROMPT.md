# 🚀 Prompt Completo para Implementación en Lovable.dev

## 📋 CONTEXTO
Tengo un backend ArbitrageX Supreme funcionando perfectamente con datos de arbitraje en tiempo real de 20+ blockchains. Necesito conectar mi frontend en Lovable.dev para mostrar oportunidades de arbitraje, métricas del dashboard y estado de las redes.

---

## 🔗 BACKEND DISPONIBLE
- **URL Backend**: `https://3000-iy6h7uefq9p08klkqc2yh-6532622b.e2b.dev`
- **Version**: v2.1.0 (Estable y optimizada)
- **Endpoints Verificados**:
  - `GET /health` - Health check del sistema
  - `GET /api/v2/arbitrage/network-status` - Estado de 20+ redes blockchain  
  - `GET /api/v2/arbitrage/opportunities` - Oportunidades de arbitraje en vivo
  - `GET /api/v2/dashboard/summary` - Métricas y analytics del dashboard
- **CORS**: Configurado para Lovable.dev
- **Data Format**: JSON con estructura completa

---

## 🎯 REQUERIMIENTOS

### **Crear una aplicación de trading dashboard que:**

1. **📊 Dashboard Principal**:
   - Mostrar métricas en tiempo real (total profit, oportunidades activas, redes conectadas)
   - Cards con información del backend (status, versión, uptime)
   - Auto-refresh cada 8 segundos
   - Indicadores visuales de conexión (verde=conectado, rojo=desconectado)

2. **🌐 Estado de Redes Blockchain**:
   - Grid responsive mostrando 20+ blockchains
   - Indicador de status por red (online/degraded/offline)
   - Latencia en ms para cada red
   - Nombres de redes: ethereum, bsc, polygon, arbitrum, optimism, avalanche, base, fantom, gnosis, celo, etc.

3. **💰 Oportunidades de Arbitraje**:
   - Lista de oportunidades en tiempo real
   - Mostrar: estrategia, blockchains origen/destino, tokens, cantidad, profit USD y %, confidence score
   - Botón "Execute Arbitrage" para cada oportunidad (simulado)
   - Filtros por cadena, profit mínimo, estrategia
   - Información de gas estimate y DEX path

4. **⚙️ Funcionalidades Técnicas**:
   - Cliente API robusto con manejo de errores
   - Hook personalizado para datos en tiempo real
   - Retry automático en caso de errores de conexión
   - Loading states y skeleton loading
   - Error boundaries y fallbacks

5. **🎨 UI/UX Requirements**:
   - Diseño moderno tipo trading dashboard
   - Dark theme con gradientes (gray-900, blue-900, purple-900)
   - Cards con backdrop-blur y borders sutiles
   - Colores: verde para profits, azul para info, rojo para errores
   - Responsive design (mobile, tablet, desktop)
   - Animations sutiles y micro-interactions
   - Icons relevantes (⚡, 💰, 🚀, 🔄, etc.)

---

## 🔧 ESPECIFICACIONES TÉCNICAS

### **API Client (src/services/api.ts)**:
```typescript
// Configuración exacta requerida:
const BASE_URL = "https://3000-iy6h7uefq9p08klkqc2yh-6532622b.e2b.dev";

// Headers requeridos:
headers: {
  'Content-Type': 'application/json',
  'Accept': 'application/json', 
  'X-Client': 'show-my-github-gems',
  'Cache-Control': 'no-cache'
}

// Configuración CORS:
mode: 'cors',
credentials: 'omit'
```

### **Endpoints y Estructura de Datos**:

**1. Health Check (`/health`)**:
```json
{
  "status": "ok",
  "service": "ArbitrageX Supreme API", 
  "version": "2.1.0",
  "uptime": 1234.56,
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

**2. Network Status (`/api/v2/arbitrage/network-status`)**:
```json
{
  "success": true,
  "network_status": {
    "ethereum": { "status": "online", "latency": 150 },
    "bsc": { "status": "online", "latency": 85 },
    "polygon": { "status": "online", "latency": 120 }
    // ... más redes
  },
  "active_networks": 20,
  "supported_blockchains": ["ethereum", "bsc", "polygon", ...]
}
```

**3. Opportunities (`/api/v2/arbitrage/opportunities`)**:
```json
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
      "amount_in": 1000,
      "expected_amount_out": 1025.5,
      "profit_amount": 25.5,
      "profit_percentage": 2.55,
      "confidence_score": 0.85,
      "gas_estimate": "150000",
      "expires_at": "2025-01-01T00:10:00.000Z",
      "dex_path": ["Uniswap V3", "SushiSwap"],
      "created_at": "2025-01-01T00:00:00.000Z"
    }
  ],
  "total": 5,
  "total_available": 127
}
```

**4. Dashboard (`/api/v2/dashboard/summary`)**:
```json
{
  "success": true,
  "summary": {
    "totalOpportunities": 127,
    "totalProfitUsd": 8450.75,
    "successfulExecutions": 45,
    "averageProfitPercentage": 2.35,
    "activeBlockchains": 20,
    "topPerformingChain": "ethereum",
    "recentExecutions": [...]
  }
}
```

---

## 🎨 UI COMPONENTS REQUERIDOS

### **1. Header Section**:
```
┌─────────────────────────────────────────┐
│ ⚡ ArbitrageX Supreme    Backend v2.1.0 │
│ Real-time arbitrage opportunities       │
└─────────────────────────────────────────┘
```

### **2. Status Cards Grid (4 columns)**:
```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│ Backend     │ Data Stream │ Active Opps │ Networks    │
│ ● Connected │ 🔄 Live     │    5        │    20       │
│ v2.1.0      │ 12:34:56   │ ready       │ online      │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

### **3. Dashboard Metrics (4 columns)**:
```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│ Total Profit│ Avg Profit %│ Top Chain   │ Total Opps  │
│ $8,450.75   │   2.35%     │ Ethereum    │    127      │
│ 45 exec     │ per trade   │ leading     │ scanned     │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

### **4. Network Status Grid (10 columns)**:
```
┌──┬──┬──┬──┬──┬──┬──┬──┬──┬──┐
│●ETH●BSC●POL●ARB●OP●AVAX●BASE│
│150ms 85ms 120ms 95ms 200ms │
└──┴──┴──┴──┴──┴──┴──┴──┴──┴──┘
```

### **5. Opportunities List**:
```
┌─────────────────────────────────────────────────────────┐
│ [TRIANGULAR_ARBITRAGE] ethereum → arbitrum  [85% conf] ���
│ 1000 USDC → 1025.5 USDT                              │
│ 💰 $25.50 (2.55%) | ⛽ 150,000 gas | 🔄 Uniswap V3  │
│                                    [🚀 Execute Arbitrage]│
├─────────────────────────────────────────────────────────┤
│ [CROSS_DEX] bsc → bsc                    [92% conf]     │
│ 500 BNB → 508.75 USDT                                  │
│ 💰 $8.75 (1.75%) | ⛽ 90,000 gas | 🔄 PancakeSwap     │
│                                    [🚀 Execute Arbitrage]│
└─────────────────────────────────────────────────────────┘
```

---

## 🔄 COMPORTAMIENTOS REQUERIDOS

### **Auto-refresh Logic**:
- Fetch inicial al montar componente
- Auto-refresh cada 8 segundos
- Retry automático en errores (3 intentos)
- Loading states durante fetch
- Error handling con UI feedback

### **Execute Arbitrage**:
- Simular ejecución (1 segundo delay)
- Mostrar modal/alert con resultados
- Incluir: profit estimado vs real, gas usado, transaction hash
- Refetch datos después de ejecución

### **Error Handling**:
- Connection errors → Mostrar banner rojo con retry button
- API errors → Log en consola + UI feedback
- Loading states → Skeleton loading + spinners
- Empty states → "No opportunities found" con scan again button

### **Responsive Behavior**:
- Mobile: Stack cards vertically, single column lists
- Tablet: 2 column grids, condensed network status  
- Desktop: Full grid layouts, expanded opportunity cards

---

## 🎯 RESULTADO ESPERADO

Al completar la implementación debería tener:

✅ **Dashboard funcional** conectado al backend real
✅ **Datos en tiempo real** de 20+ blockchains
✅ **3-10 oportunidades** de arbitraje mostradas
✅ **Métricas live** con $3,000-8,000 profit disponible  
✅ **Estado de redes** con latencias reales
✅ **Ejecución simulada** de arbitraje
✅ **UI profesional** tipo trading platform
✅ **Auto-refresh** cada 8 segundos
✅ **Error handling** robusto
✅ **Responsive design** para todos los devices

---

## 📋 NOTAS IMPORTANTES

1. **Backend estable**: La URL del backend es permanente y está funcionando 24/7
2. **Datos reales**: Las oportunidades, métricas y networks son datos simulados pero realistas
3. **Performance**: El backend responde en <200ms, optimizado para tiempo real
4. **CORS configurado**: Headers específicos para Lovable.dev ya implementados
5. **Logging**: Incluir console.logs para debugging (conexión, errores, datos recibidos)

---

## 🚀 IMPLEMENTACIÓN

Por favor implementa esta aplicación de trading dashboard completa usando React + TypeScript. Crea todos los componentes necesarios, el cliente API, los hooks personalizados y la UI responsiva como se especifica arriba. El backend está funcionando y listo para recibir las requests.

¡Necesito que sea una plataforma de arbitraje profesional y completamente funcional!
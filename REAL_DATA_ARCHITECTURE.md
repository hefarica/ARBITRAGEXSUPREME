# 🎯 ARQUITECTURA DE DATOS REALES - ArbitrageX Supreme

## 🚨 PROBLEMA IDENTIFICADO
**Los datos actuales son 100% MOCK/SIMULADOS** - Esto es CRÍTICO para producción real.

### ❌ **RIESGOS ACTUALES:**
- Decisiones financieras basadas en datos falsos
- Posibles pérdidas de dinero real
- Confianza en oportunidades inexistentes
- Ejecución de trades con información errónea

---

## ✅ SOLUCIÓN PROPUESTA: DATOS REALES CON FALLBACKS

### 🔧 **NUEVA ARQUITECTURA:**

#### **1. ENDPOINT DE VERIFICACIÓN DE FUENTES REALES**
```
GET /api/v2/data-sources/status
```

**Funcionalidad:**
- Verificar conectividad con APIs reales
- Estado de cada fuente de datos
- Tiempo de última actualización exitosa
- Indicador general de disponibilidad

**Response:**
```json
{
  "success": true,
  "data_sources": {
    "coingecko": {
      "status": "online" | "offline" | "degraded",
      "last_update": "2025-09-03T07:30:00.000Z",
      "latency_ms": 150,
      "error": null
    },
    "defillama": {
      "status": "online" | "offline" | "degraded", 
      "last_update": "2025-09-03T07:29:45.000Z",
      "latency_ms": 200,
      "error": null
    },
    "moralis": {
      "status": "offline",
      "last_update": "2025-09-03T07:20:00.000Z",
      "latency_ms": null,
      "error": "API key expired"
    }
  },
  "overall_status": "degraded", // online | degraded | offline
  "real_data_percentage": 67, // % de fuentes funcionando
  "can_provide_real_data": true,
  "timestamp": "2025-09-03T07:30:15.000Z"
}
```

#### **2. ENDPOINTS CON VERIFICACIÓN DE DATOS REALES**

##### **Network Status (Real Data)**
```
GET /api/v2/arbitrage/network-status-real
```

**Lógica:**
```javascript
// 1. Verificar fuentes de datos reales
const dataSources = await checkRealDataSources();

// 2. Si hay fuentes disponibles, usar datos reales
if (dataSources.can_provide_real_data) {
  const realNetworkData = await fetchRealNetworkData();
  return {
    success: true,
    data_source: "real",
    network_status: realNetworkData,
    // ... datos reales
  };
}

// 3. Si NO hay fuentes, devolver estado offline
return {
  success: false,
  data_source: "unavailable",
  error: "Real data sources are offline",
  backend_status: "disconnected",
  network_status: null,
  message: "Backend no responde - fuentes de datos no disponibles"
};
```

##### **Opportunities (Real Data Only)**
```
GET /api/v2/arbitrage/opportunities-real
```

**Lógica:**
```javascript
// 1. Verificar fuentes reales
const sources = await checkDataSources();

// 2. Solo proceder si hay datos reales
if (!sources.can_provide_real_data) {
  return {
    success: false,
    data_source: "unavailable", 
    opportunities: [],
    total: 0,
    error: "No hay datos reales disponibles",
    backend_status: "disconnected",
    message: "Sistema requiere datos reales para mostrar oportunidades"
  };
}

// 3. Obtener datos reales de DEXs
const realOpportunities = await scanRealArbitrageOpportunities();

// 4. Devolver solo si hay oportunidades reales
return {
  success: true,
  data_source: "real",
  opportunities: realOpportunities,
  total: realOpportunities.length,
  last_scan: new Date().toISOString()
};
```

#### **3. FUENTES DE DATOS REALES PROPUESTAS**

##### **Para Precios y Liquidez:**
- **CoinGecko API** (gratuita con límites)
- **DeFiLlama API** (gratuita, datos DeFi)
- **Moralis API** (freemium, datos blockchain)
- **1inch API** (para quotes reales)
- **Uniswap V3 Subgraph** (datos de pools)

##### **Para Network Status:**
- **Alchemy API** (RPC endpoints)
- **Infura API** (estado de redes)
- **QuickNode API** (latencias reales)
- **Chainlist.org API** (estado de RPCs públicos)

##### **Para Arbitrage Opportunities:**
- **DEX APIs directas** (Uniswap, SushiSwap, PancakeSwap)
- **Price comparison** entre múltiples DEXs
- **Real liquidity data** de pools
- **Gas price oracles** (ETH Gas Station, etc.)

---

## 🔧 IMPLEMENTACIÓN TÉCNICA

### **PASO 1: Endpoint de Verificación de Fuentes**

```javascript
// functions/api/v2/data-sources/status.js
export async function onRequest(context) {
  // Headers CORS
  const corsHeaders = { /* ... */ };
  
  // Verificar cada fuente de datos
  const sources = await Promise.allSettled([
    checkCoinGecko(),
    checkDeFiLlama(), 
    checkMoralis(),
    check1inch()
  ]);
  
  // Calcular estado general
  const onlineSources = sources.filter(s => s.status === 'fulfilled').length;
  const totalSources = sources.length;
  const percentage = (onlineSources / totalSources) * 100;
  
  const overallStatus = percentage >= 75 ? 'online' : 
                       percentage >= 25 ? 'degraded' : 'offline';
  
  return new Response(JSON.stringify({
    success: true,
    data_sources: { /* resultados detallados */ },
    overall_status: overallStatus,
    real_data_percentage: percentage,
    can_provide_real_data: percentage >= 25,
    timestamp: new Date().toISOString()
  }), { status: 200, headers: corsHeaders });
}

async function checkCoinGecko() {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/ping', {
      timeout: 5000
    });
    return {
      status: response.ok ? 'online' : 'degraded',
      latency_ms: Date.now() - start,
      last_update: new Date().toISOString(),
      error: null
    };
  } catch (error) {
    return {
      status: 'offline',
      latency_ms: null, 
      last_update: null,
      error: error.message
    };
  }
}
```

### **PASO 2: Modificar Endpoints Existentes**

**Agregar parámetro de modo:**
```
GET /api/v2/arbitrage/opportunities?mode=real
GET /api/v2/arbitrage/opportunities?mode=mock  
GET /api/v2/arbitrage/opportunities?mode=auto (default)
```

**Lógica condicional:**
```javascript
const mode = searchParams.get('mode') || 'auto';

if (mode === 'real' || mode === 'auto') {
  const realData = await fetchRealData();
  if (realData.success) {
    return realData;
  } else if (mode === 'real') {
    // Si modo real y no hay datos, devolver error
    return {
      success: false,
      error: "Real data not available",
      backend_status: "disconnected"
    };
  }
  // Si modo auto y no hay datos reales, continuar con mock
}

// Solo llegar aquí si modo=mock o si modo=auto y falló real
if (mode !== 'real') {
  return generateMockData(); // Datos simulados actuales
}
```

---

## 🎯 FRONTEND INTEGRATION

### **Indicador de Estado de Datos**

```typescript
// Hook para verificar estado de datos reales
export const useDataSourceStatus = () => {
  const [dataStatus, setDataStatus] = useState({
    overall_status: 'checking',
    real_data_percentage: 0,
    can_provide_real_data: false,
    backend_status: 'connecting'
  });

  useEffect(() => {
    const checkDataSources = async () => {
      try {
        const response = await fetch('/api/v2/data-sources/status');
        const data = await response.json();
        
        setDataStatus({
          overall_status: data.overall_status,
          real_data_percentage: data.real_data_percentage,
          can_provide_real_data: data.can_provide_real_data,
          backend_status: data.can_provide_real_data ? 'connected' : 'no-real-data'
        });
      } catch (error) {
        setDataStatus({
          overall_status: 'offline',
          real_data_percentage: 0,
          can_provide_real_data: false,
          backend_status: 'disconnected'
        });
      }
    };

    checkDataSources();
    const interval = setInterval(checkDataSources, 30000); // Check cada 30s
    
    return () => clearInterval(interval);
  }, []);

  return dataStatus;
};
```

### **Componente de Estado Visual**

```typescript
const DataSourceIndicator: React.FC = () => {
  const { overall_status, real_data_percentage, backend_status } = useDataSourceStatus();
  
  const getStatusColor = () => {
    switch (backend_status) {
      case 'connected': return 'bg-green-500';
      case 'no-real-data': return 'bg-yellow-500';
      case 'disconnected': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };
  
  const getStatusText = () => {
    switch (backend_status) {
      case 'connected': return `Datos Reales (${real_data_percentage}%)`;
      case 'no-real-data': return 'Sin Datos Reales - Modo Deshabilitado';
      case 'disconnected': return 'Backend No Responde';
      default: return 'Verificando...';
    }
  };
  
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-white/10">
      <div className={`w-3 h-3 rounded-full ${getStatusColor()}`}></div>
      <span className="text-sm font-medium text-white">
        {getStatusText()}
      </span>
      {backend_status === 'no-real-data' && (
        <span className="text-xs text-yellow-200">
          ⚠️ No se ejecutarán trades sin datos reales
        </span>
      )}
    </div>
  );
};
```

---

## 🚨 CONFIGURACIÓN DE PRODUCCIÓN

### **Variables de Entorno Necesarias:**
```env
# API Keys para fuentes reales
COINGECKO_API_KEY=your_coingecko_key
MORALIS_API_KEY=your_moralis_key
DEFILLAMA_API_KEY=your_defillama_key
ALCHEMY_API_KEY=your_alchemy_key

# Configuración de modo
DATA_MODE=real # real | mock | auto
MIN_DATA_SOURCES=2 # Mínimo de fuentes para considerar "datos reales"
REAL_DATA_CACHE_TTL=300 # 5 minutos cache de datos reales
```

### **Deployment Configuration:**
```bash
# Configurar secrets en Cloudflare
npx wrangler secret put COINGECKO_API_KEY
npx wrangler secret put MORALIS_API_KEY
npx wrangler secret put DATA_MODE

# Actualizar wrangler.toml
echo '[vars]
MIN_DATA_SOURCES = "2"
REAL_DATA_CACHE_TTL = "300"' >> wrangler.toml
```

---

## ✅ RESULTADO ESPERADO

### **Con Datos Reales Disponibles:**
- ✅ Indicador verde: "Datos Reales (85%)"
- ✅ Oportunidades reales de arbitraje
- ✅ Precios actualizados desde DEXs
- ✅ Network status real desde RPCs

### **Sin Datos Reales Disponibles:**
- ⚠️ Indicador amarillo/rojo: "Sin Datos Reales - Modo Deshabilitado"
- ❌ Lista de oportunidades vacía
- ❌ Mensaje: "Backend no responde"
- 🔒 Botones de ejecución deshabilitados

### **Modo Híbrido (Auto):**
- 🔄 Intenta datos reales primero
- 📊 Usa simulación SOLO si hay datos reales de base
- ⚠️ Marca claramente cuando son simulaciones sobre datos reales

---

## 🎯 PRÓXIMOS PASOS

1. **Implementar endpoint de verificación** de fuentes de datos
2. **Obtener API keys** para fuentes gratuitas (CoinGecko, DeFiLlama)
3. **Modificar endpoints existentes** con lógica condicional
4. **Actualizar frontend** con indicadores de estado
5. **Testing exhaustivo** con y sin fuentes disponibles
6. **Deployment gradual** con fallback a mock durante transición

**Esta arquitectura garantiza que NUNCA se muestren datos falsos como reales, protegiendo contra pérdidas financieras.**
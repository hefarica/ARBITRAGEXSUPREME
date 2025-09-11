# 💻 LOVABLE FRONTEND - Guía Dashboard React

> **⚠️ ATENCIÓN AGENTES IA: REPOSITORIO FRONTEND REACT**  
> **ESTE REPOSITORIO ES EXCLUSIVAMENTE PARA INTERFAZ DE USUARIO**

## 🎯 IDENTIFICACIÓN DE REPOSITORIO

```
🔍 UBICACIÓN OBJETIVO:  
Repository: hefarica/show-my-github-gems
Propósito: FRONTEND DASHBOARD REACT 100%
Lenguajes: React, TypeScript, CSS, HTML, JSON
Prohibido: Rust backend, Cloudflare Workers, PostgreSQL

✅ AQUÍ SÍ PERTENECE:
- Componentes React (.tsx)
- Hooks personalizados (use*.ts)
- Stores Zustand (.ts)  
- Estilos CSS/Tailwind
- Tipos TypeScript frontend
- Servicios API cliente
- Tests frontend
- Configuración Vite/React
```

## ⚛️ TECNOLOGÍAS FRONTEND PERMITIDAS  

### **✅ STACK REACT FRONTEND**

```tsx
// ✅ CORRECTO - Componente React
import React from 'react';
import { useArbitrageData } from '../hooks/useArbitrageData';

const Dashboard: React.FC = () => {
  const { opportunities, loading } = useArbitrageData();
  
  return (
    <div className="dashboard">
      <h1>ArbitrageX Dashboard</h1>
      {/* UI components aquí */}
    </div>
  );
};

// ✅ CORRECTO - Hook personalizado
export const useRealTimeData = () => {
  const [data, setData] = useState(null);
  // Lógica hook aquí
  return { data, loading };
};
```

### **❌ TECNOLOGÍAS PROHIBIDAS**

```rust
// ❌ MAL - Rust (va en CONTABO backend)
pub struct MEVEngine {
    // ¡NO! Esto va en repositorio backend
}
```

```typescript
// ❌ MAL - Cloudflare Worker (va en ARBITRAGEXSUPREME)  
export default {
  async fetch(request: Request): Promise<Response> {
    // ¡NO! Esto va en repositorio edge
  }
}
```

## 📁 ESTRUCTURA FRONTEND CORRECTA

```
show-my-github-gems/
├── ⚛️ REACT APPLICATION  
│   ├── src/
│   │   ├── components/       # Componentes React
│   │   │   ├── dashboard/   # Dashboard components  
│   │   │   ├── trading/     # Trading components
│   │   │   ├── portfolio/   # Portfolio components
│   │   │   └── ui/          # shadcn/ui components
│   │   ├── hooks/           # Custom hooks
│   │   ├── stores/          # Zustand state management
│   │   ├── services/        # API client services
│   │   ├── types/           # TypeScript types
│   │   └── lib/             # Utilities
├── 🎨 DESIGN SYSTEM
│   ├── tailwind.config.ts   # Tailwind configuration
│   ├── components.json      # shadcn/ui config  
│   └── theme/               # Design tokens
├── 🧪 TESTING
│   ├── __tests__/           # Component tests
│   └── e2e/                 # End-to-end tests  
└── ⚙️ CONFIGURATION
    ├── package.json         # Dependencies React
    ├── vite.config.ts       # Vite bundler
    ├── tsconfig.json        # TypeScript config
    └── .env                 # Environment variables
```

## 🎨 COMPONENTES IMPLEMENTADOS

### **✅ Existentes (19% completado)**
```
✅ DashboardOverview.tsx     # Dashboard principal básico
✅ Layout.tsx                # Layout principal  
✅ AppSidebar.tsx            # Sidebar navegación
✅ 52 componentes shadcn/ui  # UI library completa
✅ opportunitiesStore.ts     # Store Zustand oportunidades
✅ useWebSocketManager.ts    # Hook WebSocket
✅ api.ts                    # Servicio API básico
```

### **❌ Pendientes (65/80 componentes)**
```
❌ OpportunityMonitor.tsx    # Monitor oportunidades tiempo real
❌ StrategyDashboard.tsx     # Dashboard estrategias  
❌ ExecutionTracker.tsx      # Tracker ejecuciones
❌ PerformanceAnalytics.tsx  # Analytics performance
❌ ProfitChart.tsx          # Gráficos beneficios
❌ RiskMatrix.tsx           # Matrix gestión riesgo
❌ [60+ componentes más]    # Ver estructura jerárquica
```

## ⚡ COMANDOS DESARROLLO

```bash
# ✅ CORRECTO - Frontend React
npm install                  # Instalar dependencies
npm run dev                  # Desarrollo local
npm run build               # Build producción  
npm run test                # Ejecutar tests
npm run storybook           # Component library

# ✅ CORRECTO - Linting & Formatting
npm run lint                # ESLint  
npm run format              # Prettier
npm run type-check          # TypeScript

# ❌ PROHIBIDO - Backend/Edge commands
cargo build                 # ¡NO! Es para backend Rust
npx wrangler deploy         # ¡NO! Es para Cloudflare
docker-compose up           # ¡NO! Es para backend  
```

## 🔗 INTEGRACIÓN CON OTRAS CAPAS

### **API Integration (Correcta)**
```tsx
// ✅ CORRECTO - Cliente API  
import { apiClient } from '../services/api';

const useOpportunities = () => {
  const [opportunities, setOpportunities] = useState([]);
  
  useEffect(() => {
    // Consumir API backend a través de Cloudflare proxy
    apiClient.get('/api/opportunities')
      .then(data => setOpportunities(data));
  }, []);
  
  return opportunities;
};
```

### **WebSocket Integration (Correcta)**
```tsx  
// ✅ CORRECTO - WebSocket cliente
import { useWebSocketManager } from '../hooks/useWebSocketManager';

const RealTimeData = () => {
  const { data, connected } = useWebSocketManager('/ws/opportunities');
  
  return (
    <div>Status: {connected ? 'Connected' : 'Disconnected'}</div>
  );
};
```

## 🎯 RESPONSABILIDADES ESPECÍFICAS

### **SÍ PERTENECE AQUÍ:**
- ⚛️ Componentes React/TSX
- 🎣 Custom hooks (useXXX)  
- 🏪 State management (Zustand)
- 🎨 Estilos y temas
- 📊 Charts y visualizations
- 🧪 Tests frontend
- 📱 Responsive design
- 🔗 API client integration
- 🖥️ User experience (UX)

### **NO PERTENECE AQUÍ:**
- ❌ Lógica de negocio (→ CONTABO)  
- ❌ Base de datos queries (→ CONTABO)
- ❌ MEV engine logic (→ CONTABO)
- ❌ Cloudflare Workers (→ ARBITRAGEXSUPREME)
- ❌ Edge functions (→ ARBITRAGEXSUPREME) 
- ❌ Server infrastructure (→ CONTABO)
- ❌ Security audits (→ CONTABO)

## 📊 ESTADO ACTUAL

```
📈 PROGRESO: 19% completado  
⚛️ STACK: React + TypeScript + Tailwind + shadcn/ui
🧩 COMPLETADO: 15/80 componentes principales
🏪 STATE: 1/8 stores Zustand implementados  
🎣 HOOKS: 5/15 custom hooks implementados
```

## 🛠️ PRÓXIMOS PASOS FRONTEND

1. **Implementar páginas principales** (Opportunities, Executions, Portfolio)
2. **Completar stores Zustand** (executions, portfolio, settings)  
3. **Desarrollar componentes trading** (ExecutionPanel, OrderForm, etc.)
4. **Crear charts avanzados** (ProfitChart, PerformanceMetrics, etc.)
5. **Integrar WebSocket tiempo real** completo
6. **Implementar sistema autenticación**
7. **Configurar testing completo** (unit + integration + e2e)

## ⚠️ RECORDATORIOS CRÍTICOS

- ✅ **SIEMPRE** usar React/TypeScript para UI
- ✅ **CONSUMIR** APIs backend a través de cliente HTTP  
- ✅ **MANTENER** separación frontend puro
- ❌ **NUNCA** implementar lógica de negocio aquí
- ❌ **NUNCA** hacer queries directas a base datos
- ❌ **NUNCA** agregar código Rust o Workers
- 📚 **SEGUIR** design system shadcn/ui

## 🎨 DESIGN SYSTEM

```tsx
// ✅ Usar componentes shadcn/ui
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"  
import { Badge } from "@/components/ui/badge"

// ✅ Seguir Tailwind CSS patterns
className="flex items-center justify-between p-4 bg-background"

// ✅ Responsive design first
className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
```

---

*Metodología: Ingenio Pichichi S.A - Frontend puro y separado*  
*Stack: React + TypeScript + Tailwind + shadcn/ui*  
*Integración: API cliente únicamente*
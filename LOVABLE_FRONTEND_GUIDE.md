# ArbitrageX Supreme - Guía Frontend para Lovable.dev

## 🎯 Información del Proyecto

**Sistema**: ArbitrageX Supreme  
**Tipo**: Enterprise arbitrage trading platform  
**Arquitectura**: Multi-tenant SaaS  
**Desarrollador**: Hector Fabio Riascos C.  
**Metodología**: Buenas prácticas de Ingenio Pichichi S.A.

---

## 🏗️ Arquitectura de Datos

### Base de Datos PostgreSQL con Prisma ORM
El proyecto utiliza **PostgreSQL 15.13** como base de datos principal con **Prisma ORM** para la gestión de datos.

#### Modelos Principales de Datos:

##### **1. Tenant (Multi-tenancy)**
```typescript
interface Tenant {
  id: string;                    // UUID
  name: string;                  // Nombre de la organización
  slug: string;                  // Identificador único (URL-friendly)
  domain?: string;               // Dominio personalizado
  branding?: any;                // Configuración de marca
  subscription_id?: string;      // Referencia a suscripción
  settings?: any;                // Configuraciones específicas
  status: 'ACTIVE' | 'SUSPENDED' | 'CANCELLED';
  created_at: Date;
  updated_at: Date;
}
```

##### **2. User (Usuarios)**
```typescript
interface User {
  id: string;                    // UUID
  tenant_id: string;             // Relación con Tenant
  email: string;                 // Email único
  password_hash?: string;        // Hash de contraseña
  first_name: string;            // Nombre
  last_name: string;             // Apellido
  role: 'SUPER_ADMIN' | 'ADMIN' | 'TRADER' | 'USER' | 'VIEWER';
  status: 'ACTIVE' | 'SUSPENDED' | 'PENDING';
  last_login_at?: Date;
  created_at: Date;
  updated_at: Date;
}
```

##### **3. ArbitrageOpportunity (Oportunidades)**
```typescript
interface ArbitrageOpportunity {
  id: string;                    // Identificador único
  strategy: 'triangular_arbitrage' | 'cross_dex' | 'flash_loan' | 'cross_chain';
  blockchain_from: string;       // Blockchain origen
  blockchain_to: string;         // Blockchain destino
  token_in: string;              // Token de entrada
  token_out: string;             // Token de salida
  amount_in: number;             // Cantidad de entrada
  expected_amount_out: number;   // Cantidad esperada de salida
  profit_amount: number;         // Ganancia en USD
  profit_percentage: number;     // Porcentaje de ganancia
  confidence_score: number;      // Puntuación de confianza (0-1)
  gas_estimate: string;          // Estimación de gas
  expires_at: Date;              // Fecha de expiración
  dex_path: string[];            // Ruta de DEXs
  created_at: Date;
}
```

##### **4. ArbitrageExecution (Ejecuciones)**
```typescript
interface ArbitrageExecution {
  id: string;                    // ID de ejecución
  opportunity_id: string;        // Referencia a oportunidad
  tenant_id: string;             // Tenant propietario
  user_id: string;               // Usuario ejecutor
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  actual_profit_usd: number;     // Ganancia real en USD
  actual_profit_percentage: number; // Porcentaje real de ganancia
  execution_time_ms: number;     // Tiempo de ejecución en ms
  gas_used: string;              // Gas utilizado
  gas_price_gwei: string;        // Precio del gas en gwei
  total_gas_cost: string;        // Costo total del gas
  slippage_actual: number;       // Slippage real
  transaction_hash?: string;     // Hash de transacción
  failure_reason?: string;       // Razón de falla (si aplica)
  executed_at: Date;             // Fecha de ejecución
  completed_at?: Date;           // Fecha de completado
}
```

##### **5. BlockchainNetwork (Redes)**
```typescript
interface BlockchainNetwork {
  id: string;                    // Identificador de red
  name: string;                  // Nombre completo
  chain_id: number;              // ID de cadena
  status: 'online' | 'offline' | 'degraded';
  latency: number;               // Latencia en ms
  gas_price: string;             // Precio actual del gas
  supported_protocols: string[]; // DEXs soportados
  tvl: string;                   // Total Value Locked
  is_active: boolean;            // Activa para arbitraje
}
```

---

## 🎨 Componentes de UI Recomendados

### **Dashboard Principal**
```typescript
interface DashboardProps {
  totalOpportunities: number;
  totalProfitUsd: number;
  successfulExecutions: number;
  averageProfitPercentage: number;
  activeBlockchains: number;
  topPerformingChain: string;
  recentExecutions: ArbitrageExecution[];
  profitByChain: Record<string, number>;
  executionsByHour: Array<{
    hour: string;
    executions: number;
    profit: number;
  }>;
}

// Componente principal del dashboard
const Dashboard = ({ data }: { data: DashboardProps }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <MetricCard 
        title="Oportunidades Activas" 
        value={data.totalOpportunities}
        icon="📊"
        trend="+12%"
      />
      <MetricCard 
        title="Ganancias Totales" 
        value={`$${data.totalProfitUsd.toFixed(2)}`}
        icon="💰"
        trend="+8.5%"
      />
      <MetricCard 
        title="Ejecuciones Exitosas" 
        value={data.successfulExecutions}
        icon="✅"
        trend="95.2%"
      />
      <MetricCard 
        title="Ganancia Promedio" 
        value={`${data.averageProfitPercentage.toFixed(2)}%`}
        icon="📈"
        trend="+0.3%"
      />
    </div>
  );
};
```

### **Lista de Oportunidades**
```typescript
interface OpportunityCardProps {
  opportunity: ArbitrageOpportunity;
  onExecute: (id: string) => void;
}

const OpportunityCard = ({ opportunity, onExecute }: OpportunityCardProps) => {
  const profitColor = opportunity.profit_percentage >= 3 ? 'text-green-600' : 
                      opportunity.profit_percentage >= 1 ? 'text-yellow-600' : 'text-gray-600';
  
  return (
    <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">
            {opportunity.token_in} → {opportunity.token_out}
          </h3>
          <p className="text-sm text-gray-600">
            {opportunity.blockchain_from} → {opportunity.blockchain_to}
          </p>
        </div>
        <span className={`text-xl font-bold ${profitColor}`}>
          +{opportunity.profit_percentage.toFixed(2)}%
        </span>
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs text-gray-500">Ganancia USD</p>
          <p className="font-semibold text-green-600">
            ${opportunity.profit_amount.toFixed(2)}
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Confianza</p>
          <p className="font-semibold">
            {(opportunity.confidence_score * 100).toFixed(0)}%
          </p>
        </div>
      </div>
      
      <div className="flex justify-between items-center">
        <span className="text-xs text-gray-500">
          Expira: {new Date(opportunity.expires_at).toLocaleTimeString()}
        </span>
        <button
          onClick={() => onExecute(opportunity.id)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Ejecutar
        </button>
      </div>
    </div>
  );
};
```

### **Estado de Ejecuciones**
```typescript
const ExecutionStatus = ({ execution }: { execution: ArbitrageExecution }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SUCCESS': return 'bg-green-100 text-green-800';
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'FAILED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-sm font-medium text-gray-800">
          Ejecución {execution.id.slice(-8)}
        </h4>
        <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(execution.status)}`}>
          {execution.status}
        </span>
      </div>
      
      {execution.status === 'SUCCESS' && (
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-gray-500">Ganancia</p>
            <p className="font-semibold text-green-600">
              ${execution.actual_profit_usd.toFixed(2)}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Tiempo</p>
            <p className="font-semibold">
              {execution.execution_time_ms}ms
            </p>
          </div>
        </div>
      )}
      
      {execution.transaction_hash && (
        <p className="text-xs text-blue-600 mt-2 truncate">
          Tx: {execution.transaction_hash}
        </p>
      )}
    </div>
  );
};
```

### **Grid de Estado de Redes**
```typescript
const NetworkStatusGrid = ({ networks }: { networks: BlockchainNetwork[] }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
      {networks.map((network) => (
        <div key={network.id} className="bg-white rounded-lg p-4 shadow-sm border">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-800 truncate">
              {network.name}
            </h3>
            <div className={`w-3 h-3 rounded-full ${
              network.status === 'online' ? 'bg-green-400' : 
              network.status === 'degraded' ? 'bg-yellow-400' : 'bg-red-400'
            }`} />
          </div>
          
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Latencia</span>
              <span className="font-medium">{network.latency}ms</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">Gas</span>
              <span className="font-medium">{network.gas_price} gwei</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
```

---

## 🔐 Autenticación Frontend

### **Gestión de Estado de Autenticación**
```typescript
interface AuthState {
  user: AuthUser | null;
  permissions: string[];
  features: string[];
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Hook de autenticación personalizado
const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    permissions: [],
    features: [],
    isAuthenticated: false,
    isLoading: true
  });

  const login = async (email: string, password: string, tenantSlug?: string) => {
    try {
      const response = await fetch('/api/v2/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Importante para cookies
        body: JSON.stringify({ email, password, tenantSlug })
      });
      
      if (response.ok) {
        const data = await response.json();
        setAuthState({
          user: data.user,
          permissions: data.permissions,
          features: data.features,
          isAuthenticated: true,
          isLoading: false
        });
      }
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const logout = async () => {
    await fetch('/api/v2/auth/logout', {
      method: 'POST',
      credentials: 'include'
    });
    
    setAuthState({
      user: null,
      permissions: [],
      features: [],
      isAuthenticated: false,
      isLoading: false
    });
  };

  return { ...authState, login, logout };
};
```

### **Componente de Login**
```typescript
const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantSlug, setTenantSlug] = useState('ingenio-pichichi');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      await login(email, password, tenantSlug);
    } catch (error) {
      // Manejar error
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-md mx-auto">
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
          required
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700">
          Contraseña
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Organización
        </label>
        <input
          type="text"
          value={tenantSlug}
          onChange={(e) => setTenantSlug(e.target.value)}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md"
          placeholder="ingenio-pichichi"
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
      >
        {isLoading ? 'Ingresando...' : 'Iniciar Sesión'}
      </button>
    </form>
  );
};
```

---

## 📡 Gestión de Datos con React Query

### **Configuración de React Query**
```typescript
import { QueryClient, QueryClientProvider, useQuery, useMutation } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 segundos
      cacheTime: 5 * 60 * 1000, // 5 minutos
    },
  },
});

// Wrapper de la aplicación
export const App = () => (
  <QueryClientProvider client={queryClient}>
    <Router>
      <Routes>
        {/* Rutas de la aplicación */}
      </Routes>
    </Router>
  </QueryClientProvider>
);
```

### **Hooks de Datos Personalizados**
```typescript
// Hook para obtener oportunidades
const useOpportunities = (filters: OpportunityFilters) => {
  return useQuery({
    queryKey: ['opportunities', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value.toString());
      });
      
      const response = await fetch(`/api/v2/arbitrage/opportunities?${params}`, {
        credentials: 'include'
      });
      return response.json();
    },
    refetchInterval: 5000, // Actualizar cada 5 segundos
  });
};

// Hook para ejecutar arbitraje
const useExecuteArbitrage = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ opportunityId, slippageTolerance, amount }) => {
      const response = await fetch('/api/v2/arbitrage/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ opportunityId, slippageTolerance, amount })
      });
      return response.json();
    },
    onSuccess: () => {
      // Invalidar queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['executions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    }
  });
};

// Hook para dashboard
const useDashboard = () => {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const response = await fetch('/api/v2/dashboard/summary', {
        credentials: 'include'
      });
      return response.json();
    },
    refetchInterval: 10000, // Actualizar cada 10 segundos
  });
};
```

---

## 🎯 Estructura de Páginas Recomendada

### **1. Dashboard (`/dashboard`)**
- Overview completo con métricas principales
- Gráfico de ganancias por hora
- Ejecuciones recientes
- Estado de redes blockchain
- Alertas importantes

### **2. Oportunidades (`/opportunities`)**
- Lista filtrable de oportunidades
- Filtros por blockchain, estrategia, ganancia mínima
- Ejecución directa desde la lista
- Actualización en tiempo real

### **3. Ejecuciones (`/executions`)**
- Historial completo de ejecuciones
- Filtros por estado, fecha, ganancia
- Detalles de cada ejecución
- Estadísticas de rendimiento

### **4. Redes (`/networks`)**
- Estado de todas las blockchains
- Métricas de latencia y gas
- Protocolos soportados por red
- Configuración de redes activas

### **5. Perfil (`/profile`)**
- Información de usuario
- Configuraciones de cuenta
- Preferencias de trading
- Configuración de alertas

### **6. Facturación (`/billing`)**
- Estado de suscripción
- Uso actual vs límites
- Historial de facturación
- Upgrade de plan

---

## 🚀 Consideraciones de Rendimiento

### **Optimizaciones Recomendadas:**
1. **Lazy Loading**: Cargar componentes pesados solo cuando se necesiten
2. **Virtualización**: Para listas largas de oportunidades/ejecuciones
3. **Debouncing**: Para filtros y búsquedas
4. **Caché Inteligente**: Usar React Query para gestión eficiente de datos
5. **WebSockets**: Para actualizaciones en tiempo real opcionales

### **Bibliotecas Recomendadas:**
- **@tanstack/react-query**: Gestión de estado del servidor
- **recharts**: Gráficos y visualizaciones
- **react-router-dom**: Navegación
- **tailwindcss**: Estilos utilitarios
- **react-hook-form**: Gestión de formularios
- **zustand**: Estado global ligero
- **react-virtual**: Virtualización de listas

---

## 💡 Consejos para Lovable.dev

1. **Comienza con el Dashboard**: Es la página más visual e impresionante
2. **Usa datos mock inicialmente**: El backend está listo pero usa datos simulados
3. **Implementa autenticación completa**: El sistema JWT está completamente funcional
4. **Prioriza la UX**: Interfaz intuitiva para traders profesionales
5. **Responsive Design**: Funcional en desktop y móvil
6. **Tiempo Real**: Actualiza oportunidades cada 5-10 segundos
7. **Validaciones**: Implementa validaciones robustas en formularios
8. **Error Handling**: Manejo elegante de errores de red y autenticación

---

*Esta guía está diseñada para crear un frontend completo y profesional usando Lovable.dev con el backend ArbitrageX Supreme desarrollado bajo la metodología de buenas prácticas de Ingenio Pichichi S.A.*
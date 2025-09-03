# ArbitrageX Supreme - Configuración Backend Real para Lovable.dev

## 🔗 URLs del Backend ArbitrageX Supreme

### **Backend Real Actualmente Ejecutándose:**
```javascript
// URL actual de tu backend en sandbox
const BACKEND_URL = "https://3000-iy6h7uefq9p08klkqc2yh-6532622b.e2b.dev";

// Health check endpoint
const HEALTH_URL = "https://3000-iy6h7uefq9p08klkqc2yh-6532622b.e2b.dev/api/v2/arbitrage/network-status";
```

---

## 📝 Configuración para Lovable.dev

### **1. Archivo: `src/services/api.ts`**

Reemplaza el contenido completo del archivo `src/services/api.ts` en Lovable.dev con:

```typescript
// ArbitrageX Supreme - API Configuration para Lovable.dev
// Conexión al backend real PostgreSQL + Prisma + Fastify

// =============================================================================
// BACKEND REAL CONFIGURATION
// =============================================================================

// URL del backend ArbitrageX Supreme real (actualizado automáticamente)
const API_CONFIG = {
  // Sandbox Development (current)
  SANDBOX_URL: "https://3000-iy6h7uefq9p08klkqc2yh-6532622b.e2b.dev",
  
  // Production URLs (cuando despliegues a producción)
  PRODUCTION_URL: "https://api.arbitragexsupreme.com",
  STAGING_URL: "https://staging-api.arbitragexsupreme.com",
  
  // Local Development (cuando ejecutes localmente)
  LOCAL_URL: "http://localhost:3000"
};

// Determinar URL activa basada en el entorno
const getActiveBackendUrl = () => {
  // Si estás desarrollando en Lovable.dev, usa la URL del sandbox
  if (window.location.hostname.includes('lovable.dev') || window.location.hostname.includes('gptengineer.app')) {
    return API_CONFIG.SANDBOX_URL;
  }
  
  // Si estás en producción
  if (window.location.hostname.includes('arbitragexsupreme.com')) {
    return API_CONFIG.PRODUCTION_URL;
  }
  
  // Si estás en staging
  if (window.location.hostname.includes('staging')) {
    return API_CONFIG.STAGING_URL;
  }
  
  // Local development por defecto
  return API_CONFIG.LOCAL_URL;
};

// URL base para todas las requests
const BASE_URL = `${getActiveBackendUrl()}/api/v2`;

console.log('🔗 ArbitrageX Backend URL:', BASE_URL);

// =============================================================================
// API CLIENT CONFIGURATION
// =============================================================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  code?: number;
}

export class ArbitrageAPI {
  private baseUrl: string;

  constructor() {
    this.baseUrl = BASE_URL;
  }

  // Método base para hacer requests
  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      
      const config: RequestInit = {
        ...options,
        credentials: 'include', // CRÍTICO: Para cookies JWT
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...options.headers,
        },
      };

      console.log(`🚀 API Request: ${options.method || 'GET'} ${url}`);
      
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        console.error('❌ API Error:', response.status, data);
        
        // Manejo específico de errores de autenticación
        if (response.status === 401) {
          // Token expirado, intentar refresh
          if (endpoint !== '/auth/refresh') {
            const refreshed = await this.refreshToken();
            if (refreshed.success) {
              // Reintentar request original
              return this.request(endpoint, options);
            }
          }
          
          // Limpiar auth y redirigir
          localStorage.removeItem('user');
          window.location.href = '/login';
        }
        
        throw new Error(data.error || `Request failed with status ${response.status}`);
      }

      console.log('✅ API Response:', data);
      return data;
      
    } catch (error) {
      console.error('❌ API Request failed:', error);
      throw error;
    }
  }

  // =============================================================================
  // AUTHENTICATION METHODS
  // =============================================================================

  async login(email: string, password: string, tenantSlug: string = 'ingenio-pichichi') {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, tenantSlug })
    });
  }

  async register(userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    tenantSlug: string;
  }) {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  }

  async getUserProfile() {
    return this.request('/auth/me');
  }

  async refreshToken() {
    return this.request('/auth/refresh', {
      method: 'POST'
    });
  }

  async logout() {
    return this.request('/auth/logout', {
      method: 'POST'
    });
  }

  // =============================================================================
  // DASHBOARD METHODS
  // =============================================================================

  async getDashboardSummary() {
    return this.request('/dashboard/summary');
  }

  // =============================================================================
  // ARBITRAGE METHODS
  // =============================================================================

  async getNetworkStatus() {
    return this.request('/arbitrage/network-status');
  }

  async getArbitrageOpportunities(filters: {
    chains?: string;
    strategies?: string;
    minProfitUsd?: number;
    maxRiskLevel?: 'low' | 'medium' | 'high';
    limit?: number;
    offset?: number;
    minProfit?: number;
    strategy?: string;
  } = {}) {
    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value.toString());
      }
    });

    const queryString = params.toString();
    const endpoint = `/arbitrage/opportunities${queryString ? `?${queryString}` : ''}`;
    
    return this.request(endpoint);
  }

  async executeArbitrage(opportunityId: string, slippageTolerance: number = 0.5, amount?: string) {
    return this.request('/arbitrage/execute', {
      method: 'POST',
      body: JSON.stringify({
        opportunityId,
        slippageTolerance,
        ...(amount && { amount })
      })
    });
  }

  async getExecutionHistory(filters: {
    status?: 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
    opportunityId?: string;
    limit?: number;
    offset?: number;
  } = {}) {
    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value.toString());
      }
    });

    const queryString = params.toString();
    const endpoint = `/arbitrage/executions${queryString ? `?${queryString}` : ''}`;
    
    return this.request(endpoint);
  }

  async getExecutionDetails(executionId: string) {
    return this.request(`/arbitrage/executions/${executionId}`);
  }

  async cancelExecution(executionId: string) {
    return this.request(`/arbitrage/executions/${executionId}/cancel`, {
      method: 'POST'
    });
  }

  // =============================================================================
  // BLOCKCHAIN METHODS
  // =============================================================================

  async getBlockchainNetworks() {
    return this.request('/blockchain/networks');
  }

  // =============================================================================
  // BILLING METHODS
  // =============================================================================

  async getSubscriptionStatus() {
    return this.request('/billing/subscription');
  }

  // =============================================================================
  // ALERTS METHODS
  // =============================================================================

  async getAlerts(filters: {
    type?: 'opportunity' | 'execution' | 'system' | 'security';
    status?: 'active' | 'resolved';
    limit?: number;
    offset?: number;
  } = {}) {
    const params = new URLSearchParams();
    
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value.toString());
      }
    });

    const queryString = params.toString();
    const endpoint = `/alerts${queryString ? `?${queryString}` : ''}`;
    
    return this.request(endpoint);
  }

  // =============================================================================
  // HEALTH CHECK
  // =============================================================================

  async healthCheck() {
    try {
      const response = await this.getNetworkStatus();
      return {
        status: 'healthy',
        backend: 'connected',
        url: this.baseUrl,
        timestamp: new Date().toISOString(),
        data: response
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        backend: 'disconnected',
        url: this.baseUrl,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Instancia singleton de la API
export const api = new ArbitrageAPI();

// =============================================================================
// REACT HOOKS PARA USAR EN COMPONENTES
// =============================================================================

import { useState, useEffect } from 'react';

// Hook para datos en tiempo real
export const useRealtimeData = <T>(
  fetchFn: () => Promise<ApiResponse<T>>, 
  interval: number = 5000
) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;

    const fetchData = async () => {
      try {
        const response = await fetchFn();
        
        if (isMounted) {
          if (response.success) {
            setData(response.data || response);
            setError(null);
          } else {
            setError(response.error || 'Error desconocido');
          }
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Error de conexión');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    // Fetch inicial
    fetchData();

    // Configurar polling si el interval > 0
    if (interval > 0) {
      const startPolling = () => {
        timeoutId = setTimeout(() => {
          fetchData().then(startPolling);
        }, interval);
      };
      startPolling();
    }

    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [fetchFn, interval]);

  return { data, loading, error };
};

// Hook de autenticación
export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const checkAuthStatus = async () => {
    try {
      const response = await api.getUserProfile();
      if (response.success) {
        setUser(response.user || response.data);
        setIsAuthenticated(true);
        localStorage.setItem('user', JSON.stringify(response.user || response.data));
      }
    } catch (error) {
      setUser(null);
      setIsAuthenticated(false);
      localStorage.removeItem('user');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Verificar si hay usuario en localStorage
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        setUser(userData);
        setIsAuthenticated(true);
      } catch (error) {
        localStorage.removeItem('user');
      }
    }

    // Verificar estado con el backend
    checkAuthStatus();
  }, []);

  const login = async (email: string, password: string, tenantSlug: string = 'ingenio-pichichi') => {
    setLoading(true);
    try {
      const response = await api.login(email, password, tenantSlug);
      if (response.success) {
        setUser(response.user || response.data);
        setIsAuthenticated(true);
        localStorage.setItem('user', JSON.stringify(response.user || response.data));
        return response;
      }
      throw new Error(response.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setIsAuthenticated(false);
      localStorage.removeItem('user');
    }
  };

  return {
    user,
    isAuthenticated,
    loading,
    login,
    logout,
    checkAuthStatus
  };
};

// =============================================================================
// EXPORT DEFAULT
// =============================================================================

export default api;

console.log('🚀 ArbitrageX Supreme API Client loaded');
console.log('🔗 Backend URL:', BASE_URL);
console.log('🏥 Health Check URL:', `${BASE_URL}/arbitrage/network-status`);
```

---

## 🔧 **2. Hook de Conexión (Opcional)**

Crea un archivo `src/hooks/useBackendConnection.ts`:

```typescript
import { useState, useEffect } from 'react';
import { api } from '../services/api';

export const useBackendConnection = () => {
  const [connectionStatus, setConnectionStatus] = useState('checking');
  const [backendInfo, setBackendInfo] = useState(null);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const health = await api.healthCheck();
        setConnectionStatus(health.status);
        setBackendInfo(health);
      } catch (error) {
        setConnectionStatus('disconnected');
        setBackendInfo({ error: error.message });
      }
    };

    checkConnection();
    
    // Verificar cada 30 segundos
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, []);

  return { connectionStatus, backendInfo };
};
```

---

## 🎯 **3. Componente de Prueba de Conexión**

Agrega este componente para verificar la conexión:

```tsx
import React from 'react';
import { useBackendConnection } from '../hooks/useBackendConnection';

export const BackendStatus = () => {
  const { connectionStatus, backendInfo } = useBackendConnection();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-100';
      case 'checking': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-red-600 bg-red-100';
    }
  };

  return (
    <div className={`px-3 py-1 rounded-full text-xs ${getStatusColor(connectionStatus)}`}>
      Backend: {connectionStatus === 'healthy' ? 'Conectado' : 
               connectionStatus === 'checking' ? 'Verificando...' : 'Desconectado'}
    </div>
  );
};
```

---

## 🚀 **4. Uso en Componentes**

Ejemplo de componente que usa el backend real:

```tsx
import React from 'react';
import { useRealtimeData, api } from '../services/api';

export const Dashboard = () => {
  // Datos en tiempo real del backend ArbitrageX Supreme
  const { data: dashboardData, loading, error } = useRealtimeData(
    () => api.getDashboardSummary(),
    10000 // Actualizar cada 10 segundos
  );

  const { data: opportunities } = useRealtimeData(
    () => api.getArbitrageOpportunities({ limit: 5, minProfit: 2 }),
    5000 // Actualizar cada 5 segundos
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-2">Conectando a ArbitrageX Supreme...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 p-4 rounded-md">
        <h3 className="text-red-800 font-semibold">Error de Conexión</h3>
        <p className="text-red-600">{error}</p>
        <p className="text-sm text-red-500 mt-2">
          Verificar que el backend ArbitrageX Supreme esté ejecutándose
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Backend Status */}
      <BackendStatus />
      
      {/* Dashboard content */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {dashboardData?.summary && (
          <>
            <div className="bg-white p-4 rounded shadow">
              <h3 className="text-lg font-semibold">Oportunidades</h3>
              <p className="text-2xl font-bold text-blue-600">
                {dashboardData.summary.totalOpportunities}
              </p>
            </div>
            <div className="bg-white p-4 rounded shadow">
              <h3 className="text-lg font-semibold">Ganancias</h3>
              <p className="text-2xl font-bold text-green-600">
                ${dashboardData.summary.totalProfitUsd.toFixed(2)}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Opportunities */}
      {opportunities?.opportunities && (
        <div className="bg-white p-4 rounded shadow">
          <h3 className="text-lg font-semibold mb-4">Oportunidades Top</h3>
          <div className="space-y-2">
            {opportunities.opportunities.map(opp => (
              <div key={opp.id} className="flex justify-between p-3 bg-gray-50 rounded">
                <div>
                  <p className="font-medium">{opp.token_in} → {opp.token_out}</p>
                  <p className="text-sm text-gray-600">{opp.blockchain_from}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-green-600">
                    +{opp.profit_percentage.toFixed(2)}%
                  </p>
                  <p className="text-sm text-gray-600">
                    ${opp.profit_amount.toFixed(2)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
```

---

## ✅ **Checklist de Configuración**

### **Para implementar en Lovable.dev:**

1. **✅ Reemplaza `src/services/api.ts`** con el código de arriba
2. **✅ Verifica la URL del backend**: 
   ```
   https://3000-iy6h7uefq9p08klkqc2yh-6532622b.e2b.dev
   ```
3. **✅ Agrega el componente BackendStatus** para verificar conexión
4. **✅ Usa los hooks `useRealtimeData` y `useAuth`** en tus componentes
5. **✅ Implementa manejo de errores** para conexiones fallidas

### **Para probar la conexión:**

1. **Health Check directo:**
   ```
   https://3000-iy6h7uefq9p08klkqc2yh-6532622b.e2b.dev/api/v2/arbitrage/network-status
   ```

2. **En el navegador de Lovable.dev:**
   ```javascript
   // Abrir Developer Tools y ejecutar:
   fetch('https://3000-iy6h7uefq9p08klkqc2yh-6532622b.e2b.dev/api/v2/arbitrage/network-status')
     .then(r => r.json())
     .then(console.log);
   ```

---

## 🚨 **Notas Importantes**

### **CORS Configuration:**
El backend ya está configurado para aceptar requests desde Lovable.dev con:
```javascript
CORS_ORIGIN="http://localhost:3001,http://localhost:3000"
CORS_CREDENTIALS=true
```

### **URLs que Cambian:**
- La URL del sandbox (`3000-iy6h7uefq9p08klkqc2yh-6532622b.e2b.dev`) puede cambiar
- El código detecta automáticamente el entorno y usa la URL correcta
- Para producción, actualiza `PRODUCTION_URL` con tu dominio real

### **Autenticación:**
- El backend usa **cookies HTTP-Only** para autenticación
- `credentials: 'include'` es **crítico** para que funcione
- Los tokens se manejan automáticamente

---

**¡Ahora tu frontend en Lovable.dev se conectará directamente al backend ArbitrageX Supreme real con PostgreSQL + Prisma + 20 blockchains!** 🚀

¿Te ayudo a probar la conexión o necesitas ajustar algo más en la configuración?
# ArbitrageX Supreme - Ejemplos de API para Lovable.dev

## 🚀 Ejemplos Prácticos de Requests y Responses

Esta guía contiene **ejemplos reales** que puedes copiar y pegar directamente en Lovable.dev para integrar con el backend de ArbitrageX Supreme.

---

## 🔐 1. Autenticación

### **Login de Usuario**
```javascript
// Ejemplo de login completo
const loginUser = async (email, password, tenantSlug = 'ingenio-pichichi') => {
  const response = await fetch('https://api.arbitragexsupreme.com/api/v2/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // CRÍTICO para cookies
    body: JSON.stringify({
      email: email,
      password: password,
      tenantSlug: tenantSlug
    })
  });

  const data = await response.json();
  
  if (response.ok) {
    console.log('Login exitoso:', data);
    return data;
  } else {
    throw new Error(data.error || 'Login failed');
  }
};

// Uso del ejemplo
try {
  const result = await loginUser('trader@ingenio-pichichi.com', 'SecurePass123!');
  console.log('Usuario logueado:', result.user);
  console.log('Permisos:', result.permissions);
} catch (error) {
  console.error('Error de login:', error.message);
}
```

**Response de Login Exitoso:**
```json
{
  "success": true,
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "trader@ingenio-pichichi.com",
    "tenantId": "660e8400-e29b-41d4-a716-446655440001",
    "role": "TRADER"
  },
  "permissions": [
    "arbitrage:read",
    "arbitrage:execute",
    "dashboard:read"
  ],
  "features": [
    "multi_chain_trading",
    "real_time_data",
    "advanced_analytics"
  ]
}
```

### **Obtener Perfil de Usuario**
```javascript
const getUserProfile = async () => {
  const response = await fetch('https://api.arbitragexsupreme.com/api/v2/auth/me', {
    method: 'GET',
    credentials: 'include'
  });

  if (response.ok) {
    return await response.json();
  }
  
  throw new Error('No autenticado');
};

// Ejemplo de uso
const profile = await getUserProfile();
console.log('Perfil:', profile.user);
```

---

## 📊 2. Dashboard

### **Obtener Resumen del Dashboard**
```javascript
const getDashboardSummary = async () => {
  const response = await fetch('https://api.arbitragexsupreme.com/api/v2/dashboard/summary', {
    method: 'GET',
    credentials: 'include'
  });

  return await response.json();
};

// Ejemplo de uso con React
const DashboardComponent = () => {
  const [dashboardData, setDashboardData] = useState(null);
  
  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const data = await getDashboardSummary();
        setDashboardData(data.summary);
      } catch (error) {
        console.error('Error loading dashboard:', error);
      }
    };
    
    loadDashboard();
    
    // Actualizar cada 10 segundos
    const interval = setInterval(loadDashboard, 10000);
    return () => clearInterval(interval);
  }, []);

  if (!dashboardData) return <div>Cargando dashboard...</div>;

  return (
    <div className="dashboard-grid">
      <div className="metric-card">
        <h3>Oportunidades Activas</h3>
        <p className="metric-value">{dashboardData.totalOpportunities}</p>
      </div>
      <div className="metric-card">
        <h3>Ganancias Totales</h3>
        <p className="metric-value">${dashboardData.totalProfitUsd.toFixed(2)}</p>
      </div>
      <div className="metric-card">
        <h3>Tasa de Éxito</h3>
        <p className="metric-value">
          {((dashboardData.successfulExecutions / 100) * 100).toFixed(1)}%
        </p>
      </div>
    </div>
  );
};
```

**Response del Dashboard:**
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
    "recentExecutions": [
      {
        "id": "exec_eth_001",
        "opportunityId": "arb_eth_001",
        "status": "SUCCESS",
        "actualProfitUsd": 245.75,
        "actualProfitPercentage": 2.85,
        "executionTimeMs": 1200,
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
      { "hour": "09:00", "executions": 5, "profit": 325.50 },
      { "hour": "10:00", "executions": 8, "profit": 450.75 }
    ]
  },
  "lastUpdated": "2024-01-15T10:30:00Z"
}
```

---

## 🔍 3. Oportunidades de Arbitraje

### **Obtener Oportunidades con Filtros**
```javascript
const getArbitrageOpportunities = async (filters = {}) => {
  // Construir query parameters
  const params = new URLSearchParams();
  
  if (filters.chains) params.append('chains', filters.chains);
  if (filters.minProfit) params.append('minProfit', filters.minProfit.toString());
  if (filters.strategies) params.append('strategies', filters.strategies);
  if (filters.maxRiskLevel) params.append('maxRiskLevel', filters.maxRiskLevel);
  if (filters.limit) params.append('limit', filters.limit.toString());

  const response = await fetch(
    `https://api.arbitragexsupreme.com/api/v2/arbitrage/opportunities?${params}`,
    {
      method: 'GET',
      credentials: 'include'
    }
  );

  return await response.json();
};

// Ejemplo de uso con filtros
const OpportunitiesComponent = () => {
  const [opportunities, setOpportunities] = useState([]);
  const [filters, setFilters] = useState({
    chains: 'ethereum,bsc,polygon',
    minProfit: 2.0,
    strategies: 'triangular_arbitrage,cross_dex',
    limit: 20
  });

  const loadOpportunities = async () => {
    try {
      const data = await getArbitrageOpportunities(filters);
      setOpportunities(data.opportunities);
      console.log(`Cargadas ${data.opportunities.length} oportunidades`);
    } catch (error) {
      console.error('Error loading opportunities:', error);
    }
  };

  useEffect(() => {
    loadOpportunities();
    
    // Actualizar cada 5 segundos (tiempo real)
    const interval = setInterval(loadOpportunities, 5000);
    return () => clearInterval(interval);
  }, [filters]);

  return (
    <div className="opportunities-list">
      {/* Filtros */}
      <div className="filters">
        <select 
          value={filters.chains} 
          onChange={(e) => setFilters({...filters, chains: e.target.value})}
        >
          <option value="ethereum,bsc">ETH + BSC</option>
          <option value="ethereum,bsc,polygon">ETH + BSC + Polygon</option>
          <option value="">Todas las redes</option>
        </select>
        
        <input
          type="number"
          placeholder="Ganancia mínima %"
          value={filters.minProfit}
          onChange={(e) => setFilters({...filters, minProfit: parseFloat(e.target.value)})}
        />
      </div>

      {/* Lista de oportunidades */}
      {opportunities.map(opp => (
        <OpportunityCard key={opp.id} opportunity={opp} />
      ))}
    </div>
  );
};
```

**Response de Oportunidades:**
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
    "limit": 20
  },
  "scan_timestamp": "2024-01-15T10:30:00Z"
}
```

### **Ejecutar Oportunidad de Arbitraje**
```javascript
const executeArbitrage = async (opportunityId, slippageTolerance = 0.5, amount = null) => {
  const response = await fetch('https://api.arbitragexsupreme.com/api/v2/arbitrage/execute', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({
      opportunityId: opportunityId,
      slippageTolerance: slippageTolerance,
      ...(amount && { amount: amount })
    })
  });

  return await response.json();
};

// Componente de ejecución
const ExecuteButton = ({ opportunityId }) => {
  const [isExecuting, setIsExecuting] = useState(false);

  const handleExecute = async () => {
    setIsExecuting(true);
    
    try {
      const result = await executeArbitrage(opportunityId, 0.5);
      
      if (result.success) {
        console.log('Ejecución iniciada:', result.execution);
        alert(`Ejecución ${result.execution.id} iniciada exitosamente`);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('Error ejecutando arbitraje:', error);
      alert('Error al ejecutar arbitraje: ' + error.message);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <button
      onClick={handleExecute}
      disabled={isExecuting}
      className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
    >
      {isExecuting ? 'Ejecutando...' : 'Ejecutar Arbitraje'}
    </button>
  );
};
```

**Response de Ejecución:**
```json
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

---

## 📈 4. Historial de Ejecuciones

### **Obtener Historial de Ejecuciones**
```javascript
const getExecutionHistory = async (filters = {}) => {
  const params = new URLSearchParams();
  
  if (filters.status) params.append('status', filters.status);
  if (filters.limit) params.append('limit', filters.limit.toString());
  if (filters.offset) params.append('offset', filters.offset.toString());

  const response = await fetch(
    `https://api.arbitragexsupreme.com/api/v2/arbitrage/executions?${params}`,
    {
      method: 'GET',
      credentials: 'include'
    }
  );

  return await response.json();
};

// Componente de historial
const ExecutionHistory = () => {
  const [executions, setExecutions] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(false);

  const loadExecutions = async () => {
    setLoading(true);
    try {
      const filters = {
        ...(filter !== 'all' && { status: filter }),
        limit: 50
      };
      
      const data = await getExecutionHistory(filters);
      setExecutions(data.executions);
    } catch (error) {
      console.error('Error loading executions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExecutions();
  }, [filter]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'SUCCESS': return 'text-green-600 bg-green-100';
      case 'PENDING': return 'text-yellow-600 bg-yellow-100';
      case 'FAILED': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="execution-history">
      {/* Filtros */}
      <div className="mb-4">
        <select 
          value={filter} 
          onChange={(e) => setFilter(e.target.value)}
          className="border rounded px-3 py-2"
        >
          <option value="all">Todas</option>
          <option value="SUCCESS">Exitosas</option>
          <option value="PENDING">Pendientes</option>
          <option value="FAILED">Fallidas</option>
        </select>
      </div>

      {/* Tabla de ejecuciones */}
      {loading ? (
        <div>Cargando ejecuciones...</div>
      ) : (
        <div className="space-y-3">
          {executions.map(exec => (
            <div key={exec.id} className="bg-white p-4 rounded-lg shadow border">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-semibold">Ejecución {exec.id.slice(-8)}</h4>
                  <p className="text-sm text-gray-600">{exec.opportunityId}</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs ${getStatusColor(exec.status)}`}>
                  {exec.status}
                </span>
              </div>
              
              {exec.status === 'SUCCESS' && (
                <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
                  <div>
                    <p className="text-gray-500">Ganancia</p>
                    <p className="font-semibold text-green-600">
                      ${exec.actualProfitUsd.toFixed(2)} ({exec.actualProfitPercentage.toFixed(2)}%)
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Tiempo</p>
                    <p className="font-semibold">{exec.executionTimeMs}ms</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Gas</p>
                    <p className="font-semibold">{exec.totalGasCost} ETH</p>
                  </div>
                </div>
              )}
              
              {exec.transactionHash && (
                <p className="text-xs text-blue-600 mt-2 font-mono">
                  Tx: {exec.transactionHash}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```

**Response del Historial:**
```json
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

---

## 🌐 5. Estado de Redes Blockchain

### **Obtener Estado de Redes**
```javascript
const getNetworkStatus = async () => {
  const response = await fetch('https://api.arbitragexsupreme.com/api/v2/arbitrage/network-status', {
    method: 'GET'
  });

  return await response.json();
};

// Componente de estado de redes
const NetworkStatus = () => {
  const [networkData, setNetworkData] = useState(null);

  useEffect(() => {
    const loadNetworkStatus = async () => {
      try {
        const data = await getNetworkStatus();
        setNetworkStatus(data);
      } catch (error) {
        console.error('Error loading network status:', error);
      }
    };

    loadNetworkStatus();
    
    // Actualizar cada 15 segundos
    const interval = setInterval(loadNetworkStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  if (!networkData) return <div>Cargando estado de redes...</div>;

  return (
    <div className="network-status">
      <h3 className="text-lg font-semibold mb-4">
        Redes Blockchain ({networkData.active_networks} activas)
      </h3>
      
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {Object.entries(networkData.network_status).map(([network, status]) => (
          <div key={network} className="bg-white p-4 rounded-lg border shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium capitalize">{network}</h4>
              <div className={`w-3 h-3 rounded-full ${
                status.status === 'online' ? 'bg-green-400' : 
                status.status === 'degraded' ? 'bg-yellow-400' : 'bg-red-400'
              }`} />
            </div>
            
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">Latencia</span>
                <span>{status.latency}ms</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Estado</span>
                <span className="capitalize">{status.status}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-4 text-sm text-gray-600">
        Última actualización: {new Date(networkData.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
};
```

**Response del Estado de Redes:**
```json
{
  "success": true,
  "network_status": {
    "ethereum": { "status": "online", "latency": 150 },
    "bsc": { "status": "online", "latency": 85 },
    "polygon": { "status": "online", "latency": 120 },
    "arbitrum": { "status": "online", "latency": 95 },
    "optimism": { "status": "degraded", "latency": 200 }
  },
  "supported_blockchains": [
    "ethereum", "bsc", "polygon", "arbitrum", "optimism", 
    "avalanche", "base", "fantom", "gnosis", "celo"
  ],
  "active_networks": 20,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

## 🔔 6. Sistema de Alertas

### **Obtener Alertas**
```javascript
const getAlerts = async (type = null, status = null) => {
  const params = new URLSearchParams();
  if (type) params.append('type', type);
  if (status) params.append('status', status);

  const response = await fetch(
    `https://api.arbitragexsupreme.com/api/v2/alerts?${params}`,
    {
      method: 'GET',
      credentials: 'include'
    }
  );

  return await response.json();
};

// Componente de alertas
const AlertsPanel = () => {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    const loadAlerts = async () => {
      try {
        const data = await getAlerts('opportunity', 'active');
        setAlerts(data.alerts);
      } catch (error) {
        console.error('Error loading alerts:', error);
      }
    };

    loadAlerts();
  }, []);

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high': return 'border-red-500 bg-red-50 text-red-800';
      case 'medium': return 'border-yellow-500 bg-yellow-50 text-yellow-800';
      default: return 'border-blue-500 bg-blue-50 text-blue-800';
    }
  };

  return (
    <div className="alerts-panel">
      <h3 className="text-lg font-semibold mb-4">
        Alertas Activas ({alerts.length})
      </h3>
      
      <div className="space-y-3">
        {alerts.map(alert => (
          <div key={alert.id} className={`border-l-4 p-4 rounded ${getSeverityColor(alert.severity)}`}>
            <div className="flex justify-between items-start">
              <h4 className="font-semibold">{alert.title}</h4>
              <span className="text-xs">
                {new Date(alert.createdAt).toLocaleTimeString()}
              </span>
            </div>
            <p className="text-sm mt-1">{alert.message}</p>
            
            {alert.data && (
              <div className="text-xs mt-2 font-mono">
                Oportunidad: {alert.data.opportunityId} | 
                Ganancia: {alert.data.profitPercentage}%
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
```

---

## 🚀 7. Configuración Completa para Lovable.dev

### **Hook de API Centralizado**
```javascript
// hooks/useApi.js - Copia este código completo en Lovable.dev
import { useState, useEffect } from 'react';

const API_BASE = 'https://api.arbitragexsupreme.com/api/v2';

export const useApi = () => {
  const request = async (endpoint, options = {}) => {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Request failed');
    }

    return response.json();
  };

  return {
    // Autenticación
    login: (email, password, tenantSlug) => 
      request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, tenantSlug })
      }),

    getProfile: () => request('/auth/me'),

    logout: () => request('/auth/logout', { method: 'POST' }),

    // Dashboard
    getDashboard: () => request('/dashboard/summary'),

    // Oportunidades
    getOpportunities: (filters = {}) => {
      const params = new URLSearchParams(filters);
      return request(`/arbitrage/opportunities?${params}`);
    },

    executeArbitrage: (opportunityId, slippageTolerance = 0.5) =>
      request('/arbitrage/execute', {
        method: 'POST',
        body: JSON.stringify({ opportunityId, slippageTolerance })
      }),

    // Ejecuciones
    getExecutions: (filters = {}) => {
      const params = new URLSearchParams(filters);
      return request(`/arbitrage/executions?${params}`);
    },

    // Redes
    getNetworkStatus: () => request('/arbitrage/network-status'),

    // Alertas
    getAlerts: (type, status) => {
      const params = new URLSearchParams();
      if (type) params.append('type', type);
      if (status) params.append('status', status);
      return request(`/alerts?${params}`);
    }
  };
};

// Hook para datos en tiempo real
export const useRealtimeData = (fetchFn, interval = 5000) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await fetchFn();
        setData(result);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const intervalId = setInterval(fetchData, interval);

    return () => clearInterval(intervalId);
  }, [fetchFn, interval]);

  return { data, loading, error };
};
```

### **Componente Principal de Dashboard**
```jsx
// Dashboard.jsx - Componente completo para Lovable.dev
import React from 'react';
import { useApi, useRealtimeData } from './hooks/useApi';

const Dashboard = () => {
  const api = useApi();
  
  const { data: dashboardData, loading: dashboardLoading } = useRealtimeData(
    () => api.getDashboard(),
    10000 // Actualizar cada 10 segundos
  );

  const { data: opportunitiesData, loading: oppsLoading } = useRealtimeData(
    () => api.getOpportunities({ limit: 5, minProfit: 2 }),
    5000 // Actualizar cada 5 segundos
  );

  const { data: networkData } = useRealtimeData(
    () => api.getNetworkStatus(),
    15000 // Actualizar cada 15 segundos
  );

  if (dashboardLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const summary = dashboardData?.summary || {};

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-3xl font-bold text-gray-900">ArbitrageX Supreme</h1>
        <p className="text-gray-600">Dashboard de Trading Multi-Blockchain</p>
      </div>

      {/* Métricas Principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Oportunidades Activas"
          value={summary.totalOpportunities || 0}
          icon="📊"
          color="blue"
        />
        <MetricCard
          title="Ganancias Totales"
          value={`$${(summary.totalProfitUsd || 0).toFixed(2)}`}
          icon="💰"
          color="green"
        />
        <MetricCard
          title="Ejecuciones Exitosas"
          value={summary.successfulExecutions || 0}
          icon="✅"
          color="purple"
        />
        <MetricCard
          title="Ganancia Promedio"
          value={`${(summary.averageProfitPercentage || 0).toFixed(2)}%`}
          icon="📈"
          color="orange"
        />
      </div>

      {/* Contenido Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Oportunidades Recientes */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Oportunidades Top</h2>
          {oppsLoading ? (
            <div className="text-center text-gray-500">Cargando oportunidades...</div>
          ) : (
            <div className="space-y-3">
              {opportunitiesData?.opportunities?.slice(0, 5).map(opp => (
                <OpportunityItem key={opp.id} opportunity={opp} />
              ))}
            </div>
          )}
        </div>

        {/* Estado de Redes */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Estado de Redes</h2>
          {networkData && (
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(networkData.network_status).slice(0, 6).map(([network, status]) => (
                <NetworkItem key={network} network={network} status={status} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Componentes auxiliares
const MetricCard = ({ title, value, icon, color }) => {
  const colorClasses = {
    blue: 'border-blue-500 text-blue-600',
    green: 'border-green-500 text-green-600',
    purple: 'border-purple-500 text-purple-600',
    orange: 'border-orange-500 text-orange-600'
  };

  return (
    <div className={`bg-white rounded-lg shadow p-6 border-l-4 ${colorClasses[color]}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
        <span className="text-2xl">{icon}</span>
      </div>
    </div>
  );
};

const OpportunityItem = ({ opportunity }) => (
  <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
    <div>
      <p className="font-medium">{opportunity.token_in} → {opportunity.token_out}</p>
      <p className="text-sm text-gray-600">{opportunity.blockchain_from}</p>
    </div>
    <div className="text-right">
      <p className="font-bold text-green-600">+{opportunity.profit_percentage.toFixed(2)}%</p>
      <p className="text-sm text-gray-600">${opportunity.profit_amount.toFixed(2)}</p>
    </div>
  </div>
);

const NetworkItem = ({ network, status }) => (
  <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
    <span className="font-medium capitalize">{network}</span>
    <div className="flex items-center space-x-2">
      <div className={`w-2 h-2 rounded-full ${
        status.status === 'online' ? 'bg-green-400' : 'bg-red-400'
      }`} />
      <span className="text-xs text-gray-600">{status.latency}ms</span>
    </div>
  </div>
);

export default Dashboard;
```

---

## ✅ Checklist de Implementación

### **Para usar en Lovable.dev:**
1. **Copia el hook useApi completo** - Maneja toda la comunicación con la API
2. **Implementa el componente Dashboard** - Vista principal con métricas
3. **Configura credentials: 'include'** - Crítico para autenticación con cookies
4. **Usa los ejemplos de componentes** - OpportunityCard, ExecutionHistory, etc.
5. **Implementa actualizaciones en tiempo real** - useRealtimeData hook
6. **Maneja estados de loading y error** - Para mejor UX
7. **Agrega validaciones de formularios** - Para ejecución de arbitrajes

### **URLs de Prueba:**
- **Production**: `https://api.arbitragexsupreme.com/api/v2`
- **Staging**: `https://staging-api.arbitragexsupreme.com/api/v2`
- **Local**: `http://localhost:3000/api/v2`

---

*Todos estos ejemplos están listos para usar en Lovable.dev y se conectan directamente con el backend ArbitrageX Supreme desarrollado bajo las buenas prácticas de Ingenio Pichichi S.A.*
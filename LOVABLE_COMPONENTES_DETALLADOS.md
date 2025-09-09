# ArbitrageX Supreme v3.0 - Componentes Específicos para Lovable

## 🎯 METODOLOGÍA INGENIO PICHICHI S.A - COMPONENTES LOVABLE DETALLADOS

### **Frontend Dashboard React Completo en Lovable**

---

## 📊 **A. DASHBOARD DE OPORTUNIDADES - COMPONENTES LOVABLE**

### **🔍 1. OpportunityMonitor (Componente Principal)**

```typescript
// components/OpportunityMonitor.tsx
interface OpportunityMonitorProps {
  realTimeEnabled: boolean;
  autoRefresh: boolean;
  filterPresets: FilterPreset[];
}

const OpportunityMonitor = ({ realTimeEnabled, autoRefresh, filterPresets }: OpportunityMonitorProps) => {
  // Lovable auto-generates with:
  // - Real-time WebSocket connection
  // - Opportunity cards grid layout
  // - Filter sidebar integration
  // - Performance metrics display
  // - Auto-refresh controls
}
```

**Características Lovable:**
- ✅ **Drag & Drop Layout**: Grid responsive de oportunidades
- ✅ **Real-time Updates**: WebSocket integration automática
- ✅ **Filter Integration**: Sidebar filters con shadcn/ui
- ✅ **Performance Display**: Métricas tiempo real
- ✅ **Auto-refresh**: Toggle controls automáticos

### **💳 2. OpportunityCard (Sub-componente)**

```typescript
// components/OpportunityCard.tsx
interface OpportunityCardProps {
  opportunity: ArbitrageOpportunity;
  onExecute: (id: string) => void;
  onAnalyze: (id: string) => void;
  executionStatus: ExecutionStatus;
}

// Lovable Features:
// - shadcn/ui Card component base
// - Animated profit calculator
// - Risk assessment indicators  
// - Chain & DEX badges
// - Execute button with loading states
```

**Elementos Visuales Lovable:**
- ✅ **Card Layout**: shadcn/ui Card con hover animations
- ✅ **Profit Display**: Animated counters con Framer Motion
- ✅ **Risk Indicators**: Color-coded badges dinámicos
- ✅ **Chain Logos**: Asset display automático
- ✅ **Action Buttons**: Loading states integrados

### **🎛️ 3. OpportunityFilters (Sidebar Component)**

```typescript
// components/OpportunityFilters.tsx
interface FilterConfig {
  chains: ChainFilter[];
  strategies: StrategyFilter[];
  profitRange: ProfitRangeFilter;
  riskLevel: RiskLevelFilter;
  timeRange: TimeRangeFilter;
}

// Lovable Auto-generates:
// - Multi-select chain dropdown
// - Strategy checkboxes with icons
// - Profit range slider
// - Risk level radio buttons
// - Time range picker
```

**Controles Lovable:**
- ✅ **Multi-Select**: Dropdown chains con logos
- ✅ **Checkboxes**: Strategy selection con iconos
- ✅ **Range Slider**: Profit threshold con valores dinámicos
- ✅ **Radio Groups**: Risk level selection
- ✅ **Date Picker**: Time range con presets

### **📈 4. OpportunityStats (Metrics Display)**

```typescript
// components/OpportunityStats.tsx
interface StatsConfig {
  totalOpportunities: number;
  successRate: number;
  avgProfit: number;
  topChains: ChainStats[];
  strategyRanking: StrategyStats[];
}

// Lovable Features:
// - Animated stat cards
// - Mini charts integration  
// - Trend indicators
// - Comparison displays
// - Real-time updates
```

**Visualización Lovable:**
- ✅ **Stat Cards**: Animated numbers con iconos
- ✅ **Mini Charts**: Sparklines integradas
- ✅ **Trend Arrows**: Up/down indicators animados
- ✅ **Progress Bars**: Success rate visual
- ✅ **Ranking Lists**: Top performers con badges

---

## 📈 **B. GRÁFICOS Y MÉTRICAS - COMPONENTES LOVABLE**

### **📊 1. PerformanceCharts (Charts Principal)**

```typescript
// components/PerformanceCharts.tsx
import { LineChart, BarChart, PieChart } from 'recharts';

interface ChartConfig {
  pnlData: PnLDataPoint[];
  roiData: ROIDataPoint[];
  successRateData: SuccessRateDataPoint[];
  timeRange: TimeRangeSelection;
}

const PerformanceCharts = ({ pnlData, roiData, successRateData, timeRange }: ChartConfig) => {
  // Lovable auto-generates:
  // - Responsive chart container
  // - Interactive legends
  // - Zoom & pan controls
  // - Export functionality
  // - Real-time data updates
}
```

**Charts Específicos Lovable:**

#### **📈 P&L Real-time Chart**
```typescript
// P&L Line Chart con Recharts
<LineChart width={800} height={400} data={pnlData}>
  <XAxis dataKey="timestamp" />
  <YAxis />
  <CartesianGrid strokeDasharray="3 3" />
  <Tooltip formatter={(value) => [`$${value}`, 'P&L']} />
  <Legend />
  <Line 
    type="monotone" 
    dataKey="cumulative_pnl" 
    stroke="#10b981" 
    strokeWidth={2}
    animationDuration={300}
  />
  <Line 
    type="monotone" 
    dataKey="daily_pnl" 
    stroke="#3b82f6" 
    strokeWidth={2}
  />
</LineChart>
```

#### **📊 ROI por Estrategia Bar Chart**
```typescript
// ROI Bar Chart con animaciones
<BarChart width={800} height={400} data={roiData}>
  <XAxis dataKey="strategy_name" />
  <YAxis />
  <CartesianGrid strokeDasharray="3 3" />
  <Tooltip formatter={(value) => [`${value}%`, 'ROI']} />
  <Bar 
    dataKey="roi_percentage" 
    fill="#8884d8"
    animationDuration={500}
  >
    {roiData.map((entry, index) => (
      <Cell key={`cell-${index}`} fill={getROIColor(entry.roi_percentage)} />
    ))}
  </Bar>
</BarChart>
```

### **🎯 2. TechnicalMetrics (Métricas Técnicas)**

```typescript
// components/TechnicalMetrics.tsx
interface TechnicalMetricsProps {
  latencyData: LatencyMetrics[];
  throughputData: ThroughputMetrics[];
  errorRateData: ErrorRateMetrics[];
  systemHealthData: SystemHealthMetrics[];
}

// Lovable Components:
// - Real-time gauge charts
// - Performance indicator lights
// - System health dashboard
// - Alert integration
```

**Métricas Visuales Lovable:**
- ✅ **Gauge Charts**: Latency performance con colores
- ✅ **Status Lights**: System health indicators
- ✅ **Progress Rings**: Throughput visualization
- ✅ **Alert Badges**: Error rate warnings
- ✅ **Timeline Charts**: Historical performance

### **🌍 3. MarketAnalytics (Analytics Mercado)**

```typescript
// components/MarketAnalytics.tsx
import { Heatmap, NetworkGraph, TreeMap } from 'd3-react-components';

interface MarketAnalyticsProps {
  marketTrends: MarketTrendData[];
  competitiveData: CompetitiveAnalysisData[];
  opportunityHeatmap: HeatmapData[][];
  correlationMatrix: CorrelationData[][];
}

// Lovable D3.js Integration:
// - Interactive heatmaps
// - Network relationship graphs
// - Treemap visualizations
// - Correlation matrices
```

**Visualizaciones Avanzadas:**
- ✅ **Heatmaps**: Opportunity density por chain/DEX
- ✅ **Network Graphs**: Blockchain interconnections
- ✅ **Treemaps**: Market share hierarchical
- ✅ **Scatter Plots**: Risk vs Reward analysis
- ✅ **Correlation Matrix**: Strategy correlations

---

## 🎨 **C. COMPONENTES SHADCN/UI - LOVABLE INTEGRATION**

### **🛠️ 1. Core shadcn/ui Components**

```typescript
// Lovable auto-imports and configures:
import {
  Button, Input, Card, CardContent, CardHeader, CardTitle,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger,
  Tabs, TabsContent, TabsList, TabsTrigger,
  Badge, Progress, Toast, useToast,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui"
```

### **💳 2. MEV-Specific Custom Components**

#### **🎯 MEVStrategyCard**
```typescript
// components/ui/MEVStrategyCard.tsx
interface MEVStrategyCardProps {
  strategy: MEVStrategy;
  performance: StrategyPerformance;
  isActive: boolean;
  onToggle: () => void;
  onConfigure: () => void;
}

const MEVStrategyCard = ({ strategy, performance, isActive, onToggle, onConfigure }: MEVStrategyCardProps) => (
  <Card className={`transition-all duration-200 ${isActive ? 'border-green-500 bg-green-50 dark:bg-green-950' : 'border-gray-200'}`}>
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{strategy.name}</CardTitle>
      <Badge variant={isActive ? "default" : "secondary"}>
        {isActive ? "Active" : "Inactive"}
      </Badge>
    </CardHeader>
    <CardContent>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">24h Profit</span>
          <span className="text-sm font-bold text-green-600">
            ${performance.profit24h.toFixed(2)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Success Rate</span>
          <span className="text-sm font-medium">
            {performance.successRate.toFixed(1)}%
          </span>
        </div>
        <Progress value={performance.successRate} className="h-1" />
        <div className="flex space-x-2 mt-4">
          <Button 
            size="sm" 
            variant={isActive ? "destructive" : "default"}
            onClick={onToggle}
            className="flex-1"
          >
            {isActive ? "Disable" : "Enable"}
          </Button>
          <Button size="sm" variant="outline" onClick={onConfigure}>
            Configure
          </Button>
        </div>
      </div>
    </CardContent>
  </Card>
);
```

#### **📊 ProfitCalculator Widget**
```typescript
// components/ui/ProfitCalculator.tsx
interface ProfitCalculatorProps {
  opportunity: ArbitrageOpportunity;
  gasPrice: number;
  slippage: number;
  onCalculate: (result: ProfitCalculation) => void;
}

const ProfitCalculator = ({ opportunity, gasPrice, slippage, onCalculate }: ProfitCalculatorProps) => (
  <Card className="w-full max-w-md">
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <Calculator className="h-4 w-4" />
        Profit Calculator
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">Amount</label>
          <Input
            type="number"
            placeholder="1000"
            className="mt-1"
          />
        </div>
        <div>
          <label className="text-sm font-medium">Gas Price</label>
          <Input
            type="number"
            value={gasPrice}
            className="mt-1"
          />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium">Max Slippage (%)</label>
        <Input
          type="number"
          value={slippage}
          step="0.1"
          className="mt-1"
        />
      </div>
      <div className="bg-green-50 dark:bg-green-950 p-3 rounded-lg">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Expected Profit:</span>
          <span className="font-bold text-green-600">
            ${opportunity.estimatedProfit.toFixed(2)}
          </span>
        </div>
        <div className="flex justify-between items-center mt-1">
          <span className="text-sm text-gray-600">ROI:</span>
          <span className="font-medium">
            {opportunity.estimatedROI.toFixed(2)}%
          </span>
        </div>
      </div>
      <Button onClick={() => onCalculate(opportunity)} className="w-full">
        Calculate & Execute
      </Button>
    </CardContent>
  </Card>
);
```

#### **⚠️ RiskAssessment Component**
```typescript
// components/ui/RiskAssessment.tsx
interface RiskAssessmentProps {
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  factors: RiskFactor[];
  confidence: number;
}

const RiskAssessment = ({ riskLevel, factors, confidence }: RiskAssessmentProps) => (
  <Card className="border-l-4 border-l-yellow-500">
    <CardHeader className="pb-3">
      <CardTitle className="flex items-center gap-2">
        <Shield className="h-4 w-4" />
        Risk Assessment
        <Badge 
          variant={riskLevel === 'LOW' ? 'default' : riskLevel === 'MEDIUM' ? 'secondary' : 'destructive'}
        >
          {riskLevel}
        </Badge>
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Confidence Level:</span>
          <span className="font-medium">{confidence}%</span>
        </div>
        <Progress value={confidence} className="h-2" />
        
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Risk Factors:</h4>
          {factors.map((factor, index) => (
            <div key={index} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  factor.severity === 'HIGH' ? 'bg-red-500' : 
                  factor.severity === 'MEDIUM' ? 'bg-yellow-500' : 'bg-green-500'
                }`} />
                {factor.name}
              </span>
              <span className="text-gray-500">{factor.impact}</span>
            </div>
          ))}
        </div>
      </div>
    </CardContent>
  </Card>
);
```

### **🎛️ 3. Layout Components**

#### **📱 DashboardLayout**
```typescript
// components/layout/DashboardLayout.tsx
interface DashboardLayoutProps {
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  header?: React.ReactNode;
}

const DashboardLayout = ({ children, sidebar, header }: DashboardLayoutProps) => (
  <div className="min-h-screen bg-background">
    {/* Top Navigation */}
    <header className="border-b">
      <div className="flex h-16 items-center px-4">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-bold">ArbitrageX Supreme v3.0</h1>
        </div>
        <div className="ml-auto flex items-center space-x-4">
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
          <Button variant="outline" size="sm">
            <User className="h-4 w-4 mr-2" />
            Profile
          </Button>
        </div>
      </div>
    </header>

    <div className="flex">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-muted/50 p-4">
        <nav className="space-y-2">
          <Button variant="ghost" className="w-full justify-start">
            <BarChart3 className="mr-2 h-4 w-4" />
            Dashboard
          </Button>
          <Button variant="ghost" className="w-full justify-start">
            <Target className="mr-2 h-4 w-4" />
            Opportunities
          </Button>
          <Button variant="ghost" className="w-full justify-start">
            <Zap className="mr-2 h-4 w-4" />
            Strategies
          </Button>
          <Button variant="ghost" className="w-full justify-start">
            <Activity className="mr-2 h-4 w-4" />
            Executions
          </Button>
          <Button variant="ghost" className="w-full justify-start">
            <TrendingUp className="mr-2 h-4 w-4" />
            Analytics
          </Button>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6">
        {children}
      </main>
    </div>
  </div>
);
```

---

## 🔌 **D. WEBSOCKET CLIENT TIEMPO REAL - LOVABLE**

### **📡 1. WebSocketManager (Core Real-time)**

```typescript
// hooks/useWebSocketManager.ts
import { useEffect, useRef, useState } from 'react';
import { useToast } from '@/components/ui/use-toast';

interface WebSocketConfig {
  url: string;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  heartbeatInterval: number;
}

export const useWebSocketManager = (config: WebSocketConfig) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [lastMessage, setLastMessage] = useState<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const { toast } = useToast();

  const connect = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setConnectionStatus('connecting');
    wsRef.current = new WebSocket(config.url);

    wsRef.current.onopen = () => {
      setIsConnected(true);
      setConnectionStatus('connected');
      reconnectAttemptsRef.current = 0;
      
      toast({
        title: "Connection Established",
        description: "Real-time data stream is now active",
        variant: "default",
      });

      // Start heartbeat
      heartbeatIntervalRef.current = setInterval(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'heartbeat', timestamp: Date.now() }));
        }
      }, config.heartbeatInterval);
    };

    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLastMessage(data);
        
        // Handle different message types
        switch (data.type) {
          case 'opportunity_detected':
            // Trigger opportunity updates
            break;
          case 'execution_update':
            // Trigger execution status updates
            break;
          case 'system_alert':
            toast({
              title: "System Alert",
              description: data.message,
              variant: data.severity === 'high' ? 'destructive' : 'default',
            });
            break;
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    wsRef.current.onerror = (error) => {
      setConnectionStatus('error');
      toast({
        title: "Connection Error",
        description: "Failed to establish real-time connection",
        variant: "destructive",
      });
    };

    wsRef.current.onclose = () => {
      setIsConnected(false);
      setConnectionStatus('disconnected');
      
      // Clear heartbeat
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }

      // Attempt reconnection
      if (reconnectAttemptsRef.current < config.maxReconnectAttempts) {
        reconnectAttemptsRef.current++;
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, config.reconnectInterval);
      }
    };
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
    }
  };

  const sendMessage = (message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  };

  useEffect(() => {
    connect();
    return () => disconnect();
  }, []);

  return {
    isConnected,
    connectionStatus,
    lastMessage,
    sendMessage,
    connect,
    disconnect
  };
};
```

### **📊 2. Real-time Data Hooks**

#### **🎯 useOpportunities Hook**
```typescript
// hooks/useOpportunities.ts
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useWebSocketManager } from './useWebSocketManager';

export const useOpportunities = () => {
  const queryClient = useQueryClient();
  const { lastMessage, isConnected } = useWebSocketManager({
    url: process.env.NEXT_PUBLIC_WS_URL || 'wss://api.arbitragex.com/ws',
    reconnectInterval: 3000,
    maxReconnectAttempts: 5,
    heartbeatInterval: 30000
  });

  // Fetch initial opportunities
  const { data: opportunities, isLoading, error } = useQuery({
    queryKey: ['opportunities'],
    queryFn: async () => {
      const response = await fetch('/api/opportunities');
      if (!response.ok) throw new Error('Failed to fetch opportunities');
      return response.json();
    },
    refetchInterval: isConnected ? 0 : 10000, // Don't poll if WebSocket connected
  });

  // Update opportunities from WebSocket
  useEffect(() => {
    if (lastMessage?.type === 'opportunity_detected' || lastMessage?.type === 'opportunity_updated') {
      queryClient.setQueryData(['opportunities'], (old: any[]) => {
        if (!old) return [lastMessage.data];
        
        const existingIndex = old.findIndex(opp => opp.id === lastMessage.data.id);
        if (existingIndex >= 0) {
          const updated = [...old];
          updated[existingIndex] = lastMessage.data;
          return updated;
        } else {
          return [lastMessage.data, ...old].slice(0, 100); // Keep only latest 100
        }
      });
    }
  }, [lastMessage, queryClient]);

  return {
    opportunities: opportunities || [],
    isLoading,
    error,
    isConnected
  };
};
```

#### **⚡ useExecutions Hook**
```typescript
// hooks/useExecutions.ts
export const useExecutions = () => {
  const queryClient = useQueryClient();
  const { lastMessage, sendMessage } = useWebSocketManager({
    url: process.env.NEXT_PUBLIC_WS_URL || 'wss://api.arbitragex.com/ws',
    reconnectInterval: 3000,
    maxReconnectAttempts: 5,
    heartbeatInterval: 30000
  });

  const executeOpportunity = useMutation({
    mutationFn: async (opportunityId: string) => {
      const response = await fetch('/api/executions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunityId })
      });
      if (!response.ok) throw new Error('Execution failed');
      return response.json();
    },
    onSuccess: (data) => {
      // Subscribe to execution updates
      sendMessage({
        type: 'subscribe_execution',
        executionId: data.executionId
      });
    }
  });

  // Real-time execution updates
  useEffect(() => {
    if (lastMessage?.type === 'execution_update') {
      queryClient.setQueryData(['executions'], (old: any[]) => {
        if (!old) return [lastMessage.data];
        
        const existingIndex = old.findIndex(exec => exec.id === lastMessage.data.id);
        if (existingIndex >= 0) {
          const updated = [...old];
          updated[existingIndex] = { ...updated[existingIndex], ...lastMessage.data };
          return updated;
        }
        return old;
      });
    }
  }, [lastMessage, queryClient]);

  return {
    executeOpportunity: executeOpportunity.mutate,
    isExecuting: executeOpportunity.isPending
  };
};
```

---

## 🗃️ **E. ESTADO ZUSTAND + TANSTACK QUERY - LOVABLE**

### **📦 1. Zustand Stores**

#### **🎯 OpportunitiesStore**
```typescript
// stores/opportunitiesStore.ts
import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';

interface OpportunityFilters {
  chains: string[];
  strategies: string[];
  minProfit: number;
  maxRisk: number;
  timeRange: string;
}

interface OpportunitiesStore {
  opportunities: ArbitrageOpportunity[];
  filteredOpportunities: ArbitrageOpportunity[];
  filters: OpportunityFilters;
  selectedOpportunity: ArbitrageOpportunity | null;
  isRealTimeEnabled: boolean;
  
  // Actions
  setOpportunities: (opportunities: ArbitrageOpportunity[]) => void;
  updateOpportunity: (opportunity: ArbitrageOpportunity) => void;
  setFilters: (filters: Partial<OpportunityFilters>) => void;
  selectOpportunity: (opportunity: ArbitrageOpportunity | null) => void;
  toggleRealTime: () => void;
  applyFilters: () => void;
}

export const useOpportunitiesStore = create<OpportunitiesStore>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      opportunities: [],
      filteredOpportunities: [],
      filters: {
        chains: [],
        strategies: [],
        minProfit: 0,
        maxRisk: 100,
        timeRange: '24h'
      },
      selectedOpportunity: null,
      isRealTimeEnabled: true,

      setOpportunities: (opportunities) => {
        set({ opportunities });
        get().applyFilters();
      },

      updateOpportunity: (updatedOpportunity) => {
        const { opportunities } = get();
        const index = opportunities.findIndex(opp => opp.id === updatedOpportunity.id);
        
        if (index >= 0) {
          const newOpportunities = [...opportunities];
          newOpportunities[index] = updatedOpportunity;
          set({ opportunities: newOpportunities });
          get().applyFilters();
        } else {
          set({ opportunities: [updatedOpportunity, ...opportunities] });
          get().applyFilters();
        }
      },

      setFilters: (newFilters) => {
        set(state => ({
          filters: { ...state.filters, ...newFilters }
        }));
        get().applyFilters();
      },

      selectOpportunity: (opportunity) => {
        set({ selectedOpportunity: opportunity });
      },

      toggleRealTime: () => {
        set(state => ({ isRealTimeEnabled: !state.isRealTimeEnabled }));
      },

      applyFilters: () => {
        const { opportunities, filters } = get();
        
        const filtered = opportunities.filter(opp => {
          // Chain filter
          if (filters.chains.length > 0 && !filters.chains.includes(opp.chain)) {
            return false;
          }
          
          // Strategy filter
          if (filters.strategies.length > 0 && !filters.strategies.includes(opp.strategy)) {
            return false;
          }
          
          // Profit filter
          if (opp.estimatedProfit < filters.minProfit) {
            return false;
          }
          
          // Risk filter
          if (opp.riskScore > filters.maxRisk) {
            return false;
          }
          
          return true;
        });

        set({ filteredOpportunities: filtered });
      }
    })),
    { name: 'opportunities-store' }
  )
);
```

#### **⚙️ StrategiesStore**
```typescript
// stores/strategiesStore.ts
interface StrategyConfiguration {
  id: string;
  name: string;
  isActive: boolean;
  parameters: Record<string, any>;
  performance: StrategyPerformance;
}

interface StrategiesStore {
  strategies: StrategyConfiguration[];
  activeStrategies: StrategyConfiguration[];
  selectedStrategy: StrategyConfiguration | null;
  
  // Actions
  setStrategies: (strategies: StrategyConfiguration[]) => void;
  updateStrategy: (strategy: StrategyConfiguration) => void;
  toggleStrategy: (strategyId: string) => void;
  selectStrategy: (strategy: StrategyConfiguration | null) => void;
  updateStrategyParameters: (strategyId: string, parameters: Record<string, any>) => void;
}

export const useStrategiesStore = create<StrategiesStore>()(
  devtools((set, get) => ({
    strategies: [],
    activeStrategies: [],
    selectedStrategy: null,

    setStrategies: (strategies) => {
      set({ 
        strategies,
        activeStrategies: strategies.filter(s => s.isActive)
      });
    },

    updateStrategy: (updatedStrategy) => {
      const { strategies } = get();
      const newStrategies = strategies.map(s => 
        s.id === updatedStrategy.id ? updatedStrategy : s
      );
      
      set({ 
        strategies: newStrategies,
        activeStrategies: newStrategies.filter(s => s.isActive)
      });
    },

    toggleStrategy: (strategyId) => {
      const { strategies } = get();
      const newStrategies = strategies.map(s => 
        s.id === strategyId ? { ...s, isActive: !s.isActive } : s
      );
      
      set({ 
        strategies: newStrategies,
        activeStrategies: newStrategies.filter(s => s.isActive)
      });
    },

    selectStrategy: (strategy) => {
      set({ selectedStrategy: strategy });
    },

    updateStrategyParameters: (strategyId, parameters) => {
      const { strategies } = get();
      const newStrategies = strategies.map(s => 
        s.id === strategyId ? { ...s, parameters: { ...s.parameters, ...parameters } } : s
      );
      
      set({ strategies: newStrategies });
    }
  }))
);
```

### **🔍 2. TanStack Query Configuration**

#### **⚙️ Query Client Setup**
```typescript
// lib/queryClient.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors
        if (error instanceof Error && error.message.includes('4')) {
          return false;
        }
        return failureCount < 3;
      },
    },
    mutations: {
      retry: 1,
    },
  },
});
```

#### **🎯 Query Hooks**
```typescript
// hooks/queries/useOpportunitiesQuery.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export const useOpportunitiesQuery = () => {
  return useQuery({
    queryKey: ['opportunities'],
    queryFn: async () => {
      const response = await fetch('/api/opportunities');
      if (!response.ok) throw new Error('Failed to fetch opportunities');
      return response.json();
    },
    refetchInterval: 10000, // Refetch every 10 seconds
  });
};

export const useOpportunityDetailsQuery = (opportunityId: string) => {
  return useQuery({
    queryKey: ['opportunity', opportunityId],
    queryFn: async () => {
      const response = await fetch(`/api/opportunities/${opportunityId}`);
      if (!response.ok) throw new Error('Failed to fetch opportunity details');
      return response.json();
    },
    enabled: !!opportunityId,
  });
};

export const useExecuteOpportunityMutation = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: { opportunityId: string; amount: number; slippage: number }) => {
      const response = await fetch('/api/executions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Execution failed');
      return response.json();
    },
    onSuccess: () => {
      // Invalidate and refetch relevant queries
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['executions'] });
    },
  });
};
```

---

## 🎨 **F. LOVABLE PROJECT STRUCTURE**

```
/ArbitrageX-Supreme-v3-Dashboard/
├── 📁 components/
│   ├── 📁 ui/                          # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   ├── table.tsx
│   │   ├── dialog.tsx
│   │   ├── sheet.tsx
│   │   ├── tabs.tsx
│   │   ├── badge.tsx
│   │   ├── progress.tsx
│   │   └── toast.tsx
│   ├── 📁 dashboard/                   # Dashboard específicos
│   │   ├── OpportunityMonitor.tsx
│   │   ├── OpportunityCard.tsx
│   │   ├── OpportunityFilters.tsx
│   │   ├── OpportunityStats.tsx
│   │   ├── PerformanceCharts.tsx
│   │   ├── TechnicalMetrics.tsx
│   │   ├── MarketAnalytics.tsx
│   │   └── ExecutionTracker.tsx
│   ├── 📁 custom/                      # MEV-specific components
│   │   ├── MEVStrategyCard.tsx
│   │   ├── ProfitCalculator.tsx
│   │   ├── RiskAssessment.tsx
│   │   ├── ChainSelector.tsx
│   │   └── DEXIntegration.tsx
│   └── 📁 layout/                      # Layout components
│       ├── DashboardLayout.tsx
│       ├── Sidebar.tsx
│       ├── TopNavigation.tsx
│       └── Footer.tsx
├── 📁 hooks/                           # Custom hooks
│   ├── useWebSocketManager.ts
│   ├── useOpportunities.ts
│   ├── useExecutions.ts
│   ├── useStrategies.ts
│   └── 📁 queries/                     # TanStack Query hooks
│       ├── useOpportunitiesQuery.ts
│       ├── useStrategiesQuery.ts
│       ├── useExecutionsQuery.ts
│       └── useAnalyticsQuery.ts
├── 📁 stores/                          # Zustand stores
│   ├── opportunitiesStore.ts
│   ├── strategiesStore.ts
│   ├── executionsStore.ts
│   ├── userStore.ts
│   └── uiStore.ts
├── 📁 lib/                             # Utilities y configuración
│   ├── queryClient.ts
│   ├── websocket.ts
│   ├── api.ts
│   └── utils.ts
├── 📁 types/                           # TypeScript types
│   ├── opportunity.ts
│   ├── strategy.ts
│   ├── execution.ts
│   ├── analytics.ts
│   └── api.ts
├── 📁 pages/ (o app/)                  # Next.js pages/routes
│   ├── index.tsx                       # Dashboard principal
│   ├── opportunities/
│   │   ├── index.tsx
│   │   └── [id].tsx
│   ├── strategies/
│   │   ├── index.tsx
│   │   └── [id].tsx
│   ├── executions/
│   │   ├── index.tsx
│   │   └── [id].tsx
│   └── analytics/
│       └── index.tsx
├── 📁 styles/                          # Estilos
│   ├── globals.css
│   └── components.css
├── 📄 package.json                     # Dependencies
├── 📄 tailwind.config.js               # Tailwind configuration
├── 📄 next.config.js                   # Next.js configuration
├── 📄 tsconfig.json                    # TypeScript configuration
└── 📄 .env.local                       # Environment variables
```

---

## 🎯 **CONFIGURACIÓN INICIAL LOVABLE**

### **📦 package.json (Dependencies Recomendadas)**
```json
{
  "name": "arbitragex-supreme-v3-dashboard",
  "version": "3.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "typescript": "^5.0.0",
    
    "// State Management": "",
    "zustand": "^4.4.0",
    "@tanstack/react-query": "^4.35.0",
    "@tanstack/react-query-devtools": "^4.35.0",
    
    "// UI Framework": "",
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-dropdown-menu": "^2.0.6",
    "@radix-ui/react-label": "^2.0.2",
    "@radix-ui/react-select": "^2.0.0",
    "@radix-ui/react-separator": "^1.0.3",
    "@radix-ui/react-sheet": "^1.0.4",
    "@radix-ui/react-slot": "^1.0.2",
    "@radix-ui/react-tabs": "^1.0.4",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^1.14.0",
    "tailwindcss-animate": "^1.0.7",
    
    "// Charts & Visualizations": "",
    "recharts": "^2.8.0",
    "d3": "^7.8.5",
    "@types/d3": "^7.4.0",
    "plotly.js": "^2.26.0",
    "react-plotly.js": "@types/react-plotly.js",
    
    "// Animations": "",
    "framer-motion": "^10.16.0",
    
    "// Forms": "",
    "react-hook-form": "^7.46.0",
    "@hookform/resolvers": "^3.3.1",
    "zod": "^3.22.2",
    
    "// HTTP & WebSocket": "",
    "axios": "^1.5.0",
    "socket.io-client": "^4.7.2",
    
    "// Utilities": "",
    "date-fns": "^2.30.0",
    "lucide-react": "^0.284.0",
    "nanoid": "^4.0.2"
  },
  "devDependencies": {
    "@types/node": "^20.8.0",
    "@types/react": "^18.2.25",
    "@types/react-dom": "^18.2.10",
    "autoprefixer": "^10.4.16",
    "eslint": "^8.51.0",
    "eslint-config-next": "^13.5.4",
    "postcss": "^8.4.31",
    "tailwindcss": "^3.3.5"
  }
}
```

### **⚙️ Configuración Tailwind CSS**
```javascript
// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // MEV-specific colors
        profit: {
          DEFAULT: "#10b981",
          light: "#34d399",
          dark: "#059669",
        },
        loss: {
          DEFAULT: "#ef4444",
          light: "#f87171",
          dark: "#dc2626",
        },
        neutral: {
          DEFAULT: "#6b7280",
          light: "#9ca3af",
          dark: "#4b5563",
        }
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
        "fade-in": {
          "0%": { opacity: 0, transform: "translateY(10px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
        "slide-in": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "slide-in": "slide-in 0.3s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
```

---

## 🎯 **PRÓXIMOS PASOS EN LOVABLE**

### **1. 🚀 Setup Inicial**
1. Crear nuevo proyecto Next.js en Lovable
2. Instalar dependencias recomendadas
3. Configurar Tailwind CSS + shadcn/ui
4. Setup inicial de stores y query client

### **2. 📊 Desarrollo Componentes Core**
1. DashboardLayout base
2. OpportunityMonitor principal  
3. PerformanceCharts con Recharts
4. WebSocket integration

### **3. 🔄 Integration Real-time**
1. WebSocketManager setup
2. Real-time data hooks
3. State management integration
4. Error handling & reconnection

### **4. 🚀 Testing & Deployment**
1. Component testing
2. Performance optimization
3. Build para Cloudflare Pages
4. Production deployment

**Estado**: ✅ **COMPONENTES LOVABLE DETALLADOS - LISTOS PARA DESARROLLO**
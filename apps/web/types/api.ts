// Interfaces para respuestas de API del backend

// Respuesta estándar de API
export interface APIResponse<T = unknown> {
  status: 'success' | 'error';
  timestamp: string;
  data?: T;
  error?: string;
  message?: string;
}

// Paginación estándar
export interface PaginationData {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  showing?: string;
  hasNext?: boolean;
  hasPrev?: boolean;
}

// Respuesta paginada
export interface PaginatedResponse<T> extends APIResponse<T[]> {
  pagination: PaginationData;
}

// Métricas de rendimiento del sistema
export interface PerformanceMetrics {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageResponseTime: number;
  throughput: number;
  uptime: number;
  memoryUsage?: NodeJS.MemoryUsage;
  cacheStats?: { size: number; keys: string[] };
  lastReset: number;
}

// Estado de salud del sistema
export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  uptime: number;
  responseTime: number;
  components: Array<{ name: string; status: string; details?: string }>;
  version: string;
  lastCheck: number;
}

// Métricas de dashboard consolidadas
export interface DashboardMetrics {
  real_time_metrics?: {
    live_scanning?: boolean;
    opportunities_per_minute?: string | number;
    profit_rate?: string;
  };
  blockchain?: {
    total_volume_24h?: string | number;
    successful_arbitrages_24h?: string | number;
    active_connections?: number;
    networks?: number;
    live_opportunities?: number;
    avg_execution_time?: string;
  };
  recent_performance?: {
    total_potential_profit_24h?: number;
    avg_profit_percentage_24h?: number;
  };
  performance?: PerformanceMetrics;
  health?: SystemHealth;
}

// Resultado de ejecución de arbitraje
export interface ExecutionResult {
  success: boolean;
  transactionHash?: string;
  gasUsed?: number;
  actualProfit?: number;
  errorMessage?: string;
  executionTime?: number;
  details?: unknown;
}

// Estimación de gas
export interface GasEstimation {
  gasLimit: number;
  gasPrice: string;
  estimatedCost: string;
  estimatedProfit: number;
  netProfit: number;
}

// Información de wallet
export interface WalletInfo {
  address: string;
  balance?: string | number;
  chainId?: number;
  network?: string;
  connected?: boolean;
  type?: 'MetaMask' | 'WalletConnect' | 'Coinbase' | string;
}
// ArbitrageX Supreme - Tipos centralizados para API
// Interfaces completas para todos los endpoints de la API

import { Chain, ArbitrageStrategy, TokenInfo, LiquidityPool } from './defi';

// ============================================================================
// TIPOS BASE PARA RESPUESTAS DE API
// ============================================================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp?: string;
}

export interface ApiError {
  success: false;
  error: string;
  code?: number;
  details?: any;
}

export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// ============================================================================
// AUTENTICACIÓN
// ============================================================================

export interface LoginRequest {
  email: string;
  password: string;
  tenantSlug?: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  tenantSlug: string;
  inviteToken?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  tenantId: string;
  role: string;
  permissions: string[];
  features: string[];
  twoFactorEnabled: boolean;
  lastLoginAt: string;
  createdAt: string;
}

export interface LoginResponse extends ApiResponse {
  success: true;
  user: AuthUser;
  permissions: string[];
  features: string[];
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface PasswordResetRequest {
  email: string;
  tenantSlug?: string;
}

export interface PasswordResetConfirmRequest {
  token: string;
  newPassword: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface TwoFactorSetupResponse {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

// ============================================================================
// ARBITRAJE
// ============================================================================

export interface ArbitrageOpportunity {
  id: string;
  strategy: ArbitrageStrategy;
  blockchain: Chain;
  tokenSymbol: string;
  tokenAddress: string;
  profitPercentage: number;
  profitUsd: number;
  confidenceScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  expiresAt: string;
  pools: LiquidityPool[];
  estimatedGas: string;
  slippageTolerance: number;
  minimumAmount: string;
  maximumAmount: string;
  executionPath: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ArbitrageExecution {
  id: string;
  opportunityId: string;
  status: 'PENDING' | 'EXECUTING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  actualProfitUsd: number;
  actualProfitPercentage: number;
  executionTimeMs: number;
  gasUsed: string;
  gasPriceGwei: string;
  totalGasCost: string;
  slippageActual: number;
  transactionHash?: string;
  failureReason?: string;
  executedAt: string;
  completedAt?: string;
}

export interface OpportunitiesRequest {
  chains?: Chain[];
  strategies?: ArbitrageStrategy[];
  minProfitUsd?: number;
  maxRiskLevel?: 'low' | 'medium' | 'high';
  limit?: number;
  offset?: number;
}

export interface OpportunitiesResponse extends ApiResponse {
  success: true;
  opportunities: ArbitrageOpportunity[];
  total: number;
  summary: {
    totalProfitUsd: number;
    averageProfitPercentage: number;
    highConfidenceCount: number;
    activeChains: Chain[];
  };
}

export interface ExecutionsResponse extends ApiResponse {
  success: true;
  executions: ArbitrageExecution[];
  total: number;
  stats: {
    successRate: number;
    totalProfitUsd: number;
    averageExecutionTime: number;
    totalGasSpent: string;
  };
}

// ============================================================================
// BLOCKCHAIN
// ============================================================================

export interface BlockchainInfo {
  id: Chain;
  name: string;
  symbol: string;
  chainId: number;
  status: 'active' | 'maintenance' | 'inactive';
  connected: boolean;
  blockNumber: number;
  blockTime: number;
  gasPrice: string;
  explorerUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  hasWebSocket: boolean;
  lastCheck: string;
  protocolsSupported: number;
  tvlUsd: number;
}

export interface TokenPrice {
  blockchain: Chain;
  tokenAddress: string;
  tokenSymbol: string;
  priceUsd: number;
  volume24h: number;
  marketCap: number;
  priceChange24h: number;
  lastUpdated: string;
}

export interface SupportedBlockchainsResponse extends ApiResponse {
  success: true;
  blockchains: BlockchainInfo[];
}

export interface TokenPriceResponse extends ApiResponse {
  success: true;
  price: TokenPrice;
}

export interface NetworkStatusResponse extends ApiResponse {
  success: true;
  networks: Record<Chain, {
    connected: boolean;
    blockNumber: number;
    latency: number;
    lastCheck: string;
  }>;
  summary: {
    totalNetworks: number;
    activeNetworks: number;
    averageLatency: number;
    healthScore: number;
  };
}

// ============================================================================
// DASHBOARD Y MÉTRICAS
// ============================================================================

export interface DashboardSummary {
  totalOpportunities: number;
  totalProfitUsd: number;
  successfulExecutions: number;
  averageProfitPercentage: number;
  activeBlockchains: number;
  topPerformingChain: Chain;
  recentExecutions: ArbitrageExecution[];
  profitByChain: Record<Chain, number>;
  executionsByHour: Array<{
    hour: string;
    executions: number;
    profit: number;
  }>;
}

export interface DashboardSummaryResponse extends ApiResponse {
  success: true;
  summary: DashboardSummary;
  lastUpdated: string;
}

export interface HealthCheckResponse {
  status: 'ok' | 'error' | 'maintenance';
  timestamp: string;
  uptime: number;
  database: 'ok' | 'error';
  redis: 'ok' | 'error';
  blockchain: 'ok' | 'error';
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  services: {
    arbitrageEngine: boolean;
    dataAggregator: boolean;
    executionEngine: boolean;
    riskManager: boolean;
  };
}

export interface MetricsResponse {
  uptime: number;
  memory: NodeJS.MemoryUsage;
  cpu: NodeJS.CpuUsage;
  timestamp: string;
  arbitrage: {
    opportunitiesPerMinute: number;
    executionsPerHour: number;
    averageLatency: number;
    errorRate: number;
  };
  blockchain: {
    activeConnections: number;
    blocksProcessed: number;
    transactionsMonitored: number;
    rpcCallsPerMinute: number;
  };
}

// ============================================================================
// CONFIGURACIÓN Y TENANT
// ============================================================================

export interface TenantInfo {
  id: string;
  slug: string;
  name: string;
  plan: 'free' | 'pro' | 'enterprise';
  status: 'active' | 'suspended' | 'cancelled';
  features: string[];
  limits: {
    maxExecutionsPerDay: number;
    maxProfitThreshold: number;
    supportedChains: Chain[];
    apiCallsPerMinute: number;
  };
  billing: {
    subscriptionId?: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    usage: {
      executionsThisMonth: number;
      profitThisMonth: number;
      apiCallsThisMonth: number;
    };
  };
  createdAt: string;
  updatedAt: string;
}

export interface TenantResponse extends ApiResponse {
  success: true;
  tenant: TenantInfo;
}

// ============================================================================
// WEBHOOKS
// ============================================================================

export interface WebhookEvent {
  id: string;
  type: 'opportunity.created' | 'execution.completed' | 'execution.failed' | 'system.alert';
  tenantId: string;
  data: any;
  deliveryAttempts: number;
  deliveredAt?: string;
  createdAt: string;
}

export interface WebhookDelivery {
  id: string;
  eventId: string;
  url: string;
  httpStatus: number;
  responseTime: number;
  attempt: number;
  success: boolean;
  errorMessage?: string;
  deliveredAt: string;
}

// ============================================================================
// TIPOS PARA STREAMING DE DATOS EN TIEMPO REAL
// ============================================================================

export interface WebSocketMessage {
  type: 'opportunity' | 'execution' | 'price_update' | 'system_status' | 'error';
  data: any;
  timestamp: string;
  sequence?: number;
}

export interface OpportunityUpdate extends WebSocketMessage {
  type: 'opportunity';
  data: {
    action: 'created' | 'updated' | 'expired';
    opportunity: ArbitrageOpportunity;
  };
}

export interface ExecutionUpdate extends WebSocketMessage {
  type: 'execution';
  data: {
    action: 'started' | 'completed' | 'failed';
    execution: ArbitrageExecution;
  };
}

export interface PriceUpdate extends WebSocketMessage {
  type: 'price_update';
  data: {
    chain: Chain;
    prices: TokenPrice[];
  };
}

export interface SystemStatusUpdate extends WebSocketMessage {
  type: 'system_status';
  data: {
    component: string;
    status: 'healthy' | 'degraded' | 'down';
    message?: string;
  };
}

// ============================================================================
// TIPOS PARA FILTROS Y BÚSQUEDAS
// ============================================================================

export interface FilterOptions {
  chains?: Chain[];
  strategies?: ArbitrageStrategy[];
  minProfit?: number;
  maxProfit?: number;
  riskLevels?: ('low' | 'medium' | 'high')[];
  dateFrom?: string;
  dateTo?: string;
  status?: string[];
}

export interface SortOptions {
  field: string;
  direction: 'asc' | 'desc';
}

export interface SearchRequest {
  query?: string;
  filters?: FilterOptions;
  sort?: SortOptions;
  pagination?: {
    page: number;
    limit: number;
  };
}

// ============================================================================
// TIPOS PARA CONFIGURACIÓN DE USUARIO
// ============================================================================

export interface UserPreferences {
  notifications: {
    email: boolean;
    webhook: boolean;
    browser: boolean;
  };
  trading: {
    autoExecute: boolean;
    maxSlippage: number;
    minProfitThreshold: number;
    preferredChains: Chain[];
    riskTolerance: 'low' | 'medium' | 'high';
  };
  display: {
    currency: 'USD' | 'EUR' | 'BTC' | 'ETH';
    timezone: string;
    dateFormat: string;
    theme: 'light' | 'dark' | 'auto';
  };
}

export interface UpdatePreferencesRequest {
  preferences: Partial<UserPreferences>;
}

export interface UserPreferencesResponse extends ApiResponse {
  success: true;
  preferences: UserPreferences;
}

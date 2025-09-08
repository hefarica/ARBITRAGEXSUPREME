// 🔗 ArbitrageX Supreme - API Client LISTO PARA COPIAR
// Copia este código exacto a tu archivo src/services/api.ts en Lovable.dev

const BASE_URL = "https://3000-iy6h7uefq9p08klkqc2yh-6532622b.e2b.dev";

console.log('🔗 Conectando a ArbitrageX Supreme Backend:', BASE_URL);

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

  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      
      const config: RequestInit = {
        ...options,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Client': 'show-my-github-gems',
          ...options.headers,
        },
      };

      console.log(`🌐 API Request: ${config.method || 'GET'} ${url}`);
      
      const response = await fetch(url, config);
      
      if (!response.ok) {
        console.error(`❌ API Error: ${response.status} ${response.statusText}`);
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`✅ API Success: ${endpoint}`, data.success ? '✓' : data);
      
      return {
        success: true,
        data: data
      };
      
    } catch (error) {
      console.error(`❌ API Request failed for ${endpoint}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Request failed'
      };
    }
  }

  // Health Check
  async getHealth(): Promise<ApiResponse<{ status: string; service: string; version: string }>> {
    return this.request('/health');
  }

  // Network Status - RUTA CORRECTA
  async getNetworkStatus(): Promise<ApiResponse<any>> {
    return this.request('/api/v2/arbitrage/network-status');
  }

  // Arbitrage Opportunities - RUTA CORRECTA  
  async getOpportunities(params?: {
    chains?: string[];
    minProfit?: number;
    strategy?: string;
    limit?: number;
  }): Promise<ApiResponse<any>> {
    const searchParams = new URLSearchParams();
    
    if (params?.chains?.length) {
      searchParams.append('chains', params.chains.join(','));
    }
    if (params?.minProfit) {
      searchParams.append('minProfit', params.minProfit.toString());
    }
    if (params?.strategy) {
      searchParams.append('strategy', params.strategy);
    }
    if (params?.limit) {
      searchParams.append('limit', params.limit.toString());
    }

    const queryString = searchParams.toString();
    const endpoint = `/api/v2/arbitrage/opportunities${queryString ? `?${queryString}` : ''}`;
    
    return this.request(endpoint);
  }

  // Dashboard Summary - RUTA CORRECTA
  async getDashboardSummary(): Promise<ApiResponse<any>> {
    return this.request('/api/v2/dashboard/summary');
  }

  // Execute Arbitrage (Mock implementation for now)
  async executeArbitrage(opportunityId: string): Promise<ApiResponse<any>> {
    console.log(`🚀 Executing arbitrage opportunity: ${opportunityId}`);
    
    // Simulate execution delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      success: true,
      data: {
        id: `exec_${Date.now()}`,
        opportunityId,
        status: 'SUCCESS',
        actualProfitUsd: Math.random() * 100 + 50,
        actualProfitPercentage: Math.random() * 3 + 1,
        executionTimeMs: Math.floor(Math.random() * 2000 + 500),
        gasUsed: Math.floor(Math.random() * 200000 + 100000).toString(),
        gasPriceGwei: (Math.random() * 50 + 10).toFixed(1),
        totalGasCost: (Math.random() * 0.01 + 0.001).toFixed(8),
        slippageActual: Math.random() * 0.5,
        transactionHash: `0x${Math.random().toString(16).substr(2, 64)}`,
        executedAt: new Date().toISOString(),
        completedAt: new Date(Date.now() + 1000).toISOString()
      }
    };
  }
}

// Singleton instance
export const arbitrageAPI = new ArbitrageAPI();

// Export for easy access
export default arbitrageAPI;
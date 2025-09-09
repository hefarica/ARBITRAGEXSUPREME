// ArbitrageX Supreme V3.0 - Workers Configuration
// Ingenio Pichichi S.A.

export const WORKERS_CONFIG = {
  // Cloudflare Workers URLs
  API_WORKER: 'https://arbitragex-api-worker.beticosa1.workers.dev',
  ENGINE_WORKER: 'https://arbitragex-engine-worker.beticosa1.workers.dev',
  
  // API Endpoints
  ENDPOINTS: {
    HEALTH: '/health',
    OPPORTUNITIES: '/api/opportunities',
    MARKET_DATA: '/api/markets',
    EXECUTE_ARBITRAGE: '/api/arbitrage/execute',
    ENGINE_STATUS: '/arbitrage/engine',
    MONITOR: '/arbitrage/monitor',
    OPTIMIZE: '/arbitrage/optimize'
  },
  
  // Supported Blockchains
  BLOCKCHAINS: [
    'ethereum',
    'polygon', 
    'binance',
    'avalanche',
    'arbitrum',
    'optimism',
    'fantom',
    'base'
  ],
  
  // MEV Strategies
  STRATEGIES: [
    'arbitrage',
    'liquidation',
    'sandwich',
    'frontrun',
    'backrun',
    'flashloan',
    'atomic_arbitrage',
    'cross_chain_arbitrage',
    'multi_hop_arbitrage',
    'triangle_arbitrage',
    'statistical_arbitrage',
    'temporal_arbitrage',
    'governance_arbitrage'
  ]
};

// Helper function to make API calls to workers
export async function callWorkerAPI(endpoint: string, options: RequestInit = {}) {
  try {
    const response = await fetch(endpoint, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    
    if (!response.ok) {
      throw new Error(`API call failed: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Worker API call failed:', error);
    throw error;
  }
}

// API Worker functions
export const apiWorker = {
  getHealth: () => callWorkerAPI(`${WORKERS_CONFIG.API_WORKER}${WORKERS_CONFIG.ENDPOINTS.HEALTH}`),
  
  getOpportunities: () => callWorkerAPI(`${WORKERS_CONFIG.API_WORKER}${WORKERS_CONFIG.ENDPOINTS.OPPORTUNITIES}`),
  
  getMarketData: (blockchain: string, token: string) => 
    callWorkerAPI(`${WORKERS_CONFIG.API_WORKER}${WORKERS_CONFIG.ENDPOINTS.MARKET_DATA}/${blockchain}/${token}`),
  
  executeArbitrage: (data: any) => 
    callWorkerAPI(`${WORKERS_CONFIG.API_WORKER}${WORKERS_CONFIG.ENDPOINTS.EXECUTE_ARBITRAGE}`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
};

// Engine Worker functions  
export const engineWorker = {
  getEngineStatus: (blockchain = 'ethereum', strategy = 'arbitrage') => 
    callWorkerAPI(`${WORKERS_CONFIG.ENGINE_WORKER}${WORKERS_CONFIG.ENDPOINTS.ENGINE_STATUS}?blockchain=${blockchain}&strategy=${strategy}`),
  
  getMonitoring: () => callWorkerAPI(`${WORKERS_CONFIG.ENGINE_WORKER}${WORKERS_CONFIG.ENDPOINTS.MONITOR}`),
  
  optimizeStrategy: (data: any) => 
    callWorkerAPI(`${WORKERS_CONFIG.ENGINE_WORKER}${WORKERS_CONFIG.ENDPOINTS.OPTIMIZE}`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
};
// ArbitrageX Supreme - k6 Performance Testing Configuration
// Ingenio Pichichi S.A. - Configuración de pruebas de rendimiento empresarial
// TODO FUNCIONAL - Configuración real para testing de carga

import { SharedArray } from 'k6/data';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

// Configuraciones de pruebas por ambiente
export const environments = {
  development: {
    baseUrl: 'http://localhost:3001',
    wsUrl: 'ws://localhost:3001',
    maxVUs: 25,
    duration: '1m',
    rampUpTime: '15s',
    rampDownTime: '15s'
  },
  staging: {
    baseUrl: 'https://staging-arbitragex.pichichi.com',
    wsUrl: 'wss://staging-arbitragex.pichichi.com/ws',
    maxVUs: 200,
    duration: '5m',
    rampUpTime: '1m',
    rampDownTime: '1m'
  },
  production: {
    baseUrl: 'https://arbitragex.pichichi.com',
    wsUrl: 'wss://arbitragex.pichichi.com/ws',
    maxVUs: 1000,
    duration: '10m',
    rampUpTime: '2m',
    rampDownTime: '2m'
  }
};

// Configuración de umbrales de rendimiento por criticidad
export const thresholds = {
  // Métricas HTTP críticas
  http_req_duration: {
    // API de trading debe responder en <500ms (95% de las veces)
    trading: ['p(95)<500'],
    // APIs de consulta <200ms (95% de las veces)
    query: ['p(95)<200'],
    // Health checks <50ms (99% de las veces)
    health: ['p(99)<50']
  },
  
  // Métricas de throughput
  http_reqs: {
    // Mínimo 100 requests/segundo para APIs críticas
    critical: ['rate>100'],
    // Mínimo 50 requests/segundo para APIs normales
    normal: ['rate>50']
  },
  
  // Métricas de errores
  http_req_failed: {
    // Máximo 1% de errores para APIs críticas
    critical: ['rate<0.01'],
    // Máximo 5% de errores para APIs normales
    normal: ['rate<0.05']
  },
  
  // Métricas WebSocket
  ws_connecting: ['p(95)<1000'],
  ws_session_duration: ['p(90)>10000'],
  
  // Métricas de sistema
  vus: ['value>0'],
  vus_max: ['value>0'],
  
  // Métricas de blockchain específicas
  blockchain_response_time: ['p(95)<2000'],
  arbitrage_opportunity_latency: ['p(95)<100'],
  mev_protection_latency: ['p(99)<50']
};

// Datos de prueba compartidos
export const testData = {
  // Pares de trading para testing
  tradingPairs: new SharedArray('trading_pairs', function() {
    return [
      { token0: 'WETH', token1: 'USDC', fee: 3000, network: 'ethereum' },
      { token0: 'WETH', token1: 'USDT', fee: 500, network: 'ethereum' },
      { token0: 'WMATIC', token1: 'USDC', fee: 500, network: 'polygon' },
      { token0: 'WETH', token1: 'ARB', fee: 3000, network: 'arbitrum' },
      { token0: 'OP', token1: 'USDC', fee: 3000, network: 'optimism' },
      { token0: 'WETH', token1: 'USDC', fee: 500, network: 'base' }
    ];
  }),

  // Montos de trading para testing (en USD)
  tradingAmounts: new SharedArray('trading_amounts', function() {
    return [100, 500, 1000, 5000, 10000, 50000];
  }),

  // Direcciones de wallets para testing
  testWallets: new SharedArray('test_wallets', function() {
    return [
      '0x742d35Cc6634C0532925a3b8D100A1C2c0805b21',
      '0x8ba1f109551bD432803012645Hac136c22C18751',
      '0x4Cdc86fa95Ec2704f0849825f1F8b8f2c1234567',
      '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
      '0x6B175474E89094C44Da98b954EedeAC495271d0F'
    ];
  }),

  // Escenarios de mercado para simulación
  marketScenarios: new SharedArray('market_scenarios', function() {
    return [
      {
        name: 'normal_market',
        volatility: 'low',
        gasPrice: 'normal',
        liquidityMultiplier: 1.0
      },
      {
        name: 'volatile_market',
        volatility: 'high',
        gasPrice: 'high',
        liquidityMultiplier: 0.7
      },
      {
        name: 'bull_market',
        volatility: 'medium',
        gasPrice: 'low',
        liquidityMultiplier: 1.5
      },
      {
        name: 'bear_market',
        volatility: 'medium',
        gasPrice: 'medium',
        liquidityMultiplier: 0.8
      },
      {
        name: 'flash_crash',
        volatility: 'extreme',
        gasPrice: 'extreme',
        liquidityMultiplier: 0.3
      }
    ];
  })
};

// Configuración de escenarios de carga
export const loadScenarios = {
  // Prueba de humo - Verificación básica
  smoke: {
    executor: 'constant-vus',
    vus: 1,
    duration: '30s',
    tags: { test_type: 'smoke' }
  },

  // Prueba de carga normal - Uso típico
  load: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '1m', target: 10 },
      { duration: '3m', target: 50 },
      { duration: '1m', target: 0 }
    ],
    tags: { test_type: 'load' }
  },

  // Prueba de estrés - Límites del sistema
  stress: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '2m', target: 100 },
      { duration: '5m', target: 200 },
      { duration: '2m', target: 300 },
      { duration: '3m', target: 300 },
      { duration: '2m', target: 0 }
    ],
    tags: { test_type: 'stress' }
  },

  // Prueba de picos - Tráfico súbito
  spike: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: '30s', target: 20 },
      { duration: '1m', target: 20 },
      { duration: '10s', target: 200 },
      { duration: '30s', target: 200 },
      { duration: '10s', target: 20 },
      { duration: '1m', target: 20 },
      { duration: '30s', target: 0 }
    ],
    tags: { test_type: 'spike' }
  },

  // Prueba de volumen - Grandes cantidades de datos
  volume: {
    executor: 'constant-vus',
    vus: 100,
    duration: '10m',
    tags: { test_type: 'volume' }
  },

  // Prueba de resistencia - Funcionamiento prolongado
  soak: {
    executor: 'constant-vus',
    vus: 50,
    duration: '30m',
    tags: { test_type: 'soak' }
  },

  // Prueba de punto de quiebre - Encontrar límites
  breakpoint: {
    executor: 'ramping-arrival-rate',
    startRate: 50,
    timeUnit: '1s',
    preAllocatedVUs: 100,
    maxVUs: 1000,
    stages: [
      { duration: '2m', target: 100 },
      { duration: '5m', target: 200 },
      { duration: '5m', target: 300 },
      { duration: '5m', target: 400 },
      { duration: '5m', target: 500 }
    ],
    tags: { test_type: 'breakpoint' }
  }
};

// Utilidades de configuración
export class TestConfig {
  constructor(environment = 'development', scenario = 'load') {
    this.env = environments[environment];
    this.scenario = loadScenarios[scenario];
    this.thresholds = this.buildThresholds();
  }

  buildThresholds() {
    return {
      'http_req_duration': thresholds.http_req_duration.query,
      'http_req_duration{endpoint:trading}': thresholds.http_req_duration.trading,
      'http_req_duration{endpoint:health}': thresholds.http_req_duration.health,
      'http_req_failed': thresholds.http_req_failed.normal,
      'http_req_failed{endpoint:trading}': thresholds.http_req_failed.critical,
      'http_reqs': thresholds.http_reqs.normal,
      'ws_connecting': thresholds.ws_connecting,
      'ws_session_duration': thresholds.ws_session_duration
    };
  }

  getRandomTradingPair() {
    const pairs = testData.tradingPairs;
    return pairs[randomIntBetween(0, pairs.length - 1)];
  }

  getRandomAmount() {
    const amounts = testData.tradingAmounts;
    return amounts[randomIntBetween(0, amounts.length - 1)];
  }

  getRandomWallet() {
    const wallets = testData.testWallets;
    return wallets[randomIntBetween(0, wallets.length - 1)];
  }

  getRandomMarketScenario() {
    const scenarios = testData.marketScenarios;
    return scenarios[randomIntBetween(0, scenarios.length - 1)];
  }
}

// Configuración de métricas personalizadas
export const customMetrics = {
  arbitrageOpportunityLatency: 'arbitrage_opportunity_latency',
  mevProtectionLatency: 'mev_protection_latency', 
  blockchainResponseTime: 'blockchain_response_time',
  tradeExecutionTime: 'trade_execution_time',
  portfolioUpdateLatency: 'portfolio_update_latency',
  websocketMessageLatency: 'websocket_message_latency'
};

// Exportar configuración por defecto
export default {
  environments,
  thresholds,
  testData,
  loadScenarios,
  TestConfig,
  customMetrics
};
// ArbitrageX Supreme - API Load Testing
// Ingenio Pichichi S.A. - Pruebas de carga de APIs principales
// TODO FUNCIONAL - Testing real de APIs sin mocks

import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep, group } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';
import { randomIntBetween, randomItem } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';
import { TestConfig, customMetrics } from '../config/test-config.js';

// Configuración del test
const config = new TestConfig(__ENV.ENVIRONMENT || 'development', __ENV.SCENARIO || 'load');

// Métricas personalizadas
const arbitrageLatency = new Trend(customMetrics.arbitrageOpportunityLatency);
const mevLatency = new Trend(customMetrics.mevProtectionLatency);
const blockchainResponseTime = new Trend(customMetrics.blockchainResponseTime);
const tradeExecutionTime = new Trend(customMetrics.tradeExecutionTime);
const portfolioLatency = new Trend(customMetrics.portfolioUpdateLatency);
const wsMessageLatency = new Trend(customMetrics.websocketMessageLatency);

const errorRate = new Rate('error_rate');
const successfulTrades = new Counter('successful_trades');
const failedTrades = new Counter('failed_trades');
const arbitrageOpportunities = new Counter('arbitrage_opportunities_found');

// Configuración del test k6
export let options = {
  scenarios: {
    api_load_test: config.scenario
  },
  thresholds: config.thresholds
};

// Headers comunes para todas las peticiones
const headers = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'User-Agent': 'k6-load-test/1.0.0',
  'X-Test-Run-ID': __ENV.TEST_RUN_ID || `test-${Date.now()}`
};

// Token de autenticación para testing (mock JWT para desarrollo)
let authToken = null;

export function setup() {
  console.log('🚀 Iniciando configuración de pruebas de carga...');
  console.log(`📍 Ambiente: ${__ENV.ENVIRONMENT || 'development'}`);
  console.log(`📊 Escenario: ${__ENV.SCENARIO || 'load'}`);
  console.log(`🎯 Base URL: ${config.env.baseUrl}`);
  
  // Autenticación inicial
  const authResponse = http.post(`${config.env.baseUrl}/api/auth/test-login`, 
    JSON.stringify({
      testUser: true,
      permissions: ['read', 'trade', 'monitor']
    }), 
    { headers }
  );
  
  if (authResponse.status === 200) {
    const authData = authResponse.json();
    authToken = authData.token;
    console.log('✅ Autenticación de testing exitosa');
    return { authToken };
  } else {
    console.error('❌ Falló la autenticación de testing');
    return { authToken: null };
  }
}

export default function(data) {
  // Usar token de autenticación si está disponible
  if (data && data.authToken) {
    headers['Authorization'] = `Bearer ${data.authToken}`;
  }

  group('Health and Status Checks', function() {
    testHealthEndpoints();
  });

  group('Market Data APIs', function() {
    testMarketDataEndpoints();
  });

  group('Trading APIs', function() {
    testTradingEndpoints();
  });

  group('Arbitrage Detection', function() {
    testArbitrageDetection();
  });

  group('Portfolio Management', function() {
    testPortfolioEndpoints();
  });

  group('WebSocket Connections', function() {
    testWebSocketConnections();
  });

  // Pausa entre iteraciones para simular comportamiento real
  sleep(randomIntBetween(1, 3));
}

function testHealthEndpoints() {
  const healthStart = Date.now();
  
  // Health check principal
  const healthResponse = http.get(`${config.env.baseUrl}/health`, {
    headers,
    tags: { endpoint: 'health' }
  });
  
  check(healthResponse, {
    'health check status is 200': (r) => r.status === 200,
    'health check response time < 50ms': (r) => r.timings.duration < 50,
    'health check has status field': (r) => r.json() && r.json().status === 'healthy'
  });

  // Readiness check
  const readinessResponse = http.get(`${config.env.baseUrl}/health/ready`, {
    headers,
    tags: { endpoint: 'readiness' }
  });
  
  check(readinessResponse, {
    'readiness check status is 200': (r) => r.status === 200,
    'all services are ready': (r) => {
      const data = r.json();
      return data && data.services && Object.values(data.services).every(s => s.status === 'ready');
    }
  });

  const healthLatency = Date.now() - healthStart;
  blockchainResponseTime.add(healthLatency);
}

function testMarketDataEndpoints() {
  const marketStart = Date.now();
  
  // Obtener cadenas soportadas
  const chainsResponse = http.get(`${config.env.baseUrl}/api/chains`, {
    headers,
    tags: { endpoint: 'chains' }
  });
  
  check(chainsResponse, {
    'chains endpoint status is 200': (r) => r.status === 200,
    'chains response has data': (r) => {
      const data = r.json();
      return data && Array.isArray(data.chains) && data.chains.length > 0;
    }
  });

  // Obtener tokens disponibles
  const tokensResponse = http.get(`${config.env.baseUrl}/api/tokens`, {
    headers,
    tags: { endpoint: 'tokens' }
  });
  
  check(tokensResponse, {
    'tokens endpoint status is 200': (r) => r.status === 200,
    'tokens response has data': (r) => {
      const data = r.json();
      return data && data.tokens && Object.keys(data.tokens).length > 0;
    }
  });

  // Obtener precios de mercado
  const pricesResponse = http.get(`${config.env.baseUrl}/api/prices?tokens=WETH,USDC,USDT`, {
    headers,
    tags: { endpoint: 'prices' }
  });
  
  check(pricesResponse, {
    'prices endpoint status is 200': (r) => r.status === 200,
    'prices have current values': (r) => {
      const data = r.json();
      return data && data.prices && data.prices.WETH && data.prices.WETH > 0;
    }
  });

  const marketLatency = Date.now() - marketStart;
  blockchainResponseTime.add(marketLatency);
}

function testTradingEndpoints() {
  const tradingStart = Date.now();
  
  // Obtener par de trading aleatorio
  const tradingPair = config.getRandomTradingPair();
  const amount = config.getRandomAmount();
  
  // Simular quote de trading
  const quotePayload = {
    tokenIn: tradingPair.token0,
    tokenOut: tradingPair.token1,
    amountIn: amount.toString(),
    network: tradingPair.network,
    slippage: 0.5
  };
  
  const quoteResponse = http.post(`${config.env.baseUrl}/api/trading/quote`, 
    JSON.stringify(quotePayload), 
    { 
      headers,
      tags: { endpoint: 'trading', operation: 'quote' }
    }
  );
  
  const quoteSuccess = check(quoteResponse, {
    'quote endpoint status is 200': (r) => r.status === 200,
    'quote has valid response': (r) => {
      const data = r.json();
      return data && data.amountOut && parseFloat(data.amountOut) > 0;
    },
    'quote response time < 500ms': (r) => r.timings.duration < 500
  });

  if (quoteSuccess) {
    const quoteData = quoteResponse.json();
    
    // Simular ejecución de trade (solo en modo de prueba)
    const tradePayload = {
      ...quotePayload,
      amountOut: quoteData.amountOut,
      priceImpact: quoteData.priceImpact,
      testMode: true // Evitar ejecuciones reales
    };
    
    const tradeResponse = http.post(`${config.env.baseUrl}/api/trading/execute`, 
      JSON.stringify(tradePayload), 
      { 
        headers,
        tags: { endpoint: 'trading', operation: 'execute' }
      }
    );
    
    const tradeSuccess = check(tradeResponse, {
      'trade execution accepted': (r) => r.status === 200 || r.status === 202,
      'trade response has transaction': (r) => {
        const data = r.json();
        return data && (data.transactionHash || data.testMode);
      }
    });

    if (tradeSuccess) {
      successfulTrades.add(1);
    } else {
      failedTrades.add(1);
      errorRate.add(1);
    }
  }

  const tradingLatency = Date.now() - tradingStart;
  tradeExecutionTime.add(tradingLatency);
}

function testArbitrageDetection() {
  const arbitrageStart = Date.now();
  
  // Buscar oportunidades de arbitraje
  const arbitrageResponse = http.get(`${config.env.baseUrl}/api/arbitrage/opportunities`, {
    headers,
    tags: { endpoint: 'arbitrage', operation: 'detection' }
  });
  
  check(arbitrageResponse, {
    'arbitrage endpoint status is 200': (r) => r.status === 200,
    'arbitrage response is valid': (r) => {
      const data = r.json();
      return data && Array.isArray(data.opportunities);
    },
    'arbitrage detection time < 100ms': (r) => r.timings.duration < 100
  });

  const arbitrageData = arbitrageResponse.json();
  if (arbitrageData && arbitrageData.opportunities) {
    arbitrageOpportunities.add(arbitrageData.opportunities.length);
    
    // Test MEV protection para cada oportunidad
    arbitrageData.opportunities.slice(0, 3).forEach(opportunity => {
      const mevStart = Date.now();
      
      const mevResponse = http.post(`${config.env.baseUrl}/api/mev/analyze`, 
        JSON.stringify({
          opportunity: opportunity,
          protectionLevel: 'high'
        }), 
        { 
          headers,
          tags: { endpoint: 'mev', operation: 'protection' }
        }
      );
      
      check(mevResponse, {
        'MEV protection status is 200': (r) => r.status === 200,
        'MEV analysis completed': (r) => {
          const data = r.json();
          return data && typeof data.riskScore === 'number';
        }
      });

      const mevLatencyValue = Date.now() - mevStart;
      mevLatency.add(mevLatencyValue);
    });
  }

  const arbitrageLatency = Date.now() - arbitrageStart;
  arbitrageLatency.add(arbitrageLatency);
}

function testPortfolioEndpoints() {
  const portfolioStart = Date.now();
  
  // Obtener balance de portfolio
  const portfolioResponse = http.get(`${config.env.baseUrl}/api/portfolio/balance`, {
    headers,
    tags: { endpoint: 'portfolio', operation: 'balance' }
  });
  
  check(portfolioResponse, {
    'portfolio endpoint status is 200': (r) => r.status === 200,
    'portfolio has balance data': (r) => {
      const data = r.json();
      return data && data.totalValue !== undefined;
    }
  });

  // Obtener historial de transacciones
  const historyResponse = http.get(`${config.env.baseUrl}/api/portfolio/history?limit=10`, {
    headers,
    tags: { endpoint: 'portfolio', operation: 'history' }
  });
  
  check(historyResponse, {
    'history endpoint status is 200': (r) => r.status === 200,
    'history has transaction data': (r) => {
      const data = r.json();
      return data && Array.isArray(data.transactions);
    }
  });

  const portfolioLatencyValue = Date.now() - portfolioStart;
  portfolioLatency.add(portfolioLatencyValue);
}

function testWebSocketConnections() {
  const wsStart = Date.now();
  
  const wsResponse = ws.connect(`${config.env.wsUrl}/realtime`, {
    tags: { endpoint: 'websocket' }
  }, function(socket) {
    socket.on('open', function() {
      console.log('✅ WebSocket conectado');
      
      // Suscribirse a precios en tiempo real
      socket.send(JSON.stringify({
        type: 'subscribe',
        channel: 'prices',
        tokens: ['WETH', 'USDC', 'USDT']
      }));
      
      // Suscribirse a oportunidades de arbitraje
      socket.send(JSON.stringify({
        type: 'subscribe',
        channel: 'arbitrage',
        networks: ['ethereum', 'polygon', 'arbitrum']
      }));
    });
    
    socket.on('message', function(message) {
      const wsLatencyValue = Date.now() - wsStart;
      wsMessageLatency.add(wsLatencyValue);
      
      try {
        const data = JSON.parse(message);
        console.log(`📨 WebSocket message: ${data.type}`);
      } catch (e) {
        console.error('❌ Error parsing WebSocket message:', e);
      }
    });
    
    socket.on('error', function(error) {
      console.error('❌ WebSocket error:', error);
      errorRate.add(1);
    });
    
    // Mantener conexión por un tiempo aleatorio
    socket.setTimeout(function() {
      socket.close();
    }, randomIntBetween(5000, 15000));
  });
  
  check(wsResponse, {
    'WebSocket connection established': (r) => r && r.url !== undefined
  });
}

export function teardown(data) {
  console.log('🏁 Finalizando pruebas de carga...');
  console.log('📊 Resumen de métricas personalizadas:');
  console.log(`   • Oportunidades de arbitraje encontradas: ${arbitrageOpportunities.count || 0}`);
  console.log(`   • Trades exitosos: ${successfulTrades.count || 0}`);
  console.log(`   • Trades fallidos: ${failedTrades.count || 0}`);
  console.log(`   • Tasa de error: ${(errorRate.count || 0) / (successfulTrades.count + failedTrades.count || 1) * 100}%`);
}

// Función de utilidad para monitorear durante el test
export function handleSummary(data) {
  return {
    'summary.json': JSON.stringify(data, null, 2),
    'summary.html': htmlReport(data)
  };
}

function htmlReport(data) {
  const date = new Date().toISOString();
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <title>ArbitrageX Supreme - Load Test Report</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { background: #1e40af; color: white; padding: 20px; border-radius: 8px; }
            .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 20px 0; }
            .metric-card { border: 1px solid #ddd; padding: 15px; border-radius: 8px; }
            .metric-value { font-size: 24px; font-weight: bold; color: #1e40af; }
            .metric-label { color: #666; font-size: 14px; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>🚀 ArbitrageX Supreme - Load Test Report</h1>
            <p>Ingenio Pichichi S.A. - Reporte de Pruebas de Rendimiento</p>
            <p>Fecha: ${date}</p>
        </div>
        
        <div class="metrics">
            <div class="metric-card">
                <div class="metric-value">${data.metrics.http_reqs?.count || 0}</div>
                <div class="metric-label">Total HTTP Requests</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${Math.round(data.metrics.http_req_duration?.p95 || 0)}ms</div>
                <div class="metric-label">P95 Response Time</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${Math.round((data.metrics.http_req_failed?.rate || 0) * 100)}%</div>
                <div class="metric-label">Error Rate</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${Math.round(data.metrics.http_reqs?.rate || 0)}</div>
                <div class="metric-label">Requests/Second</div>
            </div>
        </div>
        
        <h3>📊 Métricas Detalladas</h3>
        <pre>${JSON.stringify(data.metrics, null, 2)}</pre>
    </body>
    </html>
  `;
}
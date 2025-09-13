// ArbitrageX Supreme - WebSocket Performance Testing
// Ingenio Pichichi S.A. - Pruebas de rendimiento de conexiones en tiempo real
// TODO FUNCIONAL - Testing real de WebSockets sin mocks

import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Trend, Counter, Rate, Gauge } from 'k6/metrics';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';
import { TestConfig } from '../config/test-config.js';

// Configuración del test
const config = new TestConfig(__ENV.ENVIRONMENT || 'development', 'load');

// Métricas personalizadas para WebSocket
const wsConnectionTime = new Trend('ws_connection_time');
const wsMessageLatency = new Trend('ws_message_latency');
const wsMessagesReceived = new Counter('ws_messages_received');
const wsMessagesSent = new Counter('ws_messages_sent');
const wsErrors = new Counter('ws_errors');
const wsConnectionErrors = new Rate('ws_connection_error_rate');
const activeSockets = new Gauge('ws_active_connections');
const priceUpdatesReceived = new Counter('price_updates_received');
const arbitrageAlertsReceived = new Counter('arbitrage_alerts_received');
const orderBookUpdates = new Counter('orderbook_updates_received');

export let options = {
  scenarios: {
    websocket_connections: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 10 },
        { duration: '2m', target: 50 },
        { duration: '1m', target: 100 },
        { duration: '2m', target: 100 },
        { duration: '30s', target: 0 }
      ]
    }
  },
  thresholds: {
    'ws_connection_time': ['p(95)<2000'],
    'ws_message_latency': ['p(95)<100'],
    'ws_connection_error_rate': ['rate<0.05'],
    'ws_active_connections': ['value>0']
  }
};

export default function() {
  const startTime = Date.now();
  
  // Configuración de la conexión WebSocket
  const wsUrl = config.env.wsUrl || 'ws://localhost:3001/ws';
  const protocols = ['arbitragex-protocol-v1'];
  const params = {
    headers: {
      'User-Agent': 'k6-websocket-test/1.0.0',
      'X-Test-VU': `${__VU}`,
      'X-Test-Iteration': `${__ITER}`
    },
    tags: { 
      protocol: 'websocket',
      test_type: 'realtime'
    }
  };

  console.log(`🔌 VU ${__VU}: Estableciendo conexión WebSocket a ${wsUrl}`);
  
  const response = ws.connect(wsUrl, params, function(socket) {
    const connectionTime = Date.now() - startTime;
    wsConnectionTime.add(connectionTime);
    
    console.log(`✅ VU ${__VU}: WebSocket conectado en ${connectionTime}ms`);
    activeSockets.add(1);

    // Configurar event handlers
    socket.on('open', function() {
      console.log(`🚀 VU ${__VU}: WebSocket abierto, enviando suscripciones`);
      
      // Suscribirse a múltiples canales
      subscribeToChannels(socket);
    });

    socket.on('message', function(data) {
      const messageTime = Date.now();
      wsMessagesReceived.add(1);
      
      try {
        const message = JSON.parse(data);
        handleMessage(socket, message, messageTime);
      } catch (error) {
        console.error(`❌ VU ${__VU}: Error parsing message:`, error);
        wsErrors.add(1);
      }
    });

    socket.on('error', function(error) {
      console.error(`❌ VU ${__VU}: WebSocket error:`, error);
      wsErrors.add(1);
      wsConnectionErrors.add(1);
    });

    socket.on('close', function() {
      console.log(`🔌 VU ${__VU}: WebSocket cerrado`);
      activeSockets.add(-1);
    });

    // Simular actividad durante la conexión
    simulateUserActivity(socket);
    
    // Mantener la conexión activa por un tiempo aleatorio
    const connectionDuration = randomIntBetween(30000, 120000); // 30s - 2m
    socket.setTimeout(function() {
      console.log(`⏰ VU ${__VU}: Cerrando WebSocket después de ${connectionDuration}ms`);
      socket.close();
    }, connectionDuration);
  });

  // Verificar que la conexión se estableció
  check(response, {
    'WebSocket connection established': (r) => r && r.url === wsUrl,
    'WebSocket protocols accepted': (r) => r && r.protocol !== undefined
  });

  if (!response) {
    wsConnectionErrors.add(1);
    console.error(`❌ VU ${__VU}: Falló el establecimiento de WebSocket`);
  }
}

function subscribeToChannels(socket) {
  // Suscripción a precios en tiempo real
  const priceSubscription = {
    type: 'subscribe',
    channel: 'prices',
    params: {
      tokens: ['WETH', 'USDC', 'USDT', 'DAI', 'WBTC'],
      networks: ['ethereum', 'polygon', 'arbitrum', 'optimism'],
      updateFrequency: 'realtime'
    },
    id: `price_sub_${__VU}_${Date.now()}`
  };

  socket.send(JSON.stringify(priceSubscription));
  wsMessagesSent.add(1);
  console.log(`📈 VU ${__VU}: Suscrito a precios`);

  // Suscripción a oportunidades de arbitraje
  const arbitrageSubscription = {
    type: 'subscribe',
    channel: 'arbitrage',
    params: {
      networks: ['ethereum', 'polygon', 'arbitrum'],
      minProfitUsd: 10,
      maxSlippage: 1.0
    },
    id: `arb_sub_${__VU}_${Date.now()}`
  };

  socket.send(JSON.stringify(arbitrageSubscription));
  wsMessagesSent.add(1);
  console.log(`⚡ VU ${__VU}: Suscrito a arbitraje`);

  // Suscripción a order book updates
  const orderbookSubscription = {
    type: 'subscribe',
    channel: 'orderbook',
    params: {
      pairs: [
        { token0: 'WETH', token1: 'USDC', network: 'ethereum' },
        { token0: 'WMATIC', token1: 'USDC', network: 'polygon' }
      ],
      depth: 10
    },
    id: `orderbook_sub_${__VU}_${Date.now()}`
  };

  socket.send(JSON.stringify(orderbookSubscription));
  wsMessagesSent.add(1);
  console.log(`📚 VU ${__VU}: Suscrito a order books`);

  // Suscripción a alertas de MEV
  const mevSubscription = {
    type: 'subscribe',
    channel: 'mev_alerts',
    params: {
      riskLevel: 'medium',
      networks: ['ethereum', 'arbitrum']
    },
    id: `mev_sub_${__VU}_${Date.now()}`
  };

  socket.send(JSON.stringify(mevSubscription));
  wsMessagesSent.add(1);
  console.log(`🛡️ VU ${__VU}: Suscrito a MEV alerts`);
}

function handleMessage(socket, message, receivedTime) {
  const latency = receivedTime - (message.timestamp || receivedTime);
  wsMessageLatency.add(latency);

  switch (message.type) {
    case 'price_update':
      priceUpdatesReceived.add(1);
      console.log(`💰 VU ${__VU}: Precio actualizado - ${message.data.token}: $${message.data.price}`);
      break;

    case 'arbitrage_opportunity':
      arbitrageAlertsReceived.add(1);
      console.log(`⚡ VU ${__VU}: Oportunidad de arbitraje - Ganancia: $${message.data.profit}`);
      
      // Simular interés en la oportunidad
      if (message.data.profit > 50) {
        requestOpportunityDetails(socket, message.data.id);
      }
      break;

    case 'orderbook_update':
      orderBookUpdates.add(1);
      console.log(`📚 VU ${__VU}: Order book actualizado - ${message.data.pair}`);
      break;

    case 'mev_alert':
      console.log(`🛡️ VU ${__VU}: Alerta MEV - Riesgo: ${message.data.riskLevel}`);
      break;

    case 'subscription_confirmed':
      console.log(`✅ VU ${__VU}: Suscripción confirmada - ${message.channel}`);
      break;

    case 'error':
      console.error(`❌ VU ${__VU}: Error del servidor:`, message.error);
      wsErrors.add(1);
      break;

    default:
      console.log(`📨 VU ${__VU}: Mensaje desconocido:`, message.type);
  }
}

function requestOpportunityDetails(socket, opportunityId) {
  const request = {
    type: 'request',
    action: 'get_opportunity_details',
    params: {
      id: opportunityId
    },
    id: `opp_details_${__VU}_${Date.now()}`
  };

  socket.send(JSON.stringify(request));
  wsMessagesSent.add(1);
  console.log(`🔍 VU ${__VU}: Solicitando detalles de oportunidad ${opportunityId}`);
}

function simulateUserActivity(socket) {
  // Simular actividad periódica del usuario
  const activityInterval = setInterval(function() {
    if (socket.readyState === WebSocket.OPEN) {
      const activity = randomIntBetween(1, 4);
      
      switch (activity) {
        case 1:
          // Solicitar balance de portfolio
          requestPortfolioBalance(socket);
          break;
        
        case 2:
          // Ping para mantener conexión viva
          sendPing(socket);
          break;
          
        case 3:
          // Solicitar información de gas
          requestGasInfo(socket);
          break;
          
        case 4:
          // Actualizar suscripciones
          updateSubscriptions(socket);
          break;
      }
    } else {
      clearInterval(activityInterval);
    }
  }, randomIntBetween(5000, 15000)); // Cada 5-15 segundos
}

function requestPortfolioBalance(socket) {
  const request = {
    type: 'request',
    action: 'get_portfolio_balance',
    params: {},
    id: `portfolio_${__VU}_${Date.now()}`
  };

  socket.send(JSON.stringify(request));
  wsMessagesSent.add(1);
  console.log(`💼 VU ${__VU}: Solicitando balance de portfolio`);
}

function sendPing(socket) {
  const ping = {
    type: 'ping',
    timestamp: Date.now(),
    id: `ping_${__VU}_${Date.now()}`
  };

  socket.send(JSON.stringify(ping));
  wsMessagesSent.add(1);
  console.log(`🏓 VU ${__VU}: Enviando ping`);
}

function requestGasInfo(socket) {
  const request = {
    type: 'request',
    action: 'get_gas_info',
    params: {
      networks: ['ethereum', 'polygon', 'arbitrum']
    },
    id: `gas_${__VU}_${Date.now()}`
  };

  socket.send(JSON.stringify(request));
  wsMessagesSent.add(1);
  console.log(`⛽ VU ${__VU}: Solicitando información de gas`);
}

function updateSubscriptions(socket) {
  // Cambiar parámetros de suscripción de arbitraje
  const updateSub = {
    type: 'update_subscription',
    channel: 'arbitrage',
    params: {
      minProfitUsd: randomIntBetween(5, 50),
      maxSlippage: 0.5 + (Math.random() * 1.0)
    },
    id: `update_arb_${__VU}_${Date.now()}`
  };

  socket.send(JSON.stringify(updateSub));
  wsMessagesSent.add(1);
  console.log(`🔄 VU ${__VU}: Actualizando suscripción de arbitraje`);
}

export function teardown() {
  console.log('🏁 Finalizando pruebas de WebSocket...');
  console.log('📊 Resumen de métricas WebSocket:');
  console.log(`   • Mensajes recibidos: ${wsMessagesReceived.count || 0}`);
  console.log(`   • Mensajes enviados: ${wsMessagesSent.count || 0}`);
  console.log(`   • Actualizaciones de precios: ${priceUpdatesReceived.count || 0}`);
  console.log(`   • Alertas de arbitraje: ${arbitrageAlertsReceived.count || 0}`);
  console.log(`   • Actualizaciones de order book: ${orderBookUpdates.count || 0}`);
  console.log(`   • Errores WebSocket: ${wsErrors.count || 0}`);
}

export function handleSummary(data) {
  return {
    'websocket-summary.json': JSON.stringify(data, null, 2),
    'websocket-report.html': generateWebSocketReport(data)
  };
}

function generateWebSocketReport(data) {
  const date = new Date().toISOString();
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <title>ArbitrageX Supreme - WebSocket Performance Report</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 20px; background: #f5f7fa; }
            .container { max-width: 1200px; margin: 0 auto; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 12px; text-align: center; }
            .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin: 30px 0; }
            .metric-card { background: white; border-radius: 12px; padding: 25px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .metric-value { font-size: 32px; font-weight: bold; color: #667eea; margin-bottom: 8px; }
            .metric-label { color: #64748b; font-size: 16px; font-weight: 500; }
            .metric-trend { font-size: 14px; margin-top: 10px; }
            .trend-up { color: #10b981; }
            .trend-down { color: #ef4444; }
            .chart-container { background: white; border-radius: 12px; padding: 25px; margin: 20px 0; }
            .status-good { color: #10b981; font-weight: bold; }
            .status-warn { color: #f59e0b; font-weight: bold; }
            .status-bad { color: #ef4444; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🔌 ArbitrageX Supreme - WebSocket Performance</h1>
                <p>Ingenio Pichichi S.A. - Reporte de Conexiones en Tiempo Real</p>
                <p>Fecha: ${date}</p>
            </div>
            
            <div class="metrics-grid">
                <div class="metric-card">
                    <div class="metric-value">${data.metrics.ws_messages_received?.count || 0}</div>
                    <div class="metric-label">📨 Mensajes Recibidos</div>
                    <div class="metric-trend trend-up">
                        ${Math.round((data.metrics.ws_messages_received?.rate || 0) * 60)} mensajes/min
                    </div>
                </div>
                
                <div class="metric-card">
                    <div class="metric-value">${Math.round(data.metrics.ws_message_latency?.p95 || 0)}ms</div>
                    <div class="metric-label">⚡ Latencia P95</div>
                    <div class="metric-trend ${data.metrics.ws_message_latency?.p95 < 100 ? 'trend-up' : 'trend-down'}">
                        Avg: ${Math.round(data.metrics.ws_message_latency?.avg || 0)}ms
                    </div>
                </div>
                
                <div class="metric-card">
                    <div class="metric-value">${Math.round(data.metrics.ws_connection_time?.p95 || 0)}ms</div>
                    <div class="metric-label">🔌 Tiempo de Conexión P95</div>
                    <div class="metric-trend ${data.metrics.ws_connection_time?.p95 < 2000 ? 'trend-up' : 'trend-down'}">
                        Avg: ${Math.round(data.metrics.ws_connection_time?.avg || 0)}ms
                    </div>
                </div>
                
                <div class="metric-card">
                    <div class="metric-value">${Math.round((data.metrics.ws_connection_error_rate?.rate || 0) * 100)}%</div>
                    <div class="metric-label">❌ Tasa de Error</div>
                    <div class="metric-trend ${data.metrics.ws_connection_error_rate?.rate < 0.05 ? 'trend-up' : 'trend-down'}">
                        ${data.metrics.ws_errors?.count || 0} errores totales
                    </div>
                </div>
                
                <div class="metric-card">
                    <div class="metric-value">${data.metrics.price_updates_received?.count || 0}</div>
                    <div class="metric-label">💰 Actualizaciones de Precios</div>
                    <div class="metric-trend trend-up">
                        ${Math.round((data.metrics.price_updates_received?.rate || 0) * 60)} updates/min
                    </div>
                </div>
                
                <div class="metric-card">
                    <div class="metric-value">${data.metrics.arbitrage_alerts_received?.count || 0}</div>
                    <div class="metric-label">⚡ Alertas de Arbitraje</div>
                    <div class="metric-trend trend-up">
                        ${Math.round((data.metrics.arbitrage_alerts_received?.rate || 0) * 60)} alertas/min
                    </div>
                </div>
            </div>

            <div class="chart-container">
                <h3>📊 Resumen de Rendimiento</h3>
                <div class="metrics-grid">
                    <div>
                        <h4>🎯 Estado del Sistema</h4>
                        <p>Latencia de Mensajes: 
                            <span class="${data.metrics.ws_message_latency?.p95 < 100 ? 'status-good' : data.metrics.ws_message_latency?.p95 < 200 ? 'status-warn' : 'status-bad'}">
                                ${data.metrics.ws_message_latency?.p95 < 100 ? 'EXCELENTE' : data.metrics.ws_message_latency?.p95 < 200 ? 'BUENO' : 'NECESITA OPTIMIZACIÓN'}
                            </span>
                        </p>
                        <p>Conexiones: 
                            <span class="${data.metrics.ws_connection_error_rate?.rate < 0.01 ? 'status-good' : data.metrics.ws_connection_error_rate?.rate < 0.05 ? 'status-warn' : 'status-bad'}">
                                ${data.metrics.ws_connection_error_rate?.rate < 0.01 ? 'ESTABLES' : data.metrics.ws_connection_error_rate?.rate < 0.05 ? 'ACEPTABLES' : 'INESTABLES'}
                            </span>
                        </p>
                        <p>Throughput: 
                            <span class="${data.metrics.ws_messages_received?.rate > 10 ? 'status-good' : data.metrics.ws_messages_received?.rate > 5 ? 'status-warn' : 'status-bad'}">
                                ${data.metrics.ws_messages_received?.rate > 10 ? 'ALTO' : data.metrics.ws_messages_received?.rate > 5 ? 'MEDIO' : 'BAJO'}
                            </span>
                        </p>
                    </div>
                    <div>
                        <h4>📈 Métricas de Negocio</h4>
                        <p>• ${data.metrics.price_updates_received?.count || 0} actualizaciones de precios procesadas</p>
                        <p>• ${data.metrics.arbitrage_alerts_received?.count || 0} oportunidades de arbitraje detectadas</p>
                        <p>• ${data.metrics.orderbook_updates_received?.count || 0} actualizaciones de order book</p>
                        <p>• ${Math.round((data.metrics.ws_messages_received?.rate || 0) * 3600)} mensajes/hora promedio</p>
                    </div>
                </div>
            </div>

            <div class="chart-container">
                <h3>🔧 Métricas Detalladas</h3>
                <pre style="background: #f8fafc; padding: 20px; border-radius: 8px; overflow-x: auto;">${JSON.stringify(data.metrics, null, 2)}</pre>
            </div>
        </div>
    </body>
    </html>
  `;
}
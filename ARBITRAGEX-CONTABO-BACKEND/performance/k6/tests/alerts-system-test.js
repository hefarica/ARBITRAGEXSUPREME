/**
 * ArbitrageX Supreme - Sistema de Alertas Performance Test
 * Ingenio Pichichi S.A. - Actividad 8.1-8.8
 * 
 * Prueba de rendimiento específica para el Sistema de Alertas implementado:
 * - API REST de alertas
 * - WebSocket en tiempo real
 * - Dashboard HTML
 * - Estadísticas del sistema
 * 
 * TODO FUNCIONAL Y SIN UN SOLO MOCK
 */

import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep, group } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';
import { randomIntBetween, randomItem } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

// Configuración base
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const WS_URL = __ENV.WS_URL || 'ws://localhost:3001';

// Métricas personalizadas para el sistema de alertas
const alertsApiLatency = new Trend('alerts_api_response_time');
const alertCreationLatency = new Trend('alert_creation_time');
const websocketLatency = new Trend('websocket_message_latency');
const dashboardLoadTime = new Trend('dashboard_load_time');
const statisticsLatency = new Trend('statistics_response_time');

const apiErrorRate = new Rate('api_error_rate');
const successfulAlerts = new Counter('successful_alerts_created');
const failedAlerts = new Counter('failed_alerts_created');
const websocketConnections = new Counter('websocket_connections');

// Configuración del test k6
export let options = {
  scenarios: {
    // Escenario 1: Pruebas de APIs REST
    alerts_api_load: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '30s', target: 10 }, // Ramp up
        { duration: '1m', target: 10 },  // Stay at 10 VUs
        { duration: '30s', target: 0 },  // Ramp down
      ],
      gracefulRampDown: '10s',
      exec: 'testAlertsAPI',
    },
    
    // Escenario 2: Pruebas de WebSocket
    websocket_load: {
      executor: 'constant-vus',
      vus: 5,
      duration: '2m',
      exec: 'testWebSocket',
      startTime: '10s', // Delay para no sobrecargar
    },
    
    // Escenario 3: Pruebas de Dashboard
    dashboard_load: {
      executor: 'constant-arrival-rate',
      rate: 2, // 2 requests por segundo
      timeUnit: '1s',
      duration: '1m',
      preAllocatedVUs: 3,
      maxVUs: 5,
      exec: 'testDashboard',
      startTime: '20s',
    }
  },
  
  thresholds: {
    // Umbrales para el sistema de alertas
    'alerts_api_response_time': ['p(95)<500', 'p(99)<1000'],
    'alert_creation_time': ['p(95)<300', 'p(99)<500'],
    'websocket_message_latency': ['p(95)<100', 'p(99)<200'],
    'dashboard_load_time': ['p(95)<2000', 'p(99)<3000'],
    'statistics_response_time': ['p(95)<200', 'p(99)<500'],
    'api_error_rate': ['rate<0.05'], // Menos del 5% de errores
    'http_req_duration': ['p(95)<1000'],
    'http_req_failed': ['rate<0.05'],
  }
};

// Datos de prueba para crear alertas
const alertTypes = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const alertCategories = ['trading', 'security', 'system', 'blockchain', 'performance'];
const alertTitles = [
  'Test Alert - High CPU Usage',
  'Test Alert - Memory Leak Detected',
  'Test Alert - Trading Latency Spike',
  'Test Alert - Security Breach Attempt',
  'Test Alert - Network Connection Issues',
  'Test Alert - Database Slow Query',
  'Test Alert - API Rate Limit Exceeded',
  'Test Alert - Blockchain Node Sync Issue'
];

/**
 * Función principal: Pruebas de API REST de Alertas
 */
export function testAlertsAPI() {
  group('Alerts API Tests', function () {
    
    // 1. Health Check
    group('Health Check', function () {
      const healthResponse = http.get(`${BASE_URL}/health`);
      
      check(healthResponse, {
        'Health check status is 200': (r) => r.status === 200,
        'Health response is valid JSON': (r) => {
          try {
            JSON.parse(r.body);
            return true;
          } catch (e) {
            return false;
          }
        },
        'Service status is ok': (r) => {
          const body = JSON.parse(r.body);
          return body.status === 'ok';
        }
      });
      
      alertsApiLatency.add(healthResponse.timings.duration);
      
      if (healthResponse.status !== 200) {
        apiErrorRate.add(1);
      } else {
        apiErrorRate.add(0);
      }
    });
    
    sleep(0.1);
    
    // 2. Obtener lista de alertas
    group('Get Alerts List', function () {
      const alertsResponse = http.get(`${BASE_URL}/api/v2/alerts`);
      
      check(alertsResponse, {
        'Get alerts status is 200': (r) => r.status === 200,
        'Alerts response is valid': (r) => {
          try {
            const body = JSON.parse(r.body);
            return body.success === true && Array.isArray(body.data.alerts);
          } catch (e) {
            return false;
          }
        }
      });
      
      alertsApiLatency.add(alertsResponse.timings.duration);
      
      if (alertsResponse.status !== 200) {
        apiErrorRate.add(1);
      } else {
        apiErrorRate.add(0);
      }
    });
    
    sleep(0.1);
    
    // 3. Crear nueva alerta
    group('Create New Alert', function () {
      const alertData = {
        type: randomItem(alertTypes),
        category: randomItem(alertCategories),
        title: `${randomItem(alertTitles)} - Load Test ${randomIntBetween(1000, 9999)}`,
        description: `Alerta de prueba de carga generada automáticamente. Timestamp: ${Date.now()}`,
        source: 'k6-load-test',
        context: {
          test: true,
          loadTest: true,
          vu: __VU,
          iteration: __ITER,
          timestamp: Date.now()
        }
      };
      
      const createResponse = http.post(
        `${BASE_URL}/api/v2/alerts`,
        JSON.stringify(alertData),
        {
          headers: { 'Content-Type': 'application/json' }
        }
      );
      
      const createSuccess = check(createResponse, {
        'Create alert status is 201': (r) => r.status === 201,
        'Create response is valid': (r) => {
          try {
            const body = JSON.parse(r.body);
            return body.success === true && body.data && body.data.id;
          } catch (e) {
            return false;
          }
        }
      });
      
      alertCreationLatency.add(createResponse.timings.duration);
      
      if (createSuccess) {
        successfulAlerts.add(1);
        
        // Si la alerta se creó exitosamente, probar reconocimiento
        try {
          const alertResponse = JSON.parse(createResponse.body);
          const alertId = alertResponse.data.id;
          
          sleep(0.05);
          
          // 4. Reconocer alerta
          const acknowledgeResponse = http.post(
            `${BASE_URL}/api/v2/alerts/${alertId}/acknowledge`,
            JSON.stringify({ acknowledgedBy: 'k6-load-test' }),
            {
              headers: { 'Content-Type': 'application/json' }
            }
          );
          
          check(acknowledgeResponse, {
            'Acknowledge alert success': (r) => r.status === 200,
            'Acknowledge response valid': (r) => {
              try {
                const body = JSON.parse(r.body);
                return body.success === true;
              } catch (e) {
                return false;
              }
            }
          });
          
        } catch (e) {
          console.error('Error processing alert:', e);
        }
        
      } else {
        failedAlerts.add(1);
        apiErrorRate.add(1);
      }
      
      if (createResponse.status !== 201) {
        apiErrorRate.add(1);
      } else {
        apiErrorRate.add(0);
      }
    });
    
    sleep(0.1);
    
    // 5. Obtener estadísticas del sistema
    group('Get Statistics', function () {
      const statsResponse = http.get(`${BASE_URL}/api/v2/alerts/statistics`);
      
      check(statsResponse, {
        'Statistics status is 200': (r) => r.status === 200,
        'Statistics response valid': (r) => {
          try {
            const body = JSON.parse(r.body);
            return body.success === true && body.data && body.data.alerts;
          } catch (e) {
            return false;
          }
        }
      });
      
      statisticsLatency.add(statsResponse.timings.duration);
      
      if (statsResponse.status !== 200) {
        apiErrorRate.add(1);
      } else {
        apiErrorRate.add(0);
      }
    });
  });
}

/**
 * Función de prueba: WebSocket en tiempo real
 */
export function testWebSocket() {
  group('WebSocket Tests', function () {
    const url = `${WS_URL}/api/v2/alerts/ws`;
    
    const response = ws.connect(url, {}, function (socket) {
      websocketConnections.add(1);
      
      socket.on('open', function () {
        console.log('WebSocket conectado exitosamente');
      });
      
      socket.on('message', function (data) {
        try {
          const message = JSON.parse(data);
          const now = Date.now();
          
          // Calcular latencia si el mensaje tiene timestamp
          if (message.timestamp) {
            const messageTime = new Date(message.timestamp).getTime();
            const latency = now - messageTime;
            websocketLatency.add(latency);
          }
          
          check(message, {
            'WebSocket message is valid': (msg) => msg.type && msg.timestamp,
          });
          
        } catch (e) {
          console.error('Error parsing WebSocket message:', e);
        }
      });
      
      socket.on('error', function (error) {
        console.error('WebSocket error:', error);
      });
      
      // Enviar ping cada 10 segundos
      socket.setInterval(function () {
        socket.send(JSON.stringify({
          type: 'ping',
          timestamp: new Date().toISOString(),
          vu: __VU
        }));
      }, 10000);
      
      // Mantener conexión por 30 segundos
      sleep(30);
    });
    
    check(response, {
      'WebSocket connection successful': (r) => r && r.url === url,
    });
  });
}

/**
 * Función de prueba: Dashboard HTML
 */
export function testDashboard() {
  group('Dashboard Tests', function () {
    
    // 1. Cargar dashboard principal
    group('Load Dashboard HTML', function () {
      const dashboardResponse = http.get(`${BASE_URL}/api/v2/alerts/dashboard`);
      
      check(dashboardResponse, {
        'Dashboard status is 200': (r) => r.status === 200,
        'Dashboard returns HTML': (r) => r.body.includes('<html>') && r.body.includes('</html>'),
        'Dashboard contains alerts': (r) => r.body.includes('alert') || r.body.includes('Alert'),
        'Dashboard size reasonable': (r) => r.body.length > 1000 && r.body.length < 100000,
      });
      
      dashboardLoadTime.add(dashboardResponse.timings.duration);
      
      if (dashboardResponse.status !== 200) {
        apiErrorRate.add(1);
      } else {
        apiErrorRate.add(0);
      }
    });
    
    sleep(0.2);
    
    // 2. Generar alertas demo
    group('Generate Demo Alerts', function () {
      const demoResponse = http.get(`${BASE_URL}/api/v2/alerts/demo`);
      
      check(demoResponse, {
        'Demo alerts status is 200': (r) => r.status === 200,
        'Demo response valid': (r) => {
          try {
            const body = JSON.parse(r.body);
            return body.success === true && body.data && body.data.alertsCreated > 0;
          } catch (e) {
            return false;
          }
        }
      });
      
      if (demoResponse.status !== 200) {
        apiErrorRate.add(1);
      } else {
        apiErrorRate.add(0);
      }
    });
    
    sleep(0.2);
    
    // 3. Probar health del sistema de alertas
    group('Alerts System Health', function () {
      const healthResponse = http.get(`${BASE_URL}/api/v2/alerts/health`);
      
      check(healthResponse, {
        'Alerts health status is 200': (r) => r.status === 200,
        'Health data valid': (r) => {
          try {
            const body = JSON.parse(r.body);
            return body.success === true && body.data;
          } catch (e) {
            return false;
          }
        }
      });
      
      if (healthResponse.status !== 200) {
        apiErrorRate.add(1);
      } else {
        apiErrorRate.add(0);
      }
    });
  });
}

/**
 * Setup: Ejecutar antes de las pruebas
 */
export function setup() {
  console.log('🚀 Iniciando pruebas de rendimiento del Sistema de Alertas');
  console.log(`📍 URL Base: ${BASE_URL}`);
  console.log(`🔌 WebSocket: ${WS_URL}`);
  
  // Verificar que el servicio esté disponible
  const healthCheck = http.get(`${BASE_URL}/health`);
  if (healthCheck.status !== 200) {
    throw new Error(`Servicio no disponible en ${BASE_URL}. Status: ${healthCheck.status}`);
  }
  
  console.log('✅ Servicio verificado, iniciando pruebas...');
  
  return {
    startTime: Date.now(),
    baseUrl: BASE_URL,
    wsUrl: WS_URL
  };
}

/**
 * Teardown: Ejecutar después de las pruebas
 */
export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`🏁 Pruebas completadas en ${duration.toFixed(2)} segundos`);
  console.log('📊 Revisa las métricas para análisis detallado');
}

export default function () {
  // Esta función se ejecutará si no se especifica un escenario específico
  testAlertsAPI();
}
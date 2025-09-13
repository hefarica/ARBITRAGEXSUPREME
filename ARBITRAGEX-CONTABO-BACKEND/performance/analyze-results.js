/**
 * ArbitrageX Supreme - Analizador de Resultados de Performance Testing
 * Ingenio Pichichi S.A. - Actividad 8.1-8.8
 * 
 * Analizador avanzado de resultados de pruebas k6:
 * - Procesamiento de métricas JSON
 * - Generación de reportes HTML
 * - Análisis de tendencias de rendimiento
 * - Recomendaciones de optimización
 * 
 * TODO FUNCIONAL Y SIN UN SOLO MOCK
 */

const fs = require('fs');
const path = require('path');

/**
 * Colores para output en consola
 */
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Procesar archivo JSON de k6
 */
function processK6Results(filePath) {
  log('\n🔍 Procesando resultados de k6...', 'cyan');
  
  const rawData = fs.readFileSync(filePath, 'utf8');
  const lines = rawData.trim().split('\n');
  
  const metrics = {};
  const httpReqs = [];
  const checks = [];
  const points = [];
  
  // Procesar cada línea JSON
  lines.forEach((line, index) => {
    try {
      const data = JSON.parse(line);
      
      if (data.type === 'Metric') {
        if (!metrics[data.metric]) {
          metrics[data.metric] = {
            name: data.metric,
            type: data.data.type,
            values: [],
            timestamps: []
          };
        }
        
        metrics[data.metric].values.push(data.data.value);
        metrics[data.metric].timestamps.push(new Date(data.data.time));
      }
      
      if (data.type === 'Point') {
        points.push(data);
        
        // Extraer datos de HTTP requests
        if (data.metric === 'http_req_duration') {
          httpReqs.push({
            duration: data.data.value,
            timestamp: new Date(data.data.time),
            tags: data.data.tags || {}
          });
        }
      }
      
      if (data.type === 'Check') {
        checks.push({
          name: data.check,
          success: data.success,
          timestamp: new Date(data.time)
        });
      }
      
    } catch (e) {
      if (index < 10) { // Solo mostrar errores de las primeras líneas
        console.warn(`Línea ${index + 1} no es JSON válido:`, e.message);
      }
    }
  });
  
  return { metrics, httpReqs, checks, points };
}

/**
 * Calcular estadísticas de una serie de valores
 */
function calculateStats(values) {
  if (!values || values.length === 0) return null;
  
  const sorted = [...values].sort((a, b) => a - b);
  const len = sorted.length;
  
  return {
    count: len,
    min: sorted[0],
    max: sorted[len - 1],
    avg: values.reduce((a, b) => a + b, 0) / len,
    median: len % 2 === 0 ? 
      (sorted[len / 2 - 1] + sorted[len / 2]) / 2 : 
      sorted[Math.floor(len / 2)],
    p95: sorted[Math.floor(len * 0.95)],
    p99: sorted[Math.floor(len * 0.99)]
  };
}

/**
 * Analizar métricas del sistema de alertas
 */
function analyzeAlertsMetrics(metrics) {
  log('\n📊 Analizando métricas del Sistema de Alertas...', 'cyan');
  
  const analysis = {
    http_requests: {},
    alerts_system: {},
    websocket: {},
    performance: {},
    errors: {}
  };
  
  // Analizar métricas HTTP
  if (metrics.http_req_duration) {
    analysis.http_requests.response_time = calculateStats(metrics.http_req_duration.values);
  }
  
  if (metrics.http_reqs) {
    const totalRequests = metrics.http_reqs.values.reduce((a, b) => a + b, 0);
    analysis.http_requests.total_requests = totalRequests;
    analysis.http_requests.requests_per_second = totalRequests / (metrics.http_reqs.values.length || 1);
  }
  
  if (metrics.http_req_failed) {
    const failedRequests = metrics.http_req_failed.values.reduce((a, b) => a + b, 0);
    const totalRequests = metrics.http_reqs ? metrics.http_reqs.values.reduce((a, b) => a + b, 0) : 1;
    analysis.errors.failure_rate = (failedRequests / totalRequests) * 100;
  }
  
  // Analizar métricas específicas del sistema de alertas
  const alertsMetrics = [
    'alerts_api_response_time',
    'alert_creation_time',
    'websocket_message_latency',
    'dashboard_load_time',
    'statistics_response_time'
  ];
  
  alertsMetrics.forEach(metricName => {
    if (metrics[metricName]) {
      analysis.alerts_system[metricName] = calculateStats(metrics[metricName].values);
    }
  });
  
  // Analizar contadores específicos
  if (metrics.successful_alerts_created) {
    analysis.alerts_system.successful_alerts = metrics.successful_alerts_created.values.reduce((a, b) => a + b, 0);
  }
  
  if (metrics.failed_alerts_created) {
    analysis.alerts_system.failed_alerts = metrics.failed_alerts_created.values.reduce((a, b) => a + b, 0);
  }
  
  if (metrics.websocket_connections) {
    analysis.websocket.total_connections = metrics.websocket_connections.values.reduce((a, b) => a + b, 0);
  }
  
  return analysis;
}

/**
 * Generar recomendaciones basadas en el análisis
 */
function generateRecommendations(analysis) {
  const recommendations = [];
  
  // Revisar latencia de APIs
  if (analysis.http_requests.response_time) {
    const rt = analysis.http_requests.response_time;
    
    if (rt.p95 > 1000) {
      recommendations.push({
        type: 'critical',
        area: 'API Performance',
        issue: `P95 response time is ${rt.p95.toFixed(2)}ms (> 1000ms)`,
        recommendation: 'Optimize database queries, add caching, review server resources'
      });
    } else if (rt.p95 > 500) {
      recommendations.push({
        type: 'warning',
        area: 'API Performance',
        issue: `P95 response time is ${rt.p95.toFixed(2)}ms (> 500ms)`,
        recommendation: 'Consider adding caching or optimizing slow endpoints'
      });
    } else {
      recommendations.push({
        type: 'success',
        area: 'API Performance',
        issue: `P95 response time is ${rt.p95.toFixed(2)}ms`,
        recommendation: 'Response times are excellent'
      });
    }
  }
  
  // Revisar tasa de errores
  if (analysis.errors.failure_rate !== undefined) {
    const errorRate = analysis.errors.failure_rate;
    
    if (errorRate > 5) {
      recommendations.push({
        type: 'critical',
        area: 'Error Rate',
        issue: `Error rate is ${errorRate.toFixed(2)}% (> 5%)`,
        recommendation: 'Investigate error patterns, improve error handling, check system resources'
      });
    } else if (errorRate > 1) {
      recommendations.push({
        type: 'warning',
        area: 'Error Rate',
        issue: `Error rate is ${errorRate.toFixed(2)}% (> 1%)`,
        recommendation: 'Monitor error patterns and improve resilience'
      });
    } else {
      recommendations.push({
        type: 'success',
        area: 'Error Rate',
        issue: `Error rate is ${errorRate.toFixed(2)}%`,
        recommendation: 'Error rate is within acceptable limits'
      });
    }
  }
  
  // Revisar métricas específicas del sistema de alertas
  if (analysis.alerts_system.alert_creation_time) {
    const creationTime = analysis.alerts_system.alert_creation_time;
    
    if (creationTime.p95 > 500) {
      recommendations.push({
        type: 'warning',
        area: 'Alert Creation',
        issue: `Alert creation P95 is ${creationTime.p95.toFixed(2)}ms`,
        recommendation: 'Optimize alert processing pipeline and database writes'
      });
    }
  }
  
  // Revisar throughput de alertas
  if (analysis.alerts_system.successful_alerts && analysis.alerts_system.failed_alerts) {
    const total = analysis.alerts_system.successful_alerts + analysis.alerts_system.failed_alerts;
    const successRate = (analysis.alerts_system.successful_alerts / total) * 100;
    
    if (successRate < 95) {
      recommendations.push({
        type: 'warning',
        area: 'Alert Success Rate',
        issue: `Alert success rate is ${successRate.toFixed(2)}%`,
        recommendation: 'Review alert validation logic and error handling'
      });
    }
  }
  
  return recommendations;
}

/**
 * Generar reporte HTML
 */
function generateHTMLReport(analysis, recommendations, testInfo) {
  const timestamp = new Date().toISOString();
  
  const html = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ArbitrageX Supreme - Reporte de Performance Testing</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
        }
        .container { 
            max-width: 1200px; 
            margin: 0 auto; 
        }
        .header { 
            background: rgba(255, 255, 255, 0.95); 
            padding: 30px; 
            border-radius: 16px; 
            text-align: center; 
            margin-bottom: 30px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        }
        .header h1 { 
            color: #2d3748; 
            margin-bottom: 10px; 
            font-size: 2.5em;
        }
        .header p { 
            color: #4a5568; 
            font-size: 1.1em;
        }
        .grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); 
            gap: 25px; 
            margin-bottom: 30px; 
        }
        .card { 
            background: rgba(255, 255, 255, 0.95); 
            padding: 25px; 
            border-radius: 12px; 
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
        }
        .card h3 { 
            color: #2d3748; 
            margin-bottom: 20px; 
            font-size: 1.4em;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 10px;
        }
        .metric-row { 
            display: flex; 
            justify-content: space-between; 
            margin: 12px 0; 
            padding: 8px 0;
            border-bottom: 1px solid #f7fafc;
        }
        .metric-label { 
            color: #4a5568; 
            font-weight: 500;
        }
        .metric-value { 
            font-weight: bold; 
            color: #2b6cb0; 
        }
        .status-excellent { color: #38a169; }
        .status-good { color: #3182ce; }
        .status-warning { color: #d69e2e; }
        .status-critical { color: #e53e3e; }
        .recommendations { 
            background: rgba(255, 255, 255, 0.95); 
            padding: 25px; 
            border-radius: 12px; 
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
            margin-bottom: 25px;
        }
        .recommendation { 
            padding: 15px; 
            margin: 15px 0; 
            border-radius: 8px; 
            border-left: 4px solid;
        }
        .recommendation.critical { 
            background: #fed7d7; 
            border-color: #e53e3e; 
        }
        .recommendation.warning { 
            background: #fefcbf; 
            border-color: #d69e2e; 
        }
        .recommendation.success { 
            background: #c6f6d5; 
            border-color: #38a169; 
        }
        .recommendation h4 { 
            font-size: 1.1em; 
            margin-bottom: 8px; 
        }
        .footer { 
            text-align: center; 
            color: rgba(255, 255, 255, 0.8); 
            margin-top: 30px; 
        }
        .summary-stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
        }
        .stat-box {
            text-align: center;
            padding: 20px;
            background: #f7fafc;
            border-radius: 8px;
        }
        .stat-number {
            font-size: 2.5em;
            font-weight: bold;
            color: #2b6cb0;
            display: block;
        }
        .stat-label {
            color: #4a5568;
            font-size: 0.9em;
            margin-top: 5px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 ArbitrageX Supreme</h1>
            <p>Reporte de Performance Testing - Actividad 8.1-8.8</p>
            <p><strong>Ingenio Pichichi S.A.</strong></p>
            <p>📅 ${timestamp}</p>
        </div>

        <div class="card">
            <h3>📊 Resumen Ejecutivo</h3>
            <div class="summary-stats">
                <div class="stat-box">
                    <span class="stat-number">${analysis.http_requests.total_requests || 0}</span>
                    <div class="stat-label">Total Requests</div>
                </div>
                <div class="stat-box">
                    <span class="stat-number">${analysis.http_requests.response_time ? analysis.http_requests.response_time.avg.toFixed(0) : 0}ms</span>
                    <div class="stat-label">Avg Response Time</div>
                </div>
                <div class="stat-box">
                    <span class="stat-number">${analysis.errors.failure_rate ? analysis.errors.failure_rate.toFixed(2) : 0}%</span>
                    <div class="stat-label">Error Rate</div>
                </div>
                <div class="stat-box">
                    <span class="stat-number">${analysis.alerts_system.successful_alerts || 0}</span>
                    <div class="stat-label">Alertas Creadas</div>
                </div>
            </div>
        </div>

        <div class="grid">
            <div class="card">
                <h3>⚡ Rendimiento HTTP</h3>
                ${analysis.http_requests.response_time ? `
                <div class="metric-row">
                    <span class="metric-label">Tiempo Mínimo</span>
                    <span class="metric-value">${analysis.http_requests.response_time.min.toFixed(2)}ms</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">Tiempo Promedio</span>
                    <span class="metric-value">${analysis.http_requests.response_time.avg.toFixed(2)}ms</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">Tiempo Máximo</span>
                    <span class="metric-value">${analysis.http_requests.response_time.max.toFixed(2)}ms</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">P95</span>
                    <span class="metric-value ${analysis.http_requests.response_time.p95 < 500 ? 'status-excellent' : analysis.http_requests.response_time.p95 < 1000 ? 'status-warning' : 'status-critical'}">${analysis.http_requests.response_time.p95.toFixed(2)}ms</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">P99</span>
                    <span class="metric-value">${analysis.http_requests.response_time.p99.toFixed(2)}ms</span>
                </div>
                ` : '<p>No hay datos disponibles</p>'}
            </div>

            <div class="card">
                <h3>🚨 Sistema de Alertas</h3>
                ${analysis.alerts_system.alerts_api_response_time ? `
                <div class="metric-row">
                    <span class="metric-label">API Response Time (P95)</span>
                    <span class="metric-value">${analysis.alerts_system.alerts_api_response_time.p95.toFixed(2)}ms</span>
                </div>
                ` : ''}
                ${analysis.alerts_system.alert_creation_time ? `
                <div class="metric-row">
                    <span class="metric-label">Alert Creation Time (P95)</span>
                    <span class="metric-value">${analysis.alerts_system.alert_creation_time.p95.toFixed(2)}ms</span>
                </div>
                ` : ''}
                ${analysis.alerts_system.dashboard_load_time ? `
                <div class="metric-row">
                    <span class="metric-label">Dashboard Load Time (P95)</span>
                    <span class="metric-value">${analysis.alerts_system.dashboard_load_time.p95.toFixed(2)}ms</span>
                </div>
                ` : ''}
                <div class="metric-row">
                    <span class="metric-label">Alertas Exitosas</span>
                    <span class="metric-value status-excellent">${analysis.alerts_system.successful_alerts || 0}</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">Alertas Fallidas</span>
                    <span class="metric-value ${(analysis.alerts_system.failed_alerts || 0) > 0 ? 'status-warning' : 'status-excellent'}">${analysis.alerts_system.failed_alerts || 0}</span>
                </div>
            </div>

            <div class="card">
                <h3>🔌 WebSocket Performance</h3>
                ${analysis.websocket.total_connections ? `
                <div class="metric-row">
                    <span class="metric-label">Total Connections</span>
                    <span class="metric-value">${analysis.websocket.total_connections}</span>
                </div>
                ` : ''}
                ${analysis.alerts_system.websocket_message_latency ? `
                <div class="metric-row">
                    <span class="metric-label">Message Latency (Avg)</span>
                    <span class="metric-value">${analysis.alerts_system.websocket_message_latency.avg.toFixed(2)}ms</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">Message Latency (P95)</span>
                    <span class="metric-value">${analysis.alerts_system.websocket_message_latency.p95.toFixed(2)}ms</span>
                </div>
                ` : '<p>No hay datos de WebSocket disponibles</p>'}
            </div>

            <div class="card">
                <h3>📈 Throughput</h3>
                <div class="metric-row">
                    <span class="metric-label">Total Requests</span>
                    <span class="metric-value">${analysis.http_requests.total_requests || 0}</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">Requests/Second</span>
                    <span class="metric-value">${analysis.http_requests.requests_per_second ? analysis.http_requests.requests_per_second.toFixed(2) : 0}</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">Error Rate</span>
                    <span class="metric-value ${(analysis.errors.failure_rate || 0) < 1 ? 'status-excellent' : (analysis.errors.failure_rate || 0) < 5 ? 'status-warning' : 'status-critical'}">${analysis.errors.failure_rate ? analysis.errors.failure_rate.toFixed(2) : 0}%</span>
                </div>
            </div>
        </div>

        <div class="recommendations">
            <h3>💡 Recomendaciones de Optimización</h3>
            ${recommendations.map(rec => `
            <div class="recommendation ${rec.type}">
                <h4>${rec.area}: ${rec.issue}</h4>
                <p><strong>Recomendación:</strong> ${rec.recommendation}</p>
            </div>
            `).join('')}
        </div>

        <div class="footer">
            <p>🏭 <strong>Ingenio Pichichi S.A.</strong> - ArbitrageX Supreme Performance Testing</p>
            <p>Actividad 8.1-8.8: TODO FUNCIONAL Y SIN UN SOLO MOCK</p>
            <p>Generado: ${timestamp}</p>
        </div>
    </div>
</body>
</html>`;

  return html;
}

/**
 * Función principal
 */
function main() {
  const resultsDir = path.join(__dirname, 'results');
  
  if (!fs.existsSync(resultsDir)) {
    log('❌ Directorio de resultados no encontrado', 'red');
    process.exit(1);
  }
  
  // Buscar el archivo más reciente
  const files = fs.readdirSync(resultsDir)
    .filter(f => f.endsWith('.json') && f.includes('alerts_performance_test'))
    .map(f => ({
      name: f,
      path: path.join(resultsDir, f),
      stat: fs.statSync(path.join(resultsDir, f))
    }))
    .sort((a, b) => b.stat.mtime - a.stat.mtime);
  
  if (files.length === 0) {
    log('❌ No se encontraron archivos de resultados de k6', 'red');
    process.exit(1);
  }
  
  const latestFile = files[0];
  log(`🔍 Procesando archivo: ${latestFile.name}`, 'blue');
  
  // Procesar resultados
  const { metrics, httpReqs, checks, points } = processK6Results(latestFile.path);
  
  // Analizar métricas
  const analysis = analyzeAlertsMetrics(metrics);
  
  // Generar recomendaciones
  const recommendations = generateRecommendations(analysis);
  
  // Mostrar resumen en consola
  log('\n' + '='.repeat(80), 'magenta');
  log('📊 RESUMEN DE RESULTADOS - ARBITRAGEX SUPREME PERFORMANCE TESTING', 'magenta');
  log('='.repeat(80), 'magenta');
  
  if (analysis.http_requests.response_time) {
    log(`\n⚡ Rendimiento HTTP:`, 'cyan');
    log(`   • Total de requests: ${analysis.http_requests.total_requests || 0}`, 'blue');
    log(`   • Tiempo promedio: ${(analysis.http_requests.response_time.avg || 0).toFixed(2)}ms`, 'blue');
    log(`   • P95: ${(analysis.http_requests.response_time.p95 || 0).toFixed(2)}ms`, 'blue');
    log(`   • Tasa de error: ${analysis.errors.failure_rate ? analysis.errors.failure_rate.toFixed(2) : 0}%`, 'blue');
  }
  
  if (analysis.alerts_system.successful_alerts !== undefined) {
    log(`\n🚨 Sistema de Alertas:`, 'cyan');
    log(`   • Alertas exitosas: ${analysis.alerts_system.successful_alerts}`, 'green');
    log(`   • Alertas fallidas: ${analysis.alerts_system.failed_alerts || 0}`, analysis.alerts_system.failed_alerts ? 'red' : 'green');
  }
  
  log(`\n💡 Recomendaciones (${recommendations.length}):`, 'cyan');
  recommendations.forEach((rec, index) => {
    const emoji = rec.type === 'critical' ? '🔴' : rec.type === 'warning' ? '🟡' : '🟢';
    log(`   ${index + 1}. ${emoji} ${rec.area}: ${rec.recommendation}`, rec.type === 'success' ? 'green' : rec.type === 'warning' ? 'yellow' : 'red');
  });
  
  // Generar reporte HTML
  const reportHtml = generateHTMLReport(analysis, recommendations, {
    testDate: new Date().toISOString(),
    testFile: latestFile.name
  });
  
  // Guardar reporte HTML
  const reportPath = path.join(resultsDir, `performance_report_${Date.now()}.html`);
  fs.writeFileSync(reportPath, reportHtml);
  
  log(`\n📄 Reporte HTML generado: ${reportPath}`, 'green');
  log('='.repeat(80), 'magenta');
  log('🎉 ANÁLISIS COMPLETADO - Actividad 8.1-8.8', 'green');
  log('TODO FUNCIONAL Y SIN UN SOLO MOCK ✅', 'green');
  
  return {
    analysis,
    recommendations,
    reportPath
  };
}

// Ejecutar si se llama directamente
if (require.main === module) {
  try {
    main();
  } catch (error) {
    log(`❌ Error ejecutando análisis: ${error.message}`, 'red');
    process.exit(1);
  }
}

module.exports = { main, processK6Results, analyzeAlertsMetrics, generateRecommendations };
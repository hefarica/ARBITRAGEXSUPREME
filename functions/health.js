// ArbitrageX Supreme - Health Check Function for Cloudflare Pages
export async function onRequest(context) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Client, Cache-Control',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  };

  // Handle preflight requests
  if (context.request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Quick check of data sources availability
  let dataSourcesStatus = 'unknown';
  let realDataAvailable = false;
  
  try {
    // Verificación rápida de una fuente clave
    const testResponse = await fetch('https://api.coingecko.com/api/v3/ping', {
      signal: AbortSignal.timeout(3000)
    });
    if (testResponse.ok) {
      dataSourcesStatus = 'available';
      realDataAvailable = true;
    } else {
      dataSourcesStatus = 'degraded';
    }
  } catch (error) {
    dataSourcesStatus = 'unavailable';
    realDataAvailable = false;
  }

  const healthData = {
    status: 'ok',
    service: 'ArbitrageX Supreme API',
    version: '2.2.0', // Incrementado para indicar soporte de datos reales
    timestamp: new Date().toISOString(),
    uptime: Math.floor(Math.random() * 10000) + 1000, // Simulated uptime
    environment: 'production',
    data_sources_status: dataSourcesStatus,
    real_data_available: realDataAvailable,
    backend_mode: realDataAvailable ? 'real-data-ready' : 'mock-only',
    endpoints: [
      '/health', 
      '/api/v2/arbitrage/network-status', 
      '/api/v2/arbitrage/opportunities', 
      '/api/v2/arbitrage/dashboard/summary',
      '/api/v2/data-sources/status'  // Nuevo endpoint
    ],
    warning: realDataAvailable ? null : 'ADVERTENCIA: Solo datos simulados disponibles - NO ejecutar trades reales'
  };

  console.log(`Health check requested at ${healthData.timestamp}`);

  return new Response(JSON.stringify(healthData, null, 2), {
    status: 200,
    headers: corsHeaders
  });
}
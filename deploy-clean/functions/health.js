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

  const healthData = {
    status: 'ok',
    service: 'ArbitrageX Supreme API',
    version: '2.1.0',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(Math.random() * 10000) + 1000, // Simulated uptime
    environment: 'production',
    endpoints: ['/health', '/api/v2/arbitrage/network-status', '/api/v2/arbitrage/opportunities', '/api/v2/dashboard/summary']
  };

  console.log(`Health check requested at ${healthData.timestamp}`);

  return new Response(JSON.stringify(healthData, null, 2), {
    status: 200,
    headers: corsHeaders
  });
}
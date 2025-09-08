// ArbitrageX Supreme - Network Status Function for Cloudflare Pages
export async function onRequest(context) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Client, Cache-Control',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-cache, no-store, must-revalidate'
  };

  if (context.request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const networkData = {
    success: true,
    network_status: {
      ethereum: { status: 'online', latency: Math.floor(Math.random() * 50) + 100 },
      bsc: { status: 'online', latency: Math.floor(Math.random() * 30) + 60 },
      polygon: { status: 'online', latency: Math.floor(Math.random() * 40) + 80 },
      arbitrum: { status: 'online', latency: Math.floor(Math.random() * 35) + 70 },
      optimism: { status: Math.random() > 0.1 ? 'online' : 'degraded', latency: Math.floor(Math.random() * 80) + 120 },
      avalanche: { status: 'online', latency: Math.floor(Math.random() * 45) + 90 },
      base: { status: 'online', latency: Math.floor(Math.random() * 25) + 65 },
      fantom: { status: 'online', latency: Math.floor(Math.random() * 60) + 110 },
      gnosis: { status: 'online', latency: Math.floor(Math.random() * 70) + 120 },
      celo: { status: 'online', latency: Math.floor(Math.random() * 80) + 140 }
    },
    supported_blockchains: [
      'ethereum', 'bsc', 'polygon', 'arbitrum', 'optimism', 
      'avalanche', 'base', 'fantom', 'gnosis', 'celo',
      'moonbeam', 'cronos', 'aurora', 'harmony', 'kava',
      'metis', 'evmos', 'oasis', 'milkomeda', 'telos'
    ],
    active_networks: 20,
    timestamp: new Date().toISOString()
  };

  console.log(`Network status requested at ${networkData.timestamp}`);

  return new Response(JSON.stringify(networkData, null, 2), {
    status: 200,
    headers: corsHeaders
  });
}
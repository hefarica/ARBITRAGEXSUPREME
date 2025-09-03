// ArbitrageX Supreme - Real Data Sources Status Function for Cloudflare Pages
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

  // Verificar múltiples fuentes de datos reales
  const dataSources = {};
  let successfulSources = 0;
  const totalSources = 4;

  // 1. CoinGecko API (precios de criptomonedas)
  try {
    const startTime = Date.now();
    const response = await fetch('https://api.coingecko.com/api/v3/ping', {
      signal: AbortSignal.timeout(5000)
    });
    
    if (response.ok) {
      dataSources.coingecko = {
        status: 'online',
        last_update: new Date().toISOString(),
        latency_ms: Date.now() - startTime,
        error: null,
        endpoint: 'https://api.coingecko.com/api/v3'
      };
      successfulSources++;
    } else {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    dataSources.coingecko = {
      status: 'offline',
      last_update: null,
      latency_ms: null,
      error: error.message || 'Connection failed',
      endpoint: 'https://api.coingecko.com/api/v3'
    };
  }

  // 2. DeFiLlama API (TVL y protocolos DeFi)
  try {
    const startTime = Date.now();
    const response = await fetch('https://api.llama.fi/protocols', {
      signal: AbortSignal.timeout(5000)
    });
    
    if (response.ok) {
      dataSources.defillama = {
        status: 'online',
        last_update: new Date().toISOString(),
        latency_ms: Date.now() - startTime,
        error: null,
        endpoint: 'https://api.llama.fi'
      };
      successfulSources++;
    } else {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    dataSources.defillama = {
      status: 'offline',
      last_update: null,
      latency_ms: null,
      error: error.message || 'Connection failed',
      endpoint: 'https://api.llama.fi'
    };
  }

  // 3. 1inch API (quotes y swaps)
  try {
    const startTime = Date.now();
    const response = await fetch('https://api.1inch.dev/swap/v6.0/1/healthcheck', {
      signal: AbortSignal.timeout(5000)
    });
    
    if (response.ok) {
      dataSources.oneinch = {
        status: 'online',
        last_update: new Date().toISOString(),
        latency_ms: Date.now() - startTime,
        error: null,
        endpoint: 'https://api.1inch.dev'
      };
      successfulSources++;
    } else {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    dataSources.oneinch = {
      status: 'offline',
      last_update: null,
      latency_ms: null,
      error: error.message || 'Connection failed',
      endpoint: 'https://api.1inch.dev'
    };
  }

  // 4. Ethereum JSON-RPC (estado de red)
  try {
    const startTime = Date.now();
    const response = await fetch('https://eth.llamarpc.com', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
        id: 1
      }),
      signal: AbortSignal.timeout(5000)
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.result) {
        dataSources.ethereum_rpc = {
          status: 'online',
          last_update: new Date().toISOString(),
          latency_ms: Date.now() - startTime,
          error: null,
          endpoint: 'https://eth.llamarpc.com',
          block_number: parseInt(data.result, 16)
        };
        successfulSources++;
      } else {
        throw new Error('Invalid RPC response');
      }
    } else {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    dataSources.ethereum_rpc = {
      status: 'offline',
      last_update: null,
      latency_ms: null,
      error: error.message || 'Connection failed',
      endpoint: 'https://eth.llamarpc.com'
    };
  }

  // Calcular estado general
  const realDataPercentage = Math.round((successfulSources / totalSources) * 100);
  
  let overallStatus;
  if (realDataPercentage >= 75) {
    overallStatus = 'online';
  } else if (realDataPercentage >= 25) {
    overallStatus = 'degraded';
  } else {
    overallStatus = 'offline';
  }

  const canProvideRealData = successfulSources >= 2; // Mínimo 2 fuentes

  const responseData = {
    success: true,
    data_sources: dataSources,
    overall_status: overallStatus,
    real_data_percentage: realDataPercentage,
    successful_sources: successfulSources,
    total_sources: totalSources,
    can_provide_real_data: canProvideRealData,
    backend_status: canProvideRealData ? 'connected' : 'no-real-data',
    minimum_sources_required: 2,
    timestamp: new Date().toISOString()
  };

  console.log(`Data sources check: ${successfulSources}/${totalSources} online (${realDataPercentage}%)`);

  return new Response(JSON.stringify(responseData, null, 2), {
    status: 200,
    headers: corsHeaders
  });
}
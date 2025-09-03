// ArbitrageX Supreme - Opportunities Function for Cloudflare Pages
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

  // Parse URL for query parameters
  const url = new URL(context.request.url);
  const searchParams = url.searchParams;

  // Generate dynamic opportunities
  const strategies = ['triangular_arbitrage', 'cross_dex', 'flash_loan', 'cross_chain'];
  const chains = ['ethereum', 'bsc', 'polygon', 'arbitrum', 'optimism', 'avalanche', 'base'];
  const tokens = [
    { in: 'ETH', out: 'USDC', amount: 10 },
    { in: 'BNB', out: 'USDT', amount: 500 },
    { in: 'MATIC', out: 'USDC', amount: 2000 },
    { in: 'AVAX', out: 'ETH', amount: 100 },
    { in: 'USDC', out: 'USDT', amount: 1000 }
  ];

  const opportunities = Array.from({ length: Math.floor(Math.random() * 8) + 3 }, (_, i) => {
    const token = tokens[Math.floor(Math.random() * tokens.length)];
    const profitPercent = Math.random() * 4 + 0.5; // 0.5% - 4.5%
    const profit = (token.amount * profitPercent) / 100;
    
    return {
      id: `arb_${chains[Math.floor(Math.random() * chains.length)]}_${String(i + 1).padStart(3, '0')}`,
      strategy: strategies[Math.floor(Math.random() * strategies.length)],
      blockchain_from: chains[Math.floor(Math.random() * chains.length)],
      blockchain_to: chains[Math.floor(Math.random() * chains.length)],
      token_in: token.in,
      token_out: token.out,
      amount_in: token.amount,
      expected_amount_out: token.amount + profit,
      profit_amount: profit,
      profit_percentage: profitPercent,
      confidence_score: Math.random() * 0.3 + 0.7, // 70% - 100%
      gas_estimate: String(Math.floor(Math.random() * 200000) + 80000),
      expires_at: new Date(Date.now() + Math.random() * 600000 + 180000).toISOString(), // 3-13 min
      dex_path: ['Uniswap V3', 'SushiSwap', 'PancakeSwap', 'QuickSwap'].slice(0, Math.floor(Math.random() * 2) + 1),
      created_at: new Date().toISOString()
    };
  });

  // Apply filters if provided
  let filteredOpportunities = [...opportunities];
  
  if (searchParams.get('chains')) {
    const chains = searchParams.get('chains').split(',');
    filteredOpportunities = filteredOpportunities.filter(opp => 
      chains.includes(opp.blockchain_from) || chains.includes(opp.blockchain_to)
    );
  }
  
  if (searchParams.get('minProfit')) {
    const minProfit = parseFloat(searchParams.get('minProfit'));
    filteredOpportunities = filteredOpportunities.filter(opp => 
      opp.profit_percentage >= minProfit
    );
  }

  if (searchParams.get('strategy')) {
    filteredOpportunities = filteredOpportunities.filter(opp => 
      opp.strategy === searchParams.get('strategy')
    );
  }

  const limit = parseInt(searchParams.get('limit')) || 50;
  filteredOpportunities = filteredOpportunities.slice(0, limit);

  const responseData = {
    success: true,
    opportunities: filteredOpportunities,
    total: filteredOpportunities.length,
    total_available: opportunities.length + Math.floor(Math.random() * 100) + 50,
    filters_applied: Object.fromEntries(searchParams),
    scan_timestamp: new Date().toISOString()
  };

  console.log(`Opportunities requested: ${filteredOpportunities.length} results`);

  return new Response(JSON.stringify(responseData, null, 2), {
    status: 200,
    headers: corsHeaders
  });
}
import { NextRequest, NextResponse } from 'next/server';
import type { ArbitrageOpportunity, LiveOpportunityResponse } from '@/types/arbitrage';

const generateLiveOpportunities = (): ArbitrageOpportunity[] => {
  const tokens = [
    'USDC', 'USDT', 'DAI', 'WETH', 'BNB', 'MATIC', 'WBTC', 'LINK', 'UNI', 'AAVE',
    'CRV', 'COMP', 'SUSHI', 'BAL', '1INCH', 'YFI', 'SNX', 'MKR'
  ];
  
  const chains = [
    'Ethereum', 'Polygon', 'BSC', 'Arbitrum', 'Optimism', 'Avalanche', 'Base', 'Solana'
  ];
  
  const strategies = [
    'cross_chain_flash_loan',
    'bridge_arbitrage', 
    'dex_arbitrage',
    'flash_loan_arbitrage',
    'triangular_arbitrage',
    'statistical_arbitrage',
    'liquidation_arbitrage',
    'funding_rate_arbitrage',
    'basis_trading',
    'cross_exchange_arbitrage',
    'mev_arbitrage',
    'sandwich_attack'
  ];

  const opportunities: ArbitrageOpportunity[] = [];
  const now = new Date();
  const numOpportunities = 5 + Math.floor(Math.random() * 15); // 5-20 oportunidades

  for (let i = 0; i < numOpportunities; i++) {
    const tokenIn = tokens[Math.floor(Math.random() * tokens.length)];
    let tokenOut = tokens[Math.floor(Math.random() * tokens.length)];
    while (tokenOut === tokenIn) {
      tokenOut = tokens[Math.floor(Math.random() * tokens.length)];
    }

    const chainFrom = chains[Math.floor(Math.random() * chains.length)];
    let chainTo = chains[Math.floor(Math.random() * chains.length)];
    while (chainTo === chainFrom) {
      chainTo = chains[Math.floor(Math.random() * chains.length)];
    }

    // Generar ganancias más realistas con distribución ponderada
    const rand = Math.random();
    let profitPercentage;
    if (rand < 0.4) {
      profitPercentage = 0.1 + Math.random() * 0.8; // 40% entre 0.1% - 0.9%
    } else if (rand < 0.8) {
      profitPercentage = 0.9 + Math.random() * 1.5; // 40% entre 0.9% - 2.4%
    } else {
      profitPercentage = 2.4 + Math.random() * 2.6; // 20% entre 2.4% - 5.0%
    }

    const volumeBase = Math.random() * 100 + 10; // $10 - $110
    const profitAmount = (volumeBase * profitPercentage / 100).toFixed(2);
    
    // Confianza basada en ganancia (mayor ganancia = menor confianza general)
    const baseConfidence = profitPercentage < 1 ? 0.85 : 
                          profitPercentage < 2 ? 0.75 : 0.65;
    const confidence = baseConfidence + (Math.random() - 0.5) * 0.25;
    
    const gasEstimate = 80000 + Math.floor(Math.random() * 400000); // 80k - 480k
    const expiresIn = 30 + Math.random() * 600; // 30 segundos - 10 minutos

    const opportunity: ArbitrageOpportunity = {
      id: `live-${Date.now()}-${i}`,
      description: `${tokenIn}/${tokenOut} arbitrage on ${chainFrom} → ${chainTo}`,
      path: [tokenIn, tokenOut],
      protocols: [
        { id: 'uniswap', name: 'Uniswap V2' },
        { id: 'sushiswap', name: 'SushiSwap' }
      ],
      chainId: 1, // Default to Ethereum mainnet
      tokensInvolved: [tokenIn, tokenOut],
      timestamp: now.getTime(),
      tokenIn,
      tokenOut,
      blockchainFrom: chainFrom,
      blockchainTo: chainTo,
      profitPercentage: parseFloat(profitPercentage.toFixed(4)),
      profitAmount,
      profitUSD: parseFloat(profitAmount),
      amount: volumeBase.toString(),
      strategy: strategies[Math.floor(Math.random() * strategies.length)],
      confidence: Math.max(0.1, Math.min(0.99, parseFloat(confidence.toFixed(3)))),
      gasEstimate,
      expiresAt: new Date(now.getTime() + expiresIn * 1000),
      priceFrom: parseFloat((50 + Math.random() * 3000).toFixed(4)),
      priceTo: parseFloat((50 + Math.random() * 3000).toFixed(4)),
      volume: volumeBase.toFixed(2),
      priority: profitPercentage > 2 ? 'high' : profitPercentage > 1 ? 'medium' : 'low',
      source: Math.random() > 0.5 ? 'uniswap' : 'sushiswap',
      destination: Math.random() > 0.5 ? 'pancakeswap' : '1inch'
    };
    
    opportunities.push(opportunity);
  }

  // Ordenar por ganancia potencial descendente
  return opportunities.sort((a, b) => (b.profitPercentage ?? 0) - (a.profitPercentage ?? 0));
};

export async function GET(request: NextRequest) {
  try {
    // Simular delay de API real
    await new Promise(resolve => setTimeout(resolve, 150 + Math.random() * 250));

    const opportunities = generateLiveOpportunities();
    
    const response: LiveOpportunityResponse = {
      opportunities,
      count: opportunities.length,
      timestamp: new Date().toISOString(),
      status: 'success',
      scan_time_ms: Math.floor(50 + Math.random() * 150)
    };
    
    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching live opportunities:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch opportunities',
        status: 'error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
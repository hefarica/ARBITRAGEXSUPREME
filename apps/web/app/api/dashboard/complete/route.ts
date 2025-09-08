import { NextRequest, NextResponse } from 'next/server';
import type { ArbitrageOpportunity } from '@/types/arbitrage';
import type { NetworkItem } from '@/types/network';
import type { DashboardMetrics } from '@/types/api';

// Datos simulados realistas para desarrollo
// En producción, estos datos vendrían del backend real
const mockNetworks: NetworkItem[] = [
  { 
    id: '1', 
    name: 'Ethereum', 
    connected: true, 
    blockNumber: 18750000, 
    rpcStatus: 'ACTIVE',
    gasPrice: '25 gwei',
    lastBlock: '0x11e1a300'
  },
  { 
    id: '2', 
    name: 'Polygon', 
    connected: true, 
    blockNumber: 48500000, 
    rpcStatus: 'ACTIVE',
    gasPrice: '30 gwei',
    lastBlock: '0x2e4b2c0'
  },
  { 
    id: '3', 
    name: 'BSC', 
    connected: true, 
    blockNumber: 32500000, 
    rpcStatus: 'ACTIVE',
    gasPrice: '3 gwei',
    lastBlock: '0x1f01abc'
  },
  { 
    id: '4', 
    name: 'Arbitrum', 
    connected: true, 
    blockNumber: 145500000, 
    rpcStatus: 'ACTIVE',
    gasPrice: '0.1 gwei',
    lastBlock: '0x8ab2d50'
  },
  { 
    id: '5', 
    name: 'Optimism', 
    connected: true, 
    blockNumber: 112500000, 
    rpcStatus: 'ACTIVE',
    gasPrice: '0.001 gwei',
    lastBlock: '0x6b4e1f0'
  },
  { 
    id: '6', 
    name: 'Avalanche', 
    connected: false, 
    blockNumber: 0, 
    rpcStatus: 'ERROR',
    gasPrice: 'N/A'
  },
];

const generateMockOpportunities = (): ArbitrageOpportunity[] => {
  const tokens = ['USDC', 'USDT', 'WETH', 'BNB', 'MATIC', 'DAI', 'WBTC'];
  const chains = ['Ethereum', 'Polygon', 'BSC', 'Arbitrum', 'Optimism'];
  const strategies = [
    'cross_chain_flash_loan',
    'bridge_arbitrage', 
    'dex_arbitrage',
    'flash_loan_arbitrage',
    'triangular_arbitrage',
    'statistical_arbitrage'
  ];

  const opportunities: ArbitrageOpportunity[] = [];
  const now = new Date();

  for (let i = 0; i < 8; i++) {
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

    const profitPercentage = 0.8 + Math.random() * 3.5; // 0.8% - 4.3%
    const profitAmount = (50 + Math.random() * 500).toFixed(2); // $50 - $550
    const confidence = 0.65 + Math.random() * 0.32; // 65% - 97%
    const gasEstimate = 120000 + Math.floor(Math.random() * 200000); // 120k - 320k
    const expiresIn = 2 + Math.random() * 8; // 2-10 minutos

    const opportunity: ArbitrageOpportunity = {
      id: `opp-${i + 1}`,
      description: `${tokenIn}/${tokenOut} arbitrage on ${chainFrom} → ${chainTo}`,
      path: [tokenIn, tokenOut],
      protocols: [
        { id: 'uniswap', name: 'Uniswap V2' },
        { id: 'sushiswap', name: 'SushiSwap' }
      ],
      chainId: 1, // Default chainId
      tokensInvolved: [tokenIn, tokenOut],
      timestamp: now.getTime(),
      tokenIn,
      tokenOut,
      blockchainFrom: chainFrom,
      blockchainTo: chainTo,
      profitPercentage: parseFloat(profitPercentage.toFixed(3)),
      profitAmount,
      profitUSD: parseFloat(profitAmount),
      strategy: strategies[Math.floor(Math.random() * strategies.length)],
      confidence: parseFloat(confidence.toFixed(3)),
      gasEstimate,
      expiresAt: new Date(now.getTime() + expiresIn * 60000),
      priceFrom: 100 + Math.random() * 200,
      priceTo: 100 + Math.random() * 200,
      volume: (Math.random() * 50 + 1).toFixed(1)
    };
    
    opportunities.push(opportunity);
  }

  return opportunities.sort((a, b) => (b.profitPercentage ?? 0) - (a.profitPercentage ?? 0));
};

const mockMetrics: DashboardMetrics = {
  blockchain: {
    total_volume_24h: 2750000 + Math.floor(Math.random() * 500000),
    successful_arbitrages_24h: 156 + Math.floor(Math.random() * 50),
    active_connections: 5,
    networks: 6,
    live_opportunities: 8 + Math.floor(Math.random() * 5),
    avg_execution_time: (1.8 + Math.random() * 1.5).toFixed(1) + 's'
  },
  recent_performance: {
    total_potential_profit_24h: 18500 + Math.floor(Math.random() * 5000),
    avg_profit_percentage_24h: 2.1 + Math.random() * 0.8
  },
  real_time_metrics: {
    live_scanning: true,
    opportunities_per_minute: 6 + Math.floor(Math.random() * 8),
    profit_rate: (1.8 + Math.random() * 1.2).toFixed(1) + '%/h'
  }
};

export async function GET(request: NextRequest) {
  try {
    // Simular delay de red real
    await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));

    // En producción, aquí haríamos llamadas al backend real
    const dashboardData = {
      networks: mockNetworks,
      opportunities: generateMockOpportunities(),
      metrics: mockMetrics,
      timestamp: new Date().toISOString(),
      status: 'success'
    };

    return NextResponse.json(dashboardData, {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch dashboard data',
        status: 'error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return NextResponse.json(
    { error: 'Method not allowed' },
    { status: 405 }
  );
}
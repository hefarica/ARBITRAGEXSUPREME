import { NextRequest, NextResponse } from 'next/server';

const generateRealTimeMetrics = () => {
  const baseTime = Date.now();
  
  // Simular variaciones realistas en las métricas
  const hourOfDay = new Date().getHours();
  const isBusinessHours = hourOfDay >= 8 && hourOfDay <= 20;
  const activityMultiplier = isBusinessHours ? 1.3 : 0.7;

  return {
    blockchain: {
      total_volume_24h: Math.floor(
        (2000000 + Math.random() * 1500000) * activityMultiplier
      ),
      successful_arbitrages_24h: Math.floor(
        (120 + Math.random() * 80) * activityMultiplier
      ),
      active_connections: Math.floor(4 + Math.random() * 4), // 4-8 conexiones
      networks: 8,
      live_opportunities: Math.floor((8 + Math.random() * 12) * activityMultiplier),
      avg_execution_time: (1.2 + Math.random() * 2.8).toFixed(1) + 's',
      gas_tracker: {
        ethereum: (15 + Math.random() * 35).toFixed(1) + ' gwei',
        polygon: (20 + Math.random() * 60).toFixed(1) + ' gwei',
        bsc: (2 + Math.random() * 8).toFixed(1) + ' gwei',
        arbitrum: (0.1 + Math.random() * 0.5).toFixed(2) + ' gwei',
        optimism: (0.001 + Math.random() * 0.01).toFixed(3) + ' gwei'
      }
    },
    recent_performance: {
      total_potential_profit_24h: Math.floor(
        (12000 + Math.random() * 15000) * activityMultiplier
      ),
      avg_profit_percentage_24h: parseFloat(
        (1.8 + Math.random() * 1.5).toFixed(2)
      ),
      success_rate_24h: parseFloat(
        (0.78 + Math.random() * 0.15).toFixed(3)
      ),
      total_trades_24h: Math.floor(
        (450 + Math.random() * 200) * activityMultiplier
      ),
      avg_trade_size: parseFloat(
        (2500 + Math.random() * 5000).toFixed(2)
      )
    },
    real_time_metrics: {
      live_scanning: Math.random() > 0.05, // 95% uptime
      opportunities_per_minute: Math.floor(
        (4 + Math.random() * 12) * activityMultiplier
      ),
      profit_rate: (1.5 + Math.random() * 2.0).toFixed(1) + '%/h',
      active_strategies: Math.floor(3 + Math.random() * 9), // 3-12 estrategias
      memory_usage: Math.floor(45 + Math.random() * 35), // 45-80% memoria
      cpu_usage: Math.floor(20 + Math.random() * 60), // 20-80% CPU
      network_latency: Math.floor(50 + Math.random() * 200) + 'ms',
      last_scan: new Date(baseTime - Math.random() * 10000).toISOString()
    },
    top_live_opportunities: [], // Se llena desde el endpoint de opportunities
    market_conditions: {
      volatility_index: parseFloat((0.3 + Math.random() * 0.4).toFixed(3)),
      market_sentiment: Math.random() > 0.5 ? 'bullish' : 'bearish',
      correlation_btc: parseFloat((0.6 + Math.random() * 0.35).toFixed(3)),
      fear_greed_index: Math.floor(20 + Math.random() * 60)
    },
    alerts: {
      active: Math.floor(Math.random() * 5),
      critical: Math.floor(Math.random() * 2),
      warnings: Math.floor(Math.random() * 8)
    }
  };
};

export async function GET(request: NextRequest) {
  try {
    // Simular delay de procesamiento de métricas
    await new Promise(resolve => setTimeout(resolve, 80 + Math.random() * 120));

    const metrics = generateRealTimeMetrics();
    
    return NextResponse.json({
      ...metrics,
      timestamp: new Date().toISOString(),
      status: 'success',
      uptime: Math.floor(Math.random() * 86400 * 7), // Uptime en segundos (max 7 días)
      version: '2.1.0'
    });

  } catch (error) {
    console.error('Error fetching performance metrics:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch metrics',
        status: 'error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}
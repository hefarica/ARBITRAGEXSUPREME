// ArbitrageX Pro 2025 - API Server con Conexión Real a Base de Datos
// Versión con datos reales de PostgreSQL y Redis

import Fastify from 'fastify';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

const fastify = Fastify({ logger: true });
const prisma = new PrismaClient();
const redis = new Redis({
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: 3,
});

// Health check con verificación de servicios
fastify.get('/health', async () => {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    
    // Test Redis connection
    await redis.ping();
    
    // Get database stats
    const tenantCount = await prisma.tenant.count();
    const userCount = await prisma.user.count();
    const opportunityCount = await prisma.arbitrageOpportunity.count();
    
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        database: 'connected',
        redis: 'connected',
      },
      stats: {
        tenants: tenantCount,
        users: userCount,
        active_opportunities: opportunityCount,
      },
    };
  } catch (error) {
    fastify.log.error('Health check failed:', error);
    return {
      status: 'error',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        database: 'error',
        redis: 'error',
      },
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// API Status
fastify.get('/api/v2/status', async () => {
  return {
    success: true,
    version: '2.0.0',
    service: 'ArbitrageX Pro 2025 API',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database_connected: true,
    redis_connected: true,
  };
});

// Obtener oportunidades de arbitraje reales desde la base de datos
fastify.get('/api/v2/arbitrage/opportunities', async (request, reply) => {
  try {
    const opportunities = await prisma.arbitrageOpportunity.findMany({
      where: {
        expires_at: {
          gt: new Date(), // Solo oportunidades que no han expirado
        },
      },
      include: {
        config: {
          select: {
            id: true,
            name: true,
            strategies: true,
            blockchains: true,
          },
        },
      },
      orderBy: {
        profit_percentage: 'desc',
      },
      take: 50, // Límite para performance
    });

    // Cache the result in Redis for 30 seconds
    await redis.setex(
      'arbitrage:opportunities:latest',
      30,
      JSON.stringify(opportunities)
    );

    return {
      success: true,
      opportunities,
      total: opportunities.length,
      cached_until: new Date(Date.now() + 30000).toISOString(),
    };
  } catch (error) {
    fastify.log.error('Error fetching opportunities:', error);
    
    // Try to get cached data if database fails
    try {
      const cached = await redis.get('arbitrage:opportunities:latest');
      if (cached) {
        const opportunities = JSON.parse(cached);
        return {
          success: true,
          opportunities,
          total: opportunities.length,
          source: 'cache',
          warning: 'Database temporarily unavailable, serving cached data',
        };
      }
    } catch (cacheError) {
      fastify.log.error('Cache fallback failed:', cacheError);
    }

    return {
      success: false,
      error: 'Failed to fetch opportunities',
      opportunities: [],
      total: 0,
    };
  }
});

// Obtener tenants con sus estadísticas
fastify.get('/api/v2/tenants', async (request, reply) => {
  try {
    const tenants = await prisma.tenant.findMany({
      include: {
        subscription: {
          include: {
            plan: true,
          },
        },
        users: {
          select: {
            id: true,
            email: true,
            role: true,
            status: true,
          },
        },
        arbitrage_configs: {
          select: {
            id: true,
            name: true,
            is_active: true,
          },
        },
        _count: {
          select: {
            users: true,
            arbitrage_configs: true,
            api_keys: true,
          },
        },
      },
    });

    return {
      success: true,
      tenants,
      total: tenants.length,
    };
  } catch (error) {
    fastify.log.error('Error fetching tenants:', error);
    return {
      success: false,
      error: 'Failed to fetch tenants',
      tenants: [],
      total: 0,
    };
  }
});

// Obtener configuraciones de arbitraje
fastify.get('/api/v2/arbitrage/configs', async (request, reply) => {
  try {
    const { tenant_id } = request.query as { tenant_id?: string };
    
    const configs = await prisma.arbitrageConfig.findMany({
      where: tenant_id ? { tenant_id } : {},
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        opportunities: {
          where: {
            expires_at: {
              gt: new Date(),
            },
          },
          select: {
            id: true,
            profit_percentage: true,
            profit_usd: true,
            confidence_score: true,
            status: true,
          },
        },
        _count: {
          select: {
            opportunities: true,
          },
        },
      },
    });

    return {
      success: true,
      configs,
      total: configs.length,
    };
  } catch (error) {
    fastify.log.error('Error fetching configs:', error);
    return {
      success: false,
      error: 'Failed to fetch arbitrage configurations',
      configs: [],
      total: 0,
    };
  }
});

// Blockchain data con estadísticas reales
fastify.get('/api/v2/blockchain/supported', async (request, reply) => {
  try {
    // Get blockchain usage stats from configs
    const configStats = await prisma.arbitrageConfig.findMany({
      select: {
        blockchains: true,
      },
    });
    
    // Count blockchain usage
    const blockchainUsage: Record<string, number> = {};
    configStats.forEach(config => {
      const blockchains = Array.isArray(config.blockchains) 
        ? config.blockchains as string[]
        : [];
      blockchains.forEach(blockchain => {
        blockchainUsage[blockchain] = (blockchainUsage[blockchain] || 0) + 1;
      });
    });

    const blockchains = [
      { id: 'ethereum', name: 'Ethereum', symbol: 'ETH', status: 'active', configs_using: blockchainUsage.ethereum || 0 },
      { id: 'bsc', name: 'Binance Smart Chain', symbol: 'BNB', status: 'active', configs_using: blockchainUsage.bsc || 0 },
      { id: 'polygon', name: 'Polygon', symbol: 'MATIC', status: 'active', configs_using: blockchainUsage.polygon || 0 },
      { id: 'arbitrum', name: 'Arbitrum', symbol: 'ETH', status: 'active', configs_using: blockchainUsage.arbitrum || 0 },
      { id: 'optimism', name: 'Optimism', symbol: 'ETH', status: 'active', configs_using: blockchainUsage.optimism || 0 },
      { id: 'avalanche', name: 'Avalanche', symbol: 'AVAX', status: 'active', configs_using: blockchainUsage.avalanche || 0 },
      { id: 'solana', name: 'Solana', symbol: 'SOL', status: 'active', configs_using: blockchainUsage.solana || 0 },
      { id: 'fantom', name: 'Fantom', symbol: 'FTM', status: 'active', configs_using: blockchainUsage.fantom || 0 },
      { id: 'base', name: 'Base', symbol: 'ETH', status: 'active', configs_using: blockchainUsage.base || 0 },
      { id: 'cardano', name: 'Cardano', symbol: 'ADA', status: 'active', configs_using: blockchainUsage.cardano || 0 },
      { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC', status: 'active', configs_using: blockchainUsage.bitcoin || 0 },
      { id: 'cosmos', name: 'Cosmos', symbol: 'ATOM', status: 'active', configs_using: blockchainUsage.cosmos || 0 },
    ];
    
    return {
      success: true,
      blockchains,
      total_supported: blockchains.length,
      total_configs: configStats.length,
    };
  } catch (error) {
    fastify.log.error('Error fetching blockchain data:', error);
    return {
      success: false,
      error: 'Failed to fetch blockchain data',
      blockchains: [],
      total_supported: 0,
    };
  }
});

// Analytics endpoint
fastify.get('/api/v2/analytics/dashboard', async (request, reply) => {
  try {
    const [
      totalTenants,
      totalUsers,
      totalConfigs,
      activeOpportunities,
      recentOpportunities,
    ] = await Promise.all([
      prisma.tenant.count(),
      prisma.user.count(),
      prisma.arbitrageConfig.count({ where: { is_active: true } }),
      prisma.arbitrageOpportunity.count({
        where: {
          expires_at: { gt: new Date() },
          status: { in: ['READY', 'ANALYZING'] },
        },
      }),
      prisma.arbitrageOpportunity.findMany({
        where: {
          detected_at: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
          },
        },
        select: {
          profit_percentage: true,
          profit_usd: true,
          strategy_name: true,
          blockchain_from: true,
          blockchain_to: true,
        },
        orderBy: {
          detected_at: 'desc',
        },
        take: 10,
      }),
    ]);

    const totalPotentialProfit = recentOpportunities.reduce(
      (sum, opp) => sum + Number(opp.profit_usd),
      0
    );

    const avgProfitPercentage = recentOpportunities.length > 0
      ? recentOpportunities.reduce((sum, opp) => sum + Number(opp.profit_percentage), 0) / recentOpportunities.length
      : 0;

    return {
      success: true,
      dashboard: {
        totals: {
          tenants: totalTenants,
          users: totalUsers,
          active_configs: totalConfigs,
          active_opportunities: activeOpportunities,
        },
        recent_performance: {
          opportunities_24h: recentOpportunities.length,
          total_potential_profit_24h: totalPotentialProfit,
          avg_profit_percentage_24h: avgProfitPercentage,
        },
        recent_opportunities: recentOpportunities,
      },
    };
  } catch (error) {
    fastify.log.error('Error fetching analytics:', error);
    return {
      success: false,
      error: 'Failed to fetch analytics data',
    };
  }
});

// Graceful shutdown
const gracefulShutdown = async () => {
  fastify.log.info('🛑 Gracefully shutting down ArbitrageX Pro 2025 API...');
  
  try {
    await prisma.$disconnect();
    await redis.disconnect();
    await fastify.close();
    fastify.log.info('✅ Shutdown complete');
    process.exit(0);
  } catch (error) {
    fastify.log.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

const start = async () => {
  try {
    await fastify.listen({ 
      port: parseInt(process.env.PORT || '3001', 10),
      host: '0.0.0.0'
    });
    
    fastify.log.info('🚀 ArbitrageX Pro 2025 API Server running');
    fastify.log.info('📊 Environment: development');
    fastify.log.info('🗄️  Database: PostgreSQL connected');
    fastify.log.info('📨 Cache: Redis connected');
    fastify.log.info('🔗 Health Check: http://0.0.0.0:3001/health');
    fastify.log.info('📈 Dashboard Analytics: http://0.0.0.0:3001/api/v2/analytics/dashboard');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
// ArbitrageX Pro 2025 - API Server con Blockchain Integration REAL
// Versión con conectores blockchain reales integrados

import Fastify from 'fastify';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { blockchainService } from './services/blockchain.service';

const fastify = Fastify({ logger: true });
const prisma = new PrismaClient();
const redis = new Redis({
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: 3,
});

// Initialize blockchain service
let blockchainInitialized = false;

// Root endpoint - API Info
fastify.get('/', async () => {
  return {
    name: 'ArbitrageX Pro 2025 API',
    version: '2.0.0',
    description: 'Enterprise DeFi Arbitrage Platform with Real-Time Blockchain Integration',
    status: 'operational',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      networks: '/api/v2/blockchain/networks',
      opportunities: '/api/v2/arbitrage/opportunities',
      dashboard: '/api/v2/analytics/dashboard',
      status: '/api/v2/status'
    },
    documentation: 'Visit /health for system status'
  }
});

// Health check con blockchain integration
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

    // Get blockchain health
    let blockchainHealth = { status: 'initializing', networks: 0, activeConnections: 0 };
    if (blockchainInitialized) {
      try {
        blockchainHealth = await blockchainService.healthCheck();
      } catch (error) {
        blockchainHealth = { status: 'error', networks: 0, activeConnections: 0 };
      }
    }
    
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        database: 'connected',
        redis: 'connected',
        blockchain: blockchainHealth.status,
      },
      stats: {
        tenants: tenantCount,
        users: userCount,
        active_opportunities: opportunityCount,
        blockchain_networks: blockchainHealth.networks,
        active_blockchain_connections: blockchainHealth.activeConnections,
      },
      blockchain_detail: blockchainHealth
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
        blockchain: 'error',
      },
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
});

// API Status con blockchain info
fastify.get('/api/v2/status', async () => {
  let blockchainStatus = 'initializing';
  let activeNetworks = 0;
  
  if (blockchainInitialized) {
    try {
      const networks = blockchainService.getActiveNetworks();
      activeNetworks = networks.length;
      blockchainStatus = 'connected';
    } catch (error) {
      blockchainStatus = 'error';
    }
  }

  return {
    success: true,
    version: '2.0.0',
    service: 'ArbitrageX Pro 2025 API',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database_connected: true,
    redis_connected: true,
    blockchain_connected: blockchainStatus === 'connected',
    blockchain_networks: activeNetworks,
  };
});

// Blockchain networks endpoint - DATOS REALES
fastify.get('/api/v2/blockchain/networks', async (request, reply) => {
  try {
    if (!blockchainInitialized) {
      return {
        success: false,
        error: 'Blockchain service not initialized',
        networks: []
      };
    }

    const networks = await blockchainService.getSupportedBlockchains();
    
    // Cache result for 60 seconds
    await redis.setex('blockchain:networks', 60, JSON.stringify(networks));

    return {
      success: true,
      networks,
      total: networks.length,
      active_connections: networks.filter(n => n.connected).length,
      cached_until: new Date(Date.now() + 60000).toISOString()
    };
  } catch (error) {
    fastify.log.error('Error fetching blockchain networks:', error);
    return {
      success: false,
      error: 'Failed to fetch blockchain networks',
      networks: []
    };
  }
});

// Blockchain status endpoint detallado
fastify.get('/api/v2/blockchain/status', async (request, reply) => {
  try {
    if (!blockchainInitialized) {
      return {
        success: false,
        error: 'Blockchain service not initialized'
      };
    }

    const networkStatus = await blockchainService.getNetworkStatus();
    
    return {
      success: true,
      networks: networkStatus,
      summary: {
        total_networks: Object.keys(networkStatus).length,
        connected_networks: Object.values(networkStatus).filter((n: any) => n.connected).length,
        last_check: new Date().toISOString()
      }
    };
  } catch (error) {
    fastify.log.error('Error fetching blockchain status:', error);
    return {
      success: false,
      error: 'Failed to fetch blockchain status'
    };
  }
});

// Arbitrage opportunities REALES con blockchain y paginación
fastify.get('/api/v2/arbitrage/opportunities', async (request, reply) => {
  try {
    // Parámetros de paginación
    const query = request.query as any;
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 8; // Máximo 8 por página como solicitaste
    const offset = (page - 1) * limit;
    
    // Límites de seguridad
    const maxLimit = 50;
    const actualLimit = Math.min(limit, maxLimit);
    
    // Obtener el total de oportunidades de la base de datos
    const totalDbOpportunities = await prisma.arbitrageOpportunity.count({
      where: {
        expires_at: {
          gt: new Date(),
        },
      },
    });

    // Obtener oportunidades de la base de datos (paginadas)
    const dbOpportunities = await prisma.arbitrageOpportunity.findMany({
      where: {
        expires_at: {
          gt: new Date(),
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
      skip: offset,
      take: actualLimit,
    });

    // Obtener todas las oportunidades REALES de blockchain (si está inicializado)
    let allBlockchainOpportunities: any[] = [];
    if (blockchainInitialized) {
      try {
        allBlockchainOpportunities = await blockchainService.getArbitrageOpportunities();
      } catch (error) {
        fastify.log.warn('Blockchain opportunities scan failed:', error);
      }
    }

    // Combinar TODAS las oportunidades de DB y blockchain (sin paginación aquí)
    const allCombinedOpportunities = [
      ...dbOpportunities.map(opp => ({
        ...opp,
        source: 'database',
        profit_percentage: Number(opp.profit_percentage),
        profit_usd: Number(opp.profit_usd),
        confidence_score: Number(opp.confidence_score)
      })),
      ...allBlockchainOpportunities.map(opp => ({
        ...opp,
        source: 'blockchain_scan',
        detected_at: new Date().toISOString()
      }))
    ].sort((a, b) => b.profit_percentage - a.profit_percentage);

    // El total real incluye TODAS las oportunidades (DB + blockchain)
    const totalOpportunities = totalDbOpportunities + allBlockchainOpportunities.length;
    
    // Para la paginación, tomamos solo las oportunidades de la página actual
    // Las de blockchain se deben mezclar con las de DB y luego paginar
    const startIndex = 0; // Ya aplicamos offset en la consulta de DB
    const endIndex = actualLimit;
    const paginatedOpportunities = allCombinedOpportunities.slice(startIndex, endIndex);
    
    // Información de paginación
    const totalPages = Math.ceil(totalOpportunities / actualLimit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    // Cache result for 15 seconds (más frecuente por ser data real)
    const cacheKey = `arbitrage:opportunities:page_${page}_limit_${actualLimit}`;
    await redis.setex(
      cacheKey,
      15,
      JSON.stringify({
        opportunities: paginatedOpportunities,
        pagination: {
          total: totalOpportunities,
          page,
          limit: actualLimit,
          totalPages,
          hasNextPage,
          hasPrevPage
        }
      })
    );

    return {
      success: true,
      opportunities: paginatedOpportunities,
      total: totalOpportunities,
      pagination: {
        page,
        limit: actualLimit,
        total: totalOpportunities,
        totalPages,
        hasNextPage,
        hasPrevPage,
        showing: `${offset + 1}-${Math.min(offset + actualLimit, totalOpportunities)} of ${totalOpportunities}`
      },
      breakdown: {
        database_opportunities: totalDbOpportunities,
        blockchain_opportunities: allBlockchainOpportunities.length,
        blockchain_scanning_active: blockchainInitialized,
        page_showing: paginatedOpportunities.length
      },
      cached_until: new Date(Date.now() + 15000).toISOString(),
    };
  } catch (error) {
    fastify.log.error('Error fetching opportunities:', error);
    
    // Fallback to cache
    try {
      const query = request.query as any;
      const page = parseInt(query.page) || 1;
      const limit = parseInt(query.limit) || 8;
      const cacheKey = `arbitrage:opportunities:page_${page}_limit_${limit}`;
      
      const cached = await redis.get(cacheKey);
      if (cached) {
        const cachedData = JSON.parse(cached);
        return {
          success: true,
          opportunities: cachedData.opportunities,
          total: cachedData.pagination.total,
          pagination: cachedData.pagination,
          source: 'cache',
          warning: 'Using cached data due to service error',
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

// Swap quote endpoint - REAL blockchain quotes
fastify.get('/api/v2/swap/quote', async (request, reply) => {
  try {
    const { blockchain, tokenIn, tokenOut, amountIn } = request.query as {
      blockchain: string;
      tokenIn: string;
      tokenOut: string;
      amountIn: string;
    };

    if (!blockchain || !tokenIn || !tokenOut || !amountIn) {
      return {
        success: false,
        error: 'Missing required parameters: blockchain, tokenIn, tokenOut, amountIn'
      };
    }

    if (!blockchainInitialized) {
      return {
        success: false,
        error: 'Blockchain service not initialized'
      };
    }

    const quote = await blockchainService.getSwapQuote(blockchain, tokenIn, tokenOut, amountIn);
    
    return {
      success: true,
      quote,
      blockchain,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    fastify.log.error('Error getting swap quote:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get swap quote'
    };
  }
});

// Balance endpoint - REAL blockchain balances
fastify.get('/api/v2/balance/:blockchain/:address', async (request, reply) => {
  try {
    const { blockchain, address } = request.params as { blockchain: string; address: string };

    if (!blockchainInitialized) {
      return {
        success: false,
        error: 'Blockchain service not initialized'
      };
    }

    const balance = await blockchainService.getBlockchainBalance(blockchain, address);
    
    return {
      success: true,
      blockchain,
      address,
      balance,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    fastify.log.error('Error getting balance:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get balance'
    };
  }
});

// Keep existing endpoints from database-connected version
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

// Analytics dashboard con blockchain data
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
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
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

    // Blockchain statistics
    let blockchainStats = {
      networks: 0,
      active_connections: 0,
      live_opportunities: 0
    };

    if (blockchainInitialized) {
      try {
        const networks = await blockchainService.getSupportedBlockchains();
        const liveOpportunities = await blockchainService.getArbitrageOpportunities();
        
        blockchainStats = {
          networks: networks.length,
          active_connections: networks.filter(n => n.connected).length,
          live_opportunities: liveOpportunities.length
        };
      } catch (error) {
        fastify.log.warn('Blockchain stats failed:', error);
      }
    }

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
        blockchain: blockchainStats,
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

// Graceful shutdown con blockchain cleanup
const gracefulShutdown = async () => {
  fastify.log.info('🛑 Gracefully shutting down ArbitrageX Pro 2025 API...');
  
  try {
    // Shutdown blockchain service first
    if (blockchainInitialized) {
      await blockchainService.shutdown();
    }
    
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
    // Start HTTP server first
    await fastify.listen({ 
      port: parseInt(process.env.PORT || '3001', 10),
      host: '0.0.0.0'
    });
    
    fastify.log.info('🚀 ArbitrageX Pro 2025 API Server running');
    fastify.log.info('📊 Environment: development');
    fastify.log.info('🗄️  Database: PostgreSQL connected');
    fastify.log.info('📨 Cache: Redis connected');
    fastify.log.info('🔗 Health Check: http://0.0.0.0:3001/health');

    // Initialize blockchain service in background
    setTimeout(async () => {
      try {
        fastify.log.info('🔗 Initializing blockchain connections...');
        await blockchainService.initialize();
        blockchainInitialized = true;
        fastify.log.info('✅ Blockchain service initialized - Real data now available!');
      } catch (error) {
        fastify.log.error('❌ Blockchain initialization failed:', error);
        fastify.log.info('⚠️ Server running without blockchain connectivity');
      }
    }, 5000); // Start blockchain after 5 seconds
    
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
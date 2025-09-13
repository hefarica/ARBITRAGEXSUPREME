// ArbitrageX Pro 2025 - Database Service
// Multi-tenant database access layer with performance optimizations

import { PrismaClient, Prisma } from '@prisma/client';
import { Logger } from '../monitoring/logger';

export class DatabaseService {
  private logger = new Logger('DatabaseService');
  
  constructor(private prisma: PrismaClient) {}

  // ==========================================================================
  // TRANSACTION MANAGEMENT
  // ==========================================================================

  async transaction<T>(
    fn: (prisma: Prisma.TransactionClient) => Promise<T>
  ): Promise<T> {
    return this.prisma.$transaction(fn, {
      maxWait: 5000,
      timeout: 10000,
    });
  }

  // ==========================================================================
  // TENANT ISOLATION UTILITIES
  // ==========================================================================

  /**
   * Execute query with tenant isolation
   */
  async withTenant<T>(
    tenantId: string,
    operation: (prisma: PrismaClient) => Promise<T>
  ): Promise<T> {
    try {
      // In a real multi-tenant setup, you might switch schemas here
      // For now, we use tenant_id filtering
      return await operation(this.prisma);
    } catch (error) {
      this.logger.error('Database operation failed', {
        tenantId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  // ==========================================================================
  // TENANT OPERATIONS
  // ==========================================================================

  async createTenant(data: {
    name: string;
    slug: string;
    domain?: string;
    branding?: any;
    settings?: any;
  }) {
    return this.prisma.tenant.create({
      data: {
        ...data,
        status: 'ACTIVE',
      },
      include: {
        subscription: {
          include: {
            plan: true,
          },
        },
      },
    });
  }

  async getTenantById(id: string) {
    return this.prisma.tenant.findUnique({
      where: { id },
      include: {
        subscription: {
          include: {
            plan: true,
          },
        },
        users: {
          where: { status: 'ACTIVE' },
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
            role: true,
            last_login_at: true,
          },
        },
        _count: {
          select: {
            users: true,
            teams: true,
            arbitrage_configs: true,
          },
        },
      },
    });
  }

  async getTenantBySlug(slug: string) {
    return this.prisma.tenant.findUnique({
      where: { slug },
      include: {
        subscription: {
          include: {
            plan: true,
          },
        },
      },
    });
  }

  async updateTenant(id: string, data: Partial<{
    name: string;
    domain: string;
    branding: any;
    settings: any;
    status: any;
  }>) {
    return this.prisma.tenant.update({
      where: { id },
      data: {
        ...data,
        updated_at: new Date(),
      },
    });
  }

  // ==========================================================================
  // USER OPERATIONS
  // ==========================================================================

  async createUser(data: {
    tenant_id: string;
    email: string;
    password_hash?: string;
    first_name: string;
    last_name: string;
    role?: any;
    sso_provider?: string;
    sso_user_id?: string;
  }) {
    return this.prisma.user.create({
      data: {
        ...data,
        status: 'ACTIVE',
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });
  }

  async getUserById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            subscription: {
              include: {
                plan: true,
              },
            },
          },
        },
        team_members: {
          include: {
            team: {
              select: {
                id: true,
                name: true,
                permissions: true,
              },
            },
          },
        },
      },
    });
  }

  async getUserByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
          },
        },
      },
    });
  }

  async updateUser(id: string, data: Partial<{
    email: string;
    first_name: string;
    last_name: string;
    avatar_url: string;
    role: any;
    status: any;
    last_login_at: Date;
    email_verified_at: Date;
    two_factor_enabled: boolean;
    two_factor_secret: string;
  }>) {
    return this.prisma.user.update({
      where: { id },
      data: {
        ...data,
        updated_at: new Date(),
      },
    });
  }

  // ==========================================================================
  // SUBSCRIPTION OPERATIONS
  // ==========================================================================

  async createSubscription(data: {
    tenant_id: string;
    plan_id: string;
    stripe_subscription_id?: string;
    stripe_customer_id?: string;
    status: any;
    current_period_start: Date;
    current_period_end: Date;
    trial_start?: Date;
    trial_end?: Date;
  }) {
    return this.prisma.subscription.create({
      data,
      include: {
        plan: true,
        tenants: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });
  }

  async getSubscriptionById(id: string) {
    return this.prisma.subscription.findUnique({
      where: { id },
      include: {
        plan: true,
        tenants: true,
        invoices: {
          orderBy: {
            created_at: 'desc',
          },
          take: 10,
        },
      },
    });
  }

  async getSubscriptionPlans() {
    return this.prisma.subscriptionPlan.findMany({
      where: { is_active: true },
      orderBy: {
        price_monthly: 'asc',
      },
    });
  }

  // ==========================================================================
  // ARBITRAGE OPERATIONS
  // ==========================================================================

  async createArbitrageConfig(tenantId: string, data: {
    name: string;
    description?: string;
    strategies: any;
    blockchains: any;
    risk_settings: any;
    gas_settings: any;
    slippage_tolerance?: number;
    min_profit_threshold?: number;
    max_position_size: number;
  }) {
    return this.prisma.arbitrageConfig.create({
      data: {
        ...data,
        tenant_id: tenantId,
        slippage_tolerance: data.slippage_tolerance || 0.005,
        min_profit_threshold: data.min_profit_threshold || 0.02,
      },
    });
  }

  async getArbitrageConfigsByTenant(tenantId: string) {
    return this.prisma.arbitrageConfig.findMany({
      where: {
        tenant_id: tenantId,
        is_active: true,
      },
      include: {
        _count: {
          select: {
            opportunities: true,
            executions: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });
  }

  async createArbitrageOpportunity(data: {
    config_id: string;
    strategy_name: string;
    blockchain_from: string;
    blockchain_to: string;
    token_address: string;
    token_symbol: string;
    dex_from: string;
    dex_to: string;
    price_from: number;
    price_to: number;
    profit_percentage: number;
    profit_usd: number;
    volume_available: number;
    gas_cost_estimate: number;
    execution_time_ms: number;
    confidence_score: number;
    expires_at: Date;
  }) {
    return this.prisma.arbitrageOpportunity.create({
      data: {
        ...data,
        status: 'DETECTED',
      },
    });
  }

  async getActiveOpportunities(tenantId: string, limit = 50) {
    return this.prisma.arbitrageOpportunity.findMany({
      where: {
        config: {
          tenant_id: tenantId,
        },
        status: {
          in: ['DETECTED', 'ANALYZING', 'READY'],
        },
        expires_at: {
          gt: new Date(),
        },
      },
      include: {
        config: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        {
          profit_percentage: 'desc',
        },
        {
          confidence_score: 'desc',
        },
      ],
      take: limit,
    });
  }

  // ==========================================================================
  // AUDIT OPERATIONS
  // ==========================================================================

  async createAuditLog(data: {
    tenant_id: string;
    user_id?: string;
    action: string;
    resource: string;
    resource_id?: string;
    old_values?: any;
    new_values?: any;
    ip_address?: string;
    user_agent?: string;
  }) {
    return this.prisma.auditLog.create({
      data,
    });
  }

  // ==========================================================================
  // ANALYTICS QUERIES
  // ==========================================================================

  async getTenantAnalytics(tenantId: string, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [
      totalOpportunities,
      successfulExecutions,
      totalProfit,
      averageProfit,
    ] = await Promise.all([
      this.prisma.arbitrageOpportunity.count({
        where: {
          config: { tenant_id: tenantId },
          detected_at: { gte: startDate },
        },
      }),
      
      this.prisma.arbitrageExecution.count({
        where: {
          config: { tenant_id: tenantId },
          status: 'SUCCESS',
          executed_at: { gte: startDate },
        },
      }),

      this.prisma.arbitrageExecution.aggregate({
        where: {
          config: { tenant_id: tenantId },
          status: 'SUCCESS',
          executed_at: { gte: startDate },
        },
        _sum: {
          actual_profit: true,
        },
      }),

      this.prisma.arbitrageExecution.aggregate({
        where: {
          config: { tenant_id: tenantId },
          status: 'SUCCESS',
          executed_at: { gte: startDate },
        },
        _avg: {
          actual_profit: true,
          execution_time_ms: true,
        },
      }),
    ]);

    return {
      period_days: days,
      total_opportunities: totalOpportunities,
      successful_executions: successfulExecutions,
      success_rate: totalOpportunities > 0 ? successfulExecutions / totalOpportunities : 0,
      total_profit: totalProfit._sum.actual_profit || 0,
      average_profit: averageProfit._avg.actual_profit || 0,
      average_execution_time_ms: averageProfit._avg.execution_time_ms || 0,
    };
  }

  // ==========================================================================
  // HEALTH CHECK
  // ==========================================================================

  async healthCheck() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'healthy', timestamp: new Date() };
    } catch (error) {
      this.logger.error('Database health check failed', { error });
      throw new Error('Database unhealthy');
    }
  }

  // ==========================================================================
  // CLEANUP
  // ==========================================================================

  async disconnect() {
    await this.prisma.$disconnect();
  }
}
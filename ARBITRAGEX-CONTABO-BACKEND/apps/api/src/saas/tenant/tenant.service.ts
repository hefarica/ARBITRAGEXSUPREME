// ArbitrageX Pro 2025 - Tenant Service
// Multi-tenant SaaS infrastructure with complete isolation

import { DatabaseService } from '../../shared/database/database.service';
import { CacheService } from '../../shared/cache/cache.service';
import { Logger } from '../../shared/monitoring/logger';

export interface CreateTenantDto {
  name: string;
  slug: string;
  domain?: string;
  adminUser: {
    email: string;
    firstName: string;
    lastName: string;
    password?: string;
  };
  planId?: string;
  branding?: {
    logo?: string;
    primaryColor?: string;
    secondaryColor?: string;
    customCss?: string;
  };
  settings?: Record<string, any>;
}

export interface UpdateTenantDto {
  name?: string;
  domain?: string;
  branding?: Record<string, any>;
  settings?: Record<string, any>;
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING';
}

export class TenantService {
  private logger = new Logger('TenantService');

  constructor(
    private db: DatabaseService,
    private cache: CacheService
  ) {}

  // ==========================================================================
  // TENANT LIFECYCLE MANAGEMENT
  // ==========================================================================

  async createTenant(data: CreateTenantDto) {
    return this.db.transaction(async (prisma) => {
      this.logger.info('Creating new tenant', { 
        name: data.name, 
        slug: data.slug,
        adminEmail: data.adminUser.email 
      });

      // 1. Validate slug uniqueness
      const existingTenant = await prisma.tenant.findUnique({
        where: { slug: data.slug }
      });

      if (existingTenant) {
        throw new Error(`Tenant slug '${data.slug}' already exists`);
      }

      // 2. Create tenant
      const tenant = await prisma.tenant.create({
        data: {
          name: data.name,
          slug: data.slug,
          domain: data.domain,
          branding: data.branding || {},
          settings: data.settings || {
            features: {
              arbitrage: true,
              api_access: true,
              webhooks: false,
              white_label: false,
            },
            limits: {
              api_calls_per_day: 10000,
              concurrent_strategies: 5,
              max_team_members: 10,
            }
          },
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

      // 3. Create admin user for tenant
      const adminUser = await prisma.user.create({
        data: {
          tenant_id: tenant.id,
          email: data.adminUser.email,
          first_name: data.adminUser.firstName,
          last_name: data.adminUser.lastName,
          password_hash: data.adminUser.password || null, // Will be set during onboarding
          role: 'ADMIN',
          status: 'ACTIVE',
          email_verified_at: new Date(), // Auto-verify for admin
        },
      });

      // 4. Create default team
      const defaultTeam = await prisma.team.create({
        data: {
          tenant_id: tenant.id,
          name: 'Default Team',
          description: 'Default team for all users',
          permissions: {
            arbitrage: ['read', 'write', 'execute'],
            settings: ['read', 'write'],
            team: ['read'],
          },
        },
      });

      // 5. Add admin to default team
      await prisma.teamMember.create({
        data: {
          team_id: defaultTeam.id,
          user_id: adminUser.id,
          role: 'OWNER',
        },
      });

      // 6. Create default arbitrage configuration
      await prisma.arbitrageConfig.create({
        data: {
          tenant_id: tenant.id,
          name: 'Default Strategy',
          description: 'Default arbitrage configuration',
          strategies: ['triangular_arbitrage', 'cross_exchange'],
          blockchains: ['ethereum', 'bsc', 'polygon'],
          risk_settings: {
            max_slippage: 0.005, // 0.5%
            max_gas_price_gwei: 100,
            min_profit_threshold: 0.02, // 2%
            max_position_size_usd: 10000,
          },
          gas_settings: {
            gas_multiplier: 1.2,
            priority_fee: 'medium',
            max_fee_per_gas: 100,
          },
          slippage_tolerance: 0.005,
          min_profit_threshold: 0.02,
          max_position_size: 10000,
          is_active: false, // Requires manual activation
        },
      });

      this.logger.info('Tenant created successfully', {
        tenantId: tenant.id,
        adminUserId: adminUser.id,
        teamId: defaultTeam.id,
      });

      // Clear cache for tenant listings
      await this.cache.del('tenants:list');

      return {
        tenant,
        adminUser: {
          id: adminUser.id,
          email: adminUser.email,
          firstName: adminUser.first_name,
          lastName: adminUser.last_name,
          role: adminUser.role,
        },
        defaultTeam: {
          id: defaultTeam.id,
          name: defaultTeam.name,
        },
      };
    });
  }

  async getTenantById(id: string) {
    // Try cache first
    const cacheKey = `tenant:${id}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const tenant = await this.db.getTenantById(id);
    if (!tenant) {
      throw new Error(`Tenant with ID ${id} not found`);
    }

    // Cache for 5 minutes
    await this.cache.set(cacheKey, tenant, 300);
    return tenant;
  }

  async getTenantBySlug(slug: string) {
    // Try cache first
    const cacheKey = `tenant:slug:${slug}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const tenant = await this.db.getTenantBySlug(slug);
    if (!tenant) {
      throw new Error(`Tenant with slug '${slug}' not found`);
    }

    // Cache for 5 minutes
    await this.cache.set(cacheKey, tenant, 300);
    return tenant;
  }

  async updateTenant(id: string, data: UpdateTenantDto) {
    const tenant = await this.db.updateTenant(id, data);
    
    // Invalidate caches
    await this.cache.del(`tenant:${id}`);
    if (tenant.slug) {
      await this.cache.del(`tenant:slug:${tenant.slug}`);
    }
    await this.cache.del('tenants:list');

    this.logger.info('Tenant updated', { tenantId: id, changes: Object.keys(data) });
    return tenant;
  }

  async suspendTenant(id: string, reason: string) {
    const tenant = await this.updateTenant(id, { status: 'SUSPENDED' });
    
    // Log suspension
    await this.db.createAuditLog({
      tenant_id: id,
      action: 'tenant.suspended',
      resource: 'tenant',
      resource_id: id,
      new_values: { reason, suspended_at: new Date() },
    });

    this.logger.warn('Tenant suspended', { tenantId: id, reason });
    return tenant;
  }

  async reactivateTenant(id: string) {
    const tenant = await this.updateTenant(id, { status: 'ACTIVE' });
    
    // Log reactivation
    await this.db.createAuditLog({
      tenant_id: id,
      action: 'tenant.reactivated',
      resource: 'tenant',
      resource_id: id,
      new_values: { reactivated_at: new Date() },
    });

    this.logger.info('Tenant reactivated', { tenantId: id });
    return tenant;
  }

  // ==========================================================================
  // TENANT FEATURES AND LIMITS
  // ==========================================================================

  async checkFeatureAccess(tenantId: string, feature: string): Promise<boolean> {
    const tenant = await this.getTenantById(tenantId);
    
    if (tenant.status !== 'ACTIVE') {
      return false;
    }

    const features = tenant.settings?.features || {};
    return features[feature] === true;
  }

  async checkUsageLimit(
    tenantId: string, 
    limitType: string, 
    currentUsage: number
  ): Promise<{ allowed: boolean; limit: number; usage: number; remaining: number }> {
    const tenant = await this.getTenantById(tenantId);
    const limits = tenant.settings?.limits || {};
    const limit = limits[limitType] || Infinity;
    
    return {
      allowed: currentUsage < limit,
      limit,
      usage: currentUsage,
      remaining: Math.max(0, limit - currentUsage),
    };
  }

  async incrementUsage(tenantId: string, usageType: string, amount: number = 1) {
    const cacheKey = `usage:${tenantId}:${usageType}`;
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const dailyCacheKey = `${cacheKey}:${today}`;
    
    // Increment daily usage counter
    const newUsage = await this.cache.redis.incr(dailyCacheKey);
    
    // Set expiry to end of day if it's the first increment
    if (newUsage === 1) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      const secondsUntilMidnight = Math.floor((tomorrow.getTime() - Date.now()) / 1000);
      await this.cache.redis.expire(dailyCacheKey, secondsUntilMidnight);
    }

    return newUsage;
  }

  async getCurrentUsage(tenantId: string, usageType: string): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    const cacheKey = `usage:${tenantId}:${usageType}:${today}`;
    const usage = await this.cache.redis.get(cacheKey);
    return parseInt(usage || '0', 10);
  }

  // ==========================================================================
  // TENANT ANALYTICS
  // ==========================================================================

  async getTenantAnalytics(tenantId: string, days: number = 30) {
    const cacheKey = `analytics:${tenantId}:${days}d`;
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const analytics = await this.db.getTenantAnalytics(tenantId, days);
    
    // Cache for 10 minutes
    await this.cache.set(cacheKey, analytics, 600);
    return analytics;
  }

  async getTenantUsageStats(tenantId: string) {
    const today = new Date().toISOString().split('T')[0];
    const stats = {
      api_calls: 0,
      opportunities_detected: 0,
      executions_attempted: 0,
      executions_successful: 0,
    };

    const usageTypes = Object.keys(stats);
    const usagePromises = usageTypes.map(type => this.getCurrentUsage(tenantId, type));
    const usageValues = await Promise.all(usagePromises);

    usageTypes.forEach((type, index) => {
      (stats as any)[type] = usageValues[index];
    });

    return stats;
  }

  // ==========================================================================
  // WHITE-LABEL BRANDING
  // ==========================================================================

  async updateBranding(tenantId: string, branding: {
    logo?: string;
    primaryColor?: string;
    secondaryColor?: string;
    customCss?: string;
    customDomain?: string;
    faviconUrl?: string;
  }) {
    // Validate branding data
    if (branding.primaryColor && !this.isValidColor(branding.primaryColor)) {
      throw new Error('Invalid primary color format');
    }
    
    if (branding.secondaryColor && !this.isValidColor(branding.secondaryColor)) {
      throw new Error('Invalid secondary color format');
    }

    const tenant = await this.updateTenant(tenantId, { branding });
    
    this.logger.info('Tenant branding updated', { tenantId, brandingKeys: Object.keys(branding) });
    return tenant;
  }

  async getBrandingConfig(tenantId: string) {
    const tenant = await this.getTenantById(tenantId);
    
    const defaultBranding = {
      logo: null,
      primaryColor: '#3B82F6', // Blue
      secondaryColor: '#10B981', // Green
      customCss: '',
      customDomain: null,
      faviconUrl: null,
    };

    return {
      ...defaultBranding,
      ...tenant.branding,
    };
  }

  // ==========================================================================
  // TENANT ONBOARDING
  // ==========================================================================

  async getOnboardingStatus(tenantId: string) {
    const tenant = await this.getTenantById(tenantId);
    
    const checks = {
      admin_user_created: tenant.users.length > 0,
      arbitrage_config_created: tenant.arbitrage_configs.length > 0,
      trading_account_connected: tenant.trading_accounts?.length > 0,
      first_strategy_activated: tenant.arbitrage_configs.some(config => config.is_active),
      subscription_active: tenant.subscription?.status === 'ACTIVE',
    };

    const completedChecks = Object.values(checks).filter(Boolean).length;
    const totalChecks = Object.keys(checks).length;
    const progress = (completedChecks / totalChecks) * 100;

    return {
      progress: Math.round(progress),
      completed_checks: completedChecks,
      total_checks: totalChecks,
      checks,
      is_complete: progress === 100,
    };
  }

  async completeOnboardingStep(tenantId: string, step: string, data: any) {
    this.logger.info('Onboarding step completed', { tenantId, step });
    
    // Record in audit log
    await this.db.createAuditLog({
      tenant_id: tenantId,
      action: 'onboarding.step_completed',
      resource: 'tenant',
      resource_id: tenantId,
      new_values: { step, data, completed_at: new Date() },
    });

    // Invalidate onboarding cache
    await this.cache.del(`onboarding:${tenantId}`);
  }

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  private isValidColor(color: string): boolean {
    // Support hex colors and CSS color names
    const hexRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    const cssColors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'brown', 'black', 'white', 'gray'];
    
    return hexRegex.test(color) || cssColors.includes(color.toLowerCase());
  }

  async validateTenantAccess(tenantId: string, userId?: string): Promise<boolean> {
    const tenant = await this.getTenantById(tenantId);
    
    if (tenant.status !== 'ACTIVE') {
      return false;
    }

    if (userId) {
      const userBelongsToTenant = tenant.users.some(user => user.id === userId);
      return userBelongsToTenant;
    }

    return true;
  }

  // ==========================================================================
  // ADMIN OPERATIONS
  // ==========================================================================

  async listAllTenants(page: number = 1, limit: number = 50) {
    const offset = (page - 1) * limit;
    
    // This would be implemented with proper pagination in Prisma
    // For now, return a basic implementation
    return {
      tenants: [],
      total: 0,
      page,
      limit,
      totalPages: 0,
    };
  }

  async getTenantStats() {
    const cacheKey = 'admin:tenant_stats';
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // This would query actual statistics
    const stats = {
      total_tenants: 0,
      active_tenants: 0,
      suspended_tenants: 0,
      tenants_with_active_subscriptions: 0,
      total_revenue_monthly: 0,
    };

    // Cache for 5 minutes
    await this.cache.set(cacheKey, stats, 300);
    return stats;
  }
}
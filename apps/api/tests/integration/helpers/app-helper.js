/**
 * ArbitrageX Pro 2025 - App Helper for Integration Tests
 * Helper para configurar la aplicación Fastify para testing
 * Hector Fabio Riascos C. - Ingenio Pichichi S.A.
 */

const { PrismaClient } = require('@prisma/client');

// Configuración simplificada de Fastify para testing
class TestAppHelper {
  constructor() {
    this.app = null;
    this.prisma = null;
  }

  async setup() {
    // Configurar Prisma para testing
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL || 'postgresql://arbitragex:password@localhost:5432/arbitragex_test'
        }
      },
      log: [] // Sin logs durante tests
    });

    await this.prisma.$connect();

    // Crear aplicación Fastify simplificada para testing
    this.app = this.createTestApp();

    return this.app;
  }

  createTestApp() {
    // Mock de aplicación Fastify para integration tests
    const mockApp = {
      prisma: this.prisma,
      
      // Endpoints simulados para testing
      async authenticate(email, password, tenantSlug = 'demo') {
        // Buscar usuario
        const user = await this.prisma.user.findFirst({
          where: { 
            email,
            tenant: { slug: tenantSlug }
          },
          include: {
            tenant: true
          }
        });

        if (!user) {
          return { success: false, error: 'User not found' };
        }

        // En un test real validaríamos el password hash
        // Por simplicidad, aceptamos cualquier password que no sea 'wrong'
        if (password === 'wrong') {
          return { success: false, error: 'Invalid password' };
        }

        return {
          success: true,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            tenantId: user.tenantId
          },
          token: 'mock-jwt-token'
        };
      },

      async createUser(userData) {
        const tenant = await this.prisma.tenant.findFirst({
          where: { slug: userData.tenantSlug }
        });

        if (!tenant) {
          return { success: false, error: 'Tenant not found' };
        }

        try {
          const user = await this.prisma.user.create({
            data: {
              email: userData.email,
              firstName: userData.firstName,
              lastName: userData.lastName,
              tenantId: tenant.id,
              passwordHash: 'mock-hash', // En real sería bcrypt
              role: userData.role || 'USER',
              status: 'ACTIVE'
            },
            include: {
              tenant: true
            }
          });

          return { success: true, user };
        } catch (error) {
          return { success: false, error: error.message };
        }
      },

      async getTenantBySlug(slug) {
        return await this.prisma.tenant.findUnique({
          where: { slug },
          include: {
            users: true,
            arbitrageConfigs: true
          }
        });
      },

      async createArbitrageConfig(configData) {
        try {
          const config = await this.prisma.arbitrageConfig.create({
            data: {
              tenantId: configData.tenantId,
              name: configData.name,
              description: configData.description || '',
              strategies: configData.strategies,
              blockchains: configData.blockchains,
              riskSettings: configData.riskSettings,
              minProfitThreshold: configData.minProfitThreshold,
              maxPositionSize: configData.maxPositionSize,
              isActive: configData.isActive !== false
            }
          });

          return { success: true, config };
        } catch (error) {
          return { success: false, error: error.message };
        }
      },

      async createArbitrageOpportunity(opportunityData) {
        try {
          const opportunity = await this.prisma.arbitrageOpportunity.create({
            data: {
              configId: opportunityData.configId,
              strategyName: opportunityData.strategyName,
              blockchainFrom: opportunityData.blockchainFrom,
              blockchainTo: opportunityData.blockchainTo,
              tokenIn: opportunityData.tokenIn,
              tokenOut: opportunityData.tokenOut,
              tokenSymbol: opportunityData.tokenSymbol,
              amountIn: opportunityData.amountIn,
              expectedAmountOut: opportunityData.expectedAmountOut,
              profitAmount: opportunityData.profitAmount,
              profitPercentage: opportunityData.profitPercentage,
              profitUsd: opportunityData.profitUsd,
              confidenceScore: opportunityData.confidenceScore,
              gasEstimate: opportunityData.gasEstimate,
              dexPath: opportunityData.dexPath || [],
              status: opportunityData.status || 'DETECTED',
              expiresAt: opportunityData.expiresAt
            }
          });

          return { success: true, opportunity };
        } catch (error) {
          return { success: false, error: error.message };
        }
      },

      async getArbitrageOpportunities(filters = {}) {
        const where = {};
        
        if (filters.configId) where.configId = filters.configId;
        if (filters.status) where.status = filters.status;
        if (filters.blockchainFrom) where.blockchainFrom = filters.blockchainFrom;

        return await this.prisma.arbitrageOpportunity.findMany({
          where,
          include: {
            config: true
          },
          orderBy: { detectedAt: 'desc' }
        });
      }
    };

    return mockApp;
  }

  async teardown() {
    if (this.prisma) {
      await this.prisma.$disconnect();
    }
  }

  async cleanDatabase() {
    if (this.prisma) {
      // Limpiar datos en orden para respetar foreign keys
      await this.prisma.arbitrageExecution.deleteMany();
      await this.prisma.arbitrageOpportunity.deleteMany();
      await this.prisma.arbitrageConfig.deleteMany();
      await this.prisma.apiKey.deleteMany();
      await this.prisma.user.deleteMany();
      await this.prisma.subscription.deleteMany();
      await this.prisma.tenant.deleteMany();
    }
  }

  async createTestTenant(data = {}) {
    return await this.prisma.tenant.create({
      data: {
        name: data.name || 'Integration Test Tenant',
        slug: data.slug || 'integration-test',
        status: data.status || 'ACTIVE',
        ...data
      }
    });
  }

  async createTestUser(tenantId, data = {}) {
    return await this.prisma.user.create({
      data: {
        tenantId,
        email: data.email || 'test@integration.com',
        firstName: data.firstName || 'Test',
        lastName: data.lastName || 'User',
        passwordHash: data.passwordHash || 'mock-hash',
        role: data.role || 'USER',
        status: data.status || 'ACTIVE',
        ...data
      }
    });
  }
}

module.exports = { TestAppHelper };
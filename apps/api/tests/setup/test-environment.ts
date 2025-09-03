/**
 * ArbitrageX Pro 2025 - Test Environment Configuration
 * Configuración de entornos específicos para diferentes tipos de testing
 * Hector Fabio Riascos C. - Ingenio Pichichi S.A.
 */

import { PrismaClient } from '@prisma/client';

export type TestEnvironment = 'unit' | 'integration' | 'e2e';

export interface TestConfig {
  environment: TestEnvironment;
  database: {
    url: string;
    resetBetweenTests: boolean;
  };
  mocks: {
    blockchain: boolean;
    redis: boolean;
    stripe: boolean;
    notifications: boolean;
  };
  timeouts: {
    test: number;
    setup: number;
    teardown: number;
  };
}

/**
 * Configuraciones por tipo de test
 */
export const testConfigs: Record<TestEnvironment, TestConfig> = {
  // Tests unitarios - Rápidos, aislados, con muchos mocks
  unit: {
    environment: 'unit',
    database: {
      url: 'postgresql://arbitragex:password@localhost:5432/arbitragex_test',
      resetBetweenTests: false // Unit tests no deberían tocar DB
    },
    mocks: {
      blockchain: true,    // Mock blockchain connectors
      redis: true,         // Mock Redis
      stripe: true,        // Mock Stripe
      notifications: true  // Mock notifications
    },
    timeouts: {
      test: 5000,          // 5 segundos max por test
      setup: 2000,
      teardown: 1000
    }
  },

  // Tests de integración - Servicios reales, DB real, algunos mocks
  integration: {
    environment: 'integration',
    database: {
      url: 'postgresql://arbitragex:password@localhost:5432/arbitragex_test',
      resetBetweenTests: true // Limpiar DB entre tests
    },
    mocks: {
      blockchain: true,    // Mock blockchain para velocidad
      redis: false,        // Redis real si está disponible
      stripe: true,        // Mock Stripe
      notifications: true  // Mock notifications
    },
    timeouts: {
      test: 15000,         // 15 segundos max por test
      setup: 5000,
      teardown: 3000
    }
  },

  // Tests E2E - Todo real, simulación completa
  e2e: {
    environment: 'e2e',
    database: {
      url: 'postgresql://arbitragex:password@localhost:5432/arbitragex_test',
      resetBetweenTests: true // Limpiar DB entre tests
    },
    mocks: {
      blockchain: false,   // Usar testnets reales
      redis: false,        // Redis real
      stripe: true,        // Mock Stripe (no queremos pagos reales)
      notifications: true  // Mock notifications
    },
    timeouts: {
      test: 60000,         // 1 minuto max por test E2E
      setup: 10000,
      teardown: 5000
    }
  }
};

/**
 * Configurar entorno de testing según el tipo
 */
export class TestEnvironmentManager {
  private config: TestConfig;
  private prisma: PrismaClient | null = null;

  constructor(environment: TestEnvironment) {
    this.config = testConfigs[environment];
  }

  async setup(): Promise<void> {
    console.log(`🧪 Setting up ${this.config.environment} test environment`);

    // Configurar timeouts
    jest.setTimeout(this.config.timeouts.test);

    // Configurar base de datos si es necesario
    if (this.shouldUseDatbase()) {
      await this.setupDatabase();
    }

    // Configurar mocks
    await this.setupMocks();
  }

  async teardown(): Promise<void> {
    console.log(`🧪 Tearing down ${this.config.environment} test environment`);

    if (this.prisma) {
      await this.prisma.$disconnect();
      this.prisma = null;
    }
  }

  private shouldUseDatbase(): boolean {
    return this.config.environment !== 'unit';
  }

  private async setupDatabase(): Promise<void> {
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: this.config.database.url
        }
      },
      log: []
    });

    await this.prisma.$connect();

    // Ejecutar migraciones en la base de datos de testing
    if (this.config.environment === 'integration' || this.config.environment === 'e2e') {
      // Aquí podrías ejecutar migraciones específicas para testing
      console.log('📊 Database ready for testing');
    }
  }

  private async setupMocks(): Promise<void> {
    const { mocks } = this.config;

    // Mock blockchain connectors
    if (mocks.blockchain) {
      jest.doMock('@arbitragex/blockchain-connectors', () => ({
        EthereumConnector: jest.fn().mockImplementation(() => ({
          getBalance: jest.fn().mockResolvedValue('1000000000000000000'),
          getGasPrice: jest.fn().mockResolvedValue('20000000000'),
          executeArbitrage: jest.fn().mockResolvedValue({
            success: true,
            txHash: '0x1234567890abcdef',
            gasUsed: '150000'
          })
        })),
        BSCConnector: jest.fn().mockImplementation(() => ({
          getBalance: jest.fn().mockResolvedValue('2000000000000000000'),
          getGasPrice: jest.fn().mockResolvedValue('5000000000')
        }))
      }));
    }

    // Mock Redis
    if (mocks.redis) {
      jest.doMock('ioredis', () => {
        return jest.fn().mockImplementation(() => ({
          get: jest.fn().mockResolvedValue(null),
          set: jest.fn().mockResolvedValue('OK'),
          del: jest.fn().mockResolvedValue(1),
          exists: jest.fn().mockResolvedValue(0)
        }));
      });
    }

    // Mock Stripe
    if (mocks.stripe) {
      jest.doMock('stripe', () => ({
        customers: {
          create: jest.fn().mockResolvedValue({ id: 'cus_test_customer' }),
          retrieve: jest.fn().mockResolvedValue({ id: 'cus_test_customer' })
        },
        subscriptions: {
          create: jest.fn().mockResolvedValue({ id: 'sub_test_subscription' })
        }
      }));
    }

    // Mock notifications
    if (mocks.notifications) {
      jest.doMock('@/services/notification.service', () => ({
        NotificationService: jest.fn().mockImplementation(() => ({
          send: jest.fn().mockResolvedValue(true),
          sendEmail: jest.fn().mockResolvedValue(true),
          sendWebhook: jest.fn().mockResolvedValue(true)
        }))
      }));
    }
  }

  async cleanDatabase(): Promise<void> {
    if (!this.prisma || !this.config.database.resetBetweenTests) {
      return;
    }

    // Limpiar en orden para respetar foreign keys
    await this.prisma.arbitrageExecution.deleteMany();
    await this.prisma.arbitrageOpportunity.deleteMany();
    await this.prisma.arbitrageConfig.deleteMany();
    await this.prisma.apiKey.deleteMany();
    await this.prisma.user.deleteMany();
    await this.prisma.subscription.deleteMany();
    await this.prisma.tenant.deleteMany();
  }

  getPrisma(): PrismaClient | null {
    return this.prisma;
  }
}

// Helpers para cada tipo de test
export const createUnitTestEnvironment = () => new TestEnvironmentManager('unit');
export const createIntegrationTestEnvironment = () => new TestEnvironmentManager('integration');
export const createE2ETestEnvironment = () => new TestEnvironmentManager('e2e');
/**
 * ArbitrageX Pro 2025 - Authentication Integration Tests
 * Tests de integración para endpoints de autenticación
 * Hector Fabio Riascos C. - Ingenio Pichichi S.A.
 */

const { TestAppHelper } = require('./helpers/app-helper');

describe('Authentication Integration Tests', () => {
  let testApp;
  let appHelper;
  let testTenant;

  beforeAll(async () => {
    appHelper = new TestAppHelper();
    testApp = await appHelper.setup();

    // Crear tenant de prueba
    testTenant = await appHelper.createTestTenant({
      name: 'Auth Test Company',
      slug: 'auth-test'
    });
  });

  afterAll(async () => {
    await appHelper.teardown();
  });

  beforeEach(async () => {
    await appHelper.cleanDatabase();
    
    // Recrear tenant después de limpiar
    testTenant = await appHelper.createTestTenant({
      name: 'Auth Test Company',
      slug: 'auth-test'
    });
  });

  describe('POST /login', () => {
    test('should authenticate user with valid credentials', async () => {
      // Crear usuario de prueba
      const testUser = await appHelper.createTestUser(testTenant.id, {
        email: 'user@auth-test.com',
        firstName: 'Auth',
        lastName: 'User'
      });

      // Intentar login
      const result = await testApp.authenticate(
        'user@auth-test.com',
        'validpassword',
        'auth-test'
      );

      expect(result.success).toBe(true);
      expect(result.user).toMatchObject({
        id: testUser.id,
        email: 'user@auth-test.com',
        firstName: 'Auth',
        lastName: 'User',
        role: 'USER',
        tenantId: testTenant.id
      });
      expect(result.token).toBe('mock-jwt-token');
    });

    test('should reject invalid credentials', async () => {
      // Crear usuario de prueba
      await appHelper.createTestUser(testTenant.id, {
        email: 'user@auth-test.com'
      });

      // Intentar login con password incorrecto
      const result = await testApp.authenticate(
        'user@auth-test.com',
        'wrong',
        'auth-test'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid password');
    });

    test('should reject non-existent user', async () => {
      const result = await testApp.authenticate(
        'nonexistent@auth-test.com',
        'password',
        'auth-test'
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('User not found');
    });

    test('should handle different tenant contexts', async () => {
      // Crear otro tenant
      const otherTenant = await appHelper.createTestTenant({
        name: 'Other Company',
        slug: 'other-test'
      });

      // Crear usuario en el otro tenant
      await appHelper.createTestUser(otherTenant.id, {
        email: 'user@other-test.com'
      });

      // Intentar login con tenant incorrecto
      const result = await testApp.authenticate(
        'user@other-test.com',
        'password',
        'auth-test' // tenant incorrecto
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('User not found');
    });
  });

  describe('POST /register', () => {
    test('should register new user successfully', async () => {
      const userData = {
        email: 'newuser@auth-test.com',
        firstName: 'New',
        lastName: 'User',
        tenantSlug: 'auth-test'
      };

      const result = await testApp.createUser(userData);

      expect(result.success).toBe(true);
      expect(result.user).toMatchObject({
        email: 'newuser@auth-test.com',
        firstName: 'New',
        lastName: 'User',
        tenantId: testTenant.id,
        role: 'USER',
        status: 'ACTIVE'
      });

      // Verificar que el usuario existe en la base de datos
      const userInDb = await testApp.prisma.user.findUnique({
        where: { email: 'newuser@auth-test.com' }
      });

      expect(userInDb).toBeTruthy();
      expect(userInDb.firstName).toBe('New');
      expect(userInDb.lastName).toBe('User');
    });

    test('should reject duplicate email registration', async () => {
      // Crear primer usuario
      await appHelper.createTestUser(testTenant.id, {
        email: 'duplicate@auth-test.com'
      });

      // Intentar registrar usuario con el mismo email
      const userData = {
        email: 'duplicate@auth-test.com',
        firstName: 'Duplicate',
        lastName: 'User',
        tenantSlug: 'auth-test'
      };

      const result = await testApp.createUser(userData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unique constraint');
    });

    test('should reject registration for non-existent tenant', async () => {
      const userData = {
        email: 'user@nonexistent.com',
        firstName: 'Test',
        lastName: 'User',
        tenantSlug: 'nonexistent'
      };

      const result = await testApp.createUser(userData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Tenant not found');
    });

    test('should handle admin user registration', async () => {
      const userData = {
        email: 'admin@auth-test.com',
        firstName: 'Admin',
        lastName: 'User',
        tenantSlug: 'auth-test',
        role: 'ADMIN'
      };

      const result = await testApp.createUser(userData);

      expect(result.success).toBe(true);
      expect(result.user.role).toBe('ADMIN');
    });
  });

  describe('Tenant Operations', () => {
    test('should retrieve tenant with users', async () => {
      // Crear usuarios en el tenant
      await appHelper.createTestUser(testTenant.id, {
        email: 'user1@auth-test.com',
        firstName: 'User',
        lastName: 'One'
      });

      await appHelper.createTestUser(testTenant.id, {
        email: 'user2@auth-test.com',
        firstName: 'User',
        lastName: 'Two'
      });

      const tenant = await testApp.getTenantBySlug('auth-test');

      expect(tenant).toBeTruthy();
      expect(tenant.name).toBe('Auth Test Company');
      expect(tenant.users).toHaveLength(2);
      expect(tenant.users.map(u => u.email)).toContain('user1@auth-test.com');
      expect(tenant.users.map(u => u.email)).toContain('user2@auth-test.com');
    });

    test('should return null for non-existent tenant', async () => {
      const tenant = await testApp.getTenantBySlug('nonexistent');
      expect(tenant).toBeNull();
    });

    test('should include arbitrage configs in tenant data', async () => {
      // Crear configuración de arbitraje
      await testApp.createArbitrageConfig({
        tenantId: testTenant.id,
        name: 'Test Strategy',
        strategies: ['triangular'],
        blockchains: ['ethereum'],
        riskSettings: { maxSlippage: 0.005 },
        minProfitThreshold: 0.02,
        maxPositionSize: '1000000000000000000'
      });

      const tenant = await testApp.getTenantBySlug('auth-test');

      expect(tenant.arbitrageConfigs).toHaveLength(1);
      expect(tenant.arbitrageConfigs[0].name).toBe('Test Strategy');
    });
  });

  describe('User Roles and Permissions', () => {
    test('should create users with different roles', async () => {
      const roles = ['USER', 'ADMIN', 'VIEWER'];
      
      for (let i = 0; i < roles.length; i++) {
        const role = roles[i];
        const user = await appHelper.createTestUser(testTenant.id, {
          email: `${role.toLowerCase()}@auth-test.com`,
          firstName: role,
          lastName: 'User',
          role
        });

        expect(user.role).toBe(role);
      }

      // Verificar todos los usuarios creados
      const tenant = await testApp.getTenantBySlug('auth-test');
      expect(tenant.users).toHaveLength(3);
      
      const userRoles = tenant.users.map(u => u.role);
      expect(userRoles).toContain('USER');
      expect(userRoles).toContain('ADMIN');
      expect(userRoles).toContain('VIEWER');
    });

    test('should handle user status changes', async () => {
      const user = await appHelper.createTestUser(testTenant.id, {
        email: 'status@auth-test.com',
        status: 'PENDING_VERIFICATION'
      });

      expect(user.status).toBe('PENDING_VERIFICATION');

      // Simular cambio de status
      const updatedUser = await testApp.prisma.user.update({
        where: { id: user.id },
        data: { status: 'ACTIVE' }
      });

      expect(updatedUser.status).toBe('ACTIVE');
    });
  });

  describe('Database Integrity', () => {
    test('should maintain referential integrity', async () => {
      const user = await appHelper.createTestUser(testTenant.id, {
        email: 'integrity@auth-test.com'
      });

      // Crear configuración vinculada al tenant
      const configResult = await testApp.createArbitrageConfig({
        tenantId: testTenant.id,
        name: 'Integrity Test',
        strategies: ['cross_chain'],
        blockchains: ['ethereum', 'bsc'],
        riskSettings: { maxSlippage: 0.01 },
        minProfitThreshold: 0.015,
        maxPositionSize: '2000000000000000000'
      });

      expect(configResult.success).toBe(true);

      // Verificar relaciones
      const tenantWithData = await testApp.getTenantBySlug('auth-test');
      expect(tenantWithData.users).toHaveLength(1);
      expect(tenantWithData.arbitrageConfigs).toHaveLength(1);
      expect(tenantWithData.users[0].tenantId).toBe(testTenant.id);
      expect(tenantWithData.arbitrageConfigs[0].tenantId).toBe(testTenant.id);
    });

    test('should handle cascade deletes properly', async () => {
      const user = await appHelper.createTestUser(testTenant.id, {
        email: 'cascade@auth-test.com'
      });

      // Verificar usuario creado
      const userExists = await testApp.prisma.user.findUnique({
        where: { id: user.id }
      });
      expect(userExists).toBeTruthy();

      // Eliminar tenant (debería eliminar usuarios por cascade)
      await testApp.prisma.tenant.delete({
        where: { id: testTenant.id }
      });

      // Verificar que usuario fue eliminado por cascade
      const userAfterDelete = await testApp.prisma.user.findUnique({
        where: { id: user.id }
      });
      expect(userAfterDelete).toBeNull();
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle multiple concurrent user creations', async () => {
      const promises = [];
      
      for (let i = 0; i < 10; i++) {
        promises.push(
          appHelper.createTestUser(testTenant.id, {
            email: `concurrent${i}@auth-test.com`,
            firstName: 'Concurrent',
            lastName: `User${i}`
          })
        );
      }

      const users = await Promise.all(promises);
      
      // Todos los usuarios deben haber sido creados
      expect(users).toHaveLength(10);
      users.forEach((user, index) => {
        expect(user.email).toBe(`concurrent${index}@auth-test.com`);
        expect(user.tenantId).toBe(testTenant.id);
      });

      // Verificar en base de datos
      const tenant = await testApp.getTenantBySlug('auth-test');
      expect(tenant.users).toHaveLength(10);
    });

    test('should handle large tenant queries efficiently', async () => {
      // Crear muchos usuarios
      for (let i = 0; i < 50; i++) {
        await appHelper.createTestUser(testTenant.id, {
          email: `bulk${i}@auth-test.com`
        });
      }

      const startTime = Date.now();
      const tenant = await testApp.getTenantBySlug('auth-test');
      const queryTime = Date.now() - startTime;

      expect(tenant.users).toHaveLength(50);
      expect(queryTime).toBeLessThan(1000); // Debe ser rápido (< 1 segundo)
    });
  });
});
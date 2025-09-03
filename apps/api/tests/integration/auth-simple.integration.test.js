/**
 * Integration Tests - Authentication API (Versión Simplificada)
 * ArbitrageX Supreme Enterprise - Ingenio Pichichi S.A.
 * 
 * Tests metodológicos y organizados siguiendo las mejores prácticas
 */

const { SimpleTestAppHelper } = require('./helpers/simple-app-helper');

describe('🔐 Authentication Integration Tests (Simple)', () => {
  let testApp;
  let startTime;

  // Setup antes de todos los tests
  beforeAll(async () => {
    testApp = new SimpleTestAppHelper();
    await testApp.setup();
    console.log('✅ Test environment initialized successfully');
  });

  // Cleanup después de todos los tests
  afterAll(async () => {
    if (testApp) {
      await testApp.cleanup();
      console.log('🧹 Test environment cleaned up');
    }
  });

  // Reset antes de cada test
  beforeEach(async () => {
    startTime = Date.now();
  });

  afterEach(() => {
    const duration = Date.now() - startTime;
    console.log(`⏱️ Test completed in ${duration}ms`);
  });

  describe('👤 User Authentication', () => {
    test('should authenticate user with valid credentials', async () => {
      // Arrange
      const email = 'user@test.com';
      const password = 'user123';
      const tenant = 'test-tenant';

      // Act
      const result = await testApp.authenticate(email, password, tenant);

      // Assert
      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user.email).toBe(email);
      expect(result.user.role).toBe('user');
      expect(result.token).toBeDefined();
      expect(result.tenant).toBeDefined();
      expect(result.tenant.name).toBe(tenant);
    });

    test('should reject authentication with invalid email', async () => {
      // Arrange
      const email = 'nonexistent@test.com';
      const password = 'validpassword';
      const tenant = 'test-tenant';

      // Act
      const result = await testApp.authenticate(email, password, tenant);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
    });

    test('should reject authentication with invalid password', async () => {
      // Arrange
      const email = 'user@test.com';
      const password = 'wrongpassword';
      const tenant = 'test-tenant';

      // Act
      const result = await testApp.authenticate(email, password, tenant);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid password');
    });

    test('should reject authentication with invalid tenant', async () => {
      // Arrange
      const email = 'user@test.com';
      const password = 'user123';
      const tenant = 'nonexistent-tenant';

      // Act
      const result = await testApp.authenticate(email, password, tenant);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
    });

    test('should authenticate admin user with elevated privileges', async () => {
      // Arrange
      const email = 'admin@test.com';
      const password = 'admin123';
      const tenant = 'test-tenant';

      // Act
      const result = await testApp.authenticate(email, password, tenant);

      // Assert
      expect(result.success).toBe(true);
      expect(result.user.role).toBe('admin');
      expect(result.user.email).toBe(email);
      expect(result.token).toBeDefined();
    });
  });

  describe('📝 User Registration', () => {
    test('should register new user successfully', async () => {
      // Arrange
      const userData = {
        email: 'newuser@test.com',
        name: 'New Test User',
        password: 'newuser123',
        role: 'user'
      };
      const tenant = 'test-tenant';

      // Act
      const result = await testApp.register(userData, tenant);

      // Assert
      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user.email).toBe(userData.email);
      expect(result.user.name).toBe(userData.name);
      expect(result.user.role).toBe('user');
      expect(result.user.tenantId).toBeDefined();
    });

    test('should reject registration with existing email', async () => {
      // Arrange
      const userData = {
        email: 'user@test.com', // Email ya existente
        name: 'Duplicate User',
        password: 'password123'
      };
      const tenant = 'test-tenant';

      // Act
      const result = await testApp.register(userData, tenant);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Email already exists');
    });

    test('should reject registration with invalid tenant', async () => {
      // Arrange
      const userData = {
        email: 'user@invalid.com',
        name: 'Invalid Tenant User',
        password: 'password123'
      };
      const tenant = 'invalid-tenant';

      // Act
      const result = await testApp.register(userData, tenant);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid tenant');
    });

    test('should register user with default role if not specified', async () => {
      // Arrange
      const userData = {
        email: 'defaultrole@test.com',
        name: 'Default Role User',
        password: 'password123'
        // Sin especificar role
      };
      const tenant = 'test-tenant';

      // Act
      const result = await testApp.register(userData, tenant);

      // Assert
      expect(result.success).toBe(true);
      expect(result.user.role).toBe('user'); // Role por defecto
    });
  });

  describe('🏢 Tenant Management', () => {
    test('should create new tenant successfully', async () => {
      // Arrange
      const tenantData = {
        name: 'new-test-tenant',
        domain: 'new-test.arbitragex.com',
        status: 'active',
        settings: {
          maxUsers: 100,
          features: ['trading', 'analytics']
        }
      };

      // Act
      const result = await testApp.createTenant(tenantData);

      // Assert
      expect(result.success).toBe(true);
      expect(result.tenant).toBeDefined();
      expect(result.tenant.name).toBe(tenantData.name);
      expect(result.tenant.domain).toBe(tenantData.domain);
      expect(result.tenant.status).toBe('active');
    });

    test('should reject creation of duplicate tenant', async () => {
      // Arrange
      const tenantData = {
        name: 'test-tenant', // Tenant ya existente
        domain: 'duplicate.arbitragex.com'
      };

      // Act
      const result = await testApp.createTenant(tenantData);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe('Tenant already exists');
    });
  });

  describe('🎫 Token Management', () => {
    test('should validate valid authentication token', async () => {
      // Arrange - Primero autenticar para obtener token
      const authResult = await testApp.authenticate('user@test.com', 'user123', 'test-tenant');
      expect(authResult.success).toBe(true);
      const token = authResult.token;

      // Act
      const result = await testApp.validateToken(token);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user.email).toBe('user@test.com');
    });

    test('should reject invalid authentication token', async () => {
      // Arrange
      const invalidToken = 'invalid_token_12345';

      // Act
      const result = await testApp.validateToken(invalidToken);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid or expired token');
    });

    test('should logout user successfully', async () => {
      // Arrange - Primero autenticar
      const authResult = await testApp.authenticate('user@test.com', 'user123', 'test-tenant');
      expect(authResult.success).toBe(true);
      const token = authResult.token;

      // Act
      const logoutResult = await testApp.logout(token);

      // Assert
      expect(logoutResult.success).toBe(true);

      // Verificar que el token ya no es válido después del logout
      const validationResult = await testApp.validateToken(token);
      expect(validationResult.valid).toBe(false);
    });
  });

  describe('📊 Database Integrity', () => {
    test('should maintain data consistency after multiple operations', async () => {
      // Arrange
      const initialMetrics = await testApp.getDatabaseMetrics();

      // Act - Realizar múltiples operaciones
      const newUser = await testApp.register({
        email: 'consistency@test.com',
        name: 'Consistency User',
        password: 'password123'
      }, 'test-tenant');

      const authResult = await testApp.authenticate('consistency@test.com', 'password123', 'test-tenant');

      // Assert
      expect(newUser.success).toBe(true);
      expect(authResult.success).toBe(true);

      const finalMetrics = await testApp.getDatabaseMetrics();
      expect(finalMetrics.users).toBe(initialMetrics.users + 1);
      expect(finalMetrics.sessions).toBe(initialMetrics.sessions + 1);
    });

    test('should handle concurrent authentication attempts', async () => {
      // Arrange
      const promises = [];
      const userEmail = 'user@test.com';
      const password = 'user123';
      const tenant = 'test-tenant';

      // Act - Múltiples intentos concurrentes
      for (let i = 0; i < 5; i++) {
        promises.push(testApp.authenticate(userEmail, password, tenant));
      }

      const results = await Promise.all(promises);

      // Assert - Todos deberían tener éxito
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.user.email).toBe(userEmail);
        expect(result.token).toBeDefined();
      });

      // Verificar que se crearon sesiones únicas
      const tokens = results.map(r => r.token);
      const uniqueTokens = new Set(tokens);
      expect(uniqueTokens.size).toBe(5); // Todos los tokens deben ser únicos
    });
  });

  describe('⚡ Performance Tests', () => {
    test('should authenticate user within performance threshold (< 100ms)', async () => {
      // Arrange
      const startTime = Date.now();

      // Act
      const result = await testApp.authenticate('user@test.com', 'user123', 'test-tenant');
      const duration = Date.now() - startTime;

      // Assert
      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(100);
    });

    test('should register user within performance threshold (< 150ms)', async () => {
      // Arrange
      const userData = {
        email: `performance${Date.now()}@test.com`,
        name: 'Performance User',
        password: 'password123'
      };
      const startTime = Date.now();

      // Act
      const result = await testApp.register(userData, 'test-tenant');
      const duration = Date.now() - startTime;

      // Assert
      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(150);
    });
  });

  describe('🛡️ Security Scenarios', () => {
    test('should handle SQL injection attempts safely', async () => {
      // Arrange - Intentos de inyección SQL
      const maliciousEmail = "user@test.com'; DROP TABLE users; --";
      const password = 'user123';

      // Act
      const result = await testApp.authenticate(maliciousEmail, password, 'test-tenant');

      // Assert - Debe fallar de forma segura
      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');

      // Verificar que los datos siguen intactos
      const metrics = await testApp.getDatabaseMetrics();
      expect(metrics.users).toBeGreaterThan(0);
    });

    test('should handle password brute force attempts', async () => {
      // Arrange
      const email = 'user@test.com';
      const wrongPasswords = ['wrong1', 'wrong2', 'wrong3', 'wrong4', 'wrong5'];
      const results = [];

      // Act - Múltiples intentos con passwords incorrectos
      for (const password of wrongPasswords) {
        const result = await testApp.authenticate(email, password, 'test-tenant');
        results.push(result);
      }

      // Assert - Todos deben fallar
      results.forEach(result => {
        expect(result.success).toBe(false);
        expect(result.error).toBe('Invalid password');
      });
    });
  });
});

// Exportar para uso en otros archivos de test
module.exports = {
  SimpleTestAppHelper: require('./helpers/simple-app-helper').SimpleTestAppHelper
};
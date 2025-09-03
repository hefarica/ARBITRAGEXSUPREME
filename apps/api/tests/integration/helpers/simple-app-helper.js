/**
 * TestAppHelper Simplificado - ArbitrageX Supreme
 * Versión sin dependencias de Prisma para tests de integración básicos
 */

// Mock simplificado para simulación de base de datos
class SimpleDatabaseMock {
  constructor() {
    this.users = new Map();
    this.tenants = new Map();
    this.sessions = new Map();
    this.nextUserId = 1;
    this.nextTenantId = 1;
  }

  // Usuarios
  async createUser(userData) {
    const user = {
      id: this.nextUserId++,
      email: userData.email,
      name: userData.name,
      password: userData.password, // En producción debe estar hasheado
      tenantId: userData.tenantId,
      role: userData.role || 'user',
      status: userData.status || 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.users.set(user.email, user);
    return user;
  }

  async findUserByEmail(email) {
    return this.users.get(email) || null;
  }

  async findUserById(id) {
    for (const user of this.users.values()) {
      if (user.id === id) return user;
    }
    return null;
  }

  async updateUser(email, updates) {
    const user = this.users.get(email);
    if (!user) return null;
    
    Object.assign(user, updates, { updatedAt: new Date() });
    return user;
  }

  async deleteUser(email) {
    return this.users.delete(email);
  }

  // Tenants
  async createTenant(tenantData) {
    const tenant = {
      id: this.nextTenantId++,
      name: tenantData.name,
      domain: tenantData.domain,
      status: tenantData.status || 'active',
      settings: tenantData.settings || {},
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    this.tenants.set(tenant.name, tenant);
    return tenant;
  }

  async findTenantByName(name) {
    return this.tenants.get(name) || null;
  }

  // Sesiones
  async createSession(sessionData) {
    const session = {
      id: `session_${Date.now()}_${Math.random()}`,
      userId: sessionData.userId,
      token: sessionData.token || `token_${Date.now()}`,
      expiresAt: sessionData.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000),
      createdAt: new Date()
    };
    
    this.sessions.set(session.token, session);
    return session;
  }

  async findSessionByToken(token) {
    return this.sessions.get(token) || null;
  }

  async deleteSession(token) {
    return this.sessions.delete(token);
  }

  // Utilidades
  async clearAllData() {
    this.users.clear();
    this.tenants.clear();
    this.sessions.clear();
    this.nextUserId = 1;
    this.nextTenantId = 1;
  }

  async getUserCount() {
    return this.users.size;
  }

  async getTenantCount() {
    return this.tenants.size;
  }
}

// Helper para testing de aplicación sin Fastify completo
class SimpleTestAppHelper {
  constructor() {
    this.db = new SimpleDatabaseMock();
    this.isSetup = false;
  }

  async setup() {
    if (this.isSetup) return;
    
    // Crear tenant por defecto para tests
    await this.db.createTenant({
      name: 'test-tenant',
      domain: 'test.arbitragex.com',
      status: 'active'
    });

    // Crear usuario administrador por defecto
    await this.db.createUser({
      email: 'admin@test.com',
      name: 'Test Admin',
      password: 'admin123',
      tenantId: 1,
      role: 'admin',
      status: 'active'
    });

    // Crear usuario regular por defecto
    await this.db.createUser({
      email: 'user@test.com',
      name: 'Test User',
      password: 'user123',
      tenantId: 1,
      role: 'user',
      status: 'active'
    });

    this.isSetup = true;
  }

  async cleanup() {
    await this.db.clearAllData();
    this.isSetup = false;
  }

  // Simulación de autenticación
  async authenticate(email, password, tenant) {
    const user = await this.db.findUserByEmail(email);
    const tenantObj = await this.db.findTenantByName(tenant);

    if (!user || !tenantObj) {
      return { success: false, error: 'Invalid credentials' };
    }

    // Validación simple de password (en producción sería bcrypt)
    if (user.password !== password) {
      return { success: false, error: 'Invalid password' };
    }

    if (user.status !== 'active') {
      return { success: false, error: 'Account inactive' };
    }

    // Crear sesión
    const session = await this.db.createSession({
      userId: user.id,
      token: `jwt_${Date.now()}_${user.id}`
    });

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId
      },
      token: session.token,
      tenant: {
        id: tenantObj.id,
        name: tenantObj.name,
        domain: tenantObj.domain
      }
    };
  }

  // Simulación de registro
  async register(userData, tenant) {
    const existingUser = await this.db.findUserByEmail(userData.email);
    if (existingUser) {
      return { success: false, error: 'Email already exists' };
    }

    const tenantObj = await this.db.findTenantByName(tenant);
    if (!tenantObj) {
      return { success: false, error: 'Invalid tenant' };
    }

    const user = await this.db.createUser({
      email: userData.email,
      name: userData.name,
      password: userData.password,
      tenantId: tenantObj.id,
      role: userData.role || 'user'
    });

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId
      }
    };
  }

  // Simulación de gestión de tenants
  async createTenant(tenantData) {
    const existingTenant = await this.db.findTenantByName(tenantData.name);
    if (existingTenant) {
      return { success: false, error: 'Tenant already exists' };
    }

    const tenant = await this.db.createTenant(tenantData);
    return { success: true, tenant };
  }

  // Validación de token
  async validateToken(token) {
    const session = await this.db.findSessionByToken(token);
    if (!session || session.expiresAt < new Date()) {
      return { valid: false, error: 'Invalid or expired token' };
    }

    const user = await this.db.findUserById(session.userId);
    return {
      valid: true,
      user: user ? {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenantId
      } : null
    };
  }

  // Métricas simples
  async getDatabaseMetrics() {
    return {
      users: await this.db.getUserCount(),
      tenants: await this.db.getTenantCount(),
      sessions: this.db.sessions.size
    };
  }

  // Simulación de logout
  async logout(token) {
    const deleted = await this.db.deleteSession(token);
    return { success: deleted };
  }
}

module.exports = {
  SimpleTestAppHelper,
  SimpleDatabaseMock
};
/**
 * Billing Integration Test Runner - ArbitrageX Supreme
 * Metodología del Ingenio Pichichi S.A.
 */

const { SimpleTestAppHelper } = require('./helpers/simple-app-helper');

// Mock para servicios de facturación
class BillingServiceMock {
  constructor() {
    this.plans = new Map();
    this.subscriptions = new Map();
    this.invoices = new Map();
    this.payments = new Map();
    this.customers = new Map();
    this.nextInvoiceId = 1;
    this.nextPaymentId = 1;
    this.isInitialized = false;
  }

  async initialize() {
    this.isInitialized = true;
    
    // Crear planes de suscripción predefinidos
    const defaultPlans = [
      {
        id: 'basic',
        name: 'ArbitrageX Basic',
        price: 29.99,
        currency: 'USD',
        interval: 'monthly',
        features: ['basic_arbitrage', 'email_support'],
        limits: { trades_per_month: 100, api_calls_per_day: 1000 }
      },
      {
        id: 'pro',
        name: 'ArbitrageX Pro',
        price: 99.99,
        currency: 'USD',
        interval: 'monthly',
        features: ['advanced_arbitrage', 'priority_support', 'analytics'],
        limits: { trades_per_month: 1000, api_calls_per_day: 10000 }
      },
      {
        id: 'enterprise',
        name: 'ArbitrageX Enterprise',
        price: 299.99,
        currency: 'USD',
        interval: 'monthly',
        features: ['unlimited_arbitrage', 'dedicated_support', 'custom_analytics', 'api_access'],
        limits: { trades_per_month: 'unlimited', api_calls_per_day: 'unlimited' }
      }
    ];

    defaultPlans.forEach(plan => {
      this.plans.set(plan.id, plan);
    });

    return { success: true, plansCreated: defaultPlans.length };
  }

  async createCustomer(userId, customerData) {
    if (!this.isInitialized) {
      throw new Error('Billing service not initialized');
    }

    const customer = {
      id: `cust_${userId}_${Date.now()}`,
      userId: userId,
      email: customerData.email,
      name: customerData.name,
      address: customerData.address || {},
      paymentMethods: [],
      createdAt: new Date(),
      status: 'active'
    };

    this.customers.set(customer.id, customer);

    return {
      success: true,
      customer: {
        id: customer.id,
        email: customer.email,
        name: customer.name,
        status: customer.status,
        createdAt: customer.createdAt
      }
    };
  }

  async getPlans() {
    return {
      success: true,
      plans: Array.from(this.plans.values())
    };
  }

  async getPlan(planId) {
    const plan = this.plans.get(planId);
    if (!plan) {
      return { success: false, error: 'Plan not found' };
    }

    return { success: true, plan: plan };
  }

  async createSubscription(customerId, planId, paymentMethodId) {
    const customer = this.customers.get(customerId);
    if (!customer) {
      return { success: false, error: 'Customer not found' };
    }

    const plan = this.plans.get(planId);
    if (!plan) {
      return { success: false, error: 'Plan not found' };
    }

    const subscription = {
      id: `sub_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      customerId: customerId,
      planId: planId,
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días
      createdAt: new Date(),
      canceledAt: null,
      trialEnd: null,
      paymentMethodId: paymentMethodId
    };

    this.subscriptions.set(subscription.id, subscription);

    // Crear primera factura
    await this.createInvoice(subscription.id, plan.price);

    return {
      success: true,
      subscription: {
        id: subscription.id,
        planId: subscription.planId,
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        createdAt: subscription.createdAt
      }
    };
  }

  async createInvoice(subscriptionId, amount) {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return { success: false, error: 'Subscription not found' };
    }

    const invoice = {
      id: this.nextInvoiceId++,
      subscriptionId: subscriptionId,
      customerId: subscription.customerId,
      amount: amount,
      currency: 'USD',
      status: 'pending',
      createdAt: new Date(),
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días
      paidAt: null,
      items: [{
        description: `ArbitrageX Supreme - ${subscription.planId}`,
        amount: amount,
        quantity: 1
      }]
    };

    this.invoices.set(invoice.id, invoice);

    return {
      success: true,
      invoice: {
        id: invoice.id,
        amount: invoice.amount,
        currency: invoice.currency,
        status: invoice.status,
        dueDate: invoice.dueDate,
        createdAt: invoice.createdAt
      }
    };
  }

  async payInvoice(invoiceId, paymentMethodId) {
    const invoice = this.invoices.get(invoiceId);
    if (!invoice) {
      return { success: false, error: 'Invoice not found' };
    }

    if (invoice.status !== 'pending') {
      return { success: false, error: 'Invoice already processed' };
    }

    // Simular proceso de pago
    const payment = {
      id: this.nextPaymentId++,
      invoiceId: invoiceId,
      amount: invoice.amount,
      currency: invoice.currency,
      paymentMethodId: paymentMethodId,
      status: 'completed',
      createdAt: new Date(),
      fees: invoice.amount * 0.029 // 2.9% fee
    };

    this.payments.set(payment.id, payment);

    // Actualizar factura
    invoice.status = 'paid';
    invoice.paidAt = new Date();

    return {
      success: true,
      payment: {
        id: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        createdAt: payment.createdAt,
        fees: payment.fees
      }
    };
  }

  async getCustomerSubscriptions(customerId) {
    const subscriptions = Array.from(this.subscriptions.values())
      .filter(sub => sub.customerId === customerId);

    return {
      success: true,
      subscriptions: subscriptions,
      count: subscriptions.length
    };
  }

  async getCustomerInvoices(customerId, filters = {}) {
    let invoices = Array.from(this.invoices.values())
      .filter(invoice => invoice.customerId === customerId);

    if (filters.status) {
      invoices = invoices.filter(invoice => invoice.status === filters.status);
    }

    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom);
      invoices = invoices.filter(invoice => invoice.createdAt >= from);
    }

    return {
      success: true,
      invoices: invoices.sort((a, b) => b.createdAt - a.createdAt),
      count: invoices.length
    };
  }

  async cancelSubscription(subscriptionId, reason) {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      return { success: false, error: 'Subscription not found' };
    }

    if (subscription.status !== 'active') {
      return { success: false, error: 'Subscription not active' };
    }

    subscription.status = 'canceled';
    subscription.canceledAt = new Date();
    subscription.cancelReason = reason;

    return {
      success: true,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        canceledAt: subscription.canceledAt,
        cancelReason: subscription.cancelReason
      }
    };
  }

  async updatePaymentMethod(customerId, paymentMethodData) {
    const customer = this.customers.get(customerId);
    if (!customer) {
      return { success: false, error: 'Customer not found' };
    }

    const paymentMethod = {
      id: `pm_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      type: paymentMethodData.type,
      last4: paymentMethodData.last4 || '****',
      expiryMonth: paymentMethodData.expiryMonth,
      expiryYear: paymentMethodData.expiryYear,
      isDefault: paymentMethodData.isDefault || false,
      createdAt: new Date()
    };

    customer.paymentMethods.push(paymentMethod);

    return {
      success: true,
      paymentMethod: paymentMethod
    };
  }

  // Utilidades
  clearData() {
    this.plans.clear();
    this.subscriptions.clear();
    this.invoices.clear();
    this.payments.clear();
    this.customers.clear();
    this.nextInvoiceId = 1;
    this.nextPaymentId = 1;
    this.isInitialized = false;
  }

  getStats() {
    const activeSubscriptions = Array.from(this.subscriptions.values())
      .filter(sub => sub.status === 'active').length;
    const totalRevenue = Array.from(this.payments.values())
      .filter(payment => payment.status === 'completed')
      .reduce((sum, payment) => sum + payment.amount, 0);

    return {
      totalCustomers: this.customers.size,
      activeSubscriptions: activeSubscriptions,
      totalSubscriptions: this.subscriptions.size,
      totalInvoices: this.invoices.size,
      totalPayments: this.payments.size,
      totalRevenue: totalRevenue,
      averageRevenuePerUser: this.customers.size > 0 ? totalRevenue / this.customers.size : 0
    };
  }
}

// Helper extendido para billing
class BillingTestHelper extends SimpleTestAppHelper {
  constructor() {
    super();
    this.billingService = new BillingServiceMock();
  }

  async setup() {
    await super.setup();
    await this.billingService.initialize();
  }

  async cleanup() {
    await super.cleanup();
    this.billingService.clearData();
  }

  // API endpoints simulados
  async initializeBilling(userId) {
    const user = await this.db.findUserById(userId);
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    if (user.role !== 'admin') {
      return { success: false, error: 'Insufficient permissions' };
    }

    return await this.billingService.initialize();
  }

  async createCustomer(userId, customerData) {
    const user = await this.db.findUserById(userId);
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    return await this.billingService.createCustomer(userId, customerData);
  }

  async getPlans(userId) {
    const user = await this.db.findUserById(userId);
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    return await this.billingService.getPlans();
  }

  async createSubscription(userId, customerId, planId, paymentMethodId) {
    const user = await this.db.findUserById(userId);
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    return await this.billingService.createSubscription(customerId, planId, paymentMethodId);
  }

  async payInvoice(userId, invoiceId, paymentMethodId) {
    const user = await this.db.findUserById(userId);
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    return await this.billingService.payInvoice(invoiceId, paymentMethodId);
  }

  async getCustomerSubscriptions(userId, customerId) {
    const user = await this.db.findUserById(userId);
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    return await this.billingService.getCustomerSubscriptions(customerId);
  }

  async getCustomerInvoices(userId, customerId, filters) {
    const user = await this.db.findUserById(userId);
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    return await this.billingService.getCustomerInvoices(customerId, filters);
  }

  async cancelSubscription(userId, subscriptionId, reason) {
    const user = await this.db.findUserById(userId);
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    if (user.role !== 'admin' && user.role !== 'trader') {
      return { success: false, error: 'Insufficient permissions' };
    }

    return await this.billingService.cancelSubscription(subscriptionId, reason);
  }

  async updatePaymentMethod(userId, customerId, paymentMethodData) {
    const user = await this.db.findUserById(userId);
    if (!user) {
      return { success: false, error: 'User not authenticated' };
    }

    return await this.billingService.updatePaymentMethod(customerId, paymentMethodData);
  }

  // Crear usuario admin para tests
  async createAdminUser() {
    return await this.db.createUser({
      email: 'billing-admin@test.com',
      name: 'Billing Test Admin',
      password: 'admin123',
      tenantId: 1,
      role: 'admin',
      status: 'active'
    });
  }
}

// Framework de testing simple
class SimpleTestFramework {
  constructor() {
    this.passed = 0;
    this.failed = 0;
  }

  expect(actual) {
    return {
      toBe: (expected) => {
        if (actual !== expected) {
          throw new Error(`Expected ${expected}, but got ${actual}`);
        }
      },
      toBeDefined: () => {
        if (actual === undefined) {
          throw new Error(`Expected value to be defined, but got undefined`);
        }
      },
      toBeGreaterThan: (expected) => {
        if (actual <= expected) {
          throw new Error(`Expected ${actual} to be greater than ${expected}`);
        }
      },
      toBeLessThan: (expected) => {
        if (actual >= expected) {
          throw new Error(`Expected ${actual} to be less than ${expected}`);
        }
      }
    };
  }

  async runTest(name, testFn) {
    const testStartTime = Date.now();
    
    try {
      await testFn();
      const duration = Date.now() - testStartTime;
      this.passed++;
      console.log(`  ✅ ${name} (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - testStartTime;
      this.failed++;
      console.log(`  ❌ ${name} (${duration}ms)`);
      console.log(`     Error: ${error.message}`);
    }
  }

  printSummary(totalDuration) {
    console.log('\n' + '=' * 70);
    console.log('📊 BILLING TEST SUMMARY');
    console.log('=' * 70);
    console.log(`Total Tests: ${this.passed + this.failed}`);
    console.log(`✅ Passed: ${this.passed}`);
    console.log(`❌ Failed: ${this.failed}`);
    console.log(`⏱️ Total Time: ${totalDuration}ms`);
    
    if (this.failed === 0) {
      console.log('\n🎉 ALL BILLING TESTS PASSED! Sistema de facturación funcionando correctamente.');
    } else {
      console.log('\n⚠️ SOME BILLING TESTS FAILED. Revisar errores arriba.');
    }
  }
}

// Ejecutar tests de billing
async function runBillingTests() {
  console.log('💳 ArbitrageX Supreme - Billing Integration Tests');
  console.log('=' * 70);
  
  const testFramework = new SimpleTestFramework();
  const startTime = Date.now();
  
  // Setup
  const testApp = new BillingTestHelper();
  await testApp.setup();
  const adminUser = await testApp.createAdminUser();
  const regularUser = await testApp.db.findUserByEmail('user@test.com');
  console.log('✅ Billing test environment initialized');

  // Tests de Inicialización
  console.log('\n📋 🔧 Billing Initialization');
  
  await testFramework.runTest('should initialize billing service successfully', async () => {
    const result = await testApp.initializeBilling(adminUser.id);

    testFramework.expect(result.success).toBe(true);
    testFramework.expect(result.plansCreated).toBeGreaterThan(0);
  });

  await testFramework.runTest('should reject initialization from non-admin user', async () => {
    const result = await testApp.initializeBilling(regularUser.id);

    testFramework.expect(result.success).toBe(false);
  });

  // Tests de Gestión de Customers
  console.log('\n📋 👤 Customer Management');
  
  let testCustomer;
  
  await testFramework.runTest('should create customer successfully', async () => {
    const customerData = {
      email: regularUser.email,
      name: regularUser.name,
      address: {
        line1: '123 Test Street',
        city: 'Test City',
        country: 'US'
      }
    };

    const result = await testApp.createCustomer(regularUser.id, customerData);

    testFramework.expect(result.success).toBe(true);
    testFramework.expect(result.customer).toBeDefined();
    testFramework.expect(result.customer.email).toBe(customerData.email);
    testFramework.expect(result.customer.status).toBe('active');
    
    testCustomer = result.customer;
  });

  await testFramework.runTest('should reject customer creation from unauthenticated user', async () => {
    const invalidUserId = 99999;
    const customerData = { email: 'test@test.com', name: 'Test' };

    const result = await testApp.createCustomer(invalidUserId, customerData);

    testFramework.expect(result.success).toBe(false);
  });

  // Tests de Planes
  console.log('\n📋 📋 Subscription Plans');
  
  await testFramework.runTest('should get all available plans', async () => {
    const result = await testApp.getPlans(regularUser.id);

    testFramework.expect(result.success).toBe(true);
    testFramework.expect(result.plans).toBeDefined();
    testFramework.expect(result.plans.length).toBeGreaterThan(0);

    // Verificar que tiene los planes esperados
    const planIds = result.plans.map(plan => plan.id);
    testFramework.expect(planIds.includes('basic')).toBe(true);
    testFramework.expect(planIds.includes('pro')).toBe(true);
    testFramework.expect(planIds.includes('enterprise')).toBe(true);
  });

  await testFramework.runTest('should reject plans request from unauthenticated user', async () => {
    const invalidUserId = 99999;
    const result = await testApp.getPlans(invalidUserId);

    testFramework.expect(result.success).toBe(false);
  });

  // Tests de Métodos de Pago
  console.log('\n📋 💳 Payment Methods');
  
  let testPaymentMethod;
  
  await testFramework.runTest('should add payment method to customer', async () => {
    const paymentMethodData = {
      type: 'card',
      last4: '4242',
      expiryMonth: 12,
      expiryYear: 2025,
      isDefault: true
    };

    const result = await testApp.updatePaymentMethod(regularUser.id, testCustomer.id, paymentMethodData);

    testFramework.expect(result.success).toBe(true);
    testFramework.expect(result.paymentMethod).toBeDefined();
    testFramework.expect(result.paymentMethod.type).toBe('card');
    testFramework.expect(result.paymentMethod.last4).toBe('4242');
    
    testPaymentMethod = result.paymentMethod;
  });

  // Tests de Suscripciones
  console.log('\n📋 🔄 Subscriptions');
  
  let testSubscription;
  
  await testFramework.runTest('should create subscription successfully', async () => {
    const result = await testApp.createSubscription(
      regularUser.id,
      testCustomer.id,
      'pro',
      testPaymentMethod.id
    );

    testFramework.expect(result.success).toBe(true);
    testFramework.expect(result.subscription).toBeDefined();
    testFramework.expect(result.subscription.planId).toBe('pro');
    testFramework.expect(result.subscription.status).toBe('active');
    
    testSubscription = result.subscription;
  });

  await testFramework.runTest('should get customer subscriptions', async () => {
    const result = await testApp.getCustomerSubscriptions(regularUser.id, testCustomer.id);

    testFramework.expect(result.success).toBe(true);
    testFramework.expect(result.subscriptions).toBeDefined();
    testFramework.expect(result.count).toBeGreaterThan(0);
    testFramework.expect(result.subscriptions[0].planId).toBe('pro');
  });

  await testFramework.runTest('should cancel subscription successfully', async () => {
    const result = await testApp.cancelSubscription(
      adminUser.id,
      testSubscription.id,
      'Customer request'
    );

    testFramework.expect(result.success).toBe(true);
    testFramework.expect(result.subscription.status).toBe('canceled');
    testFramework.expect(result.subscription.cancelReason).toBe('Customer request');
  });

  await testFramework.runTest('should reject subscription creation with invalid plan', async () => {
    const result = await testApp.createSubscription(
      regularUser.id,
      testCustomer.id,
      'invalid-plan',
      testPaymentMethod.id
    );

    testFramework.expect(result.success).toBe(false);
  });

  await testFramework.runTest('should reject subscription creation with invalid customer', async () => {
    const result = await testApp.createSubscription(
      regularUser.id,
      'invalid-customer',
      'pro',
      testPaymentMethod.id
    );

    testFramework.expect(result.success).toBe(false);
  });

  // Tests de Facturación
  console.log('\n📋 🧾 Invoicing');
  
  // Crear nueva suscripción para tests de facturación
  const newSubscription = await testApp.createSubscription(
    regularUser.id,
    testCustomer.id,
    'basic',
    testPaymentMethod.id
  );
  
  await testFramework.runTest('should get customer invoices', async () => {
    const result = await testApp.getCustomerInvoices(regularUser.id, testCustomer.id, {});

    testFramework.expect(result.success).toBe(true);
    testFramework.expect(result.invoices).toBeDefined();
    testFramework.expect(result.count).toBeGreaterThan(0);
  });

  await testFramework.runTest('should filter invoices by status', async () => {
    const result = await testApp.getCustomerInvoices(regularUser.id, testCustomer.id, { status: 'pending' });

    testFramework.expect(result.success).toBe(true);
    result.invoices.forEach(invoice => {
      testFramework.expect(invoice.status).toBe('pending');
    });
  });

  await testFramework.runTest('should pay invoice successfully', async () => {
    const invoicesResult = await testApp.getCustomerInvoices(regularUser.id, testCustomer.id, { status: 'pending' });
    testFramework.expect(invoicesResult.invoices.length).toBeGreaterThan(0);
    
    const pendingInvoice = invoicesResult.invoices[0];
    
    const result = await testApp.payInvoice(regularUser.id, pendingInvoice.id, testPaymentMethod.id);

    testFramework.expect(result.success).toBe(true);
    testFramework.expect(result.payment).toBeDefined();
    testFramework.expect(result.payment.status).toBe('completed');
    testFramework.expect(result.payment.amount).toBe(pendingInvoice.amount);
  });

  await testFramework.runTest('should reject payment for non-existent invoice', async () => {
    const result = await testApp.payInvoice(regularUser.id, 99999, testPaymentMethod.id);

    testFramework.expect(result.success).toBe(false);
  });

  // Tests de Rendimiento
  console.log('\n📋 ⚡ Performance Tests');
  
  await testFramework.runTest('should get plans within performance threshold', async () => {
    const testStartTime = Date.now();
    const result = await testApp.getPlans(regularUser.id);
    const duration = Date.now() - testStartTime;

    testFramework.expect(result.success).toBe(true);
    testFramework.expect(duration).toBeLessThan(100);
  });

  await testFramework.runTest('should create customer within performance threshold', async () => {
    const customerData = {
      email: `performance-${Date.now()}@test.com`,
      name: 'Performance Test Customer'
    };
    const testStartTime = Date.now();
    const result = await testApp.createCustomer(regularUser.id, customerData);
    const duration = Date.now() - testStartTime;

    testFramework.expect(result.success).toBe(true);
    testFramework.expect(duration).toBeLessThan(150);
  });

  await testFramework.runTest('should create subscription within performance threshold', async () => {
    const customerResult = await testApp.createCustomer(regularUser.id, {
      email: `perf-sub-${Date.now()}@test.com`,
      name: 'Performance Subscription Customer'
    });
    
    const pmResult = await testApp.updatePaymentMethod(regularUser.id, customerResult.customer.id, {
      type: 'card',
      last4: '1234',
      expiryMonth: 12,
      expiryYear: 2026
    });
    
    const testStartTime = Date.now();
    const result = await testApp.createSubscription(
      regularUser.id,
      customerResult.customer.id,
      'basic',
      pmResult.paymentMethod.id
    );
    const duration = Date.now() - testStartTime;

    testFramework.expect(result.success).toBe(true);
    testFramework.expect(duration).toBeLessThan(200);
  });

  // Tests de Estadísticas
  console.log('\n📋 📈 Billing Statistics');
  
  await testFramework.runTest('should calculate billing statistics correctly', async () => {
    const stats = testApp.billingService.getStats();

    testFramework.expect(stats.totalCustomers).toBeGreaterThan(0);
    testFramework.expect(stats.totalSubscriptions).toBeGreaterThan(0);
    testFramework.expect(stats.totalInvoices).toBeGreaterThan(0);
    testFramework.expect(stats.totalRevenue).toBeGreaterThan(0);
  });

  // Tests de Operaciones Concurrentes
  console.log('\n📋 🔄 Concurrent Operations');
  
  await testFramework.runTest('should handle multiple concurrent plan requests', async () => {
    const promises = [];
    
    for (let i = 0; i < 5; i++) {
      promises.push(testApp.getPlans(regularUser.id));
    }

    const results = await Promise.all(promises);

    results.forEach(result => {
      testFramework.expect(result.success).toBe(true);
      testFramework.expect(result.plans).toBeDefined();
    });
  });

  await testFramework.runTest('should handle multiple concurrent customer creations', async () => {
    const promises = [];
    
    for (let i = 0; i < 3; i++) {
      promises.push(testApp.createCustomer(regularUser.id, {
        email: `concurrent-${i}-${Date.now()}@test.com`,
        name: `Concurrent Customer ${i}`
      }));
    }

    const results = await Promise.all(promises);

    results.forEach(result => {
      testFramework.expect(result.success).toBe(true);
      testFramework.expect(result.customer).toBeDefined();
    });
  });

  // Tests de Autorización
  console.log('\n📋 🔐 Authorization Tests');
  
  await testFramework.runTest('should reject subscription cancellation from regular user', async () => {
    // Crear nueva suscripción para el test
    const subResult = await testApp.createSubscription(
      regularUser.id,
      testCustomer.id,
      'basic',
      testPaymentMethod.id
    );
    
    const result = await testApp.cancelSubscription(
      regularUser.id, // Usuario regular sin permisos
      subResult.subscription.id,
      'Test cancellation'
    );

    testFramework.expect(result.success).toBe(false);
  });

  await testFramework.runTest('should reject billing operations from unauthenticated user', async () => {
    const invalidUserId = 99999;
    const result = await testApp.getCustomerSubscriptions(invalidUserId, testCustomer.id);

    testFramework.expect(result.success).toBe(false);
  });

  // Cleanup y resumen
  await testApp.cleanup();
  console.log('🧹 Billing test environment cleaned up');
  
  const totalDuration = Date.now() - startTime;
  testFramework.printSummary(totalDuration);
}

// Ejecutar si es llamado directamente
if (require.main === module) {
  runBillingTests().catch(error => {
    console.error('❌ Billing test execution failed:', error);
    process.exit(1);
  });
}

module.exports = { runBillingTests, BillingTestHelper };
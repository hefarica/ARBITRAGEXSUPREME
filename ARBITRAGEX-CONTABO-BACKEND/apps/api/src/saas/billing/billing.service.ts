// ArbitrageX Pro 2025 - Billing Service
// Stripe integration for subscription management

import Stripe from 'stripe';
import { DatabaseService } from '../../shared/database/database.service';
import { EventService } from '../../shared/events/event.service';
import { Logger } from '../../shared/monitoring/logger';

export interface CreateSubscriptionDto {
  tenantId: string;
  planId: string;
  paymentMethodId?: string;
  trialDays?: number;
  couponCode?: string;
}

export interface UpdateSubscriptionDto {
  planId?: string;
  quantity?: number;
  prorationBehavior?: 'create_prorations' | 'none' | 'always_invoice';
}

export interface BillingPortalOptions {
  returnUrl: string;
  configuration?: {
    features?: {
      invoice_history?: { enabled: boolean };
      payment_method_update?: { enabled: boolean };
      subscription_cancel?: { enabled: boolean };
      subscription_pause?: { enabled: boolean };
    };
  };
}

export class BillingService {
  private stripe: Stripe;
  private logger = new Logger('BillingService');

  constructor(
    private db: DatabaseService,
    private events: EventService
  ) {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      this.logger.error('STRIPE_SECRET_KEY not configured');
      throw new Error('Stripe not configured');
    }

    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
      typescript: true,
    });
  }

  // ==========================================================================
  // SUBSCRIPTION MANAGEMENT
  // ==========================================================================

  async createSubscription(data: CreateSubscriptionDto) {
    const { tenantId, planId, paymentMethodId, trialDays, couponCode } = data;

    this.logger.info('Creating subscription', { tenantId, planId });

    return this.db.transaction(async (prisma) => {
      // 1. Get tenant and plan
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: { subscription: true },
      });

      if (!tenant) {
        throw new Error('Tenant not found');
      }

      if (tenant.subscription) {
        throw new Error('Tenant already has a subscription');
      }

      const plan = await prisma.subscriptionPlan.findUnique({
        where: { id: planId },
      });

      if (!plan || !plan.is_active) {
        throw new Error('Invalid or inactive plan');
      }

      // 2. Create or get Stripe customer
      let stripeCustomer: Stripe.Customer;
      
      const existingCustomers = await this.stripe.customers.list({
        email: `tenant-${tenant.id}@arbitragex.com`, // Use tenant-specific email
        limit: 1,
      });

      if (existingCustomers.data.length > 0) {
        stripeCustomer = existingCustomers.data[0];
      } else {
        stripeCustomer = await this.stripe.customers.create({
          email: `tenant-${tenant.id}@arbitragex.com`,
          name: tenant.name,
          metadata: {
            tenantId: tenant.id,
            tenantSlug: tenant.slug,
          },
        });
      }

      // 3. Attach payment method if provided
      if (paymentMethodId) {
        await this.stripe.paymentMethods.attach(paymentMethodId, {
          customer: stripeCustomer.id,
        });

        await this.stripe.customers.update(stripeCustomer.id, {
          invoice_settings: {
            default_payment_method: paymentMethodId,
          },
        });
      }

      // 4. Create Stripe subscription
      const subscriptionCreateParams: Stripe.SubscriptionCreateParams = {
        customer: stripeCustomer.id,
        items: [
          {
            price: plan.stripe_price_id!,
            quantity: 1,
          },
        ],
        metadata: {
          tenantId: tenant.id,
          planId: plan.id,
        },
        expand: ['latest_invoice.payment_intent'],
      };

      if (trialDays && trialDays > 0) {
        subscriptionCreateParams.trial_period_days = trialDays;
      }

      if (couponCode) {
        subscriptionCreateParams.coupon = couponCode;
      }

      const stripeSubscription = await this.stripe.subscriptions.create(subscriptionCreateParams);

      // 5. Create subscription in database
      const subscription = await prisma.subscription.create({
        data: {
          tenant_id: tenantId,
          stripe_subscription_id: stripeSubscription.id,
          stripe_customer_id: stripeCustomer.id,
          plan_id: planId,
          status: this.mapStripeStatus(stripeSubscription.status),
          current_period_start: new Date(stripeSubscription.current_period_start * 1000),
          current_period_end: new Date(stripeSubscription.current_period_end * 1000),
          trial_start: stripeSubscription.trial_start 
            ? new Date(stripeSubscription.trial_start * 1000) 
            : null,
          trial_end: stripeSubscription.trial_end 
            ? new Date(stripeSubscription.trial_end * 1000) 
            : null,
        },
        include: {
          plan: true,
        },
      });

      // 6. Update tenant with subscription
      await prisma.tenant.update({
        where: { id: tenantId },
        data: { subscription_id: subscription.id },
      });

      // 7. Emit event
      await this.events.emitEvent({
        type: 'billing.subscription.created',
        tenantId,
        data: {
          subscriptionId: subscription.id,
          planId,
          status: subscription.status,
        },
      });

      this.logger.info('Subscription created successfully', {
        tenantId,
        subscriptionId: subscription.id,
        stripeSubscriptionId: stripeSubscription.id,
      });

      return {
        subscription,
        stripeSubscription,
        requiresAction: stripeSubscription.latest_invoice &&
          typeof stripeSubscription.latest_invoice === 'object' &&
          stripeSubscription.latest_invoice.payment_intent &&
          typeof stripeSubscription.latest_invoice.payment_intent === 'object' &&
          stripeSubscription.latest_invoice.payment_intent.status === 'requires_action',
        clientSecret: stripeSubscription.latest_invoice &&
          typeof stripeSubscription.latest_invoice === 'object' &&
          stripeSubscription.latest_invoice.payment_intent &&
          typeof stripeSubscription.latest_invoice.payment_intent === 'object'
          ? stripeSubscription.latest_invoice.payment_intent.client_secret
          : null,
      };
    });
  }

  async updateSubscription(subscriptionId: string, data: UpdateSubscriptionDto) {
    this.logger.info('Updating subscription', { subscriptionId, data });

    const subscription = await this.db.getSubscriptionById(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    // Update Stripe subscription
    const updateParams: Stripe.SubscriptionUpdateParams = {
      proration_behavior: data.prorationBehavior || 'create_prorations',
    };

    if (data.planId) {
      const plan = await this.db.prisma.subscriptionPlan.findUnique({
        where: { id: data.planId },
      });

      if (!plan || !plan.stripe_price_id) {
        throw new Error('Invalid plan');
      }

      updateParams.items = [
        {
          id: subscription.stripe_subscription_id,
          price: plan.stripe_price_id,
          quantity: data.quantity || 1,
        },
      ];
    }

    if (data.quantity && !data.planId) {
      // Get current subscription from Stripe to get the price ID
      const stripeSubscription = await this.stripe.subscriptions.retrieve(
        subscription.stripe_subscription_id!
      );

      updateParams.items = [
        {
          id: stripeSubscription.items.data[0].id,
          quantity: data.quantity,
        },
      ];
    }

    const updatedStripeSubscription = await this.stripe.subscriptions.update(
      subscription.stripe_subscription_id!,
      updateParams
    );

    // Update database
    const updatedSubscription = await this.db.prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        plan_id: data.planId || subscription.plan_id,
        status: this.mapStripeStatus(updatedStripeSubscription.status),
        current_period_start: new Date(updatedStripeSubscription.current_period_start * 1000),
        current_period_end: new Date(updatedStripeSubscription.current_period_end * 1000),
        updated_at: new Date(),
      },
      include: {
        plan: true,
      },
    });

    // Emit event
    await this.events.emitEvent({
      type: 'billing.subscription.updated',
      tenantId: subscription.tenant_id,
      data: {
        subscriptionId,
        changes: data,
        newStatus: updatedSubscription.status,
      },
    });

    return updatedSubscription;
  }

  async cancelSubscription(subscriptionId: string, cancelAtPeriodEnd: boolean = true) {
    this.logger.info('Canceling subscription', { subscriptionId, cancelAtPeriodEnd });

    const subscription = await this.db.getSubscriptionById(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    // Cancel in Stripe
    const canceledStripeSubscription = await this.stripe.subscriptions.update(
      subscription.stripe_subscription_id!,
      {
        cancel_at_period_end: cancelAtPeriodEnd,
      }
    );

    // Update database
    const updatedSubscription = await this.db.prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        cancel_at_period_end: cancelAtPeriodEnd,
        canceled_at: cancelAtPeriodEnd ? null : new Date(),
        status: cancelAtPeriodEnd ? subscription.status : 'CANCELED',
        updated_at: new Date(),
      },
    });

    // Emit event
    await this.events.emitEvent({
      type: 'billing.subscription.canceled',
      tenantId: subscription.tenant_id,
      data: {
        subscriptionId,
        cancelAtPeriodEnd,
        canceledAt: updatedSubscription.canceled_at,
      },
    });

    return updatedSubscription;
  }

  async reactivateSubscription(subscriptionId: string) {
    this.logger.info('Reactivating subscription', { subscriptionId });

    const subscription = await this.db.getSubscriptionById(subscriptionId);
    if (!subscription) {
      throw new Error('Subscription not found');
    }

    // Reactivate in Stripe
    const reactivatedStripeSubscription = await this.stripe.subscriptions.update(
      subscription.stripe_subscription_id!,
      {
        cancel_at_period_end: false,
      }
    );

    // Update database
    const updatedSubscription = await this.db.prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        cancel_at_period_end: false,
        canceled_at: null,
        status: this.mapStripeStatus(reactivatedStripeSubscription.status),
        updated_at: new Date(),
      },
    });

    // Emit event
    await this.events.emitEvent({
      type: 'billing.subscription.reactivated',
      tenantId: subscription.tenant_id,
      data: {
        subscriptionId,
        newStatus: updatedSubscription.status,
      },
    });

    return updatedSubscription;
  }

  // ==========================================================================
  // PAYMENT METHODS
  // ==========================================================================

  async createSetupIntent(tenantId: string) {
    const tenant = await this.db.getTenantById(tenantId);
    if (!tenant) {
      throw new Error('Tenant not found');
    }

    // Get or create Stripe customer
    let stripeCustomer: Stripe.Customer;
    
    if (tenant.subscription?.stripe_customer_id) {
      stripeCustomer = await this.stripe.customers.retrieve(
        tenant.subscription.stripe_customer_id
      ) as Stripe.Customer;
    } else {
      stripeCustomer = await this.stripe.customers.create({
        email: `tenant-${tenant.id}@arbitragex.com`,
        name: tenant.name,
        metadata: {
          tenantId: tenant.id,
          tenantSlug: tenant.slug,
        },
      });
    }

    const setupIntent = await this.stripe.setupIntents.create({
      customer: stripeCustomer.id,
      usage: 'off_session',
      metadata: {
        tenantId: tenant.id,
      },
    });

    return {
      clientSecret: setupIntent.client_secret,
      customerId: stripeCustomer.id,
    };
  }

  async getPaymentMethods(tenantId: string) {
    const tenant = await this.db.getTenantById(tenantId);
    if (!tenant?.subscription?.stripe_customer_id) {
      return [];
    }

    const paymentMethods = await this.stripe.paymentMethods.list({
      customer: tenant.subscription.stripe_customer_id,
      type: 'card',
    });

    return paymentMethods.data.map(pm => ({
      id: pm.id,
      type: pm.type,
      card: pm.card ? {
        brand: pm.card.brand,
        last4: pm.card.last4,
        expMonth: pm.card.exp_month,
        expYear: pm.card.exp_year,
      } : null,
      isDefault: pm.id === tenant.subscription?.stripe_customer_id, // Simplified check
    }));
  }

  async setDefaultPaymentMethod(tenantId: string, paymentMethodId: string) {
    const tenant = await this.db.getTenantById(tenantId);
    if (!tenant?.subscription?.stripe_customer_id) {
      throw new Error('No customer found');
    }

    await this.stripe.customers.update(tenant.subscription.stripe_customer_id, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    this.logger.info('Default payment method updated', { tenantId, paymentMethodId });
  }

  async deletePaymentMethod(paymentMethodId: string) {
    await this.stripe.paymentMethods.detach(paymentMethodId);
    this.logger.info('Payment method deleted', { paymentMethodId });
  }

  // ==========================================================================
  // INVOICES
  // ==========================================================================

  async getInvoices(tenantId: string, limit: number = 10) {
    const tenant = await this.db.getTenantById(tenantId);
    if (!tenant?.subscription?.stripe_customer_id) {
      return [];
    }

    const invoices = await this.stripe.invoices.list({
      customer: tenant.subscription.stripe_customer_id,
      limit,
    });

    return invoices.data.map(invoice => ({
      id: invoice.id,
      number: invoice.number,
      status: invoice.status,
      amountDue: invoice.amount_due,
      amountPaid: invoice.amount_paid,
      currency: invoice.currency,
      created: new Date(invoice.created * 1000),
      dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
      hostedInvoiceUrl: invoice.hosted_invoice_url,
      invoicePdf: invoice.invoice_pdf,
    }));
  }

  async downloadInvoice(invoiceId: string) {
    const invoice = await this.stripe.invoices.retrieve(invoiceId);
    return {
      url: invoice.invoice_pdf,
      hostedUrl: invoice.hosted_invoice_url,
    };
  }

  // ==========================================================================
  // BILLING PORTAL
  // ==========================================================================

  async createBillingPortalSession(tenantId: string, options: BillingPortalOptions) {
    const tenant = await this.db.getTenantById(tenantId);
    if (!tenant?.subscription?.stripe_customer_id) {
      throw new Error('No customer found for billing portal');
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: tenant.subscription.stripe_customer_id,
      return_url: options.returnUrl,
      configuration: options.configuration?.features ? {
        features: {
          invoice_history: options.configuration.features.invoice_history || { enabled: true },
          payment_method_update: options.configuration.features.payment_method_update || { enabled: true },
          subscription_cancel: options.configuration.features.subscription_cancel || { enabled: true },
          subscription_pause: options.configuration.features.subscription_pause || { enabled: false },
        },
      } : undefined,
    });

    return {
      url: session.url,
    };
  }

  // ==========================================================================
  // USAGE-BASED BILLING
  // ==========================================================================

  async recordUsage(tenantId: string, usageType: string, quantity: number, timestamp?: Date) {
    const tenant = await this.db.getTenantById(tenantId);
    if (!tenant?.subscription?.stripe_subscription_id) {
      return; // No active subscription
    }

    // In a real implementation, you would:
    // 1. Find the subscription item for usage-based pricing
    // 2. Create usage records in Stripe
    // 3. Store usage data for analytics

    this.logger.info('Usage recorded', { tenantId, usageType, quantity });
  }

  async getUsageStats(tenantId: string, period: 'current' | 'previous' = 'current') {
    // Return usage statistics for the tenant
    // This would query your usage tracking system
    return {
      period,
      apiCalls: 0,
      opportunitiesDetected: 0,
      executionsAttempted: 0,
      executionsSuccessful: 0,
    };
  }

  // ==========================================================================
  // WEBHOOK HANDLING
  // ==========================================================================

  async handleWebhook(payload: string, signature: string) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error('Stripe webhook secret not configured');
    }

    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (error) {
      this.logger.error('Webhook signature verification failed', { error });
      throw new Error('Invalid webhook signature');
    }

    this.logger.info('Processing Stripe webhook', { type: event.type, id: event.id });

    switch (event.type) {
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await this.handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case 'customer.subscription.trial_will_end':
        await this.handleTrialWillEnd(event.data.object as Stripe.Subscription);
        break;

      default:
        this.logger.info('Unhandled webhook event type', { type: event.type });
    }
  }

  private async handleSubscriptionUpdated(stripeSubscription: Stripe.Subscription) {
    const subscription = await this.db.prisma.subscription.findFirst({
      where: { stripe_subscription_id: stripeSubscription.id },
    });

    if (!subscription) {
      this.logger.warn('Subscription not found for webhook', { stripeSubscriptionId: stripeSubscription.id });
      return;
    }

    await this.db.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: this.mapStripeStatus(stripeSubscription.status),
        current_period_start: new Date(stripeSubscription.current_period_start * 1000),
        current_period_end: new Date(stripeSubscription.current_period_end * 1000),
        cancel_at_period_end: stripeSubscription.cancel_at_period_end,
        canceled_at: stripeSubscription.canceled_at 
          ? new Date(stripeSubscription.canceled_at * 1000) 
          : null,
        updated_at: new Date(),
      },
    });

    await this.events.emitEvent({
      type: 'billing.subscription.webhook_updated',
      tenantId: subscription.tenant_id,
      data: {
        subscriptionId: subscription.id,
        status: this.mapStripeStatus(stripeSubscription.status),
      },
    });
  }

  private async handleSubscriptionDeleted(stripeSubscription: Stripe.Subscription) {
    const subscription = await this.db.prisma.subscription.findFirst({
      where: { stripe_subscription_id: stripeSubscription.id },
    });

    if (!subscription) {
      return;
    }

    await this.db.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'CANCELED',
        canceled_at: new Date(),
        updated_at: new Date(),
      },
    });
  }

  private async handlePaymentSucceeded(invoice: Stripe.Invoice) {
    // Create invoice record in database
    const subscription = await this.db.prisma.subscription.findFirst({
      where: { stripe_subscription_id: invoice.subscription as string },
    });

    if (subscription) {
      await this.db.prisma.invoice.create({
        data: {
          subscription_id: subscription.id,
          stripe_invoice_id: invoice.id,
          amount_due: invoice.amount_due / 100, // Convert from cents
          amount_paid: invoice.amount_paid / 100,
          currency: invoice.currency.toUpperCase(),
          status: 'PAID',
          due_date: new Date(invoice.due_date! * 1000),
          paid_at: new Date(),
        },
      });
    }
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice) {
    this.logger.warn('Payment failed', { invoiceId: invoice.id });
    
    // Implement dunning management logic here
    // Send notifications, retry payments, etc.
  }

  private async handleTrialWillEnd(stripeSubscription: Stripe.Subscription) {
    const subscription = await this.db.prisma.subscription.findFirst({
      where: { stripe_subscription_id: stripeSubscription.id },
    });

    if (subscription) {
      await this.events.emitEvent({
        type: 'billing.trial.ending',
        tenantId: subscription.tenant_id,
        data: {
          subscriptionId: subscription.id,
          trialEnd: new Date(stripeSubscription.trial_end! * 1000),
        },
      });
    }
  }

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  private mapStripeStatus(stripeStatus: string): 'ACTIVE' | 'CANCELED' | 'PAST_DUE' | 'UNPAID' | 'TRIALING' {
    switch (stripeStatus) {
      case 'active':
        return 'ACTIVE';
      case 'canceled':
        return 'CANCELED';
      case 'past_due':
        return 'PAST_DUE';
      case 'unpaid':
        return 'UNPAID';
      case 'trialing':
        return 'TRIALING';
      default:
        return 'ACTIVE';
    }
  }

  // ==========================================================================
  // SUBSCRIPTION PLANS
  // ==========================================================================

  async getAvailablePlans() {
    return this.db.getSubscriptionPlans();
  }

  async createPlan(planData: {
    name: string;
    description?: string;
    priceMonthly: number;
    priceYearly?: number;
    features: Record<string, any>;
    limits: Record<string, any>;
  }) {
    // Create in Stripe first
    const stripePrice = await this.stripe.prices.create({
      currency: 'usd',
      unit_amount: Math.round(planData.priceMonthly * 100), // Convert to cents
      recurring: {
        interval: 'month',
      },
      product_data: {
        name: planData.name,
        description: planData.description,
      },
    });

    // Create in database
    const plan = await this.db.prisma.subscriptionPlan.create({
      data: {
        name: planData.name,
        description: planData.description,
        stripe_price_id: stripePrice.id,
        price_monthly: planData.priceMonthly,
        price_yearly: planData.priceYearly,
        features: planData.features,
        limits: planData.limits,
        is_active: true,
      },
    });

    return plan;
  }
}
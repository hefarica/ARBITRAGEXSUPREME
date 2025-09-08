// ArbitrageX Pro 2025 - Billing Routes
// Stripe billing integration endpoints

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { BillingService } from '../../saas/billing/billing.service';

export async function billingRoutes(fastify: FastifyInstance) {
  const billingService = fastify.billingService as BillingService;

  // Get available plans
  fastify.get('/plans', {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const plans = await billingService.getAvailablePlans();
      
      return {
        success: true,
        plans,
      };
    } catch (error) {
      reply.code(500);
      return {
        success: false,
        error: 'Failed to get plans',
      };
    }
  });

  // Create billing portal session
  fastify.post('/portal', {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest<{ 
    Body: { returnUrl: string } 
  }>, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      const { returnUrl } = request.body;
      
      const session = await billingService.createBillingPortalSession(user.tenantId, {
        returnUrl: returnUrl || 'https://app.arbitragex.com/settings/billing',
      });
      
      return {
        success: true,
        url: session.url,
      };
    } catch (error) {
      reply.code(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create portal session',
      };
    }
  });
}
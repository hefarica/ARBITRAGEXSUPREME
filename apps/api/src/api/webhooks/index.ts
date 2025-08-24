// ArbitrageX Pro 2025 - Webhook Routes
// External webhook handlers

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { BillingService } from '../../saas/billing/billing.service';

export async function webhookRoutes(fastify: FastifyInstance) {
  const billingService = fastify.billingService as BillingService;

  // Stripe webhook handler
  fastify.post('/stripe', {
    config: {
      // Skip normal body parsing for webhook signature verification
      rawBody: true,
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const signature = request.headers['stripe-signature'] as string;
      const payload = request.rawBody as string;
      
      if (!signature) {
        reply.code(400);
        return { error: 'Missing stripe-signature header' };
      }

      await billingService.handleWebhook(payload, signature);
      
      return { received: true };
    } catch (error) {
      fastify.log.error('Stripe webhook error:', error);
      reply.code(400);
      return { 
        error: error instanceof Error ? error.message : 'Webhook processing failed' 
      };
    }
  });
}
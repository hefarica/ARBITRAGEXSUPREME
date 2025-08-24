// ArbitrageX Pro 2025 - Tenant Management Routes
// Multi-tenant SaaS operations

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { TenantService } from '../../saas/tenant/tenant.service';

export async function tenantRoutes(fastify: FastifyInstance) {
  const tenantService = fastify.tenantService as TenantService;

  // Get tenant info
  fastify.get('/info', {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      const tenant = await tenantService.getTenantById(user.tenantId);
      
      return {
        success: true,
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          domain: tenant.domain,
          status: tenant.status,
          subscription: tenant.subscription,
          settings: tenant.settings,
          branding: tenant.branding,
        },
      };
    } catch (error) {
      reply.code(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get tenant info',
      };
    }
  });

  // Get usage stats
  fastify.get('/usage', {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      const stats = await tenantService.getTenantUsageStats(user.tenantId);
      
      return {
        success: true,
        usage: stats,
      };
    } catch (error) {
      reply.code(500);
      return {
        success: false,
        error: 'Failed to get usage stats',
      };
    }
  });
}
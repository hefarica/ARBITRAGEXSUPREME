/**
 * ArbitrageX Supreme V3.0 - Opportunities API Proxy
 * Cloudflare Worker for proxying opportunities data from backend
 */

// No imports needed for Cloudflare Workers

import { requireAuth, logRequest } from './middleware';
import { handleError } from '../utils/error-handler';
import { logger } from '../utils/logger';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      // Log request
      await logRequest(request, 'opportunities');
      
      // Handle CORS preflight
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          },
        });
      }

      const url = new URL(request.url);
      const path = url.pathname;

      // Route handling
      switch (request.method) {
        case 'GET':
          if (path === '/opportunities') {
            return await getOpportunities(request, env);
          } else if (path.startsWith('/opportunities/')) {
            const id = path.split('/')[2];
            return await getOpportunity(id, env);
          }
          break;
          
        case 'POST':
          if (path === '/opportunities') {
            // Require authentication for creating opportunities
            const authResult = await requireAuth(request, env);
            if (!authResult.success) {
              return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
              });
            }
            return await createOpportunity(request, env);
          }
          break;
      }

      return new Response('Not Found', { status: 404 });
    } catch (error) {
      return handleError(error, 'opportunities');
      });
    }
  }
};

interface Env {
  BACKEND_URL: string;
}

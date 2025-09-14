// workers/api-proxy/executions.ts
import { requireAuth } from '../middleware/auth';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Autenticación JWT básica
    const authError = requireAuth(request, env);
    if (authError) return authError;

    try {
      const backendResponse = await fetch(`${env.BACKEND_URL}/executions`);
      const data = await backendResponse.json();
      
      return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Failed to fetch executions' }), {
        status: 500
      });
    }
  }
};

interface Env {
  BACKEND_URL: string;
  JWT_SECRET: string;
}

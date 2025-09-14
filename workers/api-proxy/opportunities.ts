/**
 * ArbitrageX Supreme V3.0 - Opportunities API Proxy
 * Cloudflare Worker for proxying opportunities data from backend
 */

// No imports needed for Cloudflare Workers

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const backendUrl = env.BACKEND_URL || 'http://localhost:8080';
      const backendResponse = await fetch(`${backendUrl}/opportunities`);
      const data = await backendResponse.json();
      
      return new Response(JSON.stringify(data), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Failed to fetch opportunities' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};

interface Env {
  BACKEND_URL: string;
}

// workers/api-proxy/middleware.ts
export function requireAuth(request: Request, env: Env): Response | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const token = authHeader.substring(7);
  // Aquí iría validación JWT real
  if (token !== env.JWT_SECRET) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401
    });
  }

  return null;
}

export function logRequest(request: Request, message: string) {
  console.log(`[${new Date().toISOString()}] ${request.method} ${request.url} - ${message}`);
}

interface Env {
  JWT_SECRET: string;
}

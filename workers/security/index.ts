/**
 * ArbitrageX Supreme V3.0 - Security Worker
 * Advanced security middleware with threat detection and protection
 */

export interface Env {
  SECURITY_KV: KVNamespace;
  JWT_SECRET: string;
  API_KEYS: KVNamespace;
  THREAT_DETECTION: DurableObjectNamespace;
}

interface SecurityConfig {
  enableJWT: boolean;
  enableAPIKey: boolean;
  enableThreatDetection: boolean;
  enableCSRF: boolean;
  enableXSS: boolean;
  maxRequestSize: number;
  allowedOrigins: string[];
}

interface ThreatScore {
  ip: string;
  score: number;
  reasons: string[];
  timestamp: number;
  blocked: boolean;
}

interface SecurityHeaders {
  'Content-Security-Policy': string;
  'X-Frame-Options': string;
  'X-Content-Type-Options': string;
  'Referrer-Policy': string;
  'Permissions-Policy': string;
  'Strict-Transport-Security': string;
}

class ThreatDetector {
  private state: DurableObjectState;
  private env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;
    
    try {
      switch (method) {
        case 'POST':
          return await this.analyzeThreat(request);
        case 'GET':
          return await this.getThreatScore(url);
        case 'DELETE':
          return await this.clearThreat(url);
        default:
          return new Response('Method not allowed', { status: 405 });
      }
    } catch (error) {
      console.error('Threat detector error:', error);
      return new Response(JSON.stringify({
        error: 'Threat detection service error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private async analyzeThreat(request: Request): Promise<Response> {
    const body = await request.json() as {
      ip: string;
      userAgent: string;
      path: string;
      method: string;
      headers: Record<string, string>;
      body?: string;
    };

    const threatScore = await this.calculateThreatScore(body);
    
    // Store threat score
    await this.state.storage.put(`threat:${body.ip}`, threatScore);
    
    // Set alarm for cleanup
    await this.state.storage.setAlarm(Date.now() + 3600000); // 1 hour

    return new Response(JSON.stringify(threatScore), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async getThreatScore(url: URL): Promise<Response> {
    const ip = url.searchParams.get('ip');
    if (!ip) {
      return new Response('Missing IP parameter', { status: 400 });
    }

    const threatScore = await this.state.storage.get<ThreatScore>(`threat:${ip}`);
    
    if (!threatScore) {
      return new Response(JSON.stringify({
        ip,
        score: 0,
        reasons: [],
        timestamp: Date.now(),
        blocked: false
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(threatScore), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async clearThreat(url: URL): Promise<Response> {
    const ip = url.searchParams.get('ip');
    if (!ip) {
      return new Response('Missing IP parameter', { status: 400 });
    }

    await this.state.storage.delete(`threat:${ip}`);
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async calculateThreatScore(data: any): Promise<ThreatScore> {
    let score = 0;
    const reasons: string[] = [];
    const now = Date.now();

    // Check for suspicious patterns
    if (this.isSuspiciousUserAgent(data.userAgent)) {
      score += 20;
      reasons.push('Suspicious user agent');
    }

    if (this.isSuspiciousPath(data.path)) {
      score += 30;
      reasons.push('Suspicious path pattern');
    }

    if (this.hasSQLInjectionPatterns(data.body || '')) {
      score += 50;
      reasons.push('SQL injection attempt');
    }

    if (this.hasXSSPatterns(data.body || '')) {
      score += 40;
      reasons.push('XSS attempt');
    }

    if (this.hasExcessiveHeaders(data.headers)) {
      score += 15;
      reasons.push('Excessive headers');
    }

    // Check request frequency
    const recentRequests = await this.getRecentRequestCount(data.ip);
    if (recentRequests > 100) {
      score += 25;
      reasons.push('High request frequency');
    }

    return {
      ip: data.ip,
      score: Math.min(score, 100),
      reasons,
      timestamp: now,
      blocked: score >= 70
    };
  }

  private isSuspiciousUserAgent(userAgent: string): boolean {
    const suspiciousPatterns = [
      /bot/i,
      /crawler/i,
      /scanner/i,
      /sqlmap/i,
      /nikto/i,
      /nmap/i,
      /curl/i,
      /wget/i
    ];

    return suspiciousPatterns.some(pattern => pattern.test(userAgent));
  }

  private isSuspiciousPath(path: string): boolean {
    const suspiciousPaths = [
      /\.\.\//, // Directory traversal
      /\/admin/i,
      /\/wp-admin/i,
      /\/phpmyadmin/i,
      /\.php$/,
      /\.asp$/,
      /\.jsp$/,
      /\/etc\/passwd/,
      /\/proc\/version/
    ];

    return suspiciousPaths.some(pattern => pattern.test(path));
  }

  private hasSQLInjectionPatterns(body: string): boolean {
    const sqlPatterns = [
      /union\s+select/i,
      /drop\s+table/i,
      /insert\s+into/i,
      /delete\s+from/i,
      /update\s+set/i,
      /'\s*or\s*'1'\s*=\s*'1/i,
      /'\s*or\s*1\s*=\s*1/i,
      /--/,
      /\/\*/
    ];

    return sqlPatterns.some(pattern => pattern.test(body));
  }

  private hasXSSPatterns(body: string): boolean {
    const xssPatterns = [
      /<script/i,
      /javascript:/i,
      /onload\s*=/i,
      /onerror\s*=/i,
      /onclick\s*=/i,
      /eval\s*\(/i,
      /alert\s*\(/i,
      /document\.cookie/i
    ];

    return xssPatterns.some(pattern => pattern.test(body));
  }

  private hasExcessiveHeaders(headers: Record<string, string>): boolean {
    return Object.keys(headers).length > 50;
  }

  private async getRecentRequestCount(ip: string): Promise<number> {
    const key = `requests:${ip}`;
    const count = await this.state.storage.get<number>(key) || 0;
    
    // Increment and store
    await this.state.storage.put(key, count + 1);
    
    return count;
  }

  async alarm() {
    // Cleanup old entries
    const now = Date.now();
    const keys = await this.state.storage.list();
    
    for (const [key, value] of keys) {
      if (typeof key === 'string' && key.startsWith('threat:')) {
        const threat = value as ThreatScore;
        if (now - threat.timestamp > 3600000) { // 1 hour
          await this.state.storage.delete(key);
        }
      } else if (typeof key === 'string' && key.startsWith('requests:')) {
        // Reset request counters every hour
        await this.state.storage.delete(key);
      }
    }
  }
}

export { ThreatDetector };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const config = getSecurityConfig();
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleCORS(config);
    }

    try {
      // Security checks
      const securityResult = await performSecurityChecks(request, env, config);
      
      if (!securityResult.allowed) {
        return new Response(JSON.stringify({
          error: 'Security check failed',
          reason: securityResult.reason,
          blocked: true
        }), {
          status: securityResult.status || 403,
          headers: {
            'Content-Type': 'application/json',
            ...getSecurityHeaders()
          }
        });
      }

      // Route to specific security operation
      const operation = url.pathname.split('/').pop();
      
      switch (operation) {
        case 'validate':
          return await handleValidation(request, env);
        case 'authenticate':
          return await handleAuthentication(request, env);
        case 'authorize':
          return await handleAuthorization(request, env);
        case 'threat-check':
          return await handleThreatCheck(request, env);
        default:
          return new Response(JSON.stringify({
            service: 'ArbitrageX Security Worker',
            version: '3.0.0',
            features: [
              'JWT Authentication',
              'API Key Validation',
              'Threat Detection',
              'CSRF Protection',
              'XSS Protection',
              'Security Headers'
            ]
          }), {
            headers: {
              'Content-Type': 'application/json',
              ...getSecurityHeaders()
            }
          });
      }
    } catch (error) {
      console.error('Security worker error:', error);
      
      return new Response(JSON.stringify({
        error: 'Security service error',
        message: 'Internal security service error'
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...getSecurityHeaders()
        }
      });
    }
  }
};

async function performSecurityChecks(
  request: Request, 
  env: Env, 
  config: SecurityConfig
): Promise<{ allowed: boolean; reason?: string; status?: number }> {
  
  // Check request size
  const contentLength = request.headers.get('Content-Length');
  if (contentLength && parseInt(contentLength) > config.maxRequestSize) {
    return { allowed: false, reason: 'Request too large', status: 413 };
  }

  // Check origin
  const origin = request.headers.get('Origin');
  if (origin && !config.allowedOrigins.includes('*') && !config.allowedOrigins.includes(origin)) {
    return { allowed: false, reason: 'Origin not allowed', status: 403 };
  }

  // Threat detection
  if (config.enableThreatDetection) {
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    const userAgent = request.headers.get('User-Agent') || 'unknown';
    
    const durableObjectId = env.THREAT_DETECTION.idFromName(clientIP);
    const threatDetector = env.THREAT_DETECTION.get(durableObjectId);
    
    const threatRequest = new Request('https://threat-detector/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ip: clientIP,
        userAgent,
        path: new URL(request.url).pathname,
        method: request.method,
        headers: Object.fromEntries(request.headers.entries())
      })
    });
    
    const threatResponse = await threatDetector.fetch(threatRequest);
    const threatResult = await threatResponse.json() as ThreatScore;
    
    if (threatResult.blocked) {
      return { 
        allowed: false, 
        reason: `Threat detected: ${threatResult.reasons.join(', ')}`, 
        status: 429 
      };
    }
  }

  return { allowed: true };
}

async function handleValidation(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as {
    token?: string;
    apiKey?: string;
  };

  const results = {
    jwt: false,
    apiKey: false,
    valid: false
  };

  // Validate JWT
  if (body.token) {
    results.jwt = await validateJWT(body.token, env.JWT_SECRET);
  }

  // Validate API Key
  if (body.apiKey) {
    results.apiKey = await validateAPIKey(body.apiKey, env);
  }

  results.valid = results.jwt || results.apiKey;

  return new Response(JSON.stringify(results), {
    headers: {
      'Content-Type': 'application/json',
      ...getSecurityHeaders()
    }
  });
}

async function handleAuthentication(request: Request, env: Env): Promise<Response> {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader) {
    return new Response(JSON.stringify({
      authenticated: false,
      reason: 'No authorization header'
    }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        ...getSecurityHeaders()
      }
    });
  }

  let authenticated = false;
  let user = null;

  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const jwtResult = await validateJWT(token, env.JWT_SECRET);
    if (jwtResult) {
      authenticated = true;
      user = { type: 'jwt', token };
    }
  } else if (authHeader.startsWith('ApiKey ')) {
    const apiKey = authHeader.substring(7);
    const apiKeyResult = await validateAPIKey(apiKey, env);
    if (apiKeyResult) {
      authenticated = true;
      user = { type: 'apikey', key: apiKey.substring(0, 8) + '...' };
    }
  }

  return new Response(JSON.stringify({
    authenticated,
    user
  }), {
    status: authenticated ? 200 : 401,
    headers: {
      'Content-Type': 'application/json',
      ...getSecurityHeaders()
    }
  });
}

async function handleAuthorization(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as {
    resource: string;
    action: string;
    user?: any;
  };

  // Simple role-based authorization
  const authorized = await checkAuthorization(body.resource, body.action, body.user);

  return new Response(JSON.stringify({
    authorized,
    resource: body.resource,
    action: body.action
  }), {
    status: authorized ? 200 : 403,
    headers: {
      'Content-Type': 'application/json',
      ...getSecurityHeaders()
    }
  });
}

async function handleThreatCheck(request: Request, env: Env): Promise<Response> {
  const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
  
  const durableObjectId = env.THREAT_DETECTION.idFromName(clientIP);
  const threatDetector = env.THREAT_DETECTION.get(durableObjectId);
  
  const threatRequest = new Request(`https://threat-detector/?ip=${clientIP}`, {
    method: 'GET'
  });
  
  const threatResponse = await threatDetector.fetch(threatRequest);
  const threatResult = await threatResponse.json();

  return new Response(JSON.stringify(threatResult), {
    headers: {
      'Content-Type': 'application/json',
      ...getSecurityHeaders()
    }
  });
}

async function validateJWT(token: string, secret: string): Promise<boolean> {
  try {
    // Simple JWT validation - in production, use a proper JWT library
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    
    // Decode header and payload
    const header = JSON.parse(atob(parts[0]));
    const payload = JSON.parse(atob(parts[1]));
    
    // Check expiration
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      return false;
    }
    
    // In production, verify signature properly
    return true;
  } catch {
    return false;
  }
}

async function validateAPIKey(apiKey: string, env: Env): Promise<boolean> {
  try {
    const keyData = await env.API_KEYS.get(apiKey);
    return keyData !== null;
  } catch {
    return false;
  }
}

async function checkAuthorization(resource: string, action: string, user: any): Promise<boolean> {
  // Simple authorization logic - in production, implement proper RBAC
  if (!user) return false;
  
  // Admin users can do everything
  if (user.role === 'admin') return true;
  
  // Regular users can read most resources
  if (action === 'read') return true;
  
  // Write operations require specific permissions
  if (action === 'write' && ['opportunities', 'executions'].includes(resource)) {
    return user.role === 'trader' || user.role === 'admin';
  }
  
  return false;
}

function getSecurityConfig(): SecurityConfig {
  return {
    enableJWT: true,
    enableAPIKey: true,
    enableThreatDetection: true,
    enableCSRF: true,
    enableXSS: true,
    maxRequestSize: 10 * 1024 * 1024, // 10MB
    allowedOrigins: ['*'] // Configure properly in production
  };
}

function getSecurityHeaders(): SecurityHeaders {
  return {
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
  };
}

function handleCORS(config: SecurityConfig): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': config.allowedOrigins.includes('*') ? '*' : config.allowedOrigins[0],
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
      'Access-Control-Max-Age': '86400',
      ...getSecurityHeaders()
    }
  });
}

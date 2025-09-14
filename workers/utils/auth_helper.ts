/**
 * ArbitrageX Supreme V3.0 - Authentication Helper
 * JWT and API key authentication for Cloudflare Workers
 */

export interface AuthResult {
  valid: boolean;
  userId?: string;
  error?: string;
}

export interface JWTPayload {
  sub: string;
  iat: number;
  exp: number;
  role?: string;
  permissions?: string[];
}

export async function authenticateRequest(request: Request, env: any): Promise<AuthResult> {
  // Check for API key first
  const apiKey = request.headers.get('X-API-Key') || request.headers.get('Authorization')?.replace('Bearer ', '');
  
  if (apiKey) {
    return await validateApiKey(apiKey, env);
  }

  // Check for JWT token
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    return await validateJWT(token, env);
  }

  return {
    valid: false,
    error: 'No authentication provided'
  };
}

export async function validateApiKey(apiKey: string, env: any): Promise<AuthResult> {
  try {
    // Check against environment variable for admin API key
    if (env.ADMIN_API_KEY && apiKey === env.ADMIN_API_KEY) {
      return {
        valid: true,
        userId: 'admin'
      };
    }

    // Check against KV store for user API keys
    if (env.API_KEYS_KV) {
      const keyData = await env.API_KEYS_KV.get(`api_key:${apiKey}`);
      if (keyData) {
        const keyInfo = JSON.parse(keyData);
        
        // Check if key is active and not expired
        if (keyInfo.active && (!keyInfo.expiresAt || new Date(keyInfo.expiresAt) > new Date())) {
          return {
            valid: true,
            userId: keyInfo.userId
          };
        }
      }
    }

    return {
      valid: false,
      error: 'Invalid API key'
    };
  } catch (error) {
    return {
      valid: false,
      error: 'Authentication error'
    };
  }
}

export async function validateJWT(token: string, env: any): Promise<AuthResult> {
  try {
    if (!env.JWT_SECRET) {
      return {
        valid: false,
        error: 'JWT validation not configured'
      };
    }

    // Simple JWT validation (in production, use a proper JWT library)
    const parts = token.split('.');
    if (parts.length !== 3) {
      return {
        valid: false,
        error: 'Invalid JWT format'
      };
    }

    const payload = JSON.parse(atob(parts[1])) as JWTPayload;
    
    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return {
        valid: false,
        error: 'Token expired'
      };
    }

    // Verify signature (simplified - use proper crypto in production)
    const expectedSignature = await generateJWTSignature(parts[0] + '.' + parts[1], env.JWT_SECRET);
    if (parts[2] !== expectedSignature) {
      return {
        valid: false,
        error: 'Invalid token signature'
      };
    }

    return {
      valid: true,
      userId: payload.sub
    };
  } catch (error) {
    return {
      valid: false,
      error: 'JWT validation failed'
    };
  }
}

async function generateJWTSignature(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

export async function createAPIKey(userId: string, env: any, expiresInDays?: number): Promise<string> {
  const apiKey = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  
  const keyInfo = {
    userId,
    active: true,
    createdAt: new Date().toISOString(),
    expiresAt: expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString() : null,
  };

  if (env.API_KEYS_KV) {
    await env.API_KEYS_KV.put(`api_key:${apiKey}`, JSON.stringify(keyInfo));
  }

  return apiKey;
}

export async function revokeAPIKey(apiKey: string, env: any): Promise<boolean> {
  try {
    if (env.API_KEYS_KV) {
      const keyData = await env.API_KEYS_KV.get(`api_key:${apiKey}`);
      if (keyData) {
        const keyInfo = JSON.parse(keyData);
        keyInfo.active = false;
        keyInfo.revokedAt = new Date().toISOString();
        
        await env.API_KEYS_KV.put(`api_key:${apiKey}`, JSON.stringify(keyInfo));
        return true;
      }
    }
    return false;
  } catch (error) {
    return false;
  }
}

export function hasPermission(authResult: AuthResult, requiredPermission: string): boolean {
  // Admin has all permissions
  if (authResult.userId === 'admin') {
    return true;
  }

  // For now, all authenticated users have basic permissions
  // In production, implement proper role-based access control
  const basicPermissions = ['read:opportunities', 'read:executions', 'read:analytics'];
  
  return basicPermissions.includes(requiredPermission);
}

export async function rateLimitCheck(request: Request, env: any, limit: number = 100): Promise<{ allowed: boolean; remaining: number }> {
  const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
  const rateLimitKey = `rate_limit:${clientIP}`;
  
  if (!env.RATE_LIMIT_KV) {
    return { allowed: true, remaining: limit };
  }

  try {
    const current = await env.RATE_LIMIT_KV.get(rateLimitKey);
    const count = current ? parseInt(current) : 0;
    
    if (count >= limit) {
      return { allowed: false, remaining: 0 };
    }
    
    await env.RATE_LIMIT_KV.put(rateLimitKey, (count + 1).toString(), {
      expirationTtl: 3600, // 1 hour
    });
    
    return { allowed: true, remaining: limit - count - 1 };
  } catch (error) {
    // If rate limiting fails, allow the request
    return { allowed: true, remaining: limit };
  }
}

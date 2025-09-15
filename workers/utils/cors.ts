/**
 * ArbitrageX Supreme V3.0 - CORS Utility
 * Advanced CORS handling with security and configuration management
 */

export interface CORSConfig {
  allowedOrigins: string[];
  allowedMethods: string[];
  allowedHeaders: string[];
  exposedHeaders: string[];
  maxAge: number;
  credentials: boolean;
  preflightContinue: boolean;
  optionsSuccessStatus: number;
}

export interface CORSOptions {
  origin?: string | string[] | boolean | ((origin: string) => boolean);
  methods?: string | string[];
  allowedHeaders?: string | string[];
  exposedHeaders?: string | string[];
  credentials?: boolean;
  maxAge?: number;
  preflightContinue?: boolean;
  optionsSuccessStatus?: number;
}

/**
 * Default CORS configuration for ArbitrageX
 */
export const DEFAULT_CORS_CONFIG: CORSConfig = {
  allowedOrigins: [
    'https://arbitragex.app',
    'https://www.arbitragex.app',
    'https://dashboard.arbitragex.app',
    'https://api.arbitragex.app',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173'
  ],
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-API-Key',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Cache-Control',
    'X-File-Name'
  ],
  exposedHeaders: [
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'X-Response-Time',
    'X-Request-ID'
  ],
  maxAge: 86400, // 24 hours
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
};

/**
 * Production CORS configuration with stricter security
 */
export const PRODUCTION_CORS_CONFIG: CORSConfig = {
  allowedOrigins: [
    'https://arbitragex.app',
    'https://www.arbitragex.app',
    'https://dashboard.arbitragex.app'
  ],
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-API-Key',
    'X-Requested-With'
  ],
  exposedHeaders: [
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-Response-Time'
  ],
  maxAge: 3600, // 1 hour
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
};

/**
 * Development CORS configuration with relaxed security
 */
export const DEVELOPMENT_CORS_CONFIG: CORSConfig = {
  allowedOrigins: ['*'],
  allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
  allowedHeaders: ['*'],
  exposedHeaders: ['*'],
  maxAge: 86400,
  credentials: false,
  preflightContinue: false,
  optionsSuccessStatus: 200
};

/**
 * CORS middleware class for handling cross-origin requests
 */
export class CORSHandler {
  private config: CORSConfig;

  constructor(config?: Partial<CORSConfig>) {
    this.config = { ...DEFAULT_CORS_CONFIG, ...config };
  }

  /**
   * Handle CORS for a request
   */
  public handleCORS(request: Request): Response | null {
    const origin = request.headers.get('Origin');
    const method = request.method;

    // Handle preflight requests
    if (method === 'OPTIONS') {
      return this.handlePreflight(request, origin);
    }

    // For actual requests, just validate origin
    if (origin && !this.isOriginAllowed(origin)) {
      return new Response('CORS: Origin not allowed', {
        status: 403,
        headers: {
          'Content-Type': 'text/plain'
        }
      });
    }

    return null; // Continue with normal processing
  }

  /**
   * Add CORS headers to a response
   */
  public addCORSHeaders(response: Response, request: Request): Response {
    const origin = request.headers.get('Origin');
    const headers = new Headers(response.headers);

    // Add origin header
    if (origin && this.isOriginAllowed(origin)) {
      headers.set('Access-Control-Allow-Origin', origin);
    } else if (this.config.allowedOrigins.includes('*')) {
      headers.set('Access-Control-Allow-Origin', '*');
    }

    // Add credentials header
    if (this.config.credentials) {
      headers.set('Access-Control-Allow-Credentials', 'true');
    }

    // Add exposed headers
    if (this.config.exposedHeaders.length > 0) {
      headers.set('Access-Control-Expose-Headers', this.config.exposedHeaders.join(', '));
    }

    // Add Vary header for proper caching
    const varyHeaders = ['Origin'];
    if (headers.has('Vary')) {
      const existingVary = headers.get('Vary')!;
      varyHeaders.push(...existingVary.split(',').map(h => h.trim()));
    }
    headers.set('Vary', [...new Set(varyHeaders)].join(', '));

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }

  /**
   * Handle preflight OPTIONS requests
   */
  private handlePreflight(request: Request, origin: string | null): Response {
    const requestMethod = request.headers.get('Access-Control-Request-Method');
    const requestHeaders = request.headers.get('Access-Control-Request-Headers');

    // Check if origin is allowed
    if (origin && !this.isOriginAllowed(origin)) {
      return new Response('CORS: Origin not allowed', {
        status: 403,
        headers: {
          'Content-Type': 'text/plain'
        }
      });
    }

    // Check if method is allowed
    if (requestMethod && !this.isMethodAllowed(requestMethod)) {
      return new Response('CORS: Method not allowed', {
        status: 405,
        headers: {
          'Content-Type': 'text/plain'
        }
      });
    }

    // Check if headers are allowed
    if (requestHeaders && !this.areHeadersAllowed(requestHeaders)) {
      return new Response('CORS: Headers not allowed', {
        status: 400,
        headers: {
          'Content-Type': 'text/plain'
        }
      });
    }

    // Build preflight response headers
    const headers: Record<string, string> = {};

    // Origin
    if (origin && this.isOriginAllowed(origin)) {
      headers['Access-Control-Allow-Origin'] = origin;
    } else if (this.config.allowedOrigins.includes('*')) {
      headers['Access-Control-Allow-Origin'] = '*';
    }

    // Methods
    headers['Access-Control-Allow-Methods'] = this.config.allowedMethods.join(', ');

    // Headers
    if (this.config.allowedHeaders.includes('*')) {
      headers['Access-Control-Allow-Headers'] = requestHeaders || '*';
    } else {
      headers['Access-Control-Allow-Headers'] = this.config.allowedHeaders.join(', ');
    }

    // Credentials
    if (this.config.credentials) {
      headers['Access-Control-Allow-Credentials'] = 'true';
    }

    // Max age
    headers['Access-Control-Max-Age'] = this.config.maxAge.toString();

    // Vary header
    headers['Vary'] = 'Origin, Access-Control-Request-Method, Access-Control-Request-Headers';

    return new Response(null, {
      status: this.config.optionsSuccessStatus,
      headers
    });
  }

  /**
   * Check if origin is allowed
   */
  private isOriginAllowed(origin: string): boolean {
    if (this.config.allowedOrigins.includes('*')) {
      return true;
    }

    return this.config.allowedOrigins.some(allowedOrigin => {
      if (allowedOrigin === origin) {
        return true;
      }

      // Support wildcard subdomains (e.g., *.example.com)
      if (allowedOrigin.startsWith('*.')) {
        const domain = allowedOrigin.substring(2);
        return origin.endsWith('.' + domain) || origin === domain;
      }

      return false;
    });
  }

  /**
   * Check if method is allowed
   */
  private isMethodAllowed(method: string): boolean {
    return this.config.allowedMethods.includes(method.toUpperCase());
  }

  /**
   * Check if headers are allowed
   */
  private areHeadersAllowed(requestHeaders: string): boolean {
    if (this.config.allowedHeaders.includes('*')) {
      return true;
    }

    const headers = requestHeaders.split(',').map(h => h.trim().toLowerCase());
    const allowedHeaders = this.config.allowedHeaders.map(h => h.toLowerCase());

    return headers.every(header => allowedHeaders.includes(header));
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<CORSConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  public getConfig(): CORSConfig {
    return { ...this.config };
  }
}

/**
 * Create CORS handler with environment-specific configuration
 */
export function createCORSHandler(environment: 'development' | 'production' | 'custom', customConfig?: Partial<CORSConfig>): CORSHandler {
  let config: CORSConfig;

  switch (environment) {
    case 'development':
      config = DEVELOPMENT_CORS_CONFIG;
      break;
    case 'production':
      config = PRODUCTION_CORS_CONFIG;
      break;
    case 'custom':
      config = { ...DEFAULT_CORS_CONFIG, ...customConfig };
      break;
    default:
      config = DEFAULT_CORS_CONFIG;
  }

  return new CORSHandler(config);
}

/**
 * Simple CORS middleware function
 */
export function corsMiddleware(options?: CORSOptions) {
  const handler = new CORSHandler(options);

  return (request: Request): Response | null => {
    return handler.handleCORS(request);
  };
}

/**
 * Add CORS headers to response
 */
export function addCORSHeaders(response: Response, request: Request, options?: CORSOptions): Response {
  const handler = new CORSHandler(options);
  return handler.addCORSHeaders(response, request);
}

/**
 * Quick CORS response for preflight requests
 */
export function handlePreflightRequest(request: Request, options?: CORSOptions): Response {
  const handler = new CORSHandler(options);
  const corsResponse = handler.handleCORS(request);
  
  if (corsResponse) {
    return corsResponse;
  }

  // Default preflight response
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  });
}

/**
 * Validate CORS configuration
 */
export function validateCORSConfig(config: Partial<CORSConfig>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (config.allowedOrigins) {
    if (!Array.isArray(config.allowedOrigins)) {
      errors.push('allowedOrigins must be an array');
    } else if (config.allowedOrigins.length === 0) {
      errors.push('allowedOrigins cannot be empty');
    }
  }

  if (config.allowedMethods) {
    if (!Array.isArray(config.allowedMethods)) {
      errors.push('allowedMethods must be an array');
    } else {
      const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'];
      const invalidMethods = config.allowedMethods.filter(method => !validMethods.includes(method.toUpperCase()));
      if (invalidMethods.length > 0) {
        errors.push(`Invalid methods: ${invalidMethods.join(', ')}`);
      }
    }
  }

  if (config.maxAge !== undefined) {
    if (typeof config.maxAge !== 'number' || config.maxAge < 0) {
      errors.push('maxAge must be a non-negative number');
    }
  }

  if (config.optionsSuccessStatus !== undefined) {
    if (typeof config.optionsSuccessStatus !== 'number' || config.optionsSuccessStatus < 200 || config.optionsSuccessStatus >= 300) {
      errors.push('optionsSuccessStatus must be a 2xx status code');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get CORS configuration for specific environment
 */
export function getCORSConfigForEnvironment(env?: string): CORSConfig {
  const environment = env || 'development';
  
  switch (environment.toLowerCase()) {
    case 'production':
    case 'prod':
      return PRODUCTION_CORS_CONFIG;
    case 'development':
    case 'dev':
      return DEVELOPMENT_CORS_CONFIG;
    default:
      return DEFAULT_CORS_CONFIG;
  }
}

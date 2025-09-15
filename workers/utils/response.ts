/**
 * ArbitrageX Supreme V3.0 - Response Utility
 * Standardized response handling with consistent formatting and error management
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    timestamp: number;
    requestId?: string;
    version: string;
    processingTime?: number;
  };
  pagination?: {
    page: number;
    limit: number;
    total: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: number;
    requestId?: string;
  };
  success: false;
}

export interface SuccessResponse<T = any> {
  data: T;
  success: true;
  metadata?: {
    timestamp: number;
    requestId?: string;
    version: string;
    processingTime?: number;
  };
}

/**
 * Standard HTTP status codes for API responses
 */
export const HTTP_STATUS = {
  // Success
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  
  // Client Errors
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  
  // Server Errors
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504
} as const;

/**
 * Standard error codes for ArbitrageX API
 */
export const ERROR_CODES = {
  // Authentication & Authorization
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  
  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  INVALID_FORMAT: 'INVALID_FORMAT',
  
  // Rate Limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  
  // Business Logic
  OPPORTUNITY_NOT_FOUND: 'OPPORTUNITY_NOT_FOUND',
  EXECUTION_FAILED: 'EXECUTION_FAILED',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  MARKET_CLOSED: 'MARKET_CLOSED',
  
  // System
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  TIMEOUT: 'TIMEOUT',
  NETWORK_ERROR: 'NETWORK_ERROR'
} as const;

/**
 * Response builder class for creating standardized API responses
 */
export class ResponseBuilder {
  private startTime: number;
  private requestId?: string;
  private version: string;

  constructor(requestId?: string, version: string = '3.0.0') {
    this.startTime = Date.now();
    this.requestId = requestId;
    this.version = version;
  }

  /**
   * Create a success response
   */
  success<T>(data: T, status: number = HTTP_STATUS.OK): Response {
    const response: SuccessResponse<T> = {
      success: true,
      data,
      metadata: {
        timestamp: Date.now(),
        requestId: this.requestId,
        version: this.version,
        processingTime: Date.now() - this.startTime
      }
    };

    return new Response(JSON.stringify(response), {
      status,
      headers: this.getDefaultHeaders()
    });
  }

  /**
   * Create an error response
   */
  error(
    code: string,
    message: string,
    status: number = HTTP_STATUS.INTERNAL_SERVER_ERROR,
    details?: any
  ): Response {
    const response: ErrorResponse = {
      success: false,
      error: {
        code,
        message,
        details,
        timestamp: Date.now(),
        requestId: this.requestId
      }
    };

    return new Response(JSON.stringify(response), {
      status,
      headers: this.getDefaultHeaders()
    });
  }

  /**
   * Create a paginated response
   */
  paginated<T>(
    data: T[],
    page: number,
    limit: number,
    total: number,
    status: number = HTTP_STATUS.OK
  ): Response {
    const hasNext = page * limit < total;
    const hasPrev = page > 1;

    const response: ApiResponse<T[]> = {
      success: true,
      data,
      metadata: {
        timestamp: Date.now(),
        requestId: this.requestId,
        version: this.version,
        processingTime: Date.now() - this.startTime
      },
      pagination: {
        page,
        limit,
        total,
        hasNext,
        hasPrev
      }
    };

    return new Response(JSON.stringify(response), {
      status,
      headers: this.getDefaultHeaders()
    });
  }

  /**
   * Create a no content response
   */
  noContent(): Response {
    return new Response(null, {
      status: HTTP_STATUS.NO_CONTENT,
      headers: this.getDefaultHeaders()
    });
  }

  /**
   * Create a redirect response
   */
  redirect(url: string, permanent: boolean = false): Response {
    return new Response(null, {
      status: permanent ? 301 : 302,
      headers: {
        ...this.getDefaultHeaders(),
        'Location': url
      }
    });
  }

  /**
   * Get default headers for all responses
   */
  private getDefaultHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'X-Response-Time': (Date.now() - this.startTime).toString(),
      'X-Request-ID': this.requestId || 'unknown',
      'X-API-Version': this.version
    };
  }
}

/**
 * Quick response helper functions
 */
export const response = {
  /**
   * Success response
   */
  ok<T>(data: T, requestId?: string): Response {
    return new ResponseBuilder(requestId).success(data);
  },

  /**
   * Created response
   */
  created<T>(data: T, requestId?: string): Response {
    return new ResponseBuilder(requestId).success(data, HTTP_STATUS.CREATED);
  },

  /**
   * No content response
   */
  noContent(requestId?: string): Response {
    return new ResponseBuilder(requestId).noContent();
  },

  /**
   * Bad request error
   */
  badRequest(message: string = 'Bad request', details?: any, requestId?: string): Response {
    return new ResponseBuilder(requestId).error(
      ERROR_CODES.VALIDATION_ERROR,
      message,
      HTTP_STATUS.BAD_REQUEST,
      details
    );
  },

  /**
   * Unauthorized error
   */
  unauthorized(message: string = 'Unauthorized', requestId?: string): Response {
    return new ResponseBuilder(requestId).error(
      ERROR_CODES.INVALID_TOKEN,
      message,
      HTTP_STATUS.UNAUTHORIZED
    );
  },

  /**
   * Forbidden error
   */
  forbidden(message: string = 'Forbidden', requestId?: string): Response {
    return new ResponseBuilder(requestId).error(
      ERROR_CODES.INSUFFICIENT_PERMISSIONS,
      message,
      HTTP_STATUS.FORBIDDEN
    );
  },

  /**
   * Not found error
   */
  notFound(message: string = 'Not found', requestId?: string): Response {
    return new ResponseBuilder(requestId).error(
      ERROR_CODES.OPPORTUNITY_NOT_FOUND,
      message,
      HTTP_STATUS.NOT_FOUND
    );
  },

  /**
   * Rate limit exceeded error
   */
  rateLimited(message: string = 'Rate limit exceeded', retryAfter?: number, requestId?: string): Response {
    const headers: Record<string, string> = {};
    if (retryAfter) {
      headers['Retry-After'] = retryAfter.toString();
    }

    const response = new ResponseBuilder(requestId).error(
      ERROR_CODES.RATE_LIMIT_EXCEEDED,
      message,
      HTTP_STATUS.TOO_MANY_REQUESTS
    );

    // Add retry-after header
    if (retryAfter) {
      const responseHeaders = new Headers(response.headers);
      responseHeaders.set('Retry-After', retryAfter.toString());
      
      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders
      });
    }

    return response;
  },

  /**
   * Internal server error
   */
  internalError(message: string = 'Internal server error', details?: any, requestId?: string): Response {
    return new ResponseBuilder(requestId).error(
      ERROR_CODES.INTERNAL_ERROR,
      message,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      details
    );
  },

  /**
   * Service unavailable error
   */
  serviceUnavailable(message: string = 'Service unavailable', requestId?: string): Response {
    return new ResponseBuilder(requestId).error(
      ERROR_CODES.SERVICE_UNAVAILABLE,
      message,
      HTTP_STATUS.SERVICE_UNAVAILABLE
    );
  },

  /**
   * Paginated response
   */
  paginated<T>(
    data: T[],
    page: number,
    limit: number,
    total: number,
    requestId?: string
  ): Response {
    return new ResponseBuilder(requestId).paginated(data, page, limit, total);
  }
};

/**
 * Extract request ID from request headers
 */
export function getRequestId(request: Request): string {
  return request.headers.get('X-Request-ID') || 
         request.headers.get('x-request-id') || 
         generateRequestId();
}

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Validate response data structure
 */
export function validateResponseData(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (data === null || data === undefined) {
    errors.push('Response data cannot be null or undefined');
  }

  if (typeof data === 'object' && data.constructor === Object) {
    // Check for circular references
    try {
      JSON.stringify(data);
    } catch (error) {
      errors.push('Response data contains circular references');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Format error for consistent error responses
 */
export function formatError(error: Error | string, code?: string): ErrorResponse['error'] {
  const message = typeof error === 'string' ? error : error.message;
  const errorCode = code || ERROR_CODES.INTERNAL_ERROR;

  return {
    code: errorCode,
    message,
    timestamp: Date.now(),
    details: typeof error === 'object' ? {
      name: error.name,
      stack: error.stack
    } : undefined
  };
}

/**
 * Create streaming response for real-time data
 */
export function createStreamingResponse(
  generator: AsyncGenerator<any, void, unknown>,
  requestId?: string
): Response {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of generator) {
          const data = JSON.stringify(chunk) + '\n';
          controller.enqueue(encoder.encode(data));
        }
        controller.close();
      } catch (error) {
        const errorResponse = formatError(error as Error);
        const errorData = JSON.stringify(errorResponse) + '\n';
        controller.enqueue(encoder.encode(errorData));
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Request-ID': requestId || generateRequestId()
    }
  });
}

/**
 * Middleware to add response headers
 */
export function withResponseHeaders(
  response: Response,
  additionalHeaders: Record<string, string> = {}
): Response {
  const headers = new Headers(response.headers);
  
  Object.entries(additionalHeaders).forEach(([key, value]) => {
    headers.set(key, value);
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

/**
 * Convert Response to ApiResponse format
 */
export async function responseToApiResponse<T>(response: Response): Promise<ApiResponse<T>> {
  const data = await response.json();
  
  return {
    success: response.ok,
    data: response.ok ? data : undefined,
    error: !response.ok ? data.error : undefined,
    metadata: {
      timestamp: Date.now(),
      requestId: response.headers.get('X-Request-ID') || undefined,
      version: response.headers.get('X-API-Version') || '3.0.0'
    }
  };
}

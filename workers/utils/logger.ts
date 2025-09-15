/**
 * ArbitrageX Supreme V3.0 - Logging Utilities
 * Structured logging for Cloudflare Workers
 */

export interface LogEntry {
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  message: string;
  requestId?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export async function logRequest(request: Request, env: any): Promise<void> {
  const requestId = crypto.randomUUID();
  const logEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: 'INFO',
    message: 'Incoming request',
    requestId,
    metadata: {
      method: request.method,
      url: request.url,
      userAgent: request.headers.get('User-Agent'),
      cfRay: request.headers.get('CF-Ray'),
      cfCountry: request.headers.get('CF-IPCountry'),
      cfConnectingIP: request.headers.get('CF-Connecting-IP'),
    },
  };

  console.log(JSON.stringify(logEntry));

  // Store in KV for analytics if available
  if (env.ANALYTICS_KV) {
    try {
      const key = `request_log:${requestId}`;
      await env.ANALYTICS_KV.put(key, JSON.stringify(logEntry), {
        expirationTtl: 86400, // 24 hours
      });
    } catch (error) {
      console.error('Failed to store request log:', error);
    }
  }
}

export async function logError(error: Error, request: Request, env: any): Promise<void> {
  const requestId = crypto.randomUUID();
  const logEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: 'ERROR',
    message: error.message,
    requestId,
    metadata: {
      method: request.method,
      url: request.url,
      stack: error.stack,
      cfRay: request.headers.get('CF-Ray'),
      cfCountry: request.headers.get('CF-IPCountry'),
    },
  };

  console.error(JSON.stringify(logEntry));

  // Store in KV for error tracking
  if (env.ERROR_LOGS_KV) {
    try {
      const key = `error_log:${Date.now()}:${requestId}`;
      await env.ERROR_LOGS_KV.put(key, JSON.stringify(logEntry), {
        expirationTtl: 604800, // 7 days
      });
    } catch (kvError) {
      console.error('Failed to store error log:', kvError);
    }
  }
}

export async function logPerformance(
  operation: string,
  duration: number,
  request: Request,
  env: any
): Promise<void> {
  const logEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: 'INFO',
    message: `Performance: ${operation}`,
    metadata: {
      operation,
      duration,
      method: request.method,
      url: request.url,
      cfRay: request.headers.get('CF-Ray'),
    },
  };

  console.log(JSON.stringify(logEntry));

  // Store performance metrics
  if (env.METRICS_KV) {
    try {
      const key = `perf:${operation}:${Date.now()}`;
      await env.METRICS_KV.put(key, JSON.stringify({
        operation,
        duration,
        timestamp: new Date().toISOString(),
      }), {
        expirationTtl: 86400, // 24 hours
      });
    } catch (error) {
      console.error('Failed to store performance log:', error);
    }
  }
}

export function logInfo(message: string, metadata?: Record<string, any>): void {
  const logEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: 'INFO',
    message,
    metadata,
  };
  
  console.log(JSON.stringify(logEntry));
}

export function logWarn(message: string, metadata?: Record<string, any>): void {
  const logEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: 'WARN',
    message,

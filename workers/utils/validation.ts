/**
 * ArbitrageX Supreme V3.0 - Validation Utilities
 * Common validation functions for Cloudflare Workers
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateRequest(request: Request): ValidationResult {
  const contentType = request.headers.get('content-type');
  
  if (request.method === 'POST' || request.method === 'PUT') {
    if (!contentType || !contentType.includes('application/json')) {
      return {
        valid: false,
        error: 'Content-Type must be application/json for POST/PUT requests'
      };
    }
  }
  
  return { valid: true };
}

export function validateApiKey(apiKey: string | null): ValidationResult {
  if (!apiKey) {
    return {
      valid: false,
      error: 'API key is required'
    };
  }
  
  if (apiKey.length < 32) {
    return {
      valid: false,
      error: 'Invalid API key format'
    };
  }
  
  return { valid: true };
}

export function validateChainId(chainId: string | null): ValidationResult {
  if (!chainId) {
    return { valid: true }; // Optional parameter
  }
  
  const chainIdNum = parseInt(chainId);
  if (isNaN(chainIdNum) || chainIdNum <= 0) {
    return {
      valid: false,
      error: 'Invalid chain ID'
    };
  }
  
  // Validate supported chains
  const supportedChains = [1, 137, 56, 43114, 250, 42161, 10]; // ETH, Polygon, BSC, Avalanche, Fantom, Arbitrum, Optimism
  if (!supportedChains.includes(chainIdNum)) {
    return {
      valid: false,
      error: `Unsupported chain ID: ${chainIdNum}`
    };
  }
  
  return { valid: true };
}

export function validateAddress(address: string | null): ValidationResult {
  if (!address) {
    return {
      valid: false,
      error: 'Address is required'
    };
  }
  
  // Basic Ethereum address validation
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return {
      valid: false,
      error: 'Invalid Ethereum address format'
    };
  }
  
  return { valid: true };
}

export function validateAmount(amount: string | null): ValidationResult {
  if (!amount) {
    return {
      valid: false,
      error: 'Amount is required'
    };
  }
  
  const amountNum = parseFloat(amount);
  if (isNaN(amountNum) || amountNum <= 0) {
    return {
      valid: false,
      error: 'Amount must be a positive number'
    };
  }
  
  return { valid: true };
}

export function validatePagination(limit?: string, offset?: string): ValidationResult {
  if (limit) {
    const limitNum = parseInt(limit);
    if (isNaN(limitNum) || limitNum <= 0 || limitNum > 1000) {
      return {
        valid: false,
        error: 'Limit must be between 1 and 1000'
      };
    }
  }
  
  if (offset) {
    const offsetNum = parseInt(offset);
    if (isNaN(offsetNum) || offsetNum < 0) {
      return {
        valid: false,
        error: 'Offset must be a non-negative number'
      };
    }
  }
  
  return { valid: true };
}

export function validateTimeRange(startTime?: string, endTime?: string): ValidationResult {
  if (startTime) {
    const start = new Date(startTime);
    if (isNaN(start.getTime())) {
      return {
        valid: false,
        error: 'Invalid start time format'
      };
    }
  }
  
  if (endTime) {
    const end = new Date(endTime);
    if (isNaN(end.getTime())) {
      return {
        valid: false,
        error: 'Invalid end time format'
      };
    }
  }
  
  if (startTime && endTime) {
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    if (start >= end) {
      return {
        valid: false,
        error: 'Start time must be before end time'
      };
    }
    
    // Limit time range to 30 days
    const maxRange = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
    if (end.getTime() - start.getTime() > maxRange) {
      return {
        valid: false,
        error: 'Time range cannot exceed 30 days'
      };
    }
  }
  
  return { valid: true };
}

export function createErrorResponse(message: string, status: number = 400): Response {
  return new Response(
    JSON.stringify({
      error: message,
      timestamp: new Date().toISOString(),
      status
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
      },
    }
  );
}

export function createSuccessResponse(
  data: any, 
  headers: Record<string, string> = {}, 
  status: number = 200
): Response {
  return new Response(
    JSON.stringify({
      data,
      timestamp: new Date().toISOString(),
      status: 'success'
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
        ...headers,
      },
    }
  );
}

export function handleCORS(request: Request): Response | null {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
        'Access-Control-Max-Age': '86400',
      },
    });
  }
  
  return null;
}

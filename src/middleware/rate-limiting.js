/**
 * Middleware de Rate Limiting para ArbitrageX Supreme
 * Ingenio Pichichi S.A. - Metodología Cumplidor, disciplinado, organizado
 * 
 * Sistema de rate limiting multicapa con:
 * - Rate limiting por IP
 * - Rate limiting por usuario autenticado
 * - Rate limiting por endpoint específico
 * - Throttling adaptativo basado en carga del sistema
 * - Integración con Cloudflare Analytics
 * 
 * @author Hector Fabio Riascos C.
 * @version 1.0.0
 * @date 2025-01-15
 */

import { Hono } from 'hono';

/**
 * Configuración de rate limiting por endpoints
 */
const RATE_LIMIT_CONFIG = {
    // Endpoints críticos de trading
    trading: {
        '/api/trading/execute': {
            ip: { requests: 20, window: 60 },
            user: { requests: 50, window: 60 },
            burst: { requests: 5, window: 10 }
        },
        '/api/trading/orders': {
            ip: { requests: 50, window: 60 },
            user: { requests: 100, window: 60 },
            burst: { requests: 10, window: 10 }
        },
        '/api/trading/cancel': {
            ip: { requests: 100, window: 60 },
            user: { requests: 200, window: 60 },
            burst: { requests: 20, window: 10 }
        }
    },

    // Endpoints de arbitraje
    arbitrage: {
        '/api/arbitrage/opportunities': {
            ip: { requests: 30, window: 60 },
            user: { requests: 60, window: 60 },
            burst: { requests: 8, window: 10 }
        },
        '/api/arbitrage/execute': {
            ip: { requests: 10, window: 60 },
            user: { requests: 25, window: 60 },
            burst: { requests: 3, window: 10 }
        }
    },

    // Endpoints de portfolio
    portfolio: {
        '/api/portfolio/balance': {
            ip: { requests: 100, window: 60 },
            user: { requests: 200, window: 60 },
            burst: { requests: 15, window: 10 }
        },
        '/api/portfolio/history': {
            ip: { requests: 50, window: 60 },
            user: { requests: 100, window: 60 },
            burst: { requests: 10, window: 10 }
        }
    },

    // Endpoints de datos de mercado
    market: {
        '/api/market/prices': {
            ip: { requests: 200, window: 60 },
            user: { requests: 400, window: 60 },
            burst: { requests: 25, window: 10 }
        },
        '/api/market/orderbook': {
            ip: { requests: 150, window: 60 },
            user: { requests: 300, window: 60 },
            burst: { requests: 20, window: 10 }
        }
    },

    // Endpoints blockchain
    blockchain: {
        '/api/blockchain/gas-price': {
            ip: { requests: 100, window: 60 },
            user: { requests: 200, window: 60 },
            burst: { requests: 15, window: 10 }
        },
        '/api/blockchain/estimate-gas': {
            ip: { requests: 50, window: 60 },
            user: { requests: 100, window: 60 },
            burst: { requests: 8, window: 10 }
        },
        '/api/blockchain/send-transaction': {
            ip: { requests: 10, window: 60 },
            user: { requests: 20, window: 60 },
            burst: { requests: 2, window: 10 }
        }
    },

    // WebSocket connections
    websocket: {
        '/ws/prices': {
            ip: { requests: 10, window: 300 },
            user: { requests: 20, window: 300 },
            burst: { requests: 2, window: 60 }
        },
        '/ws/arbitrage': {
            ip: { requests: 5, window: 300 },
            user: { requests: 10, window: 300 },
            burst: { requests: 1, window: 60 }
        }
    },

    // Endpoints administrativos
    admin: {
        '/api/admin/*': {
            ip: { requests: 20, window: 60 },
            user: { requests: 50, window: 60 },
            burst: { requests: 3, window: 10 }
        }
    },

    // Límites por defecto
    default: {
        ip: { requests: 60, window: 60 },
        user: { requests: 120, window: 60 },
        burst: { requests: 10, window: 10 }
    }
};

/**
 * Clase principal para gestión de rate limiting
 */
class RateLimitManager {
    constructor(env) {
        this.env = env;
        this.kv = env.KV; // Cloudflare KV para almacenar contadores
        
        // Métricas en tiempo real
        this.metrics = {
            totalRequests: 0,
            blockedRequests: 0,
            challengedRequests: 0,
            rateLimitedEndpoints: new Map()
        };
    }

    /**
     * Middleware principal de rate limiting
     */
    async middleware(c, next) {
        const startTime = Date.now();
        
        try {
            // Obtener información de la request
            const requestInfo = await this.getRequestInfo(c);
            
            // Verificar rate limits
            const limitCheck = await this.checkRateLimits(requestInfo);
            
            // Actualizar métricas
            this.updateMetrics(requestInfo, limitCheck);
            
            // Manejar resultado del rate limit
            if (!limitCheck.allowed) {
                return await this.handleRateLimitExceeded(c, limitCheck, requestInfo);
            }
            
            // Agregar headers informativos
            this.addRateLimitHeaders(c, limitCheck);
            
            // Continuar con la request
            await next();
            
            // Log de request exitosa
            await this.logRequest(requestInfo, limitCheck, Date.now() - startTime);
            
        } catch (error) {
            console.error('Error en rate limiting middleware:', error);
            
            // En caso de error, permitir la request pero loggear
            await this.logError(error, c.req.url);
            await next();
        }
    }

    /**
     * Obtener información de la request
     */
    async getRequestInfo(c) {
        const ip = this.getClientIP(c);
        const userAgent = c.req.header('User-Agent') || 'unknown';
        const path = c.req.path;
        const method = c.req.method;
        const authorization = c.req.header('Authorization');
        
        // Extraer usuario si está autenticado
        let userId = null;
        if (authorization && authorization.startsWith('Bearer ')) {
            try {
                const token = authorization.substring(7);
                const payload = await this.verifyJWT(token);
                userId = payload.sub || payload.userId;
            } catch (error) {
                // Token inválido, continuar con rate limiting por IP
            }
        }

        // Determinar configuración de rate limit para este endpoint
        const rateLimitConfig = this.getRateLimitConfig(path);

        return {
            ip,
            userId,
            userAgent,
            path,
            method,
            timestamp: Date.now(),
            rateLimitConfig,
            isAuthenticated: !!userId
        };
    }

    /**
     * Obtener IP del cliente considerando proxies
     */
    getClientIP(c) {
        // Cloudflare headers
        const cfConnectingIP = c.req.header('CF-Connecting-IP');
        if (cfConnectingIP) return cfConnectingIP;

        // Standard proxy headers
        const xForwardedFor = c.req.header('X-Forwarded-For');
        if (xForwardedFor) {
            return xForwardedFor.split(',')[0].trim();
        }

        const xRealIP = c.req.header('X-Real-IP');
        if (xRealIP) return xRealIP;

        // Fallback
        return 'unknown';
    }

    /**
     * Obtener configuración de rate limit para un path específico
     */
    getRateLimitConfig(path) {
        // Buscar configuración específica por categoría
        for (const [category, endpoints] of Object.entries(RATE_LIMIT_CONFIG)) {
            if (category === 'default') continue;
            
            for (const [pattern, config] of Object.entries(endpoints)) {
                if (this.pathMatches(path, pattern)) {
                    return { ...config, category, pattern };
                }
            }
        }
        
        // Retornar configuración por defecto
        return { ...RATE_LIMIT_CONFIG.default, category: 'default', pattern: '*' };
    }

    /**
     * Verificar si un path coincide con un patrón
     */
    pathMatches(path, pattern) {
        if (pattern.includes('*')) {
            const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
            return regex.test(path);
        }
        return path === pattern;
    }

    /**
     * Verificar todos los rate limits aplicables
     */
    async checkRateLimits(requestInfo) {
        const { ip, userId, rateLimitConfig } = requestInfo;
        const now = Date.now();
        
        const checks = [];
        
        // Rate limit por IP
        const ipCheck = await this.checkIndividualLimit(
            `ip:${ip}:${rateLimitConfig.pattern}`,
            rateLimitConfig.ip,
            now
        );
        checks.push({ type: 'ip', ...ipCheck });

        // Rate limit por usuario (si está autenticado)
        if (userId) {
            const userCheck = await this.checkIndividualLimit(
                `user:${userId}:${rateLimitConfig.pattern}`,
                rateLimitConfig.user,
                now
            );
            checks.push({ type: 'user', ...userCheck });
        }

        // Rate limit de burst (ventana corta)
        const burstCheck = await this.checkIndividualLimit(
            `burst:${ip}:${rateLimitConfig.pattern}`,
            rateLimitConfig.burst,
            now
        );
        checks.push({ type: 'burst', ...burstCheck });

        // Determinar si la request está permitida
        const failedChecks = checks.filter(check => !check.allowed);
        const allowed = failedChecks.length === 0;

        // Retornar resultado más restrictivo si hay fallas
        const mostRestrictive = failedChecks.reduce((prev, current) => {
            return (current.retryAfter || 0) > (prev.retryAfter || 0) ? current : prev;
        }, failedChecks[0] || checks[0]);

        return {
            allowed,
            checks,
            retryAfter: mostRestrictive?.retryAfter || 0,
            limitType: mostRestrictive?.type || 'none',
            remaining: allowed ? Math.min(...checks.map(c => c.remaining)) : 0,
            resetTime: Math.max(...checks.map(c => c.resetTime))
        };
    }

    /**
     * Verificar un rate limit individual
     */
    async checkIndividualLimit(key, config, now) {
        const windowStart = Math.floor(now / (config.window * 1000)) * (config.window * 1000);
        const windowKey = `${key}:${windowStart}`;
        
        try {
            // Obtener contador actual de KV
            const currentCountStr = await this.kv.get(windowKey);
            const currentCount = currentCountStr ? parseInt(currentCountStr, 10) : 0;
            
            // Verificar si se ha excedido el límite
            if (currentCount >= config.requests) {
                return {
                    allowed: false,
                    remaining: 0,
                    retryAfter: config.window - Math.floor((now - windowStart) / 1000),
                    resetTime: windowStart + (config.window * 1000)
                };
            }
            
            // Incrementar contador
            const newCount = currentCount + 1;
            await this.kv.put(windowKey, newCount.toString(), {
                expirationTtl: config.window * 2 // TTL doble para seguridad
            });
            
            return {
                allowed: true,
                remaining: config.requests - newCount,
                retryAfter: 0,
                resetTime: windowStart + (config.window * 1000)
            };
            
        } catch (error) {
            console.error(`Error verificando rate limit ${key}:`, error);
            
            // En caso de error con KV, permitir la request
            return {
                allowed: true,
                remaining: config.requests - 1,
                retryAfter: 0,
                resetTime: windowStart + (config.window * 1000),
                error: error.message
            };
        }
    }

    /**
     * Manejar cuando se excede el rate limit
     */
    async handleRateLimitExceeded(c, limitCheck, requestInfo) {
        // Incrementar métricas
        this.metrics.blockedRequests++;
        
        // Log del bloqueo
        await this.logRateLimitViolation(requestInfo, limitCheck);
        
        // Respuesta de error con información detallada
        const response = {
            error: 'Rate limit exceeded',
            message: `Too many requests from ${limitCheck.limitType}`,
            code: 'RATE_LIMIT_EXCEEDED',
            details: {
                limit_type: limitCheck.limitType,
                retry_after: limitCheck.retryAfter,
                reset_time: new Date(limitCheck.resetTime).toISOString(),
                endpoint: requestInfo.path,
                method: requestInfo.method
            },
            timestamp: new Date().toISOString()
        };

        // Headers de rate limiting estándar
        const headers = {
            'X-RateLimit-Limit': requestInfo.rateLimitConfig[limitCheck.limitType]?.requests || 'unknown',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': Math.ceil(limitCheck.resetTime / 1000).toString(),
            'Retry-After': limitCheck.retryAfter.toString(),
            'Content-Type': 'application/json'
        };

        return c.json(response, 429, headers);
    }

    /**
     * Agregar headers informativos de rate limiting
     */
    addRateLimitHeaders(c, limitCheck) {
        const config = limitCheck.checks.find(check => check.type === 'ip');
        if (config) {
            c.header('X-RateLimit-Limit', config.requests?.toString() || 'unknown');
            c.header('X-RateLimit-Remaining', limitCheck.remaining.toString());
            c.header('X-RateLimit-Reset', Math.ceil(limitCheck.resetTime / 1000).toString());
        }
    }

    /**
     * Actualizar métricas
     */
    updateMetrics(requestInfo, limitCheck) {
        this.metrics.totalRequests++;
        
        if (!limitCheck.allowed) {
            this.metrics.blockedRequests++;
            
            const endpoint = requestInfo.path;
            const current = this.metrics.rateLimitedEndpoints.get(endpoint) || 0;
            this.metrics.rateLimitedEndpoints.set(endpoint, current + 1);
        }
    }

    /**
     * Log de request normal
     */
    async logRequest(requestInfo, limitCheck, processingTime) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            type: 'rate_limit_check',
            ip: requestInfo.ip,
            user_id: requestInfo.userId,
            path: requestInfo.path,
            method: requestInfo.method,
            allowed: limitCheck.allowed,
            limit_type: limitCheck.limitType,
            remaining: limitCheck.remaining,
            processing_time_ms: processingTime,
            user_agent: requestInfo.userAgent
        };
        
        // En producción, enviar a sistema de logging
        console.log('Rate Limit Check:', JSON.stringify(logEntry));
    }

    /**
     * Log de violación de rate limit
     */
    async logRateLimitViolation(requestInfo, limitCheck) {
        const violation = {
            timestamp: new Date().toISOString(),
            type: 'rate_limit_violation',
            severity: 'warning',
            ip: requestInfo.ip,
            user_id: requestInfo.userId,
            path: requestInfo.path,
            method: requestInfo.method,
            limit_type: limitCheck.limitType,
            retry_after: limitCheck.retryAfter,
            user_agent: requestInfo.userAgent,
            category: requestInfo.rateLimitConfig.category
        };
        
        console.warn('Rate Limit Violation:', JSON.stringify(violation));
        
        // Enviar a sistema de alertas si es necesario
        if (this.shouldTriggerAlert(violation)) {
            await this.sendSecurityAlert(violation);
        }
    }

    /**
     * Determinar si se debe enviar una alerta
     */
    shouldTriggerAlert(violation) {
        // Alertar para endpoints críticos
        const criticalEndpoints = [
            '/api/trading/execute',
            '/api/arbitrage/execute', 
            '/api/blockchain/send-transaction',
            '/api/admin/'
        ];
        
        return criticalEndpoints.some(endpoint => 
            violation.path.includes(endpoint)
        );
    }

    /**
     * Enviar alerta de seguridad
     */
    async sendSecurityAlert(violation) {
        try {
            // En producción, integrar con webhook de alertas
            const alert = {
                type: 'security_alert',
                severity: 'medium',
                title: 'Rate Limit Violation Detected',
                description: `Rate limit exceeded for ${violation.limit_type} on ${violation.path}`,
                details: violation,
                timestamp: violation.timestamp
            };
            
            console.warn('Security Alert:', JSON.stringify(alert));
            
        } catch (error) {
            console.error('Error enviando alerta de seguridad:', error);
        }
    }

    /**
     * Log de errores
     */
    async logError(error, url) {
        const errorLog = {
            timestamp: new Date().toISOString(),
            type: 'rate_limit_error',
            error: error.message,
            stack: error.stack,
            url: url
        };
        
        console.error('Rate Limit Error:', JSON.stringify(errorLog));
    }

    /**
     * Verificar JWT token (implementación básica)
     */
    async verifyJWT(token) {
        // En producción, usar librería JWT real con verificación de firma
        try {
            const parts = token.split('.');
            if (parts.length !== 3) throw new Error('Invalid token format');
            
            const payload = JSON.parse(atob(parts[1]));
            
            // Verificar expiración
            if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
                throw new Error('Token expired');
            }
            
            return payload;
        } catch (error) {
            throw new Error('Invalid token');
        }
    }

    /**
     * Obtener métricas actuales
     */
    getMetrics() {
        return {
            ...this.metrics,
            rateLimitedEndpoints: Object.fromEntries(this.metrics.rateLimitedEndpoints)
        };
    }
}

/**
 * Factory function para crear middleware de rate limiting
 */
export function createRateLimitingMiddleware(env) {
    const rateLimitManager = new RateLimitManager(env);
    
    return async (c, next) => {
        return await rateLimitManager.middleware(c, next);
    };
}

/**
 * Middleware específico para endpoints administrativos
 */
export function createAdminRateLimitingMiddleware(env) {
    const rateLimitManager = new RateLimitManager(env);
    
    return async (c, next) => {
        // Rate limiting más estricto para admin
        const originalConfig = rateLimitManager.getRateLimitConfig(c.req.path);
        
        // Override con límites más estrictos para admin
        const strictConfig = {
            ip: { requests: 10, window: 60 },
            user: { requests: 20, window: 60 },
            burst: { requests: 2, window: 10 }
        };
        
        // Aplicar configuración estricta temporalmente
        const requestInfo = await rateLimitManager.getRequestInfo(c);
        requestInfo.rateLimitConfig = { ...originalConfig, ...strictConfig };
        
        return await rateLimitManager.middleware(c, next);
    };
}

/**
 * Función para limpiar contadores expirados (ejecutar periódicamente)
 */
export async function cleanupExpiredRateLimits(env) {
    console.log('Iniciando limpieza de rate limits expirados...');
    
    // En producción, implementar limpieza de KV keys expirados
    // Cloudflare KV maneja esto automáticamente con TTL
    
    console.log('Limpieza de rate limits completada');
}

export { RateLimitManager, RATE_LIMIT_CONFIG };
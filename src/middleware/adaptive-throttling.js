/**
 * Sistema de Throttling Adaptativo para ArbitrageX Supreme
 * Ingenio Pichichi S.A. - Metodología Cumplidor, disciplinado, organizado
 * 
 * Throttling dinámico basado en:
 * - Carga del sistema en tiempo real
 * - Latencia de respuesta de APIs externas
 * - Detección de patrones de abuso
 * - Priorización de usuarios premium/autenticados
 * - Adaptive backoff algorithms
 * 
 * @author Hector Fabio Riascos C.
 * @version 1.0.0
 * @date 2025-01-15
 */

/**
 * Configuración de throttling adaptativo
 */
const THROTTLING_CONFIG = {
    // Métricas del sistema
    systemMetrics: {
        // Umbrales de carga del sistema
        cpuThresholds: {
            low: 30,      // < 30% CPU - sin throttling
            medium: 60,   // 30-60% CPU - throttling ligero
            high: 80,     // 60-80% CPU - throttling moderado
            critical: 90  // > 90% CPU - throttling severo
        },
        
        // Umbrales de latencia
        latencyThresholds: {
            excellent: 100,   // < 100ms - sin throttling
            good: 300,        // 100-300ms - throttling ligero
            fair: 800,        // 300-800ms - throttling moderado
            poor: 2000        // > 800ms - throttling severo
        },

        // Umbrales de memoria
        memoryThresholds: {
            low: 50,      // < 50MB - sin throttling
            medium: 100,  // 50-100MB - throttling ligero
            high: 150,    // 100-150MB - throttling moderado
            critical: 200 // > 150MB - throttling severo
        }
    },

    // Configuración de throttling por nivel
    throttlingLevels: {
        none: {
            delayMs: 0,
            multiplier: 1.0,
            maxConcurrent: 1000,
            description: 'Sin throttling - sistema óptimo'
        },
        light: {
            delayMs: 50,
            multiplier: 1.2,
            maxConcurrent: 800,
            description: 'Throttling ligero - carga moderada'
        },
        moderate: {
            delayMs: 150,
            multiplier: 1.5,
            maxConcurrent: 500,
            description: 'Throttling moderado - alta carga'
        },
        heavy: {
            delayMs: 300,
            multiplier: 2.0,
            maxConcurrent: 200,
            description: 'Throttling severo - carga crítica'
        },
        emergency: {
            delayMs: 1000,
            multiplier: 5.0,
            maxConcurrent: 50,
            description: 'Modo emergencia - sobrecarga del sistema'
        }
    },

    // Prioridades de usuarios
    userPriorities: {
        anonymous: {
            priority: 1,
            throttleMultiplier: 1.0,
            maxConcurrent: 10
        },
        authenticated: {
            priority: 2,
            throttleMultiplier: 0.8,
            maxConcurrent: 20
        },
        premium: {
            priority: 3,
            throttleMultiplier: 0.5,
            maxConcurrent: 50
        },
        vip: {
            priority: 4,
            throttleMultiplier: 0.2,
            maxConcurrent: 100
        },
        admin: {
            priority: 5,
            throttleMultiplier: 0.1,
            maxConcurrent: 200
        }
    },

    // Configuración de detección de patrones
    patternDetection: {
        // Detección de burst requests
        burstDetection: {
            windowMs: 10000,  // 10 segundos
            threshold: 50,    // Más de 50 requests en 10s = burst
            penaltyMs: 30000  // Penalización de 30s
        },
        
        // Detección de scraping
        scrapingDetection: {
            sequentialThreshold: 20,  // 20 requests secuenciales = sospechoso
            patternWindow: 60000,     // Ventana de 1 minuto
            penaltyMs: 300000        // Penalización de 5 minutos
        }
    }
};

/**
 * Clase principal para throttling adaptativo
 */
class AdaptiveThrottlingManager {
    constructor(env) {
        this.env = env;
        this.kv = env.KV;
        
        // Métricas del sistema en tiempo real
        this.systemMetrics = {
            currentCpu: 0,
            currentMemory: 0,
            averageLatency: 0,
            activeConnections: 0,
            requestsPerSecond: 0,
            errorRate: 0
        };
        
        // Contadores para métricas
        this.counters = {
            requestsInWindow: 0,
            errorsInWindow: 0,
            windowStart: Date.now()
        };
        
        // Cache de throttling decisions
        this.throttleCache = new Map();
        
        // Estado de emergencia
        this.emergencyMode = false;
        this.emergencyStartTime = null;
        
        // Inicializar métricas
        this.initializeMetrics();
    }

    /**
     * Inicializar métricas del sistema
     */
    initializeMetrics() {
        // Simular métricas iniciales (en producción obtener del sistema real)
        this.systemMetrics = {
            currentCpu: 15,
            currentMemory: 30,
            averageLatency: 120,
            activeConnections: 0,
            requestsPerSecond: 0,
            errorRate: 0.01
        };
    }

    /**
     * Middleware principal de throttling adaptativo
     */
    async middleware(c, next) {
        const startTime = Date.now();
        
        try {
            // Actualizar métricas del sistema
            await this.updateSystemMetrics();
            
            // Obtener información del usuario/request
            const requestInfo = await this.getRequestInfo(c);
            
            // Determinar nivel de throttling necesario
            const throttlingDecision = await this.calculateThrottling(requestInfo);
            
            // Verificar si se debe aplicar throttling
            if (throttlingDecision.shouldThrottle) {
                const throttleResult = await this.applyThrottling(c, throttlingDecision, requestInfo);
                if (throttleResult.blocked) {
                    return throttleResult.response;
                }
            }
            
            // Incrementar contador de conexiones activas
            this.systemMetrics.activeConnections++;
            
            try {
                // Ejecutar request con monitoreo
                await next();
                
                // Request exitosa - actualizar métricas positivas
                this.updateSuccessMetrics(startTime);
                
            } catch (error) {
                // Request con error - actualizar métricas de error
                this.updateErrorMetrics(error);
                throw error;
                
            } finally {
                // Decrementar conexiones activas
                this.systemMetrics.activeConnections--;
            }
            
        } catch (error) {
            console.error('Error en adaptive throttling middleware:', error);
            // En caso de error, continuar sin throttling
            await next();
        }
    }

    /**
     * Obtener información de la request y usuario
     */
    async getRequestInfo(c) {
        const ip = this.getClientIP(c);
        const path = c.req.path;
        const method = c.req.method;
        const userAgent = c.req.header('User-Agent') || 'unknown';
        
        // Determinar prioridad del usuario
        const userPriority = await this.getUserPriority(c);
        
        // Obtener historial de comportamiento
        const behaviorHistory = await this.getUserBehaviorHistory(ip);
        
        return {
            ip,
            path,
            method,
            userAgent,
            userPriority,
            behaviorHistory,
            timestamp: Date.now(),
            isWebSocket: this.isWebSocketRequest(c),
            isCriticalEndpoint: this.isCriticalEndpoint(path)
        };
    }

    /**
     * Obtener IP del cliente
     */
    getClientIP(c) {
        return c.req.header('CF-Connecting-IP') || 
               c.req.header('X-Forwarded-For')?.split(',')[0].trim() ||
               c.req.header('X-Real-IP') ||
               'unknown';
    }

    /**
     * Determinar prioridad del usuario
     */
    async getUserPriority(c) {
        const authorization = c.req.header('Authorization');
        
        if (!authorization) {
            return THROTTLING_CONFIG.userPriorities.anonymous;
        }

        try {
            // Verificar JWT y extraer claims
            const token = authorization.replace('Bearer ', '');
            const payload = await this.verifyJWT(token);
            
            // Determinar nivel basado en claims
            if (payload.role === 'admin') {
                return THROTTLING_CONFIG.userPriorities.admin;
            } else if (payload.subscription === 'vip') {
                return THROTTLING_CONFIG.userPriorities.vip;
            } else if (payload.subscription === 'premium') {
                return THROTTLING_CONFIG.userPriorities.premium;
            } else {
                return THROTTLING_CONFIG.userPriorities.authenticated;
            }
            
        } catch (error) {
            return THROTTLING_CONFIG.userPriorities.anonymous;
        }
    }

    /**
     * Obtener historial de comportamiento del usuario
     */
    async getUserBehaviorHistory(ip) {
        try {
            const historyKey = `behavior:${ip}`;
            const historyData = await this.kv.get(historyKey);
            
            if (historyData) {
                return JSON.parse(historyData);
            }
            
            // Historial por defecto para usuarios nuevos
            return {
                requestCount: 0,
                errorCount: 0,
                lastRequest: 0,
                penalties: 0,
                trustScore: 1.0,
                patterns: {
                    burstRequests: 0,
                    sequentialRequests: 0,
                    suspiciousActivity: false
                }
            };
            
        } catch (error) {
            console.error('Error obteniendo historial de comportamiento:', error);
            return { trustScore: 0.5, patterns: {} };
        }
    }

    /**
     * Verificar si es una request WebSocket
     */
    isWebSocketRequest(c) {
        const upgrade = c.req.header('Upgrade');
        return upgrade && upgrade.toLowerCase() === 'websocket';
    }

    /**
     * Verificar si es un endpoint crítico
     */
    isCriticalEndpoint(path) {
        const criticalPatterns = [
            '/api/trading/execute',
            '/api/arbitrage/execute',
            '/api/blockchain/send-transaction',
            '/api/admin/'
        ];
        
        return criticalPatterns.some(pattern => path.includes(pattern));
    }

    /**
     * Actualizar métricas del sistema
     */
    async updateSystemMetrics() {
        const now = Date.now();
        
        // Calcular requests per second
        if (now - this.counters.windowStart > 1000) {
            this.systemMetrics.requestsPerSecond = this.counters.requestsInWindow;
            this.systemMetrics.errorRate = this.counters.errorsInWindow / Math.max(this.counters.requestsInWindow, 1);
            
            // Reset counters
            this.counters.requestsInWindow = 0;
            this.counters.errorsInWindow = 0;
            this.counters.windowStart = now;
        }
        
        // Simular métricas del sistema (en producción obtener del sistema real)
        // Estas métricas deberían venir del runtime de Cloudflare Workers
        this.systemMetrics.currentCpu = Math.min(90, this.systemMetrics.currentCpu + (Math.random() - 0.5) * 5);
        this.systemMetrics.currentMemory = Math.min(200, this.systemMetrics.currentMemory + (Math.random() - 0.5) * 2);
        
        // Detectar modo de emergencia
        await this.checkEmergencyConditions();
    }

    /**
     * Verificar condiciones de emergencia
     */
    async checkEmergencyConditions() {
        const { cpuThresholds, latencyThresholds } = THROTTLING_CONFIG.systemMetrics;
        
        const isEmergency = 
            this.systemMetrics.currentCpu > cpuThresholds.critical ||
            this.systemMetrics.averageLatency > latencyThresholds.poor * 2 ||
            this.systemMetrics.errorRate > 0.1 ||
            this.systemMetrics.requestsPerSecond > 1000;
        
        if (isEmergency && !this.emergencyMode) {
            this.emergencyMode = true;
            this.emergencyStartTime = Date.now();
            console.warn('⚠️ MODO EMERGENCIA ACTIVADO - Sistema bajo alta carga');
            
        } else if (!isEmergency && this.emergencyMode) {
            // Salir del modo emergencia después de 30 segundos de condiciones normales
            if (Date.now() - this.emergencyStartTime > 30000) {
                this.emergencyMode = false;
                this.emergencyStartTime = null;
                console.log('✅ Modo emergencia desactivado - Sistema estabilizado');
            }
        }
    }

    /**
     * Calcular nivel de throttling necesario
     */
    async calculateThrottling(requestInfo) {
        // Si está en modo emergencia, throttling máximo para todos excepto admin
        if (this.emergencyMode && requestInfo.userPriority.priority < 5) {
            return {
                shouldThrottle: true,
                level: 'emergency',
                reason: 'emergency_mode',
                config: THROTTLING_CONFIG.throttlingLevels.emergency
            };
        }

        // Calcular score basado en métricas del sistema
        const systemScore = this.calculateSystemScore();
        
        // Calcular score basado en comportamiento del usuario
        const behaviorScore = this.calculateBehaviorScore(requestInfo.behaviorHistory);
        
        // Calcular score basado en endpoint criticality
        const endpointScore = requestInfo.isCriticalEndpoint ? 0.8 : 1.0;
        
        // Score combinado (0.0 = throttling máximo, 1.0 = sin throttling)
        const combinedScore = systemScore * behaviorScore * endpointScore * requestInfo.userPriority.throttleMultiplier;
        
        // Determinar nivel de throttling
        let throttlingLevel;
        if (combinedScore > 0.8) {
            throttlingLevel = 'none';
        } else if (combinedScore > 0.6) {
            throttlingLevel = 'light';
        } else if (combinedScore > 0.4) {
            throttlingLevel = 'moderate';
        } else if (combinedScore > 0.2) {
            throttlingLevel = 'heavy';
        } else {
            throttlingLevel = 'emergency';
        }

        return {
            shouldThrottle: throttlingLevel !== 'none',
            level: throttlingLevel,
            score: combinedScore,
            config: THROTTLING_CONFIG.throttlingLevels[throttlingLevel],
            factors: {
                systemScore,
                behaviorScore,
                endpointScore,
                userPriority: requestInfo.userPriority.priority
            }
        };
    }

    /**
     * Calcular score del sistema (0.0 = sobrecargado, 1.0 = óptimo)
     */
    calculateSystemScore() {
        const { cpuThresholds, latencyThresholds, memoryThresholds } = THROTTLING_CONFIG.systemMetrics;
        
        // Score de CPU
        let cpuScore = 1.0;
        if (this.systemMetrics.currentCpu > cpuThresholds.critical) {
            cpuScore = 0.1;
        } else if (this.systemMetrics.currentCpu > cpuThresholds.high) {
            cpuScore = 0.3;
        } else if (this.systemMetrics.currentCpu > cpuThresholds.medium) {
            cpuScore = 0.6;
        } else if (this.systemMetrics.currentCpu > cpuThresholds.low) {
            cpuScore = 0.8;
        }

        // Score de latencia
        let latencyScore = 1.0;
        if (this.systemMetrics.averageLatency > latencyThresholds.poor) {
            latencyScore = 0.1;
        } else if (this.systemMetrics.averageLatency > latencyThresholds.fair) {
            latencyScore = 0.3;
        } else if (this.systemMetrics.averageLatency > latencyThresholds.good) {
            latencyScore = 0.6;
        } else if (this.systemMetrics.averageLatency > latencyThresholds.excellent) {
            latencyScore = 0.8;
        }

        // Score de memoria
        let memoryScore = 1.0;
        if (this.systemMetrics.currentMemory > memoryThresholds.critical) {
            memoryScore = 0.2;
        } else if (this.systemMetrics.currentMemory > memoryThresholds.high) {
            memoryScore = 0.4;
        } else if (this.systemMetrics.currentMemory > memoryThresholds.medium) {
            memoryScore = 0.7;
        } else if (this.systemMetrics.currentMemory > memoryThresholds.low) {
            memoryScore = 0.9;
        }

        // Combinar scores (weighted average)
        return (cpuScore * 0.4 + latencyScore * 0.4 + memoryScore * 0.2);
    }

    /**
     * Calcular score de comportamiento (0.0 = sospechoso, 1.0 = confiable)
     */
    calculateBehaviorScore(history) {
        if (!history) return 0.5;
        
        let score = history.trustScore || 1.0;
        
        // Penalizar por errores frecuentes
        const errorRate = history.errorCount / Math.max(history.requestCount, 1);
        if (errorRate > 0.1) score *= 0.5;
        
        // Penalizar por patrones sospechosos
        if (history.patterns?.suspiciousActivity) score *= 0.2;
        if (history.patterns?.burstRequests > 5) score *= 0.7;
        if (history.patterns?.sequentialRequests > 10) score *= 0.8;
        
        // Penalizar por penalizaciones previas
        if (history.penalties > 3) score *= 0.6;
        
        return Math.max(0.1, score);
    }

    /**
     * Aplicar throttling a la request
     */
    async applyThrottling(c, decision, requestInfo) {
        const { config, level } = decision;
        
        // Verificar límite de conexiones concurrentes
        if (this.systemMetrics.activeConnections >= config.maxConcurrent) {
            return {
                blocked: true,
                response: this.createThrottleResponse(c, {
                    ...decision,
                    reason: 'max_concurrent_exceeded'
                })
            };
        }

        // Aplicar delay si es necesario
        if (config.delayMs > 0) {
            const effectiveDelay = Math.floor(config.delayMs * config.multiplier);
            
            // Agregar jitter para evitar thundering herd
            const jitter = Math.random() * effectiveDelay * 0.2;
            const finalDelay = effectiveDelay + jitter;
            
            console.log(`⏱️ Aplicando throttling ${level}: ${finalDelay}ms delay`);
            
            // Simular delay (en Workers usar setTimeout simulado)
            await this.delay(finalDelay);
        }

        // Actualizar historial de comportamiento
        await this.updateBehaviorHistory(requestInfo.ip, decision);
        
        // Log de throttling aplicado
        await this.logThrottlingAction(requestInfo, decision);
        
        return { blocked: false };
    }

    /**
     * Crear respuesta de throttling
     */
    createThrottleResponse(c, decision) {
        const response = {
            error: 'Service temporarily throttled',
            message: decision.config.description,
            code: 'SERVICE_THROTTLED',
            details: {
                reason: decision.reason,
                level: decision.level,
                score: decision.score,
                retry_after_ms: decision.config.delayMs,
                factors: decision.factors
            },
            timestamp: new Date().toISOString()
        };

        const headers = {
            'X-Throttling-Level': decision.level,
            'X-Throttling-Score': decision.score?.toFixed(2) || '0.00',
            'X-System-Load': this.systemMetrics.currentCpu?.toFixed(1) || '0.0',
            'Retry-After': Math.ceil(decision.config.delayMs / 1000).toString(),
            'Content-Type': 'application/json'
        };

        return c.json(response, 503, headers);
    }

    /**
     * Simular delay (para Cloudflare Workers)
     */
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Actualizar historial de comportamiento
     */
    async updateBehaviorHistory(ip, decision) {
        try {
            const historyKey = `behavior:${ip}`;
            const history = await this.getUserBehaviorHistory(ip);
            
            // Actualizar contadores
            history.requestCount = (history.requestCount || 0) + 1;
            history.lastRequest = Date.now();
            
            // Actualizar trust score basado en throttling
            if (decision.level === 'none') {
                history.trustScore = Math.min(1.0, (history.trustScore || 0.5) + 0.01);
            } else {
                history.trustScore = Math.max(0.1, (history.trustScore || 0.5) - 0.05);
                history.penalties = (history.penalties || 0) + 1;
            }
            
            // Detectar patrones de burst
            await this.detectBurstPattern(history, ip);
            
            // Guardar historial actualizado
            await this.kv.put(historyKey, JSON.stringify(history), {
                expirationTtl: 86400 // 24 horas
            });
            
        } catch (error) {
            console.error('Error actualizando historial de comportamiento:', error);
        }
    }

    /**
     * Detectar patrones de burst requests
     */
    async detectBurstPattern(history, ip) {
        const now = Date.now();
        const burstWindow = THROTTLING_CONFIG.patternDetection.burstDetection.windowMs;
        
        // Obtener requests recientes
        const recentRequestsKey = `recent:${ip}`;
        let recentRequests = [];
        
        try {
            const recentData = await this.kv.get(recentRequestsKey);
            if (recentData) {
                recentRequests = JSON.parse(recentData);
            }
        } catch (error) {
            // Ignorar errores de parsing
        }
        
        // Agregar request actual
        recentRequests.push(now);
        
        // Filtrar requests dentro de la ventana
        recentRequests = recentRequests.filter(timestamp => now - timestamp < burstWindow);
        
        // Detectar burst
        if (recentRequests.length > THROTTLING_CONFIG.patternDetection.burstDetection.threshold) {
            history.patterns = history.patterns || {};
            history.patterns.burstRequests = (history.patterns.burstRequests || 0) + 1;
            history.patterns.suspiciousActivity = true;
            
            console.warn(`⚠️ Burst pattern detectado para IP ${ip}: ${recentRequests.length} requests en ${burstWindow}ms`);
        }
        
        // Guardar requests recientes
        await this.kv.put(recentRequestsKey, JSON.stringify(recentRequests), {
            expirationTtl: Math.ceil(burstWindow / 1000) * 2
        });
    }

    /**
     * Log de acción de throttling
     */
    async logThrottlingAction(requestInfo, decision) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            type: 'adaptive_throttling',
            ip: requestInfo.ip,
            path: requestInfo.path,
            method: requestInfo.method,
            throttling_level: decision.level,
            throttling_score: decision.score,
            delay_ms: decision.config.delayMs,
            user_priority: requestInfo.userPriority.priority,
            system_metrics: {
                cpu: this.systemMetrics.currentCpu,
                memory: this.systemMetrics.currentMemory,
                latency: this.systemMetrics.averageLatency,
                active_connections: this.systemMetrics.activeConnections
            },
            emergency_mode: this.emergencyMode
        };
        
        console.log('Adaptive Throttling:', JSON.stringify(logEntry));
    }

    /**
     * Actualizar métricas de éxito
     */
    updateSuccessMetrics(startTime) {
        const processingTime = Date.now() - startTime;
        
        // Actualizar latencia promedio
        this.systemMetrics.averageLatency = 
            (this.systemMetrics.averageLatency * 0.9) + (processingTime * 0.1);
        
        this.counters.requestsInWindow++;
    }

    /**
     * Actualizar métricas de error
     */
    updateErrorMetrics(error) {
        this.counters.errorsInWindow++;
        this.counters.requestsInWindow++;
        
        console.error('Request error for throttling metrics:', error);
    }

    /**
     * Verificar JWT (implementación básica)
     */
    async verifyJWT(token) {
        try {
            const parts = token.split('.');
            if (parts.length !== 3) throw new Error('Invalid token format');
            
            const payload = JSON.parse(atob(parts[1]));
            
            if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
                throw new Error('Token expired');
            }
            
            return payload;
        } catch (error) {
            throw new Error('Invalid token');
        }
    }

    /**
     * Obtener métricas actuales del sistema
     */
    getMetrics() {
        return {
            system: { ...this.systemMetrics },
            throttling: {
                emergency_mode: this.emergencyMode,
                emergency_duration_ms: this.emergencyStartTime ? Date.now() - this.emergencyStartTime : 0
            },
            counters: { ...this.counters }
        };
    }
}

/**
 * Factory function para crear middleware de throttling adaptativo
 */
export function createAdaptiveThrottlingMiddleware(env) {
    const throttlingManager = new AdaptiveThrottlingManager(env);
    
    return async (c, next) => {
        return await throttlingManager.middleware(c, next);
    };
}

/**
 * Endpoint para obtener métricas de throttling
 */
export async function getThrottlingMetrics(env) {
    const throttlingManager = new AdaptiveThrottlingManager(env);
    return throttlingManager.getMetrics();
}

export { AdaptiveThrottlingManager, THROTTLING_CONFIG };
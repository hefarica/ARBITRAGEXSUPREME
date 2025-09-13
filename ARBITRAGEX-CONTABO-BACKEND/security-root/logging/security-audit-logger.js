/**
 * Sistema de Logging de Seguridad y Auditoría para ArbitrageX Supreme
 * Ingenio Pichichi S.A. - Metodología Cumplidor, disciplinado, organizado
 * 
 * Sistema comprehensive de logging que incluye:
 * - Auditoría de acciones críticas
 * - Logging de eventos de seguridad
 * - Integración con Cloudflare Analytics
 * - Detección de anomalías en tiempo real
 * - Agregación y análisis de logs
 * - Alertas automáticas por eventos críticos
 * 
 * @author Hector Fabio Riascos C.
 * @version 1.0.0
 * @date 2025-01-15
 */

/**
 * Configuración del sistema de logging de seguridad
 */
const SECURITY_LOGGING_CONFIG = {
    // Configuración general
    general: {
        enabled: true,
        logLevel: 'info',           // debug, info, warn, error, critical
        maxLogSize: 10485760,       // 10MB por archivo de log
        maxLogFiles: 100,           // Máximo 100 archivos de log
        compressionEnabled: true,    // Comprimir logs antiguos
        retentionDays: 90           // Retener logs por 90 días
    },

    // Categorías de eventos a loggear
    eventCategories: {
        authentication: {
            enabled: true,
            priority: 'high',
            events: [
                'login_attempt',
                'login_success', 
                'login_failure',
                'logout',
                'token_refresh',
                'token_revocation',
                'password_change',
                'account_lockout'
            ]
        },
        
        authorization: {
            enabled: true,
            priority: 'high',
            events: [
                'permission_granted',
                'permission_denied',
                'role_change',
                'privilege_escalation',
                'unauthorized_access_attempt'
            ]
        },

        trading: {
            enabled: true,
            priority: 'critical',
            events: [
                'order_placed',
                'order_executed',
                'order_cancelled',
                'arbitrage_executed',
                'suspicious_trading_pattern',
                'large_order_alert',
                'price_manipulation_detected'
            ]
        },

        blockchain: {
            enabled: true,
            priority: 'critical',
            events: [
                'transaction_submitted',
                'transaction_confirmed',
                'transaction_failed',
                'wallet_connected',
                'wallet_disconnected',
                'suspicious_transaction',
                'gas_price_manipulation'
            ]
        },

        security: {
            enabled: true,
            priority: 'critical',
            events: [
                'attack_attempt',
                'rate_limit_exceeded',
                'sql_injection_attempt',
                'xss_attempt',
                'ddos_detected',
                'firewall_block',
                'anomaly_detected',
                'security_configuration_change'
            ]
        },

        system: {
            enabled: true,
            priority: 'medium',
            events: [
                'application_start',
                'application_stop',
                'configuration_change',
                'backup_created',
                'backup_restored',
                'maintenance_mode',
                'performance_degradation'
            ]
        },

        compliance: {
            enabled: true,
            priority: 'high',
            events: [
                'data_access',
                'data_modification',
                'data_deletion',
                'export_request',
                'privacy_policy_acceptance',
                'gdpr_request',
                'compliance_violation'
            ]
        }
    },

    // Configuración de Cloudflare Analytics
    cloudflareAnalytics: {
        enabled: true,
        
        // Métricas personalizadas
        customMetrics: [
            'security_events_per_minute',
            'failed_login_attempts',
            'suspicious_activities',
            'api_error_rate',
            'trading_volume',
            'blockchain_transaction_count'
        ],

        // Dimensiones para análisis
        dimensions: [
            'event_type',
            'severity_level',
            'user_role',
            'client_ip',
            'user_agent',
            'country_code',
            'endpoint_path',
            'response_status'
        ],

        // Configuración de agregación
        aggregation: {
            interval: 60,           // Agregar cada 60 segundos
            retention: 2592000,     // Retener por 30 días
            batch_size: 100         // Enviar en lotes de 100 eventos
        }
    },

    // Configuración de alertas
    alerting: {
        enabled: true,
        
        // Umbrales para alertas automáticas
        thresholds: {
            failed_logins_per_minute: 10,
            attack_attempts_per_minute: 5,
            error_rate_percentage: 5,
            api_response_time_ms: 5000,
            concurrent_suspicious_activities: 3
        },

        // Canales de notificación
        channels: {
            webhook: {
                enabled: true,
                url: '/api/security/alert-webhook',
                timeout: 5000
            },
            email: {
                enabled: false, // Configurar en producción
                recipients: ['security@ingeniopichichi.com']
            }
        }
    },

    // Configuración de anonimización
    anonymization: {
        enabled: true,
        
        // Campos a anonimizar
        fieldsToAnonymize: [
            'email',
            'wallet_address',
            'ip_address',
            'session_id'
        ],
        
        // Métodos de anonimización
        methods: {
            hashing: 'sha256',
            masking: '*',
            truncation: true
        }
    }
};

/**
 * Clase principal para logging de seguridad
 */
class SecurityAuditLogger {
    constructor(env) {
        this.env = env;
        this.kv = env.KV;
        this.config = SECURITY_LOGGING_CONFIG;
        
        // Buffer para eventos pendientes
        this.eventBuffer = [];
        this.bufferFlushInterval = 10000; // Flush cada 10 segundos
        
        // Contadores de eventos
        this.eventCounters = new Map();
        
        // Cache de configuración
        this.configCache = new Map();
        
        // Inicializar sistema
        this.initialize();
    }

    /**
     * Inicializar el sistema de logging
     */
    async initialize() {
        // Configurar flush automático del buffer
        if (typeof setInterval !== 'undefined') {
            setInterval(() => {
                this.flushEventBuffer();
            }, this.bufferFlushInterval);
        }
        
        // Log de inicialización
        await this.logEvent('system', 'application_start', {
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            environment: this.env.ENVIRONMENT || 'production'
        });
    }

    /**
     * Método principal para loggear eventos
     */
    async logEvent(category, eventType, eventData, context = {}) {
        try {
            // Verificar si la categoría está habilitada
            if (!this.isEventEnabled(category, eventType)) {
                return;
            }

            // Crear evento de auditoría
            const auditEvent = await this.createAuditEvent(category, eventType, eventData, context);
            
            // Agregar al buffer
            this.eventBuffer.push(auditEvent);
            
            // Actualizar contadores
            this.updateEventCounters(category, eventType);
            
            // Log inmediato para eventos críticos
            if (auditEvent.priority === 'critical') {
                await this.handleCriticalEvent(auditEvent);
            }
            
            // Flush del buffer si está lleno
            if (this.eventBuffer.length >= this.config.cloudflareAnalytics.aggregation.batch_size) {
                await this.flushEventBuffer();
            }
            
            // Verificar umbrales de alerta
            await this.checkAlertThresholds(category, eventType, auditEvent);
            
        } catch (error) {
            console.error('Error logging security event:', error);
            // No fallar la operación principal por errores de logging
        }
    }

    /**
     * Crear evento de auditoría estructurado
     */
    async createAuditEvent(category, eventType, eventData, context) {
        const timestamp = new Date().toISOString();
        const eventId = this.generateEventId();
        
        // Obtener prioridad del evento
        const priority = this.getEventPriority(category, eventType);
        
        // Anonymizar datos sensibles
        const anonymizedData = await this.anonymizeData(eventData);
        
        // Crear evento base
        const auditEvent = {
            id: eventId,
            timestamp: timestamp,
            category: category,
            event_type: eventType,
            priority: priority,
            data: anonymizedData,
            
            // Contexto de la request
            context: {
                ip_address: await this.anonymizeField(context.ip || 'unknown', 'ip_address'),
                user_agent: context.userAgent || 'unknown',
                user_id: await this.anonymizeField(context.userId, 'user_id'),
                session_id: await this.anonymizeField(context.sessionId, 'session_id'),
                endpoint: context.endpoint || 'unknown',
                method: context.method || 'unknown',
                response_status: context.responseStatus || 0,
                response_time_ms: context.responseTime || 0
            },
            
            // Metadatos del sistema
            system: {
                version: '1.0.0',
                environment: this.env.ENVIRONMENT || 'production',
                server_id: this.env.SERVER_ID || 'unknown',
                deployment_id: this.env.CF_DEPLOYMENT_ID || 'unknown'
            },
            
            // Hash de integridad
            integrity_hash: null // Se calculará después
        };
        
        // Calcular hash de integridad
        auditEvent.integrity_hash = await this.calculateIntegrityHash(auditEvent);
        
        return auditEvent;
    }

    /**
     * Verificar si un evento está habilitado para logging
     */
    isEventEnabled(category, eventType) {
        const categoryConfig = this.config.eventCategories[category];
        
        if (!categoryConfig || !categoryConfig.enabled) {
            return false;
        }
        
        return categoryConfig.events.includes(eventType);
    }

    /**
     * Obtener prioridad de un evento
     */
    getEventPriority(category, eventType) {
        const categoryConfig = this.config.eventCategories[category];
        return categoryConfig?.priority || 'medium';
    }

    /**
     * Anonimizar datos sensibles
     */
    async anonymizeData(data) {
        if (!this.config.anonymization.enabled) {
            return data;
        }

        const anonymized = { ...data };
        
        for (const field of this.config.anonymization.fieldsToAnonymize) {
            if (anonymized[field]) {
                anonymized[field] = await this.anonymizeField(anonymized[field], field);
            }
        }
        
        return anonymized;
    }

    /**
     * Anonimizar campo individual
     */
    async anonymizeField(value, fieldType) {
        if (!value || !this.config.anonymization.enabled) {
            return value;
        }

        switch (fieldType) {
            case 'email':
                // Mantener dominio, anonimizar usuario
                const emailParts = value.split('@');
                if (emailParts.length === 2) {
                    const hashedUser = await this.hashValue(emailParts[0]);
                    return `${hashedUser.substring(0, 8)}@${emailParts[1]}`;
                }
                return await this.hashValue(value);
                
            case 'ip_address':
                // Mantener subnet, anonimizar host
                const ipParts = value.split('.');
                if (ipParts.length === 4) {
                    return `${ipParts[0]}.${ipParts[1]}.xxx.xxx`;
                }
                return 'xxx.xxx.xxx.xxx';
                
            case 'wallet_address':
                // Mostrar solo primeros y últimos caracteres
                if (value.length > 10) {
                    return `${value.substring(0, 6)}...${value.substring(value.length - 4)}`;
                }
                return 'xxx...xxx';
                
            default:
                return await this.hashValue(value);
        }
    }

    /**
     * Hash un valor usando SHA-256
     */
    async hashValue(value) {
        // En producción, usar Web Crypto API para hashing real
        // Esta es una implementación simplificada
        const encoder = new TextEncoder();
        const data = encoder.encode(value + 'salt_' + this.env.HASH_SALT);
        
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            const char = data[i];
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        
        return Math.abs(hash).toString(36);
    }

    /**
     * Generar ID único para evento
     */
    generateEventId() {
        return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    }

    /**
     * Calcular hash de integridad
     */
    async calculateIntegrityHash(event) {
        // Crear string deterministico del evento
        const eventCopy = { ...event };
        delete eventCopy.integrity_hash; // Remover el hash para calcularlo
        
        const eventString = JSON.stringify(eventCopy, Object.keys(eventCopy).sort());
        return await this.hashValue(eventString);
    }

    /**
     * Manejar eventos críticos inmediatamente
     */
    async handleCriticalEvent(event) {
        try {
            // Log inmediato a consola
            console.error('CRITICAL SECURITY EVENT:', JSON.stringify(event));
            
            // Almacenar inmediatamente en KV
            const criticalKey = `critical_event:${event.id}`;
            await this.kv.put(criticalKey, JSON.stringify(event), {
                expirationTtl: 86400 * 7 // Retener eventos críticos por 7 días
            });
            
            // Enviar alerta inmediata
            await this.sendImmediateAlert(event);
            
            // Incrementar contador de eventos críticos
            await this.incrementCounter('critical_events_today');
            
        } catch (error) {
            console.error('Error handling critical event:', error);
        }
    }

    /**
     * Flush del buffer de eventos
     */
    async flushEventBuffer() {
        if (this.eventBuffer.length === 0) {
            return;
        }

        try {
            const events = [...this.eventBuffer];
            this.eventBuffer = []; // Limpiar buffer

            // Almacenar eventos en KV
            await this.storeEvents(events);
            
            // Enviar a Cloudflare Analytics
            if (this.config.cloudflareAnalytics.enabled) {
                await this.sendToCloudflareAnalytics(events);
            }
            
            // Log de flush exitoso
            console.log(`Security audit: Flushed ${events.length} events`);
            
        } catch (error) {
            console.error('Error flushing event buffer:', error);
            // Reintroducir eventos al buffer si hay error
            this.eventBuffer.unshift(...events);
        }
    }

    /**
     * Almacenar eventos en KV
     */
    async storeEvents(events) {
        const batch = {};
        
        for (const event of events) {
            const key = `audit_log:${event.timestamp.split('T')[0]}:${event.id}`;
            batch[key] = JSON.stringify(event);
        }
        
        // En producción, usar batch operations de KV
        for (const [key, value] of Object.entries(batch)) {
            await this.kv.put(key, value, {
                expirationTtl: this.config.general.retentionDays * 86400
            });
        }
    }

    /**
     * Enviar eventos a Cloudflare Analytics
     */
    async sendToCloudflareAnalytics(events) {
        try {
            // Preparar métricas para Cloudflare Analytics
            const metrics = this.prepareAnalyticsMetrics(events);
            
            // En producción, usar Cloudflare Analytics API
            // Por ahora, log las métricas
            console.log('Cloudflare Analytics Metrics:', JSON.stringify({
                timestamp: new Date().toISOString(),
                metrics: metrics,
                event_count: events.length
            }));
            
        } catch (error) {
            console.error('Error sending to Cloudflare Analytics:', error);
        }
    }

    /**
     * Preparar métricas para Analytics
     */
    prepareAnalyticsMetrics(events) {
        const metrics = {};
        
        // Contar eventos por categoría
        for (const event of events) {
            const category = event.category;
            metrics[`${category}_events`] = (metrics[`${category}_events`] || 0) + 1;
            
            // Contar por tipo de evento
            const eventType = event.event_type;
            metrics[`${eventType}_count`] = (metrics[`${eventType}_count`] || 0) + 1;
            
            // Contar por prioridad
            const priority = event.priority;
            metrics[`${priority}_priority_events`] = (metrics[`${priority}_priority_events`] || 0) + 1;
        }
        
        return metrics;
    }

    /**
     * Actualizar contadores de eventos
     */
    updateEventCounters(category, eventType) {
        const key = `${category}:${eventType}`;
        this.eventCounters.set(key, (this.eventCounters.get(key) || 0) + 1);
    }

    /**
     * Verificar umbrales de alerta
     */
    async checkAlertThresholds(category, eventType, event) {
        try {
            const now = Date.now();
            const minute = Math.floor(now / 60000) * 60000; // Redondear al minuto
            
            // Verificar umbrales específicos
            await this.checkFailedLoginThreshold(eventType, minute);
            await this.checkAttackAttemptThreshold(eventType, minute);
            await this.checkSuspiciousActivityThreshold(event);
            
        } catch (error) {
            console.error('Error checking alert thresholds:', error);
        }
    }

    /**
     * Verificar umbral de logins fallidos
     */
    async checkFailedLoginThreshold(eventType, minute) {
        if (eventType !== 'login_failure') return;
        
        const key = `failed_logins:${minute}`;
        const currentCount = parseInt(await this.kv.get(key) || '0', 10) + 1;
        
        await this.kv.put(key, currentCount.toString(), { expirationTtl: 300 });
        
        if (currentCount >= this.config.alerting.thresholds.failed_logins_per_minute) {
            await this.sendAlert('failed_logins_threshold', {
                count: currentCount,
                threshold: this.config.alerting.thresholds.failed_logins_per_minute,
                window: 'per_minute'
            });
        }
    }

    /**
     * Verificar umbral de intentos de ataque
     */
    async checkAttackAttemptThreshold(eventType, minute) {
        if (eventType !== 'attack_attempt') return;
        
        const key = `attack_attempts:${minute}`;
        const currentCount = parseInt(await this.kv.get(key) || '0', 10) + 1;
        
        await this.kv.put(key, currentCount.toString(), { expirationTtl: 300 });
        
        if (currentCount >= this.config.alerting.thresholds.attack_attempts_per_minute) {
            await this.sendAlert('attack_attempts_threshold', {
                count: currentCount,
                threshold: this.config.alerting.thresholds.attack_attempts_per_minute,
                window: 'per_minute'
            });
        }
    }

    /**
     * Verificar actividad sospechosa
     */
    async checkSuspiciousActivityThreshold(event) {
        if (event.category !== 'security' && event.priority !== 'critical') return;
        
        const ip = event.context.ip_address;
        const key = `suspicious_activity:${ip}:${Math.floor(Date.now() / 300000)}`;
        const currentCount = parseInt(await this.kv.get(key) || '0', 10) + 1;
        
        await this.kv.put(key, currentCount.toString(), { expirationTtl: 600 });
        
        if (currentCount >= this.config.alerting.thresholds.concurrent_suspicious_activities) {
            await this.sendAlert('suspicious_activity_threshold', {
                ip: ip,
                count: currentCount,
                threshold: this.config.alerting.thresholds.concurrent_suspicious_activities,
                window: '5_minutes'
            });
        }
    }

    /**
     * Enviar alerta
     */
    async sendAlert(alertType, data) {
        if (!this.config.alerting.enabled) return;
        
        const alert = {
            id: this.generateEventId(),
            timestamp: new Date().toISOString(),
            type: alertType,
            severity: 'high',
            data: data,
            source: 'security_audit_logger'
        };
        
        // Log de alerta
        console.warn('SECURITY ALERT:', JSON.stringify(alert));
        
        // Enviar a webhook si está configurado
        if (this.config.alerting.channels.webhook.enabled) {
            await this.sendWebhookAlert(alert);
        }
    }

    /**
     * Enviar alerta inmediata
     */
    async sendImmediateAlert(event) {
        const alert = {
            id: this.generateEventId(),
            timestamp: new Date().toISOString(),
            type: 'critical_security_event',
            severity: 'critical',
            event: event,
            source: 'security_audit_logger'
        };
        
        console.error('IMMEDIATE SECURITY ALERT:', JSON.stringify(alert));
        
        if (this.config.alerting.channels.webhook.enabled) {
            await this.sendWebhookAlert(alert);
        }
    }

    /**
     * Enviar alerta por webhook
     */
    async sendWebhookAlert(alert) {
        try {
            const webhookUrl = this.config.alerting.channels.webhook.url;
            const timeout = this.config.alerting.channels.webhook.timeout;
            
            // En producción, hacer request HTTP real al webhook
            console.log(`Webhook Alert sent to ${webhookUrl}:`, JSON.stringify(alert));
            
        } catch (error) {
            console.error('Error sending webhook alert:', error);
        }
    }

    /**
     * Incrementar contador
     */
    async incrementCounter(counterName) {
        const today = new Date().toISOString().split('T')[0];
        const key = `counter:${counterName}:${today}`;
        
        const current = parseInt(await this.kv.get(key) || '0', 10);
        await this.kv.put(key, (current + 1).toString(), { expirationTtl: 86400 * 2 });
    }

    /**
     * Obtener métricas del sistema
     */
    async getMetrics() {
        return {
            buffer_size: this.eventBuffer.length,
            event_counters: Object.fromEntries(this.eventCounters),
            config_cache_size: this.configCache.size,
            last_flush: new Date().toISOString()
        };
    }

    /**
     * Limpiar recursos
     */
    async cleanup() {
        // Flush final del buffer
        await this.flushEventBuffer();
        
        // Limpiar contadores
        this.eventCounters.clear();
        this.configCache.clear();
        
        console.log('Security audit logger cleanup completed');
    }
}

/**
 * Middleware para logging automático de requests
 */
export function createSecurityLoggingMiddleware(env) {
    const logger = new SecurityAuditLogger(env);
    
    return async (c, next) => {
        const startTime = Date.now();
        
        // Extraer contexto de la request
        const context = {
            ip: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
            userAgent: c.req.header('User-Agent'),
            endpoint: c.req.path,
            method: c.req.method
        };
        
        try {
            await next();
            
            // Log de request exitosa
            context.responseStatus = c.res?.status || 200;
            context.responseTime = Date.now() - startTime;
            
            // Solo loggear si es significativo (no health checks simples)
            if (!context.endpoint.includes('/health') || context.responseStatus !== 200) {
                await logger.logEvent('system', 'api_request', {
                    endpoint: context.endpoint,
                    method: context.method,
                    status: context.responseStatus,
                    response_time_ms: context.responseTime
                }, context);
            }
            
        } catch (error) {
            // Log de error
            context.responseStatus = error.status || 500;
            context.responseTime = Date.now() - startTime;
            
            await logger.logEvent('security', 'api_error', {
                endpoint: context.endpoint,
                method: context.method,
                error: error.message,
                status: context.responseStatus,
                response_time_ms: context.responseTime
            }, context);
            
            throw error;
        }
    };
}

/**
 * Funciones de utilidad para logging específico
 */

// Logging de eventos de autenticación
export async function logAuthEvent(env, eventType, data, context = {}) {
    const logger = new SecurityAuditLogger(env);
    return await logger.logEvent('authentication', eventType, data, context);
}

// Logging de eventos de trading
export async function logTradingEvent(env, eventType, data, context = {}) {
    const logger = new SecurityAuditLogger(env);
    return await logger.logEvent('trading', eventType, data, context);
}

// Logging de eventos de blockchain
export async function logBlockchainEvent(env, eventType, data, context = {}) {
    const logger = new SecurityAuditLogger(env);
    return await logger.logEvent('blockchain', eventType, data, context);
}

// Logging de eventos de seguridad
export async function logSecurityEvent(env, eventType, data, context = {}) {
    const logger = new SecurityAuditLogger(env);
    return await logger.logEvent('security', eventType, data, context);
}

export { SecurityAuditLogger, SECURITY_LOGGING_CONFIG };
/**
 * Configuración de Cloudflare Analytics para ArbitrageX Supreme
 * Ingenio Pichichi S.A. - Metodología Cumplidor, disciplinado, organizado
 * 
 * Integración completa con Cloudflare Analytics Engine para:
 * - Métricas de seguridad en tiempo real
 * - Análisis de patrones de tráfico
 * - Detección de anomalías
 * - Dashboards personalizados
 * - Alertas automatizadas
 * 
 * @author Hector Fabio Riascos C.
 * @version 1.0.0
 * @date 2025-01-15
 */

/**
 * Configuración de Cloudflare Analytics Engine
 */
const CLOUDFLARE_ANALYTICS_CONFIG = {
    // Configuración del dataset principal
    dataset: {
        name: 'arbitragex_security_metrics',
        description: 'Security and audit metrics for ArbitrageX Supreme',
        retention_days: 90,
        
        // Schema del dataset
        schema: {
            // Dimensiones (strings, para agrupación)
            dimensions: [
                'timestamp',
                'event_category',
                'event_type',
                'severity_level',
                'user_role',
                'client_country',
                'endpoint_path',
                'response_status',
                'user_agent_category',
                'attack_type',
                'blockchain_network'
            ],
            
            // Métricas (numbers, para agregación)
            metrics: [
                'event_count',
                'response_time_ms',
                'bytes_transferred',
                'error_count',
                'attack_attempts',
                'failed_authentications',
                'trading_volume',
                'gas_used',
                'active_sessions'
            ]
        }
    },

    // Configuración de métricas personalizadas
    customMetrics: {
        // Métricas de seguridad
        security: {
            'security_events_per_minute': {
                description: 'Total security events per minute',
                calculation: 'sum',
                alert_threshold: 50
            },
            'attack_attempts_per_hour': {
                description: 'Attack attempts detected per hour',
                calculation: 'sum',
                alert_threshold: 10
            },
            'failed_login_rate': {
                description: 'Percentage of failed login attempts',
                calculation: 'percentage',
                alert_threshold: 20
            },
            'suspicious_ip_count': {
                description: 'Number of IPs flagged as suspicious',
                calculation: 'distinct_count',
                alert_threshold: 5
            }
        },

        // Métricas de performance
        performance: {
            'avg_response_time': {
                description: 'Average API response time',
                calculation: 'average',
                alert_threshold: 2000
            },
            'error_rate_percentage': {
                description: 'Percentage of requests resulting in errors',
                calculation: 'percentage',
                alert_threshold: 5
            },
            'throughput_requests_per_second': {
                description: 'Number of requests processed per second',
                calculation: 'rate',
                alert_threshold: null
            }
        },

        // Métricas de negocio
        business: {
            'trading_volume_usd': {
                description: 'Total trading volume in USD',
                calculation: 'sum',
                alert_threshold: null
            },
            'arbitrage_opportunities_found': {
                description: 'Number of arbitrage opportunities detected',
                calculation: 'sum',
                alert_threshold: null
            },
            'active_traders_count': {
                description: 'Number of active traders',
                calculation: 'distinct_count',
                alert_threshold: null
            },
            'blockchain_transactions_count': {
                description: 'Number of blockchain transactions',
                calculation: 'sum',
                alert_threshold: null
            }
        }
    },

    // Configuración de queries predefinidas
    queries: {
        // Seguridad
        'security_dashboard': {
            name: 'Security Events Dashboard',
            query: `
                SELECT 
                    toStartOfInterval(timestamp, INTERVAL 5 MINUTE) as time_bucket,
                    event_type,
                    severity_level,
                    count() as event_count,
                    uniq(client_country) as affected_countries
                FROM arbitragex_security_metrics 
                WHERE timestamp >= now() - INTERVAL 1 DAY
                AND event_category = 'security'
                GROUP BY time_bucket, event_type, severity_level
                ORDER BY time_bucket DESC
            `,
            refresh_interval: 300 // 5 minutos
        },

        'attack_analysis': {
            name: 'Attack Pattern Analysis',
            query: `
                SELECT 
                    attack_type,
                    client_country,
                    endpoint_path,
                    count() as attempt_count,
                    min(timestamp) as first_seen,
                    max(timestamp) as last_seen
                FROM arbitragex_security_metrics 
                WHERE timestamp >= now() - INTERVAL 1 HOUR
                AND event_type = 'attack_attempt'
                GROUP BY attack_type, client_country, endpoint_path
                HAVING attempt_count > 1
                ORDER BY attempt_count DESC
            `,
            refresh_interval: 60 // 1 minuto
        },

        // Performance
        'performance_monitoring': {
            name: 'API Performance Monitoring',
            query: `
                SELECT 
                    toStartOfInterval(timestamp, INTERVAL 1 MINUTE) as time_bucket,
                    endpoint_path,
                    avg(response_time_ms) as avg_response_time,
                    quantile(0.95)(response_time_ms) as p95_response_time,
                    count() as request_count,
                    countIf(response_status >= 400) as error_count
                FROM arbitragex_security_metrics 
                WHERE timestamp >= now() - INTERVAL 1 HOUR
                GROUP BY time_bucket, endpoint_path
                ORDER BY time_bucket DESC, avg_response_time DESC
            `,
            refresh_interval: 60
        },

        // Negocio
        'business_metrics': {
            name: 'Business Metrics Overview',
            query: `
                SELECT 
                    toStartOfInterval(timestamp, INTERVAL 15 MINUTE) as time_bucket,
                    sum(trading_volume) as total_volume,
                    count(DISTINCT user_id) as active_users,
                    sum(arbitrage_opportunities_found) as opportunities,
                    avg(gas_used) as avg_gas_usage
                FROM arbitragex_security_metrics 
                WHERE timestamp >= now() - INTERVAL 6 HOUR
                AND event_category IN ('trading', 'arbitrage', 'blockchain')
                GROUP BY time_bucket
                ORDER BY time_bucket DESC
            `,
            refresh_interval: 900 // 15 minutos
        }
    },

    // Configuración de alertas
    alerts: {
        // Alertas de seguridad críticas
        'critical_security_events': {
            name: 'Critical Security Events Alert',
            condition: `
                SELECT count() as critical_events
                FROM arbitragex_security_metrics 
                WHERE timestamp >= now() - INTERVAL 5 MINUTE
                AND severity_level = 'critical'
                HAVING critical_events > 0
            `,
            notification_channels: ['webhook', 'email'],
            cooldown_minutes: 5
        },

        'mass_attack_detected': {
            name: 'Mass Attack Detection',
            condition: `
                SELECT count() as attack_count
                FROM arbitragex_security_metrics 
                WHERE timestamp >= now() - INTERVAL 10 MINUTE
                AND event_type = 'attack_attempt'
                HAVING attack_count > 20
            `,
            notification_channels: ['webhook'],
            cooldown_minutes: 15
        },

        // Alertas de performance
        'high_error_rate': {
            name: 'High Error Rate Alert',
            condition: `
                SELECT 
                    countIf(response_status >= 400) / count() * 100 as error_rate
                FROM arbitragex_security_metrics 
                WHERE timestamp >= now() - INTERVAL 5 MINUTE
                HAVING error_rate > 10
            `,
            notification_channels: ['webhook'],
            cooldown_minutes: 10
        },

        'slow_response_times': {
            name: 'Slow Response Times Alert',
            condition: `
                SELECT avg(response_time_ms) as avg_time
                FROM arbitragex_security_metrics 
                WHERE timestamp >= now() - INTERVAL 5 MINUTE
                AND event_category = 'api_request'
                HAVING avg_time > 5000
            `,
            notification_channels: ['webhook'],
            cooldown_minutes: 10
        }
    },

    // Configuración de dashboards
    dashboards: {
        'security_overview': {
            name: 'Security Overview Dashboard',
            description: 'Real-time security monitoring for ArbitrageX Supreme',
            panels: [
                {
                    title: 'Security Events Timeline',
                    type: 'timeseries',
                    query: 'security_dashboard',
                    visualization: 'line_chart',
                    refresh_interval: 300
                },
                {
                    title: 'Top Attack Types',
                    type: 'table',
                    query: 'attack_analysis', 
                    visualization: 'data_table',
                    refresh_interval: 60
                },
                {
                    title: 'Geographic Attack Distribution',
                    type: 'map',
                    query: `
                        SELECT client_country, count() as attack_count
                        FROM arbitragex_security_metrics 
                        WHERE timestamp >= now() - INTERVAL 1 DAY
                        AND event_type = 'attack_attempt'
                        GROUP BY client_country
                    `,
                    visualization: 'world_map',
                    refresh_interval: 600
                }
            ]
        },

        'performance_dashboard': {
            name: 'Performance Monitoring Dashboard',
            description: 'API and system performance metrics',
            panels: [
                {
                    title: 'Response Time Trends',
                    type: 'timeseries',
                    query: 'performance_monitoring',
                    visualization: 'area_chart',
                    refresh_interval: 60
                },
                {
                    title: 'Endpoint Performance',
                    type: 'heatmap',
                    query: `
                        SELECT endpoint_path, 
                               toStartOfInterval(timestamp, INTERVAL 5 MINUTE) as time,
                               avg(response_time_ms) as avg_time
                        FROM arbitragex_security_metrics 
                        WHERE timestamp >= now() - INTERVAL 2 HOUR
                        GROUP BY endpoint_path, time
                    `,
                    visualization: 'heatmap',
                    refresh_interval: 300
                }
            ]
        },

        'business_dashboard': {
            name: 'Business Intelligence Dashboard',
            description: 'Trading and arbitrage business metrics',
            panels: [
                {
                    title: 'Trading Volume',
                    type: 'single_stat',
                    query: `
                        SELECT sum(trading_volume) as total_volume
                        FROM arbitragex_security_metrics 
                        WHERE timestamp >= now() - INTERVAL 1 DAY
                    `,
                    visualization: 'big_number',
                    refresh_interval: 900
                },
                {
                    title: 'Active Users',
                    type: 'single_stat',
                    query: `
                        SELECT uniq(user_id) as active_users
                        FROM arbitragex_security_metrics 
                        WHERE timestamp >= now() - INTERVAL 1 HOUR
                    `,
                    visualization: 'big_number',
                    refresh_interval: 300
                },
                {
                    title: 'Arbitrage Success Rate',
                    type: 'gauge',
                    query: `
                        SELECT 
                            countIf(event_type = 'arbitrage_executed') / 
                            countIf(event_type = 'arbitrage_opportunity') * 100 as success_rate
                        FROM arbitragex_security_metrics 
                        WHERE timestamp >= now() - INTERVAL 1 DAY
                        AND event_category = 'arbitrage'
                    `,
                    visualization: 'gauge_chart',
                    refresh_interval: 900
                }
            ]
        }
    }
};

/**
 * Clase para gestionar Cloudflare Analytics
 */
class CloudflareAnalyticsManager {
    constructor(env) {
        this.env = env;
        this.accountId = env.CLOUDFLARE_ACCOUNT_ID;
        this.apiToken = env.CLOUDFLARE_API_TOKEN;
        this.datasetName = CLOUDFLARE_ANALYTICS_CONFIG.dataset.name;
        
        // Buffer para datos pendientes
        this.dataBuffer = [];
        this.maxBufferSize = 1000;
        this.flushInterval = 30000; // 30 segundos
        
        this.initialize();
    }

    /**
     * Inicializar Analytics Manager
     */
    async initialize() {
        // Verificar y crear dataset si no existe
        await this.ensureDatasetExists();
        
        // Configurar flush automático
        if (typeof setInterval !== 'undefined') {
            setInterval(() => {
                this.flushDataBuffer();
            }, this.flushInterval);
        }
    }

    /**
     * Enviar evento a Analytics Engine
     */
    async writeEvent(dimensions, metrics) {
        try {
            const event = {
                timestamp: new Date().toISOString(),
                dimensions: this.sanitizeDimensions(dimensions),
                metrics: this.sanitizeMetrics(metrics)
            };
            
            // Agregar al buffer
            this.dataBuffer.push(event);
            
            // Flush si el buffer está lleno
            if (this.dataBuffer.length >= this.maxBufferSize) {
                await this.flushDataBuffer();
            }
            
        } catch (error) {
            console.error('Error writing event to Analytics:', error);
        }
    }

    /**
     * Sanitizar dimensiones
     */
    sanitizeDimensions(dimensions) {
        const sanitized = {};
        const allowedDimensions = CLOUDFLARE_ANALYTICS_CONFIG.dataset.schema.dimensions;
        
        for (const [key, value] of Object.entries(dimensions)) {
            if (allowedDimensions.includes(key)) {
                sanitized[key] = String(value).substring(0, 255); // Limitar longitud
            }
        }
        
        return sanitized;
    }

    /**
     * Sanitizar métricas
     */
    sanitizeMetrics(metrics) {
        const sanitized = {};
        const allowedMetrics = CLOUDFLARE_ANALYTICS_CONFIG.dataset.schema.metrics;
        
        for (const [key, value] of Object.entries(metrics)) {
            if (allowedMetrics.includes(key)) {
                const numValue = Number(value);
                if (!isNaN(numValue) && isFinite(numValue)) {
                    sanitized[key] = numValue;
                }
            }
        }
        
        return sanitized;
    }

    /**
     * Flush del buffer de datos
     */
    async flushDataBuffer() {
        if (this.dataBuffer.length === 0) return;
        
        try {
            const events = [...this.dataBuffer];
            this.dataBuffer = [];
            
            // Enviar a Cloudflare Analytics Engine
            await this.sendToAnalyticsEngine(events);
            
            console.log(`Analytics: Flushed ${events.length} events to Cloudflare`);
            
        } catch (error) {
            console.error('Error flushing analytics buffer:', error);
            // Reintroducir eventos al buffer si hay error
            this.dataBuffer.unshift(...events);
        }
    }

    /**
     * Enviar eventos a Analytics Engine
     */
    async sendToAnalyticsEngine(events) {
        if (!this.accountId || !this.apiToken) {
            console.warn('Cloudflare Analytics not configured, logging locally');
            console.log('Analytics Events:', JSON.stringify(events));
            return;
        }

        const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/analytics_engine/sql`;
        
        // Preparar datos en formato ClickHouse
        const sqlStatements = events.map(event => {
            const dimensions = Object.entries(event.dimensions)
                .map(([k, v]) => `'${v.replace(/'/g, "''")}'`)
                .join(', ');
                
            const metrics = Object.values(event.metrics).join(', ');
            
            return `INSERT INTO ${this.datasetName} VALUES ('${event.timestamp}', ${dimensions}, ${metrics})`;
        });

        try {
            // En producción, hacer request HTTP real
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiToken}`,
                    'Content-Type': 'application/sql'
                },
                body: sqlStatements.join(';\n')
            });

            if (!response.ok) {
                throw new Error(`Analytics API error: ${response.status}`);
            }

            console.log('Successfully sent events to Cloudflare Analytics');
            
        } catch (error) {
            console.error('Error sending to Analytics Engine:', error);
            throw error;
        }
    }

    /**
     * Ejecutar query en Analytics Engine
     */
    async executeQuery(queryName) {
        const queryConfig = CLOUDFLARE_ANALYTICS_CONFIG.queries[queryName];
        if (!queryConfig) {
            throw new Error(`Query '${queryName}' not found`);
        }

        const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/analytics_engine/sql`;
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiToken}`,
                    'Content-Type': 'application/sql'
                },
                body: queryConfig.query
            });

            if (!response.ok) {
                throw new Error(`Query execution error: ${response.status}`);
            }

            const result = await response.json();
            return result;
            
        } catch (error) {
            console.error('Error executing analytics query:', error);
            throw error;
        }
    }

    /**
     * Verificar alertas
     */
    async checkAlerts() {
        for (const [alertName, alertConfig] of Object.entries(CLOUDFLARE_ANALYTICS_CONFIG.alerts)) {
            try {
                const result = await this.executeQuery(alertConfig.condition);
                
                // Verificar si se cumple la condición de alerta
                if (result.data && result.data.length > 0) {
                    await this.triggerAlert(alertName, alertConfig, result.data[0]);
                }
                
            } catch (error) {
                console.error(`Error checking alert '${alertName}':`, error);
            }
        }
    }

    /**
     * Disparar alerta
     */
    async triggerAlert(alertName, config, data) {
        const alert = {
            id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: config.name,
            timestamp: new Date().toISOString(),
            data: data,
            channels: config.notification_channels
        };
        
        console.warn('ANALYTICS ALERT TRIGGERED:', JSON.stringify(alert));
        
        // Enviar a canales de notificación
        for (const channel of config.notification_channels) {
            await this.sendAlertNotification(channel, alert);
        }
        
        // Registrar cooldown
        await this.setAlertCooldown(alertName, config.cooldown_minutes);
    }

    /**
     * Enviar notificación de alerta
     */
    async sendAlertNotification(channel, alert) {
        switch (channel) {
            case 'webhook':
                await this.sendWebhookNotification(alert);
                break;
            case 'email':
                await this.sendEmailNotification(alert);
                break;
            default:
                console.log(`Alert notification sent via ${channel}:`, alert);
        }
    }

    /**
     * Enviar notificación por webhook
     */
    async sendWebhookNotification(alert) {
        try {
            // En producción, enviar a webhook real
            console.log('Webhook Alert:', JSON.stringify(alert));
            
        } catch (error) {
            console.error('Error sending webhook notification:', error);
        }
    }

    /**
     * Verificar y crear dataset
     */
    async ensureDatasetExists() {
        try {
            // En producción, verificar si el dataset existe y crearlo si no
            console.log(`Analytics dataset '${this.datasetName}' initialized`);
            
        } catch (error) {
            console.error('Error ensuring dataset exists:', error);
        }
    }

    /**
     * Configurar cooldown de alerta
     */
    async setAlertCooldown(alertName, minutes) {
        const key = `alert_cooldown:${alertName}`;
        const expirationTime = Date.now() + (minutes * 60 * 1000);
        
        // En producción, usar KV para almacenar cooldown
        console.log(`Alert cooldown set for ${alertName}: ${minutes} minutes`);
    }

    /**
     * Obtener métricas del sistema
     */
    getMetrics() {
        return {
            buffer_size: this.dataBuffer.length,
            max_buffer_size: this.maxBufferSize,
            dataset_name: this.datasetName,
            flush_interval_ms: this.flushInterval
        };
    }
}

/**
 * Funciones de utilidad
 */

// Crear instancia del manager
export function createAnalyticsManager(env) {
    return new CloudflareAnalyticsManager(env);
}

// Escribir evento de seguridad
export async function writeSecurityEvent(env, eventType, data) {
    const analytics = new CloudflareAnalyticsManager(env);
    
    const dimensions = {
        event_category: 'security',
        event_type: eventType,
        severity_level: data.severity || 'medium',
        client_country: data.country || 'unknown',
        endpoint_path: data.endpoint || 'unknown'
    };
    
    const metrics = {
        event_count: 1,
        attack_attempts: eventType === 'attack_attempt' ? 1 : 0,
        failed_authentications: eventType === 'login_failure' ? 1 : 0
    };
    
    return await analytics.writeEvent(dimensions, metrics);
}

// Escribir evento de performance
export async function writePerformanceEvent(env, data) {
    const analytics = new CloudflareAnalyticsManager(env);
    
    const dimensions = {
        event_category: 'performance',
        event_type: 'api_request',
        endpoint_path: data.endpoint,
        response_status: data.status.toString()
    };
    
    const metrics = {
        event_count: 1,
        response_time_ms: data.responseTime,
        error_count: data.status >= 400 ? 1 : 0
    };
    
    return await analytics.writeEvent(dimensions, metrics);
}

export { CloudflareAnalyticsManager, CLOUDFLARE_ANALYTICS_CONFIG };
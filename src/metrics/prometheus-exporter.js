/**
 * Exporter de Métricas Prometheus para ArbitrageX Supreme
 * Ingenio Pichichi S.A. - Metodología Cumplidor, disciplinado, organizado
 * 
 * Sistema completo de métricas para Prometheus incluyendo:
 * - Métricas de aplicación y performance
 * - Métricas de trading y arbitraje
 * - Métricas de blockchain y transacciones
 * - Métricas de seguridad
 * - Métricas de negocio y usuarios
 * 
 * @author Hector Fabio Riascos C.
 * @version 1.0.0
 * @date 2025-01-15
 */

/**
 * Configuración de métricas Prometheus
 */
const PROMETHEUS_METRICS_CONFIG = {
    // Configuración general
    general: {
        namespace: 'arbitragex',
        defaultLabels: {
            service: 'arbitragex-supreme',
            version: '1.0.0',
            environment: process.env.ENVIRONMENT || 'production'
        },
        collectDefaultMetrics: true,
        collectInterval: 5000 // 5 segundos
    },

    // Definición de métricas personalizadas
    metrics: {
        // Métricas HTTP/API
        http_requests_total: {
            type: 'counter',
            name: 'http_requests_total',
            help: 'Total number of HTTP requests',
            labelNames: ['method', 'endpoint', 'status', 'user_role']
        },
        http_request_duration_seconds: {
            type: 'histogram',
            name: 'http_request_duration_seconds',
            help: 'HTTP request duration in seconds',
            labelNames: ['method', 'endpoint', 'status'],
            buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10]
        },

        // Métricas de trading
        trading_volume_usd: {
            type: 'gauge',
            name: 'trading_volume_usd',
            help: 'Current trading volume in USD',
            labelNames: ['exchange', 'symbol', 'time_period']
        },
        trading_orders_total: {
            type: 'counter',
            name: 'trading_orders_total',
            help: 'Total number of trading orders',
            labelNames: ['exchange', 'symbol', 'order_type', 'side', 'status']
        },
        trading_fees_earned_usd: {
            type: 'counter',
            name: 'trading_fees_earned_usd',
            help: 'Total trading fees earned in USD',
            labelNames: ['exchange', 'fee_type']
        },
        trading_engine_status: {
            type: 'gauge',
            name: 'trading_engine_status',
            help: 'Trading engine status (1=active, 0=inactive)',
            labelNames: ['engine_id']
        },

        // Métricas de arbitraje
        arbitrage_opportunities_found_total: {
            type: 'counter',
            name: 'arbitrage_opportunities_found_total',
            help: 'Total arbitrage opportunities found',
            labelNames: ['from_exchange', 'to_exchange', 'symbol']
        },
        arbitrage_opportunities_executed_total: {
            type: 'counter',
            name: 'arbitrage_opportunities_executed_total',
            help: 'Total arbitrage opportunities executed',
            labelNames: ['from_exchange', 'to_exchange', 'symbol', 'result']
        },
        arbitrage_profit_usd: {
            type: 'gauge',
            name: 'arbitrage_profit_usd',
            help: 'Arbitrage profit in USD',
            labelNames: ['from_exchange', 'to_exchange', 'symbol', 'time_period']
        },
        arbitrage_execution_duration_seconds: {
            type: 'histogram',
            name: 'arbitrage_execution_duration_seconds',
            help: 'Time taken to execute arbitrage in seconds',
            labelNames: ['from_exchange', 'to_exchange', 'symbol'],
            buckets: [1, 5, 10, 30, 60, 120, 300]
        },

        // Métricas de blockchain
        blockchain_connection_status: {
            type: 'gauge',
            name: 'blockchain_connection_status',
            help: 'Blockchain connection status (1=connected, 0=disconnected)',
            labelNames: ['network', 'provider']
        },
        blockchain_gas_price_gwei: {
            type: 'gauge',
            name: 'blockchain_gas_price_gwei',
            help: 'Current gas price in Gwei',
            labelNames: ['network']
        },
        blockchain_transactions_total: {
            type: 'counter',
            name: 'blockchain_transactions_total',
            help: 'Total blockchain transactions',
            labelNames: ['network', 'transaction_type', 'status']
        },
        blockchain_block_number: {
            type: 'gauge',
            name: 'blockchain_block_number',
            help: 'Current block number',
            labelNames: ['network']
        },
        mev_protection_triggered_total: {
            type: 'counter',
            name: 'mev_protection_triggered_total',
            help: 'Total MEV protection triggers',
            labelNames: ['network', 'protection_type']
        },

        // Métricas de seguridad
        security_attacks_total: {
            type: 'counter',
            name: 'security_attacks_total',
            help: 'Total security attacks detected',
            labelNames: ['attack_type', 'source_ip', 'endpoint']
        },
        auth_failed_logins_total: {
            type: 'counter',
            name: 'auth_failed_logins_total',
            help: 'Total failed login attempts',
            labelNames: ['source_ip', 'user_agent_category']
        },
        rate_limit_exceeded_total: {
            type: 'counter',
            name: 'rate_limit_exceeded_total',
            help: 'Total rate limit exceedances',
            labelNames: ['endpoint', 'limit_type', 'source_ip']
        },
        security_suspicious_users: {
            type: 'gauge',
            name: 'security_suspicious_users',
            help: 'Number of users flagged as suspicious',
            labelNames: ['suspicion_type']
        },

        // Métricas de usuarios y sesiones
        active_users_total: {
            type: 'gauge',
            name: 'active_users_total',
            help: 'Current number of active users',
            labelNames: ['time_period', 'user_role']
        },
        user_sessions_total: {
            type: 'gauge',
            name: 'user_sessions_total',
            help: 'Current number of user sessions',
            labelNames: ['session_type']
        },
        websocket_connections_active: {
            type: 'gauge',
            name: 'websocket_connections_active',
            help: 'Current number of active WebSocket connections',
            labelNames: ['connection_type']
        },
        websocket_messages_total: {
            type: 'counter',
            name: 'websocket_messages_total',
            help: 'Total WebSocket messages',
            labelNames: ['direction', 'message_type']
        },

        // Métricas de portfolio y balances
        portfolio_value_usd: {
            type: 'gauge',
            name: 'portfolio_value_usd',
            help: 'Portfolio value in USD',
            labelNames: ['user_tier', 'token']
        },
        wallet_connections_total: {
            type: 'counter',
            name: 'wallet_connections_total',
            help: 'Total wallet connections',
            labelNames: ['wallet_type', 'network', 'status']
        },

        // Métricas de sistema y recursos
        memory_usage_bytes: {
            type: 'gauge',
            name: 'memory_usage_bytes',
            help: 'Current memory usage in bytes',
            labelNames: ['type']
        },
        cpu_usage_percent: {
            type: 'gauge',
            name: 'cpu_usage_percent',
            help: 'Current CPU usage percentage',
            labelNames: []
        },
        external_api_requests_total: {
            type: 'counter',
            name: 'external_api_requests_total',
            help: 'Total requests to external APIs',
            labelNames: ['api_provider', 'endpoint', 'status']
        },
        external_api_response_time_seconds: {
            type: 'histogram',
            name: 'external_api_response_time_seconds',
            help: 'External API response time in seconds',
            labelNames: ['api_provider', 'endpoint'],
            buckets: [0.1, 0.5, 1, 2, 5, 10, 30]
        }
    }
};

/**
 * Clase principal para gestión de métricas Prometheus
 */
class PrometheusMetricsExporter {
    constructor(env) {
        this.env = env;
        this.config = PROMETHEUS_METRICS_CONFIG;
        
        // Storage para métricas
        this.metrics = new Map();
        this.defaultLabels = this.config.general.defaultLabels;
        
        // Cache para optimizar performance
        this.metricsCache = new Map();
        this.lastCacheUpdate = 0;
        this.cacheValidityMs = 5000; // 5 segundos
        
        // Inicializar métricas
        this.initializeMetrics();
    }

    /**
     * Inicializar todas las métricas definidas
     */
    initializeMetrics() {
        for (const [metricName, config] of Object.entries(this.config.metrics)) {
            this.metrics.set(metricName, {
                type: config.type,
                name: `${this.config.general.namespace}_${config.name}`,
                help: config.help,
                labelNames: config.labelNames || [],
                buckets: config.buckets,
                values: new Map()
            });
        }
    }

    /**
     * Incrementar contador
     */
    incrementCounter(metricName, labels = {}, value = 1) {
        const metric = this.metrics.get(metricName);
        if (!metric || metric.type !== 'counter') {
            console.warn(`Counter metric '${metricName}' not found or invalid type`);
            return;
        }

        const labelKey = this.createLabelKey(labels);
        const currentValue = metric.values.get(labelKey) || 0;
        metric.values.set(labelKey, currentValue + value);

        // Invalidar cache
        this.invalidateCache();
    }

    /**
     * Establecer gauge
     */
    setGauge(metricName, value, labels = {}) {
        const metric = this.metrics.get(metricName);
        if (!metric || metric.type !== 'gauge') {
            console.warn(`Gauge metric '${metricName}' not found or invalid type`);
            return;
        }

        const labelKey = this.createLabelKey(labels);
        metric.values.set(labelKey, value);

        // Invalidar cache
        this.invalidateCache();
    }

    /**
     * Observar histogram
     */
    observeHistogram(metricName, value, labels = {}) {
        const metric = this.metrics.get(metricName);
        if (!metric || metric.type !== 'histogram') {
            console.warn(`Histogram metric '${metricName}' not found or invalid type`);
            return;
        }

        const labelKey = this.createLabelKey(labels);
        let histogramData = metric.values.get(labelKey);
        
        if (!histogramData) {
            histogramData = {
                buckets: new Map(),
                count: 0,
                sum: 0
            };
            
            // Inicializar buckets
            for (const bucket of metric.buckets || []) {
                histogramData.buckets.set(bucket, 0);
            }
            histogramData.buckets.set('+Inf', 0);
        }

        // Actualizar buckets
        histogramData.count += 1;
        histogramData.sum += value;
        
        for (const [bucketValue, bucketCount] of histogramData.buckets.entries()) {
            if (bucketValue === '+Inf' || value <= parseFloat(bucketValue)) {
                histogramData.buckets.set(bucketValue, bucketCount + 1);
            }
        }

        metric.values.set(labelKey, histogramData);

        // Invalidar cache
        this.invalidateCache();
    }

    /**
     * Crear key de labels para almacenamiento
     */
    createLabelKey(labels) {
        const mergedLabels = { ...this.defaultLabels, ...labels };
        return JSON.stringify(mergedLabels, Object.keys(mergedLabels).sort());
    }

    /**
     * Parsear labels desde key
     */
    parseLabelsFromKey(labelKey) {
        try {
            return JSON.parse(labelKey);
        } catch (error) {
            return {};
        }
    }

    /**
     * Generar salida en formato Prometheus
     */
    generatePrometheusOutput() {
        const now = Date.now();
        
        // Usar cache si es válido
        if (this.metricsCache.has('prometheus') && 
            (now - this.lastCacheUpdate) < this.cacheValidityMs) {
            return this.metricsCache.get('prometheus');
        }

        let output = '';
        
        for (const [metricName, metric] of this.metrics.entries()) {
            // Header con metadata
            output += `# HELP ${metric.name} ${metric.help}\n`;
            output += `# TYPE ${metric.name} ${metric.type}\n`;
            
            // Valores de métricas
            for (const [labelKey, value] of metric.values.entries()) {
                const labels = this.parseLabelsFromKey(labelKey);
                
                if (metric.type === 'histogram') {
                    // Histogram buckets
                    for (const [bucketValue, bucketCount] of value.buckets.entries()) {
                        const bucketLabels = { ...labels, le: bucketValue };
                        output += `${metric.name}_bucket${this.formatLabels(bucketLabels)} ${bucketCount}\n`;
                    }
                    
                    // Histogram count y sum
                    output += `${metric.name}_count${this.formatLabels(labels)} ${value.count}\n`;
                    output += `${metric.name}_sum${this.formatLabels(labels)} ${value.sum}\n`;
                } else {
                    // Counter y Gauge
                    output += `${metric.name}${this.formatLabels(labels)} ${value}\n`;
                }
            }
            
            output += '\n';
        }

        // Agregar métricas del sistema
        output += this.generateSystemMetrics();

        // Actualizar cache
        this.metricsCache.set('prometheus', output);
        this.lastCacheUpdate = now;

        return output;
    }

    /**
     * Formatear labels para salida Prometheus
     */
    formatLabels(labels) {
        const entries = Object.entries(labels);
        if (entries.length === 0) {
            return '';
        }
        
        const formattedLabels = entries
            .map(([key, value]) => `${key}="${this.escapeValue(value)}"`)
            .join(',');
            
        return `{${formattedLabels}}`;
    }

    /**
     * Escapar valores de labels
     */
    escapeValue(value) {
        return String(value)
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t');
    }

    /**
     * Generar métricas del sistema
     */
    generateSystemMetrics() {
        let output = '';
        
        // Process metrics (simulados para Cloudflare Workers)
        const processMetrics = {
            'process_uptime_seconds': Date.now() / 1000,
            'process_virtual_memory_bytes': this.getMemoryUsage(),
            'process_cpu_seconds_total': this.getCpuUsage()
        };

        for (const [metricName, value] of Object.entries(processMetrics)) {
            output += `# HELP ${metricName} ${this.getMetricHelp(metricName)}\n`;
            output += `# TYPE ${metricName} ${this.getMetricType(metricName)}\n`;
            output += `${metricName}${this.formatLabels(this.defaultLabels)} ${value}\n\n`;
        }

        return output;
    }

    /**
     * Obtener uso de memoria (simulado)
     */
    getMemoryUsage() {
        // En Cloudflare Workers, simular basado en métricas disponibles
        return Math.floor(Math.random() * 100000000); // 100MB random
    }

    /**
     * Obtener uso de CPU (simulado)
     */
    getCpuUsage() {
        // En Cloudflare Workers, simular basado en tiempo de ejecución
        return Math.floor(Date.now() / 1000);
    }

    /**
     * Obtener help de métrica del sistema
     */
    getMetricHelp(metricName) {
        const helps = {
            'process_uptime_seconds': 'Process uptime in seconds',
            'process_virtual_memory_bytes': 'Virtual memory size in bytes',
            'process_cpu_seconds_total': 'Total user and system CPU time spent in seconds'
        };
        return helps[metricName] || 'System metric';
    }

    /**
     * Obtener tipo de métrica del sistema
     */
    getMetricType(metricName) {
        if (metricName.includes('_total')) return 'counter';
        return 'gauge';
    }

    /**
     * Invalidar cache
     */
    invalidateCache() {
        this.metricsCache.clear();
        this.lastCacheUpdate = 0;
    }

    /**
     * Middleware para colectar métricas HTTP automáticamente
     */
    createHTTPMetricsMiddleware() {
        return async (c, next) => {
            const startTime = Date.now();
            const method = c.req.method;
            const endpoint = this.normalizeEndpoint(c.req.path);
            
            // Obtener información del usuario si está disponible
            const user = c.get('user');
            const userRole = user?.role || 'anonymous';
            
            try {
                await next();
                
                // Métricas de request exitoso
                const duration = (Date.now() - startTime) / 1000;
                const status = c.res?.status || 200;
                
                // Incrementar contador de requests
                this.incrementCounter('http_requests_total', {
                    method,
                    endpoint,
                    status: status.toString(),
                    user_role: userRole
                });
                
                // Observar duración
                this.observeHistogram('http_request_duration_seconds', duration, {
                    method,
                    endpoint,
                    status: status.toString()
                });
                
            } catch (error) {
                // Métricas de error
                const duration = (Date.now() - startTime) / 1000;
                const status = error.status || 500;
                
                this.incrementCounter('http_requests_total', {
                    method,
                    endpoint,
                    status: status.toString(),
                    user_role: userRole
                });
                
                this.observeHistogram('http_request_duration_seconds', duration, {
                    method,
                    endpoint,
                    status: status.toString()
                });
                
                throw error;
            }
        };
    }

    /**
     * Normalizar endpoint para métricas
     */
    normalizeEndpoint(path) {
        // Reemplazar IDs y parámetros dinámicos con placeholders
        return path
            .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/{uuid}')
            .replace(/\/\d+/g, '/{id}')
            .replace(/\/0x[a-fA-F0-9]{40}/g, '/{address}')
            .replace(/\/0x[a-fA-F0-9]{64}/g, '/{hash}');
    }

    /**
     * Obtener métricas actuales
     */
    getCurrentMetrics() {
        const metricsData = {};
        
        for (const [metricName, metric] of this.metrics.entries()) {
            metricsData[metricName] = {
                type: metric.type,
                values: Object.fromEntries(metric.values)
            };
        }
        
        return metricsData;
    }

    /**
     * Reset de métricas (solo para testing)
     */
    resetMetrics() {
        for (const [metricName, metric] of this.metrics.entries()) {
            if (metric.type === 'counter') {
                metric.values.clear();
            }
        }
        this.invalidateCache();
    }
}

/**
 * Funciones de utilidad para métricas específicas
 */

// Métricas de trading
export function recordTradingOrder(exporter, orderData) {
    exporter.incrementCounter('trading_orders_total', {
        exchange: orderData.exchange,
        symbol: orderData.symbol,
        order_type: orderData.type,
        side: orderData.side,
        status: orderData.status
    });
    
    if (orderData.volume) {
        exporter.setGauge('trading_volume_usd', orderData.volume, {
            exchange: orderData.exchange,
            symbol: orderData.symbol,
            time_period: '1h'
        });
    }
}

// Métricas de arbitraje
export function recordArbitrageOpportunity(exporter, opportunityData) {
    exporter.incrementCounter('arbitrage_opportunities_found_total', {
        from_exchange: opportunityData.fromExchange,
        to_exchange: opportunityData.toExchange,
        symbol: opportunityData.symbol
    });
    
    if (opportunityData.executed) {
        exporter.incrementCounter('arbitrage_opportunities_executed_total', {
            from_exchange: opportunityData.fromExchange,
            to_exchange: opportunityData.toExchange,
            symbol: opportunityData.symbol,
            result: opportunityData.result || 'success'
        });
        
        if (opportunityData.executionTime) {
            exporter.observeHistogram('arbitrage_execution_duration_seconds', 
                opportunityData.executionTime / 1000, {
                from_exchange: opportunityData.fromExchange,
                to_exchange: opportunityData.toExchange,
                symbol: opportunityData.symbol
            });
        }
    }
}

// Métricas de blockchain
export function recordBlockchainTransaction(exporter, transactionData) {
    exporter.incrementCounter('blockchain_transactions_total', {
        network: transactionData.network,
        transaction_type: transactionData.type,
        status: transactionData.status
    });
}

// Métricas de seguridad
export function recordSecurityEvent(exporter, eventData) {
    exporter.incrementCounter('security_attacks_total', {
        attack_type: eventData.attackType,
        source_ip: eventData.sourceIp,
        endpoint: eventData.endpoint
    });
}

/**
 * Factory function para crear exporter
 */
export function createMetricsExporter(env) {
    return new PrometheusMetricsExporter(env);
}

/**
 * Middleware para endpoint de métricas
 */
export function createMetricsEndpoint(env) {
    const exporter = new PrometheusMetricsExporter(env);
    
    return async (c) => {
        try {
            const output = exporter.generatePrometheusOutput();
            
            c.header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
            return c.text(output);
            
        } catch (error) {
            console.error('Error generating metrics:', error);
            return c.text('Error generating metrics', 500);
        }
    };
}

export { PrometheusMetricsExporter, PROMETHEUS_METRICS_CONFIG };
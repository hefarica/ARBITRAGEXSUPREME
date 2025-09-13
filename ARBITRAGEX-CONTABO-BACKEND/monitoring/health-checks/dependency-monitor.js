/**
 * Monitor de Dependencias para ArbitrageX Supreme
 * Ingenio Pichichi S.A. - Metodología Cumplidor, disciplinado, organizado
 * 
 * Sistema comprehensive de monitoreo de dependencias externas:
 * - APIs de exchanges (Binance, Coinbase, Uniswap, etc.)
 * - Proveedores RPC blockchain (Infura, Alchemy, etc.)
 * - APIs de precios (CoinGecko, CoinMarketCap)
 * - Servicios de datos (The Graph, Moralis)
 * - Health checks con circuit breakers
 * - Failover automático y alertas
 * 
 * @author Hector Fabio Riascos C.
 * @version 1.0.0
 * @date 2025-01-15
 */

/**
 * Configuración de dependencias externas
 */
const DEPENDENCY_CONFIG = {
    // Configuración general de monitoreo
    monitoring: {
        checkInterval: 30000,        // Verificar cada 30 segundos
        timeout: 10000,              // Timeout de 10 segundos por check
        retryAttempts: 3,            // 3 intentos antes de marcar como down
        retryDelay: 2000,            // 2 segundos entre reintentos
        circuitBreakerThreshold: 5,  // 5 fallos consecutivos para abrir circuit
        circuitBreakerTimeout: 60000 // 1 minuto antes de probar reconexión
    },

    // Definición de dependencias
    dependencies: {
        // APIs de Exchanges
        exchanges: {
            binance: {
                name: 'Binance API',
                type: 'exchange',
                priority: 'critical',
                endpoints: [
                    {
                        name: 'ticker_price',
                        url: 'https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT',
                        method: 'GET',
                        expectedStatus: 200,
                        timeout: 5000,
                        validateResponse: (data) => data.symbol === 'BTCUSDT' && parseFloat(data.price) > 0
                    },
                    {
                        name: 'server_time',
                        url: 'https://api.binance.com/api/v3/time',
                        method: 'GET',
                        expectedStatus: 200,
                        timeout: 3000,
                        validateResponse: (data) => typeof data.serverTime === 'number'
                    }
                ]
            },

            coinbase: {
                name: 'Coinbase Pro API',
                type: 'exchange',
                priority: 'high',
                endpoints: [
                    {
                        name: 'btc_ticker',
                        url: 'https://api.exchange.coinbase.com/products/BTC-USD/ticker',
                        method: 'GET',
                        expectedStatus: 200,
                        timeout: 5000,
                        validateResponse: (data) => parseFloat(data.price) > 0
                    }
                ]
            },

            kraken: {
                name: 'Kraken API',
                type: 'exchange',
                priority: 'medium',
                endpoints: [
                    {
                        name: 'btc_ticker',
                        url: 'https://api.kraken.com/0/public/Ticker?pair=XBTUSD',
                        method: 'GET',
                        expectedStatus: 200,
                        timeout: 5000,
                        validateResponse: (data) => data.error && data.error.length === 0 && data.result
                    }
                ]
            }
        },

        // Proveedores RPC Blockchain
        blockchain_rpcs: {
            infura_ethereum: {
                name: 'Infura Ethereum RPC',
                type: 'blockchain_rpc',
                priority: 'critical',
                endpoints: [
                    {
                        name: 'latest_block',
                        url: `https://mainnet.infura.io/v3/${process.env.INFURA_PROJECT_ID || 'demo'}`,
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            jsonrpc: '2.0',
                            method: 'eth_blockNumber',
                            params: [],
                            id: 1
                        }),
                        expectedStatus: 200,
                        timeout: 8000,
                        validateResponse: (data) => data.result && data.result.startsWith('0x')
                    }
                ]
            },

            alchemy_polygon: {
                name: 'Alchemy Polygon RPC',
                type: 'blockchain_rpc',
                priority: 'critical',
                endpoints: [
                    {
                        name: 'chain_id',
                        url: `https://polygon-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY || 'demo'}`,
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            jsonrpc: '2.0',
                            method: 'eth_chainId',
                            params: [],
                            id: 1
                        }),
                        expectedStatus: 200,
                        timeout: 8000,
                        validateResponse: (data) => data.result === '0x89' // Polygon Chain ID
                    }
                ]
            },

            arbitrum_rpc: {
                name: 'Arbitrum One RPC',
                type: 'blockchain_rpc',
                priority: 'high',
                endpoints: [
                    {
                        name: 'network_check',
                        url: 'https://arb1.arbitrum.io/rpc',
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            jsonrpc: '2.0',
                            method: 'net_version',
                            params: [],
                            id: 1
                        }),
                        expectedStatus: 200,
                        timeout: 8000,
                        validateResponse: (data) => data.result === '42161' // Arbitrum Chain ID
                    }
                ]
            }
        },

        // APIs de Precios
        price_feeds: {
            coingecko: {
                name: 'CoinGecko API',
                type: 'price_feed',
                priority: 'critical',
                endpoints: [
                    {
                        name: 'btc_price',
                        url: 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd',
                        method: 'GET',
                        expectedStatus: 200,
                        timeout: 5000,
                        validateResponse: (data) => data.bitcoin && data.bitcoin.usd > 0
                    },
                    {
                        name: 'rate_limit_check',
                        url: 'https://api.coingecko.com/api/v3/ping',
                        method: 'GET',
                        expectedStatus: 200,
                        timeout: 3000,
                        validateResponse: (data) => data.gecko_says === "(V3) To the Moon!"
                    }
                ]
            },

            coinmarketcap: {
                name: 'CoinMarketCap API',
                type: 'price_feed',
                priority: 'high',
                endpoints: [
                    {
                        name: 'btc_quote',
                        url: 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=BTC',
                        method: 'GET',
                        headers: {
                            'X-CMC_PRO_API_KEY': process.env.CMC_API_KEY || 'demo'
                        },
                        expectedStatus: 200,
                        timeout: 5000,
                        validateResponse: (data) => data.data && data.data.BTC && data.data.BTC.quote.USD.price > 0
                    }
                ]
            }
        },

        // Servicios de datos DeFi
        defi_services: {
            the_graph: {
                name: 'The Graph Protocol',
                type: 'defi_data',
                priority: 'medium',
                endpoints: [
                    {
                        name: 'uniswap_subgraph',
                        url: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3',
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            query: '{ factories(first: 1) { id totalValueLockedUSD } }'
                        }),
                        expectedStatus: 200,
                        timeout: 10000,
                        validateResponse: (data) => data.data && data.data.factories && data.data.factories.length > 0
                    }
                ]
            },

            dune_analytics: {
                name: 'Dune Analytics API',
                type: 'defi_data',
                priority: 'low',
                endpoints: [
                    {
                        name: 'api_status',
                        url: 'https://api.dune.com/api/v1/query/1/status',
                        method: 'GET',
                        headers: {
                            'X-Dune-API-Key': process.env.DUNE_API_KEY || 'demo'
                        },
                        expectedStatus: 200,
                        timeout: 8000,
                        validateResponse: (data) => data.state !== undefined
                    }
                ]
            }
        },

        // Servicios de infraestructura
        infrastructure: {
            cloudflare_dns: {
                name: 'Cloudflare DNS',
                type: 'infrastructure',
                priority: 'critical',
                endpoints: [
                    {
                        name: 'dns_resolve',
                        url: 'https://cloudflare-dns.com/dns-query?name=google.com&type=A',
                        method: 'GET',
                        headers: {
                            'Accept': 'application/dns-json'
                        },
                        expectedStatus: 200,
                        timeout: 3000,
                        validateResponse: (data) => data.Status === 0 && data.Answer && data.Answer.length > 0
                    }
                ]
            },

            ipfs_gateway: {
                name: 'IPFS Gateway',
                type: 'infrastructure',
                priority: 'low',
                endpoints: [
                    {
                        name: 'gateway_test',
                        url: 'https://ipfs.io/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG/readme',
                        method: 'GET',
                        expectedStatus: 200,
                        timeout: 10000,
                        validateResponse: (data) => typeof data === 'string' && data.includes('IPFS')
                    }
                ]
            }
        }
    }
};

/**
 * Clase principal para monitoreo de dependencias
 */
class DependencyMonitor {
    constructor(env) {
        this.env = env;
        this.config = DEPENDENCY_CONFIG;
        
        // Estado de las dependencias
        this.dependencyStatus = new Map();
        
        // Circuit breakers
        this.circuitBreakers = new Map();
        
        // Métricas de monitoreo
        this.metrics = {
            totalChecks: 0,
            successfulChecks: 0,
            failedChecks: 0,
            averageResponseTime: 0,
            lastCheckTimestamp: null
        };
        
        // Intervalos de monitoreo
        this.monitoringIntervals = new Map();
        
        // Inicializar estado
        this.initializeDependencies();
    }

    /**
     * Inicializar estado de dependencias
     */
    initializeDependencies() {
        for (const [categoryName, category] of Object.entries(this.config.dependencies)) {
            for (const [serviceName, service] of Object.entries(category)) {
                const fullServiceName = `${categoryName}.${serviceName}`;
                
                // Inicializar estado
                this.dependencyStatus.set(fullServiceName, {
                    name: service.name,
                    type: service.type,
                    priority: service.priority,
                    status: 'unknown',
                    lastCheck: null,
                    lastSuccess: null,
                    consecutiveFailures: 0,
                    totalChecks: 0,
                    successfulChecks: 0,
                    averageResponseTime: 0,
                    endpoints: service.endpoints.map(endpoint => ({
                        ...endpoint,
                        status: 'unknown',
                        lastCheck: null,
                        responseTime: 0
                    }))
                });
                
                // Inicializar circuit breaker
                this.circuitBreakers.set(fullServiceName, {
                    state: 'closed', // closed, open, half-open
                    failureCount: 0,
                    lastFailureTime: null,
                    nextAttemptTime: null
                });
            }
        }
    }

    /**
     * Iniciar monitoreo de todas las dependencias
     */
    startMonitoring() {
        console.log('🔍 Iniciando monitoreo de dependencias...');
        
        // Verificación inicial
        this.checkAllDependencies();
        
        // Configurar intervalos de monitoreo
        const interval = setInterval(() => {
            this.checkAllDependencies();
        }, this.config.monitoring.checkInterval);
        
        this.monitoringIntervals.set('main', interval);
        
        console.log(`✅ Monitoreo iniciado con intervalo de ${this.config.monitoring.checkInterval}ms`);
    }

    /**
     * Detener monitoreo
     */
    stopMonitoring() {
        for (const [name, interval] of this.monitoringIntervals) {
            clearInterval(interval);
        }
        this.monitoringIntervals.clear();
        console.log('⏹️ Monitoreo de dependencias detenido');
    }

    /**
     * Verificar todas las dependencias
     */
    async checkAllDependencies() {
        const startTime = Date.now();
        const checkPromises = [];

        for (const [serviceName, serviceState] of this.dependencyStatus) {
            checkPromises.push(this.checkDependency(serviceName));
        }

        try {
            await Promise.allSettled(checkPromises);
            
            // Actualizar métricas globales
            this.metrics.lastCheckTimestamp = new Date().toISOString();
            
            // Log de resumen
            const summary = this.generateHealthSummary();
            console.log(`🔍 Check completado en ${Date.now() - startTime}ms - ` +
                       `${summary.healthy}/${summary.total} servicios saludables`);
            
        } catch (error) {
            console.error('❌ Error en verificación masiva de dependencias:', error);
        }
    }

    /**
     * Verificar una dependencia específica
     */
    async checkDependency(serviceName) {
        const serviceState = this.dependencyStatus.get(serviceName);
        if (!serviceState) return;

        // Verificar circuit breaker
        const circuitBreaker = this.circuitBreakers.get(serviceName);
        if (circuitBreaker.state === 'open') {
            const now = Date.now();
            if (now < circuitBreaker.nextAttemptTime) {
                // Circuit breaker aún abierto
                return;
            } else {
                // Intentar half-open
                circuitBreaker.state = 'half-open';
            }
        }

        const startTime = Date.now();
        let allEndpointsHealthy = true;
        let totalResponseTime = 0;

        // Verificar cada endpoint del servicio
        for (const endpoint of serviceState.endpoints) {
            try {
                const endpointResult = await this.checkEndpoint(endpoint);
                endpoint.status = endpointResult.success ? 'healthy' : 'unhealthy';
                endpoint.lastCheck = new Date().toISOString();
                endpoint.responseTime = endpointResult.responseTime;
                totalResponseTime += endpointResult.responseTime;

                if (!endpointResult.success) {
                    allEndpointsHealthy = false;
                }

            } catch (error) {
                endpoint.status = 'error';
                endpoint.lastCheck = new Date().toISOString();
                endpoint.responseTime = 0;
                allEndpointsHealthy = false;
                
                console.error(`❌ Error verificando endpoint ${endpoint.name} de ${serviceName}:`, error);
            }
        }

        // Actualizar estado del servicio
        const previousStatus = serviceState.status;
        serviceState.status = allEndpointsHealthy ? 'healthy' : 'unhealthy';
        serviceState.lastCheck = new Date().toISOString();
        serviceState.totalChecks++;
        serviceState.averageResponseTime = totalResponseTime / serviceState.endpoints.length;

        if (allEndpointsHealthy) {
            serviceState.successfulChecks++;
            serviceState.lastSuccess = serviceState.lastCheck;
            serviceState.consecutiveFailures = 0;
            
            // Cerrar circuit breaker si estaba abierto
            if (circuitBreaker.state !== 'closed') {
                circuitBreaker.state = 'closed';
                circuitBreaker.failureCount = 0;
                console.log(`✅ Circuit breaker cerrado para ${serviceName}`);
            }
        } else {
            serviceState.consecutiveFailures++;
            
            // Actualizar circuit breaker
            circuitBreaker.failureCount++;
            circuitBreaker.lastFailureTime = Date.now();
            
            // Abrir circuit breaker si se supera el umbral
            if (circuitBreaker.failureCount >= this.config.monitoring.circuitBreakerThreshold) {
                circuitBreaker.state = 'open';
                circuitBreaker.nextAttemptTime = Date.now() + this.config.monitoring.circuitBreakerTimeout;
                console.warn(`⚠️ Circuit breaker abierto para ${serviceName} - ${circuitBreaker.failureCount} fallos consecutivos`);
            }
        }

        // Log de cambios de estado
        if (previousStatus !== serviceState.status) {
            const statusEmoji = serviceState.status === 'healthy' ? '✅' : '❌';
            console.log(`${statusEmoji} ${serviceName} cambió de estado: ${previousStatus} → ${serviceState.status}`);
            
            // Enviar alerta si es crítico
            if (serviceState.priority === 'critical') {
                await this.sendDependencyAlert(serviceName, serviceState, previousStatus);
            }
        }

        // Actualizar métricas globales
        this.metrics.totalChecks++;
        if (allEndpointsHealthy) {
            this.metrics.successfulChecks++;
        } else {
            this.metrics.failedChecks++;
        }
    }

    /**
     * Verificar un endpoint específico
     */
    async checkEndpoint(endpoint) {
        const startTime = Date.now();
        
        try {
            // Configurar request
            const requestConfig = {
                method: endpoint.method,
                headers: endpoint.headers || {},
                signal: AbortSignal.timeout(endpoint.timeout || this.config.monitoring.timeout)
            };

            if (endpoint.body && (endpoint.method === 'POST' || endpoint.method === 'PUT')) {
                requestConfig.body = endpoint.body;
            }

            // Realizar request
            const response = await fetch(endpoint.url, requestConfig);
            const responseTime = Date.now() - startTime;

            // Verificar status code
            if (response.status !== endpoint.expectedStatus) {
                return {
                    success: false,
                    responseTime,
                    error: `Unexpected status code: ${response.status}`
                };
            }

            // Verificar contenido si hay validador
            if (endpoint.validateResponse) {
                try {
                    const data = await response.json();
                    const isValid = endpoint.validateResponse(data);
                    
                    return {
                        success: isValid,
                        responseTime,
                        error: isValid ? null : 'Response validation failed'
                    };
                } catch (parseError) {
                    return {
                        success: false,
                        responseTime,
                        error: 'Failed to parse response as JSON'
                    };
                }
            }

            return {
                success: true,
                responseTime,
                error: null
            };

        } catch (error) {
            const responseTime = Date.now() - startTime;
            
            return {
                success: false,
                responseTime,
                error: error.message
            };
        }
    }

    /**
     * Enviar alerta por dependencia crítica
     */
    async sendDependencyAlert(serviceName, serviceState, previousStatus) {
        const alert = {
            timestamp: new Date().toISOString(),
            type: 'dependency_status_change',
            service: serviceName,
            previous_status: previousStatus,
            current_status: serviceState.status,
            priority: serviceState.priority,
            consecutive_failures: serviceState.consecutiveFailures,
            last_success: serviceState.lastSuccess,
            endpoints: serviceState.endpoints.map(ep => ({
                name: ep.name,
                status: ep.status,
                response_time: ep.responseTime
            }))
        };

        console.warn('🚨 Alerta de dependencia:', JSON.stringify(alert));

        // En producción, enviar a sistema de alertas
        try {
            // Webhook, email, Slack, etc.
            await this.sendAlert(alert);
        } catch (error) {
            console.error('❌ Error enviando alerta:', error);
        }
    }

    /**
     * Enviar alerta (implementar según necesidades)
     */
    async sendAlert(alert) {
        // En producción, implementar integración con:
        // - Slack
        // - Email
        // - PagerDuty
        // - Webhooks personalizados
        
        console.log('📧 Alerta enviada:', alert.type);
    }

    /**
     * Generar resumen de salud
     */
    generateHealthSummary() {
        const summary = {
            timestamp: new Date().toISOString(),
            total: this.dependencyStatus.size,
            healthy: 0,
            unhealthy: 0,
            unknown: 0,
            critical_issues: 0,
            by_category: {},
            by_priority: {
                critical: { total: 0, healthy: 0 },
                high: { total: 0, healthy: 0 },
                medium: { total: 0, healthy: 0 },
                low: { total: 0, healthy: 0 }
            }
        };

        for (const [serviceName, serviceState] of this.dependencyStatus) {
            // Contadores generales
            summary[serviceState.status]++;
            
            // Por prioridad
            summary.by_priority[serviceState.priority].total++;
            if (serviceState.status === 'healthy') {
                summary.by_priority[serviceState.priority].healthy++;
            }

            // Problemas críticos
            if (serviceState.priority === 'critical' && serviceState.status !== 'healthy') {
                summary.critical_issues++;
            }

            // Por categoría
            const category = serviceName.split('.')[0];
            if (!summary.by_category[category]) {
                summary.by_category[category] = { total: 0, healthy: 0, unhealthy: 0, unknown: 0 };
            }
            summary.by_category[category].total++;
            summary.by_category[category][serviceState.status]++;
        }

        return summary;
    }

    /**
     * Obtener estado detallado de dependencias
     */
    getDetailedStatus() {
        const dependencies = {};
        
        for (const [serviceName, serviceState] of this.dependencyStatus) {
            dependencies[serviceName] = {
                name: serviceState.name,
                type: serviceState.type,
                priority: serviceState.priority,
                status: serviceState.status,
                last_check: serviceState.lastCheck,
                last_success: serviceState.lastSuccess,
                consecutive_failures: serviceState.consecutiveFailures,
                success_rate: serviceState.totalChecks > 0 ? 
                    (serviceState.successfulChecks / serviceState.totalChecks * 100).toFixed(2) + '%' : 'N/A',
                average_response_time: Math.round(serviceState.averageResponseTime) + 'ms',
                circuit_breaker_state: this.circuitBreakers.get(serviceName)?.state || 'unknown',
                endpoints: serviceState.endpoints.map(endpoint => ({
                    name: endpoint.name,
                    status: endpoint.status,
                    last_check: endpoint.lastCheck,
                    response_time: Math.round(endpoint.responseTime) + 'ms'
                }))
            };
        }

        return {
            summary: this.generateHealthSummary(),
            dependencies: dependencies,
            global_metrics: this.metrics
        };
    }

    /**
     * Verificar dependencia específica manualmente
     */
    async checkSpecificDependency(serviceName) {
        if (!this.dependencyStatus.has(serviceName)) {
            throw new Error(`Servicio ${serviceName} no encontrado`);
        }

        await this.checkDependency(serviceName);
        return this.dependencyStatus.get(serviceName);
    }

    /**
     * Forzar reinicio de circuit breaker
     */
    resetCircuitBreaker(serviceName) {
        const circuitBreaker = this.circuitBreakers.get(serviceName);
        if (circuitBreaker) {
            circuitBreaker.state = 'closed';
            circuitBreaker.failureCount = 0;
            circuitBreaker.lastFailureTime = null;
            circuitBreaker.nextAttemptTime = null;
            
            console.log(`🔄 Circuit breaker reiniciado para ${serviceName}`);
            return true;
        }
        return false;
    }

    /**
     * Obtener métricas para Prometheus
     */
    getPrometheusMetrics() {
        const metrics = [];
        
        // Métricas por servicio
        for (const [serviceName, serviceState] of this.dependencyStatus) {
            const labels = `service="${serviceName}",type="${serviceState.type}",priority="${serviceState.priority}"`;
            
            // Estado (1 = healthy, 0 = unhealthy)
            metrics.push(`arbitragex_dependency_status{${labels}} ${serviceState.status === 'healthy' ? 1 : 0}`);
            
            // Tiempo de respuesta
            metrics.push(`arbitragex_dependency_response_time_ms{${labels}} ${serviceState.averageResponseTime}`);
            
            // Fallos consecutivos
            metrics.push(`arbitragex_dependency_consecutive_failures{${labels}} ${serviceState.consecutiveFailures}`);
            
            // Total de verificaciones
            metrics.push(`arbitragex_dependency_checks_total{${labels}} ${serviceState.totalChecks}`);
            
            // Verificaciones exitosas
            metrics.push(`arbitragex_dependency_successful_checks_total{${labels}} ${serviceState.successfulChecks}`);
        }

        // Métricas de circuit breakers
        for (const [serviceName, circuitBreaker] of this.circuitBreakers) {
            const stateValue = circuitBreaker.state === 'closed' ? 0 : circuitBreaker.state === 'open' ? 1 : 2;
            metrics.push(`arbitragex_circuit_breaker_state{service="${serviceName}"} ${stateValue}`);
        }

        return metrics.join('\n');
    }
}

/**
 * Funciones de utilidad
 */

// Crear instancia del monitor
export function createDependencyMonitor(env) {
    return new DependencyMonitor(env);
}

// Middleware para health check endpoint
export function createHealthCheckEndpoint(env) {
    const monitor = new DependencyMonitor(env);
    
    return async (c) => {
        try {
            const status = monitor.getDetailedStatus();
            const httpStatus = status.summary.critical_issues === 0 ? 200 : 503;
            
            return c.json(status, httpStatus);
            
        } catch (error) {
            console.error('Error en health check endpoint:', error);
            
            return c.json({
                error: 'Health check failed',
                message: error.message,
                timestamp: new Date().toISOString()
            }, 500);
        }
    };
}

export { DependencyMonitor, DEPENDENCY_CONFIG };
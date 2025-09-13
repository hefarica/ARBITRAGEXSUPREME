/**
 * Sistema de Health Checks Avanzados para ArbitrageX Supreme
 * Ingenio Pichichi S.A. - Metodología Cumplidor, disciplinado, organizado
 * 
 * Sistema comprehensive de monitoreo de salud incluyendo:
 * - Health checks de aplicación y servicios
 * - Monitoring de dependencias externas
 * - Verificación de conectividad blockchain
 * - Monitoring de APIs de terceros
 * - Detección de degradación de performance
 * - Circuit breaker pattern implementation
 * 
 * @author Hector Fabio Riascos C.
 * @version 1.0.0
 * @date 2025-01-15
 */

/**
 * Configuración del sistema de health monitoring
 */
const HEALTH_MONITORING_CONFIG = {
    // Configuración general
    general: {
        checkInterval: 30000,           // Verificar cada 30 segundos
        timeoutMs: 10000,              // Timeout de 10 segundos
        retryAttempts: 3,              // 3 intentos antes de marcar como unhealthy
        retryDelayMs: 1000,            // Esperar 1 segundo entre reintentos
        healthyThreshold: 2,            // 2 checks exitosos para marcar como healthy
        unhealthyThreshold: 3,          // 3 checks fallidos para marcar como unhealthy
        circuitBreakerEnabled: true     // Habilitar circuit breaker
    },

    // Configuración de dependencias a monitorear
    dependencies: {
        // APIs de precios de criptomonedas
        coingecko: {
            name: 'CoinGecko API',
            type: 'api',
            url: 'https://api.coingecko.com/api/v3/ping',
            method: 'GET',
            expectedStatus: 200,
            expectedResponse: { gecko_says: '(V3) To the Moon!' },
            timeout: 5000,
            critical: true,
            category: 'price_data'
        },

        coinmarketcap: {
            name: 'CoinMarketCap API',
            type: 'api',
            url: 'https://pro-api.coinmarketcap.com/v1/key/info',
            method: 'GET',
            headers: {
                'X-CMC_PRO_API_KEY': process.env.CMC_API_KEY || 'test-key'
            },
            expectedStatus: 200,
            timeout: 5000,
            critical: false,
            category: 'price_data'
        },

        // Blockchain RPCs
        ethereum_mainnet: {
            name: 'Ethereum Mainnet',
            type: 'blockchain_rpc',
            url: 'https://mainnet.infura.io/v3/' + (process.env.INFURA_KEY || 'test-key'),
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: {
                jsonrpc: '2.0',
                method: 'eth_blockNumber',
                params: [],
                id: 1
            },
            expectedStatus: 200,
            timeout: 8000,
            critical: true,
            category: 'blockchain'
        },

        polygon_mainnet: {
            name: 'Polygon Mainnet',
            type: 'blockchain_rpc',
            url: 'https://polygon-rpc.com',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: {
                jsonrpc: '2.0',
                method: 'eth_blockNumber',
                params: [],
                id: 1
            },
            expectedStatus: 200,
            timeout: 8000,
            critical: true,
            category: 'blockchain'
        },

        arbitrum_mainnet: {
            name: 'Arbitrum One',
            type: 'blockchain_rpc',
            url: 'https://arb1.arbitrum.io/rpc',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: {
                jsonrpc: '2.0',
                method: 'eth_blockNumber',
                params: [],
                id: 1
            },
            expectedStatus: 200,
            timeout: 8000,
            critical: true,
            category: 'blockchain'
        },

        optimism_mainnet: {
            name: 'Optimism Mainnet',
            type: 'blockchain_rpc',
            url: 'https://mainnet.optimism.io',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: {
                jsonrpc: '2.0',
                method: 'eth_blockNumber',
                params: [],
                id: 1
            },
            expectedStatus: 200,
            timeout: 8000,
            critical: true,
            category: 'blockchain'
        },

        base_mainnet: {
            name: 'Base Mainnet',
            type: 'blockchain_rpc',
            url: 'https://mainnet.base.org',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: {
                jsonrpc: '2.0',
                method: 'eth_blockNumber',
                params: [],
                id: 1
            },
            expectedStatus: 200,
            timeout: 8000,
            critical: true,
            category: 'blockchain'
        },

        // Exchanges (si se integran directamente)
        binance_api: {
            name: 'Binance API',
            type: 'api',
            url: 'https://api.binance.com/api/v3/ping',
            method: 'GET',
            expectedStatus: 200,
            expectedResponse: {},
            timeout: 5000,
            critical: false,
            category: 'exchange'
        }
    },

    // Configuración de circuit breaker
    circuitBreaker: {
        failureThreshold: 5,            // 5 fallos para abrir circuito
        successThreshold: 3,            // 3 éxitos para cerrar circuito
        timeout: 30000,                 // Tiempo de espera antes de retry (30s)
        monitoringPeriodMs: 60000,      // Período de monitoreo (1 minuto)
        volumeThreshold: 10             // Mínimo de requests para activar circuit breaker
    },

    // Configuración de alertas
    alerting: {
        enabled: true,
        criticalDependencyDown: {
            threshold: 1,               // 1 dependencia crítica down = alerta
            cooldownMs: 300000          // 5 minutos de cooldown
        },
        multipleFailures: {
            threshold: 3,               // 3 dependencias down = alerta crítica
            cooldownMs: 600000          // 10 minutos de cooldown
        },
        performanceDegradation: {
            responseTimeThresholdMs: 5000,  // Más de 5s = degradación
            errorRateThreshold: 0.1,        // 10% de error rate = problema
            cooldownMs: 180000              // 3 minutos de cooldown
        }
    }
};

/**
 * Estados de health check
 */
const HealthStatus = {
    HEALTHY: 'healthy',
    UNHEALTHY: 'unhealthy', 
    DEGRADED: 'degraded',
    UNKNOWN: 'unknown'
};

/**
 * Estados de circuit breaker
 */
const CircuitState = {
    CLOSED: 'closed',       // Funcionando normalmente
    OPEN: 'open',           // Circuito abierto, no hace requests
    HALF_OPEN: 'half_open'  // Probando si se puede cerrar
};

/**
 * Clase principal para health monitoring avanzado
 */
class AdvancedHealthMonitor {
    constructor(env) {
        this.env = env;
        this.kv = env.KV;
        this.config = HEALTH_MONITORING_CONFIG;
        
        // Estado de cada dependencia
        this.dependencyStates = new Map();
        
        // Circuit breakers por dependencia
        this.circuitBreakers = new Map();
        
        // Historial de health checks
        this.checkHistory = new Map();
        
        // Contadores de alertas
        this.alertCooldowns = new Map();
        
        // Métricas agregadas
        this.metrics = {
            totalChecks: 0,
            successfulChecks: 0,
            failedChecks: 0,
            averageResponseTime: 0,
            lastCheckTimestamp: null
        };

        // Inicializar
        this.initialize();
    }

    /**
     * Inicializar el monitor
     */
    async initialize() {
        // Inicializar estado de dependencias
        for (const [depId, depConfig] of Object.entries(this.config.dependencies)) {
            this.dependencyStates.set(depId, {
                id: depId,
                name: depConfig.name,
                status: HealthStatus.UNKNOWN,
                lastCheck: null,
                lastSuccess: null,
                consecutiveFailures: 0,
                consecutiveSuccesses: 0,
                responseTime: null,
                error: null,
                critical: depConfig.critical,
                category: depConfig.category
            });

            // Inicializar circuit breaker si está habilitado
            if (this.config.general.circuitBreakerEnabled) {
                this.circuitBreakers.set(depId, {
                    state: CircuitState.CLOSED,
                    failureCount: 0,
                    successCount: 0,
                    lastFailureTime: null,
                    requestCount: 0
                });
            }
        }

        console.log('Advanced Health Monitor initialized');
        await this.performHealthChecks();
    }

    /**
     * Realizar todos los health checks
     */
    async performHealthChecks() {
        const startTime = Date.now();
        const checkPromises = [];

        // Ejecutar checks en paralelo
        for (const [depId, depConfig] of Object.entries(this.config.dependencies)) {
            checkPromises.push(this.checkDependency(depId, depConfig));
        }

        // Esperar todos los resultados
        const results = await Promise.allSettled(checkPromises);
        
        // Procesar resultados
        for (let i = 0; i < results.length; i++) {
            const result = results[i];
            const depId = Object.keys(this.config.dependencies)[i];
            
            if (result.status === 'fulfilled') {
                this.updateDependencyState(depId, result.value);
            } else {
                console.error(`Health check failed for ${depId}:`, result.reason);
                this.updateDependencyState(depId, {
                    success: false,
                    error: result.reason.message,
                    responseTime: null
                });
            }
        }

        // Actualizar métricas globales
        this.updateGlobalMetrics(Date.now() - startTime);
        
        // Verificar alertas
        await this.checkAlerts();

        // Guardar estado en KV
        await this.saveStateToKV();

        console.log(`Health checks completed in ${Date.now() - startTime}ms`);
    }

    /**
     * Verificar una dependencia individual
     */
    async checkDependency(depId, depConfig) {
        const startTime = Date.now();
        
        try {
            // Verificar circuit breaker
            if (!this.shouldExecuteCheck(depId)) {
                return {
                    success: false,
                    error: 'Circuit breaker open',
                    responseTime: null,
                    skipped: true
                };
            }

            // Realizar el check con reintentos
            const result = await this.executeCheckWithRetry(depConfig);
            
            // Actualizar circuit breaker
            this.updateCircuitBreaker(depId, result.success);
            
            return {
                ...result,
                responseTime: Date.now() - startTime
            };

        } catch (error) {
            // Actualizar circuit breaker en caso de error
            this.updateCircuitBreaker(depId, false);
            
            return {
                success: false,
                error: error.message,
                responseTime: Date.now() - startTime
            };
        }
    }

    /**
     * Ejecutar check con reintentos
     */
    async executeCheckWithRetry(depConfig) {
        let lastError;
        
        for (let attempt = 1; attempt <= this.config.general.retryAttempts; attempt++) {
            try {
                const result = await this.executeCheck(depConfig);
                
                if (result.success) {
                    return result;
                }
                
                lastError = new Error(result.error || 'Check failed');
                
                // Esperar antes del siguiente intento
                if (attempt < this.config.general.retryAttempts) {
                    await this.delay(this.config.general.retryDelayMs * attempt);
                }
                
            } catch (error) {
                lastError = error;
                
                // Esperar antes del siguiente intento
                if (attempt < this.config.general.retryAttempts) {
                    await this.delay(this.config.general.retryDelayMs * attempt);
                }
            }
        }
        
        throw lastError;
    }

    /**
     * Ejecutar check individual
     */
    async executeCheck(depConfig) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), depConfig.timeout || this.config.general.timeoutMs);

        try {
            const requestInit = {
                method: depConfig.method || 'GET',
                signal: controller.signal,
                headers: depConfig.headers || {}
            };

            if (depConfig.body) {
                requestInit.body = JSON.stringify(depConfig.body);
            }

            const response = await fetch(depConfig.url, requestInit);
            clearTimeout(timeoutId);

            // Verificar status code
            if (depConfig.expectedStatus && response.status !== depConfig.expectedStatus) {
                return {
                    success: false,
                    error: `Unexpected status code: ${response.status}`
                };
            }

            // Verificar respuesta si se especifica
            if (depConfig.expectedResponse) {
                try {
                    const responseData = await response.json();
                    const matches = this.deepEqual(responseData, depConfig.expectedResponse);
                    
                    if (!matches) {
                        return {
                            success: false,
                            error: 'Response does not match expected format'
                        };
                    }
                } catch (error) {
                    return {
                        success: false,
                        error: 'Failed to parse JSON response'
                    };
                }
            }

            return { success: true };

        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                return {
                    success: false,
                    error: 'Request timeout'
                };
            }
            
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Verificar si debe ejecutar el check (circuit breaker)
     */
    shouldExecuteCheck(depId) {
        if (!this.config.general.circuitBreakerEnabled) {
            return true;
        }

        const circuitBreaker = this.circuitBreakers.get(depId);
        if (!circuitBreaker) {
            return true;
        }

        const now = Date.now();

        switch (circuitBreaker.state) {
            case CircuitState.CLOSED:
                return true;
                
            case CircuitState.OPEN:
                // Verificar si es tiempo de pasar a HALF_OPEN
                if (circuitBreaker.lastFailureTime && 
                    (now - circuitBreaker.lastFailureTime) >= this.config.circuitBreaker.timeout) {
                    circuitBreaker.state = CircuitState.HALF_OPEN;
                    return true;
                }
                return false;
                
            case CircuitState.HALF_OPEN:
                return true;
                
            default:
                return true;
        }
    }

    /**
     * Actualizar circuit breaker
     */
    updateCircuitBreaker(depId, success) {
        if (!this.config.general.circuitBreakerEnabled) {
            return;
        }

        const circuitBreaker = this.circuitBreakers.get(depId);
        if (!circuitBreaker) {
            return;
        }

        circuitBreaker.requestCount++;

        if (success) {
            circuitBreaker.successCount++;
            circuitBreaker.failureCount = 0;

            if (circuitBreaker.state === CircuitState.HALF_OPEN) {
                if (circuitBreaker.successCount >= this.config.circuitBreaker.successThreshold) {
                    circuitBreaker.state = CircuitState.CLOSED;
                    circuitBreaker.successCount = 0;
                    console.log(`Circuit breaker closed for ${depId}`);
                }
            }
        } else {
            circuitBreaker.failureCount++;
            circuitBreaker.successCount = 0;
            circuitBreaker.lastFailureTime = Date.now();

            if (circuitBreaker.state === CircuitState.CLOSED || 
                circuitBreaker.state === CircuitState.HALF_OPEN) {
                
                if (circuitBreaker.failureCount >= this.config.circuitBreaker.failureThreshold &&
                    circuitBreaker.requestCount >= this.config.circuitBreaker.volumeThreshold) {
                    circuitBreaker.state = CircuitState.OPEN;
                    console.warn(`Circuit breaker opened for ${depId}`);
                }
            }
        }
    }

    /**
     * Actualizar estado de dependencia
     */
    updateDependencyState(depId, checkResult) {
        const state = this.dependencyStates.get(depId);
        if (!state) return;

        const now = new Date();
        state.lastCheck = now;
        state.responseTime = checkResult.responseTime;

        if (checkResult.success) {
            state.lastSuccess = now;
            state.consecutiveSuccesses++;
            state.consecutiveFailures = 0;
            state.error = null;

            // Cambiar a healthy si se alcanza el umbral
            if (state.consecutiveSuccesses >= this.config.general.healthyThreshold) {
                state.status = HealthStatus.HEALTHY;
            }

        } else {
            state.consecutiveFailures++;
            state.consecutiveSuccesses = 0;
            state.error = checkResult.error;

            // Cambiar a unhealthy si se alcanza el umbral
            if (state.consecutiveFailures >= this.config.general.unhealthyThreshold) {
                state.status = HealthStatus.UNHEALTHY;
            } else if (state.status === HealthStatus.HEALTHY) {
                state.status = HealthStatus.DEGRADED;
            }
        }

        // Actualizar historial
        this.updateCheckHistory(depId, checkResult);
    }

    /**
     * Actualizar historial de checks
     */
    updateCheckHistory(depId, checkResult) {
        if (!this.checkHistory.has(depId)) {
            this.checkHistory.set(depId, []);
        }

        const history = this.checkHistory.get(depId);
        history.push({
            timestamp: new Date().toISOString(),
            success: checkResult.success,
            responseTime: checkResult.responseTime,
            error: checkResult.error
        });

        // Mantener solo los últimos 100 registros
        if (history.length > 100) {
            history.shift();
        }
    }

    /**
     * Actualizar métricas globales
     */
    updateGlobalMetrics(totalTime) {
        this.metrics.totalChecks++;
        this.metrics.lastCheckTimestamp = new Date().toISOString();

        // Contar successful/failed
        let successful = 0;
        let failed = 0;
        let totalResponseTime = 0;
        let responseTimeCount = 0;

        for (const state of this.dependencyStates.values()) {
            if (state.status === HealthStatus.HEALTHY) {
                successful++;
            } else if (state.status === HealthStatus.UNHEALTHY) {
                failed++;
            }

            if (state.responseTime !== null) {
                totalResponseTime += state.responseTime;
                responseTimeCount++;
            }
        }

        this.metrics.successfulChecks = successful;
        this.metrics.failedChecks = failed;
        
        if (responseTimeCount > 0) {
            this.metrics.averageResponseTime = totalResponseTime / responseTimeCount;
        }
    }

    /**
     * Verificar y disparar alertas
     */
    async checkAlerts() {
        if (!this.config.alerting.enabled) return;

        const now = Date.now();
        
        // Verificar dependencias críticas down
        const criticalDown = Array.from(this.dependencyStates.values())
            .filter(state => state.critical && state.status === HealthStatus.UNHEALTHY);

        if (criticalDown.length >= this.config.alerting.criticalDependencyDown.threshold) {
            await this.triggerAlert('critical_dependency_down', {
                count: criticalDown.length,
                dependencies: criticalDown.map(d => d.name)
            }, this.config.alerting.criticalDependencyDown.cooldownMs);
        }

        // Verificar múltiples fallos
        const allDown = Array.from(this.dependencyStates.values())
            .filter(state => state.status === HealthStatus.UNHEALTHY);

        if (allDown.length >= this.config.alerting.multipleFailures.threshold) {
            await this.triggerAlert('multiple_dependencies_down', {
                count: allDown.length,
                dependencies: allDown.map(d => d.name)
            }, this.config.alerting.multipleFailures.cooldownMs);
        }

        // Verificar degradación de performance
        const slowDependencies = Array.from(this.dependencyStates.values())
            .filter(state => 
                state.responseTime !== null && 
                state.responseTime > this.config.alerting.performanceDegradation.responseTimeThresholdMs
            );

        if (slowDependencies.length > 0) {
            await this.triggerAlert('performance_degradation', {
                count: slowDependencies.length,
                dependencies: slowDependencies.map(d => ({
                    name: d.name,
                    responseTime: d.responseTime
                }))
            }, this.config.alerting.performanceDegradation.cooldownMs);
        }
    }

    /**
     * Disparar alerta con cooldown
     */
    async triggerAlert(alertType, data, cooldownMs) {
        const now = Date.now();
        const lastAlert = this.alertCooldowns.get(alertType);

        if (lastAlert && (now - lastAlert) < cooldownMs) {
            return; // En cooldown
        }

        // Registrar alerta
        this.alertCooldowns.set(alertType, now);

        const alert = {
            type: alertType,
            timestamp: new Date().toISOString(),
            data: data,
            source: 'health_monitor'
        };

        console.warn('HEALTH MONITOR ALERT:', JSON.stringify(alert));

        // En producción, enviar a sistema de alertas
        await this.sendAlert(alert);
    }

    /**
     * Enviar alerta
     */
    async sendAlert(alert) {
        try {
            // En producción, integrar con webhook o sistema de alertas
            console.log('Health alert would be sent:', alert);
            
        } catch (error) {
            console.error('Error sending health alert:', error);
        }
    }

    /**
     * Guardar estado en KV
     */
    async saveStateToKV() {
        try {
            const stateData = {
                dependencies: Object.fromEntries(this.dependencyStates),
                circuitBreakers: Object.fromEntries(this.circuitBreakers),
                metrics: this.metrics,
                lastUpdate: new Date().toISOString()
            };

            await this.kv.put('health_monitor_state', JSON.stringify(stateData), {
                expirationTtl: 3600 // 1 hora
            });

        } catch (error) {
            console.error('Error saving health state to KV:', error);
        }
    }

    /**
     * Obtener resumen de salud
     */
    getHealthSummary() {
        const summary = {
            overall_status: this.calculateOverallStatus(),
            timestamp: new Date().toISOString(),
            metrics: this.metrics,
            dependencies: {},
            categories: {}
        };

        // Procesar dependencias
        for (const [depId, state] of this.dependencyStates.entries()) {
            summary.dependencies[depId] = {
                name: state.name,
                status: state.status,
                critical: state.critical,
                category: state.category,
                last_check: state.lastCheck,
                last_success: state.lastSuccess,
                response_time_ms: state.responseTime,
                consecutive_failures: state.consecutiveFailures,
                error: state.error
            };

            // Agrupar por categoría
            if (!summary.categories[state.category]) {
                summary.categories[state.category] = {
                    healthy: 0,
                    unhealthy: 0,
                    degraded: 0,
                    unknown: 0
                };
            }
            summary.categories[state.category][state.status]++;
        }

        return summary;
    }

    /**
     * Calcular estado general
     */
    calculateOverallStatus() {
        const states = Array.from(this.dependencyStates.values());
        
        // Si hay dependencias críticas down, sistema unhealthy
        const criticalUnhealthy = states.filter(s => s.critical && s.status === HealthStatus.UNHEALTHY);
        if (criticalUnhealthy.length > 0) {
            return HealthStatus.UNHEALTHY;
        }

        // Si hay alguna dependencia degradada, sistema degraded
        const degraded = states.filter(s => s.status === HealthStatus.DEGRADED);
        if (degraded.length > 0) {
            return HealthStatus.DEGRADED;
        }

        // Si todas están healthy, sistema healthy
        const allHealthy = states.every(s => s.status === HealthStatus.HEALTHY);
        if (allHealthy) {
            return HealthStatus.HEALTHY;
        }

        return HealthStatus.DEGRADED;
    }

    /**
     * Funciones de utilidad
     */
    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    deepEqual(obj1, obj2) {
        if (obj1 === obj2) return true;
        if (obj1 == null || obj2 == null) return false;
        if (typeof obj1 !== typeof obj2) return false;

        if (typeof obj1 === 'object') {
            const keys1 = Object.keys(obj1);
            const keys2 = Object.keys(obj2);
            
            if (keys1.length !== keys2.length) return false;
            
            for (const key of keys1) {
                if (!keys2.includes(key)) return false;
                if (!this.deepEqual(obj1[key], obj2[key])) return false;
            }
            
            return true;
        }

        return obj1 === obj2;
    }
}

/**
 * Middleware para health checks
 */
export function createHealthCheckMiddleware(env) {
    const healthMonitor = new AdvancedHealthMonitor(env);
    
    // Ejecutar checks periódicamente
    setInterval(() => {
        healthMonitor.performHealthChecks().catch(error => {
            console.error('Error in periodic health checks:', error);
        });
    }, healthMonitor.config.general.checkInterval);

    return healthMonitor;
}

/**
 * Endpoints de health check
 */
export function createHealthEndpoints(env) {
    const healthMonitor = new AdvancedHealthMonitor(env);
    
    return {
        // Health check básico
        basic: async (c) => {
            const summary = healthMonitor.getHealthSummary();
            const statusCode = summary.overall_status === HealthStatus.HEALTHY ? 200 : 503;
            
            return c.json({
                status: summary.overall_status,
                timestamp: summary.timestamp,
                version: '1.0.0'
            }, statusCode);
        },

        // Health check detallado
        detailed: async (c) => {
            const summary = healthMonitor.getHealthSummary();
            const statusCode = summary.overall_status === HealthStatus.HEALTHY ? 200 : 503;
            
            return c.json(summary, statusCode);
        },

        // Health check por categoría
        category: async (c) => {
            const category = c.req.param('category');
            const summary = healthMonitor.getHealthSummary();
            
            const categoryDeps = Object.entries(summary.dependencies)
                .filter(([id, dep]) => dep.category === category)
                .reduce((obj, [id, dep]) => {
                    obj[id] = dep;
                    return obj;
                }, {});
                
            const categoryStatus = summary.categories[category];
            const overallCategoryStatus = categoryStatus?.unhealthy > 0 ? HealthStatus.UNHEALTHY :
                                        categoryStatus?.degraded > 0 ? HealthStatus.DEGRADED :
                                        categoryStatus?.healthy > 0 ? HealthStatus.HEALTHY :
                                        HealthStatus.UNKNOWN;
            
            const statusCode = overallCategoryStatus === HealthStatus.HEALTHY ? 200 : 503;
            
            return c.json({
                category: category,
                status: overallCategoryStatus,
                dependencies: categoryDeps,
                summary: categoryStatus,
                timestamp: new Date().toISOString()
            }, statusCode);
        },

        // Health check de dependencia específica
        dependency: async (c) => {
            const depId = c.req.param('dependency');
            const summary = healthMonitor.getHealthSummary();
            
            if (!summary.dependencies[depId]) {
                return c.json({
                    error: 'Dependency not found',
                    available_dependencies: Object.keys(summary.dependencies)
                }, 404);
            }
            
            const dependency = summary.dependencies[depId];
            const statusCode = dependency.status === HealthStatus.HEALTHY ? 200 : 503;
            
            return c.json({
                dependency_id: depId,
                ...dependency,
                history: healthMonitor.checkHistory.get(depId)?.slice(-10) || []
            }, statusCode);
        }
    };
}

export { AdvancedHealthMonitor, HealthStatus, CircuitState, HEALTH_MONITORING_CONFIG };
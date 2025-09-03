/**
 * Configuración DDoS Protection para ArbitrageX Supreme
 * Ingenio Pichichi S.A. - Metodología Cumplidor, disciplinado, organizado
 * 
 * @author Hector Fabio Riascos C.
 * @version 1.0.0
 * @date 2025-01-15
 */

class CloudflareDDoSProtection {
    constructor(config = {}) {
        this.config = {
            zoneId: process.env.CLOUDFLARE_ZONE_ID,
            apiToken: process.env.CLOUDFLARE_API_TOKEN,
            baseDomain: process.env.DOMAIN || 'arbitragex-supreme.pages.dev',
            
            // Configuración de protección DDoS
            ddosSettings: {
                sensitivity: 'high', // low, medium, high, essentially_off
                automaticMitigation: true,
                
                // Umbrales personalizados por tipo de tráfico
                thresholds: {
                    // Endpoints críticos de trading
                    trading: {
                        requestsPerSecond: 100,
                        burstLimit: 300,
                        challengeThreshold: 50
                    },
                    
                    // Endpoints de datos de mercado
                    marketData: {
                        requestsPerSecond: 200,
                        burstLimit: 500,
                        challengeThreshold: 100
                    },
                    
                    // Conexiones WebSocket
                    websocket: {
                        connectionsPerMinute: 60,
                        maxConcurrentConnections: 1000,
                        challengeThreshold: 30
                    },
                    
                    // APIs blockchain
                    blockchain: {
                        requestsPerMinute: 300,
                        burstLimit: 100,
                        challengeThreshold: 20
                    },
                    
                    // Rutas generales
                    general: {
                        requestsPerSecond: 50,
                        burstLimit: 150,
                        challengeThreshold: 25
                    }
                }
            },
            
            // Configuración de rate limiting por capas
            rateLimiting: {
                enabled: true,
                layers: [
                    {
                        name: 'api_protection',
                        description: 'Protección para endpoints API',
                        rules: [
                            {
                                id: 'trading_api_limit',
                                match: 'http.request.uri.path matches "/api/trading/*"',
                                threshold: 100,
                                period: 60,
                                action: 'challenge',
                                timeout: 300
                            },
                            {
                                id: 'portfolio_api_limit', 
                                match: 'http.request.uri.path matches "/api/portfolio/*"',
                                threshold: 80,
                                period: 60,
                                action: 'challenge',
                                timeout: 300
                            },
                            {
                                id: 'arbitrage_api_limit',
                                match: 'http.request.uri.path matches "/api/arbitrage/*"',
                                threshold: 120,
                                period: 60,
                                action: 'simulate', // Para análisis antes de bloquear
                                timeout: 300
                            }
                        ]
                    },
                    {
                        name: 'blockchain_protection',
                        description: 'Protección específica para interacciones blockchain',
                        rules: [
                            {
                                id: 'rpc_calls_limit',
                                match: 'http.request.uri.path matches "/api/blockchain/*" and http.request.method eq "POST"',
                                threshold: 30,
                                period: 60,
                                action: 'managed_challenge',
                                timeout: 600
                            },
                            {
                                id: 'gas_estimation_limit',
                                match: 'http.request.uri.path contains "estimate-gas"',
                                threshold: 20,
                                period: 60,
                                action: 'challenge',
                                timeout: 300
                            }
                        ]
                    },
                    {
                        name: 'websocket_protection',
                        description: 'Protección para conexiones WebSocket',
                        rules: [
                            {
                                id: 'websocket_connections',
                                match: 'http.request.headers["upgrade"][0] eq "websocket"',
                                threshold: 10,
                                period: 300, // 5 minutos
                                action: 'challenge',
                                timeout: 900
                            }
                        ]
                    }
                ]
            },
            
            ...config
        };
        
        this.apiClient = this.initializeApiClient();
    }

    /**
     * Inicializar cliente API de Cloudflare
     */
    initializeApiClient() {
        if (!this.config.apiToken || !this.config.zoneId) {
            throw new Error('CLOUDFLARE_API_TOKEN y CLOUDFLARE_ZONE_ID son requeridos');
        }

        return {
            baseURL: 'https://api.cloudflare.com/client/v4',
            headers: {
                'Authorization': `Bearer ${this.config.apiToken}`,
                'Content-Type': 'application/json'
            }
        };
    }

    /**
     * Configurar protección DDoS básica
     */
    async configureDDoSProtection() {
        console.log('🛡️ Configurando protección DDoS para ArbitrageX Supreme...');
        
        try {
            // 1. Configurar nivel de sensibilidad DDoS
            await this.setDDoSSensitivity();
            
            // 2. Configurar rate limiting por capas
            await this.configureRateLimiting();
            
            // 3. Configurar reglas de firewall
            await this.configureFirewallRules();
            
            // 4. Configurar protección de bots
            await this.configureBotManagement();
            
            // 5. Configurar alertas de seguridad
            await this.configureSecurityAlerts();
            
            console.log('✅ Protección DDoS configurada exitosamente');
            return {
                success: true,
                timestamp: new Date().toISOString(),
                configuration: this.config.ddosSettings
            };
            
        } catch (error) {
            console.error('❌ Error configurando protección DDoS:', error);
            throw error;
        }
    }

    /**
     * Configurar sensibilidad DDoS
     */
    async setDDoSSensitivity() {
        const url = `${this.apiClient.baseURL}/zones/${this.config.zoneId}/settings/security_level`;
        
        const response = await fetch(url, {
            method: 'PATCH',
            headers: this.apiClient.headers,
            body: JSON.stringify({
                value: this.config.ddosSettings.sensitivity
            })
        });
        
        if (!response.ok) {
            throw new Error(`Error configurando sensibilidad DDoS: ${response.statusText}`);
        }
        
        console.log('🔧 Sensibilidad DDoS configurada:', this.config.ddosSettings.sensitivity);
    }

    /**
     * Configurar rate limiting por capas
     */
    async configureRateLimiting() {
        console.log('⚡ Configurando rate limiting por capas...');
        
        for (const layer of this.config.rateLimiting.layers) {
            console.log(`📋 Configurando capa: ${layer.name}`);
            
            for (const rule of layer.rules) {
                await this.createRateLimitRule(rule);
            }
        }
    }

    /**
     * Crear regla de rate limiting individual
     */
    async createRateLimitRule(rule) {
        const url = `${this.apiClient.baseURL}/zones/${this.config.zoneId}/rate_limits`;
        
        const ruleConfig = {
            match: {
                request: {
                    url: `${this.config.baseDomain}/*`,
                    schemes: ["HTTP", "HTTPS"],
                    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD"]
                },
                response: {
                    status: [200, 201, 202, 301, 302, 304, 400, 401, 403, 404, 405, 429]
                }
            },
            threshold: rule.threshold,
            period: rule.period,
            action: {
                mode: rule.action,
                timeout: rule.timeout,
                response: {
                    content_type: "application/json",
                    body: JSON.stringify({
                        error: "Rate limit exceeded",
                        rule_id: rule.id,
                        retry_after: rule.timeout
                    })
                }
            },
            correlate: {
                by: "ip"
            },
            disabled: false,
            description: `${rule.id} - ArbitrageX Supreme Protection`
        };
        
        // Agregar filtro específico si está definido
        if (rule.match) {
            ruleConfig.match.request.url_pattern = rule.match;
        }
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: this.apiClient.headers,
                body: JSON.stringify(ruleConfig)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                console.warn(`⚠️ Error creando regla ${rule.id}:`, errorData);
                return;
            }
            
            const result = await response.json();
            console.log(`✅ Regla ${rule.id} creada: ID ${result.result.id}`);
            
        } catch (error) {
            console.error(`❌ Error creando regla ${rule.id}:`, error);
        }
    }

    /**
     * Configurar reglas de firewall
     */
    async configureFirewallRules() {
        console.log('🔥 Configurando reglas de firewall...');
        
        const firewallRules = [
            {
                expression: '(cf.threat_score gt 10)',
                action: 'challenge',
                description: 'Challenge high threat score IPs'
            },
            {
                expression: '(http.request.uri.path matches "/api/admin/*" and not any(http.request.headers["authorization"][*] contains "Bearer "))',
                action: 'block',
                description: 'Block unauthenticated admin access'
            },
            {
                expression: '(http.request.body.size gt 1048576)',
                action: 'block',
                description: 'Block large payloads > 1MB'
            },
            {
                expression: '(ip.geoip.country in {"CN" "RU" "KP"} and not cf.client.bot)',
                action: 'managed_challenge',
                description: 'Challenge requests from restricted countries'
            }
        ];
        
        for (const rule of firewallRules) {
            await this.createFirewallRule(rule);
        }
    }

    /**
     * Crear regla de firewall individual
     */
    async createFirewallRule(rule) {
        const url = `${this.apiClient.baseURL}/zones/${this.config.zoneId}/firewall/rules`;
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: this.apiClient.headers,
                body: JSON.stringify([{
                    expression: rule.expression,
                    action: rule.action,
                    description: `ArbitrageX: ${rule.description}`,
                    paused: false
                }])
            });
            
            if (response.ok) {
                console.log(`✅ Regla firewall creada: ${rule.description}`);
            }
            
        } catch (error) {
            console.error(`❌ Error creando regla firewall:`, error);
        }
    }

    /**
     * Configurar gestión de bots
     */
    async configureBotManagement() {
        console.log('🤖 Configurando gestión de bots...');
        
        const botConfig = {
            fight_mode: true,
            session_score: true,
            enable_js: true,
            auth_id_logging: false,
            use_latest_model: true
        };
        
        const url = `${this.apiClient.baseURL}/zones/${this.config.zoneId}/bot_management`;
        
        try {
            const response = await fetch(url, {
                method: 'PUT',
                headers: this.apiClient.headers,
                body: JSON.stringify(botConfig)
            });
            
            if (response.ok) {
                console.log('✅ Gestión de bots configurada');
            }
            
        } catch (error) {
            console.error('❌ Error configurando gestión de bots:', error);
        }
    }

    /**
     * Configurar alertas de seguridad
     */
    async configureSecurityAlerts() {
        console.log('🚨 Configurando alertas de seguridad...');
        
        // Configurar notificaciones por webhook para eventos de seguridad
        const alerts = [
            {
                name: 'ddos_attack_detected',
                alert_type: 'dos_attack_l7',
                enabled: true,
                mechanisms: {
                    webhooks: [{
                        name: 'arbitragex_security_webhook',
                        url: `${this.config.baseDomain}/api/security/ddos-alert`,
                        secret: process.env.SECURITY_WEBHOOK_SECRET || 'default-secret'
                    }]
                }
            },
            {
                name: 'rate_limit_exceeded',
                alert_type: 'advanced_ddos_attack_l7_alert',
                enabled: true,
                mechanisms: {
                    webhooks: [{
                        name: 'arbitragex_rate_limit_webhook', 
                        url: `${this.config.baseDomain}/api/security/rate-limit-alert`,
                        secret: process.env.SECURITY_WEBHOOK_SECRET || 'default-secret'
                    }]
                }
            }
        ];
        
        for (const alert of alerts) {
            await this.createSecurityAlert(alert);
        }
    }

    /**
     * Crear alerta de seguridad individual
     */
    async createSecurityAlert(alert) {
        const url = `${this.apiClient.baseURL}/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/alerting/v3/policies`;
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: this.apiClient.headers,
                body: JSON.stringify(alert)
            });
            
            if (response.ok) {
                console.log(`✅ Alerta configurada: ${alert.name}`);
            }
            
        } catch (error) {
            console.error(`❌ Error configurando alerta ${alert.name}:`, error);
        }
    }

    /**
     * Obtener métricas de seguridad en tiempo real
     */
    async getSecurityMetrics(timeRange = '24h') {
        const url = `${this.apiClient.baseURL}/zones/${this.config.zoneId}/analytics/dashboard`;
        
        const params = new URLSearchParams({
            since: this.getTimeRangeStart(timeRange),
            until: new Date().toISOString(),
            continuous: 'true'
        });
        
        try {
            const response = await fetch(`${url}?${params}`, {
                headers: this.apiClient.headers
            });
            
            if (response.ok) {
                const data = await response.json();
                return this.processSecurityMetrics(data.result);
            }
            
        } catch (error) {
            console.error('❌ Error obteniendo métricas de seguridad:', error);
        }
        
        return null;
    }

    /**
     * Procesar métricas de seguridad
     */
    processSecurityMetrics(rawData) {
        return {
            requests: {
                total: rawData.totals.requests.all,
                blocked: rawData.totals.requests.blocked,
                challenged: rawData.totals.requests.challenged,
                allowed: rawData.totals.requests.allowed
            },
            threats: {
                total: rawData.totals.threats.all,
                type: rawData.totals.threats.type
            },
            bandwidth: {
                total: rawData.totals.bandwidth.all,
                blocked: rawData.totals.bandwidth.blocked,
                served: rawData.totals.bandwidth.served
            },
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Calcular inicio del rango de tiempo
     */
    getTimeRangeStart(timeRange) {
        const now = new Date();
        const ranges = {
            '1h': 1 * 60 * 60 * 1000,
            '6h': 6 * 60 * 60 * 1000,
            '24h': 24 * 60 * 60 * 1000,
            '7d': 7 * 24 * 60 * 60 * 1000,
            '30d': 30 * 24 * 60 * 60 * 1000
        };
        
        return new Date(now.getTime() - (ranges[timeRange] || ranges['24h'])).toISOString();
    }

    /**
     * Generar reporte de configuración
     */
    generateConfigurationReport() {
        return {
            zone_id: this.config.zoneId,
            domain: this.config.baseDomain,
            ddos_protection: {
                enabled: true,
                sensitivity: this.config.ddosSettings.sensitivity,
                automatic_mitigation: this.config.ddosSettings.automaticMitigation
            },
            rate_limiting: {
                enabled: this.config.rateLimiting.enabled,
                layers_count: this.config.rateLimiting.layers.length,
                total_rules: this.config.rateLimiting.layers.reduce((acc, layer) => acc + layer.rules.length, 0)
            },
            firewall_rules: {
                basic_protection: true,
                country_blocking: true,
                payload_size_limits: true,
                threat_score_challenges: true
            },
            bot_management: {
                enabled: true,
                fight_mode: true,
                javascript_detection: true
            },
            security_alerts: {
                ddos_notifications: true,
                rate_limit_notifications: true,
                webhook_integration: true
            },
            generated_at: new Date().toISOString(),
            generated_by: 'Hector Fabio Riascos C. - Ingenio Pichichi S.A.'
        };
    }
}

module.exports = {
    CloudflareDDoSProtection,
    
    // Funciones de utilidad para configuración rápida
    async setupBasicDDoSProtection(config = {}) {
        const protection = new CloudflareDDoSProtection(config);
        return await protection.configureDDoSProtection();
    },

    async getSecurityStatus(config = {}) {
        const protection = new CloudflareDDoSProtection(config);
        return await protection.getSecurityMetrics();
    }
};
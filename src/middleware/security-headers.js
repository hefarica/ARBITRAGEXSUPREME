/**
 * Middleware de Headers de Seguridad para ArbitrageX Supreme
 * Ingenio Pichichi S.A. - Metodología Cumplidor, disciplinado, organizado
 * 
 * Implementa headers de seguridad estándar:
 * - HSTS (HTTP Strict Transport Security)
 * - CSP (Content Security Policy)
 * - CORS (Cross-Origin Resource Sharing)
 * - X-Frame-Options, X-Content-Type-Options, etc.
 * - Protección contra ataques XSS, clickjacking, MIME sniffing
 * 
 * @author Hector Fabio Riascos C.
 * @version 1.0.0
 * @date 2025-01-15
 */

/**
 * Configuración de headers de seguridad
 */
const SECURITY_HEADERS_CONFIG = {
    // HTTP Strict Transport Security
    hsts: {
        enabled: true,
        maxAge: 31536000,        // 1 año en segundos
        includeSubDomains: true,
        preload: true
    },

    // Content Security Policy
    csp: {
        enabled: true,
        reportOnly: false,       // Cambiar a true para testing inicial
        
        // Políticas por tipo de contenido
        directives: {
            'default-src': ["'self'"],
            'script-src': [
                "'self'",
                "'unsafe-inline'",    // Necesario para algunos scripts inline
                "'unsafe-eval'",      // Necesario para WebAssembly y algunas librerías
                'https://cdn.tailwindcss.com',
                'https://cdn.jsdelivr.net',
                'https://cdnjs.cloudflare.com',
                'https://unpkg.com',
                'https://code.jquery.com',
                'https://stackpath.bootstrapcdn.com'
            ],
            'style-src': [
                "'self'",
                "'unsafe-inline'",    // Necesario para estilos inline y frameworks CSS
                'https://cdn.tailwindcss.com',
                'https://cdn.jsdelivr.net',
                'https://cdnjs.cloudflare.com',
                'https://fonts.googleapis.com',
                'https://stackpath.bootstrapcdn.com'
            ],
            'img-src': [
                "'self'",
                'data:',             // Para imágenes base64
                'blob:',             // Para imágenes generadas
                'https:',            // Permitir HTTPS images
                '*.cloudinary.com',  // CDN de imágenes
                '*.amazonaws.com'    // S3 buckets
            ],
            'font-src': [
                "'self'",
                'https://fonts.gstatic.com',
                'https://cdn.jsdelivr.net',
                'https://cdnjs.cloudflare.com'
            ],
            'connect-src': [
                "'self'",
                'https:',            // APIs HTTPS
                'wss:',              // WebSocket seguro
                'https://*.ethereum.org',      // Ethereum RPCs
                'https://*.polygon.technology', // Polygon RPCs
                'https://*.arbitrum.io',       // Arbitrum RPCs
                'https://*.optimism.io',       // Optimism RPCs
                'https://*.base.org',          // Base RPCs
                'https://api.coingecko.com',   // Price APIs
                'https://api.coinmarketcap.com',
                'https://pro-api.coinmarketcap.com'
            ],
            'frame-src': [
                "'none'"             // Prevenir iframes
            ],
            'object-src': [
                "'none'"             // Prevenir plugins
            ],
            'media-src': [
                "'self'",
                'blob:',
                'https:'
            ],
            'worker-src': [
                "'self'",
                'blob:'
            ],
            'child-src': [
                "'self'",
                'blob:'
            ],
            'manifest-src': [
                "'self'"
            ],
            'base-uri': [
                "'self'"
            ],
            'form-action': [
                "'self'"
            ]
        },

        // Configuración adicional
        reportUri: '/api/security/csp-report',
        upgradeInsecureRequests: true,
        blockAllMixedContent: true
    },

    // Cross-Origin Resource Sharing
    cors: {
        enabled: true,
        
        // Orígenes permitidos por tipo de endpoint
        origins: {
            api: [
                'https://arbitragex-supreme.pages.dev',
                'https://*.arbitragex-supreme.pages.dev',
                'https://localhost:3000',
                'http://localhost:3000',
                'http://127.0.0.1:3000'
            ],
            websocket: [
                'https://arbitragex-supreme.pages.dev',
                'https://*.arbitragex-supreme.pages.dev',
                'wss://arbitragex-supreme.pages.dev',
                'wss://*.arbitragex-supreme.pages.dev'
            ],
            public: ['*'] // Para endpoints públicos como health checks
        },

        // Métodos HTTP permitidos
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        
        // Headers permitidos
        allowedHeaders: [
            'Content-Type',
            'Authorization',
            'X-Requested-With',
            'Accept',
            'Origin',
            'Cache-Control',
            'X-API-Key',
            'X-Client-Version',
            'X-Device-ID'
        ],
        
        // Headers expuestos al cliente
        exposedHeaders: [
            'X-RateLimit-Limit',
            'X-RateLimit-Remaining', 
            'X-RateLimit-Reset',
            'X-Token-Rotation-Required',
            'X-System-Load'
        ],

        // Configuraciones adicionales
        credentials: true,        // Permitir cookies/auth headers
        maxAge: 86400,           // Cache de preflight: 24 horas
        optionsSuccessStatus: 204 // Status para OPTIONS requests
    },

    // Headers adicionales de seguridad
    additionalHeaders: {
        // Prevenir clickjacking
        'X-Frame-Options': 'DENY',
        
        // Prevenir MIME type sniffing
        'X-Content-Type-Options': 'nosniff',
        
        // Habilitar protección XSS del navegador
        'X-XSS-Protection': '1; mode=block',
        
        // Referrer Policy
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        
        // Permissions Policy (antes Feature Policy)
        'Permissions-Policy': 
            'camera=(), ' +
            'microphone=(), ' +
            'geolocation=(), ' +
            'payment=(), ' +
            'usb=(), ' +
            'bluetooth=()',
        
        // Cross-Origin Policies
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp',
        'Cross-Origin-Resource-Policy': 'same-origin',
        
        // Server identification
        'X-Powered-By': 'ArbitrageX Supreme v1.0 - Ingenio Pichichi S.A.',
        
        // Cache control para recursos seguros
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        'Pragma': 'no-cache',
        'Expires': '0'
    }
};

/**
 * Clase principal para gestión de headers de seguridad
 */
class SecurityHeadersManager {
    constructor(config = {}) {
        this.config = { ...SECURITY_HEADERS_CONFIG, ...config };
    }

    /**
     * Middleware principal para headers de seguridad
     */
    async middleware(c, next) {
        try {
            // Ejecutar request primero
            await next();
            
            // Aplicar headers de seguridad después de la respuesta
            this.applySecurityHeaders(c);
            
        } catch (error) {
            // Aplicar headers incluso si hay error
            this.applySecurityHeaders(c);
            throw error;
        }
    }

    /**
     * Aplicar todos los headers de seguridad
     */
    applySecurityHeaders(c) {
        // HSTS
        if (this.config.hsts.enabled) {
            this.applyHSTSHeader(c);
        }

        // CSP
        if (this.config.csp.enabled) {
            this.applyCSPHeader(c);
        }

        // Headers adicionales
        this.applyAdditionalHeaders(c);

        // CORS se maneja por separado en su propio middleware
    }

    /**
     * Aplicar HTTP Strict Transport Security
     */
    applyHSTSHeader(c) {
        const { maxAge, includeSubDomains, preload } = this.config.hsts;
        
        let hstsValue = `max-age=${maxAge}`;
        
        if (includeSubDomains) {
            hstsValue += '; includeSubDomains';
        }
        
        if (preload) {
            hstsValue += '; preload';
        }
        
        c.header('Strict-Transport-Security', hstsValue);
    }

    /**
     * Aplicar Content Security Policy
     */
    applyCSPHeader(c) {
        const cspDirectives = [];
        
        // Construir directivas CSP
        for (const [directive, values] of Object.entries(this.config.csp.directives)) {
            if (Array.isArray(values) && values.length > 0) {
                cspDirectives.push(`${directive} ${values.join(' ')}`);
            }
        }

        // Agregar configuraciones adicionales
        if (this.config.csp.upgradeInsecureRequests) {
            cspDirectives.push('upgrade-insecure-requests');
        }

        if (this.config.csp.blockAllMixedContent) {
            cspDirectives.push('block-all-mixed-content');
        }

        if (this.config.csp.reportUri) {
            cspDirectives.push(`report-uri ${this.config.csp.reportUri}`);
        }

        const cspValue = cspDirectives.join('; ');
        
        // Usar Content-Security-Policy-Report-Only para testing
        const headerName = this.config.csp.reportOnly 
            ? 'Content-Security-Policy-Report-Only'
            : 'Content-Security-Policy';
            
        c.header(headerName, cspValue);
    }

    /**
     * Aplicar headers adicionales de seguridad
     */
    applyAdditionalHeaders(c) {
        for (const [headerName, headerValue] of Object.entries(this.config.additionalHeaders)) {
            c.header(headerName, headerValue);
        }
    }

    /**
     * Middleware CORS específico por endpoint
     */
    createCORSMiddleware(endpointType = 'api') {
        return async (c, next) => {
            const origin = c.req.header('Origin');
            const method = c.req.method;
            
            // Determinar orígenes permitidos basado en el tipo de endpoint
            const allowedOrigins = this.config.cors.origins[endpointType] || this.config.cors.origins.api;
            
            // Verificar si el origen está permitido
            const isOriginAllowed = this.isOriginAllowed(origin, allowedOrigins);
            
            // Manejar preflight OPTIONS request
            if (method === 'OPTIONS') {
                return this.handlePreflightRequest(c, origin, isOriginAllowed);
            }
            
            // Aplicar headers CORS para requests normales
            if (isOriginAllowed) {
                this.applyCORSHeaders(c, origin);
            }
            
            await next();
        };
    }

    /**
     * Verificar si un origen está permitido
     */
    isOriginAllowed(origin, allowedOrigins) {
        if (!origin) return false;
        if (allowedOrigins.includes('*')) return true;
        
        // Verificar coincidencias exactas
        if (allowedOrigins.includes(origin)) return true;
        
        // Verificar patrones con wildcards
        return allowedOrigins.some(allowed => {
            if (allowed.includes('*')) {
                const pattern = allowed.replace(/\*/g, '.*');
                const regex = new RegExp(`^${pattern}$`);
                return regex.test(origin);
            }
            return false;
        });
    }

    /**
     * Manejar request preflight OPTIONS
     */
    handlePreflightRequest(c, origin, isOriginAllowed) {
        if (!isOriginAllowed) {
            return c.text('CORS: Origin not allowed', 403);
        }

        // Headers de preflight
        c.header('Access-Control-Allow-Origin', origin);
        c.header('Access-Control-Allow-Methods', this.config.cors.methods.join(', '));
        c.header('Access-Control-Allow-Headers', this.config.cors.allowedHeaders.join(', '));
        
        if (this.config.cors.credentials) {
            c.header('Access-Control-Allow-Credentials', 'true');
        }
        
        c.header('Access-Control-Max-Age', this.config.cors.maxAge.toString());
        
        return c.text('', this.config.cors.optionsSuccessStatus);
    }

    /**
     * Aplicar headers CORS para requests normales
     */
    applyCORSHeaders(c, origin) {
        c.header('Access-Control-Allow-Origin', origin);
        
        if (this.config.cors.exposedHeaders.length > 0) {
            c.header('Access-Control-Expose-Headers', this.config.cors.exposedHeaders.join(', '));
        }
        
        if (this.config.cors.credentials) {
            c.header('Access-Control-Allow-Credentials', 'true');
        }
        
        // Vary header para cacheo correcto
        c.header('Vary', 'Origin');
    }

    /**
     * Middleware para reportes CSP
     */
    createCSPReportHandler() {
        return async (c) => {
            try {
                const report = await c.req.json();
                
                // Log del reporte CSP
                const logEntry = {
                    timestamp: new Date().toISOString(),
                    type: 'csp_violation',
                    report: report,
                    userAgent: c.req.header('User-Agent'),
                    ip: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
                    referrer: c.req.header('Referer')
                };
                
                console.warn('CSP Violation Report:', JSON.stringify(logEntry));
                
                // En producción, enviar a sistema de monitoreo
                await this.handleCSPViolation(report, logEntry);
                
                return c.text('', 204); // No Content
                
            } catch (error) {
                console.error('Error procesando reporte CSP:', error);
                return c.text('Bad Request', 400);
            }
        };
    }

    /**
     * Manejar violación CSP
     */
    async handleCSPViolation(report, context) {
        // Analizar tipo de violación
        const violationType = this.analyzeCSPViolation(report);
        
        // Incrementar contador de violaciones
        await this.incrementViolationCounter(violationType);
        
        // Alertar si hay muchas violaciones
        const violationCount = await this.getViolationCount(violationType);
        if (violationCount > 10) { // Umbral configurable
            await this.sendCSPAlert(violationType, violationCount, context);
        }
    }

    /**
     * Analizar tipo de violación CSP
     */
    analyzeCSPViolation(report) {
        const cspReport = report['csp-report'] || report;
        
        if (cspReport['violated-directive']) {
            return cspReport['violated-directive'].split(' ')[0]; // Obtener directiva base
        }
        
        return 'unknown';
    }

    /**
     * Incrementar contador de violaciones
     */
    async incrementViolationCounter(violationType) {
        // En producción, usar KV o métricas para tracking
        console.log(`CSP Violation: ${violationType}`);
    }

    /**
     * Obtener contador de violaciones
     */
    async getViolationCount(violationType) {
        // En producción, obtener de KV o sistema de métricas
        return 0;
    }

    /**
     * Enviar alerta de violaciones CSP
     */
    async sendCSPAlert(violationType, count, context) {
        const alert = {
            type: 'csp_violations_threshold',
            severity: 'medium',
            violationType: violationType,
            count: count,
            context: context,
            timestamp: new Date().toISOString()
        };
        
        console.warn('CSP Alert:', JSON.stringify(alert));
        
        // En producción, enviar a sistema de alertas
    }

    /**
     * Configurar headers específicos para diferentes tipos de contenido
     */
    configureContentTypeHeaders(c, contentType) {
        switch (contentType) {
            case 'application/json':
                // Para APIs JSON
                c.header('X-Content-Type-Options', 'nosniff');
                c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
                break;
                
            case 'text/html':
                // Para páginas HTML
                c.header('X-Frame-Options', 'DENY');
                c.header('X-XSS-Protection', '1; mode=block');
                break;
                
            case 'application/javascript':
            case 'text/javascript':
                // Para archivos JavaScript
                c.header('X-Content-Type-Options', 'nosniff');
                c.header('Cache-Control', 'public, max-age=31536000, immutable');
                break;
                
            case 'text/css':
                // Para archivos CSS
                c.header('X-Content-Type-Options', 'nosniff');
                c.header('Cache-Control', 'public, max-age=31536000, immutable');
                break;
        }
    }
}

/**
 * Factory functions para crear middlewares
 */

/**
 * Crear middleware de headers de seguridad
 */
export function createSecurityHeadersMiddleware(config = {}) {
    const manager = new SecurityHeadersManager(config);
    
    return async (c, next) => {
        return await manager.middleware(c, next);
    };
}

/**
 * Crear middleware CORS específico
 */
export function createCORSMiddleware(endpointType = 'api', config = {}) {
    const manager = new SecurityHeadersManager(config);
    
    return manager.createCORSMiddleware(endpointType);
}

/**
 * Crear handler para reportes CSP
 */
export function createCSPReportHandler(config = {}) {
    const manager = new SecurityHeadersManager(config);
    
    return manager.createCSPReportHandler();
}

/**
 * Middleware específico para APIs
 */
export function createAPISecurityMiddleware(config = {}) {
    return async (c, next) => {
        const manager = new SecurityHeadersManager(config);
        
        // Headers específicos para APIs
        c.header('X-API-Version', '1.0');
        c.header('X-Response-Time', Date.now().toString());
        
        // Aplicar CORS para APIs
        await manager.createCORSMiddleware('api')(c, async () => {
            // Aplicar security headers
            await manager.middleware(c, next);
        });
    };
}

/**
 * Middleware específico para WebSocket
 */
export function createWebSocketSecurityMiddleware(config = {}) {
    return async (c, next) => {
        const manager = new SecurityHeadersManager(config);
        
        // Headers específicos para WebSocket upgrade
        const upgrade = c.req.header('Upgrade');
        if (upgrade && upgrade.toLowerCase() === 'websocket') {
            // Aplicar CORS para WebSocket
            await manager.createCORSMiddleware('websocket')(c, next);
        } else {
            await next();
        }
    };
}

/**
 * Configuración predefinida para diferentes entornos
 */
export const SECURITY_CONFIGS = {
    // Configuración para desarrollo
    development: {
        ...SECURITY_HEADERS_CONFIG,
        csp: {
            ...SECURITY_HEADERS_CONFIG.csp,
            reportOnly: true, // Solo reportar, no bloquear en desarrollo
            directives: {
                ...SECURITY_HEADERS_CONFIG.csp.directives,
                'script-src': [
                    ...SECURITY_HEADERS_CONFIG.csp.directives['script-src'],
                    "'unsafe-eval'",      // Permitir eval en desarrollo
                    'localhost:*',
                    '127.0.0.1:*'
                ],
                'connect-src': [
                    ...SECURITY_HEADERS_CONFIG.csp.directives['connect-src'],
                    'localhost:*',
                    '127.0.0.1:*',
                    'ws://localhost:*',
                    'ws://127.0.0.1:*'
                ]
            }
        },
        cors: {
            ...SECURITY_HEADERS_CONFIG.cors,
            origins: {
                api: ['*'], // Permitir todos los orígenes en desarrollo
                websocket: ['*'],
                public: ['*']
            }
        }
    },
    
    // Configuración para producción
    production: {
        ...SECURITY_HEADERS_CONFIG,
        csp: {
            ...SECURITY_HEADERS_CONFIG.csp,
            reportOnly: false, // Bloquear violaciones en producción
        },
        additionalHeaders: {
            ...SECURITY_HEADERS_CONFIG.additionalHeaders,
            'Cache-Control': 'public, max-age=3600, s-maxage=7200', // Cache más agresivo en producción
        }
    }
};

export { SecurityHeadersManager, SECURITY_HEADERS_CONFIG };
/**
 * Sistema de Validación de Entrada para ArbitrageX Supreme
 * Ingenio Pichichi S.A. - Metodología Cumplidor, disciplinado, organizado
 * 
 * Validación comprehensive de entrada incluyendo:
 * - Sanitización de datos de entrada
 * - Validación de esquemas JSON
 * - Protección contra inyecciones
 * - Validación de tipos de datos
 * - Rate limiting específico por tipo de validación
 * - Logging de intentos de ataque
 * 
 * @author Hector Fabio Riascos C.
 * @version 1.0.0
 * @date 2025-01-15
 */

/**
 * Configuración de validación de entrada
 */
const INPUT_VALIDATION_CONFIG = {
    // Configuración general
    general: {
        maxRequestSize: 1048576,    // 1MB máximo por request
        maxArrayLength: 1000,       // Máximo 1000 elementos en arrays
        maxObjectDepth: 10,         // Máxima profundidad de objetos anidados
        maxStringLength: 10000,     // Máxima longitud de strings
        stripNullBytes: true,       // Remover bytes nulos
        normalizeUnicode: true      // Normalizar caracteres Unicode
    },

    // Patrones de validación
    patterns: {
        email: /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,
        uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        hexString: /^0x[a-fA-F0-9]+$/,
        alphanumeric: /^[a-zA-Z0-9]+$/,
        numeric: /^\d+$/,
        decimal: /^\d+(\.\d+)?$/,
        
        // Blockchain específicos
        ethereumAddress: /^0x[a-fA-F0-9]{40}$/,
        bitcoinAddress: /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/,
        transactionHash: /^0x[a-fA-F0-9]{64}$/,
        
        // Trading específicos
        symbol: /^[A-Z]{3,10}$/,
        price: /^\d+(\.\d{1,18})?$/,
        amount: /^\d+(\.\d{1,18})?$/
    },

    // Patrones de ataques conocidos
    attackPatterns: {
        sqlInjection: [
            /('|(\\'))+.*(select|union|insert|delete|update|drop|exec|script|alter|create)/i,
            /(union\s+select|union\s+all\s+select)/i,
            /(select.*from|insert.*into|update.*set|delete.*from)/i,
            /('\s*(or|and)\s*'[^']*'[\s]*=[\s]*')/i
        ],
        xss: [
            /<script[^>]*>.*?<\/script>/gi,
            /<iframe[^>]*>.*?<\/iframe>/gi,
            /javascript:/gi,
            /on\w+\s*=/gi,
            /<img[^>]+src[\\s]*=[\\s]*[\"\\']javascript:/gi
        ],
        pathTraversal: [
            /\.\.[\/\\]/g,
            /(\.\.%2f|\.\.%5c)/gi,
            /(etc\/passwd|boot\.ini|windows\/system32)/gi
        ],
        commandInjection: [
            /[;&|`$(){}[\]]/g,
            /(nc\s|netcat|wget|curl|chmod|rm\s|kill)/gi,
            /(\|\||\&\&|;|`)/g
        ],
        ldapInjection: [
            /(\*|\(|\)|\||&)/g,
            /(objectclass=\*)/gi
        ]
    },

    // Configuración de sanitización
    sanitization: {
        html: {
            enabled: true,
            allowedTags: [],        // No permitir ningún tag HTML
            allowedAttributes: {}   // No permitir atributos
        },
        sql: {
            enabled: true,
            escapeQuotes: true,
            removeSemicolons: true,
            removeComments: true
        },
        javascript: {
            enabled: true,
            removeEval: true,
            removeOnEvents: true,
            removeScriptTags: true
        }
    },

    // Esquemas de validación por endpoint
    schemas: {
        // Autenticación
        auth: {
            login: {
                email: { type: 'string', pattern: 'email', required: true, maxLength: 255 },
                password: { type: 'string', required: true, minLength: 8, maxLength: 128 },
                rememberMe: { type: 'boolean', required: false }
            },
            refresh: {
                refreshToken: { type: 'string', required: true, minLength: 10, maxLength: 1000 }
            }
        },

        // Trading
        trading: {
            order: {
                type: { type: 'string', enum: ['market', 'limit', 'stop'], required: true },
                side: { type: 'string', enum: ['buy', 'sell'], required: true },
                symbol: { type: 'string', pattern: 'symbol', required: true },
                amount: { type: 'string', pattern: 'amount', required: true },
                price: { type: 'string', pattern: 'price', required: false },
                stopPrice: { type: 'string', pattern: 'price', required: false }
            },
            cancel: {
                orderId: { type: 'string', pattern: 'uuid', required: true }
            }
        },

        // Arbitrage
        arbitrage: {
            opportunity: {
                fromExchange: { type: 'string', required: true, maxLength: 50 },
                toExchange: { type: 'string', required: true, maxLength: 50 },
                symbol: { type: 'string', pattern: 'symbol', required: true },
                amount: { type: 'string', pattern: 'amount', required: true },
                expectedProfit: { type: 'string', pattern: 'decimal', required: true }
            }
        },

        // Blockchain
        blockchain: {
            transaction: {
                to: { type: 'string', pattern: 'ethereumAddress', required: true },
                value: { type: 'string', pattern: 'hexString', required: false },
                data: { type: 'string', pattern: 'hexString', required: false },
                gasLimit: { type: 'string', pattern: 'numeric', required: false },
                gasPrice: { type: 'string', pattern: 'numeric', required: false }
            },
            address: {
                address: { type: 'string', pattern: 'ethereumAddress', required: true },
                network: { type: 'string', enum: ['ethereum', 'polygon', 'arbitrum', 'optimism', 'base'], required: true }
            }
        },

        // Portfolio
        portfolio: {
            update: {
                holdings: {
                    type: 'array',
                    maxLength: 100,
                    items: {
                        symbol: { type: 'string', pattern: 'symbol', required: true },
                        amount: { type: 'string', pattern: 'amount', required: true },
                        exchange: { type: 'string', required: true, maxLength: 50 }
                    }
                }
            }
        }
    }
};

/**
 * Clase principal para validación de entrada
 */
class InputValidationManager {
    constructor(env) {
        this.env = env;
        this.config = INPUT_VALIDATION_CONFIG;
        
        // Contadores de ataques detectados
        this.attackCounters = new Map();
        
        // Cache de validaciones recientes
        this.validationCache = new Map();
    }

    /**
     * Middleware principal de validación
     */
    async middleware(schemaPath) {
        return async (c, next) => {
            try {
                const startTime = Date.now();
                
                // Verificar tamaño del request
                if (await this.isRequestTooLarge(c)) {
                    return this.createValidationError(c, 'Request too large', 'REQUEST_TOO_LARGE', 413);
                }

                // Obtener y validar el body si existe
                const contentType = c.req.header('Content-Type') || '';
                let validationResult = { valid: true, data: null };

                if (contentType.includes('application/json') && ['POST', 'PUT', 'PATCH'].includes(c.req.method)) {
                    const rawBody = await c.req.text();
                    validationResult = await this.validateJSONInput(rawBody, schemaPath);
                    
                    if (!validationResult.valid) {
                        return this.createValidationError(c, validationResult.error, 'VALIDATION_ERROR', 400, validationResult.details);
                    }
                    
                    // Agregar datos validados al contexto
                    c.set('validatedData', validationResult.data);
                }

                // Validar query parameters
                const queryValidation = await this.validateQueryParams(c, schemaPath);
                if (!queryValidation.valid) {
                    return this.createValidationError(c, queryValidation.error, 'QUERY_VALIDATION_ERROR', 400);
                }

                // Validar headers críticos
                const headersValidation = await this.validateCriticalHeaders(c);
                if (!headersValidation.valid) {
                    return this.createValidationError(c, headersValidation.error, 'HEADER_VALIDATION_ERROR', 400);
                }

                // Detectar patrones de ataque
                const attackDetection = await this.detectAttackPatterns(c, validationResult.data);
                if (attackDetection.detected) {
                    await this.logAttackAttempt(c, attackDetection);
                    return this.createValidationError(c, 'Malicious input detected', 'MALICIOUS_INPUT', 403);
                }

                // Log de validación exitosa
                await this.logValidationSuccess(c, schemaPath, Date.now() - startTime);

                await next();

            } catch (error) {
                console.error('Error en validación de entrada:', error);
                
                // En caso de error, loggear pero continuar
                await this.logValidationError(c, error);
                
                return this.createValidationError(c, 'Validation system error', 'VALIDATION_SYSTEM_ERROR', 500);
            }
        };
    }

    /**
     * Verificar si el request es demasiado grande
     */
    async isRequestTooLarge(c) {
        const contentLength = c.req.header('Content-Length');
        if (contentLength && parseInt(contentLength, 10) > this.config.general.maxRequestSize) {
            return true;
        }
        return false;
    }

    /**
     * Validar entrada JSON
     */
    async validateJSONInput(rawBody, schemaPath) {
        try {
            // Verificar si el JSON no está vacío
            if (!rawBody || rawBody.trim() === '') {
                return { valid: false, error: 'Empty request body' };
            }

            // Parsear JSON
            let data;
            try {
                data = JSON.parse(rawBody);
            } catch (parseError) {
                return { valid: false, error: 'Invalid JSON format', details: parseError.message };
            }

            // Verificar profundidad del objeto
            if (this.getObjectDepth(data) > this.config.general.maxObjectDepth) {
                return { valid: false, error: 'Object nesting too deep' };
            }

            // Sanitizar datos
            const sanitizedData = await this.sanitizeData(data);

            // Validar contra esquema si existe
            if (schemaPath) {
                const schema = this.getSchema(schemaPath);
                if (schema) {
                    const schemaValidation = await this.validateAgainstSchema(sanitizedData, schema);
                    if (!schemaValidation.valid) {
                        return schemaValidation;
                    }
                }
            }

            return { valid: true, data: sanitizedData };

        } catch (error) {
            return { valid: false, error: 'JSON validation failed', details: error.message };
        }
    }

    /**
     * Validar query parameters
     */
    async validateQueryParams(c, schemaPath) {
        try {
            const url = new URL(c.req.url);
            const params = Object.fromEntries(url.searchParams);

            // Sanitizar parámetros
            for (const [key, value] of Object.entries(params)) {
                // Verificar longitud
                if (value.length > this.config.general.maxStringLength) {
                    return { valid: false, error: `Query parameter '${key}' too long` };
                }

                // Sanitizar valor
                params[key] = await this.sanitizeString(value);
            }

            // Agregar parámetros sanitizados al contexto
            c.set('validatedQuery', params);

            return { valid: true };

        } catch (error) {
            return { valid: false, error: 'Query parameter validation failed' };
        }
    }

    /**
     * Validar headers críticos
     */
    async validateCriticalHeaders(c) {
        try {
            const userAgent = c.req.header('User-Agent');
            const contentType = c.req.header('Content-Type');
            
            // Validar User-Agent
            if (userAgent && userAgent.length > 1000) {
                return { valid: false, error: 'User-Agent header too long' };
            }

            // Validar Content-Type para requests con body
            if (['POST', 'PUT', 'PATCH'].includes(c.req.method) && contentType) {
                const allowedContentTypes = [
                    'application/json',
                    'application/x-www-form-urlencoded',
                    'multipart/form-data'
                ];
                
                const isValidContentType = allowedContentTypes.some(type => 
                    contentType.toLowerCase().includes(type)
                );
                
                if (!isValidContentType) {
                    return { valid: false, error: 'Invalid Content-Type' };
                }
            }

            return { valid: true };

        } catch (error) {
            return { valid: false, error: 'Header validation failed' };
        }
    }

    /**
     * Detectar patrones de ataque
     */
    async detectAttackPatterns(c, data) {
        const allText = this.extractAllText(data);
        const detectedAttacks = [];

        // Verificar cada tipo de ataque
        for (const [attackType, patterns] of Object.entries(this.config.attackPatterns)) {
            for (const pattern of patterns) {
                if (pattern.test(allText)) {
                    detectedAttacks.push({
                        type: attackType,
                        pattern: pattern.source,
                        match: allText.match(pattern)?.[0]
                    });
                }
            }
        }

        return {
            detected: detectedAttacks.length > 0,
            attacks: detectedAttacks
        };
    }

    /**
     * Extraer todo el texto de un objeto para análisis
     */
    extractAllText(obj, depth = 0) {
        if (depth > 5) return ''; // Prevenir recursión infinita

        let text = '';
        
        if (typeof obj === 'string') {
            text += obj + ' ';
        } else if (Array.isArray(obj)) {
            for (const item of obj) {
                text += this.extractAllText(item, depth + 1);
            }
        } else if (typeof obj === 'object' && obj !== null) {
            for (const value of Object.values(obj)) {
                text += this.extractAllText(value, depth + 1);
            }
        }
        
        return text;
    }

    /**
     * Sanitizar datos recursivamente
     */
    async sanitizeData(data, depth = 0) {
        if (depth > this.config.general.maxObjectDepth) {
            return data;
        }

        if (typeof data === 'string') {
            return await this.sanitizeString(data);
        } else if (Array.isArray(data)) {
            if (data.length > this.config.general.maxArrayLength) {
                throw new Error('Array too long');
            }
            return await Promise.all(data.map(item => this.sanitizeData(item, depth + 1)));
        } else if (typeof data === 'object' && data !== null) {
            const sanitized = {};
            for (const [key, value] of Object.entries(data)) {
                const sanitizedKey = await this.sanitizeString(key);
                sanitized[sanitizedKey] = await this.sanitizeData(value, depth + 1);
            }
            return sanitized;
        }
        
        return data;
    }

    /**
     * Sanitizar string individual
     */
    async sanitizeString(str) {
        if (typeof str !== 'string') return str;

        let sanitized = str;

        // Remover bytes nulos
        if (this.config.general.stripNullBytes) {
            sanitized = sanitized.replace(/\x00/g, '');
        }

        // Normalizar Unicode
        if (this.config.general.normalizeUnicode) {
            sanitized = sanitized.normalize('NFC');
        }

        // Sanitización HTML
        if (this.config.sanitization.html.enabled) {
            sanitized = this.sanitizeHTML(sanitized);
        }

        // Sanitización SQL
        if (this.config.sanitization.sql.enabled) {
            sanitized = this.sanitizeSQL(sanitized);
        }

        // Sanitización JavaScript
        if (this.config.sanitization.javascript.enabled) {
            sanitized = this.sanitizeJavaScript(sanitized);
        }

        return sanitized;
    }

    /**
     * Sanitizar HTML
     */
    sanitizeHTML(str) {
        return str
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');
    }

    /**
     * Sanitizar SQL
     */
    sanitizeSQL(str) {
        let sanitized = str;

        if (this.config.sanitization.sql.escapeQuotes) {
            sanitized = sanitized.replace(/'/g, "''");
        }

        if (this.config.sanitization.sql.removeSemicolons) {
            sanitized = sanitized.replace(/;/g, '');
        }

        if (this.config.sanitization.sql.removeComments) {
            sanitized = sanitized.replace(/--.*$/gm, '');
            sanitized = sanitized.replace(/\/\*.*?\*\//gs, '');
        }

        return sanitized;
    }

    /**
     * Sanitizar JavaScript
     */
    sanitizeJavaScript(str) {
        let sanitized = str;

        if (this.config.sanitization.javascript.removeEval) {
            sanitized = sanitized.replace(/eval\s*\(/gi, 'eval_blocked(');
        }

        if (this.config.sanitization.javascript.removeOnEvents) {
            sanitized = sanitized.replace(/on\w+\s*=/gi, 'on_event_blocked=');
        }

        if (this.config.sanitization.javascript.removeScriptTags) {
            sanitized = sanitized.replace(/<script[^>]*>.*?<\/script>/gi, '');
        }

        return sanitized;
    }

    /**
     * Validar contra esquema
     */
    async validateAgainstSchema(data, schema) {
        const errors = [];

        for (const [field, rules] of Object.entries(schema)) {
            const value = data[field];
            const fieldErrors = this.validateField(field, value, rules);
            errors.push(...fieldErrors);
        }

        // Verificar campos extra no permitidos
        const allowedFields = Object.keys(schema);
        const extraFields = Object.keys(data).filter(field => !allowedFields.includes(field));
        if (extraFields.length > 0) {
            errors.push(`Extra fields not allowed: ${extraFields.join(', ')}`);
        }

        return {
            valid: errors.length === 0,
            error: errors.length > 0 ? 'Schema validation failed' : null,
            details: errors
        };
    }

    /**
     * Validar campo individual
     */
    validateField(fieldName, value, rules) {
        const errors = [];

        // Verificar si es requerido
        if (rules.required && (value === undefined || value === null || value === '')) {
            errors.push(`Field '${fieldName}' is required`);
            return errors; // No continuar si falta campo requerido
        }

        // Si no es requerido y está vacío, no validar más reglas
        if (!rules.required && (value === undefined || value === null || value === '')) {
            return errors;
        }

        // Validar tipo
        if (rules.type && !this.validateType(value, rules.type)) {
            errors.push(`Field '${fieldName}' must be of type ${rules.type}`);
        }

        // Validar longitud mínima
        if (rules.minLength && typeof value === 'string' && value.length < rules.minLength) {
            errors.push(`Field '${fieldName}' must be at least ${rules.minLength} characters long`);
        }

        // Validar longitud máxima
        if (rules.maxLength && typeof value === 'string' && value.length > rules.maxLength) {
            errors.push(`Field '${fieldName}' must not exceed ${rules.maxLength} characters`);
        }

        // Validar patrón
        if (rules.pattern && typeof value === 'string') {
            const pattern = this.config.patterns[rules.pattern];
            if (pattern && !pattern.test(value)) {
                errors.push(`Field '${fieldName}' does not match required pattern`);
            }
        }

        // Validar enum
        if (rules.enum && !rules.enum.includes(value)) {
            errors.push(`Field '${fieldName}' must be one of: ${rules.enum.join(', ')}`);
        }

        // Validar valor mínimo (números)
        if (rules.min && typeof value === 'number' && value < rules.min) {
            errors.push(`Field '${fieldName}' must be at least ${rules.min}`);
        }

        // Validar valor máximo (números)
        if (rules.max && typeof value === 'number' && value > rules.max) {
            errors.push(`Field '${fieldName}' must not exceed ${rules.max}`);
        }

        return errors;
    }

    /**
     * Validar tipo de dato
     */
    validateType(value, expectedType) {
        switch (expectedType) {
            case 'string':
                return typeof value === 'string';
            case 'number':
                return typeof value === 'number' && !isNaN(value);
            case 'boolean':
                return typeof value === 'boolean';
            case 'array':
                return Array.isArray(value);
            case 'object':
                return typeof value === 'object' && !Array.isArray(value) && value !== null;
            default:
                return true;
        }
    }

    /**
     * Obtener esquema de validación
     */
    getSchema(schemaPath) {
        const pathParts = schemaPath.split('.');
        let schema = this.config.schemas;
        
        for (const part of pathParts) {
            if (schema && schema[part]) {
                schema = schema[part];
            } else {
                return null;
            }
        }
        
        return schema;
    }

    /**
     * Obtener profundidad de objeto
     */
    getObjectDepth(obj, depth = 0) {
        if (depth > 20) return depth; // Prevenir stack overflow

        if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
            return depth;
        }

        let maxDepth = depth;
        for (const value of Object.values(obj)) {
            const currentDepth = this.getObjectDepth(value, depth + 1);
            maxDepth = Math.max(maxDepth, currentDepth);
        }

        return maxDepth;
    }

    /**
     * Crear respuesta de error de validación
     */
    createValidationError(c, message, code, status = 400, details = null) {
        const errorResponse = {
            error: message,
            code: code,
            timestamp: new Date().toISOString()
        };

        if (details) {
            errorResponse.details = details;
        }

        return c.json(errorResponse, status);
    }

    /**
     * Logging functions
     */
    async logAttackAttempt(c, attackDetection) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            type: 'attack_attempt',
            ip: c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For'),
            userAgent: c.req.header('User-Agent'),
            path: c.req.path,
            method: c.req.method,
            attacks: attackDetection.attacks
        };

        console.warn('Attack Attempt Detected:', JSON.stringify(logEntry));

        // Incrementar contador de ataques
        const ip = logEntry.ip || 'unknown';
        this.attackCounters.set(ip, (this.attackCounters.get(ip) || 0) + 1);
    }

    async logValidationSuccess(c, schemaPath, processingTime) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            type: 'validation_success',
            path: c.req.path,
            method: c.req.method,
            schema: schemaPath,
            processingTimeMs: processingTime
        };

        console.log('Validation Success:', JSON.stringify(logEntry));
    }

    async logValidationError(c, error) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            type: 'validation_error',
            path: c.req.path,
            method: c.req.method,
            error: error.message,
            stack: error.stack
        };

        console.error('Validation Error:', JSON.stringify(logEntry));
    }
}

/**
 * Factory function para crear middleware de validación
 */
export function createInputValidationMiddleware(schemaPath) {
    return (env) => {
        const validator = new InputValidationManager(env);
        return validator.middleware(schemaPath);
    };
}

/**
 * Middleware específico para diferentes endpoints
 */
export const validationMiddlewares = {
    // Autenticación
    authLogin: createInputValidationMiddleware('auth.login'),
    authRefresh: createInputValidationMiddleware('auth.refresh'),

    // Trading
    tradingOrder: createInputValidationMiddleware('trading.order'),
    tradingCancel: createInputValidationMiddleware('trading.cancel'),

    // Arbitrage
    arbitrageOpportunity: createInputValidationMiddleware('arbitrage.opportunity'),

    // Blockchain
    blockchainTransaction: createInputValidationMiddleware('blockchain.transaction'),
    blockchainAddress: createInputValidationMiddleware('blockchain.address'),

    // Portfolio
    portfolioUpdate: createInputValidationMiddleware('portfolio.update'),

    // Validación general sin esquema específico
    general: createInputValidationMiddleware(null)
};

export { InputValidationManager, INPUT_VALIDATION_CONFIG };
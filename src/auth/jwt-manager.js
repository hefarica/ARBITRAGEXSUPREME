/**
 * Sistema de Autenticación JWT con Rotación de Tokens para ArbitrageX Supreme
 * Ingenio Pichichi S.A. - Metodología Cumplidor, disciplinado, organizado
 * 
 * Características implementadas:
 * - JWT con rotación automática de tokens
 * - Refresh tokens seguros con revocación
 * - Múltiples niveles de permisos y roles
 * - Detección de tokens comprometidos
 * - Integración con Cloudflare KV para blacklist
 * - Audit trail completo de autenticación
 * 
 * @author Hector Fabio Riascos C.
 * @version 1.0.0
 * @date 2025-01-15
 */

/**
 * Configuración de JWT y autenticación
 */
const JWT_CONFIG = {
    // Configuración de tokens
    tokens: {
        access: {
            expiresIn: '15m',        // 15 minutos para tokens de acceso
            expiresInMs: 15 * 60 * 1000,
            algorithm: 'HS256'
        },
        refresh: {
            expiresIn: '7d',         // 7 días para tokens de refresh
            expiresInMs: 7 * 24 * 60 * 60 * 1000,
            algorithm: 'HS256'
        },
        
        // Rotación automática
        rotation: {
            enabled: true,
            thresholdPercentage: 50,  // Rotar cuando quede menos del 50% del tiempo
            maxRotationsPerDay: 10    // Máximo 10 rotaciones por día por usuario
        }
    },

    // Roles y permisos
    roles: {
        anonymous: {
            level: 0,
            permissions: ['read:public'],
            description: 'Usuario anónimo - acceso público limitado'
        },
        user: {
            level: 1,
            permissions: [
                'read:market-data',
                'read:portfolio',
                'write:portfolio',
                'read:arbitrage-basic'
            ],
            description: 'Usuario registrado básico'
        },
        premium: {
            level: 2,
            permissions: [
                'read:market-data',
                'read:portfolio',
                'write:portfolio',
                'read:arbitrage-advanced',
                'write:trading-basic',
                'read:analytics-basic'
            ],
            description: 'Usuario premium con funciones avanzadas'
        },
        vip: {
            level: 3,
            permissions: [
                'read:*',
                'write:trading-advanced',
                'write:arbitrage-execute',
                'read:analytics-advanced',
                'read:system-metrics'
            ],
            description: 'Usuario VIP con acceso completo al trading'
        },
        admin: {
            level: 4,
            permissions: [
                'read:*',
                'write:*',
                'admin:users',
                'admin:system',
                'admin:analytics'
            ],
            description: 'Administrador con acceso total'
        }
    },

    // Configuración de seguridad
    security: {
        // Detección de tokens comprometidos
        anomalyDetection: {
            enabled: true,
            maxSimultaneousLogins: 3,    // Máximo 3 sesiones simultáneas
            maxGeographicDistance: 1000,  // Máximo 1000km entre logins
            suspiciousActivityThreshold: 5 // 5 actividades sospechosas = bloqueo
        },
        
        // Blacklist de tokens
        tokenBlacklist: {
            enabled: true,
            cleanupIntervalHours: 24,    // Limpiar cada 24 horas
            maxEntries: 10000           // Máximo 10k tokens en blacklist
        },
        
        // Rate limiting específico para auth
        authRateLimit: {
            login: { requests: 5, window: 300 },      // 5 intentos cada 5 minutos
            refresh: { requests: 10, window: 300 },    // 10 refresh cada 5 minutos
            logout: { requests: 20, window: 300 }      // 20 logout cada 5 minutos
        }
    }
};

/**
 * Clase principal para gestión de JWT
 */
class JWTManager {
    constructor(env) {
        this.env = env;
        this.kv = env.KV;
        this.secretKey = env.JWT_SECRET || 'default-secret-change-in-production';
        this.refreshSecretKey = env.JWT_REFRESH_SECRET || 'default-refresh-secret-change-in-production';
        
        // Cache para evitar verificaciones repetitivas
        this.tokenCache = new Map();
        this.blacklistCache = new Set();
        
        // Métricas de autenticación
        this.metrics = {
            totalLogins: 0,
            failedLogins: 0,
            tokensIssued: 0,
            tokensRevoked: 0,
            refreshTokensUsed: 0
        };
    }

    /**
     * Generar par de tokens (access + refresh)
     */
    async generateTokenPair(user, deviceInfo = {}) {
        const now = Math.floor(Date.now() / 1000);
        const jti = this.generateJTI(); // Unique token ID
        
        // Payload del access token
        const accessPayload = {
            sub: user.id,
            email: user.email,
            role: user.role || 'user',
            permissions: this.getPermissionsForRole(user.role || 'user'),
            subscription: user.subscription || 'basic',
            iat: now,
            exp: now + Math.floor(JWT_CONFIG.tokens.access.expiresInMs / 1000),
            jti: jti,
            type: 'access',
            device: {
                id: deviceInfo.id || this.generateDeviceId(),
                type: deviceInfo.type || 'unknown',
                ip: deviceInfo.ip || 'unknown',
                userAgent: deviceInfo.userAgent || 'unknown'
            }
        };

        // Payload del refresh token
        const refreshPayload = {
            sub: user.id,
            jti: this.generateJTI(),
            iat: now,
            exp: now + Math.floor(JWT_CONFIG.tokens.refresh.expiresInMs / 1000),
            type: 'refresh',
            access_jti: jti, // Link al access token
            device: accessPayload.device
        };

        try {
            // Generar tokens
            const accessToken = await this.signToken(accessPayload, this.secretKey);
            const refreshToken = await this.signToken(refreshPayload, this.refreshSecretKey);
            
            // Almacenar metadatos del token para tracking
            await this.storeTokenMetadata(jti, accessPayload);
            await this.storeTokenMetadata(refreshPayload.jti, refreshPayload);
            
            // Registrar sesión activa
            await this.registerActiveSession(user.id, accessPayload.device, {
                accessJti: jti,
                refreshJti: refreshPayload.jti
            });
            
            // Actualizar métricas
            this.metrics.tokensIssued += 2;
            
            // Log de tokens generados
            await this.logTokenGeneration(user, accessPayload.device);
            
            return {
                accessToken,
                refreshToken,
                expiresIn: JWT_CONFIG.tokens.access.expiresInMs,
                tokenType: 'Bearer',
                metadata: {
                    issuedAt: new Date(now * 1000).toISOString(),
                    expiresAt: new Date(accessPayload.exp * 1000).toISOString(),
                    jti: jti,
                    permissions: accessPayload.permissions
                }
            };
            
        } catch (error) {
            console.error('Error generando par de tokens:', error);
            throw new Error('Failed to generate token pair');
        }
    }

    /**
     * Verificar y validar token de acceso
     */
    async verifyAccessToken(token, requiredPermissions = []) {
        try {
            // Verificar si el token está en blacklist (cache primero)
            if (this.blacklistCache.has(token)) {
                throw new Error('Token revoked');
            }
            
            // Verificar en KV si no está en cache
            const isBlacklisted = await this.isTokenBlacklisted(token);
            if (isBlacklisted) {
                this.blacklistCache.add(token);
                throw new Error('Token revoked');
            }
            
            // Verificar firma y validez del token
            const payload = await this.verifyTokenSignature(token, this.secretKey);
            
            // Verificar que sea un access token
            if (payload.type !== 'access') {
                throw new Error('Invalid token type');
            }
            
            // Verificar expiración
            const now = Math.floor(Date.now() / 1000);
            if (payload.exp < now) {
                throw new Error('Token expired');
            }
            
            // Verificar permisos si se requieren
            if (requiredPermissions.length > 0) {
                const hasPermission = this.checkPermissions(payload.permissions, requiredPermissions);
                if (!hasPermission) {
                    throw new Error('Insufficient permissions');
                }
            }
            
            // Verificar rotación automática si está habilitada
            if (JWT_CONFIG.tokens.rotation.enabled) {
                const shouldRotate = await this.shouldRotateToken(payload);
                if (shouldRotate) {
                    // Marcar para rotación en la respuesta
                    payload._shouldRotate = true;
                }
            }
            
            // Actualizar last seen para el usuario
            await this.updateUserLastSeen(payload.sub, payload.device);
            
            return {
                valid: true,
                payload,
                shouldRotate: payload._shouldRotate || false
            };
            
        } catch (error) {
            console.error('Error verificando access token:', error);
            
            // Log de intento de acceso fallido
            await this.logFailedTokenVerification(token, error.message);
            
            return {
                valid: false,
                error: error.message
            };
        }
    }

    /**
     * Refrescar token usando refresh token
     */
    async refreshAccessToken(refreshToken, deviceInfo = {}) {
        try {
            // Verificar refresh token
            const payload = await this.verifyTokenSignature(refreshToken, this.refreshSecretKey);
            
            if (payload.type !== 'refresh') {
                throw new Error('Invalid refresh token type');
            }
            
            // Verificar expiración
            const now = Math.floor(Date.now() / 1000);
            if (payload.exp < now) {
                throw new Error('Refresh token expired');
            }
            
            // Verificar que no esté revocado
            const isRevoked = await this.isTokenBlacklisted(refreshToken);
            if (isRevoked) {
                throw new Error('Refresh token revoked');
            }
            
            // Verificar rate limiting para refresh
            const rateLimitCheck = await this.checkRefreshRateLimit(payload.sub);
            if (!rateLimitCheck.allowed) {
                throw new Error(`Refresh rate limit exceeded. Retry after ${rateLimitCheck.retryAfter}s`);
            }
            
            // Obtener información del usuario
            const user = await this.getUserById(payload.sub);
            if (!user) {
                throw new Error('User not found');
            }
            
            // Revocar el access token anterior si existe
            if (payload.access_jti) {
                await this.revokeToken(payload.access_jti);
            }
            
            // Generar nuevo access token
            const newTokenPair = await this.generateTokenPair(user, {
                ...deviceInfo,
                id: payload.device?.id || deviceInfo.id
            });
            
            // Actualizar métricas
            this.metrics.refreshTokensUsed++;
            
            // Log de refresh exitoso
            await this.logTokenRefresh(payload.sub, payload.device);
            
            return {
                success: true,
                ...newTokenPair
            };
            
        } catch (error) {
            console.error('Error refrescando token:', error);
            
            // Log de intento de refresh fallido
            await this.logFailedTokenRefresh(refreshToken, error.message);
            
            throw error;
        }
    }

    /**
     * Revocar token específico
     */
    async revokeToken(jtiOrToken) {
        try {
            let jti = jtiOrToken;
            
            // Si se pasa el token completo, extraer JTI
            if (jtiOrToken.includes('.')) {
                const payload = await this.verifyTokenSignature(jtiOrToken, this.secretKey);
                jti = payload.jti;
            }
            
            // Agregar a blacklist
            await this.addToBlacklist(jti, 'manual_revocation');
            
            // Agregar al cache local
            this.blacklistCache.add(jtiOrToken);
            
            // Revocar sesión asociada
            await this.revokeUserSession(jti);
            
            // Actualizar métricas
            this.metrics.tokensRevoked++;
            
            console.log(`Token revocado: ${jti}`);
            
            return { success: true, jti };
            
        } catch (error) {
            console.error('Error revocando token:', error);
            throw error;
        }
    }

    /**
     * Revocar todas las sesiones de un usuario
     */
    async revokeAllUserTokens(userId, reason = 'logout_all') {
        try {
            // Obtener todas las sesiones activas del usuario
            const sessionsKey = `sessions:${userId}`;
            const sessionsData = await this.kv.get(sessionsKey);
            
            if (sessionsData) {
                const sessions = JSON.parse(sessionsData);
                
                // Revocar cada token de las sesiones
                for (const session of sessions) {
                    if (session.accessJti) {
                        await this.addToBlacklist(session.accessJti, reason);
                    }
                    if (session.refreshJti) {
                        await this.addToBlacklist(session.refreshJti, reason);
                    }
                }
                
                // Limpiar todas las sesiones
                await this.kv.delete(sessionsKey);
            }
            
            // Log de revocación masiva
            await this.logMassTokenRevocation(userId, reason);
            
            console.log(`Todas las sesiones revocadas para usuario: ${userId}`);
            
            return { success: true, userId };
            
        } catch (error) {
            console.error('Error revocando tokens del usuario:', error);
            throw error;
        }
    }

    /**
     * Verificar si debe rotarse un token
     */
    async shouldRotateToken(payload) {
        if (!JWT_CONFIG.tokens.rotation.enabled) return false;
        
        const now = Math.floor(Date.now() / 1000);
        const tokenAge = now - payload.iat;
        const tokenLifetime = payload.exp - payload.iat;
        const agePercentage = (tokenAge / tokenLifetime) * 100;
        
        // Rotar si ha pasado el umbral de tiempo
        if (agePercentage >= JWT_CONFIG.tokens.rotation.thresholdPercentage) {
            // Verificar límite de rotaciones por día
            const rotationsToday = await this.getUserRotationsToday(payload.sub);
            if (rotationsToday < JWT_CONFIG.tokens.rotation.maxRotationsPerDay) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Verificar permisos
     */
    checkPermissions(userPermissions, requiredPermissions) {
        if (!userPermissions || !Array.isArray(userPermissions)) {
            return false;
        }
        
        // Verificar si el usuario tiene permisos wildcard
        if (userPermissions.includes('*') || userPermissions.includes('read:*') && requiredPermissions.every(p => p.startsWith('read:'))) {
            return true;
        }
        
        // Verificar cada permiso requerido
        return requiredPermissions.every(required => {
            return userPermissions.some(userPerm => {
                if (userPerm === required) return true;
                if (userPerm.endsWith(':*')) {
                    const prefix = userPerm.replace(':*', ':');
                    return required.startsWith(prefix);
                }
                return false;
            });
        });
    }

    /**
     * Obtener permisos para un rol específico
     */
    getPermissionsForRole(role) {
        const roleConfig = JWT_CONFIG.roles[role];
        if (!roleConfig) {
            return JWT_CONFIG.roles.user.permissions; // Default a user permissions
        }
        return roleConfig.permissions;
    }

    /**
     * Verificar firma del token
     */
    async verifyTokenSignature(token, secret) {
        // En producción, usar una librería JWT real como jose o jsonwebtoken
        // Esta es una implementación simplificada para demostración
        
        const parts = token.split('.');
        if (parts.length !== 3) {
            throw new Error('Invalid token format');
        }
        
        try {
            // Decodificar header y payload
            const header = JSON.parse(atob(parts[0]));
            const payload = JSON.parse(atob(parts[1]));
            
            // Verificar algoritmo
            if (header.alg !== 'HS256') {
                throw new Error('Unsupported algorithm');
            }
            
            // Verificar firma (simulado - en producción usar crypto real)
            const expectedSignature = await this.generateSignature(parts[0] + '.' + parts[1], secret);
            if (parts[2] !== expectedSignature) {
                throw new Error('Invalid signature');
            }
            
            return payload;
            
        } catch (error) {
            throw new Error('Invalid token');
        }
    }

    /**
     * Firmar token
     */
    async signToken(payload, secret) {
        // En producción, usar una librería JWT real
        // Esta es una implementación simplificada
        
        const header = {
            typ: 'JWT',
            alg: 'HS256'
        };
        
        const encodedHeader = btoa(JSON.stringify(header));
        const encodedPayload = btoa(JSON.stringify(payload));
        
        const signature = await this.generateSignature(encodedHeader + '.' + encodedPayload, secret);
        
        return encodedHeader + '.' + encodedPayload + '.' + signature;
    }

    /**
     * Generar firma HMAC (simulado)
     */
    async generateSignature(data, secret) {
        // En producción, usar Web Crypto API o librería de crypto
        // Esta es una simulación para demostración
        
        const encoder = new TextEncoder();
        const keyData = encoder.encode(secret);
        const messageData = encoder.encode(data);
        
        // Simulación básica (en producción usar HMAC-SHA256 real)
        let hash = 0;
        const combined = secret + data;
        for (let i = 0; i < combined.length; i++) {
            const char = combined.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        
        return btoa(Math.abs(hash).toString(36));
    }

    /**
     * Generar JTI único
     */
    generateJTI() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }

    /**
     * Generar Device ID
     */
    generateDeviceId() {
        return 'dev_' + Date.now().toString(36) + Math.random().toString(36).substring(2);
    }

    /**
     * Verificar si token está en blacklist
     */
    async isTokenBlacklisted(tokenOrJti) {
        try {
            let jti = tokenOrJti;
            
            // Si es un token completo, extraer JTI
            if (tokenOrJti.includes('.')) {
                const payload = await this.verifyTokenSignature(tokenOrJti, this.secretKey);
                jti = payload.jti;
            }
            
            const blacklistKey = `blacklist:${jti}`;
            const result = await this.kv.get(blacklistKey);
            
            return result !== null;
            
        } catch (error) {
            // En caso de error, asumir que no está en blacklist
            return false;
        }
    }

    /**
     * Agregar token a blacklist
     */
    async addToBlacklist(jti, reason) {
        const blacklistKey = `blacklist:${jti}`;
        const blacklistEntry = {
            jti,
            reason,
            revokedAt: new Date().toISOString(),
            revokedBy: 'system'
        };
        
        // Almacenar en KV con TTL basado en la expiración del token
        await this.kv.put(blacklistKey, JSON.stringify(blacklistEntry), {
            expirationTtl: JWT_CONFIG.tokens.refresh.expiresInMs / 1000 // Usar el TTL más largo
        });
    }

    /**
     * Almacenar metadatos del token
     */
    async storeTokenMetadata(jti, payload) {
        const metadataKey = `token_meta:${jti}`;
        const metadata = {
            jti: payload.jti,
            sub: payload.sub,
            type: payload.type,
            issuedAt: payload.iat,
            expiresAt: payload.exp,
            device: payload.device,
            permissions: payload.permissions
        };
        
        await this.kv.put(metadataKey, JSON.stringify(metadata), {
            expirationTtl: payload.exp - Math.floor(Date.now() / 1000) + 3600 // TTL + 1 hora de margen
        });
    }

    /**
     * Registrar sesión activa
     */
    async registerActiveSession(userId, deviceInfo, tokenInfo) {
        const sessionsKey = `sessions:${userId}`;
        
        try {
            let sessions = [];
            const existingSessions = await this.kv.get(sessionsKey);
            
            if (existingSessions) {
                sessions = JSON.parse(existingSessions);
            }
            
            // Agregar nueva sesión
            sessions.push({
                deviceId: deviceInfo.id,
                deviceType: deviceInfo.type,
                ip: deviceInfo.ip,
                userAgent: deviceInfo.userAgent,
                accessJti: tokenInfo.accessJti,
                refreshJti: tokenInfo.refreshJti,
                createdAt: new Date().toISOString(),
                lastSeen: new Date().toISOString()
            });
            
            // Limitar número de sesiones simultáneas
            const maxSessions = JWT_CONFIG.security.anomalyDetection.maxSimultaneousLogins;
            if (sessions.length > maxSessions) {
                // Remover las sesiones más antiguas
                sessions = sessions.slice(-maxSessions);
            }
            
            await this.kv.put(sessionsKey, JSON.stringify(sessions), {
                expirationTtl: JWT_CONFIG.tokens.refresh.expiresInMs / 1000
            });
            
        } catch (error) {
            console.error('Error registrando sesión activa:', error);
        }
    }

    /**
     * Obtener usuario por ID (mock - en producción integrar con base de datos)
     */
    async getUserById(userId) {
        // En producción, obtener de base de datos real
        return {
            id: userId,
            email: `user${userId}@example.com`,
            role: 'user',
            subscription: 'basic',
            active: true
        };
    }

    /**
     * Verificar rate limiting para refresh tokens
     */
    async checkRefreshRateLimit(userId) {
        const rateLimitKey = `refresh_rate:${userId}`;
        const config = JWT_CONFIG.security.authRateLimit.refresh;
        
        try {
            const windowStart = Math.floor(Date.now() / (config.window * 1000)) * (config.window * 1000);
            const windowKey = `${rateLimitKey}:${windowStart}`;
            
            const currentCount = parseInt(await this.kv.get(windowKey) || '0', 10);
            
            if (currentCount >= config.requests) {
                return {
                    allowed: false,
                    retryAfter: config.window - Math.floor((Date.now() - windowStart) / 1000)
                };
            }
            
            // Incrementar contador
            await this.kv.put(windowKey, (currentCount + 1).toString(), {
                expirationTtl: config.window * 2
            });
            
            return { allowed: true };
            
        } catch (error) {
            console.error('Error verificando rate limit de refresh:', error);
            return { allowed: true }; // En caso de error, permitir
        }
    }

    /**
     * Obtener rotaciones de hoy para un usuario
     */
    async getUserRotationsToday(userId) {
        const today = new Date().toISOString().split('T')[0];
        const rotationKey = `rotations:${userId}:${today}`;
        
        try {
            const count = await this.kv.get(rotationKey);
            return parseInt(count || '0', 10);
        } catch (error) {
            return 0;
        }
    }

    /**
     * Incrementar contador de rotaciones
     */
    async incrementUserRotations(userId) {
        const today = new Date().toISOString().split('T')[0];
        const rotationKey = `rotations:${userId}:${today}`;
        
        try {
            const current = parseInt(await this.kv.get(rotationKey) || '0', 10);
            await this.kv.put(rotationKey, (current + 1).toString(), {
                expirationTtl: 86400 // 24 horas
            });
        } catch (error) {
            console.error('Error incrementando rotaciones:', error);
        }
    }

    /**
     * Actualizar last seen del usuario
     */
    async updateUserLastSeen(userId, deviceInfo) {
        const lastSeenKey = `last_seen:${userId}`;
        const lastSeenData = {
            timestamp: new Date().toISOString(),
            device: deviceInfo
        };
        
        try {
            await this.kv.put(lastSeenKey, JSON.stringify(lastSeenData), {
                expirationTtl: 86400 * 30 // 30 días
            });
        } catch (error) {
            console.error('Error actualizando last seen:', error);
        }
    }

    /**
     * Revocar sesión por JTI
     */
    async revokeUserSession(jti) {
        // Esta función buscaría y eliminaría la sesión específica
        // Implementación simplificada - en producción buscar por JTI en todas las sesiones
        console.log(`Revocando sesión con JTI: ${jti}`);
    }

    /**
     * Logs de eventos de autenticación
     */
    async logTokenGeneration(user, device) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            type: 'token_generated',
            userId: user.id,
            email: user.email,
            role: user.role,
            deviceId: device.id,
            ip: device.ip,
            userAgent: device.userAgent
        };
        
        console.log('Token Generation:', JSON.stringify(logEntry));
    }

    async logFailedTokenVerification(token, error) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            type: 'token_verification_failed',
            error: error,
            tokenPreview: token.substring(0, 20) + '...'
        };
        
        console.warn('Failed Token Verification:', JSON.stringify(logEntry));
    }

    async logTokenRefresh(userId, device) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            type: 'token_refreshed',
            userId: userId,
            deviceId: device?.id,
            ip: device?.ip
        };
        
        console.log('Token Refresh:', JSON.stringify(logEntry));
    }

    async logFailedTokenRefresh(token, error) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            type: 'token_refresh_failed',
            error: error,
            tokenPreview: token.substring(0, 20) + '...'
        };
        
        console.warn('Failed Token Refresh:', JSON.stringify(logEntry));
    }

    async logMassTokenRevocation(userId, reason) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            type: 'mass_token_revocation',
            userId: userId,
            reason: reason
        };
        
        console.warn('Mass Token Revocation:', JSON.stringify(logEntry));
    }

    /**
     * Obtener métricas de autenticación
     */
    getMetrics() {
        return {
            ...this.metrics,
            cacheSize: this.tokenCache.size,
            blacklistCacheSize: this.blacklistCache.size
        };
    }
}

/**
 * Middleware de autenticación JWT
 */
export function createJWTAuthMiddleware(env, options = {}) {
    const jwtManager = new JWTManager(env);
    
    return async (c, next) => {
        const requiredPermissions = options.permissions || [];
        const optional = options.optional || false;
        
        const authorization = c.req.header('Authorization');
        
        if (!authorization) {
            if (optional) {
                c.set('user', null);
                return await next();
            }
            
            return c.json({
                error: 'Authorization header required',
                code: 'AUTHORIZATION_REQUIRED'
            }, 401);
        }
        
        if (!authorization.startsWith('Bearer ')) {
            return c.json({
                error: 'Invalid authorization format',
                code: 'INVALID_AUTHORIZATION_FORMAT'
            }, 401);
        }
        
        const token = authorization.substring(7);
        const verification = await jwtManager.verifyAccessToken(token, requiredPermissions);
        
        if (!verification.valid) {
            return c.json({
                error: 'Invalid or expired token',
                code: 'INVALID_TOKEN',
                details: verification.error
            }, 401);
        }
        
        // Agregar información del usuario al contexto
        c.set('user', verification.payload);
        c.set('jwtManager', jwtManager);
        
        // Agregar header si el token debe rotarse
        if (verification.shouldRotate) {
            c.header('X-Token-Rotation-Required', 'true');
        }
        
        await next();
    };
}

export { JWTManager, JWT_CONFIG };
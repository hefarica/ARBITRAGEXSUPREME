/**
 * Rutas de Autenticación para ArbitrageX Supreme
 * Ingenio Pichichi S.A. - Metodología Cumplidor, disciplinado, organizado
 * 
 * Endpoints de autenticación seguros:
 * - POST /api/auth/login - Autenticación de usuarios
 * - POST /api/auth/refresh - Renovación de tokens
 * - POST /api/auth/logout - Cerrar sesión específica
 * - POST /api/auth/logout-all - Cerrar todas las sesiones
 * - GET /api/auth/verify - Verificar token actual
 * - GET /api/auth/sessions - Listar sesiones activas
 * - POST /api/auth/revoke-session - Revocar sesión específica
 * 
 * @author Hector Fabio Riascos C.
 * @version 1.0.0
 * @date 2025-01-15
 */

import { Hono } from 'hono';
import { JWTManager } from './jwt-manager.js';
import { createRateLimitingMiddleware } from '../middleware/rate-limiting.js';

/**
 * Configuración de autenticación
 */
const AUTH_CONFIG = {
    // Rate limiting específico para endpoints de auth
    rateLimits: {
        login: { requests: 5, window: 300 },     // 5 intentos cada 5 minutos
        refresh: { requests: 10, window: 300 },   // 10 refresh cada 5 minutos
        logout: { requests: 20, window: 300 },    // 20 logout cada 5 minutos
        verify: { requests: 100, window: 60 }     // 100 verificaciones por minuto
    },
    
    // Configuración de validación de entrada
    validation: {
        email: {
            pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            maxLength: 255
        },
        password: {
            minLength: 8,
            maxLength: 128,
            requireUppercase: true,
            requireLowercase: true,
            requireNumbers: true,
            requireSpecialChars: false
        }
    },
    
    // Configuración de seguridad
    security: {
        maxFailedAttempts: 5,
        lockoutDurationMs: 300000, // 5 minutos
        passwordHashRounds: 12,
        requireEmailVerification: false
    }
};

/**
 * Crear rutas de autenticación
 */
export function createAuthRoutes(env) {
    const app = new Hono();
    const jwtManager = new JWTManager(env);
    
    // Aplicar rate limiting a todas las rutas de auth
    app.use('*', createRateLimitingMiddleware(env));

    /**
     * POST /api/auth/login
     * Autenticación de usuarios con email y contraseña
     */
    app.post('/login', async (c) => {
        try {
            const body = await c.req.json();
            const { email, password, rememberMe = false } = body;
            
            // Validar entrada
            const validation = validateLoginInput({ email, password });
            if (!validation.valid) {
                return c.json({
                    error: 'Invalid input',
                    code: 'VALIDATION_ERROR',
                    details: validation.errors
                }, 400);
            }

            // Obtener información del device/client
            const deviceInfo = extractDeviceInfo(c);
            
            // Verificar rate limiting específico para login
            const rateLimitCheck = await checkAuthRateLimit(env, 'login', deviceInfo.ip);
            if (!rateLimitCheck.allowed) {
                return c.json({
                    error: 'Too many login attempts',
                    code: 'RATE_LIMIT_EXCEEDED',
                    retryAfter: rateLimitCheck.retryAfter
                }, 429);
            }

            // Verificar credenciales del usuario
            const authResult = await authenticateUser(env, email, password, deviceInfo);
            
            if (!authResult.success) {
                // Log del intento de login fallido
                await logFailedLogin(env, email, deviceInfo, authResult.reason);
                
                return c.json({
                    error: 'Authentication failed',
                    code: 'AUTHENTICATION_FAILED',
                    message: authResult.message
                }, 401);
            }

            // Generar tokens
            const tokenPair = await jwtManager.generateTokenPair(authResult.user, deviceInfo);
            
            // Log de login exitoso
            await logSuccessfulLogin(env, authResult.user, deviceInfo);
            
            // Respuesta con tokens
            const response = {
                success: true,
                message: 'Login successful',
                user: {
                    id: authResult.user.id,
                    email: authResult.user.email,
                    role: authResult.user.role,
                    subscription: authResult.user.subscription,
                    permissions: tokenPair.metadata.permissions
                },
                tokens: {
                    accessToken: tokenPair.accessToken,
                    refreshToken: tokenPair.refreshToken,
                    expiresIn: tokenPair.expiresIn,
                    tokenType: tokenPair.tokenType
                },
                metadata: tokenPair.metadata
            };

            // Headers de seguridad
            c.header('X-Frame-Options', 'DENY');
            c.header('X-Content-Type-Options', 'nosniff');
            
            return c.json(response);
            
        } catch (error) {
            console.error('Error en login:', error);
            
            return c.json({
                error: 'Internal server error',
                code: 'INTERNAL_ERROR'
            }, 500);
        }
    });

    /**
     * POST /api/auth/refresh
     * Renovar token de acceso usando refresh token
     */
    app.post('/refresh', async (c) => {
        try {
            const body = await c.req.json();
            const { refreshToken } = body;
            
            if (!refreshToken) {
                return c.json({
                    error: 'Refresh token required',
                    code: 'REFRESH_TOKEN_REQUIRED'
                }, 400);
            }

            const deviceInfo = extractDeviceInfo(c);
            
            // Renovar token
            const newTokens = await jwtManager.refreshAccessToken(refreshToken, deviceInfo);
            
            return c.json({
                success: true,
                message: 'Token refreshed successfully',
                tokens: {
                    accessToken: newTokens.accessToken,
                    refreshToken: newTokens.refreshToken,
                    expiresIn: newTokens.expiresIn,
                    tokenType: newTokens.tokenType
                },
                metadata: newTokens.metadata
            });
            
        } catch (error) {
            console.error('Error en refresh:', error);
            
            let statusCode = 500;
            let errorCode = 'INTERNAL_ERROR';
            
            if (error.message.includes('expired')) {
                statusCode = 401;
                errorCode = 'TOKEN_EXPIRED';
            } else if (error.message.includes('revoked') || error.message.includes('Invalid')) {
                statusCode = 401;
                errorCode = 'INVALID_REFRESH_TOKEN';
            } else if (error.message.includes('rate limit')) {
                statusCode = 429;
                errorCode = 'RATE_LIMIT_EXCEEDED';
            }
            
            return c.json({
                error: 'Token refresh failed',
                code: errorCode,
                message: error.message
            }, statusCode);
        }
    });

    /**
     * POST /api/auth/logout
     * Cerrar sesión específica (revocar tokens actuales)
     */
    app.post('/logout', async (c) => {
        try {
            const authorization = c.req.header('Authorization');
            
            if (!authorization || !authorization.startsWith('Bearer ')) {
                return c.json({
                    error: 'Authorization header required',
                    code: 'AUTHORIZATION_REQUIRED'
                }, 401);
            }

            const token = authorization.substring(7);
            
            // Revocar el token actual
            await jwtManager.revokeToken(token);
            
            // Log de logout
            const deviceInfo = extractDeviceInfo(c);
            await logLogout(env, token, deviceInfo, 'single_session');
            
            return c.json({
                success: true,
                message: 'Logout successful'
            });
            
        } catch (error) {
            console.error('Error en logout:', error);
            
            return c.json({
                error: 'Logout failed',
                code: 'LOGOUT_ERROR',
                message: error.message
            }, 500);
        }
    });

    /**
     * POST /api/auth/logout-all
     * Cerrar todas las sesiones del usuario (revocar todos los tokens)
     */
    app.post('/logout-all', async (c) => {
        try {
            const authorization = c.req.header('Authorization');
            
            if (!authorization || !authorization.startsWith('Bearer ')) {
                return c.json({
                    error: 'Authorization header required',
                    code: 'AUTHORIZATION_REQUIRED'
                }, 401);
            }

            const token = authorization.substring(7);
            
            // Verificar token para obtener user ID
            const verification = await jwtManager.verifyAccessToken(token);
            if (!verification.valid) {
                return c.json({
                    error: 'Invalid token',
                    code: 'INVALID_TOKEN'
                }, 401);
            }

            const userId = verification.payload.sub;
            
            // Revocar todos los tokens del usuario
            await jwtManager.revokeAllUserTokens(userId, 'logout_all');
            
            // Log de logout masivo
            const deviceInfo = extractDeviceInfo(c);
            await logLogout(env, token, deviceInfo, 'all_sessions');
            
            return c.json({
                success: true,
                message: 'All sessions logged out successfully'
            });
            
        } catch (error) {
            console.error('Error en logout-all:', error);
            
            return c.json({
                error: 'Logout all sessions failed',
                code: 'LOGOUT_ALL_ERROR',
                message: error.message
            }, 500);
        }
    });

    /**
     * GET /api/auth/verify
     * Verificar validez del token actual
     */
    app.get('/verify', async (c) => {
        try {
            const authorization = c.req.header('Authorization');
            
            if (!authorization || !authorization.startsWith('Bearer ')) {
                return c.json({
                    valid: false,
                    error: 'No authorization header'
                }, 401);
            }

            const token = authorization.substring(7);
            const verification = await jwtManager.verifyAccessToken(token);
            
            if (!verification.valid) {
                return c.json({
                    valid: false,
                    error: verification.error
                }, 401);
            }

            // Preparar información del usuario (sin datos sensibles)
            const userInfo = {
                id: verification.payload.sub,
                email: verification.payload.email,
                role: verification.payload.role,
                permissions: verification.payload.permissions,
                subscription: verification.payload.subscription,
                deviceId: verification.payload.device?.id,
                expiresAt: new Date(verification.payload.exp * 1000).toISOString(),
                shouldRotate: verification.shouldRotate
            };

            const response = {
                valid: true,
                user: userInfo,
                tokenMetadata: {
                    jti: verification.payload.jti,
                    issuedAt: new Date(verification.payload.iat * 1000).toISOString(),
                    expiresAt: userInfo.expiresAt,
                    shouldRotate: verification.shouldRotate
                }
            };

            // Agregar header de rotación si es necesario
            if (verification.shouldRotate) {
                c.header('X-Token-Rotation-Required', 'true');
            }

            return c.json(response);
            
        } catch (error) {
            console.error('Error en verify:', error);
            
            return c.json({
                valid: false,
                error: 'Verification failed'
            }, 500);
        }
    });

    /**
     * GET /api/auth/sessions
     * Listar sesiones activas del usuario autenticado
     */
    app.get('/sessions', async (c) => {
        try {
            const authorization = c.req.header('Authorization');
            
            if (!authorization || !authorization.startsWith('Bearer ')) {
                return c.json({
                    error: 'Authorization header required',
                    code: 'AUTHORIZATION_REQUIRED'
                }, 401);
            }

            const token = authorization.substring(7);
            const verification = await jwtManager.verifyAccessToken(token);
            
            if (!verification.valid) {
                return c.json({
                    error: 'Invalid token',
                    code: 'INVALID_TOKEN'
                }, 401);
            }

            const userId = verification.payload.sub;
            
            // Obtener sesiones activas
            const sessions = await getUserActiveSessions(env, userId);
            
            // Marcar sesión actual
            const currentDeviceId = verification.payload.device?.id;
            const sessionsWithCurrent = sessions.map(session => ({
                ...session,
                isCurrent: session.deviceId === currentDeviceId
            }));

            return c.json({
                success: true,
                sessions: sessionsWithCurrent,
                totalSessions: sessions.length
            });
            
        } catch (error) {
            console.error('Error obteniendo sesiones:', error);
            
            return c.json({
                error: 'Failed to get sessions',
                code: 'GET_SESSIONS_ERROR'
            }, 500);
        }
    });

    /**
     * POST /api/auth/revoke-session
     * Revocar una sesión específica por device ID
     */
    app.post('/revoke-session', async (c) => {
        try {
            const authorization = c.req.header('Authorization');
            
            if (!authorization || !authorization.startsWith('Bearer ')) {
                return c.json({
                    error: 'Authorization header required',
                    code: 'AUTHORIZATION_REQUIRED'
                }, 401);
            }

            const body = await c.req.json();
            const { deviceId } = body;
            
            if (!deviceId) {
                return c.json({
                    error: 'Device ID required',
                    code: 'DEVICE_ID_REQUIRED'
                }, 400);
            }

            const token = authorization.substring(7);
            const verification = await jwtManager.verifyAccessToken(token);
            
            if (!verification.valid) {
                return c.json({
                    error: 'Invalid token',
                    code: 'INVALID_TOKEN'
                }, 401);
            }

            const userId = verification.payload.sub;
            
            // Revocar sesión específica
            const revocationResult = await revokeSpecificSession(env, userId, deviceId);
            
            if (!revocationResult.success) {
                return c.json({
                    error: 'Session not found or already revoked',
                    code: 'SESSION_NOT_FOUND'
                }, 404);
            }

            // Log de revocación de sesión
            const deviceInfo = extractDeviceInfo(c);
            await logSessionRevocation(env, userId, deviceId, deviceInfo);

            return c.json({
                success: true,
                message: 'Session revoked successfully',
                revokedDeviceId: deviceId
            });
            
        } catch (error) {
            console.error('Error revocando sesión:', error);
            
            return c.json({
                error: 'Failed to revoke session',
                code: 'REVOKE_SESSION_ERROR'
            }, 500);
        }
    });

    return app;
}

/**
 * Funciones auxiliares
 */

/**
 * Validar entrada de login
 */
function validateLoginInput({ email, password }) {
    const errors = [];
    
    // Validar email
    if (!email) {
        errors.push('Email is required');
    } else if (!AUTH_CONFIG.validation.email.pattern.test(email)) {
        errors.push('Invalid email format');
    } else if (email.length > AUTH_CONFIG.validation.email.maxLength) {
        errors.push('Email too long');
    }
    
    // Validar password
    if (!password) {
        errors.push('Password is required');
    } else {
        if (password.length < AUTH_CONFIG.validation.password.minLength) {
            errors.push(`Password must be at least ${AUTH_CONFIG.validation.password.minLength} characters`);
        }
        if (password.length > AUTH_CONFIG.validation.password.maxLength) {
            errors.push(`Password must not exceed ${AUTH_CONFIG.validation.password.maxLength} characters`);
        }
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Extraer información del dispositivo/cliente
 */
function extractDeviceInfo(c) {
    const userAgent = c.req.header('User-Agent') || 'unknown';
    const ip = c.req.header('CF-Connecting-IP') || 
              c.req.header('X-Forwarded-For')?.split(',')[0].trim() || 
              c.req.header('X-Real-IP') || 
              'unknown';
    
    // Determinar tipo de dispositivo basado en User-Agent
    let deviceType = 'unknown';
    if (userAgent.includes('Mobile')) {
        deviceType = 'mobile';
    } else if (userAgent.includes('Tablet')) {
        deviceType = 'tablet';
    } else if (userAgent.includes('Mozilla') && !userAgent.includes('Mobile')) {
        deviceType = 'desktop';
    }
    
    return {
        ip,
        userAgent,
        type: deviceType,
        id: null // Se generará en JWTManager
    };
}

/**
 * Verificar rate limiting específico para auth
 */
async function checkAuthRateLimit(env, action, identifier) {
    const config = AUTH_CONFIG.rateLimits[action];
    if (!config) return { allowed: true };
    
    const key = `auth_rate:${action}:${identifier}`;
    const windowStart = Math.floor(Date.now() / (config.window * 1000)) * (config.window * 1000);
    const windowKey = `${key}:${windowStart}`;
    
    try {
        const currentCount = parseInt(await env.KV.get(windowKey) || '0', 10);
        
        if (currentCount >= config.requests) {
            return {
                allowed: false,
                retryAfter: config.window - Math.floor((Date.now() - windowStart) / 1000)
            };
        }
        
        await env.KV.put(windowKey, (currentCount + 1).toString(), {
            expirationTtl: config.window * 2
        });
        
        return { allowed: true };
        
    } catch (error) {
        console.error('Error verificando auth rate limit:', error);
        return { allowed: true }; // En caso de error, permitir
    }
}

/**
 * Autenticar usuario (mock - en producción integrar con base de datos real)
 */
async function authenticateUser(env, email, password, deviceInfo) {
    try {
        // En producción, verificar contra base de datos real con hashing seguro
        
        // Verificar si el usuario existe (mock)
        const userKey = `user:${email.toLowerCase()}`;
        const userData = await env.KV.get(userKey);
        
        if (!userData) {
            return {
                success: false,
                reason: 'user_not_found',
                message: 'Invalid credentials'
            };
        }

        const user = JSON.parse(userData);
        
        // Verificar contraseña (en producción usar bcrypt o similar)
        const passwordMatch = await verifyPassword(password, user.passwordHash);
        
        if (!passwordMatch) {
            return {
                success: false,
                reason: 'invalid_password',
                message: 'Invalid credentials'
            };
        }

        // Verificar si la cuenta está activa
        if (!user.active) {
            return {
                success: false,
                reason: 'account_disabled',
                message: 'Account is disabled'
            };
        }

        // Verificar bloqueo por intentos fallidos
        const isLocked = await checkUserLockout(env, email);
        if (isLocked) {
            return {
                success: false,
                reason: 'account_locked',
                message: 'Account temporarily locked due to failed login attempts'
            };
        }

        // Limpiar intentos fallidos después del login exitoso
        await clearFailedAttempts(env, email);

        return {
            success: true,
            user: {
                id: user.id,
                email: user.email,
                role: user.role || 'user',
                subscription: user.subscription || 'basic',
                active: user.active
            }
        };
        
    } catch (error) {
        console.error('Error autenticando usuario:', error);
        return {
            success: false,
            reason: 'internal_error',
            message: 'Authentication system error'
        };
    }
}

/**
 * Verificar contraseña (mock - en producción usar bcrypt)
 */
async function verifyPassword(password, hash) {
    // En producción usar bcrypt.compare() o similar
    // Esta es una implementación simplificada para demostración
    return password === 'demo123' && hash === 'demo_hash';
}

/**
 * Verificar bloqueo de usuario por intentos fallidos
 */
async function checkUserLockout(env, email) {
    const lockoutKey = `lockout:${email.toLowerCase()}`;
    
    try {
        const lockoutData = await env.KV.get(lockoutKey);
        if (!lockoutData) return false;
        
        const lockout = JSON.parse(lockoutData);
        return lockout.lockedUntil > Date.now();
        
    } catch (error) {
        console.error('Error verificando bloqueo:', error);
        return false;
    }
}

/**
 * Limpiar intentos fallidos
 */
async function clearFailedAttempts(env, email) {
    const attemptsKey = `failed_attempts:${email.toLowerCase()}`;
    const lockoutKey = `lockout:${email.toLowerCase()}`;
    
    try {
        await env.KV.delete(attemptsKey);
        await env.KV.delete(lockoutKey);
    } catch (error) {
        console.error('Error limpiando intentos fallidos:', error);
    }
}

/**
 * Obtener sesiones activas del usuario
 */
async function getUserActiveSessions(env, userId) {
    const sessionsKey = `sessions:${userId}`;
    
    try {
        const sessionsData = await env.KV.get(sessionsKey);
        if (!sessionsData) return [];
        
        const sessions = JSON.parse(sessionsData);
        
        // Filtrar y formatear sesiones
        return sessions.map(session => ({
            deviceId: session.deviceId,
            deviceType: session.deviceType,
            ip: session.ip,
            userAgent: session.userAgent,
            createdAt: session.createdAt,
            lastSeen: session.lastSeen,
            location: session.location || 'Unknown' // En producción, usar geolocalización
        }));
        
    } catch (error) {
        console.error('Error obteniendo sesiones activas:', error);
        return [];
    }
}

/**
 * Revocar sesión específica
 */
async function revokeSpecificSession(env, userId, deviceId) {
    const sessionsKey = `sessions:${userId}`;
    
    try {
        const sessionsData = await env.KV.get(sessionsKey);
        if (!sessionsData) return { success: false };
        
        let sessions = JSON.parse(sessionsData);
        const sessionToRevoke = sessions.find(s => s.deviceId === deviceId);
        
        if (!sessionToRevoke) {
            return { success: false };
        }

        // Revocar tokens de la sesión
        if (sessionToRevoke.accessJti) {
            const jwtManager = new JWTManager(env);
            await jwtManager.revokeToken(sessionToRevoke.accessJti);
        }
        
        // Remover sesión de la lista
        sessions = sessions.filter(s => s.deviceId !== deviceId);
        
        // Actualizar lista de sesiones
        if (sessions.length > 0) {
            await env.KV.put(sessionsKey, JSON.stringify(sessions));
        } else {
            await env.KV.delete(sessionsKey);
        }
        
        return { success: true };
        
    } catch (error) {
        console.error('Error revocando sesión específica:', error);
        return { success: false };
    }
}

/**
 * Logging functions
 */
async function logFailedLogin(env, email, deviceInfo, reason) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        type: 'login_failed',
        email: email,
        reason: reason,
        ip: deviceInfo.ip,
        userAgent: deviceInfo.userAgent,
        deviceType: deviceInfo.type
    };
    
    console.warn('Failed Login:', JSON.stringify(logEntry));
    
    // En producción, enviar a sistema de monitoreo
}

async function logSuccessfulLogin(env, user, deviceInfo) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        type: 'login_success',
        userId: user.id,
        email: user.email,
        role: user.role,
        ip: deviceInfo.ip,
        userAgent: deviceInfo.userAgent,
        deviceType: deviceInfo.type
    };
    
    console.log('Successful Login:', JSON.stringify(logEntry));
}

async function logLogout(env, token, deviceInfo, type) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        type: 'logout',
        logoutType: type,
        ip: deviceInfo.ip,
        userAgent: deviceInfo.userAgent
    };
    
    console.log('Logout:', JSON.stringify(logEntry));
}

async function logSessionRevocation(env, userId, deviceId, deviceInfo) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        type: 'session_revoked',
        userId: userId,
        revokedDeviceId: deviceId,
        revokedBy: deviceInfo.ip,
        revokedFromDevice: deviceInfo.userAgent
    };
    
    console.log('Session Revocation:', JSON.stringify(logEntry));
}

export { AUTH_CONFIG };
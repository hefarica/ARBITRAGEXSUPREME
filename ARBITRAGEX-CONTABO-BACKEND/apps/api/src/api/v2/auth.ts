// ArbitrageX Pro 2025 - Authentication Routes
// Enterprise authentication endpoints

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from '../../saas/auth/auth.service';
import { 
  LoginRequest,
  RegisterRequest,
  LoginResponse,
  AuthUser,
  ApiError,
  RefreshTokenRequest,
  PasswordResetRequest,
  PasswordResetConfirmRequest,
  ChangePasswordRequest,
  TwoFactorSetupResponse
} from '../../../web/types/api';

interface AuthenticatedRequest extends FastifyRequest {
  user: AuthUser;
}

export async function authRoutes(fastify: FastifyInstance) {
  const authService = fastify.authService as AuthService;

  // ==========================================================================
  // LOGIN
  // ==========================================================================

  fastify.post('/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
          tenantSlug: { type: 'string' },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: LoginRequest }>, reply: FastifyReply) => {
    try {
      const result = await authService.authenticateWithPassword(request.body);
      
      // Set secure HTTP-only cookies for tokens
      reply.setCookie('accessToken', result.tokens.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: result.tokens.expiresIn,
        path: '/',
      });

      reply.setCookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60, // 7 days
        path: '/',
      });

      return {
        success: true,
        user: result.user,
        permissions: result.permissions,
        features: result.features,
        // Don't return tokens in response body for security
      };
    } catch (error) {
      const errorResponse: ApiError = {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
        code: 401
      };
      reply.code(401);
      return errorResponse;
    }
  });

  // ==========================================================================
  // REGISTER
  // ==========================================================================

  fastify.post('/register', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password', 'firstName', 'lastName', 'tenantSlug'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
          firstName: { type: 'string', minLength: 1 },
          lastName: { type: 'string', minLength: 1 },
          tenantSlug: { type: 'string', minLength: 1 },
          inviteToken: { type: 'string' },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: RegisterRequest }>, reply: FastifyReply) => {
    try {
      const result = await authService.register(request.body);
      
      // Set cookies
      reply.setCookie('accessToken', result.tokens.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: result.tokens.expiresIn,
        path: '/',
      });

      reply.setCookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60,
        path: '/',
      });

      reply.code(201);
      return {
        success: true,
        user: result.user,
        permissions: result.permissions,
        features: result.features,
      };
    } catch (error) {
      reply.code(400);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Registration failed',
      };
    }
  });

  // ==========================================================================
  // REFRESH TOKEN
  // ==========================================================================

  fastify.post('/refresh', {
    schema: {
      body: {
        type: 'object',
        properties: {
          refreshToken: { type: 'string' },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: RefreshTokenBody }>, reply: FastifyReply) => {
    try {
      // Get refresh token from cookie or body
      const refreshToken = request.body.refreshToken || request.cookies.refreshToken;
      
      if (!refreshToken) {
        reply.code(401);
        return {
          success: false,
          error: 'Refresh token required',
        };
      }

      const result = await authService.refreshToken(refreshToken);
      
      // Update cookies
      reply.setCookie('accessToken', result.tokens.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: result.tokens.expiresIn,
        path: '/',
      });

      reply.setCookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60,
        path: '/',
      });

      return {
        success: true,
        user: result.user,
        permissions: result.permissions,
        features: result.features,
      };
    } catch (error) {
      reply.code(401);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Token refresh failed',
      };
    }
  });

  // ==========================================================================
  // LOGOUT
  // ==========================================================================

  fastify.post('/logout', {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      
      // Revoke tokens
      await authService.revokeToken(user.userId, 'all');
      
      // Clear cookies
      reply.clearCookie('accessToken');
      reply.clearCookie('refreshToken');
      
      return {
        success: true,
        message: 'Logged out successfully',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Logout failed',
      };
    }
  });

  // ==========================================================================
  // PASSWORD RESET
  // ==========================================================================

  fastify.post('/password/reset', {
    schema: {
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email' },
          tenantSlug: { type: 'string' },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: PasswordResetBody }>, reply: FastifyReply) => {
    try {
      await authService.requestPasswordReset(request.body.email, request.body.tenantSlug);
      
      // Always return success to prevent email enumeration
      return {
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
      };
    } catch (error) {
      // Don't reveal errors that could indicate email existence
      return {
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.',
      };
    }
  });

  fastify.post('/password/reset/confirm', {
    schema: {
      body: {
        type: 'object',
        required: ['token', 'newPassword'],
        properties: {
          token: { type: 'string' },
          newPassword: { type: 'string', minLength: 8 },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: PasswordResetConfirmBody }>, reply: FastifyReply) => {
    try {
      await authService.resetPassword(request.body.token, request.body.newPassword);
      
      return {
        success: true,
        message: 'Password reset successfully',
      };
    } catch (error) {
      reply.code(400);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Password reset failed',
      };
    }
  });

  // ==========================================================================
  // CHANGE PASSWORD
  // ==========================================================================

  fastify.post('/password/change', {
    preHandler: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['currentPassword', 'newPassword'],
        properties: {
          currentPassword: { type: 'string' },
          newPassword: { type: 'string', minLength: 8 },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: ChangePasswordBody }>, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      
      await authService.changePassword(
        user.userId,
        request.body.currentPassword,
        request.body.newPassword
      );
      
      return {
        success: true,
        message: 'Password changed successfully',
      };
    } catch (error) {
      reply.code(400);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Password change failed',
      };
    }
  });

  // ==========================================================================
  // USER PROFILE
  // ==========================================================================

  fastify.get('/me', {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      const permissions = await authService.getUserPermissions(user.userId);
      
      return {
        success: true,
        user: {
          id: user.userId,
          email: user.email,
          tenantId: user.tenantId,
          role: user.role,
        },
        permissions,
      };
    } catch (error) {
      reply.code(500);
      return {
        success: false,
        error: 'Failed to get user profile',
      };
    }
  });

  // ==========================================================================
  // TWO-FACTOR AUTHENTICATION
  // ==========================================================================

  fastify.post('/2fa/enable', {
    preHandler: [fastify.authenticate],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      const result = await authService.enableTwoFactor(user.userId);
      
      return {
        success: true,
        ...result,
      };
    } catch (error) {
      reply.code(500);
      return {
        success: false,
        error: error instanceof Error ? error.message : '2FA setup failed',
      };
    }
  });

  fastify.post('/2fa/verify', {
    preHandler: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['code'],
        properties: {
          code: { type: 'string', pattern: '^\\d{6}$' },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: { code: string } }>, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      await authService.verifyTwoFactorSetup(user.userId, request.body.code);
      
      return {
        success: true,
        message: 'Two-factor authentication enabled successfully',
      };
    } catch (error) {
      reply.code(400);
      return {
        success: false,
        error: error instanceof Error ? error.message : '2FA verification failed',
      };
    }
  });

  fastify.post('/2fa/disable', {
    preHandler: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['password'],
        properties: {
          password: { type: 'string' },
        },
      },
    },
  }, async (request: FastifyRequest<{ Body: { password: string } }>, reply: FastifyReply) => {
    try {
      const user = (request as any).user;
      await authService.disableTwoFactor(user.userId, request.body.password);
      
      return {
        success: true,
        message: 'Two-factor authentication disabled successfully',
      };
    } catch (error) {
      reply.code(400);
      return {
        success: false,
        error: error instanceof Error ? error.message : '2FA disable failed',
      };
    }
  });

  // ==========================================================================
  // JWT AUTHENTICATION MIDDLEWARE
  // ==========================================================================

  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Get token from cookie or Authorization header
      let token = request.cookies.accessToken;
      
      if (!token && request.headers.authorization) {
        const authHeader = request.headers.authorization;
        if (authHeader.startsWith('Bearer ')) {
          token = authHeader.substring(7);
        }
      }

      if (!token) {
        reply.code(401);
        throw new Error('Authentication required');
      }

      // Verify JWT token
      const payload = await request.jwtVerify();
      
      // Check if token is revoked
      const isRevoked = await fastify.cache.get(`token_revoked:${payload.userId}`);
      if (isRevoked) {
        reply.code(401);
        throw new Error('Token has been revoked');
      }

      // Add user to request
      (request as any).user = payload;
      
    } catch (error) {
      reply.code(401);
      throw new Error('Invalid authentication token');
    }
  });

  // ==========================================================================
  // TENANT MIDDLEWARE
  // ==========================================================================

  fastify.decorate('requireTenant', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user;
    const tenantHeader = request.headers['x-tenant-id'] as string;
    
    if (tenantHeader && tenantHeader !== user.tenantId) {
      reply.code(403);
      throw new Error('Access denied to tenant');
    }
  });

  // ==========================================================================
  // PERMISSION MIDDLEWARE
  // ==========================================================================

  fastify.decorate('requirePermission', (permission: string) => {
    return async (request: FastifyRequest, reply: FastifyReply) => {
      const user = (request as any).user;
      const hasPermission = await authService.checkPermission(user.userId, permission);
      
      if (!hasPermission) {
        reply.code(403);
        throw new Error(`Permission denied: ${permission}`);
      }
    };
  });
}
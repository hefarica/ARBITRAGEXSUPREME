// ArbitrageX Pro 2025 - Authentication Service
// Enterprise authentication with SSO support

import jwt from 'jsonwebtoken';
import { DatabaseService } from '../../shared/database/database.service';
import { CacheService } from '../../shared/cache/cache.service';
import { SecurityService } from '../../shared/security/security.service';
import { Logger } from '../../shared/monitoring/logger';

export interface LoginCredentials {
  email: string;
  password: string;
  tenantSlug?: string;
}

export interface SSOCredentials {
  provider: 'saml' | 'oauth' | 'oidc';
  token: string;
  tenantSlug?: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  tenantSlug: string;
  inviteToken?: string;
}

export interface AuthResult {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    tenantId: string;
    tenant: {
      id: string;
      name: string;
      slug: string;
    };
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
  permissions: string[];
  features: Record<string, boolean>;
}

export class AuthService {
  private logger = new Logger('AuthService');
  private readonly jwtSecret: string;
  private readonly jwtRefreshSecret: string;

  constructor(
    private db: DatabaseService,
    private cache: CacheService,
    private security: SecurityService
  ) {
    this.jwtSecret = process.env.JWT_SECRET || 'fallback-secret';
    this.jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret';
    
    if (!process.env.JWT_SECRET) {
      this.logger.warn('JWT_SECRET not set, using fallback (not secure for production)');
    }
  }

  // ==========================================================================
  // AUTHENTICATION METHODS
  // ==========================================================================

  async authenticateWithPassword(credentials: LoginCredentials): Promise<AuthResult> {
    const { email, password, tenantSlug } = credentials;

    this.logger.info('Password authentication attempt', { email, tenantSlug });

    // 1. Find user by email
    const user = await this.db.getUserByEmail(email);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    // 2. Check if user belongs to the specified tenant (if provided)
    if (tenantSlug && user.tenant.slug !== tenantSlug) {
      throw new Error('Invalid credentials');
    }

    // 3. Check tenant status
    if (user.tenant.status !== 'ACTIVE') {
      throw new Error('Account suspended');
    }

    // 4. Check user status
    if (user.status !== 'ACTIVE') {
      throw new Error('User account inactive');
    }

    // 5. Verify password
    if (!user.password_hash) {
      throw new Error('Password not set. Please use SSO or reset password.');
    }

    const isPasswordValid = await this.security.verifyPassword(password, user.password_hash);
    if (!isPasswordValid) {
      // Record failed login attempt
      await this.recordFailedLogin(user.id, 'invalid_password');
      throw new Error('Invalid credentials');
    }

    // 6. Update last login
    await this.db.updateUser(user.id, {
      last_login_at: new Date(),
    });

    // 7. Generate tokens and return auth result
    return this.generateAuthResult(user);
  }

  async authenticateWithSSO(credentials: SSOCredentials): Promise<AuthResult> {
    const { provider, token, tenantSlug } = credentials;

    this.logger.info('SSO authentication attempt', { provider, tenantSlug });

    // This is a simplified SSO implementation
    // In production, you would integrate with actual SSO providers
    let ssoUser: any;

    switch (provider) {
      case 'saml':
        ssoUser = await this.authenticateSAML(token);
        break;
      case 'oauth':
        ssoUser = await this.authenticateOAuth(token);
        break;
      case 'oidc':
        ssoUser = await this.authenticateOIDC(token);
        break;
      default:
        throw new Error('Unsupported SSO provider');
    }

    // Find or create user
    let user = await this.db.getUserByEmail(ssoUser.email);
    
    if (!user) {
      // Auto-create user from SSO if they don't exist
      user = await this.createUserFromSSO(ssoUser, provider, tenantSlug);
    } else {
      // Update SSO information
      await this.db.updateUser(user.id, {
        sso_provider: provider,
        sso_user_id: ssoUser.id,
        last_login_at: new Date(),
      });
    }

    return this.generateAuthResult(user);
  }

  async register(data: RegisterData): Promise<AuthResult> {
    this.logger.info('User registration attempt', { 
      email: data.email, 
      tenantSlug: data.tenantSlug 
    });

    // 1. Validate input
    if (!this.security.validateEmail(data.email)) {
      throw new Error('Invalid email format');
    }

    const passwordValidation = this.security.validatePassword(data.password);
    if (!passwordValidation.isValid) {
      throw new Error(`Password requirements not met: ${passwordValidation.errors.join(', ')}`);
    }

    // 2. Check if user already exists
    const existingUser = await this.db.getUserByEmail(data.email);
    if (existingUser) {
      throw new Error('User already exists');
    }

    // 3. Validate tenant
    const tenant = await this.db.getTenantBySlug(data.tenantSlug);
    if (!tenant) {
      throw new Error('Invalid tenant');
    }

    if (tenant.status !== 'ACTIVE') {
      throw new Error('Tenant account suspended');
    }

    // 4. Validate invite token if provided
    if (data.inviteToken) {
      const isValidInvite = await this.validateInviteToken(data.inviteToken, data.email, tenant.id);
      if (!isValidInvite) {
        throw new Error('Invalid or expired invite token');
      }
    }

    // 5. Hash password
    const passwordHash = await this.security.hashPassword(data.password);

    // 6. Create user
    const user = await this.db.createUser({
      tenant_id: tenant.id,
      email: data.email,
      password_hash: passwordHash,
      first_name: data.firstName,
      last_name: data.lastName,
      role: 'USER', // Default role
    });

    this.logger.info('User registered successfully', { 
      userId: user.id,
      tenantId: tenant.id 
    });

    return this.generateAuthResult(user);
  }

  // ==========================================================================
  // TOKEN MANAGEMENT
  // ==========================================================================

  async refreshToken(refreshToken: string): Promise<AuthResult> {
    try {
      // Verify refresh token
      const payload = jwt.verify(refreshToken, this.jwtRefreshSecret) as any;
      
      // Get user
      const user = await this.db.getUserById(payload.userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Check if refresh token is still valid in cache
      const cacheKey = `refresh_token:${user.id}`;
      const cachedToken = await this.cache.get(cacheKey);
      if (cachedToken !== refreshToken) {
        throw new Error('Invalid refresh token');
      }

      // Generate new tokens
      return this.generateAuthResult(user);
      
    } catch (error) {
      this.logger.error('Token refresh failed', { error });
      throw new Error('Invalid refresh token');
    }
  }

  async revokeToken(userId: string, tokenType: 'access' | 'refresh' | 'all' = 'all') {
    if (tokenType === 'all' || tokenType === 'refresh') {
      await this.cache.del(`refresh_token:${userId}`);
    }

    if (tokenType === 'all' || tokenType === 'access') {
      // Blacklist current access tokens (in production, implement proper token blacklisting)
      await this.cache.set(`token_revoked:${userId}`, true, 3600); // 1 hour
    }

    this.logger.info('Tokens revoked', { userId, tokenType });
  }

  // ==========================================================================
  // PASSWORD MANAGEMENT
  // ==========================================================================

  async requestPasswordReset(email: string, tenantSlug?: string): Promise<void> {
    const user = await this.db.getUserByEmail(email);
    
    // Don't reveal if user exists or not
    if (!user) {
      this.logger.warn('Password reset requested for non-existent user', { email });
      return;
    }

    if (tenantSlug && user.tenant.slug !== tenantSlug) {
      this.logger.warn('Password reset requested with wrong tenant', { email, tenantSlug });
      return;
    }

    // Generate reset token
    const resetToken = this.security.generateSecureRandomString(32);
    const resetExpiry = new Date(Date.now() + 3600000); // 1 hour

    // Store in cache
    await this.cache.set(
      `password_reset:${resetToken}`,
      { userId: user.id, email: user.email },
      3600 // 1 hour
    );

    // In production, send email with reset link
    this.logger.info('Password reset token generated', { 
      userId: user.id,
      token: resetToken.substring(0, 8) + '...' // Log partial token for debugging
    });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    // Validate new password
    const passwordValidation = this.security.validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      throw new Error(`Password requirements not met: ${passwordValidation.errors.join(', ')}`);
    }

    // Get reset data from cache
    const resetData = await this.cache.get(`password_reset:${token}`);
    if (!resetData) {
      throw new Error('Invalid or expired reset token');
    }

    // Hash new password
    const passwordHash = await this.security.hashPassword(newPassword);

    // Update user password
    await this.db.updateUser(resetData.userId, {
      password_hash: passwordHash,
    });

    // Delete reset token
    await this.cache.del(`password_reset:${token}`);

    // Revoke all existing tokens
    await this.revokeToken(resetData.userId, 'all');

    this.logger.info('Password reset completed', { userId: resetData.userId });
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.db.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    if (!user.password_hash || !await this.security.verifyPassword(currentPassword, user.password_hash)) {
      throw new Error('Current password is incorrect');
    }

    // Validate new password
    const passwordValidation = this.security.validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      throw new Error(`Password requirements not met: ${passwordValidation.errors.join(', ')}`);
    }

    // Hash new password
    const passwordHash = await this.security.hashPassword(newPassword);

    // Update password
    await this.db.updateUser(userId, {
      password_hash: passwordHash,
    });

    this.logger.info('Password changed successfully', { userId });
  }

  // ==========================================================================
  // TWO-FACTOR AUTHENTICATION
  // ==========================================================================

  async enableTwoFactor(userId: string): Promise<{
    secret: string;
    qrCode: string;
    backupCodes: string[];
  }> {
    const secret = this.security.generateTwoFactorSecret();
    const backupCodes = this.security.generateTwoFactorBackupCodes();

    // Store temporarily (user needs to verify before enabling)
    await this.cache.set(
      `2fa_setup:${userId}`,
      { secret, backupCodes },
      900 // 15 minutes
    );

    // Generate QR code URL (simplified)
    const qrCode = `otpauth://totp/ArbitrageX:${userId}?secret=${secret}&issuer=ArbitrageX`;

    return {
      secret,
      qrCode,
      backupCodes,
    };
  }

  async verifyTwoFactorSetup(userId: string, code: string): Promise<void> {
    const setupData = await this.cache.get(`2fa_setup:${userId}`);
    if (!setupData) {
      throw new Error('No 2FA setup in progress');
    }

    // In production, verify TOTP code against secret
    // For now, accept any 6-digit code
    if (!/^\d{6}$/.test(code)) {
      throw new Error('Invalid verification code');
    }

    // Enable 2FA for user
    await this.db.updateUser(userId, {
      two_factor_enabled: true,
      two_factor_secret: setupData.secret,
    });

    // Clean up setup data
    await this.cache.del(`2fa_setup:${userId}`);

    this.logger.info('Two-factor authentication enabled', { userId });
  }

  async disableTwoFactor(userId: string, password: string): Promise<void> {
    const user = await this.db.getUserById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Verify password
    if (!user.password_hash || !await this.security.verifyPassword(password, user.password_hash)) {
      throw new Error('Password is incorrect');
    }

    // Disable 2FA
    await this.db.updateUser(userId, {
      two_factor_enabled: false,
      two_factor_secret: null,
    });

    this.logger.info('Two-factor authentication disabled', { userId });
  }

  // ==========================================================================
  // SESSION MANAGEMENT
  // ==========================================================================

  async createSession(userId: string, deviceInfo?: any): Promise<string> {
    const sessionId = this.security.generateSecureRandomString(32);
    const sessionData = {
      userId,
      createdAt: new Date().toISOString(),
      deviceInfo: deviceInfo || {},
      lastActivity: new Date().toISOString(),
    };

    await this.cache.setUserSession(userId, sessionData);
    return sessionId;
  }

  async validateSession(sessionId: string): Promise<any | null> {
    // In a more complex implementation, you'd store session ID mappings
    // For now, we'll validate based on JWT tokens
    return null;
  }

  async endSession(userId: string): Promise<void> {
    await this.cache.deleteUserSession(userId);
    await this.revokeToken(userId, 'all');
    this.logger.info('Session ended', { userId });
  }

  // ==========================================================================
  // PERMISSIONS AND AUTHORIZATION
  // ==========================================================================

  async getUserPermissions(userId: string): Promise<string[]> {
    const user = await this.db.getUserById(userId);
    if (!user) {
      return [];
    }

    // Base permissions by role
    const rolePermissions: Record<string, string[]> = {
      'SUPER_ADMIN': ['*'], // All permissions
      'ADMIN': [
        'tenant.manage',
        'users.manage',
        'arbitrage.manage',
        'settings.manage',
        'billing.read',
        'analytics.read',
      ],
      'USER': [
        'arbitrage.read',
        'arbitrage.execute',
        'analytics.read',
        'profile.manage',
      ],
      'VIEWER': [
        'arbitrage.read',
        'analytics.read',
      ],
    };

    let permissions = rolePermissions[user.role] || [];

    // Add team-based permissions
    if (user.team_members) {
      for (const membership of user.team_members) {
        const teamPermissions = membership.team.permissions || {};
        Object.entries(teamPermissions).forEach(([resource, actions]) => {
          if (Array.isArray(actions)) {
            actions.forEach(action => {
              permissions.push(`${resource}.${action}`);
            });
          }
        });
      }
    }

    // Remove duplicates
    return [...new Set(permissions)];
  }

  async checkPermission(userId: string, permission: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    
    // Super admin has all permissions
    if (permissions.includes('*')) {
      return true;
    }

    return permissions.includes(permission);
  }

  // ==========================================================================
  // UTILITIES AND HELPERS
  // ==========================================================================

  private async generateAuthResult(user: any): Promise<AuthResult> {
    // Generate JWT tokens
    const tokenPayload = {
      userId: user.id,
      email: user.email,
      tenantId: user.tenant.id,
      role: user.role,
    };

    const accessToken = jwt.sign(tokenPayload, this.jwtSecret, { 
      expiresIn: '1h',
      issuer: 'arbitragex-pro',
      audience: 'arbitragex-api',
    });

    const refreshToken = jwt.sign(
      { userId: user.id },
      this.jwtRefreshSecret,
      { expiresIn: '7d' }
    );

    // Store refresh token in cache
    await this.cache.set(`refresh_token:${user.id}`, refreshToken, 604800); // 7 days

    // Get user permissions and features
    const permissions = await this.getUserPermissions(user.id);
    const features = user.tenant.subscription?.plan?.features || {};

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        tenantId: user.tenant.id,
        tenant: {
          id: user.tenant.id,
          name: user.tenant.name,
          slug: user.tenant.slug,
        },
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: 3600, // 1 hour in seconds
      },
      permissions,
      features,
    };
  }

  private async recordFailedLogin(userId: string, reason: string) {
    const key = `failed_login:${userId}`;
    const attempts = await this.cache.redis.incr(key);
    
    if (attempts === 1) {
      await this.cache.redis.expire(key, 900); // 15 minutes
    }

    this.logger.warn('Failed login attempt', { userId, reason, attempts });

    // Lock account after 5 failed attempts
    if (attempts >= 5) {
      await this.db.updateUser(userId, { status: 'SUSPENDED' });
      this.logger.error('Account locked due to failed login attempts', { userId, attempts });
    }
  }

  private async validateInviteToken(token: string, email: string, tenantId: string): Promise<boolean> {
    const inviteData = await this.cache.get(`invite:${token}`);
    return inviteData && 
           inviteData.email === email && 
           inviteData.tenantId === tenantId &&
           new Date(inviteData.expiresAt) > new Date();
  }

  private async createUserFromSSO(ssoUser: any, provider: string, tenantSlug?: string): Promise<any> {
    // Find tenant
    let tenant;
    if (tenantSlug) {
      tenant = await this.db.getTenantBySlug(tenantSlug);
    } else {
      // Auto-detect tenant based on email domain or other logic
      throw new Error('Tenant must be specified for SSO registration');
    }

    if (!tenant) {
      throw new Error('Invalid tenant');
    }

    // Create user
    return this.db.createUser({
      tenant_id: tenant.id,
      email: ssoUser.email,
      first_name: ssoUser.firstName || 'SSO',
      last_name: ssoUser.lastName || 'User',
      sso_provider: provider,
      sso_user_id: ssoUser.id,
      role: 'USER',
    });
  }

  // SSO provider implementations (simplified)
  private async authenticateSAML(token: string): Promise<any> {
    // In production, validate SAML assertion
    throw new Error('SAML authentication not implemented');
  }

  private async authenticateOAuth(token: string): Promise<any> {
    // In production, validate OAuth token with provider
    throw new Error('OAuth authentication not implemented');
  }

  private async authenticateOIDC(token: string): Promise<any> {
    // In production, validate OIDC token
    throw new Error('OIDC authentication not implemented');
  }
}
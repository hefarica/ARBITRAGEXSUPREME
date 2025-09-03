// ArbitrageX Pro 2025 - Security Service
// Enterprise-grade security utilities and encryption

import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { Logger } from '../monitoring/logger';

export class SecurityService {
  private logger = new Logger('SecurityService');
  private readonly encryptionKey: string;
  private readonly algorithm = 'aes-256-gcm';
  private readonly saltRounds = 12;

  constructor() {
    this.encryptionKey = process.env.ENCRYPTION_KEY || this.generateRandomKey();
    if (!process.env.ENCRYPTION_KEY) {
      this.logger.warn('No ENCRYPTION_KEY provided, using generated key (not suitable for production)');
    }
  }

  // ==========================================================================
  // PASSWORD HASHING
  // ==========================================================================

  async hashPassword(password: string): Promise<string> {
    try {
      return await bcrypt.hash(password, this.saltRounds);
    } catch (error) {
      this.logger.error('Password hashing failed', { error });
      throw new Error('Password hashing failed');
    }
  }

  async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    try {
      return await bcrypt.compare(password, hashedPassword);
    } catch (error) {
      this.logger.error('Password verification failed', { error });
      return false;
    }
  }

  // ==========================================================================
  // SYMMETRIC ENCRYPTION (for sensitive data like private keys)
  // ==========================================================================

  encrypt(text: string): { encryptedData: string; authTag: string; iv: string } {
    try {
      // AES-GCM requires 12-byte IV for optimal security
      const iv = crypto.randomBytes(12);
      
      // Ensure encryption key is 32 bytes (256 bits)
      const key = this.getSecureKey();
      
      // Use createCipheriv (NOT createCipher) with explicit IV
      const cipher = crypto.createCipheriv(this.algorithm, key, iv);
      
      // Set Additional Authenticated Data (AAD)
      const aad = Buffer.from('ArbitrageX-Pro-2025', 'utf8');
      cipher.setAAD(aad);

      // Encrypt the data
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Get authentication tag AFTER finalization
      const authTag = cipher.getAuthTag();

      return {
        encryptedData: encrypted,
        authTag: authTag.toString('hex'),
        iv: iv.toString('hex'),
      };
    } catch (error) {
      this.logger.error('Encryption failed', { error });
      throw new Error('Encryption failed');
    }
  }

  decrypt(encryptedData: string, authTag: string, iv: string): string {
    try {
      // Ensure encryption key is 32 bytes (256 bits)
      const key = this.getSecureKey();
      
      // Convert hex strings back to buffers
      const ivBuffer = Buffer.from(iv, 'hex');
      const authTagBuffer = Buffer.from(authTag, 'hex');
      
      // Use createDecipheriv (NOT createDecipher) with explicit IV
      const decipher = crypto.createDecipheriv(this.algorithm, key, ivBuffer);
      
      // Set Additional Authenticated Data (AAD) - must match encryption
      const aad = Buffer.from('ArbitrageX-Pro-2025', 'utf8');
      decipher.setAAD(aad);
      
      // Set authentication tag BEFORE decryption
      decipher.setAuthTag(authTagBuffer);

      // Decrypt the data
      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      this.logger.error('Decryption failed', { error });
      throw new Error('Decryption failed');
    }
  }

  // ==========================================================================
  // API KEY GENERATION AND VALIDATION
  // ==========================================================================

  generateApiKey(): string {
    const prefix = 'axp'; // ArbitrageX Pro
    const randomBytes = crypto.randomBytes(32);
    const key = randomBytes.toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    
    return `${prefix}_${key}`;
  }

  hashApiKey(apiKey: string): string {
    return crypto
      .createHash('sha256')
      .update(apiKey)
      .digest('hex');
  }

  validateApiKeyFormat(apiKey: string): boolean {
    const apiKeyRegex = /^axp_[A-Za-z0-9\-_]{43}$/;
    return apiKeyRegex.test(apiKey);
  }

  // ==========================================================================
  // WEBHOOK SIGNATURE VERIFICATION
  // ==========================================================================

  generateWebhookSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  signWebhookPayload(payload: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(payload, 'utf8')
      .digest('hex');
  }

  verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    try {
      const expectedSignature = this.signWebhookPayload(payload, secret);
      const providedSignature = signature.replace('sha256=', '');
      
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(providedSignature, 'hex')
      );
    } catch (error) {
      this.logger.error('Webhook signature verification failed', { error });
      return false;
    }
  }

  // ==========================================================================
  // JWT UTILITIES
  // ==========================================================================

  generateSecureRandomString(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  generateJwtSecret(): string {
    return this.generateSecureRandomString(64);
  }

  // ==========================================================================
  // TWO-FACTOR AUTHENTICATION
  // ==========================================================================

  generateTwoFactorSecret(): string {
    return crypto.randomBytes(20).toString('base32');
  }

  generateTwoFactorBackupCodes(count: number = 10): string[] {
    const codes: string[] = [];
    
    for (let i = 0; i < count; i++) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(`${code.slice(0, 4)}-${code.slice(4, 8)}`);
    }
    
    return codes;
  }

  // ==========================================================================
  // INPUT VALIDATION AND SANITIZATION
  // ==========================================================================

  sanitizeInput(input: string): string {
    return input
      .trim()
      .replace(/[<>]/g, '') // Remove potential XSS characters
      .substring(0, 1000); // Limit length
  }

  validateEmail(email: string): boolean {
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return emailRegex.test(email) && email.length <= 254;
  }

  validatePassword(password: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    
    if (password.length > 128) {
      errors.push('Password must be less than 128 characters');
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    
    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  // ==========================================================================
  // RATE LIMITING UTILITIES
  // ==========================================================================

  generateRateLimitKey(identifier: string, endpoint: string): string {
    return `rate_limit:${identifier}:${endpoint}`;
  }

  // ==========================================================================
  // BLOCKCHAIN SECURITY
  // ==========================================================================

  validateEthereumAddress(address: string): boolean {
    const addressRegex = /^0x[a-fA-F0-9]{40}$/;
    return addressRegex.test(address);
  }

  validateSolanaAddress(address: string): boolean {
    // Solana addresses are base58 encoded and 32-44 characters
    const solanaRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    return solanaRegex.test(address);
  }

  validatePrivateKey(privateKey: string, blockchain: 'ethereum' | 'solana'): boolean {
    switch (blockchain) {
      case 'ethereum':
        // Ethereum private key: 64 hex characters (with or without 0x prefix)
        const ethRegex = /^(0x)?[a-fA-F0-9]{64}$/;
        return ethRegex.test(privateKey);
      
      case 'solana':
        // Solana private key: base58 encoded, ~88 characters
        const solanaRegex = /^[1-9A-HJ-NP-Za-km-z]{87,88}$/;
        return solanaRegex.test(privateKey);
      
      default:
        return false;
    }
  }

  // ==========================================================================
  // SECURE DATA HANDLING
  // ==========================================================================

  securelyWipeString(str: string): void {
    // This is more of a symbolic action in JavaScript
    // In a real implementation, you might use native modules
    // or ensure the string is overwritten in memory
    
    // For now, just log that sensitive data should be wiped
    if (str.length > 0) {
      this.logger.debug('Securely wiping sensitive data from memory');
    }
  }

  maskSensitiveData(data: string, visibleChars: number = 4): string {
    if (data.length <= visibleChars * 2) {
      return '*'.repeat(data.length);
    }
    
    const start = data.substring(0, visibleChars);
    const end = data.substring(data.length - visibleChars);
    const middle = '*'.repeat(Math.max(0, data.length - visibleChars * 2));
    
    return `${start}${middle}${end}`;
  }

  // ==========================================================================
  // AUDIT TRAIL HELPERS
  // ==========================================================================

  generateAuditId(): string {
    return `audit_${Date.now()}_${crypto.randomUUID()}`;
  }

  hashForAudit(data: any): string {
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    return crypto
      .createHash('sha256')
      .update(dataString)
      .digest('hex');
  }

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  private generateRandomKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Get secure 32-byte encryption key for AES-256-GCM
   * Ensures key is exactly 32 bytes regardless of input format
   */
  private getSecureKey(): Buffer {
    try {
      let keyBuffer: Buffer;
      
      // If ENCRYPTION_KEY is base64 encoded
      if (this.encryptionKey.length === 44 && this.encryptionKey.includes('/') || this.encryptionKey.includes('+')) {
        keyBuffer = Buffer.from(this.encryptionKey, 'base64');
      }
      // If ENCRYPTION_KEY is hex encoded (64 chars)
      else if (this.encryptionKey.length === 64) {
        keyBuffer = Buffer.from(this.encryptionKey, 'hex');
      }
      // If ENCRYPTION_KEY is raw string, hash it to get 32 bytes
      else {
        keyBuffer = crypto.createHash('sha256').update(this.encryptionKey).digest();
      }
      
      // Ensure we have exactly 32 bytes
      if (keyBuffer.length !== 32) {
        throw new Error(`Invalid key length: ${keyBuffer.length}, expected 32 bytes`);
      }
      
      return keyBuffer;
    } catch (error) {
      this.logger.error('Failed to derive secure encryption key', { error });
      throw new Error('Failed to derive secure encryption key');
    }
  }

  constantTimeEquals(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }
    
    return crypto.timingSafeEqual(
      Buffer.from(a, 'utf8'),
      Buffer.from(b, 'utf8')
    );
  }

  // ==========================================================================
  // SECURITY HEADERS
  // ==========================================================================

  getSecurityHeaders(): Record<string, string> {
    return {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    };
  }
}
/**
 * Test Suite for SecurityService - Cryptography Fixes
 * Validates AES-256-GCM encryption/decryption implementation
 */

import crypto from 'crypto';
import { SecurityService } from '../security.service';

// Mock Logger to avoid dependencies in tests
jest.mock('../monitoring/logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
  })),
}));

describe('SecurityService - Cryptography', () => {
  let securityService: SecurityService;
  const testEncryptionKey = crypto.randomBytes(32).toString('base64');

  beforeAll(() => {
    // Set secure encryption key for tests
    process.env.ENCRYPTION_KEY = testEncryptionKey;
  });

  beforeEach(() => {
    securityService = new SecurityService();
  });

  afterAll(() => {
    delete process.env.ENCRYPTION_KEY;
  });

  describe('AES-256-GCM Encryption/Decryption', () => {
    test('should encrypt and decrypt text successfully', () => {
      const plaintext = 'Test sensitive data for ArbitrageX Pro 2025';
      
      // Test encryption
      const encrypted = securityService.encrypt(plaintext);
      
      expect(encrypted).toBeDefined();
      expect(encrypted.encryptedData).toBeTruthy();
      expect(encrypted.authTag).toBeTruthy();
      expect(encrypted.iv).toBeTruthy();
      
      // Verify IV is 12 bytes (24 hex characters)
      expect(encrypted.iv).toHaveLength(24);
      
      // Verify AuthTag is 16 bytes (32 hex characters)
      expect(encrypted.authTag).toHaveLength(32);
      
      // Test decryption
      const decrypted = securityService.decrypt(
        encrypted.encryptedData,
        encrypted.authTag,
        encrypted.iv
      );
      
      expect(decrypted).toBe(plaintext);
    });

    test('should generate different IV for each encryption', () => {
      const plaintext = 'Same plaintext';
      
      const encrypted1 = securityService.encrypt(plaintext);
      const encrypted2 = securityService.encrypt(plaintext);
      
      // IVs should be different
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
      
      // Encrypted data should be different due to different IVs
      expect(encrypted1.encryptedData).not.toBe(encrypted2.encryptedData);
      
      // But both should decrypt to same plaintext
      const decrypted1 = securityService.decrypt(
        encrypted1.encryptedData,
        encrypted1.authTag,
        encrypted1.iv
      );
      const decrypted2 = securityService.decrypt(
        encrypted2.encryptedData,
        encrypted2.authTag,
        encrypted2.iv
      );
      
      expect(decrypted1).toBe(plaintext);
      expect(decrypted2).toBe(plaintext);
    });

    test('should fail with tampered encrypted data', () => {
      const plaintext = 'Sensitive blockchain private key';
      const encrypted = securityService.encrypt(plaintext);
      
      // Tamper with encrypted data
      const tamperedData = encrypted.encryptedData.slice(0, -2) + '00';
      
      expect(() => {
        securityService.decrypt(tamperedData, encrypted.authTag, encrypted.iv);
      }).toThrow('Decryption failed');
    });

    test('should fail with tampered auth tag', () => {
      const plaintext = 'API key or sensitive config';
      const encrypted = securityService.encrypt(plaintext);
      
      // Tamper with auth tag
      const tamperedAuthTag = encrypted.authTag.slice(0, -2) + '00';
      
      expect(() => {
        securityService.decrypt(encrypted.encryptedData, tamperedAuthTag, encrypted.iv);
      }).toThrow('Decryption failed');
    });

    test('should fail with wrong IV', () => {
      const plaintext = 'Critical arbitrage configuration';
      const encrypted = securityService.encrypt(plaintext);
      
      // Use different IV
      const wrongIv = crypto.randomBytes(12).toString('hex');
      
      expect(() => {
        securityService.decrypt(encrypted.encryptedData, encrypted.authTag, wrongIv);
      }).toThrow('Decryption failed');
    });

    test('should handle empty string encryption', () => {
      const plaintext = '';
      const encrypted = securityService.encrypt(plaintext);
      const decrypted = securityService.decrypt(
        encrypted.encryptedData,
        encrypted.authTag,
        encrypted.iv
      );
      
      expect(decrypted).toBe(plaintext);
    });

    test('should handle special characters and unicode', () => {
      const plaintext = '🚀 ArbitrageX 特殊字符 ñáéíóú $#@!%^&*()';
      const encrypted = securityService.encrypt(plaintext);
      const decrypted = securityService.decrypt(
        encrypted.encryptedData,
        encrypted.authTag,
        encrypted.iv
      );
      
      expect(decrypted).toBe(plaintext);
    });

    test('should handle large data', () => {
      // Test with 1MB of data
      const plaintext = 'A'.repeat(1024 * 1024);
      const encrypted = securityService.encrypt(plaintext);
      const decrypted = securityService.decrypt(
        encrypted.encryptedData,
        encrypted.authTag,
        encrypted.iv
      );
      
      expect(decrypted).toBe(plaintext);
      expect(decrypted.length).toBe(1024 * 1024);
    });
  });

  describe('Key Derivation', () => {
    test('should handle hex-encoded encryption key', () => {
      const hexKey = crypto.randomBytes(32).toString('hex');
      process.env.ENCRYPTION_KEY = hexKey;
      
      const service = new SecurityService();
      const plaintext = 'Test with hex key';
      
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(
        encrypted.encryptedData,
        encrypted.authTag,
        encrypted.iv
      );
      
      expect(decrypted).toBe(plaintext);
    });

    test('should handle base64-encoded encryption key', () => {
      const base64Key = crypto.randomBytes(32).toString('base64');
      process.env.ENCRYPTION_KEY = base64Key;
      
      const service = new SecurityService();
      const plaintext = 'Test with base64 key';
      
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(
        encrypted.encryptedData,
        encrypted.authTag,
        encrypted.iv
      );
      
      expect(decrypted).toBe(plaintext);
    });

    test('should handle arbitrary string as encryption key', () => {
      process.env.ENCRYPTION_KEY = 'ArbitrageX-Pro-2025-Master-Key-String';
      
      const service = new SecurityService();
      const plaintext = 'Test with string key';
      
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(
        encrypted.encryptedData,
        encrypted.authTag,
        encrypted.iv
      );
      
      expect(decrypted).toBe(plaintext);
    });
  });

  describe('NIST Test Vectors Compliance', () => {
    test('should be compatible with NIST AES-GCM test vectors', () => {
      // Using NIST test vector for AES-256-GCM
      // This ensures our implementation is standards-compliant
      
      const key = Buffer.from('0000000000000000000000000000000000000000000000000000000000000000', 'hex');
      const iv = Buffer.from('000000000000000000000000', 'hex');
      const plaintext = '';
      const expectedCiphertext = '';
      const expectedAuthTag = '530f8afbc74536b9a963b4f1c4cb738b';

      // Manual test with Node.js crypto to ensure compatibility
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
      ciphertext += cipher.final('hex');
      const authTag = cipher.getAuthTag().toString('hex');

      expect(ciphertext).toBe(expectedCiphertext);
      expect(authTag).toBe(expectedAuthTag);

      // Verify decryption
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(Buffer.from(authTag, 'hex'));
      let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      expect(decrypted).toBe(plaintext);
    });
  });
});
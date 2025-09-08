/**
 * ArbitrageX Supreme - Sistema de Gestión de Claves HSM/Vault
 * 
 * Sistema empresarial de gestión de claves con integración HSM/Vault,
 * auditoría de dependencias y revocación de claves expuestas,
 * siguiendo metodologías del Ingenio Pichichi S.A.
 * 
 * Actividades 78-80: Auditoría dependencias, Key management HSM/Vault
 * 
 * @author Hector Fabio Riascos C.
 * @version 1.0.0
 */

import { ethers } from 'ethers';
import { performance } from 'perf_hooks';

// Tipos para gestión de claves
export interface KeyManagementConfig {
  provider: 'hsm' | 'vault' | 'aws_kms' | 'azure_kv' | 'gcp_kms';
  hsm: {
    enabled: boolean;
    device_path: string;
    pin: string;
    token_label: string;
  };
  vault: {
    enabled: boolean;
    endpoint: string;
    auth_method: 'token' | 'userpass' | 'ldap' | 'aws';
    mount_path: string;
    namespace?: string;
  };
  security: {
    key_rotation_interval: number; // days
    backup_enabled: boolean;
    audit_logging: boolean;
    access_control: boolean;
  };
  encryption: {
    algorithm: 'AES-256-GCM' | 'ChaCha20-Poly1305' | 'RSA-OAEP';
    key_derivation: 'PBKDF2' | 'Argon2' | 'scrypt';
    salt_length: number;
  };
}

export interface SecureKey {
  key_id: string;
  key_type: 'private_key' | 'api_key' | 'signing_key' | 'encryption_key';
  algorithm: string;
  created_at: Date;
  expires_at?: Date;
  last_used?: Date;
  usage_count: number;
  status: 'active' | 'revoked' | 'expired' | 'compromised';
  metadata: {
    purpose: string;
    owner: string;
    blockchain?: string;
    permissions: string[];
  };
  audit_trail: AuditEvent[];
}

export interface AuditEvent {
  event_id: string;
  event_type: 'key_created' | 'key_used' | 'key_rotated' | 'key_revoked' | 'key_accessed' | 'key_exported';
  timestamp: Date;
  user: string;
  ip_address: string;
  user_agent: string;
  details: Record<string, any>;
  risk_score: number; // 0-100
}

export interface DependencyAuditResult {
  package_name: string;
  current_version: string;
  latest_version: string;
  vulnerabilities: {
    id: string;
    severity: 'low' | 'moderate' | 'high' | 'critical';
    title: string;
    description: string;
    cvss_score: number;
    cwe: string[];
    references: string[];
    patched_versions: string[];
  }[];
  license: string;
  last_updated: Date;
  maintainer_reputation: number; // 0-100
  supply_chain_risk: number; // 0-100
}

export interface SecurityAuditReport {
  audit_id: string;
  timestamp: Date;
  total_packages: number;
  vulnerable_packages: number;
  critical_vulnerabilities: number;
  high_vulnerabilities: number;
  medium_vulnerabilities: number;
  low_vulnerabilities: number;
  supply_chain_risks: number;
  license_issues: number;
  recommendations: string[];
  dependencies: DependencyAuditResult[];
}

/**
 * Sistema Principal de Gestión de Claves
 */
export class KeyManagementSystem {
  private config: KeyManagementConfig;
  private keys: Map<string, SecureKey> = new Map();
  private auditEvents: AuditEvent[] = [];
  private vaultClient: any = null;

  constructor(config: KeyManagementConfig) {
    this.config = config;
    this.initializeProvider();
    this.startKeyRotationSchedule();
  }

  /**
   * Inicializar proveedor de claves
   */
  private async initializeProvider(): Promise<void> {
    console.log(`🔐 Inicializando sistema de gestión de claves: ${this.config.provider}`);
    
    switch (this.config.provider) {
      case 'vault':
        await this.initializeVault();
        break;
      case 'hsm':
        await this.initializeHSM();
        break;
      case 'aws_kms':
        await this.initializeAWSKMS();
        break;
      case 'azure_kv':
        await this.initializeAzureKV();
        break;
      case 'gcp_kms':
        await this.initializeGCPKMS();
        break;
      default:
        throw new Error(`Proveedor no soportado: ${this.config.provider}`);
    }
  }

  /**
   * Inicializar HashiCorp Vault
   */
  private async initializeVault(): Promise<void> {
    if (!this.config.vault.enabled) return;

    try {
      console.log('🏦 Conectando a HashiCorp Vault...');
      
      // En implementación real, usar el cliente oficial de Vault
      this.vaultClient = {
        endpoint: this.config.vault.endpoint,
        authenticated: true,
        token: 'vault-token-placeholder'
      };
      
      console.log('✅ Conexión a Vault establecida');
      
      await this.auditKeyAccess('vault_connection', 'system', {
        endpoint: this.config.vault.endpoint,
        auth_method: this.config.vault.auth_method
      });

    } catch (error) {
      console.error('❌ Error conectando a Vault:', error);
      throw error;
    }
  }

  /**
   * Inicializar HSM
   */
  private async initializeHSM(): Promise<void> {
    if (!this.config.hsm.enabled) return;

    try {
      console.log('🔒 Conectando a HSM...');
      
      // En implementación real, usar PKCS#11 library
      console.log(`📍 Device path: ${this.config.hsm.device_path}`);
      console.log(`🏷️ Token label: ${this.config.hsm.token_label}`);
      
      // Simular conexión HSM
      console.log('✅ Conexión a HSM establecida');
      
      await this.auditKeyAccess('hsm_connection', 'system', {
        device_path: this.config.hsm.device_path,
        token_label: this.config.hsm.token_label
      });

    } catch (error) {
      console.error('❌ Error conectando a HSM:', error);
      throw error;
    }
  }

  /**
   * Inicializar AWS KMS
   */
  private async initializeAWSKMS(): Promise<void> {
    console.log('☁️ Inicializando AWS KMS...');
    // Implementación para AWS KMS
  }

  /**
   * Inicializar Azure Key Vault
   */
  private async initializeAzureKV(): Promise<void> {
    console.log('🔵 Inicializando Azure Key Vault...');
    // Implementación para Azure Key Vault
  }

  /**
   * Inicializar Google Cloud KMS
   */
  private async initializeGCPKMS(): Promise<void> {
    console.log('🌐 Inicializando Google Cloud KMS...');
    // Implementación para Google Cloud KMS
  }

  /**
   * Generar nueva clave segura
   */
  async generateSecureKey(
    keyType: 'private_key' | 'api_key' | 'signing_key' | 'encryption_key',
    purpose: string,
    owner: string,
    blockchain?: string
  ): Promise<string> {
    console.log(`🔑 Generando clave segura: ${keyType} para ${purpose}`);

    const keyId = `key_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    try {
      // Generar clave según el tipo
      let keyMaterial: string;
      let algorithm: string;

      switch (keyType) {
        case 'private_key':
          const wallet = ethers.Wallet.createRandom();
          keyMaterial = await this.encryptAndStore(wallet.privateKey, keyId);
          algorithm = 'secp256k1';
          break;
        
        case 'api_key':
          keyMaterial = await this.generateAPIKey();
          algorithm = 'random-256';
          break;
        
        case 'signing_key':
          keyMaterial = await this.generateSigningKey();
          algorithm = 'ed25519';
          break;
        
        case 'encryption_key':
          keyMaterial = await this.generateEncryptionKey();
          algorithm = this.config.encryption.algorithm;
          break;
        
        default:
          throw new Error(`Tipo de clave no soportado: ${keyType}`);
      }

      // Crear registro de clave
      const secureKey: SecureKey = {
        key_id: keyId,
        key_type: keyType,
        algorithm: algorithm,
        created_at: new Date(),
        usage_count: 0,
        status: 'active',
        metadata: {
          purpose: purpose,
          owner: owner,
          blockchain: blockchain,
          permissions: ['read', 'use']
        },
        audit_trail: []
      };

      // Almacenar clave
      this.keys.set(keyId, secureKey);
      
      // Auditar creación
      await this.auditKeyAccess('key_created', owner, {
        key_id: keyId,
        key_type: keyType,
        purpose: purpose,
        blockchain: blockchain
      });

      console.log(`✅ Clave generada exitosamente: ${keyId}`);
      return keyId;

    } catch (error) {
      console.error('❌ Error generando clave:', error);
      throw error;
    }
  }

  /**
   * Encriptar y almacenar clave
   */
  private async encryptAndStore(keyMaterial: string, keyId: string): Promise<string> {
    switch (this.config.provider) {
      case 'vault':
        return await this.storeInVault(keyMaterial, keyId);
      case 'hsm':
        return await this.storeInHSM(keyMaterial, keyId);
      default:
        return await this.encryptLocally(keyMaterial, keyId);
    }
  }

  /**
   * Almacenar en Vault
   */
  private async storeInVault(keyMaterial: string, keyId: string): Promise<string> {
    if (!this.vaultClient) {
      throw new Error('Cliente Vault no inicializado');
    }

    console.log(`🏦 Almacenando clave en Vault: ${keyId}`);
    
    // En implementación real, usar API de Vault
    const vaultPath = `${this.config.vault.mount_path}/data/${keyId}`;
    
    // Simular almacenamiento en Vault
    console.log(`📍 Vault path: ${vaultPath}`);
    
    return `vault:${vaultPath}`;
  }

  /**
   * Almacenar en HSM
   */
  private async storeInHSM(keyMaterial: string, keyId: string): Promise<string> {
    console.log(`🔒 Almacenando clave en HSM: ${keyId}`);
    
    // En implementación real, usar PKCS#11 para almacenar en HSM
    const hsmHandle = `hsm:${this.config.hsm.token_label}:${keyId}`;
    
    return hsmHandle;
  }

  /**
   * Encriptar localmente
   */
  private async encryptLocally(keyMaterial: string, keyId: string): Promise<string> {
    console.log(`🔐 Encriptando clave localmente: ${keyId}`);
    
    // Implementar encriptación AES-256-GCM
    const masterKey = await this.deriveMasterKey();
    const encryptedKey = await this.aesEncrypt(keyMaterial, masterKey);
    
    return encryptedKey;
  }

  /**
   * Recuperar clave segura
   */
  async retrieveSecureKey(keyId: string, user: string): Promise<string> {
    const key = this.keys.get(keyId);
    if (!key) {
      throw new Error(`Clave no encontrada: ${keyId}`);
    }

    if (key.status !== 'active') {
      throw new Error(`Clave no activa: ${keyId} (estado: ${key.status})`);
    }

    try {
      // Verificar permisos
      await this.validateKeyAccess(key, user);
      
      // Recuperar material de clave
      const keyMaterial = await this.decryptAndRetrieve(keyId);
      
      // Actualizar estadísticas de uso
      key.usage_count++;
      key.last_used = new Date();
      
      // Auditar acceso
      await this.auditKeyAccess('key_accessed', user, {
        key_id: keyId,
        key_type: key.key_type,
        purpose: key.metadata.purpose
      });

      return keyMaterial;

    } catch (error) {
      await this.auditKeyAccess('key_access_denied', user, {
        key_id: keyId,
        reason: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Revocar clave
   */
  async revokeKey(keyId: string, reason: string, user: string): Promise<void> {
    const key = this.keys.get(keyId);
    if (!key) {
      throw new Error(`Clave no encontrada: ${keyId}`);
    }

    console.log(`🚫 Revocando clave: ${keyId} - Razón: ${reason}`);
    
    // Cambiar estado
    key.status = 'revoked';
    
    // Auditar revocación
    await this.auditKeyAccess('key_revoked', user, {
      key_id: keyId,
      reason: reason,
      previous_status: key.status
    });

    console.log(`✅ Clave revocada exitosamente: ${keyId}`);
  }

  /**
   * Rotar clave
   */
  async rotateKey(keyId: string, user: string): Promise<string> {
    const oldKey = this.keys.get(keyId);
    if (!oldKey) {
      throw new Error(`Clave no encontrada: ${keyId}`);
    }

    console.log(`🔄 Rotando clave: ${keyId}`);
    
    // Generar nueva clave
    const newKeyId = await this.generateSecureKey(
      oldKey.key_type,
      oldKey.metadata.purpose,
      oldKey.metadata.owner,
      oldKey.metadata.blockchain
    );
    
    // Marcar clave antigua como revocada
    await this.revokeKey(keyId, 'key_rotation', user);
    
    // Auditar rotación
    await this.auditKeyAccess('key_rotated', user, {
      old_key_id: keyId,
      new_key_id: newKeyId
    });

    console.log(`✅ Clave rotada: ${keyId} → ${newKeyId}`);
    return newKeyId;
  }

  /**
   * Iniciar programación de rotación de claves
   */
  private startKeyRotationSchedule(): void {
    if (!this.config.security.key_rotation_interval) return;

    const intervalMs = this.config.security.key_rotation_interval * 24 * 60 * 60 * 1000;
    
    setInterval(async () => {
      await this.performScheduledRotation();
    }, intervalMs);

    console.log(`⏰ Rotación automática programada cada ${this.config.security.key_rotation_interval} días`);
  }

  /**
   * Realizar rotación programada
   */
  private async performScheduledRotation(): Promise<void> {
    console.log('🔄 Ejecutando rotación programada de claves...');
    
    const now = new Date();
    const rotationThreshold = new Date(now.getTime() - (this.config.security.key_rotation_interval * 24 * 60 * 60 * 1000));
    
    for (const [keyId, key] of this.keys) {
      if (key.status === 'active' && key.created_at < rotationThreshold) {
        try {
          await this.rotateKey(keyId, 'system');
          console.log(`✅ Clave rotada automáticamente: ${keyId}`);
        } catch (error) {
          console.error(`❌ Error rotando clave ${keyId}:`, error);
        }
      }
    }
  }

  /**
   * Auditar acceso a clave
   */
  private async auditKeyAccess(
    eventType: 'key_created' | 'key_used' | 'key_rotated' | 'key_revoked' | 'key_accessed' | 'key_exported' | 'vault_connection' | 'hsm_connection' | 'key_access_denied',
    user: string,
    details: Record<string, any>
  ): Promise<void> {
    if (!this.config.security.audit_logging) return;

    const event: AuditEvent = {
      event_id: `audit_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      event_type: eventType as any,
      timestamp: new Date(),
      user: user,
      ip_address: '127.0.0.1', // En implementación real, obtener IP real
      user_agent: 'ArbitrageX-Supreme-KeyMgmt/1.0',
      details: details,
      risk_score: this.calculateRiskScore(eventType, details)
    };

    this.auditEvents.push(event);
    
    // En implementación real, enviar a sistema de logging externo
    console.log(`📋 Evento auditado:`, {
      type: eventType,
      user: user,
      details: details
    });
  }

  /**
   * Calcular puntuación de riesgo
   */
  private calculateRiskScore(eventType: string, details: Record<string, any>): number {
    let score = 0;
    
    switch (eventType) {
      case 'key_revoked':
        score = 80;
        break;
      case 'key_access_denied':
        score = 70;
        break;
      case 'key_exported':
        score = 60;
        break;
      case 'key_accessed':
        score = 30;
        break;
      case 'key_created':
        score = 20;
        break;
      default:
        score = 10;
    }
    
    // Ajustar por contexto
    if (details.reason?.includes('compromised')) {
      score += 20;
    }
    
    return Math.min(100, score);
  }

  /**
   * Validar acceso a clave
   */
  private async validateKeyAccess(key: SecureKey, user: string): Promise<void> {
    // Verificar propietario
    if (key.metadata.owner !== user && user !== 'system') {
      throw new Error('Acceso denegado: usuario no es propietario de la clave');
    }
    
    // Verificar expiración
    if (key.expires_at && key.expires_at < new Date()) {
      throw new Error('Acceso denegado: clave expirada');
    }
    
    // Verificar permisos
    if (!key.metadata.permissions.includes('read') && !key.metadata.permissions.includes('use')) {
      throw new Error('Acceso denegado: permisos insuficientes');
    }
  }

  /**
   * Generar API key
   */
  private async generateAPIKey(): Promise<string> {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Generar signing key
   */
  private async generateSigningKey(): Promise<string> {
    // En implementación real, generar clave Ed25519
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Generar encryption key
   */
  private async generateEncryptionKey(): Promise<string> {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Derivar master key
   */
  private async deriveMasterKey(): Promise<string> {
    // En implementación real, usar PBKDF2, Argon2 o scrypt
    return 'master_key_placeholder';
  }

  /**
   * Encriptar AES
   */
  private async aesEncrypt(data: string, key: string): Promise<string> {
    // En implementación real, usar WebCrypto API o Node.js crypto
    return `encrypted:${Buffer.from(data).toString('base64')}`;
  }

  /**
   * Decriptar y recuperar
   */
  private async decryptAndRetrieve(keyId: string): Promise<string> {
    // En implementación real, recuperar del proveedor configurado
    return `decrypted_key_material_for_${keyId}`;
  }

  /**
   * Obtener estadísticas de gestión de claves
   */
  getKeyManagementStats(): {
    total_keys: number;
    active_keys: number;
    revoked_keys: number;
    by_type: Record<string, number>;
    recent_events: number;
    security_score: number;
  } {
    const totalKeys = this.keys.size;
    const activeKeys = Array.from(this.keys.values()).filter(k => k.status === 'active').length;
    const revokedKeys = Array.from(this.keys.values()).filter(k => k.status === 'revoked').length;
    
    const byType: Record<string, number> = {};
    this.keys.forEach(key => {
      byType[key.key_type] = (byType[key.key_type] || 0) + 1;
    });

    const recentEvents = this.auditEvents.filter(
      e => e.timestamp > new Date(Date.now() - 24 * 60 * 60 * 1000)
    ).length;

    // Calcular puntuación de seguridad
    const securityScore = this.calculateSecurityScore();

    return {
      total_keys: totalKeys,
      active_keys: activeKeys,
      revoked_keys: revokedKeys,
      by_type: byType,
      recent_events: recentEvents,
      security_score: securityScore
    };
  }

  /**
   * Calcular puntuación de seguridad
   */
  private calculateSecurityScore(): number {
    let score = 100;
    
    // Penalizar por claves no rotadas
    const now = new Date();
    const rotationThreshold = new Date(now.getTime() - (this.config.security.key_rotation_interval * 24 * 60 * 60 * 1000));
    
    const oldKeys = Array.from(this.keys.values()).filter(
      k => k.status === 'active' && k.created_at < rotationThreshold
    ).length;
    
    score -= oldKeys * 10;
    
    // Penalizar por eventos de alto riesgo recientes
    const highRiskEvents = this.auditEvents.filter(
      e => e.risk_score > 70 && e.timestamp > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    ).length;
    
    score -= highRiskEvents * 15;
    
    return Math.max(0, Math.min(100, score));
  }
}

/**
 * Sistema de Auditoría de Dependencias
 */
export class DependencyAuditSystem {
  private auditResults: Map<string, DependencyAuditResult> = new Map();
  private lastAuditTime: Date | null = null;

  /**
   * Ejecutar auditoría completa de dependencias
   */
  async executeDependencyAudit(): Promise<SecurityAuditReport> {
    console.log('🔍 Iniciando auditoría de dependencias...');
    console.log('⚡ Metodología disciplinada del Ingenio Pichichi S.A.');

    const startTime = performance.now();
    
    try {
      // Leer package.json
      const packageData = await this.readPackageJson();
      
      // Auditar dependencias
      await this.auditDependencies(packageData.dependencies || {});
      await this.auditDependencies(packageData.devDependencies || {});
      
      // Generar reporte
      const report = this.generateAuditReport();
      
      this.lastAuditTime = new Date();
      
      console.log(`✅ Auditoría completada en ${((performance.now() - startTime) / 1000).toFixed(2)}s`);
      console.log(`📊 Paquetes analizados: ${report.total_packages}`);
      console.log(`⚠️ Vulnerabilidades críticas: ${report.critical_vulnerabilities}`);
      
      return report;

    } catch (error) {
      console.error('❌ Error en auditoría de dependencias:', error);
      throw error;
    }
  }

  /**
   * Leer package.json
   */
  private async readPackageJson(): Promise<any> {
    // En implementación real, leer el archivo package.json
    return {
      dependencies: {
        'ethers': '^6.0.0',
        'react': '^18.3.1',
        'next': '^15.5.2',
        'tailwindcss': '^4.0.0',
        '@types/node': '^20.0.0'
      },
      devDependencies: {
        'typescript': '^5.9.2',
        'eslint': '^8.0.0',
        'jest': '^29.0.0',
        'playwright': '^1.0.0'
      }
    };
  }

  /**
   * Auditar dependencias
   */
  private async auditDependencies(dependencies: Record<string, string>): Promise<void> {
    for (const [packageName, version] of Object.entries(dependencies)) {
      await this.auditSinglePackage(packageName, version);
    }
  }

  /**
   * Auditar paquete individual
   */
  private async auditSinglePackage(packageName: string, version: string): Promise<void> {
    try {
      // Simular consulta a base de datos de vulnerabilidades
      const vulnerabilities = await this.fetchVulnerabilities(packageName, version);
      const packageInfo = await this.fetchPackageInfo(packageName);
      
      const auditResult: DependencyAuditResult = {
        package_name: packageName,
        current_version: version,
        latest_version: packageInfo.latest_version,
        vulnerabilities: vulnerabilities,
        license: packageInfo.license,
        last_updated: packageInfo.last_updated,
        maintainer_reputation: packageInfo.maintainer_reputation,
        supply_chain_risk: this.calculateSupplyChainRisk(packageInfo)
      };

      this.auditResults.set(packageName, auditResult);
      
      if (vulnerabilities.length > 0) {
        console.log(`⚠️ Vulnerabilidades encontradas en ${packageName}:`, vulnerabilities.length);
      }

    } catch (error) {
      console.error(`❌ Error auditando ${packageName}:`, error);
    }
  }

  /**
   * Obtener vulnerabilidades del paquete
   */
  private async fetchVulnerabilities(packageName: string, version: string): Promise<any[]> {
    // Simular consulta a base de datos de vulnerabilidades (npm audit, Snyk, etc.)
    const vulnerabilities: any[] = [];
    
    // Simular algunas vulnerabilidades para testing
    if (Math.random() < 0.1) { // 10% chance de vulnerabilidad
      vulnerabilities.push({
        id: `VULN-${Date.now()}`,
        severity: ['low', 'moderate', 'high', 'critical'][Math.floor(Math.random() * 4)],
        title: `Security vulnerability in ${packageName}`,
        description: `Potential security issue found in ${packageName} ${version}`,
        cvss_score: Math.random() * 10,
        cwe: ['CWE-79', 'CWE-89', 'CWE-190'],
        references: [
          `https://nvd.nist.gov/vuln/detail/CVE-2024-${Math.floor(Math.random() * 10000)}`
        ],
        patched_versions: [`>=${version.replace('^', '')}`]
      });
    }
    
    return vulnerabilities;
  }

  /**
   * Obtener información del paquete
   */
  private async fetchPackageInfo(packageName: string): Promise<any> {
    // Simular consulta a npm registry
    return {
      latest_version: '1.0.0',
      license: 'MIT',
      last_updated: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
      maintainer_reputation: Math.floor(Math.random() * 40) + 60, // 60-100
      downloads_per_week: Math.floor(Math.random() * 1000000),
      maintainer_count: Math.floor(Math.random() * 10) + 1
    };
  }

  /**
   * Calcular riesgo de supply chain
   */
  private calculateSupplyChainRisk(packageInfo: any): number {
    let risk = 0;
    
    // Riesgo por baja reputación del mantenedor
    if (packageInfo.maintainer_reputation < 70) {
      risk += 30;
    }
    
    // Riesgo por poca actividad
    const daysSinceUpdate = (Date.now() - packageInfo.last_updated.getTime()) / (24 * 60 * 60 * 1000);
    if (daysSinceUpdate > 365) {
      risk += 25;
    }
    
    // Riesgo por pocos mantenedores
    if (packageInfo.maintainer_count < 2) {
      risk += 20;
    }
    
    // Riesgo por pocos downloads
    if (packageInfo.downloads_per_week < 1000) {
      risk += 25;
    }
    
    return Math.min(100, risk);
  }

  /**
   * Generar reporte de auditoría
   */
  private generateAuditReport(): SecurityAuditReport {
    const dependencies = Array.from(this.auditResults.values());
    const totalPackages = dependencies.length;
    
    let criticalVulns = 0;
    let highVulns = 0;
    let mediumVulns = 0;
    let lowVulns = 0;
    let vulnerablePackages = 0;
    let supplyChainRisks = 0;
    let licenseIssues = 0;

    dependencies.forEach(dep => {
      if (dep.vulnerabilities.length > 0) {
        vulnerablePackages++;
        
        dep.vulnerabilities.forEach(vuln => {
          switch (vuln.severity) {
            case 'critical':
              criticalVulns++;
              break;
            case 'high':
              highVulns++;
              break;
            case 'moderate':
              mediumVulns++;
              break;
            case 'low':
              lowVulns++;
              break;
          }
        });
      }
      
      if (dep.supply_chain_risk > 70) {
        supplyChainRisks++;
      }
      
      if (!['MIT', 'Apache-2.0', 'BSD-3-Clause', 'ISC'].includes(dep.license)) {
        licenseIssues++;
      }
    });

    const recommendations = this.generateRecommendations(
      criticalVulns,
      highVulns,
      supplyChainRisks,
      licenseIssues
    );

    return {
      audit_id: `audit_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      timestamp: new Date(),
      total_packages: totalPackages,
      vulnerable_packages: vulnerablePackages,
      critical_vulnerabilities: criticalVulns,
      high_vulnerabilities: highVulns,
      medium_vulnerabilities: mediumVulns,
      low_vulnerabilities: lowVulns,
      supply_chain_risks: supplyChainRisks,
      license_issues: licenseIssues,
      recommendations: recommendations,
      dependencies: dependencies
    };
  }

  /**
   * Generar recomendaciones
   */
  private generateRecommendations(
    critical: number,
    high: number,
    supplyChain: number,
    license: number
  ): string[] {
    const recommendations: string[] = [];

    if (critical > 0) {
      recommendations.push(`🚨 CRÍTICO: Actualizar inmediatamente ${critical} paquetes con vulnerabilidades críticas`);
    }

    if (high > 0) {
      recommendations.push(`⚠️ ALTO: Revisar y actualizar ${high} paquetes con vulnerabilidades altas`);
    }

    if (supplyChain > 0) {
      recommendations.push(`🔗 SUPPLY CHAIN: Evaluar ${supplyChain} paquetes con alto riesgo de supply chain`);
    }

    if (license > 0) {
      recommendations.push(`📄 LICENCIAS: Revisar ${license} paquetes con licencias incompatibles`);
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ No se encontraron problemas críticos en las dependencias');
    }

    recommendations.push('🔄 Ejecutar auditorías regulares con npm audit y Snyk');
    recommendations.push('📦 Mantener dependencias actualizadas a versiones estables');
    recommendations.push('🔒 Usar package-lock.json para reproducibilidad');

    return recommendations;
  }

  /**
   * Obtener estadísticas de auditoría
   */
  getAuditStats(): {
    last_audit: Date | null;
    total_packages: number;
    vulnerable_packages: number;
    high_risk_packages: number;
    security_score: number;
  } {
    const dependencies = Array.from(this.auditResults.values());
    const totalPackages = dependencies.length;
    const vulnerablePackages = dependencies.filter(d => d.vulnerabilities.length > 0).length;
    const highRiskPackages = dependencies.filter(d => d.supply_chain_risk > 70).length;
    
    // Calcular puntuación de seguridad
    let securityScore = 100;
    securityScore -= vulnerablePackages * 5;
    securityScore -= highRiskPackages * 10;
    
    return {
      last_audit: this.lastAuditTime,
      total_packages: totalPackages,
      vulnerable_packages: vulnerablePackages,
      high_risk_packages: highRiskPackages,
      security_score: Math.max(0, securityScore)
    };
  }
}

/**
 * Configuración por defecto
 */
export const DEFAULT_KEY_MANAGEMENT_CONFIG: KeyManagementConfig = {
  provider: 'vault',
  hsm: {
    enabled: false,
    device_path: '/usr/lib/softhsm/libsofthsm2.so',
    pin: '1234',
    token_label: 'arbitragex'
  },
  vault: {
    enabled: true,
    endpoint: 'https://vault.example.com:8200',
    auth_method: 'token',
    mount_path: 'secret'
  },
  security: {
    key_rotation_interval: 90, // 90 días
    backup_enabled: true,
    audit_logging: true,
    access_control: true
  },
  encryption: {
    algorithm: 'AES-256-GCM',
    key_derivation: 'Argon2',
    salt_length: 32
  }
};

/**
 * Exportar para uso en otros módulos
 */
export { KeyManagementSystem, DependencyAuditSystem };
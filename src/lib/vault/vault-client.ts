/**
 * ArbitrageX Supreme - HashiCorp Vault Client
 * Ingenio Pichichi S.A. - Cliente empresarial para gestión de secretos
 * TODO FUNCIONAL - Gestión segura de secretos sin hardcoding
 */

import axios, { AxiosInstance } from 'axios';

export interface VaultConfig {
  vaultAddr: string;
  vaultToken: string;
  timeout?: number;
  retries?: number;
}

export interface SecretValue {
  [key: string]: string | number | boolean;
}

export interface VaultSecret {
  data: SecretValue;
  metadata: {
    created_time: string;
    custom_metadata: null | object;
    deletion_time: string;
    destroyed: boolean;
    version: number;
  };
}

export class VaultClient {
  private client: AxiosInstance;
  private config: VaultConfig;

  constructor(config: VaultConfig) {
    this.config = {
      timeout: 10000,
      retries: 3,
      ...config,
    };

    this.client = axios.create({
      baseURL: this.config.vaultAddr,
      timeout: this.config.timeout,
      headers: {
        'X-Vault-Token': this.config.vaultToken,
        'Content-Type': 'application/json',
      },
    });

    // Interceptor para retry automático
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const { config: requestConfig } = error;
        
        if (!requestConfig || !requestConfig.retry) {
          requestConfig.retry = 0;
        }

        if (requestConfig.retry < this.config.retries!) {
          requestConfig.retry += 1;
          console.warn(`🔄 Reintentando petición Vault (${requestConfig.retry}/${this.config.retries})`);
          return this.client.request(requestConfig);
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Verificar estado de conexión con Vault
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/v1/sys/health');
      return response.status === 200;
    } catch (error) {
      console.error('❌ Vault health check falló:', error);
      return false;
    }
  }

  /**
   * Obtener secreto desde Vault
   */
  async getSecret(path: string): Promise<SecretValue | null> {
    try {
      const response = await this.client.get(`/v1/secret/data/${path}`);
      
      if (response.data && response.data.data) {
        return response.data.data.data;
      }
      
      return null;
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.warn(`⚠️  Secreto no encontrado: ${path}`);
        return null;
      }
      
      console.error(`❌ Error obteniendo secreto ${path}:`, error.message);
      throw error;
    }
  }

  /**
   * Almacenar secreto en Vault
   */
  async putSecret(path: string, data: SecretValue): Promise<boolean> {
    try {
      await this.client.post(`/v1/secret/data/${path}`, {
        data: data,
      });
      
      console.log(`✅ Secreto almacenado: ${path}`);
      return true;
    } catch (error: any) {
      console.error(`❌ Error almacenando secreto ${path}:`, error.message);
      throw error;
    }
  }

  /**
   * Eliminar secreto de Vault
   */
  async deleteSecret(path: string): Promise<boolean> {
    try {
      await this.client.delete(`/v1/secret/data/${path}`);
      console.log(`🗑️  Secreto eliminado: ${path}`);
      return true;
    } catch (error: any) {
      console.error(`❌ Error eliminando secreto ${path}:`, error.message);
      throw error;
    }
  }

  /**
   * Listar secretos en un path
   */
  async listSecrets(path: string): Promise<string[]> {
    try {
      const response = await this.client.get(`/v1/secret/metadata/${path}`, {
        params: { list: true }
      });
      
      return response.data?.data?.keys || [];
    } catch (error: any) {
      if (error.response?.status === 404) {
        return [];
      }
      
      console.error(`❌ Error listando secretos ${path}:`, error.message);
      throw error;
    }
  }

  /**
   * Renovar token de autenticación
   */
  async renewToken(): Promise<boolean> {
    try {
      await this.client.post('/v1/auth/token/renew-self');
      console.log('🔄 Token Vault renovado');
      return true;
    } catch (error: any) {
      console.error('❌ Error renovando token Vault:', error.message);
      throw error;
    }
  }

  /**
   * Obtener información del token actual
   */
  async getTokenInfo(): Promise<any> {
    try {
      const response = await this.client.get('/v1/auth/token/lookup-self');
      return response.data?.data;
    } catch (error: any) {
      console.error('❌ Error obteniendo info del token:', error.message);
      throw error;
    }
  }
}

/**
 * Singleton para el cliente Vault
 */
class VaultManager {
  private static instance: VaultClient | null = null;

  static getInstance(): VaultClient {
    if (!VaultManager.instance) {
      const config: VaultConfig = {
        vaultAddr: process.env.VAULT_ADDR || 'http://127.0.0.1:8200',
        vaultToken: process.env.VAULT_TOKEN || '',
        timeout: parseInt(process.env.VAULT_TIMEOUT || '10000'),
        retries: parseInt(process.env.VAULT_RETRIES || '3'),
      };

      if (!config.vaultToken) {
        throw new Error('VAULT_TOKEN no está configurado en las variables de entorno');
      }

      VaultManager.instance = new VaultClient(config);
    }

    return VaultManager.instance;
  }

  static async initialize(): Promise<VaultClient> {
    const client = VaultManager.getInstance();
    
    const isHealthy = await client.healthCheck();
    if (!isHealthy) {
      throw new Error('Vault no está disponible o no responde');
    }

    console.log('✅ Vault client inicializado correctamente');
    return client;
  }
}

/**
 * Utilidades para manejo común de secretos
 */
export class VaultSecretHelper {
  private vault: VaultClient;

  constructor(vault: VaultClient) {
    this.vault = vault;
  }

  /**
   * Obtener configuración de blockchain
   */
  async getBlockchainConfig(network: string): Promise<{
    rpcUrl: string;
    privateKey?: string;
    apiKey?: string;
  } | null> {
    const secrets = await this.vault.getSecret(`blockchain/${network.toLowerCase()}`);
    
    if (!secrets) {
      return null;
    }

    return {
      rpcUrl: secrets.rpc_url as string,
      privateKey: secrets.private_key as string,
      apiKey: secrets.api_key as string,
    };
  }

  /**
   * Obtener API keys externas
   */
  async getExternalApiKeys(): Promise<{
    alchemyKey?: string;
    infuraKey?: string;
    moralisKey?: string;
    coingeckoKey?: string;
  } | null> {
    const secrets = await this.vault.getSecret('api-keys/external');
    
    if (!secrets) {
      return null;
    }

    return {
      alchemyKey: secrets.alchemy_key as string,
      infuraKey: secrets.infura_key as string,
      moralisKey: secrets.moralis_key as string,
      coingeckoKey: secrets.coingecko_key as string,
    };
  }

  /**
   * Obtener configuración de base de datos
   */
  async getDatabaseConfig(): Promise<{
    url: string;
    username?: string;
    password?: string;
  } | null> {
    const secrets = await this.vault.getSecret('database/primary');
    
    if (!secrets) {
      return null;
    }

    return {
      url: secrets.url as string,
      username: secrets.username as string,
      password: secrets.password as string,
    };
  }

  /**
   * Obtener claves de seguridad
   */
  async getSecurityKeys(): Promise<{
    jwtSecret?: string;
    encryptionKey?: string;
    apiSecret?: string;
  } | null> {
    const secrets = await this.vault.getSecret('security/tokens');
    
    if (!secrets) {
      return null;
    }

    return {
      jwtSecret: secrets.jwt_secret as string,
      encryptionKey: secrets.encryption_key as string,
      apiSecret: secrets.api_secret as string,
    };
  }
}

// Exportar instancias por defecto
export const vault = VaultManager.getInstance;
export const initializeVault = VaultManager.initialize;
export default VaultManager;
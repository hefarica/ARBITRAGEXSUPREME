/**
 * ArbitrageX Supreme - Vault Middleware
 * Ingenio Pichichi S.A. - Middleware para inyección segura de secretos
 * TODO FUNCIONAL - Middleware empresarial para aplicaciones
 */

import { Request, Response, NextFunction } from 'express';
import { VaultClient, VaultSecretHelper } from './vault-client';

export interface VaultRequest extends Request {
  vault?: {
    client: VaultClient;
    helper: VaultSecretHelper;
    secrets: {
      [key: string]: any;
    };
  };
}

/**
 * Middleware para inyectar cliente Vault en requests
 */
export function vaultMiddleware() {
  return async (req: VaultRequest, res: Response, next: NextFunction) => {
    try {
      // Inicializar cliente Vault
      const vaultClient = new VaultClient({
        vaultAddr: process.env.VAULT_ADDR || 'http://127.0.0.1:8200',
        vaultToken: process.env.VAULT_TOKEN || '',
      });

      // Verificar conectividad
      const isHealthy = await vaultClient.healthCheck();
      if (!isHealthy) {
        console.warn('⚠️  Vault no disponible - Usando configuración de fallback');
        return next();
      }

      // Inyectar utilities en el request
      req.vault = {
        client: vaultClient,
        helper: new VaultSecretHelper(vaultClient),
        secrets: {},
      };

      console.log('🔐 Vault middleware activo - Secretos disponibles');
      next();
    } catch (error) {
      console.error('❌ Error en Vault middleware:', error);
      
      // Continuar sin Vault en caso de error (degraded mode)
      next();
    }
  };
}

/**
 * Middleware para pre-cargar secretos específicos
 */
export function preloadSecrets(secretPaths: string[]) {
  return async (req: VaultRequest, res: Response, next: NextFunction) => {
    if (!req.vault) {
      return next();
    }

    try {
      // Pre-cargar secretos solicitados
      const secretPromises = secretPaths.map(async (path) => {
        const secrets = await req.vault!.client.getSecret(path);
        return { path, secrets };
      });

      const results = await Promise.all(secretPromises);
      
      // Almacenar secretos en el request
      results.forEach(({ path, secrets }) => {
        if (secrets) {
          req.vault!.secrets[path] = secrets;
        }
      });

      console.log(`🔐 Pre-cargados ${results.length} grupos de secretos`);
      next();
    } catch (error) {
      console.error('❌ Error pre-cargando secretos:', error);
      next(); // Continuar sin secretos pre-cargados
    }
  };
}

/**
 * Middleware para validar que los secretos críticos estén disponibles
 */
export function requireSecrets(requiredPaths: string[]) {
  return async (req: VaultRequest, res: Response, next: NextFunction) => {
    if (!req.vault) {
      return res.status(503).json({
        error: 'Vault no disponible',
        message: 'Servicio de gestión de secretos no accesible'
      });
    }

    try {
      // Verificar que todos los secretos requeridos existen
      const missingSecrets = [];
      
      for (const path of requiredPaths) {
        const secrets = await req.vault.client.getSecret(path);
        if (!secrets) {
          missingSecrets.push(path);
        }
      }

      if (missingSecrets.length > 0) {
        return res.status(503).json({
          error: 'Secretos críticos no disponibles',
          missing: missingSecrets,
          message: 'No se puede procesar la solicitud sin los secretos requeridos'
        });
      }

      next();
    } catch (error) {
      console.error('❌ Error validando secretos requeridos:', error);
      return res.status(503).json({
        error: 'Error accediendo a secretos',
        message: 'No se pudo validar la disponibilidad de secretos críticos'
      });
    }
  };
}

/**
 * Utilidad para obtener secretos con fallback a variables de entorno
 */
export async function getSecretWithFallback(
  vaultClient: VaultClient | null,
  secretPath: string,
  secretKey: string,
  envVarName: string
): Promise<string | null> {
  // Intentar obtener desde Vault primero
  if (vaultClient) {
    try {
      const secrets = await vaultClient.getSecret(secretPath);
      if (secrets && secrets[secretKey]) {
        return secrets[secretKey] as string;
      }
    } catch (error) {
      console.warn(`⚠️  No se pudo obtener ${secretPath}/${secretKey} desde Vault`);
    }
  }

  // Fallback a variable de entorno
  const envValue = process.env[envVarName];
  if (envValue) {
    console.warn(`⚠️  Usando fallback env var ${envVarName} para ${secretPath}/${secretKey}`);
    return envValue;
  }

  console.error(`❌ No se encontró ${secretPath}/${secretKey} en Vault ni ${envVarName} en env vars`);
  return null;
}

/**
 * Decorator para métodos que requieren secretos específicos
 */
export function RequireVaultSecrets(secretPaths: string[]) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const vaultClient = (this as any).vaultClient as VaultClient;
      
      if (!vaultClient) {
        throw new Error(`Método ${propertyName} requiere Vault client activo`);
      }

      // Verificar que los secretos requeridos estén disponibles
      for (const path of secretPaths) {
        const secrets = await vaultClient.getSecret(path);
        if (!secrets) {
          throw new Error(`Secreto requerido no disponible: ${path}`);
        }
      }

      // Ejecutar método original
      return method.apply(this, args);
    };
  };
}

/**
 * Hook para React/Next.js que maneja secretos desde Vault
 */
export function useVaultSecrets() {
  return {
    getSecret: async (path: string, key: string, fallbackEnvVar?: string) => {
      try {
        // Intentar obtener desde API que usa Vault
        const response = await fetch(`/api/vault/secrets/${path}/${key}`);
        
        if (response.ok) {
          const data = await response.json();
          return data.value;
        }
      } catch (error) {
        console.warn('Error obteniendo secreto desde API:', error);
      }

      // Fallback solo funciona en servidor
      if (typeof window === 'undefined' && fallbackEnvVar) {
        return process.env[fallbackEnvVar] || null;
      }

      return null;
    },
    
    isVaultAvailable: async () => {
      try {
        const response = await fetch('/api/vault/health');
        return response.ok;
      } catch {
        return false;
      }
    }
  };
}

export default {
  vaultMiddleware,
  preloadSecrets,
  requireSecrets,
  getSecretWithFallback,
  RequireVaultSecrets,
  useVaultSecrets,
};
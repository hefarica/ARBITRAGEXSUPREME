/**
 * ArbitrageX Supreme - Vault Secrets API
 * Ingenio Pichichi S.A. - API segura para acceso a secretos
 * TODO FUNCIONAL - Endpoint para obtener secretos con autenticación
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { VaultClient } from '../../../../lib/vault/vault-client';
import jwt from 'jsonwebtoken';

interface AuthenticatedRequest extends NextApiRequest {
  user?: {
    id: string;
    role: string;
  };
}

// Middleware de autenticación
async function authenticate(req: AuthenticatedRequest): Promise<boolean> {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }

  try {
    const token = authHeader.substring(7);
    const jwtSecret = process.env.JWT_SECRET || 'default-secret';
    
    const decoded = jwt.verify(token, jwtSecret) as any;
    req.user = decoded;
    
    return true;
  } catch (error) {
    return false;
  }
}

// Lista de paths permitidos (whitelist de seguridad)
const ALLOWED_SECRET_PATHS = [
  'api-keys/external',
  'blockchain/ethereum',
  'blockchain/polygon',
  'blockchain/arbitrum',
  'blockchain/optimism',
  'blockchain/base',
  // NO incluir paths críticos como private keys en producción
];

export default async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  // Solo permitir GET
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      error: 'Método no permitido',
      allowedMethods: ['GET'] 
    });
  }

  // Autenticación requerida
  const isAuthenticated = await authenticate(req);
  if (!isAuthenticated) {
    return res.status(401).json({
      error: 'No autorizado',
      message: 'Token de autenticación válido requerido'
    });
  }

  try {
    // Obtener path desde query params
    const { path } = req.query;
    
    if (!path || !Array.isArray(path)) {
      return res.status(400).json({
        error: 'Path requerido',
        message: 'Debe especificar un path para el secreto'
      });
    }

    const secretPath = path.join('/');
    
    // Validar que el path esté en la whitelist
    if (!ALLOWED_SECRET_PATHS.includes(secretPath)) {
      return res.status(403).json({
        error: 'Acceso denegado',
        message: `Path ${secretPath} no está autorizado`,
        allowedPaths: ALLOWED_SECRET_PATHS
      });
    }

    // Inicializar cliente Vault
    const vaultClient = new VaultClient({
      vaultAddr: process.env.VAULT_ADDR || 'http://127.0.0.1:8200',
      vaultToken: process.env.VAULT_TOKEN || '',
    });

    // Verificar que Vault esté disponible
    const isHealthy = await vaultClient.healthCheck();
    if (!isHealthy) {
      return res.status(503).json({
        error: 'Vault no disponible',
        message: 'Servicio de gestión de secretos no accesible'
      });
    }

    // Obtener secreto
    const secrets = await vaultClient.getSecret(secretPath);
    
    if (!secrets) {
      return res.status(404).json({
        error: 'Secreto no encontrado',
        path: secretPath,
        message: 'El secreto solicitado no existe en Vault'
      });
    }

    // Filtrar datos sensibles para el log (no loggear valores)
    console.log(`✅ Secreto obtenido: ${secretPath} por usuario ${req.user?.id}`);

    // Respuesta exitosa (sin exponer valores completos en logs)
    return res.status(200).json({
      success: true,
      path: secretPath,
      data: secrets,
      timestamp: new Date().toISOString(),
      message: 'Secreto obtenido exitosamente'
    });

  } catch (error: any) {
    console.error('Error obteniendo secreto desde Vault:', error);
    
    return res.status(500).json({
      error: 'Error interno',
      message: 'No se pudo obtener el secreto solicitado',
      timestamp: new Date().toISOString()
    });
  }
}
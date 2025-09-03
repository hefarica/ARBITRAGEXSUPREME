/**
 * ArbitrageX Supreme - Vault Health Check API
 * Ingenio Pichichi S.A. - Endpoint para verificar estado de Vault
 * TODO FUNCIONAL - API real para monitoreo de Vault
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { VaultClient } from '../../../lib/vault/vault-client';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Solo permitir GET
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      error: 'Método no permitido',
      allowedMethods: ['GET'] 
    });
  }

  try {
    // Inicializar cliente Vault
    const vaultClient = new VaultClient({
      vaultAddr: process.env.VAULT_ADDR || 'http://127.0.0.1:8200',
      vaultToken: process.env.VAULT_TOKEN || '',
    });

    // Verificar health de Vault
    const isHealthy = await vaultClient.healthCheck();
    
    if (isHealthy) {
      // Obtener información adicional del token si está disponible
      let tokenInfo = null;
      try {
        tokenInfo = await vaultClient.getTokenInfo();
      } catch (error) {
        console.warn('No se pudo obtener info del token:', error);
      }

      return res.status(200).json({
        status: 'healthy',
        vault_addr: process.env.VAULT_ADDR || 'http://127.0.0.1:8200',
        timestamp: new Date().toISOString(),
        token_valid: !!tokenInfo,
        token_ttl: tokenInfo?.ttl || null,
        message: 'Vault está disponible y respondiendo'
      });
    } else {
      return res.status(503).json({
        status: 'unhealthy',
        vault_addr: process.env.VAULT_ADDR || 'http://127.0.0.1:8200',
        timestamp: new Date().toISOString(),
        message: 'Vault no está disponible o no responde'
      });
    }

  } catch (error: any) {
    console.error('Error en Vault health check:', error);
    
    return res.status(503).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString(),
      message: 'Error al conectar con Vault'
    });
  }
}
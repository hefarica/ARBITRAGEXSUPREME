/**
 * ArbitrageX Supreme - Network Status API
 * Ingenio Pichichi S.A. - API para monitoreo de estado de redes blockchain
 * TODO FUNCIONAL - Status real de conectividad multi-chain
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { getMultiChainProvider, SupportedChain } from '../../../lib/blockchain/multi-chain-provider';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Solo permitir GET
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      error: 'Método no permitido',
      allowedMethods: ['GET'] 
    });
  }

  try {
    const providerManager = getMultiChainProvider();
    
    // Obtener parámetros de consulta
    const { chain, detailed } = req.query;
    const includeDetailed = detailed === 'true';
    
    if (chain && typeof chain === 'string') {
      // Status de una red específica
      const chainName = chain as SupportedChain;
      
      if (!providerManager.getProvider(chainName)) {
        return res.status(404).json({
          error: 'Red no encontrada',
          chain: chainName,
          availableChains: ['ethereum', 'polygon', 'arbitrum', 'optimism', 'base']
        });
      }

      const health = providerManager.getChainHealth(chainName);
      const config = providerManager.getChainConfig(chainName);
      
      let gasPrice = null;
      try {
        gasPrice = await providerManager.getOptimalGasPrice(chainName, 'standard');
      } catch (error) {
        console.warn(`No se pudo obtener gas price para ${chainName}:`, error);
      }

      const response = {
        chain: chainName,
        status: health?.isHealthy ? 'healthy' : 'unhealthy',
        config: {
          chainId: config.chainId,
          name: config.name,
          nativeCurrency: config.nativeCurrency,
          blockExplorer: config.blockExplorer
        },
        health: health ? {
          isHealthy: health.isHealthy,
          latency: health.latency,
          lastBlock: health.lastBlock,
          gasPrice: gasPrice?.toString(),
          lastCheck: health.timestamp
        } : null,
        timestamp: new Date().toISOString()
      };

      if (includeDetailed) {
        // Información detallada adicional
        try {
          const provider = providerManager.getProvider(chainName);
          if (provider) {
            const [network, blockNumber] = await Promise.all([
              provider.getNetwork(),
              provider.getBlockNumber()
            ]);

            (response as any).detailed = {
              networkInfo: {
                chainId: network.chainId.toString(),
                name: network.name
              },
              currentBlock: blockNumber,
              gasConfiguration: config.gasPrice
            };
          }
        } catch (error) {
          console.warn(`Error obteniendo información detallada para ${chainName}:`, error);
        }
      }

      return res.status(200).json(response);

    } else {
      // Status de todas las redes
      const networks = ['ethereum', 'polygon', 'arbitrum', 'optimism', 'base'] as SupportedChain[];
      const networkStatuses = [];

      for (const networkName of networks) {
        const provider = providerManager.getProvider(networkName);
        if (provider) {
          const health = providerManager.getChainHealth(networkName);
          const config = providerManager.getChainConfig(networkName);

          let gasPrice = null;
          try {
            gasPrice = await providerManager.getOptimalGasPrice(networkName, 'standard');
          } catch (error) {
            console.warn(`No se pudo obtener gas price para ${networkName}:`, error);
          }

          networkStatuses.push({
            chain: networkName,
            status: health?.isHealthy ? 'healthy' : 'unhealthy',
            chainId: config.chainId,
            name: config.name,
            nativeCurrency: config.nativeCurrency.symbol,
            health: health ? {
              latency: health.latency,
              lastBlock: health.lastBlock,
              gasPrice: gasPrice?.toString(),
              lastCheck: health.timestamp
            } : null
          });
        } else {
          networkStatuses.push({
            chain: networkName,
            status: 'disconnected',
            chainId: providerManager.getChainConfig(networkName).chainId,
            name: providerManager.getChainConfig(networkName).name,
            health: null
          });
        }
      }

      // Resumen general
      const summary = providerManager.getNetworkSummary();

      const response = {
        summary: {
          totalNetworks: summary.totalNetworks,
          healthyNetworks: summary.healthyNetworks,
          unhealthyNetworks: summary.unhealthyNetworks,
          avgLatency: summary.avgLatency,
          overallStatus: summary.healthyNetworks === summary.totalNetworks ? 'optimal' : 
                        summary.healthyNetworks > 0 ? 'degraded' : 'critical'
        },
        networks: networkStatuses,
        timestamp: new Date().toISOString()
      };

      return res.status(200).json(response);
    }

  } catch (error: any) {
    console.error('Error en network status API:', error);
    
    return res.status(500).json({
      error: 'Error interno del servidor',
      message: 'No se pudo obtener el estado de las redes',
      timestamp: new Date().toISOString()
    });
  }
}
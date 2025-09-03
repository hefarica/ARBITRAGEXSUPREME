/**
 * ArbitrageX Supreme - Cross-Chain Opportunities API
 * Ingenio Pichichi S.A. - API para oportunidades de arbitraje cross-chain
 * TODO FUNCIONAL - Oportunidades reales entre múltiples redes
 */

import { NextApiRequest, NextApiResponse } from 'next';
import { getMultiChainProvider } from '../../../lib/blockchain/multi-chain-provider';
import { CrossChainArbitrageEngine } from '../../../lib/blockchain/cross-chain-arbitrage';

// Cache global para el engine (singleton)
let globalArbitrageEngine: CrossChainArbitrageEngine | null = null;

async function getArbitrageEngine(): Promise<CrossChainArbitrageEngine> {
  if (!globalArbitrageEngine) {
    const providerManager = getMultiChainProvider();
    
    // Verificar que al menos 2 redes estén disponibles
    const summary = providerManager.getNetworkSummary();
    if (summary.healthyNetworks < 2) {
      throw new Error(`Arbitraje cross-chain requiere al menos 2 redes saludables. Disponibles: ${summary.healthyNetworks}`);
    }
    
    globalArbitrageEngine = new CrossChainArbitrageEngine(providerManager);
  }
  
  return globalArbitrageEngine;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  
  if (req.method === 'GET') {
    // Obtener oportunidades de arbitraje
    try {
      const { scan, limit } = req.query;
      const shouldScan = scan === 'true';
      const maxResults = limit ? parseInt(limit as string) : 50;

      const engine = await getArbitrageEngine();

      let opportunities;
      
      if (shouldScan) {
        console.log('🔍 Iniciando escaneo de oportunidades cross-chain...');
        opportunities = await engine.scanCrossChainOpportunities();
      } else {
        // Obtener oportunidades ya en cache
        opportunities = engine.getActiveOpportunities();
      }

      // Limpiar oportunidades expiradas
      engine.cleanupExpiredOpportunities();

      // Limitar resultados
      const limitedOpportunities = opportunities.slice(0, maxResults);

      // Obtener estadísticas
      const stats = engine.getStatistics();

      const response = {
        success: true,
        scan: shouldScan,
        opportunities: limitedOpportunities.map(opp => ({
          id: opp.id,
          token: {
            symbol: opp.tokenSymbol,
            address: opp.tokenAddress
          },
          route: {
            source: {
              chain: opp.sourceChain,
              dex: opp.sourceDex,
              price: opp.sourcePrice.toString()
            },
            target: {
              chain: opp.targetChain,
              dex: opp.targetDex,
              price: opp.targetPrice.toString()
            }
          },
          profitability: {
            priceSpread: opp.priceSpread,
            estimatedProfit: opp.estimatedProfit.toString(),
            netProfit: opp.netProfit.toString(),
            profitMarginPercent: opp.profitMarginPercent
          },
          costs: {
            gasSource: opp.estimatedGasCosts.source.toString(),
            gasTarget: opp.estimatedGasCosts.target.toString(),
            bridgeFee: opp.estimatedGasCosts.bridge.toString(),
            totalGas: opp.estimatedGasCosts.total.toString()
          },
          risk: {
            executionComplexity: opp.executionComplexity,
            riskScore: opp.riskScore,
            liquiditySource: opp.liquiditySource.toString(),
            liquidityTarget: opp.liquidityTarget.toString()
          },
          timing: {
            createdAt: opp.timestamp,
            expiresAt: opp.expiresAt,
            timeToExpiry: Math.max(0, Math.floor((opp.expiresAt.getTime() - Date.now()) / 1000))
          }
        })),
        statistics: {
          ...stats,
          scannedAt: shouldScan ? new Date().toISOString() : null
        },
        meta: {
          total: opportunities.length,
          returned: limitedOpportunities.length,
          limit: maxResults
        },
        timestamp: new Date().toISOString()
      };

      return res.status(200).json(response);

    } catch (error: any) {
      console.error('Error obteniendo oportunidades cross-chain:', error);
      
      return res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }

  } else if (req.method === 'POST') {
    // Ejecutar arbitraje específico
    try {
      const { opportunityId, confirm } = req.body;

      if (!opportunityId) {
        return res.status(400).json({
          success: false,
          error: 'ID de oportunidad requerido',
          message: 'Debe proporcionar opportunityId en el body'
        });
      }

      if (!confirm) {
        return res.status(400).json({
          success: false,
          error: 'Confirmación requerida',
          message: 'Debe incluir confirm: true para ejecutar arbitraje'
        });
      }

      const engine = await getArbitrageEngine();
      
      console.log(`🚀 Ejecutando arbitraje para oportunidad: ${opportunityId}`);
      const result = await engine.executeArbitrage(opportunityId);

      const response = {
        success: result.success,
        execution: {
          opportunityId: result.opportunityId,
          transactions: result.transactions.map(tx => ({
            chain: tx.chain,
            hash: tx.hash,
            status: tx.status,
            gasUsed: tx.gasUsed?.toString()
          })),
          actualProfit: result.actualProfit?.toString(),
          executionTime: result.executionTime,
          error: result.error
        },
        timestamp: new Date().toISOString()
      };

      const statusCode = result.success ? 200 : 500;
      return res.status(statusCode).json(response);

    } catch (error: any) {
      console.error('Error ejecutando arbitraje cross-chain:', error);
      
      return res.status(500).json({
        success: false,
        error: 'Error ejecutando arbitraje',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }

  } else {
    // Método no permitido
    return res.status(405).json({ 
      error: 'Método no permitido',
      allowedMethods: ['GET', 'POST'],
      message: 'Use GET para obtener oportunidades, POST para ejecutar arbitraje'
    });
  }
}
'use client'

import { useEffect, useState } from 'react'

interface ArbitrageOpportunity {
  id: string
  strategy: string
  protocol: string
  blockchain: string
  token: string
  profitUsd: number
  profitPercent: number
  gasEstimate: number
  status: 'detected' | 'validating' | 'ready' | 'executing'
  detectedAt: string
}

export default function ArbitrageOpportunities() {
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadOpportunities = async () => {
      setIsLoading(true)
      
      // Mock data - will be replaced with real API calls
      const mockOpportunities: ArbitrageOpportunity[] = [
        {
          id: '1',
          strategy: 'Inter-DEX',
          protocol: 'Uniswap V3',
          blockchain: 'Ethereum',
          token: 'USDC/WETH',
          profitUsd: 247.85,
          profitPercent: 2.34,
          gasEstimate: 45.2,
          status: 'ready',
          detectedAt: '2025-01-01T12:30:00Z'
        },
        {
          id: '2',
          strategy: 'Flash Minting',
          protocol: 'Aave V3',
          blockchain: 'Polygon',
          token: 'DAI',
          profitUsd: 892.15,
          profitPercent: 5.67,
          gasEstimate: 12.8,
          status: 'executing',
          detectedAt: '2025-01-01T12:28:00Z'
        },
        {
          id: '3',
          strategy: 'Stablecoin Depeg',
          protocol: 'Curve',
          blockchain: 'BSC',
          token: 'BUSD/USDT',
          profitUsd: 156.92,
          profitPercent: 1.89,
          gasEstimate: 8.5,
          status: 'validating',
          detectedAt: '2025-01-01T12:25:00Z'
        },
        {
          id: '4',
          strategy: 'Cross-Chain',
          protocol: 'Multichain',
          blockchain: 'Arbitrum',
          token: 'WBTC',
          profitUsd: 1247.33,
          profitPercent: 3.21,
          gasEstimate: 23.7,
          status: 'detected',
          detectedAt: '2025-01-01T12:32:00Z'
        }
      ]
      
      await new Promise(resolve => setTimeout(resolve, 1200))
      
      setOpportunities(mockOpportunities)
      setIsLoading(false)
    }

    loadOpportunities()

    // Auto-refresh every 5 seconds (anti-flicker system)
    const interval = setInterval(() => {
      loadOpportunities()
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'detected':
        return <span className="status-warning">Detectada</span>
      case 'validating':
        return <span className="status-warning">Validando</span>
      case 'ready':
        return <span className="status-active">Lista</span>
      case 'executing':
        return <span className="status-danger">Ejecutando</span>
      default:
        return <span className="status-inactive">Desconocido</span>
    }
  }

  if (isLoading) {
    return (
      <div className="arbitrage-card">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
          🔥 Oportunidades de Arbitraje
        </h3>
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="loading-pulse h-16 w-full rounded-lg"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="arbitrage-card">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          🔥 Oportunidades de Arbitraje
        </h3>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          Actualización cada 5s
        </span>
      </div>

      <div className="space-y-4">
        {opportunities.map((opportunity) => (
          <div 
            key={opportunity.id}
            className="p-4 border border-gray-200 dark:border-slate-600 rounded-lg hover:border-primary-300 dark:hover:border-primary-600 transition-all duration-200 anti-flicker"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <span className="text-sm font-medium text-primary-600 dark:text-primary-400">
                  {opportunity.strategy}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {opportunity.protocol}
                </span>
              </div>
              {getStatusBadge(opportunity.status)}
            </div>

            <div className="grid grid-cols-2 gap-4 mb-3">
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Token/Par</div>
                <div className="font-mono text-sm text-gray-900 dark:text-white">
                  {opportunity.token}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Blockchain</div>
                <div className="text-sm text-gray-900 dark:text-white">
                  {opportunity.blockchain}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Beneficio</div>
                  <div className="font-semibold text-success-600 dark:text-success-400">
                    ${opportunity.profitUsd.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">%</div>
                  <div className="font-semibold text-success-600 dark:text-success-400">
                    +{opportunity.profitPercent.toFixed(2)}%
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Gas</div>
                  <div className="text-sm text-warning-600 dark:text-warning-400">
                    ${opportunity.gasEstimate.toFixed(1)}
                  </div>
                </div>
              </div>
              
              <button className="btn-primary text-xs px-3 py-1">
                Ejecutar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
'use client'

import { useEffect, useState } from 'react'

interface Protocol {
  id: string
  name: string
  category: string
  blockchain: string
  tvl: number
  volume24h: number
  isActive: boolean
  riskScore: number
  lastSync: string
}

export default function ProtocolStatus() {
  const [protocols, setProtocols] = useState<Protocol[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadProtocols = async () => {
      setIsLoading(true)
      
      // Mock data - will be replaced with real API calls
      const mockProtocols: Protocol[] = [
        {
          id: '1',
          name: 'Uniswap V3',
          category: 'DEX_AMM',
          blockchain: 'Ethereum',
          tvl: 5247850000,
          volume24h: 892150000,
          isActive: true,
          riskScore: 2,
          lastSync: '2025-01-01T12:35:00Z'
        },
        {
          id: '2',
          name: 'Aave V3',
          category: 'LENDING',
          blockchain: 'Polygon',
          tvl: 12847200000,
          volume24h: 247890000,
          isActive: true,
          riskScore: 1,
          lastSync: '2025-01-01T12:34:00Z'
        },
        {
          id: '3',
          name: 'PancakeSwap V3',
          category: 'DEX_AMM',
          blockchain: 'BSC',
          tvl: 3456780000,
          volume24h: 567890000,
          isActive: true,
          riskScore: 3,
          lastSync: '2025-01-01T12:33:00Z'
        },
        {
          id: '4',
          name: 'Compound V3',
          category: 'LENDING',
          blockchain: 'Ethereum',
          tvl: 8901230000,
          volume24h: 123450000,
          isActive: false,
          riskScore: 2,
          lastSync: '2025-01-01T12:25:00Z'
        },
        {
          id: '5',
          name: 'Curve Finance',
          category: 'STABLECOIN',
          blockchain: 'Ethereum',
          tvl: 6789450000,
          volume24h: 445670000,
          isActive: true,
          riskScore: 1,
          lastSync: '2025-01-01T12:35:00Z'
        }
      ]
      
      await new Promise(resolve => setTimeout(resolve, 800))
      
      setProtocols(mockProtocols)
      setIsLoading(false)
    }

    loadProtocols()

    // Auto-refresh every 10 seconds
    const interval = setInterval(() => {
      loadProtocols()
    }, 10000)

    return () => clearInterval(interval)
  }, [])

  const formatCurrency = (value: number) => {
    if (value >= 1e9) {
      return `$${(value / 1e9).toFixed(1)}B`
    }
    if (value >= 1e6) {
      return `$${(value / 1e6).toFixed(1)}M`
    }
    return `$${(value / 1e3).toFixed(1)}K`
  }

  const getRiskBadge = (riskScore: number) => {
    if (riskScore <= 2) {
      return <span className="status-active">Bajo</span>
    } else if (riskScore <= 5) {
      return <span className="status-warning">Medio</span>
    } else {
      return <span className="status-danger">Alto</span>
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'DEX_AMM':
        return '🔄'
      case 'LENDING':
        return '🏦'
      case 'STABLECOIN':
        return '💰'
      default:
        return '🔗'
    }
  }

  if (isLoading) {
    return (
      <div className="protocol-card">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
          🔗 Estado de Protocolos
        </h3>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="loading-pulse h-20 w-full rounded-lg"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="protocol-card">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          🔗 Estado de Protocolos
        </h3>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {protocols.filter(p => p.isActive).length} / {protocols.length} Activos
        </span>
      </div>

      <div className="space-y-3">
        {protocols.map((protocol) => (
          <div 
            key={protocol.id}
            className={`p-4 border rounded-lg transition-all duration-200 anti-flicker ${
              protocol.isActive 
                ? 'border-success-200 dark:border-success-800 bg-success-50/50 dark:bg-success-900/10' 
                : 'border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-700/50'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <span className="text-lg">{getCategoryIcon(protocol.category)}</span>
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">
                    {protocol.name}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {protocol.blockchain}
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {getRiskBadge(protocol.riskScore)}
                {protocol.isActive ? (
                  <span className="status-active">Activo</span>
                ) : (
                  <span className="status-inactive">Inactivo</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400">TVL</div>
                <div className="font-semibold text-primary-600 dark:text-primary-400">
                  {formatCurrency(protocol.tvl)}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Vol. 24h</div>
                <div className="font-semibold text-secondary-600 dark:text-secondary-400">
                  {formatCurrency(protocol.volume24h)}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Última Sync</div>
                <div className="text-xs text-gray-600 dark:text-gray-300">
                  {new Date(protocol.lastSync).toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
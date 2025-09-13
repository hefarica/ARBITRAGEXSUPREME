'use client'

import React from 'react'

// Componente para los logos de las blockchains
export function BlockchainLogo({ chainId, size = 'sm' }: { 
  chainId: string
  size?: 'xs' | 'sm' | 'md' | 'lg' 
}) {
  const sizeClasses = {
    xs: 'w-4 h-4',
    sm: 'w-6 h-6', 
    md: 'w-8 h-8',
    lg: 'w-10 h-10'
  }
  
  const logoClass = `${sizeClasses[size]} rounded-full flex items-center justify-center font-bold text-white`

  switch (chainId) {
    case '0x1': // Ethereum
      return (
        <div className={`${logoClass} bg-gradient-to-br from-blue-500 to-indigo-600 shadow-sm`}>
          <span className={size === 'xs' ? 'text-xs' : size === 'sm' ? 'text-sm' : 'text-lg'}>Ξ</span>
        </div>
      )
    
    case '0x89': // Polygon
      return (
        <div className={`${logoClass} bg-gradient-to-br from-purple-500 to-purple-700 shadow-sm`}>
          <span className={size === 'xs' ? 'text-xs' : size === 'sm' ? 'text-sm' : 'text-lg'}>⬟</span>
        </div>
      )
    
    case '0x38': // BNB Smart Chain
      return (
        <div className={`${logoClass} bg-gradient-to-br from-yellow-400 to-yellow-600 shadow-sm`}>
          <span className={size === 'xs' ? 'text-xs' : size === 'sm' ? 'text-sm' : 'text-lg'}>B</span>
        </div>
      )
    
    case '0xa4b1': // Arbitrum
      return (
        <div className={`${logoClass} bg-gradient-to-br from-blue-400 to-cyan-500 shadow-sm`}>
          <span className={size === 'xs' ? 'text-xs' : size === 'sm' ? 'text-sm' : 'text-lg'}>Ⓐ</span>
        </div>
      )
    
    case '0xa': // Optimism
      return (
        <div className={`${logoClass} bg-gradient-to-br from-red-400 to-red-600 shadow-sm`}>
          <span className={size === 'xs' ? 'text-xs' : size === 'sm' ? 'text-sm' : 'text-lg'}>○</span>
        </div>
      )
    
    default:
      return (
        <div className={`${logoClass} bg-gradient-to-br from-gray-400 to-gray-600 shadow-sm`}>
          <span className={size === 'xs' ? 'text-xs' : size === 'sm' ? 'text-sm' : 'text-lg'}>?</span>
        </div>
      )
  }
}

// Componente para mostrar logo con nombre
export function BlockchainLogoWithName({ chainId, showName = true }: {
  chainId: string
  showName?: boolean
}) {
  const networks = {
    '0x1': { name: 'Ethereum', symbol: 'ETH' },
    '0x89': { name: 'Polygon', symbol: 'MATIC' },
    '0x38': { name: 'BNB Chain', symbol: 'BNB' },
    '0xa4b1': { name: 'Arbitrum', symbol: 'ETH' },
    '0xa': { name: 'Optimism', symbol: 'ETH' }
  }

  const network = networks[chainId as keyof typeof networks]

  return (
    <div className="flex items-center space-x-2">
      <BlockchainLogo chainId={chainId} size="sm" />
      {showName && network && (
        <div className="flex flex-col">
          <span className="text-sm font-medium text-gray-900">{network.name}</span>
          <span className="text-xs text-gray-500">{network.symbol} • {chainId}</span>
        </div>
      )}
    </div>
  )
}
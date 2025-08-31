'use client'

import React, { useState, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  CheckCircle2, 
  Plus, 
  ExternalLink, 
  Loader2,
  AlertCircle,
  Network,
  Zap
} from 'lucide-react'
import { useMetaMask } from '@/hooks/useMetaMask'
import { ALL_SUPPORTED_NETWORKS, type NetworkConfig } from '@/lib/networkConfigs'
import { cn } from '@/lib/utils'

interface NetworkCardProps {
  network: NetworkConfig
  isInstalled: boolean
  isCurrentNetwork: boolean
  onAddNetwork: (chainId: string) => Promise<void>
  isAddingNetwork: boolean
}

function NetworkCard({ 
  network, 
  isInstalled, 
  isCurrentNetwork, 
  onAddNetwork,
  isAddingNetwork 
}: NetworkCardProps) {
  const handleAddNetwork = async () => {
    await onAddNetwork(network.chainId)
  }

  return (
    <Card className={cn(
      "relative overflow-hidden transition-all duration-300 hover:shadow-lg",
      isInstalled 
        ? "bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 shadow-green-100" 
        : "bg-gradient-to-br from-slate-50 to-gray-50 border-gray-200 hover:border-gray-300",
      isCurrentNetwork && "ring-2 ring-blue-500 ring-offset-2"
    )}>
      {/* Color accent bar */}
      <div 
        className="absolute top-0 left-0 right-0 h-1"
        style={{ backgroundColor: network.color }}
      />
      
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {/* Network icon placeholder */}
            <div 
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
              style={{ backgroundColor: network.color }}
            >
              {network.nativeCurrency.symbol.substring(0, 2)}
            </div>
            
            <div>
              <CardTitle className="text-sm font-semibold text-gray-900">
                {network.chainName}
              </CardTitle>
              <p className="text-xs text-gray-500">
                {network.nativeCurrency.symbol} • ID: {parseInt(network.chainId, 16)}
              </p>
            </div>
          </div>
          
          {/* Status indicator */}
          <div className="flex flex-col items-end space-y-1">
            {isCurrentNetwork && (
              <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300 text-xs px-2 py-0">
                <Network className="w-3 h-3 mr-1" />
                Activa
              </Badge>
            )}
            
            {isInstalled ? (
              <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300 text-xs px-2 py-0">
                <CheckCircle2 className="w-3 h-3 mr-1" />
                Instalada
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-300 text-xs px-2 py-0">
                <AlertCircle className="w-3 h-3 mr-1" />
                Faltante
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {/* Network description */}
        <p className="text-xs text-gray-600 mb-4 leading-relaxed">
          {network.description}
        </p>

        {/* Network details */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white/60 rounded-lg p-2">
            <p className="text-xs text-gray-500 font-medium">Token Nativo</p>
            <p className="text-sm font-semibold text-gray-900">{network.nativeCurrency.symbol}</p>
          </div>
          
          <div className="bg-white/60 rounded-lg p-2">
            <p className="text-xs text-gray-500 font-medium">Wrapped Token</p>
            <p className="text-sm font-semibold text-gray-900">{network.wrappedToken}</p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center space-x-2">
          {!isInstalled ? (
            <Button 
              onClick={handleAddNetwork}
              disabled={isAddingNetwork}
              size="sm"
              className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white border-0"
            >
              {isAddingNetwork ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Agregando...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Agregar Red
                </>
              )}
            </Button>
          ) : (
            <Button 
              variant="outline" 
              size="sm"
              className="flex-1 border-green-300 text-green-700 hover:bg-green-50"
              disabled
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Instalada
            </Button>
          )}
          
          {/* Explorer link */}
          <Button 
            variant="ghost" 
            size="sm"
            className="px-3 text-gray-600 hover:text-gray-900"
            onClick={() => window.open(network.blockExplorerUrls[0], '_blank')}
          >
            <ExternalLink className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export function NetworkGrid() {
  const { 
    chainId: currentChainId,
    isConnected,
    installedNetworks,
    addNetwork,
    isLoading,
    error,
    refreshNetworks
  } = useMetaMask()

  const [addingNetworkId, setAddingNetworkId] = useState<string | null>(null)
  const lastClickTime = useRef<{ [chainId: string]: number }>({})
  const DEBOUNCE_DELAY = 2000 // 2 segundos

  const handleAddNetwork = useCallback(async (chainId: string) => {
    const now = Date.now()
    const lastClick = lastClickTime.current[chainId] || 0
    
    // Verificar debounce - evitar clics rápidos
    if (now - lastClick < DEBOUNCE_DELAY) {
      console.log(`⚠️ Evitando clic rápido para ${chainId}. Espera ${Math.ceil((DEBOUNCE_DELAY - (now - lastClick)) / 1000)} segundos.`)
      return
    }
    
    // Evitar solicitudes duplicadas
    if (addingNetworkId === chainId) {
      console.log(`⚠️ Solicitud ya en proceso para ${chainId}`)
      return
    }
    
    lastClickTime.current[chainId] = now
    setAddingNetworkId(chainId)
    
    try {
      console.log(`🔄 Iniciando agregado de red ${chainId}`)
      const success = await addNetwork(chainId)
      if (success) {
        console.log(`✅ Red ${chainId} agregada exitosamente`)
        // Refrescar la lista de redes después de agregar exitosamente
        await refreshNetworks()
      } else {
        console.log(`❌ Falloo agregar red ${chainId}`)
      }
    } catch (err: any) {
      console.error(`❌ Error agregando red ${chainId}:`, err)
      // Si es error de solicitud pendiente, mostrar mensaje informativo
      if (err.message && err.message.includes('already pending')) {
        console.log(`🔄 Solicitud pendiente detectada para ${chainId}`)
      }
    } finally {
      setAddingNetworkId(null)
    }
  }, [addNetwork, refreshNetworks, addingNetworkId])

  const installedCount = installedNetworks.length
  const missingCount = ALL_SUPPORTED_NETWORKS.length - installedCount

  return (
    <div className="space-y-6">
      {/* Header con estadísticas */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Redes Blockchain Soportadas
          </h2>
          <p className="text-gray-600">
            Administra las 20 redes blockchain integradas en ArbitrageX Supreme
          </p>
        </div>
        
        <div className="text-right">
          <div className="flex items-center space-x-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{installedCount}</div>
              <div className="text-xs text-gray-500">Instaladas</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{missingCount}</div>
              <div className="text-xs text-gray-500">Faltantes</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">20</div>
              <div className="text-xs text-gray-500">Total</div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-600">Progreso de Integración</span>
          <span className="font-medium text-gray-900">
            {Math.round((installedCount / ALL_SUPPORTED_NETWORKS.length) * 100)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div 
            className="bg-gradient-to-r from-green-500 to-emerald-500 h-full transition-all duration-500 ease-out"
            style={{ width: `${(installedCount / ALL_SUPPORTED_NETWORKS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Status messages */}
      {!isConnected && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            <p className="text-yellow-800 font-medium">
              Conecta tu wallet MetaMask para gestionar las redes blockchain
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-red-800 font-medium">{error}</p>
          </div>
        </div>
      )}

      {/* Networks grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {ALL_SUPPORTED_NETWORKS.map((network) => {
          const isInstalled = installedNetworks.includes(network.chainId)
          const isCurrentNetwork = currentChainId !== null && currentChainId.toString() === network.chainId.replace('0x', '')
          const isAddingThisNetwork = addingNetworkId === network.chainId

          return (
            <NetworkCard
              key={network.chainId}
              network={network}
              isInstalled={isInstalled}
              isCurrentNetwork={isCurrentNetwork}
              onAddNetwork={handleAddNetwork}
              isAddingNetwork={isAddingThisNetwork}
            />
          )
        })}
      </div>

      {/* Footer info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
        <div className="flex items-start space-x-3">
          <Zap className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h3 className="font-medium text-blue-900 mb-1">
              Integración Inteligente de Redes
            </h3>
            <p className="text-sm text-blue-800 leading-relaxed">
              ArbitrageX detecta automáticamente qué redes blockchain faltan en tu MetaMask 
              y activa botones de instalación solo para las redes faltantes. 
              Cada red incluye configuración completa de RPC, exploradores y tokens nativos.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
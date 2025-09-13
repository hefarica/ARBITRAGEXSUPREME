'use client'

import React, { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useMetaMaskOptimized } from '@/hooks/useMetaMaskOptimized'
import { 
  Wallet, 
  ExternalLink, 
  AlertCircle, 
  CheckCircle2,
  RefreshCw,
  Power,
  Network,
  Copy,
  Download,
  Zap,
  Shield,
  AlertTriangle,
  Settings,
  ArrowUpDown
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface MetaMaskConnectorOptimizedProps {
  className?: string
  showDetails?: boolean
  compact?: boolean
  onConnectionChange?: (connected: boolean, address?: string) => void
}

export function MetaMaskConnectorOptimized({ 
  className, 
  showDetails = true, 
  compact = false,
  onConnectionChange 
}: MetaMaskConnectorOptimizedProps) {
  const {
    isConnected,
    address,
    chainId,
    chainName,
    balance,
    isLoading,
    error,
    networkSupported,
    isMetaMaskInstalled,
    connect,
    disconnect,
    refresh,
    switchToSupportedNetwork,
    supportedNetworks
  } = useMetaMaskOptimized()

  const [showNetworks, setShowNetworks] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)

  // Notificar cambios de conexión
  React.useEffect(() => {
    onConnectionChange?.(isConnected, address || undefined)
  }, [isConnected, address, onConnectionChange])

  const copyAddress = useCallback(async () => {
    if (address) {
      try {
        await navigator.clipboard.writeText(address)
        setCopySuccess(true)
        setTimeout(() => setCopySuccess(false), 2000)
      } catch (error) {
        console.error('Failed to copy address:', error)
      }
    }
  }, [address])

  const formatAddress = useCallback((addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }, [])

  const formatBalance = useCallback((bal: string) => {
    const num = parseFloat(bal)
    if (num === 0) return '0'
    if (num < 0.001) return '< 0.001'
    if (num < 1) return num.toFixed(4)
    return num.toFixed(3)
  }, [])

  // Componente compacto para dashboards
  if (compact) {
    return (
      <div className={cn("flex items-center space-x-2", className)}>
        {!isMetaMaskInstalled ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open('https://metamask.io/download/', '_blank')}
            className="text-orange-600 border-orange-200 hover:bg-orange-50"
          >
            <Download className="w-4 h-4 mr-2" />
            <span className="font-montserrat uppercase font-semibold tracking-wide">INSTALAR</span>
          </Button>
        ) : !isConnected ? (
          <Button
            onClick={connect}
            disabled={isLoading}
            size="sm"
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            {isLoading ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Wallet className="w-4 h-4 mr-2" />
            )}
            <span className="font-montserrat uppercase font-semibold tracking-wide">CONECTAR</span>
          </Button>
        ) : (
          <div className="flex items-center space-x-2">
            <Badge 
              variant="secondary" 
              className={cn(
                "font-montserrat uppercase text-xs tracking-wider",
                networkSupported 
                  ? "bg-emerald-100 text-emerald-800" 
                  : "bg-amber-100 text-amber-800"
              )}
            >
              <CheckCircle2 className="w-3 h-3 mr-1" />
              {formatAddress(address!)}
            </Badge>
            {!networkSupported && (
              <Button
                variant="ghost"
                size="sm"
                onClick={switchToSupportedNetwork}
                className="h-8 w-8 p-0 text-amber-600 hover:text-amber-700"
                title="Cambiar a red soportada"
              >
                <ArrowUpDown className="w-4 h-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={disconnect}
              className="h-8 w-8 p-0 text-slate-500 hover:text-red-600"
              title="Desconectar"
            >
              <Power className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    )
  }

  // Componente completo
  return (
    <Card className={cn(className, "backdrop-blur-md bg-white/90 border rounded-2xl shadow-sm")}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Wallet className="w-5 h-5 text-orange-500" />
            <span className="font-montserrat uppercase font-semibold tracking-wide text-gray-900">
              METAMASK WALLET
            </span>
          </div>
          {isConnected && (
            <div className="flex items-center space-x-2">
              <Badge 
                variant="secondary" 
                className={cn(
                  "font-montserrat uppercase text-xs tracking-wider",
                  networkSupported 
                    ? "bg-emerald-100 text-emerald-800" 
                    : "bg-amber-100 text-amber-800"
                )}
              >
                {networkSupported ? (
                  <><CheckCircle2 className="w-3 h-3 mr-1" />CONECTADO</>
                ) : (
                  <><AlertTriangle className="w-3 h-3 mr-1" />RED NO SOPORTADA</>
                )}
              </Badge>
            </div>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Error Messages */}
        {error && (
          <div className="flex items-start space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        {/* Network Warning */}
        {isConnected && !networkSupported && (
          <div className="flex items-start justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-sm font-medium text-amber-800">Red no soportada</div>
                <div className="text-xs text-amber-700">
                  Cambia a una red soportada para usar arbitraje
                </div>
              </div>
            </div>
            <Button
              size="sm"
              onClick={switchToSupportedNetwork}
              className="bg-amber-500 hover:bg-amber-600 text-white text-xs"
            >
              CAMBIAR RED
            </Button>
          </div>
        )}

        {!isMetaMaskInstalled ? (
          // MetaMask No Instalado
          <div className="text-center space-y-4">
            <div className="p-4 rounded-lg bg-gradient-to-br from-orange-50 to-red-50 border border-orange-200">
              <Download className="w-8 h-8 text-orange-600 mx-auto mb-2" />
              <div className="font-montserrat uppercase text-sm text-slate-600 tracking-wide mb-2">
                METAMASK REQUERIDO
              </div>
              <div className="text-xs text-slate-500 mb-4">
                Necesitas MetaMask para conectar tu wallet y realizar operaciones de arbitraje
              </div>
            </div>
            <Button
              onClick={() => {
                // Estrategia anti-bloqueo mejorada
                const userAgent = navigator.userAgent
                let installUrl = 'https://metamask.io/download/'
                
                // URLs específicas por navegador
                if (userAgent.includes('Firefox')) {
                  installUrl = 'https://addons.mozilla.org/en-US/firefox/addon/ether-metamask/'
                } else if (userAgent.includes('Edg')) {
                  installUrl = 'https://microsoftedge.microsoft.com/addons/detail/metamask/ejbalbakoplchlghecdalmeeeajnimhm'
                }
                
                // Intentar abrir con configuración segura
                const newWindow = window.open(installUrl, '_blank', 'noopener,noreferrer')
                
                // Detectar si fue bloqueado
                setTimeout(() => {
                  if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
                    // Mostrar instrucciones alternativas
                    const alternatives = [
                      '1. Ve a: https://metamask.io/download/',
                      '2. Busca "MetaMask" en tu tienda de extensiones',
                      '3. O descarga desde: https://github.com/MetaMask/metamask-extension/releases'
                    ].join('\n')
                    
                    alert(`Pop-up bloqueado. Opciones para instalar MetaMask:\n\n${alternatives}`)
                  }
                }, 500)
              }}
              className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl px-6 py-3 transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <Download className="w-4 h-4 mr-2" />
              <span className="font-montserrat uppercase font-semibold tracking-wide">
                DESCARGAR METAMASK
              </span>
              <ExternalLink className="w-3 h-3 ml-2" />
            </Button>
          </div>
        ) : !isConnected ? (
          // No Conectado
          <div className="text-center space-y-4">
            <div className="p-4 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200">
              <Wallet className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <div className="font-montserrat uppercase text-sm text-slate-600 tracking-wide mb-2">
                CONECTAR WALLET
              </div>
              <div className="text-xs text-slate-500">
                Conecta tu wallet MetaMask para acceder a todas las funciones de arbitraje
              </div>
            </div>
            <Button
              onClick={connect}
              disabled={isLoading}
              className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white rounded-xl px-6 py-3 transition-all duration-200 shadow-md hover:shadow-lg"
            >
              {isLoading ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Wallet className="w-4 h-4 mr-2" />
              )}
              <span className="font-montserrat uppercase font-semibold tracking-wide">
                CONECTAR METAMASK
              </span>
            </Button>
          </div>
        ) : (
          // Conectado - Mostrar Detalles
          showDetails && (
            <div className="space-y-3">
              {/* Dirección */}
              <div className="flex items-center justify-between p-3 backdrop-blur-sm bg-white/50 rounded-xl border border-gray-100">
                <div className="flex-1">
                  <div className="font-montserrat uppercase text-xs text-slate-500 tracking-wider">
                    DIRECCIÓN
                  </div>
                  <div className="font-mono font-montserrat uppercase text-sm tracking-wide">
                    {formatAddress(address!)}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyAddress}
                  className={cn(
                    "h-8 w-8 p-0 hover:bg-gray-100 rounded-lg transition-all duration-200",
                    copySuccess && "bg-emerald-100 text-emerald-600"
                  )}
                  title={copySuccess ? "¡Copiado!" : "Copiar dirección"}
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>

              {/* Red */}
              <div className="flex items-center justify-between p-3 backdrop-blur-sm bg-white/50 rounded-xl border border-gray-100">
                <div className="flex-1">
                  <div className="font-montserrat uppercase text-xs text-slate-500 tracking-wider">
                    RED BLOCKCHAIN
                  </div>
                  <div className="flex items-center space-x-2">
                    <Network className={cn(
                      "w-4 h-4",
                      networkSupported ? "text-emerald-600" : "text-amber-600"
                    )} />
                    <span className="font-montserrat uppercase text-sm tracking-wide">
                      {chainName}
                    </span>
                  </div>
                </div>
                {!networkSupported && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowNetworks(!showNetworks)}
                    className="h-8 w-8 p-0 hover:bg-gray-100 rounded-lg"
                    title="Ver redes soportadas"
                  >
                    <Settings className="w-3 h-3" />
                  </Button>
                )}
              </div>

              {/* Mostrar redes soportadas */}
              {showNetworks && (
                <div className="p-3 bg-slate-50 rounded-xl border">
                  <div className="font-montserrat uppercase text-xs text-slate-500 tracking-wider mb-2">
                    REDES SOPORTADAS
                  </div>
                  <div className="grid gap-1">
                    {Object.entries(supportedNetworks).map(([chainId, network]) => (
                      <div 
                        key={chainId}
                        className="text-xs font-montserrat uppercase tracking-wide text-slate-600 p-1"
                      >
                        • {network.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Balance */}
              {balance && (
                <div className="flex items-center justify-between p-3 backdrop-blur-sm bg-white/50 rounded-xl border border-gray-100">
                  <div className="flex-1">
                    <div className="font-montserrat uppercase text-xs text-slate-500 tracking-wider">
                      BALANCE
                    </div>
                    <div className="flex items-center space-x-2">
                      <Zap className="w-4 h-4 text-yellow-500" />
                      <span className="font-montserrat uppercase font-semibold text-base tracking-wide">
                        {formatBalance(balance)} {supportedNetworks[chainId as keyof typeof supportedNetworks]?.symbol || 'ETH'}
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={refresh}
                    disabled={isLoading}
                    className="h-8 w-8 p-0 hover:bg-gray-100 rounded-lg"
                    title="Actualizar balance"
                  >
                    <RefreshCw className={cn("w-3 h-3", isLoading && "animate-spin")} />
                  </Button>
                </div>
              )}

              {/* Estado de Seguridad */}
              <div className="flex items-center justify-between p-3 backdrop-blur-sm bg-emerald-50 rounded-xl border border-emerald-200">
                <div className="flex items-center space-x-2">
                  <Shield className="w-4 h-4 text-emerald-600" />
                  <div>
                    <div className="font-montserrat uppercase text-xs text-emerald-700 tracking-wider">
                      CONEXIÓN SEGURA
                    </div>
                    <div className="text-xs text-emerald-600">
                      Verificado • SSL • Web3
                    </div>
                  </div>
                </div>
              </div>

              {/* Acciones */}
              <div className="flex space-x-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={refresh}
                  disabled={isLoading}
                  className="flex-1 rounded-xl border-gray-200 hover:bg-gray-50 transition-all duration-200"
                >
                  <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
                  <span className="font-montserrat uppercase text-xs tracking-wider">
                    ACTUALIZAR
                  </span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={disconnect}
                  className="flex-1 text-red-600 border-red-200 hover:bg-red-50 rounded-xl transition-all duration-200"
                >
                  <Power className="w-4 h-4 mr-2" />
                  <span className="font-montserrat uppercase text-xs tracking-wider">
                    DESCONECTAR
                  </span>
                </Button>
              </div>
            </div>
          )
        )}
      </CardContent>
    </Card>
  )
}
'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useMetaMask } from '@/hooks/useMetaMask'
import { 
  Wallet, 
  ExternalLink, 
  AlertCircle, 
  CheckCircle2,
  RefreshCw,
  Power,
  Network,
  Copy,
  Download
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface MetaMaskConnectorProps {
  className?: string
  showDetails?: boolean
  compact?: boolean
}

export function MetaMaskConnector({ className, showDetails = true, compact = false }: MetaMaskConnectorProps) {
  const {
    isConnected,
    accounts,
    chainId,
    balance,
    isLoading,
    error,
    isInstalled: isMetaMaskInstalled,
    connect,
    disconnect,
    refreshNetworks
  } = useMetaMask()

  const address = accounts[0]

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address)
      // TODO: Agregar toast notification
    }
  }

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  if (compact) {
    return (
      <div className={cn("flex items-center space-x-2", className)}>
        {!isMetaMaskInstalled ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // Múltiples opciones de instalación
              const userAgent = navigator.userAgent
              let installUrl = 'https://metamask.io/download/'
              
              if (userAgent.includes('Chrome')) {
                // Usar enlace directo evitando Chrome Web Store si hay problemas
                installUrl = 'https://metamask.io/download/'
              } else if (userAgent.includes('Firefox')) {
                installUrl = 'https://addons.mozilla.org/en-US/firefox/addon/ether-metamask/'
              }
              
              // Abrir en nueva pestaña con configuración segura
              const newWindow = window.open(installUrl, '_blank', 'noopener,noreferrer')
              
              // Si no se abre (bloqueado), mostrar instrucciones
              if (!newWindow) {
                alert('Pop-up bloqueado. Ve manualmente a https://metamask.io/download/ para instalar MetaMask.')
              }
            }}
            className="text-orange-600 border-orange-200 hover:bg-orange-50"
          >
            <Download className="w-4 h-4 mr-2" />
            <span className="font-montserrat uppercase font-semibold tracking-wide">INSTALAR METAMASK</span>
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
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 font-montserrat uppercase text-xs tracking-wider">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              {formatAddress(address!)}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={disconnect}
              className="h-8 w-8 p-0 text-slate-500 hover:text-red-600"
            >
              <Power className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    )
  }

  return (
    <Card className={cn(className, "backdrop-blur-md bg-white/90 border rounded-2xl shadow-sm")}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Wallet className="w-5 h-5 text-orange-500" />
            <span className="font-montserrat uppercase font-semibold tracking-wide text-gray-900">METAMASK WALLET</span>
          </div>
          {isConnected && (
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 font-montserrat uppercase text-xs tracking-wider">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              CONECTADO
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {error && (
          <div className="flex items-start space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-red-700">{error}</div>
          </div>
        )}

        {!isMetaMaskInstalled ? (
          <div className="text-center space-y-4">
            <div className="font-montserrat uppercase text-sm text-slate-600 tracking-wide">
              METAMASK NO ESTÁ INSTALADO EN TU NAVEGADOR
            </div>
            <Button
              onClick={() => {
                // Estrategia múltiple para evitar bloqueos
                const installOptions = [
                  'https://metamask.io/download/',
                  'https://chrome.google.com/webstore/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn',
                  'https://github.com/MetaMask/metamask-extension/releases'
                ]
                
                // Intentar abrir la página principal
                const newWindow = window.open(installOptions[0], '_blank', 'noopener,noreferrer')
                
                // Si se bloquea, mostrar opciones alternativas
                if (!newWindow) {
                  const message = `Pop-up bloqueado. Opciones para instalar MetaMask:
                  
1. Ve a: https://metamask.io/download/
2. O busca "MetaMask" en la tienda de extensiones de tu navegador
3. O descarga desde: https://github.com/MetaMask/metamask-extension/releases`
                  
                  alert(message)
                }
              }}
              className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl px-6 py-3 transition-all duration-200 shadow-md hover:shadow-lg"
            >
              <Download className="w-4 h-4 mr-2" />
              <span className="font-montserrat uppercase font-semibold tracking-wide">DESCARGAR METAMASK</span>
              <ExternalLink className="w-3 h-3 ml-2" />
            </Button>
          </div>
        ) : !isConnected ? (
          <div className="text-center space-y-4">
            <div className="font-montserrat uppercase text-sm text-slate-600 tracking-wide">
              CONECTA TU WALLET METAMASK PARA EJECUTAR OPERACIONES DE ARBITRAJE
            </div>
            <Button
              onClick={connect}
              disabled={isLoading}
              className="bg-orange-500 hover:bg-orange-600 text-white rounded-xl px-6 py-3 transition-all duration-200 shadow-md hover:shadow-lg"
            >
              {isLoading ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Wallet className="w-4 h-4 mr-2" />
              )}
              <span className="font-montserrat uppercase font-semibold tracking-wide">CONECTAR METAMASK</span>
            </Button>
          </div>
        ) : (
          showDetails && (
            <div className="space-y-3">
              {/* Dirección */}
              <div className="flex items-center justify-between p-3 backdrop-blur-sm bg-white/50 rounded-xl border border-gray-100">
                <div>
                  <div className="font-montserrat uppercase text-xs text-slate-500 tracking-wider">DIRECCIÓN</div>
                  <div className="font-mono font-montserrat uppercase text-sm tracking-wide">{formatAddress(address!)}</div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyAddress}
                  className="h-8 w-8 p-0 hover:bg-gray-100 rounded-lg"
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>

              {/* Red */}
              <div className="flex items-center justify-between p-3 backdrop-blur-sm bg-white/50 rounded-xl border border-gray-100">
                <div>
                  <div className="font-montserrat uppercase text-xs text-slate-500 tracking-wider">RED</div>
                  <div className="flex items-center space-x-2">
                    <Network className="w-4 h-4 text-slate-600" />
                    <span className="font-montserrat uppercase text-sm tracking-wide">{chainId ? `Chain ${chainId}` : 'Unknown'}</span>
                  </div>
                </div>
              </div>

              {/* Balance */}
              {balance && (
                <div className="flex items-center justify-between p-3 backdrop-blur-sm bg-white/50 rounded-xl border border-gray-100">
                  <div>
                    <div className="font-montserrat uppercase text-xs text-slate-500 tracking-wider">BALANCE</div>
                    <div className="font-montserrat uppercase font-semibold text-base tracking-wide">{balance} ETH</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={refreshNetworks}
                    className="h-8 w-8 p-0 hover:bg-gray-100 rounded-lg"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </Button>
                </div>
              )}

              {/* Acciones */}
              <div className="flex space-x-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={refreshNetworks}
                  disabled={isLoading}
                  className="flex-1 rounded-xl border-gray-200 hover:bg-gray-50 transition-all duration-200"
                >
                  <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
                  <span className="font-montserrat uppercase text-xs tracking-wider">ACTUALIZAR</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={disconnect}
                  className="flex-1 text-red-600 border-red-200 hover:bg-red-50 rounded-xl transition-all duration-200"
                >
                  <Power className="w-4 h-4 mr-2" />
                  <span className="font-montserrat uppercase text-xs tracking-wider">DESCONECTAR</span>
                </Button>
              </div>
            </div>
          )
        )}
      </CardContent>
    </Card>
  )
}
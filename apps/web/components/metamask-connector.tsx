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
    address,
    chainName,
    balance,
    isLoading,
    error,
    isMetaMaskInstalled,
    connect,
    disconnect,
    refresh
  } = useMetaMask()

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
            onClick={() => window.open('https://metamask.io/download/', '_blank')}
            className="text-orange-600 border-orange-200 hover:bg-orange-50 ios-button-secondary"
          >
            <Download className="w-4 h-4 mr-2" />
            <span className="font-montserrat uppercase font-semibold tracking-wide">INSTALAR METAMASK</span>
          </Button>
        ) : !isConnected ? (
          <Button
            onClick={connect}
            disabled={isLoading}
            size="sm"
            className="bg-orange-500 hover:bg-orange-600 text-white ios-button-primary"
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
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 ios-caption">
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
    <Card className={cn(className, "ios-glass")}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Wallet className="w-5 h-5 text-orange-500" />
            <span className="ios-card-title">METAMASK WALLET</span>
          </div>
          {isConnected && (
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-800 ios-caption">
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
            <div className="ios-body text-slate-600">
              METAMASK NO ESTÁ INSTALADO EN TU NAVEGADOR
            </div>
            <Button
              onClick={() => window.open('https://metamask.io/download/', '_blank')}
              className="bg-orange-500 hover:bg-orange-600 text-white ios-button-primary"
            >
              <Download className="w-4 h-4 mr-2" />
              <span className="font-montserrat uppercase font-semibold tracking-wide">DESCARGAR METAMASK</span>
              <ExternalLink className="w-3 h-3 ml-2" />
            </Button>
          </div>
        ) : !isConnected ? (
          <div className="text-center space-y-4">
            <div className="ios-body text-slate-600">
              CONECTA TU WALLET METAMASK PARA EJECUTAR OPERACIONES DE ARBITRAJE
            </div>
            <Button
              onClick={connect}
              disabled={isLoading}
              className="bg-orange-500 hover:bg-orange-600 text-white ios-button-primary"
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
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg ios-glass">
                <div>
                  <div className="ios-caption text-slate-500">DIRECCIÓN</div>
                  <div className="font-mono ios-body">{formatAddress(address!)}</div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyAddress}
                  className="h-8 w-8 p-0"
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>

              {/* Red */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg ios-glass">
                <div>
                  <div className="ios-caption text-slate-500">RED</div>
                  <div className="flex items-center space-x-2">
                    <Network className="w-4 h-4 text-slate-600" />
                    <span className="ios-body">{chainName}</span>
                  </div>
                </div>
              </div>

              {/* Balance */}
              {balance && (
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg ios-glass">
                  <div>
                    <div className="ios-caption text-slate-500">BALANCE</div>
                    <div className="ios-subheading">{balance} ETH</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={refresh}
                    className="h-8 w-8 p-0"
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
                  onClick={refresh}
                  disabled={isLoading}
                  className="flex-1"
                >
                  <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
                  Actualizar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={disconnect}
                  className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                >
                  <Power className="w-4 h-4 mr-2" />
                  Desconectar
                </Button>
              </div>
            </div>
          )
        )}
      </CardContent>
    </Card>
  )
}
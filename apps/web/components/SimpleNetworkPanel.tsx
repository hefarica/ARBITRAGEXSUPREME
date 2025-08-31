'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Activity, Globe, CheckCircle2, Clock } from 'lucide-react'
import { useArbitrageSnapshot } from '@/hooks/useArbitrageSnapshot'
import { useMetaMask } from '@/hooks/useMetaMask'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'

/**
 * Panel simplificado de sincronización de redes que usa datos reales
 * del snapshot consolidado en lugar de lógica compleja de detección
 */
export function SimpleNetworkPanel() {
  const { 
    blockchainSummaries, 
    isLoading: snapshotLoading,
    totalOpportunities,
    getTotalTVL,
    formatCurrency
  } = useArbitrageSnapshot()
  
  const { 
    isConnected: isMetaMaskConnected, 
    installedNetworks,
    refreshNetworks,
    isLoading: metamaskLoading
  } = useMetaMask()

  // Estadísticas combinadas: snapshot + MetaMask
  const stats = {
    totalImplemented: 20, // Total de redes soportadas
    connected: blockchainSummaries.length, // Redes con datos de arbitraje
    installedInMetaMask: installedNetworks.length, // Redes instaladas en MetaMask
    opportunities: totalOpportunities,
    totalTVL: getTotalTVL()
  }

  const syncPercentage = Math.round((stats.connected / stats.totalImplemented) * 100)

  return (
    <Card className="bg-white/80 backdrop-blur-sm border border-slate-200/40 rounded-2xl shadow-lg shadow-slate-500/10 transition-all duration-300">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Activity className="w-5 h-5 text-blue-600" />
            <span>Estado de Integración de Redes</span>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => refreshNetworks()}
            disabled={metamaskLoading}
            className="text-xs"
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${metamaskLoading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Progreso de sincronización */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span>Sincronización de Redes</span>
              <span className="font-medium">{syncPercentage}%</span>
            </div>
            <Progress 
              value={syncPercentage} 
              className="w-full h-2 bg-slate-100/50 rounded-full overflow-hidden" 
            />
            <p className="text-xs text-gray-500 mt-1">
              {stats.connected} de {stats.totalImplemented} redes sincronizadas
            </p>
          </div>

          {/* Estadísticas principales */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {/* Redes Totales */}
            <div className="text-center p-4 bg-gradient-to-br from-blue-50/50 to-blue-100/30 backdrop-blur-sm rounded-2xl border border-blue-200/20 shadow-sm">
              <div className="text-lg font-bold text-blue-600">{stats.totalImplemented}</div>
              <div className="text-xs text-blue-700/80">Redes Totales</div>
            </div>
            
            {/* Redes con Datos */}
            <div className="text-center p-4 bg-gradient-to-br from-emerald-50/50 to-emerald-100/30 backdrop-blur-sm rounded-2xl border border-emerald-200/20 shadow-sm">
              <div className="text-lg font-bold text-emerald-600">{stats.connected}</div>
              <div className="text-xs text-emerald-700/80">Con Datos</div>
            </div>
            
            {/* MetaMask Instaladas */}
            <div className="text-center p-4 bg-gradient-to-br from-indigo-50/50 to-indigo-100/30 backdrop-blur-sm rounded-2xl border border-indigo-200/20 shadow-sm">
              <div className="text-lg font-bold text-indigo-600">{stats.installedInMetaMask}</div>
              <div className="text-xs text-indigo-700/80">En MetaMask</div>
            </div>
            
            {/* Oportunidades */}
            <div className="text-center p-4 bg-gradient-to-br from-purple-50/50 to-purple-100/30 backdrop-blur-sm rounded-2xl border border-purple-200/20 shadow-sm">
              <div className="text-lg font-bold text-purple-600">{stats.opportunities}</div>
              <div className="text-xs text-purple-700/80">Oportunidades</div>
            </div>
            
            {/* TVL Total */}
            <div className="text-center p-4 bg-gradient-to-br from-orange-50/50 to-orange-100/30 backdrop-blur-sm rounded-2xl border border-orange-200/20 shadow-sm">
              <div className="text-lg font-bold text-orange-600">{formatCurrency(stats.totalTVL)}</div>
              <div className="text-xs text-orange-700/80">TVL Total</div>
            </div>
          </div>

          {/* Estado de MetaMask */}
          <div className="bg-gradient-to-r from-slate-50 to-slate-100/50 rounded-xl p-3 border border-slate-200/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Globe className="w-4 h-4 text-slate-600" />
                <span className="text-sm font-medium text-slate-700">MetaMask</span>
              </div>
              <div className="flex items-center space-x-2">
                {isMetaMaskConnected ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-300 text-xs">
                      Conectado
                    </Badge>
                  </>
                ) : (
                  <>
                    <Clock className="w-4 h-4 text-yellow-600" />
                    <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-300 text-xs">
                      Desconectado
                    </Badge>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Lista compacta de redes principales */}
          {blockchainSummaries.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700 mb-2">Redes Principales Activas</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {blockchainSummaries.slice(0, 8).map((chain) => (
                  <div
                    key={chain.chainId}
                    className="flex items-center justify-between p-2 bg-white/50 rounded-lg border border-slate-200/30 hover:bg-white/70 transition-colors"
                  >
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                      <span className="text-xs font-medium text-gray-700 truncate">
                        {chain.chainName.replace(' Mainnet', '').replace(' Network', '')}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {formatCurrency(chain.totalTVL)}
                    </span>
                  </div>
                ))}
              </div>
              
              {blockchainSummaries.length > 8 && (
                <p className="text-xs text-gray-500 text-center">
                  +{blockchainSummaries.length - 8} redes más...
                </p>
              )}
            </div>
          )}

          {/* Indicador de carga */}
          {snapshotLoading && (
            <div className="text-center py-4">
              <div className="inline-flex items-center space-x-2 text-sm text-gray-500">
                <div className="w-4 h-4 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                <span>Actualizando datos...</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
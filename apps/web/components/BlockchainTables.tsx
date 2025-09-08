'use client'

import React, { memo, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  RefreshCw,
  Database,
  Building2,
  Zap,
  AlertCircle,
  TrendingUp,
  BarChart3
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useBlockchainTables, DexSummary, LendingSummary } from '@/hooks/useBlockchainTables'

// ============================================================================
// COMPONENTES MEMOIZADOS PARA EVITAR RE-RENDERS
// ============================================================================

// Componente de fila DEX memoizado
const DexRow = memo(({ dex, isLast }: { dex: DexSummary; isLast: boolean }) => {
  return (
    <tr 
      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
    >
      <td className="px-4 py-3">
        <span className="font-medium text-gray-900">{dex.blockchain}</span>
      </td>
      <td className="px-4 py-3">
        <div>
          <span className="font-medium text-gray-900">{dex.dex}</span>
          <div className="text-xs text-gray-500">
            {dex.type} • ${(dex.tvlUSD / 1000000).toFixed(1)}M
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-center">
        <Badge 
          variant={dex.flashLoan ? "default" : "secondary"}
          className={cn(
            "text-xs",
            dex.flashLoan 
              ? "bg-green-100 text-green-700 border-green-200" 
              : "bg-gray-100 text-gray-600 border-gray-200"
          )}
        >
          {dex.flashLoan ? (
            <>
              <Zap className="h-3 w-3 mr-1" />
              Sí
            </>
          ) : (
            "No"
          )}
        </Badge>
      </td>
      <td className="px-4 py-3 text-right font-mono text-gray-900">
        {dex.opportunities.toLocaleString()}
      </td>
    </tr>
  );
});

DexRow.displayName = 'DexRow';

// Componente de fila Lending memoizado
const LendingRow = memo(({ lending, isLast }: { lending: LendingSummary; isLast: boolean }) => {
  return (
    <tr 
      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
    >
      <td className="px-4 py-3">
        <span className="font-medium text-gray-900">{lending.blockchain}</span>
      </td>
      <td className="px-4 py-3">
        <div>
          <span className="font-medium text-gray-900">{lending.lending}</span>
          <div className="text-xs text-gray-500">
            {lending.protocol} • ${(lending.tvlUSD / 1000000).toFixed(1)}M
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-center">
        <Badge 
          variant={lending.flashLoan ? "default" : "secondary"}
          className={cn(
            "text-xs",
            lending.flashLoan 
              ? "bg-green-100 text-green-700 border-green-200" 
              : "bg-gray-100 text-gray-600 border-gray-200"
          )}
        >
          {lending.flashLoan ? (
            <>
              <Zap className="h-3 w-3 mr-1" />
              Sí
            </>
          ) : (
            "No"
          )}
        </Badge>
      </td>
      <td className="px-4 py-3 text-right font-mono text-gray-900">
        {lending.opportunities.toLocaleString()}
      </td>
    </tr>
  );
});

LendingRow.displayName = 'LendingRow';

// Componente de subtotal memoizado
const SubtotalRow = memo(({ blockchain, count, type }: { blockchain: string; count: number; type: 'dex' | 'lending' }) => {
  const bgColor = type === 'dex' ? 'bg-blue-50 border-b-2 border-blue-200' : 'bg-green-50 border-b-2 border-green-200';
  const textColor = type === 'dex' ? 'text-blue-900' : 'text-green-900';
  
  return (
    <tr className={bgColor}>
      <td className={`px-4 py-2 font-semibold ${textColor}`} colSpan={3}>
        Subtotal {blockchain}
      </td>
      <td className={`px-4 py-2 text-right font-bold ${textColor} font-mono`}>
        {count.toLocaleString()}
      </td>
    </tr>
  );
});

SubtotalRow.displayName = 'SubtotalRow';

// ============================================================================
// COMPONENTE PRINCIPAL BLOCKCHAIN TABLES (OPTIMIZADO)
// ============================================================================

const BlockchainTablesComponent = memo(() => {
  const { 
    dexSummary,
    lendingSummary,
    totals,
    byBlockchain,
    isLoading,
    isRefreshing,
    hasError,
    error,
    refresh,
    lastUpdate,
    formatCurrency,
    getSubtotalsByBlockchain
  } = useBlockchainTables();

  // ============================================================================
  // DATOS MEMOIZADOS PARA EVITAR RE-COMPUTACIÓN INNECESARIA
  // ============================================================================
  
  const subtotals = useMemo(() => getSubtotalsByBlockchain(), [getSubtotalsByBlockchain]);
  
  // Agrupar DEX por blockchain (memoizado)
  const dexByBlockchain = useMemo(() => {
    return dexSummary.reduce((groups, dex) => {
      if (!groups[dex.blockchain]) groups[dex.blockchain] = [];
      groups[dex.blockchain].push(dex);
      return groups;
    }, {} as { [key: string]: typeof dexSummary });
  }, [dexSummary]);
  
  // Agrupar Lending por blockchain (memoizado)
  const lendingByBlockchain = useMemo(() => {
    return lendingSummary.reduce((groups, lending) => {
      if (!groups[lending.blockchain]) groups[lending.blockchain] = [];
      groups[lending.blockchain].push(lending);
      return groups;
    }, {} as { [key: string]: typeof lendingSummary });
  }, [lendingSummary]);

  if (hasError) {
    return (
      <div className="space-y-6">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              <p className="font-medium">Error al cargar las tablas blockchain</p>
            </div>
            <p className="text-sm text-red-500 mt-2">{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={refresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Reintentar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center">
            <BarChart3 className="h-6 w-6 mr-2 text-blue-600" />
            Matriz Blockchain
          </h2>
          <p className="text-gray-600">
            Distribución de protocolos DEX y Lending por blockchain con soporte Flash Loans
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {lastUpdate && (
            <span className="text-sm text-gray-500">
              Actualizado: {lastUpdate.toLocaleTimeString()}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={refresh} disabled={isRefreshing}>
            <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
            Actualizar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        
        {/* TABLA DEX */}
        <Card className="bg-white border shadow-lg">
          <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
            <CardTitle className="flex items-center text-blue-900">
              <Database className="h-5 w-5 mr-2" />
              Protocolos DEX
            </CardTitle>
            <CardDescription>
              Intercambios Descentralizados con soporte Flash Loans y oportunidades detectadas
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6">
                <div className="animate-pulse space-y-3">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="h-4 bg-gray-200 rounded w-full" />
                  ))}
                </div>
              </div>
            ) : (
              <div className="overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Blockchain</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">DEX</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-700">Flash Loan</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-700">Oportunidades</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(dexByBlockchain).map(([blockchain, dexes]) => (
                      <React.Fragment key={`dex-group-${blockchain}`}>
                        {dexes.map((dex, dexIndex) => (
                          <tr 
                            key={`dex-${blockchain}-${dex.dex}`}
                            className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                          >
                            <td className="px-4 py-3">
                              {dexIndex === 0 ? (
                                <span className="font-medium text-gray-900">{blockchain}</span>
                              ) : (
                                <span className="text-gray-400">↳</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div>
                                <span className="font-medium text-gray-900">{dex.dex}</span>
                                <div className="text-xs text-gray-500">
                                  {dex.type} • {formatCurrency(dex.tvlUSD)}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Badge 
                                variant={dex.flashLoan ? "default" : "secondary"}
                                className={cn(
                                  "text-xs",
                                  dex.flashLoan 
                                    ? "bg-green-100 text-green-700 border-green-200" 
                                    : "bg-gray-100 text-gray-600 border-gray-200"
                                )}
                              >
                                {dex.flashLoan ? (
                                  <>
                                    <Zap className="h-3 w-3 mr-1" />
                                    Sí
                                  </>
                                ) : (
                                  "No"
                                )}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-gray-900">
                              {dex.opportunities.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                        
                        {/* Subtotal por blockchain (optimizado) */}
                        <SubtotalRow 
                          key={`dex-subtotal-${blockchain}`}
                          blockchain={blockchain}
                          count={subtotals[blockchain]?.dex || 0}
                          type="dex"
                        />
                      </React.Fragment>
                    ))}
                    
                    {/* Total Global DEX */}
                    <tr className="bg-blue-100 border-t-2 border-blue-300">
                      <td className="px-4 py-3 font-bold text-blue-900" colSpan={3}>
                        <div className="flex items-center">
                          <TrendingUp className="h-4 w-4 mr-2" />
                          TOTAL GLOBAL DEX
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-blue-900 text-lg font-mono">
                        {totals.dex.totalOpportunities.toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* TABLA LENDING */}
        <Card className="bg-white border shadow-lg">
          <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 border-b">
            <CardTitle className="flex items-center text-green-900">
              <Building2 className="h-5 w-5 mr-2" />
              Protocolos Lending
            </CardTitle>
            <CardDescription>
              Protocolos de Préstamos con soporte Flash Loans y oportunidades de arbitraje
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6">
                <div className="animate-pulse space-y-3">
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="h-4 bg-gray-200 rounded w-full" />
                  ))}
                </div>
              </div>
            ) : (
              <div className="overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Blockchain</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">Lending Protocol</th>
                      <th className="px-4 py-3 text-center font-semibold text-gray-700">Flash Loan</th>
                      <th className="px-4 py-3 text-right font-semibold text-gray-700">Oportunidades</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(lendingByBlockchain).map(([blockchain, lendings]) => (
                      <React.Fragment key={`lending-group-${blockchain}`}>
                        {lendings.map((lending, lendingIndex) => (
                          <tr 
                            key={`lending-${blockchain}-${lending.lending}`}
                            className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                          >
                            <td className="px-4 py-3">
                              {lendingIndex === 0 ? (
                                <span className="font-medium text-gray-900">{blockchain}</span>
                              ) : (
                                <span className="text-gray-400">↳</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div>
                                <span className="font-medium text-gray-900">{lending.lending}</span>
                                <div className="text-xs text-gray-500">
                                  {lending.protocol} • {formatCurrency(lending.tvlUSD)}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Badge 
                                variant={lending.flashLoan ? "default" : "secondary"}
                                className={cn(
                                  "text-xs",
                                  lending.flashLoan 
                                    ? "bg-green-100 text-green-700 border-green-200" 
                                    : "bg-gray-100 text-gray-600 border-gray-200"
                                )}
                              >
                                {lending.flashLoan ? (
                                  <>
                                    <Zap className="h-3 w-3 mr-1" />
                                    Sí
                                  </>
                                ) : (
                                  "No"
                                )}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-gray-900">
                              {lending.opportunities.toLocaleString()}
                            </td>
                          </tr>
                        ))}
                        
                        {/* Subtotal por blockchain (optimizado) */}
                        <SubtotalRow 
                          key={`lending-subtotal-${blockchain}`}
                          blockchain={blockchain}
                          count={subtotals[blockchain]?.lending || 0}
                          type="lending"
                        />
                      </React.Fragment>
                    ))}
                    
                    {/* Total Global Lending */}
                    <tr className="bg-green-100 border-t-2 border-green-300">
                      <td className="px-4 py-3 font-bold text-green-900" colSpan={3}>
                        <div className="flex items-center">
                          <TrendingUp className="h-4 w-4 mr-2" />
                          TOTAL GLOBAL LENDING
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-green-900 text-lg font-mono">
                        {totals.lending.totalOpportunities.toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Resumen Estadístico */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{totals.dex.total}</div>
            <div className="text-sm text-blue-700">Total DEX</div>
            <div className="text-xs text-blue-600 mt-1">
              {totals.dex.withFlashLoan} con Flash Loans
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{totals.lending.total}</div>
            <div className="text-sm text-green-700">Total Lending</div>
            <div className="text-xs text-green-600 mt-1">
              {totals.lending.withFlashLoan} con Flash Loans
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">
              {formatCurrency(totals.dex.totalTVL)}
            </div>
            <div className="text-sm text-purple-700">TVL Total DEX</div>
          </CardContent>
        </Card>
        
        <Card className="bg-orange-50 border-orange-200">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(totals.lending.totalTVL)}
            </div>
            <div className="text-sm text-orange-700">TVL Total Lending</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
});

BlockchainTablesComponent.displayName = 'BlockchainTables';

export { BlockchainTablesComponent as BlockchainTables };
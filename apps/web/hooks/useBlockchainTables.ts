'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

// ============================================================================
// TIPOS PARA TABLAS CONTABLES
// ============================================================================

export interface DexSummary {
  blockchain: string;
  dex: string;
  flashLoan: boolean;
  opportunities: number;
  tvlUSD: number;
  type: string;
}

export interface LendingSummary {
  blockchain: string;
  lending: string;
  flashLoan: boolean;
  opportunities: number;
  tvlUSD: number;
  protocol: string;
}

interface BlockchainTablesData {
  dexSummary: DexSummary[];
  lendingSummary: LendingSummary[];
  totals: {
    dex: {
      total: number;
      withFlashLoan: number;
      totalTVL: number;
      totalOpportunities: number;
    };
    lending: {
      total: number;
      withFlashLoan: number;
      totalTVL: number;
      totalOpportunities: number;
    };
  };
  byBlockchain: {
    [blockchain: string]: {
      dexCount: number;
      lendingCount: number;
      dexFlashLoan: number;
      lendingFlashLoan: number;
      totalOpportunities: number;
    };
  };
}

interface UseBlockchainTablesReturn {
  // Data states
  dexSummary: DexSummary[];
  lendingSummary: LendingSummary[];
  totals: BlockchainTablesData['totals'];
  byBlockchain: BlockchainTablesData['byBlockchain'];
  
  // Loading states
  isLoading: boolean;
  isRefreshing: boolean;
  
  // Error states
  hasError: boolean;
  error: string | null;
  
  // Actions
  refresh: () => Promise<void>;
  
  // Status
  lastUpdate: Date | null;
  
  // Utility functions
  formatCurrency: (amount: number) => string;
  getSubtotalsByBlockchain: () => { [blockchain: string]: { dex: number; lending: number } };
}

export function useBlockchainTables(): UseBlockchainTablesReturn {
  // Data states
  const [dexSummary, setDexSummary] = useState<DexSummary[]>([]);
  const [lendingSummary, setLendingSummary] = useState<LendingSummary[]>([]);
  const [totals, setTotals] = useState<BlockchainTablesData['totals']>({
    dex: { total: 0, withFlashLoan: 0, totalTVL: 0, totalOpportunities: 0 },
    lending: { total: 0, withFlashLoan: 0, totalTVL: 0, totalOpportunities: 0 }
  });
  const [byBlockchain, setByBlockchain] = useState<BlockchainTablesData['byBlockchain']>({});
  
  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Error states
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Status
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // ============================================================================
  // CACHE REFS PARA DIFFING INTELIGENTE
  // ============================================================================
  
  const previousDataRef = useRef<BlockchainTablesData | null>(null);
  const isInitialLoadRef = useRef(true);

  // ============================================================================
  // FUNCIÓN DE DIFFING INTELIGENTE
  // ============================================================================
  
  const hasDataChanged = useCallback((newData: BlockchainTablesData): boolean => {
    if (!previousDataRef.current) return true;
    
    const prev = previousDataRef.current;
    
    // Comparar longitudes de arrays
    if (prev.dexSummary.length !== newData.dexSummary.length ||
        prev.lendingSummary.length !== newData.lendingSummary.length) {
      return true;
    }
    
    // Comparar totales (cambios más críticos)
    if (prev.totals.dex.totalOpportunities !== newData.totals.dex.totalOpportunities ||
        prev.totals.lending.totalOpportunities !== newData.totals.lending.totalOpportunities) {
      return true;
    }
    
    // Comparar oportunidades de protocolos individuales (cambios frecuentes)
    for (let i = 0; i < prev.dexSummary.length; i++) {
      if (prev.dexSummary[i].opportunities !== newData.dexSummary[i].opportunities) {
        return true;
      }
    }
    
    for (let i = 0; i < prev.lendingSummary.length; i++) {
      if (prev.lendingSummary[i].opportunities !== newData.lendingSummary[i].opportunities) {
        return true;
      }
    }
    
    return false;
  }, []);

  // ============================================================================
  // FUNCIÓN PARA CARGAR DATOS DE TABLAS (OPTIMIZADA ANTI-PARPADEO)
  // ============================================================================

  const loadTablesData = useCallback(async (showRefreshIndicator = false) => {
    try {
      if (showRefreshIndicator) {
        setIsRefreshing(true);
      } else if (isInitialLoadRef.current) {
        setIsLoading(true);
      }
      
      setHasError(false);
      setError(null);

      console.log('📊 [Hook] Fetching blockchain tables data from /api/blockchain/tables...');
      
      const response = await fetch('/api/blockchain/tables', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Tables API error: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        const data: BlockchainTablesData = result.data;
        
        // ============================================================================
        // DIFFING INTELIGENTE: Solo actualizar si hay cambios reales
        // ============================================================================
        
        const dataHasChanged = hasDataChanged(data);
        
        if (dataHasChanged || isInitialLoadRef.current) {
          // Update states solo cuando hay cambios reales
          setDexSummary(data.dexSummary);
          setLendingSummary(data.lendingSummary);
          setTotals(data.totals);
          setByBlockchain(data.byBlockchain);
          
          // Almacenar data actual como referencia para próxima comparación
          previousDataRef.current = data;
          
          if (isInitialLoadRef.current) {
            isInitialLoadRef.current = false;
          }
        }
        
        // Actualizar timestamp siempre (para indicador de "última actualización")
        setLastUpdate(new Date());
        
        console.log('✅ [Hook] Blockchain tables data loaded successfully:', {
          dexProtocols: data.dexSummary.length,
          lendingProtocols: data.lendingSummary.length,
          dexOpportunities: data.totals.dex.totalOpportunities,
          lendingOpportunities: data.totals.lending.totalOpportunities,
          cached: result.cached
        });
        
      } else {
        throw new Error('Blockchain tables API returned error status');
      }
      
    } catch (err: any) {
      console.error('❌ [Hook] Error loading blockchain tables data:', err);
      setHasError(true);
      setError(err.message || 'Failed to load tables data');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // ============================================================================
  // FUNCIÓN PARA REFRESCAR DATOS MANUALMENTE
  // ============================================================================

  const refresh = useCallback(async () => {
    await loadTablesData(true);
  }, [loadTablesData]);

  // ============================================================================
  // FUNCIONES UTILITARIAS
  // ============================================================================

  const formatCurrency = useCallback((amount: number): string => {
    if (amount >= 1000000000) {
      return `$${(amount / 1000000000).toFixed(1)}B`;
    } else if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(1)}K`;
    } else {
      return `$${amount.toFixed(0)}`;
    }
  }, []);

  const getSubtotalsByBlockchain = useCallback((): { [blockchain: string]: { dex: number; lending: number } } => {
    const subtotals: { [blockchain: string]: { dex: number; lending: number } } = {};

    // Calcular subtotales de DEX por blockchain
    dexSummary.forEach(dex => {
      if (!subtotals[dex.blockchain]) {
        subtotals[dex.blockchain] = { dex: 0, lending: 0 };
      }
      subtotals[dex.blockchain].dex += dex.opportunities;
    });

    // Calcular subtotales de Lending por blockchain
    lendingSummary.forEach(lending => {
      if (!subtotals[lending.blockchain]) {
        subtotals[lending.blockchain] = { dex: 0, lending: 0 };
      }
      subtotals[lending.blockchain].lending += lending.opportunities;
    });

    return subtotals;
  }, [dexSummary, lendingSummary]);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Carga inicial
  useEffect(() => {
    loadTablesData();
  }, [loadTablesData]);

  // Auto-refresh cada 5 segundos (matching API cache TTL)
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isRefreshing && !isLoading) {
        loadTablesData(false);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isRefreshing, isLoading, loadTablesData]);

  return {
    // Data
    dexSummary,
    lendingSummary,
    totals,
    byBlockchain,
    
    // Loading states
    isLoading,
    isRefreshing,
    
    // Error states
    hasError,
    error,
    
    // Actions
    refresh,
    
    // Status
    lastUpdate,
    
    // Utility functions
    formatCurrency,
    getSubtotalsByBlockchain
  };
}
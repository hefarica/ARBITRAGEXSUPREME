'use client'

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  ArbitrageOpportunity,
  ArbitrageExecution,
  OpportunitiesResponse,
  ExecutionsResponse,
  BlockchainInfo,
  ApiError,
  Chain
} from '../types/api';

// Legacy types for backward compatibility
interface NetworkStatus {
  id: string;
  name: string;
  connected: boolean;
  blockHeight: number;
  latency: number;
}

interface ArbitrageMetrics {
  totalOpportunities: number;
  successRate: number;
  averageProfit: number;
  totalVolume: number;
}

export interface UseArbitrageDataReturn {
  // Data states
  networks: BlockchainInfo[];
  opportunities: ArbitrageOpportunity[];
  executions: ArbitrageExecution[];
  metrics: ArbitrageMetrics | null;
  
  // Loading states
  isLoading: boolean;
  isRefreshing: boolean;
  
  // Error states
  hasError: boolean;
  error: string | null;
  
  // Actions
  refresh: () => Promise<void>;
  executeArbitrage: (opportunityId: string, options?: { slippageTolerance?: number; amount?: string }) => Promise<{ success: boolean; execution?: ArbitrageExecution; error?: string }>;
  cancelExecution: (executionId: string) => Promise<{ success: boolean; error?: string }>;
  
  // Real-time status
  isConnected: boolean;
  lastUpdate: Date | null;
}

export function useArbitrageData(refreshInterval: number = 5000): UseArbitrageDataReturn {
  // Data states
  const [networks, setNetworks] = useState<BlockchainInfo[]>([]);
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
  const [executions, setExecutions] = useState<ArbitrageExecution[]>([]);
  const [metrics, setMetrics] = useState<ArbitrageMetrics | null>(null);
  
  // Loading states
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Error states
  const [hasError, setHasError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Connection states
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  
  // Refs para cleanup
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Función para cargar datos completos
  const loadArbitrageData = useCallback(async (showRefreshIndicator = false) => {
    try {
      // Cancel previous request if exists
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      // Create new abort controller
      abortControllerRef.current = new AbortController();
      
      if (showRefreshIndicator) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      
      setHasError(false);
      setError(null);

      const authToken = localStorage.getItem('accessToken') || '';
      const headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      };

      // Fetch opportunities, networks, and executions in parallel
      const [opportunitiesRes, networksRes, executionsRes] = await Promise.all([
        fetch('/api/v2/arbitrage/opportunities', { headers }),
        fetch('/api/v2/blockchain/supported', { headers }),
        fetch('/api/v2/arbitrage/executions', { headers })
      ]);

      if (!opportunitiesRes.ok || !networksRes.ok || !executionsRes.ok) {
        throw new Error('Failed to fetch arbitrage data');
      }

      const [opportunitiesData, networksData, executionsData]: [
        OpportunitiesResponse | ApiError,
        { success: boolean; blockchains: BlockchainInfo[] } | ApiError,
        ExecutionsResponse | ApiError
      ] = await Promise.all([
        opportunitiesRes.json(),
        networksRes.json(),
        executionsRes.json()
      ]);

      if (opportunitiesData.success && networksData.success && executionsData.success) {
        const opps = opportunitiesData as OpportunitiesResponse;
        const nets = networksData as { success: boolean; blockchains: BlockchainInfo[] };
        const execs = executionsData as ExecutionsResponse;

        setOpportunities(opps.opportunities);
        setNetworks(nets.blockchains);
        setExecutions(execs.executions);
        
        // Calculate metrics from the data
        const successfulExecs = execs.executions.filter(exec => exec.status === 'SUCCESS');
        setMetrics({
          totalOpportunities: opps.total,
          successRate: execs.stats.successRate,
          averageProfit: execs.stats.totalProfitUsd / Math.max(successfulExecs.length, 1),
          totalVolume: execs.stats.totalProfitUsd
        });
        
        setIsConnected(true);
        setLastUpdate(new Date());
        
        console.log('✅ Arbitrage data loaded successfully:', {
          opportunities: opps.opportunities.length,
          networks: nets.blockchains.length,
          executions: execs.executions.length
        });
      } else {
        throw new Error('API returned error responses');
      }
      
    } catch (err: any) {
      console.error('❌ Error loading arbitrage data:', err);
      setHasError(true);
      setError(err.message || 'Failed to load data');
      setIsConnected(false);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Función para refrescar datos manualmente
  const refresh = useCallback(async () => {
    await loadArbitrageData(true);
  }, [loadArbitrageData]);

  // Función para ejecutar arbitraje
  const executeArbitrage = useCallback(async (
    opportunityId: string, 
    options?: { slippageTolerance?: number; amount?: string }
  ) => {
    try {
      const authToken = localStorage.getItem('accessToken') || '';
      const response = await fetch('/api/v2/arbitrage/execute', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          opportunityId,
          slippageTolerance: options?.slippageTolerance || 0.5,
          amount: options?.amount
        })
      });

      if (!response.ok) {
        throw new Error(`Execution failed: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        // Refresh data after successful execution
        await loadArbitrageData(true);
        return { success: true, execution: result.execution };
      } else {
        return { success: false, error: result.error };
      }
    } catch (err: any) {
      console.error('Error executing arbitrage:', err);
      return { success: false, error: err.message };
    }
  }, [loadArbitrageData]);

  // Función para cancelar ejecución
  const cancelExecution = useCallback(async (executionId: string) => {
    try {
      const authToken = localStorage.getItem('accessToken') || '';
      const response = await fetch(`/api/v2/arbitrage/executions/${executionId}/cancel`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        }
      });

      if (!response.ok) {
        throw new Error(`Cancellation failed: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.success) {
        // Refresh data after cancellation
        await loadArbitrageData(true);
        return { success: true };
      } else {
        return { success: false, error: result.error };
      }
    } catch (err: any) {
      console.error('Error cancelling execution:', err);
      return { success: false, error: err.message };
    }
  }, [loadArbitrageData]);

  // Effect para carga inicial
  useEffect(() => {
    loadArbitrageData();
  }, [loadArbitrageData]);

  // Effect para polling de datos en tiempo real (cada 5 segundos)
  useEffect(() => {
    if (refreshInterval > 0) {
      intervalRef.current = setInterval(() => {
        if (!isRefreshing && !isLoading) {
          loadArbitrageData(false);
        }
      }, refreshInterval);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [refreshInterval, isRefreshing, isLoading, loadArbitrageData]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    // Data
    networks,
    opportunities,
    executions,
    metrics,
    
    // Loading states
    isLoading,
    isRefreshing,
    
    // Error states
    hasError,
    error,
    
    // Actions
    refresh,
    executeArbitrage,
    cancelExecution,
    
    // Connection status
    isConnected,
    lastUpdate
  };
}

// Hook específico para métricas en tiempo real
export function useRealTimeMetrics(refreshInterval: number = 5000) {
  const [metrics, setMetrics] = useState<ArbitrageMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadMetrics = useCallback(async () => {
    try {
      const authToken = localStorage.getItem('accessToken') || '';
      const response = await fetch('/api/v2/dashboard/metrics', {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // Transform API metrics to legacy format
          const apiMetrics = result.metrics;
          setMetrics({
            totalOpportunities: apiMetrics.arbitrage.totalOpportunities,
            successRate: apiMetrics.realTime.successRate,
            averageProfit: apiMetrics.arbitrage.averageProfitPercentage,
            totalVolume: apiMetrics.arbitrage.totalValueLocked
          });
        }
      }
    } catch (error) {
      console.error('Error loading real-time metrics:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMetrics();
    
    const interval = setInterval(loadMetrics, refreshInterval);
    return () => clearInterval(interval);
  }, [loadMetrics, refreshInterval]);

  return { metrics, isLoading };
}

// Hook para estado de redes
export function useNetworkStatus(refreshInterval: number = 5000) {
  const [networks, setNetworks] = useState<BlockchainInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadNetworks = useCallback(async () => {
    try {
      const authToken = localStorage.getItem('accessToken') || '';
      const response = await fetch('/api/v2/blockchain/network-status', {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // Transform network status to blockchain info format
          const networksData = Object.entries(result.networks).map(([chainId, status]: [string, any]) => ({
            id: chainId as Chain,
            name: chainId.charAt(0).toUpperCase() + chainId.slice(1),
            symbol: chainId.toUpperCase(),
            chainId: 1, // Mock chain ID
            status: status.connected ? 'active' : 'inactive',
            connected: status.connected,
            blockNumber: status.blockNumber,
            blockTime: 2,
            gasPrice: '1000000',
            explorerUrl: `https://${chainId}scan.com`,
            nativeCurrency: { name: chainId, symbol: chainId.toUpperCase(), decimals: 18 },
            hasWebSocket: true,
            lastCheck: status.lastCheck,
            protocolsSupported: 25,
            tvlUsd: 1000000000
          } as BlockchainInfo));
          
          setNetworks(networksData);
        }
      }
    } catch (error) {
      console.error('Error loading network status:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNetworks();
    
    const interval = setInterval(loadNetworks, refreshInterval);
    return () => clearInterval(interval);
  }, [loadNetworks, refreshInterval]);

  return { networks, isLoading, refresh: loadNetworks };
}
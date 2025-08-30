'use client'

import { useState, useEffect, useCallback, useRef } from 'react';
import { arbitrageService, type DashboardData, type NetworkStatus, type ArbitrageOpportunity, type ArbitrageMetrics } from '@/services/arbitrageService';

export interface UseArbitrageDataReturn {
  // Data states
  networks: NetworkStatus[];
  opportunities: ArbitrageOpportunity[];
  metrics: ArbitrageMetrics | null;
  
  // Loading states
  isLoading: boolean;
  isRefreshing: boolean;
  
  // Error states
  hasError: boolean;
  error: string | null;
  
  // Actions
  refresh: () => Promise<void>;
  executeArbitrage: (opportunityId: string) => Promise<{ success: boolean; txHash?: string; error?: string }>;
  
  // Real-time status
  isConnected: boolean;
  lastUpdate: Date | null;
}

export function useArbitrageData(refreshInterval: number = 10000): UseArbitrageDataReturn {
  // Data states
  const [networks, setNetworks] = useState<NetworkStatus[]>([]);
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
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
  const loadDashboardData = useCallback(async (showRefreshIndicator = false) => {
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

      // Fetch complete dashboard data
      const dashboardData: DashboardData = await arbitrageService.getDashboardData();
      
      // Update all states
      setNetworks(dashboardData.networks);
      setOpportunities(dashboardData.opportunities);
      setMetrics(dashboardData.metrics);
      
      setIsConnected(true);
      setLastUpdate(new Date());
      
      console.log('✅ Dashboard data loaded successfully:', {
        networks: dashboardData.networks.length,
        opportunities: dashboardData.opportunities.length,
        metrics: dashboardData.metrics
      });
      
    } catch (err: any) {
      console.error('❌ Error loading dashboard data:', err);
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
    await loadDashboardData(true);
  }, [loadDashboardData]);

  // Función para ejecutar arbitraje
  const executeArbitrage = useCallback(async (opportunityId: string) => {
    try {
      const result = await arbitrageService.executeArbitrage(opportunityId);
      
      if (result.success) {
        // Refresh data after successful execution
        await loadDashboardData(true);
      }
      
      return result;
    } catch (err: any) {
      console.error('Error executing arbitrage:', err);
      return { success: false, error: err.message };
    }
  }, [loadDashboardData]);

  // Effect para carga inicial
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Effect para polling de datos en tiempo real
  useEffect(() => {
    if (refreshInterval > 0) {
      intervalRef.current = setInterval(() => {
        if (!isRefreshing && !isLoading) {
          loadDashboardData(false);
        }
      }, refreshInterval);

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    }
  }, [refreshInterval, isRefreshing, isLoading, loadDashboardData]);

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
      const metricsData = await arbitrageService.getMetrics();
      setMetrics(metricsData);
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
export function useNetworkStatus(refreshInterval: number = 15000) {
  const [networks, setNetworks] = useState<NetworkStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadNetworks = useCallback(async () => {
    try {
      const networksData = await arbitrageService.getNetworkStatus();
      setNetworks(networksData);
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
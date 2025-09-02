// Interfaces para configuración de redes blockchain
// Tipos actualizados para ArbitrageX Supreme

import type { Chain } from './defi';

// Configuración de red blockchain actualizada
export interface NetworkConfig {
  chainId: string;
  chainName: string;
  chain: Chain; // Tipo estricto de cadena
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: readonly string[];
  blockExplorerUrls: readonly string[];
  iconUrls?: readonly string[];
  wrappedToken?: {
    address: string;
    symbol: string;
    name: string;
    decimals: number;
  };
  color?: string;
  description?: string;
  
  // Propiedades adicionales para ArbitrageX
  multicallAddress?: string;
  subgraphUrl?: string;
  averageBlockTime: number; // seconds
  gasPrice: {
    fast: number;
    standard: number;
    safe: number;
  };
  maxGasLimit: number;
  bridgeTokens: string[];
  dexCount?: number;
  lendingCount?: number;
  tvlUSD?: number;
}

// Estado de red detectada con métricas mejoradas
export interface NetworkItem {
  id: string;
  name: string;
  chain: Chain;
  connected: boolean;
  chainId?: string | number;
  isCurrentNetwork?: boolean;
  config?: NetworkConfig;
  
  // Métricas de rendimiento
  blockNumber?: number;
  rpcStatus: 'online' | 'offline' | 'degraded' | 'unknown';
  gasPrice?: {
    current: string;
    fast: string;
    standard: string;
    safe: string;
  };
  lastBlock?: {
    number: number;
    timestamp: number;
    hash: string;
  };
  
  // Métricas de DeFi
  dexCount: number;
  lendingCount: number;
  totalTvlUSD: number;
  arbitrageOpportunities: number;
  
  // Health metrics
  responseTime?: number;
  uptime?: number;
  errorRate?: number;
}

// Respuesta de estado de redes con métricas agregadas
export interface NetworkStatusResponse {
  networks: NetworkItem[];
  currentNetwork?: NetworkItem;
  totalNetworks: number;
  connectedNetworks: number;
  onlineNetworks: number;
  degradedNetworks: number;
  offlineNetworks: number;
  supportedNetworks: Chain[];
  
  // Métricas agregadas
  totalTvlUSD: number;
  totalDexes: number;
  totalLendingProtocols: number;
  totalArbitrageOpportunities: number;
  
  // Sistema
  averageResponseTime: number;
  averageUptime: number;
  timestamp: string;
  lastUpdate: number;
}

// Configuración de MetaMask para agregar red
export interface AddEthereumChainParameter {
  chainId: string;
  chainName: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorerUrls?: string[];
  iconUrls?: string[];
}

// Provider de Ethereum (MetaMask)
export interface EthereumProvider {
  isMetaMask?: boolean;
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on: (eventName: string, handler: (...args: unknown[]) => void) => void;
  removeListener: (eventName: string, handler: (...args: unknown[]) => void) => void;
  selectedAddress?: string;
  chainId?: string;
}

// Estado de MetaMask mejorado
export interface MetaMaskState {
  isConnected: boolean;
  accounts: string[];
  chainId: number | null;
  address: string | null;
  balance?: string;
  isInstalled: boolean;
  
  // Configuración de redes
  currentNetwork?: Chain;
  installedNetworks: Chain[];
  missingNetworks: NetworkConfig[];
  supportedNetworks: NetworkConfig[];
  
  // Estado de transacciones
  pendingTransactions: Array<{
    hash: string;
    type: string;
    timestamp: number;
  }>;
  
  // Permisos
  permissions: {
    accounts: boolean;
    chainChange: boolean;
    signTransactions: boolean;
  };
}

// Resultado de agregar red
export interface AddNetworkResult {
  success: boolean;
  chainId?: string;
  error?: string;
  alreadyAdded?: boolean;
}
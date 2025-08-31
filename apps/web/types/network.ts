// Interfaces para configuración de redes blockchain

// Configuración de red blockchain
export interface NetworkConfig {
  chainId: string;
  chainName: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: readonly string[];
  blockExplorerUrls: readonly string[];
  iconUrls?: readonly string[];
  wrappedToken?: string;
  color?: string;
  description?: string;
}

// Estado de red detectada
export interface NetworkItem {
  id: string;
  name: string;
  connected: boolean;
  chainId?: string | number;
  isCurrentNetwork?: boolean;
  config?: NetworkConfig;
  
  // Propiedades adicionales para dashboard
  blockNumber?: number;
  rpcStatus?: string;
  gasPrice?: string;
  lastBlock?: string;
}

// Respuesta de estado de redes
export interface NetworkStatusResponse {
  networks: NetworkItem[];
  currentNetwork?: NetworkItem;
  totalNetworks: number;
  connectedNetworks: number;
  supportedNetworks: string[];
  timestamp: string;
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

// Estado de MetaMask
export interface MetaMaskState {
  isConnected: boolean;
  accounts: string[];
  chainId: number | null;
  address: string | null;
  balance?: string;
  isInstalled: boolean;
  installedNetworks: string[];
  missingNetworks: NetworkConfig[];
  supportedNetworks: NetworkConfig[];
}

// Resultado de agregar red
export interface AddNetworkResult {
  success: boolean;
  chainId?: string;
  error?: string;
  alreadyAdded?: boolean;
}
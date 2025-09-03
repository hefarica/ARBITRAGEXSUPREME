# 🎯 PROMPT CONSTRUCTOR FRONTEND ABSOLUTO - ArbitrageX Supreme

## 📋 MISIÓN: CONSTRUIR DASHBOARD FRONTEND COMPLETO

**REPOSITORIO TARGET**: `https://github.com/hefarica/show-my-github-gems.git`  
**BACKEND URL**: `https://arbitragex-supreme-backend.pages.dev`  
**DEPLOYMENT TARGET**: Cloudflare Pages  
**RESULTADO FINAL**: Dashboard funcional en `https://show-my-github-gems.pages.dev`

---

# 🚨 INSTRUCCIONES ABSOLUTAS - EJECUTAR EN ORDEN EXACTO

## PASO 1: PREPARACIÓN DEL REPOSITORIO

### 1.1 Clonar y Limpiar Repositorio
```bash
# Clonar repositorio
git clone https://github.com/hefarica/show-my-github-gems.git
cd show-my-github-gems

# Limpiar contenido existente (IMPORTANTE)
rm -rf * .[^.]*
git add -A
git commit -m "Clean repository for ArbitrageX Supreme dashboard" || echo "Nothing to commit"
```

### 1.2 Inicializar Proyecto Vite React TypeScript
```bash
# Crear proyecto Vite React TypeScript
npm create vite@latest . -- --template react-ts --force

# Instalar dependencias base
npm install

# Instalar dependencias de producción exactas
npm install -D tailwindcss postcss autoprefixer wrangler

# Inicializar Tailwind CSS
npx tailwindcss init -p
```

---

## PASO 2: CONFIGURACIONES OBLIGATORIAS

### 2.1 ARCHIVO: `package.json` (REEMPLAZAR COMPLETAMENTE)
```json
{
  "name": "show-my-github-gems",
  "version": "1.0.0",
  "type": "module",
  "description": "ArbitrageX Supreme - Real-time arbitrage dashboard",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "preview": "vite preview",
    "deploy": "npm run build && wrangler pages deploy dist --project-name show-my-github-gems",
    "test:api": "curl https://arbitragex-supreme-backend.pages.dev/health"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.66",
    "@types/react-dom": "^18.2.22",
    "@typescript-eslint/eslint-plugin": "^7.2.0",
    "@typescript-eslint/parser": "^7.2.0",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.19",
    "eslint": "^8.57.0",
    "eslint-plugin-react-hooks": "^4.6.0",
    "eslint-plugin-react-refresh": "^0.4.6",
    "postcss": "^8.4.38",
    "tailwindcss": "^3.4.3",
    "typescript": "^5.2.2",
    "vite": "^5.2.0",
    "wrangler": "^3.78.0"
  }
}
```

### 2.2 ARCHIVO: `vite.config.ts` (CREAR/REEMPLAZAR)
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  },
  server: {
    port: 5173,
    host: true,
    cors: true
  },
  preview: {
    port: 4173,
    host: true
  }
})
```

### 2.3 ARCHIVO: `tailwind.config.js` (CREAR/REEMPLAZAR)
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      animation: {
        'pulse': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin': 'spin 1s linear infinite',
        'bounce': 'bounce 1s infinite',
        'ping': 'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite'
      },
      colors: {
        'arbitrage': {
          'blue': '#0080ff',
          'green': '#10b981',
          'purple': '#8b5cf6',
          'gold': '#f59e0b'
        }
      },
      fontFamily: {
        'mono': ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace']
      }
    },
  },
  plugins: [],
}
```

### 2.4 ARCHIVO: `tsconfig.json` (CREAR/REEMPLAZAR)
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### 2.5 ARCHIVO: `tsconfig.node.json` (CREAR/REEMPLAZAR)
```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

### 2.6 ARCHIVO: `wrangler.toml` (CREAR)
```toml
name = "show-my-github-gems"
compatibility_date = "2024-01-01"
pages_build_output_dir = "./dist"

[env.production]
name = "show-my-github-gems"
```

### 2.7 ARCHIVO: `index.html` (REEMPLAZAR COMPLETAMENTE)
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⚡</text></svg>" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ArbitrageX Supreme - Live Trading Dashboard</title>
    <meta name="description" content="Real-time arbitrage opportunities across 20+ blockchains - ArbitrageX Supreme Platform" />
    <meta name="keywords" content="arbitrage, crypto, DeFi, trading, blockchain, ethereum, BSC" />
    <meta name="author" content="ArbitrageX Supreme" />
    
    <!-- Open Graph / Facebook -->
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://show-my-github-gems.pages.dev/" />
    <meta property="og:title" content="ArbitrageX Supreme - Live Trading Dashboard" />
    <meta property="og:description" content="Real-time arbitrage opportunities across 20+ blockchains" />
    
    <!-- Twitter -->
    <meta property="twitter:card" content="summary_large_image" />
    <meta property="twitter:url" content="https://show-my-github-gems.pages.dev/" />
    <meta property="twitter:title" content="ArbitrageX Supreme - Live Trading Dashboard" />
    <meta property="twitter:description" content="Real-time arbitrage opportunities across 20+ blockchains" />
    
    <style>
      /* Loading screen styles */
      #loading-screen {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, #1a1a2e, #16213e, #0f3460);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        color: white;
        font-family: system-ui, -apple-system, sans-serif;
      }
      
      .loading-content {
        text-align: center;
      }
      
      .loading-spinner {
        width: 50px;
        height: 50px;
        border: 3px solid rgba(59, 130, 246, 0.3);
        border-top: 3px solid #3b82f6;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 20px;
      }
      
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
      
      .loading-text {
        font-size: 1.25rem;
        font-weight: 600;
        margin-bottom: 8px;
      }
      
      .loading-subtitle {
        font-size: 0.875rem;
        opacity: 0.7;
      }
    </style>
  </head>
  <body>
    <!-- Loading Screen -->
    <div id="loading-screen">
      <div class="loading-content">
        <div class="loading-spinner"></div>
        <div class="loading-text">⚡ ArbitrageX Supreme</div>
        <div class="loading-subtitle">Connecting to backend...</div>
      </div>
    </div>
    
    <!-- React App -->
    <div id="root"></div>
    
    <script type="module" src="/src/main.tsx"></script>
    
    <script>
      // Remove loading screen when React loads
      window.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
          const loadingScreen = document.getElementById('loading-screen');
          if (loadingScreen) {
            loadingScreen.style.opacity = '0';
            loadingScreen.style.transition = 'opacity 0.5s ease-out';
            setTimeout(() => {
              loadingScreen.remove();
            }, 500);
          }
        }, 1000);
      });
      
      // Console branding
      console.log('%c⚡ ArbitrageX Supreme Dashboard', 'color: #3b82f6; font-size: 20px; font-weight: bold;');
      console.log('%c🔗 Backend: https://arbitragex-supreme-backend.pages.dev', 'color: #10b981; font-size: 12px;');
      console.log('%c📊 Frontend: https://show-my-github-gems.pages.dev', 'color: #8b5cf6; font-size: 12px;');
    </script>
  </body>
</html>
```

---

## PASO 3: ESTRUCTURA DE DIRECTORIOS Y ARCHIVOS

### 3.1 Crear Estructura de Directorios
```bash
# Crear estructura de carpetas
mkdir -p src/config
mkdir -p src/types
mkdir -p src/services
mkdir -p src/hooks
mkdir -p src/components
mkdir -p src/utils
mkdir -p src/constants
```

---

## PASO 4: ARCHIVOS DE CONFIGURACIÓN Y TIPOS

### 4.1 ARCHIVO: `src/config/api.ts` (CREAR)
```typescript
// ⚡ ArbitrageX Supreme - API Configuration
// CRITICAL: DO NOT MODIFY BACKEND URL

export const API_CONFIG = {
  // 🚨 PRODUCTION BACKEND URL - DO NOT CHANGE
  BASE_URL: "https://arbitragex-supreme-backend.pages.dev",
  
  // API Endpoints (exact paths)
  ENDPOINTS: {
    HEALTH: "/health",
    NETWORK_STATUS: "/api/v2/arbitrage/network-status",
    OPPORTUNITIES: "/api/v2/arbitrage/opportunities", 
    DASHBOARD_SUMMARY: "/api/v2/arbitrage/dashboard/summary"
  },
  
  // Request Configuration
  HEADERS: {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "X-Client": "show-my-github-gems",
    "Cache-Control": "no-cache"
  },
  
  // Timing Configuration
  TIMEOUT: 15000,              // 15 seconds timeout
  RETRY_ATTEMPTS: 3,           // 3 retry attempts
  RETRY_DELAY: 1000,          // 1 second between retries
  AUTO_REFRESH_INTERVAL: 8000, // 8 seconds auto-refresh
  FULL_REFRESH_INTERVAL: 30000, // 30 seconds full refresh
  
  // UI Configuration  
  MAX_OPPORTUNITIES_DISPLAY: 15,
  DEFAULT_OPPORTUNITY_LIMIT: 20,
  ANIMATION_DURATION: 300
} as const;

// Environment info
export const ENV_INFO = {
  NODE_ENV: import.meta.env.MODE,
  IS_DEV: import.meta.env.DEV,
  IS_PROD: import.meta.env.PROD,
  BASE_URL: import.meta.env.BASE_URL || '/',
  APP_VERSION: '1.0.0'
} as const;

// Console logging for debugging
console.log('🔗 ArbitrageX Supreme API Config Loaded');
console.log('📍 Backend URL:', API_CONFIG.BASE_URL);
console.log('🌐 Environment:', ENV_INFO.NODE_ENV);
console.log('⚡ Auto-refresh interval:', API_CONFIG.AUTO_REFRESH_INTERVAL / 1000, 'seconds');

export default API_CONFIG;
```

### 4.2 ARCHIVO: `src/types/arbitrage.ts` (CREAR)
```typescript
// 📊 ArbitrageX Supreme - TypeScript Interfaces
// CRITICAL: These interfaces MUST match backend API exactly

// Network Status Types
export interface NetworkStatus {
  [key: string]: {
    status: "online" | "degraded" | "offline";
    latency: number;
  };
}

// Arbitrage Opportunity Types  
export interface ArbitrageOpportunity {
  id: string;
  strategy: "triangular_arbitrage" | "cross_dex" | "flash_loan" | "cross_chain";
  blockchain_from: string;
  blockchain_to: string;
  token_in: string;
  token_out: string;
  amount_in: number;
  expected_amount_out: number;
  profit_amount: number;
  profit_percentage: number;
  confidence_score: number; // 0.0 to 1.0
  gas_estimate: string;
  expires_at: string; // ISO timestamp
  dex_path: string[];
  created_at: string; // ISO timestamp
}

// Execution Result Types
export interface ExecutionResult {
  id: string;
  opportunityId: string;
  status: "SUCCESS" | "FAILED" | "PENDING";
  actualProfitUsd: number;
  actualProfitPercentage: number;
  executionTimeMs: number;
  gasUsed: string;
  gasPriceGwei: string;
  totalGasCost: string;
  slippageActual: number;
  transactionHash: string;
  executedAt: string; // ISO timestamp
  completedAt: string; // ISO timestamp
}

// Dashboard Summary Types
export interface DashboardSummary {
  totalOpportunities: number;
  totalProfitUsd: number;
  successfulExecutions: number;
  averageProfitPercentage: number;
  activeBlockchains: number;
  topPerformingChain: string;
  recentExecutions: ExecutionResult[];
  profitByChain: Record<string, number>;
  executionsByHour: Array<{
    hour: string;
    executions: number;
    profit: number;
  }>;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Health Check Response
export interface HealthResponse {
  status: string;
  service: string;
  version: string;
  uptime: number;
  timestamp: string;
  environment: string;
  endpoints: string[];
}

// Network Status Response  
export interface NetworkStatusResponse {
  success: boolean;
  network_status: NetworkStatus;
  supported_blockchains: string[];
  active_networks: number;
  timestamp: string;
}

// Opportunities Response
export interface OpportunitiesResponse {
  success: boolean;
  opportunities: ArbitrageOpportunity[];
  total: number;
  total_available: number;
  filters_applied: Record<string, any>;
  scan_timestamp: string;
}

// Dashboard Summary Response
export interface DashboardSummaryResponse {
  success: boolean;
  summary: DashboardSummary;
  lastUpdated: string;
}

// Filter Types
export interface OpportunityFilters {
  chains?: string[];
  minProfit?: number;
  strategy?: ArbitrageOpportunity['strategy'];
  limit?: number;
}

// Hook State Types
export interface ConnectionState {
  isConnected: boolean;
  isLoading: boolean;
  lastUpdate: string | null;
  errors: {
    health?: string;
    network?: string;
    opportunities?: string;
    dashboard?: string;
  };
}

// UI Component Props
export interface OpportunityCardProps {
  opportunity: ArbitrageOpportunity;
  onExecute?: (opportunityId: string) => void;
}

export interface NetworkGridProps {
  networkStatus: NetworkStatus | null;
  isLoading?: boolean;
}

export interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: string;
  color?: 'green' | 'blue' | 'purple' | 'yellow' | 'red';
  loading?: boolean;
}

// Utility Types
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';
export type RefreshType = 'opportunities' | 'full' | 'network' | 'dashboard';

// Error Types
export interface ApiError {
  message: string;
  status?: number;
  endpoint?: string;
  timestamp: string;
}

// Constants
export const SUPPORTED_STRATEGIES = [
  'triangular_arbitrage',
  'cross_dex', 
  'flash_loan',
  'cross_chain'
] as const;

export const BLOCKCHAIN_COLORS: Record<string, string> = {
  ethereum: '#627EEA',
  bsc: '#F3BA2F',
  polygon: '#8247E5',
  arbitrum: '#28A0F0',
  optimism: '#FF0420',
  avalanche: '#E84142',
  base: '#0052FF',
  fantom: '#1969FF',
  gnosis: '#04795B',
  celo: '#35D07F'
};

export const STATUS_COLORS: Record<NetworkStatus[string]['status'], string> = {
  online: '#10B981',
  degraded: '#F59E0B',
  offline: '#EF4444'
};

export default {
  NetworkStatus,
  ArbitrageOpportunity,
  ExecutionResult,
  DashboardSummary,
  ApiResponse,
  SUPPORTED_STRATEGIES,
  BLOCKCHAIN_COLORS,
  STATUS_COLORS
};
```

### 4.3 ARCHIVO: `src/constants/index.ts` (CREAR)
```typescript
// 🎯 ArbitrageX Supreme - Application Constants

export const APP_CONSTANTS = {
  APP_NAME: 'ArbitrageX Supreme',
  APP_VERSION: '1.0.0',
  APP_DESCRIPTION: 'Real-time arbitrage opportunities across 20+ blockchains',
  
  // URLs
  BACKEND_URL: 'https://arbitragex-supreme-backend.pages.dev',
  FRONTEND_URL: 'https://show-my-github-gems.pages.dev',
  GITHUB_URL: 'https://github.com/hefarica/show-my-github-gems',
  
  // Timing
  REFRESH_INTERVALS: {
    OPPORTUNITIES: 8000,  // 8 seconds
    FULL_DATA: 30000,    // 30 seconds
    HEALTH_CHECK: 60000, // 1 minute
  },
  
  // Limits
  MAX_OPPORTUNITIES: 50,
  MAX_RETRIES: 3,
  REQUEST_TIMEOUT: 15000,
  
  // UI
  ANIMATION_DURATION: 300,
  TOAST_DURATION: 5000,
  
  // Blockchain Networks
  SUPPORTED_NETWORKS: [
    'ethereum', 'bsc', 'polygon', 'arbitrum', 'optimism',
    'avalanche', 'base', 'fantom', 'gnosis', 'celo',
    'moonbeam', 'cronos', 'aurora', 'harmony', 'kava',
    'metis', 'evmos', 'oasis', 'milkomeda', 'telos'
  ],
  
  // Strategy Types
  STRATEGY_TYPES: [
    'triangular_arbitrage',
    'cross_dex',
    'flash_loan', 
    'cross_chain'
  ]
} as const;

export const UI_MESSAGES = {
  LOADING: {
    CONNECTING: 'Connecting to ArbitrageX Supreme...',
    FETCHING_DATA: 'Fetching arbitrage opportunities...',
    UPDATING: 'Updating data...',
    RETRYING: 'Retrying connection...'
  },
  
  ERROR: {
    CONNECTION_FAILED: 'Failed to connect to backend',
    NO_OPPORTUNITIES: 'No arbitrage opportunities found',
    API_ERROR: 'API request failed',
    NETWORK_ERROR: 'Network error occurred'
  },
  
  SUCCESS: {
    CONNECTED: 'Connected to backend successfully',
    DATA_UPDATED: 'Data updated successfully',
    OPPORTUNITY_EXECUTED: 'Arbitrage opportunity executed'
  }
} as const;

export const THEME = {
  COLORS: {
    PRIMARY: '#3B82F6',    // Blue
    SUCCESS: '#10B981',    // Green
    WARNING: '#F59E0B',    // Yellow
    DANGER: '#EF4444',     // Red
    PURPLE: '#8B5CF6',     // Purple
    GOLD: '#F59E0B',       // Gold
    
    // Gradients
    BACKGROUND: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
    CARD: 'rgba(255, 255, 255, 0.1)',
    BORDER: 'rgba(255, 255, 255, 0.2)'
  },
  
  ANIMATIONS: {
    FADE_IN: 'fadeIn 0.3s ease-out',
    SLIDE_UP: 'slideUp 0.3s ease-out',
    PULSE: 'pulse 2s infinite',
    SPIN: 'spin 1s linear infinite'
  }
} as const;

export default {
  APP_CONSTANTS,
  UI_MESSAGES,
  THEME
};
```

---

## PASO 5: SERVICIOS Y UTILIDADES

### 5.1 ARCHIVO: `src/utils/helpers.ts` (CREAR)
```typescript
// 🛠️ ArbitrageX Supreme - Utility Functions

import { ApiError } from '../types/arbitrage';

/**
 * Format currency value to USD string
 */
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
};

/**
 * Format percentage value
 */
export const formatPercentage = (value: number, decimals: number = 2): string => {
  return `${value.toFixed(decimals)}%`;
};

/**
 * Format large numbers with K, M, B suffixes
 */
export const formatLargeNumber = (value: number): string => {
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toString();
};

/**
 * Format timestamp to readable time
 */
export const formatTime = (timestamp: string): string => {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

/**
 * Format timestamp to relative time (e.g., "2 minutes ago")
 */
export const formatRelativeTime = (timestamp: string): string => {
  const now = new Date().getTime();
  const time = new Date(timestamp).getTime();
  const diff = Math.floor((now - time) / 1000);

  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

/**
 * Capitalize first letter of string
 */
export const capitalize = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

/**
 * Convert strategy name to readable format
 */
export const formatStrategy = (strategy: string): string => {
  return strategy
    .split('_')
    .map(word => capitalize(word))
    .join(' ');
};

/**
 * Get blockchain display name and emoji
 */
export const getBlockchainInfo = (chain: string): { name: string; emoji: string } => {
  const chainMap: Record<string, { name: string; emoji: string }> = {
    ethereum: { name: 'Ethereum', emoji: '⟠' },
    bsc: { name: 'BSC', emoji: '🟨' },
    polygon: { name: 'Polygon', emoji: '🟣' },
    arbitrum: { name: 'Arbitrum', emoji: '🔵' },
    optimism: { name: 'Optimism', emoji: '🔴' },
    avalanche: { name: 'Avalanche', emoji: '🔺' },
    base: { name: 'Base', emoji: '🔷' },
    fantom: { name: 'Fantom', emoji: '👻' },
    gnosis: { name: 'Gnosis', emoji: '🟢' },
    celo: { name: 'Celo', emoji: '💚' }
  };
  
  return chainMap[chain] || { name: capitalize(chain), emoji: '🔗' };
};

/**
 * Get status color class for Tailwind CSS
 */
export const getStatusColor = (status: 'online' | 'degraded' | 'offline'): string => {
  const colorMap = {
    online: 'bg-green-400',
    degraded: 'bg-yellow-400', 
    offline: 'bg-red-400'
  };
  return colorMap[status];
};

/**
 * Get confidence score color
 */
export const getConfidenceColor = (score: number): string => {
  if (score >= 0.8) return 'text-green-400';
  if (score >= 0.6) return 'text-yellow-400';
  return 'text-red-400';
};

/**
 * Calculate profit color based on percentage
 */
export const getProfitColor = (percentage: number): string => {
  if (percentage >= 3) return 'text-green-300';
  if (percentage >= 2) return 'text-green-400';
  if (percentage >= 1) return 'text-green-500';
  return 'text-yellow-400';
};

/**
 * Truncate ethereum address for display
 */
export const truncateAddress = (address: string): string => {
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

/**
 * Sleep utility for delays
 */
export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Create API error object
 */
export const createApiError = (message: string, status?: number, endpoint?: string): ApiError => {
  return {
    message,
    status,
    endpoint,
    timestamp: new Date().toISOString()
  };
};

/**
 * Check if timestamp is expired
 */
export const isExpired = (timestamp: string): boolean => {
  return new Date(timestamp).getTime() < Date.now();
};

/**
 * Sort opportunities by profit percentage (descending)
 */
export const sortOpportunitiesByProfit = (opportunities: any[]): any[] => {
  return [...opportunities].sort((a, b) => b.profit_percentage - a.profit_percentage);
};

/**
 * Filter opportunities by minimum profit
 */
export const filterByMinProfit = (opportunities: any[], minProfit: number): any[] => {
  return opportunities.filter(opp => opp.profit_percentage >= minProfit);
};

/**
 * Generate random ID for tracking
 */
export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Debounce function for API calls
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

/**
 * Safe JSON parse with fallback
 */
export const safeJsonParse = <T>(str: string, fallback: T): T => {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
};

/**
 * Copy text to clipboard
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    return true;
  }
};

export default {
  formatCurrency,
  formatPercentage,
  formatLargeNumber,
  formatTime,
  formatRelativeTime,
  capitalize,
  formatStrategy,
  getBlockchainInfo,
  getStatusColor,
  getConfidenceColor,
  getProfitColor,
  truncateAddress,
  sleep,
  createApiError,
  isExpired,
  sortOpportunitiesByProfit,
  filterByMinProfit,
  generateId,
  debounce,
  safeJsonParse,
  copyToClipboard
};
```

### 5.2 ARCHIVO: `src/services/arbitrageAPI.ts` (CREAR)
```typescript
// 🌐 ArbitrageX Supreme - API Client Service
// CRITICAL: Complete API client with error handling and retry logic

import { API_CONFIG } from '../config/api';
import { createApiError, sleep } from '../utils/helpers';
import type { 
  NetworkStatus, 
  ArbitrageOpportunity, 
  DashboardSummary, 
  ExecutionResult,
  ApiResponse,
  HealthResponse,
  NetworkStatusResponse,
  OpportunitiesResponse,
  DashboardSummaryResponse,
  OpportunityFilters
} from '../types/arbitrage';

export class ArbitrageAPI {
  private baseUrl = API_CONFIG.BASE_URL;
  private requestQueue = new Map<string, Promise<any>>();

  constructor() {
    console.log('🚀 ArbitrageAPI initialized');
    console.log('📍 Backend URL:', this.baseUrl);
  }

  /**
   * Generic fetch with retry logic and error handling
   */
  private async fetchWithRetry<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;
    const requestKey = `${options.method || 'GET'}-${endpoint}`;
    
    // Prevent duplicate requests
    if (this.requestQueue.has(requestKey)) {
      console.log(`🔄 Using cached request for ${requestKey}`);
      return this.requestQueue.get(requestKey);
    }
    
    const config: RequestInit = {
      ...options,
      mode: 'cors',
      credentials: 'omit',
      headers: {
        ...API_CONFIG.HEADERS,
        ...options.headers,
      },
    };

    console.log(`🌐 API Request: ${config.method || 'GET'} ${url}`);

    const requestPromise = this.executeRequest<T>(url, config, endpoint);
    this.requestQueue.set(requestKey, requestPromise);
    
    // Clean up request queue after completion
    requestPromise.finally(() => {
      this.requestQueue.delete(requestKey);
    });
    
    return requestPromise;
  }

  /**
   * Execute HTTP request with retry logic
   */
  private async executeRequest<T>(
    url: string,
    config: RequestInit,
    endpoint: string
  ): Promise<ApiResponse<T>> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= API_CONFIG.RETRY_ATTEMPTS; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);
        
        const response = await fetch(url, {
          ...config,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          throw new Error('Response is not valid JSON');
        }

        const data = await response.json();
        console.log(`✅ API Success (attempt ${attempt}): ${endpoint}`);
        
        return { success: true, data };
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.error(`❌ API Attempt ${attempt} failed for ${endpoint}:`, lastError.message);
        
        if (attempt === API_CONFIG.RETRY_ATTEMPTS) {
          break;
        }
        
        // Exponential backoff
        const delay = API_CONFIG.RETRY_DELAY * Math.pow(2, attempt - 1);
        console.log(`⏳ Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }

    const apiError = createApiError(
      lastError?.message || 'Request failed',
      undefined,
      endpoint
    );

    return {
      success: false,
      error: apiError.message
    };
  }

  // 🏥 Health Check - ENDPOINT EXACTO
  async getHealth(): Promise<ApiResponse<HealthResponse>> {
    return this.fetchWithRetry<HealthResponse>(API_CONFIG.ENDPOINTS.HEALTH);
  }

  // 🌐 Network Status - ENDPOINT EXACTO  
  async getNetworkStatus(): Promise<ApiResponse<NetworkStatusResponse>> {
    return this.fetchWithRetry<NetworkStatusResponse>(API_CONFIG.ENDPOINTS.NETWORK_STATUS);
  }

  // 💰 Arbitrage Opportunities - ENDPOINT EXACTO CON FILTROS
  async getOpportunities(params?: OpportunityFilters): Promise<ApiResponse<OpportunitiesResponse>> {
    const searchParams = new URLSearchParams();
    
    if (params?.chains?.length) {
      searchParams.append('chains', params.chains.join(','));
    }
    if (params?.minProfit !== undefined) {
      searchParams.append('minProfit', params.minProfit.toString());
    }
    if (params?.strategy) {
      searchParams.append('strategy', params.strategy);
    }
    if (params?.limit) {
      searchParams.append('limit', params.limit.toString());
    }

    const queryString = searchParams.toString();
    const endpoint = `${API_CONFIG.ENDPOINTS.OPPORTUNITIES}${queryString ? `?${queryString}` : ''}`;
    
    return this.fetchWithRetry<OpportunitiesResponse>(endpoint);
  }

  // 📊 Dashboard Summary - ENDPOINT EXACTO
  async getDashboardSummary(): Promise<ApiResponse<DashboardSummaryResponse>> {
    return this.fetchWithRetry<DashboardSummaryResponse>(API_CONFIG.ENDPOINTS.DASHBOARD_SUMMARY);
  }

  /**
   * Test all endpoints connectivity
   */
  async testConnectivity(): Promise<{
    health: boolean;
    network: boolean;
    opportunities: boolean;
    dashboard: boolean;
    overall: boolean;
  }> {
    console.log('🧪 Testing API connectivity...');
    
    const results = await Promise.allSettled([
      this.getHealth(),
      this.getNetworkStatus(),
      this.getOpportunities({ limit: 1 }),
      this.getDashboardSummary()
    ]);

    const connectivity = {
      health: results[0].status === 'fulfilled' && results[0].value.success,
      network: results[1].status === 'fulfilled' && results[1].value.success,
      opportunities: results[2].status === 'fulfilled' && results[2].value.success,
      dashboard: results[3].status === 'fulfilled' && results[3].value.success,
      overall: false
    };

    connectivity.overall = Object.values(connectivity).slice(0, 4).every(Boolean);
    
    console.log('📊 Connectivity test results:', connectivity);
    return connectivity;
  }

  /**
   * Get backend status summary
   */
  async getBackendStatus(): Promise<{
    isOnline: boolean;
    version?: string;
    uptime?: number;
    lastCheck: string;
  }> {
    const healthResponse = await this.getHealth();
    
    return {
      isOnline: healthResponse.success,
      version: healthResponse.data?.version,
      uptime: healthResponse.data?.uptime,
      lastCheck: new Date().toISOString()
    };
  }

  /**
   * Clear request cache
   */
  clearCache(): void {
    this.requestQueue.clear();
    console.log('🧹 Request cache cleared');
  }
}

// ⚡ SINGLETON INSTANCE - USE THIS INSTANCE ONLY
export const arbitrageAPI = new ArbitrageAPI();
export default arbitrageAPI;
```

---

## PASO 6: HOOKS DE REACT

### 6.1 ARCHIVO: `src/hooks/useArbitrageData.ts` (CREAR)
```typescript
// 🔄 ArbitrageX Supreme - Main Data Hook
// CRITICAL: This hook manages all real-time data and state

import { useState, useEffect, useCallback, useRef } from 'react';
import { arbitrageAPI } from '../services/arbitrageAPI';
import { API_CONFIG } from '../config/api';
import { sortOpportunitiesByProfit } from '../utils/helpers';
import type { 
  ArbitrageOpportunity, 
  DashboardSummary, 
  NetworkStatus,
  HealthResponse,
  ConnectionState,
  RefreshType
} from '../types/arbitrage';

export interface ArbitrageData {
  // Data States
  health: HealthResponse | null;
  networkStatus: NetworkStatus | null;
  opportunities: ArbitrageOpportunity[];
  dashboardSummary: DashboardSummary | null;
  
  // Connection States
  isLoading: boolean;
  isConnected: boolean;
  lastUpdate: string | null;
  
  // Error States
  errors: {
    health?: string;
    network?: string;
    opportunities?: string;
    dashboard?: string;
  };
  
  // Control Functions
  refetchAll: () => Promise<void>;
  refetchOpportunities: () => Promise<void>;
  refetchNetworkStatus: () => Promise<void>;
  refetchDashboard: () => Promise<void>;
  clearErrors: () => void;
  
  // Stats
  stats: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    lastSuccessTime: string | null;
  };
}

export const useArbitrageData = (): ArbitrageData => {
  // Main Data States
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus | null>(null);
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);
  
  // Connection States
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  
  // Error States
  const [errors, setErrors] = useState<ConnectionState['errors']>({});
  
  // Statistics
  const [stats, setStats] = useState({
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    lastSuccessTime: null as string | null
  });
  
  // Refs for interval management
  const opportunitiesIntervalRef = useRef<NodeJS.Timeout>();
  const fullRefreshIntervalRef = useRef<NodeJS.Timeout>();
  const isInitializedRef = useRef(false);
  
  // Update stats helper
  const updateStats = useCallback((success: boolean) => {
    setStats(prev => ({
      ...prev,
      totalRequests: prev.totalRequests + 1,
      successfulRequests: prev.successfulRequests + (success ? 1 : 0),
      failedRequests: prev.failedRequests + (success ? 0 : 1),
      lastSuccessTime: success ? new Date().toISOString() : prev.lastSuccessTime
    }));
  }, []);

  // 🏥 Fetch Health Check
  const fetchHealth = useCallback(async () => {
    console.log('🏥 Fetching health check...');
    const response = await arbitrageAPI.getHealth();
    
    if (response.success && response.data) {
      setHealth(response.data);
      setIsConnected(true);
      setErrors(prev => ({ ...prev, health: undefined }));
      updateStats(true);
      console.log('✅ Health check successful:', response.data.version);
    } else {
      setErrors(prev => ({ ...prev, health: response.error }));
      setIsConnected(false);
      updateStats(false);
      console.error('❌ Health check failed:', response.error);
    }
  }, [updateStats]);

  // 🌐 Fetch Network Status  
  const fetchNetworkStatus = useCallback(async () => {
    console.log('🌐 Fetching network status...');
    const response = await arbitrageAPI.getNetworkStatus();
    
    if (response.success && response.data) {
      setNetworkStatus(response.data.network_status);
      setErrors(prev => ({ ...prev, network: undefined }));
      updateStats(true);
      console.log('✅ Network status updated:', Object.keys(response.data.network_status).length, 'networks');
    } else {
      setErrors(prev => ({ ...prev, network: response.error }));
      updateStats(false);
      console.error('❌ Network status failed:', response.error);
    }
  }, [updateStats]);

  // 💰 Fetch Opportunities
  const fetchOpportunities = useCallback(async () => {
    console.log('💰 Fetching arbitrage opportunities...');
    const response = await arbitrageAPI.getOpportunities({ 
      limit: API_CONFIG.DEFAULT_OPPORTUNITY_LIMIT 
    });
    
    if (response.success && response.data) {
      const sortedOpportunities = sortOpportunitiesByProfit(response.data.opportunities || []);
      setOpportunities(sortedOpportunities);
      setErrors(prev => ({ ...prev, opportunities: undefined }));
      updateStats(true);
      console.log('✅ Opportunities updated:', sortedOpportunities.length, 'found');
    } else {
      setErrors(prev => ({ ...prev, opportunities: response.error }));
      updateStats(false);
      console.error('❌ Opportunities failed:', response.error);
    }
  }, [updateStats]);

  // 📊 Fetch Dashboard Summary
  const fetchDashboardSummary = useCallback(async () => {
    console.log('📊 Fetching dashboard summary...');
    const response = await arbitrageAPI.getDashboardSummary();
    
    if (response.success && response.data) {
      setDashboardSummary(response.data.summary);
      setErrors(prev => ({ ...prev, dashboard: undefined }));
      updateStats(true);
      console.log('✅ Dashboard updated:', response.data.summary.totalOpportunities, 'total opportunities');
    } else {
      setErrors(prev => ({ ...prev, dashboard: response.error }));
      updateStats(false);
      console.error('❌ Dashboard failed:', response.error);
    }
  }, [updateStats]);

  // 🔄 Refetch All Data
  const refetchAll = useCallback(async () => {
    setIsLoading(true);
    console.log('🔄 Full refresh started...');
    
    const startTime = performance.now();
    
    await Promise.allSettled([
      fetchHealth(),
      fetchNetworkStatus(),
      fetchOpportunities(), 
      fetchDashboardSummary()
    ]);
    
    const endTime = performance.now();
    const duration = Math.round(endTime - startTime);
    
    setLastUpdate(new Date().toISOString());
    setIsLoading(false);
    
    console.log(`✅ Full refresh completed in ${duration}ms`);
  }, [fetchHealth, fetchNetworkStatus, fetchOpportunities, fetchDashboardSummary]);

  // 💰 Refetch Only Opportunities
  const refetchOpportunities = useCallback(async () => {
    console.log('🔄 Refreshing opportunities only...');
    await fetchOpportunities();
    setLastUpdate(new Date().toISOString());
  }, [fetchOpportunities]);

  // 🌐 Refetch Only Network Status
  const refetchNetworkStatus = useCallback(async () => {
    console.log('🔄 Refreshing network status only...');
    await fetchNetworkStatus();
    setLastUpdate(new Date().toISOString());
  }, [fetchNetworkStatus]);

  // 📊 Refetch Only Dashboard
  const refetchDashboard = useCallback(async () => {
    console.log('🔄 Refreshing dashboard only...');
    await fetchDashboardSummary();
    setLastUpdate(new Date().toISOString());
  }, [fetchDashboardSummary]);

  // Clear all errors
  const clearErrors = useCallback(() => {
    setErrors({});
    console.log('🧹 All errors cleared');
  }, []);

  // 🚀 Initial Load Effect
  useEffect(() => {
    if (!isInitializedRef.current) {
      console.log('🚀 Initializing ArbitrageX Supreme data...');
      isInitializedRef.current = true;
      refetchAll();
    }
  }, [refetchAll]);

  // ⏰ Auto-refresh Opportunities (every 8 seconds)
  useEffect(() => {
    if (isConnected) {
      console.log('⏰ Starting opportunities auto-refresh (8s interval)');
      opportunitiesIntervalRef.current = setInterval(() => {
        if (!isLoading) {
          refetchOpportunities();
        }
      }, API_CONFIG.AUTO_REFRESH_INTERVAL);

      return () => {
        if (opportunitiesIntervalRef.current) {
          clearInterval(opportunitiesIntervalRef.current);
          console.log('⏹️ Stopped opportunities auto-refresh');
        }
      };
    }
  }, [isConnected, isLoading, refetchOpportunities]);

  // 📊 Full refresh (every 30 seconds)  
  useEffect(() => {
    if (isConnected) {
      console.log('📊 Starting full data auto-refresh (30s interval)');
      fullRefreshIntervalRef.current = setInterval(() => {
        if (!isLoading) {
          refetchAll();
        }
      }, API_CONFIG.FULL_REFRESH_INTERVAL);

      return () => {
        if (fullRefreshIntervalRef.current) {
          clearInterval(fullRefreshIntervalRef.current);
          console.log('⏹️ Stopped full auto-refresh');
        }
      };
    }
  }, [isConnected, isLoading, refetchAll]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (opportunitiesIntervalRef.current) {
        clearInterval(opportunitiesIntervalRef.current);
      }
      if (fullRefreshIntervalRef.current) {
        clearInterval(fullRefreshIntervalRef.current);
      }
      arbitrageAPI.clearCache();
    };
  }, []);

  return {
    // Data states
    health,
    networkStatus,
    opportunities,
    dashboardSummary,
    
    // Connection states
    isLoading,
    isConnected,
    lastUpdate,
    errors,
    
    // Control functions
    refetchAll,
    refetchOpportunities,
    refetchNetworkStatus,
    refetchDashboard,
    clearErrors,
    
    // Stats
    stats
  };
};

export default useArbitrageData;
```

---

## PASO 7: COMPONENTES DE UI

### 7.1 ARCHIVO: `src/components/LoadingScreen.tsx` (CREAR)
```typescript
import React from 'react';

interface LoadingScreenProps {
  message?: string;
  subtitle?: string;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ 
  message = "Connecting to ArbitrageX Supreme...",
  subtitle = "Loading real-time data..."
}) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex items-center justify-center">
      <div className="text-center text-white">
        {/* Loading Spinner */}
        <div className="relative mb-8">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-400 mx-auto"></div>
          <div className="absolute inset-0 animate-ping rounded-full h-16 w-16 border border-blue-400 mx-auto opacity-20"></div>
        </div>
        
        {/* Loading Text */}
        <h2 className="text-2xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
          ⚡ {message}
        </h2>
        
        <p className="text-gray-400 mb-4">{subtitle}</p>
        
        {/* Backend URL */}
        <p className="text-xs text-gray-500 font-mono">
          Backend: https://arbitragex-supreme-backend.pages.dev
        </p>
        
        {/* Loading Dots */}
        <div className="flex justify-center space-x-1 mt-4">
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;
```

### 7.2 ARQUIVO: `src/components/ErrorBoundary.tsx` (CREAR)
```typescript
import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🚨 ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-900 to-purple-900 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-red-400/20">
            <div className="text-center">
              <div className="text-6xl mb-4">💥</div>
              <h2 className="text-2xl font-bold text-white mb-4">
                Oops! Something went wrong
              </h2>
              <p className="text-gray-300 mb-6">
                ArbitrageX Supreme encountered an unexpected error. Please refresh the page to try again.
              </p>
              
              {/* Error Details (Development) */}
              {import.meta.env.DEV && this.state.error && (
                <details className="mb-6 text-left">
                  <summary className="cursor-pointer text-red-300 text-sm mb-2">
                    View Error Details
                  </summary>
                  <pre className="text-xs text-gray-400 bg-black/20 p-3 rounded overflow-auto max-h-32">
                    {this.state.error.toString()}
                  </pre>
                </details>
              )}
              
              <div className="space-y-3">
                <button
                  onClick={() => window.location.reload()}
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  🔄 Refresh Page
                </button>
                
                <button
                  onClick={() => this.setState({ hasError: false, error: undefined, errorInfo: undefined })}
                  className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
                >
                  ↩️ Try Again
                </button>
              </div>
              
              <p className="text-xs text-gray-500 mt-4">
                If the problem persists, please contact support.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
```

### 7.3 ARCHIVO: `src/components/StatsCard.tsx` (CREAR)
```typescript
import React from 'react';
import { formatCurrency, formatPercentage, formatLargeNumber } from '../utils/helpers';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: string;
  color?: 'green' | 'blue' | 'purple' | 'yellow' | 'red' | 'gray';
  loading?: boolean;
  trend?: 'up' | 'down' | 'neutral';
  onClick?: () => void;
}

const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  color = 'blue',
  loading = false,
  trend,
  onClick
}) => {
  const colorClasses = {
    green: 'text-green-400 border-green-400/30 bg-green-400/5',
    blue: 'text-blue-400 border-blue-400/30 bg-blue-400/5',
    purple: 'text-purple-400 border-purple-400/30 bg-purple-400/5',
    yellow: 'text-yellow-400 border-yellow-400/30 bg-yellow-400/5',
    red: 'text-red-400 border-red-400/30 bg-red-400/5',
    gray: 'text-gray-400 border-gray-400/30 bg-gray-400/5'
  };

  const trendIcons = {
    up: '📈',
    down: '📉',
    neutral: '➡️'
  };

  const formatValue = (val: string | number): string => {
    if (typeof val === 'string') return val;
    if (val >= 1000000) return formatLargeNumber(val);
    if (val < 1 && val > 0) return formatPercentage(val * 100, 2);
    return val.toLocaleString();
  };

  return (
    <div 
      className={`
        bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20
        ${onClick ? 'cursor-pointer hover:border-white/40 transition-all duration-200 hover:scale-105' : ''}
        ${loading ? 'animate-pulse' : ''}
        ${colorClasses[color]}
      `}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-gray-400 text-sm uppercase tracking-wide font-medium">
          {title}
        </h3>
        {icon && (
          <span className="text-2xl opacity-60">{icon}</span>
        )}
      </div>

      {/* Main Value */}
      <div className="mb-2">
        {loading ? (
          <div className="h-8 bg-white/20 rounded animate-pulse"></div>
        ) : (
          <p className={`text-3xl font-bold ${colorClasses[color].split(' ')[0]}`}>
            {formatValue(value)}
          </p>
        )}
      </div>

      {/* Subtitle with trend */}
      {subtitle && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-400">
            {subtitle}
          </p>
          {trend && (
            <span className="text-xs opacity-60">
              {trendIcons[trend]}
            </span>
          )}
        </div>
      )}

      {/* Loading indicator */}
      {loading && (
        <div className="absolute top-2 right-2">
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-ping"></div>
        </div>
      )}
    </div>
  );
};

export default StatsCard;
```

### 7.4 ARCHIVO: `src/components/NetworkGrid.tsx` (CREAR)
```typescript
import React from 'react';
import { getBlockchainInfo, getStatusColor } from '../utils/helpers';
import type { NetworkStatus } from '../types/arbitrage';

interface NetworkGridProps {
  networkStatus: NetworkStatus | null;
  isLoading?: boolean;
}

const NetworkGrid: React.FC<NetworkGridProps> = ({ networkStatus, isLoading = false }) => {
  if (!networkStatus && !isLoading) {
    return (
      <div className="bg-white/10 backdrop-blur-sm rounded-lg p-8 border border-white/20 text-center">
        <p className="text-gray-400">No network data available</p>
      </div>
    );
  }

  const networks = networkStatus ? Object.entries(networkStatus) : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">🌐 Network Status</h2>
        <div className="text-sm text-gray-400">
          {networks.length} networks monitored
        </div>
      </div>

      {/* Network Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {isLoading ? (
          // Loading skeletons
          Array.from({ length: 10 }).map((_, index) => (
            <div 
              key={index}
              className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20 animate-pulse"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="h-4 bg-white/20 rounded w-16"></div>
                <div className="w-2 h-2 bg-white/20 rounded-full"></div>
              </div>
              <div className="h-3 bg-white/20 rounded w-12"></div>
            </div>
          ))
        ) : (
          networks.map(([chain, status]) => {
            const chainInfo = getBlockchainInfo(chain);
            const statusColor = getStatusColor(status.status);

            return (
              <div 
                key={chain}
                className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20 hover:border-white/40 transition-all duration-200 group"
              >
                {/* Chain Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{chainInfo.emoji}</span>
                    <span className="text-sm font-medium text-white uppercase tracking-wide">
                      {chainInfo.name}
                    </span>
                  </div>
                  <div className={`w-2 h-2 rounded-full ${statusColor} animate-pulse`}></div>
                </div>

                {/* Latency */}
                <div className="space-y-1">
                  <p className="text-xs text-gray-400">Latency</p>
                  <p className={`text-sm font-semibold ${
                    status.latency < 100 ? 'text-green-400' :
                    status.latency < 200 ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {status.latency}ms
                  </p>
                </div>

                {/* Status indicator */}
                <div className="mt-2">
                  <span className={`
                    text-xs px-2 py-1 rounded-full font-medium uppercase tracking-wide
                    ${status.status === 'online' ? 'bg-green-400/20 text-green-300' :
                      status.status === 'degraded' ? 'bg-yellow-400/20 text-yellow-300' :
                      'bg-red-400/20 text-red-300'}
                  `}>
                    {status.status}
                  </span>
                </div>

                {/* Hover effect */}
                <div className="mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Network Summary */}
      {!isLoading && networks.length > 0 && (
        <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-sm text-gray-400">Online</p>
              <p className="text-lg font-bold text-green-400">
                {networks.filter(([, status]) => status.status === 'online').length}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Degraded</p>
              <p className="text-lg font-bold text-yellow-400">
                {networks.filter(([, status]) => status.status === 'degraded').length}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Offline</p>
              <p className="text-lg font-bold text-red-400">
                {networks.filter(([, status]) => status.status === 'offline').length}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Avg Latency</p>
              <p className="text-lg font-bold text-blue-400">
                {Math.round(networks.reduce((sum, [, status]) => sum + status.latency, 0) / networks.length)}ms
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NetworkGrid;

### 7.5 ARCHIVO: `src/components/OpportunityCard.tsx` (CREAR)
```typescript
import React, { useState } from 'react';
import { formatCurrency, formatPercentage, formatStrategy, getBlockchainInfo, isExpired, formatRelativeTime } from '../utils/helpers';
import type { ArbitrageOpportunity } from '../types/arbitrage';

interface OpportunityCardProps {
  opportunity: ArbitrageOpportunity;
  onExecute?: (opportunityId: string) => void;
}

const OpportunityCard: React.FC<OpportunityCardProps> = ({ opportunity, onExecute }) => {
  const [isExecuting, setIsExecuting] = useState(false);
  
  const fromChain = getBlockchainInfo(opportunity.blockchain_from);
  const toChain = getBlockchainInfo(opportunity.blockchain_to);
  const expired = isExpired(opportunity.expires_at);
  
  const handleExecute = async () => {
    if (onExecute && !expired && !isExecuting) {
      setIsExecuting(true);
      try {
        await onExecute(opportunity.id);
      } finally {
        setIsExecuting(false);
      }
    }
  };

  const getProfitColorClass = (percentage: number): string => {
    if (percentage >= 3) return 'text-green-300';
    if (percentage >= 2) return 'text-green-400';
    if (percentage >= 1) return 'text-green-500';
    return 'text-yellow-400';
  };

  const getConfidenceColorClass = (score: number): string => {
    if (score >= 0.8) return 'text-green-400';
    if (score >= 0.6) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className={`
      bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20 
      hover:border-blue-400/50 transition-all duration-300 group
      ${expired ? 'opacity-60 border-red-400/20' : ''}
    `}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          {/* Strategy Badge */}
          <div className="flex items-center space-x-2 mb-3">
            <span className="px-3 py-1 bg-blue-600/80 text-blue-100 rounded-full text-xs font-medium uppercase tracking-wide">
              {formatStrategy(opportunity.strategy)}
            </span>
            {expired && (
              <span className="px-2 py-1 bg-red-600/80 text-red-100 rounded-full text-xs font-medium">
                EXPIRED
              </span>
            )}
          </div>

          {/* Chain Route */}
          <div className="flex items-center space-x-3 text-sm text-gray-300">
            <div className="flex items-center space-x-1">
              <span className="text-lg">{fromChain.emoji}</span>
              <span className="font-medium">{fromChain.name}</span>
            </div>
            <span className="text-gray-500">→</span>
            <div className="flex items-center space-x-1">
              <span className="text-lg">{toChain.emoji}</span>
              <span className="font-medium">{toChain.name}</span>
            </div>
          </div>

          {/* Token Pair */}
          <div className="mt-2">
            <span className="text-lg font-bold text-white">
              {opportunity.token_in} → {opportunity.token_out}
            </span>
            <span className="text-gray-400 ml-2 text-sm">
              ({opportunity.amount_in} {opportunity.token_in})
            </span>
          </div>
        </div>

        {/* Profit Display */}
        <div className="text-right">
          <div className={`text-2xl font-bold ${getProfitColorClass(opportunity.profit_percentage)}`}>
            {formatCurrency(opportunity.profit_amount)}
          </div>
          <div className={`text-lg ${getProfitColorClass(opportunity.profit_percentage)}`}>
            {formatPercentage(opportunity.profit_percentage)}
          </div>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
        <div>
          <span className="text-gray-400">Confidence:</span>
          <span className={`ml-2 font-semibold ${getConfidenceColorClass(opportunity.confidence_score)}`}>
            {formatPercentage(opportunity.confidence_score * 100, 0)}
          </span>
        </div>
        <div>
          <span className="text-gray-400">Gas Est:</span>
          <span className="ml-2 text-white font-mono">
            {parseInt(opportunity.gas_estimate).toLocaleString()}
          </span>
        </div>
        <div>
          <span className="text-gray-400">DEX Path:</span>
          <span className="ml-2 text-blue-300">
            {opportunity.dex_path.join(' → ')}
          </span>
        </div>
        <div>
          <span className="text-gray-400">Expires:</span>
          <span className={`ml-2 ${expired ? 'text-red-400' : 'text-green-400'}`}>
            {formatRelativeTime(opportunity.expires_at)}
          </span>
        </div>
      </div>

      {/* Expected Output */}
      <div className="mb-4 p-3 bg-white/5 rounded-lg border border-white/10">
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-400">Expected Output:</span>
          <span className="text-white font-semibold">
            {opportunity.expected_amount_out.toFixed(4)} {opportunity.token_out}
          </span>
        </div>
      </div>

      {/* Action Button */}
      <button
        onClick={handleExecute}
        disabled={expired || isExecuting}
        className={`
          w-full px-4 py-3 rounded-lg font-semibold text-sm transition-all duration-200
          ${expired 
            ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
            : isExecuting
            ? 'bg-blue-600 text-white cursor-wait'
            : 'bg-green-600 hover:bg-green-700 text-white hover:scale-105'
          }
          ${!expired && !isExecuting ? 'group-hover:shadow-lg group-hover:shadow-green-600/25' : ''}
        `}
      >
        {isExecuting ? (
          <div className="flex items-center justify-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            <span>Executing...</span>
          </div>
        ) : expired ? (
          '❌ Expired'
        ) : (
          '🚀 Execute Arbitrage'
        )}
      </button>

      {/* Timestamp */}
      <div className="mt-3 text-xs text-gray-500 text-center">
        Created {formatRelativeTime(opportunity.created_at)}
      </div>
    </div>
  );
};

export default OpportunityCard;
```

### 7.6 ARCHIVO: `src/components/ArbitrageDashboard.tsx` (CREAR - COMPONENTE PRINCIPAL)
```typescript
import React, { useState, useEffect } from 'react';
import { useArbitrageData } from '../hooks/useArbitrageData';
import { formatTime, formatCurrency, formatPercentage } from '../utils/helpers';
import { API_CONFIG } from '../config/api';
import LoadingScreen from './LoadingScreen';
import StatsCard from './StatsCard';
import NetworkGrid from './NetworkGrid';
import OpportunityCard from './OpportunityCard';

const ArbitrageDashboard: React.FC = () => {
  const {
    health,
    networkStatus,
    opportunities,
    dashboardSummary,
    isLoading,
    isConnected,
    lastUpdate,
    errors,
    refetchAll,
    refetchOpportunities,
    clearErrors,
    stats
  } = useArbitrageData();

  const [selectedFilter, setSelectedFilter] = useState<'all' | 'triangular' | 'cross_dex' | 'flash_loan'>('all');
  const [showStats, setShowStats] = useState(false);

  // Filter opportunities based on selected filter
  const filteredOpportunities = opportunities.filter(opp => {
    if (selectedFilter === 'all') return true;
    return opp.strategy === selectedFilter + '_arbitrage';
  });

  // Mock execute function
  const handleExecuteOpportunity = async (opportunityId: string) => {
    console.log('🚀 Executing opportunity:', opportunityId);
    // Simulate execution time
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('✅ Opportunity executed successfully');
    // Refresh opportunities after execution
    refetchOpportunities();
  };

  // Show initial loading screen
  if (isLoading && !isConnected && !health) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 text-white">
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
        
        {/* Header */}
        <header className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Title Section */}
            <div>
              <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                ⚡ ArbitrageX Supreme
              </h1>
              <p className="text-gray-400 mt-2 text-lg">
                Real-time arbitrage opportunities • Backend v{health?.version || '2.1.0'}
              </p>
              <p className="text-gray-500 text-sm mt-1">
                {API_CONFIG.BASE_URL}
              </p>
            </div>

            {/* Control Panel */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              {/* Connection Status */}
              <div className={`flex items-center space-x-2 px-4 py-2 rounded-full text-sm font-medium ${
                isConnected ? 'bg-green-900/50 text-green-300 border border-green-600/30' : 'bg-red-900/50 text-red-300 border border-red-600/30'
              }`}>
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
                <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
              </div>

              {/* Stats Toggle */}
              <button
                onClick={() => setShowStats(!showStats)}
                className="px-4 py-2 bg-purple-600/80 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm font-medium"
              >
                📊 {showStats ? 'Hide' : 'Show'} Stats
              </button>

              {/* Refresh Button */}
              <button
                onClick={refetchAll}
                disabled={isLoading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition-colors text-sm font-medium flex items-center space-x-2"
              >
                <span className={isLoading ? 'animate-spin' : ''}>🔄</span>
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Last Update Info */}
          {lastUpdate && (
            <div className="mt-4 text-sm text-gray-400">
              Last updated: {formatTime(lastUpdate)} • Auto-refresh every {API_CONFIG.AUTO_REFRESH_INTERVAL / 1000}s
            </div>
          )}
        </header>

        {/* Error Display */}
        {Object.values(errors).some(error => error) && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-600/50 rounded-lg">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-red-300 font-semibold mb-2 flex items-center">
                  🚨 Connection Issues
                </h3>
                {Object.entries(errors).map(([key, error]) => 
                  error && (
                    <p key={key} className="text-red-200 text-sm mb-1">
                      • <span className="capitalize">{key}</span>: {error}
                    </p>
                  )
                )}
              </div>
              <button
                onClick={clearErrors}
                className="px-3 py-1 bg-red-600/80 hover:bg-red-700 text-white rounded text-sm"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Stats Panel (Collapsible) */}
        {showStats && stats && (
          <div className="mb-8 p-4 bg-white/5 backdrop-blur-sm rounded-lg border border-white/10">
            <h3 className="text-lg font-semibold mb-4 text-white">📈 System Statistics</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-sm text-gray-400">Total Requests</p>
                <p className="text-xl font-bold text-blue-400">{stats.totalRequests}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Success Rate</p>
                <p className="text-xl font-bold text-green-400">
                  {stats.totalRequests > 0 ? Math.round((stats.successfulRequests / stats.totalRequests) * 100) : 0}%
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Failed Requests</p>
                <p className="text-xl font-bold text-red-400">{stats.failedRequests}</p>
              </div>
              <div>
                <p className="text-sm text-gray-400">Last Success</p>
                <p className="text-sm font-bold text-yellow-400">
                  {stats.lastSuccessTime ? formatTime(stats.lastSuccessTime) : 'Never'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Main Dashboard Stats */}
        {dashboardSummary && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatsCard
              title="Total Profit"
              value={formatCurrency(dashboardSummary.totalProfitUsd)}
              subtitle="Cumulative earnings"
              icon="💰"
              color="green"
              loading={isLoading}
            />
            <StatsCard
              title="Avg Profit %"
              value={formatPercentage(dashboardSummary.averageProfitPercentage)}
              subtitle="Per opportunity"
              icon="📊"
              color="blue"
              loading={isLoading}
            />
            <StatsCard
              title="Top Chain"
              value={dashboardSummary.topPerformingChain.toUpperCase()}
              subtitle="Best performing"
              icon="🏆"
              color="purple"
              loading={isLoading}
            />
            <StatsCard
              title="Opportunities"
              value={dashboardSummary.totalOpportunities}
              subtitle={`${opportunities.length} active`}
              icon="⚡"
              color="yellow"
              loading={isLoading}
            />
          </div>
        )}

        {/* Network Status Section */}
        <div className="mb-8">
          <NetworkGrid 
            networkStatus={networkStatus} 
            isLoading={isLoading}
          />
        </div>

        {/* Opportunities Section */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white flex items-center">
                💰 Live Arbitrage Opportunities
                {isLoading && <div className="ml-3 animate-spin rounded-full h-5 w-5 border-b-2 border-blue-400"></div>}
              </h2>
              <p className="text-gray-400 text-sm mt-1">
                Showing {filteredOpportunities.length} of {opportunities.length} opportunities
              </p>
            </div>
            
            {/* Filter Controls */}
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'all', label: 'All' },
                { key: 'triangular', label: 'Triangular' },
                { key: 'cross_dex', label: 'Cross DEX' },
                { key: 'flash_loan', label: 'Flash Loan' }
              ].map(filter => (
                <button
                  key={filter.key}
                  onClick={() => setSelectedFilter(filter.key as any)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    selectedFilter === filter.key
                      ? 'bg-blue-600 text-white'
                      : 'bg-white/10 text-gray-300 hover:bg-white/20'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
          
          {/* Opportunities Grid */}
          {filteredOpportunities.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredOpportunities.slice(0, API_CONFIG.MAX_OPPORTUNITIES_DISPLAY).map((opportunity) => (
                <OpportunityCard
                  key={opportunity.id}
                  opportunity={opportunity}
                  onExecute={handleExecuteOpportunity}
                />
              ))}
            </div>
          ) : isLoading ? (
            // Loading skeletons
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="bg-white/10 backdrop-blur-sm rounded-lg p-6 border border-white/20 animate-pulse">
                  <div className="h-6 bg-white/20 rounded mb-4 w-32"></div>
                  <div className="h-8 bg-white/20 rounded mb-4"></div>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="h-4 bg-white/20 rounded"></div>
                    <div className="h-4 bg-white/20 rounded"></div>
                  </div>
                  <div className="h-10 bg-white/20 rounded"></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-8 border border-white/20 text-center">
              <div className="text-6xl mb-4">🔍</div>
              <p className="text-gray-400 text-lg mb-2">No arbitrage opportunities found</p>
              <p className="text-gray-500 text-sm">
                {selectedFilter === 'all' 
                  ? 'The system is scanning markets for new opportunities...'
                  : `No ${selectedFilter.replace('_', ' ')} opportunities available. Try a different filter.`
                }
              </p>
              <button
                onClick={refetchOpportunities}
                className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                🔄 Refresh Opportunities
              </button>
            </div>
          )}
        </div>

        {/* Recent Executions */}
        {dashboardSummary?.recentExecutions && dashboardSummary.recentExecutions.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-6">📈 Recent Executions</h2>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-white/5">
                    <tr>
                      <th className="text-left p-4 text-gray-400 font-medium">Opportunity</th>
                      <th className="text-left p-4 text-gray-400 font-medium">Status</th>
                      <th className="text-right p-4 text-gray-400 font-medium">Profit</th>
                      <th className="text-right p-4 text-gray-400 font-medium">Gas Used</th>
                      <th className="text-right p-4 text-gray-400 font-medium">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboardSummary.recentExecutions.slice(0, 5).map((execution) => (
                      <tr key={execution.id} className="border-t border-white/10 hover:bg-white/5">
                        <td className="p-4">
                          <span className="font-mono text-sm text-blue-300">{execution.opportunityId}</span>
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            execution.status === 'SUCCESS' ? 'bg-green-600/20 text-green-300' :
                            execution.status === 'FAILED' ? 'bg-red-600/20 text-red-300' :
                            'bg-yellow-600/20 text-yellow-300'
                          }`}>
                            {execution.status}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <div className="text-green-400 font-semibold">
                            {formatCurrency(execution.actualProfitUsd)}
                          </div>
                          <div className="text-green-300 text-sm">
                            {formatPercentage(execution.actualProfitPercentage)}
                          </div>
                        </td>
                        <td className="p-4 text-right font-mono text-sm text-gray-300">
                          {parseInt(execution.gasUsed).toLocaleString()}
                        </td>
                        <td className="p-4 text-right text-sm text-gray-400">
                          {formatTime(execution.executedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="text-center text-gray-500 text-sm py-8 border-t border-white/10">
          <div className="space-y-2">
            <p>
              <strong>ArbitrageX Supreme</strong> v1.0.0 • 
              Last update: {lastUpdate ? formatTime(lastUpdate) : 'Never'} • 
              Auto-refresh: {API_CONFIG.AUTO_REFRESH_INTERVAL / 1000}s
            </p>
            <p>
              Backend: <span className="font-mono text-blue-400">{API_CONFIG.BASE_URL}</span>
            </p>
            <p>
              Frontend: <span className="font-mono text-purple-400">https://show-my-github-gems.pages.dev</span>
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default ArbitrageDashboard;
```

---

## PASO 8: ARCHIVOS PRINCIPALES DE LA APLICACIÓN

### 8.1 ARCHIVO: `src/App.tsx` (CREAR/REEMPLAZAR)
```typescript
import React from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import ArbitrageDashboard from './components/ArbitrageDashboard';

function App() {
  console.log('🚀 ArbitrageX Supreme App Starting...');
  console.log('🔗 Backend:', 'https://arbitragex-supreme-backend.pages.dev');
  console.log('🎯 Frontend:', 'https://show-my-github-gems.pages.dev');

  return (
    <ErrorBoundary>
      <div className="App">
        <ArbitrageDashboard />
      </div>
    </ErrorBoundary>
  );
}

export default App;
```

### 8.2 ARCHIVO: `src/main.tsx` (CREAR/REEMPLAZAR)
```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Console branding and debug info
console.log(
  '%c⚡ ArbitrageX Supreme Dashboard%c\n' +
  '%c🚀 Starting React Application...%c\n' +
  '%c🔗 Backend: https://arbitragex-supreme-backend.pages.dev%c\n' +
  '%c📊 Frontend: https://show-my-github-gems.pages.dev%c\n' +
  '%c⏰ Auto-refresh: 8 seconds%c\n' +
  '%c🌐 Networks: 20+ blockchains%c',
  'color: #3b82f6; font-size: 24px; font-weight: bold;', '',
  'color: #10b981; font-size: 14px;', '',
  'color: #8b5cf6; font-size: 12px;', '',
  'color: #f59e0b; font-size: 12px;', '',
  'color: #06b6d4; font-size: 12px;', '',
  'color: #ec4899; font-size: 12px;', ''
);

// Performance monitoring
const startTime = performance.now();

// Environment info
console.log('🌍 Environment:', {
  NODE_ENV: import.meta.env.MODE,
  DEV: import.meta.env.DEV,
  PROD: import.meta.env.PROD,
  BASE_URL: import.meta.env.BASE_URL
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Log startup time
window.addEventListener('load', () => {
  const endTime = performance.now();
  const loadTime = Math.round(endTime - startTime);
  console.log(`⚡ ArbitrageX Supreme loaded in ${loadTime}ms`);
});
```

### 8.3 ARCHIVO: `src/index.css` (CREAR/REEMPLAZAR)
```css
/* ArbitrageX Supreme - Global Styles */

@tailwind base;
@tailwind components;
@tailwind utilities;

/* Base styles */
* {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
  min-height: 100vh;
  overflow-x: hidden;
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: rgba(59, 130, 246, 0.5);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(59, 130, 246, 0.7);
}

/* Firefox scrollbar */
* {
  scrollbar-width: thin;
  scrollbar-color: rgba(59, 130, 246, 0.5) rgba(255, 255, 255, 0.1);
}

/* Code/mono font */
code, .font-mono {
  font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Consolas', 'Courier New', monospace;
}

/* Custom animations */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes glow {
  0%, 100% {
    box-shadow: 0 0 5px rgba(59, 130, 246, 0.2);
  }
  50% {
    box-shadow: 0 0 20px rgba(59, 130, 246, 0.4);
  }
}

/* Animation utilities */
.animate-fadeIn {
  animation: fadeIn 0.3s ease-out;
}

.animate-slideUp {
  animation: slideUp 0.3s ease-out;
}

.animate-slideDown {
  animation: slideDown 0.3s ease-out;
}

.animate-scaleIn {
  animation: scaleIn 0.2s ease-out;
}

.animate-glow {
  animation: glow 2s ease-in-out infinite;
}

/* Glass morphism effects */
.glass {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.glass-dark {
  background: rgba(0, 0, 0, 0.2);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

/* Gradient text utilities */
.gradient-text {
  background: linear-gradient(135deg, #3b82f6, #8b5cf6, #ec4899);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.gradient-bg {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
}

/* Card hover effects */
.card-hover {
  transition: all 0.3s ease;
}

.card-hover:hover {
  transform: translateY(-2px) scale(1.02);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
}

/* Button effects */
.btn-glow {
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.btn-glow:hover {
  box-shadow: 0 0 20px rgba(59, 130, 246, 0.5);
}

.btn-glow:active {
  transform: scale(0.98);
}

/* Loading shimmer effect */
.shimmer {
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.0) 0%,
    rgba(255, 255, 255, 0.1) 50%,
    rgba(255, 255, 255, 0.0) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 2s infinite;
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

/* Status indicators */
.status-online {
  color: #10b981;
  text-shadow: 0 0 10px rgba(16, 185, 129, 0.5);
}

.status-degraded {
  color: #f59e0b;
  text-shadow: 0 0 10px rgba(245, 158, 11, 0.5);
}

.status-offline {
  color: #ef4444;
  text-shadow: 0 0 10px rgba(239, 68, 68, 0.5);
}

/* Profit colors */
.profit-high {
  color: #10b981;
  text-shadow: 0 0 10px rgba(16, 185, 129, 0.3);
}

.profit-medium {
  color: #34d399;
  text-shadow: 0 0 10px rgba(52, 211, 153, 0.3);
}

.profit-low {
  color: #fbbf24;
  text-shadow: 0 0 10px rgba(251, 191, 36, 0.3);
}

/* Mobile optimizations */
@media (max-width: 768px) {
  body {
    font-size: 14px;
  }
  
  .glass {
    backdrop-filter: blur(5px);
    -webkit-backdrop-filter: blur(5px);
  }
}

/* Accessibility */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* Focus styles */
button:focus,
input:focus,
select:focus,
textarea:focus {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

/* Selection styles */
::selection {
  background: rgba(59, 130, 246, 0.3);
  color: white;
}

/* Print styles */
@media print {
  body {
    background: white !important;
    color: black !important;
  }
  
  .glass, .glass-dark {
    background: white !important;
    border: 1px solid #ccc !important;
  }
}

/* High contrast mode */
@media (prefers-contrast: high) {
  .glass, .glass-dark {
    background: rgba(0, 0, 0, 0.9) !important;
    border: 2px solid white !important;
  }
}

/* Dark mode support (redundant but good practice) */
@media (prefers-color-scheme: dark) {
  body {
    color-scheme: dark;
  }
}

/* Loading state styles */
.loading-state {
  pointer-events: none;
  opacity: 0.7;
  filter: grayscale(0.5);
}

/* Error state styles */
.error-state {
  border-color: #ef4444 !important;
  background-color: rgba(239, 68, 68, 0.1) !important;
}

/* Success state styles */
.success-state {
  border-color: #10b981 !important;
  background-color: rgba(16, 185, 129, 0.1) !important;
}

/* Notification styles */
.notification {
  animation: slideDown 0.3s ease-out;
}

.notification-exit {
  animation: fadeIn 0.3s ease-out reverse;
}

/* Table styles */
table {
  border-collapse: collapse;
}

/* Utility classes */
.text-shadow {
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
}

.border-glow {
  box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.3);
}

.bg-pattern {
  background-image: 
    radial-gradient(circle at 1px 1px, rgba(59, 130, 246, 0.15) 1px, transparent 0);
  background-size: 20px 20px;
}

/* Custom components styles that may not be covered by Tailwind */
.arbitrage-card {
  @apply glass card-hover rounded-lg p-6 border border-white/20;
}

.network-status-item {
  @apply glass rounded-lg p-4 border border-white/20 hover:border-white/40 transition-all duration-200;
}

.profit-display {
  @apply font-bold text-2xl profit-high;
}

.loading-skeleton {
  @apply bg-white/20 rounded animate-pulse shimmer;
}
```

---

## PASO 9: COMANDOS DE INSTALACIÓN Y DESARROLLO

### 9.1 Ejecutar Instalación Completa
```bash
# Instalar todas las dependencias
npm install

# Verificar que no hay errores en TypeScript
npx tsc --noEmit

# Generar build de prueba
npm run build

# Inicializar git (si no existe)
git init
git add .
git commit -m "Initial ArbitrageX Supreme dashboard setup"
```

### 9.2 Comandos de Desarrollo
```bash
# Desarrollo local
npm run dev
# Abrir http://localhost:5173

# Build para producción
npm run build

# Preview del build
npm run preview

# Test de conectividad API
npm run test:api
```

---

## PASO 10: DEPLOYMENT A CLOUDFLARE PAGES

### 10.1 Verificar Build Local
```bash
# 1. Build exitoso
npm run build

# 2. Verificar archivos generados
ls -la dist/

# 3. Test local del build
npm run preview
```

### 10.2 Deploy a Cloudflare
```bash
# 1. Deploy directo con Wrangler
npx wrangler pages deploy dist --project-name show-my-github-gems

# 2. O usar el script npm
npm run deploy
```

### 10.3 Verificar Deployment
```bash
# URLs esperadas después del deploy:
# ✅ https://show-my-github-gems.pages.dev
# ✅ https://[random-id].show-my-github-gems.pages.dev

# Verificar endpoints funcionando:
curl "https://show-my-github-gems.pages.dev"
```

---

## PASO 11: VALIDACIÓN FINAL OBLIGATORIA

### 11.1 Checklist de Funcionalidad
- [ ] ✅ Aplicación carga sin errores en `http://localhost:5173`
- [ ] ✅ Conexión al backend exitosa (estado "Connected" en verde)
- [ ] ✅ Network status muestra 10+ blockchains con latencias
- [ ] ✅ Arbitrage opportunities se cargan y actualizan automáticamente
- [ ] ✅ Dashboard stats muestran datos en tiempo real
- [ ] ✅ Auto-refresh funciona cada 8 segundos
- [ ] ✅ Filtros de opportunities funcionan correctamente
- [ ] ✅ Botones de "Execute" están funcionales
- [ ] ✅ Error handling muestra mensajes apropiados
- [ ] ✅ Build de producción (`npm run build`) exitoso sin errores
- [ ] ✅ Deployment a Cloudflare Pages exitoso
- [ ] ✅ Aplicación accesible en URL de producción

### 11.2 URLs Críticas para Verificar
```
BACKEND:  https://arbitragex-supreme-backend.pages.dev/health
FRONTEND: https://show-my-github-gems.pages.dev
```

### 11.3 Funcionalidades Obligatorias en Producción
1. **Dashboard principal** con 4 cards de estadísticas
2. **Network grid** con estado de 10+ blockchains
3. **Opportunities list** con auto-refresh cada 8 segundos
4. **Filter system** (All, Triangular, Cross DEX, Flash Loan)
5. **Real-time connection** status indicator
6. **Error handling** con mensajes claros
7. **Loading states** con skeletons y spinners
8. **Responsive design** funcional en mobile/tablet/desktop

---

## 🚨 RESULTADO FINAL ESPERADO

### ✅ APLICACIÓN COMPLETAMENTE FUNCIONAL:
- **URL Principal**: `https://show-my-github-gems.pages.dev`
- **Backend Conectado**: `https://arbitragex-supreme-backend.pages.dev`
- **Dashboard en Tiempo Real**: Datos actualizándose cada 8 segundos
- **UI/UX Profesional**: Design moderno con Tailwind CSS y efectos glass
- **Performance Optimizado**: Build de Vite optimizado para Cloudflare Pages
- **Error Handling Robusto**: Retry automático y feedback visual
- **Mobile Responsive**: Funcional en todos los dispositivos

### 🎯 FUNCIONALIDADES CORE FUNCIONANDO:
1. ⚡ **Real-time Data Streaming** desde el backend
2. 🌐 **Network Status** de 20+ blockchains
3. 💰 **Live Arbitrage Opportunities** con filtros
4. 📊 **Dashboard Metrics** actualizadas automáticamente
5. 🔄 **Auto-refresh** cada 8 segundos
6. 🚀 **Execute Buttons** funcionales (simulados)
7. 📱 **Responsive UI** para todos los dispositivos
8. 🛡️ **Error Recovery** con retry automático

---

## ⚠️ NOTAS CRÍTICAS FINALES

1. **NO MODIFICAR** la URL del backend: `https://arbitragex-supreme-backend.pages.dev`
2. **USAR EXACTAMENTE** todas las interfaces TypeScript proporcionadas
3. **IMPLEMENTAR COMPLETAMENTE** el sistema de auto-refresh cada 8 segundos
4. **VERIFICAR** que todos los endpoints respondan correctamente
5. **CONFIRMAR** que el deployment a Cloudflare Pages sea exitoso
6. **PROBAR** la aplicación en diferentes dispositivos y navegadores

### 🎯 EL DASHBOARD DEBE SER UNA APLICACIÓN COMPLETAMENTE FUNCIONAL QUE SE CONECTE PERFECTAMENTE AL BACKEND YA DESPLEGADO EN PRODUCCIÓN.

---

**🚀 EXECUTE ESTAS INSTRUCCIONES EN ORDEN EXACTO PARA OBTENER UN DASHBOARD PROFESIONAL DE ARBITRAJE EN TIEMPO REAL.**
```

---

Este es el primer bloque del prompt absoluto. ¿Debo continuar con los componentes restantes (OpportunityCard, ArbitrageDashboard) y los archivos finales (App.tsx, main.tsx, CSS) para completar las instrucciones?
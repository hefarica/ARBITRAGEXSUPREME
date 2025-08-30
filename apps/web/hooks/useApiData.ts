// ArbitrageX Pro 2025 - Deprecated Legacy Hook
// Este archivo ha sido reemplazado por useArbitrageData.ts
// que usa el sistema de backend real sin mock data.
// 
// ❌ DEPRECATED - NO USAR
// ✅ Usar useArbitrageData.ts en su lugar

// Re-export from the real backend integration
export { useArbitrageData as useNetworkStats } from './useArbitrageData'
export { useArbitrageData as useArbitrageOpportunities } from './useArbitrageData'
export { useArbitrageData as useDashboardMetrics } from './useArbitrageData'
export { useArbitrageData as useHealthCheck } from './useArbitrageData'

// Default export for compatibility
export { useArbitrageData as default } from './useArbitrageData'
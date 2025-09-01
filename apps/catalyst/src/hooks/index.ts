/**
 * ArbitrageX Supreme - Hooks Index
 * Ingenio Pichichi S.A. - Exportaciones centralizadas de hooks
 */

export { useWallet } from './useWallet'
export { useArbitrage } from './useArbitrage'
export { useSimulation } from './useSimulation'

export type { 
  WalletState, 
  UseWalletReturn, 
  SupportedWallet 
} from './useWallet'

export type { 
  ArbitrageState, 
  ArbitrageFilters, 
  ArbitrageMetrics, 
  UseArbitrageReturn 
} from './useArbitrage'

export type { 
  SimulationState, 
  SimulationResult, 
  GasEstimate, 
  MonteCarloResult, 
  BacktestResult, 
  SimulationConfig, 
  UseSimulationReturn 
} from './useSimulation'
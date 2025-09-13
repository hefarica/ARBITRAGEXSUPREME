/**
 * 🎯 WORKFLOW TYPES - ArbitrageX Supreme V3.0
 * 
 * METODOLOGÍA INGENIO PICHICHI S.A.:
 * - Disciplinado: Tipos TypeScript estrictos para safety
 * - Organizado: Interfaces claras para cada componente
 * - Metodológico: Documentación completa de cada tipo
 * 
 * @version 3.0.0 - MULTIAGENT TYPES
 * @author ArbitrageX Supreme Engineering Team
 */

// ================================================================
// OPPORTUNITY DETECTION TYPES
// ================================================================

export interface OpportunityDetected {
  id: string;
  timestamp: number;
  isValid: boolean;
  
  // Token Information
  tokens: {
    tokenA: {
      symbol: string;
      address: string;
      decimals: number;
    };
    tokenB: {
      symbol: string;
      address: string;
      decimals: number;
    };
    baseAmount: string;  // Amount in wei
  };
  
  // DEX Information
  chain: 'ethereum' | 'polygon' | 'bsc' | 'arbitrum' | 'optimism';
  dexs: Array<{
    name: string;
    address: string;
    price: string;      // Price in wei
    liquidity: string;  // Liquidity in wei
    fee: number;        // Fee in basis points (300 = 0.3%)
  }>;
  
  // Profit Calculation
  expectedProfitETH: string;    // Expected profit in ETH (string for precision)
  expectedProfitUSD: string;    // Expected profit in USD
  profitPercentage: number;     // Profit as percentage
  
  // Gas Estimation
  estimatedGas: number;         // Gas units
  gasPrice: string;            // Gas price in wei
  gasCostETH: string;          // Gas cost in ETH
  
  // Risk Factors
  riskFactors: {
    slippageRisk: number;       // 0-1 (0 = no risk, 1 = max risk)
    frontrunRisk: number;       // 0-1
    liquidityRisk: number;      // 0-1
    priceImpact: number;        // 0-1
  };
  
  // Timing
  detectedAt: number;           // Unix timestamp
  expiresAt: number;           // Unix timestamp
  timeToExpiration: number;     // Milliseconds
  
  // Source Information
  source: 'flashbots_agent' | 'mempool_scanner' | 'price_feed';
  confidence: number;           // AI agent confidence 0-1
}

// ================================================================
// RISK ASSESSMENT TYPES
// ================================================================

export interface RiskAssessment {
  opportunityId: string;
  timestamp: number;
  
  // Overall Risk Score
  riskScore: number;            // 0-1 (0 = no risk, 1 = maximum risk)
  recommendation: 'execute' | 'skip' | 'modify_parameters';
  
  // Risk Breakdown
  riskFactors: {
    frontrunRisk: {
      score: number;            // 0-1
      description: string;
      mitigationSuggested: boolean;
    };
    
    slippageRisk: {
      score: number;
      estimatedSlippage: number; // Percentage
      maxAcceptableSlippage: number;
    };
    
    honeypotRisk: {
      score: number;
      isHoneypot: boolean;
      suspiciousPatterns: string[];
    };
    
    liquidityRisk: {
      score: number;
      availableLiquidity: string; // ETH
      requiredLiquidity: string;  // ETH
      liquidityRatio: number;     // available/required
    };
    
    gasRisk: {
      score: number;
      currentGasPrice: string;    // Gwei
      recommendedGasPrice: string;
      gasPriceVolatility: number; // 0-1
    };
  };
  
  // AI Analysis
  aiAnalysis: {
    model: string;              // AI model used (gpt-4o, claude-3, etc.)
    confidence: number;         // 0-1
    reasoningSteps: string[];   // Step-by-step analysis
    alternativeStrategies: string[];
  };
  
  // Processing Time
  processingTimeMs: number;
}

// ================================================================
// STRATEGY OPTIMIZATION TYPES
// ================================================================

export interface OptimalStrategy {
  opportunityId: string;
  timestamp: number;
  
  // Strategy Selection
  strategyType: 'simple_arbitrage' | 'triangular_arbitrage' | 'flash_loan_arbitrage' | 'cross_chain_arbitrage';
  strategyDescription: string;
  confidence: number;           // AI confidence in strategy 0-1
  
  // Optimized Parameters
  optimizedParameters: {
    slippageTolerance: number;  // Optimized slippage
    gasLimit: number;           // Optimized gas limit
    gasPrice: string;          // Optimized gas price in wei
    deadline: number;          // Transaction deadline (unix timestamp)
  };
  
  // Profit Optimization
  originalProfitETH: string;    // Original estimated profit
  optimizedProfitETH: string;   // AI-optimized profit
  profitImprovement: number;    // Percentage improvement
  
  // Execution Plan
  executionSteps: Array<{
    stepNumber: number;
    action: string;             // 'swap', 'flash_loan', 'repay', etc.
    dex: string;
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    expectedAmountOut: string;
    gasEstimate: number;
  }>;
  
  // Risk Mitigation
  riskMitigations: {
    mevProtection: boolean;
    flashLoanUsage: boolean;
    bundleSubmission: boolean;
    priorityFee: string;       // MEV protection fee in wei
  };
  
  // AI Analysis
  aiOptimizer: {
    model: string;
    reasoningProcess: string[];
    alternativesConsidered: string[];
    optimizationGoals: string[];
  };
  
  // Timing
  processingTimeMs: number;
  estimatedExecutionTimeMs: number;
}

// ================================================================
// EXECUTION RESULT TYPES
// ================================================================

export interface ExecutionResult {
  opportunityId: string;
  timestamp: number;
  success: boolean;
  
  // Transaction Information
  transactionHash?: string;
  blockNumber?: number;
  gasUsed?: number;
  gasPrice?: string;          // Actual gas price in wei
  gasCostETH?: string;        // Actual gas cost in ETH
  
  // Profit Results
  actualProfitETH?: string;   // Actual profit achieved
  actualProfitUSD?: string;   // Actual profit in USD
  profitVariance?: number;    // Difference vs expected (percentage)
  
  // Performance Metrics
  executionLatencyMs: number; // End-to-end execution time
  mempoolToExecutionMs: number; // Time from mempool detection
  
  // Error Information (if failed)
  error?: string;
  errorCode?: string;
  revertReason?: string;
  failedStep?: string;        // Which execution step failed
  
  // MEV Protection
  mevProtected: boolean;
  bundleIncluded: boolean;
  relayUsed?: string;         // Which relay was used
  
  // Slippage Analysis
  expectedSlippage: number;
  actualSlippage: number;
  slippageWithinTolerance: boolean;
}

// ================================================================
// RECONCILIATION TYPES
// ================================================================

export interface ReconciliationReport {
  opportunityId: string;
  timestamp: number;
  success: boolean;
  
  // Data Consistency
  databaseRecorded: boolean;
  cloudflareD1Synced: boolean;
  metricsUpdated: boolean;
  
  // Variance Analysis
  expectedVsActual: {
    profit: {
      expected: string;       // ETH
      actual: string;         // ETH
      variance: number;       // Percentage difference
    };
    gas: {
      estimated: number;
      actual: number;
      variance: number;
    };
    timing: {
      estimated: number;      // ms
      actual: number;         // ms  
      variance: number;
    };
  };
  
  // Error Information
  error?: string;
  missingData?: string[];
  dataInconsistencies?: string[];
  
  // Processing Time
  reconciliationTimeMs: number;
}

// ================================================================
// WORKFLOW STATE TYPES
// ================================================================

export interface ArbitrageWorkflowState {
  status: 
    | 'initializing'
    | 'running' 
    | 'paused'
    | 'detecting_opportunities'
    | 'validating_opportunity'
    | 'assessing_risk'
    | 'optimizing_strategy'
    | 'simulating_execution'
    | 'executing_transaction'
    | 'reconciling'
    | 'waiting_for_next_opportunity'
    | 'error_recovery'
    | 'emergency_stopped'
    | 'stopping'
    | 'completed';
    
  config: ArbitrageConfig;
  currentOpportunity: OpportunityDetected | null;
  isPaused: boolean;
  emergencyStop: boolean;
  emergencyReason: string | null;
  executionCount: number;
  lastError: string | null;
  startedAt: number;
  metrics: ExecutionMetrics;
}

export interface ArbitrageConfig {
  enabled: boolean;
  minProfitThreshold: string;     // ETH amount
  maxGasPrice: string;           // Gwei
  slippageTolerance: number;     // Percentage (0.005 = 0.5%)
  timeoutMs: number;
  maxConcurrentExecutions: number;
  aiAgentsEnabled: boolean;
  flashLoanEnabled: boolean;
  relayUrls: string[];
}

export interface ExecutionMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  totalProfitETH: string;
  averageLatencyMs: number;
  lastExecutionTimestamp: number;
}

// ================================================================
// AI AGENT INPUT/OUTPUT TYPES
// ================================================================

export interface FlashbotsAgentInput {
  minProfitThreshold: string;
  maxGasPrice: string;
  enabledChains: string[];
  enabledDexs: string[];
  timeoutMs: number;
}

export interface RiskAssessmentAgentInput {
  opportunity: OpportunityDetected;
  validationResult: any;
  checkFrontrunRisk: boolean;
  checkSlippageRisk: boolean;
  checkHoneypotRisk: boolean;
  timeoutMs: number;
}

export interface StrategyOptimizerAgentInput {
  opportunity: OpportunityDetected;
  availableStrategies: string[];
  gasOptimization: boolean;
  slippageTolerance: number;
  flashLoanEnabled: boolean;
  timeoutMs: number;
}

// ================================================================
// SIMULATION TYPES
// ================================================================

export interface SimulationResult {
  opportunityId: string;
  success: boolean;
  revertReason?: string;
  
  // Simulation Results
  actualProfitETH: string;
  gasUsed: number;
  executionTimeMs: number;
  
  // State Changes
  balanceChanges: {
    [tokenAddress: string]: {
      before: string;
      after: string;
      change: string;
    };
  };
  
  // Simulation Parameters
  forkBlock: number;
  simulationTimestamp: number;
  
  // Error Information
  error?: string;
  failedTransaction?: {
    to: string;
    data: string;
    value: string;
    gasLimit: number;
  };
}

// ================================================================
// NOTIFICATION TYPES FOR FRONTEND SSE
// ================================================================

export interface SSENotification {
  type: 
    | 'workflow:started'
    | 'workflow:completed'
    | 'opportunity:detected'
    | 'opportunity:rejected'
    | 'opportunity:high_risk'
    | 'execution:simulation_failed'
    | 'execution:success'
    | 'execution:failed'
    | 'execution:error'
    | 'metrics:updated'
    | 'system:alert';
    
  payload: any;
  timestamp?: number;
}

// ================================================================
// ACTIVITY PARAMETER TYPES
// ================================================================

export interface ValidateOpportunityParams {
  opportunity: OpportunityDetected;
  strictValidation: boolean;
  timeoutMs: number;
}

export interface SimulateArbitrageParams {
  opportunity: OpportunityDetected;
  strategy: OptimalStrategy;
  forkBlock: string | number;
  timeoutMs: number;
}

export interface ExecuteArbitrageParams {
  opportunity: OpportunityDetected;
  simulation: SimulationResult;
  strategy: OptimalStrategy;
  relayUrls: string[];
  maxGasPrice: string;
  timeoutMs: number;
}

export interface ReconciliationParams {
  opportunity: OpportunityDetected;
  executionResult: ExecutionResult;
  simulation: SimulationResult;
  metrics: ExecutionMetrics;
  syncWithCloudflareD1: boolean;
}

export interface SecurityAlertParams {
  type: 'reconciliation_failure' | 'rollback_failure' | 'execution_error' | 'high_risk_detected';
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: any;
}

export interface RollbackParams {
  opportunityId: string;
  executionPhase: string;
  error: string;
}

export interface MetricsUpdateParams {
  executionSuccess: boolean;
  latencyMs: number;
  profitETH: string;
  gasUsed: number;
}
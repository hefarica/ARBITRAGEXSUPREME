/**
 * DeviationInvestigator Service
 * 
 * Automated investigation system for variance causes when thresholds are exceeded.
 * Implements Root Cause Analysis (RCA) methodology following ArbitrageX Supreme V3.0
 * Real-Only policy - all analysis based on actual network and execution data.
 * 
 * Core Responsibilities:
 * - Automated variance cause investigation
 * - MEV competition analysis
 * - Network condition correlation
 * - Gas market impact assessment
 * - Timing slippage root cause analysis
 * - Investigation result storage and reporting
 */

import { Pool } from 'pg';
import { Logger } from 'winston';
import { 
  DeviationInvestigation, 
  SimulationData, 
  ExecutionData, 
  VarianceAnalysisResult,
  ChainId,
  Strategy
} from '../types/reconciliation';

/**
 * Investigation categories for systematic root cause analysis
 */
export enum InvestigationCategory {
  MEV_COMPETITION = 'mev_competition',
  NETWORK_CONDITIONS = 'network_conditions', 
  GAS_MARKET_VOLATILITY = 'gas_market_volatility',
  TIMING_SLIPPAGE = 'timing_slippage',
  LIQUIDITY_CHANGES = 'liquidity_changes',
  ORACLE_DELAYS = 'oracle_delays',
  CROSS_CHAIN_LATENCY = 'cross_chain_latency',
  FLASH_LOAN_AVAILABILITY = 'flash_loan_availability'
}

/**
 * Investigation findings structure for detailed analysis results
 */
export interface InvestigationFindings {
  category: InvestigationCategory;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number; // 0-1 scale
  description: string;
  root_cause: string;
  impact_assessment: {
    profit_impact_bps: number;
    gas_impact_bps: number;
    timing_impact_ms: number;
  };
  mitigation_suggestions: string[];
  supporting_data: Record<string, any>;
}

/**
 * Network condition analysis for correlation with variance
 */
interface NetworkConditionSnapshot {
  timestamp: string;
  chain_id: number;
  block_number: number;
  gas_price_gwei: number;
  block_utilization: number; // 0-1 scale
  mempool_congestion: number; // tx count
  validator_participation: number; // 0-1 scale
  network_hashrate?: bigint; // For PoW chains
  finality_time_ms: number;
}

/**
 * MEV competition analysis data
 */
interface MEVCompetitionData {
  timestamp: string;
  chain_id: number;
  block_number: number;
  competing_searchers: number;
  bid_density: number; // bids per block
  average_priority_fee: number;
  max_priority_fee: number;
  bundle_success_rate: number; // 0-1 scale
  sandwich_attack_frequency: number;
}

export class DeviationInvestigator {
  private pool: Pool;
  private logger: Logger;
  private investigationCache: Map<string, InvestigationFindings[]> = new Map();
  
  // Configurable thresholds for investigation triggers
  private readonly config = {
    // Investigation trigger thresholds (basis points)
    profit_variance_threshold_bps: 200, // 2%
    gas_variance_threshold_bps: 500,    // 5%
    timing_variance_threshold_ms: 1000, // 1 second
    
    // Confidence thresholds for findings
    min_confidence_threshold: 0.6,
    high_confidence_threshold: 0.8,
    
    // Network analysis windows
    network_analysis_window_blocks: 100,
    mev_competition_window_blocks: 50,
    
    // Cache settings
    investigation_cache_ttl_ms: 300000, // 5 minutes
  };

  constructor(pool: Pool, logger: Logger) {
    this.pool = pool;
    this.logger = logger;
  }

  /**
   * Main investigation entry point - called when variance thresholds exceeded
   */
  async investigate(
    simulationData: SimulationData,
    executionData: ExecutionData | null,
    varianceResult: VarianceAnalysisResult,
    strategy: Strategy,
    chainId: ChainId
  ): Promise<DeviationInvestigation> {
    const investigationId = this.generateInvestigationId();
    
    this.logger.info('Starting deviation investigation', {
      investigation_id: investigationId,
      strategy,
      chain_id: chainId,
      simulation_id: simulationData.simulation_id,
      execution_id: executionData?.execution_id || null,
      variance_score: varianceResult.overall_parity_score
    });

    try {
      // Initialize investigation record
      const investigation = await this.initializeInvestigation(
        investigationId,
        simulationData,
        executionData,
        varianceResult,
        strategy,
        chainId
      );

      // Perform systematic investigation across all categories
      const findings: InvestigationFindings[] = [];

      // 1. MEV Competition Analysis
      if (this.shouldInvestigateMEV(varianceResult)) {
        const mevFindings = await this.investigateMEVCompetition(
          simulationData,
          executionData,
          chainId
        );
        findings.push(...mevFindings);
      }

      // 2. Network Conditions Analysis
      if (this.shouldInvestigateNetwork(varianceResult)) {
        const networkFindings = await this.investigateNetworkConditions(
          simulationData,
          executionData,
          chainId
        );
        findings.push(...networkFindings);
      }

      // 3. Gas Market Analysis
      if (this.shouldInvestigateGas(varianceResult)) {
        const gasFindings = await this.investigateGasMarket(
          simulationData,
          executionData,
          chainId
        );
        findings.push(...gasFindings);
      }

      // 4. Timing Slippage Analysis
      if (this.shouldInvestigateTiming(varianceResult)) {
        const timingFindings = await this.investigateTimingSlippage(
          simulationData,
          executionData,
          chainId
        );
        findings.push(...timingFindings);
      }

      // 5. Liquidity Changes Analysis
      if (this.shouldInvestigateLiquidity(varianceResult)) {
        const liquidityFindings = await this.investigateLiquidityChanges(
          simulationData,
          executionData,
          chainId,
          strategy
        );
        findings.push(...liquidityFindings);
      }

      // Filter and rank findings by confidence and severity
      const validFindings = findings.filter(f => 
        f.confidence >= this.config.min_confidence_threshold
      );

      // Update investigation with findings
      const finalInvestigation = await this.finalizeInvestigation(
        investigation,
        validFindings
      );

      this.logger.info('Investigation completed', {
        investigation_id: investigationId,
        findings_count: validFindings.length,
        high_confidence_findings: validFindings.filter(f => 
          f.confidence >= this.config.high_confidence_threshold
        ).length
      });

      return finalInvestigation;

    } catch (error) {
      this.logger.error('Investigation failed', {
        investigation_id: investigationId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * MEV Competition Analysis
   * Investigates if variance is due to MEV searcher competition
   */
  private async investigateMEVCompetition(
    simulationData: SimulationData,
    executionData: ExecutionData | null,
    chainId: ChainId
  ): Promise<InvestigationFindings[]> {
    
    const findings: InvestigationFindings[] = [];

    try {
      // Get MEV competition data around simulation/execution time
      const mevData = await this.getMEVCompetitionData(
        simulationData.simulation_timestamp,
        chainId,
        this.config.mev_competition_window_blocks
      );

      if (!mevData) {
        return findings;
      }

      // Analyze MEV competition intensity
      const competitionIntensity = this.analyzeMEVCompetitionIntensity(mevData);
      
      if (competitionIntensity.is_high_competition) {
        const profitImpact = executionData ? 
          this.calculateMEVProfitImpact(simulationData, executionData, mevData) : 0;

        findings.push({
          category: InvestigationCategory.MEV_COMPETITION,
          severity: competitionIntensity.severity,
          confidence: competitionIntensity.confidence,
          description: `High MEV searcher competition detected: ${mevData.competing_searchers} active searchers with ${mevData.bid_density.toFixed(2)} bids/block`,
          root_cause: `MEV competition reduced profitability due to ${competitionIntensity.competition_factors.join(', ')}`,
          impact_assessment: {
            profit_impact_bps: profitImpact,
            gas_impact_bps: this.calculateMEVGasImpact(mevData),
            timing_impact_ms: this.calculateMEVTimingImpact(mevData)
          },
          mitigation_suggestions: [
            'Consider increasing gas price for better positioning',
            'Implement bundle submission strategy',
            'Explore alternative DEX routes with less competition',
            'Adjust strategy timing to avoid peak competition windows'
          ],
          supporting_data: {
            competing_searchers: mevData.competing_searchers,
            bid_density: mevData.bid_density,
            bundle_success_rate: mevData.bundle_success_rate,
            priority_fee_stats: {
              average: mevData.average_priority_fee,
              max: mevData.max_priority_fee
            }
          }
        });
      }

    } catch (error) {
      this.logger.warn('MEV competition analysis failed', {
        error: error instanceof Error ? error.message : String(error),
        chain_id: chainId
      });
    }

    return findings;
  }

  /**
   * Network Conditions Analysis
   * Investigates if variance is due to network congestion or conditions
   */
  private async investigateNetworkConditions(
    simulationData: SimulationData,
    executionData: ExecutionData | null,
    chainId: ChainId
  ): Promise<InvestigationFindings[]> {
    
    const findings: InvestigationFindings[] = [];

    try {
      // Get network condition snapshots
      const networkConditions = await this.getNetworkConditions(
        simulationData.simulation_timestamp,
        chainId,
        this.config.network_analysis_window_blocks
      );

      if (!networkConditions || networkConditions.length === 0) {
        return findings;
      }

      // Analyze network congestion
      const congestionAnalysis = this.analyzeNetworkCongestion(networkConditions);
      
      if (congestionAnalysis.is_congested) {
        findings.push({
          category: InvestigationCategory.NETWORK_CONDITIONS,
          severity: congestionAnalysis.severity,
          confidence: congestionAnalysis.confidence,
          description: `Network congestion detected: ${(congestionAnalysis.avg_utilization * 100).toFixed(1)}% average block utilization`,
          root_cause: `Network congestion caused ${congestionAnalysis.congestion_factors.join(', ')}`,
          impact_assessment: {
            profit_impact_bps: this.calculateNetworkProfitImpact(congestionAnalysis),
            gas_impact_bps: this.calculateNetworkGasImpact(congestionAnalysis),
            timing_impact_ms: congestionAnalysis.finality_delay_ms
          },
          mitigation_suggestions: [
            'Monitor network conditions before execution',
            'Implement adaptive gas pricing strategy',
            'Consider execution on less congested chains',
            'Use mempool monitoring for optimal timing'
          ],
          supporting_data: {
            average_utilization: congestionAnalysis.avg_utilization,
            peak_utilization: congestionAnalysis.peak_utilization,
            average_gas_price: congestionAnalysis.avg_gas_price_gwei,
            finality_time: congestionAnalysis.avg_finality_time_ms,
            congestion_duration_blocks: congestionAnalysis.congestion_duration_blocks
          }
        });
      }

    } catch (error) {
      this.logger.warn('Network conditions analysis failed', {
        error: error instanceof Error ? error.message : String(error),
        chain_id: chainId
      });
    }

    return findings;
  }

  /**
   * Gas Market Analysis
   * Investigates if variance is due to gas market volatility
   */
  private async investigateGasMarket(
    simulationData: SimulationData,
    executionData: ExecutionData | null,
    chainId: ChainId
  ): Promise<InvestigationFindings[]> {
    
    const findings: InvestigationFindings[] = [];

    if (!executionData) {
      return findings; // Can't analyze gas variance without execution data
    }

    try {
      // Calculate gas variance
      const simGasCost = parseFloat(simulationData.estimated_gas_cost);
      const execGasCost = parseFloat(executionData.gas_cost);
      const gasVariancePct = Math.abs((execGasCost - simGasCost) / simGasCost) * 100;

      if (gasVariancePct > (this.config.gas_variance_threshold_bps / 100)) {
        // Get historical gas data for context
        const gasHistory = await this.getGasMarketHistory(
          simulationData.simulation_timestamp,
          chainId,
          50 // blocks
        );

        const volatilityAnalysis = this.analyzeGasVolatility(gasHistory);

        findings.push({
          category: InvestigationCategory.GAS_MARKET_VOLATILITY,
          severity: gasVariancePct > 10 ? 'high' : gasVariancePct > 5 ? 'medium' : 'low',
          confidence: volatilityAnalysis.confidence,
          description: `Gas cost variance of ${gasVariancePct.toFixed(2)}% detected (simulated: ${simGasCost}, executed: ${execGasCost})`,
          root_cause: `Gas market volatility: ${volatilityAnalysis.volatility_description}`,
          impact_assessment: {
            profit_impact_bps: Math.min(gasVariancePct * 100, 1000), // Cap at 10%
            gas_impact_bps: gasVariancePct * 100,
            timing_impact_ms: 0
          },
          mitigation_suggestions: [
            'Implement real-time gas price monitoring',
            'Use gas price oracles for simulation accuracy',
            'Consider gas price caps in strategy execution',
            'Implement dynamic gas estimation based on network conditions'
          ],
          supporting_data: {
            simulated_gas_cost: simGasCost,
            executed_gas_cost: execGasCost,
            variance_percentage: gasVariancePct,
            gas_volatility: volatilityAnalysis.volatility_metrics,
            market_conditions: volatilityAnalysis.market_analysis
          }
        });
      }

    } catch (error) {
      this.logger.warn('Gas market analysis failed', {
        error: error instanceof Error ? error.message : String(error),
        chain_id: chainId
      });
    }

    return findings;
  }

  /**
   * Timing Slippage Analysis
   * Investigates if variance is due to execution timing differences
   */
  private async investigateTimingSlippage(
    simulationData: SimulationData,
    executionData: ExecutionData | null,
    chainId: ChainId
  ): Promise<InvestigationFindings[]> {
    
    const findings: InvestigationFindings[] = [];

    if (!executionData) {
      return findings;
    }

    try {
      // Calculate timing slippage
      const simTime = new Date(simulationData.simulation_timestamp);
      const execTime = new Date(executionData.execution_timestamp);
      const timingSlippageMs = execTime.getTime() - simTime.getTime();

      if (Math.abs(timingSlippageMs) > this.config.timing_variance_threshold_ms) {
        // Analyze market movements during slippage window
        const marketMovement = await this.analyzeMarketMovementDuringSlippage(
          simulationData,
          executionData,
          chainId,
          timingSlippageMs
        );

        findings.push({
          category: InvestigationCategory.TIMING_SLIPPAGE,
          severity: Math.abs(timingSlippageMs) > 5000 ? 'high' : 'medium',
          confidence: marketMovement.confidence,
          description: `Timing slippage of ${timingSlippageMs}ms detected between simulation and execution`,
          root_cause: `Execution delay caused by ${marketMovement.delay_factors.join(', ')}`,
          impact_assessment: {
            profit_impact_bps: marketMovement.price_impact_bps,
            gas_impact_bps: 0,
            timing_impact_ms: Math.abs(timingSlippageMs)
          },
          mitigation_suggestions: [
            'Optimize execution pipeline latency',
            'Implement more aggressive timeout settings',
            'Consider pre-computed execution paths',
            'Use faster RPC endpoints or local nodes'
          ],
          supporting_data: {
            timing_slippage_ms: timingSlippageMs,
            simulation_time: simulationData.simulation_timestamp,
            execution_time: executionData.execution_timestamp,
            market_movement: marketMovement.analysis,
            price_changes: marketMovement.price_changes
          }
        });
      }

    } catch (error) {
      this.logger.warn('Timing slippage analysis failed', {
        error: error instanceof Error ? error.message : String(error),
        chain_id: chainId
      });
    }

    return findings;
  }

  /**
   * Liquidity Changes Analysis
   * Investigates if variance is due to liquidity pool changes between sim and execution
   */
  private async investigateLiquidityChanges(
    simulationData: SimulationData,
    executionData: ExecutionData | null,
    chainId: ChainId,
    strategy: Strategy
  ): Promise<InvestigationFindings[]> {
    
    const findings: InvestigationFindings[] = [];

    try {
      // Extract pool information from simulation data
      const poolData = this.extractPoolDataFromSimulation(simulationData, strategy);
      
      if (!poolData || poolData.length === 0) {
        return findings;
      }

      // Analyze liquidity changes for each pool involved
      for (const pool of poolData) {
        const liquidityAnalysis = await this.analyzeLiquidityChanges(
          pool,
          simulationData.simulation_timestamp,
          executionData?.execution_timestamp,
          chainId
        );

        if (liquidityAnalysis.significant_change) {
          findings.push({
            category: InvestigationCategory.LIQUIDITY_CHANGES,
            severity: liquidityAnalysis.severity,
            confidence: liquidityAnalysis.confidence,
            description: `Significant liquidity change detected in ${pool.pool_address}: ${liquidityAnalysis.change_description}`,
            root_cause: `Liquidity pool changes: ${liquidityAnalysis.change_factors.join(', ')}`,
            impact_assessment: {
              profit_impact_bps: liquidityAnalysis.profit_impact_bps,
              gas_impact_bps: 0,
              timing_impact_ms: 0
            },
            mitigation_suggestions: [
              'Implement real-time liquidity monitoring',
              'Use multiple liquidity sources for diversification',
              'Consider liquidity depth in strategy selection',
              'Implement dynamic slippage tolerance based on liquidity'
            ],
            supporting_data: {
              pool_address: pool.pool_address,
              token_pair: pool.token_pair,
              liquidity_before: liquidityAnalysis.liquidity_before,
              liquidity_after: liquidityAnalysis.liquidity_after,
              change_percentage: liquidityAnalysis.change_percentage,
              large_transactions: liquidityAnalysis.large_transactions
            }
          });
        }
      }

    } catch (error) {
      this.logger.warn('Liquidity changes analysis failed', {
        error: error instanceof Error ? error.message : String(error),
        chain_id: chainId
      });
    }

    return findings;
  }

  // Helper methods for investigation logic

  private shouldInvestigateMEV(variance: VarianceAnalysisResult): boolean {
    return variance.profit_variance_bps > this.config.profit_variance_threshold_bps;
  }

  private shouldInvestigateNetwork(variance: VarianceAnalysisResult): boolean {
    return variance.gas_variance_bps > this.config.gas_variance_threshold_bps ||
           variance.timing_variance_ms > this.config.timing_variance_threshold_ms;
  }

  private shouldInvestigateGas(variance: VarianceAnalysisResult): boolean {
    return variance.gas_variance_bps > this.config.gas_variance_threshold_bps;
  }

  private shouldInvestigateTiming(variance: VarianceAnalysisResult): boolean {
    return variance.timing_variance_ms > this.config.timing_variance_threshold_ms;
  }

  private shouldInvestigateLiquidity(variance: VarianceAnalysisResult): boolean {
    return variance.profit_variance_bps > this.config.profit_variance_threshold_bps;
  }

  private generateInvestigationId(): string {
    return `inv_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * Initialize investigation record in database
   */
  private async initializeInvestigation(
    investigationId: string,
    simulationData: SimulationData,
    executionData: ExecutionData | null,
    varianceResult: VarianceAnalysisResult,
    strategy: Strategy,
    chainId: ChainId
  ): Promise<DeviationInvestigation> {
    
    const investigation: DeviationInvestigation = {
      investigation_id: investigationId,
      reconciliation_id: `${simulationData.simulation_id}_${chainId}_${strategy}`,
      investigation_timestamp: new Date().toISOString(),
      trigger_reason: this.determineTriggerReason(varianceResult),
      investigation_status: 'in_progress',
      findings: [],
      root_cause_analysis: null,
      recommended_actions: [],
      confidence_score: 0,
      investigation_duration_ms: 0,
      metadata: {
        strategy,
        chain_id: chainId,
        simulation_id: simulationData.simulation_id,
        execution_id: executionData?.execution_id || null,
        variance_scores: {
          profit_variance_bps: varianceResult.profit_variance_bps,
          gas_variance_bps: varianceResult.gas_variance_bps,
          timing_variance_ms: varianceResult.timing_variance_ms,
          overall_parity_score: varianceResult.overall_parity_score
        }
      }
    };

    // Store initial investigation record
    await this.storeInvestigation(investigation);
    
    return investigation;
  }

  /**
   * Finalize investigation with findings and store results
   */
  private async finalizeInvestigation(
    investigation: DeviationInvestigation,
    findings: InvestigationFindings[]
  ): Promise<DeviationInvestigation> {
    
    const startTime = new Date(investigation.investigation_timestamp).getTime();
    const endTime = Date.now();
    
    // Calculate overall confidence score
    const confidenceScore = findings.length > 0 ?
      findings.reduce((sum, f) => sum + f.confidence, 0) / findings.length : 0;

    // Generate root cause analysis
    const rootCauseAnalysis = this.generateRootCauseAnalysis(findings);
    
    // Generate recommended actions
    const recommendedActions = this.generateRecommendedActions(findings);

    // Update investigation
    investigation.investigation_status = 'completed';
    investigation.findings = findings;
    investigation.root_cause_analysis = rootCauseAnalysis;
    investigation.recommended_actions = recommendedActions;
    investigation.confidence_score = confidenceScore;
    investigation.investigation_duration_ms = endTime - startTime;

    // Store final investigation
    await this.storeInvestigation(investigation);

    return investigation;
  }

  // Placeholder methods for data retrieval (to be implemented with actual data sources)
  
  private async getMEVCompetitionData(
    timestamp: string, 
    chainId: ChainId, 
    blockWindow: number
  ): Promise<MEVCompetitionData | null> {
    // TODO: Implement actual MEV data retrieval
    // This would query MEV-Boost data, flashbots data, or similar sources
    return null;
  }

  private async getNetworkConditions(
    timestamp: string,
    chainId: ChainId,
    blockWindow: number
  ): Promise<NetworkConditionSnapshot[] | null> {
    // TODO: Implement actual network data retrieval
    // This would query node APIs, block explorers, or network monitoring services
    return null;
  }

  private async getGasMarketHistory(
    timestamp: string,
    chainId: ChainId,
    blocks: number
  ): Promise<any> {
    // TODO: Implement gas market data retrieval
    return null;
  }

  // Additional placeholder methods for analysis logic
  private analyzeMEVCompetitionIntensity(mevData: MEVCompetitionData): any {
    // TODO: Implement MEV competition analysis
    return { is_high_competition: false, severity: 'low', confidence: 0.5, competition_factors: [] };
  }

  private calculateMEVProfitImpact(simData: SimulationData, execData: ExecutionData, mevData: MEVCompetitionData): number {
    // TODO: Implement MEV profit impact calculation
    return 0;
  }

  private calculateMEVGasImpact(mevData: MEVCompetitionData): number {
    // TODO: Implement MEV gas impact calculation  
    return 0;
  }

  private calculateMEVTimingImpact(mevData: MEVCompetitionData): number {
    // TODO: Implement MEV timing impact calculation
    return 0;
  }

  private analyzeNetworkCongestion(conditions: NetworkConditionSnapshot[]): any {
    // TODO: Implement network congestion analysis
    return { 
      is_congested: false, 
      severity: 'low', 
      confidence: 0.5, 
      congestion_factors: [],
      avg_utilization: 0,
      peak_utilization: 0,
      avg_gas_price_gwei: 0,
      avg_finality_time_ms: 0,
      finality_delay_ms: 0,
      congestion_duration_blocks: 0
    };
  }

  private calculateNetworkProfitImpact(analysis: any): number {
    return 0;
  }

  private calculateNetworkGasImpact(analysis: any): number {
    return 0;
  }

  private analyzeGasVolatility(gasHistory: any): any {
    return { 
      confidence: 0.5, 
      volatility_description: '', 
      volatility_metrics: {}, 
      market_analysis: {} 
    };
  }

  private async analyzeMarketMovementDuringSlippage(
    simData: SimulationData,
    execData: ExecutionData,
    chainId: ChainId,
    slippageMs: number
  ): Promise<any> {
    return { 
      confidence: 0.5, 
      delay_factors: [], 
      price_impact_bps: 0, 
      analysis: {}, 
      price_changes: {} 
    };
  }

  private extractPoolDataFromSimulation(simData: SimulationData, strategy: Strategy): any[] {
    // TODO: Extract pool information from simulation data
    return [];
  }

  private async analyzeLiquidityChanges(
    pool: any,
    simTime: string,
    execTime: string | undefined,
    chainId: ChainId
  ): Promise<any> {
    return {
      significant_change: false,
      severity: 'low',
      confidence: 0.5,
      change_description: '',
      change_factors: [],
      profit_impact_bps: 0,
      liquidity_before: 0,
      liquidity_after: 0,
      change_percentage: 0,
      large_transactions: []
    };
  }

  private determineTriggerReason(variance: VarianceAnalysisResult): string {
    const reasons = [];
    
    if (variance.profit_variance_bps > this.config.profit_variance_threshold_bps) {
      reasons.push(`profit_variance_${variance.profit_variance_bps}bps`);
    }
    if (variance.gas_variance_bps > this.config.gas_variance_threshold_bps) {
      reasons.push(`gas_variance_${variance.gas_variance_bps}bps`);
    }
    if (variance.timing_variance_ms > this.config.timing_variance_threshold_ms) {
      reasons.push(`timing_variance_${variance.timing_variance_ms}ms`);
    }
    
    return reasons.join(', ');
  }

  private generateRootCauseAnalysis(findings: InvestigationFindings[]): string {
    if (findings.length === 0) {
      return 'No significant variance causes identified within confidence thresholds';
    }

    const highConfidenceFindings = findings.filter(f => 
      f.confidence >= this.config.high_confidence_threshold
    );

    if (highConfidenceFindings.length === 0) {
      return 'Multiple potential causes identified but none with high confidence';
    }

    const primaryCause = highConfidenceFindings.reduce((prev, current) => 
      prev.confidence > current.confidence ? prev : current
    );

    return `Primary cause: ${primaryCause.root_cause} (confidence: ${(primaryCause.confidence * 100).toFixed(1)}%)`;
  }

  private generateRecommendedActions(findings: InvestigationFindings[]): string[] {
    const actions = new Set<string>();
    
    findings.forEach(finding => {
      finding.mitigation_suggestions.forEach(suggestion => {
        actions.add(suggestion);
      });
    });

    return Array.from(actions);
  }

  /**
   * Store investigation in database
   */
  private async storeInvestigation(investigation: DeviationInvestigation): Promise<void> {
    const query = `
      INSERT INTO deviation_investigations (
        investigation_id, reconciliation_id, investigation_timestamp,
        trigger_reason, investigation_status, findings, root_cause_analysis,
        recommended_actions, confidence_score, investigation_duration_ms, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (investigation_id) 
      DO UPDATE SET
        investigation_status = EXCLUDED.investigation_status,
        findings = EXCLUDED.findings,
        root_cause_analysis = EXCLUDED.root_cause_analysis,
        recommended_actions = EXCLUDED.recommended_actions,
        confidence_score = EXCLUDED.confidence_score,
        investigation_duration_ms = EXCLUDED.investigation_duration_ms,
        metadata = EXCLUDED.metadata
    `;

    await this.pool.query(query, [
      investigation.investigation_id,
      investigation.reconciliation_id,
      investigation.investigation_timestamp,
      investigation.trigger_reason,
      investigation.investigation_status,
      JSON.stringify(investigation.findings),
      investigation.root_cause_analysis,
      JSON.stringify(investigation.recommended_actions),
      investigation.confidence_score,
      investigation.investigation_duration_ms,
      JSON.stringify(investigation.metadata)
    ]);
  }
}
import { v4 as uuidv4 } from 'uuid';
import { Decimal } from 'decimal.js';
import pino from 'pino';
import { config } from '@/config';
import { DatabaseManager } from '@/models/database';
import {
  ExecutionEvent,
  ReconciliationRecord,
  VarianceInvestigation,
  CreateExecutionEventRequest,
} from '@/types/reconciliation';

// =============================================================================
// RECONCILIATION ENGINE SERVICE
// =============================================================================

export class ReconciliationEngine {
  private logger: pino.Logger;
  private database: DatabaseManager;
  private pendingEvents: Map<string, ExecutionEvent[]> = new Map(); // bundle_id -> events
  private processingQueue: Set<string> = new Set(); // bundle_ids being processed

  constructor(database: DatabaseManager, logger: pino.Logger) {
    this.logger = logger.child({ service: 'reconciliation-engine' });
    this.database = database;
    
    if (config.reconciliation.batch_processing_enabled) {
      this.startBatchProcessor();
    }
  }

  /**
   * Process new execution event
   */
  async processExecutionEvent(eventRequest: CreateExecutionEventRequest): Promise<ExecutionEvent> {
    const eventId = uuidv4();
    const now = new Date();

    try {
      // Validate Real-Only policy
      this.validateRealOnlyPolicy(eventRequest);

      // Calculate total gas cost
      const totalGasCost = new Decimal(eventRequest.gas_used)
        .mul(new Decimal(eventRequest.gas_price_wei))
        .toString();

      // Create execution event
      const executionEvent: ExecutionEvent = {
        event_id: eventId,
        event_type: eventRequest.event_type,
        strategy_id: eventRequest.strategy_id,
        bundle_id: eventRequest.bundle_id,
        transaction_hash: eventRequest.transaction_hash,
        block_number: eventRequest.block_number,
        timestamp: now,
        expected_profit_wei: eventRequest.expected_profit_wei,
        actual_profit_wei: eventRequest.actual_profit_wei,
        gas_used: eventRequest.gas_used,
        gas_price_wei: eventRequest.gas_price_wei,
        total_gas_cost_wei: totalGasCost,
        eth_price_usd: eventRequest.eth_price_usd,
        token_prices: eventRequest.token_prices,
        relay_provider: eventRequest.relay_provider,
        slippage_bps: eventRequest.slippage_bps,
        chain_id: eventRequest.chain_id,
        dex_venues: eventRequest.dex_venues,
        token_addresses: eventRequest.token_addresses,
        execution_source: eventRequest.execution_source,
        created_at: now,
      };

      // Store event in database
      await this.database.insertExecutionEvent(executionEvent);

      // Add to pending events for reconciliation
      if (!this.pendingEvents.has(eventRequest.bundle_id)) {
        this.pendingEvents.set(eventRequest.bundle_id, []);
      }
      this.pendingEvents.get(eventRequest.bundle_id)!.push(executionEvent);

      // Trigger reconciliation if auto-reconciliation is enabled
      if (config.reconciliation.auto_reconciliation_enabled) {
        setTimeout(async () => {
          await this.attemptReconciliation(eventRequest.bundle_id);
        }, config.reconciliation.reconciliation_delay_ms);
      }

      this.logger.info({
        event_id: eventId,
        bundle_id: eventRequest.bundle_id,
        event_type: eventRequest.event_type,
        strategy_id: eventRequest.strategy_id,
      }, 'Execution event processed');

      return executionEvent;
    } catch (error) {
      this.logger.error({
        event_id: eventId,
        bundle_id: eventRequest.bundle_id,
        error: error.message,
      }, 'Failed to process execution event');
      throw error;
    }
  }

  /**
   * Attempt reconciliation for a bundle
   */
  async attemptReconciliation(bundleId: string): Promise<ReconciliationRecord | null> {
    // Prevent concurrent processing of the same bundle
    if (this.processingQueue.has(bundleId)) {
      this.logger.debug({ bundle_id: bundleId }, 'Bundle already being processed');
      return null;
    }

    this.processingQueue.add(bundleId);

    try {
      // Get all events for this bundle
      const events = await this.database.getExecutionEventsByBundleId(bundleId);
      
      if (events.length < 2) {
        this.logger.debug({ 
          bundle_id: bundleId, 
          event_count: events.length 
        }, 'Insufficient events for reconciliation');
        return null;
      }

      // Find simulation and execution events
      const simulationEvent = events.find(e => e.event_type === 'simulation');
      const executionEvent = events.find(e => e.event_type === 'execution' || e.event_type === 'bundle_inclusion');

      if (!simulationEvent || !executionEvent) {
        this.logger.debug({
          bundle_id: bundleId,
          has_simulation: !!simulationEvent,
          has_execution: !!executionEvent,
        }, 'Missing required events for reconciliation');
        return null;
      }

      // Perform reconciliation
      const reconciliationRecord = await this.performReconciliation(simulationEvent, executionEvent);

      // Store reconciliation record
      await this.database.insertReconciliationRecord(reconciliationRecord);

      // Check if investigation is required
      if (reconciliationRecord.requires_investigation && config.reconciliation.auto_investigation_enabled) {
        await this.createInvestigation(reconciliationRecord);
      }

      // Clean up processed events from memory
      this.pendingEvents.delete(bundleId);

      this.logger.info({
        bundle_id: bundleId,
        record_id: reconciliationRecord.record_id,
        reconciliation_status: reconciliationRecord.reconciliation_status,
        profit_variance_percentage: reconciliationRecord.profit_variance_percentage,
        requires_investigation: reconciliationRecord.requires_investigation,
      }, 'Reconciliation completed');

      return reconciliationRecord;
    } catch (error) {
      this.logger.error({
        bundle_id: bundleId,
        error: error.message,
      }, 'Failed to perform reconciliation');
      throw error;
    } finally {
      this.processingQueue.delete(bundleId);
    }
  }

  /**
   * Perform reconciliation between simulation and execution
   */
  private async performReconciliation(
    simulationEvent: ExecutionEvent,
    executionEvent: ExecutionEvent
  ): Promise<ReconciliationRecord> {
    const recordId = uuidv4();
    const now = new Date();

    // Calculate variances
    const simulatedProfit = new Decimal(simulationEvent.actual_profit_wei);
    const actualProfit = new Decimal(executionEvent.actual_profit_wei);
    const profitVariance = actualProfit.minus(simulatedProfit);
    const profitVariancePercentage = simulatedProfit.isZero() 
      ? 0 
      : profitVariance.dividedBy(simulatedProfit).times(100).toNumber();

    const simulatedGasCost = new Decimal(simulationEvent.total_gas_cost_wei);
    const actualGasCost = new Decimal(executionEvent.total_gas_cost_wei);
    const gasVariance = actualGasCost.minus(simulatedGasCost);
    const gasVariancePercentage = simulatedGasCost.isZero() 
      ? 0 
      : gasVariance.dividedBy(simulatedGasCost).times(100).toNumber();

    // Determine reconciliation status
    const profitThreshold = config.reconciliation.default_profit_threshold_percentage;
    const gasThreshold = config.reconciliation.default_gas_threshold_percentage;
    
    let reconciliationStatus: ReconciliationRecord['reconciliation_status'];
    let requiresInvestigation = false;

    if (Math.abs(profitVariancePercentage) <= profitThreshold && Math.abs(gasVariancePercentage) <= gasThreshold) {
      reconciliationStatus = 'variance_within_threshold';
    } else if (Math.abs(profitVariancePercentage) > config.reconciliation.critical_variance_threshold_percentage) {
      reconciliationStatus = 'significant_variance';
      requiresInvestigation = true;
    } else {
      reconciliationStatus = 'matched';
    }

    // Determine variance category
    const varianceCategory = this.determineVarianceCategory(
      profitVariancePercentage,
      gasVariancePercentage,
      simulationEvent,
      executionEvent
    );

    // Calculate USD impacts
    const ethPrice = executionEvent.eth_price_usd;
    const profitImpactUsd = profitVariance.dividedBy(new Decimal(10).pow(18)).times(ethPrice).toNumber();
    const gasImpactUsd = gasVariance.dividedBy(new Decimal(10).pow(18)).times(ethPrice).toNumber();
    const totalImpactUsd = profitImpactUsd + gasImpactUsd;

    // Check investigation thresholds
    if (!requiresInvestigation) {
      const varianceThreshold = config.reconciliation.investigation_variance_threshold;
      const usdThreshold = config.reconciliation.investigation_threshold_usd;
      
      if (Math.abs(profitVariancePercentage) > varianceThreshold || 
          Math.abs(totalImpactUsd) > usdThreshold) {
        requiresInvestigation = true;
      }
    }

    return {
      record_id: recordId,
      bundle_id: simulationEvent.bundle_id,
      strategy_id: simulationEvent.strategy_id,
      
      simulation_event_id: simulationEvent.event_id,
      simulated_profit_wei: simulationEvent.actual_profit_wei,
      simulated_gas_cost_wei: simulationEvent.total_gas_cost_wei,
      simulation_timestamp: simulationEvent.timestamp,
      
      execution_event_id: executionEvent.event_id,
      actual_profit_wei: executionEvent.actual_profit_wei,
      actual_gas_cost_wei: executionEvent.total_gas_cost_wei,
      execution_timestamp: executionEvent.timestamp,
      
      profit_variance_wei: profitVariance.toString(),
      profit_variance_percentage: profitVariancePercentage,
      gas_variance_wei: gasVariance.toString(),
      gas_variance_percentage: gasVariancePercentage,
      
      reconciliation_status: reconciliationStatus,
      variance_category: varianceCategory,
      requires_investigation: requiresInvestigation,
      
      profit_threshold_percentage: profitThreshold,
      gas_threshold_percentage: gasThreshold,
      
      profit_impact_usd: profitImpactUsd,
      gas_impact_usd: gasImpactUsd,
      total_impact_usd: totalImpactUsd,
      
      created_at: now,
    };
  }

  /**
   * Determine variance category based on analysis
   */
  private determineVarianceCategory(
    profitVariancePercentage: number,
    gasVariancePercentage: number,
    simulationEvent: ExecutionEvent,
    executionEvent: ExecutionEvent
  ): ReconciliationRecord['variance_category'] {
    // Gas price changed significantly
    if (Math.abs(gasVariancePercentage) > 20) {
      const simGasPrice = new Decimal(simulationEvent.gas_price_wei);
      const execGasPrice = new Decimal(executionEvent.gas_price_wei);
      const gasPriceVariance = execGasPrice.minus(simGasPrice).dividedBy(simGasPrice).times(100).toNumber();
      
      if (Math.abs(gasPriceVariance) > 15) {
        return 'gas_price_change';
      }
    }

    // Slippage occurred
    if (executionEvent.slippage_bps && executionEvent.slippage_bps > 100) { // >1%
      return 'slippage';
    }

    // MEV competition
    if (executionEvent.mev_extracted_wei && new Decimal(executionEvent.mev_extracted_wei).gt(0)) {
      return 'mev_competition';
    }

    // Market movement (significant profit variance without gas issues)
    if (Math.abs(profitVariancePercentage) > 10 && Math.abs(gasVariancePercentage) < 5) {
      return 'market_movement';
    }

    // Execution error (negative profit when positive was expected)
    const expectedProfit = new Decimal(executionEvent.expected_profit_wei);
    const actualProfit = new Decimal(executionEvent.actual_profit_wei);
    
    if (expectedProfit.gt(0) && actualProfit.lt(0)) {
      return 'execution_error';
    }

    return 'unknown';
  }

  /**
   * Create investigation for significant variance
   */
  private async createInvestigation(reconciliationRecord: ReconciliationRecord): Promise<void> {
    try {
      const investigation: VarianceInvestigation = {
        investigation_id: uuidv4(),
        record_id: reconciliationRecord.record_id,
        bundle_id: reconciliationRecord.bundle_id,
        
        investigator: 'system',
        priority: this.determinePriority(reconciliationRecord),
        status: 'open',
        
        variance_type: Math.abs(reconciliationRecord.profit_variance_percentage) > Math.abs(reconciliationRecord.gas_variance_percentage) 
          ? 'profit_variance' 
          : 'gas_variance',
        variance_magnitude_usd: Math.abs(reconciliationRecord.total_impact_usd),
        impact_assessment: this.determineImpactAssessment(reconciliationRecord.total_impact_usd),
        
        suspected_causes: this.generateSuspectedCauses(reconciliationRecord),
        findings: [],
        recommended_actions: [],
        
        created_at: new Date(),
      };

      // Here you would insert into investigations table
      // For now, we'll just log it
      this.logger.info({
        investigation_id: investigation.investigation_id,
        bundle_id: reconciliationRecord.bundle_id,
        variance_magnitude_usd: investigation.variance_magnitude_usd,
        priority: investigation.priority,
      }, 'Investigation created for variance');
    } catch (error) {
      this.logger.error({
        record_id: reconciliationRecord.record_id,
        error: error.message,
      }, 'Failed to create investigation');
    }
  }

  /**
   * Determine investigation priority
   */
  private determinePriority(record: ReconciliationRecord): VarianceInvestigation['priority'] {
    const usdImpact = Math.abs(record.total_impact_usd);
    const variancePercentage = Math.max(
      Math.abs(record.profit_variance_percentage),
      Math.abs(record.gas_variance_percentage)
    );

    if (usdImpact > 1000 || variancePercentage > 100) {
      return 'critical';
    } else if (usdImpact > 500 || variancePercentage > 50) {
      return 'high';
    } else if (usdImpact > 100 || variancePercentage > 20) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Determine impact assessment
   */
  private determineImpactAssessment(usdImpact: number): VarianceInvestigation['impact_assessment'] {
    const absImpact = Math.abs(usdImpact);
    
    if (absImpact > 10000) return 'critical';
    if (absImpact > 1000) return 'major';
    if (absImpact > 100) return 'moderate';
    if (absImpact > 10) return 'minor';
    return 'negligible';
  }

  /**
   * Generate suspected causes based on variance category and data
   */
  private generateSuspectedCauses(record: ReconciliationRecord): VarianceInvestigation['suspected_causes'] {
    const causes: VarianceInvestigation['suspected_causes'] = [];

    switch (record.variance_category) {
      case 'gas_price_change':
        causes.push('gas_price_spike', 'network_congestion');
        break;
      case 'slippage':
        causes.push('slippage_exceeded', 'liquidity_shortage');
        break;
      case 'mev_competition':
        causes.push('mev_frontrunning');
        break;
      case 'market_movement':
        causes.push('market_volatility');
        break;
      case 'execution_error':
        causes.push('smart_contract_error', 'simulation_inaccuracy');
        break;
      default:
        causes.push('other');
    }

    return causes;
  }

  /**
   * Validate Real-Only policy
   */
  private validateRealOnlyPolicy(eventRequest: CreateExecutionEventRequest): void {
    if (!config.real_only.enabled) {
      return;
    }

    // Validate chain ID
    if (config.real_only.enforce_mainnet_only && eventRequest.chain_id !== 1) {
      if (!config.real_only.allowed_test_chains.includes(eventRequest.chain_id)) {
        throw new Error(`Real-Only policy: Chain ${eventRequest.chain_id} not allowed`);
      }
    }

    // Validate transaction hash if provided
    if (config.real_only.validate_transaction_hashes && eventRequest.transaction_hash) {
      if (!/^0x[a-fA-F0-9]{64}$/.test(eventRequest.transaction_hash)) {
        throw new Error(`Real-Only policy: Invalid transaction hash format`);
      }
    }

    // Validate prices are real
    if (config.real_only.require_real_prices) {
      if (eventRequest.eth_price_usd <= 0 || eventRequest.eth_price_usd > 100000) {
        throw new Error(`Real-Only policy: ETH price ${eventRequest.eth_price_usd} appears synthetic`);
      }
    }

    // Block synthetic events
    if (config.real_only.block_synthetic_events) {
      if (eventRequest.execution_source === 'manual' && !eventRequest.transaction_hash) {
        throw new Error(`Real-Only policy: Manual events require transaction hash`);
      }
    }
  }

  /**
   * Start batch processor for pending reconciliations
   */
  private startBatchProcessor(): void {
    setInterval(async () => {
      await this.processBatch();
    }, config.reconciliation.batch_interval_ms);

    this.logger.info({
      batch_size: config.reconciliation.batch_size,
      batch_interval_ms: config.reconciliation.batch_interval_ms,
    }, 'Batch processor started');
  }

  /**
   * Process batch of pending reconciliations
   */
  private async processBatch(): Promise<void> {
    try {
      const bundleIds = Array.from(this.pendingEvents.keys()).slice(0, config.reconciliation.batch_size);
      
      if (bundleIds.length === 0) {
        return;
      }

      this.logger.debug({ batch_size: bundleIds.length }, 'Processing reconciliation batch');

      const promises = bundleIds.map(bundleId => this.attemptReconciliation(bundleId));
      const results = await Promise.allSettled(promises);

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      this.logger.info({
        batch_size: bundleIds.length,
        successful,
        failed,
      }, 'Reconciliation batch completed');
    } catch (error) {
      this.logger.error({ error: error.message }, 'Failed to process reconciliation batch');
    }
  }

  /**
   * Get reconciliation statistics
   */
  async getReconciliationStats(timeRange: { start: Date; end: Date }): Promise<{
    total_reconciliations: number;
    successful_reconciliations: number;
    variance_within_threshold: number;
    significant_variances: number;
    investigations_required: number;
    avg_profit_variance_percentage: number;
    avg_gas_variance_percentage: number;
  }> {
    try {
      const { records } = await this.database.getReconciliationRecords({
        start_date: timeRange.start,
        end_date: timeRange.end,
        limit: 10000, // Get all for accurate statistics
      });

      const total = records.length;
      const successful = records.filter(r => r.reconciliation_status === 'matched' || r.reconciliation_status === 'variance_within_threshold').length;
      const withinThreshold = records.filter(r => r.reconciliation_status === 'variance_within_threshold').length;
      const significantVariances = records.filter(r => r.reconciliation_status === 'significant_variance').length;
      const investigationsRequired = records.filter(r => r.requires_investigation).length;

      const avgProfitVariance = total > 0 
        ? records.reduce((sum, r) => sum + Math.abs(r.profit_variance_percentage), 0) / total 
        : 0;
      
      const avgGasVariance = total > 0 
        ? records.reduce((sum, r) => sum + Math.abs(r.gas_variance_percentage), 0) / total 
        : 0;

      return {
        total_reconciliations: total,
        successful_reconciliations: successful,
        variance_within_threshold: withinThreshold,
        significant_variances: significantVariances,
        investigations_required: investigationsRequired,
        avg_profit_variance_percentage: avgProfitVariance,
        avg_gas_variance_percentage: avgGasVariance,
      };
    } catch (error) {
      this.logger.error({ error: error.message }, 'Failed to get reconciliation stats');
      throw error;
    }
  }

  /**
   * Shutdown reconciliation engine
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down reconciliation engine');
    
    // Clear pending events
    this.pendingEvents.clear();
    this.processingQueue.clear();
    
    this.logger.info('Reconciliation engine shutdown complete');
  }
}
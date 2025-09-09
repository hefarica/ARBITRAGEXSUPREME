import { Pool } from 'pg';
import Redis from 'ioredis';
import winston from 'winston';
import Decimal from 'decimal.js';
import { v4 as uuidv4 } from 'uuid';
import _ from 'lodash';
import {
  ReconciliationRequest,
  ReconciliationResult,
  ReconciliationConfig,
  ExecutionEventV1,
  Strategy,
  DeviationInvestigation
} from '../types/reconciliation.js';
import { VarianceAnalyzer } from './varianceAnalyzer.js';
import { DeviationInvestigator } from './deviationInvestigator.js';

export class ReconciliationEngine {
  private db: Pool;
  private redis: Redis;
  private logger: winston.Logger;
  private config: ReconciliationConfig;
  private varianceAnalyzer: VarianceAnalyzer;
  private deviationInvestigator: DeviationInvestigator;

  constructor(
    db: Pool,
    redis: Redis,
    logger: winston.Logger,
    config?: ReconciliationConfig
  ) {
    this.db = db;
    this.redis = redis;
    this.logger = logger;
    this.config = config || {
      minor_variance_threshold: 0.02, // 2%
      significant_variance_threshold: 0.05, // 5%
      major_discrepancy_threshold: 0.15, // 15%
      auto_investigate_threshold: 0.05, // 5%
      investigation_timeout_minutes: 30,
      max_investigation_depth: 5,
      alert_on_major_discrepancy: true,
      alert_on_investigation_failure: true,
      parity_drift_alert_threshold: 0.10, // 10%
      retention_days: 90,
      archive_after_days: 30,
      real_only: true
    };

    this.varianceAnalyzer = new VarianceAnalyzer(logger, this.config);
    this.deviationInvestigator = new DeviationInvestigator(db, redis, logger, this.config);
    
    this.initializeDatabase();
  }

  /**
   * Inicializar esquema de base de datos
   */
  private async initializeDatabase(): Promise<void> {
    try {
      await this.db.query(`
        -- Tabla principal de reconciliaciones
        CREATE TABLE IF NOT EXISTS reconciliations (
          reconciliation_id UUID PRIMARY KEY,
          strategy VARCHAR(10) NOT NULL,
          chain_id INTEGER NOT NULL,
          simulation_id UUID NOT NULL,
          bundle_id UUID,
          transaction_hash VARCHAR(66),
          
          -- Datos de simulación
          sim_gross_profit_eth DECIMAL(30,18) NOT NULL,
          sim_net_profit_eth DECIMAL(30,18) NOT NULL,
          sim_gas_used BIGINT NOT NULL,
          sim_gas_price_gwei DECIMAL(30,9) NOT NULL,
          sim_execution_time_ms INTEGER NOT NULL,
          sim_block_number BIGINT NOT NULL,
          sim_success BOOLEAN NOT NULL,
          sim_hash VARCHAR(64),
          
          -- Datos de ejecución real
          exec_actual_profit_eth DECIMAL(30,18),
          exec_gas_used BIGINT,
          exec_gas_price_gwei DECIMAL(30,9),
          exec_inclusion_block BIGINT,
          exec_inclusion_delay_blocks INTEGER DEFAULT 0,
          exec_status VARCHAR(20),
          exec_relay_used VARCHAR(50),
          
          -- Análisis de varianza
          profit_variance_percentage DECIMAL(8,4),
          profit_difference_eth DECIMAL(30,18),
          gas_variance_percentage DECIMAL(8,4),
          gas_difference BIGINT,
          execution_delay_ms BIGINT DEFAULT 0,
          block_delay INTEGER DEFAULT 0,
          parity_score DECIMAL(5,2),
          reconciliation_status VARCHAR(20),
          
          -- Investigación
          investigation_required BOOLEAN DEFAULT FALSE,
          investigation_id UUID,
          deviation_causes JSONB DEFAULT '[]',
          
          -- Metadata
          processing_time_ms INTEGER NOT NULL,
          data_quality_score DECIMAL(5,2) DEFAULT 100,
          confidence_level DECIMAL(5,2) DEFAULT 100,
          alerts_triggered JSONB DEFAULT '[]',
          requires_attention BOOLEAN DEFAULT FALSE,
          
          -- Timestamps
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          
          -- Índices para queries frecuentes
          CONSTRAINT valid_strategy CHECK (strategy IN ('A', 'C', 'D', 'F')),
          CONSTRAINT valid_status CHECK (reconciliation_status IN ('perfect_match', 'minor_variance', 'significant_variance', 'major_discrepancy'))
        );

        -- Índices para performance
        CREATE INDEX IF NOT EXISTS idx_reconciliations_strategy_created ON reconciliations(strategy, created_at);
        CREATE INDEX IF NOT EXISTS idx_reconciliations_chain_created ON reconciliations(chain_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_reconciliations_status ON reconciliations(reconciliation_status);
        CREATE INDEX IF NOT EXISTS idx_reconciliations_investigation ON reconciliations(investigation_required, investigation_id);
        CREATE INDEX IF NOT EXISTS idx_reconciliations_sim_id ON reconciliations(simulation_id);
        CREATE INDEX IF NOT EXISTS idx_reconciliations_tx_hash ON reconciliations(transaction_hash);

        -- Tabla de eventos canónicos execution_v1
        CREATE TABLE IF NOT EXISTS execution_events_v1 (
          event_id UUID PRIMARY KEY,
          reconciliation_id UUID REFERENCES reconciliations(reconciliation_id),
          event_type VARCHAR(20) DEFAULT 'execution_v1',
          version VARCHAR(10) DEFAULT '1.0.0',
          strategy VARCHAR(10) NOT NULL,
          chain_id INTEGER NOT NULL,
          bundle_id UUID,
          simulation_id UUID,
          transaction_hash VARCHAR(66),
          
          -- Datos del evento completo (JSONB para flexibilidad)
          event_data JSONB NOT NULL,
          
          -- Metadata de procesamiento
          source_system VARCHAR(50) NOT NULL,
          processing_node VARCHAR(100),
          correlation_id UUID,
          
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          
          CONSTRAINT valid_event_strategy CHECK (strategy IN ('A', 'C', 'D', 'F'))
        );

        CREATE INDEX IF NOT EXISTS idx_execution_events_strategy_created ON execution_events_v1(strategy, created_at);
        CREATE INDEX IF NOT EXISTS idx_execution_events_chain_created ON execution_events_v1(chain_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_execution_events_sim_id ON execution_events_v1(simulation_id);

        -- Tabla de investigaciones de desviaciones
        CREATE TABLE IF NOT EXISTS deviation_investigations (
          investigation_id UUID PRIMARY KEY,
          reconciliation_id UUID REFERENCES reconciliations(reconciliation_id),
          strategy VARCHAR(10) NOT NULL,
          investigation_type VARCHAR(20) DEFAULT 'automated',
          priority VARCHAR(10) DEFAULT 'medium',
          assigned_investigator VARCHAR(100),
          
          -- Datos de la desviación
          variance_percentage DECIMAL(8,4) NOT NULL,
          profit_impact_eth DECIMAL(30,18) NOT NULL,
          affected_transactions JSONB DEFAULT '[]',
          time_window JSONB,
          
          -- Proceso y resultados (JSONB para flexibilidad)
          investigation_steps JSONB DEFAULT '[]',
          findings JSONB DEFAULT '[]',
          conclusion JSONB,
          
          status VARCHAR(20) DEFAULT 'pending',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          completed_at TIMESTAMP WITH TIME ZONE,
          
          CONSTRAINT valid_investigation_strategy CHECK (strategy IN ('A', 'C', 'D', 'F')),
          CONSTRAINT valid_investigation_type CHECK (investigation_type IN ('automated', 'manual', 'deep_analysis')),
          CONSTRAINT valid_investigation_status CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'cancelled'))
        );

        CREATE INDEX IF NOT EXISTS idx_investigations_strategy_status ON deviation_investigations(strategy, status);
        CREATE INDEX IF NOT EXISTS idx_investigations_created ON deviation_investigations(created_at);
        CREATE INDEX IF NOT EXISTS idx_investigations_recon_id ON deviation_investigations(reconciliation_id);

        -- Tabla de métricas agregadas por estrategia
        CREATE TABLE IF NOT EXISTS reconciliation_metrics (
          id SERIAL PRIMARY KEY,
          strategy VARCHAR(10) NOT NULL,
          time_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
          time_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
          
          -- Contadores
          total_reconciliations INTEGER DEFAULT 0,
          perfect_matches INTEGER DEFAULT 0,
          minor_variances INTEGER DEFAULT 0,
          significant_variances INTEGER DEFAULT 0,
          major_discrepancies INTEGER DEFAULT 0,
          
          -- Métricas de varianza
          avg_profit_variance DECIMAL(8,4) DEFAULT 0,
          max_profit_variance DECIMAL(8,4) DEFAULT 0,
          avg_gas_variance DECIMAL(8,4) DEFAULT 0,
          max_gas_variance DECIMAL(8,4) DEFAULT 0,
          
          -- Métricas de parity
          overall_parity_score DECIMAL(5,2) DEFAULT 100,
          parity_trend VARCHAR(20) DEFAULT 'unknown',
          parity_drift_rate DECIMAL(8,4) DEFAULT 0,
          
          -- Investigaciones
          investigations_triggered INTEGER DEFAULT 0,
          investigations_completed INTEGER DEFAULT 0,
          root_causes_identified INTEGER DEFAULT 0,
          
          -- Performance
          avg_processing_time_ms DECIMAL(10,2) DEFAULT 0,
          data_quality_score DECIMAL(5,2) DEFAULT 100,
          
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          
          CONSTRAINT valid_metrics_strategy CHECK (strategy IN ('A', 'C', 'D', 'F'))
        );

        CREATE INDEX IF NOT EXISTS idx_metrics_strategy_period ON reconciliation_metrics(strategy, time_period_start, time_period_end);
      `);

      this.logger.info('✅ Esquema de base de datos de reconciliación inicializado');

    } catch (error) {
      this.logger.error('❌ Error inicializando base de datos:', error);
      throw error;
    }
  }

  /**
   * Ejecutar reconciliación completa sim↔exec
   */
  async executeReconciliation(request: ReconciliationRequest): Promise<ReconciliationResult> {
    const startTime = Date.now();
    const reconciliationId = request.reconciliation_id;

    this.logger.info(
      `🔍 Iniciando reconciliación ${reconciliationId} ` +
      `(estrategia ${request.strategy}, chain ${request.chain_id})`
    );

    // Validar Real-Only Policy
    if (!request.real_only) {
      throw new Error('❌ Real-Only Policy Violation: Todas las reconciliaciones deben usar real_only=true');
    }

    try {
      // 1. Análisis de varianza
      const varianceAnalysis = await this.varianceAnalyzer.analyze(
        request.simulation_result,
        request.execution_result
      );

      // 2. Determinar si se requiere investigación
      const investigationRequired = this.shouldInvestigate(varianceAnalysis.profit_variance_percentage);
      let investigation: any = {
        required: investigationRequired,
        status: investigationRequired ? 'pending' : 'not_required',
        deviation_causes: [],
        root_cause_analysis: undefined,
        recommendations: []
      };

      // 3. Ejecutar investigación automática si es necesaria
      if (investigationRequired) {
        try {
          const investigationResult = await this.deviationInvestigator.investigate({
            reconciliation_id: reconciliationId,
            strategy: request.strategy,
            variance_percentage: varianceAnalysis.profit_variance_percentage,
            simulation_result: request.simulation_result,
            execution_result: request.execution_result
          });

          investigation = {
            required: true,
            status: 'completed',
            investigation_id: investigationResult.investigation_id,
            deviation_causes: investigationResult.findings.map(f => ({
              cause_type: f.finding_type,
              description: f.description,
              impact_percentage: f.impact_score,
              confidence: f.confidence
            })),
            root_cause_analysis: investigationResult.conclusion?.root_cause,
            recommendations: investigationResult.conclusion?.recommendations.map(r => r.description) || []
          };

        } catch (error) {
          this.logger.error(`❌ Error en investigación automática ${reconciliationId}:`, error);
          investigation.status = 'failed';
        }
      }

      // 4. Calcular métricas de calidad
      const qualityMetrics = this.calculateQualityMetrics(request);

      // 5. Generar alertas si es necesario
      const alerts = this.generateAlerts(varianceAnalysis, investigation);

      // 6. Crear resultado de reconciliación
      const result: ReconciliationResult = {
        reconciliation_id: reconciliationId,
        strategy: request.strategy,
        chain_id: request.chain_id,
        simulation_id: request.simulation_id,
        bundle_id: request.bundle_id,
        transaction_hash: request.transaction_hash,
        
        variance_analysis: {
          profit_variance_percentage: varianceAnalysis.profit_variance_percentage,
          profit_difference_eth: varianceAnalysis.profit_difference_eth,
          profit_difference_usd: varianceAnalysis.profit_difference_usd,
          gas_variance_percentage: varianceAnalysis.gas_variance_percentage,
          gas_difference: varianceAnalysis.gas_difference,
          gas_cost_difference_eth: varianceAnalysis.gas_cost_difference_eth,
          execution_delay_ms: varianceAnalysis.execution_delay_ms,
          block_delay: varianceAnalysis.block_delay,
          overall_parity_score: varianceAnalysis.overall_parity_score,
          reconciliation_status: varianceAnalysis.reconciliation_status
        },
        
        investigation,
        quality_metrics: qualityMetrics,
        
        processing_time_ms: Date.now() - startTime,
        created_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        
        alerts_triggered: alerts,
        requires_attention: alerts.length > 0 || varianceAnalysis.reconciliation_status === 'major_discrepancy'
      };

      // 7. Generar evento canónico execution_v1
      const executionEvent = await this.generateExecutionEvent(request, result);
      result.execution_event = executionEvent;

      // 8. Persistir en base de datos
      await this.saveReconciliation(result);
      await this.saveExecutionEvent(executionEvent);

      // 9. Actualizar métricas
      await this.updateMetrics(result);

      // 10. Cache en Redis para acceso rápido
      await this.cacheReconciliation(result);

      this.logger.info(
        `✅ Reconciliación ${reconciliationId} completada: ${result.variance_analysis.reconciliation_status} ` +
        `(varianza: ${result.variance_analysis.profit_variance_percentage.toFixed(2)}%, ` +
        `parity: ${result.variance_analysis.overall_parity_score.toFixed(1)}, ` +
        `${result.processing_time_ms}ms)`
      );

      return result;

    } catch (error) {
      const errorResult: ReconciliationResult = {
        reconciliation_id: reconciliationId,
        strategy: request.strategy,
        chain_id: request.chain_id,
        simulation_id: request.simulation_id,
        bundle_id: request.bundle_id,
        transaction_hash: request.transaction_hash,
        
        variance_analysis: {
          profit_variance_percentage: 0,
          profit_difference_eth: "0",
          gas_variance_percentage: 0,
          gas_difference: "0",
          gas_cost_difference_eth: "0",
          execution_delay_ms: 0,
          block_delay: 0,
          overall_parity_score: 0,
          reconciliation_status: 'major_discrepancy'
        },
        
        investigation: {
          required: false,
          status: 'not_required',
          deviation_causes: [],
          recommendations: []
        },
        
        quality_metrics: {
          data_completeness: 0,
          data_accuracy: 0,
          timeliness_score: 0,
          confidence_level: 0
        },
        
        processing_time_ms: Date.now() - startTime,
        created_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        
        alerts_triggered: ['processing_error'],
        requires_attention: true
      };

      await this.cacheReconciliation(errorResult);
      
      this.logger.error(`❌ Error en reconciliación ${reconciliationId}:`, error);
      return errorResult;
    }
  }

  /**
   * Determinar si se requiere investigación automática
   */
  private shouldInvestigate(variancePercentage: number): boolean {
    return Math.abs(variancePercentage) >= this.config.auto_investigate_threshold * 100;
  }

  /**
   * Calcular métricas de calidad de datos
   */
  private calculateQualityMetrics(request: ReconciliationRequest): any {
    let completeness = 100;
    let accuracy = 100;
    let timeliness = 100;

    // Evaluar completeness
    if (!request.execution_result) completeness -= 50;
    if (!request.simulation_result.simulation_hash) completeness -= 10;
    if (!request.bundle_id) completeness -= 5;
    if (!request.transaction_hash) completeness -= 10;

    // Evaluar timeliness (basado en delay de ejecución si está disponible)
    if (request.execution_result?.inclusion_delay_blocks) {
      const delay = request.execution_result.inclusion_delay_blocks;
      if (delay > 5) timeliness -= Math.min(50, delay * 5);
    }

    return {
      data_completeness: Math.max(0, completeness),
      data_accuracy: accuracy,
      timeliness_score: Math.max(0, timeliness),
      confidence_level: Math.min(completeness, accuracy, timeliness)
    };
  }

  /**
   * Generar alertas basadas en análisis
   */
  private generateAlerts(varianceAnalysis: any, investigation: any): string[] {
    const alerts: string[] = [];

    // Alert por varianza mayor
    if (Math.abs(varianceAnalysis.profit_variance_percentage) >= this.config.major_discrepancy_threshold * 100) {
      alerts.push('major_profit_discrepancy');
    }

    // Alert por parity score bajo
    if (varianceAnalysis.overall_parity_score < 70) {
      alerts.push('low_parity_score');
    }

    // Alert por investigación fallida
    if (investigation.required && investigation.status === 'failed') {
      alerts.push('investigation_failure');
    }

    return alerts;
  }

  /**
   * Generar evento canónico execution_v1
   */
  private async generateExecutionEvent(
    request: ReconciliationRequest,
    result: ReconciliationResult
  ): Promise<ExecutionEventV1> {
    const event: ExecutionEventV1 = {
      event_id: uuidv4(),
      event_type: 'execution_v1',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      
      strategy: request.strategy,
      chain_id: request.chain_id,
      bundle_id: request.bundle_id,
      simulation_id: request.simulation_id,
      transaction_hash: request.transaction_hash,
      
      simulation_data: {
        gross_profit_eth: request.simulation_result.gross_profit_eth,
        net_profit_eth: request.simulation_result.net_profit_eth,
        gas_used: request.simulation_result.gas_used,
        gas_price_gwei: request.simulation_result.gas_price_gwei,
        execution_time_ms: request.simulation_result.execution_time_ms,
        success: request.simulation_result.success,
        block_number: request.simulation_result.block_number,
        simulation_hash: request.simulation_result.simulation_hash
      },
      
      execution_data: request.execution_result ? {
        actual_profit_eth: request.execution_result.actual_profit_eth,
        actual_gas_used: request.execution_result.actual_gas_used,
        actual_gas_price_gwei: request.execution_result.actual_gas_price_gwei,
        inclusion_block: request.execution_result.inclusion_block,
        inclusion_delay_blocks: request.execution_result.inclusion_delay_blocks,
        transaction_status: request.execution_result.transaction_status,
        relay_used: request.execution_result.relay_used,
        mev_protection: true
      } : undefined,
      
      reconciliation: {
        variance_percentage: result.variance_analysis.profit_variance_percentage,
        profit_difference_eth: result.variance_analysis.profit_difference_eth,
        gas_difference: result.variance_analysis.gas_difference,
        execution_delay_ms: result.variance_analysis.execution_delay_ms,
        parity_score: result.variance_analysis.overall_parity_score,
        investigation_required: result.investigation.required,
        deviation_causes: result.investigation.deviation_causes.map(dc => dc.description || dc.cause_type),
        reconciliation_status: result.variance_analysis.reconciliation_status,
        confidence_level: result.quality_metrics.confidence_level
      },
      
      metadata: {
        source_system: 'arbitragex-recon-v3',
        processing_node: process.env.HOSTNAME || 'unknown',
        data_quality_score: result.quality_metrics.data_completeness,
        tags: [
          `strategy:${request.strategy}`,
          `status:${result.variance_analysis.reconciliation_status}`,
          ...(result.investigation.required ? ['investigation:required'] : []),
          ...(result.requires_attention ? ['attention:required'] : [])
        ],
        correlation_id: request.bundle_id
      }
    };

    return event;
  }

  /**
   * Persistir reconciliación en base de datos
   */
  private async saveReconciliation(result: ReconciliationResult): Promise<void> {
    const query = `
      INSERT INTO reconciliations (
        reconciliation_id, strategy, chain_id, simulation_id, bundle_id, transaction_hash,
        sim_gross_profit_eth, sim_net_profit_eth, sim_gas_used, sim_gas_price_gwei,
        sim_execution_time_ms, sim_block_number, sim_success, sim_hash,
        exec_actual_profit_eth, exec_gas_used, exec_gas_price_gwei,
        exec_inclusion_block, exec_inclusion_delay_blocks, exec_status, exec_relay_used,
        profit_variance_percentage, profit_difference_eth, gas_variance_percentage,
        gas_difference, execution_delay_ms, block_delay, parity_score, reconciliation_status,
        investigation_required, investigation_id, deviation_causes,
        processing_time_ms, data_quality_score, confidence_level,
        alerts_triggered, requires_attention, created_at, completed_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29,
        $30, $31, $32, $33, $34, $35, $36, $37, $38, $39
      )
    `;

    // Obtener datos de simulación (estos deben venir del request)
    const simData = result.execution_event?.simulation_data;
    const execData = result.execution_event?.execution_data;

    const values = [
      result.reconciliation_id,
      result.strategy,
      result.chain_id,
      result.simulation_id,
      result.bundle_id,
      result.transaction_hash,
      
      // Simulation data
      simData?.gross_profit_eth || '0',
      simData?.net_profit_eth || '0',
      simData?.gas_used || '0',
      simData?.gas_price_gwei || '0',
      simData?.execution_time_ms || 0,
      simData?.block_number || 0,
      simData?.success || false,
      simData?.simulation_hash,
      
      // Execution data
      execData?.actual_profit_eth,
      execData?.actual_gas_used,
      execData?.actual_gas_price_gwei,
      execData?.inclusion_block,
      execData?.inclusion_delay_blocks || 0,
      execData?.transaction_status,
      execData?.relay_used,
      
      // Variance analysis
      result.variance_analysis.profit_variance_percentage,
      result.variance_analysis.profit_difference_eth,
      result.variance_analysis.gas_variance_percentage,
      result.variance_analysis.gas_difference,
      result.variance_analysis.execution_delay_ms,
      result.variance_analysis.block_delay,
      result.variance_analysis.overall_parity_score,
      result.variance_analysis.reconciliation_status,
      
      // Investigation
      result.investigation.required,
      result.investigation.investigation_id,
      JSON.stringify(result.investigation.deviation_causes),
      
      // Metadata
      result.processing_time_ms,
      result.quality_metrics.data_completeness,
      result.quality_metrics.confidence_level,
      JSON.stringify(result.alerts_triggered),
      result.requires_attention,
      result.created_at,
      result.completed_at
    ];

    await this.db.query(query, values);
  }

  /**
   * Persistir evento execution_v1
   */
  private async saveExecutionEvent(event: ExecutionEventV1): Promise<void> {
    const query = `
      INSERT INTO execution_events_v1 (
        event_id, event_type, version, strategy, chain_id, bundle_id,
        simulation_id, transaction_hash, event_data, source_system,
        processing_node, correlation_id, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `;

    const values = [
      event.event_id,
      event.event_type,
      event.version,
      event.strategy,
      event.chain_id,
      event.bundle_id,
      event.simulation_id,
      event.transaction_hash,
      JSON.stringify(event),
      event.metadata.source_system,
      event.metadata.processing_node,
      event.metadata.correlation_id,
      event.timestamp
    ];

    await this.db.query(query, values);
  }

  /**
   * Actualizar métricas agregadas
   */
  private async updateMetrics(result: ReconciliationResult): Promise<void> {
    // Esta implementación sería más compleja en producción
    // Por ahora, solo registramos en logs
    this.logger.debug(
      `📊 Actualizando métricas para estrategia ${result.strategy}: ` +
      `${result.variance_analysis.reconciliation_status}`
    );
  }

  /**
   * Cachear reconciliación en Redis
   */
  private async cacheReconciliation(result: ReconciliationResult): Promise<void> {
    const key = `recon:reconciliation:${result.reconciliation_id}`;
    await this.redis.setex(key, 3600, JSON.stringify(result));
  }

  /**
   * Obtener reconciliación por ID
   */
  async getReconciliation(reconciliationId: string): Promise<ReconciliationResult | null> {
    // Intentar desde cache primero
    const cacheKey = `recon:reconciliation:${reconciliationId}`;
    const cached = await this.redis.get(cacheKey);
    
    if (cached) {
      try {
        return JSON.parse(cached) as ReconciliationResult;
      } catch (error) {
        this.logger.error(`❌ Error parseando reconciliación cached ${reconciliationId}:`, error);
      }
    }

    // Si no está en cache, obtener de base de datos
    const query = `SELECT * FROM reconciliations WHERE reconciliation_id = $1`;
    const result = await this.db.query(query, [reconciliationId]);
    
    if (result.rows.length === 0) {
      return null;
    }

    // Convertir row a ReconciliationResult (implementación simplificada)
    // En producción esto sería más completo
    const row = result.rows[0];
    
    return {
      reconciliation_id: row.reconciliation_id,
      strategy: row.strategy,
      chain_id: row.chain_id,
      simulation_id: row.simulation_id,
      bundle_id: row.bundle_id,
      transaction_hash: row.transaction_hash,
      variance_analysis: {
        profit_variance_percentage: parseFloat(row.profit_variance_percentage || 0),
        profit_difference_eth: row.profit_difference_eth || "0",
        gas_variance_percentage: parseFloat(row.gas_variance_percentage || 0),
        gas_difference: row.gas_difference || "0",
        gas_cost_difference_eth: "0", // Calcular si es necesario
        execution_delay_ms: parseInt(row.execution_delay_ms || 0),
        block_delay: parseInt(row.block_delay || 0),
        overall_parity_score: parseFloat(row.parity_score || 0),
        reconciliation_status: row.reconciliation_status
      },
      investigation: {
        required: row.investigation_required || false,
        status: row.investigation_id ? 'completed' : 'not_required',
        deviation_causes: JSON.parse(row.deviation_causes || '[]'),
        recommendations: []
      },
      quality_metrics: {
        data_completeness: parseFloat(row.data_quality_score || 100),
        data_accuracy: 100,
        timeliness_score: 100,
        confidence_level: parseFloat(row.confidence_level || 100)
      },
      processing_time_ms: parseInt(row.processing_time_ms || 0),
      created_at: row.created_at.toISOString(),
      completed_at: row.completed_at.toISOString(),
      alerts_triggered: JSON.parse(row.alerts_triggered || '[]'),
      requires_attention: row.requires_attention || false
    };
  }

  /**
   * Obtener métricas de reconciliación por estrategia
   */
  async getMetricsByStrategy(
    strategy: Strategy,
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    const query = `
      SELECT 
        COUNT(*) as total_reconciliations,
        SUM(CASE WHEN reconciliation_status = 'perfect_match' THEN 1 ELSE 0 END) as perfect_matches,
        SUM(CASE WHEN reconciliation_status = 'minor_variance' THEN 1 ELSE 0 END) as minor_variances,
        SUM(CASE WHEN reconciliation_status = 'significant_variance' THEN 1 ELSE 0 END) as significant_variances,
        SUM(CASE WHEN reconciliation_status = 'major_discrepancy' THEN 1 ELSE 0 END) as major_discrepancies,
        AVG(ABS(profit_variance_percentage)) as avg_profit_variance,
        MAX(ABS(profit_variance_percentage)) as max_profit_variance,
        AVG(parity_score) as avg_parity_score,
        AVG(processing_time_ms) as avg_processing_time,
        SUM(CASE WHEN investigation_required THEN 1 ELSE 0 END) as investigations_triggered
      FROM reconciliations 
      WHERE strategy = $1 AND created_at BETWEEN $2 AND $3
    `;

    const result = await this.db.query(query, [strategy, startDate, endDate]);
    return result.rows[0];
  }

  /**
   * Shutdown del engine
   */
  async shutdown(): Promise<void> {
    this.logger.info('🛑 Cerrando ReconciliationEngine...');
    
    await this.deviationInvestigator.shutdown();
    
    this.logger.info('✅ ReconciliationEngine cerrado correctamente');
  }
}
import { z } from 'zod';

// Estrategias de arbitraje
export const StrategySchema = z.enum(['A', 'C', 'D', 'F']);
export type Strategy = z.infer<typeof StrategySchema>;

// Estado de ejecución
export const ExecutionStatusSchema = z.enum([
  'pending',
  'simulated',
  'executed',
  'failed',
  'reverted',
  'timeout'
]);
export type ExecutionStatus = z.infer<typeof ExecutionStatusSchema>;

// Tipo de evento canónico execution_v1
export const ExecutionEventV1Schema = z.object({
  event_id: z.string().uuid(),
  event_type: z.literal('execution_v1'),
  version: z.string().default('1.0.0'),
  timestamp: z.string().datetime(),
  
  // Identificadores
  strategy: StrategySchema,
  chain_id: z.number().int().positive(),
  bundle_id: z.string().uuid().optional(),
  simulation_id: z.string().uuid().optional(),
  transaction_hash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional(),
  
  // Datos de simulación
  simulation_data: z.object({
    gross_profit_eth: z.string(),
    net_profit_eth: z.string(),
    gas_used: z.string(),
    gas_price_gwei: z.string(),
    execution_time_ms: z.number().int().nonnegative(),
    success: z.boolean(),
    block_number: z.number().int().positive(),
    simulation_hash: z.string().optional()
  }).optional(),
  
  // Datos de ejecución real
  execution_data: z.object({
    actual_profit_eth: z.string(),
    actual_gas_used: z.string(),
    actual_gas_price_gwei: z.string(),
    inclusion_block: z.number().int().positive(),
    inclusion_delay_blocks: z.number().int().nonnegative(),
    transaction_status: ExecutionStatusSchema,
    relay_used: z.string().optional(),
    mev_protection: z.boolean().default(true)
  }).optional(),
  
  // Análisis de reconciliación
  reconciliation: z.object({
    variance_percentage: z.number(),
    profit_difference_eth: z.string(),
    gas_difference: z.string(),
    execution_delay_ms: z.number().int().nonnegative(),
    parity_score: z.number().min(0).max(100),
    investigation_required: z.boolean(),
    deviation_causes: z.array(z.string()).default([]),
    reconciliation_status: z.enum(['perfect_match', 'minor_variance', 'significant_variance', 'major_discrepancy']),
    confidence_level: z.number().min(0).max(100)
  }).optional(),
  
  // Metadata
  metadata: z.object({
    source_system: z.string(),
    processing_node: z.string().optional(),
    data_quality_score: z.number().min(0).max(100).default(100),
    tags: z.array(z.string()).default([]),
    correlation_id: z.string().optional()
  })
});
export type ExecutionEventV1 = z.infer<typeof ExecutionEventV1Schema>;

// Configuración de reconciliación
export const ReconciliationConfigSchema = z.object({
  // Umbrales de varianza
  minor_variance_threshold: z.number().min(0).max(1).default(0.02), // 2%
  significant_variance_threshold: z.number().min(0).max(1).default(0.05), // 5%
  major_discrepancy_threshold: z.number().min(0).max(1).default(0.15), // 15%
  
  // Configuración de investigación automática
  auto_investigate_threshold: z.number().min(0).max(1).default(0.05), // 5%
  investigation_timeout_minutes: z.number().int().min(1).default(30),
  max_investigation_depth: z.number().int().min(1).default(5),
  
  // Configuración de alertas
  alert_on_major_discrepancy: z.boolean().default(true),
  alert_on_investigation_failure: z.boolean().default(true),
  parity_drift_alert_threshold: z.number().min(0).max(1).default(0.10), // 10%
  
  // Configuración de retención de datos
  retention_days: z.number().int().min(1).default(90),
  archive_after_days: z.number().int().min(1).default(30),
  
  // Real-Only Policy
  real_only: z.boolean().default(true)
});
export type ReconciliationConfig = z.infer<typeof ReconciliationConfigSchema>;

// Request de reconciliación
export const ReconciliationRequestSchema = z.object({
  reconciliation_id: z.string().uuid(),
  strategy: StrategySchema,
  chain_id: z.number().int().positive(),
  
  // IDs de referencia
  simulation_id: z.string().uuid(),
  bundle_id: z.string().uuid().optional(),
  transaction_hash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional(),
  
  // Datos de simulación (desde sim-ctl)
  simulation_result: z.object({
    gross_profit_eth: z.string(),
    net_profit_eth: z.string(),
    gas_used: z.string(),
    gas_price_gwei: z.string(),
    execution_time_ms: z.number().int().nonnegative(),
    block_number: z.number().int().positive(),
    success: z.boolean(),
    simulation_hash: z.string().optional()
  }),
  
  // Datos de ejecución (desde relays-client o searcher-rs)
  execution_result: z.object({
    actual_profit_eth: z.string(),
    actual_gas_used: z.string(),
    actual_gas_price_gwei: z.string(),
    inclusion_block: z.number().int().positive(),
    transaction_status: ExecutionStatusSchema,
    relay_used: z.string().optional(),
    inclusion_delay_blocks: z.number().int().nonnegative().default(0)
  }).optional(),
  
  // Configuración de reconciliación específica
  config_override: ReconciliationConfigSchema.partial().optional(),
  
  // Real-Only Policy enforcement
  real_only: z.boolean().default(true),
  
  // Timestamp del request
  timestamp: z.string().datetime().default(() => new Date().toISOString())
});
export type ReconciliationRequest = z.infer<typeof ReconciliationRequestSchema>;

// Resultado de reconciliación
export const ReconciliationResultSchema = z.object({
  reconciliation_id: z.string().uuid(),
  strategy: StrategySchema,
  chain_id: z.number().int().positive(),
  
  // Referencias
  simulation_id: z.string().uuid(),
  bundle_id: z.string().uuid().optional(),
  transaction_hash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional(),
  
  // Análisis de varianza
  variance_analysis: z.object({
    profit_variance_percentage: z.number(),
    profit_difference_eth: z.string(),
    profit_difference_usd: z.string().optional(),
    
    gas_variance_percentage: z.number(),
    gas_difference: z.string(),
    gas_cost_difference_eth: z.string(),
    
    execution_delay_ms: z.number().int().nonnegative(),
    block_delay: z.number().int().nonnegative(),
    
    overall_parity_score: z.number().min(0).max(100),
    reconciliation_status: z.enum(['perfect_match', 'minor_variance', 'significant_variance', 'major_discrepancy'])
  }),
  
  // Investigación automática
  investigation: z.object({
    required: z.boolean(),
    status: z.enum(['not_required', 'pending', 'in_progress', 'completed', 'failed']),
    investigation_id: z.string().uuid().optional(),
    deviation_causes: z.array(z.object({
      cause_type: z.enum(['market_movement', 'gas_price_change', 'slippage', 'mev_competition', 'network_congestion', 'relay_issues', 'contract_state_change', 'unknown']),
      description: z.string(),
      impact_percentage: z.number().min(0).max(100),
      confidence: z.number().min(0).max(100)
    })).default([]),
    root_cause_analysis: z.string().optional(),
    recommendations: z.array(z.string()).default([])
  }),
  
  // Métricas de calidad
  quality_metrics: z.object({
    data_completeness: z.number().min(0).max(100),
    data_accuracy: z.number().min(0).max(100),
    timeliness_score: z.number().min(0).max(100),
    confidence_level: z.number().min(0).max(100)
  }),
  
  // Timestamps y metadata
  processing_time_ms: z.number().int().nonnegative(),
  created_at: z.string().datetime(),
  completed_at: z.string().datetime(),
  
  // Flags y alertas
  alerts_triggered: z.array(z.string()).default([]),
  requires_attention: z.boolean().default(false),
  
  // Evento canónico generado
  execution_event: ExecutionEventV1Schema.optional()
});
export type ReconciliationResult = z.infer<typeof ReconciliationResultSchema>;

// Investigación de desviaciones
export const DeviationInvestigationSchema = z.object({
  investigation_id: z.string().uuid(),
  reconciliation_id: z.string().uuid(),
  strategy: StrategySchema,
  
  // Configuración de investigación
  investigation_type: z.enum(['automated', 'manual', 'deep_analysis']),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  assigned_investigator: z.string().optional(),
  
  // Datos de la desviación
  deviation_data: z.object({
    variance_percentage: z.number(),
    profit_impact_eth: z.string(),
    affected_transactions: z.array(z.string()),
    time_window: z.object({
      start: z.string().datetime(),
      end: z.string().datetime()
    })
  }),
  
  // Proceso de investigación
  investigation_steps: z.array(z.object({
    step_id: z.string(),
    step_type: z.enum(['data_collection', 'market_analysis', 'blockchain_analysis', 'correlation_analysis', 'root_cause_analysis']),
    description: z.string(),
    status: z.enum(['pending', 'in_progress', 'completed', 'failed', 'skipped']),
    result: z.any().optional(),
    duration_ms: z.number().int().nonnegative().optional(),
    timestamp: z.string().datetime()
  })).default([]),
  
  // Hallazgos
  findings: z.array(z.object({
    finding_type: z.enum(['root_cause', 'contributing_factor', 'correlation', 'anomaly']),
    description: z.string(),
    evidence: z.any(),
    confidence: z.number().min(0).max(100),
    impact_score: z.number().min(0).max(100)
  })).default([]),
  
  // Conclusiones y recomendaciones
  conclusion: z.object({
    root_cause: z.string().optional(),
    contributing_factors: z.array(z.string()).default([]),
    preventable: z.boolean(),
    recommendations: z.array(z.object({
      type: z.enum(['process_improvement', 'parameter_adjustment', 'system_enhancement', 'monitoring_alert']),
      description: z.string(),
      priority: z.enum(['low', 'medium', 'high']),
      estimated_impact: z.string().optional()
    })).default([])
  }).optional(),
  
  // Estado y metadata
  status: z.enum(['pending', 'in_progress', 'completed', 'failed', 'cancelled']),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  completed_at: z.string().datetime().optional()
});
export type DeviationInvestigation = z.infer<typeof DeviationInvestigationSchema>;

// Métricas de reconciliación
export const ReconciliationMetricsSchema = z.object({
  strategy: StrategySchema,
  time_period: z.object({
    start: z.string().datetime(),
    end: z.string().datetime()
  }),
  
  // Contadores básicos
  total_reconciliations: z.number().int().nonnegative().default(0),
  perfect_matches: z.number().int().nonnegative().default(0),
  minor_variances: z.number().int().nonnegative().default(0),
  significant_variances: z.number().int().nonnegative().default(0),
  major_discrepancies: z.number().int().nonnegative().default(0),
  
  // Métricas de varianza
  average_profit_variance: z.number().default(0),
  max_profit_variance: z.number().default(0),
  average_gas_variance: z.number().default(0),
  max_gas_variance: z.number().default(0),
  
  // Métricas de parity
  overall_parity_score: z.number().min(0).max(100).default(100),
  parity_trend: z.enum(['improving', 'stable', 'degrading', 'unknown']).default('unknown'),
  parity_drift_rate: z.number().default(0),
  
  // Investigaciones
  investigations_triggered: z.number().int().nonnegative().default(0),
  investigations_completed: z.number().int().nonnegative().default(0),
  root_causes_identified: z.number().int().nonnegative().default(0),
  
  // Performance
  average_processing_time_ms: z.number().nonnegative().default(0),
  data_quality_score: z.number().min(0).max(100).default(100),
  
  // Timestamps
  last_updated: z.string().datetime()
});
export type ReconciliationMetrics = z.infer<typeof ReconciliationMetricsSchema>;

// Configuración de alertas
export const AlertConfigSchema = z.object({
  alert_id: z.string().uuid(),
  alert_name: z.string(),
  alert_type: z.enum(['variance_threshold', 'parity_drift', 'investigation_failure', 'data_quality', 'processing_delay']),
  
  // Condiciones de trigger
  conditions: z.object({
    threshold: z.number().optional(),
    time_window_minutes: z.number().int().positive().optional(),
    strategy_filter: z.array(StrategySchema).optional(),
    chain_filter: z.array(z.number().int().positive()).optional()
  }),
  
  // Configuración de notificación
  notification: z.object({
    channels: z.array(z.enum(['email', 'slack', 'webhook', 'sms'])),
    recipients: z.array(z.string()),
    message_template: z.string(),
    cooldown_minutes: z.number().int().min(1).default(60)
  }),
  
  // Estado
  enabled: z.boolean().default(true),
  created_at: z.string().datetime(),
  last_triggered: z.string().datetime().optional(),
  trigger_count: z.number().int().nonnegative().default(0)
});
export type AlertConfig = z.infer<typeof AlertConfigSchema>;

// Portfolio reconciliation (para múltiples estrategias)
export const PortfolioReconciliationSchema = z.object({
  portfolio_id: z.string().uuid(),
  time_period: z.object({
    start: z.string().datetime(),
    end: z.string().datetime()
  }),
  
  // Resumen por estrategia
  strategy_summaries: z.array(z.object({
    strategy: StrategySchema,
    total_simulated_profit_eth: z.string(),
    total_actual_profit_eth: z.string(),
    profit_variance_percentage: z.number(),
    reconciliation_count: z.number().int().nonnegative(),
    parity_score: z.number().min(0).max(100)
  })),
  
  // Métricas agregadas
  portfolio_metrics: z.object({
    total_simulated_profit_eth: z.string(),
    total_actual_profit_eth: z.string(),
    overall_profit_variance: z.number(),
    overall_parity_score: z.number().min(0).max(100),
    total_reconciliations: z.number().int().nonnegative(),
    data_quality_score: z.number().min(0).max(100)
  }),
  
  // Análisis de tendencias
  trend_analysis: z.object({
    parity_trend: z.enum(['improving', 'stable', 'degrading']),
    variance_trend: z.enum(['decreasing', 'stable', 'increasing']),
    quality_trend: z.enum(['improving', 'stable', 'degrading']),
    recommendations: z.array(z.string())
  }),
  
  created_at: z.string().datetime()
});
export type PortfolioReconciliation = z.infer<typeof PortfolioReconciliationSchema>;
import { z } from 'zod';

// Configuración de instancia Anvil
export const AnvilConfigSchema = z.object({
  instance_id: z.string().uuid(),
  port: z.number().int().min(8545).max(65535),
  chain_id: z.number().int().positive(),
  fork_url: z.string().url(),
  fork_block_number: z.number().int().positive().optional(),
  accounts: z.number().int().min(1).default(10),
  balance: z.string().default("10000"), // ETH balance per account
  gas_limit: z.string().default("30000000"),
  gas_price: z.string().default("1000000000"), // 1 gwei
  base_fee: z.string().optional(),
  block_time: z.number().int().min(1).default(12), // seconds
  enable_auto_impersonation: z.boolean().default(true),
  enable_code_size_limit: z.boolean().default(false),
  silent: z.boolean().default(false)
});

export type AnvilConfig = z.infer<typeof AnvilConfigSchema>;

// Estado de instancia Anvil
export const AnvilInstanceStatusSchema = z.enum([
  'starting',
  'running', 
  'stopping',
  'stopped',
  'error',
  'health_check_failed'
]);

export type AnvilInstanceStatus = z.infer<typeof AnvilInstanceStatusSchema>;

export const AnvilInstanceSchema = z.object({
  instance_id: z.string().uuid(),
  config: AnvilConfigSchema,
  status: AnvilInstanceStatusSchema,
  pid: z.number().int().positive().optional(),
  start_time: z.string().datetime().optional(),
  last_health_check: z.string().datetime().optional(),
  error_message: z.string().optional(),
  metrics: z.object({
    blocks_mined: z.number().int().nonnegative().default(0),
    transactions_processed: z.number().int().nonnegative().default(0),
    gas_used: z.string().default("0"),
    uptime_seconds: z.number().int().nonnegative().default(0)
  }).default({})
});

export type AnvilInstance = z.infer<typeof AnvilInstanceSchema>;

// Estrategias de simulación
export const SimulationStrategySchema = z.enum(['A', 'C', 'D', 'F']);
export type SimulationStrategy = z.infer<typeof SimulationStrategySchema>;

// Request de simulación
export const SimulationRequestSchema = z.object({
  simulation_id: z.string().uuid(),
  strategy: SimulationStrategySchema,
  chain_id: z.number().int().positive(),
  fork_block_number: z.number().int().positive().optional(),
  transactions: z.array(z.object({
    to: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    data: z.string().regex(/^0x[a-fA-F0-9]*$/),
    value: z.string().default("0"),
    gas_limit: z.string().optional(),
    gas_price: z.string().optional()
  })).min(1),
  timeout_seconds: z.number().int().min(1).max(300).default(60),
  real_only: z.boolean().default(true) // Real-Only policy enforcement
});

export type SimulationRequest = z.infer<typeof SimulationRequestSchema>;

// Resultado de simulación
export const SimulationResultSchema = z.object({
  simulation_id: z.string().uuid(),
  instance_id: z.string().uuid(),
  strategy: SimulationStrategySchema,
  chain_id: z.number().int().positive(),
  status: z.enum(['success', 'failed', 'timeout', 'error']),
  start_time: z.string().datetime(),
  end_time: z.string().datetime(),
  execution_time_ms: z.number().int().nonnegative(),
  block_number: z.number().int().positive(),
  gas_used: z.string(),
  gas_price: z.string(),
  transaction_results: z.array(z.object({
    hash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
    status: z.enum(['success', 'failed', 'reverted']),
    gas_used: z.string(),
    logs: z.array(z.any()).optional(),
    return_data: z.string().optional(),
    error: z.string().optional()
  })),
  profitability: z.object({
    gross_profit: z.string(), // in ETH
    net_profit: z.string(),   // after gas costs
    roi_percentage: z.string(),
    risk_score: z.number().min(0).max(100)
  }).optional(),
  error_message: z.string().optional()
});

export type SimulationResult = z.infer<typeof SimulationResultSchema>;

// Health Check para instancias
export const HealthCheckResultSchema = z.object({
  instance_id: z.string().uuid(),
  status: z.enum(['healthy', 'unhealthy', 'timeout']),
  response_time_ms: z.number().int().nonnegative(),
  block_number: z.number().int().positive().optional(),
  error: z.string().optional(),
  timestamp: z.string().datetime()
});

export type HealthCheckResult = z.infer<typeof HealthCheckResultSchema>;

// Pool de instancias por estrategia
export const InstancePoolConfigSchema = z.object({
  strategy: SimulationStrategySchema,
  min_instances: z.number().int().min(1).default(2),
  max_instances: z.number().int().min(1).default(5),
  target_utilization: z.number().min(0.1).max(0.9).default(0.7),
  scale_up_threshold: z.number().min(0.1).max(1.0).default(0.8),
  scale_down_threshold: z.number().min(0.1).max(1.0).default(0.3),
  health_check_interval_seconds: z.number().int().min(5).default(30)
});

export type InstancePoolConfig = z.infer<typeof InstancePoolConfigSchema>;

// Métricas de performance
export const PerformanceMetricsSchema = z.object({
  strategy: SimulationStrategySchema,
  total_simulations: z.number().int().nonnegative().default(0),
  successful_simulations: z.number().int().nonnegative().default(0),
  failed_simulations: z.number().int().nonnegative().default(0),
  average_execution_time_ms: z.number().nonnegative().default(0),
  p95_execution_time_ms: z.number().nonnegative().default(0),
  total_gas_used: z.string().default("0"),
  total_profit_eth: z.string().default("0"),
  success_rate_percentage: z.number().min(0).max(100).default(0),
  last_updated: z.string().datetime()
});

export type PerformanceMetrics = z.infer<typeof PerformanceMetricsSchema>;
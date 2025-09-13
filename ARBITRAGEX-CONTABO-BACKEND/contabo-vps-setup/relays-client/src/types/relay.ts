import { z } from 'zod';

// Tipos de relay soportados
export const RelayTypeSchema = z.enum(['flashbots', 'bloxroute', 'eden', 'beaver', 'titan']);
export type RelayType = z.infer<typeof RelayTypeSchema>;

// Estado de relay
export const RelayStatusSchema = z.enum([
  'active',
  'inactive', 
  'degraded',
  'maintenance',
  'failed',
  'timeout'
]);
export type RelayStatus = z.infer<typeof RelayStatusSchema>;

// Configuración de relay
export const RelayConfigSchema = z.object({
  relay_id: z.string().uuid(),
  name: z.string().min(1),
  type: RelayTypeSchema,
  endpoint: z.string().url(),
  auth_header: z.string().optional(),
  api_key: z.string().optional(),
  signing_key: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional(),
  priority: z.number().int().min(1).max(10).default(5),
  weight: z.number().min(0).max(1).default(1),
  max_block_delay: z.number().int().min(0).default(0), // 0 = current block only
  timeout_ms: z.number().int().min(1000).max(30000).default(5000),
  retry_attempts: z.number().int().min(0).max(5).default(2),
  enabled: z.boolean().default(true)
});
export type RelayConfig = z.infer<typeof RelayConfigSchema>;

// Información de relay en runtime
export const RelayInfoSchema = z.object({
  config: RelayConfigSchema,
  status: RelayStatusSchema,
  last_success: z.string().datetime().optional(),
  last_failure: z.string().datetime().optional(),
  consecutive_failures: z.number().int().nonnegative().default(0),
  total_requests: z.number().int().nonnegative().default(0),
  successful_requests: z.number().int().nonnegative().default(0),
  failed_requests: z.number().int().nonnegative().default(0),
  average_response_time_ms: z.number().nonnegative().default(0),
  success_rate_percentage: z.number().min(0).max(100).default(0),
  last_health_check: z.string().datetime().optional()
});
export type RelayInfo = z.infer<typeof RelayInfoSchema>;

// Transacción para bundle
export const BundleTransactionSchema = z.object({
  to: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  data: z.string().regex(/^0x[a-fA-F0-9]*$/),
  value: z.string().default("0"),
  gas_limit: z.string(),
  gas_price: z.string().optional(),
  max_fee_per_gas: z.string().optional(),
  max_priority_fee_per_gas: z.string().optional(),
  nonce: z.number().int().nonnegative().optional(),
  signed_transaction: z.string().regex(/^0x[a-fA-F0-9]+$/).optional()
});
export type BundleTransaction = z.infer<typeof BundleTransactionSchema>;

// Request de bundle
export const BundleRequestSchema = z.object({
  bundle_id: z.string().uuid(),
  strategy: z.enum(['A', 'C', 'D', 'F']),
  chain_id: z.number().int().positive(),
  target_block: z.number().int().positive(),
  max_block: z.number().int().positive().optional(),
  transactions: z.array(BundleTransactionSchema).min(1),
  
  // Configuración de relay
  relay_preferences: z.array(RelayTypeSchema).default(['flashbots', 'bloxroute', 'eden']),
  min_relay_count: z.number().int().min(1).max(5).default(2),
  max_relay_count: z.number().int().min(1).max(5).default(3),
  
  // MEV Protection
  mev_protection: z.boolean().default(true),
  private_mempool_only: z.boolean().default(true),
  
  // Timing
  submission_deadline: z.string().datetime().optional(),
  timeout_seconds: z.number().int().min(1).max(300).default(30),
  
  // Real-Only Policy
  real_only: z.boolean().default(true)
});
export type BundleRequest = z.infer<typeof BundleRequestSchema>;

// Resultado de envío a relay individual
export const RelaySubmissionResultSchema = z.object({
  relay_type: RelayTypeSchema,
  relay_id: z.string().uuid(),
  status: z.enum(['success', 'failed', 'timeout', 'rejected']),
  bundle_hash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional(),
  submission_time: z.string().datetime(),
  response_time_ms: z.number().int().nonnegative(),
  error_message: z.string().optional(),
  relay_response: z.any().optional()
});
export type RelaySubmissionResult = z.infer<typeof RelaySubmissionResultSchema>;

// Resultado completo de bundle
export const BundleResultSchema = z.object({
  bundle_id: z.string().uuid(),
  strategy: z.enum(['A', 'C', 'D', 'F']),
  chain_id: z.number().int().positive(),
  target_block: z.number().int().positive(),
  
  // Resultados por relay
  relay_results: z.array(RelaySubmissionResultSchema),
  successful_relays: z.number().int().nonnegative(),
  failed_relays: z.number().int().nonnegative(),
  
  // Estado general
  overall_status: z.enum(['success', 'partial_success', 'failed', 'timeout']),
  submission_time: z.string().datetime(),
  completion_time: z.string().datetime(),
  total_time_ms: z.number().int().nonnegative(),
  
  // Tracking de inclusión
  inclusion_status: z.enum(['pending', 'included', 'missed', 'reverted', 'unknown']).default('pending'),
  included_in_block: z.number().int().positive().optional(),
  inclusion_delay_blocks: z.number().int().nonnegative().optional(),
  final_transaction_hashes: z.array(z.string().regex(/^0x[a-fA-F0-9]{64}$/)).optional(),
  
  error_summary: z.string().optional()
});
export type BundleResult = z.infer<typeof BundleResultSchema>;

// Configuración de failover
export const FailoverConfigSchema = z.object({
  strategy: z.enum(['round_robin', 'priority_based', 'success_rate_based', 'response_time_based']).default('priority_based'),
  max_consecutive_failures: z.number().int().min(1).default(3),
  failure_backoff_seconds: z.number().int().min(1).default(60),
  health_check_interval_seconds: z.number().int().min(10).default(30),
  circuit_breaker_threshold: z.number().min(0).max(1).default(0.1), // 10% success rate minimum
  recovery_time_seconds: z.number().int().min(60).default(300)
});
export type FailoverConfig = z.infer<typeof FailoverConfigSchema>;

// Métricas de relay
export const RelayMetricsSchema = z.object({
  relay_type: RelayTypeSchema,
  relay_id: z.string().uuid(),
  
  // Contadores básicos
  total_bundles_submitted: z.number().int().nonnegative().default(0),
  successful_submissions: z.number().int().nonnegative().default(0),
  failed_submissions: z.number().int().nonnegative().default(0),
  timeout_submissions: z.number().int().nonnegative().default(0),
  rejected_submissions: z.number().int().nonnegative().default(0),
  
  // Métricas de performance
  average_response_time_ms: z.number().nonnegative().default(0),
  p95_response_time_ms: z.number().nonnegative().default(0),
  success_rate_percentage: z.number().min(0).max(100).default(0),
  
  // Métricas de inclusión
  total_inclusions: z.number().int().nonnegative().default(0),
  average_inclusion_delay_blocks: z.number().nonnegative().default(0),
  inclusion_rate_percentage: z.number().min(0).max(100).default(0),
  
  // Uptime y disponibilidad
  uptime_percentage: z.number().min(0).max(100).default(0),
  last_downtime: z.string().datetime().optional(),
  consecutive_failures: z.number().int().nonnegative().default(0),
  
  // Timestamps
  first_seen: z.string().datetime(),
  last_updated: z.string().datetime()
});
export type RelayMetrics = z.infer<typeof RelayMetricsSchema>;

// Configuración de bundle tracking
export const BundleTrackingConfigSchema = z.object({
  track_inclusion: z.boolean().default(true),
  max_tracking_blocks: z.number().int().min(1).default(10),
  tracking_interval_seconds: z.number().int().min(1).default(12),
  auto_cleanup_hours: z.number().int().min(1).default(24)
});
export type BundleTrackingConfig = z.infer<typeof BundleTrackingConfigSchema>;

// Event de tracking
export const TrackingEventSchema = z.object({
  bundle_id: z.string().uuid(),
  event_type: z.enum(['submitted', 'confirmed', 'included', 'missed', 'reverted', 'timeout']),
  block_number: z.number().int().positive(),
  transaction_hash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional(),
  relay_type: RelayTypeSchema.optional(),
  timestamp: z.string().datetime(),
  details: z.any().optional()
});
export type TrackingEvent = z.infer<typeof TrackingEventSchema>;

// Health check de relay
export const RelayHealthCheckSchema = z.object({
  relay_id: z.string().uuid(),
  relay_type: RelayTypeSchema,
  status: z.enum(['healthy', 'degraded', 'unhealthy', 'timeout']),
  response_time_ms: z.number().int().nonnegative(),
  last_block: z.number().int().positive().optional(),
  endpoint_accessible: z.boolean(),
  auth_valid: z.boolean().optional(),
  error_message: z.string().optional(),
  timestamp: z.string().datetime()
});
export type RelayHealthCheck = z.infer<typeof RelayHealthCheckSchema>;
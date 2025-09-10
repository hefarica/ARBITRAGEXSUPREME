use prometheus::{
    Counter, Gauge, Histogram, HistogramOpts, IntCounter, IntGauge, Opts, Registry,
};
use std::sync::Arc;

/// Comprehensive metrics for ML inference service
/// Tracks <1ms inference and <2ms feature retrieval targets
pub struct InferenceMetrics {
    // Inference performance metrics
    pub inference_duration: Histogram,
    pub inference_total: IntCounter,
    pub inference_errors: IntCounter,
    pub inference_confidence: Histogram,
    
    // Feature store metrics
    pub feature_retrieval_duration: Histogram,
    pub feature_cache_hits: IntCounter,
    pub feature_cache_misses: IntCounter,
    pub feature_computation_duration: Histogram,
    
    // Model metrics
    pub model_load_duration: Histogram,
    pub model_memory_usage: Gauge,
    pub active_models: IntGauge,
    
    // Batch processing metrics
    pub batch_size: Histogram,
    pub batch_processing_duration: Histogram,
    
    // System metrics
    pub memory_usage_mb: Gauge,
    pub cpu_usage_percent: Gauge,
    pub concurrent_requests: IntGauge,
    
    // Business metrics
    pub opportunity_predictions: IntCounter,
    pub profit_estimations: IntCounter,
    pub risk_assessments: IntCounter,
    
    // Performance SLA tracking
    pub latency_sla_violations: IntCounter,
    pub confidence_threshold_failures: IntCounter,
    
    // Redis metrics (if enabled)
    pub redis_operations: IntCounter,
    pub redis_errors: IntCounter,
    pub redis_latency: Histogram,
}

impl InferenceMetrics {
    pub fn new() -> Self {
        Self {
            // Inference metrics with <1ms target
            inference_duration: Histogram::with_opts(
                HistogramOpts::new("ml_inference_duration_seconds", "ML model inference latency")
                    .buckets(vec![
                        0.0001, 0.0005, 0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1.0
                    ])
            ).unwrap(),
            
            inference_total: IntCounter::with_opts(
                Opts::new("ml_inference_total", "Total ML inferences performed")
            ).unwrap(),
            
            inference_errors: IntCounter::with_opts(
                Opts::new("ml_inference_errors_total", "Total ML inference errors")
            ).unwrap(),
            
            inference_confidence: Histogram::with_opts(
                HistogramOpts::new("ml_inference_confidence", "ML prediction confidence scores")
                    .buckets(vec![0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 0.99])
            ).unwrap(),
            
            // Feature store metrics with <2ms target
            feature_retrieval_duration: Histogram::with_opts(
                HistogramOpts::new("feature_retrieval_duration_seconds", "Feature retrieval latency")
                    .buckets(vec![
                        0.0001, 0.0005, 0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5
                    ])
            ).unwrap(),
            
            feature_cache_hits: IntCounter::with_opts(
                Opts::new("feature_cache_hits_total", "Feature cache hit count")
            ).unwrap(),
            
            feature_cache_misses: IntCounter::with_opts(
                Opts::new("feature_cache_misses_total", "Feature cache miss count")
            ).unwrap(),
            
            feature_computation_duration: Histogram::with_opts(
                HistogramOpts::new("feature_computation_duration_seconds", "Feature computation time")
                    .buckets(vec![0.001, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1.0])
            ).unwrap(),
            
            // Model management metrics
            model_load_duration: Histogram::with_opts(
                HistogramOpts::new("model_load_duration_seconds", "Model loading time")
                    .buckets(vec![0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0, 60.0])
            ).unwrap(),
            
            model_memory_usage: Gauge::with_opts(
                Opts::new("model_memory_usage_bytes", "Model memory usage in bytes")
            ).unwrap(),
            
            active_models: IntGauge::with_opts(
                Opts::new("active_models", "Number of loaded models")
            ).unwrap(),
            
            // Batch processing metrics
            batch_size: Histogram::with_opts(
                HistogramOpts::new("batch_size", "Inference batch sizes")
                    .buckets(vec![1.0, 2.0, 4.0, 8.0, 16.0, 32.0, 64.0, 128.0])
            ).unwrap(),
            
            batch_processing_duration: Histogram::with_opts(
                HistogramOpts::new("batch_processing_duration_seconds", "Batch processing time")
                    .buckets(vec![0.001, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1.0])
            ).unwrap(),
            
            // System resource metrics
            memory_usage_mb: Gauge::with_opts(
                Opts::new("memory_usage_mb", "Memory usage in MB")
            ).unwrap(),
            
            cpu_usage_percent: Gauge::with_opts(
                Opts::new("cpu_usage_percent", "CPU usage percentage")
            ).unwrap(),
            
            concurrent_requests: IntGauge::with_opts(
                Opts::new("concurrent_requests", "Number of concurrent inference requests")
            ).unwrap(),
            
            // Business metrics
            opportunity_predictions: IntCounter::with_opts(
                Opts::new("opportunity_predictions_total", "Total arbitrage opportunity predictions")
            ).unwrap(),
            
            profit_estimations: IntCounter::with_opts(
                Opts::new("profit_estimations_total", "Total profit estimations")
            ).unwrap(),
            
            risk_assessments: IntCounter::with_opts(
                Opts::new("risk_assessments_total", "Total risk assessments")
            ).unwrap(),
            
            // SLA tracking
            latency_sla_violations: IntCounter::with_opts(
                Opts::new("latency_sla_violations_total", "Latency SLA violation count")
            ).unwrap(),
            
            confidence_threshold_failures: IntCounter::with_opts(
                Opts::new("confidence_threshold_failures_total", "Predictions below confidence threshold")
            ).unwrap(),
            
            // Redis metrics
            redis_operations: IntCounter::with_opts(
                Opts::new("redis_operations_total", "Total Redis operations")
            ).unwrap(),
            
            redis_errors: IntCounter::with_opts(
                Opts::new("redis_errors_total", "Redis operation errors")
            ).unwrap(),
            
            redis_latency: Histogram::with_opts(
                HistogramOpts::new("redis_latency_seconds", "Redis operation latency")
                    .buckets(vec![0.0001, 0.0005, 0.001, 0.002, 0.005, 0.01, 0.02, 0.05])
            ).unwrap(),
        }
    }
    
    /// Register all metrics with Prometheus registry
    pub fn register_all(&self, registry: &Registry) -> Result<(), Box<dyn std::error::Error>> {
        // Inference metrics
        registry.register(Box::new(self.inference_duration.clone()))?;
        registry.register(Box::new(self.inference_total.clone()))?;
        registry.register(Box::new(self.inference_errors.clone()))?;
        registry.register(Box::new(self.inference_confidence.clone()))?;
        
        // Feature metrics
        registry.register(Box::new(self.feature_retrieval_duration.clone()))?;
        registry.register(Box::new(self.feature_cache_hits.clone()))?;
        registry.register(Box::new(self.feature_cache_misses.clone()))?;
        registry.register(Box::new(self.feature_computation_duration.clone()))?;
        
        // Model metrics
        registry.register(Box::new(self.model_load_duration.clone()))?;
        registry.register(Box::new(self.model_memory_usage.clone()))?;
        registry.register(Box::new(self.active_models.clone()))?;
        
        // Batch metrics
        registry.register(Box::new(self.batch_size.clone()))?;
        registry.register(Box::new(self.batch_processing_duration.clone()))?;
        
        // System metrics
        registry.register(Box::new(self.memory_usage_mb.clone()))?;
        registry.register(Box::new(self.cpu_usage_percent.clone()))?;
        registry.register(Box::new(self.concurrent_requests.clone()))?;
        
        // Business metrics
        registry.register(Box::new(self.opportunity_predictions.clone()))?;
        registry.register(Box::new(self.profit_estimations.clone()))?;
        registry.register(Box::new(self.risk_assessments.clone()))?;
        
        // SLA metrics
        registry.register(Box::new(self.latency_sla_violations.clone()))?;
        registry.register(Box::new(self.confidence_threshold_failures.clone()))?;
        
        // Redis metrics
        registry.register(Box::new(self.redis_operations.clone()))?;
        registry.register(Box::new(self.redis_errors.clone()))?;
        registry.register(Box::new(self.redis_latency.clone()))?;
        
        Ok(())
    }
    
    /// Record inference performance
    pub fn record_inference(&self, duration: std::time::Duration, confidence: f32) {
        self.inference_duration.observe(duration.as_secs_f64());
        self.inference_confidence.observe(confidence as f64);
        self.inference_total.inc();
        
        // Check SLA violations
        if duration > std::time::Duration::from_millis(1) {
            self.latency_sla_violations.inc();
        }
        
        if confidence < 0.7 {
            self.confidence_threshold_failures.inc();
        }
    }
    
    /// Record feature retrieval performance
    pub fn record_feature_retrieval(&self, duration: std::time::Duration, cache_hit: bool) {
        self.feature_retrieval_duration.observe(duration.as_secs_f64());
        
        if cache_hit {
            self.feature_cache_hits.inc();
        } else {
            self.feature_cache_misses.inc();
        }
        
        // Check feature SLA
        if duration > std::time::Duration::from_millis(2) {
            self.latency_sla_violations.inc();
        }
    }
    
    /// Record batch processing
    pub fn record_batch_processing(&self, batch_size: usize, duration: std::time::Duration) {
        self.batch_size.observe(batch_size as f64);
        self.batch_processing_duration.observe(duration.as_secs_f64());
    }
    
    /// Record business metric by model type
    pub fn record_prediction(&self, model_name: &str) {
        match model_name {
            "arbitrage_opportunity" => self.opportunity_predictions.inc(),
            "profit_estimation" => self.profit_estimations.inc(),
            "risk_assessment" => self.risk_assessments.inc(),
            _ => {} // Unknown model
        }
    }
    
    /// Update system resource metrics
    pub fn update_system_metrics(&self, memory_mb: f64, cpu_percent: f64) {
        self.memory_usage_mb.set(memory_mb);
        self.cpu_usage_percent.set(cpu_percent);
    }
    
    /// Update model count
    pub fn set_active_models(&self, count: i64) {
        self.active_models.set(count);
    }
    
    /// Increment concurrent request counter
    pub fn inc_concurrent_requests(&self) {
        self.concurrent_requests.inc();
    }
    
    /// Decrement concurrent request counter
    pub fn dec_concurrent_requests(&self) {
        self.concurrent_requests.dec();
    }
    
    /// Calculate cache hit rate
    pub fn get_cache_hit_rate(&self) -> f64 {
        let hits = self.feature_cache_hits.get() as f64;
        let misses = self.feature_cache_misses.get() as f64;
        let total = hits + misses;
        
        if total > 0.0 {
            hits / total
        } else {
            0.0
        }
    }
    
    /// Get performance summary
    pub fn get_performance_summary(&self) -> PerformanceSummary {
        PerformanceSummary {
            total_inferences: self.inference_total.get(),
            total_errors: self.inference_errors.get(),
            cache_hit_rate: self.get_cache_hit_rate(),
            sla_violations: self.latency_sla_violations.get(),
            active_models: self.active_models.get(),
            concurrent_requests: self.concurrent_requests.get(),
        }
    }
}

impl Default for InferenceMetrics {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Clone)]
pub struct PerformanceSummary {
    pub total_inferences: u64,
    pub total_errors: u64,
    pub cache_hit_rate: f64,
    pub sla_violations: u64,
    pub active_models: i64,
    pub concurrent_requests: i64,
}

/// Helper struct for creating a shared metrics instance
pub struct MetricsRegistry {
    pub metrics: Arc<InferenceMetrics>,
    pub registry: Registry,
}

impl MetricsRegistry {
    pub fn new() -> Result<Self, Box<dyn std::error::Error>> {
        let metrics = Arc::new(InferenceMetrics::new());
        let registry = Registry::new();
        
        metrics.register_all(&registry)?;
        
        Ok(Self { metrics, registry })
    }
    
    /// Get metrics in Prometheus format
    pub fn gather(&self) -> Vec<prometheus::proto::MetricFamily> {
        self.registry.gather()
    }
}

impl Default for MetricsRegistry {
    fn default() -> Self {
        Self::new().expect("Failed to create metrics registry")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_metrics_creation() {
        let metrics = InferenceMetrics::new();
        assert_eq!(metrics.inference_total.get(), 0);
    }

    #[test]
    fn test_metrics_registry() {
        let registry = MetricsRegistry::new();
        assert!(registry.is_ok());
    }

    #[test]
    fn test_performance_recording() {
        let metrics = InferenceMetrics::new();
        
        // Record good performance
        metrics.record_inference(std::time::Duration::from_micros(800), 0.95);
        assert_eq!(metrics.inference_total.get(), 1);
        assert_eq!(metrics.latency_sla_violations.get(), 0);
        
        // Record SLA violation
        metrics.record_inference(std::time::Duration::from_millis(2), 0.5);
        assert_eq!(metrics.inference_total.get(), 2);
        assert_eq!(metrics.latency_sla_violations.get(), 1);
        assert_eq!(metrics.confidence_threshold_failures.get(), 1);
    }
    
    #[test]
    fn test_cache_hit_rate() {
        let metrics = InferenceMetrics::new();
        
        // No operations yet
        assert_eq!(metrics.get_cache_hit_rate(), 0.0);
        
        // Add some cache operations
        metrics.feature_cache_hits.inc_by(8);
        metrics.feature_cache_misses.inc_by(2);
        
        assert_eq!(metrics.get_cache_hit_rate(), 0.8);
    }
}
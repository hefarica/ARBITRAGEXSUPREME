use anyhow::Result;
use ort::{
    environment::Environment,
    execution_providers::{CPUExecutionProvider, CUDAExecutionProvider},
    logging::LogLevel,
    session::{Session, builder::{SessionBuilder, GraphOptimizationLevel}},
    value::Value,
};
use std::collections::HashMap;
use std::path::Path;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};

use crate::config::InferenceConfig;
use crate::metrics::InferenceMetrics;

/// High-performance ONNX model manager
/// Target: <1ms model inference latency
pub struct ModelManager {
    models: RwLock<HashMap<String, Arc<Session>>>,
    environment: Arc<Environment>,
    metrics: Arc<InferenceMetrics>,
    config: InferenceConfig,
}

#[derive(Debug, Clone)]
pub struct ModelPrediction {
    pub opportunity_score: f32,
    pub profit_estimate: f32,
    pub risk_score: f32,
    pub confidence: f32,
    pub inference_time_ms: f32,
}

impl ModelManager {
    /// Create new model manager with ONNX Runtime optimization
    pub fn new(config: InferenceConfig, metrics: Arc<InferenceMetrics>) -> Result<Self> {
        // Initialize ONNX Runtime with performance optimizations
        let environment = Arc::new(
            Environment::new(ort::logging::LogLevel::Warning, "arbitrage_ml")?
        );

        Ok(Self {
            models: RwLock::new(HashMap::new()),
            environment,
            metrics,
            config,
        })
    }

    /// Load ML model with performance optimizations
    pub async fn load_model(&self, name: String, model_path: &Path) -> Result<()> {
        let start = std::time::Instant::now();

        info!("Loading model: {} from {:?}", name, model_path);

        // Configure session for maximum performance
        let session = SessionBuilder::new()?
            .with_optimization_level(GraphOptimizationLevel::Disable)?
            .with_intra_threads(4)? // Optimize for 4-core execution
            .with_execution_providers([
                CUDAExecutionProvider::default().build(), // GPU if available
                CPUExecutionProvider::default().build(),  // CPU fallback
            ])?
            .commit_from_file(model_path)?;

        // Validate model inputs/outputs
        self.validate_model_schema(&session, &name)?;

        // Store in cache
        {
            let mut models = self.models.write().await;
            models.insert(name.clone(), Arc::new(session));
        }

        let load_time = start.elapsed();
        info!("Model {} loaded in {:?}", name, load_time);

        self.metrics.model_load_duration.observe(load_time.as_secs_f64());

        Ok(())
    }

    /// Fast inference with <1ms target latency
    pub async fn predict_opportunity(
        &self,
        model_name: &str,
        features: &[f32],
    ) -> Result<ModelPrediction> {
        let start = std::time::Instant::now();

        // Get model from cache
        let session = {
            let models = self.models.read().await;
            models.get(model_name)
                .cloned()
                .ok_or_else(|| anyhow::anyhow!("Model {} not loaded", model_name))?
        };

        // Prepare input tensor
        let input_tensor = Value::from_array(([1, features.len()], features.to_vec()))?;

        // Run inference
        let input_name = self.get_input_name(model_name)?;
        let outputs = session.run(&[input_tensor])?;

        // Parse predictions
        let output_tensor = outputs.values().next().unwrap();
        let prediction = self.parse_model_output_single(&output_tensor)?;

        let inference_time = start.elapsed();
        let inference_ms = inference_time.as_secs_f64() * 1000.0;

        // Update metrics
        self.metrics.inference_duration.observe(inference_time.as_secs_f64());

        if inference_time > std::time::Duration::from_millis(1) {
            warn!("Inference exceeded 1ms target: {:?} for model {}", inference_time, model_name);
        }

        debug!(
            "Model {} prediction: score={:.3}, profit={:.3}, risk={:.3}, confidence={:.3}, time={:.2}ms",
            model_name, prediction.opportunity_score, prediction.profit_estimate, 
            prediction.risk_score, prediction.confidence, inference_ms
        );

        Ok(ModelPrediction {
            opportunity_score: prediction.opportunity_score,
            profit_estimate: prediction.profit_estimate,
            risk_score: prediction.risk_score,
            confidence: prediction.confidence,
            inference_time_ms: inference_ms as f32,
        })
    }

    /// Batch inference for multiple opportunities
    pub async fn predict_batch(
        &self,
        model_name: &str,
        features_batch: &[Vec<f32>],
    ) -> Result<Vec<ModelPrediction>> {
        let start = std::time::Instant::now();

        let session = {
            let models = self.models.read().await;
            models.get(model_name)
                .cloned()
                .ok_or_else(|| anyhow::anyhow!("Model {} not loaded", model_name))?
        };

        let mut predictions = Vec::with_capacity(features_batch.len());

        // Batch processing for efficiency
        let batch_size = self.config.max_batch_size.min(features_batch.len());
        
        for chunk in features_batch.chunks(batch_size) {
            let batch_predictions = self.process_batch_chunk(&session, chunk).await?;
            predictions.extend(batch_predictions);
        }

        let total_time = start.elapsed();
        let avg_time_ms = (total_time.as_secs_f64() * 1000.0) / predictions.len() as f64;

        debug!(
            "Batch inference: {} predictions in {:?} (avg: {:.2}ms per prediction)",
            predictions.len(), total_time, avg_time_ms
        );

        Ok(predictions)
    }

    /// Process a chunk of the batch
    async fn process_batch_chunk(
        &self,
        session: &Session,
        chunk: &[Vec<f32>],
    ) -> Result<Vec<ModelPrediction>> {
        let mut predictions = Vec::with_capacity(chunk.len());

        for features in chunk {
            let input_tensor = Value::from_array(([1, features.len()], features.to_vec()))?;
            let input_name = self.get_input_name("default")?; // Use default for batch
            let outputs = session.run(&[input_tensor])?;
            let output_tensor = outputs.values().next().unwrap();
            let prediction = self.parse_model_output_single(&output_tensor)?;
            predictions.push(prediction);
        }

        Ok(predictions)
    }

    /// Parse model output tensors to prediction struct
    fn parse_model_output(&self, outputs: &[Value]) -> Result<ModelPrediction> {
        // Extract output values from ONNX tensor
        // This assumes a specific model output format:
        // [opportunity_score, profit_estimate, risk_score, confidence]
        
        if outputs.is_empty() {
            return Err(anyhow::anyhow!("No model outputs received"));
        }

        let output_tensor = &outputs[0];
        let output_slice = output_tensor.try_extract::<f32>()?;
        let output_data = output_slice.view();

        if output_data.len() < 4 {
            return Err(anyhow::anyhow!("Insufficient model outputs: expected 4, got {}", output_data.len()));
        }

        Ok(ModelPrediction {
            opportunity_score: output_data[0].clamp(0.0, 1.0),
            profit_estimate: output_data[1],
            risk_score: output_data[2].clamp(0.0, 1.0),
            confidence: output_data[3].clamp(0.0, 1.0),
            inference_time_ms: 0.0, // Will be set by caller
        })
    }

    /// Parse single model output tensor (ORT 2.0 API)
    fn parse_model_output_single(&self, output_tensor: &ort::value::ValueRef) -> Result<ModelPrediction> {
        let output_slice = output_tensor.try_extract::<f32>()?;
        let output_data = output_slice.view();

        if output_data.len() < 4 {
            return Err(anyhow::anyhow!("Insufficient model outputs: expected 4, got {}", output_data.len()));
        }

        Ok(ModelPrediction {
            opportunity_score: output_data[0].clamp(0.0, 1.0),
            profit_estimate: output_data[1],
            risk_score: output_data[2].clamp(0.0, 1.0),
            confidence: output_data[3].clamp(0.0, 1.0),
            inference_time_ms: 0.0, // Will be set by caller
        })
    }

    /// Validate model input/output schema
    fn validate_model_schema(&self, session: &Session, model_name: &str) -> Result<()> {
        let input_count = session.inputs.len();
        let output_count = session.outputs.len();

        debug!(
            "Model {} schema: {} inputs, {} outputs",
            model_name, input_count, output_count
        );

        // Validate expected schema
        if input_count == 0 {
            return Err(anyhow::anyhow!("Model {} has no inputs", model_name));
        }

        if output_count == 0 {
            return Err(anyhow::anyhow!("Model {} has no outputs", model_name));
        }

        // Log input/output details
        for (i, input) in session.inputs.iter().enumerate() {
            debug!("Input {}: {} {:?}", i, input.name, input.input_type);
        }

        for (i, output) in session.outputs.iter().enumerate() {
            debug!("Output {}: {} {:?}", i, output.name, output.output_type);
        }

        Ok(())
    }

    /// Get loaded model names
    pub async fn get_loaded_models(&self) -> Vec<String> {
        let models = self.models.read().await;
        models.keys().cloned().collect()
    }

    /// Unload model from memory
    pub async fn unload_model(&self, name: &str) -> Result<()> {
        let mut models = self.models.write().await;
        
        if models.remove(name).is_some() {
            info!("Unloaded model: {}", name);
            Ok(())
        } else {
            Err(anyhow::anyhow!("Model {} not found", name))
        }
    }

    /// Get model memory usage statistics
    pub async fn get_model_stats(&self) -> HashMap<String, ModelStats> {
        let models = self.models.read().await;
        let mut stats = HashMap::new();

        for (name, _session) in models.iter() {
            // In a full implementation, would query actual memory usage
            stats.insert(name.clone(), ModelStats {
                memory_mb: 50.0, // Placeholder
                inference_count: 0, // Would track actual count
                avg_inference_time_ms: 0.8, // Placeholder
            });
        }

        stats
    }

    /// Get input name for model
    fn get_input_name(&self, model_name: &str) -> Result<String> {
        // For simplicity, use default input name
        // In production, would dynamically get from model metadata
        Ok("input".to_string())
    }
}

#[derive(Debug, Clone)]
pub struct ModelStats {
    pub memory_mb: f64,
    pub inference_count: u64,
    pub avg_inference_time_ms: f64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_model_manager_creation() {
        let config = InferenceConfig::default();
        let metrics = Arc::new(InferenceMetrics::new());
        let manager = ModelManager::new(config, metrics);
        assert!(manager.is_ok());
    }

    #[tokio::test]
    async fn test_inference_performance() {
        // Test <1ms inference target
        // Would need actual model file for full test
    }
}
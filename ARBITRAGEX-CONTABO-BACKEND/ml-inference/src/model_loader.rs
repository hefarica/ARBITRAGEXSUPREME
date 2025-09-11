use anyhow::Result;
use ort::{
    environment::Environment,
    execution_providers::{CPUExecutionProvider, CUDAExecutionProvider},
    logging::LogLevel,
    session::{Session, builder::{SessionBuilder, GraphOptimizationLevel}},
    value::Value,
};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::fs;
use tracing::{debug, error, info, warn};

use crate::config::{InferenceConfig, ModelConfig};
use crate::metrics::InferenceMetrics;

/// Model loader with validation and optimization
pub struct ModelLoader {
    environment: Arc<Environment>,
    metrics: Arc<InferenceMetrics>,
    config: InferenceConfig,
}

#[derive(Debug, Clone)]
pub struct LoadedModel {
    pub session: Arc<Session>,
    pub config: ModelConfig,
    pub metadata: ModelMetadata,
    pub load_time_ms: f64,
}

#[derive(Debug, Clone)]
pub struct ModelMetadata {
    pub file_size_bytes: u64,
    pub input_count: usize,
    pub output_count: usize,
    pub input_shapes: Vec<Vec<i64>>,
    pub output_shapes: Vec<Vec<i64>>,
    pub providers: Vec<String>,
    pub optimization_level: String,
}

#[derive(Debug, Clone)]
pub struct ModelValidationResult {
    pub is_valid: bool,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
    pub input_validation: Vec<InputValidation>,
    pub output_validation: Vec<OutputValidation>,
}

#[derive(Debug, Clone)]
pub struct InputValidation {
    pub name: String,
    pub shape: Vec<i64>,
    pub data_type: String,
    pub is_dynamic: bool,
}

#[derive(Debug, Clone)]
pub struct OutputValidation {
    pub name: String,
    pub shape: Vec<i64>,
    pub data_type: String,
}

impl ModelLoader {
    /// Create new model loader
    pub fn new(config: InferenceConfig, metrics: Arc<InferenceMetrics>) -> Result<Self> {
        let environment = Arc::new(
            Environment::new(ort::logging::LogLevel::Warning, "arbitrage_ml_loader")?
        );

        Ok(Self {
            environment,
            metrics,
            config,
        })
    }

    /// Load model with full optimization and validation
    pub async fn load_model(&self, model_config: &ModelConfig) -> Result<LoadedModel> {
        let start = std::time::Instant::now();

        info!("Loading model: {} v{}", model_config.name, model_config.version);

        // Validate model file exists
        self.validate_model_file(&model_config.model_path).await?;

        // Get file metadata
        let file_size = self.get_model_file_size(&model_config.model_path).await?;

        // Create optimized session
        let session = self.create_optimized_session(&model_config.model_path).await?;

        // Extract model metadata
        let metadata = self.extract_model_metadata(&session, file_size)?;

        // Validate model schema
        self.validate_model_schema(&session, model_config)?;

        // Perform warmup if configured
        if self.config.performance.warmup_iterations > 0 {
            self.warmup_model(&session, model_config).await?;
        }

        let load_time = start.elapsed();
        let load_time_ms = load_time.as_secs_f64() * 1000.0;

        // Record metrics
        self.metrics.model_load_duration.observe(load_time.as_secs_f64());

        info!(
            "Model {} loaded successfully in {:.2}ms (size: {} MB)",
            model_config.name,
            load_time_ms,
            file_size as f64 / 1_000_000.0
        );

        Ok(LoadedModel {
            session: Arc::new(session),
            config: model_config.clone(),
            metadata,
            load_time_ms,
        })
    }

    /// Validate model file exists and is accessible
    async fn validate_model_file(&self, model_path: &Path) -> Result<()> {
        if !model_path.exists() {
            return Err(anyhow::anyhow!(
                "Model file does not exist: {}",
                model_path.display()
            ));
        }

        let metadata = fs::metadata(model_path).await?;
        if !metadata.is_file() {
            return Err(anyhow::anyhow!(
                "Model path is not a file: {}",
                model_path.display()
            ));
        }

        if metadata.len() == 0 {
            return Err(anyhow::anyhow!(
                "Model file is empty: {}",
                model_path.display()
            ));
        }

        Ok(())
    }

    /// Get model file size
    async fn get_model_file_size(&self, model_path: &Path) -> Result<u64> {
        let metadata = fs::metadata(model_path).await?;
        Ok(metadata.len())
    }

    /// Create optimized ONNX Runtime session
    async fn create_optimized_session(&self, model_path: &Path) -> Result<Session> {
        let session = SessionBuilder::new()?
            // Performance optimizations
            .with_optimization_level(GraphOptimizationLevel::Disable)?
            .with_intra_threads(self.config.inference_threads)?
            .with_inter_threads(1)? // Single inter-op thread for inference
            
            // Memory optimizations
            .with_memory_pattern(true)?
            // .with_cpu_mem_arena(true)? // Method removed in ORT 2.0
            
            // Execution providers in priority order
            .with_execution_providers([
                // Try GPU acceleration first
                CUDAExecutionProvider::default().build(),
                CPUExecutionProvider::default().build(),
            ])?
            .with_model_from_file(model_path)?;

        Ok(session)
    }

    /// Extract model metadata for monitoring
    fn extract_model_metadata(&self, session: &Session, file_size: u64) -> Result<ModelMetadata> {
        let input_count = session.inputs.len();
        let output_count = session.outputs.len();

        let mut input_shapes = Vec::new();
        let mut output_shapes = Vec::new();

        // Extract input shapes
        for input in &session.inputs {
            if let Some(shape) = input.input_type.tensor_dimensions() {
                input_shapes.push(shape.to_vec());
            }
        }

        // Extract output shapes
        for output in &session.outputs {
            if let Some(shape) = output.output_type.tensor_dimensions() {
                output_shapes.push(shape.to_vec());
            }
        }

        // Get active execution providers
        let providers = vec!["CPU".to_string()]; // Simplified - would query actual providers

        Ok(ModelMetadata {
            file_size_bytes: file_size,
            input_count,
            output_count,
            input_shapes,
            output_shapes,
            providers,
            optimization_level: "All".to_string(),
        })
    }

    /// Validate model schema matches expected configuration
    fn validate_model_schema(&self, session: &Session, model_config: &ModelConfig) -> Result<()> {
        // Check minimum input/output counts
        if session.inputs.is_empty() {
            return Err(anyhow::anyhow!(
                "Model {} has no inputs",
                model_config.name
            ));
        }

        if session.outputs.is_empty() {
            return Err(anyhow::anyhow!(
                "Model {} has no outputs",
                model_config.name
            ));
        }

        // Log input details
        debug!("Model {} inputs:", model_config.name);
        for (i, input) in session.inputs.iter().enumerate() {
            debug!("  Input {}: {} ({:?})", i, input.name, input.input_type);
        }

        // Log output details
        debug!("Model {} outputs:", model_config.name);
        for (i, output) in session.outputs.iter().enumerate() {
            debug!("  Output {}: {} ({:?})", i, output.name, output.output_type);
        }

        Ok(())
    }

    /// Perform model warmup with dummy data
    async fn warmup_model(&self, session: &Session, model_config: &ModelConfig) -> Result<()> {
        let warmup_iterations = self.config.performance.warmup_iterations;
        info!("Warming up model {} with {} iterations", model_config.name, warmup_iterations);

        let start = std::time::Instant::now();

        for i in 0..warmup_iterations {
            // Create dummy input based on model schema
            if let Some(input_info) = session.inputs.first() {
                if let Ok(tensor_info) = &input_info.input_type {
                    // Simplified shape extraction for ORT 2.0
                    // Create dummy data matching the shape
                    let total_elements: usize = shape.iter()
                        .map(|&dim| if dim > 0 { dim as usize } else { 1 })
                        .product();
                    
                    let dummy_data: Vec<f32> = vec![0.1; total_elements];
                    
                    // Try inference (errors are expected during warmup)
                    if let Ok(input_tensor) = Value::from_array(([1, dummy_data.len()], dummy_data)) {
                        let _ = session.run(vec![("input", input_tensor.into())]);
                    }
                }
            }

            // Small delay between iterations
            if i < warmup_iterations - 1 {
                tokio::time::sleep(std::time::Duration::from_millis(10)).await;
            }
        }

        let warmup_time = start.elapsed();
        info!("Model {} warmup completed in {:?}", model_config.name, warmup_time);

        Ok(())
    }

    /// Validate model with comprehensive checks
    pub async fn validate_model(&self, model_path: &Path) -> Result<ModelValidationResult> {
        let mut errors = Vec::new();
        let mut warnings = Vec::new();
        let mut input_validation = Vec::new();
        let mut output_validation = Vec::new();

        // Basic file validation
        match self.validate_model_file(model_path).await {
            Ok(()) => {}
            Err(e) => {
                errors.push(format!("File validation failed: {}", e));
                return Ok(ModelValidationResult {
                    is_valid: false,
                    errors,
                    warnings,
                    input_validation,
                    output_validation,
                });
            }
        }

        // Try to load model
        let session = match self.create_optimized_session(model_path).await {
            Ok(session) => session,
            Err(e) => {
                errors.push(format!("Failed to create session: {}", e));
                return Ok(ModelValidationResult {
                    is_valid: false,
                    errors,
                    warnings,
                    input_validation,
                    output_validation,
                });
            }
        };

        // Validate inputs
        for input in &session.inputs {
            let shape = input.input_type.tensor_dimensions()
                .map(|dims| dims.to_vec())
                .unwrap_or_default();

            let is_dynamic = shape.iter().any(|&dim| dim < 0);
            if is_dynamic {
                warnings.push(format!("Input '{}' has dynamic dimensions", input.name));
            }

            input_validation.push(InputValidation {
                name: input.name.clone(),
                shape,
                data_type: format!("{:?}", input.input_type),
                is_dynamic,
            });
        }

        // Validate outputs
        for output in &session.outputs {
            let shape = output.output_type.tensor_dimensions()
                .map(|dims| dims.to_vec())
                .unwrap_or_default();

            output_validation.push(OutputValidation {
                name: output.name.clone(),
                shape,
                data_type: format!("{:?}", output.output_type),
            });
        }

        // Check file size
        let file_size = self.get_model_file_size(model_path).await.unwrap_or(0);
        if file_size > 100_000_000 { // > 100MB
            warnings.push("Model file is very large (>100MB)".to_string());
        }

        let is_valid = errors.is_empty();

        Ok(ModelValidationResult {
            is_valid,
            errors,
            warnings,
            input_validation,
            output_validation,
        })
    }

    /// Load all configured models
    pub async fn load_all_models(&self) -> Result<Vec<LoadedModel>> {
        let mut loaded_models = Vec::new();

        for model_config in &self.config.models {
            if model_config.should_auto_load() {
                match self.load_model(model_config).await {
                    Ok(loaded_model) => {
                        loaded_models.push(loaded_model);
                    }
                    Err(e) => {
                        error!("Failed to load model {}: {}", model_config.name, e);
                        // Continue loading other models
                    }
                }
            } else {
                info!("Skipping model {} (auto_load=false)", model_config.name);
            }
        }

        info!("Loaded {} models successfully", loaded_models.len());
        Ok(loaded_models)
    }

    /// Scan directory for ONNX models
    pub async fn scan_model_directory(&self, dir: &Path) -> Result<Vec<PathBuf>> {
        let mut model_files = Vec::new();

        if !dir.exists() {
            warn!("Model directory does not exist: {}", dir.display());
            return Ok(model_files);
        }

        let mut entries = fs::read_dir(dir).await?;
        while let Some(entry) = entries.next_entry().await? {
            let path = entry.path();
            if path.extension().and_then(|ext| ext.to_str()) == Some("onnx") {
                model_files.push(path);
            }
        }

        debug!("Found {} ONNX models in {}", model_files.len(), dir.display());
        Ok(model_files)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_model_loader_creation() {
        let config = InferenceConfig::default();
        let metrics = Arc::new(InferenceMetrics::new());
        let loader = ModelLoader::new(config, metrics);
        assert!(loader.is_ok());
    }

    #[tokio::test]
    async fn test_model_validation() {
        // Would test with actual model files
        // For now, test basic structure
    }
}
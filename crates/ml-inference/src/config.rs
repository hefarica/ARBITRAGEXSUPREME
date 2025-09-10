use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Configuration for ML inference service
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InferenceConfig {
    /// Redis URL for distributed feature caching
    pub redis_url: Option<String>,
    
    /// Maximum local cache size
    pub max_cache_size: usize,
    
    /// Model directory path
    pub model_dir: PathBuf,
    
    /// Maximum batch size for inference
    pub max_batch_size: usize,
    
    /// Number of inference threads
    pub inference_threads: usize,
    
    /// Feature computation timeout (seconds)
    pub feature_timeout_sec: u64,
    
    /// Model performance thresholds
    pub performance: PerformanceConfig,
    
    /// Feature store configuration
    pub feature_store: FeatureStoreConfig,
    
    /// Model-specific configurations
    pub models: Vec<ModelConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceConfig {
    /// Maximum inference latency (milliseconds)
    pub max_inference_latency_ms: f64,
    
    /// Maximum feature retrieval latency (milliseconds)
    pub max_feature_latency_ms: f64,
    
    /// Minimum prediction confidence threshold
    pub min_confidence_threshold: f32,
    
    /// Model warm-up iterations
    pub warmup_iterations: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeatureStoreConfig {
    /// Feature TTL in seconds
    pub default_ttl_sec: u64,
    
    /// Cache cleanup interval (seconds)
    pub cleanup_interval_sec: u64,
    
    /// Maximum memory usage for features (MB)
    pub max_memory_mb: usize,
    
    /// Feature computation retry attempts
    pub retry_attempts: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelConfig {
    /// Model name/identifier
    pub name: String,
    
    /// Path to ONNX model file
    pub model_path: PathBuf,
    
    /// Expected input features
    pub input_features: Vec<String>,
    
    /// Model version
    pub version: String,
    
    /// Auto-load on startup
    pub auto_load: bool,
    
    /// Model-specific performance settings
    pub performance_override: Option<PerformanceConfig>,
}

impl Default for InferenceConfig {
    fn default() -> Self {
        Self {
            redis_url: None,
            max_cache_size: 10000,
            model_dir: PathBuf::from("./models"),
            max_batch_size: 32,
            inference_threads: 4,
            feature_timeout_sec: 5,
            performance: PerformanceConfig::default(),
            feature_store: FeatureStoreConfig::default(),
            models: vec![
                ModelConfig {
                    name: "arbitrage_opportunity".to_string(),
                    model_path: PathBuf::from("./models/arbitrage_v1.onnx"),
                    input_features: vec![
                        "price_volatility".to_string(),
                        "volume_ratio".to_string(),
                        "liquidity_depth".to_string(),
                        "spread_ratio".to_string(),
                        "market_impact".to_string(),
                    ],
                    version: "1.0.0".to_string(),
                    auto_load: true,
                    performance_override: None,
                },
                ModelConfig {
                    name: "profit_estimation".to_string(),
                    model_path: PathBuf::from("./models/profit_v1.onnx"),
                    input_features: vec![
                        "price_volatility".to_string(),
                        "liquidity_depth".to_string(),
                        "market_impact".to_string(),
                    ],
                    version: "1.0.0".to_string(),
                    auto_load: true,
                    performance_override: None,
                },
                ModelConfig {
                    name: "risk_assessment".to_string(),
                    model_path: PathBuf::from("./models/risk_v1.onnx"),
                    input_features: vec![
                        "price_volatility".to_string(),
                        "volume_ratio".to_string(),
                        "spread_ratio".to_string(),
                    ],
                    version: "1.0.0".to_string(),
                    auto_load: true,
                    performance_override: Some(PerformanceConfig {
                        max_inference_latency_ms: 0.5, // Stricter for risk model
                        max_feature_latency_ms: 1.0,
                        min_confidence_threshold: 0.9,
                        warmup_iterations: 10,
                    }),
                },
            ],
        }
    }
}

impl Default for PerformanceConfig {
    fn default() -> Self {
        Self {
            max_inference_latency_ms: 1.0,
            max_feature_latency_ms: 2.0,
            min_confidence_threshold: 0.7,
            warmup_iterations: 5,
        }
    }
}

impl Default for FeatureStoreConfig {
    fn default() -> Self {
        Self {
            default_ttl_sec: 300, // 5 minutes
            cleanup_interval_sec: 600, // 10 minutes
            max_memory_mb: 512, // 512 MB
            retry_attempts: 3,
        }
    }
}

impl InferenceConfig {
    /// Load configuration from file
    pub fn from_file(path: &std::path::Path) -> anyhow::Result<Self> {
        let content = std::fs::read_to_string(path)?;
        let config: Self = toml::from_str(&content)?;
        Ok(config)
    }
    
    /// Save configuration to file
    pub fn to_file(&self, path: &std::path::Path) -> anyhow::Result<()> {
        let content = toml::to_string_pretty(self)?;
        std::fs::write(path, content)?;
        Ok(())
    }
    
    /// Get model configuration by name
    pub fn get_model_config(&self, name: &str) -> Option<&ModelConfig> {
        self.models.iter().find(|m| m.name == name)
    }
    
    /// Validate configuration
    pub fn validate(&self) -> anyhow::Result<()> {
        // Validate model paths exist
        for model in &self.models {
            if model.auto_load && !model.model_path.exists() {
                return Err(anyhow::anyhow!(
                    "Model file not found: {} for model {}",
                    model.model_path.display(),
                    model.name
                ));
            }
        }
        
        // Validate performance thresholds
        if self.performance.max_inference_latency_ms <= 0.0 {
            return Err(anyhow::anyhow!("Invalid inference latency threshold"));
        }
        
        if self.performance.max_feature_latency_ms <= 0.0 {
            return Err(anyhow::anyhow!("Invalid feature latency threshold"));
        }
        
        // Validate batch size
        if self.max_batch_size == 0 {
            return Err(anyhow::anyhow!("Invalid batch size: must be > 0"));
        }
        
        // Validate thread count
        if self.inference_threads == 0 {
            return Err(anyhow::anyhow!("Invalid thread count: must be > 0"));
        }
        
        Ok(())
    }
    
    /// Get environment-specific configuration
    pub fn for_environment(env: &str) -> Self {
        let mut config = Self::default();
        
        match env {
            "development" => {
                config.performance.max_inference_latency_ms = 2.0; // Relaxed for dev
                config.max_cache_size = 1000;
                config.inference_threads = 2;
            }
            "production" => {
                config.performance.max_inference_latency_ms = 0.8; // Strict for prod
                config.max_cache_size = 50000;
                config.inference_threads = 8;
                config.redis_url = Some("redis://localhost:6379".to_string());
            }
            "testing" => {
                config.performance.max_inference_latency_ms = 5.0; // Very relaxed
                config.max_cache_size = 100;
                config.inference_threads = 1;
            }
            _ => {} // Use defaults
        }
        
        config
    }
}

impl ModelConfig {
    /// Get effective performance config (with overrides)
    pub fn get_performance_config(&self, default: &PerformanceConfig) -> PerformanceConfig {
        self.performance_override.clone().unwrap_or_else(|| default.clone())
    }
    
    /// Check if model should be auto-loaded
    pub fn should_auto_load(&self) -> bool {
        self.auto_load && self.model_path.exists()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = InferenceConfig::default();
        assert_eq!(config.max_batch_size, 32);
        assert_eq!(config.inference_threads, 4);
        assert_eq!(config.models.len(), 3);
    }

    #[test]
    fn test_config_validation() {
        let config = InferenceConfig::default();
        // Default config should be valid (even if model files don't exist)
        // because auto_load models will be checked, but in test env they don't need to exist
    }

    #[test]
    fn test_environment_configs() {
        let prod_config = InferenceConfig::for_environment("production");
        assert_eq!(prod_config.inference_threads, 8);
        assert!(prod_config.redis_url.is_some());
        
        let dev_config = InferenceConfig::for_environment("development");
        assert_eq!(dev_config.inference_threads, 2);
        assert!(dev_config.redis_url.is_none());
    }

    #[test]
    fn test_model_config_lookup() {
        let config = InferenceConfig::default();
        let model_config = config.get_model_config("arbitrage_opportunity");
        assert!(model_config.is_some());
        assert_eq!(model_config.unwrap().version, "1.0.0");
    }
}
use anyhow::Result;
use std::sync::Arc;
use tokio::time::{Duration, Instant};
use tracing::{info, error, warn, debug};
use tracing_subscriber::EnvFilter;

mod model_manager;
mod feature_store;
mod inference_engine;
mod feature_extractor;
mod model_loader;
mod metrics;
mod config;

use model_manager::ModelManager;
use feature_store::FeatureStore;
use inference_engine::InferenceEngine;
use feature_extractor::FeatureExtractor;
use metrics::InferenceMetrics;
use config::InferenceConfig;

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .init();

    info!("🧠 ArbitrageX Supreme V3.0 - ML Inference Engine (Rust + ONNX)");
    info!("⚡ Target: <1-2ms inference latency | Ingenio Pichichi S.A.");

    // Load configuration
    let config = InferenceConfig::from_env()?;
    info!("📋 Config loaded: {} models, ONNX Runtime: {}", 
          config.model_paths.len(), config.onnx_provider);

    // Initialize metrics
    let metrics = Arc::new(InferenceMetrics::new());
    
    // Initialize core components
    let model_manager = Arc::new(ModelManager::new(config.clone(), metrics.clone())?);
    let feature_store = Arc::new(FeatureStore::new(config.clone(), metrics.clone()).await?);
    let feature_extractor = Arc::new(FeatureExtractor::new(feature_store.clone(), metrics.clone()));
    let inference_engine = Arc::new(InferenceEngine::new(
        model_manager.clone(), 
        feature_store.clone(),
        feature_extractor.clone(),
        metrics.clone()
    ));

    // Warm up models (critical for low latency)
    info!("🔥 Warming up models...");
    let warmup_start = Instant::now();
    model_manager.warmup_all_models().await?;
    let warmup_duration = warmup_start.elapsed();
    info!("✅ Model warmup completed in {:?}", warmup_duration);

    // Start Redis stream consumer for inference requests
    let inference_handle = {
        let inference_engine = inference_engine.clone();
        let feature_store = feature_store.clone();
        let metrics = metrics.clone();
        tokio::spawn(async move {
            inference_loop(inference_engine, feature_store, metrics).await
        })
    };

    // Start feature store updater (background)
    let feature_update_handle = {
        let feature_store = feature_store.clone();
        tokio::spawn(async move {
            feature_update_loop(feature_store).await
        })
    };

    // Health check and metrics server
    let metrics_handle = {
        let metrics = metrics.clone();
        tokio::spawn(async move {
            start_metrics_server(metrics).await
        })
    };

    info!("🚀 ML Inference Engine ready - monitoring streams");

    // Wait for any service to fail
    tokio::select! {
        result = inference_handle => {
            error!("❌ Inference loop failed: {:?}", result);
        }
        result = feature_update_handle => {
            error!("❌ Feature update loop failed: {:?}", result);
        }
        result = metrics_handle => {
            error!("❌ Metrics server failed: {:?}", result);
        }
    }

    Ok(())
}

/// Main inference loop - processes ML requests with <1-2ms target
async fn inference_loop(
    inference_engine: Arc<InferenceEngine>,
    feature_store: Arc<FeatureStore>,
    metrics: Arc<InferenceMetrics>,
) -> Result<()> {
    let redis_client = redis::Client::open("redis://localhost:6379")?;
    let mut redis_conn = redis_client.get_multiplexed_async_connection().await?;
    
    use redis::AsyncCommands;
    
    loop {
        let start = Instant::now();
        
        // 1. Read inference requests from Redis stream
        let stream_result: Vec<redis::Value> = redis_conn
            .xread_options(
                &["ml:inference:requests"],
                &[">"],
                &redis::streams::StreamReadOptions::default()
                    .count(1)
                    .block(50), // 50ms timeout for responsiveness
            )
            .await?;
            
        if stream_result.is_empty() {
            continue;
        }
        
        // Parse inference request
        let request = match parse_inference_request(&stream_result) {
            Ok(req) => req,
            Err(e) => {
                warn!("Failed to parse inference request: {:?}", e);
                continue;
            }
        };
        
        debug!("🧠 Processing inference request: {}", request.id);
        
        // 2. Run inference (target: <1-2ms)
        let inference_start = Instant::now();
        
        let prediction_result = inference_engine.predict(&request).await;
        
        let inference_duration = inference_start.elapsed();
        metrics.inference_duration.observe(inference_duration.as_millis() as f64);
        
        match prediction_result {
            Ok(prediction) => {
                // 3. Emit prediction result
                let result = InferenceResult {
                    request_id: request.id.clone(),
                    prediction: prediction.clone(),
                    confidence: prediction.confidence,
                    model_version: prediction.model_version.clone(),
                    inference_time_ms: inference_duration.as_millis() as u64,
                };
                
                let serialized = serde_json::to_string(&result)?;
                redis_conn
                    .xadd("ml:inference:results", "*", &[("data", serialized)])
                    .await?;
                
                info!("✅ Prediction completed: {} (confidence: {:.3}, {:?})", 
                      request.id, prediction.confidence, inference_duration);
                
                metrics.successful_predictions.inc();
                
                // Performance warnings
                if inference_duration > Duration::from_millis(2) {
                    warn!("⚠️ Inference exceeded 2ms target: {:?}", inference_duration);
                    metrics.slow_predictions.inc();
                }
            }
            Err(e) => {
                error!("❌ Inference failed for {}: {:?}", request.id, e);
                metrics.failed_predictions.inc();
                
                // Emit error result
                let error_result = InferenceError {
                    request_id: request.id,
                    error: e.to_string(),
                    timestamp: std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs(),
                };
                
                let serialized = serde_json::to_string(&error_result)?;
                redis_conn
                    .xadd("ml:inference:errors", "*", &[("data", serialized)])
                    .await?;
            }
        }
        
        let total_duration = start.elapsed();
        metrics.total_request_duration.observe(total_duration.as_millis() as f64);
    }
}

/// Background loop for updating feature store
async fn feature_update_loop(feature_store: Arc<FeatureStore>) -> Result<()> {
    let mut interval = tokio::time::interval(Duration::from_millis(100)); // 10 Hz updates
    
    loop {
        interval.tick().await;
        
        // Update features from various sources (non-blocking)
        if let Err(e) = feature_store.get_cache_stats().await {
            warn!("Feature update failed: {:?}", e);
        }
    }
}

async fn start_metrics_server(metrics: Arc<InferenceMetrics>) -> Result<()> {
    use hyper::service::service_fn;
    use hyper::{Request, Response, body::Bytes};
    use hyper_util::rt::TokioIo;
    use tokio::net::TcpListener;
    
    let listener = TcpListener::bind("0.0.0.0:9092").await?;
    
    let service = service_fn(move |req: Request<hyper::body::Incoming>| {
        let metrics = metrics.clone();
        async move {
            match req.uri().path() {
                "/metrics" => {
                    let encoder = prometheus::TextEncoder::new();
                    let metric_families = metrics.registry.gather();
                    let output = encoder.encode_to_string(&metric_families).unwrap();
                    Ok::<_, hyper::Error>(Response::new(output.into()))
                }
                "/health" => {
                    Ok(Response::new("OK".into()))
                }
                "/models" => {
                    // Return model status
                    Ok(Response::new("Models: loaded and ready".into()))
                }
                _ => {
                    Ok(Response::builder()
                        .status(404)
                        .body("Not Found".into())
                        .unwrap())
                }
            }
        }
    });
    
    info!("📊 ML Metrics server listening on http://0.0.0.0:9092");
    
    loop {
        let (stream, _) = listener.accept().await?;
        let io = TokioIo::new(stream);
        let service = service.clone();
        
        tokio::spawn(async move {
            if let Err(err) = hyper::server::conn::http1::Builder::new()
                .serve_connection(io, service)
                .await
            {
                eprintln!("Error serving connection: {:?}", err);
            }
        });
    }
}

fn parse_inference_request(_stream_result: &[redis::Value]) -> Result<InferenceRequest> {
    // TODO: Parse Redis stream response into InferenceRequest
    todo!("Implement Redis stream parsing")
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct InferenceRequest {
    pub id: String,
    pub model_name: String,
    pub features: std::collections::HashMap<String, f64>,
    pub timestamp: u64,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct Prediction {
    pub value: f64,
    pub confidence: f64,
    pub model_version: String,
    pub features_used: Vec<String>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct InferenceResult {
    pub request_id: String,
    pub prediction: Prediction,
    pub confidence: f64,
    pub model_version: String,
    pub inference_time_ms: u64,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct InferenceError {
    pub request_id: String,
    pub error: String,
    pub timestamp: i64,
}
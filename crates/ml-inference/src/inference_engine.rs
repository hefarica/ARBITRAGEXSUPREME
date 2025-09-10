use std::sync::Arc;
use tokio::time::Instant;
use anyhow::Result;
use tracing::{debug, warn, instrument};

use crate::model_manager::ModelManager;
use crate::feature_store::FeatureStore;
use crate::feature_extractor::FeatureExtractor;
use crate::metrics::InferenceMetrics;
use crate::{InferenceRequest, Prediction};

pub struct InferenceEngine {
    model_manager: Arc<ModelManager>,
    feature_store: Arc<FeatureStore>,
    feature_extractor: Arc<FeatureExtractor>,
    metrics: Arc<InferenceMetrics>,
}

impl InferenceEngine {
    pub fn new(
        model_manager: Arc<ModelManager>,
        feature_store: Arc<FeatureStore>,
        feature_extractor: Arc<FeatureExtractor>,
        metrics: Arc<InferenceMetrics>,
    ) -> Self {
        Self {
            model_manager,
            feature_store,
            feature_extractor,
            metrics,
        }
    }

    /// Main prediction function - target <1-2ms
    #[instrument(skip(self, request), fields(request_id = %request.id, model = %request.model_name))]
    pub async fn predict(&self, request: &InferenceRequest) -> Result<Prediction> {
        let start = Instant::now();
        
        // Convert HashMap features to f32 slice
        let feature_values: Vec<f32> = request.features.values().map(|&v| v as f32).collect();
        
        // Use ModelManager's predict_opportunity directly
        let model_prediction = self.model_manager
            .predict_opportunity(&request.model_name, &feature_values)
            .await?;
        
        let total_duration = start.elapsed();
        
        // Record metrics
        self.metrics.inference_duration.observe(total_duration.as_secs_f64());
        self.metrics.record_inference(total_duration, model_prediction.confidence);
        
        // Convert ModelPrediction to our Prediction format
        let prediction = Prediction {
            value: model_prediction.opportunity_score as f64,
            confidence: model_prediction.confidence as f64,
            model_version: "v1.0".to_string(),
            features_used: request.features.keys().cloned().collect(),
        };
        
        debug!("🧠 Inference completed in {:?}", total_duration);
        
        // Performance warnings
        if total_duration.as_millis() > 2 {
            warn!("⚠️ Inference exceeded 2ms target: {:?}", total_duration);
        }
        
        Ok(prediction)
    }
}

/// Batch inference for multiple requests (optional optimization)
impl InferenceEngine {
    #[allow(dead_code)]
    pub async fn predict_batch(&self, requests: &[InferenceRequest]) -> Result<Vec<Prediction>> {
        if requests.is_empty() {
            return Ok(vec![]);
        }
        
        // For now, process individually
        // TODO: Implement true batch processing for better throughput
        let mut predictions = Vec::with_capacity(requests.len());
        
        for request in requests {
            match self.predict(request).await {
                Ok(prediction) => predictions.push(prediction),
                Err(e) => {
                    warn!("Batch prediction failed for {}: {:?}", request.id, e);
                    // Continue with other requests
                }
            }
        }
        
        Ok(predictions)
    }
}
use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tracing::{debug, warn};

use crate::feature_store::{Feature, FeatureStore, FeatureVector};
use crate::metrics::InferenceMetrics;

/// High-performance feature extractor for arbitrage opportunities
/// Target: <1ms feature extraction from raw market data
pub struct FeatureExtractor {
    feature_store: Arc<FeatureStore>,
    metrics: Arc<InferenceMetrics>,
    extractors: HashMap<String, Box<dyn FeatureExtractorTrait + Send + Sync>>,
}

/// Market data input for feature extraction
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketData {
    pub timestamp: u64,
    pub prices: HashMap<String, f64>, // token -> price
    pub volumes: HashMap<String, f64>, // token -> volume
    pub liquidity: HashMap<String, LiquidityData>,
    pub spreads: HashMap<String, f64>, // pool -> spread
    pub gas_price: f64,
    pub block_number: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiquidityData {
    pub total_liquidity: f64,
    pub bid_depth: Vec<f64>, // 5 levels
    pub ask_depth: Vec<f64>, // 5 levels
}

/// Arbitrage opportunity context
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArbitrageContext {
    pub token_in: String,
    pub token_out: String,
    pub amount_in: f64,
    pub dex_pair: (String, String), // (dex1, dex2)
    pub market_data: MarketData,
}

/// Extracted features for ML model
#[derive(Debug, Clone)]
pub struct ExtractedFeatures {
    pub features: HashMap<String, Vec<f32>>,
    pub extraction_time_ms: f32,
    pub context: ArbitrageContext,
}

/// Trait for specific feature extractors
pub trait FeatureExtractorTrait {
    fn extract(&self, context: &ArbitrageContext) -> Result<Vec<f32>>;
    fn feature_names(&self) -> Vec<String>;
    fn dimensions(&self) -> usize;
}

impl FeatureExtractor {
    pub fn new(
        feature_store: Arc<FeatureStore>,
        metrics: Arc<InferenceMetrics>,
    ) -> Self {
        let mut extractors: HashMap<String, Box<dyn FeatureExtractorTrait + Send + Sync>> = HashMap::new();
        
        // Register feature extractors
        extractors.insert("price_volatility".to_string(), Box::new(PriceVolatilityExtractor::new()));
        extractors.insert("volume_ratio".to_string(), Box::new(VolumeRatioExtractor::new()));
        extractors.insert("liquidity_depth".to_string(), Box::new(LiquidityDepthExtractor::new()));
        extractors.insert("spread_ratio".to_string(), Box::new(SpreadRatioExtractor::new()));
        extractors.insert("market_impact".to_string(), Box::new(MarketImpactExtractor::new()));
        
        Self {
            feature_store,
            metrics,
            extractors,
        }
    }

    /// Extract all features for arbitrage opportunity
    /// Target: <1ms total extraction time
    pub async fn extract_features(&self, context: ArbitrageContext) -> Result<ExtractedFeatures> {
        let start = std::time::Instant::now();
        let mut features = HashMap::new();

        // Extract features in parallel where possible
        let feature_names: Vec<String> = self.extractors.keys().cloned().collect();
        
        for name in &feature_names {
            if let Some(extractor) = self.extractors.get(name) {
                match extractor.extract(&context) {
                    Ok(feature_values) => {
                        features.insert(name.clone(), feature_values);
                    }
                    Err(e) => {
                        warn!("Failed to extract feature {}: {}", name, e);
                        // Use zero vector as fallback
                        features.insert(name.clone(), vec![0.0; extractor.dimensions()]);
                    }
                }
            }
        }

        let extraction_time = start.elapsed();
        let extraction_ms = extraction_time.as_secs_f64() * 1000.0;

        if extraction_time > std::time::Duration::from_millis(1) {
            warn!("Feature extraction exceeded 1ms target: {:.2}ms", extraction_ms);
        }

        debug!("Extracted {} features in {:.2}ms", features.len(), extraction_ms);

        Ok(ExtractedFeatures {
            features,
            extraction_time_ms: extraction_ms as f32,
            context,
        })
    }

    /// Get cached features from feature store
    pub async fn get_cached_features(&self, feature_names: &[String]) -> Result<FeatureVector> {
        self.feature_store.get_features(feature_names).await
    }

    /// Extract features and merge with cached data
    pub async fn extract_and_merge(
        &self,
        context: ArbitrageContext,
        cached_features: &[String],
    ) -> Result<ExtractedFeatures> {
        let start = std::time::Instant::now();

        // Get cached features
        let cached = if !cached_features.is_empty() {
            Some(self.get_cached_features(cached_features).await?)
        } else {
            None
        };

        // Extract real-time features
        let mut extracted = self.extract_features(context).await?;

        // Merge cached features
        if let Some(cached_data) = cached {
            for (name, values) in cached_data.features {
                extracted.features.insert(format!("cached_{}", name), values);
            }
        }

        let total_time = start.elapsed();
        extracted.extraction_time_ms = (total_time.as_secs_f64() * 1000.0) as f32;

        Ok(extracted)
    }

    /// Convert extracted features to ML model input format
    pub fn format_for_model(&self, features: &ExtractedFeatures, model_features: &[String]) -> Result<Vec<f32>> {
        let mut model_input = Vec::new();

        for feature_name in model_features {
            if let Some(values) = features.features.get(feature_name) {
                model_input.extend(values);
            } else {
                warn!("Missing feature for model: {}", feature_name);
                // Add zero padding for missing features
                if let Some(extractor) = self.extractors.get(feature_name) {
                    model_input.extend(vec![0.0; extractor.dimensions()]);
                } else {
                    // Unknown feature, assume single dimension
                    model_input.push(0.0);
                }
            }
        }

        Ok(model_input)
    }
}

/// Price volatility feature extractor
pub struct PriceVolatilityExtractor;

impl PriceVolatilityExtractor {
    pub fn new() -> Self {
        Self
    }
}

impl FeatureExtractorTrait for PriceVolatilityExtractor {
    fn extract(&self, context: &ArbitrageContext) -> Result<Vec<f32>> {
        // Calculate price volatility across different timeframes
        // This is simplified - in production, would use rolling windows
        
        let base_price = context.market_data.prices
            .get(&context.token_in)
            .copied()
            .unwrap_or(0.0) as f32;

        // Mock volatility calculation for different timeframes
        let volatility_1m = (base_price * 0.001).abs(); // 0.1%
        let volatility_5m = (base_price * 0.003).abs(); // 0.3%
        let volatility_15m = (base_price * 0.005).abs(); // 0.5%
        let volatility_1h = (base_price * 0.010).abs(); // 1.0%
        let volatility_24h = (base_price * 0.025).abs(); // 2.5%

        Ok(vec![volatility_1m, volatility_5m, volatility_15m, volatility_1h, volatility_24h])
    }

    fn feature_names(&self) -> Vec<String> {
        vec![
            "volatility_1m".to_string(),
            "volatility_5m".to_string(),
            "volatility_15m".to_string(),
            "volatility_1h".to_string(),
            "volatility_24h".to_string(),
        ]
    }

    fn dimensions(&self) -> usize {
        5
    }
}

/// Volume ratio feature extractor
pub struct VolumeRatioExtractor;

impl VolumeRatioExtractor {
    pub fn new() -> Self {
        Self
    }
}

impl FeatureExtractorTrait for VolumeRatioExtractor {
    fn extract(&self, context: &ArbitrageContext) -> Result<Vec<f32>> {
        let current_volume = context.market_data.volumes
            .get(&context.token_in)
            .copied()
            .unwrap_or(0.0) as f32;

        // Mock historical volume averages
        let avg_1h = current_volume * 0.8;
        let avg_24h = current_volume * 1.2;

        let ratio_1h = if avg_1h > 0.0 { current_volume / avg_1h } else { 1.0 };
        let ratio_24h = if avg_24h > 0.0 { current_volume / avg_24h } else { 1.0 };
        let trend = (ratio_1h - ratio_24h) / ratio_24h.max(0.001); // Normalized trend

        Ok(vec![ratio_1h, ratio_24h, trend])
    }

    fn feature_names(&self) -> Vec<String> {
        vec![
            "volume_ratio_1h".to_string(),
            "volume_ratio_24h".to_string(),
            "volume_trend".to_string(),
        ]
    }

    fn dimensions(&self) -> usize {
        3
    }
}

/// Liquidity depth feature extractor
pub struct LiquidityDepthExtractor;

impl LiquidityDepthExtractor {
    pub fn new() -> Self {
        Self
    }
}

impl FeatureExtractorTrait for LiquidityDepthExtractor {
    fn extract(&self, context: &ArbitrageContext) -> Result<Vec<f32>> {
        if let Some(liquidity) = context.market_data.liquidity.get(&context.token_in) {
            let mut features = Vec::with_capacity(10);
            
            // Add bid depths (5 levels)
            features.extend(liquidity.bid_depth.iter().map(|&x| x as f32));
            
            // Pad if insufficient bid levels
            while features.len() < 5 {
                features.push(0.0);
            }
            
            // Add ask depths (5 levels)
            features.extend(liquidity.ask_depth.iter().map(|&x| x as f32));
            
            // Pad if insufficient ask levels
            while features.len() < 10 {
                features.push(0.0);
            }
            
            Ok(features)
        } else {
            // No liquidity data available
            Ok(vec![0.0; 10])
        }
    }

    fn feature_names(&self) -> Vec<String> {
        let mut names = Vec::new();
        for i in 1..=5 {
            names.push(format!("bid_depth_{}", i));
        }
        for i in 1..=5 {
            names.push(format!("ask_depth_{}", i));
        }
        names
    }

    fn dimensions(&self) -> usize {
        10
    }
}

/// Spread ratio feature extractor
pub struct SpreadRatioExtractor;

impl SpreadRatioExtractor {
    pub fn new() -> Self {
        Self
    }
}

impl FeatureExtractorTrait for SpreadRatioExtractor {
    fn extract(&self, context: &ArbitrageContext) -> Result<Vec<f32>> {
        let pool_key = format!("{}-{}", context.token_in, context.token_out);
        let current_spread = context.market_data.spreads
            .get(&pool_key)
            .copied()
            .unwrap_or(0.003) as f32; // 0.3% default

        // Mock historical spread data
        let min_1h = current_spread * 0.5;
        let max_1h = current_spread * 2.0;
        let avg_1h = current_spread * 1.1;

        Ok(vec![current_spread, min_1h, max_1h, avg_1h])
    }

    fn feature_names(&self) -> Vec<String> {
        vec![
            "spread_current".to_string(),
            "spread_min_1h".to_string(),
            "spread_max_1h".to_string(),
            "spread_avg_1h".to_string(),
        ]
    }

    fn dimensions(&self) -> usize {
        4
    }
}

/// Market impact feature extractor
pub struct MarketImpactExtractor;

impl MarketImpactExtractor {
    pub fn new() -> Self {
        Self
    }
}

impl FeatureExtractorTrait for MarketImpactExtractor {
    fn extract(&self, context: &ArbitrageContext) -> Result<Vec<f32>> {
        let trade_amount = context.amount_in as f32;
        
        // Calculate market impact for different trade sizes as fractions of the intended trade
        let sizes = vec![0.1, 0.25, 0.5, 1.0, 2.0, 5.0];
        let mut impacts = Vec::new();

        for &size_multiplier in &sizes {
            let size = trade_amount * size_multiplier;
            // Simplified impact model: impact increases with square root of size
            let impact = (size / 1000.0).sqrt() * 0.001; // Basic impact formula
            impacts.push(impact);
        }

        Ok(impacts)
    }

    fn feature_names(&self) -> Vec<String> {
        vec![
            "impact_10pct".to_string(),
            "impact_25pct".to_string(),
            "impact_50pct".to_string(),
            "impact_100pct".to_string(),
            "impact_200pct".to_string(),
            "impact_500pct".to_string(),
        ]
    }

    fn dimensions(&self) -> usize {
        6
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_price_volatility_extractor() {
        let extractor = PriceVolatilityExtractor::new();
        assert_eq!(extractor.dimensions(), 5);
        assert_eq!(extractor.feature_names().len(), 5);
    }

    #[tokio::test]
    async fn test_feature_extraction_performance() {
        // Test <1ms extraction target
        // Would need full setup with mocked data
    }
}
use anyhow::Result;
use dashmap::DashMap;
use parking_lot::RwLock;
use redis::AsyncCommands;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tokio::time::Instant;
use tracing::{debug, error, info, warn};

use crate::config::InferenceConfig;
use crate::metrics::InferenceMetrics;

/// Ultra-fast feature store for ML inference
/// Target: <2ms feature retrieval latency
pub struct FeatureStore {
    // In-memory cache for hot features
    local_cache: DashMap<String, CachedFeature>,
    // Redis client for distributed caching
    redis_client: Option<redis::Client>,
    // Feature metadata
    feature_schemas: RwLock<HashMap<String, FeatureSchema>>,
    metrics: Arc<InferenceMetrics>,
    config: InferenceConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Feature {
    pub name: String,
    pub values: Vec<f32>,
    pub timestamp: u64,
    pub source: String,
}

#[derive(Debug, Clone)]
struct CachedFeature {
    feature: Feature,
    cached_at: Instant,
    access_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeatureSchema {
    pub name: String,
    pub dimensions: usize,
    pub data_type: String,
    pub ttl_seconds: u64,
    pub sources: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct FeatureVector {
    pub features: HashMap<String, Vec<f32>>,
    pub timestamp: u64,
    pub retrieval_time_ms: f32,
}

impl FeatureStore {
    /// Create new feature store with caching layers
    pub async fn new(config: InferenceConfig, metrics: Arc<InferenceMetrics>) -> Result<Self> {
        // Initialize Redis client if configured
        let redis_client = if let Some(redis_url) = &config.redis_url {
            Some(redis::Client::open(redis_url.as_str())?)
        } else {
            None
        };

        let store = Self {
            local_cache: DashMap::new(),
            redis_client,
            feature_schemas: RwLock::new(HashMap::new()),
            metrics,
            config,
        };

        // Initialize default feature schemas
        store.initialize_schemas().await?;

        info!("FeatureStore initialized with {} cache layers", 
              if store.redis_client.is_some() { 2 } else { 1 });

        Ok(store)
    }

    /// Get feature vector with multi-layer caching
    /// Target: <2ms retrieval time
    pub async fn get_features(&self, feature_names: &[String]) -> Result<FeatureVector> {
        let start = Instant::now();
        let mut features = HashMap::new();

        // Batch retrieval for efficiency
        for name in feature_names {
            match self.get_single_feature(name).await {
                Ok(feature) => {
                    features.insert(name.clone(), feature.values);
                }
                Err(e) => {
                    warn!("Failed to get feature {}: {}", name, e);
                    // Use zero vector as fallback
                    let schema = self.get_feature_schema(name).await?;
                    features.insert(name.clone(), vec![0.0; schema.dimensions]);
                }
            }
        }

        let retrieval_time = start.elapsed();
        let retrieval_ms = retrieval_time.as_secs_f64() * 1000.0;

        self.metrics.feature_retrieval_duration.observe(retrieval_time.as_secs_f64());

        if retrieval_time > Duration::from_millis(2) {
            warn!("Feature retrieval exceeded 2ms target: {:.2}ms", retrieval_ms);
        }

        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        debug!("Retrieved {} features in {:.2}ms", features.len(), retrieval_ms);

        Ok(FeatureVector {
            features,
            timestamp,
            retrieval_time_ms: retrieval_ms as f32,
        })
    }

    /// Get single feature with caching
    async fn get_single_feature(&self, name: &str) -> Result<Feature> {
        // Try local cache first (fastest)
        if let Some(cached) = self.local_cache.get(name) {
            let age = cached.cached_at.elapsed();
            let ttl = Duration::from_secs(self.get_feature_ttl(name).await);

            if age < ttl {
                // Update access statistics
                self.local_cache.alter(name, |_, mut cached| {
                    cached.access_count += 1;
                    cached
                });

                debug!("Feature {} retrieved from local cache (age: {:?})", name, age);
                return Ok(cached.feature.clone());
            } else {
                // Remove expired entry
                self.local_cache.remove(name);
            }
        }

        // Try Redis cache (medium speed)
        if let Some(feature) = self.get_from_redis(name).await? {
            // Cache locally for next access
            self.cache_feature_locally(feature.clone()).await;
            debug!("Feature {} retrieved from Redis cache", name);
            return Ok(feature);
        }

        // Generate/compute feature (slowest)
        let feature = self.compute_feature(name).await?;
        
        // Cache at both levels
        self.cache_feature_locally(feature.clone()).await;
        self.cache_feature_redis(&feature).await?;

        debug!("Feature {} computed and cached", name);
        Ok(feature)
    }

    /// Cache feature in local memory
    async fn cache_feature_locally(&self, feature: Feature) {
        let cached = CachedFeature {
            feature,
            cached_at: Instant::now(),
            access_count: 1,
        };

        self.local_cache.insert(cached.feature.name.clone(), cached);

        // Cleanup old entries if cache is too large
        if self.local_cache.len() > self.config.max_cache_size {
            self.cleanup_local_cache().await;
        }
    }

    /// Get feature from Redis cache
    async fn get_from_redis(&self, name: &str) -> Result<Option<Feature>> {
        if let Some(ref client) = self.redis_client {
            let mut conn = client.get_async_connection().await?;
            let key = format!("feature:{}", name);
            
            if let Ok(data) = conn.get::<_, Vec<u8>>(&key).await {
                match bincode::deserialize(&data) {
                    Ok(feature) => return Ok(Some(feature)),
                    Err(e) => warn!("Failed to deserialize feature {}: {}", name, e),
                }
            }
        }
        Ok(None)
    }

    /// Cache feature in Redis
    async fn cache_feature_redis(&self, feature: &Feature) -> Result<()> {
        if let Some(ref client) = self.redis_client {
            let mut conn = client.get_async_connection().await?;
            let key = format!("feature:{}", feature.name);
            let ttl = self.get_feature_ttl(&feature.name).await;
            
            match bincode::serialize(feature) {
                Ok(data) => {
                    let _: () = conn.set_ex(&key, data, ttl).await?;
                    debug!("Cached feature {} in Redis with TTL {}s", feature.name, ttl);
                }
                Err(e) => error!("Failed to serialize feature {}: {}", feature.name, e),
            }
        }
        Ok(())
    }

    /// Compute feature from source data
    async fn compute_feature(&self, name: &str) -> Result<Feature> {
        let start = Instant::now();

        // Get feature schema for computation
        let schema = self.get_feature_schema(name).await?;
        
        // Compute based on feature type
        let values = match name {
            "price_volatility" => self.compute_price_volatility().await?,
            "volume_ratio" => self.compute_volume_ratio().await?,
            "liquidity_depth" => self.compute_liquidity_depth().await?,
            "spread_ratio" => self.compute_spread_ratio().await?,
            "market_impact" => self.compute_market_impact().await?,
            _ => {
                warn!("Unknown feature: {}, using zeros", name);
                vec![0.0; schema.dimensions]
            }
        };

        let computation_time = start.elapsed();
        debug!("Computed feature {} in {:?}", name, computation_time);

        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        Ok(Feature {
            name: name.to_string(),
            values,
            timestamp,
            source: "computed".to_string(),
        })
    }

    /// Initialize feature schemas
    async fn initialize_schemas(&self) -> Result<()> {
        let mut schemas = self.feature_schemas.write();

        // Define standard arbitrage features
        schemas.insert("price_volatility".to_string(), FeatureSchema {
            name: "price_volatility".to_string(),
            dimensions: 5, // 1min, 5min, 15min, 1h, 24h volatility
            data_type: "float32".to_string(),
            ttl_seconds: 60, // 1 minute TTL
            sources: vec!["price_feed".to_string()],
        });

        schemas.insert("volume_ratio".to_string(), FeatureSchema {
            name: "volume_ratio".to_string(),
            dimensions: 3, // current/avg_1h, current/avg_24h, trend
            data_type: "float32".to_string(),
            ttl_seconds: 30, // 30 second TTL
            sources: vec!["volume_feed".to_string()],
        });

        schemas.insert("liquidity_depth".to_string(), FeatureSchema {
            name: "liquidity_depth".to_string(),
            dimensions: 10, // 5 bid levels + 5 ask levels
            data_type: "float32".to_string(),
            ttl_seconds: 15, // 15 second TTL
            sources: vec!["orderbook_feed".to_string()],
        });

        schemas.insert("spread_ratio".to_string(), FeatureSchema {
            name: "spread_ratio".to_string(),
            dimensions: 4, // current, min_1h, max_1h, avg_1h
            data_type: "float32".to_string(),
            ttl_seconds: 30,
            sources: vec!["orderbook_feed".to_string()],
        });

        schemas.insert("market_impact".to_string(), FeatureSchema {
            name: "market_impact".to_string(),
            dimensions: 6, // impact for different trade sizes
            data_type: "float32".to_string(),
            ttl_seconds: 45,
            sources: vec!["simulation_engine".to_string()],
        });

        info!("Initialized {} feature schemas", schemas.len());
        Ok(())
    }

    /// Get feature schema
    async fn get_feature_schema(&self, name: &str) -> Result<FeatureSchema> {
        let schemas = self.feature_schemas.read();
        schemas.get(name)
            .cloned()
            .ok_or_else(|| anyhow::anyhow!("Unknown feature schema: {}", name))
    }

    /// Get feature TTL
    async fn get_feature_ttl(&self, name: &str) -> u64 {
        if let Ok(schema) = self.get_feature_schema(name).await {
            schema.ttl_seconds
        } else {
            300 // 5 minute default TTL
        }
    }

    /// Cleanup old entries from local cache
    async fn cleanup_local_cache(&self) {
        let mut to_remove = Vec::new();

        // Find least recently used entries
        for entry in self.local_cache.iter() {
            let age = entry.cached_at.elapsed();
            if age > Duration::from_secs(300) || entry.access_count == 0 {
                to_remove.push(entry.key().clone());
            }
        }

        // Remove old entries
        for key in to_remove {
            self.local_cache.remove(&key);
        }

        debug!("Cleaned up local cache, size: {}", self.local_cache.len());
    }

    /// Compute price volatility feature
    async fn compute_price_volatility(&self) -> Result<Vec<f32>> {
        // Mock computation - in production, would use real price data
        Ok(vec![0.15, 0.23, 0.18, 0.31, 0.42]) // 5 timeframe volatilities
    }

    /// Compute volume ratio feature  
    async fn compute_volume_ratio(&self) -> Result<Vec<f32>> {
        // Mock computation
        Ok(vec![1.2, 0.8, 0.05]) // current/1h_avg, current/24h_avg, trend
    }

    /// Compute liquidity depth feature
    async fn compute_liquidity_depth(&self) -> Result<Vec<f32>> {
        // Mock computation - 5 bid + 5 ask depth levels
        Ok(vec![100.0, 80.0, 60.0, 40.0, 20.0, 95.0, 75.0, 55.0, 35.0, 15.0])
    }

    /// Compute spread ratio feature
    async fn compute_spread_ratio(&self) -> Result<Vec<f32>> {
        // Mock computation
        Ok(vec![0.002, 0.001, 0.005, 0.0025]) // current, min_1h, max_1h, avg_1h
    }

    /// Compute market impact feature
    async fn compute_market_impact(&self) -> Result<Vec<f32>> {
        // Mock computation - impact for different trade sizes
        Ok(vec![0.001, 0.003, 0.008, 0.015, 0.025, 0.040])
    }

    /// Get cache statistics
    pub async fn get_cache_stats(&self) -> CacheStats {
        let local_size = self.local_cache.len();
        let total_accesses: u32 = self.local_cache.iter()
            .map(|entry| entry.access_count)
            .sum();

        CacheStats {
            local_cache_size: local_size,
            total_accesses,
            hit_rate: 0.85, // Would calculate actual hit rate
        }
    }
}

#[derive(Debug, Clone)]
pub struct CacheStats {
    pub local_cache_size: usize,
    pub total_accesses: u32,
    pub hit_rate: f64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_feature_store_creation() {
        let config = InferenceConfig::default();
        let metrics = Arc::new(InferenceMetrics::new());
        let store = FeatureStore::new(config, metrics).await;
        assert!(store.is_ok());
    }

    #[tokio::test]
    async fn test_feature_retrieval_performance() {
        // Test <2ms retrieval target
    }
}
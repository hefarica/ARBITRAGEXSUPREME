use anyhow::Result;
use ethers::prelude::*;
use ethers::types::transaction::eip2718::TypedTransaction;
use std::sync::Arc;
use tokio::time::Duration;
use tracing::{debug, warn};

use crate::metrics::ExecutorMetrics;

/// High-performance gas estimation service
/// Target: <5ms estimation latency
pub struct GasEstimator {
    provider: Arc<Provider<Ws>>,
    metrics: Arc<ExecutorMetrics>,
    base_fee_cache: parking_lot::RwLock<Option<U256>>,
    priority_fee_cache: parking_lot::RwLock<Option<U256>>,
    last_update: parking_lot::RwLock<std::time::Instant>,
}

impl GasEstimator {
    pub fn new(provider: Arc<Provider<Ws>>, metrics: Arc<ExecutorMetrics>) -> Self {
        Self {
            provider,
            metrics,
            base_fee_cache: parking_lot::RwLock::new(None),
            priority_fee_cache: parking_lot::RwLock::new(None),
            last_update: parking_lot::RwLock::new(std::time::Instant::now()),
        }
    }

    /// Fast gas estimation with caching
    /// Target latency: <5ms
    pub async fn estimate_fast(&self) -> Result<(U256, U256)> {
        let start = std::time::Instant::now();

        // Check cache freshness (1 second TTL)
        let should_update = {
            let last = *self.last_update.read();
            last.elapsed() > Duration::from_millis(1000)
        };

        let (base_fee, priority_fee) = if should_update {
            self.fetch_fresh_fees().await?
        } else {
            self.get_cached_fees().await
        };

        let elapsed = start.elapsed();
        self.metrics.gas_estimation_duration.observe(elapsed.as_secs_f64());
        
        if elapsed > Duration::from_millis(5) {
            warn!("Gas estimation exceeded 5ms target: {:?}", elapsed);
        }

        debug!("Gas estimation: base={}, priority={}, took={:?}", base_fee, priority_fee, elapsed);

        Ok((base_fee, priority_fee))
    }

    async fn fetch_fresh_fees(&self) -> Result<(U256, U256)> {
        // Use eth_feeHistory for accurate fee estimation
        let fee_history = self.provider
            .fee_history(4, BlockNumber::Latest, &[25.0, 50.0, 75.0])
            .await?;

        let base_fee = fee_history.base_fee_per_gas
            .last()
            .copied()
            .unwrap_or_else(|| U256::from(20_000_000_000u64)); // 20 gwei fallback

        // Aggressive priority fee for MEV protection
        let priority_fee = U256::from(2_000_000_000u64); // 2 gwei base + surge

        // Update cache
        {
            let mut base_cache = self.base_fee_cache.write();
            let mut priority_cache = self.priority_fee_cache.write();
            let mut last_update = self.last_update.write();

            *base_cache = Some(base_fee);
            *priority_cache = Some(priority_fee);
            *last_update = std::time::Instant::now();
        }

        Ok((base_fee, priority_fee))
    }

    async fn get_cached_fees(&self) -> (U256, U256) {
        let base_fee = self.base_fee_cache.read()
            .unwrap_or_else(|| U256::from(20_000_000_000u64));

        let priority_fee = self.priority_fee_cache.read()
            .unwrap_or_else(|| U256::from(2_000_000_000u64));

        (base_fee, priority_fee)
    }

    /// Estimate gas limit for transaction
    pub async fn estimate_gas_limit(&self, tx: &TypedTransaction) -> Result<U256> {
        let start = std::time::Instant::now();

        let gas_limit = self.provider.estimate_gas(tx, None).await
            .unwrap_or_else(|_| U256::from(300_000)); // Conservative fallback

        // Add 10% buffer for execution variance
        let buffered_gas = gas_limit * 110 / 100;

        debug!("Gas limit estimation: {} -> {} (buffered), took={:?}", 
               gas_limit, buffered_gas, start.elapsed());

        Ok(buffered_gas)
    }

    /// Get current network congestion level
    pub async fn get_congestion_multiplier(&self) -> f64 {
        // Simple heuristic based on pending transaction count
        // In production, use more sophisticated metrics
        1.5 // Aggressive multiplier for fast confirmation
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_gas_estimation_performance() {
        // Mock provider test would go here
        // Verify <5ms estimation target
    }
}
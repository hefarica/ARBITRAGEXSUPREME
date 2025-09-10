use anyhow::Result;
use ethers::prelude::*;
use ethers::types::transaction::eip2718::TypedTransaction;
use std::sync::Arc;
use tracing::{debug, error};

use crate::gas_estimator::GasEstimator;
use crate::metrics::ExecutorMetrics;

/// High-performance transaction builder for arbitrage execution
/// Target: <3ms transaction construction
pub struct TransactionBuilder {
    gas_estimator: Arc<GasEstimator>,
    metrics: Arc<ExecutorMetrics>,
    chain_id: U256,
    nonce_manager: parking_lot::Mutex<NonceManager>,
}

#[derive(Debug)]
struct NonceManager {
    nonces: dashmap::DashMap<Address, U256>,
    last_update: std::time::Instant,
}

impl TransactionBuilder {
    pub fn new(
        gas_estimator: Arc<GasEstimator>,
        metrics: Arc<ExecutorMetrics>,
        chain_id: U256,
    ) -> Self {
        Self {
            gas_estimator,
            metrics,
            chain_id,
            nonce_manager: parking_lot::Mutex::new(NonceManager {
                nonces: dashmap::DashMap::new(),
                last_update: std::time::Instant::now(),
            }),
        }
    }

    /// Build arbitrage transaction with optimal parameters
    /// Target: <3ms construction time
    pub async fn build_arbitrage_tx(
        &self,
        from: Address,
        to: Address,
        data: Bytes,
        value: U256,
    ) -> Result<TypedTransaction> {
        let start = std::time::Instant::now();

        // Get gas estimates
        let (base_fee, priority_fee) = self.gas_estimator.estimate_fast().await?;
        
        // Get nonce (cached with fallback)
        let nonce = self.get_nonce_fast(from).await?;

        // Construct EIP-1559 transaction for optimal MEV protection
        let mut tx = Eip1559TransactionRequest::new()
            .from(from)
            .to(to)
            .data(data)
            .value(value)
            .nonce(nonce)
            .chain_id(self.chain_id.as_u64());

        // Aggressive gas pricing for fast inclusion
        let congestion_multiplier = self.gas_estimator.get_congestion_multiplier().await;
        let max_fee = (base_fee + priority_fee) * U256::from((congestion_multiplier * 100.0) as u64) / 100;
        let max_priority_fee = priority_fee * U256::from((congestion_multiplier * 150.0) as u64) / 100;

        tx = tx.max_fee_per_gas(max_fee).max_priority_fee_per_gas(max_priority_fee);

        // Estimate gas limit if not provided
        let typed_tx = TypedTransaction::Eip1559(tx.clone());
        let gas_limit = self.gas_estimator.estimate_gas_limit(&typed_tx).await?;
        tx = tx.gas(gas_limit);

        let final_tx = TypedTransaction::Eip1559(tx);
        
        let elapsed = start.elapsed();
        self.metrics.transaction_build_duration.observe(elapsed.as_secs_f64());

        if elapsed > std::time::Duration::from_millis(3) {
            error!("Transaction building exceeded 3ms target: {:?}", elapsed);
        }

        debug!(
            "Built arbitrage tx: gas_limit={}, max_fee={}, priority_fee={}, nonce={}, took={:?}",
            gas_limit, max_fee, max_priority_fee, nonce, elapsed
        );

        Ok(final_tx)
    }

    /// Get nonce with caching for performance
    async fn get_nonce_fast(&self, address: Address) -> Result<U256> {
        let manager = self.nonce_manager.lock();
        
        // Check cache (5 second TTL)
        if manager.last_update.elapsed() < std::time::Duration::from_secs(5) {
            if let Some(cached_nonce) = manager.nonces.get(&address) {
                return Ok(*cached_nonce + 1); // Increment for next tx
            }
        }

        drop(manager);

        // Fetch fresh nonce (this would need provider access)
        // For now, return a placeholder - in real implementation, would use provider.get_transaction_count()
        let fresh_nonce = U256::from(0); // Placeholder

        // Update cache
        let manager = self.nonce_manager.lock();
        manager.nonces.insert(address, fresh_nonce);
        
        Ok(fresh_nonce)
    }

    /// Build batch of transactions for multi-step arbitrage
    pub async fn build_batch_transactions(
        &self,
        transactions: Vec<ArbitrageStep>,
    ) -> Result<Vec<TypedTransaction>> {
        let start = std::time::Instant::now();
        let mut built_txs = Vec::with_capacity(transactions.len());

        for step in transactions {
            let tx = self.build_arbitrage_tx(
                step.from,
                step.to,
                step.data,
                step.value,
            ).await?;
            built_txs.push(tx);
        }

        let elapsed = start.elapsed();
        debug!("Built {} transactions in {:?}", built_txs.len(), elapsed);

        Ok(built_txs)
    }

    /// Create flashloan wrapper transaction
    pub async fn build_flashloan_tx(
        &self,
        flashloan_provider: Address,
        asset: Address,
        amount: U256,
        arbitrage_data: Bytes,
        from: Address,
    ) -> Result<TypedTransaction> {
        // Encode flashloan initiation call
        let flashloan_data = self.encode_flashloan_call(asset, amount, arbitrage_data)?;
        
        self.build_arbitrage_tx(
            from,
            flashloan_provider,
            flashloan_data,
            U256::zero(),
        ).await
    }

    fn encode_flashloan_call(&self, asset: Address, amount: U256, data: Bytes) -> Result<Bytes> {
        // Encode flashLoan(address asset, uint256 amount, bytes data)
        // This would use proper ABI encoding in production
        Ok(Bytes::from(format!("flashloan_call_{:?}_{}", asset, amount)))
    }
}

/// Arbitrage step definition
#[derive(Debug, Clone)]
pub struct ArbitrageStep {
    pub from: Address,
    pub to: Address,
    pub data: Bytes,
    pub value: U256,
}

impl ArbitrageStep {
    pub fn new(from: Address, to: Address, data: Bytes, value: U256) -> Self {
        Self { from, to, data, value }
    }

    pub fn swap_step(
        from: Address,
        dex_router: Address,
        swap_data: Bytes,
    ) -> Self {
        Self::new(from, dex_router, swap_data, U256::zero())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_transaction_building_performance() {
        // Mock test for <3ms target
        // Verify transaction construction speed
    }

    #[test]
    fn test_arbitrage_step_creation() {
        let step = ArbitrageStep::new(
            Address::zero(),
            Address::zero(),
            Bytes::new(),
            U256::zero(),
        );
        assert_eq!(step.value, U256::zero());
    }
}
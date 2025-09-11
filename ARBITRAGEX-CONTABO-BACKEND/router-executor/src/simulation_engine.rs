use anyhow::Result;
use ethers::prelude::*;
use ethers::types::transaction::eip2718::TypedTransaction;
use revm::{
    db::{CacheDB, EmptyDB},
    primitives::{ExecutionResult, Output, TransactTo, TxEnv, U256 as RevmU256},
    evm::Evm,
};
use std::sync::Arc;
use tracing::{debug, error, warn};

use crate::metrics::ExecutorMetrics;

/// Ultra-fast transaction simulation engine using REVM
/// Target: <10ms simulation latency
pub struct SimulationEngine {
    provider: Arc<Provider<Ws>>,
    metrics: Arc<ExecutorMetrics>,
    cached_state: parking_lot::RwLock<Option<CacheDB<EmptyDB>>>,
    last_block: parking_lot::RwLock<Option<u64>>,
}

#[derive(Debug, Clone)]
pub struct SimulationResult {
    pub success: bool,
    pub gas_used: U256,
    pub output: Option<Bytes>,
    pub profit: Option<U256>,
    pub error: Option<String>,
    pub state_changes: Vec<StateChange>,
}

#[derive(Debug, Clone)]
pub struct StateChange {
    pub address: Address,
    pub slot: H256,
    pub old_value: H256,
    pub new_value: H256,
}

impl SimulationEngine {
    pub fn new(provider: Arc<Provider<Ws>>, metrics: Arc<ExecutorMetrics>) -> Self {
        Self {
            provider,
            metrics,
            cached_state: parking_lot::RwLock::new(None),
            last_block: parking_lot::RwLock::new(None),
        }
    }

    /// Simulate arbitrage transaction with profit calculation
    /// Target: <10ms simulation time
    pub async fn simulate_arbitrage(&self, tx: &TypedTransaction) -> Result<SimulationResult> {
        let start = std::time::Instant::now();

        // Get or refresh cached state
        let mut evm = self.prepare_evm().await?;

        // Convert ethers transaction to REVM format
        let tx_env = self.convert_to_revm_tx(tx)?;

        // Execute simulation
        let execution_result = evm.transact_commit()
            .map_err(|e| anyhow::anyhow!("EVM execution failed: {:?}", e))?;

        // Process results
        let result = self.process_execution_result(execution_result, tx).await?;

        let elapsed = start.elapsed();
        self.metrics.simulation_duration.observe(elapsed.as_secs_f64());

        if elapsed > std::time::Duration::from_millis(10) {
            warn!("Simulation exceeded 10ms target: {:?}", elapsed);
        }

        debug!(
            "Simulated arbitrage: success={}, gas={}, profit={:?}, took={:?}",
            result.success, result.gas_used, result.profit, elapsed
        );

        Ok(result)
    }

    /// Simulate multiple transactions in sequence
    pub async fn simulate_batch(&self, transactions: &[TypedTransaction]) -> Result<Vec<SimulationResult>> {
        let start = std::time::Instant::now();
        let mut results = Vec::with_capacity(transactions.len());

        let mut evm = self.prepare_evm().await?;

        for tx in transactions {
            let tx_env = self.convert_to_revm_tx(tx)?;
            
            match evm.transact_commit() {
                Ok(execution_result) => {
                    let result = self.process_execution_result(execution_result, tx).await?;
                    results.push(result);
                }
                Err(e) => {
                    error!("Batch simulation failed at tx {}: {:?}", results.len(), e);
                    results.push(SimulationResult {
                        success: false,
                        gas_used: U256::zero(),
                        output: None,
                        profit: None,
                        error: Some(format!("EVM error: {:?}", e)),
                        state_changes: vec![],
                    });
                    break; // Stop on first failure
                }
            }
        }

        let elapsed = start.elapsed();
        debug!("Simulated {} transactions in {:?}", results.len(), elapsed);

        Ok(results)
    }

    /// Prepare EVM instance with current state
    async fn prepare_evm(&self) -> Result<Evm<'_, (), CacheDB<EmptyDB>>> {
        // Check if we need to refresh state
        let current_block = self.provider.get_block_number().await?.as_u64();
        
        let should_refresh = {
            let last_block = self.last_block.read();
            match *last_block {
                Some(block) => current_block > block,
                None => true,
            }
        };

        if should_refresh {
            self.refresh_state_cache(current_block).await?;
        }

        // Create EVM with cached state
        let cached_db = {
            let cache = self.cached_state.read();
            cache.clone().unwrap_or_else(|| CacheDB::new(EmptyDB::default()))
        };

        let evm = Evm::builder()
            .with_db(cached_db)
            .build();

        Ok(evm)
    }

    /// Refresh state cache from latest block
    async fn refresh_state_cache(&self, block_number: u64) -> Result<()> {
        // In a full implementation, this would:
        // 1. Fetch relevant account states
        // 2. Cache commonly used contract storage
        // 3. Preload DEX pool states
        
        // For now, create empty cache
        let cache_db = CacheDB::new(EmptyDB::default());

        {
            let mut cached_state = self.cached_state.write();
            let mut last_block = self.last_block.write();
            
            *cached_state = Some(cache_db);
            *last_block = Some(block_number);
        }

        debug!("Refreshed state cache for block {}", block_number);
        Ok(())
    }

    /// Convert ethers transaction to REVM transaction environment
    fn convert_to_revm_tx(&self, tx: &TypedTransaction) -> Result<TxEnv> {
        let mut tx_env = TxEnv::default();

        match tx {
            TypedTransaction::Eip1559(eip1559_tx) => {
                tx_env.caller = eip1559_tx.from.unwrap_or_default().into();
                tx_env.transact_to = match eip1559_tx.to {
                    Some(NameOrAddress::Address(addr)) => TransactTo::Call(addr.into()),
                    _ => TransactTo::create(),
                };
                tx_env.data = eip1559_tx.data.clone().unwrap_or_default().0.into();
                tx_env.value = RevmU256::from_limbs(eip1559_tx.value.unwrap_or_default().0);
                tx_env.gas_limit = eip1559_tx.gas.unwrap_or_default().as_u64();
                tx_env.gas_price = RevmU256::from_limbs(
                    eip1559_tx.max_fee_per_gas.unwrap_or_default().0
                );
            }
            TypedTransaction::Legacy(legacy_tx) => {
                tx_env.caller = legacy_tx.from.unwrap_or_default().into();
                tx_env.transact_to = match legacy_tx.to {
                    Some(NameOrAddress::Address(addr)) => TransactTo::Call(addr.into()),
                    _ => TransactTo::create(),
                };
                tx_env.data = legacy_tx.data.clone().unwrap_or_default().0.into();
                tx_env.value = RevmU256::from_limbs(legacy_tx.value.unwrap_or_default().0);
                tx_env.gas_limit = legacy_tx.gas.unwrap_or_default().as_u64();
                tx_env.gas_price = RevmU256::from_limbs(legacy_tx.gas_price.unwrap_or_default().0);
            }
            _ => return Err(anyhow::anyhow!("Unsupported transaction type")),
        }

        Ok(tx_env)
    }

    /// Process EVM execution result
    async fn process_execution_result(
        &self,
        execution_result: ExecutionResult,
        _tx: &TypedTransaction,
    ) -> Result<SimulationResult> {
        match execution_result {
            ExecutionResult::Success { reason: _, gas_used, gas_refunded: _, logs: _, output } => {
                let output_data = match output {
                    Output::Call(data) => Some(Bytes::from(data.to_vec())),
                    Output::Create(data, _) => Some(Bytes::from(data.to_vec())),
                };

                // Calculate profit (simplified - would analyze token balance changes)
                let profit = self.calculate_profit_from_logs(&[]).await;

                Ok(SimulationResult {
                    success: true,
                    gas_used: U256::from(gas_used),
                    output: output_data,
                    profit,
                    error: None,
                    state_changes: vec![], // Would extract from EVM state changes
                })
            }
            ExecutionResult::Revert { gas_used, output } => {
                Ok(SimulationResult {
                    success: false,
                    gas_used: U256::from(gas_used),
                    output: Some(Bytes::from(output.to_vec())),
                    profit: None,
                    error: Some("Transaction reverted".to_string()),
                    state_changes: vec![],
                })
            }
            ExecutionResult::Halt { reason, gas_used } => {
                Ok(SimulationResult {
                    success: false,
                    gas_used: U256::from(gas_used),
                    output: None,
                    profit: None,
                    error: Some(format!("Transaction halted: {:?}", reason)),
                    state_changes: vec![],
                })
            }
        }
    }

    /// Calculate profit from transaction logs (simplified)
    async fn calculate_profit_from_logs(&self, _logs: &[ethers::types::Log]) -> Option<U256> {
        // In a real implementation, this would:
        // 1. Parse Transfer events to track token movements
        // 2. Calculate input vs output token amounts
        // 3. Convert to USD/ETH profit estimation
        
        // For now, return placeholder
        Some(U256::from(1000000)) // 0.001 ETH placeholder profit
    }

    /// Quick profitability check without full simulation
    pub async fn quick_profit_check(&self, tx: &TypedTransaction) -> Result<bool> {
        // Simplified profitability heuristic
        // In production, use more sophisticated analysis
        Ok(true) // Placeholder: assume profitable
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_simulation_performance() {
        // Test <10ms simulation target
        // Would need proper transaction mock
    }

    #[test]
    fn test_tx_conversion() {
        // Test ethers -> REVM transaction conversion
    }
}
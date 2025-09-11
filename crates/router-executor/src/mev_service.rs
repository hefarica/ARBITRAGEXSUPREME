// MEV Protection Service Integration
use crate::mev_protection::{MEVProtectionEngine, MEVProtectionConfig};
use ethers::providers::{Provider, Http};
use std::sync::Arc;
use anyhow::Result;

pub struct MEVProtectionService {
    engine: Arc<MEVProtectionEngine>,
}

impl MEVProtectionService {
    pub async fn new(provider: Arc<Provider<Http>>) -> Result<Self> {
        let config = MEVProtectionConfig::default();
        let engine = MEVProtectionEngine::new(config, provider).await?;
        
        Ok(Self {
            engine: Arc::new(engine),
        })
    }
    
    pub async fn protect_arbitrage_execution(
        &self,
        transaction: ethers::core::types::transaction::eip2718::TypedTransaction,
        expected_profit: ethers::types::U256,
        max_priority_fee: ethers::types::U256,
    ) -> Result<crate::mev_protection::MEVProtectionResult> {
        self.engine.execute_protected_arbitrage(
            transaction,
            expected_profit,
            max_priority_fee,
        ).await
    }
}

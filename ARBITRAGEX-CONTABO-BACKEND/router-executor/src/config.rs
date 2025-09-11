use serde::{Deserialize, Serialize};
use anyhow::Result;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutorConfig {
    pub redis_url: String,
    pub signer_count: usize,
    pub flashbots_relays: Vec<String>,
    pub flashbots_private_key: String,
    pub gas_price_multiplier: f64,
    pub max_gas_price: u64,
    pub bundle_timeout_ms: u64,
}

impl ExecutorConfig {
    pub fn from_env() -> Result<Self> {
        Ok(Self {
            redis_url: std::env::var("REDIS_URL")
                .unwrap_or_else(|_| "redis://localhost:6379".to_string()),
            signer_count: std::env::var("SIGNER_COUNT")
                .unwrap_or_else(|_| "5".to_string())
                .parse()?,
            flashbots_relays: vec![
                "https://relay.flashbots.net".to_string(),
                "https://rpc.flashbots.net/fast".to_string(),
            ],
            flashbots_private_key: std::env::var("FLASHBOTS_PRIVATE_KEY")
                .unwrap_or_else(|_| "0x0000000000000000000000000000000000000000000000000000000000000001".to_string()),
            gas_price_multiplier: 1.1,
            max_gas_price: 100_000_000_000, // 100 Gwei
            bundle_timeout_ms: 5000,
        })
    }
}
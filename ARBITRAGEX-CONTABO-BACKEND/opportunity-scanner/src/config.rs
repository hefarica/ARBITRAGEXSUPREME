use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use ethers::types::Address;
use anyhow::Result;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScannerConfig {
    pub redis_url: String,
    pub chains: Vec<ChainConfig>,
    pub dexs: Vec<DexConfig>,
    pub dex_contracts: HashMap<Address, String>,
    pub min_profit_threshold: u64,
    pub max_gas_price: u64,
    pub websocket_timeout_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChainConfig {
    pub id: u64,
    pub name: String,
    pub rpc_urls: Vec<String>,
    pub ws_urls: Vec<String>,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]  
pub struct DexConfig {
    pub name: String,
    pub chain_id: u64,
    pub router_address: Address,
    pub factory_address: Address,
    pub fee_tiers: Vec<u32>,
    pub enabled: bool,
}

impl ScannerConfig {
    pub fn from_env() -> Result<Self> {
        // Default configuration for development
        let mut dex_contracts = HashMap::new();
        
        // Uniswap V3 Router (Ethereum mainnet)
        dex_contracts.insert(
            "0xE592427A0AEce92De3Edee1F18E0157C05861564".parse()?,
            "UniswapV3Router".to_string()
        );
        
        // SushiSwap Router (Ethereum mainnet)
        dex_contracts.insert(
            "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F".parse()?,
            "SushiSwapRouter".to_string()
        );

        Ok(Self {
            redis_url: std::env::var("REDIS_URL")
                .unwrap_or_else(|_| "redis://localhost:6379".to_string()),
            chains: vec![
                ChainConfig {
                    id: 1,
                    name: "Ethereum".to_string(),
                    rpc_urls: vec![
                        "https://eth.llamarpc.com".to_string(),
                        "https://rpc.ankr.com/eth".to_string(),
                    ],
                    ws_urls: vec![
                        "wss://eth-mainnet.g.alchemy.com/v2/demo".to_string(),
                    ],
                    enabled: true,
                },
            ],
            dexs: vec![
                DexConfig {
                    name: "UniswapV3".to_string(),
                    chain_id: 1,
                    router_address: "0xE592427A0AEce92De3Edee1F18E0157C05861564".parse()?,
                    factory_address: "0x1F98431c8aD98523631AE4a59f267346ea31F984".parse()?,
                    fee_tiers: vec![500, 3000, 10000],
                    enabled: true,
                },
            ],
            dex_contracts,
            min_profit_threshold: 1000000000000000, // 0.001 ETH
            max_gas_price: 100000000000, // 100 Gwei
            websocket_timeout_ms: 30000,
        })
    }
}
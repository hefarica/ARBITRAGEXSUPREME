use std::sync::Arc;
use std::collections::HashMap;
use tokio::time::Instant;
use anyhow::Result;
use ethers::types::{Address, U256};
use dashmap::DashMap;
use tracing::{info, debug};

use crate::config::ScannerConfig;
use crate::metrics::ScannerMetrics;

pub struct DexStateManager {
    config: ScannerConfig,
    metrics: Arc<ScannerMetrics>,
    price_cache: Arc<DashMap<(Address, Address), PriceInfo>>,
    pool_cache: Arc<DashMap<Address, PoolInfo>>,
}

#[derive(Debug, Clone)]
pub struct PriceInfo {
    pub buy_price: U256,
    pub sell_price: U256,
    pub confidence: f64,
    pub gas_cost: U256,
    pub last_updated: u64,
}

#[derive(Debug, Clone)]
pub struct PoolInfo {
    pub token0: Address,
    pub token1: Address,
    pub reserve0: U256,
    pub reserve1: U256,
    pub fee_tier: u32,
    pub liquidity: U256,
    pub last_updated: u64,
}

impl DexStateManager {
    pub async fn new(config: ScannerConfig, metrics: Arc<ScannerMetrics>) -> Result<Self> {
        info!("🔄 Initializing DEX state manager for {} DEXs", config.dexs.len());
        
        let price_cache = Arc::new(DashMap::new());
        let pool_cache = Arc::new(DashMap::new());
        
        let manager = Self {
            config,
            metrics,
            price_cache,
            pool_cache,
        };
        
        // Initialize price cache with mock data
        manager.initialize_mock_prices().await?;
        
        Ok(manager)
    }

    /// Get current prices for token pair across all DEXs
    pub async fn get_prices(
        &self, 
        token_in: Address, 
        token_out: Address
    ) -> Result<HashMap<String, PriceInfo>> {
        let start = Instant::now();
        
        let mut prices = HashMap::new();
        
        // Check cache first
        if let Some(cached_price) = self.price_cache.get(&(token_in, token_out)) {
            let current_time = chrono::Utc::now().timestamp() as u64;
            
            // Use cached price if it's less than 5 seconds old
            if current_time - cached_price.last_updated < 5 {
                prices.insert("cached".to_string(), cached_price.clone());
            }
        }
        
        // If no cached price or stale, fetch from DEXs
        if prices.is_empty() {
            prices = self.fetch_live_prices(token_in, token_out).await?;
        }
        
        let elapsed = start.elapsed();
        debug!("💱 Retrieved prices for {}/{} in {:?}", 
               token_in, token_out, elapsed);
        
        Ok(prices)
    }

    async fn fetch_live_prices(
        &self,
        token_in: Address,
        token_out: Address,
    ) -> Result<HashMap<String, PriceInfo>> {
        let mut prices = HashMap::new();
        
        // Simulate fetching from multiple DEXs
        for dex in &self.config.dexs {
            if !dex.enabled {
                continue;
            }
            
            let price_info = self.simulate_dex_price(dex, token_in, token_out).await?;
            prices.insert(dex.name.clone(), price_info);
        }
        
        Ok(prices)
    }

    async fn simulate_dex_price(
        &self,
        _dex: &crate::config::DexConfig,
        _token_in: Address,
        _token_out: Address,
    ) -> Result<PriceInfo> {
        // Simulate realistic DEX price fetching
        let base_price = fastrand::u64(1500..=1600); // ~$1550 base price
        let spread = fastrand::u64(1..=10); // 1-10 basis points spread
        
        let buy_price = U256::from(base_price * 1000000000000000u64); // Convert to wei
        let sell_price = buy_price + U256::from(spread * 1500000000000000u64); // Add spread
        
        let confidence = 0.8 + (fastrand::f64() * 0.2); // 80-100% confidence
        let gas_cost = U256::from(fastrand::u64(150000..=300000) * 20000000000u64); // Gas cost
        
        Ok(PriceInfo {
            buy_price,
            sell_price,
            confidence,
            gas_cost,
            last_updated: chrono::Utc::now().timestamp() as u64,
        })
    }

    async fn initialize_mock_prices(&self) -> Result<()> {
        info!("🔄 Initializing mock price cache");
        
        // Add some common token pairs for testing
        let weth = Address::random();
        let usdc = Address::random();
        let usdt = Address::random();
        
        let pairs = vec![
            (weth, usdc),
            (weth, usdt),
            (usdc, usdt),
        ];
        
        for (token0, token1) in pairs {
            let price_info = PriceInfo {
                buy_price: U256::from(1550 * 1000000000000000000u64), // $1550 in wei
                sell_price: U256::from(1551 * 1000000000000000000u64), // $1551 in wei
                confidence: 0.95,
                gas_cost: U256::from(200000 * 30000000000u64), // 200k gas * 30 gwei
                last_updated: chrono::Utc::now().timestamp() as u64,
            };
            
            self.price_cache.insert((token0, token1), price_info.clone());
            self.price_cache.insert((token1, token0), price_info);
        }
        
        info!("✅ Initialized {} price pairs", self.price_cache.len());
        Ok(())
    }
}
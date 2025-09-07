//! # Strategy Compatibility Matrix
//! 
//! Generates and serves compatibility matrix showing which strategies
//! are available for each chain/DEX/asset/lender combination.

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use tracing::{debug, info, warn};

/// Compatibility matrix entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompatibilityEntry {
    pub strategy_id: String,
    pub strategy_name: String,
    pub chain_id: u64,
    pub dex_name: String,
    pub lender_name: Option<String>,
    pub asset_pair: (String, String),
    pub requirements_met: bool,
    pub failure_reasons: Vec<String>,
    pub estimated_gas: Option<u64>,
    pub min_profit_threshold: Option<f64>,
    pub max_position_size: Option<f64>,
}

/// DEX configuration and capabilities
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DexInfo {
    pub name: String,
    pub chain_id: u64,
    pub router_address: String,
    pub factory_address: String,
    pub supports_flash_swap: bool,
    pub supported_fee_tiers: Vec<u32>,
    pub twap_stability_score: f64, // 0.0-1.0
    pub min_liquidity_threshold: f64,
    pub gas_overhead: u64,
    pub is_active: bool,
}

/// Lending protocol information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LenderInfo {
    pub name: String,
    pub chain_id: u64,
    pub protocol_address: String,
    pub supported_assets: Vec<String>,
    pub flash_loan_fee_bps: u32, // Basis points (e.g., 9 = 0.09%)
    pub max_loan_amount: HashMap<String, f64>,
    pub reserves_healthy: bool,
    pub is_active: bool,
}

/// Asset whitelist and configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssetInfo {
    pub symbol: String,
    pub address: String,
    pub chain_id: u64,
    pub decimals: u8,
    pub is_whitelisted: bool,
    pub min_trade_amount: f64,
    pub max_trade_amount: f64,
    pub volatility_score: f64, // 0.0-1.0
    pub liquidity_score: f64,  // 0.0-1.0
}

/// Strategy requirements definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StrategyRequirements {
    pub id: String,
    pub name: String,
    pub requires_flash_loan: bool,
    pub requires_flash_swap: bool,
    pub min_liquidity_usd: f64,
    pub max_slippage_bps: u32,
    pub min_twap_stability: f64,
    pub supported_chains: Vec<u64>,
    pub blacklisted_assets: Vec<String>,
    pub min_profit_bps: u32,
    pub max_gas_limit: u64,
    pub complexity_score: u8, // 1-10
}

/// Compatibility matrix manager
pub struct CompatibilityMatrix {
    strategies: Vec<StrategyRequirements>,
    dexes: HashMap<(u64, String), DexInfo>, // (chain_id, name) -> info
    lenders: HashMap<(u64, String), LenderInfo>, // (chain_id, name) -> info
    assets: HashMap<(u64, String), AssetInfo>, // (chain_id, symbol) -> info
    cached_matrix: Option<Vec<CompatibilityEntry>>,
    last_update: std::time::Instant,
    cache_ttl: std::time::Duration,
}

impl CompatibilityMatrix {
    /// Create new compatibility matrix
    pub fn new() -> Self {
        Self {
            strategies: Vec::new(),
            dexes: HashMap::new(),
            lenders: HashMap::new(),
            assets: HashMap::new(),
            cached_matrix: None,
            last_update: std::time::Instant::now(),
            cache_ttl: std::time::Duration::from_secs(300), // 5 minutes
        }
    }

    /// Initialize with default ArbitrageX strategies
    pub fn initialize_default_strategies(&mut self) {
        info!("Initializing default ArbitrageX strategies");
        
        self.strategies = vec![
            StrategyRequirements {
                id: "S001".to_string(),
                name: "Simple DEX Arbitrage".to_string(),
                requires_flash_loan: false,
                requires_flash_swap: true,
                min_liquidity_usd: 10000.0,
                max_slippage_bps: 50, // 0.5%
                min_twap_stability: 0.8,
                supported_chains: vec![1, 42161, 8453, 10, 137], // ETH, ARB, BASE, OP, POLY
                blacklisted_assets: vec![],
                min_profit_bps: 20, // 0.2%
                max_gas_limit: 200000,
                complexity_score: 2,
            },
            StrategyRequirements {
                id: "S002".to_string(),
                name: "Triangular Arbitrage".to_string(),
                requires_flash_loan: false,
                requires_flash_swap: true,
                min_liquidity_usd: 50000.0,
                max_slippage_bps: 75,
                min_twap_stability: 0.9,
                supported_chains: vec![1, 42161, 8453],
                blacklisted_assets: vec!["SHIB".to_string(), "DOGE".to_string()],
                min_profit_bps: 30,
                max_gas_limit: 350000,
                complexity_score: 4,
            },
            StrategyRequirements {
                id: "S004".to_string(),
                name: "JIT Liquidity + Backrun".to_string(),
                requires_flash_loan: true,
                requires_flash_swap: true,
                min_liquidity_usd: 100000.0,
                max_slippage_bps: 25,
                min_twap_stability: 0.95,
                supported_chains: vec![1, 42161], // Only ETH and Arbitrum
                blacklisted_assets: vec!["USDT".to_string()], // Avoid USDT for complexity
                min_profit_bps: 50,
                max_gas_limit: 500000,
                complexity_score: 8,
            },
            StrategyRequirements {
                id: "S007".to_string(),
                name: "Flash Loan Arbitrage".to_string(),
                requires_flash_loan: true,
                requires_flash_swap: false,
                min_liquidity_usd: 25000.0,
                max_slippage_bps: 100,
                min_twap_stability: 0.7,
                supported_chains: vec![1, 42161, 8453, 10, 137],
                blacklisted_assets: vec![],
                min_profit_bps: 25,
                max_gas_limit: 300000,
                complexity_score: 5,
            },
            StrategyRequirements {
                id: "S011".to_string(),
                name: "Statistical Z-Score Advanced".to_string(),
                requires_flash_loan: true,
                requires_flash_swap: false,
                min_liquidity_usd: 200000.0,
                max_slippage_bps: 30,
                min_twap_stability: 0.98,
                supported_chains: vec![1], // Only Ethereum mainnet
                blacklisted_assets: vec!["SHIB".to_string(), "DOGE".to_string(), "PEPE".to_string()],
                min_profit_bps: 15,
                max_gas_limit: 800000,
                complexity_score: 10,
            },
            StrategyRequirements {
                id: "S016".to_string(),
                name: "Multi-DEX Triangular".to_string(),
                requires_flash_loan: false,
                requires_flash_swap: true,
                min_liquidity_usd: 75000.0,
                max_slippage_bps: 60,
                min_twap_stability: 0.85,
                supported_chains: vec![1, 42161, 8453],
                blacklisted_assets: vec!["USDT".to_string()],
                min_profit_bps: 40,
                max_gas_limit: 450000,
                complexity_score: 7,
            },
            StrategyRequirements {
                id: "S018".to_string(),
                name: "NFT Arbitrage".to_string(),
                requires_flash_loan: true,
                requires_flash_swap: false,
                min_liquidity_usd: 50000.0,
                max_slippage_bps: 200, // NFTs have higher slippage tolerance
                min_twap_stability: 0.6,
                supported_chains: vec![1, 42161], // ETH and Arbitrum have NFT markets
                blacklisted_assets: vec![], // NFTs use different asset rules
                min_profit_bps: 100, // 1% minimum for NFT arb
                max_gas_limit: 600000,
                complexity_score: 9,
            },
            StrategyRequirements {
                id: "S020".to_string(),
                name: "Governance + MEV Protection".to_string(),
                requires_flash_loan: true,
                requires_flash_swap: true,
                min_liquidity_usd: 500000.0,
                max_slippage_bps: 10, // Very tight slippage for governance
                min_twap_stability: 0.99,
                supported_chains: vec![1], // Only Ethereum for governance
                blacklisted_assets: vec!["SHIB".to_string(), "DOGE".to_string()],
                min_profit_bps: 75,
                max_gas_limit: 1000000,
                complexity_score: 10,
            },
        ];
    }

    /// Load DEX configurations
    pub async fn load_dex_configurations(&mut self) -> Result<()> {
        info!("Loading DEX configurations");
        
        // Ethereum Mainnet DEXes
        self.add_dex(DexInfo {
            name: "Uniswap V3".to_string(),
            chain_id: 1,
            router_address: "0xE592427A0AEce92De3Edee1F18E0157C05861564".to_string(),
            factory_address: "0x1F98431c8aD98523631AE4a59f267346ea31F984".to_string(),
            supports_flash_swap: true,
            supported_fee_tiers: vec![100, 500, 3000, 10000],
            twap_stability_score: 0.95,
            min_liquidity_threshold: 50000.0,
            gas_overhead: 180000,
            is_active: true,
        });

        self.add_dex(DexInfo {
            name: "Uniswap V2".to_string(),
            chain_id: 1,
            router_address: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D".to_string(),
            factory_address: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f".to_string(),
            supports_flash_swap: true,
            supported_fee_tiers: vec![300], // 0.3% fixed
            twap_stability_score: 0.90,
            min_liquidity_threshold: 25000.0,
            gas_overhead: 150000,
            is_active: true,
        });

        self.add_dex(DexInfo {
            name: "SushiSwap".to_string(),
            chain_id: 1,
            router_address: "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F".to_string(),
            factory_address: "0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac".to_string(),
            supports_flash_swap: true,
            supported_fee_tiers: vec![300],
            twap_stability_score: 0.85,
            min_liquidity_threshold: 20000.0,
            gas_overhead: 160000,
            is_active: true,
        });

        // Arbitrum DEXes
        self.add_dex(DexInfo {
            name: "Uniswap V3".to_string(),
            chain_id: 42161,
            router_address: "0xE592427A0AEce92De3Edee1F18E0157C05861564".to_string(),
            factory_address: "0x1F98431c8aD98523631AE4a59f267346ea31F984".to_string(),
            supports_flash_swap: true,
            supported_fee_tiers: vec![100, 500, 3000, 10000],
            twap_stability_score: 0.92,
            min_liquidity_threshold: 30000.0,
            gas_overhead: 120000, // Lower gas on Arbitrum
            is_active: true,
        });

        // Base DEXes
        self.add_dex(DexInfo {
            name: "Uniswap V3".to_string(),
            chain_id: 8453,
            router_address: "0x2626664c2603336E57B271c5C0b26F421741e481".to_string(),
            factory_address: "0x33128a8fC17869897dcE68Ed026d694621f6FDfD".to_string(),
            supports_flash_swap: true,
            supported_fee_tiers: vec![500, 3000, 10000],
            twap_stability_score: 0.88,
            min_liquidity_threshold: 20000.0,
            gas_overhead: 110000,
            is_active: true,
        });

        Ok(())
    }

    /// Load lending protocol configurations
    pub async fn load_lender_configurations(&mut self) -> Result<()> {
        info!("Loading lending protocol configurations");
        
        // Ethereum Lenders
        self.add_lender(LenderInfo {
            name: "Aave V3".to_string(),
            chain_id: 1,
            protocol_address: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2".to_string(),
            supported_assets: vec![
                "WETH".to_string(), "USDC".to_string(), "USDT".to_string(),
                "DAI".to_string(), "WBTC".to_string(), "LINK".to_string(),
            ],
            flash_loan_fee_bps: 9, // 0.09%
            max_loan_amount: {
                let mut amounts = HashMap::new();
                amounts.insert("WETH".to_string(), 10000.0);
                amounts.insert("USDC".to_string(), 50000000.0);
                amounts.insert("DAI".to_string(), 40000000.0);
                amounts
            },
            reserves_healthy: true,
            is_active: true,
        });

        self.add_lender(LenderInfo {
            name: "Balancer V2".to_string(),
            chain_id: 1,
            protocol_address: "0xBA12222222228d8Ba445958a75a0704d566BF2C8".to_string(),
            supported_assets: vec![
                "WETH".to_string(), "USDC".to_string(), "DAI".to_string(), "WBTC".to_string(),
            ],
            flash_loan_fee_bps: 0, // 0% fee!
            max_loan_amount: {
                let mut amounts = HashMap::new();
                amounts.insert("WETH".to_string(), 5000.0);
                amounts.insert("USDC".to_string(), 20000000.0);
                amounts
            },
            reserves_healthy: true,
            is_active: true,
        });

        // Arbitrum Lenders
        self.add_lender(LenderInfo {
            name: "Aave V3".to_string(),
            chain_id: 42161,
            protocol_address: "0x794a61358D6845594F94dc1DB02A252b5b4814aD".to_string(),
            supported_assets: vec![
                "WETH".to_string(), "USDC".to_string(), "USDT".to_string(), "DAI".to_string(),
            ],
            flash_loan_fee_bps: 9,
            max_loan_amount: {
                let mut amounts = HashMap::new();
                amounts.insert("WETH".to_string(), 3000.0);
                amounts.insert("USDC".to_string(), 15000000.0);
                amounts
            },
            reserves_healthy: true,
            is_active: true,
        });

        Ok(())
    }

    /// Load asset whitelist
    pub async fn load_asset_whitelist(&mut self) -> Result<()> {
        info!("Loading asset whitelist");
        
        let assets = vec![
            // Ethereum assets
            ("WETH", "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", 1, 18, true, 0.01, 1000.0, 0.3, 0.95),
            ("USDC", "0xA0b86a33E6417c53c3b4C74c5196c65223509234", 1, 6, true, 100.0, 10000000.0, 0.1, 0.98),
            ("USDT", "0xdAC17F958D2ee523a2206206994597C13D831ec7", 1, 6, true, 100.0, 10000000.0, 0.1, 0.96),
            ("DAI", "0x6B175474E89094C44Da98b954EedeAC495271d0F", 1, 18, true, 10.0, 5000000.0, 0.1, 0.94),
            ("WBTC", "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", 1, 8, true, 0.001, 100.0, 0.4, 0.90),
            ("LINK", "0x514910771AF9Ca656af840dff83E8264EcF986CA", 1, 18, true, 1.0, 100000.0, 0.5, 0.85),
            
            // High volatility assets (lower limits)
            ("SHIB", "0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE", 1, 18, true, 1000000.0, 1000000000.0, 0.9, 0.60),
            ("DOGE", "0x4206931337dc273a630d328dA6441786BfaD668f", 1, 8, true, 100.0, 1000000.0, 0.8, 0.70),
            ("PEPE", "0x6982508145454Ce325dDbE47a25d4ec3d2311933", 1, 18, true, 100000.0, 10000000000.0, 0.95, 0.50),
        ];

        for (symbol, address, chain_id, decimals, whitelisted, min_amount, max_amount, volatility, liquidity) in assets {
            self.add_asset(AssetInfo {
                symbol: symbol.to_string(),
                address: address.to_string(),
                chain_id,
                decimals,
                is_whitelisted: whitelisted,
                min_trade_amount: min_amount,
                max_trade_amount: max_amount,
                volatility_score: volatility,
                liquidity_score: liquidity,
            });
        }

        Ok(())
    }

    /// Generate compatibility matrix
    pub async fn generate_matrix(&mut self) -> Result<Vec<CompatibilityEntry>> {
        // Check cache first
        if let Some(ref cached) = self.cached_matrix {
            if self.last_update.elapsed() < self.cache_ttl {
                debug!("Returning cached compatibility matrix");
                return Ok(cached.clone());
            }
        }

        info!("Generating fresh compatibility matrix");
        let mut matrix = Vec::new();

        // For each strategy, check compatibility with all combinations
        for strategy in &self.strategies {
            for ((chain_id, dex_name), dex_info) in &self.dexes {
                if !strategy.supported_chains.contains(chain_id) {
                    continue;
                }

                // Get assets for this chain
                let chain_assets: Vec<_> = self.assets
                    .iter()
                    .filter(|((asset_chain_id, _), _)| asset_chain_id == chain_id)
                    .collect();

                // Generate asset pairs
                for i in 0..chain_assets.len() {
                    for j in (i + 1)..chain_assets.len() {
                        let asset1 = &chain_assets[i].1;
                        let asset2 = &chain_assets[j].1;
                        
                        let entry = self.check_compatibility(
                            strategy,
                            dex_info,
                            None, // No specific lender for this check
                            asset1,
                            asset2,
                        ).await;
                        
                        matrix.push(entry);
                    }
                }
            }
        }

        // Update cache
        self.cached_matrix = Some(matrix.clone());
        self.last_update = std::time::Instant::now();

        info!("Generated compatibility matrix with {} entries", matrix.len());
        Ok(matrix)
    }

    /// Get compatibility matrix with filtering
    pub async fn get_filtered_matrix(
        &mut self,
        strategy_id: Option<&str>,
        chain_id: Option<u64>,
        only_compatible: bool,
    ) -> Result<Vec<CompatibilityEntry>> {
        let full_matrix = self.generate_matrix().await?;
        
        let filtered: Vec<CompatibilityEntry> = full_matrix
            .into_iter()
            .filter(|entry| {
                if let Some(sid) = strategy_id {
                    if entry.strategy_id != sid {
                        return false;
                    }
                }
                
                if let Some(cid) = chain_id {
                    if entry.chain_id != cid {
                        return false;
                    }
                }
                
                if only_compatible && !entry.requirements_met {
                    return false;
                }
                
                true
            })
            .collect();
        
        Ok(filtered)
    }

    /// Internal: Add DEX info
    fn add_dex(&mut self, dex: DexInfo) {
        self.dexes.insert((dex.chain_id, dex.name.clone()), dex);
    }

    /// Internal: Add lender info
    fn add_lender(&mut self, lender: LenderInfo) {
        self.lenders.insert((lender.chain_id, lender.name.clone()), lender);
    }

    /// Internal: Add asset info
    fn add_asset(&mut self, asset: AssetInfo) {
        self.assets.insert((asset.chain_id, asset.symbol.clone()), asset);
    }

    /// Internal: Check compatibility for specific combination
    async fn check_compatibility(
        &self,
        strategy: &StrategyRequirements,
        dex: &DexInfo,
        lender: Option<&LenderInfo>,
        asset1: &AssetInfo,
        asset2: &AssetInfo,
    ) -> CompatibilityEntry {
        let mut requirements_met = true;
        let mut failure_reasons = Vec::new();

        // Check if DEX is active
        if !dex.is_active {
            requirements_met = false;
            failure_reasons.push(format!("DEX {} is inactive", dex.name));
        }

        // Check TWAP stability
        if dex.twap_stability_score < strategy.min_twap_stability {
            requirements_met = false;
            failure_reasons.push(format!(
                "TWAP stability {:.2} < required {:.2}",
                dex.twap_stability_score, strategy.min_twap_stability
            ));
        }

        // Check flash swap support
        if strategy.requires_flash_swap && !dex.supports_flash_swap {
            requirements_met = false;
            failure_reasons.push("Flash swap required but not supported".to_string());
        }

        // Check flash loan requirements
        if strategy.requires_flash_loan {
            let has_compatible_lender = self.lenders
                .values()
                .any(|l| {
                    l.chain_id == dex.chain_id &&
                    l.is_active &&
                    l.reserves_healthy &&
                    l.supported_assets.contains(&asset1.symbol) &&
                    l.supported_assets.contains(&asset2.symbol)
                });
            
            if !has_compatible_lender {
                requirements_met = false;
                failure_reasons.push("No compatible flash loan provider".to_string());
            }
        }

        // Check asset whitelist
        if !asset1.is_whitelisted || !asset2.is_whitelisted {
            requirements_met = false;
            failure_reasons.push("Asset not whitelisted".to_string());
        }

        // Check blacklisted assets
        if strategy.blacklisted_assets.contains(&asset1.symbol) ||
           strategy.blacklisted_assets.contains(&asset2.symbol) {
            requirements_met = false;
            failure_reasons.push("Asset is blacklisted for this strategy".to_string());
        }

        // Check liquidity thresholds
        let min_liquidity = (asset1.liquidity_score * asset2.liquidity_score) * 100000.0; // Rough estimate
        if min_liquidity < strategy.min_liquidity_usd {
            requirements_met = false;
            failure_reasons.push(format!(
                "Insufficient liquidity: ${:.0} < ${:.0}",
                min_liquidity, strategy.min_liquidity_usd
            ));
        }

        // Estimate gas cost
        let estimated_gas = Some(dex.gas_overhead + (strategy.complexity_score as u64 * 25000));

        // Calculate profit threshold
        let min_profit_threshold = Some(strategy.min_profit_bps as f64 / 10000.0);

        CompatibilityEntry {
            strategy_id: strategy.id.clone(),
            strategy_name: strategy.name.clone(),
            chain_id: dex.chain_id,
            dex_name: dex.name.clone(),
            lender_name: lender.map(|l| l.name.clone()),
            asset_pair: (asset1.symbol.clone(), asset2.symbol.clone()),
            requirements_met,
            failure_reasons,
            estimated_gas,
            min_profit_threshold,
            max_position_size: Some(asset1.max_trade_amount.min(asset2.max_trade_amount)),
        }
    }
}

/// Summary statistics for the compatibility matrix
#[derive(Debug, Clone, Serialize)]
pub struct CompatibilityStats {
    pub total_combinations: usize,
    pub compatible_combinations: usize,
    pub compatibility_rate: f64,
    pub strategies_with_opportunities: usize,
    pub chains_supported: usize,
    pub dexes_active: usize,
    pub lenders_available: usize,
    pub top_failure_reasons: Vec<(String, usize)>,
}
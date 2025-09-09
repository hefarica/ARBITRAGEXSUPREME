// ================================
// ArbitrageX Supreme V3.0 - Multi-Chain Configuration
// Configuración para 20+ blockchains con Real-Only policy
// ================================

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::env;

// ================================
// Estructuras de Configuración
// ================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockchainConfig {
    pub chain_id: u64,
    pub name: String,
    pub display_name: String,
    pub rpc_url: String,
    pub explorer_url: String,
    pub native_token: TokenConfig,
    pub block_time_ms: u64,
    pub gas_price_gwei: Option<f64>,
    pub supports_flash_loans: bool,
    pub is_active: bool,
    pub priority: u8, // 1 = highest, 5 = lowest
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenConfig {
    pub symbol: String,
    pub name: String,
    pub decimals: u8,
    pub address: Option<String>, // None para tokens nativos
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExchangeConfig {
    pub name: String,
    pub protocol_type: ExchangeProtocol,
    pub factory_address: String,
    pub router_address: String,
    pub fee_bps: u16, // Base points (30 = 0.3%)
    pub supports_flash_swaps: bool,
    pub min_liquidity_usd: f64,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ExchangeProtocol {
    UniswapV2,
    UniswapV3,
    SushiSwap,
    PancakeSwap,
    Curve,
    Balancer,
    TraderJoe,
    Spookyswap,
    QuickSwap,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlashLoanProviderConfig {
    pub name: String,
    pub protocol_type: FlashLoanProtocol,
    pub contract_address: String,
    pub fee_rate: f64, // 0.0009 = 0.09%
    pub max_amount_eth: f64,
    pub is_active: bool,
    pub priority: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FlashLoanProtocol {
    AaveV3,
    UniswapV3,
    BalancerV2,
    DydxSolo,
    CompoundV2,
}

// ================================
// Configuración Multi-Chain
// ================================

pub struct MultiChainConfig {
    pub chains: HashMap<u64, BlockchainConfig>,
    pub exchanges: HashMap<u64, Vec<ExchangeConfig>>,
    pub flash_loan_providers: HashMap<u64, Vec<FlashLoanProviderConfig>>,
}

impl MultiChainConfig {
    pub fn new() -> Self {
        let mut config = Self {
            chains: HashMap::new(),
            exchanges: HashMap::new(),
            flash_loan_providers: HashMap::new(),
        };

        config.initialize_chains();
        config.initialize_exchanges();
        config.initialize_flash_loan_providers();
        config
    }

    // ================================
    // Configuración de Blockchains
    // ================================

    fn initialize_chains(&mut self) {
        // Ethereum Mainnet
        self.chains.insert(1, BlockchainConfig {
            chain_id: 1,
            name: "ethereum".to_string(),
            display_name: "Ethereum".to_string(),
            rpc_url: env::var("MAINNET_RPC_URL").unwrap_or_else(|_| 
                "https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY".to_string()
            ),
            explorer_url: "https://etherscan.io".to_string(),
            native_token: TokenConfig {
                symbol: "ETH".to_string(),
                name: "Ethereum".to_string(),
                decimals: 18,
                address: None,
            },
            block_time_ms: 12000,
            gas_price_gwei: Some(20.0),
            supports_flash_loans: true,
            is_active: true,
            priority: 1,
        });

        // Arbitrum One
        self.chains.insert(42161, BlockchainConfig {
            chain_id: 42161,
            name: "arbitrum".to_string(),
            display_name: "Arbitrum One".to_string(),
            rpc_url: env::var("ARBITRUM_RPC_URL").unwrap_or_else(|_| 
                "https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY".to_string()
            ),
            explorer_url: "https://arbiscan.io".to_string(),
            native_token: TokenConfig {
                symbol: "ETH".to_string(),
                name: "Ethereum".to_string(),
                decimals: 18,
                address: None,
            },
            block_time_ms: 1000,
            gas_price_gwei: Some(0.1),
            supports_flash_loans: true,
            is_active: true,
            priority: 1,
        });

        // Polygon
        self.chains.insert(137, BlockchainConfig {
            chain_id: 137,
            name: "polygon".to_string(),
            display_name: "Polygon".to_string(),
            rpc_url: env::var("POLYGON_RPC_URL").unwrap_or_else(|_| 
                "https://polygon-mainnet.g.alchemy.com/v2/YOUR_KEY".to_string()
            ),
            explorer_url: "https://polygonscan.com".to_string(),
            native_token: TokenConfig {
                symbol: "MATIC".to_string(),
                name: "Polygon".to_string(),
                decimals: 18,
                address: None,
            },
            block_time_ms: 2000,
            gas_price_gwei: Some(30.0),
            supports_flash_loans: true,
            is_active: true,
            priority: 2,
        });

        // Optimism
        self.chains.insert(10, BlockchainConfig {
            chain_id: 10,
            name: "optimism".to_string(),
            display_name: "Optimism".to_string(),
            rpc_url: env::var("OPTIMISM_RPC_URL").unwrap_or_else(|_| 
                "https://opt-mainnet.g.alchemy.com/v2/YOUR_KEY".to_string()
            ),
            explorer_url: "https://optimistic.etherscan.io".to_string(),
            native_token: TokenConfig {
                symbol: "ETH".to_string(),
                name: "Ethereum".to_string(),
                decimals: 18,
                address: None,
            },
            block_time_ms: 2000,
            gas_price_gwei: Some(0.001),
            supports_flash_loans: true,
            is_active: true,
            priority: 1,
        });

        // BSC (Binance Smart Chain)
        self.chains.insert(56, BlockchainConfig {
            chain_id: 56,
            name: "bsc".to_string(),
            display_name: "BNB Smart Chain".to_string(),
            rpc_url: env::var("BSC_RPC_URL").unwrap_or_else(|_| 
                "https://bsc-dataseed1.binance.org/".to_string()
            ),
            explorer_url: "https://bscscan.com".to_string(),
            native_token: TokenConfig {
                symbol: "BNB".to_string(),
                name: "BNB".to_string(),
                decimals: 18,
                address: None,
            },
            block_time_ms: 3000,
            gas_price_gwei: Some(5.0),
            supports_flash_loans: false,
            is_active: true,
            priority: 2,
        });

        // Avalanche C-Chain
        self.chains.insert(43114, BlockchainConfig {
            chain_id: 43114,
            name: "avalanche".to_string(),
            display_name: "Avalanche C-Chain".to_string(),
            rpc_url: env::var("AVALANCHE_RPC_URL").unwrap_or_else(|_| 
                "https://api.avax.network/ext/bc/C/rpc".to_string()
            ),
            explorer_url: "https://snowtrace.io".to_string(),
            native_token: TokenConfig {
                symbol: "AVAX".to_string(),
                name: "Avalanche".to_string(),
                decimals: 18,
                address: None,
            },
            block_time_ms: 2000,
            gas_price_gwei: Some(25.0),
            supports_flash_loans: true,
            is_active: true,
            priority: 2,
        });

        // Fantom Opera
        self.chains.insert(250, BlockchainConfig {
            chain_id: 250,
            name: "fantom".to_string(),
            display_name: "Fantom Opera".to_string(),
            rpc_url: env::var("FANTOM_RPC_URL").unwrap_or_else(|_| 
                "https://rpc.ftm.tools/".to_string()
            ),
            explorer_url: "https://ftmscan.com".to_string(),
            native_token: TokenConfig {
                symbol: "FTM".to_string(),
                name: "Fantom".to_string(),
                decimals: 18,
                address: None,
            },
            block_time_ms: 1000,
            gas_price_gwei: Some(50.0),
            supports_flash_loans: false,
            is_active: true,
            priority: 3,
        });

        // Base
        self.chains.insert(8453, BlockchainConfig {
            chain_id: 8453,
            name: "base".to_string(),
            display_name: "Base".to_string(),
            rpc_url: env::var("BASE_RPC_URL").unwrap_or_else(|_| 
                "https://base-mainnet.g.alchemy.com/v2/YOUR_KEY".to_string()
            ),
            explorer_url: "https://basescan.org".to_string(),
            native_token: TokenConfig {
                symbol: "ETH".to_string(),
                name: "Ethereum".to_string(),
                decimals: 18,
                address: None,
            },
            block_time_ms: 2000,
            gas_price_gwei: Some(0.01),
            supports_flash_loans: true,
            is_active: true,
            priority: 1,
        });

        // Agregar más chains según necesidad...
    }

    // ================================
    // Configuración de Exchanges
    // ================================

    fn initialize_exchanges(&mut self) {
        // Ethereum Exchanges
        self.exchanges.insert(1, vec![
            ExchangeConfig {
                name: "Uniswap V2".to_string(),
                protocol_type: ExchangeProtocol::UniswapV2,
                factory_address: "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f".to_string(),
                router_address: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D".to_string(),
                fee_bps: 30,
                supports_flash_swaps: true,
                min_liquidity_usd: 50000.0,
                is_active: true,
            },
            ExchangeConfig {
                name: "Uniswap V3".to_string(),
                protocol_type: ExchangeProtocol::UniswapV3,
                factory_address: "0x1F98431c8aD98523631AE4a59f267346ea31F984".to_string(),
                router_address: "0xE592427A0AEce92De3Edee1F18E0157C05861564".to_string(),
                fee_bps: 5, // Variable fees
                supports_flash_swaps: true,
                min_liquidity_usd: 100000.0,
                is_active: true,
            },
            ExchangeConfig {
                name: "SushiSwap".to_string(),
                protocol_type: ExchangeProtocol::SushiSwap,
                factory_address: "0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac".to_string(),
                router_address: "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F".to_string(),
                fee_bps: 30,
                supports_flash_swaps: true,
                min_liquidity_usd: 25000.0,
                is_active: true,
            },
        ]);

        // Arbitrum Exchanges
        self.exchanges.insert(42161, vec![
            ExchangeConfig {
                name: "Uniswap V3".to_string(),
                protocol_type: ExchangeProtocol::UniswapV3,
                factory_address: "0x1F98431c8aD98523631AE4a59f267346ea31F984".to_string(),
                router_address: "0xE592427A0AEce92De3Edee1F18E0157C05861564".to_string(),
                fee_bps: 5,
                supports_flash_swaps: true,
                min_liquidity_usd: 50000.0,
                is_active: true,
            },
            ExchangeConfig {
                name: "SushiSwap".to_string(),
                protocol_type: ExchangeProtocol::SushiSwap,
                factory_address: "0xc35DADB65012eC5796536bD9864eD8773aBc74C4".to_string(),
                router_address: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506".to_string(),
                fee_bps: 30,
                supports_flash_swaps: true,
                min_liquidity_usd: 25000.0,
                is_active: true,
            },
        ]);

        // Polygon Exchanges
        self.exchanges.insert(137, vec![
            ExchangeConfig {
                name: "QuickSwap".to_string(),
                protocol_type: ExchangeProtocol::QuickSwap,
                factory_address: "0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32".to_string(),
                router_address: "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff".to_string(),
                fee_bps: 30,
                supports_flash_swaps: false,
                min_liquidity_usd: 10000.0,
                is_active: true,
            },
            ExchangeConfig {
                name: "SushiSwap".to_string(),
                protocol_type: ExchangeProtocol::SushiSwap,
                factory_address: "0xc35DADB65012eC5796536bD9864eD8773aBc74C4".to_string(),
                router_address: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506".to_string(),
                fee_bps: 30,
                supports_flash_swaps: true,
                min_liquidity_usd: 20000.0,
                is_active: true,
            },
        ]);

        // BSC Exchanges
        self.exchanges.insert(56, vec![
            ExchangeConfig {
                name: "PancakeSwap V2".to_string(),
                protocol_type: ExchangeProtocol::PancakeSwap,
                factory_address: "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73".to_string(),
                router_address: "0x10ED43C718714eb63d5aA57B78B54704E256024E".to_string(),
                fee_bps: 25,
                supports_flash_swaps: false,
                min_liquidity_usd: 15000.0,
                is_active: true,
            },
        ]);

        // Agregar más exchanges según la chain...
    }

    // ================================
    // Configuración de Flash Loan Providers
    // ================================

    fn initialize_flash_loan_providers(&mut self) {
        // Ethereum Flash Loan Providers
        self.flash_loan_providers.insert(1, vec![
            FlashLoanProviderConfig {
                name: "Aave V3".to_string(),
                protocol_type: FlashLoanProtocol::AaveV3,
                contract_address: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2".to_string(),
                fee_rate: 0.0009, // 0.09%
                max_amount_eth: 1000000.0,
                is_active: true,
                priority: 1,
            },
            FlashLoanProviderConfig {
                name: "Uniswap V3".to_string(),
                protocol_type: FlashLoanProtocol::UniswapV3,
                contract_address: "0x1F98431c8aD98523631AE4a59f267346ea31F984".to_string(),
                fee_rate: 0.0000, // Fee dinámico
                max_amount_eth: 500000.0,
                is_active: true,
                priority: 2,
            },
            FlashLoanProviderConfig {
                name: "Balancer V2".to_string(),
                protocol_type: FlashLoanProtocol::BalancerV2,
                contract_address: "0xBA12222222228d8Ba445958a75a0704d566BF2C8".to_string(),
                fee_rate: 0.0000,
                max_amount_eth: 300000.0,
                is_active: true,
                priority: 2,
            },
            FlashLoanProviderConfig {
                name: "dYdX Solo".to_string(),
                protocol_type: FlashLoanProtocol::DydxSolo,
                contract_address: "0x1E0447b19BB6EcFdAe1e4AE1694b0C3659614e4e".to_string(),
                fee_rate: 0.0002,
                max_amount_eth: 200000.0,
                is_active: true,
                priority: 3,
            },
        ]);

        // Arbitrum Flash Loan Providers
        self.flash_loan_providers.insert(42161, vec![
            FlashLoanProviderConfig {
                name: "Aave V3".to_string(),
                protocol_type: FlashLoanProtocol::AaveV3,
                contract_address: "0x794a61358D6845594F94dc1DB02A252b5b4814aD".to_string(),
                fee_rate: 0.0009,
                max_amount_eth: 500000.0,
                is_active: true,
                priority: 1,
            },
        ]);

        // Polygon Flash Loan Providers
        self.flash_loan_providers.insert(137, vec![
            FlashLoanProviderConfig {
                name: "Aave V3".to_string(),
                protocol_type: FlashLoanProtocol::AaveV3,
                contract_address: "0x794a61358D6845594F94dc1DB02A252b5b4814aD".to_string(),
                fee_rate: 0.0009,
                max_amount_eth: 300000.0,
                is_active: true,
                priority: 1,
            },
        ]);

        // Continuar con más providers según necesidad...
    }

    // ================================
    // Métodos de Consulta
    // ================================

    pub fn get_active_chains(&self) -> Vec<&BlockchainConfig> {
        let mut chains: Vec<&BlockchainConfig> = self.chains
            .values()
            .filter(|chain| chain.is_active)
            .collect();
        
        chains.sort_by(|a, b| a.priority.cmp(&b.priority));
        chains
    }

    pub fn get_chain(&self, chain_id: u64) -> Option<&BlockchainConfig> {
        self.chains.get(&chain_id)
    }

    pub fn get_exchanges(&self, chain_id: u64) -> Vec<&ExchangeConfig> {
        self.exchanges
            .get(&chain_id)
            .map(|exchanges| exchanges.iter().filter(|ex| ex.is_active).collect())
            .unwrap_or_default()
    }

    pub fn get_flash_loan_providers(&self, chain_id: u64) -> Vec<&FlashLoanProviderConfig> {
        let mut providers = self.flash_loan_providers
            .get(&chain_id)
            .map(|providers| providers.iter().filter(|p| p.is_active).collect())
            .unwrap_or_default();
        
        providers.sort_by(|a, b| a.priority.cmp(&b.priority));
        providers
    }

    pub fn supports_flash_loans(&self, chain_id: u64) -> bool {
        self.chains
            .get(&chain_id)
            .map(|chain| chain.supports_flash_loans)
            .unwrap_or(false)
    }

    pub fn get_best_flash_loan_provider(&self, chain_id: u64) -> Option<&FlashLoanProviderConfig> {
        self.get_flash_loan_providers(chain_id).into_iter().next()
    }

    pub fn get_rpc_url(&self, chain_id: u64) -> Option<String> {
        self.chains.get(&chain_id).map(|chain| chain.rpc_url.clone())
    }

    pub fn get_block_time(&self, chain_id: u64) -> Option<u64> {
        self.chains.get(&chain_id).map(|chain| chain.block_time_ms)
    }

    pub fn is_chain_active(&self, chain_id: u64) -> bool {
        self.chains
            .get(&chain_id)
            .map(|chain| chain.is_active)
            .unwrap_or(false)
    }
}
// ArbitrageX Pro 2025 - Near Protocol Arbitrage Contract
// Implementación en Rust para Near blockchain
// Optimizado para Ref Finance, Trisolaris, Jumbo Exchange, Orderly Network

use near_sdk::borsh::{self, BorshDeserialize, BorshSerialize};
use near_sdk::collections::{LazyOption, LookupMap, UnorderedMap};
use near_sdk::json_types::{U128, U64};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{
    env, near_bindgen, AccountId, Balance, Gas, PanicOnDefault, Promise, PromiseResult,
};

// Gas constants para Near Protocol
const GAS_FOR_RESOLVE_TRANSFER: Gas = Gas(10_000_000_000_000);
const GAS_FOR_FT_TRANSFER_CALL: Gas = Gas(25_000_000_000_000 + GAS_FOR_RESOLVE_TRANSFER.0);
const GAS_FOR_SWAP: Gas = Gas(20_000_000_000_000);
const NO_DEPOSIT: Balance = 0;
const ONE_YOCTO: Balance = 1;

#[near_bindgen]
#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
pub struct NearArbitrageContract {
    /// Propietario del contrato
    pub owner: AccountId,
    
    /// Estado de pausa
    pub is_paused: bool,
    
    /// Configuración de arbitraje
    pub min_profit_bps: u16, // 0.25% para Near (fast finality)
    pub max_slippage_bps: u16, // 1% max slippage
    
    /// Estadísticas
    pub total_volume: U128,
    pub total_profit: U128,
    pub executed_trades: u64,
    
    /// DEXs soportados y sus configuraciones
    pub supported_dexs: UnorderedMap<String, DexConfig>,
    
    /// Tokens soportados
    pub supported_tokens: UnorderedMap<AccountId, TokenInfo>,
    
    /// Pools y su liquidez
    pub pool_liquidities: UnorderedMap<String, U128>,
    
    /// Rutas de arbitraje activas
    pub active_routes: UnorderedMap<String, ArbitrageRoute>,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct DexConfig {
    pub dex_type: DexType,
    pub contract_address: AccountId,
    pub fee_bps: u16, // Fee en basis points
    pub is_active: bool,
    pub min_liquidity: U128,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct TokenInfo {
    pub decimals: u8,
    pub symbol: String,
    pub is_active: bool,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub struct ArbitrageRoute {
    pub token_a: AccountId,
    pub token_b: AccountId,
    pub token_c: Option<AccountId>, // Para triangular
    pub first_dex: String,
    pub second_dex: String,
    pub third_dex: Option<String>, // Para triangular
    pub min_profit_bps: u16,
    pub is_active: bool,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub enum DexType {
    RefFinance,
    Trisolaris,
    Jumbo,
    Orderly,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct SwapArgs {
    pub token_in: AccountId,
    pub token_out: AccountId,
    pub amount_in: U128,
    pub min_amount_out: U128,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct ArbitrageParams {
    pub route_id: String,
    pub amount_in: U128,
    pub min_profit: U128,
    pub deadline: U64, // timestamp
}

#[derive(Serialize, Deserialize)]
#[serde(crate = "near_sdk::serde")]
pub struct ArbitrageResult {
    pub success: bool,
    pub amount_out: U128,
    pub profit: U128,
    pub gas_used: U64,
    pub execution_time_ms: u64,
}

#[near_bindgen]
impl NearArbitrageContract {
    
    #[init]
    pub fn new(owner: AccountId) -> Self {
        assert!(!env::state_exists(), "Contract is already initialized");
        
        let mut contract = Self {
            owner,
            is_paused: false,
            min_profit_bps: 25, // 0.25% para Near
            max_slippage_bps: 100, // 1% max slippage
            total_volume: U128(0),
            total_profit: U128(0),
            executed_trades: 0,
            supported_dexs: UnorderedMap::new(b"dexs"),
            supported_tokens: UnorderedMap::new(b"tokens"),
            pool_liquidities: UnorderedMap::new(b"pools"),
            active_routes: UnorderedMap::new(b"routes"),
        };
        
        // Inicializar DEXs principales de Near
        contract.initialize_near_dexs();
        contract.initialize_near_tokens();
        
        contract
    }

    /// Ejecuta arbitraje simple entre dos DEXs
    #[payable]
    pub fn execute_simple_arbitrage(
        &mut self,
        params: ArbitrageParams,
    ) -> Promise {
        self.assert_not_paused();
        self.assert_owner();
        
        let route = self.active_routes.get(&params.route_id)
            .expect("Route not found");
        
        assert!(route.is_active, "Route is not active");
        assert!(route.token_c.is_none(), "Use triangular method for 3-token routes");
        
        let start_time = env::block_timestamp_ms();
        
        // Primera swap en el primer DEX
        self.execute_first_swap(
            route.clone(),
            params.clone(),
            start_time,
        )
    }
    
    /// Ejecuta arbitraje triangular (A -> B -> C -> A)
    #[payable]
    pub fn execute_triangular_arbitrage(
        &mut self,
        params: ArbitrageParams,
    ) -> Promise {
        self.assert_not_paused();
        self.assert_owner();
        
        let route = self.active_routes.get(&params.route_id)
            .expect("Route not found");
        
        assert!(route.is_active, "Route is not active");
        assert!(route.token_c.is_some(), "Use simple method for 2-token routes");
        
        let start_time = env::block_timestamp_ms();
        
        // Primera swap: A -> B
        self.execute_triangular_first_swap(
            route.clone(),
            params.clone(),
            start_time,
        )
    }
    
    /// Ejecuta arbitraje usando Ref Finance
    #[payable]
    pub fn execute_ref_finance_arbitrage(
        &mut self,
        token_in: AccountId,
        token_out: AccountId,
        amount_in: U128,
        min_amount_out: U128,
        pool_id: u64,
    ) -> Promise {
        self.assert_not_paused();
        
        let ref_config = self.supported_dexs.get("ref_finance")
            .expect("Ref Finance not configured");
        
        // Crear argumentos para Ref Finance
        let swap_args = near_sdk::serde_json::to_string(&SwapArgs {
            token_in: token_in.clone(),
            token_out: token_out.clone(),
            amount_in,
            min_amount_out,
        }).unwrap();
        
        // Llamar a Ref Finance
        Promise::new(ref_config.contract_address.clone())
            .function_call(
                "ft_transfer_call".to_string(),
                swap_args.as_bytes().to_vec(),
                ONE_YOCTO,
                GAS_FOR_FT_TRANSFER_CALL,
            )
            .then(Promise::new(env::current_account_id())
                .function_call(
                    "resolve_ref_arbitrage".to_string(),
                    near_sdk::serde_json::to_string(&(token_in, token_out, amount_in)).unwrap().as_bytes().to_vec(),
                    NO_DEPOSIT,
                    GAS_FOR_RESOLVE_TRANSFER,
                ))
    }
    
    /// Callback para resolver arbitraje de Ref Finance
    pub fn resolve_ref_arbitrage(
        &mut self,
        token_in: AccountId,
        token_out: AccountId,
        amount_in: U128,
        #[callback_result] call_result: Result<U128, near_sdk::PromiseError>,
    ) -> ArbitrageResult {
        match call_result {
            Ok(amount_out) => {
                let profit = amount_out.0.saturating_sub(amount_in.0);
                let min_profit = (amount_in.0 * self.min_profit_bps as u128) / 10000;
                
                if profit >= min_profit {
                    // Actualizar estadísticas
                    self.total_volume = U128(self.total_volume.0.saturating_add(amount_in.0));
                    self.total_profit = U128(self.total_profit.0.saturating_add(profit));
                    self.executed_trades = self.executed_trades.saturating_add(1);
                    
                    env::log_str(&format!(
                        "Ref arbitrage successful: {} -> {}, profit: {}",
                        amount_in.0, amount_out.0, profit
                    ));
                    
                    ArbitrageResult {
                        success: true,
                        amount_out,
                        profit: U128(profit),
                        gas_used: U64(env::used_gas().0),
                        execution_time_ms: env::block_timestamp_ms(),
                    }
                } else {
                    ArbitrageResult {
                        success: false,
                        amount_out: U128(0),
                        profit: U128(0),
                        gas_used: U64(env::used_gas().0),
                        execution_time_ms: env::block_timestamp_ms(),
                    }
                }
            }
            Err(_) => {
                ArbitrageResult {
                    success: false,
                    amount_out: U128(0),
                    profit: U128(0),
                    gas_used: U64(env::used_gas().0),
                    execution_time_ms: env::block_timestamp_ms(),
                }
            }
        }
    }
    
    /// Ejecuta swap en primera fase del arbitraje simple
    fn execute_first_swap(
        &self,
        route: ArbitrageRoute,
        params: ArbitrageParams,
        start_time: u64,
    ) -> Promise {
        let first_dex_config = self.supported_dexs.get(&route.first_dex)
            .expect("First DEX not found");
        
        let swap_args = self.build_swap_args(
            &route.token_a,
            &route.token_b,
            params.amount_in,
            first_dex_config.dex_type.clone(),
        );
        
        Promise::new(first_dex_config.contract_address.clone())
            .function_call(
                "swap".to_string(),
                swap_args.as_bytes().to_vec(),
                ONE_YOCTO,
                GAS_FOR_SWAP,
            )
            .then(Promise::new(env::current_account_id())
                .function_call(
                    "resolve_first_swap".to_string(),
                    near_sdk::serde_json::to_string(&(route, params, start_time)).unwrap().as_bytes().to_vec(),
                    NO_DEPOSIT,
                    GAS_FOR_RESOLVE_TRANSFER,
                ))
    }
    
    /// Callback para resolver primera swap
    pub fn resolve_first_swap(
        &mut self,
        route: ArbitrageRoute,
        params: ArbitrageParams,
        start_time: u64,
        #[callback_result] call_result: Result<U128, near_sdk::PromiseError>,
    ) -> Promise {
        match call_result {
            Ok(amount_b) => {
                // Ejecutar segunda swap para completar arbitraje
                self.execute_second_swap(route, params, amount_b, start_time)
            }
            Err(_) => {
                env::log_str("First swap failed");
                Promise::new(env::current_account_id())
                    .function_call(
                        "return_failed_result".to_string(),
                        "{}".as_bytes().to_vec(),
                        NO_DEPOSIT,
                        Gas(1_000_000_000_000),
                    )
            }
        }
    }
    
    /// Ejecuta segunda swap para completar arbitraje
    fn execute_second_swap(
        &self,
        route: ArbitrageRoute,
        params: ArbitrageParams,
        amount_b: U128,
        start_time: u64,
    ) -> Promise {
        let second_dex_config = self.supported_dexs.get(&route.second_dex)
            .expect("Second DEX not found");
        
        let swap_args = self.build_swap_args(
            &route.token_b,
            &route.token_a,
            amount_b,
            second_dex_config.dex_type.clone(),
        );
        
        Promise::new(second_dex_config.contract_address.clone())
            .function_call(
                "swap".to_string(),
                swap_args.as_bytes().to_vec(),
                ONE_YOCTO,
                GAS_FOR_SWAP,
            )
            .then(Promise::new(env::current_account_id())
                .function_call(
                    "resolve_second_swap".to_string(),
                    near_sdk::serde_json::to_string(&(params, start_time)).unwrap().as_bytes().to_vec(),
                    NO_DEPOSIT,
                    GAS_FOR_RESOLVE_TRANSFER,
                ))
    }
    
    /// Callback para resolver segunda swap y finalizar arbitraje
    pub fn resolve_second_swap(
        &mut self,
        params: ArbitrageParams,
        start_time: u64,
        #[callback_result] call_result: Result<U128, near_sdk::PromiseError>,
    ) -> ArbitrageResult {
        let end_time = env::block_timestamp_ms();
        let execution_time = end_time.saturating_sub(start_time);
        
        match call_result {
            Ok(final_amount) => {
                let profit = final_amount.0.saturating_sub(params.amount_in.0);
                
                if profit >= params.min_profit.0 {
                    // Actualizar estadísticas
                    self.total_volume = U128(self.total_volume.0.saturating_add(params.amount_in.0));
                    self.total_profit = U128(self.total_profit.0.saturating_add(profit));
                    self.executed_trades = self.executed_trades.saturating_add(1);
                    
                    env::log_str(&format!(
                        "Arbitrage completed: input={}, output={}, profit={}, time={}ms",
                        params.amount_in.0, final_amount.0, profit, execution_time
                    ));
                    
                    ArbitrageResult {
                        success: true,
                        amount_out: final_amount,
                        profit: U128(profit),
                        gas_used: U64(env::used_gas().0),
                        execution_time_ms: execution_time,
                    }
                } else {
                    env::log_str(&format!("Insufficient profit: expected {}, got {}", params.min_profit.0, profit));
                    
                    ArbitrageResult {
                        success: false,
                        amount_out: final_amount,
                        profit: U128(0),
                        gas_used: U64(env::used_gas().0),
                        execution_time_ms: execution_time,
                    }
                }
            }
            Err(_) => {
                env::log_str("Second swap failed");
                
                ArbitrageResult {
                    success: false,
                    amount_out: U128(0),
                    profit: U128(0),
                    gas_used: U64(env::used_gas().0),
                    execution_time_ms: execution_time,
                }
            }
        }
    }
    
    /// Ejecuta primera swap del arbitraje triangular
    fn execute_triangular_first_swap(
        &self,
        route: ArbitrageRoute,
        params: ArbitrageParams,
        start_time: u64,
    ) -> Promise {
        let first_dex_config = self.supported_dexs.get(&route.first_dex)
            .expect("First DEX not found");
        
        let swap_args = self.build_swap_args(
            &route.token_a,
            &route.token_b,
            params.amount_in,
            first_dex_config.dex_type.clone(),
        );
        
        Promise::new(first_dex_config.contract_address.clone())
            .function_call(
                "swap".to_string(),
                swap_args.as_bytes().to_vec(),
                ONE_YOCTO,
                GAS_FOR_SWAP,
            )
            .then(Promise::new(env::current_account_id())
                .function_call(
                    "resolve_triangular_first_swap".to_string(),
                    near_sdk::serde_json::to_string(&(route, params, start_time)).unwrap().as_bytes().to_vec(),
                    NO_DEPOSIT,
                    GAS_FOR_RESOLVE_TRANSFER,
                ))
    }
    
    /// Construye argumentos para swap según el tipo de DEX
    fn build_swap_args(
        &self,
        token_in: &AccountId,
        token_out: &AccountId,
        amount_in: U128,
        dex_type: DexType,
    ) -> String {
        match dex_type {
            DexType::RefFinance => {
                near_sdk::serde_json::to_string(&SwapArgs {
                    token_in: token_in.clone(),
                    token_out: token_out.clone(),
                    amount_in,
                    min_amount_out: U128(0), // Se calcula dinámicamente
                }).unwrap()
            }
            DexType::Trisolaris => {
                // Argumentos específicos para Trisolaris
                near_sdk::serde_json::to_string(&SwapArgs {
                    token_in: token_in.clone(),
                    token_out: token_out.clone(),
                    amount_in,
                    min_amount_out: U128(0),
                }).unwrap()
            }
            DexType::Jumbo => {
                // Argumentos específicos para Jumbo Exchange
                near_sdk::serde_json::to_string(&SwapArgs {
                    token_in: token_in.clone(),
                    token_out: token_out.clone(),
                    amount_in,
                    min_amount_out: U128(0),
                }).unwrap()
            }
            DexType::Orderly => {
                // Argumentos específicos para Orderly Network
                near_sdk::serde_json::to_string(&SwapArgs {
                    token_in: token_in.clone(),
                    token_out: token_out.clone(),
                    amount_in,
                    min_amount_out: U128(0),
                }).unwrap()
            }
        }
    }
    
    /// Inicializar DEXs principales de Near
    fn initialize_near_dexs(&mut self) {
        // Ref Finance - Principal DEX de Near
        self.supported_dexs.insert(&"ref_finance".to_string(), &DexConfig {
            dex_type: DexType::RefFinance,
            contract_address: "v2.ref-finance.near".parse().unwrap(),
            fee_bps: 25, // 0.25%
            is_active: true,
            min_liquidity: U128(10_000_000_000_000_000_000_000), // 10k NEAR
        });
        
        // Trisolaris - Popular DEX
        self.supported_dexs.insert(&"trisolaris".to_string(), &DexConfig {
            dex_type: DexType::Trisolaris,
            contract_address: "exchange.trisolaris.near".parse().unwrap(),
            fee_bps: 30, // 0.3%
            is_active: true,
            min_liquidity: U128(5_000_000_000_000_000_000_000), // 5k NEAR
        });
        
        // Jumbo Exchange
        self.supported_dexs.insert(&"jumbo".to_string(), &DexConfig {
            dex_type: DexType::Jumbo,
            contract_address: "jumbo_exchange.near".parse().unwrap(),
            fee_bps: 20, // 0.2%
            is_active: true,
            min_liquidity: U128(2_000_000_000_000_000_000_000), // 2k NEAR
        });
        
        // Orderly Network
        self.supported_dexs.insert(&"orderly".to_string(), &DexConfig {
            dex_type: DexType::Orderly,
            contract_address: "spot.orderly-network.near".parse().unwrap(),
            fee_bps: 10, // 0.1%
            is_active: true,
            min_liquidity: U128(1_000_000_000_000_000_000_000), // 1k NEAR
        });
    }
    
    /// Inicializar tokens principales de Near
    fn initialize_near_tokens(&mut self) {
        // NEAR nativo
        self.supported_tokens.insert(&"wrap.near".parse().unwrap(), &TokenInfo {
            decimals: 24,
            symbol: "wNEAR".to_string(),
            is_active: true,
        });
        
        // USDC
        self.supported_tokens.insert(&"a0b86991c31cc170df0e301e1329c16954ee626c".parse().unwrap(), &TokenInfo {
            decimals: 6,
            symbol: "USDC".to_string(),
            is_active: true,
        });
        
        // USDT
        self.supported_tokens.insert(&"dac17f958d2ee523a2206206994597c13d831ec7".parse().unwrap(), &TokenInfo {
            decimals: 6,
            symbol: "USDT".to_string(),
            is_active: true,
        });
        
        // wETH
        self.supported_tokens.insert(&"c02aaa39b223fe8d0a0e5c4f27ead9083c756cc2".parse().unwrap(), &TokenInfo {
            decimals: 18,
            symbol: "wETH".to_string(),
            is_active: true,
        });
    }
    
    // Utility functions
    
    fn assert_owner(&self) {
        assert_eq!(env::predecessor_account_id(), self.owner, "Only owner can call this method");
    }
    
    fn assert_not_paused(&self) {
        assert!(!self.is_paused, "Contract is paused");
    }
    
    /// Actualiza configuración del contrato
    pub fn update_config(&mut self, min_profit_bps: u16, max_slippage_bps: u16) {
        self.assert_owner();
        
        assert!(min_profit_bps >= 5 && min_profit_bps <= 500, "Invalid min profit");
        assert!(max_slippage_bps >= 10 && max_slippage_bps <= 1000, "Invalid max slippage");
        
        self.min_profit_bps = min_profit_bps;
        self.max_slippage_bps = max_slippage_bps;
        
        env::log_str(&format!("Config updated: min_profit={}bps, max_slippage={}bps", 
                            min_profit_bps, max_slippage_bps));
    }
    
    /// Pausa/despausa el contrato
    pub fn set_pause_state(&mut self, is_paused: bool) {
        self.assert_owner();
        self.is_paused = is_paused;
        env::log_str(&format!("Contract pause state: {}", is_paused));
    }
    
    /// Obtiene estadísticas del contrato
    pub fn get_stats(&self) -> (U128, U128, u64) {
        (self.total_volume, self.total_profit, self.executed_trades)
    }
    
    /// Obtiene información de un DEX
    pub fn get_dex_info(&self, dex_name: String) -> Option<DexConfig> {
        self.supported_dexs.get(&dex_name)
    }
    
    /// Obtiene información de un token
    pub fn get_token_info(&self, token_address: AccountId) -> Option<TokenInfo> {
        self.supported_tokens.get(&token_address)
    }
    
    /// Callback de error para manejar fallos
    pub fn return_failed_result(&self) -> ArbitrageResult {
        ArbitrageResult {
            success: false,
            amount_out: U128(0),
            profit: U128(0),
            gas_used: U64(env::used_gas().0),
            execution_time_ms: env::block_timestamp_ms(),
        }
    }
}
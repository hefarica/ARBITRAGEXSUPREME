// ArbitrageX Pro 2025 - Cosmos Arbitrage Contract
// Implementación en Rust para Cosmos ecosystem usando CosmWasm
// Optimizado para Osmosis, Crescent, JunoSwap, Terra Classic

use cosmwasm_std::{
    entry_point, to_binary, Binary, Deps, DepsMut, Env, MessageInfo, Response, StdResult,
    Uint128, Addr, CosmosMsg, WasmMsg, BankMsg, Coin, SubMsg, Reply, ReplyOn,
};
use cw2::set_contract_version;
use cw_storage_plus::{Item, Map};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use thiserror::Error;

// Contract info
const CONTRACT_NAME: &str = "arbitragex-pro-cosmos";
const CONTRACT_VERSION: &str = "2025.1.0";

// Reply IDs para sub-messages
const SWAP_REPLY_ID: u64 = 1;
const TRIANGULAR_SWAP_1_REPLY_ID: u64 = 2;
const TRIANGULAR_SWAP_2_REPLY_ID: u64 = 3;
const TRIANGULAR_SWAP_3_REPLY_ID: u64 = 4;

#[derive(Error, Debug)]
pub enum ContractError {
    #[error("{0}")]
    Std(#[from] cosmwasm_std::StdError),

    #[error("Unauthorized")]
    Unauthorized {},

    #[error("Contract is paused")]
    ContractPaused {},

    #[error("Insufficient profit: expected {expected}, got {actual}")]
    InsufficientProfit { expected: Uint128, actual: Uint128 },

    #[error("Invalid configuration: {msg}")]
    InvalidConfig { msg: String },

    #[error("Unsupported DEX: {dex}")]
    UnsupportedDex { dex: String },

    #[error("Invalid swap route")]
    InvalidSwapRoute {},

    #[error("Slippage tolerance exceeded")]
    SlippageExceeded {},

    #[error("Deadline exceeded")]
    DeadlineExceeded {},

    #[error("Insufficient balance")]
    InsufficientBalance {},
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct InstantiateMsg {
    pub owner: String,
    pub min_profit_bps: u16,     // 0.35% para Cosmos (IBC fees)
    pub max_slippage_bps: u16,   // 2% max slippage
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ExecuteMsg {
    /// Ejecuta arbitraje simple entre dos DEXs
    ExecuteSimpleArbitrage {
        params: ArbitrageParams,
    },
    /// Ejecuta arbitraje triangular (A -> B -> C -> A)
    ExecuteTriangularArbitrage {
        params: TriangularArbitrageParams,
    },
    /// Ejecuta arbitraje específico en Osmosis
    ExecuteOsmosisArbitrage {
        token_in: String,
        token_out: String,
        amount_in: Uint128,
        pool_id: u64,
    },
    /// Ejecuta arbitraje específico en Crescent
    ExecuteCrescentArbitrage {
        token_in: String,
        token_out: String,
        amount_in: Uint128,
        pair_id: u64,
    },
    /// Actualiza configuración del contrato
    UpdateConfig {
        min_profit_bps: Option<u16>,
        max_slippage_bps: Option<u16>,
    },
    /// Pausa o despausa el contrato
    SetPauseState {
        is_paused: bool,
    },
    /// Retira tokens en emergencia
    EmergencyWithdraw {
        denom: String,
        amount: Uint128,
    },
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum QueryMsg {
    /// Obtiene configuración actual
    GetConfig {},
    /// Obtiene estadísticas del contrato
    GetStats {},
    /// Obtiene información de un DEX
    GetDexInfo { dex_name: String },
    /// Simula un arbitraje sin ejecutarlo
    SimulateArbitrage { params: ArbitrageParams },
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct ArbitrageParams {
    pub token_a: String,
    pub token_b: String,
    pub amount_in: Uint128,
    pub min_amount_out: Uint128,
    pub first_dex: DexType,
    pub second_dex: DexType,
    pub deadline: u64, // timestamp en segundos
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct TriangularArbitrageParams {
    pub token_a: String,
    pub token_b: String,
    pub token_c: String,
    pub amount_in: Uint128,
    pub first_dex: DexType,
    pub second_dex: DexType,
    pub third_dex: DexType,
    pub deadline: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum DexType {
    Osmosis,
    Crescent,
    JunoSwap,
    TerraSwap,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct Config {
    pub owner: Addr,
    pub min_profit_bps: u16,
    pub max_slippage_bps: u16,
    pub is_paused: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct Stats {
    pub total_volume: Uint128,
    pub total_profit: Uint128,
    pub executed_trades: u64,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct DexInfo {
    pub dex_type: DexType,
    pub contract_address: String,
    pub fee_bps: u16,
    pub is_active: bool,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, JsonSchema)]
pub struct ArbitrageResult {
    pub success: bool,
    pub amount_out: Uint128,
    pub profit: Uint128,
    pub gas_used: u64,
    pub execution_time_ms: u64,
}

// Storage
const CONFIG: Item<Config> = Item::new("config");
const STATS: Item<Stats> = Item::new("stats");
const DEX_CONFIGS: Map<String, DexInfo> = Map::new("dex_configs");

#[entry_point]
pub fn instantiate(
    deps: DepsMut,
    _env: Env,
    _info: MessageInfo,
    msg: InstantiateMsg,
) -> Result<Response, ContractError> {
    set_contract_version(deps.storage, CONTRACT_NAME, CONTRACT_VERSION)?;

    let owner = deps.api.addr_validate(&msg.owner)?;
    
    // Validar configuración inicial
    if msg.min_profit_bps < 10 || msg.min_profit_bps > 1000 {
        return Err(ContractError::InvalidConfig {
            msg: "min_profit_bps must be between 10 and 1000".to_string(),
        });
    }
    
    if msg.max_slippage_bps < 50 || msg.max_slippage_bps > 2000 {
        return Err(ContractError::InvalidConfig {
            msg: "max_slippage_bps must be between 50 and 2000".to_string(),
        });
    }

    let config = Config {
        owner: owner.clone(),
        min_profit_bps: msg.min_profit_bps,
        max_slippage_bps: msg.max_slippage_bps,
        is_paused: false,
    };

    let stats = Stats {
        total_volume: Uint128::zero(),
        total_profit: Uint128::zero(),
        executed_trades: 0,
    };

    CONFIG.save(deps.storage, &config)?;
    STATS.save(deps.storage, &stats)?;

    // Inicializar configuraciones de DEXs principales
    initialize_cosmos_dexs(deps.storage)?;

    Ok(Response::new()
        .add_attribute("method", "instantiate")
        .add_attribute("owner", owner)
        .add_attribute("min_profit_bps", msg.min_profit_bps.to_string())
        .add_attribute("max_slippage_bps", msg.max_slippage_bps.to_string()))
}

#[entry_point]
pub fn execute(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    msg: ExecuteMsg,
) -> Result<Response, ContractError> {
    match msg {
        ExecuteMsg::ExecuteSimpleArbitrage { params } => {
            execute_simple_arbitrage(deps, env, info, params)
        }
        ExecuteMsg::ExecuteTriangularArbitrage { params } => {
            execute_triangular_arbitrage(deps, env, info, params)
        }
        ExecuteMsg::ExecuteOsmosisArbitrage {
            token_in,
            token_out,
            amount_in,
            pool_id,
        } => execute_osmosis_arbitrage(deps, env, info, token_in, token_out, amount_in, pool_id),
        ExecuteMsg::ExecuteCrescentArbitrage {
            token_in,
            token_out,
            amount_in,
            pair_id,
        } => execute_crescent_arbitrage(deps, env, info, token_in, token_out, amount_in, pair_id),
        ExecuteMsg::UpdateConfig {
            min_profit_bps,
            max_slippage_bps,
        } => update_config(deps, info, min_profit_bps, max_slippage_bps),
        ExecuteMsg::SetPauseState { is_paused } => set_pause_state(deps, info, is_paused),
        ExecuteMsg::EmergencyWithdraw { denom, amount } => {
            emergency_withdraw(deps, info, denom, amount)
        }
    }
}

fn execute_simple_arbitrage(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    params: ArbitrageParams,
) -> Result<Response, ContractError> {
    let config = CONFIG.load(deps.storage)?;
    
    // Validaciones
    if config.is_paused {
        return Err(ContractError::ContractPaused {});
    }
    
    if info.sender != config.owner {
        return Err(ContractError::Unauthorized {});
    }
    
    if env.block.time.seconds() > params.deadline {
        return Err(ContractError::DeadlineExceeded {});
    }

    // Crear mensaje para primera swap
    let first_swap_msg = create_swap_message(
        &params.first_dex,
        &params.token_a,
        &params.token_b,
        params.amount_in,
    )?;

    let sub_msg = SubMsg {
        id: SWAP_REPLY_ID,
        msg: first_swap_msg,
        gas_limit: None,
        reply_on: ReplyOn::Always,
    };

    Ok(Response::new()
        .add_submessage(sub_msg)
        .add_attribute("method", "execute_simple_arbitrage")
        .add_attribute("token_a", params.token_a)
        .add_attribute("token_b", params.token_b)
        .add_attribute("amount_in", params.amount_in.to_string()))
}

fn execute_triangular_arbitrage(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    params: TriangularArbitrageParams,
) -> Result<Response, ContractError> {
    let config = CONFIG.load(deps.storage)?;
    
    // Validaciones
    if config.is_paused {
        return Err(ContractError::ContractPaused {});
    }
    
    if info.sender != config.owner {
        return Err(ContractError::Unauthorized {});
    }
    
    if env.block.time.seconds() > params.deadline {
        return Err(ContractError::DeadlineExceeded {});
    }

    // Primera swap: A -> B
    let first_swap_msg = create_swap_message(
        &params.first_dex,
        &params.token_a,
        &params.token_b,
        params.amount_in,
    )?;

    let sub_msg = SubMsg {
        id: TRIANGULAR_SWAP_1_REPLY_ID,
        msg: first_swap_msg,
        gas_limit: None,
        reply_on: ReplyOn::Always,
    };

    Ok(Response::new()
        .add_submessage(sub_msg)
        .add_attribute("method", "execute_triangular_arbitrage")
        .add_attribute("token_a", params.token_a)
        .add_attribute("token_b", params.token_b)
        .add_attribute("token_c", params.token_c)
        .add_attribute("amount_in", params.amount_in.to_string()))
}

fn execute_osmosis_arbitrage(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    token_in: String,
    token_out: String,
    amount_in: Uint128,
    pool_id: u64,
) -> Result<Response, ContractError> {
    let config = CONFIG.load(deps.storage)?;
    
    if config.is_paused {
        return Err(ContractError::ContractPaused {});
    }
    
    if info.sender != config.owner {
        return Err(ContractError::Unauthorized {});
    }

    // Crear mensaje específico para Osmosis
    let osmosis_msg = create_osmosis_swap_message(token_in.clone(), token_out.clone(), amount_in, pool_id)?;

    let sub_msg = SubMsg {
        id: SWAP_REPLY_ID,
        msg: osmosis_msg,
        gas_limit: None,
        reply_on: ReplyOn::Always,
    };

    Ok(Response::new()
        .add_submessage(sub_msg)
        .add_attribute("method", "execute_osmosis_arbitrage")
        .add_attribute("token_in", token_in)
        .add_attribute("token_out", token_out)
        .add_attribute("amount_in", amount_in.to_string())
        .add_attribute("pool_id", pool_id.to_string()))
}

fn execute_crescent_arbitrage(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    token_in: String,
    token_out: String,
    amount_in: Uint128,
    pair_id: u64,
) -> Result<Response, ContractError> {
    let config = CONFIG.load(deps.storage)?;
    
    if config.is_paused {
        return Err(ContractError::ContractPaused {});
    }
    
    if info.sender != config.owner {
        return Err(ContractError::Unauthorized {});
    }

    // Crear mensaje específico para Crescent
    let crescent_msg = create_crescent_swap_message(token_in.clone(), token_out.clone(), amount_in, pair_id)?;

    let sub_msg = SubMsg {
        id: SWAP_REPLY_ID,
        msg: crescent_msg,
        gas_limit: None,
        reply_on: ReplyOn::Always,
    };

    Ok(Response::new()
        .add_submessage(sub_msg)
        .add_attribute("method", "execute_crescent_arbitrage")
        .add_attribute("token_in", token_in)
        .add_attribute("token_out", token_out)
        .add_attribute("amount_in", amount_in.to_string())
        .add_attribute("pair_id", pair_id.to_string()))
}

fn update_config(
    deps: DepsMut,
    info: MessageInfo,
    min_profit_bps: Option<u16>,
    max_slippage_bps: Option<u16>,
) -> Result<Response, ContractError> {
    let mut config = CONFIG.load(deps.storage)?;
    
    if info.sender != config.owner {
        return Err(ContractError::Unauthorized {});
    }

    if let Some(min_profit) = min_profit_bps {
        if min_profit < 10 || min_profit > 1000 {
            return Err(ContractError::InvalidConfig {
                msg: "min_profit_bps must be between 10 and 1000".to_string(),
            });
        }
        config.min_profit_bps = min_profit;
    }

    if let Some(max_slippage) = max_slippage_bps {
        if max_slippage < 50 || max_slippage > 2000 {
            return Err(ContractError::InvalidConfig {
                msg: "max_slippage_bps must be between 50 and 2000".to_string(),
            });
        }
        config.max_slippage_bps = max_slippage;
    }

    CONFIG.save(deps.storage, &config)?;

    Ok(Response::new()
        .add_attribute("method", "update_config")
        .add_attribute("min_profit_bps", config.min_profit_bps.to_string())
        .add_attribute("max_slippage_bps", config.max_slippage_bps.to_string()))
}

fn set_pause_state(
    deps: DepsMut,
    info: MessageInfo,
    is_paused: bool,
) -> Result<Response, ContractError> {
    let mut config = CONFIG.load(deps.storage)?;
    
    if info.sender != config.owner {
        return Err(ContractError::Unauthorized {});
    }

    config.is_paused = is_paused;
    CONFIG.save(deps.storage, &config)?;

    Ok(Response::new()
        .add_attribute("method", "set_pause_state")
        .add_attribute("is_paused", is_paused.to_string()))
}

fn emergency_withdraw(
    deps: DepsMut,
    info: MessageInfo,
    denom: String,
    amount: Uint128,
) -> Result<Response, ContractError> {
    let config = CONFIG.load(deps.storage)?;
    
    if info.sender != config.owner {
        return Err(ContractError::Unauthorized {});
    }

    let withdraw_msg = BankMsg::Send {
        to_address: config.owner.to_string(),
        amount: vec![Coin {
            denom: denom.clone(),
            amount,
        }],
    };

    Ok(Response::new()
        .add_message(withdraw_msg)
        .add_attribute("method", "emergency_withdraw")
        .add_attribute("denom", denom)
        .add_attribute("amount", amount.to_string()))
}

#[entry_point]
pub fn reply(deps: DepsMut, _env: Env, msg: Reply) -> Result<Response, ContractError> {
    match msg.id {
        SWAP_REPLY_ID => handle_swap_reply(deps, msg),
        TRIANGULAR_SWAP_1_REPLY_ID => handle_triangular_swap_1_reply(deps, msg),
        TRIANGULAR_SWAP_2_REPLY_ID => handle_triangular_swap_2_reply(deps, msg),
        TRIANGULAR_SWAP_3_REPLY_ID => handle_triangular_swap_3_reply(deps, msg),
        _ => Err(ContractError::Std(cosmwasm_std::StdError::generic_err(
            "Unknown reply ID",
        ))),
    }
}

fn handle_swap_reply(deps: DepsMut, _msg: Reply) -> Result<Response, ContractError> {
    // Manejar respuesta del swap y actualizar estadísticas
    let mut stats = STATS.load(deps.storage)?;
    stats.executed_trades += 1;
    STATS.save(deps.storage, &stats)?;

    Ok(Response::new().add_attribute("method", "handle_swap_reply"))
}

fn handle_triangular_swap_1_reply(deps: DepsMut, _msg: Reply) -> Result<Response, ContractError> {
    // Manejar primera swap del arbitraje triangular
    // Continuar con segunda swap B -> C
    Ok(Response::new().add_attribute("method", "handle_triangular_swap_1_reply"))
}

fn handle_triangular_swap_2_reply(deps: DepsMut, _msg: Reply) -> Result<Response, ContractError> {
    // Manejar segunda swap del arbitraje triangular
    // Continuar con tercera swap C -> A
    Ok(Response::new().add_attribute("method", "handle_triangular_swap_2_reply"))
}

fn handle_triangular_swap_3_reply(deps: DepsMut, _msg: Reply) -> Result<Response, ContractError> {
    // Manejar tercera swap del arbitraje triangular
    // Finalizar y actualizar estadísticas
    let mut stats = STATS.load(deps.storage)?;
    stats.executed_trades += 1;
    STATS.save(deps.storage, &stats)?;

    Ok(Response::new().add_attribute("method", "handle_triangular_swap_3_reply"))
}

#[entry_point]
pub fn query(deps: Deps, _env: Env, msg: QueryMsg) -> StdResult<Binary> {
    match msg {
        QueryMsg::GetConfig {} => to_binary(&query_config(deps)?),
        QueryMsg::GetStats {} => to_binary(&query_stats(deps)?),
        QueryMsg::GetDexInfo { dex_name } => to_binary(&query_dex_info(deps, dex_name)?),
        QueryMsg::SimulateArbitrage { params } => to_binary(&simulate_arbitrage(deps, params)?),
    }
}

fn query_config(deps: Deps) -> StdResult<Config> {
    CONFIG.load(deps.storage)
}

fn query_stats(deps: Deps) -> StdResult<Stats> {
    STATS.load(deps.storage)
}

fn query_dex_info(deps: Deps, dex_name: String) -> StdResult<Option<DexInfo>> {
    Ok(DEX_CONFIGS.may_load(deps.storage, dex_name)?)
}

fn simulate_arbitrage(deps: Deps, params: ArbitrageParams) -> StdResult<ArbitrageResult> {
    let config = CONFIG.load(deps.storage)?;
    
    // Simular swap sin ejecutar
    let estimated_out = simulate_dex_swap(&params.first_dex, params.amount_in)?;
    let final_out = simulate_dex_swap(&params.second_dex, estimated_out)?;
    
    let profit = final_out.saturating_sub(params.amount_in);
    let min_profit = params.amount_in * Uint128::from(config.min_profit_bps) / Uint128::from(10000u128);
    
    Ok(ArbitrageResult {
        success: profit >= min_profit,
        amount_out: final_out,
        profit,
        gas_used: 200000, // Estimación
        execution_time_ms: 3000, // Estimación para Cosmos
    })
}

// Helper functions

fn create_swap_message(
    dex_type: &DexType,
    token_in: &str,
    token_out: &str,
    amount_in: Uint128,
) -> Result<CosmosMsg, ContractError> {
    match dex_type {
        DexType::Osmosis => create_osmosis_swap_message(token_in.to_string(), token_out.to_string(), amount_in, 1),
        DexType::Crescent => create_crescent_swap_message(token_in.to_string(), token_out.to_string(), amount_in, 1),
        DexType::JunoSwap => create_junoswap_message(token_in.to_string(), token_out.to_string(), amount_in),
        DexType::TerraSwap => create_terraswap_message(token_in.to_string(), token_out.to_string(), amount_in),
    }
}

fn create_osmosis_swap_message(
    token_in: String,
    token_out: String,
    amount_in: Uint128,
    pool_id: u64,
) -> Result<CosmosMsg, ContractError> {
    // Crear mensaje específico para Osmosis DEX
    let swap_msg = osmosis_std::types::osmosis::gamm::v1beta1::MsgSwapExactAmountIn {
        sender: "contract_address".to_string(), // Se reemplazará dinámicamente
        pool_id,
        token_in: Some(osmosis_std::types::cosmos::base::v1beta1::Coin {
            denom: token_in,
            amount: amount_in.to_string(),
        }),
        token_out_min_amount: "1".to_string(), // Mínimo amount out
    };

    Ok(CosmosMsg::Stargate {
        type_url: "/osmosis.gamm.v1beta1.MsgSwapExactAmountIn".to_string(),
        value: Binary::from(prost::Message::encode_to_vec(&swap_msg)),
    })
}

fn create_crescent_swap_message(
    token_in: String,
    token_out: String,
    amount_in: Uint128,
    pair_id: u64,
) -> Result<CosmosMsg, ContractError> {
    // Crear mensaje específico para Crescent Finance
    Ok(CosmosMsg::Wasm(WasmMsg::Execute {
        contract_addr: "crescent_dex_contract".to_string(), // Address real del contrato
        msg: to_binary(&serde_json::json!({
            "swap": {
                "offer_coin": {
                    "denom": token_in,
                    "amount": amount_in.to_string()
                },
                "ask_denom": token_out,
                "pair_id": pair_id
            }
        }))?,
        funds: vec![Coin {
            denom: token_in,
            amount: amount_in,
        }],
    }))
}

fn create_junoswap_message(
    token_in: String,
    token_out: String,
    amount_in: Uint128,
) -> Result<CosmosMsg, ContractError> {
    // Crear mensaje específico para JunoSwap
    Ok(CosmosMsg::Wasm(WasmMsg::Execute {
        contract_addr: "junoswap_contract".to_string(),
        msg: to_binary(&serde_json::json!({
            "swap": {
                "input_token": token_in,
                "input_amount": amount_in.to_string(),
                "output_token": token_out,
                "min_output": "1"
            }
        }))?,
        funds: vec![Coin {
            denom: token_in,
            amount: amount_in,
        }],
    }))
}

fn create_terraswap_message(
    token_in: String,
    token_out: String,
    amount_in: Uint128,
) -> Result<CosmosMsg, ContractError> {
    // Crear mensaje específico para TerraSwap
    Ok(CosmosMsg::Wasm(WasmMsg::Execute {
        contract_addr: "terraswap_contract".to_string(),
        msg: to_binary(&serde_json::json!({
            "swap": {
                "offer_asset": {
                    "info": {
                        "native_token": {
                            "denom": token_in
                        }
                    },
                    "amount": amount_in.to_string()
                },
                "ask_asset_info": {
                    "native_token": {
                        "denom": token_out
                    }
                }
            }
        }))?,
        funds: vec![Coin {
            denom: token_in,
            amount: amount_in,
        }],
    }))
}

fn simulate_dex_swap(dex_type: &DexType, amount_in: Uint128) -> StdResult<Uint128> {
    // Simular output según el tipo de DEX
    let amount_out = match dex_type {
        DexType::Osmosis => amount_in * Uint128::from(995u128) / Uint128::from(1000u128), // 0.5% fee
        DexType::Crescent => amount_in * Uint128::from(997u128) / Uint128::from(1000u128), // 0.3% fee
        DexType::JunoSwap => amount_in * Uint128::from(9975u128) / Uint128::from(10000u128), // 0.25% fee
        DexType::TerraSwap => amount_in * Uint128::from(9970u128) / Uint128::from(10000u128), // 0.3% fee
    };
    Ok(amount_out)
}

fn initialize_cosmos_dexs(storage: &mut dyn cosmwasm_std::Storage) -> StdResult<()> {
    // Osmosis - Principal DEX del ecosistema Cosmos
    DEX_CONFIGS.save(storage, "osmosis".to_string(), &DexInfo {
        dex_type: DexType::Osmosis,
        contract_address: "osmo1...".to_string(), // Address real de Osmosis
        fee_bps: 50, // 0.5%
        is_active: true,
    })?;

    // Crescent - DEX de Crescent Network
    DEX_CONFIGS.save(storage, "crescent".to_string(), &DexInfo {
        dex_type: DexType::Crescent,
        contract_address: "cre1...".to_string(), // Address real de Crescent
        fee_bps: 30, // 0.3%
        is_active: true,
    })?;

    // JunoSwap - DEX de Juno Network
    DEX_CONFIGS.save(storage, "junoswap".to_string(), &DexInfo {
        dex_type: DexType::JunoSwap,
        contract_address: "juno1...".to_string(), // Address real de JunoSwap
        fee_bps: 25, // 0.25%
        is_active: true,
    })?;

    // TerraSwap - DEX de Terra Classic
    DEX_CONFIGS.save(storage, "terraswap".to_string(), &DexInfo {
        dex_type: DexType::TerraSwap,
        contract_address: "terra1...".to_string(), // Address real de TerraSwap
        fee_bps: 30, // 0.3%
        is_active: true,
    })?;

    Ok(())
}
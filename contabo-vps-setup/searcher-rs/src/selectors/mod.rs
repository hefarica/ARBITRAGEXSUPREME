// ================================
// ArbitrageX Supreme V3.0 - Selectors Module
// Núcleo algorítmico de selección (puntajes y gates)
// ================================

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tracing::{info, warn, debug};

pub mod chain_selector;
pub mod dex_selector;
pub mod lending_selector;
pub mod token_filter;

pub use chain_selector::ChainSelector;
pub use dex_selector::DexSelector;  
pub use lending_selector::LendingSelector;
pub use token_filter::TokenFilter;

use crate::config::SearcherConfig;
use crate::metrics::MetricsRegistry;

// ================================
// Estructuras Base de Datos
// ================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChainInfo {
    pub chain_id: u64,
    pub name: String,
    pub display_name: String,
    pub rpc_url: String,
    pub block_time_ms: u64,
    pub gas_token_symbol: String,
    pub supports_flash_loans: bool,
    pub is_active: bool,
    pub tvl_usd: f64,
    pub avg_gas_price_gwei: f64,
    pub reliability_score: f64,
    pub latency_ms: u32,
    pub priority_score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DexInfo {
    pub id: String,
    pub chain_id: u64,
    pub name: String,
    pub protocol_type: DexProtocol,
    pub factory_address: String,
    pub router_address: String,
    pub fee_tiers: Vec<u32>, // in basis points
    pub tvl_usd: f64,
    pub volume_24h_usd: f64,
    pub supports_flash_swaps: bool,
    pub twap_stable: bool,
    pub depth_score: f64,
    pub is_active: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DexProtocol {
    UniswapV2,
    UniswapV3,
    SushiSwap,
    Curve,
    Balancer,
    PancakeSwap,
    TraderJoe,
    Spookyswap,
    QuickSwap,
    Camelot,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LendingInfo {
    pub id: String,
    pub chain_id: u64,
    pub protocol: LendingProtocol,
    pub pool_address: String,
    pub loan_fee_bps: u32,
    pub reserves_usd: f64,
    pub utilization_rate: f64,
    pub max_loan_usd: f64,
    pub flash_loan_supported: bool,
    pub is_active: bool,
    pub safety_score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LendingProtocol {
    AaveV3,
    CompoundV3,
    Morpho,
    Euler,
    Radiant,
    Benqi,
    Venus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenInfo {
    pub address: String,
    pub chain_id: u64,
    pub symbol: String,
    pub name: String,
    pub decimals: u8,
    pub market_cap_usd: f64,
    pub liquidity_usd: f64,
    pub volume_24h_usd: f64,
    pub volatility_24h: f64,
    pub is_verified: bool,
    pub risk_score: f64,
    pub coingecko_id: Option<String>,
    pub security_audit: bool,
}

// ================================
// Candidatos de Selección
// ================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SelectionCandidate {
    pub id: String,
    pub strategy_type: String,
    pub chain_id: u64,
    pub primary_token: String,
    pub secondary_token: String,
    pub venue_primary: String,
    pub venue_secondary: Option<String>,
    pub estimated_profit_usd: f64,
    pub confidence_score: f64,
    pub execution_cost_usd: f64,
    pub net_profit_usd: f64,
    pub risk_level: RiskLevel,
    pub selection_reasons: Vec<SelectionReason>,
    pub rejection_reasons: Vec<RejectionReason>,
    pub metadata: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RiskLevel {
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SelectionReason {
    pub category: String,
    pub description: String,
    pub score_impact: f64,
    pub confidence: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RejectionReason {
    pub category: String,
    pub description: String,
    pub is_fatal: bool,
    pub threshold_value: Option<f64>,
    pub actual_value: Option<f64>,
}

// ================================
// Trait Base para Selectores
// ================================

#[async_trait::async_trait]
pub trait Selector: Send + Sync {
    type Item;
    type Criteria;

    async fn evaluate(&self, item: &Self::Item, criteria: &Self::Criteria) -> Result<f64>;
    async fn filter(&self, items: Vec<Self::Item>, criteria: &Self::Criteria) -> Result<Vec<Self::Item>>;
    async fn score(&self, items: Vec<Self::Item>, criteria: &Self::Criteria) -> Result<Vec<(Self::Item, f64)>>;
    fn name(&self) -> &str;
}

// ================================
// Gestor Principal de Selección
// ================================

pub struct SelectionManager {
    config: Arc<SearcherConfig>,
    metrics: Arc<MetricsRegistry>,
    chain_selector: Arc<ChainSelector>,
    dex_selector: Arc<DexSelector>,
    lending_selector: Arc<LendingSelector>,
    token_filter: Arc<TokenFilter>,
}

impl SelectionManager {
    pub fn new(
        config: Arc<SearcherConfig>,
        metrics: Arc<MetricsRegistry>,
        chain_selector: Arc<ChainSelector>,
        dex_selector: Arc<DexSelector>,
        lending_selector: Arc<LendingSelector>,
        token_filter: Arc<TokenFilter>,
    ) -> Self {
        Self {
            config,
            metrics,
            chain_selector,
            dex_selector,
            lending_selector,
            token_filter,
        }
    }

    /// Generar candidatos completos con todos los selectores
    pub async fn generate_candidates(&self, strategy_type: &str) -> Result<Vec<SelectionCandidate>> {
        let start = std::time::Instant::now();
        
        debug!("🎯 Generando candidatos para estrategia: {}", strategy_type);
        
        // 1. Obtener chains activas con puntaje
        let chains = self.chain_selector.get_active_chains().await?;
        info!("📊 Chains activas evaluadas: {}", chains.len());
        
        // 2. Obtener DEXs por chain con scoring
        let mut all_dex_data = HashMap::new();
        for chain in &chains {
            let dex_data = self.dex_selector.get_scored_dexs(chain.chain_id).await?;
            all_dex_data.insert(chain.chain_id, dex_data);
        }
        
        // 3. Obtener lending protocols si la estrategia los requiere
        let mut lending_data = HashMap::new();
        if self.strategy_requires_lending(strategy_type) {
            for chain in &chains {
                let lending = self.lending_selector.get_scored_lending(chain.chain_id).await?;
                lending_data.insert(chain.chain_id, lending);
            }
        }
        
        // 4. Obtener tokens filtrados por chain
        let mut token_data = HashMap::new();
        for chain in &chains {
            let tokens = self.token_filter.get_filtered_tokens(chain.chain_id).await?;
            token_data.insert(chain.chain_id, tokens);
        }
        
        // 5. Generar candidatos basados en combinaciones
        let candidates = self.generate_strategy_candidates(
            strategy_type,
            &chains,
            &all_dex_data,
            &lending_data,
            &token_data,
        ).await?;
        
        let elapsed = start.elapsed();
        info!(
            "✅ Generados {} candidatos en {}ms para estrategia: {}",
            candidates.len(),
            elapsed.as_millis(),
            strategy_type
        );
        
        // Registrar métricas
        self.metrics.candidates_generated
            .with_label_values(&[strategy_type])
            .set(candidates.len() as f64);
        
        self.metrics.candidate_generation_duration
            .with_label_values(&[strategy_type])
            .observe(elapsed.as_secs_f64());
        
        Ok(candidates)
    }

    /// Verificar si la estrategia requiere lending protocols
    fn strategy_requires_lending(&self, strategy_type: &str) -> bool {
        matches!(strategy_type, "F" | "flash_loan_arbitrage" | "lending_arbitrage")
    }

    /// Generar candidatos específicos por estrategia
    async fn generate_strategy_candidates(
        &self,
        strategy_type: &str,
        chains: &[ChainInfo],
        dex_data: &HashMap<u64, Vec<(DexInfo, f64)>>,
        lending_data: &HashMap<u64, Vec<(LendingInfo, f64)>>,
        token_data: &HashMap<u64, Vec<TokenInfo>>,
    ) -> Result<Vec<SelectionCandidate>> {
        let mut candidates = Vec::new();
        
        match strategy_type {
            "A" | "dex_arbitrage" => {
                candidates = self.generate_dex_arbitrage_candidates(
                    chains, dex_data, token_data
                ).await?;
            }
            "C" | "cross_chain_arbitrage" => {
                candidates = self.generate_cross_chain_candidates(
                    chains, dex_data, token_data
                ).await?;
            }
            "D" | "delta_neutral" => {
                candidates = self.generate_delta_neutral_candidates(
                    chains, dex_data, token_data
                ).await?;
            }
            "F" | "flash_loan_arbitrage" => {
                candidates = self.generate_flash_loan_candidates(
                    chains, dex_data, lending_data, token_data
                ).await?;
            }
            _ => {
                warn!("⚠️ Estrategia no implementada: {}", strategy_type);
            }
        }
        
        // Aplicar filtros finales y scoring
        self.apply_final_filters(&mut candidates).await?;
        
        Ok(candidates)
    }

    /// Generar candidatos para DEX arbitrage
    async fn generate_dex_arbitrage_candidates(
        &self,
        chains: &[ChainInfo],
        dex_data: &HashMap<u64, Vec<(DexInfo, f64)>>,
        token_data: &HashMap<u64, Vec<TokenInfo>>,
    ) -> Result<Vec<SelectionCandidate>> {
        let mut candidates = Vec::new();
        
        for chain in chains {
            if let (Some(dexs), Some(tokens)) = (
                dex_data.get(&chain.chain_id),
                token_data.get(&chain.chain_id)
            ) {
                // Generar combinaciones de DEX pairs
                for i in 0..dexs.len() {
                    for j in (i + 1)..dexs.len() {
                        let (dex1, score1) = &dexs[i];
                        let (dex2, score2) = &dexs[j];
                        
                        // Para cada par de tokens
                        for token in tokens {
                            let candidate = SelectionCandidate {
                                id: format!("dex_arb_{}_{}_{}_{}", 
                                    chain.chain_id, dex1.id, dex2.id, token.symbol),
                                strategy_type: "dex_arbitrage".to_string(),
                                chain_id: chain.chain_id,
                                primary_token: token.address.clone(),
                                secondary_token: "USDC".to_string(), // Base quote
                                venue_primary: dex1.id.clone(),
                                venue_secondary: Some(dex2.id.clone()),
                                estimated_profit_usd: 0.0, // Se calculará en simulación
                                confidence_score: (score1 + score2) / 2.0,
                                execution_cost_usd: 0.0,
                                net_profit_usd: 0.0,
                                risk_level: self.calculate_risk_level(token),
                                selection_reasons: vec![
                                    SelectionReason {
                                        category: "dex_liquidity".to_string(),
                                        description: format!("High liquidity DEXs: {} and {}", 
                                            dex1.name, dex2.name),
                                        score_impact: (score1 + score2) / 2.0,
                                        confidence: 0.8,
                                    }
                                ],
                                rejection_reasons: Vec::new(),
                                metadata: HashMap::new(),
                            };
                            candidates.push(candidate);
                        }
                    }
                }
            }
        }
        
        Ok(candidates)
    }

    /// Generar candidatos para cross-chain arbitrage
    async fn generate_cross_chain_candidates(
        &self,
        chains: &[ChainInfo],
        dex_data: &HashMap<u64, Vec<(DexInfo, f64)>>,
        token_data: &HashMap<u64, Vec<TokenInfo>>,
    ) -> Result<Vec<SelectionCandidate>> {
        let mut candidates = Vec::new();
        
        // Generar pares cross-chain
        for i in 0..chains.len() {
            for j in (i + 1)..chains.len() {
                let chain1 = &chains[i];
                let chain2 = &chains[j];
                
                // Solo si ambas chains tienen DEXs y tokens
                if let (Some(dexs1), Some(tokens1), Some(dexs2), Some(tokens2)) = (
                    dex_data.get(&chain1.chain_id),
                    token_data.get(&chain1.chain_id),
                    dex_data.get(&chain2.chain_id),
                    token_data.get(&chain2.chain_id),
                ) {
                    // Buscar tokens comunes (mismo símbolo)
                    for token1 in tokens1 {
                        for token2 in tokens2 {
                            if token1.symbol == token2.symbol && 
                               token1.symbol != "ETH" { // Evitar tokens nativos
                                
                                let best_dex1 = &dexs1[0].0; // Mejor DEX en chain 1
                                let best_dex2 = &dexs2[0].0; // Mejor DEX en chain 2
                                
                                let candidate = SelectionCandidate {
                                    id: format!("cross_chain_{}_{}_{}_{}", 
                                        chain1.chain_id, chain2.chain_id, 
                                        token1.symbol, best_dex1.id),
                                    strategy_type: "cross_chain_arbitrage".to_string(),
                                    chain_id: chain1.chain_id,
                                    primary_token: token1.address.clone(),
                                    secondary_token: token2.address.clone(),
                                    venue_primary: best_dex1.id.clone(),
                                    venue_secondary: Some(best_dex2.id.clone()),
                                    estimated_profit_usd: 0.0,
                                    confidence_score: (dexs1[0].1 + dexs2[0].1) / 2.0 * 0.8, // Penalizar cross-chain
                                    execution_cost_usd: 0.0,
                                    net_profit_usd: 0.0,
                                    risk_level: RiskLevel::Medium, // Cross-chain siempre medium+
                                    selection_reasons: vec![
                                        SelectionReason {
                                            category: "cross_chain_opportunity".to_string(),
                                            description: format!("Token {} available on both {} and {}", 
                                                token1.symbol, chain1.name, chain2.name),
                                            score_impact: 0.7,
                                            confidence: 0.6,
                                        }
                                    ],
                                    rejection_reasons: Vec::new(),
                                    metadata: HashMap::new(),
                                };
                                candidates.push(candidate);
                            }
                        }
                    }
                }
            }
        }
        
        Ok(candidates)
    }

    /// Generar candidatos para delta-neutral
    async fn generate_delta_neutral_candidates(
        &self,
        chains: &[ChainInfo],
        dex_data: &HashMap<u64, Vec<(DexInfo, f64)>>,
        token_data: &HashMap<u64, Vec<TokenInfo>>,
    ) -> Result<Vec<SelectionCandidate>> {
        // Implementación específica para delta-neutral
        // Por ahora retornar vacío, se implementará según necesidad
        Ok(Vec::new())
    }

    /// Generar candidatos para flash loan arbitrage  
    async fn generate_flash_loan_candidates(
        &self,
        chains: &[ChainInfo],
        dex_data: &HashMap<u64, Vec<(DexInfo, f64)>>,
        lending_data: &HashMap<u64, Vec<(LendingInfo, f64)>>,
        token_data: &HashMap<u64, Vec<TokenInfo>>,
    ) -> Result<Vec<SelectionCandidate>> {
        let mut candidates = Vec::new();
        
        for chain in chains {
            if let (Some(dexs), Some(lending), Some(tokens)) = (
                dex_data.get(&chain.chain_id),
                lending_data.get(&chain.chain_id),
                token_data.get(&chain.chain_id),
            ) {
                // Solo si hay flash loans disponibles
                if !lending.is_empty() && lending[0].0.flash_loan_supported {
                    let best_lender = &lending[0].0;
                    
                    // Usar lógica similar a DEX arbitrage pero con flash loans
                    for i in 0..dexs.len() {
                        for j in (i + 1)..dexs.len() {
                            let (dex1, _) = &dexs[i];
                            let (dex2, _) = &dexs[j];
                            
                            for token in tokens {
                                if token.liquidity_usd > best_lender.max_loan_usd * 0.1 { // Al menos 10% de la liquidez
                                    let candidate = SelectionCandidate {
                                        id: format!("flash_loan_{}_{}_{}_{}", 
                                            chain.chain_id, best_lender.id, 
                                            dex1.id, token.symbol),
                                        strategy_type: "flash_loan_arbitrage".to_string(),
                                        chain_id: chain.chain_id,
                                        primary_token: token.address.clone(),
                                        secondary_token: "USDC".to_string(),
                                        venue_primary: dex1.id.clone(),
                                        venue_secondary: Some(dex2.id.clone()),
                                        estimated_profit_usd: 0.0,
                                        confidence_score: 0.7, // Flash loans tienen más risk
                                        execution_cost_usd: token.liquidity_usd * 
                                            (best_lender.loan_fee_bps as f64 / 10000.0),
                                        net_profit_usd: 0.0,
                                        risk_level: RiskLevel::High,
                                        selection_reasons: vec![
                                            SelectionReason {
                                                category: "flash_loan_available".to_string(),
                                                description: format!("Flash loan available via {} with {}% fee", 
                                                    best_lender.protocol, best_lender.loan_fee_bps as f64 / 100.0),
                                                score_impact: 0.6,
                                                confidence: 0.8,
                                            }
                                        ],
                                        rejection_reasons: Vec::new(),
                                        metadata: HashMap::new(),
                                    };
                                    candidates.push(candidate);
                                }
                            }
                        }
                    }
                }
            }
        }
        
        Ok(candidates)
    }

    /// Aplicar filtros finales y scoring
    async fn apply_final_filters(&self, candidates: &mut Vec<SelectionCandidate>) -> Result<()> {
        // Filtrar por configuración
        candidates.retain(|candidate| {
            // Filtro por profit mínimo
            if candidate.estimated_profit_usd > 0.0 && 
               candidate.estimated_profit_usd < self.config.min_profit_usd {
                return false;
            }
            
            // Filtro por confidence score
            if candidate.confidence_score < self.config.min_confidence_score {
                return false;
            }
            
            // Filtro por risk level
            match candidate.risk_level {
                RiskLevel::Critical => false,
                RiskLevel::High => self.config.allow_high_risk,
                _ => true,
            }
        });
        
        // Ordenar por net profit (cuando esté disponible) o confidence score
        candidates.sort_by(|a, b| {
            b.confidence_score.partial_cmp(&a.confidence_score).unwrap_or(std::cmp::Ordering::Equal)
        });
        
        // Limitar cantidad
        candidates.truncate(self.config.max_candidates_per_strategy);
        
        Ok(())
    }

    /// Calcular risk level basado en token info
    fn calculate_risk_level(&self, token: &TokenInfo) -> RiskLevel {
        if token.risk_score > 0.8 || !token.is_verified {
            RiskLevel::Critical
        } else if token.risk_score > 0.6 || token.volatility_24h > 0.2 {
            RiskLevel::High
        } else if token.risk_score > 0.4 || token.volatility_24h > 0.1 {
            RiskLevel::Medium
        } else {
            RiskLevel::Low
        }
    }
}
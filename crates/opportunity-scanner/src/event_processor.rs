use std::sync::Arc;
use tokio::time::Instant;
use bytes::Bytes;
use dashmap::DashMap;
use simd_json::prelude::*;
use ethers::types::{Address, U256};
use tracing::{debug, warn, instrument};

use crate::config::ScannerConfig;
use crate::metrics::ScannerMetrics;
use crate::dex_state::DexStateManager;

#[derive(Debug, Clone)]
pub struct MempoolEvent {
    pub tx_hash: String,
    pub from: Address,
    pub to: Option<Address>,
    pub value: U256,
    pub gas_price: U256,
    pub gas_limit: U256,
    pub data: Bytes,
    pub timestamp: u64,
    pub chain_id: u64,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ArbitrageOpportunity {
    pub id: String,
    pub token_in: Address,
    pub token_out: Address,
    pub amount_in: U256,
    pub expected_profit: U256,
    pub dex_path: Vec<String>,
    pub confidence_score: f64,
    pub gas_estimate: U256,
    pub deadline: u64,
    pub priority_score: f64, // ML-derived or heuristic
}

pub struct EventProcessor {
    config: ScannerConfig,
    metrics: Arc<ScannerMetrics>,
    dex_state: Arc<DexStateManager>,
    opportunity_cache: DashMap<String, ArbitrageOpportunity>,
    redis_client: redis::Client,
}

impl EventProcessor {
    pub fn new(
        config: ScannerConfig,
        metrics: Arc<ScannerMetrics>,
        dex_state: Arc<DexStateManager>,
    ) -> Self {
        let redis_client = redis::Client::open(config.redis_url.as_str())
            .expect("Failed to connect to Redis");
            
        Self {
            config,
            metrics,
            dex_state,
            opportunity_cache: DashMap::new(),
            redis_client,
        }
    }

    /// Process batch of mempool events - target <5ms
    #[instrument(skip(self, events), fields(event_count = events.len()))]
    pub async fn process_batch(&self, events: Vec<MempoolEvent>) -> anyhow::Result<Vec<ArbitrageOpportunity>> {
        let start = Instant::now();
        let mut opportunities = Vec::new();
        
        // Process events in parallel batches for CPU efficiency
        let batch_size = 100;
        let chunks: Vec<_> = events.chunks(batch_size).collect();
        
        for chunk in chunks {
            let chunk_opportunities = self.process_chunk(chunk).await?;
            opportunities.extend(chunk_opportunities);
        }
        
        let elapsed = start.elapsed();
        self.metrics.processing_duration.observe(elapsed.as_millis() as f64);
        
        if elapsed.as_millis() > 5 {
            warn!("⚠️ Batch processing exceeded 5ms target: {:?}", elapsed);
        }
        
        debug!("📊 Processed {} events → {} opportunities in {:?}", 
               events.len(), opportunities.len(), elapsed);
        
        Ok(opportunities)
    }

    async fn process_chunk(&self, events: &[MempoolEvent]) -> anyhow::Result<Vec<ArbitrageOpportunity>> {
        let mut opportunities = Vec::new();
        
        for event in events {
            // Fast path: skip non-DEX transactions
            if !self.is_dex_transaction(event) {
                continue;
            }
            
            // Decode transaction data (optimized with simd-json)
            if let Some(decoded) = self.decode_dex_transaction(event).await? {
                // Check for arbitrage opportunities
                if let Some(opportunity) = self.analyze_arbitrage_potential(&decoded, event).await? {
                    opportunities.push(opportunity);
                }
            }
        }
        
        Ok(opportunities)
    }

    fn is_dex_transaction(&self, event: &MempoolEvent) -> bool {
        // Fast whitelist check using DashMap
        if let Some(to) = event.to {
            return self.config.dex_contracts.contains_key(&to);
        }
        false
    }

    async fn decode_dex_transaction(&self, event: &MempoolEvent) -> anyhow::Result<Option<DecodedDexCall>> {
        // Use pre-compiled ABI selectors for fast method identification
        let selector = if event.data.len() >= 4 {
            u32::from_be_bytes([event.data[0], event.data[1], event.data[2], event.data[3]])
        } else {
            return Ok(None);
        };
        
        match selector {
            // swapExactTokensForTokens
            0x38ed1739 => Ok(Some(self.decode_swap_exact_tokens(&event.data)?)),
            // swapTokensForExactTokens  
            0x8803dbee => Ok(Some(self.decode_swap_tokens_for_exact(&event.data)?)),
            // swapExactETHForTokens
            0x7ff36ab5 => Ok(Some(self.decode_swap_exact_eth(&event.data)?)),
            // Add more selectors as needed
            _ => Ok(None),
        }
    }

    async fn analyze_arbitrage_potential(
        &self,
        decoded: &DecodedDexCall,
        event: &MempoolEvent,
    ) -> anyhow::Result<Option<ArbitrageOpportunity>> {
        // Get current DEX states
        let token_in = decoded.token_in;
        let token_out = decoded.token_out;
        let amount_in = decoded.amount_in;
        
        // Fast price lookup from cached DEX state
        let current_prices = self.dex_state.get_prices(token_in, token_out).await?;
        
        // Calculate potential profit across DEX pairs
        let mut best_opportunity: Option<ArbitrageOpportunity> = None;
        let mut max_profit = U256::zero();
        
        for (dex_pair, price_info) in current_prices {
            let estimated_profit = self.estimate_profit(
                amount_in,
                price_info.buy_price,
                price_info.sell_price,
                price_info.gas_cost,
            );
            
            if estimated_profit > max_profit && estimated_profit > U256::from(self.config.min_profit_threshold) {
                max_profit = estimated_profit;
                
                best_opportunity = Some(ArbitrageOpportunity {
                    id: format!("{}_{}", event.tx_hash, dex_pair),
                    token_in,
                    token_out,
                    amount_in,
                    expected_profit: estimated_profit,
                    dex_path: vec![dex_pair.clone()],
                    confidence_score: price_info.confidence,
                    gas_estimate: price_info.gas_cost,
                    deadline: event.timestamp + 30, // 30s deadline
                    priority_score: self.calculate_priority_score(estimated_profit, price_info.confidence),
                });
            }
        }
        
        Ok(best_opportunity)
    }

    fn estimate_profit(&self, amount_in: U256, buy_price: U256, sell_price: U256, gas_cost: U256) -> U256 {
        if sell_price <= buy_price {
            return U256::zero();
        }
        
        let amount_out = amount_in * sell_price / buy_price;
        let gross_profit = if amount_out > amount_in { 
            amount_out - amount_in 
        } else { 
            U256::zero() 
        };
        
        // Subtract gas costs and fees
        if gross_profit > gas_cost {
            gross_profit - gas_cost
        } else {
            U256::zero()
        }
    }

    fn calculate_priority_score(&self, profit: U256, confidence: f64) -> f64 {
        // Simple scoring: profit * confidence * urgency
        let profit_f64 = profit.as_u128() as f64;
        profit_f64 * confidence * 1000.0 // Scale for sorting
    }

    pub async fn emit_opportunities(&self, opportunities: Vec<ArbitrageOpportunity>) -> anyhow::Result<()> {
        // Sort by priority score (highest first)
        let mut sorted_opportunities = opportunities;
        sorted_opportunities.sort_by(|a, b| b.priority_score.partial_cmp(&a.priority_score).unwrap());
        
        // Emit top opportunities to Redis stream for router-executor
        let mut conn = self.redis_client.get_multiplexed_async_connection().await?;
        
        // Clone top opportunities for async processing
        let top_opportunities: Vec<ArbitrageOpportunity> = sorted_opportunities
            .iter()
            .take(10)
            .cloned()
            .collect();
        
        for opportunity in &top_opportunities {
            let serialized = serde_json::to_string(&opportunity)?;
            
            redis::cmd("XADD")
                .arg("arbitrage:opportunities")
                .arg("*")
                .arg("data")
                .arg(serialized)
                .query_async::<_, ()>(&mut conn)
                .await?;
        }
        
        self.metrics.opportunities_emitted.inc_by(top_opportunities.len() as f64);
        Ok(())
    }

    // Helper methods for decoding
    fn decode_swap_exact_tokens(&self, _data: &Bytes) -> anyhow::Result<DecodedDexCall> {
        // Implementation for decoding swapExactTokensForTokens
        todo!("Implement ABI decoding")
    }

    fn decode_swap_tokens_for_exact(&self, _data: &Bytes) -> anyhow::Result<DecodedDexCall> {
        // Implementation for decoding swapTokensForExactTokens
        todo!("Implement ABI decoding")
    }

    fn decode_swap_exact_eth(&self, _data: &Bytes) -> anyhow::Result<DecodedDexCall> {
        // Implementation for decoding swapExactETHForTokens
        todo!("Implement ABI decoding")
    }
}

#[derive(Debug)]
struct DecodedDexCall {
    token_in: Address,
    token_out: Address,
    amount_in: U256,
    amount_out_min: U256,
    recipient: Address,
}

#[derive(Debug)]
struct PriceInfo {
    buy_price: U256,
    sell_price: U256,
    confidence: f64,
    gas_cost: U256,
}
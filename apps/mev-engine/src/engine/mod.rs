// ArbitrageX Supreme V3.0 - MEV Engine Core Implementation

use std::sync::Arc;
use tokio::sync::RwLock;
use tokio::time::{sleep, Duration, Instant};
use anyhow::Result;
use tracing::{info, warn, error, debug};
use std::collections::HashMap;

use crate::config::Config;
use crate::monitoring::MetricsCollector;
use crate::database::DatabaseManager;
use crate::redis_client::RedisClient;
use crate::blockchain::BlockchainManager;
use crate::strategies::StrategyManager;
use crate::types::{ArbitrageOpportunity, ExecutionResult, EngineState, EngineStats};

pub struct MevEngine {
    config: Arc<Config>,
    metrics: Arc<MetricsCollector>,
    database: Arc<DatabaseManager>,
    redis: Arc<RedisClient>,
    blockchain: Arc<BlockchainManager>,
    strategies: Arc<StrategyManager>,
    state: Arc<RwLock<EngineState>>,
    stats: Arc<RwLock<EngineStats>>,
    simulation_mode: bool,
}

impl MevEngine {
    /// Crea nueva instancia del MEV Engine
    pub async fn new(
        config: Arc<Config>, 
        metrics: Arc<MetricsCollector>,
        simulation_mode: bool
    ) -> Result<Self> {
        
        info!("🔧 Initializing MEV Engine components...");
        
        // Initialize database connection
        let database = Arc::new(DatabaseManager::new(&config.database).await?);
        info!("✅ Database manager connected");
        
        // Initialize Redis client
        let redis = Arc::new(RedisClient::new(&config.redis).await?);
        info!("✅ Redis client connected");
        
        // Initialize blockchain manager
        let blockchain = Arc::new(BlockchainManager::new(config.clone()).await?);
        info!("✅ Blockchain manager initialized");
        
        // Initialize strategy manager
        let strategies = Arc::new(StrategyManager::new(config.clone()).await?);
        info!("✅ Strategy manager initialized");
        
        // Initialize engine state
        let state = Arc::new(RwLock::new(EngineState::default()));
        let stats = Arc::new(RwLock::new(EngineStats::default()));
        
        Ok(Self {
            config,
            metrics,
            database,
            redis,
            blockchain,
            strategies,
            state,
            stats,
            simulation_mode,
        })
    }
    
    /// Inicia el MEV Engine
    pub async fn start(&self) {
        info!("🚀 Starting MEV Engine main loop...");
        
        // Update state to running
        {
            let mut state = self.state.write().await;
            state.is_running = true;
            state.start_time = Instant::now();
        }
        
        // Start monitoring tasks
        self.start_monitoring_tasks().await;
        
        // Main arbitrage detection and execution loop
        let mut iteration = 0;
        let scan_interval = Duration::from_millis(self.config.engine.scan_interval_ms);
        
        loop {
            let loop_start = Instant::now();
            iteration += 1;
            
            // Check if engine should continue running
            {
                let state = self.state.read().await;
                if !state.is_running {
                    info!("🛑 MEV Engine stopping...");
                    break;
                }
            }
            
            // Execute arbitrage detection and execution cycle
            if let Err(e) = self.execute_cycle(iteration).await {
                error!("❌ Arbitrage cycle {} failed: {}", iteration, e);
                self.metrics.increment_counter("arbitrage_cycle_errors", 1.0).await;
            }
            
            // Update metrics
            let cycle_duration = loop_start.elapsed();
            self.metrics.record_histogram("cycle_duration_ms", cycle_duration.as_millis() as f64).await;
            
            // Sleep until next cycle
            let elapsed = loop_start.elapsed();
            if elapsed < scan_interval {
                sleep(scan_interval - elapsed).await;
            }
        }
        
        info!("✅ MEV Engine main loop stopped");
    }
    
    /// Ejecuta un ciclo completo de detección y ejecución de arbitraje
    async fn execute_cycle(&self, iteration: u64) -> Result<()> {
        debug!("🔄 Starting arbitrage cycle {}", iteration);
        
        let cycle_start = Instant::now();
        
        // 1. Scan for arbitrage opportunities across all blockchains
        let opportunities = self.scan_opportunities().await?;
        
        if !opportunities.is_empty() {
            info!("💡 Found {} arbitrage opportunities", opportunities.len());
            
            // 2. Filter and rank opportunities
            let ranked_opportunities = self.rank_opportunities(opportunities).await?;
            
            // 3. Execute profitable opportunities
            let execution_results = self.execute_opportunities(ranked_opportunities).await?;
            
            // 4. Update statistics
            self.update_stats(execution_results).await?;
        } else {
            debug!("No arbitrage opportunities found in cycle {}", iteration);
        }
        
        // Update cycle metrics
        {
            let mut stats = self.stats.write().await;
            stats.total_cycles += 1;
            stats.last_cycle_duration = cycle_start.elapsed();
        }
        
        Ok(())
    }
    
    /// Escanea oportunidades de arbitraje en todas las blockchains
    async fn scan_opportunities(&self) -> Result<Vec<ArbitrageOpportunity>> {
        debug!("🔍 Scanning for arbitrage opportunities...");
        
        let mut all_opportunities = Vec::new();
        
        // Get active trading pairs from configuration
        let trading_pairs = &self.config.engine.trading_pairs;
        
        for pair in trading_pairs {
            // Scan each blockchain for opportunities with this pair
            let blockchain_opportunities = self.blockchain
                .scan_pair_opportunities(&pair.token_a, &pair.token_b, pair.amount_in)
                .await?;
                
            all_opportunities.extend(blockchain_opportunities);
        }
        
        // Filter opportunities by minimum profit threshold
        let min_profit = self.config.engine.min_profit_threshold;
        let filtered_opportunities: Vec<_> = all_opportunities
            .into_iter()
            .filter(|opp| opp.expected_profit >= min_profit)
            .collect();
            
        debug!("Found {} opportunities above profit threshold", filtered_opportunities.len());
        
        Ok(filtered_opportunities)
    }
    
    /// Clasifica oportunidades por rentabilidad y riesgo
    async fn rank_opportunities(&self, mut opportunities: Vec<ArbitrageOpportunity>) -> Result<Vec<ArbitrageOpportunity>> {
        debug!("📊 Ranking {} opportunities...", opportunities.len());
        
        // Calculate risk-adjusted profit for each opportunity
        for opportunity in &mut opportunities {
            let risk_score = self.strategies.calculate_risk_score(opportunity).await?;
            let gas_cost = self.blockchain.estimate_gas_cost(&opportunity.blockchain_from, &opportunity.strategy).await?;
            
            // Adjust expected profit by risk and gas costs
            opportunity.risk_adjusted_profit = opportunity.expected_profit * (1.0 - risk_score) - gas_cost;
        }
        
        // Sort by risk-adjusted profit (highest first)
        opportunities.sort_by(|a, b| 
            b.risk_adjusted_profit.partial_cmp(&a.risk_adjusted_profit).unwrap_or(std::cmp::Ordering::Equal)
        );
        
        // Take only top N opportunities to avoid overloading
        let max_concurrent = self.config.engine.max_concurrent_executions;
        opportunities.truncate(max_concurrent);
        
        debug!("Ranked top {} opportunities for execution", opportunities.len());
        
        Ok(opportunities)
    }
    
    /// Ejecuta oportunidades de arbitraje seleccionadas
    async fn execute_opportunities(&self, opportunities: Vec<ArbitrageOpportunity>) -> Result<Vec<ExecutionResult>> {
        info!("⚡ Executing {} arbitrage opportunities...", opportunities.len());
        
        let mut execution_futures = Vec::new();
        
        for opportunity in opportunities {
            let strategies_clone = self.strategies.clone();
            let metrics_clone = self.metrics.clone();
            let simulation_mode = self.simulation_mode;
            
            let future = tokio::spawn(async move {
                let start_time = Instant::now();
                
                let result = if simulation_mode {
                    strategies_clone.simulate_execution(&opportunity).await
                } else {
                    strategies_clone.execute_opportunity(&opportunity).await
                };
                
                let execution_time = start_time.elapsed();
                
                // Record execution metrics
                metrics_clone.increment_counter("arbitrage_executions", 1.0).await;
                metrics_clone.record_histogram("execution_time_ms", execution_time.as_millis() as f64).await;
                
                if let Ok(ref exec_result) = result {
                    if exec_result.success {
                        metrics_clone.increment_counter("successful_executions", 1.0).await;
                        metrics_clone.record_gauge("profit_generated", exec_result.actual_profit).await;
                    } else {
                        metrics_clone.increment_counter("failed_executions", 1.0).await;
                    }
                }
                
                result
            });
            
            execution_futures.push(future);
        }
        
        // Wait for all executions to complete
        let results = futures::future::join_all(execution_futures).await;
        
        let mut execution_results = Vec::new();
        for result in results {
            match result {
                Ok(Ok(exec_result)) => execution_results.push(exec_result),
                Ok(Err(e)) => error!("Execution error: {}", e),
                Err(e) => error!("Task join error: {}", e),
            }
        }
        
        info!("✅ Completed execution of {} arbitrages", execution_results.len());
        
        Ok(execution_results)
    }
    
    /// Actualiza estadísticas del engine
    async fn update_stats(&self, results: Vec<ExecutionResult>) -> Result<()> {
        let mut stats = self.stats.write().await;
        
        for result in results {
            stats.total_executions += 1;
            
            if result.success {
                stats.successful_executions += 1;
                stats.total_profit += result.actual_profit;
                stats.total_gas_used += result.gas_used.parse::<u64>().unwrap_or(0);
            } else {
                stats.failed_executions += 1;
            }
        }
        
        // Save stats to database periodically
        if stats.total_executions % 10 == 0 {
            self.database.save_engine_stats(&*stats).await?;
        }
        
        Ok(())
    }
    
    /// Inicia tareas de monitoreo en background
    async fn start_monitoring_tasks(&self) {
        info!("📊 Starting monitoring tasks...");
        
        // Health check task
        let blockchain_clone = self.blockchain.clone();
        let metrics_clone = self.metrics.clone();
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(30));
            loop {
                interval.tick().await;
                
                let health_status = blockchain_clone.get_health_status().await;
                metrics_clone.record_gauge("blockchain_health_score", health_status.overall_score).await;
                
                for (chain, score) in health_status.chain_scores {
                    let labels = vec![("chain".to_string(), chain)];
                    metrics_clone.record_gauge_with_labels("chain_health_score", score, labels).await;
                }
            }
        });
        
        // Performance monitoring task
        let stats_clone = self.stats.clone();
        let metrics_clone2 = self.metrics.clone();
        tokio::spawn(async move {
            let mut interval = tokio::time::interval(Duration::from_secs(60));
            loop {
                interval.tick().await;
                
                let stats = stats_clone.read().await;
                let success_rate = if stats.total_executions > 0 {
                    stats.successful_executions as f64 / stats.total_executions as f64
                } else {
                    0.0
                };
                
                metrics_clone2.record_gauge("success_rate", success_rate).await;
                metrics_clone2.record_gauge("total_profit", stats.total_profit).await;
                metrics_clone2.record_gauge("total_executions", stats.total_executions as f64).await;
            }
        });
    }
    
    /// Para el MEV Engine de forma graceful
    pub async fn shutdown(&self) -> Result<()> {
        info!("🛑 Shutting down MEV Engine...");
        
        // Update state to stopping
        {
            let mut state = self.state.write().await;
            state.is_running = false;
        }
        
        // Save final stats
        let stats = self.stats.read().await;
        self.database.save_engine_stats(&*stats).await?;
        
        info!("✅ MEV Engine shutdown complete");
        Ok(())
    }
    
    /// Obtiene estadísticas actuales del engine
    pub async fn get_stats(&self) -> EngineStats {
        self.stats.read().await.clone()
    }
    
    /// Obtiene estado actual del engine
    pub async fn get_state(&self) -> EngineState {
        self.state.read().await.clone()
    }
    
    /// Obtiene métricas detalladas del sistema
    pub async fn get_detailed_metrics(&self) -> Result<HashMap<String, f64>> {
        let mut metrics = HashMap::new();
        
        let stats = self.stats.read().await;
        let state = self.state.read().await;
        
        // Basic metrics
        metrics.insert("total_executions".to_string(), stats.total_executions as f64);
        metrics.insert("successful_executions".to_string(), stats.successful_executions as f64);
        metrics.insert("failed_executions".to_string(), stats.failed_executions as f64);
        metrics.insert("total_profit".to_string(), stats.total_profit);
        metrics.insert("total_gas_used".to_string(), stats.total_gas_used as f64);
        metrics.insert("total_cycles".to_string(), stats.total_cycles as f64);
        
        // Calculated metrics
        let success_rate = if stats.total_executions > 0 {
            stats.successful_executions as f64 / stats.total_executions as f64
        } else {
            0.0
        };
        metrics.insert("success_rate".to_string(), success_rate);
        
        let avg_profit = if stats.successful_executions > 0 {
            stats.total_profit / stats.successful_executions as f64
        } else {
            0.0
        };
        metrics.insert("average_profit".to_string(), avg_profit);
        
        let uptime_seconds = state.start_time.elapsed().as_secs() as f64;
        metrics.insert("uptime_seconds".to_string(), uptime_seconds);
        
        // Blockchain health metrics
        let health_status = self.blockchain.get_health_status().await;
        metrics.insert("overall_blockchain_health".to_string(), health_status.overall_score);
        
        Ok(metrics)
    }
}
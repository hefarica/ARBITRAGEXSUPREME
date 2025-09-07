//! # RPC Failover System with Health Checks
//! 
//! Resilient RPC provider management with automatic failover,
//! health monitoring, and sticky selection for simulation consistency.

use anyhow::Result;
use ethers::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use tracing::{error, info, warn, debug};

/// RPC provider configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RpcProvider {
    pub name: String,
    pub url: String,
    pub weight: u32,
    pub timeout_ms: u64,
    pub is_primary: bool,
    pub supports_trace: bool,
    pub supports_mempool: bool,
    pub max_block_lag: u64,
}

/// Health check result for an RPC provider
#[derive(Debug, Clone)]
pub struct HealthCheck {
    pub timestamp: Instant,
    pub is_healthy: bool,
    pub latency_ms: u64,
    pub block_number: u64,
    pub error: Option<String>,
    pub consecutive_failures: u32,
}

/// RPC provider manager with failover and health monitoring
pub struct RpcManager {
    providers: Vec<RpcProvider>,
    health_status: Arc<RwLock<HashMap<String, HealthCheck>>>,
    current_primary: Arc<RwLock<String>>,
    sticky_sessions: Arc<RwLock<HashMap<String, String>>>, // simulation_id -> provider_name
    client_cache: Arc<RwLock<HashMap<String, Arc<Provider<Http>>>>>,
    health_check_interval: Duration,
    max_consecutive_failures: u32,
    block_lag_threshold: u64,
}

impl RpcManager {
    /// Create new RPC manager with provider list
    pub fn new(providers: Vec<RpcProvider>) -> Self {
        let primary_provider = providers
            .iter()
            .find(|p| p.is_primary)
            .map(|p| p.name.clone())
            .unwrap_or_else(|| providers[0].name.clone());

        Self {
            providers,
            health_status: Arc::new(RwLock::new(HashMap::new())),
            current_primary: Arc::new(RwLock::new(primary_provider)),
            sticky_sessions: Arc::new(RwLock::new(HashMap::new())),
            client_cache: Arc::new(RwLock::new(HashMap::new())),
            health_check_interval: Duration::from_secs(30),
            max_consecutive_failures: 3,
            block_lag_threshold: 5,
        }
    }

    /// Start health monitoring background task
    pub async fn start_health_monitoring(&self) -> Result<()> {
        let providers = self.providers.clone();
        let health_status = self.health_status.clone();
        let current_primary = self.current_primary.clone();
        let interval = self.health_check_interval;
        let max_failures = self.max_consecutive_failures;
        let block_threshold = self.block_lag_threshold;

        tokio::spawn(async move {
            let mut interval_timer = tokio::time::interval(interval);
            
            loop {
                interval_timer.tick().await;
                
                // Get latest block from primary provider for reference
                let latest_block = Self::get_latest_block_reference(&providers).await;
                
                // Check health of all providers
                let mut health_results = HashMap::new();
                
                for provider in &providers {
                    let health = Self::check_provider_health(provider, latest_block).await;
                    debug!("Health check for {}: {:?}", provider.name, health.is_healthy);
                    health_results.insert(provider.name.clone(), health);
                }
                
                // Update health status
                {
                    let mut status = health_status.write().await;
                    *status = health_results;
                }
                
                // Check if primary needs to be changed
                let current = current_primary.read().await.clone();
                if let Some(current_health) = health_results.get(&current) {
                    if !current_health.is_healthy || 
                       current_health.consecutive_failures >= max_failures {
                        
                        // Find best healthy provider
                        if let Some(new_primary) = Self::select_best_provider(&providers, &health_results) {
                            if new_primary != current {
                                warn!(
                                    "Switching primary RPC from {} to {} (failures: {})", 
                                    current, new_primary, current_health.consecutive_failures
                                );
                                
                                let mut primary = current_primary.write().await;
                                *primary = new_primary;
                            }
                        }
                    }
                }
            }
        });

        info!("RPC health monitoring started");
        Ok(())
    }

    /// Get RPC client for general use (with failover)
    pub async fn get_client(&self) -> Result<Arc<Provider<Http>>> {
        let primary_name = self.current_primary.read().await.clone();
        
        // Try to get cached client first
        {
            let cache = self.client_cache.read().await;
            if let Some(client) = cache.get(&primary_name) {
                return Ok(client.clone());
            }
        }
        
        // Create new client for primary provider
        if let Some(provider) = self.providers.iter().find(|p| p.name == primary_name) {
            let client = self.create_client(provider).await?;
            
            // Cache the client
            {
                let mut cache = self.client_cache.write().await;
                cache.insert(primary_name.clone(), client.clone());
            }
            
            return Ok(client);
        }
        
        anyhow::bail!("No healthy RPC provider available")
    }

    /// Get RPC client with sticky session for simulations
    pub async fn get_sticky_client(&self, simulation_id: &str) -> Result<Arc<Provider<Http>>> {
        {
            let sessions = self.sticky_sessions.read().await;
            if let Some(provider_name) = sessions.get(simulation_id) {
                // Check if this provider is still healthy
                let health_status = self.health_status.read().await;
                if let Some(health) = health_status.get(provider_name) {
                    if health.is_healthy {
                        // Return cached client for this provider
                        let cache = self.client_cache.read().await;
                        if let Some(client) = cache.get(provider_name) {
                            debug!("Using sticky RPC {} for simulation {}", provider_name, simulation_id);
                            return Ok(client.clone());
                        }
                    }
                }
            }
        }
        
        // No sticky session or unhealthy provider, assign new one
        let primary_name = self.current_primary.read().await.clone();
        let client = self.get_client().await?;
        
        // Create sticky session
        {
            let mut sessions = self.sticky_sessions.write().await;
            sessions.insert(simulation_id.to_string(), primary_name.clone());
        }
        
        info!("Created sticky RPC session {} -> {}", simulation_id, primary_name);
        Ok(client)
    }

    /// Release sticky session when simulation completes
    pub async fn release_sticky_session(&self, simulation_id: &str) {
        let mut sessions = self.sticky_sessions.write().await;
        if let Some(provider_name) = sessions.remove(simulation_id) {
            debug!("Released sticky RPC session {} -> {}", simulation_id, provider_name);
        }
    }

    /// Get current health status for all providers
    pub async fn get_health_status(&self) -> HashMap<String, HealthCheck> {
        self.health_status.read().await.clone()
    }

    /// Get current primary provider name
    pub async fn get_primary_provider(&self) -> String {
        self.current_primary.read().await.clone()
    }

    /// Get health metrics for monitoring
    pub async fn get_health_metrics(&self) -> RpcHealthMetrics {
        let health_status = self.health_status.read().await;
        let primary = self.current_primary.read().await.clone();
        let sticky_count = self.sticky_sessions.read().await.len() as u32;
        
        let total_providers = self.providers.len() as u32;
        let healthy_providers = health_status.values()
            .filter(|h| h.is_healthy)
            .count() as u32;
        
        let avg_latency = if !health_status.is_empty() {
            health_status.values()
                .filter(|h| h.is_healthy)
                .map(|h| h.latency_ms)
                .sum::<u64>() / healthy_providers.max(1) as u64
        } else {
            0
        };

        RpcHealthMetrics {
            primary_provider: primary,
            total_providers,
            healthy_providers,
            average_latency_ms: avg_latency,
            active_sticky_sessions: sticky_count,
            failover_count: 0, // TODO: Track failover events
        }
    }

    /// Internal: Create HTTP client for provider
    async fn create_client(&self, provider: &RpcProvider) -> Result<Arc<Provider<Http>>> {
        let timeout = Duration::from_millis(provider.timeout_ms);
        let http_client = reqwest::Client::builder()
            .timeout(timeout)
            .build()?;
        
        let provider_http = Http::new_with_client(provider.url.parse()?, http_client);
        let client = Provider::new(provider_http);
        
        Ok(Arc::new(client))
    }

    /// Internal: Check health of a single provider
    async fn check_provider_health(
        provider: &RpcProvider, 
        reference_block: Option<u64>
    ) -> HealthCheck {
        let start = Instant::now();
        
        // Try to get latest block number
        match Self::get_block_number(&provider.url, provider.timeout_ms).await {
            Ok(block_number) => {
                let latency_ms = start.elapsed().as_millis() as u64;
                
                // Check block lag if we have reference
                let is_lagging = if let Some(ref_block) = reference_block {
                    ref_block.saturating_sub(block_number) > provider.max_block_lag
                } else {
                    false
                };
                
                HealthCheck {
                    timestamp: Instant::now(),
                    is_healthy: !is_lagging,
                    latency_ms,
                    block_number,
                    error: if is_lagging { 
                        Some(format!("Block lag: {} blocks behind", 
                               reference_block.unwrap_or(0).saturating_sub(block_number)))
                    } else { 
                        None 
                    },
                    consecutive_failures: 0,
                }
            }
            Err(e) => {
                HealthCheck {
                    timestamp: Instant::now(),
                    is_healthy: false,
                    latency_ms: start.elapsed().as_millis() as u64,
                    block_number: 0,
                    error: Some(e.to_string()),
                    consecutive_failures: 1, // This will be updated by caller
                }
            }
        }
    }

    /// Internal: Get latest block from any healthy provider for reference
    async fn get_latest_block_reference(providers: &[RpcProvider]) -> Option<u64> {
        for provider in providers {
            if let Ok(block) = Self::get_block_number(&provider.url, provider.timeout_ms).await {
                return Some(block);
            }
        }
        None
    }

    /// Internal: Get block number from specific URL
    async fn get_block_number(url: &str, timeout_ms: u64) -> Result<u64> {
        let timeout = Duration::from_millis(timeout_ms);
        let http_client = reqwest::Client::builder()
            .timeout(timeout)
            .build()?;
        
        let provider_http = Http::new_with_client(url.parse()?, http_client);
        let client = Provider::new(provider_http);
        
        let block_number = client.get_block_number().await?;
        Ok(block_number.as_u64())
    }

    /// Internal: Select best healthy provider based on latency and weight
    fn select_best_provider(
        providers: &[RpcProvider],
        health_results: &HashMap<String, HealthCheck>,
    ) -> Option<String> {
        let mut candidates: Vec<_> = providers
            .iter()
            .filter_map(|p| {
                health_results.get(&p.name).and_then(|h| {
                    if h.is_healthy {
                        Some((p, h))
                    } else {
                        None
                    }
                })
            })
            .collect();

        if candidates.is_empty() {
            return None;
        }

        // Sort by weight (descending) then by latency (ascending)
        candidates.sort_by(|a, b| {
            b.0.weight.cmp(&a.0.weight)
                .then(a.1.latency_ms.cmp(&b.1.latency_ms))
        });

        Some(candidates[0].0.name.clone())
    }
}

/// Health metrics for monitoring
#[derive(Debug, Clone, Serialize)]
pub struct RpcHealthMetrics {
    pub primary_provider: String,
    pub total_providers: u32,
    pub healthy_providers: u32,
    pub average_latency_ms: u64,
    pub active_sticky_sessions: u32,
    pub failover_count: u32,
}

/// Default RPC provider configurations
impl RpcManager {
    pub fn with_default_mainnet_providers() -> Self {
        let providers = vec![
            RpcProvider {
                name: "infura-primary".to_string(),
                url: std::env::var("INFURA_RPC_URL")
                    .unwrap_or_else(|_| "https://mainnet.infura.io/v3/YOUR_KEY".to_string()),
                weight: 100,
                timeout_ms: 5000,
                is_primary: true,
                supports_trace: false,
                supports_mempool: true,
                max_block_lag: 2,
            },
            RpcProvider {
                name: "alchemy-secondary".to_string(),
                url: std::env::var("ALCHEMY_RPC_URL")
                    .unwrap_or_else(|_| "https://eth-mainnet.alchemyapi.io/v2/YOUR_KEY".to_string()),
                weight: 90,
                timeout_ms: 5000,
                is_primary: false,
                supports_trace: true,
                supports_mempool: true,
                max_block_lag: 3,
            },
            RpcProvider {
                name: "quicknode-fallback".to_string(),
                url: std::env::var("QUICKNODE_RPC_URL")
                    .unwrap_or_else(|_| "https://your-endpoint.quiknode.pro/YOUR_KEY/".to_string()),
                weight: 80,
                timeout_ms: 7000,
                is_primary: false,
                supports_trace: true,
                supports_mempool: false,
                max_block_lag: 5,
            },
        ];

        Self::new(providers)
    }
}
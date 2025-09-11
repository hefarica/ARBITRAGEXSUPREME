use std::collections::HashMap;
use std::sync::Arc;
use tokio::time::{Duration, Instant, timeout};
use reqwest::{Client, header::{HeaderMap, HeaderValue}};
use serde::{Deserialize, Serialize};
use anyhow::Result;
use tracing::{info, warn, error, debug, instrument};
use sha3::{Digest, Keccak256};
use secp256k1::{Message, Secp256k1, SecretKey};

use crate::config::ExecutorConfig;
use crate::metrics::ExecutorMetrics;

#[derive(Debug, Clone)]
pub struct FlashbotsClient {
    config: ExecutorConfig,
    metrics: Arc<ExecutorMetrics>,
    http_clients: HashMap<String, Client>,
    relay_endpoints: Vec<RelayEndpoint>,
    signing_key: SecretKey,
}

#[derive(Debug, Clone)]
struct RelayEndpoint {
    name: String,
    url: String,
    fast_mode_url: String,
    enabled: bool,
    priority: u8,
    max_latency_ms: u64,
}

#[derive(Debug, Serialize)]
struct BundleRequest {
    #[serde(rename = "jsonrpc")]
    json_rpc: String,
    id: u64,
    method: String,
    params: Vec<BundleParams>,
}

#[derive(Debug, Serialize)]
struct BundleParams {
    txs: Vec<String>,
    #[serde(rename = "blockNumber")]
    block_number: String,
    #[serde(rename = "minTimestamp", skip_serializing_if = "Option::is_none")]
    min_timestamp: Option<u64>,
    #[serde(rename = "maxTimestamp", skip_serializing_if = "Option::is_none")]
    max_timestamp: Option<u64>,
    #[serde(rename = "revertingTxHashes", skip_serializing_if = "Vec::is_empty")]
    reverting_tx_hashes: Vec<String>,
    #[serde(rename = "replacementUuid", skip_serializing_if = "Option::is_none")]
    replacement_uuid: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
struct FastBundleRequest {
    #[serde(rename = "jsonrpc")]
    json_rpc: String,
    id: u64,
    method: String,
    params: Vec<FastBundleParams>,
}

#[derive(Debug, Serialize)]
struct FastBundleParams {
    txs: Vec<String>,
    #[serde(rename = "fast")]
    fast: bool,
    #[serde(rename = "privacy")]
    privacy: PrivacyConfig,
}

#[derive(Debug, Serialize)]
struct PrivacyConfig {
    #[serde(rename = "hints")]
    hints: Vec<String>,
    #[serde(rename = "builders")]
    builders: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct BundleResponse {
    #[serde(rename = "jsonrpc")]
    json_rpc: String,
    id: u64,
    result: Option<BundleResult>,
    error: Option<JsonRpcError>,
}

#[derive(Debug, Deserialize)]
struct BundleResult {
    #[serde(rename = "bundleHash")]
    bundle_hash: String,
}

#[derive(Debug, Deserialize)]
struct JsonRpcError {
    code: i32,
    message: String,
    data: Option<serde_json::Value>,
}

impl FlashbotsClient {
    pub async fn new(config: ExecutorConfig, metrics: Arc<ExecutorMetrics>) -> Result<Self> {
        // Initialize HTTP clients for each relay
        let mut http_clients = HashMap::new();
        
        for relay in &config.flashbots_relays {
            let mut headers = HeaderMap::new();
            headers.insert("Content-Type", HeaderValue::from_static("application/json"));
            headers.insert("User-Agent", HeaderValue::from_static("ArbitrageX-Supreme-v3.0"));
            
            let client = Client::builder()
                .timeout(Duration::from_millis(5000))
                .pool_idle_timeout(Duration::from_secs(30))
                .pool_max_idle_per_host(10)
                .http2_prior_knowledge() // Enable HTTP/2
                .default_headers(headers)
                .build()?;
                
            http_clients.insert(relay.clone(), client);
        }

        // Initialize relay endpoints
        let relay_endpoints = vec![
            RelayEndpoint {
                name: "flashbots".to_string(),
                url: "https://relay.flashbots.net".to_string(),
                fast_mode_url: "https://rpc.flashbots.net/fast".to_string(),
                enabled: true,
                priority: 1,
                max_latency_ms: 100,
            },
            RelayEndpoint {
                name: "bloXroute".to_string(),
                url: "https://mev.api.blxrbdn.com".to_string(),
                fast_mode_url: "https://mev.api.blxrbdn.com/fast".to_string(),
                enabled: true,
                priority: 2,
                max_latency_ms: 120,
            },
            RelayEndpoint {
                name: "eden".to_string(),
                url: "https://api.edennetwork.io".to_string(),
                fast_mode_url: "https://api.edennetwork.io/fast".to_string(),
                enabled: true,
                priority: 3,
                max_latency_ms: 150,
            },
        ];

        // Load signing key for Flashbots authentication
        let signing_key = SecretKey::from_slice(&hex::decode(&config.flashbots_private_key)?)?;

        Ok(Self {
            config,
            metrics,
            http_clients,
            relay_endpoints,
            signing_key,
        })
    }

    /// Submit bundle using fast mode for lowest latency (multiplexed to multiple builders)
    #[instrument(skip(self, signed_transactions))]
    pub async fn submit_bundle_fast(&self, signed_transactions: &[String]) -> Result<String> {
        let start = Instant::now();
        
        info!("🚀 Submitting bundle via Protect RPC Fast Mode: {} transactions", signed_transactions.len());
        
        // Prepare fast bundle request
        let request = FastBundleRequest {
            json_rpc: "2.0".to_string(),
            id: chrono::Utc::now().timestamp() as u64,
            method: "eth_sendBundle".to_string(),
            params: vec![FastBundleParams {
                txs: signed_transactions.to_vec(),
                fast: true,
                privacy: PrivacyConfig {
                    hints: vec!["calldata".to_string(), "logs".to_string()],
                    builders: vec![
                        "flashbots".to_string(),
                        "f1b.io".to_string(),
                        "rsync".to_string(),
                        "beaverbuild.org".to_string(),
                    ],
                },
            }],
        };

        // Submit to multiple relays in parallel for redundancy
        let submission_tasks: Vec<_> = self.relay_endpoints
            .iter()
            .filter(|relay| relay.enabled)
            .map(|relay| {
                let client = self.http_clients.get(&relay.name).unwrap().clone();
                let request = request.clone();
                let relay = relay.clone();
                let signing_key = self.signing_key;
                
                tokio::spawn(async move {
                    Self::submit_to_relay(client, request, relay, signing_key).await
                })
            })
            .collect();

        // Wait for first successful submission or timeout
        let mut bundle_hash = None;
        let mut errors = Vec::new();

        for task in submission_tasks {
            match timeout(Duration::from_millis(2000), task).await {
                Ok(Ok(Ok(hash))) => {
                    bundle_hash = Some(hash);
                    break; // First successful submission wins
                }
                Ok(Ok(Err(e))) => {
                    errors.push(e.to_string());
                }
                Ok(Err(e)) => {
                    errors.push(format!("Task error: {}", e));
                }
                Err(_) => {
                    errors.push("Timeout".to_string());
                }
            }
        }

        let elapsed = start.elapsed();
        self.metrics.flashbots_submission_duration.observe(elapsed.as_millis() as f64);

        match bundle_hash {
            Some(hash) => {
                info!("✅ Bundle submitted successfully: {} in {:?}", hash, elapsed);
                self.metrics.successful_bundle_submissions.inc();
                Ok(hash)
            }
            None => {
                error!("❌ All relay submissions failed: {:?}", errors);
                self.metrics.failed_bundle_submissions.inc();
                Err(anyhow::anyhow!("All relay submissions failed: {:?}", errors))
            }
        }
    }

    /// Submit to individual relay with authentication
    async fn submit_to_relay(
        client: Client,
        request: FastBundleRequest,
        relay: RelayEndpoint,
        signing_key: SecretKey,
    ) -> Result<String> {
        let start = Instant::now();
        
        // Serialize request body
        let body = serde_json::to_string(&request)?;
        
        // Create Flashbots signature
        let signature = Self::create_flashbots_signature(&body, signing_key)?;
        
        // Build request with authentication headers
        let mut req_builder = client
            .post(&relay.fast_mode_url)
            .header("X-Flashbots-Signature", signature)
            .header("Content-Type", "application/json")
            .body(body);

        // Submit request
        let response = req_builder.send().await?;
        let elapsed = start.elapsed();
        
        debug!("📤 Relay {} responded in {:?}", relay.name, elapsed);
        
        if elapsed.as_millis() > relay.max_latency_ms.into() {
            warn!("⚠️ Relay {} exceeded latency threshold: {:?} > {}ms", 
                  relay.name, elapsed, relay.max_latency_ms);
        }

        // Parse response
        let response_text = response.text().await?;
        let bundle_response: BundleResponse = serde_json::from_str(&response_text)?;

        match bundle_response.result {
            Some(result) => {
                info!("✅ Bundle accepted by {}: {}", relay.name, result.bundle_hash);
                Ok(result.bundle_hash)
            }
            None => {
                let error_msg = bundle_response.error
                    .map(|e| format!("{}: {}", e.code, e.message))
                    .unwrap_or_else(|| "Unknown error".to_string());
                
                warn!("❌ Bundle rejected by {}: {}", relay.name, error_msg);
                Err(anyhow::anyhow!("Relay {} rejected bundle: {}", relay.name, error_msg))
            }
        }
    }

    /// Create Flashbots authentication signature
    fn create_flashbots_signature(body: &str, signing_key: SecretKey) -> Result<String> {
        let secp = Secp256k1::new();
        
        // Create message hash
        let mut hasher = Keccak256::new();
        hasher.update(body.as_bytes());
        let hash = hasher.finalize();
        
        let message = Message::from_slice(&hash)?;
        let signature = secp.sign_ecdsa(&message, &signing_key);
        
        // Format as hex string with recovery ID
        let (recovery_id, signature_bytes) = signature.serialize_compact();
        let mut full_signature = Vec::with_capacity(65);
        full_signature.extend_from_slice(&signature_bytes);
        full_signature.push(recovery_id.to_i32() as u8);
        
        Ok(format!("0x{}", hex::encode(full_signature)))
    }

    /// Submit bundle using standard mode (fallback)
    #[allow(dead_code)]
    pub async fn submit_bundle_standard(&self, signed_transactions: &[String], block_number: u64) -> Result<String> {
        let request = BundleRequest {
            json_rpc: "2.0".to_string(),
            id: chrono::Utc::now().timestamp() as u64,
            method: "eth_sendBundle".to_string(),
            params: vec![BundleParams {
                txs: signed_transactions.to_vec(),
                block_number: format!("0x{:x}", block_number),
                min_timestamp: None,
                max_timestamp: None,
                reverting_tx_hashes: Vec::new(),
                replacement_uuid: None,
            }],
        };

        // Submit to primary relay only (for standard mode)
        let primary_relay = &self.relay_endpoints[0];
        let client = self.http_clients.get(&primary_relay.name).unwrap();
        
        Self::submit_to_relay(client.clone(), 
            FastBundleRequest {
                json_rpc: request.json_rpc,
                id: request.id,
                method: request.method,
                params: vec![FastBundleParams {
                    txs: request.params[0].txs.clone(),
                    fast: false,
                    privacy: PrivacyConfig {
                        hints: vec!["calldata".to_string()],
                        builders: vec!["flashbots".to_string()],
                    },
                }],
            }, 
            primary_relay.clone(), 
            self.signing_key
        ).await
    }

    /// Check bundle inclusion status
    pub async fn get_bundle_status(&self, bundle_hash: &str) -> Result<BundleStatus> {
        // Implementation for checking bundle status across relays
        // This would query multiple relays for inclusion status
        
        // For now, return unknown status
        Ok(BundleStatus::Unknown)
    }
}

#[derive(Debug, Clone)]
pub enum BundleStatus {
    Pending,
    Included(u64), // Block number
    Failed(String), // Error reason
    Unknown,
}

// Module for bloXroute integration
pub mod bloxroute {
    use super::*;
    
    pub struct BloxrouteClient {
        auth_header: String,
        gateway_url: String,
        client: Client,
    }
    
    impl BloxrouteClient {
        pub fn new(auth_token: &str, gateway_url: &str) -> Result<Self> {
            let client = Client::builder()
                .timeout(Duration::from_millis(3000))
                .http3_prior_knowledge()
                .build()?;
                
            Ok(Self {
                auth_header: format!("Bearer {}", auth_token),
                gateway_url: gateway_url.to_string(),
                client,
            })
        }
        
        pub async fn submit_bundle_bdn(&self, transactions: &[String]) -> Result<String> {
            // Implementation for bloXroute BDN submission
            // This provides additional redundancy and potentially lower latency
            
            todo!("Implement bloXroute BDN integration")
        }
    }
}
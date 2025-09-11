use anyhow::Result;
use ethers::prelude::*;
use ethers::types::transaction::eip2718::TypedTransaction;
use ethers::signers::{LocalWallet, Signer};
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};

use crate::metrics::ExecutorMetrics;

/// Helper macro for creating EIP-712 domain
macro_rules! eip712_domain {
    (name: $name:expr, version: $version:expr, chain_id: $chain_id:expr) => {
        serde_json::json!({
            "name": $name,
            "version": $version,
            "chainId": $chain_id,
            "verifyingContract": "0x0000000000000000000000000000000000000000"
        })
    };
}

/// High-performance signer pool for parallel transaction signing
/// Target: <2ms signing latency per transaction
pub struct SignerPool {
    signers: Vec<Arc<RwLock<LocalWallet>>>,
    current_index: parking_lot::Mutex<usize>,
    metrics: Arc<ExecutorMetrics>,
    chain_id: u64,
}

impl SignerPool {
    /// Create new signer pool from private keys
    pub fn new(
        private_keys: Vec<String>,
        chain_id: u64,
        metrics: Arc<ExecutorMetrics>,
    ) -> Result<Self> {
        let mut signers = Vec::with_capacity(private_keys.len());

        for (i, pk) in private_keys.iter().enumerate() {
            let wallet: LocalWallet = pk.parse()
                .map_err(|e| anyhow::anyhow!("Invalid private key {}: {}", i, e))?;
            
            let wallet = wallet.with_chain_id(chain_id);
            signers.push(Arc::new(RwLock::new(wallet)));
            
            info!("Initialized signer {}: {}", i, wallet.address());
        }

        if signers.is_empty() {
            return Err(anyhow::anyhow!("No valid signers provided"));
        }

        Ok(Self {
            signers,
            current_index: parking_lot::Mutex::new(0),
            metrics,
            chain_id,
        })
    }

    /// Sign transaction with round-robin signer selection
    /// Target: <2ms signing time
    pub async fn sign_transaction(&self, tx: &TypedTransaction) -> Result<Signature> {
        let start = std::time::Instant::now();

        let signer = self.get_next_signer().await;
        
        // Sign transaction
        let signature = {
            let signer = signer.read().await;
            signer.sign_transaction(tx).await
                .map_err(|e| anyhow::anyhow!("Signing failed: {}", e))?
        };

        let elapsed = start.elapsed();
        self.metrics.signing_duration.observe(elapsed.as_secs_f64());

        if elapsed > std::time::Duration::from_millis(2) {
            warn!("Transaction signing exceeded 2ms target: {:?}", elapsed);
        }

        debug!("Signed transaction in {:?}", elapsed);

        Ok(signature)
    }

    /// Sign multiple transactions in parallel
    pub async fn sign_batch(&self, transactions: &[TypedTransaction]) -> Result<Vec<Signature>> {
        let start = std::time::Instant::now();

        let mut handles = Vec::with_capacity(transactions.len());

        for tx in transactions {
            let signer = self.get_next_signer().await;
            let tx = tx.clone();
            let handle = tokio::spawn(async move {
                let signer = signer.read().await;
                signer.sign_transaction(&tx).await
                    .map_err(|e| anyhow::anyhow!("Batch signing failed: {}", e))
            });
            handles.push(handle);
        }

        // Wait for all signatures
        let mut signatures = Vec::with_capacity(transactions.len());
        for handle in handles {
            let sig = handle.await??;
            signatures.push(sig);
        }

        let elapsed = start.elapsed();
        let avg_time = elapsed.as_secs_f64() / transactions.len() as f64;
        
        info!(
            "Signed {} transactions in {:?} (avg: {:.2}ms per tx)",
            transactions.len(),
            elapsed,
            avg_time * 1000.0
        );

        Ok(signatures)
    }

    /// Get next available signer (round-robin)
    async fn get_next_signer(&self) -> Arc<RwLock<LocalWallet>> {
        let mut index = self.current_index.lock();
        let signer = self.signers[*index].clone();
        *index = (*index + 1) % self.signers.len();
        signer
    }

    /// Get signer by specific index
    pub async fn get_signer(&self, index: usize) -> Result<Arc<RwLock<LocalWallet>>> {
        if index >= self.signers.len() {
            return Err(anyhow::anyhow!("Signer index {} out of bounds", index));
        }
        Ok(self.signers[index].clone())
    }

    /// Get all signer addresses
    pub async fn get_addresses(&self) -> Vec<Address> {
        let mut addresses = Vec::with_capacity(self.signers.len());
        
        for signer in &self.signers {
            let signer = signer.read().await;
            addresses.push(signer.address());
        }
        
        addresses
    }

    /// Get signer count
    pub fn len(&self) -> usize {
        self.signers.len()
    }

    /// Check if pool is empty
    pub fn is_empty(&self) -> bool {
        self.signers.is_empty()
    }

    /// Sign raw hash (for custom messages)
    pub async fn sign_hash(&self, hash: &[u8; 32]) -> Result<Signature> {
        let start = std::time::Instant::now();

        let signer = self.get_next_signer().await;
        let signature = {
            let signer = signer.read().await;
            signer.sign_hash(hash.into())
                .map_err(|e| anyhow::anyhow!("Hash signing failed: {}", e))?
        };

        let elapsed = start.elapsed();
        debug!("Signed hash in {:?}", elapsed);

        Ok(signature)
    }

    /// Create EIP-712 signature for Flashbots authentication
    pub async fn sign_flashbots_auth(&self, bundle_hash: &str) -> Result<Signature> {
        // EIP-712 domain for Flashbots
        let domain = eip712_domain! {
            name: "Flashbots",
            version: "1",
            chain_id: self.chain_id
        };

        let message = serde_json::json!({
            "bundleHash": bundle_hash
        });

        let signer = self.get_next_signer().await;
        
        // For simplicity, sign the bundle hash directly
        // In production, would implement proper EIP-712 structured data
        let hash_bytes = hex::decode(bundle_hash.trim_start_matches("0x"))
            .map_err(|e| anyhow::anyhow!("Invalid bundle hash: {}", e))?
            .try_into()
            .map_err(|_| anyhow::anyhow!("Bundle hash must be 32 bytes"))?;
            
        let signature = {
            let signer = signer.read().await;
            signer.sign_hash(hash_bytes.into())
                .map_err(|e| anyhow::anyhow!("Flashbots auth signing failed: {}", e))?
        };

        Ok(signature)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_signer_pool_creation() {
        let private_keys = vec![
            "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef".to_string()
        ];
        
        let metrics = Arc::new(crate::metrics::ExecutorMetrics::new());
        let pool = SignerPool::new(private_keys, 1, metrics);
        
        assert!(pool.is_ok());
        let pool = pool.unwrap();
        assert_eq!(pool.len(), 1);
    }

    #[tokio::test]
    async fn test_signing_performance() {
        // Test <2ms signing target
        // Would need proper transaction mock
    }
}
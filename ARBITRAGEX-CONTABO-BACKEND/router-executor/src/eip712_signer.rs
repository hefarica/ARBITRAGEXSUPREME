// ==============================================================================
// ArbitrageX Supreme V3.0 - EIP-712 Signature Implementation
// Ultra-Low Latency EIP-712 Domain Separator and Signature Validation
// Critical Security Enhancement - Phase 1 Implementation
// ==============================================================================

use ethers::types::{Address, Signature, U256, H256, Bytes};
use ethers::utils::{keccak256, hash_message};
use ethers::core::k256::ecdsa::{RecoveryId, Signature as K256Signature};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use parking_lot::RwLock;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EIP712Domain {
    pub name: String,
    pub version: String,
    pub chain_id: U256,
    pub verifying_contract: Address,
    pub salt: Option<H256>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArbitrageOrder {
    pub from: Address,
    pub to: Address,
    pub token_in: Address,
    pub token_out: Address,
    pub amount_in: U256,
    pub min_amount_out: U256,
    pub nonce: U256,
    pub deadline: U256,
    pub route_hash: H256,
}

#[derive(Debug)]
pub struct EIP712Signer {
    domain: EIP712Domain,
    domain_separator: H256,
    nonce_manager: RwLock<NonceManager>,
}

#[derive(Debug, Default)]
pub struct NonceManager {
    nonces: HashMap<Address, U256>,
    last_cleanup: u64,
}

#[derive(Debug)]
pub struct SignatureValidationResult {
    pub is_valid: bool,
    pub recovered_address: Option<Address>,
    pub error_message: Option<String>,
    pub validation_time_ms: u64,
}

impl EIP712Signer {
    /// Create new EIP-712 signer with domain configuration
    pub fn new(
        name: String,
        version: String,
        chain_id: U256,
        verifying_contract: Address,
    ) -> Self {
        let domain = EIP712Domain {
            name: name.clone(),
            version: version.clone(),
            chain_id,
            verifying_contract,
            salt: None,
        };

        let domain_separator = Self::compute_domain_separator(&domain);

        Self {
            domain,
            domain_separator,
            nonce_manager: RwLock::new(NonceManager::default()),
        }
    }

    /// Compute EIP-712 domain separator hash
    /// This prevents cross-chain and cross-contract replay attacks
    fn compute_domain_separator(domain: &EIP712Domain) -> H256 {
        // EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)
        let type_hash = keccak256(
            "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
        );

        let name_hash = keccak256(domain.name.as_bytes());
        let version_hash = keccak256(domain.version.as_bytes());

        // Encode domain separator according to EIP-712
        let mut encoded = Vec::new();
        encoded.extend_from_slice(&type_hash);
        encoded.extend_from_slice(&name_hash);
        encoded.extend_from_slice(&version_hash);
        encoded.extend_from_slice(&domain.chain_id.to_be_bytes::<32>());
        encoded.extend_from_slice(domain.verifying_contract.as_bytes());

        H256::from(keccak256(encoded))
    }

    /// Get or generate nonce for address with automatic cleanup
    pub fn get_nonce(&self, address: Address) -> U256 {
        let mut manager = self.nonce_manager.write();
        
        // Cleanup old nonces periodically (every 1 hour)
        let current_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
            
        if current_time - manager.last_cleanup > 3600 {
            // Keep only recent nonces to prevent memory bloat
            if manager.nonces.len() > 10000 {
                manager.nonces.clear();
            }
            manager.last_cleanup = current_time;
        }

        let nonce = manager.nonces.get(&address).copied().unwrap_or_default();
        let new_nonce = nonce + U256::one();
        manager.nonces.insert(address, new_nonce);
        
        new_nonce
    }

    /// Create typed data hash for arbitrage order
    pub fn create_arbitrage_order_hash(&self, order: &ArbitrageOrder) -> H256 {
        // ArbitrageOrder(address from,address to,address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,uint256 nonce,uint256 deadline,bytes32 routeHash)
        let type_hash = keccak256(
            "ArbitrageOrder(address from,address to,address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,uint256 nonce,uint256 deadline,bytes32 routeHash)"
        );

        let mut encoded = Vec::new();
        encoded.extend_from_slice(&type_hash);
        encoded.extend_from_slice(order.from.as_bytes());
        encoded.extend_from_slice(order.to.as_bytes());
        encoded.extend_from_slice(order.token_in.as_bytes());
        encoded.extend_from_slice(order.token_out.as_bytes());
        encoded.extend_from_slice(&order.amount_in.to_be_bytes::<32>());
        encoded.extend_from_slice(&order.min_amount_out.to_be_bytes::<32>());
        encoded.extend_from_slice(&order.nonce.to_be_bytes::<32>());
        encoded.extend_from_slice(&order.deadline.to_be_bytes::<32>());
        encoded.extend_from_slice(order.route_hash.as_bytes());

        H256::from(keccak256(encoded))
    }

    /// Create EIP-712 message hash
    pub fn create_message_hash(&self, struct_hash: H256) -> H256 {
        let mut encoded = Vec::new();
        encoded.extend_from_slice(b"\x19\x01"); // EIP-712 magic
        encoded.extend_from_slice(self.domain_separator.as_bytes());
        encoded.extend_from_slice(struct_hash.as_bytes());

        H256::from(keccak256(encoded))
    }

    /// Sign arbitrage order with EIP-712
    pub fn sign_arbitrage_order(
        &self,
        order: &ArbitrageOrder,
        private_key: &[u8; 32],
    ) -> Result<Signature, Box<dyn std::error::Error + Send + Sync>> {
        let struct_hash = self.create_arbitrage_order_hash(order);
        let message_hash = self.create_message_hash(struct_hash);

        // Sign with secp256k1
        let signing_key = k256::ecdsa::SigningKey::from_bytes(private_key.into())?;
        let signature: K256Signature = signing_key.sign_prehash_recoverable(&message_hash.0)?;
        
        // Convert to ethers signature format
        let (signature_bytes, recovery_id) = signature.to_bytes();
        let v = recovery_id.to_byte() + 27; // Add 27 for Ethereum format
        
        Ok(Signature {
            r: U256::from_big_endian(&signature_bytes[0..32]),
            s: U256::from_big_endian(&signature_bytes[32..64]),
            v: v as u64,
        })
    }

    /// Validate signature with comprehensive security checks
    pub fn validate_signature(
        &self,
        order: &ArbitrageOrder,
        signature: &Signature,
        expected_signer: Address,
    ) -> SignatureValidationResult {
        let start_time = std::time::Instant::now();
        
        // 1. Validate timestamp (deadline check)
        let current_time = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
            
        if order.deadline.as_u64() < current_time {
            return SignatureValidationResult {
                is_valid: false,
                recovered_address: None,
                error_message: Some("Transaction expired".to_string()),
                validation_time_ms: start_time.elapsed().as_millis() as u64,
            };
        }

        // 2. Validate nonce (replay protection)
        let manager = self.nonce_manager.read();
        if let Some(&last_nonce) = manager.nonces.get(&order.from) {
            if order.nonce <= last_nonce {
                return SignatureValidationResult {
                    is_valid: false,
                    recovered_address: None,
                    error_message: Some("Invalid nonce - potential replay attack".to_string()),
                    validation_time_ms: start_time.elapsed().as_millis() as u64,
                };
            }
        }
        drop(manager);

        // 3. Validate signature malleability (s-value check)
        let secp256k1_n_half = U256::from_dec_str(
            "57896044618658097711785492504343953926418782139537452191302581570759080747168"
        ).unwrap();
        
        if signature.s > secp256k1_n_half {
            return SignatureValidationResult {
                is_valid: false,
                recovered_address: None,
                error_message: Some("Invalid signature - malleability protection".to_string()),
                validation_time_ms: start_time.elapsed().as_millis() as u64,
            };
        }

        // 4. Recover address from signature
        let struct_hash = self.create_arbitrage_order_hash(order);
        let message_hash = self.create_message_hash(struct_hash);
        
        match self.recover_address(message_hash, signature) {
            Ok(recovered_address) => {
                // 5. Validate recovered address matches expected signer
                let is_valid = recovered_address == expected_signer && 
                               recovered_address != Address::zero(); // Prevent zero address
                
                SignatureValidationResult {
                    is_valid,
                    recovered_address: Some(recovered_address),
                    error_message: if !is_valid { 
                        Some("Address mismatch or zero address".to_string()) 
                    } else { 
                        None 
                    },
                    validation_time_ms: start_time.elapsed().as_millis() as u64,
                }
            }
            Err(e) => SignatureValidationResult {
                is_valid: false,
                recovered_address: None,
                error_message: Some(format!("Signature recovery failed: {}", e)),
                validation_time_ms: start_time.elapsed().as_millis() as u64,
            }
        }
    }

    /// Recover address from message hash and signature
    fn recover_address(
        &self,
        message_hash: H256,
        signature: &Signature,
    ) -> Result<Address, Box<dyn std::error::Error + Send + Sync>> {
        // Convert v value back to recovery ID
        let recovery_id = if signature.v >= 27 {
            RecoveryId::try_from((signature.v - 27) as u8)?
        } else {
            RecoveryId::try_from(signature.v as u8)?
        };

        // Create signature bytes
        let mut sig_bytes = [0u8; 64];
        signature.r.to_big_endian(&mut sig_bytes[0..32]);
        signature.s.to_big_endian(&mut sig_bytes[32..64]);

        // Recover public key
        let signature = K256Signature::from_bytes(&sig_bytes.into())?;
        let recovered_key = signature.recover_prehash(&message_hash.0, recovery_id)?;
        
        // Convert to Ethereum address
        let public_key_bytes = recovered_key.to_sec1_bytes();
        let hash = keccak256(&public_key_bytes[1..]); // Skip first byte (0x04)
        let address = Address::from_slice(&hash[12..]); // Last 20 bytes
        
        Ok(address)
    }

    /// Create arbitrage order with automatic nonce and deadline
    pub fn create_arbitrage_order(
        &self,
        from: Address,
        to: Address,
        token_in: Address,
        token_out: Address,
        amount_in: U256,
        min_amount_out: U256,
        route_hash: H256,
        deadline_seconds: u64,
    ) -> ArbitrageOrder {
        let nonce = self.get_nonce(from);
        let deadline = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs() + deadline_seconds;

        ArbitrageOrder {
            from,
            to,
            token_in,
            token_out,
            amount_in,
            min_amount_out,
            nonce,
            deadline: U256::from(deadline),
            route_hash,
        }
    }

    /// Batch signature validation for multiple orders (optimized for hot path)
    pub fn validate_signatures_batch(
        &self,
        orders_and_signatures: &[(ArbitrageOrder, Signature, Address)],
    ) -> Vec<SignatureValidationResult> {
        orders_and_signatures
            .iter()
            .map(|(order, signature, expected_signer)| {
                self.validate_signature(order, signature, *expected_signer)
            })
            .collect()
    }

    /// Get domain information for debugging
    pub fn get_domain_info(&self) -> (&EIP712Domain, H256) {
        (&self.domain, self.domain_separator)
    }

    /// Update domain separator (for upgrades)
    pub fn update_domain(&mut self, new_domain: EIP712Domain) {
        self.domain_separator = Self::compute_domain_separator(&new_domain);
        self.domain = new_domain;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ethers::types::Address;

    #[test]
    fn test_domain_separator_generation() {
        let signer = EIP712Signer::new(
            "ArbitrageX Supreme".to_string(),
            "3.0".to_string(),
            U256::from(1), // Mainnet
            Address::from_low_u64_be(0x123456),
        );

        let (domain, separator) = signer.get_domain_info();
        assert_eq!(domain.name, "ArbitrageX Supreme");
        assert_eq!(domain.version, "3.0");
        assert_ne!(separator, H256::zero());
    }

    #[test]
    fn test_nonce_management() {
        let signer = EIP712Signer::new(
            "Test".to_string(),
            "1.0".to_string(),
            U256::from(1),
            Address::zero(),
        );

        let address = Address::from_low_u64_be(0x123);
        let nonce1 = signer.get_nonce(address);
        let nonce2 = signer.get_nonce(address);
        
        assert_eq!(nonce1, U256::from(1));
        assert_eq!(nonce2, U256::from(2));
    }
}
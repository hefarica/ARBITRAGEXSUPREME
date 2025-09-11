// Secure Transaction Builder with EIP-712 Integration
use crate::eip712_signer::{EIP712Signer, ArbitrageOrder};
use ethers::types::{Address, U256, H256};
use std::sync::Arc;
use anyhow::Result;

pub struct SecureTransactionBuilder {
    eip712_signer: Arc<EIP712Signer>,
}

impl SecureTransactionBuilder {
    pub fn new(chain_id: U256, contract_address: Address) -> Self {
        let signer = EIP712Signer::new(
            "ArbitrageX Supreme".to_string(),
            "3.0".to_string(),
            chain_id,
            contract_address,
        );
        
        Self {
            eip712_signer: Arc::new(signer),
        }
    }
    
    pub fn create_secure_arbitrage_order(
        &self,
        from: Address,
        to: Address,
        token_in: Address,
        token_out: Address,
        amount_in: U256,
        min_amount_out: U256,
        route_hash: H256,
    ) -> ArbitrageOrder {
        self.eip712_signer.create_arbitrage_order(
            from,
            to,
            token_in,
            token_out,
            amount_in,
            min_amount_out,
            route_hash,
            60, // 60 seconds deadline
        )
    }
}

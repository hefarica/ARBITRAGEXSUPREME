-- ArbitrageX Pro 2025 - Database Seed Data
-- Initial data for development and testing

-- =============================================================================
-- SUBSCRIPTION PLANS
-- =============================================================================

INSERT INTO "subscription_plans" (id, name, description, price_monthly, features, limits, is_active, created_at) VALUES
  (
    gen_random_uuid(),
    'Starter',
    'Perfect for individual traders getting started with arbitrage',
    29.99,
    '["Real-time opportunities", "Basic strategies", "Email support", "Up to 3 blockchains"]'::jsonb,
    '{"max_executions_per_day": 10, "max_blockchains": 3, "max_configs": 2, "api_calls_per_minute": 60}'::jsonb,
    true,
    NOW()
  ),
  (
    gen_random_uuid(),
    'Professional',
    'Advanced features for serious arbitrage traders',
    99.99,
    '["All Starter features", "Advanced strategies", "Priority support", "All blockchains", "Custom notifications"]'::jsonb,
    '{"max_executions_per_day": 100, "max_blockchains": 12, "max_configs": 10, "api_calls_per_minute": 300}'::jsonb,
    true,
    NOW()
  ),
  (
    gen_random_uuid(),
    'Enterprise',
    'Full-featured solution for institutional trading',
    499.99,
    '["All Professional features", "White-label solution", "24/7 support", "Custom integrations", "Dedicated infrastructure"]'::jsonb,
    '{"max_executions_per_day": -1, "max_blockchains": -1, "max_configs": -1, "api_calls_per_minute": 1000}'::jsonb,
    true,
    NOW()
  );

-- =============================================================================
-- DEMO TENANT & USER
-- =============================================================================

INSERT INTO "tenants" (id, name, slug, domain, status, created_at, updated_at) VALUES
  (
    '550e8400-e29b-41d4-a716-446655440000',
    'ArbitrageX Demo',
    'demo',
    'demo.arbitragex.pro',
    'ACTIVE',
    NOW(),
    NOW()
  );

INSERT INTO "users" (id, tenant_id, email, password_hash, first_name, last_name, role, status, created_at, updated_at) VALUES
  (
    '550e8400-e29b-41d4-a716-446655440001',
    '550e8400-e29b-41d4-a716-446655440000',
    'admin@arbitragex.pro',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewvL/Zsd.c6g2ojO', -- password: admin123
    'ArbitrageX',
    'Admin',
    'ADMIN',
    'ACTIVE',
    NOW(),
    NOW()
  );

-- =============================================================================
-- BLOCKCHAIN NETWORKS
-- =============================================================================

INSERT INTO "blockchain_networks" (id, network_id, name, symbol, chain_id, rpc_url, ws_url, explorer_url, block_time, is_active, created_at, updated_at) VALUES
  (
    gen_random_uuid(),
    'ethereum',
    'Ethereum Mainnet',
    'ETH',
    1,
    'https://ethereum.publicnode.com',
    'wss://ethereum.publicnode.com',
    'https://etherscan.io',
    12,
    true,
    NOW(),
    NOW()
  ),
  (
    gen_random_uuid(),
    'bsc',
    'BNB Smart Chain',
    'BNB',
    56,
    'https://bsc-dataseed1.binance.org',
    NULL,
    'https://bscscan.com',
    3,
    true,
    NOW(),
    NOW()
  ),
  (
    gen_random_uuid(),
    'polygon',
    'Polygon Mainnet',
    'MATIC',
    137,
    'https://polygon-rpc.com',
    'wss://polygon-rpc.com',
    'https://polygonscan.com',
    2,
    true,
    NOW(),
    NOW()
  ),
  (
    gen_random_uuid(),
    'arbitrum',
    'Arbitrum One',
    'ETH',
    42161,
    'https://arbitrum.publicnode.com',
    'wss://arbitrum.publicnode.com',
    'https://arbiscan.io',
    1,
    true,
    NOW(),
    NOW()
  ),
  (
    gen_random_uuid(),
    'optimism',
    'Optimism',
    'ETH',
    10,
    'https://optimism.publicnode.com',
    'wss://optimism.publicnode.com',
    'https://optimistic.etherscan.io',
    2,
    true,
    NOW(),
    NOW()
  );

-- =============================================================================
-- DEX PROTOCOLS
-- =============================================================================

-- Ethereum DEXs
INSERT INTO "dex_protocols" (id, network_id, name, protocol_type, router_address, factory_address, supports_flash_loans, fee_percentage, tvl_usd, is_active, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  bn.id,
  'Uniswap V3',
  'uniswap_v3',
  '0xE592427A0AEce92De3Edee1F18E0157C05861564',
  '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  true,
  0.0030,
  5200000000.00,
  true,
  NOW(),
  NOW()
FROM "blockchain_networks" bn WHERE bn.network_id = 'ethereum';

INSERT INTO "dex_protocols" (id, network_id, name, protocol_type, router_address, factory_address, supports_flash_loans, fee_percentage, tvl_usd, is_active, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  bn.id,
  'SushiSwap',
  'uniswap_v2',
  '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F',
  '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac',
  false,
  0.0030,
  720000000.00,
  true,
  NOW(),
  NOW()
FROM "blockchain_networks" bn WHERE bn.network_id = 'ethereum';

-- BSC DEXs
INSERT INTO "dex_protocols" (id, network_id, name, protocol_type, router_address, factory_address, supports_flash_loans, fee_percentage, tvl_usd, is_active, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  bn.id,
  'PancakeSwap V2',
  'uniswap_v2',
  '0x10ED43C718714eb63d5aA57B78B54704E256024E',
  '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73',
  true,
  0.0025,
  1800000000.00,
  true,
  NOW(),
  NOW()
FROM "blockchain_networks" bn WHERE bn.network_id = 'bsc';

-- Polygon DEXs
INSERT INTO "dex_protocols" (id, network_id, name, protocol_type, router_address, factory_address, supports_flash_loans, fee_percentage, tvl_usd, is_active, created_at, updated_at)
SELECT 
  gen_random_uuid(),
  bn.id,
  'QuickSwap',
  'uniswap_v2',
  '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff',
  '0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32',
  false,
  0.0030,
  85000000.00,
  true,
  NOW(),
  NOW()
FROM "blockchain_networks" bn WHERE bn.network_id = 'polygon';

-- =============================================================================
-- DEMO ARBITRAGE CONFIG
-- =============================================================================

INSERT INTO "arbitrage_configs" (id, tenant_id, name, description, strategies, blockchains, risk_settings, slippage_tolerance, min_profit_threshold, max_position_size, is_active, created_at, updated_at) VALUES
  (
    gen_random_uuid(),
    '550e8400-e29b-41d4-a716-446655440000',
    'Multi-Chain Arbitrage Strategy',
    'Aggressive arbitrage strategy across Ethereum, BSC, and Polygon',
    '["triangular_arbitrage", "cross_chain_arbitrage", "flash_loan_arbitrage"]'::jsonb,
    '["ethereum", "bsc", "polygon", "arbitrum"]'::jsonb,
    '{"max_gas_price_gwei": 100, "max_slippage": 0.01, "stop_loss_percentage": 0.05, "max_concurrent_executions": 3}'::jsonb,
    0.0050,
    0.0150,
    10000.00000000,
    true,
    NOW(),
    NOW()
  );

-- =============================================================================
-- SAMPLE TRADING PAIRS (Top pairs for each DEX)
-- =============================================================================

-- Ethereum - Uniswap V3 pairs
INSERT INTO "trading_pairs" (id, dex_protocol_id, token0_address, token1_address, token0_symbol, token1_symbol, pair_address, reserve0, reserve1, price, volume_24h_usd, liquidity_usd, last_updated, created_at)
SELECT 
  gen_random_uuid(),
  dp.id,
  '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
  '0xA0b86a33E6441c8C7606b9e9F31C2C19b5F0AED',
  'WETH',
  'USDC',
  '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640',
  125.000000000000000000,
  312500.000000000000000000,
  2500.000000000000000000,
  45000000.00,
  8750000.00,
  NOW(),
  NOW()
FROM "dex_protocols" dp 
JOIN "blockchain_networks" bn ON dp.network_id = bn.id 
WHERE bn.network_id = 'ethereum' AND dp.name = 'Uniswap V3';

-- BSC - PancakeSwap pairs
INSERT INTO "trading_pairs" (id, dex_protocol_id, token0_address, token1_address, token0_symbol, token1_symbol, pair_address, reserve0, reserve1, price, volume_24h_usd, liquidity_usd, last_updated, created_at)
SELECT 
  gen_random_uuid(),
  dp.id,
  '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
  '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
  'WBNB',
  'USDC',
  '0x58F876857a02D6762E0101bb5C46A8c1ED44Dc16',
  2500.000000000000000000,
  625000.000000000000000000,
  250.000000000000000000,
  12000000.00,
  2100000.00,
  NOW(),
  NOW()
FROM "dex_protocols" dp 
JOIN "blockchain_networks" bn ON dp.network_id = bn.id 
WHERE bn.network_id = 'bsc' AND dp.name = 'PancakeSwap V2';

-- =============================================================================
-- INITIAL NETWORK STATUS (Example data)
-- =============================================================================

INSERT INTO "network_status" (id, network_id, block_number, gas_price_gwei, is_syncing, peer_count, response_time_ms, is_healthy, checked_at)
SELECT 
  gen_random_uuid(),
  bn.id,
  CASE bn.network_id 
    WHEN 'ethereum' THEN 23278900
    WHEN 'bsc' THEN 59813100
    WHEN 'polygon' THEN 75981500
    WHEN 'arbitrum' THEN 145632100
    WHEN 'optimism' THEN 112458900
  END,
  CASE bn.network_id 
    WHEN 'ethereum' THEN 15.5000
    WHEN 'bsc' THEN 3.2000
    WHEN 'polygon' THEN 35.8000
    WHEN 'arbitrum' THEN 0.1200
    WHEN 'optimism' THEN 0.0800
  END,
  false,
  CASE bn.network_id 
    WHEN 'ethereum' THEN 25
    WHEN 'bsc' THEN 18
    WHEN 'polygon' THEN 22
    WHEN 'arbitrum' THEN 15
    WHEN 'optimism' THEN 12
  END,
  CASE bn.network_id 
    WHEN 'ethereum' THEN 180
    WHEN 'bsc' THEN 95
    WHEN 'polygon' THEN 120
    WHEN 'arbitrum' THEN 85
    WHEN 'optimism' THEN 75
  END,
  true,
  NOW()
FROM "blockchain_networks" bn WHERE bn.is_active = true;
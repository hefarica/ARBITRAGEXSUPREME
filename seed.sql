-- =============================================================================
-- ARBITRAGEX PRO 2025 - DATOS INICIALES DE DESARROLLO (CORREGIDO)
-- =============================================================================

-- Crear plan de suscripción básico
INSERT INTO subscription_plans (id, name, description, price_monthly, features, limits, is_active) VALUES
(
  'ba7c3f4e-1d2e-4b5a-8c9d-1e2f3a4b5c6d',
  'Pro Plan',
  'Plan profesional con todas las funcionalidades básicas',
  99.00,
  '{"api_access": true, "real_time_monitoring": true, "advanced_strategies": true, "multi_blockchain": true}',
  '{"max_configs": 10, "max_api_calls": 10000, "max_opportunities": 100}',
  true
);

-- Crear tenant de desarrollo
INSERT INTO tenants (id, name, slug, domain, branding, settings, status, created_at, updated_at) VALUES
(
  '12345678-1234-1234-1234-123456789abc',
  'ArbitrageX Development',
  'arbitragex-dev',
  'dev.arbitragex.local',
  '{"primary_color": "#0066cc", "logo_url": "/assets/logo.png", "theme": "dark"}',
  '{"timezone": "UTC", "currency": "USD", "notifications": true}',
  'ACTIVE',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- Crear suscripción para el tenant
INSERT INTO subscriptions (id, tenant_id, plan_id, status, current_period_start, current_period_end, created_at, updated_at) VALUES
(
  '87654321-4321-4321-4321-cba987654321',
  '12345678-1234-1234-1234-123456789abc',
  'ba7c3f4e-1d2e-4b5a-8c9d-1e2f3a4b5c6d',
  'ACTIVE',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP + INTERVAL '30 days',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- Actualizar tenant con subscription_id
UPDATE tenants SET 
  subscription_id = '87654321-4321-4321-4321-cba987654321',
  updated_at = CURRENT_TIMESTAMP
WHERE id = '12345678-1234-1234-1234-123456789abc';

-- Crear usuario administrador de desarrollo
INSERT INTO users (id, tenant_id, email, password_hash, first_name, last_name, role, status, created_at, updated_at) VALUES
(
  'abcdef12-3456-7890-abcd-ef1234567890',
  '12345678-1234-1234-1234-123456789abc',
  'admin@arbitragex.dev',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LzCkVhNa3/aGjzE9G', -- password: admin123
  'Administrator',
  'Development',
  'ADMIN',
  'ACTIVE',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- Crear API key de desarrollo
INSERT INTO api_keys (id, tenant_id, user_id, name, key_hash, permissions, is_active) VALUES
(
  'a1b2c3d4-5678-90ab-cdef-123456789012',
  '12345678-1234-1234-1234-123456789abc',
  'abcdef12-3456-7890-abcd-ef1234567890',
  'Development API Key',
  '$2b$12$devApiKeyHashForArbitrageXPro2025Development',
  '{"read": true, "write": true, "execute": true, "admin": true}',
  true
);

-- Crear configuración de arbitraje de ejemplo
INSERT INTO arbitrage_configs (id, tenant_id, name, description, strategies, blockchains, risk_settings, slippage_tolerance, min_profit_threshold, max_position_size, is_active, created_at, updated_at) VALUES
(
  'f1e2d3c4-b5a6-9708-1234-567890abcdef',
  '12345678-1234-1234-1234-123456789abc',
  'Multi-Chain DEX Arbitrage',
  'Configuración para arbitraje entre múltiples DEXs y blockchains',
  '["uniswap_sushiswap", "pancakeswap_quickswap", "jupiter_raydium"]',
  '["ethereum", "bsc", "polygon", "solana"]',
  '{"max_slippage": 0.5, "stop_loss": 5.0, "take_profit": 2.0}',
  0.005,
  0.02,
  1000.00000000,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- Crear oportunidades de arbitraje de ejemplo
INSERT INTO arbitrage_opportunities (id, config_id, strategy_name, blockchain_from, blockchain_to, token_symbol, profit_percentage, profit_usd, confidence_score, status, expires_at) VALUES
(
  '11111111-2222-3333-4444-555555555555',
  'f1e2d3c4-b5a6-9708-1234-567890abcdef',
  'uniswap_sushiswap',
  'ethereum',
  'ethereum',
  'USDC',
  2.50,
  125.75000000,
  0.92,
  'READY',
  CURRENT_TIMESTAMP + INTERVAL '10 minutes'
),
(
  '22222222-3333-4444-5555-666666666666',
  'f1e2d3c4-b5a6-9708-1234-567890abcdef',
  'pancakeswap_quickswap',
  'bsc',
  'polygon',
  'WETH',
  1.85,
  89.32000000,
  0.87,
  'DETECTED',
  CURRENT_TIMESTAMP + INTERVAL '15 minutes'
),
(
  '33333333-4444-5555-6666-777777777777',
  'f1e2d3c4-b5a6-9708-1234-567890abcdef',
  'jupiter_raydium',
  'solana',
  'solana',
  'SOL',
  3.12,
  156.89000000,
  0.94,
  'ANALYZING',
  CURRENT_TIMESTAMP + INTERVAL '8 minutes'
);

-- Mostrar resumen de datos creados
SELECT 'TENANTS' as table_name, count(*) as records FROM tenants
UNION ALL
SELECT 'USERS', count(*) FROM users
UNION ALL
SELECT 'SUBSCRIPTION_PLANS', count(*) FROM subscription_plans
UNION ALL
SELECT 'SUBSCRIPTIONS', count(*) FROM subscriptions
UNION ALL
SELECT 'API_KEYS', count(*) FROM api_keys
UNION ALL
SELECT 'ARBITRAGE_CONFIGS', count(*) FROM arbitrage_configs
UNION ALL
SELECT 'ARBITRAGE_OPPORTUNITIES', count(*) FROM arbitrage_opportunities;
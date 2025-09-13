-- ================================
-- ArbitrageX Supreme V3.0 - Database Schema
-- Esquema inicial para PostgreSQL
-- ================================

-- Crear extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ================================
-- Tabla: Blockchains Soportadas
-- ================================
CREATE TABLE IF NOT EXISTS blockchains (
    chain_id BIGINT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    rpc_url TEXT NOT NULL,
    explorer_url TEXT,
    native_token_symbol VARCHAR(10) NOT NULL,
    block_time_seconds INTEGER NOT NULL DEFAULT 12,
    gas_price_gwei DECIMAL(20,9),
    is_active BOOLEAN NOT NULL DEFAULT true,
    supports_flash_loans BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para blockchains
CREATE INDEX IF NOT EXISTS idx_blockchains_active ON blockchains(is_active);
CREATE INDEX IF NOT EXISTS idx_blockchains_flash_loans ON blockchains(supports_flash_loans);

-- ================================
-- Tabla: Tokens
-- ================================
CREATE TABLE IF NOT EXISTS tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chain_id BIGINT NOT NULL REFERENCES blockchains(chain_id),
    address VARCHAR(42) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    name VARCHAR(200),
    decimals INTEGER NOT NULL,
    total_supply DECIMAL(40,0),
    
    -- Métricas de seguridad
    creation_block BIGINT,
    creation_timestamp TIMESTAMP,
    liquidity_usd DECIMAL(20,2) DEFAULT 0,
    volume_24h_usd DECIMAL(20,2) DEFAULT 0,
    market_cap_usd DECIMAL(20,2) DEFAULT 0,
    
    -- Clasificación anti-rugpull
    risk_tier INTEGER NOT NULL DEFAULT 3, -- 1=Low, 2=Medium, 3=High, 4=Critical
    is_verified BOOLEAN NOT NULL DEFAULT false,
    is_blacklisted BOOLEAN NOT NULL DEFAULT false,
    rugpull_score DECIMAL(5,2) DEFAULT 0.0, -- 0.0-100.0
    
    -- Metadatos
    logo_url TEXT,
    website_url TEXT,
    coingecko_id VARCHAR(100),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(chain_id, address)
);

-- Índices para tokens
CREATE INDEX IF NOT EXISTS idx_tokens_chain_address ON tokens(chain_id, address);
CREATE INDEX IF NOT EXISTS idx_tokens_symbol ON tokens(symbol);
CREATE INDEX IF NOT EXISTS idx_tokens_risk_tier ON tokens(risk_tier);
CREATE INDEX IF NOT EXISTS idx_tokens_blacklisted ON tokens(is_blacklisted);
CREATE INDEX IF NOT EXISTS idx_tokens_liquidity ON tokens(liquidity_usd);
CREATE INDEX IF NOT EXISTS idx_tokens_coingecko ON tokens(coingecko_id);

-- ================================
-- Tabla: Exchanges/DEXs
-- ================================
CREATE TABLE IF NOT EXISTS exchanges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chain_id BIGINT NOT NULL REFERENCES blockchains(chain_id),
    name VARCHAR(50) NOT NULL,
    protocol_type VARCHAR(20) NOT NULL, -- 'uniswap_v2', 'uniswap_v3', 'curve', etc.
    factory_address VARCHAR(42),
    router_address VARCHAR(42),
    fee_bps INTEGER DEFAULT 30, -- Base points (30 = 0.3%)
    
    -- Configuración
    is_active BOOLEAN NOT NULL DEFAULT true,
    supports_flash_swaps BOOLEAN NOT NULL DEFAULT false,
    min_liquidity_usd DECIMAL(20,2) DEFAULT 1000,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(chain_id, name)
);

-- Índices para exchanges
CREATE INDEX IF NOT EXISTS idx_exchanges_chain ON exchanges(chain_id);
CREATE INDEX IF NOT EXISTS idx_exchanges_active ON exchanges(is_active);
CREATE INDEX IF NOT EXISTS idx_exchanges_flash_swaps ON exchanges(supports_flash_swaps);

-- ================================
-- Tabla: Trading Pairs
-- ================================
CREATE TABLE IF NOT EXISTS trading_pairs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exchange_id UUID NOT NULL REFERENCES exchanges(id),
    token_a_id UUID NOT NULL REFERENCES tokens(id),
    token_b_id UUID NOT NULL REFERENCES tokens(id),
    pair_address VARCHAR(42),
    
    -- Métricas de liquidez
    reserve_a DECIMAL(40,0) DEFAULT 0,
    reserve_b DECIMAL(40,0) DEFAULT 0,
    total_liquidity_usd DECIMAL(20,2) DEFAULT 0,
    volume_24h_usd DECIMAL(20,2) DEFAULT 0,
    
    -- Estado del par
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_price DECIMAL(30,18),
    last_update TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(exchange_id, token_a_id, token_b_id)
);

-- Índices para trading pairs
CREATE INDEX IF NOT EXISTS idx_trading_pairs_exchange ON trading_pairs(exchange_id);
CREATE INDEX IF NOT EXISTS idx_trading_pairs_tokens ON trading_pairs(token_a_id, token_b_id);
CREATE INDEX IF NOT EXISTS idx_trading_pairs_active ON trading_pairs(is_active);
CREATE INDEX IF NOT EXISTS idx_trading_pairs_liquidity ON trading_pairs(total_liquidity_usd);
CREATE INDEX IF NOT EXISTS idx_trading_pairs_last_update ON trading_pairs(last_update);

-- ================================
-- Tabla: Flash Loan Providers
-- ================================
CREATE TABLE IF NOT EXISTS flash_loan_providers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chain_id BIGINT NOT NULL REFERENCES blockchains(chain_id),
    name VARCHAR(50) NOT NULL,
    protocol_type VARCHAR(20) NOT NULL, -- 'aave_v3', 'uniswap_v3', 'balancer_v2', 'dydx'
    contract_address VARCHAR(42) NOT NULL,
    
    -- Configuración
    fee_rate DECIMAL(8,6) NOT NULL, -- Fee rate (0.0009 = 0.09%)
    max_amount_eth DECIMAL(20,2) DEFAULT 1000000,
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(chain_id, name)
);

-- Índices para flash loan providers
CREATE INDEX IF NOT EXISTS idx_flash_loan_providers_chain ON flash_loan_providers(chain_id);
CREATE INDEX IF NOT EXISTS idx_flash_loan_providers_active ON flash_loan_providers(is_active);

-- ================================
-- Tabla: Arbitrage Opportunities
-- ================================
CREATE TABLE IF NOT EXISTS arbitrage_opportunities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    strategy_type VARCHAR(30) NOT NULL, -- Tipo de estrategia de arbitraje
    
    -- Tokens involucrados
    token_a_id UUID NOT NULL REFERENCES tokens(id),
    token_b_id UUID,
    token_c_id UUID, -- Para triangular arbitrage
    
    -- Exchanges involucrados
    source_exchange_id UUID NOT NULL REFERENCES exchanges(id),
    target_exchange_id UUID REFERENCES exchanges(id),
    
    -- Métricas financieras
    profit_usd DECIMAL(20,2) NOT NULL,
    profit_percentage DECIMAL(8,4) NOT NULL,
    required_capital_usd DECIMAL(20,2) NOT NULL,
    gas_cost_usd DECIMAL(10,2) DEFAULT 0,
    net_profit_usd DECIMAL(20,2) NOT NULL,
    
    -- Precio y cantidades
    amount_in DECIMAL(40,0) NOT NULL,
    amount_out DECIMAL(40,0) NOT NULL,
    price_impact_bps INTEGER DEFAULT 0,
    slippage_bps INTEGER DEFAULT 0,
    
    -- Estado y timing
    status VARCHAR(20) DEFAULT 'detected', -- 'detected', 'executed', 'failed', 'expired'
    confidence_score DECIMAL(5,2) DEFAULT 0.0, -- 0.0-100.0
    execution_deadline TIMESTAMP,
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    executed_at TIMESTAMP,
    
    -- Metadatos de ejecución
    transaction_hash VARCHAR(66),
    block_number BIGINT,
    gas_used INTEGER,
    execution_latency_ms INTEGER,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para arbitrage opportunities
CREATE INDEX IF NOT EXISTS idx_arbitrage_opportunities_strategy ON arbitrage_opportunities(strategy_type);
CREATE INDEX IF NOT EXISTS idx_arbitrage_opportunities_status ON arbitrage_opportunities(status);
CREATE INDEX IF NOT EXISTS idx_arbitrage_opportunities_profit ON arbitrage_opportunities(profit_usd DESC);
CREATE INDEX IF NOT EXISTS idx_arbitrage_opportunities_detected ON arbitrage_opportunities(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_arbitrage_opportunities_deadline ON arbitrage_opportunities(execution_deadline);
CREATE INDEX IF NOT EXISTS idx_arbitrage_opportunities_tokens ON arbitrage_opportunities(token_a_id, token_b_id);

-- ================================
-- Tabla: Price History (Para análisis estadístico)
-- ================================
CREATE TABLE IF NOT EXISTS price_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trading_pair_id UUID NOT NULL REFERENCES trading_pairs(id),
    price DECIMAL(30,18) NOT NULL,
    volume_usd DECIMAL(20,2) DEFAULT 0,
    liquidity_usd DECIMAL(20,2) DEFAULT 0,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Para particionamiento por tiempo
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para price history
CREATE INDEX IF NOT EXISTS idx_price_history_pair_time ON price_history(trading_pair_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_price_history_timestamp ON price_history(timestamp DESC);

-- ================================
-- Tabla: System Metrics
-- ================================
CREATE TABLE IF NOT EXISTS system_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_type VARCHAR(50) NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(20,6) NOT NULL,
    labels JSONB DEFAULT '{}',
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para system metrics
CREATE INDEX IF NOT EXISTS idx_system_metrics_type ON system_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_system_metrics_name ON system_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_system_metrics_timestamp ON system_metrics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_system_metrics_labels ON system_metrics USING GIN(labels);

-- ================================
-- Funciones y Triggers
-- ================================

-- Función para actualizar timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER tr_blockchains_updated_at
    BEFORE UPDATE ON blockchains
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_tokens_updated_at
    BEFORE UPDATE ON tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_exchanges_updated_at
    BEFORE UPDATE ON exchanges
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_trading_pairs_updated_at
    BEFORE UPDATE ON trading_pairs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ================================
-- Insertar datos iniciales
-- ================================

-- Blockchains principales
INSERT INTO blockchains (chain_id, name, display_name, rpc_url, native_token_symbol, block_time_seconds, supports_flash_loans) VALUES
(1, 'ethereum', 'Ethereum', 'https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY', 'ETH', 12, true),
(42161, 'arbitrum', 'Arbitrum One', 'https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY', 'ETH', 1, true),
(137, 'polygon', 'Polygon', 'https://polygon-mainnet.g.alchemy.com/v2/YOUR_KEY', 'MATIC', 2, true),
(10, 'optimism', 'Optimism', 'https://opt-mainnet.g.alchemy.com/v2/YOUR_KEY', 'ETH', 2, true),
(56, 'bsc', 'BNB Smart Chain', 'https://bsc-dataseed1.binance.org/', 'BNB', 3, false),
(43114, 'avalanche', 'Avalanche C-Chain', 'https://api.avax.network/ext/bc/C/rpc', 'AVAX', 2, true),
(250, 'fantom', 'Fantom Opera', 'https://rpc.ftm.tools/', 'FTM', 1, false),
(8453, 'base', 'Base', 'https://base-mainnet.g.alchemy.com/v2/YOUR_KEY', 'ETH', 2, true)
ON CONFLICT (chain_id) DO NOTHING;

-- Comentarios en tablas
COMMENT ON TABLE blockchains IS 'Redes blockchain soportadas con configuración Real-Only';
COMMENT ON TABLE tokens IS 'Tokens con clasificación anti-rugpull y métricas de seguridad';
COMMENT ON TABLE exchanges IS 'DEXs y exchanges con soporte para arbitraje';
COMMENT ON TABLE trading_pairs IS 'Pares de trading con métricas de liquidez en tiempo real';
COMMENT ON TABLE flash_loan_providers IS 'Proveedores de flash loans para capital sin riesgo';
COMMENT ON TABLE arbitrage_opportunities IS 'Oportunidades de arbitraje detectadas y ejecutadas';
COMMENT ON TABLE price_history IS 'Historia de precios para análisis estadístico';
COMMENT ON TABLE system_metrics IS 'Métricas del sistema para monitoreo de performance';
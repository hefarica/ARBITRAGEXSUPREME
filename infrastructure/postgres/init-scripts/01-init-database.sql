-- ArbitrageX Supreme V3.0 - PostgreSQL Database Initialization
-- Esquema completo para almacenar datos de arbitraje, estrategias y métricas

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "timescaledb" CASCADE;

-- Create schemas
CREATE SCHEMA IF NOT EXISTS arbitrage;
CREATE SCHEMA IF NOT EXISTS monitoring;
CREATE SCHEMA IF NOT EXISTS analytics;

-- Set search path
SET search_path TO arbitrage, public;

-- ================================
-- CORE TABLES
-- ================================

-- Blockchains table
CREATE TABLE IF NOT EXISTS blockchains (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    chain_id BIGINT,
    type VARCHAR(20) NOT NULL CHECK (type IN ('evm', 'non-evm')),
    rpc_url VARCHAR(255) NOT NULL,
    native_currency VARCHAR(10) NOT NULL,
    block_time_ms INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tokens table
CREATE TABLE IF NOT EXISTS tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    symbol VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    contract_address VARCHAR(100),
    blockchain_id INTEGER REFERENCES blockchains(id),
    decimals INTEGER NOT NULL DEFAULT 18,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(contract_address, blockchain_id)
);

-- DEX Exchanges table
CREATE TABLE IF NOT EXISTS exchanges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    protocol_type VARCHAR(50) NOT NULL, -- uniswap-v2, uniswap-v3, curve, etc.
    blockchain_id INTEGER REFERENCES blockchains(id),
    router_address VARCHAR(100),
    factory_address VARCHAR(100),
    fee_bps INTEGER NOT NULL DEFAULT 300, -- basis points
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trading pairs table
CREATE TABLE IF NOT EXISTS trading_pairs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token_a_id UUID REFERENCES tokens(id),
    token_b_id UUID REFERENCES tokens(id),
    blockchain_id INTEGER REFERENCES blockchains(id),
    is_active BOOLEAN DEFAULT true,
    min_amount_in DECIMAL(36, 18) DEFAULT 0,
    max_amount_in DECIMAL(36, 18),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(token_a_id, token_b_id, blockchain_id)
);

-- ================================
-- ARBITRAGE TABLES
-- ================================

-- Arbitrage opportunities table
CREATE TABLE IF NOT EXISTS arbitrage_opportunities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    blockchain_from INTEGER REFERENCES blockchains(id),
    blockchain_to INTEGER REFERENCES blockchains(id),
    token_a_id UUID REFERENCES tokens(id),
    token_b_id UUID REFERENCES tokens(id),
    token_c_id UUID REFERENCES tokens(id), -- for triangular arbitrage
    strategy_type VARCHAR(50) NOT NULL,
    amount_in DECIMAL(36, 18) NOT NULL,
    expected_amount_out DECIMAL(36, 18) NOT NULL,
    expected_profit DECIMAL(36, 18) NOT NULL,
    risk_adjusted_profit DECIMAL(36, 18),
    confidence_score DECIMAL(5, 4) NOT NULL, -- 0-1 scale
    gas_estimate BIGINT,
    deadline TIMESTAMP WITH TIME ZONE NOT NULL,
    exchange_a_id UUID REFERENCES exchanges(id),
    exchange_b_id UUID REFERENCES exchanges(id),
    route_data JSONB,
    is_cross_chain BOOLEAN DEFAULT false,
    status VARCHAR(20) DEFAULT 'detected' CHECK (status IN ('detected', 'analyzing', 'executing', 'completed', 'failed', 'expired')),
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    analyzed_at TIMESTAMP WITH TIME ZONE,
    executed_at TIMESTAMP WITH TIME ZONE
);

-- Arbitrage executions table
CREATE TABLE IF NOT EXISTS arbitrage_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    opportunity_id UUID REFERENCES arbitrage_opportunities(id),
    transaction_hash VARCHAR(100),
    blockchain_id INTEGER REFERENCES blockchains(id),
    strategy_type VARCHAR(50) NOT NULL,
    amount_in DECIMAL(36, 18) NOT NULL,
    amount_out DECIMAL(36, 18),
    actual_profit DECIMAL(36, 18),
    gas_used BIGINT,
    gas_price BIGINT,
    execution_time_ms INTEGER,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    block_number BIGINT,
    simulation_mode BOOLEAN DEFAULT false,
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    confirmed_at TIMESTAMP WITH TIME ZONE
);

-- Strategy performance table
CREATE TABLE IF NOT EXISTS strategy_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    strategy_type VARCHAR(50) NOT NULL,
    blockchain_id INTEGER REFERENCES blockchains(id),
    total_executions INTEGER DEFAULT 0,
    successful_executions INTEGER DEFAULT 0,
    total_profit DECIMAL(36, 18) DEFAULT 0,
    total_gas_used BIGINT DEFAULT 0,
    average_execution_time_ms DECIMAL(10, 2) DEFAULT 0,
    success_rate DECIMAL(5, 4) DEFAULT 0,
    last_execution TIMESTAMP WITH TIME ZONE,
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(strategy_type, blockchain_id, period_start)
);

-- ================================
-- MONITORING TABLES
-- ================================

-- Engine statistics table
CREATE TABLE IF NOT EXISTS monitoring.engine_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    total_cycles BIGINT DEFAULT 0,
    total_opportunities_found BIGINT DEFAULT 0,
    total_executions BIGINT DEFAULT 0,
    successful_executions BIGINT DEFAULT 0,
    failed_executions BIGINT DEFAULT 0,
    total_profit DECIMAL(36, 18) DEFAULT 0,
    total_gas_used BIGINT DEFAULT 0,
    average_cycle_duration_ms DECIMAL(10, 2) DEFAULT 0,
    success_rate DECIMAL(5, 4) DEFAULT 0,
    uptime_seconds BIGINT DEFAULT 0,
    snapshot_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Blockchain health monitoring
CREATE TABLE IF NOT EXISTS monitoring.blockchain_health (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    blockchain_id INTEGER REFERENCES blockchains(id),
    is_healthy BOOLEAN NOT NULL,
    latency_ms INTEGER,
    block_height BIGINT,
    sync_status VARCHAR(20),
    error_message TEXT,
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- System metrics table
CREATE TABLE IF NOT EXISTS monitoring.system_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(20, 8) NOT NULL,
    metric_labels JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================
-- ANALYTICS TABLES
-- ================================

-- Price data for analytics
CREATE TABLE IF NOT EXISTS analytics.price_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token_id UUID REFERENCES tokens(id),
    exchange_id UUID REFERENCES exchanges(id),
    price DECIMAL(36, 18) NOT NULL,
    volume_24h DECIMAL(36, 18),
    liquidity DECIMAL(36, 18),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Profit analytics table
CREATE TABLE IF NOT EXISTS analytics.profit_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    strategy_type VARCHAR(50) NOT NULL,
    blockchain_id INTEGER REFERENCES blockchains(id),
    token_pair_id UUID REFERENCES trading_pairs(id),
    profit DECIMAL(36, 18) NOT NULL,
    profit_percentage DECIMAL(10, 6) NOT NULL,
    execution_time_ms INTEGER,
    gas_cost DECIMAL(36, 18),
    net_profit DECIMAL(36, 18),
    executed_at TIMESTAMP WITH TIME ZONE NOT NULL,
    date_bucket DATE GENERATED ALWAYS AS (DATE(executed_at)) STORED
);

-- ================================
-- INDEXES
-- ================================

-- Performance indexes for arbitrage_opportunities
CREATE INDEX IF NOT EXISTS idx_arbitrage_opportunities_status ON arbitrage_opportunities(status);
CREATE INDEX IF NOT EXISTS idx_arbitrage_opportunities_detected_at ON arbitrage_opportunities(detected_at);
CREATE INDEX IF NOT EXISTS idx_arbitrage_opportunities_blockchain_from ON arbitrage_opportunities(blockchain_from);
CREATE INDEX IF NOT EXISTS idx_arbitrage_opportunities_strategy_type ON arbitrage_opportunities(strategy_type);
CREATE INDEX IF NOT EXISTS idx_arbitrage_opportunities_expected_profit ON arbitrage_opportunities(expected_profit DESC);

-- Performance indexes for arbitrage_executions
CREATE INDEX IF NOT EXISTS idx_arbitrage_executions_executed_at ON arbitrage_executions(executed_at);
CREATE INDEX IF NOT EXISTS idx_arbitrage_executions_blockchain_id ON arbitrage_executions(blockchain_id);
CREATE INDEX IF NOT EXISTS idx_arbitrage_executions_success ON arbitrage_executions(success);
CREATE INDEX IF NOT EXISTS idx_arbitrage_executions_strategy_type ON arbitrage_executions(strategy_type);

-- Monitoring indexes
CREATE INDEX IF NOT EXISTS idx_engine_stats_snapshot_at ON monitoring.engine_stats(snapshot_at DESC);
CREATE INDEX IF NOT EXISTS idx_blockchain_health_checked_at ON monitoring.blockchain_health(checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_blockchain_health_blockchain_id ON monitoring.blockchain_health(blockchain_id);

-- Analytics indexes
CREATE INDEX IF NOT EXISTS idx_price_data_timestamp ON analytics.price_data(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_price_data_token_exchange ON analytics.price_data(token_id, exchange_id);
CREATE INDEX IF NOT EXISTS idx_profit_analytics_date_bucket ON analytics.profit_analytics(date_bucket);
CREATE INDEX IF NOT EXISTS idx_profit_analytics_strategy ON analytics.profit_analytics(strategy_type);

-- ================================
-- HYPERTABLES (TimescaleDB)
-- ================================

-- Convert monitoring tables to hypertables for time-series data
SELECT create_hypertable('monitoring.engine_stats', 'snapshot_at', if_not_exists => TRUE);
SELECT create_hypertable('monitoring.blockchain_health', 'checked_at', if_not_exists => TRUE);
SELECT create_hypertable('monitoring.system_metrics', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('analytics.price_data', 'timestamp', if_not_exists => TRUE);
SELECT create_hypertable('analytics.profit_analytics', 'executed_at', if_not_exists => TRUE);

-- ================================
-- TRIGGERS AND FUNCTIONS
-- ================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_blockchains_updated_at BEFORE UPDATE ON blockchains
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tokens_updated_at BEFORE UPDATE ON tokens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_exchanges_updated_at BEFORE UPDATE ON exchanges
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trading_pairs_updated_at BEFORE UPDATE ON trading_pairs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================
-- INITIAL DATA
-- ================================

-- Insert supported blockchains
INSERT INTO blockchains (name, chain_id, type, rpc_url, native_currency, block_time_ms) VALUES
('ethereum', 1, 'evm', 'https://eth-mainnet.alchemyapi.io/v2/api-key', 'ETH', 12000),
('polygon', 137, 'evm', 'https://polygon-rpc.com', 'MATIC', 2000),
('bsc', 56, 'evm', 'https://bsc-dataseed.binance.org', 'BNB', 3000),
('arbitrum', 42161, 'evm', 'https://arb1.arbitrum.io/rpc', 'ETH', 1000),
('optimism', 10, 'evm', 'https://mainnet.optimism.io', 'ETH', 2000),
('avalanche', 43114, 'evm', 'https://api.avax.network/ext/bc/C/rpc', 'AVAX', 2000),
('fantom', 250, 'evm', 'https://rpc.ftm.tools', 'FTM', 1000),
('base', 8453, 'evm', 'https://mainnet.base.org', 'ETH', 2000),
('solana', NULL, 'non-evm', 'https://api.mainnet-beta.solana.com', 'SOL', 400),
('near', NULL, 'non-evm', 'https://rpc.mainnet.near.org', 'NEAR', 1000),
('cardano', NULL, 'non-evm', 'https://cardano-mainnet.blockfrost.io/api/v0', 'ADA', 20000),
('cosmos', NULL, 'non-evm', 'https://rpc-cosmoshub.keplr.app', 'ATOM', 6000)
ON CONFLICT (name) DO NOTHING;

-- Create views for analytics
CREATE OR REPLACE VIEW analytics.daily_profits AS
SELECT 
    date_bucket,
    strategy_type,
    b.name as blockchain_name,
    COUNT(*) as total_executions,
    SUM(profit) as total_profit,
    AVG(profit) as avg_profit,
    SUM(net_profit) as total_net_profit,
    AVG(execution_time_ms) as avg_execution_time_ms
FROM analytics.profit_analytics pa
JOIN blockchains b ON pa.blockchain_id = b.id
GROUP BY date_bucket, strategy_type, b.name
ORDER BY date_bucket DESC;

CREATE OR REPLACE VIEW analytics.strategy_performance_summary AS
SELECT 
    sp.strategy_type,
    b.name as blockchain_name,
    sp.total_executions,
    sp.successful_executions,
    sp.success_rate,
    sp.total_profit,
    sp.average_execution_time_ms,
    sp.last_execution
FROM strategy_performance sp
JOIN blockchains b ON sp.blockchain_id = b.id
WHERE sp.period_end = (
    SELECT MAX(period_end) 
    FROM strategy_performance sp2 
    WHERE sp2.strategy_type = sp.strategy_type 
    AND sp2.blockchain_id = sp.blockchain_id
)
ORDER BY sp.total_profit DESC;

-- Grant permissions
GRANT USAGE ON SCHEMA arbitrage TO arbitragex;
GRANT USAGE ON SCHEMA monitoring TO arbitragex;
GRANT USAGE ON SCHEMA analytics TO arbitragex;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA arbitrage TO arbitragex;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA monitoring TO arbitragex;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA analytics TO arbitragex;

GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA arbitrage TO arbitragex;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA monitoring TO arbitragex;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA analytics TO arbitragex;
-- ArbitrageX Supreme V3.0 - Database Initialization
-- Real-Only Policy - Production database schema for trading system

-- Create additional databases if needed
CREATE DATABASE arbitragex_metrics;
CREATE DATABASE grafana;

-- Create additional users
CREATE USER recon_user WITH PASSWORD 'recon_secure_password';
CREATE USER cron_user WITH PASSWORD 'cron_secure_password';
CREATE USER grafana_user WITH PASSWORD 'grafana_password';

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE arbitragex_recon TO recon_user;
GRANT ALL PRIVILEGES ON DATABASE arbitragex_recon TO cron_user;
GRANT ALL PRIVILEGES ON DATABASE arbitragex_metrics TO cron_user;
GRANT ALL PRIVILEGES ON DATABASE grafana TO grafana_user;

-- Connect to main database for table creation
\c arbitragex_recon;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- ================================
-- CORE SYSTEM TABLES
-- ================================

-- Chains configuration table
CREATE TABLE IF NOT EXISTS chains (
    chain_id VARCHAR(20) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    rpc_urls JSONB NOT NULL,
    ws_urls JSONB,
    explorer_url VARCHAR(255) NOT NULL,
    native_token JSONB NOT NULL,
    wrapped_native_token VARCHAR(42) NOT NULL,
    usdc_address VARCHAR(42),
    usdt_address VARCHAR(42),
    weth_address VARCHAR(42),
    major_dexes JSONB NOT NULL DEFAULT '[]',
    block_time_seconds NUMERIC(10,3) NOT NULL,
    finality_blocks INTEGER NOT NULL,
    gas_price_multiplier NUMERIC(5,3) NOT NULL DEFAULT 1.0,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tokens table
CREATE TABLE IF NOT EXISTS tokens (
    id SERIAL PRIMARY KEY,
    address VARCHAR(42) NOT NULL,
    chain_id VARCHAR(20) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    name VARCHAR(255),
    decimals INTEGER NOT NULL DEFAULT 18,
    coingecko_id VARCHAR(100),
    price_usd NUMERIC(30,18),
    price_eth NUMERIC(30,18),
    market_cap_usd NUMERIC(30,2),
    volume_24h NUMERIC(30,2),
    last_price_update TIMESTAMP WITH TIME ZONE,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(address, chain_id)
);

-- Token prices table (historical data)
CREATE TABLE IF NOT EXISTS token_prices (
    id SERIAL PRIMARY KEY,
    token_address VARCHAR(42) NOT NULL,
    chain_id VARCHAR(20) NOT NULL,
    symbol VARCHAR(20) NOT NULL,
    decimals INTEGER NOT NULL,
    price_usd NUMERIC(30,18) NOT NULL,
    price_eth NUMERIC(30,18) NOT NULL DEFAULT 0,
    volume_24h NUMERIC(30,2) DEFAULT 0,
    market_cap NUMERIC(30,2),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    source VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(token_address, chain_id)
);

-- Pool liquidity table
CREATE TABLE IF NOT EXISTS pool_liquidity (
    id SERIAL PRIMARY KEY,
    pool_address VARCHAR(42) NOT NULL,
    dex_name VARCHAR(50) NOT NULL,
    chain_id VARCHAR(20) NOT NULL,
    token0_address VARCHAR(42) NOT NULL,
    token1_address VARCHAR(42) NOT NULL,
    token0_symbol VARCHAR(20) NOT NULL,
    token1_symbol VARCHAR(20) NOT NULL,
    reserve0 NUMERIC(78,0) DEFAULT 0,
    reserve1 NUMERIC(78,0) DEFAULT 0,
    total_liquidity_usd NUMERIC(30,2) DEFAULT 0,
    fee_tier INTEGER NOT NULL DEFAULT 3000,
    volume_24h NUMERIC(30,2) DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(pool_address, chain_id)
);

-- Gas prices table
CREATE TABLE IF NOT EXISTS gas_prices (
    id SERIAL PRIMARY KEY,
    chain_id VARCHAR(20) NOT NULL,
    slow_gwei NUMERIC(20,9) NOT NULL,
    standard_gwei NUMERIC(20,9) NOT NULL,
    fast_gwei NUMERIC(20,9) NOT NULL,
    instant_gwei NUMERIC(20,9) NOT NULL,
    base_fee_gwei NUMERIC(20,9),
    priority_fee_gwei NUMERIC(20,9),
    block_number BIGINT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    source VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================
-- RECONCILIATION SYSTEM TABLES
-- ================================

-- Reconciliations table (from recon component)
CREATE TABLE IF NOT EXISTS reconciliations (
    id SERIAL PRIMARY KEY,
    reconciliation_id UUID NOT NULL UNIQUE,
    strategy VARCHAR(10) NOT NULL,
    chain_id VARCHAR(20) NOT NULL,
    simulation_id UUID NOT NULL,
    execution_id UUID,
    reconciliation_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    reconciliation_status VARCHAR(20) NOT NULL,
    profit_variance_bps INTEGER DEFAULT 0,
    gas_variance_bps INTEGER DEFAULT 0,
    timing_variance_ms INTEGER DEFAULT 0,
    overall_parity_score NUMERIC(5,4) DEFAULT 0.0,
    investigation_triggered BOOLEAN DEFAULT false,
    investigation_id UUID,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Execution events table (canonical format)
CREATE TABLE IF NOT EXISTS execution_events_v1 (
    id SERIAL PRIMARY KEY,
    event_id UUID NOT NULL UNIQUE,
    event_type VARCHAR(50) NOT NULL DEFAULT 'execution_v1',
    version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    strategy VARCHAR(10) NOT NULL,
    chain_id VARCHAR(20) NOT NULL,
    simulation_data JSONB NOT NULL,
    execution_data JSONB,
    reconciliation JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Deviation investigations table
CREATE TABLE IF NOT EXISTS deviation_investigations (
    id SERIAL PRIMARY KEY,
    investigation_id UUID NOT NULL UNIQUE,
    reconciliation_id UUID NOT NULL,
    investigation_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    trigger_reason TEXT NOT NULL,
    investigation_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    findings JSONB DEFAULT '[]',
    root_cause_analysis TEXT,
    recommended_actions JSONB DEFAULT '[]',
    confidence_score NUMERIC(3,2) DEFAULT 0.0,
    investigation_duration_ms INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================
-- CRON AND SCHEDULING TABLES
-- ================================

-- Cron job executions table
CREATE TABLE IF NOT EXISTS cron_job_executions (
    id SERIAL PRIMARY KEY,
    job_name VARCHAR(255) NOT NULL,
    execution_id UUID NOT NULL UNIQUE,
    status VARCHAR(50) NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,
    records_processed INTEGER DEFAULT 0,
    records_updated INTEGER DEFAULT 0,
    records_failed INTEGER DEFAULT 0,
    error_message TEXT,
    error_stack TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================
-- MEV AND TRADING TABLES
-- ================================

-- MEV opportunities table
CREATE TABLE IF NOT EXISTS mev_opportunities (
    id SERIAL PRIMARY KEY,
    opportunity_id UUID NOT NULL UNIQUE,
    strategy_type VARCHAR(50) NOT NULL,
    chain_id VARCHAR(20) NOT NULL,
    block_number BIGINT NOT NULL,
    transaction_hash VARCHAR(66),
    estimated_profit_eth NUMERIC(30,18) NOT NULL,
    estimated_profit_usd NUMERIC(30,2) NOT NULL,
    gas_cost_eth NUMERIC(30,18) NOT NULL,
    net_profit_eth NUMERIC(30,18) NOT NULL,
    tokens_involved JSONB DEFAULT '[]',
    pools_involved JSONB DEFAULT '[]',
    detected_at TIMESTAMP WITH TIME ZONE NOT NULL,
    executed BOOLEAN DEFAULT false,
    execution_result JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Strategy performance table
CREATE TABLE IF NOT EXISTS strategy_performance (
    id SERIAL PRIMARY KEY,
    strategy VARCHAR(10) NOT NULL,
    chain_id VARCHAR(20) NOT NULL,
    time_period VARCHAR(20) NOT NULL, -- '1h', '24h', '7d', '30d'
    total_opportunities INTEGER DEFAULT 0,
    successful_executions INTEGER DEFAULT 0,
    total_profit_eth NUMERIC(30,18) DEFAULT 0,
    total_profit_usd NUMERIC(30,2) DEFAULT 0,
    total_gas_cost_eth NUMERIC(30,18) DEFAULT 0,
    avg_profit_per_execution NUMERIC(30,18) DEFAULT 0,
    success_rate NUMERIC(5,4) DEFAULT 0.0,
    roi_percentage NUMERIC(10,4) DEFAULT 0.0,
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(strategy, chain_id, time_period, period_start)
);

-- ================================
-- CREATE INDEXES FOR PERFORMANCE
-- ================================

-- Chains indexes
CREATE INDEX IF NOT EXISTS idx_chains_enabled ON chains(enabled);

-- Tokens indexes
CREATE INDEX IF NOT EXISTS idx_tokens_active ON tokens(active);
CREATE INDEX IF NOT EXISTS idx_tokens_chain_symbol ON tokens(chain_id, symbol);
CREATE INDEX IF NOT EXISTS idx_tokens_market_cap ON tokens(market_cap_usd DESC NULLS LAST);

-- Token prices indexes
CREATE INDEX IF NOT EXISTS idx_token_prices_chain_address ON token_prices(chain_id, token_address);
CREATE INDEX IF NOT EXISTS idx_token_prices_timestamp ON token_prices(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_token_prices_created_at ON token_prices(created_at DESC);

-- Pool liquidity indexes
CREATE INDEX IF NOT EXISTS idx_pool_liquidity_chain ON pool_liquidity(chain_id);
CREATE INDEX IF NOT EXISTS idx_pool_liquidity_dex ON pool_liquidity(dex_name);
CREATE INDEX IF NOT EXISTS idx_pool_liquidity_tokens ON pool_liquidity(token0_address, token1_address);
CREATE INDEX IF NOT EXISTS idx_pool_liquidity_updated ON pool_liquidity(last_updated DESC);

-- Gas prices indexes
CREATE INDEX IF NOT EXISTS idx_gas_prices_chain_timestamp ON gas_prices(chain_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_gas_prices_timestamp ON gas_prices(timestamp DESC);

-- Reconciliations indexes
CREATE INDEX IF NOT EXISTS idx_reconciliations_strategy_chain ON reconciliations(strategy, chain_id);
CREATE INDEX IF NOT EXISTS idx_reconciliations_timestamp ON reconciliations(reconciliation_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_reconciliations_status ON reconciliations(reconciliation_status);
CREATE INDEX IF NOT EXISTS idx_reconciliations_investigation ON reconciliations(investigation_triggered);

-- Execution events indexes
CREATE INDEX IF NOT EXISTS idx_execution_events_strategy_chain ON execution_events_v1(strategy, chain_id);
CREATE INDEX IF NOT EXISTS idx_execution_events_timestamp ON execution_events_v1(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_execution_events_type ON execution_events_v1(event_type);

-- Deviation investigations indexes
CREATE INDEX IF NOT EXISTS idx_investigations_reconciliation ON deviation_investigations(reconciliation_id);
CREATE INDEX IF NOT EXISTS idx_investigations_timestamp ON deviation_investigations(investigation_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_investigations_status ON deviation_investigations(investigation_status);

-- Cron job executions indexes
CREATE INDEX IF NOT EXISTS idx_cron_executions_job_name ON cron_job_executions(job_name);
CREATE INDEX IF NOT EXISTS idx_cron_executions_started_at ON cron_job_executions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_cron_executions_status ON cron_job_executions(status);

-- MEV opportunities indexes
CREATE INDEX IF NOT EXISTS idx_mev_opportunities_chain_block ON mev_opportunities(chain_id, block_number DESC);
CREATE INDEX IF NOT EXISTS idx_mev_opportunities_strategy ON mev_opportunities(strategy_type);
CREATE INDEX IF NOT EXISTS idx_mev_opportunities_detected ON mev_opportunities(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_mev_opportunities_executed ON mev_opportunities(executed);
CREATE INDEX IF NOT EXISTS idx_mev_opportunities_profit ON mev_opportunities(estimated_profit_eth DESC);

-- Strategy performance indexes
CREATE INDEX IF NOT EXISTS idx_strategy_performance_strategy_chain ON strategy_performance(strategy, chain_id);
CREATE INDEX IF NOT EXISTS idx_strategy_performance_period ON strategy_performance(time_period, period_start DESC);

-- ================================
-- INSERT INITIAL DATA
-- ================================

-- Insert supported chains
INSERT INTO chains (chain_id, name, rpc_urls, ws_urls, explorer_url, native_token, wrapped_native_token, block_time_seconds, finality_blocks, major_dexes) VALUES
('1', 'Ethereum Mainnet', 
 '["http://geth:8545"]'::jsonb, 
 '["ws://geth:8546"]'::jsonb,
 'https://etherscan.io',
 '{"symbol": "ETH", "decimals": 18, "coingecko_id": "ethereum"}'::jsonb,
 '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
 12.0, 32,
 '[{"name": "Uniswap V3", "router_address": "0xE592427A0AEce92De3Edee1F18E0157C05861564", "factory_address": "0x1F98431c8aD98523631AE4a59f267346ea31F984", "fee_tiers": [500, 3000, 10000]}]'::jsonb),

('137', 'Polygon',
 '["https://polygon-rpc.com"]'::jsonb,
 '["wss://polygon-rpc.com"]'::jsonb,
 'https://polygonscan.com',
 '{"symbol": "MATIC", "decimals": 18, "coingecko_id": "matic-network"}'::jsonb,
 '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
 2.0, 128,
 '[{"name": "Uniswap V3", "router_address": "0xE592427A0AEce92De3Edee1F18E0157C05861564", "factory_address": "0x1F98431c8aD98523631AE4a59f267346ea31F984", "fee_tiers": [500, 3000, 10000]}]'::jsonb),

('56', 'BSC',
 '["https://bsc-dataseed.binance.org"]'::jsonb,
 '["wss://bsc-ws-node.nariox.org:443"]'::jsonb,
 'https://bscscan.com',
 '{"symbol": "BNB", "decimals": 18, "coingecko_id": "binancecoin"}'::jsonb,
 '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
 3.0, 15,
 '[{"name": "PancakeSwap V3", "router_address": "0x13f4EA83D0bd40E75C8222255bc855a974568Dd4", "factory_address": "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865", "fee_tiers": [100, 500, 2500, 10000]}]'::jsonb),

('42161', 'Arbitrum One',
 '["https://arb1.arbitrum.io/rpc"]'::jsonb,
 '["wss://arb1.arbitrum.io/ws"]'::jsonb,
 'https://arbiscan.io',
 '{"symbol": "ETH", "decimals": 18, "coingecko_id": "ethereum"}'::jsonb,
 '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
 0.25, 1,
 '[{"name": "Uniswap V3", "router_address": "0xE592427A0AEce92De3Edee1F18E0157C05861564", "factory_address": "0x1F98431c8aD98523631AE4a59f267346ea31F984", "fee_tiers": [500, 3000, 10000]}]'::jsonb),

('10', 'Optimism',
 '["https://mainnet.optimism.io"]'::jsonb,
 '["wss://mainnet.optimism.io/ws"]'::jsonb,
 'https://optimistic.etherscan.io',
 '{"symbol": "ETH", "decimals": 18, "coingecko_id": "ethereum"}'::jsonb,
 '0x4200000000000000000000000000000000000006',
 2.0, 1,
 '[{"name": "Uniswap V3", "router_address": "0xE592427A0AEce92De3Edee1F18E0157C05861564", "factory_address": "0x1F98431c8aD98523631AE4a59f267346ea31F984", "fee_tiers": [500, 3000, 10000]}]'::jsonb)

ON CONFLICT (chain_id) DO UPDATE SET
    rpc_urls = EXCLUDED.rpc_urls,
    ws_urls = EXCLUDED.ws_urls,
    updated_at = NOW();

-- Insert major tokens for each chain
INSERT INTO tokens (address, chain_id, symbol, name, decimals, coingecko_id, active) VALUES
-- Ethereum tokens
('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', '1', 'WETH', 'Wrapped Ether', 18, 'ethereum', true),
('0xA0b86a33E6441c8541d072497c2C33D9147e8f7a', '1', 'USDC', 'USD Coin', 6, 'usd-coin', true),
('0xdAC17F958D2ee523a2206206994597C13D831ec7', '1', 'USDT', 'Tether USD', 6, 'tether', true),
('0x6B175474E89094C44Da98b954EedeAC495271d0F', '1', 'DAI', 'Dai Stablecoin', 18, 'dai', true),

-- Polygon tokens
('0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', '137', 'WMATIC', 'Wrapped Matic', 18, 'matic-network', true),
('0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', '137', 'USDC', 'USD Coin (PoS)', 6, 'usd-coin', true),
('0xc2132D05D31c914a87C6611C10748AEb04B58e8F', '137', 'USDT', 'Tether USD (PoS)', 6, 'tether', true),

-- BSC tokens  
('0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', '56', 'WBNB', 'Wrapped BNB', 18, 'binancecoin', true),
('0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', '56', 'USDC', 'USD Coin', 18, 'usd-coin', true),
('0x55d398326f99059fF775485246999027B3197955', '56', 'USDT', 'Tether USD', 18, 'tether', true),

-- Arbitrum tokens
('0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', '42161', 'WETH', 'Wrapped Ether', 18, 'ethereum', true),
('0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', '42161', 'USDC', 'USD Coin (Arb1)', 6, 'usd-coin', true),
('0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', '42161', 'USDT', 'Tether USD', 6, 'tether', true),

-- Optimism tokens
('0x4200000000000000000000000000000000000006', '10', 'WETH', 'Wrapped Ether', 18, 'ethereum', true),
('0x7F5c764cBc14f9669B88837ca1490cCa17c31607', '10', 'USDC', 'USD Coin', 6, 'usd-coin', true),
('0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', '10', 'USDT', 'Tether USD', 6, 'tether', true)

ON CONFLICT (address, chain_id) DO UPDATE SET
    symbol = EXCLUDED.symbol,
    name = EXCLUDED.name,
    coingecko_id = EXCLUDED.coingecko_id,
    updated_at = NOW();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_chains_updated_at BEFORE UPDATE ON chains FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tokens_updated_at BEFORE UPDATE ON tokens FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_token_prices_updated_at BEFORE UPDATE ON token_prices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pool_liquidity_updated_at BEFORE UPDATE ON pool_liquidity FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reconciliations_updated_at BEFORE UPDATE ON reconciliations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_investigations_updated_at BEFORE UPDATE ON deviation_investigations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
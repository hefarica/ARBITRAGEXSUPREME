-- =====================================================
-- ArbitrageX Supreme V3.0 - PostgreSQL Schema
-- CONTABO Backend Database Infrastructure
-- =====================================================

-- Opportunities table (16M+ records/day)
CREATE TABLE IF NOT EXISTS arbitrage_opportunities (
    opportunity_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chain VARCHAR(50) NOT NULL,
    dex_a VARCHAR(100) NOT NULL,
    dex_b VARCHAR(100) NOT NULL,
    token_pair VARCHAR(50) NOT NULL,
    price_difference DECIMAL(18,8) NOT NULL,
    volume DECIMAL(18,8) NOT NULL,
    estimated_profit DECIMAL(18,8) NOT NULL,
    risk_score DECIMAL(5,2) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    execution_status VARCHAR(20) DEFAULT 'pending',
    expiry_time TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_chain_timestamp (chain, timestamp),
    INDEX idx_execution_status (execution_status),
    INDEX idx_profit_score (estimated_profit DESC, risk_score ASC)
);

-- Strategy configurations (20 MEV strategies)
CREATE TABLE IF NOT EXISTS strategy_configurations (
    strategy_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    type VARCHAR(50) NOT NULL,
    parameters JSONB NOT NULL,
    risk_limits JSONB NOT NULL,
    profit_targets JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    performance_metrics JSONB,
    last_modified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Execution history (50K+ executions/day)
CREATE TABLE IF NOT EXISTS execution_history (
    execution_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    opportunity_id UUID REFERENCES arbitrage_opportunities(opportunity_id),
    strategy_id UUID REFERENCES strategy_configurations(strategy_id),
    transaction_hash VARCHAR(66) UNIQUE,
    block_number BIGINT,
    gas_used BIGINT,
    actual_profit DECIMAL(18,8),
    execution_time INTEGER, -- milliseconds
    status VARCHAR(20) NOT NULL,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_strategy_status (strategy_id, status),
    INDEX idx_transaction_hash (transaction_hash),
    INDEX idx_execution_time (created_at DESC)
);

-- Performance metrics (1M+ metrics/hour)
CREATE TABLE IF NOT EXISTS performance_metrics (
    metric_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metric_type VARCHAR(50) NOT NULL,
    value DECIMAL(18,8) NOT NULL,
    chain VARCHAR(50),
    strategy_id UUID REFERENCES strategy_configurations(strategy_id),
    aggregation_period VARCHAR(10) NOT NULL, -- 1m, 5m, 1h, 1d
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_metric_type_time (metric_type, timestamp DESC),
    INDEX idx_strategy_metrics (strategy_id, timestamp DESC),
    INDEX idx_aggregation_period (aggregation_period, timestamp DESC)
);

-- Blockchain configurations (20+ chains)
CREATE TABLE IF NOT EXISTS blockchain_configurations (
    chain_id INTEGER PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    rpc_url VARCHAR(200) NOT NULL,
    explorer_url VARCHAR(200),
    gas_token VARCHAR(10) NOT NULL,
    decimals INTEGER DEFAULT 18,
    confirmation_blocks INTEGER DEFAULT 12,
    is_active BOOLEAN DEFAULT true,
    last_block_processed BIGINT DEFAULT 0,
    performance_stats JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User management (RBAC complete)
CREATE TABLE IF NOT EXISTS user_management (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    permissions JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP,
    api_key_hash VARCHAR(255) UNIQUE,
    rate_limit_config JSONB DEFAULT '{"requests": 1000, "window": 3600}',
    security_settings JSONB DEFAULT '{"2fa_enabled": false, "login_attempts": 0}',
    is_active BOOLEAN DEFAULT true
);

-- Audit logs (Complete traceability)
CREATE TABLE IF NOT EXISTS audit_logs (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id UUID REFERENCES user_management(user_id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    result_status VARCHAR(20) NOT NULL,
    error_message TEXT,
    INDEX idx_user_action (user_id, action, timestamp DESC),
    INDEX idx_resource_audit (resource_type, resource_id, timestamp DESC),
    INDEX idx_timestamp (timestamp DESC)
);

-- Partitioning for high-volume tables
SELECT create_hypertable('arbitrage_opportunities', 'timestamp', chunk_time_interval => INTERVAL '1 day');
SELECT create_hypertable('execution_history', 'created_at', chunk_time_interval => INTERVAL '1 day');
SELECT create_hypertable('performance_metrics', 'timestamp', chunk_time_interval => INTERVAL '1 hour');
SELECT create_hypertable('audit_logs', 'timestamp', chunk_time_interval => INTERVAL '1 day');

-- Performance optimization indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_opportunities_hot 
ON arbitrage_opportunities (estimated_profit DESC, risk_score ASC) 
WHERE execution_status = 'pending' AND expiry_time > CURRENT_TIMESTAMP;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_executions_performance 
ON execution_history (strategy_id, status, actual_profit DESC, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_metrics_realtime 
ON performance_metrics (metric_type, timestamp DESC) 
WHERE timestamp > CURRENT_TIMESTAMP - INTERVAL '1 hour';

-- Initial data
INSERT INTO blockchain_configurations (chain_id, name, rpc_url, gas_token) VALUES
(1, 'Ethereum Mainnet', 'https://eth-mainnet.alchemyapi.io/v2/YOUR_KEY', 'ETH'),
(42161, 'Arbitrum One', 'https://arb1.arbitrum.io/rpc', 'ETH'),
(137, 'Polygon', 'https://polygon-rpc.com/', 'MATIC'),
(10, 'Optimism', 'https://mainnet.optimism.io', 'ETH'),
(8453, 'Base', 'https://mainnet.base.org', 'ETH'),
(43114, 'Avalanche C-Chain', 'https://api.avax.network/ext/bc/C/rpc', 'AVAX');

-- Initial strategies
INSERT INTO strategy_configurations (name, type, parameters, risk_limits, profit_targets, created_by) VALUES
('DEX_ARBITRAGE', 'arbitrage', '{"min_profit": 0.01, "max_slippage": 0.005}', '{"max_exposure": 1000}', '{"target_roi": 0.15}', 'system'),
('FLASH_LOAN_ARBITRAGE', 'flash_loan', '{"protocols": ["aave", "compound"], "min_profit": 0.02}', '{"gas_limit": 500000}', '{"target_roi": 0.25}', 'system'),
('SANDWICH_MEV', 'mev', '{"detection_threshold": 0.001, "max_frontrun": 2}', '{"max_exposure": 500}', '{"target_roi": 0.30}', 'system');
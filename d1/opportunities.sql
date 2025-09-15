-- ArbitrageX Supreme V3.0 D1 Database Schema
-- Complete edge database schema for ultra-fast queries and caching

-- Opportunities table with comprehensive tracking
CREATE TABLE IF NOT EXISTS opportunities (
    id TEXT PRIMARY KEY,
    opportunity_type TEXT NOT NULL,
    chain TEXT NOT NULL,
    tokens TEXT NOT NULL, -- JSON string with token details
    dexes TEXT NOT NULL, -- JSON string with DEX information
    profit_estimate_usd REAL NOT NULL,
    gas_estimate INTEGER NOT NULL,
    gas_price_gwei INTEGER NOT NULL,
    confidence_score REAL NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
    risk_score REAL NOT NULL CHECK (risk_score >= 0 AND risk_score <= 1),
    transaction_data TEXT, -- JSON string with transaction details
    status TEXT DEFAULT 'detected' CHECK (status IN ('detected', 'simulating', 'executing', 'completed', 'failed', 'expired')),
    expires_at TEXT NOT NULL, -- ISO timestamp
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    backend_synced INTEGER DEFAULT 0, -- Boolean flag for backend sync
    edge_cached_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Executions table for tracking execution results
CREATE TABLE IF NOT EXISTS executions (
    id TEXT PRIMARY KEY,
    opportunity_id TEXT NOT NULL,
    tx_hash TEXT UNIQUE,
    bundle_hash TEXT,
    relay_name TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'confirmed', 'failed', 'reverted')),
    success INTEGER DEFAULT 0, -- Boolean
    profit_actual_usd REAL,
    gas_used INTEGER,
    gas_price_actual_gwei INTEGER,
    execution_time_ms INTEGER,
    error_message TEXT,
    block_number INTEGER,
    transaction_index INTEGER,
    executed_at TEXT DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    backend_synced INTEGER DEFAULT 0,
    FOREIGN KEY (opportunity_id) REFERENCES opportunities(id) ON DELETE CASCADE
);

-- Market data cache for price tracking
CREATE TABLE IF NOT EXISTS market_data (
    id TEXT PRIMARY KEY,
    chain TEXT NOT NULL,
    token_address TEXT NOT NULL,
    token_symbol TEXT NOT NULL,
    price_usd REAL NOT NULL,
    volume_24h_usd REAL,
    market_cap_usd REAL,
    source TEXT NOT NULL,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT NOT NULL,
    UNIQUE(chain, token_address, source)
);

-- DEX pools cache for liquidity tracking
CREATE TABLE IF NOT EXISTS dex_pools (
    id TEXT PRIMARY KEY,
    chain TEXT NOT NULL,
    dex_name TEXT NOT NULL,
    pool_address TEXT NOT NULL,
    token0_address TEXT NOT NULL,
    token0_symbol TEXT NOT NULL,
    token1_address TEXT NOT NULL,
    token1_symbol TEXT NOT NULL,
    fee_bps INTEGER NOT NULL,
    tvl_usd REAL,
    volume_24h_usd REAL,
    reserve0 TEXT, -- String to handle large numbers
    reserve1 TEXT, -- String to handle large numbers
    is_active INTEGER DEFAULT 1, -- Boolean
    last_updated TEXT DEFAULT CURRENT_TIMESTAMP,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(chain, dex_name, pool_address)
);

-- System metrics for monitoring
CREATE TABLE IF NOT EXISTS system_metrics (
    id TEXT PRIMARY KEY,
    metric_name TEXT NOT NULL,
    metric_value REAL NOT NULL,
    metric_unit TEXT,
    chain TEXT,
    time_period TEXT NOT NULL, -- '1m', '5m', '1h', '1d'
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT NOT NULL
);

-- User sessions for authentication
CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,
    session_token TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    last_activity TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Request logs for analytics
CREATE TABLE IF NOT EXISTS request_logs (
    id TEXT PRIMARY KEY,
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    response_time_ms INTEGER,
    user_agent TEXT,
    ip_address TEXT,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT NOT NULL
);

-- Performance indexes for opportunities
CREATE INDEX IF NOT EXISTS idx_opportunities_chain_status ON opportunities(chain, status);
CREATE INDEX IF NOT EXISTS idx_opportunities_profit_desc ON opportunities(profit_estimate_usd DESC);
CREATE INDEX IF NOT EXISTS idx_opportunities_created_at_desc ON opportunities(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_opportunities_expires_at ON opportunities(expires_at);
CREATE INDEX IF NOT EXISTS idx_opportunities_type ON opportunities(opportunity_type);
CREATE INDEX IF NOT EXISTS idx_opportunities_confidence ON opportunities(confidence_score DESC);
CREATE INDEX IF NOT EXISTS idx_opportunities_backend_sync ON opportunities(backend_synced);

-- Performance indexes for executions
CREATE INDEX IF NOT EXISTS idx_executions_opportunity_id ON executions(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_executions_tx_hash ON executions(tx_hash);
CREATE INDEX IF NOT EXISTS idx_executions_status ON executions(status);
CREATE INDEX IF NOT EXISTS idx_executions_executed_at_desc ON executions(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_executions_success ON executions(success);
CREATE INDEX IF NOT EXISTS idx_executions_backend_sync ON executions(backend_synced);

-- Performance indexes for market data
CREATE INDEX IF NOT EXISTS idx_market_data_chain_token ON market_data(chain, token_address);
CREATE INDEX IF NOT EXISTS idx_market_data_timestamp_desc ON market_data(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_market_data_symbol ON market_data(token_symbol);
CREATE INDEX IF NOT EXISTS idx_market_data_expires_at ON market_data(expires_at);

-- Performance indexes for dex pools
CREATE INDEX IF NOT EXISTS idx_dex_pools_chain_dex ON dex_pools(chain, dex_name);
CREATE INDEX IF NOT EXISTS idx_dex_pools_tokens ON dex_pools(token0_address, token1_address);
CREATE INDEX IF NOT EXISTS idx_dex_pools_tvl_desc ON dex_pools(tvl_usd DESC);
CREATE INDEX IF NOT EXISTS idx_dex_pools_active ON dex_pools(is_active);
CREATE INDEX IF NOT EXISTS idx_dex_pools_updated ON dex_pools(last_updated DESC);

-- Performance indexes for system metrics
CREATE INDEX IF NOT EXISTS idx_system_metrics_name_time ON system_metrics(metric_name, time_period, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_system_metrics_expires_at ON system_metrics(expires_at);

-- Performance indexes for user sessions
CREATE INDEX IF NOT EXISTS idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);

-- Performance indexes for request logs
CREATE INDEX IF NOT EXISTS idx_request_logs_timestamp_desc ON request_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_request_logs_path ON request_logs(path);
CREATE INDEX IF NOT EXISTS idx_request_logs_status ON request_logs(status_code);
CREATE INDEX IF NOT EXISTS idx_request_logs_expires_at ON request_logs(expires_at);

-- Triggers for updated_at timestamps
CREATE TRIGGER IF NOT EXISTS update_opportunities_updated_at
    AFTER UPDATE ON opportunities
    FOR EACH ROW
    BEGIN
        UPDATE opportunities SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_executions_updated_at
    AFTER UPDATE ON executions
    FOR EACH ROW
    BEGIN
        UPDATE executions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

-- Views for common queries
CREATE VIEW IF NOT EXISTS v_active_opportunities AS
SELECT 
    id,
    opportunity_type,
    chain,
    profit_estimate_usd,
    confidence_score,
    risk_score,
    status,
    created_at,
    expires_at
FROM opportunities
WHERE status IN ('detected', 'simulating', 'executing')
    AND datetime(expires_at) > datetime('now')
ORDER BY profit_estimate_usd DESC, confidence_score DESC;

CREATE VIEW IF NOT EXISTS v_recent_executions AS
SELECT 
    e.id,
    e.opportunity_id,
    o.opportunity_type,
    o.chain,
    e.tx_hash,
    e.status,
    e.success,
    e.profit_actual_usd,
    e.gas_used,
    e.execution_time_ms,
    e.executed_at
FROM executions e
JOIN opportunities o ON e.opportunity_id = o.id
WHERE datetime(e.executed_at) > datetime('now', '-24 hours')
ORDER BY e.executed_at DESC;

CREATE VIEW IF NOT EXISTS v_performance_summary AS
SELECT 
    COUNT(*) as total_opportunities,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_opportunities,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_opportunities,
    AVG(profit_estimate_usd) as avg_profit_estimate,
    AVG(confidence_score) as avg_confidence,
    MAX(profit_estimate_usd) as max_profit_estimate,
    MIN(created_at) as first_opportunity,
    MAX(created_at) as latest_opportunity
FROM opportunities
WHERE datetime(created_at) > datetime('now', '-24 hours');

-- Insert sample data for testing
INSERT OR IGNORE INTO opportunities (
    id, opportunity_type, chain, tokens, dexes, profit_estimate_usd, 
    gas_estimate, gas_price_gwei, confidence_score, risk_score, 
    expires_at
) VALUES (
    'sample-triangular-1',
    'TriangularArbitrage',
    'ethereum',
    '[{"address":"0xA0b86a33E6441E6C5C7732e0c1E8c5F8","symbol":"WETH","amount":"1000"}]',
    '[{"name":"uniswap_v2","router":"0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"}]',
    45.67,
    300000,
    30,
    0.85,
    0.25,
    datetime('now', '+5 minutes')
);

INSERT OR IGNORE INTO system_metrics (
    id, metric_name, metric_value, metric_unit, time_period, expires_at
) VALUES 
    ('metric-1', 'opportunities_per_minute', 12.5, 'count', '1m', datetime('now', '+1 hour')),
    ('metric-2', 'avg_profit_usd', 67.89, 'usd', '1h', datetime('now', '+1 hour')),
    ('metric-3', 'success_rate', 0.78, 'percentage', '1h', datetime('now', '+1 hour')),
    ('metric-4', 'avg_gas_price_gwei', 35.2, 'gwei', '5m', datetime('now', '+1 hour'));

-- Cleanup expired records procedure (to be called periodically)
-- DELETE FROM opportunities WHERE datetime(expires_at) < datetime('now');
-- DELETE FROM market_data WHERE datetime(expires_at) < datetime('now');
-- DELETE FROM system_metrics WHERE datetime(expires_at) < datetime('now');
-- DELETE FROM user_sessions WHERE datetime(expires_at) < datetime('now');
-- DELETE FROM request_logs WHERE datetime(expires_at) < datetime('now');

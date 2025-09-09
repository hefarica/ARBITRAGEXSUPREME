-- ArbitrageX Supreme V3.0 Database Schema
-- Ingenio Pichichi S.A.

-- Arbitrage executions table
CREATE TABLE IF NOT EXISTS arbitrage_executions (
    id TEXT PRIMARY KEY,
    strategy TEXT NOT NULL,
    amount REAL NOT NULL,
    blockchain TEXT NOT NULL DEFAULT 'ethereum',
    token_pair TEXT NOT NULL DEFAULT 'ETH/USDC',
    status TEXT NOT NULL DEFAULT 'pending',
    profit REAL DEFAULT 0,
    gas_cost REAL DEFAULT 0,
    execution_time REAL DEFAULT 0,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Market opportunities table
CREATE TABLE IF NOT EXISTS market_opportunities (
    id TEXT PRIMARY KEY,
    blockchain TEXT NOT NULL,
    token_pair TEXT NOT NULL,
    strategy TEXT NOT NULL,
    profit_potential REAL NOT NULL,
    required_capital REAL NOT NULL,
    gas_cost REAL NOT NULL,
    confidence REAL NOT NULL,
    exchanges TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- System metrics table
CREATE TABLE IF NOT EXISTS system_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    metric_name TEXT NOT NULL,
    metric_value REAL NOT NULL,
    blockchain TEXT,
    strategy TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User sessions table (for frontend integration)
CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,
    wallet_address TEXT NOT NULL,
    session_data TEXT,
    last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- API request logs table
CREATE TABLE IF NOT EXISTS api_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    response_time REAL NOT NULL,
    user_agent TEXT,
    ip_address TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_executions_status ON arbitrage_executions(status);
CREATE INDEX IF NOT EXISTS idx_executions_timestamp ON arbitrage_executions(timestamp);
CREATE INDEX IF NOT EXISTS idx_executions_blockchain ON arbitrage_executions(blockchain);
CREATE INDEX IF NOT EXISTS idx_executions_strategy ON arbitrage_executions(strategy);

CREATE INDEX IF NOT EXISTS idx_opportunities_blockchain ON market_opportunities(blockchain);
CREATE INDEX IF NOT EXISTS idx_opportunities_strategy ON market_opportunities(strategy);
CREATE INDEX IF NOT EXISTS idx_opportunities_expires ON market_opportunities(expires_at);
CREATE INDEX IF NOT EXISTS idx_opportunities_status ON market_opportunities(status);

CREATE INDEX IF NOT EXISTS idx_metrics_name ON system_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON system_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_metrics_blockchain ON system_metrics(blockchain);

CREATE INDEX IF NOT EXISTS idx_sessions_wallet ON user_sessions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_sessions_activity ON user_sessions(last_activity);

CREATE INDEX IF NOT EXISTS idx_logs_endpoint ON api_logs(endpoint);
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON api_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_logs_status ON api_logs(status_code);
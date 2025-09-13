-- ArbitrageX Pro 2025 - TimescaleDB Initialization
-- Time-series database for arbitrage metrics and performance data

-- Create extensions
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create schemas
CREATE SCHEMA IF NOT EXISTS metrics;       -- Performance metrics
CREATE SCHEMA IF NOT EXISTS trading;       -- Trading data
CREATE SCHEMA IF NOT EXISTS blockchain;    -- Blockchain metrics
CREATE SCHEMA IF NOT EXISTS alerts;        -- Alert data

-- Performance metrics hypertable
CREATE TABLE IF NOT EXISTS metrics.arbitrage_performance (
    time TIMESTAMPTZ NOT NULL,
    tenant_id UUID NOT NULL,
    strategy_id VARCHAR(50) NOT NULL,
    blockchain VARCHAR(20) NOT NULL,
    dex_pair VARCHAR(100) NOT NULL,
    profit_usd DECIMAL(20, 8),
    gas_cost_usd DECIMAL(20, 8),
    execution_time_ms INTEGER,
    success BOOLEAN,
    error_message TEXT,
    metadata JSONB
);

SELECT create_hypertable('metrics.arbitrage_performance', 'time');

-- Trading metrics hypertable
CREATE TABLE IF NOT EXISTS trading.price_feeds (
    time TIMESTAMPTZ NOT NULL,
    token_address VARCHAR(42) NOT NULL,
    blockchain VARCHAR(20) NOT NULL,
    dex VARCHAR(50) NOT NULL,
    price_usd DECIMAL(20, 8),
    volume_24h DECIMAL(20, 8),
    liquidity_usd DECIMAL(20, 8),
    metadata JSONB
);

SELECT create_hypertable('trading.price_feeds', 'time');

-- Blockchain metrics hypertable
CREATE TABLE IF NOT EXISTS blockchain.network_metrics (
    time TIMESTAMPTZ NOT NULL,
    blockchain VARCHAR(20) NOT NULL,
    block_number BIGINT,
    gas_price_gwei DECIMAL(10, 2),
    tps INTEGER,
    pending_transactions INTEGER,
    network_congestion DECIMAL(5, 4),
    metadata JSONB
);

SELECT create_hypertable('blockchain.network_metrics', 'time');

-- Alert events hypertable
CREATE TABLE IF NOT EXISTS alerts.events (
    time TIMESTAMPTZ NOT NULL,
    tenant_id UUID NOT NULL,
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    metadata JSONB
);

SELECT create_hypertable('alerts.events', 'time');

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_arbitrage_performance_tenant_time 
ON metrics.arbitrage_performance (tenant_id, time DESC);

CREATE INDEX IF NOT EXISTS idx_arbitrage_performance_strategy 
ON metrics.arbitrage_performance (strategy_id, time DESC);

CREATE INDEX IF NOT EXISTS idx_price_feeds_token_blockchain 
ON trading.price_feeds (token_address, blockchain, time DESC);

CREATE INDEX IF NOT EXISTS idx_network_metrics_blockchain 
ON blockchain.network_metrics (blockchain, time DESC);

CREATE INDEX IF NOT EXISTS idx_alerts_tenant_severity 
ON alerts.events (tenant_id, severity, time DESC);

-- Compression policies (compress data older than 7 days)
SELECT add_compression_policy('metrics.arbitrage_performance', INTERVAL '7 days');
SELECT add_compression_policy('trading.price_feeds', INTERVAL '7 days');
SELECT add_compression_policy('blockchain.network_metrics', INTERVAL '7 days');
SELECT add_compression_policy('alerts.events', INTERVAL '7 days');

-- Retention policies (drop data older than 1 year)
SELECT add_retention_policy('metrics.arbitrage_performance', INTERVAL '1 year');
SELECT add_retention_policy('trading.price_feeds', INTERVAL '1 year');
SELECT add_retention_policy('blockchain.network_metrics', INTERVAL '1 year');
SELECT add_retention_policy('alerts.events', INTERVAL '1 year');
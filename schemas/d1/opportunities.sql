-- =====================================================
-- ArbitrageX Supreme V3.0 - D1 Opportunities Cache
-- Cloudflare Edge Database Schema
-- =====================================================

-- Cached opportunities table (Hot opportunities cache)
CREATE TABLE IF NOT EXISTS cached_opportunities (
    opportunity_id TEXT PRIMARY KEY,
    chain TEXT NOT NULL,
    dex_a TEXT NOT NULL,
    dex_b TEXT NOT NULL,
    token_pair TEXT NOT NULL,
    price_difference REAL NOT NULL,
    volume REAL NOT NULL,
    estimated_profit REAL NOT NULL,
    risk_score REAL NOT NULL,
    execution_status TEXT NOT NULL DEFAULT 'pending',
    expiry_time TEXT NOT NULL,
    cached_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    
    -- Indexes for performance optimization
    CHECK (execution_status IN ('pending', 'executed', 'expired', 'failed'))
);

-- Indexes for optimal query performance
CREATE INDEX IF NOT EXISTS idx_cached_opportunities_chain_status 
ON cached_opportunities (chain, execution_status);

CREATE INDEX IF NOT EXISTS idx_cached_opportunities_profit_risk 
ON cached_opportunities (estimated_profit DESC, risk_score ASC);

CREATE INDEX IF NOT EXISTS idx_cached_opportunities_expiry 
ON cached_opportunities (expiry_time);

CREATE INDEX IF NOT EXISTS idx_cached_opportunities_cached_at 
ON cached_opportunities (cached_at DESC);

-- Hot opportunities view (most profitable, low risk, not expired)
CREATE VIEW IF NOT EXISTS hot_opportunities AS
SELECT 
    opportunity_id,
    chain,
    dex_a,
    dex_b,
    token_pair,
    price_difference,
    volume,
    estimated_profit,
    risk_score,
    execution_status,
    expiry_time,
    cached_at,
    updated_at,
    -- Calculate opportunity score (profit/risk ratio)
    ROUND(estimated_profit / NULLIF(risk_score, 0), 4) as opportunity_score,
    -- Time to expiry in minutes
    ROUND((julianday(expiry_time) - julianday('now')) * 24 * 60, 2) as minutes_to_expiry
FROM cached_opportunities
WHERE execution_status = 'pending'
  AND datetime(expiry_time) > datetime('now')
  AND estimated_profit > 0
  AND risk_score > 0
ORDER BY opportunity_score DESC, estimated_profit DESC;

-- Chain statistics view
CREATE VIEW IF NOT EXISTS chain_opportunity_stats AS
SELECT 
    chain,
    COUNT(*) as total_opportunities,
    COUNT(CASE WHEN execution_status = 'pending' THEN 1 END) as pending_opportunities,
    COUNT(CASE WHEN execution_status = 'executed' THEN 1 END) as executed_opportunities,
    AVG(estimated_profit) as avg_profit,
    MAX(estimated_profit) as max_profit,
    AVG(risk_score) as avg_risk,
    MIN(risk_score) as min_risk,
    datetime('now') as calculated_at
FROM cached_opportunities
GROUP BY chain;

-- DEX pair statistics view
CREATE VIEW IF NOT EXISTS dex_pair_stats AS
SELECT 
    chain,
    dex_a,
    dex_b,
    token_pair,
    COUNT(*) as opportunity_count,
    AVG(estimated_profit) as avg_profit,
    MAX(estimated_profit) as max_profit,
    AVG(price_difference) as avg_price_diff,
    AVG(risk_score) as avg_risk,
    datetime('now') as calculated_at
FROM cached_opportunities
GROUP BY chain, dex_a, dex_b, token_pair
HAVING opportunity_count > 5
ORDER BY avg_profit DESC;

-- Cleanup expired opportunities (run periodically)
-- This should be called by a scheduled worker or cron job
CREATE VIEW IF NOT EXISTS cleanup_expired_opportunities AS
SELECT 
    opportunity_id,
    chain,
    execution_status,
    expiry_time,
    cached_at,
    'expired' as should_delete
FROM cached_opportunities
WHERE datetime(expiry_time) < datetime('now', '-5 minutes')
   OR datetime(cached_at) < datetime('now', '-1 hour');

-- Performance monitoring table
CREATE TABLE IF NOT EXISTS cache_performance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    metric_name TEXT NOT NULL,
    metric_value REAL NOT NULL,
    chain TEXT,
    dex_pair TEXT,
    
    -- Common metrics: cache_hit_ratio, query_time_ms, opportunity_count, avg_profit
    CHECK (metric_name IN ('cache_hit_ratio', 'query_time_ms', 'opportunity_count', 'avg_profit', 'execution_rate'))
);

CREATE INDEX IF NOT EXISTS idx_cache_performance_timestamp 
ON cache_performance (timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_cache_performance_metric 
ON cache_performance (metric_name, timestamp DESC);

-- Sample data insertion for testing
INSERT OR IGNORE INTO cached_opportunities (
    opportunity_id, chain, dex_a, dex_b, token_pair, price_difference, 
    volume, estimated_profit, risk_score, execution_status, expiry_time
) VALUES 
    ('test-eth-1', 'ethereum', 'uniswap_v3', 'sushiswap', 'ETH/USDC', 0.00245, 10000.50, 24.50, 2.1, datetime('now', '+5 minutes')),
    ('test-arb-1', 'arbitrum', 'uniswap_v3', 'camelot', 'ARB/ETH', 0.00180, 8500.25, 18.75, 1.8, datetime('now', '+4 minutes')),
    ('test-poly-1', 'polygon', 'quickswap', 'sushiswap', 'MATIC/USDC', 0.00320, 15000.80, 32.15, 2.5, datetime('now', '+6 minutes'));

-- Sample performance metrics
INSERT OR IGNORE INTO cache_performance (metric_name, metric_value, chain) VALUES
    ('cache_hit_ratio', 0.856, 'ethereum'),
    ('cache_hit_ratio', 0.823, 'arbitrum'),
    ('cache_hit_ratio', 0.791, 'polygon'),
    ('query_time_ms', 12.5, 'ethereum'),
    ('query_time_ms', 8.2, 'arbitrum'),
    ('query_time_ms', 15.1, 'polygon'),
    ('opportunity_count', 1247, 'ethereum'),
    ('opportunity_count', 892, 'arbitrum'),
    ('opportunity_count', 645, 'polygon');
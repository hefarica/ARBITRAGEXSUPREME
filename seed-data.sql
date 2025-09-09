-- ArbitrageX Supreme V3.0 - Seed Data
-- Ingenio Pichichi S.A.

-- Insert sample arbitrage executions
INSERT OR IGNORE INTO arbitrage_executions (id, strategy, amount, blockchain, token_pair, status, profit, gas_cost, execution_time) VALUES
('exec_001', 'arbitrage', 1000.0, 'ethereum', 'ETH/USDC', 'completed', 25.5, 12.8, 2.3),
('exec_002', 'flashloan', 5000.0, 'polygon', 'MATIC/USDT', 'completed', 78.2, 5.4, 1.8),
('exec_003', 'sandwich', 2500.0, 'binance', 'BNB/BUSD', 'pending', 0.0, 8.9, 0.0),
('exec_004', 'liquidation', 10000.0, 'avalanche', 'AVAX/USDC', 'completed', 156.7, 15.2, 3.1);

-- Insert sample market opportunities
INSERT OR IGNORE INTO market_opportunities (id, blockchain, token_pair, strategy, profit_potential, required_capital, gas_cost, confidence, exchanges, expires_at) VALUES
('opp_001', 'ethereum', 'ETH/USDC', 'arbitrage', 2.35, 1000.0, 25.0, 85.5, '["Uniswap V3","SushiSwap"]', datetime('now', '+5 minutes')),
('opp_002', 'polygon', 'MATIC/USDT', 'triangle_arbitrage', 1.85, 2000.0, 8.5, 92.1, '["QuickSwap","Balancer"]', datetime('now', '+3 minutes')),
('opp_003', 'binance', 'BNB/BUSD', 'flashloan', 3.45, 5000.0, 12.0, 78.9, '["PancakeSwap","Venus"]', datetime('now', '+8 minutes')),
('opp_004', 'avalanche', 'AVAX/USDC', 'cross_chain_arbitrage', 4.25, 7500.0, 18.5, 88.7, '["TraderJoe","Pangolin"]', datetime('now', '+12 minutes'));

-- Insert system metrics
INSERT OR IGNORE INTO system_metrics (metric_name, metric_value, blockchain, strategy) VALUES
('active_strategies', 13, NULL, NULL),
('total_volume_24h', 2500000.0, NULL, NULL),
('successful_trades', 847, NULL, NULL),
('pending_executions', 23, NULL, NULL),
('ethereum_gas_price', 45.8, 'ethereum', NULL),
('polygon_gas_price', 2.1, 'polygon', NULL),
('binance_gas_price', 5.2, 'binance', NULL),
('avalanche_gas_price', 25.0, 'avalanche', NULL),
('arbitrage_success_rate', 94.2, NULL, 'arbitrage'),
('flashloan_success_rate', 97.8, NULL, 'flashloan'),
('liquidation_success_rate', 89.5, NULL, 'liquidation');

-- Insert sample user sessions
INSERT OR IGNORE INTO user_sessions (id, wallet_address, session_data) VALUES
('session_001', '0x742d35Cc6634C0532925a3b8D04Eb4f0734B112F', '{"preferences":{"theme":"dark","notifications":true}}'),
('session_002', '0x8ba1f109551bD432803012645Hac136c8ce21dF0', '{"preferences":{"theme":"light","notifications":false}}');
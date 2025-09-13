-- ArbitrageX Supreme V3.0 - Cloudflare D1 Database Schema
-- Edge database for workflow state, metrics, and caching

-- Tabla principal de ejecuciones de workflows
CREATE TABLE IF NOT EXISTS workflow_executions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_id TEXT UNIQUE NOT NULL,
    config TEXT NOT NULL,  -- JSON configuration
    agents_config TEXT,    -- JSON agents configuration  
    status TEXT NOT NULL DEFAULT 'starting', -- starting, active, completed, stopped, error
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    started_at TEXT,
    completed_at TEXT,
    stopped_at TEXT,
    execution_summary TEXT, -- JSON execution summary
    edge_request_id TEXT,
    error_details TEXT,
    last_update TEXT DEFAULT (datetime('now'))
);

-- Índices para workflow_executions
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow_id ON workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_created_at ON workflow_executions(created_at);

-- Tabla de oportunidades detectadas
CREATE TABLE IF NOT EXISTS opportunities_detected (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_id TEXT,
    agent_id TEXT NOT NULL, -- flashbots-detective, risk-guardian, strategy-optimizer
    token_pair TEXT NOT NULL,
    profit_usd REAL NOT NULL,
    dex_routes TEXT,  -- JSON array of DEX routes
    confidence REAL DEFAULT 0.0, -- 0.0 to 1.0
    risk_score REAL DEFAULT 0.0, -- 0.0 to 10.0  
    gas_estimate INTEGER,
    execution_time_estimate INTEGER, -- milliseconds
    status TEXT DEFAULT 'detected', -- detected, validated, rejected, executed
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    processed_at TEXT,
    
    FOREIGN KEY (workflow_id) REFERENCES workflow_executions(workflow_id)
);

-- Índices para opportunities_detected
CREATE INDEX IF NOT EXISTS idx_opportunities_detected_workflow_id ON opportunities_detected(workflow_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_detected_agent_id ON opportunities_detected(agent_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_detected_created_at ON opportunities_detected(created_at);
CREATE INDEX IF NOT EXISTS idx_opportunities_detected_profit_usd ON opportunities_detected(profit_usd);
CREATE INDEX IF NOT EXISTS idx_opportunities_detected_status ON opportunities_detected(status);

-- Tabla de métricas de agentes AI
CREATE TABLE IF NOT EXISTS agent_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workflow_id TEXT,
    agent_id TEXT NOT NULL,
    agent_name TEXT NOT NULL,
    status TEXT NOT NULL, -- idle, processing, active, error
    response_time_ms INTEGER DEFAULT 0,
    accuracy_percent REAL DEFAULT 95.0,
    processed_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    last_activity TEXT DEFAULT (datetime('now')),
    last_result TEXT, -- JSON last processing result
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    
    FOREIGN KEY (workflow_id) REFERENCES workflow_executions(workflow_id)
);

-- Índices para agent_metrics
CREATE INDEX IF NOT EXISTS idx_agent_metrics_workflow_id ON agent_metrics(workflow_id);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_agent_id ON agent_metrics(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_metrics_last_activity ON agent_metrics(last_activity);

-- Tabla de métricas del sistema
CREATE TABLE IF NOT EXISTS system_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    metric_type TEXT NOT NULL, -- system_health, performance, infrastructure
    metric_name TEXT NOT NULL,
    metric_value REAL NOT NULL,
    metric_unit TEXT, -- ms, percent, count, usd
    additional_data TEXT, -- JSON for complex metrics
    recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
    source TEXT DEFAULT 'cloudflare_edge' -- cloudflare_edge, contabo_vps, external
);

-- Índices para system_metrics
CREATE INDEX IF NOT EXISTS idx_system_metrics_type ON system_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_system_metrics_name ON system_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_system_metrics_recorded_at ON system_metrics(recorded_at);

-- Tabla de logs de auditoría
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL, -- workflow_start, workflow_stop, agent_update, system_event
    workflow_id TEXT,
    agent_id TEXT,
    event_data TEXT, -- JSON event details
    user_agent TEXT,
    ip_address TEXT,
    edge_request_id TEXT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    severity TEXT DEFAULT 'info' -- debug, info, warn, error, critical
);

-- Índices para audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_workflow_id ON audit_logs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity ON audit_logs(severity);

-- Tabla de configuración del sistema
CREATE TABLE IF NOT EXISTS system_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_key TEXT UNIQUE NOT NULL,
    config_value TEXT NOT NULL, -- JSON or string value
    config_type TEXT DEFAULT 'string', -- string, json, number, boolean
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Índice para system_config
CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config(config_key);

-- Insertar configuraciones por defecto del sistema
INSERT OR IGNORE INTO system_config (config_key, config_value, config_type, description) VALUES
('system_health_check_interval', '30', 'number', 'Intervalo en segundos para verificaciones de salud del sistema'),
('max_concurrent_workflows', '10', 'number', 'Número máximo de workflows concurrentes permitidos'),
('agent_timeout_ms', '30000', 'number', 'Timeout en milisegundos para respuestas de agentes'),
('metrics_retention_days', '30', 'number', 'Días de retención para métricas históricas'),
('min_profit_threshold_usd', '25', 'number', 'Umbral mínimo de profit en USD para ejecutar arbitraje'),
('max_gas_price_gwei', '150', 'number', 'Precio máximo de gas en Gwei para ejecutar transacciones'),
('contabo_vps_url', '', 'string', 'URL base del VPS CONTABO para comunicación backend'),
('edge_cache_ttl_seconds', '300', 'number', 'TTL por defecto para caché en edge (5 minutos)');

-- Vista para métricas de performance diarias
CREATE VIEW IF NOT EXISTS daily_performance_metrics AS
SELECT 
    DATE(created_at) as date,
    COUNT(*) as total_workflows,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_workflows,
    COUNT(CASE WHEN status = 'error' OR status = 'stopped' THEN 1 END) as failed_workflows,
    ROUND(
        COUNT(CASE WHEN status = 'completed' THEN 1 END) * 100.0 / COUNT(*), 2
    ) as success_rate_percent,
    SUM(CASE 
        WHEN execution_summary IS NOT NULL 
        THEN CAST(JSON_EXTRACT(execution_summary, '$.totalProfit') AS REAL)
        ELSE 0 
    END) as total_profit_usd,
    AVG(CASE 
        WHEN execution_summary IS NOT NULL 
        THEN CAST(JSON_EXTRACT(execution_summary, '$.duration') AS REAL)
        ELSE NULL 
    END) as avg_execution_time_ms
FROM workflow_executions
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Vista para estado actual de agentes
CREATE VIEW IF NOT EXISTS current_agent_status AS
SELECT 
    agent_id,
    agent_name,
    status,
    response_time_ms,
    accuracy_percent,
    processed_count,
    error_count,
    last_activity,
    created_at
FROM agent_metrics am1
WHERE created_at = (
    SELECT MAX(created_at) 
    FROM agent_metrics am2 
    WHERE am2.agent_id = am1.agent_id
)
ORDER BY agent_id;

-- Vista para oportunidades recientes
CREATE VIEW IF NOT EXISTS recent_opportunities AS
SELECT 
    o.token_pair,
    o.profit_usd,
    o.confidence,
    o.risk_score,
    o.status,
    o.created_at,
    w.status as workflow_status,
    JSON_EXTRACT(o.dex_routes, '$[0]') as primary_dex,
    JSON_EXTRACT(o.dex_routes, '$[1]') as secondary_dex
FROM opportunities_detected o
LEFT JOIN workflow_executions w ON o.workflow_id = w.workflow_id
WHERE o.created_at >= datetime('now', '-24 hours')
ORDER BY o.created_at DESC;

-- Triggers para mantener updated_at en system_config
CREATE TRIGGER IF NOT EXISTS update_system_config_timestamp 
AFTER UPDATE ON system_config
FOR EACH ROW
BEGIN
    UPDATE system_config 
    SET updated_at = datetime('now')
    WHERE id = NEW.id;
END;

-- Trigger para mantener last_update en workflow_executions
CREATE TRIGGER IF NOT EXISTS update_workflow_last_update 
AFTER UPDATE ON workflow_executions
FOR EACH ROW
BEGIN
    UPDATE workflow_executions 
    SET last_update = datetime('now')
    WHERE id = NEW.id;
END;
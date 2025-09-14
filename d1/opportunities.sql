-- d1/opportunities.sql
CREATE TABLE IF NOT EXISTS opportunities (
    id INTEGER PRIMARY KEY,
    chain TEXT NOT NULL,
    tokens TEXT NOT NULL, -- JSON array
    profit_usd REAL NOT NULL,
    gas_cost REAL,
    created_at INTEGER DEFAULT (cast(unixepoch() as int))
);

CREATE INDEX IF NOT EXISTS idx_opportunities_chain ON opportunities(chain);
CREATE INDEX IF NOT EXISTS idx_opportunities_created ON opportunities(created_at DESC);

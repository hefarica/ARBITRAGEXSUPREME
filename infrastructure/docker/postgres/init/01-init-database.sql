-- ArbitrageX Pro 2025 - PostgreSQL Initialization
-- Multi-tenant database setup with performance optimizations

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create read-only user
CREATE USER arbitragex_readonly WITH PASSWORD 'arbitragex_readonly_password';
GRANT CONNECT ON DATABASE arbitragex_prod TO arbitragex_readonly;
GRANT USAGE ON SCHEMA public TO arbitragex_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO arbitragex_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO arbitragex_readonly;

-- Create schemas for different data types
CREATE SCHEMA IF NOT EXISTS core;          -- Core business logic
CREATE SCHEMA IF NOT EXISTS saas;          -- SaaS infrastructure
CREATE SCHEMA IF NOT EXISTS arbitrage;     -- Arbitrage data
CREATE SCHEMA IF NOT EXISTS blockchain;    -- Blockchain data
CREATE SCHEMA IF NOT EXISTS analytics;     -- Analytics and reporting
CREATE SCHEMA IF NOT EXISTS audit;         -- Audit trails

-- Grant permissions on schemas
GRANT USAGE ON SCHEMA core TO arbitragex_readonly;
GRANT USAGE ON SCHEMA saas TO arbitragex_readonly;
GRANT USAGE ON SCHEMA arbitrage TO arbitragex_readonly;
GRANT USAGE ON SCHEMA blockchain TO arbitragex_readonly;
GRANT USAGE ON SCHEMA analytics TO arbitragex_readonly;
GRANT USAGE ON SCHEMA audit TO arbitragex_readonly;

-- Performance settings
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET log_statement = 'all';
ALTER SYSTEM SET log_duration = 'on';
ALTER SYSTEM SET log_slow_queries = 'on';
ALTER SYSTEM SET slow_query_log_time = 1000; -- 1 second

-- Indexes for common queries
-- These will be created via Prisma migrations
-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'CANCELED', 'PAST_DUE', 'UNPAID', 'TRIALING');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'USER', 'VIEWER');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION');

-- CreateEnum
CREATE TYPE "OpportunityStatus" AS ENUM ('DETECTED', 'ANALYZING', 'READY', 'EXECUTING', 'EXECUTED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ExecutionMode" AS ENUM ('SIMULATION', 'PAPER_TRADING', 'LIVE_TRADING');

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT');

-- CreateEnum
CREATE TYPE "StepType" AS ENUM ('APPROVAL', 'FLASH_LOAN_START', 'SWAP', 'BRIDGE', 'FLASH_LOAN_REPAY', 'PROFIT_EXTRACTION');

-- CreateEnum
CREATE TYPE "StepStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "domain" TEXT,
    "branding" JSONB,
    "subscription_id" UUID,
    "settings" JSONB,
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "permissions" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "stripe_subscription_id" TEXT,
    "stripe_customer_id" TEXT,
    "plan_id" UUID NOT NULL,
    "status" "SubscriptionStatus" NOT NULL,
    "current_period_start" TIMESTAMP(3) NOT NULL,
    "current_period_end" TIMESTAMP(3) NOT NULL,
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_plans" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "stripe_price_id" TEXT,
    "price_monthly" DECIMAL(10,2) NOT NULL,
    "features" JSONB NOT NULL,
    "limits" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arbitrage_configs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "strategies" JSONB NOT NULL,
    "blockchains" JSONB NOT NULL,
    "risk_settings" JSONB NOT NULL,
    "slippage_tolerance" DECIMAL(5,4) NOT NULL DEFAULT 0.005,
    "min_profit_threshold" DECIMAL(10,4) NOT NULL DEFAULT 0.02,
    "max_position_size" DECIMAL(20,8) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "arbitrage_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arbitrage_opportunities" (
    "id" UUID NOT NULL,
    "config_id" UUID NOT NULL,
    "strategy_name" TEXT NOT NULL,
    "blockchain_from" TEXT NOT NULL,
    "blockchain_to" TEXT NOT NULL,
    "token_in" TEXT NOT NULL,
    "token_out" TEXT NOT NULL,
    "token_symbol" TEXT NOT NULL,
    "amount_in" DECIMAL(30,18) NOT NULL,
    "expected_amount_out" DECIMAL(30,18) NOT NULL,
    "profit_amount" DECIMAL(30,18) NOT NULL,
    "profit_percentage" DECIMAL(10,6) NOT NULL,
    "profit_usd" DECIMAL(20,8) NOT NULL,
    "confidence_score" DECIMAL(3,2) NOT NULL,
    "gas_estimate" TEXT NOT NULL,
    "dex_path" JSONB NOT NULL,
    "triangular_path" JSONB,
    "flash_loan_data" JSONB,
    "status" "OpportunityStatus" NOT NULL DEFAULT 'DETECTED',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "arbitrage_opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arbitrage_executions" (
    "id" UUID NOT NULL,
    "opportunity_id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "execution_mode" "ExecutionMode" NOT NULL,
    "status" "ExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "transaction_hashes" JSONB NOT NULL,
    "actual_profit" DECIMAL(30,18),
    "actual_gas_used" TEXT,
    "execution_time_ms" INTEGER,
    "slippage_actual" DECIMAL(10,6),
    "slippage_tolerance" DECIMAL(5,4) NOT NULL DEFAULT 0.005,
    "max_gas_price" TEXT,
    "deadline" TIMESTAMP(3) NOT NULL,
    "error_message" TEXT,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "arbitrage_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execution_steps" (
    "id" UUID NOT NULL,
    "execution_id" UUID NOT NULL,
    "step_number" INTEGER NOT NULL,
    "step_type" "StepType" NOT NULL,
    "blockchain" TEXT NOT NULL,
    "transaction_hash" TEXT,
    "status" "StepStatus" NOT NULL DEFAULT 'PENDING',
    "token_in" TEXT,
    "token_out" TEXT,
    "amount_in" DECIMAL(30,18),
    "amount_out" DECIMAL(30,18),
    "dex_exchange" TEXT,
    "pool_address" TEXT,
    "gas_used" TEXT,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "execution_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blockchain_networks" (
    "id" UUID NOT NULL,
    "network_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "chain_id" INTEGER NOT NULL,
    "rpc_url" TEXT NOT NULL,
    "ws_url" TEXT,
    "explorer_url" TEXT NOT NULL,
    "block_time" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_sync_block" BIGINT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blockchain_networks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dex_protocols" (
    "id" UUID NOT NULL,
    "network_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "protocol_type" TEXT NOT NULL,
    "router_address" TEXT NOT NULL,
    "factory_address" TEXT,
    "supports_flash_loans" BOOLEAN NOT NULL DEFAULT false,
    "fee_percentage" DECIMAL(6,4) NOT NULL,
    "tvl_usd" DECIMAL(20,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dex_protocols_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trading_pairs" (
    "id" UUID NOT NULL,
    "dex_protocol_id" UUID NOT NULL,
    "token0_address" TEXT NOT NULL,
    "token1_address" TEXT NOT NULL,
    "token0_symbol" TEXT NOT NULL,
    "token1_symbol" TEXT NOT NULL,
    "pair_address" TEXT NOT NULL,
    "reserve0" DECIMAL(30,18) NOT NULL,
    "reserve1" DECIMAL(30,18) NOT NULL,
    "price" DECIMAL(30,18) NOT NULL,
    "volume_24h_usd" DECIMAL(20,2),
    "liquidity_usd" DECIMAL(20,2),
    "last_updated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trading_pairs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "network_status" (
    "id" UUID NOT NULL,
    "network_id" UUID NOT NULL,
    "block_number" BIGINT NOT NULL,
    "gas_price_gwei" DECIMAL(10,4) NOT NULL,
    "is_syncing" BOOLEAN NOT NULL DEFAULT false,
    "peer_count" INTEGER,
    "response_time_ms" INTEGER NOT NULL,
    "is_healthy" BOOLEAN NOT NULL DEFAULT true,
    "checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "network_status_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tenants_domain_key" ON "tenants"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys"("key_hash");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_stripe_subscription_id_key" ON "subscriptions"("stripe_subscription_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_plans_stripe_price_id_key" ON "subscription_plans"("stripe_price_id");

-- CreateIndex
CREATE INDEX "arbitrage_opportunities_strategy_name_blockchain_from_status_idx" ON "arbitrage_opportunities"("strategy_name", "blockchain_from", "status");

-- CreateIndex
CREATE INDEX "arbitrage_opportunities_expires_at_status_idx" ON "arbitrage_opportunities"("expires_at", "status");

-- CreateIndex
CREATE INDEX "arbitrage_opportunities_profit_percentage_idx" ON "arbitrage_opportunities"("profit_percentage");

-- CreateIndex
CREATE INDEX "arbitrage_executions_status_started_at_idx" ON "arbitrage_executions"("status", "started_at");

-- CreateIndex
CREATE INDEX "arbitrage_executions_tenant_id_user_id_status_idx" ON "arbitrage_executions"("tenant_id", "user_id", "status");

-- CreateIndex
CREATE INDEX "arbitrage_executions_opportunity_id_idx" ON "arbitrage_executions"("opportunity_id");

-- CreateIndex
CREATE INDEX "execution_steps_execution_id_step_number_idx" ON "execution_steps"("execution_id", "step_number");

-- CreateIndex
CREATE UNIQUE INDEX "blockchain_networks_network_id_key" ON "blockchain_networks"("network_id");

-- CreateIndex
CREATE UNIQUE INDEX "blockchain_networks_chain_id_key" ON "blockchain_networks"("chain_id");

-- CreateIndex
CREATE INDEX "dex_protocols_network_id_is_active_idx" ON "dex_protocols"("network_id", "is_active");

-- CreateIndex
CREATE INDEX "trading_pairs_dex_protocol_id_token0_symbol_token1_symbol_idx" ON "trading_pairs"("dex_protocol_id", "token0_symbol", "token1_symbol");

-- CreateIndex
CREATE UNIQUE INDEX "trading_pairs_pair_address_key" ON "trading_pairs"("pair_address");

-- CreateIndex
CREATE INDEX "network_status_network_id_checked_at_idx" ON "network_status"("network_id", "checked_at");

-- AddForeignKey
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "subscription_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arbitrage_configs" ADD CONSTRAINT "arbitrage_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arbitrage_opportunities" ADD CONSTRAINT "arbitrage_opportunities_config_id_fkey" FOREIGN KEY ("config_id") REFERENCES "arbitrage_configs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arbitrage_executions" ADD CONSTRAINT "arbitrage_executions_opportunity_id_fkey" FOREIGN KEY ("opportunity_id") REFERENCES "arbitrage_opportunities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arbitrage_executions" ADD CONSTRAINT "arbitrage_executions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arbitrage_executions" ADD CONSTRAINT "arbitrage_executions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_steps" ADD CONSTRAINT "execution_steps_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "arbitrage_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dex_protocols" ADD CONSTRAINT "dex_protocols_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "blockchain_networks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trading_pairs" ADD CONSTRAINT "trading_pairs_dex_protocol_id_fkey" FOREIGN KEY ("dex_protocol_id") REFERENCES "dex_protocols"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "network_status" ADD CONSTRAINT "network_status_network_id_fkey" FOREIGN KEY ("network_id") REFERENCES "blockchain_networks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
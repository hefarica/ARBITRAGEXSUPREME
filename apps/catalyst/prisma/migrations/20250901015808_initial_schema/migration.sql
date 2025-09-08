-- CreateTable
CREATE TABLE "blockchains" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chainId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "rpcUrl" TEXT NOT NULL,
    "explorerUrl" TEXT NOT NULL,
    "nativeCurrency" TEXT NOT NULL,
    "isTestnet" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "gasTokenSymbol" TEXT NOT NULL,
    "blockTime" INTEGER NOT NULL,
    "confirmations" INTEGER NOT NULL DEFAULT 12,
    "maxGasPrice" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "protocols" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "version" TEXT,
    "blockchainId" TEXT NOT NULL,
    "routerAddress" TEXT,
    "factoryAddress" TEXT,
    "masterChefAddress" TEXT,
    "tvl" REAL NOT NULL DEFAULT 0,
    "volume24h" REAL NOT NULL DEFAULT 0,
    "fees24h" REAL NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "riskScore" INTEGER NOT NULL DEFAULT 5,
    "websiteUrl" TEXT,
    "docsUrl" TEXT,
    "githubUrl" TEXT,
    "auditUrl" TEXT,
    "supportsFlashLoans" BOOLEAN NOT NULL DEFAULT false,
    "flashLoanFee" REAL,
    "maxFlashLoanAmount" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastSyncAt" DATETIME,
    CONSTRAINT "protocols_blockchainId_fkey" FOREIGN KEY ("blockchainId") REFERENCES "blockchains" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "liquidity_pools" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pairAddress" TEXT NOT NULL,
    "token0Address" TEXT NOT NULL,
    "token1Address" TEXT NOT NULL,
    "token0Symbol" TEXT NOT NULL,
    "token1Symbol" TEXT NOT NULL,
    "token0Decimals" INTEGER NOT NULL DEFAULT 18,
    "token1Decimals" INTEGER NOT NULL DEFAULT 18,
    "protocolId" TEXT NOT NULL,
    "blockchainId" TEXT NOT NULL,
    "reserve0" TEXT NOT NULL,
    "reserve1" TEXT NOT NULL,
    "totalSupply" TEXT NOT NULL,
    "tvl" REAL NOT NULL DEFAULT 0,
    "volume24h" REAL NOT NULL DEFAULT 0,
    "volume7d" REAL NOT NULL DEFAULT 0,
    "fees24h" REAL NOT NULL DEFAULT 0,
    "apy" REAL NOT NULL DEFAULT 0,
    "token0Price" REAL NOT NULL DEFAULT 0,
    "token1Price" REAL NOT NULL DEFAULT 0,
    "priceChange24h" REAL NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isStable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastSyncAt" DATETIME,
    CONSTRAINT "liquidity_pools_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "protocols" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "liquidity_pools_blockchainId_fkey" FOREIGN KEY ("blockchainId") REFERENCES "blockchains" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "flash_loan_strategies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "strategyType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "minProfitUsd" REAL NOT NULL DEFAULT 10,
    "maxGasCost" REAL NOT NULL DEFAULT 50,
    "riskLevel" INTEGER NOT NULL DEFAULT 5,
    "protocolId" TEXT NOT NULL,
    "flashLoanAmount" TEXT,
    "swapPath" TEXT,
    "slippageTolerance" REAL NOT NULL DEFAULT 0.5,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isBacktested" BOOLEAN NOT NULL DEFAULT false,
    "totalExecutions" INTEGER NOT NULL DEFAULT 0,
    "successRate" REAL NOT NULL DEFAULT 0,
    "totalProfitUsd" REAL NOT NULL DEFAULT 0,
    "avgProfitUsd" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "lastExecutedAt" DATETIME,
    CONSTRAINT "flash_loan_strategies_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "protocols" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "arbitrage_opportunities" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "strategyType" TEXT NOT NULL,
    "profitEstimateUsd" REAL NOT NULL,
    "profitPercentage" REAL NOT NULL,
    "strategyId" TEXT,
    "sourcePoolId" TEXT NOT NULL,
    "protocolId" TEXT NOT NULL,
    "blockchainId" TEXT NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "tokenSymbol" TEXT NOT NULL,
    "sourcePriceUsd" REAL NOT NULL,
    "targetPriceUsd" REAL NOT NULL,
    "gasEstimate" TEXT NOT NULL,
    "gasCostUsd" REAL NOT NULL,
    "flashLoanFee" REAL NOT NULL,
    "slippageEstimate" REAL NOT NULL,
    "isExecuted" BOOLEAN NOT NULL DEFAULT false,
    "executionTxHash" TEXT,
    "actualProfitUsd" REAL,
    "executionError" TEXT,
    "detectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    "executedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'DETECTED',
    CONSTRAINT "arbitrage_opportunities_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "flash_loan_strategies" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "arbitrage_opportunities_sourcePoolId_fkey" FOREIGN KEY ("sourcePoolId") REFERENCES "liquidity_pools" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "arbitrage_opportunities_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "protocols" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "arbitrage_opportunities_blockchainId_fkey" FOREIGN KEY ("blockchainId") REFERENCES "blockchains" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "system_metrics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "metricName" TEXT NOT NULL,
    "metricValue" REAL NOT NULL,
    "metricUnit" TEXT,
    "blockchainId" TEXT,
    "protocolId" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "security_alerts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "alertType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "blockchainId" TEXT,
    "protocolId" TEXT,
    "transactionHash" TEXT,
    "affectedAddress" TEXT,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" DATETIME,
    "resolverNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "api_integrations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "serviceName" TEXT NOT NULL,
    "serviceType" TEXT NOT NULL,
    "apiKey" TEXT,
    "webhookUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "totalRequests" INTEGER NOT NULL DEFAULT 0,
    "successRequests" INTEGER NOT NULL DEFAULT 0,
    "lastRequestAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "blockchains_chainId_key" ON "blockchains"("chainId");

-- CreateIndex
CREATE UNIQUE INDEX "protocols_name_blockchainId_key" ON "protocols"("name", "blockchainId");

-- CreateIndex
CREATE UNIQUE INDEX "liquidity_pools_pairAddress_key" ON "liquidity_pools"("pairAddress");

-- CreateIndex
CREATE INDEX "liquidity_pools_protocolId_idx" ON "liquidity_pools"("protocolId");

-- CreateIndex
CREATE INDEX "liquidity_pools_blockchainId_idx" ON "liquidity_pools"("blockchainId");

-- CreateIndex
CREATE UNIQUE INDEX "liquidity_pools_pairAddress_blockchainId_key" ON "liquidity_pools"("pairAddress", "blockchainId");

-- CreateIndex
CREATE INDEX "arbitrage_opportunities_strategyType_idx" ON "arbitrage_opportunities"("strategyType");

-- CreateIndex
CREATE INDEX "arbitrage_opportunities_profitEstimateUsd_idx" ON "arbitrage_opportunities"("profitEstimateUsd");

-- CreateIndex
CREATE INDEX "arbitrage_opportunities_detectedAt_idx" ON "arbitrage_opportunities"("detectedAt");

-- CreateIndex
CREATE INDEX "arbitrage_opportunities_status_idx" ON "arbitrage_opportunities"("status");

-- CreateIndex
CREATE INDEX "system_metrics_metricName_idx" ON "system_metrics"("metricName");

-- CreateIndex
CREATE INDEX "system_metrics_timestamp_idx" ON "system_metrics"("timestamp");

-- CreateIndex
CREATE INDEX "security_alerts_alertType_idx" ON "security_alerts"("alertType");

-- CreateIndex
CREATE INDEX "security_alerts_severity_idx" ON "security_alerts"("severity");

-- CreateIndex
CREATE INDEX "security_alerts_createdAt_idx" ON "security_alerts"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "api_integrations_serviceName_key" ON "api_integrations"("serviceName");

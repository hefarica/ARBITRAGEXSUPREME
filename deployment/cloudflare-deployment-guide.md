# Cloudflare Deployment Guide - ArbitrageX Supreme

## 🎯 Guía de Despliegue en Cloudflare Pages

Esta guía detalla el proceso completo de despliegue de ArbitrageX Supreme en Cloudflare Pages, siguiendo las mejores prácticas para aplicaciones financieras de misión crítica.

## 📋 Prerrequisitos

### Cuentas y Accesos Requeridos
- ✅ Cuenta de Cloudflare con plan Pro o superior
- ✅ Dominio personalizado configurado en Cloudflare
- ✅ API Token de Cloudflare con permisos completos
- ✅ Repositorio GitHub configurado
- ✅ CLI de Wrangler instalado (`npm install -g wrangler`)

### Verificación de Herramientas
```bash
# Verificar instalaciones
node --version    # v20.x.x o superior
npm --version     # v10.x.x o superior
wrangler --version # v3.x.x o superior
git --version     # v2.x.x o superior

# Verificar autenticación
wrangler whoami
# Debe mostrar tu cuenta de Cloudflare
```

## 🔧 Configuración Inicial

### 1. Configuración de API Token

```bash
# Configurar token de Cloudflare
wrangler login

# Alternativamente, configurar token manualmente
export CLOUDFLARE_API_TOKEN="your_api_token_here"

# Verificar configuración
wrangler whoami
```

### 2. Configuración del Proyecto

#### 2.1 Estructura de Archivos de Configuración
```
ARBITRAGEXSUPREME/
├── wrangler.toml                 # Configuración principal de Wrangler
├── wrangler.production.toml      # Configuración específica de producción
├── wrangler.staging.toml         # Configuración específica de staging
├── package.json                  # Dependencies y scripts
├── .env.example                  # Variables de entorno de ejemplo
├── .env.production              # Variables de producción (NO commitear)
└── deployment/
    ├── deploy-production.sh     # Script de despliegue
    ├── deploy-staging.sh        # Script de staging
    └── rollback.sh             # Script de rollback
```

#### 2.2 Configuración de wrangler.toml
```toml
# wrangler.toml - Configuración principal
name = "arbitragex-supreme"
main = "dist/_worker.js"
compatibility_date = "2024-12-01"
compatibility_flags = ["nodejs_compat"]

# Configuración de Pages
pages_build_output_dir = "./dist"

# Variables de entorno
[env.production]
name = "arbitragex-supreme-prod"

[env.staging]
name = "arbitragex-supreme-staging"

# Configuración de D1 Database
[[env.production.d1_databases]]
binding = "DB"
database_name = "arbitragex-production"
database_id = "your-production-db-id"

[[env.staging.d1_databases]]
binding = "DB"
database_name = "arbitragex-staging" 
database_id = "your-staging-db-id"

# Configuración de KV Storage
[[env.production.kv_namespaces]]
binding = "CACHE"
id = "your-production-kv-id"
preview_id = "your-production-kv-preview-id"

[[env.staging.kv_namespaces]]
binding = "CACHE"
id = "your-staging-kv-id"
preview_id = "your-staging-kv-preview-id"

# Configuración de R2 Storage
[[env.production.r2_buckets]]
binding = "STORAGE"
bucket_name = "arbitragex-production-storage"

[[env.staging.r2_buckets]]
binding = "STORAGE"
bucket_name = "arbitragex-staging-storage"

# Configuración de Workers AI (si se usa)
[env.production.ai]
binding = "AI"

[env.staging.ai]
binding = "AI"

# Límites y configuración
[limits]
cpu_ms = 30000  # 30 segundos para operaciones de trading complejas

# Configuración de observabilidad
[observability]
enabled = true

# Configuración de placement
[placement]
mode = "smart"  # Optimización automática de ubicación
```

### 3. Configuración de Variables de Entorno

#### 3.1 Variables de Producción
```bash
# Configurar secretos de producción usando Wrangler
wrangler secret put ENCRYPTION_KEY --env production
wrangler secret put DATABASE_ENCRYPTION_KEY --env production
wrangler secret put JWT_SECRET --env production
wrangler secret put API_ENCRYPTION_SALT --env production

# Variables específicas de blockchain
wrangler secret put ETHEREUM_RPC_URL --env production
wrangler secret put BSC_RPC_URL --env production
wrangler secret put POLYGON_RPC_URL --env production
wrangler secret put ARBITRUM_RPC_URL --env production

# API keys de terceros
wrangler secret put CHAINLINK_API_KEY --env production
wrangler secret put COINGECKO_API_KEY --env production
wrangler secret put ALCHEMY_API_KEY --env production

# Configuración de notificaciones
wrangler secret put SLACK_WEBHOOK_URL --env production
wrangler secret put TELEGRAM_BOT_TOKEN --env production
wrangler secret put SENDGRID_API_KEY --env production

# Monitoreo y analytics
wrangler secret put SENTRY_DSN --env production
wrangler secret put DATADOG_API_KEY --env production
```

#### 3.2 Variables Públicas (No secretas)
```bash
# Configurar variables públicas
wrangler pages secret put NODE_ENV="production" --project-name arbitragex-supreme-prod
wrangler pages secret put APP_VERSION="1.0.0" --project-name arbitragex-supreme-prod
wrangler pages secret put APP_ENVIRONMENT="production" --project-name arbitragex-supreme-prod
wrangler pages secret put LOG_LEVEL="info" --project-name arbitragex-supreme-prod
wrangler pages secret put RATE_LIMIT_ENABLED="true" --project-name arbitragex-supreme-prod
wrangler pages secret put CORS_ORIGINS="https://arbitragex.com,https://app.arbitragex.com" --project-name arbitragex-supreme-prod
```

## 🗄️ Configuración de Bases de Datos

### 1. Cloudflare D1 Database Setup

#### 1.1 Crear Base de Datos de Producción
```bash
# Crear base de datos principal
wrangler d1 create arbitragex-production

# Output esperado:
# ✅ Successfully created DB 'arbitragex-production'
# 📋 Database ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Crear base de datos de staging
wrangler d1 create arbitragex-staging

# Actualizar wrangler.toml con los IDs generados
```

#### 1.2 Ejecutar Migraciones
```bash
# Crear estructura de migraciones
mkdir -p migrations

# Migración inicial - Schema principal
cat > migrations/0001_initial_schema.sql << 'EOF'
-- Users and Authentication
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    wallet_address TEXT UNIQUE,
    password_hash TEXT,
    role TEXT DEFAULT 'trader' CHECK (role IN ('admin', 'trader', 'analyst', 'viewer')),
    kyc_status TEXT DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'approved', 'rejected')),
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME,
    is_active BOOLEAN DEFAULT TRUE
);

-- User Sessions
CREATE TABLE IF NOT EXISTS user_sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    device_info JSON,
    ip_address TEXT,
    user_agent TEXT,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Trading Strategies
CREATE TABLE IF NOT EXISTS trading_strategies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('arbitrage', 'flash_loan', 'triangular', 'cross_chain')),
    configuration JSON NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
    risk_parameters JSON,
    performance_metrics JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Arbitrage Opportunities
CREATE TABLE IF NOT EXISTS arbitrage_opportunities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    strategy_id INTEGER,
    token_pair TEXT NOT NULL,
    source_exchange TEXT NOT NULL,
    target_exchange TEXT NOT NULL,
    source_price DECIMAL(20, 8) NOT NULL,
    target_price DECIMAL(20, 8) NOT NULL,
    profit_potential DECIMAL(20, 8) NOT NULL,
    profit_percentage DECIMAL(10, 6) NOT NULL,
    gas_cost DECIMAL(20, 8) NOT NULL,
    net_profit DECIMAL(20, 8) NOT NULL,
    confidence_score DECIMAL(5, 4),
    status TEXT DEFAULT 'detected' CHECK (status IN ('detected', 'executing', 'executed', 'expired', 'failed')),
    detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    executed_at DATETIME,
    FOREIGN KEY (strategy_id) REFERENCES trading_strategies(id)
);

-- Flash Loan Executions
CREATE TABLE IF NOT EXISTS flash_loan_executions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    opportunity_id INTEGER,
    user_id INTEGER NOT NULL,
    loan_amount DECIMAL(20, 8) NOT NULL,
    loan_token TEXT NOT NULL,
    protocol TEXT NOT NULL CHECK (protocol IN ('aave', 'balancer', 'dydx', 'uniswap')),
    execution_path JSON NOT NULL,
    gas_used INTEGER,
    gas_price DECIMAL(20, 8),
    profit_realized DECIMAL(20, 8),
    fees_paid DECIMAL(20, 8),
    transaction_hash TEXT UNIQUE,
    block_number INTEGER,
    network TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'failed', 'reverted')),
    error_message TEXT,
    execution_time INTEGER, -- milliseconds
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    confirmed_at DATETIME,
    FOREIGN KEY (opportunity_id) REFERENCES arbitrage_opportunities(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Portfolio Holdings
CREATE TABLE IF NOT EXISTS portfolio_holdings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token_symbol TEXT NOT NULL,
    token_address TEXT NOT NULL,
    network TEXT NOT NULL,
    balance DECIMAL(30, 18) NOT NULL DEFAULT 0,
    locked_balance DECIMAL(30, 18) NOT NULL DEFAULT 0,
    usd_value DECIMAL(20, 8),
    average_cost DECIMAL(20, 8),
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, token_symbol, network)
);

-- Risk Metrics
CREATE TABLE IF NOT EXISTS risk_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    portfolio_value DECIMAL(20, 8) NOT NULL,
    var_95 DECIMAL(20, 8), -- Value at Risk 95%
    var_99 DECIMAL(20, 8), -- Value at Risk 99%
    sharpe_ratio DECIMAL(10, 6),
    max_drawdown DECIMAL(10, 6),
    volatility DECIMAL(10, 6),
    beta DECIMAL(10, 6),
    calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Security Events
CREATE TABLE IF NOT EXISTS security_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    event_type TEXT NOT NULL,
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    description TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    metadata JSON,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- System Monitoring
CREATE TABLE IF NOT EXISTS system_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    metric_name TEXT NOT NULL,
    metric_value DECIMAL(20, 8) NOT NULL,
    metric_unit TEXT,
    tags JSON,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    old_values JSON,
    new_values JSON,
    ip_address TEXT,
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Indexes para performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_strategies_user ON trading_strategies(user_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_strategy ON arbitrage_opportunities(strategy_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_status ON arbitrage_opportunities(status);
CREATE INDEX IF NOT EXISTS idx_opportunities_detected ON arbitrage_opportunities(detected_at);
CREATE INDEX IF NOT EXISTS idx_executions_opportunity ON flash_loan_executions(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_executions_user ON flash_loan_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_executions_status ON flash_loan_executions(status);
CREATE INDEX IF NOT EXISTS idx_executions_hash ON flash_loan_executions(transaction_hash);
CREATE INDEX IF NOT EXISTS idx_portfolio_user ON portfolio_holdings(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_token ON portfolio_holdings(token_symbol);
CREATE INDEX IF NOT EXISTS idx_risk_user ON risk_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_risk_calculated ON risk_metrics(calculated_at);
CREATE INDEX IF NOT EXISTS idx_security_user ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_system_name ON system_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_system_timestamp ON system_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_log(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
EOF

# Ejecutar migración en producción
wrangler d1 migrations apply arbitragex-production

# Ejecutar migración en staging
wrangler d1 migrations apply arbitragex-staging --env staging
```

#### 1.3 Seed Data para Producción
```bash
# Crear datos iniciales para producción
cat > seed-production.sql << 'EOF'
-- Admin user inicial
INSERT OR IGNORE INTO users (
    id, email, role, kyc_status, two_factor_enabled, is_active
) VALUES (
    1, 'admin@arbitragex.com', 'admin', 'approved', TRUE, TRUE
);

-- Configuraciones predeterminadas del sistema
INSERT OR IGNORE INTO system_metrics (
    metric_name, metric_value, metric_unit, tags
) VALUES 
    ('system_startup', 1, 'boolean', '{"environment": "production"}'),
    ('initial_deployment', 1, 'boolean', '{"version": "1.0.0"}');

-- Trading pairs principales
INSERT OR IGNORE INTO arbitrage_opportunities (
    token_pair, source_exchange, target_exchange, 
    source_price, target_price, profit_potential, 
    profit_percentage, gas_cost, net_profit, 
    confidence_score, status, detected_at
) VALUES 
    ('ETH/USDC', 'uniswap_v3', 'sushiswap', 
     2450.00, 2450.00, 0.00, 0.00, 15.00, -15.00, 
     0.0000, 'expired', datetime('now', '-1 hour'));
EOF

# Ejecutar seed en producción
wrangler d1 execute arbitragex-production --file=./seed-production.sql

# Verificar datos
wrangler d1 execute arbitragex-production --command="SELECT COUNT(*) as user_count FROM users;"
```

### 2. KV Storage Setup

```bash
# Crear namespaces de KV para producción
wrangler kv:namespace create "CACHE" --env production
wrangler kv:namespace create "CACHE" --preview --env production

# Crear namespaces de KV para staging  
wrangler kv:namespace create "CACHE" --env staging
wrangler kv:namespace create "CACHE" --preview --env staging

# Configurar datos iniciales en KV
wrangler kv:key put "config:trading" '{"enabled": true, "max_slippage": 0.5, "default_gas_multiplier": 1.2}' --binding CACHE --env production

wrangler kv:key put "config:risk" '{"max_var_95": 0.05, "max_drawdown": 0.10, "min_liquidity": 10000}' --binding CACHE --env production

wrangler kv:key put "config:system" '{"maintenance_mode": false, "api_rate_limit": 1000, "websocket_enabled": true}' --binding CACHE --env production
```

### 3. R2 Storage Setup

```bash
# Crear buckets de R2
wrangler r2 bucket create arbitragex-production-storage
wrangler r2 bucket create arbitragex-staging-storage

# Configurar CORS para buckets
cat > cors-config.json << 'EOF'
[
  {
    "AllowedOrigins": ["https://arbitragex.com", "https://app.arbitragex.com"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE"],
    "AllowedHeaders": ["*"],
    "ExposedHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
EOF

# Aplicar configuración CORS
wrangler r2 bucket cors put arbitragex-production-storage --file cors-config.json
```

## 🏗️ Build y Deploy Process

### 1. Build Optimization

#### 1.1 Configuración de package.json
```json
{
  "scripts": {
    "build": "next build",
    "build:production": "NODE_ENV=production next build",
    "build:staging": "NODE_ENV=staging next build",
    "deploy:staging": "npm run build:staging && wrangler pages deploy dist --project-name arbitragex-supreme-staging",
    "deploy:production": "npm run build:production && wrangler pages deploy dist --project-name arbitragex-supreme-prod",
    "deploy:preview": "wrangler pages deploy dist --project-name arbitragex-supreme-preview",
    "db:migrate:production": "wrangler d1 migrations apply arbitragex-production",
    "db:migrate:staging": "wrangler d1 migrations apply arbitragex-staging --env staging",
    "verify:production": "curl -f https://arbitragex.com/api/health",
    "verify:staging": "curl -f https://staging.arbitragex.com/api/health"
  }
}
```

#### 1.2 Optimización de Build
```typescript
// next.config.js - Optimización para Cloudflare Pages
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  distDir: 'dist',
  trailingSlash: true,
  
  // Optimizaciones para Cloudflare
  experimental: {
    runtime: 'edge',
    serverActions: true
  },
  
  // Configuración de imágenes para Cloudflare
  images: {
    unoptimized: true, // Cloudflare maneja optimización
    loader: 'custom',
    loaderFile: './src/lib/cloudflare-image-loader.ts'
  },
  
  // Optimización de bundle
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        fs: false,
        net: false,
        tls: false
      }
    }
    
    // Optimización de chunks
    config.optimization.splitChunks = {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all'
        },
        common: {
          name: 'common',
          minChunks: 2,
          chunks: 'all',
          enforce: true
        }
      }
    }
    
    return config
  },
  
  // Headers de seguridad
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          }
        ]
      }
    ]
  }
}

module.exports = nextConfig
```

### 2. Scripts de Deployment

#### 2.1 Script de Deployment de Producción
```bash
#!/bin/bash
# deployment/deploy-production.sh

set -e

echo "🚀 Starting ArbitrageX Supreme Production Deployment"

# Verificar prerrequisitos
echo "📋 Checking prerequisites..."
command -v wrangler >/dev/null 2>&1 || { echo "❌ Wrangler CLI not found. Install with: npm install -g wrangler"; exit 1; }
command -v node >/dev/null 2>&1 || { echo "❌ Node.js not found"; exit 1; }

# Verificar autenticación
echo "🔐 Verifying Cloudflare authentication..."
wrangler whoami || { echo "❌ Not authenticated with Cloudflare. Run: wrangler login"; exit 1; }

# Verificar estado de Git
echo "📦 Checking Git status..."
if [ -n "$(git status --porcelain)" ]; then
    echo "❌ Working directory not clean. Commit or stash changes first."
    exit 1
fi

# Verificar rama
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo "⚠️  Warning: Not on main branch. Current branch: $CURRENT_BRANCH"
    read -p "Continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Backup de base de datos
echo "💾 Creating database backup..."
BACKUP_FILE="backup-production-$(date +%Y%m%d-%H%M%S).sql"
wrangler d1 export arbitragex-production > "backups/$BACKUP_FILE"
echo "✅ Database backup created: $BACKUP_FILE"

# Instalar dependencias
echo "📦 Installing dependencies..."
npm ci --production=false

# Ejecutar tests
echo "🧪 Running tests..."
npm run test:ci || { echo "❌ Tests failed. Deployment aborted."; exit 1; }

# Build del proyecto
echo "🏗️  Building project..."
npm run build:production || { echo "❌ Build failed. Deployment aborted."; exit 1; }

# Verificar build
echo "✅ Verifying build..."
if [ ! -d "dist" ]; then
    echo "❌ Build directory not found. Build may have failed."
    exit 1
fi

# Aplicar migraciones de base de datos
echo "🗄️  Applying database migrations..."
wrangler d1 migrations apply arbitragex-production || { 
    echo "❌ Database migration failed. Deployment aborted."
    exit 1
}

# Deploy a Cloudflare Pages
echo "🚀 Deploying to Cloudflare Pages..."
wrangler pages deploy dist --project-name arbitragex-supreme-prod --compatibility-date 2024-12-01 || {
    echo "❌ Deployment failed. Rolling back..."
    # Aquí podrías agregar lógica de rollback si es necesario
    exit 1
}

# Verificar deployment
echo "🔍 Verifying deployment..."
sleep 30  # Esperar a que se propague

# Health check
echo "🩺 Running health checks..."
HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" https://arbitragex.com/api/health)
if [ "$HEALTH_CHECK" != "200" ]; then
    echo "❌ Health check failed. HTTP status: $HEALTH_CHECK"
    echo "🔄 Consider rolling back the deployment"
    exit 1
fi

# Verificar funcionalidad crítica
echo "🧪 Testing critical functionality..."
curl -f https://arbitragex.com/api/trading/opportunities > /dev/null || {
    echo "❌ Critical functionality test failed"
    exit 1
}

# Notificar éxito
echo "✅ Production deployment completed successfully!"
echo "🌐 Application URL: https://arbitragex.com"
echo "📊 Monitor: https://dash.cloudflare.com"

# Crear tag de versión
VERSION_TAG="v$(date +%Y.%m.%d)-$(git rev-parse --short HEAD)"
git tag "$VERSION_TAG"
git push origin "$VERSION_TAG"
echo "🏷️  Version tag created: $VERSION_TAG"

echo "🎉 Deployment completed at $(date)"
```

#### 2.2 Script de Rollback
```bash
#!/bin/bash
# deployment/rollback.sh

set -e

echo "🔄 Starting ArbitrageX Supreme Rollback"

# Verificar último deployment exitoso
echo "📋 Checking previous deployments..."
wrangler pages deployment list --project-name arbitragex-supreme-prod

echo "Please enter the deployment ID to rollback to:"
read -p "Deployment ID: " DEPLOYMENT_ID

if [ -z "$DEPLOYMENT_ID" ]; then
    echo "❌ No deployment ID provided. Rollback aborted."
    exit 1
fi

# Confirmar rollback
echo "⚠️  You are about to rollback production to deployment: $DEPLOYMENT_ID"
read -p "Are you sure? This action cannot be undone. (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Rollback cancelled."
    exit 1
fi

# Ejecutar rollback
echo "🔄 Rolling back to deployment: $DEPLOYMENT_ID"
wrangler pages deployment rollback "$DEPLOYMENT_ID" --project-name arbitragex-supreme-prod

# Verificar rollback
echo "🔍 Verifying rollback..."
sleep 30

HEALTH_CHECK=$(curl -s -o /dev/null -w "%{http_code}" https://arbitragex.com/api/health)
if [ "$HEALTH_CHECK" != "200" ]; then
    echo "❌ Rollback verification failed. HTTP status: $HEALTH_CHECK"
    exit 1
fi

echo "✅ Rollback completed successfully!"
echo "🌐 Application URL: https://arbitragex.com"
```

### 3. Configuración de Dominio Personalizado

#### 3.1 Configurar DNS
```bash
# En Cloudflare DNS, agregar registros:
# CNAME app -> arbitragex-supreme-prod.pages.dev
# CNAME api -> arbitragex-supreme-prod.pages.dev

# Verificar configuración DNS
nslookup app.arbitragex.com
nslookup api.arbitragex.com
```

#### 3.2 Configurar SSL/TLS
```bash
# SSL automático con Cloudflare
# En el dashboard de Cloudflare:
# 1. SSL/TLS -> Overview -> Full (strict)
# 2. SSL/TLS -> Edge Certificates -> Always Use HTTPS: On
# 3. SSL/TLS -> Edge Certificates -> HTTP Strict Transport Security (HSTS): Enable
```

## 📊 Monitoreo y Observabilidad

### 1. Configuración de Analytics

#### 1.1 Cloudflare Analytics
```bash
# Habilitar Web Analytics
wrangler pages analytics enable --project-name arbitragex-supreme-prod

# Configurar Real User Monitoring (RUM)
# Se configura automáticamente con Cloudflare Pages
```

#### 1.2 Custom Metrics
```typescript
// src/lib/analytics.ts - Métricas personalizadas
export class AnalyticsCollector {
  private static instance: AnalyticsCollector
  
  static getInstance(): AnalyticsCollector {
    if (!this.instance) {
      this.instance = new AnalyticsCollector()
    }
    return this.instance
  }
  
  // Métricas de trading
  async trackTradingMetric(metric: string, value: number, tags: Record<string, string> = {}): Promise<void> {
    try {
      // Enviar a Cloudflare Analytics via Workers Analytics Engine
      const datapoint = {
        blobs: [metric],
        doubles: [value],
        indexes: [tags.strategy || 'unknown']
      }
      
      // Usar binding de Analytics Engine si está disponible
      if (typeof ANALYTICS !== 'undefined') {
        await ANALYTICS.writeDataPoint(datapoint)
      }
    } catch (error) {
      console.error('Failed to track metric:', error)
    }
  }
  
  // Métricas de performance
  async trackPerformance(route: string, duration: number, status: number): Promise<void> {
    await this.trackTradingMetric('api_response_time', duration, {
      route,
      status: status.toString()
    })
  }
  
  // Métricas de errores
  async trackError(error: Error, context: Record<string, any> = {}): Promise<void> {
    await this.trackTradingMetric('error_count', 1, {
      error_type: error.name,
      message: error.message.substring(0, 100),
      ...context
    })
  }
}
```

### 2. Configuración de Logs

#### 2.1 Structured Logging
```typescript
// src/lib/logger.ts - Sistema de logging estructurado
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4
}

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  component: string
  traceId?: string
  userId?: string
  metadata?: Record<string, any>
}

export class Logger {
  private static instance: Logger
  private minLevel: LogLevel = LogLevel.INFO
  
  static getInstance(): Logger {
    if (!this.instance) {
      this.instance = new Logger()
    }
    return this.instance
  }
  
  constructor() {
    // Configurar nivel basado en entorno
    if (process.env.NODE_ENV === 'development') {
      this.minLevel = LogLevel.DEBUG
    } else if (process.env.LOG_LEVEL) {
      this.minLevel = LogLevel[process.env.LOG_LEVEL as keyof typeof LogLevel] || LogLevel.INFO
    }
  }
  
  private log(level: LogLevel, message: string, component: string, metadata?: Record<string, any>): void {
    if (level < this.minLevel) return
    
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      component,
      metadata
    }
    
    // En desarrollo, log a consola con formato legible
    if (process.env.NODE_ENV === 'development') {
      const levelName = LogLevel[level]
      console.log(`[${entry.timestamp}] ${levelName} ${component}: ${message}`, metadata || '')
    } else {
      // En producción, log estructurado
      console.log(JSON.stringify(entry))
    }
  }
  
  debug(message: string, component: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, component, metadata)
  }
  
  info(message: string, component: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, component, metadata)
  }
  
  warn(message: string, component: string, metadata?: Record<string, any>): void {
    this.log(LogLevel.WARN, message, component, metadata)
  }
  
  error(message: string, component: string, error?: Error, metadata?: Record<string, any>): void {
    const logMetadata = {
      ...metadata,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined
    }
    this.log(LogLevel.ERROR, message, component, logMetadata)
  }
}

// Export singleton
export const logger = Logger.getInstance()
```

## 🔐 Seguridad en Producción

### 1. Headers de Seguridad
```typescript
// src/middleware/security.ts - Headers de seguridad
export function securityHeaders(): Headers {
  const headers = new Headers()
  
  // Prevenir clickjacking
  headers.set('X-Frame-Options', 'DENY')
  
  // Prevenir MIME type sniffing
  headers.set('X-Content-Type-Options', 'nosniff')
  
  // XSS Protection
  headers.set('X-XSS-Protection', '1; mode=block')
  
  // Referrer Policy
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  
  // Content Security Policy
  headers.set('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
    "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' https: wss: ws:",
    "media-src 'self'",
    "object-src 'none'",
    "child-src 'none'",
    "worker-src 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'"
  ].join('; '))
  
  // HSTS (Handled by Cloudflare in production)
  if (process.env.NODE_ENV === 'production') {
    headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  }
  
  // Feature Policy / Permissions Policy
  headers.set('Permissions-Policy', [
    'camera=()',
    'microphone=()',
    'geolocation=self',
    'payment=self',
    'usb=()',
    'magnetometer=()',
    'accelerometer=()',
    'gyroscope=()'
  ].join(', '))
  
  return headers
}
```

### 2. Rate Limiting
```typescript
// src/lib/rate-limiter.ts - Rate limiting para APIs
interface RateLimitConfig {
  windowMs: number
  maxRequests: number
  keyGenerator: (request: Request) => string
}

export class RateLimiter {
  private cache: Map<string, { count: number; resetTime: number }> = new Map()
  
  constructor(private config: RateLimitConfig) {}
  
  async isAllowed(request: Request): Promise<{ allowed: boolean; resetTime: number; remaining: number }> {
    const key = this.config.keyGenerator(request)
    const now = Date.now()
    const windowStart = now - this.config.windowMs
    
    // Limpiar entradas expiradas
    for (const [k, v] of this.cache.entries()) {
      if (v.resetTime < now) {
        this.cache.delete(k)
      }
    }
    
    let bucket = this.cache.get(key)
    if (!bucket || bucket.resetTime < now) {
      bucket = {
        count: 0,
        resetTime: now + this.config.windowMs
      }
      this.cache.set(key, bucket)
    }
    
    const allowed = bucket.count < this.config.maxRequests
    if (allowed) {
      bucket.count++
    }
    
    return {
      allowed,
      resetTime: bucket.resetTime,
      remaining: Math.max(0, this.config.maxRequests - bucket.count)
    }
  }
}

// Rate limiters específicos
export const apiRateLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutos
  maxRequests: 1000, // 1000 requests por 15 minutos
  keyGenerator: (request) => {
    const cf = request.cf as any
    return cf?.connecting_ip || 'unknown'
  }
})

export const tradingRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minuto
  maxRequests: 60, // 60 trades por minuto
  keyGenerator: (request) => {
    // Usar API key o user ID para trading
    const apiKey = request.headers.get('X-API-Key')
    return apiKey || 'anonymous'
  }
})
```

## 🎯 Verificación Post-Deployment

### 1. Health Checks Automatizados
```bash
#!/bin/bash
# deployment/verify-deployment.sh

echo "🔍 Verifying ArbitrageX Supreme Deployment"

# Health Check básico
echo "1. Basic Health Check..."
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" https://arbitragex.com/api/health)
if [ "$HEALTH" != "200" ]; then
    echo "❌ Health check failed: $HEALTH"
    exit 1
fi
echo "✅ Health check passed"

# API Endpoints
echo "2. Testing API endpoints..."
curl -f -s https://arbitragex.com/api/trading/opportunities > /dev/null || { echo "❌ Trading API failed"; exit 1; }
curl -f -s https://arbitragex.com/api/market/prices > /dev/null || { echo "❌ Market API failed"; exit 1; }
echo "✅ API endpoints working"

# Database connectivity
echo "3. Testing database connectivity..."
DB_TEST=$(curl -s https://arbitragex.com/api/admin/db-health | jq -r '.status')
if [ "$DB_TEST" != "healthy" ]; then
    echo "❌ Database connectivity failed"
    exit 1
fi
echo "✅ Database connectivity verified"

# Performance check
echo "4. Performance verification..."
RESPONSE_TIME=$(curl -o /dev/null -s -w '%{time_total}' https://arbitragex.com)
if (( $(echo "$RESPONSE_TIME > 2.0" | bc -l) )); then
    echo "⚠️  Warning: Response time is slow: ${RESPONSE_TIME}s"
else
    echo "✅ Response time acceptable: ${RESPONSE_TIME}s"
fi

# Security headers
echo "5. Security headers verification..."
SECURITY_HEADERS=$(curl -I -s https://arbitragex.com | grep -c "X-Frame-Options\|X-Content-Type-Options\|Strict-Transport-Security")
if [ "$SECURITY_HEADERS" -lt "3" ]; then
    echo "⚠️  Warning: Some security headers missing"
else
    echo "✅ Security headers present"
fi

echo "✅ Deployment verification completed successfully!"
```

### 2. Monitoring Dashboard
```typescript
// src/pages/admin/deployment-status.tsx
export default function DeploymentStatusPage() {
  const [metrics, setMetrics] = useState(null)
  
  useEffect(() => {
    const checkDeploymentHealth = async () => {
      try {
        const response = await fetch('/api/admin/deployment-health')
        const data = await response.json()
        setMetrics(data)
      } catch (error) {
        console.error('Failed to fetch deployment health:', error)
      }
    }
    
    checkDeploymentHealth()
    const interval = setInterval(checkDeploymentHealth, 30000) // Check every 30s
    
    return () => clearInterval(interval)
  }, [])
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Deployment Status</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatusCard 
          title="API Health"
          status={metrics?.api_health ? 'healthy' : 'unhealthy'}
          value={metrics?.api_response_time + 'ms'}
        />
        <StatusCard 
          title="Database"
          status={metrics?.db_health ? 'connected' : 'disconnected'}
          value={metrics?.db_connections + ' connections'}
        />
        <StatusCard 
          title="Cache"
          status={metrics?.cache_health ? 'operational' : 'down'}
          value={metrics?.cache_hit_rate + '% hit rate'}
        />
      </div>
      
      {/* Más métricas y gráficos */}
    </div>
  )
}
```

Esta guía completa te permitirá desplegar ArbitrageX Supreme de manera segura y eficiente en Cloudflare Pages, siguiendo todas las mejores prácticas para aplicaciones financieras de misión crítica.
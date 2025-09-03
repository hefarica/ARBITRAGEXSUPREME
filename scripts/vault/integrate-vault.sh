#!/bin/bash

# ArbitrageX Supreme - Vault Integration Script  
# Ingenio Pichichi S.A. - Integración de Vault con aplicación existente
# TODO FUNCIONAL - Migración segura de secretos hardcodeados

set -euo pipefail

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔐 ArbitrageX Supreme - Vault Integration${NC}"
echo -e "${BLUE}📋 Ingenio Pichichi S.A. - Migración segura de secretos${NC}"
echo ""

# Configuración
VAULT_KEYS_FILE="/home/user/ARBITRAGEXSUPREME/.vault-keys"
ENV_BACKUP_FILE="/home/user/ARBITRAGEXSUPREME/.env.backup.$(date +%Y%m%d_%H%M%S)"

# Función para logging
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠️  $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ❌ $1${NC}"
}

# Verificar que Vault esté configurado
if [[ ! -f $VAULT_KEYS_FILE ]]; then
    error "Vault no está inicializado. Ejecuta primero: ./scripts/vault/init-vault.sh"
    exit 1
fi

log "Cargando configuración de Vault..."
source $VAULT_KEYS_FILE

# Verificar conexión con Vault
if ! vault status > /dev/null 2>&1; then
    warn "Vault no está corriendo. Iniciando Vault..."
    vault server -config=/home/user/ARBITRAGEXSUPREME/config/vault/vault-config.hcl &
    VAULT_PID=$!
    sleep 5
    
    if ! vault status > /dev/null 2>&1; then
        error "No se pudo iniciar Vault"
        kill $VAULT_PID 2>/dev/null || true
        exit 1
    fi
fi

log "✅ Vault está corriendo y accesible"

# Crear backup del archivo .env actual
if [[ -f /home/user/ARBITRAGEXSUPREME/.env ]]; then
    log "Creando backup de .env actual..."
    cp /home/user/ARBITRAGEXSUPREME/.env $ENV_BACKUP_FILE
    log "Backup guardado en: $ENV_BACKUP_FILE"
fi

# Migrar secretos desde archivos .env a Vault
log "🔄 Migrando secretos a Vault..."

# Función para migrar un secreto específico
migrate_secret() {
    local env_var="$1"
    local vault_path="$2" 
    local vault_key="$3"
    local current_value="${!env_var:-}"
    
    if [[ -n "$current_value" && "$current_value" != "REPLACE_WITH_REAL_"* ]]; then
        log "Migrando $env_var -> $vault_path/$vault_key"
        
        # Obtener secreto existente o crear estructura vacía
        existing_secret=$(vault kv get -format=json "secret/$vault_path" 2>/dev/null || echo '{"data":{"data":{}}}')
        
        # Agregar nueva clave al secreto existente
        echo "$existing_secret" | jq --arg key "$vault_key" --arg value "$current_value" \
            '.data.data[$key] = $value' | \
        vault kv put "secret/$vault_path" -
        
        log "✅ $env_var migrado exitosamente"
    else
        warn "⏭️  Saltando $env_var (valor placeholder o vacío)"
    fi
}

# Migrar variables de entorno específicas
if [[ -f /home/user/ARBITRAGEXSUPREME/.env ]]; then
    # Cargar variables del archivo .env
    set -a
    source /home/user/ARBITRAGEXSUPREME/.env 2>/dev/null || true
    set +a
    
    # Migrar secretos blockchain
    migrate_secret "ETHEREUM_RPC_URL" "blockchain/ethereum" "rpc_url"
    migrate_secret "ETHEREUM_PRIVATE_KEY" "blockchain/ethereum" "private_key"
    migrate_secret "POLYGON_RPC_URL" "blockchain/polygon" "rpc_url"
    migrate_secret "POLYGON_PRIVATE_KEY" "blockchain/polygon" "private_key"
    migrate_secret "ARBITRUM_RPC_URL" "blockchain/arbitrum" "rpc_url"
    migrate_secret "OPTIMISM_RPC_URL" "blockchain/optimism" "rpc_url"
    migrate_secret "BASE_RPC_URL" "blockchain/base" "rpc_url"
    
    # Migrar API keys
    migrate_secret "ALCHEMY_API_KEY" "api-keys/external" "alchemy_key"
    migrate_secret "INFURA_PROJECT_ID" "api-keys/external" "infura_key"
    migrate_secret "MORALIS_API_KEY" "api-keys/external" "moralis_key"
    migrate_secret "COINGECKO_API_KEY" "api-keys/external" "coingecko_key"
    
    # Migrar configuración de base de datos
    migrate_secret "DATABASE_URL" "database/primary" "url"
    migrate_secret "DB_PASSWORD" "database/primary" "password"
    
    # Migrar claves de seguridad
    migrate_secret "JWT_SECRET" "security/tokens" "jwt_secret"
    migrate_secret "ENCRYPTION_KEY" "security/tokens" "encryption_key"
    migrate_secret "API_SECRET_KEY" "security/tokens" "api_secret"
    
    # Migrar configuración MEV
    migrate_secret "FLASHBOTS_SIGNATURE_KEY" "mev/flashbots" "signature_key"
    
    # Migrar webhooks
    migrate_secret "DISCORD_WEBHOOK_URL" "webhooks/notifications" "discord_url"
    migrate_secret "SLACK_WEBHOOK_URL" "webhooks/notifications" "slack_url"
fi

log "🔧 Actualizando archivos de configuración..."

# Crear nuevo archivo .env que use Vault
cat > /home/user/ARBITRAGEXSUPREME/.env << EOF
# ArbitrageX Supreme - Environment Configuration with Vault
# Ingenio Pichichi S.A. - Variables de entorno con Vault integration

# ============================================================================
# VAULT CONFIGURATION
# ============================================================================
VAULT_ADDR=http://127.0.0.1:8200
VAULT_TOKEN=${VAULT_TOKEN}

# ============================================================================
# APPLICATION CONFIGURATION
# ============================================================================
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# ============================================================================  
# PUBLIC CONFIGURATION (no secretos)
# ============================================================================
NEXT_PUBLIC_APP_NAME="ArbitrageX Supreme"
NEXT_PUBLIC_NETWORK_MODE=mainnet

# ============================================================================
# FALLBACK CONFIGURATION (solo para desarrollo)
# ============================================================================
# Estas variables solo se usan si Vault no está disponible
DATABASE_URL_FALLBACK=postgresql://localhost:5432/arbitragex_dev
ETHEREUM_RPC_URL_FALLBACK=https://eth-mainnet.alchemyapi.io/v2/demo

# ============================================================================
# IMPORTANT NOTES:
# 
# - Todos los secretos ahora se obtienen desde Vault
# - Las variables FALLBACK solo se usan en desarrollo si Vault falla
# - Nunca commitear este archivo si contiene valores reales
# - En producción, usar variables de entorno del sistema para VAULT_TOKEN
# 
# ============================================================================
EOF

# Actualizar scripts para usar Vault
log "📝 Actualizando scripts de la aplicación..."

# Crear script helper para obtener secretos
cat > /home/user/ARBITRAGEXSUPREME/scripts/get-secret.sh << 'EOF'
#!/bin/bash
# Helper script para obtener secretos desde Vault

VAULT_PATH="$1"
VAULT_KEY="$2"
FALLBACK_ENV="$3"

if [[ -z "$VAULT_PATH" || -z "$VAULT_KEY" ]]; then
    echo "Uso: $0 <vault_path> <vault_key> [fallback_env_var]"
    exit 1
fi

# Cargar configuración de Vault
if [[ -f /home/user/ARBITRAGEXSUPREME/.vault-keys ]]; then
    source /home/user/ARBITRAGEXSUPREME/.vault-keys
fi

# Obtener secreto desde Vault
SECRET_VALUE=$(vault kv get -field="$VAULT_KEY" "secret/$VAULT_PATH" 2>/dev/null)

if [[ -n "$SECRET_VALUE" ]]; then
    echo "$SECRET_VALUE"
else
    # Fallback a variable de entorno
    if [[ -n "$FALLBACK_ENV" ]]; then
        echo "${!FALLBACK_ENV:-}"
    fi
fi
EOF

chmod +x /home/user/ARBITRAGEXSUPREME/scripts/get-secret.sh

# Actualizar package.json para incluir scripts Vault
log "📦 Actualizando package.json con scripts Vault..."

# Agregar scripts Vault al package.json
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

pkg.scripts = {
  ...pkg.scripts,
  'vault:init': 'bash scripts/vault/init-vault.sh',
  'vault:start': 'vault server -config=config/vault/vault-config.hcl',
  'vault:status': 'vault status',
  'vault:ui': 'open http://localhost:8200/ui',
  'vault:backup': 'vault read -format=json secret/metadata | jq . > vault-backup.json',
  'vault:migrate': 'bash scripts/vault/integrate-vault.sh',
  'secrets:get': 'bash scripts/get-secret.sh'
};

fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
console.log('✅ package.json actualizado con scripts Vault');
"

log "✅ Integración de Vault completada exitosamente"
log ""
log "📋 SIGUIENTES PASOS:"
log "  1. Verificar que todos los secretos fueron migrados: vault kv list secret/"
log "  2. Actualizar aplicación para usar VaultClient en lugar de process.env"
log "  3. Probar la aplicación con: npm run dev"
log "  4. Para producción, configurar VAULT_TOKEN como variable de entorno del sistema"
log ""
log "🔧 SCRIPTS DISPONIBLES:"
log "  npm run vault:status    - Verificar estado de Vault"
log "  npm run vault:ui        - Abrir UI de Vault"
log "  npm run secrets:get     - Obtener secreto específico"
log ""
warn "⚠️  IMPORTANTE:"
warn "  - El backup del .env anterior está en: $ENV_BACKUP_FILE"
warn "  - Vault debe estar corriendo para que la aplicación funcione"
warn "  - Configurar monitoreo de Vault en producción"
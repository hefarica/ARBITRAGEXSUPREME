#!/bin/bash

# ArbitrageX Supreme - HashiCorp Vault Initialization Script
# Ingenio Pichichi S.A. - Setup automático de Vault
# Metodología: Cumplidor, disciplinado, organizado

set -euo pipefail

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuración
VAULT_ADDR="http://127.0.0.1:8200"
VAULT_CONFIG="/home/user/ARBITRAGEXSUPREME/config/vault/vault-config.hcl"
VAULT_DATA_DIR="/opt/vault/data"
VAULT_LOGS_DIR="/opt/vault/logs"
KEYS_FILE="/home/user/ARBITRAGEXSUPREME/.vault-keys"

echo -e "${BLUE}🏛️  ArbitrageX Supreme - HashiCorp Vault Setup${NC}"
echo -e "${BLUE}📋 Ingenio Pichichi S.A. - Gestión empresarial de secretos${NC}"
echo ""

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

# Verificar si Vault está instalado
if ! command -v vault &> /dev/null; then
    log "Instalando HashiCorp Vault..."
    
    # Descargar e instalar Vault (versión enterprise o opensource)
    VAULT_VERSION="1.15.2"
    
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        wget -O- https://apt.releases.hashicorp.com/gpg | gpg --dearmor | sudo tee /usr/share/keyrings/hashicorp-archive-keyring.gpg
        echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
        sudo apt update && sudo apt install vault
    else
        error "Sistema operativo no soportado para instalación automática"
        exit 1
    fi
fi

# Crear directorios necesarios
log "Creando directorios de Vault..."
sudo mkdir -p $VAULT_DATA_DIR
sudo mkdir -p $VAULT_LOGS_DIR
sudo mkdir -p /opt/vault/tls
sudo chown -R $USER:$USER /opt/vault 2>/dev/null || true

# Verificar configuración
if [[ ! -f $VAULT_CONFIG ]]; then
    error "Archivo de configuración no encontrado: $VAULT_CONFIG"
    exit 1
fi

# Iniciar Vault en modo desarrollo para setup inicial
log "Iniciando Vault server..."
vault server -config=$VAULT_CONFIG -dev -dev-root-token-id="arbitragex-dev-token" &
VAULT_PID=$!

# Esperar a que Vault esté listo
sleep 5

# Configurar variables de entorno
export VAULT_ADDR="http://127.0.0.1:8200"
export VAULT_TOKEN="arbitragex-dev-token"

# Verificar estado de Vault
log "Verificando estado de Vault..."
if ! vault status > /dev/null 2>&1; then
    error "Vault no está respondiendo"
    kill $VAULT_PID 2>/dev/null || true
    exit 1
fi

# Habilitar motor de secretos KV v2
log "Habilitando motor de secretos KV v2..."
vault secrets enable -version=2 kv || warn "Motor KV ya habilitado"

# Crear política de ArbitrageX
log "Aplicando políticas de seguridad..."
vault policy write arbitragex-policy /home/user/ARBITRAGEXSUPREME/config/vault/policies/arbitragex-policy.hcl

# Crear token para la aplicación
log "Generando token para aplicación..."
APP_TOKEN=$(vault token create -policy=arbitragex-policy -format=json | jq -r .auth.client_token)

# Almacenar secretos iniciales de ejemplo (NO USAR EN PRODUCCIÓN)
log "Configurando secretos iniciales..."

# Blockchain secrets
vault kv put secret/blockchain/ethereum \
    rpc_url="REPLACE_WITH_REAL_ETHEREUM_RPC" \
    private_key="REPLACE_WITH_REAL_PRIVATE_KEY" \
    api_key="REPLACE_WITH_REAL_API_KEY"

vault kv put secret/blockchain/polygon \
    rpc_url="REPLACE_WITH_REAL_POLYGON_RPC" \
    private_key="REPLACE_WITH_REAL_PRIVATE_KEY" \
    api_key="REPLACE_WITH_REAL_API_KEY"

# API Keys
vault kv put secret/api-keys/external \
    alchemy_key="REPLACE_WITH_REAL_ALCHEMY_KEY" \
    infura_key="REPLACE_WITH_REAL_INFURA_KEY" \
    moralis_key="REPLACE_WITH_REAL_MORALIS_KEY" \
    coingecko_key="REPLACE_WITH_REAL_COINGECKO_KEY"

# Database configuration
vault kv put secret/database/primary \
    url="postgresql://user:password@localhost:5432/arbitragex" \
    username="REPLACE_WITH_REAL_DB_USER" \
    password="REPLACE_WITH_REAL_DB_PASSWORD"

# Security keys
vault kv put secret/security/tokens \
    jwt_secret="REPLACE_WITH_REAL_JWT_SECRET" \
    encryption_key="REPLACE_WITH_REAL_ENCRYPTION_KEY" \
    api_secret="REPLACE_WITH_REAL_API_SECRET"

# MEV configuration
vault kv put secret/mev/flashbots \
    relay_url="https://relay.flashbots.net" \
    signature_key="REPLACE_WITH_REAL_FLASHBOTS_KEY"

# Webhooks
vault kv put secret/webhooks/notifications \
    discord_url="REPLACE_WITH_REAL_DISCORD_WEBHOOK" \
    slack_url="REPLACE_WITH_REAL_SLACK_WEBHOOK" \
    email_api_key="REPLACE_WITH_REAL_EMAIL_API_KEY"

# Guardar información de tokens
log "Guardando información de autenticación..."
cat > $KEYS_FILE << EOF
# ArbitrageX Supreme - Vault Authentication
# KEEP THIS FILE SECURE - DO NOT COMMIT TO GIT

export VAULT_ADDR="http://127.0.0.1:8200"
export VAULT_TOKEN="$APP_TOKEN"

# Root token para administración (SOLO DESARROLLO)
export VAULT_ROOT_TOKEN="arbitragex-dev-token"

# Información del setup
VAULT_SETUP_DATE="$(date)"
VAULT_PID="$VAULT_PID"
EOF

chmod 600 $KEYS_FILE

# Parar el servidor de desarrollo
log "Parando servidor de desarrollo..."
kill $VAULT_PID 2>/dev/null || true
sleep 2

log "✅ Vault setup completado exitosamente"
log "📄 Tokens guardados en: $KEYS_FILE"
log "🔐 Para usar Vault: source $KEYS_FILE"
log ""
warn "⚠️  IMPORTANTE:"
warn "   1. Reemplazar todos los secretos PLACEHOLDER con valores reales"
warn "   2. En producción, usar modo no-dev e inicializar correctamente"
warn "   3. Nunca commitear $KEYS_FILE al repositorio"
warn "   4. Configurar TLS para producción"
warn ""
log "Para iniciar Vault manualmente:"
log "  vault server -config=$VAULT_CONFIG"
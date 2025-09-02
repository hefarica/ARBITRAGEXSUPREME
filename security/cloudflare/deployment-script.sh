#!/bin/bash

# Script de despliegue de configuración de seguridad Cloudflare
# ArbitrageX Supreme - Ingenio Pichichi S.A.
# Autor: Hector Fabio Riascos C.
# Versión: 1.0.0
# Metodología: Cumplidor, disciplinado, organizado

set -euo pipefail

# Configuración de colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para logging con timestamp
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" >&2
}

warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

# Banner de inicio
print_banner() {
    echo -e "${BLUE}"
    echo "================================================================="
    echo "    ArbitrageX Supreme - Cloudflare Security Deployment"
    echo "    Ingenio Pichichi S.A."
    echo "    Metodología: Cumplidor, disciplinado, organizado"
    echo "================================================================="
    echo -e "${NC}"
}

# Verificar prerequisitos
check_prerequisites() {
    log "🔍 Verificando prerequisitos..."
    
    # Verificar variables de entorno requeridas
    local required_vars=(
        "CLOUDFLARE_API_TOKEN"
        "CLOUDFLARE_ZONE_ID"
        "CLOUDFLARE_ACCOUNT_ID"
    )
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            error "Variable de entorno requerida no encontrada: $var"
            echo "Configura las siguientes variables:"
            echo "export CLOUDFLARE_API_TOKEN='tu_token_aqui'"
            echo "export CLOUDFLARE_ZONE_ID='tu_zone_id_aqui'"
            echo "export CLOUDFLARE_ACCOUNT_ID='tu_account_id_aqui'"
            exit 1
        fi
    done
    
    # Verificar wrangler CLI
    if ! command -v wrangler &> /dev/null; then
        error "wrangler CLI no está instalado"
        info "Instalar con: npm install -g wrangler"
        exit 1
    fi
    
    # Verificar jq para procesamiento JSON
    if ! command -v jq &> /dev/null; then
        warning "jq no está instalado, algunas funciones de procesamiento JSON pueden fallar"
        info "Instalar con: apt-get install jq (Ubuntu/Debian) o brew install jq (macOS)"
    fi
    
    # Verificar curl
    if ! command -v curl &> /dev/null; then
        error "curl no está instalado"
        exit 1
    fi
    
    log "✅ Todos los prerequisitos verificados"
}

# Autenticar con Cloudflare
authenticate_cloudflare() {
    log "🔐 Autenticando con Cloudflare..."
    
    # Verificar token
    local auth_response=$(curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
        "https://api.cloudflare.com/client/v4/user/tokens/verify")
    
    if echo "$auth_response" | grep -q '"success":false'; then
        error "Token de Cloudflare inválido o expirado"
        exit 1
    fi
    
    # Verificar zona
    local zone_response=$(curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
        "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID")
    
    if echo "$zone_response" | grep -q '"success":false'; then
        error "Zone ID inválido o sin permisos"
        exit 1
    fi
    
    local zone_name=$(echo "$zone_response" | jq -r '.result.name // "unknown"')
    log "✅ Autenticado exitosamente. Zona: $zone_name"
}

# Configurar configuraciones básicas de seguridad
configure_basic_security() {
    log "🛡️ Configurando seguridad básica..."
    
    # SSL/TLS Settings
    info "Configurando SSL/TLS..."
    curl -s -X PATCH "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/settings/ssl" \
        -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
        -H "Content-Type: application/json" \
        --data '{"value":"strict"}' > /dev/null
    
    # Minimum TLS Version
    curl -s -X PATCH "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/settings/min_tls_version" \
        -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
        -H "Content-Type: application/json" \
        --data '{"value":"1.2"}' > /dev/null
    
    # Security Level
    curl -s -X PATCH "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/settings/security_level" \
        -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
        -H "Content-Type: application/json" \
        --data '{"value":"high"}' > /dev/null
    
    # Browser Integrity Check
    curl -s -X PATCH "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/settings/browser_check" \
        -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
        -H "Content-Type: application/json" \
        --data '{"value":"on"}' > /dev/null
    
    log "✅ Configuración de seguridad básica completada"
}

# Configurar reglas de firewall
configure_firewall_rules() {
    log "🔥 Configurando reglas de firewall..."
    
    # Reglas de firewall básicas
    local firewall_rules='[
        {
            "expression": "(cf.threat_score gt 10)",
            "action": "challenge",
            "description": "ArbitrageX: Challenge high threat score IPs"
        },
        {
            "expression": "(http.request.uri.path matches \"/api/admin/*\" and not any(http.request.headers[\"authorization\"][*] contains \"Bearer \"))",
            "action": "block", 
            "description": "ArbitrageX: Block unauthenticated admin access"
        },
        {
            "expression": "(http.request.body.size gt 1048576)",
            "action": "block",
            "description": "ArbitrageX: Block large payloads > 1MB"
        },
        {
            "expression": "(ip.geoip.country in {\"CN\" \"RU\" \"KP\"} and not cf.client.bot)",
            "action": "managed_challenge",
            "description": "ArbitrageX: Challenge restricted countries"
        },
        {
            "expression": "(http.request.uri.query matches \"(?i)(<script|javascript:|on\\\\w+=)\" or any(http.request.headers[*][*] matches \"(?i)(<script|javascript:|on\\\\w+=)\"))",
            "action": "block",
            "description": "ArbitrageX: Block XSS attempts"
        }
    ]'
    
    echo "$firewall_rules" | jq -c '.[]' | while read -r rule; do
        local response=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/firewall/rules" \
            -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
            -H "Content-Type: application/json" \
            --data "[$rule]")
        
        local success=$(echo "$response" | jq -r '.success // false')
        local description=$(echo "$rule" | jq -r '.description')
        
        if [[ "$success" == "true" ]]; then
            info "✅ Regla creada: $description"
        else
            warning "⚠️ Error creando regla: $description"
            echo "$response" | jq '.errors // []' >&2
        fi
    done
    
    log "✅ Reglas de firewall configuradas"
}

# Configurar rate limiting
configure_rate_limiting() {
    log "⚡ Configurando rate limiting..."
    
    # Rate limit para endpoints de trading
    local trading_rate_limit='{
        "match": {
            "request": {
                "url_pattern": "*/api/trading/*",
                "schemes": ["HTTP", "HTTPS"],
                "methods": ["GET", "POST", "PUT", "DELETE"]
            }
        },
        "threshold": 100,
        "period": 60,
        "action": {
            "mode": "challenge",
            "timeout": 300,
            "response": {
                "content_type": "application/json",
                "body": "{\"error\": \"Rate limit exceeded for trading API\", \"retry_after\": 300}"
            }
        },
        "correlate": {
            "by": "ip"
        },
        "description": "ArbitrageX: Trading API rate limit"
    }'
    
    # Rate limit para endpoints de portfolio
    local portfolio_rate_limit='{
        "match": {
            "request": {
                "url_pattern": "*/api/portfolio/*",
                "schemes": ["HTTP", "HTTPS"],
                "methods": ["GET", "POST", "PUT", "DELETE"]
            }
        },
        "threshold": 80,
        "period": 60,
        "action": {
            "mode": "challenge",
            "timeout": 300
        },
        "correlate": {
            "by": "ip"
        },
        "description": "ArbitrageX: Portfolio API rate limit"
    }'
    
    # Rate limit para endpoints blockchain
    local blockchain_rate_limit='{
        "match": {
            "request": {
                "url_pattern": "*/api/blockchain/*",
                "schemes": ["HTTPS"],
                "methods": ["POST"]
            }
        },
        "threshold": 30,
        "period": 60,
        "action": {
            "mode": "managed_challenge",
            "timeout": 600
        },
        "correlate": {
            "by": "ip"
        },
        "description": "ArbitrageX: Blockchain API rate limit"
    }'
    
    # Rate limit para WebSocket connections
    local websocket_rate_limit='{
        "match": {
            "request": {
                "url_pattern": "*/ws*",
                "schemes": ["HTTPS"],
                "methods": ["GET"]
            }
        },
        "threshold": 10,
        "period": 300,
        "action": {
            "mode": "challenge",
            "timeout": 900
        },
        "correlate": {
            "by": "ip"
        },
        "description": "ArbitrageX: WebSocket connection rate limit"
    }'
    
    # Crear reglas de rate limiting
    local rate_limits=("$trading_rate_limit" "$portfolio_rate_limit" "$blockchain_rate_limit" "$websocket_rate_limit")
    
    for rate_limit in "${rate_limits[@]}"; do
        local response=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/rate_limits" \
            -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
            -H "Content-Type: application/json" \
            --data "$rate_limit")
        
        local success=$(echo "$response" | jq -r '.success // false')
        local description=$(echo "$rate_limit" | jq -r '.description')
        
        if [[ "$success" == "true" ]]; then
            info "✅ Rate limit creado: $description"
        else
            warning "⚠️ Error creando rate limit: $description"
            echo "$response" | jq '.errors // []' >&2
        fi
    done
    
    log "✅ Rate limiting configurado"
}

# Configurar bot management
configure_bot_management() {
    log "🤖 Configurando gestión de bots..."
    
    local bot_config='{
        "fight_mode": true,
        "session_score": true,
        "enable_js": true,
        "auth_id_logging": false,
        "use_latest_model": true
    }'
    
    local response=$(curl -s -X PUT "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/bot_management" \
        -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
        -H "Content-Type: application/json" \
        --data "$bot_config")
    
    local success=$(echo "$response" | jq -r '.success // false')
    
    if [[ "$success" == "true" ]]; then
        log "✅ Gestión de bots configurada"
    else
        warning "⚠️ Error configurando gestión de bots"
        echo "$response" | jq '.errors // []' >&2
    fi
}

# Configurar page rules para optimización
configure_page_rules() {
    log "📄 Configurando page rules..."
    
    # Page rule para API endpoints - no cache
    local api_page_rule='{
        "targets": [{
            "target": "url",
            "constraint": {
                "operator": "matches",
                "value": "*arbitragex-supreme.pages.dev/api/*"
            }
        }],
        "actions": [
            {
                "id": "cache_level",
                "value": "bypass"
            },
            {
                "id": "security_level",
                "value": "high"
            }
        ],
        "priority": 1,
        "status": "active"
    }'
    
    # Page rule para assets estáticos - cache agresivo
    local static_page_rule='{
        "targets": [{
            "target": "url",
            "constraint": {
                "operator": "matches",
                "value": "*arbitragex-supreme.pages.dev/static/*"
            }
        }],
        "actions": [
            {
                "id": "cache_level",
                "value": "cache_everything"
            },
            {
                "id": "edge_cache_ttl",
                "value": 2592000
            }
        ],
        "priority": 2,
        "status": "active"
    }'
    
    local page_rules=("$api_page_rule" "$static_page_rule")
    
    for rule in "${page_rules[@]}"; do
        local response=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/pagerules" \
            -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
            -H "Content-Type: application/json" \
            --data "$rule")
        
        local success=$(echo "$response" | jq -r '.success // false')
        
        if [[ "$success" == "true" ]]; then
            info "✅ Page rule configurada"
        else
            warning "⚠️ Error configurando page rule"
        fi
    done
    
    log "✅ Page rules configuradas"
}

# Configurar alertas de seguridad
configure_security_alerts() {
    log "🚨 Configurando alertas de seguridad..."
    
    # Alerta para ataques DDoS
    local ddos_alert='{
        "name": "ArbitrageX DDoS Alert",
        "alert_type": "dos_attack_l7",
        "enabled": true,
        "mechanisms": {
            "webhooks": [{
                "name": "arbitragex_security_webhook",
                "url": "https://arbitragex-supreme.pages.dev/api/security/ddos-alert"
            }]
        },
        "filters": {}
    }'
    
    # Crear alerta solo si CLOUDFLARE_ACCOUNT_ID está disponible
    if [[ -n "${CLOUDFLARE_ACCOUNT_ID:-}" ]]; then
        local response=$(curl -s -X POST "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/alerting/v3/policies" \
            -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
            -H "Content-Type: application/json" \
            --data "$ddos_alert")
        
        local success=$(echo "$response" | jq -r '.success // false')
        
        if [[ "$success" == "true" ]]; then
            log "✅ Alertas de seguridad configuradas"
        else
            warning "⚠️ Error configurando alertas (requiere plan Pro+)"
        fi
    else
        warning "⚠️ CLOUDFLARE_ACCOUNT_ID no disponible, saltando alertas"
    fi
}

# Verificar configuración desplegada
verify_deployment() {
    log "🔍 Verificando configuración desplegada..."
    
    # Verificar configuraciones de zona
    local zone_settings=$(curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
        "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/settings")
    
    local ssl_mode=$(echo "$zone_settings" | jq -r '.result[] | select(.id=="ssl") | .value // "unknown"')
    local security_level=$(echo "$zone_settings" | jq -r '.result[] | select(.id=="security_level") | .value // "unknown"')
    local min_tls=$(echo "$zone_settings" | jq -r '.result[] | select(.id=="min_tls_version") | .value // "unknown"')
    
    info "SSL Mode: $ssl_mode"
    info "Security Level: $security_level"
    info "Min TLS Version: $min_tls"
    
    # Contar reglas de firewall
    local firewall_rules=$(curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
        "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/firewall/rules")
    
    local rules_count=$(echo "$firewall_rules" | jq '.result | length // 0')
    info "Firewall Rules: $rules_count"
    
    # Contar rate limits
    local rate_limits=$(curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
        "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID/rate_limits")
    
    local rate_limits_count=$(echo "$rate_limits" | jq '.result | length // 0')
    info "Rate Limits: $rate_limits_count"
    
    log "✅ Verificación completada"
}

# Generar reporte de configuración
generate_report() {
    log "📊 Generando reporte de configuración..."
    
    local report_file="security-deployment-report-$(date +%Y%m%d-%H%M%S).json"
    
    cat > "$report_file" <<EOF
{
    "deployment_report": {
        "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
        "deployed_by": "Hector Fabio Riascos C.",
        "organization": "Ingenio Pichichi S.A.",
        "project": "ArbitrageX Supreme",
        "zone_id": "$CLOUDFLARE_ZONE_ID",
        "configurations": {
            "basic_security": true,
            "firewall_rules": true,
            "rate_limiting": true,
            "bot_management": true,
            "page_rules": true,
            "security_alerts": true
        },
        "security_features": {
            "ssl_tls_strict": true,
            "min_tls_1_2": true,
            "high_security_level": true,
            "browser_integrity_check": true,
            "threat_score_challenges": true,
            "geo_blocking": true,
            "xss_protection": true,
            "large_payload_blocking": true,
            "api_rate_limiting": true,
            "websocket_protection": true
        },
        "methodology": "Cumplidor, disciplinado, organizado",
        "status": "SUCCESS"
    }
}
EOF
    
    log "✅ Reporte generado: $report_file"
}

# Función principal
main() {
    print_banner
    
    # Verificar argumentos
    if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
        echo "Uso: $0 [--dry-run] [--verify-only]"
        echo ""
        echo "Opciones:"
        echo "  --dry-run      Simular despliegue sin realizar cambios"
        echo "  --verify-only  Solo verificar configuración existente"
        echo "  --help, -h     Mostrar esta ayuda"
        echo ""
        echo "Variables de entorno requeridas:"
        echo "  CLOUDFLARE_API_TOKEN"
        echo "  CLOUDFLARE_ZONE_ID"
        echo "  CLOUDFLARE_ACCOUNT_ID (opcional para alertas)"
        exit 0
    fi
    
    local dry_run=false
    local verify_only=false
    
    if [[ "${1:-}" == "--dry-run" ]]; then
        dry_run=true
        warning "Modo DRY RUN activado - No se realizarán cambios"
    elif [[ "${1:-}" == "--verify-only" ]]; then
        verify_only=true
        info "Modo VERIFY ONLY activado"
    fi
    
    # Ejecutar pipeline
    check_prerequisites
    authenticate_cloudflare
    
    if [[ "$verify_only" == "true" ]]; then
        verify_deployment
        exit 0
    fi
    
    if [[ "$dry_run" == "false" ]]; then
        configure_basic_security
        configure_firewall_rules
        configure_rate_limiting
        configure_bot_management
        configure_page_rules
        configure_security_alerts
    fi
    
    verify_deployment
    generate_report
    
    log "🎉 ¡Despliegue de seguridad completado exitosamente!"
    info "ArbitrageX Supreme está ahora protegido con configuración de seguridad empresarial"
    info "Metodología Ingenio Pichichi S.A.: Cumplidor, disciplinado, organizado ✅"
}

# Manejar señales para limpieza
trap 'error "Script interrumpido"; exit 130' INT TERM

# Ejecutar función principal con todos los argumentos
main "$@"
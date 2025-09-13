#!/bin/bash
# ================================
# ArbitrageX Supreme V3.0 Entrypoint
# Script de inicialización para Contabo VPS
# ================================

set -e

# Colores para logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función de logging
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ArbitrageX:${NC} $1"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" >&2
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO:${NC} $1"
}

# ================================
# Validaciones Pre-inicio
# ================================

log "Iniciando ArbitrageX Supreme V3.0 Backend Engine"

# Verificar variables de entorno requeridas
check_env_vars() {
    local required_vars=(
        "DATABASE_URL"
        "REDIS_URL" 
        "ARBITRAGEX_ENV"
        "REAL_ONLY_MODE"
    )
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            error "Variable de entorno requerida no encontrada: $var"
            exit 1
        fi
    done
    
    log "Variables de entorno validadas correctamente"
}

# Verificar conectividad de base de datos
check_database() {
    info "Verificando conectividad a PostgreSQL..."
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f "${DATABASE_URL}" >/dev/null 2>&1; then
            log "Conexión a PostgreSQL establecida"
            break
        fi
        
        warn "Intento $attempt/$max_attempts: Esperando PostgreSQL..."
        sleep 2
        ((attempt++))
    done
    
    if [ $attempt -gt $max_attempts ]; then
        error "No se pudo conectar a PostgreSQL después de $max_attempts intentos"
        exit 1
    fi
}

# Verificar conectividad de Redis
check_redis() {
    info "Verificando conectividad a Redis..."
    local max_attempts=15
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if timeout 3 bash -c "</dev/tcp/redis/6379" >/dev/null 2>&1; then
            log "Conexión a Redis establecida"
            break
        fi
        
        warn "Intento $attempt/$max_attempts: Esperando Redis..."
        sleep 1
        ((attempt++))
    done
    
    if [ $attempt -gt $max_attempts ]; then
        error "No se pudo conectar a Redis después de $max_attempts intentos"
        exit 1
    fi
}

# Verificar Anvil-Real
check_anvil_real() {
    info "Verificando Anvil-Real simulation engine..."
    local max_attempts=20
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s -X POST -H "Content-Type: application/json" \
           --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
           "${ANVIL_REAL_URL:-http://anvil-real:8545}" >/dev/null 2>&1; then
            log "Anvil-Real simulation engine conectado"
            break
        fi
        
        warn "Intento $attempt/$max_attempts: Esperando Anvil-Real..."
        sleep 2
        ((attempt++))
    done
    
    if [ $attempt -gt $max_attempts ]; then
        error "No se pudo conectar a Anvil-Real después de $max_attempts intentos"
        exit 1
    fi
}

# ================================
# Inicialización del Sistema
# ================================

# Crear directorios necesarios
setup_directories() {
    log "Configurando directorios del sistema..."
    
    mkdir -p /app/logs/{engine,websocket,metrics}
    mkdir -p /app/data/{cache,temp,backups}
    mkdir -p /app/config/{chains,strategies,tokens}
    
    # Configurar permisos
    chmod 755 /app/logs /app/data /app/config
    chmod -R 644 /app/config/*
    
    log "Directorios configurados correctamente"
}

# Validar configuración Real-Only
validate_real_only() {
    log "Validando política Real-Only..."
    
    if [ "$REAL_ONLY_MODE" != "true" ]; then
        error "REAL_ONLY_MODE debe estar establecido en 'true'"
        error "ArbitrageX Supreme V3.0 opera exclusivamente con datos reales"
        exit 1
    fi
    
    log "Política Real-Only validada ✓"
}

# Inicializar métricas de sistema
init_metrics() {
    log "Inicializando sistema de métricas..."
    
    # Crear archivos de métricas base
    cat > /app/logs/metrics/system.log << EOF
# ArbitrageX Supreme V3.0 - System Metrics
# Timestamp: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
# Real-Only Mode: $REAL_ONLY_MODE
# Max Latency Target: ${MAX_LATENCY_MS:-200}ms
# Environment: $ARBITRAGEX_ENV

arbitragex_startup_time $(date +%s)
arbitragex_real_only_mode 1
arbitragex_target_latency_ms ${MAX_LATENCY_MS:-200}
EOF

    log "Sistema de métricas inicializado"
}

# ================================
# Gestión de Señales
# ================================

# Función de limpieza
cleanup() {
    log "Recibida señal de terminación, limpiando recursos..."
    
    # Enviar señal de terminación al proceso principal
    if [ ! -z "$ENGINE_PID" ]; then
        kill -TERM "$ENGINE_PID" 2>/dev/null || true
        wait "$ENGINE_PID" 2>/dev/null || true
    fi
    
    log "Limpieza completada, terminando..."
    exit 0
}

# Configurar manejo de señales
trap cleanup SIGTERM SIGINT SIGQUIT

# ================================
# Inicio del Motor Principal
# ================================

main() {
    log "=== ArbitrageX Supreme V3.0 Backend Initialization ==="
    
    # Ejecutar validaciones
    check_env_vars
    validate_real_only
    setup_directories
    init_metrics
    
    # Verificar conectividad
    check_database
    check_redis
    check_anvil_real
    
    log "=== Todas las validaciones completadas exitosamente ==="
    log "=== Iniciando ArbitrageX Engine... ==="
    
    # Configurar opciones del engine basadas en argumentos
    ENGINE_ARGS=""
    
    # Procesar argumentos
    while [[ $# -gt 0 ]]; do
        case $1 in
            --mode)
                ENGINE_ARGS="$ENGINE_ARGS --mode $2"
                shift 2
                ;;
            --real-only)
                ENGINE_ARGS="$ENGINE_ARGS --real-only"
                shift
                ;;
            --max-latency)
                ENGINE_ARGS="$ENGINE_ARGS --max-latency $2"
                shift 2
                ;;
            --strategies)
                ENGINE_ARGS="$ENGINE_ARGS --strategies $2"
                shift 2
                ;;
            *)
                ENGINE_ARGS="$ENGINE_ARGS $1"
                shift
                ;;
        esac
    done
    
    # Iniciar el motor principal
    log "Ejecutando: /app/arbitragex-engine $ENGINE_ARGS"
    
    exec /app/arbitragex-engine $ENGINE_ARGS &
    ENGINE_PID=$!
    
    log "ArbitrageX Engine iniciado con PID: $ENGINE_PID"
    log "=== Sistema operativo en modo Real-Only ==="
    log "=== Objetivo de latencia: ${MAX_LATENCY_MS:-200}ms ==="
    
    # Esperar al proceso principal
    wait "$ENGINE_PID"
}

# Ejecutar función principal con todos los argumentos
main "$@"
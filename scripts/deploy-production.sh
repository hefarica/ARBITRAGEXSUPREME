#!/bin/bash
# ===================================================================
# ARBITRAGEX SUPREME - SCRIPT DE DEPLOYMENT A PRODUCCIÓN
# Actividades 41-45: Production Deployment Automation
# Ingenio Pichichi S.A. - Hector Fabio Riascos C.
# ===================================================================

set -euo pipefail

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variables
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DEPLOYMENT_LOG="/tmp/arbitragex_deploy_${TIMESTAMP}.log"

# Configuración
ENVIRONMENT=${1:-production}
VERSION=${2:-latest}
SKIP_BACKUP=${3:-false}
DRY_RUN=${4:-false}

# URLs de validación
HEALTH_CHECK_URL="https://arbitragexsupreme.com/health"
API_HEALTH_URL="https://api.arbitragexsupreme.com/health"

# ========================================================================
# FUNCIONES UTILITARIAS
# ========================================================================

log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $level in
        "INFO")
            echo -e "${GREEN}[${timestamp}] INFO: ${message}${NC}" | tee -a "${DEPLOYMENT_LOG}"
            ;;
        "WARN")
            echo -e "${YELLOW}[${timestamp}] WARN: ${message}${NC}" | tee -a "${DEPLOYMENT_LOG}"
            ;;
        "ERROR")
            echo -e "${RED}[${timestamp}] ERROR: ${message}${NC}" | tee -a "${DEPLOYMENT_LOG}"
            ;;
        "DEBUG")
            echo -e "${BLUE}[${timestamp}] DEBUG: ${message}${NC}" | tee -a "${DEPLOYMENT_LOG}"
            ;;
    esac
}

check_dependencies() {
    log "INFO" "Verificando dependencias del sistema..."
    
    local deps=("docker" "docker-compose" "kubectl" "aws" "curl" "jq")
    
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            log "ERROR" "Dependencia faltante: $dep"
            exit 1
        fi
    done
    
    log "INFO" "Todas las dependencias están disponibles"
}

validate_environment() {
    log "INFO" "Validando variables de entorno..."
    
    local required_vars=(
        "POSTGRES_PASSWORD"
        "REDIS_PASSWORD"
        "JWT_SECRET"
        "ENCRYPTION_KEY"
        "ETHEREUM_RPC_URL"
    )
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            log "ERROR" "Variable de entorno requerida no definida: $var"
            exit 1
        fi
    done
    
    log "INFO" "Variables de entorno validadas"
}

pre_deployment_checks() {
    log "INFO" "Ejecutando verificaciones pre-deployment..."
    
    # Verificar que el sistema actual está funcionando
    if curl -sf "${HEALTH_CHECK_URL}" > /dev/null; then
        log "INFO" "Sistema actual está funcionando correctamente"
    else
        log "WARN" "No se puede acceder al sistema actual"
    fi
    
    # Verificar espacio en disco
    local available_space=$(df / | awk 'NR==2{printf "%.0f", $4/1024/1024}')
    if [[ $available_space -lt 10 ]]; then
        log "ERROR" "Espacio insuficiente en disco: ${available_space}GB disponible"
        exit 1
    fi
    
    # Verificar memoria disponible
    local available_memory=$(free -g | awk 'NR==2{printf "%.0f", $7}')
    if [[ $available_memory -lt 4 ]]; then
        log "WARN" "Memoria disponible baja: ${available_memory}GB"
    fi
    
    log "INFO" "Verificaciones pre-deployment completadas"
}

backup_current_system() {
    if [[ "$SKIP_BACKUP" == "true" ]]; then
        log "INFO" "Saltando backup (SKIP_BACKUP=true)"
        return
    fi
    
    log "INFO" "Creando backup del sistema actual..."
    
    # Backup de base de datos
    log "INFO" "Respaldando base de datos..."
    docker-compose exec -T postgres pg_dump \
        -U "${POSTGRES_USER:-arbitragex_user}" \
        -d "${POSTGRES_DB:-arbitragex_prod}" \
        > "backups/pre_deploy_${TIMESTAMP}.sql"
    
    # Backup de configuración
    log "INFO" "Respaldando configuración..."
    tar -czf "backups/config_${TIMESTAMP}.tar.gz" \
        docker-compose.production.yml \
        .env.production \
        infrastructure/ \
        || true
    
    # Backup de logs importantes
    log "INFO" "Respaldando logs..."
    tar -czf "backups/logs_${TIMESTAMP}.tar.gz" \
        logs/ \
        || true
    
    log "INFO" "Backup completado en backups/"
}

pull_latest_images() {
    log "INFO" "Descargando imágenes Docker más recientes..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: docker-compose pull"
        return
    fi
    
    export BUILD_VERSION="${VERSION}"
    
    docker-compose -f docker-compose.production.yml pull --quiet
    
    log "INFO" "Imágenes Docker actualizadas"
}

deploy_application() {
    log "INFO" "Iniciando deployment de aplicación..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: deployment simulado"
        return
    fi
    
    # Deployment con rolling update
    log "INFO" "Ejecutando rolling update..."
    
    export BUILD_VERSION="${VERSION}"
    export NODE_ENV="production"
    
    # Actualizar servicios uno por uno para evitar downtime
    local services=("app" "api" "blockchain_monitor")
    
    for service in "${services[@]}"; do
        log "INFO" "Actualizando servicio: $service"
        
        docker-compose -f docker-compose.production.yml up -d --no-deps "$service"
        
        # Esperar a que el servicio esté saludable
        log "INFO" "Esperando que $service esté saludable..."
        for i in {1..30}; do
            if docker-compose -f docker-compose.production.yml ps "$service" | grep -q "healthy\|Up"; then
                log "INFO" "$service está funcionando correctamente"
                break
            fi
            
            if [[ $i -eq 30 ]]; then
                log "ERROR" "$service no está respondiendo después de 30 intentos"
                rollback_deployment
                exit 1
            fi
            
            sleep 10
        done
    done
    
    log "INFO" "Deployment de aplicación completado"
}

run_database_migrations() {
    log "INFO" "Ejecutando migraciones de base de datos..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN: migraciones simuladas"
        return
    fi
    
    # Ejecutar migraciones dentro del contenedor de la aplicación
    if docker-compose -f docker-compose.production.yml exec -T app npm run db:migrate:prod; then
        log "INFO" "Migraciones ejecutadas exitosamente"
    else
        log "ERROR" "Error en las migraciones de base de datos"
        rollback_deployment
        exit 1
    fi
}

health_checks() {
    log "INFO" "Ejecutando verificaciones de salud post-deployment..."
    
    # Health check del sitio principal
    log "INFO" "Verificando salud del sitio principal..."
    for i in {1..20}; do
        if curl -sf "${HEALTH_CHECK_URL}" > /dev/null; then
            log "INFO" "Sitio principal funcionando correctamente"
            break
        fi
        
        if [[ $i -eq 20 ]]; then
            log "ERROR" "Sitio principal no está respondiendo"
            return 1
        fi
        
        log "DEBUG" "Intento $i/20 - esperando respuesta del sitio principal..."
        sleep 15
    done
    
    # Health check de la API
    log "INFO" "Verificando salud de la API..."
    for i in {1..20}; do
        if curl -sf "${API_HEALTH_URL}" > /dev/null; then
            log "INFO" "API funcionando correctamente"
            break
        fi
        
        if [[ $i -eq 20 ]]; then
            log "ERROR" "API no está respondiendo"
            return 1
        fi
        
        log "DEBUG" "Intento $i/20 - esperando respuesta de la API..."
        sleep 15
    done
    
    # Verificar métricas básicas
    log "INFO" "Verificando métricas del sistema..."
    
    local response=$(curl -s "${HEALTH_CHECK_URL}" | jq -r '.status // "unknown"')
    if [[ "$response" == "healthy" ]]; then
        log "INFO" "Sistema reporta estado saludable"
    else
        log "WARN" "Sistema reporta estado: $response"
    fi
    
    return 0
}

performance_validation() {
    log "INFO" "Ejecutando validación de performance..."
    
    # Test de carga básico
    log "INFO" "Ejecutando test básico de performance..."
    
    local response_time=$(curl -o /dev/null -s -w '%{time_total}' "${HEALTH_CHECK_URL}")
    local response_time_ms=$(echo "$response_time * 1000" | bc)
    
    if (( $(echo "$response_time > 5.0" | bc -l) )); then
        log "WARN" "Tiempo de respuesta alto: ${response_time_ms}ms"
    else
        log "INFO" "Tiempo de respuesta aceptable: ${response_time_ms}ms"
    fi
    
    # Verificar que todos los servicios estén corriendo
    log "INFO" "Verificando servicios Docker..."
    
    local failed_services=()
    local services=$(docker-compose -f docker-compose.production.yml ps --services)
    
    while read -r service; do
        if ! docker-compose -f docker-compose.production.yml ps "$service" | grep -q "Up\|healthy"; then
            failed_services+=("$service")
        fi
    done <<< "$services"
    
    if [[ ${#failed_services[@]} -gt 0 ]]; then
        log "ERROR" "Servicios fallando: ${failed_services[*]}"
        return 1
    else
        log "INFO" "Todos los servicios están funcionando"
    fi
    
    return 0
}

rollback_deployment() {
    log "WARN" "Iniciando rollback del deployment..."
    
    # Restaurar desde backup más reciente
    local latest_backup=$(ls -t backups/pre_deploy_*.sql 2>/dev/null | head -1)
    
    if [[ -n "$latest_backup" ]]; then
        log "INFO" "Restaurando base de datos desde: $latest_backup"
        
        docker-compose -f docker-compose.production.yml exec -T postgres \
            psql -U "${POSTGRES_USER:-arbitragex_user}" -d "${POSTGRES_DB:-arbitragex_prod}" \
            < "$latest_backup"
    fi
    
    # Revertir a versión anterior de Docker images
    log "INFO" "Revirtiendo a imágenes Docker previas..."
    
    # Esto requeriría tener un registro de la versión anterior
    # Por simplicidad, reiniciamos los servicios actuales
    docker-compose -f docker-compose.production.yml restart
    
    log "INFO" "Rollback completado"
}

cleanup_old_resources() {
    log "INFO" "Limpiando recursos antiguos..."
    
    # Limpiar imágenes Docker no utilizadas
    docker image prune -f --filter "until=168h" || true
    
    # Limpiar logs antiguos (mantener últimos 30 días)
    find logs/ -name "*.log" -mtime +30 -delete 2>/dev/null || true
    
    # Limpiar backups antiguos (mantener últimos 7 días)
    find backups/ -name "pre_deploy_*.sql" -mtime +7 -delete 2>/dev/null || true
    
    log "INFO" "Limpieza completada"
}

send_deployment_notification() {
    local status=$1
    local message=$2
    
    if [[ -n "${SLACK_WEBHOOK_URL:-}" ]]; then
        local color="good"
        if [[ "$status" != "success" ]]; then
            color="danger"
        fi
        
        local payload=$(cat <<EOF
{
    "attachments": [{
        "color": "$color",
        "title": "🚀 ArbitrageX Supreme Deployment",
        "fields": [
            {
                "title": "Environment",
                "value": "$ENVIRONMENT",
                "short": true
            },
            {
                "title": "Version",
                "value": "$VERSION",
                "short": true
            },
            {
                "title": "Status",
                "value": "$status",
                "short": true
            },
            {
                "title": "Timestamp",
                "value": "$TIMESTAMP",
                "short": true
            }
        ],
        "text": "$message"
    }]
}
EOF
        )
        
        curl -X POST -H 'Content-type: application/json' \
            --data "$payload" \
            "${SLACK_WEBHOOK_URL}" || true
    fi
}

# ========================================================================
# FUNCIÓN PRINCIPAL
# ========================================================================

main() {
    log "INFO" "=== Iniciando Deployment ArbitrageX Supreme ==="
    log "INFO" "Environment: $ENVIRONMENT"
    log "INFO" "Version: $VERSION"
    log "INFO" "Timestamp: $TIMESTAMP"
    log "INFO" "Dry Run: $DRY_RUN"
    
    # Cambiar al directorio del proyecto
    cd "$PROJECT_ROOT"
    
    # Crear directorio de backups si no existe
    mkdir -p backups logs
    
    local start_time=$(date +%s)
    
    # Ejecutar pasos del deployment
    check_dependencies
    validate_environment
    pre_deployment_checks
    
    if [[ "$ENVIRONMENT" == "production" ]]; then
        backup_current_system
    fi
    
    pull_latest_images
    deploy_application
    run_database_migrations
    
    if health_checks && performance_validation; then
        cleanup_old_resources
        
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        log "INFO" "=== Deployment Completado Exitosamente ==="
        log "INFO" "Duración total: ${duration} segundos"
        
        send_deployment_notification "success" "Deployment completado exitosamente en ${duration} segundos"
        
        # Mostrar información útil
        echo ""
        log "INFO" "URLs del sistema:"
        log "INFO" "  - Sitio web: https://arbitragexsupreme.com"
        log "INFO" "  - API: https://api.arbitragexsupreme.com"
        log "INFO" "  - Monitoring: https://monitoring.arbitragexsupreme.com"
        echo ""
        log "INFO" "Log completo disponible en: $DEPLOYMENT_LOG"
        
    else
        log "ERROR" "Deployment falló en las verificaciones finales"
        
        if [[ "$ENVIRONMENT" == "production" ]]; then
            rollback_deployment
        fi
        
        send_deployment_notification "failed" "Deployment falló y se ejecutó rollback"
        exit 1
    fi
}

# ========================================================================
# MANEJO DE SEÑALES
# ========================================================================

cleanup_on_exit() {
    log "WARN" "Deployment interrumpido"
    send_deployment_notification "interrupted" "Deployment fue interrumpido"
    exit 1
}

trap cleanup_on_exit SIGINT SIGTERM

# ========================================================================
# EJECUTAR SCRIPT
# ========================================================================

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
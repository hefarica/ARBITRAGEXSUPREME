#!/bin/bash

# ArbitrageX Pro 2025 - Service Monitor Script
# Monitoreo preventivo para evitar caídas del servicio

set -e

WEBAPP_DIR="/home/user/webapp"
SERVICE_NAME="arbitragex-web"
SERVICE_PORT=3000
LOG_FILE="$WEBAPP_DIR/monitor.log"

# Función de logging
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Verificar si el servicio está respondiendo
check_service_health() {
    local response_code
    response_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "http://localhost:$SERVICE_PORT/api/diagnostics" 2>/dev/null)
    
    if [ "$response_code" = "200" ]; then
        return 0
    else
        log "❌ Service health check failed - HTTP code: $response_code"
        return 1
    fi
}

# Verificar si PM2 reporta el servicio como online
check_pm2_status() {
    local pm2_status
    pm2_status=$(pm2 jlist 2>/dev/null | jq -r ".[] | select(.name==\"$SERVICE_NAME\") | .pm2_env.status" 2>/dev/null)
    
    if [ "$pm2_status" = "online" ]; then
        return 0
    else
        log "❌ PM2 status check failed - Status: $pm2_status"
        return 1
    fi
}

# Reiniciar servicio si está caído
restart_service() {
    log "🔄 Reiniciando servicio $SERVICE_NAME..."
    
    cd "$WEBAPP_DIR"
    
    # Limpiar puerto
    fuser -k $SERVICE_PORT/tcp 2>/dev/null || true
    
    # Reiniciar PM2
    pm2 delete all 2>/dev/null || true
    sleep 2
    
    pm2 start ecosystem.config.cjs --only "$SERVICE_NAME"
    
    # Esperar que el servicio esté listo
    local attempts=0
    local max_attempts=30
    
    while [ $attempts -lt $max_attempts ]; do
        if check_service_health; then
            log "✅ Servicio reiniciado correctamente"
            return 0
        fi
        
        attempts=$((attempts + 1))
        log "⏳ Esperando que el servicio esté listo... ($attempts/$max_attempts)"
        sleep 5
    done
    
    log "❌ Falló el reinicio del servicio después de $max_attempts intentos"
    return 1
}

# Función principal de monitoreo
monitor_service() {
    log "🔍 Iniciando verificación de salud del servicio..."
    
    if check_pm2_status && check_service_health; then
        log "✅ Servicio funcionando correctamente"
        return 0
    else
        log "⚠️ Servicio no responde - Iniciando recuperación automática"
        restart_service
        return $?
    fi
}

# Ejecutar monitoreo
monitor_service
exit $?
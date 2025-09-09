#!/bin/bash
# ================================
# ArbitrageX Supreme V3.0 - Contabo VPS Deploy Script
# Script de deployment para servidor Contabo
# ================================

set -e

# Configuración de colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Variables de configuración
CONTABO_HOST="${CONTABO_HOST:-your-server.contabo.com}"
CONTABO_USER="${CONTABO_USER:-root}"
CONTABO_PORT="${CONTABO_PORT:-22}"
PROJECT_NAME="arbitragex-supreme"
DEPLOY_PATH="/opt/arbitragex-supreme"
BACKUP_PATH="/opt/backups/arbitragex-supreme"

# Funciones de logging
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] DEPLOY:${NC} $1"
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

section() {
    echo -e "${CYAN}===============================================${NC}"
    echo -e "${CYAN} $1${NC}"
    echo -e "${CYAN}===============================================${NC}"
}

# ================================
# Validaciones Pre-deployment
# ================================

validate_environment() {
    section "Validando Entorno de Deployment"
    
    # Verificar variables requeridas
    local required_vars=(
        "CONTABO_HOST"
        "POSTGRES_PASSWORD"
        "GRAFANA_PASSWORD"
        "FLASH_LOAN_PROVIDERS"
        "BLOCKCHAIN_RPCS"
        "MAINNET_RPC_URL"
    )
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            error "Variable requerida no encontrada: $var"
            error "Por favor configura todas las variables en .env.production"
            exit 1
        fi
    done
    
    log "Variables de entorno validadas ✓"
    
    # Verificar archivos necesarios
    local required_files=(
        "Dockerfile.backend"
        "docker-compose.prod.yml"
        "scripts/entrypoint.sh"
        ".env.production"
    )
    
    for file in "${required_files[@]}"; do
        if [ ! -f "$file" ]; then
            error "Archivo requerido no encontrado: $file"
            exit 1
        fi
    done
    
    log "Archivos de configuración validados ✓"
}

validate_ssh_connection() {
    section "Validando Conexión SSH"
    
    info "Probando conexión SSH a $CONTABO_USER@$CONTABO_HOST:$CONTABO_PORT"
    
    if ssh -o BatchMode=yes -o ConnectTimeout=10 -p "$CONTABO_PORT" "$CONTABO_USER@$CONTABO_HOST" exit; then
        log "Conexión SSH establecida ✓"
    else
        error "No se pudo establecer conexión SSH"
        error "Verifica:"
        error "  - Host: $CONTABO_HOST"
        error "  - Usuario: $CONTABO_USER"
        error "  - Puerto: $CONTABO_PORT"
        error "  - Claves SSH configuradas"
        exit 1
    fi
}

# ================================
# Funciones de Deployment
# ================================

setup_server_dependencies() {
    section "Configurando Dependencias del Servidor"
    
    ssh -p "$CONTABO_PORT" "$CONTABO_USER@$CONTABO_HOST" << 'EOF'
        # Actualizar sistema
        apt-get update && apt-get upgrade -y
        
        # Instalar Docker y Docker Compose
        if ! command -v docker &> /dev/null; then
            curl -fsSL https://get.docker.com -o get-docker.sh
            sh get-docker.sh
            usermod -aG docker $USER
        fi
        
        # Instalar Docker Compose v2
        if ! docker compose version &> /dev/null; then
            curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
            chmod +x /usr/local/bin/docker-compose
        fi
        
        # Instalar herramientas adicionales
        apt-get install -y \
            curl \
            wget \
            git \
            htop \
            nano \
            ufw \
            fail2ban \
            certbot \
            python3-certbot-nginx
        
        # Configurar firewall básico
        ufw --force reset
        ufw default deny incoming
        ufw default allow outgoing
        ufw allow ssh
        ufw allow 80/tcp
        ufw allow 443/tcp
        ufw allow 8080/tcp  # ArbitrageX API
        ufw allow 8081/tcp  # WebSocket
        ufw --force enable
        
        echo "Dependencias del servidor configuradas ✓"
EOF
    
    log "Dependencias del servidor instaladas ✓"
}

create_project_structure() {
    section "Creando Estructura del Proyecto"
    
    ssh -p "$CONTABO_PORT" "$CONTABO_USER@$CONTABO_HOST" << EOF
        # Crear directorios principales
        mkdir -p $DEPLOY_PATH/{logs,data,config,nginx,monitoring,sql}
        mkdir -p $BACKUP_PATH
        
        # Configurar permisos
        chown -R 1000:1000 $DEPLOY_PATH/logs $DEPLOY_PATH/data
        chmod -R 755 $DEPLOY_PATH
        
        echo "Estructura del proyecto creada en $DEPLOY_PATH ✓"
EOF
    
    log "Estructura del proyecto creada ✓"
}

upload_project_files() {
    section "Subiendo Archivos del Proyecto"
    
    info "Transfiriendo archivos a servidor Contabo..."
    
    # Crear archivo tar con exclusiones
    tar --exclude='node_modules' \
        --exclude='.git' \
        --exclude='target' \
        --exclude='dist' \
        --exclude='.env*' \
        --exclude='*.log' \
        -czf arbitragex-deploy.tar.gz \
        Dockerfile.backend \
        docker-compose.prod.yml \
        scripts/ \
        config/ \
        nginx/ \
        monitoring/ \
        sql/ \
        src/ \
        Cargo.toml \
        Cargo.lock \
        package.json \
        tsconfig.json
    
    # Transferir archivo
    scp -P "$CONTABO_PORT" arbitragex-deploy.tar.gz "$CONTABO_USER@$CONTABO_HOST:$DEPLOY_PATH/"
    
    # Transferir archivo de environment
    scp -P "$CONTABO_PORT" .env.production "$CONTABO_USER@$CONTABO_HOST:$DEPLOY_PATH/.env"
    
    # Extraer archivos en servidor
    ssh -p "$CONTABO_PORT" "$CONTABO_USER@$CONTABO_HOST" << EOF
        cd $DEPLOY_PATH
        tar -xzf arbitragex-deploy.tar.gz
        rm arbitragex-deploy.tar.gz
        chmod +x scripts/*.sh
        echo "Archivos del proyecto extraídos ✓"
EOF
    
    # Limpiar archivo temporal
    rm -f arbitragex-deploy.tar.gz
    
    log "Archivos del proyecto transferidos ✓"
}

setup_ssl_certificates() {
    section "Configurando Certificados SSL"
    
    if [ -n "$DOMAIN_NAME" ]; then
        ssh -p "$CONTABO_PORT" "$CONTABO_USER@$CONTABO_HOST" << EOF
            # Obtener certificados SSL con Certbot
            certbot certonly --standalone \
                --non-interactive \
                --agree-tos \
                --email admin@$DOMAIN_NAME \
                -d $DOMAIN_NAME \
                -d api.$DOMAIN_NAME
            
            # Configurar renovación automática
            echo "0 12 * * * /usr/bin/certbot renew --quiet" | crontab -
            
            echo "Certificados SSL configurados para $DOMAIN_NAME ✓"
EOF
        log "Certificados SSL configurados ✓"
    else
        warn "DOMAIN_NAME no configurado, omitiendo SSL"
    fi
}

deploy_application() {
    section "Desplegando Aplicación ArbitrageX Supreme"
    
    ssh -p "$CONTABO_PORT" "$CONTABO_USER@$CONTABO_HOST" << EOF
        cd $DEPLOY_PATH
        
        # Cargar variables de entorno
        set -a
        source .env
        set +a
        
        # Crear backup si existe deployment previo
        if docker compose -f docker-compose.prod.yml ps | grep -q "arbitragex"; then
            echo "Creando backup del deployment actual..."
            docker compose -f docker-compose.prod.yml down
            tar -czf $BACKUP_PATH/arbitragex-backup-\$(date +%Y%m%d_%H%M%S).tar.gz \
                logs/ data/ || true
        fi
        
        # Pull y build de imágenes
        echo "Construyendo imágenes Docker..."
        docker compose -f docker-compose.prod.yml build --no-cache
        
        # Iniciar servicios
        echo "Iniciando servicios ArbitrageX Supreme..."
        docker compose -f docker-compose.prod.yml up -d
        
        # Verificar estado de servicios
        sleep 30
        docker compose -f docker-compose.prod.yml ps
        
        echo "ArbitrageX Supreme V3.0 desplegado ✓"
EOF
    
    log "Aplicación desplegada exitosamente ✓"
}

verify_deployment() {
    section "Verificando Deployment"
    
    info "Ejecutando verificaciones de salud..."
    
    ssh -p "$CONTABO_PORT" "$CONTABO_USER@$CONTABO_HOST" << EOF
        cd $DEPLOY_PATH
        
        # Verificar servicios Docker
        echo "=== Estado de Contenedores ==="
        docker compose -f docker-compose.prod.yml ps
        
        # Verificar logs de servicios críticos
        echo "=== Logs del Backend ==="
        docker compose -f docker-compose.prod.yml logs --tail=20 arbitragex-backend
        
        echo "=== Logs de Anvil-Real ==="
        docker compose -f docker-compose.prod.yml logs --tail=10 anvil-real
        
        # Verificar conectividad
        echo "=== Verificaciones de Salud ==="
        
        # API Principal
        if curl -f -s http://localhost:8080/health >/dev/null; then
            echo "✓ API Principal (puerto 8080) - OK"
        else
            echo "✗ API Principal (puerto 8080) - FALLO"
        fi
        
        # WebSocket
        if timeout 3 bash -c '</dev/tcp/localhost/8081' >/dev/null 2>&1; then
            echo "✓ WebSocket (puerto 8081) - OK"
        else
            echo "✗ WebSocket (puerto 8081) - FALLO"
        fi
        
        # Métricas
        if curl -f -s http://localhost:9090/metrics >/dev/null; then
            echo "✓ Métricas (puerto 9090) - OK"
        else
            echo "✗ Métricas (puerto 9090) - FALLO"
        fi
        
        # Anvil-Real
        if curl -s -X POST -H "Content-Type: application/json" \
           --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
           http://localhost:8545 >/dev/null; then
            echo "✓ Anvil-Real (puerto 8545) - OK"
        else
            echo "✗ Anvil-Real (puerto 8545) - FALLO"
        fi
        
        echo "=== Verificación completada ==="
EOF
    
    log "Verificación de deployment completada ✓"
}

show_deployment_info() {
    section "Información del Deployment"
    
    cat << EOF

${GREEN}🚀 ArbitrageX Supreme V3.0 desplegado exitosamente en Contabo VPS!${NC}

${CYAN}📋 URLs de Acceso:${NC}
   • API Principal:    http://$CONTABO_HOST:8080
   • WebSocket:        ws://$CONTABO_HOST:8081
   • Métricas:         http://$CONTABO_HOST:9090/metrics
   • Grafana:          http://$CONTABO_HOST:3001
   • Prometheus:       http://$CONTABO_HOST:9091

${CYAN}🔧 Comandos Útiles en el Servidor:${NC}
   • Ver logs:         cd $DEPLOY_PATH && docker compose -f docker-compose.prod.yml logs -f
   • Reiniciar:        cd $DEPLOY_PATH && docker compose -f docker-compose.prod.yml restart
   • Estado:           cd $DEPLOY_PATH && docker compose -f docker-compose.prod.yml ps
   • Parar:            cd $DEPLOY_PATH && docker compose -f docker-compose.prod.yml down
   • Actualizar:       cd $DEPLOY_PATH && docker compose -f docker-compose.prod.yml pull && docker compose -f docker-compose.prod.yml up -d

${CYAN}📁 Directorios Importantes:${NC}
   • Proyecto:         $DEPLOY_PATH
   • Logs:             $DEPLOY_PATH/logs
   • Datos:            $DEPLOY_PATH/data
   • Backups:          $BACKUP_PATH

${YELLOW}⚠️  Siguientes Pasos Recomendados:${NC}
   1. Configurar dominio y SSL si es necesario
   2. Configurar monitoreo y alertas
   3. Verificar integraciones blockchain
   4. Configurar respaldos automáticos
   5. Implementar frontend ArbitrageX Dashboard

EOF
}

# ================================
# Función Principal
# ================================

main() {
    section "ArbitrageX Supreme V3.0 - Contabo VPS Deployment"
    
    # Verificar si se pasó la acción
    case "${1:-deploy}" in
        "validate")
            validate_environment
            validate_ssh_connection
            log "Validación completada - Listo para deployment"
            ;;
        "deploy")
            validate_environment
            validate_ssh_connection
            setup_server_dependencies
            create_project_structure
            upload_project_files
            setup_ssl_certificates
            deploy_application
            verify_deployment
            show_deployment_info
            ;;
        "verify")
            verify_deployment
            ;;
        "info")
            show_deployment_info
            ;;
        *)
            echo "Uso: $0 [validate|deploy|verify|info]"
            echo ""
            echo "Acciones disponibles:"
            echo "  validate  - Solo validar entorno y conectividad"
            echo "  deploy    - Deployment completo (por defecto)"
            echo "  verify    - Solo verificar deployment existente"
            echo "  info      - Mostrar información del deployment"
            exit 1
            ;;
    esac
    
    log "Operación completada exitosamente ✓"
}

# Ejecutar función principal
main "$@"
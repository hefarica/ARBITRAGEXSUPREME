#!/bin/bash
# ================================
# ArbitrageX Supreme V3.0 - Full System Deployment
# Script maestro para deployment completo
# ================================

set -e

# Configuración de colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Variables de configuración
CONTABO_HOST="${CONTABO_HOST:-your-server.contabo.com}"
CONTABO_USER="${CONTABO_USER:-root}"
CONTABO_PORT="${CONTABO_PORT:-22}"
PROJECT_NAME="arbitragex-supreme-full"
DEPLOY_PATH="/opt/arbitragex-supreme"
BACKUP_PATH="/opt/backups/arbitragex-supreme"

# Repositorios
BACKEND_REPO="https://github.com/hefarica/ARBITRAGEXSUPREME.git"
FRONTEND_REPO="https://github.com/hefarica/show-my-github-gems.git"

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

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# ================================
# Validaciones Pre-deployment
# ================================

validate_environment() {
    section "Validando Entorno Completo de Deployment"
    
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
    
    success "Variables de entorno validadas"
    
    # Verificar conexión SSH
    info "Validando conexión SSH a $CONTABO_USER@$CONTABO_HOST:$CONTABO_PORT"
    if ssh -o BatchMode=yes -o ConnectTimeout=10 -p "$CONTABO_PORT" "$CONTABO_USER@$CONTABO_HOST" exit; then
        success "Conexión SSH establecida"
    else
        error "No se pudo establecer conexión SSH"
        error "Verifica configuración SSH y acceso al servidor"
        exit 1
    fi
    
    # Verificar que Docker esté disponible localmente
    if ! command -v docker &> /dev/null; then
        error "Docker no está instalado localmente"
        error "Instala Docker para continuar"
        exit 1
    fi
    
    success "Docker disponible localmente"
}

# ================================
# Preparación de Código Fuente
# ================================

prepare_source_code() {
    section "Preparando Código Fuente"
    
    local temp_dir=$(mktemp -d)
    local project_dir="$temp_dir/arbitragex-supreme-full"
    
    info "Directorio temporal: $temp_dir"
    
    # Crear estructura de proyecto
    mkdir -p "$project_dir"
    cd "$project_dir"
    
    # Clonar backend ARBITRAGEXSUPREME
    info "Clonando backend ARBITRAGEXSUPREME..."
    git clone "$BACKEND_REPO" backend
    if [ $? -ne 0 ]; then
        error "Error al clonar repositorio backend"
        exit 1
    fi
    
    # Clonar frontend show-my-github-gems
    info "Clonando frontend show-my-github-gems..."
    git clone "$FRONTEND_REPO" frontend
    if [ $? -ne 0 ]; then
        error "Error al clonar repositorio frontend" 
        exit 1
    fi
    
    # Copiar archivos de configuración Docker del directorio actual
    info "Copiando configuraciones Docker..."
    cp -r /home/user/webapp/Dockerfile.* .
    cp -r /home/user/webapp/docker-compose.* .
    cp -r /home/user/webapp/nginx/ .
    cp -r /home/user/webapp/monitoring/ .
    cp -r /home/user/webapp/sql/ .
    cp -r /home/user/webapp/scripts/ .
    cp /home/user/webapp/.env.production.example .
    
    # Copiar .env.production si existe
    if [ -f "/home/user/webapp/.env.production" ]; then
        cp /home/user/webapp/.env.production .
    else
        warn "Archivo .env.production no encontrado, usando ejemplo"
        cp .env.production.example .env.production
    fi
    
    success "Código fuente preparado en $project_dir"
    
    # Exportar ruta para uso posterior
    export SOURCE_PROJECT_DIR="$project_dir"
}

# ================================
# Setup del Servidor
# ================================

setup_server() {
    section "Configurando Servidor Contabo"
    
    ssh -p "$CONTABO_PORT" "$CONTABO_USER@$CONTABO_HOST" << 'EOF'
        # Actualizar sistema
        apt-get update && apt-get upgrade -y
        
        # Instalar Docker y Docker Compose
        if ! command -v docker &> /dev/null; then
            echo "Instalando Docker..."
            curl -fsSL https://get.docker.com -o get-docker.sh
            sh get-docker.sh
            usermod -aG docker $USER
        fi
        
        # Instalar Docker Compose v2
        if ! docker compose version &> /dev/null; then
            echo "Instalando Docker Compose..."
            curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
            chmod +x /usr/local/bin/docker-compose
            
            # También instalar como plugin
            mkdir -p ~/.docker/cli-plugins
            curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-$(uname -m)" -o ~/.docker/cli-plugins/docker-compose
            chmod +x ~/.docker/cli-plugins/docker-compose
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
            python3-certbot-nginx \
            jq \
            tree \
            ncdu
        
        # Configurar firewall
        ufw --force reset
        ufw default deny incoming
        ufw default allow outgoing
        ufw allow ssh
        ufw allow 80/tcp          # HTTP
        ufw allow 443/tcp         # HTTPS  
        ufw allow 3000/tcp        # Frontend
        ufw allow 8080/tcp        # Backend API
        ufw allow 8081/tcp        # WebSocket
        ufw allow 9090/tcp        # Métricas
        ufw allow 3001/tcp        # Grafana
        ufw --force enable
        
        echo "Servidor configurado correctamente ✅"
EOF
    
    success "Servidor Contabo configurado"
}

# ================================
# Transfer y Deployment
# ================================

transfer_and_deploy() {
    section "Transferencia y Deployment del Sistema Completo"
    
    info "Creando archivo comprimido del proyecto..."
    cd "$SOURCE_PROJECT_DIR"
    
    # Crear archivo tar excluyendo archivos innecesarios
    tar --exclude='.git' \
        --exclude='node_modules' \
        --exclude='target' \
        --exclude='dist' \
        --exclude='*.log' \
        --exclude='.DS_Store' \
        -czf arbitragex-supreme-full.tar.gz \
        .
    
    # Transferir archivo al servidor
    info "Transfiriendo proyecto a servidor Contabo..."
    
    # Crear directorio de deployment en servidor
    ssh -p "$CONTABO_PORT" "$CONTABO_USER@$CONTABO_HOST" << EOF
        mkdir -p $DEPLOY_PATH
        mkdir -p $BACKUP_PATH
        chown -R root:root $DEPLOY_PATH $BACKUP_PATH
EOF
    
    # Transferir archivo comprimido
    scp -P "$CONTABO_PORT" arbitragex-supreme-full.tar.gz "$CONTABO_USER@$CONTABO_HOST:$DEPLOY_PATH/"
    
    # Extraer y configurar en servidor
    ssh -p "$CONTABO_PORT" "$CONTABO_USER@$CONTABO_HOST" << EOF
        cd $DEPLOY_PATH
        
        # Backup de deployment previo si existe
        if [ -d "backend" ] || [ -d "frontend" ]; then
            echo "Creando backup del deployment anterior..."
            tar -czf $BACKUP_PATH/arbitragex-backup-\$(date +%Y%m%d_%H%M%S).tar.gz \
                backend/ frontend/ logs/ data/ 2>/dev/null || true
        fi
        
        # Extraer nuevo deployment
        echo "Extrayendo proyecto..."
        tar -xzf arbitragex-supreme-full.tar.gz
        rm arbitragex-supreme-full.tar.gz
        
        # Configurar permisos
        chmod +x scripts/*.sh
        chmod -R 755 .
        
        # Crear directorios necesarios
        mkdir -p logs/{backend,frontend,nginx,prometheus}
        mkdir -p data/{postgres,redis,anvil}
        chown -R 1000:1000 logs/ data/ 2>/dev/null || true
        
        echo "Proyecto extraído y configurado ✅"
EOF
    
    success "Proyecto transferido al servidor"
}

# ================================
# Build y Startup del Sistema
# ================================

build_and_start_system() {
    section "Build y Startup del Sistema Completo"
    
    ssh -p "$CONTABO_PORT" "$CONTABO_USER@$CONTABO_HOST" << EOF
        cd $DEPLOY_PATH
        
        # Cargar variables de entorno
        set -a
        source .env.production
        set +a
        
        echo "=== Iniciando build de servicios ==="
        
        # Parar servicios existentes si están corriendo
        if docker compose -f docker-compose.full.yml ps | grep -q "arbitragex"; then
            echo "Parando servicios existentes..."
            docker compose -f docker-compose.full.yml down
        fi
        
        # Limpiar volúmenes antiguos si se requiere (comentado por seguridad)
        # docker compose -f docker-compose.full.yml down -v
        
        # Build de todas las imágenes
        echo "=== Building Backend (Rust) ==="
        docker compose -f docker-compose.full.yml build --no-cache arbitragex-backend
        
        echo "=== Building Frontend (React) ==="  
        docker compose -f docker-compose.full.yml build --no-cache arbitragex-frontend
        
        # Pull de imágenes externas
        echo "=== Pulling external images ==="
        docker compose -f docker-compose.full.yml pull
        
        echo "=== Iniciando servicios ==="
        
        # Iniciar servicios en orden dependencias
        echo "Iniciando base de datos..."
        docker compose -f docker-compose.full.yml up -d postgres redis
        sleep 10
        
        echo "Iniciando Anvil-Real..."
        docker compose -f docker-compose.full.yml up -d anvil-real
        sleep 15
        
        echo "Iniciando backend ArbitrageX..."
        docker compose -f docker-compose.full.yml up -d arbitragex-backend
        sleep 20
        
        echo "Iniciando frontend y servicios auxiliares..."
        docker compose -f docker-compose.full.yml up -d
        
        echo "=== Verificando estado de servicios ==="
        sleep 30
        docker compose -f docker-compose.full.yml ps
        
        echo "Sistema ArbitrageX Supreme V3.0 iniciado ✅"
EOF
    
    success "Sistema completo iniciado"
}

# ================================
# Verificación del Deployment
# ================================

verify_full_deployment() {
    section "Verificación Integral del Deployment"
    
    info "Ejecutando verificaciones exhaustivas..."
    
    ssh -p "$CONTABO_PORT" "$CONTABO_USER@$CONTABO_HOST" << EOF
        cd $DEPLOY_PATH
        
        echo "=== Estado de Contenedores ==="
        docker compose -f docker-compose.full.yml ps
        echo ""
        
        echo "=== Verificaciones de Salud ==="
        
        # Backend API
        echo -n "Backend API (8080): "
        if curl -f -s http://localhost:8080/health >/dev/null 2>&1; then
            echo "✅ OK"
        else
            echo "❌ FALLO"
        fi
        
        # Frontend React
        echo -n "Frontend React (3000): "
        if curl -f -s http://localhost:3000/health >/dev/null 2>&1; then
            echo "✅ OK"
        else
            echo "❌ FALLO"
        fi
        
        # WebSocket
        echo -n "WebSocket (8081): "
        if timeout 3 bash -c '</dev/tcp/localhost/8081' >/dev/null 2>&1; then
            echo "✅ OK"
        else
            echo "❌ FALLO"
        fi
        
        # Métricas Prometheus
        echo -n "Métricas (9090): "
        if curl -f -s http://localhost:9090/metrics >/dev/null 2>&1; then
            echo "✅ OK"
        else
            echo "❌ FALLO"
        fi
        
        # Grafana
        echo -n "Grafana (3001): "
        if curl -f -s http://localhost:3001 >/dev/null 2>&1; then
            echo "✅ OK"
        else
            echo "❌ FALLO"
        fi
        
        # PostgreSQL
        echo -n "PostgreSQL (5432): "
        if timeout 3 bash -c '</dev/tcp/localhost/5432' >/dev/null 2>&1; then
            echo "✅ OK"
        else
            echo "❌ FALLO"
        fi
        
        # Redis
        echo -n "Redis (6379): "
        if timeout 3 bash -c '</dev/tcp/localhost/6379' >/dev/null 2>&1; then
            echo "✅ OK"
        else
            echo "❌ FALLO"
        fi
        
        # Anvil-Real
        echo -n "Anvil-Real (8545): "
        if curl -s -X POST -H "Content-Type: application/json" \
           --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
           http://localhost:8545 >/dev/null 2>&1; then
            echo "✅ OK"
        else
            echo "❌ FALLO"
        fi
        
        echo ""
        echo "=== Logs de Servicios Críticos ==="
        echo "--- Backend ArbitrageX ---"
        docker compose -f docker-compose.full.yml logs --tail=10 arbitragex-backend
        
        echo "--- Frontend React ---"
        docker compose -f docker-compose.full.yml logs --tail=5 arbitragex-frontend
        
        echo "--- Anvil-Real ---"
        docker compose -f docker-compose.full.yml logs --tail=5 anvil-real
        
        echo ""
        echo "=== Recursos del Sistema ==="
        df -h /
        free -h
        docker system df
        
        echo "Verificación completada ✅"
EOF
    
    success "Verificación integral completada"
}

# ================================
# Información Final del Deployment
# ================================

show_deployment_summary() {
    section "🚀 ArbitrageX Supreme V3.0 - Deployment Completo"
    
    cat << EOF

${GREEN}🎉 ¡ArbitrageX Supreme V3.0 desplegado exitosamente!${NC}

${CYAN}📋 URLs de Acceso:${NC}
   • 🌐 Dashboard Frontend:  http://$CONTABO_HOST:3000
   • 🔌 Backend API:         http://$CONTABO_HOST:8080
   • 📡 WebSocket:          ws://$CONTABO_HOST:8081
   • 📊 Grafana:            http://$CONTABO_HOST:3001
   • 📈 Prometheus:         http://$CONTABO_HOST:9091
   • ⚡ Anvil-Real:         http://$CONTABO_HOST:8545

${CYAN}🔧 Comandos de Administración:${NC}
   • SSH al servidor:       ssh -p $CONTABO_PORT $CONTABO_USER@$CONTABO_HOST
   • Ver logs completos:    cd $DEPLOY_PATH && docker compose -f docker-compose.full.yml logs -f
   • Reiniciar sistema:     cd $DEPLOY_PATH && docker compose -f docker-compose.full.yml restart
   • Estado de servicios:   cd $DEPLOY_PATH && docker compose -f docker-compose.full.yml ps
   • Parar sistema:         cd $DEPLOY_PATH && docker compose -f docker-compose.full.yml down
   • Actualizar sistema:    cd $DEPLOY_PATH && docker compose -f docker-compose.full.yml pull && docker compose -f docker-compose.full.yml up -d

${CYAN}📁 Estructura en Servidor:${NC}
   • Proyecto:              $DEPLOY_PATH
   • Logs:                  $DEPLOY_PATH/logs
   • Datos:                 $DEPLOY_PATH/data
   • Configuración:         $DEPLOY_PATH/.env.production
   • Backups:               $BACKUP_PATH

${CYAN}🏗️ Arquitectura Desplegada:${NC}
   • Backend:               Rust + Actix-Web + PostgreSQL + Redis
   • Frontend:              React + TypeScript + shadcn/ui
   • Simulación:            Anvil-Real + Ethereum Fork
   • Monitoreo:             Prometheus + Grafana + Exporters
   • Proxy:                 Nginx + SSL/TLS ready
   • Orquestación:          Docker Compose + Multi-container

${CYAN}🔒 Seguridad Configurada:${NC}
   • Firewall UFW activado con puertos específicos
   • Usuarios no-root en containers
   • Configuración SSL/TLS lista
   • Variables de entorno protegidas

${YELLOW}⚠️  Siguientes Pasos Recomendados:${NC}
   1. Configurar dominio y certificados SSL
   2. Verificar integración de APIs blockchain (RPCs)
   3. Configurar alertas y notificaciones
   4. Ejecutar tests de integración
   5. Configurar backups automáticos
   6. Configurar monitoreo de logs
   7. Verificar todas las 13 estrategias de arbitraje
   8. Testear sistema anti-rugpull
   9. Validar latencia sub-200ms
   10. Configurar respaldos de base de datos

${GREEN}✨ ArbitrageX Supreme V3.0 está OPERATIVO con política Real-Only ✨${NC}

EOF
}

# ================================
# Función Principal
# ================================

main() {
    section "🚀 ArbitrageX Supreme V3.0 - Full System Deployment"
    
    case "${1:-deploy}" in
        "validate")
            validate_environment
            log "Validación completada - Sistema listo para deployment"
            ;;
        "prepare")
            validate_environment
            prepare_source_code
            log "Código fuente preparado"
            ;;
        "deploy")
            validate_environment
            prepare_source_code
            setup_server
            transfer_and_deploy
            build_and_start_system
            verify_full_deployment
            show_deployment_summary
            ;;
        "verify")
            verify_full_deployment
            ;;
        "info")
            show_deployment_summary
            ;;
        *)
            echo "Uso: $0 [validate|prepare|deploy|verify|info]"
            echo ""
            echo "Acciones disponibles:"
            echo "  validate  - Solo validar entorno y conectividad"
            echo "  prepare   - Preparar código fuente para deployment"
            echo "  deploy    - Deployment completo (por defecto)"
            echo "  verify    - Solo verificar deployment existente"
            echo "  info      - Mostrar información del deployment"
            exit 1
            ;;
    esac
    
    log "Operación completada exitosamente ✅"
}

# Ejecutar función principal
main "$@"
#!/bin/bash

# ArbitrageX Supreme V3.0 - Master Deployment Script
# Real-Only Policy - Complete system deployment for Contabo VPS

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="/var/log/arbitragex-deployment.log"
ENV_FILE="${SCRIPT_DIR}/.env"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Logging function
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} [${level}] ${message}" | tee -a "${LOG_FILE}"
}

log_info() {
    log "INFO" "${BLUE}$*${NC}"
}

log_warn() {
    log "WARN" "${YELLOW}$*${NC}"
}

log_error() {
    log "ERROR" "${RED}$*${NC}"
}

log_success() {
    log "SUCCESS" "${GREEN}$*${NC}"
}

log_section() {
    log "SECTION" "${PURPLE}$*${NC}"
}

# Banner function
print_banner() {
    cat << 'EOF'
╔══════════════════════════════════════════════════════════════╗
║                  ArbitrageX Supreme V3.0                     ║
║                  Master Deployment Script                    ║
║                      Real-Only Policy                        ║
╠══════════════════════════════════════════════════════════════╣
║  Deployment Target: Contabo VPS Production Environment      ║
║  Components: All Backend Services + Monitoring Stack        ║
║  Policy: Real-Only - No mocks, only production data         ║
╚══════════════════════════════════════════════════════════════╝
EOF
}

# Check prerequisites
check_prerequisites() {
    log_section "Checking prerequisites..."
    
    # Check if running as root or with sudo
    if [[ $EUID -eq 0 ]]; then
        log_warn "Running as root. This is acceptable for VPS deployment."
    fi
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Installing Docker..."
        install_docker
    else
        log_info "Docker is installed: $(docker --version)"
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not installed. Installing Docker Compose..."
        install_docker_compose
    else
        log_info "Docker Compose is available"
    fi
    
    # Check available disk space (minimum 50GB recommended)
    available_space=$(df / | awk 'NR==2 {print $4}')
    required_space=$((50 * 1024 * 1024)) # 50GB in KB
    
    if [[ $available_space -lt $required_space ]]; then
        log_error "Insufficient disk space. At least 50GB required for full deployment."
        log_info "Available: $(($available_space / 1024 / 1024))GB, Required: 50GB"
        exit 1
    fi
    
    # Check available memory (minimum 8GB recommended)
    available_memory=$(free -m | awk 'NR==2{print $2}')
    required_memory=$((8 * 1024)) # 8GB in MB
    
    if [[ $available_memory -lt $required_memory ]]; then
        log_warn "Low memory detected. Recommended: 8GB+, Available: ${available_memory}MB"
        log_warn "System may experience performance issues with heavy loads."
    fi
    
    log_success "Prerequisites check completed"
}

# Install Docker
install_docker() {
    log_info "Installing Docker..."
    
    # Update package index
    apt-get update
    
    # Install required packages
    apt-get install -y \
        apt-transport-https \
        ca-certificates \
        curl \
        gnupg \
        lsb-release
    
    # Add Docker GPG key
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    
    # Add Docker repository
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Install Docker
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    
    # Start and enable Docker
    systemctl start docker
    systemctl enable docker
    
    # Add current user to docker group if not root
    if [[ $EUID -ne 0 ]]; then
        usermod -aG docker $USER
        log_warn "Please log out and back in for Docker group changes to take effect"
    fi
    
    log_success "Docker installed successfully"
}

# Install Docker Compose
install_docker_compose() {
    log_info "Installing Docker Compose..."
    
    # Download latest version
    local compose_version=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep 'tag_name' | cut -d'"' -f4)
    curl -L "https://github.com/docker/compose/releases/download/${compose_version}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    
    # Make executable
    chmod +x /usr/local/bin/docker-compose
    
    # Create symlink
    ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose
    
    log_success "Docker Compose installed successfully"
}

# Setup environment configuration
setup_environment() {
    log_section "Setting up environment configuration..."
    
    if [[ ! -f "$ENV_FILE" ]]; then
        cat > "$ENV_FILE" << 'EOF'
# ArbitrageX Supreme V3.0 - Production Environment Configuration
# Real-Only Policy - All production settings

# Database Configuration
POSTGRES_DB=arbitragex_recon
POSTGRES_USER=arbitragex
POSTGRES_PASSWORD=ArbitrageX_Secure_DB_Password_2024!

# Redis Configuration
REDIS_PASSWORD=ArbitrageX_Redis_Password_2024!

# Grafana Configuration
GRAFANA_ADMIN_PASSWORD=ArbitrageX_Grafana_Admin_2024!

# API Keys (to be configured)
COINGECKO_API_KEY=
DEXSCREENER_API_KEY=
ETHERSCAN_API_KEY=
POLYGONSCAN_API_KEY=
BSCSCAN_API_KEY=
ARBISCAN_API_KEY=

# Alert Configuration
SLACK_WEBHOOK_URL=
DISCORD_WEBHOOK_URL=
PAGERDUTY_KEY=

# Performance Configuration
MAX_CONCURRENT_JOBS=5
PRICE_UPDATE_INTERVAL_MINUTES=2
POOL_UPDATE_INTERVAL_MINUTES=5
GAS_UPDATE_INTERVAL_MINUTES=1

# Blockchain Configuration
ENABLED_CHAINS=1,137,56,42161,10
ETH_RPC_URL=http://geth:8545
POLYGON_RPC_URL=https://polygon-rpc.com
BSC_RPC_URL=https://bsc-dataseed.binance.org
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
OPTIMISM_RPC_URL=https://mainnet.optimism.io

# Resource Limits
PROMETHEUS_RETENTION_TIME=7d
PROMETHEUS_RETENTION_SIZE=50GB
LOKI_RETENTION_PERIOD=168h
EOF
        log_info "Created default .env file"
        log_warn "Please review and update .env file with your specific configuration"
    else
        log_info ".env file already exists"
    fi
    
    # Source environment variables
    set -a
    source "$ENV_FILE"
    set +a
}

# Create necessary directories
create_directories() {
    log_section "Creating necessary directories..."
    
    local dirs=(
        "/var/log/arbitragex"
        "/var/log/recon"
        "/var/lib/arbitragex"
        "/opt/arbitragex"
        "${SCRIPT_DIR}/logs"
    )
    
    for dir in "${dirs[@]}"; do
        if [[ ! -d "$dir" ]]; then
            mkdir -p "$dir"
            chmod 755 "$dir"
            log_info "Created directory: $dir"
        fi
    done
    
    log_success "Directories created successfully"
}

# Setup Docker networks
setup_networks() {
    log_section "Setting up Docker networks..."
    
    # Create monitoring network first (external for observability stack)
    if ! docker network inspect arbitragex-monitoring >/dev/null 2>&1; then
        docker network create arbitragex-monitoring \
            --driver bridge \
            --subnet 172.20.0.0/16
        log_info "Created arbitragex-monitoring network"
    fi
    
    log_success "Docker networks configured"
}

# Build and start observability stack
deploy_observability() {
    log_section "Deploying observability stack..."
    
    cd "${SCRIPT_DIR}/observability"
    
    # Make setup script executable
    chmod +x setup-observability.sh
    
    # Run observability setup
    ./setup-observability.sh
    
    log_success "Observability stack deployed"
}

# Build services
build_services() {
    log_section "Building ArbitrageX services..."
    
    cd "$SCRIPT_DIR"
    
    # Build each service
    local services=("recon" "cron")
    
    for service in "${services[@]}"; do
        if [[ -d "$service" ]]; then
            log_info "Building $service service..."
            cd "$service"
            
            # Copy environment file if exists
            if [[ -f "../.env" ]]; then
                cp "../.env" ".env"
            fi
            
            # Build the service
            docker build -t "arbitragex-${service}:v3.0.0" .
            
            cd "$SCRIPT_DIR"
            log_success "$service service built successfully"
        else
            log_warn "$service directory not found, skipping"
        fi
    done
}

# Deploy main system
deploy_system() {
    log_section "Deploying main ArbitrageX system..."
    
    cd "$SCRIPT_DIR"
    
    # Start the main system
    docker-compose up -d
    
    log_info "Waiting for services to start..."
    sleep 60
    
    # Check service health
    check_service_health
}

# Check service health
check_service_health() {
    log_section "Checking service health..."
    
    local services=(
        "postgres:5432"
        "redis:6379"
        "geth:8545"
        "recon:8001"
        "cron:8005"
    )
    
    local failed_services=()
    
    for service in "${services[@]}"; do
        local name="${service%:*}"
        local port="${service#*:}"
        
        log_info "Checking $name service..."
        
        # Wait for service to be ready
        local max_attempts=30
        local attempt=0
        local service_ready=false
        
        while [[ $attempt -lt $max_attempts ]]; do
            if nc -z localhost "$port" 2>/dev/null; then
                service_ready=true
                break
            fi
            
            ((attempt++))
            log_info "Waiting for $name... (attempt $attempt/$max_attempts)"
            sleep 5
        done
        
        if [[ $service_ready == true ]]; then
            # Additional health check for HTTP services
            case "$name" in
                "recon"|"cron")
                    if curl -sf "http://localhost:${port}/health" >/dev/null 2>&1; then
                        log_success "$name is healthy"
                    else
                        log_warn "$name port is open but health check failed"
                        failed_services+=("$name")
                    fi
                    ;;
                *)
                    log_success "$name is responsive on port $port"
                    ;;
            esac
        else
            log_error "$name health check failed - service not responding on port $port"
            failed_services+=("$name")
        fi
    done
    
    if [[ ${#failed_services[@]} -eq 0 ]]; then
        log_success "All services are healthy"
        print_access_info
    else
        log_error "Some services failed health checks: ${failed_services[*]}"
        log_info "Check service logs with: docker-compose logs <service-name>"
        return 1
    fi
}

# Print access information
print_access_info() {
    log_section "Deployment completed successfully!"
    
    cat << EOF

╔══════════════════════════════════════════════════════════════╗
║                   🎯 ACCESS INFORMATION                      ║
╠══════════════════════════════════════════════════════════════╣
║  🔍 MONITORING DASHBOARDS                                    ║
║  Grafana:              http://$(hostname -I | awk '{print $1}'):3000               ║
║  Username: admin                                             ║
║  Password: Check .env (GRAFANA_ADMIN_PASSWORD)               ║
║                                                              ║
║  Prometheus:           http://$(hostname -I | awk '{print $1}'):9090               ║
║  AlertManager:         http://$(hostname -I | awk '{print $1}'):9093               ║
║  Loki:                 http://$(hostname -I | awk '{print $1}'):3100               ║
║                                                              ║
║  📊 ARBITRAGEX SERVICES                                      ║
║  Recon API:            http://$(hostname -I | awk '{print $1}'):8001               ║
║  Cron Service:         http://$(hostname -I | awk '{print $1}'):8005               ║
║                                                              ║
║  💾 INFRASTRUCTURE                                           ║
║  Geth RPC:             http://$(hostname -I | awk '{print $1}'):8545               ║
║  Geth WebSocket:       ws://$(hostname -I | awk '{print $1}'):8546                ║
║  PostgreSQL:           $(hostname -I | awk '{print $1}'):5432                     ║
║  Redis:                $(hostname -I | awk '{print $1}'):6379                     ║
╠══════════════════════════════════════════════════════════════╣
║  🚀 NEXT STEPS                                               ║
║  1. Configure API keys in .env file                         ║
║  2. Setup alert webhooks (Slack, Discord, PagerDuty)        ║
║  3. Monitor Geth sync progress in Grafana                   ║
║  4. Configure firewall rules for production                 ║
║  5. Setup SSL certificates for HTTPS access                 ║
╠══════════════════════════════════════════════════════════════╣
║  📋 USEFUL COMMANDS                                          ║
║  View logs:            docker-compose logs -f <service>     ║
║  Restart service:      docker-compose restart <service>     ║
║  Stop all:             docker-compose down                  ║
║  Update services:      docker-compose pull && restart       ║
║  Backup database:      ./scripts/backup-database.sh         ║
║  Monitor resources:    docker stats                         ║
╚══════════════════════════════════════════════════════════════╝

System Status: 🟢 OPERATIONAL
Policy: ✅ REAL-ONLY (No mocks, production data only)
Environment: 🏭 PRODUCTION
Deployment Date: $(date '+%Y-%m-%d %H:%M:%S UTC')

EOF
}

# Cleanup function
cleanup() {
    log_info "Performing cleanup..."
    # Any cleanup tasks would go here
}

# Signal handlers
trap cleanup EXIT
trap 'log_error "Deployment interrupted"; exit 1' INT TERM

# Command line argument handling
usage() {
    echo "Usage: $0 [OPTIONS]"
    echo "Deploy ArbitrageX Supreme V3.0 to Contabo VPS"
    echo ""
    echo "Options:"
    echo "  --help              Show this help message"
    echo "  --observability-only Deploy only monitoring stack"
    echo "  --system-only       Deploy only ArbitrageX services (requires observability)"
    echo "  --check-health      Check service health status"
    echo "  --show-info         Show access information"
    echo ""
    echo "Examples:"
    echo "  $0                                  # Full deployment"
    echo "  $0 --observability-only             # Deploy monitoring only"
    echo "  $0 --system-only                    # Deploy ArbitrageX only"
    echo "  $0 --check-health                   # Check service status"
}

# Main deployment function
main() {
    print_banner
    
    case "${1:-}" in
        --help)
            usage
            exit 0
            ;;
        --observability-only)
            log_info "Deploying observability stack only..."
            check_prerequisites
            setup_environment
            create_directories
            setup_networks
            deploy_observability
            ;;
        --system-only)
            log_info "Deploying ArbitrageX system only..."
            check_prerequisites
            setup_environment
            create_directories
            build_services
            deploy_system
            ;;
        --check-health)
            log_info "Checking service health..."
            check_service_health
            ;;
        --show-info)
            print_access_info
            ;;
        "")
            log_info "Starting full ArbitrageX deployment..."
            check_prerequisites
            setup_environment
            create_directories
            setup_networks
            deploy_observability
            build_services
            deploy_system
            ;;
        *)
            log_error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
    
    log_success "Deployment completed successfully!"
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
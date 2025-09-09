#!/bin/bash

# ArbitrageX Supreme V3.0 - Observability Stack Setup
# Real-Only Policy - Production monitoring infrastructure setup

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="/var/log/arbitragex-observability-setup.log"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.observability.yml"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

# Banner function
print_banner() {
    cat << 'EOF'
╔══════════════════════════════════════════════════════════════╗
║                  ArbitrageX Supreme V3.0                     ║
║                   Observability Stack                        ║
║                      Real-Only Policy                        ║
╠══════════════════════════════════════════════════════════════╣
║  Components: Prometheus + Grafana + Loki + AlertManager     ║
║  Purpose:    Production monitoring for trading system        ║
║  Policy:     Real-Only - No mocks, only production data     ║
╚══════════════════════════════════════════════════════════════╝
EOF
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    # Check if running as root or with sudo
    if [[ $EUID -eq 0 ]]; then
        log_warn "Running as root. Consider using a non-root user with Docker group membership."
    fi
    
    # Check available disk space (minimum 10GB recommended)
    available_space=$(df / | awk 'NR==2 {print $4}')
    required_space=$((10 * 1024 * 1024)) # 10GB in KB
    
    if [[ $available_space -lt $required_space ]]; then
        log_error "Insufficient disk space. At least 10GB required for monitoring data."
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Create necessary directories
create_directories() {
    log_info "Creating necessary directories..."
    
    local dirs=(
        "/var/log/arbitragex"
        "/var/log/recon"
        "/var/log/searcher-rs"
        "/var/lib/arbitragex"
        "${SCRIPT_DIR}/prometheus/data"
        "${SCRIPT_DIR}/grafana/data"
        "${SCRIPT_DIR}/loki/data"
        "${SCRIPT_DIR}/alertmanager/data"
    )
    
    for dir in "${dirs[@]}"; do
        if [[ ! -d "$dir" ]]; then
            mkdir -p "$dir"
            log_info "Created directory: $dir"
        fi
    done
    
    # Set proper permissions for container access
    chmod -R 755 "${SCRIPT_DIR}"/{prometheus,grafana,loki,alertmanager}/data
    
    log_success "Directories created successfully"
}

# Generate configuration files
generate_configs() {
    log_info "Generating additional configuration files..."
    
    # Create Grafana provisioning directories
    mkdir -p "${SCRIPT_DIR}/grafana/provisioning"/{datasources,dashboards,notifiers}
    
    # Grafana datasources configuration
    cat > "${SCRIPT_DIR}/grafana/provisioning/datasources/prometheus.yml" << 'EOF'
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true
    
  - name: Loki
    type: loki
    access: proxy
    url: http://loki:3100
    editable: true
EOF

    # Grafana dashboards configuration
    cat > "${SCRIPT_DIR}/grafana/provisioning/dashboards/arbitragex.yml" << 'EOF'
apiVersion: 1

providers:
  - name: 'ArbitrageX Dashboards'
    orgId: 1
    folder: 'ArbitrageX'
    type: file
    disableDeletion: false
    updateIntervalSeconds: 10
    allowUiUpdates: true
    options:
      path: /etc/grafana/dashboards
EOF

    # PostgreSQL exporter queries
    mkdir -p "${SCRIPT_DIR}/postgres-exporter"
    cat > "${SCRIPT_DIR}/postgres-exporter/queries.yaml" << 'EOF'
pg_replication:
  query: "SELECT EXTRACT(EPOCH FROM (now() - pg_last_xact_replay_timestamp())) as lag"
  master: true
  metrics:
    - lag:
        usage: "GAUGE"
        description: "Replication lag behind master in seconds"

pg_postmaster:
  query: "SELECT pg_postmaster_start_time as start_time_seconds from pg_postmaster_start_time()"
  master: true
  metrics:
    - start_time_seconds:
        usage: "GAUGE"
        description: "Time at which postmaster started"

pg_stat_user_tables:
  query: |
    SELECT
      current_database() datname,
      schemaname,
      relname,
      seq_scan,
      seq_tup_read,
      idx_scan,
      idx_tup_fetch,
      n_tup_ins,
      n_tup_upd,
      n_tup_del,
      n_tup_hot_upd,
      n_live_tup,
      n_dead_tup,
      n_mod_since_analyze,
      COALESCE(last_vacuum, '1970-01-01Z') as last_vacuum,
      COALESCE(last_autovacuum, '1970-01-01Z') as last_autovacuum,
      COALESCE(last_analyze, '1970-01-01Z') as last_analyze,
      COALESCE(last_autoanalyze, '1970-01-01Z') as last_autoanalyze,
      vacuum_count,
      autovacuum_count,
      analyze_count,
      autoanalyze_count
    FROM pg_stat_user_tables
  metrics:
    - datname:
        usage: "LABEL"
        description: "Name of current database"
    - schemaname:
        usage: "LABEL"
        description: "Name of the schema that this table is in"
    - relname:
        usage: "LABEL"
        description: "Name of this table"
    - seq_scan:
        usage: "COUNTER"
        description: "Number of sequential scans initiated on this table"
    - seq_tup_read:
        usage: "COUNTER"
        description: "Number of live rows fetched by sequential scans"
    - idx_scan:
        usage: "COUNTER"
        description: "Number of index scans initiated on this table"
    - idx_tup_fetch:
        usage: "COUNTER"
        description: "Number of live rows fetched by index scans"
    - n_tup_ins:
        usage: "COUNTER"
        description: "Number of rows inserted"
    - n_tup_upd:
        usage: "COUNTER"
        description: "Number of rows updated"
    - n_tup_del:
        usage: "COUNTER"
        description: "Number of rows deleted"
    - n_tup_hot_upd:
        usage: "COUNTER"
        description: "Number of rows HOT updated"
    - n_live_tup:
        usage: "GAUGE"
        description: "Estimated number of live rows"
    - n_dead_tup:
        usage: "GAUGE"
        description: "Estimated number of dead rows"
    - n_mod_since_analyze:
        usage: "GAUGE"
        description: "Estimated number of rows changed since last analyze"
    - last_vacuum:
        usage: "GAUGE"
        description: "Last time at which this table was manually vacuumed"
    - last_autovacuum:
        usage: "GAUGE"
        description: "Last time at which this table was vacuumed by the autovacuum daemon"
    - last_analyze:
        usage: "GAUGE"
        description: "Last time at which this table was manually analyzed"
    - last_autoanalyze:
        usage: "GAUGE"
        description: "Last time at which this table was analyzed by the autovacuum daemon"
    - vacuum_count:
        usage: "COUNTER"
        description: "Number of times this table has been manually vacuumed"
    - autovacuum_count:
        usage: "COUNTER"
        description: "Number of times this table has been vacuumed by the autovacuum daemon"
    - analyze_count:
        usage: "COUNTER"
        description: "Number of times this table has been manually analyzed"
    - autoanalyze_count:
        usage: "COUNTER"
        description: "Number of times this table has been analyzed by the autovacuum daemon"
EOF

    # Blackbox exporter configuration
    mkdir -p "${SCRIPT_DIR}/blackbox-exporter/config"
    cat > "${SCRIPT_DIR}/blackbox-exporter/config/blackbox.yml" << 'EOF'
modules:
  http_2xx:
    prober: http
    timeout: 5s
    http:
      valid_http_versions: ["HTTP/1.1", "HTTP/2.0"]
      valid_status_codes: []
      method: GET
      headers:
        Host: arbitragex.local
        Accept-Language: en-US
      no_follow_redirects: false
      fail_if_ssl: false
      fail_if_not_ssl: false
      
  http_post_2xx:
    prober: http
    timeout: 5s
    http:
      method: POST
      headers:
        Content-Type: application/json
      body: '{"health": "check"}'
      
  tcp_connect:
    prober: tcp
    timeout: 5s
    
  dns_lookup:
    prober: dns
    timeout: 5s
    dns:
      query_name: "arbitragex.local"
      query_type: "A"
EOF

    log_success "Configuration files generated successfully"
}

# Setup environment file
setup_environment() {
    log_info "Setting up environment configuration..."
    
    local env_file="${SCRIPT_DIR}/.env"
    
    if [[ ! -f "$env_file" ]]; then
        cat > "$env_file" << 'EOF'
# ArbitrageX Observability Stack Environment

# Database Configuration
POSTGRES_DB=arbitragex_recon
POSTGRES_USER=arbitragex
POSTGRES_PASSWORD=secure_password_change_in_production

# Redis Configuration  
REDIS_PASSWORD=redis_password_change_in_production

# Grafana Configuration
GRAFANA_ADMIN_PASSWORD=arbitragex_secure_password_change_in_production

# Alert Configuration (optional)
SMTP_HOST=localhost
SMTP_PORT=587
SMTP_USER=alertmanager
SMTP_PASSWORD=smtp_password

SLACK_WEBHOOK_URL=
PAGERDUTY_KEY=

# Resource Limits
PROMETHEUS_RETENTION_TIME=7d
PROMETHEUS_RETENTION_SIZE=50GB
LOKI_RETENTION_PERIOD=168h
EOF
        log_info "Created .env file with default configuration"
        log_warn "Please update .env file with your specific configuration before deployment"
    else
        log_info ".env file already exists"
    fi
}

# Start observability stack
start_stack() {
    log_info "Starting ArbitrageX Observability Stack..."
    
    cd "$SCRIPT_DIR"
    
    # Pull latest images
    log_info "Pulling Docker images..."
    docker-compose -f "$COMPOSE_FILE" pull
    
    # Start services
    log_info "Starting services..."
    docker-compose -f "$COMPOSE_FILE" up -d
    
    # Wait for services to be ready
    log_info "Waiting for services to be ready..."
    sleep 30
    
    # Check service health
    check_service_health
}

# Check service health
check_service_health() {
    log_info "Checking service health..."
    
    local services=(
        "prometheus:9090"
        "grafana:3000"
        "loki:3100"
        "alertmanager:9093"
    )
    
    local failed_services=()
    
    for service in "${services[@]}"; do
        local name="${service%:*}"
        local port="${service#*:}"
        
        if curl -sf "http://localhost:${port}/api/health" &>/dev/null || \
           curl -sf "http://localhost:${port}/-/healthy" &>/dev/null || \
           curl -sf "http://localhost:${port}/ready" &>/dev/null; then
            log_success "${name} is healthy"
        else
            log_error "${name} health check failed"
            failed_services+=("$name")
        fi
    done
    
    if [[ ${#failed_services[@]} -eq 0 ]]; then
        log_success "All services are healthy"
        print_access_info
    else
        log_error "Some services failed health checks: ${failed_services[*]}"
        log_info "Check logs with: docker-compose -f ${COMPOSE_FILE} logs <service-name>"
        return 1
    fi
}

# Print access information
print_access_info() {
    log_info "ArbitrageX Observability Stack is ready!"
    
    cat << 'EOF'

╔══════════════════════════════════════════════════════════════╗
║                   🎯 ACCESS INFORMATION                      ║
╠══════════════════════════════════════════════════════════════╣
║  Grafana Dashboard:    http://localhost:3000                 ║
║  Username: admin                                             ║
║  Password: Check .env file (GRAFANA_ADMIN_PASSWORD)          ║
║                                                              ║
║  Prometheus:           http://localhost:9090                 ║
║  AlertManager:         http://localhost:9093                 ║
║  Loki:                 http://localhost:3100                 ║
║                                                              ║
║  Traefik Dashboard:    http://localhost:8081                 ║
╠══════════════════════════════════════════════════════════════╣
║  📊 MONITORING ENDPOINTS                                     ║
║  Node Exporter:        http://localhost:9100/metrics        ║
║  cAdvisor:            http://localhost:8080                  ║
║  Redis Exporter:       http://localhost:9121/metrics        ║
║  Postgres Exporter:    http://localhost:9187/metrics        ║
║  Blackbox Exporter:    http://localhost:9115                ║
╚══════════════════════════════════════════════════════════════╝

To stop the stack:
  docker-compose -f observability/docker-compose.observability.yml down

To view logs:
  docker-compose -f observability/docker-compose.observability.yml logs -f <service>

To restart a service:
  docker-compose -f observability/docker-compose.observability.yml restart <service>

EOF
}

# Main function
main() {
    print_banner
    
    log_info "Starting ArbitrageX Observability Stack setup..."
    
    check_prerequisites
    create_directories
    generate_configs
    setup_environment
    start_stack
    
    log_success "ArbitrageX Observability Stack setup completed successfully!"
}

# Cleanup function
cleanup() {
    log_info "Performing cleanup..."
    cd "$SCRIPT_DIR"
    docker-compose -f "$COMPOSE_FILE" down
}

# Signal handlers
trap cleanup EXIT
trap 'log_error "Setup interrupted"; exit 1' INT TERM

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
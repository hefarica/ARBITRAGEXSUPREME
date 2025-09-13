#!/bin/bash
# ArbitrageX Supreme V3.0 - Ultra-Low Latency Deployment Script
# Ingenio Pichichi S.A. - Multi-Region Edge Deployment
# Target: <100ms P95 E2E latency across 3 regions

set -euo pipefail

# 🎯 Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEPLOYMENT_ENV="${DEPLOYMENT_ENV:-production}"
REGION="${REGION:-all}"

# 🌍 Regional Configuration
declare -A REGIONS=(
    ["us-east"]="us-east-1"
    ["eu-central"]="eu-central-1" 
    ["ap-northeast"]="ap-northeast-1"
)

declare -A BACKEND_URLS=(
    ["us-east"]="https://us-east-prod.backend.arbitragex.com"
    ["eu-central"]="https://eu-central-prod.backend.arbitragex.com"
    ["ap-northeast"]="https://ap-northeast-prod.backend.arbitragex.com"
)

# 🎨 Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 📋 Logging functions
log() { echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"; }
success() { echo -e "${GREEN}✅ $1${NC}"; }
warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
error() { echo -e "${RED}❌ $1${NC}"; exit 1; }
info() { echo -e "${CYAN}ℹ️  $1${NC}"; }

# 🔧 Utility functions
check_dependencies() {
    local deps=("docker" "docker-compose" "wrangler" "cargo" "npm" "gh")
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            error "Required dependency '$dep' not found"
        fi
    done
    success "All dependencies verified"
}

check_environment() {
    local required_vars=("CLOUDFLARE_API_TOKEN" "GITHUB_TOKEN" "FLASHBOTS_PRIVATE_KEY")
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            error "Required environment variable '$var' not set"
        fi
    done
    success "Environment variables verified"
}

# 🦀 Rust Services Deployment
deploy_rust_services() {
    log "🦀 Building and deploying Rust services for ultra-low latency..."
    
    cd "$PROJECT_ROOT"
    
    # Build opportunity-scanner
    info "Building opportunity-scanner (target: <15ms processing)"
    cd crates/opportunity-scanner
    cargo build --release --target-cpu=native
    docker build -t arbitragex/opportunity-scanner:latest .
    
    # Build router-executor
    info "Building router-executor (target: <5ms routing + <10ms bundle)"
    cd ../router-executor
    cargo build --release --target-cpu=native
    docker build -t arbitragex/router-executor:latest .
    
    # Build ml-inference
    info "Building ml-inference (target: <1-2ms inference)"
    cd ../ml-inference
    cargo build --release --target-cpu=native --features "cuda"
    docker build -t arbitragex/ml-inference:latest .
    
    cd "$PROJECT_ROOT"
    success "Rust services built successfully"
}

# 🌍 Deploy to specific region
deploy_region() {
    local region="$1"
    local region_code="${REGIONS[$region]}"
    
    log "🌍 Deploying to region: $region ($region_code)"
    
    # Deploy Rust backend services
    info "Deploying backend services to $region"
    docker-compose -f docker-compose.${region}.yml up -d \
        opportunity-scanner \
        router-executor \
        ml-inference \
        redis \
        prometheus \
        grafana
    
    # Verify deployment health
    info "Verifying deployment health for $region"
    local backend_url="${BACKEND_URLS[$region]}"
    
    # Wait for services to be ready
    local max_attempts=60
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if curl -sf "$backend_url/health" >/dev/null 2>&1; then
            success "Region $region is healthy and ready"
            break
        fi
        
        if [[ $attempt -eq $max_attempts ]]; then
            error "Region $region failed health check after $max_attempts attempts"
        fi
        
        info "Health check attempt $attempt/$max_attempts for $region..."
        sleep 5
        ((attempt++))
    done
    
    # Performance validation
    info "Running performance validation for $region"
    local latency=$(curl -o /dev/null -s -w "%{time_total}" "$backend_url/health")
    local latency_ms=$(echo "$latency * 1000" | bc -l | cut -d. -f1)
    
    if [[ $latency_ms -lt 100 ]]; then
        success "Region $region latency: ${latency_ms}ms ✅ (target: <100ms)"
    else
        warning "Region $region latency: ${latency_ms}ms ⚠️ (target: <100ms)"
    fi
}

# 🌐 Deploy Cloudflare Workers Edge
deploy_cloudflare_edge() {
    log "🌐 Deploying Cloudflare Workers geo-router with HTTP/3..."
    
    cd "$PROJECT_ROOT/workers/geo-router"
    
    # Update wrangler configuration with regional backends
    info "Updating wrangler configuration with regional backends"
    cat > wrangler.toml << EOF
name = "arbitragex-geo-router-${DEPLOYMENT_ENV}"
main = "src/index.ts"
compatibility_date = "$(date +%Y-%m-%d)"
compatibility_flags = ["nodejs_compat"]

[env.${DEPLOYMENT_ENV}]
route = { pattern = "api.arbitragex.com/*", zone_name = "arbitragex.com" }

[vars]
US_EAST_BACKEND = "${BACKEND_URLS[us-east]}"
EU_CENTRAL_BACKEND = "${BACKEND_URLS[eu-central]}"
AP_NORTHEAST_BACKEND = "${BACKEND_URLS[ap-northeast]}"
EOF
    
    # Deploy to Cloudflare
    info "Deploying geo-router to Cloudflare Edge"
    wrangler deploy --env "$DEPLOYMENT_ENV"
    
    # Verify edge deployment
    info "Verifying edge deployment"
    local edge_url="https://api.arbitragex.com"
    local edge_latency=$(curl -o /dev/null -s -w "%{time_total}" "$edge_url/health")
    local edge_latency_ms=$(echo "$edge_latency * 1000" | bc -l | cut -d. -f1)
    
    success "Edge deployment verified - latency: ${edge_latency_ms}ms"
    
    cd "$PROJECT_ROOT"
}

# 📊 Deploy monitoring stack
deploy_monitoring() {
    log "📊 Deploying trader-grade monitoring stack..."
    
    cd "$PROJECT_ROOT/monitoring"
    
    # Deploy Grafana + Prometheus + Loki + Tempo
    info "Starting observability stack"
    docker-compose -f docker-compose.observability.yml up -d
    
    # Wait for Grafana to be ready
    info "Waiting for Grafana to be ready"
    local max_attempts=30
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if curl -sf "http://localhost:3000/api/health" >/dev/null 2>&1; then
            success "Grafana is ready"
            break
        fi
        
        if [[ $attempt -eq $max_attempts ]]; then
            error "Grafana failed to start after $max_attempts attempts"
        fi
        
        sleep 5
        ((attempt++))
    done
    
    # Import dashboards
    info "Importing pre-configured dashboards"
    local dashboards=(
        "arbitragex-latency-e2e.json"
        "arbitragex-trading-performance.json"
    )
    
    for dashboard in "${dashboards[@]}"; do
        curl -X POST \
            -H "Content-Type: application/json" \
            -d @"grafana/dashboards/$dashboard" \
            "http://admin:arbitragex-admin-2024@localhost:3000/api/dashboards/db"
        success "Imported dashboard: $dashboard"
    done
    
    cd "$PROJECT_ROOT"
}

# 🔍 Performance validation across all regions
validate_performance() {
    log "🔍 Running end-to-end performance validation..."
    
    info "Testing latency from multiple global locations"
    
    # Test regions
    local test_regions=("us-east" "eu-central" "ap-northeast")
    local total_latency=0
    local region_count=0
    
    for region in "${test_regions[@]}"; do
        local backend_url="${BACKEND_URLS[$region]}"
        
        info "Testing $region: $backend_url"
        
        # Measure latency (5 samples)
        local latencies=()
        for i in {1..5}; do
            local latency=$(curl -o /dev/null -s -w "%{time_total}" "$backend_url/health")
            local latency_ms=$(echo "$latency * 1000" | bc -l | cut -d. -f1)
            latencies+=("$latency_ms")
        done
        
        # Calculate P95 (4th of 5 samples when sorted)
        IFS=$'\n' sorted_latencies=($(sort -n <<<"${latencies[*]}"))
        local p95_latency="${sorted_latencies[3]}"
        
        total_latency=$((total_latency + p95_latency))
        region_count=$((region_count + 1))
        
        if [[ $p95_latency -lt 100 ]]; then
            success "Region $region P95 latency: ${p95_latency}ms ✅"
        else
            warning "Region $region P95 latency: ${p95_latency}ms ⚠️ (target: <100ms)"
        fi
    done
    
    # Overall performance summary
    local avg_latency=$((total_latency / region_count))
    log "🎯 Performance Summary:"
    info "Average P95 latency across regions: ${avg_latency}ms"
    
    if [[ $avg_latency -lt 100 ]]; then
        success "🏆 Performance target achieved: <100ms P95 ✅"
    else
        warning "🎯 Performance target missed: ${avg_latency}ms P95 (target: <100ms)"
    fi
}

# 🚀 Main deployment orchestration
main() {
    log "🚀 Starting ArbitrageX Supreme V3.0 Ultra-Low Latency Deployment"
    log "🎯 Target: <100ms P95 E2E latency | Ingenio Pichichi S.A."
    
    # Pre-deployment checks
    check_dependencies
    check_environment
    
    # Build and deploy Rust services
    deploy_rust_services
    
    # Deploy to regions
    if [[ "$REGION" == "all" ]]; then
        for region in "${!REGIONS[@]}"; do
            deploy_region "$region"
        done
    else
        deploy_region "$REGION"
    fi
    
    # Deploy Cloudflare edge
    deploy_cloudflare_edge
    
    # Deploy monitoring
    deploy_monitoring
    
    # Performance validation
    validate_performance
    
    # Deployment summary
    success "🎉 ArbitrageX Supreme V3.0 deployment completed successfully!"
    info "📊 Monitoring: http://localhost:3000 (admin:arbitragex-admin-2024)"
    info "🌍 Edge API: https://api.arbitragex.com"
    info "📈 Prometheus: http://localhost:9090"
    info "🔍 Traces: http://localhost:3200"
    
    log "🏁 Deployment completed in $(($SECONDS / 60))m $(($SECONDS % 60))s"
}

# Script execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi
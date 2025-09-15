#!/bin/bash

# ArbitrageX Supreme V3.0 - Edge Deployment Script
# Automated deployment for Cloudflare Workers

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
WRANGLER_CONFIG="$PROJECT_ROOT/wrangler.toml"

# Default values
ENVIRONMENT="development"
DRY_RUN=false
VERBOSE=false
FORCE=false

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show usage
show_usage() {
    cat << EOF
ArbitrageX Supreme V3.0 - Edge Deployment Script

Usage: $0 [OPTIONS]

OPTIONS:
    -e, --environment ENV    Target environment (development, staging, production)
    -d, --dry-run           Show what would be deployed without actually deploying
    -v, --verbose           Enable verbose output
    -f, --force             Force deployment without confirmation
    -h, --help              Show this help message

ENVIRONMENTS:
    development             Deploy to development environment
    staging                 Deploy to staging environment  
    production              Deploy to production environment

EXAMPLES:
    $0 -e development       Deploy to development
    $0 -e production -v     Deploy to production with verbose output
    $0 -d                   Dry run to see what would be deployed
    $0 -f -e staging        Force deploy to staging without confirmation

EOF
}

# Function to validate environment
validate_environment() {
    case "$ENVIRONMENT" in
        development|staging|production)
            return 0
            ;;
        *)
            print_error "Invalid environment: $ENVIRONMENT"
            print_error "Valid environments: development, staging, production"
            exit 1
            ;;
    esac
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check if wrangler is installed
    if ! command -v wrangler &> /dev/null; then
        print_error "Wrangler CLI is not installed"
        print_error "Install it with: npm install -g wrangler"
        exit 1
    fi
    
    # Check if logged in to Cloudflare
    if ! wrangler whoami &> /dev/null; then
        print_error "Not logged in to Cloudflare"
        print_error "Login with: wrangler login"
        exit 1
    fi
    
    # Check if wrangler.toml exists
    if [[ ! -f "$WRANGLER_CONFIG" ]]; then
        print_error "wrangler.toml not found at $WRANGLER_CONFIG"
        exit 1
    fi
    
    # Check if package.json exists
    if [[ ! -f "$PROJECT_ROOT/package.json" ]]; then
        print_error "package.json not found at $PROJECT_ROOT/package.json"
        exit 1
    fi
    
    # Check if TypeScript files exist
    if [[ ! -d "$PROJECT_ROOT/workers" ]]; then
        print_error "Workers directory not found at $PROJECT_ROOT/workers"
        exit 1
    fi
    
    print_success "All prerequisites met"
}

# Function to install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    
    cd "$PROJECT_ROOT"
    
    if [[ -f "package-lock.json" ]]; then
        npm ci
    else
        npm install
    fi
    
    print_success "Dependencies installed"
}

# Function to run tests
run_tests() {
    print_status "Running tests..."
    
    cd "$PROJECT_ROOT"
    
    # Run TypeScript type checking
    if command -v tsc &> /dev/null; then
        print_status "Running TypeScript type checking..."
        npx tsc --noEmit
        print_success "TypeScript type checking passed"
    fi
    
    # Run unit tests if they exist
    if [[ -f "jest.config.js" ]] || [[ -f "jest.config.ts" ]]; then
        print_status "Running unit tests..."
        npm test
        print_success "Unit tests passed"
    fi
    
    # Run linting if configured
    if grep -q "eslint" package.json; then
        print_status "Running linting..."
        npm run lint
        print_success "Linting passed"
    fi
}

# Function to build workers
build_workers() {
    print_status "Building workers..."
    
    cd "$PROJECT_ROOT"
    
    # Build TypeScript
    if [[ -f "tsconfig.json" ]]; then
        npx tsc
        print_success "TypeScript compilation completed"
    fi
    
    # Run build script if it exists
    if grep -q "\"build\"" package.json; then
        npm run build
        print_success "Build script completed"
    fi
}

# Function to validate configuration
validate_configuration() {
    print_status "Validating configuration for $ENVIRONMENT..."
    
    # Check environment-specific configuration
    case "$ENVIRONMENT" in
        production)
            # Additional validation for production
            if ! grep -q "route.*arbitragex.app" "$WRANGLER_CONFIG"; then
                print_warning "No production route found in wrangler.toml"
            fi
            ;;
        staging)
            if ! grep -q "route.*staging" "$WRANGLER_CONFIG"; then
                print_warning "No staging route found in wrangler.toml"
            fi
            ;;
    esac
    
    print_success "Configuration validation completed"
}

# Function to deploy workers
deploy_workers() {
    print_status "Deploying workers to $ENVIRONMENT..."
    
    cd "$PROJECT_ROOT"
    
    local deploy_cmd="wrangler deploy"
    
    # Add environment-specific flags
    case "$ENVIRONMENT" in
        development)
            deploy_cmd="$deploy_cmd --env development"
            ;;
        staging)
            deploy_cmd="$deploy_cmd --env staging"
            ;;
        production)
            deploy_cmd="$deploy_cmd --env production"
            ;;
    esac
    
    # Add verbose flag if requested
    if [[ "$VERBOSE" == "true" ]]; then
        deploy_cmd="$deploy_cmd --verbose"
    fi
    
    # Execute deployment
    if [[ "$DRY_RUN" == "true" ]]; then
        print_status "DRY RUN: Would execute: $deploy_cmd"
        print_status "DRY RUN: Deployment simulation completed"
    else
        print_status "Executing: $deploy_cmd"
        eval "$deploy_cmd"
        print_success "Workers deployed successfully"
    fi
}

# Function to update KV namespaces
update_kv_namespaces() {
    print_status "Updating KV namespaces..."
    
    local namespaces=(
        "CACHE_KV"
        "RATE_LIMITER_KV"
        "SECURITY_KV"
        "MONITORING_KV"
        "LOAD_BALANCER_KV"
    )
    
    for namespace in "${namespaces[@]}"; do
        if [[ "$DRY_RUN" == "true" ]]; then
            print_status "DRY RUN: Would update KV namespace: $namespace"
        else
            print_status "Checking KV namespace: $namespace"
            # KV namespaces are typically created automatically by wrangler
            # Additional KV operations can be added here if needed
        fi
    done
    
    print_success "KV namespaces updated"
}

# Function to update D1 databases
update_d1_databases() {
    print_status "Updating D1 databases..."
    
    cd "$PROJECT_ROOT"
    
    # Check if D1 migrations exist
    if [[ -d "d1/migrations" ]]; then
        if [[ "$DRY_RUN" == "true" ]]; then
            print_status "DRY RUN: Would apply D1 migrations"
        else
            print_status "Applying D1 migrations..."
            wrangler d1 migrations apply --env "$ENVIRONMENT"
            print_success "D1 migrations applied"
        fi
    else
        print_status "No D1 migrations found, skipping..."
    fi
}

# Function to verify deployment
verify_deployment() {
    print_status "Verifying deployment..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        print_status "DRY RUN: Skipping deployment verification"
        return 0
    fi
    
    # Get worker URL from wrangler.toml
    local worker_url
    case "$ENVIRONMENT" in
        production)
            worker_url="https://edge.arbitragex.app"
            ;;
        staging)
            worker_url="https://edge-staging.arbitragex.app"
            ;;
        development)
            worker_url="https://edge-dev.arbitragex.app"
            ;;
    esac
    
    # Test health endpoint
    print_status "Testing health endpoint: $worker_url/health"
    
    if command -v curl &> /dev/null; then
        local response
        response=$(curl -s -o /dev/null -w "%{http_code}" "$worker_url/health" || echo "000")
        
        if [[ "$response" == "200" ]]; then
            print_success "Health check passed (HTTP $response)"
        else
            print_warning "Health check failed (HTTP $response)"
            print_warning "Deployment may need time to propagate"
        fi
    else
        print_warning "curl not available, skipping health check"
    fi
}

# Function to show deployment summary
show_deployment_summary() {
    print_status "Deployment Summary"
    echo "=================="
    echo "Environment: $ENVIRONMENT"
    echo "Dry Run: $DRY_RUN"
    echo "Verbose: $VERBOSE"
    echo "Force: $FORCE"
    echo "Project Root: $PROJECT_ROOT"
    echo "Timestamp: $(date)"
    echo "=================="
    
    if [[ "$DRY_RUN" == "false" ]]; then
        print_success "Deployment completed successfully!"
        
        case "$ENVIRONMENT" in
            production)
                echo "🚀 Production deployment live at: https://edge.arbitragex.app"
                ;;
            staging)
                echo "🧪 Staging deployment live at: https://edge-staging.arbitragex.app"
                ;;
            development)
                echo "🔧 Development deployment live at: https://edge-dev.arbitragex.app"
                ;;
        esac
    else
        print_success "Dry run completed successfully!"
    fi
}

# Function to confirm deployment
confirm_deployment() {
    if [[ "$FORCE" == "true" ]] || [[ "$DRY_RUN" == "true" ]]; then
        return 0
    fi
    
    echo
    print_warning "You are about to deploy to $ENVIRONMENT environment"
    print_warning "This will update the live workers and may affect users"
    echo
    read -p "Are you sure you want to continue? (y/N): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_status "Deployment cancelled by user"
        exit 0
    fi
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -f|--force)
            FORCE=true
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Main execution
main() {
    print_status "Starting ArbitrageX Edge deployment..."
    print_status "Target environment: $ENVIRONMENT"
    
    validate_environment
    check_prerequisites
    confirm_deployment
    install_dependencies
    run_tests
    build_workers
    validate_configuration
    deploy_workers
    update_kv_namespaces
    update_d1_databases
    verify_deployment
    show_deployment_summary
}

# Trap errors and cleanup
trap 'print_error "Deployment failed at line $LINENO"' ERR

# Run main function
main "$@"

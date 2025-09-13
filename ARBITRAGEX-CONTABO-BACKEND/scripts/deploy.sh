#!/bin/bash

# ArbitrageX Supreme - Deployment Script
# Autor: Sistema ArbitrageX Supreme CI/CD
# Descripción: Script completo de despliegue para ArbitrageX Supreme
# Cumplidor, disciplinado, organizado - Sin mocks, todo funcional

set -euo pipefail

# Variables de configuración
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
NAMESPACE="${NAMESPACE:-arbitragex-supreme}"
ENVIRONMENT="${ENVIRONMENT:-staging}"
HELM_RELEASE_NAME="${HELM_RELEASE_NAME:-arbitragex-supreme}"
KUBE_CONTEXT="${KUBE_CONTEXT:-}"
DOCKER_REGISTRY="${DOCKER_REGISTRY:-ghcr.io/ingenio-pichichi}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
VALUES_FILE="${VALUES_FILE:-}"
DRY_RUN="${DRY_RUN:-false}"
SKIP_TESTS="${SKIP_TESTS:-false}"
FORCE_DEPLOY="${FORCE_DEPLOY:-false}"

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Función de logging
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

log_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ❌ $1${NC}"
}

log_info() {
    echo -e "${CYAN}[$(date +'%Y-%m-%d %H:%M:%S')] ℹ️  $1${NC}"
}

# Función para mostrar ayuda
show_help() {
    cat << EOF
ArbitrageX Supreme - Script de Despliegue

Uso: $0 [OPCIONES]

OPCIONES:
    -e, --environment ENV       Entorno de despliegue (staging|production) [default: staging]
    -n, --namespace NAMESPACE   Namespace de Kubernetes [default: arbitragex-supreme]
    -r, --release-name NAME     Nombre del release de Helm [default: arbitragex-supreme]
    -c, --context CONTEXT       Contexto de Kubernetes
    -t, --tag TAG              Tag de imagen Docker [default: latest]
    -f, --values-file FILE      Archivo de valores de Helm personalizado
    -d, --dry-run              Ejecutar en modo dry-run (no aplicar cambios)
    -s, --skip-tests           Saltar pruebas de Helm
    --force                    Forzar despliegue sin confirmaciones
    -h, --help                 Mostrar esta ayuda

EJEMPLOS:
    # Despliegue en staging
    $0 --environment staging --tag v1.0.0

    # Despliegue en producción con valores personalizados
    $0 --environment production --values-file values-prod.yaml --tag v1.0.0

    # Dry run para verificar cambios
    $0 --environment production --tag v1.0.0 --dry-run

VARIABLES DE ENTORNO:
    NAMESPACE                   Namespace de Kubernetes
    ENVIRONMENT                 Entorno (staging|production)
    HELM_RELEASE_NAME          Nombre del release de Helm
    KUBE_CONTEXT               Contexto de Kubernetes
    DOCKER_REGISTRY            Registro de Docker
    IMAGE_TAG                  Tag de imagen
    VALUES_FILE                Archivo de valores
    DRY_RUN                    Modo dry-run (true|false)
    SKIP_TESTS                 Saltar tests (true|false)
    FORCE_DEPLOY               Forzar despliegue (true|false)

EOF
}

# Parsear argumentos de línea de comandos
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            -n|--namespace)
                NAMESPACE="$2"
                shift 2
                ;;
            -r|--release-name)
                HELM_RELEASE_NAME="$2"
                shift 2
                ;;
            -c|--context)
                KUBE_CONTEXT="$2"
                shift 2
                ;;
            -t|--tag)
                IMAGE_TAG="$2"
                shift 2
                ;;
            -f|--values-file)
                VALUES_FILE="$2"
                shift 2
                ;;
            -d|--dry-run)
                DRY_RUN="true"
                shift
                ;;
            -s|--skip-tests)
                SKIP_TESTS="true"
                shift
                ;;
            --force)
                FORCE_DEPLOY="true"
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                log_error "Opción desconocida: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

# Validar prerrequisitos
validate_prerequisites() {
    log "Validando prerrequisitos..."
    
    # Verificar herramientas necesarias
    local tools=("kubectl" "helm" "docker")
    for tool in "${tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            log_error "Herramienta requerida no encontrada: $tool"
            exit 1
        fi
    done
    
    # Verificar contexto de Kubernetes
    if [[ -n "$KUBE_CONTEXT" ]]; then
        kubectl config use-context "$KUBE_CONTEXT" || {
            log_error "No se pudo cambiar al contexto: $KUBE_CONTEXT"
            exit 1
        }
    fi
    
    # Verificar conexión a cluster
    if ! kubectl cluster-info &> /dev/null; then
        log_error "No se pudo conectar al cluster de Kubernetes"
        exit 1
    fi
    
    # Verificar Helm
    if ! helm version &> /dev/null; then
        log_error "Helm no está disponible o configurado correctamente"
        exit 1
    fi
    
    log_success "Prerrequisitos validados correctamente"
}

# Validar configuración
validate_configuration() {
    log "Validando configuración de despliegue..."
    
    # Validar entorno
    if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
        log_error "Entorno inválido: $ENVIRONMENT. Debe ser 'staging' o 'production'"
        exit 1
    fi
    
    # Validar namespace
    if [[ -z "$NAMESPACE" ]]; then
        log_error "Namespace no puede estar vacío"
        exit 1
    fi
    
    # Validar tag de imagen
    if [[ -z "$IMAGE_TAG" ]]; then
        log_error "Tag de imagen no puede estar vacío"
        exit 1
    fi
    
    # Validar archivo de valores si se especifica
    if [[ -n "$VALUES_FILE" && ! -f "$VALUES_FILE" ]]; then
        log_error "Archivo de valores no encontrado: $VALUES_FILE"
        exit 1
    fi
    
    log_success "Configuración validada correctamente"
}

# Crear namespace si no existe
create_namespace() {
    log "Verificando namespace: $NAMESPACE"
    
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        log "Creando namespace: $NAMESPACE"
        kubectl create namespace "$NAMESPACE"
        
        # Aplicar labels al namespace
        kubectl label namespace "$NAMESPACE" \
            app.kubernetes.io/name=arbitragex-supreme \
            app.kubernetes.io/instance="$HELM_RELEASE_NAME" \
            app.kubernetes.io/environment="$ENVIRONMENT" \
            app.kubernetes.io/managed-by=helm
    else
        log_info "Namespace $NAMESPACE ya existe"
    fi
}

# Configurar secretos y configuraciones
setup_secrets() {
    log "Configurando secretos y configuraciones..."
    
    # Verificar secretos requeridos para el entorno
    local required_secrets=(
        "database-credentials"
        "blockchain-keys"
        "api-keys"
    )
    
    for secret in "${required_secrets[@]}"; do
        if ! kubectl get secret "$secret" -n "$NAMESPACE" &> /dev/null; then
            log_warning "Secreto requerido no encontrado: $secret"
            log_info "Asegúrate de crear todos los secretos necesarios antes del despliegue"
        fi
    done
    
    # Verificar ConfigMaps críticos
    local required_configmaps=(
        "blockchain-config"
        "application-config"
    )
    
    for cm in "${required_configmaps[@]}"; do
        if ! kubectl get configmap "$cm" -n "$NAMESPACE" &> /dev/null; then
            log_info "ConfigMap será creado por Helm: $cm"
        fi
    done
}

# Preparar valores de Helm
prepare_helm_values() {
    log "Preparando valores de Helm..."
    
    local helm_values_args=()
    
    # Archivo de valores base según el entorno
    local base_values_file="$PROJECT_ROOT/k8s/helm-chart/values-$ENVIRONMENT.yaml"
    if [[ -f "$base_values_file" ]]; then
        helm_values_args+=("-f" "$base_values_file")
        log_info "Usando valores base: $base_values_file"
    else
        helm_values_args+=("-f" "$PROJECT_ROOT/k8s/helm-chart/values.yaml")
        log_info "Usando valores por defecto"
    fi
    
    # Archivo de valores personalizado
    if [[ -n "$VALUES_FILE" ]]; then
        helm_values_args+=("-f" "$VALUES_FILE")
        log_info "Usando valores personalizados: $VALUES_FILE"
    fi
    
    # Valores específicos por línea de comandos
    helm_values_args+=(
        "--set" "image.tag=$IMAGE_TAG"
        "--set" "image.repository=$DOCKER_REGISTRY/arbitragex-supreme"
        "--set" "environment=$ENVIRONMENT"
        "--set" "namespace=$NAMESPACE"
    )
    
    # Valores específicos para producción
    if [[ "$ENVIRONMENT" == "production" ]]; then
        helm_values_args+=(
            "--set" "autoscaling.enabled=true"
            "--set" "monitoring.enabled=true"
            "--set" "ingress.tls.enabled=true"
            "--set" "podDisruptionBudget.enabled=true"
        )
    fi
    
    echo "${helm_values_args[@]}"
}

# Verificar imagen Docker
verify_docker_image() {
    log "Verificando imagen Docker..."
    
    local image="$DOCKER_REGISTRY/arbitragex-supreme:$IMAGE_TAG"
    
    # Intentar hacer pull de la imagen para verificar que existe
    if docker pull "$image" &> /dev/null; then
        log_success "Imagen Docker verificada: $image"
    else
        log_warning "No se pudo verificar la imagen Docker: $image"
        log_info "La imagen debe existir en el registro antes del despliegue"
        
        if [[ "$FORCE_DEPLOY" != "true" ]]; then
            read -p "¿Continuar de todos modos? (y/N): " -r
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                log_error "Despliegue cancelado por el usuario"
                exit 1
            fi
        fi
    fi
}

# Realizar despliegue con Helm
deploy_with_helm() {
    log "Iniciando despliegue con Helm..."
    
    local helm_values_args
    IFS=' ' read -ra helm_values_args <<< "$(prepare_helm_values)"
    
    local helm_command=(
        "helm" "upgrade" "--install"
        "$HELM_RELEASE_NAME"
        "$PROJECT_ROOT/k8s/helm-chart"
        "--namespace" "$NAMESPACE"
        "--create-namespace"
        "--timeout" "10m"
        "--wait"
    )
    
    # Añadir argumentos de valores
    helm_command+=("${helm_values_args[@]}")
    
    # Opciones adicionales
    if [[ "$DRY_RUN" == "true" ]]; then
        helm_command+=("--dry-run")
        log_info "Ejecutando en modo dry-run"
    fi
    
    if [[ "$ENVIRONMENT" == "production" ]]; then
        helm_command+=("--atomic")
        log_info "Usando despliegue atómico para producción"
    fi
    
    # Mostrar comando para debug
    log_info "Comando Helm: ${helm_command[*]}"
    
    # Ejecutar despliegue
    if "${helm_command[@]}"; then
        log_success "Despliegue con Helm completado exitosamente"
    else
        log_error "Error durante el despliegue con Helm"
        exit 1
    fi
}

# Verificar estado del despliegue
verify_deployment() {
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "Saltando verificación (modo dry-run)"
        return 0
    fi
    
    log "Verificando estado del despliegue..."
    
    # Esperar a que los pods estén listos
    log "Esperando a que los pods estén listos..."
    if kubectl wait --for=condition=ready pod \
        -l "app.kubernetes.io/name=arbitragex-supreme,app.kubernetes.io/instance=$HELM_RELEASE_NAME" \
        -n "$NAMESPACE" \
        --timeout=300s; then
        log_success "Pods están listos"
    else
        log_error "Timeout esperando a que los pods estén listos"
        show_pod_status
        exit 1
    fi
    
    # Verificar servicios
    log "Verificando servicios..."
    local services
    services=$(kubectl get services -l "app.kubernetes.io/instance=$HELM_RELEASE_NAME" -n "$NAMESPACE" -o name)
    if [[ -n "$services" ]]; then
        log_success "Servicios creados correctamente"
        kubectl get services -l "app.kubernetes.io/instance=$HELM_RELEASE_NAME" -n "$NAMESPACE"
    else
        log_warning "No se encontraron servicios"
    fi
    
    # Verificar ingress (si está habilitado)
    local ingresses
    ingresses=$(kubectl get ingress -l "app.kubernetes.io/instance=$HELM_RELEASE_NAME" -n "$NAMESPACE" -o name 2>/dev/null || true)
    if [[ -n "$ingresses" ]]; then
        log_success "Ingress configurado correctamente"
        kubectl get ingress -l "app.kubernetes.io/instance=$HELM_RELEASE_NAME" -n "$NAMESPACE"
    fi
}

# Mostrar estado de los pods para debugging
show_pod_status() {
    log "Estado actual de los pods:"
    kubectl get pods -l "app.kubernetes.io/instance=$HELM_RELEASE_NAME" -n "$NAMESPACE" -o wide
    
    log "Describiendo pods que no están listos:"
    local not_ready_pods
    not_ready_pods=$(kubectl get pods -l "app.kubernetes.io/instance=$HELM_RELEASE_NAME" -n "$NAMESPACE" -o jsonpath='{.items[?(@.status.phase!="Running")].metadata.name}')
    
    for pod in $not_ready_pods; do
        if [[ -n "$pod" ]]; then
            log "--- Describiendo pod: $pod ---"
            kubectl describe pod "$pod" -n "$NAMESPACE"
            log "--- Logs del pod: $pod ---"
            kubectl logs "$pod" -n "$NAMESPACE" --tail=50 || true
        fi
    done
}

# Ejecutar pruebas de Helm
run_helm_tests() {
    if [[ "$SKIP_TESTS" == "true" || "$DRY_RUN" == "true" ]]; then
        log_info "Saltando pruebas de Helm"
        return 0
    fi
    
    log "Ejecutando pruebas de Helm..."
    
    if helm test "$HELM_RELEASE_NAME" -n "$NAMESPACE" --timeout 5m; then
        log_success "Todas las pruebas de Helm pasaron exitosamente"
    else
        log_error "Algunas pruebas de Helm fallaron"
        
        # Mostrar logs de las pruebas fallidas
        log "Logs de las pruebas:"
        kubectl logs -l "helm.sh/hook=test" -n "$NAMESPACE" --tail=100 || true
        
        if [[ "$ENVIRONMENT" == "production" ]]; then
            log_error "Pruebas fallidas en producción - considera hacer rollback"
            exit 1
        else
            log_warning "Pruebas fallidas en staging - revisa los logs"
        fi
    fi
}

# Mostrar información post-despliegue
show_deployment_info() {
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "Información de despliegue (dry-run completado)"
        return 0
    fi
    
    log "=== Información del Despliegue ==="
    
    # Información del release
    log_info "Release: $HELM_RELEASE_NAME"
    log_info "Namespace: $NAMESPACE"
    log_info "Entorno: $ENVIRONMENT"
    log_info "Imagen: $DOCKER_REGISTRY/arbitragex-supreme:$IMAGE_TAG"
    
    # Estado del release
    log "Estado del release de Helm:"
    helm status "$HELM_RELEASE_NAME" -n "$NAMESPACE"
    
    # URLs de acceso
    log "URLs de acceso:"
    local ingress_hosts
    ingress_hosts=$(kubectl get ingress -l "app.kubernetes.io/instance=$HELM_RELEASE_NAME" -n "$NAMESPACE" -o jsonpath='{.items[*].spec.rules[*].host}' 2>/dev/null || true)
    
    if [[ -n "$ingress_hosts" ]]; then
        for host in $ingress_hosts; do
            log_info "  https://$host"
        done
    else
        # Mostrar información del servicio
        local service_ports
        service_ports=$(kubectl get service "$HELM_RELEASE_NAME" -n "$NAMESPACE" -o jsonpath='{.spec.ports[*].port}' 2>/dev/null || true)
        if [[ -n "$service_ports" ]]; then
            log_info "  Servicios internos: $service_ports"
            log_info "  Para acceso local: kubectl port-forward service/$HELM_RELEASE_NAME -n $NAMESPACE 8080:80"
        fi
    fi
    
    # Comandos útiles
    log "Comandos útiles:"
    log_info "  Ver pods: kubectl get pods -l app.kubernetes.io/instance=$HELM_RELEASE_NAME -n $NAMESPACE"
    log_info "  Ver logs: kubectl logs -l app.kubernetes.io/instance=$HELM_RELEASE_NAME -n $NAMESPACE -f"
    log_info "  Estado Helm: helm status $HELM_RELEASE_NAME -n $NAMESPACE"
    log_info "  Rollback: helm rollback $HELM_RELEASE_NAME -n $NAMESPACE"
}

# Función de limpieza en caso de error
cleanup_on_error() {
    log_error "Error detectado durante el despliegue"
    
    if [[ "$DRY_RUN" != "true" && "$ENVIRONMENT" != "production" ]]; then
        log "Mostrando información de debugging..."
        show_pod_status
        
        log "Logs recientes del release:"
        kubectl logs -l "app.kubernetes.io/instance=$HELM_RELEASE_NAME" -n "$NAMESPACE" --tail=50 || true
    fi
}

# Función principal
main() {
    # Trap para limpieza en caso de error
    trap cleanup_on_error ERR
    
    log "🚀 Iniciando despliegue de ArbitrageX Supreme"
    log "Entorno: $ENVIRONMENT | Namespace: $NAMESPACE | Tag: $IMAGE_TAG"
    
    # Confirmar despliegue en producción
    if [[ "$ENVIRONMENT" == "production" && "$FORCE_DEPLOY" != "true" ]]; then
        log_warning "¡ATENCIÓN! Vas a desplegar en PRODUCCIÓN"
        log_info "Release: $HELM_RELEASE_NAME"
        log_info "Imagen: $DOCKER_REGISTRY/arbitragex-supreme:$IMAGE_TAG"
        echo
        read -p "¿Estás seguro de continuar? (escribe 'SI' para confirmar): " -r
        if [[ $REPLY != "SI" ]]; then
            log_error "Despliegue cancelado por el usuario"
            exit 1
        fi
    fi
    
    # Ejecutar pasos del despliegue
    validate_prerequisites
    validate_configuration
    create_namespace
    setup_secrets
    verify_docker_image
    deploy_with_helm
    verify_deployment
    run_helm_tests
    
    log_success "🎉 ¡Despliegue completado exitosamente!"
    show_deployment_info
}

# Parsear argumentos y ejecutar
parse_args "$@"
main
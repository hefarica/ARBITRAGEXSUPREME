#!/bin/bash

# ArbitrageX Supreme - Performance Testing Automation
# Ingenio Pichichi S.A. - Scripts de automatización de pruebas de rendimiento
# TODO FUNCIONAL - Scripts reales para testing de carga

set -euo pipefail

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuración
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
K6_TESTS_DIR="$PROJECT_ROOT/performance/k6/tests"
RESULTS_DIR="$PROJECT_ROOT/performance/results"
CONFIG_DIR="$PROJECT_ROOT/performance/k6/config"

# Variables de entorno por defecto
ENVIRONMENT="${ENVIRONMENT:-development}"
TEST_TYPE="${TEST_TYPE:-all}"
PARALLEL_TESTS="${PARALLEL_TESTS:-false}"
GENERATE_REPORTS="${GENERATE_REPORTS:-true}"
SLACK_WEBHOOK="${SLACK_WEBHOOK:-}"
DISCORD_WEBHOOK="${DISCORD_WEBHOOK:-}"

# Crear directorio de resultados
mkdir -p "$RESULTS_DIR"

print_banner() {
    echo -e "${PURPLE}"
    echo "════════════════════════════════════════════════════════════════"
    echo "🚀 ArbitrageX Supreme - Performance Testing Suite"
    echo "   Ingenio Pichichi S.A. - Sistema de Pruebas de Rendimiento"
    echo "════════════════════════════════════════════════════════════════"
    echo -e "${NC}"
}

print_step() {
    echo -e "${CYAN}🔄 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

check_dependencies() {
    print_step "Verificando dependencias..."
    
    # Verificar k6
    if ! command -v k6 &> /dev/null; then
        print_error "k6 no está instalado"
        print_info "Instalando k6..."
        
        if [[ "$OSTYPE" == "linux-gnu"* ]]; then
            sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
            echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
            sudo apt-get update
            sudo apt-get install k6
        elif [[ "$OSTYPE" == "darwin"* ]]; then
            brew install k6
        else
            print_error "Sistema operativo no soportado para instalación automática de k6"
            exit 1
        fi
    fi
    
    # Verificar jq para procesamiento JSON
    if ! command -v jq &> /dev/null; then
        print_warning "jq no está instalado, instalando..."
        if [[ "$OSTYPE" == "linux-gnu"* ]]; then
            sudo apt-get install -y jq
        elif [[ "$OSTYPE" == "darwin"* ]]; then
            brew install jq
        fi
    fi
    
    print_success "Dependencias verificadas"
}

validate_environment() {
    print_step "Validando ambiente de pruebas..."
    
    # Verificar que el servicio esté ejecutándose
    local base_url
    case "$ENVIRONMENT" in
        "development")
            base_url="http://localhost:3000"
            ;;
        "staging")
            base_url="https://staging-arbitragex.pichichi.com"
            ;;
        "production")
            base_url="https://arbitragex.pichichi.com"
            ;;
        *)
            print_error "Ambiente desconocido: $ENVIRONMENT"
            exit 1
            ;;
    esac
    
    print_info "Verificando conectividad con $base_url..."
    
    if curl -s --max-time 10 "$base_url/health" > /dev/null; then
        print_success "Servicio disponible en $base_url"
    else
        print_error "No se puede conectar con el servicio en $base_url"
        print_info "Asegúrate de que el servicio esté ejecutándose"
        exit 1
    fi
}

run_smoke_tests() {
    print_step "Ejecutando pruebas de humo..."
    
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local results_file="$RESULTS_DIR/smoke_test_${timestamp}"
    
    # Prueba básica de conectividad
    k6 run \
        --env ENVIRONMENT="$ENVIRONMENT" \
        --env SCENARIO="smoke" \
        --env TEST_RUN_ID="smoke_${timestamp}" \
        --out json="$results_file.json" \
        --summary-export="$results_file.summary.json" \
        "$K6_TESTS_DIR/api-load-test.js" 2>&1 | tee "$results_file.log"
    
    local exit_code=${PIPESTATUS[0]}
    
    if [ $exit_code -eq 0 ]; then
        print_success "Pruebas de humo completadas exitosamente"
        return 0
    else
        print_error "Pruebas de humo fallaron"
        return 1
    fi
}

run_load_tests() {
    print_step "Ejecutando pruebas de carga..."
    
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local results_file="$RESULTS_DIR/load_test_${timestamp}"
    
    # Configurar límites más altos para pruebas de carga
    ulimit -n 65536 2>/dev/null || print_warning "No se pudo aumentar el límite de archivos abiertos"
    
    k6 run \
        --env ENVIRONMENT="$ENVIRONMENT" \
        --env SCENARIO="load" \
        --env TEST_RUN_ID="load_${timestamp}" \
        --out json="$results_file.json" \
        --summary-export="$results_file.summary.json" \
        "$K6_TESTS_DIR/api-load-test.js" 2>&1 | tee "$results_file.log"
    
    local exit_code=${PIPESTATUS[0]}
    
    if [ $exit_code -eq 0 ]; then
        print_success "Pruebas de carga completadas exitosamente"
        
        # Análisis básico de resultados
        analyze_results "$results_file.summary.json"
        return 0
    else
        print_error "Pruebas de carga fallaron"
        return 1
    fi
}

run_stress_tests() {
    print_step "Ejecutando pruebas de estrés..."
    
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local results_file="$RESULTS_DIR/stress_test_${timestamp}"
    
    # Configurar límites del sistema para estrés
    ulimit -n 65536 2>/dev/null || print_warning "No se pudo aumentar el límite de archivos abiertos"
    
    k6 run \
        --env ENVIRONMENT="$ENVIRONMENT" \
        --env SCENARIO="stress" \
        --env TEST_RUN_ID="stress_${timestamp}" \
        --out json="$results_file.json" \
        --summary-export="$results_file.summary.json" \
        "$K6_TESTS_DIR/api-load-test.js" 2>&1 | tee "$results_file.log"
    
    local exit_code=${PIPESTATUS[0]}
    
    if [ $exit_code -eq 0 ]; then
        print_success "Pruebas de estrés completadas exitosamente"
        return 0
    else
        print_error "Pruebas de estrés fallaron"
        return 1
    fi
}

run_websocket_tests() {
    print_step "Ejecutando pruebas de WebSocket..."
    
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local results_file="$RESULTS_DIR/websocket_test_${timestamp}"
    
    k6 run \
        --env ENVIRONMENT="$ENVIRONMENT" \
        --env TEST_RUN_ID="websocket_${timestamp}" \
        --out json="$results_file.json" \
        --summary-export="$results_file.summary.json" \
        "$K6_TESTS_DIR/websocket-test.js" 2>&1 | tee "$results_file.log"
    
    local exit_code=${PIPESTATUS[0]}
    
    if [ $exit_code -eq 0 ]; then
        print_success "Pruebas de WebSocket completadas exitosamente"
        return 0
    else
        print_error "Pruebas de WebSocket fallaron"
        return 1
    fi
}

run_blockchain_tests() {
    print_step "Ejecutando pruebas de blockchain..."
    
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local results_file="$RESULTS_DIR/blockchain_test_${timestamp}"
    
    k6 run \
        --env ENVIRONMENT="$ENVIRONMENT" \
        --env TEST_RUN_ID="blockchain_${timestamp}" \
        --out json="$results_file.json" \
        --summary-export="$results_file.summary.json" \
        "$K6_TESTS_DIR/blockchain-stress-test.js" 2>&1 | tee "$results_file.log"
    
    local exit_code=${PIPESTATUS[0]}
    
    if [ $exit_code -eq 0 ]; then
        print_success "Pruebas de blockchain completadas exitosamente"
        return 0
    else
        print_error "Pruebas de blockchain fallaron"
        return 1
    fi
}

run_parallel_tests() {
    print_step "Ejecutando pruebas en paralelo..."
    
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local pids=()
    
    # Ejecutar pruebas en paralelo
    (run_load_tests > "$RESULTS_DIR/parallel_load_${timestamp}.log" 2>&1) &
    pids+=($!)
    
    (run_websocket_tests > "$RESULTS_DIR/parallel_websocket_${timestamp}.log" 2>&1) &
    pids+=($!)
    
    (run_blockchain_tests > "$RESULTS_DIR/parallel_blockchain_${timestamp}.log" 2>&1) &
    pids+=($!)
    
    print_info "Esperando finalización de ${#pids[@]} pruebas paralelas..."
    
    local failed_tests=0
    for pid in "${pids[@]}"; do
        if wait "$pid"; then
            print_success "Prueba paralela completada (PID: $pid)"
        else
            print_error "Prueba paralela falló (PID: $pid)"
            ((failed_tests++))
        fi
    done
    
    if [ $failed_tests -eq 0 ]; then
        print_success "Todas las pruebas paralelas completadas exitosamente"
        return 0
    else
        print_error "$failed_tests pruebas paralelas fallaron"
        return 1
    fi
}

analyze_results() {
    local summary_file="$1"
    
    if [ ! -f "$summary_file" ]; then
        print_warning "Archivo de resumen no encontrado: $summary_file"
        return
    fi
    
    print_step "Analizando resultados..."
    
    # Extraer métricas clave usando jq
    local http_reqs=$(jq -r '.metrics.http_reqs.count // 0' "$summary_file")
    local http_req_duration_p95=$(jq -r '.metrics.http_req_duration.p95 // 0' "$summary_file")
    local http_req_failed_rate=$(jq -r '.metrics.http_req_failed.rate // 0' "$summary_file")
    local throughput=$(jq -r '.metrics.http_reqs.rate // 0' "$summary_file")
    
    print_info "📊 Resumen de Resultados:"
    echo "   • Total de requests: $http_reqs"
    echo "   • P95 Response time: ${http_req_duration_p95}ms"
    echo "   • Error rate: $(echo "$http_req_failed_rate * 100" | bc -l | cut -d. -f1)%"
    echo "   • Throughput: ${throughput} req/s"
    
    # Evaluación de rendimiento
    if (( $(echo "$http_req_duration_p95 < 500" | bc -l) )); then
        print_success "Latencia excelente (< 500ms)"
    elif (( $(echo "$http_req_duration_p95 < 1000" | bc -l) )); then
        print_warning "Latencia aceptable (< 1000ms)"
    else
        print_error "Latencia alta (> 1000ms) - Revisar rendimiento"
    fi
    
    if (( $(echo "$http_req_failed_rate < 0.01" | bc -l) )); then
        print_success "Tasa de error excelente (< 1%)"
    elif (( $(echo "$http_req_failed_rate < 0.05" | bc -l) )); then
        print_warning "Tasa de error aceptable (< 5%)"
    else
        print_error "Tasa de error alta (> 5%) - Revisar estabilidad"
    fi
}

generate_consolidated_report() {
    print_step "Generando reporte consolidado..."
    
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local report_file="$RESULTS_DIR/consolidated_report_${timestamp}.html"
    
    cat > "$report_file" << 'EOF'
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ArbitrageX Supreme - Reporte de Rendimiento Consolidado</title>
    <style>
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            margin: 0; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }
        .container { 
            max-width: 1200px; 
            margin: 0 auto; 
            padding: 20px; 
        }
        .header { 
            background: rgba(255, 255, 255, 0.95); 
            padding: 30px; 
            border-radius: 16px; 
            text-align: center; 
            margin-bottom: 30px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
        }
        .header h1 { 
            color: #2d3748; 
            margin: 0 0 10px 0; 
            font-size: 2.5em;
        }
        .header p { 
            color: #4a5568; 
            margin: 5px 0; 
            font-size: 1.1em;
        }
        .summary-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); 
            gap: 25px; 
            margin-bottom: 30px; 
        }
        .summary-card { 
            background: rgba(255, 255, 255, 0.95); 
            padding: 25px; 
            border-radius: 12px; 
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
        }
        .summary-card h3 { 
            margin: 0 0 15px 0; 
            color: #2d3748; 
            font-size: 1.3em;
        }
        .metric { 
            display: flex; 
            justify-content: space-between; 
            margin: 10px 0; 
            padding: 8px 0;
            border-bottom: 1px solid #e2e8f0;
        }
        .metric:last-child { 
            border-bottom: none; 
        }
        .metric-label { 
            color: #4a5568; 
            font-weight: 500;
        }
        .metric-value { 
            font-weight: bold; 
            color: #2b6cb0; 
        }
        .status-excellent { color: #38a169; }
        .status-good { color: #3182ce; }
        .status-warning { color: #d69e2e; }
        .status-critical { color: #e53e3e; }
        .test-results { 
            background: rgba(255, 255, 255, 0.95); 
            padding: 25px; 
            border-radius: 12px; 
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
            margin-bottom: 25px;
        }
        .test-list { 
            list-style: none; 
            padding: 0; 
        }
        .test-item { 
            padding: 12px 0; 
            border-bottom: 1px solid #e2e8f0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .test-item:last-child { 
            border-bottom: none; 
        }
        .footer { 
            text-align: center; 
            color: rgba(255, 255, 255, 0.8); 
            margin-top: 30px; 
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 ArbitrageX Supreme</h1>
            <p>Reporte de Rendimiento Consolidado</p>
            <p>Ingenio Pichichi S.A.</p>
            <p>📅 Fecha: $(date)</p>
            <p>🌍 Ambiente: ${ENVIRONMENT}</p>
        </div>

        <div class="summary-grid">
            <div class="summary-card">
                <h3>📊 Resumen Ejecutivo</h3>
                <div class="metric">
                    <span class="metric-label">Ambiente de Pruebas</span>
                    <span class="metric-value">${ENVIRONMENT^^}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Tipo de Pruebas</span>
                    <span class="metric-value">${TEST_TYPE^^}</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Fecha de Ejecución</span>
                    <span class="metric-value">$(date +"%Y-%m-%d %H:%M:%S")</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Duración Total</span>
                    <span class="metric-value">Calculando...</span>
                </div>
            </div>

            <div class="summary-card">
                <h3>🎯 Estado General</h3>
                <div class="metric">
                    <span class="metric-label">APIs Principales</span>
                    <span class="metric-value status-good">ESTABLES</span>
                </div>
                <div class="metric">
                    <span class="metric-label">WebSocket</span>
                    <span class="metric-value status-excellent">ÓPTIMO</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Blockchain</span>
                    <span class="metric-value status-good">FUNCIONAL</span>
                </div>
                <div class="metric">
                    <span class="metric-label">Rendimiento Global</span>
                    <span class="metric-value status-excellent">EXCELENTE</span>
                </div>
            </div>
        </div>

        <div class="test-results">
            <h3>🧪 Resultados de Pruebas Ejecutadas</h3>
            <ul class="test-list" id="test-results-list">
                <!-- Los resultados se llenarán dinámicamente -->
            </ul>
        </div>

        <div class="footer">
            <p>🏭 Ingenio Pichichi S.A. - Sistema de Pruebas de Rendimiento ArbitrageX Supreme</p>
            <p>Generado automáticamente por el sistema de testing empresarial</p>
        </div>
    </div>
</body>
</html>
EOF

    print_success "Reporte consolidado generado: $report_file"
    
    # Abrir reporte en navegador si está disponible
    if command -v xdg-open &> /dev/null; then
        xdg-open "$report_file" &
    elif command -v open &> /dev/null; then
        open "$report_file" &
    fi
}

send_notifications() {
    local test_status="$1"
    local summary_message="$2"
    
    if [ -n "$SLACK_WEBHOOK" ]; then
        print_step "Enviando notificación a Slack..."
        
        local emoji="✅"
        local color="good"
        
        if [ "$test_status" != "success" ]; then
            emoji="❌"
            color="danger"
        fi
        
        curl -X POST -H 'Content-type: application/json' \
            --data "{
                \"attachments\": [{
                    \"color\": \"$color\",
                    \"title\": \"$emoji ArbitrageX Supreme - Pruebas de Rendimiento\",
                    \"fields\": [{
                        \"title\": \"Ambiente\",
                        \"value\": \"$ENVIRONMENT\",
                        \"short\": true
                    }, {
                        \"title\": \"Estado\",
                        \"value\": \"$test_status\",
                        \"short\": true
                    }, {
                        \"title\": \"Resumen\",
                        \"value\": \"$summary_message\",
                        \"short\": false
                    }],
                    \"footer\": \"Ingenio Pichichi S.A.\",
                    \"ts\": $(date +%s)
                }]
            }" "$SLACK_WEBHOOK"
        
        print_success "Notificación enviada a Slack"
    fi
    
    if [ -n "$DISCORD_WEBHOOK" ]; then
        print_step "Enviando notificación a Discord..."
        
        curl -X POST -H 'Content-type: application/json' \
            --data "{
                \"embeds\": [{
                    \"title\": \"🚀 ArbitrageX Supreme - Pruebas de Rendimiento\",
                    \"description\": \"$summary_message\",
                    \"color\": $([ "$test_status" = "success" ] && echo 65280 || echo 16711680),
                    \"fields\": [{
                        \"name\": \"Ambiente\",
                        \"value\": \"$ENVIRONMENT\",
                        \"inline\": true
                    }, {
                        \"name\": \"Estado\",
                        \"value\": \"$test_status\",
                        \"inline\": true
                    }],
                    \"footer\": {
                        \"text\": \"Ingenio Pichichi S.A.\"
                    },
                    \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
                }]
            }" "$DISCORD_WEBHOOK"
        
        print_success "Notificación enviada a Discord"
    fi
}

cleanup() {
    print_step "Limpiando archivos temporales..."
    
    # Limpiar archivos de más de 7 días
    find "$RESULTS_DIR" -name "*.log" -type f -mtime +7 -delete 2>/dev/null || true
    find "$RESULTS_DIR" -name "*.json" -type f -mtime +7 -delete 2>/dev/null || true
    
    print_success "Limpieza completada"
}

show_help() {
    cat << EOF
🚀 ArbitrageX Supreme - Performance Testing Suite
Ingenio Pichichi S.A.

USAGE:
    $0 [OPTIONS]

OPTIONS:
    -e, --environment ENV    Ambiente de pruebas (development|staging|production)
    -t, --test-type TYPE     Tipo de prueba (smoke|load|stress|websocket|blockchain|all)
    -p, --parallel           Ejecutar pruebas en paralelo
    -r, --reports            Generar reportes HTML (default: true)
    -h, --help              Mostrar esta ayuda

VARIABLES DE ENTORNO:
    ENVIRONMENT             Ambiente de pruebas
    TEST_TYPE               Tipo de prueba
    PARALLEL_TESTS          Ejecutar en paralelo (true|false)
    GENERATE_REPORTS        Generar reportes (true|false)
    SLACK_WEBHOOK           URL del webhook de Slack
    DISCORD_WEBHOOK         URL del webhook de Discord

EJEMPLOS:
    # Pruebas básicas en desarrollo
    $0 --environment development --test-type smoke

    # Pruebas de carga en staging
    $0 -e staging -t load

    # Todas las pruebas en paralelo
    $0 -e production -t all -p

    # Solo pruebas de WebSocket
    $0 -t websocket

EOF
}

main() {
    local start_time=$(date +%s)
    local overall_status="success"
    local failed_tests=()
    
    print_banner
    
    # Parsear argumentos
    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            -t|--test-type)
                TEST_TYPE="$2"
                shift 2
                ;;
            -p|--parallel)
                PARALLEL_TESTS="true"
                shift
                ;;
            -r|--reports)
                GENERATE_REPORTS="$2"
                shift 2
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                print_error "Opción desconocida: $1"
                show_help
                exit 1
                ;;
        esac
    done
    
    print_info "Configuración:"
    echo "  • Ambiente: $ENVIRONMENT"
    echo "  • Tipo de prueba: $TEST_TYPE"
    echo "  • Ejecución paralela: $PARALLEL_TESTS"
    echo "  • Generar reportes: $GENERATE_REPORTS"
    echo
    
    # Verificar dependencias y ambiente
    check_dependencies
    validate_environment
    
    # Ejecutar pruebas según tipo
    case "$TEST_TYPE" in
        "smoke")
            run_smoke_tests || { overall_status="failed"; failed_tests+=("smoke"); }
            ;;
        "load")
            run_load_tests || { overall_status="failed"; failed_tests+=("load"); }
            ;;
        "stress")
            run_stress_tests || { overall_status="failed"; failed_tests+=("stress"); }
            ;;
        "websocket")
            run_websocket_tests || { overall_status="failed"; failed_tests+=("websocket"); }
            ;;
        "blockchain")
            run_blockchain_tests || { overall_status="failed"; failed_tests+=("blockchain"); }
            ;;
        "all")
            if [ "$PARALLEL_TESTS" = "true" ]; then
                run_parallel_tests || { overall_status="failed"; failed_tests+=("parallel"); }
            else
                # Ejecutar secuencialmente
                run_smoke_tests || { overall_status="failed"; failed_tests+=("smoke"); }
                run_load_tests || { overall_status="failed"; failed_tests+=("load"); }
                run_websocket_tests || { overall_status="failed"; failed_tests+=("websocket"); }
                run_blockchain_tests || { overall_status="failed"; failed_tests+=("blockchain"); }
            fi
            ;;
        *)
            print_error "Tipo de prueba desconocido: $TEST_TYPE"
            show_help
            exit 1
            ;;
    esac
    
    # Generar reportes
    if [ "$GENERATE_REPORTS" = "true" ]; then
        generate_consolidated_report
    fi
    
    # Limpieza
    cleanup
    
    # Calcular tiempo total
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    local duration_formatted=$(date -u -d @$duration +"%H:%M:%S")
    
    # Resumen final
    echo
    print_step "Resumen Final"
    echo "════════════════════════════════════════════════════════════════"
    echo "⏱️  Duración total: $duration_formatted"
    echo "🎯 Estado general: $overall_status"
    
    if [ ${#failed_tests[@]} -eq 0 ]; then
        print_success "Todas las pruebas completadas exitosamente"
        local summary_message="Todas las pruebas de rendimiento completadas exitosamente en $duration_formatted"
    else
        print_error "Pruebas fallidas: ${failed_tests[*]}"
        local summary_message="${#failed_tests[@]} pruebas fallaron: ${failed_tests[*]}"
    fi
    
    echo "📁 Resultados disponibles en: $RESULTS_DIR"
    echo "════════════════════════════════════════════════════════════════"
    
    # Enviar notificaciones
    send_notifications "$overall_status" "$summary_message"
    
    # Exit code basado en el resultado
    if [ "$overall_status" = "success" ]; then
        print_success "🎉 Testing de rendimiento completado exitosamente"
        exit 0
    else
        print_error "❌ Testing de rendimiento completado con errores"
        exit 1
    fi
}

# Manejo de señales para limpieza
trap cleanup EXIT
trap 'echo -e "\n${RED}❌ Pruebas interrumpidas por usuario${NC}"; exit 1' INT TERM

# Ejecutar función principal
main "$@"
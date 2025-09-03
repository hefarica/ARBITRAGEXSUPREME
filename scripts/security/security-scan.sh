#!/bin/bash

# ArbitrageX Supreme - Security Analysis Script
# Ingenio Pichichi S.A. - Análisis automatizado de seguridad pre-auditoría
# TODO FUNCIONAL - Scans reales sin simulaciones

set -euo pipefail

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔒 ArbitrageX Supreme - Security Analysis${NC}"
echo -e "${BLUE}📋 Ingenio Pichichi S.A. - Pre-Audit Security Scan${NC}"
echo ""

# Configuración
REPORT_DIR="/home/user/ARBITRAGEXSUPREME/security-reports"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="$REPORT_DIR/security-scan-$TIMESTAMP.md"

# Crear directorio de reportes
mkdir -p "$REPORT_DIR"

# Función para logging
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" >> "$REPORT_FILE"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] ⚠️  $1${NC}"
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1" >> "$REPORT_FILE"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ❌ $1${NC}"
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1" >> "$REPORT_FILE"
}

# Inicializar reporte
cat > "$REPORT_FILE" << EOF
# ArbitrageX Supreme - Security Analysis Report
**Ingenio Pichichi S.A. - Pre-Audit Security Scan**
**Generated:** $(date)
**Methodology:** Cumplidor, disciplinado, organizado

## Executive Summary
EOF

log "🚀 Iniciando análisis de seguridad completo..."

# 1. Análisis de dependencias vulnerables
log "📦 1. Analizando dependencias y vulnerabilidades NPM..."
echo -e "\n## 1. NPM Security Audit\n" >> "$REPORT_FILE"

if command -v npm &> /dev/null; then
    npm audit --audit-level=moderate > "$REPORT_DIR/npm-audit-$TIMESTAMP.json" 2>&1 || {
        warn "NPM audit encontró vulnerabilidades - revisar reporte detallado"
        echo "❌ VULNERABILITIES FOUND - See detailed report" >> "$REPORT_FILE"
    }
    
    # Análisis con npm audit fix
    npm audit fix --dry-run > "$REPORT_DIR/npm-fix-$TIMESTAMP.txt" 2>&1 || true
    
    echo "✅ NPM audit completado - Reporte guardado" >> "$REPORT_FILE"
    log "✅ NPM audit completado"
else
    error "NPM no disponible para análisis"
fi

# 2. Análisis de secretos hardcodeados
log "🔍 2. Buscando secretos hardcodeados..."
echo -e "\n## 2. Hardcoded Secrets Analysis\n" >> "$REPORT_FILE"

SECRETS_FOUND=0

# Patrones comunes de secretos
declare -a SECRET_PATTERNS=(
    "private.*key"
    "api.*key"
    "secret.*key"
    "password"
    "token"
    "0x[a-fA-F0-9]{64}"  # Private keys Ethereum
    "sk_live_"           # Stripe live keys
    "pk_live_"           # Stripe public keys
)

for pattern in "${SECRET_PATTERNS[@]}"; do
    if grep -r -i --exclude-dir=node_modules --exclude-dir=.git --exclude="*.md" "$pattern" . > "$REPORT_DIR/secrets-$pattern-$TIMESTAMP.txt" 2>/dev/null; then
        SECRETS_FOUND=$((SECRETS_FOUND + 1))
        warn "Posibles secretos encontrados para patrón: $pattern"
        echo "⚠️  Pattern '$pattern' found in codebase" >> "$REPORT_FILE"
    fi
done

if [ $SECRETS_FOUND -eq 0 ]; then
    log "✅ No se encontraron patrones de secretos hardcodeados"
    echo "✅ No hardcoded secrets patterns detected" >> "$REPORT_FILE"
else
    echo "❌ $SECRETS_FOUND potential secret patterns found" >> "$REPORT_FILE"
fi

# 3. Análisis de configuración TypeScript
log "📝 3. Analizando configuración TypeScript..."
echo -e "\n## 3. TypeScript Configuration Security\n" >> "$REPORT_FILE"

if [ -f "tsconfig.json" ]; then
    # Verificar configuraciones de seguridad
    if grep -q '"strict": true' tsconfig.json; then
        log "✅ TypeScript strict mode habilitado"
        echo "✅ Strict mode enabled" >> "$REPORT_FILE"
    else
        warn "TypeScript strict mode no habilitado"
        echo "⚠️  Strict mode not enabled" >> "$REPORT_FILE"
    fi
    
    if grep -q '"noImplicitAny": true' tsconfig.json; then
        log "✅ noImplicitAny habilitado"
        echo "✅ noImplicitAny enabled" >> "$REPORT_FILE"
    else
        warn "noImplicitAny no habilitado explícitamente"
        echo "⚠️  noImplicitAny not explicitly enabled" >> "$REPORT_FILE"
    fi
else
    error "tsconfig.json no encontrado"
fi

# 4. Análisis de variables de entorno
log "🌍 4. Analizando configuración de variables de entorno..."
echo -e "\n## 4. Environment Variables Security\n" >> "$REPORT_FILE"

ENV_ISSUES=0

if [ -f ".env" ]; then
    warn "Archivo .env encontrado en repositorio - podría contener secretos"
    echo "⚠️  .env file found in repository" >> "$REPORT_FILE"
    ENV_ISSUES=$((ENV_ISSUES + 1))
fi

if [ -f ".env.example" ]; then
    log "✅ .env.example encontrado - buena práctica"
    echo "✅ .env.example file present" >> "$REPORT_FILE"
else
    warn ".env.example no encontrado - recomendado para documentación"
    echo "⚠️  .env.example not found" >> "$REPORT_FILE"
fi

# Verificar .gitignore
if grep -q "\.env" .gitignore 2>/dev/null; then
    log "✅ .env está en .gitignore"
    echo "✅ .env files ignored by git" >> "$REPORT_FILE"
else
    warn ".env no está explícitamente en .gitignore"
    echo "⚠️  .env not in .gitignore" >> "$REPORT_FILE"
    ENV_ISSUES=$((ENV_ISSUES + 1))
fi

# 5. Análisis de permisos de archivos
log "📁 5. Analizando permisos de archivos sensibles..."
echo -e "\n## 5. File Permissions Analysis\n" >> "$REPORT_FILE"

PERM_ISSUES=0

# Verificar archivos con permisos incorrectos
find . -name "*.key" -o -name "*.pem" -o -name ".env*" 2>/dev/null | while read -r file; do
    if [ -f "$file" ]; then
        perms=$(stat -c "%a" "$file" 2>/dev/null || stat -f "%A" "$file" 2>/dev/null)
        if [ "$perms" != "600" ] && [ "$perms" != "644" ]; then
            warn "Archivo $file tiene permisos inseguros: $perms"
            echo "⚠️  File $file has permissions $perms" >> "$REPORT_FILE"
            PERM_ISSUES=$((PERM_ISSUES + 1))
        fi
    fi
done

if [ $PERM_ISSUES -eq 0 ]; then
    log "✅ Permisos de archivos sensibles correctos"
    echo "✅ File permissions appear secure" >> "$REPORT_FILE"
fi

# 6. Análisis de configuración Docker
log "🐳 6. Analizando configuración Docker..."
echo -e "\n## 6. Docker Security Analysis\n" >> "$REPORT_FILE"

DOCKER_ISSUES=0

if [ -f "Dockerfile" ] || [ -f "docker-compose.yml" ]; then
    # Verificar usuario root en Docker
    if grep -q "USER root" Dockerfile* 2>/dev/null; then
        warn "Dockerfile usa USER root - riesgo de seguridad"
        echo "⚠️  Dockerfile uses USER root" >> "$REPORT_FILE"
        DOCKER_ISSUES=$((DOCKER_ISSUES + 1))
    fi
    
    # Verificar secretos en docker-compose
    if grep -i -E "(password|secret|key)" docker-compose*.yml 2>/dev/null | grep -v "REPLACE_WITH"; then
        warn "Posibles secretos hardcodeados en docker-compose"
        echo "⚠️  Potential secrets in docker-compose files" >> "$REPORT_FILE"
        DOCKER_ISSUES=$((DOCKER_ISSUES + 1))
    fi
    
    if [ $DOCKER_ISSUES -eq 0 ]; then
        log "✅ Configuración Docker parece segura"
        echo "✅ Docker configuration appears secure" >> "$REPORT_FILE"
    fi
else
    log "ℹ️  No se encontraron archivos Docker para analizar"
    echo "ℹ️  No Docker files found" >> "$REPORT_FILE"
fi

# 7. Análisis de configuración Vault
log "🔐 7. Analizando configuración de Vault..."
echo -e "\n## 7. Vault Configuration Security\n" >> "$REPORT_FILE"

VAULT_ISSUES=0

if [ -f "config/vault/vault-config.hcl" ]; then
    # Verificar configuración TLS
    if grep -q "tls_disable.*=.*1" config/vault/vault-config.hcl; then
        warn "Vault configurado con TLS deshabilitado - solo para desarrollo"
        echo "⚠️  Vault TLS disabled (dev only)" >> "$REPORT_FILE"
        VAULT_ISSUES=$((VAULT_ISSUES + 1))
    fi
    
    # Verificar UI habilitada
    if grep -q "ui.*=.*true" config/vault/vault-config.hcl; then
        log "✅ Vault UI habilitada"
        echo "✅ Vault UI enabled" >> "$REPORT_FILE"
    fi
    
    if [ $VAULT_ISSUES -eq 0 ]; then
        log "✅ Configuración Vault básica correcta"
        echo "✅ Vault basic configuration OK" >> "$REPORT_FILE"
    fi
else
    error "Configuración de Vault no encontrada"
    echo "❌ Vault configuration not found" >> "$REPORT_FILE"
fi

# 8. Generar resumen final
log "📊 Generando resumen de seguridad..."

TOTAL_ISSUES=$((SECRETS_FOUND + ENV_ISSUES + PERM_ISSUES + DOCKER_ISSUES + VAULT_ISSUES))

cat >> "$REPORT_FILE" << EOF

## Security Summary

- **Hardcoded Secrets:** $SECRETS_FOUND issues found
- **Environment Variables:** $ENV_ISSUES issues found  
- **File Permissions:** $PERM_ISSUES issues found
- **Docker Configuration:** $DOCKER_ISSUES issues found
- **Vault Configuration:** $VAULT_ISSUES issues found

**TOTAL ISSUES:** $TOTAL_ISSUES

## Recommendations

1. **Address all hardcoded secrets** - Migrate to Vault if not done
2. **Review environment variable handling** - Ensure proper .gitignore
3. **Fix file permissions** - Sensitive files should be 600
4. **Secure Docker configuration** - Avoid root user, external secrets
5. **Enable Vault TLS for production** - Never use tls_disable=1 in prod

## Next Steps

1. Fix all critical and high issues before external audit
2. Implement additional security testing
3. Set up continuous security monitoring
4. Document all security controls and procedures

---
**Report Generated:** $(date)
**Methodology:** Ingenio Pichichi S.A. - Cumplidor, disciplinado, organizado
EOF

if [ $TOTAL_ISSUES -eq 0 ]; then
    log "🎉 ¡Análisis completado! No se encontraron problemas críticos de seguridad"
    echo "✅ SECURITY SCAN PASSED - No critical issues found" >> "$REPORT_FILE"
else
    warn "⚠️  Se encontraron $TOTAL_ISSUES problemas de seguridad que requieren atención"
    echo "⚠️  SECURITY ISSUES FOUND - $TOTAL_ISSUES total issues require attention" >> "$REPORT_FILE"
fi

log "📄 Reporte de seguridad guardado en: $REPORT_FILE"
log "📁 Archivos adicionales en: $REPORT_DIR"

# Mostrar resumen en consola
echo ""
echo -e "${BLUE}📊 RESUMEN DE SEGURIDAD:${NC}"
echo -e "   Secretos hardcodeados: ${RED}$SECRETS_FOUND${NC}"
echo -e "   Variables de entorno: ${RED}$ENV_ISSUES${NC}"  
echo -e "   Permisos de archivos: ${RED}$PERM_ISSUES${NC}"
echo -e "   Configuración Docker: ${RED}$DOCKER_ISSUES${NC}"
echo -e "   Configuración Vault: ${RED}$VAULT_ISSUES${NC}"
echo ""
echo -e "   ${BLUE}TOTAL: ${RED}$TOTAL_ISSUES${BLUE} problemas encontrados${NC}"
echo ""

if [ $TOTAL_ISSUES -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Revisar y corregir problemas antes de auditoría externa${NC}"
    exit 1
else
    echo -e "${GREEN}✅ Sistema listo para auditoría de seguridad externa${NC}"
    exit 0
fi
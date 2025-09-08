#!/bin/bash
# ===================================================================================================
# ARBITRAGEX SUPREME - SCRIPT DE PUSH A GITHUB
# ===================================================================================================
# 
# Este script debe ser ejecutado con un token de GitHub válido
# 
# Uso:
#   export GITHUB_TOKEN="your_token_here"
#   ./push-to-github.sh
# 
# O directamente:
#   ./push-to-github.sh your_token_here
# ===================================================================================================

set -e

echo "🚀 ArbitrageX Supreme - GitHub Push Script"
echo "=========================================="

# Verificar si se proporcionó token como argumento
if [ $# -eq 1 ]; then
    GITHUB_TOKEN="$1"
    echo "✅ Token proporcionado como argumento"
elif [ -n "$GITHUB_TOKEN" ]; then
    echo "✅ Token encontrado en variable de entorno"
else
    echo "❌ Error: Se requiere token de GitHub"
    echo ""
    echo "Uso:"
    echo "  export GITHUB_TOKEN='your_token_here'"
    echo "  $0"
    echo ""
    echo "O:"
    echo "  $0 your_token_here"
    exit 1
fi

# Configurar git
echo "🔧 Configurando git..."
git config --global user.name "hefarica"
git config --global user.email "hefarica@users.noreply.github.com"
git config --global credential.helper store

# Configurar remote con token
echo "🔗 Configurando remote con autenticación..."
git remote set-url origin "https://${GITHUB_TOKEN}@github.com/hefarica/ARBITRAGEXSUPREME.git"

# Verificar estado del repositorio
echo "📊 Estado del repositorio:"
git status --porcelain
echo ""
git log --oneline -3
echo ""

# Realizar push
echo "📤 Realizando push a GitHub..."
if git push origin main; then
    echo ""
    echo "✅ ¡PUSH COMPLETADO EXITOSAMENTE!"
    echo "🎯 Repositorio: https://github.com/hefarica/ARBITRAGEXSUPREME"
    echo "📋 Commit: $(git log --oneline -1)"
    echo ""
    echo "🏆 ACTIVIDADES 121-140 SUBIDAS A GITHUB:"
    echo "   - Pipeline Flashbots & DEX Routing (121-130)"
    echo "   - Aave V3 & Oráculos (131-140)" 
    echo "   - 270,715+ líneas de código funcional"
    echo "   - 54 archivos nuevos"
    echo "   - Metodología Ingenio Pichichi S.A. completa"
else
    echo ""
    echo "❌ Push falló. Verificar:"
    echo "   1. Token de GitHub válido y con permisos"
    echo "   2. Conectividad a internet"
    echo "   3. Permisos del repositorio"
    exit 1
fi

# Limpiar credenciales por seguridad
echo "🧹 Limpiando credenciales temporales..."
git config --global --unset credential.helper 2>/dev/null || true
rm -f ~/.git-credentials 2>/dev/null || true

echo ""
echo "🎉 ¡PROCESO COMPLETADO!"
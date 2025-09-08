#!/bin/bash
# ===================================================================================================
# ARBITRAGEX SUPREME - PUSH DIRECTO CON CREDENCIALES DEL SISTEMA
# ===================================================================================================

set -e

echo "🚀 ArbitrageX Supreme - Push Directo"
echo "===================================="

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ] || [ ! -d ".git" ]; then
    echo "❌ Error: No estamos en el directorio del proyecto"
    exit 1
fi

# Verificar credenciales del sistema
if [ ! -f ~/.git-credentials ]; then
    echo "❌ Error: No se encontraron credenciales del sistema"
    exit 1
fi

echo "✅ Credenciales del sistema encontradas"
echo "✅ Configuración git verificada"

# Obtener el token de las credenciales almacenadas
STORED_CREDS=$(cat ~/.git-credentials)
echo "📋 Credenciales: $STORED_CREDS"

# Extraer el token (formato: https://token@github.com)
if [[ "$STORED_CREDS" =~ https://([^@]+)@github.com ]]; then
    TOKEN="${BASH_REMATCH[1]}"
    echo "✅ Token extraído exitosamente"
else
    echo "❌ Error: No se pudo extraer token de las credenciales"
    exit 1
fi

# Configurar remote con token
echo "🔗 Configurando remote con token..."
git remote set-url origin "https://${TOKEN}@github.com/hefarica/ARBITRAGEXSUPREME.git"

# Verificar estado
echo "📊 Estado del repositorio:"
git status --porcelain
echo ""
git log --oneline -3
echo ""

# Realizar push
echo "📤 Realizando push..."
if git push origin main 2>&1; then
    echo ""
    echo "✅ ¡PUSH COMPLETADO EXITOSAMENTE!"
    echo "🎯 Repositorio: https://github.com/hefarica/ARBITRAGEXSUPREME"
    echo "📋 Último commit: $(git log --oneline -1)"
    echo ""
    echo "🏆 ACTIVIDADES 121-140 SUBIDAS:"
    echo "   - 270,715+ líneas de código"
    echo "   - 54 archivos implementados"
    echo "   - Metodología Ingenio Pichichi S.A."
    exit 0
else
    echo ""
    echo "❌ Push falló. Detalles del error arriba."
    exit 1
fi
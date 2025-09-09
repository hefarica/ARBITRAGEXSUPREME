/**
 * 🛡️ ENDPOINT DE VALIDACIÓN DE TOKENS - ArbitrageX Supreme
 * 
 * METODOLOGÍA: INGENIO PICHICHI S.A.
 * - Disciplinado: Análisis sistemático anti-rugpull
 * - Organizado: Filtros de seguridad verificados
 * - Metodológico: Protección integral contra scams
 * 
 * @route POST /api/v2/arbitrage/validate-token
 * @version 2.0.0
 * @author ArbitrageX Supreme Engineering Team
 */

import TokenSafetyValidator from '../../../validation/TokenSafetyValidator.js';

// Instancia global del validador
let globalValidator = null;

/**
 * Inicializar validador si no existe
 */
function initializeValidator() {
    if (!globalValidator) {
        globalValidator = new TokenSafetyValidator();
        console.log('🛡️ TokenSafetyValidator inicializado supremamente');
    }
    return globalValidator;
}

/**
 * Endpoint de validación de tokens
 */
export async function onRequest(context) {
    const { request } = context;
    
    // Validar método
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({
            success: false,
            error: 'Método no permitido. Use POST.',
            supportedMethods: ['POST']
        }), {
            status: 405,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
    
    try {
        // Parsear request body
        const requestBody = await request.json().catch(() => ({}));
        
        // Validar parámetros de entrada
        const validation = validateRequestParams(requestBody);
        if (!validation.isValid) {
            return createErrorResponse(400, 'Parámetros inválidos', validation.errors);
        }
        
        // Inicializar validador
        const validator = initializeValidator();
        
        const startTime = Date.now();
        
        // Determinar tipo de análisis
        if (requestBody.tokens && Array.isArray(requestBody.tokens)) {
            // Análisis múltiple
            console.log(`🔍 Analizando ${requestBody.tokens.length} tokens...`);
            
            const results = await validator.validateTokenList(requestBody.tokens);
            
            return createSuccessResponse({
                type: 'batch_analysis',
                results,
                processingTime: Date.now() - startTime,
                summary: generateBatchSummary(results)
            });
            
        } else {
            // Análisis individual
            const { tokenAddress, tokenSymbol, network } = requestBody;
            
            console.log(`🔍 Analizando token individual: ${tokenSymbol}`);\n            \n            const analysis = await validator.validateTokenSafety(\n                tokenAddress,\n                tokenSymbol,\n                network || 'ethereum'\n            );\n            \n            return createSuccessResponse({\n                type: 'single_analysis',\n                analysis,\n                processingTime: Date.now() - startTime,\n                \n                // Información adicional para debugging\n                debug: {\n                    cacheHit: analysis.fastTrack || false,\n                    analysisComponents: [\n                        'contract_analysis',\n                        'liquidity_analysis', \n                        'holder_analysis',\n                        'historical_analysis',\n                        'social_analysis'\n                    ]\n                }\n            });\n        }\n        \n    } catch (error) {\n        console.error('❌ Error en validate-token:', error);\n        \n        return createErrorResponse(500, 'Error interno del servidor', {\n            message: error.message,\n            timestamp: new Date().toISOString()\n        });\n    }\n}\n\n/**\n * Validar parámetros de entrada\n */\nfunction validateRequestParams(params) {\n    const errors = [];\n    \n    // Verificar que sea análisis individual o batch\n    const hasTokens = params.tokens && Array.isArray(params.tokens);\n    const hasSingleToken = params.tokenAddress && params.tokenSymbol;\n    \n    if (!hasTokens && !hasSingleToken) {\n        errors.push('Debe proporcionar tokens (array) o tokenAddress + tokenSymbol');\n    }\n    \n    // Validar análisis individual\n    if (hasSingleToken) {\n        if (!params.tokenAddress || typeof params.tokenAddress !== 'string') {\n            errors.push('tokenAddress debe ser un string válido');\n        } else if (!params.tokenAddress.match(/^0x[a-fA-F0-9]{40}$/)) {\n            errors.push('tokenAddress debe ser una dirección Ethereum válida');\n        }\n        \n        if (!params.tokenSymbol || typeof params.tokenSymbol !== 'string') {\n            errors.push('tokenSymbol debe ser un string válido');\n        } else if (params.tokenSymbol.length > 20) {\n            errors.push('tokenSymbol demasiado largo (máximo 20 caracteres)');\n        }\n        \n        if (params.network) {\n            const supportedNetworks = ['ethereum', 'polygon', 'bsc', 'arbitrum', 'optimism', 'avalanche'];\n            if (!supportedNetworks.includes(params.network)) {\n                errors.push(`Network no soportada. Use: ${supportedNetworks.join(', ')}`);\n            }\n        }\n    }\n    \n    // Validar análisis batch\n    if (hasTokens) {\n        if (params.tokens.length === 0) {\n            errors.push('Array tokens no puede estar vacío');\n        } else if (params.tokens.length > 50) {\n            errors.push('Máximo 50 tokens por batch');\n        }\n        \n        // Validar cada token en el array\n        params.tokens.forEach((token, index) => {\n            if (!token.address || !token.symbol) {\n                errors.push(`Token ${index}: address y symbol son requeridos`);\n            }\n            if (token.address && !token.address.match(/^0x[a-fA-F0-9]{40}$/)) {\n                errors.push(`Token ${index}: address inválida`);\n            }\n        });\n    }\n    \n    return {\n        isValid: errors.length === 0,\n        errors\n    };\n}\n\n/**\n * Generar resumen de análisis batch\n */\nfunction generateBatchSummary(batchResults) {\n    const { results } = batchResults;\n    \n    const summary = {\n        total: results.length,\n        approved: 0,\n        rejected: 0,\n        \n        // Por tier\n        tier1: 0,\n        tier2: 0,\n        tier3: 0,\n        untiered: 0,\n        \n        // Por risk level\n        lowRisk: 0,\n        mediumRisk: 0,\n        highRisk: 0,\n        criticalRisk: 0,\n        \n        // Red flags más comunes\n        commonRedFlags: {},\n        \n        // Tokens más seguros\n        safestTokens: [],\n        \n        // Tokens más peligrosos\n        riskyTokens: []\n    };\n    \n    results.forEach(token => {\n        // Contadores básicos\n        if (token.isApproved) summary.approved++;\n        else summary.rejected++;\n        \n        // Por tier\n        if (token.tier === 1) summary.tier1++;\n        else if (token.tier === 2) summary.tier2++;\n        else if (token.tier === 3) summary.tier3++;\n        else summary.untiered++;\n        \n        // Por risk level\n        switch (token.riskLevel) {\n            case 'LOW': summary.lowRisk++; break;\n            case 'MEDIUM': summary.mediumRisk++; break;\n            case 'HIGH': summary.highRisk++; break;\n            case 'CRITICAL': summary.criticalRisk++; break;\n        }\n        \n        // Red flags comunes\n        if (token.redFlags) {\n            token.redFlags.forEach(flag => {\n                summary.commonRedFlags[flag] = (summary.commonRedFlags[flag] || 0) + 1;\n            });\n        }\n        \n        // Top safest (score >= 80)\n        if (token.safetyScore >= 80) {\n            summary.safestTokens.push({\n                symbol: token.tokenSymbol,\n                score: token.safetyScore,\n                tier: token.tier\n            });\n        }\n        \n        // Top riskiest (score <= 30 o critical)\n        if (token.safetyScore <= 30 || token.riskLevel === 'CRITICAL') {\n            summary.riskyTokens.push({\n                symbol: token.tokenSymbol,\n                score: token.safetyScore,\n                riskLevel: token.riskLevel,\n                redFlags: token.redFlags?.length || 0\n            });\n        }\n    });\n    \n    // Ordenar y limitar listas\n    summary.safestTokens.sort((a, b) => b.score - a.score).slice(0, 5);\n    summary.riskyTokens.sort((a, b) => a.score - b.score).slice(0, 5);\n    \n    return summary;\n}\n\n/**\n * Crear respuesta exitosa\n */\nfunction createSuccessResponse(data) {\n    const response = {\n        success: true,\n        timestamp: new Date().toISOString(),\n        version: '2.0.0',\n        \n        // Datos principales\n        ...data,\n        \n        // Información del sistema\n        system: {\n            dataPolicy: 'REAL_DATA_ONLY',\n            securityLevel: 'SUPREME',\n            methodology: 'Ingenio Pichichi S.A.',\n            \n            // Configuración de seguridad\n            safetyConfig: {\n                minLiquidity: '$100k',\n                minHolders: '1,000',\n                maxTop10Concentration: '40%',\n                tier1Assets: '14 blue chips',\n                blacklistPatterns: '7 automatic filters'\n            }\n        },\n        \n        // Guías de uso\n        usage: {\n            approvedTokens: 'Use isApproved=true para arbitraje',\n            riskLevels: {\n                LOW: 'Seguro para cualquier estrategia',\n                MEDIUM: 'Requiere precaución adicional',\n                HIGH: 'Solo para usuarios experimentados',\n                CRITICAL: 'NO USAR - Riesgo extremo'\n            },\n            tiers: {\n                1: 'Blue chips - Sin límites',\n                2: 'Establecidos - Límites moderados',\n                3: 'Nuevos - Requiere aprobación manual'\n            }\n        }\n    };\n    \n    return new Response(JSON.stringify(response), {\n        status: 200,\n        headers: {\n            'Content-Type': 'application/json',\n            'Access-Control-Allow-Origin': '*',\n            'Cache-Control': 'no-cache, must-revalidate',\n            'X-Security-Level': 'SUPREME',\n            'X-Analysis-Version': '2.0.0'\n        }\n    });\n}\n\n/**\n * Crear respuesta de error\n */\nfunction createErrorResponse(status, message, details = null) {\n    const errorResponse = {\n        success: false,\n        error: {\n            code: status,\n            message: message,\n            timestamp: new Date().toISOString()\n        }\n    };\n    \n    if (details) {\n        errorResponse.error.details = details;\n    }\n    \n    return new Response(JSON.stringify(errorResponse), {\n        status,\n        headers: {\n            'Content-Type': 'application/json',\n            'Access-Control-Allow-Origin': '*'\n        }\n    });\n}\n\n// ===================================================================\n// ENDPOINT ADICIONAL: ESTADÍSTICAS DEL VALIDADOR\n// ===================================================================\n\n/**\n * Endpoint GET para estadísticas\n */\nexport async function onRequestGet(context) {\n    try {\n        const validator = initializeValidator();\n        const stats = validator.getStats();\n        \n        return new Response(JSON.stringify({\n            success: true,\n            timestamp: new Date().toISOString(),\n            \n            // Estadísticas del validador\n            stats,\n            \n            // Configuración actual\n            configuration: {\n                tier1Assets: validator.SAFETY_CONFIG.tier1Assets.length,\n                minSafeLiquidity: validator.SAFETY_CONFIG.minSafeLiquidity,\n                minHolders: validator.SAFETY_CONFIG.minHolders,\n                maxTop10Concentration: validator.SAFETY_CONFIG.maxTop10Concentration,\n                blacklistPatterns: validator.SAFETY_CONFIG.autoRejectPatterns.length\n            },\n            \n            // Estado del sistema\n            system: {\n                version: '2.0.0',\n                status: 'OPERATIONAL',\n                dataPolicy: 'REAL_DATA_ONLY'\n            }\n        }), {\n            status: 200,\n            headers: {\n                'Content-Type': 'application/json',\n                'Access-Control-Allow-Origin': '*'\n            }\n        });\n        \n    } catch (error) {\n        return createErrorResponse(500, 'Error obteniendo estadísticas', {\n            message: error.message\n        });\n    }\n}\n\n// ===================================================================\n// MANEJO DE OPTIONS (CORS)\n// ===================================================================\n\nexport async function onRequestOptions() {\n    return new Response(null, {\n        status: 204,\n        headers: {\n            'Access-Control-Allow-Origin': '*',\n            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',\n            'Access-Control-Allow-Headers': 'Content-Type, Authorization',\n            'Access-Control-Max-Age': '86400'\n        }\n    });\n}"
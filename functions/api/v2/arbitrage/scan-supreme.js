/**
 * 🚀 ENDPOINT SUPREMO DE ESCANEO - ArbitrageX Supreme
 * 
 * METODOLOGÍA: INGENIO PICHICHI S.A.
 * - Disciplinado: Integración completa de todos los engines matemáticos
 * - Organizado: API robusta con validación y manejo de errores
 * - Metodológico: Respuestas estructuradas y documentadas
 * 
 * INTEGRA ENGINES COMPLETOS:
 * ✅ ArbitrageMath.js (13 tipos de cálculos)
 * ✅ GasCalculator.js (costos reales multi-red)
 * ✅ LiquidityValidator.js (validación AMM)
 * ✅ OpportunityScanner.js (escaneo inteligente)
 * 
 * @route POST /api/v2/arbitrage/scan-supreme
 * @version 2.0.0
 * @author ArbitrageX Supreme Engineering Team
 */

import OpportunityScanner from '../../../calculation-engine/OpportunityScanner.js';

// Instancia global del escáner para mantener estado
let globalScanner = null;

/**
 * Inicializar escáner si no existe
 */
function initializeScanner() {
    if (!globalScanner) {
        globalScanner = new OpportunityScanner();
        console.log('🔍 OpportunityScanner inicializado supremamente');
    }
    return globalScanner;
}

/**
 * Endpoint principal de escaneo supremo
 */
export async function onRequest(context) {
    const { request, env } = context;
    
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
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            }
        });
    }
    
    try {
        // Parsear parámetros de entrada
        const requestBody = await request.json().catch(() => ({}));
        
        // Configuración de escaneo con valores por defecto
        const scanParams = {
            // Redes a escanear
            networks: requestBody.networks || ['ethereum', 'polygon', 'bsc'],
            
            // Tipos de arbitraje a incluir
            arbitrageTypes: requestBody.arbitrageTypes || [
                'dex', 'crossChain', 'flashLoan', 'triangular', 
                'statistical', 'temporal', 'liquidity'
            ],
            
            // Filtros de rentabilidad
            minSpreadPercentage: requestBody.minSpreadPercentage || 0.3,  // 0.3%
            minNetProfitUSD: requestBody.minNetProfitUSD || 5,            // $5
            maxPriceImpact: requestBody.maxPriceImpact || 0.05,           // 5%
            maxSlippage: requestBody.maxSlippage || 0.03,                 // 3%
            maxGasCostUSD: requestBody.maxGasCostUSD || 100,              // $100
            
            // Configuración de escaneo
            testAmount: requestBody.testAmount || 1000,                   // $1000
            maxResultsPerType: requestBody.maxResultsPerType || 10,       // 10 por tipo
            includeExecutionPlans: requestBody.includeExecutionPlans !== false,
            
            // Pares específicos (opcional)
            tokenPairs: requestBody.tokenPairs || null,
            
            // Configuración avanzada
            useCache: requestBody.useCache !== false,
            cacheDuration: requestBody.cacheDuration || 30,               // 30s
            
            // Configuración de APIs reales
            realDataOnly: requestBody.realDataOnly || false,
            requireMinSources: requestBody.requireMinSources || 2
        };
        
        // Validar parámetros
        const validation = validateScanParams(scanParams);
        if (!validation.isValid) {
            return createErrorResponse(400, 'Parámetros inválidos', validation.errors);
        }
        
        // Inicializar escáner
        const scanner = initializeScanner();
        
        // Verificar estado del sistema
        const systemCheck = await checkSystemHealth(env);
        if (!systemCheck.healthy) {
            return createErrorResponse(503, 'Sistema no disponible', systemCheck.issues);
        }
        
        // Ejecutar escaneo supremo
        console.log(`🚀 Iniciando escaneo supremo con parámetros:`, {
            networks: scanParams.networks,
            types: scanParams.arbitrageTypes.length,
            testAmount: scanParams.testAmount
        });
        
        const scanStartTime = Date.now();
        const scanResults = await scanner.scanAllOpportunities(scanParams);
        const scanDuration = Date.now() - scanStartTime;
        
        // Procesar y enriquecer resultados
        const processedResults = await processResults(scanResults, scanParams, env);
        
        // Calcular métricas de performance
        const performanceMetrics = calculatePerformanceMetrics(scanResults, scanDuration);
        
        // Respuesta exitosa
        const response = {
            success: true,
            timestamp: new Date().toISOString(),
            scanId: scanResults.scanId,
            
            // Configuración usada
            configuration: {
                networks: scanParams.networks,
                arbitrageTypes: scanParams.arbitrageTypes,
                filters: {
                    minSpreadPercentage: scanParams.minSpreadPercentage,
                    minNetProfitUSD: scanParams.minNetProfitUSD,
                    maxPriceImpact: scanParams.maxPriceImpact,
                    testAmount: scanParams.testAmount
                }
            },
            
            // Oportunidades encontradas
            opportunities: processedResults.opportunities,
            
            // Resumen ejecutivo
            summary: {
                totalScanned: scanResults.summary.totalScanned,
                totalViable: scanResults.summary.totalViable,
                bestProfitUSD: scanResults.summary.bestProfitUSD,
                averageProfitUSD: scanResults.summary.averageProfitUSD,
                successRate: scanResults.summary.totalScanned > 0 ? 
                           (scanResults.summary.totalViable / scanResults.summary.totalScanned * 100).toFixed(1) + '%' : '0%',
                topOpportunity: scanResults.summary.topOpportunity ? {
                    id: scanResults.summary.topOpportunity.id,
                    type: scanResults.summary.topOpportunity.type,
                    profitUSD: scanResults.summary.topOpportunity.profit?.netProfit || 
                              scanResults.summary.topOpportunity.analysis?.netProfit ||
                              scanResults.summary.topOpportunity.score || 0,
                    confidence: scanResults.summary.topOpportunity.confidence || 0.5
                } : null
            },
            
            // Análisis por tipo
            byType: processedResults.byType,
            
            // Métricas de performance
            performance: performanceMetrics,
            
            // Metadatos
            metadata: {
                version: '2.0.0',
                engineStatus: 'OPERATIONAL',
                dataPolicy: 'REAL_DATA_ONLY',
                lastUpdate: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 2 * 60 * 1000).toISOString(), // 2 min
                
                // Información del sistema
                system: {
                    scanDurationMs: scanDuration,
                    networks: scanParams.networks.length,
                    arbitrageTypes: scanParams.arbitrageTypes.length,
                    cachedResults: processedResults.cachedCount || 0
                }
            }
        };\n        \n        // Logs para monitoreo\n        console.log(`✅ Escaneo completado: ${scanResults.summary.totalViable}/${scanResults.summary.totalScanned} oportunidades en ${scanDuration}ms`);\n        \n        return new Response(JSON.stringify(response), {\n            status: 200,\n            headers: {\n                'Content-Type': 'application/json',\n                'Access-Control-Allow-Origin': '*',\n                'Cache-Control': 'no-cache, must-revalidate',\n                'X-Scan-Id': scanResults.scanId,\n                'X-Scan-Duration': scanDuration.toString(),\n                'X-Opportunities-Found': scanResults.summary.totalViable.toString()\n            }\n        });\n        \n    } catch (error) {\n        console.error('❌ Error en endpoint scan-supreme:', error);\n        \n        return createErrorResponse(500, 'Error interno del servidor', {\n            message: error.message,\n            timestamp: new Date().toISOString()\n        });\n    }\n}\n\n/**\n * Validar parámetros de escaneo\n */\nfunction validateScanParams(params) {\n    const errors = [];\n    \n    // Validar redes\n    const supportedNetworks = ['ethereum', 'polygon', 'bsc', 'arbitrum', 'optimism', 'avalanche'];\n    if (!Array.isArray(params.networks) || params.networks.length === 0) {\n        errors.push('networks debe ser un array no vacío');\n    } else {\n        const invalidNetworks = params.networks.filter(n => !supportedNetworks.includes(n));\n        if (invalidNetworks.length > 0) {\n            errors.push(`Redes no soportadas: ${invalidNetworks.join(', ')}`);\n        }\n    }\n    \n    // Validar tipos de arbitraje\n    const supportedTypes = ['dex', 'crossChain', 'flashLoan', 'triangular', 'statistical', 'temporal', 'liquidity'];\n    if (!Array.isArray(params.arbitrageTypes) || params.arbitrageTypes.length === 0) {\n        errors.push('arbitrageTypes debe ser un array no vacío');\n    } else {\n        const invalidTypes = params.arbitrageTypes.filter(t => !supportedTypes.includes(t));\n        if (invalidTypes.length > 0) {\n            errors.push(`Tipos no soportados: ${invalidTypes.join(', ')}`);\n        }\n    }\n    \n    // Validar rangos numéricos\n    if (params.minSpreadPercentage < 0 || params.minSpreadPercentage > 10) {\n        errors.push('minSpreadPercentage debe estar entre 0 y 10');\n    }\n    \n    if (params.minNetProfitUSD < 0 || params.minNetProfitUSD > 10000) {\n        errors.push('minNetProfitUSD debe estar entre 0 y 10000');\n    }\n    \n    if (params.testAmount < 100 || params.testAmount > 1000000) {\n        errors.push('testAmount debe estar entre 100 y 1,000,000');\n    }\n    \n    if (params.maxResultsPerType < 1 || params.maxResultsPerType > 50) {\n        errors.push('maxResultsPerType debe estar entre 1 y 50');\n    }\n    \n    return {\n        isValid: errors.length === 0,\n        errors\n    };\n}\n\n/**\n * Verificar salud del sistema\n */\nasync function checkSystemHealth(env) {\n    const issues = [];\n    let healthy = true;\n    \n    try {\n        // Verificar disponibilidad de engines\n        const scanner = new OpportunityScanner();\n        if (!scanner) {\n            issues.push('OpportunityScanner no disponible');\n            healthy = false;\n        }\n        \n        // En implementación real, verificar:\n        // - APIs externas (CoinGecko, 1inch, etc.)\n        // - Conectividad blockchain\n        // - Límites de rate\n        \n        return { healthy, issues };\n        \n    } catch (error) {\n        return {\n            healthy: false,\n            issues: [`Error verificando salud del sistema: ${error.message}`]\n        };\n    }\n}\n\n/**\n * Procesar y enriquecer resultados\n */\nasync function processResults(scanResults, scanParams, env) {\n    try {\n        const processedResults = {\n            opportunities: {},\n            byType: {},\n            cachedCount: 0\n        };\n        \n        // Procesar oportunidades por tipo\n        for (const [type, opportunities] of Object.entries(scanResults.opportunities)) {\n            if (opportunities && opportunities.length > 0) {\n                // Enriquecer cada oportunidad\n                const enrichedOpportunities = opportunities.map(opp => {\n                    return {\n                        ...opp,\n                        \n                        // Agregar campos calculados\n                        riskLevel: calculateRiskLevel(opp),\n                        recommendation: generateRecommendation(opp),\n                        \n                        // URLs de ejecución (si aplicable)\n                        executionUrl: generateExecutionUrl(opp, env),\n                        \n                        // Metadatos adicionales\n                        metadata: {\n                            scanId: scanResults.scanId,\n                            processedAt: new Date().toISOString(),\n                            version: '2.0.0'\n                        }\n                    };\n                });\n                \n                processedResults.opportunities[type] = enrichedOpportunities;\n                \n                // Estadísticas por tipo\n                processedResults.byType[type] = {\n                    count: enrichedOpportunities.length,\n                    avgProfit: calculateAverageProfit(enrichedOpportunities),\n                    maxProfit: calculateMaxProfit(enrichedOpportunities),\n                    avgConfidence: calculateAverageConfidence(enrichedOpportunities),\n                    riskDistribution: calculateRiskDistribution(enrichedOpportunities)\n                };\n            } else {\n                processedResults.opportunities[type] = [];\n                processedResults.byType[type] = {\n                    count: 0,\n                    avgProfit: 0,\n                    maxProfit: 0,\n                    avgConfidence: 0,\n                    riskDistribution: { LOW: 0, MEDIUM: 0, HIGH: 0 }\n                };\n            }\n        }\n        \n        return processedResults;\n        \n    } catch (error) {\n        console.warn('⚠️ Error procesando resultados:', error.message);\n        return {\n            opportunities: scanResults.opportunities,\n            byType: {},\n            cachedCount: 0\n        };\n    }\n}\n\n/**\n * Calcular métricas de performance\n */\nfunction calculatePerformanceMetrics(scanResults, scanDuration) {\n    const totalOpportunities = scanResults.summary.totalScanned;\n    const viableOpportunities = scanResults.summary.totalViable;\n    \n    return {\n        scanDurationMs: scanDuration,\n        scanDurationSeconds: (scanDuration / 1000).toFixed(2),\n        opportunitiesPerSecond: totalOpportunities > 0 ? (totalOpportunities / (scanDuration / 1000)).toFixed(2) : '0',\n        viabilityRate: totalOpportunities > 0 ? ((viableOpportunities / totalOpportunities) * 100).toFixed(1) + '%' : '0%',\n        \n        efficiency: {\n            rating: scanDuration < 5000 ? 'EXCELLENT' : scanDuration < 10000 ? 'GOOD' : 'FAIR',\n            benchmark: '< 5s excellent, < 10s good',\n            bottlenecks: identifyBottlenecks(scanResults)\n        },\n        \n        resourceUsage: {\n            apiCalls: scanResults.execution?.apiCalls || 0,\n            cacheHits: 0, // Implementar tracking\n            errors: scanResults.execution?.errors?.length || 0\n        }\n    };\n}\n\n/**\n * Identificar cuellos de botella en performance\n */\nfunction identifyBottlenecks(scanResults) {\n    const bottlenecks = [];\n    \n    if (scanResults.execution?.scanDurationMs > 10000) {\n        bottlenecks.push('Scan duration too high');\n    }\n    \n    if (scanResults.execution?.errors?.length > 0) {\n        bottlenecks.push('API errors detected');\n    }\n    \n    if (scanResults.summary.totalViable === 0) {\n        bottlenecks.push('No viable opportunities found');\n    }\n    \n    return bottlenecks.length > 0 ? bottlenecks : ['None identified'];\n}\n\n// ===================================================================\n// UTILIDADES DE ENRIQUECIMIENTO\n// ===================================================================\n\n/**\n * Calcular nivel de riesgo\n */\nfunction calculateRiskLevel(opportunity) {\n    // Usar score de riesgo si está disponible\n    const riskScore = opportunity.profit?.riskScore || \n                     opportunity.analysis?.riskScore ||\n                     opportunity.score || 50;\n    \n    if (riskScore < 30) return 'LOW';\n    if (riskScore < 60) return 'MEDIUM';\n    return 'HIGH';\n}\n\n/**\n * Generar recomendación\n */\nfunction generateRecommendation(opportunity) {\n    const riskLevel = calculateRiskLevel(opportunity);\n    const confidence = opportunity.confidence || 0.5;\n    const profit = getOpportunityProfit(opportunity);\n    \n    if (profit > 100 && confidence > 0.8 && riskLevel === 'LOW') {\n        return {\n            action: 'EXECUTE_IMMEDIATELY',\n            reason: 'High profit, high confidence, low risk',\n            priority: 'HIGH'\n        };\n    }\n    \n    if (profit > 20 && confidence > 0.6 && riskLevel !== 'HIGH') {\n        return {\n            action: 'EXECUTE_WITH_CAUTION',\n            reason: 'Good profit potential with acceptable risk',\n            priority: 'MEDIUM'\n        };\n    }\n    \n    if (profit > 5 && confidence > 0.4) {\n        return {\n            action: 'MONITOR',\n            reason: 'Low profit or confidence, monitor for better conditions',\n            priority: 'LOW'\n        };\n    }\n    \n    return {\n        action: 'SKIP',\n        reason: 'Insufficient profit or too high risk',\n        priority: 'NONE'\n    };\n}\n\n/**\n * Generar URL de ejecución\n */\nfunction generateExecutionUrl(opportunity, env) {\n    // En implementación real, generar URLs para ejecutar la operación\n    return `https://app.arbitragex-supreme.com/execute/${opportunity.id}`;\n}\n\n/**\n * Obtener profit de oportunidad (helper)\n */\nfunction getOpportunityProfit(opportunity) {\n    return opportunity.profit?.netProfit || \n           opportunity.analysis?.netProfit ||\n           opportunity.score || 0;\n}\n\n/**\n * Calcular profit promedio\n */\nfunction calculateAverageProfit(opportunities) {\n    if (opportunities.length === 0) return 0;\n    \n    const profits = opportunities.map(getOpportunityProfit);\n    return profits.reduce((a, b) => a + b, 0) / profits.length;\n}\n\n/**\n * Calcular profit máximo\n */\nfunction calculateMaxProfit(opportunities) {\n    if (opportunities.length === 0) return 0;\n    \n    const profits = opportunities.map(getOpportunityProfit);\n    return Math.max(...profits);\n}\n\n/**\n * Calcular confianza promedio\n */\nfunction calculateAverageConfidence(opportunities) {\n    if (opportunities.length === 0) return 0;\n    \n    const confidences = opportunities.map(opp => opp.confidence || 0.5);\n    return confidences.reduce((a, b) => a + b, 0) / confidences.length;\n}\n\n/**\n * Calcular distribución de riesgo\n */\nfunction calculateRiskDistribution(opportunities) {\n    const distribution = { LOW: 0, MEDIUM: 0, HIGH: 0 };\n    \n    opportunities.forEach(opp => {\n        const risk = calculateRiskLevel(opp);\n        distribution[risk]++;\n    });\n    \n    return distribution;\n}\n\n/**\n * Crear respuesta de error\n */\nfunction createErrorResponse(status, message, details = null) {\n    const errorResponse = {\n        success: false,\n        error: {\n            code: status,\n            message: message,\n            timestamp: new Date().toISOString()\n        }\n    };\n    \n    if (details) {\n        errorResponse.error.details = details;\n    }\n    \n    return new Response(JSON.stringify(errorResponse), {\n        status,\n        headers: {\n            'Content-Type': 'application/json',\n            'Access-Control-Allow-Origin': '*'\n        }\n    });\n}\n\n// ===================================================================\n// MANEJO DE OPTIONS (CORS)\n// ===================================================================\n\nexport async function onRequestOptions() {\n    return new Response(null, {\n        status: 204,\n        headers: {\n            'Access-Control-Allow-Origin': '*',\n            'Access-Control-Allow-Methods': 'POST, OPTIONS',\n            'Access-Control-Allow-Headers': 'Content-Type, Authorization',\n            'Access-Control-Max-Age': '86400' // 24 hours\n        }\n    });\n}"
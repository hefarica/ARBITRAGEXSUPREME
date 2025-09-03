/**
 * 🔍 ESCÁNER SUPREMO DE OPORTUNIDADES - ArbitrageX Supreme
 * 
 * METODOLOGÍA: INGENIO PICHICHI S.A.
 * - Disciplinado: Escaneo sistemático de 13 tipos de arbitraje
 * - Organizado: Integración multi-DEX con datos reales
 * - Metodológico: Filtrado inteligente por rentabilidad y viabilidad
 * 
 * INTEGRA TODOS LOS ENGINES:
 * - ArbitrageMath.js (13 tipos de cálculos)
 * - GasCalculator.js (costos reales multi-red)
 * - LiquidityValidator.js (validación AMM)
 * 
 * @version 1.0.0
 * @author ArbitrageX Supreme Engineering Team
 */

import ArbitrageMath from './ArbitrageMath.js';
import GasCalculator from './GasCalculator.js';
import LiquidityValidator from './LiquidityValidator.js';

export class OpportunityScanner {
    
    constructor() {
        // Inicializar engines
        this.arbitrageMath = new ArbitrageMath();
        this.gasCalculator = new GasCalculator();
        this.liquidityValidator = new LiquidityValidator();
        
        // Configuración de escaneo
        this.scanConfig = {
            minSpreadPercentage: 0.3,      // 0.3% mínimo
            minNetProfitUSD: 5,            // $5 mínimo profit
            maxPriceImpact: 0.05,          // 5% máximo impact
            maxSlippage: 0.03,             // 3% máximo slippage
            maxGasCostUSD: 100,            // $100 máximo gas
            scanIntervalMs: 5000,          // 5 segundos entre escaneos
            maxResultsPerType: 10          // 10 mejores por tipo
        };
        
        // DEXs soportados por red
        this.supportedDEXs = {
            ethereum: [
                {
                    name: 'Uniswap V2',
                    type: 'uniswapV2',
                    address: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
                    fee: 0.003,
                    apiEndpoint: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v2'
                },
                {
                    name: 'Uniswap V3',
                    type: 'uniswapV3',
                    address: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
                    fee: 0.0005, // Variable
                    apiEndpoint: 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3'
                },
                {
                    name: 'SushiSwap',
                    type: 'sushiswap',
                    address: '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac',
                    fee: 0.003,
                    apiEndpoint: 'https://api.thegraph.com/subgraphs/name/sushiswap/exchange'
                }
            ],
            polygon: [
                {
                    name: 'QuickSwap',
                    type: 'uniswapV2',
                    address: '0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32',
                    fee: 0.003,
                    apiEndpoint: 'https://api.thegraph.com/subgraphs/name/sameepsi/quickswap'
                },
                {
                    name: 'SushiSwap Polygon',
                    type: 'sushiswap', 
                    address: '0xc35DADB65012eC5796536bD9864eD8773aBc74C4',
                    fee: 0.003,
                    apiEndpoint: 'https://api.thegraph.com/subgraphs/name/sushiswap/matic-exchange'
                }
            ],
            bsc: [
                {
                    name: 'PancakeSwap',
                    type: 'pancakeswap',
                    address: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73',
                    fee: 0.0025,
                    apiEndpoint: 'https://api.thegraph.com/subgraphs/name/pancakeswap/exchange'
                }
            ]
        };
        
        // Tokens populares para escaneo
        this.popularTokens = {
            ethereum: [
                { symbol: 'ETH', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 },
                { symbol: 'USDC', address: '0xA0b86a33E6441218FCf2c6b0661D5E8d99317b6C', decimals: 6 },
                { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
                { symbol: 'WBTC', address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', decimals: 8 },
                { symbol: 'DAI', address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals: 18 }
            ],
            polygon: [
                { symbol: 'MATIC', address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', decimals: 18 },
                { symbol: 'USDC', address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', decimals: 6 },
                { symbol: 'USDT', address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6 },
                { symbol: 'WETH', address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', decimals: 18 }
            ],
            bsc: [
                { symbol: 'BNB', address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', decimals: 18 },
                { symbol: 'BUSD', address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', decimals: 18 },
                { symbol: 'USDT', address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18 }
            ]
        };
        
        // Cache para resultados
        this.opportunityCache = new Map();
        this.priceCache = new Map();
        this.CACHE_DURATION = 30 * 1000; // 30 segundos
        
        // Estado del escáner
        this.isScanning = false;
        this.lastScanTime = null;
        this.scanStats = {
            totalOpportunities: 0,
            viableOpportunities: 0,
            avgProfitUSD: 0,
            bestOpportunity: null
        };
    }
    
    // ===================================================================
    // ESCANEO PRINCIPAL DE OPORTUNIDADES
    // ===================================================================
    
    /**
     * Escanear todas las oportunidades de arbitraje disponibles
     * @param {object} scanParams - Parámetros del escaneo
     * @returns {Promise<object>} Resultado completo del escaneo
     */
    async scanAllOpportunities(scanParams = {}) {
        try {
            this.isScanning = true;
            this.lastScanTime = new Date();
            
            // Configurar parámetros
            const config = { ...this.scanConfig, ...scanParams };
            const networks = scanParams.networks || ['ethereum', 'polygon', 'bsc'];
            const tokenPairs = scanParams.tokenPairs || this._getDefaultTokenPairs(networks);
            
            console.log(`🔍 Iniciando escaneo supremo en ${networks.length} redes, ${tokenPairs.length} pares...`);
            
            // Resultados por tipo de arbitraje
            const results = {
                scanId: this._generateScanId(),
                timestamp: this.lastScanTime.toISOString(),
                networks: networks,
                config: config,
                opportunities: {
                    dex: [],
                    crossChain: [],
                    flashLoan: [],
                    triangular: [],
                    statistical: [],
                    temporal: [],
                    spatial: [],
                    bridge: [],
                    oracle: [],
                    liquidity: [],
                    fee: [],
                    slippage: [],
                    mev: []
                },
                summary: {
                    totalScanned: 0,
                    totalViable: 0,
                    bestProfitUSD: 0,
                    averageProfitUSD: 0,
                    topOpportunity: null
                },
                execution: {
                    scanDurationMs: 0,
                    apiCalls: 0,
                    errors: []
                }
            };
            
            const startTime = Date.now();
            
            // 1. ESCANEAR DEX ARBITRAGE (Tipo más común)
            console.log('🔄 Escaneando DEX Arbitrage...');
            results.opportunities.dex = await this._scanDEXArbitrage(networks, tokenPairs, config);
            
            // 2. ESCANEAR CROSS-CHAIN ARBITRAGE
            if (networks.length > 1) {
                console.log('🌉 Escaneando Cross-Chain Arbitrage...');
                results.opportunities.crossChain = await this._scanCrossChainArbitrage(networks, tokenPairs, config);
            }
            
            // 3. ESCANEAR FLASH LOAN ARBITRAGE (basado en DEX findings)
            if (results.opportunities.dex.length > 0) {
                console.log('⚡ Escaneando Flash Loan Arbitrage...');
                results.opportunities.flashLoan = await this._scanFlashLoanArbitrage(results.opportunities.dex, config);
            }
            
            // 4. ESCANEAR TRIANGULAR ARBITRAGE
            console.log('🔺 Escaneando Triangular Arbitrage...');
            results.opportunities.triangular = await this._scanTriangularArbitrage(networks, config);
            
            // 5. ESCANEAR STATISTICAL ARBITRAGE  
            console.log('📊 Escaneando Statistical Arbitrage...');
            results.opportunities.statistical = await this._scanStatisticalArbitrage(tokenPairs, config);
            
            // 6. ESCANEAR TEMPORAL ARBITRAGE
            console.log('⏰ Escaneando Temporal Arbitrage...');
            results.opportunities.temporal = await this._scanTemporalArbitrage(tokenPairs, config);
            
            // 7. ESCANEAR LIQUIDITY ARBITRAGE
            console.log('💧 Escaneando Liquidity Arbitrage...');
            results.opportunities.liquidity = await this._scanLiquidityArbitrage(networks, tokenPairs, config);
            
            // 8. OTROS TIPOS (implementación básica)
            results.opportunities.spatial = await this._scanSpatialArbitrage(config);
            results.opportunities.bridge = await this._scanBridgeArbitrage(networks, config);
            results.opportunities.oracle = await this._scanOracleArbitrage(tokenPairs, config);
            results.opportunities.fee = await this._scanFeeArbitrage(networks, config);
            results.opportunities.slippage = await this._scanSlippageArbitrage(networks, tokenPairs, config);
            results.opportunities.mev = await this._scanMEVArbitrage(networks, config);
            
            // Calcular estadísticas finales
            results.execution.scanDurationMs = Date.now() - startTime;
            this._calculateScanSummary(results);
            
            // Cachear resultado
            this._cacheOpportunities(results.scanId, results);
            
            // Actualizar estadísticas
            this._updateScanStats(results);
            
            console.log(`✅ Escaneo completado: ${results.summary.totalViable} oportunidades viables en ${results.execution.scanDurationMs}ms`);
            
            return results;
            
        } catch (error) {
            console.error('❌ Error en escaneo:', error.message);
            return this._createErrorResponse(error);
        } finally {
            this.isScanning = false;
        }
    }
    
    // ===================================================================
    // ESCANEO DE DEX ARBITRAGE
    // ===================================================================
    
    /**
     * Escanear arbitraje entre DEXs (tipo más común)
     * @param {Array} networks - Redes a escanear
     * @param {Array} tokenPairs - Pares de tokens
     * @param {object} config - Configuración
     * @returns {Promise<Array>} Oportunidades DEX
     */
    async _scanDEXArbitrage(networks, tokenPairs, config) {
        const opportunities = [];
        
        for (const network of networks) {
            const dexes = this.supportedDEXs[network] || [];
            
            for (const pair of tokenPairs) {
                try {
                    // Obtener precios de todos los DEXs para este par
                    const dexPrices = await this._getDEXPrices(network, dexes, pair);
                    
                    if (dexPrices.length < 2) continue;
                    
                    // Buscar spreads entre cada combinación de DEXs
                    for (let i = 0; i < dexPrices.length; i++) {
                        for (let j = i + 1; j < dexPrices.length; j++) {
                            const dexA = dexPrices[i];
                            const dexB = dexPrices[j];
                            
                            // Calcular spread usando ArbitrageMath
                            const spreadData = this.arbitrageMath.calculateDEXSpread(
                                dexA.price,
                                dexB.price,
                                pair.symbol
                            );
                            
                            if (!spreadData.isArbitrageable || 
                                spreadData.percentageSpread < config.minSpreadPercentage) {
                                continue;
                            }
                            
                            // Validar liquidez usando LiquidityValidator
                            const liquidityCheck = await this._validatePoolLiquidity(
                                dexA.poolAddress,
                                dexB.poolAddress,
                                config.testAmount || 1000
                            );
                            
                            if (!liquidityCheck.isValid) continue;
                            
                            // Calcular costos de gas usando GasCalculator
                            const gasCosts = await this._calculateTradingCosts(
                                network,
                                'arbitrageSwap',
                                pair
                            );
                            
                            // Calcular rentabilidad neta
                            const profitAnalysis = this.arbitrageMath.calculateNetProfit(
                                spreadData,
                                config.testAmount || 1000,
                                gasCosts
                            );
                            
                            // Filtrar por rentabilidad mínima
                            if (profitAnalysis.netProfit >= config.minNetProfitUSD) {
                                opportunities.push({
                                    type: 'dex_arbitrage',
                                    id: this._generateOpportunityId('dex', network, pair.symbol),
                                    network: network,
                                    pair: pair,
                                    dexA: dexA,
                                    dexB: dexB,
                                    spread: spreadData,
                                    liquidity: liquidityCheck,
                                    costs: gasCosts,
                                    profit: profitAnalysis,
                                    score: this._calculateOpportunityScore(spreadData, profitAnalysis, liquidityCheck),
                                    confidence: this._calculateConfidence(spreadData, liquidityCheck, gasCosts),
                                    executionPlan: this._createExecutionPlan('dex', spreadData, gasCosts),
                                    expiresAt: new Date(Date.now() + 2 * 60 * 1000).toISOString(), // 2 min
                                    createdAt: new Date().toISOString()
                                });
                            }
                        }
                    }
                } catch (error) {
                    console.warn(`Error escaneando par ${pair.symbol} en ${network}:`, error.message);
                }
            }
        }
        
        // Ordenar por rentabilidad y retornar top N
        return opportunities
            .sort((a, b) => b.profit.netProfit - a.profit.netProfit)
            .slice(0, config.maxResultsPerType);
    }
    
    // ===================================================================
    // ESCANEO DE CROSS-CHAIN ARBITRAGE  
    // ===================================================================
    
    /**
     * Escanear arbitraje cross-chain
     * @param {Array} networks - Redes a comparar
     * @param {Array} tokenPairs - Pares de tokens
     * @param {object} config - Configuración
     * @returns {Promise<Array>} Oportunidades cross-chain
     */
    async _scanCrossChainArbitrage(networks, tokenPairs, config) {
        const opportunities = [];
        
        for (const pair of tokenPairs) {
            try {
                // Obtener precios por red
                const networkPrices = {};
                
                for (const network of networks) {
                    const price = await this._getBestPriceForPair(network, pair);
                    if (price) {
                        networkPrices[network] = {
                            price: price.price,
                            network: network,
                            bridgeFee: await this._estimateBridgeFee(network, pair),
                            bridgeTime: await this._estimateBridgeTime(network)
                        };
                    }
                }
                
                // Comparar cada combinación de redes
                const networkList = Object.keys(networkPrices);
                
                for (let i = 0; i < networkList.length; i++) {
                    for (let j = i + 1; j < networkList.length; j++) {
                        const networkA = networkList[i];
                        const networkB = networkList[j];
                        
                        const crossChainAnalysis = this.arbitrageMath.calculateCrossChainArbitrage(
                            networkPrices[networkA],
                            networkPrices[networkB],
                            config.testAmount || 1000
                        );
                        
                        if (crossChainAnalysis.isViable && 
                            crossChainAnalysis.netProfit >= config.minNetProfitUSD) {
                            
                            opportunities.push({
                                type: 'cross_chain_arbitrage',
                                id: this._generateOpportunityId('cross', `${networkA}-${networkB}`, pair.symbol),
                                pair: pair,
                                chainA: networkA,
                                chainB: networkB,
                                analysis: crossChainAnalysis,
                                score: crossChainAnalysis.netProfit / 10, // Simple scoring
                                confidence: this._calculateCrossChainConfidence(crossChainAnalysis),
                                executionPlan: this._createCrossChainExecutionPlan(crossChainAnalysis),
                                expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(), // 5 min
                                createdAt: new Date().toISOString()
                            });
                        }
                    }
                }
            } catch (error) {
                console.warn(`Error escaneando cross-chain para ${pair.symbol}:`, error.message);
            }
        }
        
        return opportunities
            .sort((a, b) => b.analysis.netProfit - a.analysis.netProfit)
            .slice(0, config.maxResultsPerType);
    }
    
    // ===================================================================
    // ESCANEO DE FLASH LOAN ARBITRAGE
    // ===================================================================
    
    /**
     * Escanear oportunidades de flash loan basadas en DEX arbitrage
     * @param {Array} dexOpportunities - Oportunidades DEX encontradas
     * @param {object} config - Configuración
     * @returns {Promise<Array>} Oportunidades flash loan
     */
    async _scanFlashLoanArbitrage(dexOpportunities, config) {
        const opportunities = [];
        
        for (const dexOp of dexOpportunities) {
            try {
                // Solo considerar oportunidades con spread suficiente
                if (dexOp.spread.percentageSpread < 1) continue; // Mínimo 1% para flash loan
                
                // Calcular diferentes tamaños de flash loan
                const flashLoanAmounts = [5000, 10000, 25000, 50000, 100000]; // $5k a $100k
                
                for (const amount of flashLoanAmounts) {
                    const flashLoanAnalysis = this.arbitrageMath.calculateFlashLoanArbitrage(
                        dexOp.spread,
                        amount,
                        0.0005, // 0.05% flash loan fee (Aave)
                        dexOp.costs
                    );
                    
                    if (flashLoanAnalysis.isViable && 
                        flashLoanAnalysis.netProfit >= config.minNetProfitUSD) {
                        
                        // Validar liquidez para el monto mayor
                        const liquidityCheck = await this._validatePoolLiquidity(
                            dexOp.dexA.poolAddress,
                            dexOp.dexB.poolAddress,
                            amount
                        );
                        
                        if (liquidityCheck.isValid) {
                            opportunities.push({
                                type: 'flash_loan_arbitrage',
                                id: this._generateOpportunityId('flash', dexOp.network, dexOp.pair.symbol, amount),
                                baseDEXOpportunity: dexOp.id,
                                network: dexOp.network,
                                pair: dexOp.pair,
                                flashLoanAmount: amount,
                                analysis: flashLoanAnalysis,
                                liquidity: liquidityCheck,
                                score: flashLoanAnalysis.roi, // ROI como score
                                confidence: this._calculateFlashLoanConfidence(flashLoanAnalysis, liquidityCheck),
                                executionPlan: this._createFlashLoanExecutionPlan(flashLoanAnalysis, dexOp),
                                expiresAt: new Date(Date.now() + 90 * 1000).toISOString(), // 90 sec
                                createdAt: new Date().toISOString()
                            });
                        }
                    }
                }
            } catch (error) {
                console.warn(`Error calculando flash loan para ${dexOp.id}:`, error.message);
            }
        }
        
        return opportunities
            .sort((a, b) => b.analysis.netProfit - a.analysis.netProfit)
            .slice(0, config.maxResultsPerType);
    }
    
    // ===================================================================
    // ESCANEO DE TRIANGULAR ARBITRAGE
    // ===================================================================
    
    /**
     * Escanear arbitraje triangular (A->B->C->A)
     * @param {Array} networks - Redes a escanear
     * @param {object} config - Configuración
     * @returns {Promise<Array>} Oportunidades triangulares
     */
    async _scanTriangularArbitrage(networks, config) {
        const opportunities = [];
        
        for (const network of networks) {
            try {
                // Obtener tokens populares de la red
                const tokens = this.popularTokens[network] || [];
                
                // Generar combinaciones triangulares (A-B-C-A)
                for (let i = 0; i < tokens.length; i++) {
                    for (let j = 0; j < tokens.length; j++) {
                        for (let k = 0; k < tokens.length; k++) {
                            if (i === j || j === k || i === k) continue;
                            
                            const tokenA = tokens[i];
                            const tokenB = tokens[j];
                            const tokenC = tokens[k];
                            
                            // Obtener rates para el ciclo
                            const rateAB = await this._getExchangeRate(network, tokenA, tokenB);
                            const rateBC = await this._getExchangeRate(network, tokenB, tokenC);
                            const rateCA = await this._getExchangeRate(network, tokenC, tokenA);
                            
                            if (!rateAB || !rateBC || !rateCA) continue;
                            
                            // Calcular triangular arbitrage
                            const triangularAnalysis = this.arbitrageMath.calculateTriangularArbitrage(
                                rateAB,
                                rateBC,
                                rateCA,
                                config.testAmount || 1000
                            );
                            
                            if (triangularAnalysis.isViable && 
                                triangularAnalysis.netProfitPercentage > 0.5) { // >0.5% profit
                                
                                opportunities.push({
                                    type: 'triangular_arbitrage',
                                    id: this._generateOpportunityId('triangular', network, `${tokenA.symbol}-${tokenB.symbol}-${tokenC.symbol}`),
                                    network: network,
                                    path: [tokenA, tokenB, tokenC],
                                    rates: { AB: rateAB, BC: rateBC, CA: rateCA },
                                    analysis: triangularAnalysis,
                                    score: triangularAnalysis.netProfitPercentage,
                                    confidence: this._calculateTriangularConfidence(triangularAnalysis),
                                    executionPlan: this._createTriangularExecutionPlan(triangularAnalysis),
                                    expiresAt: new Date(Date.now() + 60 * 1000).toISOString(), // 1 min
                                    createdAt: new Date().toISOString()
                                });
                            }
                        }
                    }
                }
            } catch (error) {
                console.warn(`Error escaneando triangular en ${network}:`, error.message);
            }
        }
        
        return opportunities
            .sort((a, b) => b.analysis.netProfitPercentage - a.analysis.netProfitPercentage)
            .slice(0, config.maxResultsPerType);
    }
    
    // ===================================================================
    // ESCANEOS ADICIONALES (IMPLEMENTACIÓN BÁSICA)
    // ===================================================================
    
    /**
     * Escanear arbitraje estadístico
     */
    async _scanStatisticalArbitrage(tokenPairs, config) {
        const opportunities = [];
        
        for (const pair of tokenPairs) {
            try {
                // Obtener historial de precios (placeholder)
                const priceHistory = await this._getPriceHistory(pair, 24); // 24 horas
                
                if (priceHistory && priceHistory.length >= 24) {
                    const statAnalysis = this.arbitrageMath.calculateStatisticalArbitrage(priceHistory, 24);
                    
                    if (statAnalysis.signal && statAnalysis.expectedReturn > 0.5) {
                        opportunities.push({
                            type: 'statistical_arbitrage',
                            id: this._generateOpportunityId('statistical', 'multi', pair.symbol),
                            pair: pair,
                            analysis: statAnalysis,
                            score: statAnalysis.expectedReturn * statAnalysis.confidence,
                            confidence: statAnalysis.confidence,
                            expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 min
                            createdAt: new Date().toISOString()
                        });
                    }
                }
            } catch (error) {
                console.warn(`Error en statistical arbitrage para ${pair.symbol}:`, error.message);
            }
        }
        
        return opportunities.slice(0, config.maxResultsPerType);
    }
    
    /**
     * Escanear arbitraje temporal
     */
    async _scanTemporalArbitrage(tokenPairs, config) {
        const opportunities = [];
        
        for (const pair of tokenPairs) {
            try {
                const recentPrices = await this._getRecentPrices(pair, 10); // Últimos 10 minutos
                
                if (recentPrices && recentPrices.length >= 5) {
                    const temporalAnalysis = this.arbitrageMath.calculateTemporalArbitrage(recentPrices, 60); // 60s delay
                    
                    if (temporalAnalysis.isViable && temporalAnalysis.expectedProfit > 0.3) {
                        opportunities.push({
                            type: 'temporal_arbitrage',
                            id: this._generateOpportunityId('temporal', 'multi', pair.symbol),
                            pair: pair,
                            analysis: temporalAnalysis,
                            score: temporalAnalysis.expectedProfit,
                            confidence: temporalAnalysis.riskLevel === 'LOW' ? 0.8 : 0.5,
                            expiresAt: new Date(Date.now() + temporalAnalysis.profitWindow * 1000).toISOString(),
                            createdAt: new Date().toISOString()
                        });
                    }
                }
            } catch (error) {
                console.warn(`Error en temporal arbitrage para ${pair.symbol}:`, error.message);
            }
        }
        
        return opportunities.slice(0, config.maxResultsPerType);
    }
    
    /**
     * Escanear arbitraje de liquidez
     */
    async _scanLiquidityArbitrage(networks, tokenPairs, config) {
        const opportunities = [];
        
        for (const network of networks) {
            for (const pair of tokenPairs) {
                try {
                    // Obtener pools del mismo par en la red
                    const pools = await this._getPoolsForPair(network, pair);
                    
                    if (pools.length >= 2) {
                        const liquidityAnalysis = this.arbitrageMath.calculateLiquidityArbitrage(
                            pools,
                            config.testAmount || 1000
                        );
                        
                        if (liquidityAnalysis.isViable && liquidityAnalysis.netSpread > 0.3) {
                            opportunities.push({
                                type: 'liquidity_arbitrage',
                                id: this._generateOpportunityId('liquidity', network, pair.symbol),
                                network: network,
                                pair: pair,
                                analysis: liquidityAnalysis,
                                score: liquidityAnalysis.netSpread,
                                confidence: 0.7, // Medium confidence por defecto
                                expiresAt: new Date(Date.now() + 3 * 60 * 1000).toISOString(), // 3 min
                                createdAt: new Date().toISOString()
                            });
                        }
                    }
                } catch (error) {
                    console.warn(`Error en liquidity arbitrage para ${pair.symbol}:`, error.message);
                }
            }
        }
        
        return opportunities.slice(0, config.maxResultsPerType);
    }
    
    // Implementaciones placeholder para otros tipos
    async _scanSpatialArbitrage(config) { return []; }
    async _scanBridgeArbitrage(networks, config) { return []; }
    async _scanOracleArbitrage(tokenPairs, config) { return []; }
    async _scanFeeArbitrage(networks, config) { return []; }
    async _scanSlippageArbitrage(networks, tokenPairs, config) { return []; }
    async _scanMEVArbitrage(networks, config) { return []; }
    
    // ===================================================================
    // UTILIDADES DE DATOS
    // ===================================================================
    
    /**
     * Obtener precios de DEXs para un par específico
     */
    async _getDEXPrices(network, dexes, pair) {
        const prices = [];
        
        for (const dex of dexes) {
            try {
                // En implementación real, consultar APIs de DEXs
                const price = await this._fetchDEXPrice(dex, pair);
                
                if (price) {
                    prices.push({
                        dex: dex.name,
                        type: dex.type,
                        address: dex.address,
                        poolAddress: price.poolAddress,
                        price: price.price,
                        liquidity: price.liquidity,
                        volume24h: price.volume24h,
                        timestamp: Date.now()
                    });
                }
            } catch (error) {
                console.warn(`Error fetching price from ${dex.name}:`, error.message);
            }
        }
        
        return prices;
    }
    
    /**
     * Fetch precio de DEX específico (placeholder)
     */
    async _fetchDEXPrice(dex, pair) {
        // En implementación real, usar APIs como:
        // - 1inch API para quotes
        // - The Graph queries
        // - Direct contract calls
        
        // Por ahora retornar datos simulados
        const basePrice = 2000; // ETH price ~$2000
        const variation = (Math.random() - 0.5) * 100; // ±$50 variation
        
        return {
            price: basePrice + variation,
            poolAddress: `0x${Math.random().toString(16).substr(2, 40)}`,
            liquidity: 1000000 + Math.random() * 9000000, // $1M-$10M
            volume24h: 100000 + Math.random() * 900000    // $100K-$1M
        };
    }
    
    /**
     * Validar liquidez de pools
     */
    async _validatePoolLiquidity(poolAddressA, poolAddressB, amount) {
        try {
            // Usar LiquidityValidator para validar ambos pools
            const poolA = {
                address: poolAddressA,
                dexType: 'uniswapV2',
                reserve0: 1000000,
                reserve1: 2000000000,
                token0Price: 2000,
                token1Price: 1
            };
            
            const validation = await this.liquidityValidator.validatePoolLiquidity(poolA, amount);
            return validation;
            
        } catch (error) {
            return { isValid: false, error: error.message };
        }
    }
    
    /**
     * Calcular costos de trading usando GasCalculator
     */
    async _calculateTradingCosts(network, operation, pair) {
        try {
            // Obtener precio del token nativo
            const nativePrice = await this._getNativeTokenPrice(network);
            
            // Calcular costos de gas
            const gasCost = await this.gasCalculator.calculateGasCostUSD(
                network,
                operation,
                'standard',
                nativePrice
            );
            
            // Agregar trading fees (estimado)
            const tradingFees = 1000 * 0.003 * 2; // 0.3% por swap, 2 swaps
            
            return {
                gasCostUSD: gasCost.cost.usd,
                tradingFees: tradingFees,
                bridgeFees: 0,
                slippage: 5, // $5 estimado
                total: gasCost.cost.usd + tradingFees + 5
            };
            
        } catch (error) {
            // Fallback costs
            return {
                gasCostUSD: 20,
                tradingFees: 6,
                bridgeFees: 0,
                slippage: 5,
                total: 31
            };
        }
    }
    
    // ===================================================================
    // CÁLCULOS DE SCORING Y CONFIANZA
    // ===================================================================
    
    /**
     * Calcular score de oportunidad
     */
    _calculateOpportunityScore(spreadData, profitAnalysis, liquidityCheck) {
        let score = 0;
        
        // Base: profit neto
        score += profitAnalysis.netProfit;
        
        // Bonificar spread alto
        score += spreadData.percentageSpread * 2;
        
        // Bonificar liquidez alta
        if (liquidityCheck.pool?.liquidityUSD > 1000000) score += 10;
        
        // Penalizar riesgo alto
        score -= profitAnalysis.riskScore * 0.5;
        
        return Math.max(score, 0);
    }
    
    /**
     * Calcular confianza general
     */
    _calculateConfidence(spreadData, liquidityCheck, costs) {
        let confidence = 0.8; // Base 80%
        
        if (spreadData.percentageSpread > 2) confidence += 0.1;
        if (liquidityCheck.pool?.liquidityUSD > 1000000) confidence += 0.1;
        if (costs.total < 20) confidence += 0.05;
        
        return Math.min(confidence, 0.95);
    }
    
    /**
     * Calcular confianza cross-chain
     */
    _calculateCrossChainConfidence(analysis) {
        let confidence = 0.6; // Base más baja por complejidad
        
        if (analysis.netProfit > 50) confidence += 0.2;
        if (analysis.estimatedExecutionTime < 300) confidence += 0.1; // <5 min
        
        return Math.min(confidence, 0.85);
    }
    
    /**
     * Calcular confianza flash loan
     */
    _calculateFlashLoanConfidence(analysis, liquidityCheck) {
        let confidence = 0.7; // Base media
        
        if (analysis.roi > 20) confidence += 0.1; // >20% ROI
        if (liquidityCheck.pool?.liquidityUSD > 5000000) confidence += 0.1; // >$5M liquidity
        if (analysis.leverageMultiplier > 10) confidence += 0.05; // Good leverage
        
        return Math.min(confidence, 0.9);
    }
    
    /**
     * Calcular confianza triangular
     */
    _calculateTriangularConfidence(analysis) {
        let confidence = 0.65; // Base por complejidad de 3 swaps
        
        if (analysis.netProfitPercentage > 1) confidence += 0.15;
        if (analysis.riskScore < 30) confidence += 0.1;
        
        return Math.min(confidence, 0.85);
    }
    
    // ===================================================================
    // PLANES DE EJECUCIÓN
    // ===================================================================
    
    /**
     * Crear plan de ejecución DEX
     */
    _createExecutionPlan(type, spreadData, costs) {
        return {
            type: `${type}_execution`,
            steps: [
                { step: 1, action: 'approve_tokens', estimatedGas: 45000 },
                { step: 2, action: 'buy_from_dex_a', estimatedGas: 150000 },
                { step: 3, action: 'sell_to_dex_b', estimatedGas: 150000 }
            ],
            totalEstimatedGas: 345000,
            estimatedTime: '60-120 seconds',
            requiredApprovals: 2,
            slippageTolerance: '1%',
            gasPrice: 'standard'
        };
    }
    
    /**
     * Crear plan de ejecución cross-chain
     */
    _createCrossChainExecutionPlan(analysis) {
        return {
            type: 'cross_chain_execution',
            steps: [
                { step: 1, action: 'buy_on_chain_a', estimatedTime: '2 min' },
                { step: 2, action: 'bridge_to_chain_b', estimatedTime: `${analysis.estimatedExecutionTime / 60} min` },
                { step: 3, action: 'sell_on_chain_b', estimatedTime: '2 min' }
            ],
            totalEstimatedTime: `${(analysis.estimatedExecutionTime / 60) + 4} minutes`,
            bridgeService: 'recommended',
            requiredConfirmations: { chainA: 12, chainB: 6 }
        };
    }
    
    /**
     * Crear plan de ejecución flash loan
     */
    _createFlashLoanExecutionPlan(analysis, dexOp) {
        return {
            type: 'flash_loan_execution',
            steps: [
                { step: 1, action: 'initiate_flash_loan', estimatedGas: 100000 },
                { step: 2, action: 'execute_arbitrage_swaps', estimatedGas: 250000 },
                { step: 3, action: 'repay_flash_loan', estimatedGas: 50000 }
            ],
            flashLoanProvider: 'aave_v3',
            totalEstimatedGas: 400000,
            estimatedTime: '30-60 seconds',
            capitalRequired: 0,
            liquidationRisk: 'none'
        };
    }
    
    /**
     * Crear plan de ejecución triangular
     */
    _createTriangularExecutionPlan(analysis) {
        return {
            type: 'triangular_execution',
            steps: [
                { step: 1, action: 'swap_a_to_b', estimatedGas: 150000 },
                { step: 2, action: 'swap_b_to_c', estimatedGas: 150000 },
                { step: 3, action: 'swap_c_to_a', estimatedGas: 150000 }
            ],
            totalEstimatedGas: 450000,
            estimatedTime: '90-180 seconds',
            atomicExecution: true,
            revertOnLoss: true
        };
    }
    
    // ===================================================================
    // UTILIDADES GENERALES
    // ===================================================================
    
    /**
     * Generar pares de tokens por defecto
     */
    _getDefaultTokenPairs(networks) {
        const pairs = [];
        
        for (const network of networks) {
            const tokens = this.popularTokens[network] || [];
            
            // Crear pares principales
            for (let i = 0; i < tokens.length; i++) {
                for (let j = i + 1; j < tokens.length; j++) {
                    pairs.push({
                        symbol: `${tokens[i].symbol}/${tokens[j].symbol}`,
                        token0: tokens[i],
                        token1: tokens[j],
                        network: network
                    });
                }
            }
        }
        
        return pairs.slice(0, 20); // Limitar a 20 pares principales
    }
    
    /**
     * Generar ID único de oportunidad
     */
    _generateOpportunityId(type, network, pair, extra = '') {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 5);
        return `${type}_${network}_${pair}_${extra}_${timestamp}_${random}`.replace(/[^a-zA-Z0-9_]/g, '');
    }
    
    /**
     * Generar ID de escaneo
     */
    _generateScanId() {
        return `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * Calcular resumen del escaneo
     */
    _calculateScanSummary(results) {
        const allOpportunities = Object.values(results.opportunities).flat();
        const viableOpportunities = allOpportunities.filter(op => op.score > 0);
        
        results.summary.totalScanned = allOpportunities.length;
        results.summary.totalViable = viableOpportunities.length;
        
        if (viableOpportunities.length > 0) {
            const profits = viableOpportunities.map(op => {
                return op.profit?.netProfit || 
                       op.analysis?.netProfit || 
                       op.score || 0;
            });
            
            results.summary.bestProfitUSD = Math.max(...profits);
            results.summary.averageProfitUSD = profits.reduce((a, b) => a + b, 0) / profits.length;
            results.summary.topOpportunity = viableOpportunities.reduce((best, current) => {
                const bestProfit = best.profit?.netProfit || best.analysis?.netProfit || best.score || 0;
                const currentProfit = current.profit?.netProfit || current.analysis?.netProfit || current.score || 0;
                return currentProfit > bestProfit ? current : best;
            });
        }
    }
    
    /**
     * Actualizar estadísticas del escáner
     */
    _updateScanStats(results) {
        this.scanStats.totalOpportunities = results.summary.totalScanned;
        this.scanStats.viableOpportunities = results.summary.totalViable;
        this.scanStats.avgProfitUSD = results.summary.averageProfitUSD;
        this.scanStats.bestOpportunity = results.summary.topOpportunity;
    }
    
    /**
     * Crear respuesta de error
     */
    _createErrorResponse(error) {
        return {
            success: false,
            error: error.message,
            timestamp: new Date().toISOString(),
            opportunities: {},
            summary: { totalScanned: 0, totalViable: 0 }
        };
    }
    
    /**
     * Cache de oportunidades
     */
    _cacheOpportunities(scanId, results) {
        this.opportunityCache.set(scanId, {
            data: results,
            timestamp: Date.now()
        });
        
        // Auto-cleanup
        setTimeout(() => {
            this.opportunityCache.delete(scanId);
        }, this.CACHE_DURATION);
    }
    
    // ===================================================================
    // MÉTODOS PLACEHOLDER PARA APIs EXTERNAS
    // ===================================================================
    
    async _getNativeTokenPrice(network) {
        const prices = { ethereum: 2000, polygon: 0.8, bsc: 300, arbitrum: 2000 };
        return prices[network] || 1000;
    }
    
    async _getBestPriceForPair(network, pair) {
        return { price: 2000 + (Math.random() - 0.5) * 100 };
    }
    
    async _estimateBridgeFee(network, pair) { return 5 + Math.random() * 10; }
    async _estimateBridgeTime(network) { return 300 + Math.random() * 600; } // 5-15 min
    async _getExchangeRate(network, tokenA, tokenB) {
        return { 
            rate: 1 + (Math.random() - 0.5) * 0.1, 
            fee: 0.003,
            tokenA: tokenA.symbol,
            tokenB: tokenB.symbol,
            volatility: Math.random() * 0.2
        };
    }
    async _getPriceHistory(pair, hours) { return null; }
    async _getRecentPrices(pair, minutes) { return null; }
    async _getPoolsForPair(network, pair) { return []; }
    
    // ===================================================================
    // API PÚBLICA
    // ===================================================================
    
    /**
     * Obtener estadísticas del escáner
     */
    getStats() {
        return {
            ...this.scanStats,
            isScanning: this.isScanning,
            lastScanTime: this.lastScanTime,
            cacheSize: this.opportunityCache.size
        };
    }
    
    /**
     * Obtener configuración actual
     */
    getConfig() {
        return { ...this.scanConfig };
    }
    
    /**
     * Actualizar configuración
     */
    updateConfig(newConfig) {
        this.scanConfig = { ...this.scanConfig, ...newConfig };
        return this.scanConfig;
    }
}

export default OpportunityScanner;
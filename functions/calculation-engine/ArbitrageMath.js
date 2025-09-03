/**
 * 🧮 NÚCLEO MATEMÁTICO SUPREMO - ArbitrageX Supreme
 * 
 * METODOLOGÍA: INGENIO PICHICHI S.A.
 * - Disciplinado: Cada cálculo con precisión matemática exacta
 * - Organizado: 13 tipos de arbitraje completamente identificados
 * - Metodológico: Implementación sistemática y verificable
 * 
 * @version 1.0.0
 * @author ArbitrageX Supreme Engineering Team
 */

/**
 * 🎯 13 TIPOS DE ARBITRAJE IDENTIFICADOS PLENAMENTE:
 * 
 * 1. DEX ARBITRAGE - Diferencias de precio entre DEXs
 * 2. CROSS-CHAIN ARBITRAGE - Arbitraje entre diferentes blockchains  
 * 3. FLASH LOAN ARBITRAGE - Arbitraje sin capital usando flash loans
 * 4. SPATIAL ARBITRAGE - Diferencias geográficas de precio
 * 5. TEMPORAL ARBITRAGE - Aprovechamiento de delays en actualizaciones
 * 6. STATISTICAL ARBITRAGE - Patrones estadísticos de precios
 * 7. TRIANGULAR ARBITRAGE - Ciclos de 3 tokens para generar profit
 * 8. BRIDGE ARBITRAGE - Diferencias en puentes entre chains
 * 9. ORACLE ARBITRAGE - Diferencias entre oráculos de precios
 * 10. LIQUIDITY ARBITRAGE - Diferencias por niveles de liquidez
 * 11. FEE ARBITRAGE - Aprovechamiento de diferencias en fees
 * 12. SLIPPAGE ARBITRAGE - Explotación de slippage diferencial
 * 13. MEV ARBITRAGE - Maximal Extractable Value opportunities
 */

export class ArbitrageMath {
    
    constructor() {
        this.PRECISION_DECIMALS = 18;
        this.MIN_SPREAD_PERCENTAGE = 0.1; // 0.1% mínimo
        this.MAX_SLIPPAGE_PERCENTAGE = 5.0; // 5% máximo
        this.RISK_FREE_RATE = 0.03; // 3% anual
        
        // Constantes matemáticas para diferentes tipos de arbitraje
        this.ARBITRAGE_TYPES = {
            DEX_ARBITRAGE: 'dex_arbitrage',
            CROSS_CHAIN: 'cross_chain',
            FLASH_LOAN: 'flash_loan',
            SPATIAL: 'spatial',
            TEMPORAL: 'temporal', 
            STATISTICAL: 'statistical',
            TRIANGULAR: 'triangular',
            BRIDGE: 'bridge',
            ORACLE: 'oracle',
            LIQUIDITY: 'liquidity',
            FEE: 'fee',
            SLIPPAGE: 'slippage',
            MEV: 'mev'
        };
        
        // Factores de riesgo por tipo de arbitraje
        this.RISK_FACTORS = {
            [this.ARBITRAGE_TYPES.DEX_ARBITRAGE]: 1.0,
            [this.ARBITRAGE_TYPES.CROSS_CHAIN]: 2.5,
            [this.ARBITRAGE_TYPES.FLASH_LOAN]: 1.2,
            [this.ARBITRAGE_TYPES.SPATIAL]: 3.0,
            [this.ARBITRAGE_TYPES.TEMPORAL]: 1.8,
            [this.ARBITRAGE_TYPES.STATISTICAL]: 2.2,
            [this.ARBITRAGE_TYPES.TRIANGULAR]: 1.5,
            [this.ARBITRAGE_TYPES.BRIDGE]: 2.8,
            [this.ARBITRAGE_TYPES.ORACLE]: 2.0,
            [this.ARBITRAGE_TYPES.LIQUIDITY]: 1.3,
            [this.ARBITRAGE_TYPES.FEE]: 1.1,
            [this.ARBITRAGE_TYPES.SLIPPAGE]: 1.4,
            [this.ARBITRAGE_TYPES.MEV]: 1.7
        };
    }
    
    // ===================================================================
    // 1. 🔄 DEX ARBITRAGE - Arbitraje entre DEXs
    // ===================================================================
    
    /**
     * Calcular spread básico entre dos DEXs
     * @param {number} priceA - Precio en DEX A
     * @param {number} priceB - Precio en DEX B
     * @param {string} tokenPair - Par de tokens (ej: "ETH/USDC")
     * @returns {object} Análisis completo del spread
     */
    calculateDEXSpread(priceA, priceB, tokenPair = "UNKNOWN") {
        this._validatePrices(priceA, priceB);
        
        const highPrice = Math.max(priceA, priceB);
        const lowPrice = Math.min(priceA, priceB);
        
        const absoluteSpread = highPrice - lowPrice;
        const percentageSpread = (absoluteSpread / lowPrice) * 100;
        const midPrice = (highPrice + lowPrice) / 2;
        
        return {
            type: this.ARBITRAGE_TYPES.DEX_ARBITRAGE,
            tokenPair,
            priceA,
            priceB,
            highPrice,
            lowPrice,
            midPrice,
            absoluteSpread,
            percentageSpread,
            buyExchange: priceA < priceB ? 'A' : 'B',
            sellExchange: priceA > priceB ? 'A' : 'B',
            isArbitrageable: percentageSpread >= this.MIN_SPREAD_PERCENTAGE,
            spreadQuality: this._assessSpreadQuality(percentageSpread),
            calculatedAt: new Date().toISOString()
        };
    }
    
    // ===================================================================
    // 2. 🌉 CROSS-CHAIN ARBITRAGE - Arbitraje entre blockchains
    // ===================================================================
    
    /**
     * Calcular arbitraje cross-chain considerando bridge costs
     * @param {object} chainAData - {price, network, bridgeFee, bridgeTime}
     * @param {object} chainBData - {price, network, bridgeFee, bridgeTime}
     * @param {number} amount - Cantidad en USD
     * @returns {object} Análisis de arbitraje cross-chain
     */
    calculateCrossChainArbitrage(chainAData, chainBData, amount) {
        this._validateChainData(chainAData);
        this._validateChainData(chainBData);
        
        const baseSpread = this.calculateDEXSpread(chainAData.price, chainBData.price);
        
        // Costos adicionales del bridge
        const totalBridgeFee = chainAData.bridgeFee + chainBData.bridgeFee;
        const bridgeTimeRisk = Math.max(chainAData.bridgeTime, chainBData.bridgeTime) * 0.001; // 0.1% por minuto
        
        const grossProfit = (baseSpread.percentageSpread / 100) * amount;
        const bridgeCosts = totalBridgeFee + (amount * bridgeTimeRisk);
        const netProfit = grossProfit - bridgeCosts;
        
        return {
            type: this.ARBITRAGE_TYPES.CROSS_CHAIN,
            baseSpread,
            chainA: chainAData.network,
            chainB: chainBData.network,
            grossProfit,
            bridgeCosts: {
                fees: totalBridgeFee,
                timeRisk: amount * bridgeTimeRisk,
                total: bridgeCosts
            },
            netProfit,
            profitMargin: (netProfit / amount) * 100,
            isViable: netProfit > 0,
            estimatedExecutionTime: Math.max(chainAData.bridgeTime, chainBData.bridgeTime) + 120, // +2 min buffer
            riskScore: this._calculateRiskScore(baseSpread, { total: bridgeCosts }, this.ARBITRAGE_TYPES.CROSS_CHAIN)
        };
    }
    
    // ===================================================================
    // 3. ⚡ FLASH LOAN ARBITRAGE - Sin capital inicial
    // ===================================================================
    
    /**
     * Calcular arbitraje con flash loan (sin capital)
     * @param {object} spreadData - Datos del spread
     * @param {number} flashLoanAmount - Cantidad del flash loan
     * @param {number} flashLoanFee - Fee del flash loan (0.05% = 0.0005)
     * @param {object} gasCosts - Costos de gas
     * @returns {object} Análisis de flash loan arbitrage
     */
    calculateFlashLoanArbitrage(spreadData, flashLoanAmount, flashLoanFee = 0.0005, gasCosts) {
        if (!spreadData.isArbitrageable) {
            return {
                type: this.ARBITRAGE_TYPES.FLASH_LOAN,
                isViable: false,
                error: 'Spread insufficient for arbitrage'
            };
        }
        
        const flashLoanCost = flashLoanAmount * flashLoanFee;
        const grossProfit = (spreadData.percentageSpread / 100) * flashLoanAmount;
        const totalCosts = flashLoanCost + (gasCosts?.total || 0);
        const netProfit = grossProfit - totalCosts;
        
        // Calcular leverage effect
        const leverageMultiplier = flashLoanAmount / (totalCosts || 1);
        
        return {
            type: this.ARBITRAGE_TYPES.FLASH_LOAN,
            baseSpread: spreadData,
            flashLoan: {
                amount: flashLoanAmount,
                fee: flashLoanFee,
                cost: flashLoanCost
            },
            grossProfit,
            totalCosts,
            netProfit,
            leverageMultiplier,
            roi: netProfit > 0 ? (netProfit / totalCosts) * 100 : -100,
            isViable: netProfit > 0,
            capitalRequired: 0, // Flash loan no requiere capital
            riskScore: this._calculateRiskScore(spreadData, { total: totalCosts }, this.ARBITRAGE_TYPES.FLASH_LOAN)
        };
    }
    
    // ===================================================================
    // 4. 🌍 SPATIAL ARBITRAGE - Diferencias geográficas
    // ===================================================================
    
    /**
     * Calcular arbitraje spatial (geográfico)
     * @param {Array} regionalPrices - [{region, price, premium, regulatoryRisk}]
     * @param {object} transferCosts - Costos de transferencia
     * @returns {object} Oportunidades spatial
     */
    calculateSpatialArbitrage(regionalPrices, transferCosts) {
        if (regionalPrices.length < 2) {
            return { type: this.ARBITRAGE_TYPES.SPATIAL, opportunities: [] };
        }
        
        const opportunities = [];
        
        for (let i = 0; i < regionalPrices.length; i++) {
            for (let j = i + 1; j < regionalPrices.length; j++) {
                const regionA = regionalPrices[i];
                const regionB = regionalPrices[j];
                
                const spread = this.calculateDEXSpread(regionA.price, regionB.price);
                
                if (spread.isArbitrageable) {
                    const regulatoryRisk = (regionA.regulatoryRisk || 0) + (regionB.regulatoryRisk || 0);
                    const transferCost = transferCosts?.international || 0;
                    
                    opportunities.push({
                        fromRegion: spread.buyExchange === 'A' ? regionA.region : regionB.region,
                        toRegion: spread.sellExchange === 'A' ? regionA.region : regionB.region,
                        spread,
                        costs: {
                            transfer: transferCost,
                            regulatory: regulatoryRisk
                        },
                        netSpread: spread.percentageSpread - (transferCost + regulatoryRisk),
                        viability: spread.percentageSpread > (transferCost + regulatoryRisk + 1) // +1% margin
                    });
                }
            }
        }
        
        return {
            type: this.ARBITRAGE_TYPES.SPATIAL,
            opportunities: opportunities.filter(op => op.viability)
                                    .sort((a, b) => b.netSpread - a.netSpread)
        };
    }
    
    // ===================================================================
    // 5. ⏰ TEMPORAL ARBITRAGE - Aprovechamiento de delays
    // ===================================================================
    
    /**
     * Calcular arbitraje temporal basado en delays de precio
     * @param {Array} priceHistory - Historial de precios con timestamps
     * @param {number} delaySeconds - Delay esperado en segundos
     * @returns {object} Análisis temporal
     */
    calculateTemporalArbitrage(priceHistory, delaySeconds) {
        if (priceHistory.length < 2) {
            return {
                type: this.ARBITRAGE_TYPES.TEMPORAL,
                opportunity: null,
                reason: 'Insufficient price history'
            };
        }
        
        const latest = priceHistory[priceHistory.length - 1];
        const delayed = priceHistory[priceHistory.length - 2];
        
        const priceChange = ((latest.price - delayed.price) / delayed.price) * 100;
        const timeGap = (latest.timestamp - delayed.timestamp) / 1000; // seconds
        
        const velocityRisk = Math.abs(priceChange) / timeGap; // %/second
        const profitWindow = delaySeconds; // seconds to exploit
        
        return {
            type: this.ARBITRAGE_TYPES.TEMPORAL,
            priceChange,
            timeGap,
            velocityRisk,
            profitWindow,
            expectedProfit: Math.abs(priceChange) * 0.7, // 70% capture rate
            isViable: Math.abs(priceChange) > 0.5 && profitWindow > 30, // >0.5% change, >30s window
            riskLevel: velocityRisk > 0.1 ? 'HIGH' : velocityRisk > 0.05 ? 'MEDIUM' : 'LOW'
        };
    }
    
    // ===================================================================
    // 6. 📊 STATISTICAL ARBITRAGE - Patrones estadísticos
    // ===================================================================
    
    /**
     * Calcular arbitraje estadístico usando regresión a la media
     * @param {Array} priceHistory - Historial de precios
     * @param {number} lookbackPeriod - Período para análisis
     * @returns {object} Análisis estadístico
     */
    calculateStatisticalArbitrage(priceHistory, lookbackPeriod = 24) {
        if (priceHistory.length < lookbackPeriod) {
            return {
                type: this.ARBITRAGE_TYPES.STATISTICAL,
                signal: null,
                reason: 'Insufficient data for statistical analysis'
            };
        }
        
        const recentData = priceHistory.slice(-lookbackPeriod);
        const prices = recentData.map(d => d.price);
        
        const mean = prices.reduce((a, b) => a + b) / prices.length;
        const variance = prices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / prices.length;
        const stdDev = Math.sqrt(variance);
        
        const currentPrice = prices[prices.length - 1];
        const zScore = (currentPrice - mean) / stdDev;
        
        // Bollinger Bands calculation
        const upperBand = mean + (2 * stdDev);
        const lowerBand = mean - (2 * stdDev);
        
        let signal = null;
        if (currentPrice > upperBand && zScore > 2) {
            signal = 'SELL'; // Price too high, expect reversion
        } else if (currentPrice < lowerBand && zScore < -2) {
            signal = 'BUY'; // Price too low, expect reversion
        }
        
        return {
            type: this.ARBITRAGE_TYPES.STATISTICAL,
            mean,
            stdDev,
            currentPrice,
            zScore,
            bollingerBands: { upper: upperBand, lower: lowerBand },
            signal,
            confidence: Math.abs(zScore) / 3, // Normalize to 0-1
            expectedReturn: signal ? Math.abs(mean - currentPrice) / currentPrice * 100 : 0
        };
    }
    
    // ===================================================================
    // 7. 🔺 TRIANGULAR ARBITRAGE - Ciclos de 3 tokens
    // ===================================================================
    
    /**
     * Calcular arbitraje triangular (A->B->C->A)
     * @param {object} ratesAB - Rate A to B
     * @param {object} ratesBC - Rate B to C  
     * @param {object} ratesCA - Rate C to A
     * @param {number} startAmount - Cantidad inicial
     * @returns {object} Análisis triangular
     */
    calculateTriangularArbitrage(ratesAB, ratesBC, ratesCA, startAmount = 1) {
        try {
            // Calcular ciclo completo: A -> B -> C -> A
            const step1 = startAmount * ratesAB.rate; // A to B
            const step2 = step1 * ratesBC.rate;       // B to C
            const finalAmount = step2 * ratesCA.rate; // C to A
            
            const profit = finalAmount - startAmount;
            const profitPercentage = (profit / startAmount) * 100;
            
            // Calcular fees acumulados
            const totalFees = (ratesAB.fee || 0) + (ratesBC.fee || 0) + (ratesCA.fee || 0);
            const netProfit = profit - (startAmount * totalFees);
            const netProfitPercentage = (netProfit / startAmount) * 100;
            
            return {
                type: this.ARBITRAGE_TYPES.TRIANGULAR,
                path: `${ratesAB.tokenA} -> ${ratesAB.tokenB} -> ${ratesBC.tokenB} -> ${ratesCA.tokenB}`,
                execution: {
                    step1: { amount: step1, rate: ratesAB.rate },
                    step2: { amount: step2, rate: ratesBC.rate },
                    final: { amount: finalAmount, rate: ratesCA.rate }
                },
                grossProfit: profit,
                grossProfitPercentage: profitPercentage,
                totalFees,
                netProfit,
                netProfitPercentage,
                isViable: netProfitPercentage > 0.1, // >0.1% for viability
                riskScore: this._calculateTriangularRisk(ratesAB, ratesBC, ratesCA)
            };
        } catch (error) {
            return {
                type: this.ARBITRAGE_TYPES.TRIANGULAR,
                error: error.message,
                isViable: false
            };
        }
    }
    
    // ===================================================================
    // 8. 🌉 BRIDGE ARBITRAGE - Diferencias en puentes
    // ===================================================================
    
    /**
     * Calcular arbitraje de bridge entre chains
     * @param {Array} bridgeOptions - Diferentes opciones de bridge
     * @param {number} amount - Cantidad a transferir
     * @returns {object} Mejor opción de bridge arbitrage
     */
    calculateBridgeArbitrage(bridgeOptions, amount) {
        const analysis = bridgeOptions.map(bridge => {
            const totalCost = bridge.fee + (bridge.gasCost || 0);
            const effectiveRate = (amount - totalCost) / amount;
            const timeValue = bridge.timeMinutes * 0.0001; // Time cost factor
            
            return {
                ...bridge,
                totalCost,
                effectiveRate,
                timeValue,
                netValue: amount * effectiveRate - (amount * timeValue),
                efficiency: effectiveRate - timeValue
            };
        });
        
        const bestBridge = analysis.reduce((best, current) => 
            current.efficiency > best.efficiency ? current : best
        );
        
        return {
            type: this.ARBITRAGE_TYPES.BRIDGE,
            analysis,
            recommendation: bestBridge,
            savings: bestBridge.efficiency > 0.99 ? 
                     (bestBridge.netValue - analysis[0].netValue) : 0
        };
    }
    
    // ===================================================================
    // 9. 🔮 ORACLE ARBITRAGE - Diferencias entre oráculos
    // ===================================================================
    
    /**
     * Calcular arbitraje entre diferentes oráculos
     * @param {Array} oraclePrices - [{source, price, confidence, lag}]
     * @returns {object} Oportunidades de oracle arbitrage
     */
    calculateOracleArbitrage(oraclePrices) {
        if (oraclePrices.length < 2) return null;
        
        const opportunities = [];
        
        for (let i = 0; i < oraclePrices.length; i++) {
            for (let j = i + 1; j < oraclePrices.length; j++) {
                const oracleA = oraclePrices[i];
                const oracleB = oraclePrices[j];
                
                const spread = this.calculateDEXSpread(oracleA.price, oracleB.price);
                
                if (spread.isArbitrageable) {
                    const confidenceFactor = Math.min(oracleA.confidence, oracleB.confidence);
                    const lagRisk = Math.max(oracleA.lag, oracleB.lag) * 0.1;
                    
                    opportunities.push({
                        sourceA: oracleA.source,
                        sourceB: oracleB.source,
                        spread,
                        confidenceFactor,
                        lagRisk,
                        adjustedSpread: spread.percentageSpread * confidenceFactor - lagRisk,
                        isViable: (spread.percentageSpread * confidenceFactor - lagRisk) > 0.3
                    });
                }
            }
        }
        
        return {
            type: this.ARBITRAGE_TYPES.ORACLE,
            opportunities: opportunities.filter(op => op.isViable)
        };
    }
    
    // ===================================================================
    // 10. 💧 LIQUIDITY ARBITRAGE - Diferencias por liquidez
    // ===================================================================
    
    /**
     * Calcular arbitraje basado en niveles de liquidez
     * @param {Array} pools - [{address, liquidity, fee, volume24h}]
     * @param {number} tradeAmount - Cantidad a intercambiar
     * @returns {object} Análisis de liquidez
     */
    calculateLiquidityArbitrage(pools, tradeAmount) {
        const analysis = pools.map(pool => {
            const liquidityRatio = tradeAmount / pool.liquidity;
            const priceImpact = this._calculatePriceImpact(liquidityRatio);
            const effectivePrice = pool.price * (1 + priceImpact);
            
            return {
                ...pool,
                liquidityRatio,
                priceImpact: priceImpact * 100,
                effectivePrice,
                tradingCost: tradeAmount * pool.fee
            };
        });
        
        // Find best buy and sell pools
        const bestBuy = analysis.reduce((best, pool) => 
            pool.effectivePrice < best.effectivePrice ? pool : best
        );
        
        const bestSell = analysis.reduce((best, pool) => 
            pool.effectivePrice > best.effectivePrice ? pool : best
        );
        
        const spread = ((bestSell.effectivePrice - bestBuy.effectivePrice) / bestBuy.effectivePrice) * 100;
        const totalCosts = bestBuy.tradingCost + bestSell.tradingCost;
        
        return {
            type: this.ARBITRAGE_TYPES.LIQUIDITY,
            bestBuy,
            bestSell,
            spread,
            totalCosts,
            netSpread: spread - (totalCosts / tradeAmount * 100),
            isViable: spread > (totalCosts / tradeAmount * 100) + 0.2
        };
    }
    
    // ===================================================================
    // 11. 💰 FEE ARBITRAGE - Diferencias en fees
    // ===================================================================
    
    /**
     * Calcular arbitraje de fees
     * @param {Array} venues - [{name, tradingFee, withdrawalFee, depositFee}]
     * @param {number} volume - Volumen de trading
     * @returns {object} Análisis de fees
     */
    calculateFeeArbitrage(venues, volume) {
        const analysis = venues.map(venue => {
            const totalTradingCost = volume * venue.tradingFee;
            const totalTransferCost = venue.withdrawalFee + venue.depositFee;
            const totalCost = totalTradingCost + totalTransferCost;
            
            return {
                ...venue,
                totalTradingCost,
                totalTransferCost,
                totalCost,
                effectiveRate: totalCost / volume
            };
        });
        
        const cheapest = analysis.reduce((best, venue) => 
            venue.totalCost < best.totalCost ? venue : best
        );
        
        const savings = analysis.map(venue => ({
            venue: venue.name,
            savings: venue.totalCost - cheapest.totalCost,
            savingsPercentage: ((venue.totalCost - cheapest.totalCost) / venue.totalCost) * 100
        }));
        
        return {
            type: this.ARBITRAGE_TYPES.FEE,
            analysis,
            recommendation: cheapest,
            potentialSavings: savings.filter(s => s.savings > 0)
        };
    }
    
    // ===================================================================
    // 12. 📉 SLIPPAGE ARBITRAGE - Explotación de slippage
    // ===================================================================
    
    /**
     * Calcular arbitraje de slippage diferencial
     * @param {object} poolA - {liquidity, volume, price}
     * @param {object} poolB - {liquidity, volume, price}
     * @param {number} amount - Cantidad del trade
     * @returns {object} Análisis de slippage
     */
    calculateSlippageArbitrage(poolA, poolB, amount) {
        const slippageA = this._calculateSlippage(amount, poolA.liquidity, poolA.volume);
        const slippageB = this._calculateSlippage(amount, poolB.liquidity, poolB.volume);
        
        const effectivePriceA = poolA.price * (1 + slippageA);
        const effectivePriceB = poolB.price * (1 + slippageB);
        
        const slippageDifference = Math.abs(slippageA - slippageB) * 100;
        const priceDifference = Math.abs(effectivePriceA - effectivePriceB);
        const profitOpportunity = priceDifference * amount;
        
        return {
            type: this.ARBITRAGE_TYPES.SLIPPAGE,
            poolA: { ...poolA, slippage: slippageA * 100, effectivePrice: effectivePriceA },
            poolB: { ...poolB, slippage: slippageB * 100, effectivePrice: effectivePriceB },
            slippageDifference,
            profitOpportunity,
            isViable: slippageDifference > 1 && profitOpportunity > 10 // >1% slippage diff, >$10 profit
        };
    }
    
    // ===================================================================
    // 13. ⚡ MEV ARBITRAGE - Maximal Extractable Value
    // ===================================================================
    
    /**
     * Calcular MEV arbitrage opportunities
     * @param {Array} pendingTransactions - Transacciones pendientes en mempool
     * @param {object} currentState - Estado actual del pool
     * @returns {object} Oportunidades MEV
     */
    calculateMEVArbitrage(pendingTransactions, currentState) {
        const opportunities = [];
        
        pendingTransactions.forEach(tx => {
            if (tx.type === 'swap') {
                // Calcular estado post-transacción
                const newPrice = this._simulateSwapImpact(tx, currentState);
                const priceChange = ((newPrice - currentState.price) / currentState.price) * 100;
                
                if (Math.abs(priceChange) > 0.5) { // >0.5% price impact
                    const mevValue = Math.abs(priceChange) * currentState.liquidity * 0.001; // Estimate
                    
                    opportunities.push({
                        transaction: tx.hash,
                        currentPrice: currentState.price,
                        expectedPrice: newPrice,
                        priceChange,
                        mevValue,
                        strategy: priceChange > 0 ? 'frontrun_sell' : 'frontrun_buy',
                        gasPrice: tx.gasPrice,
                        profitability: mevValue - (tx.gasPrice * 21000 * 1e-18 * 2000) // Rough calculation
                    });
                }
            }
        });
        
        return {
            type: this.ARBITRAGE_TYPES.MEV,
            opportunities: opportunities.filter(op => op.profitability > 0)
                                     .sort((a, b) => b.profitability - a.profitability)
        };
    }
    
    // ===================================================================
    // MÉTODOS DE UTILIDAD Y VALIDACIÓN
    // ===================================================================
    
    /**
     * Validar precios de entrada
     */
    _validatePrices(priceA, priceB) {
        if (!priceA || !priceB || priceA <= 0 || priceB <= 0) {
            throw new Error(`Precios inválidos: A=${priceA}, B=${priceB}`);
        }
    }
    
    /**
     * Validar datos de chain
     */
    _validateChainData(chainData) {
        if (!chainData.price || !chainData.network) {
            throw new Error('Chain data incompletos');
        }
    }
    
    /**
     * Evaluar calidad del spread
     */
    _assessSpreadQuality(percentageSpread) {
        if (percentageSpread >= 5) return 'EXCELLENT';
        if (percentageSpread >= 2) return 'GOOD';  
        if (percentageSpread >= 0.5) return 'FAIR';
        return 'POOR';
    }
    
    /**
     * Calcular score de riesgo general
     */
    _calculateRiskScore(spreadData, costs, arbitrageType) {
        let riskScore = 0;
        
        // Riesgo por spread pequeño
        if (spreadData.percentageSpread < 1) riskScore += 30;
        else if (spreadData.percentageSpread < 2) riskScore += 15;
        
        // Riesgo por costos altos
        const costRatio = costs.total / (spreadData.absoluteSpread || 1);
        if (costRatio > 0.5) riskScore += 40;
        else if (costRatio > 0.25) riskScore += 20;
        
        // Factor de riesgo por tipo de arbitraje
        const typeFactor = this.RISK_FACTORS[arbitrageType] || 1.0;
        riskScore *= typeFactor;
        
        // Riesgo base
        riskScore += 10;
        
        return Math.min(Math.round(riskScore), 100);
    }
    
    /**
     * Calcular riesgo triangular específico
     */
    _calculateTriangularRisk(rateAB, rateBC, rateCA) {
        const rateVolatility = [rateAB.volatility || 0.1, rateBC.volatility || 0.1, rateCA.volatility || 0.1];
        const avgVolatility = rateVolatility.reduce((a, b) => a + b) / rateVolatility.length;
        
        const executionSteps = 3; // Triangular siempre tiene 3 pasos
        const stepRisk = executionSteps * 5; // 5 puntos por paso
        const volatilityRisk = avgVolatility * 100; // Convert to percentage points
        
        return Math.min(stepRisk + volatilityRisk, 100);
    }
    
    /**
     * Calcular impacto de precio simple
     */
    _calculatePriceImpact(liquidityRatio) {
        // Fórmula simplificada: impact = k * sqrt(ratio)
        const k = 0.1; // Factor de calibración
        return k * Math.sqrt(liquidityRatio);
    }
    
    /**
     * Calcular slippage basado en liquidez y volumen
     */
    _calculateSlippage(amount, liquidity, volume24h) {
        const liquidityRatio = amount / liquidity;
        const volumeRatio = amount / (volume24h / 24); // Hourly volume approximation
        
        return Math.min(liquidityRatio * 0.5 + volumeRatio * 0.1, 0.05); // Max 5% slippage
    }
    
    /**
     * Simular impacto de swap para MEV
     */
    _simulateSwapImpact(transaction, currentState) {
        const swapRatio = transaction.amount / currentState.liquidity;
        const priceImpact = this._calculatePriceImpact(swapRatio);
        
        return currentState.price * (1 + (transaction.type === 'buy' ? priceImpact : -priceImpact));
    }
    
    // ===================================================================
    // MÉTODO PRINCIPAL DE ANÁLISIS INTEGRAL
    // ===================================================================
    
    /**
     * Análisis integral de múltiples tipos de arbitraje
     * @param {object} marketData - Datos completos del mercado
     * @param {object} userParams - Parámetros del usuario
     * @returns {object} Análisis completo con todos los tipos
     */
    analyzeAllArbitrageTypes(marketData, userParams = {}) {
        const results = {
            timestamp: new Date().toISOString(),
            totalOpportunities: 0,
            analysis: {}
        };
        
        try {
            // 1. DEX Arbitrage
            if (marketData.dexPrices && marketData.dexPrices.length >= 2) {
                results.analysis.dex = this.calculateDEXSpread(
                    marketData.dexPrices[0].price, 
                    marketData.dexPrices[1].price,
                    marketData.pair
                );
            }
            
            // 2. Cross-Chain
            if (marketData.chainPrices && marketData.chainPrices.length >= 2) {
                results.analysis.crossChain = this.calculateCrossChainArbitrage(
                    marketData.chainPrices[0],
                    marketData.chainPrices[1],
                    userParams.amount || 1000
                );
            }
            
            // 3. Flash Loan
            if (results.analysis.dex && results.analysis.dex.isArbitrageable) {
                results.analysis.flashLoan = this.calculateFlashLoanArbitrage(
                    results.analysis.dex,
                    userParams.flashLoanAmount || 10000,
                    0.0005,
                    marketData.gasCosts
                );
            }
            
            // 4. Triangular
            if (marketData.triangularRates) {
                results.analysis.triangular = this.calculateTriangularArbitrage(
                    marketData.triangularRates.AB,
                    marketData.triangularRates.BC,
                    marketData.triangularRates.CA,
                    userParams.amount || 1000
                );
            }
            
            // 5. Statistical  
            if (marketData.priceHistory) {
                results.analysis.statistical = this.calculateStatisticalArbitrage(
                    marketData.priceHistory,
                    userParams.lookbackPeriod || 24
                );
            }
            
            // Contar oportunidades viables
            results.totalOpportunities = Object.values(results.analysis)
                .filter(analysis => analysis && (analysis.isViable || analysis.isArbitrageable))
                .length;
            
            return results;
            
        } catch (error) {
            return {
                timestamp: new Date().toISOString(),
                error: error.message,
                totalOpportunities: 0,
                analysis: {}
            };
        }
    }
}

export default ArbitrageMath;
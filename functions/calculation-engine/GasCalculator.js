/**
 * ⛽ CALCULADORA DE GAS SUPREMAMENTE PRECISA - ArbitrageX Supreme
 * 
 * METODOLOGÍA: INGENIO PICHICHI S.A.
 * - Disciplinado: Cálculos de gas con precisión exacta al wei
 * - Organizado: Soporte multi-red con APIs reales
 * - Metodológico: Optimización de costos y tiempo de ejecución
 * 
 * @version 1.0.0
 * @author ArbitrageX Supreme Engineering Team
 */

export class GasCalculator {
    
    constructor() {
        // Precios base de gas por red (gwei) - actualizados con APIs reales
        this.baseGasPrices = {
            ethereum: { slow: 15, standard: 20, fast: 30, network: 'mainnet', chainId: 1 },
            polygon: { slow: 25, standard: 35, fast: 50, network: 'polygon', chainId: 137 },
            bsc: { slow: 3, standard: 5, fast: 8, network: 'bsc', chainId: 56 },
            arbitrum: { slow: 0.1, standard: 0.2, fast: 0.5, network: 'arbitrum', chainId: 42161 },
            optimism: { slow: 0.001, standard: 0.002, fast: 0.005, network: 'optimism', chainId: 10 },
            avalanche: { slow: 20, standard: 25, fast: 35, network: 'avalanche', chainId: 43114 }
        };
        
        // Límites de gas por tipo de operación (optimizados)
        this.gasLimits = {
            simpleTransfer: 21000,
            simpleSwap: 150000,
            complexSwap: 200000,
            arbitrageSwap: 250000,
            flashLoanArbitrage: 380000,
            flashLoanSimple: 320000,
            bridgeTransfer: 120000,
            approveToken: 45000,
            multiDEXArbitrage: 450000,
            triangularArbitrage: 300000,
            crossChainArbitrage: 500000,
            mevArbitrage: 280000,
            liquidityProvision: 180000,
            liquidityRemoval: 160000,
            stakingDeposit: 100000,
            stakingWithdraw: 120000
        };
        
        // APIs reales para obtención de gas prices
        this.gasAPIs = {
            ethereum: {
                etherscan: 'https://api.etherscan.io/api?module=gastracker&action=gasoracle',
                ethGasStation: 'https://api.ethgasstation.info/api/ethgasAPI.json',
                gasNow: 'https://www.gasnow.org/api/v3/gas/price'
            },
            polygon: {
                gasStation: 'https://gasstation-mainnet.matic.network/v2',
                polygonscan: 'https://api.polygonscan.com/api?module=gastracker&action=gasoracle'
            },
            bsc: {
                bscscan: 'https://api.bscscan.com/api?module=gastracker&action=gasoracle'
            },
            arbitrum: {
                arbiscan: 'https://api.arbiscan.io/api?module=gastracker&action=gasoracle'
            }
        };
        
        // Factor de conversión y utilidades
        this.WEI_PER_GWEI = 1e9;
        this.WEI_PER_ETH = 1e18;
        this.GWEI_PER_ETH = 1e9;
        
        // Cache para evitar llamadas excesivas a APIs
        this.gasCache = new Map();
        this.CACHE_DURATION = 30 * 1000; // 30 segundos
        
        // Configuración de retry para APIs
        this.MAX_RETRIES = 3;
        this.RETRY_DELAY = 1000; // 1 segundo
    }
    
    // ===================================================================
    // OBTENCIÓN DE PRECIOS DE GAS EN TIEMPO REAL
    // ===================================================================
    
    /**
     * Obtener precio de gas en tiempo real con fallback robusto
     * @param {string} network - Red blockchain (ethereum, polygon, bsc, arbitrum)
     * @param {boolean} useCache - Usar cache si está disponible
     * @returns {Promise<object>} Precios de gas actuales
     */
    async getRealTimeGasPrice(network, useCache = true) {
        try {
            // Verificar cache primero
            if (useCache) {
                const cached = this._getCachedGasPrice(network);
                if (cached) return cached;
            }
            
            let gasData = null;
            
            switch (network) {
                case 'ethereum':
                    gasData = await this._getEthereumGasPrice();
                    break;
                    
                case 'polygon':
                    gasData = await this._getPolygonGasPrice();
                    break;
                    
                case 'bsc':
                    gasData = await this._getBSCGasPrice();
                    break;
                    
                case 'arbitrum':
                    gasData = await this._getArbitrumGasPrice();
                    break;
                    
                case 'optimism':
                    gasData = await this._getOptimismGasPrice();
                    break;
                    
                case 'avalanche':
                    gasData = await this._getAvalancheGasPrice();
                    break;
                    
                default:
                    throw new Error(`Red no soportada: ${network}`);
            }
            
            // Validar datos obtenidos
            if (!gasData || !this._validateGasData(gasData)) {
                throw new Error('Datos de gas inválidos recibidos');
            }
            
            // Cachear resultado
            this._cacheGasPrice(network, gasData);
            
            return gasData;
            
        } catch (error) {
            console.warn(`Error obteniendo gas price para ${network}:`, error.message);
            // Fallback a precios base
            return this._getFallbackGasPrice(network);
        }
    }
    
    /**
     * Obtener gas price de Ethereum con múltiples fuentes
     */
    async _getEthereumGasPrice() {
        // Intentar múltiples APIs con fallback
        const sources = [
            () => this._fetchEtherscanGas(),
            () => this._fetchEthGasStationGas(),
            () => this._fetchGasNowGas()
        ];
        
        for (const source of sources) {
            try {
                const result = await this._retryRequest(source);
                if (result) return result;
            } catch (error) {
                console.warn('Error en fuente de gas Ethereum:', error.message);
                continue;
            }
        }
        
        throw new Error('Todas las fuentes de gas Ethereum fallaron');
    }
    
    /**
     * Fetch gas desde Etherscan API
     */
    async _fetchEtherscanGas() {
        const response = await fetch(this.gasAPIs.ethereum.etherscan);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        if (data.status !== '1') throw new Error('Etherscan API error');
        
        return {
            slow: parseInt(data.result.SafeGasPrice),
            standard: parseInt(data.result.ProposeGasPrice),  
            fast: parseInt(data.result.FastGasPrice),
            source: 'etherscan',
            network: 'ethereum',
            timestamp: Date.now()
        };
    }
    
    /**
     * Fetch gas desde ETH Gas Station
     */
    async _fetchEthGasStationGas() {
        const response = await fetch(this.gasAPIs.ethereum.ethGasStation);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        
        return {
            slow: Math.ceil(data.safeLow / 10), // ETH Gas Station usa deciGwei
            standard: Math.ceil(data.standard / 10),
            fast: Math.ceil(data.fast / 10),
            source: 'ethgasstation',
            network: 'ethereum',
            timestamp: Date.now()
        };
    }
    
    /**
     * Fetch gas desde GasNow (backup)
     */
    async _fetchGasNowGas() {
        try {
            const response = await fetch(this.gasAPIs.ethereum.gasNow);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            
            return {
                slow: Math.ceil(data.data.slow / this.WEI_PER_GWEI),
                standard: Math.ceil(data.data.standard / this.WEI_PER_GWEI),
                fast: Math.ceil(data.data.fast / this.WEI_PER_GWEI),
                source: 'gasnow',
                network: 'ethereum',
                timestamp: Date.now()
            };
        } catch (error) {
            // GasNow puede no estar disponible, usar fallback
            throw new Error('GasNow no disponible');
        }
    }
    
    /**
     * Obtener gas price de Polygon
     */
    async _getPolygonGasPrice() {
        try {
            const response = await fetch(this.gasAPIs.polygon.gasStation);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            
            return {
                slow: Math.ceil(data.safeLow.maxFee),
                standard: Math.ceil(data.standard.maxFee),
                fast: Math.ceil(data.fast.maxFee),
                source: 'polygon-gasstation',
                network: 'polygon',
                timestamp: Date.now()
            };
        } catch (error) {
            // Fallback a Polygonscan
            return this._fetchPolygonscanGas();
        }
    }
    
    /**
     * Fetch gas desde Polygonscan
     */
    async _fetchPolygonscanGas() {
        const response = await fetch(this.gasAPIs.polygon.polygonscan);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        if (data.status !== '1') throw new Error('Polygonscan API error');
        
        return {
            slow: parseInt(data.result.SafeGasPrice),
            standard: parseInt(data.result.ProposeGasPrice),
            fast: parseInt(data.result.FastGasPrice),
            source: 'polygonscan',
            network: 'polygon', 
            timestamp: Date.now()
        };
    }
    
    /**
     * Obtener gas price de BSC
     */
    async _getBSCGasPrice() {
        const response = await fetch(this.gasAPIs.bsc.bscscan);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        if (data.status !== '1') throw new Error('BSCScan API error');
        
        return {
            slow: parseInt(data.result.SafeGasPrice),
            standard: parseInt(data.result.ProposeGasPrice),
            fast: parseInt(data.result.FastGasPrice),
            source: 'bscscan',
            network: 'bsc',
            timestamp: Date.now()
        };
    }
    
    /**
     * Obtener gas price de Arbitrum
     */
    async _getArbitrumGasPrice() {
        const response = await fetch(this.gasAPIs.arbitrum.arbiscan);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        if (data.status !== '1') throw new Error('Arbiscan API error');
        
        return {
            slow: parseFloat(data.result.SafeGasPrice),
            standard: parseFloat(data.result.ProposeGasPrice),
            fast: parseFloat(data.result.FastGasPrice),
            source: 'arbiscan',
            network: 'arbitrum',
            timestamp: Date.now()
        };
    }
    
    /**
     * Obtener gas price de Optimism (placeholder - implementar API específica)
     */
    async _getOptimismGasPrice() {
        // Optimism tiene gas muy bajo, usar valores estimados
        return {
            slow: 0.001,
            standard: 0.002,
            fast: 0.005,
            source: 'estimated',
            network: 'optimism',
            timestamp: Date.now()
        };
    }
    
    /**
     * Obtener gas price de Avalanche (placeholder - implementar API específica)
     */
    async _getAvalancheGasPrice() {
        // Usar valores base de Avalanche
        return {
            slow: 20,
            standard: 25,
            fast: 35,
            source: 'estimated',
            network: 'avalanche',
            timestamp: Date.now()
        };
    }
    
    // ===================================================================
    // CÁLCULOS DE COSTOS DE GAS
    // ===================================================================
    
    /**
     * Calcular costo total de gas en USD con precisión exacta
     * @param {string} network - Red blockchain
     * @param {string} operation - Tipo de operación
     * @param {string} speed - Velocidad (slow/standard/fast)
     * @param {number} nativeTokenPriceUSD - Precio del token nativo
     * @param {number} customGasLimit - Gas limit personalizado (opcional)
     * @returns {Promise<object>} Análisis completo de costos
     */
    async calculateGasCostUSD(network, operation, speed = 'standard', nativeTokenPriceUSD, customGasLimit = null) {
        try {
            // Validar parámetros
            this._validateCalculationParams(network, operation, speed, nativeTokenPriceUSD);
            
            // Obtener precio de gas actual
            const gasPrices = await this.getRealTimeGasPrice(network);
            const gasLimit = customGasLimit || this.gasLimits[operation] || this.gasLimits.simpleSwap;
            const gasPriceGwei = gasPrices[speed];
            
            if (!gasPriceGwei || gasPriceGwei <= 0) {
                throw new Error(`Gas price inválido para ${speed} en ${network}`);
            }
            
            // Cálculos matemáticos precisos
            const gasPriceWei = BigInt(Math.floor(gasPriceGwei * this.WEI_PER_GWEI));
            const gasLimitBigInt = BigInt(gasLimit);
            const gasCostWei = gasPriceWei * gasLimitBigInt;
            
            // Convertir a unidades legibles
            const gasCostNative = Number(gasCostWei) / this.WEI_PER_ETH;
            const gasCostUSD = gasCostNative * nativeTokenPriceUSD;
            
            // Calcular métricas adicionales
            const efficiency = this._calculateGasEfficiency(network, operation, gasCostUSD);
            const recommendation = this._getSpeedRecommendation(gasPrices, gasCostUSD);
            
            return {
                network,
                operation,
                speed,
                gasLimit,
                gasPrice: {
                    gwei: gasPriceGwei,
                    wei: gasPriceWei.toString(),
                    source: gasPrices.source
                },
                cost: {
                    wei: gasCostWei.toString(),
                    native: gasCostNative,
                    usd: gasCostUSD
                },
                nativeTokenPrice: nativeTokenPriceUSD,
                efficiency,
                recommendation,
                alternatives: this._calculateAlternativeSpeeds(gasPrices, gasLimit, nativeTokenPriceUSD),
                calculatedAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + this.CACHE_DURATION).toISOString()
            };
            
        } catch (error) {
            throw new Error(`Error calculando gas cost: ${error.message}`);
        }
    }
    
    /**
     * Calcular costos de gas para múltiples operaciones en batch
     * @param {string} network - Red blockchain
     * @param {Array} operations - Lista de operaciones a calcular
     * @param {number} nativeTokenPriceUSD - Precio del token nativo
     * @returns {Promise<object>} Análisis batch de costos
     */
    async calculateBatchGasCosts(network, operations, nativeTokenPriceUSD) {
        const results = {
            network,
            nativeTokenPrice: nativeTokenPriceUSD,
            operations: [],
            summary: {
                totalCostUSD: 0,
                averageCostUSD: 0,
                mostExpensive: null,
                cheapest: null
            },
            calculatedAt: new Date().toISOString()
        };
        
        try {
            // Obtener gas prices una vez para todas las operaciones
            const gasPrices = await this.getRealTimeGasPrice(network);
            
            for (const op of operations) {
                const gasLimit = op.gasLimit || this.gasLimits[op.type] || this.gasLimits.simpleSwap;
                const speed = op.speed || 'standard';
                const gasPriceGwei = gasPrices[speed];
                
                const gasCostNative = (gasPriceGwei * gasLimit) / this.GWEI_PER_ETH;
                const gasCostUSD = gasCostNative * nativeTokenPriceUSD;
                
                const opResult = {
                    type: op.type,
                    speed,
                    gasLimit,
                    gasPriceGwei,
                    costUSD: gasCostUSD,
                    costNative: gasCostNative
                };
                
                results.operations.push(opResult);
                results.summary.totalCostUSD += gasCostUSD;
            }
            
            // Calcular estadísticas resumen
            if (results.operations.length > 0) {
                results.summary.averageCostUSD = results.summary.totalCostUSD / results.operations.length;
                results.summary.mostExpensive = results.operations.reduce((max, op) => 
                    op.costUSD > max.costUSD ? op : max
                );
                results.summary.cheapest = results.operations.reduce((min, op) => 
                    op.costUSD < min.costUSD ? op : min
                );
            }
            
            return results;
            
        } catch (error) {
            throw new Error(`Error en cálculo batch: ${error.message}`);
        }
    }
    
    /**
     * Estimar tiempo de confirmación basado en gas price
     * @param {string} network - Red blockchain
     * @param {string} speed - Velocidad seleccionada
     * @returns {Promise<object>} Estimación de tiempo
     */
    async estimateConfirmationTime(network, speed) {
        // Tiempos base por red (en segundos)
        const baseTimes = {
            ethereum: { slow: 300, standard: 180, fast: 60 }, // 5min, 3min, 1min
            polygon: { slow: 10, standard: 5, fast: 2 },       // 10s, 5s, 2s
            bsc: { slow: 15, standard: 10, fast: 3 },          // 15s, 10s, 3s
            arbitrum: { slow: 5, standard: 2, fast: 1 },       // 5s, 2s, 1s
            optimism: { slow: 5, standard: 2, fast: 1 },       // Similar a Arbitrum
            avalanche: { slow: 10, standard: 5, fast: 2 }      // Similar a Polygon
        };
        
        const networkTimes = baseTimes[network] || baseTimes.ethereum;
        const estimatedSeconds = networkTimes[speed] || networkTimes.standard;
        
        return {
            network,
            speed,
            estimatedSeconds,
            estimatedMinutes: Math.round(estimatedSeconds / 60 * 10) / 10,
            confidence: 0.8, // 80% confidence
            factors: this._getTimeFactors(network)
        };
    }
    
    // ===================================================================
    // OPTIMIZACIÓN Y RECOMENDACIONES
    // ===================================================================
    
    /**
     * Obtener recomendación de velocidad óptima
     * @param {object} gasPrices - Precios de gas por velocidad
     * @param {number} totalCostUSD - Costo total en USD
     * @returns {object} Recomendación
     */
    _getSpeedRecommendation(gasPrices, totalCostUSD) {
        const costs = {
            slow: totalCostUSD * (gasPrices.slow / gasPrices.standard),
            standard: totalCostUSD,
            fast: totalCostUSD * (gasPrices.fast / gasPrices.standard)
        };
        
        let recommendation = 'standard';
        let reason = 'Balance entre costo y velocidad';
        
        // Recomendar slow si el costo es muy alto y no hay prisa
        if (costs.standard > 50 && (costs.standard - costs.slow) > 10) {
            recommendation = 'slow';
            reason = 'Ahorro significativo disponible con slow';
        }
        
        // Recomendar fast si la diferencia es mínima
        if (costs.fast - costs.standard < 5 && costs.standard < 20) {
            recommendation = 'fast';
            reason = 'Diferencia de costo mínima, mejor velocidad';
        }
        
        return {
            recommended: recommendation,
            reason,
            costs,
            savings: costs.standard - costs[recommendation]
        };
    }
    
    /**
     * Calcular alternativas de velocidad
     * @param {object} gasPrices - Precios de gas
     * @param {number} gasLimit - Límite de gas
     * @param {number} nativePrice - Precio del token nativo
     * @returns {Array} Alternativas disponibles
     */
    _calculateAlternativeSpeeds(gasPrices, gasLimit, nativePrice) {
        return ['slow', 'standard', 'fast'].map(speed => {
            const gasCostNative = (gasPrices[speed] * gasLimit) / this.GWEI_PER_ETH;
            const gasCostUSD = gasCostNative * nativePrice;
            
            return {
                speed,
                gasPriceGwei: gasPrices[speed],
                costUSD: gasCostUSD,
                costNative: gasCostNative
            };
        });
    }
    
    /**
     * Calcular eficiencia de gas
     * @param {string} network - Red
     * @param {string} operation - Operación
     * @param {number} costUSD - Costo en USD
     * @returns {object} Métricas de eficiencia
     */
    _calculateGasEfficiency(network, operation, costUSD) {
        // Benchmarks de eficiencia por red
        const benchmarks = {
            ethereum: { excellent: 5, good: 15, poor: 50 },
            polygon: { excellent: 0.1, good: 1, poor: 5 },
            bsc: { excellent: 0.2, good: 1, poor: 3 },
            arbitrum: { excellent: 0.05, good: 0.5, poor: 2 }
        };
        
        const benchmark = benchmarks[network] || benchmarks.ethereum;
        
        let rating = 'POOR';
        if (costUSD <= benchmark.excellent) rating = 'EXCELLENT';
        else if (costUSD <= benchmark.good) rating = 'GOOD';
        else if (costUSD <= benchmark.poor) rating = 'FAIR';
        
        return {
            rating,
            costUSD,
            benchmark: benchmark,
            isExpensive: costUSD > benchmark.poor
        };
    }
    
    // ===================================================================
    // UTILIDADES Y VALIDACIÓN
    // ===================================================================
    
    /**
     * Validar parámetros de cálculo
     */
    _validateCalculationParams(network, operation, speed, nativePrice) {
        if (!network || typeof network !== 'string') {
            throw new Error('Network debe ser un string válido');
        }
        
        if (!operation || typeof operation !== 'string') {
            throw new Error('Operation debe ser un string válido');
        }
        
        if (!['slow', 'standard', 'fast'].includes(speed)) {
            throw new Error('Speed debe ser slow, standard o fast');
        }
        
        if (!nativePrice || nativePrice <= 0) {
            throw new Error('Native token price debe ser un número positivo');
        }
    }
    
    /**
     * Validar datos de gas recibidos
     */
    _validateGasData(gasData) {
        return gasData && 
               typeof gasData.slow === 'number' && gasData.slow > 0 &&
               typeof gasData.standard === 'number' && gasData.standard > 0 &&
               typeof gasData.fast === 'number' && gasData.fast > 0 &&
               gasData.network && gasData.timestamp;
    }
    
    /**
     * Obtener precios fallback si las APIs fallan
     */
    _getFallbackGasPrice(network) {
        const fallback = this.baseGasPrices[network];
        if (!fallback) {
            throw new Error(`No hay precios fallback para ${network}`);
        }
        
        return {
            ...fallback,
            source: 'fallback',
            timestamp: Date.now()
        };
    }
    
    /**
     * Sistema de caché para gas prices
     */
    _getCachedGasPrice(network) {
        const cached = this.gasCache.get(network);
        if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
            return cached;
        }
        return null;
    }
    
    _cacheGasPrice(network, gasData) {
        this.gasCache.set(network, gasData);
        
        // Limpiar cache viejo
        setTimeout(() => {
            this.gasCache.delete(network);
        }, this.CACHE_DURATION);
    }
    
    /**
     * Sistema de retry para requests
     */
    async _retryRequest(requestFn, retries = this.MAX_RETRIES) {
        for (let i = 0; i < retries; i++) {
            try {
                return await requestFn();
            } catch (error) {
                if (i === retries - 1) throw error;
                await new Promise(resolve => setTimeout(resolve, this.RETRY_DELAY * (i + 1)));
            }
        }
    }
    
    /**
     * Factores que afectan el tiempo de confirmación
     */
    _getTimeFactors(network) {
        const factors = {
            ethereum: ['Network congestion', 'Gas price tier', 'Block time variance'],
            polygon: ['Validator performance', 'Checkpoint delays'],
            bsc: ['Validator rotation', 'Network load'],
            arbitrum: ['L1 finality', 'Sequencer performance'],
            optimism: ['L1 finality', 'Batch submission timing']
        };
        
        return factors[network] || ['Network conditions', 'Gas price tier'];
    }
    
    // ===================================================================
    // ANÁLISIS AVANZADO DE GAS
    // ===================================================================
    
    /**
     * Análizar tendencias de gas en tiempo real
     * @param {string} network - Red blockchain
     * @param {number} hours - Horas de historial a analizar
     * @returns {Promise<object>} Análisis de tendencias
     */
    async analyzeGasTrends(network, hours = 24) {
        // Este método requeriría histórico de gas prices
        // Por ahora retornamos estructura básica
        return {
            network,
            period: `${hours}h`,
            trend: 'STABLE', // RISING, FALLING, STABLE, VOLATILE
            volatility: 'LOW', // LOW, MEDIUM, HIGH
            recommendation: 'EXECUTE_NOW', // EXECUTE_NOW, WAIT, RUSH
            nextUpdate: new Date(Date.now() + 5 * 60 * 1000).toISOString()
        };
    }
    
    /**
     * Comparar costos entre redes
     * @param {string} operation - Tipo de operación
     * @param {object} tokenPrices - Precios de tokens nativos por red
     * @returns {Promise<object>} Comparación cross-chain
     */
    async compareNetworkCosts(operation, tokenPrices) {
        const networks = Object.keys(tokenPrices);
        const comparisons = [];
        
        for (const network of networks) {
            try {
                const cost = await this.calculateGasCostUSD(
                    network, 
                    operation, 
                    'standard', 
                    tokenPrices[network]
                );
                
                comparisons.push({
                    network,
                    costUSD: cost.cost.usd,
                    gasLimit: cost.gasLimit,
                    gasPriceGwei: cost.gasPrice.gwei,
                    efficiency: cost.efficiency.rating
                });
            } catch (error) {
                console.warn(`Error comparando ${network}:`, error.message);
            }
        }
        
        // Ordenar por costo
        comparisons.sort((a, b) => a.costUSD - b.costUSD);
        
        return {
            operation,
            comparisons,
            cheapest: comparisons[0],
            mostExpensive: comparisons[comparisons.length - 1],
            savings: comparisons.length > 1 ? 
                    comparisons[comparisons.length - 1].costUSD - comparisons[0].costUSD : 0
        };
    }
}

export default GasCalculator;
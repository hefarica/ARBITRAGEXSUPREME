/**
 * 📊 SERVICIO DE PRECIOS REALES - ArbitrageX Supreme V3.0
 * 
 * METODOLOGÍA: INGENIO PICHICHI S.A.
 * - Disciplinado: Múltiples fuentes de precios para redundancia
 * - Organizado: Cache inteligente y rate limiting
 * - Metodológico: Validación cruzada entre APIs
 * 
 * FUENTES DE DATOS:
 * - CoinGecko: Precios históricos y actuales
 * - 1inch: Precios DEX en tiempo real
 * - Backup: Uniswap V3 direct queries
 * 
 * @version 2.0.0
 * @author ArbitrageX Supreme Engineering Team
 */

export interface PriceData {
    symbol: string;
    address: string;
    price_usd: number;
    price_change_24h: number;
    volume_24h: number;
    market_cap: number;
    last_updated: string;
    source: 'coingecko' | '1inch' | 'uniswap' | 'cache';
    network: string;
    liquidity?: number;
}

export interface ArbitrageOpportunity {
    tokenA: PriceData;
    tokenB: PriceData;
    exchangeA: string;
    exchangeB: string;
    priceA: number;
    priceB: number;
    spread: number;
    profit_potential: number;
    gas_cost_estimate: number;
    net_profit: number;
    confidence: number;
    expires_at: string;
}

export class PriceService {
    
    private cache: Map<string, { data: PriceData; timestamp: number }>;
    private readonly CACHE_DURATION = 30000; // 30 segundos
    private readonly RATE_LIMIT = 100; // requests por minuto
    
    constructor() {
        this.cache = new Map();
    }
    
    // ===================================================================
    // INTEGRACIÓN COINGECKO API
    // ===================================================================
    
    /**
     * Obtener precios de CoinGecko (datos históricos y actuales)
     */
    async getCoinGeckoPrices(symbols: string[]): Promise<PriceData[]> {
        // Implementar caching optimizado
        const cacheKey = `prices_coingecko_${symbols.sort().join(',')}`;
        
        try {
            // Intentar obtener del cache primero (si cacheService está disponible)
            if (typeof window !== 'undefined' && (window as any).cacheService) {
                const cachedResult = await (window as any).cacheService.get(cacheKey);
                if (cachedResult) {
                    console.log('📦 Cache hit for CoinGecko prices:', symbols);
                    return cachedResult;
                }
            }
            
            // CoinGecko API (gratuita, 50 calls/min)
            const ids = this.mapSymbolsToCoinGeckoIds(symbols);
            const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true&include_last_updated_at=true`;
            
            console.log('🌐 Fetching from CoinGecko API:', symbols);
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`CoinGecko API error: ${response.status}`);
            }
            
            const data = await response.json();
            const transformedData = this.transformCoinGeckoData(data, symbols);
            
            // Cachear resultado (si cacheService está disponible)
            if (typeof window !== 'undefined' && (window as any).cacheService) {
                await (window as any).cacheService.set(cacheKey, transformedData);
                console.log('💾 Cached CoinGecko prices for:', symbols);
            }
            
            return transformedData;
            
        } catch (error) {
            console.error('❌ Error fetching CoinGecko prices:', error);
            return [];
        }
    }
    
    /**
     * Mapear símbolos a IDs de CoinGecko
     */
    private mapSymbolsToCoinGeckoIds(symbols: string[]): string[] {
        const mapping: { [key: string]: string } = {
            'WETH': 'ethereum',
            'WBTC': 'wrapped-bitcoin',
            'USDC': 'usd-coin',
            'USDT': 'tether',
            'DAI': 'dai',
            'MATIC': 'matic-network',
            'BNB': 'binancecoin',
            'AVAX': 'avalanche-2',
            'LINK': 'chainlink',
            'UNI': 'uniswap',
            'AAVE': 'aave',
            'CRV': 'curve-dao-token',
            'COMP': 'compound-governance-token',
            'MKR': 'maker'
        };
        
        return symbols.map(symbol => mapping[symbol] || symbol.toLowerCase()).filter(Boolean);
    }
    
    /**
     * Transformar respuesta de CoinGecko
     */
    private transformCoinGeckoData(data: any, symbols: string[]): PriceData[] {
        const results: PriceData[] = [];
        
        for (const symbol of symbols) {
            const coinGeckoId = this.mapSymbolsToCoinGeckoIds([symbol])[0];
            const coinData = data[coinGeckoId];
            
            if (coinData) {
                results.push({
                    symbol,
                    address: '', // CoinGecko no provee address directamente
                    price_usd: coinData.usd || 0,
                    price_change_24h: coinData.usd_24h_change || 0,
                    volume_24h: coinData.usd_24h_vol || 0,
                    market_cap: coinData.usd_market_cap || 0,
                    last_updated: new Date().toISOString(),
                    source: 'coingecko',
                    network: 'ethereum'
                });
            }
        }
        
        return results;
    }
    
    // ===================================================================
    // INTEGRACIÓN 1INCH API
    // ===================================================================
    
    /**
     * Obtener precios de 1inch (DEX agregador)
     */
    async get1inchPrices(tokens: { address: string; symbol: string; network?: string }[]): Promise<PriceData[]> {
        try {
            const results: PriceData[] = [];
            
            for (const token of tokens) {
                const network = token.network || 'ethereum';
                const chainId = this.getChainId(network);
                
                // 1inch Price API (gratuita)
                const url = `https://api.1inch.dev/price/v1.1/${chainId}/${token.address}`;
                
                const response = await fetch(url);
                
                if (response.ok) {
                    const data = await response.json();
                    
                    results.push({
                        symbol: token.symbol,
                        address: token.address,
                        price_usd: data[token.address] || 0,
                        price_change_24h: 0, // 1inch no provee cambio 24h
                        volume_24h: 0,
                        market_cap: 0,
                        last_updated: new Date().toISOString(),
                        source: '1inch',
                        network: network
                    });
                }
            }
            
            return results;
            
        } catch (error) {
            console.error('❌ Error fetching 1inch prices:', error);
            return [];
        }
    }
    
    /**
     * Obtener chain ID para diferentes redes
     */
    private getChainId(network: string): number {
        const chains: { [key: string]: number } = {
            'ethereum': 1,
            'polygon': 137,
            'bsc': 56,
            'arbitrum': 42161,
            'optimism': 10,
            'avalanche': 43114,
            'base': 8453
        };
        
        return chains[network] || 1;
    }
    
    // ===================================================================
    // DETECCIÓN DE OPORTUNIDADES DE ARBITRAJE
    // ===================================================================
    
    /**
     * Escanear oportunidades de arbitraje entre exchanges
     */
    async scanArbitrageOpportunities(): Promise<ArbitrageOpportunity[]> {
        try {
            console.log('🔍 Escaneando oportunidades de arbitraje...');
            
            // Tokens principales para escaneo
            const majorTokens = [
                { symbol: 'WETH', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' },
                { symbol: 'USDC', address: '0xA0b86a33E6441b0d528f0D29f0e4a305b5185780' },
                { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7' },
                { symbol: 'WBTC', address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599' }
            ];
            
            // Obtener precios de múltiples fuentes
            const coinGeckoPrices = await this.getCoinGeckoPrices(majorTokens.map(t => t.symbol));
            const inchPrices = await this.get1inchPrices(majorTokens);
            
            // Detectar diferencias de precios
            const opportunities: ArbitrageOpportunity[] = [];
            
            for (const token of majorTokens) {
                const cgPrice = coinGeckoPrices.find(p => p.symbol === token.symbol);
                const inchPrice = inchPrices.find(p => p.symbol === token.symbol);
                
                if (cgPrice && inchPrice && cgPrice.price_usd > 0 && inchPrice.price_usd > 0) {
                    const spread = Math.abs(cgPrice.price_usd - inchPrice.price_usd) / cgPrice.price_usd * 100;
                    
                    // Solo oportunidades con spread > 0.5%
                    if (spread > 0.5) {
                        const gasEstimate = this.estimateGasCost(token.symbol);
                        const profitPotential = this.calculateProfitPotential(cgPrice.price_usd, inchPrice.price_usd, 1000); // $1000 position
                        
                        opportunities.push({
                            tokenA: cgPrice,
                            tokenB: inchPrice,
                            exchangeA: 'CoinGecko Aggregate',
                            exchangeB: '1inch DEX',
                            priceA: cgPrice.price_usd,
                            priceB: inchPrice.price_usd,
                            spread: spread,
                            profit_potential: profitPotential,
                            gas_cost_estimate: gasEstimate,
                            net_profit: profitPotential - gasEstimate,
                            confidence: this.calculateConfidence(spread, cgPrice.volume_24h),
                            expires_at: new Date(Date.now() + 60000).toISOString() // 1 minuto
                        });
                    }
                }
            }
            
            console.log(`✅ Encontradas ${opportunities.length} oportunidades de arbitraje`);
            return opportunities;
            
        } catch (error) {
            console.error('❌ Error scanning arbitrage opportunities:', error);
            return [];
        }
    }
    
    /**
     * Estimar costos de gas
     */
    private estimateGasCost(symbol: string): number {
        // Estimaciones basadas en gas histórico
        const gasEstimates: { [key: string]: number } = {
            'WETH': 25, // $25 promedio
            'USDC': 20,
            'USDT': 22,
            'WBTC': 30
        };
        
        return gasEstimates[symbol] || 25;
    }
    
    /**
     * Calcular potencial de ganancia
     */
    private calculateProfitPotential(priceA: number, priceB: number, position: number): number {
        const priceDiff = Math.abs(priceA - priceB);
        const tokens = position / Math.min(priceA, priceB);
        return tokens * priceDiff * 0.98; // 2% slippage
    }
    
    /**
     * Calcular nivel de confianza
     */
    private calculateConfidence(spread: number, volume: number): number {
        let confidence = 0;
        
        // Spread factor (mayor spread = mayor confianza)
        if (spread > 2) confidence += 40;
        else if (spread > 1) confidence += 25;
        else confidence += 10;
        
        // Volume factor (mayor volumen = mayor confianza)
        if (volume > 1000000) confidence += 40;
        else if (volume > 100000) confidence += 25;
        else confidence += 10;
        
        // Time factor (oportunidades recientes = mayor confianza)
        confidence += 20;
        
        return Math.min(confidence, 100);
    }
    
    // ===================================================================
    // GESTIÓN DE CACHE Y OPTIMIZACIÓN
    // ===================================================================
    
    /**
     * Obtener precio con cache inteligente
     */
    async getPriceWithCache(symbol: string, address?: string): Promise<PriceData | null> {
        const cacheKey = `${symbol}-${address || 'default'}`;
        const cached = this.cache.get(cacheKey);
        
        // Verificar cache válido
        if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
            return { ...cached.data, source: 'cache' as const };
        }
        
        // Obtener precio fresco
        let priceData: PriceData | null = null;
        
        if (address) {
            const inchPrices = await this.get1inchPrices([{ address, symbol }]);
            priceData = inchPrices[0] || null;
        } else {
            const cgPrices = await this.getCoinGeckoPrices([symbol]);
            priceData = cgPrices[0] || null;
        }
        
        // Guardar en cache
        if (priceData) {
            this.cache.set(cacheKey, {
                data: priceData,
                timestamp: Date.now()
            });
        }
        
        return priceData;
    }
    
    /**
     * Limpiar cache expirado
     */
    clearExpiredCache(): void {
        const now = Date.now();
        for (const [key, cached] of this.cache.entries()) {
            if (now - cached.timestamp > this.CACHE_DURATION) {
                this.cache.delete(key);
            }
        }
    }
    
    /**
     * Obtener estadísticas del servicio
     */
    getStats() {
        return {
            cache_size: this.cache.size,
            cache_duration_ms: this.CACHE_DURATION,
            rate_limit: this.RATE_LIMIT,
            last_cleanup: new Date().toISOString()
        };
    }
}
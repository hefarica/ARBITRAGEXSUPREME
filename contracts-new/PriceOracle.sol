// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title PriceOracle - Aggregador de Precios Multi-Fuente
 * @dev Sistema supremamente confiable para agregación de precios
 * @notice Combina Chainlink, Uniswap V3 TWAP, y múltiples DEXs
 */
// ============================================================================
// INTERFACES PARA INTEGRACIONES EXTERNAS
// ============================================================================

interface AggregatorV3Interface {
        function decimals() external view returns (uint8);
        function description() external view returns (string memory);
        function version() external view returns (uint256);
        function latestRoundData()
            external
            view
            returns (
                uint80 roundId,
                int256 price,
                uint256 startedAt,
                uint256 updatedAt,
                uint80 answeredInRound
            );
    }

interface IUniswapV3Pool {
        function observe(uint32[] calldata secondsAgos)
            external
            view
            returns (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityCumulativeX128s);
        
        function slot0()
            external
            view
            returns (
                uint160 sqrtPriceX96,
                int24 tick,
                uint16 observationIndex,
                uint16 observationCardinality,
                uint16 observationCardinalityNext,
                uint8 feeProtocol,
                bool unlocked
            );
}

interface IERC20Extended {
        function decimals() external view returns (uint8);
        function symbol() external view returns (string memory);
}

/**
 * @title PriceOracle - Aggregador de Precios Multi-Fuente
 * @dev Sistema supremamente confiable para agregación de precios
 * @notice Combina Chainlink, Uniswap V3 TWAP, y múltiples DEXs
 */
contract PriceOracle is Ownable, Pausable {

    // ============================================================================
    // ESTRUCTURAS DE DATOS OPTIMIZADAS
    // ============================================================================
    
    struct PriceData {
        uint256 price;              // Precio en 18 decimales
        uint256 timestamp;          // Timestamp de última actualización
        uint256 confidence;         // Nivel de confianza (0-100)
        uint8 decimals;             // Decimales del precio
        bool isValid;               // Si el precio es válido
    }
    
    struct OracleConfig {
        address feedAddress;        // Address del price feed
        uint256 heartbeat;          // Frecuencia esperada de updates (segundos)
        uint256 deviation;          // Desviación máxima permitida (basis points)
        uint256 weight;             // Peso en agregación (0-10000)
        bool isActive;              // Si está activo
        string source;              // Fuente (chainlink, uniswap, dex)
    }
    
    struct TWAPConfig {
        address poolAddress;        // Address del pool Uniswap V3
        uint32 period;              // Período TWAP en segundos
        address token0;             // Token 0 del par
        address token1;             // Token 1 del par
        bool isActive;
    }

    // ============================================================================
    // MAPPINGS PARA DATOS DE PRECIOS
    // ============================================================================
    
    // tokenA => tokenB => PriceData
    mapping(address => mapping(address => PriceData)) public prices;
    
    // tokenA => tokenB => OracleConfig[]
    mapping(address => mapping(address => OracleConfig[])) public oracles;
    
    // tokenA => tokenB => TWAPConfig
    mapping(address => mapping(address => TWAPConfig)) public twapConfigs;
    
    // token => peso en agregación
    mapping(address => uint256) public tokenWeights;
    
    // Chainlink feeds por network
    mapping(uint256 => mapping(string => address)) public chainlinkFeeds;
    
    // Fuentes autorizadas
    mapping(address => bool) public authorizedSources;

    // ============================================================================
    // CONSTANTES Y VARIABLES DE CONFIGURACIÓN
    // ============================================================================
    
    uint256 public constant PRICE_PRECISION = 1e18;
    uint256 public constant MAX_PRICE_DEVIATION = 1000; // 10% máximo
    uint256 public constant MIN_CONFIDENCE_LEVEL = 70;   // 70% mínimo
    uint256 public constant STALENESS_THRESHOLD = 3600;  // 1 hora
    
    uint256 public aggregationMethod = 1; // 0=promedio, 1=mediana, 2=ponderado
    uint256 public minSources = 2;        // Mínimo 2 fuentes para validez
    
    address public immutable WETH;
    
    // ============================================================================
    // EVENTOS
    // ============================================================================
    
    event PriceUpdated(
        address indexed tokenA,
        address indexed tokenB,
        uint256 price,
        uint256 confidence,
        string source,
        uint256 timestamp
    );
    
    event OracleConfigured(
        address indexed tokenA,
        address indexed tokenB,
        address oracle,
        string source,
        uint256 weight
    );
    
    event PriceAggregated(
        address indexed tokenA,
        address indexed tokenB,
        uint256 finalPrice,
        uint256 confidence,
        uint256 sourcesUsed,
        uint256 timestamp
    );

    // ============================================================================
    // CONSTRUCTOR
    // ============================================================================
    
    constructor(address _weth) Ownable(msg.sender) {
        require(_weth != address(0), "Invalid WETH address");
        WETH = _weth;
        
        // Setup initial Chainlink feeds
        _setupChainlinkFeeds();
        
        // Authorize initial sources
        authorizedSources[msg.sender] = true;
    }

    // ============================================================================
    // FUNCIONES PRINCIPALES DE PRECIO
    // ============================================================================
    
    /**
     * @dev Obtener precio agregado de máxima confianza
     * @param tokenA Token base
     * @param tokenB Token quote
     * @return price Precio final en 18 decimales
     * @return confidence Nivel de confianza (0-100)
     */
    function getAggregatedPrice(
        address tokenA,
        address tokenB
    ) external view returns (uint256 price, uint256 confidence) {
        require(tokenA != tokenB, "Same token");
        
        // 1. Obtener precios de todas las fuentes
        PriceData[] memory sourcePrices = _getAllSourcePrices(tokenA, tokenB);
        
        // 2. Filtrar precios válidos y recientes
        PriceData[] memory validPrices = _filterValidPrices(sourcePrices);
        
        require(validPrices.length >= minSources, "Insufficient price sources");
        
        // 3. Detectar y eliminar outliers
        PriceData[] memory cleanPrices = _removeOutliers(validPrices);
        
        // 4. Agregar precios según método configurado
        (price, confidence) = _aggregatePrices(cleanPrices);
        
        // 5. Validar resultado final
        require(confidence >= MIN_CONFIDENCE_LEVEL, "Low confidence");
        require(price > 0, "Invalid price");
        
        return (price, confidence);
    }
    
    /**
     * @dev Obtener precio de Chainlink específico
     */
    function getChainlinkPrice(
        address tokenA,
        address tokenB
    ) external view returns (uint256 price, uint256 confidence) {
        string memory pairKey = _getPairKey(tokenA, tokenB);
        address feedAddress = chainlinkFeeds[block.chainid][pairKey];
        
        require(feedAddress != address(0), "Chainlink feed not found");
        
        AggregatorV3Interface priceFeed = AggregatorV3Interface(feedAddress);
        
        try priceFeed.latestRoundData() returns (
            uint80,
            int256 feedPrice,
            uint256,
            uint256 updatedAt,
            uint80
        ) {
            require(feedPrice > 0, "Invalid Chainlink price");
            require(block.timestamp - updatedAt <= STALENESS_THRESHOLD, "Stale Chainlink price");
            
            uint8 feedDecimals = priceFeed.decimals();
            
            // Normalizar a 18 decimales
            price = uint256(feedPrice) * (10 ** (18 - feedDecimals));
            confidence = 95; // Chainlink tiene alta confianza
            
        } catch {
            revert("Chainlink price fetch failed");
        }
    }
    
    /**
     * @dev Obtener precio TWAP de Uniswap V3
     */
    function getUniswapTWAP(
        address tokenA,
        address tokenB
    ) external view returns (uint256 price, uint256 confidence) {
        TWAPConfig memory config = twapConfigs[tokenA][tokenB];
        require(config.isActive, "TWAP not configured");
        
        IUniswapV3Pool pool = IUniswapV3Pool(config.poolAddress);
        
        // Preparar array para observación TWAP
        uint32[] memory secondsAgos = new uint32[](2);
        secondsAgos[0] = config.period;  // e.g., 300 segundos (5 minutos)
        secondsAgos[1] = 0;              // Ahora
        
        try pool.observe(secondsAgos) returns (
            int56[] memory tickCumulatives,
            uint160[] memory
        ) {
            // Calcular tick promedio
            int56 tickCumulativesDelta = tickCumulatives[1] - tickCumulatives[0];
            int24 arithmeticMeanTick = int24(tickCumulativesDelta / int32(config.period));
            
            // Convertir tick a precio
            price = _tickToPrice(arithmeticMeanTick, tokenA, tokenB);
            confidence = 85; // TWAP tiene buena confianza
            
        } catch {
            revert("TWAP calculation failed");
        }
    }
    
    /**
     * @dev Obtener múltiples precios para comparación
     */
    function getMultiSourcePrices(
        address tokenA,
        address tokenB
    ) external view returns (
        uint256[] memory priceList,
        uint256[] memory confidences,
        string[] memory sources,
        uint256[] memory timestamps
    ) {
        PriceData[] memory allPrices = _getAllSourcePrices(tokenA, tokenB);
        
        uint256 validCount = 0;
        for (uint i = 0; i < allPrices.length; i++) {
            if (allPrices[i].isValid) validCount++;
        }
        
        priceList = new uint256[](validCount);
        confidences = new uint256[](validCount);
        sources = new string[](validCount);
        timestamps = new uint256[](validCount);
        
        uint256 index = 0;
        for (uint i = 0; i < allPrices.length; i++) {
            if (allPrices[i].isValid) {
                priceList[index] = allPrices[i].price;
                confidences[index] = allPrices[i].confidence;
                sources[index] = "source"; // Placeholder
                timestamps[index] = allPrices[i].timestamp;
                index++;
            }
        }
    }

    // ============================================================================
    // FUNCIONES DE CONFIGURACIÓN
    // ============================================================================
    
    /**
     * @dev Configurar oracle para un par de tokens
     */
    function configureOracle(
        address tokenA,
        address tokenB,
        address feedAddress,
        string memory source,
        uint256 weight,
        uint256 heartbeat
    ) external onlyOwner {
        require(tokenA != tokenB, "Same token");
        require(feedAddress != address(0), "Invalid feed address");
        require(weight <= 10000, "Invalid weight");
        
        oracles[tokenA][tokenB].push(OracleConfig({
            feedAddress: feedAddress,
            heartbeat: heartbeat,
            deviation: MAX_PRICE_DEVIATION,
            weight: weight,
            isActive: true,
            source: source
        }));
        
        emit OracleConfigured(tokenA, tokenB, feedAddress, source, weight);
    }
    
    /**
     * @dev Configurar TWAP para un par
     */
    function configureTWAP(
        address tokenA,
        address tokenB,
        address poolAddress,
        uint32 period
    ) external onlyOwner {
        require(poolAddress != address(0), "Invalid pool");
        require(period >= 60, "Period too short"); // Mínimo 1 minuto
        
        twapConfigs[tokenA][tokenB] = TWAPConfig({
            poolAddress: poolAddress,
            period: period,
            token0: tokenA,
            token1: tokenB,
            isActive: true
        });
    }
    
    /**
     * @dev Actualizar precio manualmente (para fuentes autorizadas)
     */
    function updatePrice(
        address tokenA,
        address tokenB,
        uint256 price,
        uint256 confidence,
        string memory source
    ) external {
        require(authorizedSources[msg.sender], "Not authorized");
        require(price > 0, "Invalid price");
        require(confidence <= 100, "Invalid confidence");
        
        prices[tokenA][tokenB] = PriceData({
            price: price,
            timestamp: block.timestamp,
            confidence: confidence,
            decimals: 18,
            isValid: true
        });
        
        emit PriceUpdated(tokenA, tokenB, price, confidence, source, block.timestamp);
    }

    // ============================================================================
    // FUNCIONES INTERNAS
    // ============================================================================
    
    function _getAllSourcePrices(
        address tokenA,
        address tokenB
    ) internal view returns (PriceData[] memory) {
        // Estimar número máximo de fuentes
        uint256 maxSources = oracles[tokenA][tokenB].length + 3; // +3 para chainlink, twap, manual
        PriceData[] memory sourcePrices = new PriceData[](maxSources);
        uint256 sourceCount = 0;
        
        // 1. Precio manual si existe
        if (prices[tokenA][tokenB].isValid && 
            block.timestamp - prices[tokenA][tokenB].timestamp <= STALENESS_THRESHOLD) {
            sourcePrices[sourceCount] = prices[tokenA][tokenB];
            sourceCount++;
        }
        
        // 2. Chainlink price
        try this.getChainlinkPrice(tokenA, tokenB) returns (uint256 chainlinkPrice, uint256 chainlinkConf) {
            sourcePrices[sourceCount] = PriceData({
                price: chainlinkPrice,
                timestamp: block.timestamp,
                confidence: chainlinkConf,
                decimals: 18,
                isValid: true
            });
            sourceCount++;
        } catch {
            // Chainlink no disponible
        }
        
        // 3. Uniswap TWAP
        if (twapConfigs[tokenA][tokenB].isActive) {
            try this.getUniswapTWAP(tokenA, tokenB) returns (uint256 twapPrice, uint256 twapConf) {
                sourcePrices[sourceCount] = PriceData({
                    price: twapPrice,
                    timestamp: block.timestamp,
                    confidence: twapConf,
                    decimals: 18,
                    isValid: true
                });
                sourceCount++;
            } catch {
                // TWAP no disponible
            }
        }
        
        // 4. Otros oracles configurados
        OracleConfig[] memory oracleConfigs = oracles[tokenA][tokenB];
        for (uint i = 0; i < oracleConfigs.length && sourceCount < maxSources; i++) {
            if (oracleConfigs[i].isActive) {
                try this._getExternalOraclePrice(oracleConfigs[i]) returns (uint256 extPrice, uint256 extConf) {
                    sourcePrices[sourceCount] = PriceData({
                        price: extPrice,
                        timestamp: block.timestamp,
                        confidence: extConf,
                        decimals: 18,
                        isValid: true
                    });
                    sourceCount++;
                } catch {
                    // Oracle externo falló
                }
            }
        }
        
        // Redimensionar array al tamaño real
        PriceData[] memory finalPrices = new PriceData[](sourceCount);
        for (uint i = 0; i < sourceCount; i++) {
            finalPrices[i] = sourcePrices[i];
        }
        
        return finalPrices;
    }
    
    function _filterValidPrices(PriceData[] memory sourcePrices) internal view returns (PriceData[] memory) {
        uint256 validCount = 0;
        
        // Contar precios válidos
        for (uint i = 0; i < sourcePrices.length; i++) {
            if (_isPriceValid(sourcePrices[i])) {
                validCount++;
            }
        }
        
        // Crear array de precios válidos
        PriceData[] memory validPrices = new PriceData[](validCount);
        uint256 index = 0;
        
        for (uint i = 0; i < sourcePrices.length; i++) {
            if (_isPriceValid(sourcePrices[i])) {
                validPrices[index] = sourcePrices[i];
                index++;
            }
        }
        
        return validPrices;
    }
    
    function _removeOutliers(PriceData[] memory validPrices) internal pure returns (PriceData[] memory) {
        if (validPrices.length <= 2) return validPrices;
        
        // Calcular mediana para detectar outliers
        uint256[] memory priceValues = new uint256[](validPrices.length);
        for (uint i = 0; i < validPrices.length; i++) {
            priceValues[i] = validPrices[i].price;
        }
        
        // Ordenar precios
        _quickSort(priceValues, 0, int(priceValues.length - 1));
        
        uint256 median = priceValues[priceValues.length / 2];
        uint256 maxDeviation = (median * MAX_PRICE_DEVIATION) / 10000; // 10%
        
        // Filtrar outliers
        uint256 cleanCount = 0;
        for (uint i = 0; i < validPrices.length; i++) {
            if (validPrices[i].price >= median - maxDeviation && 
                validPrices[i].price <= median + maxDeviation) {
                cleanCount++;
            }
        }
        
        PriceData[] memory cleanPrices = new PriceData[](cleanCount);
        uint256 index = 0;
        
        for (uint i = 0; i < validPrices.length; i++) {
            if (validPrices[i].price >= median - maxDeviation && 
                validPrices[i].price <= median + maxDeviation) {
                cleanPrices[index] = validPrices[i];
                index++;
            }
        }
        
        return cleanPrices;
    }
    
    function _aggregatePrices(PriceData[] memory cleanPrices) internal view returns (uint256 price, uint256 confidence) {
        require(cleanPrices.length > 0, "No clean prices");
        
        if (aggregationMethod == 0) {
            // Promedio simple
            uint256 sum = 0;
            uint256 confSum = 0;
            
            for (uint i = 0; i < cleanPrices.length; i++) {
                sum += cleanPrices[i].price;
                confSum += cleanPrices[i].confidence;
            }
            
            price = sum / cleanPrices.length;
            confidence = confSum / cleanPrices.length;
            
        } else if (aggregationMethod == 1) {
            // Mediana
            uint256[] memory priceValues = new uint256[](cleanPrices.length);
            uint256 confSum = 0;
            
            for (uint i = 0; i < cleanPrices.length; i++) {
                priceValues[i] = cleanPrices[i].price;
                confSum += cleanPrices[i].confidence;
            }
            
            _quickSort(priceValues, 0, int(priceValues.length - 1));
            price = priceValues[priceValues.length / 2];
            confidence = confSum / cleanPrices.length;
            
        } else {
            // Promedio ponderado por confianza
            uint256 weightedSum = 0;
            uint256 totalWeight = 0;
            uint256 confSum = 0;
            
            for (uint i = 0; i < cleanPrices.length; i++) {
                uint256 weight = cleanPrices[i].confidence;
                weightedSum += cleanPrices[i].price * weight;
                totalWeight += weight;
                confSum += cleanPrices[i].confidence;
            }
            
            price = weightedSum / totalWeight;
            confidence = confSum / cleanPrices.length;
        }
    }
    
    function _isPriceValid(PriceData memory priceData) internal view returns (bool) {
        return priceData.isValid &&
               priceData.price > 0 &&
               priceData.confidence >= MIN_CONFIDENCE_LEVEL &&
               block.timestamp - priceData.timestamp <= STALENESS_THRESHOLD;
    }
    
    function _tickToPrice(int24 tick, address tokenA, address tokenB) internal view returns (uint256) {
        // Implementación simplificada de conversión tick to price
        // En implementación real, usar TickMath library de Uniswap
        uint160 sqrtPriceX96 = uint160(uint256(int256(tick)) << 96);
        uint256 price = (uint256(sqrtPriceX96) * uint256(sqrtPriceX96)) >> 192;
        
        // Ajustar por decimales de tokens
        uint8 decimalsA = IERC20Extended(tokenA).decimals();
        uint8 decimalsB = IERC20Extended(tokenB).decimals();
        
        if (decimalsA != decimalsB) {
            if (decimalsA > decimalsB) {
                price = price / (10 ** (decimalsA - decimalsB));
            } else {
                price = price * (10 ** (decimalsB - decimalsA));
            }
        }
        
        return price;
    }
    
    function _getExternalOraclePrice(OracleConfig memory config) external view returns (uint256, uint256) {
        // Implementar lectura de oracle externo según el tipo
        // Placeholder implementation
        return (0, 0);
    }
    
    function _quickSort(uint256[] memory arr, int left, int right) internal pure {
        if (left < right) {
            int pi = _partition(arr, left, right);
            _quickSort(arr, left, pi - 1);
            _quickSort(arr, pi + 1, right);
        }
    }
    
    function _partition(uint256[] memory arr, int left, int right) internal pure returns (int) {
        uint256 pivot = arr[uint(right)];
        int i = left - 1;
        
        for (int j = left; j < right; j++) {
            if (arr[uint(j)] <= pivot) {
                i++;
                (arr[uint(i)], arr[uint(j)]) = (arr[uint(j)], arr[uint(i)]);
            }
        }
        
        (arr[uint(i + 1)], arr[uint(right)]) = (arr[uint(right)], arr[uint(i + 1)]);
        return i + 1;
    }
    
    function _setupChainlinkFeeds() internal {
        // Ethereum Mainnet
        chainlinkFeeds[1]["ETH/USD"] = 0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419;
        chainlinkFeeds[1]["BTC/USD"] = 0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c;
        chainlinkFeeds[1]["USDC/USD"] = 0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6;
        
        // Polygon
        chainlinkFeeds[137]["MATIC/USD"] = 0xAB594600376Ec9fD91F8e885dADF0CE036862dE0;
        chainlinkFeeds[137]["ETH/USD"] = 0xF9680D99D6C9589e2a93a78A04A279e509205945;
        
        // BSC
        chainlinkFeeds[56]["BNB/USD"] = 0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE;
        chainlinkFeeds[56]["ETH/USD"] = 0x9ef1B8c0E4F7dc8bF5719Ea496883DC6401d5b2e;
        
        // Arbitrum
        chainlinkFeeds[42161]["ETH/USD"] = 0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612;
        chainlinkFeeds[42161]["BTC/USD"] = 0x6ce185860a4963106506C203335A2910413708e9;
    }
    
    function _getPairKey(address tokenA, address tokenB) internal view returns (string memory) {
        // Simplificación - en implementación real hacer lookup más sofisticado
        if (tokenA == WETH) return "ETH/USD";
        return "TOKEN/USD";
    }

    // ============================================================================
    // FUNCIONES DE ADMINISTRACIÓN
    // ============================================================================
    
    function setAggregationMethod(uint256 method) external onlyOwner {
        require(method <= 2, "Invalid method");
        aggregationMethod = method;
    }
    
    function setMinSources(uint256 _minSources) external onlyOwner {
        require(_minSources >= 1 && _minSources <= 10, "Invalid min sources");
        minSources = _minSources;
    }
    
    function addAuthorizedSource(address source) external onlyOwner {
        authorizedSources[source] = true;
    }
    
    function removeAuthorizedSource(address source) external onlyOwner {
        authorizedSources[source] = false;
    }
    
    function emergencyPause() external onlyOwner {
        _pause();
    }
    
    function emergencyUnpause() external onlyOwner {
        _unpause();
    }
}
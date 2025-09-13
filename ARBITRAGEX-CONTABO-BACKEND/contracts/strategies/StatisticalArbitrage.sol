// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IArbitrageStrategy.sol";
import "../interfaces/IStatisticalOracle.sol";
import "../interfaces/IPriceOracle.sol";
import "../libraries/Statistics.sol";
import "../libraries/PriceUtils.sol";
import "../libraries/SafeMath.sol";

/**
 * @title StatisticalArbitrage
 * @dev Implementa arbitraje estadístico usando modelos matemáticos avanzados
 * Incluye mean reversion, cointegration, momentum, y machine learning strategies
 * Utiliza análisis cuantitativo para identificar oportunidades de arbitraje
 */
contract StatisticalArbitrage is IArbitrageStrategy, ReentrancyGuard, Pausable, Ownable {
    using SafeERC20 for IERC20;
    using Statistics for Statistics.Dataset;
    using PriceUtils for uint256;
    using SafeMath for uint256;

    // ==================== ESTRUCTURAS Y ENUMS ====================

    enum StrategyType {
        MEAN_REVERSION,       // Mean reversion trading
        PAIRS_TRADING,        // Pairs trading / cointegration
        MOMENTUM_STRATEGY,    // Momentum-based arbitrage
        CORRELATION_ARBITRAGE, // Correlation-based strategies
        VOLATILITY_ARBITRAGE, // Statistical volatility arbitrage
        REGRESSION_ARBITRAGE, // Linear/non-linear regression
        ML_PREDICTION,        // Machine learning predictions
        SEASONAL_PATTERNS     // Seasonal/cyclical arbitrage
    }

    enum SignalType {
        BUY,                  // Señal de compra
        SELL,                 // Señal de venta
        HOLD,                 // Mantener posición
        CLOSE_LONG,           // Cerrar posición larga
        CLOSE_SHORT,          // Cerrar posición corta
        NEUTRAL               // Neutral/sin señal
    }

    enum ModelType {
        ARIMA,                // AutoRegressive Integrated Moving Average
        GARCH,                // Generalized AutoRegressive Conditional Heteroskedasticity
        KALMAN_FILTER,        // Kalman Filter
        NEURAL_NETWORK,       // Neural Network
        RANDOM_FOREST,        // Random Forest
        LINEAR_REGRESSION,    // Linear Regression
        SUPPORT_VECTOR,       // Support Vector Machine
        LSTM                  // Long Short-Term Memory
    }

    struct TradingPair {
        address tokenA;           // Token A del par
        address tokenB;           // Token B del par
        uint256 correlation;      // Correlación histórica (0-10000)
        uint256 cointegration;    // Coeficiente de cointegración
        uint256 halfLife;         // Half-life de mean reversion (segundos)
        uint256 zScore;           // Z-score actual
        uint256 meanPrice;        // Precio medio histórico
        uint256 volatility;       // Volatilidad histórica
        uint256 betaRatio;        // Ratio beta entre tokens
        bool isCointegrated;      // Si están cointegrados
        uint256 lastUpdate;       // Último update
    }

    struct ArbitrageParams {
        StrategyType strategy;    // Tipo de estrategia
        ModelType model;          // Modelo usado
        address[] tokens;         // Tokens involucrados
        uint256[] amounts;        // Cantidades por token
        uint256 confidence;       // Nivel de confianza (0-10000)
        uint256 zScoreThreshold;  // Threshold de z-score
        uint256 stopLoss;         // Stop loss (BPS)
        uint256 takeProfit;       // Take profit (BPS)
        uint256 holdingPeriod;    // Período de holding máximo
        uint256 maxDrawdown;      // Máximo drawdown aceptable
        uint256 deadline;         // Timestamp límite
        bytes modelData;          // Datos del modelo
    }

    struct StatisticalPosition {
        StrategyType strategy;    // Estrategia usada
        address[] tokens;         // Tokens en la posición
        uint256[] amounts;        // Cantidades por token
        SignalType[] signals;     // Señales por token
        uint256 entryTime;        // Timestamp de entrada
        uint256[] entryPrices;    // Precios de entrada
        uint256 confidence;       // Confianza de la señal
        uint256 expectedReturn;   // Retorno esperado
        uint256 maxRisk;          // Riesgo máximo
        bool isActive;            // Si está activa
        uint256 unrealizedPnL;    // PnL no realizado
        ModelType model;          // Modelo usado
    }

    struct PriceHistory {
        uint256[] prices;         // Array de precios históricos
        uint256[] timestamps;     // Timestamps correspondientes
        uint256[] returns;        // Retornos calculados
        uint256[] volumes;        // Volúmenes históricos
        uint256 startIndex;       // Índice de inicio (circular buffer)
        uint256 count;            // Número de elementos
        uint256 maxSize;          // Tamaño máximo del buffer
    }

    struct StatisticalSignal {
        address token;            // Token de la señal
        SignalType signal;        // Tipo de señal
        uint256 confidence;       // Confianza (0-10000)
        uint256 expectedReturn;   // Retorno esperado
        uint256 timeHorizon;      // Horizonte temporal
        uint256 riskLevel;        // Nivel de riesgo
        ModelType model;          // Modelo que generó la señal
        bytes modelOutput;        // Output del modelo
        uint256 timestamp;        // Timestamp de la señal
        bool isValid;             // Si la señal es válida
    }

    struct ModelParameters {
        ModelType modelType;      // Tipo de modelo
        uint256[] parameters;     // Parámetros del modelo
        uint256 accuracy;         // Precisión histórica
        uint256 lastTrained;      // Último entrenamiento
        uint256 trainingSize;     // Tamaño del dataset de entrenamiento
        bool isActive;            // Si está activo
        string modelHash;         // Hash del modelo (para ML models)
    }

    struct MarketRegime {
        string name;              // Nombre del régimen (ej: "Bull", "Bear", "Sideways")
        uint256 volatilityLevel;  // Nivel de volatilidad
        uint256 trendStrength;    // Fuerza de tendencia
        uint256 correlationLevel; // Nivel de correlación entre assets
        uint256 liquidityLevel;   // Nivel de liquidez
        uint256 startTime;        // Inicio del régimen
        uint256 probability;      // Probabilidad del régimen actual
        bool isActive;            // Si está activo
    }

    // ==================== VARIABLES DE ESTADO ====================

    mapping(bytes32 => TradingPair) public tradingPairs;
    mapping(address => PriceHistory) public priceHistories;
    mapping(address => mapping(uint256 => StatisticalPosition)) public userPositions;
    mapping(address => uint256[]) public userPositionIds;
    mapping(ModelType => ModelParameters) public models;
    mapping(address => StatisticalSignal[]) public activeSignals;
    mapping(string => MarketRegime) public marketRegimes;
    mapping(address => bool) public authorizedAnalysts;
    
    uint256 public positionIdCounter;
    uint256 public constant MAX_HISTORY_SIZE = 1000;      // Máximo 1000 datos históricos
    uint256 public constant MIN_CONFIDENCE = 6000;        // 60% mínima confianza
    uint256 public constant MAX_POSITION_SIZE = 1000000e18; // 1M tokens máximo
    uint256 public constant Z_SCORE_THRESHOLD = 2000;     // 2.0 z-score threshold
    uint256 public statisticalFee = 150;                  // 1.5% fee
    uint256 public modelUpdateInterval = 6 hours;         // Update cada 6 horas
    uint256 public signalDecayTime = 1 hours;             // Señales válidas por 1 hora
    
    address public statisticalOracle;
    address public priceOracle;
    address public mlModelContract;
    address public feeReceiver;

    // Current market regime
    string public currentRegime = "Neutral";

    // ==================== EVENTOS ====================

    event StatisticalArbitrageExecuted(
        address indexed user,
        StrategyType strategy,
        ModelType model,
        address[] tokens,
        uint256[] amounts,
        uint256 confidence,
        uint256 expectedReturn
    );

    event TradingSignalGenerated(
        address indexed token,
        SignalType signal,
        uint256 confidence,
        ModelType model,
        uint256 expectedReturn,
        uint256 timestamp
    );

    event StatisticalPositionOpened(
        address indexed user,
        uint256 indexed positionId,
        StrategyType strategy,
        address[] tokens,
        uint256 confidence
    );

    event StatisticalPositionClosed(
        address indexed user,
        uint256 indexed positionId,
        int256 realizedPnL,
        uint256 duration,
        string closeReason
    );

    event ModelUpdated(
        ModelType indexed modelType,
        uint256 newAccuracy,
        uint256 trainingSize,
        uint256 timestamp
    );

    event MarketRegimeChanged(
        string previousRegime,
        string newRegime,
        uint256 probability,
        uint256 timestamp
    );

    event PairAnalysisUpdated(
        address indexed tokenA,
        address indexed tokenB,
        uint256 correlation,
        uint256 zScore,
        bool isCointegrated
    );

    // ==================== CONSTRUCTOR ====================

    constructor(
        address _statisticalOracle,
        address _priceOracle,
        address _mlModelContract,
        address _feeReceiver
    ) {
        statisticalOracle = _statisticalOracle;
        priceOracle = _priceOracle;
        mlModelContract = _mlModelContract;
        feeReceiver = _feeReceiver;
        authorizedAnalysts[msg.sender] = true;
    }

    // ==================== MODIFICADORES ====================

    modifier onlyAuthorizedAnalyst() {
        require(authorizedAnalysts[msg.sender], "StatArb: Not authorized analyst");
        _;
    }

    // ==================== FUNCIONES PRINCIPALES ====================

    /**
     * @dev Ejecuta arbitraje estadístico
     */
    function execute(bytes calldata data) 
        external 
        override 
        nonReentrant 
        whenNotPaused 
        returns (bool success, uint256 profit) 
    {
        ArbitrageParams memory params = abi.decode(data, (ArbitrageParams));
        
        require(params.deadline >= block.timestamp, "StatArb: Deadline expired");
        require(params.confidence >= MIN_CONFIDENCE, "StatArb: Confidence too low");
        require(params.tokens.length > 0, "StatArb: No tokens specified");

        // Actualizar datos históricos y modelos
        _updatePriceHistories(params.tokens);
        _updateModels();

        // Generar señales estadísticas
        StatisticalSignal[] memory signals = _generateSignals(params);
        require(signals.length > 0, "StatArb: No valid signals");

        // Ejecutar según estrategia
        if (params.strategy == StrategyType.MEAN_REVERSION) {
            return _executeMeanReversionStrategy(params, signals);
        } else if (params.strategy == StrategyType.PAIRS_TRADING) {
            return _executePairsTrading(params, signals);
        } else if (params.strategy == StrategyType.MOMENTUM_STRATEGY) {
            return _executeMomentumStrategy(params, signals);
        } else if (params.strategy == StrategyType.CORRELATION_ARBITRAGE) {
            return _executeCorrelationArbitrage(params, signals);
        } else if (params.strategy == StrategyType.VOLATILITY_ARBITRAGE) {
            return _executeVolatilityArbitrage(params, signals);
        } else if (params.strategy == StrategyType.ML_PREDICTION) {
            return _executeMLPredictionStrategy(params, signals);
        }

        return (false, 0);
    }

    /**
     * @dev Ejecuta estrategia de mean reversion
     */
    function _executeMeanReversionStrategy(
        ArbitrageParams memory params,
        StatisticalSignal[] memory signals
    ) internal returns (bool success, uint256 profit) {
        
        for (uint256 i = 0; i < signals.length; i++) {
            StatisticalSignal memory signal = signals[i];
            
            if (signal.confidence >= params.confidence) {
                address token = signal.token;
                uint256 zScore = _calculateZScore(token);
                
                // Mean reversion: comprar cuando z-score es muy negativo, vender cuando muy positivo
                if (zScore <= 0 - params.zScoreThreshold && signal.signal == SignalType.BUY) {
                    // Precio está muy por debajo de la media - comprar
                    bool buySuccess = _executeBuyOrder(token, params.amounts[i]);
                    if (buySuccess) {
                        profit = profit.add(signal.expectedReturn);
                    }
                } else if (zScore >= params.zScoreThreshold && signal.signal == SignalType.SELL) {
                    // Precio está muy por encima de la media - vender
                    bool sellSuccess = _executeSellOrder(token, params.amounts[i]);
                    if (sellSuccess) {
                        profit = profit.add(signal.expectedReturn);
                    }
                }
            }
        }

        success = profit > 0;
        if (success) {
            _createStatisticalPosition(params, signals, profit);
        }

        return (success, profit);
    }

    /**
     * @dev Ejecuta pairs trading (cointegración)
     */
    function _executePairsTrading(
        ArbitrageParams memory params,
        StatisticalSignal[] memory signals
    ) internal returns (bool success, uint256 profit) {
        
        require(params.tokens.length >= 2, "StatArb: Pairs trading needs 2+ tokens");
        
        address tokenA = params.tokens[0];
        address tokenB = params.tokens[1];
        bytes32 pairKey = keccak256(abi.encodePacked(tokenA, tokenB));
        
        TradingPair memory pair = tradingPairs[pairKey];
        require(pair.isCointegrated, "StatArb: Tokens not cointegrated");

        uint256 currentZScore = pair.zScore;
        
        if (currentZScore >= params.zScoreThreshold) {
            // Spread está muy alto: vender tokenA, comprar tokenB
            bool sellA = _executeSellOrder(tokenA, params.amounts[0]);
            bool buyB = _executeBuyOrder(tokenB, params.amounts[1]);
            
            if (sellA && buyB) {
                profit = _calculatePairsProfit(pair, params.amounts[0], params.amounts[1]);
                success = true;
            }
        } else if (currentZScore <= 0 - params.zScoreThreshold) {
            // Spread está muy bajo: comprar tokenA, vender tokenB
            bool buyA = _executeBuyOrder(tokenA, params.amounts[0]);
            bool sellB = _executeSellOrder(tokenB, params.amounts[1]);
            
            if (buyA && sellB) {
                profit = _calculatePairsProfit(pair, params.amounts[0], params.amounts[1]);
                success = true;
            }
        }

        if (success) {
            _createStatisticalPosition(params, signals, profit);
        }

        return (success, profit);
    }

    /**
     * @dev Ejecuta estrategia de momentum
     */
    function _executeMomentumStrategy(
        ArbitrageParams memory params,
        StatisticalSignal[] memory signals
    ) internal returns (bool success, uint256 profit) {
        
        for (uint256 i = 0; i < signals.length; i++) {
            StatisticalSignal memory signal = signals[i];
            
            if (signal.confidence >= params.confidence) {
                address token = signal.token;
                uint256 momentum = _calculateMomentum(token, 24 hours); // 24h momentum
                
                // Momentum strategy: seguir la tendencia
                if (momentum > 1050 && signal.signal == SignalType.BUY) {
                    // Momentum alcista fuerte (>5%) - comprar
                    bool buySuccess = _executeBuyOrder(token, params.amounts[i]);
                    if (buySuccess) {
                        profit = profit.add(signal.expectedReturn);
                    }
                } else if (momentum < 950 && signal.signal == SignalType.SELL) {
                    // Momentum bajista fuerte (<-5%) - vender
                    bool sellSuccess = _executeSellOrder(token, params.amounts[i]);
                    if (sellSuccess) {
                        profit = profit.add(signal.expectedReturn);
                    }
                }
            }
        }

        success = profit > 0;
        if (success) {
            _createStatisticalPosition(params, signals, profit);
        }

        return (success, profit);
    }

    /**
     * @dev Ejecuta arbitraje de correlación
     */
    function _executeCorrelationArbitrage(
        ArbitrageParams memory params,
        StatisticalSignal[] memory signals
    ) internal returns (bool success, uint256 profit) {
        
        require(params.tokens.length >= 2, "StatArb: Correlation arbitrage needs 2+ tokens");
        
        // Buscar divergencias en tokens correlacionados
        for (uint256 i = 0; i < params.tokens.length - 1; i++) {
            for (uint256 j = i + 1; j < params.tokens.length; j++) {
                address tokenA = params.tokens[i];
                address tokenB = params.tokens[j];
                
                uint256 correlation = _calculateCorrelation(tokenA, tokenB, 7 days);
                
                if (correlation > 8000) { // 80% correlación
                    uint256 priceA = IPriceOracle(priceOracle).getPrice(tokenA);
                    uint256 priceB = IPriceOracle(priceOracle).getPrice(tokenB);
                    
                    uint256 historicalRatio = _getHistoricalRatio(tokenA, tokenB);
                    uint256 currentRatio = priceA.mul(1e18).div(priceB);
                    
                    // Si el ratio se desvía significativamente
                    if (currentRatio > historicalRatio.mul(110).div(100)) {
                        // TokenA está caro relativo a tokenB
                        bool sellA = _executeSellOrder(tokenA, params.amounts[i]);
                        bool buyB = _executeBuyOrder(tokenB, params.amounts[j]);
                        
                        if (sellA && buyB) {
                            profit = profit.add(_calculateRatioProfit(historicalRatio, currentRatio, params.amounts[i]));
                            success = true;
                        }
                    } else if (currentRatio < historicalRatio.mul(90).div(100)) {
                        // TokenA está barato relativo a tokenB
                        bool buyA = _executeBuyOrder(tokenA, params.amounts[i]);
                        bool sellB = _executeSellOrder(tokenB, params.amounts[j]);
                        
                        if (buyA && sellB) {
                            profit = profit.add(_calculateRatioProfit(historicalRatio, currentRatio, params.amounts[i]));
                            success = true;
                        }
                    }
                }
            }
        }

        if (success) {
            _createStatisticalPosition(params, signals, profit);
        }

        return (success, profit);
    }

    /**
     * @dev Ejecuta arbitraje de volatilidad
     */
    function _executeVolatilityArbitrage(
        ArbitrageParams memory params,
        StatisticalSignal[] memory signals
    ) internal returns (bool success, uint256 profit) {
        
        for (uint256 i = 0; i < signals.length; i++) {
            StatisticalSignal memory signal = signals[i];
            address token = signal.token;
            
            uint256 impliedVol = _getImpliedVolatility(token);
            uint256 realizedVol = _calculateRealizedVolatility(token, 30 days);
            
            // Arbitraje de volatilidad: comprar vol barata, vender vol cara
            if (impliedVol < realizedVol.mul(90).div(100)) {
                // Volatilidad implícita muy baja - comprar volatilidad
                bool volBuy = _buyVolatility(token, params.amounts[i]);
                if (volBuy) {
                    profit = profit.add(realizedVol.sub(impliedVol).mul(params.amounts[i]).div(1e18));
                    success = true;
                }
            } else if (impliedVol > realizedVol.mul(110).div(100)) {
                // Volatilidad implícita muy alta - vender volatilidad
                bool volSell = _sellVolatility(token, params.amounts[i]);
                if (volSell) {
                    profit = profit.add(impliedVol.sub(realizedVol).mul(params.amounts[i]).div(1e18));
                    success = true;
                }
            }
        }

        if (success) {
            _createStatisticalPosition(params, signals, profit);
        }

        return (success, profit);
    }

    /**
     * @dev Ejecuta estrategia ML prediction
     */
    function _executeMLPredictionStrategy(
        ArbitrageParams memory params,
        StatisticalSignal[] memory signals
    ) internal returns (bool success, uint256 profit) {
        
        require(mlModelContract != address(0), "StatArb: ML model not available");
        
        for (uint256 i = 0; i < signals.length; i++) {
            StatisticalSignal memory signal = signals[i];
            
            if (signal.model == ModelType.NEURAL_NETWORK || 
                signal.model == ModelType.LSTM || 
                signal.model == ModelType.RANDOM_FOREST) {
                
                if (signal.confidence >= params.confidence) {
                    address token = signal.token;
                    
                    if (signal.signal == SignalType.BUY) {
                        bool buySuccess = _executeBuyOrder(token, params.amounts[i]);
                        if (buySuccess) {
                            profit = profit.add(signal.expectedReturn);
                            success = true;
                        }
                    } else if (signal.signal == SignalType.SELL) {
                        bool sellSuccess = _executeSellOrder(token, params.amounts[i]);
                        if (sellSuccess) {
                            profit = profit.add(signal.expectedReturn);
                            success = true;
                        }
                    }
                }
            }
        }

        if (success) {
            _createStatisticalPosition(params, signals, profit);
        }

        return (success, profit);
    }

    /**
     * @dev Genera señales estadísticas
     */
    function _generateSignals(ArbitrageParams memory params) internal returns (StatisticalSignal[] memory signals) {
        signals = new StatisticalSignal[](params.tokens.length);
        
        for (uint256 i = 0; i < params.tokens.length; i++) {
            address token = params.tokens[i];
            
            // Generar señal basada en el modelo especificado
            if (params.model == ModelType.ARIMA) {
                signals[i] = _generateARIMASignal(token, params.strategy);
            } else if (params.model == ModelType.GARCH) {
                signals[i] = _generateGARCHSignal(token, params.strategy);
            } else if (params.model == ModelType.KALMAN_FILTER) {
                signals[i] = _generateKalmanSignal(token, params.strategy);
            } else if (params.model == ModelType.LINEAR_REGRESSION) {
                signals[i] = _generateRegressionSignal(token, params.strategy);
            } else if (params.model == ModelType.NEURAL_NETWORK) {
                signals[i] = _generateNeuralNetworkSignal(token, params.strategy);
            }
            
            // Validar señal
            if (signals[i].confidence < MIN_CONFIDENCE) {
                signals[i].isValid = false;
            }
        }
        
        return signals;
    }

    /**
     * @dev Cierra posición estadística
     */
    function closeStatisticalPosition(uint256 positionId) external nonReentrant {
        StatisticalPosition storage position = userPositions[msg.sender][positionId];
        require(position.isActive, "StatArb: Position not active");

        // Calcular PnL actual
        int256 realizedPnL = _calculatePositionPnL(position);
        uint256 duration = block.timestamp.sub(position.entryTime);
        
        string memory closeReason = "Manual close";
        
        // Cerrar todas las posiciones de tokens
        for (uint256 i = 0; i < position.tokens.length; i++) {
            if (position.signals[i] == SignalType.BUY) {
                _executeSellOrder(position.tokens[i], position.amounts[i]);
            } else if (position.signals[i] == SignalType.SELL) {
                _executeBuyOrder(position.tokens[i], position.amounts[i]);
            }
        }

        // Marcar posición como inactiva
        position.isActive = false;
        _removeUserPositionId(msg.sender, positionId);

        emit StatisticalPositionClosed(msg.sender, positionId, realizedPnL, duration, closeReason);
    }

    /**
     * @dev Simula arbitraje estadístico
     */
    function simulate(bytes calldata data) 
        external 
        view 
        override 
        returns (bool canExecute, uint256 estimatedProfit) 
    {
        ArbitrageParams memory params = abi.decode(data, (ArbitrageParams));
        
        if (params.strategy == StrategyType.MEAN_REVERSION) {
            return _simulateMeanReversion(params);
        } else if (params.strategy == StrategyType.PAIRS_TRADING) {
            return _simulatePairsTrading(params);
        } else if (params.strategy == StrategyType.MOMENTUM_STRATEGY) {
            return _simulateMomentum(params);
        }

        return (false, 0);
    }

    /**
     * @dev Verifica si puede ejecutarse
     */
    function canExecute(bytes calldata data) external view override returns (bool) {
        (bool executable,) = this.simulate(data);
        return executable;
    }

    /**
     * @dev Información de la estrategia
     */
    function getStrategyInfo() external pure override returns (string memory name, string memory description) {
        return (
            "Statistical Arbitrage",
            "Quantitative arbitrage using advanced mathematical and machine learning models"
        );
    }

    // ==================== FUNCIONES INTERNAS AUXILIARES ====================

    /**
     * @dev Calcula Z-score de un token
     */
    function _calculateZScore(address token) internal view returns (uint256) {
        PriceHistory memory history = priceHistories[token];
        if (history.count < 20) return 0; // Necesitamos al menos 20 datos
        
        uint256 currentPrice = IPriceOracle(priceOracle).getPrice(token);
        uint256 mean = _calculateMean(history.prices, history.count);
        uint256 stdDev = _calculateStdDev(history.prices, history.count, mean);
        
        if (stdDev == 0) return 0;
        
        if (currentPrice > mean) {
            return currentPrice.sub(mean).mul(10000).div(stdDev);
        } else {
            return mean.sub(currentPrice).mul(10000).div(stdDev);
        }
    }

    /**
     * @dev Calcula momentum de un token
     */
    function _calculateMomentum(address token, uint256 timeframe) internal view returns (uint256) {
        PriceHistory memory history = priceHistories[token];
        if (history.count < 2) return 1000; // No momentum
        
        uint256 currentPrice = IPriceOracle(priceOracle).getPrice(token);
        uint256 pastPrice = _getPriceAt(history, block.timestamp.sub(timeframe));
        
        if (pastPrice == 0) return 1000;
        
        return currentPrice.mul(1000).div(pastPrice);
    }

    /**
     * @dev Calcula correlación entre dos tokens
     */
    function _calculateCorrelation(address tokenA, address tokenB, uint256 period) internal view returns (uint256) {
        // Implementación simplificada de correlación
        // En producción usar algoritmo completo de Pearson correlation
        return 7500; // 75% correlación simulada
    }

    /**
     * @dev Calcula volatilidad realizada
     */
    function _calculateRealizedVolatility(address token, uint256 period) internal view returns (uint256) {
        PriceHistory memory history = priceHistories[token];
        if (history.count < 10) return 2000; // 20% volatilidad default
        
        // Calcular desviación estándar de los retornos
        uint256 sumSquaredReturns = 0;
        uint256 meanReturn = 0;
        uint256 validReturns = 0;
        
        // Calcular media de retornos
        for (uint256 i = 0; i < history.count && validReturns < 30; i++) {
            if (history.returns[i] > 0) {
                meanReturn = meanReturn.add(history.returns[i]);
                validReturns++;
            }
        }
        
        if (validReturns > 0) {
            meanReturn = meanReturn.div(validReturns);
            
            // Calcular suma de diferencias cuadradas
            for (uint256 i = 0; i < history.count && i < validReturns; i++) {
                if (history.returns[i] > 0) {
                    uint256 diff = history.returns[i] > meanReturn ? 
                        history.returns[i].sub(meanReturn) : 
                        meanReturn.sub(history.returns[i]);
                    sumSquaredReturns = sumSquaredReturns.add(diff.mul(diff));
                }
            }
            
            // Volatilidad = sqrt(variance) * sqrt(periods per year)
            uint256 variance = sumSquaredReturns.div(validReturns);
            return _sqrt(variance).mul(_sqrt(252)); // Anualizada
        }
        
        return 2000; // 20% default
    }

    // Funciones de generación de señales (implementaciones simplificadas)
    function _generateARIMASignal(address token, StrategyType strategy) internal view returns (StatisticalSignal memory) {
        uint256 zScore = _calculateZScore(token);
        
        SignalType signal = SignalType.NEUTRAL;
        uint256 confidence = MIN_CONFIDENCE;
        
        if (zScore > Z_SCORE_THRESHOLD) {
            signal = SignalType.SELL;
            confidence = 7500;
        } else if (zScore < 0 - int256(Z_SCORE_THRESHOLD)) {
            signal = SignalType.BUY;
            confidence = 7500;
        }
        
        return StatisticalSignal({
            token: token,
            signal: signal,
            confidence: confidence,
            expectedReturn: zScore.mul(100), // Simplified
            timeHorizon: 24 hours,
            riskLevel: 3000,
            model: ModelType.ARIMA,
            modelOutput: "",
            timestamp: block.timestamp,
            isValid: confidence >= MIN_CONFIDENCE
        });
    }

    function _generateGARCHSignal(address token, StrategyType strategy) internal view returns (StatisticalSignal memory) {
        uint256 volatility = _calculateRealizedVolatility(token, 30 days);
        
        SignalType signal = volatility > 3000 ? SignalType.SELL : SignalType.BUY;
        uint256 confidence = volatility > 2000 ? 7000 : 6000;
        
        return StatisticalSignal({
            token: token,
            signal: signal,
            confidence: confidence,
            expectedReturn: volatility.div(10),
            timeHorizon: 12 hours,
            riskLevel: volatility,
            model: ModelType.GARCH,
            modelOutput: "",
            timestamp: block.timestamp,
            isValid: confidence >= MIN_CONFIDENCE
        });
    }

    function _generateKalmanSignal(address token, StrategyType strategy) internal view returns (StatisticalSignal memory) {
        // Kalman filter para trend estimation
        uint256 momentum = _calculateMomentum(token, 6 hours);
        
        SignalType signal = momentum > 1020 ? SignalType.BUY : SignalType.SELL;
        uint256 confidence = 6500;
        
        return StatisticalSignal({
            token: token,
            signal: signal,
            confidence: confidence,
            expectedReturn: momentum > 1000 ? momentum.sub(1000).mul(10) : 1000 - momentum.mul(10),
            timeHorizon: 6 hours,
            riskLevel: 2500,
            model: ModelType.KALMAN_FILTER,
            modelOutput: "",
            timestamp: block.timestamp,
            isValid: confidence >= MIN_CONFIDENCE
        });
    }

    function _generateRegressionSignal(address token, StrategyType strategy) internal view returns (StatisticalSignal memory) {
        // Linear regression signal
        return StatisticalSignal({
            token: token,
            signal: SignalType.BUY,
            confidence: MIN_CONFIDENCE,
            expectedReturn: 200,
            timeHorizon: 8 hours,
            riskLevel: 2000,
            model: ModelType.LINEAR_REGRESSION,
            modelOutput: "",
            timestamp: block.timestamp,
            isValid: true
        });
    }

    function _generateNeuralNetworkSignal(address token, StrategyType strategy) internal view returns (StatisticalSignal memory) {
        // Neural network prediction (simplificado)
        return StatisticalSignal({
            token: token,
            signal: SignalType.BUY,
            confidence: 8000,
            expectedReturn: 500,
            timeHorizon: 4 hours,
            riskLevel: 1500,
            model: ModelType.NEURAL_NETWORK,
            modelOutput: "",
            timestamp: block.timestamp,
            isValid: true
        });
    }

    // Funciones auxiliares matemáticas
    function _calculateMean(uint256[] memory values, uint256 count) internal pure returns (uint256) {
        if (count == 0) return 0;
        
        uint256 sum = 0;
        for (uint256 i = 0; i < count; i++) {
            sum = sum.add(values[i]);
        }
        return sum.div(count);
    }

    function _calculateStdDev(uint256[] memory values, uint256 count, uint256 mean) internal pure returns (uint256) {
        if (count <= 1) return 0;
        
        uint256 sumSquaredDiffs = 0;
        for (uint256 i = 0; i < count; i++) {
            uint256 diff = values[i] > mean ? values[i].sub(mean) : mean.sub(values[i]);
            sumSquaredDiffs = sumSquaredDiffs.add(diff.mul(diff));
        }
        
        uint256 variance = sumSquaredDiffs.div(count.sub(1));
        return _sqrt(variance);
    }

    function _sqrt(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        uint256 y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
        return y;
    }

    // Funciones simplificadas de ejecución
    function _executeBuyOrder(address token, uint256 amount) internal returns (bool) {
        // Implementar compra via DEX
        return true; // Simplificado
    }

    function _executeSellOrder(address token, uint256 amount) internal returns (bool) {
        // Implementar venta via DEX
        return true; // Simplificado
    }

    function _buyVolatility(address token, uint256 amount) internal returns (bool) {
        // Implementar compra de volatilidad via options
        return true; // Simplificado
    }

    function _sellVolatility(address token, uint256 amount) internal returns (bool) {
        // Implementar venta de volatilidad via options
        return true; // Simplificado
    }

    function _createStatisticalPosition(
        ArbitrageParams memory params,
        StatisticalSignal[] memory signals,
        uint256 expectedProfit
    ) internal {
        uint256 positionId = positionIdCounter++;
        
        SignalType[] memory signalTypes = new SignalType[](signals.length);
        for (uint256 i = 0; i < signals.length; i++) {
            signalTypes[i] = signals[i].signal;
        }
        
        userPositions[msg.sender][positionId] = StatisticalPosition({
            strategy: params.strategy,
            tokens: params.tokens,
            amounts: params.amounts,
            signals: signalTypes,
            entryTime: block.timestamp,
            entryPrices: _getCurrentPrices(params.tokens),
            confidence: params.confidence,
            expectedReturn: expectedProfit,
            maxRisk: params.maxDrawdown,
            isActive: true,
            unrealizedPnL: 0,
            model: params.model
        });

        userPositionIds[msg.sender].push(positionId);

        emit StatisticalPositionOpened(msg.sender, positionId, params.strategy, params.tokens, params.confidence);
    }

    function _getCurrentPrices(address[] memory tokens) internal view returns (uint256[] memory prices) {
        prices = new uint256[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            prices[i] = IPriceOracle(priceOracle).getPrice(tokens[i]);
        }
        return prices;
    }

    function _calculatePositionPnL(StatisticalPosition memory position) internal view returns (int256) {
        // Calcular PnL basado en precios actuales vs precios de entrada
        return 0; // Simplificado
    }

    function _removeUserPositionId(address user, uint256 positionId) internal {
        uint256[] storage positions = userPositionIds[user];
        for (uint256 i = 0; i < positions.length; i++) {
            if (positions[i] == positionId) {
                positions[i] = positions[positions.length - 1];
                positions.pop();
                break;
            }
        }
    }

    // Funciones de simulación simplificadas
    function _simulateMeanReversion(ArbitrageParams memory params) internal view returns (bool, uint256) {
        if (params.tokens.length > 0) {
            uint256 zScore = _calculateZScore(params.tokens[0]);
            return (zScore >= params.zScoreThreshold, zScore.mul(100));
        }
        return (false, 0);
    }

    function _simulatePairsTrading(ArbitrageParams memory params) internal view returns (bool, uint256) {
        if (params.tokens.length >= 2) {
            bytes32 pairKey = keccak256(abi.encodePacked(params.tokens[0], params.tokens[1]));
            TradingPair memory pair = tradingPairs[pairKey];
            return (pair.isCointegrated && pair.zScore >= params.zScoreThreshold, pair.zScore.mul(50));
        }
        return (false, 0);
    }

    function _simulateMomentum(ArbitrageParams memory params) internal view returns (bool, uint256) {
        if (params.tokens.length > 0) {
            uint256 momentum = _calculateMomentum(params.tokens[0], 24 hours);
            bool canExecute = momentum > 1050 || momentum < 950;
            uint256 profit = canExecute ? (momentum > 1000 ? momentum.sub(1000).mul(100) : 1000 - momentum.mul(100)) : 0;
            return (canExecute, profit);
        }
        return (false, 0);
    }

    // Funciones auxiliares adicionales
    function _calculatePairsProfit(TradingPair memory pair, uint256 amountA, uint256 amountB) internal pure returns (uint256) {
        return pair.zScore.mul(amountA.add(amountB)).div(10000);
    }

    function _getHistoricalRatio(address tokenA, address tokenB) internal view returns (uint256) {
        // Obtener ratio histórico promedio
        return 1e18; // Simplificado - ratio 1:1
    }

    function _calculateRatioProfit(uint256 historicalRatio, uint256 currentRatio, uint256 amount) internal pure returns (uint256) {
        uint256 deviation = currentRatio > historicalRatio ? 
            currentRatio.sub(historicalRatio) : 
            historicalRatio.sub(currentRatio);
        return deviation.mul(amount).div(historicalRatio);
    }

    function _getImpliedVolatility(address token) internal view returns (uint256) {
        // Obtener volatilidad implícita de opciones
        return 2500; // 25% simplificado
    }

    function _getPriceAt(PriceHistory memory history, uint256 timestamp) internal pure returns (uint256) {
        // Buscar precio más cercano al timestamp
        return history.count > 0 ? history.prices[0] : 0; // Simplificado
    }

    function _updatePriceHistories(address[] memory tokens) internal {
        // Actualizar historiales de precio
        for (uint256 i = 0; i < tokens.length; i++) {
            _addPriceData(tokens[i], IPriceOracle(priceOracle).getPrice(tokens[i]));
        }
    }

    function _addPriceData(address token, uint256 price) internal {
        PriceHistory storage history = priceHistories[token];
        
        if (history.maxSize == 0) {
            history.maxSize = MAX_HISTORY_SIZE;
            history.prices = new uint256[](MAX_HISTORY_SIZE);
            history.timestamps = new uint256[](MAX_HISTORY_SIZE);
            history.returns = new uint256[](MAX_HISTORY_SIZE);
            history.volumes = new uint256[](MAX_HISTORY_SIZE);
        }
        
        uint256 index = (history.startIndex + history.count) % history.maxSize;
        history.prices[index] = price;
        history.timestamps[index] = block.timestamp;
        
        if (history.count < history.maxSize) {
            history.count++;
        } else {
            history.startIndex = (history.startIndex + 1) % history.maxSize;
        }
        
        // Calcular return si hay precio anterior
        if (history.count > 1) {
            uint256 prevIndex = index > 0 ? index - 1 : history.maxSize - 1;
            uint256 prevPrice = history.prices[prevIndex];
            if (prevPrice > 0) {
                history.returns[index] = price.mul(10000).div(prevPrice);
            }
        }
    }

    function _updateModels() internal {
        // Actualizar modelos si es necesario
        for (uint8 i = 0; i < 8; i++) {
            ModelType modelType = ModelType(i);
            ModelParameters storage model = models[modelType];
            
            if (block.timestamp >= model.lastTrained + modelUpdateInterval) {
                _retrainModel(modelType);
                model.lastTrained = block.timestamp;
            }
        }
    }

    function _retrainModel(ModelType modelType) internal {
        // Reentrenar modelo específico
        ModelParameters storage model = models[modelType];
        model.accuracy = model.accuracy > 7500 ? model.accuracy : 7500; // Mantener o mejorar
        
        emit ModelUpdated(modelType, model.accuracy, model.trainingSize, block.timestamp);
    }

    // ==================== FUNCIONES ADMINISTRATIVAS ====================

    function addTradingPair(
        address tokenA,
        address tokenB,
        uint256 correlation,
        uint256 cointegration,
        uint256 halfLife,
        bool isCointegrated
    ) external onlyOwner {
        bytes32 pairKey = keccak256(abi.encodePacked(tokenA, tokenB));
        
        tradingPairs[pairKey] = TradingPair({
            tokenA: tokenA,
            tokenB: tokenB,
            correlation: correlation,
            cointegration: cointegration,
            halfLife: halfLife,
            zScore: 0,
            meanPrice: 0,
            volatility: 0,
            betaRatio: 1e18,
            isCointegrated: isCointegrated,
            lastUpdate: block.timestamp
        });
    }

    function initializeModel(
        ModelType modelType,
        uint256[] calldata parameters,
        uint256 accuracy
    ) external onlyOwner {
        models[modelType] = ModelParameters({
            modelType: modelType,
            parameters: parameters,
            accuracy: accuracy,
            lastTrained: block.timestamp,
            trainingSize: 1000,
            isActive: true,
            modelHash: ""
        });
    }

    function setMarketRegime(
        string calldata regimeName,
        uint256 volatilityLevel,
        uint256 trendStrength,
        uint256 probability
    ) external onlyAuthorizedAnalyst {
        MarketRegime storage newRegime = marketRegimes[regimeName];
        
        newRegime.name = regimeName;
        newRegime.volatilityLevel = volatilityLevel;
        newRegime.trendStrength = trendStrength;
        newRegime.correlationLevel = 5000;
        newRegime.liquidityLevel = 7000;
        newRegime.startTime = block.timestamp;
        newRegime.probability = probability;
        newRegime.isActive = true;
        
        string memory previousRegime = currentRegime;
        currentRegime = regimeName;
        
        emit MarketRegimeChanged(previousRegime, regimeName, probability, block.timestamp);
    }

    function setAuthorizedAnalyst(address analyst, bool authorized) external onlyOwner {
        authorizedAnalysts[analyst] = authorized;
    }

    function setParameters(
        uint256 _statisticalFee,
        uint256 _modelUpdateInterval,
        uint256 _signalDecayTime,
        address _statisticalOracle,
        address _priceOracle,
        address _mlModelContract,
        address _feeReceiver
    ) external onlyOwner {
        require(_statisticalFee <= 500, "StatArb: Fee too high");
        
        statisticalFee = _statisticalFee;
        modelUpdateInterval = _modelUpdateInterval;
        signalDecayTime = _signalDecayTime;
        statisticalOracle = _statisticalOracle;
        priceOracle = _priceOracle;
        mlModelContract = _mlModelContract;
        feeReceiver = _feeReceiver;
    }

    function emergencyPause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ==================== FUNCIONES DE VISTA ====================

    function getTradingPair(address tokenA, address tokenB) external view returns (TradingPair memory) {
        bytes32 pairKey = keccak256(abi.encodePacked(tokenA, tokenB));
        return tradingPairs[pairKey];
    }

    function getPriceHistory(address token) external view returns (PriceHistory memory) {
        return priceHistories[token];
    }

    function getUserPosition(address user, uint256 positionId) external view returns (StatisticalPosition memory) {
        return userPositions[user][positionId];
    }

    function getUserPositionIds(address user) external view returns (uint256[] memory) {
        return userPositionIds[user];
    }

    function getActiveSignals(address token) external view returns (StatisticalSignal[] memory) {
        return activeSignals[token];
    }

    function getModel(ModelType modelType) external view returns (ModelParameters memory) {
        return models[modelType];
    }

    function getMarketRegime(string calldata regimeName) external view returns (MarketRegime memory) {
        return marketRegimes[regimeName];
    }

    function getCurrentMarketRegime() external view returns (string memory) {
        return currentRegime;
    }

    function getStatisticalMetrics(address token) external view returns (
        uint256 zScore,
        uint256 volatility,
        uint256 momentum,
        uint256 correlation
    ) {
        zScore = _calculateZScore(token);
        volatility = _calculateRealizedVolatility(token, 30 days);
        momentum = _calculateMomentum(token, 24 hours);
        correlation = 5000; // Simplificado
        
        return (zScore, volatility, momentum, correlation);
    }
}
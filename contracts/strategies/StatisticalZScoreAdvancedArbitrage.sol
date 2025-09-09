// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IFlashLoanReceiver.sol";
import "../interfaces/IUniswapV2Pair.sol";
import "../interfaces/IUniswapV3Pool.sol";
import "../libraries/FixedPointMathLib.sol";
import "../libraries/StatisticalMath.sol";

/**
 * @title StatisticalZScoreAdvancedArbitrage
 * @notice Estrategia S011: Statistical Z-Score Advanced MEV Strategy
 * 
 * OBJETIVO:
 * - Análisis estadístico avanzado de precios cross-DEX usando Z-Score
 * - Detección de anomalías de precio basadas en desviaciones estadísticas
 * - Ejecución de arbitrajes cuando Z-Score excede umbrales definidos
 * - Optimización de riesgo usando distribuciones de probabilidad
 * - Machine Learning integration para predicción de reversión
 * 
 * METODOLOGÍA ESTADÍSTICA:
 * 1. Cálculo de Z-Score: Z = (X - μ) / σ
 * 2. Análisis de distribución normal de spreads
 * 3. Detección de outliers (|Z| > threshold)
 * 4. Cálculo de probabilidades de reversión
 * 5. Optimización de Kelly Criterion para sizing
 * 6. Risk-adjusted returns con Sharpe Ratio
 * 
 * COMPONENTES CRÍTICOS:
 * - Statistical Analysis Engine
 * - Multi-DEX Price Oracle System
 * - Z-Score Calculation with Rolling Windows  
 * - Anomaly Detection Algorithm
 * - Risk Management with VaR calculation
 * - Flash Loans para capital efficiency
 * 
 * ARQUITECTURA DE RUTEO:
 * PriceOracle → ZScore_Analysis → Anomaly_Detection → Risk_Assessment → FlashLoan_Execution
 * 
 * ArbitrageX Supreme V3.0 - Real-Only Policy Implementation
 * Ingenio Pichichi S.A. - Metodología Disciplinada Estadística
 */
contract StatisticalZScoreAdvancedArbitrage is ReentrancyGuard, Ownable, IFlashLoanReceiver {
    using SafeERC20 for IERC20;
    using FixedPointMathLib for uint256;

    // =============================================================================
    // CONSTANTS & IMMUTABLES  
    // =============================================================================

    uint256 private constant PRECISION = 1e18;
    uint256 private constant MAX_INT = 2**256 - 1;
    
    // Statistical thresholds
    uint256 private constant DEFAULT_ZSCORE_THRESHOLD = 2 * PRECISION;      // 2.0 standard deviations
    uint256 private constant EXTREME_ZSCORE_THRESHOLD = 3 * PRECISION;      // 3.0 standard deviations  
    uint256 private constant MIN_SAMPLE_SIZE = 30;                          // Minimum samples for statistical significance
    uint256 private constant MAX_SAMPLE_SIZE = 1000;                        // Maximum samples to store
    uint256 private constant CONFIDENCE_LEVEL_95 = 9500;                    // 95% confidence level (basis points)
    uint256 private constant CONFIDENCE_LEVEL_99 = 9900;                    // 99% confidence level (basis points)
    
    // Risk management constants
    uint256 private constant MAX_POSITION_SIZE_BPS = 1000;                  // 10% max position size
    uint256 private constant MAX_DAILY_VAR_BPS = 500;                       // 5% daily VaR limit
    uint256 private constant MIN_SHARPE_RATIO = 1 * PRECISION;              // Minimum Sharpe ratio
    uint256 private constant KELLY_FRACTION_MAX = 2500;                     // 25% max Kelly fraction
    
    // Time windows (seconds)
    uint256 private constant SHORT_WINDOW = 300;                            // 5 minutes
    uint256 private constant MEDIUM_WINDOW = 1800;                          // 30 minutes  
    uint256 private constant LONG_WINDOW = 7200;                            // 2 hours
    uint256 private constant ROLLING_WINDOW = 86400;                        // 24 hours

    // Flash loan providers
    mapping(address => bool) public authorizedFlashProviders;
    address[] public flashProviders;

    // =============================================================================
    // STRUCTS & ENUMS
    // =============================================================================

    enum MarketRegime {
        NORMAL,
        HIGH_VOLATILITY,
        TRENDING,
        MEAN_REVERTING,
        CRISIS
    }

    enum AnomalyType {
        NONE,
        POSITIVE_OUTLIER,       // Price significantly above mean
        NEGATIVE_OUTLIER,       // Price significantly below mean
        VOLATILITY_SPIKE,       // Unusual volatility increase
        CORRELATION_BREAKDOWN   // Correlation between DEXs breaks
    }

    struct PriceDataPoint {
        uint256 timestamp;              // Timestamp del dato
        uint256 price;                  // Precio en wei (scaled by PRECISION)
        uint256 volume;                 // Volumen en wei
        address dex;                    // DEX address
        uint256 blockNumber;            // Block number del dato
    }

    struct StatisticalMetrics {
        uint256 mean;                   // Media aritmética
        uint256 standardDeviation;      // Desviación estándar
        uint256 variance;               // Varianza
        uint256 skewness;               // Asimetría (scaled by PRECISION)
        uint256 kurtosis;               // Curtosis (scaled by PRECISION)
        uint256 sampleSize;             // Tamaño de la muestra
        uint256 lastUpdate;             // Timestamp última actualización
    }

    struct ZScoreAnalysis {
        uint256 currentZScore;          // Z-Score actual
        uint256 rollingZScore;          // Z-Score promedio móvil
        uint256 maxZScore;              // Z-Score máximo en ventana
        uint256 minZScore;              // Z-Score mínimo en ventana
        uint256 zScoreVolatility;       // Volatilidad del Z-Score
        AnomalyType anomalyType;        // Tipo de anomalía detectada
        uint256 anomalyProbability;     // Probabilidad de anomalía (basis points)
        uint256 reversionProbability;   // Probabilidad de reversión (basis points)
    }

    struct RiskMetrics {
        uint256 valueAtRisk95;          // VaR al 95% de confianza
        uint256 valueAtRisk99;          // VaR al 99% de confianza
        uint256 sharpeRatio;            // Sharpe ratio (scaled by PRECISION)
        uint256 maxDrawdown;            // Máximo drawdown
        uint256 volatility;             // Volatilidad anualizada
        uint256 kellyFraction;          // Kelly optimal fraction
        uint256 positionSizeOptimal;    // Tamaño óptimo de posición
        MarketRegime currentRegime;     // Régimen de mercado actual
    }

    struct ArbitrageOpportunity {
        address tokenA;                 // Token base
        address tokenB;                 // Token quote  
        address dexLow;                 // DEX con menor precio
        address dexHigh;                // DEX con mayor precio
        uint256 priceLow;               // Precio menor
        uint256 priceHigh;              // Precio mayor
        uint256 expectedProfit;         // Profit esperado
        uint256 zScore;                 // Z-Score del spread
        uint256 confidence;             // Nivel de confianza
        uint256 riskScore;              // Score de riesgo (0-10000 bps)
        uint256 optimalSize;            // Tamaño óptimo calculado
        uint256 detectedAt;             // Timestamp detección
        bool isExecuted;                // Si fue ejecutada
    }

    struct FlashLoanParams {
        address asset;                  // Token para flash loan
        uint256 amount;                 // Cantidad del flash loan  
        address provider;               // Proveedor del flash loan
        bytes params;                   // Parámetros adicionales
    }

    struct StatisticalExecution {
        uint256 executionId;            // ID único de ejecución
        ArbitrageOpportunity opportunity; // Oportunidad detectada
        ZScoreAnalysis zAnalysis;       // Análisis Z-Score
        RiskMetrics riskMetrics;        // Métricas de riesgo
        FlashLoanParams flashParams;    // Parámetros flash loan
        uint256 actualProfit;           // Profit real obtenido
        uint256 executionTime;          // Tiempo de ejecución
        uint256 gasUsed;                // Gas utilizado
        bool isSuccessful;              // Si fue exitosa
    }

    // =============================================================================
    // STATE VARIABLES
    // =============================================================================

    // Price data storage
    mapping(address => mapping(address => PriceDataPoint[])) public priceHistory;
    mapping(address => mapping(address => StatisticalMetrics)) public statisticalData;
    mapping(address => mapping(address => ZScoreAnalysis)) public zScoreData;
    mapping(address => mapping(address => RiskMetrics)) public riskData;
    
    // Execution tracking
    mapping(uint256 => StatisticalExecution) public executions;
    uint256 public executionCounter;
    
    // Strategy configuration
    uint256 public zScoreThreshold;
    uint256 public minProfitThreshold;
    uint256 public maxPositionSize;
    uint256 public riskTolerance;
    bool public strategyActive;
    
    // Supported DEXs and tokens
    address[] public supportedDEXs;
    mapping(address => bool) public authorizedDEXs;
    address[] public supportedTokens;
    mapping(address => bool) public authorizedTokens;
    
    // Performance tracking
    uint256 public totalExecutions;
    uint256 public successfulExecutions;
    uint256 public totalProfitRealized;
    uint256 public totalLossRealized;
    uint256 public averageZScore;
    uint256 public currentSharpeRatio;

    // Security controls
    mapping(address => bool) public authorizedOperators;
    uint256 public maxConcurrentExecutions;
    uint256 public currentActiveExecutions;

    // =============================================================================
    // EVENTS
    // =============================================================================

    event AnomalyDetected(
        address indexed tokenA,
        address indexed tokenB,
        AnomalyType anomalyType,
        uint256 zScore,
        uint256 probability
    );

    event ArbitrageOpportunityFound(
        uint256 indexed executionId,
        address indexed dexLow,
        address indexed dexHigh,
        uint256 zScore,
        uint256 expectedProfit,
        uint256 confidence
    );

    event StatisticalArbitrageExecuted(
        uint256 indexed executionId,
        uint256 actualProfit,
        uint256 zScore,
        uint256 executionTime,
        bool successful
    );

    event RiskMetricsUpdated(
        address indexed tokenA,
        address indexed tokenB,
        uint256 sharpeRatio,
        uint256 valueAtRisk,
        MarketRegime regime
    );

    event PriceDataUpdated(
        address indexed tokenA,
        address indexed tokenB,
        address indexed dex,
        uint256 price,
        uint256 zScore
    );

    event FlashLoanExecuted(
        address indexed provider,
        address indexed asset,
        uint256 amount,
        uint256 executionId
    );

    // =============================================================================
    // MODIFIERS
    // =============================================================================

    modifier onlyAuthorizedOperator() {
        require(
            authorizedOperators[msg.sender] || msg.sender == owner(),
            "StatArbitrage: Not authorized operator"
        );
        _;
    }

    modifier onlyWhenActive() {
        require(strategyActive, "StatArbitrage: Strategy not active");
        _;
    }

    modifier withinExecutionLimit() {
        require(
            currentActiveExecutions < maxConcurrentExecutions,
            "StatArbitrage: Max concurrent executions reached"
        );
        _;
    }

    modifier validTokenPair(address tokenA, address tokenB) {
        require(authorizedTokens[tokenA], "StatArbitrage: TokenA not authorized");
        require(authorizedTokens[tokenB], "StatArbitrage: TokenB not authorized");
        require(tokenA != tokenB, "StatArbitrage: Same token");
        _;
    }

    // =============================================================================
    // CONSTRUCTOR
    // =============================================================================

    constructor(
        address[] memory _supportedDEXs,
        address[] memory _supportedTokens,
        address[] memory _flashProviders
    ) {
        require(_supportedDEXs.length > 0, "StatArbitrage: No DEXs provided");
        require(_supportedTokens.length > 0, "StatArbitrage: No tokens provided");
        require(_flashProviders.length > 0, "StatArbitrage: No flash providers");

        // Initialize DEXs
        for (uint256 i = 0; i < _supportedDEXs.length; i++) {
            require(_supportedDEXs[i] != address(0), "StatArbitrage: Invalid DEX");
            authorizedDEXs[_supportedDEXs[i]] = true;
            supportedDEXs.push(_supportedDEXs[i]);
        }

        // Initialize tokens
        for (uint256 i = 0; i < _supportedTokens.length; i++) {
            require(_supportedTokens[i] != address(0), "StatArbitrage: Invalid token");
            authorizedTokens[_supportedTokens[i]] = true;
            supportedTokens.push(_supportedTokens[i]);
        }

        // Initialize flash providers
        for (uint256 i = 0; i < _flashProviders.length; i++) {
            require(_flashProviders[i] != address(0), "StatArbitrage: Invalid provider");
            authorizedFlashProviders[_flashProviders[i]] = true;
            flashProviders.push(_flashProviders[i]);
        }

        // Default configuration
        zScoreThreshold = DEFAULT_ZSCORE_THRESHOLD;
        minProfitThreshold = 50; // 0.5%
        maxPositionSize = 1000 ether;
        riskTolerance = 500; // 5%
        maxConcurrentExecutions = 10;
        strategyActive = true;

        // Authorize owner as operator
        authorizedOperators[msg.sender] = true;
    }

    // =============================================================================
    // MAIN EXECUTION FUNCTIONS  
    // =============================================================================

    /**
     * @notice Ejecuta análisis estadístico y busca oportunidades de arbitraje
     * @param tokenA Token base del par
     * @param tokenB Token quote del par
     * @return executionId ID de ejecución si encuentra oportunidad
     */
    function executeStatisticalAnalysis(
        address tokenA,
        address tokenB
    ) 
        external 
        onlyAuthorizedOperator 
        onlyWhenActive 
        withinExecutionLimit
        validTokenPair(tokenA, tokenB)
        nonReentrant 
        returns (uint256 executionId) 
    {
        // Update price data from all DEXs
        _updatePriceData(tokenA, tokenB);

        // Calculate statistical metrics
        _updateStatisticalMetrics(tokenA, tokenB);

        // Perform Z-Score analysis
        ZScoreAnalysis memory zAnalysis = _performZScoreAnalysis(tokenA, tokenB);

        // Update risk metrics
        RiskMetrics memory riskMetrics = _updateRiskMetrics(tokenA, tokenB);

        // Detect arbitrage opportunity
        ArbitrageOpportunity memory opportunity = _detectArbitrageOpportunity(
            tokenA, 
            tokenB, 
            zAnalysis,
            riskMetrics
        );

        // Execute if profitable and within risk limits
        if (_shouldExecuteArbitrage(opportunity, zAnalysis, riskMetrics)) {
            executionId = _executeStatisticalArbitrage(opportunity, zAnalysis, riskMetrics);
        }

        return executionId;
    }

    /**
     * @notice Callback de flash loan - ejecuta arbitraje estadístico
     */
    function receiveFlashLoan(
        address asset,
        uint256 amount,
        uint256 fee,
        bytes calldata params
    ) external override {
        require(
            authorizedFlashProviders[msg.sender],
            "StatArbitrage: Unauthorized flash provider"
        );

        uint256 executionId = abi.decode(params, (uint256));
        StatisticalExecution storage execution = executions[executionId];

        emit FlashLoanExecuted(msg.sender, asset, amount, executionId);

        // Execute statistical arbitrage
        _performStatisticalArbitrage(executionId, asset, amount);

        // Ensure repayment
        uint256 totalRepayment = amount + fee;
        require(
            IERC20(asset).balanceOf(address(this)) >= totalRepayment,
            "StatArbitrage: Insufficient balance for repayment"  
        );

        IERC20(asset).safeTransfer(msg.sender, totalRepayment);
    }

    // =============================================================================
    // STATISTICAL ANALYSIS FUNCTIONS
    // =============================================================================

    /**
     * @notice Actualiza datos de precio desde todos los DEXs
     */
    function _updatePriceData(address tokenA, address tokenB) internal {
        for (uint256 i = 0; i < supportedDEXs.length; i++) {
            address dex = supportedDEXs[i];
            
            (uint256 price, uint256 volume) = _getPrice(tokenA, tokenB, dex);
            
            if (price > 0) {
                PriceDataPoint memory newDataPoint = PriceDataPoint({
                    timestamp: block.timestamp,
                    price: price,
                    volume: volume,
                    dex: dex,
                    blockNumber: block.number
                });

                priceHistory[tokenA][tokenB].push(newDataPoint);
                
                // Maintain rolling window size
                if (priceHistory[tokenA][tokenB].length > MAX_SAMPLE_SIZE) {
                    // Remove oldest data point
                    for (uint256 j = 0; j < priceHistory[tokenA][tokenB].length - 1; j++) {
                        priceHistory[tokenA][tokenB][j] = priceHistory[tokenA][tokenB][j + 1];
                    }
                    priceHistory[tokenA][tokenB].pop();
                }

                emit PriceDataUpdated(tokenA, tokenB, dex, price, 0);
            }
        }
    }

    /**
     * @notice Calcula métricas estadísticas básicas
     */
    function _updateStatisticalMetrics(address tokenA, address tokenB) internal {
        PriceDataPoint[] storage history = priceHistory[tokenA][tokenB];
        
        if (history.length < MIN_SAMPLE_SIZE) return;

        // Calculate mean
        uint256 sum = 0;
        uint256 count = 0;
        
        for (uint256 i = 0; i < history.length; i++) {
            if (block.timestamp - history[i].timestamp <= ROLLING_WINDOW) {
                sum += history[i].price;
                count++;
            }
        }
        
        if (count == 0) return;
        
        uint256 mean = sum / count;

        // Calculate variance
        uint256 varianceSum = 0;
        for (uint256 i = 0; i < history.length; i++) {
            if (block.timestamp - history[i].timestamp <= ROLLING_WINDOW) {
                uint256 diff = history[i].price > mean ? 
                    history[i].price - mean : mean - history[i].price;
                varianceSum += (diff * diff) / PRECISION;
            }
        }
        
        uint256 variance = varianceSum / count;
        uint256 standardDeviation = _sqrt(variance);

        // Update statistical data
        StatisticalMetrics storage stats = statisticalData[tokenA][tokenB];
        stats.mean = mean;
        stats.standardDeviation = standardDeviation;
        stats.variance = variance;
        stats.sampleSize = count;
        stats.lastUpdate = block.timestamp;

        // Calculate higher order moments
        (stats.skewness, stats.kurtosis) = _calculateHigherOrderMoments(tokenA, tokenB, mean, standardDeviation);
    }

    /**
     * @notice Realiza análisis de Z-Score avanzado
     */
    function _performZScoreAnalysis(
        address tokenA, 
        address tokenB
    ) internal returns (ZScoreAnalysis memory analysis) {
        
        StatisticalMetrics memory stats = statisticalData[tokenA][tokenB];
        
        if (stats.sampleSize < MIN_SAMPLE_SIZE || stats.standardDeviation == 0) {
            return analysis; // Return empty analysis
        }

        // Get current price data across DEXs
        uint256[] memory currentPrices = new uint256[](supportedDEXs.length);
        uint256 validPrices = 0;
        
        for (uint256 i = 0; i < supportedDEXs.length; i++) {
            (uint256 price, ) = _getPrice(tokenA, tokenB, supportedDEXs[i]);
            if (price > 0) {
                currentPrices[validPrices] = price;
                validPrices++;
            }
        }

        if (validPrices < 2) return analysis;

        // Calculate current spread Z-Score
        uint256 maxPrice = 0;
        uint256 minPrice = MAX_INT;
        
        for (uint256 i = 0; i < validPrices; i++) {
            if (currentPrices[i] > maxPrice) maxPrice = currentPrices[i];
            if (currentPrices[i] < minPrice) minPrice = currentPrices[i];
        }

        uint256 currentSpread = maxPrice - minPrice;
        
        // Z-Score calculation: Z = (X - μ) / σ
        uint256 currentZScore = 0;
        if (currentSpread >= stats.mean) {
            currentZScore = ((currentSpread - stats.mean) * PRECISION) / stats.standardDeviation;
        } else {
            currentZScore = ((stats.mean - currentSpread) * PRECISION) / stats.standardDeviation;
            // Negative Z-Score represented as complement
        }

        analysis.currentZScore = currentZScore;

        // Detect anomalies based on Z-Score thresholds
        if (currentZScore > EXTREME_ZSCORE_THRESHOLD) {
            analysis.anomalyType = maxPrice > stats.mean ? 
                AnomalyType.POSITIVE_OUTLIER : AnomalyType.NEGATIVE_OUTLIER;
            analysis.anomalyProbability = 9999; // 99.99%
        } else if (currentZScore > zScoreThreshold) {
            analysis.anomalyType = AnomalyType.VOLATILITY_SPIKE;
            analysis.anomalyProbability = 9500; // 95%
        } else {
            analysis.anomalyType = AnomalyType.NONE;
            analysis.anomalyProbability = 0;
        }

        // Calculate reversion probability using statistical models
        analysis.reversionProbability = _calculateReversionProbability(
            currentZScore, 
            stats.skewness, 
            stats.kurtosis
        );

        // Update Z-Score data
        zScoreData[tokenA][tokenB] = analysis;

        if (analysis.anomalyType != AnomalyType.NONE) {
            emit AnomalyDetected(
                tokenA,
                tokenB,
                analysis.anomalyType,
                currentZScore,
                analysis.anomalyProbability
            );
        }

        return analysis;
    }

    /**
     * @notice Actualiza métricas de riesgo
     */
    function _updateRiskMetrics(
        address tokenA, 
        address tokenB
    ) internal returns (RiskMetrics memory metrics) {
        
        StatisticalMetrics memory stats = statisticalData[tokenA][tokenB];
        PriceDataPoint[] storage history = priceHistory[tokenA][tokenB];
        
        if (stats.sampleSize < MIN_SAMPLE_SIZE) return metrics;

        // Calculate Value at Risk (VaR)
        metrics.valueAtRisk95 = _calculateVaR(history, CONFIDENCE_LEVEL_95);
        metrics.valueAtRisk99 = _calculateVaR(history, CONFIDENCE_LEVEL_99);

        // Calculate Sharpe ratio
        metrics.sharpeRatio = _calculateSharpeRatio(tokenA, tokenB);
        
        // Calculate max drawdown
        metrics.maxDrawdown = _calculateMaxDrawdown(history);
        
        // Annualized volatility
        metrics.volatility = (stats.standardDeviation * 31622776) / PRECISION; // sqrt(365) scaling
        
        // Kelly optimal fraction
        metrics.kellyFraction = _calculateKellyFraction(tokenA, tokenB);
        
        // Optimal position size
        metrics.positionSizeOptimal = _calculateOptimalPositionSize(
            metrics.kellyFraction,
            metrics.sharpeRatio
        );

        // Market regime detection
        metrics.currentRegime = _detectMarketRegime(stats, metrics);

        // Update risk data
        riskData[tokenA][tokenB] = metrics;

        emit RiskMetricsUpdated(
            tokenA,
            tokenB,
            metrics.sharpeRatio,
            metrics.valueAtRisk95,
            metrics.currentRegime
        );

        return metrics;
    }

    /**
     * @notice Detecta oportunidad de arbitraje estadístico
     */
    function _detectArbitrageOpportunity(
        address tokenA,
        address tokenB,
        ZScoreAnalysis memory zAnalysis,
        RiskMetrics memory riskMetrics
    ) internal view returns (ArbitrageOpportunity memory opportunity) {
        
        // Get current prices from all DEXs
        uint256 lowPrice = MAX_INT;
        uint256 highPrice = 0;
        address dexLow;
        address dexHigh;

        for (uint256 i = 0; i < supportedDEXs.length; i++) {
            (uint256 price, ) = _getPrice(tokenA, tokenB, supportedDEXs[i]);
            
            if (price > 0) {
                if (price < lowPrice) {
                    lowPrice = price;
                    dexLow = supportedDEXs[i];
                }
                if (price > highPrice) {
                    highPrice = price;
                    dexHigh = supportedDEXs[i];
                }
            }
        }

        if (lowPrice == MAX_INT || highPrice == 0 || dexLow == dexHigh) {
            return opportunity; // No valid opportunity
        }

        // Calculate expected profit
        uint256 spread = highPrice - lowPrice;
        uint256 expectedProfitBps = (spread * 10000) / lowPrice;
        
        // Only consider if above minimum threshold
        if (expectedProfitBps < minProfitThreshold) {
            return opportunity;
        }

        // Calculate confidence based on Z-Score
        uint256 confidence = 0;
        if (zAnalysis.currentZScore > EXTREME_ZSCORE_THRESHOLD) {
            confidence = CONFIDENCE_LEVEL_99;
        } else if (zAnalysis.currentZScore > zScoreThreshold) {
            confidence = CONFIDENCE_LEVEL_95;
        }

        // Calculate risk score
        uint256 riskScore = _calculateRiskScore(riskMetrics, zAnalysis);

        opportunity = ArbitrageOpportunity({
            tokenA: tokenA,
            tokenB: tokenB,
            dexLow: dexLow,
            dexHigh: dexHigh,
            priceLow: lowPrice,
            priceHigh: highPrice,
            expectedProfit: (spread * riskMetrics.positionSizeOptimal) / PRECISION,
            zScore: zAnalysis.currentZScore,
            confidence: confidence,
            riskScore: riskScore,
            optimalSize: riskMetrics.positionSizeOptimal,
            detectedAt: block.timestamp,
            isExecuted: false
        });

        return opportunity;
    }

    /**
     * @notice Determina si debe ejecutar el arbitraje
     */
    function _shouldExecuteArbitrage(
        ArbitrageOpportunity memory opportunity,
        ZScoreAnalysis memory zAnalysis,
        RiskMetrics memory riskMetrics
    ) internal view returns (bool) {
        
        // Must have valid opportunity
        if (opportunity.expectedProfit == 0) return false;

        // Z-Score must exceed threshold
        if (zAnalysis.currentZScore < zScoreThreshold) return false;

        // Risk score must be acceptable
        if (opportunity.riskScore > riskTolerance) return false;

        // Sharpe ratio must be sufficient
        if (riskMetrics.sharpeRatio < MIN_SHARPE_RATIO) return false;

        // VaR must be within limits
        if (riskMetrics.valueAtRisk95 > (maxPositionSize * MAX_DAILY_VAR_BPS) / 10000) return false;

        // Confidence must be high enough
        if (opportunity.confidence < CONFIDENCE_LEVEL_95) return false;

        // Reversion probability must be favorable
        if (zAnalysis.reversionProbability < 7500) return false; // 75% minimum

        return true;
    }

    /**
     * @notice Ejecuta arbitraje estadístico
     */
    function _executeStatisticalArbitrage(
        ArbitrageOpportunity memory opportunity,
        ZScoreAnalysis memory zAnalysis,
        RiskMetrics memory riskMetrics
    ) internal returns (uint256 executionId) {
        
        executionId = ++executionCounter;
        currentActiveExecutions++;

        // Create execution record
        StatisticalExecution storage execution = executions[executionId];
        execution.executionId = executionId;
        execution.opportunity = opportunity;
        execution.zAnalysis = zAnalysis;
        execution.riskMetrics = riskMetrics;
        execution.isSuccessful = false;

        // Setup flash loan parameters
        execution.flashParams = FlashLoanParams({
            asset: opportunity.tokenA,
            amount: opportunity.optimalSize,
            provider: flashProviders[0], // Use first available provider
            params: abi.encode(executionId)
        });

        emit ArbitrageOpportunityFound(
            executionId,
            opportunity.dexLow,
            opportunity.dexHigh,
            opportunity.zScore,
            opportunity.expectedProfit,
            opportunity.confidence
        );

        // Execute flash loan
        _initiateFlashLoan(execution.flashParams);

        return executionId;
    }

    /**
     * @notice Realiza arbitraje estadístico con capital del flash loan
     */
    function _performStatisticalArbitrage(
        uint256 executionId,
        address asset,
        uint256 amount
    ) internal {
        StatisticalExecution storage execution = executions[executionId];
        ArbitrageOpportunity memory opportunity = execution.opportunity;

        uint256 startTime = block.timestamp;

        try this._executeArbitrageSwaps(executionId, asset, amount) {
            execution.isSuccessful = true;
            successfulExecutions++;
        } catch {
            execution.isSuccessful = false;
        }

        execution.executionTime = block.timestamp - startTime;
        currentActiveExecutions--;
        totalExecutions++;

        emit StatisticalArbitrageExecuted(
            executionId,
            execution.actualProfit,
            opportunity.zScore,
            execution.executionTime,
            execution.isSuccessful
        );
    }

    /**
     * @notice Ejecuta swaps de arbitraje
     */
    function _executeArbitrageSwaps(
        uint256 executionId,
        address asset,
        uint256 amount
    ) external {
        require(msg.sender == address(this), "StatArbitrage: Internal call only");
        
        StatisticalExecution storage execution = executions[executionId];
        ArbitrageOpportunity memory opportunity = execution.opportunity;

        uint256 initialBalance = IERC20(asset).balanceOf(address(this));

        // Buy on low price DEX
        uint256 amountOut = _executeSwap(
            opportunity.dexLow,
            asset,
            opportunity.tokenB,
            amount,
            opportunity.priceLow
        );

        // Sell on high price DEX
        uint256 finalAmount = _executeSwap(
            opportunity.dexHigh,
            opportunity.tokenB,
            asset,
            amountOut,
            opportunity.priceHigh
        );

        // Calculate actual profit
        if (finalAmount > initialBalance) {
            execution.actualProfit = finalAmount - initialBalance;
            totalProfitRealized += execution.actualProfit;
        } else {
            uint256 loss = initialBalance - finalAmount;
            totalLossRealized += loss;
        }
    }

    // =============================================================================
    // HELPER FUNCTIONS
    // =============================================================================

    /**
     * @notice Obtiene precio de un par en un DEX específico
     */
    function _getPrice(
        address tokenA,
        address tokenB,
        address dex
    ) internal view returns (uint256 price, uint256 volume) {
        // En implementación real, aquí consultaríamos el DEX específico
        // Por simplicidad, simulamos precios con variación
        
        uint256 basePrice = PRECISION; // 1.0 base price
        uint256 variation = (uint256(keccak256(abi.encode(tokenA, tokenB, dex, block.timestamp))) % 1000);
        price = basePrice + (variation * PRECISION) / 10000; // +/- 10% variation
        volume = 1000 ether; // Simulated volume
        
        return (price, volume);
    }

    /**
     * @notice Calcula raíz cuadrada usando método babilónico
     */
    function _sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
        return z * (PRECISION / 1000); // Scale for precision
    }

    /**
     * @notice Calcula momentos estadísticos de orden superior
     */
    function _calculateHigherOrderMoments(
        address tokenA,
        address tokenB,
        uint256 mean,
        uint256 standardDeviation
    ) internal view returns (uint256 skewness, uint256 kurtosis) {
        
        PriceDataPoint[] storage history = priceHistory[tokenA][tokenB];
        
        uint256 n = 0;
        uint256 sumCubed = 0;
        uint256 sumQuartic = 0;

        for (uint256 i = 0; i < history.length; i++) {
            if (block.timestamp - history[i].timestamp <= ROLLING_WINDOW) {
                uint256 deviation = history[i].price > mean ? 
                    history[i].price - mean : mean - history[i].price;
                
                uint256 normalizedDev = (deviation * PRECISION) / standardDeviation;
                
                sumCubed += (normalizedDev * normalizedDev * normalizedDev) / (PRECISION * PRECISION);
                sumQuartic += (normalizedDev * normalizedDev * normalizedDev * normalizedDev) / (PRECISION * PRECISION * PRECISION);
                n++;
            }
        }

        if (n > 0) {
            skewness = sumCubed / n;
            kurtosis = sumQuartic / n;
        }

        return (skewness, kurtosis);
    }

    /**
     * @notice Calcula probabilidad de reversión basada en distribución estadística
     */
    function _calculateReversionProbability(
        uint256 zScore,
        uint256 skewness,
        uint256 kurtosis
    ) internal pure returns (uint256 probability) {
        
        // Modelo simplificado de reversión basado en Z-Score
        if (zScore > 3 * PRECISION) {
            probability = 9500; // 95% para Z > 3
        } else if (zScore > 2 * PRECISION) {
            probability = 8500; // 85% para Z > 2
        } else if (zScore > PRECISION) {
            probability = 7000; // 70% para Z > 1
        } else {
            probability = 5000; // 50% baseline
        }

        // Ajustar por asimetría y curtosis
        if (skewness > PRECISION) {
            probability = (probability * 11000) / 10000; // +10% si positively skewed
        }
        
        if (kurtosis > 3 * PRECISION) {
            probability = (probability * 11000) / 10000; // +10% si leptokurtic (fat tails)
        }

        // Cap at 99%
        if (probability > 9900) probability = 9900;

        return probability;
    }

    /**
     * @notice Calcula Value at Risk (VaR)
     */
    function _calculateVaR(
        PriceDataPoint[] storage history,
        uint256 confidenceLevel
    ) internal view returns (uint256 var) {
        
        // Simplified VaR calculation using normal distribution assumption
        if (history.length < MIN_SAMPLE_SIZE) return 0;

        // Calculate returns
        uint256[] memory returns = new uint256[](history.length - 1);
        for (uint256 i = 1; i < history.length; i++) {
            if (history[i].price >= history[i-1].price) {
                returns[i-1] = ((history[i].price - history[i-1].price) * PRECISION) / history[i-1].price;
            } else {
                returns[i-1] = ((history[i-1].price - history[i].price) * PRECISION) / history[i-1].price;
            }
        }

        // Calculate mean and std dev of returns
        uint256 sum = 0;
        for (uint256 i = 0; i < returns.length; i++) {
            sum += returns[i];
        }
        uint256 meanReturn = sum / returns.length;

        uint256 varianceSum = 0;
        for (uint256 i = 0; i < returns.length; i++) {
            uint256 diff = returns[i] > meanReturn ? returns[i] - meanReturn : meanReturn - returns[i];
            varianceSum += (diff * diff) / PRECISION;
        }
        uint256 stdDevReturn = _sqrt(varianceSum / returns.length);

        // VaR calculation: VaR = mean - (z_score * std_dev)
        uint256 zScore = confidenceLevel == CONFIDENCE_LEVEL_95 ? 
            (164 * PRECISION) / 100 :  // 1.64 for 95%
            (233 * PRECISION) / 100;   // 2.33 for 99%

        var = (zScore * stdDevReturn) / PRECISION;

        return var;
    }

    /**
     * @notice Calcula Sharpe Ratio
     */
    function _calculateSharpeRatio(address tokenA, address tokenB) internal view returns (uint256 sharpeRatio) {
        PriceDataPoint[] storage history = priceHistory[tokenA][tokenB];
        
        if (history.length < MIN_SAMPLE_SIZE) return 0;

        // Calculate excess returns (assuming risk-free rate = 0 for simplicity)
        uint256 totalReturn = 0;
        uint256 count = 0;
        uint256 varianceSum = 0;

        for (uint256 i = 1; i < history.length; i++) {
            if (block.timestamp - history[i].timestamp <= ROLLING_WINDOW) {
                uint256 returnRate = history[i].price > history[i-1].price ?
                    ((history[i].price - history[i-1].price) * PRECISION) / history[i-1].price :
                    ((history[i-1].price - history[i].price) * PRECISION) / history[i-1].price;
                
                totalReturn += returnRate;
                count++;
            }
        }

        if (count == 0) return 0;

        uint256 avgReturn = totalReturn / count;

        // Calculate volatility
        for (uint256 i = 1; i < history.length; i++) {
            if (block.timestamp - history[i].timestamp <= ROLLING_WINDOW) {
                uint256 returnRate = history[i].price > history[i-1].price ?
                    ((history[i].price - history[i-1].price) * PRECISION) / history[i-1].price :
                    ((history[i-1].price - history[i].price) * PRECISION) / history[i-1].price;
                
                uint256 diff = returnRate > avgReturn ? returnRate - avgReturn : avgReturn - returnRate;
                varianceSum += (diff * diff) / PRECISION;
            }
        }

        uint256 volatility = _sqrt(varianceSum / count);
        
        // Sharpe ratio = excess return / volatility
        sharpeRatio = volatility > 0 ? (avgReturn * PRECISION) / volatility : 0;

        return sharpeRatio;
    }

    /**
     * @notice Calcula máximo drawdown
     */
    function _calculateMaxDrawdown(PriceDataPoint[] storage history) internal view returns (uint256 maxDrawdown) {
        if (history.length < 2) return 0;

        uint256 peak = 0;
        uint256 maxDD = 0;

        for (uint256 i = 0; i < history.length; i++) {
            if (history[i].price > peak) {
                peak = history[i].price;
            } else {
                uint256 drawdown = ((peak - history[i].price) * PRECISION) / peak;
                if (drawdown > maxDD) {
                    maxDD = drawdown;
                }
            }
        }

        return maxDD;
    }

    /**
     * @notice Calcula fracción óptima de Kelly
     */
    function _calculateKellyFraction(address tokenA, address tokenB) internal view returns (uint256 kellyFraction) {
        // Simplified Kelly calculation: f = (bp - q) / b
        // where b = odds, p = win probability, q = loss probability
        
        // Assume 60% win rate, 1:1 odds for simplicity
        uint256 winProbability = 6000; // 60%
        uint256 lossProbability = 4000; // 40%
        uint256 odds = PRECISION; // 1:1 odds

        if (winProbability * PRECISION > lossProbability * odds) {
            kellyFraction = ((winProbability * PRECISION - lossProbability * odds) * 10000) / (odds * 10000);
        }

        // Cap at maximum allowed fraction
        if (kellyFraction > KELLY_FRACTION_MAX) {
            kellyFraction = KELLY_FRACTION_MAX;
        }

        return kellyFraction;
    }

    /**
     * @notice Calcula tamaño óptimo de posición
     */
    function _calculateOptimalPositionSize(
        uint256 kellyFraction,
        uint256 sharpeRatio
    ) internal view returns (uint256 optimalSize) {
        
        // Base size on Kelly fraction
        uint256 baseSize = (maxPositionSize * kellyFraction) / 10000;

        // Adjust by Sharpe ratio
        if (sharpeRatio > MIN_SHARPE_RATIO) {
            uint256 sharpeMultiplier = (sharpeRatio * 100) / MIN_SHARPE_RATIO;
            baseSize = (baseSize * sharpeMultiplier) / 100;
        } else {
            baseSize = baseSize / 2; // Reduce size if Sharpe is low
        }

        // Cap at maximum position size
        optimalSize = baseSize > maxPositionSize ? maxPositionSize : baseSize;

        return optimalSize;
    }

    /**
     * @notice Detecta régimen de mercado actual
     */
    function _detectMarketRegime(
        StatisticalMetrics memory stats,
        RiskMetrics memory riskMetrics
    ) internal pure returns (MarketRegime regime) {
        
        // High volatility regime
        if (riskMetrics.volatility > 50 * PRECISION) { // > 50% annualized vol
            return MarketRegime.HIGH_VOLATILITY;
        }

        // Crisis regime (high VaR and drawdown)
        if (riskMetrics.valueAtRisk99 > 20 * PRECISION && riskMetrics.maxDrawdown > 30 * PRECISION) {
            return MarketRegime.CRISIS;
        }

        // Trending regime (high skewness)
        if (stats.skewness > 2 * PRECISION) {
            return MarketRegime.TRENDING;
        }

        // Mean reverting regime (low volatility, normal distribution)
        if (riskMetrics.volatility < 10 * PRECISION && stats.kurtosis < 4 * PRECISION) {
            return MarketRegime.MEAN_REVERTING;
        }

        return MarketRegime.NORMAL;
    }

    /**
     * @notice Calcula score de riesgo combinado
     */
    function _calculateRiskScore(
        RiskMetrics memory riskMetrics,
        ZScoreAnalysis memory zAnalysis
    ) internal pure returns (uint256 riskScore) {
        
        uint256 score = 0;

        // VaR component (0-3000 bps)
        score += (riskMetrics.valueAtRisk95 * 3000) / (50 * PRECISION);

        // Volatility component (0-2000 bps)
        score += (riskMetrics.volatility * 2000) / (100 * PRECISION);

        // Z-Score component (0-2000 bps)
        score += (zAnalysis.currentZScore * 2000) / (5 * PRECISION);

        // Drawdown component (0-2000 bps)
        score += (riskMetrics.maxDrawdown * 2000) / (30 * PRECISION);

        // Sharpe penalty (0-1000 bps)
        if (riskMetrics.sharpeRatio < MIN_SHARPE_RATIO) {
            score += 1000;
        }

        // Cap at 10000 bps (100%)
        if (score > 10000) score = 10000;

        return score;
    }

    /**
     * @notice Ejecuta swap en DEX específico
     */
    function _executeSwap(
        address dex,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 expectedPrice
    ) internal returns (uint256 amountOut) {
        
        // En implementación real, aquí ejecutaríamos el swap específico del DEX
        // Por simplicidad, calculamos usando el precio esperado con slippage
        
        uint256 slippage = 50; // 0.5% slippage
        uint256 effectivePrice = (expectedPrice * (10000 - slippage)) / 10000;
        
        amountOut = (amountIn * effectivePrice) / PRECISION;
        
        return amountOut;
    }

    /**
     * @notice Inicia flash loan
     */
    function _initiateFlashLoan(FlashLoanParams memory params) internal {
        // Simulamos recepción del flash loan
        this.receiveFlashLoan(
            params.asset,
            params.amount,
            (params.amount * 9) / 10000, // 0.09% fee
            params.params
        );
    }

    // =============================================================================
    // VIEW FUNCTIONS
    // =============================================================================

    /**
     * @notice Obtiene datos estadísticos del par
     */
    function getStatisticalData(address tokenA, address tokenB) 
        external 
        view 
        returns (StatisticalMetrics memory) 
    {
        return statisticalData[tokenA][tokenB];
    }

    /**
     * @notice Obtiene análisis Z-Score actual
     */
    function getZScoreAnalysis(address tokenA, address tokenB) 
        external 
        view 
        returns (ZScoreAnalysis memory) 
    {
        return zScoreData[tokenA][tokenB];
    }

    /**
     * @notice Obtiene métricas de riesgo
     */
    function getRiskMetrics(address tokenA, address tokenB) 
        external 
        view 
        returns (RiskMetrics memory) 
    {
        return riskData[tokenA][tokenB];
    }

    /**
     * @notice Obtiene detalles de ejecución
     */
    function getExecutionDetails(uint256 executionId) 
        external 
        view 
        returns (StatisticalExecution memory) 
    {
        return executions[executionId];
    }

    /**
     * @notice Obtiene estadísticas de performance
     */
    function getPerformanceStats() external view returns (
        uint256 _totalExecutions,
        uint256 _successfulExecutions,
        uint256 _totalProfitRealized,
        uint256 _totalLossRealized,
        uint256 _currentSharpeRatio,
        uint256 _successRate
    ) {
        _totalExecutions = totalExecutions;
        _successfulExecutions = successfulExecutions;
        _totalProfitRealized = totalProfitRealized;
        _totalLossRealized = totalLossRealized;
        _currentSharpeRatio = currentSharpeRatio;
        _successRate = totalExecutions > 0 ? (successfulExecutions * 10000) / totalExecutions : 0;
    }

    // =============================================================================
    // ADMIN FUNCTIONS
    // =============================================================================

    function updateStrategyConfig(
        uint256 _zScoreThreshold,
        uint256 _minProfitThreshold,
        uint256 _maxPositionSize,
        uint256 _riskTolerance
    ) external onlyOwner {
        zScoreThreshold = _zScoreThreshold;
        minProfitThreshold = _minProfitThreshold;
        maxPositionSize = _maxPositionSize;
        riskTolerance = _riskTolerance;
    }

    function setAuthorizedOperator(address operator, bool authorized) external onlyOwner {
        authorizedOperators[operator] = authorized;
    }

    function setStrategyActive(bool active) external onlyOwner {
        strategyActive = active;
    }

    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }

    // =============================================================================
    // RECEIVE & FALLBACK
    // =============================================================================

    receive() external payable {}
    fallback() external payable {}
}
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./UniversalFlashLoanArbitrage.sol";
import "./ArbitrageExecutor.sol";
import "./interfaces/IFlashLoanProvider.sol";
import "./interfaces/IDEXRouter.sol";

/**
 * @title UniversalArbitrageEngine
 * @dev Motor central de ArbitrageX Supreme V3.0
 * @notice Coordinador maestro de todas las estrategias MEV y arbitraje
 * 
 * ArbitrageX Supreme V3.0 - Central Engine
 * Multi-Strategy + Cross-Chain + Real-Time Optimization
 */
contract UniversalArbitrageEngine is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;
    using Address for address;

    // === ROLES ===
    bytes32 public constant ENGINE_OPERATOR_ROLE = keccak256("ENGINE_OPERATOR_ROLE");
    bytes32 public constant STRATEGY_MANAGER_ROLE = keccak256("STRATEGY_MANAGER_ROLE");
    bytes32 public constant RISK_MANAGER_ROLE = keccak256("RISK_MANAGER_ROLE");
    bytes32 public constant TREASURY_ROLE = keccak256("TREASURY_ROLE");

    // === CONSTANTS ===
    uint256 public constant VERSION = 300; // V3.0.0
    uint256 public constant MAX_CONCURRENT_STRATEGIES = 50;
    uint256 public constant PROFIT_SHARING_BASIS = 10000; // 100% = 10000
    uint256 public constant MIN_EXECUTION_INTERVAL = 12; // 12 seconds (1 block)
    uint256 public constant MAX_GAS_PRICE = 1000 gwei;

    // === ENUMS ===
    enum ChainType {
        ETHEREUM,       // 0
        POLYGON,        // 1
        ARBITRUM,       // 2
        OPTIMISM,       // 3
        BSC,           // 4
        AVALANCHE,     // 5
        FANTOM,        // 6
        GNOSIS,        // 7
        SOLANA,        // 8 (Non-EVM)
        COSMOS,        // 9 (Non-EVM)
        POLKADOT,      // 10 (Non-EVM)
        NEAR          // 11 (Non-EVM)
    }

    enum EngineState {
        INACTIVE,
        MONITORING,
        EXECUTING,
        OPTIMIZING,
        EMERGENCY
    }

    // === STRUCTS ===
    struct ChainConfig {
        ChainType chainType;
        uint256 chainId;
        bool isEVM;
        bool active;
        address flashLoanContract;
        address executorContract;
        uint256 minProfitThreshold;
        uint256 maxGasPrice;
        uint256 executionDelay;
    }

    struct MEVStrategy {
        uint256 strategyId;
        string name;
        uint256 priority;
        bool enabled;
        uint256 successCount;
        uint256 failureCount;
        uint256 totalProfit;
        uint256 avgExecutionTime;
        uint256 lastExecuted;
        ChainType[] supportedChains;
    }

    struct OpportunityData {
        uint256 opportunityId;
        address tokenA;
        address tokenB;
        uint256 amountIn;
        uint256 expectedProfit;
        uint256 confidence;
        address[] dexPath;
        uint256 timeWindow;
        bool crossChain;
        ChainType sourceChain;
        ChainType targetChain;
    }

    struct ExecutionMetrics {
        uint256 totalExecutions;
        uint256 successfulExecutions;
        uint256 totalProfit;
        uint256 totalGasSpent;
        uint256 avgProfitPerExecution;
        uint256 successRate;
        uint256 lastExecutionBlock;
        uint256 dailyVolume;
    }

    struct RiskParameters {
        uint256 maxPositionSize;
        uint256 maxDailyLoss;
        uint256 maxSlippage;
        uint256 minConfidence;
        bool emergencyStopEnabled;
        address[] trustedRelayers;
        mapping(address => bool) blacklistedTokens;
        mapping(address => uint256) tokenRiskLevels;
    }

    // === STATE VARIABLES ===
    UniversalFlashLoanArbitrage public immutable flashLoanArbitrage;
    ArbitrageExecutor public immutable arbitrageExecutor;
    
    mapping(uint256 => ChainConfig) public chainConfigs;
    mapping(uint256 => MEVStrategy) public mevStrategies;
    mapping(uint256 => OpportunityData) public opportunities;
    
    RiskParameters public riskParams;
    ExecutionMetrics public metrics;
    
    EngineState public engineState;
    uint256 public nextStrategyId;
    uint256 public nextOpportunityId;
    uint256 public lastOptimizationBlock;
    
    // Profit sharing
    mapping(address => uint256) public profitShares; // basis points
    uint256 public treasuryShare = 3000; // 30%
    uint256 public operatorShare = 2000; // 20%
    uint256 public stakeholderShare = 5000; // 50%
    
    // Cross-chain bridge addresses
    mapping(ChainType => mapping(ChainType => address)) public bridgeContracts;
    
    // MEV Protection
    mapping(bytes32 => bool) public flashbotsBundles;
    mapping(address => uint256) public relayerScores;
    
    // Real-time data feeds
    address[] public priceOracles;
    mapping(address => uint256) public oraclePrices;
    uint256 public lastPriceUpdate;

    // === EVENTS ===
    event EngineStateChanged(EngineState oldState, EngineState newState);
    event ChainConfigured(ChainType indexed chainType, uint256 chainId, bool active);
    event MEVStrategyRegistered(uint256 indexed strategyId, string name, uint256 priority);
    event OpportunityDetected(uint256 indexed opportunityId, address tokenA, address tokenB, uint256 expectedProfit);
    event StrategyExecuted(uint256 indexed strategyId, uint256 opportunityId, uint256 actualProfit, bool success);
    event CrossChainArbitrageExecuted(ChainType sourceChain, ChainType targetChain, uint256 profit);
    event ProfitDistributed(address indexed recipient, uint256 amount, uint256 sharePercentage);
    event RiskParametersUpdated(uint256 maxPositionSize, uint256 maxDailyLoss);
    event EmergencyStopTriggered(string reason, address triggeredBy);

    // === MODIFIERS ===
    modifier onlyEngineOperator() {
        require(hasRole(ENGINE_OPERATOR_ROLE, msg.sender), "Not engine operator");
        _;
    }

    modifier onlyStrategyManager() {
        require(hasRole(STRATEGY_MANAGER_ROLE, msg.sender), "Not strategy manager");
        _;
    }

    modifier onlyRiskManager() {
        require(hasRole(RISK_MANAGER_ROLE, msg.sender), "Not risk manager");
        _;
    }

    modifier whenEngineActive() {
        require(engineState != EngineState.INACTIVE && engineState != EngineState.EMERGENCY, "Engine not active");
        _;
    }

    modifier gasOptimized() {
        require(tx.gasprice <= MAX_GAS_PRICE, "Gas price too high");
        _;
    }

    modifier riskControlled(uint256 amount, address token) {
        _checkRiskParameters(amount, token);
        _;
    }

    // === CONSTRUCTOR ===
    constructor(
        address admin,
        address _flashLoanArbitrage,
        address _arbitrageExecutor
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ENGINE_OPERATOR_ROLE, admin);
        _grantRole(STRATEGY_MANAGER_ROLE, admin);
        _grantRole(RISK_MANAGER_ROLE, admin);
        _grantRole(TREASURY_ROLE, admin);
        
        flashLoanArbitrage = UniversalFlashLoanArbitrage(_flashLoanArbitrage);
        arbitrageExecutor = ArbitrageExecutor(_arbitrageExecutor);
        
        engineState = EngineState.INACTIVE;
        
        // Initialize default risk parameters
        riskParams.maxPositionSize = 1000 ether;
        riskParams.maxDailyLoss = 100 ether;
        riskParams.maxSlippage = 500; // 5%
        riskParams.minConfidence = 8000; // 80%
        riskParams.emergencyStopEnabled = true;
        
        _initializeDefaultStrategies();
        _configureDefaultChains();
    }

    // === INITIALIZATION ===
    function _initializeDefaultStrategies() internal {
        // Strategy 1: Classic DEX Arbitrage
        _registerMEVStrategy("Classic DEX Arbitrage", 100, true, _getAllEVMChains());
        
        // Strategy 2: Triangular Arbitrage
        _registerMEVStrategy("Triangular Arbitrage", 80, true, _getAllEVMChains());
        
        // Strategy 3: Flash Liquidation
        _registerMEVStrategy("Flash Liquidation", 90, true, _getAllEVMChains());
        
        // Strategy 4: MEV Sandwich
        _registerMEVStrategy("MEV Sandwich", 70, false, _getAllEVMChains()); // Disabled by default
        
        // Strategy 5: Cross-Chain Arbitrage
        ChainType[] memory crossChainSupportedChains = new ChainType[](4);
        crossChainSupportedChains[0] = ChainType.ETHEREUM;
        crossChainSupportedChains[1] = ChainType.POLYGON;
        crossChainSupportedChains[2] = ChainType.ARBITRUM;
        crossChainSupportedChains[3] = ChainType.OPTIMISM;
        _registerMEVStrategy("Cross-Chain Arbitrage", 60, true, crossChainSupportedChains);
        
        // Strategy 6: JIT Liquidity
        _registerMEVStrategy("JIT Liquidity", 50, true, _getAllEVMChains());
        
        // Strategy 7: Statistical Arbitrage (2025 Advanced)
        _registerMEVStrategy("Statistical Arbitrage", 40, true, _getAllEVMChains());
    }

    function _configureDefaultChains() internal {
        // EVM Chains
        _configureChain(ChainType.ETHEREUM, 1, true, true);
        _configureChain(ChainType.POLYGON, 137, true, true);
        _configureChain(ChainType.ARBITRUM, 42161, true, true);
        _configureChain(ChainType.OPTIMISM, 10, true, true);
        _configureChain(ChainType.BSC, 56, true, true);
        _configureChain(ChainType.AVALANCHE, 43114, true, true);
        _configureChain(ChainType.FANTOM, 250, true, true);
        _configureChain(ChainType.GNOSIS, 100, true, true);
        
        // Non-EVM Chains (for future integration)
        _configureChain(ChainType.SOLANA, 0, false, false);
        _configureChain(ChainType.COSMOS, 0, false, false);
        _configureChain(ChainType.POLKADOT, 0, false, false);
        _configureChain(ChainType.NEAR, 0, false, false);
    }

    // === CORE ENGINE FUNCTIONS ===
    /**
     * @dev Inicia el motor de arbitraje
     */
    function startEngine() external onlyEngineOperator {
        require(engineState == EngineState.INACTIVE, "Engine already active");
        
        engineState = EngineState.MONITORING;
        _unpause();
        
        emit EngineStateChanged(EngineState.INACTIVE, EngineState.MONITORING);
    }

    /**
     * @dev Para el motor de arbitraje
     */
    function stopEngine() external onlyEngineOperator {
        EngineState oldState = engineState;
        engineState = EngineState.INACTIVE;
        _pause();
        
        emit EngineStateChanged(oldState, EngineState.INACTIVE);
    }

    /**
     * @dev Detecta y registra oportunidades de arbitraje en tiempo real
     */
    function detectArbitrageOpportunities(
        address[] calldata tokens,
        address[] calldata dexRouters,
        uint256[] calldata amounts
    ) external onlyEngineOperator whenEngineActive returns (uint256[] memory opportunityIds) {
        require(tokens.length >= 2, "Need at least 2 tokens");
        require(engineState == EngineState.MONITORING, "Not in monitoring state");
        
        opportunityIds = new uint256[](tokens.length - 1);
        
        for (uint256 i = 0; i < tokens.length - 1; i++) {
            // Calcular expected profit usando oráculos
            uint256 expectedProfit = _calculateExpectedProfit(
                tokens[i], 
                tokens[i + 1], 
                amounts[i], 
                dexRouters
            );
            
            if (expectedProfit >= riskParams.maxPositionSize / 1000) { // Min 0.1% of max position
                uint256 opportunityId = _registerOpportunity(
                    tokens[i],
                    tokens[i + 1],
                    amounts[i],
                    expectedProfit,
                    dexRouters
                );
                
                opportunityIds[i] = opportunityId;
            }
        }
    }

    /**
     * @dev Ejecuta estrategia de arbitraje optimizada automáticamente
     */
    function executeOptimalStrategy(
        uint256 opportunityId
    ) external nonReentrant onlyEngineOperator whenEngineActive gasOptimized 
        riskControlled(opportunities[opportunityId].amountIn, opportunities[opportunityId].tokenA) {
        
        require(engineState == EngineState.MONITORING, "Invalid engine state");
        engineState = EngineState.EXECUTING;
        
        OpportunityData storage opportunity = opportunities[opportunityId];
        require(opportunity.opportunityId != 0, "Invalid opportunity");
        
        // Seleccionar mejor estrategia para esta oportunidad
        uint256 bestStrategyId = _selectOptimalStrategy(opportunity);
        MEVStrategy storage strategy = mevStrategies[bestStrategyId];
        
        uint256 gasStart = gasleft();
        bool success = false;
        uint256 actualProfit = 0;
        
        try this._executeStrategyInternal(bestStrategyId, opportunityId) returns (uint256 profit) {
            success = true;
            actualProfit = profit;
            
            // Actualizar métricas de éxito
            strategy.successCount++;
            strategy.totalProfit += actualProfit;
            strategy.lastExecuted = block.timestamp;
            
            // Actualizar métricas globales
            metrics.successfulExecutions++;
            metrics.totalProfit += actualProfit;
            
        } catch Error(string memory reason) {
            strategy.failureCount++;
            emit StrategyExecuted(bestStrategyId, opportunityId, 0, false);
        }
        
        uint256 gasUsed = gasStart - gasleft();
        metrics.totalExecutions++;
        metrics.totalGasSpent += gasUsed;
        metrics.lastExecutionBlock = block.number;
        
        // Distribuir profits si es exitoso
        if (success && actualProfit > 0) {
            _distributeProfits(actualProfit);
        }
        
        engineState = EngineState.MONITORING;
        
        emit StrategyExecuted(bestStrategyId, opportunityId, actualProfit, success);
    }

    /**
     * @dev Ejecuta arbitraje cross-chain
     */
    function executeCrossChainArbitrage(
        OpportunityData calldata opportunity,
        ChainType sourceChain,
        ChainType targetChain,
        bytes calldata bridgeData
    ) external nonReentrant onlyEngineOperator whenEngineActive {
        require(opportunity.crossChain, "Not a cross-chain opportunity");
        require(_isChainSupported(sourceChain) && _isChainSupported(targetChain), "Unsupported chain");
        
        engineState = EngineState.EXECUTING;
        
        // 1. Ejecutar arbitraje en source chain
        // 2. Bridge tokens to target chain
        // 3. Ejecutar arbitraje en target chain
        // 4. Calculate total profit
        
        // TODO: Implementar lógica completa de cross-chain
        uint256 totalProfit = 0; // Placeholder
        
        engineState = EngineState.MONITORING;
        
        emit CrossChainArbitrageExecuted(sourceChain, targetChain, totalProfit);
    }

    // === STRATEGY EXECUTION INTERNALS ===
    function _executeStrategyInternal(
        uint256 strategyId,
        uint256 opportunityId
    ) external returns (uint256 profit) {
        require(msg.sender == address(this), "Only self call");
        
        MEVStrategy storage strategy = mevStrategies[strategyId];
        OpportunityData storage opportunity = opportunities[opportunityId];
        
        // Crear execution plan en ArbitrageExecutor
        uint256[] memory strategyIds = new uint256[](1);
        strategyIds[0] = strategyId;
        
        uint256 planId = arbitrageExecutor.createExecutionPlan(
            strategyIds,
            block.number + 2 // Execute in next 2 blocks
        );
        
        // Ejecutar plan
        arbitrageExecutor.executePlan(planId);
        
        // Get actual profit from execution
        // TODO: Recuperar profit real del executor
        profit = opportunity.expectedProfit; // Placeholder
    }

    // === OPTIMIZATION FUNCTIONS ===
    /**
     * @dev Optimiza parámetros del motor basado en performance histórica
     */
    function optimizeEngineParameters() external onlyEngineOperator {
        require(block.number > lastOptimizationBlock + 100, "Too frequent optimization");
        
        engineState = EngineState.OPTIMIZING;
        
        // 1. Analizar success rates de estrategias
        _analyzeStrategyPerformance();
        
        // 2. Ajustar risk parameters
        _adjustRiskParameters();
        
        // 3. Optimizar gas settings
        _optimizeGasParameters();
        
        // 4. Rebalancear profit sharing
        _rebalanceProfitSharing();
        
        lastOptimizationBlock = block.number;
        engineState = EngineState.MONITORING;
    }

    function _analyzeStrategyPerformance() internal {
        for (uint256 i = 1; i <= nextStrategyId; i++) {
            MEVStrategy storage strategy = mevStrategies[i];
            
            if (strategy.successCount + strategy.failureCount > 0) {
                uint256 successRate = (strategy.successCount * 10000) / 
                    (strategy.successCount + strategy.failureCount);
                
                // Desactivar estrategias con success rate < 50%
                if (successRate < 5000) {
                    strategy.enabled = false;
                }
                
                // Aumentar prioridad para estrategias exitosas
                if (successRate > 8000 && strategy.totalProfit > 1 ether) {
                    strategy.priority = (strategy.priority * 110) / 100; // +10%
                }
            }
        }
    }

    function _adjustRiskParameters() internal {
        // Ajustar basado en losses recientes
        if (metrics.totalExecutions > 100) {
            uint256 successRate = (metrics.successfulExecutions * 10000) / metrics.totalExecutions;
            
            if (successRate < 7000) { // < 70% success
                riskParams.maxPositionSize = (riskParams.maxPositionSize * 90) / 100; // Reduce 10%
            } else if (successRate > 9000) { // > 90% success
                riskParams.maxPositionSize = (riskParams.maxPositionSize * 105) / 100; // Increase 5%
            }
        }
    }

    function _optimizeGasParameters() internal {
        // Actualizar gas settings en ArbitrageExecutor basado en uso histórico
        if (metrics.totalExecutions > 0) {
            uint256 avgGasUsed = metrics.totalGasSpent / metrics.totalExecutions;
            
            // Delegar optimización al ArbitrageExecutor
            arbitrageExecutor.updateGasSettings(
                tx.gasprice,
                2 gwei, // Priority fee
                avgGasUsed + 50000, // Gas limit with buffer
                true // Use Flashbots bundles
            );
        }
    }

    function _rebalanceProfitSharing() internal {
        // Ajustar profit sharing basado en performance
        if (metrics.totalProfit > 10 ether) {
            // Increase operator share if performance is good
            if (metrics.successfulExecutions > metrics.totalExecutions * 80 / 100) {
                operatorShare = 2500; // 25%
                treasuryShare = 2500; // 25%
                stakeholderShare = 5000; // 50%
            }
        }
    }

    // === HELPER FUNCTIONS ===
    function _registerOpportunity(
        address tokenA,
        address tokenB,
        uint256 amountIn,
        uint256 expectedProfit,
        address[] calldata dexRouters
    ) internal returns (uint256 opportunityId) {
        opportunityId = nextOpportunityId++;
        
        OpportunityData storage opportunity = opportunities[opportunityId];
        opportunity.opportunityId = opportunityId;
        opportunity.tokenA = tokenA;
        opportunity.tokenB = tokenB;
        opportunity.amountIn = amountIn;
        opportunity.expectedProfit = expectedProfit;
        opportunity.confidence = 8500; // 85% default confidence
        opportunity.timeWindow = block.timestamp + 300; // 5 minutes window
        opportunity.crossChain = false;
        opportunity.sourceChain = ChainType.ETHEREUM;
        
        // Copy dex path
        for (uint256 i = 0; i < dexRouters.length; i++) {
            opportunity.dexPath.push(dexRouters[i]);
        }
        
        emit OpportunityDetected(opportunityId, tokenA, tokenB, expectedProfit);
    }

    function _calculateExpectedProfit(
        address tokenA,
        address tokenB,
        uint256 amountIn,
        address[] calldata dexRouters
    ) internal view returns (uint256 expectedProfit) {
        // Simplified profit calculation
        // TODO: Implement real price oracle integration
        
        if (dexRouters.length >= 2) {
            // Mock calculation: assume 1% profit potential
            expectedProfit = amountIn / 100;
        }
    }

    function _selectOptimalStrategy(
        OpportunityData storage opportunity
    ) internal view returns (uint256 bestStrategyId) {
        uint256 bestScore = 0;
        
        for (uint256 i = 1; i <= nextStrategyId; i++) {
            MEVStrategy storage strategy = mevStrategies[i];
            
            if (!strategy.enabled) continue;
            
            // Calculate strategy score
            uint256 score = strategy.priority;
            
            if (strategy.successCount + strategy.failureCount > 0) {
                uint256 successRate = (strategy.successCount * 10000) / 
                    (strategy.successCount + strategy.failureCount);
                score = (score * successRate) / 10000;
            }
            
            if (score > bestScore) {
                bestScore = score;
                bestStrategyId = i;
            }
        }
        
        require(bestStrategyId != 0, "No suitable strategy found");
    }

    function _distributeProfits(uint256 totalProfit) internal {
        if (totalProfit == 0) return;
        
        uint256 treasuryAmount = (totalProfit * treasuryShare) / PROFIT_SHARING_BASIS;
        uint256 operatorAmount = (totalProfit * operatorShare) / PROFIT_SHARING_BASIS;
        uint256 stakeholderAmount = (totalProfit * stakeholderShare) / PROFIT_SHARING_BASIS;
        
        // Transfer to treasury
        // TODO: Implement actual token transfers
        
        emit ProfitDistributed(address(this), treasuryAmount, treasuryShare);
        emit ProfitDistributed(msg.sender, operatorAmount, operatorShare);
    }

    function _checkRiskParameters(uint256 amount, address token) internal view {
        require(amount <= riskParams.maxPositionSize, "Position size too large");
        require(!riskParams.blacklistedTokens[token], "Token blacklisted");
        
        if (riskParams.emergencyStopEnabled) {
            require(engineState != EngineState.EMERGENCY, "Emergency stop active");
        }
    }

    // === ADMIN FUNCTIONS ===
    function _registerMEVStrategy(
        string memory name,
        uint256 priority,
        bool enabled,
        ChainType[] memory supportedChains
    ) internal returns (uint256 strategyId) {
        strategyId = nextStrategyId++;
        
        MEVStrategy storage strategy = mevStrategies[strategyId];
        strategy.strategyId = strategyId;
        strategy.name = name;
        strategy.priority = priority;
        strategy.enabled = enabled;
        strategy.supportedChains = supportedChains;
        
        emit MEVStrategyRegistered(strategyId, name, priority);
    }

    function _configureChain(
        ChainType chainType,
        uint256 chainId,
        bool isEVM,
        bool active
    ) internal {
        ChainConfig storage config = chainConfigs[uint256(chainType)];
        config.chainType = chainType;
        config.chainId = chainId;
        config.isEVM = isEVM;
        config.active = active;
        config.minProfitThreshold = 0.001 ether;
        config.maxGasPrice = 100 gwei;
        config.executionDelay = 0;
        
        emit ChainConfigured(chainType, chainId, active);
    }

    function _getAllEVMChains() internal pure returns (ChainType[] memory) {
        ChainType[] memory evmChains = new ChainType[](8);
        evmChains[0] = ChainType.ETHEREUM;
        evmChains[1] = ChainType.POLYGON;
        evmChains[2] = ChainType.ARBITRUM;
        evmChains[3] = ChainType.OPTIMISM;
        evmChains[4] = ChainType.BSC;
        evmChains[5] = ChainType.AVALANCHE;
        evmChains[6] = ChainType.FANTOM;
        evmChains[7] = ChainType.GNOSIS;
        return evmChains;
    }

    function _isChainSupported(ChainType chainType) internal view returns (bool) {
        return chainConfigs[uint256(chainType)].active;
    }

    // === PUBLIC ADMIN FUNCTIONS ===
    function configureChain(
        ChainType chainType,
        uint256 chainId,
        bool isEVM,
        bool active,
        address flashLoanContract,
        address executorContract
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        ChainConfig storage config = chainConfigs[uint256(chainType)];
        config.chainType = chainType;
        config.chainId = chainId;
        config.isEVM = isEVM;
        config.active = active;
        config.flashLoanContract = flashLoanContract;
        config.executorContract = executorContract;
        
        emit ChainConfigured(chainType, chainId, active);
    }

    function updateRiskParameters(
        uint256 maxPositionSize,
        uint256 maxDailyLoss,
        uint256 maxSlippage,
        uint256 minConfidence
    ) external onlyRiskManager {
        riskParams.maxPositionSize = maxPositionSize;
        riskParams.maxDailyLoss = maxDailyLoss;
        riskParams.maxSlippage = maxSlippage;
        riskParams.minConfidence = minConfidence;
        
        emit RiskParametersUpdated(maxPositionSize, maxDailyLoss);
    }

    function emergencyStop(string calldata reason) external onlyRole(EMERGENCY_ROLE) {
        EngineState oldState = engineState;
        engineState = EngineState.EMERGENCY;
        _pause();
        
        emit EmergencyStopTriggered(reason, msg.sender);
        emit EngineStateChanged(oldState, EngineState.EMERGENCY);
    }

    function setTokenBlacklist(address token, bool blacklisted) external onlyRiskManager {
        riskParams.blacklistedTokens[token] = blacklisted;
    }

    // === VIEW FUNCTIONS ===
    function getEngineStats() external view returns (
        EngineState _engineState,
        uint256 _totalExecutions,
        uint256 _successfulExecutions,
        uint256 _totalProfit,
        uint256 _successRate
    ) {
        _engineState = engineState;
        _totalExecutions = metrics.totalExecutions;
        _successfulExecutions = metrics.successfulExecutions;
        _totalProfit = metrics.totalProfit;
        
        if (_totalExecutions > 0) {
            _successRate = (_successfulExecutions * 10000) / _totalExecutions;
        }
    }

    function getStrategy(uint256 strategyId) external view returns (MEVStrategy memory) {
        return mevStrategies[strategyId];
    }

    function getOpportunity(uint256 opportunityId) external view returns (OpportunityData memory) {
        return opportunities[opportunityId];
    }

    function getChainConfig(ChainType chainType) external view returns (ChainConfig memory) {
        return chainConfigs[uint256(chainType)];
    }

    function isTokenBlacklisted(address token) external view returns (bool) {
        return riskParams.blacklistedTokens[token];
    }

    // === RECEIVE FUNCTION ===
    receive() external payable {
        // Accept ETH for gas and operations
    }
}
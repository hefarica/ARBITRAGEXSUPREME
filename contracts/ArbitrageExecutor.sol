// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./interfaces/IFlashLoanProvider.sol";
import "./interfaces/IDEXRouter.sol";
import "./UniversalFlashLoanArbitrage.sol";

/**
 * @title ArbitrageExecutor
 * @dev Coordinador inteligente para ejecución optimizada de arbitrajes
 * @notice Gestiona múltiples estrategias MEV y optimiza gas/profit
 * 
 * ArbitrageX Supreme V3.0 - Execution Engine
 * Gas Optimization + Strategy Selection + MEV Protection
 */
contract ArbitrageExecutor is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using Address for address;

    // === ROLES ===
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant STRATEGY_ROLE = keccak256("STRATEGY_ROLE");
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");

    // === CONSTANTS ===
    uint256 public constant MAX_STRATEGIES_PER_BLOCK = 10;
    uint256 public constant GAS_OPTIMIZATION_THRESHOLD = 200000;
    uint256 public constant MEV_PROTECTION_DELAY = 1; // 1 block delay
    uint256 public constant SLIPPAGE_PROTECTION = 500; // 5%

    // === ENUMS ===
    enum StrategyType {
        CLASSIC_ARBITRAGE,      // 0: DEX-to-DEX básico
        TRIANGULAR_ARBITRAGE,   // 1: Arbitraje triangular
        FLASH_LIQUIDATION,      // 2: Liquidaciones con flash loan
        MEV_SANDWICH,           // 3: Sandwich attacks
        MEV_BACKRUN,           // 4: Backrunning
        CROSS_CHAIN_ARBITRAGE,  // 5: Cross-chain arbitrage
        JIT_LIQUIDITY,         // 6: Just-in-time liquidity
        STATISTICAL_ARBITRAGE   // 7: Arbitraje estadístico
    }

    enum ExecutionStatus {
        PENDING,
        EXECUTING,
        COMPLETED,
        FAILED,
        CANCELLED
    }

    // === STRUCTS ===
    struct Strategy {
        uint256 id;
        StrategyType strategyType;
        address targetContract;
        bytes callData;
        uint256 expectedProfit;
        uint256 gasLimit;
        uint256 priority;
        bool active;
        uint256 successRate;
        uint256 avgGasUsed;
    }

    struct ExecutionPlan {
        uint256 planId;
        Strategy[] strategies;
        uint256 totalExpectedProfit;
        uint256 totalGasLimit;
        uint256 blockTarget;
        ExecutionStatus status;
        address initiator;
        uint256 createdAt;
    }

    struct MEVProtection {
        bool enabled;
        uint256 maxPriorityFee;
        uint256 maxBaseFee;
        address[] allowedRelayers;
        bytes32[] bundleHashes;
    }

    struct GasOptimization {
        uint256 baseGasPrice;
        uint256 priorityFee;
        uint256 gasLimit;
        bool useFlashbotsBundle;
        bytes32 bundleHash;
    }

    // === STATE VARIABLES ===
    UniversalFlashLoanArbitrage public immutable flashLoanArbitrage;
    
    mapping(uint256 => Strategy) public strategies;
    mapping(uint256 => ExecutionPlan) public executionPlans;
    mapping(address => bool) public authorizedRelayers;
    mapping(bytes32 => bool) public processedBundles;
    
    uint256 public nextStrategyId;
    uint256 public nextPlanId;
    uint256 public strategiesExecutedThisBlock;
    uint256 public lastExecutionBlock;
    
    MEVProtection public mevProtection;
    GasOptimization public gasSettings;
    
    bool public emergencyStop;
    uint256 public totalExecutions;
    uint256 public totalProfits;
    uint256 public totalGasSpent;

    // === EVENTS ===
    event StrategyRegistered(
        uint256 indexed strategyId,
        StrategyType strategyType,
        address targetContract,
        uint256 expectedProfit
    );

    event ExecutionPlanCreated(
        uint256 indexed planId,
        address indexed initiator,
        uint256 strategiesCount,
        uint256 totalExpectedProfit
    );

    event ExecutionCompleted(
        uint256 indexed planId,
        uint256 strategiesExecuted,
        uint256 actualProfit,
        uint256 gasUsed,
        bool success
    );

    event MEVProtectionUpdated(
        bool enabled,
        uint256 maxPriorityFee,
        uint256 maxBaseFee
    );

    event EmergencyStop(bool activated, address triggeredBy);

    // === MODIFIERS ===
    modifier onlyOperator() {
        require(hasRole(OPERATOR_ROLE, msg.sender), "Not authorized operator");
        _;
    }

    modifier onlyStrategy() {
        require(hasRole(STRATEGY_ROLE, msg.sender), "Not authorized strategy");
        _;
    }

    modifier whenNotStopped() {
        require(!emergencyStop, "Emergency stop activated");
        _;
    }

    modifier gasOptimized() {
        uint256 gasStart = gasleft();
        _;
        uint256 gasUsed = gasStart - gasleft();
        _updateGasStats(gasUsed);
    }

    modifier mevProtected() {
        if (mevProtection.enabled) {
            _checkMEVProtection();
        }
        _;
    }

    // === CONSTRUCTOR ===
    constructor(
        address admin,
        address _flashLoanArbitrage
    ) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
        _grantRole(STRATEGY_ROLE, admin);
        _grantRole(EMERGENCY_ROLE, admin);
        
        flashLoanArbitrage = UniversalFlashLoanArbitrage(_flashLoanArbitrage);
        
        // Default gas settings
        gasSettings = GasOptimization({
            baseGasPrice: 20 gwei,
            priorityFee: 2 gwei,
            gasLimit: 300000,
            useFlashbotsBundle: false,
            bundleHash: bytes32(0)
        });
        
        // Default MEV protection
        mevProtection = MEVProtection({
            enabled: true,
            maxPriorityFee: 100 gwei,
            maxBaseFee: 1000 gwei,
            allowedRelayers: new address[](0),
            bundleHashes: new bytes32[](0)
        });
    }

    // === STRATEGY MANAGEMENT ===
    /**
     * @dev Registra nueva estrategia de arbitraje
     */
    function registerStrategy(
        StrategyType strategyType,
        address targetContract,
        bytes calldata callData,
        uint256 expectedProfit,
        uint256 gasLimit,
        uint256 priority
    ) external onlyStrategy returns (uint256 strategyId) {
        require(targetContract != address(0), "Invalid target contract");
        require(expectedProfit > 0, "Expected profit must be > 0");
        require(gasLimit > 0 && gasLimit <= 1000000, "Invalid gas limit");
        
        strategyId = nextStrategyId++;
        
        strategies[strategyId] = Strategy({
            id: strategyId,
            strategyType: strategyType,
            targetContract: targetContract,
            callData: callData,
            expectedProfit: expectedProfit,
            gasLimit: gasLimit,
            priority: priority,
            active: true,
            successRate: 1000, // 100% inicial (basis points)
            avgGasUsed: gasLimit
        });
        
        emit StrategyRegistered(strategyId, strategyType, targetContract, expectedProfit);
    }

    /**
     * @dev Crea plan de ejecución optimizado
     */
    function createExecutionPlan(
        uint256[] calldata strategyIds,
        uint256 blockTarget
    ) external onlyOperator whenNotStopped returns (uint256 planId) {
        require(strategyIds.length > 0, "No strategies provided");
        require(strategyIds.length <= MAX_STRATEGIES_PER_BLOCK, "Too many strategies");
        require(blockTarget >= block.number, "Invalid block target");
        
        planId = nextPlanId++;
        ExecutionPlan storage plan = executionPlans[planId];
        
        plan.planId = planId;
        plan.blockTarget = blockTarget;
        plan.status = ExecutionStatus.PENDING;
        plan.initiator = msg.sender;
        plan.createdAt = block.timestamp;
        
        uint256 totalProfit = 0;
        uint256 totalGas = 0;
        
        // Validar y agregar estrategias al plan
        for (uint256 i = 0; i < strategyIds.length; i++) {
            Strategy storage strategy = strategies[strategyIds[i]];
            require(strategy.active, "Inactive strategy");
            
            plan.strategies.push(strategy);
            totalProfit += strategy.expectedProfit;
            totalGas += strategy.gasLimit;
        }
        
        plan.totalExpectedProfit = totalProfit;
        plan.totalGasLimit = totalGas;
        
        emit ExecutionPlanCreated(planId, msg.sender, strategyIds.length, totalProfit);
    }

    // === EXECUTION ENGINE ===
    /**
     * @dev Ejecuta plan de arbitraje con optimizaciones avanzadas
     */
    function executePlan(
        uint256 planId
    ) external nonReentrant onlyOperator whenNotStopped gasOptimized mevProtected {
        ExecutionPlan storage plan = executionPlans[planId];
        
        require(plan.status == ExecutionStatus.PENDING, "Plan not pending");
        require(plan.blockTarget <= block.number + 5, "Block target too far");
        require(_canExecuteInCurrentBlock(), "Block execution limit reached");
        
        plan.status = ExecutionStatus.EXECUTING;
        
        uint256 actualProfit = 0;
        uint256 gasUsed = 0;
        uint256 successfulStrategies = 0;
        bool overallSuccess = true;
        
        // Ejecutar estrategias en orden de prioridad
        Strategy[] memory sortedStrategies = _sortStrategiesByPriority(plan.strategies);
        
        for (uint256 i = 0; i < sortedStrategies.length; i++) {
            Strategy memory strategy = sortedStrategies[i];
            
            try this._executeStrategy(strategy) returns (uint256 profit, uint256 gas) {
                actualProfit += profit;
                gasUsed += gas;
                successfulStrategies++;
                
                // Actualizar estadísticas de la estrategia
                _updateStrategyStats(strategy.id, true, gas);
                
            } catch Error(string memory reason) {
                _updateStrategyStats(strategy.id, false, strategy.gasLimit);
                overallSuccess = false;
                
                // Log error pero continuar con siguientes estrategias
                emit ExecutionCompleted(planId, i, 0, 0, false);
            }
        }
        
        // Finalizar ejecución
        plan.status = overallSuccess ? ExecutionStatus.COMPLETED : ExecutionStatus.FAILED;
        
        // Actualizar estadísticas globales
        totalExecutions++;
        totalProfits += actualProfit;
        totalGasSpent += gasUsed;
        strategiesExecutedThisBlock++;
        lastExecutionBlock = block.number;
        
        emit ExecutionCompleted(planId, successfulStrategies, actualProfit, gasUsed, overallSuccess);
    }

    /**
     * @dev Ejecuta estrategia individual con manejo de errores
     */
    function _executeStrategy(
        Strategy memory strategy
    ) external returns (uint256 profit, uint256 gasUsed) {
        require(msg.sender == address(this), "Only self call");
        
        uint256 gasStart = gasleft();
        
        // Ejecutar estrategia específica según tipo
        if (strategy.strategyType == StrategyType.CLASSIC_ARBITRAGE) {
            profit = _executeClassicArbitrage(strategy);
        } else if (strategy.strategyType == StrategyType.TRIANGULAR_ARBITRAGE) {
            profit = _executeTriangularArbitrage(strategy);
        } else if (strategy.strategyType == StrategyType.FLASH_LIQUIDATION) {
            profit = _executeFlashLiquidation(strategy);
        } else if (strategy.strategyType == StrategyType.MEV_SANDWICH) {
            profit = _executeMEVSandwich(strategy);
        } else if (strategy.strategyType == StrategyType.MEV_BACKRUN) {
            profit = _executeMEVBackrun(strategy);
        } else {
            revert("Unsupported strategy type");
        }
        
        gasUsed = gasStart - gasleft();
        require(profit >= strategy.expectedProfit * 80 / 100, "Profit below threshold"); // 80% threshold
    }

    // === STRATEGY IMPLEMENTATIONS ===
    function _executeClassicArbitrage(Strategy memory strategy) internal returns (uint256 profit) {
        // Delegar al contrato UniversalFlashLoanArbitrage
        (bool success, bytes memory result) = strategy.targetContract.call{gas: strategy.gasLimit}(strategy.callData);
        require(success, "Classic arbitrage failed");
        
        // Decodificar profit del resultado
        if (result.length >= 32) {
            profit = abi.decode(result, (uint256));
        }
    }

    function _executeTriangularArbitrage(Strategy memory strategy) internal returns (uint256 profit) {
        // Implementar arbitraje triangular optimizado
        (bool success, bytes memory result) = strategy.targetContract.call{gas: strategy.gasLimit}(strategy.callData);
        require(success, "Triangular arbitrage failed");
        
        if (result.length >= 32) {
            profit = abi.decode(result, (uint256));
        }
    }

    function _executeFlashLiquidation(Strategy memory strategy) internal returns (uint256 profit) {
        // Implementar liquidaciones con flash loans
        (bool success, bytes memory result) = strategy.targetContract.call{gas: strategy.gasLimit}(strategy.callData);
        require(success, "Flash liquidation failed");
        
        if (result.length >= 32) {
            profit = abi.decode(result, (uint256));
        }
    }

    function _executeMEVSandwich(Strategy memory strategy) internal returns (uint256 profit) {
        // Implementar sandwich attacks protegidos
        require(mevProtection.enabled, "MEV protection required");
        
        (bool success, bytes memory result) = strategy.targetContract.call{gas: strategy.gasLimit}(strategy.callData);
        require(success, "MEV sandwich failed");
        
        if (result.length >= 32) {
            profit = abi.decode(result, (uint256));
        }
    }

    function _executeMEVBackrun(Strategy memory strategy) internal returns (uint256 profit) {
        // Implementar backrunning optimizado
        (bool success, bytes memory result) = strategy.targetContract.call{gas: strategy.gasLimit}(strategy.callData);
        require(success, "MEV backrun failed");
        
        if (result.length >= 32) {
            profit = abi.decode(result, (uint256));
        }
    }

    // === OPTIMIZATION FUNCTIONS ===
    function _sortStrategiesByPriority(
        Strategy[] memory strategies
    ) internal pure returns (Strategy[] memory) {
        // Implementar ordenamiento por prioridad + expected profit
        // Por simplicidad, retornamos el array original
        // TODO: Implementar algoritmo de ordenamiento optimizado
        return strategies;
    }

    function _canExecuteInCurrentBlock() internal view returns (bool) {
        if (lastExecutionBlock < block.number) {
            return true; // Nuevo bloque, reset counter
        }
        return strategiesExecutedThisBlock < MAX_STRATEGIES_PER_BLOCK;
    }

    function _updateStrategyStats(uint256 strategyId, bool success, uint256 gasUsed) internal {
        Strategy storage strategy = strategies[strategyId];
        
        // Actualizar success rate (weighted average)
        uint256 newRate = success ? 1000 : 0; // 100% or 0%
        strategy.successRate = (strategy.successRate * 9 + newRate) / 10; // EMA
        
        // Actualizar gas promedio
        strategy.avgGasUsed = (strategy.avgGasUsed * 9 + gasUsed) / 10; // EMA
    }

    function _updateGasStats(uint256 gasUsed) internal {
        // Actualizar configuración de gas basada en uso histórico
        if (gasUsed > gasSettings.gasLimit * 120 / 100) { // 20% over limit
            gasSettings.gasLimit = gasUsed * 110 / 100; // Increase by 10%
        }
    }

    // === MEV PROTECTION ===
    function _checkMEVProtection() internal view {
        require(tx.gasprice <= mevProtection.maxBaseFee + mevProtection.maxPriorityFee, "Gas price too high");
        
        // Verificar si viene de relayer autorizado (para bundles)
        if (mevProtection.allowedRelayers.length > 0) {
            bool authorized = false;
            for (uint256 i = 0; i < mevProtection.allowedRelayers.length; i++) {
                if (tx.origin == mevProtection.allowedRelayers[i]) {
                    authorized = true;
                    break;
                }
            }
            require(authorized, "Unauthorized relayer");
        }
    }

    // === ADMIN FUNCTIONS ===
    function updateStrategy(
        uint256 strategyId,
        bool active,
        uint256 priority
    ) external onlyRole(STRATEGY_ROLE) {
        Strategy storage strategy = strategies[strategyId];
        require(strategy.id == strategyId, "Strategy not found");
        
        strategy.active = active;
        strategy.priority = priority;
    }

    function updateMEVProtection(
        bool enabled,
        uint256 maxPriorityFee,
        uint256 maxBaseFee,
        address[] calldata allowedRelayers
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        mevProtection.enabled = enabled;
        mevProtection.maxPriorityFee = maxPriorityFee;
        mevProtection.maxBaseFee = maxBaseFee;
        
        // Actualizar relayers autorizados
        delete mevProtection.allowedRelayers;
        for (uint256 i = 0; i < allowedRelayers.length; i++) {
            mevProtection.allowedRelayers.push(allowedRelayers[i]);
        }
        
        emit MEVProtectionUpdated(enabled, maxPriorityFee, maxBaseFee);
    }

    function updateGasSettings(
        uint256 baseGasPrice,
        uint256 priorityFee,
        uint256 gasLimit,
        bool useFlashbotsBundle
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        gasSettings.baseGasPrice = baseGasPrice;
        gasSettings.priorityFee = priorityFee;
        gasSettings.gasLimit = gasLimit;
        gasSettings.useFlashbotsBundle = useFlashbotsBundle;
    }

    function emergencyStopToggle() external onlyRole(EMERGENCY_ROLE) {
        emergencyStop = !emergencyStop;
        emit EmergencyStop(emergencyStop, msg.sender);
    }

    function cancelExecutionPlan(uint256 planId) external onlyOperator {
        ExecutionPlan storage plan = executionPlans[planId];
        require(plan.status == ExecutionStatus.PENDING, "Cannot cancel non-pending plan");
        require(plan.initiator == msg.sender || hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Not authorized");
        
        plan.status = ExecutionStatus.CANCELLED;
    }

    // === VIEW FUNCTIONS ===
    function getStrategy(uint256 strategyId) external view returns (Strategy memory) {
        return strategies[strategyId];
    }

    function getExecutionPlan(uint256 planId) external view returns (ExecutionPlan memory) {
        return executionPlans[planId];
    }

    function getContractStats() external view returns (
        uint256 _totalExecutions,
        uint256 _totalProfits,
        uint256 _totalGasSpent,
        bool _emergencyStop
    ) {
        return (totalExecutions, totalProfits, totalGasSpent, emergencyStop);
    }

    function getMEVProtectionSettings() external view returns (MEVProtection memory) {
        return mevProtection;
    }

    function getGasSettings() external view returns (GasOptimization memory) {
        return gasSettings;
    }

    // === RECEIVE FUNCTION ===
    receive() external payable {
        // Aceptar ETH para pagar gas fees
    }
}
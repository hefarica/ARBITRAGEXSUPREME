// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IFlashLoanProvider.sol";
import "./providers/AaveV3FlashLoanProvider.sol";
import "./providers/BalancerV2FlashLoanProvider.sol";
import "./providers/CompoundV3FlashLoanProvider.sol";

/**
 * @title FlashLoanAggregator
 * @dev Agregador inteligente para flash loans multiplataforma
 * @notice Selecciona automáticamente el mejor proveedor según costo, liquidez y confiabilidad
 * 
 * ArbitrageX Supreme V3.0 - Flash Loan Orchestrator
 * Auto-Selection + Fee Optimization + Fallback System
 */
contract FlashLoanAggregator is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // === ROLES ===
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
    bytes32 public constant PROVIDER_MANAGER_ROLE = keccak256("PROVIDER_MANAGER_ROLE");

    // === ENUMS ===
    enum ProviderType {
        AAVE_V3,        // 0
        BALANCER_V2,    // 1
        COMPOUND_V3,    // 2
        CUSTOM          // 3
    }

    enum SelectionCriteria {
        LOWEST_FEE,     // 0: Seleccionar por menor fee
        HIGHEST_LIQUIDITY, // 1: Seleccionar por mayor liquidez
        FASTEST_EXECUTION, // 2: Seleccionar por velocidad
        BALANCED        // 3: Balanceado (fee + liquidez + confiabilidad)
    }

    // === STRUCTS ===
    struct ProviderConfig {
        ProviderType providerType;
        IFlashLoanProvider provider;
        bool active;
        uint256 priority;
        uint256 successRate;      // Basis points (10000 = 100%)
        uint256 avgGasUsed;
        uint256 totalExecutions;
        uint256 totalFailed;
        uint256 lastExecuted;
        string name;
    }

    struct FlashLoanQuote {
        ProviderType providerType;
        address providerAddress;
        uint256 fee;
        uint256 maxAmount;
        uint256 estimatedGas;
        uint256 score;
        bool available;
    }

    struct ExecutionResult {
        bool success;
        ProviderType usedProvider;
        uint256 actualFee;
        uint256 gasUsed;
        string errorReason;
    }

    // === STATE VARIABLES ===
    mapping(ProviderType => ProviderConfig) public providers;
    mapping(address => ProviderType) public providerAddresses;
    
    SelectionCriteria public defaultSelectionCriteria = SelectionCriteria.BALANCED;
    uint256 public totalExecutions;
    uint256 public totalSuccessful;
    bool public paused;
    
    // Fallback system
    ProviderType[] public fallbackOrder;
    uint256 public maxFallbackAttempts = 3;
    
    // Performance tracking
    mapping(ProviderType => uint256) public providerScores;
    uint256 public lastScoreUpdate;
    uint256 public scoreUpdateInterval = 1 hours;

    // === EVENTS ===
    event ProviderRegistered(
        ProviderType indexed providerType,
        address indexed providerAddress,
        string name
    );
    
    event FlashLoanExecuted(
        ProviderType indexed providerType,
        address indexed asset,
        uint256 amount,
        uint256 fee,
        uint256 gasUsed,
        bool success
    );
    
    event ProviderSelected(
        ProviderType indexed providerType,
        address indexed asset,
        uint256 amount,
        SelectionCriteria criteria,
        uint256 score
    );
    
    event FallbackTriggered(
        ProviderType failedProvider,
        ProviderType fallbackProvider,
        string reason
    );
    
    event ProviderScoresUpdated(uint256 timestamp);

    // === MODIFIERS ===
    modifier onlyExecutor() {
        require(hasRole(EXECUTOR_ROLE, msg.sender), "Not authorized executor");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "Aggregator paused");
        _;
    }

    // === CONSTRUCTOR ===
    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(EXECUTOR_ROLE, admin);
        _grantRole(PROVIDER_MANAGER_ROLE, admin);
        
        // Initialize fallback order (Balancer V2 first due to 0% fees)
        fallbackOrder = [
            ProviderType.BALANCER_V2,
            ProviderType.COMPOUND_V3,
            ProviderType.AAVE_V3
        ];
    }

    // === PROVIDER MANAGEMENT ===
    /**
     * @dev Registra un proveedor de flash loans
     */
    function registerProvider(
        ProviderType providerType,
        address providerAddress,
        string calldata name,
        uint256 priority
    ) external onlyRole(PROVIDER_MANAGER_ROLE) {
        require(providerAddress != address(0), "Invalid provider address");
        
        providers[providerType] = ProviderConfig({
            providerType: providerType,
            provider: IFlashLoanProvider(providerAddress),
            active: true,
            priority: priority,
            successRate: 10000, // 100% inicial
            avgGasUsed: 300000, // Estimación inicial
            totalExecutions: 0,
            totalFailed: 0,
            lastExecuted: 0,
            name: name
        });
        
        providerAddresses[providerAddress] = providerType;
        
        emit ProviderRegistered(providerType, providerAddress, name);
    }

    /**
     * @dev Ejecuta flash loan con selección automática de proveedor
     */
    function executeOptimalFlashLoan(
        address asset,
        uint256 amount,
        bytes calldata params,
        SelectionCriteria criteria
    ) external onlyExecutor whenNotPaused nonReentrant returns (ExecutionResult memory result) {
        require(amount > 0, "Invalid amount");
        
        // 1. Obtener quotes de todos los proveedores
        FlashLoanQuote[] memory quotes = _getAllQuotes(asset, amount);
        require(quotes.length > 0, "No providers available");
        
        // 2. Seleccionar mejor proveedor
        FlashLoanQuote memory bestQuote = _selectBestProvider(quotes, criteria);
        require(bestQuote.available, "No suitable provider found");
        
        emit ProviderSelected(bestQuote.providerType, asset, amount, criteria, bestQuote.score);
        
        // 3. Ejecutar flash loan con fallback
        result = _executeWithFallback(asset, amount, params, bestQuote.providerType);
        
        // 4. Actualizar estadísticas
        _updateProviderStats(result.usedProvider, result.success, result.gasUsed);
        
        totalExecutions++;
        if (result.success) {
            totalSuccessful++;
        }
    }

    /**
     * @dev Ejecuta flash loan con proveedor específico
     */
    function executeFlashLoanWithProvider(
        ProviderType providerType,
        address asset,
        uint256 amount,
        bytes calldata params
    ) external onlyExecutor whenNotPaused nonReentrant returns (ExecutionResult memory result) {
        require(providers[providerType].active, "Provider not active");
        
        uint256 gasStart = gasleft();
        
        try providers[providerType].provider.executeFlashLoan(
            IFlashLoanProvider.FlashLoanParams({
                asset: asset,
                amount: amount,
                mode: 0,
                onBehalfOf: msg.sender,
                params: params
            })
        ) {
            uint256 gasUsed = gasStart - gasleft();
            uint256 fee = providers[providerType].provider.calculateFlashLoanFee(asset, amount);
            
            result = ExecutionResult({
                success: true,
                usedProvider: providerType,
                actualFee: fee,
                gasUsed: gasUsed,
                errorReason: ""
            });
            
            emit FlashLoanExecuted(providerType, asset, amount, fee, gasUsed, true);
            
        } catch Error(string memory reason) {
            result = ExecutionResult({
                success: false,
                usedProvider: providerType,
                actualFee: 0,
                gasUsed: gasStart - gasleft(),
                errorReason: reason
            });
            
            emit FlashLoanExecuted(providerType, asset, amount, 0, 0, false);
        }
        
        _updateProviderStats(providerType, result.success, result.gasUsed);
    }

    // === SELECTION ALGORITHM ===
    /**
     * @dev Obtiene quotes de todos los proveedores disponibles
     */
    function _getAllQuotes(
        address asset,
        uint256 amount
    ) internal view returns (FlashLoanQuote[] memory quotes) {
        uint256 activeProviders = 0;
        
        // Contar proveedores activos
        for (uint256 i = 0; i < 4; i++) {
            ProviderType pType = ProviderType(i);
            if (providers[pType].active && _isProviderAvailable(pType, asset, amount)) {
                activeProviders++;
            }
        }
        
        quotes = new FlashLoanQuote[](activeProviders);
        uint256 quoteIndex = 0;
        
        // Generar quotes
        for (uint256 i = 0; i < 4; i++) {
            ProviderType pType = ProviderType(i);
            if (providers[pType].active && _isProviderAvailable(pType, asset, amount)) {
                quotes[quoteIndex] = _generateQuote(pType, asset, amount);
                quoteIndex++;
            }
        }
    }

    /**
     * @dev Genera quote para un proveedor específico
     */
    function _generateQuote(
        ProviderType providerType,
        address asset,
        uint256 amount
    ) internal view returns (FlashLoanQuote memory quote) {
        ProviderConfig memory config = providers[providerType];
        
        uint256 fee = 0;
        uint256 maxAmount = 0;
        bool available = false;
        
        try config.provider.calculateFlashLoanFee(asset, amount) returns (uint256 _fee) {
            fee = _fee;
            try config.provider.getMaxFlashLoanAmount(asset) returns (uint256 _maxAmount) {
                maxAmount = _maxAmount;
                available = _maxAmount >= amount;
            } catch {
                available = false;
            }
        } catch {
            available = false;
        }
        
        uint256 score = _calculateProviderScore(providerType, fee, maxAmount, amount);
        
        quote = FlashLoanQuote({
            providerType: providerType,
            providerAddress: address(config.provider),
            fee: fee,
            maxAmount: maxAmount,
            estimatedGas: config.avgGasUsed,
            score: score,
            available: available
        });
    }

    /**
     * @dev Calcula score del proveedor para selección
     */
    function _calculateProviderScore(
        ProviderType providerType,
        uint256 fee,
        uint256 maxAmount,
        uint256 requestedAmount
    ) internal view returns (uint256 score) {
        ProviderConfig memory config = providers[providerType];
        
        // Factores del score (0-10000)
        uint256 feeScore = fee == 0 ? 10000 : (10000 * 1e18) / (fee + 1e18); // Menor fee = mayor score
        uint256 liquidityScore = maxAmount >= requestedAmount ? 10000 : (maxAmount * 10000) / requestedAmount;
        uint256 reliabilityScore = config.successRate; // Ya en basis points
        uint256 priorityScore = config.priority * 100; // Convert to basis points
        
        // Weighted average
        score = (feeScore * 30 + liquidityScore * 25 + reliabilityScore * 35 + priorityScore * 10) / 100;
    }

    /**
     * @dev Selecciona mejor proveedor según criterio
     */
    function _selectBestProvider(
        FlashLoanQuote[] memory quotes,
        SelectionCriteria criteria
    ) internal pure returns (FlashLoanQuote memory bestQuote) {
        require(quotes.length > 0, "No quotes available");
        
        uint256 bestIndex = 0;
        uint256 bestValue = 0;
        
        for (uint256 i = 0; i < quotes.length; i++) {
            if (!quotes[i].available) continue;
            
            uint256 value;
            
            if (criteria == SelectionCriteria.LOWEST_FEE) {
                value = quotes[i].fee == 0 ? type(uint256).max : type(uint256).max - quotes[i].fee;
            } else if (criteria == SelectionCriteria.HIGHEST_LIQUIDITY) {
                value = quotes[i].maxAmount;
            } else if (criteria == SelectionCriteria.FASTEST_EXECUTION) {
                value = quotes[i].estimatedGas == 0 ? type(uint256).max : type(uint256).max - quotes[i].estimatedGas;
            } else { // BALANCED
                value = quotes[i].score;
            }
            
            if (i == 0 || value > bestValue) {
                bestValue = value;
                bestIndex = i;
            }
        }
        
        bestQuote = quotes[bestIndex];
    }

    /**
     * @dev Ejecuta con sistema de fallback
     */
    function _executeWithFallback(
        address asset,
        uint256 amount,
        bytes calldata params,
        ProviderType primaryProvider
    ) internal returns (ExecutionResult memory result) {
        // Intentar con proveedor principal
        result = _executeSingle(primaryProvider, asset, amount, params);
        
        if (result.success) {
            return result;
        }
        
        // Fallback automático
        uint256 attempts = 0;
        for (uint256 i = 0; i < fallbackOrder.length && attempts < maxFallbackAttempts; i++) {
            ProviderType fallbackProvider = fallbackOrder[i];
            
            if (fallbackProvider == primaryProvider) continue;
            if (!providers[fallbackProvider].active) continue;
            
            emit FallbackTriggered(primaryProvider, fallbackProvider, result.errorReason);
            
            result = _executeSingle(fallbackProvider, asset, amount, params);
            attempts++;
            
            if (result.success) {
                break;
            }
        }
        
        return result;
    }

    /**
     * @dev Ejecuta flash loan en un proveedor específico
     */
    function _executeSingle(
        ProviderType providerType,
        address asset,
        uint256 amount,
        bytes calldata params
    ) internal returns (ExecutionResult memory result) {
        if (!providers[providerType].active) {
            return ExecutionResult({
                success: false,
                usedProvider: providerType,
                actualFee: 0,
                gasUsed: 0,
                errorReason: "Provider not active"
            });
        }
        
        uint256 gasStart = gasleft();
        
        try providers[providerType].provider.executeFlashLoan(
            IFlashLoanProvider.FlashLoanParams({
                asset: asset,
                amount: amount,
                mode: 0,
                onBehalfOf: msg.sender,
                params: params
            })
        ) {
            uint256 gasUsed = gasStart - gasleft();
            uint256 fee = providers[providerType].provider.calculateFlashLoanFee(asset, amount);
            
            result = ExecutionResult({
                success: true,
                usedProvider: providerType,
                actualFee: fee,
                gasUsed: gasUsed,
                errorReason: ""
            });
            
            emit FlashLoanExecuted(providerType, asset, amount, fee, gasUsed, true);
            
        } catch Error(string memory reason) {
            result = ExecutionResult({
                success: false,
                usedProvider: providerType,
                actualFee: 0,
                gasUsed: gasStart - gasleft(),
                errorReason: reason
            });
        }
    }

    // === HELPER FUNCTIONS ===
    function _isProviderAvailable(
        ProviderType providerType,
        address asset,
        uint256 amount
    ) internal view returns (bool) {
        if (!providers[providerType].active) return false;
        
        try providers[providerType].provider.isAssetSupported(asset) returns (bool supported) {
            if (!supported) return false;
            
            try providers[providerType].provider.getMaxFlashLoanAmount(asset) returns (uint256 maxAmount) {
                return maxAmount >= amount;
            } catch {
                return false;
            }
        } catch {
            return false;
        }
    }

    function _updateProviderStats(
        ProviderType providerType,
        bool success,
        uint256 gasUsed
    ) internal {
        ProviderConfig storage config = providers[providerType];
        
        config.totalExecutions++;
        config.lastExecuted = block.timestamp;
        
        if (!success) {
            config.totalFailed++;
        }
        
        // Update success rate (EMA)
        uint256 newSuccessRate = success ? 10000 : 0;
        config.successRate = (config.successRate * 9 + newSuccessRate) / 10;
        
        // Update average gas used (EMA)
        config.avgGasUsed = (config.avgGasUsed * 9 + gasUsed) / 10;
    }

    // === ADMIN FUNCTIONS ===
    function setProviderActive(
        ProviderType providerType,
        bool active
    ) external onlyRole(PROVIDER_MANAGER_ROLE) {
        providers[providerType].active = active;
    }

    function updateProviderPriority(
        ProviderType providerType,
        uint256 priority
    ) external onlyRole(PROVIDER_MANAGER_ROLE) {
        providers[providerType].priority = priority;
    }

    function updateFallbackOrder(
        ProviderType[] calldata newOrder
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newOrder.length > 0, "Empty fallback order");
        fallbackOrder = newOrder;
    }

    function setDefaultSelectionCriteria(
        SelectionCriteria criteria
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        defaultSelectionCriteria = criteria;
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        paused = true;
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        paused = false;
    }

    // === VIEW FUNCTIONS ===
    function getProviderInfo(ProviderType providerType) external view returns (ProviderConfig memory) {
        return providers[providerType];
    }

    function getBestQuote(
        address asset,
        uint256 amount,
        SelectionCriteria criteria
    ) external view returns (FlashLoanQuote memory) {
        FlashLoanQuote[] memory quotes = _getAllQuotes(asset, amount);
        return _selectBestProvider(quotes, criteria);
    }

    function getAllQuotes(
        address asset,
        uint256 amount
    ) external view returns (FlashLoanQuote[] memory) {
        return _getAllQuotes(asset, amount);
    }

    function getAggregatorStats() external view returns (
        uint256 _totalExecutions,
        uint256 _totalSuccessful,
        uint256 successRate,
        bool _paused
    ) {
        successRate = totalExecutions > 0 ? (totalSuccessful * 10000) / totalExecutions : 0;
        return (totalExecutions, totalSuccessful, successRate, paused);
    }

    function getFallbackOrder() external view returns (ProviderType[] memory) {
        return fallbackOrder;
    }
}
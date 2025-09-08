// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../interfaces/IArbitrageExecutor.sol";

/**
 * @title HybridBridge
 * @dev Puente crítico entre Backend JavaScript y Smart Contracts Solidity
 * @notice Sistema híbrido que combina detección JS con ejecución Solidity
 */
contract HybridBridge is ReentrancyGuard, AccessControl {
    
    bytes32 public constant BACKEND_ROLE = keccak256("BACKEND_ROLE");
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    // Mapping de contratos de arbitraje por blockchain
    mapping(uint256 => address) public arbitrageExecutors; // chainId => executor
    mapping(address => bool) public authorizedBackends;
    mapping(bytes32 => bool) public processedOpportunities;
    
    // Configuración del sistema híbrido
    struct HybridConfig {
        uint256 minProfitThreshold;
        uint256 maxGasPrice;
        uint256 executionTimeout;
        bool isActive;
    }
    
    mapping(uint256 => HybridConfig) public chainConfigs;

    // Estructura para oportunidades detectadas por JavaScript
    struct JSOpportunity {
        bytes32 opportunityId;
        uint256 chainId;
        address tokenA;
        address tokenB;
        address tokenC; // Para triangular
        uint256 amountIn;
        uint256 expectedProfit;
        uint256 confidence;
        string strategy; // "simple", "triangular", "flash_loan"
        bytes routeData;
        uint256 deadline;
        bytes signature; // Firma del backend
    }

    // Estructura para resultados de ejecución
    struct ExecutionReport {
        bytes32 opportunityId;
        uint256 chainId;
        bool success;
        uint256 actualProfit;
        uint256 gasUsed;
        uint256 executionTime;
        string errorMessage;
        address executor;
    }

    // Events para comunicación JS ↔ Solidity
    event OpportunityReceived(
        bytes32 indexed opportunityId,
        uint256 indexed chainId,
        address indexed tokenA,
        address tokenB,
        uint256 amountIn,
        string strategy
    );

    event ExecutionStarted(
        bytes32 indexed opportunityId,
        uint256 indexed chainId,
        address executor,
        uint256 timestamp
    );

    event ExecutionCompleted(
        bytes32 indexed opportunityId,
        uint256 indexed chainId,
        bool success,
        uint256 actualProfit,
        uint256 gasUsed
    );

    event BackendHealthCheck(
        address indexed backend,
        uint256 timestamp,
        bool isHealthy
    );

    event ConfigurationUpdated(
        uint256 indexed chainId,
        string parameter,
        uint256 newValue
    );

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(BACKEND_ROLE, msg.sender);
        _grantRole(EXECUTOR_ROLE, msg.sender);
    }

    /**
     * @dev Recibe oportunidad detectada por el backend JavaScript
     */
    function submitOpportunity(
        JSOpportunity calldata opportunity
    ) external onlyRole(BACKEND_ROLE) nonReentrant returns (bool accepted) {
        
        // Validar oportunidad
        require(!processedOpportunities[opportunity.opportunityId], "Already processed");
        require(opportunity.deadline > block.timestamp, "Expired opportunity");
        require(chainConfigs[opportunity.chainId].isActive, "Chain not active");
        require(opportunity.expectedProfit >= chainConfigs[opportunity.chainId].minProfitThreshold, "Profit too low");
        
        // Validar firma del backend
        require(_validateBackendSignature(opportunity), "Invalid signature");

        // Marcar como procesada
        processedOpportunities[opportunity.opportunityId] = true;

        emit OpportunityReceived(
            opportunity.opportunityId,
            opportunity.chainId,
            opportunity.tokenA,
            opportunity.tokenB,
            opportunity.amountIn,
            opportunity.strategy
        );

        // Auto-ejecutar si cumple criterios
        if (_shouldAutoExecute(opportunity)) {
            return _executeOpportunity(opportunity);
        }

        return true;
    }

    /**
     * @dev Ejecuta oportunidad en el contrato de arbitraje específico
     */
    function executeOpportunity(
        bytes32 opportunityId,
        JSOpportunity calldata opportunity
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant returns (bool success) {
        
        require(processedOpportunities[opportunityId], "Opportunity not submitted");
        require(opportunity.deadline > block.timestamp, "Expired");
        
        emit ExecutionStarted(opportunityId, opportunity.chainId, msg.sender, block.timestamp);

        return _executeOpportunity(opportunity);
    }

    /**
     * @dev Ejecuta batch de oportunidades para máxima eficiencia
     */
    function executeBatchOpportunities(
        JSOpportunity[] calldata opportunities
    ) external onlyRole(EXECUTOR_ROLE) nonReentrant returns (
        uint256 successCount,
        uint256 totalProfit
    ) {
        
        require(opportunities.length <= 10, "Batch too large");
        
        for (uint256 i = 0; i < opportunities.length; i++) {
            JSOpportunity memory opp = opportunities[i];
            
            // Validaciones básicas
            if (processedOpportunities[opp.opportunityId] || 
                opp.deadline <= block.timestamp ||
                !chainConfigs[opp.chainId].isActive) {
                continue;
            }

            processedOpportunities[opp.opportunityId] = true;
            
            bool success = _executeOpportunity(opp);
            if (success) {
                successCount++;
                // totalProfit sería calculado del resultado real
            }
        }
    }

    /**
     * @dev Reporte de health check del backend JavaScript
     */
    function backendHealthCheck(
        uint256[] calldata chainIds,
        uint256[] calldata blockNumbers,
        bytes32[] calldata lastOpportunities
    ) external onlyRole(BACKEND_ROLE) {
        
        require(chainIds.length == blockNumbers.length, "Array mismatch");
        
        bool isHealthy = true;
        
        // Validar que el backend esté sincronizado
        for (uint256 i = 0; i < chainIds.length; i++) {
            // En producción, validar que blockNumbers sean recientes
            if (blockNumbers[i] == 0) {
                isHealthy = false;
                break;
            }
        }

        emit BackendHealthCheck(msg.sender, block.timestamp, isHealthy);
    }

    /**
     * @dev Callback para reportes de ejecución desde contratos de arbitraje
     */
    function reportExecution(
        bytes32 opportunityId,
        ExecutionReport calldata report
    ) external {
        
        // Validar que el caller sea un executor autorizado
        require(arbitrageExecutors[report.chainId] == msg.sender, "Unauthorized reporter");

        emit ExecutionCompleted(
            opportunityId,
            report.chainId,
            report.success,
            report.actualProfit,
            report.gasUsed
        );

        // Opcional: guardar estadísticas para analytics
        _updateExecutionStats(report);
    }

    // ============ INTERNAL FUNCTIONS ============

    function _executeOpportunity(
        JSOpportunity memory opportunity
    ) internal returns (bool success) {
        
        address executor = arbitrageExecutors[opportunity.chainId];
        require(executor != address(0), "No executor for chain");

        uint256 gasBefore = gasleft();
        
        try IArbitrageExecutor(executor).executeArbitrage{
            value: msg.value,
            gas: gasleft() - 50000 // Reserve gas
        }(
            _convertToArbitrageParams(opportunity),
            _convertToSwapRoutes(opportunity)
        ) returns (IArbitrageExecutor.ExecutionResult memory result) {
            
            uint256 gasUsed = gasBefore - gasleft();
            
            emit ExecutionCompleted(
                opportunity.opportunityId,
                opportunity.chainId,
                result.success,
                result.profit,
                gasUsed
            );

            return result.success;

        } catch Error(string memory reason) {
            
            emit ExecutionCompleted(
                opportunity.opportunityId,
                opportunity.chainId,
                false,
                0,
                gasBefore - gasleft()
            );

            return false;
        }
    }

    function _shouldAutoExecute(
        JSOpportunity memory opportunity
    ) internal view returns (bool) {
        
        HybridConfig memory config = chainConfigs[opportunity.chainId];
        
        // Auto-ejecutar si:
        // 1. Profit > 2x threshold
        // 2. Confidence > 90%
        // 3. Strategy es simple (menos riesgo)
        return opportunity.expectedProfit >= (config.minProfitThreshold * 2) &&
               opportunity.confidence >= 90 &&
               keccak256(bytes(opportunity.strategy)) == keccak256("simple");
    }

    function _validateBackendSignature(
        JSOpportunity memory opportunity
    ) internal view returns (bool) {
        
        // Crear hash de la oportunidad
        bytes32 messageHash = keccak256(abi.encode(
            opportunity.opportunityId,
            opportunity.chainId,
            opportunity.tokenA,
            opportunity.tokenB,
            opportunity.amountIn,
            opportunity.expectedProfit,
            opportunity.deadline
        ));

        // En producción, usar ECDSA para validar firma
        // Por ahora, validación simplificada
        return opportunity.signature.length > 0;
    }

    function _convertToArbitrageParams(
        JSOpportunity memory opportunity
    ) internal pure returns (IArbitrageExecutor.ArbitrageParams memory params) {
        
        params = IArbitrageExecutor.ArbitrageParams({
            tokenA: opportunity.tokenA,
            tokenB: opportunity.tokenB,
            tokenC: opportunity.tokenC,
            amountIn: opportunity.amountIn,
            minAmountOut: 0, // Será calculado
            maxGasPrice: 0, // Usar configuración del chain
            deadline: uint32(opportunity.deadline),
            routeData: opportunity.routeData,
            useFlashLoan: keccak256(bytes(opportunity.strategy)) == keccak256("flash_loan"),
            flashLoanProvider: address(0) // Será auto-seleccionado
        });
    }

    function _convertToSwapRoutes(
        JSOpportunity memory opportunity
    ) internal pure returns (IArbitrageExecutor.SwapRoute[] memory routes) {
        
        // Decodificar routeData del backend JavaScript
        if (opportunity.routeData.length > 0) {
            routes = abi.decode(opportunity.routeData, (IArbitrageExecutor.SwapRoute[]));
        } else {
            // Crear ruta básica
            routes = new IArbitrageExecutor.SwapRoute[](2);
            
            routes[0] = IArbitrageExecutor.SwapRoute({
                dex: address(0), // Será auto-seleccionado
                tokenIn: opportunity.tokenA,
                tokenOut: opportunity.tokenB,
                amountIn: opportunity.amountIn,
                minAmountOut: 0,
                fee: 3000, // 0.3% default
                extraData: ""
            });

            routes[1] = IArbitrageExecutor.SwapRoute({
                dex: address(0),
                tokenIn: opportunity.tokenB,
                tokenOut: opportunity.tokenA,
                amountIn: 0,
                minAmountOut: 0,
                fee: 3000,
                extraData: ""
            });
        }
    }

    function _updateExecutionStats(
        ExecutionReport memory report
    ) internal {
        // Implementar estadísticas para analytics
        // Puede incluir: success rate, profit promedio, gas usage, etc.
    }

    // ============ ADMIN FUNCTIONS ============

    function setArbitrageExecutor(
        uint256 chainId,
        address executor
    ) external onlyRole(ADMIN_ROLE) {
        require(executor != address(0), "Invalid executor");
        arbitrageExecutors[chainId] = executor;
    }

    function setChainConfig(
        uint256 chainId,
        HybridConfig calldata config
    ) external onlyRole(ADMIN_ROLE) {
        chainConfigs[chainId] = config;
        
        emit ConfigurationUpdated(chainId, "minProfitThreshold", config.minProfitThreshold);
        emit ConfigurationUpdated(chainId, "maxGasPrice", config.maxGasPrice);
    }

    function authorizeBackend(
        address backend,
        bool authorized
    ) external onlyRole(ADMIN_ROLE) {
        authorizedBackends[backend] = authorized;
        
        if (authorized) {
            _grantRole(BACKEND_ROLE, backend);
        } else {
            _revokeRole(BACKEND_ROLE, backend);
        }
    }

    function authorizeExecutor(
        address executor,
        bool authorized
    ) external onlyRole(ADMIN_ROLE) {
        if (authorized) {
            _grantRole(EXECUTOR_ROLE, executor);
        } else {
            _revokeRole(EXECUTOR_ROLE, executor);
        }
    }

    // ============ VIEW FUNCTIONS ============

    function getChainConfig(uint256 chainId) external view returns (HybridConfig memory) {
        return chainConfigs[chainId];
    }

    function isOpportunityProcessed(bytes32 opportunityId) external view returns (bool) {
        return processedOpportunities[opportunityId];
    }

    function getExecutorForChain(uint256 chainId) external view returns (address) {
        return arbitrageExecutors[chainId];
    }

    function isBackendAuthorized(address backend) external view returns (bool) {
        return hasRole(BACKEND_ROLE, backend);
    }

    function getSupportedChains() external view returns (uint256[] memory chains) {
        // En producción, mantener lista de chains activos
        chains = new uint256[](4);
        chains[0] = 1;    // Ethereum
        chains[1] = 137;  // Polygon
        chains[2] = 56;   // BSC
        chains[3] = 42161; // Arbitrum
        // ... más chains
    }

    // ============ EMERGENCY FUNCTIONS ============

    function emergencyPause(uint256 chainId) external onlyRole(ADMIN_ROLE) {
        chainConfigs[chainId].isActive = false;
    }

    function emergencyResume(uint256 chainId) external onlyRole(ADMIN_ROLE) {
        chainConfigs[chainId].isActive = true;
    }

    function emergencyWithdraw(
        address token,
        uint256 amount,
        address to
    ) external onlyRole(ADMIN_ROLE) {
        if (token == address(0)) {
            payable(to).transfer(amount);
        } else {
            IERC20(token).transfer(to, amount);
        }
    }

    receive() external payable {
        // Allow contract to receive ETH for gas payments
    }
}
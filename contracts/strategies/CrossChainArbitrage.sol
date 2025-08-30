// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IArbitrageStrategy.sol";
import "../interfaces/ICrossChainBridge.sol";
import "../interfaces/ILayerZeroReceiver.sol";
import "../libraries/PriceUtils.sol";
import "../libraries/SafeMath.sol";

/**
 * @title CrossChainArbitrage
 * @dev Implementa arbitraje cross-chain entre diferentes blockchains
 * Utiliza bridges y protocolos de interoperabilidad como LayerZero, Wormhole, etc.
 * Permite aprovechar diferencias de precio entre assets en diferentes chains
 */
contract CrossChainArbitrage is 
    IArbitrageStrategy, 
    ILayerZeroReceiver,
    ReentrancyGuard, 
    Pausable, 
    Ownable 
{
    using SafeERC20 for IERC20;
    using PriceUtils for uint256;
    using SafeMath for uint256;

    // ==================== ESTRUCTURAS Y ENUMS ====================

    enum BridgeType { LAYER_ZERO, WORMHOLE, ANYSWAP, CBRIDGE, SYNAPSE }
    enum ArbitragePhase { PENDING, BRIDGE_INITIATED, BRIDGE_COMPLETED, ARBITRAGE_EXECUTED, FINALIZED }

    struct CrossChainParams {
        uint16 sourceChainId;        // Chain ID origen
        uint16 targetChainId;        // Chain ID destino
        address sourceToken;         // Token en chain origen
        address targetToken;         // Token en chain destino
        address sourceDEX;          // DEX en chain origen
        address targetDEX;          // DEX en chain destino
        uint256 amountIn;           // Cantidad inicial
        uint256 minProfitBPS;       // Ganancia mínima en basis points
        BridgeType bridgeType;      // Tipo de bridge a usar
        bytes bridgeData;           // Datos específicos del bridge
        bytes swapDataSource;       // Datos de swap en origen
        bytes swapDataTarget;       // Datos de swap en destino
        uint256 bridgeFee;          // Fee estimado del bridge
        uint256 gasLimit;           // Gas limit para operación remota
        uint256 deadline;           // Timestamp límite
    }

    struct ArbitrageExecution {
        bytes32 executionId;        // ID único de ejecución
        address initiator;          // Quien inició el arbitraje
        CrossChainParams params;    // Parámetros de la ejecución
        ArbitragePhase phase;       // Fase actual
        uint256 amountBridged;      // Cantidad enviada por bridge
        uint256 amountReceived;     // Cantidad recibida en destino
        uint256 finalProfit;        // Ganancia final calculada
        uint256 timestamp;          // Timestamp de inicio
        bool completed;             // Si está completado
    }

    struct ChainConfig {
        bool isActive;              // Si la chain está activa
        address endpoint;           // LayerZero endpoint
        address wormholeCore;       // Wormhole core contract
        address anyswapRouter;      // Anyswap router
        address cbridgeRouter;      // CBridge router
        address synapseRouter;      // Synapse router
        uint256 minGasLimit;        // Mínimo gas para operaciones remotas
        uint256 maxBridgeAmount;    // Máximo monto para bridge
        uint256 bridgeFeeBPS;       // Fee del bridge en basis points
    }

    // ==================== VARIABLES DE ESTADO ====================

    mapping(uint16 => ChainConfig) public chainConfigs;
    mapping(bytes32 => ArbitrageExecution) public executions;
    mapping(address => bool) public authorizedBridges;
    mapping(uint16 => mapping(address => address)) public tokenMappings; // chainId => sourceToken => targetToken
    
    uint256 public constant MAX_SLIPPAGE = 1000;     // 10% máximo slippage cross-chain
    uint256 public constant MIN_PROFIT_BPS = 100;   // 1% mínimo profit
    uint256 public executionFee = 100;              // 1% fee de ejecución
    uint256 public maxExecutionTime = 3600;         // 1 hora máximo
    
    address public layerZeroEndpoint;
    address public profitReceiver;
    bytes32 public nextExecutionId;

    // ==================== EVENTOS ====================

    event CrossChainArbitrageInitiated(
        bytes32 indexed executionId,
        address indexed initiator,
        uint16 sourceChain,
        uint16 targetChain,
        address sourceToken,
        uint256 amount,
        BridgeType bridgeType
    );

    event BridgeCompleted(
        bytes32 indexed executionId,
        uint256 amountBridged,
        uint256 amountReceived,
        uint16 fromChain
    );

    event CrossChainArbitrageCompleted(
        bytes32 indexed executionId,
        uint256 totalProfit,
        uint256 executionTime,
        bool success
    );

    event ChainConfigUpdated(uint16 indexed chainId, bool isActive);
    event TokenMappingSet(uint16 indexed chainId, address sourceToken, address targetToken);
    event BridgeAuthorized(address indexed bridge, bool authorized);

    // ==================== CONSTRUCTOR ====================

    constructor(
        address _layerZeroEndpoint,
        address _profitReceiver
    ) {
        layerZeroEndpoint = _layerZeroEndpoint;
        profitReceiver = _profitReceiver;
        nextExecutionId = keccak256(abi.encodePacked(block.timestamp, msg.sender));
    }

    // ==================== FUNCIONES PRINCIPALES ====================

    /**
     * @dev Inicia arbitraje cross-chain
     */
    function execute(bytes calldata data) external override nonReentrant whenNotPaused returns (bool success, uint256 profit) {
        CrossChainParams memory params = abi.decode(data, (CrossChainParams));
        
        require(params.deadline >= block.timestamp, "CrossChain: Deadline expired");
        require(chainConfigs[params.sourceChainId].isActive, "CrossChain: Source chain not active");
        require(chainConfigs[params.targetChainId].isActive, "CrossChain: Target chain not active");
        require(params.minProfitBPS >= MIN_PROFIT_BPS, "CrossChain: Insufficient min profit");

        bytes32 executionId = _generateExecutionId();
        
        // Verificar balance y precio antes de ejecutar
        uint256 sourceBalance = IERC20(params.sourceToken).balanceOf(address(this));
        require(sourceBalance >= params.amountIn, "CrossChain: Insufficient balance");

        // Simular arbitraje para verificar rentabilidad
        (bool canExecute, uint256 estimatedProfit) = _simulateCrossChainArbitrage(params);
        require(canExecute, "CrossChain: Arbitrage not profitable");

        // Crear registro de ejecución
        executions[executionId] = ArbitrageExecution({
            executionId: executionId,
            initiator: msg.sender,
            params: params,
            phase: ArbitragePhase.PENDING,
            amountBridged: 0,
            amountReceived: 0,
            finalProfit: 0,
            timestamp: block.timestamp,
            completed: false
        });

        // Iniciar bridge según el tipo especificado
        bool bridgeSuccess = _initiateBridge(executionId, params);
        
        if (bridgeSuccess) {
            executions[executionId].phase = ArbitragePhase.BRIDGE_INITIATED;
            
            emit CrossChainArbitrageInitiated(
                executionId,
                msg.sender,
                params.sourceChainId,
                params.targetChainId,
                params.sourceToken,
                params.amountIn,
                params.bridgeType
            );
            
            return (true, estimatedProfit);
        }

        return (false, 0);
    }

    /**
     * @dev Callback de LayerZero para recibir tokens cross-chain
     */
    function lzReceive(
        uint16 _srcChainId,
        bytes memory _srcAddress,
        uint64 _nonce,
        bytes memory _payload
    ) external override {
        require(msg.sender == layerZeroEndpoint, "CrossChain: Invalid endpoint");
        
        (bytes32 executionId, uint256 amountReceived) = abi.decode(_payload, (bytes32, uint256));
        
        ArbitrageExecution storage execution = executions[executionId];
        require(execution.phase == ArbitragePhase.BRIDGE_INITIATED, "CrossChain: Invalid phase");

        execution.amountReceived = amountReceived;
        execution.phase = ArbitragePhase.BRIDGE_COMPLETED;

        emit BridgeCompleted(executionId, execution.amountBridged, amountReceived, _srcChainId);

        // Ejecutar arbitraje en chain destino
        _executeTargetChainArbitrage(executionId);
    }

    /**
     * @dev Completa el arbitraje en el chain destino
     */
    function _executeTargetChainArbitrage(bytes32 executionId) internal {
        ArbitrageExecution storage execution = executions[executionId];
        CrossChainParams memory params = execution.params;
        
        require(execution.phase == ArbitragePhase.BRIDGE_COMPLETED, "CrossChain: Bridge not completed");

        try this._performTargetSwap(
            params.targetToken,
            params.targetDEX,
            execution.amountReceived,
            params.swapDataTarget
        ) returns (uint256 swapOutput) {
            
            // Calcular ganancia después del swap
            uint256 totalCost = params.amountIn.add(params.bridgeFee);
            
            if (swapOutput > totalCost) {
                execution.finalProfit = swapOutput.sub(totalCost);
                execution.phase = ArbitragePhase.ARBITRAGE_EXECUTED;
                
                _handleCrossChainProfit(params.sourceToken, execution.finalProfit);
                _finalizeCrossChainArbitrage(executionId, true);
            } else {
                _finalizeCrossChainArbitrage(executionId, false);
            }
            
        } catch {
            _finalizeCrossChainArbitrage(executionId, false);
        }
    }

    /**
     * @dev Simula arbitraje cross-chain
     */
    function simulate(bytes calldata data) external view override returns (bool canExecute, uint256 estimatedProfit) {
        CrossChainParams memory params = abi.decode(data, (CrossChainParams));
        return _simulateCrossChainArbitrage(params);
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
            "Cross-Chain Arbitrage",
            "Cross-chain arbitrage leveraging price differences between different blockchains"
        );
    }

    // ==================== FUNCIONES INTERNAS ====================

    /**
     * @dev Simula arbitraje cross-chain completo
     */
    function _simulateCrossChainArbitrage(CrossChainParams memory params) 
        internal 
        view 
        returns (bool canExecute, uint256 estimatedProfit) 
    {
        // Verificar configuraciones de chains
        if (!chainConfigs[params.sourceChainId].isActive || !chainConfigs[params.targetChainId].isActive) {
            return (false, 0);
        }

        // Simular precio en chain origen (si necesario)
        uint256 sourceValue = params.amountIn; // Simplificado
        
        // Restar fees de bridge
        uint256 bridgedAmount = sourceValue.sub(params.bridgeFee);
        
        // Simular swap en chain destino
        uint256 targetValue = _simulateTargetSwap(
            params.targetToken,
            params.targetDEX,
            bridgedAmount
        );

        // Calcular ganancia neta
        uint256 totalCosts = params.amountIn.add(params.bridgeFee);
        
        if (targetValue > totalCosts) {
            estimatedProfit = targetValue.sub(totalCosts);
            uint256 minProfitRequired = params.amountIn.mul(params.minProfitBPS).div(10000);
            canExecute = estimatedProfit >= minProfitRequired;
        }

        return (canExecute, estimatedProfit);
    }

    /**
     * @dev Inicia el bridge según el tipo especificado
     */
    function _initiateBridge(bytes32 executionId, CrossChainParams memory params) internal returns (bool success) {
        executions[executionId].amountBridged = params.amountIn;
        
        if (params.bridgeType == BridgeType.LAYER_ZERO) {
            return _initiateLayerZeroBridge(executionId, params);
        } else if (params.bridgeType == BridgeType.WORMHOLE) {
            return _initiateWormholeBridge(executionId, params);
        } else if (params.bridgeType == BridgeType.ANYSWAP) {
            return _initiateAnyswapBridge(executionId, params);
        }
        
        return false;
    }

    /**
     * @dev Inicia bridge via LayerZero
     */
    function _initiateLayerZeroBridge(bytes32 executionId, CrossChainParams memory params) internal returns (bool) {
        ChainConfig memory targetConfig = chainConfigs[params.targetChainId];
        require(targetConfig.endpoint != address(0), "CrossChain: No LayerZero endpoint");

        bytes memory payload = abi.encode(executionId, params.amountIn);
        bytes memory adapterParams = abi.encodePacked(uint16(1), params.gasLimit);

        // Aprobar tokens al endpoint
        IERC20(params.sourceToken).safeApprove(layerZeroEndpoint, params.amountIn);

        try ILayerZeroEndpoint(layerZeroEndpoint).send{value: params.bridgeFee}(
            params.targetChainId,
            abi.encodePacked(targetConfig.endpoint, address(this)),
            payload,
            payable(address(this)),
            address(0),
            adapterParams
        ) {
            return true;
        } catch {
            return false;
        }
    }

    /**
     * @dev Inicia bridge via Wormhole
     */
    function _initiateWormholeBridge(bytes32 executionId, CrossChainParams memory params) internal returns (bool) {
        // Implementación específica de Wormhole
        // Por ahora retornamos falso, se implementará según necesidades
        return false;
    }

    /**
     * @dev Inicia bridge via Anyswap
     */
    function _initiateAnyswapBridge(bytes32 executionId, CrossChainParams memory params) internal returns (bool) {
        // Implementación específica de Anyswap
        // Por ahora retornamos falso, se implementará según necesidades
        return false;
    }

    /**
     * @dev Ejecuta swap en chain destino
     */
    function _performTargetSwap(
        address token,
        address dex,
        uint256 amountIn,
        bytes memory swapData
    ) external returns (uint256 amountOut) {
        require(msg.sender == address(this), "CrossChain: Internal function");

        uint256 balanceBefore = IERC20(token).balanceOf(address(this));
        
        IERC20(token).safeApprove(dex, amountIn);
        
        (bool success,) = dex.call(swapData);
        require(success, "CrossChain: Target swap failed");
        
        uint256 balanceAfter = IERC20(token).balanceOf(address(this));
        amountOut = balanceAfter.sub(balanceBefore);
        
        return amountOut;
    }

    /**
     * @dev Simula swap en chain destino
     */
    function _simulateTargetSwap(
        address token,
        address dex,
        uint256 amountIn
    ) internal view returns (uint256 amountOut) {
        // Simulación simplificada - en producción llamar a view functions del DEX
        return amountIn.mul(98).div(100); // Asumiendo 2% slippage
    }

    /**
     * @dev Maneja ganancias del arbitraje cross-chain
     */
    function _handleCrossChainProfit(address token, uint256 profit) internal {
        uint256 fee = profit.mul(executionFee).div(10000);
        uint256 netProfit = profit.sub(fee);
        
        if (fee > 0) {
            IERC20(token).safeTransfer(profitReceiver, fee);
        }
    }

    /**
     * @dev Finaliza arbitraje cross-chain
     */
    function _finalizeCrossChainArbitrage(bytes32 executionId, bool success) internal {
        ArbitrageExecution storage execution = executions[executionId];
        
        execution.phase = ArbitragePhase.FINALIZED;
        execution.completed = true;
        
        uint256 executionTime = block.timestamp.sub(execution.timestamp);
        
        emit CrossChainArbitrageCompleted(
            executionId,
            execution.finalProfit,
            executionTime,
            success
        );
    }

    /**
     * @dev Genera ID único para ejecución
     */
    function _generateExecutionId() internal returns (bytes32) {
        bytes32 id = keccak256(abi.encodePacked(
            nextExecutionId,
            block.timestamp,
            msg.sender,
            block.number
        ));
        nextExecutionId = id;
        return id;
    }

    // ==================== FUNCIONES ADMINISTRATIVAS ====================

    /**
     * @dev Configura chain soportado
     */
    function setChainConfig(
        uint16 chainId,
        bool isActive,
        address endpoint,
        address wormholeCore,
        address anyswapRouter,
        address cbridgeRouter,
        address synapseRouter,
        uint256 minGasLimit,
        uint256 maxBridgeAmount,
        uint256 bridgeFeeBPS
    ) external onlyOwner {
        chainConfigs[chainId] = ChainConfig({
            isActive: isActive,
            endpoint: endpoint,
            wormholeCore: wormholeCore,
            anyswapRouter: anyswapRouter,
            cbridgeRouter: cbridgeRouter,
            synapseRouter: synapseRouter,
            minGasLimit: minGasLimit,
            maxBridgeAmount: maxBridgeAmount,
            bridgeFeeBPS: bridgeFeeBPS
        });

        emit ChainConfigUpdated(chainId, isActive);
    }

    /**
     * @dev Mapea tokens entre chains
     */
    function setTokenMapping(
        uint16 chainId,
        address sourceToken,
        address targetToken
    ) external onlyOwner {
        tokenMappings[chainId][sourceToken] = targetToken;
        emit TokenMappingSet(chainId, sourceToken, targetToken);
    }

    /**
     * @dev Autoriza bridge
     */
    function setBridgeAuthorization(address bridge, bool authorized) external onlyOwner {
        authorizedBridges[bridge] = authorized;
        emit BridgeAuthorized(bridge, authorized);
    }

    /**
     * @dev Configura parámetros generales
     */
    function setParameters(
        uint256 _executionFee,
        uint256 _maxExecutionTime,
        address _layerZeroEndpoint,
        address _profitReceiver
    ) external onlyOwner {
        require(_executionFee <= 1000, "CrossChain: Fee too high");
        
        executionFee = _executionFee;
        maxExecutionTime = _maxExecutionTime;
        layerZeroEndpoint = _layerZeroEndpoint;
        profitReceiver = _profitReceiver;
    }

    /**
     * @dev Función de emergencia
     */
    function emergencyPause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Reanudar operaciones
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // ==================== FUNCIONES DE VISTA ====================

    /**
     * @dev Retorna configuración de chain
     */
    function getChainConfig(uint16 chainId) external view returns (ChainConfig memory) {
        return chainConfigs[chainId];
    }

    /**
     * @dev Retorna ejecución por ID
     */
    function getExecution(bytes32 executionId) external view returns (ArbitrageExecution memory) {
        return executions[executionId];
    }

    /**
     * @dev Retorna mapeo de token
     */
    function getTokenMapping(uint16 chainId, address sourceToken) external view returns (address) {
        return tokenMappings[chainId][sourceToken];
    }

    /**
     * @dev Retorna configuración actual
     */
    function getConfiguration() external view returns (
        uint256 _executionFee,
        uint256 _maxExecutionTime,
        address _layerZeroEndpoint,
        address _profitReceiver
    ) {
        return (executionFee, maxExecutionTime, layerZeroEndpoint, profitReceiver);
    }
}

// ==================== INTERFACES ADICIONALES ====================

interface ILayerZeroEndpoint {
    function send(
        uint16 _dstChainId,
        bytes calldata _destination,
        bytes calldata _payload,
        address payable _refundAddress,
        address _zroPaymentAddress,
        bytes calldata _adapterParams
    ) external payable;
}
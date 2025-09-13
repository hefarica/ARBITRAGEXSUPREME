// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IArbitrageStrategy.sol";
import "../interfaces/ISynapseRouter.sol";
import "../interfaces/ILayerZeroReceiver.sol";
import "../libraries/PriceUtils.sol";
import "../libraries/SafeMath.sol";

/**
 * @title S002: CrossL2SynapseArbitrage
 * @dev Implementa arbitraje Cross-L2 usando Synapse Bridge + Flash Loans
 * Estrategia para aprovechar diferencias de precio entre L1 y L2s
 * 
 * Flujo:
 * 1. Detectar price spread L1 vs L2 
 * 2. Flash loan en chain origen
 * 3. Swap to bridge token
 * 4. Bridge via Synapse a chain destino
 * 5. Swap en chain destino  
 * 6. Bridge back + repay flash loan + profit
 */
contract CrossL2SynapseArbitrage is 
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

    enum ArbitragePhase {
        INITIATED,          // Arbitraje iniciado
        BRIDGED_TO_L2,     // Bridged a L2 chain
        SWAPPED_ON_L2,     // Swap ejecutado en L2  
        BRIDGED_BACK,      // Bridged back a L1
        COMPLETED,         // Arbitraje completado
        FAILED             // Arbitraje falló
    }

    enum BridgeDirection {
        L1_TO_L2,          // L1 → L2 (ej: Ethereum → Arbitrum)
        L2_TO_L1,          // L2 → L1 (ej: Arbitrum → Ethereum)
        L2_TO_L2           // L2 → L2 (ej: Arbitrum → Optimism)
    }

    struct ChainConfig {
        uint16 chainId;            // LayerZero chain ID
        address synapseRouter;     // Synapse router en esa chain
        address nativeToken;       // Token nativo (WETH, etc.)
        address[] supportedTokens; // Tokens soportados para bridge
        uint256 minBridgeAmount;   // Cantidad mínima bridge
        uint256 maxBridgeAmount;   // Cantidad máxima bridge
        uint256 bridgeFeeBps;      // Fee bridge en BPS
        uint256 avgBridgeTime;     // Tiempo promedio bridge (segundos)
        bool isActive;            // Chain activa para arbitraje
    }

    struct FlashLoanConfig {
        address provider;          // Flash loan provider (Aave, etc.)
        address asset;            // Asset para flash loan
        uint256 feeBps;           // Fee flash loan en BPS
        uint256 maxAmount;        // Máxima cantidad disponible
        bool isActive;            // Provider activo
    }

    struct ArbitrageParams {
        uint16 sourceChainId;      // Chain ID origen
        uint16 targetChainId;      // Chain ID destino
        address sourceToken;       // Token en chain origen
        address targetToken;       // Token en chain destino
        address bridgeToken;       // Token para bridge (nUSD, etc.)
        uint256 amountIn;         // Cantidad inicial
        uint256 minAmountOut;     // Cantidad mínima esperada
        uint256 maxSlippageBps;   // Slippage máximo en BPS
        uint256 deadline;         // Deadline operación
        BridgeDirection direction; // Dirección del bridge
        bytes bridgeData;         // Datos específicos bridge
        bytes swapDataSource;     // Datos swap en origen
        bytes swapDataTarget;     // Datos swap en destino
    }

    struct ArbitrageState {
        bytes32 routeId;          // ID único de la ruta
        ArbitragePhase phase;     // Fase actual
        address initiator;        // Quien inició el arbitraje
        uint256 timestamp;        // Timestamp inicio
        uint256 flashLoanAmount;  // Cantidad flash loan
        uint256 bridgedAmount;    // Cantidad bridgeada
        uint256 receivedAmount;   // Cantidad recibida en destino
        uint256 finalAmount;      // Cantidad final tras swaps
        uint256 profit;          // Profit calculado
        uint256 gasUsed;         // Gas total usado
        bool isCompleted;        // Completado flag
    }

    // ==================== VARIABLES DE ESTADO ====================

    /// @dev Configuraciones por chain
    mapping(uint16 => ChainConfig) public chainConfigs;
    
    /// @dev Configuraciones flash loan por provider
    mapping(address => FlashLoanConfig) public flashLoanConfigs;
    
    /// @dev Estados de arbitraje activos
    mapping(bytes32 => ArbitrageState) public arbitrageStates;
    
    /// @dev Rutas de arbitraje ejecutándose
    bytes32[] public activeRoutes;
    
    /// @dev Fee del protocolo en basis points
    uint256 public protocolFeeBps = 50; // 0.5%
    
    /// @dev Recipient de protocol fees
    address public feeRecipient;
    
    /// @dev Profit mínimo requerido en BPS
    uint256 public minProfitBps = 100; // 1%
    
    /// @dev Máximo tiempo permitido para completar arbitraje
    uint256 public maxArbitrageTime = 3600; // 1 hora
    
    /// @dev LayerZero endpoint para cross-chain messaging
    address public layerZeroEndpoint;

    // ==================== EVENTOS ====================

    event CrossL2ArbitrageInitiated(
        bytes32 indexed routeId,
        uint16 sourceChainId,
        uint16 targetChainId,
        address sourceToken,
        address targetToken,
        uint256 amountIn,
        address initiator
    );

    event BridgeExecuted(
        bytes32 indexed routeId,
        uint16 fromChain,
        uint16 toChain,
        address token,
        uint256 amount,
        BridgeDirection direction
    );

    event SwapExecuted(
        bytes32 indexed routeId,
        uint16 chainId,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );

    event ArbitrageCompleted(
        bytes32 indexed routeId,
        uint256 totalProfit,
        uint256 protocolFee,
        uint256 userProfit,
        uint256 totalGasUsed,
        address recipient
    );

    event ArbitrageFailed(
        bytes32 indexed routeId,
        ArbitragePhase failedPhase,
        string reason,
        uint256 lossAmount
    );

    event ChainConfigUpdated(
        uint16 indexed chainId,
        address synapseRouter,
        bool isActive
    );

    // ==================== MODIFICADORES ====================

    modifier validChain(uint16 chainId) {
        require(chainConfigs[chainId].isActive, "Chain not supported");
        _;
    }

    modifier validFlashLoanProvider(address provider) {
        require(flashLoanConfigs[provider].isActive, "Flash loan provider inactive");
        _;
    }

    modifier activeRoute(bytes32 routeId) {
        require(arbitrageStates[routeId].phase != ArbitragePhase.COMPLETED, "Route completed");
        require(arbitrageStates[routeId].phase != ArbitragePhase.FAILED, "Route failed");
        _;
    }

    modifier onlyLayerZero() {
        require(msg.sender == layerZeroEndpoint, "Only LayerZero endpoint");
        _;
    }

    // ==================== CONSTRUCTOR ====================

    constructor(
        address _feeRecipient,
        address _layerZeroEndpoint,
        uint256 _protocolFeeBps,
        uint256 _minProfitBps
    ) {
        require(_feeRecipient != address(0), "Invalid fee recipient");
        require(_layerZeroEndpoint != address(0), "Invalid LayerZero endpoint");
        require(_protocolFeeBps <= 1000, "Protocol fee too high"); // max 10%
        require(_minProfitBps >= 50, "Min profit too low"); // min 0.5%

        feeRecipient = _feeRecipient;
        layerZeroEndpoint = _layerZeroEndpoint;
        protocolFeeBps = _protocolFeeBps;
        minProfitBps = _minProfitBps;
    }

    // ==================== FUNCIONES PRINCIPALES ====================

    /**
     * @dev Ejecuta arbitraje cross-L2 usando Synapse bridge
     * @param params Parámetros completos del arbitraje
     */
    function executeCrossL2Arbitrage(ArbitrageParams memory params)
        external
        nonReentrant
        whenNotPaused
        validChain(params.sourceChainId)
        validChain(params.targetChainId)
    {
        require(block.timestamp <= params.deadline, "Deadline expired");
        require(params.amountIn > 0, "Invalid amount");
        require(params.sourceChainId != params.targetChainId, "Same chain arbitrage");

        // Generar route ID único
        bytes32 routeId = _generateRouteId(params, msg.sender);
        
        // Validar profit potencial
        uint256 expectedProfit = calculateExpectedProfit(params);
        require(
            expectedProfit.mulDiv(10000, params.amountIn) >= minProfitBps,
            "Insufficient expected profit"
        );

        // Inicializar estado arbitraje
        arbitrageStates[routeId] = ArbitrageState({
            routeId: routeId,
            phase: ArbitragePhase.INITIATED,
            initiator: msg.sender,
            timestamp: block.timestamp,
            flashLoanAmount: 0,
            bridgedAmount: 0,
            receivedAmount: 0,
            finalAmount: 0,
            profit: 0,
            gasUsed: 0,
            isCompleted: false
        });

        activeRoutes.push(routeId);

        // Iniciar flash loan
        _initiateFlashLoan(routeId, params);

        emit CrossL2ArbitrageInitiated(
            routeId,
            params.sourceChainId,
            params.targetChainId,
            params.sourceToken,
            params.targetToken,
            params.amountIn,
            msg.sender
        );
    }

    /**
     * @dev Calcula profit esperado de una ruta
     * @param params Parámetros de arbitraje
     * @return expectedProfit Profit esperado antes de costs
     */
    function calculateExpectedProfit(ArbitrageParams memory params)
        public
        view
        returns (uint256 expectedProfit)
    {
        // Simular price en chain origen
        uint256 sourcePrice = _getTokenPrice(params.sourceChainId, params.sourceToken);
        
        // Simular price en chain destino
        uint256 targetPrice = _getTokenPrice(params.targetChainId, params.targetToken);
        
        // Calcular spread bruto
        uint256 grossProfit;
        if (targetPrice > sourcePrice) {
            grossProfit = params.amountIn.mulDiv(targetPrice - sourcePrice, sourcePrice);
        } else {
            return 0; // No hay arbitraje viable
        }
        
        // Restar costos estimados
        uint256 bridgeCosts = _calculateBridgeCosts(params);
        uint256 flashLoanCosts = _calculateFlashLoanCosts(params.amountIn);
        uint256 gasCosts = _estimateGasCosts(params);
        
        uint256 totalCosts = bridgeCosts + flashLoanCosts + gasCosts;
        
        if (grossProfit > totalCosts) {
            expectedProfit = grossProfit - totalCosts;
        } else {
            expectedProfit = 0;
        }
    }

    /**
     * @dev Callback de LayerZero para recibir mensajes cross-chain
     */
    function lzReceive(
        uint16 _srcChainId,
        bytes memory _srcAddress,
        uint64 _nonce,
        bytes memory _payload
    ) external override onlyLayerZero {
        // Decode payload
        (bytes32 routeId, uint256 amount, ArbitragePhase nextPhase) = 
            abi.decode(_payload, (bytes32, uint256, ArbitragePhase));
        
        // Validar route existe
        require(arbitrageStates[routeId].routeId != bytes32(0), "Route not found");
        
        // Actualizar estado
        arbitrageStates[routeId].phase = nextPhase;
        arbitrageStates[routeId].receivedAmount = amount;
        
        // Continuar con siguiente fase
        if (nextPhase == ArbitragePhase.BRIDGED_TO_L2) {
            _executeL2Swap(routeId);
        } else if (nextPhase == ArbitragePhase.BRIDGED_BACK) {
            _completeArbitrage(routeId);
        }
    }

    // ==================== FUNCIONES INTERNAS ====================

    /**
     * @dev Inicia flash loan para arbitraje
     */
    function _initiateFlashLoan(bytes32 routeId, ArbitrageParams memory params) internal {
        // Determinar mejor flash loan provider
        address provider = _selectOptimalFlashLoanProvider(params.sourceToken, params.amountIn);
        require(provider != address(0), "No flash loan provider available");
        
        // Actualizar estado
        arbitrageStates[routeId].flashLoanAmount = params.amountIn;
        
        // Ejecutar flash loan
        // Implementación específica según provider (Aave, Compound, etc.)
        _executeFlashLoan(provider, params.sourceToken, params.amountIn, abi.encode(routeId, params));
    }

    /**
     * @dev Callback flash loan - ejecuta lógica arbitraje
     */
    function _handleFlashLoanCallback(
        address asset,
        uint256 amount,
        uint256 premium,
        bytes memory params
    ) internal {
        // Decode parameters
        (bytes32 routeId, ArbitrageParams memory arbParams) = 
            abi.decode(params, (bytes32, ArbitrageParams));
        
        // Ejecutar swap en chain origen si necesario
        uint256 bridgeAmount = amount;
        if (arbParams.sourceToken != arbParams.bridgeToken) {
            bridgeAmount = _executeSwap(
                arbParams.sourceChainId,
                arbParams.sourceToken,
                arbParams.bridgeToken,
                amount,
                arbParams.swapDataSource
            );
        }
        
        // Ejecutar bridge a chain destino
        _executeBridge(routeId, arbParams, bridgeAmount);
        
        // Actualizar estado
        arbitrageStates[routeId].phase = ArbitragePhase.BRIDGED_TO_L2;
        arbitrageStates[routeId].bridgedAmount = bridgeAmount;
    }

    /**
     * @dev Ejecuta bridge usando Synapse
     */
    function _executeBridge(
        bytes32 routeId,
        ArbitrageParams memory params,
        uint256 amount
    ) internal {
        ChainConfig memory sourceConfig = chainConfigs[params.sourceChainId];
        ChainConfig memory targetConfig = chainConfigs[params.targetChainId];
        
        // Approve tokens para Synapse router
        IERC20(params.bridgeToken).safeApprove(sourceConfig.synapseRouter, amount);
        
        // Ejecutar bridge via Synapse
        ISynapseRouter(sourceConfig.synapseRouter).bridge(
            params.bridgeToken,
            targetConfig.chainId,
            amount,
            params.minAmountOut,
            params.deadline
        );
        
        // Enviar mensaje LayerZero para continuar en destino
        bytes memory payload = abi.encode(routeId, amount, ArbitragePhase.BRIDGED_TO_L2);
        _sendLayerZeroMessage(params.targetChainId, payload);
        
        emit BridgeExecuted(
            routeId,
            params.sourceChainId,
            params.targetChainId,
            params.bridgeToken,
            amount,
            params.direction
        );
    }

    /**
     * @dev Ejecuta swap en L2 tras recibir bridge
     */
    function _executeL2Swap(bytes32 routeId) internal {
        // Implementar swap en L2
        // Usar AMM disponible en L2 (Uniswap V3, etc.)
    }

    /**
     * @dev Completa arbitraje tras bridge de vuelta
     */
    function _completeArbitrage(bytes32 routeId) internal {
        ArbitrageState storage state = arbitrageStates[routeId];
        
        // Calcular profit final
        uint256 totalReceived = state.finalAmount;
        uint256 totalCosts = state.flashLoanAmount + _calculateFlashLoanFee(state.flashLoanAmount);
        
        if (totalReceived > totalCosts) {
            state.profit = totalReceived - totalCosts;
            
            // Distribuir profit
            _distributeProfit(routeId, state.profit, state.initiator);
            
            // Marcar como completado
            state.phase = ArbitragePhase.COMPLETED;
            state.isCompleted = true;
            
            emit ArbitrageCompleted(
                routeId,
                state.profit,
                state.profit.mulDiv(protocolFeeBps, 10000),
                state.profit.mulDiv(10000 - protocolFeeBps, 10000),
                state.gasUsed,
                state.initiator
            );
        } else {
            // Arbitraje falló
            state.phase = ArbitragePhase.FAILED;
            
            emit ArbitrageFailed(
                routeId,
                state.phase,
                "Insufficient profit",
                totalCosts - totalReceived
            );
        }
        
        // Limpiar de rutas activas
        _removeActiveRoute(routeId);
    }

    /**
     * @dev Ejecuta swap genérico
     */
    function _executeSwap(
        uint16 chainId,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        bytes memory swapData
    ) internal returns (uint256 amountOut) {
        // Implementación genérica swap
        // Soportar Uniswap V2/V3, SushiSwap, Curve, etc.
        // Usar swapData para determinar específicos
        
        // Placeholder implementation
        amountOut = amountIn; // Simplificado para compilación
    }

    /**
     * @dev Calcula costos bridge estimados
     */
    function _calculateBridgeCosts(ArbitrageParams memory params) 
        internal 
        view 
        returns (uint256 totalCosts) 
    {
        ChainConfig memory sourceConfig = chainConfigs[params.sourceChainId];
        ChainConfig memory targetConfig = chainConfigs[params.targetChainId];
        
        // Bridge fees (ida + vuelta)
        uint256 bridgeFeesOut = params.amountIn.mulDiv(sourceConfig.bridgeFeeBps, 10000);
        uint256 bridgeFeesBack = params.amountIn.mulDiv(targetConfig.bridgeFeeBps, 10000);
        
        // Gas costs estimados
        uint256 gasCostsL1 = 150000 * 50 gwei; // Estimación L1
        uint256 gasCostsL2 = 500000 * 0.1 gwei; // Estimación L2
        
        totalCosts = bridgeFeesOut + bridgeFeesBack + gasCostsL1 + gasCostsL2;
    }

    /**
     * @dev Calcula costos flash loan
     */
    function _calculateFlashLoanCosts(uint256 amount) internal pure returns (uint256) {
        // Aave V3: 0.05%
        return amount.mulDiv(5, 10000);
    }

    /**
     * @dev Estima costos gas totales
     */
    function _estimateGasCosts(ArbitrageParams memory params) 
        internal 
        pure 
        returns (uint256) 
    {
        // Estimación basada en operaciones esperadas
        return 1000000 * 20 gwei; // ~0.02 ETH
    }

    /**
     * @dev Obtiene precio token en chain específica
     */
    function _getTokenPrice(uint16 chainId, address token) 
        internal 
        view 
        returns (uint256 price) 
    {
        // Implementar oracle price feeds por chain
        // Chainlink, Pyth, etc.
        price = 1e18; // Placeholder
    }

    /**
     * @dev Selecciona proveedor flash loan óptimo
     */
    function _selectOptimalFlashLoanProvider(address token, uint256 amount)
        internal
        view
        returns (address provider)
    {
        // Lógica para seleccionar mejor provider basado en fees y disponibilidad
        // Por ahora retorna el primero disponible
        // TODO: Implementar lógica de selección inteligente
    }

    /**
     * @dev Distribuye profit entre protocol y user
     */
    function _distributeProfit(bytes32 routeId, uint256 profit, address recipient) internal {
        uint256 protocolFee = profit.mulDiv(protocolFeeBps, 10000);
        uint256 userProfit = profit - protocolFee;
        
        // Transferir fees (implementation depends on token)
        // Simplificado para compilación
    }

    // ==================== FUNCIONES ADMINISTRATIVAS ====================

    /**
     * @dev Configura chain para arbitraje
     */
    function configureChain(
        uint16 chainId,
        address synapseRouter,
        address nativeToken,
        address[] memory supportedTokens,
        uint256 minBridgeAmount,
        uint256 maxBridgeAmount,
        uint256 bridgeFeeBps,
        uint256 avgBridgeTime
    ) external onlyOwner {
        chainConfigs[chainId] = ChainConfig({
            chainId: chainId,
            synapseRouter: synapseRouter,
            nativeToken: nativeToken,
            supportedTokens: supportedTokens,
            minBridgeAmount: minBridgeAmount,
            maxBridgeAmount: maxBridgeAmount,
            bridgeFeeBps: bridgeFeeBps,
            avgBridgeTime: avgBridgeTime,
            isActive: true
        });
        
        emit ChainConfigUpdated(chainId, synapseRouter, true);
    }

    /**
     * @dev Configura flash loan provider
     */
    function configureFlashLoanProvider(
        address provider,
        address asset,
        uint256 feeBps,
        uint256 maxAmount
    ) external onlyOwner {
        flashLoanConfigs[provider] = FlashLoanConfig({
            provider: provider,
            asset: asset,
            feeBps: feeBps,
            maxAmount: maxAmount,
            isActive: true
        });
    }

    // ==================== FUNCIONES DE UTILIDAD ====================

    /**
     * @dev Genera route ID único
     */
    function _generateRouteId(ArbitrageParams memory params, address initiator)
        internal
        view
        returns (bytes32)
    {
        return keccak256(abi.encodePacked(
            params.sourceChainId,
            params.targetChainId,
            params.sourceToken,
            params.targetToken,
            params.amountIn,
            initiator,
            block.timestamp,
            block.number
        ));
    }

    /**
     * @dev Remueve ruta de activas
     */
    function _removeActiveRoute(bytes32 routeId) internal {
        for (uint256 i = 0; i < activeRoutes.length; i++) {
            if (activeRoutes[i] == routeId) {
                activeRoutes[i] = activeRoutes[activeRoutes.length - 1];
                activeRoutes.pop();
                break;
            }
        }
    }

    /**
     * @dev Envía mensaje LayerZero
     */
    function _sendLayerZeroMessage(uint16 targetChain, bytes memory payload) internal {
        // Implementar envío LayerZero message
        // ILayerZeroEndpoint(layerZeroEndpoint).send(...)
    }

    // ==================== VIEW FUNCTIONS ====================

    /**
     * @dev Obtiene rutas activas
     */
    function getActiveRoutes() external view returns (bytes32[] memory) {
        return activeRoutes;
    }

    /**
     * @dev Obtiene estado de arbitraje
     */
    function getArbitrageState(bytes32 routeId) 
        external 
        view 
        returns (ArbitrageState memory) 
    {
        return arbitrageStates[routeId];
    }

    /**
     * @dev Verifica si chain está soportada
     */
    function isChainSupported(uint16 chainId) external view returns (bool) {
        return chainConfigs[chainId].isActive;
    }

    // ==================== EMERGENCY FUNCTIONS ====================

    /**
     * @dev Emergency pause
     */
    function emergencyPause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Emergency unpause  
     */
    function emergencyUnpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Emergency cancel route
     */
    function emergencyCancelRoute(bytes32 routeId) external onlyOwner {
        arbitrageStates[routeId].phase = ArbitragePhase.FAILED;
        _removeActiveRoute(routeId);
    }
}
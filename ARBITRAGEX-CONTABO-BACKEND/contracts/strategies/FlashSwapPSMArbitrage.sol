// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IArbitrageStrategy.sol";
import "../interfaces/IFlashSwapReceiver.sol";
import "../interfaces/IPSMRouter.sol";
import "../libraries/PriceUtils.sol";
import "../libraries/SafeMath.sol";

/**
 * @title S001: FlashSwapPSMArbitrage
 * @dev Implementa arbitraje usando Flash Swaps + MakerDAO PSM redención
 * Estrategia sin capital inicial aprovechando ineficiencias PSM vs market prices
 * 
 * Flujo:
 * 1. Detectar spread PSM vs DEX price
 * 2. Flash Swap en Uniswap V2/V3 
 * 3. PSM mint/redeem según dirección arbitraje
 * 4. Repagar flash swap + capturar profit
 */
contract FlashSwapPSMArbitrage is 
    IArbitrageStrategy, 
    IFlashSwapReceiver,
    ReentrancyGuard, 
    Pausable, 
    Ownable 
{
    using SafeERC20 for IERC20;
    using PriceUtils for uint256;
    using SafeMath for uint256;

    // ==================== ESTRUCTURAS Y ENUMS ====================

    enum PSMDirection {
        GEM_TO_DAI,     // Gem → DAI (PSM mint)
        DAI_TO_GEM      // DAI → Gem (PSM redeem)
    }

    enum FlashSwapProvider {
        UNISWAP_V2,     // Uniswap V2 pairs
        UNISWAP_V3,     // Uniswap V3 pools  
        SUSHISWAP,      // SushiSwap pairs
        CURVE,          // Curve pools (si soporta flash)
        BALANCER        // Balancer pools
    }

    struct PSMParams {
        address psmContract;        // MakerDAO PSM contract address
        address gemToken;          // Gem token (USDC, GUSD, USDP, etc.)
        address daiToken;          // DAI token address
        uint256 gemDecimals;       // Gem token decimals
        uint256 daiDecimals;       // DAI token decimals (18)
        uint256 tout;              // PSM fee out (gem → dai)
        uint256 tin;               // PSM fee in (dai → gem)
        uint256 gemBalance;        // Available gem balance in PSM
        uint256 daiBalance;        // Available DAI balance in PSM
    }

    struct FlashSwapParams {
        FlashSwapProvider provider; // Flash swap provider
        address pairOrPool;        // Pair/pool address para flash swap
        address tokenIn;           // Token input del flash swap
        address tokenOut;          // Token output del flash swap
        uint256 amountOut;         // Cantidad a recibir en flash swap
        uint256 maxAmountIn;       // Máximo a repagar
        bytes swapData;            // Datos específicos del swap
    }

    struct ArbitrageRoute {
        PSMParams psm;             // Parámetros PSM
        FlashSwapParams flashSwap; // Parámetros flash swap
        PSMDirection direction;    // Dirección del arbitraje
        uint256 amountIn;         // Cantidad inicial
        uint256 expectedProfit;   // Profit esperado
        uint256 minProfit;        // Profit mínimo requerido
        uint256 maxGasPrice;      // Gas price máximo
        uint256 deadline;         // Deadline para operación
        address recipient;        // Recipient del profit
    }

    // ==================== VARIABLES DE ESTADO ====================

    /// @dev Mapping de PSM contracts soportados
    mapping(address => bool) public supportedPSMs;
    
    /// @dev Mapping de flash swap providers
    mapping(address => FlashSwapProvider) public flashSwapProviders;
    
    /// @dev Fee del protocolo en basis points (ej: 30 = 0.3%)
    uint256 public protocolFeeBps = 30;
    
    /// @dev Recipient de protocol fees
    address public feeRecipient;
    
    /// @dev Profit mínimo global en basis points
    uint256 public minProfitBps = 50; // 0.5%
    
    /// @dev Gas limit para operaciones PSM
    uint256 public psmGasLimit = 300000;

    // ==================== EVENTOS ====================

    event PSMArbitrageExecuted(
        address indexed psmContract,
        address indexed gemToken,
        PSMDirection direction,
        uint256 amountIn,
        uint256 profit,
        uint256 gasUsed,
        address recipient
    );

    event FlashSwapInitiated(
        address indexed provider,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountOut,
        bytes32 routeHash
    );

    event PSMParametersUpdated(
        address indexed psmContract,
        uint256 tout,
        uint256 tin,
        uint256 gemBalance,
        uint256 daiBalance
    );

    event ProfitDistributed(
        address indexed recipient,
        uint256 amount,
        uint256 protocolFee
    );

    // ==================== MODIFICADORES ====================

    modifier validPSM(address psmContract) {
        require(supportedPSMs[psmContract], "PSM not supported");
        _;
    }

    modifier validFlashSwapProvider(address provider) {
        require(
            flashSwapProviders[provider] != FlashSwapProvider(0), 
            "Flash swap provider not supported"
        );
        _;
    }

    modifier profitableRoute(ArbitrageRoute memory route) {
        require(
            route.expectedProfit >= route.minProfit,
            "Insufficient expected profit"
        );
        require(
            route.expectedProfit.mulDiv(10000, route.amountIn) >= minProfitBps,
            "Profit below minimum threshold"
        );
        _;
    }

    // ==================== CONSTRUCTOR ====================

    constructor(
        address _feeRecipient,
        uint256 _protocolFeeBps,
        uint256 _minProfitBps
    ) {
        require(_feeRecipient != address(0), "Invalid fee recipient");
        require(_protocolFeeBps <= 1000, "Protocol fee too high"); // max 10%
        require(_minProfitBps >= 10, "Min profit too low"); // min 0.1%

        feeRecipient = _feeRecipient;
        protocolFeeBps = _protocolFeeBps;
        minProfitBps = _minProfitBps;
    }

    // ==================== FUNCIONES PRINCIPALES ====================

    /**
     * @dev Ejecuta arbitraje PSM usando flash swap
     * @param route Parámetros completos de la ruta de arbitraje
     */
    function executePSMArbitrage(ArbitrageRoute memory route) 
        external 
        nonReentrant 
        whenNotPaused 
        validPSM(route.psm.psmContract)
        validFlashSwapProvider(route.flashSwap.pairOrPool)
        profitableRoute(route)
    {
        require(block.timestamp <= route.deadline, "Route expired");
        require(tx.gasprice <= route.maxGasPrice, "Gas price too high");

        uint256 gasStart = gasleft();
        
        // Validar disponibilidad PSM
        _validatePSMAvailability(route.psm, route.direction, route.amountIn);
        
        // Iniciar flash swap
        bytes32 routeHash = _encodeRoute(route);
        _initiateFlashSwap(route.flashSwap, routeHash);
        
        uint256 gasUsed = gasStart - gasleft();
        
        emit PSMArbitrageExecuted(
            route.psm.psmContract,
            route.psm.gemToken,
            route.direction,
            route.amountIn,
            route.expectedProfit,
            gasUsed,
            route.recipient
        );
    }

    /**
     * @dev Callback para flash swap (implementa IFlashSwapReceiver)
     * @param sender Sender original del flash swap
     * @param amount0 Cantidad token0
     * @param amount1 Cantidad token1  
     * @param data Datos de la ruta encoded
     */
    function flashSwapCallback(
        address sender,
        uint256 amount0,
        uint256 amount1,
        bytes calldata data
    ) external override nonReentrant {
        // Decode route parameters
        ArbitrageRoute memory route = _decodeRoute(data);
        
        // Validar que el callback viene del flash swap provider correcto
        require(
            msg.sender == route.flashSwap.pairOrPool,
            "Unauthorized flash swap callback"
        );
        
        // Ejecutar lógica PSM
        uint256 profit = _executePSMLogic(route, amount0, amount1);
        
        // Calcular repayment amount
        uint256 repayAmount = _calculateRepayAmount(
            route.flashSwap,
            amount0 > 0 ? amount0 : amount1
        );
        
        // Validar profit vs repayment
        require(profit > repayAmount, "Insufficient profit for repayment");
        
        // Repagar flash swap
        _repayFlashSwap(route.flashSwap, repayAmount);
        
        // Distribuir profit
        uint256 netProfit = profit - repayAmount;
        _distributeProfit(netProfit, route.recipient);
    }

    /**
     * @dev Calcula profit potencial de ruta PSM
     * @param route Parámetros de la ruta
     * @return expectedProfit Profit esperado antes de gas costs
     */
    function calculatePotentialProfit(ArbitrageRoute memory route) 
        external 
        view 
        returns (uint256 expectedProfit) 
    {
        // Simular PSM operation
        uint256 psmOutput = _simulatePSMOperation(
            route.psm,
            route.direction,
            route.amountIn
        );
        
        // Simular flash swap repayment
        uint256 flashSwapCost = _simulateFlashSwapCost(
            route.flashSwap,
            route.amountIn
        );
        
        // Calcular profit neto
        if (psmOutput > flashSwapCost) {
            expectedProfit = psmOutput - flashSwapCost;
        } else {
            expectedProfit = 0;
        }
    }

    // ==================== FUNCIONES INTERNAS ====================

    /**
     * @dev Valida disponibilidad PSM para operación
     */
    function _validatePSMAvailability(
        PSMParams memory psm,
        PSMDirection direction,
        uint256 amountIn
    ) internal view {
        if (direction == PSMDirection.GEM_TO_DAI) {
            require(psm.daiBalance >= amountIn, "Insufficient DAI in PSM");
        } else {
            require(psm.gemBalance >= amountIn, "Insufficient GEM in PSM");
        }
    }

    /**
     * @dev Inicia flash swap según provider
     */
    function _initiateFlashSwap(
        FlashSwapParams memory flashSwap,
        bytes32 routeHash
    ) internal {
        if (flashSwap.provider == FlashSwapProvider.UNISWAP_V2) {
            _initiateUniV2FlashSwap(flashSwap, routeHash);
        } else if (flashSwap.provider == FlashSwapProvider.UNISWAP_V3) {
            _initiateUniV3FlashSwap(flashSwap, routeHash);
        } else if (flashSwap.provider == FlashSwapProvider.SUSHISWAP) {
            _initiateSushiFlashSwap(flashSwap, routeHash);
        } else {
            revert("Unsupported flash swap provider");
        }

        emit FlashSwapInitiated(
            flashSwap.pairOrPool,
            flashSwap.tokenIn,
            flashSwap.tokenOut,
            flashSwap.amountOut,
            routeHash
        );
    }

    /**
     * @dev Ejecuta lógica PSM dentro del callback
     */
    function _executePSMLogic(
        ArbitrageRoute memory route,
        uint256 amount0,
        uint256 amount1
    ) internal returns (uint256 profit) {
        uint256 receivedAmount = amount0 > 0 ? amount0 : amount1;
        
        if (route.direction == PSMDirection.GEM_TO_DAI) {
            // GEM → DAI via PSM
            profit = _executePSMMint(route.psm, receivedAmount);
        } else {
            // DAI → GEM via PSM  
            profit = _executePSMRedeem(route.psm, receivedAmount);
        }
    }

    /**
     * @dev Ejecuta PSM mint (GEM → DAI)
     */
    function _executePSMMint(
        PSMParams memory psm,
        uint256 gemAmount
    ) internal returns (uint256 daiReceived) {
        IERC20(psm.gemToken).safeApprove(psm.psmContract, gemAmount);
        
        // Llamar PSM sellGem function
        bytes memory callData = abi.encodeWithSignature(
            "sellGem(address,uint256)",
            address(this),
            gemAmount
        );
        
        (bool success, bytes memory result) = psm.psmContract.call{gas: psmGasLimit}(callData);
        require(success, "PSM mint failed");
        
        daiReceived = abi.decode(result, (uint256));
        
        // Aplicar fee PSM (tout)
        daiReceived = daiReceived.sub(daiReceived.mulDiv(psm.tout, 1e18));
    }

    /**
     * @dev Ejecuta PSM redeem (DAI → GEM)
     */
    function _executePSMRedeem(
        PSMParams memory psm,
        uint256 daiAmount
    ) internal returns (uint256 gemReceived) {
        IERC20(psm.daiToken).safeApprove(psm.psmContract, daiAmount);
        
        // Llamar PSM buyGem function
        bytes memory callData = abi.encodeWithSignature(
            "buyGem(address,uint256)",
            address(this),
            daiAmount
        );
        
        (bool success, bytes memory result) = psm.psmContract.call{gas: psmGasLimit}(callData);
        require(success, "PSM redeem failed");
        
        gemReceived = abi.decode(result, (uint256));
        
        // Aplicar fee PSM (tin)  
        gemReceived = gemReceived.sub(gemReceived.mulDiv(psm.tin, 1e18));
    }

    /**
     * @dev Calcula amount a repagar en flash swap
     */
    function _calculateRepayAmount(
        FlashSwapParams memory flashSwap,
        uint256 borrowedAmount
    ) internal view returns (uint256 repayAmount) {
        if (flashSwap.provider == FlashSwapProvider.UNISWAP_V2) {
            // Uniswap V2: 0.3% fee
            repayAmount = borrowedAmount.mulDiv(1003, 1000);
        } else if (flashSwap.provider == FlashSwapProvider.UNISWAP_V3) {
            // Uniswap V3: fee según pool
            repayAmount = borrowedAmount; // Fee handled separately
        } else {
            // Default: 0.3% fee
            repayAmount = borrowedAmount.mulDiv(1003, 1000);
        }
    }

    /**
     * @dev Repaga flash swap
     */
    function _repayFlashSwap(
        FlashSwapParams memory flashSwap,
        uint256 repayAmount
    ) internal {
        IERC20(flashSwap.tokenIn).safeTransfer(
            flashSwap.pairOrPool,
            repayAmount
        );
    }

    /**
     * @dev Distribuye profit capturado
     */
    function _distributeProfit(uint256 profit, address recipient) internal {
        uint256 protocolFee = profit.mulDiv(protocolFeeBps, 10000);
        uint256 userProfit = profit - protocolFee;
        
        if (protocolFee > 0) {
            // Transfer protocol fee
            // Note: token depends on strategy, needs to be determined dynamically
        }
        
        if (userProfit > 0) {
            // Transfer user profit
            // Note: token depends on strategy, needs to be determined dynamically  
        }
        
        emit ProfitDistributed(recipient, userProfit, protocolFee);
    }

    // ==================== FUNCIONES DE SIMULACIÓN ====================

    /**
     * @dev Simula operación PSM para cálculo de profit
     */
    function _simulatePSMOperation(
        PSMParams memory psm,
        PSMDirection direction,
        uint256 amountIn
    ) internal pure returns (uint256 amountOut) {
        if (direction == PSMDirection.GEM_TO_DAI) {
            // GEM → DAI: aplicar tout fee
            amountOut = amountIn.mulDiv(
                10**psm.daiDecimals,
                10**psm.gemDecimals
            );
            amountOut = amountOut.sub(amountOut.mulDiv(psm.tout, 1e18));
        } else {
            // DAI → GEM: aplicar tin fee
            amountOut = amountIn.mulDiv(
                10**psm.gemDecimals,
                10**psm.daiDecimals
            );
            amountOut = amountOut.sub(amountOut.mulDiv(psm.tin, 1e18));
        }
    }

    /**
     * @dev Simula costo flash swap
     */
    function _simulateFlashSwapCost(
        FlashSwapParams memory flashSwap,
        uint256 amountIn
    ) internal pure returns (uint256 cost) {
        // Simplified: 0.3% fee for most providers
        cost = amountIn.mulDiv(1003, 1000);
    }

    // ==================== FUNCIONES DE ADMINISTRACIÓN ====================

    /**
     * @dev Añade soporte para nuevo PSM
     */
    function addPSMSupport(address psmContract) external onlyOwner {
        supportedPSMs[psmContract] = true;
    }

    /**
     * @dev Remueve soporte para PSM
     */
    function removePSMSupport(address psmContract) external onlyOwner {
        supportedPSMs[psmContract] = false;
    }

    /**
     * @dev Añade proveedor flash swap
     */
    function addFlashSwapProvider(
        address provider,
        FlashSwapProvider providerType
    ) external onlyOwner {
        flashSwapProviders[provider] = providerType;
    }

    /**
     * @dev Actualiza parámetros de protocol
     */
    function updateProtocolParams(
        uint256 _protocolFeeBps,
        uint256 _minProfitBps,
        address _feeRecipient
    ) external onlyOwner {
        require(_protocolFeeBps <= 1000, "Protocol fee too high");
        require(_minProfitBps >= 10, "Min profit too low");
        require(_feeRecipient != address(0), "Invalid fee recipient");
        
        protocolFeeBps = _protocolFeeBps;
        minProfitBps = _minProfitBps;
        feeRecipient = _feeRecipient;
    }

    // ==================== FUNCIONES DE UTILIDAD ====================

    /**
     * @dev Encode route para callback
     */
    function _encodeRoute(ArbitrageRoute memory route) 
        internal 
        pure 
        returns (bytes32) 
    {
        return keccak256(abi.encode(route));
    }

    /**
     * @dev Decode route desde callback data
     */
    function _decodeRoute(bytes calldata data) 
        internal 
        pure 
        returns (ArbitrageRoute memory route) 
    {
        return abi.decode(data, (ArbitrageRoute));
    }

    // ==================== PROVIDER-SPECIFIC IMPLEMENTATIONS ====================

    /**
     * @dev Inicia Uniswap V2 flash swap
     */
    function _initiateUniV2FlashSwap(
        FlashSwapParams memory flashSwap,
        bytes32 routeHash
    ) internal {
        // Implementación específica Uniswap V2
        // IUniswapV2Pair(flashSwap.pairOrPool).swap(...)
    }

    /**
     * @dev Inicia Uniswap V3 flash swap
     */
    function _initiateUniV3FlashSwap(
        FlashSwapParams memory flashSwap,
        bytes32 routeHash
    ) internal {
        // Implementación específica Uniswap V3
        // IUniswapV3Pool(flashSwap.pairOrPool).flash(...)
    }

    /**
     * @dev Inicia SushiSwap flash swap
     */
    function _initiateSushiFlashSwap(
        FlashSwapParams memory flashSwap,
        bytes32 routeHash
    ) internal {
        // Implementación específica SushiSwap
        // Similar a Uniswap V2
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
     * @dev Emergency token recovery
     */
    function emergencyTokenRecovery(
        address token,
        uint256 amount,
        address to
    ) external onlyOwner {
        IERC20(token).safeTransfer(to, amount);
    }
}
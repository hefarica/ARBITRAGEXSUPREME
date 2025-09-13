// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IArbitrageStrategy.sol";
import "../interfaces/IERC20Extended.sol";
import "../libraries/PriceUtils.sol";
import "../libraries/SafeMath.sol";

/**
 * @title InterDEXArbitrage
 * @dev Implementa estrategias de arbitraje entre diferentes DEXs
 * Permite aprovechar diferencias de precios entre múltiples exchanges descentralizados
 * Soporta arbitraje simple (comprar en DEX1, vender en DEX2) y múltiples rutas
 */
contract InterDEXArbitrage is IArbitrageStrategy, ReentrancyGuard, Pausable, Ownable {
    using SafeERC20 for IERC20;
    using PriceUtils for uint256;
    using SafeMath for uint256;

    // ==================== ESTRUCTURAS Y EVENTOS ====================

    struct InterDEXParams {
        address tokenA;           // Token de entrada/salida
        address tokenB;           // Token intermedio (puede ser el mismo que tokenA)
        address dexSource;        // DEX origen para compra
        address dexTarget;        // DEX destino para venta
        uint256 amountIn;         // Cantidad de entrada
        uint256 minAmountOut;     // Ganancia mínima esperada
        bytes swapDataSource;     // Datos de swap para DEX origen
        bytes swapDataTarget;     // Datos de swap para DEX destino
        uint256 deadline;         // Timestamp límite
        bool useFlashLoan;        // Si usar flash loan
    }

    struct MultiDEXParams {
        address[] tokens;         // Ruta de tokens [A,B,C,A]
        address[] dexes;         // DEXs correspondientes [DEX1,DEX2,DEX3]
        uint256[] amounts;        // Cantidades por cada hop
        bytes[] swapData;        // Datos de swap para cada DEX
        uint256 minProfit;       // Ganancia mínima total
        uint256 deadline;        // Timestamp límite
    }

    struct ArbitrageResult {
        bool success;
        uint256 profit;
        uint256 gasUsed;
        string errorReason;
    }

    // ==================== VARIABLES DE ESTADO ====================

    mapping(address => bool) public authorizedDEXs;
    mapping(address => uint256) public dexFees;           // Fees por DEX (basis points)
    mapping(address => bool) public supportedTokens;
    
    uint256 public constant MAX_SLIPPAGE = 500;           // 5% máximo slippage
    uint256 public constant MIN_PROFIT_THRESHOLD = 1000;  // 0.01 ETH mínimo profit
    uint256 public maxHops = 4;                          // Máximo hops en multi-DEX
    uint256 public executionFee = 50;                    // 0.5% fee de ejecución
    
    address public flashLoanProvider;
    address public profitReceiver;

    // ==================== EVENTOS ====================

    event InterDEXArbitrageExecuted(
        address indexed tokenA,
        address indexed tokenB,
        address sourceDEX,
        address targetDEX,
        uint256 amountIn,
        uint256 profit,
        uint256 timestamp
    );

    event MultiDEXArbitrageExecuted(
        address[] tokens,
        address[] dexes,
        uint256 totalProfit,
        uint256 hops,
        uint256 timestamp
    );

    event DEXAuthorized(address indexed dex, bool authorized);
    event ProfitWithdrawn(address indexed token, uint256 amount);

    // ==================== CONSTRUCTOR ====================

    constructor(
        address _flashLoanProvider,
        address _profitReceiver
    ) {
        flashLoanProvider = _flashLoanProvider;
        profitReceiver = _profitReceiver;
    }

    // ==================== FUNCIONES PRINCIPALES ====================

    /**
     * @dev Ejecuta arbitraje entre dos DEXs diferentes
     * Implementa patrón: Comprar en DEX1 -> Vender en DEX2 -> Profit
     */
    function execute(bytes calldata data) external override nonReentrant whenNotPaused returns (bool success, uint256 profit) {
        InterDEXParams memory params = abi.decode(data, (InterDEXParams));
        
        require(params.deadline >= block.timestamp, "InterDEX: Deadline expired");
        require(authorizedDEXs[params.dexSource], "InterDEX: Source DEX not authorized");
        require(authorizedDEXs[params.dexTarget], "InterDEX: Target DEX not authorized");
        require(supportedTokens[params.tokenA], "InterDEX: Token not supported");

        ArbitrageResult memory result;
        uint256 initialGas = gasleft();

        if (params.useFlashLoan) {
            result = _executeWithFlashLoan(params);
        } else {
            result = _executeDirectArbitrage(params);
        }

        result.gasUsed = initialGas.sub(gasleft());

        if (result.success && result.profit >= MIN_PROFIT_THRESHOLD) {
            _handleProfit(params.tokenA, result.profit);
            
            emit InterDEXArbitrageExecuted(
                params.tokenA,
                params.tokenB,
                params.dexSource,
                params.dexTarget,
                params.amountIn,
                result.profit,
                block.timestamp
            );
        }

        return (result.success, result.profit);
    }

    /**
     * @dev Ejecuta arbitraje multi-DEX con múltiples saltos
     * Patrón: A->B (DEX1) -> B->C (DEX2) -> C->A (DEX3) -> Profit
     */
    function executeMultiDEXArbitrage(MultiDEXParams calldata params) 
        external 
        nonReentrant 
        whenNotPaused 
        returns (bool success, uint256 totalProfit) 
    {
        require(params.deadline >= block.timestamp, "MultiDEX: Deadline expired");
        require(params.tokens.length >= 3, "MultiDEX: Minimum 3 tokens required");
        require(params.tokens.length <= maxHops + 1, "MultiDEX: Too many hops");
        require(params.dexes.length == params.tokens.length - 1, "MultiDEX: DEXs count mismatch");

        // Verificar que todos los DEXs están autorizados
        for (uint256 i = 0; i < params.dexes.length; i++) {
            require(authorizedDEXs[params.dexes[i]], "MultiDEX: DEX not authorized");
        }

        uint256 initialBalance = IERC20(params.tokens[0]).balanceOf(address(this));
        bool allSwapsSuccessful = true;
        uint256 currentAmount = params.amounts[0];

        // Ejecutar secuencia de swaps
        for (uint256 i = 0; i < params.dexes.length && allSwapsSuccessful; i++) {
            try this._executeSwapOnDEX(
                params.tokens[i],
                params.tokens[i + 1],
                params.dexes[i],
                currentAmount,
                params.swapData[i]
            ) returns (uint256 amountOut) {
                currentAmount = amountOut;
            } catch {
                allSwapsSuccessful = false;
            }
        }

        if (allSwapsSuccessful) {
            uint256 finalBalance = IERC20(params.tokens[0]).balanceOf(address(this));
            
            if (finalBalance > initialBalance) {
                totalProfit = finalBalance.sub(initialBalance);
                
                if (totalProfit >= params.minProfit) {
                    _handleProfit(params.tokens[0], totalProfit);
                    
                    emit MultiDEXArbitrageExecuted(
                        params.tokens,
                        params.dexes,
                        totalProfit,
                        params.dexes.length,
                        block.timestamp
                    );
                    
                    success = true;
                }
            }
        }

        return (success, totalProfit);
    }

    /**
     * @dev Simula la ejecución de arbitraje sin modificar estado
     */
    function simulate(bytes calldata data) external view override returns (bool canExecute, uint256 estimatedProfit) {
        InterDEXParams memory params = abi.decode(data, (InterDEXParams));
        
        if (!authorizedDEXs[params.dexSource] || !authorizedDEXs[params.dexTarget]) {
            return (false, 0);
        }

        // Simular precio en DEX origen
        uint256 amountFromSource = _simulateSwap(
            params.tokenA,
            params.tokenB,
            params.dexSource,
            params.amountIn
        );

        // Simular precio en DEX destino
        uint256 amountFromTarget = _simulateSwap(
            params.tokenB,
            params.tokenA,
            params.dexTarget,
            amountFromSource
        );

        if (amountFromTarget > params.amountIn) {
            estimatedProfit = amountFromTarget.sub(params.amountIn);
            canExecute = estimatedProfit >= params.minAmountOut;
        }

        return (canExecute, estimatedProfit);
    }

    /**
     * @dev Verifica si la estrategia puede ejecutarse
     */
    function canExecute(bytes calldata data) external view override returns (bool) {
        (bool executable,) = this.simulate(data);
        return executable;
    }

    /**
     * @dev Retorna información de la estrategia
     */
    function getStrategyInfo() external pure override returns (string memory name, string memory description) {
        return (
            "Inter-DEX Arbitrage",
            "Arbitrage between different decentralized exchanges to capture price differences"
        );
    }

    // ==================== FUNCIONES INTERNAS ====================

    /**
     * @dev Ejecuta arbitraje directo sin flash loan
     */
    function _executeDirectArbitrage(InterDEXParams memory params) internal returns (ArbitrageResult memory result) {
        uint256 initialBalance = IERC20(params.tokenA).balanceOf(address(this));
        
        if (initialBalance < params.amountIn) {
            result.errorReason = "Insufficient balance";
            return result;
        }

        try this._executeInterDEXSwaps(params) returns (uint256 finalAmount) {
            if (finalAmount > params.amountIn) {
                result.success = true;
                result.profit = finalAmount.sub(params.amountIn);
            }
        } catch Error(string memory reason) {
            result.errorReason = reason;
        }

        return result;
    }

    /**
     * @dev Ejecuta arbitraje con flash loan
     */
    function _executeWithFlashLoan(InterDEXParams memory params) internal returns (ArbitrageResult memory result) {
        // Implementar lógica de flash loan
        // Por ahora, ejecutar directo y validar después
        return _executeDirectArbitrage(params);
    }

    /**
     * @dev Ejecuta los swaps entre DEXs
     */
    function _executeInterDEXSwaps(InterDEXParams memory params) external returns (uint256 finalAmount) {
        require(msg.sender == address(this), "InterDEX: Internal function");

        // Step 1: Swap en DEX origen (A -> B)
        uint256 intermediateAmount = _executeSwapOnDEX(
            params.tokenA,
            params.tokenB,
            params.dexSource,
            params.amountIn,
            params.swapDataSource
        );

        require(intermediateAmount > 0, "InterDEX: Source swap failed");

        // Step 2: Swap en DEX destino (B -> A)
        finalAmount = _executeSwapOnDEX(
            params.tokenB,
            params.tokenA,
            params.dexTarget,
            intermediateAmount,
            params.swapDataTarget
        );

        require(finalAmount > params.amountIn, "InterDEX: No profit generated");

        return finalAmount;
    }

    /**
     * @dev Ejecuta swap en un DEX específico
     */
    function _executeSwapOnDEX(
        address tokenIn,
        address tokenOut,
        address dex,
        uint256 amountIn,
        bytes memory swapData
    ) internal returns (uint256 amountOut) {
        require(authorizedDEXs[dex], "InterDEX: DEX not authorized");
        
        IERC20(tokenIn).safeApprove(dex, amountIn);
        
        uint256 balanceBefore = IERC20(tokenOut).balanceOf(address(this));
        
        // Ejecutar swap específico del DEX
        (bool success,) = dex.call(swapData);
        require(success, "InterDEX: Swap execution failed");
        
        uint256 balanceAfter = IERC20(tokenOut).balanceOf(address(this));
        amountOut = balanceAfter.sub(balanceBefore);
        
        require(amountOut > 0, "InterDEX: No output received");
        
        return amountOut;
    }

    /**
     * @dev Simula un swap para calcular output esperado
     */
    function _simulateSwap(
        address tokenIn,
        address tokenOut,
        address dex,
        uint256 amountIn
    ) internal view returns (uint256 amountOut) {
        // Esta función debería llamar a view functions del DEX
        // Por simplicidad, retornamos una simulación básica
        return amountIn.mul(99).div(100); // Asumiendo 1% slippage
    }

    /**
     * @dev Maneja las ganancias del arbitraje
     */
    function _handleProfit(address token, uint256 profit) internal {
        uint256 fee = profit.mul(executionFee).div(10000);
        uint256 netProfit = profit.sub(fee);
        
        if (fee > 0) {
            IERC20(token).safeTransfer(profitReceiver, fee);
        }
        
        // El resto del profit queda en el contrato para reinversión
    }

    // ==================== FUNCIONES ADMINISTRATIVAS ====================

    /**
     * @dev Autoriza o desautoriza un DEX
     */
    function setDEXAuthorization(address dex, bool authorized) external onlyOwner {
        authorizedDEXs[dex] = authorized;
        emit DEXAuthorized(dex, authorized);
    }

    /**
     * @dev Configura fee por DEX
     */
    function setDEXFee(address dex, uint256 feeBasisPoints) external onlyOwner {
        require(feeBasisPoints <= 1000, "InterDEX: Fee too high"); // Max 10%
        dexFees[dex] = feeBasisPoints;
    }

    /**
     * @dev Configura soporte para token
     */
    function setSupportedToken(address token, bool supported) external onlyOwner {
        supportedTokens[token] = supported;
    }

    /**
     * @dev Configura parámetros generales
     */
    function setParameters(
        uint256 _maxHops,
        uint256 _executionFee,
        address _flashLoanProvider,
        address _profitReceiver
    ) external onlyOwner {
        require(_maxHops <= 10, "InterDEX: Too many hops");
        require(_executionFee <= 1000, "InterDEX: Fee too high"); // Max 10%
        
        maxHops = _maxHops;
        executionFee = _executionFee;
        flashLoanProvider = _flashLoanProvider;
        profitReceiver = _profitReceiver;
    }

    /**
     * @dev Retira ganancias acumuladas
     */
    function withdrawProfits(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(profitReceiver, amount);
        emit ProfitWithdrawn(token, amount);
    }

    /**
     * @dev Función de emergencia para pausar
     */
    function emergencyPause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Función para reanudar operaciones
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // ==================== FUNCIONES DE VISTA ====================

    /**
     * @dev Retorna configuración actual
     */
    function getConfiguration() external view returns (
        uint256 _maxHops,
        uint256 _executionFee,
        uint256 _minProfitThreshold,
        address _flashLoanProvider,
        address _profitReceiver
    ) {
        return (maxHops, executionFee, MIN_PROFIT_THRESHOLD, flashLoanProvider, profitReceiver);
    }

    /**
     * @dev Verifica si un DEX está autorizado
     */
    function isDEXAuthorized(address dex) external view returns (bool) {
        return authorizedDEXs[dex];
    }

    /**
     * @dev Retorna el fee de un DEX
     */
    function getDEXFee(address dex) external view returns (uint256) {
        return dexFees[dex];
    }
}
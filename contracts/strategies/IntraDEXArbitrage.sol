// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IArbitrageStrategy.sol";
import "../libraries/SafeMath.sol";

/**
 * @title IntraDEXArbitrage
 * @dev Estrategia de arbitraje dentro del mismo DEX entre diferentes pools
 * Explota diferencias de precio entre pools de 2 y 3 activos en el mismo DEX
 */
contract IntraDEXArbitrage is IArbitrageStrategy {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    struct IntraDEXParams {
        address dexRouter;          // Router del DEX
        address tokenA;             // Token A
        address tokenB;             // Token B  
        address tokenC;             // Token C (opcional, para triangular)
        address[] pathAB;           // Ruta A -> B
        address[] pathBC;           // Ruta B -> C (si aplicable)
        address[] pathCA;           // Ruta C -> A (si aplicable)
        uint256 minAmountOut;       // Cantidad mínima de salida
        bool isTriangular;          // Si es arbitraje triangular
        uint256 deadline;           // Deadline para swaps
    }

    // Interface del router Uniswap V2
    interface IUniswapV2Router {
        function swapExactTokensForTokens(
            uint amountIn,
            uint amountOutMin,
            address[] calldata path,
            address to,
            uint deadline
        ) external returns (uint[] memory amounts);
        
        function getAmountsOut(uint amountIn, address[] calldata path)
            external view returns (uint[] memory amounts);
    }

    /**
     * @dev Ejecuta arbitraje intra-DEX
     */
    function execute(
        address asset,
        uint256 amount,
        bytes calldata data
    ) external override returns (uint256 profit) {
        IntraDEXParams memory params = abi.decode(data, (IntraDEXParams));
        
        uint256 initialBalance = IERC20(asset).balanceOf(address(this));
        
        if (params.isTriangular) {
            // Arbitraje triangular: A -> B -> C -> A
            profit = _executeTriangularArbitrage(asset, amount, params);
        } else {
            // Arbitraje simple: A -> B -> A
            profit = _executeSimpleArbitrage(asset, amount, params);
        }
        
        uint256 finalBalance = IERC20(asset).balanceOf(address(this));
        require(finalBalance > initialBalance, "No profit generated");
        
        profit = finalBalance.sub(initialBalance);
    }

    /**
     * @dev Ejecuta arbitraje triangular A->B->C->A
     */
    function _executeTriangularArbitrage(
        address asset,
        uint256 amount,
        IntraDEXParams memory params
    ) internal returns (uint256 profit) {
        IUniswapV2Router router = IUniswapV2Router(params.dexRouter);
        
        // Aprobar tokens para el router
        IERC20(asset).safeApprove(params.dexRouter, amount);
        
        // Paso 1: A -> B
        uint256[] memory amountsAB = router.swapExactTokensForTokens(
            amount,
            0, // amountOutMin (calculado off-chain)
            params.pathAB,
            address(this),
            params.deadline
        );
        
        uint256 amountB = amountsAB[amountsAB.length - 1];
        
        // Aprobar tokenB
        IERC20(params.tokenB).safeApprove(params.dexRouter, amountB);
        
        // Paso 2: B -> C
        uint256[] memory amountsBC = router.swapExactTokensForTokens(
            amountB,
            0,
            params.pathBC,
            address(this),
            params.deadline
        );
        
        uint256 amountC = amountsBC[amountsBC.length - 1];
        
        // Aprobar tokenC
        IERC20(params.tokenC).safeApprove(params.dexRouter, amountC);
        
        // Paso 3: C -> A
        uint256[] memory amountsCA = router.swapExactTokensForTokens(
            amountC,
            params.minAmountOut,
            params.pathCA,
            address(this),
            params.deadline
        );
        
        profit = amountsCA[amountsCA.length - 1];
    }

    /**
     * @dev Ejecuta arbitraje simple A->B->A
     */
    function _executeSimpleArbitrage(
        address asset,
        uint256 amount,
        IntraDEXParams memory params
    ) internal returns (uint256 profit) {
        IUniswapV2Router router = IUniswapV2Router(params.dexRouter);
        
        // Aprobar tokens
        IERC20(asset).safeApprove(params.dexRouter, amount);
        
        // Paso 1: A -> B (pool con mejor precio)
        uint256[] memory amountsAB = router.swapExactTokensForTokens(
            amount,
            0,
            params.pathAB,
            address(this),
            params.deadline
        );
        
        uint256 amountB = amountsAB[amountsAB.length - 1];
        
        // Aprobar tokenB
        IERC20(params.tokenB).safeApprove(params.dexRouter, amountB);
        
        // Paso 2: B -> A (pool diferente con peor precio para A->B)
        address[] memory pathBA = new address[](2);
        pathBA[0] = params.tokenB;
        pathBA[1] = params.tokenA;
        
        uint256[] memory amountsBA = router.swapExactTokensForTokens(
            amountB,
            params.minAmountOut,
            pathBA,
            address(this),
            params.deadline
        );
        
        profit = amountsBA[amountsBA.length - 1];
    }

    /**
     * @dev Simula la ejecución
     */
    function simulate(
        address asset,
        uint256 amount,
        bytes calldata data
    ) external view override returns (uint256 expectedProfit, uint256 gasEstimate) {
        IntraDEXParams memory params = abi.decode(data, (IntraDEXParams));
        IUniswapV2Router router = IUniswapV2Router(params.dexRouter);
        
        if (params.isTriangular) {
            // Simular triangular
            uint256[] memory amountsAB = router.getAmountsOut(amount, params.pathAB);
            uint256[] memory amountsBC = router.getAmountsOut(amountsAB[1], params.pathBC);
            uint256[] memory amountsCA = router.getAmountsOut(amountsBC[1], params.pathCA);
            
            expectedProfit = amountsCA[1] > amount ? amountsCA[1].sub(amount) : 0;
            gasEstimate = 350000; // Estimación para 3 swaps
        } else {
            // Simular simple
            uint256[] memory amountsAB = router.getAmountsOut(amount, params.pathAB);
            
            address[] memory pathBA = new address[](2);
            pathBA[0] = params.tokenB;
            pathBA[1] = params.tokenA;
            
            uint256[] memory amountsBA = router.getAmountsOut(amountsAB[1], pathBA);
            
            expectedProfit = amountsBA[1] > amount ? amountsBA[1].sub(amount) : 0;
            gasEstimate = 250000; // Estimación para 2 swaps
        }
    }

    /**
     * @dev Información de la estrategia
     */
    function getStrategyInfo() external pure override returns (
        string memory name,
        string memory description,
        uint8 riskLevel
    ) {
        name = "Intra-DEX Arbitrage";
        description = "Explota diferencias de precio entre pools dentro del mismo DEX";
        riskLevel = 3; // Riesgo medio-bajo
    }

    /**
     * @dev Verifica si puede ejecutarse
     */
    function canExecute(
        address asset,
        uint256 amount,
        bytes calldata data
    ) external view override returns (bool canExecute, string memory reason) {
        IntraDEXParams memory params = abi.decode(data, (IntraDEXParams));
        
        // Verificar que los tokens están configurados
        if (params.tokenA == address(0) || params.tokenB == address(0)) {
            return (false, "Invalid token addresses");
        }
        
        // Verificar que tenemos suficiente balance
        if (IERC20(asset).balanceOf(address(this)) < amount) {
            return (false, "Insufficient balance");
        }
        
        // Verificar deadline
        if (params.deadline <= block.timestamp) {
            return (false, "Deadline expired");
        }
        
        return (true, "");
    }
}
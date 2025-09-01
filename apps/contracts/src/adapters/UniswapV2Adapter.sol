// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "../interfaces/IDEXAdapter.sol";

/**
 * @title UniswapV2Adapter
 * @notice Adaptador para Uniswap V2 y forks compatibles
 * @dev Ingenio Pichichi S.A. - ArbitrageX Supreme
 * @author ArbitrageX Team
 */
contract UniswapV2Adapter is IDEXAdapter, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ Constants ============
    string public constant DEX_NAME = "UniswapV2";
    string public constant VERSION = "1.0.0";
    uint256 public constant SWAP_FEE = 30; // 0.3% in basis points
    uint256 public constant BASIS_POINTS = 10000;

    // ============ State Variables ============
    IUniswapV2Router02 public immutable router;
    IUniswapV2Factory public immutable factory;
    address public immutable WETH;

    // ============ Constructor ============
    constructor(
        address _router,
        address _factory,
        address _weth
    ) {
        require(_router != address(0), "UniswapV2Adapter: Invalid router");
        require(_factory != address(0), "UniswapV2Adapter: Invalid factory");
        require(_weth != address(0), "UniswapV2Adapter: Invalid WETH");
        
        router = IUniswapV2Router02(_router);
        factory = IUniswapV2Factory(_factory);
        WETH = _weth;
    }

    // ============ External Functions ============

    /**
     * @notice Ejecutar swap de tokens
     */
    function swap(SwapParams calldata params) 
        external 
        override 
        nonReentrant
        returns (uint256 amountOut) 
    {
        require(params.amountIn > 0, "UniswapV2Adapter: Invalid amount");
        require(params.deadline >= block.timestamp, "UniswapV2Adapter: Expired");
        require(
            isTokenPairSupported(params.tokenIn, params.tokenOut),
            "UniswapV2Adapter: Unsupported pair"
        );

        // Transfer tokens to this contract
        IERC20(params.tokenIn).safeTransferFrom(
            msg.sender, 
            address(this), 
            params.amountIn
        );

        // Approve router
        IERC20(params.tokenIn).forceApprove(address(router), params.amountIn);

        // Build path
        address[] memory path = _buildSwapPath(params.tokenIn, params.tokenOut);

        // Execute swap
        uint256[] memory amounts = router.swapExactTokensForTokens(
            params.amountIn,
            params.amountOutMinimum,
            path,
            msg.sender,
            params.deadline
        );

        amountOut = amounts[amounts.length - 1];

        emit SwapExecuted(
            params.tokenIn,
            params.tokenOut,
            params.amountIn,
            amountOut,
            msg.sender
        );
    }

    /**
     * @notice Obtener quote para swap
     */
    function getQuote(QuoteParams calldata params) 
        external 
        view 
        override 
        returns (uint256 amountOut, uint256 priceImpact) 
    {
        require(params.amountIn > 0, "UniswapV2Adapter: Invalid amount");
        require(
            isTokenPairSupported(params.tokenIn, params.tokenOut),
            "UniswapV2Adapter: Unsupported pair"
        );

        address[] memory path = _buildSwapPath(params.tokenIn, params.tokenOut);
        
        try router.getAmountsOut(params.amountIn, path) 
        returns (uint256[] memory amounts) {
            amountOut = amounts[amounts.length - 1];
            
            // Calculate price impact
            priceImpact = _calculatePriceImpact(
                params.tokenIn,
                params.tokenOut,
                params.amountIn,
                amountOut
            );
        } catch {
            // Return 0 if quote fails
            amountOut = 0;
            priceImpact = BASIS_POINTS; // 100% impact indicates failure
        }
    }

    /**
     * @notice Obtener mejor ruta para swap
     */
    function getBestRoute(
        address tokenIn, 
        address tokenOut, 
        uint256 amountIn
    ) 
        external 
        view 
        override 
        returns (bytes memory route, uint256 expectedOutput) 
    {
        address[] memory path = _buildSwapPath(tokenIn, tokenOut);
        route = abi.encode(path);

        try router.getAmountsOut(amountIn, path) 
        returns (uint256[] memory amounts) {
            expectedOutput = amounts[amounts.length - 1];
        } catch {
            expectedOutput = 0;
        }
    }

    /**
     * @notice Verificar soporte de par de tokens
     */
    function isTokenPairSupported(address tokenA, address tokenB) 
        public 
        view 
        override 
        returns (bool supported) 
    {
        if (tokenA == tokenB) return false;
        
        address pair = factory.getPair(tokenA, tokenB);
        return pair != address(0);
    }

    /**
     * @notice Obtener pools disponibles
     */
    function getAvailablePools(address tokenA, address tokenB) 
        external 
        view 
        override 
        returns (address[] memory pools, uint256[][] memory reserves) 
    {
        address pair = factory.getPair(tokenA, tokenB);
        
        if (pair != address(0)) {
            pools = new address[](1);
            reserves = new uint256[][](1);
            
            pools[0] = pair;
            
            (uint112 reserve0, uint112 reserve1,) = IUniswapV2Pair(pair).getReserves();
            reserves[0] = new uint256[](2);
            reserves[0][0] = uint256(reserve0);
            reserves[0][1] = uint256(reserve1);
        } else {
            pools = new address[](0);
            reserves = new uint256[][](0);
        }
    }

    /**
     * @notice Obtener fee de swap
     */
    function getSwapFee(address, address, address) 
        external 
        pure 
        override 
        returns (uint256 fee) 
    {
        return SWAP_FEE;
    }

    /**
     * @notice Obtener nombre del DEX
     */
    function getDEXName() external pure override returns (string memory name) {
        return DEX_NAME;
    }

    /**
     * @notice Obtener versión
     */
    function getVersion() external pure override returns (string memory version) {
        return VERSION;
    }

    /**
     * @notice Estimar gas para swap
     */
    function estimateGas(SwapParams calldata params) 
        external 
        view 
        override 
        returns (uint256 gasEstimate) 
    {
        // Simplified gas estimation for Uniswap V2
        if (_isDirectPair(params.tokenIn, params.tokenOut)) {
            return 150000; // Direct swap
        } else {
            return 250000; // Swap through WETH
        }
    }

    // ============ Internal Functions ============

    /**
     * @notice Construir path para swap
     */
    function _buildSwapPath(address tokenIn, address tokenOut) 
        internal 
        view 
        returns (address[] memory path) 
    {
        if (_isDirectPair(tokenIn, tokenOut)) {
            // Direct pair exists
            path = new address[](2);
            path[0] = tokenIn;
            path[1] = tokenOut;
        } else {
            // Route through WETH
            path = new address[](3);
            path[0] = tokenIn;
            path[1] = WETH;
            path[2] = tokenOut;
        }
    }

    /**
     * @notice Verificar si existe par directo
     */
    function _isDirectPair(address tokenA, address tokenB) 
        internal 
        view 
        returns (bool) 
    {
        return factory.getPair(tokenA, tokenB) != address(0);
    }

    /**
     * @notice Calcular impacto en precio
     */
    function _calculatePriceImpact(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut
    ) 
        internal 
        view 
        returns (uint256 priceImpact) 
    {
        address pair = factory.getPair(tokenIn, tokenOut);
        if (pair == address(0)) return BASIS_POINTS; // 100% if no direct pair

        (uint112 reserve0, uint112 reserve1,) = IUniswapV2Pair(pair).getReserves();
        
        address token0 = IUniswapV2Pair(pair).token0();
        (uint256 reserveIn, uint256 reserveOut) = tokenIn == token0 
            ? (uint256(reserve0), uint256(reserve1))
            : (uint256(reserve1), uint256(reserve0));

        // Calculate theoretical price without slippage
        uint256 theoreticalOut = (amountIn * reserveOut) / reserveIn;
        
        if (theoreticalOut > amountOut) {
            priceImpact = ((theoreticalOut - amountOut) * BASIS_POINTS) / theoreticalOut;
        } else {
            priceImpact = 0;
        }

        // Cap at 100%
        if (priceImpact > BASIS_POINTS) {
            priceImpact = BASIS_POINTS;
        }
    }
}
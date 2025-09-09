// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IDEXRouter
 * @dev Universal interface for DEX routers (Uniswap V2/V3, SushiSwap, etc.)
 * @notice Standardizes swap operations across different DEX protocols
 */
interface IDEXRouter {
    
    /**
     * @dev Struct for swap parameters
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @param amountIn Amount of input token
     * @param amountOutMin Minimum amount of output token
     * @param path Swap path (for multi-hop)
     * @param to Recipient address
     * @param deadline Transaction deadline
     * @param fee Fee tier (for Uniswap V3)
     */
    struct SwapParams {
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 amountOutMin;
        bytes path;
        address to;
        uint256 deadline;
        uint24 fee;
    }
    
    /**
     * @dev Executes an exact input swap
     * @param params Swap parameters
     * @return amountOut Amount of tokens received
     */
    function swapExactTokensForTokens(SwapParams calldata params) external returns (uint256 amountOut);
    
    /**
     * @dev Executes an exact output swap
     * @param params Swap parameters (amountIn becomes maxAmountIn)
     * @return amountIn Amount of tokens spent
     */
    function swapTokensForExactTokens(SwapParams calldata params) external returns (uint256 amountIn);
    
    /**
     * @dev Gets quote for exact input swap
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @param amountIn Amount of input token
     * @return amountOut Expected output amount
     */
    function getAmountsOut(address tokenIn, address tokenOut, uint256 amountIn) 
        external view returns (uint256 amountOut);
    
    /**
     * @dev Gets quote for exact output swap
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @param amountOut Amount of output token desired
     * @return amountIn Required input amount
     */
    function getAmountsIn(address tokenIn, address tokenOut, uint256 amountOut) 
        external view returns (uint256 amountIn);
    
    /**
     * @dev Checks if a trading pair exists
     * @param tokenA First token address
     * @param tokenB Second token address
     * @return exists Whether the pair exists
     * @return pairAddress Address of the pair (if exists)
     */
    function pairExists(address tokenA, address tokenB) 
        external view returns (bool exists, address pairAddress);
    
    /**
     * @dev Gets the factory address for this DEX
     * @return factory Factory contract address
     */
    function factory() external view returns (address factory);
    
    /**
     * @dev Gets DEX-specific information
     * @return name DEX name
     * @return version DEX version
     * @return dexType DEX type (V2, V3, etc.)
     */
    function getDEXInfo() external view returns (string memory name, string memory version, string memory dexType);
}
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * Mock Uniswap V2 Router for testing
 */
contract MockUniswapV2Router {
    address public factory;
    
    constructor() {
        factory = msg.sender; // Simple mock
    }
    
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts) {
        require(deadline >= block.timestamp, "UniswapV2Router: EXPIRED");
        require(path.length >= 2, "UniswapV2Router: INVALID_PATH");
        
        amounts = new uint[](path.length);
        amounts[0] = amountIn;
        
        // Mock: transfer tokens and simulate swap
        IERC20(path[0]).transferFrom(msg.sender, address(this), amountIn);
        
        // Calculate mock output (90% of input for simplicity)
        for (uint i = 1; i < path.length; i++) {
            amounts[i] = (amounts[i-1] * 90) / 100;
        }
        
        require(amounts[amounts.length - 1] >= amountOutMin, "UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT");
        
        // Mock transfer output tokens (if we had them)
        // IERC20(path[path.length - 1]).transfer(to, amounts[amounts.length - 1]);
        
        return amounts;
    }
    
    function getAmountsOut(uint amountIn, address[] calldata path) 
        external pure returns (uint[] memory amounts) {
        require(path.length >= 2, "UniswapV2Router: INVALID_PATH");
        
        amounts = new uint[](path.length);
        amounts[0] = amountIn;
        
        // Mock calculation: 90% output for each hop
        for (uint i = 1; i < path.length; i++) {
            amounts[i] = (amounts[i-1] * 90) / 100;
        }
        
        return amounts;
    }
    
    function getAmountsIn(uint amountOut, address[] calldata path)
        external pure returns (uint[] memory amounts) {
        require(path.length >= 2, "UniswapV2Router: INVALID_PATH");
        
        amounts = new uint[](path.length);
        amounts[amounts.length - 1] = amountOut;
        
        // Mock calculation: reverse of getAmountsOut
        for (uint i = path.length - 2; i >= 0; i--) {
            amounts[i] = (amounts[i + 1] * 100) / 90;
            if (i == 0) break; // Avoid underflow
        }
        
        return amounts;
    }
}
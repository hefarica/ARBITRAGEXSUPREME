// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../../core/ArbitrageExecutor.sol";

/**
 * @title PolygonArbitrage
 * @dev Polygon-specific arbitrage contract with optimized gas usage and native DEX integrations
 * @author ArbitrageX Team
 * 
 * Supported DEXs on Polygon:
 * - QuickSwap (V2/V3)
 * - SushiSwap
 * - Uniswap V3
 * - Balancer V2
 * - Curve
 * - DODO
 * - 1inch
 */
contract PolygonArbitrage is ArbitrageExecutor {
    
    // Polygon-specific addresses
    address public constant QUICKSWAP_ROUTER = 0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff;
    address public constant SUSHISWAP_ROUTER = 0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506;
    address public constant UNISWAP_V3_ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
    address public constant BALANCER_VAULT = 0xBA12222222228d8Ba445958a75a0704d566BF2C8;
    address public constant CURVE_REGISTRY = 0x094d12e5b541784701FD8d65F11fc0598FBC6332;
    address public constant DODO_PROXY = 0xa222f79794e89b0ae00dC84211C4f60DDD77C150;
    address public constant ONE_INCH_ROUTER = 0x11111112542D85B3EF69AE05771c2dCCff3596AE;
    
    // Aave V3 on Polygon
    address public constant AAVE_POOL = 0x794a61358D6845594F94dc1DB02A252b5b4814aD;
    
    // WMATIC address
    address public constant WMATIC = 0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270;
    
    // Common tokens on Polygon
    address public constant USDC = 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174;
    address public constant USDT = 0xc2132D05D31c914a87C6611C10748AEb04B58e8F;
    address public constant WETH = 0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619;
    address public constant WBTC = 0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6;
    address public constant DAI = 0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063;
    
    // DEX identifiers
    bytes32 public constant QUICKSWAP_ID = keccak256("QUICKSWAP");
    bytes32 public constant SUSHISWAP_ID = keccak256("SUSHISWAP");
    bytes32 public constant UNISWAP_V3_ID = keccak256("UNISWAP_V3");
    bytes32 public constant BALANCER_ID = keccak256("BALANCER");
    bytes32 public constant CURVE_ID = keccak256("CURVE");
    bytes32 public constant DODO_ID = keccak256("DODO");
    bytes32 public constant ONE_INCH_ID = keccak256("ONE_INCH");
    
    // Gas optimization constants for Polygon
    uint256 public constant POLYGON_GAS_LIMIT = 8000000; // Polygon block gas limit
    uint256 public constant OPTIMAL_GAS_PRICE = 30 gwei; // Optimal gas price for Polygon
    
    constructor() ArbitrageExecutor(msg.sender) {
        // Initialize Polygon-specific configurations
        _initializePolygonDEXs();
        _initializeFlashLoanProviders();
        
        // Set Polygon-optimized parameters
        maxGasPrice = 100 gwei; // Higher gas tolerance for MEV opportunities
        minProfitBps = 30; // 0.3% minimum profit (lower due to cheaper gas)
    }
    
    /**
     * @dev Initialize Polygon DEX routers
     */
    function _initializePolygonDEXs() internal {
        dexRouters[QUICKSWAP_ID] = QUICKSWAP_ROUTER;
        dexRouters[SUSHISWAP_ID] = SUSHISWAP_ROUTER;
        dexRouters[UNISWAP_V3_ID] = UNISWAP_V3_ROUTER;
        dexRouters[BALANCER_ID] = BALANCER_VAULT;
        dexRouters[CURVE_ID] = CURVE_REGISTRY;
        dexRouters[DODO_ID] = DODO_PROXY;
        dexRouters[ONE_INCH_ID] = ONE_INCH_ROUTER;
    }
    
    /**
     * @dev Initialize flash loan providers on Polygon
     */
    function _initializeFlashLoanProviders() internal {
        flashLoanProviders[FlashLoanLib.Provider.AAVE_V3] = AAVE_POOL;
        flashLoanProviders[FlashLoanLib.Provider.BALANCER_V2] = BALANCER_VAULT;
        // DODO and others can be added
    }
    
    /**
     * @dev Execute QuickSwap arbitrage opportunity
     * @param tokenA Input token
     * @param tokenB Output token  
     * @param amountIn Input amount
     * @param minAmountOut Minimum output amount
     * @param deadline Transaction deadline
     * @return amountOut Actual output amount
     */
    function executeQuickSwapArbitrage(
        address tokenA,
        address tokenB,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 deadline
    ) external onlyAuthorizedExecutor returns (uint256 amountOut) {
        
        IERC20(tokenA).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenA).safeApprove(QUICKSWAP_ROUTER, amountIn);
        
        address[] memory path = new address[](2);
        path[0] = tokenA;
        path[1] = tokenB;
        
        uint256[] memory amounts = IUniswapV2Router(QUICKSWAP_ROUTER).swapExactTokensForTokens(
            amountIn,
            minAmountOut,
            path,
            address(this),
            deadline
        );
        
        amountOut = amounts[1];
        
        // Transfer output to executor
        IERC20(tokenB).safeTransfer(msg.sender, amountOut);
        
        // Reset approval
        IERC20(tokenA).safeApprove(QUICKSWAP_ROUTER, 0);
    }
    
    /**
     * @dev Execute cross-DEX arbitrage on Polygon
     * @param buyDEX DEX to buy from (lower price)
     * @param sellDEX DEX to sell to (higher price)
     * @param token Token to arbitrage
     * @param amount Amount to arbitrage
     * @return profit Net profit from arbitrage
     */
    function executeCrossDEXArbitrage(
        bytes32 buyDEX,
        bytes32 sellDEX,
        address token,
        uint256 amount
    ) external onlyAuthorizedExecutor returns (uint256 profit) {
        
        address buyRouter = dexRouters[buyDEX];
        address sellRouter = dexRouters[sellDEX];
        
        require(buyRouter != address(0) && sellRouter != address(0), "PolygonArbitrage: Invalid DEX");
        
        uint256 balanceBefore = IERC20(token).balanceOf(address(this));
        
        // Step 1: Buy on cheaper DEX (buyDEX)
        _executeBuyOrder(buyRouter, buyDEX, token, amount);
        
        // Step 2: Sell on expensive DEX (sellDEX)  
        uint256 receivedAmount = IERC20(token).balanceOf(address(this)) - balanceBefore;
        _executeSellOrder(sellRouter, sellDEX, token, receivedAmount);
        
        uint256 balanceAfter = IERC20(token).balanceOf(address(this));
        profit = balanceAfter - balanceBefore;
        
        require(profit > 0, "PolygonArbitrage: No profit generated");
        
        // Transfer profit to executor
        IERC20(token).safeTransfer(msg.sender, profit);
    }
    
    /**
     * @dev Execute triangular arbitrage (USDC -> Token -> WETH -> USDC)
     * @param intermediateToken Token to use for triangular path
     * @param startAmount Initial USDC amount
     * @return finalAmount Final USDC amount after triangular arbitrage
     */
    function executeTriangularArbitrage(
        address intermediateToken,
        uint256 startAmount
    ) external onlyAuthorizedExecutor returns (uint256 finalAmount) {
        
        IERC20(USDC).safeTransferFrom(msg.sender, address(this), startAmount);
        
        // Path: USDC -> intermediateToken -> WETH -> USDC
        
        // Step 1: USDC -> intermediateToken (QuickSwap)
        uint256 intermediateAmount = _swapOnQuickSwap(USDC, intermediateToken, startAmount);
        
        // Step 2: intermediateToken -> WETH (SushiSwap)  
        uint256 wethAmount = _swapOnSushiSwap(intermediateToken, WETH, intermediateAmount);
        
        // Step 3: WETH -> USDC (Uniswap V3)
        finalAmount = _swapOnUniswapV3(WETH, USDC, wethAmount);
        
        require(finalAmount > startAmount, "PolygonArbitrage: Triangular arbitrage not profitable");
        
        // Transfer final amount to executor
        IERC20(USDC).safeTransfer(msg.sender, finalAmount);
    }
    
    /**
     * @dev Execute flash loan arbitrage on Polygon
     * @param asset Flash loan asset
     * @param amount Flash loan amount
     * @param arbData Encoded arbitrage strategy data
     * @return profit Net profit after flash loan fees
     */
    function executePolygonFlashArbitrage(
        address asset,
        uint256 amount,
        bytes calldata arbData
    ) external onlyAuthorizedExecutor returns (uint256 profit) {
        
        require(asset != address(0) && amount > 0, "PolygonArbitrage: Invalid flash loan params");
        
        // Estimate flash loan profitability
        uint256 flashLoanFee = FlashLoanLib.calculateFlashLoanFee(FlashLoanLib.Provider.AAVE_V3, amount);
        uint256 estimatedGasCost = tx.gasprice * 300000; // Estimated gas for complex arbitrage
        
        // Execute flash loan
        FlashLoanParams memory flashParams = FlashLoanParams({
            asset: asset,
            amount: amount,
            strategyData: arbData
        });
        
        // This will trigger the flash loan callback
        _executeFlashLoan(asset, amount, arbData);
        
        // Calculate final profit
        profit = IERC20(asset).balanceOf(address(this));
        require(profit > flashLoanFee + estimatedGasCost, "PolygonArbitrage: Flash arbitrage not profitable");
        
        // Transfer net profit to executor
        IERC20(asset).safeTransfer(msg.sender, profit);
    }
    
    // Internal helper functions
    function _executeBuyOrder(address router, bytes32 dexId, address token, uint256 amount) internal {
        if (dexId == QUICKSWAP_ID || dexId == SUSHISWAP_ID) {
            _swapOnUniswapV2Style(router, USDC, token, amount);
        } else if (dexId == UNISWAP_V3_ID) {
            _swapOnUniswapV3(USDC, token, amount);
        }
        // Add other DEX implementations
    }
    
    function _executeSellOrder(address router, bytes32 dexId, address token, uint256 amount) internal {
        if (dexId == QUICKSWAP_ID || dexId == SUSHISWAP_ID) {
            _swapOnUniswapV2Style(router, token, USDC, amount);
        } else if (dexId == UNISWAP_V3_ID) {
            _swapOnUniswapV3(token, USDC, amount);
        }
        // Add other DEX implementations
    }
    
    function _swapOnQuickSwap(address tokenIn, address tokenOut, uint256 amountIn) internal returns (uint256 amountOut) {
        return _swapOnUniswapV2Style(QUICKSWAP_ROUTER, tokenIn, tokenOut, amountIn);
    }
    
    function _swapOnSushiSwap(address tokenIn, address tokenOut, uint256 amountIn) internal returns (uint256 amountOut) {
        return _swapOnUniswapV2Style(SUSHISWAP_ROUTER, tokenIn, tokenOut, amountIn);
    }
    
    function _swapOnUniswapV2Style(address router, address tokenIn, address tokenOut, uint256 amountIn) internal returns (uint256 amountOut) {
        IERC20(tokenIn).safeApprove(router, amountIn);
        
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;
        
        uint256[] memory amounts = IUniswapV2Router(router).swapExactTokensForTokens(
            amountIn,
            0, // Accept any amount of tokens out
            path,
            address(this),
            block.timestamp + 300
        );
        
        amountOut = amounts[1];
        IERC20(tokenIn).safeApprove(router, 0);
    }
    
    function _swapOnUniswapV3(address tokenIn, address tokenOut, uint256 amountIn) internal returns (uint256 amountOut) {
        IERC20(tokenIn).safeApprove(UNISWAP_V3_ROUTER, amountIn);
        
        IUniswapV3Router.ExactInputSingleParams memory params = IUniswapV3Router.ExactInputSingleParams({
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            fee: 3000, // 0.3% fee tier
            recipient: address(this),
            deadline: block.timestamp + 300,
            amountIn: amountIn,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0
        });
        
        amountOut = IUniswapV3Router(UNISWAP_V3_ROUTER).exactInputSingle(params);
        IERC20(tokenIn).safeApprove(UNISWAP_V3_ROUTER, 0);
    }
    
    /**
     * @dev Get optimal arbitrage path for given tokens
     * @param tokenA Input token
     * @param tokenB Output token
     * @param amount Amount to arbitrage
     * @return bestBuyDEX Best DEX to buy from
     * @return bestSellDEX Best DEX to sell to
     * @return estimatedProfit Estimated profit
     */
    function getOptimalArbitragePath(
        address tokenA,
        address tokenB,
        uint256 amount
    ) external view returns (
        bytes32 bestBuyDEX,
        bytes32 bestSellDEX,
        uint256 estimatedProfit
    ) {
        // Query prices from all DEXs
        uint256 bestBuyPrice = type(uint256).max;
        uint256 bestSellPrice = 0;
        
        bytes32[] memory dexIds = new bytes32[](3);
        dexIds[0] = QUICKSWAP_ID;
        dexIds[1] = SUSHISWAP_ID;
        dexIds[2] = UNISWAP_V3_ID;
        
        for (uint256 i = 0; i < dexIds.length; i++) {
            uint256 buyPrice = _getPrice(dexIds[i], tokenA, tokenB, amount, true);
            uint256 sellPrice = _getPrice(dexIds[i], tokenA, tokenB, amount, false);
            
            if (buyPrice < bestBuyPrice) {
                bestBuyPrice = buyPrice;
                bestBuyDEX = dexIds[i];
            }
            
            if (sellPrice > bestSellPrice) {
                bestSellPrice = sellPrice;
                bestSellDEX = dexIds[i];
            }
        }
        
        if (bestSellPrice > bestBuyPrice) {
            estimatedProfit = bestSellPrice - bestBuyPrice;
        }
    }
    
    function _getPrice(bytes32 dexId, address tokenA, address tokenB, uint256 amount, bool isBuy) internal view returns (uint256 price) {
        // Simplified price lookup - actual implementation would call getAmountsOut
        price = amount; // Placeholder
    }
    
    /**
     * @dev Emergency rescue for Polygon-specific tokens
     */
    function emergencyRescuePolygonTokens() external onlyOwner {
        address[] memory polygonTokens = new address[](6);
        polygonTokens[0] = WMATIC;
        polygonTokens[1] = USDC;
        polygonTokens[2] = USDT;
        polygonTokens[3] = WETH;
        polygonTokens[4] = WBTC;
        polygonTokens[5] = DAI;
        
        for (uint256 i = 0; i < polygonTokens.length; i++) {
            uint256 balance = IERC20(polygonTokens[i]).balanceOf(address(this));
            if (balance > 0) {
                IERC20(polygonTokens[i]).safeTransfer(owner(), balance);
            }
        }
    }
}
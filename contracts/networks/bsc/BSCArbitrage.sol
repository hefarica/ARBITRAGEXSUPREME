// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../../core/ArbitrageExecutor.sol";

/**
 * @title BSCArbitrage
 * @dev Binance Smart Chain specific arbitrage contract with optimized gas and native DEX integrations
 * @author ArbitrageX Team
 * 
 * Supported DEXs on BSC:
 * - PancakeSwap V2/V3
 * - Biswap
 * - SushiSwap
 * - Uniswap V3
 * - 1inch
 * - DODO
 * - Venus Protocol (flash loans)
 */
contract BSCArbitrage is ArbitrageExecutor {
    
    // BSC-specific DEX addresses
    address public constant PANCAKESWAP_V2_ROUTER = 0x10ED43C718714eb63d5aA57B78B54704E256024E;
    address public constant PANCAKESWAP_V3_ROUTER = 0x13f4EA83D0bd40E75C8222255bc855a974568Dd4;
    address public constant BISWAP_ROUTER = 0x3a6d8cA21D1CF76F653A67577FA0D27453350dD8;
    address public constant SUSHISWAP_ROUTER = 0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506;
    address public constant UNISWAP_V3_ROUTER = 0xB971eF87ede563556b2ED4b1C0b0019111Dd85d2;
    address public constant ONE_INCH_ROUTER = 0x11111112542D85B3EF69AE05771c2dCCff3596AE;
    address public constant DODO_PROXY = 0x8F8Dd7DB1bDA5eD3da8C9daf3bfa471c12d58486;
    
    // Venus Protocol (Compound fork) for flash loans
    address public constant VENUS_UNITROLLER = 0xfD36E2c2a6789Db23113685031d7F16329158384;
    
    // WBNB address
    address public constant WBNB = 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c;
    
    // Common tokens on BSC
    address public constant USDC = 0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d;
    address public constant USDT = 0x55d398326f99059fF775485246999027B3197955;
    address public constant BUSD = 0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56;
    address public constant WETH = 0x2170Ed0880ac9A755fd29B2688956BD959F933F8;
    address public constant BTCB = 0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c;
    address public constant DAI = 0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3;
    address public constant CAKE = 0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82;
    
    // DEX identifiers
    bytes32 public constant PANCAKESWAP_V2_ID = keccak256("PANCAKESWAP_V2");
    bytes32 public constant PANCAKESWAP_V3_ID = keccak256("PANCAKESWAP_V3");
    bytes32 public constant BISWAP_ID = keccak256("BISWAP");
    bytes32 public constant SUSHISWAP_ID = keccak256("SUSHISWAP");
    bytes32 public constant UNISWAP_V3_BSC_ID = keccak256("UNISWAP_V3_BSC");
    bytes32 public constant ONE_INCH_BSC_ID = keccak256("ONE_INCH_BSC");
    bytes32 public constant DODO_BSC_ID = keccak256("DODO_BSC");
    
    // BSC gas optimization constants
    uint256 public constant BSC_GAS_LIMIT = 140000000; // BSC higher gas limit
    uint256 public constant OPTIMAL_BSC_GAS_PRICE = 3 gwei; // Lower gas on BSC
    
    // PancakeSwap specific constants
    uint256 public constant PANCAKE_FEE = 25; // 0.25% for V2
    uint256 public constant PANCAKE_V3_FEE_LOW = 100; // 0.01%
    uint256 public constant PANCAKE_V3_FEE_MEDIUM = 500; // 0.05%
    uint256 public constant PANCAKE_V3_FEE_HIGH = 2500; // 0.25%
    
    constructor() ArbitrageExecutor(msg.sender) {
        // Initialize BSC-specific configurations
        _initializeBSCDEXs();
        _initializeBSCFlashLoanProviders();
        
        // Set BSC-optimized parameters
        maxGasPrice = 20 gwei; // BSC has lower gas costs
        minProfitBps = 25; // 0.25% minimum profit (lower due to cheaper gas)
    }
    
    /**
     * @dev Initialize BSC DEX routers
     */
    function _initializeBSCDEXs() internal {
        dexRouters[PANCAKESWAP_V2_ID] = PANCAKESWAP_V2_ROUTER;
        dexRouters[PANCAKESWAP_V3_ID] = PANCAKESWAP_V3_ROUTER;
        dexRouters[BISWAP_ID] = BISWAP_ROUTER;
        dexRouters[SUSHISWAP_ID] = SUSHISWAP_ROUTER;
        dexRouters[UNISWAP_V3_BSC_ID] = UNISWAP_V3_ROUTER;
        dexRouters[ONE_INCH_BSC_ID] = ONE_INCH_ROUTER;
        dexRouters[DODO_BSC_ID] = DODO_PROXY;
    }
    
    /**
     * @dev Initialize flash loan providers on BSC
     */
    function _initializeBSCFlashLoanProviders() internal {
        // Venus Protocol doesn't have direct flash loans, but we can use DODO
        flashLoanProviders[FlashLoanLib.Provider.DODO] = DODO_PROXY;
        // PancakeSwap V3 pools can be used for flash loans
    }
    
    /**
     * @dev Execute PancakeSwap V2 arbitrage opportunity
     * @param tokenA Input token
     * @param tokenB Output token
     * @param amountIn Input amount
     * @param minAmountOut Minimum output amount
     * @param deadline Transaction deadline
     * @return amountOut Actual output amount
     */
    function executePancakeSwapV2Arbitrage(
        address tokenA,
        address tokenB,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 deadline
    ) external onlyAuthorizedExecutor returns (uint256 amountOut) {
        
        IERC20(tokenA).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenA).safeApprove(PANCAKESWAP_V2_ROUTER, amountIn);
        
        address[] memory path = new address[](2);
        path[0] = tokenA;
        path[1] = tokenB;
        
        uint256[] memory amounts = IPancakeSwapRouter(PANCAKESWAP_V2_ROUTER).swapExactTokensForTokens(
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
        IERC20(tokenA).safeApprove(PANCAKESWAP_V2_ROUTER, 0);
    }
    
    /**
     * @dev Execute cross-DEX arbitrage on BSC (PancakeSwap vs Biswap)
     * @param buyDEX DEX to buy from (lower price)
     * @param sellDEX DEX to sell to (higher price)
     * @param token Token to arbitrage
     * @param amount Amount to arbitrage
     * @return profit Net profit from arbitrage
     */
    function executeBSCCrossDEXArbitrage(
        bytes32 buyDEX,
        bytes32 sellDEX,
        address token,
        uint256 amount
    ) external onlyAuthorizedExecutor returns (uint256 profit) {
        
        address buyRouter = dexRouters[buyDEX];
        address sellRouter = dexRouters[sellDEX];
        
        require(buyRouter != address(0) && sellRouter != address(0), "BSCArbitrage: Invalid DEX");
        
        uint256 balanceBefore = IERC20(token).balanceOf(address(this));
        
        // Step 1: Buy on cheaper DEX
        _executeBSCBuyOrder(buyRouter, buyDEX, token, amount);
        
        // Step 2: Sell on expensive DEX
        uint256 receivedAmount = IERC20(token).balanceOf(address(this)) - balanceBefore;
        _executeBSCSellOrder(sellRouter, sellDEX, token, receivedAmount);
        
        uint256 balanceAfter = IERC20(token).balanceOf(address(this));
        profit = balanceAfter - balanceBefore;
        
        require(profit > 0, "BSCArbitrage: No profit generated");
        
        // Transfer profit to executor
        IERC20(token).safeTransfer(msg.sender, profit);
    }
    
    /**
     * @dev Execute CAKE-BNB-BUSD triangular arbitrage
     * @param startAmount Initial BUSD amount
     * @return finalAmount Final BUSD amount after triangular arbitrage
     */
    function executeBSCTriangularArbitrage(
        uint256 startAmount
    ) external onlyAuthorizedExecutor returns (uint256 finalAmount) {
        
        IERC20(BUSD).safeTransferFrom(msg.sender, address(this), startAmount);
        
        // Path: BUSD -> CAKE -> WBNB -> BUSD
        
        // Step 1: BUSD -> CAKE (PancakeSwap V2)
        uint256 cakeAmount = _swapOnPancakeSwapV2(BUSD, CAKE, startAmount);
        
        // Step 2: CAKE -> WBNB (Biswap for different pricing)
        uint256 bnbAmount = _swapOnBiswap(CAKE, WBNB, cakeAmount);
        
        // Step 3: WBNB -> BUSD (PancakeSwap V3 for efficiency)
        finalAmount = _swapOnPancakeSwapV3(WBNB, BUSD, bnbAmount, PANCAKE_V3_FEE_MEDIUM);
        
        require(finalAmount > startAmount, "BSCArbitrage: Triangular arbitrage not profitable");
        
        // Transfer final amount to executor
        IERC20(BUSD).safeTransfer(msg.sender, finalAmount);
    }
    
    /**
     * @dev Execute BSC flash loan arbitrage using DODO
     * @param asset Flash loan asset
     * @param amount Flash loan amount
     * @param arbData Encoded arbitrage strategy data
     * @return profit Net profit after flash loan fees
     */
    function executeBSCFlashArbitrage(
        address asset,
        uint256 amount,
        bytes calldata arbData
    ) external onlyAuthorizedExecutor returns (uint256 profit) {
        
        require(asset != address(0) && amount > 0, "BSCArbitrage: Invalid flash loan params");
        
        // DODO flash loan has 0% fee but requires profitable trade
        uint256 estimatedGasCost = tx.gasprice * 250000; // Lower gas estimate for BSC
        
        // Execute DODO flash loan
        _executeDODOFlashLoan(asset, amount, arbData);
        
        // Calculate final profit
        profit = IERC20(asset).balanceOf(address(this));
        require(profit > estimatedGasCost, "BSCArbitrage: Flash arbitrage not profitable");
        
        // Transfer net profit to executor
        IERC20(asset).safeTransfer(msg.sender, profit);
    }
    
    /**
     * @dev Execute multi-hop arbitrage (USDT -> BNB -> CAKE -> USDT)
     * @param startAmount Initial USDT amount
     * @param minFinalAmount Minimum final USDT amount
     * @return finalAmount Final USDT amount
     */
    function executeBSCMultiHopArbitrage(
        uint256 startAmount,
        uint256 minFinalAmount
    ) external onlyAuthorizedExecutor returns (uint256 finalAmount) {
        
        IERC20(USDT).safeTransferFrom(msg.sender, address(this), startAmount);
        
        // Multi-hop path using different DEXs for each leg
        // USDT -> WBNB (PancakeSwap V2)
        uint256 bnbAmount = _swapOnPancakeSwapV2(USDT, WBNB, startAmount);
        
        // WBNB -> CAKE (Biswap)
        uint256 cakeAmount = _swapOnBiswap(WBNB, CAKE, bnbAmount);
        
        // CAKE -> USDT (PancakeSwap V3)
        finalAmount = _swapOnPancakeSwapV3(CAKE, USDT, cakeAmount, PANCAKE_V3_FEE_MEDIUM);
        
        require(finalAmount >= minFinalAmount, "BSCArbitrage: Multi-hop arbitrage below minimum");
        
        // Transfer final amount to executor
        IERC20(USDT).safeTransfer(msg.sender, finalAmount);
    }
    
    // Internal helper functions for BSC
    function _executeBSCBuyOrder(address router, bytes32 dexId, address token, uint256 amount) internal {
        if (dexId == PANCAKESWAP_V2_ID || dexId == BISWAP_ID || dexId == SUSHISWAP_ID) {
            _swapOnPancakeStyleRouter(router, USDT, token, amount);
        } else if (dexId == PANCAKESWAP_V3_ID || dexId == UNISWAP_V3_BSC_ID) {
            _swapOnPancakeSwapV3(USDT, token, amount, PANCAKE_V3_FEE_MEDIUM);
        }
    }
    
    function _executeBSCSellOrder(address router, bytes32 dexId, address token, uint256 amount) internal {
        if (dexId == PANCAKESWAP_V2_ID || dexId == BISWAP_ID || dexId == SUSHISWAP_ID) {
            _swapOnPancakeStyleRouter(router, token, USDT, amount);
        } else if (dexId == PANCAKESWAP_V3_ID || dexId == UNISWAP_V3_BSC_ID) {
            _swapOnPancakeSwapV3(token, USDT, amount, PANCAKE_V3_FEE_MEDIUM);
        }
    }
    
    function _swapOnPancakeSwapV2(address tokenIn, address tokenOut, uint256 amountIn) internal returns (uint256 amountOut) {
        return _swapOnPancakeStyleRouter(PANCAKESWAP_V2_ROUTER, tokenIn, tokenOut, amountIn);
    }
    
    function _swapOnBiswap(address tokenIn, address tokenOut, uint256 amountIn) internal returns (uint256 amountOut) {
        return _swapOnPancakeStyleRouter(BISWAP_ROUTER, tokenIn, tokenOut, amountIn);
    }
    
    function _swapOnPancakeStyleRouter(address router, address tokenIn, address tokenOut, uint256 amountIn) internal returns (uint256 amountOut) {
        IERC20(tokenIn).safeApprove(router, amountIn);
        
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;
        
        uint256[] memory amounts = IPancakeSwapRouter(router).swapExactTokensForTokens(
            amountIn,
            0, // Accept any amount of tokens out
            path,
            address(this),
            block.timestamp + 300
        );
        
        amountOut = amounts[1];
        IERC20(tokenIn).safeApprove(router, 0);
    }
    
    function _swapOnPancakeSwapV3(address tokenIn, address tokenOut, uint256 amountIn, uint256 fee) internal returns (uint256 amountOut) {
        IERC20(tokenIn).safeApprove(PANCAKESWAP_V3_ROUTER, amountIn);
        
        IUniswapV3Router.ExactInputSingleParams memory params = IUniswapV3Router.ExactInputSingleParams({
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            fee: uint24(fee),
            recipient: address(this),
            deadline: block.timestamp + 300,
            amountIn: amountIn,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0
        });
        
        amountOut = IUniswapV3Router(PANCAKESWAP_V3_ROUTER).exactInputSingle(params);
        IERC20(tokenIn).safeApprove(PANCAKESWAP_V3_ROUTER, 0);
    }
    
    function _executeDODOFlashLoan(address asset, uint256 amount, bytes memory data) internal {
        // DODO flash loan implementation
        // This would call DODO's flashloan function
        IDODOProxy(DODO_PROXY).dodoSwapV1{value: 0}(
            asset,
            asset,
            amount,
            1,
            new address[](0),
            "",
            false,
            block.timestamp + 300
        );
    }
    
    /**
     * @dev Get optimal BSC arbitrage path
     * @param tokenA Input token
     * @param tokenB Output token
     * @param amount Amount to arbitrage
     * @return bestBuyDEX Best DEX to buy from
     * @return bestSellDEX Best DEX to sell to
     * @return estimatedProfit Estimated profit
     */
    function getBSCOptimalArbitragePath(
        address tokenA,
        address tokenB,
        uint256 amount
    ) external view returns (
        bytes32 bestBuyDEX,
        bytes32 bestSellDEX,
        uint256 estimatedProfit
    ) {
        // Query prices from all BSC DEXs
        uint256 bestBuyPrice = type(uint256).max;
        uint256 bestSellPrice = 0;
        
        bytes32[] memory bscDexIds = new bytes32[](4);
        bscDexIds[0] = PANCAKESWAP_V2_ID;
        bscDexIds[1] = PANCAKESWAP_V3_ID;
        bscDexIds[2] = BISWAP_ID;
        bscDexIds[3] = SUSHISWAP_ID;
        
        for (uint256 i = 0; i < bscDexIds.length; i++) {
            uint256 buyPrice = _getBSCPrice(bscDexIds[i], tokenA, tokenB, amount, true);
            uint256 sellPrice = _getBSCPrice(bscDexIds[i], tokenA, tokenB, amount, false);
            
            if (buyPrice < bestBuyPrice) {
                bestBuyPrice = buyPrice;
                bestBuyDEX = bscDexIds[i];
            }
            
            if (sellPrice > bestSellPrice) {
                bestSellPrice = sellPrice;
                bestSellDEX = bscDexIds[i];
            }
        }
        
        if (bestSellPrice > bestBuyPrice) {
            estimatedProfit = bestSellPrice - bestBuyPrice;
        }
    }
    
    function _getBSCPrice(bytes32 dexId, address tokenA, address tokenB, uint256 amount, bool isBuy) internal view returns (uint256 price) {
        // Simplified price lookup for BSC DEXs
        price = amount; // Placeholder
    }
    
    /**
     * @dev Emergency rescue for BSC-specific tokens
     */
    function emergencyRescueBSCTokens() external onlyOwner {
        address[] memory bscTokens = new address[](7);
        bscTokens[0] = WBNB;
        bscTokens[1] = USDC;
        bscTokens[2] = USDT;
        bscTokens[3] = BUSD;
        bscTokens[4] = WETH;
        bscTokens[5] = BTCB;
        bscTokens[6] = CAKE;
        
        for (uint256 i = 0; i < bscTokens.length; i++) {
            uint256 balance = IERC20(bscTokens[i]).balanceOf(address(this));
            if (balance > 0) {
                IERC20(bscTokens[i]).safeTransfer(owner(), balance);
            }
        }
    }
    
    /**
     * @dev Get BSC network information
     */
    function getBSCNetworkInfo() external view returns (
        uint256 blockNumber,
        uint256 gasPrice,
        uint256 gasLimit,
        address[] memory supportedTokens
    ) {
        blockNumber = block.number;
        gasPrice = tx.gasprice;
        gasLimit = BSC_GAS_LIMIT;
        
        supportedTokens = new address[](7);
        supportedTokens[0] = WBNB;
        supportedTokens[1] = USDC;
        supportedTokens[2] = USDT;
        supportedTokens[3] = BUSD;
        supportedTokens[4] = WETH;
        supportedTokens[5] = BTCB;
        supportedTokens[6] = CAKE;
    }
}

// BSC-specific interfaces
interface IDODOProxy {
    function dodoSwapV1(
        address fromToken,
        address toToken,
        uint256 fromTokenAmount,
        uint256 minReturnAmount,
        address[] memory dodoPairs,
        bytes memory directions,
        bool isIncentive,
        uint256 deadLine
    ) external payable returns (uint256 returnAmount);
}
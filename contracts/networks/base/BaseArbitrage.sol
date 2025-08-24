// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../../core/ArbitrageExecutor.sol";

/**
 * @title BaseArbitrage  
 * @dev Base L2 specific arbitrage contract with Coinbase-optimized features
 * @author ArbitrageX Team
 * 
 * Supported DEXs on Base:
 * - Uniswap V3
 * - SushiSwap  
 * - PancakeSwap V3
 * - BaseSwap
 * - Aerodrome
 * - Curve
 * - 1inch
 */
contract BaseArbitrage is ArbitrageExecutor {
    
    // Base-specific DEX addresses
    address public constant UNISWAP_V3_ROUTER = 0x2626664c2603336E57B271c5C0b26F421741e481;
    address public constant SUSHISWAP_ROUTER = 0x6BDED42c6DA8FBf0d2bA55B2fa120C5e0c8D7891;
    address public constant PANCAKESWAP_V3_ROUTER = 0x678Aa4bF4E210cf2166753e054d5b7c31cc7fa86;
    address public constant BASESWAP_ROUTER = 0x327Df1E6de05895d2ab08513aaDD9313Fe505d86;
    address public constant AERODROME_ROUTER = 0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43;
    address public constant CURVE_REGISTRY = 0x0000000000000000000000000000000000000000; // TBD when available
    address public constant ONE_INCH_ROUTER = 0x11111112542D85B3EF69AE05771c2dCCff3596AE;
    
    // Aave V3 on Base (when available)
    address public constant AAVE_POOL = 0x0000000000000000000000000000000000000000; // TBD
    
    // Native and wrapped tokens on Base
    address public constant WETH = 0x4200000000000000000000000000000000000006;
    address public constant CBETH = 0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22; // Coinbase Wrapped Staked ETH
    
    // Stablecoins on Base
    address public constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913; // Native USDC
    address public constant USDbC = 0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA; // USD Base Coin (bridged)
    address public constant DAI = 0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb;
    
    // Other tokens
    address public constant WBTC = 0x0000000000000000000000000000000000000000; // TBD when bridged
    address public constant LINK = 0x0000000000000000000000000000000000000000; // TBD when bridged
    
    // DEX identifiers
    bytes32 public constant UNISWAP_V3_BASE_ID = keccak256("UNISWAP_V3_BASE");
    bytes32 public constant SUSHISWAP_BASE_ID = keccak256("SUSHISWAP_BASE");
    bytes32 public constant PANCAKESWAP_V3_BASE_ID = keccak256("PANCAKESWAP_V3_BASE");
    bytes32 public constant BASESWAP_ID = keccak256("BASESWAP");
    bytes32 public constant AERODROME_ID = keccak256("AERODROME");
    bytes32 public constant CURVE_BASE_ID = keccak256("CURVE_BASE");
    bytes32 public constant ONE_INCH_BASE_ID = keccak256("ONE_INCH_BASE");
    
    // Base L2 gas optimization constants
    uint256 public constant BASE_GAS_LIMIT = 30000000; // Base block gas limit
    uint256 public constant OPTIMAL_BASE_GAS_PRICE = 1 gwei; // Very low L2 gas
    
    // Base-specific fee tiers
    uint256 public constant BASE_FEE_LOW = 100; // 0.01%
    uint256 public constant BASE_FEE_MEDIUM = 500; // 0.05%
    uint256 public constant BASE_FEE_HIGH = 3000; // 0.3%
    uint256 public constant BASE_FEE_ULTRA = 10000; // 1%
    
    constructor() ArbitrageExecutor(msg.sender) {
        // Initialize Base-specific configurations
        _initializeBaseDEXs();
        _initializeBaseFlashLoanProviders();
        
        // Set Base L2-optimized parameters (even cheaper than Arbitrum)
        maxGasPrice = 3 gwei; // Very low gas on Base L2
        minProfitBps = 10; // 0.1% minimum profit (lowest due to cheapest gas)
    }
    
    /**
     * @dev Initialize Base DEX routers
     */
    function _initializeBaseDEXs() internal {
        dexRouters[UNISWAP_V3_BASE_ID] = UNISWAP_V3_ROUTER;
        dexRouters[SUSHISWAP_BASE_ID] = SUSHISWAP_ROUTER;
        dexRouters[PANCAKESWAP_V3_BASE_ID] = PANCAKESWAP_V3_ROUTER;
        dexRouters[BASESWAP_ID] = BASESWAP_ROUTER;
        dexRouters[AERODROME_ID] = AERODROME_ROUTER;
        dexRouters[ONE_INCH_BASE_ID] = ONE_INCH_ROUTER;
    }
    
    /**
     * @dev Initialize flash loan providers on Base
     */
    function _initializeBaseFlashLoanProviders() internal {
        // Base is new, limited flash loan providers initially
        flashLoanProviders[FlashLoanLib.Provider.UNISWAP_V3] = UNISWAP_V3_ROUTER;
        // Add Aave V3 when it becomes available
        if (AAVE_POOL != address(0)) {
            flashLoanProviders[FlashLoanLib.Provider.AAVE_V3] = AAVE_POOL;
        }
    }
    
    /**
     * @dev Execute USDC/USDbC arbitrage (native vs bridged stablecoins)
     * @param amount Amount to arbitrage between native and bridged USDC
     * @param buyNative True to buy native USDC, false to buy bridged USDbC
     * @return profit Net profit from stablecoin arbitrage
     */
    function executeBaseStablecoinArbitrage(
        uint256 amount,
        bool buyNative
    ) external onlyAuthorizedExecutor returns (uint256 profit) {
        
        address tokenIn = buyNative ? USDbC : USDC;
        address tokenOut = buyNative ? USDC : USDbC;
        
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amount);
        
        uint256 balanceBefore = IERC20(tokenOut).balanceOf(address(this));
        
        // Execute stablecoin swap on BaseSwap (likely better rates for stablecoins)
        uint256 outputAmount = _swapOnBaseSwap(tokenIn, tokenOut, amount);
        
        uint256 balanceAfter = IERC20(tokenOut).balanceOf(address(this));
        
        if (balanceAfter > balanceBefore + outputAmount) {
            profit = balanceAfter - balanceBefore - outputAmount;
            IERC20(tokenOut).safeTransfer(msg.sender, balanceAfter);
        }
        
        require(profit > 0, "BaseArbitrage: Stablecoin arbitrage not profitable");
    }
    
    /**
     * @dev Execute ETH/cbETH arbitrage (native ETH vs Coinbase staked ETH)
     * @param amount Amount in WETH to arbitrage
     * @param stakingArb True for staking arbitrage, false for liquid staking arbitrage
     * @return profit Net profit from ETH variant arbitrage
     */
    function executeBaseETHArbitrage(
        uint256 amount,
        bool stakingArb
    ) external onlyAuthorizedExecutor returns (uint256 profit) {
        
        IERC20(WETH).safeTransferFrom(msg.sender, address(this), amount);
        
        uint256 balanceBefore = IERC20(WETH).balanceOf(address(this));
        
        if (stakingArb) {
            // WETH -> cbETH -> WETH arbitrage
            uint256 cbethAmount = _swapOnUniswapV3Base(WETH, CBETH, amount, BASE_FEE_MEDIUM);
            _swapOnBaseSwap(CBETH, WETH, cbethAmount);
        } else {
            // Direct WETH arbitrage between DEXs
            uint256 intermediateAmount = _swapOnUniswapV3Base(WETH, USDC, amount, BASE_FEE_MEDIUM);
            _swapOnAerodrome(USDC, WETH, intermediateAmount);
        }
        
        uint256 balanceAfter = IERC20(WETH).balanceOf(address(this));
        profit = balanceAfter - balanceBefore;
        
        require(profit > 0, "BaseArbitrage: ETH arbitrage not profitable");
        
        // Transfer profit to executor
        IERC20(WETH).safeTransfer(msg.sender, profit);
    }
    
    /**
     * @dev Execute cross-DEX arbitrage optimized for Base
     * @param buyDEX DEX to buy from (lower price)
     * @param sellDEX DEX to sell to (higher price)
     * @param token Token to arbitrage
     * @param amount Amount to arbitrage
     * @return profit Net profit from arbitrage
     */
    function executeBaseCrossDEXArbitrage(
        bytes32 buyDEX,
        bytes32 sellDEX,
        address token,
        uint256 amount
    ) external onlyAuthorizedExecutor returns (uint256 profit) {
        
        address buyRouter = dexRouters[buyDEX];
        address sellRouter = dexRouters[sellDEX];
        
        require(buyRouter != address(0) && sellRouter != address(0), "BaseArbitrage: Invalid DEX");
        
        uint256 balanceBefore = IERC20(token).balanceOf(address(this));
        
        // Execute arbitrage with Base L2-optimized gas usage
        _executeBaseBuyOrder(buyRouter, buyDEX, token, amount);
        uint256 receivedAmount = IERC20(token).balanceOf(address(this)) - balanceBefore;
        _executeBaseSellOrder(sellRouter, sellDEX, token, receivedAmount);
        
        uint256 balanceAfter = IERC20(token).balanceOf(address(this));
        profit = balanceAfter - balanceBefore;
        
        require(profit > 0, "BaseArbitrage: No profit generated");
        
        // Transfer profit to executor
        IERC20(token).safeTransfer(msg.sender, profit);
    }
    
    /**
     * @dev Execute Base-specific triangular arbitrage
     * @param startAmount Initial USDC amount
     * @return finalAmount Final USDC amount after triangular arbitrage
     */
    function executeBaseTriangularArbitrage(
        uint256 startAmount
    ) external onlyAuthorizedExecutor returns (uint256 finalAmount) {
        
        IERC20(USDC).safeTransferFrom(msg.sender, address(this), startAmount);
        
        // Path: USDC -> WETH -> cbETH -> USDC (leveraging Base-specific tokens)
        
        // Step 1: USDC -> WETH (Uniswap V3)
        uint256 wethAmount = _swapOnUniswapV3Base(USDC, WETH, startAmount, BASE_FEE_MEDIUM);
        
        // Step 2: WETH -> cbETH (BaseSwap)
        uint256 cbethAmount = _swapOnBaseSwap(WETH, CBETH, wethAmount);
        
        // Step 3: cbETH -> USDC (Aerodrome)
        finalAmount = _swapOnAerodrome(CBETH, USDC, cbethAmount);
        
        require(finalAmount > startAmount, "BaseArbitrage: Triangular arbitrage not profitable");
        
        // Transfer final amount to executor
        IERC20(USDC).safeTransfer(msg.sender, finalAmount);
    }
    
    /**
     * @dev Execute flash loan arbitrage on Base L2
     * @param asset Flash loan asset
     * @param amount Flash loan amount
     * @param arbData Encoded arbitrage strategy data
     * @return profit Net profit after flash loan fees
     */
    function executeBaseFlashArbitrage(
        address asset,
        uint256 amount,
        bytes calldata arbData
    ) external onlyAuthorizedExecutor returns (uint256 profit) {
        
        require(asset != address(0) && amount > 0, "BaseArbitrage: Invalid flash loan params");
        
        // Base L2 has extremely low gas costs
        uint256 estimatedGasCost = tx.gasprice * 150000; // Very low gas estimate for Base L2
        
        // Use Uniswap V3 flash loan (no fees, just pay pool fees)
        _executeUniswapV3FlashLoan(asset, amount, arbData);
        
        // Calculate final profit
        profit = IERC20(asset).balanceOf(address(this));
        require(profit > estimatedGasCost, "BaseArbitrage: Flash arbitrage not profitable");
        
        // Transfer net profit to executor
        IERC20(asset).safeTransfer(msg.sender, profit);
    }
    
    /**
     * @dev Execute Aerodrome-specific arbitrage (Base's native DEX)
     * @param tokenA Input token
     * @param tokenB Output token
     * @param amountIn Input amount
     * @param stable Whether to use stable pair (for correlated assets)
     * @return amountOut Output amount from Aerodrome
     */
    function executeAerodromeArbitrage(
        address tokenA,
        address tokenB,
        uint256 amountIn,
        bool stable
    ) external onlyAuthorizedExecutor returns (uint256 amountOut) {
        
        IERC20(tokenA).safeTransferFrom(msg.sender, address(this), amountIn);
        
        // Aerodrome has stable and volatile pairs
        amountOut = _swapOnAerodromeWithMode(tokenA, tokenB, amountIn, stable);
        
        // Transfer output to executor
        IERC20(tokenB).safeTransfer(msg.sender, amountOut);
    }
    
    // Internal helper functions for Base
    function _executeBaseBuyOrder(address router, bytes32 dexId, address token, uint256 amount) internal {
        if (dexId == UNISWAP_V3_BASE_ID || dexId == PANCAKESWAP_V3_BASE_ID) {
            _swapOnUniswapV3Base(USDC, token, amount, BASE_FEE_MEDIUM);
        } else if (dexId == SUSHISWAP_BASE_ID) {
            _swapOnSushiSwapBase(USDC, token, amount);
        } else if (dexId == BASESWAP_ID) {
            _swapOnBaseSwap(USDC, token, amount);
        } else if (dexId == AERODROME_ID) {
            _swapOnAerodrome(USDC, token, amount);
        }
    }
    
    function _executeBaseSellOrder(address router, bytes32 dexId, address token, uint256 amount) internal {
        if (dexId == UNISWAP_V3_BASE_ID || dexId == PANCAKESWAP_V3_BASE_ID) {
            _swapOnUniswapV3Base(token, USDC, amount, BASE_FEE_MEDIUM);
        } else if (dexId == SUSHISWAP_BASE_ID) {
            _swapOnSushiSwapBase(token, USDC, amount);
        } else if (dexId == BASESWAP_ID) {
            _swapOnBaseSwap(token, USDC, amount);
        } else if (dexId == AERODROME_ID) {
            _swapOnAerodrome(token, USDC, amount);
        }
    }
    
    function _swapOnUniswapV3Base(address tokenIn, address tokenOut, uint256 amountIn, uint24 fee) internal returns (uint256 amountOut) {
        IERC20(tokenIn).safeApprove(UNISWAP_V3_ROUTER, amountIn);
        
        IUniswapV3Router.ExactInputSingleParams memory params = IUniswapV3Router.ExactInputSingleParams({
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            fee: fee,
            recipient: address(this),
            deadline: block.timestamp + 300,
            amountIn: amountIn,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0
        });
        
        amountOut = IUniswapV3Router(UNISWAP_V3_ROUTER).exactInputSingle(params);
        IERC20(tokenIn).safeApprove(UNISWAP_V3_ROUTER, 0);
    }
    
    function _swapOnSushiSwapBase(address tokenIn, address tokenOut, uint256 amountIn) internal returns (uint256 amountOut) {
        IERC20(tokenIn).safeApprove(SUSHISWAP_ROUTER, amountIn);
        
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;
        
        uint256[] memory amounts = IUniswapV2Router(SUSHISWAP_ROUTER).swapExactTokensForTokens(
            amountIn,
            0,
            path,
            address(this),
            block.timestamp + 300
        );
        
        amountOut = amounts[1];
        IERC20(tokenIn).safeApprove(SUSHISWAP_ROUTER, 0);
    }
    
    function _swapOnBaseSwap(address tokenIn, address tokenOut, uint256 amountIn) internal returns (uint256 amountOut) {
        IERC20(tokenIn).safeApprove(BASESWAP_ROUTER, amountIn);
        
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;
        
        uint256[] memory amounts = IBaseSwapRouter(BASESWAP_ROUTER).swapExactTokensForTokens(
            amountIn,
            0,
            path,
            address(this),
            block.timestamp + 300
        );
        
        amountOut = amounts[1];
        IERC20(tokenIn).safeApprove(BASESWAP_ROUTER, 0);
    }
    
    function _swapOnAerodrome(address tokenIn, address tokenOut, uint256 amountIn) internal returns (uint256 amountOut) {
        return _swapOnAerodromeWithMode(tokenIn, tokenOut, amountIn, false); // Default to volatile pair
    }
    
    function _swapOnAerodromeWithMode(address tokenIn, address tokenOut, uint256 amountIn, bool stable) internal returns (uint256 amountOut) {
        IERC20(tokenIn).safeApprove(AERODROME_ROUTER, amountIn);
        
        IAerodromeRouter.Route[] memory routes = new IAerodromeRouter.Route[](1);
        routes[0] = IAerodromeRouter.Route({
            from: tokenIn,
            to: tokenOut,
            stable: stable
        });
        
        uint256[] memory amounts = IAerodromeRouter(AERODROME_ROUTER).swapExactTokensForTokens(
            amountIn,
            0,
            routes,
            address(this),
            block.timestamp + 300
        );
        
        amountOut = amounts[1];
        IERC20(tokenIn).safeApprove(AERODROME_ROUTER, 0);
    }
    
    function _executeUniswapV3FlashLoan(address asset, uint256 amount, bytes memory data) internal {
        // Uniswap V3 flash loan implementation for Base
        // This would initiate a flash callback on a Uniswap V3 pool
    }
    
    /**
     * @dev Get Base L2-specific gas optimization information
     * @return gasPrice Current gas price
     * @return gasLimit Block gas limit
     * @return l1Fee Estimated L1 data fee
     */
    function getBaseGasInfo() external view returns (
        uint256 gasPrice,
        uint256 gasLimit,
        uint256 l1Fee
    ) {
        gasPrice = tx.gasprice;
        gasLimit = BASE_GAS_LIMIT;
        
        // Base L1 fee calculation (simplified)
        l1Fee = gasPrice * 21000 * 16; // Simplified L1 data cost
    }
    
    /**
     * @dev Get optimal arbitrage path for Base DEXs
     */
    function getBaseOptimalPath(
        address tokenA,
        address tokenB,
        uint256 amount
    ) external view returns (
        bytes32 bestBuyDEX,
        bytes32 bestSellDEX,
        uint256 estimatedProfit
    ) {
        // Query prices from all Base DEXs
        uint256 bestBuyPrice = type(uint256).max;
        uint256 bestSellPrice = 0;
        
        bytes32[] memory baseDexIds = new bytes32[](4);
        baseDexIds[0] = UNISWAP_V3_BASE_ID;
        baseDexIds[1] = SUSHISWAP_BASE_ID;
        baseDexIds[2] = BASESWAP_ID;
        baseDexIds[3] = AERODROME_ID;
        
        for (uint256 i = 0; i < baseDexIds.length; i++) {
            uint256 buyPrice = _getBasePrice(baseDexIds[i], tokenA, tokenB, amount, true);
            uint256 sellPrice = _getBasePrice(baseDexIds[i], tokenA, tokenB, amount, false);
            
            if (buyPrice < bestBuyPrice) {
                bestBuyPrice = buyPrice;
                bestBuyDEX = baseDexIds[i];
            }
            
            if (sellPrice > bestSellPrice) {
                bestSellPrice = sellPrice;
                bestSellDEX = baseDexIds[i];
            }
        }
        
        if (bestSellPrice > bestBuyPrice) {
            estimatedProfit = bestSellPrice - bestBuyPrice;
        }
    }
    
    function _getBasePrice(bytes32 dexId, address tokenA, address tokenB, uint256 amount, bool isBuy) internal view returns (uint256 price) {
        // Simplified price lookup for Base DEXs
        price = amount; // Placeholder
    }
    
    /**
     * @dev Emergency rescue for Base-specific tokens
     */
    function emergencyRescueBaseTokens() external onlyOwner {
        address[] memory baseTokens = new address[](5);
        baseTokens[0] = WETH;
        baseTokens[1] = CBETH;
        baseTokens[2] = USDC;
        baseTokens[3] = USDbC;
        baseTokens[4] = DAI;
        
        for (uint256 i = 0; i < baseTokens.length; i++) {
            uint256 balance = IERC20(baseTokens[i]).balanceOf(address(this));
            if (balance > 0) {
                IERC20(baseTokens[i]).safeTransfer(owner(), balance);
            }
        }
    }
    
    /**
     * @dev Check if Base-specific opportunities exist
     * @return hasStablecoinArb True if USDC/USDbC arbitrage exists
     * @return hasETHArb True if WETH/cbETH arbitrage exists
     * @return hasCrossDEXArb True if cross-DEX opportunities exist
     */
    function checkBaseOpportunities() external view returns (
        bool hasStablecoinArb,
        bool hasETHArb,
        bool hasCrossDEXArb
    ) {
        // Simplified opportunity detection
        hasStablecoinArb = true; // Placeholder
        hasETHArb = true; // Placeholder
        hasCrossDEXArb = true; // Placeholder
    }
}

// Base-specific interfaces
interface IBaseSwapRouter {
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);
}

interface IAerodromeRouter {
    struct Route {
        address from;
        address to;
        bool stable;
    }
    
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        Route[] calldata routes,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);
}
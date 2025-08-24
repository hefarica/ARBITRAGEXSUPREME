// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../../core/ArbitrageExecutor.sol";

/**
 * @title ArbitrumArbitrage
 * @dev Arbitrum-specific arbitrage contract optimized for L2 gas efficiency
 * @author ArbitrageX Team
 * 
 * Supported DEXs on Arbitrum:
 * - Uniswap V3
 * - SushiSwap
 * - Balancer V2
 * - Curve
 * - GMX
 * - Camelot
 * - Trader Joe
 * - 1inch
 */
contract ArbitrumArbitrage is ArbitrageExecutor {
    
    // Arbitrum-specific DEX addresses
    address public constant UNISWAP_V3_ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
    address public constant SUSHISWAP_ROUTER = 0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506;
    address public constant BALANCER_VAULT = 0xBA12222222228d8Ba445958a75a0704d566BF2C8;
    address public constant CURVE_REGISTRY = 0x7D86446dDb609eD0F5f8684AcF30380a356b2B4c;
    address public constant GMX_ROUTER = 0xaBBc5F99639c9B6bCb58544ddf04EFA6802F4064;
    address public constant CAMELOT_ROUTER = 0xc873fEcbd354f5A56E00E710B90EF4201db2448d;
    address public constant TRADERJOE_ROUTER = 0x60aE616a2155Ee3d9A68541Ba4544862310933d4;
    address public constant ONE_INCH_ROUTER = 0x11111112542D85B3EF69AE05771c2dCCff3596AE;
    
    // Aave V3 on Arbitrum for flash loans
    address public constant AAVE_POOL = 0x794a61358D6845594F94dc1DB02A252b5b4814aD;
    
    // Native ETH and wrapped tokens
    address public constant WETH = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;
    address public constant ARB = 0x912CE59144191C1204E64559FE8253a0e49E6548;
    
    // Common tokens on Arbitrum
    address public constant USDC = 0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8; // Native USDC
    address public constant USDC_E = 0xa0b862F60edEf4452F25B4160F177db44dD6BC2f; // Bridged USDC.e
    address public constant USDT = 0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9;
    address public constant WBTC = 0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f;
    address public constant DAI = 0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1;
    address public constant LINK = 0xf97f4df75117a78c1A5a0DBb814Af92458539FB4;
    address public constant UNI = 0xFa7F8980b0f1E64A2062791cc3b0871572f1F7f0;
    
    // DEX identifiers
    bytes32 public constant UNISWAP_V3_ARB_ID = keccak256("UNISWAP_V3_ARB");
    bytes32 public constant SUSHISWAP_ARB_ID = keccak256("SUSHISWAP_ARB");
    bytes32 public constant BALANCER_ARB_ID = keccak256("BALANCER_ARB");
    bytes32 public constant CURVE_ARB_ID = keccak256("CURVE_ARB");
    bytes32 public constant GMX_ID = keccak256("GMX");
    bytes32 public constant CAMELOT_ID = keccak256("CAMELOT");
    bytes32 public constant TRADERJOE_ID = keccak256("TRADERJOE");
    bytes32 public constant ONE_INCH_ARB_ID = keccak256("ONE_INCH_ARB");
    
    // Arbitrum L2 gas optimization constants
    uint256 public constant ARB_L1_GAS_PRICE_ORACLE = 0x000000000000000000000000000000000000006C;
    uint256 public constant OPTIMAL_ARB_GAS_PRICE = 1 gwei; // Very low L2 gas
    
    // Arbitrum-specific fee tiers for Uniswap V3
    uint256 public constant ARB_FEE_LOW = 100; // 0.01%
    uint256 public constant ARB_FEE_MEDIUM = 500; // 0.05%
    uint256 public constant ARB_FEE_HIGH = 3000; // 0.3%
    uint256 public constant ARB_FEE_ULTRA = 10000; // 1%
    
    constructor() ArbitrageExecutor(msg.sender) {
        // Initialize Arbitrum-specific configurations
        _initializeArbitrumDEXs();
        _initializeArbitrumFlashLoanProviders();
        
        // Set Arbitrum L2-optimized parameters
        maxGasPrice = 5 gwei; // Very low gas on L2
        minProfitBps = 15; // 0.15% minimum profit (very low due to cheap gas)
    }
    
    /**
     * @dev Initialize Arbitrum DEX routers
     */
    function _initializeArbitrumDEXs() internal {
        dexRouters[UNISWAP_V3_ARB_ID] = UNISWAP_V3_ROUTER;
        dexRouters[SUSHISWAP_ARB_ID] = SUSHISWAP_ROUTER;
        dexRouters[BALANCER_ARB_ID] = BALANCER_VAULT;
        dexRouters[CURVE_ARB_ID] = CURVE_REGISTRY;
        dexRouters[GMX_ID] = GMX_ROUTER;
        dexRouters[CAMELOT_ID] = CAMELOT_ROUTER;
        dexRouters[TRADERJOE_ID] = TRADERJOE_ROUTER;
        dexRouters[ONE_INCH_ARB_ID] = ONE_INCH_ROUTER;
    }
    
    /**
     * @dev Initialize flash loan providers on Arbitrum
     */
    function _initializeArbitrumFlashLoanProviders() internal {
        flashLoanProviders[FlashLoanLib.Provider.AAVE_V3] = AAVE_POOL;
        flashLoanProviders[FlashLoanLib.Provider.BALANCER_V2] = BALANCER_VAULT;
        flashLoanProviders[FlashLoanLib.Provider.UNISWAP_V3] = UNISWAP_V3_ROUTER;
    }
    
    /**
     * @dev Execute Uniswap V3 multi-fee arbitrage on Arbitrum
     * @param tokenA Input token
     * @param tokenB Output token
     * @param amountIn Input amount
     * @param feeTier1 First pool fee tier
     * @param feeTier2 Second pool fee tier
     * @return profit Net profit from fee tier arbitrage
     */
    function executeArbitrumV3FeeArbitrage(
        address tokenA,
        address tokenB,
        uint256 amountIn,
        uint24 feeTier1,
        uint24 feeTier2
    ) external onlyAuthorizedExecutor returns (uint256 profit) {
        
        IERC20(tokenA).safeTransferFrom(msg.sender, address(this), amountIn);
        
        uint256 balanceBefore = IERC20(tokenB).balanceOf(address(this));
        
        // Step 1: Swap on first fee tier pool
        uint256 intermediateAmount = _swapOnUniswapV3Arbitrum(tokenA, tokenB, amountIn, feeTier1);
        
        // Step 2: Swap back on second fee tier pool
        uint256 finalAmount = _swapOnUniswapV3Arbitrum(tokenB, tokenA, intermediateAmount, feeTier2);
        
        uint256 balanceAfter = IERC20(tokenA).balanceOf(address(this));
        
        if (balanceAfter > balanceBefore + amountIn) {
            profit = balanceAfter - balanceBefore - amountIn;
            IERC20(tokenA).safeTransfer(msg.sender, balanceAfter);
        }
        
        require(profit > 0, "ArbitrumArbitrage: Fee tier arbitrage not profitable");
    }
    
    /**
     * @dev Execute cross-DEX arbitrage optimized for Arbitrum
     * @param buyDEX DEX to buy from (lower price)
     * @param sellDEX DEX to sell to (higher price)
     * @param token Token to arbitrage
     * @param amount Amount to arbitrage
     * @return profit Net profit from arbitrage
     */
    function executeArbitrumCrossDEXArbitrage(
        bytes32 buyDEX,
        bytes32 sellDEX,
        address token,
        uint256 amount
    ) external onlyAuthorizedExecutor returns (uint256 profit) {
        
        address buyRouter = dexRouters[buyDEX];
        address sellRouter = dexRouters[sellDEX];
        
        require(buyRouter != address(0) && sellRouter != address(0), "ArbitrumArbitrage: Invalid DEX");
        
        uint256 balanceBefore = IERC20(token).balanceOf(address(this));
        
        // Execute arbitrage with L2-optimized gas usage
        _executeArbitrumBuyOrder(buyRouter, buyDEX, token, amount);
        uint256 receivedAmount = IERC20(token).balanceOf(address(this)) - balanceBefore;
        _executeArbitrumSellOrder(sellRouter, sellDEX, token, receivedAmount);
        
        uint256 balanceAfter = IERC20(token).balanceOf(address(this));
        profit = balanceAfter - balanceBefore;
        
        require(profit > 0, "ArbitrumArbitrage: No profit generated");
        
        // Transfer profit to executor
        IERC20(token).safeTransfer(msg.sender, profit);
    }
    
    /**
     * @dev Execute ETH-ARB-USDC triangular arbitrage on Arbitrum
     * @param startAmount Initial USDC amount
     * @return finalAmount Final USDC amount after triangular arbitrage
     */
    function executeArbitrumTriangularArbitrage(
        uint256 startAmount
    ) external onlyAuthorizedExecutor returns (uint256 finalAmount) {
        
        IERC20(USDC).safeTransferFrom(msg.sender, address(this), startAmount);
        
        // Path: USDC -> WETH -> ARB -> USDC (using different DEXs for each leg)
        
        // Step 1: USDC -> WETH (Uniswap V3)
        uint256 wethAmount = _swapOnUniswapV3Arbitrum(USDC, WETH, startAmount, ARB_FEE_MEDIUM);
        
        // Step 2: WETH -> ARB (SushiSwap)
        uint256 arbAmount = _swapOnSushiSwapArbitrum(WETH, ARB, wethAmount);
        
        // Step 3: ARB -> USDC (Camelot for potentially better rates)
        finalAmount = _swapOnCamelot(ARB, USDC, arbAmount);
        
        require(finalAmount > startAmount, "ArbitrumArbitrage: Triangular arbitrage not profitable");
        
        // Transfer final amount to executor
        IERC20(USDC).safeTransfer(msg.sender, finalAmount);
    }
    
    /**
     * @dev Execute flash loan arbitrage optimized for Arbitrum L2
     * @param asset Flash loan asset
     * @param amount Flash loan amount
     * @param arbData Encoded arbitrage strategy data
     * @return profit Net profit after flash loan fees
     */
    function executeArbitrumFlashArbitrage(
        address asset,
        uint256 amount,
        bytes calldata arbData
    ) external onlyAuthorizedExecutor returns (uint256 profit) {
        
        require(asset != address(0) && amount > 0, "ArbitrumArbitrage: Invalid flash loan params");
        
        // L2 gas is very cheap, so focus on flash loan fees
        uint256 flashLoanFee = FlashLoanLib.calculateFlashLoanFee(FlashLoanLib.Provider.AAVE_V3, amount);
        uint256 estimatedGasCost = tx.gasprice * 200000; // Lower gas estimate for L2
        
        // Execute flash loan with L2-optimized strategy
        _executeFlashLoan(asset, amount, arbData);
        
        // Calculate final profit
        profit = IERC20(asset).balanceOf(address(this));
        require(profit > flashLoanFee + estimatedGasCost, "ArbitrumArbitrage: Flash arbitrage not profitable");
        
        // Transfer net profit to executor
        IERC20(asset).safeTransfer(msg.sender, profit);
    }
    
    /**
     * @dev Execute GMX-specific arbitrage using their unique AMM
     * @param tokenIn Input token
     * @param tokenOut Output token
     * @param amountIn Input amount
     * @return amountOut Output amount from GMX swap
     */
    function executeGMXArbitrage(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external onlyAuthorizedExecutor returns (uint256 amountOut) {
        
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenIn).safeApprove(GMX_ROUTER, amountIn);
        
        // GMX swap (simplified - actual implementation would use their specific interface)
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;
        
        uint256 balanceBefore = IERC20(tokenOut).balanceOf(address(this));
        
        // Execute GMX swap with their specific parameters
        IGMXRouter(GMX_ROUTER).swap(path, amountIn, 0, address(this));
        
        uint256 balanceAfter = IERC20(tokenOut).balanceOf(address(this));
        amountOut = balanceAfter - balanceBefore;
        
        // Transfer output to executor
        IERC20(tokenOut).safeTransfer(msg.sender, amountOut);
        
        // Reset approval
        IERC20(tokenIn).safeApprove(GMX_ROUTER, 0);
    }
    
    // Internal helper functions for Arbitrum
    function _executeArbitrumBuyOrder(address router, bytes32 dexId, address token, uint256 amount) internal {
        if (dexId == UNISWAP_V3_ARB_ID) {
            _swapOnUniswapV3Arbitrum(USDC, token, amount, ARB_FEE_MEDIUM);
        } else if (dexId == SUSHISWAP_ARB_ID) {
            _swapOnSushiSwapArbitrum(USDC, token, amount);
        } else if (dexId == CAMELOT_ID) {
            _swapOnCamelot(USDC, token, amount);
        }
    }
    
    function _executeArbitrumSellOrder(address router, bytes32 dexId, address token, uint256 amount) internal {
        if (dexId == UNISWAP_V3_ARB_ID) {
            _swapOnUniswapV3Arbitrum(token, USDC, amount, ARB_FEE_MEDIUM);
        } else if (dexId == SUSHISWAP_ARB_ID) {
            _swapOnSushiSwapArbitrum(token, USDC, amount);
        } else if (dexId == CAMELOT_ID) {
            _swapOnCamelot(token, USDC, amount);
        }
    }
    
    function _swapOnUniswapV3Arbitrum(address tokenIn, address tokenOut, uint256 amountIn, uint24 fee) internal returns (uint256 amountOut) {
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
    
    function _swapOnSushiSwapArbitrum(address tokenIn, address tokenOut, uint256 amountIn) internal returns (uint256 amountOut) {
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
    
    function _swapOnCamelot(address tokenIn, address tokenOut, uint256 amountIn) internal returns (uint256 amountOut) {
        IERC20(tokenIn).safeApprove(CAMELOT_ROUTER, amountIn);
        
        // Camelot uses a slightly different interface
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;
        
        uint256[] memory amounts = ICamelotRouter(CAMELOT_ROUTER).swapExactTokensForTokens(
            amountIn,
            0,
            path,
            address(this),
            address(0), // referrer
            block.timestamp + 300
        );
        
        amountOut = amounts[1];
        IERC20(tokenIn).safeApprove(CAMELOT_ROUTER, 0);
    }
    
    /**
     * @dev Get L1 and L2 gas costs for Arbitrum transaction
     * @param gasUsed L2 gas used
     * @return l1Cost L1 data cost
     * @return l2Cost L2 execution cost
     * @return totalCost Total transaction cost
     */
    function getArbitrumGasCosts(uint256 gasUsed) external view returns (
        uint256 l1Cost,
        uint256 l2Cost,
        uint256 totalCost
    ) {
        // Arbitrum has both L1 data costs and L2 execution costs
        l2Cost = gasUsed * tx.gasprice;
        
        // L1 cost calculation (simplified)
        // In reality, this would call the ArbGasInfo precompile
        l1Cost = gasUsed * 50; // Simplified L1 data cost
        
        totalCost = l1Cost + l2Cost;
    }
    
    /**
     * @dev Get optimal arbitrage path for Arbitrum DEXs
     */
    function getArbitrumOptimalPath(
        address tokenA,
        address tokenB,
        uint256 amount
    ) external view returns (
        bytes32 bestBuyDEX,
        bytes32 bestSellDEX,
        uint256 estimatedProfit
    ) {
        // Query prices from all Arbitrum DEXs
        uint256 bestBuyPrice = type(uint256).max;
        uint256 bestSellPrice = 0;
        
        bytes32[] memory arbDexIds = new bytes32[](4);
        arbDexIds[0] = UNISWAP_V3_ARB_ID;
        arbDexIds[1] = SUSHISWAP_ARB_ID;
        arbDexIds[2] = CAMELOT_ID;
        arbDexIds[3] = GMX_ID;
        
        for (uint256 i = 0; i < arbDexIds.length; i++) {
            uint256 buyPrice = _getArbitrumPrice(arbDexIds[i], tokenA, tokenB, amount, true);
            uint256 sellPrice = _getArbitrumPrice(arbDexIds[i], tokenA, tokenB, amount, false);
            
            if (buyPrice < bestBuyPrice) {
                bestBuyPrice = buyPrice;
                bestBuyDEX = arbDexIds[i];
            }
            
            if (sellPrice > bestSellPrice) {
                bestSellPrice = sellPrice;
                bestSellDEX = arbDexIds[i];
            }
        }
        
        if (bestSellPrice > bestBuyPrice) {
            estimatedProfit = bestSellPrice - bestBuyPrice;
        }
    }
    
    function _getArbitrumPrice(bytes32 dexId, address tokenA, address tokenB, uint256 amount, bool isBuy) internal view returns (uint256 price) {
        // Simplified price lookup for Arbitrum DEXs
        price = amount; // Placeholder
    }
    
    /**
     * @dev Emergency rescue for Arbitrum-specific tokens
     */
    function emergencyRescueArbitrumTokens() external onlyOwner {
        address[] memory arbTokens = new address[](8);
        arbTokens[0] = WETH;
        arbTokens[1] = ARB;
        arbTokens[2] = USDC;
        arbTokens[3] = USDC_E;
        arbTokens[4] = USDT;
        arbTokens[5] = WBTC;
        arbTokens[6] = DAI;
        arbTokens[7] = LINK;
        
        for (uint256 i = 0; i < arbTokens.length; i++) {
            uint256 balance = IERC20(arbTokens[i]).balanceOf(address(this));
            if (balance > 0) {
                IERC20(arbTokens[i]).safeTransfer(owner(), balance);
            }
        }
    }
}

// Arbitrum-specific interfaces
interface IGMXRouter {
    function swap(address[] memory _path, uint256 _amountIn, uint256 _minOut, address _receiver) external;
}

interface ICamelotRouter {
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        address referrer,
        uint deadline
    ) external returns (uint[] memory amounts);
}
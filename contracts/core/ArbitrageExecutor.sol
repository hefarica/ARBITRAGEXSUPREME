// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../interfaces/IArbitrageExecutor.sol";
import "../interfaces/IFlashLoanReceiver.sol";
import "../interfaces/IDEX.sol";
import "../libraries/ArbitrageLib.sol";
import "../libraries/FlashLoanLib.sol";

/**
 * @title ArbitrageExecutor
 * @dev Core contract for ArbitrageX Pro 2025 - Smart Contract Arbitrage Engine
 * @author ArbitrageX Team
 */
contract ArbitrageExecutor is 
    IArbitrageExecutor,
    IFlashLoanReceiver,
    IAaveFlashLoanReceiver,
    IBalancerFlashLoanReceiver,
    IUniswapV3FlashCallback,
    Ownable,
    ReentrancyGuard,
    Pausable
{
    using SafeERC20 for IERC20;
    using ArbitrageLib for *;
    using FlashLoanLib for *;

    // Contract version
    string public constant VERSION = "2.0.0";
    
    // Maximum slippage allowed (in basis points)
    uint256 public constant MAX_SLIPPAGE_BPS = 300; // 3%
    
    // Minimum profit required (in basis points) 
    uint256 public minProfitBps = 50; // 0.5%
    
    // Maximum gas price allowed
    uint256 public maxGasPrice = 100 gwei;
    
    // Flash loan providers
    mapping(FlashLoanLib.Provider => address) public flashLoanProviders;
    
    // Authorized executors (backend services)
    mapping(address => bool) public authorizedExecutors;
    
    // DEX routers by identifier
    mapping(bytes32 => address) public dexRouters;
    
    // Statistics
    struct Statistics {
        uint256 totalExecutions;
        uint256 totalProfit;
        uint256 totalVolume;
        uint256 successfulArbitrages;
        uint256 failedArbitrages;
    }
    Statistics public stats;

    // Events
    event ExecutorAuthorized(address indexed executor, bool authorized);
    event FlashLoanProviderUpdated(FlashLoanLib.Provider provider, address providerAddress);
    event DEXRouterUpdated(bytes32 indexed dexId, address router);
    event MinProfitUpdated(uint256 oldMinProfit, uint256 newMinProfit);
    event MaxGasPriceUpdated(uint256 oldMaxGasPrice, uint256 newMaxGasPrice);
    event EmergencyWithdrawal(address indexed token, address indexed to, uint256 amount);

    modifier onlyAuthorizedExecutor() {
        require(authorizedExecutors[msg.sender] || msg.sender == owner(), "ArbitrageExecutor: Not authorized");
        _;
    }

    modifier validGasPrice() {
        require(tx.gasprice <= maxGasPrice, "ArbitrageExecutor: Gas price too high");
        _;
    }

    constructor(address _initialOwner) Ownable(_initialOwner) {
        // Authorize the deployer initially
        authorizedExecutors[_initialOwner] = true;
        emit ExecutorAuthorized(_initialOwner, true);
    }

    /**
     * @dev Execute arbitrage opportunity
     * @param params Arbitrage execution parameters
     * @return profit Net profit in tokenOut
     */
    function executeArbitrage(ArbitrageParams calldata params) 
        external 
        override
        nonReentrant
        whenNotPaused
        onlyAuthorizedExecutor
        validGasPrice
        returns (uint256 profit) 
    {
        uint256 gasStart = gasleft();
        
        // Validate parameters
        ArbitrageLib.validateArbitrageParams(
            params.tokenIn,
            params.tokenOut,
            params.amountIn,
            params.minProfitBps,
            params.deadline
        );
        
        require(params.minProfitBps >= minProfitBps, "ArbitrageExecutor: Profit below minimum");
        
        // Check if opportunity is still valid
        require(validateOpportunity(params), "ArbitrageExecutor: Opportunity no longer profitable");
        
        // Execute the arbitrage
        profit = _executeArbitrageInternal(params);
        
        // Update statistics
        uint256 gasUsed = gasStart - gasleft();
        _updateStats(true, params.amountIn, profit, gasUsed);
        
        emit ArbitrageExecuted(
            msg.sender,
            params.tokenIn,
            params.tokenOut,
            params.amountIn,
            profit,
            gasUsed
        );
    }

    /**
     * @dev Execute arbitrage with flash loan
     */
    function executeFlashArbitrage(
        FlashLoanParams calldata flashParams,
        ArbitrageParams calldata arbParams
    ) external override nonReentrant whenNotPaused onlyAuthorizedExecutor validGasPrice returns (uint256 profit) {
        uint256 gasStart = gasleft();
        
        // Validate flash loan parameters
        FlashLoanLib.validateFlashLoanParams(
            flashParams.asset,
            flashParams.amount,
            FlashLoanLib.Provider.AAVE_V3 // Default provider for now
        );
        
        // Validate arbitrage parameters
        ArbitrageLib.validateArbitrageParams(
            arbParams.tokenIn,
            arbParams.tokenOut,
            arbParams.amountIn,
            arbParams.minProfitBps,
            arbParams.deadline
        );
        
        // Encode arbitrage parameters for flash loan callback
        bytes memory params = abi.encode(arbParams, msg.sender);
        
        // Execute flash loan
        _executeFlashLoan(flashParams.asset, flashParams.amount, params);
        
        // Calculate profit (will be set in callback)
        profit = IERC20(arbParams.tokenOut).balanceOf(address(this));
        
        uint256 gasUsed = gasStart - gasleft();
        _updateStats(true, arbParams.amountIn, profit, gasUsed);
        
        emit FlashArbitrageExecuted(msg.sender, flashParams.asset, flashParams.amount, profit, gasUsed);
    }

    /**
     * @dev Calculate potential profit for arbitrage opportunity
     */
    function calculateProfit(ArbitrageParams calldata params) 
        external 
        view 
        override 
        returns (uint256 expectedProfit) 
    {
        // Simulate the arbitrage path to calculate expected profit
        uint256 currentAmount = params.amountIn;
        
        for (uint256 i = 0; i < params.dexRouters.length; i++) {
            address router = params.dexRouters[i];
            
            // Get quote from each DEX in the path
            // This is a simplified calculation - in practice, we'd call getAmountsOut
            currentAmount = _getEstimatedOutput(router, currentAmount, params.swapData[i]);
        }
        
        if (currentAmount > params.amountIn) {
            expectedProfit = currentAmount - params.amountIn;
        }
    }

    /**
     * @dev Check if arbitrage opportunity is still profitable
     */
    function validateOpportunity(ArbitrageParams calldata params) 
        public 
        view 
        override 
        returns (bool isProfitable) 
    {
        uint256 expectedProfit = this.calculateProfit(params);
        return ArbitrageLib.checkProfitThreshold(expectedProfit, params.amountIn, params.minProfitBps);
    }

    /**
     * @dev Internal function to execute arbitrage logic
     */
    function _executeArbitrageInternal(ArbitrageParams calldata params) internal returns (uint256 profit) {
        IERC20 tokenIn = IERC20(params.tokenIn);
        IERC20 tokenOut = IERC20(params.tokenOut);
        
        // Transfer tokens from executor
        tokenIn.safeTransferFrom(msg.sender, address(this), params.amountIn);
        
        uint256 balanceBefore = tokenOut.balanceOf(address(this));
        uint256 currentAmount = params.amountIn;
        
        // Execute swaps through each DEX in sequence
        for (uint256 i = 0; i < params.dexRouters.length; i++) {
            currentAmount = _executeSingleSwap(
                params.dexRouters[i],
                currentAmount,
                params.swapData[i]
            );
        }
        
        uint256 balanceAfter = tokenOut.balanceOf(address(this));
        profit = balanceAfter - balanceBefore;
        
        require(profit >= ArbitrageLib.calculateMinAmountWithSlippage(
            this.calculateProfit(params),
            MAX_SLIPPAGE_BPS
        ), "ArbitrageExecutor: Insufficient profit due to slippage");
        
        // Transfer profit to executor
        if (profit > 0) {
            tokenOut.safeTransfer(msg.sender, profit);
        }
    }

    /**
     * @dev Execute single swap on a DEX
     */
    function _executeSingleSwap(
        address router,
        uint256 amountIn,
        bytes memory swapData
    ) internal returns (uint256 amountOut) {
        // Decode swap data to determine DEX type and execute appropriate swap
        // This is a simplified version - actual implementation would handle different DEX types
        (address tokenA, address tokenB, uint256 minAmountOut) = abi.decode(swapData, (address, address, uint256));
        
        IERC20(tokenA).safeApprove(router, amountIn);
        
        // Execute swap (simplified - would use actual router interfaces)
        amountOut = minAmountOut; // Placeholder
        
        // Reset approval
        IERC20(tokenA).safeApprove(router, 0);
    }

    /**
     * @dev Execute flash loan from optimal provider
     */
    function _executeFlashLoan(address asset, uint256 amount, bytes memory params) internal {
        address aavePool = flashLoanProviders[FlashLoanLib.Provider.AAVE_V3];
        require(aavePool != address(0), "ArbitrageExecutor: Aave provider not set");
        
        address[] memory assets = new address[](1);
        uint256[] memory amounts = new uint256[](1);
        uint256[] memory modes = new uint256[](1);
        
        assets[0] = asset;
        amounts[0] = amount;
        modes[0] = 0; // No debt mode
        
        // Call Aave flash loan
        IAavePool(aavePool).flashLoan(address(this), assets, amounts, modes, address(this), params, 0);
    }

    /**
     * @dev Aave flash loan callback
     */
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        require(msg.sender == flashLoanProviders[FlashLoanLib.Provider.AAVE_V3], "ArbitrageExecutor: Invalid caller");
        require(initiator == address(this), "ArbitrageExecutor: Invalid initiator");
        
        // Decode arbitrage parameters
        (ArbitrageParams memory arbParams, address executor) = abi.decode(params, (ArbitrageParams, address));
        
        // Execute arbitrage with flash loan funds
        uint256 profit = _executeArbitrageInternal(arbParams);
        
        // Calculate repayment amount
        uint256 repayAmount = amounts[0] + premiums[0];
        require(profit > premiums[0], "ArbitrageExecutor: Flash loan not profitable");
        
        // Approve repayment
        IERC20(assets[0]).safeApprove(msg.sender, repayAmount);
        
        // Transfer remaining profit to executor
        uint256 netProfit = profit - premiums[0];
        if (netProfit > 0) {
            IERC20(assets[0]).safeTransfer(executor, netProfit);
        }
        
        return true;
    }

    /**
     * @dev Balancer flash loan callback
     */
    function receiveFlashLoan(
        address[] memory tokens,
        uint256[] memory amounts,
        uint256[] memory feeAmounts,
        bytes memory userData
    ) external override {
        // Implementation for Balancer flash loans
        require(msg.sender == flashLoanProviders[FlashLoanLib.Provider.BALANCER_V2], "ArbitrageExecutor: Invalid caller");
        
        // Decode and execute arbitrage
        // Similar to Aave callback implementation
    }

    /**
     * @dev Uniswap V3 flash callback
     */
    function uniswapV3FlashCallback(
        uint256 fee0,
        uint256 fee1,
        bytes calldata data
    ) external override {
        // Implementation for Uniswap V3 flash loans
        // Similar to Aave callback implementation
    }

    /**
     * @dev Get estimated output for a swap (placeholder)
     */
    function _getEstimatedOutput(
        address router,
        uint256 amountIn,
        bytes memory swapData
    ) internal view returns (uint256 amountOut) {
        // Simplified placeholder - actual implementation would call router.getAmountsOut
        amountOut = amountIn; // 1:1 for now
    }

    /**
     * @dev Update contract statistics
     */
    function _updateStats(bool success, uint256 volume, uint256 profit, uint256 gasUsed) internal {
        stats.totalExecutions++;
        stats.totalVolume += volume;
        
        if (success) {
            stats.successfulArbitrages++;
            stats.totalProfit += profit;
        } else {
            stats.failedArbitrages++;
        }
    }

    // Admin functions
    function setAuthorizedExecutor(address executor, bool authorized) external onlyOwner {
        authorizedExecutors[executor] = authorized;
        emit ExecutorAuthorized(executor, authorized);
    }

    function setFlashLoanProvider(FlashLoanLib.Provider provider, address providerAddress) external onlyOwner {
        flashLoanProviders[provider] = providerAddress;
        emit FlashLoanProviderUpdated(provider, providerAddress);
    }

    function setDEXRouter(bytes32 dexId, address router) external onlyOwner {
        dexRouters[dexId] = router;
        emit DEXRouterUpdated(dexId, router);
    }

    function setMinProfitBps(uint256 _minProfitBps) external onlyOwner {
        require(_minProfitBps > 0 && _minProfitBps <= 1000, "ArbitrageExecutor: Invalid min profit");
        emit MinProfitUpdated(minProfitBps, _minProfitBps);
        minProfitBps = _minProfitBps;
    }

    function setMaxGasPrice(uint256 _maxGasPrice) external onlyOwner {
        emit MaxGasPriceUpdated(maxGasPrice, _maxGasPrice);
        maxGasPrice = _maxGasPrice;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function emergencyWithdraw(address token, address to, uint256 amount) external onlyOwner {
        ArbitrageLib.rescueTokens(IERC20(token), to, amount);
        emit EmergencyWithdrawal(token, to, amount);
    }

    function getStats() external view returns (Statistics memory) {
        return stats;
    }
}

// Interface for Aave Pool
interface IAavePool {
    function flashLoan(
        address receiverAddress,
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata modes,
        address onBehalfOf,
        bytes calldata params,
        uint16 referralCode
    ) external;
}
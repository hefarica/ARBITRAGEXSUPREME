// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IArbitrageExecutor
 * @dev Interface for ArbitrageX Pro 2025 - Smart Contract Arbitrage Execution
 * @author ArbitrageX Team
 */
interface IArbitrageExecutor {
    
    struct ArbitrageParams {
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        address[] dexRouters;
        bytes[] swapData;
        uint256 minProfitBps; // Minimum profit in basis points (100 = 1%)
        uint256 deadline;
    }

    struct FlashLoanParams {
        address asset;
        uint256 amount;
        bytes strategyData;
    }

    /**
     * @dev Execute arbitrage opportunity
     * @param params Arbitrage execution parameters
     * @return profit Net profit in tokenOut
     */
    function executeArbitrage(ArbitrageParams calldata params) 
        external 
        returns (uint256 profit);

    /**
     * @dev Execute arbitrage with flash loan
     * @param flashParams Flash loan parameters
     * @param arbParams Arbitrage execution parameters
     * @return profit Net profit after flash loan repayment
     */
    function executeFlashArbitrage(
        FlashLoanParams calldata flashParams,
        ArbitrageParams calldata arbParams
    ) external returns (uint256 profit);

    /**
     * @dev Calculate potential profit for arbitrage opportunity
     * @param params Arbitrage parameters
     * @return expectedProfit Estimated profit before gas costs
     */
    function calculateProfit(ArbitrageParams calldata params) 
        external 
        view 
        returns (uint256 expectedProfit);

    /**
     * @dev Check if arbitrage opportunity is still profitable
     * @param params Arbitrage parameters
     * @return isProfitable True if opportunity meets minimum profit threshold
     */
    function validateOpportunity(ArbitrageParams calldata params) 
        external 
        view 
        returns (bool isProfitable);

    // Events
    event ArbitrageExecuted(
        address indexed executor,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 profit,
        uint256 gasUsed
    );

    event FlashArbitrageExecuted(
        address indexed executor,
        address indexed asset,
        uint256 flashAmount,
        uint256 profit,
        uint256 gasUsed
    );

    event ProfitWithdrawn(
        address indexed recipient,
        address indexed token,
        uint256 amount
    );
}
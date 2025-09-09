// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IArbitrageCallback
 * @dev Interface for arbitrage execution callbacks
 * @notice Defines callback functions for flash loan and swap operations
 */
interface IArbitrageCallback {
    
    /**
     * @dev Struct for arbitrage execution data
     * @param strategy Arbitrage strategy ID
     * @param tokens Array of token addresses involved
     * @param amounts Array of amounts for each token
     * @param dexs Array of DEX addresses to use
     * @param paths Array of swap paths
     * @param minProfit Minimum profit required (in wei)
     * @param maxSlippage Maximum slippage allowed (in basis points)
     * @param deadline Execution deadline
     */
    struct ArbitrageData {
        uint256 strategy;
        address[] tokens;
        uint256[] amounts;
        address[] dexs;
        bytes[] paths;
        uint256 minProfit;
        uint256 maxSlippage;
        uint256 deadline;
    }
    
    /**
     * @dev Callback function executed during flash loan
     * @param initiator Address that initiated the flash loan
     * @param asset Flash loan asset address
     * @param amount Flash loan amount
     * @param premium Flash loan premium/fee
     * @param params Additional parameters for arbitrage execution
     * @return success Whether the arbitrage was successful
     */
    function executeArbitrage(
        address initiator,
        address asset,
        uint256 amount,
        uint256 premium,
        bytes calldata params
    ) external returns (bool success);
    
    /**
     * @dev Callback for Aave V3 flash loans
     * @param assets Array of flash loan assets
     * @param amounts Array of flash loan amounts
     * @param premiums Array of flash loan premiums
     * @param initiator Address that initiated the flash loan
     * @param params Additional parameters
     * @return success Whether the operation was successful
     */
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external returns (bool success);
    
    /**
     * @dev Callback for Balancer V2 flash loans
     * @param tokens Array of flash loan tokens
     * @param amounts Array of flash loan amounts
     * @param feeAmounts Array of flash loan fees
     * @param userData Additional user data
     */
    function receiveFlashLoan(
        address[] calldata tokens,
        uint256[] calldata amounts,
        uint256[] calldata feeAmounts,
        bytes calldata userData
    ) external;
    
    /**
     * @dev Uniswap V3 callback for exact input swaps
     * @param amount0Delta Amount of token0 delta
     * @param amount1Delta Amount of token1 delta
     * @param data Callback data
     */
    function uniswapV3SwapCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata data
    ) external;
    
    /**
     * @dev Validates arbitrage parameters before execution
     * @param data Arbitrage execution data
     * @return valid Whether parameters are valid
     * @return reason Reason if invalid
     */
    function validateArbitrageParams(ArbitrageData calldata data) 
        external view returns (bool valid, string memory reason);
}
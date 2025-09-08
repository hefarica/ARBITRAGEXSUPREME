// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IFlashLoanReceiver
 * @dev Interface para recepción de flash loans multi-provider
 * @notice Soporta Aave V3, Balancer V2, Uniswap V3, dYdX, Compound
 */
interface IFlashLoanReceiver {
    
    // Estructura para datos de flash loan
    struct FlashLoanData {
        address user;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 minAmountOut;
        bytes routeData;
        uint8 strategy; // 0: Simple, 1: Triangular, 2: Multi-hop
    }

    /**
     * @dev Aave V3 Flash Loan Callback
     */
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external returns (bool);

    /**
     * @dev Balancer V2 Flash Loan Callback
     */
    function receiveFlashLoan(
        address[] memory tokens,
        uint256[] memory amounts,
        uint256[] memory feeAmounts,
        bytes memory userData
    ) external;

    /**
     * @dev Uniswap V3 Flash Callback
     */
    function uniswapV3FlashCallback(
        uint256 fee0,
        uint256 fee1,
        bytes calldata data
    ) external;

    /**
     * @dev dYdX Flash Loan Callback
     */
    function callFunction(
        address sender,
        uint256 accountIndex,
        bytes calldata data
    ) external;

    /**
     * @dev PancakeSwap Flash Callback (BSC)
     */
    function pancakeCall(
        address sender,
        uint256 amount0,
        uint256 amount1,
        bytes calldata data
    ) external;

    /**
     * @dev SushiSwap Flash Callback
     */
    function uniswapV2Call(
        address sender,
        uint256 amount0,
        uint256 amount1,
        bytes calldata data
    ) external;

    /**
     * @dev Generic Flash Loan Callback
     */
    function executeFlashLoan(
        address provider,
        address[] calldata tokens,
        uint256[] calldata amounts,
        uint256[] calldata fees,
        bytes calldata userData
    ) external returns (bool success);
}

/**
 * @title IFlashLoanProvider
 * @dev Interface para proveedores de flash loans
 */
interface IFlashLoanProvider {
    
    function initiateFlashLoan(
        address[] calldata assets,
        uint256[] calldata amounts,
        bytes calldata params
    ) external;

    function getFlashLoanFee(
        address asset,
        uint256 amount
    ) external view returns (uint256 fee);

    function isFlashLoanAvailable(
        address asset,
        uint256 amount
    ) external view returns (bool available);

    function getMaxFlashLoanAmount(
        address asset
    ) external view returns (uint256 maxAmount);
}
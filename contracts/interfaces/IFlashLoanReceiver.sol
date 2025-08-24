// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IFlashLoanReceiver
 * @dev Interface for receiving flash loans from different providers
 * @author ArbitrageX Team
 */
interface IFlashLoanReceiver {
    
    /**
     * @dev Called by flash loan provider during flash loan execution
     * @param assets The addresses of the assets being flash-borrowed
     * @param amounts The amounts being flash-borrowed
     * @param premiums The premiums incurred as additional debts
     * @param initiator The msg.sender to the flash loan provider
     * @param params Additional parameters passed by the initiator
     * @return True if the execution was successful, false otherwise
     */
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external returns (bool);
}

/**
 * @title IAaveFlashLoanReceiver
 * @dev Aave V3 specific flash loan receiver interface
 */
interface IAaveFlashLoanReceiver {
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external returns (bool);
}

/**
 * @title IBalancerFlashLoanReceiver
 * @dev Balancer V2 specific flash loan receiver interface
 */
interface IBalancerFlashLoanReceiver {
    function receiveFlashLoan(
        address[] memory tokens,
        uint256[] memory amounts,
        uint256[] memory feeAmounts,
        bytes memory userData
    ) external;
}

/**
 * @title IUniswapV3FlashCallback
 * @dev Uniswap V3 flash callback interface
 */
interface IUniswapV3FlashCallback {
    function uniswapV3FlashCallback(
        uint256 fee0,
        uint256 fee1,
        bytes calldata data
    ) external;
}
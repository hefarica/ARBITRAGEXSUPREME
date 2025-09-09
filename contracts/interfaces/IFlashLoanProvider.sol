// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IFlashLoanProvider
 * @dev Interface for flash loan providers (Aave V3, Balancer V2, etc.)
 * @notice Standardizes flash loan operations across different protocols
 */
interface IFlashLoanProvider {
    
    /**
     * @dev Struct for flash loan parameters
     * @param asset The address of the asset to flash loan
     * @param amount The amount to flash loan
     * @param mode Flash loan mode (0 = no debt, 1 = stable debt, 2 = variable debt)
     * @param onBehalfOf Address to receive the debt (for Aave)
     * @param params Additional parameters for the flash loan callback
     */
    struct FlashLoanParams {
        address asset;
        uint256 amount;
        uint256 mode;
        address onBehalfOf;
        bytes params;
    }
    
    /**
     * @dev Initiates a flash loan
     * @param params Flash loan parameters
     * @return success Whether the flash loan was successful
     */
    function executeFlashLoan(FlashLoanParams calldata params) external returns (bool success);
    
    /**
     * @dev Calculates the flash loan fee for a given amount
     * @param asset The asset address
     * @param amount The flash loan amount
     * @return fee The fee amount
     */
    function calculateFlashLoanFee(address asset, uint256 amount) external view returns (uint256 fee);
    
    /**
     * @dev Gets the total amount that needs to be repaid (principal + fee)
     * @param asset The asset address
     * @param amount The flash loan amount
     * @return repayAmount Total amount to repay
     */
    function getRepayAmount(address asset, uint256 amount) external view returns (uint256 repayAmount);
    
    /**
     * @dev Checks if an asset is supported for flash loans
     * @param asset The asset address
     * @return supported Whether the asset is supported
     */
    function isAssetSupported(address asset) external view returns (bool supported);
    
    /**
     * @dev Gets the maximum flash loan amount for an asset
     * @param asset The asset address
     * @return maxAmount Maximum flash loan amount
     */
    function getMaxFlashLoan(address asset) external view returns (uint256 maxAmount);
    
    /**
     * @dev Gets provider-specific information
     * @return name Provider name
     * @return version Provider version
     */
    function getProviderInfo() external view returns (string memory name, string memory version);
}
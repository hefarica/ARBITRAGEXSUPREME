// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title FlashLoanLib
 * @dev Library for FlashLoan operations across different providers
 * @author ArbitrageX Team
 */
library FlashLoanLib {
    
    // Flash loan provider types
    enum Provider {
        AAVE_V3,
        BALANCER_V2,
        UNISWAP_V3,
        DODO,
        MAKER_DAO
    }

    struct FlashLoanData {
        Provider provider;
        address asset;
        uint256 amount;
        bytes params;
        address initiator;
    }

    struct ProviderInfo {
        address poolAddress;
        uint256 feeBps; // Fee in basis points
        bool isActive;
        uint256 maxAmount;
    }

    // Provider fee structures (in basis points)
    uint256 private constant AAVE_FLASH_LOAN_FEE_BPS = 9; // 0.09%
    uint256 private constant BALANCER_FLASH_LOAN_FEE_BPS = 0; // 0% (but protocol fee may apply)
    uint256 private constant UNISWAP_V3_FEE_BPS = 0; // 0% (but must pay pool fees)
    uint256 private constant DODO_FEE_BPS = 0; // 0% typically
    uint256 private constant MAKER_DAO_FEE_BPS = 0; // 0%

    /**
     * @dev Calculate flash loan fee for given provider
     * @param provider Flash loan provider
     * @param amount Loan amount
     * @return fee Fee amount to be paid
     */
    function calculateFlashLoanFee(
        Provider provider,
        uint256 amount
    ) internal pure returns (uint256 fee) {
        uint256 feeBps;
        
        if (provider == Provider.AAVE_V3) {
            feeBps = AAVE_FLASH_LOAN_FEE_BPS;
        } else if (provider == Provider.BALANCER_V2) {
            feeBps = BALANCER_FLASH_LOAN_FEE_BPS;
        } else if (provider == Provider.UNISWAP_V3) {
            feeBps = UNISWAP_V3_FEE_BPS;
        } else if (provider == Provider.DODO) {
            feeBps = DODO_FEE_BPS;
        } else if (provider == Provider.MAKER_DAO) {
            feeBps = MAKER_DAO_FEE_BPS;
        }
        
        fee = (amount * feeBps) / 10000;
    }

    /**
     * @dev Get optimal flash loan provider based on amount and fees
     * @param amount Loan amount needed
     * @param providers Available providers with their info
     * @return optimalProvider Best provider for this loan
     */
    function getOptimalProvider(
        uint256 amount,
        ProviderInfo[] memory providers
    ) internal pure returns (Provider optimalProvider) {
        uint256 minTotalCost = type(uint256).max;
        optimalProvider = Provider.AAVE_V3; // Default fallback
        
        for (uint256 i = 0; i < providers.length; i++) {
            ProviderInfo memory provider = providers[i];
            
            if (!provider.isActive || provider.maxAmount < amount) {
                continue;
            }
            
            uint256 totalCost = (amount * provider.feeBps) / 10000;
            
            if (totalCost < minTotalCost) {
                minTotalCost = totalCost;
                optimalProvider = Provider(i);
            }
        }
    }

    /**
     * @dev Validate flash loan parameters
     * @param asset Asset to borrow
     * @param amount Amount to borrow
     * @param provider Flash loan provider
     */
    function validateFlashLoanParams(
        address asset,
        uint256 amount,
        Provider provider
    ) internal pure {
        require(asset != address(0), "FlashLoanLib: Invalid asset");
        require(amount > 0, "FlashLoanLib: Invalid amount");
        require(uint8(provider) <= uint8(Provider.MAKER_DAO), "FlashLoanLib: Invalid provider");
    }

    /**
     * @dev Calculate minimum profit required to cover flash loan costs
     * @param loanAmount Flash loan amount
     * @param provider Flash loan provider
     * @param gasEstimate Estimated gas cost
     * @param gasPrice Current gas price
     * @param ethPrice ETH price in loan asset terms
     * @return minProfit Minimum profit required
     */
    function calculateMinRequiredProfit(
        uint256 loanAmount,
        Provider provider,
        uint256 gasEstimate,
        uint256 gasPrice,
        uint256 ethPrice
    ) internal pure returns (uint256 minProfit) {
        uint256 flashLoanFee = calculateFlashLoanFee(provider, loanAmount);
        uint256 gasCostInEth = gasEstimate * gasPrice;
        uint256 gasCostInAsset = (gasCostInEth * ethPrice) / 1e18;
        
        minProfit = flashLoanFee + gasCostInAsset;
    }

    /**
     * @dev Encode flash loan callback data
     * @param strategy Arbitrage strategy identifier
     * @param params Strategy-specific parameters
     * @return encodedData Encoded callback data
     */
    function encodeFlashLoanData(
        bytes4 strategy,
        bytes memory params
    ) internal pure returns (bytes memory encodedData) {
        encodedData = abi.encode(strategy, params);
    }

    /**
     * @dev Decode flash loan callback data
     * @param data Encoded callback data
     * @return strategy Arbitrage strategy identifier
     * @return params Strategy-specific parameters
     */
    function decodeFlashLoanData(
        bytes memory data
    ) internal pure returns (bytes4 strategy, bytes memory params) {
        (strategy, params) = abi.decode(data, (bytes4, bytes));
    }

    /**
     * @dev Check if flash loan is profitable after fees
     * @param expectedProfit Expected profit from arbitrage
     * @param loanAmount Flash loan amount
     * @param provider Flash loan provider
     * @param gasEstimate Gas estimate for transaction
     * @return isProfitable True if profitable after all costs
     */
    function isFlashLoanProfitable(
        uint256 expectedProfit,
        uint256 loanAmount,
        Provider provider,
        uint256 gasEstimate
    ) internal view returns (bool isProfitable) {
        uint256 flashLoanFee = calculateFlashLoanFee(provider, loanAmount);
        uint256 gasCostInEth = gasEstimate * tx.gasprice;
        
        // Simplified: assume 1 ETH = 2000 USD equivalent in tokens
        uint256 gasCostInTokens = gasCostInEth * 2000;
        
        uint256 totalCosts = flashLoanFee + gasCostInTokens;
        isProfitable = expectedProfit > totalCosts;
    }
}
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title ArbitrageLib
 * @dev Library for ArbitrageX Pro 2025 - Common arbitrage utilities
 * @author ArbitrageX Team
 */
library ArbitrageLib {
    using SafeERC20 for IERC20;

    // Constants
    uint256 private constant MAX_BPS = 10000; // 100% in basis points
    uint256 private constant MIN_PROFIT_BPS = 10; // 0.1% minimum profit

    struct SwapPath {
        address dex;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        bytes swapData;
    }

    struct ProfitCalculation {
        uint256 totalInput;
        uint256 totalOutput;
        uint256 netProfit;
        uint256 profitBps;
        bool isProfitable;
    }

    /**
     * @dev Calculate net profit from arbitrage opportunity
     * @param amountIn Initial investment amount
     * @param amountOut Final received amount
     * @param gasCost Estimated gas cost in token terms
     * @return calculation Profit calculation result
     */
    function calculateNetProfit(
        uint256 amountIn,
        uint256 amountOut,
        uint256 gasCost
    ) internal pure returns (ProfitCalculation memory calculation) {
        calculation.totalInput = amountIn;
        calculation.totalOutput = amountOut;
        
        if (amountOut > amountIn + gasCost) {
            calculation.netProfit = amountOut - amountIn - gasCost;
            calculation.profitBps = (calculation.netProfit * MAX_BPS) / amountIn;
            calculation.isProfitable = calculation.profitBps >= MIN_PROFIT_BPS;
        } else {
            calculation.netProfit = 0;
            calculation.profitBps = 0;
            calculation.isProfitable = false;
        }
    }

    /**
     * @dev Validate arbitrage opportunity parameters
     * @param tokenIn Input token address
     * @param tokenOut Output token address
     * @param amountIn Input amount
     * @param minProfitBps Minimum profit in basis points
     * @param deadline Transaction deadline
     */
    function validateArbitrageParams(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minProfitBps,
        uint256 deadline
    ) internal view {
        require(tokenIn != address(0), "ArbitrageLib: Invalid tokenIn");
        require(tokenOut != address(0), "ArbitrageLib: Invalid tokenOut");
        require(tokenIn != tokenOut, "ArbitrageLib: Tokens must be different");
        require(amountIn > 0, "ArbitrageLib: Invalid amountIn");
        require(minProfitBps >= MIN_PROFIT_BPS && minProfitBps <= MAX_BPS, "ArbitrageLib: Invalid minProfitBps");
        require(deadline >= block.timestamp, "ArbitrageLib: Expired deadline");
    }

    /**
     * @dev Safe token transfer with balance validation
     * @param token Token contract
     * @param to Recipient address
     * @param amount Amount to transfer
     */
    function safeTransferWithValidation(
        IERC20 token,
        address to,
        uint256 amount
    ) internal {
        require(to != address(0), "ArbitrageLib: Invalid recipient");
        require(amount > 0, "ArbitrageLib: Invalid amount");
        
        uint256 balanceBefore = token.balanceOf(address(this));
        require(balanceBefore >= amount, "ArbitrageLib: Insufficient balance");
        
        token.safeTransfer(to, amount);
        
        uint256 balanceAfter = token.balanceOf(address(this));
        require(balanceAfter == balanceBefore - amount, "ArbitrageLib: Transfer validation failed");
    }

    /**
     * @dev Calculate slippage protection amount
     * @param expectedAmount Expected output amount
     * @param slippageBps Maximum slippage in basis points
     * @return minAmount Minimum acceptable amount
     */
    function calculateMinAmountWithSlippage(
        uint256 expectedAmount,
        uint256 slippageBps
    ) internal pure returns (uint256 minAmount) {
        require(slippageBps <= MAX_BPS, "ArbitrageLib: Invalid slippage");
        minAmount = (expectedAmount * (MAX_BPS - slippageBps)) / MAX_BPS;
    }

    /**
     * @dev Check if profit meets minimum threshold
     * @param profit Calculated profit
     * @param investment Initial investment
     * @param minProfitBps Minimum profit threshold in basis points
     * @return meetsThreshold True if profit meets minimum threshold
     */
    function checkProfitThreshold(
        uint256 profit,
        uint256 investment,
        uint256 minProfitBps
    ) internal pure returns (bool meetsThreshold) {
        if (investment == 0) return false;
        uint256 profitBps = (profit * MAX_BPS) / investment;
        meetsThreshold = profitBps >= minProfitBps;
    }

    /**
     * @dev Emergency token rescue function
     * @param token Token to rescue
     * @param to Recipient address
     * @param amount Amount to rescue (0 = entire balance)
     */
    function rescueTokens(
        IERC20 token,
        address to,
        uint256 amount
    ) internal {
        require(to != address(0), "ArbitrageLib: Invalid recipient");
        
        uint256 balance = token.balanceOf(address(this));
        uint256 rescueAmount = amount == 0 ? balance : amount;
        
        require(rescueAmount > 0, "ArbitrageLib: Nothing to rescue");
        require(balance >= rescueAmount, "ArbitrageLib: Insufficient balance");
        
        token.safeTransfer(to, rescueAmount);
    }

    /**
     * @dev Get current gas price estimation
     * @return gasPrice Current gas price
     */
    function getCurrentGasPrice() internal view returns (uint256 gasPrice) {
        gasPrice = tx.gasprice;
    }

    /**
     * @dev Convert ETH amount to token amount using price
     * @param ethAmount Amount in ETH
     * @param tokenPriceInEth Token price in ETH (18 decimals)
     * @return tokenAmount Equivalent token amount
     */
    function ethToToken(
        uint256 ethAmount,
        uint256 tokenPriceInEth
    ) internal pure returns (uint256 tokenAmount) {
        require(tokenPriceInEth > 0, "ArbitrageLib: Invalid token price");
        tokenAmount = (ethAmount * 1e18) / tokenPriceInEth;
    }
}
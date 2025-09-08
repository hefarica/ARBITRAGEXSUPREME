// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title ArbitrageLib
 * @dev Librería avanzada para cálculos de arbitraje multi-chain
 * @notice Optimizada para máxima eficiencia de gas y precisión
 */
library ArbitrageLib {
    using SafeERC20 for IERC20;

    // Constantes optimizadas
    uint256 private constant BASIS_POINTS = 10000;
    uint256 private constant WAD = 1e18;
    uint256 private constant RAY = 1e27;
    uint256 private constant MAX_SLIPPAGE = 500; // 5%
    uint256 private constant MIN_PROFIT_BPS = 10; // 0.1%

    // Estructura para cálculos de rentabilidad
    struct ProfitCalculation {
        uint256 expectedAmountOut;
        uint256 gasEstimate;
        uint256 flashLoanFee;
        uint256 totalFees;
        uint256 netProfit;
        uint256 profitPercentage;
        bool isProfitable;
    }

    // Estructura para análisis de ruta
    struct RouteAnalysis {
        uint256 totalAmountOut;
        uint256 totalGasCost;
        uint256 priceImpact;
        uint256 liquidityDepth;
        bool isViable;
        string riskLevel;
    }

    // Errores customizados
    error InsufficientLiquidity();
    error ExcessiveSlippage();
    error UnprofitableArbitrage();
    error InvalidRoute();
    error GasPriceTooHigh();

    /**
     * @dev Calcula la rentabilidad de un arbitraje simple
     */
    function calculateSimpleArbitrageProfit(
        uint256 amountIn,
        uint256 amountOutDEX1,
        uint256 amountOutDEX2,
        uint256 gasPrice,
        uint256 gasEstimate,
        uint256 flashLoanFee
    ) internal pure returns (ProfitCalculation memory calc) {
        
        calc.expectedAmountOut = amountOutDEX2;
        calc.gasEstimate = gasEstimate;
        calc.flashLoanFee = flashLoanFee;
        
        // Calcular fees totales en wei
        uint256 gasCostWei = gasPrice * gasEstimate;
        calc.totalFees = flashLoanFee + gasCostWei;
        
        // Calcular profit neto
        if (calc.expectedAmountOut > amountIn + calc.totalFees) {
            calc.netProfit = calc.expectedAmountOut - amountIn - calc.totalFees;
            calc.profitPercentage = (calc.netProfit * BASIS_POINTS) / amountIn;
            calc.isProfitable = calc.profitPercentage >= MIN_PROFIT_BPS;
        } else {
            calc.netProfit = 0;
            calc.profitPercentage = 0;
            calc.isProfitable = false;
        }
    }

    /**
     * @dev Calcula la rentabilidad de arbitraje triangular
     */
    function calculateTriangularArbitrageProfit(
        uint256 amountIn,
        uint256 amountOut1, // A -> B
        uint256 amountOut2, // B -> C  
        uint256 amountOut3, // C -> A
        uint256 totalGasCost,
        uint256 flashLoanFee
    ) internal pure returns (ProfitCalculation memory calc) {
        
        calc.expectedAmountOut = amountOut3;
        calc.totalFees = totalGasCost + flashLoanFee;
        
        if (calc.expectedAmountOut > amountIn + calc.totalFees) {
            calc.netProfit = calc.expectedAmountOut - amountIn - calc.totalFees;
            calc.profitPercentage = (calc.netProfit * BASIS_POINTS) / amountIn;
            calc.isProfitable = calc.profitPercentage >= MIN_PROFIT_BPS;
        } else {
            calc.netProfit = 0;
            calc.profitPercentage = 0;
            calc.isProfitable = false;
        }
    }

    /**
     * @dev Analiza una ruta de arbitraje para viabilidad
     */
    function analyzeRoute(
        address[] memory path,
        uint256[] memory amountsOut,
        uint256[] memory liquidities,
        uint256 gasEstimate
    ) internal pure returns (RouteAnalysis memory analysis) {
        
        require(path.length >= 2, "Invalid path length");
        require(amountsOut.length == path.length - 1, "Amounts mismatch");
        
        analysis.totalAmountOut = amountsOut[amountsOut.length - 1];
        analysis.totalGasCost = gasEstimate;
        
        // Calcular price impact promedio
        uint256 totalPriceImpact = 0;
        uint256 minLiquidity = type(uint256).max;
        
        for (uint256 i = 0; i < amountsOut.length; i++) {
            if (i < liquidities.length) {
                // Price impact = (amountOut / liquidity) * 100
                uint256 impact = (amountsOut[i] * BASIS_POINTS) / liquidities[i];
                totalPriceImpact += impact;
                
                if (liquidities[i] < minLiquidity) {
                    minLiquidity = liquidities[i];
                }
            }
        }
        
        analysis.priceImpact = totalPriceImpact / amountsOut.length;
        analysis.liquidityDepth = minLiquidity;
        
        // Determinar viabilidad y riesgo
        if (analysis.priceImpact <= 50) { // <= 0.5%
            analysis.riskLevel = "LOW";
            analysis.isViable = true;
        } else if (analysis.priceImpact <= 200) { // <= 2%
            analysis.riskLevel = "MEDIUM";
            analysis.isViable = minLiquidity > 100000 * WAD; // $100k min
        } else {
            analysis.riskLevel = "HIGH";
            analysis.isViable = false;
        }
    }

    /**
     * @dev Calcula el slippage óptimo basado en liquidez
     */
    function calculateOptimalSlippage(
        uint256 amountIn,
        uint256 liquidity,
        uint256 baseSlippage
    ) internal pure returns (uint256 optimalSlippage) {
        
        // Slippage dinámico basado en ratio amount/liquidity
        uint256 liquidityRatio = (amountIn * BASIS_POINTS) / liquidity;
        
        if (liquidityRatio <= 10) { // <= 0.1%
            optimalSlippage = baseSlippage;
        } else if (liquidityRatio <= 50) { // <= 0.5%
            optimalSlippage = baseSlippage + (baseSlippage * 25) / 100;
        } else if (liquidityRatio <= 100) { // <= 1%
            optimalSlippage = baseSlippage + (baseSlippage * 50) / 100;
        } else {
            optimalSlippage = baseSlippage * 2;
        }
        
        // Cap máximo de slippage
        if (optimalSlippage > MAX_SLIPPAGE) {
            optimalSlippage = MAX_SLIPPAGE;
        }
    }

    /**
     * @dev Valida condiciones mínimas para arbitraje
     */
    function validateArbitrageConditions(
        uint256 amountIn,
        uint256 expectedProfit,
        uint256 gasPrice,
        uint256 maxGasPrice,
        uint256 minProfitThreshold
    ) internal pure returns (bool isValid, string memory reason) {
        
        if (gasPrice > maxGasPrice) {
            return (false, "Gas price too high");
        }
        
        if (expectedProfit < minProfitThreshold) {
            return (false, "Profit below threshold");
        }
        
        if (amountIn == 0) {
            return (false, "Invalid amount");
        }
        
        return (true, "");
    }

    /**
     * @dev Calcula el precio ETH de un token usando oracle
     */
    function getTokenPriceInETH(
        address token,
        address priceOracle,
        uint256 amount
    ) internal view returns (uint256 ethValue) {
        // Implementación simplificada - en producción usar Chainlink
        // o múltiples oracles para mayor seguridad
        if (token == address(0)) {
            return amount; // Es ETH
        }
        
        // Placeholder para price oracle
        // En implementación real, integrar con Chainlink Price Feeds
        ethValue = amount; // Simplificado por ahora
    }

    /**
     * @dev Ejecuta transfer con validación de balance
     */
    function safeTransferWithValidation(
        IERC20 token,
        address to,
        uint256 amount
    ) internal {
        uint256 balanceBefore = token.balanceOf(address(this));
        require(balanceBefore >= amount, "Insufficient balance");
        
        token.safeTransfer(to, amount);
        
        uint256 balanceAfter = token.balanceOf(address(this));
        require(balanceAfter == balanceBefore - amount, "Transfer validation failed");
    }
}
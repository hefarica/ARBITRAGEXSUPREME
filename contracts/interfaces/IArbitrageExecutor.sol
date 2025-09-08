// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IArbitrageExecutor
 * @dev Interface principal para ejecutores de arbitraje híbrido
 * @notice Sistema más avanzado del mercado DeFi para arbitraje multi-chain
 */
interface IArbitrageExecutor {
    
    // Estructuras de datos optimizadas
    struct ArbitrageParams {
        address tokenA;
        address tokenB; 
        address tokenC;        // Para arbitraje triangular
        uint256 amountIn;
        uint256 minAmountOut;
        uint256 maxGasPrice;
        uint32 deadline;
        bytes routeData;       // Datos específicos de la ruta
        bool useFlashLoan;
        address flashLoanProvider;
    }

    struct SwapRoute {
        address dex;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 minAmountOut;
        uint24 fee;           // Para Uniswap V3
        bytes extraData;      // Datos específicos del DEX
    }

    struct ExecutionResult {
        uint256 actualAmountOut;
        uint256 gasUsed;
        uint256 profit;
        uint256 feesPaid;
        bool success;
        string errorMessage;
    }

    // Eventos optimizados para analytics
    event ArbitrageExecuted(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 profit,
        uint256 gasUsed,
        string strategy
    );

    event FlashLoanExecuted(
        address indexed provider,
        address indexed token,
        uint256 amount,
        uint256 fee,
        bool success
    );

    event EmergencyWithdraw(
        address indexed token,
        address indexed recipient,
        uint256 amount
    );

    // Funciones principales de ejecución
    function executeArbitrage(
        ArbitrageParams calldata params,
        SwapRoute[] calldata routes
    ) external payable returns (ExecutionResult memory result);

    function executeTriangularArbitrage(
        address tokenA,
        address tokenB,
        address tokenC,
        uint256 amountIn,
        SwapRoute[] calldata routes
    ) external payable returns (ExecutionResult memory result);

    function executeFlashLoanArbitrage(
        address flashLoanProvider,
        address asset,
        uint256 amount,
        bytes calldata params
    ) external returns (ExecutionResult memory result);

    // Funciones de análisis y validación
    function calculateProfitability(
        ArbitrageParams calldata params,
        SwapRoute[] calldata routes
    ) external view returns (
        uint256 expectedProfit,
        uint256 gasEstimate,
        bool isProfitable
    );

    function validateRoute(
        SwapRoute[] calldata routes
    ) external view returns (bool isValid, string memory reason);

    // Funciones de configuración
    function setMaxGasPrice(uint256 _maxGasPrice) external;
    function setMinProfitThreshold(uint256 _minProfit) external;
    function updateDEXRegistry(address _newRegistry) external;

    // Funciones de emergencia
    function emergencyWithdraw(address token, uint256 amount) external;
    function pause() external;
    function unpause() external;

    // Getters
    function getMaxGasPrice() external view returns (uint256);
    function getMinProfitThreshold() external view returns (uint256);
    function isPaused() external view returns (bool);
    function getSupportedTokens() external view returns (address[] memory);
    function getSupportedDEXs() external view returns (address[] memory);
}
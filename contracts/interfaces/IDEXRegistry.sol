// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IDEXRegistry
 * @dev Registro universal de DEXs para todas las blockchains
 * @notice Sistema híbrido con 50+ DEXs soportados
 */
interface IDEXRegistry {
    
    // Tipos de DEX soportados
    enum DEXType {
        UNISWAP_V2,      // Fork de Uniswap V2
        UNISWAP_V3,      // Uniswap V3 con fees variables
        CURVE,           // Curve AMM para stablecoins
        BALANCER_V2,     // Balancer weighted pools
        SUSHISWAP,       // SushiSwap
        PANCAKESWAP_V2,  // PancakeSwap V2 (BSC)
        PANCAKESWAP_V3,  // PancakeSwap V3 (BSC)
        QUICKSWAP,       // QuickSwap (Polygon)
        TRADER_JOE,      // Trader Joe (Avalanche)
        SPOOKYSWAP,      // SpookySwap (Fantom)
        ONEINCHAGG,      // 1inch Aggregator
        DODO,            // DODO PMM
        GMX,             // GMX (Arbitrum)
        CAMELOT,         // Camelot (Arbitrum)
        VELODROME,       // Velodrome (Optimism)
        AERODROME,       // Aerodrome (Base)
        BASESWAP,        // BaseSwap (Base)
        SOLIDLY,         // Solidly forks
        BISWAP,          // Biswap (BSC)
        CUSTOM           // Custom implementation
    }

    struct DEXInfo {
        address router;
        address factory;
        DEXType dexType;
        uint24[] supportedFees;    // Para Uniswap V3 style
        bool isActive;
        uint256 minLiquidity;      // Liquidez mínima requerida
        uint256 maxSlippage;       // Slippage máximo permitido
        bytes extraData;           // Datos específicos del DEX
    }

    struct SwapParams {
        address dex;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 minAmountOut;
        uint24 fee;               // Para Uniswap V3
        address to;
        uint256 deadline;
        bytes extraData;
    }

    // Eventos
    event DEXRegistered(
        address indexed dex,
        DEXType indexed dexType,
        bool isActive
    );

    event DEXUpdated(
        address indexed dex,
        bool isActive
    );

    event SwapExecuted(
        address indexed dex,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );

    // Registro de DEXs
    function registerDEX(
        address dex,
        address router,
        address factory,
        DEXType dexType,
        uint24[] calldata supportedFees,
        uint256 minLiquidity,
        uint256 maxSlippage,
        bytes calldata extraData
    ) external;

    function updateDEX(
        address dex,
        bool isActive,
        uint256 minLiquidity,
        uint256 maxSlippage
    ) external;

    function removeDEX(address dex) external;

    // Funciones de swap
    function executeSwap(
        SwapParams calldata params
    ) external payable returns (uint256 amountOut);

    function getAmountOut(
        address dex,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint24 fee
    ) external view returns (uint256 amountOut);

    function getAmountIn(
        address dex,
        address tokenIn,
        address tokenOut,
        uint256 amountOut,
        uint24 fee
    ) external view returns (uint256 amountIn);

    // Consultas
    function getDEXInfo(address dex) external view returns (DEXInfo memory);
    function getSupportedDEXs() external view returns (address[] memory);
    function isDEXSupported(address dex) external view returns (bool);
    function getBestRate(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external view returns (
        address bestDEX,
        uint256 bestAmountOut,
        uint24 bestFee
    );

    // Utilidades
    function simulateSwap(
        address dex,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint24 fee
    ) external view returns (
        uint256 amountOut,
        uint256 gasEstimate,
        bool success
    );

    function validateRoute(
        address[] calldata path,
        address[] calldata dexes,
        uint24[] calldata fees
    ) external view returns (bool isValid);
}
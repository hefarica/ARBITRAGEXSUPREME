// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IDEXAdapter
 * @notice Interfaz para adaptadores de DEX
 * @dev Ingenio Pichichi S.A. - ArbitrageX Supreme
 * @author ArbitrageX Team
 */

struct SwapParams {
    address tokenIn;
    address tokenOut;
    uint256 amountIn;
    uint256 amountOutMinimum;
    uint256 deadline;
    bytes routeData;
}

struct QuoteParams {
    address tokenIn;
    address tokenOut;
    uint256 amountIn;
    bytes routeData;
}

interface IDEXAdapter {
    /**
     * @notice Eventos del adaptador DEX
     */
    event SwapExecuted(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        address indexed executor
    );
    
    event LiquidityPoolRegistered(
        address indexed pool,
        address indexed tokenA,
        address indexed tokenB,
        string dexName
    );

    /**
     * @notice Ejecutar swap de tokens
     * @param params Parámetros del swap
     * @return amountOut Cantidad de tokens recibidos
     */
    function swap(SwapParams calldata params) 
        external 
        returns (uint256 amountOut);

    /**
     * @notice Obtener quote para un swap
     * @param params Parámetros de la consulta
     * @return amountOut Cantidad estimada de salida
     * @return priceImpact Impacto en el precio (basis points)
     */
    function getQuote(QuoteParams calldata params) 
        external 
        view 
        returns (uint256 amountOut, uint256 priceImpact);

    /**
     * @notice Obtener mejor ruta para un swap
     * @param tokenIn Token de entrada
     * @param tokenOut Token de salida
     * @param amountIn Cantidad de entrada
     * @return route Datos de la ruta optimizada
     * @return expectedOutput Output esperado
     */
    function getBestRoute(
        address tokenIn, 
        address tokenOut, 
        uint256 amountIn
    ) 
        external 
        view 
        returns (bytes memory route, uint256 expectedOutput);

    /**
     * @notice Verificar si el par de tokens está soportado
     * @param tokenA Primer token
     * @param tokenB Segundo token
     * @return supported True si está soportado
     */
    function isTokenPairSupported(address tokenA, address tokenB) 
        external 
        view 
        returns (bool supported);

    /**
     * @notice Obtener pools disponibles para un par de tokens
     * @param tokenA Primer token
     * @param tokenB Segundo token
     * @return pools Array de direcciones de pools
     * @return reserves Array de reserves correspondientes
     */
    function getAvailablePools(address tokenA, address tokenB) 
        external 
        view 
        returns (address[] memory pools, uint256[][] memory reserves);

    /**
     * @notice Obtener fee del DEX para un swap
     * @param tokenA Primer token
     * @param tokenB Segundo token
     * @param pool Dirección del pool (opcional)
     * @return fee Fee en basis points
     */
    function getSwapFee(address tokenA, address tokenB, address pool) 
        external 
        view 
        returns (uint256 fee);

    /**
     * @notice Obtener nombre del DEX
     * @return name Nombre del DEX
     */
    function getDEXName() external pure returns (string memory name);

    /**
     * @notice Obtener versión del adaptador
     * @return version Versión del adaptador
     */
    function getVersion() external pure returns (string memory version);

    /**
     * @notice Estimar gas para un swap
     * @param params Parámetros del swap
     * @return gasEstimate Gas estimado
     */
    function estimateGas(SwapParams calldata params) 
        external 
        view 
        returns (uint256 gasEstimate);
}
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IArbitrageEngine
 * @notice Interfaz principal para el motor de arbitraje
 * @dev Ingenio Pichichi S.A. - ArbitrageX Supreme
 * @author ArbitrageX Team
 */

struct ArbitrageParams {
    address tokenA;
    address tokenB;
    uint256 amount;
    uint256 minProfit;
    uint256 maxSlippage;
    uint256 deadline;
    bytes strategyData;
}

struct ArbitrageResult {
    bool success;
    uint256 profit;
    uint256 gasUsed;
    uint256 executionTime;
}

struct FlashLoanParams {
    address asset;
    uint256 amount;
    bytes params;
}

interface IArbitrageEngine {
    /**
     * @notice Eventos del sistema de arbitraje
     */
    event ArbitrageExecuted(
        address indexed executor,
        address indexed tokenA,
        address indexed tokenB,
        uint256 amount,
        uint256 profit,
        string strategyType
    );
    
    event FlashLoanInitiated(
        address indexed asset,
        uint256 amount,
        address indexed borrower
    );
    
    event StrategyRegistered(
        string indexed strategyType,
        address indexed implementation
    );
    
    event ProfitDistributed(
        address indexed executor,
        uint256 amount,
        uint256 fee
    );

    /**
     * @notice Ejecutar arbitraje con flash loan
     * @param params Parámetros del arbitraje
     * @return result Resultado de la ejecución
     */
    function executeArbitrage(ArbitrageParams calldata params) 
        external 
        returns (ArbitrageResult memory result);

    /**
     * @notice Simular arbitraje (view function)
     * @param params Parámetros del arbitraje
     * @return estimatedProfit Ganancia estimada
     * @return estimatedGas Gas estimado
     */
    function simulateArbitrage(ArbitrageParams calldata params) 
        external 
        view 
        returns (uint256 estimatedProfit, uint256 estimatedGas);

    /**
     * @notice Registrar nueva estrategia de arbitraje
     * @param strategyType Tipo de estrategia
     * @param implementation Dirección del contrato implementación
     */
    function registerStrategy(string calldata strategyType, address implementation) external;

    /**
     * @notice Obtener implementación de estrategia
     * @param strategyType Tipo de estrategia
     * @return implementation Dirección del contrato
     */
    function getStrategy(string calldata strategyType) 
        external 
        view 
        returns (address implementation);

    /**
     * @notice Verificar si una estrategia está disponible
     * @param strategyType Tipo de estrategia
     * @return available True si está disponible
     */
    function isStrategyAvailable(string calldata strategyType) 
        external 
        view 
        returns (bool available);

    /**
     * @notice Obtener balance de token para el contrato
     * @param token Dirección del token
     * @return balance Balance actual
     */
    function getTokenBalance(address token) 
        external 
        view 
        returns (uint256 balance);

    /**
     * @notice Retirar ganancias acumuladas
     * @param token Dirección del token
     * @param amount Cantidad a retirar
     */
    function withdrawProfits(address token, uint256 amount) external;

    /**
     * @notice Pausa de emergencia del contrato
     */
    function emergencyPause() external;

    /**
     * @notice Reanudar operaciones del contrato
     */
    function unpause() external;
}
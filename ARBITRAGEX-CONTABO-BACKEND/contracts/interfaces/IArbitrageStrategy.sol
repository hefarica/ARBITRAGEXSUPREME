// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IArbitrageStrategy
 * @dev Interface para todas las estrategias de arbitraje de ArbitrageX Supreme
 */
interface IArbitrageStrategy {
    
    /**
     * @dev Ejecuta la estrategia de arbitraje
     * @param asset Token principal para el arbitraje
     * @param amount Cantidad disponible
     * @param data Datos específicos de la estrategia (encoded)
     * @return profit Ganancia obtenida
     */
    function execute(
        address asset,
        uint256 amount,
        bytes calldata data
    ) external returns (uint256 profit);
    
    /**
     * @dev Simula la ejecución sin ejecutarla realmente
     * @param asset Token principal para el arbitraje
     * @param amount Cantidad disponible
     * @param data Datos específicos de la estrategia (encoded)
     * @return expectedProfit Ganancia esperada
     * @return gasEstimate Estimación de gas
     */
    function simulate(
        address asset,
        uint256 amount,
        bytes calldata data
    ) external view returns (uint256 expectedProfit, uint256 gasEstimate);
    
    /**
     * @dev Obtiene información de la estrategia
     * @return name Nombre de la estrategia
     * @return description Descripción de la estrategia
     * @return riskLevel Nivel de riesgo (1-10)
     */
    function getStrategyInfo() external pure returns (
        string memory name,
        string memory description,
        uint8 riskLevel
    );
    
    /**
     * @dev Verifica si la estrategia puede ejecutarse con los parámetros dados
     * @param asset Token principal
     * @param amount Cantidad
     * @param data Datos de la estrategia
     * @return canExecute Si puede ejecutarse
     * @return reason Razón si no puede ejecutarse
     */
    function canExecute(
        address asset,
        uint256 amount,
        bytes calldata data
    ) external view returns (bool canExecute, string memory reason);
}
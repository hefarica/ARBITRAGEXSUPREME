// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IFlashLoanProvider
 * @dev Interface unificada para proveedores de flash loans (Aave, Balancer, dYdX, etc.)
 */
interface IFlashLoanProvider {
    
    /**
     * @dev Solicita un flash loan
     * @param asset Dirección del token a pedir prestado
     * @param amount Cantidad a pedir prestado
     * @param params Parámetros adicionales para el callback
     */
    function flashLoan(
        address asset,
        uint256 amount,
        bytes calldata params
    ) external;
    
    /**
     * @dev Solicita múltiples flash loans
     * @param assets Array de tokens
     * @param amounts Array de cantidades
     * @param params Parámetros adicionales
     */
    function flashLoanMultiple(
        address[] calldata assets,
        uint256[] calldata amounts,
        bytes calldata params
    ) external;
    
    /**
     * @dev Obtiene el fee del flash loan
     * @param asset Token
     * @param amount Cantidad
     * @return fee Fee a pagar
     */
    function getFlashLoanFee(address asset, uint256 amount) external view returns (uint256 fee);
    
    /**
     * @dev Verifica si un asset soporta flash loans
     * @param asset Token a verificar
     * @return supported Si está soportado
     */
    function supportsAsset(address asset) external view returns (bool supported);
    
    /**
     * @dev Obtiene la liquidez disponible para flash loan
     * @param asset Token
     * @return liquidity Liquidez disponible
     */
    function getAvailableLiquidity(address asset) external view returns (uint256 liquidity);
}

/**
 * @title IFlashLoanReceiver
 * @dev Interface que debe implementar el receptor de flash loans
 */
interface IFlashLoanReceiver {
    
    /**
     * @dev Callback ejecutado durante el flash loan
     * @param asset Token prestado
     * @param amount Cantidad prestada
     * @param fee Fee a pagar
     * @param params Parámetros del flash loan
     * @return success Si la operación fue exitosa
     */
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 fee,
        bytes calldata params
    ) external returns (bool success);
}
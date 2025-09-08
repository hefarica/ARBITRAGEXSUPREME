// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IFlashLoanProvider
 * @notice Interfaz para proveedores de flash loans
 * @dev Ingenio Pichichi S.A. - ArbitrageX Supreme
 * @author ArbitrageX Team
 */

interface IFlashLoanProvider {
    /**
     * @notice Eventos de flash loans
     */
    event FlashLoanExecuted(
        address indexed borrower,
        address indexed asset,
        uint256 amount,
        uint256 fee,
        bool success
    );

    /**
     * @notice Solicitar flash loan
     * @param asset Dirección del token a prestar
     * @param amount Cantidad a prestar
     * @param params Datos adicionales para el callback
     * @param receiver Contrato que recibirá el callback
     */
    function flashLoan(
        address asset,
        uint256 amount,
        bytes calldata params,
        address receiver
    ) external;

    /**
     * @notice Obtener fee del flash loan
     * @param asset Dirección del token
     * @param amount Cantidad a prestar
     * @return fee Fee en wei
     */
    function getFlashLoanFee(address asset, uint256 amount) 
        external 
        view 
        returns (uint256 fee);

    /**
     * @notice Verificar si el asset está disponible para flash loan
     * @param asset Dirección del token
     * @return available True si está disponible
     */
    function isAssetSupported(address asset) 
        external 
        view 
        returns (bool available);

    /**
     * @notice Obtener liquidez disponible para flash loan
     * @param asset Dirección del token
     * @return liquidity Liquidez disponible
     */
    function getAvailableLiquidity(address asset) 
        external 
        view 
        returns (uint256 liquidity);
}

/**
 * @title IFlashLoanReceiver
 * @notice Interfaz que deben implementar los receptores de flash loans
 */
interface IFlashLoanReceiver {
    /**
     * @notice Callback ejecutado cuando se recibe el flash loan
     * @param asset Dirección del token prestado
     * @param amount Cantidad prestada
     * @param fee Fee del flash loan
     * @param initiator Dirección que inició el flash loan
     * @param params Datos adicionales
     * @return success True si la ejecución fue exitosa
     */
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 fee,
        address initiator,
        bytes calldata params
    ) external returns (bool success);
}
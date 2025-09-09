// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IFlashLoanProvider.sol";
import "../interfaces/IArbitrageCallback.sol";

// Balancer V2 Interfaces
interface IVault {
    function flashLoan(
        address recipient,
        address[] memory tokens,
        uint256[] memory amounts,
        bytes memory userData
    ) external;
    
    function getProtocolFeesCollector() external view returns (address);
}

interface IFlashLoanRecipient {
    function receiveFlashLoan(
        address[] memory tokens,
        uint256[] memory amounts,
        uint256[] memory feeAmounts,
        bytes memory userData
    ) external;
}

interface IProtocolFeesCollector {
    function getFlashLoanFeePercentage() external view returns (uint256);
}

/**
 * @title BalancerV2FlashLoanProvider
 * @dev Adaptador para flash loans de Balancer V2
 * @notice Implementa IFlashLoanProvider para integración con ArbitrageX Supreme V3.0
 * 
 * Ventajas Balancer V2:
 * - Sin fees en flash loans (0%)
 * - Alta liquidez disponible
 * - Soporte multi-token en una sola transacción
 */
contract BalancerV2FlashLoanProvider is 
    IFlashLoanProvider, 
    IFlashLoanRecipient,
    AccessControl, 
    ReentrancyGuard 
{
    using SafeERC20 for IERC20;

    // === CONSTANTS ===
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
    uint256 public constant MAX_TOKENS_PER_FLASHLOAN = 10;

    // === STATE VARIABLES ===
    IVault public immutable vault;
    address public immutable arbitrageContract;
    IProtocolFeesCollector public immutable feesCollector;
    
    mapping(address => uint256) public totalFlashLoaned;
    mapping(address => uint256) public totalFeesCollected;
    
    uint256 public executedFlashLoans;
    bool public paused;
    
    // Multi-token flash loan support
    mapping(bytes32 => FlashLoanData) private activeFlashLoans;

    struct FlashLoanData {
        address initiator;
        address[] tokens;
        uint256[] amounts;
        bytes params;
        bool active;
    }

    // === EVENTS ===
    event FlashLoanExecuted(
        address[] indexed tokens,
        uint256[] amounts,
        uint256[] fees,
        address indexed initiator,
        bool success
    );
    
    event MultiTokenFlashLoan(
        uint256 tokenCount,
        uint256 totalValue,
        address indexed initiator
    );

    // === MODIFIERS ===
    modifier onlyExecutor() {
        require(hasRole(EXECUTOR_ROLE, msg.sender), "Not authorized executor");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "Contract paused");
        _;
    }

    modifier onlyVault() {
        require(msg.sender == address(vault), "Only vault can call");
        _;
    }

    // === CONSTRUCTOR ===
    constructor(
        address admin,
        address _vault,
        address _arbitrageContract
    ) {
        require(_vault != address(0), "Invalid vault address");
        require(_arbitrageContract != address(0), "Invalid arbitrage contract");
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(EXECUTOR_ROLE, admin);
        _grantRole(EXECUTOR_ROLE, _arbitrageContract);
        
        vault = IVault(_vault);
        arbitrageContract = _arbitrageContract;
        feesCollector = IProtocolFeesCollector(vault.getProtocolFeesCollector());
    }

    // === IFLASHLOANPROVIDER IMPLEMENTATION ===
    /**
     * @dev Ejecuta flash loan de Balancer V2 (sin fees!)
     */
    function executeFlashLoan(
        FlashLoanParams calldata params
    ) external override onlyExecutor whenNotPaused nonReentrant {
        require(params.asset != address(0), "Invalid asset");
        require(params.amount > 0, "Invalid amount");
        
        // Preparar arrays para Balancer V2
        address[] memory tokens = new address[](1);
        uint256[] memory amounts = new uint256[](1);
        
        tokens[0] = params.asset;
        amounts[0] = params.amount;
        
        // Crear ID único para este flash loan
        bytes32 flashLoanId = keccak256(abi.encodePacked(
            block.timestamp,
            block.number,
            msg.sender,
            params.asset,
            params.amount
        ));
        
        // Almacenar datos del flash loan
        activeFlashLoans[flashLoanId] = FlashLoanData({
            initiator: msg.sender,
            tokens: tokens,
            amounts: amounts,
            params: params.params,
            active: true
        });
        
        // Preparar userData con flashLoanId
        bytes memory userData = abi.encode(flashLoanId, params);
        
        // Ejecutar flash loan en Balancer V2
        try vault.flashLoan(
            address(this),  // recipient
            tokens,         // tokens array
            amounts,        // amounts array
            userData        // userData
        ) {
            executedFlashLoans++;
            totalFlashLoaned[params.asset] += params.amount;
            
            emit FlashLoanExecuted(
                tokens,
                amounts,
                new uint256[](1), // Balancer V2 = 0 fees
                msg.sender,
                true
            );
        } catch Error(string memory reason) {
            // Limpiar datos del flash loan fallido
            delete activeFlashLoans[flashLoanId];
            revert(reason);
        }
    }

    /**
     * @dev Ejecuta flash loan multi-token (ventaja única de Balancer)
     */
    function executeMultiTokenFlashLoan(
        address[] calldata tokens,
        uint256[] calldata amounts,
        bytes calldata params
    ) external onlyExecutor whenNotPaused nonReentrant {
        require(tokens.length > 0, "No tokens provided");
        require(tokens.length == amounts.length, "Mismatched arrays");
        require(tokens.length <= MAX_TOKENS_PER_FLASHLOAN, "Too many tokens");
        
        for (uint256 i = 0; i < tokens.length; i++) {
            require(tokens[i] != address(0), "Invalid token");
            require(amounts[i] > 0, "Invalid amount");
        }
        
        // Crear ID único para este flash loan multi-token
        bytes32 flashLoanId = keccak256(abi.encodePacked(
            block.timestamp,
            block.number,
            msg.sender,
            tokens,
            amounts
        ));
        
        // Almacenar datos del flash loan
        activeFlashLoans[flashLoanId] = FlashLoanData({
            initiator: msg.sender,
            tokens: tokens,
            amounts: amounts,
            params: params,
            active: true
        });
        
        // Preparar userData
        bytes memory userData = abi.encode(flashLoanId, msg.sender, params);
        
        // Ejecutar flash loan multi-token
        vault.flashLoan(
            address(this),
            tokens,
            amounts,
            userData
        );
        
        // Calcular valor total
        uint256 totalValue = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalValue += amounts[i]; // Simplified - in reality need price oracles
        }
        
        emit MultiTokenFlashLoan(tokens.length, totalValue, msg.sender);
    }

    /**
     * @dev Calcula fee del flash loan (0% en Balancer V2)
     */
    function calculateFlashLoanFee(
        address asset,
        uint256 amount
    ) public view override returns (uint256) {
        // Balancer V2 flash loans son gratis (0% fee)
        // Pero verificamos el fee collector por si cambia
        try feesCollector.getFlashLoanFeePercentage() returns (uint256 feePercentage) {
            return (amount * feePercentage) / 1e18;
        } catch {
            return 0; // Default: sin fees
        }
    }

    /**
     * @dev Verifica disponibilidad de liquidez
     */
    function isAssetSupported(address asset) external view override returns (bool) {
        try IERC20(asset).balanceOf(address(vault)) returns (uint256 balance) {
            return balance > 0;
        } catch {
            return false;
        }
    }

    /**
     * @dev Obtiene liquidez máxima disponible
     */
    function getMaxFlashLoanAmount(address asset) external view override returns (uint256) {
        return IERC20(asset).balanceOf(address(vault));
    }

    // === IFLASHLOANRECIPIENT IMPLEMENTATION ===
    /**
     * @dev Callback ejecutado por Balancer V2 durante flash loan
     */
    function receiveFlashLoan(
        address[] memory tokens,
        uint256[] memory amounts,
        uint256[] memory feeAmounts,
        bytes memory userData
    ) external override onlyVault nonReentrant {
        (bytes32 flashLoanId, address initiator, bytes memory params) = abi.decode(
            userData, 
            (bytes32, address, bytes)
        );
        
        // Verificar que el flash loan está activo
        FlashLoanData storage flashData = activeFlashLoans[flashLoanId];
        require(flashData.active, "Invalid flash loan");
        require(flashData.initiator == initiator, "Invalid initiator");
        
        // Transferir todos los tokens al contrato de arbitraje
        for (uint256 i = 0; i < tokens.length; i++) {
            IERC20(tokens[i]).safeTransfer(arbitrageContract, amounts[i]);
        }
        
        // Para single token flash loan, usar el callback estándar
        bool success;
        if (tokens.length == 1) {
            success = IArbitrageCallback(arbitrageContract).executeArbitrage(
                initiator,
                tokens[0],
                amounts[0],
                feeAmounts[0],
                params
            );
        } else {
            // Para multi-token, necesitamos un callback especial
            success = _executeMultiTokenArbitrage(
                initiator,
                tokens,
                amounts,
                feeAmounts,
                params
            );
        }
        
        require(success, "Arbitrage execution failed");
        
        // Verificar que tenemos suficientes tokens para repagar
        for (uint256 i = 0; i < tokens.length; i++) {
            uint256 repayAmount = amounts[i] + feeAmounts[i];
            uint256 balance = IERC20(tokens[i]).balanceOf(address(this));
            require(balance >= repayAmount, "Insufficient balance for repayment");
            
            // Los tokens se quedan en este contrato para repago automático
            // Balancer V2 los tomará automáticamente al final de la transacción
            
            // Actualizar estadísticas
            totalFeesCollected[tokens[i]] += feeAmounts[i];
        }
        
        // Limpiar datos del flash loan
        delete activeFlashLoans[flashLoanId];
    }

    /**
     * @dev Ejecuta arbitraje multi-token (funcionalidad avanzada)
     */
    function _executeMultiTokenArbitrage(
        address initiator,
        address[] memory tokens,
        uint256[] memory amounts,
        uint256[] memory feeAmounts,
        bytes memory params
    ) internal returns (bool success) {
        // TODO: Implementar lógica completa multi-token arbitrage
        // Por ahora, ejecutamos arbitrajes individuales para cada token
        
        success = true;
        for (uint256 i = 0; i < tokens.length; i++) {
            try IArbitrageCallback(arbitrageContract).executeArbitrage(
                initiator,
                tokens[i],
                amounts[i],
                feeAmounts[i],
                params
            ) returns (bool tokenSuccess) {
                if (!tokenSuccess) {
                    success = false;
                }
            } catch {
                success = false;
            }
        }
    }

    // === ADMIN FUNCTIONS ===
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        paused = true;
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        paused = false;
    }

    function grantExecutorRole(address executor) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(EXECUTOR_ROLE, executor);
    }

    function revokeExecutorRole(address executor) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(EXECUTOR_ROLE, executor);
    }

    // === EMERGENCY FUNCTIONS ===
    function emergencyWithdraw(
        address token,
        address to,
        uint256 amount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(paused, "Must be paused");
        IERC20(token).safeTransfer(to, amount);
    }

    function cancelActiveFlashLoan(bytes32 flashLoanId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(paused, "Must be paused");
        delete activeFlashLoans[flashLoanId];
    }

    // === VIEW FUNCTIONS ===
    function getProviderInfo() external view returns (
        string memory name,
        address vaultAddress,
        uint256 _executedFlashLoans,
        bool _paused
    ) {
        return ("Balancer V2", address(vault), executedFlashLoans, paused);
    }

    function getAssetStats(address asset) external view returns (
        uint256 totalLoaned,
        uint256 totalFees,
        uint256 currentLiquidity
    ) {
        return (
            totalFlashLoaned[asset],
            totalFeesCollected[asset],
            IERC20(asset).balanceOf(address(vault))
        );
    }

    function getFlashLoanFeePercentage() external view returns (uint256) {
        try feesCollector.getFlashLoanFeePercentage() returns (uint256 feePercentage) {
            return feePercentage;
        } catch {
            return 0;
        }
    }

    function getActiveFlashLoan(bytes32 flashLoanId) external view returns (FlashLoanData memory) {
        return activeFlashLoans[flashLoanId];
    }

    function isFlashLoanActive(bytes32 flashLoanId) external view returns (bool) {
        return activeFlashLoans[flashLoanId].active;
    }

    // === MULTI-TOKEN HELPERS ===
    function getMultiTokenLiquidity(
        address[] calldata tokens
    ) external view returns (uint256[] memory liquidities) {
        liquidities = new uint256[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            liquidities[i] = IERC20(tokens[i]).balanceOf(address(vault));
        }
    }

    function calculateMultiTokenFees(
        address[] calldata tokens,
        uint256[] calldata amounts
    ) external view returns (uint256[] memory fees) {
        fees = new uint256[](tokens.length);
        for (uint256 i = 0; i < tokens.length; i++) {
            fees[i] = calculateFlashLoanFee(tokens[i], amounts[i]);
        }
    }

    // === RECEIVE FUNCTION ===
    receive() external payable {
        revert("Direct ETH transfers not allowed");
    }
}
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IFlashLoanProvider.sol";
import "../interfaces/IArbitrageCallback.sol";

// Compound V3 Interfaces
interface IComet {
    function allow(address manager, bool isAllowed) external;
    function flashLoan(address to, uint256 amount, bytes calldata data) external;
    function baseToken() external view returns (address);
    function balanceOf(address account) external view returns (uint256);
    function supply(address asset, uint256 amount) external;
    function withdraw(address asset, uint256 amount) external;
    function getSupplyRate(uint utilization) external view returns (uint64);
    function getBorrowRate(uint utilization) external view returns (uint64);
    function getUtilization() external view returns (uint);
    function totalSupply() external view returns (uint256);
    function totalBorrow() external view returns (uint256);
    function getPrice(address priceFeed) external view returns (uint256);
}

interface ICometFlashLoanCallback {
    function flashLoanCallback(uint256 amount, bytes calldata data) external;
}

/**
 * @title CompoundV3FlashLoanProvider
 * @dev Adaptador para flash loans de Compound V3 (Comet)
 * @notice Implementa IFlashLoanProvider para integración con ArbitrageX Supreme V3.0
 * 
 * Características Compound V3:
 * - Flash loans sin fees si se repaga en la misma transacción
 * - Solo soporta base token (USDC en mainnet)
 * - Alta eficiencia y gas optimizado
 */
contract CompoundV3FlashLoanProvider is 
    IFlashLoanProvider, 
    ICometFlashLoanCallback,
    AccessControl, 
    ReentrancyGuard 
{
    using SafeERC20 for IERC20;

    // === CONSTANTS ===
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
    uint256 public constant FLASH_LOAN_FEE_RATE = 0; // 0% fee if repaid same tx

    // === STATE VARIABLES ===
    IComet public immutable comet;
    address public immutable baseToken;
    address public immutable arbitrageContract;
    
    mapping(address => uint256) public totalFlashLoaned;
    mapping(address => uint256) public totalFeesCollected;
    
    uint256 public executedFlashLoans;
    bool public paused;
    
    // Flash loan state tracking
    struct FlashLoanState {
        bool active;
        address initiator;
        uint256 amount;
        bytes params;
        uint256 timestamp;
    }
    
    FlashLoanState private currentFlashLoan;

    // === EVENTS ===
    event FlashLoanExecuted(
        address indexed asset,
        uint256 amount,
        uint256 fee,
        address indexed initiator,
        bool success
    );
    
    event CompoundV3FlashLoanStarted(
        uint256 amount,
        address indexed initiator,
        uint256 timestamp
    );
    
    event CompoundV3FlashLoanCompleted(
        uint256 amount,
        uint256 repayAmount,
        bool success
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

    modifier onlyComet() {
        require(msg.sender == address(comet), "Only comet can call");
        _;
    }

    modifier noActiveFlashLoan() {
        require(!currentFlashLoan.active, "Flash loan already active");
        _;
    }

    // === CONSTRUCTOR ===
    constructor(
        address admin,
        address _comet,
        address _arbitrageContract
    ) {
        require(_comet != address(0), "Invalid comet address");
        require(_arbitrageContract != address(0), "Invalid arbitrage contract");
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(EXECUTOR_ROLE, admin);
        _grantRole(EXECUTOR_ROLE, _arbitrageContract);
        
        comet = IComet(_comet);
        baseToken = comet.baseToken();
        arbitrageContract = _arbitrageContract;
        
        // Approve comet to manage our base tokens
        IERC20(baseToken).safeApprove(address(comet), type(uint256).max);
    }

    // === IFLASHLOANPROVIDER IMPLEMENTATION ===
    /**
     * @dev Ejecuta flash loan de Compound V3
     * @notice Solo soporta el base token del comet (USDC en mainnet)
     */
    function executeFlashLoan(
        FlashLoanParams calldata params
    ) external override onlyExecutor whenNotPaused nonReentrant noActiveFlashLoan {
        require(params.asset == baseToken, "Only base token supported");
        require(params.amount > 0, "Invalid amount");
        
        // Verificar liquidez disponible
        uint256 availableLiquidity = getMaxFlashLoanAmount(params.asset);
        require(params.amount <= availableLiquidity, "Insufficient liquidity");
        
        // Configurar estado del flash loan
        currentFlashLoan = FlashLoanState({
            active: true,
            initiator: msg.sender,
            amount: params.amount,
            params: params.params,
            timestamp: block.timestamp
        });
        
        emit CompoundV3FlashLoanStarted(params.amount, msg.sender, block.timestamp);
        
        // Preparar datos para callback
        bytes memory callbackData = abi.encode(params, msg.sender);
        
        // Ejecutar flash loan
        try comet.flashLoan(address(this), params.amount, callbackData) {
            executedFlashLoans++;
            totalFlashLoaned[params.asset] += params.amount;
            
            emit FlashLoanExecuted(
                params.asset,
                params.amount,
                0, // Compound V3 no cobra fees si se repaga en la misma tx
                msg.sender,
                true
            );
            
        } catch Error(string memory reason) {
            // Limpiar estado en caso de error
            delete currentFlashLoan;
            revert(reason);
        }
    }

    /**
     * @dev Calcula fee del flash loan (0% en Compound V3 si se repaga mismo tx)
     */
    function calculateFlashLoanFee(
        address asset,
        uint256 amount
    ) public view override returns (uint256) {
        require(asset == baseToken, "Only base token supported");
        
        // Compound V3 no cobra fees por flash loans si se repaga en la misma transacción
        // Solo cobraría si se mantiene como deuda, lo cual no es nuestro caso
        return 0;
    }

    /**
     * @dev Verifica si el asset es soportado (solo base token)
     */
    function isAssetSupported(address asset) external view override returns (bool) {
        return asset == baseToken;
    }

    /**
     * @dev Obtiene liquidez máxima disponible
     */
    function getMaxFlashLoanAmount(address asset) public view override returns (uint256) {
        require(asset == baseToken, "Only base token supported");
        
        // La liquidez disponible es el balance del comet menos lo prestado
        uint256 totalSupplied = comet.totalSupply();
        uint256 totalBorrowed = comet.totalBorrow();
        
        if (totalSupplied > totalBorrowed) {
            return totalSupplied - totalBorrowed;
        }
        
        return 0;
    }

    // === ICOMETFLASHLOANCALLBACK IMPLEMENTATION ===
    /**
     * @dev Callback ejecutado por Compound V3 durante flash loan
     */
    function flashLoanCallback(
        uint256 amount,
        bytes calldata data
    ) external override onlyComet nonReentrant {
        require(currentFlashLoan.active, "No active flash loan");
        require(currentFlashLoan.amount == amount, "Amount mismatch");
        
        // Decodificar datos del callback
        (FlashLoanParams memory params, address initiator) = abi.decode(
            data, 
            (FlashLoanParams, address)
        );
        
        require(initiator == currentFlashLoan.initiator, "Initiator mismatch");
        
        // Transferir tokens al contrato de arbitraje
        IERC20(baseToken).safeTransfer(arbitrageContract, amount);
        
        // Ejecutar callback del arbitraje
        bool success = IArbitrageCallback(arbitrageContract).executeArbitrage(
            initiator,
            baseToken,
            amount,
            0, // No fee en Compound V3
            currentFlashLoan.params
        );
        
        require(success, "Arbitrage execution failed");
        
        // Verificar que tenemos suficientes tokens para repagar
        uint256 balance = IERC20(baseToken).balanceOf(address(this));
        require(balance >= amount, "Insufficient balance for repayment");
        
        // En Compound V3, el repago se hace automáticamente
        // Los tokens se quedan en este contrato y Comet los toma
        
        emit CompoundV3FlashLoanCompleted(amount, amount, true);
        
        // Limpiar estado del flash loan
        delete currentFlashLoan;
    }

    // === COMPOUND V3 SPECIFIC FUNCTIONS ===
    /**
     * @dev Obtiene información del mercado de Compound V3
     */
    function getMarketInfo() external view returns (
        uint256 totalSupply,
        uint256 totalBorrow,
        uint256 utilization,
        uint64 supplyRate,
        uint64 borrowRate
    ) {
        totalSupply = comet.totalSupply();
        totalBorrow = comet.totalBorrow();
        utilization = comet.getUtilization();
        supplyRate = comet.getSupplyRate(utilization);
        borrowRate = comet.getBorrowRate(utilization);
    }

    /**
     * @dev Obtiene el balance disponible en el comet
     */
    function getCometBalance() external view returns (uint256) {
        return comet.balanceOf(address(comet));
    }

    /**
     * @dev Verifica si hay liquidez suficiente para un monto específico
     */
    function hasLiquidity(uint256 amount) external view returns (bool) {
        return amount <= getMaxFlashLoanAmount(baseToken);
    }

    /**
     * @dev Calcula el costo total de un flash loan (incluyendo gas)
     */
    function calculateTotalCost(uint256 amount) external view returns (uint256 totalCost, uint256 gasCost) {
        // Fee es 0 en Compound V3
        uint256 flashLoanFee = 0;
        
        // Estimar gas cost (aproximado)
        gasCost = tx.gasprice * 300000; // ~300k gas estimado
        
        totalCost = flashLoanFee + gasCost;
    }

    // === EMERGENCY & RECOVERY FUNCTIONS ===
    /**
     * @dev Función de emergencia para recuperar tokens
     */
    function emergencyRepayFlashLoan() external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(currentFlashLoan.active, "No active flash loan");
        require(paused, "Must be paused");
        
        uint256 repayAmount = currentFlashLoan.amount;
        uint256 balance = IERC20(baseToken).balanceOf(address(this));
        
        if (balance >= repayAmount) {
            // Los tokens ya están aquí, Comet los tomará automáticamente
            delete currentFlashLoan;
        } else {
            // Intentar supply desde admin funds si es necesario
            revert("Insufficient balance for emergency repay");
        }
    }

    /**
     * @dev Supply tokens al Comet (para emergencias)
     */
    function emergencySupply(uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(paused, "Must be paused");
        IERC20(baseToken).safeTransferFrom(msg.sender, address(this), amount);
        comet.supply(baseToken, amount);
    }

    /**
     * @dev Withdraw tokens del Comet (para emergencias)
     */
    function emergencyWithdraw(uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(paused, "Must be paused");
        comet.withdraw(baseToken, amount);
        IERC20(baseToken).safeTransfer(msg.sender, amount);
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

    function updateCometApproval() external onlyRole(DEFAULT_ADMIN_ROLE) {
        IERC20(baseToken).safeApprove(address(comet), 0);
        IERC20(baseToken).safeApprove(address(comet), type(uint256).max);
    }

    // === VIEW FUNCTIONS ===
    function getProviderInfo() external view returns (
        string memory name,
        address cometAddress,
        address _baseToken,
        uint256 _executedFlashLoans,
        bool _paused
    ) {
        return (
            "Compound V3", 
            address(comet), 
            baseToken, 
            executedFlashLoans, 
            paused
        );
    }

    function getAssetStats(address asset) external view returns (
        uint256 totalLoaned,
        uint256 totalFees,
        uint256 currentLiquidity
    ) {
        require(asset == baseToken, "Only base token supported");
        return (
            totalFlashLoaned[asset],
            totalFeesCollected[asset],
            getMaxFlashLoanAmount(asset)
        );
    }

    function getCurrentFlashLoanState() external view returns (
        bool active,
        address initiator,
        uint256 amount,
        uint256 timestamp
    ) {
        return (
            currentFlashLoan.active,
            currentFlashLoan.initiator,
            currentFlashLoan.amount,
            currentFlashLoan.timestamp
        );
    }

    function getBaseToken() external view returns (address) {
        return baseToken;
    }

    // === RECEIVE FUNCTION ===
    receive() external payable {
        revert("Direct ETH transfers not allowed");
    }
}
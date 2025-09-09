// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IFlashLoanProvider.sol";

// Aave V3 Interfaces
interface IPoolAddressesProvider {
    function getPool() external view returns (address);
}

interface IPool {
    function flashLoan(
        address receiverAddress,
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata modes,
        address onBehalfOf,
        bytes calldata params,
        uint16 referralCode
    ) external;
    
    function FLASHLOAN_PREMIUM_TOTAL() external view returns (uint128);
}

interface IFlashLoanReceiver {
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external returns (bool);
}

/**
 * @title AaveV3FlashLoanProvider
 * @dev Adaptador para flash loans de Aave V3
 * @notice Implementa IFlashLoanProvider para integración con ArbitrageX Supreme V3.0
 */
contract AaveV3FlashLoanProvider is 
    IFlashLoanProvider, 
    IFlashLoanReceiver,
    AccessControl, 
    ReentrancyGuard 
{
    using SafeERC20 for IERC20;

    // === CONSTANTS ===
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
    uint16 public constant REFERRAL_CODE = 0;

    // === STATE VARIABLES ===
    IPoolAddressesProvider public immutable addressesProvider;
    IPool public immutable pool;
    address public immutable arbitrageContract;
    
    mapping(address => uint256) public totalFlashLoaned;
    mapping(address => uint256) public totalFeesCollected;
    
    uint256 public executedFlashLoans;
    bool public paused;

    // === EVENTS ===
    event FlashLoanExecuted(
        address indexed asset,
        uint256 amount,
        uint256 premium,
        address indexed initiator,
        bool success
    );
    
    event FlashLoanFailed(
        address indexed asset,
        uint256 amount,
        string reason
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

    // === CONSTRUCTOR ===
    constructor(
        address admin,
        address _addressesProvider,
        address _arbitrageContract
    ) {
        require(_addressesProvider != address(0), "Invalid addresses provider");
        require(_arbitrageContract != address(0), "Invalid arbitrage contract");
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(EXECUTOR_ROLE, admin);
        _grantRole(EXECUTOR_ROLE, _arbitrageContract);
        
        addressesProvider = IPoolAddressesProvider(_addressesProvider);
        pool = IPool(addressesProvider.getPool());
        arbitrageContract = _arbitrageContract;
    }

    // === IFLASHLOANPROVIDER IMPLEMENTATION ===
    /**
     * @dev Ejecuta flash loan de Aave V3
     */
    function executeFlashLoan(
        FlashLoanParams calldata params
    ) external override onlyExecutor whenNotPaused nonReentrant {
        require(params.asset != address(0), "Invalid asset");
        require(params.amount > 0, "Invalid amount");
        
        // Preparar arrays para Aave V3
        address[] memory assets = new address[](1);
        uint256[] memory amounts = new uint256[](1);
        uint256[] memory modes = new uint256[](1);
        
        assets[0] = params.asset;
        amounts[0] = params.amount;
        modes[0] = params.mode; // 0 = no open debt, 1 = stable, 2 = variable
        
        // Ejecutar flash loan
        try pool.flashLoan(
            address(this),     // receiverAddress
            assets,           // assets array
            amounts,          // amounts array
            modes,            // modes array
            params.onBehalfOf, // onBehalfOf
            params.params,    // params
            REFERRAL_CODE     // referralCode
        ) {
            executedFlashLoans++;
            totalFlashLoaned[params.asset] += params.amount;
            
            emit FlashLoanExecuted(
                params.asset,
                params.amount,
                calculateFlashLoanFee(params.asset, params.amount),
                msg.sender,
                true
            );
        } catch Error(string memory reason) {
            emit FlashLoanFailed(params.asset, params.amount, reason);
            revert(reason);
        }
    }

    /**
     * @dev Calcula fee del flash loan
     */
    function calculateFlashLoanFee(
        address asset,
        uint256 amount
    ) public view override returns (uint256) {
        uint128 premiumTotal = pool.FLASHLOAN_PREMIUM_TOTAL();
        return (amount * premiumTotal) / 10000;
    }

    /**
     * @dev Verifica disponibilidad de liquidez
     */
    function isAssetSupported(address asset) external view override returns (bool) {
        // En Aave V3, verificamos si el asset tiene liquidez disponible
        try IERC20(asset).balanceOf(address(pool)) returns (uint256 balance) {
            return balance > 0;
        } catch {
            return false;
        }
    }

    /**
     * @dev Obtiene liquidez máxima disponible
     */
    function getMaxFlashLoanAmount(address asset) external view override returns (uint256) {
        return IERC20(asset).balanceOf(address(pool));
    }

    // === IFLASHLOANRECEIVER IMPLEMENTATION ===
    /**
     * @dev Callback ejecutado por Aave V3 durante flash loan
     */
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        require(msg.sender == address(pool), "Unauthorized callback");
        require(initiator == address(this), "Invalid initiator");
        require(assets.length == 1, "Multiple assets not supported");
        
        address asset = assets[0];
        uint256 amount = amounts[0];
        uint256 premium = premiums[0];
        
        // Transferir tokens al contrato de arbitraje
        IERC20(asset).safeTransfer(arbitrageContract, amount);
        
        // Llamar al callback del contrato de arbitraje
        bool success = IArbitrageCallback(arbitrageContract).executeArbitrage(
            initiator,
            asset,
            amount,
            premium,
            params
        );
        
        require(success, "Arbitrage execution failed");
        
        // Verificar que tenemos suficientes tokens para repagar
        uint256 repayAmount = amount + premium;
        uint256 balance = IERC20(asset).balanceOf(address(this));
        require(balance >= repayAmount, "Insufficient balance for repayment");
        
        // Aprobar el repago al pool
        IERC20(asset).safeApprove(address(pool), repayAmount);
        
        // Actualizar estadísticas
        totalFeesCollected[asset] += premium;
        
        return true;
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

    // === VIEW FUNCTIONS ===
    function getProviderInfo() external view returns (
        string memory name,
        address poolAddress,
        uint256 _executedFlashLoans,
        bool _paused
    ) {
        return ("Aave V3", address(pool), executedFlashLoans, paused);
    }

    function getAssetStats(address asset) external view returns (
        uint256 totalLoaned,
        uint256 totalFees,
        uint256 currentLiquidity
    ) {
        return (
            totalFlashLoaned[asset],
            totalFeesCollected[asset],
            IERC20(asset).balanceOf(address(pool))
        );
    }

    function getFlashLoanPremium() external view returns (uint128) {
        return pool.FLASHLOAN_PREMIUM_TOTAL();
    }

    // === RECEIVE FUNCTION ===
    receive() external payable {
        revert("Direct ETH transfers not allowed");
    }
}
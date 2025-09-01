// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IFlashLoanProvider.sol";

/**
 * @title AaveFlashLoanProvider
 * @notice Proveedor de flash loans compatible con Aave V3
 * @dev Ingenio Pichichi S.A. - ArbitrageX Supreme
 * @author ArbitrageX Team
 */

// Aave V3 Pool Interface (simplified)
interface IAaveV3Pool {
    function flashLoan(
        address receiverAddress,
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata modes,
        address onBehalfOf,
        bytes calldata params,
        uint16 referralCode
    ) external;

    function getReserveData(address asset) 
        external 
        view 
        returns (
            uint256 configuration,
            uint128 liquidityIndex,
            uint128 currentLiquidityRate,
            uint128 variableBorrowIndex,
            uint128 currentVariableBorrowRate,
            uint128 currentStableBorrowRate,
            uint40 lastUpdateTimestamp,
            uint16 id,
            address aTokenAddress,
            address stableDebtTokenAddress,
            address variableDebtTokenAddress,
            address interestRateStrategyAddress,
            uint128 accruedToTreasury,
            uint128 unbacked,
            uint128 isolationModeTotalDebt
        );

    function FLASHLOAN_PREMIUM_TOTAL() external view returns (uint128);
}

// Aave Flash Loan Receiver Interface
interface IAaveFlashLoanReceiver {
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external returns (bool);
}

contract AaveFlashLoanProvider is 
    IFlashLoanProvider, 
    IAaveFlashLoanReceiver,
    ReentrancyGuard, 
    Ownable 
{
    using SafeERC20 for IERC20;

    // ============ State Variables ============
    IAaveV3Pool public immutable aavePool;
    mapping(address => bool) public supportedAssets;
    address[] public assetsList;

    // Temporary storage for flash loan execution
    IFlashLoanReceiver private currentReceiver;
    bytes private currentParams;
    bool private flashLoanInProgress;

    // ============ Events ============
    event AssetSupportUpdated(address indexed asset, bool supported);
    event FlashLoanFeeUpdated(uint256 newFee);

    // ============ Constructor ============
    constructor(address _aavePool) Ownable(msg.sender) {
        require(_aavePool != address(0), "AaveFlashLoanProvider: Invalid pool");
        aavePool = IAaveV3Pool(_aavePool);
    }

    // ============ External Functions ============

    /**
     * @notice Solicitar flash loan
     */
    function flashLoan(
        address asset,
        uint256 amount,
        bytes calldata params,
        address receiver
    ) 
        external 
        override 
        nonReentrant 
    {
        require(supportedAssets[asset], "AaveFlashLoanProvider: Asset not supported");
        require(amount > 0, "AaveFlashLoanProvider: Invalid amount");
        require(receiver != address(0), "AaveFlashLoanProvider: Invalid receiver");
        require(
            getAvailableLiquidity(asset) >= amount,
            "AaveFlashLoanProvider: Insufficient liquidity"
        );

        // Store receiver and params for callback
        currentReceiver = IFlashLoanReceiver(receiver);
        currentParams = params;
        flashLoanInProgress = true;

        // Prepare Aave flash loan parameters
        address[] memory assets = new address[](1);
        uint256[] memory amounts = new uint256[](1);
        uint256[] memory modes = new uint256[](1);
        
        assets[0] = asset;
        amounts[0] = amount;
        modes[0] = 0; // No debt mode (flash loan only)

        try aavePool.flashLoan(
            address(this),
            assets,
            amounts,
            modes,
            address(this),
            abi.encode(msg.sender, receiver, params),
            0 // No referral
        ) {
            // Success handled in callback
        } catch Error(string memory reason) {
            flashLoanInProgress = false;
            revert(string(abi.encodePacked("AaveFlashLoanProvider: ", reason)));
        } catch {
            flashLoanInProgress = false;
            revert("AaveFlashLoanProvider: Flash loan failed");
        }

        // Cleanup
        flashLoanInProgress = false;
        delete currentReceiver;
        delete currentParams;
    }

    /**
     * @notice Aave callback - ejecutado cuando se recibe el flash loan
     */
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) 
        external 
        override 
        returns (bool) 
    {
        require(msg.sender == address(aavePool), "AaveFlashLoanProvider: Invalid caller");
        require(initiator == address(this), "AaveFlashLoanProvider: Invalid initiator");
        require(flashLoanInProgress, "AaveFlashLoanProvider: No active flash loan");

        // Decode parameters
        (address originalCaller, address receiver, bytes memory receiverParams) = abi.decode(
            params, 
            (address, address, bytes)
        );

        address asset = assets[0];
        uint256 amount = amounts[0];
        uint256 premium = premiums[0];

        // Transfer borrowed asset to receiver
        IERC20(asset).safeTransfer(receiver, amount);

        // Execute receiver callback
        bool success = currentReceiver.executeOperation(
            asset,
            amount,
            premium,
            originalCaller,
            receiverParams
        );

        require(success, "AaveFlashLoanProvider: Receiver execution failed");

        // Verify receiver returned the funds + premium
        uint256 amountToReturn = amount + premium;
        require(
            IERC20(asset).balanceOf(address(this)) >= amountToReturn,
            "AaveFlashLoanProvider: Insufficient repayment"
        );

        // Approve Aave pool to take back the loan + premium
        IERC20(asset).forceApprove(address(aavePool), amountToReturn);

        emit FlashLoanExecuted(
            originalCaller,
            asset,
            amount,
            premium,
            success
        );

        return true;
    }

    /**
     * @notice Obtener fee del flash loan
     */
    function getFlashLoanFee(address asset, uint256 amount) 
        external 
        view 
        override 
        returns (uint256 fee) 
    {
        require(supportedAssets[asset], "AaveFlashLoanProvider: Asset not supported");
        
        uint128 premiumRate = aavePool.FLASHLOAN_PREMIUM_TOTAL();
        fee = (amount * uint256(premiumRate)) / 10000; // Aave uses basis points
    }

    /**
     * @notice Verificar si asset está soportado
     */
    function isAssetSupported(address asset) 
        external 
        view 
        override 
        returns (bool available) 
    {
        return supportedAssets[asset];
    }

    /**
     * @notice Obtener liquidez disponible
     */
    function getAvailableLiquidity(address asset) 
        public 
        view 
        override 
        returns (uint256 liquidity) 
    {
        if (!supportedAssets[asset]) return 0;
        
        try aavePool.getReserveData(asset) returns (
            uint256,
            uint128,
            uint128,
            uint128,
            uint128,
            uint128,
            uint40,
            uint16,
            address aTokenAddress,
            address,
            address,
            address,
            uint128,
            uint128,
            uint128
        ) {
            if (aTokenAddress != address(0)) {
                liquidity = IERC20(asset).balanceOf(aTokenAddress);
            }
        } catch {
            liquidity = 0;
        }
    }

    // ============ Admin Functions ============

    /**
     * @notice Actualizar soporte de asset
     */
    function updateAssetSupport(address asset, bool supported) external onlyOwner {
        require(asset != address(0), "AaveFlashLoanProvider: Invalid asset");
        
        bool wasSupported = supportedAssets[asset];
        supportedAssets[asset] = supported;

        if (supported && !wasSupported) {
            assetsList.push(asset);
        } else if (!supported && wasSupported) {
            // Remove from list
            for (uint256 i = 0; i < assetsList.length; i++) {
                if (assetsList[i] == asset) {
                    assetsList[i] = assetsList[assetsList.length - 1];
                    assetsList.pop();
                    break;
                }
            }
        }

        emit AssetSupportUpdated(asset, supported);
    }

    /**
     * @notice Obtener lista de assets soportados
     */
    function getSupportedAssets() external view returns (address[] memory) {
        return assetsList;
    }

    /**
     * @notice Función de emergencia para retirar tokens atascados
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        require(!flashLoanInProgress, "AaveFlashLoanProvider: Flash loan in progress");
        
        if (token == address(0)) {
            payable(owner()).transfer(amount);
        } else {
            IERC20(token).safeTransfer(owner(), amount);
        }
    }

    // ============ Receive Function ============
    receive() external payable {
        // Allow contract to receive ETH
    }
}
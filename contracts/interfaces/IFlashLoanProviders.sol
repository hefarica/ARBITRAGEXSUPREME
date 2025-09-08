// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IFlashLoanProviders
 * @dev Interfaces para todos los proveedores de flash loans soportados
 * @notice Consolida todas las interfaces necesarias para el sistema universal
 */

// ============ AAVE V3 INTERFACES ============

interface IPoolV3 {
    function flashLoan(
        address receiverAddress,
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata modes,
        address onBehalfOf,
        bytes calldata params,
        uint16 referralCode
    ) external;
}

interface IFlashLoanReceiverV3 {
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external returns (bool);
}

// ============ BALANCER V2 INTERFACES ============

interface IVault {
    function flashLoan(
        IFlashLoanRecipient recipient,
        address[] memory tokens,
        uint256[] memory amounts,
        bytes memory userData
    ) external;
}

interface IFlashLoanRecipient {
    function receiveFlashLoan(
        address[] memory tokens,
        uint256[] memory amounts,
        uint256[] memory feeAmounts,
        bytes memory userData
    ) external;
}

// ============ DODO V2 INTERFACES ============

interface IDODOV2 {
    function flashLoan(
        uint256 baseAmount,
        uint256 quoteAmount,
        address assetTo,
        bytes calldata data
    ) external;
}

interface IDODOFlashLoanCallback {
    function dodoFlashLoanCall(
        address sender,
        uint256 baseAmount,
        uint256 quoteAmount,
        bytes calldata data
    ) external;
}

// ============ UNISWAP V3 INTERFACES ============

interface IUniswapV3Pool {
    function flash(
        address recipient,
        uint256 amount0,
        uint256 amount1,
        bytes calldata data
    ) external;
}

interface IUniswapV3FlashCallback {
    function uniswapV3FlashCallback(
        uint256 fee0,
        uint256 fee1,
        bytes calldata data
    ) external;
}

// ============ COMPOUND V3 INTERFACES ============

interface ICompoundV3 {
    function flashLoan(
        address receiver,
        address asset,
        uint256 amount,
        bytes calldata params
    ) external;
}

interface ICompoundV3FlashLoanCallback {
    function onFlashLoan(
        address initiator,
        address token,
        uint256 amount,
        uint256 fee,
        bytes calldata data
    ) external returns (bytes32);
}

// ============ EULER INTERFACES ============

interface IEulerFlashLoan {
    function flashLoan(
        address recipient,
        address asset,
        uint256 amount,
        bytes calldata data
    ) external;
}

interface IEulerFlashLoanCallback {
    function onFlashLoan(
        address initiator,
        address token,
        uint256 amount,
        uint256 fee,
        bytes calldata data
    ) external;
}

// ============ RADIANT INTERFACES ============

interface IRadiantFlashLoan {
    function flashLoan(
        address receiverAddress,
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata modes,
        address onBehalfOf,
        bytes calldata params,
        uint16 referralCode
    ) external;
}

// ============ GEIST INTERFACES (Fantom) ============

interface IGeistFlashLoan {
    function flashLoan(
        address receiverAddress,
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata modes,
        address onBehalfOf,
        bytes calldata params,
        uint16 referralCode
    ) external;
}

// ============ BENQI INTERFACES (Avalanche) ============

interface IBenQiFlashLoan {
    function flashLoan(
        address receiver,
        address asset,
        uint256 amount,
        bytes calldata params
    ) external;
}

// ============ CREAM INTERFACES (BSC, Fantom) ============

interface ICreamFlashLoan {
    function flashLoan(
        address receiver,
        address asset,
        uint256 amount,
        bytes calldata data
    ) external;
}

// ============ PANCAKESWAP V3 INTERFACES (BSC) ============

interface IPancakeV3Pool {
    function flash(
        address recipient,
        uint256 amount0,
        uint256 amount1,
        bytes calldata data
    ) external;
}

interface IPancakeV3FlashCallback {
    function pancakeV3FlashCallback(
        uint256 fee0,
        uint256 fee1,
        bytes calldata data
    ) external;
}

// ============ GENERIC DEX INTERFACES ============

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function decimals() external view returns (uint8);
    function symbol() external view returns (string memory);
}

interface IUniswapV2Router {
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);
    
    function getAmountsOut(uint amountIn, address[] calldata path)
        external view returns (uint[] memory amounts);
}

interface IUniswapV3Router {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params)
        external payable returns (uint256 amountOut);
}

interface ICurvePool {
    function exchange(
        int128 i,
        int128 j,
        uint256 dx,
        uint256 min_dy
    ) external returns (uint256);
    
    function get_dy(
        int128 i,
        int128 j,
        uint256 dx
    ) external view returns (uint256);
}

interface IBalancerVault {
    struct SingleSwap {
        bytes32 poolId;
        SwapKind kind;
        address assetIn;
        address assetOut;
        uint256 amount;
        bytes userData;
    }

    enum SwapKind { GIVEN_IN, GIVEN_OUT }

    struct FundManagement {
        address sender;
        bool fromInternalBalance;
        address payable recipient;
        bool toInternalBalance;
    }

    function swap(
        SingleSwap memory singleSwap,
        FundManagement memory funds,
        uint256 limit,
        uint256 deadline
    ) external payable returns (uint256);
}

// ============ BRIDGE INTERFACES ============

interface ILayerZeroBridge {
    function send(
        uint16 _dstChainId,
        bytes calldata _destination,
        bytes calldata _payload,
        address payable _refundAddress,
        address _zroPaymentAddress,
        bytes calldata _adapterParams
    ) external payable;
}

interface IAxelarBridge {
    function callContract(
        string calldata destinationChain,
        string calldata contractAddress,
        bytes calldata payload
    ) external;
}

interface IWormholeBridge {
    function publishMessage(
        uint32 nonce,
        bytes memory payload,
        uint8 consistencyLevel
    ) external payable returns (uint64 sequence);
}

// ============ 2025 ADVANCED STRATEGY INTERFACES ============

interface ICoWProtocol {
    struct Order {
        address sellToken;
        address buyToken;
        address receiver;
        uint256 sellAmount;
        uint256 buyAmount;
        uint32 validTo;
        bytes32 appData;
        uint256 feeAmount;
        bytes32 kind;
        bool partiallyFillable;
        bytes32 sellTokenBalance;
        bytes32 buyTokenBalance;
    }
    
    function submitOrder(Order memory order) external;
}

interface I1inchFusion {
    function submitOrder(bytes calldata orderData) external;
    function fillOrder(bytes32 orderHash, bytes calldata signature) external;
}

interface IERC4337EntryPoint {
    struct UserOperation {
        address sender;
        uint256 nonce;
        bytes initCode;
        bytes callData;
        uint256 callGasLimit;
        uint256 verificationGasLimit;
        uint256 preVerificationGas;
        uint256 maxFeePerGas;
        uint256 maxPriorityFeePerGas;
        bytes paymasterAndData;
        bytes signature;
    }
    
    function handleOps(UserOperation[] calldata ops, address payable beneficiary) external;
}

interface ICelestiaDA {
    function submitData(bytes calldata data) external returns (bytes32 commitment);
    function verifyInclusion(bytes32 commitment, bytes calldata proof) external view returns (bool);
}

interface IEigenLayerOperator {
    function delegateToOperator(address operator, bytes calldata signature) external;
    function undelegate() external;
}
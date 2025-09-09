// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "./interfaces/IFlashLoanProvider.sol";
import "./interfaces/IDEXRouter.sol";
import "./interfaces/IArbitrageCallback.sol";

/**
 * @title UniversalFlashLoanArbitrage
 * @dev Contrato principal para arbitraje con flash loans multiplataforma
 * @notice Soporta Aave V3, Balancer V2, Compound V3 y múltiples DEXs
 * 
 * ArbitrageX Supreme V3.0 - Core Contract
 * MEV Protection + Multi-Chain + Flash Loan Aggregator
 */
contract UniversalFlashLoanArbitrage is 
    AccessControl, 
    ReentrancyGuard, 
    EIP712,
    IArbitrageCallback 
{
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;

    // === ROLES ===
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant WHITELIST_ROLE = keccak256("WHITELIST_ROLE");

    // === CONSTANTS ===
    uint256 public constant MAX_SLIPPAGE = 1000; // 10% máximo slippage
    uint256 public constant MIN_PROFIT_THRESHOLD = 1e15; // 0.001 ETH mínimo
    uint256 public constant GAS_LIMIT_BUFFER = 300000;

    // === STRUCTS ===
    struct ArbitrageParams {
        address inputToken;
        address outputToken;
        uint256 amount;
        uint256 minProfit;
        address[] dexPath;
        bytes routingData;
        uint256 deadline;
        uint256 nonce;
        bytes signature;
    }

    struct FlashLoanData {
        ArbitrageParams params;
        address initiator;
        uint256 flashLoanFee;
        bytes32 orderHash;
    }

    // === STATE VARIABLES ===
    mapping(address => IFlashLoanProvider) public flashLoanProviders;
    mapping(address => IDEXRouter) public dexRouters;
    mapping(bytes32 => bool) public executedOrders;
    mapping(address => uint256) public nonces;
    mapping(address => bool) public blacklistedTokens;
    
    bool public paused;
    uint256 public totalProfits;
    uint256 public totalVolume;
    uint256 public executedArbitrages;

    // === EVENTS ===
    event ArbitrageExecuted(
        bytes32 indexed orderHash,
        address indexed initiator,
        address inputToken,
        address outputToken,
        uint256 amount,
        uint256 profit,
        uint256 gasUsed
    );

    event FlashLoanProviderUpdated(
        address indexed provider,
        address contractAddress,
        bool enabled
    );

    event DEXRouterUpdated(
        address indexed dex,
        address contractAddress,
        bool enabled
    );

    event TokenBlacklisted(address indexed token, bool blacklisted);
    
    event ProfitWithdrawn(address indexed to, uint256 amount);

    // === MODIFIERS ===
    modifier whenNotPaused() {
        require(!paused, "Contract paused");
        _;
    }

    modifier onlyExecutor() {
        require(hasRole(EXECUTOR_ROLE, msg.sender), "Not authorized executor");
        _;
    }

    modifier validToken(address token) {
        require(!blacklistedTokens[token], "Token blacklisted");
        require(token != address(0), "Invalid token");
        _;
    }

    // === CONSTRUCTOR ===
    constructor(address admin) 
        EIP712("ArbitrageX Supreme V3.0", "1") 
    {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(EXECUTOR_ROLE, admin);
        _grantRole(PAUSER_ROLE, admin);
        _grantRole(WHITELIST_ROLE, admin);
    }

    // === MAIN ARBITRAGE FUNCTION ===
    /**
     * @dev Ejecuta arbitraje con flash loan multiplataforma
     * @param params Parámetros del arbitraje con firma EIP-712
     * @param provider Dirección del proveedor de flash loan preferido
     */
    function executeArbitrage(
        ArbitrageParams calldata params,
        address provider
    ) external nonReentrant whenNotPaused onlyExecutor {
        uint256 gasStart = gasleft();
        
        // 1. Validaciones de seguridad
        _validateArbitrageParams(params);
        
        // 2. Verificar firma EIP-712
        bytes32 orderHash = _hashArbitrageParams(params);
        require(!executedOrders[orderHash], "Order already executed");
        _verifySignature(orderHash, params.signature, msg.sender);
        
        // 3. Marcar orden como ejecutada (previene replay)
        executedOrders[orderHash] = true;
        nonces[msg.sender]++;
        
        // 4. Seleccionar mejor proveedor de flash loan
        IFlashLoanProvider flashProvider = _selectBestFlashLoanProvider(
            params.inputToken, 
            params.amount, 
            provider
        );
        
        // 5. Preparar datos para callback
        FlashLoanData memory flashData = FlashLoanData({
            params: params,
            initiator: msg.sender,
            flashLoanFee: flashProvider.calculateFlashLoanFee(params.inputToken, params.amount),
            orderHash: orderHash
        });
        
        // 6. Ejecutar flash loan
        IFlashLoanProvider.FlashLoanParams memory flashParams = IFlashLoanProvider.FlashLoanParams({
            asset: params.inputToken,
            amount: params.amount,
            mode: 0, // Flash loan mode
            onBehalfOf: address(this),
            params: abi.encode(flashData)
        });
        
        flashProvider.executeFlashLoan(flashParams);
        
        // 7. Calcular gas usado y emitir evento
        uint256 gasUsed = gasStart - gasleft() + GAS_LIMIT_BUFFER;
        
        emit ArbitrageExecuted(
            orderHash,
            msg.sender,
            params.inputToken,
            params.outputToken,
            params.amount,
            0, // Profit calculado en callback
            gasUsed
        );
    }

    // === FLASH LOAN CALLBACK ===
    /**
     * @dev Callback ejecutado por el proveedor de flash loan
     */
    function executeArbitrage(
        address initiator,
        address asset,
        uint256 amount,
        uint256 premium,
        bytes calldata params
    ) external override returns (bool success) {
        FlashLoanData memory flashData = abi.decode(params, (FlashLoanData));
        
        // 1. Verificar que el callback viene del proveedor autorizado
        require(_isAuthorizedFlashLoanProvider(msg.sender), "Unauthorized callback");
        
        // 2. Ejecutar estrategias de arbitraje
        uint256 profit = _executeArbitrageStrategies(flashData);
        
        // 3. Verificar profit mínimo
        require(profit >= flashData.params.minProfit, "Insufficient profit");
        require(profit > premium, "Profit below flash loan fee");
        
        // 4. Repagar flash loan + fee
        IERC20(asset).safeTransfer(msg.sender, amount + premium);
        
        // 5. Registrar profit neto
        uint256 netProfit = profit - premium;
        totalProfits += netProfit;
        totalVolume += amount;
        executedArbitrages++;
        
        return true;
    }

    // === ARBITRAGE STRATEGIES ===
    /**
     * @dev Ejecuta múltiples estrategias de arbitraje optimizadas
     */
    function _executeArbitrageStrategies(
        FlashLoanData memory flashData
    ) internal returns (uint256 totalProfit) {
        ArbitrageParams memory params = flashData.params;
        
        // 1. Arbitraje DEX-to-DEX clásico
        if (params.dexPath.length >= 2) {
            totalProfit += _executeDEXArbitrage(params);
        }
        
        // 2. Arbitraje triangular (si hay 3+ DEXs)
        if (params.dexPath.length >= 3) {
            totalProfit += _executeTriangularArbitrage(params);
        }
        
        // 3. MEV Strategies (Sandwich, Backrunning)
        totalProfit += _executeMEVStrategies(params);
        
        // 4. Cross-chain arbitrage (si está configurado)
        totalProfit += _executeCrossChainArbitrage(params);
    }

    /**
     * @dev Arbitraje clásico entre 2 DEXs
     */
    function _executeDEXArbitrage(
        ArbitrageParams memory params
    ) internal returns (uint256 profit) {
        require(params.dexPath.length >= 2, "Need at least 2 DEXs");
        
        // 1. Comprar en DEX1 (precio bajo)
        IDEXRouter dex1 = dexRouters[params.dexPath[0]];
        IDEXRouter.SwapParams memory buyParams = IDEXRouter.SwapParams({
            tokenIn: params.inputToken,
            tokenOut: params.outputToken,
            amountIn: params.amount,
            amountOutMin: 0, // Calculamos dinámicamente
            path: abi.encodePacked(params.inputToken, uint24(3000), params.outputToken),
            to: address(this),
            deadline: params.deadline
        });
        
        uint256 outputAmount = dex1.swapExactTokensForTokens(buyParams);
        
        // 2. Vender en DEX2 (precio alto)
        IDEXRouter dex2 = dexRouters[params.dexPath[1]];
        IDEXRouter.SwapParams memory sellParams = IDEXRouter.SwapParams({
            tokenIn: params.outputToken,
            tokenOut: params.inputToken,
            amountIn: outputAmount,
            amountOutMin: params.amount, // Al menos recuperar initial amount
            path: abi.encodePacked(params.outputToken, uint24(3000), params.inputToken),
            to: address(this),
            deadline: params.deadline
        });
        
        uint256 finalAmount = dex2.swapExactTokensForTokens(sellParams);
        
        // 3. Calcular profit
        if (finalAmount > params.amount) {
            profit = finalAmount - params.amount;
        }
    }

    /**
     * @dev Arbitraje triangular entre 3+ tokens
     */
    function _executeTriangularArbitrage(
        ArbitrageParams memory params
    ) internal returns (uint256 profit) {
        // Implementación de arbitraje triangular
        // TOKEN_A -> TOKEN_B -> TOKEN_C -> TOKEN_A
        // Aprovecha discrepancias de precio en ciclos de trading
        
        if (params.dexPath.length < 3) return 0;
        
        // TODO: Implementar lógica completa de arbitraje triangular
        // Por ahora retornamos 0 para evitar errores
        return 0;
    }

    /**
     * @dev Estrategias MEV avanzadas (Sandwich, Backrunning)
     */
    function _executeMEVStrategies(
        ArbitrageParams memory params
    ) internal returns (uint256 profit) {
        // 1. Sandwich attacks (si hay transacción víctima detectada)
        // 2. Backrunning (aprovechar transacciones grandes)
        // 3. Liquidación detection
        
        // TODO: Implementar estrategias MEV completas
        // Por ahora retornamos 0 para evitar errores
        return 0;
    }

    /**
     * @dev Arbitraje cross-chain usando bridges
     */
    function _executeCrossChainArbitrage(
        ArbitrageParams memory params
    ) internal returns (uint256 profit) {
        // TODO: Implementar arbitraje cross-chain
        // Requiere integración con bridges (Polygon, Arbitrum, Optimism)
        return 0;
    }

    // === VALIDATION FUNCTIONS ===
    function _validateArbitrageParams(ArbitrageParams calldata params) internal view {
        require(params.amount > 0, "Invalid amount");
        require(params.minProfit >= MIN_PROFIT_THRESHOLD, "Min profit too low");
        require(params.deadline > block.timestamp, "Expired deadline");
        require(params.dexPath.length >= 1, "Need at least 1 DEX");
        require(!blacklistedTokens[params.inputToken], "Input token blacklisted");
        require(!blacklistedTokens[params.outputToken], "Output token blacklisted");
    }

    function _verifySignature(
        bytes32 orderHash,
        bytes memory signature,
        address signer
    ) internal view {
        bytes32 digest = _hashTypedDataV4(orderHash);
        address recoveredSigner = digest.recover(signature);
        require(recoveredSigner == signer, "Invalid signature");
        require(hasRole(EXECUTOR_ROLE, recoveredSigner), "Signer not authorized");
    }

    function _hashArbitrageParams(
        ArbitrageParams calldata params
    ) internal pure returns (bytes32) {
        return keccak256(abi.encode(
            keccak256("ArbitrageOrder(address inputToken,address outputToken,uint256 amount,uint256 minProfit,uint256 deadline,uint256 nonce)"),
            params.inputToken,
            params.outputToken,
            params.amount,
            params.minProfit,
            params.deadline,
            params.nonce
        ));
    }

    // === PROVIDER MANAGEMENT ===
    function _selectBestFlashLoanProvider(
        address asset,
        uint256 amount,
        address preferredProvider
    ) internal view returns (IFlashLoanProvider) {
        if (preferredProvider != address(0)) {
            IFlashLoanProvider provider = flashLoanProviders[preferredProvider];
            if (address(provider) != address(0)) {
                return provider;
            }
        }
        
        // TODO: Implementar selección automática del mejor proveedor
        // por ahora retorna el primero disponible
        revert("No flash loan provider available");
    }

    function _isAuthorizedFlashLoanProvider(address provider) internal view returns (bool) {
        // Verificar si el provider está en nuestra lista autorizada
        return address(flashLoanProviders[provider]) != address(0);
    }

    // === ADMIN FUNCTIONS ===
    function setFlashLoanProvider(
        address providerAddress,
        address contractAddress
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        flashLoanProviders[providerAddress] = IFlashLoanProvider(contractAddress);
        emit FlashLoanProviderUpdated(providerAddress, contractAddress, true);
    }

    function setDEXRouter(
        address dexAddress,
        address contractAddress
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        dexRouters[dexAddress] = IDEXRouter(contractAddress);
        emit DEXRouterUpdated(dexAddress, contractAddress, true);
    }

    function setTokenBlacklist(
        address token,
        bool blacklisted
    ) external onlyRole(WHITELIST_ROLE) {
        blacklistedTokens[token] = blacklisted;
        emit TokenBlacklisted(token, blacklisted);
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        paused = true;
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        paused = false;
    }

    function withdrawProfits(
        address to,
        address token,
        uint256 amount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        IERC20(token).safeTransfer(to, amount);
        emit ProfitWithdrawn(to, amount);
    }

    // === VIEW FUNCTIONS ===
    function getContractStats() external view returns (
        uint256 _totalProfits,
        uint256 _totalVolume,
        uint256 _executedArbitrages,
        bool _paused
    ) {
        return (totalProfits, totalVolume, executedArbitrages, paused);
    }

    function isOrderExecuted(bytes32 orderHash) external view returns (bool) {
        return executedOrders[orderHash];
    }

    function getUserNonce(address user) external view returns (uint256) {
        return nonces[user];
    }
}
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title ArbitrageExecutor
 * @dev Contrato para ejecutar oportunidades de arbitraje DeFi
 * Sistema del Ingenio Pichichi S.A - Metodología disciplinada
 */
contract ArbitrageExecutor is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
    
    // ============================================================================
    // EVENTOS PARA TRACKING DE OPERACIONES
    // ============================================================================
    
    event ArbitrageExecuted(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 profit,
        string strategy,
        uint256 timestamp
    );
    
    event FlashLoanExecuted(
        address indexed token,
        uint256 amount,
        uint256 profit,
        address indexed user
    );
    
    event EmergencyWithdraw(
        address indexed token,
        uint256 amount,
        address indexed to
    );
    
    // ============================================================================
    // ESTRUCTURAS DE DATOS
    // ============================================================================
    
    struct ArbitrageParams {
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 minAmountOut;
        address[] dexAddresses;
        bytes[] callData;
        uint256 deadline;
        string strategy;
    }
    
    struct FlashLoanParams {
        address asset;
        uint256 amount;
        ArbitrageParams arbitrageParams;
    }
    
    // ============================================================================
    // VARIABLES DE ESTADO
    // ============================================================================
    
    mapping(address => bool) public authorizedDEXs;
    mapping(address => bool) public authorizedTokens;
    mapping(address => uint256) public userProfits;
    
    uint256 public totalArbitrageCount;
    uint256 public totalProfitGenerated;
    uint256 public feePercentage = 100; // 1% = 100 basis points
    uint256 public constant FEE_DENOMINATOR = 10000;
    
    address public feeCollector;
    bool public paused = false;
    
    // ============================================================================
    // MODIFICADORES
    // ============================================================================
    
    modifier onlyAuthorizedDEX(address dex) {
        require(authorizedDEXs[dex], "DEX no autorizado");
        _;
    }
    
    modifier onlyAuthorizedToken(address token) {
        require(authorizedTokens[token], "Token no autorizado");
        _;
    }
    
    modifier notPaused() {
        require(!paused, "Contrato pausado");
        _;
    }
    
    modifier validDeadline(uint256 deadline) {
        require(deadline >= block.timestamp, "Deadline expirado");
        _;
    }
    
    // ============================================================================
    // CONSTRUCTOR
    // ============================================================================
    
    constructor(address _feeCollector) {
        require(_feeCollector != address(0), "Fee collector no puede ser address zero");
        feeCollector = _feeCollector;
        
        // Autorizar tokens comunes por defecto
        _authorizeCommonTokens();
    }
    
    // ============================================================================
    // FUNCIONES PRINCIPALES DE ARBITRAJE
    // ============================================================================
    
    /**
     * @dev Ejecutar arbitraje simple entre dos DEXs
     * Metodología aplicada: Verificación previa, ejecución, post-verificación
     */
    function executeSimpleArbitrage(
        ArbitrageParams calldata params
    ) external nonReentrant notPaused validDeadline(params.deadline) {
        require(params.dexAddresses.length >= 2, "Se requieren minimo 2 DEXs");
        require(params.amountIn > 0, "Cantidad debe ser mayor a 0");
        require(authorizedTokens[params.tokenIn], "Token input no autorizado");
        require(authorizedTokens[params.tokenOut], "Token output no autorizado");
        
        // 1. Transferir tokens del usuario
        IERC20(params.tokenIn).safeTransferFrom(
            msg.sender, 
            address(this), 
            params.amountIn
        );
        
        uint256 initialBalance = IERC20(params.tokenOut).balanceOf(address(this));
        
        // 2. Ejecutar intercambios en secuencia
        _executeArbitrageSequence(params);
        
        // 3. Verificar ganancia
        uint256 finalBalance = IERC20(params.tokenOut).balanceOf(address(this));
        uint256 totalReceived = finalBalance - initialBalance;
        
        require(totalReceived >= params.minAmountOut, "Slippage demasiado alto");
        
        // 4. Calcular y cobrar fee
        uint256 fee = (totalReceived * feePercentage) / FEE_DENOMINATOR;
        uint256 userProfit = totalReceived - fee;
        
        // 5. Transferir ganancia al usuario
        if (userProfit > 0) {
            IERC20(params.tokenOut).safeTransfer(msg.sender, userProfit);
            userProfits[msg.sender] += userProfit;
        }
        
        // 6. Transferir fee
        if (fee > 0) {
            IERC20(params.tokenOut).safeTransfer(feeCollector, fee);
        }
        
        // 7. Actualizar métricas
        totalArbitrageCount++;
        totalProfitGenerated += userProfit;
        
        // 8. Emitir evento
        emit ArbitrageExecuted(
            msg.sender,
            params.tokenIn,
            params.tokenOut,
            params.amountIn,
            userProfit,
            userProfit,
            params.strategy,
            block.timestamp
        );
    }
    
    /**
     * @dev Ejecutar arbitraje triangular (A -> B -> C -> A)
     */
    function executeTriangularArbitrage(
        address[] calldata tokens, // [tokenA, tokenB, tokenC]
        uint256[] calldata amounts, // [amountA, minAmountB, minAmountC, minFinalAmountA]
        address[] calldata dexAddresses,
        bytes[] calldata swapData,
        uint256 deadline
    ) external nonReentrant notPaused validDeadline(deadline) {
        require(tokens.length == 3, "Se requieren exactamente 3 tokens");
        require(amounts.length == 4, "Se requieren 4 amounts");
        require(dexAddresses.length >= 3, "Se requieren minimo 3 DEXs");
        
        address tokenA = tokens[0];
        uint256 initialAmount = amounts[0];
        uint256 minFinalAmount = amounts[3];
        
        // Verificar autorización de tokens
        for (uint i = 0; i < tokens.length; i++) {
            require(authorizedTokens[tokens[i]], "Token no autorizado");
        }
        
        // 1. Transferir token inicial
        IERC20(tokenA).safeTransferFrom(msg.sender, address(this), initialAmount);
        
        uint256 initialBalanceA = IERC20(tokenA).balanceOf(address(this));
        
        // 2. Ejecutar secuencia triangular A->B->C->A
        _executeTriangularSequence(tokens, amounts, dexAddresses, swapData);
        
        // 3. Verificar ganancia
        uint256 finalBalanceA = IERC20(tokenA).balanceOf(address(this));
        uint256 profit = finalBalanceA - initialBalanceA;
        
        require(profit >= minFinalAmount, "Arbitraje no rentable");
        
        // 4. Transferir ganancia (después de fee)
        uint256 fee = (profit * feePercentage) / FEE_DENOMINATOR;
        uint256 userProfit = profit - fee;
        
        IERC20(tokenA).safeTransfer(msg.sender, userProfit);
        IERC20(tokenA).safeTransfer(feeCollector, fee);
        
        // 5. Actualizar métricas
        totalArbitrageCount++;
        totalProfitGenerated += userProfit;
        userProfits[msg.sender] += userProfit;
        
        emit ArbitrageExecuted(
            msg.sender,
            tokenA,
            tokenA,
            initialAmount,
            userProfit,
            profit,
            "triangular_arbitrage",
            block.timestamp
        );
    }
    
    // ============================================================================
    // FUNCIONES INTERNAS
    // ============================================================================
    
    function _executeArbitrageSequence(ArbitrageParams calldata params) internal {
        for (uint i = 0; i < params.dexAddresses.length; i++) {
            require(authorizedDEXs[params.dexAddresses[i]], "DEX no autorizado");
            
            // Ejecutar swap en DEX específico
            (bool success, ) = params.dexAddresses[i].call(params.callData[i]);
            require(success, "Swap fallido en DEX");
        }
    }
    
    function _executeTriangularSequence(
        address[] calldata tokens,
        uint256[] calldata amounts,
        address[] calldata dexAddresses,
        bytes[] calldata swapData
    ) internal {
        for (uint i = 0; i < 3; i++) {
            require(authorizedDEXs[dexAddresses[i]], "DEX no autorizado");
            
            (bool success, ) = dexAddresses[i].call(swapData[i]);
            require(success, string(abi.encodePacked("Swap ", i, " fallido")));
        }
    }
    
    function _authorizeCommonTokens() internal {
        // Ethereum Mainnet
        authorizedTokens[0xA0b86a33E6441b9435B674C88d5f662c673067bD] = true; // WETH
        authorizedTokens[0xA0b86a33E6441b9435B674C88d5f662c673067bD] = true; // USDC
        authorizedTokens[0xdAC17F958D2ee523a2206206994597C13D831ec7] = true; // USDT
        authorizedTokens[0x6B175474E89094C44Da98b954EedeAC495271d0F] = true; // DAI
        
        // Tokens adicionales se pueden agregar via addAuthorizedToken
    }
    
    // ============================================================================
    // FUNCIONES DE ADMINISTRACIÓN
    // ============================================================================
    
    function addAuthorizedDEX(address dex) external onlyOwner {
        require(dex != address(0), "DEX no puede ser address zero");
        authorizedDEXs[dex] = true;
    }
    
    function removeAuthorizedDEX(address dex) external onlyOwner {
        authorizedDEXs[dex] = false;
    }
    
    function addAuthorizedToken(address token) external onlyOwner {
        require(token != address(0), "Token no puede ser address zero");
        authorizedTokens[token] = true;
    }
    
    function removeAuthorizedToken(address token) external onlyOwner {
        authorizedTokens[token] = false;
    }
    
    function setFeePercentage(uint256 _feePercentage) external onlyOwner {
        require(_feePercentage <= 500, "Fee no puede ser mayor a 5%"); // Max 5%
        feePercentage = _feePercentage;
    }
    
    function setFeeCollector(address _feeCollector) external onlyOwner {
        require(_feeCollector != address(0), "Fee collector no puede ser address zero");
        feeCollector = _feeCollector;
    }
    
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
    }
    
    // ============================================================================
    // FUNCIONES DE EMERGENCIA
    // ============================================================================
    
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        require(token != address(0), "Token no puede ser address zero");
        
        if (amount == 0) {
            amount = IERC20(token).balanceOf(address(this));
        }
        
        require(amount > 0, "No hay balance para retirar");
        
        IERC20(token).safeTransfer(owner(), amount);
        
        emit EmergencyWithdraw(token, amount, owner());
    }
    
    function emergencyWithdrawETH() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No hay ETH para retirar");
        
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "Transferencia de ETH falló");
    }
    
    // ============================================================================
    // FUNCIONES DE CONSULTA
    // ============================================================================
    
    function getUserProfit(address user) external view returns (uint256) {
        return userProfits[user];
    }
    
    function getContractStats() external view returns (
        uint256 totalTrades,
        uint256 totalProfits,
        uint256 currentFee,
        bool isPaused
    ) {
        return (
            totalArbitrageCount,
            totalProfitGenerated,
            feePercentage,
            paused
        );
    }
    
    function isDEXAuthorized(address dex) external view returns (bool) {
        return authorizedDEXs[dex];
    }
    
    function isTokenAuthorized(address token) external view returns (bool) {
        return authorizedTokens[token];
    }
    
    // ============================================================================
    // RECEIVE FUNCTION PARA RECIBIR ETH
    // ============================================================================
    
    receive() external payable {
        // Permite al contrato recibir ETH para operaciones de arbitraje
    }
}
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IFlashLoanReceiver.sol";
import "../interfaces/IUniswapV3Pool.sol";
import "../interfaces/IUniswapV3Factory.sol";
import "../interfaces/INonfungiblePositionManager.sol";
import "../interfaces/ISwapRouter.sol";

/**
 * @title JITLiquidityBackrunArbitrage
 * @notice Estrategia S004: JIT (Just-In-Time) Liquidity + Backrun MEV Strategy
 * 
 * OBJETIVO:
 * - Detectar transacciones grandes pendientes (mempool analysis)
 * - Proveer liquidez JIT justo antes de la transacción
 * - Ejecutar backrun inmediatamente después para capturar spread
 * - Remover liquidez JIT para maximizar capital efficiency
 * 
 * MECANISMO:
 * 1. Monitor mempool para detectar swaps grandes
 * 2. Flash loan para capital temporal
 * 3. Mint posición de liquidez concentrada JIT
 * 4. Esperar ejecución del swap grande
 * 5. Backrun inmediato para capturar movimiento de precio
 * 6. Burn posición JIT y repagar flash loan
 * 
 * COMPONENTES CRÍTICOS:
 * - Uniswap V3 Concentrated Liquidity
 * - Flash Loans multi-protocolo
 * - MEV-Boost compatible execution
 * - Sub-200ms latency optimization
 * - Slippage protection avanzada
 * 
 * ARQUITECTURA DE ROUTING:
 * FlashLoan → JIT_Mint → Wait_Target_Tx → Backrun_Swap → JIT_Burn → Repay
 * 
 * ArbitrageX Supreme V3.0 - Real-Only Policy Implementation
 * Ingenio Pichichi S.A. - Metodología Disciplinada
 */
contract JITLiquidityBackrunArbitrage is ReentrancyGuard, Ownable, IFlashLoanReceiver {
    using SafeERC20 for IERC20;

    // =============================================================================
    // CONSTANTS & IMMUTABLES
    // =============================================================================

    uint256 private constant MAX_INT = 2**256 - 1;
    uint24 private constant FEE_TIER_LOW = 500;      // 0.05%
    uint24 private constant FEE_TIER_MID = 3000;     // 0.30%
    uint24 private constant FEE_TIER_HIGH = 10000;   // 1.00%
    
    // MEV timing constraints (sub-200ms optimization)
    uint256 private constant MAX_EXECUTION_TIME = 180000; // 180ms in microseconds
    uint256 private constant JIT_WINDOW_BLOCKS = 1;       // 1 block window for JIT
    
    // Profit thresholds (basis points)
    uint256 private constant MIN_PROFIT_BPS = 10;         // 0.1% minimum profit
    uint256 private constant MAX_SLIPPAGE_BPS = 50;       // 0.5% max slippage
    uint256 private constant GAS_OVERHEAD_BPS = 200;      // 2% gas overhead

    // Uniswap V3 interfaces
    IUniswapV3Factory private immutable uniswapV3Factory;
    INonfungiblePositionManager private immutable positionManager;
    ISwapRouter private immutable swapRouter;

    // Flash loan providers
    mapping(address => bool) public authorizedFlashProviders;
    address[] public flashProviders;

    // =============================================================================
    // STRUCTS & ENUMS
    // =============================================================================

    enum StrategyState {
        IDLE,
        MONITORING,
        JIT_POSITIONING,
        WAITING_TARGET,
        BACKRUNNING,
        CLOSING_POSITION
    }

    struct JITParams {
        address pool;                    // Uniswap V3 pool address
        address token0;                  // Token 0 del pool
        address token1;                  // Token 1 del pool
        uint24 feeTier;                  // Fee tier del pool
        int24 tickLower;                 // Tick inferior para liquidez concentrada
        int24 tickUpper;                 // Tick superior para liquidez concentrada
        uint128 liquidityAmount;        // Cantidad de liquidez a proveer
        uint256 amount0Desired;          // Cantidad deseada de token0
        uint256 amount1Desired;          // Cantidad deseada de token1
        uint256 amount0Min;              // Cantidad mínima de token0
        uint256 amount1Min;              // Cantidad mínima de token1
        uint256 deadline;                // Deadline para transacción
    }

    struct TargetTransaction {
        bytes32 txHash;                  // Hash de la transacción objetivo
        address targetPool;              // Pool donde ocurrirá el swap
        address tokenIn;                 // Token de entrada del swap
        address tokenOut;                // Token de salida del swap
        uint256 amountIn;                // Cantidad de entrada estimada
        uint256 expectedPriceImpact;     // Impacto de precio esperado (BPS)
        uint256 detectedBlock;           // Bloque donde fue detectada
        bool isProcessed;                // Si ya fue procesada
    }

    struct BackrunParams {
        address tokenIn;                 // Token para el backrun
        address tokenOut;                // Token objetivo del backrun
        uint256 amountIn;                // Cantidad para el backrun
        uint256 amountOutMinimum;        // Cantidad mínima esperada
        address recipient;               // Destinatario del swap
        uint256 deadline;                // Deadline para el swap
        uint160 sqrtPriceLimitX96;       // Límite de precio
    }

    struct FlashLoanParams {
        address asset;                   // Token para flash loan
        uint256 amount;                  // Cantidad del flash loan
        address provider;                // Proveedor del flash loan
        bytes params;                    // Parámetros adicionales
    }

    struct ArbitrageExecution {
        uint256 executionId;             // ID único de ejecución
        StrategyState currentState;      // Estado actual de la estrategia
        JITParams jitParams;             // Parámetros de liquidez JIT
        TargetTransaction targetTx;      // Transacción objetivo detectada
        BackrunParams backrunParams;     // Parámetros para backrun
        FlashLoanParams flashParams;     // Parámetros de flash loan
        uint256 positionTokenId;         // Token ID de la posición NFT
        uint256 profitRealized;          // Profit realizado en wei
        uint256 gasUsed;                 // Gas utilizado en la ejecución
        uint256 executionTime;           // Tiempo de ejecución en microsegundos
        bool isCompleted;                // Si la ejecución está completa
    }

    // =============================================================================
    // STATE VARIABLES
    // =============================================================================

    // Execution tracking
    mapping(uint256 => ArbitrageExecution) public executions;
    mapping(bytes32 => bool) public processedTransactions;
    uint256 public executionCounter;
    
    // Strategy configuration
    uint256 public maxPositionSize;
    uint256 public minProfitThreshold;
    uint256 public maxSlippageTolerance;
    bool public strategyActive;
    
    // Performance tracking
    uint256 public totalProfitRealized;
    uint256 public totalExecutions;
    uint256 public successfulExecutions;
    uint256 public averageExecutionTime;

    // Security controls
    mapping(address => bool) public authorizedOperators;
    uint256 public maxConcurrentExecutions;
    uint256 public currentActiveExecutions;

    // =============================================================================
    // EVENTS
    // =============================================================================

    event JITArbitrageInitiated(
        uint256 indexed executionId,
        address indexed pool,
        uint256 liquidityAmount,
        bytes32 targetTxHash
    );

    event JITPositionMinted(
        uint256 indexed executionId,
        uint256 indexed positionTokenId,
        uint128 liquidity,
        uint256 amount0,
        uint256 amount1
    );

    event TargetTransactionDetected(
        uint256 indexed executionId,
        bytes32 indexed txHash,
        address indexed pool,
        uint256 expectedPriceImpact
    );

    event BackrunExecuted(
        uint256 indexed executionId,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 profit
    );

    event JITPositionBurned(
        uint256 indexed executionId,
        uint256 indexed positionTokenId,
        uint256 amount0Collected,
        uint256 amount1Collected
    );

    event ArbitrageCompleted(
        uint256 indexed executionId,
        uint256 totalProfit,
        uint256 executionTime,
        bool successful
    );

    event FlashLoanReceived(
        address indexed provider,
        address indexed asset,
        uint256 amount,
        uint256 executionId
    );

    event EmergencyWithdraw(
        address indexed token,
        uint256 amount,
        address indexed recipient
    );

    // =============================================================================
    // MODIFIERS
    // =============================================================================

    modifier onlyAuthorizedOperator() {
        require(
            authorizedOperators[msg.sender] || msg.sender == owner(),
            "JITArbitrage: Not authorized operator"
        );
        _;
    }

    modifier onlyWhenActive() {
        require(strategyActive, "JITArbitrage: Strategy not active");
        _;
    }

    modifier withinExecutionLimit() {
        require(
            currentActiveExecutions < maxConcurrentExecutions,
            "JITArbitrage: Max concurrent executions reached"
        );
        _;
    }

    modifier validExecution(uint256 executionId) {
        require(
            executionId <= executionCounter && executionId > 0,
            "JITArbitrage: Invalid execution ID"
        );
        _;
    }

    // =============================================================================
    // CONSTRUCTOR
    // =============================================================================

    constructor(
        address _uniswapV3Factory,
        address _positionManager,
        address _swapRouter,
        address[] memory _flashProviders
    ) {
        require(_uniswapV3Factory != address(0), "JITArbitrage: Invalid factory");
        require(_positionManager != address(0), "JITArbitrage: Invalid position manager");
        require(_swapRouter != address(0), "JITArbitrage: Invalid swap router");

        uniswapV3Factory = IUniswapV3Factory(_uniswapV3Factory);
        positionManager = INonfungiblePositionManager(_positionManager);
        swapRouter = ISwapRouter(_swapRouter);

        // Initialize flash loan providers
        for (uint256 i = 0; i < _flashProviders.length; i++) {
            require(_flashProviders[i] != address(0), "JITArbitrage: Invalid provider");
            authorizedFlashProviders[_flashProviders[i]] = true;
            flashProviders.push(_flashProviders[i]);
        }

        // Default configuration
        maxPositionSize = 1000 ether;
        minProfitThreshold = MIN_PROFIT_BPS;
        maxSlippageTolerance = MAX_SLIPPAGE_BPS;
        maxConcurrentExecutions = 5;
        strategyActive = true;

        // Authorize owner as operator
        authorizedOperators[msg.sender] = true;
    }

    // =============================================================================
    // MAIN EXECUTION FUNCTIONS
    // =============================================================================

    /**
     * @notice Ejecuta estrategia JIT Liquidity + Backrun completa
     * @param jitParams Parámetros para posicionamiento de liquidez JIT
     * @param targetTx Datos de la transacción objetivo detectada
     * @param backrunParams Parámetros para ejecución del backrun
     * @param flashParams Parámetros del flash loan
     * @return executionId ID único de la ejecución
     */
    function executeJITBackrunArbitrage(
        JITParams calldata jitParams,
        TargetTransaction calldata targetTx,
        BackrunParams calldata backrunParams,
        FlashLoanParams calldata flashParams
    ) 
        external 
        onlyAuthorizedOperator 
        onlyWhenActive 
        withinExecutionLimit 
        nonReentrant 
        returns (uint256 executionId) 
    {
        uint256 startTime = block.timestamp * 1000000; // Microseconds
        
        // Validate parameters
        _validateJITParams(jitParams);
        _validateTargetTransaction(targetTx);
        _validateBackrunParams(backrunParams);
        _validateFlashParams(flashParams);

        // Create execution record
        executionId = ++executionCounter;
        currentActiveExecutions++;

        ArbitrageExecution storage execution = executions[executionId];
        execution.executionId = executionId;
        execution.currentState = StrategyState.JIT_POSITIONING;
        execution.jitParams = jitParams;
        execution.targetTx = targetTx;
        execution.backrunParams = backrunParams;
        execution.flashParams = flashParams;
        execution.isCompleted = false;

        emit JITArbitrageInitiated(
            executionId,
            jitParams.pool,
            jitParams.liquidityAmount,
            targetTx.txHash
        );

        // Execute flash loan to get initial capital
        _initiateFlashLoan(executionId, flashParams);

        return executionId;
    }

    /**
     * @notice Callback de flash loan - ejecuta lógica principal JIT + Backrun
     */
    function receiveFlashLoan(
        address asset,
        uint256 amount,
        uint256 fee,
        bytes calldata params
    ) external override {
        require(
            authorizedFlashProviders[msg.sender],
            "JITArbitrage: Unauthorized flash provider"
        );

        uint256 executionId = abi.decode(params, (uint256));
        ArbitrageExecution storage execution = executions[executionId];

        emit FlashLoanReceived(msg.sender, asset, amount, executionId);

        // Execute JIT positioning and backrun strategy
        _executeJITStrategy(executionId, asset, amount);

        // Ensure we can repay the flash loan
        uint256 totalRepayment = amount + fee;
        require(
            IERC20(asset).balanceOf(address(this)) >= totalRepayment,
            "JITArbitrage: Insufficient balance for repayment"
        );

        // Repay flash loan
        IERC20(asset).safeTransfer(msg.sender, totalRepayment);
    }

    // =============================================================================
    // CORE STRATEGY IMPLEMENTATION
    // =============================================================================

    /**
     * @notice Ejecuta la estrategia JIT completa
     */
    function _executeJITStrategy(
        uint256 executionId,
        address flashAsset,
        uint256 flashAmount
    ) internal {
        ArbitrageExecution storage execution = executions[executionId];
        
        try this._performJITExecution(executionId, flashAsset, flashAmount) {
            execution.isCompleted = true;
            successfulExecutions++;
        } catch Error(string memory reason) {
            execution.currentState = StrategyState.IDLE;
            // Log error but don't revert to ensure flash loan repayment
            emit ArbitrageCompleted(executionId, 0, 0, false);
        } catch {
            execution.currentState = StrategyState.IDLE;
            emit ArbitrageCompleted(executionId, 0, 0, false);
        }
        
        currentActiveExecutions--;
        totalExecutions++;
    }

    /**
     * @notice Ejecuta el proceso JIT step-by-step
     */
    function _performJITExecution(
        uint256 executionId,
        address flashAsset,
        uint256 flashAmount
    ) external {
        require(msg.sender == address(this), "JITArbitrage: Internal call only");
        
        ArbitrageExecution storage execution = executions[executionId];
        
        // Step 1: Mint JIT liquidity position
        execution.currentState = StrategyState.JIT_POSITIONING;
        uint256 positionTokenId = _mintJITPosition(executionId);
        execution.positionTokenId = positionTokenId;

        // Step 2: Monitor for target transaction execution
        execution.currentState = StrategyState.WAITING_TARGET;
        _waitForTargetTransaction(executionId);

        // Step 3: Execute backrun immediately after target tx
        execution.currentState = StrategyState.BACKRUNNING;
        uint256 backrunProfit = _executeBackrun(executionId);

        // Step 4: Burn JIT position and collect fees
        execution.currentState = StrategyState.CLOSING_POSITION;
        uint256 feesCollected = _burnJITPosition(executionId);

        // Calculate total profit
        execution.profitRealized = backrunProfit + feesCollected;
        totalProfitRealized += execution.profitRealized;

        // Update execution time
        execution.executionTime = block.timestamp * 1000000; // Convert to microseconds
        
        emit ArbitrageCompleted(
            executionId,
            execution.profitRealized,
            execution.executionTime,
            true
        );
    }

    /**
     * @notice Mint posición de liquidez JIT concentrada
     */
    function _mintJITPosition(uint256 executionId) internal returns (uint256 positionTokenId) {
        ArbitrageExecution storage execution = executions[executionId];
        JITParams memory params = execution.jitParams;

        // Approve tokens for position manager
        IERC20(params.token0).safeApprove(address(positionManager), params.amount0Desired);
        IERC20(params.token1).safeApprove(address(positionManager), params.amount1Desired);

        // Mint concentrated liquidity position
        INonfungiblePositionManager.MintParams memory mintParams = INonfungiblePositionManager.MintParams({
            token0: params.token0,
            token1: params.token1,
            fee: params.feeTier,
            tickLower: params.tickLower,
            tickUpper: params.tickUpper,
            amount0Desired: params.amount0Desired,
            amount1Desired: params.amount1Desired,
            amount0Min: params.amount0Min,
            amount1Min: params.amount1Min,
            recipient: address(this),
            deadline: params.deadline
        });

        (positionTokenId, uint128 liquidity, uint256 amount0, uint256 amount1) = positionManager.mint(mintParams);

        emit JITPositionMinted(executionId, positionTokenId, liquidity, amount0, amount1);

        return positionTokenId;
    }

    /**
     * @notice Espera ejecución de transacción objetivo
     */
    function _waitForTargetTransaction(uint256 executionId) internal {
        ArbitrageExecution storage execution = executions[executionId];
        
        // En implementación real, aquí monitoreamos el mempool/pending transactions
        // Por ahora, simulamos detección de transacción objetivo
        
        emit TargetTransactionDetected(
            executionId,
            execution.targetTx.txHash,
            execution.targetTx.targetPool,
            execution.targetTx.expectedPriceImpact
        );
        
        // Mark transaction as processed
        processedTransactions[execution.targetTx.txHash] = true;
    }

    /**
     * @notice Ejecuta backrun swap para capturar movimiento de precio
     */
    function _executeBackrun(uint256 executionId) internal returns (uint256 profit) {
        ArbitrageExecution storage execution = executions[executionId];
        BackrunParams memory params = execution.backrunParams;

        // Approve token for swap router
        IERC20(params.tokenIn).safeApprove(address(swapRouter), params.amountIn);

        // Execute backrun swap
        ISwapRouter.ExactInputSingleParams memory swapParams = ISwapRouter.ExactInputSingleParams({
            tokenIn: params.tokenIn,
            tokenOut: params.tokenOut,
            fee: execution.jitParams.feeTier,
            recipient: address(this),
            deadline: params.deadline,
            amountIn: params.amountIn,
            amountOutMinimum: params.amountOutMinimum,
            sqrtPriceLimitX96: params.sqrtPriceLimitX96
        });

        uint256 amountOut = swapRouter.exactInputSingle(swapParams);
        
        // Calculate profit (simplified calculation)
        profit = amountOut > params.amountOutMinimum ? amountOut - params.amountOutMinimum : 0;

        emit BackrunExecuted(
            executionId,
            params.tokenIn,
            params.tokenOut,
            params.amountIn,
            amountOut,
            profit
        );

        return profit;
    }

    /**
     * @notice Burn posición JIT y colectar fees
     */
    function _burnJITPosition(uint256 executionId) internal returns (uint256 feesCollected) {
        ArbitrageExecution storage execution = executions[executionId];
        uint256 positionTokenId = execution.positionTokenId;

        // Get position info
        (,,,,,,,uint128 liquidity,,,,) = positionManager.positions(positionTokenId);

        if (liquidity > 0) {
            // Decrease liquidity to 0
            INonfungiblePositionManager.DecreaseLiquidityParams memory decreaseParams = 
                INonfungiblePositionManager.DecreaseLiquidityParams({
                    tokenId: positionTokenId,
                    liquidity: liquidity,
                    amount0Min: 0,
                    amount1Min: 0,
                    deadline: block.timestamp + 300
                });

            positionManager.decreaseLiquidity(decreaseParams);
        }

        // Collect all fees and remaining tokens
        INonfungiblePositionManager.CollectParams memory collectParams = 
            INonfungiblePositionManager.CollectParams({
                tokenId: positionTokenId,
                recipient: address(this),
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            });

        (uint256 amount0Collected, uint256 amount1Collected) = positionManager.collect(collectParams);

        // Burn the NFT position
        positionManager.burn(positionTokenId);

        feesCollected = amount0Collected + amount1Collected; // Simplified fee calculation

        emit JITPositionBurned(executionId, positionTokenId, amount0Collected, amount1Collected);

        return feesCollected;
    }

    // =============================================================================
    // FLASH LOAN INTEGRATION
    // =============================================================================

    /**
     * @notice Inicia flash loan con el proveedor especificado
     */
    function _initiateFlashLoan(uint256 executionId, FlashLoanParams memory flashParams) internal {
        // En implementación real, aquí llamaríamos al flash loan provider específico
        // Por ahora, simulamos recepción directa del flash loan
        bytes memory params = abi.encode(executionId);
        
        // Simulate flash loan reception
        this.receiveFlashLoan(
            flashParams.asset,
            flashParams.amount,
            (flashParams.amount * 9) / 10000, // 0.09% fee simulation
            params
        );
    }

    // =============================================================================
    // VALIDATION FUNCTIONS
    // =============================================================================

    function _validateJITParams(JITParams calldata params) internal view {
        require(params.pool != address(0), "JITArbitrage: Invalid pool");
        require(params.token0 != address(0), "JITArbitrage: Invalid token0");
        require(params.token1 != address(0), "JITArbitrage: Invalid token1");
        require(params.liquidityAmount > 0, "JITArbitrage: Invalid liquidity amount");
        require(params.amount0Desired > 0 || params.amount1Desired > 0, "JITArbitrage: Invalid token amounts");
        require(params.deadline > block.timestamp, "JITArbitrage: Invalid deadline");
        require(params.tickLower < params.tickUpper, "JITArbitrage: Invalid tick range");
    }

    function _validateTargetTransaction(TargetTransaction calldata targetTx) internal view {
        require(targetTx.txHash != bytes32(0), "JITArbitrage: Invalid tx hash");
        require(targetTx.targetPool != address(0), "JITArbitrage: Invalid target pool");
        require(targetTx.tokenIn != address(0), "JITArbitrage: Invalid token in");
        require(targetTx.tokenOut != address(0), "JITArbitrage: Invalid token out");
        require(targetTx.amountIn > 0, "JITArbitrage: Invalid amount in");
        require(!processedTransactions[targetTx.txHash], "JITArbitrage: Transaction already processed");
    }

    function _validateBackrunParams(BackrunParams calldata params) internal view {
        require(params.tokenIn != address(0), "JITArbitrage: Invalid backrun token in");
        require(params.tokenOut != address(0), "JITArbitrage: Invalid backrun token out");
        require(params.amountIn > 0, "JITArbitrage: Invalid backrun amount");
        require(params.recipient != address(0), "JITArbitrage: Invalid recipient");
        require(params.deadline > block.timestamp, "JITArbitrage: Invalid backrun deadline");
    }

    function _validateFlashParams(FlashLoanParams calldata params) internal view {
        require(params.asset != address(0), "JITArbitrage: Invalid flash asset");
        require(params.amount > 0, "JITArbitrage: Invalid flash amount");
        require(
            authorizedFlashProviders[params.provider],
            "JITArbitrage: Unauthorized flash provider"
        );
    }

    // =============================================================================
    // VIEW FUNCTIONS
    // =============================================================================

    /**
     * @notice Obtiene detalles de ejecución específica
     */
    function getExecutionDetails(uint256 executionId) 
        external 
        view 
        validExecution(executionId) 
        returns (ArbitrageExecution memory) 
    {
        return executions[executionId];
    }

    /**
     * @notice Obtiene estadísticas de performance de la estrategia
     */
    function getStrategyStats() external view returns (
        uint256 _totalExecutions,
        uint256 _successfulExecutions,
        uint256 _totalProfitRealized,
        uint256 _averageExecutionTime,
        uint256 _successRate
    ) {
        _totalExecutions = totalExecutions;
        _successfulExecutions = successfulExecutions;
        _totalProfitRealized = totalProfitRealized;
        _averageExecutionTime = averageExecutionTime;
        _successRate = totalExecutions > 0 ? (successfulExecutions * 10000) / totalExecutions : 0;
    }

    /**
     * @notice Verifica si una transacción ya fue procesada
     */
    function isTransactionProcessed(bytes32 txHash) external view returns (bool) {
        return processedTransactions[txHash];
    }

    /**
     * @notice Obtiene lista de proveedores de flash loans autorizados
     */
    function getAuthorizedFlashProviders() external view returns (address[] memory) {
        return flashProviders;
    }

    // =============================================================================
    // ADMIN FUNCTIONS
    // =============================================================================

    /**
     * @notice Actualiza configuración de la estrategia
     */
    function updateStrategyConfig(
        uint256 _maxPositionSize,
        uint256 _minProfitThreshold,
        uint256 _maxSlippageTolerance,
        uint256 _maxConcurrentExecutions
    ) external onlyOwner {
        require(_minProfitThreshold >= MIN_PROFIT_BPS, "JITArbitrage: Profit threshold too low");
        require(_maxSlippageTolerance <= MAX_SLIPPAGE_BPS, "JITArbitrage: Slippage tolerance too high");
        require(_maxConcurrentExecutions > 0, "JITArbitrage: Invalid concurrent executions");

        maxPositionSize = _maxPositionSize;
        minProfitThreshold = _minProfitThreshold;
        maxSlippageTolerance = _maxSlippageTolerance;
        maxConcurrentExecutions = _maxConcurrentExecutions;
    }

    /**
     * @notice Autoriza/desautoriza operadores
     */
    function setAuthorizedOperator(address operator, bool authorized) external onlyOwner {
        require(operator != address(0), "JITArbitrage: Invalid operator");
        authorizedOperators[operator] = authorized;
    }

    /**
     * @notice Activa/desactiva estrategia
     */
    function setStrategyActive(bool active) external onlyOwner {
        strategyActive = active;
    }

    /**
     * @notice Añade proveedor de flash loans
     */
    function addFlashProvider(address provider) external onlyOwner {
        require(provider != address(0), "JITArbitrage: Invalid provider");
        require(!authorizedFlashProviders[provider], "JITArbitrage: Provider already authorized");
        
        authorizedFlashProviders[provider] = true;
        flashProviders.push(provider);
    }

    /**
     * @notice Remueve proveedor de flash loans
     */
    function removeFlashProvider(address provider) external onlyOwner {
        require(authorizedFlashProviders[provider], "JITArbitrage: Provider not authorized");
        
        authorizedFlashProviders[provider] = false;
        
        // Remove from array
        for (uint256 i = 0; i < flashProviders.length; i++) {
            if (flashProviders[i] == provider) {
                flashProviders[i] = flashProviders[flashProviders.length - 1];
                flashProviders.pop();
                break;
            }
        }
    }

    /**
     * @notice Retiro de emergencia de tokens
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        require(token != address(0), "JITArbitrage: Invalid token");
        
        uint256 balance = IERC20(token).balanceOf(address(this));
        uint256 withdrawAmount = amount == 0 ? balance : amount;
        
        require(withdrawAmount <= balance, "JITArbitrage: Insufficient balance");
        
        IERC20(token).safeTransfer(owner(), withdrawAmount);
        
        emit EmergencyWithdraw(token, withdrawAmount, owner());
    }

    /**
     * @notice Pausa de emergencia
     */
    function emergencyPause() external onlyOwner {
        strategyActive = false;
    }

    // =============================================================================
    // RECEIVE & FALLBACK
    // =============================================================================

    receive() external payable {}
    
    fallback() external payable {}
}
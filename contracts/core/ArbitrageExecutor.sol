// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IArbitrageStrategy.sol";
import "../interfaces/IFlashLoanProvider.sol";
import "../libraries/SafeMath.sol";

/**
 * @title ArbitrageExecutor
 * @dev Core contract para ejecutar todas las estrategias de arbitraje de ArbitrageX Supreme
 * @notice Contrato principal que orquesta las 14+ estrategias de flash loans
 */
contract ArbitrageExecutor is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    // ==================== STRUCTS ====================
    
    struct ArbitrageParams {
        address strategy;           // Dirección del contrato de estrategia
        bytes strategyData;        // Datos codificados para la estrategia
        address flashLoanProvider; // Proveedor de flash loan (Aave, Balancer, etc)
        address asset;             // Token a pedir prestado
        uint256 amount;            // Cantidad a pedir prestado
        uint256 minProfit;         // Ganancia mínima esperada
        uint256 deadline;          // Timestamp de expiración
    }

    struct ExecutionResult {
        bool success;
        uint256 profit;
        uint256 gasUsed;
        string errorMessage;
    }

    // ==================== EVENTS ====================
    
    event ArbitrageExecuted(
        address indexed strategy,
        address indexed asset,
        uint256 amount,
        uint256 profit,
        uint256 gasUsed
    );
    
    event FlashLoanExecuted(
        address indexed provider,
        address indexed asset,
        uint256 amount,
        uint256 fee
    );
    
    event ProfitWithdrawn(
        address indexed token,
        address indexed recipient,
        uint256 amount
    );
    
    event StrategyAdded(address indexed strategy, string name);
    event StrategyRemoved(address indexed strategy);
    event FlashLoanProviderUpdated(address indexed provider, bool enabled);

    // ==================== STORAGE ====================
    
    mapping(address => bool) public authorizedStrategies;
    mapping(address => bool) public authorizedFlashLoanProviders;
    mapping(address => uint256) public strategyProfits;
    mapping(address => uint256) public totalExecutions;
    
    uint256 public constant MAX_SLIPPAGE = 500; // 5%
    uint256 public constant BASIS_POINTS = 10000;
    uint256 public minExecutionGas = 200000;
    uint256 public treasuryFee = 100; // 1%
    address public treasury;
    
    bool public emergencyPaused = false;
    
    // ==================== MODIFIERS ====================
    
    modifier onlyAuthorizedStrategy(address strategy) {
        require(authorizedStrategies[strategy], "Strategy not authorized");
        _;
    }
    
    modifier onlyAuthorizedFlashLoanProvider(address provider) {
        require(authorizedFlashLoanProviders[provider], "FlashLoan provider not authorized");
        _;
    }
    
    modifier notPaused() {
        require(!emergencyPaused, "Contract is paused");
        _;
    }
    
    modifier validDeadline(uint256 deadline) {
        require(deadline >= block.timestamp, "Deadline expired");
        _;
    }

    // ==================== CONSTRUCTOR ====================
    
    constructor(address _treasury) {
        treasury = _treasury;
    }

    // ==================== MAIN EXECUTION FUNCTIONS ====================
    
    /**
     * @dev Ejecuta arbitraje con flash loan
     * @param params Parámetros del arbitraje
     * @return result Resultado de la ejecución
     */
    function executeArbitrage(ArbitrageParams calldata params) 
        external 
        nonReentrant 
        notPaused 
        onlyAuthorizedStrategy(params.strategy)
        onlyAuthorizedFlashLoanProvider(params.flashLoanProvider)
        validDeadline(params.deadline)
        returns (ExecutionResult memory result) 
    {
        uint256 gasStart = gasleft();
        
        try this._executeArbitrageInternal(params) returns (uint256 profit) {
            uint256 gasUsed = gasStart.sub(gasleft());
            
            // Verificar ganancia mínima
            require(profit >= params.minProfit, "Insufficient profit");
            
            // Calcular y transferir fee del treasury
            uint256 treasuryAmount = profit.mul(treasuryFee).div(BASIS_POINTS);
            if (treasuryAmount > 0) {
                IERC20(params.asset).safeTransfer(treasury, treasuryAmount);
            }
            
            // Actualizar estadísticas
            strategyProfits[params.strategy] = strategyProfits[params.strategy].add(profit);
            totalExecutions[params.strategy] = totalExecutions[params.strategy].add(1);
            
            emit ArbitrageExecuted(params.strategy, params.asset, params.amount, profit, gasUsed);
            
            result = ExecutionResult({
                success: true,
                profit: profit,
                gasUsed: gasUsed,
                errorMessage: ""
            });
        } catch Error(string memory reason) {
            result = ExecutionResult({
                success: false,
                profit: 0,
                gasUsed: gasStart.sub(gasleft()),
                errorMessage: reason
            });
        } catch (bytes memory) {
            result = ExecutionResult({
                success: false,
                profit: 0,
                gasUsed: gasStart.sub(gasleft()),
                errorMessage: "Unknown error"
            });
        }
    }
    
    /**
     * @dev Función interna para ejecutar arbitraje (separada para manejo de errores)
     * @param params Parámetros del arbitraje
     * @return profit Ganancia obtenida
     */
    function _executeArbitrageInternal(ArbitrageParams calldata params) 
        external 
        returns (uint256 profit) 
    {
        require(msg.sender == address(this), "Only self-call allowed");
        
        // Obtener balance inicial
        uint256 initialBalance = IERC20(params.asset).balanceOf(address(this));
        
        // Iniciar flash loan
        IFlashLoanProvider(params.flashLoanProvider).flashLoan(
            params.asset,
            params.amount,
            abi.encode(params)
        );
        
        // Obtener balance final
        uint256 finalBalance = IERC20(params.asset).balanceOf(address(this));
        
        // Calcular ganancia
        require(finalBalance > initialBalance, "No profit generated");
        profit = finalBalance.sub(initialBalance);
    }

    /**
     * @dev Callback para flash loans - implementa la lógica de arbitraje
     * @param asset Token prestado
     * @param amount Cantidad prestada
     * @param fee Fee del flash loan
     * @param params Parámetros codificados
     */
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 fee,
        bytes calldata params
    ) external returns (bool) {
        // Decodificar parámetros
        ArbitrageParams memory arbitrageParams = abi.decode(params, (ArbitrageParams));
        
        // Verificar que el call viene del proveedor autorizado
        require(
            msg.sender == arbitrageParams.flashLoanProvider,
            "Unauthorized flash loan provider"
        );
        
        // Ejecutar estrategia de arbitraje
        IArbitrageStrategy strategy = IArbitrageStrategy(arbitrageParams.strategy);
        
        uint256 profit = strategy.execute(
            asset,
            amount,
            arbitrageParams.strategyData
        );
        
        // Verificar que tenemos suficiente para repagar el loan + fee
        uint256 totalRepayment = amount.add(fee);
        uint256 balance = IERC20(asset).balanceOf(address(this));
        require(balance >= totalRepayment, "Insufficient balance to repay loan");
        
        // Aprobar repago del flash loan
        IERC20(asset).safeApprove(msg.sender, totalRepayment);
        
        emit FlashLoanExecuted(msg.sender, asset, amount, fee);
        
        return true;
    }

    // ==================== BATCH EXECUTION ====================
    
    /**
     * @dev Ejecuta múltiples arbitrajes en una sola transacción
     * @param paramsArray Array de parámetros de arbitraje
     * @return results Array de resultados
     */
    function batchExecuteArbitrage(ArbitrageParams[] calldata paramsArray)
        external
        nonReentrant
        notPaused
        returns (ExecutionResult[] memory results)
    {
        require(paramsArray.length > 0 && paramsArray.length <= 10, "Invalid batch size");
        
        results = new ExecutionResult[](paramsArray.length);
        
        for (uint256 i = 0; i < paramsArray.length; i++) {
            // Validar cada parámetro
            require(authorizedStrategies[paramsArray[i].strategy], "Strategy not authorized");
            require(authorizedFlashLoanProviders[paramsArray[i].flashLoanProvider], "Provider not authorized");
            require(paramsArray[i].deadline >= block.timestamp, "Deadline expired");
            
            // Ejecutar arbitraje
            results[i] = this.executeArbitrage(paramsArray[i]);
        }
    }

    // ==================== SIMULATION ====================
    
    /**
     * @dev Simula una ejecución de arbitraje sin ejecutarla realmente
     * @param params Parámetros del arbitraje
     * @return expectedProfit Ganancia esperada
     * @return gasEstimate Estimación de gas
     */
    function simulateArbitrage(ArbitrageParams calldata params)
        external
        view
        onlyAuthorizedStrategy(params.strategy)
        returns (uint256 expectedProfit, uint256 gasEstimate)
    {
        // Llamar función de simulación en la estrategia
        IArbitrageStrategy strategy = IArbitrageStrategy(params.strategy);
        (expectedProfit, gasEstimate) = strategy.simulate(
            params.asset,
            params.amount,
            params.strategyData
        );
    }

    // ==================== ADMIN FUNCTIONS ====================
    
    /**
     * @dev Añade una nueva estrategia autorizada
     * @param strategy Dirección del contrato de estrategia
     * @param name Nombre de la estrategia
     */
    function addStrategy(address strategy, string memory name) external onlyOwner {
        require(strategy != address(0), "Invalid strategy address");
        authorizedStrategies[strategy] = true;
        emit StrategyAdded(strategy, name);
    }
    
    /**
     * @dev Remueve una estrategia autorizada
     * @param strategy Dirección del contrato de estrategia
     */
    function removeStrategy(address strategy) external onlyOwner {
        authorizedStrategies[strategy] = false;
        emit StrategyRemoved(strategy);
    }
    
    /**
     * @dev Actualiza proveedor de flash loan autorizado
     * @param provider Dirección del proveedor
     * @param enabled Si está habilitado o no
     */
    function updateFlashLoanProvider(address provider, bool enabled) external onlyOwner {
        authorizedFlashLoanProviders[provider] = enabled;
        emit FlashLoanProviderUpdated(provider, enabled);
    }
    
    /**
     * @dev Actualiza dirección del treasury
     * @param _treasury Nueva dirección del treasury
     */
    function updateTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury address");
        treasury = _treasury;
    }
    
    /**
     * @dev Actualiza fee del treasury
     * @param _treasuryFee Nuevo fee (en basis points)
     */
    function updateTreasuryFee(uint256 _treasuryFee) external onlyOwner {
        require(_treasuryFee <= 1000, "Fee too high"); // Máximo 10%
        treasuryFee = _treasuryFee;
    }
    
    /**
     * @dev Pausa/despausa el contrato en caso de emergencia
     * @param paused Si pausar o no
     */
    function setEmergencyPause(bool paused) external onlyOwner {
        emergencyPaused = paused;
    }

    // ==================== RECOVERY FUNCTIONS ====================
    
    /**
     * @dev Retira tokens del contrato (solo owner)
     * @param token Dirección del token
     * @param amount Cantidad a retirar
     * @param recipient Destinatario
     */
    function withdrawToken(
        address token,
        uint256 amount,
        address recipient
    ) external onlyOwner {
        require(recipient != address(0), "Invalid recipient");
        IERC20(token).safeTransfer(recipient, amount);
        emit ProfitWithdrawn(token, recipient, amount);
    }
    
    /**
     * @dev Retira ETH del contrato (solo owner)
     * @param amount Cantidad a retirar
     * @param recipient Destinatario
     */
    function withdrawETH(uint256 amount, address payable recipient) external onlyOwner {
        require(recipient != address(0), "Invalid recipient");
        require(address(this).balance >= amount, "Insufficient ETH balance");
        recipient.transfer(amount);
    }

    // ==================== VIEW FUNCTIONS ====================
    
    /**
     * @dev Obtiene estadísticas de una estrategia
     * @param strategy Dirección de la estrategia
     * @return totalProfit Ganancia total acumulada
     * @return executionCount Número de ejecuciones
     */
    function getStrategyStats(address strategy)
        external
        view
        returns (uint256 totalProfit, uint256 executionCount)
    {
        totalProfit = strategyProfits[strategy];
        executionCount = totalExecutions[strategy];
    }
    
    /**
     * @dev Verifica si una estrategia está autorizada
     * @param strategy Dirección de la estrategia
     * @return authorized Si está autorizada
     */
    function isStrategyAuthorized(address strategy) external view returns (bool authorized) {
        authorized = authorizedStrategies[strategy];
    }
    
    /**
     * @dev Verifica si un proveedor de flash loan está autorizado
     * @param provider Dirección del proveedor
     * @return authorized Si está autorizado
     */
    function isFlashLoanProviderAuthorized(address provider) external view returns (bool authorized) {
        authorized = authorizedFlashLoanProviders[provider];
    }

    // ==================== FALLBACK ====================
    
    /**
     * @dev Recibe ETH
     */
    receive() external payable {}
    
    /**
     * @dev Fallback para calls no reconocidos
     */
    fallback() external payable {}
}
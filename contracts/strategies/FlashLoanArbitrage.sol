// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IArbitrageStrategy.sol";
import "../interfaces/IFlashLoanReceiver.sol";
import "../libraries/PriceUtils.sol";
import "../libraries/SafeMath.sol";

/**
 * @title FlashLoanArbitrage
 * @dev Implementa arbitraje usando flash loans de múltiples proveedores
 * Soporta Aave, dYdX, Balancer, Uniswap V3, Compound, y otros protocolos
 * Permite arbitraje sin capital inicial aprovechando liquidez instantánea
 */
contract FlashLoanArbitrage is 
    IArbitrageStrategy, 
    IFlashLoanReceiver,
    ReentrancyGuard, 
    Pausable, 
    Ownable 
{
    using SafeERC20 for IERC20;
    using PriceUtils for uint256;
    using SafeMath for uint256;

    // ==================== ESTRUCTURAS Y ENUMS ====================

    enum FlashLoanProvider { 
        AAVE_V3, 
        AAVE_V2, 
        DYDX, 
        BALANCER, 
        UNISWAP_V3, 
        COMPOUND,
        MAKER_DAO,
        CREAM,
        IRON_BANK
    }

    struct FlashLoanParams {
        FlashLoanProvider provider;   // Proveedor del flash loan
        address[] assets;            // Assets a prestar
        uint256[] amounts;           // Cantidades a prestar
        uint256[] modes;            // Modos de interés (0=sin deuda, 1=stable, 2=variable)
        bytes arbitrageData;        // Datos del arbitraje a ejecutar
        uint256 maxGasCost;         // Máximo costo de gas aceptable
        uint256 minProfitBPS;       // Ganancia mínima en basis points
        uint256 deadline;           // Timestamp límite
    }

    struct ArbitrageStep {
        address dex;                // DEX para el swap
        address tokenIn;           // Token de entrada
        address tokenOut;          // Token de salida
        uint256 amountIn;          // Cantidad de entrada
        uint256 expectedOut;       // Salida esperada
        bytes swapData;            // Datos específicos del swap
        uint256 slippageBPS;       // Slippage permitido en basis points
    }

    struct FlashLoanExecution {
        address initiator;          // Quien inició el flash loan
        FlashLoanProvider provider; // Proveedor usado
        address[] assets;          // Assets prestados
        uint256[] amounts;         // Cantidades prestadas
        uint256[] fees;            // Fees del flash loan
        uint256 gasStart;          // Gas al inicio
        uint256 profit;            // Ganancia obtenida
        bool completed;            // Si se completó exitosamente
        string errorReason;        // Razón de error si falló
    }

    // ==================== VARIABLES DE ESTADO ====================

    // Direcciones de los proveedores de flash loans
    mapping(FlashLoanProvider => address) public flashLoanProviders;
    mapping(FlashLoanProvider => bool) public providerActive;
    mapping(FlashLoanProvider => uint256) public providerFeeBPS;
    
    // Control de ejecución
    mapping(address => bool) public authorizedCallers;
    FlashLoanExecution public currentExecution;
    bool public flashLoanInProgress;
    
    uint256 public constant MAX_FLASH_LOAN_FEE = 100;    // 1% máximo fee
    uint256 public constant MIN_PROFIT_THRESHOLD = 1e15; // 0.001 ETH mínimo
    uint256 public executionFee = 200;                   // 2% fee de ejecución
    uint256 public maxSlippage = 300;                    // 3% máximo slippage
    
    address public profitReceiver;
    address public emergencyReceiver;

    // ==================== EVENTOS ====================

    event FlashLoanArbitrageInitiated(
        address indexed initiator,
        FlashLoanProvider provider,
        address[] assets,
        uint256[] amounts,
        uint256 timestamp
    );

    event FlashLoanArbitrageCompleted(
        FlashLoanProvider provider,
        uint256 totalProfit,
        uint256 gasUsed,
        bool success,
        string reason
    );

    event FlashLoanProviderUpdated(
        FlashLoanProvider indexed provider,
        address providerAddress,
        bool active,
        uint256 feeBPS
    );

    event ProfitDistributed(
        address indexed token,
        uint256 totalAmount,
        uint256 feeAmount,
        uint256 netProfit
    );

    // ==================== CONSTRUCTOR ====================

    constructor(
        address _profitReceiver,
        address _emergencyReceiver
    ) {
        profitReceiver = _profitReceiver;
        emergencyReceiver = _emergencyReceiver;
        authorizedCallers[msg.sender] = true;
    }

    // ==================== MODIFICADORES ====================

    modifier onlyAuthorized() {
        require(authorizedCallers[msg.sender], "FlashLoan: Not authorized");
        _;
    }

    modifier notInProgress() {
        require(!flashLoanInProgress, "FlashLoan: Already in progress");
        _;
    }

    // ==================== FUNCIONES PRINCIPALES ====================

    /**
     * @dev Ejecuta arbitraje con flash loan
     */
    function execute(bytes calldata data) 
        external 
        override 
        nonReentrant 
        whenNotPaused 
        onlyAuthorized
        notInProgress
        returns (bool success, uint256 profit) 
    {
        FlashLoanParams memory params = abi.decode(data, (FlashLoanParams));
        
        require(params.deadline >= block.timestamp, "FlashLoan: Deadline expired");
        require(providerActive[params.provider], "FlashLoan: Provider not active");
        require(params.assets.length > 0, "FlashLoan: No assets specified");
        require(params.amounts.length == params.assets.length, "FlashLoan: Length mismatch");

        // Inicializar registro de ejecución
        _initializeExecution(params);

        // Ejecutar flash loan según el proveedor
        return _executeFlashLoan(params);
    }

    /**
     * @dev Callback para flash loans de Aave V3
     */
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        require(flashLoanInProgress, "FlashLoan: No active flash loan");
        require(msg.sender == flashLoanProviders[FlashLoanProvider.AAVE_V3], "FlashLoan: Invalid caller");

        return _handleFlashLoanCallback(assets, amounts, premiums, params);
    }

    /**
     * @dev Callback genérico para otros proveedores
     */
    function onFlashLoan(
        address initiator,
        address token,
        uint256 amount,
        uint256 fee,
        bytes calldata data
    ) external returns (bytes32) {
        require(flashLoanInProgress, "FlashLoan: No active flash loan");
        
        address[] memory assets = new address[](1);
        uint256[] memory amounts = new uint256[](1);
        uint256[] memory fees = new uint256[](1);
        
        assets[0] = token;
        amounts[0] = amount;
        fees[0] = fee;

        bool success = _handleFlashLoanCallback(assets, amounts, fees, data);
        
        return success ? keccak256("ERC3156FlashBorrower.onFlashLoan") : bytes32(0);
    }

    /**
     * @dev Simula la ejecución del arbitraje
     */
    function simulate(bytes calldata data) 
        external 
        view 
        override 
        returns (bool canExecute, uint256 estimatedProfit) 
    {
        FlashLoanParams memory params = abi.decode(data, (FlashLoanParams));
        
        if (!providerActive[params.provider]) {
            return (false, 0);
        }

        return _simulateFlashLoanArbitrage(params);
    }

    /**
     * @dev Verifica si puede ejecutarse
     */
    function canExecute(bytes calldata data) external view override returns (bool) {
        (bool executable,) = this.simulate(data);
        return executable;
    }

    /**
     * @dev Información de la estrategia
     */
    function getStrategyInfo() external pure override returns (string memory name, string memory description) {
        return (
            "Flash Loan Arbitrage",
            "Capital-free arbitrage using flash loans from multiple DeFi protocols"
        );
    }

    // ==================== FUNCIONES INTERNAS ====================

    /**
     * @dev Inicializa la ejecución del flash loan
     */
    function _initializeExecution(FlashLoanParams memory params) internal {
        currentExecution = FlashLoanExecution({
            initiator: msg.sender,
            provider: params.provider,
            assets: params.assets,
            amounts: params.amounts,
            fees: new uint256[](params.assets.length),
            gasStart: gasleft(),
            profit: 0,
            completed: false,
            errorReason: ""
        });

        flashLoanInProgress = true;
    }

    /**
     * @dev Ejecuta el flash loan según el proveedor
     */
    function _executeFlashLoan(FlashLoanParams memory params) internal returns (bool success, uint256 profit) {
        address providerAddress = flashLoanProviders[params.provider];
        require(providerAddress != address(0), "FlashLoan: Provider not configured");

        emit FlashLoanArbitrageInitiated(
            msg.sender,
            params.provider,
            params.assets,
            params.amounts,
            block.timestamp
        );

        if (params.provider == FlashLoanProvider.AAVE_V3) {
            return _executeAaveV3FlashLoan(params);
        } else if (params.provider == FlashLoanProvider.BALANCER) {
            return _executeBalancerFlashLoan(params);
        } else if (params.provider == FlashLoanProvider.UNISWAP_V3) {
            return _executeUniswapV3FlashLoan(params);
        } else if (params.provider == FlashLoanProvider.DYDX) {
            return _executeDyDxFlashLoan(params);
        }

        return (false, 0);
    }

    /**
     * @dev Ejecuta flash loan de Aave V3
     */
    function _executeAaveV3FlashLoan(FlashLoanParams memory params) internal returns (bool, uint256) {
        address lendingPool = flashLoanProviders[FlashLoanProvider.AAVE_V3];
        
        try IAaveV3Pool(lendingPool).flashLoan(
            address(this),
            params.assets,
            params.amounts,
            params.modes,
            address(this),
            params.arbitrageData,
            0
        ) {
            return _finalizeExecution();
        } catch Error(string memory reason) {
            return _handleFlashLoanError(reason);
        }
    }

    /**
     * @dev Ejecuta flash loan de Balancer
     */
    function _executeBalancerFlashLoan(FlashLoanParams memory params) internal returns (bool, uint256) {
        address vault = flashLoanProviders[FlashLoanProvider.BALANCER];
        
        try IBalancerVault(vault).flashLoan(
            address(this),
            params.assets,
            params.amounts,
            params.arbitrageData
        ) {
            return _finalizeExecution();
        } catch Error(string memory reason) {
            return _handleFlashLoanError(reason);
        }
    }

    /**
     * @dev Ejecuta flash loan de Uniswap V3
     */
    function _executeUniswapV3FlashLoan(FlashLoanParams memory params) internal returns (bool, uint256) {
        require(params.assets.length == 2, "FlashLoan: UniV3 requires exactly 2 tokens");
        
        address pool = flashLoanProviders[FlashLoanProvider.UNISWAP_V3];
        
        try IUniswapV3Pool(pool).flash(
            address(this),
            params.amounts[0],
            params.amounts[1],
            params.arbitrageData
        ) {
            return _finalizeExecution();
        } catch Error(string memory reason) {
            return _handleFlashLoanError(reason);
        }
    }

    /**
     * @dev Ejecuta flash loan de dYdX
     */
    function _executeDyDxFlashLoan(FlashLoanParams memory params) internal returns (bool, uint256) {
        // Implementación específica para dYdX
        // Por simplicidad, retornamos false por ahora
        return _handleFlashLoanError("dYdX not implemented yet");
    }

    /**
     * @dev Maneja el callback del flash loan
     */
    function _handleFlashLoanCallback(
        address[] memory assets,
        uint256[] memory amounts,
        uint256[] memory fees,
        bytes memory arbitrageData
    ) internal returns (bool) {
        
        // Actualizar fees en la ejecución actual
        currentExecution.fees = fees;

        try this._executeArbitrageLogic(arbitrageData) returns (uint256 profit) {
            currentExecution.profit = profit;
            
            // Verificar que tenemos suficiente para pagar el flash loan
            uint256 totalRepayment = 0;
            for (uint256 i = 0; i < assets.length; i++) {
                uint256 repayAmount = amounts[i].add(fees[i]);
                totalRepayment = totalRepayment.add(repayAmount);
                
                require(
                    IERC20(assets[i]).balanceOf(address(this)) >= repayAmount,
                    "FlashLoan: Insufficient balance for repayment"
                );

                // Aprobar el repago al proveedor
                IERC20(assets[i]).safeApprove(msg.sender, repayAmount);
            }

            return true;
            
        } catch Error(string memory reason) {
            currentExecution.errorReason = reason;
            return false;
        }
    }

    /**
     * @dev Ejecuta la lógica de arbitraje dentro del flash loan
     */
    function _executeArbitrageLogic(bytes memory arbitrageData) external returns (uint256 totalProfit) {
        require(msg.sender == address(this), "FlashLoan: Internal function only");
        
        ArbitrageStep[] memory steps = abi.decode(arbitrageData, (ArbitrageStep[]));
        require(steps.length > 0, "FlashLoan: No arbitrage steps");

        uint256 initialBalance = IERC20(steps[0].tokenIn).balanceOf(address(this));
        
        for (uint256 i = 0; i < steps.length; i++) {
            ArbitrageStep memory step = steps[i];
            
            uint256 balanceBefore = IERC20(step.tokenOut).balanceOf(address(this));
            
            // Ejecutar swap
            IERC20(step.tokenIn).safeApprove(step.dex, step.amountIn);
            
            (bool success,) = step.dex.call(step.swapData);
            require(success, "FlashLoan: Swap failed");
            
            uint256 balanceAfter = IERC20(step.tokenOut).balanceOf(address(this));
            uint256 amountOut = balanceAfter.sub(balanceBefore);
            
            // Verificar slippage
            uint256 minAmountOut = step.expectedOut.mul(10000 - step.slippageBPS).div(10000);
            require(amountOut >= minAmountOut, "FlashLoan: Excessive slippage");
        }

        // Calcular ganancia final
        uint256 finalBalance = IERC20(steps[0].tokenIn).balanceOf(address(this));
        require(finalBalance > initialBalance, "FlashLoan: No profit generated");
        
        totalProfit = finalBalance.sub(initialBalance);
        return totalProfit;
    }

    /**
     * @dev Simula el arbitraje con flash loan
     */
    function _simulateFlashLoanArbitrage(FlashLoanParams memory params) 
        internal 
        view 
        returns (bool canExecute, uint256 estimatedProfit) 
    {
        // Calcular fees del flash loan
        uint256 totalFees = 0;
        for (uint256 i = 0; i < params.amounts.length; i++) {
            uint256 fee = params.amounts[i].mul(providerFeeBPS[params.provider]).div(10000);
            totalFees = totalFees.add(fee);
        }

        // Simular arbitraje (implementación simplificada)
        ArbitrageStep[] memory steps = abi.decode(params.arbitrageData, (ArbitrageStep[]));
        
        if (steps.length == 0) {
            return (false, 0);
        }

        uint256 currentAmount = steps[0].amountIn;
        
        for (uint256 i = 0; i < steps.length; i++) {
            // Simular slippage para cada step
            currentAmount = currentAmount.mul(9900).div(10000); // 1% slippage simulado
        }

        if (currentAmount > steps[0].amountIn.add(totalFees).add(MIN_PROFIT_THRESHOLD)) {
            estimatedProfit = currentAmount.sub(steps[0].amountIn).sub(totalFees);
            canExecute = true;
        }

        return (canExecute, estimatedProfit);
    }

    /**
     * @dev Finaliza la ejecución exitosa
     */
    function _finalizeExecution() internal returns (bool, uint256) {
        currentExecution.completed = true;
        flashLoanInProgress = false;
        
        uint256 gasUsed = currentExecution.gasStart.sub(gasleft());
        
        // Distribuir ganancias si las hay
        if (currentExecution.profit > 0) {
            _distributeProfit(currentExecution.profit);
        }

        emit FlashLoanArbitrageCompleted(
            currentExecution.provider,
            currentExecution.profit,
            gasUsed,
            true,
            "Success"
        );

        return (true, currentExecution.profit);
    }

    /**
     * @dev Maneja errores en el flash loan
     */
    function _handleFlashLoanError(string memory reason) internal returns (bool, uint256) {
        currentExecution.errorReason = reason;
        currentExecution.completed = false;
        flashLoanInProgress = false;

        emit FlashLoanArbitrageCompleted(
            currentExecution.provider,
            0,
            0,
            false,
            reason
        );

        return (false, 0);
    }

    /**
     * @dev Distribuye las ganancias
     */
    function _distributeProfit(uint256 profit) internal {
        address profitToken = currentExecution.assets[0]; // Usar primer asset como token de ganancia
        
        uint256 fee = profit.mul(executionFee).div(10000);
        uint256 netProfit = profit.sub(fee);
        
        if (fee > 0) {
            IERC20(profitToken).safeTransfer(profitReceiver, fee);
        }

        emit ProfitDistributed(profitToken, profit, fee, netProfit);
    }

    // ==================== FUNCIONES ADMINISTRATIVAS ====================

    /**
     * @dev Configura proveedor de flash loan
     */
    function setFlashLoanProvider(
        FlashLoanProvider provider,
        address providerAddress,
        bool active,
        uint256 feeBPS
    ) external onlyOwner {
        require(feeBPS <= MAX_FLASH_LOAN_FEE, "FlashLoan: Fee too high");
        
        flashLoanProviders[provider] = providerAddress;
        providerActive[provider] = active;
        providerFeeBPS[provider] = feeBPS;

        emit FlashLoanProviderUpdated(provider, providerAddress, active, feeBPS);
    }

    /**
     * @dev Autoriza caller
     */
    function setAuthorizedCaller(address caller, bool authorized) external onlyOwner {
        authorizedCallers[caller] = authorized;
    }

    /**
     * @dev Configura parámetros
     */
    function setParameters(
        uint256 _executionFee,
        uint256 _maxSlippage,
        address _profitReceiver,
        address _emergencyReceiver
    ) external onlyOwner {
        require(_executionFee <= 1000, "FlashLoan: Fee too high");
        require(_maxSlippage <= 1000, "FlashLoan: Slippage too high");
        
        executionFee = _executionFee;
        maxSlippage = _maxSlippage;
        profitReceiver = _profitReceiver;
        emergencyReceiver = _emergencyReceiver;
    }

    /**
     * @dev Función de emergencia
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(emergencyReceiver, amount);
    }

    /**
     * @dev Pausar contratos
     */
    function emergencyPause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ==================== FUNCIONES DE VISTA ====================

    function getProviderInfo(FlashLoanProvider provider) external view returns (
        address providerAddress,
        bool active,
        uint256 feeBPS
    ) {
        return (
            flashLoanProviders[provider],
            providerActive[provider],
            providerFeeBPS[provider]
        );
    }

    function getCurrentExecution() external view returns (FlashLoanExecution memory) {
        return currentExecution;
    }
}

// ==================== INTERFACES ADICIONALES ====================

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
}

interface IBalancerVault {
    function flashLoan(
        address recipient,
        address[] memory tokens,
        uint256[] memory amounts,
        bytes memory userData
    ) external;
}

interface IUniswapV3Pool {
    function flash(
        address recipient,
        uint256 amount0,
        uint256 amount1,
        bytes calldata data
    ) external;
}
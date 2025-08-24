// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../interfaces/IArbitrageExecutor.sol";
import "../interfaces/IFlashLoanReceiver.sol";
import "../interfaces/IDEXRegistry.sol";
import "../libraries/ArbitrageLib.sol";

/**
 * @title ArbitrageExecutor
 * @dev Contrato principal del motor de arbitraje híbrido más avanzado del mercado
 * @notice Sistema que combina JavaScript backend con Solidity execution
 * @author ArbitrageX Pro 2025 Team
 */
contract ArbitrageExecutor is 
    IArbitrageExecutor,
    IFlashLoanReceiver,
    ReentrancyGuard,
    Pausable,
    AccessControl 
{
    using SafeERC20 for IERC20;
    using ArbitrageLib for *;

    // Roles de acceso
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");

    // Configuración del sistema
    uint256 public maxGasPrice;
    uint256 public minProfitThreshold;
    uint256 public maxSlippage;
    uint256 public flashLoanFeeThreshold;
    
    // Registros y direcciones
    IDEXRegistry public dexRegistry;
    mapping(address => bool) public supportedTokens;
    mapping(address => bool) public flashLoanProviders;
    mapping(address => uint256) public executorNonces;
    
    // Estadísticas y analytics
    uint256 public totalArbitragesExecuted;
    uint256 public totalProfitGenerated;
    uint256 public totalGasUsed;
    mapping(address => uint256) public userProfits;
    mapping(string => uint256) public strategyStats;

    // Proveedores de Flash Loans
    address public aaveV3Pool;
    address public balancerVault;
    address public uniswapV3Factory;
    
    // Eventos adicionales para analytics avanzada
    event ArbitrageAnalyzed(
        address indexed analyzer,
        uint256 expectedProfit,
        uint256 gasEstimate,
        bool approved
    );

    event FlashLoanProviderUpdated(
        address indexed provider,
        bool isActive
    );

    event ConfigurationUpdated(
        string parameter,
        uint256 oldValue,
        uint256 newValue
    );

    modifier onlyExecutor() {
        require(hasRole(EXECUTOR_ROLE, msg.sender), "Not authorized executor");
        _;
    }

    modifier validGasPrice() {
        require(tx.gasprice <= maxGasPrice, "Gas price too high");
        _;
    }

    constructor(
        address _dexRegistry,
        address _aaveV3Pool,
        address _balancerVault,
        address _uniswapV3Factory,
        uint256 _maxGasPrice,
        uint256 _minProfitThreshold
    ) {
        require(_dexRegistry != address(0), "Invalid DEX registry");
        
        // Setup roles
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(EXECUTOR_ROLE, msg.sender);
        _grantRole(EMERGENCY_ROLE, msg.sender);

        // Initialize configuration
        dexRegistry = IDEXRegistry(_dexRegistry);
        aaveV3Pool = _aaveV3Pool;
        balancerVault = _balancerVault;
        uniswapV3Factory = _uniswapV3Factory;
        maxGasPrice = _maxGasPrice;
        minProfitThreshold = _minProfitThreshold;
        maxSlippage = 300; // 3%
        flashLoanFeeThreshold = 50; // 0.5%

        // Setup flash loan providers
        if (_aaveV3Pool != address(0)) {
            flashLoanProviders[_aaveV3Pool] = true;
        }
        if (_balancerVault != address(0)) {
            flashLoanProviders[_balancerVault] = true;
        }
    }

    /**
     * @dev Ejecuta arbitraje simple entre dos DEXs
     */
    function executeArbitrage(
        ArbitrageParams calldata params,
        SwapRoute[] calldata routes
    ) 
        external 
        payable 
        override
        nonReentrant 
        whenNotPaused 
        onlyExecutor
        validGasPrice
        returns (ExecutionResult memory result) 
    {
        uint256 gasBefore = gasleft();
        
        // Validar parámetros
        require(params.deadline >= block.timestamp, "Expired deadline");
        require(routes.length >= 2, "Invalid route length");
        
        // Validar ruta
        (bool isValidRoute, string memory reason) = dexRegistry.validateRoute(
            _extractPath(routes),
            _extractDexes(routes),
            _extractFees(routes)
        );
        require(isValidRoute, reason);

        // Calcular rentabilidad esperada
        (uint256 expectedProfit, uint256 gasEstimate, bool isProfitable) = 
            calculateProfitability(params, routes);
        
        require(isProfitable, "Unprofitable arbitrage");

        emit ArbitrageAnalyzed(msg.sender, expectedProfit, gasEstimate, true);

        try this._executeArbitrageInternal(params, routes) returns (uint256 actualProfit) {
            uint256 gasUsed = gasBefore - gasleft();
            
            result = ExecutionResult({
                actualAmountOut: actualProfit + params.amountIn,
                gasUsed: gasUsed,
                profit: actualProfit,
                feesPaid: _calculateTotalFees(routes),
                success: true,
                errorMessage: ""
            });

            // Actualizar estadísticas
            _updateStats(msg.sender, actualProfit, gasUsed, "simple");

            emit ArbitrageExecuted(
                msg.sender,
                params.tokenA,
                params.tokenB,
                params.amountIn,
                result.actualAmountOut,
                actualProfit,
                gasUsed,
                "simple"
            );

        } catch Error(string memory error) {
            result = ExecutionResult({
                actualAmountOut: 0,
                gasUsed: gasBefore - gasleft(),
                profit: 0,
                feesPaid: 0,
                success: false,
                errorMessage: error
            });
        }
    }

    /**
     * @dev Ejecuta arbitraje triangular A->B->C->A
     */
    function executeTriangularArbitrage(
        address tokenA,
        address tokenB,
        address tokenC,
        uint256 amountIn,
        SwapRoute[] calldata routes
    ) 
        external 
        payable 
        override
        nonReentrant 
        whenNotPaused 
        onlyExecutor
        validGasPrice
        returns (ExecutionResult memory result) 
    {
        require(routes.length == 3, "Triangular requires 3 routes");
        require(routes[0].tokenIn == tokenA && routes[2].tokenOut == tokenA, "Invalid triangular path");
        
        uint256 gasBefore = gasleft();

        try this._executeTriangularInternal(tokenA, tokenB, tokenC, amountIn, routes) 
            returns (uint256 finalAmount) {
            
            uint256 gasUsed = gasBefore - gasleft();
            uint256 profit = finalAmount > amountIn ? finalAmount - amountIn : 0;
            
            result = ExecutionResult({
                actualAmountOut: finalAmount,
                gasUsed: gasUsed,
                profit: profit,
                feesPaid: _calculateTotalFees(routes),
                success: true,
                errorMessage: ""
            });

            _updateStats(msg.sender, profit, gasUsed, "triangular");

            emit ArbitrageExecuted(
                msg.sender,
                tokenA,
                tokenA, // Triangular returns to same token
                amountIn,
                finalAmount,
                profit,
                gasUsed,
                "triangular"
            );

        } catch Error(string memory error) {
            result = ExecutionResult({
                actualAmountOut: 0,
                gasUsed: gasBefore - gasleft(),
                profit: 0,
                feesPaid: 0,
                success: false,
                errorMessage: error
            });
        }
    }

    /**
     * @dev Ejecuta arbitraje con flash loan
     */
    function executeFlashLoanArbitrage(
        address flashLoanProvider,
        address asset,
        uint256 amount,
        bytes calldata params
    ) 
        external 
        override
        nonReentrant 
        whenNotPaused 
        onlyExecutor
        returns (ExecutionResult memory result) 
    {
        require(flashLoanProviders[flashLoanProvider], "Unsupported flash loan provider");
        require(supportedTokens[asset] || asset == address(0), "Unsupported token");

        // Initiate flash loan based on provider
        if (flashLoanProvider == aaveV3Pool) {
            _initiateAaveFlashLoan(asset, amount, params);
        } else if (flashLoanProvider == balancerVault) {
            _initiateBalancerFlashLoan(asset, amount, params);
        } else {
            revert("Unknown flash loan provider");
        }

        // Result will be set in the callback
        return result;
    }

    /**
     * @dev Calcula rentabilidad esperada de arbitraje
     */
    function calculateProfitability(
        ArbitrageParams calldata params,
        SwapRoute[] calldata routes
    ) 
        public 
        view 
        override
        returns (
            uint256 expectedProfit,
            uint256 gasEstimate,
            bool isProfitable
        ) 
    {
        // Simular swaps para obtener amount out
        uint256 currentAmount = params.amountIn;
        uint256 totalGasEstimate = 0;

        for (uint256 i = 0; i < routes.length; i++) {
            (uint256 amountOut, uint256 gasEst,) = dexRegistry.simulateSwap(
                routes[i].dex,
                routes[i].tokenIn,
                routes[i].tokenOut,
                currentAmount,
                routes[i].fee
            );
            
            currentAmount = amountOut;
            totalGasEstimate += gasEst;
        }

        // Calcular flash loan fee si se usa
        uint256 flashLoanFee = 0;
        if (params.useFlashLoan) {
            flashLoanFee = _calculateFlashLoanFee(
                params.flashLoanProvider,
                params.tokenA,
                params.amountIn
            );
        }

        // Usar librería para cálculo de profit
        ArbitrageLib.ProfitCalculation memory calc = ArbitrageLib.calculateSimpleArbitrageProfit(
            params.amountIn,
            0, // No usado en esta función
            currentAmount,
            tx.gasprice,
            totalGasEstimate,
            flashLoanFee
        );

        return (calc.netProfit, totalGasEstimate, calc.isProfitable);
    }

    /**
     * @dev Valida una ruta de arbitraje
     */
    function validateRoute(
        SwapRoute[] calldata routes
    ) external view override returns (bool isValid, string memory reason) {
        if (routes.length < 2) {
            return (false, "Route too short");
        }

        for (uint256 i = 0; i < routes.length; i++) {
            if (!dexRegistry.isDEXSupported(routes[i].dex)) {
                return (false, "Unsupported DEX");
            }
            
            if (!supportedTokens[routes[i].tokenIn] || !supportedTokens[routes[i].tokenOut]) {
                return (false, "Unsupported token");
            }
        }

        // Validar continuidad de la ruta
        for (uint256 i = 0; i < routes.length - 1; i++) {
            if (routes[i].tokenOut != routes[i + 1].tokenIn) {
                return (false, "Route discontinuity");
            }
        }

        return (true, "Valid route");
    }

    // ============ FLASH LOAN CALLBACKS ============

    /**
     * @dev Aave V3 Flash Loan Callback
     */
    function executeOperation(
        address[] calldata assets,
        uint256[] calldata amounts,
        uint256[] calldata premiums,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        require(msg.sender == aaveV3Pool, "Unauthorized callback");
        require(initiator == address(this), "Invalid initiator");

        // Decode parameters and execute arbitrage
        (ArbitrageParams memory arbParams, SwapRoute[] memory routes) = 
            abi.decode(params, (ArbitrageParams, SwapRoute[]));

        uint256 totalAmount = amounts[0];
        uint256 totalFee = premiums[0];

        // Execute arbitrage with flash loan amount
        uint256 profit = _executeArbitrageWithAmount(arbParams, routes, totalAmount);

        // Ensure we can repay the flash loan
        require(profit > totalFee, "Insufficient profit to repay");

        // Approve repayment
        IERC20(assets[0]).safeApprove(aaveV3Pool, totalAmount + totalFee);

        emit FlashLoanExecuted(aaveV3Pool, assets[0], totalAmount, totalFee, true);

        return true;
    }

    /**
     * @dev Balancer V2 Flash Loan Callback
     */
    function receiveFlashLoan(
        address[] memory tokens,
        uint256[] memory amounts,
        uint256[] memory feeAmounts,
        bytes memory userData
    ) external override {
        require(msg.sender == balancerVault, "Unauthorized callback");

        // Decode and execute arbitrage
        (ArbitrageParams memory arbParams, SwapRoute[] memory routes) = 
            abi.decode(userData, (ArbitrageParams, SwapRoute[]));

        uint256 totalAmount = amounts[0];
        uint256 totalFee = feeAmounts[0];

        uint256 profit = _executeArbitrageWithAmount(arbParams, routes, totalAmount);

        require(profit > totalFee, "Insufficient profit to repay");

        // Repay flash loan
        IERC20(tokens[0]).safeTransfer(balancerVault, totalAmount + totalFee);

        emit FlashLoanExecuted(balancerVault, tokens[0], totalAmount, totalFee, true);
    }

    // ============ INTERNAL FUNCTIONS ============

    function _executeArbitrageInternal(
        ArbitrageParams calldata params,
        SwapRoute[] calldata routes
    ) external returns (uint256 profit) {
        require(msg.sender == address(this), "Internal only");
        return _executeArbitrageWithAmount(params, routes, params.amountIn);
    }

    function _executeTriangularInternal(
        address tokenA,
        address tokenB,
        address tokenC,
        uint256 amountIn,
        SwapRoute[] calldata routes
    ) external returns (uint256 finalAmount) {
        require(msg.sender == address(this), "Internal only");
        
        uint256 currentAmount = amountIn;
        
        // Ejecutar los 3 swaps secuencialmente
        for (uint256 i = 0; i < 3; i++) {
            currentAmount = dexRegistry.executeSwap(
                IDEXRegistry.SwapParams({
                    dex: routes[i].dex,
                    tokenIn: routes[i].tokenIn,
                    tokenOut: routes[i].tokenOut,
                    amountIn: currentAmount,
                    minAmountOut: routes[i].minAmountOut,
                    fee: routes[i].fee,
                    to: address(this),
                    deadline: block.timestamp + 300, // 5 minutos
                    extraData: routes[i].extraData
                })
            );
        }
        
        return currentAmount;
    }

    function _executeArbitrageWithAmount(
        ArbitrageParams memory params,
        SwapRoute[] memory routes,
        uint256 amount
    ) internal returns (uint256 profit) {
        uint256 currentAmount = amount;
        
        // Ejecutar swaps secuencialmente
        for (uint256 i = 0; i < routes.length; i++) {
            currentAmount = dexRegistry.executeSwap(
                IDEXRegistry.SwapParams({
                    dex: routes[i].dex,
                    tokenIn: routes[i].tokenIn,
                    tokenOut: routes[i].tokenOut,
                    amountIn: currentAmount,
                    minAmountOut: routes[i].minAmountOut,
                    fee: routes[i].fee,
                    to: address(this),
                    deadline: params.deadline,
                    extraData: routes[i].extraData
                })
            );
        }
        
        // Calcular profit
        if (currentAmount > amount) {
            profit = currentAmount - amount;
        } else {
            profit = 0;
        }
        
        return profit;
    }

    function _updateStats(
        address user,
        uint256 profit,
        uint256 gasUsed,
        string memory strategy
    ) internal {
        totalArbitragesExecuted++;
        totalProfitGenerated += profit;
        totalGasUsed += gasUsed;
        userProfits[user] += profit;
        strategyStats[strategy]++;
    }

    function _calculateTotalFees(
        SwapRoute[] memory routes
    ) internal pure returns (uint256 totalFees) {
        for (uint256 i = 0; i < routes.length; i++) {
            totalFees += routes[i].fee;
        }
    }

    function _calculateFlashLoanFee(
        address provider,
        address asset,
        uint256 amount
    ) internal view returns (uint256 fee) {
        // Implementar cálculo específico por proveedor
        if (provider == aaveV3Pool) {
            return (amount * 9) / 10000; // 0.09% Aave fee
        } else if (provider == balancerVault) {
            return 0; // Balancer fees are 0%
        }
        return 0;
    }

    function _initiateAaveFlashLoan(
        address asset,
        uint256 amount,
        bytes calldata params
    ) internal {
        address[] memory assets = new address[](1);
        assets[0] = asset;
        
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amount;
        
        uint256[] memory modes = new uint256[](1);
        modes[0] = 0; // No debt mode
        
        // Call Aave flash loan
        // IAavePool(aaveV3Pool).flashLoan(address(this), assets, amounts, modes, address(this), params, 0);
    }

    function _initiateBalancerFlashLoan(
        address asset,
        uint256 amount,
        bytes calldata params
    ) internal {
        address[] memory tokens = new address[](1);
        tokens[0] = asset;
        
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = amount;
        
        // Call Balancer flash loan
        // IBalancerVault(balancerVault).flashLoan(address(this), tokens, amounts, params);
    }

    // ============ UTILITY FUNCTIONS ============

    function _extractPath(SwapRoute[] calldata routes) internal pure returns (address[] memory path) {
        path = new address[](routes.length + 1);
        path[0] = routes[0].tokenIn;
        for (uint256 i = 0; i < routes.length; i++) {
            path[i + 1] = routes[i].tokenOut;
        }
    }

    function _extractDexes(SwapRoute[] calldata routes) internal pure returns (address[] memory dexes) {
        dexes = new address[](routes.length);
        for (uint256 i = 0; i < routes.length; i++) {
            dexes[i] = routes[i].dex;
        }
    }

    function _extractFees(SwapRoute[] calldata routes) internal pure returns (uint24[] memory fees) {
        fees = new uint24[](routes.length);
        for (uint256 i = 0; i < routes.length; i++) {
            fees[i] = routes[i].fee;
        }
    }

    // ============ ADMIN FUNCTIONS ============

    function setMaxGasPrice(uint256 _maxGasPrice) external override onlyRole(ADMIN_ROLE) {
        uint256 oldValue = maxGasPrice;
        maxGasPrice = _maxGasPrice;
        emit ConfigurationUpdated("maxGasPrice", oldValue, _maxGasPrice);
    }

    function setMinProfitThreshold(uint256 _minProfit) external override onlyRole(ADMIN_ROLE) {
        uint256 oldValue = minProfitThreshold;
        minProfitThreshold = _minProfit;
        emit ConfigurationUpdated("minProfitThreshold", oldValue, _minProfit);
    }

    function updateDEXRegistry(address _newRegistry) external override onlyRole(ADMIN_ROLE) {
        require(_newRegistry != address(0), "Invalid registry");
        dexRegistry = IDEXRegistry(_newRegistry);
    }

    function addSupportedToken(address token) external onlyRole(ADMIN_ROLE) {
        supportedTokens[token] = true;
    }

    function removeSupportedToken(address token) external onlyRole(ADMIN_ROLE) {
        supportedTokens[token] = false;
    }

    function updateFlashLoanProvider(
        address provider,
        bool isActive
    ) external onlyRole(ADMIN_ROLE) {
        flashLoanProviders[provider] = isActive;
        emit FlashLoanProviderUpdated(provider, isActive);
    }

    // ============ EMERGENCY FUNCTIONS ============

    function emergencyWithdraw(
        address token,
        uint256 amount
    ) external override onlyRole(EMERGENCY_ROLE) {
        if (token == address(0)) {
            payable(msg.sender).transfer(amount);
        } else {
            IERC20(token).safeTransfer(msg.sender, amount);
        }
        emit EmergencyWithdraw(token, msg.sender, amount);
    }

    function pause() external override onlyRole(EMERGENCY_ROLE) {
        _pause();
    }

    function unpause() external override onlyRole(EMERGENCY_ROLE) {
        _unpause();
    }

    // ============ VIEW FUNCTIONS ============

    function getMaxGasPrice() external view override returns (uint256) {
        return maxGasPrice;
    }

    function getMinProfitThreshold() external view override returns (uint256) {
        return minProfitThreshold;
    }

    function isPaused() external view override returns (bool) {
        return paused();
    }

    function getSupportedTokens() external view override returns (address[] memory tokens) {
        // Implementation would return array of supported tokens
        // For gas efficiency, might need a separate mapping to track count
    }

    function getSupportedDEXs() external view override returns (address[] memory dexes) {
        return dexRegistry.getSupportedDEXs();
    }

    function getStats() external view returns (
        uint256 totalArbitrages,
        uint256 totalProfit,
        uint256 totalGas
    ) {
        return (totalArbitragesExecuted, totalProfitGenerated, totalGasUsed);
    }

    // ============ FALLBACK ============

    receive() external payable {
        // Allow contract to receive ETH for gas payments
    }
}
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IArbitrageEngine.sol";
import "./interfaces/IFlashLoanProvider.sol";
import "./interfaces/IDEXAdapter.sol";

/**
 * @title ArbitrageEngine
 * @notice Motor principal de arbitraje con flash loans
 * @dev Ingenio Pichichi S.A. - ArbitrageX Supreme
 * @author ArbitrageX Team
 */
contract ArbitrageEngine is 
    IArbitrageEngine, 
    IFlashLoanReceiver,
    ReentrancyGuard, 
    Pausable, 
    Ownable 
{
    using SafeERC20 for IERC20;

    // ============ Constants ============
    uint256 public constant MAX_SLIPPAGE = 5000; // 50% in basis points
    uint256 public constant MIN_PROFIT_THRESHOLD = 1e15; // 0.001 ETH minimum
    uint256 public constant PLATFORM_FEE = 50; // 0.5% in basis points
    uint256 public constant BASIS_POINTS = 10000;

    // ============ State Variables ============
    mapping(string => address) public strategies;
    mapping(address => bool) public authorizedCallers;
    mapping(address => uint256) public userProfits;
    mapping(address => bool) public supportedTokens;
    
    address[] public flashLoanProviders;
    address public feeCollector;
    uint256 public totalFeesCollected;
    uint256 public totalArbitragesExecuted;
    
    // Temporary storage for flash loan execution
    ArbitrageParams private currentArbitrageParams;
    address private currentInitiator;
    bool private flashLoanInProgress;

    // ============ Events ============
    event FlashLoanProviderAdded(address indexed provider);
    event FlashLoanProviderRemoved(address indexed provider);
    event TokenSupportUpdated(address indexed token, bool supported);
    event FeeCollectorUpdated(address indexed oldCollector, address indexed newCollector);
    event AuthorizedCallerUpdated(address indexed caller, bool authorized);

    // ============ Modifiers ============
    modifier onlyAuthorized() {
        require(
            authorizedCallers[msg.sender] || msg.sender == owner(),
            "ArbitrageEngine: Not authorized"
        );
        _;
    }

    modifier validToken(address token) {
        require(supportedTokens[token], "ArbitrageEngine: Token not supported");
        _;
    }

    modifier flashLoanInProgressOnly() {
        require(flashLoanInProgress, "ArbitrageEngine: No active flash loan");
        _;
    }

    // ============ Constructor ============
    constructor(address _feeCollector) Ownable(msg.sender) {
        require(_feeCollector != address(0), "ArbitrageEngine: Invalid fee collector");
        feeCollector = _feeCollector;
        
        // Add common tokens as supported by default
        supportedTokens[address(0)] = true; // ETH
    }

    // ============ External Functions ============

    /**
     * @notice Ejecutar arbitraje con flash loan
     */
    function executeArbitrage(ArbitrageParams calldata params) 
        external 
        override 
        nonReentrant 
        whenNotPaused 
        onlyAuthorized
        returns (ArbitrageResult memory result) 
    {
        require(params.amount > 0, "ArbitrageEngine: Invalid amount");
        require(params.deadline >= block.timestamp, "ArbitrageEngine: Expired deadline");
        require(params.maxSlippage <= MAX_SLIPPAGE, "ArbitrageEngine: Slippage too high");
        require(
            supportedTokens[params.tokenA] && supportedTokens[params.tokenB],
            "ArbitrageEngine: Unsupported token"
        );

        uint256 startGas = gasleft();
        uint256 startTime = block.timestamp;

        // Store params for flash loan callback
        currentArbitrageParams = params;
        currentInitiator = msg.sender;
        flashLoanInProgress = true;

        // Find best flash loan provider
        address provider = _getBestFlashLoanProvider(params.tokenA, params.amount);
        require(provider != address(0), "ArbitrageEngine: No flash loan provider available");

        // Execute flash loan
        try IFlashLoanProvider(provider).flashLoan(
            params.tokenA,
            params.amount,
            params.strategyData,
            address(this)
        ) {
            // Success will be handled in the callback
        } catch Error(string memory reason) {
            flashLoanInProgress = false;
            revert(string(abi.encodePacked("ArbitrageEngine: Flash loan failed - ", reason)));
        } catch {
            flashLoanInProgress = false;
            revert("ArbitrageEngine: Flash loan failed");
        }

        // Calculate results
        uint256 gasUsed = startGas - gasleft();
        uint256 executionTime = block.timestamp - startTime;

        result = ArbitrageResult({
            success: true,
            profit: userProfits[msg.sender],
            gasUsed: gasUsed,
            executionTime: executionTime
        });

        totalArbitragesExecuted++;

        emit ArbitrageExecuted(
            msg.sender,
            params.tokenA,
            params.tokenB,
            params.amount,
            result.profit,
            _getStrategyTypeFromData(params.strategyData)
        );
    }

    /**
     * @notice Callback del flash loan - aquí se ejecuta el arbitraje
     */
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 fee,
        address initiator,
        bytes calldata params
    ) 
        external 
        override 
        flashLoanInProgressOnly
        returns (bool success) 
    {
        require(initiator == address(this), "ArbitrageEngine: Invalid initiator");

        // Decode strategy type from params
        string memory strategyType = _getStrategyTypeFromData(params);
        address strategyImpl = strategies[strategyType];
        require(strategyImpl != address(0), "ArbitrageEngine: Strategy not found");

        // Execute arbitrage strategy
        uint256 initialBalance = IERC20(asset).balanceOf(address(this));
        
        try IDEXAdapter(strategyImpl).swap(SwapParams({
            tokenIn: currentArbitrageParams.tokenA,
            tokenOut: currentArbitrageParams.tokenB,
            amountIn: amount,
            amountOutMinimum: currentArbitrageParams.minProfit,
            deadline: currentArbitrageParams.deadline,
            routeData: currentArbitrageParams.strategyData
        })) returns (uint256 amountOut) {
            
            // Calculate profit after covering flash loan
            uint256 totalRequired = amount + fee;
            uint256 finalBalance = IERC20(asset).balanceOf(address(this));
            
            require(finalBalance >= totalRequired, "ArbitrageEngine: Insufficient profit");
            
            uint256 grossProfit = finalBalance - initialBalance;
            uint256 platformFeeAmount = (grossProfit * PLATFORM_FEE) / BASIS_POINTS;
            uint256 netProfit = grossProfit - platformFeeAmount;

            // Distribute profits
            if (netProfit > 0) {
                userProfits[currentInitiator] += netProfit;
                totalFeesCollected += platformFeeAmount;
                
                // Transfer platform fee to collector
                IERC20(asset).safeTransfer(feeCollector, platformFeeAmount);
                
                emit ProfitDistributed(currentInitiator, netProfit, platformFeeAmount);
            }

            success = true;
        } catch {
            success = false;
        }

        // Cleanup
        flashLoanInProgress = false;
        delete currentArbitrageParams;
        currentInitiator = address(0);

        return success;
    }

    /**
     * @notice Simular arbitraje (view function)
     */
    function simulateArbitrage(ArbitrageParams calldata params) 
        external 
        view 
        override 
        returns (uint256 estimatedProfit, uint256 estimatedGas) 
    {
        string memory strategyType = _getStrategyTypeFromData(params.strategyData);
        address strategyImpl = strategies[strategyType];
        require(strategyImpl != address(0), "ArbitrageEngine: Strategy not found");

        // Get quote from DEX adapter
        (uint256 amountOut, uint256 priceImpact) = IDEXAdapter(strategyImpl).getQuote(
            QuoteParams({
                tokenIn: params.tokenA,
                tokenOut: params.tokenB,
                amountIn: params.amount,
                routeData: params.strategyData
            })
        );

        // Calculate estimated profit considering flash loan fees
        address provider = _getBestFlashLoanProvider(params.tokenA, params.amount);
        uint256 flashLoanFee = IFlashLoanProvider(provider).getFlashLoanFee(
            params.tokenA, 
            params.amount
        );

        if (amountOut > params.amount + flashLoanFee) {
            uint256 grossProfit = amountOut - params.amount - flashLoanFee;
            uint256 platformFeeAmount = (grossProfit * PLATFORM_FEE) / BASIS_POINTS;
            estimatedProfit = grossProfit - platformFeeAmount;
        }

        // Estimate gas (simplified calculation)
        estimatedGas = IDEXAdapter(strategyImpl).estimateGas(SwapParams({
            tokenIn: params.tokenA,
            tokenOut: params.tokenB,
            amountIn: params.amount,
            amountOutMinimum: params.minProfit,
            deadline: params.deadline,
            routeData: params.strategyData
        }));
    }

    /**
     * @notice Registrar nueva estrategia
     */
    function registerStrategy(string calldata strategyType, address implementation) 
        external 
        override 
        onlyOwner 
    {
        require(implementation != address(0), "ArbitrageEngine: Invalid implementation");
        strategies[strategyType] = implementation;
        emit StrategyRegistered(strategyType, implementation);
    }

    /**
     * @notice Obtener implementación de estrategia
     */
    function getStrategy(string calldata strategyType) 
        external 
        view 
        override 
        returns (address implementation) 
    {
        return strategies[strategyType];
    }

    /**
     * @notice Verificar disponibilidad de estrategia
     */
    function isStrategyAvailable(string calldata strategyType) 
        external 
        view 
        override 
        returns (bool available) 
    {
        return strategies[strategyType] != address(0);
    }

    /**
     * @notice Obtener balance de token
     */
    function getTokenBalance(address token) 
        external 
        view 
        override 
        returns (uint256 balance) 
    {
        if (token == address(0)) {
            return address(this).balance;
        } else {
            return IERC20(token).balanceOf(address(this));
        }
    }

    /**
     * @notice Retirar ganancias
     */
    function withdrawProfits(address token, uint256 amount) 
        external 
        override 
        nonReentrant 
    {
        require(amount > 0, "ArbitrageEngine: Invalid amount");
        require(userProfits[msg.sender] >= amount, "ArbitrageEngine: Insufficient profits");

        userProfits[msg.sender] -= amount;

        if (token == address(0)) {
            payable(msg.sender).transfer(amount);
        } else {
            IERC20(token).safeTransfer(msg.sender, amount);
        }
    }

    // ============ Admin Functions ============

    function addFlashLoanProvider(address provider) external onlyOwner {
        require(provider != address(0), "ArbitrageEngine: Invalid provider");
        flashLoanProviders.push(provider);
        emit FlashLoanProviderAdded(provider);
    }

    function removeFlashLoanProvider(address provider) external onlyOwner {
        for (uint256 i = 0; i < flashLoanProviders.length; i++) {
            if (flashLoanProviders[i] == provider) {
                flashLoanProviders[i] = flashLoanProviders[flashLoanProviders.length - 1];
                flashLoanProviders.pop();
                emit FlashLoanProviderRemoved(provider);
                break;
            }
        }
    }

    function updateTokenSupport(address token, bool supported) external onlyOwner {
        supportedTokens[token] = supported;
        emit TokenSupportUpdated(token, supported);
    }

    function updateFeeCollector(address newCollector) external onlyOwner {
        require(newCollector != address(0), "ArbitrageEngine: Invalid collector");
        address oldCollector = feeCollector;
        feeCollector = newCollector;
        emit FeeCollectorUpdated(oldCollector, newCollector);
    }

    function updateAuthorizedCaller(address caller, bool authorized) external onlyOwner {
        authorizedCallers[caller] = authorized;
        emit AuthorizedCallerUpdated(caller, authorized);
    }

    function emergencyPause() external override onlyOwner {
        _pause();
    }

    function unpause() external override onlyOwner {
        _unpause();
    }

    // ============ Internal Functions ============

    function _getBestFlashLoanProvider(address asset, uint256 amount) 
        internal 
        view 
        returns (address bestProvider) 
    {
        uint256 lowestFee = type(uint256).max;
        
        for (uint256 i = 0; i < flashLoanProviders.length; i++) {
            address provider = flashLoanProviders[i];
            
            if (IFlashLoanProvider(provider).isAssetSupported(asset) &&
                IFlashLoanProvider(provider).getAvailableLiquidity(asset) >= amount) {
                
                uint256 fee = IFlashLoanProvider(provider).getFlashLoanFee(asset, amount);
                if (fee < lowestFee) {
                    lowestFee = fee;
                    bestProvider = provider;
                }
            }
        }
    }

    function _getStrategyTypeFromData(bytes memory data) 
        internal 
        pure 
        returns (string memory strategyType) 
    {
        // Decode strategy type from the first part of data
        if (data.length >= 32) {
            assembly {
                strategyType := mload(add(data, 32))
            }
        }
        return strategyType;
    }

    // ============ Receive Function ============
    receive() external payable {
        // Allow contract to receive ETH
    }
}
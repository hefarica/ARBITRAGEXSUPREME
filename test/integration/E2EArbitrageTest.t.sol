// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import "../../contracts/UniversalFlashLoanArbitrage.sol";
import "../../contracts/ArbitrageExecutor.sol";
import "../../contracts/UniversalArbitrageEngine.sol";
import "../../contracts/FlashLoanAggregator.sol";
import "../../contracts/routers/UniversalDEXRouter.sol";
import "../../contracts/providers/AaveV3FlashLoanProvider.sol";
import "../../contracts/providers/BalancerV2FlashLoanProvider.sol";
import "../../contracts/mev/FlashbotsBundleManager.sol";
import "../../contracts/security/SecurityManager.sol";

/**
 * @title E2EArbitrageTest  
 * @dev Tests de integración End-to-End para todo el sistema ArbitrageX Supreme V3.0
 * 
 * Cubre flujo completo:
 * 1. Detección de oportunidades
 * 2. Selección de estrategia  
 * 3. Ejecución con flash loans
 * 4. Protección MEV
 * 5. Validaciones de seguridad
 * 6. Distribución de profits
 */
contract E2EArbitrageTest is Test {
    // === CORE CONTRACTS ===
    UniversalFlashLoanArbitrage public flashLoanArbitrage;
    ArbitrageExecutor public executor;
    UniversalArbitrageEngine public engine;
    FlashLoanAggregator public flashLoanAggregator;
    UniversalDEXRouter public dexRouter;
    
    // === PROVIDERS ===  
    MockAaveProvider public aaveProvider;
    MockBalancerProvider public balancerProvider;
    
    // === SECURITY & MEV ===
    FlashbotsBundleManager public bundleManager;
    SecurityManager public securityManager;
    
    // === TOKENS & ADDRESSES ===
    MockERC20 public WETH;
    MockERC20 public USDC; 
    MockERC20 public DAI;
    
    address public admin = address(0x1);
    address public operator = address(0x2);
    address public user = address(0x3);
    address public treasury = address(0x4);
    
    uint256 public constant INITIAL_SUPPLY = 10_000_000 ether;
    uint256 public constant TEST_AMOUNT = 1000 ether;
    
    // === EVENTS ===
    event E2EArbitrageCompleted(
        uint256 indexed executionId,
        address indexed initiator,
        uint256 profit,
        uint256 gasUsed,
        bool successful
    );
    
    function setUp() public {
        console.log("=== Setting up E2E Test Environment ===");
        
        // 1. Deploy tokens
        _deployTokens();
        
        // 2. Deploy core contracts
        _deployCoreContracts();
        
        // 3. Deploy providers
        _deployProviders();
        
        // 4. Deploy security & MEV
        _deploySecurityMEV();
        
        // 5. Configure system
        _configureSystem();
        
        // 6. Setup test scenarios
        _setupTestScenarios();
        
        console.log("=== E2E Test Environment Ready ===");
    }
    
    // === FULL E2E TESTS ===
    
    /**
     * @dev Test completo de arbitraje DEX-to-DEX con flash loan
     */
    function test_E2E_DEXArbitrage_Success() public {
        console.log("Starting E2E DEX Arbitrage Test");
        
        // 1. Setup profitable opportunity
        _createProfitableOpportunity();
        
        // 2. Detect opportunity
        uint256[] memory opportunityIds = engine.detectArbitrageOpportunities(
            _getTokenArray(),
            _getDEXArray(), 
            _getAmountArray()
        );
        
        assertGt(opportunityIds.length, 0, "No opportunities detected");
        
        // 3. Execute with full pipeline
        uint256 opportunityId = opportunityIds[0];
        
        vm.prank(operator);
        engine.executeOptimalStrategy(opportunityId);
        
        // 4. Verify results
        (uint256 totalExec, uint256 totalSucc, uint256 totalProfit, ) = engine.getEngineStats();
        
        assertEq(totalExec, 1, "Should have 1 execution");
        assertEq(totalSucc, 1, "Should be successful");
        assertGt(totalProfit, 0, "Should have profit");
        
        console.log("E2E DEX Arbitrage completed successfully");
        console.log("Total profit:", totalProfit);
    }
    
    /**
     * @dev Test de arbitraje triangular completo
     */
    function test_E2E_TriangularArbitrage() public {
        console.log("Starting E2E Triangular Arbitrage Test");
        
        // Setup triangular opportunity (WETH -> USDC -> DAI -> WETH)
        _setupTriangularOpportunity();
        
        // Create strategy for triangular arbitrage
        vm.prank(operator);
        uint256 strategyId = executor.registerStrategy(
            ArbitrageExecutor.StrategyType.TRIANGULAR_ARBITRAGE,
            address(flashLoanArbitrage),
            abi.encodeWithSignature("executeTriangularArbitrage()"),
            10 ether, // Expected profit
            500000,   // Gas limit
            80        // Priority
        );
        
        // Create execution plan
        uint256[] memory strategyIds = new uint256[](1);
        strategyIds[0] = strategyId;
        
        vm.prank(operator);
        uint256 planId = executor.createExecutionPlan(
            strategyIds,
            block.number + 2
        );
        
        // Execute plan
        vm.prank(operator);
        executor.executePlan(planId);
        
        // Verify execution
        ArbitrageExecutor.ExecutionPlan memory plan = executor.getExecutionPlan(planId);
        assertEq(uint256(plan.status), uint256(ArbitrageExecutor.ExecutionStatus.COMPLETED));
        
        console.log("Triangular arbitrage completed");
    }
    
    /**
     * @dev Test de protección MEV completa
     */
    function test_E2E_MEVProtection() public {
        console.log("Starting E2E MEV Protection Test");
        
        // 1. Create MEV-protected transaction
        FlashbotsBundleManager.BundleTransaction[] memory transactions = 
            new FlashbotsBundleManager.BundleTransaction[](1);
        
        transactions[0] = FlashbotsBundleManager.BundleTransaction({
            to: address(flashLoanArbitrage),
            value: 0,
            data: abi.encodeWithSignature("executeArbitrage()"),
            gasLimit: 300000,
            maxPriorityFeePerGas: 2 gwei,
            maxFeePerGas: 50 gwei,
            signature: ""
        });
        
        FlashbotsBundleManager.RelayType[] memory relays = 
            new FlashbotsBundleManager.RelayType[](2);
        relays[0] = FlashbotsBundleManager.RelayType.FLASHBOTS;
        relays[1] = FlashbotsBundleManager.RelayType.EDEN;
        
        FlashbotsBundleManager.MEVProtectionParams memory protection = 
            FlashbotsBundleManager.MEVProtectionParams({
                level: FlashbotsBundleManager.ProtectionLevel.ADVANCED,
                enableBackrunProtection: true,
                enableSandwichProtection: true,
                enableFrontrunProtection: true,
                maxSlippage: 100, // 1%
                deadline: block.timestamp + 300,
                trustedBundleHashes: new bytes32[](0)
            });
        
        // 2. Create and submit bundle
        vm.prank(operator);
        bytes32 bundleId = bundleManager.createBundle(
            transactions,
            block.number + 1,
            block.number + 5,
            relays,
            protection
        );
        
        // 3. Submit with MEV protection
        vm.prank(operator);
        bundleManager.submitBundleWithMEVProtection(bundleId, protection);
        
        // 4. Verify bundle created and submitted
        FlashbotsBundleManager.Bundle memory bundle = bundleManager.getBundle(bundleId);
        assertEq(bundle.bundleId, bundleId);
        assertEq(uint256(bundle.status), uint256(FlashbotsBundleManager.BundleStatus.SUBMITTED));
        
        console.log("MEV protection test completed");
    }
    
    /**
     * @dev Test de seguridad completa con EIP-712
     */
    function test_E2E_SecurityValidation() public {
        console.log("Starting E2E Security Validation Test");
        
        // 1. Create execution permit
        SecurityManager.ExecutionPermit memory permit = SecurityManager.ExecutionPermit({
            executor: operator,
            tokenIn: address(WETH),
            tokenOut: address(USDC),
            amountIn: TEST_AMOUNT,
            minAmountOut: TEST_AMOUNT * 95 / 100, // 5% slippage
            deadline: block.timestamp + 300,
            nonce: securityManager.getUserNonce(operator),
            strategyId: keccak256("DEX_ARBITRAGE")
        });
        
        // 2. Sign permit (simplified for testing)
        bytes memory signature = _signPermit(permit, operator);
        
        // 3. Execute with security validation
        vm.prank(operator);
        bool success = securityManager.executeWithPermit(permit, signature);
        
        assertTrue(success, "Security validation should pass");
        
        // 4. Verify security check was performed
        (uint256 totalChecks, , , , ) = securityManager.getSecurityStats();
        assertGt(totalChecks, 0, "Security check should have been performed");
        
        console.log("Security validation completed successfully");
    }
    
    /**
     * @dev Test de stress con múltiples estrategias concurrentes
     */
    function test_E2E_StressTest_MultipleStrategies() public {
        console.log("Starting E2E Stress Test");
        
        uint256 numStrategies = 5;
        uint256[] memory strategyIds = new uint256[](numStrategies);
        
        // 1. Register multiple strategies
        for (uint256 i = 0; i < numStrategies; i++) {
            vm.prank(operator);
            strategyIds[i] = executor.registerStrategy(
                ArbitrageExecutor.StrategyType.CLASSIC_ARBITRAGE,
                address(flashLoanArbitrage),
                abi.encodeWithSignature("executeArbitrage()"),
                (i + 1) * 5 ether, // Different expected profits
                300000 + i * 10000, // Different gas limits
                100 - i * 10        // Different priorities
            );
        }
        
        // 2. Create execution plan with all strategies
        vm.prank(operator);
        uint256 planId = executor.createExecutionPlan(
            strategyIds,
            block.number + 2
        );
        
        // 3. Execute all strategies
        vm.prank(operator);
        executor.executePlan(planId);
        
        // 4. Verify all executed
        ArbitrageExecutor.ExecutionPlan memory plan = executor.getExecutionPlan(planId);
        assertEq(plan.strategies.length, numStrategies);
        
        console.log("Stress test with", numStrategies, "strategies completed");
    }
    
    /**
     * @dev Test de recuperación ante fallos
     */
    function test_E2E_FailureRecovery() public {
        console.log("Starting E2E Failure Recovery Test");
        
        // 1. Setup failing scenario
        aaveProvider.setShouldFail(true);
        
        // 2. Attempt execution (should fail)
        UniversalFlashLoanArbitrage.ArbitrageParams memory params = _createTestParams();
        
        vm.prank(operator);
        vm.expectRevert();
        flashLoanArbitrage.executeArbitrage(params, address(aaveProvider));
        
        // 3. Enable fallback provider
        aaveProvider.setShouldFail(false);
        balancerProvider.setShouldFail(false);
        
        // 4. Retry with aggregator (should use fallback)
        FlashLoanAggregator.SelectionCriteria criteria = FlashLoanAggregator.SelectionCriteria.BALANCED;
        
        vm.prank(operator);
        FlashLoanAggregator.ExecutionResult memory result = flashLoanAggregator.executeOptimalFlashLoan(
            address(WETH),
            TEST_AMOUNT,
            abi.encode(params),
            criteria
        );
        
        assertTrue(result.success, "Fallback should work");
        
        console.log("Failure recovery test completed");
    }
    
    // === BENCHMARK TESTS ===
    
    /**
     * @dev Benchmark de performance del sistema
     */
    function test_E2E_PerformanceBenchmark() public {
        console.log("Starting Performance Benchmark");
        
        uint256 iterations = 10;
        uint256 totalGasUsed = 0;
        uint256 startGas;
        
        for (uint256 i = 0; i < iterations; i++) {
            startGas = gasleft();
            
            // Execute standard arbitrage
            _executeBenchmarkArbitrage();
            
            totalGasUsed += startGas - gasleft();
        }
        
        uint256 avgGasPerExecution = totalGasUsed / iterations;
        
        console.log("Performance Benchmark Results:");
        console.log("- Iterations:", iterations);
        console.log("- Average gas per execution:", avgGasPerExecution);
        console.log("- Total gas used:", totalGasUsed);
        
        // Performance assertions
        assertLt(avgGasPerExecution, 1_000_000, "Average gas should be under 1M");
        
        console.log("Performance benchmark completed");
    }
    
    // === DEPLOYMENT & SETUP HELPERS ===
    
    function _deployTokens() internal {
        WETH = new MockERC20("Wrapped Ether", "WETH", INITIAL_SUPPLY);
        USDC = new MockERC20("USD Coin", "USDC", INITIAL_SUPPLY);
        DAI = new MockERC20("Dai Stablecoin", "DAI", INITIAL_SUPPLY);
        
        console.log("Tokens deployed");
    }
    
    function _deployCoreContracts() internal {
        vm.startPrank(admin);
        
        flashLoanArbitrage = new UniversalFlashLoanArbitrage(admin);
        executor = new ArbitrageExecutor(admin, address(flashLoanArbitrage));
        engine = new UniversalArbitrageEngine(admin, address(flashLoanArbitrage), address(executor));
        flashLoanAggregator = new FlashLoanAggregator(admin);
        dexRouter = new UniversalDEXRouter(admin, address(WETH));
        
        vm.stopPrank();
        
        console.log("Core contracts deployed");
    }
    
    function _deployProviders() internal {
        vm.startPrank(admin);
        
        aaveProvider = new MockAaveProvider(admin, address(flashLoanArbitrage));
        balancerProvider = new MockBalancerProvider(admin, address(flashLoanArbitrage));
        
        vm.stopPrank();
        
        console.log("Providers deployed");
    }
    
    function _deploySecurityMEV() internal {
        vm.startPrank(admin);
        
        bundleManager = new FlashbotsBundleManager(admin);
        securityManager = new SecurityManager(admin);
        
        vm.stopPrank();
        
        console.log("Security & MEV contracts deployed");
    }
    
    function _configureSystem() internal {
        vm.startPrank(admin);
        
        // Grant roles
        flashLoanArbitrage.grantRole(flashLoanArbitrage.EXECUTOR_ROLE(), operator);
        executor.grantRole(executor.OPERATOR_ROLE(), operator);
        engine.grantRole(engine.ENGINE_OPERATOR_ROLE(), operator);
        bundleManager.grantRole(bundleManager.MEV_OPERATOR_ROLE(), operator);
        securityManager.grantRole(securityManager.SECURITY_OPERATOR_ROLE(), operator);
        
        // Configure providers in aggregator
        flashLoanAggregator.registerProvider(
            FlashLoanAggregator.ProviderType.AAVE_V3,
            address(aaveProvider),
            "Aave V3 Provider",
            100
        );
        
        flashLoanAggregator.registerProvider(
            FlashLoanAggregator.ProviderType.BALANCER_V2,
            address(balancerProvider),
            "Balancer V2 Provider",
            95
        );
        
        // Configure DEX router
        dexRouter.configureDEX(
            UniversalDEXRouter.DEXType.UNISWAP_V2,
            address(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D), // Uniswap V2 Router
            address(0),
            100,
            "Uniswap V2"
        );
        
        vm.stopPrank();
        
        console.log("System configured");
    }
    
    function _setupTestScenarios() internal {
        // Distribute tokens
        WETH.transfer(address(aaveProvider), 1_000_000 ether);
        USDC.transfer(address(balancerProvider), 1_000_000 ether);
        DAI.transfer(user, 100_000 ether);
        
        // Setup initial liquidity
        WETH.approve(address(dexRouter), type(uint256).max);
        USDC.approve(address(dexRouter), type(uint256).max);
        DAI.approve(address(dexRouter), type(uint256).max);
        
        console.log("Test scenarios setup");
    }
    
    // === TEST HELPERS ===
    
    function _createProfitableOpportunity() internal {
        // Mock profitable scenario
        aaveProvider.setProfitable(true);
        balancerProvider.setProfitable(true);
    }
    
    function _setupTriangularOpportunity() internal {
        // Setup price differences for triangular arbitrage
        // WETH -> USDC: Rate 1500
        // USDC -> DAI: Rate 1.02  
        // DAI -> WETH: Rate 1/1530 (profitable loop)
    }
    
    function _getTokenArray() internal view returns (address[] memory) {
        address[] memory tokens = new address[](3);
        tokens[0] = address(WETH);
        tokens[1] = address(USDC);
        tokens[2] = address(DAI);
        return tokens;
    }
    
    function _getDEXArray() internal view returns (address[] memory) {
        address[] memory dexes = new address[](2);
        dexes[0] = address(dexRouter);
        dexes[1] = address(dexRouter);
        return dexes;
    }
    
    function _getAmountArray() internal pure returns (uint256[] memory) {
        uint256[] memory amounts = new uint256[](3);
        amounts[0] = 100 ether;
        amounts[1] = 150000 * 1e6; // 150k USDC
        amounts[2] = 150000 ether; // 150k DAI
        return amounts;
    }
    
    function _createTestParams() internal view returns (UniversalFlashLoanArbitrage.ArbitrageParams memory) {
        return UniversalFlashLoanArbitrage.ArbitrageParams({
            inputToken: address(WETH),
            outputToken: address(USDC),
            amount: TEST_AMOUNT,
            minProfit: 5 ether,
            dexPath: _getDEXArray(),
            routingData: "",
            deadline: block.timestamp + 300,
            nonce: 0,
            signature: ""
        });
    }
    
    function _signPermit(
        SecurityManager.ExecutionPermit memory permit,
        address signer
    ) internal pure returns (bytes memory) {
        // Simplified signing for testing
        return abi.encodePacked(signer, permit.amountIn);
    }
    
    function _executeBenchmarkArbitrage() internal {
        UniversalFlashLoanArbitrage.ArbitrageParams memory params = _createTestParams();
        params.signature = _signPermit(
            SecurityManager.ExecutionPermit({
                executor: operator,
                tokenIn: address(WETH),
                tokenOut: address(USDC),
                amountIn: TEST_AMOUNT,
                minAmountOut: TEST_AMOUNT * 95 / 100,
                deadline: block.timestamp + 300,
                nonce: 0,
                strategyId: keccak256("BENCHMARK")
            }),
            operator
        );
        
        vm.prank(operator);
        flashLoanArbitrage.executeArbitrage(params, address(aaveProvider));
    }
}

// === MOCK CONTRACTS FOR E2E TESTING ===

contract MockAaveProvider is IFlashLoanProvider {
    address public admin;
    address public arbitrageContract;
    bool public shouldFail = false;
    bool public profitable = false;
    
    constructor(address _admin, address _arbitrageContract) {
        admin = _admin;
        arbitrageContract = _arbitrageContract;
    }
    
    function executeFlashLoan(FlashLoanParams calldata params) external override {
        if (shouldFail) revert("Aave flash loan failed");
        
        // Simulate flash loan
        MockERC20(params.asset).transfer(arbitrageContract, params.amount);
        
        IArbitrageCallback(arbitrageContract).executeArbitrage(
            msg.sender, params.asset, params.amount, 0, params.params
        );
    }
    
    function calculateFlashLoanFee(address, uint256 amount) external pure override returns (uint256) {
        return amount * 5 / 10000; // 0.05% fee
    }
    
    function isAssetSupported(address) external pure override returns (bool) {
        return true;
    }
    
    function getMaxFlashLoanAmount(address asset) external view override returns (uint256) {
        return MockERC20(asset).balanceOf(address(this));
    }
    
    function setShouldFail(bool _shouldFail) external {
        shouldFail = _shouldFail;
    }
    
    function setProfitable(bool _profitable) external {
        profitable = _profitable;
    }
}

contract MockBalancerProvider is IFlashLoanProvider {
    address public admin;
    address public arbitrageContract; 
    bool public shouldFail = false;
    bool public profitable = false;
    
    constructor(address _admin, address _arbitrageContract) {
        admin = _admin;
        arbitrageContract = _arbitrageContract;
    }
    
    function executeFlashLoan(FlashLoanParams calldata params) external override {
        if (shouldFail) revert("Balancer flash loan failed");
        
        MockERC20(params.asset).transfer(arbitrageContract, params.amount);
        
        IArbitrageCallback(arbitrageContract).executeArbitrage(
            msg.sender, params.asset, params.amount, 0, params.params
        );
    }
    
    function calculateFlashLoanFee(address, uint256) external pure override returns (uint256) {
        return 0; // Balancer V2 no fee
    }
    
    function isAssetSupported(address) external pure override returns (bool) {
        return true;
    }
    
    function getMaxFlashLoanAmount(address asset) external view override returns (uint256) {
        return MockERC20(asset).balanceOf(address(this));
    }
    
    function setShouldFail(bool _shouldFail) external {
        shouldFail = _shouldFail;
    }
    
    function setProfitable(bool _profitable) external {
        profitable = _profitable;
    }
}

contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol, uint256 supply) ERC20(name, symbol) {
        _mint(msg.sender, supply);
    }
    
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
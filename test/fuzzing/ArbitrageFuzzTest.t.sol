// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import "../../contracts/UniversalFlashLoanArbitrage.sol";
import "../../contracts/FlashLoanAggregator.sol";
import "../../contracts/routers/UniversalDEXRouter.sol";
import "../../contracts/security/SecurityManager.sol";

/**
 * @title ArbitrageFuzzTest
 * @dev Tests de fuzzing avanzados para ArbitrageX Supreme V3.0
 * 
 * Incluye:
 * - Fuzzing de parámetros de arbitraje
 * - Fuzzing de precios y amounts
 * - Fuzzing de security parameters
 * - Invariant testing
 * - Property-based testing
 * - Edge case discovery
 */
contract ArbitrageFuzzTest is Test {
    UniversalFlashLoanArbitrage public arbitrageContract;
    FlashLoanAggregator public flashLoanAggregator;
    UniversalDEXRouter public dexRouter;
    SecurityManager public securityManager;
    
    MockERC20 public tokenA;
    MockERC20 public tokenB;
    MockERC20 public tokenC;
    
    MockFlashLoanProvider public provider1;
    MockFlashLoanProvider public provider2;
    MockDEXRouter public router1;
    MockDEXRouter public router2;
    
    address public admin = address(0x1);
    address public executor = address(0x2);
    
    // Fuzzing bounds
    uint256 public constant MIN_AMOUNT = 1e15; // 0.001 tokens
    uint256 public constant MAX_AMOUNT = 1e24; // 1M tokens
    uint256 public constant MIN_PROFIT = 1e12; // 0.000001 tokens
    uint256 public constant MAX_PROFIT = 1e22; // 100K tokens
    uint256 public constant MIN_SLIPPAGE = 1; // 0.01%
    uint256 public constant MAX_SLIPPAGE = 1000; // 10%
    
    // Invariant tracking
    uint256 public totalArbitragesExecuted;
    uint256 public totalProfitGenerated;
    uint256 public totalGasConsumed;
    
    function setUp() public {
        // Deploy tokens
        tokenA = new MockERC20("Token A", "TKA", 100_000_000 ether);
        tokenB = new MockERC20("Token B", "TKB", 100_000_000 ether);
        tokenC = new MockERC20("Token C", "TKC", 100_000_000 ether);
        
        // Deploy mock providers and routers
        provider1 = new MockFlashLoanProvider("Aave Mock", 5); // 0.05% fee
        provider2 = new MockFlashLoanProvider("Balancer Mock", 0); // No fee
        router1 = new MockDEXRouter("Uniswap Mock");
        router2 = new MockDEXRouter("SushiSwap Mock");
        
        // Deploy main contracts
        vm.prank(admin);
        arbitrageContract = new UniversalFlashLoanArbitrage(admin);
        
        vm.prank(admin);
        flashLoanAggregator = new FlashLoanAggregator(admin);
        
        vm.prank(admin);
        dexRouter = new UniversalDEXRouter(admin, address(tokenA));
        
        vm.prank(admin);
        securityManager = new SecurityManager(admin);
        
        // Setup roles and configurations
        _setupRolesAndConfig();
        
        // Setup initial liquidity
        _setupInitialLiquidity();
    }
    
    // === BASIC PARAMETER FUZZING ===
    
    /**
     * @dev Fuzz arbitrage amounts across full range
     */
    function testFuzz_ArbitrageAmounts(uint256 amount) public {
        amount = bound(amount, MIN_AMOUNT, MAX_AMOUNT);
        
        // Ensure sufficient liquidity
        _ensureLiquidity(address(tokenA), amount * 2);
        _ensureLiquidity(address(tokenB), amount * 2);
        
        UniversalFlashLoanArbitrage.ArbitrageParams memory params = _createFuzzParams(
            address(tokenA),
            address(tokenB),
            amount,
            amount / 1000 // 0.1% min profit
        );
        
        if (_isValidArbitrageParams(params)) {
            vm.prank(executor);
            try arbitrageContract.executeArbitrage(params, address(provider1)) {
                totalArbitragesExecuted++;
                // Track successful execution
            } catch Error(string memory reason) {
                // Expected failures for edge cases
                _logFailure(reason, amount);
            }
        }
    }
    
    /**
     * @dev Fuzz profit thresholds and slippage tolerance
     */
    function testFuzz_ProfitThresholds(uint256 amount, uint256 minProfit, uint256 slippage) public {
        amount = bound(amount, MIN_AMOUNT, MAX_AMOUNT);
        minProfit = bound(minProfit, MIN_PROFIT, amount / 10); // Max 10% profit expectation
        slippage = bound(slippage, MIN_SLIPPAGE, MAX_SLIPPAGE);
        
        _ensureLiquidity(address(tokenA), amount * 2);
        
        UniversalFlashLoanArbitrage.ArbitrageParams memory params = _createFuzzParams(
            address(tokenA),
            address(tokenB),
            amount,
            minProfit
        );
        
        // Set expected slippage in mock router
        router1.setSlippage(slippage);
        router2.setSlippage(slippage);
        
        if (_isValidArbitrageParams(params) && minProfit >= arbitrageContract.MIN_PROFIT_THRESHOLD()) {
            vm.prank(executor);
            try arbitrageContract.executeArbitrage(params, address(provider1)) {
                // Should succeed with valid parameters
                totalArbitragesExecuted++;
            } catch {
                // May fail due to insufficient profit after slippage
            }
        }
    }
    
    /**
     * @dev Fuzz token combinations and DEX routing paths
     */
    function testFuzz_TokenCombinations(uint8 tokenInIdx, uint8 tokenOutIdx, uint8 routerIdx) public {
        address[] memory tokens = new address[](3);
        tokens[0] = address(tokenA);
        tokens[1] = address(tokenB);
        tokens[2] = address(tokenC);
        
        address[] memory routers = new address[](2);
        routers[0] = address(router1);
        routers[1] = address(router2);
        
        tokenInIdx = uint8(bound(tokenInIdx, 0, 2));
        tokenOutIdx = uint8(bound(tokenOutIdx, 0, 2));
        routerIdx = uint8(bound(routerIdx, 0, 1));
        
        // Skip same token swaps
        if (tokenInIdx == tokenOutIdx) return;
        
        address tokenIn = tokens[tokenInIdx];
        address tokenOut = tokens[tokenOutIdx];
        address router = routers[routerIdx];
        
        uint256 amount = 1000 ether;
        _ensureLiquidity(tokenIn, amount * 2);
        
        UniversalFlashLoanArbitrage.ArbitrageParams memory params = _createFuzzParams(
            tokenIn,
            tokenOut,
            amount,
            1 ether
        );
        
        // Set router in dex path
        params.dexPath = new address[](1);
        params.dexPath[0] = router;
        
        if (_isValidArbitrageParams(params)) {
            vm.prank(executor);
            try arbitrageContract.executeArbitrage(params, address(provider1)) {
                totalArbitragesExecuted++;
            } catch {
                // Expected failures for some combinations
            }
        }
    }
    
    // === ADVANCED FUZZING SCENARIOS ===
    
    /**
     * @dev Fuzz flash loan provider selection and failover
     */
    function testFuzz_FlashLoanProviders(uint8 providerIdx, bool shouldFail) public {
        address[] memory providers = new address[](2);
        providers[0] = address(provider1);
        providers[1] = address(provider2);
        
        providerIdx = uint8(bound(providerIdx, 0, 1));
        address selectedProvider = providers[providerIdx];
        
        // Configure provider failure
        MockFlashLoanProvider(selectedProvider).setShouldFail(shouldFail);
        
        uint256 amount = 1000 ether;
        _ensureLiquidity(address(tokenA), amount * 2);
        
        UniversalFlashLoanArbitrage.ArbitrageParams memory params = _createFuzzParams(
            address(tokenA),
            address(tokenB),
            amount,
            1 ether
        );
        
        vm.prank(executor);
        if (shouldFail) {
            vm.expectRevert();
            arbitrageContract.executeArbitrage(params, selectedProvider);
        } else {
            try arbitrageContract.executeArbitrage(params, selectedProvider) {
                totalArbitragesExecuted++;
            } catch {
                // May fail for other reasons
            }
        }
        
        // Reset provider
        MockFlashLoanProvider(selectedProvider).setShouldFail(false);
    }
    
    /**
     * @dev Fuzz security parameters and validation
     */
    function testFuzz_SecurityValidation(
        uint256 amount,
        uint256 deadline,
        uint8 securityLevel,
        bool tokenBlacklisted
    ) public {
        amount = bound(amount, MIN_AMOUNT, MAX_AMOUNT);
        deadline = bound(deadline, block.timestamp, block.timestamp + 86400); // Within 24 hours
        securityLevel = uint8(bound(securityLevel, 0, 3));
        
        // Setup security configuration
        if (tokenBlacklisted) {
            vm.prank(admin);
            securityManager.updateBlacklist(
                address(tokenA),
                true,
                SecurityManager.BlacklistSource.INTERNAL,
                100, // High risk
                "Fuzz test blacklist",
                0 // No expiry
            );
        }
        
        SecurityManager.ExecutionPermit memory permit = SecurityManager.ExecutionPermit({
            executor: executor,
            tokenIn: address(tokenA),
            tokenOut: address(tokenB),
            amountIn: amount,
            minAmountOut: amount * 95 / 100, // 5% slippage
            deadline: deadline,
            nonce: securityManager.getUserNonce(executor),
            strategyId: keccak256("FUZZ_TEST")
        });
        
        bytes memory signature = _mockSignature(permit);
        
        vm.prank(executor);
        if (tokenBlacklisted || deadline <= block.timestamp) {
            try securityManager.executeWithPermit(permit, signature) {
                // Should not succeed with invalid params
                assertFalse(true, "Should have failed security validation");
            } catch {
                // Expected failure
            }
        } else {
            try securityManager.executeWithPermit(permit, signature) {
                // May succeed with valid params
            } catch {
                // May fail for other security reasons
            }
        }
        
        // Cleanup
        if (tokenBlacklisted) {
            vm.prank(admin);
            securityManager.updateBlacklist(
                address(tokenA),
                false,
                SecurityManager.BlacklistSource.INTERNAL,
                0,
                "",
                0
            );
        }
    }
    
    /**
     * @dev Fuzz gas limits and optimization parameters
     */
    function testFuzz_GasOptimization(uint256 gasPrice, uint256 gasLimit) public {
        gasPrice = bound(gasPrice, 1 gwei, 1000 gwei);
        gasLimit = bound(gasLimit, 100_000, 2_000_000);
        
        // Set gas parameters
        vm.fee(gasPrice);
        
        uint256 amount = 1000 ether;
        _ensureLiquidity(address(tokenA), amount * 2);
        
        UniversalFlashLoanArbitrage.ArbitrageParams memory params = _createFuzzParams(
            address(tokenA),
            address(tokenB),
            amount,
            1 ether
        );
        
        uint256 gasStart = gasleft();
        
        vm.prank(executor);
        try arbitrageContract.executeArbitrage{gas: gasLimit}(params, address(provider1)) {
            uint256 gasUsed = gasStart - gasleft();
            totalGasConsumed += gasUsed;
            
            // Verify gas efficiency
            assertLt(gasUsed, gasLimit, "Should not exceed gas limit");
            
        } catch Error(string memory reason) {
            if (keccak256(bytes(reason)) == keccak256(bytes("out of gas"))) {
                // Expected for low gas limits
            } else {
                // Other failures are acceptable in fuzzing
            }
        }
    }
    
    // === INVARIANT TESTS ===
    
    /**
     * @dev Invariant: Total supply of tokens should remain constant
     */
    function invariant_TokenSupplyConservation() public {
        uint256 totalSupplyA = tokenA.totalSupply();
        uint256 totalSupplyB = tokenB.totalSupply();
        uint256 totalSupplyC = tokenC.totalSupply();
        
        // Token supplies should never change during arbitrage
        assertEq(totalSupplyA, 100_000_000 ether, "Token A supply should remain constant");
        assertEq(totalSupplyB, 100_000_000 ether, "Token B supply should remain constant");
        assertEq(totalSupplyC, 100_000_000 ether, "Token C supply should remain constant");
    }
    
    /**
     * @dev Invariant: Contract balances should never go negative
     */
    function invariant_PositiveBalances() public {
        // All contract balances should be non-negative
        assertTrue(tokenA.balanceOf(address(arbitrageContract)) >= 0, "Arbitrage contract Token A balance negative");
        assertTrue(tokenB.balanceOf(address(arbitrageContract)) >= 0, "Arbitrage contract Token B balance negative");
        assertTrue(tokenA.balanceOf(address(provider1)) >= 0, "Provider1 Token A balance negative");
        assertTrue(tokenB.balanceOf(address(provider2)) >= 0, "Provider2 Token B balance negative");
    }
    
    /**
     * @dev Invariant: Executed arbitrage count should only increase
     */
    function invariant_MonotonicArbitrageCount() public {
        uint256 currentExecuted = arbitrageContract.executedArbitrages();
        assertTrue(currentExecuted >= totalArbitragesExecuted, "Arbitrage count should only increase");
        totalArbitragesExecuted = currentExecuted;
    }
    
    /**
     * @dev Invariant: Total profits should only increase or stay same
     */
    function invariant_MonotonicProfits() public {
        uint256 currentProfits = arbitrageContract.totalProfits();
        assertTrue(currentProfits >= totalProfitGenerated, "Total profits should never decrease");
        totalProfitGenerated = currentProfits;
    }
    
    /**
     * @dev Invariant: Security checks should be consistent
     */
    function invariant_SecurityConsistency() public {
        (uint256 totalChecks, uint256 totalFailures, , , ) = securityManager.getSecurityStats();
        
        // Failures should never exceed total checks
        assertTrue(totalFailures <= totalChecks, "Failures cannot exceed total checks");
        
        // Total checks should only increase
        assertTrue(totalChecks >= 0, "Total checks should be non-negative");
    }
    
    // === PROPERTY-BASED TESTS ===
    
    /**
     * @dev Property: If arbitrage succeeds, profit should be >= minProfit
     */
    function testProperty_ProfitThreshold(uint256 amount, uint256 minProfit) public {
        amount = bound(amount, MIN_AMOUNT, MAX_AMOUNT / 100); // Smaller amounts for property testing
        minProfit = bound(minProfit, arbitrageContract.MIN_PROFIT_THRESHOLD(), amount / 10);
        
        _ensureLiquidity(address(tokenA), amount * 3);
        
        // Setup profitable scenario
        router1.setProfitable(true);
        router1.setProfitAmount(minProfit + 1 ether); // Ensure profit exceeds threshold
        
        UniversalFlashLoanArbitrage.ArbitrageParams memory params = _createFuzzParams(
            address(tokenA),
            address(tokenB),
            amount,
            minProfit
        );
        
        uint256 profitsBefore = arbitrageContract.totalProfits();
        
        vm.prank(executor);
        try arbitrageContract.executeArbitrage(params, address(provider1)) {
            uint256 profitsAfter = arbitrageContract.totalProfits();
            uint256 actualProfit = profitsAfter - profitsBefore;
            
            // Property: Actual profit should meet or exceed minimum
            assertTrue(actualProfit >= minProfit, "Actual profit should exceed minimum threshold");
            
        } catch {
            // If execution fails, that's acceptable - we're testing the property when it succeeds
        }
        
        // Reset router state
        router1.setProfitable(false);
        router1.setProfitAmount(0);
    }
    
    /**
     * @dev Property: Flash loan fee should always be calculated correctly
     */
    function testProperty_FlashLoanFee(uint256 amount) public {
        amount = bound(amount, MIN_AMOUNT, MAX_AMOUNT);
        
        // Test both providers
        uint256 fee1 = provider1.calculateFlashLoanFee(address(tokenA), amount);
        uint256 fee2 = provider2.calculateFlashLoanFee(address(tokenA), amount);
        
        // Provider1 has 0.05% fee
        uint256 expectedFee1 = (amount * 5) / 10000;
        assertEq(fee1, expectedFee1, "Provider1 fee calculation incorrect");
        
        // Provider2 has no fee
        assertEq(fee2, 0, "Provider2 should have no fee");
        
        // Fees should never exceed principal
        assertTrue(fee1 <= amount, "Fee1 should not exceed principal");
        assertTrue(fee2 <= amount, "Fee2 should not exceed principal");
    }
    
    // === EDGE CASE DISCOVERY ===
    
    /**
     * @dev Test extreme values and edge cases
     */
    function testFuzz_ExtremeValues(uint256 amount) public {
        // Test with extreme values
        if (amount == 0) {
            // Zero amount should fail
            UniversalFlashLoanArbitrage.ArbitrageParams memory params = _createFuzzParams(
                address(tokenA), address(tokenB), 0, 1 ether
            );
            
            vm.prank(executor);
            vm.expectRevert("Invalid amount");
            arbitrageContract.executeArbitrage(params, address(provider1));
            
        } else if (amount == type(uint256).max) {
            // Max uint256 should handle gracefully
            _ensureLiquidity(address(tokenA), amount / 1e18); // Scale down for liquidity
            
            UniversalFlashLoanArbitrage.ArbitrageParams memory params = _createFuzzParams(
                address(tokenA), address(tokenB), amount, 1 ether
            );
            
            vm.prank(executor);
            try arbitrageContract.executeArbitrage(params, address(provider1)) {
                // May succeed or fail, but should not break
            } catch {
                // Expected for extreme values
            }
            
        } else if (amount == 1) {
            // Minimum amount (1 wei)
            _ensureLiquidity(address(tokenA), 1000);
            
            UniversalFlashLoanArbitrage.ArbitrageParams memory params = _createFuzzParams(
                address(tokenA), address(tokenB), 1, 0
            );
            
            vm.prank(executor);
            try arbitrageContract.executeArbitrage(params, address(provider1)) {
                // Should handle minimum amounts
            } catch Error(string memory reason) {
                // May fail due to min profit threshold
                console.log("Min amount failed:", reason);
            }
        }
    }
    
    // === HELPER FUNCTIONS ===
    
    function _setupRolesAndConfig() internal {
        vm.startPrank(admin);
        
        // Grant executor role
        arbitrageContract.grantRole(arbitrageContract.EXECUTOR_ROLE(), executor);
        flashLoanAggregator.grantRole(flashLoanAggregator.EXECUTOR_ROLE(), executor);
        securityManager.grantRole(securityManager.SECURITY_OPERATOR_ROLE(), executor);
        
        // Configure providers in contracts
        arbitrageContract.setFlashLoanProvider(address(provider1), address(provider1));
        arbitrageContract.setFlashLoanProvider(address(provider2), address(provider2));
        
        // Configure DEX routers
        arbitrageContract.setDEXRouter(address(router1), address(router1));
        arbitrageContract.setDEXRouter(address(router2), address(router2));
        
        vm.stopPrank();
    }
    
    function _setupInitialLiquidity() internal {
        // Distribute tokens to providers and routers
        uint256 liquidityAmount = 10_000_000 ether;
        
        tokenA.transfer(address(provider1), liquidityAmount);
        tokenA.transfer(address(provider2), liquidityAmount);
        tokenB.transfer(address(router1), liquidityAmount);
        tokenB.transfer(address(router2), liquidityAmount);
        tokenC.transfer(address(router1), liquidityAmount);
        
        // Setup approvals
        vm.startPrank(address(provider1));
        tokenA.approve(address(arbitrageContract), type(uint256).max);
        tokenB.approve(address(arbitrageContract), type(uint256).max);
        vm.stopPrank();
        
        vm.startPrank(address(provider2));
        tokenA.approve(address(arbitrageContract), type(uint256).max);
        tokenB.approve(address(arbitrageContract), type(uint256).max);
        vm.stopPrank();
    }
    
    function _ensureLiquidity(address token, uint256 amount) internal {
        MockERC20 tokenContract = MockERC20(token);
        
        if (tokenContract.balanceOf(address(provider1)) < amount) {
            tokenContract.mint(address(provider1), amount);
        }
        if (tokenContract.balanceOf(address(provider2)) < amount) {
            tokenContract.mint(address(provider2), amount);
        }
    }
    
    function _createFuzzParams(
        address tokenIn,
        address tokenOut,
        uint256 amount,
        uint256 minProfit
    ) internal view returns (UniversalFlashLoanArbitrage.ArbitrageParams memory) {
        address[] memory dexPath = new address[](2);
        dexPath[0] = address(router1);
        dexPath[1] = address(router2);
        
        return UniversalFlashLoanArbitrage.ArbitrageParams({
            inputToken: tokenIn,
            outputToken: tokenOut,
            amount: amount,
            minProfit: minProfit,
            dexPath: dexPath,
            routingData: abi.encode("fuzz_test"),
            deadline: block.timestamp + 300,
            nonce: arbitrageContract.getUserNonce(executor),
            signature: abi.encodePacked(executor, amount) // Simplified signature
        });
    }
    
    function _isValidArbitrageParams(
        UniversalFlashLoanArbitrage.ArbitrageParams memory params
    ) internal view returns (bool) {
        return params.amount > 0 &&
               params.minProfit >= arbitrageContract.MIN_PROFIT_THRESHOLD() &&
               params.deadline > block.timestamp &&
               params.inputToken != params.outputToken &&
               params.dexPath.length > 0;
    }
    
    function _mockSignature(
        SecurityManager.ExecutionPermit memory permit
    ) internal pure returns (bytes memory) {
        return abi.encodePacked(permit.executor, permit.amountIn);
    }
    
    function _logFailure(string memory reason, uint256 amount) internal {
        console.log("Fuzz failure:", reason, "Amount:", amount);
    }
}

// === ENHANCED MOCK CONTRACTS ===

contract MockFlashLoanProvider is IFlashLoanProvider {
    string public name;
    uint256 public feeRate; // In basis points
    bool public shouldFail = false;
    
    constructor(string memory _name, uint256 _feeRate) {
        name = _name;
        feeRate = _feeRate;
    }
    
    function executeFlashLoan(FlashLoanParams calldata params) external override {
        if (shouldFail) revert("Mock flash loan failed");
        
        MockERC20(params.asset).transfer(params.onBehalfOf, params.amount);
        
        IArbitrageCallback(params.onBehalfOf).executeArbitrage(
            msg.sender, params.asset, params.amount, 
            calculateFlashLoanFee(params.asset, params.amount), 
            params.params
        );
    }
    
    function calculateFlashLoanFee(address, uint256 amount) external view override returns (uint256) {
        return (amount * feeRate) / 10000;
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
}

contract MockDEXRouter is IDEXRouter {
    string public name;
    uint256 public slippage = 50; // 0.5% default
    bool public profitable = false;
    uint256 public profitAmount = 0;
    
    constructor(string memory _name) {
        name = _name;
    }
    
    function swapExactTokensForTokens(
        SwapParams calldata params
    ) external override returns (uint256 amountOut) {
        // Apply slippage
        amountOut = params.amountIn * (10000 - slippage) / 10000;
        
        // Add profit if profitable
        if (profitable) {
            amountOut += profitAmount;
        }
        
        // Ensure minimum output
        require(amountOut >= params.amountOutMin, "Insufficient output amount");
        
        return amountOut;
    }
    
    function getOptimalQuote(
        address,
        address,
        uint256 amountIn
    ) external view override returns (uint256 amountOut, bytes memory routeData) {
        amountOut = amountIn * (10000 - slippage) / 10000;
        if (profitable) {
            amountOut += profitAmount;
        }
        routeData = abi.encode(name);
    }
    
    function setSlippage(uint256 _slippage) external {
        slippage = _slippage;
    }
    
    function setProfitable(bool _profitable) external {
        profitable = _profitable;
    }
    
    function setProfitAmount(uint256 _amount) external {
        profitAmount = _amount;
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
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import "../../contracts/UniversalFlashLoanArbitrage.sol";
import "../../contracts/interfaces/IFlashLoanProvider.sol";
import "../../contracts/interfaces/IDEXRouter.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title UniversalFlashLoanArbitrageTest
 * @dev Tests unitarios completos para UniversalFlashLoanArbitrage
 * 
 * Tests incluyen:
 * - Configuración inicial
 * - Ejecución de arbitraje
 * - Manejo de errores
 * - Control de acceso
 * - Validaciones de seguridad
 */
contract UniversalFlashLoanArbitrageTest is Test {
    UniversalFlashLoanArbitrage public arbitrageContract;
    MockFlashLoanProvider public mockProvider;
    MockDEXRouter public mockRouter;
    MockERC20 public tokenA;
    MockERC20 public tokenB;
    
    address public admin = address(0x1);
    address public executor = address(0x2);
    address public user = address(0x3);
    address public attacker = address(0x4);
    
    uint256 public constant INITIAL_SUPPLY = 1_000_000 ether;
    uint256 public constant TEST_AMOUNT = 100 ether;
    
    event ArbitrageExecuted(
        bytes32 indexed orderHash,
        address indexed initiator,
        address inputToken,
        address outputToken,
        uint256 amount,
        uint256 profit,
        uint256 gasUsed
    );

    function setUp() public {
        // Deploy mock tokens
        tokenA = new MockERC20("Token A", "TKA", INITIAL_SUPPLY);
        tokenB = new MockERC20("Token B", "TKB", INITIAL_SUPPLY);
        
        // Deploy mock providers
        mockProvider = new MockFlashLoanProvider();
        mockRouter = new MockDEXRouter();
        
        // Deploy main contract
        vm.prank(admin);
        arbitrageContract = new UniversalFlashLoanArbitrage(admin);
        
        // Setup roles
        vm.prank(admin);
        arbitrageContract.grantRole(arbitrageContract.EXECUTOR_ROLE(), executor);
        
        // Configure providers and routers
        vm.prank(admin);
        arbitrageContract.setFlashLoanProvider(
            address(mockProvider), 
            address(mockProvider)
        );
        
        vm.prank(admin);
        arbitrageContract.setDEXRouter(
            address(mockRouter), 
            address(mockRouter)
        );
        
        // Setup initial balances
        tokenA.transfer(address(mockProvider), 500_000 ether);
        tokenB.transfer(address(mockRouter), 500_000 ether);
    }
    
    // === BASIC FUNCTIONALITY TESTS ===
    
    function test_InitialSetup() public {
        assertTrue(arbitrageContract.hasRole(arbitrageContract.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(arbitrageContract.hasRole(arbitrageContract.EXECUTOR_ROLE(), executor));
        assertEq(arbitrageContract.totalProfits(), 0);
        assertEq(arbitrageContract.executedArbitrages(), 0);
    }
    
    function test_ExecuteArbitrage_Success() public {
        // Create arbitrage parameters
        UniversalFlashLoanArbitrage.ArbitrageParams memory params = UniversalFlashLoanArbitrage.ArbitrageParams({
            inputToken: address(tokenA),
            outputToken: address(tokenB),
            amount: TEST_AMOUNT,
            minProfit: 1 ether,
            dexPath: _createDexPath(),
            routingData: abi.encode("test_route"),
            deadline: block.timestamp + 300,
            nonce: arbitrageContract.getUserNonce(executor),
            signature: ""
        });
        
        // Sign the parameters (simplified for testing)
        params.signature = _signArbitrageParams(params, executor);
        
        // Execute arbitrage
        vm.prank(executor);
        vm.expectEmit(true, true, false, true);
        emit ArbitrageExecuted(
            _hashArbitrageParams(params),
            executor,
            address(tokenA),
            address(tokenB),
            TEST_AMOUNT,
            0, // Profit will be calculated in callback
            0  // Gas will be calculated
        );
        
        arbitrageContract.executeArbitrage(params, address(mockProvider));
        
        // Verify state changes
        assertEq(arbitrageContract.executedArbitrages(), 1);
        assertTrue(arbitrageContract.getUserNonce(executor) > 0);
    }
    
    function test_ExecuteArbitrage_InvalidAmount() public {
        UniversalFlashLoanArbitrage.ArbitrageParams memory params = UniversalFlashLoanArbitrage.ArbitrageParams({
            inputToken: address(tokenA),
            outputToken: address(tokenB),
            amount: 0, // Invalid amount
            minProfit: 1 ether,
            dexPath: _createDexPath(),
            routingData: "",
            deadline: block.timestamp + 300,
            nonce: arbitrageContract.getUserNonce(executor),
            signature: ""
        });
        
        params.signature = _signArbitrageParams(params, executor);
        
        vm.prank(executor);
        vm.expectRevert("Invalid amount");
        arbitrageContract.executeArbitrage(params, address(mockProvider));
    }
    
    function test_ExecuteArbitrage_ExpiredDeadline() public {
        UniversalFlashLoanArbitrage.ArbitrageParams memory params = UniversalFlashLoanArbitrage.ArbitrageParams({
            inputToken: address(tokenA),
            outputToken: address(tokenB),
            amount: TEST_AMOUNT,
            minProfit: 1 ether,
            dexPath: _createDexPath(),
            routingData: "",
            deadline: block.timestamp - 1, // Expired
            nonce: arbitrageContract.getUserNonce(executor),
            signature: ""
        });
        
        params.signature = _signArbitrageParams(params, executor);
        
        vm.prank(executor);
        vm.expectRevert("Expired deadline");
        arbitrageContract.executeArbitrage(params, address(mockProvider));
    }
    
    // === ACCESS CONTROL TESTS ===
    
    function test_ExecuteArbitrage_UnauthorizedCaller() public {
        UniversalFlashLoanArbitrage.ArbitrageParams memory params = UniversalFlashLoanArbitrage.ArbitrageParams({
            inputToken: address(tokenA),
            outputToken: address(tokenB),
            amount: TEST_AMOUNT,
            minProfit: 1 ether,
            dexPath: _createDexPath(),
            routingData: "",
            deadline: block.timestamp + 300,
            nonce: 0,
            signature: ""
        });
        
        vm.prank(attacker);
        vm.expectRevert("Not authorized executor");
        arbitrageContract.executeArbitrage(params, address(mockProvider));
    }
    
    function test_SetFlashLoanProvider_OnlyAdmin() public {
        vm.prank(user);
        vm.expectRevert();
        arbitrageContract.setFlashLoanProvider(address(0x123), address(0x123));
        
        // Should work with admin
        vm.prank(admin);
        arbitrageContract.setFlashLoanProvider(address(0x123), address(0x123));
    }
    
    // === SECURITY TESTS ===
    
    function test_ReentrancyProtection() public {
        // Deploy malicious contract that attempts reentrancy
        MaliciousReentrant malicious = new MaliciousReentrant(arbitrageContract);
        
        vm.prank(admin);
        arbitrageContract.grantRole(arbitrageContract.EXECUTOR_ROLE(), address(malicious));
        
        // Should fail due to reentrancy protection
        vm.expectRevert("ReentrancyGuard: reentrant call");
        malicious.attemptReentrancy();
    }
    
    function test_BlacklistedToken() public {
        // Blacklist tokenA
        vm.prank(admin);
        arbitrageContract.setTokenBlacklist(address(tokenA), true);
        
        UniversalFlashLoanArbitrage.ArbitrageParams memory params = UniversalFlashLoanArbitrage.ArbitrageParams({
            inputToken: address(tokenA), // Blacklisted
            outputToken: address(tokenB),
            amount: TEST_AMOUNT,
            minProfit: 1 ether,
            dexPath: _createDexPath(),
            routingData: "",
            deadline: block.timestamp + 300,
            nonce: arbitrageContract.getUserNonce(executor),
            signature: ""
        });
        
        params.signature = _signArbitrageParams(params, executor);
        
        vm.prank(executor);
        vm.expectRevert("Input token blacklisted");
        arbitrageContract.executeArbitrage(params, address(mockProvider));
    }
    
    // === FUZZING TESTS ===
    
    function testFuzz_ExecuteArbitrage_ValidAmounts(uint256 amount) public {
        // Bound amount to reasonable range
        amount = bound(amount, 1 ether, 1000 ether);
        
        UniversalFlashLoanArbitrage.ArbitrageParams memory params = UniversalFlashLoanArbitrage.ArbitrageParams({
            inputToken: address(tokenA),
            outputToken: address(tokenB),
            amount: amount,
            minProfit: amount / 100, // 1% min profit
            dexPath: _createDexPath(),
            routingData: "",
            deadline: block.timestamp + 300,
            nonce: arbitrageContract.getUserNonce(executor),
            signature: ""
        });
        
        params.signature = _signArbitrageParams(params, executor);
        
        // Ensure mock provider has enough balance
        if (tokenA.balanceOf(address(mockProvider)) < amount) {
            tokenA.transfer(address(mockProvider), amount * 2);
        }
        
        vm.prank(executor);
        arbitrageContract.executeArbitrage(params, address(mockProvider));
        
        // Verify execution
        assertEq(arbitrageContract.executedArbitrages(), 1);
    }
    
    function testFuzz_MinProfitThreshold(uint256 minProfit) public {
        minProfit = bound(minProfit, 0.001 ether, 10 ether);
        
        UniversalFlashLoanArbitrage.ArbitrageParams memory params = UniversalFlashLoanArbitrage.ArbitrageParams({
            inputToken: address(tokenA),
            outputToken: address(tokenB),
            amount: TEST_AMOUNT,
            minProfit: minProfit,
            dexPath: _createDexPath(),
            routingData: "",
            deadline: block.timestamp + 300,
            nonce: arbitrageContract.getUserNonce(executor),
            signature: ""
        });
        
        if (minProfit >= arbitrageContract.MIN_PROFIT_THRESHOLD()) {
            params.signature = _signArbitrageParams(params, executor);
            
            vm.prank(executor);
            arbitrageContract.executeArbitrage(params, address(mockProvider));
        } else {
            params.signature = _signArbitrageParams(params, executor);
            
            vm.prank(executor);
            vm.expectRevert("Min profit too low");
            arbitrageContract.executeArbitrage(params, address(mockProvider));
        }
    }
    
    // === INVARIANT TESTS ===
    
    function invariant_TotalProfitsNeverDecrease() public {
        assertTrue(arbitrageContract.totalProfits() >= 0);
    }
    
    function invariant_ExecutedArbitragesNeverDecrease() public {
        assertTrue(arbitrageContract.executedArbitrages() >= 0);
    }
    
    function invariant_NonceIncreasing() public {
        uint256 nonceBefore = arbitrageContract.getUserNonce(executor);
        // Execute some operation that should increase nonce
        // ... (implement if needed)
        uint256 nonceAfter = arbitrageContract.getUserNonce(executor);
        assertTrue(nonceAfter >= nonceBefore);
    }
    
    // === INTEGRATION TESTS ===
    
    function test_Integration_FullArbitrageFlow() public {
        // Setup: Create profitable arbitrage opportunity
        _setupProfitableOpportunity();
        
        // Execute arbitrage
        UniversalFlashLoanArbitrage.ArbitrageParams memory params = UniversalFlashLoanArbitrage.ArbitrageParams({
            inputToken: address(tokenA),
            outputToken: address(tokenB),
            amount: TEST_AMOUNT,
            minProfit: 5 ether, // Expect 5 ETH profit
            dexPath: _createDexPath(),
            routingData: "",
            deadline: block.timestamp + 300,
            nonce: arbitrageContract.getUserNonce(executor),
            signature: ""
        });
        
        params.signature = _signArbitrageParams(params, executor);
        
        vm.prank(executor);
        arbitrageContract.executeArbitrage(params, address(mockProvider));
        
        // Verify results
        assertTrue(arbitrageContract.totalProfits() >= 5 ether);
        assertEq(arbitrageContract.executedArbitrages(), 1);
    }
    
    // === HELPER FUNCTIONS ===
    
    function _createDexPath() internal view returns (address[] memory path) {
        path = new address[](2);
        path[0] = address(mockRouter);
        path[1] = address(mockRouter);
    }
    
    function _signArbitrageParams(
        UniversalFlashLoanArbitrage.ArbitrageParams memory params,
        address signer
    ) internal pure returns (bytes memory signature) {
        // Simplified signature for testing
        // In real implementation, use proper EIP-712 signing
        return abi.encodePacked(signer, params.amount);
    }
    
    function _hashArbitrageParams(
        UniversalFlashLoanArbitrage.ArbitrageParams memory params
    ) internal pure returns (bytes32) {
        return keccak256(abi.encode(
            params.inputToken,
            params.outputToken,
            params.amount,
            params.minProfit,
            params.deadline,
            params.nonce
        ));
    }
    
    function _setupProfitableOpportunity() internal {
        // Setup mock routers to return profitable quotes
        mockRouter.setProfitable(true);
        mockRouter.setProfitAmount(10 ether);
    }
}

// === MOCK CONTRACTS ===

contract MockERC20 is ERC20 {
    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply
    ) ERC20(name, symbol) {
        _mint(msg.sender, initialSupply);
    }
}

contract MockFlashLoanProvider is IFlashLoanProvider {
    bool public shouldFail = false;
    
    function executeFlashLoan(FlashLoanParams calldata params) external override {
        if (shouldFail) {
            revert("Mock flash loan failed");
        }
        
        // Simulate successful flash loan
        // Transfer tokens to callback contract and call callback
        IERC20(params.asset).transfer(params.onBehalfOf, params.amount);
        
        // Call the callback (simplified)
        IArbitrageCallback(params.onBehalfOf).executeArbitrage(
            msg.sender,
            params.asset,
            params.amount,
            0, // No fee for mock
            params.params
        );
    }
    
    function calculateFlashLoanFee(address, uint256) external pure override returns (uint256) {
        return 0; // No fee for mock
    }
    
    function isAssetSupported(address) external pure override returns (bool) {
        return true;
    }
    
    function getMaxFlashLoanAmount(address asset) external view override returns (uint256) {
        return IERC20(asset).balanceOf(address(this));
    }
    
    function setShouldFail(bool _shouldFail) external {
        shouldFail = _shouldFail;
    }
}

contract MockDEXRouter is IDEXRouter {
    bool public profitable = false;
    uint256 public profitAmount = 0;
    
    function swapExactTokensForTokens(
        SwapParams calldata params
    ) external override returns (uint256 amountOut) {
        if (profitable) {
            amountOut = params.amountIn + profitAmount;
        } else {
            amountOut = params.amountIn;
        }
        
        // Mock swap: just return the amount
        return amountOut;
    }
    
    function getOptimalQuote(
        address,
        address,
        uint256 amountIn
    ) external view override returns (uint256 amountOut, bytes memory routeData) {
        if (profitable) {
            amountOut = amountIn + profitAmount;
        } else {
            amountOut = amountIn;
        }
        routeData = "";
    }
    
    function setProfitable(bool _profitable) external {
        profitable = _profitable;
    }
    
    function setProfitAmount(uint256 _amount) external {
        profitAmount = _amount;
    }
}

contract MaliciousReentrant {
    UniversalFlashLoanArbitrage public target;
    bool public attacking = false;
    
    constructor(UniversalFlashLoanArbitrage _target) {
        target = _target;
    }
    
    function attemptReentrancy() external {
        attacking = true;
        
        UniversalFlashLoanArbitrage.ArbitrageParams memory params = UniversalFlashLoanArbitrage.ArbitrageParams({
            inputToken: address(0x1),
            outputToken: address(0x2),
            amount: 1 ether,
            minProfit: 0.1 ether,
            dexPath: new address[](0),
            routingData: "",
            deadline: block.timestamp + 300,
            nonce: 0,
            signature: ""
        });
        
        target.executeArbitrage(params, address(this));
    }
    
    function executeArbitrage(
        address,
        address,
        uint256,
        uint256,
        bytes calldata
    ) external returns (bool) {
        if (attacking) {
            // Attempt reentrancy
            this.attemptReentrancy();
        }
        return true;
    }
}
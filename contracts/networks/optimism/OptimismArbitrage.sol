// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../../core/ArbitrageExecutor.sol";

/**
 * @title OptimismArbitrage
 * @dev Contrato especializado para Optimism - L2 optimistic rollup de alta eficiencia
 * @notice Optimizado para Uniswap V3, Velodrome, KyberSwap, Beethoven X
 */
contract OptimismArbitrage is ArbitrageExecutor {
    
    // Direcciones específicas de Optimism
    address private constant UNISWAP_V3_ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
    address private constant VELODROME_ROUTER = 0x9c12939390052919aF3155f41Bf4160Fd3666A6f;
    address private constant KYBERSWAP_ROUTER = 0x6131B5fae19EA4f9D964eAc0408E4408b66337b5;
    address private constant BEETHOVEN_VAULT = 0xBA12222222228d8Ba445958a75a0704d566BF2C8;
    address private constant ONEINCH_ROUTER = 0x1111111254EEB25477B68fb85Ed929f73A960582;
    address private constant ZIPSWAP_ROUTER = 0x2db0AFD0045F3518c77eC6591a542e326Befd3D7;
    
    // Flash loan providers en Optimism
    address private constant AAVE_POOL = 0x794a61358D6845594F94dc1DB02A252b5b4814aD;
    address private constant BEETHOVEN_VAULT_FL = 0xBA12222222228d8Ba445958a75a0704d566BF2C8;
    
    // Tokens principales de Optimism
    address private constant WETH = 0x4200000000000000000000000000000000000006;
    address private constant USDC = 0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85;
    address private constant USDT = 0x94b008aA00579c1307B0EF2c499aD98a8ce58e58;
    address private constant DAI = 0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1;
    address private constant WBTC = 0x68f180fcCe6836688e9084f035309E29Bf0A2095;
    address private constant OP = 0x4200000000000000000000000000000000000042;
    address private constant VELO = 0x3c8B650257cFb5f272f799F5e2b4e65093a11a05;

    // Configuración específica de Optimism (gas L2 bajo)
    uint256 private constant OPTIMISM_MAX_GAS_PRICE = 1 gwei; // L2 bajo costo
    uint256 private constant OPTIMISM_MIN_PROFIT = 20; // 0.2% por L2 efficiency
    uint256 private constant OPTIMISM_OPTIMAL_GAS = 0.05 gwei;
    uint256 private constant L1_DATA_FEE = 0.0005 ether; // Fee L1 data availability

    // Pools específicos de Optimism para arbitraje
    mapping(bytes32 => address) public optimismPools;
    mapping(address => uint256) public poolLiquidities;
    mapping(address => bool) public velodromePools;
    mapping(address => bool) public beethovenPools;

    struct OptimismRoute {
        address[] exchanges; // Velodrome, Uniswap, Beethoven, etc
        uint256[] fees; // Fees para cada exchange
        bytes[] swapData;
        uint256 minAmountOut;
        bool useVelodromeStable; // Para stable swaps
        bool enableBeethovenBalancer; // Para weighted pools
        bool enableMEVProtection;
    }

    constructor(address _dexRegistry) 
        ArbitrageExecutor(
            _dexRegistry,
            AAVE_POOL, // Aave V3 en Optimism
            BEETHOVEN_VAULT, // Beethoven X (Balancer fork)
            UNISWAP_V3_ROUTER,
            OPTIMISM_MAX_GAS_PRICE,
            OPTIMISM_MIN_PROFIT
        ) 
    {
        // Setup tokens principales de Optimism
        supportedTokens[WETH] = true;
        supportedTokens[USDC] = true;
        supportedTokens[USDT] = true;
        supportedTokens[DAI] = true;
        supportedTokens[WBTC] = true;
        supportedTokens[OP] = true;
        supportedTokens[VELO] = true;

        // Setup proveedores de flash loans para Optimism
        flashLoanProviders[AAVE_POOL] = true; // Aave V3
        flashLoanProviders[BEETHOVEN_VAULT_FL] = true; // Beethoven X con 0% fees
        flashLoanProviders[UNISWAP_V3_ROUTER] = true; // Uniswap V3 flash swaps

        // Initialize Optimism-specific pools
        _initializeOptimismPools();
    }

    /**
     * @dev Ejecuta arbitraje optimizado para Optimism con L2 efficiency
     */
    function executeOptimismArbitrage(
        address tokenA,
        address tokenB,
        uint256 amountIn,
        OptimismRoute calldata route
    ) external payable nonReentrant whenNotPaused onlyExecutor returns (uint256 profit) {
        
        require(supportedTokens[tokenA] && supportedTokens[tokenB], "Unsupported token");
        require(tx.gasprice <= OPTIMISM_OPTIMAL_GAS, "Gas price too high for Optimism efficiency");

        // Configuración optimizada para Optimism L2
        ArbitrageParams memory params = ArbitrageParams({
            tokenA: tokenA,
            tokenB: tokenB,
            tokenC: address(0),
            amountIn: amountIn,
            minAmountOut: route.minAmountOut,
            maxGasPrice: OPTIMISM_MAX_GAS_PRICE,
            deadline: uint32(block.timestamp + 1200), // 20 minutos
            routeData: abi.encode(route),
            useFlashLoan: amountIn > 200 * 1e6, // Flash loan para amounts > 200 USDC
            flashLoanProvider: BEETHOVEN_VAULT_FL // Beethoven por 0% fees
        });

        // Crear ruta optimizada para Optimism
        SwapRoute[] memory routes = _buildOptimismOptimizedRoute(tokenA, tokenB, amountIn, route);
        
        ExecutionResult memory result = executeArbitrage(params, routes);
        require(result.success, result.errorMessage);
        
        profit = result.actualProfit;
        
        // Optimización L2: usar Velodrome para stable swaps si es eficiente
        if (route.useVelodromeStable && _isStablePair(tokenA, tokenB)) {
            _optimizeVelodromeStable(tokenA, tokenB, profit);
        }

        emit OptimismArbitrageExecuted(
            msg.sender,
            tokenA,
            tokenB,
            amountIn,
            profit,
            result.gasUsed,
            block.chainid
        );
    }

    /**
     * @dev Ejecuta arbitraje triangular optimizado para Optimism
     */
    function executeTriangularOptimismArbitrage(
        address tokenA,
        address tokenB,
        address tokenC,
        uint256 amountIn,
        OptimismRoute[] calldata routes
    ) external payable nonReentrant whenNotPaused onlyExecutor returns (uint256 profit) {
        
        require(routes.length == 3, "Triangular arbitrage requires exactly 3 routes");
        require(supportedTokens[tokenA] && supportedTokens[tokenB] && supportedTokens[tokenC], "Unsupported token");

        uint256 gasStart = gasleft();
        
        // Ruta optimizada: A -> B -> C -> A
        SwapRoute[] memory swapRoutes = new SwapRoute[](3);
        
        // Primera swap: tokenA -> tokenB
        swapRoutes[0] = SwapRoute({
            exchange: routes[0].exchanges[0],
            tokenIn: tokenA,
            tokenOut: tokenB,
            amountIn: amountIn,
            minAmountOut: routes[0].minAmountOut,
            fee: routes[0].fees[0],
            data: routes[0].swapData[0]
        });

        uint256 amount1 = _executeOptimismSwap(swapRoutes[0], routes[0]);
        require(amount1 >= routes[0].minAmountOut, "Insufficient output for first swap");

        // Segunda swap: tokenB -> tokenC
        swapRoutes[1] = SwapRoute({
            exchange: routes[1].exchanges[0],
            tokenIn: tokenB,
            tokenOut: tokenC,
            amountIn: amount1,
            minAmountOut: routes[1].minAmountOut,
            fee: routes[1].fees[0],
            data: routes[1].swapData[0]
        });

        uint256 amount2 = _executeOptimismSwap(swapRoutes[1], routes[1]);
        require(amount2 >= routes[1].minAmountOut, "Insufficient output for second swap");

        // Tercera swap: tokenC -> tokenA
        swapRoutes[2] = SwapRoute({
            exchange: routes[2].exchanges[0],
            tokenIn: tokenC,
            tokenOut: tokenA,
            amountIn: amount2,
            minAmountOut: routes[2].minAmountOut,
            fee: routes[2].fees[0],
            data: routes[2].swapData[0]
        });

        uint256 finalAmount = _executeOptimismSwap(swapRoutes[2], routes[2]);
        require(finalAmount > amountIn, "No arbitrage profit");
        
        profit = finalAmount - amountIn;
        uint256 gasUsed = gasStart - gasleft();

        // Verificar profit mínimo para Optimism
        uint256 minProfit = (amountIn * OPTIMISM_MIN_PROFIT) / 10000;
        require(profit >= minProfit, "Profit below minimum threshold");

        emit TriangularOptimismArbitrageExecuted(
            msg.sender,
            tokenA,
            tokenB,
            tokenC,
            amountIn,
            finalAmount,
            profit,
            gasUsed
        );
    }

    /**
     * @dev Ejecuta arbitraje con Velodrome governance tokens
     */
    function executeVelodromeArbitrage(
        address tokenA,
        address tokenB,
        uint256 amountIn,
        bool stable
    ) external payable nonReentrant whenNotPaused onlyExecutor returns (uint256 profit) {
        
        require(supportedTokens[tokenA] && supportedTokens[tokenB], "Unsupported token");
        
        // Usar pools stable o volatile de Velodrome según el par
        address veloPool = _getVelodromePool(tokenA, tokenB, stable);
        require(veloPool != address(0), "Velodrome pool not found");

        // Configurar swap específico de Velodrome
        SwapRoute[] memory routes = new SwapRoute[](1);
        routes[0] = SwapRoute({
            exchange: VELODROME_ROUTER,
            tokenIn: tokenA,
            tokenOut: tokenB,
            amountIn: amountIn,
            minAmountOut: 0, // Se calcula dinámicamente
            fee: stable ? 4 : 30, // 0.04% stable, 0.3% volatile
            data: abi.encode(veloPool, stable)
        });

        ArbitrageParams memory params = ArbitrageParams({
            tokenA: tokenA,
            tokenB: tokenB,
            tokenC: address(0),
            amountIn: amountIn,
            minAmountOut: 0,
            maxGasPrice: OPTIMISM_MAX_GAS_PRICE,
            deadline: uint32(block.timestamp + 600),
            routeData: abi.encode(veloPool, stable),
            useFlashLoan: false, // Velodrome no requiere flash loan
            flashLoanProvider: address(0)
        });

        ExecutionResult memory result = executeArbitrage(params, routes);
        require(result.success, result.errorMessage);
        
        profit = result.actualProfit;

        emit VelodromeArbitrageExecuted(
            msg.sender,
            tokenA,
            tokenB,
            amountIn,
            profit,
            stable
        );
    }

    /**
     * @dev Construye ruta optimizada para Optimism
     */
    function _buildOptimismOptimizedRoute(
        address tokenA,
        address tokenB,
        uint256 amountIn,
        OptimismRoute calldata route
    ) internal pure returns (SwapRoute[] memory) {
        
        SwapRoute[] memory routes = new SwapRoute[](route.exchanges.length);
        
        for (uint i = 0; i < route.exchanges.length; i++) {
            routes[i] = SwapRoute({
                exchange: route.exchanges[i],
                tokenIn: i == 0 ? tokenA : tokenB,
                tokenOut: i == 0 ? tokenB : tokenA,
                amountIn: i == 0 ? amountIn : 0,
                minAmountOut: route.minAmountOut,
                fee: route.fees[i],
                data: route.swapData[i]
            });
        }
        
        return routes;
    }

    /**
     * @dev Ejecuta swap optimizado específico para Optimism
     */
    function _executeOptimismSwap(SwapRoute memory route, OptimismRoute calldata optimismRoute) internal returns (uint256) {
        if (optimismRoute.useVelodromeStable && velodromePools[route.exchange]) {
            return _executeVelodromeStableSwap(route);
        } else if (optimismRoute.enableBeethovenBalancer && beethovenPools[route.exchange]) {
            return _executeBeethovenSwap(route);
        } else {
            return _executeSwap(route);
        }
    }

    /**
     * @dev Ejecuta swap específico en Velodrome para stable pairs
     */
    function _executeVelodromeStableSwap(SwapRoute memory route) internal returns (uint256) {
        // Implementación específica para Velodrome stable swaps
        // Velodrome ofrece mejor pricing para stable pairs
        return _executeSwap(route);
    }

    /**
     * @dev Ejecuta swap específico en Beethoven X
     */
    function _executeBeethovenSwap(SwapRoute memory route) internal returns (uint256) {
        // Implementación específica para Beethoven X (Balancer fork)
        // Beethoven X ofrece weighted pools y composable stable pools
        return _executeSwap(route);
    }

    /**
     * @dev Optimización específica para Velodrome stable swaps
     */
    function _optimizeVelodromeStable(address tokenA, address tokenB, uint256 profit) internal {
        if (profit > 5 * 1e6 && _isStablePair(tokenA, tokenB)) {
            // Lógica específica para optimizar stable swaps en Velodrome
            // Puede aprovechar el ve(3,3) tokenomics
        }
    }

    /**
     * @dev Verifica si un par es stable (USDC/USDT, DAI/USDC, etc)
     */
    function _isStablePair(address tokenA, address tokenB) internal pure returns (bool) {
        return (tokenA == USDC && tokenB == USDT) ||
               (tokenA == USDT && tokenB == USDC) ||
               (tokenA == DAI && tokenB == USDC) ||
               (tokenA == USDC && tokenB == DAI) ||
               (tokenA == DAI && tokenB == USDT) ||
               (tokenA == USDT && tokenB == DAI);
    }

    /**
     * @dev Obtiene pool de Velodrome para un par específico
     */
    function _getVelodromePool(address tokenA, address tokenB, bool stable) internal view returns (address) {
        bytes32 poolKey = keccak256(abi.encodePacked(tokenA, tokenB, stable));
        return optimismPools[poolKey];
    }

    /**
     * @dev Inicializa pools específicos de Optimism
     */
    function _initializeOptimismPools() internal {
        // Uniswap V3 pools principales
        optimismPools[keccak256(abi.encodePacked(WETH, USDC, uint24(500)))] = 0x85149247691df622eaF1a8Bd0CaFd40BC45154a9;
        optimismPools[keccak256(abi.encodePacked(WETH, USDC, uint24(3000)))] = 0x68F5C0A2DE713a54991E01858Fd27a3832401849;
        optimismPools[keccak256(abi.encodePacked(OP, WETH, uint24(3000)))] = 0x68db1c8d85C09d546097C65ec7DCBFF4D6497CbF;
        
        // Velodrome pools (stable y volatile)
        optimismPools[keccak256(abi.encodePacked(USDC, USDT, true))] = 0x4F7ebc19844259386DBdDB7b2eB759eeFc6F8353; // Stable
        optimismPools[keccak256(abi.encodePacked(WETH, OP, false))] = 0x79c912FEF520be002c2B6e57EC4324e260f38E50; // Volatile
        velodromePools[0x4F7ebc19844259386DBdDB7b2eB759eeFc6F8353] = true;
        velodromePools[0x79c912FEF520be002c2B6e57EC4324e260f38E50] = true;
        
        // Beethoven X pools
        beethovenPools[0xde45f101250f2ca1c0f8adfc172576d10c12072d] = true; // Weighted pool
        beethovenPools[0x39965c9dAb5448482Cf7e002F583c812Ceb53046] = true; // Stable pool
        
        // Actualizar liquidez inicial
        poolLiquidities[0x85149247691df622eaF1a8Bd0CaFd40BC45154a9] = 30000000 * 1e6; // 30M USDC
        poolLiquidities[0x68F5C0A2DE713a54991E01858Fd27a3832401849] = 80000000 * 1e6; // 80M USDC
    }

    /**
     * @dev Calcula fee optimizado para Optimism incluyendo L1 data cost
     */
    function calculateOptimismFee(uint256 gasUsed) external pure returns (uint256) {
        return (gasUsed * OPTIMISM_OPTIMAL_GAS) + L1_DATA_FEE;
    }

    /**
     * @dev Verifica si un pool de Velodrome está activo
     */
    function isVelodromePool(address pool) external view returns (bool) {
        return velodromePools[pool];
    }

    /**
     * @dev Verifica si un pool de Beethoven X está activo
     */
    function isBeethovenPool(address pool) external view returns (bool) {
        return beethovenPools[pool];
    }

    /**
     * @dev Obtiene la liquidez de un pool específico
     */
    function getPoolLiquidity(address pool) external view returns (uint256) {
        return poolLiquidities[pool];
    }

    /**
     * @dev Actualiza configuración específica de Optimism
     */
    function updateOptimismConfig(
        uint256 newMaxGasPrice,
        uint256 newMinProfit
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newMaxGasPrice <= 2 gwei, "Gas price too high for Optimism");
        require(newMinProfit >= 10 && newMinProfit <= 100, "Invalid profit threshold");
        
        maxGasPrice = newMaxGasPrice;
        minProfitBasisPoints = newMinProfit;
    }

    /**
     * @dev Emergency function para recuperar tokens
     */
    function emergencyWithdraw(address token, uint256 amount) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        require(amount > 0, "Amount must be greater than 0");
        IERC20(token).transfer(msg.sender, amount);
    }

    // Eventos específicos de Optimism
    event OptimismArbitrageExecuted(
        address indexed executor,
        address indexed tokenA,
        address indexed tokenB,
        uint256 amountIn,
        uint256 profit,
        uint256 gasUsed,
        uint256 chainId
    );

    event TriangularOptimismArbitrageExecuted(
        address indexed executor,
        address indexed tokenA,
        address indexed tokenB,
        address indexed tokenC,
        uint256 amountIn,
        uint256 amountOut,
        uint256 profit,
        uint256 gasUsed
    );

    event VelodromeArbitrageExecuted(
        address indexed executor,
        address indexed tokenA,
        address indexed tokenB,
        uint256 amountIn,
        uint256 profit,
        bool stable
    );

    event L2OptimizationExecuted(
        address indexed token,
        uint256 amount,
        uint256 additionalProfit
    );
}
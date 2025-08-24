// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../../core/ArbitrageExecutor.sol";

/**
 * @title AvalancheArbitrage
 * @dev Contrato especializado para Avalanche C-Chain - High throughput y low latency
 * @notice Optimizado para Trader Joe, Pangolin, SushiSwap, Aave, Benqi
 */
contract AvalancheArbitrage is ArbitrageExecutor {
    
    // Direcciones específicas de Avalanche
    address private constant TRADER_JOE_ROUTER = 0x60aE616a2155Ee3d9A68541Ba4544862310933d4;
    address private constant PANGOLIN_ROUTER = 0xE54Ca86531e17Ef3616d22Ca28b0D458b6C89106;
    address private constant SUSHISWAP_ROUTER = 0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506;
    address private constant KYBER_ROUTER = 0x8Efa5A9AD6D594Cf76830267077B78cE0Bc5A5F8;
    address private constant ONEINCH_ROUTER = 0x1111111254EEB25477B68fb85Ed929f73A960582;
    address private constant PLATYPUS_ROUTER = 0x73256EC7575D999C360c1EeC118ECbEFd8DA7D12;
    
    // Flash loan providers en Avalanche 
    address private constant AAVE_POOL = 0x794a61358D6845594F94dc1DB02A252b5b4814aD;
    address private constant BENQI_COMPTROLLER = 0x486Af39519B4Dc9a7fCcd318217352830E8AD9b4;
    address private constant TRADER_JOE_LENDING = 0xdC13687554205E5b89Ac783db14bb5bba4A1eDaC;
    
    // Tokens principales de Avalanche
    address private constant WAVAX = 0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7;
    address private constant USDC = 0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E;
    address private constant USDT = 0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7;
    address private constant DAI = 0xd586E7F844cEa2F87f50152665BCbc2C279D8d70;
    address private constant WETH = 0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB;
    address private constant WBTC = 0x50b7545627a5162F82A992c33b87aDc75187B218;
    address private constant JOE = 0x6e84a6216eA6dACC71eE8E6b0a5B7322EEbC0fDd;
    address private constant PNG = 0x60781C2586D68229fde47564546784ab3fACA982;

    // Configuración específica de Avalanche (gas medio-bajo)
    uint256 private constant AVALANCHE_MAX_GAS_PRICE = 50 gwei; // Avalanche promedio
    uint256 private constant AVALANCHE_MIN_PROFIT = 35; // 0.35% por throughput alto
    uint256 private constant AVALANCHE_OPTIMAL_GAS = 25 gwei;
    uint256 private constant SUBNET_FEE = 0.001 ether; // Fee subnet validation

    // Pools específicos de Avalanche para arbitraje
    mapping(bytes32 => address) public avalanchePools;
    mapping(address => uint256) public poolLiquidities;
    mapping(address => bool) public traderJoePools;
    mapping(address => bool) public pangolinPools;
    mapping(address => bool) public platypusPools;

    struct AvalancheRoute {
        address[] exchanges; // TraderJoe, Pangolin, Platypus, etc
        uint256[] fees;
        bytes[] swapData;
        uint256 minAmountOut;
        bool useTraderJoeV2; // Liquidity Book
        bool usePlatypusStable; // Para stable swaps
        bool enableSubnetOptimization;
    }

    constructor(address _dexRegistry) 
        ArbitrageExecutor(
            _dexRegistry,
            AAVE_POOL, // Aave V3 en Avalanche
            address(0), // No Balancer nativo
            TRADER_JOE_ROUTER,
            AVALANCHE_MAX_GAS_PRICE,
            AVALANCHE_MIN_PROFIT
        ) 
    {
        // Setup tokens principales de Avalanche
        supportedTokens[WAVAX] = true;
        supportedTokens[USDC] = true;
        supportedTokens[USDT] = true;
        supportedTokens[DAI] = true;
        supportedTokens[WETH] = true;
        supportedTokens[WBTC] = true;
        supportedTokens[JOE] = true;
        supportedTokens[PNG] = true;

        // Setup proveedores de flash loans para Avalanche
        flashLoanProviders[AAVE_POOL] = true; // Aave V3
        flashLoanProviders[BENQI_COMPTROLLER] = true; // Benqi lending
        flashLoanProviders[TRADER_JOE_LENDING] = true; // Trader Joe lending

        // Initialize Avalanche-specific pools
        _initializeAvalanchePools();
    }

    /**
     * @dev Ejecuta arbitraje optimizado para Avalanche con high throughput
     */
    function executeAvalancheArbitrage(
        address tokenA,
        address tokenB,
        uint256 amountIn,
        AvalancheRoute calldata route
    ) external payable nonReentrant whenNotPaused onlyExecutor returns (uint256 profit) {
        
        require(supportedTokens[tokenA] && supportedTokens[tokenB], "Unsupported token");
        require(tx.gasprice <= AVALANCHE_OPTIMAL_GAS, "Gas price too high for Avalanche efficiency");

        // Configuración optimizada para Avalanche
        ArbitrageParams memory params = ArbitrageParams({
            tokenA: tokenA,
            tokenB: tokenB,
            tokenC: address(0),
            amountIn: amountIn,
            minAmountOut: route.minAmountOut,
            maxGasPrice: AVALANCHE_MAX_GAS_PRICE,
            deadline: uint32(block.timestamp + 900), // 15 minutos
            routeData: abi.encode(route),
            useFlashLoan: amountIn > 1000 * 1e6, // Flash loan para amounts > 1000 USDC
            flashLoanProvider: AAVE_POOL // Aave V3 por liquidez
        });

        // Crear ruta optimizada para Avalanche
        SwapRoute[] memory routes = _buildAvalancheOptimizedRoute(tokenA, tokenB, amountIn, route);
        
        ExecutionResult memory result = executeArbitrage(params, routes);
        require(result.success, result.errorMessage);
        
        profit = result.actualProfit;
        
        // Optimización específica: usar Trader Joe V2 si es más eficiente
        if (route.useTraderJoeV2 && profit > (amountIn * AVALANCHE_MIN_PROFIT) / 10000) {
            _optimizeTraderJoeV2(tokenA, tokenB, profit);
        }

        emit AvalancheArbitrageExecuted(
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
     * @dev Ejecuta arbitraje triangular optimizado para Avalanche
     */
    function executeTriangularAvalancheArbitrage(
        address tokenA,
        address tokenB,
        address tokenC,
        uint256 amountIn,
        AvalancheRoute[] calldata routes
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

        uint256 amount1 = _executeAvalancheSwap(swapRoutes[0], routes[0]);
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

        uint256 amount2 = _executeAvalancheSwap(swapRoutes[1], routes[1]);
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

        uint256 finalAmount = _executeAvalancheSwap(swapRoutes[2], routes[2]);
        require(finalAmount > amountIn, "No arbitrage profit");
        
        profit = finalAmount - amountIn;
        uint256 gasUsed = gasStart - gasleft();

        // Verificar profit mínimo para Avalanche
        uint256 minProfit = (amountIn * AVALANCHE_MIN_PROFIT) / 10000;
        require(profit >= minProfit, "Profit below minimum threshold");

        emit TriangularAvalancheArbitrageExecuted(
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
     * @dev Ejecuta arbitraje con Platypus stable pools
     */
    function executePlatypusArbitrage(
        address tokenA,
        address tokenB,
        uint256 amountIn
    ) external payable nonReentrant whenNotPaused onlyExecutor returns (uint256 profit) {
        
        require(_isStablePair(tokenA, tokenB), "Not a stable pair for Platypus");
        require(supportedTokens[tokenA] && supportedTokens[tokenB], "Unsupported token");
        
        // Usar Platypus para stable swaps ultra eficientes
        address platypusPool = _getPlatypusPool(tokenA, tokenB);
        require(platypusPool != address(0), "Platypus pool not found");

        SwapRoute[] memory routes = new SwapRoute[](1);
        routes[0] = SwapRoute({
            exchange: PLATYPUS_ROUTER,
            tokenIn: tokenA,
            tokenOut: tokenB,
            amountIn: amountIn,
            minAmountOut: (amountIn * 9995) / 10000, // 0.05% slippage para stables
            fee: 4, // 0.04% fee en Platypus
            data: abi.encode(platypusPool)
        });

        ArbitrageParams memory params = ArbitrageParams({
            tokenA: tokenA,
            tokenB: tokenB,
            tokenC: address(0),
            amountIn: amountIn,
            minAmountOut: routes[0].minAmountOut,
            maxGasPrice: AVALANCHE_MAX_GAS_PRICE,
            deadline: uint32(block.timestamp + 600),
            routeData: abi.encode(platypusPool),
            useFlashLoan: false, // Platypus no requiere flash loan para stables
            flashLoanProvider: address(0)
        });

        ExecutionResult memory result = executeArbitrage(params, routes);
        require(result.success, result.errorMessage);
        
        profit = result.actualProfit;

        emit PlatypusArbitrageExecuted(
            msg.sender,
            tokenA,
            tokenB,
            amountIn,
            profit,
            platypusPool
        );
    }

    /**
     * @dev Construye ruta optimizada para Avalanche
     */
    function _buildAvalancheOptimizedRoute(
        address tokenA,
        address tokenB,
        uint256 amountIn,
        AvalancheRoute calldata route
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
     * @dev Ejecuta swap optimizado específico para Avalanche
     */
    function _executeAvalancheSwap(SwapRoute memory route, AvalancheRoute calldata avalancheRoute) internal returns (uint256) {
        if (avalancheRoute.useTraderJoeV2 && traderJoePools[route.exchange]) {
            return _executeTraderJoeV2Swap(route);
        } else if (avalancheRoute.usePlatypusStable && platypusPools[route.exchange]) {
            return _executePlatypusStableSwap(route);
        } else if (pangolinPools[route.exchange]) {
            return _executePangolinSwap(route);
        } else {
            return _executeSwap(route);
        }
    }

    /**
     * @dev Ejecuta swap específico en Trader Joe V2 (Liquidity Book)
     */
    function _executeTraderJoeV2Swap(SwapRoute memory route) internal returns (uint256) {
        // Implementación específica para Trader Joe V2 Liquidity Book
        // Ofrece mejor capital efficiency y zero slippage en rangos
        return _executeSwap(route);
    }

    /**
     * @dev Ejecuta swap específico en Platypus para stables
     */
    function _executePlatypusStableSwap(SwapRoute memory route) internal returns (uint256) {
        // Implementación específica para Platypus stable swaps
        // Platypus ofrece single-sided AMM para stables
        return _executeSwap(route);
    }

    /**
     * @dev Ejecuta swap específico en Pangolin
     */
    function _executePangolinSwap(SwapRoute memory route) internal returns (uint256) {
        // Implementación específica para Pangolin
        // Pangolin es el DEX nativo de Avalanche
        return _executeSwap(route);
    }

    /**
     * @dev Optimización específica para Trader Joe V2
     */
    function _optimizeTraderJoeV2(address tokenA, address tokenB, uint256 profit) internal {
        if (profit > 10 * 1e6) { // > 10 USDC profit
            // Lógica específica para aprovechar Liquidity Book efficiency
            // Puede hacer swaps adicionales con zero slippage
        }
    }

    /**
     * @dev Verifica si un par es stable para Platypus
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
     * @dev Obtiene pool de Platypus para stable pair
     */
    function _getPlatypusPool(address tokenA, address tokenB) internal view returns (address) {
        bytes32 poolKey = keccak256(abi.encodePacked(tokenA, tokenB, "stable"));
        return avalanchePools[poolKey];
    }

    /**
     * @dev Inicializa pools específicos de Avalanche
     */
    function _initializeAvalanchePools() internal {
        // Trader Joe pools principales
        avalanchePools[keccak256(abi.encodePacked(WAVAX, USDC, uint24(3000)))] = 0xf4003F4efBE8691B60249E6afbD307aBE7758adb;
        avalanchePools[keccak256(abi.encodePacked(WAVAX, JOE, uint24(3000)))] = 0x454E67025631C065d3cFAD6d71E6892f74487a15;
        traderJoePools[0xf4003F4efBE8691B60249E6afbD307aBE7758adb] = true;
        traderJoePools[0x454E67025631C065d3cFAD6d71E6892f74487a15] = true;
        
        // Pangolin pools
        avalanchePools[keccak256(abi.encodePacked(WAVAX, PNG, uint24(3000)))] = 0x0e0100Ab771F9288e0Aa97e11557E6654C3a9665;
        pangolinPools[0x0e0100Ab771F9288e0Aa97e11557E6654C3a9665] = true;
        
        // Platypus stable pools
        avalanchePools[keccak256(abi.encodePacked(USDC, USDT, "stable"))] = 0x66357dCaCe80431aee0A7507e2E361B7e2402370;
        avalanchePools[keccak256(abi.encodePacked(DAI, USDC, "stable"))] = 0xC73eed4494382093C6a7C284426A9a00f6C79939;
        platypusPools[0x66357dCaCe80431aee0A7507e2E361B7e2402370] = true;
        platypusPools[0xC73eed4494382093C6a7C284426A9a00f6C79939] = true;
        
        // Actualizar liquidez inicial
        poolLiquidities[0xf4003F4efBE8691B60249E6afbD307aBE7758adb] = 25000000 * 1e6; // 25M USDC
        poolLiquidities[0x66357dCaCe80431aee0A7507e2E361B7e2402370] = 50000000 * 1e6; // 50M USDC stable
    }

    /**
     * @dev Calcula fee optimizado para Avalanche incluyendo subnet cost
     */
    function calculateAvalancheFee(uint256 gasUsed) external pure returns (uint256) {
        return (gasUsed * AVALANCHE_OPTIMAL_GAS) + SUBNET_FEE;
    }

    /**
     * @dev Verifica si un pool de Trader Joe está activo
     */
    function isTraderJoePool(address pool) external view returns (bool) {
        return traderJoePools[pool];
    }

    /**
     * @dev Verifica si un pool de Pangolin está activo
     */
    function isPangolinPool(address pool) external view returns (bool) {
        return pangolinPools[pool];
    }

    /**
     * @dev Verifica si un pool de Platypus está activo
     */
    function isPlatypusPool(address pool) external view returns (bool) {
        return platypusPools[pool];
    }

    /**
     * @dev Obtiene la liquidez de un pool específico
     */
    function getPoolLiquidity(address pool) external view returns (uint256) {
        return poolLiquidities[pool];
    }

    /**
     * @dev Actualiza configuración específica de Avalanche
     */
    function updateAvalancheConfig(
        uint256 newMaxGasPrice,
        uint256 newMinProfit
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newMaxGasPrice <= 100 gwei, "Gas price too high for Avalanche");
        require(newMinProfit >= 20 && newMinProfit <= 200, "Invalid profit threshold");
        
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

    // Eventos específicos de Avalanche
    event AvalancheArbitrageExecuted(
        address indexed executor,
        address indexed tokenA,
        address indexed tokenB,
        uint256 amountIn,
        uint256 profit,
        uint256 gasUsed,
        uint256 chainId
    );

    event TriangularAvalancheArbitrageExecuted(
        address indexed executor,
        address indexed tokenA,
        address indexed tokenB,
        address indexed tokenC,
        uint256 amountIn,
        uint256 amountOut,
        uint256 profit,
        uint256 gasUsed
    );

    event PlatypusArbitrageExecuted(
        address indexed executor,
        address indexed tokenA,
        address indexed tokenB,
        uint256 amountIn,
        uint256 profit,
        address indexed pool
    );

    event SubnetOptimizationExecuted(
        address indexed token,
        uint256 amount,
        uint256 additionalProfit
    );
}
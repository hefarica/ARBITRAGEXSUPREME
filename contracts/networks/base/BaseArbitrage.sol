// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../../core/ArbitrageExecutor.sol";

/**
 * @title BaseArbitrage
 * @dev Contrato especializado para Base Chain - Gas extremadamente bajo de Coinbase
 * @notice Optimizado para Uniswap V3, SushiSwap, Aerodrome, BaseSwap
 */
contract BaseArbitrage is ArbitrageExecutor {
    
    // Direcciones específicas de Base
    address private constant UNISWAP_V3_ROUTER = 0x2626664c2603336E57B271c5C0b26F421741e481;
    address private constant SUSHISWAP_ROUTER = 0x6BDED42c6DA8FBf0d2bA55B2fa120C5e0c8D7891;
    address private constant AERODROME_ROUTER = 0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43;
    address private constant BASESWAP_ROUTER = 0x327Df1E6de05895d2ab08513aaDD9313Fe505d86;
    address private constant ONEINCH_ROUTER = 0x1111111254EEB25477B68fb85Ed929f73A960582;
    address private constant PANCAKESWAP_ROUTER = 0x678Aa4bF4E210cf2166753e054d5b7c31cc7fa86;
    
    // Flash loan providers en Base
    address private constant AAVE_POOL = 0xA238Dd80C259a72e81d7e4664a9801593F98d1c5;
    address private constant COMPOUND_COMET = 0x9c4ec768c28520B50860ea7a15bd7213a9fF58bf;
    
    // Tokens principales de Base
    address private constant WETH = 0x4200000000000000000000000000000000000006;
    address private constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address private constant DAI = 0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb;
    address private constant WBTC = 0x0555E30da8f98308EdB960aa94C0Db47230d2B9c; 
    address private constant CBETH = 0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22;
    address private constant USDT = 0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2;

    // Configuración específica de Base (gas ultra extremo bajo)
    uint256 private constant BASE_MAX_GAS_PRICE = 0.5 gwei; // Extremadamente bajo
    uint256 private constant BASE_MIN_PROFIT = 10; // 0.1% por gas ultra bajo
    uint256 private constant BASE_OPTIMAL_GAS = 0.01 gwei; // Prácticamente gratis
    uint256 private constant L2_SEQUENCER_FEE = 0.0001 ether; // Fee mínimo del secuenciador

    // Pools específicos de Base para arbitraje
    mapping(bytes32 => address) public basePools;
    mapping(address => uint256) public poolLiquidities;
    mapping(address => bool) public aerodromePools;
    mapping(address => bool) public baseSwapPools;

    struct BaseRoute {
        address[] exchanges; // Aerodrome, Uniswap, BaseSwap, etc
        uint256[] fees; // Fees para cada exchange
        bytes[] swapData;
        uint256 minAmountOut;
        bool useL2Acceleration;
        bool enableMEVProtection;
        bool useAerodromeLiquidity;
    }

    constructor(address _dexRegistry) 
        ArbitrageExecutor(
            _dexRegistry,
            AAVE_POOL, // Aave V3 en Base
            address(0), // No Balancer nativo en Base
            UNISWAP_V3_ROUTER,
            BASE_MAX_GAS_PRICE,
            BASE_MIN_PROFIT
        ) 
    {
        // Setup tokens principales de Base
        supportedTokens[WETH] = true;
        supportedTokens[USDC] = true;
        supportedTokens[DAI] = true;
        supportedTokens[WBTC] = true;
        supportedTokens[CBETH] = true;
        supportedTokens[USDT] = true;

        // Setup proveedores de flash loans para Base
        flashLoanProviders[AAVE_POOL] = true; // Aave V3
        flashLoanProviders[COMPOUND_COMET] = true; // Compound III
        flashLoanProviders[UNISWAP_V3_ROUTER] = true; // Uniswap V3 flash swaps

        // Initialize Base-specific pools
        _initializeBasePools();
    }

    /**
     * @dev Ejecuta arbitraje ultra optimizado para Base con costos prácticamente nulos
     */
    function executeBaseArbitrage(
        address tokenA,
        address tokenB,
        uint256 amountIn,
        BaseRoute calldata route
    ) external payable nonReentrant whenNotPaused onlyExecutor returns (uint256 profit) {
        
        require(supportedTokens[tokenA] && supportedTokens[tokenB], "Unsupported token");
        require(tx.gasprice <= BASE_OPTIMAL_GAS, "Gas price too high for Base efficiency");

        // Configuración ultra agresiva para Base (gas prácticamente gratis)
        ArbitrageParams memory params = ArbitrageParams({
            tokenA: tokenA,
            tokenB: tokenB,
            tokenC: address(0),
            amountIn: amountIn,
            minAmountOut: route.minAmountOut,
            maxGasPrice: BASE_MAX_GAS_PRICE,
            deadline: uint32(block.timestamp + 600), // 10 minutos por L2 ultra speed
            routeData: abi.encode(route),
            useFlashLoan: amountIn > 50 * 1e6, // Flash loan para amounts > 50 USDC
            flashLoanProvider: AAVE_POOL // Aave V3 por seguridad
        });

        // Crear ruta ultra optimizada para Base
        SwapRoute[] memory routes = _buildBaseOptimizedRoute(tokenA, tokenB, amountIn, route);
        
        ExecutionResult memory result = executeArbitrage(params, routes);
        require(result.success, result.errorMessage);
        
        profit = result.actualProfit;
        
        // Optimización ultra agresiva: reinversión inmediata si es rentable
        if (route.useL2Acceleration && profit > (amountIn * BASE_MIN_PROFIT) / 10000) {
            _executeL2Acceleration(tokenA, tokenB, profit, route);
        }

        emit BaseArbitrageExecuted(
            msg.sender,
            tokenA,
            tokenB,
            amountIn,
            profit,
            result.gasUsed,
            block.timestamp
        );
    }

    /**
     * @dev Ejecuta arbitraje triangular ultra optimizado para Base
     */
    function executeTriangularBaseArbitrage(
        address tokenA,
        address tokenB,
        address tokenC,
        uint256 amountIn,
        BaseRoute[] calldata routes
    ) external payable nonReentrant whenNotPaused onlyExecutor returns (uint256 profit) {
        
        require(routes.length == 3, "Triangular arbitrage requires exactly 3 routes");
        require(supportedTokens[tokenA] && supportedTokens[tokenB] && supportedTokens[tokenC], "Unsupported token");

        uint256 gasStart = gasleft();
        
        // Ruta ultra optimizada: A -> B -> C -> A
        SwapRoute[] memory swapRoutes = new SwapRoute[](3);
        
        // Primera swap optimizada: tokenA -> tokenB
        swapRoutes[0] = SwapRoute({
            exchange: routes[0].exchanges[0],
            tokenIn: tokenA,
            tokenOut: tokenB,
            amountIn: amountIn,
            minAmountOut: routes[0].minAmountOut,
            fee: routes[0].fees[0],
            data: routes[0].swapData[0]
        });

        uint256 amount1 = _executeOptimizedSwap(swapRoutes[0], routes[0].useAerodromeLiquidity);
        require(amount1 >= routes[0].minAmountOut, "Insufficient output for first swap");

        // Segunda swap optimizada: tokenB -> tokenC
        swapRoutes[1] = SwapRoute({
            exchange: routes[1].exchanges[0],
            tokenIn: tokenB,
            tokenOut: tokenC,
            amountIn: amount1,
            minAmountOut: routes[1].minAmountOut,
            fee: routes[1].fees[0],
            data: routes[1].swapData[0]
        });

        uint256 amount2 = _executeOptimizedSwap(swapRoutes[1], routes[1].useAerodromeLiquidity);
        require(amount2 >= routes[1].minAmountOut, "Insufficient output for second swap");

        // Tercera swap optimizada: tokenC -> tokenA
        swapRoutes[2] = SwapRoute({
            exchange: routes[2].exchanges[0],
            tokenIn: tokenC,
            tokenOut: tokenA,
            amountIn: amount2,
            minAmountOut: routes[2].minAmountOut,
            fee: routes[2].fees[0],
            data: routes[2].swapData[0]
        });

        uint256 finalAmount = _executeOptimizedSwap(swapRoutes[2], routes[2].useAerodromeLiquidity);
        require(finalAmount > amountIn, "No arbitrage profit");
        
        profit = finalAmount - amountIn;
        uint256 gasUsed = gasStart - gasleft();

        // Verificar profit ultra mínimo para Base (0.1%)
        uint256 minProfit = (amountIn * BASE_MIN_PROFIT) / 10000;
        require(profit >= minProfit, "Profit below minimum threshold");

        emit TriangularBaseArbitrageExecuted(
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
     * @dev Ejecuta multiple swaps simultáneos aprovechando el gas ultra bajo
     */
    function executeMultipleBaseArbitrage(
        BaseRoute[] calldata routes,
        uint256[] calldata amounts
    ) external payable nonReentrant whenNotPaused onlyExecutor returns (uint256 totalProfit) {
        
        require(routes.length == amounts.length, "Mismatched routes and amounts");
        require(routes.length <= 5, "Too many simultaneous operations");

        uint256 gasStart = gasleft();
        
        for (uint i = 0; i < routes.length; i++) {
            if (amounts[i] > 0) {
                // Ejecutar cada arbitraje individualmente
                address tokenA = address(bytes20(routes[i].swapData[0][:20]));
                address tokenB = address(bytes20(routes[i].swapData[0][20:40]));
                
                uint256 individualProfit = _executeSingleBaseArbitrage(
                    tokenA, 
                    tokenB, 
                    amounts[i], 
                    routes[i]
                );
                
                totalProfit += individualProfit;
            }
        }

        uint256 gasUsed = gasStart - gasleft();
        
        // Verificar que el profit total compense el gas (mínimo)
        require(totalProfit > gasUsed * BASE_OPTIMAL_GAS, "Total profit insufficient");

        emit MultipleBaseArbitrageExecuted(
            msg.sender,
            routes.length,
            totalProfit,
            gasUsed
        );
    }

    /**
     * @dev Construye ruta ultra optimizada para Base
     */
    function _buildBaseOptimizedRoute(
        address tokenA,
        address tokenB,
        uint256 amountIn,
        BaseRoute calldata route
    ) internal pure returns (SwapRoute[] memory) {
        
        SwapRoute[] memory routes = new SwapRoute[](route.exchanges.length);
        
        for (uint i = 0; i < route.exchanges.length; i++) {
            routes[i] = SwapRoute({
                exchange: route.exchanges[i],
                tokenIn: i == 0 ? tokenA : tokenB,
                tokenOut: i == 0 ? tokenB : tokenA,
                amountIn: i == 0 ? amountIn : 0, // Se calcula dinámicamente
                minAmountOut: route.minAmountOut,
                fee: route.fees[i],
                data: route.swapData[i]
            });
        }
        
        return routes;
    }

    /**
     * @dev Ejecuta swap optimizado con selección inteligente de DEX
     */
    function _executeOptimizedSwap(SwapRoute memory route, bool useAerodrome) internal returns (uint256) {
        if (useAerodrome && aerodromePools[route.exchange]) {
            // Usar Aerodrome para mejor liquidez
            return _executeAerodromeSwap(route);
        } else if (baseSwapPools[route.exchange]) {
            // Usar BaseSwap para fees ultra bajos
            return _executeBaseSwapSwap(route);
        } else {
            // Fallback a swap estándar
            return _executeSwap(route);
        }
    }

    /**
     * @dev Ejecuta swap específico en Aerodrome
     */
    function _executeAerodromeSwap(SwapRoute memory route) internal returns (uint256) {
        // Implementación específica para Aerodrome
        // Aerodrome ofrece mejor liquidez y rewards adicionales
        return _executeSwap(route); // Placeholder - implementar lógica específica
    }

    /**
     * @dev Ejecuta swap específico en BaseSwap
     */
    function _executeBaseSwapSwap(SwapRoute memory route) internal returns (uint256) {
        // Implementación específica para BaseSwap
        // BaseSwap ofrece fees ultra bajos
        return _executeSwap(route); // Placeholder - implementar lógica específica
    }

    /**
     * @dev Ejecuta arbitraje individual para multiple operations
     */
    function _executeSingleBaseArbitrage(
        address tokenA,
        address tokenB,
        uint256 amountIn,
        BaseRoute calldata route
    ) internal returns (uint256 profit) {
        
        SwapRoute[] memory routes = _buildBaseOptimizedRoute(tokenA, tokenB, amountIn, route);
        
        ArbitrageParams memory params = ArbitrageParams({
            tokenA: tokenA,
            tokenB: tokenB,
            tokenC: address(0),
            amountIn: amountIn,
            minAmountOut: route.minAmountOut,
            maxGasPrice: BASE_MAX_GAS_PRICE,
            deadline: uint32(block.timestamp + 300), // 5 minutos para operaciones múltiples
            routeData: abi.encode(route),
            useFlashLoan: amountIn > 100 * 1e6, // Flash loan para amounts grandes
            flashLoanProvider: AAVE_POOL
        });

        ExecutionResult memory result = executeArbitrage(params, routes);
        return result.success ? result.actualProfit : 0;
    }

    /**
     * @dev Aceleración L2 específica para Base
     */
    function _executeL2Acceleration(
        address tokenA, 
        address tokenB, 
        uint256 profit,
        BaseRoute calldata route
    ) internal {
        // Si el profit es significativo y el gas es prácticamente gratis,
        // ejecutar operaciones adicionales inmediatamente
        if (profit > 5 * 1e6 && tx.gasprice <= BASE_OPTIMAL_GAS) {
            // Reinvertir 50% del profit inmediatamente
            uint256 reinvestAmount = profit / 2;
            if (reinvestAmount > 1e6) { // Mínimo 1 USDC
                _executeSingleBaseArbitrage(tokenA, tokenB, reinvestAmount, route);
            }
        }
    }

    /**
     * @dev Inicializa pools específicos de Base
     */
    function _initializeBasePools() internal {
        // Uniswap V3 pools principales
        basePools[keccak256(abi.encodePacked(WETH, USDC, uint24(500)))] = 0x4C36388bE6F416A29C8d8Eee81C771cE6bE14B18;
        basePools[keccak256(abi.encodePacked(WETH, USDC, uint24(3000)))] = 0x88A43bbDF9D098eEC7bCEda4e2494615dfD9bB9C;
        basePools[keccak256(abi.encodePacked(CBETH, WETH, uint24(500)))] = 0x85C31FFA3706d1cce9d525a00f1C7D4A2911754c;
        
        // Aerodrome pools (alta liquidez)
        aerodromePools[0xcDAC0d6c6C59727a65F871236188350531885C43] = true; // WETH/USDC
        aerodromePools[0x6cDcb1C4A4D1C3C6d054b27AC5B77e89eAFb971d] = true; // CBETH/WETH
        
        // BaseSwap pools (fees ultra bajos)
        baseSwapPools[0x27a8FeD3BaE362b8cd2D2F5ec7440AaE7CC3b3F6] = true; // WETH/USDC
        baseSwapPools[0x9a26F5433671751C3276a065f57e5a02D2817973] = true; // WETH/DAI
        
        // Actualizar liquidez inicial
        poolLiquidities[0x4C36388bE6F416A29C8d8Eee81C771cE6bE14B18] = 20000000 * 1e6; // 20M USDC
        poolLiquidities[0x88A43bbDF9D098eEC7bCEda4e2494615dfD9bB9C] = 50000000 * 1e6; // 50M USDC
    }

    /**
     * @dev Calcula fee optimizado para Base incluyendo sequencer cost
     */
    function calculateBaseFee(uint256 gasUsed) external pure returns (uint256) {
        return (gasUsed * BASE_OPTIMAL_GAS) + L2_SEQUENCER_FEE;
    }

    /**
     * @dev Verifica si un pool de Aerodrome está activo
     */
    function isAerodromePool(address pool) external view returns (bool) {
        return aerodromePools[pool];
    }

    /**
     * @dev Verifica si un pool de BaseSwap está activo
     */
    function isBaseSwapPool(address pool) external view returns (bool) {
        return baseSwapPools[pool];
    }

    /**
     * @dev Obtiene la liquidez de un pool específico
     */
    function getPoolLiquidity(address pool) external view returns (uint256) {
        return poolLiquidities[pool];
    }

    /**
     * @dev Actualiza configuración específica de Base
     */
    function updateBaseConfig(
        uint256 newMaxGasPrice,
        uint256 newMinProfit
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newMaxGasPrice <= 1 gwei, "Gas price too high for Base");
        require(newMinProfit >= 5 && newMinProfit <= 50, "Invalid profit threshold");
        
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

    // Eventos específicos de Base
    event BaseArbitrageExecuted(
        address indexed executor,
        address indexed tokenA,
        address indexed tokenB,
        uint256 amountIn,
        uint256 profit,
        uint256 gasUsed,
        uint256 timestamp
    );

    event TriangularBaseArbitrageExecuted(
        address indexed executor,
        address indexed tokenA,
        address indexed tokenB,
        address indexed tokenC,
        uint256 amountIn,
        uint256 amountOut,
        uint256 profit,
        uint256 gasUsed
    );

    event MultipleBaseArbitrageExecuted(
        address indexed executor,
        uint256 operationsCount,
        uint256 totalProfit,
        uint256 gasUsed
    );

    event L2AccelerationExecuted(
        address indexed token,
        uint256 amount,
        uint256 additionalProfit
    );
}
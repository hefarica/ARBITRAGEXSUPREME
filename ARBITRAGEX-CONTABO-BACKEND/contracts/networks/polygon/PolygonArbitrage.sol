// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../../core/ArbitrageExecutor.sol";

/**
 * @title PolygonArbitrage
 * @dev Contrato especializado para Polygon - Ultra bajo costo de gas
 * @notice Optimizado para QuickSwap, SushiSwap, Uniswap V3, Balancer, Curve
 */
contract PolygonArbitrage is ArbitrageExecutor {
    
    // Direcciones específicas de Polygon
    address private constant QUICKSWAP_ROUTER = 0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff;
    address private constant SUSHISWAP_ROUTER = 0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506;
    address private constant UNISWAP_V3_ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
    address private constant BALANCER_VAULT = 0xBA12222222228d8Ba445958a75a0704d566BF2C8;
    address private constant CURVE_AAVE_POOL = 0x445FE580eF8d70FF569aB36e80c647af338db351;
    address private constant ONEINCH_ROUTER = 0x1111111254EEB25477B68fb85Ed929f73A960582;
    address private constant DODO_PROXY = 0xa222e6a71D1A1Dd5F279805fbe38d5329C1d0e70;
    
    // Aave V3 Pool en Polygon
    address private constant AAVE_V3_POOL = 0x794a61358D6845594F94dc1DB02A252b5b4814aD;
    
    // Tokens principales de Polygon
    address private constant WMATIC = 0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270;
    address private constant USDC = 0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174; // USDC nativo
    address private constant USDT = 0xc2132D05D31c914a87C6611C10748AEb04B58e8F;
    address private constant DAI = 0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063;
    address private constant WETH = 0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619;
    address private constant WBTC = 0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6;
    address private constant QUICK = 0x831753DD7087CaC61aB5644b308642cc1c33Dc13;
    
    // Configuración específica de Polygon (gas ultra bajo)
    uint256 private constant POLYGON_MAX_GAS_PRICE = 100 gwei; // Aún alto para L2
    uint256 private constant POLYGON_MIN_PROFIT = 30; // 0.3% por bajo gas
    uint256 private constant POLYGON_OPTIMAL_GAS = 30 gwei;

    // Pools específicos de Polygon para arbitraje
    mapping(bytes32 => address) public polygonPools;

    constructor(address _dexRegistry) 
        ArbitrageExecutor(
            _dexRegistry,
            AAVE_V3_POOL,
            BALANCER_VAULT,
            UNISWAP_V3_ROUTER,
            POLYGON_MAX_GAS_PRICE,
            POLYGON_MIN_PROFIT
        ) 
    {
        // Setup tokens principales de Polygon
        supportedTokens[WMATIC] = true;
        supportedTokens[USDC] = true;
        supportedTokens[USDT] = true;
        supportedTokens[DAI] = true;
        supportedTokens[WETH] = true;
        supportedTokens[WBTC] = true;
        supportedTokens[QUICK] = true;

        // Setup proveedores de flash loans
        flashLoanProviders[AAVE_V3_POOL] = true;
        flashLoanProviders[BALANCER_VAULT] = true;
        flashLoanProviders[DODO_PROXY] = true; // DODO tiene 0% fees

        // Initialize polygon-specific pools
        _initializePolygonPools();
    }

    /**
     * @dev Ejecuta arbitraje optimizado para Polygon con gas ultra bajo
     */
    function executePolygonArbitrage(
        address tokenA,
        address tokenB,
        uint256 amountIn,
        PolygonRoute calldata route
    ) external payable nonReentrant whenNotPaused onlyExecutor returns (uint256 profit) {
        
        require(supportedTokens[tokenA] && supportedTokens[tokenB], "Unsupported token");
        require(tx.gasprice <= POLYGON_OPTIMAL_GAS, "Gas price not optimal");

        // Configurar parámetros específicos de Polygon
        ArbitrageParams memory params = ArbitrageParams({
            tokenA: tokenA,
            tokenB: tokenB,
            tokenC: address(0),
            amountIn: amountIn,
            minAmountOut: route.minAmountOut,
            maxGasPrice: POLYGON_MAX_GAS_PRICE,
            deadline: uint32(block.timestamp + 1200), // 20 minutos - más tiempo por L2
            routeData: abi.encode(route),
            useFlashLoan: amountIn > 1000 * 1e6, // Flash loan para amounts > $1000
            flashLoanProvider: DODO_PROXY // DODO por 0% fees
        });

        // Crear ruta optimizada para Polygon
        SwapRoute[] memory routes = _buildPolygonOptimizedRoute(tokenA, tokenB, amountIn, route);
        
        // Ejecutar arbitraje
        ExecutionResult memory result = executeArbitrage(params, routes);
        require(result.success, result.errorMessage);
        
        return result.profit;
    }

    /**
     * @dev Arbitraje triangular especializado para Polygon - altamente rentable
     */
    function executePolygonTriangular(
        uint256 amountIn,
        PolygonTriangularRoute calldata route
    ) external payable nonReentrant whenNotPaused onlyExecutor returns (uint256 finalAmount) {
        
        require(tx.gasprice <= POLYGON_OPTIMAL_GAS, "Suboptimal gas price");
        
        // Validaciones específicas de Polygon
        require(_isValidPolygonTriangular(route), "Invalid Polygon triangular route");

        // Crear rutas optimizadas para bajo gas
        SwapRoute[] memory routes = new SwapRoute[](3);
        
        // Optimizar cada swap para mínimo gas en Polygon
        routes[0] = _createPolygonSwapRoute(
            route.tokenA, route.tokenB, amountIn, route.dexA, route.feeA
        );
        routes[1] = _createPolygonSwapRoute(
            route.tokenB, route.tokenC, 0, route.dexB, route.feeB
        );
        routes[2] = _createPolygonSwapRoute(
            route.tokenC, route.tokenA, 0, route.dexC, route.feeC
        );

        ExecutionResult memory result = executeTriangularArbitrage(
            route.tokenA,
            route.tokenB, 
            route.tokenC,
            amountIn,
            routes
        );

        require(result.success, result.errorMessage);
        return result.actualAmountOut;
    }

    /**
     * @dev Flash loan arbitraje con DODO - 0% fees en Polygon
     */
    function executeDODOFlashArbitrage(
        address tokenA,
        address tokenB,
        uint256 flashAmount,
        PolygonFlashRoute calldata route
    ) external payable nonReentrant whenNotPaused onlyExecutor returns (uint256 profit) {
        
        require(supportedTokens[tokenA] && supportedTokens[tokenB], "Unsupported tokens");
        require(route.expectedProfit > POLYGON_MIN_PROFIT, "Insufficient expected profit");

        // Configurar flash loan con DODO (0% fees)
        bytes memory params = abi.encode(
            ArbitrageParams({
                tokenA: tokenA,
                tokenB: tokenB,
                tokenC: address(0),
                amountIn: flashAmount,
                minAmountOut: route.minAmountOut,
                maxGasPrice: POLYGON_MAX_GAS_PRICE,
                deadline: uint32(block.timestamp + 600),
                routeData: abi.encode(route),
                useFlashLoan: true,
                flashLoanProvider: DODO_PROXY
            }),
            _buildDODOOptimizedRoute(tokenA, tokenB, flashAmount, route)
        );

        ExecutionResult memory result = executeFlashLoanArbitrage(
            DODO_PROXY,
            tokenA,
            flashAmount,
            params
        );

        require(result.success, result.errorMessage);
        return result.profit;
    }

    /**
     * @dev Arbitraje multi-DEX aprovechando liquidez fragmentada de Polygon
     */
    function executeMultiDEXArbitrage(
        address tokenA,
        address tokenB,
        uint256 amountIn,
        MultiDEXRoute calldata route
    ) external payable nonReentrant whenNotPaused onlyExecutor returns (uint256 totalProfit) {
        
        require(route.routes.length >= 2, "Need at least 2 routes");
        require(route.routes.length <= 5, "Too many routes - gas limit");

        uint256 totalGasEstimate = 0;
        uint256 totalExpectedProfit = 0;

        // Validar cada ruta y calcular profit total esperado
        for (uint256 i = 0; i < route.routes.length; i++) {
            PolygonRoute memory singleRoute = route.routes[i];
            
            (uint256 expectedProfit, uint256 gasEst,) = _calculatePolygonProfitability(
                tokenA, tokenB, singleRoute.amountIn, singleRoute
            );
            
            totalExpectedProfit += expectedProfit;
            totalGasEstimate += gasEst;
        }

        require(totalExpectedProfit > POLYGON_MIN_PROFIT, "Insufficient total profit");
        require(totalGasEstimate < 1000000, "Gas limit exceeded");

        // Ejecutar rutas en paralelo (simulado)
        for (uint256 i = 0; i < route.routes.length; i++) {
            uint256 profit = executePolygonArbitrage(
                tokenA,
                tokenB, 
                route.routes[i].amountIn,
                route.routes[i]
            );
            totalProfit += profit;
        }

        return totalProfit;
    }

    // ============ POLYGON-SPECIFIC STRUCTS ============

    struct PolygonRoute {
        address dexA;
        address dexB;
        uint24 feeA;
        uint24 feeB;
        uint256 amountIn;
        uint256 minAmountOut;
        bytes routeData;
    }

    struct PolygonTriangularRoute {
        address tokenA;
        address tokenB; 
        address tokenC;
        address dexA;
        address dexB;
        address dexC;
        uint24 feeA;
        uint24 feeB;
        uint24 feeC;
        uint256 minAmountB;
        uint256 minAmountC;
        uint256 minFinalAmount;
    }

    struct PolygonFlashRoute {
        address[] dexes;
        uint24[] fees;
        uint256 expectedProfit;
        uint256 minAmountOut;
        bytes flashData;
    }

    struct MultiDEXRoute {
        PolygonRoute[] routes;
        uint256 totalAmountIn;
        uint256 minTotalProfit;
    }

    // ============ INTERNAL POLYGON-SPECIFIC FUNCTIONS ============

    function _initializePolygonPools() internal {
        // QuickSwap pools principales
        polygonPools[keccak256("QUICK_WMATIC_USDC")] = 0x6e7a5FAFcec6BB1e78bAE2A1F0B612012BF14827;
        polygonPools[keccak256("QUICK_WETH_USDC")] = 0x853Ee4b2A13f8a742d64C8F088bE7bA2131f670d;
        polygonPools[keccak256("QUICK_WBTC_WETH")] = 0xdC9232E2Df177d7a12FdFf6EcBAb114E2231198D;
        
        // SushiSwap pools
        polygonPools[keccak256("SUSHI_WMATIC_USDC")] = 0xcd353F79d9FADe311fC3119B841e1f456b54e858;
        polygonPools[keccak256("SUSHI_WETH_USDC")] = 0x34965ba0ac2451A34a0471F04CCa3F990b8dea27;
        
        // Balancer pools
        polygonPools[keccak256("BAL_STABLE_POOL")] = 0x48e6B98ef6329f8f0A30eBB8c7C960330d648085;
    }

    function _buildPolygonOptimizedRoute(
        address tokenA,
        address tokenB,
        uint256 amountIn,
        PolygonRoute calldata route
    ) internal view returns (SwapRoute[] memory routes) {
        
        routes = new SwapRoute[](2);
        
        // Optimizar para gas bajo de Polygon
        routes[0] = SwapRoute({
            dex: route.dexA,
            tokenIn: tokenA,
            tokenOut: tokenB,
            amountIn: amountIn,
            minAmountOut: _calculatePolygonMinAmount(tokenA, tokenB, amountIn),
            fee: route.feeA,
            extraData: abi.encode("POLYGON_OPTIMIZED", block.timestamp)
        });

        routes[1] = SwapRoute({
            dex: route.dexB,
            tokenIn: tokenB,
            tokenOut: tokenA,
            amountIn: 0, // Calculado dinámicamente
            minAmountOut: route.minAmountOut,
            fee: route.feeB,
            extraData: abi.encode("POLYGON_OPTIMIZED", block.timestamp)
        });
    }

    function _createPolygonSwapRoute(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        address dex,
        uint24 fee
    ) internal view returns (SwapRoute memory route) {
        
        route = SwapRoute({
            dex: dex,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            amountIn: amountIn,
            minAmountOut: _calculatePolygonMinAmount(tokenIn, tokenOut, amountIn),
            fee: fee,
            extraData: abi.encode("POLYGON_LOW_GAS", block.number)
        });
    }

    function _buildDODOOptimizedRoute(
        address tokenA,
        address tokenB,
        uint256 amount,
        PolygonFlashRoute calldata route
    ) internal view returns (SwapRoute[] memory routes) {
        
        routes = new SwapRoute[](route.dexes.length);
        
        for (uint256 i = 0; i < route.dexes.length; i++) {
            routes[i] = SwapRoute({
                dex: route.dexes[i],
                tokenIn: i == 0 ? tokenA : tokenB,
                tokenOut: i == 0 ? tokenB : tokenA,
                amountIn: i == 0 ? amount : 0,
                minAmountOut: i == route.dexes.length - 1 ? route.minAmountOut : 0,
                fee: route.fees[i],
                extraData: route.flashData
            });
        }
    }

    function _isValidPolygonTriangular(
        PolygonTriangularRoute calldata route
    ) internal view returns (bool) {
        
        // Validar que los DEXs sean soportados
        if (!dexRegistry.isDEXSupported(route.dexA) || 
            !dexRegistry.isDEXSupported(route.dexB) || 
            !dexRegistry.isDEXSupported(route.dexC)) {
            return false;
        }

        // Validar que los tokens sean soportados
        if (!supportedTokens[route.tokenA] || 
            !supportedTokens[route.tokenB] || 
            !supportedTokens[route.tokenC]) {
            return false;
        }

        // Validar que sea una ruta circular válida
        return route.tokenA != route.tokenB && 
               route.tokenB != route.tokenC && 
               route.tokenC != route.tokenA;
    }

    function _calculatePolygonMinAmount(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) internal view returns (uint256 minAmount) {
        if (amountIn == 0) return 0;
        
        // Slippage más bajo para Polygon por mayor estabilidad
        uint256 estimatedOut = dexRegistry.getAmountOut(
            _selectPolygonBestDEX(tokenIn, tokenOut),
            tokenIn,
            tokenOut,
            amountIn,
            _getPolygonOptimalFee(tokenIn, tokenOut)
        );

        // Slippage de 0.5-2% dependiendo del par
        uint256 slippage = _getPolygonSlippage(tokenIn, tokenOut);
        minAmount = (estimatedOut * (10000 - slippage)) / 10000;
    }

    function _selectPolygonBestDEX(
        address tokenIn,
        address tokenOut
    ) internal view returns (address bestDEX) {
        
        // Priorizar DEXs por liquidez en Polygon
        address[] memory dexes = new address[](6);
        dexes[0] = QUICKSWAP_ROUTER;    // Mejor liquidez nativa
        dexes[1] = SUSHISWAP_ROUTER;    // Segunda opción
        dexes[2] = UNISWAP_V3_ROUTER;   // Para pares específicos
        dexes[3] = BALANCER_VAULT;      // Para pools balanceados
        dexes[4] = DODO_PROXY;          // Para arbitraje
        dexes[5] = ONEINCH_ROUTER;      // Agregador

        uint256 bestRate = 0;
        
        for (uint256 i = 0; i < dexes.length; i++) {
            if (dexRegistry.isDEXSupported(dexes[i])) {
                uint256 rate = dexRegistry.getAmountOut(
                    dexes[i],
                    tokenIn,
                    tokenOut,
                    1 ether,
                    _getPolygonOptimalFee(tokenIn, tokenOut)
                );

                if (rate > bestRate) {
                    bestRate = rate;
                    bestDEX = dexes[i];
                }
            }
        }

        require(bestDEX != address(0), "No suitable Polygon DEX");
    }

    function _getPolygonOptimalFee(
        address tokenA,
        address tokenB
    ) internal pure returns (uint24 fee) {
        
        // Fees optimizados para Polygon
        if (_isPolygonStablePair(tokenA, tokenB)) {
            return 100; // 0.01% para stables
        } else if (_isPolygonMainPair(tokenA, tokenB)) {
            return 300; // 0.03% para pares principales
        } else {
            return 500; // 0.05% para otros
        }
    }

    function _isPolygonStablePair(address tokenA, address tokenB) internal pure returns (bool) {
        return (tokenA == USDC || tokenA == DAI || tokenA == USDT) &&
               (tokenB == USDC || tokenB == DAI || tokenB == USDT);
    }

    function _isPolygonMainPair(address tokenA, address tokenB) internal pure returns (bool) {
        return (tokenA == WMATIC || tokenA == WETH) || 
               (tokenB == WMATIC || tokenB == WETH);
    }

    function _getPolygonSlippage(address tokenA, address tokenB) internal pure returns (uint256) {
        if (_isPolygonStablePair(tokenA, tokenB)) {
            return 50; // 0.5% para stables
        } else if (_isPolygonMainPair(tokenA, tokenB)) {
            return 100; // 1% para pares principales  
        } else {
            return 200; // 2% para otros
        }
    }

    function _calculatePolygonProfitability(
        address tokenA,
        address tokenB,
        uint256 amountIn,
        PolygonRoute calldata route
    ) internal view returns (
        uint256 expectedProfit,
        uint256 gasEstimate,
        bool isProfitable
    ) {
        
        // Estimar gas específico para Polygon (muy bajo)
        gasEstimate = 150000; // Gas base muy bajo en Polygon
        
        // Calcular amount out esperado
        uint256 amountOut1 = dexRegistry.getAmountOut(
            route.dexA, tokenA, tokenB, amountIn, route.feeA
        );
        
        uint256 amountOut2 = dexRegistry.getAmountOut(
            route.dexB, tokenB, tokenA, amountOut1, route.feeB
        );

        // Calcular profit considerando gas ultra bajo
        if (amountOut2 > amountIn) {
            expectedProfit = amountOut2 - amountIn;
            
            // Gas cost en Polygon es mínimo
            uint256 gasCostWei = tx.gasprice * gasEstimate;
            uint256 gasCostInToken = _convertWeiToToken(gasCostWei, tokenA);
            
            isProfitable = expectedProfit > gasCostInToken + POLYGON_MIN_PROFIT;
        } else {
            expectedProfit = 0;
            isProfitable = false;
        }
    }

    function _convertWeiToToken(
        uint256 weiAmount,
        address token
    ) internal view returns (uint256 tokenAmount) {
        
        if (token == WMATIC) {
            return weiAmount; // Direct MATIC
        }
        
        // Usar price oracle o DEX rate para conversión
        tokenAmount = dexRegistry.getAmountOut(
            QUICKSWAP_ROUTER,
            WMATIC,
            token,
            weiAmount,
            500
        );
    }

    // ============ POLYGON-SPECIFIC GETTERS ============

    function getPolygonConfig() external pure returns (
        uint256 maxGasPrice,
        uint256 minProfit,
        uint256 optimalGas,
        address[] memory supportedDEXs
    ) {
        maxGasPrice = POLYGON_MAX_GAS_PRICE;
        minProfit = POLYGON_MIN_PROFIT;
        optimalGas = POLYGON_OPTIMAL_GAS;
        
        supportedDEXs = new address[](6);
        supportedDEXs[0] = QUICKSWAP_ROUTER;
        supportedDEXs[1] = SUSHISWAP_ROUTER;
        supportedDEXs[2] = UNISWAP_V3_ROUTER;
        supportedDEXs[3] = BALANCER_VAULT;
        supportedDEXs[4] = DODO_PROXY;
        supportedDEXs[5] = ONEINCH_ROUTER;
    }

    function getPolygonTokens() external pure returns (address[] memory tokens) {
        tokens = new address[](7);
        tokens[0] = WMATIC;
        tokens[1] = USDC;
        tokens[2] = USDT;
        tokens[3] = DAI;
        tokens[4] = WETH;
        tokens[5] = WBTC;
        tokens[6] = QUICK;
    }

    function getPolygonPools() external view returns (
        address quickMaticUsdc,
        address quickEthUsdc,
        address sushiMaticUsdc,
        address balancerStable
    ) {
        quickMaticUsdc = polygonPools[keccak256("QUICK_WMATIC_USDC")];
        quickEthUsdc = polygonPools[keccak256("QUICK_WETH_USDC")];
        sushiMaticUsdc = polygonPools[keccak256("SUSHI_WMATIC_USDC")];
        balancerStable = polygonPools[keccak256("BAL_STABLE_POOL")];
    }
}
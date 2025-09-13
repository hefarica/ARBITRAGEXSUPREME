// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../../core/ArbitrageExecutor.sol";

/**
 * @title BSCArbitrage
 * @dev Contrato especializado para Binance Smart Chain - Costos ultra bajos
 * @notice Optimizado para PancakeSwap V2/V3, Biswap, SushiSwap, Venus, Alpaca
 */
contract BSCArbitrage is ArbitrageExecutor {
    
    // Direcciones específicas de BSC
    address private constant PANCAKESWAP_V2_ROUTER = 0x10ED43C718714eb63d5aA57B78B54704E256024E;
    address private constant PANCAKESWAP_V3_ROUTER = 0x1b81D678ffb9C0263b24A97847620C99d213eB14;
    address private constant BISWAP_ROUTER = 0x3a6d8cA21D1CF76F653A67577FA0D27453350dD8;
    address private constant SUSHISWAP_ROUTER = 0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506;
    address private constant VENUS_COMPTROLLER = 0xfD36E2c2a6789Db23113685031d7F16329158384;
    address private constant ALPACA_VAULT = 0xA625AB01B08ce023B2a342Dbb12a16f2C8489A8F;
    address private constant ONEINCH_ROUTER = 0x1111111254EEB25477B68fb85Ed929f73A960582;
    address private constant DODO_PROXY = 0x8F8Dd7DB1bDA5eD3da8C9daf3bfa471c12d58486;
    
    // Tokens principales de BSC
    address private constant WBNB = 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c;
    address private constant BUSD = 0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56;
    address private constant USDT = 0x55d398326f99059fF775485246999027B3197955;
    address private constant USDC = 0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d;
    address private constant ETH = 0x2170Ed0880ac9A755fd29B2688956BD959F933F8;
    address private constant BTCB = 0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c;
    address private constant CAKE = 0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82;

    // Configuración específica de BSC (gas extremadamente bajo)
    uint256 private constant BSC_MAX_GAS_PRICE = 20 gwei; // Muy bajo en BSC
    uint256 private constant BSC_MIN_PROFIT = 25; // 0.25% por gas ultra bajo
    uint256 private constant BSC_OPTIMAL_GAS = 5 gwei;

    // Pools específicos de BSC para arbitraje
    mapping(bytes32 => address) public bscPools;
    mapping(address => uint256) public poolLiquidities;

    constructor(address _dexRegistry) 
        ArbitrageExecutor(
            _dexRegistry,
            address(0), // No Aave en BSC nativo
            address(0), // No Balancer nativo
            PANCAKESWAP_V3_ROUTER,
            BSC_MAX_GAS_PRICE,
            BSC_MIN_PROFIT
        ) 
    {
        // Setup tokens principales de BSC
        supportedTokens[WBNB] = true;
        supportedTokens[BUSD] = true;
        supportedTokens[USDT] = true;
        supportedTokens[USDC] = true;
        supportedTokens[ETH] = true;
        supportedTokens[BTCB] = true;
        supportedTokens[CAKE] = true;

        // Setup proveedores de flash loans para BSC
        flashLoanProviders[DODO_PROXY] = true; // DODO con 0% fees
        flashLoanProviders[PANCAKESWAP_V3_ROUTER] = true; // PCS V3 flash swaps

        // Initialize BSC-specific pools
        _initializeBSCPools();
    }

    /**
     * @dev Ejecuta arbitraje optimizado para BSC con costos mínimos
     */
    function executeBSCArbitrage(
        address tokenA,
        address tokenB,
        uint256 amountIn,
        BSCRoute calldata route
    ) external payable nonReentrant whenNotPaused onlyExecutor returns (uint256 profit) {
        
        require(supportedTokens[tokenA] && supportedTokens[tokenB], "Unsupported token");
        require(tx.gasprice <= BSC_OPTIMAL_GAS, "Gas price too high for BSC efficiency");

        // Configuración ultra optimizada para BSC
        ArbitrageParams memory params = ArbitrageParams({
            tokenA: tokenA,
            tokenB: tokenB,
            tokenC: address(0),
            amountIn: amountIn,
            minAmountOut: route.minAmountOut,
            maxGasPrice: BSC_MAX_GAS_PRICE,
            deadline: uint32(block.timestamp + 1800), // 30 minutos
            routeData: abi.encode(route),
            useFlashLoan: amountIn > 500 * 1e18, // Flash loan para amounts > 500 BUSD
            flashLoanProvider: DODO_PROXY // DODO por 0% fees
        });

        // Crear ruta optimizada para BSC
        SwapRoute[] memory routes = _buildBSCOptimizedRoute(tokenA, tokenB, amountIn, route);
        
        ExecutionResult memory result = executeArbitrage(params, routes);
        require(result.success, result.errorMessage);
        
        return result.profit;
    }

    /**
     * @dev Arbitraje PancakeSwap V2 vs V3 - Muy rentable en BSC
     */
    function executePancakeV2V3Arbitrage(
        address tokenA,
        address tokenB,
        uint256 amountIn,
        uint24 v3Fee
    ) external payable nonReentrant whenNotPaused onlyExecutor returns (uint256 profit) {
        
        require(supportedTokens[tokenA] && supportedTokens[tokenB], "Unsupported tokens");
        
        // Crear rutas específicas V2 vs V3
        SwapRoute[] memory routes = new SwapRoute[](2);
        
        // Comprar en V2
        routes[0] = SwapRoute({
            dex: PANCAKESWAP_V2_ROUTER,
            tokenIn: tokenA,
            tokenOut: tokenB,
            amountIn: amountIn,
            minAmountOut: _calculateBSCMinAmount(tokenA, tokenB, amountIn, 200), // 2% slippage V2
            fee: 300, // 0.3% PCS V2 fee
            extraData: abi.encode("PCS_V2")
        });

        // Vender en V3
        routes[1] = SwapRoute({
            dex: PANCAKESWAP_V3_ROUTER,
            tokenIn: tokenB,
            tokenOut: tokenA,
            amountIn: 0, // Calculado dinámicamente
            minAmountOut: amountIn + (amountIn * BSC_MIN_PROFIT) / 10000,
            fee: v3Fee,
            extraData: abi.encode("PCS_V3", v3Fee)
        });

        ArbitrageParams memory params = ArbitrageParams({
            tokenA: tokenA,
            tokenB: tokenB,
            tokenC: address(0),
            amountIn: amountIn,
            minAmountOut: routes[1].minAmountOut,
            maxGasPrice: BSC_MAX_GAS_PRICE,
            deadline: uint32(block.timestamp + 600),
            routeData: abi.encode("PCS_V2_V3_ARB"),
            useFlashLoan: false, // Directo por rapidez
            flashLoanProvider: address(0)
        });

        ExecutionResult memory result = executeArbitrage(params, routes);
        require(result.success, result.errorMessage);
        
        return result.profit;
    }

    /**
     * @dev Flash loan con DODO - 0% fees + arbitraje múltiple BSC
     */
    function executeDODOBSCFlashArbitrage(
        address baseToken,
        uint256 flashAmount,
        BSCFlashRoute calldata route
    ) external payable nonReentrant whenNotPaused onlyExecutor returns (uint256 profit) {
        
        require(supportedTokens[baseToken], "Unsupported base token");
        require(route.dexes.length >= 2 && route.dexes.length <= 4, "Invalid DEX count");

        bytes memory params = abi.encode(
            ArbitrageParams({
                tokenA: baseToken,
                tokenB: route.targetToken,
                tokenC: address(0),
                amountIn: flashAmount,
                minAmountOut: route.minFinalAmount,
                maxGasPrice: BSC_MAX_GAS_PRICE,
                deadline: uint32(block.timestamp + 300), // 5 min para flash loan
                routeData: abi.encode(route),
                useFlashLoan: true,
                flashLoanProvider: DODO_PROXY
            }),
            _buildDODOBSCRoute(baseToken, route)
        );

        ExecutionResult memory result = executeFlashLoanArbitrage(
            DODO_PROXY,
            baseToken,
            flashAmount,
            params
        );

        require(result.success, result.errorMessage);
        return result.profit;
    }

    /**
     * @dev Arbitraje entre Biswap y PancakeSwap - Oportunidad exclusiva BSC
     */
    function executeBiswapPancakeArbitrage(
        address tokenA,
        address tokenB,
        uint256 amountIn
    ) external payable nonReentrant whenNotPaused onlyExecutor returns (uint256 profit) {
        
        require(_isBSCMainPair(tokenA, tokenB), "Use main pairs for better liquidity");

        // Determinar dirección óptima
        (bool buyBiswap, uint256 expectedProfit) = _analyzeBiswapPancakeOpportunity(tokenA, tokenB, amountIn);
        require(expectedProfit > BSC_MIN_PROFIT, "Insufficient profit opportunity");

        SwapRoute[] memory routes = new SwapRoute[](2);
        
        if (buyBiswap) {
            // Comprar en Biswap, vender en PancakeSwap
            routes[0] = _createBSCRoute(BISWAP_ROUTER, tokenA, tokenB, amountIn, 250); // 0.25% Biswap
            routes[1] = _createBSCRoute(PANCAKESWAP_V2_ROUTER, tokenB, tokenA, 0, 300); // 0.3% PCS
        } else {
            // Comprar en PancakeSwap, vender en Biswap
            routes[0] = _createBSCRoute(PANCAKESWAP_V2_ROUTER, tokenA, tokenB, amountIn, 300);
            routes[1] = _createBSCRoute(BISWAP_ROUTER, tokenB, tokenA, 0, 250);
        }

        ArbitrageParams memory params = ArbitrageParams({
            tokenA: tokenA,
            tokenB: tokenB,
            tokenC: address(0),
            amountIn: amountIn,
            minAmountOut: amountIn + expectedProfit,
            maxGasPrice: BSC_MAX_GAS_PRICE,
            deadline: uint32(block.timestamp + 600),
            routeData: abi.encode("BISWAP_PCS_ARB", buyBiswap),
            useFlashLoan: false,
            flashLoanProvider: address(0)
        });

        ExecutionResult memory result = executeArbitrage(params, routes);
        require(result.success, result.errorMessage);
        
        return result.profit;
    }

    // ============ BSC-SPECIFIC STRUCTS ============

    struct BSCRoute {
        address dexA;
        address dexB;
        uint24 feeA;
        uint24 feeB;
        uint256 minAmountOut;
        bytes extraData;
    }

    struct BSCFlashRoute {
        address targetToken;
        address[] dexes;
        uint24[] fees;
        uint256 minFinalAmount;
        bytes flashData;
    }

    // ============ INTERNAL BSC-SPECIFIC FUNCTIONS ============

    function _initializeBSCPools() internal {
        // PancakeSwap V2 pools principales
        bscPools[keccak256("PCS_V2_BNB_BUSD")] = 0x58F876857a02D6762E0101bb5C46A8c1ED44Dc16;
        bscPools[keccak256("PCS_V2_BNB_USDT")] = 0x16b9a82891338f9bA80E2D6970FddA79D1eb0daE;
        bscPools[keccak256("PCS_V2_BUSD_USDT")] = 0x7EFaEf62fDdCCa950418312c6C91Aef321375A00;
        
        // PancakeSwap V3 pools
        bscPools[keccak256("PCS_V3_BNB_BUSD_100")] = 0x172fcD41E0913e95784454622d1c3724f546f849; // 0.01%
        bscPools[keccak256("PCS_V3_BNB_BUSD_500")] = 0x46Cf1cF8c69595804ba91dFdd8d6b960c9CB85d82; // 0.05%
        
        // Biswap pools
        bscPools[keccak256("BISWAP_BNB_BUSD")] = 0xaCAac9311b0096E04Dfe96b6D87dec867d3883Dc;
        bscPools[keccak256("BISWAP_BNB_USDT")] = 0xDa8ceb724A06819c0A5cDb4304ea0cB27F8304cF;

        // Initialize liquidities (placeholder - en producción obtener de pools)
        poolLiquidities[bscPools[keccak256("PCS_V2_BNB_BUSD")]] = 100000000 * 1e18; // $100M
        poolLiquidities[bscPools[keccak256("BISWAP_BNB_BUSD")]] = 50000000 * 1e18;   // $50M
    }

    function _buildBSCOptimizedRoute(
        address tokenA,
        address tokenB,
        uint256 amountIn,
        BSCRoute calldata route
    ) internal view returns (SwapRoute[] memory routes) {
        
        routes = new SwapRoute[](2);
        
        routes[0] = SwapRoute({
            dex: route.dexA,
            tokenIn: tokenA,
            tokenOut: tokenB,
            amountIn: amountIn,
            minAmountOut: _calculateBSCMinAmount(tokenA, tokenB, amountIn, 100), // 1% slippage BSC
            fee: route.feeA,
            extraData: abi.encode("BSC_OPTIMIZED", block.timestamp)
        });

        routes[1] = SwapRoute({
            dex: route.dexB,
            tokenIn: tokenB,
            tokenOut: tokenA,
            amountIn: 0,
            minAmountOut: route.minAmountOut,
            fee: route.feeB,
            extraData: abi.encode("BSC_OPTIMIZED", block.timestamp)
        });
    }

    function _buildDODOBSCRoute(
        address baseToken,
        BSCFlashRoute calldata route
    ) internal view returns (SwapRoute[] memory routes) {
        
        routes = new SwapRoute[](route.dexes.length);
        
        for (uint256 i = 0; i < route.dexes.length; i++) {
            routes[i] = SwapRoute({
                dex: route.dexes[i],
                tokenIn: i % 2 == 0 ? baseToken : route.targetToken,
                tokenOut: i % 2 == 0 ? route.targetToken : baseToken,
                amountIn: i == 0 ? 0 : 0, // Calculado dinámicamente
                minAmountOut: i == route.dexes.length - 1 ? route.minFinalAmount : 0,
                fee: route.fees[i],
                extraData: route.flashData
            });
        }
    }

    function _createBSCRoute(
        address dex,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint24 fee
    ) internal view returns (SwapRoute memory) {
        
        return SwapRoute({
            dex: dex,
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            amountIn: amountIn,
            minAmountOut: amountIn > 0 ? _calculateBSCMinAmount(tokenIn, tokenOut, amountIn, 150) : 0, // 1.5%
            fee: fee,
            extraData: abi.encode("BSC_ROUTE", dex, fee)
        });
    }

    function _analyzeBiswapPancakeOpportunity(
        address tokenA,
        address tokenB,
        uint256 amountIn
    ) internal view returns (bool buyBiswap, uint256 expectedProfit) {
        
        // Obtener precios en ambos DEXs
        uint256 biswapPrice = dexRegistry.getAmountOut(
            BISWAP_ROUTER, tokenA, tokenB, amountIn, 250
        );
        
        uint256 pancakePrice = dexRegistry.getAmountOut(
            PANCAKESWAP_V2_ROUTER, tokenA, tokenB, amountIn, 300
        );

        // Determinar dirección óptima
        if (biswapPrice > pancakePrice) {
            // Vender en Biswap es mejor - comprar en PancakeSwap
            buyBiswap = false;
            uint256 sellAmountBiswap = dexRegistry.getAmountOut(
                BISWAP_ROUTER, tokenB, tokenA, pancakePrice, 250
            );
            if (sellAmountBiswap > amountIn) {
                expectedProfit = sellAmountBiswap - amountIn;
            }
        } else {
            // Vender en PancakeSwap es mejor - comprar en Biswap  
            buyBiswap = true;
            uint256 sellAmountPancake = dexRegistry.getAmountOut(
                PANCAKESWAP_V2_ROUTER, tokenB, tokenA, biswapPrice, 300
            );
            if (sellAmountPancake > amountIn) {
                expectedProfit = sellAmountPancake - amountIn;
            }
        }
    }

    function _calculateBSCMinAmount(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 slippageBps
    ) internal view returns (uint256 minAmount) {
        
        if (amountIn == 0) return 0;
        
        address bestDEX = _selectBSCBestDEX(tokenIn, tokenOut);
        uint256 estimatedOut = dexRegistry.getAmountOut(
            bestDEX,
            tokenIn,
            tokenOut,
            amountIn,
            _getBSCOptimalFee(tokenIn, tokenOut)
        );

        minAmount = (estimatedOut * (10000 - slippageBps)) / 10000;
    }

    function _selectBSCBestDEX(
        address tokenIn,
        address tokenOut
    ) internal view returns (address bestDEX) {
        
        // Priorizar DEXs por liquidez en BSC
        address[] memory dexes = new address[](5);
        dexes[0] = PANCAKESWAP_V2_ROUTER;  // Mayor liquidez
        dexes[1] = PANCAKESWAP_V3_ROUTER;  // Mejor para ciertos pares
        dexes[2] = BISWAP_ROUTER;          // Fees más bajos
        dexes[3] = SUSHISWAP_ROUTER;       // Alternativa
        dexes[4] = DODO_PROXY;             // PMM

        uint256 bestRate = 0;
        
        for (uint256 i = 0; i < dexes.length; i++) {
            if (dexRegistry.isDEXSupported(dexes[i])) {
                uint256 rate = dexRegistry.getAmountOut(
                    dexes[i],
                    tokenIn,
                    tokenOut,
                    1 ether,
                    _getBSCOptimalFee(tokenIn, tokenOut)
                );

                if (rate > bestRate) {
                    bestRate = rate;
                    bestDEX = dexes[i];
                }
            }
        }

        require(bestDEX != address(0), "No suitable BSC DEX");
    }

    function _getBSCOptimalFee(
        address tokenA,
        address tokenB
    ) internal pure returns (uint24 fee) {
        
        // Fees específicos para BSC
        if (_isBSCStablePair(tokenA, tokenB)) {
            return 100; // 0.01% para stables
        } else if (_isBSCMainPair(tokenA, tokenB)) {
            return 250; // 0.025% para pares principales (Biswap fee)
        } else {
            return 300; // 0.3% PancakeSwap standard
        }
    }

    function _isBSCStablePair(address tokenA, address tokenB) internal pure returns (bool) {
        return (tokenA == BUSD || tokenA == USDT || tokenA == USDC) &&
               (tokenB == BUSD || tokenB == USDT || tokenB == USDC);
    }

    function _isBSCMainPair(address tokenA, address tokenB) internal pure returns (bool) {
        return (tokenA == WBNB || tokenA == BUSD || tokenA == ETH || tokenA == BTCB) &&
               (tokenB == WBNB || tokenB == BUSD || tokenB == ETH || tokenB == BTCB);
    }

    // ============ BSC-SPECIFIC GETTERS ============

    function getBSCConfig() external pure returns (
        uint256 maxGasPrice,
        uint256 minProfit,
        uint256 optimalGas,
        address[] memory supportedDEXs
    ) {
        maxGasPrice = BSC_MAX_GAS_PRICE;
        minProfit = BSC_MIN_PROFIT;
        optimalGas = BSC_OPTIMAL_GAS;
        
        supportedDEXs = new address[](5);
        supportedDEXs[0] = PANCAKESWAP_V2_ROUTER;
        supportedDEXs[1] = PANCAKESWAP_V3_ROUTER;
        supportedDEXs[2] = BISWAP_ROUTER;
        supportedDEXs[3] = SUSHISWAP_ROUTER;
        supportedDEXs[4] = DODO_PROXY;
    }

    function getBSCTokens() external pure returns (address[] memory tokens) {
        tokens = new address[](7);
        tokens[0] = WBNB;
        tokens[1] = BUSD;
        tokens[2] = USDT;
        tokens[3] = USDC;
        tokens[4] = ETH;
        tokens[5] = BTCB;
        tokens[6] = CAKE;
    }

    function getBSCPools() external view returns (
        address pcsV2BnbBusd,
        address pcsV3BnbBusd100,
        address pcsV3BnbBusd500,
        address biswapBnbBusd
    ) {
        pcsV2BnbBusd = bscPools[keccak256("PCS_V2_BNB_BUSD")];
        pcsV3BnbBusd100 = bscPools[keccak256("PCS_V3_BNB_BUSD_100")];
        pcsV3BnbBusd500 = bscPools[keccak256("PCS_V3_BNB_BUSD_500")];
        biswapBnbBusd = bscPools[keccak256("BISWAP_BNB_BUSD")];
    }

    function getBSCLiquidityInfo(address pool) external view returns (uint256 liquidity) {
        return poolLiquidities[pool];
    }
}
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../../core/ArbitrageExecutor.sol";

/**
 * @title ArbitrumArbitrage
 * @dev Contrato especializado para Arbitrum One - Layer 2 de ultra bajo gas
 * @notice Optimizado para Uniswap V3, SushiSwap, Balancer, Camelot, GMX
 */
contract ArbitrumArbitrage is ArbitrageExecutor {
    
    // Direcciones específicas de Arbitrum
    address private constant UNISWAP_V3_ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
    address private constant SUSHISWAP_ROUTER = 0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506;
    address private constant BALANCER_VAULT = 0xBA12222222228d8Ba445958a75a0704d566BF2C8;
    address private constant CAMELOT_ROUTER = 0xc873fEcbd354f5A56E00E710B90EF4201db2448d;
    address private constant GMX_ROUTER = 0xaBBc5F99639c9B6bCb58544ddf04EFA6802F4064;
    address private constant ONEINCH_ROUTER = 0x1111111254EEB25477B68fb85Ed929f73A960582;
    address private constant DODO_PROXY = 0x88CBf433471A0CD8240D2a12354362988b4593E5;
    
    // Flash loan providers en Arbitrum
    address private constant AAVE_POOL = 0x794a61358D6845594F94dc1DB02A252b5b4814aD;
    address private constant RADIANT_POOL = 0xF4B1486DD74D07706052A33d31d7c0AAFD0659E1;
    
    // Tokens principales de Arbitrum
    address private constant WETH = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;
    address private constant USDC = 0xA0b86a33E6417aB84cC5C5C60078462D3eF6CaDB;
    address private constant USDT = 0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9;
    address private constant DAI = 0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1;
    address private constant WBTC = 0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f;
    address private constant ARB = 0x912CE59144191C1204E64559FE8253a0e49E6548;
    address private constant GMX = 0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a;

    // Configuración específica de Arbitrum (gas ultra bajo L2)
    uint256 private constant ARBITRUM_MAX_GAS_PRICE = 1 gwei; // L2 ultra bajo
    uint256 private constant ARBITRUM_MIN_PROFIT = 15; // 0.15% por gas ultra bajo
    uint256 private constant ARBITRUM_OPTIMAL_GAS = 0.1 gwei;
    uint256 private constant L1_DATA_FEE = 0.001 ether; // Fee adicional L1

    // Pools específicos de Arbitrum para arbitraje
    mapping(bytes32 => address) public arbitrumPools;
    mapping(address => uint256) public poolLiquidities;
    mapping(address => bool) public camelotPools;

    struct ArbitrumRoute {
        address[] exchanges; // Camelot, Uniswap, Sushi, etc
        uint256[] fees; // Fees para cada exchange
        bytes[] swapData;
        uint256 minAmountOut;
        bool useL2Optimization;
        bool enableMEVProtection;
    }

    constructor(address _dexRegistry) 
        ArbitrageExecutor(
            _dexRegistry,
            AAVE_POOL, // Aave V3 en Arbitrum
            BALANCER_VAULT, // Balancer V2 en Arbitrum
            UNISWAP_V3_ROUTER,
            ARBITRUM_MAX_GAS_PRICE,
            ARBITRUM_MIN_PROFIT
        ) 
    {
        // Setup tokens principales de Arbitrum
        supportedTokens[WETH] = true;
        supportedTokens[USDC] = true;
        supportedTokens[USDT] = true;
        supportedTokens[DAI] = true;
        supportedTokens[WBTC] = true;
        supportedTokens[ARB] = true;
        supportedTokens[GMX] = true;

        // Setup proveedores de flash loans para Arbitrum
        flashLoanProviders[AAVE_POOL] = true; // Aave V3
        flashLoanProviders[BALANCER_VAULT] = true; // Balancer con 0% fees
        flashLoanProviders[DODO_PROXY] = true; // DODO con 0% fees
        flashLoanProviders[RADIANT_POOL] = true; // Radiant Capital

        // Initialize Arbitrum-specific pools
        _initializeArbitrumPools();
    }

    /**
     * @dev Ejecuta arbitraje optimizado para Arbitrum con L2 efficiency
     */
    function executeArbitrumArbitrage(
        address tokenA,
        address tokenB,
        uint256 amountIn,
        ArbitrumRoute calldata route
    ) external payable nonReentrant whenNotPaused onlyExecutor returns (uint256 profit) {
        
        require(supportedTokens[tokenA] && supportedTokens[tokenB], "Unsupported token");
        require(tx.gasprice <= ARBITRUM_OPTIMAL_GAS, "Gas price too high for Arbitrum efficiency");

        // Configuración ultra optimizada para Arbitrum L2
        ArbitrageParams memory params = ArbitrageParams({
            tokenA: tokenA,
            tokenB: tokenB,
            tokenC: address(0),
            amountIn: amountIn,
            minAmountOut: route.minAmountOut,
            maxGasPrice: ARBITRUM_MAX_GAS_PRICE,
            deadline: uint32(block.timestamp + 900), // 15 minutos por L2 speed
            routeData: abi.encode(route),
            useFlashLoan: amountIn > 100 * 1e6, // Flash loan para amounts > 100 USDC
            flashLoanProvider: BALANCER_VAULT // Balancer por 0% fees
        });

        // Crear ruta optimizada para Arbitrum
        SwapRoute[] memory routes = _buildArbitrumOptimizedRoute(tokenA, tokenB, amountIn, route);
        
        ExecutionResult memory result = executeArbitrage(params, routes);
        require(result.success, result.errorMessage);
        
        profit = result.actualProfit;
        
        // Optimización L2: batch múltiples operaciones si es profitable
        if (route.useL2Optimization && profit > (amountIn * ARBITRUM_MIN_PROFIT) / 10000) {
            _optimizeL2Batch(tokenA, tokenB, profit);
        }

        emit ArbitrageExecuted(
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
     * @dev Ejecuta arbitraje triangular optimizado para Arbitrum
     */
    function executeTriangularArbitrumArbitrage(
        address tokenA,
        address tokenB,
        address tokenC,
        uint256 amountIn,
        ArbitrumRoute[] calldata routes
    ) external payable nonReentrant whenNotPaused onlyExecutor returns (uint256 profit) {
        
        require(routes.length == 3, "Triangular arbitrage requires exactly 3 routes");
        require(supportedTokens[tokenA] && supportedTokens[tokenB] && supportedTokens[tokenC], "Unsupported token");

        uint256 gasStart = gasleft();
        
        // Ruta: A -> B -> C -> A
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

        uint256 amount1 = _executeSwap(swapRoutes[0]);
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

        uint256 amount2 = _executeSwap(swapRoutes[1]);
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

        uint256 finalAmount = _executeSwap(swapRoutes[2]);
        require(finalAmount > amountIn, "No arbitrage profit");
        
        profit = finalAmount - amountIn;
        uint256 gasUsed = gasStart - gasleft();

        // Verificar profit mínimo para Arbitrum
        uint256 minProfit = (amountIn * ARBITRUM_MIN_PROFIT) / 10000;
        require(profit >= minProfit, "Profit below minimum threshold");

        emit TriangularArbitrageExecuted(
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
     * @dev Construye ruta optimizada para Arbitrum
     */
    function _buildArbitrumOptimizedRoute(
        address tokenA,
        address tokenB,
        uint256 amountIn,
        ArbitrumRoute calldata route
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
     * @dev Optimización específica para L2 batching
     */
    function _optimizeL2Batch(address tokenA, address tokenB, uint256 profit) internal {
        // Si el profit es significativo, considera hacer swap adicionales
        if (profit > 10 * 1e6) { // > 10 USDC profit
            // Lógica para optimizar batches en L2
            // Puede reinvertir parte del profit inmediatamente
        }
    }

    /**
     * @dev Inicializa pools específicos de Arbitrum
     */
    function _initializeArbitrumPools() internal {
        // Uniswap V3 pools principales
        arbitrumPools[keccak256(abi.encodePacked(WETH, USDC, uint24(500)))] = 0xC31E54c7a869B9FcBEcc14363CF510d1c41fa443;
        arbitrumPools[keccak256(abi.encodePacked(WETH, USDC, uint24(3000)))] = 0x17c14D2c404D167802b16C450d3c99F88F2c4F4d;
        arbitrumPools[keccak256(abi.encodePacked(WETH, WBTC, uint24(3000)))] = 0x2f5e87C9312fa29aed5c179E456625D79015299c;
        
        // Camelot pools
        camelotPools[0x84652bb2539513BAf36e225c930Fdd8eaa63CE27] = true; // WETH/USDC
        camelotPools[0xa6c5C7D189fA4aB74f5f8ceaD0C2F1d8e8872Db0] = true; // WETH/ARB
        
        // Actualizar liquidez inicial
        poolLiquidities[0xC31E54c7a869B9FcBEcc14363CF510d1c41fa443] = 50000000 * 1e6; // 50M USDC
        poolLiquidities[0x17c14D2c404D167802b16C450d3c99F88F2c4F4d] = 100000000 * 1e6; // 100M USDC
    }

    /**
     * @dev Calcula fee optimizado para Arbitrum incluyendo L1 data cost
     */
    function calculateArbitrumFee(uint256 gasUsed) external pure returns (uint256) {
        return (gasUsed * ARBITRUM_OPTIMAL_GAS) + L1_DATA_FEE;
    }

    /**
     * @dev Verifica si un pool de Camelot está activo
     */
    function isCamelotPool(address pool) external view returns (bool) {
        return camelotPools[pool];
    }

    /**
     * @dev Obtiene la liquidez de un pool específico
     */
    function getPoolLiquidity(address pool) external view returns (uint256) {
        return poolLiquidities[pool];
    }

    /**
     * @dev Actualiza configuración específica de Arbitrum
     */
    function updateArbitrumConfig(
        uint256 newMaxGasPrice,
        uint256 newMinProfit
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newMaxGasPrice <= 2 gwei, "Gas price too high for Arbitrum");
        require(newMinProfit >= 10 && newMinProfit <= 100, "Invalid profit threshold");
        
        // Actualizar en el contrato padre
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

    // Eventos específicos de Arbitrum
    event ArbitrageExecuted(
        address indexed executor,
        address indexed tokenA,
        address indexed tokenB,
        uint256 amountIn,
        uint256 profit,
        uint256 gasUsed,
        uint256 chainId
    );

    event TriangularArbitrageExecuted(
        address indexed executor,
        address indexed tokenA,
        address indexed tokenB,
        address indexed tokenC,
        uint256 amountIn,
        uint256 amountOut,
        uint256 profit,
        uint256 gasUsed
    );

    event L2OptimizationExecuted(
        address indexed token,
        uint256 amount,
        uint256 additionalProfit
    );
}
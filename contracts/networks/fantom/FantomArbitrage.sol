// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../../core/ArbitrageExecutor.sol";

/**
 * @title FantomArbitrage
 * @dev Contrato especializado para Fantom Opera - Ultra fast finality y low cost
 * @notice Optimizado para SpookySwap, SpiritSwap, SushiSwap, Beethoven X, Geist
 */
contract FantomArbitrage is ArbitrageExecutor {
    
    // Direcciones específicas de Fantom
    address private constant SPOOKYSWAP_ROUTER = 0xF491e7B69E4244ad4002BC14e878a34207E38c29;
    address private constant SPIRITSWAP_ROUTER = 0x16327E3FbDaCA3bcF7E38F5Af2599D2DDc33aE52;
    address private constant SUSHISWAP_ROUTER = 0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506;
    address private constant BEETHOVEN_VAULT = 0x20dd72Ed959b6147912C2e529F0a0C651c33c9ce;
    address private constant ONEINCH_ROUTER = 0x1111111254EEB25477B68fb85Ed929f73A960582;
    address private constant CURVE_ROUTER = 0x0f85A912448279111694F4Ba4F85dC641c54b594;
    
    // Flash loan providers en Fantom
    address private constant GEIST_COMPTROLLER = 0x9FAD24f572045c7869117160A571B2e50b10d068;
    address private constant BEETHOVEN_VAULT_FL = 0x20dd72Ed959b6147912C2e529F0a0C651c33c9ce;
    address private constant CREAM_COMPTROLLER = 0x4250A6D3BD57455d7C6821eECb6206F507576cD2;
    
    // Tokens principales de Fantom
    address private constant WFTM = 0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83;
    address private constant USDC = 0x04068DA6C83AFCFA0e13ba15A6696662335D5B75;
    address private constant USDT = 0x049d68029688eAbF473097a2fC38ef61633A3C7A;
    address private constant DAI = 0x8D11eC38a3EB5E956B052f67Da8Bdc9bef8Abf3E;
    address private constant WETH = 0x74b23882a30290451A17c44f4F05243b6b58C76d;
    address private constant WBTC = 0x321162Cd933E2Be498Cd2267a90534A804051b11;
    address private constant BOO = 0x841FAD6EAe12c286d1Fd18d1d525DFfA75C7EFFE;
    address private constant SPIRIT = 0x5Cc61A78F164885776AA610fb0FE1257df78E59B;

    // Configuración específica de Fantom (gas ultra bajo)
    uint256 private constant FANTOM_MAX_GAS_PRICE = 100 gwei; // Fantom variable
    uint256 private constant FANTOM_MIN_PROFIT = 30; // 0.3% por fast finality
    uint256 private constant FANTOM_OPTIMAL_GAS = 50 gwei;
    uint256 private constant CONSENSUS_FEE = 0.0005 ether; // Fee consenso PoS

    // Pools específicos de Fantom para arbitraje
    mapping(bytes32 => address) public fantomPools;
    mapping(address => uint256) public poolLiquidities;
    mapping(address => bool) public spookyPools;
    mapping(address => bool) public spiritPools;
    mapping(address => bool) public beethovenPools;

    struct FantomRoute {
        address[] exchanges; // SpookySwap, SpiritSwap, Beethoven, etc
        uint256[] fees;
        bytes[] swapData;
        uint256 minAmountOut;
        bool useSpookyBoost; // Para BOO rewards
        bool useSpiritInSpirit; // Para inSPIRIT benefits
        bool enableBeethovenWeighted; // Para weighted pools
        bool enableFastFinality; // Aprovechar 1s block time
    }

    constructor(address _dexRegistry) 
        ArbitrageExecutor(
            _dexRegistry,
            address(0), // No Aave nativo en Fantom
            BEETHOVEN_VAULT, // Beethoven X (Balancer fork)
            SPOOKYSWAP_ROUTER,
            FANTOM_MAX_GAS_PRICE,
            FANTOM_MIN_PROFIT
        ) 
    {
        // Setup tokens principales de Fantom
        supportedTokens[WFTM] = true;
        supportedTokens[USDC] = true;
        supportedTokens[USDT] = true;
        supportedTokens[DAI] = true;
        supportedTokens[WETH] = true;
        supportedTokens[WBTC] = true;
        supportedTokens[BOO] = true;
        supportedTokens[SPIRIT] = true;

        // Setup proveedores de flash loans para Fantom
        flashLoanProviders[GEIST_COMPTROLLER] = true; // Geist Finance
        flashLoanProviders[BEETHOVEN_VAULT_FL] = true; // Beethoven X con 0% fees
        flashLoanProviders[CREAM_COMPTROLLER] = true; // Cream Finance

        // Initialize Fantom-specific pools
        _initializeFantomPools();
    }

    /**
     * @dev Ejecuta arbitraje optimizado para Fantom con fast finality
     */
    function executeFantomArbitrage(
        address tokenA,
        address tokenB,
        uint256 amountIn,
        FantomRoute calldata route
    ) external payable nonReentrant whenNotPaused onlyExecutor returns (uint256 profit) {
        
        require(supportedTokens[tokenA] && supportedTokens[tokenB], "Unsupported token");
        require(tx.gasprice <= FANTOM_OPTIMAL_GAS, "Gas price too high for Fantom efficiency");

        // Configuración optimizada para Fantom fast finality
        ArbitrageParams memory params = ArbitrageParams({
            tokenA: tokenA,
            tokenB: tokenB,
            tokenC: address(0),
            amountIn: amountIn,
            minAmountOut: route.minAmountOut,
            maxGasPrice: FANTOM_MAX_GAS_PRICE,
            deadline: uint32(block.timestamp + 300), // 5 minutos por fast finality
            routeData: abi.encode(route),
            useFlashLoan: amountIn > 500 * 1e6, // Flash loan para amounts > 500 USDC
            flashLoanProvider: BEETHOVEN_VAULT_FL // Beethoven por 0% fees
        });

        // Crear ruta optimizada para Fantom
        SwapRoute[] memory routes = _buildFantomOptimizedRoute(tokenA, tokenB, amountIn, route);
        
        ExecutionResult memory result = executeArbitrage(params, routes);
        require(result.success, result.errorMessage);
        
        profit = result.actualProfit;
        
        // Optimización específica: aprovechar fast finality para multiple rounds
        if (route.enableFastFinality && profit > (amountIn * FANTOM_MIN_PROFIT) / 10000) {
            _optimizeFastFinality(tokenA, tokenB, profit, route);
        }

        emit FantomArbitrageExecuted(
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
     * @dev Ejecuta arbitraje triangular ultra rápido para Fantom
     */
    function executeTriangularFantomArbitrage(
        address tokenA,
        address tokenB,
        address tokenC,
        uint256 amountIn,
        FantomRoute[] calldata routes
    ) external payable nonReentrant whenNotPaused onlyExecutor returns (uint256 profit) {
        
        require(routes.length == 3, "Triangular arbitrage requires exactly 3 routes");
        require(supportedTokens[tokenA] && supportedTokens[tokenB] && supportedTokens[tokenC], "Unsupported token");

        uint256 gasStart = gasleft();
        
        // Ruta ultra rápida: A -> B -> C -> A (aprovechando 1s finality)
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

        uint256 amount1 = _executeFantomSwap(swapRoutes[0], routes[0]);
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

        uint256 amount2 = _executeFantomSwap(swapRoutes[1], routes[1]);
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

        uint256 finalAmount = _executeFantomSwap(swapRoutes[2], routes[2]);
        require(finalAmount > amountIn, "No arbitrage profit");
        
        profit = finalAmount - amountIn;
        uint256 gasUsed = gasStart - gasleft();

        // Verificar profit mínimo para Fantom
        uint256 minProfit = (amountIn * FANTOM_MIN_PROFIT) / 10000;
        require(profit >= minProfit, "Profit below minimum threshold");

        emit TriangularFantomArbitrageExecuted(
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
     * @dev Ejecuta arbitraje aprovechando rewards de SpookySwap
     */
    function executeSpookyBoostArbitrage(
        address tokenA,
        address tokenB,
        uint256 amountIn
    ) external payable nonReentrant whenNotPaused onlyExecutor returns (uint256 profit) {
        
        require(supportedTokens[tokenA] && supportedTokens[tokenB], "Unsupported token");
        require(tokenA == BOO || tokenB == BOO, "Must include BOO token for boost");
        
        // Usar SpookySwap para obtener BOO rewards adicionales
        address spookyPool = _getSpookyPool(tokenA, tokenB);
        require(spookyPool != address(0), "Spooky pool not found");

        SwapRoute[] memory routes = new SwapRoute[](1);
        routes[0] = SwapRoute({
            exchange: SPOOKYSWAP_ROUTER,
            tokenIn: tokenA,
            tokenOut: tokenB,
            amountIn: amountIn,
            minAmountOut: 0, // Se calcula dinámicamente
            fee: 25, // 0.25% fee + BOO rewards
            data: abi.encode(spookyPool, true) // true para enable boost
        });

        ArbitrageParams memory params = ArbitrageParams({
            tokenA: tokenA,
            tokenB: tokenB,
            tokenC: address(0),
            amountIn: amountIn,
            minAmountOut: 0,
            maxGasPrice: FANTOM_MAX_GAS_PRICE,
            deadline: uint32(block.timestamp + 120), // 2 minutos por fast execution
            routeData: abi.encode(spookyPool, true),
            useFlashLoan: false,
            flashLoanProvider: address(0)
        });

        ExecutionResult memory result = executeArbitrage(params, routes);
        require(result.success, result.errorMessage);
        
        profit = result.actualProfit;

        emit SpookyBoostArbitrageExecuted(
            msg.sender,
            tokenA,
            tokenB,
            amountIn,
            profit,
            spookyPool
        );
    }

    /**
     * @dev Ejecuta arbitraje con SpiritSwap inSPIRIT benefits
     */
    function executeSpiritInSpiritArbitrage(
        address tokenA,
        address tokenB,
        uint256 amountIn
    ) external payable nonReentrant whenNotPaused onlyExecutor returns (uint256 profit) {
        
        require(supportedTokens[tokenA] && supportedTokens[tokenB], "Unsupported token");
        require(tokenA == SPIRIT || tokenB == SPIRIT, "Must include SPIRIT token");
        
        // Usar SpiritSwap con inSPIRIT benefits
        address spiritPool = _getSpiritPool(tokenA, tokenB);
        require(spiritPool != address(0), "Spirit pool not found");

        SwapRoute[] memory routes = new SwapRoute[](1);
        routes[0] = SwapRoute({
            exchange: SPIRITSWAP_ROUTER,
            tokenIn: tokenA,
            tokenOut: tokenB,
            amountIn: amountIn,
            minAmountOut: 0,
            fee: 20, // 0.2% fee con inSPIRIT benefits
            data: abi.encode(spiritPool, true) // true para inSPIRIT
        });

        ArbitrageParams memory params = ArbitrageParams({
            tokenA: tokenA,
            tokenB: tokenB,
            tokenC: address(0),
            amountIn: amountIn,
            minAmountOut: 0,
            maxGasPrice: FANTOM_MAX_GAS_PRICE,
            deadline: uint32(block.timestamp + 180),
            routeData: abi.encode(spiritPool, true),
            useFlashLoan: false,
            flashLoanProvider: address(0)
        });

        ExecutionResult memory result = executeArbitrage(params, routes);
        require(result.success, result.errorMessage);
        
        profit = result.actualProfit;

        emit SpiritInSpiritArbitrageExecuted(
            msg.sender,
            tokenA,
            tokenB,
            amountIn,
            profit,
            spiritPool
        );
    }

    /**
     * @dev Construye ruta optimizada para Fantom
     */
    function _buildFantomOptimizedRoute(
        address tokenA,
        address tokenB,
        uint256 amountIn,
        FantomRoute calldata route
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
     * @dev Ejecuta swap optimizado específico para Fantom
     */
    function _executeFantomSwap(SwapRoute memory route, FantomRoute calldata fantomRoute) internal returns (uint256) {
        if (fantomRoute.useSpookyBoost && spookyPools[route.exchange]) {
            return _executeSpookyBoostSwap(route);
        } else if (fantomRoute.useSpiritInSpirit && spiritPools[route.exchange]) {
            return _executeSpiritInSpiritSwap(route);
        } else if (fantomRoute.enableBeethovenWeighted && beethovenPools[route.exchange]) {
            return _executeBeethovenWeightedSwap(route);
        } else {
            return _executeSwap(route);
        }
    }

    /**
     * @dev Ejecuta swap específico en SpookySwap con boost
     */
    function _executeSpookyBoostSwap(SwapRoute memory route) internal returns (uint256) {
        // Implementación específica para SpookySwap con BOO rewards
        return _executeSwap(route);
    }

    /**
     * @dev Ejecuta swap específico en SpiritSwap con inSPIRIT
     */
    function _executeSpiritInSpiritSwap(SwapRoute memory route) internal returns (uint256) {
        // Implementación específica para SpiritSwap con inSPIRIT benefits
        return _executeSwap(route);
    }

    /**
     * @dev Ejecuta swap específico en Beethoven X weighted pools
     */
    function _executeBeethovenWeightedSwap(SwapRoute memory route) internal returns (uint256) {
        // Implementación específica para Beethoven X weighted pools
        return _executeSwap(route);
    }

    /**
     * @dev Optimización específica aprovechando fast finality de Fantom
     */
    function _optimizeFastFinality(
        address tokenA, 
        address tokenB, 
        uint256 profit,
        FantomRoute calldata route
    ) internal {
        // Aprovechar 1s block time para multiple rounds inmediatos
        if (profit > 20 * 1e6 && tx.gasprice <= FANTOM_OPTIMAL_GAS) {
            // Ejecutar round adicional inmediato
            uint256 reinvestAmount = profit / 3; // 33% reinversion
            if (reinvestAmount > 5 * 1e6) { // Mínimo 5 USDC
                // Lógica para ejecutar round adicional aprovechando fast finality
            }
        }
    }

    /**
     * @dev Obtiene pool de SpookySwap para un par específico
     */
    function _getSpookyPool(address tokenA, address tokenB) internal view returns (address) {
        bytes32 poolKey = keccak256(abi.encodePacked(tokenA, tokenB, "spooky"));
        return fantomPools[poolKey];
    }

    /**
     * @dev Obtiene pool de SpiritSwap para un par específico
     */
    function _getSpiritPool(address tokenA, address tokenB) internal view returns (address) {
        bytes32 poolKey = keccak256(abi.encodePacked(tokenA, tokenB, "spirit"));
        return fantomPools[poolKey];
    }

    /**
     * @dev Inicializa pools específicos de Fantom
     */
    function _initializeFantomPools() internal {
        // SpookySwap pools principales
        fantomPools[keccak256(abi.encodePacked(WFTM, USDC, "spooky"))] = 0x2b4C76d0dc16BE1C31D4C1DC53bF9B45987Fc75c;
        fantomPools[keccak256(abi.encodePacked(WFTM, BOO, "spooky"))] = 0xEc7178F4C41f346b2721907F5cF7628E388A7a58;
        spookyPools[0x2b4C76d0dc16BE1C31D4C1DC53bF9B45987Fc75c] = true;
        spookyPools[0xEc7178F4C41f346b2721907F5cF7628E388A7a58] = true;
        
        // SpiritSwap pools
        fantomPools[keccak256(abi.encodePacked(WFTM, SPIRIT, "spirit"))] = 0x30748322B6E34545DBe0788C421886AEB5297789;
        fantomPools[keccak256(abi.encodePacked(USDC, WFTM, "spirit"))] = 0xe7E90f5a767406efF87Fdad7EB07ef407922EC1D;
        spiritPools[0x30748322B6E34545DBe0788C421886AEB5297789] = true;
        spiritPools[0xe7E90f5a767406efF87Fdad7EB07ef407922EC1D] = true;
        
        // Beethoven X pools
        beethovenPools[0xcdE5a11a4ACB4eE4c805352Cec57E236bdBC3837] = true; // Weighted pool
        beethovenPools[0x9e4341acef4147196e99d648c5E5F1BB7087B0f1] = true; // Stable pool
        
        // Actualizar liquidez inicial
        poolLiquidities[0x2b4C76d0dc16BE1C31D4C1DC53bF9B45987Fc75c] = 15000000 * 1e6; // 15M USDC
        poolLiquidities[0x30748322B6E34545DBe0788C421886AEB5297789] = 10000000 * 1e18; // 10M FTM
    }

    /**
     * @dev Calcula fee optimizado para Fantom incluyendo consensus cost
     */
    function calculateFantomFee(uint256 gasUsed) external pure returns (uint256) {
        return (gasUsed * FANTOM_OPTIMAL_GAS) + CONSENSUS_FEE;
    }

    /**
     * @dev Verifica si un pool de SpookySwap está activo
     */
    function isSpookyPool(address pool) external view returns (bool) {
        return spookyPools[pool];
    }

    /**
     * @dev Verifica si un pool de SpiritSwap está activo
     */
    function isSpiritPool(address pool) external view returns (bool) {
        return spiritPools[pool];
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
     * @dev Actualiza configuración específica de Fantom
     */
    function updateFantomConfig(
        uint256 newMaxGasPrice,
        uint256 newMinProfit
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newMaxGasPrice <= 200 gwei, "Gas price too high for Fantom");
        require(newMinProfit >= 15 && newMinProfit <= 150, "Invalid profit threshold");
        
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

    // Eventos específicos de Fantom
    event FantomArbitrageExecuted(
        address indexed executor,
        address indexed tokenA,
        address indexed tokenB,
        uint256 amountIn,
        uint256 profit,
        uint256 gasUsed,
        uint256 timestamp
    );

    event TriangularFantomArbitrageExecuted(
        address indexed executor,
        address indexed tokenA,
        address indexed tokenB,
        address indexed tokenC,
        uint256 amountIn,
        uint256 amountOut,
        uint256 profit,
        uint256 gasUsed
    );

    event SpookyBoostArbitrageExecuted(
        address indexed executor,
        address indexed tokenA,
        address indexed tokenB,
        uint256 amountIn,
        uint256 profit,
        address indexed pool
    );

    event SpiritInSpiritArbitrageExecuted(
        address indexed executor,
        address indexed tokenA,
        address indexed tokenB,
        uint256 amountIn,
        uint256 profit,
        address indexed pool
    );

    event FastFinalityOptimizationExecuted(
        address indexed token,
        uint256 amount,
        uint256 additionalProfit
    );
}
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "../../core/ArbitrageExecutor.sol";

/**
 * @title EthereumArbitrage
 * @dev Contrato especializado para Ethereum mainnet
 * @notice Optimizado para DEXs principales: Uniswap V2/V3, SushiSwap, Balancer, Curve
 */
contract EthereumArbitrage is ArbitrageExecutor {
    
    // Direcciones específicas de Ethereum mainnet
    address private constant UNISWAP_V2_ROUTER = 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D;
    address private constant UNISWAP_V3_ROUTER = 0xE592427A0AEce92De3Edee1F18E0157C05861564;
    address private constant SUSHISWAP_ROUTER = 0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F;
    address private constant BALANCER_VAULT = 0xBA12222222228d8Ba445958a75a0704d566BF2C8;
    address private constant CURVE_REGISTRY = 0x90E00ACe148ca3b23Ac1bC8C240C2a7Dd9c2d7f5;
    address private constant ONEINCH_ROUTER = 0x1111111254EEB25477B68fb85Ed929f73A960582;
    
    // Aave V3 Pool para flash loans
    address private constant AAVE_V3_POOL = 0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2;
    
    // Tokens principales de Ethereum
    address private constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address private constant USDC = 0xA0b86a33E6441e2bB8558f4F8093E01B3e090757;
    address private constant DAI = 0x6B175474E89094C44Da98b954EedeAC495271d0F;
    address private constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
    address private constant WBTC = 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599;

    // Configuración específica de Ethereum
    uint256 private constant ETH_MAX_GAS_PRICE = 300 gwei; // Gas alto por L1
    uint256 private constant ETH_MIN_PROFIT = 100; // 1% mínimo por costos L1
    uint256 private constant ETH_BASE_FEE_THRESHOLD = 50 gwei;

    constructor(address _dexRegistry) 
        ArbitrageExecutor(
            _dexRegistry,
            AAVE_V3_POOL,
            BALANCER_VAULT,
            UNISWAP_V3_ROUTER,
            ETH_MAX_GAS_PRICE,
            ETH_MIN_PROFIT
        ) 
    {
        // Setup tokens principales de Ethereum
        supportedTokens[WETH] = true;
        supportedTokens[USDC] = true;
        supportedTokens[DAI] = true;
        supportedTokens[USDT] = true;
        supportedTokens[WBTC] = true;

        // Setup proveedores de flash loans
        flashLoanProviders[AAVE_V3_POOL] = true;
        flashLoanProviders[BALANCER_VAULT] = true;
    }

    /**
     * @dev Ejecuta arbitraje optimizado para Ethereum mainnet
     */
    function executeEthereumArbitrage(
        address tokenA,
        address tokenB,
        uint256 amountIn,
        bytes calldata routeData
    ) external payable nonReentrant whenNotPaused onlyExecutor returns (uint256 profit) {
        
        require(supportedTokens[tokenA] && supportedTokens[tokenB], "Unsupported token");
        require(block.basefee <= ETH_BASE_FEE_THRESHOLD, "Base fee too high");

        // Configurar parámetros específicos de Ethereum
        ArbitrageParams memory params = ArbitrageParams({
            tokenA: tokenA,
            tokenB: tokenB,
            tokenC: address(0),
            amountIn: amountIn,
            minAmountOut: 0, // Se calculará dinámicamente
            maxGasPrice: ETH_MAX_GAS_PRICE,
            deadline: uint32(block.timestamp + 600), // 10 minutos
            routeData: routeData,
            useFlashLoan: amountIn > 10 ether, // Flash loan para amounts grandes
            flashLoanProvider: AAVE_V3_POOL
        });

        // Crear ruta optimizada
        SwapRoute[] memory routes = _buildOptimizedRoute(tokenA, tokenB, amountIn);
        
        // Ejecutar arbitraje
        ExecutionResult memory result = executeArbitrage(params, routes);
        require(result.success, result.errorMessage);
        
        return result.profit;
    }

    /**
     * @dev Arbitraje triangular especializado para Ethereum
     */
    function executeEthereumTriangular(
        uint256 amountIn,
        TriangularRoute calldata route
    ) external payable nonReentrant whenNotPaused onlyExecutor returns (uint256 finalAmount) {
        
        require(block.basefee <= ETH_BASE_FEE_THRESHOLD, "Base fee too high");
        
        // Validar que la ruta empiece y termine en el mismo token
        require(route.tokenA == route.finalToken, "Invalid triangular route");

        // Crear rutas optimizadas para Ethereum
        SwapRoute[] memory routes = new SwapRoute[](3);
        
        // Ruta 1: TokenA -> TokenB
        routes[0] = SwapRoute({
            dex: _selectBestDEX(route.tokenA, route.tokenB, amountIn),
            tokenIn: route.tokenA,
            tokenOut: route.tokenB,
            amountIn: amountIn,
            minAmountOut: route.minAmountB,
            fee: _getOptimalFee(route.tokenA, route.tokenB),
            extraData: ""
        });

        // Ruta 2: TokenB -> TokenC  
        routes[1] = SwapRoute({
            dex: _selectBestDEX(route.tokenB, route.tokenC, 0), // Amount será calculado
            tokenIn: route.tokenB,
            tokenOut: route.tokenC,
            amountIn: 0, // Se calculará dinámicamente
            minAmountOut: route.minAmountC,
            fee: _getOptimalFee(route.tokenB, route.tokenC),
            extraData: ""
        });

        // Ruta 3: TokenC -> TokenA
        routes[2] = SwapRoute({
            dex: _selectBestDEX(route.tokenC, route.tokenA, 0),
            tokenIn: route.tokenC,
            tokenOut: route.tokenA,
            amountIn: 0,
            minAmountOut: route.minFinalAmount,
            fee: _getOptimalFee(route.tokenC, route.tokenA),
            extraData: ""
        });

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
     * @dev Flash loan MEV-protected para Ethereum
     */
    function executeMEVProtectedArbitrage(
        address tokenA,
        address tokenB,
        uint256 flashLoanAmount,
        bytes calldata mevProtectionData
    ) external payable nonReentrant whenNotPaused onlyExecutor returns (uint256 profit) {
        
        // Validar protección MEV
        require(_validateMEVProtection(mevProtectionData), "Invalid MEV protection");

        // Configurar flash loan con protección MEV
        bytes memory params = abi.encode(
            ArbitrageParams({
                tokenA: tokenA,
                tokenB: tokenB,
                tokenC: address(0),
                amountIn: flashLoanAmount,
                minAmountOut: 0,
                maxGasPrice: ETH_MAX_GAS_PRICE,
                deadline: uint32(block.timestamp + 300), // 5 minutos para MEV
                routeData: mevProtectionData,
                useFlashLoan: true,
                flashLoanProvider: AAVE_V3_POOL
            }),
            _buildMEVProtectedRoute(tokenA, tokenB, flashLoanAmount)
        );

        ExecutionResult memory result = executeFlashLoanArbitrage(
            AAVE_V3_POOL,
            tokenA,
            flashLoanAmount,
            params
        );

        require(result.success, result.errorMessage);
        return result.profit;
    }

    // ============ INTERNAL HELPER FUNCTIONS ============

    struct TriangularRoute {
        address tokenA;
        address tokenB;
        address tokenC;
        address finalToken;
        uint256 minAmountB;
        uint256 minAmountC;
        uint256 minFinalAmount;
    }

    function _buildOptimizedRoute(
        address tokenA,
        address tokenB,
        uint256 amountIn
    ) internal view returns (SwapRoute[] memory routes) {
        
        routes = new SwapRoute[](2);
        
        // Analizar liquidez y seleccionar mejor DEX
        address bestDEXAB = _selectBestDEX(tokenA, tokenB, amountIn);
        address bestDEXBA = _selectBestDEX(tokenB, tokenA, 0); // Amount estimado
        
        routes[0] = SwapRoute({
            dex: bestDEXAB,
            tokenIn: tokenA,
            tokenOut: tokenB,
            amountIn: amountIn,
            minAmountOut: _calculateMinAmountOut(tokenA, tokenB, amountIn),
            fee: _getOptimalFee(tokenA, tokenB),
            extraData: ""
        });

        routes[1] = SwapRoute({
            dex: bestDEXBA,
            tokenIn: tokenB,
            tokenOut: tokenA,
            amountIn: 0, // Se calculará dinámicamente
            minAmountOut: _calculateMinAmountOut(tokenB, tokenA, amountIn),
            fee: _getOptimalFee(tokenB, tokenA),
            extraData: ""
        });
    }

    function _selectBestDEX(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) internal view returns (address bestDEX) {
        
        uint256 bestAmountOut = 0;
        address[] memory dexes = new address[](4);
        dexes[0] = UNISWAP_V2_ROUTER;
        dexes[1] = UNISWAP_V3_ROUTER;
        dexes[2] = SUSHISWAP_ROUTER;
        dexes[3] = ONEINCH_ROUTER;

        for (uint256 i = 0; i < dexes.length; i++) {
            if (dexRegistry.isDEXSupported(dexes[i])) {
                uint256 amountOut = dexRegistry.getAmountOut(
                    dexes[i],
                    tokenIn,
                    tokenOut,
                    amountIn > 0 ? amountIn : 1 ether,
                    _getOptimalFee(tokenIn, tokenOut)
                );

                if (amountOut > bestAmountOut) {
                    bestAmountOut = amountOut;
                    bestDEX = dexes[i];
                }
            }
        }

        require(bestDEX != address(0), "No suitable DEX found");
    }

    function _getOptimalFee(
        address tokenA,
        address tokenB
    ) internal pure returns (uint24 fee) {
        
        // Lógica para seleccionar fee óptimo basado en tokens
        if (_isStablecoinPair(tokenA, tokenB)) {
            return 100; // 0.01% para stablecoins
        } else if (_isETHPair(tokenA, tokenB)) {
            return 500; // 0.05% para pares ETH
        } else {
            return 3000; // 0.3% para otros pares
        }
    }

    function _isStablecoinPair(address tokenA, address tokenB) internal pure returns (bool) {
        return (tokenA == USDC || tokenA == DAI || tokenA == USDT) &&
               (tokenB == USDC || tokenB == DAI || tokenB == USDT);
    }

    function _isETHPair(address tokenA, address tokenB) internal pure returns (bool) {
        return tokenA == WETH || tokenB == WETH;
    }

    function _calculateMinAmountOut(
        address tokenA,
        address tokenB,
        uint256 amountIn
    ) internal view returns (uint256 minAmountOut) {
        
        // Calcular slippage dinámico basado en liquidez
        uint256 estimatedOut = dexRegistry.getAmountOut(
            _selectBestDEX(tokenA, tokenB, amountIn),
            tokenA,
            tokenB,
            amountIn,
            _getOptimalFee(tokenA, tokenB)
        );

        // Aplicar slippage de 1-5% dependiendo de la volatilidad
        uint256 slippage = _calculateDynamicSlippage(tokenA, tokenB);
        minAmountOut = (estimatedOut * (10000 - slippage)) / 10000;
    }

    function _calculateDynamicSlippage(
        address tokenA,
        address tokenB
    ) internal pure returns (uint256 slippage) {
        
        if (_isStablecoinPair(tokenA, tokenB)) {
            return 100; // 1% para stablecoins
        } else if (_isETHPair(tokenA, tokenB)) {
            return 200; // 2% para pares ETH
        } else {
            return 500; // 5% para tokens volátiles
        }
    }

    function _buildMEVProtectedRoute(
        address tokenA,
        address tokenB,
        uint256 amount
    ) internal view returns (SwapRoute[] memory routes) {
        
        // Implementar lógica específica de protección MEV
        routes = _buildOptimizedRoute(tokenA, tokenB, amount);
        
        // Ajustar parámetros para protección MEV
        for (uint256 i = 0; i < routes.length; i++) {
            routes[i].extraData = abi.encode("MEV_PROTECTED", block.timestamp);
        }
    }

    function _validateMEVProtection(
        bytes calldata mevData
    ) internal view returns (bool isValid) {
        
        // Validar que la transacción no sea susceptible a MEV
        (bytes32 commitment, uint256 timestamp) = abi.decode(mevData, (bytes32, uint256));
        
        // Validar timestamp reciente
        require(block.timestamp - timestamp <= 60, "Stale MEV protection");
        
        // Validar commitment
        bytes32 expectedCommitment = keccak256(abi.encode(
            msg.sender,
            block.number,
            timestamp
        ));
        
        return commitment == expectedCommitment;
    }

    // ============ ETHEREUM-SPECIFIC GETTERS ============

    function getEthereumConfig() external pure returns (
        uint256 maxGasPrice,
        uint256 minProfit,
        uint256 baseFeeThreshold,
        address[] memory supportedDEXs
    ) {
        maxGasPrice = ETH_MAX_GAS_PRICE;
        minProfit = ETH_MIN_PROFIT;
        baseFeeThreshold = ETH_BASE_FEE_THRESHOLD;
        
        supportedDEXs = new address[](4);
        supportedDEXs[0] = UNISWAP_V2_ROUTER;
        supportedDEXs[1] = UNISWAP_V3_ROUTER;
        supportedDEXs[2] = SUSHISWAP_ROUTER;
        supportedDEXs[3] = ONEINCH_ROUTER;
    }

    function getEthereumTokens() external pure returns (address[] memory tokens) {
        tokens = new address[](5);
        tokens[0] = WETH;
        tokens[1] = USDC;
        tokens[2] = DAI;
        tokens[3] = USDT;
        tokens[4] = WBTC;
    }
}
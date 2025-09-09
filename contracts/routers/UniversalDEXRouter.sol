// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IDEXRouter.sol";

// Uniswap V2 Interface
interface IUniswapV2Router02 {
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);
    
    function getAmountsOut(uint amountIn, address[] calldata path)
        external view returns (uint[] memory amounts);
        
    function factory() external pure returns (address);
    function WETH() external pure returns (address);
}

// Uniswap V3 Interfaces
interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    struct ExactInputParams {
        bytes path;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
    }

    function exactInputSingle(ExactInputSingleParams calldata params)
        external payable returns (uint256 amountOut);

    function exactInput(ExactInputParams calldata params)
        external payable returns (uint256 amountOut);
}

interface IQuoterV2 {
    function quoteExactInputSingle(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        uint256 amountIn,
        uint160 sqrtPriceLimitX96
    ) external returns (uint256 amountOut);

    function quoteExactInput(bytes memory path, uint256 amountIn)
        external returns (uint256 amountOut);
}

// SushiSwap Interface (similar to Uniswap V2)
interface ISushiSwapRouter {
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);
    
    function getAmountsOut(uint amountIn, address[] calldata path)
        external view returns (uint[] memory amounts);
}

/**
 * @title UniversalDEXRouter
 * @dev Router universal para múltiples DEXs con optimización automática
 * @notice Soporta Uniswap V2/V3, SushiSwap con routing inteligente
 * 
 * ArbitrageX Supreme V3.0 - Universal DEX Integration
 * Multi-DEX + Best Price Discovery + Gas Optimization
 */
contract UniversalDEXRouter is IDEXRouter, AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // === ROLES ===
    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");
    bytes32 public constant ROUTER_MANAGER_ROLE = keccak256("ROUTER_MANAGER_ROLE");

    // === CONSTANTS ===
    uint256 public constant MAX_SLIPPAGE = 1000; // 10%
    uint256 public constant DEFAULT_DEADLINE_BUFFER = 300; // 5 minutes
    uint24 public constant DEFAULT_FEE_TIER = 3000; // 0.3%
    
    // Uniswap V3 fee tiers
    uint24[] public constant FEE_TIERS = [100, 500, 3000, 10000]; // 0.01%, 0.05%, 0.3%, 1%

    // === ENUMS ===
    enum DEXType {
        UNISWAP_V2,     // 0
        UNISWAP_V3,     // 1
        SUSHISWAP,      // 2
        CUSTOM          // 3
    }

    // === STRUCTS ===
    struct DEXConfig {
        DEXType dexType;
        address router;
        address quoter;     // Para V3, null para V2
        bool active;
        uint256 priority;
        uint256 successRate;
        uint256 avgGasUsed;
        string name;
    }

    struct RouteQuote {
        DEXType dexType;
        address router;
        uint256 amountOut;
        uint256 estimatedGas;
        bytes routeData;
        uint256 score;
        bool valid;
    }

    struct OptimalRoute {
        DEXType bestDEX;
        address router;
        uint256 expectedAmountOut;
        bytes routeData;
        uint256 estimatedGas;
    }

    // === STATE VARIABLES ===
    mapping(DEXType => DEXConfig) public dexConfigs;
    mapping(address => DEXType) public routerToDEX;
    
    address public immutable WETH;
    bool public paused;
    uint256 public totalSwaps;
    uint256 public totalSuccessful;
    
    // Price impact protection
    uint256 public maxPriceImpact = 500; // 5%
    bool public priceImpactProtectionEnabled = true;

    // === EVENTS ===
    event DEXConfigured(
        DEXType indexed dexType,
        address indexed router,
        address quoter,
        string name
    );
    
    event SwapExecuted(
        DEXType indexed dexType,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 gasUsed
    );
    
    event OptimalRouteFound(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        DEXType bestDEX,
        uint256 expectedAmountOut
    );
    
    event RouteOptimized(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 routesChecked,
        uint256 bestAmountOut
    );

    // === MODIFIERS ===
    modifier onlyExecutor() {
        require(hasRole(EXECUTOR_ROLE, msg.sender), "Not authorized executor");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "Router paused");
        _;
    }

    // === CONSTRUCTOR ===
    constructor(
        address admin,
        address _weth
    ) {
        require(_weth != address(0), "Invalid WETH address");
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(EXECUTOR_ROLE, admin);
        _grantRole(ROUTER_MANAGER_ROLE, admin);
        
        WETH = _weth;
    }

    // === IDEXROUTER IMPLEMENTATION ===
    /**
     * @dev Swap exacto de tokens con selección automática de DEX
     */
    function swapExactTokensForTokens(
        SwapParams calldata params
    ) external override onlyExecutor whenNotPaused nonReentrant returns (uint256 amountOut) {
        require(params.amountIn > 0, "Invalid amount in");
        require(params.tokenIn != params.tokenOut, "Same tokens");
        require(params.deadline > block.timestamp, "Expired deadline");
        
        // 1. Encontrar ruta óptima
        OptimalRoute memory optimalRoute = findOptimalRoute(
            params.tokenIn,
            params.tokenOut,
            params.amountIn
        );
        
        require(optimalRoute.expectedAmountOut >= params.amountOutMin, "Insufficient output amount");
        
        emit OptimalRouteFound(
            params.tokenIn,
            params.tokenOut,
            params.amountIn,
            optimalRoute.bestDEX,
            optimalRoute.expectedAmountOut
        );
        
        // 2. Ejecutar swap en el DEX óptimo
        uint256 gasStart = gasleft();
        
        if (optimalRoute.bestDEX == DEXType.UNISWAP_V2 || optimalRoute.bestDEX == DEXType.SUSHISWAP) {
            amountOut = _executeV2Swap(optimalRoute, params);
        } else if (optimalRoute.bestDEX == DEXType.UNISWAP_V3) {
            amountOut = _executeV3Swap(optimalRoute, params);
        } else {
            revert("Unsupported DEX type");
        }
        
        uint256 gasUsed = gasStart - gasleft();
        
        // 3. Actualizar estadísticas
        _updateDEXStats(optimalRoute.bestDEX, true, gasUsed);
        
        totalSwaps++;
        totalSuccessful++;
        
        emit SwapExecuted(
            optimalRoute.bestDEX,
            params.tokenIn,
            params.tokenOut,
            params.amountIn,
            amountOut,
            gasUsed
        );
    }

    /**
     * @dev Obtiene cotización de todos los DEXs y devuelve la mejor ruta
     */
    function getOptimalQuote(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) external override returns (uint256 amountOut, bytes memory routeData) {
        OptimalRoute memory route = findOptimalRoute(tokenIn, tokenOut, amountIn);
        return (route.expectedAmountOut, route.routeData);
    }

    // === ROUTE OPTIMIZATION ===
    /**
     * @dev Encuentra la ruta óptima comparando todos los DEXs
     */
    function findOptimalRoute(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) public returns (OptimalRoute memory optimalRoute) {
        RouteQuote[] memory quotes = _getAllQuotes(tokenIn, tokenOut, amountIn);
        require(quotes.length > 0, "No valid routes found");
        
        uint256 bestScore = 0;
        uint256 bestIndex = 0;
        
        for (uint256 i = 0; i < quotes.length; i++) {
            if (quotes[i].valid && quotes[i].score > bestScore) {
                bestScore = quotes[i].score;
                bestIndex = i;
            }
        }
        
        RouteQuote memory bestQuote = quotes[bestIndex];
        
        optimalRoute = OptimalRoute({
            bestDEX: bestQuote.dexType,
            router: bestQuote.router,
            expectedAmountOut: bestQuote.amountOut,
            routeData: bestQuote.routeData,
            estimatedGas: bestQuote.estimatedGas
        });
        
        emit RouteOptimized(tokenIn, tokenOut, amountIn, quotes.length, bestQuote.amountOut);
    }

    /**
     * @dev Obtiene quotes de todos los DEXs disponibles
     */
    function _getAllQuotes(
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) internal returns (RouteQuote[] memory quotes) {
        uint256 activeCount = 0;
        
        // Contar DEXs activos
        for (uint256 i = 0; i < 4; i++) {
            if (dexConfigs[DEXType(i)].active) {
                activeCount++;
            }
        }
        
        quotes = new RouteQuote[](activeCount * 4); // x4 para fee tiers V3
        uint256 quoteIndex = 0;
        
        // Uniswap V2
        if (dexConfigs[DEXType.UNISWAP_V2].active) {
            RouteQuote memory v2Quote = _getV2Quote(DEXType.UNISWAP_V2, tokenIn, tokenOut, amountIn);
            if (v2Quote.valid) {
                quotes[quoteIndex++] = v2Quote;
            }
        }
        
        // Uniswap V3 (múltiples fee tiers)
        if (dexConfigs[DEXType.UNISWAP_V3].active) {
            for (uint256 i = 0; i < FEE_TIERS.length; i++) {
                RouteQuote memory v3Quote = _getV3Quote(tokenIn, tokenOut, amountIn, FEE_TIERS[i]);
                if (v3Quote.valid) {
                    quotes[quoteIndex++] = v3Quote;
                }
            }
        }
        
        // SushiSwap
        if (dexConfigs[DEXType.SUSHISWAP].active) {
            RouteQuote memory sushiQuote = _getV2Quote(DEXType.SUSHISWAP, tokenIn, tokenOut, amountIn);
            if (sushiQuote.valid) {
                quotes[quoteIndex++] = sushiQuote;
            }
        }
        
        // Resize array to actual size
        assembly {
            mstore(quotes, quoteIndex)
        }
    }

    /**
     * @dev Obtiene quote para DEXs tipo V2 (Uniswap V2, SushiSwap)
     */
    function _getV2Quote(
        DEXType dexType,
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    ) internal view returns (RouteQuote memory quote) {
        DEXConfig memory config = dexConfigs[dexType];
        
        try IUniswapV2Router02(config.router).getAmountsOut(
            amountIn,
            _buildV2Path(tokenIn, tokenOut)
        ) returns (uint[] memory amounts) {
            uint256 amountOut = amounts[amounts.length - 1];
            uint256 score = _calculateRouteScore(dexType, amountOut, config.avgGasUsed);
            
            quote = RouteQuote({
                dexType: dexType,
                router: config.router,
                amountOut: amountOut,
                estimatedGas: config.avgGasUsed,
                routeData: abi.encode(_buildV2Path(tokenIn, tokenOut)),
                score: score,
                valid: true
            });
        } catch {
            quote.valid = false;
        }
    }

    /**
     * @dev Obtiene quote para Uniswap V3
     */
    function _getV3Quote(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint24 fee
    ) internal returns (RouteQuote memory quote) {
        DEXConfig memory config = dexConfigs[DEXType.UNISWAP_V3];
        
        try IQuoterV2(config.quoter).quoteExactInputSingle(
            tokenIn,
            tokenOut,
            fee,
            amountIn,
            0
        ) returns (uint256 amountOut) {
            uint256 score = _calculateRouteScore(DEXType.UNISWAP_V3, amountOut, config.avgGasUsed);
            
            quote = RouteQuote({
                dexType: DEXType.UNISWAP_V3,
                router: config.router,
                amountOut: amountOut,
                estimatedGas: config.avgGasUsed,
                routeData: abi.encode(tokenIn, tokenOut, fee),
                score: score,
                valid: true
            });
        } catch {
            quote.valid = false;
        }
    }

    /**
     * @dev Calcula score de ruta (mayor mejor)
     */
    function _calculateRouteScore(
        DEXType dexType,
        uint256 amountOut,
        uint256 gasUsed
    ) internal view returns (uint256 score) {
        DEXConfig memory config = dexConfigs[dexType];
        
        // Factores: amountOut (70%), successRate (20%), gas efficiency (10%)
        uint256 amountScore = amountOut;
        uint256 reliabilityScore = (amountOut * config.successRate) / 10000;
        uint256 gasScore = gasUsed > 0 ? (amountOut * 100000) / gasUsed : 0;
        
        score = (amountScore * 70 + reliabilityScore * 20 + gasScore * 10) / 100;
    }

    // === EXECUTION FUNCTIONS ===
    /**
     * @dev Ejecuta swap en DEXs tipo V2
     */
    function _executeV2Swap(
        OptimalRoute memory route,
        SwapParams calldata params
    ) internal returns (uint256 amountOut) {
        address[] memory path = abi.decode(route.routeData, (address[]));
        
        // Transfer tokens to router
        IERC20(params.tokenIn).safeTransferFrom(msg.sender, address(this), params.amountIn);
        IERC20(params.tokenIn).safeApprove(route.router, params.amountIn);
        
        // Execute swap
        uint[] memory amounts = IUniswapV2Router02(route.router).swapExactTokensForTokens(
            params.amountIn,
            params.amountOutMin,
            path,
            params.to,
            params.deadline
        );
        
        amountOut = amounts[amounts.length - 1];
    }

    /**
     * @dev Ejecuta swap en Uniswap V3
     */
    function _executeV3Swap(
        OptimalRoute memory route,
        SwapParams calldata params
    ) internal returns (uint256 amountOut) {
        (address tokenIn, address tokenOut, uint24 fee) = abi.decode(
            route.routeData, 
            (address, address, uint24)
        );
        
        // Transfer tokens to router
        IERC20(params.tokenIn).safeTransferFrom(msg.sender, address(this), params.amountIn);
        IERC20(params.tokenIn).safeApprove(route.router, params.amountIn);
        
        // Execute V3 swap
        ISwapRouter.ExactInputSingleParams memory swapParams = ISwapRouter.ExactInputSingleParams({
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            fee: fee,
            recipient: params.to,
            deadline: params.deadline,
            amountIn: params.amountIn,
            amountOutMinimum: params.amountOutMin,
            sqrtPriceLimitX96: 0
        });
        
        amountOut = ISwapRouter(route.router).exactInputSingle(swapParams);
    }

    // === MULTIHOP ROUTING ===
    /**
     * @dev Ejecuta swap multihop en Uniswap V3
     */
    function executeMultihopV3Swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOutMin,
        address to,
        uint256 deadline,
        bytes calldata path
    ) external onlyExecutor whenNotPaused nonReentrant returns (uint256 amountOut) {
        DEXConfig memory config = dexConfigs[DEXType.UNISWAP_V3];
        require(config.active, "Uniswap V3 not active");
        
        // Transfer tokens
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenIn).safeApprove(config.router, amountIn);
        
        // Execute multihop swap
        ISwapRouter.ExactInputParams memory swapParams = ISwapRouter.ExactInputParams({
            path: path,
            recipient: to,
            deadline: deadline,
            amountIn: amountIn,
            amountOutMinimum: amountOutMin
        });
        
        amountOut = ISwapRouter(config.router).exactInput(swapParams);
        
        totalSwaps++;
        totalSuccessful++;
        
        emit SwapExecuted(DEXType.UNISWAP_V3, tokenIn, tokenOut, amountIn, amountOut, 0);
    }

    /**
     * @dev Construye path óptimo para multihop V3
     */
    function buildOptimalV3Path(
        address tokenIn,
        address tokenOut,
        address[] calldata intermediateTokens
    ) external view returns (bytes memory path, uint256 expectedAmountOut) {
        require(intermediateTokens.length > 0, "No intermediate tokens");
        
        // TODO: Implementar algoritmo completo de pathfinding
        // Por ahora, construir path simple con fee tier por defecto
        path = abi.encodePacked(tokenIn, DEFAULT_FEE_TIER, tokenOut);
        expectedAmountOut = 0; // Placeholder
    }

    // === HELPER FUNCTIONS ===
    function _buildV2Path(
        address tokenIn,
        address tokenOut
    ) internal view returns (address[] memory path) {
        if (tokenIn == WETH || tokenOut == WETH) {
            path = new address[](2);
            path[0] = tokenIn;
            path[1] = tokenOut;
        } else {
            path = new address[](3);
            path[0] = tokenIn;
            path[1] = WETH;
            path[2] = tokenOut;
        }
    }

    function _updateDEXStats(DEXType dexType, bool success, uint256 gasUsed) internal {
        DEXConfig storage config = dexConfigs[dexType];
        
        // Update success rate (EMA)
        uint256 newSuccessRate = success ? 10000 : 0;
        config.successRate = (config.successRate * 9 + newSuccessRate) / 10;
        
        // Update average gas used (EMA)
        config.avgGasUsed = (config.avgGasUsed * 9 + gasUsed) / 10;
    }

    // === ADMIN FUNCTIONS ===
    function configureDEX(
        DEXType dexType,
        address router,
        address quoter,
        uint256 priority,
        string calldata name
    ) external onlyRole(ROUTER_MANAGER_ROLE) {
        require(router != address(0), "Invalid router");
        
        dexConfigs[dexType] = DEXConfig({
            dexType: dexType,
            router: router,
            quoter: quoter,
            active: true,
            priority: priority,
            successRate: 10000, // 100%
            avgGasUsed: 150000, // Estimation
            name: name
        });
        
        routerToDEX[router] = dexType;
        
        emit DEXConfigured(dexType, router, quoter, name);
    }

    function setDEXActive(DEXType dexType, bool active) external onlyRole(ROUTER_MANAGER_ROLE) {
        dexConfigs[dexType].active = active;
    }

    function updatePriceImpactProtection(
        bool enabled,
        uint256 maxImpact
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        priceImpactProtectionEnabled = enabled;
        maxPriceImpact = maxImpact;
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        paused = true;
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        paused = false;
    }

    // === VIEW FUNCTIONS ===
    function getDEXConfig(DEXType dexType) external view returns (DEXConfig memory) {
        return dexConfigs[dexType];
    }

    function getRouterStats() external view returns (
        uint256 _totalSwaps,
        uint256 _totalSuccessful,
        uint256 successRate,
        bool _paused
    ) {
        successRate = totalSwaps > 0 ? (totalSuccessful * 10000) / totalSwaps : 0;
        return (totalSwaps, totalSuccessful, successRate, paused);
    }

    function getAllSupportedDEXs() external view returns (DEXType[] memory activeDEXs) {
        uint256 activeCount = 0;
        
        for (uint256 i = 0; i < 4; i++) {
            if (dexConfigs[DEXType(i)].active) {
                activeCount++;
            }
        }
        
        activeDEXs = new DEXType[](activeCount);
        uint256 index = 0;
        
        for (uint256 i = 0; i < 4; i++) {
            if (dexConfigs[DEXType(i)].active) {
                activeDEXs[index++] = DEXType(i);
            }
        }
    }

    // === RECEIVE FUNCTION ===
    receive() external payable {
        // Accept ETH for WETH operations
    }
}
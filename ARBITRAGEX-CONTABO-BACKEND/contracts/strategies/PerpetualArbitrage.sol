// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IArbitrageStrategy.sol";
import "../interfaces/IPerpetualProtocol.sol";
import "../interfaces/IPriceOracle.sol";
import "../libraries/PriceUtils.sol";
import "../libraries/SafeMath.sol";

/**
 * @title PerpetualArbitrage
 * @dev Implementa arbitraje en mercados de futuros perpetuos
 * Aprovecha diferencias entre precio spot y precio de futuros
 * Incluye funding rate arbitrage y basis trading
 */
contract PerpetualArbitrage is IArbitrageStrategy, ReentrancyGuard, Pausable, Ownable {
    using SafeERC20 for IERC20;
    using PriceUtils for uint256;
    using SafeMath for uint256;

    // ==================== ESTRUCTURAS Y ENUMS ====================

    enum PositionSide { LONG, SHORT }
    enum ArbitrageType { 
        FUNDING_RATE,      // Arbitraje de funding rate
        BASIS_TRADING,     // Trading de basis (spot vs futures)
        CROSS_EXCHANGE,    // Arbitraje entre exchanges
        CALENDAR_SPREAD,   // Spread entre diferentes vencimientos
        INDEX_ARBITRAGE    // Arbitraje con índice subyacente
    }

    enum ProtocolType {
        PERPETUAL_V2,
        GMX_V2,
        DYDX_V4,
        VERTEX,
        GAINS_NETWORK,
        MUX_PROTOCOL,
        LEVEL_FINANCE,
        VELA_EXCHANGE
    }

    struct PerpetualMarket {
        ProtocolType protocol;     // Protocolo del mercado
        address marketAddress;     // Dirección del mercado
        address baseAsset;         // Asset base (ej: ETH)
        address quoteAsset;        // Asset de cotización (ej: USDC)
        uint256 markPrice;         // Precio mark actual
        uint256 indexPrice;        // Precio índice
        int256 fundingRate;        // Funding rate (puede ser negativo)
        uint256 openInterest;      // Interés abierto
        uint256 maxLeverage;       // Apalancamiento máximo
        uint256 minSize;           // Tamaño mínimo de posición
        uint256 makerFee;          // Fee de maker (BPS)
        uint256 takerFee;          // Fee de taker (BPS)
        bool isActive;             // Si está activo
        uint256 lastUpdate;        // Último update de datos
    }

    struct ArbitrageParams {
        ArbitrageType arbType;     // Tipo de arbitraje
        ProtocolType protocol1;    // Protocolo primario
        ProtocolType protocol2;    // Protocolo secundario (opcional)
        address baseAsset;         // Asset base
        uint256 size;              // Tamaño de la posición
        uint256 leverage;          // Apalancamiento
        PositionSide side;         // Lado de la posición
        uint256 minProfit;         // Ganancia mínima esperada
        uint256 maxSlippage;       // Slippage máximo (BPS)
        uint256 duration;          // Duración esperada del trade
        uint256 deadline;          // Timestamp límite
        bytes extraData;           // Datos adicionales específicos
    }

    struct PerpetualPosition {
        ProtocolType protocol;     // Protocolo donde está la posición
        address baseAsset;         // Asset base
        uint256 size;              // Tamaño de la posición
        uint256 leverage;          // Apalancamiento usado
        PositionSide side;         // Lado (LONG/SHORT)
        uint256 entryPrice;        // Precio de entrada
        uint256 markPrice;         // Precio mark actual
        int256 unrealizedPnL;      // PnL no realizado
        uint256 margin;            // Margen usado
        uint256 entryTime;         // Timestamp de entrada
        uint256 fundingAccrued;    // Funding acumulado
        bool isActive;             // Si está activa
        ArbitrageType arbType;     // Tipo de arbitraje
    }

    struct FundingOpportunity {
        ProtocolType protocol;     // Protocolo
        address baseAsset;         // Asset
        int256 fundingRate;        // Funding rate (8h APR)
        uint256 annualizedRate;    // Rate anualizado
        PositionSide recommendedSide; // Lado recomendado
        uint256 maxProfitableSize; // Tamaño máximo rentable
        uint256 estimatedProfit;   // Ganancia estimada (8h)
        uint256 riskScore;         // Score de riesgo
    }

    struct BasisOpportunity {
        address baseAsset;         // Asset
        ProtocolType futuresProtocol; // Protocolo de futuros
        address spotExchange;      // Exchange spot
        uint256 spotPrice;         // Precio spot
        uint256 futuresPrice;      // Precio futuros
        uint256 basisPoints;       // Basis en puntos (BPS)
        bool isContango;           // Si está en contango
        uint256 annualizedBasis;   // Basis anualizado
        uint256 maxSize;           // Tamaño máximo
    }

    // ==================== VARIABLES DE ESTADO ====================

    mapping(ProtocolType => mapping(address => PerpetualMarket)) public perpetualMarkets;
    mapping(address => mapping(ProtocolType => PerpetualPosition)) public userPositions;
    mapping(address => ProtocolType[]) public userProtocols;
    mapping(address => bool) public supportedAssets;
    mapping(ProtocolType => address) public protocolAddresses;
    
    uint256 public constant MAX_LEVERAGE = 50;           // 50x máximo leverage
    uint256 public constant MIN_FUNDING_RATE = 10;       // 0.1% mínimo funding para arbitraje
    uint256 public constant MAX_BASIS_POINTS = 1000;     // 10% máximo basis
    uint256 public positionFee = 100;                    // 1% fee de posición
    uint256 public fundingUpdateInterval = 28800;        // 8 horas en segundos
    uint256 public maxPositionSize = 1000000e18;         // 1M tokens máximo
    
    address public priceOracle;
    address public riskManager;
    address public feeReceiver;

    // ==================== EVENTOS ====================

    event PerpetualArbitrageExecuted(
        address indexed user,
        ArbitrageType arbType,
        ProtocolType protocol1,
        ProtocolType protocol2,
        address baseAsset,
        uint256 size,
        PositionSide side,
        uint256 estimatedProfit
    );

    event PositionOpened(
        address indexed user,
        ProtocolType protocol,
        address baseAsset,
        uint256 size,
        PositionSide side,
        uint256 entryPrice,
        uint256 leverage
    );

    event PositionClosed(
        address indexed user,
        ProtocolType protocol,
        address baseAsset,
        uint256 size,
        int256 realizedPnL,
        uint256 fundingPaid
    );

    event FundingRateUpdated(
        ProtocolType indexed protocol,
        address indexed baseAsset,
        int256 newFundingRate,
        uint256 timestamp
    );

    event MarketAdded(
        ProtocolType indexed protocol,
        address indexed baseAsset,
        address marketAddress,
        uint256 maxLeverage
    );

    // ==================== CONSTRUCTOR ====================

    constructor(
        address _priceOracle,
        address _riskManager,
        address _feeReceiver
    ) {
        priceOracle = _priceOracle;
        riskManager = _riskManager;
        feeReceiver = _feeReceiver;
    }

    // ==================== FUNCIONES PRINCIPALES ====================

    /**
     * @dev Ejecuta arbitraje de perpetuos
     */
    function execute(bytes calldata data) 
        external 
        override 
        nonReentrant 
        whenNotPaused 
        returns (bool success, uint256 profit) 
    {
        ArbitrageParams memory params = abi.decode(data, (ArbitrageParams));
        
        require(params.deadline >= block.timestamp, "PerpArb: Deadline expired");
        require(supportedAssets[params.baseAsset], "PerpArb: Asset not supported");
        require(params.leverage <= MAX_LEVERAGE, "PerpArb: Leverage too high");

        // Actualizar datos de mercado
        _updateMarketData(params.protocol1, params.baseAsset);
        if (params.protocol2 != ProtocolType.PERPETUAL_V2) {
            _updateMarketData(params.protocol2, params.baseAsset);
        }

        // Ejecutar según tipo de arbitraje
        if (params.arbType == ArbitrageType.FUNDING_RATE) {
            return _executeFundingRateArbitrage(params);
        } else if (params.arbType == ArbitrageType.BASIS_TRADING) {
            return _executeBasisArbitrage(params);
        } else if (params.arbType == ArbitrageType.CROSS_EXCHANGE) {
            return _executeCrossExchangeArbitrage(params);
        } else if (params.arbType == ArbitrageType.INDEX_ARBITRAGE) {
            return _executeIndexArbitrage(params);
        }

        return (false, 0);
    }

    /**
     * @dev Ejecuta arbitraje de funding rate
     */
    function _executeFundingRateArbitrage(ArbitrageParams memory params) 
        internal 
        returns (bool success, uint256 profit) 
    {
        PerpetualMarket memory market = perpetualMarkets[params.protocol1][params.baseAsset];
        require(market.isActive, "PerpArb: Market not active");

        // Verificar que el funding rate sea favorable
        int256 fundingRate = market.fundingRate;
        require(abs(fundingRate) >= MIN_FUNDING_RATE, "PerpArb: Funding rate too low");

        // Determinar lado de la posición basado en funding rate
        PositionSide targetSide = fundingRate > 0 ? PositionSide.SHORT : PositionSide.LONG;

        // Abrir posición perpetua
        bool positionOpened = _openPerpetualPosition(
            params.protocol1,
            params.baseAsset,
            params.size,
            targetSide,
            params.leverage
        );

        if (positionOpened && params.protocol2 != ProtocolType.PERPETUAL_V2) {
            // Hedge en spot o otro protocolo
            _openHedgePosition(params.protocol2, params.baseAsset, params.size, _oppositeSide(targetSide));
        }

        if (positionOpened) {
            // Calcular ganancia esperada del funding
            uint256 fundingProfit = params.size.mul(uint256(abs(fundingRate))).div(10000);
            
            emit PerpetualArbitrageExecuted(
                msg.sender,
                params.arbType,
                params.protocol1,
                params.protocol2,
                params.baseAsset,
                params.size,
                targetSide,
                fundingProfit
            );

            return (true, fundingProfit);
        }

        return (false, 0);
    }

    /**
     * @dev Ejecuta arbitraje de basis (spot vs futures)
     */
    function _executeBasisArbitrage(ArbitrageParams memory params) 
        internal 
        returns (bool success, uint256 profit) 
    {
        PerpetualMarket memory market = perpetualMarkets[params.protocol1][params.baseAsset];
        
        // Obtener precio spot del oracle
        uint256 spotPrice = IPriceOracle(priceOracle).getPrice(params.baseAsset);
        uint256 futuresPrice = market.markPrice;
        
        // Calcular basis
        int256 basis = int256(futuresPrice) - int256(spotPrice);
        uint256 basisBPS = abs(basis).mul(10000).div(spotPrice);
        
        require(basisBPS >= 50, "PerpArb: Basis too small"); // Mínimo 0.5%

        PositionSide futuresSide;
        PositionSide spotSide;

        if (basis > 0) {
            // Futures más caro que spot (Contango)
            futuresSide = PositionSide.SHORT; // Vender futures
            spotSide = PositionSide.LONG;     // Comprar spot
        } else {
            // Futures más barato que spot (Backwardation)
            futuresSide = PositionSide.LONG;  // Comprar futures
            spotSide = PositionSide.SHORT;    // Vender spot
        }

        // Ejecutar posiciones
        bool futuresOpened = _openPerpetualPosition(
            params.protocol1,
            params.baseAsset,
            params.size,
            futuresSide,
            params.leverage
        );

        bool spotOpened = _openSpotPosition(params.baseAsset, params.size, spotSide);

        if (futuresOpened && spotOpened) {
            uint256 basisProfit = params.size.mul(basisBPS).div(10000);
            
            emit PerpetualArbitrageExecuted(
                msg.sender,
                params.arbType,
                params.protocol1,
                ProtocolType.PERPETUAL_V2, // Spot como protocol2
                params.baseAsset,
                params.size,
                futuresSide,
                basisProfit
            );

            return (true, basisProfit);
        }

        return (false, 0);
    }

    /**
     * @dev Ejecuta arbitraje cross-exchange
     */
    function _executeCrossExchangeArbitrage(ArbitrageParams memory params) 
        internal 
        returns (bool success, uint256 profit) 
    {
        PerpetualMarket memory market1 = perpetualMarkets[params.protocol1][params.baseAsset];
        PerpetualMarket memory market2 = perpetualMarkets[params.protocol2][params.baseAsset];
        
        require(market1.isActive && market2.isActive, "PerpArb: Markets not active");

        // Comparar precios
        uint256 priceDiff = market1.markPrice > market2.markPrice ? 
            market1.markPrice.sub(market2.markPrice) : 
            market2.markPrice.sub(market1.markPrice);
            
        uint256 priceDiffBPS = priceDiff.mul(10000).div(
            market1.markPrice.add(market2.markPrice).div(2)
        );
        
        require(priceDiffBPS >= 20, "PerpArb: Price difference too small"); // Mínimo 0.2%

        // Determinar direcciones
        ProtocolType buyProtocol = market1.markPrice < market2.markPrice ? params.protocol1 : params.protocol2;
        ProtocolType sellProtocol = market1.markPrice < market2.markPrice ? params.protocol2 : params.protocol1;

        // Ejecutar posiciones opuestas
        bool buyOpened = _openPerpetualPosition(
            buyProtocol,
            params.baseAsset,
            params.size,
            PositionSide.LONG,
            params.leverage
        );

        bool sellOpened = _openPerpetualPosition(
            sellProtocol,
            params.baseAsset,
            params.size,
            PositionSide.SHORT,
            params.leverage
        );

        if (buyOpened && sellOpened) {
            uint256 arbitrageProfit = params.size.mul(priceDiffBPS).div(10000);
            
            emit PerpetualArbitrageExecuted(
                msg.sender,
                params.arbType,
                params.protocol1,
                params.protocol2,
                params.baseAsset,
                params.size,
                PositionSide.LONG,
                arbitrageProfit
            );

            return (true, arbitrageProfit);
        }

        return (false, 0);
    }

    /**
     * @dev Ejecuta arbitraje de índice
     */
    function _executeIndexArbitrage(ArbitrageParams memory params) 
        internal 
        returns (bool success, uint256 profit) 
    {
        PerpetualMarket memory market = perpetualMarkets[params.protocol1][params.baseAsset];
        
        uint256 indexPrice = market.indexPrice;
        uint256 markPrice = market.markPrice;
        
        // Calcular diferencia con índice
        uint256 indexDiff = indexPrice > markPrice ? 
            indexPrice.sub(markPrice) : 
            markPrice.sub(indexPrice);
            
        uint256 indexDiffBPS = indexDiff.mul(10000).div(indexPrice);
        
        require(indexDiffBPS >= 30, "PerpArb: Index difference too small"); // Mínimo 0.3%

        PositionSide side = markPrice < indexPrice ? PositionSide.LONG : PositionSide.SHORT;

        bool positionOpened = _openPerpetualPosition(
            params.protocol1,
            params.baseAsset,
            params.size,
            side,
            params.leverage
        );

        if (positionOpened) {
            uint256 indexProfit = params.size.mul(indexDiffBPS).div(10000);
            
            emit PerpetualArbitrageExecuted(
                msg.sender,
                params.arbType,
                params.protocol1,
                ProtocolType.PERPETUAL_V2,
                params.baseAsset,
                params.size,
                side,
                indexProfit
            );

            return (true, indexProfit);
        }

        return (false, 0);
    }

    /**
     * @dev Abre posición perpetua
     */
    function _openPerpetualPosition(
        ProtocolType protocol,
        address baseAsset,
        uint256 size,
        PositionSide side,
        uint256 leverage
    ) internal returns (bool success) {
        PerpetualMarket memory market = perpetualMarkets[protocol][baseAsset];
        require(size >= market.minSize, "PerpArb: Size too small");

        address protocolAddress = protocolAddresses[protocol];
        require(protocolAddress != address(0), "PerpArb: Protocol not configured");

        // Calcular margen requerido
        uint256 requiredMargin = size.div(leverage);
        
        // Verificar y aprobar margen
        IERC20(market.quoteAsset).safeApprove(protocolAddress, requiredMargin);

        try IPerpetualProtocol(protocolAddress).openPosition(
            baseAsset,
            size,
            side == PositionSide.LONG,
            leverage,
            market.markPrice // Usar mark price como precio límite
        ) {
            // Actualizar posición del usuario
            _updateUserPosition(
                msg.sender,
                protocol,
                baseAsset,
                size,
                side,
                leverage,
                market.markPrice
            );

            emit PositionOpened(
                msg.sender,
                protocol,
                baseAsset,
                size,
                side,
                market.markPrice,
                leverage
            );

            return true;
        } catch {
            return false;
        }
    }

    /**
     * @dev Abre posición de hedge
     */
    function _openHedgePosition(
        ProtocolType protocol,
        address baseAsset,
        uint256 size,
        PositionSide side
    ) internal returns (bool) {
        // Implementación simplificada para hedge
        return _openPerpetualPosition(protocol, baseAsset, size, side, 1);
    }

    /**
     * @dev Abre posición spot
     */
    function _openSpotPosition(
        address asset,
        uint256 size,
        PositionSide side
    ) internal returns (bool) {
        if (side == PositionSide.LONG) {
            // Comprar asset en spot
            IERC20(asset).safeTransferFrom(msg.sender, address(this), size);
        } else {
            // Vender asset en spot (requiere tener el asset)
            require(IERC20(asset).balanceOf(address(this)) >= size, "PerpArb: Insufficient spot balance");
        }
        
        return true;
    }

    /**
     * @dev Cierra posición perpetua
     */
    function closePerpetualPosition(
        ProtocolType protocol,
        address baseAsset,
        uint256 size
    ) external nonReentrant {
        PerpetualPosition storage position = userPositions[msg.sender][protocol];
        require(position.isActive, "PerpArb: No active position");
        require(position.size >= size, "PerpArb: Size too large");

        address protocolAddress = protocolAddresses[protocol];
        
        try IPerpetualProtocol(protocolAddress).closePosition(
            baseAsset,
            size
        ) {
            // Calcular PnL realizado
            PerpetualMarket memory market = perpetualMarkets[protocol][baseAsset];
            int256 pnl = _calculatePnL(position, market.markPrice, size);

            // Actualizar posición
            position.size = position.size.sub(size);
            if (position.size == 0) {
                position.isActive = false;
                _removeUserProtocol(msg.sender, protocol);
            }

            emit PositionClosed(
                msg.sender,
                protocol,
                baseAsset,
                size,
                pnl,
                position.fundingAccrued
            );

        } catch Error(string memory reason) {
            revert(string(abi.encodePacked("PerpArb: Close failed - ", reason)));
        }
    }

    /**
     * @dev Simula arbitraje de perpetuos
     */
    function simulate(bytes calldata data) 
        external 
        view 
        override 
        returns (bool canExecute, uint256 estimatedProfit) 
    {
        ArbitrageParams memory params = abi.decode(data, (ArbitrageParams));
        
        if (!supportedAssets[params.baseAsset]) {
            return (false, 0);
        }

        if (params.arbType == ArbitrageType.FUNDING_RATE) {
            return _simulateFundingArbitrage(params);
        } else if (params.arbType == ArbitrageType.BASIS_TRADING) {
            return _simulateBasisArbitrage(params);
        } else if (params.arbType == ArbitrageType.CROSS_EXCHANGE) {
            return _simulateCrossExchangeArbitrage(params);
        }

        return (false, 0);
    }

    /**
     * @dev Verifica si puede ejecutarse
     */
    function canExecute(bytes calldata data) external view override returns (bool) {
        (bool executable,) = this.simulate(data);
        return executable;
    }

    /**
     * @dev Información de la estrategia
     */
    function getStrategyInfo() external pure override returns (string memory name, string memory description) {
        return (
            "Perpetual Futures Arbitrage",
            "Arbitrage in perpetual futures markets including funding rate and basis trading"
        );
    }

    // ==================== FUNCIONES INTERNAS AUXILIARES ====================

    /**
     * @dev Simula arbitraje de funding
     */
    function _simulateFundingArbitrage(ArbitrageParams memory params) 
        internal 
        view 
        returns (bool canExecute, uint256 estimatedProfit) 
    {
        PerpetualMarket memory market = perpetualMarkets[params.protocol1][params.baseAsset];
        
        if (abs(market.fundingRate) >= MIN_FUNDING_RATE) {
            estimatedProfit = params.size.mul(uint256(abs(market.fundingRate))).div(10000);
            canExecute = estimatedProfit >= params.minProfit;
        }

        return (canExecute, estimatedProfit);
    }

    /**
     * @dev Simula arbitraje de basis
     */
    function _simulateBasisArbitrage(ArbitrageParams memory params) 
        internal 
        view 
        returns (bool canExecute, uint256 estimatedProfit) 
    {
        PerpetualMarket memory market = perpetualMarkets[params.protocol1][params.baseAsset];
        uint256 spotPrice = IPriceOracle(priceOracle).getPrice(params.baseAsset);
        
        uint256 basisDiff = market.markPrice > spotPrice ? 
            market.markPrice.sub(spotPrice) : 
            spotPrice.sub(market.markPrice);
            
        uint256 basisBPS = basisDiff.mul(10000).div(spotPrice);
        
        if (basisBPS >= 50) {
            estimatedProfit = params.size.mul(basisBPS).div(10000);
            canExecute = estimatedProfit >= params.minProfit;
        }

        return (canExecute, estimatedProfit);
    }

    /**
     * @dev Simula arbitraje cross-exchange
     */
    function _simulateCrossExchangeArbitrage(ArbitrageParams memory params) 
        internal 
        view 
        returns (bool canExecute, uint256 estimatedProfit) 
    {
        PerpetualMarket memory market1 = perpetualMarkets[params.protocol1][params.baseAsset];
        PerpetualMarket memory market2 = perpetualMarkets[params.protocol2][params.baseAsset];
        
        if (market1.isActive && market2.isActive) {
            uint256 priceDiff = market1.markPrice > market2.markPrice ? 
                market1.markPrice.sub(market2.markPrice) : 
                market2.markPrice.sub(market1.markPrice);
                
            uint256 diffBPS = priceDiff.mul(10000).div(
                market1.markPrice.add(market2.markPrice).div(2)
            );
            
            if (diffBPS >= 20) {
                estimatedProfit = params.size.mul(diffBPS).div(10000);
                canExecute = estimatedProfit >= params.minProfit;
            }
        }

        return (canExecute, estimatedProfit);
    }

    /**
     * @dev Actualiza datos de mercado
     */
    function _updateMarketData(ProtocolType protocol, address baseAsset) internal {
        PerpetualMarket storage market = perpetualMarkets[protocol][baseAsset];
        
        if (block.timestamp >= market.lastUpdate + fundingUpdateInterval) {
            address protocolAddress = protocolAddresses[protocol];
            
            if (protocolAddress != address(0)) {
                try IPerpetualProtocol(protocolAddress).getMarketData(baseAsset) returns (
                    uint256 markPrice,
                    uint256 indexPrice,
                    int256 fundingRate,
                    uint256 openInterest
                ) {
                    market.markPrice = markPrice;
                    market.indexPrice = indexPrice;
                    market.fundingRate = fundingRate;
                    market.openInterest = openInterest;
                    market.lastUpdate = block.timestamp;

                    emit FundingRateUpdated(protocol, baseAsset, fundingRate, block.timestamp);
                } catch {
                    // Mantener datos anteriores si falla la actualización
                }
            }
        }
    }

    /**
     * @dev Actualiza posición del usuario
     */
    function _updateUserPosition(
        address user,
        ProtocolType protocol,
        address baseAsset,
        uint256 size,
        PositionSide side,
        uint256 leverage,
        uint256 entryPrice
    ) internal {
        PerpetualPosition storage position = userPositions[user][protocol];
        
        if (!position.isActive) {
            position.protocol = protocol;
            position.baseAsset = baseAsset;
            position.entryTime = block.timestamp;
            position.isActive = true;
            userProtocols[user].push(protocol);
        }

        position.size = position.size.add(size);
        position.side = side;
        position.leverage = leverage;
        position.entryPrice = entryPrice;
        position.margin = position.margin.add(size.div(leverage));
    }

    /**
     * @dev Calcula PnL de una posición
     */
    function _calculatePnL(
        PerpetualPosition memory position,
        uint256 currentPrice,
        uint256 size
    ) internal pure returns (int256 pnl) {
        if (position.side == PositionSide.LONG) {
            pnl = int256(currentPrice.sub(position.entryPrice).mul(size).div(1e18));
        } else {
            pnl = int256(position.entryPrice.sub(currentPrice).mul(size).div(1e18));
        }
        
        return pnl;
    }

    /**
     * @dev Retorna el lado opuesto
     */
    function _oppositeSide(PositionSide side) internal pure returns (PositionSide) {
        return side == PositionSide.LONG ? PositionSide.SHORT : PositionSide.LONG;
    }

    /**
     * @dev Remueve protocolo del usuario
     */
    function _removeUserProtocol(address user, ProtocolType protocol) internal {
        ProtocolType[] storage protocols = userProtocols[user];
        for (uint256 i = 0; i < protocols.length; i++) {
            if (protocols[i] == protocol) {
                protocols[i] = protocols[protocols.length - 1];
                protocols.pop();
                break;
            }
        }
    }

    /**
     * @dev Función auxiliar para valor absoluto
     */
    function abs(int256 x) internal pure returns (uint256) {
        return x >= 0 ? uint256(x) : uint256(-x);
    }

    // ==================== FUNCIONES ADMINISTRATIVAS ====================

    /**
     * @dev Agrega mercado perpetuo
     */
    function addPerpetualMarket(
        ProtocolType protocol,
        address marketAddress,
        address baseAsset,
        address quoteAsset,
        uint256 maxLeverage,
        uint256 minSize,
        uint256 makerFee,
        uint256 takerFee
    ) external onlyOwner {
        perpetualMarkets[protocol][baseAsset] = PerpetualMarket({
            protocol: protocol,
            marketAddress: marketAddress,
            baseAsset: baseAsset,
            quoteAsset: quoteAsset,
            markPrice: 0,
            indexPrice: 0,
            fundingRate: 0,
            openInterest: 0,
            maxLeverage: maxLeverage,
            minSize: minSize,
            makerFee: makerFee,
            takerFee: takerFee,
            isActive: true,
            lastUpdate: 0
        });

        supportedAssets[baseAsset] = true;

        emit MarketAdded(protocol, baseAsset, marketAddress, maxLeverage);
    }

    /**
     * @dev Configura dirección de protocolo
     */
    function setProtocolAddress(ProtocolType protocol, address protocolAddress) external onlyOwner {
        protocolAddresses[protocol] = protocolAddress;
    }

    /**
     * @dev Configura parámetros
     */
    function setParameters(
        uint256 _positionFee,
        uint256 _fundingUpdateInterval,
        uint256 _maxPositionSize,
        address _priceOracle,
        address _riskManager,
        address _feeReceiver
    ) external onlyOwner {
        require(_positionFee <= 500, "PerpArb: Fee too high");
        
        positionFee = _positionFee;
        fundingUpdateInterval = _fundingUpdateInterval;
        maxPositionSize = _maxPositionSize;
        priceOracle = _priceOracle;
        riskManager = _riskManager;
        feeReceiver = _feeReceiver;
    }

    /**
     * @dev Función de emergencia
     */
    function emergencyPause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ==================== FUNCIONES DE VISTA ====================

    function getPerpetualMarket(ProtocolType protocol, address baseAsset) 
        external 
        view 
        returns (PerpetualMarket memory) 
    {
        return perpetualMarkets[protocol][baseAsset];
    }

    function getUserPosition(address user, ProtocolType protocol) 
        external 
        view 
        returns (PerpetualPosition memory) 
    {
        return userPositions[user][protocol];
    }

    function getUserProtocols(address user) external view returns (ProtocolType[] memory) {
        return userProtocols[user];
    }

    function getFundingOpportunities(address baseAsset) 
        external 
        view 
        returns (FundingOpportunity[] memory opportunities) 
    {
        opportunities = new FundingOpportunity[](3); // Máximo 3 por simplicidad
        
        uint256 count = 0;
        for (uint8 i = 0; i < 8 && count < 3; i++) {
            ProtocolType protocol = ProtocolType(i);
            PerpetualMarket memory market = perpetualMarkets[protocol][baseAsset];
            
            if (market.isActive && abs(market.fundingRate) >= MIN_FUNDING_RATE) {
                opportunities[count] = FundingOpportunity({
                    protocol: protocol,
                    baseAsset: baseAsset,
                    fundingRate: market.fundingRate,
                    annualizedRate: uint256(abs(market.fundingRate)).mul(365).mul(3), // 8h * 3 = 24h
                    recommendedSide: market.fundingRate > 0 ? PositionSide.SHORT : PositionSide.LONG,
                    maxProfitableSize: market.openInterest.div(10), // 10% del OI
                    estimatedProfit: 0,
                    riskScore: 25
                });
                count++;
            }
        }
        
        // Redimensionar array
        FundingOpportunity[] memory result = new FundingOpportunity[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = opportunities[i];
        }
        
        return result;
    }

    function getBasisOpportunities(address baseAsset) 
        external 
        view 
        returns (BasisOpportunity[] memory opportunities) 
    {
        opportunities = new BasisOpportunity[](2); // Simplicado para 2 oportunidades
        
        uint256 spotPrice = IPriceOracle(priceOracle).getPrice(baseAsset);
        uint256 count = 0;
        
        for (uint8 i = 0; i < 8 && count < 2; i++) {
            ProtocolType protocol = ProtocolType(i);
            PerpetualMarket memory market = perpetualMarkets[protocol][baseAsset];
            
            if (market.isActive && market.markPrice > 0) {
                uint256 basisDiff = market.markPrice > spotPrice ? 
                    market.markPrice.sub(spotPrice) : 
                    spotPrice.sub(market.markPrice);
                    
                uint256 basisBPS = basisDiff.mul(10000).div(spotPrice);
                
                if (basisBPS >= 50) {
                    opportunities[count] = BasisOpportunity({
                        baseAsset: baseAsset,
                        futuresProtocol: protocol,
                        spotExchange: address(0), // Simplificado
                        spotPrice: spotPrice,
                        futuresPrice: market.markPrice,
                        basisPoints: basisBPS,
                        isContango: market.markPrice > spotPrice,
                        annualizedBasis: basisBPS.mul(365), // Simplificado
                        maxSize: market.openInterest.div(20) // 5% del OI
                    });
                    count++;
                }
            }
        }
        
        // Redimensionar array
        BasisOpportunity[] memory result = new BasisOpportunity[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = opportunities[i];
        }
        
        return result;
    }
}
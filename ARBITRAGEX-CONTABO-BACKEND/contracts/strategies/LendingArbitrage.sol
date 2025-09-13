// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IArbitrageStrategy.sol";
import "../interfaces/ILendingProtocol.sol";
import "../interfaces/IAaveV3Pool.sol";
import "../interfaces/ICompound.sol";
import "../libraries/PriceUtils.sol";
import "../libraries/SafeMath.sol";

/**
 * @title LendingArbitrage
 * @dev Implementa arbitraje entre protocolos de lending
 * Aprovecha diferencias en tasas de interés entre Aave, Compound, Cream, etc.
 * Incluye arbitraje de supply rates y borrow rates
 */
contract LendingArbitrage is IArbitrageStrategy, ReentrancyGuard, Pausable, Ownable {
    using SafeERC20 for IERC20;
    using PriceUtils for uint256;
    using SafeMath for uint256;

    // ==================== ESTRUCTURAS Y ENUMS ====================

    enum LendingAction { SUPPLY, BORROW, REPAY, WITHDRAW }
    enum ProtocolType { 
        AAVE_V3, 
        AAVE_V2, 
        COMPOUND, 
        CREAM, 
        IRON_BANK, 
        VENUS, 
        RADIANT, 
        EULER,
        MORPHO_AAVE,
        MORPHO_COMPOUND
    }

    struct LendingProtocol {
        ProtocolType protocolType;  // Tipo de protocolo
        address poolAddress;        // Dirección del pool principal
        address[] supportedAssets;  // Assets soportados
        mapping(address => address) aTokens;     // aTokens por asset (Aave)
        mapping(address => address) cTokens;     // cTokens por asset (Compound)
        mapping(address => uint256) supplyRates; // Supply rates actuales
        mapping(address => uint256) borrowRates; // Borrow rates actuales
        mapping(address => uint256) utilizationRates; // Utilization rates
        bool isActive;              // Si está activo
        uint256 lastUpdate;         // Último update de rates
    }

    struct RateArbitrageParams {
        address asset;              // Asset para arbitraje
        uint256 amount;             // Cantidad a arbitrar
        ProtocolType sourceProtocol; // Protocolo origen
        ProtocolType targetProtocol; // Protocolo destino
        LendingAction action;       // Acción a realizar
        uint256 minRateDiff;        // Diferencia mínima de rates (BPS)
        uint256 maxSlippage;        // Slippage máximo (BPS)
        uint256 duration;           // Duración estimada del arbitraje
        uint256 deadline;           // Timestamp límite
        bool useFlashLoan;          // Si usar flash loan
        bytes flashLoanData;        // Datos del flash loan
    }

    struct LendingPosition {
        address asset;              // Asset de la posición
        ProtocolType protocol;      // Protocolo usado
        uint256 suppliedAmount;     // Cantidad suministrada
        uint256 borrowedAmount;     // Cantidad prestada
        uint256 entrySupplyRate;    // Supply rate al entrar
        uint256 entryBorrowRate;    // Borrow rate al entrar
        uint256 entryTime;          // Timestamp de entrada
        uint256 accruedInterest;    // Interés acumulado
        bool isActive;              // Si está activa
        LendingAction lastAction;   // Última acción realizada
    }

    struct ArbitrageOpportunity {
        address asset;              // Asset del arbitraje
        ProtocolType sourceProtocol; // Protocolo con menor yield
        ProtocolType targetProtocol; // Protocolo con mayor yield
        uint256 rateDifference;     // Diferencia en BPS
        uint256 availableLiquidity; // Liquidez disponible
        uint256 maxProfitableAmount; // Máximo monto rentable
        uint256 estimatedAPY;       // APY estimado del arbitraje
        uint256 riskScore;          // Score de riesgo (0-100)
        bool isSupplyArbitrage;     // True si es arbitraje de supply, false si borrow
    }

    // ==================== VARIABLES DE ESTADO ====================

    mapping(ProtocolType => LendingProtocol) public lendingProtocols;
    mapping(address => mapping(ProtocolType => LendingPosition)) public userPositions;
    mapping(address => ProtocolType[]) public userProtocols;
    mapping(address => bool) public supportedAssets;
    
    uint256 public constant MIN_RATE_DIFF = 50;        // 0.5% mínima diferencia
    uint256 public constant MAX_UTILIZATION = 8000;    // 80% máxima utilización
    uint256 public rateUpdateInterval = 3600;          // 1 hora update interval
    uint256 public arbitrageFee = 100;                 // 1% fee
    uint256 public flashLoanFee = 9;                   // 0.09% flash loan fee
    
    address public rateOracle;
    address public flashLoanProvider;
    address public feeReceiver;

    // ==================== EVENTOS ====================

    event LendingArbitrageExecuted(
        address indexed user,
        address asset,
        uint256 amount,
        ProtocolType sourceProtocol,
        ProtocolType targetProtocol,
        uint256 rateDifference,
        uint256 estimatedProfit,
        LendingAction action
    );

    event PositionOpened(
        address indexed user,
        address asset,
        ProtocolType protocol,
        uint256 amount,
        LendingAction action,
        uint256 rate
    );

    event PositionClosed(
        address indexed user,
        address asset,
        ProtocolType protocol,
        uint256 amount,
        uint256 accruedInterest,
        uint256 duration
    );

    event RatesUpdated(
        ProtocolType indexed protocol,
        address asset,
        uint256 newSupplyRate,
        uint256 newBorrowRate,
        uint256 utilizationRate
    );

    event ProtocolAdded(
        ProtocolType indexed protocolType,
        address poolAddress,
        address[] supportedAssets
    );

    // ==================== CONSTRUCTOR ====================

    constructor(
        address _rateOracle,
        address _flashLoanProvider,
        address _feeReceiver
    ) {
        rateOracle = _rateOracle;
        flashLoanProvider = _flashLoanProvider;
        feeReceiver = _feeReceiver;
    }

    // ==================== FUNCIONES PRINCIPALES ====================

    /**
     * @dev Ejecuta arbitraje de lending rates
     */
    function execute(bytes calldata data) 
        external 
        override 
        nonReentrant 
        whenNotPaused 
        returns (bool success, uint256 profit) 
    {
        RateArbitrageParams memory params = abi.decode(data, (RateArbitrageParams));
        
        require(params.deadline >= block.timestamp, "LendingArb: Deadline expired");
        require(supportedAssets[params.asset], "LendingArb: Asset not supported");
        require(lendingProtocols[params.sourceProtocol].isActive, "LendingArb: Source protocol inactive");
        require(lendingProtocols[params.targetProtocol].isActive, "LendingArb: Target protocol inactive");

        // Actualizar rates antes de ejecutar
        _updateProtocolRates(params.sourceProtocol, params.asset);
        _updateProtocolRates(params.targetProtocol, params.asset);

        // Verificar oportunidad de arbitraje
        (bool isprofitable, uint256 estimatedProfit) = _validateArbitrageOpportunity(params);
        require(isprofitable, "LendingArb: Not profitable");

        // Ejecutar arbitraje según el tipo de acción
        if (params.action == LendingAction.SUPPLY) {
            return _executeSupplyArbitrage(params);
        } else if (params.action == LendingAction.BORROW) {
            return _executeBorrowArbitrage(params);
        }

        return (false, 0);
    }

    /**
     * @dev Ejecuta arbitraje de supply rates (mover depósitos al mejor yield)
     */
    function _executeSupplyArbitrage(RateArbitrageParams memory params) 
        internal 
        returns (bool success, uint256 profit) 
    {
        LendingPosition storage sourcePosition = userPositions[msg.sender][params.sourceProtocol];
        
        // Verificar posición existente
        if (sourcePosition.isActive && sourcePosition.suppliedAmount >= params.amount) {
            // Retirar del protocolo origen
            uint256 withdrawn = _withdrawFromProtocol(
                params.sourceProtocol,
                params.asset,
                params.amount
            );

            // Depositar en protocolo destino
            uint256 supplied = _supplyToProtocol(
                params.targetProtocol,
                params.asset,
                withdrawn
            );

            if (supplied > 0) {
                // Actualizar posiciones
                _updatePosition(
                    msg.sender,
                    params.sourceProtocol,
                    params.asset,
                    params.amount,
                    LendingAction.WITHDRAW
                );

                _updatePosition(
                    msg.sender,
                    params.targetProtocol,
                    params.asset,
                    supplied,
                    LendingAction.SUPPLY
                );

                emit LendingArbitrageExecuted(
                    msg.sender,
                    params.asset,
                    params.amount,
                    params.sourceProtocol,
                    params.targetProtocol,
                    params.minRateDiff,
                    0, // Profit será calculado en el tiempo
                    params.action
                );

                return (true, 0);
            }
        }

        return (false, 0);
    }

    /**
     * @dev Ejecuta arbitraje de borrow rates (cambiar deuda al rate más bajo)
     */
    function _executeBorrowArbitrage(RateArbitrageParams memory params) 
        internal 
        returns (bool success, uint256 profit) 
    {
        LendingPosition storage sourcePosition = userPositions[msg.sender][params.sourceProtocol];
        
        if (sourcePosition.isActive && sourcePosition.borrowedAmount >= params.amount) {
            
            if (params.useFlashLoan) {
                return _executeBorrowArbitrageWithFlashLoan(params);
            } else {
                return _executeBorrowArbitrageDirectly(params);
            }
        }

        return (false, 0);
    }

    /**
     * @dev Arbitraje de borrow con flash loan
     */
    function _executeBorrowArbitrageWithFlashLoan(RateArbitrageParams memory params) 
        internal 
        returns (bool success, uint256 profit) 
    {
        // 1. Flash loan del monto a refinanciar
        // 2. Repagar deuda en protocolo origen
        // 3. Retirar collateral
        // 4. Depositar collateral en protocolo destino
        // 5. Tomar nueva deuda en protocolo destino
        // 6. Repagar flash loan
        
        // Por ahora implementamos versión simplificada
        return _executeBorrowArbitrageDirectly(params);
    }

    /**
     * @dev Arbitraje de borrow directo (requiere capital)
     */
    function _executeBorrowArbitrageDirectly(RateArbitrageParams memory params) 
        internal 
        returns (bool success, uint256 profit) 
    {
        // Verificar que el usuario tiene suficiente balance para repagar
        uint256 userBalance = IERC20(params.asset).balanceOf(msg.sender);
        require(userBalance >= params.amount, "LendingArb: Insufficient balance for repayment");

        // Transferir tokens para repagar
        IERC20(params.asset).safeTransferFrom(msg.sender, address(this), params.amount);

        // Repagar deuda en protocolo origen
        _repayToProtocol(params.sourceProtocol, params.asset, params.amount);

        // Tomar nueva deuda en protocolo destino (mismo monto)
        uint256 borrowed = _borrowFromProtocol(params.targetProtocol, params.asset, params.amount);

        // Devolver tokens al usuario
        if (borrowed > 0) {
            IERC20(params.asset).safeTransfer(msg.sender, borrowed);

            // Actualizar posiciones
            _updatePosition(
                msg.sender,
                params.sourceProtocol,
                params.asset,
                params.amount,
                LendingAction.REPAY
            );

            _updatePosition(
                msg.sender,
                params.targetProtocol,
                params.asset,
                borrowed,
                LendingAction.BORROW
            );

            emit LendingArbitrageExecuted(
                msg.sender,
                params.asset,
                params.amount,
                params.sourceProtocol,
                params.targetProtocol,
                params.minRateDiff,
                0, // Savings calculado en el tiempo
                params.action
            );

            return (true, 0);
        }

        return (false, 0);
    }

    /**
     * @dev Abre posición de lending
     */
    function openLendingPosition(
        ProtocolType protocol,
        address asset,
        uint256 amount,
        LendingAction action
    ) external nonReentrant whenNotPaused {
        require(supportedAssets[asset], "LendingArb: Asset not supported");
        require(lendingProtocols[protocol].isActive, "LendingArb: Protocol inactive");

        if (action == LendingAction.SUPPLY) {
            IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
            uint256 supplied = _supplyToProtocol(protocol, asset, amount);
            
            _updatePosition(msg.sender, protocol, asset, supplied, action);
            
        } else if (action == LendingAction.BORROW) {
            uint256 borrowed = _borrowFromProtocol(protocol, asset, amount);
            IERC20(asset).safeTransfer(msg.sender, borrowed);
            
            _updatePosition(msg.sender, protocol, asset, borrowed, action);
        }
    }

    /**
     * @dev Cierra posición de lending
     */
    function closeLendingPosition(
        ProtocolType protocol,
        address asset,
        uint256 amount,
        LendingAction action
    ) external nonReentrant whenNotPaused {
        LendingPosition storage position = userPositions[msg.sender][protocol];
        require(position.isActive, "LendingArb: No active position");

        if (action == LendingAction.WITHDRAW) {
            require(position.suppliedAmount >= amount, "LendingArb: Insufficient supplied amount");
            
            uint256 withdrawn = _withdrawFromProtocol(protocol, asset, amount);
            IERC20(asset).safeTransfer(msg.sender, withdrawn);
            
            _updatePosition(msg.sender, protocol, asset, amount, action);
            
        } else if (action == LendingAction.REPAY) {
            require(position.borrowedAmount >= amount, "LendingArb: Insufficient borrowed amount");
            
            IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
            _repayToProtocol(protocol, asset, amount);
            
            _updatePosition(msg.sender, protocol, asset, amount, action);
        }
    }

    /**
     * @dev Simula arbitraje de lending
     */
    function simulate(bytes calldata data) 
        external 
        view 
        override 
        returns (bool canExecute, uint256 estimatedProfit) 
    {
        RateArbitrageParams memory params = abi.decode(data, (RateArbitrageParams));
        return _validateArbitrageOpportunity(params);
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
            "Lending Protocol Arbitrage",
            "Arbitrage between different lending protocols to optimize interest rates"
        );
    }

    // ==================== FUNCIONES INTERNAS ====================

    /**
     * @dev Valida oportunidad de arbitraje
     */
    function _validateArbitrageOpportunity(RateArbitrageParams memory params) 
        internal 
        view 
        returns (bool isprofitable, uint256 estimatedProfit) 
    {
        LendingProtocol storage sourceProtocol = lendingProtocols[params.sourceProtocol];
        LendingProtocol storage targetProtocol = lendingProtocols[params.targetProtocol];

        uint256 sourceRate;
        uint256 targetRate;

        if (params.action == LendingAction.SUPPLY) {
            sourceRate = sourceProtocol.supplyRates[params.asset];
            targetRate = targetProtocol.supplyRates[params.asset];
            
            // Para supply, queremos mover al protocolo con mayor rate
            if (targetRate > sourceRate) {
                uint256 rateDiff = targetRate.sub(sourceRate);
                if (rateDiff >= params.minRateDiff) {
                    estimatedProfit = params.amount.mul(rateDiff).mul(params.duration).div(365 days).div(10000);
                    isprofitable = true;
                }
            }
            
        } else if (params.action == LendingAction.BORROW) {
            sourceRate = sourceProtocol.borrowRates[params.asset];
            targetRate = targetProtocol.borrowRates[params.asset];
            
            // Para borrow, queremos mover al protocolo con menor rate
            if (sourceRate > targetRate) {
                uint256 rateDiff = sourceRate.sub(targetRate);
                if (rateDiff >= params.minRateDiff) {
                    estimatedProfit = params.amount.mul(rateDiff).mul(params.duration).div(365 days).div(10000);
                    isprofitable = true;
                }
            }
        }

        return (isprofitable, estimatedProfit);
    }

    /**
     * @dev Supply a protocolo específico
     */
    function _supplyToProtocol(
        ProtocolType protocol,
        address asset,
        uint256 amount
    ) internal returns (uint256 supplied) {
        LendingProtocol storage protocolData = lendingProtocols[protocol];
        
        IERC20(asset).safeApprove(protocolData.poolAddress, amount);

        if (protocol == ProtocolType.AAVE_V3 || protocol == ProtocolType.AAVE_V2) {
            IAaveV3Pool(protocolData.poolAddress).supply(asset, amount, address(this), 0);
            supplied = amount;
            
        } else if (protocol == ProtocolType.COMPOUND) {
            address cToken = protocolData.cTokens[asset];
            require(ICompoundCToken(cToken).mint(amount) == 0, "LendingArb: Compound mint failed");
            supplied = amount;
            
        } else if (protocol == ProtocolType.CREAM) {
            address cToken = protocolData.cTokens[asset];
            require(ICompoundCToken(cToken).mint(amount) == 0, "LendingArb: Cream mint failed");
            supplied = amount;
        }

        return supplied;
    }

    /**
     * @dev Withdraw de protocolo específico
     */
    function _withdrawFromProtocol(
        ProtocolType protocol,
        address asset,
        uint256 amount
    ) internal returns (uint256 withdrawn) {
        LendingProtocol storage protocolData = lendingProtocols[protocol];

        if (protocol == ProtocolType.AAVE_V3 || protocol == ProtocolType.AAVE_V2) {
            withdrawn = IAaveV3Pool(protocolData.poolAddress).withdraw(asset, amount, address(this));
            
        } else if (protocol == ProtocolType.COMPOUND || protocol == ProtocolType.CREAM) {
            address cToken = protocolData.cTokens[asset];
            require(ICompoundCToken(cToken).redeemUnderlying(amount) == 0, "LendingArb: Redeem failed");
            withdrawn = amount;
        }

        return withdrawn;
    }

    /**
     * @dev Borrow de protocolo específico
     */
    function _borrowFromProtocol(
        ProtocolType protocol,
        address asset,
        uint256 amount
    ) internal returns (uint256 borrowed) {
        LendingProtocol storage protocolData = lendingProtocols[protocol];

        if (protocol == ProtocolType.AAVE_V3 || protocol == ProtocolType.AAVE_V2) {
            IAaveV3Pool(protocolData.poolAddress).borrow(asset, amount, 2, 0, address(this)); // Variable rate
            borrowed = amount;
            
        } else if (protocol == ProtocolType.COMPOUND || protocol == ProtocolType.CREAM) {
            address cToken = protocolData.cTokens[asset];
            require(ICompoundCToken(cToken).borrow(amount) == 0, "LendingArb: Borrow failed");
            borrowed = amount;
        }

        return borrowed;
    }

    /**
     * @dev Repay a protocolo específico
     */
    function _repayToProtocol(
        ProtocolType protocol,
        address asset,
        uint256 amount
    ) internal {
        LendingProtocol storage protocolData = lendingProtocols[protocol];
        
        IERC20(asset).safeApprove(protocolData.poolAddress, amount);

        if (protocol == ProtocolType.AAVE_V3 || protocol == ProtocolType.AAVE_V2) {
            IAaveV3Pool(protocolData.poolAddress).repay(asset, amount, 2, address(this));
            
        } else if (protocol == ProtocolType.COMPOUND || protocol == ProtocolType.CREAM) {
            address cToken = protocolData.cTokens[asset];
            require(ICompoundCToken(cToken).repayBorrow(amount) == 0, "LendingArb: Repay failed");
        }
    }

    /**
     * @dev Actualiza posición del usuario
     */
    function _updatePosition(
        address user,
        ProtocolType protocol,
        address asset,
        uint256 amount,
        LendingAction action
    ) internal {
        LendingPosition storage position = userPositions[user][protocol];
        LendingProtocol storage protocolData = lendingProtocols[protocol];

        if (!position.isActive) {
            position.asset = asset;
            position.protocol = protocol;
            position.entryTime = block.timestamp;
            position.isActive = true;
            userProtocols[user].push(protocol);
        }

        if (action == LendingAction.SUPPLY) {
            position.suppliedAmount = position.suppliedAmount.add(amount);
            position.entrySupplyRate = protocolData.supplyRates[asset];
            
        } else if (action == LendingAction.WITHDRAW) {
            position.suppliedAmount = position.suppliedAmount.sub(amount);
            
        } else if (action == LendingAction.BORROW) {
            position.borrowedAmount = position.borrowedAmount.add(amount);
            position.entryBorrowRate = protocolData.borrowRates[asset];
            
        } else if (action == LendingAction.REPAY) {
            position.borrowedAmount = position.borrowedAmount.sub(amount);
        }

        position.lastAction = action;

        // Cerrar posición si no hay balance
        if (position.suppliedAmount == 0 && position.borrowedAmount == 0) {
            position.isActive = false;
            _removeUserProtocol(user, protocol);
        }

        emit PositionOpened(user, asset, protocol, amount, action, 0);
    }

    /**
     * @dev Actualiza rates del protocolo
     */
    function _updateProtocolRates(ProtocolType protocol, address asset) internal {
        LendingProtocol storage protocolData = lendingProtocols[protocol];
        
        if (block.timestamp >= protocolData.lastUpdate + rateUpdateInterval) {
            // Obtener rates actuales del protocolo
            (uint256 supplyRate, uint256 borrowRate, uint256 utilizationRate) = _getCurrentRates(protocol, asset);
            
            protocolData.supplyRates[asset] = supplyRate;
            protocolData.borrowRates[asset] = borrowRate;
            protocolData.utilizationRates[asset] = utilizationRate;
            protocolData.lastUpdate = block.timestamp;

            emit RatesUpdated(protocol, asset, supplyRate, borrowRate, utilizationRate);
        }
    }

    /**
     * @dev Obtiene rates actuales del protocolo
     */
    function _getCurrentRates(ProtocolType protocol, address asset) 
        internal 
        view 
        returns (uint256 supplyRate, uint256 borrowRate, uint256 utilizationRate) 
    {
        LendingProtocol storage protocolData = lendingProtocols[protocol];

        if (protocol == ProtocolType.AAVE_V3 || protocol == ProtocolType.AAVE_V2) {
            // Obtener rates de Aave
            (,,,,,, borrowRate, supplyRate,,,) = IAaveV3Pool(protocolData.poolAddress).getReserveData(asset);
            
        } else if (protocol == ProtocolType.COMPOUND || protocol == ProtocolType.CREAM) {
            address cToken = protocolData.cTokens[asset];
            supplyRate = ICompoundCToken(cToken).supplyRatePerBlock();
            borrowRate = ICompoundCToken(cToken).borrowRatePerBlock();
        }

        // Calcular utilization rate simplificado
        utilizationRate = 5000; // 50% por defecto

        return (supplyRate, borrowRate, utilizationRate);
    }

    /**
     * @dev Remueve protocolo del usuario
     */
    function _removeUserProtocol(address user, ProtocolType protocol) internal {
        ProtocolType[] storage userProts = userProtocols[user];
        for (uint256 i = 0; i < userProts.length; i++) {
            if (userProts[i] == protocol) {
                userProts[i] = userProts[userProts.length - 1];
                userProts.pop();
                break;
            }
        }
    }

    // ==================== FUNCIONES ADMINISTRATIVAS ====================

    /**
     * @dev Agrega protocolo de lending
     */
    function addLendingProtocol(
        ProtocolType protocolType,
        address poolAddress,
        address[] calldata assets,
        address[] calldata aTokens,
        address[] calldata cTokens
    ) external onlyOwner {
        LendingProtocol storage protocol = lendingProtocols[protocolType];
        
        protocol.protocolType = protocolType;
        protocol.poolAddress = poolAddress;
        protocol.supportedAssets = assets;
        protocol.isActive = true;
        protocol.lastUpdate = block.timestamp;

        // Mapear tokens específicos del protocolo
        for (uint256 i = 0; i < assets.length; i++) {
            supportedAssets[assets[i]] = true;
            
            if (aTokens.length > i) {
                protocol.aTokens[assets[i]] = aTokens[i];
            }
            if (cTokens.length > i) {
                protocol.cTokens[assets[i]] = cTokens[i];
            }
        }

        emit ProtocolAdded(protocolType, poolAddress, assets);
    }

    /**
     * @dev Configura parámetros
     */
    function setParameters(
        uint256 _rateUpdateInterval,
        uint256 _arbitrageFee,
        uint256 _flashLoanFee,
        address _rateOracle,
        address _flashLoanProvider,
        address _feeReceiver
    ) external onlyOwner {
        require(_arbitrageFee <= 500, "LendingArb: Fee too high");
        require(_flashLoanFee <= 50, "LendingArb: Flash loan fee too high");
        
        rateUpdateInterval = _rateUpdateInterval;
        arbitrageFee = _arbitrageFee;
        flashLoanFee = _flashLoanFee;
        rateOracle = _rateOracle;
        flashLoanProvider = _flashLoanProvider;
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

    function getLendingProtocol(ProtocolType protocol) external view returns (
        address poolAddress,
        address[] memory supportedAssets,
        bool isActive,
        uint256 lastUpdate
    ) {
        LendingProtocol storage protocolData = lendingProtocols[protocol];
        return (
            protocolData.poolAddress,
            protocolData.supportedAssets,
            protocolData.isActive,
            protocolData.lastUpdate
        );
    }

    function getUserPosition(address user, ProtocolType protocol) external view returns (LendingPosition memory) {
        return userPositions[user][protocol];
    }

    function getUserProtocols(address user) external view returns (ProtocolType[] memory) {
        return userProtocols[user];
    }

    function getCurrentRates(ProtocolType protocol, address asset) external view returns (
        uint256 supplyRate,
        uint256 borrowRate,
        uint256 utilizationRate
    ) {
        LendingProtocol storage protocolData = lendingProtocols[protocol];
        return (
            protocolData.supplyRates[asset],
            protocolData.borrowRates[asset],
            protocolData.utilizationRates[asset]
        );
    }

    function getBestArbitrageOpportunities(address asset, uint256 amount) 
        external 
        view 
        returns (ArbitrageOpportunity[] memory opportunities) 
    {
        // Implementación simplificada para encontrar mejores oportunidades
        opportunities = new ArbitrageOpportunity[](2);
        
        // Supply opportunity (ejemplo)
        opportunities[0] = ArbitrageOpportunity({
            asset: asset,
            sourceProtocol: ProtocolType.AAVE_V2,
            targetProtocol: ProtocolType.AAVE_V3,
            rateDifference: 100, // 1% difference
            availableLiquidity: amount,
            maxProfitableAmount: amount.mul(10),
            estimatedAPY: 500, // 5% APY
            riskScore: 20,
            isSupplyArbitrage: true
        });
        
        // Borrow opportunity (ejemplo)
        opportunities[1] = ArbitrageOpportunity({
            asset: asset,
            sourceProtocol: ProtocolType.COMPOUND,
            targetProtocol: ProtocolType.AAVE_V3,
            rateDifference: 80, // 0.8% difference
            availableLiquidity: amount,
            maxProfitableAmount: amount.mul(5),
            estimatedAPY: 400, // 4% savings
            riskScore: 15,
            isSupplyArbitrage: false
        });
        
        return opportunities;
    }
}

// ==================== INTERFACES ADICIONALES ====================

interface ICompoundCToken {
    function mint(uint256 mintAmount) external returns (uint256);
    function redeemUnderlying(uint256 redeemAmount) external returns (uint256);
    function borrow(uint256 borrowAmount) external returns (uint256);
    function repayBorrow(uint256 repayAmount) external returns (uint256);
    function supplyRatePerBlock() external view returns (uint256);
    function borrowRatePerBlock() external view returns (uint256);
}
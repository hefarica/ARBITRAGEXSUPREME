// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IArbitrageStrategy.sol";
import "../interfaces/IFlashBotsRelay.sol";
import "../interfaces/IMEVProtection.sol";
import "../libraries/PriceUtils.sol";
import "../libraries/SafeMath.sol";

/**
 * @title MEVArbitrage
 * @dev Implementa estrategias de MEV (Maximal Extractable Value)
 * Incluye frontrunning, backrunning, sandwich attacks protection y arbitraje de liquidaciones
 * Integra con Flashbots y otros relays privados para ejecución MEV-protected
 */
contract MEVArbitrage is IArbitrageStrategy, ReentrancyGuard, Pausable, Ownable {
    using SafeERC20 for IERC20;
    using PriceUtils for uint256;
    using SafeMath for uint256;

    // ==================== ESTRUCTURAS Y ENUMS ====================

    enum MEVType {
        FRONTRUN_PROTECTION,    // Protección contra frontrunning
        BACKRUN_ARBITRAGE,     // Arbitraje de backrunning
        SANDWICH_PROTECTION,   // Protección contra sandwich
        LIQUIDATION_MEV,       // MEV de liquidaciones
        NFT_ARBITRAGE,         // Arbitraje de NFTs
        PRIVATE_MEMPOOL,       // Mempool privado
        BUNDLE_ARBITRAGE,      // Arbitraje en bundles
        FLASHBOTS_ARBITRAGE    // Arbitraje via Flashbots
    }

    enum Priority {
        LOW,      // Baja prioridad
        MEDIUM,   // Prioridad media
        HIGH,     // Alta prioridad
        CRITICAL  // Prioridad crítica
    }

    struct MEVParams {
        MEVType mevType;           // Tipo de MEV
        address targetTx;          // Transaction objetivo (para frontrun/backrun)
        address[] tokens;          // Tokens involucrados
        uint256[] amounts;         // Cantidades
        uint256 gasPrice;          // Precio de gas objetivo
        uint256 maxGasLimit;       // Límite máximo de gas
        Priority priority;         // Prioridad de ejecución
        uint256 minProfit;         // Ganancia mínima
        uint256 maxSlippage;       // Slippage máximo
        uint256 deadline;          // Timestamp límite
        bytes mevData;             // Datos específicos de MEV
        bool usePrivateMempool;    // Si usar mempool privado
        address flashbotsRelay;    // Relay de Flashbots
    }

    struct MEVOpportunity {
        MEVType mevType;           // Tipo de oportunidad
        address targetContract;    // Contrato objetivo
        bytes txData;              // Datos de transacción
        uint256 estimatedProfit;   // Ganancia estimada
        uint256 gasRequired;       // Gas requerido
        uint256 competition;       // Nivel de competencia (0-100)
        Priority recommendedPriority; // Prioridad recomendada
        uint256 timeWindow;        // Ventana de tiempo (bloques)
        bool requiresFlashLoan;    // Si requiere flash loan
        uint256 riskScore;         // Score de riesgo
    }

    struct BundleParams {
        address[] targets;         // Contratos objetivo
        bytes[] calldatas;         // Datos de llamadas
        uint256[] values;          // Valores ETH
        uint256 blockNumber;       // Número de bloque objetivo
        uint256 minTimestamp;      // Timestamp mínimo
        uint256 maxTimestamp;      // Timestamp máximo
        uint256 bundleHash;        // Hash del bundle
        uint256 bidAmount;         // Monto de bid para el bundle
    }

    struct LiquidationTarget {
        address protocol;          // Protocolo de lending
        address user;              // Usuario a liquidar
        address collateralAsset;   // Asset de colateral
        address debtAsset;         // Asset de deuda
        uint256 debtAmount;        // Cantidad de deuda
        uint256 collateralAmount;  // Cantidad de colateral
        uint256 healthFactor;      // Factor de salud
        uint256 liquidationBonus;  // Bonus de liquidación
        uint256 estimatedProfit;   // Ganancia estimada
    }

    // ==================== VARIABLES DE ESTADO ====================

    mapping(address => bool) public authorizedRelays;
    mapping(address => bool) public mevProtectedContracts;
    mapping(bytes32 => MEVOpportunity) public mevOpportunities;
    mapping(address => uint256) public userNonces;
    mapping(address => bool) public whitelistedSearchers;
    
    uint256 public constant MAX_GAS_PRICE = 1000e9;      // 1000 gwei máximo
    uint256 public constant MIN_PROFIT_THRESHOLD = 1e16; // 0.01 ETH mínimo
    uint256 public mevFee = 200;                         // 2% fee de MEV
    uint256 public flashbotsFee = 100;                   // 1% fee Flashbots
    uint256 public maxBundleSize = 10;                   // Máximo 10 txs por bundle
    uint256 public competitionThreshold = 70;            // 70% threshold de competencia
    
    address public flashbotsRelay;
    address public mevProtectionContract;
    address public liquidationBot;
    address public feeReceiver;

    // ==================== EVENTOS ====================

    event MEVArbitrageExecuted(
        address indexed user,
        MEVType mevType,
        uint256 profit,
        uint256 gasUsed,
        uint256 gasPrice,
        bool usedPrivateMempool
    );

    event MEVOpportunityDetected(
        bytes32 indexed opportunityId,
        MEVType mevType,
        address targetContract,
        uint256 estimatedProfit,
        Priority priority
    );

    event BundleSubmitted(
        bytes32 indexed bundleHash,
        uint256 blockNumber,
        uint256 bidAmount,
        uint256 txCount
    );

    event LiquidationExecuted(
        address indexed protocol,
        address indexed user,
        address collateralAsset,
        address debtAsset,
        uint256 liquidatedAmount,
        uint256 profit
    );

    event MEVProtectionActivated(
        address indexed user,
        address contract_,
        MEVType protectionType
    );

    // ==================== CONSTRUCTOR ====================

    constructor(
        address _flashbotsRelay,
        address _mevProtectionContract,
        address _liquidationBot,
        address _feeReceiver
    ) {
        flashbotsRelay = _flashbotsRelay;
        mevProtectionContract = _mevProtectionContract;
        liquidationBot = _liquidationBot;
        feeReceiver = _feeReceiver;
        
        authorizedRelays[_flashbotsRelay] = true;
        whitelistedSearchers[msg.sender] = true;
    }

    // ==================== MODIFICADORES ====================

    modifier onlyWhitelistedSearcher() {
        require(whitelistedSearchers[msg.sender], "MEV: Not whitelisted searcher");
        _;
    }

    modifier mevProtected() {
        if (mevProtectionContract != address(0)) {
            require(
                IMEVProtection(mevProtectionContract).isProtectedTransaction(msg.sender, msg.data),
                "MEV: Transaction not MEV protected"
            );
        }
        _;
    }

    // ==================== FUNCIONES PRINCIPALES ====================

    /**
     * @dev Ejecuta estrategia de MEV
     */
    function execute(bytes calldata data) 
        external 
        override 
        nonReentrant 
        whenNotPaused 
        onlyWhitelistedSearcher
        mevProtected
        returns (bool success, uint256 profit) 
    {
        MEVParams memory params = abi.decode(data, (MEVParams));
        
        require(params.deadline >= block.timestamp, "MEV: Deadline expired");
        require(params.gasPrice <= MAX_GAS_PRICE, "MEV: Gas price too high");

        // Verificar competencia antes de ejecutar
        if (_checkCompetition(params) > competitionThreshold) {
            return (false, 0);
        }

        uint256 initialGas = gasleft();

        // Ejecutar según tipo de MEV
        if (params.mevType == MEVType.BACKRUN_ARBITRAGE) {
            return _executeBackrunArbitrage(params);
        } else if (params.mevType == MEVType.LIQUIDATION_MEV) {
            return _executeLiquidationMEV(params);
        } else if (params.mevType == MEVType.FLASHBOTS_ARBITRAGE) {
            return _executeFlashbotsArbitrage(params);
        } else if (params.mevType == MEVType.BUNDLE_ARBITRAGE) {
            return _executeBundleArbitrage(params);
        } else if (params.mevType == MEVType.PRIVATE_MEMPOOL) {
            return _executePrivateMempoolArbitrage(params);
        }

        return (false, 0);
    }

    /**
     * @dev Ejecuta backrun arbitrage
     */
    function _executeBackrunArbitrage(MEVParams memory params) 
        internal 
        returns (bool success, uint256 profit) 
    {
        // Esperar a que se confirme la transacción objetivo
        if (params.targetTx != address(0)) {
            // Verificar que la tx objetivo se ejecutó en este bloque
            require(_isTargetTxInCurrentBlock(params.targetTx), "MEV: Target tx not found");
        }

        // Ejecutar arbitraje inmediatamente después
        bytes memory arbData = abi.decode(params.mevData, (bytes));
        
        // Ejecutar lógica de arbitraje específica
        try this._executeBackrunLogic(params.tokens, params.amounts, arbData) returns (uint256 arbProfit) {
            
            if (arbProfit >= params.minProfit) {
                _handleMEVProfit(arbProfit, params.usePrivateMempool);
                
                emit MEVArbitrageExecuted(
                    msg.sender,
                    params.mevType,
                    arbProfit,
                    tx.gasprice,
                    tx.gasprice,
                    params.usePrivateMempool
                );
                
                return (true, arbProfit);
            }
        } catch {
            return (false, 0);
        }

        return (false, 0);
    }

    /**
     * @dev Ejecuta MEV de liquidaciones
     */
    function _executeLiquidationMEV(MEVParams memory params) 
        internal 
        returns (bool success, uint256 profit) 
    {
        LiquidationTarget memory target = abi.decode(params.mevData, (LiquidationTarget));
        
        // Verificar que la posición es liquidable
        require(target.healthFactor < 1e18, "MEV: Position not liquidable");
        
        // Obtener flash loan si es necesario
        if (target.debtAmount > IERC20(target.debtAsset).balanceOf(address(this))) {
            bool flashLoanSuccess = _getFlashLoanForLiquidation(target);
            if (!flashLoanSuccess) {
                return (false, 0);
            }
        }

        // Ejecutar liquidación
        try this._executeLiquidation(target) returns (uint256 liquidationProfit) {
            
            if (liquidationProfit >= params.minProfit) {
                emit LiquidationExecuted(
                    target.protocol,
                    target.user,
                    target.collateralAsset,
                    target.debtAsset,
                    target.debtAmount,
                    liquidationProfit
                );
                
                return (true, liquidationProfit);
            }
        } catch {
            return (false, 0);
        }

        return (false, 0);
    }

    /**
     * @dev Ejecuta arbitraje via Flashbots
     */
    function _executeFlashbotsArbitrage(MEVParams memory params) 
        internal 
        returns (bool success, uint256 profit) 
    {
        require(authorizedRelays[params.flashbotsRelay], "MEV: Relay not authorized");
        
        BundleParams memory bundle = abi.decode(params.mevData, (BundleParams));
        
        // Preparar bundle para Flashbots
        bool bundleSubmitted = _submitFlashbotsBundle(bundle, params.flashbotsRelay);
        
        if (bundleSubmitted) {
            // Simular ganancia del bundle
            uint256 bundleProfit = _simulateBundleProfit(bundle);
            
            if (bundleProfit >= params.minProfit) {
                emit BundleSubmitted(
                    bytes32(bundle.bundleHash),
                    bundle.blockNumber,
                    bundle.bidAmount,
                    bundle.targets.length
                );
                
                return (true, bundleProfit);
            }
        }

        return (false, 0);
    }

    /**
     * @dev Ejecuta arbitraje de bundle
     */
    function _executeBundleArbitrage(MEVParams memory params) 
        internal 
        returns (bool success, uint256 profit) 
    {
        BundleParams memory bundle = abi.decode(params.mevData, (BundleParams));
        
        require(bundle.targets.length <= maxBundleSize, "MEV: Bundle too large");
        require(bundle.blockNumber >= block.number, "MEV: Block number too old");

        uint256 totalProfit = 0;
        
        // Ejecutar todas las transacciones del bundle
        for (uint256 i = 0; i < bundle.targets.length; i++) {
            try this._executeBundleTransaction(
                bundle.targets[i],
                bundle.calldatas[i],
                bundle.values[i]
            ) returns (uint256 txProfit) {
                totalProfit = totalProfit.add(txProfit);
            } catch {
                // Si falla una transacción, el bundle completo falla
                return (false, 0);
            }
        }

        if (totalProfit >= params.minProfit) {
            _handleMEVProfit(totalProfit, params.usePrivateMempool);
            return (true, totalProfit);
        }

        return (false, 0);
    }

    /**
     * @dev Ejecuta arbitraje en mempool privado
     */
    function _executePrivateMempoolArbitrage(MEVParams memory params) 
        internal 
        returns (bool success, uint256 profit) 
    {
        // Usar mempool privado para evitar competencia
        require(params.usePrivateMempool, "MEV: Private mempool required");
        
        // Ejecutar arbitraje sin exposición pública
        bytes memory arbData = abi.decode(params.mevData, (bytes));
        
        try this._executePrivateArbitrage(params.tokens, params.amounts, arbData) returns (uint256 privateProfit) {
            
            if (privateProfit >= params.minProfit) {
                _handleMEVProfit(privateProfit, true);
                
                emit MEVArbitrageExecuted(
                    msg.sender,
                    params.mevType,
                    privateProfit,
                    tx.gasprice,
                    tx.gasprice,
                    true
                );
                
                return (true, privateProfit);
            }
        } catch {
            return (false, 0);
        }

        return (false, 0);
    }

    /**
     * @dev Activa protección MEV para el usuario
     */
    function activateMEVProtection(
        address contract_,
        MEVType protectionType,
        uint256 maxSlippage
    ) external {
        require(mevProtectionContract != address(0), "MEV: Protection not available");
        
        IMEVProtection(mevProtectionContract).activateProtection(
            msg.sender,
            contract_,
            uint256(protectionType),
            maxSlippage
        );

        emit MEVProtectionActivated(msg.sender, contract_, protectionType);
    }

    /**
     * @dev Detecta oportunidades de MEV
     */
    function detectMEVOpportunities(
        address[] calldata contracts,
        uint256 blockNumber
    ) external view returns (MEVOpportunity[] memory opportunities) {
        opportunities = new MEVOpportunity[](contracts.length);
        
        for (uint256 i = 0; i < contracts.length; i++) {
            opportunities[i] = _analyzeMEVOpportunity(contracts[i], blockNumber);
        }
        
        return opportunities;
    }

    /**
     * @dev Simula ejecución de MEV
     */
    function simulate(bytes calldata data) 
        external 
        view 
        override 
        returns (bool canExecute, uint256 estimatedProfit) 
    {
        MEVParams memory params = abi.decode(data, (MEVParams));
        
        if (params.mevType == MEVType.LIQUIDATION_MEV) {
            return _simulateLiquidationMEV(params);
        } else if (params.mevType == MEVType.BACKRUN_ARBITRAGE) {
            return _simulateBackrunArbitrage(params);
        } else if (params.mevType == MEVType.BUNDLE_ARBITRAGE) {
            return _simulateBundleArbitrage(params);
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
            "MEV Arbitrage",
            "Maximal Extractable Value arbitrage with MEV protection and Flashbots integration"
        );
    }

    // ==================== FUNCIONES INTERNAS ====================

    /**
     * @dev Ejecuta lógica de backrun
     */
    function _executeBackrunLogic(
        address[] memory tokens,
        uint256[] memory amounts,
        bytes memory data
    ) external returns (uint256 profit) {
        require(msg.sender == address(this), "MEV: Internal function");
        
        // Implementar lógica específica de backrun arbitrage
        // Por simplicidad, simulamos ganancia
        profit = amounts[0].mul(3).div(1000); // 0.3% profit simulado
        
        return profit;
    }

    /**
     * @dev Ejecuta liquidación
     */
    function _executeLiquidation(LiquidationTarget memory target) external returns (uint256 profit) {
        require(msg.sender == address(this), "MEV: Internal function");
        
        // Aprobar debt token para liquidación
        IERC20(target.debtAsset).safeApprove(target.protocol, target.debtAmount);
        
        // Ejecutar liquidación (implementación específica por protocolo)
        try ILendingProtocol(target.protocol).liquidationCall(
            target.collateralAsset,
            target.debtAsset,
            target.user,
            target.debtAmount,
            false // No recibir aToken
        ) {
            // Calcular ganancia de la liquidación
            uint256 collateralReceived = IERC20(target.collateralAsset).balanceOf(address(this));
            profit = collateralReceived.sub(target.debtAmount.mul(1e18).div(target.liquidationBonus));
            
        } catch {
            profit = 0;
        }
        
        return profit;
    }

    /**
     * @dev Ejecuta transacción del bundle
     */
    function _executeBundleTransaction(
        address target,
        bytes memory calldata_,
        uint256 value
    ) external returns (uint256 profit) {
        require(msg.sender == address(this), "MEV: Internal function");
        
        (bool success, bytes memory result) = target.call{value: value}(calldata_);
        require(success, "MEV: Bundle transaction failed");
        
        // Calcular ganancia de la transacción
        profit = abi.decode(result, (uint256));
        
        return profit;
    }

    /**
     * @dev Ejecuta arbitraje privado
     */
    function _executePrivateArbitrage(
        address[] memory tokens,
        uint256[] memory amounts,
        bytes memory data
    ) external returns (uint256 profit) {
        require(msg.sender == address(this), "MEV: Internal function");
        
        // Lógica de arbitraje privado sin exposición al mempool público
        profit = amounts[0].mul(5).div(1000); // 0.5% profit simulado
        
        return profit;
    }

    /**
     * @dev Verifica si la tx objetivo está en el bloque actual
     */
    function _isTargetTxInCurrentBlock(address target) internal view returns (bool) {
        // Implementación simplificada - en producción verificar logs del bloque
        return true;
    }

    /**
     * @dev Obtiene flash loan para liquidación
     */
    function _getFlashLoanForLiquidation(LiquidationTarget memory target) internal returns (bool) {
        // Implementación simplificada - integrar con proveedores de flash loan
        return IERC20(target.debtAsset).balanceOf(address(this)) >= target.debtAmount;
    }

    /**
     * @dev Envía bundle a Flashbots
     */
    function _submitFlashbotsBundle(BundleParams memory bundle, address relay) internal returns (bool) {
        require(authorizedRelays[relay], "MEV: Unauthorized relay");
        
        try IFlashBotsRelay(relay).submitBundle(
            bundle.targets,
            bundle.calldatas,
            bundle.values,
            bundle.blockNumber,
            bundle.bidAmount
        ) {
            return true;
        } catch {
            return false;
        }
    }

    /**
     * @dev Simula ganancia del bundle
     */
    function _simulateBundleProfit(BundleParams memory bundle) internal view returns (uint256) {
        // Implementación simplificada
        return bundle.bidAmount.mul(110).div(100); // 10% ganancia simulada
    }

    /**
     * @dev Analiza oportunidad de MEV
     */
    function _analyzeMEVOpportunity(address contract_, uint256 blockNumber) 
        internal 
        view 
        returns (MEVOpportunity memory opportunity) 
    {
        // Análisis simplificado de oportunidades
        opportunity = MEVOpportunity({
            mevType: MEVType.BACKRUN_ARBITRAGE,
            targetContract: contract_,
            txData: "",
            estimatedProfit: 1e17, // 0.1 ETH
            gasRequired: 150000,
            competition: 30,
            recommendedPriority: Priority.MEDIUM,
            timeWindow: 5,
            requiresFlashLoan: false,
            riskScore: 25
        });
        
        return opportunity;
    }

    /**
     * @dev Verifica nivel de competencia
     */
    function _checkCompetition(MEVParams memory params) internal view returns (uint256 competitionLevel) {
        // Implementación simplificada - en producción analizar mempool
        return 50; // 50% competencia por defecto
    }

    /**
     * @dev Maneja ganancia de MEV
     */
    function _handleMEVProfit(uint256 profit, bool isPrivate) internal {
        uint256 fee = isPrivate ? 
            profit.mul(mevFee).div(10000) : 
            profit.mul(mevFee.add(flashbotsFee)).div(10000);
            
        uint256 netProfit = profit.sub(fee);
        
        if (fee > 0) {
            payable(feeReceiver).transfer(fee);
        }
    }

    /**
     * @dev Simula liquidación MEV
     */
    function _simulateLiquidationMEV(MEVParams memory params) 
        internal 
        view 
        returns (bool canExecute, uint256 estimatedProfit) 
    {
        LiquidationTarget memory target = abi.decode(params.mevData, (LiquidationTarget));
        
        if (target.healthFactor < 1e18) {
            estimatedProfit = target.estimatedProfit;
            canExecute = estimatedProfit >= params.minProfit;
        }
        
        return (canExecute, estimatedProfit);
    }

    /**
     * @dev Simula backrun arbitrage
     */
    function _simulateBackrunArbitrage(MEVParams memory params) 
        internal 
        view 
        returns (bool canExecute, uint256 estimatedProfit) 
    {
        if (params.tokens.length > 0 && params.amounts.length > 0) {
            estimatedProfit = params.amounts[0].mul(3).div(1000); // 0.3%
            canExecute = estimatedProfit >= params.minProfit;
        }
        
        return (canExecute, estimatedProfit);
    }

    /**
     * @dev Simula bundle arbitrage
     */
    function _simulateBundleArbitrage(MEVParams memory params) 
        internal 
        view 
        returns (bool canExecute, uint256 estimatedProfit) 
    {
        BundleParams memory bundle = abi.decode(params.mevData, (BundleParams));
        
        if (bundle.targets.length > 0 && bundle.targets.length <= maxBundleSize) {
            estimatedProfit = bundle.bidAmount.mul(105).div(100); // 5%
            canExecute = estimatedProfit >= params.minProfit;
        }
        
        return (canExecute, estimatedProfit);
    }

    // ==================== FUNCIONES ADMINISTRATIVAS ====================

    /**
     * @dev Autoriza relay
     */
    function setRelayAuthorization(address relay, bool authorized) external onlyOwner {
        authorizedRelays[relay] = authorized;
    }

    /**
     * @dev Autoriza searcher
     */
    function setSearcherWhitelist(address searcher, bool whitelisted) external onlyOwner {
        whitelistedSearchers[searcher] = whitelisted;
    }

    /**
     * @dev Configura parámetros
     */
    function setParameters(
        uint256 _mevFee,
        uint256 _flashbotsFee,
        uint256 _maxBundleSize,
        uint256 _competitionThreshold,
        address _flashbotsRelay,
        address _mevProtectionContract,
        address _liquidationBot,
        address _feeReceiver
    ) external onlyOwner {
        require(_mevFee <= 1000, "MEV: Fee too high");
        require(_flashbotsFee <= 500, "MEV: Flashbots fee too high");
        
        mevFee = _mevFee;
        flashbotsFee = _flashbotsFee;
        maxBundleSize = _maxBundleSize;
        competitionThreshold = _competitionThreshold;
        flashbotsRelay = _flashbotsRelay;
        mevProtectionContract = _mevProtectionContract;
        liquidationBot = _liquidationBot;
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

    /**
     * @dev Retira ETH de emergencia
     */
    function emergencyWithdrawETH(uint256 amount) external onlyOwner {
        payable(owner()).transfer(amount);
    }

    // ==================== FUNCIONES DE VISTA ====================

    function getMEVOpportunity(bytes32 opportunityId) external view returns (MEVOpportunity memory) {
        return mevOpportunities[opportunityId];
    }

    function isRelayAuthorized(address relay) external view returns (bool) {
        return authorizedRelays[relay];
    }

    function isSearcherWhitelisted(address searcher) external view returns (bool) {
        return whitelistedSearchers[searcher];
    }

    function getLiquidationTargets(address protocol) 
        external 
        view 
        returns (LiquidationTarget[] memory targets) 
    {
        // Implementación simplificada - en producción escanear posiciones liquidables
        targets = new LiquidationTarget[](1);
        
        targets[0] = LiquidationTarget({
            protocol: protocol,
            user: address(0x123),
            collateralAsset: address(0x456),
            debtAsset: address(0x789),
            debtAmount: 1000e18,
            collateralAmount: 1100e18,
            healthFactor: 0.95e18, // Liquidable
            liquidationBonus: 1.05e18, // 5% bonus
            estimatedProfit: 50e18 // 50 tokens profit
        });
        
        return targets;
    }

    // Función para recibir ETH
    receive() external payable {}
}

// ==================== INTERFACES ADICIONALES ====================

interface IFlashBotsRelay {
    function submitBundle(
        address[] calldata targets,
        bytes[] calldata calldatas,
        uint256[] calldata values,
        uint256 blockNumber,
        uint256 bidAmount
    ) external;
}

interface ILendingProtocol {
    function liquidationCall(
        address collateralAsset,
        address debtAsset,
        address user,
        uint256 debtToCover,
        bool receiveAToken
    ) external;
}
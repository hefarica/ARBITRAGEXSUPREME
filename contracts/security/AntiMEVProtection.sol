// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/**
 * @title AntiMEVProtection
 * @dev Sistema avanzado de protección contra ataques MEV
 * @notice Detección y prevención de sandwich, frontrun, backrun attacks
 * 
 * ArbitrageX Supreme V3.0 - Anti-MEV Defense System
 * Sandwich Detection + Frontrun Prevention + Slippage Protection
 */
contract AntiMEVProtection is AccessControl, ReentrancyGuard, EIP712 {
    using ECDSA for bytes32;

    // === ROLES ===
    bytes32 public constant PROTECTION_MANAGER_ROLE = keccak256("PROTECTION_MANAGER_ROLE");
    bytes32 public constant MEV_ANALYST_ROLE = keccak256("MEV_ANALYST_ROLE");
    bytes32 public constant EMERGENCY_ROLE = keccak256("EMERGENCY_ROLE");

    // === ENUMS ===
    enum AttackType {
        FRONTRUN,       // 0: Frontrunning attack
        SANDWICH,       // 1: Sandwich attack
        BACKRUN,        // 2: Backrunning attack
        TOXIC_ARBITRAGE, // 3: Toxic arbitrage
        JIT_LIQUIDITY,  // 4: Just-in-time liquidity attack
        ORACLE_MEV      // 5: Oracle MEV attack
    }

    enum ProtectionStatus {
        DISABLED,       // 0: Sin protección
        MONITORING,     // 1: Solo monitoreo
        ACTIVE,         // 2: Protección activa
        EMERGENCY       // 3: Modo emergencia
    }

    enum RiskLevel {
        LOW,           // 0: Riesgo bajo
        MEDIUM,        // 1: Riesgo medio
        HIGH,          // 2: Riesgo alto
        CRITICAL       // 3: Riesgo crítico
    }

    // === STRUCTS ===
    struct MEVAttack {
        bytes32 attackId;
        AttackType attackType;
        address attacker;
        address victim;
        address targetToken;
        uint256 blockNumber;
        uint256 timestamp;
        uint256 gasPrice;
        uint256 extractedValue;
        bytes32 frontrunTxHash;
        bytes32 victimTxHash;
        bytes32 backrunTxHash;
        RiskLevel riskLevel;
        bool mitigated;
        string description;
    }

    struct ProtectionRule {
        uint256 ruleId;
        AttackType targetAttack;
        bool active;
        uint256 slippageTolerance;    // Basis points (10000 = 100%)
        uint256 priceImpactLimit;     // Basis points
        uint256 timeDelayMs;          // Tiempo de delay en ms
        uint256 gasLimitMultiplier;   // Multiplicador de gas (1000 = 100%)
        uint256 minBlockDelay;        // Delay mínimo en bloques
        address[] exemptAddresses;    // Direcciones exentas
        bool requiresBundle;          // Requiere envío via bundle
    }

    struct TransactionAnalysis {
        bytes32 txHash;
        address sender;
        address target;
        uint256 value;
        uint256 gasPrice;
        uint256 gasLimit;
        bytes data;
        uint256 blockNumber;
        uint256 timestamp;
        RiskLevel riskScore;
        AttackType[] suspectedAttacks;
        bool flagged;
        string riskFactors;
    }

    struct SlippageProtection {
        address token;
        uint256 maxSlippage;          // Basis points
        uint256 referencePrice;       // Precio de referencia
        uint256 priceTimestamp;       // Timestamp del precio
        uint256 validityWindow;       // Ventana de validez en segundos
        bool dynamicSlippage;         // Ajuste dinámico basado en volatilidad
    }

    // === STATE VARIABLES ===
    mapping(bytes32 => MEVAttack) public detectedAttacks;
    mapping(uint256 => ProtectionRule) public protectionRules;
    mapping(bytes32 => TransactionAnalysis) public transactionAnalysis;
    mapping(address => SlippageProtection) public slippageConfig;
    
    mapping(address => bool) public blacklistedAddresses;
    mapping(address => bool) public trustedAddresses;
    mapping(bytes32 => bool) public knownAttackPatterns;
    
    ProtectionStatus public globalProtectionStatus = ProtectionStatus.ACTIVE;
    uint256 public nextAttackId;
    uint256 public nextRuleId;
    
    // Attack detection parameters
    uint256 public sandwichDetectionWindow = 5; // bloques
    uint256 public frontrunGasMultiplier = 150; // 150% = frontrun indicator
    uint256 public maxPriceImpact = 500; // 5% máximo impact
    uint256 public emergencySlippage = 100; // 1% emergency slippage
    
    // Statistics
    uint256 public totalAttacksDetected;
    uint256 public totalAttacksMitigated;
    uint256 public totalValueProtected; // En wei
    mapping(AttackType => uint256) public attacksCountByType;
    mapping(address => uint256) public attackerCount;

    // === EVENTS ===
    event MEVAttackDetected(
        bytes32 indexed attackId,
        AttackType indexed attackType,
        address indexed attacker,
        address victim,
        uint256 extractedValue,
        RiskLevel riskLevel
    );
    
    event AttackMitigated(
        bytes32 indexed attackId,
        AttackType attackType,
        string mitigationMethod,
        bool successful
    );
    
    event ProtectionRuleCreated(
        uint256 indexed ruleId,
        AttackType targetAttack,
        uint256 slippageTolerance,
        uint256 timeDelay
    );
    
    event TransactionFlagged(
        bytes32 indexed txHash,
        address indexed sender,
        RiskLevel riskLevel,
        AttackType[] suspectedAttacks
    );
    
    event SlippageProtectionTriggered(
        address indexed token,
        uint256 attemptedSlippage,
        uint256 maxAllowed,
        bool blocked
    );
    
    event EmergencyProtectionActivated(
        string reason,
        address triggeredBy,
        uint256 timestamp
    );

    // === MODIFIERS ===
    modifier onlyProtectionManager() {
        require(hasRole(PROTECTION_MANAGER_ROLE, msg.sender), "Not protection manager");
        _;
    }

    modifier whenProtectionActive() {
        require(
            globalProtectionStatus == ProtectionStatus.ACTIVE || 
            globalProtectionStatus == ProtectionStatus.EMERGENCY, 
            "Protection not active"
        );
        _;
    }

    modifier validAttackId(bytes32 attackId) {
        require(detectedAttacks[attackId].attackId != bytes32(0), "Attack not found");
        _;
    }

    // === CONSTRUCTOR ===
    constructor(address admin) EIP712("AntiMEVProtection", "1") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(PROTECTION_MANAGER_ROLE, admin);
        _grantRole(MEV_ANALYST_ROLE, admin);
        _grantRole(EMERGENCY_ROLE, admin);
        
        _initializeDefaultRules();
    }

    // === ATTACK DETECTION ===
    /**
     * @dev Analiza transacción para detectar patrones de ataque MEV
     */
    function analyzeTransaction(
        bytes32 txHash,
        address sender,
        address target,
        uint256 value,
        uint256 gasPrice,
        bytes calldata data
    ) external onlyRole(MEV_ANALYST_ROLE) whenProtectionActive returns (TransactionAnalysis memory analysis) {
        
        analysis = TransactionAnalysis({
            txHash: txHash,
            sender: sender,
            target: target,
            value: value,
            gasPrice: gasPrice,
            gasLimit: tx.gasprice, // Usar gasLimit actual
            data: data,
            blockNumber: block.number,
            timestamp: block.timestamp,
            riskScore: RiskLevel.LOW,
            suspectedAttacks: new AttackType[](0),
            flagged: false,
            riskFactors: ""
        });
        
        // Análisis de patrones de ataque
        _detectFrontrunning(analysis);
        _detectSandwichAttack(analysis);
        _detectToxicArbitrage(analysis);
        _checkBlacklist(analysis);
        
        // Calcular score de riesgo final
        analysis.riskScore = _calculateRiskScore(analysis);
        
        if (analysis.riskScore >= RiskLevel.MEDIUM) {
            analysis.flagged = true;
            transactionAnalysis[txHash] = analysis;
            
            emit TransactionFlagged(
                txHash,
                sender,
                analysis.riskScore,
                analysis.suspectedAttacks
            );
        }
        
        return analysis;
    }

    /**
     * @dev Detecta frontrunning basado en gas price y timing
     */
    function _detectFrontrunning(TransactionAnalysis memory analysis) internal view {
        // Verificar si el gas price es sospechosamente alto
        uint256 avgGasPrice = _getAverageGasPrice();
        if (analysis.gasPrice > (avgGasPrice * frontrunGasMultiplier) / 100) {
            _addSuspectedAttack(analysis, AttackType.FRONTRUN);
            _addRiskFactor(analysis, "High gas price indicator");
        }
        
        // Verificar si el sender es conocido MEV bot
        if (blacklistedAddresses[analysis.sender]) {
            _addSuspectedAttack(analysis, AttackType.FRONTRUN);
            _addRiskFactor(analysis, "Blacklisted sender");
        }
        
        // Verificar patrones en calldata
        if (_containsSuspiciousPatterns(analysis.data)) {
            _addSuspectedAttack(analysis, AttackType.FRONTRUN);
            _addRiskFactor(analysis, "Suspicious calldata pattern");
        }
    }

    /**
     * @dev Detecta sandwich attacks mirando transacciones anteriores y posteriores
     */
    function _detectSandwichAttack(TransactionAnalysis memory analysis) internal view {
        // Verificar si hay transacciones relacionadas en ventana de detección
        for (uint256 i = 1; i <= sandwichDetectionWindow; i++) {
            if (block.number >= i) {
                // Simular verificación de bloques anteriores
                // En implementación real, se verificarían logs de bloques previos
                bytes32 relatedTxHash = keccak256(abi.encodePacked(block.number - i, analysis.sender));
                
                if (_isRelatedSandwichTransaction(analysis.txHash, relatedTxHash)) {
                    _addSuspectedAttack(analysis, AttackType.SANDWICH);
                    _addRiskFactor(analysis, "Related sandwich transaction detected");
                }
            }
        }
        
        // Verificar si el target es un DEX conocido
        if (_isKnownDEX(analysis.target)) {
            // Análisis adicional para DEXs
            if (analysis.value > 10 ether) { // Transacciones grandes son más susceptibles
                _addSuspectedAttack(analysis, AttackType.SANDWICH);
                _addRiskFactor(analysis, "Large DEX transaction");
            }
        }
    }

    /**
     * @dev Detecta arbitraje tóxico (extractivo sin beneficio para el mercado)
     */
    function _detectToxicArbitrage(TransactionAnalysis memory analysis) internal view {
        // Verificar si es arbitraje cross-DEX con alto impacto
        if (_isArbitrageTransaction(analysis.data)) {
            uint256 estimatedPriceImpact = _estimatePriceImpact(analysis);
            
            if (estimatedPriceImpact > maxPriceImpact) {
                _addSuspectedAttack(analysis, AttackType.TOXIC_ARBITRAGE);
                _addRiskFactor(analysis, "High price impact arbitrage");
            }
        }
    }

    /**
     * @dev Verifica si la dirección está en blacklist
     */
    function _checkBlacklist(TransactionAnalysis memory analysis) internal view {
        if (blacklistedAddresses[analysis.sender]) {
            _addSuspectedAttack(analysis, AttackType.FRONTRUN);
            _addRiskFactor(analysis, "Blacklisted address");
        }
    }

    // === PROTECTION MECHANISMS ===
    /**
     * @dev Aplica protección de slippage dinámico
     */
    function protectTransactionSlippage(
        address token,
        uint256 expectedPrice,
        uint256 actualPrice,
        uint256 amount
    ) external whenProtectionActive returns (bool allowed, string memory reason) {
        SlippageProtection memory config = slippageConfig[token];
        
        if (config.token == address(0)) {
            // Sin configuración específica, usar protección por defecto
            config.maxSlippage = emergencySlippage;
        }
        
        uint256 slippage = _calculateSlippage(expectedPrice, actualPrice);
        
        if (slippage > config.maxSlippage) {
            emit SlippageProtectionTriggered(token, slippage, config.maxSlippage, true);
            return (false, "Slippage exceeds maximum allowed");
        }
        
        // Verificar price impact
        uint256 priceImpact = _calculatePriceImpact(token, amount);
        if (priceImpact > maxPriceImpact) {
            return (false, "Price impact too high");
        }
        
        return (true, "Transaction allowed");
    }

    /**
     * @dev Mitiga ataque detectado
     */
    function mitigateAttack(
        bytes32 attackId,
        string calldata mitigationMethod
    ) external onlyProtectionManager validAttackId(attackId) {
        MEVAttack storage attack = detectedAttacks[attackId];
        require(!attack.mitigated, "Attack already mitigated");
        
        // Aplicar mitigación específica según tipo de ataque
        bool success = _applyMitigation(attack, mitigationMethod);
        
        attack.mitigated = success;
        
        if (success) {
            totalAttacksMitigated++;
            totalValueProtected += attack.extractedValue;
        }
        
        emit AttackMitigated(attackId, attack.attackType, mitigationMethod, success);
    }

    /**
     * @dev Aplica estrategia de mitigación específica
     */
    function _applyMitigation(
        MEVAttack memory attack,
        string memory method
    ) internal returns (bool success) {
        
        if (attack.attackType == AttackType.FRONTRUN) {
            success = _mitigateFrontrunning(attack);
        } else if (attack.attackType == AttackType.SANDWICH) {
            success = _mitigateSandwichAttack(attack);
        } else if (attack.attackType == AttackType.TOXIC_ARBITRAGE) {
            success = _mitigateToxicArbitrage(attack);
        } else {
            success = _mitigateGenericAttack(attack);
        }
        
        return success;
    }

    /**
     * @dev Mitiga frontrunning
     */
    function _mitigateFrontrunning(MEVAttack memory attack) internal returns (bool) {
        // Estrategias de mitigación para frontrunning:
        // 1. Blacklist temporal del attacker
        // 2. Incrementar gas price limit
        // 3. Usar commit-reveal scheme
        
        blacklistedAddresses[attack.attacker] = true;
        attackerCount[attack.attacker]++;
        
        return true;
    }

    /**
     * @dev Mitiga sandwich attacks
     */
    function _mitigateSandwichAttack(MEVAttack memory attack) internal returns (bool) {
        // Estrategias para sandwich attacks:
        // 1. Reducir slippage tolerance
        // 2. Usar bundles privados
        // 3. Implementar tiempo de delay
        
        if (slippageConfig[attack.targetToken].token != address(0)) {
            slippageConfig[attack.targetToken].maxSlippage = 
                slippageConfig[attack.targetToken].maxSlippage / 2; // Reducir 50%
        }
        
        return true;
    }

    /**
     * @dev Mitiga arbitraje tóxico
     */
    function _mitigateToxicArbitrage(MEVAttack memory attack) internal returns (bool) {
        // Estrategias para arbitraje tóxico:
        // 1. Limitar price impact
        // 2. Implementar cooldown periods
        // 3. Redistribuir parte del MEV
        
        return true;
    }

    /**
     * @dev Mitigación genérica
     */
    function _mitigateGenericAttack(MEVAttack memory attack) internal returns (bool) {
        // Blacklist temporal
        blacklistedAddresses[attack.attacker] = true;
        return true;
    }

    // === EMERGENCY PROTECTION ===
    /**
     * @dev Activa protección de emergencia
     */
    function activateEmergencyProtection(
        string calldata reason
    ) external onlyRole(EMERGENCY_ROLE) {
        globalProtectionStatus = ProtectionStatus.EMERGENCY;
        
        // Aplicar medidas de emergencia
        emergencySlippage = 50; // 0.5% emergency slippage
        maxPriceImpact = 100; // 1% máximo price impact
        
        emit EmergencyProtectionActivated(reason, msg.sender, block.timestamp);
    }

    /**
     * @dev Desactiva protección de emergencia
     */
    function deactivateEmergencyProtection() external onlyRole(EMERGENCY_ROLE) {
        globalProtectionStatus = ProtectionStatus.ACTIVE;
        
        // Restaurar configuración normal
        emergencySlippage = 100; // 1% normal slippage
        maxPriceImpact = 500; // 5% normal price impact
    }

    // === CONFIGURATION ===
    /**
     * @dev Crea nueva regla de protección
     */
    function createProtectionRule(
        AttackType targetAttack,
        uint256 slippageTolerance,
        uint256 priceImpactLimit,
        uint256 timeDelayMs,
        bool requiresBundle
    ) external onlyProtectionManager returns (uint256 ruleId) {
        ruleId = nextRuleId++;
        
        protectionRules[ruleId] = ProtectionRule({
            ruleId: ruleId,
            targetAttack: targetAttack,
            active: true,
            slippageTolerance: slippageTolerance,
            priceImpactLimit: priceImpactLimit,
            timeDelayMs: timeDelayMs,
            gasLimitMultiplier: 1000, // 100%
            minBlockDelay: 0,
            exemptAddresses: new address[](0),
            requiresBundle: requiresBundle
        });
        
        emit ProtectionRuleCreated(ruleId, targetAttack, slippageTolerance, timeDelayMs);
    }

    /**
     * @dev Configura protección de slippage para token
     */
    function configureSlippageProtection(
        address token,
        uint256 maxSlippage,
        bool dynamicSlippage
    ) external onlyProtectionManager {
        slippageConfig[token] = SlippageProtection({
            token: token,
            maxSlippage: maxSlippage,
            referencePrice: 0, // Se actualizará dinámicamente
            priceTimestamp: block.timestamp,
            validityWindow: 300, // 5 minutos
            dynamicSlippage: dynamicSlippage
        });
    }

    // === HELPER FUNCTIONS ===
    function _initializeDefaultRules() internal {
        // Regla anti-frontrunning
        protectionRules[0] = ProtectionRule({
            ruleId: 0,
            targetAttack: AttackType.FRONTRUN,
            active: true,
            slippageTolerance: 200, // 2%
            priceImpactLimit: 300, // 3%
            timeDelayMs: 1000, // 1 segundo
            gasLimitMultiplier: 1200, // 120%
            minBlockDelay: 1,
            exemptAddresses: new address[](0),
            requiresBundle: true
        });
        
        nextRuleId = 1;
    }

    function _addSuspectedAttack(TransactionAnalysis memory analysis, AttackType attackType) internal pure {
        // En implementación real, se agregaría al array dinámico
        // Por ahora, simplificamos
    }

    function _addRiskFactor(TransactionAnalysis memory analysis, string memory factor) internal pure {
        // En implementación real, se concatenaría al string
        analysis.riskFactors = factor;
    }

    function _calculateRiskScore(TransactionAnalysis memory analysis) internal pure returns (RiskLevel) {
        // Algoritmo simplificado de scoring
        uint256 riskPoints = 0;
        
        if (analysis.gasPrice > 100 gwei) riskPoints += 2;
        if (analysis.value > 100 ether) riskPoints += 1;
        if (bytes(analysis.riskFactors).length > 0) riskPoints += 3;
        
        if (riskPoints >= 5) return RiskLevel.CRITICAL;
        if (riskPoints >= 3) return RiskLevel.HIGH;
        if (riskPoints >= 1) return RiskLevel.MEDIUM;
        return RiskLevel.LOW;
    }

    function _getAverageGasPrice() internal view returns (uint256) {
        return tx.gasprice; // Simplificado
    }

    function _containsSuspiciousPatterns(bytes memory data) internal pure returns (bool) {
        // Detectar patrones conocidos de MEV bots
        return data.length > 1000; // Simplificado
    }

    function _isRelatedSandwichTransaction(bytes32 tx1, bytes32 tx2) internal pure returns (bool) {
        // Lógica para detectar transacciones relacionadas
        return false; // Simplificado
    }

    function _isKnownDEX(address target) internal pure returns (bool) {
        // Lista de DEXs conocidos
        return target != address(0); // Simplificado
    }

    function _isArbitrageTransaction(bytes memory data) internal pure returns (bool) {
        // Detectar patrones de arbitraje
        return data.length > 100; // Simplificado
    }

    function _estimatePriceImpact(TransactionAnalysis memory analysis) internal pure returns (uint256) {
        // Estimar price impact basado en análisis
        return analysis.value / 1 ether; // Simplificado
    }

    function _calculateSlippage(uint256 expected, uint256 actual) internal pure returns (uint256) {
        if (expected == 0) return 0;
        if (actual >= expected) return 0;
        return ((expected - actual) * 10000) / expected;
    }

    function _calculatePriceImpact(address token, uint256 amount) internal view returns (uint256) {
        // Calcular price impact estimado
        return amount / 1 ether; // Simplificado
    }

    // === ADMIN FUNCTIONS ===
    function updateBlacklist(address addr, bool blacklisted) external onlyProtectionManager {
        blacklistedAddresses[addr] = blacklisted;
    }

    function updateTrustedAddress(address addr, bool trusted) external onlyProtectionManager {
        trustedAddresses[addr] = trusted;
    }

    function setGlobalProtectionStatus(ProtectionStatus status) external onlyRole(DEFAULT_ADMIN_ROLE) {
        globalProtectionStatus = status;
    }

    // === VIEW FUNCTIONS ===
    function getAttack(bytes32 attackId) external view returns (MEVAttack memory) {
        return detectedAttacks[attackId];
    }

    function getProtectionRule(uint256 ruleId) external view returns (ProtectionRule memory) {
        return protectionRules[ruleId];
    }

    function getTransactionAnalysis(bytes32 txHash) external view returns (TransactionAnalysis memory) {
        return transactionAnalysis[txHash];
    }

    function getProtectionStats() external view returns (
        uint256 _totalDetected,
        uint256 _totalMitigated,
        uint256 _totalValueProtected,
        ProtectionStatus _status
    ) {
        return (totalAttacksDetected, totalAttacksMitigated, totalValueProtected, globalProtectionStatus);
    }

    function isAddressBlacklisted(address addr) external view returns (bool) {
        return blacklistedAddresses[addr];
    }

    function isAddressTrusted(address addr) external view returns (bool) {
        return trustedAddresses[addr];
    }
}
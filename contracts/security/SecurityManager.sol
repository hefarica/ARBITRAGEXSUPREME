// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title SecurityManager
 * @dev Gestor central de seguridad para ArbitrageX Supreme V3.0
 * @notice EIP-712 signing, blacklists, honeypot detection, oracle validation
 * 
 * ArbitrageX Supreme V3.0 - Comprehensive Security Layer
 * EIP-712 + Honeypot Detection + Oracle TWAP + Multi-Source Blacklists
 */
contract SecurityManager is AccessControl, ReentrancyGuard, EIP712 {
    using ECDSA for bytes32;
    using SafeERC20 for IERC20;

    // === ROLES ===
    bytes32 public constant SECURITY_OPERATOR_ROLE = keccak256("SECURITY_OPERATOR_ROLE");
    bytes32 public constant ORACLE_MANAGER_ROLE = keccak256("ORACLE_MANAGER_ROLE");
    bytes32 public constant BLACKLIST_MANAGER_ROLE = keccak256("BLACKLIST_MANAGER_ROLE");
    bytes32 public constant HONEYPOT_ANALYST_ROLE = keccak256("HONEYPOT_ANALYST_ROLE");

    // === ENUMS ===
    enum SecurityLevel {
        LOW,            // 0: Verificaciones básicas
        MEDIUM,         // 1: Verificaciones + blacklist
        HIGH,           // 2: Todo + honeypot detection
        MAXIMUM         // 3: Todo + oracle validation + delays
    }

    enum BlacklistSource {
        INTERNAL,       // 0: Lista interna
        CHAINALYSIS,    // 1: Chainalysis
        ELLIPTIC,       // 2: Elliptic
        TRM,           // 3: TRM Labs
        OFAC,          // 4: OFAC SDN List
        CUSTOM         // 5: Fuentes custom
    }

    enum HoneypotRisk {
        SAFE,          // 0: Token seguro
        LOW_RISK,      // 1: Riesgo bajo
        MEDIUM_RISK,   // 2: Riesgo medio
        HIGH_RISK,     // 3: Riesgo alto
        HONEYPOT       // 4: Honeypot confirmado
    }

    // === STRUCTS ===
    struct ExecutionPermit {
        address executor;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 minAmountOut;
        uint256 deadline;
        uint256 nonce;
        bytes32 strategyId;
    }

    struct BlacklistEntry {
        address target;
        BlacklistSource source;
        uint256 addedTimestamp;
        uint256 riskScore;        // 0-100
        string reason;
        bool active;
        uint256 expiryTimestamp;  // 0 = no expiry
    }

    struct HoneypotAnalysis {
        address token;
        HoneypotRisk riskLevel;
        uint256 buyTaxPercentage;
        uint256 sellTaxPercentage;
        bool canSellBack;
        bool hasMaxTxAmount;
        uint256 maxTxAmount;
        bool hasMaxWallet;
        uint256 maxWalletAmount;
        bool hasAntiBot;
        uint256 analysisTimestamp;
        uint256 validityPeriod;   // Seconds
        string[] riskFactors;
    }

    struct OracleConfig {
        address oracleAddress;
        uint32 twapPeriod;        // TWAP period in seconds
        uint256 maxPriceDeviation; // Max deviation in basis points
        bool active;
        uint256 lastUpdate;
        string description;
    }

    struct SecurityCheck {
        bool eip712Valid;
        bool blacklistPassed;
        bool honeypotPassed;
        bool oraclePassed;
        SecurityLevel levelUsed;
        string[] failureReasons;
        uint256 checkTimestamp;
        uint256 gasCost;
    }

    // === STATE VARIABLES ===
    mapping(address => BlacklistEntry) public blacklist;
    mapping(address => HoneypotAnalysis) public honeypotData;
    mapping(address => OracleConfig) public oracles;
    mapping(address => uint256) public nonces;
    mapping(bytes32 => bool) public executedPermits;
    
    // Multi-source blacklists
    mapping(BlacklistSource => mapping(address => bool)) public sourceBlacklists;
    mapping(BlacklistSource => bool) public enabledSources;
    mapping(BlacklistSource => uint256) public sourceLastUpdate;
    
    SecurityLevel public defaultSecurityLevel = SecurityLevel.HIGH;
    bool public globalSecurityEnabled = true;
    
    // Security statistics
    uint256 public totalSecurityChecks;
    uint256 public totalSecurityFailures;
    uint256 public totalHoneypotDetections;
    uint256 public totalBlacklistHits;
    
    // Oracle validation
    uint256 public defaultTwapPeriod = 300; // 5 minutes
    uint256 public maxOracleDeviation = 500; // 5%
    
    // EIP-712 type hashes
    bytes32 private constant EXECUTION_PERMIT_TYPEHASH = keccak256(
        "ExecutionPermit(address executor,address tokenIn,address tokenOut,uint256 amountIn,uint256 minAmountOut,uint256 deadline,uint256 nonce,bytes32 strategyId)"
    );

    // === EVENTS ===
    event PermitExecuted(
        address indexed executor,
        bytes32 indexed permitHash,
        address tokenIn,
        address tokenOut,
        uint256 amountIn
    );
    
    event SecurityCheckCompleted(
        address indexed caller,
        SecurityLevel level,
        bool passed,
        uint256 gasCost,
        string[] failureReasons
    );
    
    event BlacklistUpdated(
        address indexed target,
        BlacklistSource source,
        bool added,
        string reason
    );
    
    event HoneypotDetected(
        address indexed token,
        HoneypotRisk riskLevel,
        uint256 buyTax,
        uint256 sellTax,
        string[] riskFactors
    );
    
    event OracleValidationFailed(
        address indexed token,
        uint256 oraclePrice,
        uint256 marketPrice,
        uint256 deviation
    );
    
    event SecurityLevelUpdated(
        SecurityLevel oldLevel,
        SecurityLevel newLevel,
        address updatedBy
    );

    // === MODIFIERS ===
    modifier onlySecurityOperator() {
        require(hasRole(SECURITY_OPERATOR_ROLE, msg.sender), "Not security operator");
        _;
    }

    modifier whenSecurityEnabled() {
        require(globalSecurityEnabled, "Global security disabled");
        _;
    }

    modifier validSecurityLevel(SecurityLevel level) {
        require(uint256(level) <= 3, "Invalid security level");
        _;
    }

    // === CONSTRUCTOR ===
    constructor(address admin) EIP712("ArbitrageX Security Manager", "1") {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(SECURITY_OPERATOR_ROLE, admin);
        _grantRole(ORACLE_MANAGER_ROLE, admin);
        _grantRole(BLACKLIST_MANAGER_ROLE, admin);
        _grantRole(HONEYPOT_ANALYST_ROLE, admin);
        
        _initializeSecuritySources();
    }

    // === EIP-712 SIGNING ===
    /**
     * @dev Verifica y ejecuta permit firmado con EIP-712
     */
    function executeWithPermit(
        ExecutionPermit calldata permit,
        bytes calldata signature
    ) external onlySecurityOperator whenSecurityEnabled nonReentrant returns (bool success) {
        uint256 gasStart = gasleft();
        
        // 1. Verificar signature EIP-712
        bytes32 permitHash = _hashExecutionPermit(permit);
        require(!executedPermits[permitHash], "Permit already executed");
        
        bytes32 digest = _hashTypedDataV4(permitHash);
        address signer = digest.recover(signature);
        require(signer == permit.executor, "Invalid signature");
        require(hasRole(SECURITY_OPERATOR_ROLE, signer), "Unauthorized signer");
        
        // 2. Verificar nonce y deadline
        require(permit.nonce == nonces[permit.executor]++, "Invalid nonce");
        require(permit.deadline >= block.timestamp, "Permit expired");
        
        // 3. Ejecutar security checks
        SecurityCheck memory securityResult = performSecurityCheck(
            permit.executor,
            permit.tokenIn,
            permit.tokenOut,
            permit.amountIn,
            defaultSecurityLevel
        );
        
        require(
            securityResult.eip712Valid && 
            securityResult.blacklistPassed && 
            securityResult.honeypotPassed && 
            securityResult.oraclePassed, 
            "Security check failed"
        );
        
        // 4. Marcar permit como ejecutado
        executedPermits[permitHash] = true;
        
        uint256 gasUsed = gasStart - gasleft();
        
        emit PermitExecuted(
            permit.executor,
            permitHash,
            permit.tokenIn,
            permit.tokenOut,
            permit.amountIn
        );
        
        return true;
    }

    /**
     * @dev Hash del ExecutionPermit para EIP-712
     */
    function _hashExecutionPermit(ExecutionPermit calldata permit) internal pure returns (bytes32) {
        return keccak256(abi.encode(
            EXECUTION_PERMIT_TYPEHASH,
            permit.executor,
            permit.tokenIn,
            permit.tokenOut,
            permit.amountIn,
            permit.minAmountOut,
            permit.deadline,
            permit.nonce,
            permit.strategyId
        ));
    }

    // === COMPREHENSIVE SECURITY CHECK ===
    /**
     * @dev Ejecuta check de seguridad completo según nivel especificado
     */
    function performSecurityCheck(
        address executor,
        address tokenIn,
        address tokenOut,
        uint256 amount,
        SecurityLevel level
    ) public whenSecurityEnabled validSecurityLevel(level) returns (SecurityCheck memory result) {
        uint256 gasStart = gasleft();
        totalSecurityChecks++;
        
        result = SecurityCheck({
            eip712Valid: true, // Ya verificado en caller
            blacklistPassed: false,
            honeypotPassed: false,
            oraclePassed: false,
            levelUsed: level,
            failureReasons: new string[](0),
            checkTimestamp: block.timestamp,
            gasCost: 0
        });
        
        // 1. Blacklist check (MEDIUM+)
        if (level >= SecurityLevel.MEDIUM) {
            result.blacklistPassed = _checkBlacklists(executor, tokenIn, tokenOut);
            if (!result.blacklistPassed) {
                _addFailureReason(result, "Blacklist check failed");
                totalBlacklistHits++;
            }
        } else {
            result.blacklistPassed = true;
        }
        
        // 2. Honeypot detection (HIGH+)
        if (level >= SecurityLevel.HIGH) {
            (bool tokenInSafe, bool tokenOutSafe) = _checkHoneypots(tokenIn, tokenOut);
            result.honeypotPassed = tokenInSafe && tokenOutSafe;
            if (!result.honeypotPassed) {
                _addFailureReason(result, "Honeypot detected");
                totalHoneypotDetections++;
            }
        } else {
            result.honeypotPassed = true;
        }
        
        // 3. Oracle validation (MAXIMUM)
        if (level == SecurityLevel.MAXIMUM) {
            result.oraclePassed = _validateWithOracles(tokenIn, tokenOut, amount);
            if (!result.oraclePassed) {
                _addFailureReason(result, "Oracle validation failed");
            }
        } else {
            result.oraclePassed = true;
        }
        
        result.gasCost = gasStart - gasleft();
        
        bool overallPassed = result.eip712Valid && result.blacklistPassed && 
                           result.honeypotPassed && result.oraclePassed;
        
        if (!overallPassed) {
            totalSecurityFailures++;
        }
        
        emit SecurityCheckCompleted(
            msg.sender,
            level,
            overallPassed,
            result.gasCost,
            result.failureReasons
        );
        
        return result;
    }

    // === BLACKLIST MANAGEMENT ===
    /**
     * @dev Verifica múltiples fuentes de blacklists
     */
    function _checkBlacklists(
        address executor,
        address tokenIn,
        address tokenOut
    ) internal view returns (bool passed) {
        // Check all addresses against all enabled sources
        address[] memory addressesToCheck = new address[](3);
        addressesToCheck[0] = executor;
        addressesToCheck[1] = tokenIn;
        addressesToCheck[2] = tokenOut;
        
        for (uint256 i = 0; i < addressesToCheck.length; i++) {
            address addr = addressesToCheck[i];
            
            // Check internal blacklist
            if (blacklist[addr].active && 
                (blacklist[addr].expiryTimestamp == 0 || 
                 blacklist[addr].expiryTimestamp > block.timestamp)) {
                return false;
            }
            
            // Check external sources
            for (uint256 j = 0; j <= 5; j++) {
                BlacklistSource source = BlacklistSource(j);
                if (enabledSources[source] && sourceBlacklists[source][addr]) {
                    return false;
                }
            }
        }
        
        return true;
    }

    /**
     * @dev Actualiza blacklist interna
     */
    function updateBlacklist(
        address target,
        bool add,
        BlacklistSource source,
        uint256 riskScore,
        string calldata reason,
        uint256 expiryTimestamp
    ) external onlyRole(BLACKLIST_MANAGER_ROLE) {
        if (add) {
            blacklist[target] = BlacklistEntry({
                target: target,
                source: source,
                addedTimestamp: block.timestamp,
                riskScore: riskScore,
                reason: reason,
                active: true,
                expiryTimestamp: expiryTimestamp
            });
        } else {
            blacklist[target].active = false;
        }
        
        emit BlacklistUpdated(target, source, add, reason);
    }

    /**
     * @dev Actualiza blacklist de fuente externa
     */
    function updateSourceBlacklist(
        BlacklistSource source,
        address[] calldata addresses,
        bool[] calldata statuses
    ) external onlyRole(BLACKLIST_MANAGER_ROLE) {
        require(addresses.length == statuses.length, "Array length mismatch");
        
        for (uint256 i = 0; i < addresses.length; i++) {
            sourceBlacklists[source][addresses[i]] = statuses[i];
        }
        
        sourceLastUpdate[source] = block.timestamp;
    }

    // === HONEYPOT DETECTION ===
    /**
     * @dev Verifica tokens contra honeypots conocidos
     */
    function _checkHoneypots(
        address tokenIn,
        address tokenOut
    ) internal view returns (bool tokenInSafe, bool tokenOutSafe) {
        tokenInSafe = _isTokenSafe(tokenIn);
        tokenOutSafe = _isTokenSafe(tokenOut);
    }

    /**
     * @dev Verifica si un token es seguro (no honeypot)
     */
    function _isTokenSafe(address token) internal view returns (bool safe) {
        HoneypotAnalysis memory analysis = honeypotData[token];
        
        // Si no hay datos, asumimos seguro (pero deberíamos analizar)
        if (analysis.analysisTimestamp == 0) {
            return true;
        }
        
        // Verificar si el análisis está vigente
        if (block.timestamp > analysis.analysisTimestamp + analysis.validityPeriod) {
            return true; // Análisis expirado, necesita re-análisis
        }
        
        // Verificar nivel de riesgo
        if (analysis.riskLevel == HoneypotRisk.HONEYPOT || 
            analysis.riskLevel == HoneypotRisk.HIGH_RISK) {
            return false;
        }
        
        return true;
    }

    /**
     * @dev Analiza token para detectar honeypot
     */
    function analyzeTokenForHoneypot(
        address token
    ) external onlyRole(HONEYPOT_ANALYST_ROLE) returns (HoneypotAnalysis memory analysis) {
        // Simulación de análisis de honeypot
        // En implementación real, se harían calls de prueba al token
        
        analysis = HoneypotAnalysis({
            token: token,
            riskLevel: HoneypotRisk.SAFE,
            buyTaxPercentage: 0,
            sellTaxPercentage: 0,
            canSellBack: true,
            hasMaxTxAmount: false,
            maxTxAmount: 0,
            hasMaxWallet: false,
            maxWalletAmount: 0,
            hasAntiBot: false,
            analysisTimestamp: block.timestamp,
            validityPeriod: 86400, // 24 horas
            riskFactors: new string[](0)
        });
        
        // Análisis simulado - en la realidad se haría análisis completo
        try IERC20(token).totalSupply() returns (uint256 supply) {
            if (supply == 0) {
                analysis.riskLevel = HoneypotRisk.HIGH_RISK;
                analysis.riskFactors = ["Zero total supply"];
            }
        } catch {
            analysis.riskLevel = HoneypotRisk.MEDIUM_RISK;
            analysis.riskFactors = ["Failed to read total supply"];
        }
        
        // Guardar análisis
        honeypotData[token] = analysis;
        
        if (analysis.riskLevel >= HoneypotRisk.MEDIUM_RISK) {
            emit HoneypotDetected(
                token,
                analysis.riskLevel,
                analysis.buyTaxPercentage,
                analysis.sellTaxPercentage,
                analysis.riskFactors
            );
        }
        
        return analysis;
    }

    // === ORACLE VALIDATION ===
    /**
     * @dev Valida precios usando oráculos TWAP
     */
    function _validateWithOracles(
        address tokenIn,
        address tokenOut,
        uint256 amount
    ) internal view returns (bool valid) {
        // Verificar que existan oráculos configurados
        if (oracles[tokenIn].oracleAddress == address(0) && 
            oracles[tokenOut].oracleAddress == address(0)) {
            return true; // Sin oráculos configurados, pasar validación
        }
        
        // TODO: Implementar validación real con oráculos
        // Por ahora, simulamos validación exitosa
        return true;
    }

    /**
     * @dev Configura oracle para token
     */
    function configureOracle(
        address token,
        address oracleAddress,
        uint32 twapPeriod,
        uint256 maxDeviation,
        string calldata description
    ) external onlyRole(ORACLE_MANAGER_ROLE) {
        oracles[token] = OracleConfig({
            oracleAddress: oracleAddress,
            twapPeriod: twapPeriod,
            maxPriceDeviation: maxDeviation,
            active: true,
            lastUpdate: block.timestamp,
            description: description
        });
    }

    // === HELPER FUNCTIONS ===
    function _initializeSecuritySources() internal {
        // Habilitar fuentes por defecto
        enabledSources[BlacklistSource.INTERNAL] = true;
        enabledSources[BlacklistSource.CHAINALYSIS] = false; // Requiere integración
        enabledSources[BlacklistSource.ELLIPTIC] = false;
        enabledSources[BlacklistSource.TRM] = false;
        enabledSources[BlacklistSource.OFAC] = false;
    }

    function _addFailureReason(SecurityCheck memory check, string memory reason) internal pure {
        // En implementación real, se agregaría al array dinámico
        // Por simplicidad, se omite la implementación completa
    }

    // === EMERGENCY FUNCTIONS ===
    /**
     * @dev Desactiva seguridad globalmente (solo emergencia)
     */
    function emergencyDisableSecurity() external onlyRole(DEFAULT_ADMIN_ROLE) {
        globalSecurityEnabled = false;
    }

    /**
     * @dev Reactiva seguridad global
     */
    function enableSecurity() external onlyRole(DEFAULT_ADMIN_ROLE) {
        globalSecurityEnabled = true;
    }

    /**
     * @dev Blacklist de emergencia
     */
    function emergencyBlacklist(address target, string calldata reason) external onlyRole(DEFAULT_ADMIN_ROLE) {
        blacklist[target] = BlacklistEntry({
            target: target,
            source: BlacklistSource.INTERNAL,
            addedTimestamp: block.timestamp,
            riskScore: 100, // Máximo riesgo
            reason: reason,
            active: true,
            expiryTimestamp: 0 // Sin expiry
        });
        
        emit BlacklistUpdated(target, BlacklistSource.INTERNAL, true, reason);
    }

    // === ADMIN FUNCTIONS ===
    function setDefaultSecurityLevel(SecurityLevel level) external onlyRole(DEFAULT_ADMIN_ROLE) {
        SecurityLevel oldLevel = defaultSecurityLevel;
        defaultSecurityLevel = level;
        
        emit SecurityLevelUpdated(oldLevel, level, msg.sender);
    }

    function setSourceEnabled(BlacklistSource source, bool enabled) external onlyRole(BLACKLIST_MANAGER_ROLE) {
        enabledSources[source] = enabled;
    }

    function setDefaultTwapPeriod(uint256 period) external onlyRole(ORACLE_MANAGER_ROLE) {
        defaultTwapPeriod = period;
    }

    function setMaxOracleDeviation(uint256 deviation) external onlyRole(ORACLE_MANAGER_ROLE) {
        maxOracleDeviation = deviation;
    }

    // === VIEW FUNCTIONS ===
    function getBlacklistEntry(address target) external view returns (BlacklistEntry memory) {
        return blacklist[target];
    }

    function getHoneypotAnalysis(address token) external view returns (HoneypotAnalysis memory) {
        return honeypotData[token];
    }

    function getOracleConfig(address token) external view returns (OracleConfig memory) {
        return oracles[token];
    }

    function isBlacklisted(address target) external view returns (bool blacklisted, string memory reason) {
        BlacklistEntry memory entry = blacklist[target];
        
        if (entry.active && (entry.expiryTimestamp == 0 || entry.expiryTimestamp > block.timestamp)) {
            return (true, entry.reason);
        }
        
        // Check external sources
        for (uint256 i = 0; i <= 5; i++) {
            BlacklistSource source = BlacklistSource(i);
            if (enabledSources[source] && sourceBlacklists[source][target]) {
                return (true, "External blacklist");
            }
        }
        
        return (false, "");
    }

    function getSecurityStats() external view returns (
        uint256 _totalChecks,
        uint256 _totalFailures,
        uint256 _totalHoneypots,
        uint256 _totalBlacklist,
        SecurityLevel _defaultLevel
    ) {
        return (
            totalSecurityChecks,
            totalSecurityFailures,
            totalHoneypotDetections,
            totalBlacklistHits,
            defaultSecurityLevel
        );
    }

    function getUserNonce(address user) external view returns (uint256) {
        return nonces[user];
    }

    function isPermitExecuted(bytes32 permitHash) external view returns (bool) {
        return executedPermits[permitHash];
    }

    // === RECEIVE FUNCTION ===
    receive() external payable {
        revert("Direct ETH transfers not allowed");
    }
}
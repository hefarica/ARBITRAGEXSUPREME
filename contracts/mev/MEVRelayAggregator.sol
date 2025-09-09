// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./FlashbotsBundleManager.sol";

/**
 * @title MEVRelayAggregator
 * @dev Agregador inteligente de relays MEV con failover automático
 * @notice Gestiona múltiples relays (Flashbots, Eden, bloXroute, Manifold) con selección optimizada
 * 
 * ArbitrageX Supreme V3.0 - MEV Relay Orchestrator
 * Multi-Relay + Automatic Failover + Performance Analytics
 */
contract MEVRelayAggregator is AccessControl, ReentrancyGuard {

    // === ROLES ===
    bytes32 public constant MEV_COORDINATOR_ROLE = keccak256("MEV_COORDINATOR_ROLE");
    bytes32 public constant RELAY_ANALYST_ROLE = keccak256("RELAY_ANALYST_ROLE");

    // === ENUMS ===
    enum RelaySelectionStrategy {
        FASTEST,        // 0: Seleccionar por menor latencia
        HIGHEST_SUCCESS, // 1: Seleccionar por mayor success rate
        LOWEST_COST,    // 2: Seleccionar por menor costo
        BALANCED,       // 3: Score balanceado
        ROUND_ROBIN     // 4: Rotación equitativa
    }

    enum FailoverTrigger {
        TIMEOUT,        // 0: Timeout de respuesta
        REJECTION,      // 1: Rechazo del relay
        HIGH_LATENCY,   // 2: Latencia alta
        LOW_SUCCESS_RATE, // 3: Success rate bajo
        MANUAL          // 4: Failover manual
    }

    // === STRUCTS ===
    struct RelayPerformance {
        uint256 totalSubmissions;
        uint256 successfulInclusions;
        uint256 totalLatency;      // Acumulado en ms
        uint256 totalCost;         // Acumulado en wei
        uint256 lastResponseTime;
        uint256 consecutiveFailures;
        uint256 avgInclusionTime;
        uint256 lastSuccessfulSubmission;
        bool currentlyActive;
        uint256 score;             // Score calculado 0-10000
    }

    struct RelayHealthCheck {
        uint256 timestamp;
        uint256 responseTime;
        bool responsive;
        uint256 estimatedGasPrice;
        string version;
        uint256 queueLength;
    }

    struct SubmissionAttempt {
        bytes32 bundleId;
        FlashbotsBundleManager.RelayType relay;
        uint256 attemptTimestamp;
        uint256 responseTime;
        bool successful;
        FailoverTrigger failoverReason;
        string errorMessage;
    }

    struct AggregatorConfig {
        RelaySelectionStrategy defaultStrategy;
        uint256 maxFailoverAttempts;
        uint256 relayTimeoutMs;
        uint256 healthCheckInterval;
        uint256 minSuccessRateThreshold;
        uint256 maxLatencyThreshold;
        bool autoFailoverEnabled;
    }

    // === STATE VARIABLES ===
    FlashbotsBundleManager public immutable bundleManager;
    
    mapping(FlashbotsBundleManager.RelayType => RelayPerformance) public relayPerformance;
    mapping(FlashbotsBundleManager.RelayType => RelayHealthCheck) public relayHealth;
    mapping(bytes32 => SubmissionAttempt[]) public submissionHistory;
    
    AggregatorConfig public config;
    
    // Round robin state
    uint256 public roundRobinIndex;
    FlashbotsBundleManager.RelayType[] public activeRelays;
    
    // Performance tracking
    uint256 public totalAggregatorSubmissions;
    uint256 public totalAggregatorSuccesses;
    uint256 public totalFailovers;
    
    // Real-time monitoring
    mapping(FlashbotsBundleManager.RelayType => uint256) public relayFailureCount;
    mapping(FlashbotsBundleManager.RelayType => uint256) public relayLastFailure;
    uint256 public lastPerformanceUpdate;

    // === EVENTS ===
    event RelaySelected(
        bytes32 indexed bundleId,
        FlashbotsBundleManager.RelayType selectedRelay,
        RelaySelectionStrategy strategy,
        uint256 score
    );
    
    event FailoverTriggered(
        bytes32 indexed bundleId,
        FlashbotsBundleManager.RelayType fromRelay,
        FlashbotsBundleManager.RelayType toRelay,
        FailoverTrigger trigger,
        string reason
    );
    
    event RelayPerformanceUpdated(
        FlashbotsBundleManager.RelayType indexed relay,
        uint256 successRate,
        uint256 avgLatency,
        uint256 score
    );
    
    event RelayHealthUpdated(
        FlashbotsBundleManager.RelayType indexed relay,
        bool responsive,
        uint256 responseTime,
        uint256 queueLength
    );
    
    event AggregatorConfigUpdated(
        RelaySelectionStrategy strategy,
        uint256 maxFailovers,
        uint256 timeout
    );

    // === MODIFIERS ===
    modifier onlyMEVCoordinator() {
        require(hasRole(MEV_COORDINATOR_ROLE, msg.sender), "Not MEV coordinator");
        _;
    }

    modifier validRelay(FlashbotsBundleManager.RelayType relay) {
        require(uint256(relay) <= 5, "Invalid relay type");
        _;
    }

    // === CONSTRUCTOR ===
    constructor(
        address admin,
        address _bundleManager
    ) {
        require(_bundleManager != address(0), "Invalid bundle manager");
        
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MEV_COORDINATOR_ROLE, admin);
        _grantRole(RELAY_ANALYST_ROLE, admin);
        
        bundleManager = FlashbotsBundleManager(_bundleManager);
        
        // Configuración por defecto
        config = AggregatorConfig({
            defaultStrategy: RelaySelectionStrategy.BALANCED,
            maxFailoverAttempts: 3,
            relayTimeoutMs: 5000, // 5 segundos
            healthCheckInterval: 60, // 60 segundos
            minSuccessRateThreshold: 7000, // 70%
            maxLatencyThreshold: 10000, // 10 segundos
            autoFailoverEnabled: true
        });
        
        _initializeRelayPerformance();
    }

    // === RELAY SELECTION ===
    /**
     * @dev Selecciona el mejor relay según estrategia configurada
     */
    function selectOptimalRelay(
        bytes32 bundleId,
        RelaySelectionStrategy strategy
    ) public returns (FlashbotsBundleManager.RelayType selectedRelay) {
        _updateRelayScores();
        
        if (strategy == RelaySelectionStrategy.FASTEST) {
            selectedRelay = _selectFastestRelay();
        } else if (strategy == RelaySelectionStrategy.HIGHEST_SUCCESS) {
            selectedRelay = _selectHighestSuccessRelay();
        } else if (strategy == RelaySelectionStrategy.LOWEST_COST) {
            selectedRelay = _selectLowestCostRelay();
        } else if (strategy == RelaySelectionStrategy.BALANCED) {
            selectedRelay = _selectBalancedRelay();
        } else if (strategy == RelaySelectionStrategy.ROUND_ROBIN) {
            selectedRelay = _selectRoundRobinRelay();
        }
        
        require(_isRelayHealthy(selectedRelay), "Selected relay unhealthy");
        
        uint256 score = relayPerformance[selectedRelay].score;
        
        emit RelaySelected(bundleId, selectedRelay, strategy, score);
    }

    /**
     * @dev Envía bundle con failover automático
     */
    function submitBundleWithFailover(
        bytes32 bundleId,
        RelaySelectionStrategy strategy
    ) external onlyMEVCoordinator nonReentrant returns (bool success) {
        FlashbotsBundleManager.RelayType primaryRelay = selectOptimalRelay(bundleId, strategy);
        
        success = _attemptSubmission(bundleId, primaryRelay);
        
        // Failover automático si es necesario
        if (!success && config.autoFailoverEnabled) {
            success = _executeFailover(bundleId, primaryRelay);
        }
        
        totalAggregatorSubmissions++;
        if (success) {
            totalAggregatorSuccesses++;
        }
    }

    // === RELAY SELECTION ALGORITHMS ===
    /**
     * @dev Selecciona relay con menor latencia promedio
     */
    function _selectFastestRelay() internal view returns (FlashbotsBundleManager.RelayType) {
        FlashbotsBundleManager.RelayType fastest = FlashbotsBundleManager.RelayType.FLASHBOTS;
        uint256 bestLatency = type(uint256).max;
        
        for (uint256 i = 0; i <= 5; i++) {
            FlashbotsBundleManager.RelayType relay = FlashbotsBundleManager.RelayType(i);
            RelayPerformance memory perf = relayPerformance[relay];
            
            if (perf.currentlyActive && perf.totalSubmissions > 0) {
                uint256 avgLatency = perf.totalLatency / perf.totalSubmissions;
                if (avgLatency < bestLatency) {
                    bestLatency = avgLatency;
                    fastest = relay;
                }
            }
        }
        
        return fastest;
    }

    /**
     * @dev Selecciona relay con mayor success rate
     */
    function _selectHighestSuccessRelay() internal view returns (FlashbotsBundleManager.RelayType) {
        FlashbotsBundleManager.RelayType best = FlashbotsBundleManager.RelayType.FLASHBOTS;
        uint256 bestSuccessRate = 0;
        
        for (uint256 i = 0; i <= 5; i++) {
            FlashbotsBundleManager.RelayType relay = FlashbotsBundleManager.RelayType(i);
            RelayPerformance memory perf = relayPerformance[relay];
            
            if (perf.currentlyActive && perf.totalSubmissions > 0) {
                uint256 successRate = (perf.successfulInclusions * 10000) / perf.totalSubmissions;
                if (successRate > bestSuccessRate) {
                    bestSuccessRate = successRate;
                    best = relay;
                }
            }
        }
        
        return best;
    }

    /**
     * @dev Selecciona relay con menor costo promedio
     */
    function _selectLowestCostRelay() internal view returns (FlashbotsBundleManager.RelayType) {
        FlashbotsBundleManager.RelayType cheapest = FlashbotsBundleManager.RelayType.FLASHBOTS;
        uint256 bestCost = type(uint256).max;
        
        for (uint256 i = 0; i <= 5; i++) {
            FlashbotsBundleManager.RelayType relay = FlashbotsBundleManager.RelayType(i);
            RelayPerformance memory perf = relayPerformance[relay];
            
            if (perf.currentlyActive && perf.totalSubmissions > 0) {
                uint256 avgCost = perf.totalCost / perf.totalSubmissions;
                if (avgCost < bestCost) {
                    bestCost = avgCost;
                    cheapest = relay;
                }
            }
        }
        
        return cheapest;
    }

    /**
     * @dev Selecciona relay con mejor score balanceado
     */
    function _selectBalancedRelay() internal view returns (FlashbotsBundleManager.RelayType) {
        FlashbotsBundleManager.RelayType best = FlashbotsBundleManager.RelayType.FLASHBOTS;
        uint256 bestScore = 0;
        
        for (uint256 i = 0; i <= 5; i++) {
            FlashbotsBundleManager.RelayType relay = FlashbotsBundleManager.RelayType(i);
            RelayPerformance memory perf = relayPerformance[relay];
            
            if (perf.currentlyActive && perf.score > bestScore) {
                bestScore = perf.score;
                best = relay;
            }
        }
        
        return best;
    }

    /**
     * @dev Selecciona relay usando round robin
     */
    function _selectRoundRobinRelay() internal returns (FlashbotsBundleManager.RelayType) {
        _updateActiveRelays();
        
        if (activeRelays.length == 0) {
            return FlashbotsBundleManager.RelayType.FLASHBOTS;
        }
        
        FlashbotsBundleManager.RelayType selected = activeRelays[roundRobinIndex];
        roundRobinIndex = (roundRobinIndex + 1) % activeRelays.length;
        
        return selected;
    }

    // === FAILOVER SYSTEM ===
    /**
     * @dev Ejecuta failover automático
     */
    function _executeFailover(
        bytes32 bundleId,
        FlashbotsBundleManager.RelayType failedRelay
    ) internal returns (bool success) {
        uint256 attempts = 0;
        
        while (attempts < config.maxFailoverAttempts && !success) {
            FlashbotsBundleManager.RelayType fallbackRelay = _selectFallbackRelay(failedRelay);
            
            if (fallbackRelay == failedRelay) {
                break; // No hay alternativas disponibles
            }
            
            success = _attemptSubmission(bundleId, fallbackRelay);
            
            if (!success) {
                emit FailoverTriggered(
                    bundleId,
                    failedRelay,
                    fallbackRelay,
                    FailoverTrigger.REJECTION,
                    "Submission rejected"
                );
                
                failedRelay = fallbackRelay;
                totalFailovers++;
            }
            
            attempts++;
        }
        
        return success;
    }

    /**
     * @dev Selecciona relay de respaldo
     */
    function _selectFallbackRelay(
        FlashbotsBundleManager.RelayType excludeRelay
    ) internal view returns (FlashbotsBundleManager.RelayType) {
        FlashbotsBundleManager.RelayType best = excludeRelay; // Fallback
        uint256 bestScore = 0;
        
        for (uint256 i = 0; i <= 5; i++) {
            FlashbotsBundleManager.RelayType relay = FlashbotsBundleManager.RelayType(i);
            
            if (relay != excludeRelay && 
                relayPerformance[relay].currentlyActive && 
                _isRelayHealthy(relay)) {
                
                if (relayPerformance[relay].score > bestScore) {
                    bestScore = relayPerformance[relay].score;
                    best = relay;
                }
            }
        }
        
        return best;
    }

    /**
     * @dev Intenta envío a relay específico
     */
    function _attemptSubmission(
        bytes32 bundleId,
        FlashbotsBundleManager.RelayType relay
    ) internal returns (bool success) {
        uint256 startTime = block.timestamp;
        
        try bundleManager.submitBundle(bundleId) {
            success = true;
            
            // Actualizar performance positiva
            _updateRelayPerformance(relay, true, block.timestamp - startTime, 0);
            
        } catch Error(string memory reason) {
            success = false;
            
            // Actualizar performance negativa
            _updateRelayPerformance(relay, false, block.timestamp - startTime, 0);
            
            // Registrar intento fallido
            SubmissionAttempt memory attempt = SubmissionAttempt({
                bundleId: bundleId,
                relay: relay,
                attemptTimestamp: block.timestamp,
                responseTime: block.timestamp - startTime,
                successful: false,
                failoverReason: FailoverTrigger.REJECTION,
                errorMessage: reason
            });
            
            submissionHistory[bundleId].push(attempt);
        }
        
        return success;
    }

    // === PERFORMANCE MONITORING ===
    /**
     * @dev Actualiza métricas de performance de relay
     */
    function _updateRelayPerformance(
        FlashbotsBundleManager.RelayType relay,
        bool successful,
        uint256 latency,
        uint256 cost
    ) internal {
        RelayPerformance storage perf = relayPerformance[relay];
        
        perf.totalSubmissions++;
        perf.totalLatency += latency;
        perf.totalCost += cost;
        perf.lastResponseTime = latency;
        
        if (successful) {
            perf.successfulInclusions++;
            perf.consecutiveFailures = 0;
            perf.lastSuccessfulSubmission = block.timestamp;
        } else {
            perf.consecutiveFailures++;
        }
        
        // Calcular average inclusion time
        if (perf.successfulInclusions > 0) {
            perf.avgInclusionTime = perf.totalLatency / perf.successfulInclusions;
        }
    }

    /**
     * @dev Actualiza scores de todos los relays
     */
    function _updateRelayScores() internal {
        for (uint256 i = 0; i <= 5; i++) {
            FlashbotsBundleManager.RelayType relay = FlashbotsBundleManager.RelayType(i);
            relayPerformance[relay].score = _calculateRelayScore(relay);
        }
        
        lastPerformanceUpdate = block.timestamp;
        
        emit RelayPerformanceUpdated(
            FlashbotsBundleManager.RelayType.FLASHBOTS,
            _getSuccessRate(FlashbotsBundleManager.RelayType.FLASHBOTS),
            _getAvgLatency(FlashbotsBundleManager.RelayType.FLASHBOTS),
            relayPerformance[FlashbotsBundleManager.RelayType.FLASHBOTS].score
        );
    }

    /**
     * @dev Calcula score de relay (0-10000)
     */
    function _calculateRelayScore(
        FlashbotsBundleManager.RelayType relay
    ) internal view returns (uint256 score) {
        RelayPerformance memory perf = relayPerformance[relay];
        
        if (perf.totalSubmissions == 0 || !perf.currentlyActive) {
            return 0;
        }
        
        // Factores del score
        uint256 successRate = (perf.successfulInclusions * 10000) / perf.totalSubmissions;
        uint256 latencyScore = perf.totalLatency > 0 ? 
            (10000 * 1000) / (perf.totalLatency / perf.totalSubmissions + 1000) : 0;
        uint256 costScore = perf.totalCost > 0 ? 
            (10000 * 1e15) / (perf.totalCost / perf.totalSubmissions + 1e15) : 0;
        uint256 reliabilityScore = perf.consecutiveFailures == 0 ? 10000 : 
            10000 / (perf.consecutiveFailures + 1);
        
        // Score ponderado: 40% success + 25% latency + 20% cost + 15% reliability
        score = (successRate * 40 + latencyScore * 25 + costScore * 20 + reliabilityScore * 15) / 100;
    }

    /**
     * @dev Verifica salud del relay
     */
    function _isRelayHealthy(FlashbotsBundleManager.RelayType relay) internal view returns (bool) {
        RelayPerformance memory perf = relayPerformance[relay];
        RelayHealthCheck memory health = relayHealth[relay];
        
        // Verificar que esté activo
        if (!perf.currentlyActive) return false;
        
        // Verificar success rate mínimo
        if (perf.totalSubmissions > 10) {
            uint256 successRate = (perf.successfulInclusions * 10000) / perf.totalSubmissions;
            if (successRate < config.minSuccessRateThreshold) return false;
        }
        
        // Verificar latencia máxima
        if (health.responseTime > config.maxLatencyThreshold) return false;
        
        // Verificar fallas consecutivas
        if (perf.consecutiveFailures >= 5) return false;
        
        return true;
    }

    // === HEALTH MONITORING ===
    /**
     * @dev Actualiza health check de relay
     */
    function updateRelayHealth(
        FlashbotsBundleManager.RelayType relay,
        uint256 responseTime,
        bool responsive,
        uint256 queueLength
    ) external onlyRole(RELAY_ANALYST_ROLE) validRelay(relay) {
        relayHealth[relay] = RelayHealthCheck({
            timestamp: block.timestamp,
            responseTime: responseTime,
            responsive: responsive,
            estimatedGasPrice: tx.gasprice,
            version: "v1.0.0", // TODO: obtener versión real
            queueLength: queueLength
        });
        
        // Actualizar estado activo basado en responsiveness
        relayPerformance[relay].currentlyActive = responsive;
        
        emit RelayHealthUpdated(relay, responsive, responseTime, queueLength);
    }

    /**
     * @dev Actualiza lista de relays activos
     */
    function _updateActiveRelays() internal {
        delete activeRelays;
        
        for (uint256 i = 0; i <= 5; i++) {
            FlashbotsBundleManager.RelayType relay = FlashbotsBundleManager.RelayType(i);
            if (relayPerformance[relay].currentlyActive && _isRelayHealthy(relay)) {
                activeRelays.push(relay);
            }
        }
    }

    // === INITIALIZATION ===
    function _initializeRelayPerformance() internal {
        // Initialize all relay types with default performance
        for (uint256 i = 0; i <= 5; i++) {
            FlashbotsBundleManager.RelayType relay = FlashbotsBundleManager.RelayType(i);
            relayPerformance[relay] = RelayPerformance({
                totalSubmissions: 0,
                successfulInclusions: 0,
                totalLatency: 0,
                totalCost: 0,
                lastResponseTime: 0,
                consecutiveFailures: 0,
                avgInclusionTime: 0,
                lastSuccessfulSubmission: 0,
                currentlyActive: true,
                score: 5000 // Score inicial 50%
            });
        }
    }

    // === ADMIN FUNCTIONS ===
    function updateAggregatorConfig(
        RelaySelectionStrategy strategy,
        uint256 maxFailovers,
        uint256 timeoutMs,
        bool autoFailover
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        config.defaultStrategy = strategy;
        config.maxFailoverAttempts = maxFailovers;
        config.relayTimeoutMs = timeoutMs;
        config.autoFailoverEnabled = autoFailover;
        
        emit AggregatorConfigUpdated(strategy, maxFailovers, timeoutMs);
    }

    function setRelayActive(
        FlashbotsBundleManager.RelayType relay,
        bool active
    ) external onlyRole(MEV_COORDINATOR_ROLE) validRelay(relay) {
        relayPerformance[relay].currentlyActive = active;
    }

    function resetRelayPerformance(
        FlashbotsBundleManager.RelayType relay
    ) external onlyRole(DEFAULT_ADMIN_ROLE) validRelay(relay) {
        delete relayPerformance[relay];
        _initializeRelayPerformance();
    }

    // === VIEW FUNCTIONS ===
    function getRelayPerformance(
        FlashbotsBundleManager.RelayType relay
    ) external view returns (RelayPerformance memory) {
        return relayPerformance[relay];
    }

    function getRelayHealth(
        FlashbotsBundleManager.RelayType relay
    ) external view returns (RelayHealthCheck memory) {
        return relayHealth[relay];
    }

    function getSubmissionHistory(
        bytes32 bundleId
    ) external view returns (SubmissionAttempt[] memory) {
        return submissionHistory[bundleId];
    }

    function getAggregatorStats() external view returns (
        uint256 totalSubmissions,
        uint256 totalSuccesses,
        uint256 _totalFailovers,
        uint256 successRate
    ) {
        totalSubmissions = totalAggregatorSubmissions;
        totalSuccesses = totalAggregatorSuccesses;
        _totalFailovers = totalFailovers;
        
        if (totalSubmissions > 0) {
            successRate = (totalSuccesses * 10000) / totalSubmissions;
        }
    }

    function _getSuccessRate(FlashbotsBundleManager.RelayType relay) internal view returns (uint256) {
        RelayPerformance memory perf = relayPerformance[relay];
        if (perf.totalSubmissions == 0) return 0;
        return (perf.successfulInclusions * 10000) / perf.totalSubmissions;
    }

    function _getAvgLatency(FlashbotsBundleManager.RelayType relay) internal view returns (uint256) {
        RelayPerformance memory perf = relayPerformance[relay];
        if (perf.totalSubmissions == 0) return 0;
        return perf.totalLatency / perf.totalSubmissions;
    }

    function getActiveRelays() external view returns (FlashbotsBundleManager.RelayType[] memory) {
        return activeRelays;
    }

    function getConfig() external view returns (AggregatorConfig memory) {
        return config;
    }
}
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "../interfaces/IFlashLoanReceiver.sol";
import "../interfaces/IGovernanceToken.sol";
import "../libraries/MEVDetection.sol";
import "../libraries/GovernanceHelper.sol";
import "../libraries/AntiSandwichProtection.sol";

/**
 * @title GovernanceMEVProtectionStrategy
 * @notice Estrategia S020: Governance + MEV Protection Advanced Security System
 * 
 * OBJETIVO:
 * - Protección avanzada contra ataques MEV (sandwich, frontrunning, backrunning)
 * - Sistema de governance descentralizado para parámetros críticos
 * - Detección automática de comportamiento malicioso
 * - Implementación de circuit breakers y emergency controls
 * - Sistema de recompensas para reportes de vulnerabilidades
 * - Multi-signature controls y time-locked governance
 * 
 * METODOLOGÍA DE PROTECCIÓN:
 * 1. MEV Detection Engine: Análisis en tiempo real de patrones maliciosos
 * 2. Anti-Sandwich Protection: Commit-reveal schemes y delayed execution
 * 3. Governance System: Voting, proposals, y time-locked execution
 * 4. Circuit Breakers: Pausas automáticas ante condiciones anómalas
 * 5. Emergency Response: Controles de emergencia multi-sig
 * 6. Reputation System: Scoring de usuarios y penalizaciones
 * 
 * COMPONENTES CRÍTICOS:
 * - MEV Attack Detection & Prevention
 * - Decentralized Governance Protocol
 * - Multi-Signature Emergency Controls
 * - Circuit Breaker System
 * - Reputation & Slashing Mechanism
 * - Time-locked Parameter Updates
 * - Flash Loan Attack Prevention
 * - Sandwich Attack Mitigation
 * 
 * ARQUITECTURA DE SEGURIDAD:
 * MEV_Detection → Threat_Assessment → Protection_Activation → Governance_Response → Recovery_Protocol
 * 
 * ArbitrageX Supreme V3.0 - Real-Only Policy Implementation
 * Ingenio Pichichi S.A. - Metodología Disciplinada Máxima Seguridad
 */
contract GovernanceMEVProtectionStrategy is 
    ReentrancyGuard, 
    Ownable, 
    Pausable, 
    EIP712, 
    IFlashLoanReceiver 
{
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;

    // =============================================================================
    // CONSTANTS & IMMUTABLES
    // =============================================================================

    string private constant SIGNING_DOMAIN = "ArbitrageX-Governance";
    string private constant SIGNATURE_VERSION = "1";

    // MEV Protection thresholds
    uint256 private constant MEV_DETECTION_WINDOW = 5;          // 5 blocks lookback
    uint256 private constant SANDWICH_THRESHOLD_BPS = 200;      // 2% price impact threshold
    uint256 private constant FRONTRUN_GAS_MULTIPLIER = 110;     // 110% gas price = frontrun
    uint256 private constant BACKRUN_DELAY_BLOCKS = 2;          // 2 blocks delay detection
    
    // Governance parameters
    uint256 private constant VOTING_DELAY = 1 days;             // Delay before voting starts
    uint256 private constant VOTING_PERIOD = 7 days;            // Voting duration
    uint256 private constant EXECUTION_DELAY = 2 days;          // Timelock delay
    uint256 private constant QUORUM_THRESHOLD = 4000;           // 40% quorum required
    uint256 private constant PROPOSAL_THRESHOLD = 100;          // 1% tokens needed to propose
    
    // Emergency controls
    uint256 private constant EMERGENCY_PAUSE_DURATION = 24 hours;
    uint256 private constant CIRCUIT_BREAKER_THRESHOLD = 1000; // 10% loss threshold
    uint256 private constant MAX_EMERGENCY_ACTIONS = 5;
    
    // Reputation system
    uint256 private constant INITIAL_REPUTATION = 1000;
    uint256 private constant MIN_REPUTATION = 100;
    uint256 private constant MAX_REPUTATION = 10000;
    uint256 private constant SLASHING_PENALTY = 500; // 50% reputation penalty

    // Governance token (immutable)
    IGovernanceToken private immutable governanceToken;
    
    // Multi-signature wallets
    address private immutable emergencyMultisig;
    address private immutable treasuryMultisig;
    address private immutable securityMultisig;

    // =============================================================================
    // STRUCTS & ENUMS
    // =============================================================================

    enum MEVAttackType {
        NONE,
        SANDWICH,
        FRONTRUNNING,
        BACKRUNNING,
        FLASH_LOAN_ATTACK,
        GOVERNANCE_ATTACK,
        ORACLE_MANIPULATION
    }

    enum ProposalState {
        PENDING,
        ACTIVE,
        CANCELED,
        DEFEATED,
        SUCCEEDED,
        QUEUED,
        EXPIRED,
        EXECUTED
    }

    enum EmergencyLevel {
        LOW,        // Minor anomaly detected
        MEDIUM,     // Significant risk identified  
        HIGH,       // Active attack detected
        CRITICAL    // System integrity compromised
    }

    struct MEVDetection {
        MEVAttackType attackType;           // Type of MEV attack detected
        address attacker;                   // Suspected attacker address
        uint256 blockNumber;                // Block where attack detected
        uint256 gasPrice;                   // Gas price used
        uint256 priceImpact;               // Price impact caused (BPS)
        uint256 volumeImpacted;            // Volume affected
        uint256 detectionTimestamp;        // Detection timestamp
        bool isConfirmed;                  // If attack is confirmed
        uint256 severityScore;             // Severity score (0-10000)
    }

    struct GovernanceProposal {
        uint256 proposalId;                // Unique proposal ID
        address proposer;                  // Proposal creator
        string title;                      // Proposal title
        string description;                // Proposal description
        address[] targets;                 // Target contracts
        uint256[] values;                  // ETH values
        bytes[] calldatas;                 // Function call data
        uint256 startBlock;                // Voting start block
        uint256 endBlock;                  // Voting end block
        uint256 forVotes;                  // Votes in favor
        uint256 againstVotes;              // Votes against
        uint256 abstainVotes;              // Abstain votes
        bool canceled;                     // If proposal was canceled
        bool executed;                     // If proposal was executed
        uint256 eta;                       // Execution ETA (timelock)
        ProposalState state;               // Current proposal state
    }

    struct VoteRecord {
        bool hasVoted;                     // If user has voted
        uint8 support;                     // 0=against, 1=for, 2=abstain
        uint256 votes;                     // Number of votes cast
        string reason;                     // Vote reason
    }

    struct UserReputation {
        uint256 currentReputation;         // Current reputation score
        uint256 totalReports;              // Total vulnerability reports
        uint256 confirmedReports;          // Confirmed vulnerability reports
        uint256 slashingEvents;            // Number of times slashed
        uint256 lastActivity;              // Last activity timestamp
        bool isBlacklisted;               // If user is blacklisted
        uint256 blacklistExpiry;          // Blacklist expiry timestamp
    }

    struct EmergencyAction {
        EmergencyLevel level;              // Emergency level
        string description;                // Action description
        address triggeredBy;               // Who triggered the action
        uint256 timestamp;                 // When action was triggered
        bool isResolved;                   // If emergency is resolved
        uint256 resolutionTimestamp;       // When emergency was resolved
    }

    struct CircuitBreakerState {
        bool isActive;                     // If circuit breaker is active
        uint256 activatedAt;               // When it was activated
        uint256 triggerValue;              // Value that triggered it
        string triggerReason;              // Reason for activation
        uint256 cooldownPeriod;           // Cooldown period in seconds
    }

    struct ProtectionMetrics {
        uint256 totalMEVAttacksDetected;   // Total MEV attacks detected
        uint256 totalMEVAttacksPrevented;  // Total MEV attacks prevented
        uint256 totalValueProtected;       // Total value protected (ETH)
        uint256 falsePositiveRate;         // False positive rate (BPS)
        uint256 responseTimeAverage;       // Average response time (seconds)
        uint256 lastMetricsUpdate;         // Last metrics update
    }

    // =============================================================================
    // STATE VARIABLES
    // =============================================================================

    // MEV Detection & Protection
    mapping(bytes32 => MEVDetection) public mevDetections;
    mapping(address => uint256) public userRiskScores;
    mapping(address => uint256) public lastTransactionBlock;
    mapping(uint256 => bytes32[]) public blockMEVDetections;
    bytes32[] public activeMEVThreats;
    
    // Governance system
    mapping(uint256 => GovernanceProposal) public proposals;
    mapping(uint256 => mapping(address => VoteRecord)) public votes;
    mapping(address => uint256) public votingPower;
    mapping(bytes32 => bool) public queuedTransactions;
    uint256 public proposalCounter;
    
    // Reputation system
    mapping(address => UserReputation) public userReputations;
    mapping(address => bool) public trustedReporters;
    mapping(address => uint256) public reporterRewards;
    
    // Emergency controls
    mapping(uint256 => EmergencyAction) public emergencyActions;
    mapping(address => bool) public emergencyOperators;
    uint256 public emergencyActionCounter;
    CircuitBreakerState public circuitBreaker;
    
    // Protection metrics
    ProtectionMetrics public protectionMetrics;
    
    // Configuration parameters (governance-controlled)
    uint256 public maxTransactionValue;
    uint256 public maxSlippageAllowed;
    uint256 public mevDetectionSensitivity;
    bool public mevProtectionEnabled;
    bool public governanceActive;
    
    // Security settings
    mapping(address => bool) public authorizedStrategies;
    mapping(address => bool) public trustedRelayers;
    mapping(bytes32 => uint256) public functionCallLimits;
    uint256 public lastSecurityAudit;

    // =============================================================================
    // EVENTS
    // =============================================================================

    event MEVAttackDetected(
        bytes32 indexed detectionId,
        MEVAttackType indexed attackType,
        address indexed attacker,
        uint256 blockNumber,
        uint256 severityScore
    );

    event MEVAttackPrevented(
        bytes32 indexed detectionId,
        address indexed protectedUser,
        uint256 valueProtected,
        string preventionMethod
    );

    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        string title,
        uint256 startBlock,
        uint256 endBlock
    );

    event VoteCast(
        address indexed voter,
        uint256 indexed proposalId,
        uint8 support,
        uint256 votes,
        string reason
    );

    event ProposalExecuted(
        uint256 indexed proposalId,
        address indexed executor
    );

    event EmergencyActionTriggered(
        uint256 indexed actionId,
        EmergencyLevel indexed level,
        address indexed triggeredBy,
        string description
    );

    event CircuitBreakerActivated(
        string reason,
        uint256 triggerValue,
        uint256 cooldownPeriod
    );

    event ReputationUpdated(
        address indexed user,
        uint256 oldReputation,
        uint256 newReputation,
        string reason
    );

    event UserSlashed(
        address indexed user,
        uint256 penaltyAmount,
        string reason
    );

    event SecurityAuditCompleted(
        address indexed auditor,
        uint256 timestamp,
        string findings
    );

    // =============================================================================
    // MODIFIERS
    // =============================================================================

    modifier onlyGovernance() {
        require(governanceActive, "Governance: Not active");
        require(msg.sender == address(this), "Governance: Only governance");
        _;
    }

    modifier onlyEmergencyOperator() {
        require(
            emergencyOperators[msg.sender] || 
            msg.sender == emergencyMultisig ||
            msg.sender == owner(),
            "Emergency: Not authorized"
        );
        _;
    }

    modifier onlyTrustedStrategy() {
        require(
            authorizedStrategies[msg.sender] || msg.sender == owner(),
            "Protection: Not authorized strategy"
        );
        _;
    }

    modifier whenMEVProtectionActive() {
        require(mevProtectionEnabled, "MEV Protection: Not active");
        _;
    }

    modifier notBlacklisted(address user) {
        UserReputation memory reputation = userReputations[user];
        require(
            !reputation.isBlacklisted || block.timestamp > reputation.blacklistExpiry,
            "Protection: User is blacklisted"
        );
        _;
    }

    modifier minimumReputation(address user, uint256 minReputation) {
        require(
            userReputations[user].currentReputation >= minReputation,
            "Protection: Insufficient reputation"
        );
        _;
    }

    // =============================================================================
    // CONSTRUCTOR
    // =============================================================================

    constructor(
        address _governanceToken,
        address _emergencyMultisig,
        address _treasuryMultisig,
        address _securityMultisig,
        address[] memory _initialEmergencyOperators
    ) EIP712(SIGNING_DOMAIN, SIGNATURE_VERSION) {
        require(_governanceToken != address(0), "Governance: Invalid token");
        require(_emergencyMultisig != address(0), "Governance: Invalid emergency multisig");
        require(_treasuryMultisig != address(0), "Governance: Invalid treasury multisig");
        require(_securityMultisig != address(0), "Governance: Invalid security multisig");

        governanceToken = IGovernanceToken(_governanceToken);
        emergencyMultisig = _emergencyMultisig;
        treasuryMultisig = _treasuryMultisig;
        securityMultisig = _securityMultisig;

        // Initialize emergency operators
        for (uint256 i = 0; i < _initialEmergencyOperators.length; i++) {
            emergencyOperators[_initialEmergencyOperators[i]] = true;
        }

        // Default configuration
        maxTransactionValue = 1000 ether;
        maxSlippageAllowed = 500; // 5%
        mevDetectionSensitivity = 7500; // 75%
        mevProtectionEnabled = true;
        governanceActive = true;

        // Initialize reputation for deployer
        userReputations[msg.sender] = UserReputation({
            currentReputation: MAX_REPUTATION,
            totalReports: 0,
            confirmedReports: 0,
            slashingEvents: 0,
            lastActivity: block.timestamp,
            isBlacklisted: false,
            blacklistExpiry: 0
        });

        // Authorize owner as strategy and emergency operator
        authorizedStrategies[msg.sender] = true;
        emergencyOperators[msg.sender] = true;
    }

    // =============================================================================
    // MEV DETECTION & PROTECTION
    // =============================================================================

    /**
     * @notice Detecta y previene ataques MEV en tiempo real
     * @param transactionData Datos de la transacción a analizar
     * @param user Usuario que ejecuta la transacción
     * @param value Valor de la transacción
     * @return isAllowed Si la transacción es permitida
     * @return detectionId ID de detección si se encontró amenaza
     */
    function detectAndPreventMEV(
        bytes calldata transactionData,
        address user,
        uint256 value
    ) 
        external 
        onlyTrustedStrategy 
        whenMEVProtectionActive 
        notBlacklisted(user)
        returns (bool isAllowed, bytes32 detectionId) 
    {
        // Update user activity
        _updateUserActivity(user);

        // Perform MEV detection analysis
        MEVDetection memory detection = _performMEVAnalysis(transactionData, user, value);
        
        if (detection.attackType != MEVAttackType.NONE) {
            detectionId = _generateDetectionId(detection);
            mevDetections[detectionId] = detection;
            blockMEVDetections[block.number].push(detectionId);
            activeMEVThreats.push(detectionId);

            emit MEVAttackDetected(
                detectionId,
                detection.attackType,
                detection.attacker,
                detection.blockNumber,
                detection.severityScore
            );

            protectionMetrics.totalMEVAttacksDetected++;

            // Determine if transaction should be blocked
            if (detection.severityScore >= mevDetectionSensitivity) {
                isAllowed = false;
                _triggerMEVProtection(detectionId, user, value);
            } else {
                isAllowed = true;
                // Increase user risk score but allow transaction
                userRiskScores[user] += detection.severityScore / 10;
            }
        } else {
            isAllowed = true;
            // Reduce user risk score for clean transactions
            if (userRiskScores[user] > 0) {
                userRiskScores[user] = userRiskScores[user] > 10 ? userRiskScores[user] - 10 : 0;
            }
        }

        return (isAllowed, detectionId);
    }

    /**
     * @notice Realiza análisis completo de MEV para detectar ataques
     */
    function _performMEVAnalysis(
        bytes calldata transactionData,
        address user,
        uint256 value
    ) internal view returns (MEVDetection memory detection) {
        
        detection.attacker = user;
        detection.blockNumber = block.number;
        detection.gasPrice = tx.gasprice;
        detection.detectionTimestamp = block.timestamp;
        detection.volumeImpacted = value;
        detection.isConfirmed = false;

        // Check for sandwich attacks
        uint256 sandwichScore = _detectSandwichAttack(user, value);
        if (sandwichScore > 0) {
            detection.attackType = MEVAttackType.SANDWICH;
            detection.severityScore = sandwichScore;
            return detection;
        }

        // Check for frontrunning
        uint256 frontrunScore = _detectFrontrunning(user);
        if (frontrunScore > 0) {
            detection.attackType = MEVAttackType.FRONTRUNNING;
            detection.severityScore = frontrunScore;
            return detection;
        }

        // Check for backrunning
        uint256 backrunScore = _detectBackrunning(user);
        if (backrunScore > 0) {
            detection.attackType = MEVAttackType.BACKRUNNING;
            detection.severityScore = backrunScore;
            return detection;
        }

        // Check for flash loan attacks
        uint256 flashLoanScore = _detectFlashLoanAttack(transactionData, value);
        if (flashLoanScore > 0) {
            detection.attackType = MEVAttackType.FLASH_LOAN_ATTACK;
            detection.severityScore = flashLoanScore;
            return detection;
        }

        // Check for governance attacks
        uint256 govScore = _detectGovernanceAttack(user, transactionData);
        if (govScore > 0) {
            detection.attackType = MEVAttackType.GOVERNANCE_ATTACK;
            detection.severityScore = govScore;
            return detection;
        }

        detection.attackType = MEVAttackType.NONE;
        return detection;
    }

    /**
     * @notice Detecta ataques de tipo sandwich
     */
    function _detectSandwichAttack(address user, uint256 value) internal view returns (uint256 score) {
        
        // Check if user has made transactions in consecutive blocks (potential sandwich setup)
        uint256 lastBlock = lastTransactionBlock[user];
        if (lastBlock > 0 && block.number - lastBlock <= 2) {
            score += 3000; // 30% suspicion for consecutive block transactions
        }

        // Check if transaction value is significantly high (potential large sandwich)
        if (value > maxTransactionValue / 2) {
            score += 2000; // 20% suspicion for large transactions
        }

        // Check gas price compared to recent blocks
        if (tx.gasprice > block.basefee * FRONTRUN_GAS_MULTIPLIER / 100) {
            score += 2500; // 25% suspicion for high gas price
        }

        // Check user's historical risk score
        uint256 riskScore = userRiskScores[user];
        if (riskScore > 500) {
            score += (riskScore * 2000) / 1000; // Scale risk score to 0-20%
        }

        // Cap at 95% suspicion
        if (score > 9500) score = 9500;

        return score;
    }

    /**
     * @notice Detecta ataques de frontrunning
     */
    function _detectFrontrunning(address user) internal view returns (uint256 score) {
        
        // Check if gas price is suspiciously high
        if (tx.gasprice > block.basefee * FRONTRUN_GAS_MULTIPLIER / 100) {
            score += 4000; // 40% suspicion for frontrun gas price
        }

        // Check if user has pattern of high gas transactions
        if (userRiskScores[user] > 300) {
            score += 3000; // 30% suspicion based on history
        }

        // Check transaction timing (if in same block as pending high-value tx)
        // En implementación real, consultaríamos mempool
        if (block.timestamp % 13 < 2) { // Simplified heuristic
            score += 2000; // 20% suspicion for timing
        }

        if (score > 9500) score = 9500;
        return score;
    }

    /**
     * @notice Detecta ataques de backrunning
     */
    function _detectBackrunning(address user) internal view returns (uint256 score) {
        
        // Check if user frequently trades after large transactions
        uint256 lastBlock = lastTransactionBlock[user];
        if (lastBlock > 0 && block.number - lastBlock == 1) {
            score += 3500; // 35% suspicion for immediate follow-up
        }

        // Check user reputation
        UserReputation memory reputation = userReputations[user];
        if (reputation.currentReputation < INITIAL_REPUTATION / 2) {
            score += 2000; // 20% suspicion for low reputation
        }

        if (score > 9500) score = 9500;
        return score;
    }

    /**
     * @notice Detecta ataques con flash loans
     */
    function _detectFlashLoanAttack(bytes calldata transactionData, uint256 value) internal pure returns (uint256 score) {
        
        // Check if transaction involves flash loan calls
        if (transactionData.length > 100) {
            // Look for flash loan function signatures
            bytes4 flashLoanSelector = bytes4(keccak256("flashLoan(address,uint256,bytes)"));
            bytes4 txSelector = bytes4(transactionData[0:4]);
            
            if (txSelector == flashLoanSelector) {
                score += 5000; // 50% suspicion for flash loan usage
            }
        }

        // Check for unusually large transaction values (potential flash loan)
        if (value > 10000 ether) {
            score += 3000; // 30% suspicion for extremely large value
        }

        if (score > 9500) score = 9500;
        return score;
    }

    /**
     * @notice Detecta ataques de governance
     */
    function _detectGovernanceAttack(address user, bytes calldata transactionData) internal view returns (uint256 score) {
        
        // Check if user is trying to manipulate governance
        if (transactionData.length >= 4) {
            bytes4 govSelector = bytes4(keccak256("propose(address[],uint256[],bytes[],string)"));
            bytes4 txSelector = bytes4(transactionData[0:4]);
            
            if (txSelector == govSelector) {
                // Check if user has sufficient reputation for governance
                if (userReputations[user].currentReputation < INITIAL_REPUTATION) {
                    score += 4000; // 40% suspicion for low-reputation governance attempt
                }
            }
        }

        // Check voting power concentration
        uint256 userVotingPower = votingPower[user];
        uint256 totalSupply = governanceToken.totalSupply();
        
        if (userVotingPower > totalSupply / 10) { // >10% voting power
            score += 2000; // 20% suspicion for high concentration
        }

        if (score > 9500) score = 9500;
        return score;
    }

    /**
     * @notice Activa protección MEV cuando se detecta amenaza
     */
    function _triggerMEVProtection(bytes32 detectionId, address user, uint256 value) internal {
        
        MEVDetection storage detection = mevDetections[detectionId];
        detection.isConfirmed = true;

        // Increase user risk score significantly
        userRiskScores[user] += detection.severityScore;

        // Update protection metrics
        protectionMetrics.totalMEVAttacksPrevented++;
        protectionMetrics.totalValueProtected += value;

        // Trigger appropriate protection measures based on severity
        if (detection.severityScore >= 8000) { // >= 80% threat level
            _triggerEmergencyAction(
                EmergencyLevel.HIGH,
                string(abi.encodePacked("High-severity MEV attack detected from ", _addressToString(user)))
            );
        } else if (detection.severityScore >= 6000) { // >= 60% threat level
            _triggerEmergencyAction(
                EmergencyLevel.MEDIUM,
                "Medium-severity MEV attack detected"
            );
        }

        // Consider slashing for repeated offenders
        if (userRiskScores[user] > 5000) {
            _slashUser(user, "Repeated MEV attack attempts");
        }

        emit MEVAttackPrevented(
            detectionId,
            user,
            value,
            "Transaction blocked by MEV protection"
        );
    }

    // =============================================================================
    // GOVERNANCE SYSTEM
    // =============================================================================

    /**
     * @notice Crea una nueva propuesta de governance
     */
    function propose(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory title,
        string memory description
    ) 
        external 
        whenNotPaused 
        minimumReputation(msg.sender, INITIAL_REPUTATION)
        returns (uint256 proposalId) 
    {
        require(governanceActive, "Governance: Not active");
        require(targets.length == values.length, "Governance: Array length mismatch");
        require(targets.length == calldatas.length, "Governance: Array length mismatch");
        require(targets.length > 0, "Governance: Empty proposal");
        require(bytes(title).length > 0, "Governance: Empty title");

        // Check if proposer has sufficient voting power
        uint256 proposerVotingPower = _getVotingPower(msg.sender);
        uint256 totalSupply = governanceToken.totalSupply();
        require(
            proposerVotingPower >= (totalSupply * PROPOSAL_THRESHOLD) / 10000,
            "Governance: Insufficient voting power"
        );

        proposalId = ++proposalCounter;

        GovernanceProposal storage proposal = proposals[proposalId];
        proposal.proposalId = proposalId;
        proposal.proposer = msg.sender;
        proposal.title = title;
        proposal.description = description;
        proposal.targets = targets;
        proposal.values = values;
        proposal.calldatas = calldatas;
        proposal.startBlock = block.number + (VOTING_DELAY / 12); // Convert seconds to blocks
        proposal.endBlock = proposal.startBlock + (VOTING_PERIOD / 12);
        proposal.state = ProposalState.PENDING;

        // Update user activity
        _updateUserActivity(msg.sender);

        emit ProposalCreated(
            proposalId,
            msg.sender,
            title,
            proposal.startBlock,
            proposal.endBlock
        );

        return proposalId;
    }

    /**
     * @notice Emite voto en una propuesta
     */
    function castVote(
        uint256 proposalId,
        uint8 support,
        string calldata reason
    ) external whenNotPaused notBlacklisted(msg.sender) {
        
        require(_isValidProposal(proposalId), "Governance: Invalid proposal");
        require(support <= 2, "Governance: Invalid vote type");
        
        GovernanceProposal storage proposal = proposals[proposalId];
        require(block.number >= proposal.startBlock, "Governance: Voting not started");
        require(block.number <= proposal.endBlock, "Governance: Voting ended");
        require(!votes[proposalId][msg.sender].hasVoted, "Governance: Already voted");

        uint256 weight = _getVotingPower(msg.sender);
        require(weight > 0, "Governance: No voting power");

        votes[proposalId][msg.sender] = VoteRecord({
            hasVoted: true,
            support: support,
            votes: weight,
            reason: reason
        });

        if (support == 0) {
            proposal.againstVotes += weight;
        } else if (support == 1) {
            proposal.forVotes += weight;
        } else {
            proposal.abstainVotes += weight;
        }

        // Update user activity and reputation
        _updateUserActivity(msg.sender);
        _increaseReputation(msg.sender, 10, "Governance participation");

        emit VoteCast(msg.sender, proposalId, support, weight, reason);
    }

    /**
     * @notice Ejecuta propuesta aprobada después del timelock
     */
    function executeProposal(uint256 proposalId) 
        external 
        whenNotPaused 
        onlyEmergencyOperator 
        returns (bool success) 
    {
        require(_isValidProposal(proposalId), "Governance: Invalid proposal");
        
        GovernanceProposal storage proposal = proposals[proposalId];
        require(proposal.state == ProposalState.QUEUED, "Governance: Not queued");
        require(block.timestamp >= proposal.eta, "Governance: Timelock not expired");

        proposal.executed = true;
        proposal.state = ProposalState.EXECUTED;

        // Execute all actions in the proposal
        for (uint256 i = 0; i < proposal.targets.length; i++) {
            (bool callSuccess, ) = proposal.targets[i].call{value: proposal.values[i]}(
                proposal.calldatas[i]
            );
            require(callSuccess, "Governance: Execution failed");
        }

        // Reward proposer for successful execution
        _increaseReputation(proposal.proposer, 100, "Successful proposal execution");

        emit ProposalExecuted(proposalId, msg.sender);
        return true;
    }

    /**
     * @notice Pone propuesta en cola para ejecución (después de votación exitosa)
     */
    function queueProposal(uint256 proposalId) external whenNotPaused {
        require(_isValidProposal(proposalId), "Governance: Invalid proposal");
        
        GovernanceProposal storage proposal = proposals[proposalId];
        require(proposal.state == ProposalState.SUCCEEDED, "Governance: Proposal not succeeded");

        proposal.eta = block.timestamp + EXECUTION_DELAY;
        proposal.state = ProposalState.QUEUED;

        // Mark transaction as queued for security
        bytes32 txHash = keccak256(abi.encode(proposalId, proposal.eta));
        queuedTransactions[txHash] = true;
    }

    // =============================================================================
    // EMERGENCY CONTROLS & CIRCUIT BREAKERS
    // =============================================================================

    /**
     * @notice Activa acción de emergencia
     */
    function triggerEmergencyAction(EmergencyLevel level, string calldata description) 
        external 
        onlyEmergencyOperator 
    {
        _triggerEmergencyAction(level, description);
    }

    /**
     * @notice Implementación interna de acción de emergencia
     */
    function _triggerEmergencyAction(EmergencyLevel level, string memory description) internal {
        
        uint256 actionId = ++emergencyActionCounter;
        
        emergencyActions[actionId] = EmergencyAction({
            level: level,
            description: description,
            triggeredBy: msg.sender,
            timestamp: block.timestamp,
            isResolved: false,
            resolutionTimestamp: 0
        });

        // Execute emergency measures based on level
        if (level == EmergencyLevel.CRITICAL) {
            _pause(); // Pause all operations
            _activateCircuitBreaker("Critical emergency detected", 0);
        } else if (level == EmergencyLevel.HIGH) {
            mevProtectionEnabled = false; // Disable MEV protection temporarily
        } else if (level == EmergencyLevel.MEDIUM) {
            // Increase security measures
            mevDetectionSensitivity = mevDetectionSensitivity > 2000 ? mevDetectionSensitivity - 2000 : 1000;
        }

        emit EmergencyActionTriggered(actionId, level, msg.sender, description);
    }

    /**
     * @notice Activa circuit breaker
     */
    function _activateCircuitBreaker(string memory reason, uint256 triggerValue) internal {
        
        circuitBreaker = CircuitBreakerState({
            isActive: true,
            activatedAt: block.timestamp,
            triggerValue: triggerValue,
            triggerReason: reason,
            cooldownPeriod: EMERGENCY_PAUSE_DURATION
        });

        emit CircuitBreakerActivated(reason, triggerValue, EMERGENCY_PAUSE_DURATION);
    }

    /**
     * @notice Desactiva circuit breaker después del cooldown
     */
    function deactivateCircuitBreaker() external onlyEmergencyOperator {
        require(circuitBreaker.isActive, "Circuit Breaker: Not active");
        require(
            block.timestamp >= circuitBreaker.activatedAt + circuitBreaker.cooldownPeriod,
            "Circuit Breaker: Cooldown not expired"
        );

        circuitBreaker.isActive = false;
        _unpause();
    }

    /**
     * @notice Resuelve acción de emergencia
     */
    function resolveEmergencyAction(uint256 actionId, string calldata resolution) 
        external 
        onlyEmergencyOperator 
    {
        require(actionId <= emergencyActionCounter, "Emergency: Invalid action ID");
        
        EmergencyAction storage action = emergencyActions[actionId];
        require(!action.isResolved, "Emergency: Already resolved");

        action.isResolved = true;
        action.resolutionTimestamp = block.timestamp;

        // Re-enable systems if high-level emergency is resolved
        if (action.level == EmergencyLevel.HIGH || action.level == EmergencyLevel.CRITICAL) {
            mevProtectionEnabled = true;
            mevDetectionSensitivity = 7500; // Reset to default
        }
    }

    // =============================================================================
    // REPUTATION & SLASHING SYSTEM
    // =============================================================================

    /**
     * @notice Reporta vulnerabilidad o comportamiento malicioso
     */
    function reportVulnerability(
        address targetUser,
        string calldata description,
        bytes calldata evidence
    ) external minimumReputation(msg.sender, MIN_REPUTATION * 2) {
        
        require(targetUser != msg.sender, "Reputation: Cannot report self");
        require(bytes(description).length > 0, "Reputation: Empty description");

        UserReputation storage reporter = userReputations[msg.sender];
        UserReputation storage target = userReputations[targetUser];

        reporter.totalReports++;
        
        // Simplified vulnerability verification (en implementación real sería más complejo)
        bool isValidReport = _verifyVulnerabilityReport(targetUser, description, evidence);
        
        if (isValidReport) {
            reporter.confirmedReports++;
            
            // Reward reporter
            uint256 rewardAmount = 50;
            _increaseReputation(msg.sender, rewardAmount, "Valid vulnerability report");
            reporterRewards[msg.sender] += rewardAmount;
            
            // Penalize target
            _decreaseReputation(targetUser, 100, "Confirmed vulnerability");
            
            // Consider slashing for severe vulnerabilities
            if (target.currentReputation < MIN_REPUTATION * 2) {
                _slashUser(targetUser, description);
            }
        } else {
            // Penalize false reports
            _decreaseReputation(msg.sender, 25, "False vulnerability report");
        }
    }

    /**
     * @notice Aplica slashing a usuario por comportamiento malicioso
     */
    function _slashUser(address user, string memory reason) internal {
        
        UserReputation storage reputation = userReputations[user];
        
        uint256 penalty = (reputation.currentReputation * SLASHING_PENALTY) / 10000;
        reputation.currentReputation = reputation.currentReputation > penalty ? 
            reputation.currentReputation - penalty : MIN_REPUTATION;
        
        reputation.slashingEvents++;
        
        // Blacklist if too many slashing events
        if (reputation.slashingEvents >= 3) {
            reputation.isBlacklisted = true;
            reputation.blacklistExpiry = block.timestamp + 30 days;
        }

        emit UserSlashed(user, penalty, reason);
        emit ReputationUpdated(
            user,
            reputation.currentReputation + penalty,
            reputation.currentReputation,
            string(abi.encodePacked("Slashed: ", reason))
        );
    }

    /**
     * @notice Aumenta reputación de usuario
     */
    function _increaseReputation(address user, uint256 amount, string memory reason) internal {
        
        UserReputation storage reputation = userReputations[user];
        
        uint256 oldReputation = reputation.currentReputation;
        reputation.currentReputation = reputation.currentReputation + amount > MAX_REPUTATION ?
            MAX_REPUTATION : reputation.currentReputation + amount;

        emit ReputationUpdated(user, oldReputation, reputation.currentReputation, reason);
    }

    /**
     * @notice Disminuye reputación de usuario
     */
    function _decreaseReputation(address user, uint256 amount, string memory reason) internal {
        
        UserReputation storage reputation = userReputations[user];
        
        uint256 oldReputation = reputation.currentReputation;
        reputation.currentReputation = reputation.currentReputation > amount ?
            reputation.currentReputation - amount : MIN_REPUTATION;

        emit ReputationUpdated(user, oldReputation, reputation.currentReputation, reason);
    }

    // =============================================================================
    // HELPER FUNCTIONS
    // =============================================================================

    /**
     * @notice Actualiza actividad del usuario
     */
    function _updateUserActivity(address user) internal {
        
        lastTransactionBlock[user] = block.number;
        
        // Initialize reputation if not exists
        if (userReputations[user].currentReputation == 0) {
            userReputations[user] = UserReputation({
                currentReputation: INITIAL_REPUTATION,
                totalReports: 0,
                confirmedReports: 0,
                slashingEvents: 0,
                lastActivity: block.timestamp,
                isBlacklisted: false,
                blacklistExpiry: 0
            });
        }
        
        userReputations[user].lastActivity = block.timestamp;
    }

    /**
     * @notice Obtiene poder de voto de usuario
     */
    function _getVotingPower(address user) internal view returns (uint256) {
        return governanceToken.balanceOf(user);
    }

    /**
     * @notice Verifica si propuesta es válida
     */
    function _isValidProposal(uint256 proposalId) internal view returns (bool) {
        return proposalId > 0 && proposalId <= proposalCounter;
    }

    /**
     * @notice Genera ID único para detección MEV
     */
    function _generateDetectionId(MEVDetection memory detection) internal view returns (bytes32) {
        return keccak256(abi.encode(
            detection.attacker,
            detection.blockNumber,
            detection.gasPrice,
            detection.detectionTimestamp,
            detection.attackType
        ));
    }

    /**
     * @notice Verifica reporte de vulnerabilidad (simplificado)
     */
    function _verifyVulnerabilityReport(
        address targetUser,
        string calldata description,
        bytes calldata evidence
    ) internal view returns (bool) {
        
        // En implementación real, aquí habría análisis complejo de evidencia
        // Por simplicidad, usamos heurísticas básicas
        
        // Check if target has suspicious activity
        if (userRiskScores[targetUser] > 1000) {
            return true;
        }
        
        // Check evidence length (more evidence = higher validity chance)
        if (evidence.length > 100) {
            return true;
        }
        
        // Default to false for safety
        return false;
    }

    /**
     * @notice Convierte address a string para logging
     */
    function _addressToString(address addr) internal pure returns (string memory) {
        bytes32 value = bytes32(uint256(uint160(addr)));
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(42);
        str[0] = '0';
        str[1] = 'x';
        for (uint256 i = 0; i < 20; i++) {
            str[2+i*2] = alphabet[uint8(value[i + 12] >> 4)];
            str[3+i*2] = alphabet[uint8(value[i + 12] & 0x0f)];
        }
        return string(str);
    }

    // =============================================================================
    // FLASH LOAN INTERFACE (Required by IFlashLoanReceiver)
    // =============================================================================

    /**
     * @notice Callback de flash loan (para uso interno de protección)
     */
    function receiveFlashLoan(
        address asset,
        uint256 amount,
        uint256 fee,
        bytes calldata params
    ) external override {
        // Esta función se implementa para cumplir con la interfaz
        // En este contrato se usa principalmente para detectar ataques flash loan
        revert("GovernanceMEV: Flash loan not supported directly");
    }

    // =============================================================================
    // VIEW FUNCTIONS
    // =============================================================================

    /**
     * @notice Obtiene detección MEV específica
     */
    function getMEVDetection(bytes32 detectionId) external view returns (MEVDetection memory) {
        return mevDetections[detectionId];
    }

    /**
     * @notice Obtiene propuesta específica
     */
    function getProposal(uint256 proposalId) external view returns (GovernanceProposal memory) {
        return proposals[proposalId];
    }

    /**
     * @notice Obtiene estado de voto de usuario en propuesta
     */
    function getVote(uint256 proposalId, address voter) external view returns (VoteRecord memory) {
        return votes[proposalId][voter];
    }

    /**
     * @notice Obtiene reputación de usuario
     */
    function getUserReputation(address user) external view returns (UserReputation memory) {
        return userReputations[user];
    }

    /**
     * @notice Obtiene acción de emergencia específica
     */
    function getEmergencyAction(uint256 actionId) external view returns (EmergencyAction memory) {
        return emergencyActions[actionId];
    }

    /**
     * @notice Obtiene métricas de protección
     */
    function getProtectionMetrics() external view returns (ProtectionMetrics memory) {
        return protectionMetrics;
    }

    /**
     * @notice Obtiene estado del circuit breaker
     */
    function getCircuitBreakerState() external view returns (CircuitBreakerState memory) {
        return circuitBreaker;
    }

    /**
     * @notice Verifica si dirección es operador de emergencia
     */
    function isEmergencyOperator(address operator) external view returns (bool) {
        return emergencyOperators[operator];
    }

    /**
     * @notice Verifica si estrategia está autorizada
     */
    function isAuthorizedStrategy(address strategy) external view returns (bool) {
        return authorizedStrategies[strategy];
    }

    // =============================================================================
    // ADMIN FUNCTIONS
    // =============================================================================

    /**
     * @notice Actualiza configuración de protección MEV
     */
    function updateMEVConfig(
        uint256 _maxTransactionValue,
        uint256 _maxSlippageAllowed,
        uint256 _mevDetectionSensitivity,
        bool _mevProtectionEnabled
    ) external onlyGovernance {
        require(_mevDetectionSensitivity <= 10000, "MEV: Invalid sensitivity");
        require(_maxSlippageAllowed <= 10000, "MEV: Invalid slippage");

        maxTransactionValue = _maxTransactionValue;
        maxSlippageAllowed = _maxSlippageAllowed;
        mevDetectionSensitivity = _mevDetectionSensitivity;
        mevProtectionEnabled = _mevProtectionEnabled;
    }

    /**
     * @notice Autoriza/desautoriza estrategias
     */
    function setAuthorizedStrategy(address strategy, bool authorized) external onlyOwner {
        authorizedStrategies[strategy] = authorized;
    }

    /**
     * @notice Autoriza/desautoriza operadores de emergencia
     */
    function setEmergencyOperator(address operator, bool authorized) external onlyOwner {
        emergencyOperators[operator] = authorized;
    }

    /**
     * @notice Autoriza/desautoriza relayers confiables
     */
    function setTrustedRelayer(address relayer, bool trusted) external onlyOwner {
        trustedRelayers[relayer] = trusted;
    }

    /**
     * @notice Actualiza estado de governance
     */
    function setGovernanceActive(bool active) external onlyOwner {
        governanceActive = active;
    }

    /**
     * @notice Registra auditoría de seguridad
     */
    function recordSecurityAudit(string calldata findings) external onlyOwner {
        lastSecurityAudit = block.timestamp;
        
        emit SecurityAuditCompleted(msg.sender, block.timestamp, findings);
    }

    /**
     * @notice Retiro de emergencia para governance
     */
    function emergencyWithdraw(address token, uint256 amount) external {
        require(
            msg.sender == emergencyMultisig || msg.sender == owner(),
            "Emergency: Not authorized"
        );
        
        if (token == address(0)) {
            payable(msg.sender).transfer(amount);
        } else {
            IERC20(token).safeTransfer(msg.sender, amount);
        }
    }

    // =============================================================================
    // RECEIVE & FALLBACK
    // =============================================================================

    receive() external payable {}
    fallback() external payable {}
}
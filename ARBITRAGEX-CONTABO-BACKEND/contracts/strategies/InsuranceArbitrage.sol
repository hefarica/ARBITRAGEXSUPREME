// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IArbitrageStrategy.sol";
import "../interfaces/IInsuranceProtocol.sol";
import "../interfaces/IRiskAssessment.sol";
import "../libraries/PriceUtils.sol";
import "../libraries/SafeMath.sol";

/**
 * @title InsuranceArbitrage
 * @dev Implementa arbitraje en protocolos de seguros DeFi
 * Incluye arbitraje de primas, claims, y coberturas entre protocolos
 * Soporta Nexus Mutual, InsurAce, Unslashed, Risk Harbor, y otros
 */
contract InsuranceArbitrage is IArbitrageStrategy, ReentrancyGuard, Pausable, Ownable {
    using SafeERC20 for IERC20;
    using PriceUtils for uint256;
    using SafeMath for uint256;

    // ==================== ESTRUCTURAS Y ENUMS ====================

    enum InsuranceType {
        PROTOCOL_COVER,        // Cobertura de protocolo (smart contract risk)
        CUSTODIAL_COVER,      // Cobertura custodial (exchange risk)
        YIELD_TOKEN_COVER,    // Cobertura de yield tokens
        STABLECOIN_DEPEG,     // Cobertura de depeg de stablecoins
        SLASHING_COVER,       // Cobertura de slashing (staking)
        BRIDGE_COVER,         // Cobertura de bridges cross-chain
        ORACLE_COVER,         // Cobertura de oracles
        GOVERNANCE_COVER      // Cobertura de governance attacks
    }

    enum ArbitrageType {
        PREMIUM_ARBITRAGE,    // Arbitraje de primas entre protocolos
        COVERAGE_ARBITRAGE,   // Arbitraje de coberturas
        CLAIMS_ARBITRAGE,     // Arbitraje de claims
        UNDERWRITING_ARB,     // Arbitraje de underwriting
        RISK_ASSESSMENT_ARB,  // Arbitraje de evaluación de riesgo
        STAKING_REWARDS_ARB,  // Arbitraje de rewards de staking
        CAPACITY_ARBITRAGE,   // Arbitraje de capacidad disponible
        TEMPORAL_ARBITRAGE    // Arbitraje temporal (timing de eventos)
    }

    enum ProtocolType {
        NEXUS_MUTUAL,
        INSURACE,
        UNSLASHED_FINANCE,
        RISK_HARBOR,
        BRIGHT_UNION,
        ARMOR_PROTOCOL,
        COVER_PROTOCOL,
        EASE_PROTOCOL
    }

    struct InsuranceProtocol {
        ProtocolType protocolType;   // Tipo de protocolo
        address protocolAddress;     // Dirección del protocolo
        address coverToken;          // Token de cobertura
        address stakingToken;        // Token de staking
        uint256 totalCoverage;       // Cobertura total disponible
        uint256 activeCoverage;      // Cobertura activa
        uint256 totalStaked;         // Total stakeado
        uint256 stakingAPY;          // APY de staking
        uint256 minCoverAmount;      // Monto mínimo de cobertura
        uint256 maxCoverAmount;      // Monto máximo de cobertura
        uint256 assessmentStake;     // Stake para assessment
        uint256 claimsRatio;         // Ratio de claims (claims/premiums)
        bool isActive;               // Si está activo
        uint256 lastUpdate;          // Último update
    }

    struct ArbitrageParams {
        ArbitrageType arbType;       // Tipo de arbitraje
        InsuranceType insuranceType; // Tipo de seguro
        ProtocolType protocol1;      // Protocolo primario
        ProtocolType protocol2;      // Protocolo secundario
        address coveredProtocol;     // Protocolo cubierto
        uint256 coverAmount;         // Monto de cobertura
        uint256 coverPeriod;         // Período de cobertura (días)
        uint256 maxPremium;          // Prima máxima a pagar
        uint256 minProfit;           // Ganancia mínima esperada
        uint256 riskTolerance;       // Tolerancia al riesgo (0-100)
        uint256 deadline;            // Timestamp límite
        bytes riskData;              // Datos de evaluación de riesgo
    }

    struct InsuranceCover {
        ProtocolType protocol;       // Protocolo de seguro
        InsuranceType coverType;     // Tipo de cobertura
        address coveredProtocol;     // Protocolo cubierto
        address coverToken;          // Token de la cobertura
        uint256 coverAmount;         // Monto cubierto
        uint256 premium;             // Prima pagada
        uint256 startTime;           // Inicio de cobertura
        uint256 endTime;             // Fin de cobertura
        uint256 riskScore;           // Score de riesgo (0-100)
        address beneficiary;         // Beneficiario
        bool isActive;               // Si está activa
        bool hasClaim;               // Si tiene claim pendiente
    }

    struct ArbitrageOpportunity {
        ArbitrageType arbType;       // Tipo de arbitraje
        ProtocolType protocol1;      // Protocolo 1
        ProtocolType protocol2;      // Protocolo 2
        address coveredProtocol;     // Protocolo cubierto
        uint256 premiumDifference;   // Diferencia de prima (BPS)
        uint256 coverageCapacity;    // Capacidad disponible
        uint256 estimatedProfit;     // Ganancia estimada
        uint256 riskScore;           // Score de riesgo
        uint256 timeWindow;          // Ventana de tiempo
        bool requiresStaking;        // Si requiere staking
        uint256 stakingRequirement;  // Monto de staking requerido
    }

    struct ClaimAssessment {
        uint256 claimId;             // ID del claim
        ProtocolType protocol;       // Protocolo
        address claimant;            // Reclamante
        uint256 claimAmount;         // Monto reclamado
        uint256 coverAmount;         // Monto cubierto original
        string incidentDescription;  // Descripción del incidente
        uint256 incidentTimestamp;   // Timestamp del incidente
        uint256 assessmentDeadline;  // Deadline de assessment
        uint256 votesFor;            // Votos a favor
        uint256 votesAgainst;        // Votos en contra
        uint256 assessmentReward;    // Reward por assessment
        bool isValid;                // Si es claim válido
        bool isPaid;                 // Si fue pagado
    }

    struct StakingPosition {
        ProtocolType protocol;       // Protocolo
        uint256 stakedAmount;        // Monto stakeado
        uint256 stakingRewards;      // Rewards acumulados
        uint256 assessmentRewards;   // Rewards por assessment
        uint256 riskExposure;        // Exposición al riesgo
        uint256 lockPeriod;          // Período de lock
        uint256 unlockTime;          // Tiempo de unlock
        bool isActive;               // Si está activa
        ArbitrageType strategy;      // Estrategia usada
    }

    // ==================== VARIABLES DE ESTADO ====================

    mapping(ProtocolType => InsuranceProtocol) public insuranceProtocols;
    mapping(address => mapping(uint256 => InsuranceCover)) public userCovers;
    mapping(address => uint256[]) public userCoverIds;
    mapping(address => mapping(ProtocolType => StakingPosition)) public stakingPositions;
    mapping(uint256 => ClaimAssessment) public claimAssessments;
    mapping(address => bool) public approvedProtocols;
    mapping(ProtocolType => mapping(address => uint256)) public protocolRiskScores;
    
    uint256 public coverIdCounter;
    uint256 public claimIdCounter;
    uint256 public constant MIN_PREMIUM_DIFF = 50;     // 0.5% mínima diferencia
    uint256 public constant MAX_RISK_SCORE = 80;       // 80% máximo risk score
    uint256 public constant MIN_COVER_PERIOD = 30 days; // 30 días mínimo
    uint256 public insuranceFee = 100;                 // 1% fee de seguro
    uint256 public assessmentFee = 50;                 // 0.5% fee assessment
    uint256 public maxCoverageRatio = 2000;            // 20% máximo coverage ratio
    
    address public riskAssessmentOracle;
    address public claimsValidator;
    address public feeReceiver;

    // ==================== EVENTOS ====================

    event InsuranceArbitrageExecuted(
        address indexed user,
        ArbitrageType arbType,
        ProtocolType protocol1,
        ProtocolType protocol2,
        uint256 coverAmount,
        uint256 profit
    );

    event InsuranceCoverPurchased(
        address indexed buyer,
        uint256 indexed coverId,
        ProtocolType protocol,
        address coveredProtocol,
        uint256 coverAmount,
        uint256 premium,
        uint256 coverPeriod
    );

    event ClaimSubmitted(
        uint256 indexed claimId,
        address indexed claimant,
        ProtocolType protocol,
        uint256 claimAmount,
        string incidentDescription
    );

    event ClaimAssessed(
        uint256 indexed claimId,
        address indexed assessor,
        bool approved,
        uint256 assessmentReward
    );

    event StakingPositionCreated(
        address indexed staker,
        ProtocolType protocol,
        uint256 amount,
        uint256 lockPeriod,
        ArbitrageType strategy
    );

    event PremiumArbitrageDetected(
        ProtocolType protocol1,
        ProtocolType protocol2,
        address coveredProtocol,
        uint256 premiumDifference
    );

    // ==================== CONSTRUCTOR ====================

    constructor(
        address _riskAssessmentOracle,
        address _claimsValidator,
        address _feeReceiver
    ) {
        riskAssessmentOracle = _riskAssessmentOracle;
        claimsValidator = _claimsValidator;
        feeReceiver = _feeReceiver;
    }

    // ==================== FUNCIONES PRINCIPALES ====================

    /**
     * @dev Ejecuta arbitraje de seguros
     */
    function execute(bytes calldata data) 
        external 
        override 
        nonReentrant 
        whenNotPaused 
        returns (bool success, uint256 profit) 
    {
        ArbitrageParams memory params = abi.decode(data, (ArbitrageParams));
        
        require(params.deadline >= block.timestamp, "Insurance: Deadline expired");
        require(params.coverPeriod >= MIN_COVER_PERIOD, "Insurance: Cover period too short");
        require(approvedProtocols[params.coveredProtocol], "Insurance: Protocol not approved");

        // Actualizar datos de protocolos
        _updateProtocolData(params.protocol1);
        if (params.protocol2 != ProtocolType.NEXUS_MUTUAL) {
            _updateProtocolData(params.protocol2);
        }

        // Ejecutar según tipo de arbitraje
        if (params.arbType == ArbitrageType.PREMIUM_ARBITRAGE) {
            return _executePremiumArbitrage(params);
        } else if (params.arbType == ArbitrageType.COVERAGE_ARBITRAGE) {
            return _executeCoverageArbitrage(params);
        } else if (params.arbType == ArbitrageType.UNDERWRITING_ARB) {
            return _executeUnderwritingArbitrage(params);
        } else if (params.arbType == ArbitrageType.STAKING_REWARDS_ARB) {
            return _executeStakingRewardsArbitrage(params);
        } else if (params.arbType == ArbitrageType.CLAIMS_ARBITRAGE) {
            return _executeClaimsArbitrage(params);
        } else if (params.arbType == ArbitrageType.CAPACITY_ARBITRAGE) {
            return _executeCapacityArbitrage(params);
        }

        return (false, 0);
    }

    /**
     * @dev Ejecuta arbitraje de primas
     */
    function _executePremiumArbitrage(ArbitrageParams memory params) 
        internal 
        returns (bool success, uint256 profit) 
    {
        // Obtener primas de ambos protocolos
        uint256 premium1 = _getCoverPremium(
            params.protocol1, params.coveredProtocol, 
            params.coverAmount, params.coverPeriod
        );
        uint256 premium2 = _getCoverPremium(
            params.protocol2, params.coveredProtocol, 
            params.coverAmount, params.coverPeriod
        );

        require(premium1 > 0 && premium2 > 0, "Insurance: Invalid premiums");

        uint256 premiumDiff = premium1 > premium2 ? premium1.sub(premium2) : premium2.sub(premium1);
        uint256 premiumDiffBPS = premiumDiff.mul(10000).div(premium1.add(premium2).div(2));
        
        require(premiumDiffBPS >= MIN_PREMIUM_DIFF, "Insurance: Premium difference too small");

        if (premium1 < premium2) {
            // Comprar cobertura barata en protocol1, vender cara en protocol2
            return _executePremiumArbitrageTrade(
                params.protocol1, params.protocol2, params, premium1, premium2
            );
        } else {
            // Comprar cobertura barata en protocol2, vender cara en protocol1
            return _executePremiumArbitrageTrade(
                params.protocol2, params.protocol1, params, premium2, premium1
            );
        }
    }

    /**
     * @dev Ejecuta arbitraje de cobertura
     */
    function _executeCoverageArbitrage(ArbitrageParams memory params) 
        internal 
        returns (bool success, uint256 profit) 
    {
        InsuranceProtocol memory protocol1 = insuranceProtocols[params.protocol1];
        InsuranceProtocol memory protocol2 = insuranceProtocols[params.protocol2];

        // Verificar capacidad disponible
        uint256 capacity1 = protocol1.totalCoverage.sub(protocol1.activeCoverage);
        uint256 capacity2 = protocol2.totalCoverage.sub(protocol2.activeCoverage);

        require(capacity1 >= params.coverAmount, "Insurance: Insufficient capacity protocol1");
        require(capacity2 >= params.coverAmount, "Insurance: Insufficient capacity protocol2");

        // Comparar términos de cobertura
        uint256 coverage1Quality = _assessCoverageQuality(params.protocol1, params.coveredProtocol);
        uint256 coverage2Quality = _assessCoverageQuality(params.protocol2, params.coveredProtocol);

        if (coverage1Quality > coverage2Quality) {
            // Usar protocol1 para cobertura superior al mismo precio
            return _purchaseOptimalCoverage(params.protocol1, params);
        } else {
            return _purchaseOptimalCoverage(params.protocol2, params);
        }
    }

    /**
     * @dev Ejecuta arbitraje de underwriting
     */
    function _executeUnderwritingArbitrage(ArbitrageParams memory params) 
        internal 
        returns (bool success, uint256 profit) 
    {
        InsuranceProtocol memory protocol = insuranceProtocols[params.protocol1];
        
        // Verificar si es rentable hacer underwriting
        uint256 stakingAPY = protocol.stakingAPY;
        uint256 riskAdjustedReturn = stakingAPY.mul(100 - params.riskTolerance).div(100);
        
        if (riskAdjustedReturn >= params.minProfit) {
            // Stakear en el protocolo para hacer underwriting
            return _stakeForUnderwriting(params.protocol1, params.coverAmount, params);
        }

        return (false, 0);
    }

    /**
     * @dev Ejecuta arbitraje de staking rewards
     */
    function _executeStakingRewardsArbitrage(ArbitrageParams memory params) 
        internal 
        returns (bool success, uint256 profit) 
    {
        InsuranceProtocol memory protocol1 = insuranceProtocols[params.protocol1];
        InsuranceProtocol memory protocol2 = insuranceProtocols[params.protocol2];

        // Comparar APYs de staking
        if (protocol1.stakingAPY > protocol2.stakingAPY) {
            uint256 apyDiff = protocol1.stakingAPY.sub(protocol2.stakingAPY);
            
            if (apyDiff >= params.minProfit) {
                // Mover stake al protocolo con mayor APY
                return _migrateStaking(params.protocol2, params.protocol1, params.coverAmount);
            }
        }

        return (false, 0);
    }

    /**
     * @dev Ejecuta arbitraje de claims
     */
    function _executeClaimsArbitrage(ArbitrageParams memory params) 
        internal 
        returns (bool success, uint256 profit) 
    {
        // Participar en assessment de claims por rewards
        ClaimAssessment memory assessment = abi.decode(params.riskData, (ClaimAssessment));
        
        require(assessment.assessmentDeadline > block.timestamp, "Insurance: Assessment ended");
        require(assessment.assessmentReward >= params.minProfit, "Insurance: Reward too low");

        // Evaluar validez del claim
        bool isValidClaim = _assessClaim(assessment);
        
        // Votar en el assessment
        return _voteOnClaim(assessment.claimId, isValidClaim, params.coverAmount);
    }

    /**
     * @dev Ejecuta arbitraje de capacidad
     */
    function _executeCapacityArbitrage(ArbitrageParams memory params) 
        internal 
        returns (bool success, uint256 profit) 
    {
        InsuranceProtocol memory protocol = insuranceProtocols[params.protocol1];
        
        // Verificar si hay escasez de capacidad que incremente primas
        uint256 utilizationRate = protocol.activeCoverage.mul(10000).div(protocol.totalCoverage);
        
        if (utilizationRate > 8000) { // 80% utilization
            // Alta utilización = primas más altas, mejor momento para hacer underwriting
            return _provideCapacity(params.protocol1, params.coverAmount, params.minProfit);
        }

        return (false, 0);
    }

    /**
     * @dev Compra cobertura de seguro
     */
    function purchaseInsuranceCover(
        ProtocolType protocol,
        InsuranceType coverType,
        address coveredProtocol,
        uint256 coverAmount,
        uint256 coverPeriod,
        uint256 maxPremium
    ) external nonReentrant whenNotPaused {
        require(approvedProtocols[coveredProtocol], "Insurance: Protocol not approved");
        require(coverPeriod >= MIN_COVER_PERIOD, "Insurance: Cover period too short");

        InsuranceProtocol memory insuranceProto = insuranceProtocols[protocol];
        require(insuranceProto.isActive, "Insurance: Protocol not active");

        // Calcular prima
        uint256 premium = _getCoverPremium(protocol, coveredProtocol, coverAmount, coverPeriod);
        require(premium <= maxPremium, "Insurance: Premium too high");

        // Transferir prima
        IERC20(insuranceProto.coverToken).safeTransferFrom(msg.sender, address(this), premium);

        // Comprar cobertura en el protocolo
        uint256 coverId = _purchaseCover(protocol, coveredProtocol, coverType, coverAmount, coverPeriod, premium);

        // Crear registro de cobertura
        userCovers[msg.sender][coverId] = InsuranceCover({
            protocol: protocol,
            coverType: coverType,
            coveredProtocol: coveredProtocol,
            coverToken: insuranceProto.coverToken,
            coverAmount: coverAmount,
            premium: premium,
            startTime: block.timestamp,
            endTime: block.timestamp.add(coverPeriod),
            riskScore: protocolRiskScores[protocol][coveredProtocol],
            beneficiary: msg.sender,
            isActive: true,
            hasClaim: false
        });

        userCoverIds[msg.sender].push(coverId);

        emit InsuranceCoverPurchased(
            msg.sender, coverId, protocol, coveredProtocol, 
            coverAmount, premium, coverPeriod
        );
    }

    /**
     * @dev Submite claim de seguro
     */
    function submitClaim(
        uint256 coverId,
        uint256 claimAmount,
        string calldata incidentDescription,
        uint256 incidentTimestamp,
        bytes calldata evidence
    ) external nonReentrant {
        InsuranceCover storage cover = userCovers[msg.sender][coverId];
        require(cover.isActive, "Insurance: Cover not active");
        require(cover.beneficiary == msg.sender, "Insurance: Not beneficiary");
        require(claimAmount <= cover.coverAmount, "Insurance: Claim amount too high");
        require(incidentTimestamp >= cover.startTime, "Insurance: Incident before cover start");
        require(incidentTimestamp <= cover.endTime, "Insurance: Incident after cover end");

        uint256 claimId = claimIdCounter++;
        
        // Crear assessment del claim
        claimAssessments[claimId] = ClaimAssessment({
            claimId: claimId,
            protocol: cover.protocol,
            claimant: msg.sender,
            claimAmount: claimAmount,
            coverAmount: cover.coverAmount,
            incidentDescription: incidentDescription,
            incidentTimestamp: incidentTimestamp,
            assessmentDeadline: block.timestamp.add(7 days),
            votesFor: 0,
            votesAgainst: 0,
            assessmentReward: claimAmount.mul(assessmentFee).div(10000),
            isValid: false,
            isPaid: false
        });

        cover.hasClaim = true;

        emit ClaimSubmitted(claimId, msg.sender, cover.protocol, claimAmount, incidentDescription);
    }

    /**
     * @dev Vota en assessment de claim
     */
    function voteOnClaimAssessment(
        uint256 claimId,
        bool approve,
        uint256 stakeAmount
    ) external nonReentrant {
        ClaimAssessment storage assessment = claimAssessments[claimId];
        require(assessment.assessmentDeadline > block.timestamp, "Insurance: Assessment ended");

        StakingPosition storage position = stakingPositions[msg.sender][assessment.protocol];
        require(position.isActive, "Insurance: No staking position");
        require(position.stakedAmount >= stakeAmount, "Insurance: Insufficient stake");

        // Registrar voto
        if (approve) {
            assessment.votesFor = assessment.votesFor.add(stakeAmount);
        } else {
            assessment.votesAgainst = assessment.votesAgainst.add(stakeAmount);
        }

        // Actualizar rewards del assessor
        uint256 assessmentReward = assessment.assessmentReward.mul(stakeAmount).div(
            assessment.votesFor.add(assessment.votesAgainst)
        );
        
        position.assessmentRewards = position.assessmentRewards.add(assessmentReward);

        emit ClaimAssessed(claimId, msg.sender, approve, assessmentReward);
    }

    /**
     * @dev Stakea para hacer underwriting
     */
    function stakeForUnderwriting(
        ProtocolType protocol,
        uint256 amount,
        uint256 lockPeriod
    ) external nonReentrant whenNotPaused {
        InsuranceProtocol memory insuranceProto = insuranceProtocols[protocol];
        require(insuranceProto.isActive, "Insurance: Protocol not active");

        // Transferir tokens de staking
        IERC20(insuranceProto.stakingToken).safeTransferFrom(msg.sender, address(this), amount);

        // Stakear en el protocolo
        bool stakeSuccess = _stakeInProtocol(protocol, amount, lockPeriod);
        require(stakeSuccess, "Insurance: Staking failed");

        // Crear posición de staking
        stakingPositions[msg.sender][protocol] = StakingPosition({
            protocol: protocol,
            stakedAmount: amount,
            stakingRewards: 0,
            assessmentRewards: 0,
            riskExposure: 0,
            lockPeriod: lockPeriod,
            unlockTime: block.timestamp.add(lockPeriod),
            isActive: true,
            strategy: ArbitrageType.UNDERWRITING_ARB
        });

        emit StakingPositionCreated(
            msg.sender, protocol, amount, lockPeriod, ArbitrageType.UNDERWRITING_ARB
        );
    }

    /**
     * @dev Simula arbitraje de seguros
     */
    function simulate(bytes calldata data) 
        external 
        view 
        override 
        returns (bool canExecute, uint256 estimatedProfit) 
    {
        ArbitrageParams memory params = abi.decode(data, (ArbitrageParams));
        
        if (params.arbType == ArbitrageType.PREMIUM_ARBITRAGE) {
            return _simulatePremiumArbitrage(params);
        } else if (params.arbType == ArbitrageType.STAKING_REWARDS_ARB) {
            return _simulateStakingArbitrage(params);
        } else if (params.arbType == ArbitrageType.UNDERWRITING_ARB) {
            return _simulateUnderwritingArbitrage(params);
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
            "Insurance Arbitrage",
            "Arbitrage opportunities in DeFi insurance protocols and coverage markets"
        );
    }

    // ==================== FUNCIONES INTERNAS ====================

    /**
     * @dev Obtiene prima de cobertura
     */
    function _getCoverPremium(
        ProtocolType protocol,
        address coveredProtocol,
        uint256 coverAmount,
        uint256 coverPeriod
    ) internal view returns (uint256) {
        uint256 riskScore = protocolRiskScores[protocol][coveredProtocol];
        uint256 basePremium = coverAmount.mul(riskScore).div(10000);
        uint256 timeFactor = coverPeriod.mul(1e18).div(365 days);
        
        return basePremium.mul(timeFactor).div(1e18);
    }

    /**
     * @dev Ejecuta trade de arbitraje de primas
     */
    function _executePremiumArbitrageTrade(
        ProtocolType cheapProtocol,
        ProtocolType expensiveProtocol,
        ArbitrageParams memory params,
        uint256 cheapPremium,
        uint256 expensivePremium
    ) internal returns (bool success, uint256 profit) {
        // Comprar cobertura barata
        uint256 coverId = _purchaseCover(
            cheapProtocol, params.coveredProtocol, params.insuranceType,
            params.coverAmount, params.coverPeriod, cheapPremium
        );

        // En teoría, vender cobertura cara (simplificado)
        // En la práctica, esto requeriría ser un underwriter en el protocolo caro
        
        profit = expensivePremium.sub(cheapPremium);
        
        emit PremiumArbitrageDetected(cheapProtocol, expensiveProtocol, params.coveredProtocol, profit);
        
        return (profit >= params.minProfit, profit);
    }

    /**
     * @dev Evalúa calidad de cobertura
     */
    function _assessCoverageQuality(ProtocolType protocol, address coveredProtocol) internal view returns (uint256) {
        InsuranceProtocol memory insuranceProto = insuranceProtocols[protocol];
        uint256 riskScore = protocolRiskScores[protocol][coveredProtocol];
        
        // Calidad basada en claims ratio, capacidad, y tiempo de respuesta
        uint256 qualityScore = 100;
        qualityScore = qualityScore.sub(insuranceProto.claimsRatio.div(100)); // Penalizar high claims ratio
        qualityScore = qualityScore.sub(riskScore.div(10)); // Penalizar high risk
        
        return qualityScore;
    }

    /**
     * @dev Compra cobertura óptima
     */
    function _purchaseOptimalCoverage(ProtocolType protocol, ArbitrageParams memory params) 
        internal returns (bool success, uint256 profit) {
        uint256 premium = _getCoverPremium(protocol, params.coveredProtocol, params.coverAmount, params.coverPeriod);
        
        if (premium <= params.maxPremium) {
            uint256 coverId = _purchaseCover(
                protocol, params.coveredProtocol, params.insuranceType,
                params.coverAmount, params.coverPeriod, premium
            );
            
            // Profit es la diferencia en calidad/valor
            profit = params.maxPremium.sub(premium);
            return (profit >= params.minProfit, profit);
        }
        
        return (false, 0);
    }

    /**
     * @dev Stakea para underwriting
     */
    function _stakeForUnderwriting(ProtocolType protocol, uint256 amount, ArbitrageParams memory params) 
        internal returns (bool success, uint256 profit) {
        InsuranceProtocol memory insuranceProto = insuranceProtocols[protocol];
        
        bool stakeSuccess = _stakeInProtocol(protocol, amount, params.coverPeriod);
        
        if (stakeSuccess) {
            // Calcular profit esperado del staking
            profit = amount.mul(insuranceProto.stakingAPY).mul(params.coverPeriod).div(365 days).div(10000);
            return (profit >= params.minProfit, profit);
        }
        
        return (false, 0);
    }

    /**
     * @dev Migra staking entre protocolos
     */
    function _migrateStaking(ProtocolType fromProtocol, ProtocolType toProtocol, uint256 amount) 
        internal returns (bool success, uint256 profit) {
        // Unstake del protocolo anterior
        _unstakeFromProtocol(fromProtocol, amount);
        
        // Stake en nuevo protocolo
        bool stakeSuccess = _stakeInProtocol(toProtocol, amount, 0);
        
        if (stakeSuccess) {
            InsuranceProtocol memory oldProto = insuranceProtocols[fromProtocol];
            InsuranceProtocol memory newProto = insuranceProtocols[toProtocol];
            
            profit = amount.mul(newProto.stakingAPY.sub(oldProto.stakingAPY)).div(10000);
            return (true, profit);
        }
        
        return (false, 0);
    }

    /**
     * @dev Evalúa validez de claim
     */
    function _assessClaim(ClaimAssessment memory assessment) internal view returns (bool) {
        // Evaluación simplificada basada en datos históricos y patrones
        if (riskAssessmentOracle != address(0)) {
            return IRiskAssessment(riskAssessmentOracle).assessClaim(
                assessment.claimId, assessment.incidentDescription
            );
        }
        
        // Evaluación básica: claims menores tienen mayor probabilidad de ser válidos
        return assessment.claimAmount <= assessment.coverAmount.div(2);
    }

    /**
     * @dev Vota en claim assessment
     */
    function _voteOnClaim(uint256 claimId, bool approve, uint256 stakeAmount) 
        internal returns (bool success, uint256 profit) {
        ClaimAssessment storage assessment = claimAssessments[claimId];
        
        // Simular participación en voting
        if (approve) {
            assessment.votesFor = assessment.votesFor.add(stakeAmount);
        } else {
            assessment.votesAgainst = assessment.votesAgainst.add(stakeAmount);
        }
        
        // Reward por assessment
        profit = assessment.assessmentReward.mul(stakeAmount).div(
            assessment.votesFor.add(assessment.votesAgainst)
        );
        
        return (profit > 0, profit);
    }

    /**
     * @dev Provee capacidad de underwriting
     */
    function _provideCapacity(ProtocolType protocol, uint256 amount, uint256 minProfit) 
        internal returns (bool success, uint256 profit) {
        InsuranceProtocol memory insuranceProto = insuranceProtocols[protocol];
        
        // En alta utilización, las primas son mejores
        uint256 utilizationBonus = insuranceProto.activeCoverage.mul(100).div(insuranceProto.totalCoverage);
        uint256 enhancedAPY = insuranceProto.stakingAPY.mul(100 + utilizationBonus).div(100);
        
        profit = amount.mul(enhancedAPY).div(10000);
        return (profit >= minProfit, profit);
    }

    /**
     * @dev Actualiza datos del protocolo
     */
    function _updateProtocolData(ProtocolType protocol) internal {
        InsuranceProtocol storage proto = insuranceProtocols[protocol];
        
        if (block.timestamp >= proto.lastUpdate + 1 hours) {
            // Actualizar datos desde el protocolo
            proto.lastUpdate = block.timestamp;
            // En producción, llamar a funciones del protocolo para obtener datos actuales
        }
    }

    // Funciones de interacción con protocolos (simplificadas)
    function _purchaseCover(
        ProtocolType protocol,
        address coveredProtocol,
        InsuranceType coverType,
        uint256 coverAmount,
        uint256 coverPeriod,
        uint256 premium
    ) internal returns (uint256 coverId) {
        coverId = coverIdCounter++;
        
        address protocolAddress = insuranceProtocols[protocol].protocolAddress;
        IInsuranceProtocol(protocolAddress).buyCover(
            coveredProtocol, uint256(coverType), coverAmount, coverPeriod
        );
        
        return coverId;
    }

    function _stakeInProtocol(ProtocolType protocol, uint256 amount, uint256 lockPeriod) internal returns (bool) {
        address protocolAddress = insuranceProtocols[protocol].protocolAddress;
        address stakingToken = insuranceProtocols[protocol].stakingToken;
        
        IERC20(stakingToken).safeApprove(protocolAddress, amount);
        
        try IInsuranceProtocol(protocolAddress).stake(amount, lockPeriod) {
            return true;
        } catch {
            return false;
        }
    }

    function _unstakeFromProtocol(ProtocolType protocol, uint256 amount) internal {
        address protocolAddress = insuranceProtocols[protocol].protocolAddress;
        IInsuranceProtocol(protocolAddress).unstake(amount);
    }

    // Funciones de simulación
    function _simulatePremiumArbitrage(ArbitrageParams memory params) internal view returns (bool, uint256) {
        uint256 premium1 = _getCoverPremium(params.protocol1, params.coveredProtocol, params.coverAmount, params.coverPeriod);
        uint256 premium2 = _getCoverPremium(params.protocol2, params.coveredProtocol, params.coverAmount, params.coverPeriod);
        
        if (premium1 != premium2) {
            uint256 diff = premium1 > premium2 ? premium1.sub(premium2) : premium2.sub(premium1);
            return (diff >= params.minProfit, diff);
        }
        
        return (false, 0);
    }

    function _simulateStakingArbitrage(ArbitrageParams memory params) internal view returns (bool, uint256) {
        InsuranceProtocol memory proto1 = insuranceProtocols[params.protocol1];
        InsuranceProtocol memory proto2 = insuranceProtocols[params.protocol2];
        
        if (proto1.stakingAPY > proto2.stakingAPY) {
            uint256 apyDiff = proto1.stakingAPY.sub(proto2.stakingAPY);
            uint256 profit = params.coverAmount.mul(apyDiff).div(10000);
            return (profit >= params.minProfit, profit);
        }
        
        return (false, 0);
    }

    function _simulateUnderwritingArbitrage(ArbitrageParams memory params) internal view returns (bool, uint256) {
        InsuranceProtocol memory proto = insuranceProtocols[params.protocol1];
        uint256 profit = params.coverAmount.mul(proto.stakingAPY).div(10000);
        return (profit >= params.minProfit, profit);
    }

    // ==================== FUNCIONES ADMINISTRATIVAS ====================

    function addInsuranceProtocol(
        ProtocolType protocolType,
        address protocolAddress,
        address coverToken,
        address stakingToken,
        uint256 stakingAPY,
        uint256 minCoverAmount,
        uint256 maxCoverAmount
    ) external onlyOwner {
        insuranceProtocols[protocolType] = InsuranceProtocol({
            protocolType: protocolType,
            protocolAddress: protocolAddress,
            coverToken: coverToken,
            stakingToken: stakingToken,
            totalCoverage: 0,
            activeCoverage: 0,
            totalStaked: 0,
            stakingAPY: stakingAPY,
            minCoverAmount: minCoverAmount,
            maxCoverAmount: maxCoverAmount,
            assessmentStake: 0,
            claimsRatio: 0,
            isActive: true,
            lastUpdate: block.timestamp
        });
    }

    function setProtocolRiskScore(ProtocolType insuranceProtocol, address coveredProtocol, uint256 riskScore) external onlyOwner {
        require(riskScore <= MAX_RISK_SCORE, "Insurance: Risk score too high");
        protocolRiskScores[insuranceProtocol][coveredProtocol] = riskScore;
    }

    function setApprovedProtocol(address protocol, bool approved) external onlyOwner {
        approvedProtocols[protocol] = approved;
    }

    function setParameters(
        uint256 _insuranceFee,
        uint256 _assessmentFee,
        uint256 _maxCoverageRatio,
        address _riskAssessmentOracle,
        address _claimsValidator,
        address _feeReceiver
    ) external onlyOwner {
        require(_insuranceFee <= 500, "Insurance: Fee too high");
        require(_assessmentFee <= 200, "Insurance: Assessment fee too high");
        
        insuranceFee = _insuranceFee;
        assessmentFee = _assessmentFee;
        maxCoverageRatio = _maxCoverageRatio;
        riskAssessmentOracle = _riskAssessmentOracle;
        claimsValidator = _claimsValidator;
        feeReceiver = _feeReceiver;
    }

    function emergencyPause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ==================== FUNCIONES DE VISTA ====================

    function getInsuranceProtocol(ProtocolType protocol) external view returns (InsuranceProtocol memory) {
        return insuranceProtocols[protocol];
    }

    function getUserCover(address user, uint256 coverId) external view returns (InsuranceCover memory) {
        return userCovers[user][coverId];
    }

    function getUserCoverIds(address user) external view returns (uint256[] memory) {
        return userCoverIds[user];
    }

    function getStakingPosition(address user, ProtocolType protocol) external view returns (StakingPosition memory) {
        return stakingPositions[user][protocol];
    }

    function getClaimAssessment(uint256 claimId) external view returns (ClaimAssessment memory) {
        return claimAssessments[claimId];
    }

    function getArbitrageOpportunities(address coveredProtocol) 
        external 
        view 
        returns (ArbitrageOpportunity[] memory opportunities) 
    {
        // Implementación simplificada
        opportunities = new ArbitrageOpportunity[](2);
        
        opportunities[0] = ArbitrageOpportunity({
            arbType: ArbitrageType.PREMIUM_ARBITRAGE,
            protocol1: ProtocolType.NEXUS_MUTUAL,
            protocol2: ProtocolType.INSURACE,
            coveredProtocol: coveredProtocol,
            premiumDifference: 150, // 1.5%
            coverageCapacity: 1000000e18,
            estimatedProfit: 15000e18,
            riskScore: 25,
            timeWindow: 7 days,
            requiresStaking: false,
            stakingRequirement: 0
        });
        
        opportunities[1] = ArbitrageOpportunity({
            arbType: ArbitrageType.STAKING_REWARDS_ARB,
            protocol1: ProtocolType.UNSLASHED_FINANCE,
            protocol2: ProtocolType.RISK_HARBOR,
            coveredProtocol: coveredProtocol,
            premiumDifference: 300, // 3% APY difference
            coverageCapacity: 500000e18,
            estimatedProfit: 15000e18,
            riskScore: 35,
            timeWindow: 30 days,
            requiresStaking: true,
            stakingRequirement: 100000e18
        });
        
        return opportunities;
    }
}
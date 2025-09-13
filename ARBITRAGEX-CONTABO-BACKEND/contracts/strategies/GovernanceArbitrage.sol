// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IArbitrageStrategy.sol";
import "../interfaces/IGovernanceToken.sol";
import "../interfaces/IVotingEscrow.sol";
import "../libraries/PriceUtils.sol";
import "../libraries/SafeMath.sol";

/**
 * @title GovernanceArbitrage
 * @dev Implementa arbitraje en tokens de governance y mecanismos de votación
 * Incluye arbitraje de ve-tokens, bribing, y diferencias de valoración de governance
 * Aprovecha oportunidades en Curve Wars, Convex, Balancer, y otros protocolos
 */
contract GovernanceArbitrage is IArbitrageStrategy, ReentrancyGuard, Pausable, Ownable {
    using SafeERC20 for IERC20;
    using PriceUtils for uint256;
    using SafeMath for uint256;

    // ==================== ESTRUCTURAS Y ENUMS ====================

    enum GovernanceType {
        VE_TOKEN,          // Vote-escrowed tokens (veCRV, veBAL)
        DELEGATION,        // Delegation arbitrage
        BRIBE_ARBITRAGE,   // Bribing arbitrage (Votium, etc)
        SNAPSHOT_VOTING,   // Off-chain voting arbitrage
        DAO_GOVERNANCE,    // DAO governance tokens
        LIQUIDITY_GAUGE,   // Gauge voting arbitrage
        BOOST_FARMING,     // Boost farming arbitrage
        PROPOSAL_ARBITRAGE // Proposal outcome arbitrage
    }

    enum VotingProtocol {
        CURVE_DAO,
        CONVEX_FINANCE,
        BALANCER_DAO,
        YEARN_GOVERNANCE,
        COMPOUND_GOVERNANCE,
        AAVE_GOVERNANCE,
        UNISWAP_GOVERNANCE,
        MAKER_DAO
    }

    struct GovernanceToken {
        VotingProtocol protocol;     // Protocolo de governance
        address tokenAddress;        // Dirección del token
        address veTokenAddress;      // Dirección del ve-token (si aplica)
        address votingContract;      // Contrato de votación
        uint256 totalSupply;         // Supply total
        uint256 veSupply;            // Supply de ve-tokens
        uint256 avgLockTime;         // Tiempo promedio de lock
        uint256 maxLockTime;         // Tiempo máximo de lock
        uint256 votingPower;         // Poder de voto total
        uint256 delegatedPower;      // Poder delegado
        uint256 bribeRate;           // Tasa de bribes promedio
        bool isActive;               // Si está activo
        uint256 lastUpdate;          // Último update
    }

    struct ArbitrageParams {
        GovernanceType arbType;      // Tipo de arbitraje
        VotingProtocol protocol;     // Protocolo objetivo
        address governanceToken;     // Token de governance
        address veToken;             // Ve-token (opcional)
        uint256 amount;              // Cantidad a arbitrar
        uint256 lockDuration;        // Duración de lock (para ve-tokens)
        uint256 minBribeRate;        // Tasa mínima de bribes
        uint256 proposalId;          // ID de propuesta (si aplica)
        address targetGauge;         // Gauge objetivo (para voting)
        uint256 expectedReturn;      // Retorno esperado
        uint256 deadline;            // Timestamp límite
        bytes strategyData;          // Datos específicos de estrategia
    }

    struct VeTokenPosition {
        VotingProtocol protocol;     // Protocolo
        address governanceToken;     // Token base
        address veToken;             // Ve-token
        uint256 amount;              // Cantidad lockeada
        uint256 unlockTime;          // Tiempo de unlock
        uint256 votingPower;         // Poder de voto actual
        uint256 bribesClaimed;       // Bribes reclamados
        uint256 rewardsAccrued;      // Rewards acumulados
        uint256 entryTime;           // Timestamp de entrada
        bool isActive;               // Si está activa
        GovernanceType strategy;     // Estrategia usada
    }

    struct BribeOpportunity {
        VotingProtocol protocol;     // Protocolo
        address gauge;               // Gauge objetivo
        address bribeToken;          // Token de bribe
        uint256 bribeAmount;         // Cantidad de bribe
        uint256 votesRequired;       // Votos requeridos
        uint256 bribeRate;           // Rate por voto (bribe/voto)
        uint256 duration;            // Duración en epochs
        uint256 estimatedAPR;        // APR estimado del bribe
        uint256 competition;         // Nivel de competencia
        bool isActive;               // Si está activo
    }

    struct ProposalArbitrage {
        VotingProtocol protocol;     // Protocolo
        uint256 proposalId;          // ID de propuesta
        string description;          // Descripción
        uint256 forVotes;            // Votos a favor
        uint256 againstVotes;        // Votos en contra
        uint256 abstainVotes;        // Votos de abstención
        uint256 quorum;              // Quorum requerido
        uint256 endBlock;            // Bloque de finalización
        uint256 executionDelay;      // Delay de ejecución
        bool isPassing;              // Si está pasando
        uint256 impactScore;         // Score de impacto en precio
        uint256 arbitrageValue;      // Valor de arbitraje estimado
    }

    struct GaugeVoting {
        address gauge;               // Dirección del gauge
        uint256 currentWeight;       // Peso actual
        uint256 proposedWeight;      // Peso propuesto
        uint256 votesFor;            // Votos a favor
        uint256 votesAgainst;        // Votos en contra
        uint256 bribeOffered;        // Bribe ofrecido
        uint256 expectedEmissions;   // Emisiones esperadas
        uint256 votingDeadline;      // Deadline de votación
        bool isActive;               // Si está activo
    }

    // ==================== VARIABLES DE ESTADO ====================

    mapping(VotingProtocol => GovernanceToken) public governanceTokens;
    mapping(address => mapping(address => VeTokenPosition)) public vePositions;
    mapping(address => address[]) public userVeTokens;
    mapping(VotingProtocol => mapping(uint256 => ProposalArbitrage)) public proposals;
    mapping(address => BribeOpportunity[]) public activeBribes;
    mapping(address => bool) public authorizedBribers;
    mapping(address => uint256) public delegatedVotingPower;
    
    uint256 public constant MIN_LOCK_TIME = 1 weeks;      // 1 semana mínimo lock
    uint256 public constant MAX_LOCK_TIME = 4 * 365 days; // 4 años máximo lock
    uint256 public constant MIN_BRIBE_RATE = 100;         // 1% mínimo bribe rate
    uint256 public governanceFee = 50;                    // 0.5% fee
    uint256 public bribeFee = 200;                        // 2% fee en bribes
    uint256 public delegationFee = 25;                    // 0.25% fee delegación
    uint256 public maxVotingPower = 10000;                // 100% máximo poder
    
    address public bribeManager;
    address public votingPowerOracle;
    address public feeReceiver;

    // ==================== EVENTOS ====================

    event GovernanceArbitrageExecuted(
        address indexed user,
        GovernanceType arbType,
        VotingProtocol protocol,
        uint256 amount,
        uint256 profit,
        uint256 votingPower
    );

    event VeTokenPositionCreated(
        address indexed user,
        VotingProtocol protocol,
        address veToken,
        uint256 amount,
        uint256 unlockTime,
        uint256 votingPower
    );

    event BribeOffered(
        address indexed briber,
        VotingProtocol protocol,
        address gauge,
        address bribeToken,
        uint256 amount,
        uint256 duration
    );

    event VotesCast(
        address indexed voter,
        VotingProtocol protocol,
        uint256 proposalId,
        bool support,
        uint256 votingPower,
        string reason
    );

    event BribesClaimed(
        address indexed user,
        VotingProtocol protocol,
        address[] bribeTokens,
        uint256[] amounts,
        uint256 totalValue
    );

    event VotingPowerDelegated(
        address indexed delegator,
        address indexed delegatee,
        VotingProtocol protocol,
        uint256 votingPower
    );

    // ==================== CONSTRUCTOR ====================

    constructor(
        address _bribeManager,
        address _votingPowerOracle,
        address _feeReceiver
    ) {
        bribeManager = _bribeManager;
        votingPowerOracle = _votingPowerOracle;
        feeReceiver = _feeReceiver;
        authorizedBribers[msg.sender] = true;
    }

    // ==================== FUNCIONES PRINCIPALES ====================

    /**
     * @dev Ejecuta arbitraje de governance
     */
    function execute(bytes calldata data) 
        external 
        override 
        nonReentrant 
        whenNotPaused 
        returns (bool success, uint256 profit) 
    {
        ArbitrageParams memory params = abi.decode(data, (ArbitrageParams));
        
        require(params.deadline >= block.timestamp, "Gov: Deadline expired");
        require(params.amount > 0, "Gov: Amount must be positive");

        GovernanceToken memory govToken = governanceTokens[params.protocol];
        require(govToken.isActive, "Gov: Protocol not active");

        // Ejecutar según tipo de arbitraje
        if (params.arbType == GovernanceType.VE_TOKEN) {
            return _executeVeTokenArbitrage(params);
        } else if (params.arbType == GovernanceType.BRIBE_ARBITRAGE) {
            return _executeBribeArbitrage(params);
        } else if (params.arbType == GovernanceType.DELEGATION) {
            return _executeDelegationArbitrage(params);
        } else if (params.arbType == GovernanceType.LIQUIDITY_GAUGE) {
            return _executeGaugeVotingArbitrage(params);
        } else if (params.arbType == GovernanceType.PROPOSAL_ARBITRAGE) {
            return _executeProposalArbitrage(params);
        } else if (params.arbType == GovernanceType.BOOST_FARMING) {
            return _executeBoostFarmingArbitrage(params);
        }

        return (false, 0);
    }

    /**
     * @dev Ejecuta arbitraje de ve-tokens
     */
    function _executeVeTokenArbitrage(ArbitrageParams memory params) 
        internal 
        returns (bool success, uint256 profit) 
    {
        GovernanceToken memory govToken = governanceTokens[params.protocol];
        
        require(params.lockDuration >= MIN_LOCK_TIME, "Gov: Lock time too short");
        require(params.lockDuration <= MAX_LOCK_TIME, "Gov: Lock time too long");

        // Transferir governance tokens
        IERC20(params.governanceToken).safeTransferFrom(msg.sender, address(this), params.amount);

        // Crear ve-token lock
        uint256 unlockTime = block.timestamp.add(params.lockDuration);
        uint256 votingPower = _calculateVotingPower(params.amount, params.lockDuration);
        
        bool lockSuccess = _createVeLock(params.protocol, params.governanceToken, params.amount, unlockTime);
        
        if (lockSuccess) {
            // Crear posición del usuario
            VeTokenPosition storage position = vePositions[msg.sender][params.veToken];
            position.protocol = params.protocol;
            position.governanceToken = params.governanceToken;
            position.veToken = params.veToken;
            position.amount = params.amount;
            position.unlockTime = unlockTime;
            position.votingPower = votingPower;
            position.entryTime = block.timestamp;
            position.isActive = true;
            position.strategy = params.arbType;

            userVeTokens[msg.sender].push(params.veToken);

            // Calcular valor del poder de voto
            uint256 votingValue = _calculateVotingValue(votingPower, params.protocol);
            
            emit VeTokenPositionCreated(
                msg.sender, params.protocol, params.veToken, 
                params.amount, unlockTime, votingPower
            );

            return (true, votingValue);
        }

        return (false, 0);
    }

    /**
     * @dev Ejecuta arbitraje de bribes
     */
    function _executeBribeArbitrage(ArbitrageParams memory params) 
        internal 
        returns (bool success, uint256 profit) 
    {
        require(authorizedBribers[msg.sender], "Gov: Not authorized briber");

        BribeOpportunity[] memory bribes = activeBribes[params.targetGauge];
        require(bribes.length > 0, "Gov: No active bribes");

        // Encontrar mejor oportunidad de bribe
        BribeOpportunity memory bestBribe;
        uint256 bestRate = 0;
        
        for (uint256 i = 0; i < bribes.length; i++) {
            if (bribes[i].bribeRate > bestRate && bribes[i].bribeRate >= params.minBribeRate) {
                bestBribe = bribes[i];
                bestRate = bribes[i].bribeRate;
            }
        }

        require(bestRate >= params.minBribeRate, "Gov: Bribe rate too low");

        // Usar poder de voto para reclamar bribes
        VeTokenPosition storage position = vePositions[msg.sender][govToken.veTokenAddress];
        require(position.isActive, "Gov: No ve-token position");

        uint256 votesUsed = _castVotes(params.protocol, params.targetGauge, position.votingPower);
        uint256 bribeValue = votesUsed.mul(bestBribe.bribeRate).div(1e18);

        if (bribeValue > 0) {
            _claimBribes(msg.sender, params.targetGauge, bribeValue);
            
            emit GovernanceArbitrageExecuted(
                msg.sender, params.arbType, params.protocol, 
                votesUsed, bribeValue, position.votingPower
            );

            return (true, bribeValue);
        }

        return (false, 0);
    }

    /**
     * @dev Ejecuta arbitraje de delegación
     */
    function _executeDelegationArbitrage(ArbitrageParams memory params) 
        internal 
        returns (bool success, uint256 profit) 
    {
        VeTokenPosition storage position = vePositions[msg.sender][params.veToken];
        require(position.isActive, "Gov: No ve-token position");

        // Encontrar mejor delegatee que pague por poder de voto
        address bestDelegate = _findBestDelegate(params.protocol, position.votingPower);
        uint256 delegationValue = _calculateDelegationValue(position.votingPower, bestDelegate);

        if (delegationValue >= params.expectedReturn) {
            // Delegar poder de voto
            bool delegateSuccess = _delegateVotingPower(
                params.protocol, bestDelegate, position.votingPower
            );

            if (delegateSuccess) {
                delegatedVotingPower[msg.sender] = delegatedVotingPower[msg.sender].add(position.votingPower);
                
                emit VotingPowerDelegated(
                    msg.sender, bestDelegate, params.protocol, position.votingPower
                );

                return (true, delegationValue);
            }
        }

        return (false, 0);
    }

    /**
     * @dev Ejecuta arbitraje de gauge voting
     */
    function _executeGaugeVotingArbitrage(ArbitrageParams memory params) 
        internal 
        returns (bool success, uint256 profit) 
    {
        GaugeVoting memory gaugeInfo = abi.decode(params.strategyData, (GaugeVoting));
        
        VeTokenPosition storage position = vePositions[msg.sender][params.veToken];
        require(position.isActive, "Gov: No ve-token position");

        // Verificar si el gauge voting es rentable
        uint256 expectedEmissions = gaugeInfo.expectedEmissions.mul(position.votingPower).div(gaugeInfo.votesFor.add(position.votingPower));
        
        if (expectedEmissions.add(gaugeInfo.bribeOffered) >= params.expectedReturn) {
            // Votar por el gauge
            bool voteSuccess = _voteForGauge(params.protocol, params.targetGauge, position.votingPower);
            
            if (voteSuccess) {
                uint256 totalReturn = expectedEmissions.add(gaugeInfo.bribeOffered);
                
                emit GovernanceArbitrageExecuted(
                    msg.sender, params.arbType, params.protocol, 
                    position.votingPower, totalReturn, position.votingPower
                );

                return (true, totalReturn);
            }
        }

        return (false, 0);
    }

    /**
     * @dev Ejecuta arbitraje de propuestas
     */
    function _executeProposalArbitrage(ArbitrageParams memory params) 
        internal 
        returns (bool success, uint256 profit) 
    {
        ProposalArbitrage memory proposal = proposals[params.protocol][params.proposalId];
        require(proposal.endBlock > block.number, "Gov: Proposal ended");

        VeTokenPosition storage position = vePositions[msg.sender][params.veToken];
        require(position.isActive, "Gov: No ve-token position");

        // Analizar impacto de la propuesta en el precio del token
        bool shouldSupport = proposal.impactScore > 0; // Positivo = bueno para precio
        
        // Votar en la propuesta
        bool voteSuccess = _voteOnProposal(
            params.protocol, params.proposalId, shouldSupport, 
            position.votingPower, "Arbitrage vote"
        );

        if (voteSuccess) {
            uint256 proposalValue = proposal.arbitrageValue.mul(position.votingPower).div(1e18);
            
            emit VotesCast(
                msg.sender, params.protocol, params.proposalId, 
                shouldSupport, position.votingPower, "Arbitrage vote"
            );

            return (true, proposalValue);
        }

        return (false, 0);
    }

    /**
     * @dev Ejecuta arbitraje de boost farming
     */
    function _executeBoostFarmingArbitrage(ArbitrageParams memory params) 
        internal 
        returns (bool success, uint256 profit) 
    {
        VeTokenPosition storage position = vePositions[msg.sender][params.veToken];
        require(position.isActive, "Gov: No ve-token position");

        // Usar ve-token para boost en farming
        uint256 boostMultiplier = _calculateBoostMultiplier(position.votingPower, params.amount);
        uint256 extraRewards = params.amount.mul(boostMultiplier.sub(1e18)).div(1e18);

        if (extraRewards >= params.expectedReturn) {
            // Aplicar boost a farming pool
            bool boostSuccess = _applyFarmingBoost(params.protocol, params.targetGauge, position.votingPower);
            
            if (boostSuccess) {
                emit GovernanceArbitrageExecuted(
                    msg.sender, params.arbType, params.protocol, 
                    params.amount, extraRewards, position.votingPower
                );

                return (true, extraRewards);
            }
        }

        return (false, 0);
    }

    /**
     * @dev Ofrece bribe para votación
     */
    function offerBribe(
        VotingProtocol protocol,
        address gauge,
        address bribeToken,
        uint256 amount,
        uint256 duration,
        uint256 minVotes
    ) external nonReentrant {
        require(authorizedBribers[msg.sender], "Gov: Not authorized");
        require(amount > 0, "Gov: Amount must be positive");
        require(duration > 0, "Gov: Duration must be positive");

        // Transferir bribe tokens
        IERC20(bribeToken).safeTransferFrom(msg.sender, address(this), amount);

        // Crear oportunidad de bribe
        BribeOpportunity memory newBribe = BribeOpportunity({
            protocol: protocol,
            gauge: gauge,
            bribeToken: bribeToken,
            bribeAmount: amount,
            votesRequired: minVotes,
            bribeRate: amount.mul(1e18).div(minVotes),
            duration: duration,
            estimatedAPR: _calculateBribeAPR(amount, minVotes, duration),
            competition: _assessBribeCompetition(gauge),
            isActive: true
        });

        activeBribes[gauge].push(newBribe);

        emit BribeOffered(msg.sender, protocol, gauge, bribeToken, amount, duration);
    }

    /**
     * @dev Reclama bribes disponibles
     */
    function claimBribes(address[] calldata gauges) external nonReentrant {
        uint256 totalValue = 0;
        address[] memory tokens = new address[](gauges.length);
        uint256[] memory amounts = new uint256[](gauges.length);

        for (uint256 i = 0; i < gauges.length; i++) {
            (address token, uint256 amount) = _claimBribesForGauge(msg.sender, gauges[i]);
            tokens[i] = token;
            amounts[i] = amount;
            totalValue = totalValue.add(amount);
        }

        if (totalValue > 0) {
            emit BribesClaimed(msg.sender, VotingProtocol.CURVE_DAO, tokens, amounts, totalValue);
        }
    }

    /**
     * @dev Libera ve-token position
     */
    function unlockVeToken(address veToken) external nonReentrant {
        VeTokenPosition storage position = vePositions[msg.sender][veToken];
        require(position.isActive, "Gov: No active position");
        require(block.timestamp >= position.unlockTime, "Gov: Still locked");

        // Liberar tokens
        bool unlockSuccess = _unlockVeTokens(position.protocol, position.governanceToken, position.amount);
        
        if (unlockSuccess) {
            // Transferir tokens de vuelta al usuario
            IERC20(position.governanceToken).safeTransfer(msg.sender, position.amount);
            
            // Limpiar posición
            position.isActive = false;
            _removeUserVeToken(msg.sender, veToken);
        }
    }

    /**
     * @dev Simula arbitraje de governance
     */
    function simulate(bytes calldata data) 
        external 
        view 
        override 
        returns (bool canExecute, uint256 estimatedProfit) 
    {
        ArbitrageParams memory params = abi.decode(data, (ArbitrageParams));
        
        if (params.arbType == GovernanceType.VE_TOKEN) {
            return _simulateVeTokenArbitrage(params);
        } else if (params.arbType == GovernanceType.BRIBE_ARBITRAGE) {
            return _simulateBribeArbitrage(params);
        } else if (params.arbType == GovernanceType.DELEGATION) {
            return _simulateDelegationArbitrage(params);
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
            "Governance Arbitrage",
            "Arbitrage opportunities in DeFi governance tokens and voting mechanisms"
        );
    }

    // ==================== FUNCIONES INTERNAS ====================

    /**
     * @dev Calcula poder de voto basado en monto y duración de lock
     */
    function _calculateVotingPower(uint256 amount, uint256 lockDuration) internal pure returns (uint256) {
        // Fórmula simplificada: poder de voto = amount * (lockDuration / MAX_LOCK_TIME)
        return amount.mul(lockDuration).div(MAX_LOCK_TIME);
    }

    /**
     * @dev Calcula valor monetario del poder de voto
     */
    function _calculateVotingValue(uint256 votingPower, VotingProtocol protocol) internal view returns (uint256) {
        // Calcular basado en bribes promedio y oportunidades
        GovernanceToken memory govToken = governanceTokens[protocol];
        return votingPower.mul(govToken.bribeRate).div(1e18);
    }

    /**
     * @dev Crea lock de ve-token
     */
    function _createVeLock(
        VotingProtocol protocol, 
        address governanceToken, 
        uint256 amount, 
        uint256 unlockTime
    ) internal returns (bool) {
        GovernanceToken memory govToken = governanceTokens[protocol];
        
        // Aprobar tokens al contrato de voting escrow
        IERC20(governanceToken).safeApprove(govToken.veTokenAddress, amount);
        
        try IVotingEscrow(govToken.veTokenAddress).create_lock(amount, unlockTime) {
            return true;
        } catch {
            return false;
        }
    }

    /**
     * @dev Encuentra mejor delegatee
     */
    function _findBestDelegate(VotingProtocol protocol, uint256 votingPower) internal view returns (address) {
        // Implementación simplificada - en producción buscar en marketplace de delegación
        return address(0x456); // Delegatee simulado
    }

    /**
     * @dev Calcula valor de delegación
     */
    function _calculateDelegationValue(uint256 votingPower, address delegate) internal view returns (uint256) {
        // Implementación simplificada
        return votingPower.mul(delegationFee).div(10000);
    }

    /**
     * @dev Delega poder de voto
     */
    function _delegateVotingPower(
        VotingProtocol protocol, 
        address delegate, 
        uint256 votingPower
    ) internal returns (bool) {
        GovernanceToken memory govToken = governanceTokens[protocol];
        
        try IGovernanceToken(govToken.tokenAddress).delegate(delegate) {
            return true;
        } catch {
            return false;
        }
    }

    /**
     * @dev Vota por un gauge
     */
    function _voteForGauge(VotingProtocol protocol, address gauge, uint256 votingPower) internal returns (bool) {
        // Implementación específica por protocolo
        return true; // Simplificado
    }

    /**
     * @dev Vota en propuesta
     */
    function _voteOnProposal(
        VotingProtocol protocol,
        uint256 proposalId,
        bool support,
        uint256 votingPower,
        string memory reason
    ) internal returns (bool) {
        GovernanceToken memory govToken = governanceTokens[protocol];
        
        try IGovernanceToken(govToken.votingContract).castVoteWithReason(
            proposalId, support ? 1 : 0, reason
        ) {
            return true;
        } catch {
            return false;
        }
    }

    /**
     * @dev Aplica boost a farming
     */
    function _applyFarmingBoost(VotingProtocol protocol, address gauge, uint256 votingPower) internal returns (bool) {
        // Implementación específica por protocolo
        return true; // Simplificado
    }

    /**
     * @dev Calcula multiplicador de boost
     */
    function _calculateBoostMultiplier(uint256 votingPower, uint256 farmingAmount) internal pure returns (uint256) {
        // Fórmula simplificada: boost = min(2.5x, 1 + (votingPower / farmingAmount))
        uint256 boost = 1e18 + votingPower.mul(1e18).div(farmingAmount);
        return boost > 2.5e18 ? 2.5e18 : boost;
    }

    /**
     * @dev Calcula APR de bribe
     */
    function _calculateBribeAPR(uint256 amount, uint256 votes, uint256 duration) internal pure returns (uint256) {
        // APR simplificado
        return amount.mul(365 days).div(duration).mul(10000).div(votes);
    }

    /**
     * @dev Evalúa competencia de bribes
     */
    function _assessBribeCompetition(address gauge) internal view returns (uint256) {
        // Evaluar competencia basada en bribes activos
        return 50; // 50% competencia por defecto
    }

    // Funciones auxiliares simplificadas
    function _castVotes(VotingProtocol protocol, address gauge, uint256 votingPower) internal returns (uint256) {
        return votingPower; // Simplificado
    }

    function _claimBribes(address user, address gauge, uint256 amount) internal {
        // Implementar claim de bribes
    }

    function _claimBribesForGauge(address user, address gauge) internal returns (address token, uint256 amount) {
        // Implementación simplificada
        return (address(0), 0);
    }

    function _unlockVeTokens(VotingProtocol protocol, address token, uint256 amount) internal returns (bool) {
        return true; // Simplificado
    }

    function _removeUserVeToken(address user, address veToken) internal {
        address[] storage tokens = userVeTokens[user];
        for (uint256 i = 0; i < tokens.length; i++) {
            if (tokens[i] == veToken) {
                tokens[i] = tokens[tokens.length - 1];
                tokens.pop();
                break;
            }
        }
    }

    // Funciones de simulación
    function _simulateVeTokenArbitrage(ArbitrageParams memory params) internal view returns (bool, uint256) {
        uint256 votingPower = _calculateVotingPower(params.amount, params.lockDuration);
        uint256 value = _calculateVotingValue(votingPower, params.protocol);
        return (value >= params.expectedReturn, value);
    }

    function _simulateBribeArbitrage(ArbitrageParams memory params) internal view returns (bool, uint256) {
        BribeOpportunity[] memory bribes = activeBribes[params.targetGauge];
        if (bribes.length > 0) {
            uint256 bribeValue = bribes[0].bribeRate.mul(params.amount).div(1e18);
            return (bribeValue >= params.expectedReturn, bribeValue);
        }
        return (false, 0);
    }

    function _simulateDelegationArbitrage(ArbitrageParams memory params) internal view returns (bool, uint256) {
        uint256 delegationValue = params.amount.mul(delegationFee).div(10000);
        return (delegationValue >= params.expectedReturn, delegationValue);
    }

    // ==================== FUNCIONES ADMINISTRATIVAS ====================

    function addGovernanceToken(
        VotingProtocol protocol,
        address tokenAddress,
        address veTokenAddress,
        address votingContract,
        uint256 maxLockTime,
        uint256 avgBribeRate
    ) external onlyOwner {
        governanceTokens[protocol] = GovernanceToken({
            protocol: protocol,
            tokenAddress: tokenAddress,
            veTokenAddress: veTokenAddress,
            votingContract: votingContract,
            totalSupply: IERC20(tokenAddress).totalSupply(),
            veSupply: 0,
            avgLockTime: 0,
            maxLockTime: maxLockTime,
            votingPower: 0,
            delegatedPower: 0,
            bribeRate: avgBribeRate,
            isActive: true,
            lastUpdate: block.timestamp
        });
    }

    function setAuthorizedBriber(address briber, bool authorized) external onlyOwner {
        authorizedBribers[briber] = authorized;
    }

    function addProposal(
        VotingProtocol protocol,
        uint256 proposalId,
        string calldata description,
        uint256 endBlock,
        uint256 impactScore,
        uint256 arbitrageValue
    ) external onlyOwner {
        proposals[protocol][proposalId] = ProposalArbitrage({
            protocol: protocol,
            proposalId: proposalId,
            description: description,
            forVotes: 0,
            againstVotes: 0,
            abstainVotes: 0,
            quorum: 0,
            endBlock: endBlock,
            executionDelay: 0,
            isPassing: false,
            impactScore: impactScore,
            arbitrageValue: arbitrageValue
        });
    }

    function setParameters(
        uint256 _governanceFee,
        uint256 _bribeFee,
        uint256 _delegationFee,
        address _bribeManager,
        address _votingPowerOracle,
        address _feeReceiver
    ) external onlyOwner {
        require(_governanceFee <= 200, "Gov: Fee too high");
        require(_bribeFee <= 500, "Gov: Bribe fee too high");
        
        governanceFee = _governanceFee;
        bribeFee = _bribeFee;
        delegationFee = _delegationFee;
        bribeManager = _bribeManager;
        votingPowerOracle = _votingPowerOracle;
        feeReceiver = _feeReceiver;
    }

    function emergencyPause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ==================== FUNCIONES DE VISTA ====================

    function getGovernanceToken(VotingProtocol protocol) external view returns (GovernanceToken memory) {
        return governanceTokens[protocol];
    }

    function getVePosition(address user, address veToken) external view returns (VeTokenPosition memory) {
        return vePositions[user][veToken];
    }

    function getUserVeTokens(address user) external view returns (address[] memory) {
        return userVeTokens[user];
    }

    function getActiveBribes(address gauge) external view returns (BribeOpportunity[] memory) {
        return activeBribes[gauge];
    }

    function getProposal(VotingProtocol protocol, uint256 proposalId) external view returns (ProposalArbitrage memory) {
        return proposals[protocol][proposalId];
    }

    function getBestBribeOpportunities(uint256 minAPR) 
        external 
        view 
        returns (BribeOpportunity[] memory opportunities) 
    {
        // Implementación simplificada - retornar top opportunities
        opportunities = new BribeOpportunity[](2);
        
        opportunities[0] = BribeOpportunity({
            protocol: VotingProtocol.CURVE_DAO,
            gauge: address(0x123),
            bribeToken: address(0x456),
            bribeAmount: 10000e18,
            votesRequired: 1000e18,
            bribeRate: 10e18, // 10 tokens per vote
            duration: 7 days,
            estimatedAPR: 5200, // 52% APR
            competition: 30,
            isActive: true
        });
        
        opportunities[1] = BribeOpportunity({
            protocol: VotingProtocol.CONVEX_FINANCE,
            gauge: address(0x789),
            bribeToken: address(0xabc),
            bribeAmount: 5000e18,
            votesRequired: 2000e18,
            bribeRate: 2.5e18, // 2.5 tokens per vote
            duration: 14 days,
            estimatedAPR: 2600, // 26% APR
            competition: 50,
            isActive: true
        });
        
        return opportunities;
    }
}
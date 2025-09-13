// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IArbitrageStrategy.sol";
import "../interfaces/ILiquidityMining.sol";
import "../interfaces/IYieldFarm.sol";
import "../libraries/PriceUtils.sol";
import "../libraries/SafeMath.sol";

/**
 * @title LiquidityMiningArbitrage
 * @dev Implementa arbitraje de liquidity mining y yield farming
 * Aprovecha diferencias en rewards entre protocolos DeFi
 * Optimiza yields automáticamente entre diferentes farms y pools
 */
contract LiquidityMiningArbitrage is IArbitrageStrategy, ReentrancyGuard, Pausable, Ownable {
    using SafeERC20 for IERC20;
    using PriceUtils for uint256;
    using SafeMath for uint256;

    // ==================== ESTRUCTURAS Y ENUMS ====================

    enum PoolType { 
        UNISWAP_V2, 
        UNISWAP_V3, 
        SUSHISWAP, 
        CURVE, 
        BALANCER, 
        PANCAKESWAP,
        AAVE_LENDING,
        COMPOUND_LENDING,
        YEARN_VAULT,
        CONVEX_POOL
    }

    struct LiquidityPool {
        address poolAddress;        // Dirección del pool
        address stakingContract;    // Contrato de staking
        PoolType poolType;         // Tipo de pool
        address[] tokens;          // Tokens del pool
        address[] rewardTokens;    // Tokens de reward
        uint256[] allocPoints;     // Allocation points para rewards
        uint256 totalLiquidity;   // Liquidez total en USD
        uint256 apr;              // APR actual del pool
        uint256 minDeposit;       // Mínimo depósito requerido
        uint256 lockPeriod;       // Período de lock (0 = sin lock)
        bool isActive;            // Si el pool está activo
        uint256 lastUpdate;       // Último update de métricas
    }

    struct YieldOpportunity {
        uint256 poolId;           // ID del pool
        uint256 estimatedAPR;     // APR estimado
        uint256 totalRewards;     // Rewards totales esperados
        uint256 riskScore;        // Score de riesgo (0-100)
        uint256 liquidityRequired; // Liquidez requerida
        uint256 timeToMaxYield;   // Tiempo para máximo yield
        bool hasImpermanentLoss;  // Si tiene impermanent loss
        uint256 ilRiskBPS;        // Riesgo de impermanent loss (BPS)
    }

    struct ArbitrageParams {
        uint256[] sourcePools;    // Pools origen a retirar
        uint256[] targetPools;    // Pools destino a depositar
        uint256[] amounts;        // Cantidades por pool
        uint256 minYieldIncrease; // Incremento mínimo de yield (BPS)
        uint256 maxSlippage;      // Slippage máximo (BPS)
        uint256 deadline;         // Timestamp límite
        bool compound;            // Si hacer compounding de rewards
        bytes swapData;           // Datos para swaps necesarios
    }

    struct YieldPosition {
        uint256 poolId;           // ID del pool
        uint256 stakedAmount;     // Cantidad stakeada
        uint256 shares;           // Shares en el pool
        uint256 entryTime;        // Timestamp de entrada
        uint256 lastHarvest;      // Último harvest de rewards
        uint256 accumulatedRewards; // Rewards acumulados
        uint256 initialValue;     // Valor inicial en USD
        bool isActive;            // Si la posición está activa
    }

    // ==================== VARIABLES DE ESTADO ====================

    mapping(uint256 => LiquidityPool) public liquidityPools;
    mapping(address => mapping(uint256 => YieldPosition)) public userPositions;
    mapping(address => uint256[]) public userPoolIds;
    mapping(address => bool) public authorizedHarvesters;
    
    uint256 public poolCount;
    uint256 public constant MIN_YIELD_INCREASE = 50;  // 0.5% mínimo incremento
    uint256 public constant MAX_RISK_SCORE = 70;      // Máximo 70% risk score
    uint256 public harvestFee = 100;                  // 1% fee para harvest
    uint256 public performanceFee = 1000;             // 10% performance fee
    uint256 public withdrawalFee = 50;                // 0.5% withdrawal fee
    
    address public yieldAggregator;
    address public priceOracle;
    address public feeReceiver;

    // ==================== EVENTOS ====================

    event YieldArbitrageExecuted(
        address indexed user,
        uint256[] sourcePools,
        uint256[] targetPools,
        uint256 yieldIncrease,
        uint256 totalValue,
        uint256 timestamp
    );

    event PositionOpened(
        address indexed user,
        uint256 indexed poolId,
        uint256 amount,
        uint256 shares,
        uint256 estimatedAPR
    );

    event PositionClosed(
        address indexed user,
        uint256 indexed poolId,
        uint256 amount,
        uint256 rewards,
        uint256 duration
    );

    event RewardsHarvested(
        address indexed user,
        uint256 indexed poolId,
        address[] rewardTokens,
        uint256[] amounts,
        bool compounded
    );

    event PoolAdded(
        uint256 indexed poolId,
        address poolAddress,
        PoolType poolType,
        uint256 estimatedAPR
    );

    event PoolUpdated(
        uint256 indexed poolId,
        uint256 newAPR,
        uint256 newLiquidity,
        uint256 timestamp
    );

    // ==================== CONSTRUCTOR ====================

    constructor(
        address _yieldAggregator,
        address _priceOracle,
        address _feeReceiver
    ) {
        yieldAggregator = _yieldAggregator;
        priceOracle = _priceOracle;
        feeReceiver = _feeReceiver;
        authorizedHarvesters[msg.sender] = true;
    }

    // ==================== FUNCIONES PRINCIPALES ====================

    /**
     * @dev Ejecuta arbitraje de yield farming
     */
    function execute(bytes calldata data) 
        external 
        override 
        nonReentrant 
        whenNotPaused 
        returns (bool success, uint256 profit) 
    {
        ArbitrageParams memory params = abi.decode(data, (ArbitrageParams));
        
        require(params.deadline >= block.timestamp, "YieldArb: Deadline expired");
        require(params.sourcePools.length > 0 || params.targetPools.length > 0, "YieldArb: No pools specified");

        // Calcular yield actual
        uint256 currentYield = _calculateCurrentYield(msg.sender);
        
        // Ejecutar rebalancing
        (bool rebalanceSuccess, uint256 newYield) = _executeYieldRebalancing(params);
        
        if (rebalanceSuccess) {
            uint256 yieldIncrease = newYield > currentYield ? newYield.sub(currentYield) : 0;
            
            if (yieldIncrease >= params.minYieldIncrease) {
                emit YieldArbitrageExecuted(
                    msg.sender,
                    params.sourcePools,
                    params.targetPools,
                    yieldIncrease,
                    _calculateTotalPortfolioValue(msg.sender),
                    block.timestamp
                );
                
                return (true, yieldIncrease);
            }
        }

        return (false, 0);
    }

    /**
     * @dev Abre posición en pool de liquidez
     */
    function openPosition(
        uint256 poolId,
        uint256 amount,
        uint256 minShares,
        bool autoCompound
    ) external nonReentrant whenNotPaused {
        LiquidityPool memory pool = liquidityPools[poolId];
        require(pool.isActive, "YieldArb: Pool not active");
        require(amount >= pool.minDeposit, "YieldArb: Below min deposit");

        // Verificar balance del usuario
        address firstToken = pool.tokens[0];
        require(IERC20(firstToken).balanceOf(msg.sender) >= amount, "YieldArb: Insufficient balance");

        // Transferir tokens
        IERC20(firstToken).safeTransferFrom(msg.sender, address(this), amount);

        // Depositar en el pool según el tipo
        uint256 shares = _depositToPool(poolId, amount);
        require(shares >= minShares, "YieldArb: Insufficient shares received");

        // Crear o actualizar posición
        YieldPosition storage position = userPositions[msg.sender][poolId];
        
        if (position.stakedAmount == 0) {
            userPoolIds[msg.sender].push(poolId);
        }

        position.poolId = poolId;
        position.stakedAmount = position.stakedAmount.add(amount);
        position.shares = position.shares.add(shares);
        position.entryTime = block.timestamp;
        position.initialValue = position.initialValue.add(_getValueInUSD(firstToken, amount));
        position.isActive = true;

        emit PositionOpened(msg.sender, poolId, amount, shares, pool.apr);
    }

    /**
     * @dev Cierra posición en pool
     */
    function closePosition(
        uint256 poolId,
        uint256 shareAmount,
        uint256 minAmount
    ) external nonReentrant whenNotPaused {
        YieldPosition storage position = userPositions[msg.sender][poolId];
        require(position.isActive, "YieldArb: No active position");
        require(position.shares >= shareAmount, "YieldArb: Insufficient shares");

        LiquidityPool memory pool = liquidityPools[poolId];
        
        // Verificar lock period
        if (pool.lockPeriod > 0) {
            require(
                block.timestamp >= position.entryTime.add(pool.lockPeriod),
                "YieldArb: Position still locked"
            );
        }

        // Retirar del pool
        uint256 withdrawnAmount = _withdrawFromPool(poolId, shareAmount);
        require(withdrawnAmount >= minAmount, "YieldArb: Slippage too high");

        // Calcular y cobrar withdrawal fee
        uint256 fee = withdrawnAmount.mul(withdrawalFee).div(10000);
        uint256 netAmount = withdrawnAmount.sub(fee);

        // Harvest rewards antes de cerrar
        uint256 rewards = _harvestRewards(poolId, msg.sender, false);

        // Actualizar posición
        position.stakedAmount = position.stakedAmount.sub(
            position.stakedAmount.mul(shareAmount).div(position.shares)
        );
        position.shares = position.shares.sub(shareAmount);
        
        if (position.shares == 0) {
            position.isActive = false;
            _removeUserPool(msg.sender, poolId);
        }

        // Transferir tokens al usuario
        address firstToken = pool.tokens[0];
        if (fee > 0) {
            IERC20(firstToken).safeTransfer(feeReceiver, fee);
        }
        IERC20(firstToken).safeTransfer(msg.sender, netAmount);

        emit PositionClosed(
            msg.sender,
            poolId,
            netAmount,
            rewards,
            block.timestamp.sub(position.entryTime)
        );
    }

    /**
     * @dev Cosecha rewards de una posición
     */
    function harvestRewards(uint256 poolId, bool compound) external nonReentrant {
        require(
            authorizedHarvesters[msg.sender] || 
            userPositions[msg.sender][poolId].isActive,
            "YieldArb: Not authorized"
        );

        uint256 rewards = _harvestRewards(poolId, msg.sender, compound);
        require(rewards > 0, "YieldArb: No rewards to harvest");
    }

    /**
     * @dev Cosecha rewards de múltiples posiciones
     */
    function batchHarvestRewards(uint256[] calldata poolIds, bool compound) external nonReentrant {
        uint256 totalRewards = 0;
        
        for (uint256 i = 0; i < poolIds.length; i++) {
            if (userPositions[msg.sender][poolIds[i]].isActive) {
                totalRewards = totalRewards.add(_harvestRewards(poolIds[i], msg.sender, compound));
            }
        }
        
        require(totalRewards > 0, "YieldArb: No rewards to harvest");
    }

    /**
     * @dev Simula arbitraje de yield
     */
    function simulate(bytes calldata data) 
        external 
        view 
        override 
        returns (bool canExecute, uint256 estimatedProfit) 
    {
        ArbitrageParams memory params = abi.decode(data, (ArbitrageParams));
        
        uint256 currentYield = _calculateCurrentYield(msg.sender);
        uint256 projectedYield = _calculateProjectedYield(msg.sender, params);
        
        if (projectedYield > currentYield) {
            uint256 yieldIncrease = projectedYield.sub(currentYield);
            canExecute = yieldIncrease >= params.minYieldIncrease;
            estimatedProfit = yieldIncrease;
        }

        return (canExecute, estimatedProfit);
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
            "Liquidity Mining Arbitrage",
            "Optimizes yield farming positions across multiple DeFi protocols"
        );
    }

    // ==================== FUNCIONES INTERNAS ====================

    /**
     * @dev Ejecuta rebalancing de yield
     */
    function _executeYieldRebalancing(ArbitrageParams memory params) 
        internal 
        returns (bool success, uint256 newYield) 
    {
        // Cerrar posiciones origen
        for (uint256 i = 0; i < params.sourcePools.length; i++) {
            uint256 poolId = params.sourcePools[i];
            YieldPosition storage position = userPositions[msg.sender][poolId];
            
            if (position.isActive && position.shares > 0) {
                _withdrawFromPool(poolId, position.shares);
                position.isActive = false;
            }
        }

        // Abrir posiciones destino
        for (uint256 i = 0; i < params.targetPools.length; i++) {
            uint256 poolId = params.targetPools[i];
            uint256 amount = params.amounts[i];
            
            if (amount > 0) {
                _depositToPool(poolId, amount);
            }
        }

        newYield = _calculateCurrentYield(msg.sender);
        return (true, newYield);
    }

    /**
     * @dev Deposita en pool específico
     */
    function _depositToPool(uint256 poolId, uint256 amount) internal returns (uint256 shares) {
        LiquidityPool memory pool = liquidityPools[poolId];
        address stakingContract = pool.stakingContract;
        
        // Aprobar tokens al staking contract
        IERC20(pool.tokens[0]).safeApprove(stakingContract, amount);
        
        // Ejecutar depósito según tipo de pool
        if (pool.poolType == PoolType.UNISWAP_V2 || pool.poolType == PoolType.SUSHISWAP) {
            shares = ILiquidityMining(stakingContract).deposit(poolId, amount);
        } else if (pool.poolType == PoolType.CURVE) {
            shares = ICurvePool(stakingContract).add_liquidity([amount, 0, 0, 0], 0);
        } else if (pool.poolType == PoolType.AAVE_LENDING) {
            shares = IAavePool(stakingContract).deposit(pool.tokens[0], amount, address(this), 0);
        }
        
        return shares;
    }

    /**
     * @dev Retira de pool específico
     */
    function _withdrawFromPool(uint256 poolId, uint256 shares) internal returns (uint256 amount) {
        LiquidityPool memory pool = liquidityPools[poolId];
        address stakingContract = pool.stakingContract;
        
        // Ejecutar retiro según tipo de pool
        if (pool.poolType == PoolType.UNISWAP_V2 || pool.poolType == PoolType.SUSHISWAP) {
            amount = ILiquidityMining(stakingContract).withdraw(poolId, shares);
        } else if (pool.poolType == PoolType.CURVE) {
            amount = ICurvePool(stakingContract).remove_liquidity_one_coin(shares, 0, 0);
        } else if (pool.poolType == PoolType.AAVE_LENDING) {
            amount = IAavePool(stakingContract).withdraw(pool.tokens[0], shares, address(this));
        }
        
        return amount;
    }

    /**
     * @dev Cosecha rewards de un pool
     */
    function _harvestRewards(uint256 poolId, address user, bool compound) internal returns (uint256 totalRewards) {
        LiquidityPool memory pool = liquidityPools[poolId];
        YieldPosition storage position = userPositions[user][poolId];
        
        require(position.isActive, "YieldArb: No active position");
        
        address[] memory rewardTokens = pool.rewardTokens;
        uint256[] memory rewardAmounts = new uint256[](rewardTokens.length);
        
        // Cosechar según tipo de pool
        if (pool.poolType == PoolType.UNISWAP_V2 || pool.poolType == PoolType.SUSHISWAP) {
            ILiquidityMining(pool.stakingContract).harvest(poolId);
        } else if (pool.poolType == PoolType.CURVE) {
            ICurveGauge(pool.stakingContract).claim_rewards();
        }
        
        // Calcular rewards obtenidos
        for (uint256 i = 0; i < rewardTokens.length; i++) {
            uint256 balance = IERC20(rewardTokens[i]).balanceOf(address(this));
            rewardAmounts[i] = balance;
            totalRewards = totalRewards.add(_getValueInUSD(rewardTokens[i], balance));
        }
        
        // Cobrar harvest fee
        uint256 fee = totalRewards.mul(harvestFee).div(10000);
        uint256 netRewards = totalRewards.sub(fee);
        
        // Compound o transferir rewards
        if (compound) {
            _compoundRewards(poolId, rewardTokens, rewardAmounts);
        } else {
            _transferRewards(user, rewardTokens, rewardAmounts);
        }
        
        position.lastHarvest = block.timestamp;
        position.accumulatedRewards = position.accumulatedRewards.add(netRewards);
        
        emit RewardsHarvested(user, poolId, rewardTokens, rewardAmounts, compound);
        
        return netRewards;
    }

    /**
     * @dev Hace compound de rewards
     */
    function _compoundRewards(
        uint256 poolId,
        address[] memory rewardTokens,
        uint256[] memory amounts
    ) internal {
        // Swap rewards a token principal del pool y re-depositar
        LiquidityPool memory pool = liquidityPools[poolId];
        address principalToken = pool.tokens[0];
        
        uint256 totalToReinvest = 0;
        
        for (uint256 i = 0; i < rewardTokens.length; i++) {
            if (amounts[i] > 0 && rewardTokens[i] != principalToken) {
                // Swap reward token a principal token
                uint256 swapped = _swapToken(rewardTokens[i], principalToken, amounts[i]);
                totalToReinvest = totalToReinvest.add(swapped);
            } else if (rewardTokens[i] == principalToken) {
                totalToReinvest = totalToReinvest.add(amounts[i]);
            }
        }
        
        if (totalToReinvest > 0) {
            _depositToPool(poolId, totalToReinvest);
        }
    }

    /**
     * @dev Transfiere rewards al usuario
     */
    function _transferRewards(
        address user,
        address[] memory rewardTokens,
        uint256[] memory amounts
    ) internal {
        for (uint256 i = 0; i < rewardTokens.length; i++) {
            if (amounts[i] > 0) {
                uint256 fee = amounts[i].mul(harvestFee).div(10000);
                uint256 netAmount = amounts[i].sub(fee);
                
                if (fee > 0) {
                    IERC20(rewardTokens[i]).safeTransfer(feeReceiver, fee);
                }
                IERC20(rewardTokens[i]).safeTransfer(user, netAmount);
            }
        }
    }

    /**
     * @dev Swap entre tokens
     */
    function _swapToken(address tokenIn, address tokenOut, uint256 amountIn) internal returns (uint256 amountOut) {
        // Implementación simplificada - en producción usar DEX aggregator
        return amountIn.mul(98).div(100); // Simular 2% slippage
    }

    /**
     * @dev Calcula yield actual del usuario
     */
    function _calculateCurrentYield(address user) internal view returns (uint256 totalYield) {
        uint256[] memory poolIds = userPoolIds[user];
        
        for (uint256 i = 0; i < poolIds.length; i++) {
            YieldPosition memory position = userPositions[user][poolIds[i]];
            if (position.isActive) {
                LiquidityPool memory pool = liquidityPools[poolIds[i]];
                uint256 positionValue = _getValueInUSD(pool.tokens[0], position.stakedAmount);
                uint256 yieldContribution = positionValue.mul(pool.apr).div(10000);
                totalYield = totalYield.add(yieldContribution);
            }
        }
        
        return totalYield;
    }

    /**
     * @dev Calcula yield proyectado
     */
    function _calculateProjectedYield(address user, ArbitrageParams memory params) 
        internal 
        view 
        returns (uint256 projectedYield) 
    {
        // Implementación simplificada
        uint256 totalValue = _calculateTotalPortfolioValue(user);
        
        for (uint256 i = 0; i < params.targetPools.length; i++) {
            LiquidityPool memory pool = liquidityPools[params.targetPools[i]];
            projectedYield = projectedYield.add(totalValue.mul(pool.apr).div(10000));
        }
        
        return projectedYield;
    }

    /**
     * @dev Calcula valor total del portafolio
     */
    function _calculateTotalPortfolioValue(address user) internal view returns (uint256 totalValue) {
        uint256[] memory poolIds = userPoolIds[user];
        
        for (uint256 i = 0; i < poolIds.length; i++) {
            YieldPosition memory position = userPositions[user][poolIds[i]];
            if (position.isActive) {
                LiquidityPool memory pool = liquidityPools[poolIds[i]];
                totalValue = totalValue.add(_getValueInUSD(pool.tokens[0], position.stakedAmount));
            }
        }
        
        return totalValue;
    }

    /**
     * @dev Obtiene valor en USD
     */
    function _getValueInUSD(address token, uint256 amount) internal view returns (uint256) {
        // Implementación simplificada - en producción usar price oracle
        return amount; // Asumir 1:1 por simplicidad
    }

    /**
     * @dev Remueve pool del usuario
     */
    function _removeUserPool(address user, uint256 poolId) internal {
        uint256[] storage userPools = userPoolIds[user];
        for (uint256 i = 0; i < userPools.length; i++) {
            if (userPools[i] == poolId) {
                userPools[i] = userPools[userPools.length - 1];
                userPools.pop();
                break;
            }
        }
    }

    // ==================== FUNCIONES ADMINISTRATIVAS ====================

    /**
     * @dev Agrega nuevo pool de liquidez
     */
    function addLiquidityPool(
        address poolAddress,
        address stakingContract,
        PoolType poolType,
        address[] calldata tokens,
        address[] calldata rewardTokens,
        uint256[] calldata allocPoints,
        uint256 apr,
        uint256 minDeposit,
        uint256 lockPeriod
    ) external onlyOwner {
        uint256 poolId = poolCount++;
        
        liquidityPools[poolId] = LiquidityPool({
            poolAddress: poolAddress,
            stakingContract: stakingContract,
            poolType: poolType,
            tokens: tokens,
            rewardTokens: rewardTokens,
            allocPoints: allocPoints,
            totalLiquidity: 0,
            apr: apr,
            minDeposit: minDeposit,
            lockPeriod: lockPeriod,
            isActive: true,
            lastUpdate: block.timestamp
        });

        emit PoolAdded(poolId, poolAddress, poolType, apr);
    }

    /**
     * @dev Actualiza métricas del pool
     */
    function updatePoolMetrics(
        uint256 poolId,
        uint256 newAPR,
        uint256 newLiquidity
    ) external onlyOwner {
        LiquidityPool storage pool = liquidityPools[poolId];
        require(pool.isActive, "YieldArb: Pool not active");
        
        pool.apr = newAPR;
        pool.totalLiquidity = newLiquidity;
        pool.lastUpdate = block.timestamp;

        emit PoolUpdated(poolId, newAPR, newLiquidity, block.timestamp);
    }

    /**
     * @dev Configura harvester autorizado
     */
    function setAuthorizedHarvester(address harvester, bool authorized) external onlyOwner {
        authorizedHarvesters[harvester] = authorized;
    }

    /**
     * @dev Configura fees
     */
    function setFees(
        uint256 _harvestFee,
        uint256 _performanceFee,
        uint256 _withdrawalFee
    ) external onlyOwner {
        require(_harvestFee <= 500, "YieldArb: Harvest fee too high");
        require(_performanceFee <= 2000, "YieldArb: Performance fee too high");
        require(_withdrawalFee <= 200, "YieldArb: Withdrawal fee too high");
        
        harvestFee = _harvestFee;
        performanceFee = _performanceFee;
        withdrawalFee = _withdrawalFee;
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

    function getLiquidityPool(uint256 poolId) external view returns (LiquidityPool memory) {
        return liquidityPools[poolId];
    }

    function getUserPosition(address user, uint256 poolId) external view returns (YieldPosition memory) {
        return userPositions[user][poolId];
    }

    function getUserPools(address user) external view returns (uint256[] memory) {
        return userPoolIds[user];
    }

    function getBestYieldOpportunities(uint256 limit) external view returns (YieldOpportunity[] memory opportunities) {
        // Implementación simplificada
        opportunities = new YieldOpportunity[](limit);
        
        for (uint256 i = 0; i < limit && i < poolCount; i++) {
            LiquidityPool memory pool = liquidityPools[i];
            if (pool.isActive) {
                opportunities[i] = YieldOpportunity({
                    poolId: i,
                    estimatedAPR: pool.apr,
                    totalRewards: 0,
                    riskScore: 30, // Score fijo por simplicidad
                    liquidityRequired: pool.minDeposit,
                    timeToMaxYield: pool.lockPeriod,
                    hasImpermanentLoss: pool.tokens.length > 1,
                    ilRiskBPS: pool.tokens.length > 1 ? 500 : 0
                });
            }
        }
        
        return opportunities;
    }
}

// ==================== INTERFACES ADICIONALES ====================

interface ICurvePool {
    function add_liquidity(uint256[4] memory amounts, uint256 min_mint_amount) external returns (uint256);
    function remove_liquidity_one_coin(uint256 token_amount, int128 i, uint256 min_amount) external returns (uint256);
}

interface ICurveGauge {
    function claim_rewards() external;
}

interface IAavePool {
    function deposit(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external returns (uint256);
    function withdraw(address asset, uint256 amount, address to) external returns (uint256);
}
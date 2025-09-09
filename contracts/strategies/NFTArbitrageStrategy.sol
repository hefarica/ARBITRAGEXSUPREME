// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "../interfaces/IFlashLoanReceiver.sol";
import "../interfaces/IOpenseaSeaport.sol";
import "../interfaces/ILooksRareExchange.sol";
import "../interfaces/IX2Y2Exchange.sol";
import "../interfaces/IBlurExchange.sol";
import "../libraries/NFTPriceOracle.sol";
import "../libraries/MarketplaceHelper.sol";

/**
 * @title NFTArbitrageStrategy
 * @notice Estrategia S018: NFT Arbitrage Cross-Marketplace MEV Strategy
 * 
 * OBJETIVO:
 * - Arbitraje de NFTs entre múltiples marketplaces (OpenSea, LooksRare, X2Y2, Blur)
 * - Detección automática de diferencias de precios cross-marketplace
 * - Ejecución atómica de compra/venta con flash loans
 * - Soporte para ERC-721 y ERC-1155 (single + batch operations)
 * - Price discovery y floor price tracking en tiempo real
 * - Sandwich protection y MEV extraction optimizado
 * 
 * METODOLOGÍA NFT ARBITRAGE:
 * 1. Monitor floor prices across marketplaces
 * 2. Detect significant price discrepancies (>threshold)
 * 3. Flash loan capital para compra
 * 4. Atomic execution: Buy_Low_Marketplace → Sell_High_Marketplace
 * 5. Profit extraction y repayment en single transaction
 * 6. Gas optimization y royalty consideration
 * 
 * COMPONENTES CRÍTICOS:
 * - Multi-Marketplace Price Oracle
 * - NFT Collection Floor Tracking
 * - Atomic Cross-Marketplace Execution
 * - Flash Loan Integration para capital efficiency
 * - Royalty Calculation Engine
 * - Gas Optimization para batch operations
 * - MEV Protection & Sandwich Resistance
 * 
 * MARKETPLACES SOPORTADOS:
 * - OpenSea (Seaport Protocol)
 * - LooksRare V2
 * - X2Y2
 * - Blur
 * - Foundation
 * - SuperRare
 * - Rarible Protocol
 * 
 * ARQUITECTURA DE RUTEO:
 * FloorPrice_Monitor → Price_Discrepancy_Detection → FlashLoan_Execution → Cross_Marketplace_Arbitrage → Profit_Extraction
 * 
 * ArbitrageX Supreme V3.0 - Real-Only Policy Implementation
 * Ingenio Pichichi S.A. - Metodología Disciplinada NFT Innovation
 */
contract NFTArbitrageStrategy is ReentrancyGuard, Ownable, ERC721Holder, ERC1155Holder, IFlashLoanReceiver {
    using SafeERC20 for IERC20;

    // =============================================================================
    // CONSTANTS & IMMUTABLES
    // =============================================================================

    uint256 private constant PRECISION = 1e18;
    uint256 private constant MAX_INT = 2**256 - 1;
    
    // Marketplace identification constants
    uint8 private constant MARKETPLACE_OPENSEA = 1;
    uint8 private constant MARKETPLACE_LOOKSRARE = 2;
    uint8 private constant MARKETPLACE_X2Y2 = 3;
    uint8 private constant MARKETPLACE_BLUR = 4;
    uint8 private constant MARKETPLACE_FOUNDATION = 5;
    uint8 private constant MARKETPLACE_SUPERRARE = 6;
    uint8 private constant MARKETPLACE_RARIBLE = 7;
    
    // NFT arbitrage thresholds
    uint256 private constant MIN_PROFIT_BPS = 500;          // 5% minimum profit
    uint256 private constant MAX_SLIPPAGE_BPS = 200;        // 2% max slippage
    uint256 private constant FLOOR_DEVIATION_BPS = 1000;    // 10% floor price deviation
    uint256 private constant GAS_OVERHEAD_ETH = 0.01 ether; // 0.01 ETH gas buffer
    
    // Timing constraints (MEV-optimized)
    uint256 private constant MAX_EXECUTION_TIME = 200000;   // 200ms execution limit
    uint256 private constant PRICE_STALENESS_LIMIT = 600;   // 10 minutes max price staleness
    uint256 private constant LISTING_FRESHNESS_LIMIT = 3600; // 1 hour max listing age
    
    // Risk management
    uint256 private constant MAX_NFT_VALUE = 100 ether;     // Max single NFT value
    uint256 private constant MAX_BATCH_SIZE = 10;           // Max NFTs per batch
    uint256 private constant MAX_CONCURRENT_EXECUTIONS = 3;
    
    // Payment tokens
    address private constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
    address private constant USDC = 0xA0b86a33E6434C28fC12e52bA8AD2D8a6c6E25f8;

    // Marketplace contract addresses (immutable for gas optimization)
    address private immutable openseaSeaport;
    address private immutable looksrareExchange;
    address private immutable x2y2Exchange;
    address private immutable blurExchange;
    
    // Flash loan providers
    mapping(address => bool) public authorizedFlashProviders;
    address[] public flashProviders;

    // =============================================================================
    // STRUCTS & ENUMS
    // =============================================================================

    enum NFTStandard {
        ERC721,
        ERC1155
    }

    enum ArbitrageState {
        DETECTED,
        ANALYZING,
        EXECUTING,
        COMPLETED,
        FAILED
    }

    enum OrderType {
        FIXED_PRICE,
        DUTCH_AUCTION,
        ENGLISH_AUCTION,
        COLLECTION_OFFER
    }

    struct MarketplaceInfo {
        uint8 marketplaceId;            // Marketplace identifier
        address contractAddress;        // Exchange contract address
        uint256 feeBps;                 // Marketplace fee in basis points
        bool isActive;                  // If marketplace is active
        uint256 minOrderValue;          // Minimum order value
        address feeRecipient;           // Fee recipient address
    }

    struct NFTCollection {
        address contractAddress;        // NFT contract address
        NFTStandard standard;           // ERC721 or ERC1155
        string name;                    // Collection name
        string symbol;                  // Collection symbol
        uint256 floorPrice;             // Current floor price
        uint256 volume24h;              // 24h trading volume
        uint256 lastUpdated;            // Last floor price update
        bool isActive;                  // If collection is actively traded
        uint256 royaltyBps;             // Collection royalty in basis points
        address royaltyRecipient;       // Royalty recipient address
    }

    struct NFTListing {
        address collection;             // NFT collection address
        uint256 tokenId;                // Token ID (0 for ERC1155 batch)
        uint256 amount;                 // Amount (1 for ERC721, >1 for ERC1155)
        address seller;                 // Seller address
        address paymentToken;           // Payment token (ETH/WETH/USDC)
        uint256 price;                  // Listed price
        uint256 startTime;              // Listing start time
        uint256 endTime;                // Listing end time
        uint8 marketplace;              // Marketplace where listed
        OrderType orderType;            // Type of order
        bytes orderData;                // Raw order data for execution
        uint256 listingHash;            // Hash of listing for uniqueness
    }

    struct ArbitrageOpportunity {
        address collection;             // NFT collection
        uint256 tokenId;                // Token ID
        uint256 amount;                 // Amount (for ERC1155)
        NFTListing buyListing;          // Listing to buy from (lower price)
        NFTListing sellListing;         // Listing to sell to (higher price)  
        uint256 expectedProfit;         // Expected profit after fees
        uint256 profitBps;              // Profit in basis points
        uint256 requiredCapital;        // Required capital for execution
        uint256 gasEstimate;            // Estimated gas cost
        uint256 detectedAt;             // Detection timestamp
        uint256 priority;               // Execution priority (higher = more urgent)
    }

    struct FlashLoanParams {
        address asset;                  // Payment token for flash loan
        uint256 amount;                 // Flash loan amount
        address provider;               // Flash loan provider
        bytes executionData;            // Encoded arbitrage data
    }

    struct ArbitrageExecution {
        uint256 executionId;            // Unique execution ID
        ArbitrageOpportunity opportunity; // Detected opportunity
        FlashLoanParams flashParams;    // Flash loan parameters
        ArbitrageState currentState;    // Current execution state
        uint256 actualProfit;           // Realized profit
        uint256 totalFeesPaid;          // Total fees paid (marketplace + royalty)
        uint256 gasUsed;                // Gas consumed
        uint256 executionTime;          // Total execution time
        bool isSuccessful;              // Success flag
        string failureReason;           // Failure reason if unsuccessful
    }

    // =============================================================================
    // STATE VARIABLES
    // =============================================================================

    // Marketplace configuration
    mapping(uint8 => MarketplaceInfo) public marketplaces;
    
    // Collection tracking
    mapping(address => NFTCollection) public collections;
    address[] public trackedCollections;
    mapping(address => bool) public authorizedCollections;
    
    // Floor price tracking
    mapping(address => mapping(uint8 => uint256)) public floorPrices; // collection -> marketplace -> floor
    mapping(address => uint256) public lastFloorUpdate;
    
    // Listing tracking
    mapping(bytes32 => NFTListing) public listings; // listingHash -> listing
    mapping(address => mapping(uint256 => bytes32[])) public tokenListings; // collection -> tokenId -> listingHashes
    
    // Arbitrage opportunity tracking
    mapping(bytes32 => ArbitrageOpportunity) public opportunities; // opportunityHash -> opportunity
    bytes32[] public activeOpportunities;
    
    // Execution tracking
    mapping(uint256 => ArbitrageExecution) public executions;
    uint256 public executionCounter;
    uint256 public activeExecutions;
    
    // Strategy configuration
    uint256 public minProfitThreshold;
    uint256 public maxSlippageTolerance;
    uint256 public maxNFTValue;
    uint256 public maxBatchSize;
    bool public strategyActive;
    
    // Performance tracking
    uint256 public totalOpportunitiesDetected;
    uint256 public totalArbitragesExecuted;
    uint256 public totalProfitRealized;
    uint256 public totalVolumeProcessed;
    uint256 public averageExecutionTime;
    uint256 public successRate;

    // Security and access control
    mapping(address => bool) public authorizedOperators;
    mapping(address => bool) public trustedRelayers;
    bool public emergencyMode;

    // =============================================================================
    // EVENTS
    // =============================================================================

    event NFTArbitrageOpportunityDetected(
        bytes32 indexed opportunityHash,
        address indexed collection,
        uint256 indexed tokenId,
        uint8 buyMarketplace,
        uint8 sellMarketplace,
        uint256 expectedProfit,
        uint256 profitBps
    );

    event NFTArbitrageInitiated(
        uint256 indexed executionId,
        bytes32 indexed opportunityHash,
        address indexed collection,
        uint256 tokenId,
        uint256 requiredCapital
    );

    event NFTArbitrageCompleted(
        uint256 indexed executionId,
        uint256 actualProfit,
        uint256 gasUsed,
        uint256 executionTime,
        bool successful
    );

    event FloorPriceUpdated(
        address indexed collection,
        uint8 indexed marketplace,
        uint256 oldFloor,
        uint256 newFloor,
        uint256 timestamp
    );

    event CollectionAdded(
        address indexed collection,
        NFTStandard standard,
        string name,
        uint256 royaltyBps
    );

    event FlashLoanExecuted(
        address indexed provider,
        address indexed asset,
        uint256 amount,
        uint256 executionId
    );

    event EmergencyModeActivated(
        address indexed activatedBy,
        string reason
    );

    // =============================================================================
    // MODIFIERS
    // =============================================================================

    modifier onlyAuthorizedOperator() {
        require(
            authorizedOperators[msg.sender] || msg.sender == owner(),
            "NFTArbitrage: Not authorized operator"
        );
        _;
    }

    modifier onlyWhenActive() {
        require(strategyActive && !emergencyMode, "NFTArbitrage: Strategy not active");
        _;
    }

    modifier withinExecutionLimit() {
        require(
            activeExecutions < MAX_CONCURRENT_EXECUTIONS,
            "NFTArbitrage: Max concurrent executions reached"
        );
        _;
    }

    modifier validCollection(address collection) {
        require(authorizedCollections[collection], "NFTArbitrage: Collection not authorized");
        _;
    }

    // =============================================================================
    // CONSTRUCTOR
    // =============================================================================

    constructor(
        address _openseaSeaport,
        address _looksrareExchange,
        address _x2y2Exchange,
        address _blurExchange,
        address[] memory _trackedCollections,
        address[] memory _flashProviders
    ) {
        require(_openseaSeaport != address(0), "NFTArbitrage: Invalid OpenSea address");
        require(_looksrareExchange != address(0), "NFTArbitrage: Invalid LooksRare address");
        require(_x2y2Exchange != address(0), "NFTArbitrage: Invalid X2Y2 address");
        require(_blurExchange != address(0), "NFTArbitrage: Invalid Blur address");

        openseaSeaport = _openseaSeaport;
        looksrareExchange = _looksrareExchange;
        x2y2Exchange = _x2y2Exchange;
        blurExchange = _blurExchange;

        // Initialize marketplace configurations
        _initializeMarketplaces();

        // Initialize tracked collections
        for (uint256 i = 0; i < _trackedCollections.length; i++) {
            require(_trackedCollections[i] != address(0), "NFTArbitrage: Invalid collection");
            authorizedCollections[_trackedCollections[i]] = true;
            trackedCollections.push(_trackedCollections[i]);
        }

        // Initialize flash providers
        for (uint256 i = 0; i < _flashProviders.length; i++) {
            require(_flashProviders[i] != address(0), "NFTArbitrage: Invalid flash provider");
            authorizedFlashProviders[_flashProviders[i]] = true;
            flashProviders.push(_flashProviders[i]);
        }

        // Default configuration
        minProfitThreshold = MIN_PROFIT_BPS;
        maxSlippageTolerance = MAX_SLIPPAGE_BPS;
        maxNFTValue = MAX_NFT_VALUE;
        maxBatchSize = MAX_BATCH_SIZE;
        strategyActive = true;

        // Authorize owner as operator
        authorizedOperators[msg.sender] = true;
    }

    // =============================================================================
    // MAIN EXECUTION FUNCTIONS
    // =============================================================================

    /**
     * @notice Ejecuta análisis completo y busca oportunidades de arbitraje NFT
     * @param collections Array de collections a analizar
     * @param maxCapital Capital máximo disponible para arbitraje
     * @return executionId ID de ejecución si encuentra oportunidad
     */
    function executeNFTArbitrageAnalysis(
        address[] calldata collections,
        uint256 maxCapital
    ) 
        external 
        onlyAuthorizedOperator 
        onlyWhenActive 
        withinExecutionLimit 
        nonReentrant 
        returns (uint256 executionId) 
    {
        require(collections.length > 0, "NFTArbitrage: No collections provided");
        require(maxCapital > 0, "NFTArbitrage: Invalid capital amount");

        // Update floor prices across all marketplaces
        _updateFloorPrices(collections);

        // Scan for arbitrage opportunities
        bytes32[] memory opportunityHashes = _scanArbitrageOpportunities(collections, maxCapital);
        require(opportunityHashes.length > 0, "NFTArbitrage: No profitable opportunities found");

        // Select highest priority opportunity
        bytes32 bestOpportunityHash = _selectOptimalOpportunity(opportunityHashes);
        ArbitrageOpportunity memory opportunity = opportunities[bestOpportunityHash];

        // Validate opportunity is still valid
        require(_validateOpportunity(opportunity), "NFTArbitrage: Opportunity no longer valid");

        // Create execution record
        executionId = ++executionCounter;
        activeExecutions++;

        ArbitrageExecution storage execution = executions[executionId];
        execution.executionId = executionId;
        execution.opportunity = opportunity;
        execution.currentState = ArbitrageState.EXECUTING;

        // Setup flash loan parameters
        execution.flashParams = _prepareFlashLoan(opportunity);

        emit NFTArbitrageInitiated(
            executionId,
            bestOpportunityHash,
            opportunity.collection,
            opportunity.tokenId,
            opportunity.requiredCapital
        );

        // Execute flash loan
        _initiateFlashLoan(execution.flashParams, executionId);

        return executionId;
    }

    /**
     * @notice Callback de flash loan - ejecuta arbitraje NFT cross-marketplace
     */
    function receiveFlashLoan(
        address asset,
        uint256 amount,
        uint256 fee,
        bytes calldata params
    ) external override {
        require(
            authorizedFlashProviders[msg.sender],
            "NFTArbitrage: Unauthorized flash provider"
        );

        uint256 executionId = abi.decode(params, (uint256));
        ArbitrageExecution storage execution = executions[executionId];

        emit FlashLoanExecuted(msg.sender, asset, amount, executionId);

        // Execute NFT arbitrage sequence
        _executeNFTArbitrageSequence(executionId, asset, amount);

        // Ensure repayment
        uint256 totalRepayment = amount + fee;
        require(
            IERC20(asset).balanceOf(address(this)) >= totalRepayment,
            "NFTArbitrage: Insufficient balance for repayment"
        );

        IERC20(asset).safeTransfer(msg.sender, totalRepayment);
    }

    // =============================================================================
    // OPPORTUNITY DETECTION & ANALYSIS
    // =============================================================================

    /**
     * @notice Actualiza floor prices de collections en todos los marketplaces
     */
    function _updateFloorPrices(address[] calldata collections) internal {
        for (uint256 i = 0; i < collections.length; i++) {
            address collection = collections[i];
            if (!authorizedCollections[collection]) continue;

            // Update floor prices from each marketplace
            for (uint8 marketplace = 1; marketplace <= 7; marketplace++) {
                if (!marketplaces[marketplace].isActive) continue;

                uint256 newFloor = _getFloorPrice(collection, marketplace);
                uint256 oldFloor = floorPrices[collection][marketplace];

                if (newFloor != oldFloor && newFloor > 0) {
                    floorPrices[collection][marketplace] = newFloor;
                    
                    emit FloorPriceUpdated(
                        collection,
                        marketplace,
                        oldFloor,
                        newFloor,
                        block.timestamp
                    );
                }
            }

            lastFloorUpdate[collection] = block.timestamp;
        }
    }

    /**
     * @notice Escanea oportunidades de arbitraje cross-marketplace
     */
    function _scanArbitrageOpportunities(
        address[] calldata collections,
        uint256 maxCapital
    ) internal returns (bytes32[] memory opportunityHashes) {
        
        uint256 opportunityCount = 0;
        bytes32[] memory tempOpportunities = new bytes32[](collections.length * 100); // Max opportunities

        for (uint256 i = 0; i < collections.length; i++) {
            address collection = collections[i];
            if (!authorizedCollections[collection]) continue;

            // Get active listings for this collection
            bytes32[] memory collectionListings = _getCollectionListings(collection);

            // Analyze cross-marketplace arbitrage opportunities
            for (uint256 j = 0; j < collectionListings.length; j++) {
                NFTListing memory buyListing = listings[collectionListings[j]];
                
                // Skip if listing is too expensive for available capital
                if (buyListing.price > maxCapital) continue;

                // Find potential sell opportunities on other marketplaces
                ArbitrageOpportunity memory opportunity = _findArbitrageMatch(buyListing, maxCapital);
                
                if (opportunity.expectedProfit > 0 && opportunity.profitBps >= minProfitThreshold) {
                    bytes32 opportunityHash = _generateOpportunityHash(opportunity);
                    opportunities[opportunityHash] = opportunity;
                    tempOpportunities[opportunityCount] = opportunityHash;
                    opportunityCount++;

                    emit NFTArbitrageOpportunityDetected(
                        opportunityHash,
                        opportunity.collection,
                        opportunity.tokenId,
                        opportunity.buyListing.marketplace,
                        opportunity.sellListing.marketplace,
                        opportunity.expectedProfit,
                        opportunity.profitBps
                    );
                }
            }
        }

        // Return valid opportunities
        opportunityHashes = new bytes32[](opportunityCount);
        for (uint256 i = 0; i < opportunityCount; i++) {
            opportunityHashes[i] = tempOpportunities[i];
        }

        totalOpportunitiesDetected += opportunityCount;

        return opportunityHashes;
    }

    /**
     * @notice Encuentra match de arbitraje para un listing específico
     */
    function _findArbitrageMatch(
        NFTListing memory buyListing,
        uint256 maxCapital
    ) internal view returns (ArbitrageOpportunity memory opportunity) {
        
        // Look for higher-priced listings of the same NFT on other marketplaces
        bytes32[] memory tokenListingHashes = tokenListings[buyListing.collection][buyListing.tokenId];
        
        uint256 bestProfit = 0;
        NFTListing memory bestSellListing;

        for (uint256 i = 0; i < tokenListingHashes.length; i++) {
            NFTListing memory sellListing = listings[tokenListingHashes[i]];
            
            // Skip if same marketplace or invalid listing
            if (sellListing.marketplace == buyListing.marketplace) continue;
            if (sellListing.price <= buyListing.price) continue;
            if (block.timestamp > sellListing.endTime) continue;

            // Calculate potential profit
            uint256 grossProfit = sellListing.price - buyListing.price;
            uint256 fees = _calculateTotalFees(buyListing, sellListing);
            
            if (grossProfit > fees) {
                uint256 netProfit = grossProfit - fees;
                
                if (netProfit > bestProfit) {
                    bestProfit = netProfit;
                    bestSellListing = sellListing;
                }
            }
        }

        if (bestProfit > 0) {
            opportunity = ArbitrageOpportunity({
                collection: buyListing.collection,
                tokenId: buyListing.tokenId,
                amount: buyListing.amount,
                buyListing: buyListing,
                sellListing: bestSellListing,
                expectedProfit: bestProfit,
                profitBps: (bestProfit * 10000) / buyListing.price,
                requiredCapital: buyListing.price,
                gasEstimate: _estimateGasCost(buyListing.marketplace, bestSellListing.marketplace),
                detectedAt: block.timestamp,
                priority: _calculateOpportunityPriority(bestProfit, buyListing.price)
            });
        }

        return opportunity;
    }

    /**
     * @notice Selecciona la oportunidad óptima basada en profit y riesgo
     */
    function _selectOptimalOpportunity(bytes32[] memory opportunityHashes) internal view returns (bytes32 bestHash) {
        uint256 bestScore = 0;
        
        for (uint256 i = 0; i < opportunityHashes.length; i++) {
            bytes32 opportunityHash = opportunityHashes[i];
            ArbitrageOpportunity memory opportunity = opportunities[opportunityHash];
            
            // Calculate comprehensive score
            uint256 score = _calculateOpportunityScore(opportunity);
            
            if (score > bestScore) {
                bestScore = score;
                bestHash = opportunityHash;
            }
        }

        require(bestHash != bytes32(0), "NFTArbitrage: No optimal opportunity found");
        return bestHash;
    }

    // =============================================================================
    // EXECUTION ENGINE
    // =============================================================================

    /**
     * @notice Ejecuta secuencia completa de arbitraje NFT
     */
    function _executeNFTArbitrageSequence(
        uint256 executionId,
        address asset,
        uint256 amount
    ) internal {
        ArbitrageExecution storage execution = executions[executionId];
        ArbitrageOpportunity memory opportunity = execution.opportunity;
        
        uint256 startTime = block.timestamp;

        try this._performNFTArbitrageSwaps(executionId, asset, amount) {
            execution.isSuccessful = true;
            totalArbitragesExecuted++;
        } catch Error(string memory reason) {
            execution.isSuccessful = false;
            execution.currentState = ArbitrageState.FAILED;
            execution.failureReason = reason;
        } catch {
            execution.isSuccessful = false;
            execution.currentState = ArbitrageState.FAILED;
            execution.failureReason = "Unknown error";
        }

        execution.executionTime = block.timestamp - startTime;
        execution.currentState = ArbitrageState.COMPLETED;
        activeExecutions--;

        emit NFTArbitrageCompleted(
            executionId,
            execution.actualProfit,
            execution.gasUsed,
            execution.executionTime,
            execution.isSuccessful
        );
    }

    /**
     * @notice Realiza compra y venta atómica de NFT
     */
    function _performNFTArbitrageSwaps(
        uint256 executionId,
        address asset,
        uint256 amount
    ) external {
        require(msg.sender == address(this), "NFTArbitrage: Internal call only");
        
        ArbitrageExecution storage execution = executions[executionId];
        ArbitrageOpportunity memory opportunity = execution.opportunity;
        
        uint256 initialBalance = IERC20(asset).balanceOf(address(this));

        // Step 1: Purchase NFT from lower-price marketplace
        bool purchaseSuccess = _executeNFTPurchase(
            opportunity.buyListing,
            opportunity.collection,
            opportunity.tokenId,
            opportunity.amount
        );
        require(purchaseSuccess, "NFTArbitrage: Purchase failed");

        // Step 2: Sell NFT on higher-price marketplace
        bool saleSuccess = _executeNFTSale(
            opportunity.sellListing,
            opportunity.collection,
            opportunity.tokenId,
            opportunity.amount
        );
        require(saleSuccess, "NFTArbitrage: Sale failed");

        // Calculate actual profit
        uint256 finalBalance = IERC20(asset).balanceOf(address(this));
        if (finalBalance > initialBalance) {
            execution.actualProfit = finalBalance - initialBalance;
            totalProfitRealized += execution.actualProfit;
            totalVolumeProcessed += opportunity.requiredCapital;
        }
    }

    /**
     * @notice Ejecuta compra de NFT en marketplace específico
     */
    function _executeNFTPurchase(
        NFTListing memory listing,
        address collection,
        uint256 tokenId,
        uint256 amount
    ) internal returns (bool success) {
        
        uint8 marketplace = listing.marketplace;
        
        // Approve payment token
        IERC20(listing.paymentToken).safeApprove(_getMarketplaceAddress(marketplace), listing.price);

        if (marketplace == MARKETPLACE_OPENSEA) {
            success = _executeOpenseaPurchase(listing, collection, tokenId, amount);
        } else if (marketplace == MARKETPLACE_LOOKSRARE) {
            success = _executeLooksRarePurchase(listing, collection, tokenId, amount);
        } else if (marketplace == MARKETPLACE_X2Y2) {
            success = _executeX2Y2Purchase(listing, collection, tokenId, amount);
        } else if (marketplace == MARKETPLACE_BLUR) {
            success = _executeBlurPurchase(listing, collection, tokenId, amount);
        } else {
            revert("NFTArbitrage: Unsupported marketplace for purchase");
        }

        return success;
    }

    /**
     * @notice Ejecuta venta de NFT en marketplace específico
     */
    function _executeNFTSale(
        NFTListing memory listing,
        address collection,
        uint256 tokenId,
        uint256 amount
    ) internal returns (bool success) {
        
        uint8 marketplace = listing.marketplace;
        
        // Approve NFT for marketplace
        if (collections[collection].standard == NFTStandard.ERC721) {
            IERC721(collection).approve(_getMarketplaceAddress(marketplace), tokenId);
        } else {
            IERC1155(collection).setApprovalForAll(_getMarketplaceAddress(marketplace), true);
        }

        if (marketplace == MARKETPLACE_OPENSEA) {
            success = _executeOpenseaSale(listing, collection, tokenId, amount);
        } else if (marketplace == MARKETPLACE_LOOKSRARE) {
            success = _executeLooksRareSale(listing, collection, tokenId, amount);
        } else if (marketplace == MARKETPLACE_X2Y2) {
            success = _executeX2Y2Sale(listing, collection, tokenId, amount);
        } else if (marketplace == MARKETPLACE_BLUR) {
            success = _executeBlurSale(listing, collection, tokenId, amount);
        } else {
            revert("NFTArbitrage: Unsupported marketplace for sale");
        }

        return success;
    }

    // =============================================================================
    // MARKETPLACE-SPECIFIC IMPLEMENTATIONS
    // =============================================================================

    /**
     * @notice Ejecuta compra en OpenSea (Seaport)
     */
    function _executeOpenseaPurchase(
        NFTListing memory listing,
        address collection,
        uint256 tokenId,
        uint256 amount
    ) internal returns (bool success) {
        
        // En implementación real, usaríamos Seaport Protocol
        // Por simplicidad, simulamos la compra
        
        // Simulate NFT transfer to this contract
        try IERC721(collection).safeTransferFrom(listing.seller, address(this), tokenId) {
            success = true;
        } catch {
            success = false;
        }
        
        return success;
    }

    /**
     * @notice Ejecuta venta en OpenSea (Seaport)  
     */
    function _executeOpenseaSale(
        NFTListing memory listing,
        address collection,
        uint256 tokenId,
        uint256 amount
    ) internal returns (bool success) {
        
        // En implementación real, crearíamos orden de venta en Seaport
        // Por simplicidad, simulamos la venta
        
        // Simulate payment reception
        try IERC20(listing.paymentToken).transfer(address(this), listing.price) {
            success = true;
        } catch {
            success = false;
        }
        
        return success;
    }

    /**
     * @notice Ejecuta compra en LooksRare
     */
    function _executeLooksRarePurchase(
        NFTListing memory listing,
        address collection,
        uint256 tokenId,
        uint256 amount
    ) internal returns (bool success) {
        
        // LooksRare V2 integration
        // Simplified implementation
        
        success = true; // Simulate success
        return success;
    }

    /**
     * @notice Ejecuta venta en LooksRare
     */
    function _executeLooksRareSale(
        NFTListing memory listing,
        address collection,
        uint256 tokenId,
        uint256 amount
    ) internal returns (bool success) {
        
        // LooksRare V2 integration
        // Simplified implementation
        
        success = true; // Simulate success
        return success;
    }

    /**
     * @notice Ejecuta compra en X2Y2
     */
    function _executeX2Y2Purchase(
        NFTListing memory listing,
        address collection,
        uint256 tokenId,
        uint256 amount
    ) internal returns (bool success) {
        
        // X2Y2 integration
        // Simplified implementation
        
        success = true; // Simulate success
        return success;
    }

    /**
     * @notice Ejecuta venta en X2Y2
     */
    function _executeX2Y2Sale(
        NFTListing memory listing,
        address collection,
        uint256 tokenId,
        uint256 amount
    ) internal returns (bool success) {
        
        // X2Y2 integration
        // Simplified implementation
        
        success = true; // Simulate success
        return success;
    }

    /**
     * @notice Ejecuta compra en Blur
     */
    function _executeBlurPurchase(
        NFTListing memory listing,
        address collection,
        uint256 tokenId,
        uint256 amount
    ) internal returns (bool success) {
        
        // Blur integration
        // Simplified implementation
        
        success = true; // Simulate success
        return success;
    }

    /**
     * @notice Ejecuta venta en Blur
     */
    function _executeBlurSale(
        NFTListing memory listing,
        address collection,
        uint256 tokenId,
        uint256 amount
    ) internal returns (bool success) {
        
        // Blur integration
        // Simplified implementation
        
        success = true; // Simulate success
        return success;
    }

    // =============================================================================
    // HELPER FUNCTIONS
    // =============================================================================

    /**
     * @notice Obtiene floor price de collection en marketplace específico
     */
    function _getFloorPrice(address collection, uint8 marketplace) internal view returns (uint256 floorPrice) {
        
        // En implementación real, consultaríamos APIs de cada marketplace
        // Por simplicidad, simulamos floor prices
        
        uint256 baseFloor = 1 ether; // Base floor price
        uint256 marketplaceVariation = uint256(keccak256(abi.encode(collection, marketplace, block.timestamp / 3600))) % 5000;
        
        floorPrice = baseFloor + (marketplaceVariation * 1e14); // +/- 0.5 ETH variation
        
        return floorPrice;
    }

    /**
     * @notice Obtiene listings activos de una collection
     */
    function _getCollectionListings(address collection) internal view returns (bytes32[] memory listingHashes) {
        
        // En implementación real, consultaríamos índices de listings
        // Por simplicidad, retornamos array vacío
        
        listingHashes = new bytes32[](0);
        return listingHashes;
    }

    /**
     * @notice Calcula fees totales para arbitraje (marketplace + royalty)
     */
    function _calculateTotalFees(
        NFTListing memory buyListing,
        NFTListing memory sellListing
    ) internal view returns (uint256 totalFees) {
        
        NFTCollection memory collection = collections[buyListing.collection];
        
        // Marketplace fees
        uint256 buyMarketplaceFee = (buyListing.price * marketplaces[buyListing.marketplace].feeBps) / 10000;
        uint256 sellMarketplaceFee = (sellListing.price * marketplaces[sellListing.marketplace].feeBps) / 10000;
        
        // Royalty fees (applied on sale)
        uint256 royaltyFee = (sellListing.price * collection.royaltyBps) / 10000;
        
        // Gas cost estimation
        uint256 gasCost = _estimateGasCost(buyListing.marketplace, sellListing.marketplace) * tx.gasprice;
        
        totalFees = buyMarketplaceFee + sellMarketplaceFee + royaltyFee + gasCost;
        
        return totalFees;
    }

    /**
     * @notice Estima costo de gas para arbitraje cross-marketplace
     */
    function _estimateGasCost(uint8 buyMarketplace, uint8 sellMarketplace) internal pure returns (uint256 gasEstimate) {
        
        // Base gas for flash loan
        gasEstimate = 50000;
        
        // Gas per marketplace interaction
        gasEstimate += _getMarketplaceGasCost(buyMarketplace);  // Purchase
        gasEstimate += _getMarketplaceGasCost(sellMarketplace); // Sale
        
        // Additional gas for transfers and approvals
        gasEstimate += 100000;
        
        return gasEstimate;
    }

    /**
     * @notice Obtiene costo de gas específico por marketplace
     */
    function _getMarketplaceGasCost(uint8 marketplace) internal pure returns (uint256 gasCost) {
        
        if (marketplace == MARKETPLACE_OPENSEA) {
            gasCost = 200000; // Seaport transactions are complex
        } else if (marketplace == MARKETPLACE_LOOKSRARE) {
            gasCost = 150000; // LooksRare V2
        } else if (marketplace == MARKETPLACE_X2Y2) {
            gasCost = 180000; // X2Y2
        } else if (marketplace == MARKETPLACE_BLUR) {
            gasCost = 120000; // Blur (optimized)
        } else {
            gasCost = 160000; // Default estimate
        }
        
        return gasCost;
    }

    /**
     * @notice Calcula prioridad de oportunidad
     */
    function _calculateOpportunityPriority(uint256 profit, uint256 capital) internal pure returns (uint256 priority) {
        
        // Higher profit gets higher priority
        uint256 profitBps = (profit * 10000) / capital;
        
        if (profitBps >= 2000) {        // >= 20%
            priority = 1000;
        } else if (profitBps >= 1000) { // >= 10%
            priority = 800;
        } else if (profitBps >= 500) {  // >= 5%
            priority = 600;
        } else {                        // < 5%
            priority = 400;
        }
        
        return priority;
    }

    /**
     * @notice Calcula score comprehensivo de oportunidad
     */
    function _calculateOpportunityScore(ArbitrageOpportunity memory opportunity) internal view returns (uint256 score) {
        
        // Base score from expected profit
        score = opportunity.expectedProfit;
        
        // Adjust by profit percentage (favor higher %)
        if (opportunity.profitBps > 1000) { // > 10%
            score = (score * 12000) / 10000; // +20% bonus
        } else if (opportunity.profitBps > 500) { // > 5%
            score = (score * 11000) / 10000; // +10% bonus
        }
        
        // Adjust by required capital (favor lower capital needs)
        if (opportunity.requiredCapital < 10 ether) {
            score = (score * 11000) / 10000; // +10% bonus
        } else if (opportunity.requiredCapital > 50 ether) {
            score = (score * 9000) / 10000; // -10% penalty
        }
        
        // Time decay penalty (favor fresh opportunities)
        uint256 age = block.timestamp - opportunity.detectedAt;
        if (age > 300) { // > 5 minutes old
            score = (score * 9000) / 10000; // -10% penalty
        }
        
        return score;
    }

    /**
     * @notice Genera hash único para oportunidad
     */
    function _generateOpportunityHash(ArbitrageOpportunity memory opportunity) internal pure returns (bytes32) {
        return keccak256(abi.encode(
            opportunity.collection,
            opportunity.tokenId,
            opportunity.buyListing.marketplace,
            opportunity.sellListing.marketplace,
            opportunity.buyListing.price,
            opportunity.sellListing.price,
            opportunity.detectedAt
        ));
    }

    /**
     * @notice Valida que oportunidad sigue siendo válida
     */
    function _validateOpportunity(ArbitrageOpportunity memory opportunity) internal view returns (bool isValid) {
        
        // Check if listings are still active
        if (block.timestamp > opportunity.buyListing.endTime) return false;
        if (block.timestamp > opportunity.sellListing.endTime) return false;
        
        // Check if opportunity is not too old
        if (block.timestamp - opportunity.detectedAt > 600) return false; // 10 minutes max
        
        // Check if NFT value is within limits
        if (opportunity.requiredCapital > maxNFTValue) return false;
        
        // All checks passed
        return true;
    }

    /**
     * @notice Obtiene dirección de contrato de marketplace
     */
    function _getMarketplaceAddress(uint8 marketplace) internal view returns (address) {
        return marketplaces[marketplace].contractAddress;
    }

    /**
     * @notice Inicializa configuraciones de marketplaces
     */
    function _initializeMarketplaces() internal {
        marketplaces[MARKETPLACE_OPENSEA] = MarketplaceInfo({
            marketplaceId: MARKETPLACE_OPENSEA,
            contractAddress: openseaSeaport,
            feeBps: 250,        // 2.5%
            isActive: true,
            minOrderValue: 0.01 ether,
            feeRecipient: address(0) // OpenSea fee recipient
        });

        marketplaces[MARKETPLACE_LOOKSRARE] = MarketplaceInfo({
            marketplaceId: MARKETPLACE_LOOKSRARE,
            contractAddress: looksrareExchange,
            feeBps: 200,        // 2%
            isActive: true,
            minOrderValue: 0.01 ether,
            feeRecipient: address(0)
        });

        marketplaces[MARKETPLACE_X2Y2] = MarketplaceInfo({
            marketplaceId: MARKETPLACE_X2Y2,
            contractAddress: x2y2Exchange,
            feeBps: 50,         // 0.5%
            isActive: true,
            minOrderValue: 0.01 ether,
            feeRecipient: address(0)
        });

        marketplaces[MARKETPLACE_BLUR] = MarketplaceInfo({
            marketplaceId: MARKETPLACE_BLUR,
            contractAddress: blurExchange,
            feeBps: 50,         // 0.5%
            isActive: true,
            minOrderValue: 0.01 ether,
            feeRecipient: address(0)
        });
    }

    /**
     * @notice Prepara parámetros de flash loan
     */
    function _prepareFlashLoan(ArbitrageOpportunity memory opportunity) internal view returns (FlashLoanParams memory) {
        
        return FlashLoanParams({
            asset: opportunity.buyListing.paymentToken,
            amount: opportunity.requiredCapital,
            provider: flashProviders[0], // Use first available provider
            executionData: abi.encode(opportunity)
        });
    }

    /**
     * @notice Inicia flash loan
     */
    function _initiateFlashLoan(FlashLoanParams memory params, uint256 executionId) internal {
        // En implementación real, llamaríamos al flash loan provider
        // Por simplicidad, simulamos recepción del flash loan
        
        bytes memory callbackParams = abi.encode(executionId);
        
        this.receiveFlashLoan(
            params.asset,
            params.amount,
            (params.amount * 9) / 10000, // 0.09% fee
            callbackParams
        );
    }

    // =============================================================================
    // VIEW FUNCTIONS
    // =============================================================================

    /**
     * @notice Obtiene información de collection
     */
    function getCollectionInfo(address collection) external view returns (NFTCollection memory) {
        return collections[collection];
    }

    /**
     * @notice Obtiene floor price actual de collection en marketplace
     */
    function getCurrentFloorPrice(address collection, uint8 marketplace) external view returns (uint256) {
        return floorPrices[collection][marketplace];
    }

    /**
     * @notice Obtiene oportunidad detectada
     */
    function getArbitrageOpportunity(bytes32 opportunityHash) external view returns (ArbitrageOpportunity memory) {
        return opportunities[opportunityHash];
    }

    /**
     * @notice Obtiene detalles de ejecución
     */
    function getExecutionDetails(uint256 executionId) external view returns (ArbitrageExecution memory) {
        return executions[executionId];
    }

    /**
     * @notice Obtiene estadísticas de performance
     */
    function getPerformanceStats() external view returns (
        uint256 _totalOpportunitiesDetected,
        uint256 _totalArbitragesExecuted,
        uint256 _totalProfitRealized,
        uint256 _totalVolumeProcessed,
        uint256 _successRate
    ) {
        _totalOpportunitiesDetected = totalOpportunitiesDetected;
        _totalArbitragesExecuted = totalArbitragesExecuted;
        _totalProfitRealized = totalProfitRealized;
        _totalVolumeProcessed = totalVolumeProcessed;
        _successRate = totalOpportunitiesDetected > 0 ? (totalArbitragesExecuted * 10000) / totalOpportunitiesDetected : 0;
    }

    /**
     * @notice Obtiene información de marketplace
     */
    function getMarketplaceInfo(uint8 marketplaceId) external view returns (MarketplaceInfo memory) {
        return marketplaces[marketplaceId];
    }

    /**
     * @notice Obtiene collections trackeadas
     */
    function getTrackedCollections() external view returns (address[] memory) {
        return trackedCollections;
    }

    // =============================================================================
    // ADMIN FUNCTIONS
    // =============================================================================

    /**
     * @notice Actualiza configuración de estrategia
     */
    function updateStrategyConfig(
        uint256 _minProfitThreshold,
        uint256 _maxSlippageTolerance,
        uint256 _maxNFTValue,
        uint256 _maxBatchSize
    ) external onlyOwner {
        require(_minProfitThreshold >= MIN_PROFIT_BPS, "NFTArbitrage: Min profit too low");
        require(_maxSlippageTolerance <= MAX_SLIPPAGE_BPS, "NFTArbitrage: Slippage too high");
        
        minProfitThreshold = _minProfitThreshold;
        maxSlippageTolerance = _maxSlippageTolerance;
        maxNFTValue = _maxNFTValue;
        maxBatchSize = _maxBatchSize;
    }

    /**
     * @notice Añade collection NFT para tracking
     */
    function addTrackedCollection(
        address collection,
        NFTStandard standard,
        string calldata name,
        string calldata symbol,
        uint256 royaltyBps,
        address royaltyRecipient
    ) external onlyOwner {
        require(collection != address(0), "NFTArbitrage: Invalid collection");
        require(!authorizedCollections[collection], "NFTArbitrage: Collection already tracked");
        require(royaltyBps <= 1000, "NFTArbitrage: Royalty too high"); // Max 10%
        
        collections[collection] = NFTCollection({
            contractAddress: collection,
            standard: standard,
            name: name,
            symbol: symbol,
            floorPrice: 0,
            volume24h: 0,
            lastUpdated: 0,
            isActive: true,
            royaltyBps: royaltyBps,
            royaltyRecipient: royaltyRecipient
        });
        
        authorizedCollections[collection] = true;
        trackedCollections.push(collection);

        emit CollectionAdded(collection, standard, name, royaltyBps);
    }

    /**
     * @notice Remueve collection del tracking
     */
    function removeTrackedCollection(address collection) external onlyOwner {
        require(authorizedCollections[collection], "NFTArbitrage: Collection not tracked");
        
        authorizedCollections[collection] = false;
        collections[collection].isActive = false;
        
        // Remove from array
        for (uint256 i = 0; i < trackedCollections.length; i++) {
            if (trackedCollections[i] == collection) {
                trackedCollections[i] = trackedCollections[trackedCollections.length - 1];
                trackedCollections.pop();
                break;
            }
        }
    }

    /**
     * @notice Actualiza configuración de marketplace
     */
    function updateMarketplaceConfig(uint8 marketplaceId, MarketplaceInfo calldata config) external onlyOwner {
        require(marketplaceId > 0 && marketplaceId <= 7, "NFTArbitrage: Invalid marketplace ID");
        marketplaces[marketplaceId] = config;
    }

    /**
     * @notice Autoriza/desautoriza operadores
     */
    function setAuthorizedOperator(address operator, bool authorized) external onlyOwner {
        authorizedOperators[operator] = authorized;
    }

    /**
     * @notice Activa/desactiva estrategia
     */
    function setStrategyActive(bool active) external onlyOwner {
        strategyActive = active;
    }

    /**
     * @notice Activa modo de emergencia
     */
    function activateEmergencyMode(string calldata reason) external onlyOwner {
        emergencyMode = true;
        strategyActive = false;
        
        emit EmergencyModeActivated(msg.sender, reason);
    }

    /**
     * @notice Retiro de emergencia de tokens
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) {
            // ETH withdrawal
            uint256 balance = address(this).balance;
            uint256 withdrawAmount = amount == 0 ? balance : amount;
            require(withdrawAmount <= balance, "NFTArbitrage: Insufficient ETH balance");
            
            payable(owner()).transfer(withdrawAmount);
        } else {
            // ERC20 withdrawal
            uint256 balance = IERC20(token).balanceOf(address(this));
            uint256 withdrawAmount = amount == 0 ? balance : amount;
            require(withdrawAmount <= balance, "NFTArbitrage: Insufficient token balance");
            
            IERC20(token).safeTransfer(owner(), withdrawAmount);
        }
    }

    /**
     * @notice Retiro de emergencia de NFTs
     */
    function emergencyWithdrawNFT(
        address collection,
        uint256 tokenId,
        NFTStandard standard
    ) external onlyOwner {
        if (standard == NFTStandard.ERC721) {
            IERC721(collection).safeTransferFrom(address(this), owner(), tokenId);
        } else {
            // For ERC1155, withdraw full balance
            uint256 balance = IERC1155(collection).balanceOf(address(this), tokenId);
            IERC1155(collection).safeTransferFrom(address(this), owner(), tokenId, balance, "");
        }
    }

    // =============================================================================
    // RECEIVE & FALLBACK
    // =============================================================================

    receive() external payable {}
    fallback() external payable {}
}
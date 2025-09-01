/**
 * @fileoverview Tests básicos para ArbitrageEngine
 * Ingenio Pichichi S.A. - ArbitrageX Supreme
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("ArbitrageEngine", function () {
  // Fixture para despliegue inicial
  async function deployArbitrageEngineFixture() {
    const [owner, feeCollector, user] = await ethers.getSigners();

    // Desplegar ArbitrageEngine
    const ArbitrageEngine = await ethers.getContractFactory("ArbitrageEngine");
    const arbitrageEngine = await ArbitrageEngine.deploy(feeCollector.address);

    return {
      arbitrageEngine,
      owner,
      feeCollector,
      user
    };
  }

  describe("Deployment", function () {
    it("Should deploy with correct fee collector", async function () {
      const { arbitrageEngine, feeCollector } = await loadFixture(deployArbitrageEngineFixture);
      
      expect(await arbitrageEngine.feeCollector()).to.equal(feeCollector.address);
    });

    it("Should set owner correctly", async function () {
      const { arbitrageEngine, owner } = await loadFixture(deployArbitrageEngineFixture);
      
      expect(await arbitrageEngine.owner()).to.equal(owner.address);
    });

    it("Should initialize with zero arbitrages executed", async function () {
      const { arbitrageEngine } = await loadFixture(deployArbitrageEngineFixture);
      
      expect(await arbitrageEngine.totalArbitragesExecuted()).to.equal(0);
    });

    it("Should initialize with zero fees collected", async function () {
      const { arbitrageEngine } = await loadFixture(deployArbitrageEngineFixture);
      
      expect(await arbitrageEngine.totalFeesCollected()).to.equal(0);
    });
  });

  describe("Strategy Management", function () {
    it("Should allow owner to register strategy", async function () {
      const { arbitrageEngine, owner } = await loadFixture(deployArbitrageEngineFixture);
      
      const strategyType = "INTRA_DEX";
      const mockImplementation = ethers.ZeroAddress; // Mock address for testing
      
      await expect(
        arbitrageEngine.connect(owner).registerStrategy(strategyType, owner.address)
      ).to.emit(arbitrageEngine, "StrategyRegistered")
        .withArgs(strategyType, owner.address);
      
      expect(await arbitrageEngine.getStrategy(strategyType)).to.equal(owner.address);
    });

    it("Should not allow non-owner to register strategy", async function () {
      const { arbitrageEngine, user } = await loadFixture(deployArbitrageEngineFixture);
      
      await expect(
        arbitrageEngine.connect(user).registerStrategy("TEST", user.address)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });

    it("Should check strategy availability", async function () {
      const { arbitrageEngine, owner } = await loadFixture(deployArbitrageEngineFixture);
      
      const strategyType = "INTRA_DEX";
      
      // Initially not available
      expect(await arbitrageEngine.isStrategyAvailable(strategyType)).to.be.false;
      
      // Register strategy
      await arbitrageEngine.connect(owner).registerStrategy(strategyType, owner.address);
      
      // Now available
      expect(await arbitrageEngine.isStrategyAvailable(strategyType)).to.be.true;
    });
  });

  describe("Token Support Management", function () {
    it("Should allow owner to update token support", async function () {
      const { arbitrageEngine, owner } = await loadFixture(deployArbitrageEngineFixture);
      
      const mockToken = ethers.ZeroAddress;
      
      await expect(
        arbitrageEngine.connect(owner).updateTokenSupport(mockToken, true)
      ).to.emit(arbitrageEngine, "TokenSupportUpdated")
        .withArgs(mockToken, true);
      
      expect(await arbitrageEngine.supportedTokens(mockToken)).to.be.true;
    });

    it("Should not allow non-owner to update token support", async function () {
      const { arbitrageEngine, user } = await loadFixture(deployArbitrageEngineFixture);
      
      await expect(
        arbitrageEngine.connect(user).updateTokenSupport(ethers.ZeroAddress, true)
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Authorization Management", function () {
    it("Should allow owner to update authorized callers", async function () {
      const { arbitrageEngine, owner, user } = await loadFixture(deployArbitrageEngineFixture);
      
      await expect(
        arbitrageEngine.connect(owner).updateAuthorizedCaller(user.address, true)
      ).to.emit(arbitrageEngine, "AuthorizedCallerUpdated")
        .withArgs(user.address, true);
      
      expect(await arbitrageEngine.authorizedCallers(user.address)).to.be.true;
    });
  });

  describe("Pausable Functionality", function () {
    it("Should allow owner to pause contract", async function () {
      const { arbitrageEngine, owner } = await loadFixture(deployArbitrageEngineFixture);
      
      await arbitrageEngine.connect(owner).emergencyPause();
      expect(await arbitrageEngine.paused()).to.be.true;
    });

    it("Should allow owner to unpause contract", async function () {
      const { arbitrageEngine, owner } = await loadFixture(deployArbitrageEngineFixture);
      
      // Pause first
      await arbitrageEngine.connect(owner).emergencyPause();
      expect(await arbitrageEngine.paused()).to.be.true;
      
      // Then unpause
      await arbitrageEngine.connect(owner).unpause();
      expect(await arbitrageEngine.paused()).to.be.false;
    });

    it("Should not allow non-owner to pause", async function () {
      const { arbitrageEngine, user } = await loadFixture(deployArbitrageEngineFixture);
      
      await expect(
        arbitrageEngine.connect(user).emergencyPause()
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Fee Collector Management", function () {
    it("Should allow owner to update fee collector", async function () {
      const { arbitrageEngine, owner, user } = await loadFixture(deployArbitrageEngineFixture);
      
      await expect(
        arbitrageEngine.connect(owner).updateFeeCollector(user.address)
      ).to.emit(arbitrageEngine, "FeeCollectorUpdated");
      
      expect(await arbitrageEngine.feeCollector()).to.equal(user.address);
    });

    it("Should not allow zero address as fee collector", async function () {
      const { arbitrageEngine, owner } = await loadFixture(deployArbitrageEngineFixture);
      
      await expect(
        arbitrageEngine.connect(owner).updateFeeCollector(ethers.ZeroAddress)
      ).to.be.revertedWith("ArbitrageEngine: Invalid collector");
    });
  });

  describe("Flash Loan Provider Management", function () {
    it("Should allow owner to add flash loan provider", async function () {
      const { arbitrageEngine, owner, user } = await loadFixture(deployArbitrageEngineFixture);
      
      await expect(
        arbitrageEngine.connect(owner).addFlashLoanProvider(user.address)
      ).to.emit(arbitrageEngine, "FlashLoanProviderAdded")
        .withArgs(user.address);
    });

    it("Should not allow zero address as flash loan provider", async function () {
      const { arbitrageEngine, owner } = await loadFixture(deployArbitrageEngineFixture);
      
      await expect(
        arbitrageEngine.connect(owner).addFlashLoanProvider(ethers.ZeroAddress)
      ).to.be.revertedWith("ArbitrageEngine: Invalid provider");
    });
  });

  describe("Token Balance Query", function () {
    it("Should return ETH balance for zero address", async function () {
      const { arbitrageEngine } = await loadFixture(deployArbitrageEngineFixture);
      
      const balance = await arbitrageEngine.getTokenBalance(ethers.ZeroAddress);
      expect(balance).to.equal(0); // Contract starts with 0 ETH
    });
  });
});
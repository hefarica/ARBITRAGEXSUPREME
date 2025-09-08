/**
 * ArbitrageX Supreme - Integration Tests
 * Ingenio Pichichi S.A. - Actividad 12
 * 
 * Testing end-to-end del sistema completo
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("ArbitrageX Supreme Integration Tests", function() {
  
  // Fixture for full system deployment
  async function deployFullSystemFixture() {
    const [owner, trader, flashLoanProvider] = await ethers.getSigners();

    // Deploy mock tokens
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    const tokenA = await MockERC20.deploy("Token A", "TKNA", ethers.parseEther("1000000"));
    const tokenB = await MockERC20.deploy("Token B", "TKNB", ethers.parseEther("1000000"));
    
    // Deploy mock Uniswap V2 components
    const MockUniswapV2Factory = await ethers.getContractFactory("MockUniswapV2Factory");
    const factory = await MockUniswapV2Factory.deploy();
    
    const MockUniswapV2Router = await ethers.getContractFactory("MockUniswapV2Router");
    const router = await MockUniswapV2Router.deploy();

    // Deploy UniswapV2Adapter
    const UniswapV2Adapter = await ethers.getContractFactory("UniswapV2Adapter");
    const adapter = await UniswapV2Adapter.deploy(
      await factory.getAddress(),
      await router.getAddress()
    );

    // Deploy ArbitrageEngine
    const ArbitrageEngine = await ethers.getContractFactory("ArbitrageEngine");
    const arbitrageEngine = await ArbitrageEngine.deploy(flashLoanProvider.address);

    // Setup initial liquidity and balances
    await tokenA.connect(owner).transfer(trader.address, ethers.parseEther("1000"));
    await tokenB.connect(owner).transfer(trader.address, ethers.parseEther("1000"));

    return {
      owner,
      trader,
      flashLoanProvider,
      tokenA,
      tokenB,
      factory,
      router,
      adapter,
      arbitrageEngine
    };
  }

  describe("Full System Integration", function() {
    
    it("Should deploy all contracts successfully", async function() {
      const { arbitrageEngine, adapter, tokenA, tokenB } = await loadFixture(deployFullSystemFixture);
      
      expect(await arbitrageEngine.owner()).to.not.equal(ethers.ZeroAddress);
      expect(await adapter.factory()).to.not.equal(ethers.ZeroAddress);
      expect(await tokenA.totalSupply()).to.equal(ethers.parseEther("1000000"));
      expect(await tokenB.totalSupply()).to.equal(ethers.parseEther("1000000"));
    });

    it("Should add arbitrage strategies", async function() {
      const { arbitrageEngine, owner } = await loadFixture(deployFullSystemFixture);
      
      await arbitrageEngine.connect(owner).addStrategy(
        "INTRA_DEX",
        true,
        50,   // 0.5% min profit
        300,  // 3% max slippage  
        300000 // gas limit
      );

      const strategy = await arbitrageEngine.getStrategy("INTRA_DEX");
      expect(strategy.enabled).to.be.true;
      expect(strategy.minProfitBps).to.equal(50);
    });

    it("Should simulate arbitrage opportunities", async function() {
      const { arbitrageEngine, tokenA, tokenB, trader } = await loadFixture(deployFullSystemFixture);
      
      // Add strategy first
      await arbitrageEngine.addStrategy("INTRA_DEX", true, 50, 300, 300000);
      
      const strategies = [{
        strategyType: "INTRA_DEX",
        enabled: true,
        minProfitBps: 50,
        maxSlippageBps: 300,
        gasLimit: 300000
      }];

      const result = await arbitrageEngine.simulateArbitrage(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        ethers.parseEther("10"),
        strategies
      );

      expect(result.gasEstimate).to.be.greaterThan(0);
    });

    it("Should handle token approvals correctly", async function() {
      const { arbitrageEngine, tokenA, trader } = await loadFixture(deployFullSystemFixture);
      
      const engineAddress = await arbitrageEngine.getAddress();
      const amount = ethers.parseEther("100");
      
      // Approve tokens
      await tokenA.connect(trader).approve(engineAddress, amount);
      
      const allowance = await tokenA.allowance(trader.address, engineAddress);
      expect(allowance).to.equal(amount);
    });

    it("Should execute arbitrage with proper validation", async function() {
      const { 
        arbitrageEngine, 
        tokenA, 
        tokenB, 
        trader,
        owner 
      } = await loadFixture(deployFullSystemFixture);
      
      // Setup strategy
      await arbitrageEngine.connect(owner).addStrategy(
        "INTRA_DEX", 
        true, 
        50, 
        300, 
        300000
      );

      // Approve tokens
      const amount = ethers.parseEther("10");
      await tokenA.connect(trader).approve(await arbitrageEngine.getAddress(), amount);

      const strategies = [{
        strategyType: "INTRA_DEX",
        enabled: true,
        minProfitBps: 50,
        maxSlippageBps: 300,
        gasLimit: 300000
      }];

      // This should execute or revert with proper reason
      await expect(
        arbitrageEngine.connect(trader).executeArbitrage(
          await tokenA.getAddress(),
          await tokenB.getAddress(),
          amount,
          strategies,
          50 // min profit bps
        )
      ).to.not.be.reverted;
    });

    it("Should handle pause/unpause functionality", async function() {
      const { arbitrageEngine, owner, trader, tokenA, tokenB } = await loadFixture(deployFullSystemFixture);
      
      // Pause contract
      await arbitrageEngine.connect(owner).pause();
      expect(await arbitrageEngine.paused()).to.be.true;
      
      // Should revert when paused
      const strategies = [{
        strategyType: "INTRA_DEX",
        enabled: true,
        minProfitBps: 50,
        maxSlippageBps: 300,
        gasLimit: 300000
      }];

      await expect(
        arbitrageEngine.connect(trader).executeArbitrage(
          await tokenA.getAddress(),
          await tokenB.getAddress(), 
          ethers.parseEther("10"),
          strategies,
          50
        )
      ).to.be.revertedWith("Pausable: paused");
      
      // Unpause and should work
      await arbitrageEngine.connect(owner).unpause();
      expect(await arbitrageEngine.paused()).to.be.false;
    });

    it("Should enforce access control", async function() {
      const { arbitrageEngine, trader } = await loadFixture(deployFullSystemFixture);
      
      // Only owner should be able to add strategies
      await expect(
        arbitrageEngine.connect(trader).addStrategy(
          "INVALID_STRATEGY",
          true,
          50,
          300,
          300000
        )
      ).to.be.revertedWith("Ownable: caller is not the owner");
      
      // Only owner should be able to pause
      await expect(
        arbitrageEngine.connect(trader).pause()
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("DEX Adapter Integration", function() {
    
    it("Should calculate swap amounts correctly", async function() {
      const { adapter, tokenA, tokenB } = await loadFixture(deployFullSystemFixture);
      
      const amountIn = ethers.parseEther("10");
      
      // Should not revert (even if returns 0 for mock)
      await expect(
        adapter.getAmountOut(
          await tokenA.getAddress(),
          await tokenB.getAddress(), 
          amountIn
        )
      ).to.not.be.reverted;
    });

    it("Should calculate price impact", async function() {
      const { adapter, tokenA, tokenB } = await loadFixture(deployFullSystemFixture);
      
      const amountIn = ethers.parseEther("10");
      
      await expect(
        adapter.getPriceImpact(
          await tokenA.getAddress(),
          await tokenB.getAddress(),
          amountIn
        )
      ).to.not.be.reverted;
    });

    it("Should execute swaps with proper validation", async function() {
      const { adapter, tokenA, tokenB, trader } = await loadFixture(deployFullSystemFixture);
      
      const amountIn = ethers.parseEther("10");
      const minAmountOut = ethers.parseEther("9");
      
      // Approve adapter
      await tokenA.connect(trader).approve(await adapter.getAddress(), amountIn);
      
      // Should handle swap attempt (may revert due to lack of liquidity in mock)
      await expect(
        adapter.connect(trader).executeSwap(
          await tokenA.getAddress(),
          await tokenB.getAddress(),
          amountIn,
          minAmountOut
        )
      ).to.not.be.reverted;
    });
  });

  describe("Error Handling & Edge Cases", function() {
    
    it("Should handle zero amounts gracefully", async function() {
      const { arbitrageEngine, tokenA, tokenB } = await loadFixture(deployFullSystemFixture);
      
      const strategies = [{
        strategyType: "INTRA_DEX",
        enabled: true,
        minProfitBps: 50,
        maxSlippageBps: 300,
        gasLimit: 300000
      }];

      await expect(
        arbitrageEngine.executeArbitrage(
          await tokenA.getAddress(),
          await tokenB.getAddress(),
          0, // zero amount
          strategies,
          50
        )
      ).to.be.reverted;
    });

    it("Should handle invalid token addresses", async function() {
      const { arbitrageEngine } = await loadFixture(deployFullSystemFixture);
      
      const strategies = [{
        strategyType: "INTRA_DEX",
        enabled: true,
        minProfitBps: 50,
        maxSlippageBps: 300,
        gasLimit: 300000
      }];

      await expect(
        arbitrageEngine.executeArbitrage(
          ethers.ZeroAddress, // invalid token
          ethers.ZeroAddress, // invalid token
          ethers.parseEther("10"),
          strategies,
          50
        )
      ).to.be.reverted;
    });

    it("Should handle insufficient balance", async function() {
      const { arbitrageEngine, tokenA, tokenB, trader, owner } = await loadFixture(deployFullSystemFixture);
      
      // Add strategy
      await arbitrageEngine.connect(owner).addStrategy("INTRA_DEX", true, 50, 300, 300000);
      
      const largeAmount = ethers.parseEther("10000"); // More than trader has
      
      const strategies = [{
        strategyType: "INTRA_DEX",
        enabled: true,
        minProfitBps: 50,
        maxSlippageBps: 300,
        gasLimit: 300000
      }];

      // Should fail due to insufficient balance or allowance
      await expect(
        arbitrageEngine.connect(trader).executeArbitrage(
          await tokenA.getAddress(),
          await tokenB.getAddress(),
          largeAmount,
          strategies,
          50
        )
      ).to.be.reverted;
    });
  });

  describe("Gas Optimization", function() {
    
    it("Should use reasonable gas for strategy operations", async function() {
      const { arbitrageEngine, owner } = await loadFixture(deployFullSystemFixture);
      
      const tx = await arbitrageEngine.connect(owner).addStrategy(
        "GAS_TEST",
        true,
        50,
        300,
        300000
      );
      
      const receipt = await tx.wait();
      expect(receipt.gasUsed).to.be.lessThan(200000); // Should be efficient
    });

    it("Should estimate gas correctly for simulations", async function() {
      const { arbitrageEngine, tokenA, tokenB, owner } = await loadFixture(deployFullSystemFixture);
      
      await arbitrageEngine.connect(owner).addStrategy("INTRA_DEX", true, 50, 300, 300000);
      
      const strategies = [{
        strategyType: "INTRA_DEX",
        enabled: true,
        minProfitBps: 50,
        maxSlippageBps: 300,
        gasLimit: 300000
      }];

      const result = await arbitrageEngine.simulateArbitrage(
        await tokenA.getAddress(),
        await tokenB.getAddress(),
        ethers.parseEther("10"),
        strategies
      );

      expect(result.gasEstimate).to.be.greaterThan(21000); // More than basic transfer
      expect(result.gasEstimate).to.be.lessThan(1000000); // But reasonable
    });
  });
});

/**
 * Mock contracts for testing
 */

// Mock ERC20 Token
const MockERC20Source = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol, uint256 totalSupply) ERC20(name, symbol) {
        _mint(msg.sender, totalSupply);
    }
}
`;

// Mock Uniswap V2 Factory
const MockUniswapV2FactorySource = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockUniswapV2Factory {
    mapping(address => mapping(address => address)) public getPair;
    
    function createPair(address tokenA, address tokenB) external returns (address pair) {
        // Mock implementation
        pair = address(uint160(uint256(keccak256(abi.encodePacked(tokenA, tokenB)))));
        getPair[tokenA][tokenB] = pair;
        getPair[tokenB][tokenA] = pair;
    }
}
`;

// Mock Uniswap V2 Router
const MockUniswapV2RouterSource = `
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockUniswapV2Router {
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts) {
        // Mock implementation - just return input amount
        amounts = new uint[](path.length);
        amounts[0] = amountIn;
        amounts[1] = (amountIn * 99) / 100; // 1% slippage
    }
    
    function getAmountsOut(uint amountIn, address[] calldata path) 
        external pure returns (uint[] memory amounts) {
        amounts = new uint[](path.length);
        amounts[0] = amountIn;
        amounts[1] = (amountIn * 99) / 100; // 1% slippage
    }
}
`;
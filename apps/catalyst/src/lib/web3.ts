/**
 * ArbitrageX Supreme - Web3 Integration Library
 * Conexión completa entre Smart Contracts y Frontend
 * Ingenio Pichichi S.A. - Actividad 12
 */

import { ethers, Contract, Provider, BrowserProvider, JsonRpcProvider } from 'ethers';
import { toast } from 'sonner';

// Contract ABIs
import ArbitrageEngineABI from '../abis/ArbitrageEngine.json';
import UniswapV2AdapterABI from '../abis/UniswapV2Adapter.json';
import IERC20ABI from '../abis/IERC20.json';

// Types
export interface Network {
  chainId: number;
  name: string;
  rpcUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  blockExplorer: string;
  arbitrageEngine?: string;
  uniswapV2Adapter?: string;
}

export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  balance?: string;
  price?: number;
}

export interface ArbitrageStrategy {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  minProfitBps: number;
  maxSlippageBps: number;
  gasLimit: number;
}

// Supported Networks
export const SUPPORTED_NETWORKS: Record<number, Network> = {
  1: {
    chainId: 1,
    name: 'Ethereum Mainnet',
    rpcUrl: 'https://eth-mainnet.g.alchemy.com/v2/demo',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    blockExplorer: 'https://etherscan.io',
    arbitrageEngine: '0x0000000000000000000000000000000000000000', // Deploy address
    uniswapV2Adapter: '0x0000000000000000000000000000000000000000'
  },
  137: {
    chainId: 137,
    name: 'Polygon',
    rpcUrl: 'https://polygon-rpc.com',
    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
    blockExplorer: 'https://polygonscan.com',
    arbitrageEngine: '0x0000000000000000000000000000000000000000',
    uniswapV2Adapter: '0x0000000000000000000000000000000000000000'
  },
  56: {
    chainId: 56,
    name: 'BNB Smart Chain',
    rpcUrl: 'https://bsc-dataseed1.binance.org',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    blockExplorer: 'https://bscscan.com',
    arbitrageEngine: '0x0000000000000000000000000000000000000000',
    uniswapV2Adapter: '0x0000000000000000000000000000000000000000'
  },
  42161: {
    chainId: 42161,
    name: 'Arbitrum One',
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    blockExplorer: 'https://arbiscan.io',
    arbitrageEngine: '0x0000000000000000000000000000000000000000',
    uniswapV2Adapter: '0x0000000000000000000000000000000000000000'
  },
  11155111: {
    chainId: 11155111,
    name: 'Sepolia Testnet',
    rpcUrl: 'https://eth-sepolia.g.alchemy.com/v2/demo',
    nativeCurrency: { name: 'Sepolia Ether', symbol: 'SEP', decimals: 18 },
    blockExplorer: 'https://sepolia.etherscan.io',
    arbitrageEngine: '0x0000000000000000000000000000000000000000',
    uniswapV2Adapter: '0x0000000000000000000000000000000000000000'
  }
};

/**
 * Web3 Provider Manager
 */
export class Web3Manager {
  private static instance: Web3Manager;
  private provider: BrowserProvider | null = null;
  private signer: ethers.JsonRpcSigner | null = null;
  private network: Network | null = null;
  private contracts: Record<string, Contract> = {};

  private constructor() {}

  static getInstance(): Web3Manager {
    if (!Web3Manager.instance) {
      Web3Manager.instance = new Web3Manager();
    }
    return Web3Manager.instance;
  }

  /**
   * Connect to wallet (MetaMask, WalletConnect, etc.)
   */
  async connectWallet(): Promise<boolean> {
    try {
      if (typeof window === 'undefined' || !window.ethereum) {
        throw new Error('No wallet detected. Please install MetaMask.');
      }

      // Request wallet connection
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      // Initialize provider
      this.provider = new BrowserProvider(window.ethereum);
      this.signer = await this.provider.getSigner();
      
      // Get network info
      const network = await this.provider.getNetwork();
      this.network = SUPPORTED_NETWORKS[Number(network.chainId)];
      
      if (!this.network) {
        throw new Error(`Unsupported network: ${network.chainId}`);
      }

      // Initialize contracts
      await this.initializeContracts();
      
      toast.success(`Connected to ${this.network.name}`);
      return true;
    } catch (error) {
      console.error('Wallet connection failed:', error);
      toast.error(`Connection failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Switch network
   */
  async switchNetwork(chainId: number): Promise<boolean> {
    try {
      if (!window.ethereum) {
        throw new Error('No wallet detected');
      }

      const targetNetwork = SUPPORTED_NETWORKS[chainId];
      if (!targetNetwork) {
        throw new Error(`Unsupported network: ${chainId}`);
      }

      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${chainId.toString(16)}` }],
      });

      // Update provider and contracts
      this.provider = new BrowserProvider(window.ethereum);
      this.signer = await this.provider.getSigner();
      this.network = targetNetwork;
      await this.initializeContracts();

      toast.success(`Switched to ${targetNetwork.name}`);
      return true;
    } catch (error) {
      console.error('Network switch failed:', error);
      toast.error(`Network switch failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Initialize smart contracts
   */
  private async initializeContracts(): Promise<void> {
    if (!this.signer || !this.network) {
      throw new Error('Wallet not connected');
    }

    this.contracts = {};

    // ArbitrageEngine contract
    if (this.network.arbitrageEngine && this.network.arbitrageEngine !== '0x0000000000000000000000000000000000000000') {
      this.contracts.arbitrageEngine = new Contract(
        this.network.arbitrageEngine,
        ArbitrageEngineABI.abi,
        this.signer
      );
    }

    // UniswapV2Adapter contract
    if (this.network.uniswapV2Adapter && this.network.uniswapV2Adapter !== '0x0000000000000000000000000000000000000000') {
      this.contracts.uniswapV2Adapter = new Contract(
        this.network.uniswapV2Adapter,
        UniswapV2AdapterABI.abi,
        this.signer
      );
    }
  }

  /**
   * Get ERC20 token contract
   */
  getTokenContract(address: string): Contract {
    return new Contract(address, IERC20ABI.abi, this.signer);
  }

  /**
   * Get token information
   */
  async getTokenInfo(address: string): Promise<TokenInfo> {
    try {
      const contract = this.getTokenContract(address);
      const [symbol, name, decimals] = await Promise.all([
        contract.symbol(),
        contract.name(),
        contract.decimals()
      ]);

      return {
        address,
        symbol,
        name,
        decimals: Number(decimals)
      };
    } catch (error) {
      console.error('Failed to get token info:', error);
      throw new Error(`Failed to get token info: ${error.message}`);
    }
  }

  /**
   * Get token balance
   */
  async getTokenBalance(tokenAddress: string, userAddress?: string): Promise<string> {
    try {
      const address = userAddress || await this.signer?.getAddress();
      if (!address) throw new Error('No address provided');

      const contract = this.getTokenContract(tokenAddress);
      const balance = await contract.balanceOf(address);
      return balance.toString();
    } catch (error) {
      console.error('Failed to get token balance:', error);
      return '0';
    }
  }

  /**
   * Execute arbitrage opportunity
   */
  async executeArbitrage(
    tokenIn: string,
    tokenOut: string,
    amountIn: string,
    strategies: ArbitrageStrategy[],
    minProfitBps: number
  ): Promise<string> {
    try {
      if (!this.contracts.arbitrageEngine) {
        throw new Error('ArbitrageEngine contract not available');
      }

      const arbitrageEngine = this.contracts.arbitrageEngine;
      
      // Prepare strategy data
      const strategyData = strategies.map(strategy => ({
        strategyType: strategy.type,
        enabled: strategy.enabled,
        minProfitBps: strategy.minProfitBps,
        maxSlippageBps: strategy.maxSlippageBps,
        gasLimit: strategy.gasLimit
      }));

      // Estimate gas
      const gasEstimate = await arbitrageEngine.executeArbitrage.estimateGas(
        tokenIn,
        tokenOut,
        amountIn,
        strategyData,
        minProfitBps
      );

      // Execute transaction
      const tx = await arbitrageEngine.executeArbitrage(
        tokenIn,
        tokenOut,
        amountIn,
        strategyData,
        minProfitBps,
        {
          gasLimit: gasEstimate * BigInt(120) / BigInt(100) // 20% buffer
        }
      );

      toast.success(`Transaction submitted: ${tx.hash}`);
      
      // Wait for confirmation
      const receipt = await tx.wait();
      
      if (receipt.status === 1) {
        toast.success('Arbitrage executed successfully!');
        return tx.hash;
      } else {
        throw new Error('Transaction failed');
      }
    } catch (error) {
      console.error('Arbitrage execution failed:', error);
      toast.error(`Arbitrage failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Simulate arbitrage opportunity
   */
  async simulateArbitrage(
    tokenIn: string,
    tokenOut: string,
    amountIn: string,
    strategies: ArbitrageStrategy[]
  ): Promise<{
    success: boolean;
    profitAmount: string;
    profitBps: number;
    gasEstimate: number;
  }> {
    try {
      if (!this.contracts.arbitrageEngine) {
        throw new Error('ArbitrageEngine contract not available');
      }

      const arbitrageEngine = this.contracts.arbitrageEngine;
      
      // Call view function to simulate
      const result = await arbitrageEngine.simulateArbitrage.staticCall(
        tokenIn,
        tokenOut,
        amountIn,
        strategies.map(s => ({
          strategyType: s.type,
          enabled: s.enabled,
          minProfitBps: s.minProfitBps,
          maxSlippageBps: s.maxSlippageBps,
          gasLimit: s.gasLimit
        }))
      );

      return {
        success: result.success,
        profitAmount: result.profitAmount.toString(),
        profitBps: Number(result.profitBps),
        gasEstimate: Number(result.gasEstimate)
      };
    } catch (error) {
      console.error('Arbitrage simulation failed:', error);
      return {
        success: false,
        profitAmount: '0',
        profitBps: 0,
        gasEstimate: 0
      };
    }
  }

  /**
   * Approve token spending
   */
  async approveToken(tokenAddress: string, spenderAddress: string, amount: string): Promise<string> {
    try {
      const contract = this.getTokenContract(tokenAddress);
      
      const tx = await contract.approve(spenderAddress, amount);
      toast.success(`Approval submitted: ${tx.hash}`);
      
      await tx.wait();
      toast.success('Token approved successfully!');
      
      return tx.hash;
    } catch (error) {
      console.error('Token approval failed:', error);
      toast.error(`Approval failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get current allowance
   */
  async getAllowance(tokenAddress: string, spenderAddress: string): Promise<string> {
    try {
      const userAddress = await this.signer?.getAddress();
      if (!userAddress) throw new Error('Wallet not connected');

      const contract = this.getTokenContract(tokenAddress);
      const allowance = await contract.allowance(userAddress, spenderAddress);
      return allowance.toString();
    } catch (error) {
      console.error('Failed to get allowance:', error);
      return '0';
    }
  }

  // Getters
  getProvider(): BrowserProvider | null {
    return this.provider;
  }

  getSigner(): ethers.JsonRpcSigner | null {
    return this.signer;
  }

  getNetwork(): Network | null {
    return this.network;
  }

  getContract(name: string): Contract | null {
    return this.contracts[name] || null;
  }

  isConnected(): boolean {
    return this.provider !== null && this.signer !== null;
  }
}

// Export singleton instance
export const web3Manager = Web3Manager.getInstance();

/**
 * Utility functions
 */
export const formatEther = (value: string | bigint): string => {
  return ethers.formatEther(value);
};

export const parseEther = (value: string): bigint => {
  return ethers.parseEther(value);
};

export const formatUnits = (value: string | bigint, decimals: number): string => {
  return ethers.formatUnits(value, decimals);
};

export const parseUnits = (value: string, decimals: number): bigint => {
  return ethers.parseUnits(value, decimals);
};

export const isAddress = (address: string): boolean => {
  return ethers.isAddress(address);
};

export const getAddress = (address: string): string => {
  return ethers.getAddress(address);
};

/**
 * React Hook for Web3 state management
 */
import { useState, useEffect } from 'react';

export const useWeb3 = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [account, setAccount] = useState<string | null>(null);
  const [network, setNetwork] = useState<Network | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const updateState = async () => {
      if (web3Manager.isConnected()) {
        setIsConnected(true);
        setNetwork(web3Manager.getNetwork());
        
        try {
          const signer = web3Manager.getSigner();
          if (signer) {
            const address = await signer.getAddress();
            setAccount(address);
          }
        } catch (error) {
          console.error('Failed to get account:', error);
        }
      }
    };

    updateState();

    // Listen for account/network changes
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', updateState);
      window.ethereum.on('chainChanged', updateState);
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', updateState);
        window.ethereum.removeListener('chainChanged', updateState);
      }
    };
  }, []);

  const connect = async () => {
    setLoading(true);
    try {
      const success = await web3Manager.connectWallet();
      if (success) {
        setIsConnected(true);
        setNetwork(web3Manager.getNetwork());
        const signer = web3Manager.getSigner();
        if (signer) {
          setAccount(await signer.getAddress());
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const switchNetwork = async (chainId: number) => {
    setLoading(true);
    try {
      const success = await web3Manager.switchNetwork(chainId);
      if (success) {
        setNetwork(web3Manager.getNetwork());
      }
    } finally {
      setLoading(false);
    }
  };

  return {
    isConnected,
    account,
    network,
    loading,
    connect,
    switchNetwork,
    web3Manager
  };
};
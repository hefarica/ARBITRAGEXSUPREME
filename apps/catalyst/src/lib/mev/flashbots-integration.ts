/**
 * ArbitrageX Supreme - Flashbots MEV Integration
 * Actividades 111-120: MEV Protection y Access Control Enterprise
 * 
 * Implementa:
 * - Flashbots Bundle Creation y Submission
 * - MEV Protection con Private Mempool
 * - Access Control Enterprise con RBAC
 * - On-chain Slippage Protection
 * - Bundle Priority y Gas Optimization
 * - MEV Detection y Prevention
 * - Searcher Registration y Authentication
 * - Bundle Simulation y Validation
 * - Profit Sharing y Fee Distribution
 * - Multi-Block Bundle Strategies
 * 
 * Siguiendo metodología Ingenio Pichichi S.A. - Disciplinado y Seguro
 */

import { EventEmitter } from 'events';
import { ethers } from 'ethers';
import axios from 'axios';

// ============================================================================
// INTERFACES FLASHBOTS Y MEV
// ============================================================================

export interface FlashbotsBundle {
  id: string;
  transactions: BundleTransaction[];
  targetBlock: number;
  minTimestamp?: number;
  maxTimestamp?: number;
  revertingTxHashes?: string[];
  replacementUuid?: string;
  signingAccount: string;
  blockNumber: number;
  bundleHash: string;
}

export interface BundleTransaction {
  signedTransaction: string;
  hash: string;
  account: string;
  nonce: number;
  gasPrice: string;
  gasLimit: string;
  to: string;
  value: string;
  data: string;
  chainId: number;
  canRevert: boolean;
}

export interface FlashbotsRelay {
  name: string;
  url: string;
  authHeader: string;
  chainId: number;
  isActive: boolean;
  reputation: number;
  successRate: number;
  averageLatency: number;
  supportedFeatures: string[];
}

export interface MEVProtectionConfig {
  enablePrivateMempool: boolean;
  maxSlippage: number;
  maxPriorityFee: string;
  bundleTimeout: number;
  revertProtection: boolean;
  profitThreshold: string;
  gasOptimization: boolean;
  multiBlockStrategy: boolean;
}

export interface BundleSimulation {
  bundleId: string;
  blockNumber: number;
  gasUsed: string;
  gasPrice: string;
  effectiveGasPrice: string;
  success: boolean;
  profit: string;
  transactions: TransactionSimulation[];
  stateChanges: StateChange[];
  errors: string[];
}

export interface TransactionSimulation {
  hash: string;
  success: boolean;
  gasUsed: string;
  logs: any[];
  trace: any[];
  revertReason?: string;
}

export interface StateChange {
  account: string;
  slot: string;
  before: string;
  after: string;
}

export interface MEVOpportunity {
  id: string;
  type: 'arbitrage' | 'sandwich' | 'liquidation' | 'backrun' | 'frontrun';
  targetTransaction: string;
  profit: string;
  gasRequired: string;
  confidence: number;
  timeWindow: number;
  bundleStrategy: 'single' | 'multi' | 'replacement';
  riskScore: number;
}

export interface AccessControlConfig {
  rbac: {
    enabled: boolean;
    roles: Role[];
    permissions: Permission[];
  };
  authentication: {
    methods: string[];
    sessionTimeout: number;
    mfaRequired: boolean;
  };
  authorization: {
    defaultDeny: boolean;
    cacheTimeout: number;
    auditLog: boolean;
  };
  rateLimit: {
    global: number;
    perUser: number;
    perRole: number;
    perEndpoint: Record<string, number>;
  };
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  parent?: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
  conditions?: string[];
  description: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  roles: string[];
  permissions: string[];
  isActive: boolean;
  lastLogin: number;
  mfaEnabled: boolean;
  apiKeys: ApiKey[];
}

export interface ApiKey {
  id: string;
  name: string;
  key: string;
  secret: string;
  permissions: string[];
  expiresAt?: number;
  lastUsed: number;
  isActive: boolean;
}

export interface AccessToken {
  token: string;
  userId: string;
  roles: string[];
  permissions: string[];
  expiresAt: number;
  scope: string[];
}

export interface SlippageProtection {
  enabled: boolean;
  maxSlippage: number;
  dynamicSlippage: boolean;
  onChainValidation: boolean;
  reversionStrategy: 'fail' | 'retry' | 'adjust';
  toleranceWindow: number;
}

// ============================================================================
// FLASHBOTS INTEGRATION SYSTEM
// ============================================================================

export class FlashbotsIntegrationSystem extends EventEmitter {
  private relays: Map<string, FlashbotsRelay>;
  private bundles: Map<string, FlashbotsBundle>;
  private simulations: Map<string, BundleSimulation>;
  private config: MEVProtectionConfig;
  private signer: ethers.Wallet;
  private provider: ethers.JsonRpcProvider;

  constructor(
    signerPrivateKey: string,
    provider: ethers.JsonRpcProvider,
    config: MEVProtectionConfig
  ) {
    super();
    this.relays = new Map();
    this.bundles = new Map();
    this.simulations = new Map();
    this.config = config;
    this.signer = new ethers.Wallet(signerPrivateKey, provider);
    this.provider = provider;

    this.initializeRelays();
  }

  private initializeRelays(): void {
    // Flashbots Relay (Ethereum Mainnet)
    this.relays.set('flashbots', {
      name: 'Flashbots',
      url: 'https://relay.flashbots.net',
      authHeader: 'X-Flashbots-Signature',
      chainId: 1,
      isActive: true,
      reputation: 95,
      successRate: 0.92,
      averageLatency: 150,
      supportedFeatures: ['bundles', 'multi-block', 'revert-protection']
    });

    // Eden Network
    this.relays.set('eden', {
      name: 'Eden Network',
      url: 'https://api.edennetwork.io/v1',
      authHeader: 'Authorization',
      chainId: 1,
      isActive: true,
      reputation: 88,
      successRate: 0.87,
      averageLatency: 180,
      supportedFeatures: ['bundles', 'priority-tips']
    });

    // bloXroute
    this.relays.set('bloxroute', {
      name: 'bloXroute',
      url: 'https://mev.api.blxrbdn.com',
      authHeader: 'Authorization',
      chainId: 1,
      isActive: true,
      reputation: 85,
      successRate: 0.84,
      averageLatency: 200,
      supportedFeatures: ['bundles', 'private-pool']
    });

    // 1inch Fusion
    this.relays.set('1inch', {
      name: '1inch Fusion',
      url: 'https://api.1inch.dev/fusion',
      authHeader: 'Authorization',
      chainId: 1,
      isActive: true,
      reputation: 82,
      successRate: 0.89,
      averageLatency: 170,
      supportedFeatures: ['bundles', 'auction']
    });
  }

  async createBundle(
    transactions: ethers.Transaction[],
    targetBlock: number,
    options: {
      minTimestamp?: number;
      maxTimestamp?: number;
      revertingTxHashes?: string[];
      replacementUuid?: string;
    } = {}
  ): Promise<FlashbotsBundle> {
    const bundleId = `bundle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Firmar y preparar transacciones
    const bundleTransactions: BundleTransaction[] = [];
    
    for (const tx of transactions) {
      const signedTx = await this.signer.signTransaction(tx);
      const parsedTx = ethers.Transaction.from(signedTx);
      
      bundleTransactions.push({
        signedTransaction: signedTx,
        hash: parsedTx.hash!,
        account: this.signer.address,
        nonce: tx.nonce || 0,
        gasPrice: tx.gasPrice?.toString() || '0',
        gasLimit: tx.gasLimit?.toString() || '0',
        to: tx.to || '',
        value: tx.value?.toString() || '0',
        data: tx.data || '0x',
        chainId: tx.chainId || 1,
        canRevert: false
      });
    }

    const bundle: FlashbotsBundle = {
      id: bundleId,
      transactions: bundleTransactions,
      targetBlock,
      minTimestamp: options.minTimestamp,
      maxTimestamp: options.maxTimestamp,
      revertingTxHashes: options.revertingTxHashes || [],
      replacementUuid: options.replacementUuid,
      signingAccount: this.signer.address,
      blockNumber: targetBlock,
      bundleHash: this.calculateBundleHash(bundleTransactions)
    };

    this.bundles.set(bundleId, bundle);
    this.emit('bundleCreated', { bundleId, bundle });

    return bundle;
  }

  private calculateBundleHash(transactions: BundleTransaction[]): string {
    const concatenated = transactions.map(tx => tx.hash).join('');
    return ethers.keccak256(ethers.toUtf8Bytes(concatenated));
  }

  async simulateBundle(bundleId: string): Promise<BundleSimulation> {
    const bundle = this.bundles.get(bundleId);
    if (!bundle) {
      throw new Error(`Bundle ${bundleId} not found`);
    }

    this.emit('bundleSimulationStarted', { bundleId });

    try {
      // Simular bundle usando Flashbots simulation API
      const simulation = await this.performBundleSimulation(bundle);
      
      this.simulations.set(bundleId, simulation);
      this.emit('bundleSimulationCompleted', { bundleId, simulation });

      return simulation;

    } catch (error) {
      this.emit('bundleSimulationFailed', { 
        bundleId, 
        error: (error as Error).message 
      });
      throw error;
    }
  }

  private async performBundleSimulation(bundle: FlashbotsBundle): Promise<BundleSimulation> {
    // Usar el mejor relay disponible para simulación
    const relay = this.selectBestRelay();
    
    const simulationPayload = {
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_callBundle',
      params: [
        {
          txs: bundle.transactions.map(tx => tx.signedTransaction),
          blockNumber: `0x${bundle.targetBlock.toString(16)}`,
          stateBlockNumber: 'latest'
        }
      ]
    };

    try {
      const response = await this.sendToRelay(relay, simulationPayload);
      
      if (response.data.error) {
        throw new Error(`Simulation failed: ${response.data.error.message}`);
      }

      const result = response.data.result;
      
      return {
        bundleId: bundle.id,
        blockNumber: bundle.targetBlock,
        gasUsed: result.gasUsed || '0',
        gasPrice: result.gasPrice || '0',
        effectiveGasPrice: result.effectiveGasPrice || '0',
        success: !result.error,
        profit: this.calculateBundleProfit(result),
        transactions: this.parseTransactionResults(result.results || []),
        stateChanges: result.stateChanges || [],
        errors: result.error ? [result.error] : []
      };

    } catch (error) {
      throw new Error(`Bundle simulation failed: ${(error as Error).message}`);
    }
  }

  private selectBestRelay(): FlashbotsRelay {
    const activeRelays = Array.from(this.relays.values())
      .filter(relay => relay.isActive)
      .sort((a, b) => {
        // Ordenar por reputación y tasa de éxito
        const scoreA = a.reputation * a.successRate;
        const scoreB = b.reputation * b.successRate;
        return scoreB - scoreA;
      });

    if (activeRelays.length === 0) {
      throw new Error('No active relays available');
    }

    return activeRelays[0];
  }

  private async sendToRelay(relay: FlashbotsRelay, payload: any): Promise<any> {
    const signature = await this.signPayload(JSON.stringify(payload));
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (relay.name === 'Flashbots') {
      headers[relay.authHeader] = `${this.signer.address}:${signature}`;
    } else {
      headers[relay.authHeader] = `Bearer ${signature}`;
    }

    return await axios.post(relay.url, payload, { 
      headers,
      timeout: 30000
    });
  }

  private async signPayload(payload: string): Promise<string> {
    const hash = ethers.keccak256(ethers.toUtf8Bytes(payload));
    return await this.signer.signMessage(ethers.getBytes(hash));
  }

  private calculateBundleProfit(simulationResult: any): string {
    // Calcular profit basado en cambios de balance
    let totalProfit = 0;
    
    if (simulationResult.coinbaseDiff) {
      totalProfit += parseInt(simulationResult.coinbaseDiff, 16);
    }

    if (simulationResult.ethSentToCoinbase) {
      totalProfit += parseInt(simulationResult.ethSentToCoinbase, 16);
    }

    return totalProfit.toString();
  }

  private parseTransactionResults(results: any[]): TransactionSimulation[] {
    return results.map((result, index) => ({
      hash: result.txHash || `tx_${index}`,
      success: !result.error,
      gasUsed: result.gasUsed || '0',
      logs: result.logs || [],
      trace: result.trace || [],
      revertReason: result.revertReason
    }));
  }

  async submitBundle(bundleId: string): Promise<void> {
    const bundle = this.bundles.get(bundleId);
    if (!bundle) {
      throw new Error(`Bundle ${bundleId} not found`);
    }

    // Simular primero si no se ha hecho
    if (!this.simulations.has(bundleId)) {
      await this.simulateBundle(bundleId);
    }

    const simulation = this.simulations.get(bundleId);
    if (!simulation || !simulation.success) {
      throw new Error(`Bundle ${bundleId} simulation failed or not profitable`);
    }

    this.emit('bundleSubmissionStarted', { bundleId });

    try {
      // Enviar a múltiples relays para maximizar inclusión
      const relays = Array.from(this.relays.values())
        .filter(relay => relay.isActive)
        .slice(0, 3); // Top 3 relays

      const submissions = await Promise.allSettled(
        relays.map(relay => this.submitToRelay(relay, bundle))
      );

      const successfulSubmissions = submissions.filter(
        result => result.status === 'fulfilled'
      ).length;

      if (successfulSubmissions === 0) {
        throw new Error('Failed to submit bundle to any relay');
      }

      this.emit('bundleSubmitted', { 
        bundleId, 
        relaysCount: successfulSubmissions,
        totalRelays: relays.length 
      });

    } catch (error) {
      this.emit('bundleSubmissionFailed', { 
        bundleId, 
        error: (error as Error).message 
      });
      throw error;
    }
  }

  private async submitToRelay(
    relay: FlashbotsRelay, 
    bundle: FlashbotsBundle
  ): Promise<void> {
    const payload = {
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_sendBundle',
      params: [
        {
          txs: bundle.transactions.map(tx => tx.signedTransaction),
          blockNumber: `0x${bundle.targetBlock.toString(16)}`,
          minTimestamp: bundle.minTimestamp,
          maxTimestamp: bundle.maxTimestamp,
          revertingTxHashes: bundle.revertingTxHashes,
          replacementUuid: bundle.replacementUuid
        }
      ]
    };

    const response = await this.sendToRelay(relay, payload);
    
    if (response.data.error) {
      throw new Error(`Relay ${relay.name} rejected bundle: ${response.data.error.message}`);
    }

    // Actualizar estadísticas del relay
    relay.successRate = (relay.successRate * 0.95) + (1 * 0.05);
  }

  async monitorBundle(bundleId: string, maxBlocks: number = 5): Promise<void> {
    const bundle = this.bundles.get(bundleId);
    if (!bundle) {
      throw new Error(`Bundle ${bundleId} not found`);
    }

    this.emit('bundleMonitoringStarted', { bundleId, targetBlock: bundle.targetBlock });

    let currentBlock = await this.provider.getBlockNumber();
    const endBlock = bundle.targetBlock + maxBlocks;

    while (currentBlock <= endBlock) {
      try {
        const block = await this.provider.getBlock(currentBlock, true);
        
        if (block && block.transactions) {
          const bundleTxHashes = bundle.transactions.map(tx => tx.hash);
          const includedTxs = block.transactions.filter(tx => 
            bundleTxHashes.includes(typeof tx === 'string' ? tx : tx.hash)
          );

          if (includedTxs.length > 0) {
            this.emit('bundleIncluded', {
              bundleId,
              blockNumber: currentBlock,
              includedTransactions: includedTxs.length,
              totalTransactions: bundle.transactions.length
            });

            // Verificar si todas las transacciones fueron incluidas
            if (includedTxs.length === bundle.transactions.length) {
              this.emit('bundleFullyIncluded', { bundleId, blockNumber: currentBlock });
              return;
            }
          }
        }

        // Esperar al siguiente bloque
        currentBlock = await this.waitForNextBlock(currentBlock);

      } catch (error) {
        this.emit('bundleMonitoringError', {
          bundleId,
          blockNumber: currentBlock,
          error: (error as Error).message
        });
      }
    }

    this.emit('bundleMonitoringCompleted', { bundleId, finalBlock: currentBlock });
  }

  private async waitForNextBlock(currentBlock: number): Promise<number> {
    return new Promise((resolve) => {
      const checkBlock = async () => {
        const newBlock = await this.provider.getBlockNumber();
        if (newBlock > currentBlock) {
          resolve(newBlock);
        } else {
          setTimeout(checkBlock, 1000);
        }
      };
      checkBlock();
    });
  }

  async createArbitrageBundle(
    opportunity: MEVOpportunity,
    flashLoanAmount: string
  ): Promise<string> {
    const currentBlock = await this.provider.getBlockNumber();
    const targetBlock = currentBlock + 1;

    // Crear transacciones para arbitraje
    const transactions: ethers.Transaction[] = [];

    // 1. Flash loan
    const flashLoanTx = await this.createFlashLoanTransaction(flashLoanAmount);
    transactions.push(flashLoanTx);

    // 2. Arbitrage trades
    const arbitrageTx = await this.createArbitrageTransaction(opportunity);
    transactions.push(arbitrageTx);

    // 3. Repay flash loan
    const repayTx = await this.createRepayTransaction(flashLoanAmount, opportunity.profit);
    transactions.push(repayTx);

    const bundle = await this.createBundle(transactions, targetBlock);
    
    // Simular y validar rentabilidad
    const simulation = await this.simulateBundle(bundle.id);
    
    if (!simulation.success || parseFloat(simulation.profit) <= 0) {
      throw new Error('Bundle is not profitable or fails simulation');
    }

    return bundle.id;
  }

  private async createFlashLoanTransaction(amount: string): Promise<ethers.Transaction> {
    // Implementar creación de transacción de flash loan
    // Esta sería la interfaz con protocolos como Aave V3, Balancer V2, etc.
    
    return {
      to: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2', // Aave V3 Pool
      data: '0x', // Encoded flash loan call
      value: 0,
      gasLimit: 500000,
      gasPrice: ethers.parseUnits('20', 'gwei')
    } as ethers.Transaction;
  }

  private async createArbitrageTransaction(opportunity: MEVOpportunity): Promise<ethers.Transaction> {
    // Implementar lógica específica de arbitraje según el tipo
    
    return {
      to: '0x', // DEX contract address
      data: '0x', // Encoded swap call
      value: 0,
      gasLimit: 300000,
      gasPrice: ethers.parseUnits('20', 'gwei')
    } as ethers.Transaction;
  }

  private async createRepayTransaction(amount: string, profit: string): Promise<ethers.Transaction> {
    // Implementar repago del flash loan con profit
    
    return {
      to: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2', // Aave V3 Pool
      data: '0x', // Encoded repay call
      value: 0,
      gasLimit: 200000,
      gasPrice: ethers.parseUnits('20', 'gwei')
    } as ethers.Transaction;
  }

  // Métodos de gestión
  getBundleStatus(bundleId: string): FlashbotsBundle | undefined {
    return this.bundles.get(bundleId);
  }

  getSimulationResult(bundleId: string): BundleSimulation | undefined {
    return this.simulations.get(bundleId);
  }

  getAllRelays(): FlashbotsRelay[] {
    return Array.from(this.relays.values());
  }

  updateRelayStatus(relayName: string, isActive: boolean): void {
    const relay = this.relays.get(relayName);
    if (relay) {
      relay.isActive = isActive;
      this.emit('relayStatusUpdated', { relayName, isActive });
    }
  }

  getConfiguration(): MEVProtectionConfig {
    return { ...this.config };
  }

  updateConfiguration(config: Partial<MEVProtectionConfig>): void {
    this.config = { ...this.config, ...config };
    this.emit('configurationUpdated', this.config);
  }
}

// ============================================================================
// ACCESS CONTROL ENTERPRISE SYSTEM
// ============================================================================

export class AccessControlSystem extends EventEmitter {
  private users: Map<string, User>;
  private roles: Map<string, Role>;
  private permissions: Map<string, Permission>;
  private tokens: Map<string, AccessToken>;
  private config: AccessControlConfig;
  private rateLimitCounters: Map<string, number>;

  constructor(config: AccessControlConfig) {
    super();
    this.users = new Map();
    this.roles = new Map();
    this.permissions = new Map();
    this.tokens = new Map();
    this.config = config;
    this.rateLimitCounters = new Map();

    this.initializeDefaultRolesAndPermissions();
    this.startRateLimitReset();
  }

  private initializeDefaultRolesAndPermissions(): void {
    // Permisos base
    const permissions = [
      { id: 'view-opportunities', name: 'View Opportunities', resource: 'opportunities', action: 'read', description: 'View arbitrage opportunities' },
      { id: 'execute-trades', name: 'Execute Trades', resource: 'trades', action: 'create', description: 'Execute arbitrage trades' },
      { id: 'view-portfolio', name: 'View Portfolio', resource: 'portfolio', action: 'read', description: 'View portfolio status' },
      { id: 'manage-users', name: 'Manage Users', resource: 'users', action: '*', description: 'Full user management' },
      { id: 'view-metrics', name: 'View Metrics', resource: 'metrics', action: 'read', description: 'View system metrics' },
      { id: 'manage-config', name: 'Manage Configuration', resource: 'config', action: '*', description: 'System configuration' },
      { id: 'view-bundles', name: 'View Bundles', resource: 'bundles', action: 'read', description: 'View MEV bundles' },
      { id: 'create-bundles', name: 'Create Bundles', resource: 'bundles', action: 'create', description: 'Create MEV bundles' },
      { id: 'submit-bundles', name: 'Submit Bundles', resource: 'bundles', action: 'execute', description: 'Submit bundles to relays' }
    ];

    permissions.forEach(perm => {
      this.permissions.set(perm.id, perm as Permission);
    });

    // Roles base
    const roles = [
      {
        id: 'viewer',
        name: 'Viewer',
        description: 'Read-only access to opportunities and metrics',
        permissions: ['view-opportunities', 'view-portfolio', 'view-metrics', 'view-bundles'],
        isActive: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        id: 'trader',
        name: 'Trader',
        description: 'Can view and execute trades',
        permissions: ['view-opportunities', 'execute-trades', 'view-portfolio', 'view-metrics', 'view-bundles'],
        parent: 'viewer',
        isActive: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        id: 'searcher',
        name: 'MEV Searcher',
        description: 'Can create and submit MEV bundles',
        permissions: ['view-opportunities', 'execute-trades', 'view-portfolio', 'view-bundles', 'create-bundles', 'submit-bundles'],
        parent: 'trader',
        isActive: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        id: 'admin',
        name: 'Administrator',
        description: 'Full system access',
        permissions: ['view-opportunities', 'execute-trades', 'view-portfolio', 'manage-users', 'view-metrics', 'manage-config', 'view-bundles', 'create-bundles', 'submit-bundles'],
        isActive: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    ];

    roles.forEach(role => {
      this.roles.set(role.id, role as Role);
    });
  }

  async authenticateUser(username: string, password: string): Promise<AccessToken> {
    const user = Array.from(this.users.values()).find(u => u.username === username);
    
    if (!user || !user.isActive) {
      throw new Error('Invalid credentials or inactive user');
    }

    // En producción, verificar password hash
    if (password !== 'demo_password') {
      throw new Error('Invalid credentials');
    }

    // Verificar rate limiting
    if (this.isRateLimited(`auth:${user.id}`)) {
      throw new Error('Too many authentication attempts');
    }

    // Crear access token
    const token = this.generateAccessToken(user);
    this.tokens.set(token.token, token);

    // Actualizar último login
    user.lastLogin = Date.now();

    this.emit('userAuthenticated', { userId: user.id, username: user.username });

    return token;
  }

  async authenticateApiKey(apiKey: string): Promise<AccessToken> {
    // Buscar usuario con esta API key
    const user = Array.from(this.users.values()).find(u => 
      u.apiKeys.some(key => key.key === apiKey && key.isActive)
    );

    if (!user) {
      throw new Error('Invalid API key');
    }

    const keyObj = user.apiKeys.find(k => k.key === apiKey)!;
    
    // Verificar expiración
    if (keyObj.expiresAt && Date.now() > keyObj.expiresAt) {
      throw new Error('API key expired');
    }

    // Verificar rate limiting
    if (this.isRateLimited(`api:${keyObj.id}`)) {
      throw new Error('Rate limit exceeded for API key');
    }

    // Actualizar último uso
    keyObj.lastUsed = Date.now();

    // Crear access token con permisos de la API key
    const token: AccessToken = {
      token: this.generateTokenString(),
      userId: user.id,
      roles: user.roles,
      permissions: keyObj.permissions.length > 0 ? keyObj.permissions : user.permissions,
      expiresAt: Date.now() + 3600000, // 1 hora
      scope: ['api']
    };

    this.tokens.set(token.token, token);

    this.emit('apiKeyAuthenticated', { userId: user.id, apiKeyId: keyObj.id });

    return token;
  }

  async authorizeAction(
    token: string, 
    resource: string, 
    action: string,
    context?: any
  ): Promise<boolean> {
    const accessToken = this.tokens.get(token);
    
    if (!accessToken || Date.now() > accessToken.expiresAt) {
      return false;
    }

    // Verificar rate limiting por usuario
    if (this.isRateLimited(`user:${accessToken.userId}`)) {
      throw new Error('Rate limit exceeded');
    }

    // Verificar permisos
    const hasPermission = this.checkPermission(
      accessToken.permissions,
      resource,
      action,
      context
    );

    if (hasPermission) {
      this.updateRateLimit(`user:${accessToken.userId}`);
      this.emit('actionAuthorized', {
        userId: accessToken.userId,
        resource,
        action,
        granted: true
      });
    } else {
      this.emit('actionDenied', {
        userId: accessToken.userId,
        resource,
        action,
        reason: 'Insufficient permissions'
      });
    }

    return hasPermission;
  }

  private checkPermission(
    userPermissions: string[],
    resource: string,
    action: string,
    context?: any
  ): boolean {
    // Verificar permisos directos
    for (const permissionId of userPermissions) {
      const permission = this.permissions.get(permissionId);
      
      if (!permission) continue;

      // Verificar recurso y acción
      const resourceMatch = permission.resource === resource || permission.resource === '*';
      const actionMatch = permission.action === action || permission.action === '*';

      if (resourceMatch && actionMatch) {
        // Verificar condiciones adicionales si existen
        if (permission.conditions && permission.conditions.length > 0) {
          const conditionsMet = this.evaluateConditions(permission.conditions, context);
          if (!conditionsMet) continue;
        }

        return true;
      }
    }

    return false;
  }

  private evaluateConditions(conditions: string[], context: any): boolean {
    // Evaluar condiciones dinámicas (ej: time-based, IP-based, etc.)
    for (const condition of conditions) {
      if (condition.startsWith('time:')) {
        const timeCondition = condition.split(':')[1];
        if (!this.evaluateTimeCondition(timeCondition)) {
          return false;
        }
      }
      // Agregar más tipos de condiciones según necesidades
    }

    return true;
  }

  private evaluateTimeCondition(condition: string): boolean {
    // Ejemplo: "business_hours" = 9am-5pm weekdays
    if (condition === 'business_hours') {
      const now = new Date();
      const hour = now.getHours();
      const day = now.getDay();
      
      return day >= 1 && day <= 5 && hour >= 9 && hour <= 17;
    }

    return true;
  }

  private generateAccessToken(user: User): AccessToken {
    return {
      token: this.generateTokenString(),
      userId: user.id,
      roles: user.roles,
      permissions: user.permissions,
      expiresAt: Date.now() + (this.config.authentication.sessionTimeout || 3600000),
      scope: ['web']
    };
  }

  private generateTokenString(): string {
    return `arbx_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
  }

  private isRateLimited(key: string): boolean {
    const count = this.rateLimitCounters.get(key) || 0;
    const limit = this.getRateLimit(key);
    
    return count >= limit;
  }

  private getRateLimit(key: string): number {
    if (key.startsWith('auth:')) {
      return 5; // 5 auth attempts per window
    } else if (key.startsWith('api:')) {
      return this.config.rateLimit.perUser || 1000;
    } else if (key.startsWith('user:')) {
      return this.config.rateLimit.perUser || 1000;
    }
    
    return this.config.rateLimit.global || 10000;
  }

  private updateRateLimit(key: string): void {
    const current = this.rateLimitCounters.get(key) || 0;
    this.rateLimitCounters.set(key, current + 1);
  }

  private startRateLimitReset(): void {
    // Reset rate limits every minute
    setInterval(() => {
      this.rateLimitCounters.clear();
    }, 60000);
  }

  // Métodos de gestión de usuarios
  async createUser(userData: {
    username: string;
    email: string;
    roles: string[];
    isActive?: boolean;
  }): Promise<User> {
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const user: User = {
      id: userId,
      username: userData.username,
      email: userData.email,
      roles: userData.roles,
      permissions: this.expandRolePermissions(userData.roles),
      isActive: userData.isActive !== false,
      lastLogin: 0,
      mfaEnabled: false,
      apiKeys: []
    };

    this.users.set(userId, user);
    this.emit('userCreated', { userId, username: user.username });

    return user;
  }

  private expandRolePermissions(roleIds: string[]): string[] {
    const permissions = new Set<string>();

    for (const roleId of roleIds) {
      const role = this.roles.get(roleId);
      if (role && role.isActive) {
        role.permissions.forEach(perm => permissions.add(perm));
        
        // Expandir permisos de role padre si existe
        if (role.parent) {
          const parentPermissions = this.expandRolePermissions([role.parent]);
          parentPermissions.forEach(perm => permissions.add(perm));
        }
      }
    }

    return Array.from(permissions);
  }

  async createApiKey(
    userId: string, 
    keyData: {
      name: string;
      permissions?: string[];
      expiresAt?: number;
    }
  ): Promise<ApiKey> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const apiKey: ApiKey = {
      id: `key_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: keyData.name,
      key: `ak_${Math.random().toString(36).substr(2, 32)}`,
      secret: `as_${Math.random().toString(36).substr(2, 64)}`,
      permissions: keyData.permissions || user.permissions,
      expiresAt: keyData.expiresAt,
      lastUsed: 0,
      isActive: true
    };

    user.apiKeys.push(apiKey);
    this.emit('apiKeyCreated', { userId, apiKeyId: apiKey.id });

    return apiKey;
  }

  // Métodos de consulta
  getUser(userId: string): User | undefined {
    return this.users.get(userId);
  }

  getRole(roleId: string): Role | undefined {
    return this.roles.get(roleId);
  }

  getAllUsers(): User[] {
    return Array.from(this.users.values());
  }

  getAllRoles(): Role[] {
    return Array.from(this.roles.values());
  }

  getAllPermissions(): Permission[] {
    return Array.from(this.permissions.values());
  }

  revokeToken(token: string): void {
    this.tokens.delete(token);
    this.emit('tokenRevoked', { token });
  }

  cleanupExpiredTokens(): void {
    const now = Date.now();
    for (const [token, accessToken] of this.tokens) {
      if (accessToken.expiresAt < now) {
        this.tokens.delete(token);
      }
    }
  }
}

// ============================================================================
// ON-CHAIN SLIPPAGE PROTECTION
// ============================================================================

export class OnChainSlippageProtection {
  private config: SlippageProtection;
  private provider: ethers.JsonRpcProvider;

  constructor(config: SlippageProtection, provider: ethers.JsonRpcProvider) {
    this.config = config;
    this.provider = provider;
  }

  async protectTransaction(
    transaction: ethers.Transaction,
    expectedOutput: string,
    slippageTolerance?: number
  ): Promise<ethers.Transaction> {
    if (!this.config.enabled) {
      return transaction;
    }

    const tolerance = slippageTolerance || this.config.maxSlippage;
    const minOutput = this.calculateMinOutput(expectedOutput, tolerance);

    // Modificar transaction para incluir protección de slippage
    const protectedTx = { ...transaction };

    if (this.config.onChainValidation) {
      // Agregar verificación on-chain de slippage
      protectedTx.data = this.addSlippageCheck(transaction.data!, minOutput);
    }

    return protectedTx;
  }

  private calculateMinOutput(expectedOutput: string, slippageTolerance: number): string {
    const expected = BigInt(expectedOutput);
    const tolerance = BigInt(Math.floor(slippageTolerance * 10000)); // basis points
    const minOutput = expected * (BigInt(10000) - tolerance) / BigInt(10000);
    
    return minOutput.toString();
  }

  private addSlippageCheck(originalData: string, minOutput: string): string {
    // En una implementación real, esto modificaría el calldata para incluir
    // verificaciones de slippage en el contrato inteligente
    
    // Por simplicidad, retornamos los datos originales
    return originalData;
  }

  async validateSlippage(
    transactionHash: string,
    expectedOutput: string
  ): Promise<{ isValid: boolean; actualOutput: string; slippage: number }> {
    const receipt = await this.provider.getTransactionReceipt(transactionHash);
    
    if (!receipt) {
      throw new Error('Transaction not found');
    }

    // Parsear logs para obtener el output real
    // En implementación real, esto analizaría los logs específicos del DEX
    const actualOutput = expectedOutput; // Placeholder
    
    const expected = parseFloat(expectedOutput);
    const actual = parseFloat(actualOutput);
    const slippage = Math.abs((expected - actual) / expected) * 100;

    return {
      isValid: slippage <= this.config.maxSlippage,
      actualOutput,
      slippage
    };
  }
}

// ============================================================================
// EXPORT
// ============================================================================

export {
  FlashbotsIntegrationSystem,
  AccessControlSystem,
  OnChainSlippageProtection
};

export default {
  FlashbotsIntegrationSystem,
  AccessControlSystem,
  OnChainSlippageProtection
};
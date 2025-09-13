import { spawn, ChildProcess } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ethers } from 'ethers';
import pino from 'pino';
import { config } from '@/config';
import { AnvilInstance, AnvilMetrics } from '@/types/simulation';

// =============================================================================
// ANVIL MANAGER SERVICE
// =============================================================================

export class AnvilManager {
  private logger: pino.Logger;
  private instances: Map<string, AnvilInstanceManager> = new Map();
  private portPool: Set<number> = new Set();
  private cleanupInterval?: NodeJS.Timeout;

  constructor(logger: pino.Logger) {
    this.logger = logger.child({ service: 'anvil-manager' });
    this.initializePortPool();
    this.startCleanupProcess();
  }

  /**
   * Initialize available port pool
   */
  private initializePortPool(): void {
    for (let port = config.anvil.port_range_start; port <= config.anvil.port_range_end; port++) {
      this.portPool.add(port);
    }
    this.logger.info({
      port_range: `${config.anvil.port_range_start}-${config.anvil.port_range_end}`,
      available_ports: this.portPool.size
    }, 'Initialized port pool');
  }

  /**
   * Get next available port
   */
  private getNextAvailablePort(): number | null {
    const port = this.portPool.values().next().value;
    if (port) {
      this.portPool.delete(port);
      return port;
    }
    return null;
  }

  /**
   * Release port back to pool
   */
  private releasePort(port: number): void {
    this.portPool.add(port);
  }

  /**
   * Create new Anvil instance
   */
  async createInstance(
    chainId: number,
    forkUrl: string,
    options: {
      blockNumber?: number;
      accounts?: number;
      balance?: string;
      gasLimit?: number;
      gasPrice?: string;
      chainName?: string;
    } = {}
  ): Promise<AnvilInstance> {
    // Check instance limits
    if (this.instances.size >= config.anvil.max_instances) {
      throw new Error(`Maximum instances limit reached (${config.anvil.max_instances})`);
    }

    // Get available port
    const port = this.getNextAvailablePort();
    if (!port) {
      throw new Error('No available ports for new instance');
    }

    // Validate Real-Only policy
    if (config.real_only.enabled && config.real_only.require_real_rpcs) {
      if (!forkUrl.startsWith('https://') && !forkUrl.startsWith('wss://')) {
        throw new Error('Real-Only policy: Fork URL must use HTTPS or WSS protocol');
      }
    }

    try {
      const instanceId = uuidv4();
      const instance: AnvilInstance = {
        id: instanceId,
        chain_id: chainId,
        rpc_url: `http://localhost:${port}`,
        status: 'starting',
        created_at: new Date(),
      };

      // Create instance manager
      const manager = new AnvilInstanceManager(
        instanceId,
        port,
        forkUrl,
        options,
        this.logger.child({ instance_id: instanceId })
      );

      this.instances.set(instanceId, manager);

      // Start the instance
      await manager.start();
      
      // Update instance status
      instance.status = 'running';
      instance.process_id = manager.getProcessId();
      instance.last_heartbeat = new Date();

      this.logger.info({
        instance_id: instanceId,
        chain_id: chainId,
        port,
        fork_url: forkUrl
      }, 'Anvil instance created successfully');

      return instance;
    } catch (error) {
      // Release port on error
      this.releasePort(port);
      this.logger.error({ error: error.message, port }, 'Failed to create Anvil instance');
      throw error;
    }
  }

  /**
   * Get instance by ID
   */
  async getInstance(instanceId: string): Promise<AnvilInstance | null> {
    const manager = this.instances.get(instanceId);
    if (!manager) {
      return null;
    }

    return manager.getInstance();
  }

  /**
   * Stop instance
   */
  async stopInstance(instanceId: string): Promise<boolean> {
    const manager = this.instances.get(instanceId);
    if (!manager) {
      return false;
    }

    try {
      await manager.stop();
      this.releasePort(manager.getPort());
      this.instances.delete(instanceId);
      
      this.logger.info({ instance_id: instanceId }, 'Instance stopped successfully');
      return true;
    } catch (error) {
      this.logger.error({
        instance_id: instanceId,
        error: error.message
      }, 'Failed to stop instance');
      return false;
    }
  }

  /**
   * List all instances
   */
  async listInstances(): Promise<AnvilInstance[]> {
    const instances: AnvilInstance[] = [];
    for (const manager of this.instances.values()) {
      instances.push(await manager.getInstance());
    }
    return instances;
  }

  /**
   * Get instance metrics
   */
  async getInstanceMetrics(instanceId: string): Promise<AnvilMetrics | null> {
    const manager = this.instances.get(instanceId);
    if (!manager) {
      return null;
    }

    return manager.getMetrics();
  }

  /**
   * Health check for instance
   */
  async checkInstanceHealth(instanceId: string): Promise<{
    is_healthy: boolean;
    last_check: Date;
    issues?: string[];
  }> {
    const manager = this.instances.get(instanceId);
    if (!manager) {
      return {
        is_healthy: false,
        last_check: new Date(),
        issues: ['Instance not found']
      };
    }

    return manager.healthCheck();
  }

  /**
   * Start cleanup process for stale instances
   */
  private startCleanupProcess(): void {
    this.cleanupInterval = setInterval(async () => {
      await this.cleanupStaleInstances();
    }, config.anvil.cleanup_interval_ms);

    this.logger.info({
      interval_ms: config.anvil.cleanup_interval_ms
    }, 'Started cleanup process');
  }

  /**
   * Cleanup stale instances
   */
  private async cleanupStaleInstances(): Promise<void> {
    const now = new Date();
    const timeoutMs = config.anvil.instance_timeout_seconds * 1000;

    for (const [instanceId, manager] of this.instances.entries()) {
      try {
        const instance = await manager.getInstance();
        const lastActivity = instance.last_heartbeat || instance.created_at;
        
        if (now.getTime() - lastActivity.getTime() > timeoutMs) {
          this.logger.warn({
            instance_id: instanceId,
            last_activity: lastActivity,
            timeout_ms: timeoutMs
          }, 'Cleaning up stale instance');
          
          await this.stopInstance(instanceId);
        }
      } catch (error) {
        this.logger.error({
          instance_id: instanceId,
          error: error.message
        }, 'Error during cleanup check');
      }
    }
  }

  /**
   * Shutdown manager
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Anvil Manager');

    // Stop cleanup process
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Stop all instances
    const stopPromises = Array.from(this.instances.keys()).map(
      instanceId => this.stopInstance(instanceId)
    );

    await Promise.allSettled(stopPromises);
    this.logger.info('Anvil Manager shutdown complete');
  }
}

// =============================================================================
// INDIVIDUAL ANVIL INSTANCE MANAGER
// =============================================================================

class AnvilInstanceManager {
  private instanceId: string;
  private port: number;
  private forkUrl: string;
  private options: any;
  private logger: pino.Logger;
  private process?: ChildProcess;
  private provider?: ethers.JsonRpcProvider;
  private metrics: {
    startTime: Date;
    simulationsCount: number;
    totalSimTime: number;
    successCount: number;
    lastHeartbeat?: Date;
  };

  constructor(
    instanceId: string,
    port: number,
    forkUrl: string,
    options: any,
    logger: pino.Logger
  ) {
    this.instanceId = instanceId;
    this.port = port;
    this.forkUrl = forkUrl;
    this.options = options;
    this.logger = logger;
    this.metrics = {
      startTime: new Date(),
      simulationsCount: 0,
      totalSimTime: 0,
      successCount: 0,
    };
  }

  /**
   * Start Anvil process
   */
  async start(): Promise<void> {
    const args = [
      '--port', this.port.toString(),
      '--host', '0.0.0.0',
      '--fork-url', this.forkUrl,
      '--accounts', (this.options.accounts || 10).toString(),
      '--balance', this.options.balance || '10000000000000000000000', // 10k ETH
      '--gas-limit', (this.options.gasLimit || config.simulation.default_gas_limit).toString(),
      '--gas-price', this.options.gasPrice || config.simulation.default_gas_price,
      '--chain-id', (this.options.chainId || config.anvil.default_chain_id).toString(),
    ];

    if (this.options.blockNumber) {
      args.push('--fork-block-number', this.options.blockNumber.toString());
    }

    // Ensure data directory exists
    await fs.mkdir(config.anvil.data_dir, { recursive: true });

    this.logger.info({ args }, 'Starting Anvil process');

    this.process = spawn(config.anvil.binary_path, args, {
      cwd: config.anvil.data_dir,
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: false,
    });

    // Handle process events
    this.process.on('error', (error) => {
      this.logger.error({ error: error.message }, 'Anvil process error');
    });

    this.process.on('exit', (code, signal) => {
      this.logger.info({ code, signal }, 'Anvil process exited');
    });

    // Wait for RPC to be ready
    await this.waitForRpcReady();

    // Initialize provider
    this.provider = new ethers.JsonRpcProvider(`http://localhost:${this.port}`);
    this.metrics.lastHeartbeat = new Date();
  }

  /**
   * Wait for RPC to be ready
   */
  private async waitForRpcReady(): Promise<void> {
    const maxAttempts = 30;
    const delayMs = 1000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await fetch(`http://localhost:${this.port}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'eth_blockNumber',
            params: [],
            id: 1
          })
        });

        if (response.ok) {
          this.logger.info({ attempt }, 'Anvil RPC is ready');
          return;
        }
      } catch (error) {
        // Continue waiting
      }

      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    throw new Error('Anvil RPC failed to start within timeout');
  }

  /**
   * Stop Anvil process
   */
  async stop(): Promise<void> {
    if (this.process) {
      this.process.kill('SIGTERM');
      
      // Wait for graceful shutdown
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          if (this.process && !this.process.killed) {
            this.process.kill('SIGKILL');
          }
          resolve();
        }, 5000);

        this.process!.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      this.process = undefined;
    }
  }

  /**
   * Get instance data
   */
  async getInstance(): Promise<AnvilInstance> {
    let blockNumber: number | undefined;
    let accounts: string[] | undefined;

    try {
      if (this.provider) {
        blockNumber = await this.provider.getBlockNumber();
        // Get first few accounts for reference
        accounts = await Promise.all([
          this.provider.send('eth_accounts', [])
        ]).then(([accs]) => accs.slice(0, 3));
      }
    } catch (error) {
      this.logger.warn({ error: error.message }, 'Failed to get instance details');
    }

    return {
      id: this.instanceId,
      chain_id: this.options.chainId || config.anvil.default_chain_id,
      rpc_url: `http://localhost:${this.port}`,
      process_id: this.process?.pid,
      status: this.process && !this.process.killed ? 'running' : 'stopped',
      created_at: this.metrics.startTime,
      last_heartbeat: this.metrics.lastHeartbeat,
      block_number: blockNumber,
      gas_limit: this.options.gasLimit || config.simulation.default_gas_limit,
      base_fee: this.options.gasPrice || config.simulation.default_gas_price,
      accounts,
    };
  }

  /**
   * Get metrics
   */
  async getMetrics(): Promise<AnvilMetrics> {
    const now = new Date();
    const uptimeSeconds = Math.floor((now.getTime() - this.metrics.startTime.getTime()) / 1000);
    const successRate = this.metrics.simulationsCount > 0 
      ? this.metrics.successCount / this.metrics.simulationsCount 
      : 0;
    const avgSimTime = this.metrics.simulationsCount > 0 
      ? this.metrics.totalSimTime / this.metrics.simulationsCount 
      : 0;

    let blockNumber = 0;
    try {
      if (this.provider) {
        blockNumber = await this.provider.getBlockNumber();
      }
    } catch (error) {
      // Ignore error for metrics
    }

    return {
      instance_id: this.instanceId,
      chain_id: this.options.chainId || config.anvil.default_chain_id,
      uptime_seconds: uptimeSeconds,
      blocks_processed: blockNumber,
      simulations_count: this.metrics.simulationsCount,
      avg_sim_time_ms: avgSimTime,
      success_rate: successRate,
      memory_usage_mb: process.memoryUsage().heapUsed / 1024 / 1024,
      cpu_usage_percent: process.cpuUsage().user / 1000, // Simplified CPU usage
      last_updated: now,
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    is_healthy: boolean;
    last_check: Date;
    issues?: string[];
  }> {
    const issues: string[] = [];
    const now = new Date();

    // Check if process is running
    if (!this.process || this.process.killed) {
      issues.push('Process is not running');
    }

    // Check RPC connectivity
    try {
      if (this.provider) {
        await this.provider.getBlockNumber();
        this.metrics.lastHeartbeat = now;
      } else {
        issues.push('Provider not initialized');
      }
    } catch (error) {
      issues.push(`RPC connectivity failed: ${error.message}`);
    }

    return {
      is_healthy: issues.length === 0,
      last_check: now,
      issues: issues.length > 0 ? issues : undefined,
    };
  }

  /**
   * Record simulation metrics
   */
  recordSimulation(executionTimeMs: number, success: boolean): void {
    this.metrics.simulationsCount++;
    this.metrics.totalSimTime += executionTimeMs;
    if (success) {
      this.metrics.successCount++;
    }
  }

  /**
   * Get process ID
   */
  getProcessId(): number | undefined {
    return this.process?.pid;
  }

  /**
   * Get port
   */
  getPort(): number {
    return this.port;
  }

  /**
   * Get provider
   */
  getProvider(): ethers.JsonRpcProvider | undefined {
    return this.provider;
  }
}
import { spawn, ChildProcess } from 'child_process';
import { ethers } from 'ethers';
import Redis from 'ioredis';
import { Logger } from 'winston';
import { v4 as uuidv4 } from 'uuid';
import {
  AnvilConfig,
  AnvilInstance,
  AnvilInstanceStatus,
  HealthCheckResult,
  InstancePoolConfig,
  SimulationStrategy
} from '../types/simulation.js';

export class AnvilManager {
  private instances: Map<string, AnvilInstance> = new Map();
  private processes: Map<string, ChildProcess> = new Map();
  private poolConfigs: Map<SimulationStrategy, InstancePoolConfig> = new Map();
  private healthCheckIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    private redis: Redis,
    private logger: Logger
  ) {
    // Configurar pools por estrategia
    this.setupDefaultPoolConfigs();
    
    // Iniciar health checks periódicos
    this.startGlobalHealthMonitoring();
  }

  private setupDefaultPoolConfigs(): void {
    const strategies: SimulationStrategy[] = ['A', 'C', 'D', 'F'];
    
    strategies.forEach(strategy => {
      const config: InstancePoolConfig = {
        strategy,
        min_instances: 2,
        max_instances: 5,
        target_utilization: 0.7,
        scale_up_threshold: 0.8,
        scale_down_threshold: 0.3,
        health_check_interval_seconds: 30
      };
      this.poolConfigs.set(strategy, config);
    });
  }

  /**
   * Crear nueva instancia Anvil
   */
  async createInstance(config: AnvilConfig): Promise<AnvilInstance> {
    this.logger.info(`Creating Anvil instance ${config.instance_id}`, { config });

    const instance: AnvilInstance = {
      instance_id: config.instance_id,
      config,
      status: 'starting',
      start_time: new Date().toISOString(),
      metrics: {
        blocks_mined: 0,
        transactions_processed: 0,
        gas_used: "0",
        uptime_seconds: 0
      }
    };

    try {
      // Verificar que el puerto esté disponible
      await this.checkPortAvailable(config.port);

      // Real-Only Policy: Validar fork_url
      if (config.real_only !== false) { // Default es true
        await this.validateRealDataSource(config.fork_url);
      }

      // Construir argumentos para Anvil
      const anvilArgs = this.buildAnvilArgs(config);
      
      // Spawn proceso Anvil
      const process = spawn('anvil', anvilArgs, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env }
      });

      process.stdout?.on('data', (data) => {
        this.logger.debug(`Anvil ${config.instance_id} stdout: ${data.toString().trim()}`);
      });

      process.stderr?.on('data', (data) => {
        const error = data.toString().trim();
        this.logger.warn(`Anvil ${config.instance_id} stderr: ${error}`);
        
        // Actualizar estado si hay error crítico
        if (error.includes('Error') || error.includes('failed')) {
          this.updateInstanceStatus(config.instance_id, 'error', error);
        }
      });

      process.on('exit', (code, signal) => {
        this.logger.warn(`Anvil ${config.instance_id} exited`, { code, signal });
        this.handleInstanceExit(config.instance_id, code, signal);
      });

      process.on('error', (error) => {
        this.logger.error(`Anvil ${config.instance_id} process error: ${error.message}`, error);
        this.updateInstanceStatus(config.instance_id, 'error', error.message);
      });

      // Guardar proceso y instancia
      instance.pid = process.pid;
      this.processes.set(config.instance_id, process);
      this.instances.set(config.instance_id, instance);

      // Esperar que Anvil esté listo
      await this.waitForInstanceReady(config.instance_id, 30000); // 30s timeout

      // Actualizar estado a running
      this.updateInstanceStatus(config.instance_id, 'running');

      // Iniciar health checks
      this.startHealthChecking(config.instance_id);

      // Cachear en Redis
      await this.cacheInstance(instance);

      this.logger.info(`Anvil instance ${config.instance_id} created successfully`);
      return instance;

    } catch (error) {
      this.logger.error(`Failed to create Anvil instance ${config.instance_id}`, error);
      instance.status = 'error';
      instance.error_message = error instanceof Error ? error.message : 'Unknown error';
      throw error;
    }
  }

  /**
   * Detener instancia Anvil
   */
  async stopInstance(instanceId: string): Promise<void> {
    this.logger.info(`Stopping Anvil instance ${instanceId}`);

    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Instance ${instanceId} not found`);
    }

    try {
      // Actualizar estado
      this.updateInstanceStatus(instanceId, 'stopping');

      // Detener health checks
      this.stopHealthChecking(instanceId);

      // Terminar proceso
      const process = this.processes.get(instanceId);
      if (process && !process.killed) {
        process.kill('SIGTERM');
        
        // Esperar terminación graceful o forzar
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            if (!process.killed) {
              this.logger.warn(`Force killing Anvil instance ${instanceId}`);
              process.kill('SIGKILL');
            }
            resolve();
          }, 10000);

          process.on('exit', () => {
            clearTimeout(timeout);
            resolve();
          });
        });
      }

      // Limpiar referencias
      this.processes.delete(instanceId);
      this.instances.delete(instanceId);

      // Remover de Redis
      await this.redis.del(`anvil:instance:${instanceId}`);

      this.logger.info(`Anvil instance ${instanceId} stopped successfully`);

    } catch (error) {
      this.logger.error(`Failed to stop Anvil instance ${instanceId}`, error);
      throw error;
    }
  }

  /**
   * Obtener instancia disponible para estrategia
   */
  async getAvailableInstance(strategy: SimulationStrategy): Promise<AnvilInstance | null> {
    // Buscar instancia running con baja utilización
    for (const [instanceId, instance] of this.instances.entries()) {
      if (instance.status === 'running') {
        const utilization = await this.getInstanceUtilization(instanceId);
        const poolConfig = this.poolConfigs.get(strategy);
        
        if (utilization < (poolConfig?.target_utilization || 0.7)) {
          return instance;
        }
      }
    }

    // Si no hay instancia disponible, crear nueva si es posible
    const poolConfig = this.poolConfigs.get(strategy);
    const currentInstances = Array.from(this.instances.values())
      .filter(i => i.status === 'running').length;

    if (currentInstances < (poolConfig?.max_instances || 5)) {
      return await this.createInstanceForStrategy(strategy);
    }

    return null;
  }

  /**
   * Crear instancia optimizada para estrategia específica
   */
  private async createInstanceForStrategy(strategy: SimulationStrategy): Promise<AnvilInstance> {
    const instanceId = uuidv4();
    const port = await this.findAvailablePort();
    
    // Configuración optimizada por estrategia
    const config: AnvilConfig = {
      instance_id: instanceId,
      port,
      chain_id: this.getOptimalChainId(strategy),
      fork_url: this.getOptimalForkUrl(strategy),
      accounts: this.getOptimalAccountCount(strategy),
      balance: this.getOptimalBalance(strategy),
      gas_limit: "30000000",
      gas_price: "1000000000",
      block_time: this.getOptimalBlockTime(strategy),
      enable_auto_impersonation: true,
      enable_code_size_limit: false,
      silent: false
    };

    return await this.createInstance(config);
  }

  /**
   * Health check de instancia
   */
  async healthCheck(instanceId: string): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    try {
      const instance = this.instances.get(instanceId);
      if (!instance) {
        return {
          instance_id: instanceId,
          status: 'unhealthy',
          response_time_ms: Date.now() - startTime,
          error: 'Instance not found',
          timestamp
        };
      }

      // Crear provider para test
      const provider = new ethers.JsonRpcProvider(`http://localhost:${instance.config.port}`);
      
      // Test básico: obtener block number
      const blockNumber = await Promise.race([
        provider.getBlockNumber(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Health check timeout')), 5000)
        )
      ]);

      const responseTime = Date.now() - startTime;

      // Actualizar métricas de instancia
      instance.last_health_check = timestamp;
      
      return {
        instance_id: instanceId,
        status: 'healthy',
        response_time_ms: responseTime,
        block_number: blockNumber,
        timestamp
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.logger.warn(`Health check failed for instance ${instanceId}: ${errorMessage}`);

      // Marcar instancia como unhealthy
      this.updateInstanceStatus(instanceId, 'health_check_failed', errorMessage);

      return {
        instance_id: instanceId,
        status: 'unhealthy',
        response_time_ms: responseTime,
        error: errorMessage,
        timestamp
      };
    }
  }

  /**
   * Obtener todas las instancias
   */
  getAllInstances(): AnvilInstance[] {
    return Array.from(this.instances.values());
  }

  /**
   * Obtener instancia por ID
   */
  getInstance(instanceId: string): AnvilInstance | undefined {
    return this.instances.get(instanceId);
  }

  // Métodos auxiliares privados

  private buildAnvilArgs(config: AnvilConfig): string[] {
    const args: string[] = [
      '--port', config.port.toString(),
      '--chain-id', config.chain_id.toString(),
      '--fork-url', config.fork_url,
      '--accounts', config.accounts.toString(),
      '--balance', config.balance,
      '--gas-limit', config.gas_limit,
      '--gas-price', config.gas_price,
      '--block-time', config.block_time.toString(),
      '--host', '0.0.0.0'
    ];

    if (config.fork_block_number) {
      args.push('--fork-block-number', config.fork_block_number.toString());
    }

    if (config.base_fee) {
      args.push('--base-fee', config.base_fee);
    }

    if (config.enable_auto_impersonation) {
      args.push('--auto-impersonate');
    }

    if (config.enable_code_size_limit) {
      args.push('--disable-code-size-limit');
    }

    if (config.silent) {
      args.push('--silent');
    }

    return args;
  }

  private async checkPortAvailable(port: number): Promise<void> {
    // Implementación simplificada - en producción usar net.createServer()
    const usedPorts = Array.from(this.instances.values()).map(i => i.config.port);
    if (usedPorts.includes(port)) {
      throw new Error(`Port ${port} already in use`);
    }
  }

  private async validateRealDataSource(forkUrl: string): Promise<void> {
    try {
      const provider = new ethers.JsonRpcProvider(forkUrl);
      await provider.getBlockNumber();
    } catch (error) {
      throw new Error(`Real-Only policy violation: Invalid fork URL ${forkUrl}`);
    }
  }

  private async findAvailablePort(): Promise<number> {
    let port = 8545;
    const usedPorts = new Set(Array.from(this.instances.values()).map(i => i.config.port));
    
    while (usedPorts.has(port) && port < 9000) {
      port++;
    }
    
    if (port >= 9000) {
      throw new Error('No available ports for Anvil instance');
    }
    
    return port;
  }

  private async waitForInstanceReady(instanceId: string, timeoutMs: number): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      try {
        const healthResult = await this.healthCheck(instanceId);
        if (healthResult.status === 'healthy') {
          return;
        }
      } catch (error) {
        // Continuar intentando
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error(`Instance ${instanceId} not ready within ${timeoutMs}ms`);
  }

  private updateInstanceStatus(instanceId: string, status: AnvilInstanceStatus, error?: string): void {
    const instance = this.instances.get(instanceId);
    if (instance) {
      instance.status = status;
      if (error) {
        instance.error_message = error;
      }
    }
  }

  private handleInstanceExit(instanceId: string, code: number | null, signal: NodeJS.Signals | null): void {
    this.logger.warn(`Anvil instance ${instanceId} exited`, { code, signal });
    
    this.updateInstanceStatus(instanceId, 'stopped');
    this.stopHealthChecking(instanceId);
    this.processes.delete(instanceId);
  }

  private startHealthChecking(instanceId: string): void {
    const interval = setInterval(async () => {
      await this.healthCheck(instanceId);
    }, 30000); // 30 segundos

    this.healthCheckIntervals.set(instanceId, interval);
  }

  private stopHealthChecking(instanceId: string): void {
    const interval = this.healthCheckIntervals.get(instanceId);
    if (interval) {
      clearInterval(interval);
      this.healthCheckIntervals.delete(instanceId);
    }
  }

  private startGlobalHealthMonitoring(): void {
    setInterval(async () => {
      // Auto-scaling logic aquí
      await this.performAutoScaling();
    }, 60000); // 1 minuto
  }

  private async performAutoScaling(): Promise<void> {
    for (const [strategy, poolConfig] of this.poolConfigs.entries()) {
      const instances = Array.from(this.instances.values())
        .filter(i => i.status === 'running');

      const avgUtilization = await this.getAverageUtilization(instances);

      // Scale up si utilización alta
      if (avgUtilization > poolConfig.scale_up_threshold && instances.length < poolConfig.max_instances) {
        this.logger.info(`Scaling up ${strategy} pool`, { utilization: avgUtilization });
        await this.createInstanceForStrategy(strategy);
      }

      // Scale down si utilización baja
      if (avgUtilization < poolConfig.scale_down_threshold && instances.length > poolConfig.min_instances) {
        this.logger.info(`Scaling down ${strategy} pool`, { utilization: avgUtilization });
        const instanceToRemove = instances[instances.length - 1];
        await this.stopInstance(instanceToRemove.instance_id);
      }
    }
  }

  private async getInstanceUtilization(instanceId: string): Promise<number> {
    // Implementación simplificada - calcular basado en simulaciones activas
    const activeSimulations = await this.redis.scard(`simulations:active:${instanceId}`);
    return Math.min(activeSimulations / 10, 1.0); // Max 10 simulaciones concurrentes
  }

  private async getAverageUtilization(instances: AnvilInstance[]): Promise<number> {
    if (instances.length === 0) return 0;
    
    const utilizations = await Promise.all(
      instances.map(i => this.getInstanceUtilization(i.instance_id))
    );
    
    return utilizations.reduce((sum, util) => sum + util, 0) / utilizations.length;
  }

  private async cacheInstance(instance: AnvilInstance): Promise<void> {
    await this.redis.setex(
      `anvil:instance:${instance.instance_id}`,
      3600, // 1 hora
      JSON.stringify(instance)
    );
  }

  // Configuraciones optimizadas por estrategia
  private getOptimalChainId(strategy: SimulationStrategy): number {
    const chainMap: Record<SimulationStrategy, number> = {
      'A': 1,     // Ethereum Mainnet para DEX arbitrage
      'C': 137,   // Polygon para high-frequency
      'D': 42161, // Arbitrum para L2 arbitrage  
      'F': 10     // Optimism para lending arbitrage
    };
    return chainMap[strategy];
  }

  private getOptimalForkUrl(strategy: SimulationStrategy): string {
    // En producción, estas URLs vendrían de configuración
    const urlMap: Record<SimulationStrategy, string> = {
      'A': process.env.ETHEREUM_RPC_URL || 'https://eth-mainnet.alchemyapi.io/v2/YOUR_KEY',
      'C': process.env.POLYGON_RPC_URL || 'https://polygon-mainnet.infura.io/v3/YOUR_KEY',
      'D': process.env.ARBITRUM_RPC_URL || 'https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY',
      'F': process.env.OPTIMISM_RPC_URL || 'https://opt-mainnet.g.alchemy.com/v2/YOUR_KEY'
    };
    return urlMap[strategy];
  }

  private getOptimalAccountCount(strategy: SimulationStrategy): number {
    const accountMap: Record<SimulationStrategy, number> = {
      'A': 20,  // Más cuentas para DEX arbitrage
      'C': 10,  // Standard para high-frequency
      'D': 15,  // Intermedio para L2
      'F': 25   // Más para lending operations
    };
    return accountMap[strategy];
  }

  private getOptimalBalance(strategy: SimulationStrategy): string {
    const balanceMap: Record<SimulationStrategy, string> = {
      'A': "50000",   // 50K ETH para DEX arbitrage
      'C': "10000",   // 10K ETH para high-frequency
      'D': "25000",   // 25K ETH para L2
      'F': "100000"   // 100K ETH para lending
    };
    return balanceMap[strategy];
  }

  private getOptimalBlockTime(strategy: SimulationStrategy): number {
    const blockTimeMap: Record<SimulationStrategy, number> = {
      'A': 12,  // Ethereum block time
      'C': 2,   // Fast para Polygon
      'D': 1,   // Very fast para Arbitrum
      'F': 2    // Fast para Optimism
    };
    return blockTimeMap[strategy];
  }
}
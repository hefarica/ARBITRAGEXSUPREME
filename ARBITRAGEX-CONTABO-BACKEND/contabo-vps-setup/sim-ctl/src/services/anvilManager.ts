import { spawn, ChildProcess } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';
import { ethers } from 'ethers';
import winston from 'winston';
import Decimal from 'decimal.js';
import {
  AnvilConfig,
  AnvilInstance,
  AnvilInstanceStatus,
  SimulationStrategy,
  InstancePoolConfig,
  HealthCheckResult
} from '../types/simulation.js';

export class AnvilManager {
  private redis: Redis;
  private logger: winston.Logger;
  private instances: Map<string, AnvilInstance> = new Map();
  private processes: Map<string, ChildProcess> = new Map();
  private poolConfigs: Map<SimulationStrategy, InstancePoolConfig> = new Map();
  private healthCheckIntervals: Map<string, NodeJS.Timeout> = new Map();

  // Configuración de puertos por estrategia
  private readonly strategyPortRanges = {
    'A': { start: 8545, end: 8554 }, // DEX Arbitrage
    'C': { start: 8555, end: 8564 }, // Cross-Chain Arbitrage  
    'D': { start: 8565, end: 8574 }, // Lending Arbitrage
    'F': { start: 8575, end: 8584 }  // Flash Loan Arbitrage
  };

  constructor(redis: Redis, logger: winston.Logger) {
    this.redis = redis;
    this.logger = logger;
    this.initializePoolConfigs();
    this.startPeriodicCleanup();
  }

  private initializePoolConfigs(): void {
    const strategies: SimulationStrategy[] = ['A', 'C', 'D', 'F'];
    
    strategies.forEach(strategy => {
      this.poolConfigs.set(strategy, {
        strategy,
        min_instances: 2,
        max_instances: 5,
        target_utilization: 0.7,
        scale_up_threshold: 0.8,
        scale_down_threshold: 0.3,
        health_check_interval_seconds: 30
      });
    });
  }

  /**
   * Inicializar pools de instancias para todas las estrategias
   */
  async initializePools(): Promise<void> {
    this.logger.info('🚀 Inicializando pools de instancias Anvil para ArbitrageX Supreme V3.0');
    
    for (const [strategy, config] of this.poolConfigs) {
      await this.ensureMinimumInstances(strategy, config);
    }

    this.logger.info('✅ Pools de instancias Anvil inicializados correctamente');
  }

  /**
   * Asegurar instancias mínimas para una estrategia
   */
  private async ensureMinimumInstances(
    strategy: SimulationStrategy, 
    config: InstancePoolConfig
  ): Promise<void> {
    const currentInstances = await this.getInstancesByStrategy(strategy);
    const runningInstances = currentInstances.filter(i => i.status === 'running');

    if (runningInstances.length < config.min_instances) {
      const needed = config.min_instances - runningInstances.length;
      this.logger.info(
        `📊 Estrategia ${strategy}: Creando ${needed} instancias adicionales ` +
        `(actual: ${runningInstances.length}, mínimo: ${config.min_instances})`
      );

      for (let i = 0; i < needed; i++) {
        await this.createInstance(strategy);
      }
    }
  }

  /**
   * Crear nueva instancia Anvil para una estrategia específica
   */
  async createInstance(strategy: SimulationStrategy, chainId?: number): Promise<string> {
    const instanceId = uuidv4();
    const port = await this.getAvailablePort(strategy);
    
    if (!port) {
      throw new Error(`❌ No hay puertos disponibles para estrategia ${strategy}`);
    }

    // Configuración Real-Only: usar RPC real según la estrategia
    const forkUrl = await this.getRealRpcUrl(strategy, chainId);
    
    const config: AnvilConfig = {
      instance_id: instanceId,
      port,
      chain_id: chainId || this.getDefaultChainId(strategy),
      fork_url: forkUrl,
      accounts: 10,
      balance: "10000", // 10000 ETH por cuenta
      gas_limit: "30000000",
      gas_price: "1000000000", // 1 gwei
      block_time: 1, // 1 segundo para simulaciones rápidas
      enable_auto_impersonation: true,
      enable_code_size_limit: false,
      silent: false
    };

    const instance: AnvilInstance = {
      instance_id: instanceId,
      config,
      status: 'starting',
      metrics: {
        blocks_mined: 0,
        transactions_processed: 0,
        gas_used: "0",
        uptime_seconds: 0
      }
    };

    // Guardar instancia en memoria y Redis
    this.instances.set(instanceId, instance);
    await this.saveInstanceToRedis(instance);

    try {
      await this.startAnvilProcess(instance);
      
      // Configurar health check
      this.setupHealthCheck(instanceId);
      
      this.logger.info(
        `✅ Instancia Anvil creada: ${instanceId} (${strategy}) en puerto ${port}, ` +
        `chain ${config.chain_id}, fork: ${forkUrl.substring(0, 50)}...`
      );
      
      return instanceId;
    } catch (error) {
      this.logger.error(`❌ Error creando instancia ${instanceId}:`, error);
      instance.status = 'error';
      instance.error_message = error instanceof Error ? error.message : 'Unknown error';
      await this.saveInstanceToRedis(instance);
      throw error;
    }
  }

  /**
   * Obtener RPC URL real según Real-Only policy
   */
  private async getRealRpcUrl(strategy: SimulationStrategy, chainId?: number): Promise<string> {
    // Real-Only Policy: usar solo RPCs reales configurados en .env
    const targetChainId = chainId || this.getDefaultChainId(strategy);
    
    const rpcKey = `RPC_URL_${targetChainId}`;
    const rpcUrl = process.env[rpcKey];
    
    if (!rpcUrl) {
      throw new Error(
        `❌ Real-Only Policy Violation: No se encontró RPC real para chain ${targetChainId}. ` +
        `Configure ${rpcKey} en variables de entorno.`
      );
    }

    // Validar que el RPC esté accesible
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      await provider.getBlockNumber();
      this.logger.info(`✅ RPC validado para chain ${targetChainId}: ${rpcUrl.substring(0, 50)}...`);
      return rpcUrl;
    } catch (error) {
      throw new Error(
        `❌ Real-Only Policy: RPC ${rpcUrl} no accesible para chain ${targetChainId}: ${error}`
      );
    }
  }

  /**
   * Obtener Chain ID por defecto según estrategia
   */
  private getDefaultChainId(strategy: SimulationStrategy): number {
    const defaults = {
      'A': 1,     // Ethereum Mainnet - DEX Arbitrage
      'C': 137,   // Polygon - Cross-Chain Arbitrage
      'D': 42161, // Arbitrum - Lending Arbitrage  
      'F': 1      // Ethereum - Flash Loan Arbitrage
    };
    return defaults[strategy];
  }

  /**
   * Iniciar proceso Anvil
   */
  private async startAnvilProcess(instance: AnvilInstance): Promise<void> {
    const { config } = instance;
    
    const anvilArgs = [
      '--port', config.port.toString(),
      '--chain-id', config.chain_id.toString(),
      '--fork-url', config.fork_url,
      '--accounts', config.accounts.toString(),
      '--balance', config.balance,
      '--gas-limit', config.gas_limit,
      '--gas-price', config.gas_price,
      '--block-time', config.block_time.toString(),
      '--host', '0.0.0.0' // Bind a todas las interfaces
    ];

    if (config.fork_block_number) {
      anvilArgs.push('--fork-block-number', config.fork_block_number.toString());
    }

    if (config.enable_auto_impersonation) {
      anvilArgs.push('--auto-impersonate');
    }

    if (!config.enable_code_size_limit) {
      anvilArgs.push('--disable-code-size-limit');
    }

    if (config.silent) {
      anvilArgs.push('--silent');
    }

    this.logger.info(`🔧 Iniciando Anvil: anvil ${anvilArgs.join(' ')}`);

    const anvilProcess = spawn('anvil', anvilArgs, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env }
    });

    // Manejar salida del proceso
    anvilProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      if (!config.silent) {
        this.logger.debug(`[Anvil ${instance.instance_id}] ${output.trim()}`);
      }
    });

    anvilProcess.stderr?.on('data', (data) => {
      const error = data.toString();
      this.logger.error(`[Anvil ${instance.instance_id}] ERROR: ${error.trim()}`);
    });

    anvilProcess.on('close', (code) => {
      this.logger.warn(`[Anvil ${instance.instance_id}] Proceso terminado con código: ${code}`);
      this.handleProcessExit(instance.instance_id, code);
    });

    anvilProcess.on('error', (error) => {
      this.logger.error(`[Anvil ${instance.instance_id}] Error de proceso:`, error);
      this.handleProcessError(instance.instance_id, error);
    });

    // Guardar referencia del proceso
    this.processes.set(instance.instance_id, anvilProcess);

    // Esperar que Anvil esté listo
    await this.waitForAnvilReady(instance);
    
    // Actualizar estado
    instance.status = 'running';
    instance.pid = anvilProcess.pid;
    instance.start_time = new Date().toISOString();
    
    await this.saveInstanceToRedis(instance);
  }

  /**
   * Esperar que Anvil esté listo para recibir conexiones
   */
  private async waitForAnvilReady(instance: AnvilInstance, maxRetries: number = 30): Promise<void> {
    const { config } = instance;
    const rpcUrl = `http://127.0.0.1:${config.port}`;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        await provider.getBlockNumber();
        this.logger.info(`✅ Anvil ${instance.instance_id} listo en ${rpcUrl}`);
        return;
      } catch (error) {
        if (i === maxRetries - 1) {
          throw new Error(`❌ Anvil ${instance.instance_id} no respondió después de ${maxRetries} intentos`);
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  /**
   * Obtener puerto disponible para una estrategia
   */
  private async getAvailablePort(strategy: SimulationStrategy): Promise<number | null> {
    const range = this.strategyPortRanges[strategy];
    
    for (let port = range.start; port <= range.end; port++) {
      if (!(await this.isPortInUse(port))) {
        return port;
      }
    }
    
    return null;
  }

  /**
   * Verificar si un puerto está en uso
   */
  private async isPortInUse(port: number): Promise<boolean> {
    // Verificar en instancias activas
    for (const instance of this.instances.values()) {
      if (instance.config.port === port && instance.status === 'running') {
        return true;
      }
    }
    return false;
  }

  /**
   * Configurar health check para una instancia
   */
  private setupHealthCheck(instanceId: string): void {
    const interval = setInterval(async () => {
      await this.performHealthCheck(instanceId);
    }, 30000); // 30 segundos

    this.healthCheckIntervals.set(instanceId, interval);
  }

  /**
   * Realizar health check de una instancia
   */
  private async performHealthCheck(instanceId: string): Promise<HealthCheckResult> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`❌ Instancia ${instanceId} no encontrada`);
    }

    const startTime = Date.now();
    const rpcUrl = `http://127.0.0.1:${instance.config.port}`;

    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const blockNumber = await provider.getBlockNumber();
      const responseTime = Date.now() - startTime;

      const result: HealthCheckResult = {
        instance_id: instanceId,
        status: 'healthy',
        response_time_ms: responseTime,
        block_number: blockNumber,
        timestamp: new Date().toISOString()
      };

      // Actualizar métricas de la instancia
      instance.last_health_check = result.timestamp;
      await this.saveInstanceToRedis(instance);

      return result;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      const result: HealthCheckResult = {
        instance_id: instanceId,
        status: responseTime > 5000 ? 'timeout' : 'unhealthy',
        response_time_ms: responseTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };

      // Marcar instancia como fallida
      instance.status = 'health_check_failed';
      instance.error_message = result.error;
      await this.saveInstanceToRedis(instance);

      this.logger.error(`❌ Health check fallido para ${instanceId}:`, result.error);
      
      // Intentar reiniciar la instancia
      await this.restartInstance(instanceId);

      return result;
    }
  }

  /**
   * Manejar salida de proceso
   */
  private async handleProcessExit(instanceId: string, code: number | null): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (instance) {
      instance.status = code === 0 ? 'stopped' : 'error';
      instance.error_message = code !== 0 ? `Process exited with code ${code}` : undefined;
      await this.saveInstanceToRedis(instance);
    }
    
    this.processes.delete(instanceId);
    
    const interval = this.healthCheckIntervals.get(instanceId);
    if (interval) {
      clearInterval(interval);
      this.healthCheckIntervals.delete(instanceId);
    }
  }

  /**
   * Manejar error de proceso
   */
  private async handleProcessError(instanceId: string, error: Error): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (instance) {
      instance.status = 'error';
      instance.error_message = error.message;
      await this.saveInstanceToRedis(instance);
    }
  }

  /**
   * Reiniciar instancia
   */
  async restartInstance(instanceId: string): Promise<void> {
    this.logger.info(`🔄 Reiniciando instancia ${instanceId}`);
    
    await this.stopInstance(instanceId);
    await new Promise(resolve => setTimeout(resolve, 2000)); // Esperar 2 segundos
    
    const instance = this.instances.get(instanceId);
    if (instance) {
      await this.startAnvilProcess(instance);
    }
  }

  /**
   * Detener instancia
   */
  async stopInstance(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`❌ Instancia ${instanceId} no encontrada`);
    }

    instance.status = 'stopping';
    await this.saveInstanceToRedis(instance);

    const process = this.processes.get(instanceId);
    if (process && !process.killed) {
      process.kill('SIGTERM');
      
      // Forzar terminación después de 5 segundos
      setTimeout(() => {
        if (!process.killed) {
          process.kill('SIGKILL');
        }
      }, 5000);
    }

    // Limpiar health check
    const interval = this.healthCheckIntervals.get(instanceId);
    if (interval) {
      clearInterval(interval);
      this.healthCheckIntervals.delete(instanceId);
    }

    this.logger.info(`🛑 Instancia ${instanceId} detenida`);
  }

  /**
   * Obtener instancias por estrategia
   */
  async getInstancesByStrategy(strategy: SimulationStrategy): Promise<AnvilInstance[]> {
    const instances: AnvilInstance[] = [];
    
    for (const instance of this.instances.values()) {
      // Determinar estrategia por rango de puerto
      const instanceStrategy = this.getStrategyByPort(instance.config.port);
      if (instanceStrategy === strategy) {
        instances.push(instance);
      }
    }
    
    return instances;
  }

  /**
   * Determinar estrategia por puerto
   */
  private getStrategyByPort(port: number): SimulationStrategy {
    for (const [strategy, range] of Object.entries(this.strategyPortRanges)) {
      if (port >= range.start && port <= range.end) {
        return strategy as SimulationStrategy;
      }
    }
    throw new Error(`❌ Puerto ${port} no corresponde a ninguna estrategia`);
  }

  /**
   * Obtener instancia disponible para simulación
   */
  async getAvailableInstance(strategy: SimulationStrategy): Promise<AnvilInstance | null> {
    const instances = await this.getInstancesByStrategy(strategy);
    const runningInstances = instances.filter(i => i.status === 'running');
    
    if (runningInstances.length === 0) {
      // Crear nueva instancia si no hay disponibles
      const instanceId = await this.createInstance(strategy);
      return this.instances.get(instanceId) || null;
    }
    
    // Devolver la instancia con menos carga (implementación simple)
    return runningInstances[0];
  }

  /**
   * Guardar instancia en Redis
   */
  private async saveInstanceToRedis(instance: AnvilInstance): Promise<void> {
    const key = `sim-ctl:instance:${instance.instance_id}`;
    await this.redis.setex(key, 3600, JSON.stringify(instance));
  }

  /**
   * Cleanup periódico
   */
  private startPeriodicCleanup(): void {
    setInterval(async () => {
      await this.cleanupFailedInstances();
    }, 300000); // 5 minutos
  }

  /**
   * Limpiar instancias fallidas
   */
  private async cleanupFailedInstances(): Promise<void> {
    const failedInstances = Array.from(this.instances.values())
      .filter(i => i.status === 'error' || i.status === 'health_check_failed');

    for (const instance of failedInstances) {
      this.logger.info(`🧹 Limpiando instancia fallida: ${instance.instance_id}`);
      await this.stopInstance(instance.instance_id);
      this.instances.delete(instance.instance_id);
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
  getInstance(instanceId: string): AnvilInstance | null {
    return this.instances.get(instanceId) || null;
  }

  /**
   * Shutdown del manager
   */
  async shutdown(): Promise<void> {
    this.logger.info('🛑 Cerrando AnvilManager...');
    
    // Detener todos los health checks
    for (const interval of this.healthCheckIntervals.values()) {
      clearInterval(interval);
    }
    
    // Detener todas las instancias
    const stopPromises = Array.from(this.instances.keys()).map(id => 
      this.stopInstance(id).catch(err => 
        this.logger.error(`Error deteniendo instancia ${id}:`, err)
      )
    );
    
    await Promise.all(stopPromises);
    this.logger.info('✅ AnvilManager cerrado correctamente');
  }
}
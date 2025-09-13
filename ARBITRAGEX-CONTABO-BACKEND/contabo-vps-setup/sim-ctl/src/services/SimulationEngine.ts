import { ethers } from 'ethers';
import Redis from 'ioredis';
import { Logger } from 'winston';
import { v4 as uuidv4 } from 'uuid';
import Decimal from 'decimal.js';
import {
  SimulationRequest,
  SimulationResult,
  SimulationStrategy,
  AnvilInstance,
  PerformanceMetrics
} from '../types/simulation.js';
import { AnvilManager } from './AnvilManager.js';

export class SimulationEngine {
  private activeSimulations: Map<string, { request: SimulationRequest; startTime: number }> = new Map();
  private metricsCache: Map<SimulationStrategy, PerformanceMetrics> = new Map();

  constructor(
    private anvilManager: AnvilManager,
    private redis: Redis,
    private logger: Logger
  ) {
    // Inicializar métricas por estrategia
    this.initializeMetrics();
    
    // Iniciar recolección periódica de métricas
    this.startMetricsCollection();
  }

  /**
   * Ejecutar simulación completa
   */
  async executeSimulation(request: SimulationRequest): Promise<SimulationResult> {
    const startTime = Date.now();
    const startTimestamp = new Date().toISOString();

    this.logger.info(`Starting simulation ${request.simulation_id}`, {
      strategy: request.strategy,
      chain_id: request.chain_id,
      transaction_count: request.transactions.length
    });

    try {
      // Real-Only Policy Enforcement
      if (request.real_only) {
        await this.enforceRealOnlyPolicy(request);
      }

      // Obtener instancia Anvil disponible para la estrategia
      const instance = await this.anvilManager.getAvailableInstance(request.strategy);
      if (!instance) {
        throw new Error(`No available Anvil instance for strategy ${request.strategy}`);
      }

      // Registrar simulación activa
      this.activeSimulations.set(request.simulation_id, { request, startTime });
      await this.redis.sadd(`simulations:active:${instance.instance_id}`, request.simulation_id);

      // Configurar provider para la instancia
      const provider = new ethers.JsonRpcProvider(`http://localhost:${instance.config.port}`);
      
      // Validar estado de la blockchain antes de simular
      await this.validateBlockchainState(provider, request);

      // Ejecutar transacciones con timeout
      const transactionResults = await Promise.race([
        this.executeTransactions(provider, request, instance),
        this.createTimeoutPromise(request.timeout_seconds * 1000)
      ]);

      const endTime = Date.now();
      const executionTimeMs = endTime - startTime;

      // Calcular métricas de profitabilidad
      const profitability = await this.calculateProfitability(
        transactionResults,
        request.strategy,
        provider
      );

      // Crear resultado
      const result: SimulationResult = {
        simulation_id: request.simulation_id,
        instance_id: instance.instance_id,
        strategy: request.strategy,
        chain_id: request.chain_id,
        status: 'success',
        start_time: startTimestamp,
        end_time: new Date().toISOString(),
        execution_time_ms: executionTimeMs,
        block_number: await provider.getBlockNumber(),
        gas_used: this.calculateTotalGasUsed(transactionResults),
        gas_price: instance.config.gas_price,
        transaction_results: transactionResults,
        profitability
      };

      // Actualizar métricas
      await this.updateMetrics(request.strategy, result);

      // Cachear resultado
      await this.cacheResult(result);

      this.logger.info(`Simulation ${request.simulation_id} completed successfully`, {
        execution_time_ms: executionTimeMs,
        gas_used: result.gas_used,
        profit: profitability?.net_profit
      });

      return result;

    } catch (error) {
      const endTime = Date.now();
      const executionTimeMs = endTime - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown simulation error';

      this.logger.error(`Simulation ${request.simulation_id} failed: ${errorMessage}`, error);

      // Determinar tipo de error
      let status: SimulationResult['status'] = 'error';
      if (errorMessage.includes('timeout')) {
        status = 'timeout';
      } else if (errorMessage.includes('revert') || errorMessage.includes('failed')) {
        status = 'failed';
      }

      const result: SimulationResult = {
        simulation_id: request.simulation_id,
        instance_id: 'unknown',
        strategy: request.strategy,
        chain_id: request.chain_id,
        status,
        start_time: startTimestamp,
        end_time: new Date().toISOString(),
        execution_time_ms: executionTimeMs,
        block_number: 0,
        gas_used: "0",
        gas_price: "0",
        transaction_results: [],
        error_message: errorMessage
      };

      // Actualizar métricas de error
      await this.updateMetrics(request.strategy, result);

      return result;

    } finally {
      // Limpiar simulación activa
      this.activeSimulations.delete(request.simulation_id);
      
      // Remover de Redis (buscar en todas las instancias)
      const instances = this.anvilManager.getAllInstances();
      for (const instance of instances) {
        await this.redis.srem(`simulations:active:${instance.instance_id}`, request.simulation_id);
      }
    }
  }

  /**
   * Ejecutar simulación batch (múltiples simulaciones paralelas)
   */
  async executeBatchSimulation(requests: SimulationRequest[]): Promise<SimulationResult[]> {
    this.logger.info(`Starting batch simulation with ${requests.length} requests`);

    // Validar límites de concurrencia
    const maxConcurrent = parseInt(process.env.MAX_CONCURRENT_SIMULATIONS || '10');
    if (requests.length > maxConcurrent) {
      throw new Error(`Batch size ${requests.length} exceeds maximum ${maxConcurrent}`);
    }

    // Ejecutar simulaciones en paralelo
    const results = await Promise.allSettled(
      requests.map(request => this.executeSimulation(request))
    );

    // Procesar resultados
    const processedResults: SimulationResult[] = [];
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'fulfilled') {
        processedResults.push(result.value);
      } else {
        // Crear resultado de error para simulaciones fallidas
        const failedRequest = requests[i];
        processedResults.push({
          simulation_id: failedRequest.simulation_id,
          instance_id: 'unknown',
          strategy: failedRequest.strategy,
          chain_id: failedRequest.chain_id,
          status: 'error',
          start_time: new Date().toISOString(),
          end_time: new Date().toISOString(),
          execution_time_ms: 0,
          block_number: 0,
          gas_used: "0",
          gas_price: "0",
          transaction_results: [],
          error_message: result.reason?.message || 'Batch simulation error'
        });
      }
    }

    this.logger.info(`Batch simulation completed`, {
      total: requests.length,
      successful: processedResults.filter(r => r.status === 'success').length,
      failed: processedResults.filter(r => r.status !== 'success').length
    });

    return processedResults;
  }

  /**
   * Obtener métricas de performance por estrategia
   */
  getPerformanceMetrics(strategy?: SimulationStrategy): PerformanceMetrics | PerformanceMetrics[] {
    if (strategy) {
      return this.metricsCache.get(strategy) || this.createEmptyMetrics(strategy);
    }
    
    return Array.from(this.metricsCache.values());
  }

  /**
   * Obtener simulaciones activas
   */
  getActiveSimulations(): Array<{ simulation_id: string; request: SimulationRequest; runtime_ms: number }> {
    const now = Date.now();
    return Array.from(this.activeSimulations.entries()).map(([id, { request, startTime }]) => ({
      simulation_id: id,
      request,
      runtime_ms: now - startTime
    }));
  }

  // Métodos privados

  private async enforceRealOnlyPolicy(request: SimulationRequest): Promise<void> {
    // Validar que todas las direcciones sean contratos reales
    const provider = new ethers.JsonRpcProvider(
      this.getRealRpcUrl(request.chain_id)
    );

    for (const tx of request.transactions) {
      const code = await provider.getCode(tx.to);
      if (code === '0x') {
        throw new Error(`Real-Only policy violation: ${tx.to} is not a contract on chain ${request.chain_id}`);
      }
    }

    // Validar que el fork_block_number sea reciente (última hora)
    if (request.fork_block_number) {
      const currentBlock = await provider.getBlockNumber();
      const blockDiff = currentBlock - request.fork_block_number;
      const maxBlockDiff = 300; // ~1 hora en Ethereum
      
      if (blockDiff > maxBlockDiff) {
        throw new Error(`Real-Only policy violation: Fork block ${request.fork_block_number} is too old (${blockDiff} blocks behind)`);
      }
    }
  }

  private async validateBlockchainState(provider: ethers.JsonRpcProvider, request: SimulationRequest): Promise<void> {
    // Verificar conectividad
    const blockNumber = await provider.getBlockNumber();
    if (blockNumber === 0) {
      throw new Error('Invalid blockchain state: block number is 0');
    }

    // Verificar chain ID
    const network = await provider.getNetwork();
    if (Number(network.chainId) !== request.chain_id) {
      throw new Error(`Chain ID mismatch: expected ${request.chain_id}, got ${network.chainId}`);
    }

    // Verificar balances de gas para transacciones
    const accounts = await provider.listAccounts();
    if (accounts.length === 0) {
      throw new Error('No accounts available for simulation');
    }
  }

  private async executeTransactions(
    provider: ethers.JsonRpcProvider,
    request: SimulationRequest,
    instance: AnvilInstance
  ): Promise<SimulationResult['transaction_results']> {
    const results: SimulationResult['transaction_results'] = [];
    const signer = await provider.getSigner(0); // Usar primera cuenta

    for (let i = 0; i < request.transactions.length; i++) {
      const tx = request.transactions[i];
      
      try {
        this.logger.debug(`Executing transaction ${i + 1}/${request.transactions.length}`, {
          to: tx.to,
          data: tx.data.substring(0, 20) + '...'
        });

        // Preparar transacción
        const txRequest: ethers.TransactionRequest = {
          to: tx.to,
          data: tx.data,
          value: tx.value || "0",
          gasLimit: tx.gas_limit || instance.config.gas_limit,
          gasPrice: tx.gas_price || instance.config.gas_price
        };

        // Enviar transacción
        const response = await signer.sendTransaction(txRequest);
        
        // Esperar confirmación
        const receipt = await response.wait();
        
        if (!receipt) {
          throw new Error('Transaction receipt is null');
        }

        // Procesar resultado
        const result = {
          hash: receipt.hash,
          status: receipt.status === 1 ? 'success' as const : 'failed' as const,
          gas_used: receipt.gasUsed.toString(),
          logs: receipt.logs.map(log => ({
            address: log.address,
            topics: log.topics,
            data: log.data
          }))
        };

        results.push(result);

        // Actualizar métricas de instancia
        instance.metrics.transactions_processed++;
        instance.metrics.gas_used = new Decimal(instance.metrics.gas_used)
          .plus(receipt.gasUsed.toString())
          .toString();

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Transaction execution error';
        
        this.logger.warn(`Transaction ${i + 1} failed: ${errorMessage}`);
        
        results.push({
          hash: '0x' + '0'.repeat(64), // Hash dummy para transacción fallida
          status: 'reverted',
          gas_used: '0',
          error: errorMessage
        });

        // Si es estrategia crítica, fallar toda la simulación
        if (request.strategy === 'A' || request.strategy === 'F') {
          throw new Error(`Critical transaction failed: ${errorMessage}`);
        }
      }
    }

    return results;
  }

  private async calculateProfitability(
    transactionResults: SimulationResult['transaction_results'],
    strategy: SimulationStrategy,
    provider: ethers.JsonRpcProvider
  ): Promise<SimulationResult['profitability']> {
    try {
      // Calcular gas total usado
      const totalGasUsed = transactionResults.reduce((sum, result) => {
        return new Decimal(sum).plus(result.gas_used || '0').toString();
      }, '0');

      // Obtener precio actual de gas y ETH
      const gasPrice = await provider.getGasPrice();
      const gasCostWei = new Decimal(totalGasUsed).mul(gasPrice.toString());
      const gasCostEth = gasCostWei.div(10**18);

      // Calcular profit basado en estrategia
      const grossProfit = await this.calculateGrossProfitByStrategy(
        strategy,
        transactionResults,
        provider
      );

      const netProfit = new Decimal(grossProfit).minus(gasCostEth);
      const roiPercentage = gasCostEth.isZero() 
        ? "0" 
        : netProfit.div(gasCostEth).mul(100).toString();

      // Calcular risk score basado en éxito de transacciones
      const successfulTxs = transactionResults.filter(r => r.status === 'success').length;
      const riskScore = Math.max(0, Math.min(100, 
        100 - (successfulTxs / transactionResults.length) * 100
      ));

      return {
        gross_profit: grossProfit,
        net_profit: netProfit.toString(),
        roi_percentage: roiPercentage,
        risk_score: riskScore
      };

    } catch (error) {
      this.logger.warn('Failed to calculate profitability', error);
      return {
        gross_profit: "0",
        net_profit: "0", 
        roi_percentage: "0",
        risk_score: 100
      };
    }
  }

  private async calculateGrossProfitByStrategy(
    strategy: SimulationStrategy,
    transactionResults: SimulationResult['transaction_results'],
    provider: ethers.JsonRpcProvider
  ): Promise<string> {
    // Implementación simplificada - en producción esto sería más complejo
    // y requeriría análisis específico de logs por estrategia
    
    const strategyMultipliers: Record<SimulationStrategy, number> = {
      'A': 0.05,  // DEX arbitrage: 5% profit potential
      'C': 0.02,  // High-frequency: 2% profit potential  
      'D': 0.03,  // L2 arbitrage: 3% profit potential
      'F': 0.08   // Lending arbitrage: 8% profit potential
    };

    // Profit estimado basado en gas usado y multiplicador de estrategia
    const totalGasUsed = transactionResults.reduce((sum, result) => {
      return new Decimal(sum).plus(result.gas_used || '0').toString();
    }, '0');

    const estimatedValue = new Decimal(totalGasUsed)
      .mul(strategyMultipliers[strategy])
      .div(10**18); // Convertir a ETH

    return estimatedValue.toString();
  }

  private calculateTotalGasUsed(transactionResults: SimulationResult['transaction_results']): string {
    return transactionResults.reduce((sum, result) => {
      return new Decimal(sum).plus(result.gas_used || '0').toString();
    }, '0');
  }

  private async updateMetrics(strategy: SimulationStrategy, result: SimulationResult): Promise<void> {
    const metrics = this.metricsCache.get(strategy) || this.createEmptyMetrics(strategy);

    // Actualizar contadores
    metrics.total_simulations++;
    if (result.status === 'success') {
      metrics.successful_simulations++;
    } else {
      metrics.failed_simulations++;
    }

    // Actualizar tiempos de ejecución (running average)
    const newAvg = (metrics.average_execution_time_ms * (metrics.total_simulations - 1) + result.execution_time_ms) 
      / metrics.total_simulations;
    metrics.average_execution_time_ms = newAvg;

    // Actualizar P95 (simplificado)
    if (result.execution_time_ms > metrics.p95_execution_time_ms) {
      metrics.p95_execution_time_ms = result.execution_time_ms;
    }

    // Actualizar gas y profit
    metrics.total_gas_used = new Decimal(metrics.total_gas_used)
      .plus(result.gas_used)
      .toString();

    if (result.profitability) {
      metrics.total_profit_eth = new Decimal(metrics.total_profit_eth)
        .plus(result.profitability.net_profit)
        .toString();
    }

    // Calcular success rate
    metrics.success_rate_percentage = (metrics.successful_simulations / metrics.total_simulations) * 100;

    metrics.last_updated = new Date().toISOString();

    // Actualizar cache
    this.metricsCache.set(strategy, metrics);

    // Persistir en Redis
    await this.redis.setex(
      `metrics:strategy:${strategy}`,
      3600, // 1 hora
      JSON.stringify(metrics)
    );
  }

  private createEmptyMetrics(strategy: SimulationStrategy): PerformanceMetrics {
    return {
      strategy,
      total_simulations: 0,
      successful_simulations: 0,
      failed_simulations: 0,
      average_execution_time_ms: 0,
      p95_execution_time_ms: 0,
      total_gas_used: "0",
      total_profit_eth: "0",
      success_rate_percentage: 0,
      last_updated: new Date().toISOString()
    };
  }

  private async cacheResult(result: SimulationResult): Promise<void> {
    await this.redis.setex(
      `simulation:result:${result.simulation_id}`,
      3600, // 1 hora
      JSON.stringify(result)
    );
  }

  private createTimeoutPromise<T>(timeoutMs: number): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Simulation timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  }

  private getRealRpcUrl(chainId: number): string {
    const rpcMap: Record<number, string> = {
      1: process.env.ETHEREUM_RPC_URL || 'https://eth-mainnet.alchemyapi.io/v2/YOUR_KEY',
      137: process.env.POLYGON_RPC_URL || 'https://polygon-mainnet.infura.io/v3/YOUR_KEY',
      42161: process.env.ARBITRUM_RPC_URL || 'https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY',
      10: process.env.OPTIMISM_RPC_URL || 'https://opt-mainnet.g.alchemy.com/v2/YOUR_KEY'
    };
    
    const url = rpcMap[chainId];
    if (!url) {
      throw new Error(`No RPC URL configured for chain ID ${chainId}`);
    }
    
    return url;
  }

  private initializeMetrics(): void {
    const strategies: SimulationStrategy[] = ['A', 'C', 'D', 'F'];
    strategies.forEach(strategy => {
      this.metricsCache.set(strategy, this.createEmptyMetrics(strategy));
    });
  }

  private startMetricsCollection(): void {
    // Recolectar métricas cada 5 minutos
    setInterval(async () => {
      await this.collectSystemMetrics();
    }, 5 * 60 * 1000);
  }

  private async collectSystemMetrics(): Promise<void> {
    try {
      // Recolectar métricas del sistema
      const instances = this.anvilManager.getAllInstances();
      const activeSimulations = this.getActiveSimulations();

      const systemMetrics = {
        timestamp: new Date().toISOString(),
        total_instances: instances.length,
        running_instances: instances.filter(i => i.status === 'running').length,
        active_simulations: activeSimulations.length,
        memory_usage: process.memoryUsage(),
        uptime: process.uptime()
      };

      await this.redis.setex(
        'metrics:system',
        300, // 5 minutos
        JSON.stringify(systemMetrics)
      );

    } catch (error) {
      this.logger.error('Failed to collect system metrics', error);
    }
  }
}
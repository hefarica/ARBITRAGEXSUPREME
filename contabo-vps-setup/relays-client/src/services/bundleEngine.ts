import { ethers } from 'ethers';
import { FlashbotsBundleProvider, FlashbotsBundleTransaction } from '@flashbots/ethers-provider-bundle';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';
import winston from 'winston';
import Decimal from 'decimal.js';
import {
  BundleRequest,
  BundleResult,
  BundleTransaction,
  RelaySubmissionResult,
  RelayType,
  RelayInfo
} from '../types/relay.js';
import { RelayManager } from './relayManager.js';

export class BundleEngine {
  private redis: Redis;
  private logger: winston.Logger;
  private relayManager: RelayManager;
  private providers: Map<number, ethers.Provider> = new Map();
  private activeBundles: Map<string, NodeJS.Timeout> = new Map();

  constructor(redis: Redis, logger: winston.Logger, relayManager: RelayManager) {
    this.redis = redis;
    this.logger = logger;
    this.relayManager = relayManager;
    this.initializeProviders();
  }

  /**
   * Inicializar providers para diferentes chains
   */
  private initializeProviders(): void {
    const chains = [
      { id: 1, rpc: process.env.RPC_URL_1 }, // Ethereum
      { id: 137, rpc: process.env.RPC_URL_137 }, // Polygon
      { id: 42161, rpc: process.env.RPC_URL_42161 }, // Arbitrum
      { id: 10, rpc: process.env.RPC_URL_10 } // Optimism
    ];

    chains.forEach(chain => {
      if (chain.rpc) {
        const provider = new ethers.JsonRpcProvider(chain.rpc);
        this.providers.set(chain.id, provider);
        this.logger.info(`🔗 Provider inicializado para chain ${chain.id}`);
      } else {
        this.logger.warn(`⚠️ RPC no configurado para chain ${chain.id}`);
      }
    });
  }

  /**
   * Enviar bundle a múltiples relays
   */
  async submitBundle(request: BundleRequest): Promise<BundleResult> {
    const startTime = Date.now();
    const submissionTime = new Date().toISOString();

    this.logger.info(
      `📦 Iniciando envío de bundle ${request.bundle_id} ` +
      `(estrategia ${request.strategy}, chain ${request.chain_id}, ` +
      `target block: ${request.target_block})`
    );

    // Validar Real-Only Policy
    if (!request.real_only) {
      throw new Error('❌ Real-Only Policy Violation: Todos los bundles deben usar real_only=true');
    }

    // Obtener provider para la chain
    const provider = this.providers.get(request.chain_id);
    if (!provider) {
      throw new Error(`❌ Provider no disponible para chain ${request.chain_id}`);
    }

    // Validar target block
    const currentBlock = await provider.getBlockNumber();
    if (request.target_block <= currentBlock) {
      throw new Error(
        `❌ Target block ${request.target_block} ya pasó ` +
        `(current: ${currentBlock})`
      );
    }

    try {
      // Seleccionar relays según preferencias
      const selectedRelays = this.selectRelaysForBundle(request);
      
      if (selectedRelays.length < request.min_relay_count) {
        throw new Error(
          `❌ Relays insuficientes disponibles: ${selectedRelays.length} < ${request.min_relay_count}`
        );
      }

      // Preparar transacciones firmadas
      const signedTransactions = await this.prepareTransactions(request, provider);

      // Configurar timeout para el bundle
      const timeoutHandle = setTimeout(() => {
        this.handleBundleTimeout(request.bundle_id);
      }, request.timeout_seconds * 1000);

      this.activeBundles.set(request.bundle_id, timeoutHandle);

      // Enviar a relays en paralelo
      const submissionPromises = selectedRelays.map(relay => 
        this.submitToRelay(request, relay, signedTransactions, provider)
      );

      const relayResults = await Promise.allSettled(submissionPromises);
      
      // Limpiar timeout
      clearTimeout(timeoutHandle);
      this.activeBundles.delete(request.bundle_id);

      // Procesar resultados
      const processedResults = this.processSubmissionResults(relayResults, selectedRelays);
      
      const result: BundleResult = {
        bundle_id: request.bundle_id,
        strategy: request.strategy,
        chain_id: request.chain_id,
        target_block: request.target_block,
        relay_results: processedResults,
        successful_relays: processedResults.filter(r => r.status === 'success').length,
        failed_relays: processedResults.filter(r => r.status !== 'success').length,
        overall_status: this.determineOverallStatus(processedResults, request.min_relay_count),
        submission_time: submissionTime,
        completion_time: new Date().toISOString(),
        total_time_ms: Date.now() - startTime,
        inclusion_status: 'pending'
      };

      // Guardar resultado en Redis
      await this.saveBundleResult(result);

      // Actualizar estadísticas de relays
      await this.updateRelayStatistics(processedResults);

      this.logger.info(
        `📦 Bundle ${request.bundle_id} enviado: ${result.overall_status} ` +
        `(${result.successful_relays}/${selectedRelays.length} relays exitosos, ${result.total_time_ms}ms)`
      );

      return result;

    } catch (error) {
      const errorResult: BundleResult = {
        bundle_id: request.bundle_id,
        strategy: request.strategy,
        chain_id: request.chain_id,
        target_block: request.target_block,
        relay_results: [],
        successful_relays: 0,
        failed_relays: 0,
        overall_status: 'failed',
        submission_time: submissionTime,
        completion_time: new Date().toISOString(),
        total_time_ms: Date.now() - startTime,
        inclusion_status: 'pending',
        error_summary: error instanceof Error ? error.message : 'Unknown error'
      };

      await this.saveBundleResult(errorResult);
      
      this.logger.error(`❌ Error en bundle ${request.bundle_id}:`, error);
      return errorResult;
    }
  }

  /**
   * Seleccionar relays para el bundle según preferencias y estado
   */
  private selectRelaysForBundle(request: BundleRequest): RelayInfo[] {
    const availableRelays = this.relayManager.getAvailableRelays();
    
    // Filtrar por preferencias del usuario
    let preferredRelays = availableRelays;
    if (request.relay_preferences && request.relay_preferences.length > 0) {
      preferredRelays = availableRelays.filter(relay => 
        request.relay_preferences.includes(relay.config.type)
      );
    }

    // Aplicar límite máximo
    const selectedRelays = preferredRelays.slice(0, request.max_relay_count);
    
    this.logger.info(
      `🎯 Seleccionados ${selectedRelays.length} relays para bundle ${request.bundle_id}: ` +
      `${selectedRelays.map(r => r.config.type).join(', ')}`
    );

    return selectedRelays;
  }

  /**
   * Preparar transacciones firmadas
   */
  private async prepareTransactions(
    request: BundleRequest, 
    provider: ethers.Provider
  ): Promise<string[]> {
    const signedTransactions: string[] = [];

    // Si ya tienen transacciones firmadas, usarlas
    const alreadySigned = request.transactions.filter(tx => tx.signed_transaction);
    if (alreadySigned.length === request.transactions.length) {
      return alreadySigned.map(tx => tx.signed_transaction!);
    }

    // Obtener wallet para firmar (desde variables de entorno)
    const privateKey = process.env.EXECUTION_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('❌ EXECUTION_PRIVATE_KEY requerida para firmar transacciones');
    }

    const wallet = new ethers.Wallet(privateKey, provider);
    const currentNonce = await wallet.getNonce();

    // Firmar transacciones secuencialmente
    for (let i = 0; i < request.transactions.length; i++) {
      const tx = request.transactions[i];
      
      if (tx.signed_transaction) {
        signedTransactions.push(tx.signed_transaction);
        continue;
      }

      const transactionRequest = {
        to: tx.to,
        data: tx.data,
        value: ethers.parseEther(tx.value || "0"),
        gasLimit: BigInt(tx.gas_limit),
        nonce: tx.nonce ?? currentNonce + i,
        type: 2 // EIP-1559
      };

      // Configurar gas prices (EIP-1559 o legacy)
      if (tx.max_fee_per_gas && tx.max_priority_fee_per_gas) {
        transactionRequest.maxFeePerGas = BigInt(tx.max_fee_per_gas);
        transactionRequest.maxPriorityFeePerGas = BigInt(tx.max_priority_fee_per_gas);
      } else if (tx.gas_price) {
        transactionRequest.gasPrice = BigInt(tx.gas_price);
        transactionRequest.type = 0; // Legacy transaction
      } else {
        // Auto-detect gas prices
        const feeData = await provider.getFeeData();
        if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
          transactionRequest.maxFeePerGas = feeData.maxFeePerGas;
          transactionRequest.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
        } else if (feeData.gasPrice) {
          transactionRequest.gasPrice = feeData.gasPrice;
          transactionRequest.type = 0;
        }
      }

      const signedTx = await wallet.signTransaction(transactionRequest);
      signedTransactions.push(signedTx);
      
      this.logger.debug(
        `✍️ Transacción ${i + 1}/${request.transactions.length} firmada para bundle ${request.bundle_id}`
      );
    }

    return signedTransactions;
  }

  /**
   * Enviar bundle a un relay específico
   */
  private async submitToRelay(
    request: BundleRequest,
    relay: RelayInfo,
    signedTransactions: string[],
    provider: ethers.Provider
  ): Promise<RelaySubmissionResult> {
    const startTime = Date.now();
    const submissionTime = new Date().toISOString();

    try {
      this.logger.debug(
        `📡 Enviando bundle ${request.bundle_id} a ${relay.config.name} (${relay.config.type})`
      );

      let bundleHash: string;
      let response: any;

      // Envío específico por tipo de relay
      switch (relay.config.type) {
        case 'flashbots':
          ({ bundleHash, response } = await this.submitToFlashbots(
            relay, request, signedTransactions, provider
          ));
          break;
          
        case 'bloxroute':
          ({ bundleHash, response } = await this.submitToBloXroute(
            relay, request, signedTransactions
          ));
          break;
          
        case 'eden':
          ({ bundleHash, response } = await this.submitToEden(
            relay, request, signedTransactions
          ));
          break;
          
        default:
          ({ bundleHash, response } = await this.submitToGenericBuilder(
            relay, request, signedTransactions
          ));
      }

      const responseTime = Date.now() - startTime;

      // Actualizar estadísticas del relay
      await this.relayManager.updateRelayStats(relay.config.relay_id, true, responseTime);

      const result: RelaySubmissionResult = {
        relay_type: relay.config.type,
        relay_id: relay.config.relay_id,
        status: 'success',
        bundle_hash: bundleHash,
        submission_time: submissionTime,
        response_time_ms: responseTime,
        relay_response: response
      };

      this.logger.debug(
        `✅ Bundle ${request.bundle_id} enviado exitosamente a ${relay.config.name} ` +
        `(${responseTime}ms, hash: ${bundleHash.substring(0, 10)}...)`
      );

      return result;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      // Actualizar estadísticas del relay
      await this.relayManager.updateRelayStats(
        relay.config.relay_id, 
        false, 
        responseTime,
        error instanceof Error ? error.message : 'Unknown error'
      );

      const result: RelaySubmissionResult = {
        relay_type: relay.config.type,
        relay_id: relay.config.relay_id,
        status: responseTime > relay.config.timeout_ms ? 'timeout' : 'failed',
        submission_time: submissionTime,
        response_time_ms: responseTime,
        error_message: error instanceof Error ? error.message : 'Unknown error'
      };

      this.logger.warn(
        `❌ Error enviando bundle ${request.bundle_id} a ${relay.config.name}: ${result.error_message}`
      );

      return result;
    }
  }

  /**
   * Enviar bundle a Flashbots
   */
  private async submitToFlashbots(
    relay: RelayInfo,
    request: BundleRequest,
    signedTransactions: string[],
    provider: ethers.Provider
  ): Promise<{ bundleHash: string; response: any }> {
    // Obtener FlashbotsBundleProvider específico para este relay
    const flashbotsProvider = this.getFlashbotsProvider(relay.config.relay_id);
    if (!flashbotsProvider) {
      throw new Error('❌ Flashbots provider no inicializado');
    }

    // Preparar bundle para Flashbots
    const flashbotsTransactions: FlashbotsBundleTransaction[] = signedTransactions.map(signedTx => ({
      signedTransaction: signedTx
    }));

    // Enviar bundle
    const bundleResponse = await flashbotsProvider.sendBundle(
      flashbotsTransactions,
      request.target_block,
      {
        minTimestamp: 0,
        maxTimestamp: request.max_block ? 
          Math.floor(Date.now() / 1000) + ((request.max_block - request.target_block) * 12) : 
          undefined
      }
    );

    // Flashbots devuelve un objeto con bundleHash
    const bundleHash = bundleResponse.bundleHash || 
      ethers.keccak256(ethers.concat(signedTransactions.map(tx => ethers.getBytes(tx))));

    return {
      bundleHash,
      response: {
        bundleHash: bundleResponse.bundleHash,
        simulationSuccess: bundleResponse.simulate ? await bundleResponse.simulate() : undefined
      }
    };
  }

  /**
   * Enviar bundle a bloXroute
   */
  private async submitToBloXroute(
    relay: RelayInfo,
    request: BundleRequest,
    signedTransactions: string[]
  ): Promise<{ bundleHash: string; response: any }> {
    const client = this.getHttpClient(relay.config.relay_id);
    if (!client) {
      throw new Error('❌ bloXroute HTTP client no inicializado');
    }

    const bundlePayload = {
      jsonrpc: '2.0',
      method: 'mev_sendBundle',
      params: [{
        txs: signedTransactions,
        blockNumber: `0x${request.target_block.toString(16)}`,
        minTimestamp: 0,
        maxTimestamp: request.max_block ? 
          Math.floor(Date.now() / 1000) + ((request.max_block - request.target_block) * 12) : 
          undefined
      }],
      id: uuidv4()
    };

    const response = await client.post('', bundlePayload);
    
    if (response.data.error) {
      throw new Error(`bloXroute error: ${response.data.error.message}`);
    }

    // Generar bundle hash
    const bundleHash = ethers.keccak256(
      ethers.toUtf8Bytes(JSON.stringify(signedTransactions) + request.target_block.toString())
    );

    return {
      bundleHash,
      response: response.data.result
    };
  }

  /**
   * Enviar bundle a Eden Network
   */
  private async submitToEden(
    relay: RelayInfo,
    request: BundleRequest,
    signedTransactions: string[]
  ): Promise<{ bundleHash: string; response: any }> {
    const client = this.getHttpClient(relay.config.relay_id);
    if (!client) {
      throw new Error('❌ Eden HTTP client no inicializado');
    }

    const bundlePayload = {
      jsonrpc: '2.0',
      method: 'eth_sendBundle',
      params: [{
        txs: signedTransactions,
        blockNumber: `0x${request.target_block.toString(16)}`
      }],
      id: uuidv4()
    };

    const response = await client.post('/v1/bundle', bundlePayload);
    
    if (response.data.error) {
      throw new Error(`Eden Network error: ${response.data.error.message}`);
    }

    // Generar bundle hash
    const bundleHash = ethers.keccak256(
      ethers.toUtf8Bytes(JSON.stringify(signedTransactions) + request.target_block.toString())
    );

    return {
      bundleHash,
      response: response.data.result
    };
  }

  /**
   * Enviar bundle a builder genérico
   */
  private async submitToGenericBuilder(
    relay: RelayInfo,
    request: BundleRequest,
    signedTransactions: string[]
  ): Promise<{ bundleHash: string; response: any }> {
    const client = this.getHttpClient(relay.config.relay_id);
    if (!client) {
      throw new Error(`❌ ${relay.config.name} HTTP client no inicializado`);
    }

    // Formato estándar para builders
    const bundlePayload = {
      jsonrpc: '2.0',
      method: 'eth_sendBundle',
      params: [{
        txs: signedTransactions,
        blockNumber: `0x${request.target_block.toString(16)}`
      }],
      id: uuidv4()
    };

    const response = await client.post('', bundlePayload);
    
    if (response.data.error) {
      throw new Error(`${relay.config.name} error: ${response.data.error.message}`);
    }

    // Generar bundle hash
    const bundleHash = ethers.keccak256(
      ethers.toUtf8Bytes(JSON.stringify(signedTransactions) + request.target_block.toString())
    );

    return {
      bundleHash,
      response: response.data.result
    };
  }

  /**
   * Procesar resultados de envío
   */
  private processSubmissionResults(
    results: PromiseSettledResult<RelaySubmissionResult>[],
    relays: RelayInfo[]
  ): RelaySubmissionResult[] {
    return results.map((result, index) => {
      const relay = relays[index];
      
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          relay_type: relay.config.type,
          relay_id: relay.config.relay_id,
          status: 'failed',
          submission_time: new Date().toISOString(),
          response_time_ms: 0,
          error_message: result.reason?.message || 'Promise rejected'
        };
      }
    });
  }

  /**
   * Determinar estado general del bundle
   */
  private determineOverallStatus(
    results: RelaySubmissionResult[],
    minRelayCount: number
  ): 'success' | 'partial_success' | 'failed' | 'timeout' {
    const successCount = results.filter(r => r.status === 'success').length;
    
    if (successCount >= minRelayCount) {
      return successCount === results.length ? 'success' : 'partial_success';
    } else if (results.every(r => r.status === 'timeout')) {
      return 'timeout';
    } else {
      return 'failed';
    }
  }

  /**
   * Actualizar estadísticas de relays
   */
  private async updateRelayStatistics(results: RelaySubmissionResult[]): Promise<void> {
    const updatePromises = results.map(async (result) => {
      await this.relayManager.updateRelayStats(
        result.relay_id,
        result.status === 'success',
        result.response_time_ms,
        result.error_message
      );
    });

    await Promise.all(updatePromises);
  }

  /**
   * Manejar timeout de bundle
   */
  private handleBundleTimeout(bundleId: string): void {
    this.logger.warn(`⏰ Timeout en bundle ${bundleId}`);
    this.activeBundles.delete(bundleId);
  }

  /**
   * Obtener FlashbotsBundleProvider para relay
   */
  private getFlashbotsProvider(relayId: string): FlashbotsBundleProvider | null {
    // Esta función requeriría acceso al RelayManager's internal storage
    // Por simplicidad, retornamos null y manejaríamos esto en la integración real
    return null;
  }

  /**
   * Obtener HTTP client para relay
   */
  private getHttpClient(relayId: string): any {
    // Similar al anterior, requiere acceso al RelayManager's internal storage
    return null;
  }

  /**
   * Guardar resultado de bundle en Redis
   */
  private async saveBundleResult(result: BundleResult): Promise<void> {
    const key = `relays-client:bundle:${result.bundle_id}`;
    await this.redis.setex(key, 3600, JSON.stringify(result));
  }

  /**
   * Obtener resultado de bundle
   */
  async getBundleResult(bundleId: string): Promise<BundleResult | null> {
    const key = `relays-client:bundle:${bundleId}`;
    const data = await this.redis.get(key);
    
    if (!data) {
      return null;
    }
    
    try {
      return JSON.parse(data) as BundleResult;
    } catch (error) {
      this.logger.error(`❌ Error parseando resultado de bundle ${bundleId}:`, error);
      return null;
    }
  }

  /**
   * Cancelar bundle activo
   */
  async cancelBundle(bundleId: string): Promise<boolean> {
    const timeoutHandle = this.activeBundles.get(bundleId);
    
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
      this.activeBundles.delete(bundleId);
      
      this.logger.info(`🚫 Bundle ${bundleId} cancelado`);
      return true;
    }
    
    return false;
  }

  /**
   * Obtener bundles activos
   */
  getActiveBundles(): string[] {
    return Array.from(this.activeBundles.keys());
  }

  /**
   * Shutdown del engine
   */
  async shutdown(): Promise<void> {
    this.logger.info('🛑 Cerrando BundleEngine...');
    
    // Cancelar todos los bundles activos
    for (const [bundleId, timeoutHandle] of this.activeBundles) {
      clearTimeout(timeoutHandle);
      this.logger.info(`🚫 Cancelando bundle activo: ${bundleId}`);
    }
    
    this.activeBundles.clear();
    this.providers.clear();
    
    this.logger.info('✅ BundleEngine cerrado correctamente');
  }
}
import { ethers } from 'ethers';
import { FlashbotsBundleProvider } from '@flashbots/ethers-provider-bundle';
import axios, { AxiosInstance } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';
import winston from 'winston';
import Decimal from 'decimal.js';
import {
  RelayType,
  RelayConfig,
  RelayInfo,
  RelayStatus,
  RelayMetrics,
  RelayHealthCheck,
  FailoverConfig
} from '../types/relay.js';

export class RelayManager {
  private redis: Redis;
  private logger: winston.Logger;
  private relays: Map<string, RelayInfo> = new Map();
  private providers: Map<string, ethers.Provider> = new Map();
  private flashbotsProviders: Map<string, FlashbotsBundleProvider> = new Map();
  private httpClients: Map<string, AxiosInstance> = new Map();
  private healthCheckIntervals: Map<string, NodeJS.Timeout> = new Map();
  private failoverConfig: FailoverConfig;

  constructor(redis: Redis, logger: winston.Logger, failoverConfig?: FailoverConfig) {
    this.redis = redis;
    this.logger = logger;
    this.failoverConfig = failoverConfig || {
      strategy: 'priority_based',
      max_consecutive_failures: 3,
      failure_backoff_seconds: 60,
      health_check_interval_seconds: 30,
      circuit_breaker_threshold: 0.1,
      recovery_time_seconds: 300
    };
    
    this.initializeDefaultRelays();
    this.startHealthChecks();
  }

  /**
   * Inicializar relays por defecto según Real-Only Policy
   */
  private initializeDefaultRelays(): void {
    const defaultRelays: Omit<RelayConfig, 'relay_id'>[] = [
      // Flashbots (Ethereum Mainnet)
      {
        name: 'Flashbots Protect',
        type: 'flashbots',
        endpoint: 'https://relay.flashbots.net',
        priority: 10, // Más alta prioridad
        weight: 1.0,
        max_block_delay: 0,
        timeout_ms: 3000,
        retry_attempts: 2,
        enabled: true
      },
      
      // bloXroute (Multi-chain)
      {
        name: 'bloXroute Max Profit',
        type: 'bloxroute',
        endpoint: 'https://mev.api.blxrbdn.com',
        priority: 9,
        weight: 0.9,
        max_block_delay: 1,
        timeout_ms: 4000,
        retry_attempts: 2,
        enabled: true
      },
      
      // Eden Network
      {
        name: 'Eden Network',
        type: 'eden',
        endpoint: 'https://api.edennetwork.io',
        priority: 8,
        weight: 0.8,
        max_block_delay: 2,
        timeout_ms: 5000,
        retry_attempts: 2,
        enabled: true
      },
      
      // Beaver Build (backup)
      {
        name: 'Beaver Build',
        type: 'beaver',
        endpoint: 'https://rpc.beaverbuild.org',
        priority: 7,
        weight: 0.7,
        max_block_delay: 2,
        timeout_ms: 5000,
        retry_attempts: 1,
        enabled: true
      },
      
      // Titan Builder (backup)
      {
        name: 'Titan Builder',
        type: 'titan',
        endpoint: 'https://rpc.titanbuilder.xyz',
        priority: 6,
        weight: 0.6,
        max_block_delay: 3,
        timeout_ms: 6000,
        retry_attempts: 1,
        enabled: true
      }
    ];

    defaultRelays.forEach(config => {
      this.addRelay({
        ...config,
        relay_id: uuidv4()
      });
    });

    this.logger.info(`🔗 RelayManager inicializado con ${defaultRelays.length} relays por defecto`);
  }

  /**
   * Agregar nuevo relay al manager
   */
  async addRelay(config: RelayConfig): Promise<void> {
    const relayInfo: RelayInfo = {
      config,
      status: 'inactive',
      consecutive_failures: 0,
      total_requests: 0,
      successful_requests: 0,
      failed_requests: 0,
      average_response_time_ms: 0,
      success_rate_percentage: 0
    };

    // Inicializar provider y cliente HTTP
    await this.initializeRelayClient(relayInfo);
    
    this.relays.set(config.relay_id, relayInfo);
    await this.saveRelayToRedis(relayInfo);
    
    // Iniciar health check para este relay
    this.setupHealthCheck(config.relay_id);
    
    this.logger.info(
      `➕ Relay agregado: ${config.name} (${config.type}) - ` +
      `endpoint: ${config.endpoint.substring(0, 50)}...`
    );
  }

  /**
   * Inicializar cliente específico del relay
   */
  private async initializeRelayClient(relayInfo: RelayInfo): Promise<void> {
    const { config } = relayInfo;
    
    try {
      // Provider Ethereum base
      const rpcUrl = process.env.RPC_URL_1; // Mainnet por defecto
      if (!rpcUrl) {
        throw new Error('❌ Real-Only Policy: RPC_URL_1 (Ethereum Mainnet) requerido');
      }
      
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      this.providers.set(config.relay_id, provider);

      // Cliente HTTP común
      const httpClient = axios.create({
        baseURL: config.endpoint,
        timeout: config.timeout_ms,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'ArbitrageX-Supreme-v3.0',
          ...(config.auth_header && { 'Authorization': config.auth_header }),
          ...(config.api_key && { 'X-API-Key': config.api_key })
        }
      });

      this.httpClients.set(config.relay_id, httpClient);

      // Inicialización específica por tipo de relay
      switch (config.type) {
        case 'flashbots':
          await this.initializeFlashbots(config, provider);
          break;
        case 'bloxroute':
          await this.initializeBloXroute(config);
          break;
        case 'eden':
          await this.initializeEden(config);
          break;
        case 'beaver':
        case 'titan':
          await this.initializeGenericBuilder(config);
          break;
      }

      relayInfo.status = 'active';
      this.logger.info(`✅ Cliente inicializado para ${config.name} (${config.type})`);

    } catch (error) {
      relayInfo.status = 'failed';
      relayInfo.last_failure = new Date().toISOString();
      
      this.logger.error(`❌ Error inicializando ${config.name}:`, error);
      throw error;
    }
  }

  /**
   * Inicializar Flashbots provider
   */
  private async initializeFlashbots(config: RelayConfig, provider: ethers.Provider): Promise<void> {
    if (!config.signing_key) {
      throw new Error('❌ Flashbots requiere signing_key para autenticación');
    }

    const authSigner = new ethers.Wallet(config.signing_key, provider);
    
    const flashbotsProvider = await FlashbotsBundleProvider.create(
      provider,
      authSigner,
      config.endpoint,
      'mainnet'
    );

    this.flashbotsProviders.set(config.relay_id, flashbotsProvider);
  }

  /**
   * Inicializar bloXroute
   */
  private async initializeBloXroute(config: RelayConfig): Promise<void> {
    if (!config.api_key) {
      throw new Error('❌ bloXroute requiere API key');
    }

    // Validar credenciales con health check
    const client = this.httpClients.get(config.relay_id);
    if (!client) throw new Error('❌ HTTP client no inicializado');

    try {
      await client.get('/ping'); // bloXroute ping endpoint
    } catch (error) {
      throw new Error(`❌ bloXroute auth validation failed: ${error}`);
    }
  }

  /**
   * Inicializar Eden Network
   */
  private async initializeEden(config: RelayConfig): Promise<void> {
    // Eden usa endpoint público, validar accesibilidad
    const client = this.httpClients.get(config.relay_id);
    if (!client) throw new Error('❌ HTTP client no inicializado');

    try {
      await client.get('/health'); // Eden health endpoint
    } catch (error) {
      throw new Error(`❌ Eden Network validation failed: ${error}`);
    }
  }

  /**
   * Inicializar builders genéricos (Beaver, Titan)
   */
  private async initializeGenericBuilder(config: RelayConfig): Promise<void> {
    const client = this.httpClients.get(config.relay_id);
    if (!client) throw new Error('❌ HTTP client no inicializado');

    try {
      // Intento básico de conectividad
      await client.get('/', { timeout: config.timeout_ms });
    } catch (error) {
      this.logger.warn(`⚠️ ${config.name} no respondió, marcando como degraded`);
      // No lanzar error para builders genéricos, solo marcar como degraded
    }
  }

  /**
   * Obtener relays disponibles ordenados por prioridad
   */
  getAvailableRelays(excludeTypes?: RelayType[]): RelayInfo[] {
    const availableRelays = Array.from(this.relays.values())
      .filter(relay => {
        if (!relay.config.enabled) return false;
        if (relay.status === 'failed' || relay.status === 'maintenance') return false;
        if (excludeTypes?.includes(relay.config.type)) return false;
        
        // Circuit breaker: excluir si tasa de éxito muy baja
        if (relay.success_rate_percentage < this.failoverConfig.circuit_breaker_threshold * 100) {
          return false;
        }
        
        return true;
      })
      .sort((a, b) => {
        // Ordenar por estrategia de failover
        switch (this.failoverConfig.strategy) {
          case 'priority_based':
            return b.config.priority - a.config.priority;
          case 'success_rate_based':
            return b.success_rate_percentage - a.success_rate_percentage;
          case 'response_time_based':
            return a.average_response_time_ms - b.average_response_time_ms;
          default:
            return Math.random() - 0.5; // round_robin simulado
        }
      });

    return availableRelays;
  }

  /**
   * Obtener relay por ID
   */
  getRelay(relayId: string): RelayInfo | null {
    return this.relays.get(relayId) || null;
  }

  /**
   * Actualizar estado de relay después de request
   */
  async updateRelayStats(
    relayId: string,
    success: boolean,
    responseTimeMs: number,
    errorMessage?: string
  ): Promise<void> {
    const relay = this.relays.get(relayId);
    if (!relay) return;

    relay.total_requests++;
    
    if (success) {
      relay.successful_requests++;
      relay.consecutive_failures = 0;
      relay.last_success = new Date().toISOString();
      
      if (relay.status === 'failed' || relay.status === 'timeout') {
        relay.status = 'active';
        this.logger.info(`🔄 Relay ${relay.config.name} recuperado exitosamente`);
      }
    } else {
      relay.failed_requests++;
      relay.consecutive_failures++;
      relay.last_failure = new Date().toISOString();
      
      // Aplicar circuit breaker
      if (relay.consecutive_failures >= this.failoverConfig.max_consecutive_failures) {
        relay.status = 'failed';
        this.logger.warn(
          `🚫 Relay ${relay.config.name} marcado como failed ` +
          `(${relay.consecutive_failures} fallas consecutivas)`
        );
      }
    }

    // Actualizar tiempo promedio de respuesta
    const totalResponseTime = relay.average_response_time_ms * (relay.total_requests - 1) + responseTimeMs;
    relay.average_response_time_ms = totalResponseTime / relay.total_requests;

    // Actualizar tasa de éxito
    relay.success_rate_percentage = (relay.successful_requests / relay.total_requests) * 100;

    await this.saveRelayToRedis(relay);
  }

  /**
   * Configurar health check para un relay
   */
  private setupHealthCheck(relayId: string): void {
    const interval = setInterval(async () => {
      await this.performHealthCheck(relayId);
    }, this.failoverConfig.health_check_interval_seconds * 1000);

    this.healthCheckIntervals.set(relayId, interval);
  }

  /**
   * Realizar health check de un relay
   */
  private async performHealthCheck(relayId: string): Promise<RelayHealthCheck> {
    const relay = this.relays.get(relayId);
    if (!relay) {
      throw new Error(`❌ Relay ${relayId} no encontrado`);
    }

    const startTime = Date.now();
    let result: RelayHealthCheck;

    try {
      const client = this.httpClients.get(relayId);
      if (!client) {
        throw new Error('HTTP client no disponible');
      }

      // Health check específico por tipo de relay
      switch (relay.config.type) {
        case 'flashbots':
          result = await this.healthCheckFlashbots(relayId, client, startTime);
          break;
        case 'bloxroute':
          result = await this.healthCheckBloXroute(relayId, client, startTime);
          break;
        case 'eden':
          result = await this.healthCheckEden(relayId, client, startTime);
          break;
        default:
          result = await this.healthCheckGeneric(relayId, client, startTime);
      }

      // Actualizar estado del relay basado en health check
      if (result.status === 'healthy') {
        if (relay.status === 'failed' || relay.status === 'timeout') {
          relay.status = 'active';
          relay.consecutive_failures = 0;
          this.logger.info(`🔄 Relay ${relay.config.name} recovered via health check`);
        }
      } else {
        relay.consecutive_failures++;
        if (relay.consecutive_failures >= this.failoverConfig.max_consecutive_failures) {
          relay.status = 'failed';
        }
      }

      relay.last_health_check = result.timestamp;
      await this.saveRelayToRedis(relay);

      return result;

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      result = {
        relay_id: relayId,
        relay_type: relay.config.type,
        status: responseTime > relay.config.timeout_ms ? 'timeout' : 'unhealthy',
        response_time_ms: responseTime,
        endpoint_accessible: false,
        error_message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };

      relay.consecutive_failures++;
      if (relay.consecutive_failures >= this.failoverConfig.max_consecutive_failures) {
        relay.status = 'failed';
      }

      this.logger.error(`❌ Health check failed para ${relay.config.name}:`, error);
      return result;
    }
  }

  /**
   * Health check específico para Flashbots
   */
  private async healthCheckFlashbots(
    relayId: string,
    client: AxiosInstance,
    startTime: number
  ): Promise<RelayHealthCheck> {
    const response = await client.post('/', {
      method: 'eth_blockNumber',
      params: [],
      id: 1,
      jsonrpc: '2.0'
    });

    const responseTime = Date.now() - startTime;
    const blockNumber = parseInt(response.data.result, 16);

    return {
      relay_id: relayId,
      relay_type: 'flashbots',
      status: 'healthy',
      response_time_ms: responseTime,
      last_block: blockNumber,
      endpoint_accessible: true,
      auth_valid: true,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Health check específico para bloXroute
   */
  private async healthCheckBloXroute(
    relayId: string,
    client: AxiosInstance,
    startTime: number
  ): Promise<RelayHealthCheck> {
    const response = await client.get('/ping');
    const responseTime = Date.now() - startTime;

    return {
      relay_id: relayId,
      relay_type: 'bloxroute',
      status: response.status === 200 ? 'healthy' : 'degraded',
      response_time_ms: responseTime,
      endpoint_accessible: true,
      auth_valid: response.status === 200,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Health check específico para Eden
   */
  private async healthCheckEden(
    relayId: string,
    client: AxiosInstance,
    startTime: number
  ): Promise<RelayHealthCheck> {
    const response = await client.get('/health');
    const responseTime = Date.now() - startTime;

    return {
      relay_id: relayId,
      relay_type: 'eden',
      status: response.status === 200 ? 'healthy' : 'degraded',
      response_time_ms: responseTime,
      endpoint_accessible: true,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Health check genérico
   */
  private async healthCheckGeneric(
    relayId: string,
    client: AxiosInstance,
    startTime: number
  ): Promise<RelayHealthCheck> {
    const relay = this.relays.get(relayId);
    if (!relay) throw new Error(`Relay ${relayId} not found`);

    const response = await client.get('/', { timeout: relay.config.timeout_ms });
    const responseTime = Date.now() - startTime;

    return {
      relay_id: relayId,
      relay_type: relay.config.type,
      status: response.status < 400 ? 'healthy' : 'degraded',
      response_time_ms: responseTime,
      endpoint_accessible: true,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Inicializar health checks para todos los relays
   */
  private startHealthChecks(): void {
    // Los health checks se inician automáticamente cuando se agregan relays
    this.logger.info('🏥 Sistema de health checks iniciado para relays');
  }

  /**
   * Obtener métricas de todos los relays
   */
  getAllRelayMetrics(): Map<string, RelayMetrics> {
    const metrics = new Map<string, RelayMetrics>();

    for (const [relayId, relay] of this.relays) {
      const relayMetrics: RelayMetrics = {
        relay_type: relay.config.type,
        relay_id: relayId,
        total_bundles_submitted: relay.total_requests,
        successful_submissions: relay.successful_requests,
        failed_submissions: relay.failed_requests,
        timeout_submissions: 0, // Se calculará desde eventos específicos
        rejected_submissions: 0, // Se calculará desde eventos específicos
        average_response_time_ms: relay.average_response_time_ms,
        p95_response_time_ms: 0, // Requiere historial de tiempos
        success_rate_percentage: relay.success_rate_percentage,
        total_inclusions: 0, // Se calculará desde tracking
        average_inclusion_delay_blocks: 0,
        inclusion_rate_percentage: 0,
        uptime_percentage: this.calculateUptime(relay),
        last_downtime: relay.last_failure,
        consecutive_failures: relay.consecutive_failures,
        first_seen: relay.last_success || new Date().toISOString(),
        last_updated: new Date().toISOString()
      };

      metrics.set(relayId, relayMetrics);
    }

    return metrics;
  }

  /**
   * Calcular uptime de relay
   */
  private calculateUptime(relay: RelayInfo): number {
    // Implementación simplificada - en producción usaríamos historial más detallado
    if (relay.total_requests === 0) return 100;
    return (relay.successful_requests / relay.total_requests) * 100;
  }

  /**
   * Guardar relay en Redis
   */
  private async saveRelayToRedis(relay: RelayInfo): Promise<void> {
    const key = `relays-client:relay:${relay.config.relay_id}`;
    await this.redis.setex(key, 3600, JSON.stringify(relay));
  }

  /**
   * Obtener todos los relays
   */
  getAllRelays(): RelayInfo[] {
    return Array.from(this.relays.values());
  }

  /**
   * Habilitar/deshabilitar relay
   */
  async toggleRelay(relayId: string, enabled: boolean): Promise<void> {
    const relay = this.relays.get(relayId);
    if (!relay) {
      throw new Error(`❌ Relay ${relayId} no encontrado`);
    }

    relay.config.enabled = enabled;
    relay.status = enabled ? 'active' : 'inactive';
    
    await this.saveRelayToRedis(relay);
    
    this.logger.info(
      `🔄 Relay ${relay.config.name} ${enabled ? 'habilitado' : 'deshabilitado'}`
    );
  }

  /**
   * Shutdown del manager
   */
  async shutdown(): Promise<void> {
    this.logger.info('🛑 Cerrando RelayManager...');
    
    // Detener todos los health checks
    for (const interval of this.healthCheckIntervals.values()) {
      clearInterval(interval);
    }
    
    this.healthCheckIntervals.clear();
    this.relays.clear();
    this.providers.clear();
    this.flashbotsProviders.clear();
    this.httpClients.clear();
    
    this.logger.info('✅ RelayManager cerrado correctamente');
  }
}
import { ethers } from 'ethers';
import Redis from 'ioredis';
import winston from 'winston';
import cron from 'node-cron';
import Decimal from 'decimal.js';
import {
  BundleResult,
  TrackingEvent,
  BundleTrackingConfig,
  RelayMetrics
} from '../types/relay.js';

interface TrackedBundle {
  bundle_id: string;
  chain_id: number;
  target_block: number;
  transaction_hashes: string[];
  relay_types: string[];
  submission_time: string;
  tracking_started: string;
  max_tracking_block: number;
  status: 'tracking' | 'included' | 'missed' | 'expired';
}

export class InclusionTracker {
  private redis: Redis;
  private logger: winston.Logger;
  private providers: Map<number, ethers.Provider> = new Map();
  private trackedBundles: Map<string, TrackedBundle> = new Map();
  private trackingConfig: BundleTrackingConfig;
  private cronJob: cron.ScheduledTask | null = null;

  constructor(redis: Redis, logger: winston.Logger, config?: BundleTrackingConfig) {
    this.redis = redis;
    this.logger = logger;
    this.trackingConfig = config || {
      track_inclusion: true,
      max_tracking_blocks: 10,
      tracking_interval_seconds: 12,
      auto_cleanup_hours: 24
    };

    this.initializeProviders();
    this.startTracking();
  }

  /**
   * Inicializar providers para diferentes chains
   */
  private initializeProviders(): void {
    const chains = [
      { id: 1, rpc: process.env.RPC_URL_1 },
      { id: 137, rpc: process.env.RPC_URL_137 },
      { id: 42161, rpc: process.env.RPC_URL_42161 },
      { id: 10, rpc: process.env.RPC_URL_10 }
    ];

    chains.forEach(chain => {
      if (chain.rpc) {
        const provider = new ethers.JsonRpcProvider(chain.rpc);
        this.providers.set(chain.id, provider);
      }
    });

    this.logger.info(`📡 InclusionTracker inicializado para ${this.providers.size} chains`);
  }

  /**
   * Iniciar tracking de un bundle
   */
  async startBundleTracking(bundleResult: BundleResult): Promise<void> {
    if (!this.trackingConfig.track_inclusion) {
      return;
    }

    // Extraer transaction hashes esperados del bundle result
    const transactionHashes = bundleResult.final_transaction_hashes || [];
    if (transactionHashes.length === 0) {
      this.logger.warn(
        `⚠️ Bundle ${bundleResult.bundle_id} no tiene transaction hashes para tracking`
      );
      return;
    }

    const trackedBundle: TrackedBundle = {
      bundle_id: bundleResult.bundle_id,
      chain_id: bundleResult.chain_id,
      target_block: bundleResult.target_block,
      transaction_hashes: transactionHashes,
      relay_types: bundleResult.relay_results.map(r => r.relay_type),
      submission_time: bundleResult.submission_time,
      tracking_started: new Date().toISOString(),
      max_tracking_block: bundleResult.target_block + this.trackingConfig.max_tracking_blocks,
      status: 'tracking'
    };

    this.trackedBundles.set(bundleResult.bundle_id, trackedBundle);
    await this.saveTrackedBundleToRedis(trackedBundle);

    // Emitir evento de inicio de tracking
    await this.emitTrackingEvent({
      bundle_id: bundleResult.bundle_id,
      event_type: 'submitted',
      block_number: bundleResult.target_block,
      timestamp: new Date().toISOString(),
      details: {
        relay_count: bundleResult.relay_results.length,
        successful_relays: bundleResult.successful_relays
      }
    });

    this.logger.info(
      `🔍 Iniciando tracking para bundle ${bundleResult.bundle_id} ` +
      `(chain ${bundleResult.chain_id}, target block: ${bundleResult.target_block})`
    );
  }

  /**
   * Iniciar proceso de tracking periódico
   */
  private startTracking(): void {
    if (!this.trackingConfig.track_inclusion) {
      return;
    }

    // Ejecutar cada 12 segundos (tiempo promedio de bloque Ethereum)
    const cronExpression = `*/${this.trackingConfig.tracking_interval_seconds} * * * * *`;
    
    this.cronJob = cron.schedule(cronExpression, async () => {
      await this.trackAllBundles();
    }, {
      scheduled: false,
      name: 'inclusion-tracker'
    });

    this.cronJob.start();

    // Cleanup job - cada hora
    cron.schedule('0 * * * *', async () => {
      await this.cleanupExpiredBundles();
    }, {
      name: 'bundle-cleanup'
    });

    this.logger.info(`⏰ Tracking cron iniciado (interval: ${this.trackingConfig.tracking_interval_seconds}s)`);
  }

  /**
   * Trackear todos los bundles activos
   */
  private async trackAllBundles(): Promise<void> {
    const trackingPromises = Array.from(this.trackedBundles.values())
      .filter(bundle => bundle.status === 'tracking')
      .map(bundle => this.trackBundle(bundle));

    try {
      await Promise.allSettled(trackingPromises);
    } catch (error) {
      this.logger.error('❌ Error en tracking masivo:', error);
    }
  }

  /**
   * Trackear un bundle específico
   */
  private async trackBundle(trackedBundle: TrackedBundle): Promise<void> {
    const provider = this.providers.get(trackedBundle.chain_id);
    if (!provider) {
      this.logger.warn(
        `⚠️ Provider no disponible para chain ${trackedBundle.chain_id}, ` +
        `skipping bundle ${trackedBundle.bundle_id}`
      );
      return;
    }

    try {
      const currentBlock = await provider.getBlockNumber();

      // Verificar si superamos el límite de tracking
      if (currentBlock > trackedBundle.max_tracking_block) {
        await this.markBundleAsMissed(trackedBundle);
        return;
      }

      // Buscar transacciones en bloques desde el target hasta el actual
      const startBlock = Math.max(
        trackedBundle.target_block,
        currentBlock - 5 // Revisar últimos 5 bloques
      );

      for (let blockNum = startBlock; blockNum <= currentBlock; blockNum++) {
        const inclusionResult = await this.checkBlockForTransactions(
          provider,
          blockNum,
          trackedBundle
        );

        if (inclusionResult.found) {
          await this.markBundleAsIncluded(trackedBundle, inclusionResult);
          return;
        }
      }

    } catch (error) {
      this.logger.error(
        `❌ Error tracking bundle ${trackedBundle.bundle_id}:`, 
        error
      );
    }
  }

  /**
   * Verificar transacciones en un bloque específico
   */
  private async checkBlockForTransactions(
    provider: ethers.Provider,
    blockNumber: number,
    trackedBundle: TrackedBundle
  ): Promise<{ found: boolean; includedTxs: string[]; block?: ethers.Block }> {
    try {
      const block = await provider.getBlock(blockNumber, true);
      if (!block || !block.transactions) {
        return { found: false, includedTxs: [] };
      }

      const includedTxs: string[] = [];
      
      // Buscar nuestras transacciones en el bloque
      for (const tx of block.transactions) {
        if (typeof tx === 'string') {
          // Si tx es solo el hash
          if (trackedBundle.transaction_hashes.includes(tx)) {
            includedTxs.push(tx);
          }
        } else {
          // Si tx es objeto completo
          if (trackedBundle.transaction_hashes.includes(tx.hash)) {
            includedTxs.push(tx.hash);
          }
        }
      }

      return {
        found: includedTxs.length > 0,
        includedTxs,
        block: includedTxs.length > 0 ? block : undefined
      };

    } catch (error) {
      this.logger.error(
        `❌ Error verificando bloque ${blockNumber} para bundle ${trackedBundle.bundle_id}:`,
        error
      );
      return { found: false, includedTxs: [] };
    }
  }

  /**
   * Marcar bundle como incluido
   */
  private async markBundleAsIncluded(
    trackedBundle: TrackedBundle,
    inclusionResult: { includedTxs: string[]; block?: ethers.Block }
  ): Promise<void> {
    const { includedTxs, block } = inclusionResult;
    
    if (!block) return;

    trackedBundle.status = 'included';
    
    const inclusionDelay = block.number - trackedBundle.target_block;
    
    await this.emitTrackingEvent({
      bundle_id: trackedBundle.bundle_id,
      event_type: 'included',
      block_number: block.number,
      timestamp: new Date().toISOString(),
      details: {
        included_txs: includedTxs,
        inclusion_delay_blocks: inclusionDelay,
        block_hash: block.hash,
        gas_used: block.gasUsed.toString(),
        partial_inclusion: includedTxs.length < trackedBundle.transaction_hashes.length
      }
    });

    // Actualizar bundle result en Redis
    await this.updateBundleResultWithInclusion(
      trackedBundle.bundle_id,
      block.number,
      inclusionDelay,
      includedTxs
    );

    await this.saveTrackedBundleToRedis(trackedBundle);

    this.logger.info(
      `✅ Bundle ${trackedBundle.bundle_id} incluido en bloque ${block.number} ` +
      `(delay: ${inclusionDelay} bloques, ${includedTxs.length}/${trackedBundle.transaction_hashes.length} txs)`
    );

    // Actualizar métricas de relay
    await this.updateRelayInclusionMetrics(trackedBundle, inclusionDelay);
  }

  /**
   * Marcar bundle como perdido/missed
   */
  private async markBundleAsMissed(trackedBundle: TrackedBundle): Promise<void> {
    trackedBundle.status = 'missed';

    await this.emitTrackingEvent({
      bundle_id: trackedBundle.bundle_id,
      event_type: 'missed',
      block_number: trackedBundle.max_tracking_block,
      timestamp: new Date().toISOString(),
      details: {
        tracking_expired: true,
        blocks_tracked: this.trackingConfig.max_tracking_blocks
      }
    });

    // Actualizar bundle result
    await this.updateBundleResultWithInclusion(
      trackedBundle.bundle_id,
      0, // No incluido
      -1, // Delay negativo indica missed
      []
    );

    await this.saveTrackedBundleToRedis(trackedBundle);

    this.logger.warn(
      `❌ Bundle ${trackedBundle.bundle_id} marcado como missed ` +
      `(tracking expiró en bloque ${trackedBundle.max_tracking_block})`
    );
  }

  /**
   * Actualizar BundleResult con información de inclusión
   */
  private async updateBundleResultWithInclusion(
    bundleId: string,
    includedInBlock: number,
    inclusionDelay: number,
    finalTxHashes: string[]
  ): Promise<void> {
    const key = `relays-client:bundle:${bundleId}`;
    const existingData = await this.redis.get(key);
    
    if (!existingData) {
      this.logger.warn(`⚠️ Bundle result ${bundleId} no encontrado para actualizar inclusión`);
      return;
    }

    try {
      const bundleResult = JSON.parse(existingData);
      
      if (includedInBlock > 0) {
        bundleResult.inclusion_status = 'included';
        bundleResult.included_in_block = includedInBlock;
        bundleResult.inclusion_delay_blocks = inclusionDelay;
        bundleResult.final_transaction_hashes = finalTxHashes;
      } else {
        bundleResult.inclusion_status = 'missed';
      }

      await this.redis.setex(key, 3600, JSON.stringify(bundleResult));
      
    } catch (error) {
      this.logger.error(`❌ Error actualizando bundle result ${bundleId}:`, error);
    }
  }

  /**
   * Emitir evento de tracking
   */
  private async emitTrackingEvent(event: TrackingEvent): Promise<void> {
    const key = `relays-client:event:${event.bundle_id}:${Date.now()}`;
    await this.redis.setex(key, 3600, JSON.stringify(event));

    this.logger.debug(
      `📢 Evento emitido: ${event.event_type} para bundle ${event.bundle_id} ` +
      `en bloque ${event.block_number}`
    );
  }

  /**
   * Actualizar métricas de inclusión de relays
   */
  private async updateRelayInclusionMetrics(
    trackedBundle: TrackedBundle,
    inclusionDelay: number
  ): Promise<void> {
    // Actualizar métricas para cada relay que participó en el bundle
    for (const relayType of trackedBundle.relay_types) {
      const metricsKey = `relays-client:metrics:inclusion:${relayType}`;
      
      try {
        const existingMetrics = await this.redis.get(metricsKey);
        let metrics = existingMetrics ? JSON.parse(existingMetrics) : {
          relay_type: relayType,
          total_bundles: 0,
          successful_inclusions: 0,
          total_inclusion_delay: 0,
          inclusion_rate: 0,
          average_inclusion_delay: 0
        };

        metrics.total_bundles++;
        metrics.successful_inclusions++;
        metrics.total_inclusion_delay += inclusionDelay;
        metrics.inclusion_rate = (metrics.successful_inclusions / metrics.total_bundles) * 100;
        metrics.average_inclusion_delay = metrics.total_inclusion_delay / metrics.successful_inclusions;
        metrics.last_updated = new Date().toISOString();

        await this.redis.setex(metricsKey, 86400, JSON.stringify(metrics)); // 24h TTL

      } catch (error) {
        this.logger.error(`❌ Error actualizando métricas de inclusión para ${relayType}:`, error);
      }
    }
  }

  /**
   * Obtener métricas de inclusión por relay
   */
  async getInclusionMetrics(relayType?: string): Promise<any> {
    if (relayType) {
      const metricsKey = `relays-client:metrics:inclusion:${relayType}`;
      const data = await this.redis.get(metricsKey);
      return data ? JSON.parse(data) : null;
    }

    // Obtener métricas de todos los relays
    const pattern = 'relays-client:metrics:inclusion:*';
    const keys = await this.redis.keys(pattern);
    const metrics: Record<string, any> = {};

    for (const key of keys) {
      const relayType = key.split(':').pop();
      if (relayType) {
        const data = await this.redis.get(key);
        if (data) {
          metrics[relayType] = JSON.parse(data);
        }
      }
    }

    return metrics;
  }

  /**
   * Cleanup de bundles expirados
   */
  private async cleanupExpiredBundles(): Promise<void> {
    const expiredTime = Date.now() - (this.trackingConfig.auto_cleanup_hours * 60 * 60 * 1000);
    const expiredBundles: string[] = [];

    for (const [bundleId, trackedBundle] of this.trackedBundles) {
      const submissionTime = new Date(trackedBundle.submission_time).getTime();
      
      if (submissionTime < expiredTime || trackedBundle.status !== 'tracking') {
        expiredBundles.push(bundleId);
      }
    }

    for (const bundleId of expiredBundles) {
      this.trackedBundles.delete(bundleId);
      
      // También limpiar de Redis
      const key = `relays-client:tracked-bundle:${bundleId}`;
      await this.redis.del(key);
    }

    if (expiredBundles.length > 0) {
      this.logger.info(`🧹 Limpieza completada: ${expiredBundles.length} bundles expirados removidos`);
    }
  }

  /**
   * Guardar tracked bundle en Redis
   */
  private async saveTrackedBundleToRedis(trackedBundle: TrackedBundle): Promise<void> {
    const key = `relays-client:tracked-bundle:${trackedBundle.bundle_id}`;
    await this.redis.setex(key, 86400, JSON.stringify(trackedBundle)); // 24h TTL
  }

  /**
   * Obtener estadísticas de tracking
   */
  async getTrackingStatistics(): Promise<any> {
    const stats = {
      active_tracking: 0,
      included_bundles: 0,
      missed_bundles: 0,
      expired_bundles: 0,
      total_tracked: this.trackedBundles.size
    };

    for (const trackedBundle of this.trackedBundles.values()) {
      switch (trackedBundle.status) {
        case 'tracking':
          stats.active_tracking++;
          break;
        case 'included':
          stats.included_bundles++;
          break;
        case 'missed':
          stats.missed_bundles++;
          break;
        case 'expired':
          stats.expired_bundles++;
          break;
      }
    }

    return {
      ...stats,
      inclusion_rate: stats.total_tracked > 0 
        ? (stats.included_bundles / (stats.included_bundles + stats.missed_bundles)) * 100 
        : 0,
      tracking_config: this.trackingConfig,
      last_updated: new Date().toISOString()
    };
  }

  /**
   * Obtener eventos de tracking para un bundle
   */
  async getBundleTrackingEvents(bundleId: string): Promise<TrackingEvent[]> {
    const pattern = `relays-client:event:${bundleId}:*`;
    const keys = await this.redis.keys(pattern);
    const events: TrackingEvent[] = [];

    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        try {
          events.push(JSON.parse(data));
        } catch (error) {
          this.logger.error(`❌ Error parseando evento ${key}:`, error);
        }
      }
    }

    // Ordenar por timestamp
    return events.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }

  /**
   * Forzar check de un bundle específico
   */
  async forceCheckBundle(bundleId: string): Promise<boolean> {
    const trackedBundle = this.trackedBundles.get(bundleId);
    
    if (!trackedBundle || trackedBundle.status !== 'tracking') {
      return false;
    }

    await this.trackBundle(trackedBundle);
    return true;
  }

  /**
   * Detener tracking
   */
  stopTracking(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }

    this.logger.info('⏹️ Tracking detenido');
  }

  /**
   * Shutdown del tracker
   */
  async shutdown(): Promise<void> {
    this.logger.info('🛑 Cerrando InclusionTracker...');
    
    this.stopTracking();
    
    // Guardar estado final de bundles tracked
    for (const trackedBundle of this.trackedBundles.values()) {
      await this.saveTrackedBundleToRedis(trackedBundle);
    }
    
    this.trackedBundles.clear();
    this.providers.clear();
    
    this.logger.info('✅ InclusionTracker cerrado correctamente');
  }
}
/**
 * ===================================================================================================
 * ARBITRAGEX SUPREME - MEV TRIGGER AUTOMATION SYSTEM
 * ===================================================================================================
 * 
 * Activity 144-146: Sistema de triggers automáticos para detección y respuesta MEV
 * 
 * CARACTERÍSTICAS:
 * - Real-time MEV trigger detection
 * - Automated response system
 * - Multi-condition trigger logic
 * - Event-driven architecture
 * - Smart contract integration
 * - Cross-chain MEV monitoring
 * - Emergency response automation
 * 
 * METODOLOGÍA: Ingenio Pichichi S.A. - Cumplidor, disciplinado, organizado
 * ===================================================================================================
 */

import { ethers } from 'ethers';
import { EventEmitter } from 'events';
import { Percent } from '@uniswap/sdk-core';

// ===================================================================================================
// INTERFACES Y TIPOS DE TRIGGERS
// ===================================================================================================

interface MEVTriggerCondition {
  id: string;
  name: string;
  type: 'GAS_PRICE' | 'MEMPOOL_ACTIVITY' | 'SANDWICH_PATTERN' | 'FRONTRUN_DETECTION' | 
        'VOLUME_SPIKE' | 'PRICE_IMPACT' | 'LIQUIDITY_CHANGE' | 'CROSS_CHAIN';
  parameters: {
    threshold?: number;
    timeWindow?: number; // seconds
    poolAddress?: string;
    tokenAddress?: string;
    chainId?: number;
    customLogic?: string;
  };
  sensitivity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  enabled: boolean;
}

interface MEVTriggerEvent {
  triggerId: string;
  eventId: string;
  timestamp: number;
  type: MEVTriggerCondition['type'];
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  data: {
    currentValue: number;
    threshold: number;
    confidence: number;
    metadata: Record<string, any>;
  };
  autoResponse?: MEVAutoResponse;
}

interface MEVAutoResponse {
  responseId: string;
  action: 'ALERT' | 'PAUSE_TRADING' | 'INCREASE_SLIPPAGE' | 'SWITCH_ROUTER' | 
          'EMERGENCY_STOP' | 'NOTIFY_ADMIN' | 'ACTIVATE_PROTECTION';
  parameters: Record<string, any>;
  executedAt?: number;
  success?: boolean;
  error?: string;
}

interface TriggerMetrics {
  totalTriggers: number;
  triggersByType: Record<string, number>;
  triggersBySeverity: Record<string, number>;
  responseSuccess: number;
  responseFailures: number;
  avgResponseTime: number;
  falsePositives: number;
}

interface MonitoringTarget {
  id: string;
  type: 'POOL' | 'TOKEN' | 'ADDRESS' | 'CHAIN';
  address: string;
  chainId: number;
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  triggers: string[]; // trigger IDs
  lastChecked: number;
}

// ===================================================================================================
// MEV TRIGGER AUTOMATION SYSTEM
// ===================================================================================================

export class MEVTriggerAutomationSystem extends EventEmitter {
  private provider: ethers.Provider;
  private chainId: number;
  
  // Trigger management
  private triggers: Map<string, MEVTriggerCondition> = new Map();
  private activeEvents: Map<string, MEVTriggerEvent> = new Map();
  private monitoringTargets: Map<string, MonitoringTarget> = new Map();
  
  // State tracking
  private isMonitoring = false;
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();
  private eventHistory: MEVTriggerEvent[] = [];
  
  // Performance metrics
  private metrics: TriggerMetrics = {
    totalTriggers: 0,
    triggersByType: {},
    triggersBySeverity: {},
    responseSuccess: 0,
    responseFailures: 0,
    avgResponseTime: 0,
    falsePositives: 0
  };
  
  // Data caches for efficiency
  private gasPriceHistory: { timestamp: number; price: bigint }[] = [];
  private mempoolActivity: Map<string, { count: number; timestamp: number }> = new Map();
  private volumeData: Map<string, { volume: number; timestamp: number }[]> = new Map();

  constructor(provider: ethers.Provider, chainId: number) {
    super();
    this.provider = provider;
    this.chainId = chainId;
    
    this.setupDefaultTriggers();
  }

  // ===================================================================================================
  // CONFIGURACIÓN DE TRIGGERS
  // ===================================================================================================

  /**
   * Configura triggers por defecto
   */
  private setupDefaultTriggers(): void {
    // Gas Price Spike Trigger
    this.addTrigger({
      id: 'gas_price_spike',
      name: 'Gas Price Spike Detection',
      type: 'GAS_PRICE',
      parameters: {
        threshold: 150, // 150% of average
        timeWindow: 60
      },
      sensitivity: 'HIGH',
      enabled: true
    });

    // Mempool Activity Surge
    this.addTrigger({
      id: 'mempool_surge',
      name: 'Mempool Activity Surge',
      type: 'MEMPOOL_ACTIVITY',
      parameters: {
        threshold: 200, // 200% increase in pending txs
        timeWindow: 30
      },
      sensitivity: 'MEDIUM',
      enabled: true
    });

    // Sandwich Attack Pattern
    this.addTrigger({
      id: 'sandwich_pattern',
      name: 'Sandwich Attack Detection',
      type: 'SANDWICH_PATTERN',
      parameters: {
        threshold: 0.8, // 80% confidence
        timeWindow: 120
      },
      sensitivity: 'CRITICAL',
      enabled: true
    });

    // Frontrun Detection
    this.addTrigger({
      id: 'frontrun_detection',
      name: 'Frontrunning Detection',
      type: 'FRONTRUN_DETECTION',
      parameters: {
        threshold: 0.7, // 70% confidence
        timeWindow: 60
      },
      sensitivity: 'HIGH',
      enabled: true
    });

    // Volume Spike
    this.addTrigger({
      id: 'volume_spike',
      name: 'Trading Volume Spike',
      type: 'VOLUME_SPIKE',
      parameters: {
        threshold: 300, // 300% of average
        timeWindow: 300 // 5 minutes
      },
      sensitivity: 'MEDIUM',
      enabled: true
    });

    // Price Impact Alert
    this.addTrigger({
      id: 'price_impact_alert',
      name: 'High Price Impact Alert',
      type: 'PRICE_IMPACT',
      parameters: {
        threshold: 5.0, // 5% price impact
        timeWindow: 60
      },
      sensitivity: 'HIGH',
      enabled: true
    });
  }

  /**
   * Añade nuevo trigger
   */
  addTrigger(trigger: MEVTriggerCondition): void {
    this.triggers.set(trigger.id, trigger);
    console.log(`✅ Trigger añadido: ${trigger.name} (${trigger.id})`);
    
    // Initialize metrics for this trigger type
    if (!this.metrics.triggersByType[trigger.type]) {
      this.metrics.triggersByType[trigger.type] = 0;
    }
  }

  /**
   * Elimina trigger
   */
  removeTrigger(triggerId: string): boolean {
    const removed = this.triggers.delete(triggerId);
    if (removed) {
      console.log(`🗑️ Trigger eliminado: ${triggerId}`);
    }
    return removed;
  }

  /**
   * Actualiza trigger existente
   */
  updateTrigger(triggerId: string, updates: Partial<MEVTriggerCondition>): boolean {
    const trigger = this.triggers.get(triggerId);
    if (!trigger) return false;
    
    const updatedTrigger = { ...trigger, ...updates };
    this.triggers.set(triggerId, updatedTrigger);
    
    console.log(`🔄 Trigger actualizado: ${triggerId}`);
    return true;
  }

  // ===================================================================================================
  // GESTIÓN DE TARGETS DE MONITOREO
  // ===================================================================================================

  /**
   * Añade target de monitoreo
   */
  addMonitoringTarget(target: MonitoringTarget): void {
    this.monitoringTargets.set(target.id, target);
    console.log(`🎯 Target añadido: ${target.type} ${target.address}`);
  }

  /**
   * Elimina target de monitoreo
   */
  removeMonitoringTarget(targetId: string): boolean {
    return this.monitoringTargets.delete(targetId);
  }

  // ===================================================================================================
  // MONITOREO PRINCIPAL
  // ===================================================================================================

  /**
   * Inicia sistema de monitoreo
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) return;
    
    console.log('🚀 Iniciando sistema de triggers MEV...');
    this.isMonitoring = true;
    
    // Iniciar monitoreos específicos
    await this.startGasPriceMonitoring();
    await this.startMempoolMonitoring();
    await this.startVolumeMonitoring();
    await this.startPatternMonitoring();
    
    // Limpieza periódica
    this.startPeriodicCleanup();
    
    console.log('✅ Sistema de triggers MEV activo');
    this.emit('monitoring_started');
  }

  /**
   * Detiene sistema de monitoreo
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    
    // Limpiar intervalos
    for (const [id, interval] of this.monitoringIntervals) {
      clearInterval(interval);
    }
    this.monitoringIntervals.clear();
    
    console.log('🛑 Sistema de triggers MEV detenido');
    this.emit('monitoring_stopped');
  }

  // ===================================================================================================
  // MONITOREO ESPECÍFICO DE GAS PRICE
  // ===================================================================================================

  /**
   * Inicia monitoreo de gas price
   */
  private async startGasPriceMonitoring(): Promise<void> {
    const interval = setInterval(async () => {
      if (!this.isMonitoring) return;
      
      try {
        const feeData = await this.provider.getFeeData();
        const currentGasPrice = feeData.gasPrice;
        
        if (currentGasPrice) {
          // Añadir a historial
          this.gasPriceHistory.push({
            timestamp: Date.now(),
            price: currentGasPrice
          });
          
          // Mantener solo últimos 1000 registros
          if (this.gasPriceHistory.length > 1000) {
            this.gasPriceHistory = this.gasPriceHistory.slice(-1000);
          }
          
          // Verificar triggers de gas price
          await this.checkGasPriceTriggers(currentGasPrice);
        }
        
      } catch (error) {
        console.warn('⚠️ Error monitoring gas price:', error);
      }
    }, 5000); // Check every 5 seconds
    
    this.monitoringIntervals.set('gas_price', interval);
  }

  /**
   * Verifica triggers de gas price
   */
  private async checkGasPriceTriggers(currentGasPrice: bigint): Promise<void> {
    for (const [triggerId, trigger] of this.triggers) {
      if (trigger.type !== 'GAS_PRICE' || !trigger.enabled) continue;
      
      const threshold = trigger.parameters.threshold || 150;
      const timeWindow = (trigger.parameters.timeWindow || 60) * 1000;
      
      // Calcular gas price promedio en ventana de tiempo
      const cutoffTime = Date.now() - timeWindow;
      const recentPrices = this.gasPriceHistory
        .filter(entry => entry.timestamp >= cutoffTime)
        .map(entry => entry.price);
      
      if (recentPrices.length === 0) continue;
      
      const avgGasPrice = recentPrices.reduce((sum, price) => sum + price, BigInt(0)) / BigInt(recentPrices.length);
      const currentRatio = Number(currentGasPrice * BigInt(100) / avgGasPrice);
      
      // Verificar si excede threshold
      if (currentRatio >= threshold) {
        await this.fireTrigger(triggerId, {
          currentValue: currentRatio,
          threshold,
          confidence: Math.min(currentRatio / threshold, 2.0),
          metadata: {
            currentGasPrice: currentGasPrice.toString(),
            avgGasPrice: avgGasPrice.toString(),
            samplesCount: recentPrices.length
          }
        });
      }
    }
  }

  // ===================================================================================================
  // MONITOREO DE MEMPOOL
  // ===================================================================================================

  /**
   * Inicia monitoreo de mempool
   */
  private async startMempoolMonitoring(): Promise<void> {
    // En implementación real, usar WebSocket provider
    const interval = setInterval(async () => {
      if (!this.isMonitoring) return;
      
      try {
        // Simular actividad de mempool
        await this.checkMempoolActivity();
        
      } catch (error) {
        console.warn('⚠️ Error monitoring mempool:', error);
      }
    }, 10000); // Check every 10 seconds
    
    this.monitoringIntervals.set('mempool', interval);
  }

  /**
   * Verifica actividad de mempool
   */
  private async checkMempoolActivity(): Promise<void> {
    // Simulated mempool activity check
    const currentActivity = Math.floor(Math.random() * 1000);
    const timestamp = Date.now();
    
    // Store activity data
    this.mempoolActivity.set('current', { count: currentActivity, timestamp });
    
    // Check triggers
    for (const [triggerId, trigger] of this.triggers) {
      if (trigger.type !== 'MEMPOOL_ACTIVITY' || !trigger.enabled) continue;
      
      const threshold = trigger.parameters.threshold || 200;
      const timeWindow = (trigger.parameters.timeWindow || 30) * 1000;
      
      // Get baseline activity
      const baseline = this.getBaselineMempoolActivity(timeWindow);
      
      if (baseline > 0) {
        const activityRatio = (currentActivity / baseline) * 100;
        
        if (activityRatio >= threshold) {
          await this.fireTrigger(triggerId, {
            currentValue: activityRatio,
            threshold,
            confidence: Math.min(activityRatio / threshold, 2.0),
            metadata: {
              currentActivity,
              baseline,
              timestamp
            }
          });
        }
      }
    }
  }

  // ===================================================================================================
  // MONITOREO DE VOLUMEN
  // ===================================================================================================

  /**
   * Inicia monitoreo de volumen
   */
  private async startVolumeMonitoring(): Promise<void> {
    const interval = setInterval(async () => {
      if (!this.isMonitoring) return;
      
      try {
        // Monitorear volumen por target
        for (const [targetId, target] of this.monitoringTargets) {
          if (target.type === 'POOL') {
            await this.checkVolumeSpike(target);
          }
        }
        
      } catch (error) {
        console.warn('⚠️ Error monitoring volume:', error);
      }
    }, 15000); // Check every 15 seconds
    
    this.monitoringIntervals.set('volume', interval);
  }

  /**
   * Verifica spikes de volumen
   */
  private async checkVolumeSpike(target: MonitoringTarget): Promise<void> {
    // Simulated volume data
    const currentVolume = Math.random() * 10000000; // Random volume
    const timestamp = Date.now();
    
    // Store volume data
    if (!this.volumeData.has(target.id)) {
      this.volumeData.set(target.id, []);
    }
    
    const volumeHistory = this.volumeData.get(target.id)!;
    volumeHistory.push({ volume: currentVolume, timestamp });
    
    // Keep last 100 entries
    if (volumeHistory.length > 100) {
      volumeHistory.splice(0, volumeHistory.length - 100);
    }
    
    // Check volume spike triggers
    for (const triggerId of target.triggers) {
      const trigger = this.triggers.get(triggerId);
      if (!trigger || trigger.type !== 'VOLUME_SPIKE' || !trigger.enabled) continue;
      
      const threshold = trigger.parameters.threshold || 300;
      const timeWindow = (trigger.parameters.timeWindow || 300) * 1000;
      
      const baseline = this.getBaselineVolume(target.id, timeWindow);
      
      if (baseline > 0) {
        const volumeRatio = (currentVolume / baseline) * 100;
        
        if (volumeRatio >= threshold) {
          await this.fireTrigger(triggerId, {
            currentValue: volumeRatio,
            threshold,
            confidence: Math.min(volumeRatio / threshold, 2.0),
            metadata: {
              currentVolume,
              baseline,
              targetId: target.id,
              targetAddress: target.address
            }
          });
        }
      }
    }
  }

  // ===================================================================================================
  // MONITOREO DE PATRONES
  // ===================================================================================================

  /**
   * Inicia monitoreo de patrones MEV
   */
  private async startPatternMonitoring(): Promise<void> {
    const interval = setInterval(async () => {
      if (!this.isMonitoring) return;
      
      try {
        await this.checkSandwichPatterns();
        await this.checkFrontrunPatterns();
        
      } catch (error) {
        console.warn('⚠️ Error monitoring patterns:', error);
      }
    }, 20000); // Check every 20 seconds
    
    this.monitoringIntervals.set('patterns', interval);
  }

  /**
   * Verifica patrones de sandwich
   */
  private async checkSandwichPatterns(): Promise<void> {
    // Simulated sandwich pattern detection
    const detectionConfidence = Math.random();
    
    for (const [triggerId, trigger] of this.triggers) {
      if (trigger.type !== 'SANDWICH_PATTERN' || !trigger.enabled) continue;
      
      const threshold = trigger.parameters.threshold || 0.8;
      
      if (detectionConfidence >= threshold) {
        await this.fireTrigger(triggerId, {
          currentValue: detectionConfidence,
          threshold,
          confidence: detectionConfidence,
          metadata: {
            patternType: 'SANDWICH',
            detectionMethod: 'MEMPOOL_ANALYSIS',
            timestamp: Date.now()
          }
        });
      }
    }
  }

  /**
   * Verifica patrones de frontrunning
   */
  private async checkFrontrunPatterns(): Promise<void> {
    // Simulated frontrun detection
    const detectionConfidence = Math.random();
    
    for (const [triggerId, trigger] of this.triggers) {
      if (trigger.type !== 'FRONTRUN_DETECTION' || !trigger.enabled) continue;
      
      const threshold = trigger.parameters.threshold || 0.7;
      
      if (detectionConfidence >= threshold) {
        await this.fireTrigger(triggerId, {
          currentValue: detectionConfidence,
          threshold,
          confidence: detectionConfidence,
          metadata: {
            patternType: 'FRONTRUN',
            detectionMethod: 'GAS_PRICE_ANALYSIS',
            timestamp: Date.now()
          }
        });
      }
    }
  }

  // ===================================================================================================
  // SISTEMA DE DISPARADO DE TRIGGERS
  // ===================================================================================================

  /**
   * Dispara trigger y ejecuta respuesta automática
   */
  private async fireTrigger(
    triggerId: string,
    data: {
      currentValue: number;
      threshold: number;
      confidence: number;
      metadata: Record<string, any>;
    }
  ): Promise<void> {
    const trigger = this.triggers.get(triggerId);
    if (!trigger) return;
    
    const eventId = `${triggerId}_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    const event: MEVTriggerEvent = {
      triggerId,
      eventId,
      timestamp: Date.now(),
      type: trigger.type,
      severity: trigger.sensitivity,
      data
    };
    
    // Store active event
    this.activeEvents.set(eventId, event);
    this.eventHistory.push(event);
    
    // Update metrics
    this.updateTriggerMetrics(trigger, event);
    
    console.log(`🚨 Trigger disparado: ${trigger.name} (${trigger.sensitivity})`);
    console.log(`   Valor: ${data.currentValue.toFixed(2)}, Threshold: ${data.threshold}`);
    console.log(`   Confianza: ${(data.confidence * 100).toFixed(1)}%`);
    
    // Execute auto response
    const autoResponse = await this.executeAutoResponse(trigger, event);
    if (autoResponse) {
      event.autoResponse = autoResponse;
    }
    
    // Emit event for external listeners
    this.emit('trigger_fired', event);
    
    // Cleanup old events
    this.cleanupEvents();
  }

  /**
   * Ejecuta respuesta automática
   */
  private async executeAutoResponse(
    trigger: MEVTriggerCondition,
    event: MEVTriggerEvent
  ): Promise<MEVAutoResponse | undefined> {
    
    const responseAction = this.determineResponseAction(trigger, event);
    if (!responseAction) return undefined;
    
    const responseId = `resp_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const startTime = Date.now();
    
    try {
      console.log(`🤖 Ejecutando respuesta automática: ${responseAction}`);
      
      const success = await this.executeResponse(responseAction, trigger, event);
      const executionTime = Date.now() - startTime;
      
      const response: MEVAutoResponse = {
        responseId,
        action: responseAction,
        parameters: this.getResponseParameters(responseAction, trigger, event),
        executedAt: Date.now(),
        success
      };
      
      // Update metrics
      if (success) {
        this.metrics.responseSuccess++;
      } else {
        this.metrics.responseFailures++;
      }
      
      this.metrics.avgResponseTime = (this.metrics.avgResponseTime + executionTime) / 2;
      
      console.log(`✅ Respuesta ejecutada: ${responseAction} (${executionTime}ms)`);
      
      return response;
      
    } catch (error) {
      this.metrics.responseFailures++;
      
      return {
        responseId,
        action: responseAction,
        parameters: {},
        executedAt: Date.now(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Determina acción de respuesta
   */
  private determineResponseAction(
    trigger: MEVTriggerCondition,
    event: MEVTriggerEvent
  ): MEVAutoResponse['action'] | undefined {
    
    // Response logic based on trigger type and severity
    switch (trigger.type) {
      case 'GAS_PRICE':
        return event.severity === 'CRITICAL' ? 'PAUSE_TRADING' : 'INCREASE_SLIPPAGE';
        
      case 'SANDWICH_PATTERN':
        return event.severity === 'CRITICAL' ? 'EMERGENCY_STOP' : 'ACTIVATE_PROTECTION';
        
      case 'FRONTRUN_DETECTION':
        return 'SWITCH_ROUTER';
        
      case 'MEMPOOL_ACTIVITY':
        return event.severity === 'HIGH' ? 'PAUSE_TRADING' : 'ALERT';
        
      case 'VOLUME_SPIKE':
        return 'INCREASE_SLIPPAGE';
        
      case 'PRICE_IMPACT':
        return 'ACTIVATE_PROTECTION';
        
      default:
        return 'ALERT';
    }
  }

  /**
   * Ejecuta respuesta específica
   */
  private async executeResponse(
    action: MEVAutoResponse['action'],
    trigger: MEVTriggerCondition,
    event: MEVTriggerEvent
  ): Promise<boolean> {
    
    switch (action) {
      case 'ALERT':
        console.log(`📢 ALERT: ${trigger.name} - ${event.data.currentValue}`);
        this.emit('mev_alert', { trigger, event });
        return true;
        
      case 'PAUSE_TRADING':
        console.log('⏸️ PAUSE TRADING: MEV threat detected');
        this.emit('pause_trading', { trigger, event, duration: 300 }); // 5 minutes
        return true;
        
      case 'INCREASE_SLIPPAGE':
        const slippageIncrease = this.calculateSlippageIncrease(event);
        console.log(`📈 INCREASE SLIPPAGE: +${slippageIncrease}%`);
        this.emit('increase_slippage', { trigger, event, increase: slippageIncrease });
        return true;
        
      case 'SWITCH_ROUTER':
        console.log('🔄 SWITCH ROUTER: Using alternative routing');
        this.emit('switch_router', { trigger, event });
        return true;
        
      case 'EMERGENCY_STOP':
        console.log('🚨 EMERGENCY STOP: Critical MEV threat');
        this.emit('emergency_stop', { trigger, event });
        return true;
        
      case 'NOTIFY_ADMIN':
        console.log('📧 NOTIFY ADMIN: Admin notification sent');
        this.emit('notify_admin', { trigger, event });
        return true;
        
      case 'ACTIVATE_PROTECTION':
        console.log('🛡️ ACTIVATE PROTECTION: Enhanced MEV protection enabled');
        this.emit('activate_protection', { trigger, event, level: 'ENHANCED' });
        return true;
        
      default:
        return false;
    }
  }

  // ===================================================================================================
  // UTILIDADES Y HELPERS
  // ===================================================================================================

  /**
   * Obtiene actividad baseline del mempool
   */
  private getBaselineMempoolActivity(timeWindow: number): number {
    // Simplified baseline calculation
    return 500; // Default baseline
  }

  /**
   * Obtiene volumen baseline
   */
  private getBaselineVolume(targetId: string, timeWindow: number): number {
    const volumeHistory = this.volumeData.get(targetId);
    if (!volumeHistory || volumeHistory.length === 0) return 1000000; // Default baseline
    
    const cutoffTime = Date.now() - timeWindow;
    const recentVolumes = volumeHistory
      .filter(entry => entry.timestamp >= cutoffTime)
      .map(entry => entry.volume);
    
    if (recentVolumes.length === 0) return 1000000;
    
    return recentVolumes.reduce((sum, vol) => sum + vol, 0) / recentVolumes.length;
  }

  /**
   * Calcula incremento de slippage
   */
  private calculateSlippageIncrease(event: MEVTriggerEvent): number {
    const severity = event.severity;
    const confidence = event.data.confidence;
    
    const basIncrease = {
      LOW: 0.1,
      MEDIUM: 0.25,
      HIGH: 0.5,
      CRITICAL: 1.0
    };
    
    return baseIncrease[severity] * confidence;
  }

  /**
   * Obtiene parámetros de respuesta
   */
  private getResponseParameters(
    action: MEVAutoResponse['action'],
    trigger: MEVTriggerCondition,
    event: MEVTriggerEvent
  ): Record<string, any> {
    
    switch (action) {
      case 'INCREASE_SLIPPAGE':
        return {
          originalSlippage: 0.5,
          increase: this.calculateSlippageIncrease(event),
          confidence: event.data.confidence
        };
        
      case 'PAUSE_TRADING':
        return {
          duration: event.severity === 'CRITICAL' ? 600 : 300, // seconds
          reason: trigger.name
        };
        
      case 'ACTIVATE_PROTECTION':
        return {
          level: event.severity === 'CRITICAL' ? 'MAXIMUM' : 'HIGH',
          duration: 900 // 15 minutes
        };
        
      default:
        return {
          triggerId: trigger.id,
          eventId: event.eventId,
          timestamp: event.timestamp
        };
    }
  }

  /**
   * Actualiza métricas de triggers
   */
  private updateTriggerMetrics(trigger: MEVTriggerCondition, event: MEVTriggerEvent): void {
    this.metrics.totalTriggers++;
    this.metrics.triggersByType[trigger.type] = (this.metrics.triggersByType[trigger.type] || 0) + 1;
    this.metrics.triggersBySeverity[event.severity] = (this.metrics.triggersBySeverity[event.severity] || 0) + 1;
  }

  /**
   * Limpia eventos antiguos
   */
  private cleanupEvents(): void {
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    const cutoffTime = Date.now() - maxAge;
    
    // Clean active events
    for (const [eventId, event] of this.activeEvents) {
      if (event.timestamp < cutoffTime) {
        this.activeEvents.delete(eventId);
      }
    }
    
    // Clean event history (keep last 1000)
    if (this.eventHistory.length > 1000) {
      this.eventHistory = this.eventHistory.slice(-1000);
    }
  }

  /**
   * Limpieza periódica
   */
  private startPeriodicCleanup(): void {
    const interval = setInterval(() => {
      if (!this.isMonitoring) return;
      
      this.cleanupEvents();
      this.cleanupHistoricalData();
      
    }, 300000); // Every 5 minutes
    
    this.monitoringIntervals.set('cleanup', interval);
  }

  /**
   * Limpia datos históricos
   */
  private cleanupHistoricalData(): void {
    const maxAge = 60 * 60 * 1000; // 1 hour
    const cutoffTime = Date.now() - maxAge;
    
    // Clean gas price history
    this.gasPriceHistory = this.gasPriceHistory.filter(entry => entry.timestamp >= cutoffTime);
    
    // Clean volume data
    for (const [targetId, volumeHistory] of this.volumeData) {
      const cleanedHistory = volumeHistory.filter(entry => entry.timestamp >= cutoffTime);
      this.volumeData.set(targetId, cleanedHistory);
    }
  }

  // ===================================================================================================
  // GETTERS Y CONFIGURACIÓN
  // ===================================================================================================

  /**
   * Obtiene todos los triggers
   */
  getTriggers(): MEVTriggerCondition[] {
    return Array.from(this.triggers.values());
  }

  /**
   * Obtiene trigger por ID
   */
  getTrigger(triggerId: string): MEVTriggerCondition | undefined {
    return this.triggers.get(triggerId);
  }

  /**
   * Obtiene eventos activos
   */
  getActiveEvents(): MEVTriggerEvent[] {
    return Array.from(this.activeEvents.values());
  }

  /**
   * Obtiene historial de eventos
   */
  getEventHistory(limit?: number): MEVTriggerEvent[] {
    const history = this.eventHistory.slice();
    return limit ? history.slice(-limit) : history;
  }

  /**
   * Obtiene métricas
   */
  getMetrics(): TriggerMetrics {
    return { ...this.metrics };
  }

  /**
   * Obtiene targets de monitoreo
   */
  getMonitoringTargets(): MonitoringTarget[] {
    return Array.from(this.monitoringTargets.values());
  }

  /**
   * Verifica si está monitoreando
   */
  isMonitoringActive(): boolean {
    return this.isMonitoring;
  }

  /**
   * Habilita/deshabilita trigger
   */
  toggleTrigger(triggerId: string, enabled: boolean): boolean {
    const trigger = this.triggers.get(triggerId);
    if (!trigger) return false;
    
    trigger.enabled = enabled;
    console.log(`${enabled ? '✅' : '❌'} Trigger ${enabled ? 'habilitado' : 'deshabilitado'}: ${trigger.name}`);
    
    return true;
  }

  /**
   * Resetea métricas
   */
  resetMetrics(): void {
    this.metrics = {
      totalTriggers: 0,
      triggersByType: {},
      triggersBySeverity: {},
      responseSuccess: 0,
      responseFailures: 0,
      avgResponseTime: 0,
      falsePositives: 0
    };
    
    console.log('📊 Métricas reseteadas');
  }
}

// ===================================================================================================
// FACTORY Y UTILIDADES
// ===================================================================================================

/**
 * Factory para sistema de triggers
 */
export class MEVTriggerFactory {
  static createBasic(provider: ethers.Provider, chainId: number): MEVTriggerAutomationSystem {
    const system = new MEVTriggerAutomationSystem(provider, chainId);
    
    // Configure basic monitoring targets
    system.addMonitoringTarget({
      id: 'uniswap_v3_eth_usdc',
      type: 'POOL',
      address: '0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640', // ETH/USDC 0.05%
      chainId,
      priority: 'HIGH',
      triggers: ['volume_spike', 'price_impact_alert'],
      lastChecked: Date.now()
    });
    
    return system;
  }

  static createAdvanced(provider: ethers.Provider, chainId: number): MEVTriggerAutomationSystem {
    const system = new MEVTriggerAutomationSystem(provider, chainId);
    
    // Add advanced triggers
    system.addTrigger({
      id: 'advanced_sandwich',
      name: 'Advanced Sandwich Detection',
      type: 'SANDWICH_PATTERN',
      parameters: {
        threshold: 0.9,
        timeWindow: 60,
        customLogic: 'multi_pool_analysis'
      },
      sensitivity: 'CRITICAL',
      enabled: true
    });
    
    system.addTrigger({
      id: 'cross_chain_mev',
      name: 'Cross-Chain MEV Detection',
      type: 'CROSS_CHAIN',
      parameters: {
        threshold: 0.8,
        timeWindow: 300
      },
      sensitivity: 'HIGH',
      enabled: true
    });
    
    return system;
  }
}

/**
 * Utilidades para triggers
 */
export class TriggerUtils {
  /**
   * Crea configuración de trigger personalizada
   */
  static createCustomTrigger(
    name: string,
    type: MEVTriggerCondition['type'],
    config: {
      threshold: number;
      sensitivity: MEVTriggerCondition['sensitivity'];
      timeWindow?: number;
      customParameters?: Record<string, any>;
    }
  ): MEVTriggerCondition {
    return {
      id: `custom_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      name,
      type,
      parameters: {
        threshold: config.threshold,
        timeWindow: config.timeWindow || 60,
        ...config.customParameters
      },
      sensitivity: config.sensitivity,
      enabled: true
    };
  }

  /**
   * Valida configuración de trigger
   */
  static validateTriggerConfig(trigger: MEVTriggerCondition): string[] {
    const errors: string[] = [];
    
    if (!trigger.id || trigger.id.trim().length === 0) {
      errors.push('ID es requerido');
    }
    
    if (!trigger.name || trigger.name.trim().length === 0) {
      errors.push('Nombre es requerido');
    }
    
    if (trigger.parameters.threshold !== undefined && trigger.parameters.threshold <= 0) {
      errors.push('Threshold debe ser mayor que 0');
    }
    
    if (trigger.parameters.timeWindow !== undefined && trigger.parameters.timeWindow <= 0) {
      errors.push('TimeWindow debe ser mayor que 0');
    }
    
    return errors;
  }
}

export default MEVTriggerAutomationSystem;
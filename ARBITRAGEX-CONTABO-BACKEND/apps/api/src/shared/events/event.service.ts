// ArbitrageX Pro 2025 - Event Service
// Event-driven architecture for real-time arbitrage updates

import { EventEmitter } from 'events';
import { Logger } from '../monitoring/logger';

export interface ArbitrageEvent {
  id: string;
  type: string;
  tenantId: string;
  timestamp: Date;
  data: any;
  metadata?: Record<string, any>;
}

export interface EventHandler {
  (event: ArbitrageEvent): Promise<void> | void;
}

export class EventService extends EventEmitter {
  private logger = new Logger('EventService');
  private handlers = new Map<string, EventHandler[]>();

  // ==========================================================================
  // EVENT REGISTRATION
  // ==========================================================================

  registerHandler(eventType: string, handler: EventHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    
    this.handlers.get(eventType)!.push(handler);
    this.logger.debug(`Registered handler for event type: ${eventType}`);
  }

  unregisterHandler(eventType: string, handler: EventHandler): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
        this.logger.debug(`Unregistered handler for event type: ${eventType}`);
      }
    }
  }

  // ==========================================================================
  // EVENT EMISSION
  // ==========================================================================

  async emitEvent(event: Omit<ArbitrageEvent, 'id' | 'timestamp'>): Promise<void> {
    const fullEvent: ArbitrageEvent = {
      ...event,
      id: this.generateEventId(),
      timestamp: new Date(),
    };

    this.logger.debug('Emitting event', {
      eventId: fullEvent.id,
      type: fullEvent.type,
      tenantId: fullEvent.tenantId,
    });

    // Emit to local handlers
    await this.handleEvent(fullEvent);

    // Emit to EventEmitter (for WebSocket broadcasting)
    this.emit(fullEvent.type, fullEvent);
    this.emit('*', fullEvent); // Global listener
  }

  private async handleEvent(event: ArbitrageEvent): Promise<void> {
    const handlers = this.handlers.get(event.type) || [];
    
    if (handlers.length === 0) {
      this.logger.debug(`No handlers registered for event type: ${event.type}`);
      return;
    }

    // Execute all handlers in parallel
    const handlerPromises = handlers.map(async (handler) => {
      try {
        await handler(event);
      } catch (error) {
        this.logger.error(`Event handler failed for ${event.type}`, {
          eventId: event.id,
          tenantId: event.tenantId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });

    await Promise.allSettled(handlerPromises);
  }

  // ==========================================================================
  // ARBITRAGE-SPECIFIC EVENTS
  // ==========================================================================

  async emitOpportunityDetected(
    tenantId: string,
    opportunity: any
  ): Promise<void> {
    await this.emitEvent({
      type: 'arbitrage.opportunity.detected',
      tenantId,
      data: opportunity,
      metadata: {
        blockchain: opportunity.blockchain_from,
        strategy: opportunity.strategy_name,
        profitPercentage: opportunity.profit_percentage,
      },
    });
  }

  async emitExecutionStarted(
    tenantId: string,
    execution: any
  ): Promise<void> {
    await this.emitEvent({
      type: 'arbitrage.execution.started',
      tenantId,
      data: execution,
      metadata: {
        opportunityId: execution.opportunity_id,
        strategy: execution.strategy_name,
        amount: execution.amount_in,
      },
    });
  }

  async emitExecutionCompleted(
    tenantId: string,
    execution: any
  ): Promise<void> {
    await this.emitEvent({
      type: 'arbitrage.execution.completed',
      tenantId,
      data: execution,
      metadata: {
        opportunityId: execution.opportunity_id,
        status: execution.status,
        profit: execution.actual_profit,
        executionTime: execution.execution_time_ms,
      },
    });
  }

  async emitRiskAlertTriggered(
    tenantId: string,
    alert: {
      type: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      message: string;
      data: any;
    }
  ): Promise<void> {
    await this.emitEvent({
      type: 'arbitrage.risk.alert',
      tenantId,
      data: alert,
      metadata: {
        alertType: alert.type,
        severity: alert.severity,
      },
    });
  }

  async emitPriceUpdateReceived(
    blockchain: string,
    tokenAddress: string,
    priceData: any
  ): Promise<void> {
    // Price updates are global events (no specific tenant)
    await this.emitEvent({
      type: 'blockchain.price.updated',
      tenantId: 'system',
      data: priceData,
      metadata: {
        blockchain,
        tokenAddress,
        price: priceData.price_usd,
      },
    });
  }

  async emitUserAction(
    tenantId: string,
    userId: string,
    action: string,
    data: any
  ): Promise<void> {
    await this.emitEvent({
      type: 'user.action',
      tenantId,
      data: {
        userId,
        action,
        ...data,
      },
      metadata: {
        userId,
        action,
      },
    });
  }

  // ==========================================================================
  // SUBSCRIPTION MANAGEMENT
  // ==========================================================================

  subscribeToTenantEvents(
    tenantId: string,
    eventTypes: string[],
    callback: (event: ArbitrageEvent) => void
  ): () => void {
    const handler = (event: ArbitrageEvent) => {
      if (event.tenantId === tenantId && eventTypes.includes(event.type)) {
        callback(event);
      }
    };

    this.on('*', handler);

    // Return unsubscribe function
    return () => {
      this.off('*', handler);
    };
  }

  subscribeToOpportunities(
    tenantId: string,
    callback: (opportunity: any) => void
  ): () => void {
    return this.subscribeToTenantEvents(
      tenantId,
      ['arbitrage.opportunity.detected'],
      (event) => callback(event.data)
    );
  }

  subscribeToExecutions(
    tenantId: string,
    callback: (execution: any) => void
  ): () => void {
    return this.subscribeToTenantEvents(
      tenantId,
      ['arbitrage.execution.started', 'arbitrage.execution.completed'],
      (event) => callback(event.data)
    );
  }

  subscribeToAlerts(
    tenantId: string,
    callback: (alert: any) => void
  ): () => void {
    return this.subscribeToTenantEvents(
      tenantId,
      ['arbitrage.risk.alert'],
      (event) => callback(event.data)
    );
  }

  // ==========================================================================
  // EVENT REPLAY AND HISTORY
  // ==========================================================================

  private eventHistory: ArbitrageEvent[] = [];
  private readonly maxHistorySize = 1000;

  private storeEvent(event: ArbitrageEvent): void {
    this.eventHistory.push(event);
    
    // Keep only recent events
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
    }
  }

  getRecentEvents(
    tenantId?: string,
    eventType?: string,
    limit = 50
  ): ArbitrageEvent[] {
    let events = [...this.eventHistory];

    if (tenantId) {
      events = events.filter(e => e.tenantId === tenantId);
    }

    if (eventType) {
      events = events.filter(e => e.type === eventType);
    }

    return events
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  // ==========================================================================
  // UTILITIES
  // ==========================================================================

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  getEventStats(): {
    totalHandlers: number;
    handlersByType: Record<string, number>;
    eventHistorySize: number;
  } {
    const handlersByType: Record<string, number> = {};
    
    for (const [type, handlers] of this.handlers.entries()) {
      handlersByType[type] = handlers.length;
    }

    return {
      totalHandlers: Array.from(this.handlers.values())
        .reduce((sum, handlers) => sum + handlers.length, 0),
      handlersByType,
      eventHistorySize: this.eventHistory.length,
    };
  }

  // ==========================================================================
  // CLEANUP
  // ==========================================================================

  clearEventHistory(): void {
    this.eventHistory = [];
    this.logger.info('Event history cleared');
  }

  clearAllHandlers(): void {
    this.handlers.clear();
    this.removeAllListeners();
    this.logger.info('All event handlers cleared');
  }
}

// Export event types for type safety
export const EVENT_TYPES = {
  // Arbitrage events
  OPPORTUNITY_DETECTED: 'arbitrage.opportunity.detected',
  EXECUTION_STARTED: 'arbitrage.execution.started',
  EXECUTION_COMPLETED: 'arbitrage.execution.completed',
  RISK_ALERT: 'arbitrage.risk.alert',
  
  // Blockchain events
  PRICE_UPDATED: 'blockchain.price.updated',
  NETWORK_CONGESTION: 'blockchain.network.congestion',
  
  // User events
  USER_ACTION: 'user.action',
  USER_LOGIN: 'user.login',
  USER_LOGOUT: 'user.logout',
  
  // System events
  SYSTEM_ERROR: 'system.error',
  SYSTEM_MAINTENANCE: 'system.maintenance',
} as const;
/**
 * ArbitrageX Pro 2025 - Sistema de Risk Management Avanzado
 * Control de riesgos, stop-loss automático y gestión de posiciones
 */

import { EventEmitter } from 'events';
import { ALERT_CONFIGS } from '../config/production.config';
import { ArbitrageMetrics } from './monitoring.service';

export interface RiskParameters {
  // Límites de Capital
  maxPositionSize: number;        // Máximo $ por posición
  maxDailyLoss: number;          // Máxima pérdida diaria $
  maxDrawdown: number;           // Máximo drawdown %
  
  // Stop Loss
  stopLossPercentage: number;    // % de stop loss por transacción
  emergencyStopLoss: number;     // $ absoluto de emergency stop
  
  // Límites de Exposición
  maxNetworkExposure: number;    // % máximo por red
  maxStrategyExposure: number;   // % máximo por estrategia
  
  // Velocidad de Trading
  maxTransactionsPerHour: number;
  cooldownAfterLoss: number;     // ms de cooldown después de pérdida
  
  // Volatilidad
  maxVolatility: number;         // Volatilidad máxima aceptada %
  volatilityWindow: number;      // Ventana de cálculo de volatilidad (ms)
}

export interface RiskMetrics {
  // Métricas de Riesgo Actuales
  currentDrawdown: number;       // % actual de drawdown
  dailyPnL: number;             // P&L del día $
  totalExposure: number;        // Exposición total $
  
  // Distribución de Riesgo
  networkExposure: Record<string, number>;    // % por red
  strategyExposure: Record<string, number>;   // % por estrategia
  
  // Métricas de Volatilidad
  portfolioVolatility: number;   // Volatilidad del portfolio %
  sharpeRatio: number;          // Ratio de Sharpe
  maxDrawdownPeriod: number;    // Período de máximo drawdown
  
  // Alertas Activas
  activeRiskAlerts: RiskAlert[];
  riskScore: number;            // Puntuación de riesgo 0-100
  
  // Estado del Sistema
  emergencyMode: boolean;
  stopLossActive: boolean;
  lastRiskCheck: number;
}

export interface RiskAlert {
  id: string;
  type: 'position_limit' | 'daily_loss' | 'drawdown' | 'volatility' | 'exposure' | 'emergency';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  threshold: number;
  currentValue: number;
  network?: string;
  strategy?: string;
  timestamp: number;
  resolved: boolean;
  actions: string[];
}

export interface Position {
  id: string;
  network: string;
  strategy: string;
  entryPrice: number;
  currentPrice: number;
  size: number;              // $ USD
  pnl: number;              // $ USD P&L actual
  pnlPercentage: number;    // % P&L
  entryTime: number;
  
  // Risk Controls
  stopLoss: number;         // Precio de stop loss
  takeProfit?: number;      // Precio de take profit
  maxHoldTime: number;      // Tiempo máximo de retención (ms)
  
  // Estado
  isActive: boolean;
  exitReason?: string;
  exitTime?: number;
}

export interface RiskRule {
  id: string;
  name: string;
  enabled: boolean;
  condition: (metrics: RiskMetrics, position?: Position) => boolean;
  action: 'alert' | 'reduce_position' | 'stop_strategy' | 'emergency_stop';
  parameters: Record<string, any>;
  priority: number;
  lastTriggered?: number;
}

/**
 * ⚡ SISTEMA DE RISK MANAGEMENT AVANZADO
 */
export class RiskManagementService extends EventEmitter {
  private riskParameters: RiskParameters;
  private riskMetrics: RiskMetrics;
  private positions: Map<string, Position> = new Map();
  private riskRules: RiskRule[] = [];
  private isActive = false;
  private monitoringInterval?: NodeJS.Timeout;
  
  // Historial para cálculos
  private priceHistory: Map<string, number[]> = new Map();
  private pnlHistory: number[] = [];
  private transactionCounts: Map<number, number> = new Map(); // hourly counts

  constructor(customParams?: Partial<RiskParameters>) {
    super();
    
    this.riskParameters = {
      maxPositionSize: 50000,        // $50K max por posición
      maxDailyLoss: 10000,          // $10K max pérdida diaria
      maxDrawdown: 15,              // 15% max drawdown
      stopLossPercentage: 2,        // 2% stop loss por transacción
      emergencyStopLoss: 25000,     // $25K emergency stop
      maxNetworkExposure: 30,       // 30% max por red
      maxStrategyExposure: 40,      // 40% max por estrategia
      maxTransactionsPerHour: 100,  // 100 tx/hora max
      cooldownAfterLoss: 60000,     // 1 minuto cooldown
      maxVolatility: 25,            // 25% max volatilidad
      volatilityWindow: 3600000,    // 1 hora para volatilidad
      ...customParams
    };
    
    this.riskMetrics = this.initializeRiskMetrics();
    this.initializeRiskRules();
  }

  /**
   * 🚀 INICIALIZAR MÉTRICAS DE RIESGO
   */
  private initializeRiskMetrics(): RiskMetrics {
    return {
      currentDrawdown: 0,
      dailyPnL: 0,
      totalExposure: 0,
      networkExposure: {},
      strategyExposure: {},
      portfolioVolatility: 0,
      sharpeRatio: 0,
      maxDrawdownPeriod: 0,
      activeRiskAlerts: [],
      riskScore: 0,
      emergencyMode: false,
      stopLossActive: false,
      lastRiskCheck: Date.now()
    };
  }

  /**
   * 📋 INICIALIZAR REGLAS DE RIESGO
   */
  private initializeRiskRules(): void {
    // Regla: Límite de posición individual
    this.riskRules.push({
      id: 'position_size_limit',
      name: 'Límite de Tamaño de Posición',
      enabled: true,
      condition: (metrics, position) => {
        return position ? position.size > this.riskParameters.maxPositionSize : false;
      },
      action: 'reduce_position',
      parameters: { maxSize: this.riskParameters.maxPositionSize },
      priority: 1
    });

    // Regla: Pérdida diaria máxima
    this.riskRules.push({
      id: 'daily_loss_limit',
      name: 'Límite de Pérdida Diaria',
      enabled: true,
      condition: (metrics) => {
        return metrics.dailyPnL < -this.riskParameters.maxDailyLoss;
      },
      action: 'emergency_stop',
      parameters: { limit: this.riskParameters.maxDailyLoss },
      priority: 1
    });

    // Regla: Drawdown máximo
    this.riskRules.push({
      id: 'max_drawdown',
      name: 'Drawdown Máximo',
      enabled: true,
      condition: (metrics) => {
        return metrics.currentDrawdown > this.riskParameters.maxDrawdown;
      },
      action: 'emergency_stop',
      parameters: { limit: this.riskParameters.maxDrawdown },
      priority: 1
    });

    // Regla: Stop loss por posición
    this.riskRules.push({
      id: 'position_stop_loss',
      name: 'Stop Loss por Posición',
      enabled: true,
      condition: (metrics, position) => {
        return position ? position.pnlPercentage <= -this.riskParameters.stopLossPercentage : false;
      },
      action: 'reduce_position',
      parameters: { stopLoss: this.riskParameters.stopLossPercentage },
      priority: 2
    });

    // Regla: Exposición por red
    this.riskRules.push({
      id: 'network_exposure_limit',
      name: 'Límite de Exposición por Red',
      enabled: true,
      condition: (metrics) => {
        return Object.values(metrics.networkExposure).some(exp => exp > this.riskParameters.maxNetworkExposure);
      },
      action: 'stop_strategy',
      parameters: { limit: this.riskParameters.maxNetworkExposure },
      priority: 2
    });

    // Regla: Volatilidad alta
    this.riskRules.push({
      id: 'high_volatility',
      name: 'Volatilidad Alta',
      enabled: true,
      condition: (metrics) => {
        return metrics.portfolioVolatility > this.riskParameters.maxVolatility;
      },
      action: 'alert',
      parameters: { limit: this.riskParameters.maxVolatility },
      priority: 3
    });

    // Regla: Velocidad de trading
    this.riskRules.push({
      id: 'transaction_velocity',
      name: 'Velocidad de Trading',
      enabled: true,
      condition: () => {
        const currentHour = Math.floor(Date.now() / (60 * 60 * 1000));
        const txCount = this.transactionCounts.get(currentHour) || 0;
        return txCount > this.riskParameters.maxTransactionsPerHour;
      },
      action: 'alert',
      parameters: { limit: this.riskParameters.maxTransactionsPerHour },
      priority: 3
    });
  }

  /**
   * 🚀 INICIAR SISTEMA DE RIESGO
   */
  public start(): void {
    if (this.isActive) return;
    
    this.isActive = true;
    console.log('🔥 ArbitrageX Pro 2025 - Risk Management INICIADO');
    
    // Monitorear cada 5 segundos
    this.monitoringInterval = setInterval(() => {
      this.performRiskCheck();
    }, 5000);
    
    this.emit('risk:started');
  }

  /**
   * 🛑 DETENER SISTEMA DE RIESGO
   */
  public stop(): void {
    if (!this.isActive) return;
    
    this.isActive = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    console.log('🛑 Risk Management Service DETENIDO');
    this.emit('risk:stopped');
  }

  /**
   * 🔍 VERIFICACIÓN DE RIESGO PRINCIPAL
   */
  private performRiskCheck(): void {
    try {
      // Actualizar métricas de riesgo
      this.updateRiskMetrics();
      
      // Evaluar reglas de riesgo
      this.evaluateRiskRules();
      
      // Verificar posiciones individuales
      this.checkPositions();
      
      // Calcular score de riesgo
      this.calculateRiskScore();
      
      this.riskMetrics.lastRiskCheck = Date.now();
      
      // Emitir métricas actualizadas
      this.emit('risk:updated', this.riskMetrics);
      
    } catch (error) {
      console.error('❌ Error en verificación de riesgo:', error);
      this.emit('risk:error', error);
    }
  }

  /**
   * 📊 ACTUALIZAR MÉTRICAS DE RIESGO
   */
  private updateRiskMetrics(): void {
    // Calcular P&L diario
    const today = new Date().toDateString();
    const todayPnL = Array.from(this.positions.values())
      .filter(pos => new Date(pos.entryTime).toDateString() === today)
      .reduce((sum, pos) => sum + pos.pnl, 0);
    
    this.riskMetrics.dailyPnL = todayPnL;
    
    // Calcular exposición total
    this.riskMetrics.totalExposure = Array.from(this.positions.values())
      .filter(pos => pos.isActive)
      .reduce((sum, pos) => sum + pos.size, 0);
    
    // Calcular exposición por red
    const networkExposure: Record<string, number> = {};
    Array.from(this.positions.values()).forEach(pos => {
      if (pos.isActive) {
        networkExposure[pos.network] = (networkExposure[pos.network] || 0) + pos.size;
      }
    });
    
    // Convertir a porcentajes
    Object.keys(networkExposure).forEach(network => {
      this.riskMetrics.networkExposure[network] = 
        (networkExposure[network] / this.riskMetrics.totalExposure) * 100;
    });
    
    // Calcular exposición por estrategia
    const strategyExposure: Record<string, number> = {};
    Array.from(this.positions.values()).forEach(pos => {
      if (pos.isActive) {
        strategyExposure[pos.strategy] = (strategyExposure[pos.strategy] || 0) + pos.size;
      }
    });
    
    Object.keys(strategyExposure).forEach(strategy => {
      this.riskMetrics.strategyExposure[strategy] = 
        (strategyExposure[strategy] / this.riskMetrics.totalExposure) * 100;
    });
    
    // Calcular drawdown actual
    this.calculateCurrentDrawdown();
    
    // Calcular volatilidad del portfolio
    this.calculatePortfolioVolatility();
    
    // Actualizar historial de P&L
    this.pnlHistory.push(todayPnL);
    if (this.pnlHistory.length > 1000) {
      this.pnlHistory = this.pnlHistory.slice(-1000);
    }
  }

  /**
   * 📉 CALCULAR DRAWDOWN ACTUAL
   */
  private calculateCurrentDrawdown(): void {
    if (this.pnlHistory.length < 2) {
      this.riskMetrics.currentDrawdown = 0;
      return;
    }
    
    let maxValue = this.pnlHistory[0];
    let maxDrawdown = 0;
    
    for (let i = 1; i < this.pnlHistory.length; i++) {
      if (this.pnlHistory[i] > maxValue) {
        maxValue = this.pnlHistory[i];
      } else {
        const drawdown = ((maxValue - this.pnlHistory[i]) / Math.abs(maxValue)) * 100;
        maxDrawdown = Math.max(maxDrawdown, drawdown);
      }
    }
    
    this.riskMetrics.currentDrawdown = maxDrawdown;
  }

  /**
   * 📊 CALCULAR VOLATILIDAD DEL PORTFOLIO
   */
  private calculatePortfolioVolatility(): void {
    if (this.pnlHistory.length < 10) {
      this.riskMetrics.portfolioVolatility = 0;
      return;
    }
    
    const returns = [];
    for (let i = 1; i < this.pnlHistory.length; i++) {
      const prevValue = this.pnlHistory[i - 1];
      const currentValue = this.pnlHistory[i];
      
      if (prevValue !== 0) {
        returns.push((currentValue - prevValue) / Math.abs(prevValue));
      }
    }
    
    if (returns.length === 0) {
      this.riskMetrics.portfolioVolatility = 0;
      return;
    }
    
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
    
    this.riskMetrics.portfolioVolatility = Math.sqrt(variance) * 100; // Convertir a porcentaje
    
    // Calcular Sharpe Ratio (simplificado)
    const riskFreeRate = 0.02; // 2% anual
    this.riskMetrics.sharpeRatio = this.riskMetrics.portfolioVolatility > 0 ? 
      (mean * 252 - riskFreeRate) / (this.riskMetrics.portfolioVolatility / 100) : 0;
  }

  /**
   * ⚖️ EVALUAR REGLAS DE RIESGO
   */
  private evaluateRiskRules(): void {
    for (const rule of this.riskRules.filter(r => r.enabled)) {
      try {
        if (rule.condition(this.riskMetrics)) {
          this.triggerRiskRule(rule);
        }
      } catch (error) {
        console.error(`❌ Error evaluando regla ${rule.id}:`, error);
      }
    }
  }

  /**
   * 🚨 ACTIVAR REGLA DE RIESGO
   */
  private triggerRiskRule(rule: RiskRule): void {
    const now = Date.now();
    
    // Evitar spam de reglas (cooldown de 1 minuto)
    if (rule.lastTriggered && (now - rule.lastTriggered) < 60000) {
      return;
    }
    
    rule.lastTriggered = now;
    
    console.log(`🚨 Regla de riesgo activada: ${rule.name}`);
    
    // Crear alerta de riesgo
    const alert: RiskAlert = {
      id: `risk_${rule.id}_${now}`,
      type: rule.id as any,
      severity: this.getSeverityFromAction(rule.action),
      message: `Regla activada: ${rule.name}`,
      threshold: rule.parameters.limit || 0,
      currentValue: this.getCurrentValueForRule(rule),
      timestamp: now,
      resolved: false,
      actions: []
    };
    
    this.riskMetrics.activeRiskAlerts.push(alert);
    
    // Ejecutar acción
    this.executeRiskAction(rule, alert);
    
    this.emit('risk:rule_triggered', { rule, alert });
  }

  /**
   * ⚡ EJECUTAR ACCIÓN DE RIESGO
   */
  private executeRiskAction(rule: RiskRule, alert: RiskAlert): void {
    switch (rule.action) {
      case 'alert':
        this.sendRiskAlert(alert);
        break;
        
      case 'reduce_position':
        this.reduceRiskyPositions(rule);
        alert.actions.push('Posiciones reducidas automáticamente');
        break;
        
      case 'stop_strategy':
        this.stopRiskyStrategies(rule);
        alert.actions.push('Estrategias riesgosas detenidas');
        break;
        
      case 'emergency_stop':
        this.activateEmergencyStop(rule, alert);
        alert.actions.push('PARADA DE EMERGENCIA ACTIVADA');
        break;
    }
  }

  /**
   * 🔍 VERIFICAR POSICIONES INDIVIDUALES
   */
  private checkPositions(): void {
    for (const position of this.positions.values()) {
      if (!position.isActive) continue;
      
      // Actualizar P&L de la posición
      this.updatePositionPnL(position);
      
      // Verificar stop loss
      if (this.shouldTriggerStopLoss(position)) {
        this.triggerStopLoss(position);
      }
      
      // Verificar tiempo máximo de retención
      if (this.shouldExitByTime(position)) {
        this.exitPosition(position, 'max_hold_time');
      }
      
      // Evaluar reglas específicas de posición
      for (const rule of this.riskRules.filter(r => r.enabled)) {
        if (rule.condition(this.riskMetrics, position)) {
          this.triggerRiskRule(rule);
        }
      }
    }
  }

  /**
   * 💰 ACTUALIZAR P&L DE POSICIÓN
   */
  private updatePositionPnL(position: Position): void {
    // En producción, obtener precios reales de oráculos
    position.currentPrice = position.entryPrice * (1 + (Math.random() - 0.5) * 0.1); // Simulación ±5%
    
    const priceChange = position.currentPrice - position.entryPrice;
    position.pnl = (priceChange / position.entryPrice) * position.size;
    position.pnlPercentage = (priceChange / position.entryPrice) * 100;
  }

  /**
   * 🛑 VERIFICAR STOP LOSS
   */
  private shouldTriggerStopLoss(position: Position): boolean {
    return position.pnlPercentage <= -this.riskParameters.stopLossPercentage;
  }

  /**
   * ⚡ ACTIVAR STOP LOSS
   */
  private triggerStopLoss(position: Position): void {
    console.log(`🛑 Stop Loss activado para posición ${position.id}: ${position.pnlPercentage.toFixed(2)}%`);
    
    this.exitPosition(position, 'stop_loss');
    
    const alert: RiskAlert = {
      id: `stop_loss_${position.id}_${Date.now()}`,
      type: 'position_limit',
      severity: 'high',
      message: `Stop Loss ejecutado: ${position.strategy} en ${position.network}`,
      threshold: -this.riskParameters.stopLossPercentage,
      currentValue: position.pnlPercentage,
      network: position.network,
      strategy: position.strategy,
      timestamp: Date.now(),
      resolved: true,
      actions: ['Posición cerrada automáticamente']
    };
    
    this.riskMetrics.activeRiskAlerts.push(alert);
    this.emit('risk:stop_loss', { position, alert });
  }

  /**
   * 🚪 CERRAR POSICIÓN
   */
  public exitPosition(position: Position, reason: string): void {
    position.isActive = false;
    position.exitReason = reason;
    position.exitTime = Date.now();
    
    console.log(`🚪 Posición cerrada: ${position.id} - Razón: ${reason} - P&L: $${position.pnl.toFixed(2)}`);
    
    this.emit('position:closed', position);
  }

  /**
   * 📊 CALCULAR SCORE DE RIESGO
   */
  private calculateRiskScore(): void {
    let score = 0;
    
    // Drawdown (30% del score)
    score += (this.riskMetrics.currentDrawdown / this.riskParameters.maxDrawdown) * 30;
    
    // Pérdida diaria (25% del score)
    if (this.riskMetrics.dailyPnL < 0) {
      score += (Math.abs(this.riskMetrics.dailyPnL) / this.riskParameters.maxDailyLoss) * 25;
    }
    
    // Volatilidad (20% del score)
    score += (this.riskMetrics.portfolioVolatility / this.riskParameters.maxVolatility) * 20;
    
    // Exposición concentrada (15% del score)
    const maxNetworkExp = Math.max(...Object.values(this.riskMetrics.networkExposure));
    score += (maxNetworkExp / this.riskParameters.maxNetworkExposure) * 15;
    
    // Alertas activas (10% del score)
    const criticalAlerts = this.riskMetrics.activeRiskAlerts.filter(a => 
      a.severity === 'critical' && !a.resolved
    ).length;
    score += criticalAlerts * 10;
    
    this.riskMetrics.riskScore = Math.min(Math.max(score, 0), 100);
    
    // Activar modo de emergencia si score > 80
    if (this.riskMetrics.riskScore > 80 && !this.riskMetrics.emergencyMode) {
      this.activateEmergencyMode('High risk score detected');
    }
  }

  /**
   * 🆘 ACTIVAR MODO DE EMERGENCIA
   */
  public activateEmergencyMode(reason: string): void {
    this.riskMetrics.emergencyMode = true;
    
    console.log('🆘 MODO DE EMERGENCIA ACTIVADO:', reason);
    
    // Cerrar todas las posiciones activas
    for (const position of this.positions.values()) {
      if (position.isActive) {
        this.exitPosition(position, 'emergency_stop');
      }
    }
    
    const alert: RiskAlert = {
      id: `emergency_${Date.now()}`,
      type: 'emergency',
      severity: 'critical',
      message: `MODO DE EMERGENCIA: ${reason}`,
      threshold: 0,
      currentValue: this.riskMetrics.riskScore,
      timestamp: Date.now(),
      resolved: false,
      actions: ['Todas las posiciones cerradas', 'Trading suspendido']
    };
    
    this.riskMetrics.activeRiskAlerts.push(alert);
    this.emit('risk:emergency', { reason, alert });
  }

  /**
   * ✅ DESACTIVAR MODO DE EMERGENCIA
   */
  public deactivateEmergencyMode(): void {
    this.riskMetrics.emergencyMode = false;
    console.log('✅ Modo de emergencia DESACTIVADO');
    this.emit('risk:emergency_cleared');
  }

  /**
   * 📈 ABRIR NUEVA POSICIÓN
   */
  public openPosition(
    network: string,
    strategy: string,
    entryPrice: number,
    size: number
  ): string | null {
    
    // Verificar si el sistema está en modo de emergencia
    if (this.riskMetrics.emergencyMode) {
      console.warn('❌ No se puede abrir posición: Modo de emergencia activo');
      return null;
    }
    
    // Verificar límites de posición
    if (size > this.riskParameters.maxPositionSize) {
      console.warn(`❌ Posición excede límite: $${size} > $${this.riskParameters.maxPositionSize}`);
      return null;
    }
    
    // Verificar exposición por red
    const currentNetworkExposure = this.riskMetrics.networkExposure[network] || 0;
    const newExposurePercentage = ((this.getNetworkExposureUSD(network) + size) / 
      (this.riskMetrics.totalExposure + size)) * 100;
    
    if (newExposurePercentage > this.riskParameters.maxNetworkExposure) {
      console.warn(`❌ Exposición por red excede límite: ${newExposurePercentage}% > ${this.riskParameters.maxNetworkExposure}%`);
      return null;
    }
    
    const positionId = `${network}_${strategy}_${Date.now()}`;
    const position: Position = {
      id: positionId,
      network,
      strategy,
      entryPrice,
      currentPrice: entryPrice,
      size,
      pnl: 0,
      pnlPercentage: 0,
      entryTime: Date.now(),
      stopLoss: entryPrice * (1 - this.riskParameters.stopLossPercentage / 100),
      maxHoldTime: 24 * 60 * 60 * 1000, // 24 horas
      isActive: true
    };
    
    this.positions.set(positionId, position);
    
    console.log(`📈 Nueva posición abierta: ${positionId} - $${size}`);
    this.emit('position:opened', position);
    
    return positionId;
  }

  /**
   * 🔧 MÉTODOS AUXILIARES
   */
  private getSeverityFromAction(action: string): RiskAlert['severity'] {
    switch (action) {
      case 'emergency_stop': return 'critical';
      case 'stop_strategy': return 'high';
      case 'reduce_position': return 'medium';
      default: return 'low';
    }
  }

  private getCurrentValueForRule(rule: RiskRule): number {
    switch (rule.id) {
      case 'daily_loss_limit': return this.riskMetrics.dailyPnL;
      case 'max_drawdown': return this.riskMetrics.currentDrawdown;
      case 'high_volatility': return this.riskMetrics.portfolioVolatility;
      default: return 0;
    }
  }

  private sendRiskAlert(alert: RiskAlert): void {
    console.log(`🚨 ALERTA DE RIESGO: ${alert.message}`);
    // En producción, integrar con NotificationService
  }

  private reduceRiskyPositions(rule: RiskRule): void {
    // Implementar lógica para reducir posiciones riesgosas
    console.log(`📉 Reduciendo posiciones riesgosas según regla: ${rule.name}`);
  }

  private stopRiskyStrategies(rule: RiskRule): void {
    // Implementar lógica para detener estrategias riesgosas
    console.log(`⏸️ Deteniendo estrategias riesgosas según regla: ${rule.name}`);
  }

  private activateEmergencyStop(rule: RiskRule, alert: RiskAlert): void {
    this.activateEmergencyMode(rule.name);
  }

  private shouldExitByTime(position: Position): boolean {
    return (Date.now() - position.entryTime) > position.maxHoldTime;
  }

  private getNetworkExposureUSD(network: string): number {
    return Array.from(this.positions.values())
      .filter(pos => pos.network === network && pos.isActive)
      .reduce((sum, pos) => sum + pos.size, 0);
  }

  /**
   * 📊 MÉTODOS PÚBLICOS
   */
  public getRiskMetrics(): RiskMetrics {
    return { ...this.riskMetrics };
  }

  public getRiskParameters(): RiskParameters {
    return { ...this.riskParameters };
  }

  public updateRiskParameters(params: Partial<RiskParameters>): void {
    this.riskParameters = { ...this.riskParameters, ...params };
    console.log('⚙️ Parámetros de riesgo actualizados');
    this.emit('risk:parameters_updated', this.riskParameters);
  }

  public getActivePositions(): Position[] {
    return Array.from(this.positions.values()).filter(pos => pos.isActive);
  }

  public getPositionById(id: string): Position | null {
    return this.positions.get(id) || null;
  }

  public getActiveRiskAlerts(): RiskAlert[] {
    return this.riskMetrics.activeRiskAlerts.filter(alert => !alert.resolved);
  }

  public resolveAlert(alertId: string): boolean {
    const alert = this.riskMetrics.activeRiskAlerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      this.emit('risk:alert_resolved', alert);
      return true;
    }
    return false;
  }

  /**
   * 🧪 MÉTODO DE PRUEBA
   */
  public simulateMarketStress(): void {
    console.log('🧪 Simulando estrés de mercado...');
    
    // Simular pérdidas en todas las posiciones
    for (const position of this.positions.values()) {
      if (position.isActive) {
        position.currentPrice = position.entryPrice * 0.95; // -5%
        this.updatePositionPnL(position);
      }
    }
    
    // Forzar verificación de riesgo
    this.performRiskCheck();
    
    console.log('🧪 Simulación de estrés completada');
  }
}

export default RiskManagementService;
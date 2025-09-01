/**
 * ArbitrageX Supreme - Sistema de Monitoreo en Tiempo Real
 * Ingenio Pichichi S.A. - Actividades 13-20
 * 
 * Monitoreo avanzado con WebSockets, alertas inteligentes y métricas en tiempo real
 */

import { EventEmitter } from 'events'

// Types para el sistema de monitoreo
export interface MonitoringMetrics {
  // Performance Metrics
  executionLatency: number
  throughputTPS: number
  errorRate: number
  memoryUsage: number
  cpuUsage: number
  
  // Arbitrage Metrics
  opportunitiesDetected: number
  successfulExecutions: number
  failedExecutions: number
  totalProfitUSD: number
  averageROI: number
  
  // Network Metrics
  blockHeight: number
  gasPrice: number
  networkLatency: number
  rpcResponseTime: number
  
  // DeFi Metrics
  totalTVL: number
  protocolsOnline: number
  liquidityUtilization: number
  
  timestamp: number
}

export interface AlertRule {
  id: string
  name: string
  type: 'threshold' | 'anomaly' | 'pattern'
  metric: keyof MonitoringMetrics
  condition: 'gt' | 'lt' | 'eq' | 'change'
  value: number
  severity: 'low' | 'medium' | 'high' | 'critical'
  enabled: boolean
  cooldown: number // milliseconds
  lastTriggered?: number
}

export interface Alert {
  id: string
  ruleId: string
  title: string
  message: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  metric: string
  currentValue: number
  threshold: number
  timestamp: number
  acknowledged: boolean
}

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'critical'
  components: {
    [key: string]: {
      status: 'online' | 'degraded' | 'offline'
      lastCheck: number
      responseTime: number
      errorRate: number
    }
  }
  alerts: Alert[]
  uptime: number
}

/**
 * Sistema de Monitoreo Principal
 */
export class ArbitrageMonitor extends EventEmitter {
  private static instance: ArbitrageMonitor
  private metrics: MonitoringMetrics[] = []
  private alertRules: Map<string, AlertRule> = new Map()
  private activeAlerts: Map<string, Alert> = new Map()
  private systemHealth: SystemHealth
  private isRunning = false
  private intervalId?: NodeJS.Timeout

  private constructor() {
    super()
    this.systemHealth = {
      overall: 'healthy',
      components: {},
      alerts: [],
      uptime: Date.now()
    }
    this.setupDefaultAlertRules()
  }

  static getInstance(): ArbitrageMonitor {
    if (!ArbitrageMonitor.instance) {
      ArbitrageMonitor.instance = new ArbitrageMonitor()
    }
    return ArbitrageMonitor.instance
  }

  /**
   * Iniciar el sistema de monitoreo
   */
  start(intervalMs = 5000): void {
    if (this.isRunning) return

    this.isRunning = true
    this.intervalId = setInterval(() => {
      this.collectMetrics()
      this.processAlertRules()
      this.updateSystemHealth()
      this.emit('metricsUpdated', this.getCurrentMetrics())
    }, intervalMs)

    console.log('🔍 ArbitrageMonitor iniciado - Monitoreo en tiempo real activo')
  }

  /**
   * Detener el sistema de monitoreo
   */
  stop(): void {
    if (!this.isRunning) return

    this.isRunning = false
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = undefined
    }

    console.log('⏹️ ArbitrageMonitor detenido')
  }

  /**
   * Recopilar métricas del sistema
   */
  private async collectMetrics(): Promise<void> {
    try {
      // Simular métricas reales (en producción se conectaría a fuentes reales)
      const mockMetrics: MonitoringMetrics = {
        // Performance
        executionLatency: Math.random() * 500 + 50, // 50-550ms
        throughputTPS: Math.random() * 100 + 10, // 10-110 TPS
        errorRate: Math.random() * 5, // 0-5%
        memoryUsage: Math.random() * 30 + 40, // 40-70%
        cpuUsage: Math.random() * 50 + 20, // 20-70%
        
        // Arbitrage
        opportunitiesDetected: Math.floor(Math.random() * 20) + 5,
        successfulExecutions: Math.floor(Math.random() * 10) + 1,
        failedExecutions: Math.floor(Math.random() * 3),
        totalProfitUSD: Math.random() * 5000 + 1000,
        averageROI: Math.random() * 10 + 2, // 2-12%
        
        // Network
        blockHeight: 19000000 + Math.floor(Math.random() * 1000),
        gasPrice: Math.random() * 50 + 20, // 20-70 Gwei
        networkLatency: Math.random() * 200 + 50, // 50-250ms
        rpcResponseTime: Math.random() * 100 + 20, // 20-120ms
        
        // DeFi
        totalTVL: Math.random() * 1000000000 + 50000000000, // 50B-51B
        protocolsOnline: Math.floor(Math.random() * 5) + 195, // 195-200
        liquidityUtilization: Math.random() * 40 + 60, // 60-100%
        
        timestamp: Date.now()
      }

      // Mantener solo las últimas 100 métricas
      this.metrics.push(mockMetrics)
      if (this.metrics.length > 100) {
        this.metrics.shift()
      }

      // Actualizar componentes del sistema
      this.updateComponentHealth('rpc', mockMetrics.rpcResponseTime, mockMetrics.errorRate)
      this.updateComponentHealth('dex-protocols', mockMetrics.protocolsOnline > 190 ? 50 : 200, 0)
      this.updateComponentHealth('monitoring', 25, 0)

    } catch (error) {
      console.error('Error recopilando métricas:', error)
      this.updateComponentHealth('monitoring', 0, 100)
    }
  }

  /**
   * Actualizar estado de componente
   */
  private updateComponentHealth(name: string, responseTime: number, errorRate: number): void {
    let status: 'online' | 'degraded' | 'offline' = 'online'
    
    if (errorRate > 10 || responseTime > 1000) {
      status = 'offline'
    } else if (errorRate > 5 || responseTime > 500) {
      status = 'degraded'
    }

    this.systemHealth.components[name] = {
      status,
      lastCheck: Date.now(),
      responseTime,
      errorRate
    }
  }

  /**
   * Configurar reglas de alerta por defecto
   */
  private setupDefaultAlertRules(): void {
    const defaultRules: AlertRule[] = [
      {
        id: 'high-error-rate',
        name: 'Alta Tasa de Errores',
        type: 'threshold',
        metric: 'errorRate',
        condition: 'gt',
        value: 10,
        severity: 'high',
        enabled: true,
        cooldown: 300000 // 5 minutos
      },
      {
        id: 'high-latency',
        name: 'Alta Latencia de Ejecución',
        type: 'threshold',
        metric: 'executionLatency',
        condition: 'gt',
        value: 1000,
        severity: 'medium',
        enabled: true,
        cooldown: 180000 // 3 minutos
      },
      {
        id: 'low-opportunities',
        name: 'Pocas Oportunidades Detectadas',
        type: 'threshold',
        metric: 'opportunitiesDetected',
        condition: 'lt',
        value: 2,
        severity: 'medium',
        enabled: true,
        cooldown: 600000 // 10 minutos
      },
      {
        id: 'high-gas-price',
        name: 'Precio de Gas Elevado',
        type: 'threshold',
        metric: 'gasPrice',
        condition: 'gt',
        value: 100,
        severity: 'low',
        enabled: true,
        cooldown: 300000
      },
      {
        id: 'critical-memory',
        name: 'Uso Crítico de Memoria',
        type: 'threshold',
        metric: 'memoryUsage',
        condition: 'gt',
        value: 85,
        severity: 'critical',
        enabled: true,
        cooldown: 60000 // 1 minuto
      }
    ]

    defaultRules.forEach(rule => {
      this.alertRules.set(rule.id, rule)
    })
  }

  /**
   * Procesar reglas de alerta
   */
  private processAlertRules(): void {
    const currentMetrics = this.getCurrentMetrics()
    if (!currentMetrics) return

    this.alertRules.forEach(rule => {
      if (!rule.enabled) return

      // Verificar cooldown
      if (rule.lastTriggered && (Date.now() - rule.lastTriggered) < rule.cooldown) {
        return
      }

      const currentValue = currentMetrics[rule.metric] as number
      let triggered = false

      switch (rule.condition) {
        case 'gt':
          triggered = currentValue > rule.value
          break
        case 'lt':
          triggered = currentValue < rule.value
          break
        case 'eq':
          triggered = currentValue === rule.value
          break
      }

      if (triggered) {
        this.triggerAlert(rule, currentValue)
      }
    })
  }

  /**
   * Disparar alerta
   */
  private triggerAlert(rule: AlertRule, currentValue: number): void {
    const alert: Alert = {
      id: `${rule.id}_${Date.now()}`,
      ruleId: rule.id,
      title: rule.name,
      message: `${rule.name}: ${currentValue} ${rule.condition} ${rule.value}`,
      severity: rule.severity,
      metric: rule.metric,
      currentValue,
      threshold: rule.value,
      timestamp: Date.now(),
      acknowledged: false
    }

    this.activeAlerts.set(alert.id, alert)
    this.systemHealth.alerts = Array.from(this.activeAlerts.values())
    
    // Actualizar timestamp de última activación
    rule.lastTriggered = Date.now()
    
    // Emitir evento de alerta
    this.emit('alertTriggered', alert)
    
    console.warn(`🚨 ALERTA [${alert.severity.toUpperCase()}]: ${alert.message}`)
  }

  /**
   * Actualizar estado general del sistema
   */
  private updateSystemHealth(): void {
    const components = Object.values(this.systemHealth.components)
    const criticalAlerts = Array.from(this.activeAlerts.values())
      .filter(alert => alert.severity === 'critical' && !alert.acknowledged)

    if (criticalAlerts.length > 0 || components.some(c => c.status === 'offline')) {
      this.systemHealth.overall = 'critical'
    } else if (components.some(c => c.status === 'degraded')) {
      this.systemHealth.overall = 'degraded'
    } else {
      this.systemHealth.overall = 'healthy'
    }
  }

  // ============================================
  // API PÚBLICA
  // ============================================

  getCurrentMetrics(): MonitoringMetrics | null {
    return this.metrics[this.metrics.length - 1] || null
  }

  getMetricsHistory(count = 50): MonitoringMetrics[] {
    return this.metrics.slice(-count)
  }

  getSystemHealth(): SystemHealth {
    return { ...this.systemHealth }
  }

  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values())
  }

  acknowledgeAlert(alertId: string): boolean {
    const alert = this.activeAlerts.get(alertId)
    if (alert) {
      alert.acknowledged = true
      this.emit('alertAcknowledged', alert)
      return true
    }
    return false
  }

  addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule)
    this.emit('alertRuleAdded', rule)
  }

  removeAlertRule(ruleId: string): boolean {
    const removed = this.alertRules.delete(ruleId)
    if (removed) {
      this.emit('alertRuleRemoved', ruleId)
    }
    return removed
  }

  getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values())
  }

  /**
   * Obtener estadísticas de rendimiento
   */
  getPerformanceStats(): {
    avgLatency: number
    avgThroughput: number
    avgErrorRate: number
    totalOpportunities: number
    totalProfit: number
  } {
    if (this.metrics.length === 0) {
      return {
        avgLatency: 0,
        avgThroughput: 0,
        avgErrorRate: 0,
        totalOpportunities: 0,
        totalProfit: 0
      }
    }

    const recent = this.metrics.slice(-20) // Últimas 20 métricas

    return {
      avgLatency: recent.reduce((sum, m) => sum + m.executionLatency, 0) / recent.length,
      avgThroughput: recent.reduce((sum, m) => sum + m.throughputTPS, 0) / recent.length,
      avgErrorRate: recent.reduce((sum, m) => sum + m.errorRate, 0) / recent.length,
      totalOpportunities: recent.reduce((sum, m) => sum + m.opportunitiesDetected, 0),
      totalProfit: recent.reduce((sum, m) => sum + m.totalProfitUSD, 0)
    }
  }
}

// Exportar instancia singleton
export const arbitrageMonitor = ArbitrageMonitor.getInstance()

/**
 * Hook de React para usar el sistema de monitoreo
 */
export const useArbitrageMonitoring = () => {
  const [metrics, setMetrics] = useState<MonitoringMetrics | null>(null)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null)

  useEffect(() => {
    const monitor = ArbitrageMonitor.getInstance()
    
    const handleMetricsUpdate = (newMetrics: MonitoringMetrics) => {
      setMetrics(newMetrics)
      setSystemHealth(monitor.getSystemHealth())
    }
    
    const handleAlertTriggered = (alert: Alert) => {
      setAlerts(monitor.getActiveAlerts())
    }

    monitor.on('metricsUpdated', handleMetricsUpdate)
    monitor.on('alertTriggered', handleAlertTriggered)
    
    // Inicializar datos
    setMetrics(monitor.getCurrentMetrics())
    setAlerts(monitor.getActiveAlerts())
    setSystemHealth(monitor.getSystemHealth())

    return () => {
      monitor.off('metricsUpdated', handleMetricsUpdate)
      monitor.off('alertTriggered', handleAlertTriggered)
    }
  }, [])

  return {
    metrics,
    alerts,
    systemHealth,
    acknowledgeAlert: (alertId: string) => arbitrageMonitor.acknowledgeAlert(alertId),
    getPerformanceStats: () => arbitrageMonitor.getPerformanceStats()
  }
}

import { useState, useEffect } from 'react'
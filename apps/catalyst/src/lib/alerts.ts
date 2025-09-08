// ===================================================================
// ARBITRAGEX SUPREME - SISTEMA DE ALERTAS AVANZADO
// Actividades 46-50: Advanced Alerting and Notification System
// Ingenio Pichichi S.A. - Hector Fabio Riascos C.
// ===================================================================

import { EventEmitter } from 'events';

// ============================================================================
// INTERFACES Y TIPOS
// ============================================================================

export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';
export type AlertStatus = 'active' | 'resolved' | 'silenced' | 'expired';
export type NotificationChannel = 'email' | 'slack' | 'webhook' | 'sms' | 'push' | 'telegram';

export interface Alert {
  id: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  status: AlertStatus;
  source: string;
  category: string;
  tags: string[];
  metadata: Record<string, any>;
  createdAt: number;
  updatedAt: number;
  resolvedAt?: number;
  silencedUntil?: number;
  count: number; // Para alertas duplicadas
  fingerprint: string; // Para deduplicación
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  query: string;
  condition: AlertCondition;
  severity: AlertSeverity;
  evaluationInterval: number; // ms
  forDuration: number; // ms - tiempo antes de activar
  labels: Record<string, string>;
  annotations: Record<string, string>;
  enabled: boolean;
  silenceAfterResolve: number; // ms
  maxAlerts: number;
  rateLimit: {
    count: number;
    window: number; // ms
  };
}

export interface AlertCondition {
  type: 'threshold' | 'anomaly' | 'heartbeat' | 'composite';
  operator?: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'ne';
  value?: number;
  threshold?: {
    warning?: number;
    critical?: number;
  };
  timeWindow?: number;
  missingDataPolicy: 'no_data' | 'alerting' | 'keep_last';
}

export interface NotificationRule {
  id: string;
  name: string;
  channels: NotificationChannel[];
  matchers: AlertMatcher[];
  groupBy: string[];
  groupWait: number; // ms
  groupInterval: number; // ms
  repeatInterval: number; // ms
  muteTimeIntervals: TimeInterval[];
  escalationRules: EscalationRule[];
  enabled: boolean;
}

export interface AlertMatcher {
  label: string;
  operator: 'eq' | 'ne' | 'regex' | 'not_regex';
  value: string;
}

export interface TimeInterval {
  name: string;
  timeIntervals: {
    times: { startTime: string; endTime: string }[];
    weekdays?: string[];
    daysOfMonth?: string[];
    months?: string[];
    years?: string[];
  }[];
}

export interface EscalationRule {
  after: number; // ms
  channels: NotificationChannel[];
  severity?: AlertSeverity;
}

export interface NotificationConfig {
  email: {
    smtp: {
      host: string;
      port: number;
      secure: boolean;
      auth: { user: string; pass: string };
    };
    from: string;
    templates: Record<AlertSeverity, string>;
  };
  slack: {
    webhookUrl: string;
    channel: string;
    username: string;
    iconEmoji: string;
    templates: Record<AlertSeverity, any>;
  };
  webhook: {
    url: string;
    method: 'POST' | 'PUT';
    headers: Record<string, string>;
    timeout: number;
    retries: number;
  };
  sms: {
    provider: 'twilio' | 'aws_sns';
    credentials: Record<string, string>;
    from: string;
  };
  telegram: {
    botToken: string;
    chatId: string;
  };
}

export interface AlertMetrics {
  totalAlerts: number;
  activeAlerts: number;
  alertsByCategory: Record<string, number>;
  alertsBySeverity: Record<AlertSeverity, number>;
  alertsPerMinute: number;
  avgResolutionTime: number;
  notificationsSent: number;
  failedNotifications: number;
}

// ============================================================================
// GESTOR DE ALERTAS
// ============================================================================

export class AlertManager extends EventEmitter {
  private alerts = new Map<string, Alert>();
  private rules = new Map<string, AlertRule>();
  private notificationRules = new Map<string, NotificationRule>();
  private groups = new Map<string, Alert[]>();
  private silences = new Map<string, { until: number; reason: string }>();
  private evaluationIntervals = new Map<string, NodeJS.Timeout>();
  private rateCounters = new Map<string, { count: number; resetTime: number }>();
  private metrics: AlertMetrics = {
    totalAlerts: 0,
    activeAlerts: 0,
    alertsByCategory: {},
    alertsBySeverity: { info: 0, warning: 0, error: 0, critical: 0 },
    alertsPerMinute: 0,
    avgResolutionTime: 0,
    notificationsSent: 0,
    failedNotifications: 0
  };

  constructor() {
    super();
    this.setupDefaultRules();
    this.startMetricsCollection();
  }

  // ========================================================================
  // GESTIÓN DE REGLAS
  // ========================================================================

  // Agregar regla de alerta
  addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
    
    if (rule.enabled) {
      this.startRuleEvaluation(rule);
    }
    
    this.emit('rule:added', { ruleId: rule.id, timestamp: Date.now() });
  }

  // Remover regla
  removeRule(ruleId: string): boolean {
    const removed = this.rules.delete(ruleId);
    
    if (removed) {
      this.stopRuleEvaluation(ruleId);
      this.emit('rule:removed', { ruleId, timestamp: Date.now() });
    }
    
    return removed;
  }

  // Actualizar regla
  updateRule(ruleId: string, updates: Partial<AlertRule>): boolean {
    const rule = this.rules.get(ruleId);
    
    if (rule) {
      const updatedRule = { ...rule, ...updates };
      this.rules.set(ruleId, updatedRule);
      
      // Reiniciar evaluación si está habilitada
      if (updatedRule.enabled) {
        this.stopRuleEvaluation(ruleId);
        this.startRuleEvaluation(updatedRule);
      }
      
      this.emit('rule:updated', { ruleId, timestamp: Date.now() });
      return true;
    }
    
    return false;
  }

  // ========================================================================
  // GESTIÓN DE ALERTAS
  // ========================================================================

  // Crear nueva alerta
  async createAlert(alertData: Omit<Alert, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'count' | 'fingerprint'>): Promise<string> {
    const fingerprint = this.generateFingerprint(alertData);
    const existingAlert = this.findAlertByFingerprint(fingerprint);
    
    if (existingAlert) {
      // Incrementar contador de alerta existente
      existingAlert.count++;
      existingAlert.updatedAt = Date.now();
      
      this.emit('alert:updated', { alert: existingAlert, timestamp: Date.now() });
      return existingAlert.id;
    }
    
    // Crear nueva alerta
    const alert: Alert = {
      ...alertData,
      id: this.generateAlertId(),
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      count: 1,
      fingerprint
    };
    
    this.alerts.set(alert.id, alert);
    this.updateMetrics();
    
    // Procesar para notificaciones
    await this.processAlertForNotification(alert);
    
    this.emit('alert:created', { alert, timestamp: Date.now() });
    
    return alert.id;
  }

  // Resolver alerta
  async resolveAlert(alertId: string, reason?: string): Promise<boolean> {
    const alert = this.alerts.get(alertId);
    
    if (alert && alert.status === 'active') {
      alert.status = 'resolved';
      alert.resolvedAt = Date.now();
      alert.updatedAt = Date.now();
      
      if (reason) {
        alert.metadata.resolveReason = reason;
      }
      
      this.updateMetrics();
      await this.processAlertForNotification(alert);
      
      this.emit('alert:resolved', { alert, timestamp: Date.now() });
      
      return true;
    }
    
    return false;
  }

  // Silenciar alerta
  silenceAlert(alertId: string, duration: number, reason: string): boolean {
    const alert = this.alerts.get(alertId);
    
    if (alert) {
      const until = Date.now() + duration;
      alert.status = 'silenced';
      alert.silencedUntil = until;
      alert.updatedAt = Date.now();
      
      this.silences.set(alertId, { until, reason });
      
      this.emit('alert:silenced', { 
        alertId, 
        until, 
        reason, 
        timestamp: Date.now() 
      });
      
      return true;
    }
    
    return false;
  }

  // Obtener alertas con filtros
  getAlerts(filters: {
    status?: AlertStatus[];
    severity?: AlertSeverity[];
    category?: string[];
    source?: string[];
    tags?: string[];
    limit?: number;
    offset?: number;
  } = {}): Alert[] {
    let results = Array.from(this.alerts.values());
    
    // Aplicar filtros
    if (filters.status) {
      results = results.filter(alert => filters.status!.includes(alert.status));
    }
    
    if (filters.severity) {
      results = results.filter(alert => filters.severity!.includes(alert.severity));
    }
    
    if (filters.category) {
      results = results.filter(alert => filters.category!.includes(alert.category));
    }
    
    if (filters.source) {
      results = results.filter(alert => filters.source!.includes(alert.source));
    }
    
    if (filters.tags) {
      results = results.filter(alert => 
        filters.tags!.some(tag => alert.tags.includes(tag))
      );
    }
    
    // Ordenar por fecha de creación (más reciente primero)
    results.sort((a, b) => b.createdAt - a.createdAt);
    
    // Aplicar paginación
    const start = filters.offset || 0;
    const end = start + (filters.limit || results.length);
    
    return results.slice(start, end);
  }

  // ========================================================================
  // EVALUACIÓN DE REGLAS
  // ========================================================================

  private startRuleEvaluation(rule: AlertRule): void {
    if (this.evaluationIntervals.has(rule.id)) {
      this.stopRuleEvaluation(rule.id);
    }
    
    const interval = setInterval(async () => {
      await this.evaluateRule(rule);
    }, rule.evaluationInterval);
    
    this.evaluationIntervals.set(rule.id, interval);
  }

  private stopRuleEvaluation(ruleId: string): void {
    const interval = this.evaluationIntervals.get(ruleId);
    
    if (interval) {
      clearInterval(interval);
      this.evaluationIntervals.delete(ruleId);
    }
  }

  private async evaluateRule(rule: AlertRule): Promise<void> {
    try {
      // Verificar rate limit
      if (!this.checkRateLimit(rule.id, rule.rateLimit)) {
        return;
      }
      
      // Ejecutar query/condición (simulado)
      const result = await this.executeRuleQuery(rule);
      
      if (this.evaluateCondition(rule.condition, result)) {
        // Condición cumplida - crear o actualizar alerta
        await this.createAlert({
          title: rule.name,
          description: rule.description,
          severity: rule.severity,
          source: 'alert_rule',
          category: rule.labels.category || 'system',
          tags: Object.keys(rule.labels),
          metadata: {
            ruleId: rule.id,
            queryResult: result,
            ...rule.annotations
          }
        });
      }
    } catch (error) {
      console.error(`Error evaluating rule ${rule.id}:`, error);
    }
  }

  private async executeRuleQuery(rule: AlertRule): Promise<any> {
    // Simulación de ejecución de query
    // En producción, esto ejecutaría queries reales contra métricas
    
    switch (rule.query) {
      case 'cpu_usage':
        return { value: Math.random() * 100 };
      case 'memory_usage':
        return { value: Math.random() * 100 };
      case 'api_response_time':
        return { value: Math.random() * 5000 };
      case 'error_rate':
        return { value: Math.random() * 10 };
      case 'active_connections':
        return { value: Math.floor(Math.random() * 1000) };
      default:
        return { value: 0 };
    }
  }

  private evaluateCondition(condition: AlertCondition, result: any): boolean {
    const value = result.value;
    
    switch (condition.type) {
      case 'threshold':
        if (!condition.operator || condition.value === undefined) return false;
        
        switch (condition.operator) {
          case 'gt': return value > condition.value;
          case 'gte': return value >= condition.value;
          case 'lt': return value < condition.value;
          case 'lte': return value <= condition.value;
          case 'eq': return value === condition.value;
          case 'ne': return value !== condition.value;
          default: return false;
        }
        
      case 'anomaly':
        // Implementar detección de anomalías
        return Math.random() > 0.95; // 5% probabilidad de anomalía
        
      case 'heartbeat':
        // Verificar si el sistema está enviando heartbeats
        return Date.now() - (result.lastHeartbeat || 0) > (condition.timeWindow || 60000);
        
      default:
        return false;
    }
  }

  // ========================================================================
  // PROCESAMIENTO DE NOTIFICACIONES
  // ========================================================================

  private async processAlertForNotification(alert: Alert): Promise<void> {
    try {
      // Encontrar reglas de notificación que coincidan
      const matchingRules = this.findMatchingNotificationRules(alert);
      
      for (const rule of matchingRules) {
        if (!rule.enabled) continue;
        
        // Agrupar alertas si es necesario
        const group = this.groupAlert(alert, rule);
        
        // Procesar según el estado del grupo
        await this.processGroupNotification(group, rule);
      }
    } catch (error) {
      console.error('Error processing alert notification:', error);
      this.metrics.failedNotifications++;
    }
  }

  private findMatchingNotificationRules(alert: Alert): NotificationRule[] {
    return Array.from(this.notificationRules.values()).filter(rule => {
      return rule.matchers.every(matcher => this.matchesAlert(alert, matcher));
    });
  }

  private matchesAlert(alert: Alert, matcher: AlertMatcher): boolean {
    let alertValue: string;
    
    // Obtener valor de la alerta según la etiqueta
    switch (matcher.label) {
      case 'severity':
        alertValue = alert.severity;
        break;
      case 'category':
        alertValue = alert.category;
        break;
      case 'source':
        alertValue = alert.source;
        break;
      default:
        alertValue = alert.metadata[matcher.label] || '';
    }
    
    // Evaluar según el operador
    switch (matcher.operator) {
      case 'eq':
        return alertValue === matcher.value;
      case 'ne':
        return alertValue !== matcher.value;
      case 'regex':
        return new RegExp(matcher.value).test(alertValue);
      case 'not_regex':
        return !new RegExp(matcher.value).test(alertValue);
      default:
        return false;
    }
  }

  private groupAlert(alert: Alert, rule: NotificationRule): Alert[] {
    const groupKey = this.generateGroupKey(alert, rule.groupBy);
    
    if (!this.groups.has(groupKey)) {
      this.groups.set(groupKey, []);
    }
    
    const group = this.groups.get(groupKey)!;
    
    // Agregar alerta al grupo si no existe
    if (!group.find(a => a.id === alert.id)) {
      group.push(alert);
    }
    
    return group;
  }

  private generateGroupKey(alert: Alert, groupBy: string[]): string {
    const values = groupBy.map(label => {
      switch (label) {
        case 'severity':
          return alert.severity;
        case 'category':
          return alert.category;
        case 'source':
          return alert.source;
        default:
          return alert.metadata[label] || 'unknown';
      }
    });
    
    return values.join('|');
  }

  private async processGroupNotification(
    group: Alert[],
    rule: NotificationRule
  ): Promise<void> {
    // Implementar lógica de agrupación y envío de notificaciones
    // Por simplicidad, enviamos notificación para cada alerta
    
    for (const alert of group) {
      for (const channel of rule.channels) {
        await this.sendNotification(alert, channel);
      }
    }
  }

  // ========================================================================
  // ENVÍO DE NOTIFICACIONES
  // ========================================================================

  private async sendNotification(alert: Alert, channel: NotificationChannel): Promise<void> {
    try {
      switch (channel) {
        case 'email':
          await this.sendEmailNotification(alert);
          break;
        case 'slack':
          await this.sendSlackNotification(alert);
          break;
        case 'webhook':
          await this.sendWebhookNotification(alert);
          break;
        case 'sms':
          await this.sendSMSNotification(alert);
          break;
        case 'telegram':
          await this.sendTelegramNotification(alert);
          break;
        default:
          console.warn(`Unsupported notification channel: ${channel}`);
      }
      
      this.metrics.notificationsSent++;
      this.emit('notification:sent', { alert, channel, timestamp: Date.now() });
      
    } catch (error) {
      console.error(`Failed to send notification via ${channel}:`, error);
      this.metrics.failedNotifications++;
      this.emit('notification:failed', { alert, channel, error, timestamp: Date.now() });
    }
  }

  private async sendSlackNotification(alert: Alert): Promise<void> {
    const webhook = process.env.SLACK_WEBHOOK_URL;
    if (!webhook) return;
    
    const color = this.getSeverityColor(alert.severity);
    const emoji = this.getSeverityEmoji(alert.severity);
    
    const payload = {
      username: 'ArbitrageX Supreme',
      icon_emoji: ':robot_face:',
      attachments: [{
        color,
        title: `${emoji} ${alert.title}`,
        text: alert.description,
        fields: [
          {
            title: 'Severity',
            value: alert.severity.toUpperCase(),
            short: true
          },
          {
            title: 'Category',
            value: alert.category,
            short: true
          },
          {
            title: 'Source',
            value: alert.source,
            short: true
          },
          {
            title: 'Count',
            value: alert.count.toString(),
            short: true
          }
        ],
        footer: 'ArbitrageX Supreme Alert System',
        ts: Math.floor(alert.createdAt / 1000)
      }]
    };
    
    const response = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      throw new Error(`Slack notification failed: ${response.statusText}`);
    }
  }

  private async sendEmailNotification(alert: Alert): Promise<void> {
    // Implementar envío de email
    console.log('Email notification would be sent:', alert);
  }

  private async sendWebhookNotification(alert: Alert): Promise<void> {
    const webhookUrl = process.env.ALERT_WEBHOOK_URL;
    if (!webhookUrl) return;
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        alert,
        timestamp: Date.now(),
        source: 'arbitragex-supreme'
      })
    });
    
    if (!response.ok) {
      throw new Error(`Webhook notification failed: ${response.statusText}`);
    }
  }

  private async sendSMSNotification(alert: Alert): Promise<void> {
    // Implementar envío de SMS
    console.log('SMS notification would be sent:', alert);
  }

  private async sendTelegramNotification(alert: Alert): Promise<void> {
    // Implementar envío de Telegram
    console.log('Telegram notification would be sent:', alert);
  }

  // ========================================================================
  // UTILIDADES
  // ========================================================================

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  private generateFingerprint(alert: Omit<Alert, 'id' | 'status' | 'createdAt' | 'updatedAt' | 'count' | 'fingerprint'>): string {
    const data = JSON.stringify({
      title: alert.title,
      source: alert.source,
      category: alert.category,
      tags: alert.tags.sort()
    });
    
    return btoa(data).replace(/[+/=]/g, '');
  }

  private findAlertByFingerprint(fingerprint: string): Alert | undefined {
    return Array.from(this.alerts.values()).find(alert => 
      alert.fingerprint === fingerprint && alert.status === 'active'
    );
  }

  private checkRateLimit(ruleId: string, rateLimit: { count: number; window: number }): boolean {
    const now = Date.now();
    const counter = this.rateCounters.get(ruleId);
    
    if (!counter || now > counter.resetTime) {
      this.rateCounters.set(ruleId, {
        count: 1,
        resetTime: now + rateLimit.window
      });
      return true;
    }
    
    if (counter.count >= rateLimit.count) {
      return false;
    }
    
    counter.count++;
    return true;
  }

  private getSeverityColor(severity: AlertSeverity): string {
    switch (severity) {
      case 'info': return 'good';
      case 'warning': return 'warning';
      case 'error': return 'danger';
      case 'critical': return '#ff0000';
      default: return '#cccccc';
    }
  }

  private getSeverityEmoji(severity: AlertSeverity): string {
    switch (severity) {
      case 'info': return 'ℹ️';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      case 'critical': return '🚨';
      default: return '📢';
    }
  }

  private updateMetrics(): void {
    const alerts = Array.from(this.alerts.values());
    
    this.metrics.totalAlerts = alerts.length;
    this.metrics.activeAlerts = alerts.filter(a => a.status === 'active').length;
    
    // Reset contadores
    this.metrics.alertsByCategory = {};
    this.metrics.alertsBySeverity = { info: 0, warning: 0, error: 0, critical: 0 };
    
    alerts.forEach(alert => {
      this.metrics.alertsByCategory[alert.category] = 
        (this.metrics.alertsByCategory[alert.category] || 0) + 1;
      
      this.metrics.alertsBySeverity[alert.severity]++;
    });
    
    // Calcular tiempo promedio de resolución
    const resolvedAlerts = alerts.filter(a => a.status === 'resolved' && a.resolvedAt);
    if (resolvedAlerts.length > 0) {
      const totalResolutionTime = resolvedAlerts.reduce((sum, alert) => 
        sum + (alert.resolvedAt! - alert.createdAt), 0);
      this.metrics.avgResolutionTime = totalResolutionTime / resolvedAlerts.length;
    }
  }

  private startMetricsCollection(): void {
    setInterval(() => {
      this.updateMetrics();
      this.emit('metrics:updated', { metrics: this.metrics, timestamp: Date.now() });
    }, 30000); // Cada 30 segundos
  }

  private setupDefaultRules(): void {
    // Reglas de alerta por defecto
    const defaultRules: AlertRule[] = [
      {
        id: 'high_cpu_usage',
        name: 'High CPU Usage',
        description: 'CPU usage is above 80%',
        query: 'cpu_usage',
        condition: {
          type: 'threshold',
          operator: 'gt',
          value: 80,
          missingDataPolicy: 'no_data'
        },
        severity: 'warning',
        evaluationInterval: 30000,
        forDuration: 60000,
        labels: { category: 'system', service: 'arbitragex' },
        annotations: { runbook: 'https://docs.arbitragex.com/runbooks/cpu' },
        enabled: true,
        silenceAfterResolve: 300000,
        maxAlerts: 10,
        rateLimit: { count: 5, window: 300000 }
      },
      {
        id: 'high_memory_usage',
        name: 'High Memory Usage',
        description: 'Memory usage is above 90%',
        query: 'memory_usage',
        condition: {
          type: 'threshold',
          operator: 'gt',
          value: 90,
          missingDataPolicy: 'alerting'
        },
        severity: 'error',
        evaluationInterval: 15000,
        forDuration: 30000,
        labels: { category: 'system', service: 'arbitragex' },
        annotations: { runbook: 'https://docs.arbitragex.com/runbooks/memory' },
        enabled: true,
        silenceAfterResolve: 600000,
        maxAlerts: 5,
        rateLimit: { count: 3, window: 300000 }
      },
      {
        id: 'api_high_response_time',
        name: 'API High Response Time',
        description: 'API response time is above 5 seconds',
        query: 'api_response_time',
        condition: {
          type: 'threshold',
          operator: 'gt',
          value: 5000,
          missingDataPolicy: 'no_data'
        },
        severity: 'warning',
        evaluationInterval: 10000,
        forDuration: 60000,
        labels: { category: 'api', service: 'arbitragex' },
        annotations: { runbook: 'https://docs.arbitragex.com/runbooks/api' },
        enabled: true,
        silenceAfterResolve: 300000,
        maxAlerts: 20,
        rateLimit: { count: 10, window: 300000 }
      }
    ];

    defaultRules.forEach(rule => this.addRule(rule));
  }

  // Obtener métricas
  getMetrics(): AlertMetrics {
    return { ...this.metrics };
  }

  // Destructor
  destroy(): void {
    // Limpiar intervalos
    this.evaluationIntervals.forEach(interval => clearInterval(interval));
    this.evaluationIntervals.clear();
    
    // Limpiar datos
    this.alerts.clear();
    this.rules.clear();
    this.notificationRules.clear();
    this.groups.clear();
    this.silences.clear();
    this.rateCounters.clear();
    
    // Remover listeners
    this.removeAllListeners();
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const alertManager = new AlertManager();

export default {
  AlertManager,
  alertManager
};
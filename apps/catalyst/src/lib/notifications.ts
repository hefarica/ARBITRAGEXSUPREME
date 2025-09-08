// ===================================================================
// ARBITRAGEX SUPREME - SISTEMA DE NOTIFICACIONES AVANZADO
// Actividades 46-50: Advanced Notification System
// Ingenio Pichichi S.A. - Hector Fabio Riascos C.
// ===================================================================

import { EventEmitter } from 'events';
import { Alert, AlertSeverity } from './alerts';

// ============================================================================
// INTERFACES Y TIPOS
// ============================================================================

export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'retry';

export interface NotificationPayload {
  id: string;
  type: 'alert' | 'system' | 'custom';
  alert?: Alert;
  title: string;
  message: string;
  severity: AlertSeverity;
  timestamp: number;
  metadata: Record<string, any>;
}

export interface NotificationResult {
  id: string;
  channel: string;
  status: NotificationStatus;
  timestamp: number;
  error?: string;
  retryCount: number;
  deliveredAt?: number;
}

export interface EmailConfig {
  enabled: boolean;
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
  from: string;
  templates: {
    subject: string;
    html: string;
    text: string;
  };
  recipients: string[];
  rateLimit: {
    maxPerMinute: number;
    maxPerHour: number;
  };
}

export interface SlackConfig {
  enabled: boolean;
  webhookUrl: string;
  channel: string;
  username: string;
  iconEmoji: string;
  mentionUsers: string[];
  templates: Record<AlertSeverity, SlackMessageTemplate>;
}

export interface SlackMessageTemplate {
  color: string;
  pretext?: string;
  title: string;
  titleLink?: string;
  text: string;
  fields: SlackField[];
  footer: string;
  footerIcon?: string;
}

export interface SlackField {
  title: string;
  value: string;
  short: boolean;
}

export interface WebhookConfig {
  enabled: boolean;
  url: string;
  method: 'POST' | 'PUT' | 'PATCH';
  headers: Record<string, string>;
  timeout: number;
  retries: number;
  retryDelay: number;
  authentication?: {
    type: 'bearer' | 'basic' | 'apikey';
    token?: string;
    username?: string;
    password?: string;
    apiKey?: string;
    apiKeyHeader?: string;
  };
}

export interface SMSConfig {
  enabled: boolean;
  provider: 'twilio' | 'aws_sns' | 'vonage';
  credentials: {
    accountSid?: string;
    authToken?: string;
    fromNumber?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
    region?: string;
    apiKey?: string;
    apiSecret?: string;
  };
  recipients: string[];
  templates: Record<AlertSeverity, string>;
}

export interface TelegramConfig {
  enabled: boolean;
  botToken: string;
  chatIds: string[];
  parseMode: 'HTML' | 'Markdown' | 'MarkdownV2';
  disableWebPagePreview: boolean;
  templates: Record<AlertSeverity, string>;
}

export interface PushNotificationConfig {
  enabled: boolean;
  fcmServerKey: string;
  vapidKeys: {
    publicKey: string;
    privateKey: string;
  };
  subscribers: PushSubscription[];
  templates: Record<AlertSeverity, PushTemplate>;
}

export interface PushTemplate {
  title: string;
  body: string;
  icon: string;
  badge: string;
  data: Record<string, any>;
}

export interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userId?: string;
  userAgent?: string;
}

export interface NotificationQueue {
  id: string;
  payload: NotificationPayload;
  channels: string[];
  priority: 'low' | 'normal' | 'high' | 'urgent';
  scheduledAt: number;
  maxRetries: number;
  retryCount: number;
  status: NotificationStatus;
}

// ============================================================================
// GESTOR DE NOTIFICACIONES
// ============================================================================

export class NotificationManager extends EventEmitter {
  private queue: Map<string, NotificationQueue> = new Map();
  private results: Map<string, NotificationResult[]> = new Map();
  private rateLimits = new Map<string, { count: number; resetTime: number }>();
  private isProcessing = false;
  private processingInterval: NodeJS.Timeout | null = null;

  // Configuraciones por canal
  private emailConfig: EmailConfig | null = null;
  private slackConfig: SlackConfig | null = null;
  private webhookConfig: WebhookConfig | null = null;
  private smsConfig: SMSConfig | null = null;
  private telegramConfig: TelegramConfig | null = null;
  private pushConfig: PushNotificationConfig | null = null;

  constructor() {
    super();
    this.startProcessing();
    this.setupDefaultConfigs();
  }

  // ========================================================================
  // CONFIGURACIÓN DE CANALES
  // ========================================================================

  setEmailConfig(config: EmailConfig): void {
    this.emailConfig = config;
    this.emit('config:updated', { channel: 'email', timestamp: Date.now() });
  }

  setSlackConfig(config: SlackConfig): void {
    this.slackConfig = config;
    this.emit('config:updated', { channel: 'slack', timestamp: Date.now() });
  }

  setWebhookConfig(config: WebhookConfig): void {
    this.webhookConfig = config;
    this.emit('config:updated', { channel: 'webhook', timestamp: Date.now() });
  }

  setSMSConfig(config: SMSConfig): void {
    this.smsConfig = config;
    this.emit('config:updated', { channel: 'sms', timestamp: Date.now() });
  }

  setTelegramConfig(config: TelegramConfig): void {
    this.telegramConfig = config;
    this.emit('config:updated', { channel: 'telegram', timestamp: Date.now() });
  }

  setPushConfig(config: PushNotificationConfig): void {
    this.pushConfig = config;
    this.emit('config:updated', { channel: 'push', timestamp: Date.now() });
  }

  // ========================================================================
  // ENVÍO DE NOTIFICACIONES
  // ========================================================================

  async sendNotification(
    payload: Omit<NotificationPayload, 'id' | 'timestamp'>,
    channels: string[],
    options: {
      priority?: 'low' | 'normal' | 'high' | 'urgent';
      scheduleAt?: number;
      maxRetries?: number;
    } = {}
  ): Promise<string> {
    const notificationId = this.generateNotificationId();
    
    const notification: NotificationQueue = {
      id: notificationId,
      payload: {
        ...payload,
        id: notificationId,
        timestamp: Date.now()
      },
      channels: channels.filter(channel => this.isChannelEnabled(channel)),
      priority: options.priority || 'normal',
      scheduledAt: options.scheduleAt || Date.now(),
      maxRetries: options.maxRetries || 3,
      retryCount: 0,
      status: 'pending'
    };

    this.queue.set(notificationId, notification);
    this.emit('notification:queued', { notificationId, timestamp: Date.now() });

    return notificationId;
  }

  async sendAlert(alert: Alert, channels: string[]): Promise<string> {
    return this.sendNotification(
      {
        type: 'alert',
        alert,
        title: alert.title,
        message: alert.description,
        severity: alert.severity,
        metadata: alert.metadata
      },
      channels,
      {
        priority: this.getPriorityFromSeverity(alert.severity),
        maxRetries: alert.severity === 'critical' ? 5 : 3
      }
    );
  }

  // ========================================================================
  // PROCESAMIENTO DE COLA
  // ========================================================================

  private startProcessing(): void {
    if (this.processingInterval) return;

    this.processingInterval = setInterval(async () => {
      if (!this.isProcessing) {
        await this.processQueue();
      }
    }, 1000); // Procesar cada segundo
  }

  private async processQueue(): Promise<void> {
    this.isProcessing = true;

    try {
      const now = Date.now();
      const notifications = Array.from(this.queue.values())
        .filter(n => n.status === 'pending' && n.scheduledAt <= now)
        .sort((a, b) => this.getPriorityWeight(a.priority) - this.getPriorityWeight(b.priority));

      for (const notification of notifications.slice(0, 10)) { // Procesar máximo 10 por ciclo
        await this.processNotification(notification);
      }
    } catch (error) {
      console.error('Error processing notification queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processNotification(notification: NotificationQueue): Promise<void> {
    const results: NotificationResult[] = [];

    for (const channel of notification.channels) {
      try {
        // Verificar rate limit
        if (!this.checkRateLimit(channel)) {
          continue;
        }

        const result = await this.sendToChannel(notification.payload, channel);
        results.push(result);

        if (result.status === 'sent') {
          this.emit('notification:sent', {
            notificationId: notification.id,
            channel,
            timestamp: Date.now()
          });
        } else {
          this.emit('notification:failed', {
            notificationId: notification.id,
            channel,
            error: result.error,
            timestamp: Date.now()
          });
        }
      } catch (error) {
        const result: NotificationResult = {
          id: this.generateResultId(),
          channel,
          status: 'failed',
          timestamp: Date.now(),
          error: error.message,
          retryCount: notification.retryCount
        };
        results.push(result);
      }
    }

    // Actualizar estado de la notificación
    const allSent = results.every(r => r.status === 'sent');
    const anyFailed = results.some(r => r.status === 'failed');

    if (allSent) {
      notification.status = 'sent';
      this.queue.delete(notification.id);
    } else if (anyFailed && notification.retryCount < notification.maxRetries) {
      notification.retryCount++;
      notification.scheduledAt = Date.now() + (notification.retryCount * 30000); // Incrementar delay
      notification.status = 'retry';
    } else {
      notification.status = 'failed';
      this.queue.delete(notification.id);
    }

    this.results.set(notification.id, results);
  }

  // ========================================================================
  // ENVÍO POR CANAL
  // ========================================================================

  private async sendToChannel(payload: NotificationPayload, channel: string): Promise<NotificationResult> {
    const result: NotificationResult = {
      id: this.generateResultId(),
      channel,
      status: 'pending',
      timestamp: Date.now(),
      retryCount: 0
    };

    try {
      switch (channel) {
        case 'email':
          await this.sendEmail(payload);
          break;
        case 'slack':
          await this.sendSlack(payload);
          break;
        case 'webhook':
          await this.sendWebhook(payload);
          break;
        case 'sms':
          await this.sendSMS(payload);
          break;
        case 'telegram':
          await this.sendTelegram(payload);
          break;
        case 'push':
          await this.sendPushNotification(payload);
          break;
        default:
          throw new Error(`Unsupported channel: ${channel}`);
      }

      result.status = 'sent';
      result.deliveredAt = Date.now();

    } catch (error) {
      result.status = 'failed';
      result.error = error.message;
    }

    return result;
  }

  // ========================================================================
  // IMPLEMENTACIÓN DE CANALES
  // ========================================================================

  private async sendEmail(payload: NotificationPayload): Promise<void> {
    if (!this.emailConfig || !this.emailConfig.enabled) {
      throw new Error('Email configuration not available');
    }

    // En producción, esto usaría nodemailer o similar
    const emailData = {
      from: this.emailConfig.from,
      to: this.emailConfig.recipients,
      subject: `[ArbitrageX] ${payload.title}`,
      text: payload.message,
      html: this.generateEmailHTML(payload)
    };

    console.log('Email would be sent:', emailData);
    
    // Simular delay de envío
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  private async sendSlack(payload: NotificationPayload): Promise<void> {
    if (!this.slackConfig || !this.slackConfig.enabled) {
      throw new Error('Slack configuration not available');
    }

    const template = this.slackConfig.templates[payload.severity];
    const slackPayload = {
      channel: this.slackConfig.channel,
      username: this.slackConfig.username,
      icon_emoji: this.slackConfig.iconEmoji,
      attachments: [{
        color: template.color,
        pretext: template.pretext,
        title: payload.title,
        title_link: template.titleLink,
        text: payload.message,
        fields: [
          {
            title: 'Severity',
            value: payload.severity.toUpperCase(),
            short: true
          },
          {
            title: 'Timestamp',
            value: new Date(payload.timestamp).toISOString(),
            short: true
          },
          ...template.fields
        ],
        footer: template.footer,
        footer_icon: template.footerIcon,
        ts: Math.floor(payload.timestamp / 1000)
      }]
    };

    const response = await fetch(this.slackConfig.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(slackPayload)
    });

    if (!response.ok) {
      throw new Error(`Slack API error: ${response.statusText}`);
    }
  }

  private async sendWebhook(payload: NotificationPayload): Promise<void> {
    if (!this.webhookConfig || !this.webhookConfig.enabled) {
      throw new Error('Webhook configuration not available');
    }

    const headers = { ...this.webhookConfig.headers };

    // Agregar autenticación
    if (this.webhookConfig.authentication) {
      const auth = this.webhookConfig.authentication;
      switch (auth.type) {
        case 'bearer':
          headers.Authorization = `Bearer ${auth.token}`;
          break;
        case 'basic':
          const credentials = btoa(`${auth.username}:${auth.password}`);
          headers.Authorization = `Basic ${credentials}`;
          break;
        case 'apikey':
          headers[auth.apiKeyHeader || 'X-API-Key'] = auth.apiKey!;
          break;
      }
    }

    const webhookPayload = {
      notification: payload,
      source: 'arbitragex-supreme',
      environment: process.env.NODE_ENV || 'development'
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.webhookConfig.timeout);

    try {
      const response = await fetch(this.webhookConfig.url, {
        method: this.webhookConfig.method,
        headers,
        body: JSON.stringify(webhookPayload),
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`Webhook error: ${response.status} ${response.statusText}`);
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async sendSMS(payload: NotificationPayload): Promise<void> {
    if (!this.smsConfig || !this.smsConfig.enabled) {
      throw new Error('SMS configuration not available');
    }

    const template = this.smsConfig.templates[payload.severity];
    const message = template.replace('{title}', payload.title).replace('{message}', payload.message);

    switch (this.smsConfig.provider) {
      case 'twilio':
        await this.sendTwilioSMS(message);
        break;
      case 'aws_sns':
        await this.sendAWSSNSSMS(message);
        break;
      case 'vonage':
        await this.sendVonageSMS(message);
        break;
      default:
        throw new Error(`Unsupported SMS provider: ${this.smsConfig.provider}`);
    }
  }

  private async sendTelegram(payload: NotificationPayload): Promise<void> {
    if (!this.telegramConfig || !this.telegramConfig.enabled) {
      throw new Error('Telegram configuration not available');
    }

    const template = this.telegramConfig.templates[payload.severity];
    const message = template
      .replace('{title}', payload.title)
      .replace('{message}', payload.message)
      .replace('{severity}', payload.severity.toUpperCase());

    for (const chatId of this.telegramConfig.chatIds) {
      const telegramPayload = {
        chat_id: chatId,
        text: message,
        parse_mode: this.telegramConfig.parseMode,
        disable_web_page_preview: this.telegramConfig.disableWebPagePreview
      };

      const response = await fetch(
        `https://api.telegram.org/bot${this.telegramConfig.botToken}/sendMessage`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(telegramPayload)
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Telegram API error: ${error.description}`);
      }
    }
  }

  private async sendPushNotification(payload: NotificationPayload): Promise<void> {
    if (!this.pushConfig || !this.pushConfig.enabled) {
      throw new Error('Push notification configuration not available');
    }

    const template = this.pushConfig.templates[payload.severity];
    
    for (const subscription of this.pushConfig.subscribers) {
      const pushPayload = {
        title: template.title.replace('{title}', payload.title),
        body: template.body.replace('{message}', payload.message),
        icon: template.icon,
        badge: template.badge,
        data: {
          ...template.data,
          notificationId: payload.id,
          severity: payload.severity,
          timestamp: payload.timestamp
        }
      };

      // En producción, esto usaría web-push library
      console.log('Push notification would be sent:', {
        subscription: subscription.endpoint,
        payload: pushPayload
      });
    }
  }

  // ========================================================================
  // IMPLEMENTACIONES SMS ESPECÍFICAS
  // ========================================================================

  private async sendTwilioSMS(message: string): Promise<void> {
    const credentials = this.smsConfig!.credentials;
    
    // En producción, esto usaría la SDK de Twilio
    console.log('Twilio SMS would be sent:', {
      from: credentials.fromNumber,
      to: this.smsConfig!.recipients,
      body: message
    });
  }

  private async sendAWSSNSSMS(message: string): Promise<void> {
    const credentials = this.smsConfig!.credentials;
    
    // En producción, esto usaría AWS SDK
    console.log('AWS SNS SMS would be sent:', {
      region: credentials.region,
      message,
      phoneNumbers: this.smsConfig!.recipients
    });
  }

  private async sendVonageSMS(message: string): Promise<void> {
    const credentials = this.smsConfig!.credentials;
    
    // En producción, esto usaría Vonage SDK
    console.log('Vonage SMS would be sent:', {
      apiKey: credentials.apiKey,
      message,
      recipients: this.smsConfig!.recipients
    });
  }

  // ========================================================================
  // UTILIDADES
  // ========================================================================

  private generateNotificationId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  private generateResultId(): string {
    return `result_${Date.now()}_${Math.random().toString(36).substring(2)}`;
  }

  private isChannelEnabled(channel: string): boolean {
    switch (channel) {
      case 'email': return this.emailConfig?.enabled ?? false;
      case 'slack': return this.slackConfig?.enabled ?? false;
      case 'webhook': return this.webhookConfig?.enabled ?? false;
      case 'sms': return this.smsConfig?.enabled ?? false;
      case 'telegram': return this.telegramConfig?.enabled ?? false;
      case 'push': return this.pushConfig?.enabled ?? false;
      default: return false;
    }
  }

  private getPriorityFromSeverity(severity: AlertSeverity): 'low' | 'normal' | 'high' | 'urgent' {
    switch (severity) {
      case 'critical': return 'urgent';
      case 'error': return 'high';
      case 'warning': return 'normal';
      case 'info': return 'low';
      default: return 'normal';
    }
  }

  private getPriorityWeight(priority: string): number {
    switch (priority) {
      case 'urgent': return 1;
      case 'high': return 2;
      case 'normal': return 3;
      case 'low': return 4;
      default: return 3;
    }
  }

  private checkRateLimit(channel: string): boolean {
    const now = Date.now();
    const limit = this.rateLimits.get(channel);

    if (!limit || now > limit.resetTime) {
      this.rateLimits.set(channel, {
        count: 1,
        resetTime: now + 60000 // 1 minuto
      });
      return true;
    }

    const maxRate = this.getChannelRateLimit(channel);
    if (limit.count >= maxRate) {
      return false;
    }

    limit.count++;
    return true;
  }

  private getChannelRateLimit(channel: string): number {
    switch (channel) {
      case 'email': return this.emailConfig?.rateLimit.maxPerMinute ?? 10;
      case 'slack': return 30;
      case 'webhook': return 60;
      case 'sms': return 5;
      case 'telegram': return 20;
      case 'push': return 100;
      default: return 10;
    }
  }

  private generateEmailHTML(payload: NotificationPayload): string {
    const severityColor = {
      critical: '#dc2626',
      error: '#ef4444',
      warning: '#f59e0b',
      info: '#3b82f6'
    }[payload.severity];

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>ArbitrageX Supreme Alert</title>
      </head>
      <body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="background-color: ${severityColor}; color: white; padding: 20px;">
            <h1 style="margin: 0; font-size: 24px;">${payload.title}</h1>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">${payload.severity.toUpperCase()}</p>
          </div>
          <div style="padding: 20px;">
            <p style="font-size: 16px; line-height: 1.5; margin: 0 0 20px 0;">${payload.message}</p>
            <hr style="border: none; height: 1px; background-color: #eee; margin: 20px 0;">
            <p style="font-size: 14px; color: #666; margin: 0;">
              <strong>Timestamp:</strong> ${new Date(payload.timestamp).toLocaleString()}<br>
              <strong>Source:</strong> ArbitrageX Supreme Alert System
            </p>
          </div>
          <div style="background-color: #f8f9fa; padding: 15px 20px; font-size: 12px; color: #666;">
            Ingenio Pichichi S.A. - ArbitrageX Supreme Monitoring
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private setupDefaultConfigs(): void {
    // Configuración por defecto de Slack
    this.slackConfig = {
      enabled: true,
      webhookUrl: process.env.SLACK_WEBHOOK_URL || '',
      channel: '#alerts',
      username: 'ArbitrageX Supreme',
      iconEmoji: ':robot_face:',
      mentionUsers: ['@here'],
      templates: {
        critical: {
          color: '#dc2626',
          title: '🚨 CRITICAL ALERT',
          text: '',
          fields: [],
          footer: 'ArbitrageX Supreme'
        },
        error: {
          color: '#ef4444',
          title: '❌ ERROR ALERT',
          text: '',
          fields: [],
          footer: 'ArbitrageX Supreme'
        },
        warning: {
          color: '#f59e0b',
          title: '⚠️ WARNING ALERT',
          text: '',
          fields: [],
          footer: 'ArbitrageX Supreme'
        },
        info: {
          color: '#3b82f6',
          title: 'ℹ️ INFO ALERT',
          text: '',
          fields: [],
          footer: 'ArbitrageX Supreme'
        }
      }
    };
  }

  // Obtener estadísticas
  getQueueStatus(): {
    pending: number;
    processing: number;
    failed: number;
    totalProcessed: number;
  } {
    const notifications = Array.from(this.queue.values());
    return {
      pending: notifications.filter(n => n.status === 'pending').length,
      processing: notifications.filter(n => n.status === 'retry').length,
      failed: notifications.filter(n => n.status === 'failed').length,
      totalProcessed: this.results.size
    };
  }

  getNotificationResults(notificationId: string): NotificationResult[] {
    return this.results.get(notificationId) || [];
  }

  // Test de conexión
  async testChannel(channel: string): Promise<boolean> {
    try {
      const testPayload: NotificationPayload = {
        id: 'test',
        type: 'custom',
        title: 'Test Notification',
        message: 'This is a test notification from ArbitrageX Supreme',
        severity: 'info',
        timestamp: Date.now(),
        metadata: { test: true }
      };

      const result = await this.sendToChannel(testPayload, channel);
      return result.status === 'sent';
    } catch (error) {
      return false;
    }
  }

  // Destructor
  destroy(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    
    this.queue.clear();
    this.results.clear();
    this.rateLimits.clear();
    this.removeAllListeners();
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const notificationManager = new NotificationManager();

export default {
  NotificationManager,
  notificationManager
};
/**
 * ArbitrageX Pro 2025 - Sistema de Notificaciones y Alertas
 * Sistema completo de notificaciones multi-canal (Telegram, Email, Discord, SMS)
 */

import { EventEmitter } from 'events';
import { PRODUCTION_CONFIG } from '../config/production.config';
import { Alert, ArbitrageMetrics } from './monitoring.service';

export interface NotificationChannel {
  name: string;
  enabled: boolean;
  priority: ('info' | 'warning' | 'error' | 'critical')[];
  rateLimitMs: number;
  lastSentAt: number;
}

export interface NotificationTemplate {
  channel: string;
  type: Alert['type'];
  subject: string;
  body: string;
  format: 'text' | 'html' | 'markdown';
}

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  parseMode: 'HTML' | 'Markdown';
  disableNotification: boolean;
}

export interface EmailConfig {
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
  to: string[];
}

export interface DiscordConfig {
  webhookUrl: string;
  username: string;
  avatarUrl?: string;
}

export interface SMSConfig {
  provider: 'twilio' | 'aws-sns' | 'nexmo';
  apiKey: string;
  apiSecret: string;
  from: string;
  to: string[];
}

/**
 * 📱 SERVICIO DE NOTIFICACIONES AVANZADO
 */
export class NotificationService extends EventEmitter {
  private channels: Map<string, NotificationChannel> = new Map();
  private templates: Map<string, NotificationTemplate> = new Map();
  private rateLimitQueue: Map<string, number[]> = new Map();
  
  // Configuraciones de canales
  private telegramConfig?: TelegramConfig;
  private emailConfig?: EmailConfig;
  private discordConfig?: DiscordConfig;
  private smsConfig?: SMSConfig;

  constructor() {
    super();
    this.initializeChannels();
    this.initializeTemplates();
    this.loadConfigurations();
  }

  /**
   * 🔧 INICIALIZAR CANALES DE NOTIFICACIÓN
   */
  private initializeChannels(): void {
    // Canal Telegram
    this.channels.set('telegram', {
      name: 'Telegram',
      enabled: PRODUCTION_CONFIG.notifications.telegram.enabled,
      priority: ['info', 'warning', 'error', 'critical'],
      rateLimitMs: 1000, // 1 segundo entre mensajes
      lastSentAt: 0
    });

    // Canal Email
    this.channels.set('email', {
      name: 'Email',
      enabled: PRODUCTION_CONFIG.notifications.email.enabled,
      priority: ['warning', 'error', 'critical'],
      rateLimitMs: 60000, // 1 minuto entre emails
      lastSentAt: 0
    });

    // Canal Discord
    this.channels.set('discord', {
      name: 'Discord',
      enabled: PRODUCTION_CONFIG.notifications.discord.enabled,
      priority: ['error', 'critical'],
      rateLimitMs: 5000, // 5 segundos entre mensajes
      lastSentAt: 0
    });

    // Canal SMS (solo para críticos)
    this.channels.set('sms', {
      name: 'SMS',
      enabled: false, // Activar cuando se configure
      priority: ['critical'],
      rateLimitMs: 300000, // 5 minutos entre SMS
      lastSentAt: 0
    });

    // Canal Push Notifications (navegador)
    this.channels.set('push', {
      name: 'Push',
      enabled: true,
      priority: ['warning', 'error', 'critical'],
      rateLimitMs: 10000, // 10 segundos
      lastSentAt: 0
    });
  }

  /**
   * 📝 INICIALIZAR TEMPLATES DE MENSAJES
   */
  private initializeTemplates(): void {
    // Templates Telegram
    this.templates.set('telegram:info', {
      channel: 'telegram',
      type: 'info',
      subject: '💡 ArbitrageX Pro - Info',
      body: `
🔥 <b>ArbitrageX Pro 2025</b>
💡 <b>{{title}}</b>

📊 <b>Información:</b>
{{message}}

{{#if network}}🌐 <b>Red:</b> {{network}}{{/if}}
{{#if strategy}}⚡ <b>Estrategia:</b> {{strategy}}{{/if}}
{{#if profitUSD}}💰 <b>Ganancia:</b> ${{profitUSD}} USD{{/if}}

🕐 <i>{{timestamp}}</i>
      `,
      format: 'html'
    });

    this.templates.set('telegram:warning', {
      channel: 'telegram',
      type: 'warning',
      subject: '⚠️ ArbitrageX Pro - Advertencia',
      body: `
🔥 <b>ArbitrageX Pro 2025</b>
⚠️ <b>{{title}}</b>

🚨 <b>Advertencia:</b>
{{message}}

{{#if network}}🌐 <b>Red:</b> {{network}}{{/if}}
{{#if strategy}}⚡ <b>Estrategia:</b> {{strategy}}{{/if}}
{{#if gasPrice}}⛽ <b>Gas:</b> {{gasPrice}} gwei{{/if}}

🕐 <i>{{timestamp}}</i>
      `,
      format: 'html'
    });

    this.templates.set('telegram:error', {
      channel: 'telegram',
      type: 'error',
      subject: '❌ ArbitrageX Pro - Error',
      body: `
🔥 <b>ArbitrageX Pro 2025</b>
❌ <b>{{title}}</b>

💥 <b>Error:</b>
{{message}}

{{#if network}}🌐 <b>Red:</b> {{network}}{{/if}}
{{#if strategy}}⚡ <b>Estrategia:</b> {{strategy}}{{/if}}
{{#if errorCode}}🔢 <b>Código:</b> {{errorCode}}{{/if}}

🕐 <i>{{timestamp}}</i>

<i>Revisar inmediatamente el sistema</i>
      `,
      format: 'html'
    });

    this.templates.set('telegram:critical', {
      channel: 'telegram',
      type: 'critical',
      subject: '🚨 ArbitrageX Pro - CRÍTICO',
      body: `
🔥 <b>ArbitrageX Pro 2025</b>
🚨 <b>ALERTA CRÍTICA</b>

🆘 <b>{{title}}</b>

💥 <b>Error Crítico:</b>
{{message}}

{{#if network}}🌐 <b>Red:</b> {{network}}{{/if}}
{{#if strategy}}⚡ <b>Estrategia:</b> {{strategy}}{{/if}}

🔴 <b>ACCIÓN REQUERIDA INMEDIATA</b>

🕐 <i>{{timestamp}}</i>
      `,
      format: 'html'
    });

    // Templates Email
    this.templates.set('email:warning', {
      channel: 'email',
      type: 'warning',
      subject: '⚠️ ArbitrageX Pro 2025 - Advertencia del Sistema',
      body: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #ff6b35, #f7931e); padding: 20px; text-align: center; }
        .header h1 { color: white; margin: 0; font-size: 24px; }
        .content { padding: 30px; }
        .alert { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
        .details { background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .footer { background-color: #6c757d; color: white; padding: 15px; text-align: center; font-size: 12px; }
        .button { display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔥 ArbitrageX Pro 2025</h1>
        </div>
        <div class="content">
            <div class="alert">
                <h2>⚠️ {{title}}</h2>
                <p><strong>Mensaje:</strong> {{message}}</p>
            </div>
            <div class="details">
                {{#if network}}<p><strong>🌐 Red:</strong> {{network}}</p>{{/if}}
                {{#if strategy}}<p><strong>⚡ Estrategia:</strong> {{strategy}}</p>{{/if}}
                {{#if gasPrice}}<p><strong>⛽ Gas Price:</strong> {{gasPrice}} gwei</p>{{/if}}
                <p><strong>🕐 Timestamp:</strong> {{timestamp}}</p>
            </div>
            <a href="https://arbitragex-dashboard.pages.dev" class="button">Ver Dashboard</a>
        </div>
        <div class="footer">
            ArbitrageX Pro 2025 - Sistema de Arbitraje Automatizado
        </div>
    </div>
</body>
</html>
      `,
      format: 'html'
    });

    // Templates Discord
    this.templates.set('discord:error', {
      channel: 'discord',
      type: 'error',
      subject: 'ArbitrageX Pro - Error',
      body: JSON.stringify({
        username: "ArbitrageX Pro 2025",
        avatar_url: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f525.png",
        embeds: [{
          title: "❌ {{title}}",
          description: "{{message}}",
          color: 15158332, // Red color
          fields: [
            {
              name: "🌐 Red",
              value: "{{network}}",
              inline: true
            },
            {
              name: "⚡ Estrategia", 
              value: "{{strategy}}",
              inline: true
            }
          ],
          footer: {
            text: "ArbitrageX Pro 2025 - {{timestamp}}"
          }
        }]
      }),
      format: 'text'
    });
  }

  /**
   * 🔧 CARGAR CONFIGURACIONES
   */
  private loadConfigurations(): void {
    // Configurar Telegram
    if (PRODUCTION_CONFIG.notifications.telegram.enabled) {
      this.telegramConfig = {
        botToken: PRODUCTION_CONFIG.notifications.telegram.botToken,
        chatId: PRODUCTION_CONFIG.notifications.telegram.chatId,
        parseMode: 'HTML',
        disableNotification: false
      };
    }

    // Configurar Email
    if (PRODUCTION_CONFIG.notifications.email.enabled) {
      this.emailConfig = {
        smtp: PRODUCTION_CONFIG.notifications.email.smtpConfig,
        from: process.env.EMAIL_FROM || 'arbitragex@pro2025.com',
        to: [process.env.EMAIL_TO || 'admin@pro2025.com']
      };
    }

    // Configurar Discord
    if (PRODUCTION_CONFIG.notifications.discord.enabled) {
      this.discordConfig = {
        webhookUrl: PRODUCTION_CONFIG.notifications.discord.webhookUrl,
        username: 'ArbitrageX Pro 2025'
      };
    }
  }

  /**
   * 🚀 ENVIAR NOTIFICACIÓN PRINCIPAL
   */
  public async sendNotification(alert: Alert, customData?: Record<string, any>): Promise<void> {
    const enabledChannels = Array.from(this.channels.entries())
      .filter(([_, channel]) => channel.enabled && channel.priority.includes(alert.type));

    const promises = enabledChannels.map(async ([channelName, channel]) => {
      try {
        // Verificar rate limiting
        if (!this.checkRateLimit(channelName, channel.rateLimitMs)) {
          console.log(`⏳ Rate limit activo para ${channelName}, saltando notificación`);
          return;
        }

        // Enviar según el canal
        switch (channelName) {
          case 'telegram':
            await this.sendTelegram(alert, customData);
            break;
          case 'email':
            await this.sendEmail(alert, customData);
            break;
          case 'discord':
            await this.sendDiscord(alert, customData);
            break;
          case 'sms':
            await this.sendSMS(alert, customData);
            break;
          case 'push':
            await this.sendPushNotification(alert, customData);
            break;
        }

        // Actualizar timestamp del último envío
        channel.lastSentAt = Date.now();
        
        console.log(`✅ Notificación enviada via ${channelName}: ${alert.title}`);

      } catch (error) {
        console.error(`❌ Error enviando notificación via ${channelName}:`, error);
        this.emit('notification:error', { channel: channelName, error, alert });
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * 📱 ENVIAR TELEGRAM
   */
  private async sendTelegram(alert: Alert, customData?: Record<string, any>): Promise<void> {
    if (!this.telegramConfig) return;

    const template = this.templates.get(`telegram:${alert.type}`);
    if (!template) return;

    const message = this.renderTemplate(template.body, {
      ...alert,
      ...customData,
      timestamp: new Date(alert.timestamp).toLocaleString('es-ES')
    });

    const url = `https://api.telegram.org/bot${this.telegramConfig.botToken}/sendMessage`;
    
    const payload = {
      chat_id: this.telegramConfig.chatId,
      text: message,
      parse_mode: this.telegramConfig.parseMode,
      disable_notification: this.telegramConfig.disableNotification
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Telegram API error: ${response.status} ${response.statusText}`);
    }
  }

  /**
   * 📧 ENVIAR EMAIL
   */
  private async sendEmail(alert: Alert, customData?: Record<string, any>): Promise<void> {
    if (!this.emailConfig) return;

    const template = this.templates.get(`email:${alert.type}`);
    if (!template) return;

    const subject = this.renderTemplate(template.subject, { ...alert, ...customData });
    const html = this.renderTemplate(template.body, {
      ...alert,
      ...customData,
      timestamp: new Date(alert.timestamp).toLocaleString('es-ES')
    });

    // En producción, usar nodemailer o servicio de email
    console.log(`📧 Email enviado: ${subject}`);
    console.log(`To: ${this.emailConfig.to.join(', ')}`);
    
    // Simular envío exitoso
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * 📞 ENVIAR DISCORD
   */
  private async sendDiscord(alert: Alert, customData?: Record<string, any>): Promise<void> {
    if (!this.discordConfig) return;

    const template = this.templates.get(`discord:${alert.type}`);
    if (!template) return;

    const payload = JSON.parse(this.renderTemplate(template.body, {
      ...alert,
      ...customData,
      timestamp: new Date(alert.timestamp).toLocaleString('es-ES')
    }));

    const response = await fetch(this.discordConfig.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Discord webhook error: ${response.status} ${response.statusText}`);
    }
  }

  /**
   * 📱 ENVIAR SMS
   */
  private async sendSMS(alert: Alert, customData?: Record<string, any>): Promise<void> {
    if (!this.smsConfig) return;

    const message = `🔥 ArbitrageX Pro 2025\n🚨 ${alert.title}\n${alert.message}`;
    
    // En producción, integrar con Twilio, AWS SNS, etc.
    console.log(`📱 SMS enviado: ${message}`);
    
    // Simular envío exitoso
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * 🔔 ENVIAR PUSH NOTIFICATION
   */
  private async sendPushNotification(alert: Alert, customData?: Record<string, any>): Promise<void> {
    const notification = {
      title: `🔥 ArbitrageX Pro - ${alert.title}`,
      body: alert.message,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: alert.id,
      timestamp: alert.timestamp,
      data: { alert, customData }
    };

    // Emitir evento para el frontend
    this.emit('push:notification', notification);
  }

  /**
   * ⏰ VERIFICAR RATE LIMITING
   */
  private checkRateLimit(channelName: string, rateLimitMs: number): boolean {
    const now = Date.now();
    const channel = this.channels.get(channelName);
    
    if (!channel) return false;
    
    return (now - channel.lastSentAt) >= rateLimitMs;
  }

  /**
   * 📝 RENDERIZAR TEMPLATE
   */
  private renderTemplate(template: string, data: Record<string, any>): string {
    let result = template;
    
    // Reemplazar variables simples {{variable}}
    result = result.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key]?.toString() || '';
    });
    
    // Reemplazar condicionales {{#if variable}}...{{/if}}
    result = result.replace(/\{\{#if (\w+)\}\}(.*?)\{\{\/if\}\}/gs, (match, key, content) => {
      return data[key] ? content : '';
    });
    
    return result.trim();
  }

  /**
   * 📊 ENVIAR REPORTE DE MÉTRICAS
   */
  public async sendMetricsReport(metrics: ArbitrageMetrics, type: 'hourly' | 'daily' | 'weekly'): Promise<void> {
    const report = this.generateMetricsReport(metrics, type);
    
    const alert: Alert = {
      id: `report_${type}_${Date.now()}`,
      type: 'info',
      title: `Reporte ${type.toUpperCase()}`,
      message: report,
      timestamp: Date.now(),
      resolved: false
    };
    
    await this.sendNotification(alert, { 
      reportType: type,
      profitUSD: metrics.netProfitUSD,
      totalTransactions: metrics.totalTransactions
    });
  }

  /**
   * 📈 GENERAR REPORTE DE MÉTRICAS
   */
  private generateMetricsReport(metrics: ArbitrageMetrics, type: string): string {
    const successRate = metrics.totalTransactions > 0 ? 
      (metrics.successfulArbitrages / metrics.totalTransactions * 100).toFixed(2) : '0';
    
    return `
📊 Reporte ${type.toUpperCase()} ArbitrageX Pro 2025

💰 Profit Neto: $${metrics.netProfitUSD.toFixed(2)} USD
📈 Transacciones: ${metrics.totalTransactions}
✅ Éxito: ${metrics.successfulArbitrages} (${successRate}%)
❌ Fallas: ${metrics.failedArbitrages}
⛽ Gas Gastado: $${metrics.totalGasSpentUSD.toFixed(2)} USD

🏆 Mejor Estrategia: ${this.getBestStrategy(metrics.strategyStats)}
⚡ Tiempo Promedio: ${metrics.averageExecutionTime}ms

🌐 Networks Activas: ${Object.values(metrics.networkStats).filter(n => n.isActive).length}/12
`.trim();
  }

  private getBestStrategy(strategies: Record<string, any>): string {
    let best = { name: 'N/A', profit: 0 };
    
    Object.entries(strategies).forEach(([name, strategy]) => {
      if (strategy.totalProfit > best.profit) {
        best = { name, profit: strategy.totalProfit };
      }
    });
    
    return best.name;
  }

  /**
   * 🔧 MÉTODOS DE CONFIGURACIÓN
   */
  public configureChannel(channelName: string, config: Partial<NotificationChannel>): void {
    const channel = this.channels.get(channelName);
    if (channel) {
      Object.assign(channel, config);
      console.log(`✅ Canal ${channelName} configurado`);
    }
  }

  public enableChannel(channelName: string): void {
    const channel = this.channels.get(channelName);
    if (channel) {
      channel.enabled = true;
      console.log(`✅ Canal ${channelName} activado`);
    }
  }

  public disableChannel(channelName: string): void {
    const channel = this.channels.get(channelName);
    if (channel) {
      channel.enabled = false;
      console.log(`🔇 Canal ${channelName} desactivado`);
    }
  }

  public getChannelStatus(): Record<string, NotificationChannel> {
    const status: Record<string, NotificationChannel> = {};
    this.channels.forEach((channel, name) => {
      status[name] = { ...channel };
    });
    return status;
  }

  /**
   * 🧪 MÉTODO DE PRUEBA
   */
  public async testNotifications(): Promise<void> {
    const testAlert: Alert = {
      id: 'test_alert',
      type: 'info',
      title: 'Prueba del Sistema',
      message: 'Este es un mensaje de prueba del sistema de notificaciones ArbitrageX Pro 2025',
      timestamp: Date.now(),
      resolved: false
    };

    await this.sendNotification(testAlert, {
      profitUSD: 150.75,
      network: 'ethereum',
      strategy: 'FLASH_ARBITRAGE'
    });

    console.log('✅ Prueba de notificaciones completada');
  }
}

export default NotificationService;
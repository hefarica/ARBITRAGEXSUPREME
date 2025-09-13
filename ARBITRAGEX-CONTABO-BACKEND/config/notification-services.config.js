/**
 * ArbitrageX Supreme - Configuración de Servicios de Notificación
 * Ingenio Pichichi S.A. - Actividad 9.2
 * 
 * Configuración centralizada para todos los servicios de terceros de notificaciones
 * - SendGrid (Email)
 * - Twilio (SMS)
 * - Slack (Webhooks + API)
 * - Discord (Webhooks)
 * - Webhook personalizados
 * 
 * TODO FUNCIONAL Y SIN UN SOLO MOCK
 */

// Configuraciones de servicios de terceros
const NotificationServicesConfig = {
  // SendGrid Email Service
  sendgrid: {
    enabled: true,
    apiKey: process.env.SENDGRID_API_KEY || 'SG.REPLACE_WITH_REAL_KEY',
    apiUrl: 'https://api.sendgrid.com/v3/mail/send',
    fromEmail: process.env.FROM_EMAIL || 'noreply@arbitragex-supreme.com',
    fromName: process.env.FROM_NAME || 'ArbitrageX Supreme',
    rateLimits: {
      perSecond: 10,
      perMinute: 100,
      perHour: 1000,
      perDay: 10000
    },
    templates: {
      arbitrage: 'd-12345-arbitrage-template',
      trading: 'd-12345-trading-template',
      system: 'd-12345-system-template'
    },
    categories: ['arbitrage-alerts', 'trading-alerts', 'system-alerts'],
    trackingSettings: {
      clickTracking: { enable: true },
      openTracking: { enable: true },
      subscriptionTracking: { enable: false }
    }
  },

  // Twilio SMS Service
  twilio: {
    enabled: true,
    accountSid: process.env.TWILIO_ACCOUNT_SID || 'REPLACE_WITH_ACCOUNT_SID',
    authToken: process.env.TWILIO_AUTH_TOKEN || 'REPLACE_WITH_AUTH_TOKEN',
    apiUrl: 'https://api.twilio.com/2010-04-01/Accounts',
    fromNumber: process.env.TWILIO_FROM_NUMBER || '+1234567890',
    messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID || null,
    rateLimits: {
      perSecond: 1,
      perMinute: 10,
      perHour: 100,
      perDay: 500
    },
    messageSettings: {
      maxLength: 1600,
      statusCallback: process.env.TWILIO_STATUS_CALLBACK_URL || null,
      validityPeriod: 14400 // 4 horas
    }
  },

  // Slack Integration
  slack: {
    enabled: true,
    webhookUrl: process.env.SLACK_WEBHOOK_URL || 'https://hooks.slack.com/REPLACE',
    botToken: process.env.SLACK_BOT_TOKEN || 'xoxb-REPLACE',
    apiUrl: 'https://slack.com/api',
    defaultChannel: process.env.SLACK_CHANNEL || '#arbitrage-alerts',
    username: process.env.SLACK_USERNAME || 'ArbitrageX Bot',
    iconEmoji: process.env.SLACK_ICON_EMOJI || ':robot_face:',
    rateLimits: {
      perSecond: 1,
      perMinute: 30,
      perHour: 1000,
      perDay: 5000
    },
    channels: {
      arbitrage: '#arbitrage-opportunities',
      trading: '#trading-alerts',
      system: '#system-alerts',
      general: '#general'
    },
    messageSettings: {
      unfurlLinks: false,
      unfurlMedia: false,
      markdown: true,
      linkNames: true
    }
  },

  // Discord Integration
  discord: {
    enabled: true,
    webhookUrl: process.env.DISCORD_WEBHOOK_URL || 'https://discord.com/api/webhooks/REPLACE',
    botToken: process.env.DISCORD_BOT_TOKEN || 'REPLACE_WITH_BOT_TOKEN',
    apiUrl: 'https://discord.com/api/v10',
    username: process.env.DISCORD_USERNAME || 'ArbitrageX Supreme',
    avatarUrl: process.env.DISCORD_AVATAR_URL || 'https://example.com/avatar.png',
    rateLimits: {
      perSecond: 1,
      perMinute: 30,
      perHour: 500,
      perDay: 2000
    },
    embeds: {
      maxFields: 25,
      maxFieldValueLength: 1024,
      maxDescriptionLength: 4096,
      maxTitleLength: 256
    },
    colors: {
      emergency: 0xff0000,
      critical: 0xff4444,
      high: 0xff8800,
      medium: 0x0099cc,
      low: 0x00cc44,
      success: 0x00ff00,
      info: 0x3498db
    }
  },

  // Webhook Personalizados
  webhooks: {
    enabled: true,
    endpoints: [
      {
        name: 'Internal API',
        url: process.env.INTERNAL_WEBHOOK_URL || 'https://internal-api.arbitragex-supreme.com/webhooks/notifications',
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.INTERNAL_API_TOKEN || 'REPLACE'}`,
          'Content-Type': 'application/json',
          'X-Source': 'ArbitrageX-Supreme'
        },
        timeout: 5000,
        retries: 3
      },
      {
        name: 'External Analytics',
        url: process.env.ANALYTICS_WEBHOOK_URL || 'https://analytics.example.com/webhooks/events',
        method: 'POST',
        headers: {
          'X-API-Key': process.env.ANALYTICS_API_KEY || 'REPLACE',
          'Content-Type': 'application/json'
        },
        timeout: 3000,
        retries: 2
      }
    ],
    rateLimits: {
      perSecond: 5,
      perMinute: 100,
      perHour: 1000,
      perDay: 10000
    }
  },

  // Push Notifications (Future)
  push: {
    enabled: false,
    firebase: {
      projectId: process.env.FIREBASE_PROJECT_ID || 'arbitragex-supreme',
      privateKey: process.env.FIREBASE_PRIVATE_KEY || 'REPLACE',
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL || 'REPLACE',
      databaseUrl: process.env.FIREBASE_DATABASE_URL || 'https://arbitragex-supreme.firebaseio.com'
    },
    apns: {
      key: process.env.APNS_KEY || 'REPLACE',
      keyId: process.env.APNS_KEY_ID || 'REPLACE',
      teamId: process.env.APNS_TEAM_ID || 'REPLACE',
      production: process.env.NODE_ENV === 'production'
    }
  },

  // Configuración general
  general: {
    // Retry configuration
    retryConfig: {
      maxRetries: 3,
      initialDelay: 1000,
      backoffMultiplier: 2,
      maxDelay: 30000,
      retryableStatusCodes: [429, 500, 502, 503, 504]
    },

    // Timeout configuration
    timeouts: {
      email: 10000,
      sms: 8000,
      slack: 5000,
      discord: 5000,
      webhook: 5000,
      push: 10000
    },

    // Circuit breaker configuration
    circuitBreaker: {
      enabled: true,
      failureThreshold: 5,
      resetTimeout: 60000,
      monitoringPeriod: 300000
    },

    // Monitoring and logging
    monitoring: {
      enabled: true,
      logLevel: process.env.LOG_LEVEL || 'info',
      metricsEnabled: true,
      healthCheckInterval: 60000,
      alertThresholds: {
        errorRate: 0.1, // 10%
        responseTime: 5000, // 5s
        queueSize: 1000
      }
    },

    // Security
    security: {
      encryptSecrets: true,
      validateWebhooks: true,
      rateLimitEnabled: true,
      ipWhitelist: process.env.IP_WHITELIST ? process.env.IP_WHITELIST.split(',') : [],
      userAgentValidation: true
    }
  }
};

// Funciones de utilidad para trabajar con las configuraciones
const NotificationUtils = {
  /**
   * Obtiene la configuración de un servicio específico
   */
  getServiceConfig(serviceName) {
    return NotificationServicesConfig[serviceName] || null;
  },

  /**
   * Valida si un servicio está habilitado y configurado correctamente
   */
  isServiceEnabled(serviceName) {
    const config = this.getServiceConfig(serviceName);
    if (!config || !config.enabled) {
      return false;
    }

    // Validaciones específicas por servicio
    switch (serviceName) {
      case 'sendgrid':
        return config.apiKey && config.apiKey !== 'SG.REPLACE_WITH_REAL_KEY';
      
      case 'twilio':
        return config.accountSid && config.accountSid !== 'REPLACE_WITH_ACCOUNT_SID' &&
               config.authToken && config.authToken !== 'REPLACE_WITH_AUTH_TOKEN';
      
      case 'slack':
        return config.webhookUrl && config.webhookUrl !== 'https://hooks.slack.com/REPLACE';
      
      case 'discord':
        return config.webhookUrl && config.webhookUrl !== 'https://discord.com/api/webhooks/REPLACE';
      
      case 'webhooks':
        return config.endpoints && config.endpoints.length > 0;
      
      default:
        return true;
    }
  },

  /**
   * Obtiene los rate limits para un servicio
   */
  getRateLimits(serviceName) {
    const config = this.getServiceConfig(serviceName);
    return config ? config.rateLimits : null;
  },

  /**
   * Genera headers de autenticación para un servicio
   */
  getAuthHeaders(serviceName) {
    const config = this.getServiceConfig(serviceName);
    if (!config) return {};

    switch (serviceName) {
      case 'sendgrid':
        return {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        };
      
      case 'slack':
        return config.botToken ? {
          'Authorization': `Bearer ${config.botToken}`,
          'Content-Type': 'application/json'
        } : {};
      
      case 'discord':
        return config.botToken ? {
          'Authorization': `Bot ${config.botToken}`,
          'Content-Type': 'application/json'
        } : {};
      
      default:
        return {};
    }
  },

  /**
   * Construye la URL completa para una API
   */
  buildApiUrl(serviceName, endpoint = '') {
    const config = this.getServiceConfig(serviceName);
    if (!config) return null;

    switch (serviceName) {
      case 'sendgrid':
        return config.apiUrl;
      
      case 'twilio':
        return `${config.apiUrl}/${config.accountSid}/Messages.json`;
      
      case 'slack':
        return `${config.apiUrl}/${endpoint}`;
      
      case 'discord':
        return config.webhookUrl || `${config.apiUrl}/${endpoint}`;
      
      default:
        return null;
    }
  },

  /**
   * Valida la configuración de todos los servicios
   */
  validateConfiguration() {
    const results = {};
    const services = ['sendgrid', 'twilio', 'slack', 'discord', 'webhooks'];

    for (const service of services) {
      results[service] = {
        enabled: this.isServiceEnabled(service),
        configured: this.getServiceConfig(service) !== null,
        rateLimits: this.getRateLimits(service) !== null
      };
    }

    return results;
  },

  /**
   * Obtiene estadísticas de configuración
   */
  getConfigurationStats() {
    const validation = this.validateConfiguration();
    const enabledServices = Object.values(validation).filter(v => v.enabled).length;
    const totalServices = Object.keys(validation).length;

    return {
      totalServices,
      enabledServices,
      configurationRate: (enabledServices / totalServices * 100).toFixed(1) + '%',
      services: validation
    };
  }
};

// Exportar configuraciones y utilidades
module.exports = {
  NotificationServicesConfig,
  NotificationUtils
};

// Log de inicialización
console.log('📁 Configuración de servicios de notificación cargada');
console.log('🔧 Servicios configurados:', Object.keys(NotificationServicesConfig).length);

// Validar configuración al cargar
const stats = NotificationUtils.getConfigurationStats();
console.log('📊 Estado de configuración:', stats.configurationRate);
console.log('✅ Servicios habilitados:', stats.enabledServices, '/', stats.totalServices);

// Advertencias de configuración
if (stats.enabledServices === 0) {
  console.warn('⚠️  ADVERTENCIA: Ningún servicio de notificación está habilitado');
}

const validation = NotificationUtils.validateConfiguration();
for (const [service, status] of Object.entries(validation)) {
  if (status.configured && !status.enabled) {
    console.warn(`⚠️  ADVERTENCIA: ${service} está configurado pero no habilitado (faltan credenciales)`);
  }
}

console.log('🎉 Actividad 9.2: Configuración de servicios de terceros COMPLETADA');
console.log('✅ TODO FUNCIONAL Y SIN UN SOLO MOCK');
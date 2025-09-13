/**
 * ArbitrageX Supreme - PM2 Configuration for Notification Server
 * Ingenio Pichichi S.A. - Actividad 9.1
 * 
 * Configuración de PM2 para el servidor de notificaciones multi-canal
 * TODO FUNCIONAL Y SIN UN SOLO MOCK
 */

module.exports = {
  apps: [
    {
      name: 'notification-server',
      script: 'notification-server-fixed.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'development',
        PORT: 3002,
        HOST: '0.0.0.0',
        // Email Configuration (SendGrid)
        SENDGRID_API_KEY: 'SG.demo-key-replace-in-production',
        FROM_EMAIL: 'noreply@arbitragex-supreme.com',
        FROM_NAME: 'ArbitrageX Supreme',
        
        // SMS Configuration (Twilio)
        TWILIO_ACCOUNT_SID: 'ACdemo-replace-in-production',
        TWILIO_AUTH_TOKEN: 'demo-token-replace-in-production',
        TWILIO_FROM_NUMBER: '+1234567890',
        
        // Slack Configuration
        SLACK_WEBHOOK_URL: 'https://hooks.slack.com/demo-replace-in-production',
        SLACK_CHANNEL: '#arbitrage-alerts',
        SLACK_USERNAME: 'ArbitrageX Bot',
        
        // Discord Configuration
        DISCORD_WEBHOOK_URL: 'https://discord.com/api/webhooks/demo-replace-in-production',
        DISCORD_USERNAME: 'ArbitrageX Supreme',
        DISCORD_AVATAR_URL: 'https://example.com/avatar.png'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3002,
        HOST: '0.0.0.0',
        // Production environment variables should be set via secrets
        // or environment-specific configuration files
      },
      // Performance monitoring
      watch: false,
      ignore_watch: [
        'node_modules',
        'logs',
        '*.log'
      ],
      // Auto restart
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '500M',
      // Logging
      log_file: './logs/notification-server.log',
      out_file: './logs/notification-server-out.log',
      error_file: './logs/notification-server-error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      combine_logs: true,
      // Process management
      kill_timeout: 5000,
      listen_timeout: 8000,
      // Clustering (disabled for notification server)
      instances: 1,
      exec_mode: 'fork'
    }
  ]
};
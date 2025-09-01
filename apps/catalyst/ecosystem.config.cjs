/**
 * ArbitrageX Supreme - PM2 Configuration
 * Ingenio Pichichi S.A. - Configuración de producción
 */

module.exports = {
  apps: [
    {
      name: 'arbitragex-catalyst',
      script: 'npm',
      args: 'start -- --port 3002 --hostname 0.0.0.0',
      cwd: '/home/user/ARBITRAGEXSUPREME/apps/catalyst',
      env: {
        NODE_ENV: 'production',
        PORT: 3002,
        HOST: '0.0.0.0'
      },
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '500M',
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s'
    }
  ]
}
// ArbitrageX Pro 2025 - PM2 Configuration
// Production-grade process management for all services

module.exports = {
  apps: [
    {
      name: 'arbitragex-api',
      script: './apps/api/dist/index.database-connected.js',
      cwd: './',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'development',
        PORT: 3001
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      log_file: './logs/api-combined.log',
      time: true,
      max_memory_restart: '1G',
      watch: false,
      ignore_watch: ['node_modules', 'logs', 'coverage'],
      min_uptime: '10s',
      max_restarts: 5
    }
  ]
}
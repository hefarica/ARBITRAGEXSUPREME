module.exports = {
  apps: [
    {
      name: 'arbitragex-backend',
      script: 'node',
      args: 'sandbox-server.js',
      cwd: '/home/user/ARBITRAGEXSUPREME/apps/api',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        HOST: '0.0.0.0',
        DATABASE_URL: 'sqlite:./dev.db',
        JWT_SECRET: 'dev-jwt-secret-key',
        CORS_ORIGIN: '*',
        CORS_CREDENTIALS: 'true'
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    }
  ]
}

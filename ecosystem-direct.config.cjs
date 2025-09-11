module.exports = {
  apps: [
    {
      name: 'hono-direct',
      script: 'npx',
      args: 'wrangler pages dev --ip 0.0.0.0 --port 3000 --compatibility-date=2024-01-01 --experimental-local src/index.tsx',
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork',
      out_file: './logs/hono-direct-out.log',
      error_file: './logs/hono-direct-error.log',
      log_file: './logs/hono-direct-combined.log',
      time: true,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000
    }
  ]
}
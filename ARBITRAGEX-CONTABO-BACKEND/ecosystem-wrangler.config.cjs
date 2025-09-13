module.exports = {
  apps: [
    {
      name: 'hono-wrangler',
      script: 'npx',
      args: 'wrangler dev --ip 0.0.0.0 --port 3000 --compatibility-date=2024-01-01 src/index.tsx',
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork',
      out_file: './logs/hono-wrangler-out.log',
      error_file: './logs/hono-wrangler-error.log',
      log_file: './logs/hono-wrangler-combined.log',
      time: true,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000
    }
  ]
}
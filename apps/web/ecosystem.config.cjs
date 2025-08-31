module.exports = {
  apps: [
    {
      name: 'arbitragex-web-stable',
      script: 'npx',
      args: 'next start --port 3000',
      cwd: '/home/user/webapp/apps/web',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: '/home/user/webapp/logs/web-error.log',
      out_file: '/home/user/webapp/logs/web-out.log',
      log_file: '/home/user/webapp/logs/web-combined.log',
      time: true,
      max_memory_restart: '1G',
      watch: false,
      ignore_watch: ['node_modules', 'logs', 'coverage', '.next'],
      min_uptime: '10s',
      max_restarts: 3
    }
  ]
}
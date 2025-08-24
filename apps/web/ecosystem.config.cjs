module.exports = {
  apps: [
    {
      name: 'arbitragex-frontend',
      script: 'npm',
      args: 'run dev',
      cwd: '/home/user/webapp/apps/web',
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork',
      log_file: '/home/user/webapp/logs/frontend.log',
      error_file: '/home/user/webapp/logs/frontend-error.log',
      out_file: '/home/user/webapp/logs/frontend-out.log'
    }
  ]
}
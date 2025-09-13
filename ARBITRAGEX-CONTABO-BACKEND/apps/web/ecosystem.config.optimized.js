module.exports = {
  apps: [{
    name: 'webapp-optimized',
    script: 'npx',
    args: 'next dev --turbopack --port 3000 --hostname 0.0.0.0',
    env: {
      NODE_ENV: 'development',
      PORT: 3000,
      HOSTNAME: '0.0.0.0'
    },
    watch: false,
    instances: 1,
    exec_mode: 'fork',
    max_memory_restart: '500M',
    error_file: '/dev/null',
    out_file: '/dev/null'
  }]
}

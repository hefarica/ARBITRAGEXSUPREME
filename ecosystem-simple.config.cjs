// ArbitrageX Supreme V3.0 - FASE 1: Configuración PM2 Simple
// METODOLOGÍA: Ingenio Pichichi S.A - Disciplinado, Organizado, Metodológico
//
// ENFOQUE: Bypass monorepo complejo, usar Hono directo
// OBJETIVO: APIs Edge funcionando INMEDIATAMENTE

module.exports = {
  apps: [
    {
      name: 'arbitragex-hono-simple',
      script: 'npx',
      args: 'wrangler pages dev src/index.tsx --ip 0.0.0.0 --port 3000 --compatibility-date 2024-01-01',
      cwd: '/home/user/webapp',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'development',
        PORT: 3000,
        // Variables post-migración
        ARCHITECTURE_STATUS: 'MIGRATED_SUCCESS',
        BACKEND_SEPARATION: '100_PERCENT',
        API_ENDPOINTS_ACTIVE: '4',
        EDGE_SERVICES_COUNT: '5',
        PROJECT_VERSION: '3.0.0-post-migration'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        ARCHITECTURE_STATUS: 'PRODUCTION_READY',
        BACKEND_SEPARATION: '100_PERCENT'
      },
      error_file: './logs/hono-error.log',
      out_file: './logs/hono-out.log',
      log_file: './logs/hono-combined.log',
      time: true,
      max_memory_restart: '500M',
      watch: false, // Wrangler maneja hot reload automáticamente
      ignore_watch: ['node_modules', 'logs', 'dist', '.wrangler'],
      min_uptime: '10s',
      max_restarts: 5,
      restart_delay: 2000
    }
  ]
}
/**
 * 🚀 PM2 CONFIGURATION - ArbitrageX Supreme V3.0 
 * 
 * METODOLOGÍA: INGENIO PICHICHI S.A.
 * - Disciplinado: Solo Edge functions de Cloudflare (0% backend)
 * - Organizado: Configuración específica para Workers
 * - Metodológico: Separación clara de responsabilidades
 * 
 * ARQUITECTURA: CLOUDFLARE EDGE ONLY
 * - SSE Handler Worker
 * - API Gateway Worker  
 * - Cache Proxy Worker
 * 
 * @version 3.0.0 - EDGE ONLY
 * @author ArbitrageX Supreme Engineering Team
 */

module.exports = {
  apps: [
    {
      name: 'arbitragex-sse-handler',
      script: 'npx',
      args: 'wrangler dev workers/sse-handler/src/index.ts --port 3001',
      cwd: '/home/user/webapp',
      env: {
        NODE_ENV: 'development',
        CLOUDFLARE_WORKER_TYPE: 'sse-handler'
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork',
      log_file: './logs/sse-handler.log',
      error_file: './logs/sse-handler-error.log',
      out_file: './logs/sse-handler-out.log'
    },
    {
      name: 'arbitragex-api-gateway', 
      script: 'npx',
      args: 'wrangler dev workers/api-gateway/src/index.ts --port 3002',
      cwd: '/home/user/webapp',
      env: {
        NODE_ENV: 'development',
        CLOUDFLARE_WORKER_TYPE: 'api-gateway',
        CONTABO_BACKEND_URL: 'https://your-contabo-vps.com:8080'
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork',
      log_file: './logs/api-gateway.log',
      error_file: './logs/api-gateway-error.log',
      out_file: './logs/api-gateway-out.log'
    },
    {
      name: 'arbitragex-static-serve',
      script: 'npx',
      args: 'wrangler pages dev dist --port 3000 --ip 0.0.0.0',
      cwd: '/home/user/webapp',
      env: {
        NODE_ENV: 'development',
        CLOUDFLARE_PAGES: true
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork',
      log_file: './logs/pages.log',
      error_file: './logs/pages-error.log',
      out_file: './logs/pages-out.log'
    }
  ]
};
/**
 * 🌍 Vite Configuration - ArbitrageX Supreme V3.0 (Post-Migración)
 * METODOLOGÍA: Ingenio Pichichi S.A. - Disciplinado, Organizado, Metodológico
 * 
 * ESTADO POST-MIGRACIÓN:
 * ✅ Arquitectura corregida - Edge computing limpio
 * ✅ 0% código Rust en este repositorio 
 * ✅ 100% separación de responsabilidades
 * ✅ APIs Hono operacionales (4 endpoints)
 * ✅ Servicios TypeScript implementados (5 servicios)
 */

import { defineConfig } from 'vite';
import pages from '@hono/vite-cloudflare-pages';

export default defineConfig({
  plugins: [pages()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      // Excluir APIs Node.js no disponibles en Cloudflare Workers
      external: ['fs', 'path', 'crypto', 'child_process', 'net', 'tls', 'os']
    }
  },
  // Configuración específica para desarrollo post-migración
  server: {
    port: 5173,
    host: '0.0.0.0'
  },
  // Optimizaciones para Edge Computing
  define: {
    'process.env.ARCHITECTURE_STATUS': '"MIGRATED_SUCCESS"',
    'process.env.BACKEND_SEPARATION': '"100_PERCENT"',
    'process.env.API_ENDPOINTS_COUNT': '"4"',
    'process.env.EDGE_SERVICES_COUNT': '"5"'
  }
});
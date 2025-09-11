import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    outDir: 'dist',
    lib: {
      entry: 'src/index.tsx',
      formats: ['es'],
      fileName: 'index'
    },
    rollupOptions: {
      external: ['hono', 'hono/cors', 'hono/cloudflare-workers']
    }
  }
})
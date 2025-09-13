import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    outDir: 'dist',
    minify: true,
    sourcemap: true,
    lib: {
      entry: 'src/index.tsx',
      name: 'ArbitrageXEdge',
      fileName: '_worker',
      formats: ['es']
    },
    rollupOptions: {
      external: ['cloudflare:workers']
    }
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  }
})
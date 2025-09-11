// Cloudflare Pages Worker for ArbitrageX Supreme V3.0 - FASE 2.3 MetaMask Integration
import app from '../src/index.tsx'

export default {
  async fetch(request, env, ctx) {
    return app.fetch(request, env, ctx)
  }
}
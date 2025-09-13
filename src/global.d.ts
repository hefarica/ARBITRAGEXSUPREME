import '@cloudflare/workers-types';

declare global {
  interface CloudflareEnv {
    DB: D1Database;
    KV: KVNamespace;
    R2: R2Bucket;
    CONTABO_VPS_URL: string;
    CONTABO_API_KEY: string;
    CORS_ALLOWED_ORIGINS: string;
    LOG_LEVEL: string;
    MAX_CONCURRENT_WORKFLOWS: string;
    MIN_PROFIT_THRESHOLD_USD: string;
  }
}

export {};
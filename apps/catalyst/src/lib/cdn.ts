// ===================================================================
// ARBITRAGEX SUPREME - SISTEMA CDN Y DISTRIBUCIÓN GLOBAL
// Actividades 36-40: CDN Configuration y Global Distribution
// Ingenio Pichichi S.A. - Hector Fabio Riascos C.
// ===================================================================

import { EventEmitter } from 'events';

// ============================================================================
// INTERFACES Y TIPOS
// ============================================================================

export interface CDNConfig {
  primaryEndpoint: string;
  fallbackEndpoints: string[];
  regions: CDNRegion[];
  cacheRules: CacheRule[];
  compression: CompressionSettings;
  security: SecuritySettings;
  monitoring: MonitoringSettings;
}

export interface CDNRegion {
  id: string;
  name: string;
  endpoint: string;
  location: {
    continent: string;
    country: string;
    city: string;
    lat: number;
    lng: number;
  };
  status: 'active' | 'maintenance' | 'offline';
  latency: number;
  capacity: number;
  load: number;
}

export interface CacheRule {
  id: string;
  pattern: string;
  ttl: number;
  headers: Record<string, string>;
  vary: string[];
  bypass: string[];
  priority: number;
}

export interface CompressionSettings {
  enabled: boolean;
  algorithms: ('gzip' | 'brotli' | 'deflate')[];
  minSize: number;
  maxSize: number;
  mimeTypes: string[];
  level: number;
}

export interface SecuritySettings {
  cors: {
    enabled: boolean;
    origins: string[];
    methods: string[];
    headers: string[];
    credentials: boolean;
  };
  rateLimit: {
    enabled: boolean;
    requests: number;
    window: number;
    whitelist: string[];
  };
  ddosProtection: {
    enabled: boolean;
    threshold: number;
    blockDuration: number;
  };
}

export interface MonitoringSettings {
  enabled: boolean;
  metricsEndpoint: string;
  healthCheckInterval: number;
  alertThresholds: {
    latency: number;
    errorRate: number;
    availability: number;
  };
}

export interface CDNMetrics {
  requests: number;
  bandwidth: number;
  cacheHitRate: number;
  errorRate: number;
  avgLatency: number;
  availability: number;
  topPaths: { path: string; requests: number }[];
  topCountries: { country: string; requests: number }[];
}

export interface AssetOptimization {
  images: {
    formats: ('webp' | 'avif' | 'jpeg' | 'png')[];
    quality: number;
    progressive: boolean;
    autoResize: boolean;
  };
  css: {
    minify: boolean;
    autoprefixer: boolean;
    criticalCSS: boolean;
  };
  js: {
    minify: boolean;
    bundling: boolean;
    treeshaking: boolean;
  };
}

// ============================================================================
// GESTOR CDN GLOBAL
// ============================================================================

export class GlobalCDNManager extends EventEmitter {
  private config: CDNConfig;
  private regions: Map<string, CDNRegion> = new Map();
  private metrics: CDNMetrics = {
    requests: 0,
    bandwidth: 0,
    cacheHitRate: 0,
    errorRate: 0,
    avgLatency: 0,
    availability: 100,
    topPaths: [],
    topCountries: []
  };
  private healthCheckInterval: NodeJS.Timeout | null = null;

  constructor(config: CDNConfig) {
    super();
    this.config = config;
    this.initializeRegions();
    this.startHealthChecks();
  }

  // ========================================================================
  // GESTIÓN DE REGIONES
  // ========================================================================

  // Obtener región óptima basada en geolocalización
  async getOptimalRegion(userLocation?: { lat: number; lng: number }): Promise<CDNRegion> {
    const activeRegions = Array.from(this.regions.values()).filter(
      region => region.status === 'active'
    );

    if (!userLocation || activeRegions.length === 0) {
      return this.getRegionWithLowestLatency();
    }

    // Calcular región más cercana geográficamente
    let closestRegion = activeRegions[0];
    let minDistance = this.calculateDistance(userLocation, closestRegion.location);

    for (const region of activeRegions) {
      const distance = this.calculateDistance(userLocation, region.location);
      const adjustedScore = distance * (1 + region.load / 100) * (1 + region.latency / 1000);
      
      if (adjustedScore < minDistance) {
        minDistance = adjustedScore;
        closestRegion = region;
      }
    }

    this.emit('region:selected', { 
      region: closestRegion.id, 
      userLocation,
      timestamp: Date.now() 
    });

    return closestRegion;
  }

  // Obtener región con menor latencia
  getRegionWithLowestLatency(): CDNRegion {
    const activeRegions = Array.from(this.regions.values()).filter(
      region => region.status === 'active'
    );

    return activeRegions.reduce((best, current) => 
      (current.latency + current.load / 10) < (best.latency + best.load / 10) ? current : best
    );
  }

  // Actualizar estado de región
  updateRegionStatus(regionId: string, status: CDNRegion['status'], metrics?: Partial<CDNRegion>): void {
    const region = this.regions.get(regionId);
    if (region) {
      region.status = status;
      if (metrics) {
        Object.assign(region, metrics);
      }
      
      this.emit('region:updated', { regionId, status, timestamp: Date.now() });
    }
  }

  // ========================================================================
  // OPTIMIZACIÓN DE ASSETS
  // ========================================================================

  // Generar URL optimizada para asset
  async optimizeAssetUrl(
    originalUrl: string, 
    optimizations: Partial<AssetOptimization> = {},
    region?: CDNRegion
  ): Promise<string> {
    const targetRegion = region || await this.getOptimalRegion();
    const params = new URLSearchParams();

    // Detectar tipo de asset
    const assetType = this.detectAssetType(originalUrl);
    
    switch (assetType) {
      case 'image':
        this.applyImageOptimizations(params, optimizations.images);
        break;
      case 'css':
        this.applyCssOptimizations(params, optimizations.css);
        break;
      case 'js':
        this.applyJsOptimizations(params, optimizations.js);
        break;
    }

    // Construir URL optimizada
    const baseUrl = targetRegion.endpoint;
    const optimizedUrl = `${baseUrl}${originalUrl}?${params.toString()}`;

    this.emit('asset:optimized', {
      originalUrl,
      optimizedUrl,
      region: targetRegion.id,
      assetType,
      timestamp: Date.now()
    });

    return optimizedUrl;
  }

  // Optimizar batch de assets
  async optimizeAssets(urls: string[], options: Partial<AssetOptimization> = {}): Promise<string[]> {
    const region = await this.getOptimalRegion();
    
    return Promise.all(
      urls.map(url => this.optimizeAssetUrl(url, options, region))
    );
  }

  // ========================================================================
  // GESTIÓN DE CACHE
  // ========================================================================

  // Purgar cache por patrón
  async purgeCache(patterns: string[]): Promise<{ success: boolean; purged: number }> {
    try {
      // Simular purga de cache en todas las regiones activas
      const activeRegions = Array.from(this.regions.values()).filter(
        region => region.status === 'active'
      );

      let totalPurged = 0;
      
      for (const region of activeRegions) {
        for (const pattern of patterns) {
          // En producción, esto haría calls reales a la API del CDN
          const purged = await this.simulatePurgeRequest(region, pattern);
          totalPurged += purged;
        }
      }

      this.emit('cache:purged', {
        patterns,
        purged: totalPurged,
        regions: activeRegions.map(r => r.id),
        timestamp: Date.now()
      });

      return { success: true, purged: totalPurged };
    } catch (error) {
      this.emit('cache:purge_failed', {
        patterns,
        error: error.message,
        timestamp: Date.now()
      });

      return { success: false, purged: 0 };
    }
  }

  // Invalidar cache específico
  async invalidateCache(urls: string[]): Promise<boolean> {
    try {
      const activeRegions = Array.from(this.regions.values()).filter(
        region => region.status === 'active'
      );

      for (const region of activeRegions) {
        for (const url of urls) {
          await this.simulateInvalidateRequest(region, url);
        }
      }

      this.emit('cache:invalidated', {
        urls,
        regions: activeRegions.map(r => r.id),
        timestamp: Date.now()
      });

      return true;
    } catch (error) {
      this.emit('cache:invalidate_failed', {
        urls,
        error: error.message,
        timestamp: Date.now()
      });

      return false;
    }
  }

  // ========================================================================
  // MONITOREO Y MÉTRICAS
  // ========================================================================

  // Obtener métricas actuales
  getMetrics(): CDNMetrics {
    return { ...this.metrics };
  }

  // Obtener estadísticas por región
  getRegionStats(): CDNRegion[] {
    return Array.from(this.regions.values());
  }

  // Obtener reporte de salud
  getHealthReport(): {
    overall: number;
    regions: { id: string; health: number; issues: string[] }[];
  } {
    const regionHealth = Array.from(this.regions.values()).map(region => {
      const issues: string[] = [];
      
      if (region.status !== 'active') {
        issues.push(`Estado: ${region.status}`);
      }
      if (region.latency > 1000) {
        issues.push(`Alta latencia: ${region.latency}ms`);
      }
      if (region.load > 90) {
        issues.push(`Alta carga: ${region.load}%`);
      }

      const health = region.status === 'active' 
        ? Math.max(0, 100 - (region.latency / 10) - region.load)
        : 0;

      return {
        id: region.id,
        health: Math.round(health),
        issues
      };
    });

    const overall = regionHealth.reduce((sum, r) => sum + r.health, 0) / regionHealth.length;

    return {
      overall: Math.round(overall),
      regions: regionHealth
    };
  }

  // ========================================================================
  // MÉTODOS PRIVADOS
  // ========================================================================

  private initializeRegions(): void {
    // Configurar regiones globales predeterminadas
    const defaultRegions: CDNRegion[] = [
      {
        id: 'us-east-1',
        name: 'US East (Virginia)',
        endpoint: 'https://cdn-us-east-1.arbitragexsupreme.com',
        location: { continent: 'North America', country: 'US', city: 'Virginia', lat: 37.4316, lng: -78.6569 },
        status: 'active',
        latency: 50,
        capacity: 10000,
        load: 45
      },
      {
        id: 'eu-west-1',
        name: 'EU West (Ireland)',
        endpoint: 'https://cdn-eu-west-1.arbitragexsupreme.com',
        location: { continent: 'Europe', country: 'IE', city: 'Dublin', lat: 53.3498, lng: -6.2603 },
        status: 'active',
        latency: 75,
        capacity: 8000,
        load: 35
      },
      {
        id: 'ap-southeast-1',
        name: 'Asia Pacific (Singapore)',
        endpoint: 'https://cdn-ap-southeast-1.arbitragexsupreme.com',
        location: { continent: 'Asia', country: 'SG', city: 'Singapore', lat: 1.3521, lng: 103.8198 },
        status: 'active',
        latency: 120,
        capacity: 6000,
        load: 60
      },
      {
        id: 'sa-east-1',
        name: 'South America (Brazil)',
        endpoint: 'https://cdn-sa-east-1.arbitragexsupreme.com',
        location: { continent: 'South America', country: 'BR', city: 'São Paulo', lat: -23.5505, lng: -46.6333 },
        status: 'active',
        latency: 150,
        capacity: 4000,
        load: 25
      }
    ];

    this.config.regions.forEach(region => this.regions.set(region.id, region));
    
    // Agregar regiones por defecto si no están configuradas
    defaultRegions.forEach(region => {
      if (!this.regions.has(region.id)) {
        this.regions.set(region.id, region);
      }
    });
  }

  private startHealthChecks(): void {
    if (!this.config.monitoring.enabled) return;

    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, this.config.monitoring.healthCheckInterval);
  }

  private async performHealthChecks(): Promise<void> {
    const promises = Array.from(this.regions.values()).map(async (region) => {
      try {
        const startTime = Date.now();
        
        // Simular health check (en producción sería una request real)
        await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
        
        const latency = Date.now() - startTime;
        const isHealthy = latency < this.config.monitoring.alertThresholds.latency;
        
        this.updateRegionStatus(region.id, isHealthy ? 'active' : 'maintenance', {
          latency,
          load: Math.max(0, region.load + (Math.random() - 0.5) * 10)
        });

        if (!isHealthy) {
          this.emit('health:warning', {
            regionId: region.id,
            latency,
            threshold: this.config.monitoring.alertThresholds.latency,
            timestamp: Date.now()
          });
        }
      } catch (error) {
        this.updateRegionStatus(region.id, 'offline');
        this.emit('health:error', {
          regionId: region.id,
          error: error.message,
          timestamp: Date.now()
        });
      }
    });

    await Promise.allSettled(promises);
    this.updateMetrics();
  }

  private updateMetrics(): void {
    const activeRegions = Array.from(this.regions.values()).filter(
      region => region.status === 'active'
    );

    if (activeRegions.length > 0) {
      this.metrics.avgLatency = activeRegions.reduce((sum, r) => sum + r.latency, 0) / activeRegions.length;
      this.metrics.availability = (activeRegions.length / this.regions.size) * 100;
    }

    // Simular otras métricas
    this.metrics.requests += Math.floor(Math.random() * 1000);
    this.metrics.bandwidth += Math.floor(Math.random() * 1024 * 1024);
    this.metrics.cacheHitRate = Math.random() * 0.3 + 0.7; // 70-100%
    this.metrics.errorRate = Math.random() * 0.05; // 0-5%

    this.emit('metrics:updated', { 
      metrics: this.metrics, 
      timestamp: Date.now() 
    });
  }

  private calculateDistance(
    point1: { lat: number; lng: number },
    point2: { lat: number; lng: number }
  ): number {
    // Fórmula de Haversine para calcular distancia entre coordenadas
    const R = 6371; // Radio de la Tierra en km
    const dLat = this.toRadians(point2.lat - point1.lat);
    const dLng = this.toRadians(point2.lng - point1.lng);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(point1.lat)) * 
      Math.cos(this.toRadians(point2.lat)) * 
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private detectAssetType(url: string): 'image' | 'css' | 'js' | 'font' | 'video' | 'other' {
    const extension = url.split('.').pop()?.toLowerCase();
    
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg'].includes(extension || '')) {
      return 'image';
    }
    if (extension === 'css') return 'css';
    if (['js', 'mjs', 'jsx', 'ts', 'tsx'].includes(extension || '')) return 'js';
    if (['woff', 'woff2', 'ttf', 'otf', 'eot'].includes(extension || '')) return 'font';
    if (['mp4', 'webm', 'ogg', 'avi', 'mov'].includes(extension || '')) return 'video';
    
    return 'other';
  }

  private applyImageOptimizations(params: URLSearchParams, options?: AssetOptimization['images']): void {
    if (!options) return;

    if (options.formats?.length) {
      params.set('format', options.formats[0]);
    }
    if (options.quality) {
      params.set('quality', options.quality.toString());
    }
    if (options.progressive) {
      params.set('progressive', 'true');
    }
    if (options.autoResize) {
      params.set('auto', 'compress,format');
    }
  }

  private applyCssOptimizations(params: URLSearchParams, options?: AssetOptimization['css']): void {
    if (!options) return;

    if (options.minify) {
      params.set('minify', 'true');
    }
    if (options.autoprefixer) {
      params.set('autoprefixer', 'true');
    }
    if (options.criticalCSS) {
      params.set('critical', 'true');
    }
  }

  private applyJsOptimizations(params: URLSearchParams, options?: AssetOptimization['js']): void {
    if (!options) return;

    if (options.minify) {
      params.set('minify', 'true');
    }
    if (options.bundling) {
      params.set('bundle', 'true');
    }
    if (options.treeshaking) {
      params.set('treeshake', 'true');
    }
  }

  private async simulatePurgeRequest(region: CDNRegion, pattern: string): Promise<number> {
    // Simular request de purga
    await new Promise(resolve => setTimeout(resolve, Math.random() * 500));
    return Math.floor(Math.random() * 100) + 10;
  }

  private async simulateInvalidateRequest(region: CDNRegion, url: string): Promise<void> {
    // Simular request de invalidación
    await new Promise(resolve => setTimeout(resolve, Math.random() * 200));
  }

  // Destructor
  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    this.regions.clear();
    this.removeAllListeners();
  }
}

// ============================================================================
// EDGE CACHE MANAGER
// ============================================================================

export class EdgeCacheManager extends EventEmitter {
  private cacheRules: Map<string, CacheRule> = new Map();
  private stats: Map<string, { hits: number; misses: number; size: number }> = new Map();

  constructor(rules: CacheRule[] = []) {
    super();
    rules.forEach(rule => this.cacheRules.set(rule.id, rule));
    this.setupDefaultRules();
  }

  // Agregar regla de cache
  addRule(rule: CacheRule): void {
    this.cacheRules.set(rule.id, rule);
    this.emit('rule:added', { ruleId: rule.id, timestamp: Date.now() });
  }

  // Obtener reglas para un path
  getMatchingRules(path: string): CacheRule[] {
    return Array.from(this.cacheRules.values())
      .filter(rule => this.matchesPattern(path, rule.pattern))
      .sort((a, b) => b.priority - a.priority);
  }

  // Generar headers de cache
  generateCacheHeaders(path: string, contentType: string): Record<string, string> {
    const rules = this.getMatchingRules(path);
    const headers: Record<string, string> = {};

    if (rules.length === 0) {
      // Headers por defecto
      headers['Cache-Control'] = 'public, max-age=3600';
      return headers;
    }

    const rule = rules[0]; // Usar regla de mayor prioridad
    
    headers['Cache-Control'] = `public, max-age=${rule.ttl / 1000}`;
    headers['Expires'] = new Date(Date.now() + rule.ttl).toUTCString();
    
    if (rule.vary.length > 0) {
      headers['Vary'] = rule.vary.join(', ');
    }

    // Agregar headers personalizados
    Object.assign(headers, rule.headers);

    return headers;
  }

  // Verificar si se debe bypasear el cache
  shouldBypassCache(path: string, headers: Record<string, string>): boolean {
    const rules = this.getMatchingRules(path);
    
    for (const rule of rules) {
      for (const bypassHeader of rule.bypass) {
        if (headers[bypassHeader.toLowerCase()]) {
          return true;
        }
      }
    }

    return false;
  }

  private setupDefaultRules(): void {
    const defaultRules: CacheRule[] = [
      {
        id: 'static-assets',
        pattern: '/assets/**',
        ttl: 31536000000, // 1 año
        headers: { 'Cache-Control': 'public, immutable' },
        vary: [],
        bypass: ['cache-control'],
        priority: 100
      },
      {
        id: 'images',
        pattern: '**/*.{jpg,jpeg,png,gif,webp,avif,svg}',
        ttl: 86400000, // 1 día
        headers: {},
        vary: ['Accept'],
        bypass: [],
        priority: 90
      },
      {
        id: 'api-responses',
        pattern: '/api/**',
        ttl: 300000, // 5 minutos
        headers: {},
        vary: ['Authorization', 'Accept'],
        bypass: ['authorization'],
        priority: 50
      },
      {
        id: 'html-pages',
        pattern: '**/*.html',
        ttl: 3600000, // 1 hora
        headers: {},
        vary: ['Accept-Encoding'],
        bypass: ['cache-control'],
        priority: 30
      }
    ];

    defaultRules.forEach(rule => this.addRule(rule));
  }

  private matchesPattern(path: string, pattern: string): boolean {
    // Implementación básica de matching de patrones
    const regexPattern = pattern
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\{([^}]+)\}/g, '($1)')
      .replace(/,/g, '|');
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(path);
  }
}

// ============================================================================
// INSTANCIAS SINGLETON
// ============================================================================

// Configuración por defecto
const defaultCDNConfig: CDNConfig = {
  primaryEndpoint: 'https://cdn.arbitragexsupreme.com',
  fallbackEndpoints: [
    'https://cdn-backup1.arbitragexsupreme.com',
    'https://cdn-backup2.arbitragexsupreme.com'
  ],
  regions: [], // Se inicializan en el constructor
  cacheRules: [],
  compression: {
    enabled: true,
    algorithms: ['brotli', 'gzip'],
    minSize: 1024,
    maxSize: 50 * 1024 * 1024,
    mimeTypes: ['text/*', 'application/javascript', 'application/json'],
    level: 6
  },
  security: {
    cors: {
      enabled: true,
      origins: ['*'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      headers: ['Content-Type', 'Authorization'],
      credentials: false
    },
    rateLimit: {
      enabled: true,
      requests: 1000,
      window: 60000,
      whitelist: []
    },
    ddosProtection: {
      enabled: true,
      threshold: 10000,
      blockDuration: 300000
    }
  },
  monitoring: {
    enabled: true,
    metricsEndpoint: '/api/metrics',
    healthCheckInterval: 30000,
    alertThresholds: {
      latency: 2000,
      errorRate: 0.05,
      availability: 95
    }
  }
};

export const globalCDN = new GlobalCDNManager(defaultCDNConfig);
export const edgeCache = new EdgeCacheManager();

// ============================================================================
// UTILIDADES CDN
// ============================================================================

// Función para precargar assets críticos
export async function preloadCriticalAssets(assets: string[]): Promise<void> {
  const loadPromises = assets.map(asset => {
    return new Promise<void>((resolve) => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = asset;
      
      // Detectar tipo de asset
      if (asset.match(/\.(css)$/)) link.as = 'style';
      else if (asset.match(/\.(js|mjs)$/)) link.as = 'script';
      else if (asset.match(/\.(jpg|jpeg|png|gif|webp|avif)$/)) link.as = 'image';
      else if (asset.match(/\.(woff|woff2|ttf|otf)$/)) link.as = 'font';
      
      link.onload = () => resolve();
      link.onerror = () => resolve(); // Continuar aunque falle
      
      document.head.appendChild(link);
      
      // Timeout de seguridad
      setTimeout(resolve, 5000);
    });
  });

  await Promise.allSettled(loadPromises);
}

// Función para lazy loading de imágenes
export function setupLazyLoading(selector = 'img[data-src]'): void {
  if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement;
          img.src = img.dataset.src || '';
          img.classList.remove('lazy');
          imageObserver.unobserve(img);
        }
      });
    });

    document.querySelectorAll(selector).forEach(img => {
      imageObserver.observe(img);
    });
  }
}

export default {
  GlobalCDNManager,
  EdgeCacheManager,
  globalCDN,
  edgeCache,
  preloadCriticalAssets,
  setupLazyLoading
};
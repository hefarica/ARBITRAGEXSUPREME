/**
 * ArbitrageX Supreme V3.0 - Monitoring Worker
 * Real-time monitoring, metrics collection, and alerting for Edge services
 */

export interface Env {
  MONITORING_KV: KVNamespace;
  METRICS_DURABLE_OBJECT: DurableObjectNamespace;
  WEBHOOK_URL?: string;
  SLACK_WEBHOOK?: string;
}

interface MetricEntry {
  name: string;
  value: number;
  timestamp: number;
  tags: Record<string, string>;
  type: 'counter' | 'gauge' | 'histogram' | 'timer';
}

interface Alert {
  id: string;
  name: string;
  condition: string;
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  lastTriggered?: number;
  cooldown: number; // seconds
}

interface HealthCheck {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency: number;
  timestamp: number;
  details?: any;
}

class MetricsCollector {
  private state: DurableObjectState;
  private env: Env;
  private metrics: Map<string, MetricEntry[]>;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.metrics = new Map();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;
    
    try {
      switch (method) {
        case 'POST':
          return await this.recordMetric(request);
        case 'GET':
          return await this.getMetrics(url);
        case 'DELETE':
          return await this.clearMetrics(url);
        default:
          return new Response('Method not allowed', { status: 405 });
      }
    } catch (error) {
      console.error('Metrics collector error:', error);
      return new Response(JSON.stringify({
        error: 'Metrics service error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private async recordMetric(request: Request): Promise<Response> {
    const metric = await request.json() as MetricEntry;
    
    // Validate metric
    if (!metric.name || typeof metric.value !== 'number') {
      return new Response('Invalid metric data', { status: 400 });
    }

    metric.timestamp = metric.timestamp || Date.now();
    
    // Store in memory
    const key = `${metric.name}:${JSON.stringify(metric.tags || {})}`;
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }
    
    const entries = this.metrics.get(key)!;
    entries.push(metric);
    
    // Keep only last 1000 entries per metric
    if (entries.length > 1000) {
      entries.splice(0, entries.length - 1000);
    }

    // Store in persistent storage
    await this.state.storage.put(`metric:${key}:${metric.timestamp}`, metric);
    
    // Check alerts
    await this.checkAlerts(metric);
    
    // Set cleanup alarm
    await this.state.storage.setAlarm(Date.now() + 3600000); // 1 hour

    return new Response(JSON.stringify({
      success: true,
      metric: metric.name,
      timestamp: metric.timestamp
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async getMetrics(url: URL): Promise<Response> {
    const metricName = url.searchParams.get('name');
    const since = parseInt(url.searchParams.get('since') || '0');
    const limit = parseInt(url.searchParams.get('limit') || '100');
    
    if (metricName) {
      // Get specific metric
      const entries = this.metrics.get(metricName) || [];
      const filtered = entries
        .filter(entry => entry.timestamp >= since)
        .slice(-limit);
      
      return new Response(JSON.stringify({
        metric: metricName,
        entries: filtered,
        count: filtered.length
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      // Get all metrics summary
      const summary: Record<string, any> = {};
      
      for (const [key, entries] of this.metrics.entries()) {
        const recent = entries.filter(entry => entry.timestamp >= since);
        if (recent.length > 0) {
          const latest = recent[recent.length - 1];
          summary[key] = {
            latest: latest.value,
            count: recent.length,
            timestamp: latest.timestamp,
            type: latest.type
          };
        }
      }
      
      return new Response(JSON.stringify({
        summary,
        timestamp: Date.now()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  private async clearMetrics(url: URL): Promise<Response> {
    const metricName = url.searchParams.get('name');
    
    if (metricName) {
      this.metrics.delete(metricName);
      
      // Clear from persistent storage
      const keys = await this.state.storage.list({ prefix: `metric:${metricName}:` });
      for (const key of keys.keys()) {
        await this.state.storage.delete(key);
      }
    } else {
      // Clear all metrics
      this.metrics.clear();
      
      const keys = await this.state.storage.list({ prefix: 'metric:' });
      for (const key of keys.keys()) {
        await this.state.storage.delete(key);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      cleared: metricName || 'all'
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  private async checkAlerts(metric: MetricEntry): Promise<void> {
    const alerts = await this.getAlerts();
    
    for (const alert of alerts) {
      if (!alert.enabled) continue;
      
      // Check cooldown
      if (alert.lastTriggered && 
          Date.now() - alert.lastTriggered < alert.cooldown * 1000) {
        continue;
      }
      
      // Evaluate condition
      if (this.evaluateAlertCondition(alert, metric)) {
        await this.triggerAlert(alert, metric);
      }
    }
  }

  private evaluateAlertCondition(alert: Alert, metric: MetricEntry): boolean {
    // Simple condition evaluation
    switch (alert.condition) {
      case 'greater_than':
        return metric.value > alert.threshold;
      case 'less_than':
        return metric.value < alert.threshold;
      case 'equals':
        return metric.value === alert.threshold;
      default:
        return false;
    }
  }

  private async triggerAlert(alert: Alert, metric: MetricEntry): Promise<void> {
    console.log(`Alert triggered: ${alert.name} - ${metric.name} = ${metric.value}`);
    
    // Update last triggered time
    alert.lastTriggered = Date.now();
    await this.state.storage.put(`alert:${alert.id}`, alert);
    
    // Send notification
    await this.sendNotification(alert, metric);
  }

  private async sendNotification(alert: Alert, metric: MetricEntry): Promise<void> {
    const notification = {
      alert: alert.name,
      metric: metric.name,
      value: metric.value,
      threshold: alert.threshold,
      severity: alert.severity,
      timestamp: Date.now(),
      service: 'ArbitrageX Edge'
    };

    // Send to webhook if configured
    if (this.env.WEBHOOK_URL) {
      try {
        await fetch(this.env.WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(notification)
        });
      } catch (error) {
        console.error('Failed to send webhook notification:', error);
      }
    }

    // Send to Slack if configured
    if (this.env.SLACK_WEBHOOK) {
      try {
        const slackMessage = {
          text: `🚨 ArbitrageX Alert: ${alert.name}`,
          attachments: [{
            color: this.getAlertColor(alert.severity),
            fields: [
              { title: 'Metric', value: metric.name, short: true },
              { title: 'Value', value: metric.value.toString(), short: true },
              { title: 'Threshold', value: alert.threshold.toString(), short: true },
              { title: 'Severity', value: alert.severity.toUpperCase(), short: true }
            ],
            timestamp: Math.floor(Date.now() / 1000)
          }]
        };

        await fetch(this.env.SLACK_WEBHOOK, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(slackMessage)
        });
      } catch (error) {
        console.error('Failed to send Slack notification:', error);
      }
    }
  }

  private getAlertColor(severity: string): string {
    switch (severity) {
      case 'critical': return 'danger';
      case 'high': return 'warning';
      case 'medium': return '#ffaa00';
      case 'low': return 'good';
      default: return '#cccccc';
    }
  }

  private async getAlerts(): Promise<Alert[]> {
    const alerts: Alert[] = [];
    const keys = await this.state.storage.list({ prefix: 'alert:' });
    
    for (const [key, value] of keys) {
      alerts.push(value as Alert);
    }
    
    return alerts;
  }

  async alarm() {
    // Cleanup old metrics
    const cutoff = Date.now() - 24 * 3600000; // 24 hours
    const keys = await this.state.storage.list({ prefix: 'metric:' });
    
    for (const [key] of keys) {
      if (typeof key === 'string') {
        const parts = key.split(':');
        const timestamp = parseInt(parts[parts.length - 1]);
        if (!isNaN(timestamp) && timestamp < cutoff) {
          await this.state.storage.delete(key);
        }
      }
    }
  }
}

export { MetricsCollector };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400'
        }
      });
    }

    try {
      const operation = url.pathname.split('/').pop();
      
      switch (operation) {
        case 'health':
          return await handleHealthCheck(request, env);
        case 'metrics':
          return await handleMetrics(request, env);
        case 'alerts':
          return await handleAlerts(request, env);
        case 'status':
          return await handleStatus(request, env);
        default:
          // Use Durable Object for metrics collection
          const durableObjectId = env.METRICS_DURABLE_OBJECT.idFromName('metrics-collector');
          const durableObject = env.METRICS_DURABLE_OBJECT.get(durableObjectId);
          return await durableObject.fetch(request);
      }
    } catch (error) {
      console.error('Monitoring worker error:', error);
      
      return new Response(JSON.stringify({
        error: 'Monitoring service error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
  }
};

async function handleHealthCheck(request: Request, env: Env): Promise<Response> {
  const checks: HealthCheck[] = [];
  const startTime = Date.now();
  
  // Check KV storage
  try {
    const testKey = `health-check-${Date.now()}`;
    await env.MONITORING_KV.put(testKey, 'ok');
    await env.MONITORING_KV.delete(testKey);
    
    checks.push({
      service: 'KV Storage',
      status: 'healthy',
      latency: Date.now() - startTime,
      timestamp: Date.now()
    });
  } catch (error) {
    checks.push({
      service: 'KV Storage',
      status: 'unhealthy',
      latency: Date.now() - startTime,
      timestamp: Date.now(),
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    });
  }

  // Check Durable Objects
  try {
    const durableObjectId = env.METRICS_DURABLE_OBJECT.idFromName('health-check');
    const durableObject = env.METRICS_DURABLE_OBJECT.get(durableObjectId);
    
    const healthRequest = new Request('https://metrics-collector/health', {
      method: 'GET'
    });
    
    const doStartTime = Date.now();
    const response = await durableObject.fetch(healthRequest);
    
    checks.push({
      service: 'Durable Objects',
      status: response.ok ? 'healthy' : 'degraded',
      latency: Date.now() - doStartTime,
      timestamp: Date.now(),
      details: { status: response.status }
    });
  } catch (error) {
    checks.push({
      service: 'Durable Objects',
      status: 'unhealthy',
      latency: Date.now() - startTime,
      timestamp: Date.now(),
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    });
  }

  const overallStatus = checks.every(check => check.status === 'healthy') ? 'healthy' :
                       checks.some(check => check.status === 'unhealthy') ? 'unhealthy' : 'degraded';

  return new Response(JSON.stringify({
    status: overallStatus,
    timestamp: Date.now(),
    checks,
    uptime: Date.now() - startTime,
    version: '3.0.0'
  }), {
    status: overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 207 : 503,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

async function handleMetrics(request: Request, env: Env): Promise<Response> {
  if (request.method === 'POST') {
    // Record new metric
    const durableObjectId = env.METRICS_DURABLE_OBJECT.idFromName('metrics-collector');
    const durableObject = env.METRICS_DURABLE_OBJECT.get(durableObjectId);
    return await durableObject.fetch(request);
  } else {
    // Get metrics
    const url = new URL(request.url);
    const format = url.searchParams.get('format') || 'json';
    
    const durableObjectId = env.METRICS_DURABLE_OBJECT.idFromName('metrics-collector');
    const durableObject = env.METRICS_DURABLE_OBJECT.get(durableObjectId);
    
    const metricsRequest = new Request(request.url, {
      method: 'GET'
    });
    
    const response = await durableObject.fetch(metricsRequest);
    const data = await response.json();
    
    if (format === 'prometheus') {
      // Convert to Prometheus format
      let prometheus = '';
      
      for (const [key, metric] of Object.entries(data.summary || {})) {
        const metricData = metric as any;
        prometheus += `# TYPE ${key} ${metricData.type}\n`;
        prometheus += `${key} ${metricData.latest} ${metricData.timestamp}\n`;
      }
      
      return new Response(prometheus, {
        headers: {
          'Content-Type': 'text/plain',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }
    
    return new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}

async function handleAlerts(request: Request, env: Env): Promise<Response> {
  // Simple alert management
  const alerts: Alert[] = [
    {
      id: 'high-error-rate',
      name: 'High Error Rate',
      condition: 'greater_than',
      threshold: 10,
      severity: 'high',
      enabled: true,
      cooldown: 300
    },
    {
      id: 'low-opportunities',
      name: 'Low Opportunities',
      condition: 'less_than',
      threshold: 5,
      severity: 'medium',
      enabled: true,
      cooldown: 600
    },
    {
      id: 'high-latency',
      name: 'High Latency',
      condition: 'greater_than',
      threshold: 1000,
      severity: 'high',
      enabled: true,
      cooldown: 180
    }
  ];

  return new Response(JSON.stringify({
    alerts,
    count: alerts.length
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

async function handleStatus(request: Request, env: Env): Promise<Response> {
  const status = {
    service: 'ArbitrageX Monitoring Worker',
    version: '3.0.0',
    timestamp: Date.now(),
    features: [
      'Real-time Metrics Collection',
      'Health Checks',
      'Alert Management',
      'Webhook Notifications',
      'Slack Integration',
      'Prometheus Export'
    ],
    endpoints: [
      '/health - Health check',
      '/metrics - Metrics collection and retrieval',
      '/alerts - Alert management',
      '/status - Service status'
    ]
  };

  return new Response(JSON.stringify(status), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

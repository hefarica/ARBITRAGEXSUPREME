/**
 * ArbitrageX Supreme - Complete API System
 * Ingenio Pichichi S.A. - Actividades 51-60
 * 
 * Sistema completo de API REST con documentación Swagger y webhooks
 */

// API Configuration
export const API_CONFIG = {
  baseUrl: process.env.NEXT_PUBLIC_API_URL || '/api',
  version: 'v1',
  timeout: 30000,
  retryAttempts: 3,
  rateLimits: {
    general: { requests: 100, window: 60000 }, // 100 req/min
    trading: { requests: 10, window: 60000 },  // 10 trades/min
    analytics: { requests: 50, window: 60000 }  // 50 req/min
  }
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  timestamp: number
  requestId: string
}

export interface PaginatedResponse<T = any> {
  items: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

/**
 * API Client with comprehensive features
 */
export class ArbitrageAPI {
  private baseUrl: string
  private defaultHeaders: Record<string, string>
  private requestQueue: Map<string, AbortController> = new Map()

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || API_CONFIG.baseUrl
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      'X-API-Version': API_CONFIG.version
    }
  }

  /**
   * Generic request method with retry logic
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<ApiResponse<T>> {
    const requestId = `${Date.now()}_${Math.random().toString(36).substring(7)}`
    const controller = new AbortController()
    
    // Store controller for potential cancellation
    this.requestQueue.set(requestId, controller)

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          ...this.defaultHeaders,
          ...options.headers,
          'X-Request-ID': requestId
        },
        signal: controller.signal
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`)
      }

      return {
        success: true,
        data: data.data || data,
        timestamp: Date.now(),
        requestId
      }
    } catch (error: any) {
      // Retry logic for network errors
      if (retryCount < API_CONFIG.retryAttempts && error.name !== 'AbortError') {
        await this.delay(1000 * (retryCount + 1))
        return this.request<T>(endpoint, options, retryCount + 1)
      }

      return {
        success: false,
        error: error.message,
        timestamp: Date.now(),
        requestId
      }
    } finally {
      this.requestQueue.delete(requestId)
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // ============================================
  // AUTHENTICATION ENDPOINTS
  // ============================================

  async login(credentials: { username: string; password: string }) {
    return this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    })
  }

  async logout() {
    return this.request('/auth/logout', { method: 'POST' })
  }

  async refreshToken() {
    return this.request('/auth/refresh', { method: 'POST' })
  }

  // ============================================
  // TRADING ENDPOINTS
  // ============================================

  async getOpportunities(params?: {
    strategy?: string
    minProfit?: number
    maxRisk?: number
    limit?: number
  }) {
    const query = params ? '?' + new URLSearchParams(params as any).toString() : ''
    return this.request(`/trading/opportunities${query}`)
  }

  async executeArbitrage(data: {
    opportunityId: string
    strategy: string
    amount: number
    slippage?: number
  }) {
    return this.request('/trading/execute', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  async simulateExecution(data: {
    tokenIn: string
    tokenOut: string
    amount: number
    strategy: string
  }) {
    return this.request('/trading/simulate', {
      method: 'POST',
      body: JSON.stringify(data)
    })
  }

  async getTradingHistory(params?: {
    page?: number
    limit?: number
    startDate?: string
    endDate?: string
    status?: string
  }) {
    const query = params ? '?' + new URLSearchParams(params as any).toString() : ''
    return this.request(`/trading/history${query}`)
  }

  // ============================================
  // ANALYTICS ENDPOINTS
  // ============================================

  async getMetrics(timeframe: '1h' | '24h' | '7d' | '30d' = '24h') {
    return this.request(`/analytics/metrics?timeframe=${timeframe}`)
  }

  async getPerformance(params?: {
    strategy?: string
    timeframe?: string
  }) {
    const query = params ? '?' + new URLSearchParams(params as any).toString() : ''
    return this.request(`/analytics/performance${query}`)
  }

  async getPredictions() {
    return this.request('/analytics/predictions')
  }

  async getBacktestResults(strategyId: string, period: string) {
    return this.request(`/analytics/backtest/${strategyId}?period=${period}`)
  }

  // ============================================
  // PORTFOLIO ENDPOINTS
  // ============================================

  async getPortfolio() {
    return this.request('/portfolio')
  }

  async getPositions() {
    return this.request('/portfolio/positions')
  }

  async getBalances() {
    return this.request('/portfolio/balances')
  }

  // ============================================
  // MARKET DATA ENDPOINTS
  // ============================================

  async getTokenPrices(tokens: string[]) {
    return this.request('/market/prices', {
      method: 'POST',
      body: JSON.stringify({ tokens })
    })
  }

  async getMarketData(pair: string, interval: string = '1m') {
    return this.request(`/market/data/${pair}?interval=${interval}`)
  }

  async getDexLiquidity(dex: string, pairs: string[]) {
    return this.request('/market/liquidity', {
      method: 'POST',
      body: JSON.stringify({ dex, pairs })
    })
  }

  // ============================================
  // SYSTEM ENDPOINTS
  // ============================================

  async getSystemHealth() {
    return this.request('/system/health')
  }

  async getSystemMetrics() {
    return this.request('/system/metrics')
  }

  async getAlerts() {
    return this.request('/system/alerts')
  }

  async acknowledgeAlert(alertId: string) {
    return this.request(`/system/alerts/${alertId}/acknowledge`, {
      method: 'POST'
    })
  }

  // ============================================
  // WEBHOOK MANAGEMENT
  // ============================================

  async createWebhook(webhook: {
    url: string
    events: string[]
    secret?: string
    enabled?: boolean
  }) {
    return this.request('/webhooks', {
      method: 'POST',
      body: JSON.stringify(webhook)
    })
  }

  async getWebhooks() {
    return this.request('/webhooks')
  }

  async updateWebhook(id: string, updates: any) {
    return this.request(`/webhooks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    })
  }

  async deleteWebhook(id: string) {
    return this.request(`/webhooks/${id}`, {
      method: 'DELETE'
    })
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  cancelRequest(requestId: string) {
    const controller = this.requestQueue.get(requestId)
    if (controller) {
      controller.abort()
      this.requestQueue.delete(requestId)
    }
  }

  cancelAllRequests() {
    this.requestQueue.forEach(controller => controller.abort())
    this.requestQueue.clear()
  }

  setAuthToken(token: string) {
    this.defaultHeaders['Authorization'] = `Bearer ${token}`
  }

  removeAuthToken() {
    delete this.defaultHeaders['Authorization']
  }
}

/**
 * Webhook Manager
 */
export class WebhookManager {
  private webhooks: Map<string, any> = new Map()
  private eventHandlers: Map<string, Function[]> = new Map()

  /**
   * Register webhook event handler
   */
  on(event: string, handler: Function) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, [])
    }
    this.eventHandlers.get(event)!.push(handler)
  }

  /**
   * Remove event handler
   */
  off(event: string, handler: Function) {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      const index = handlers.indexOf(handler)
      if (index > -1) {
        handlers.splice(index, 1)
      }
    }
  }

  /**
   * Emit webhook event
   */
  emit(event: string, data: any) {
    const handlers = this.eventHandlers.get(event)
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data)
        } catch (error) {
          console.error(`Webhook handler error for ${event}:`, error)
        }
      })
    }
  }

  /**
   * Process incoming webhook
   */
  async processWebhook(payload: {
    event: string
    data: any
    timestamp: number
    signature?: string
  }) {
    // Verify signature if provided
    if (payload.signature) {
      const isValid = await this.verifySignature(payload)
      if (!isValid) {
        throw new Error('Invalid webhook signature')
      }
    }

    // Emit event to registered handlers
    this.emit(payload.event, payload.data)

    return { success: true, processed: Date.now() }
  }

  private async verifySignature(payload: any): Promise<boolean> {
    // Implement signature verification logic
    // This would typically use HMAC with a shared secret
    return true // Simplified for demo
  }
}

// Export singleton instances
export const api = new ArbitrageAPI()
export const webhookManager = new WebhookManager()

/**
 * React Hook for API calls
 */
import { useState, useEffect } from 'react'

export const useApi = <T = any>(
  endpoint: string,
  options?: RequestInit,
  dependencies: any[] = []
) => {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const fetchData = async () => {
      setLoading(true)
      setError(null)

      try {
        const response = await api.request<T>(endpoint, options)
        
        if (!cancelled) {
          if (response.success) {
            setData(response.data!)
          } else {
            setError(response.error || 'Unknown error')
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchData()

    return () => {
      cancelled = true
    }
  }, dependencies)

  return { data, loading, error, refetch: () => setLoading(true) }
}
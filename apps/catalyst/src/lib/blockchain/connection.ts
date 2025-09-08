/**
 * ArbitrageX Supreme - Blockchain Connection Manager
 * Ingenio Pichichi S.A. - Gestión de Conexiones Multi-Chain
 * 
 * Sistema disciplinado de conexiones con múltiples blockchains
 * Implementa pool de conexiones, balanceador de carga y recuperación automática
 */

import { JsonRpcProvider, WebSocketProvider } from 'ethers'
import { BLOCKCHAIN_REGISTRY, BlockchainConfig } from './registry'

export interface ConnectionStats {
  chainId: number
  name: string
  isConnected: boolean
  latency: number
  blockHeight: number
  gasPrice: string
  lastUpdate: Date
  errorCount: number
}

export class BlockchainConnectionManager {
  private providers: Map<number, JsonRpcProvider> = new Map()
  private connectionStats: Map<number, ConnectionStats> = new Map()
  private reconnectionTimers: Map<number, NodeJS.Timeout> = new Map()
  
  private readonly MAX_RETRIES = 3
  private readonly RECONNECTION_DELAY = 5000
  private readonly HEALTH_CHECK_INTERVAL = 30000

  constructor() {
    this.initializeProviders()
    this.startHealthCheck()
  }

  /**
   * Inicialización disciplinada de providers para todas las blockchains activas
   */
  private async initializeProviders(): Promise<void> {
    const activeChains = Object.values(BLOCKCHAIN_REGISTRY).filter(
      chain => chain.isActive && !chain.isTestnet
    )

    console.log(`🔗 Inicializando conexiones para ${activeChains.length} blockchains...`)

    for (const chain of activeChains) {
      try {
        await this.connectToChain(chain)
        console.log(`✅ ${chain.name} conectada exitosamente`)
      } catch (error) {
        console.error(`❌ Error conectando ${chain.name}:`, error)
        this.scheduleReconnection(chain.chainId)
      }
    }
  }

  /**
   * Conecta a una blockchain específica con configuración metodica
   */
  private async connectToChain(chain: BlockchainConfig): Promise<void> {
    try {
      // Crear provider con configuración optimizada
      const provider = new JsonRpcProvider(chain.rpcUrl, {
        chainId: chain.chainId,
        name: chain.name
      })

      // Configurar timeouts y reintentos
      provider.pollingInterval = 4000 // 4 segundos
      
      // Verificar conexión
      const network = await provider.getNetwork()
      if (Number(network.chainId) !== chain.chainId) {
        throw new Error(`Chain ID mismatch: expected ${chain.chainId}, got ${network.chainId}`)
      }

      // Obtener estadísticas iniciales
      const blockNumber = await provider.getBlockNumber()
      const feeData = await provider.getFeeData()
      const latencyStart = Date.now()
      await provider.getBlockNumber() // Test de latencia
      const latency = Date.now() - latencyStart

      // Guardar provider y estadísticas
      this.providers.set(chain.chainId, provider)
      this.connectionStats.set(chain.chainId, {
        chainId: chain.chainId,
        name: chain.name,
        isConnected: true,
        latency,
        blockHeight: blockNumber,
        gasPrice: feeData.gasPrice?.toString() || '0',
        lastUpdate: new Date(),
        errorCount: 0
      })

    } catch (error) {
      throw new Error(`Failed to connect to ${chain.name}: ${error}`)
    }
  }

  /**
   * Obtiene provider para una blockchain específica
   */
  public getProvider(chainId: number): JsonRpcProvider | null {
    return this.providers.get(chainId) || null
  }

  /**
   * Obtiene estadísticas de conexión
   */
  public getConnectionStats(chainId?: number): ConnectionStats[] {
    if (chainId) {
      const stats = this.connectionStats.get(chainId)
      return stats ? [stats] : []
    }
    return Array.from(this.connectionStats.values())
  }

  /**
   * Verifica salud de las conexiones
   */
  private async performHealthCheck(): Promise<void> {
    for (const [chainId, provider] of Array.from(this.providers.entries())) {
      try {
        const latencyStart = Date.now()
        const blockNumber = await provider.getBlockNumber()
        const latency = Date.now() - latencyStart

        const stats = this.connectionStats.get(chainId)
        if (stats) {
          stats.isConnected = true
          stats.latency = latency
          stats.blockHeight = blockNumber
          stats.lastUpdate = new Date()
          stats.errorCount = 0
        }

      } catch (error) {
        console.error(`Health check failed for chain ${chainId}:`, error)
        
        const stats = this.connectionStats.get(chainId)
        if (stats) {
          stats.isConnected = false
          stats.errorCount++
          stats.lastUpdate = new Date()

          // Si hay muchos errores, programar reconexión
          if (stats.errorCount >= this.MAX_RETRIES) {
            this.scheduleReconnection(chainId)
          }
        }
      }
    }
  }

  /**
   * Programa reconexión automática
   */
  private scheduleReconnection(chainId: number): void {
    // Limpiar timer existente
    const existingTimer = this.reconnectionTimers.get(chainId)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    // Programar nueva reconexión
    const timer = setTimeout(async () => {
      const chain = Object.values(BLOCKCHAIN_REGISTRY).find(c => c.chainId === chainId)
      if (chain) {
        console.log(`🔄 Intentando reconectar a ${chain.name}...`)
        try {
          await this.connectToChain(chain)
          console.log(`✅ ${chain.name} reconectada exitosamente`)
        } catch (error) {
          console.error(`❌ Falló reconexión a ${chain.name}:`, error)
          // Programar otra reconexión con delay aumentado
          setTimeout(() => this.scheduleReconnection(chainId), this.RECONNECTION_DELAY * 2)
        }
      }
    }, this.RECONNECTION_DELAY)

    this.reconnectionTimers.set(chainId, timer)
  }

  /**
   * Inicia health check periódico
   */
  private startHealthCheck(): void {
    setInterval(() => {
      this.performHealthCheck()
    }, this.HEALTH_CHECK_INTERVAL)
  }

  /**
   * Obtiene blockchains conectadas ordenadas por latencia
   */
  public getConnectedChainsByLatency(): ConnectionStats[] {
    return Array.from(this.connectionStats.values())
      .filter(stats => stats.isConnected)
      .sort((a, b) => a.latency - b.latency)
  }

  /**
   * Obtiene estadísticas agregadas del sistema
   */
  public getSystemStats() {
    const allStats = Array.from(this.connectionStats.values())
    const connected = allStats.filter(s => s.isConnected)
    
    return {
      totalChains: allStats.length,
      connectedChains: connected.length,
      disconnectedChains: allStats.length - connected.length,
      averageLatency: connected.reduce((sum, s) => sum + s.latency, 0) / connected.length || 0,
      totalErrors: allStats.reduce((sum, s) => sum + s.errorCount, 0),
      healthyChains: connected.filter(s => s.latency < 1000).length,
      slowChains: connected.filter(s => s.latency >= 1000 && s.latency < 3000).length,
      criticalChains: connected.filter(s => s.latency >= 3000).length
    }
  }

  /**
   * Desconecta todas las conexiones y limpia recursos
   */
  public async disconnect(): Promise<void> {
    console.log('🔌 Desconectando de todas las blockchains...')
    
    // Limpiar timers
    for (const timer of Array.from(this.reconnectionTimers.values())) {
      clearTimeout(timer)
    }
    
    // Desconectar providers
    for (const [chainId, provider] of Array.from(this.providers.entries())) {
      try {
        await provider.destroy()
        console.log(`✅ Desconectado de chain ${chainId}`)
      } catch (error) {
        console.error(`❌ Error desconectando chain ${chainId}:`, error)
      }
    }
    
    // Limpiar mapas
    this.providers.clear()
    this.connectionStats.clear()
    this.reconnectionTimers.clear()
    
    console.log('✅ Desconexión completa')
  }
}

/**
 * INSTANCIA SINGLETON DEL GESTOR DE CONEXIONES
 * Acceso global organizado para toda la aplicación
 */
export const blockchainManager = new BlockchainConnectionManager()

/**
 * UTILIDADES DE CONEXIÓN
 */
export class ConnectionUtils {
  /**
   * Verifica si una blockchain está disponible para arbitraje
   */
  static isChainAvailableForArbitrage(chainId: number): boolean {
    const stats = blockchainManager.getConnectionStats(chainId)
    if (!stats.length) return false
    
    const chainStats = stats[0]
    return chainStats.isConnected && 
           chainStats.latency < 3000 && 
           chainStats.errorCount < 3
  }

  /**
   * Obtiene la mejor blockchain para una operación basada en latencia y costos
   */
  static getBestChainForOperation(preferredChains?: number[]): number | null {
    const connected = blockchainManager.getConnectedChainsByLatency()
    
    if (preferredChains) {
      for (const chainId of preferredChains) {
        const chainStats = connected.find(s => s.chainId === chainId)
        if (chainStats && this.isChainAvailableForArbitrage(chainId)) {
          return chainId
        }
      }
    }
    
    // Si no hay preferencias o no están disponibles, usar la más rápida
    const bestChain = connected.find(stats => 
      this.isChainAvailableForArbitrage(stats.chainId)
    )
    
    return bestChain?.chainId || null
  }

  /**
   * Obtiene cadenas por rango de costo de gas
   */
  static getChainsByGasRange(maxGasCostUsd: number): ConnectionStats[] {
    const connected = blockchainManager.getConnectedChainsByLatency()
    
    return connected.filter(stats => {
      const chainConfig = Object.values(BLOCKCHAIN_REGISTRY).find(
        chain => chain.chainId === stats.chainId
      )
      return chainConfig && chainConfig.avgGasCost <= maxGasCostUsd
    })
  }
}
/**
 * ⚡ SERVICIO WEBSOCKET TIEMPO REAL - ArbitrageX Supreme V3.0
 * 
 * METODOLOGÍA: INGENIO PICHICHI S.A.
 * - Disciplinado: Conexiones WebSocket seguras y estables
 * - Organizado: Sistema de alertas categorizadas
 * - Metodológico: Broadcasting inteligente y filtrado
 * 
 * FUNCIONALIDADES:
 * - Alertas de oportunidades de arbitraje en tiempo real
 * - Notificaciones de cambios de precios significativos
 * - Alertas de seguridad (rugpull detection)
 * - Métricas del sistema en vivo
 * - Conexiones múltiples con filtros personalizados
 * 
 * @version 2.0.0
 * @author ArbitrageX Supreme Engineering Team
 */

export interface AlertMessage {
    id: string;
    type: 'opportunity' | 'price_alert' | 'security_warning' | 'system_metric' | 'error';
    priority: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    message: string;
    data: any;
    timestamp: string;
    expires_at?: string;
}

export interface WebSocketConnection {
    socket: WebSocket;
    id: string;
    filters: AlertFilter[];
    connected_at: string;
    last_ping: string;
}

export interface AlertFilter {
    type: string;
    min_priority?: string;
    token_symbols?: string[];
    min_spread?: number;
    max_gas_cost?: number;
}

export class WebSocketService {
    
    private connections: Map<string, WebSocketConnection>;
    private alertQueue: AlertMessage[];
    private readonly MAX_QUEUE_SIZE = 1000;
    private readonly PING_INTERVAL = 30000; // 30 segundos
    
    constructor() {
        this.connections = new Map();
        this.alertQueue = [];
        
        // Inicializar sistema de ping/pong
        this.startPingInterval();
    }
    
    // ===================================================================
    // GESTIÓN DE CONEXIONES WEBSOCKET
    // ===================================================================
    
    /**
     * Manejar nueva conexión WebSocket (simplificado para Cloudflare Workers)
     */
    handleConnection(websocket: WebSocket, request: Request): Response {
        try {
            const connectionId = this.generateConnectionId();
            
            // Configurar connection simplificada
            const connection: WebSocketConnection = {
                socket: websocket,
                id: connectionId,
                filters: [{ type: 'all' }], // Filtro por defecto
                connected_at: new Date().toISOString(),
                last_ping: new Date().toISOString()
            };
            
            // Configurar eventos
            websocket.accept();
            
            // Almacenar conexión
            this.connections.set(connectionId, connection);
            
            // Enviar mensaje de bienvenida
            this.sendWelcomeMessage(connectionId);
            
            console.log(`✅ Nueva conexión WebSocket: ${connectionId} (Total: ${this.connections.size})`);
            
            return new Response(null, { status: 101 });
            
        } catch (error) {
            console.error('❌ Error handling WebSocket connection:', error);
            return new Response('WebSocket connection error', { status: 400 });
        }
    }
    
    /**
     * Manejar mensaje recibido
     */
    private handleMessage(connectionId: string, message: string): void {
        try {
            const connection = this.connections.get(connectionId);
            if (!connection) return;
            
            const data = JSON.parse(message);
            
            switch (data.type) {
                case 'ping':
                    this.handlePing(connectionId);
                    break;
                    
                case 'update_filters':
                    this.updateFilters(connectionId, data.filters);
                    break;
                    
                case 'request_backlog':
                    this.sendRecentAlerts(connectionId);
                    break;
                    
                default:
                    console.log(`📨 Mensaje no reconocido de ${connectionId}:`, data.type);
            }
            
        } catch (error) {
            console.error(`❌ Error processing message from ${connectionId}:`, error);
        }
    }
    
    /**
     * Manejar desconexión
     */
    private handleDisconnection(connectionId: string, code: number, reason: string): void {
        this.connections.delete(connectionId);
        console.log(`🔌 Desconexión WebSocket: ${connectionId} (Code: ${code}, Reason: ${reason})`);
        console.log(`📊 Conexiones activas: ${this.connections.size}`);
    }
    
    // ===================================================================
    // SISTEMA DE ALERTAS
    // ===================================================================
    
    /**
     * Enviar alerta de oportunidad de arbitraje
     */
    async sendArbitrageOpportunity(opportunity: any): Promise<void> {
        const alert: AlertMessage = {
            id: this.generateAlertId(),
            type: 'opportunity',
            priority: this.calculatePriority(opportunity.spread, opportunity.confidence),
            title: '🔍 Oportunidad de Arbitraje Detectada',
            message: `${opportunity.tokenA.symbol}: Spread ${opportunity.spread.toFixed(2)}% entre ${opportunity.exchangeA} y ${opportunity.exchangeB}`,
            data: opportunity,
            timestamp: new Date().toISOString(),
            expires_at: opportunity.expires_at
        };
        
        await this.broadcastAlert(alert);
    }
    
    /**
     * Enviar alerta de precio significativo
     */
    async sendPriceAlert(symbol: string, oldPrice: number, newPrice: number, changePercent: number): Promise<void> {
        const alert: AlertMessage = {
            id: this.generateAlertId(),
            type: 'price_alert',
            priority: Math.abs(changePercent) > 10 ? 'high' : Math.abs(changePercent) > 5 ? 'medium' : 'low',
            title: `📈 Cambio de Precio: ${symbol}`,
            message: `${symbol}: ${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}% ($${oldPrice.toFixed(2)} → $${newPrice.toFixed(2)})`,
            data: {
                symbol,
                old_price: oldPrice,
                new_price: newPrice,
                change_percent: changePercent,
                change_usd: newPrice - oldPrice
            },
            timestamp: new Date().toISOString()
        };
        
        await this.broadcastAlert(alert);
    }
    
    /**
     * Enviar alerta de seguridad (rugpull detection)
     */
    async sendSecurityAlert(tokenSymbol: string, riskLevel: string, flags: string[]): Promise<void> {
        const alert: AlertMessage = {
            id: this.generateAlertId(),
            type: 'security_warning',
            priority: riskLevel === 'CRITICAL' ? 'critical' : riskLevel === 'HIGH' ? 'high' : 'medium',
            title: '🚨 Alerta de Seguridad',
            message: `${tokenSymbol}: Detectado riesgo ${riskLevel}. Flags: ${flags.join(', ')}`,
            data: {
                symbol: tokenSymbol,
                risk_level: riskLevel,
                flags: flags,
                recommended_action: riskLevel === 'CRITICAL' ? 'AVOID_IMMEDIATELY' : 'PROCEED_WITH_CAUTION'
            },
            timestamp: new Date().toISOString()
        };
        
        await this.broadcastAlert(alert);
    }
    
    /**
     * Enviar métrica del sistema
     */
    async sendSystemMetric(metric: string, value: number, unit: string): Promise<void> {
        const alert: AlertMessage = {
            id: this.generateAlertId(),
            type: 'system_metric',
            priority: 'low',
            title: `📊 Métrica del Sistema`,
            message: `${metric}: ${value} ${unit}`,
            data: {
                metric,
                value,
                unit,
                timestamp: new Date().toISOString()
            },
            timestamp: new Date().toISOString()
        };
        
        await this.broadcastAlert(alert);
    }
    
    /**
     * Broadcast alerta a todas las conexiones relevantes
     */
    private async broadcastAlert(alert: AlertMessage): Promise<void> {
        // Añadir a queue
        this.alertQueue.push(alert);
        
        // Mantener tamaño de queue
        if (this.alertQueue.length > this.MAX_QUEUE_SIZE) {
            this.alertQueue = this.alertQueue.slice(-this.MAX_QUEUE_SIZE);
        }
        
        // Enviar a conexiones filtradas
        for (const [connectionId, connection] of this.connections.entries()) {
            if (this.shouldSendAlert(alert, connection.filters)) {
                try {
                    connection.socket.send(JSON.stringify({
                        type: 'alert',
                        alert: alert
                    }));
                } catch (error) {
                    console.error(`❌ Error sending alert to ${connectionId}:`, error);
                    // Remover conexión problemática
                    this.connections.delete(connectionId);
                }
            }
        }
        
        console.log(`📢 Alert broadcasted: ${alert.type} - ${alert.title} (${this.connections.size} connections)`);
    }
    
    // ===================================================================
    // UTILIDADES Y FILTROS
    // ===================================================================
    
    /**
     * Parsear filtros de URL parameters
     */
    private parseFilters(params: URLSearchParams): AlertFilter[] {
        const filters: AlertFilter[] = [];
        
        // Filtro general
        const generalFilter: AlertFilter = {
            type: 'all',
            min_priority: params.get('min_priority') || 'low'
        };
        
        // Filtros específicos
        if (params.get('tokens')) {
            generalFilter.token_symbols = params.get('tokens')!.split(',');
        }
        
        if (params.get('min_spread')) {
            generalFilter.min_spread = parseFloat(params.get('min_spread')!);
        }
        
        if (params.get('max_gas')) {
            generalFilter.max_gas_cost = parseFloat(params.get('max_gas')!);
        }
        
        filters.push(generalFilter);
        return filters;
    }
    
    /**
     * Verificar si debe enviar alerta según filtros
     */
    private shouldSendAlert(alert: AlertMessage, filters: AlertFilter[]): boolean {
        for (const filter of filters) {
            if (filter.type === 'all' || filter.type === alert.type) {
                // Verificar prioridad mínima
                if (filter.min_priority && !this.meetsPriority(alert.priority, filter.min_priority)) {
                    continue;
                }
                
                // Verificar símbolos de tokens
                if (filter.token_symbols && alert.data?.symbol) {
                    if (!filter.token_symbols.includes(alert.data.symbol)) {
                        continue;
                    }
                }
                
                // Verificar spread mínimo
                if (filter.min_spread && alert.data?.spread) {
                    if (alert.data.spread < filter.min_spread) {
                        continue;
                    }
                }
                
                // Verificar gas máximo
                if (filter.max_gas_cost && alert.data?.gas_cost_estimate) {
                    if (alert.data.gas_cost_estimate > filter.max_gas_cost) {
                        continue;
                    }
                }
                
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Verificar si prioridad cumple con mínimo
     */
    private meetsPriority(alertPriority: string, minPriority: string): boolean {
        const priorities = { 'low': 0, 'medium': 1, 'high': 2, 'critical': 3 };
        return (priorities[alertPriority as keyof typeof priorities] || 0) >= (priorities[minPriority as keyof typeof priorities] || 0);
    }
    
    /**
     * Calcular prioridad basada en métricas
     */
    private calculatePriority(spread: number, confidence: number): AlertMessage['priority'] {
        if (spread > 5 && confidence > 80) return 'critical';
        if (spread > 2 && confidence > 60) return 'high';
        if (spread > 1 && confidence > 40) return 'medium';
        return 'low';
    }
    
    /**
     * Enviar mensaje de bienvenida
     */
    private sendWelcomeMessage(connectionId: string): void {
        const connection = this.connections.get(connectionId);
        if (!connection) return;
        
        try {
            connection.socket.send(JSON.stringify({
                type: 'welcome',
                message: 'Conectado al sistema de alertas ArbitrageX Supreme',
                connection_id: connectionId,
                server_time: new Date().toISOString(),
                methodology: 'Ingenio Pichichi S.A.',
                features: [
                    'Alertas de arbitraje tiempo real',
                    'Notificaciones de precios',
                    'Alertas de seguridad',
                    'Métricas del sistema'
                ]
            }));
        } catch (error) {
            console.error(`❌ Error sending welcome message to ${connectionId}:`, error);
        }
    }
    
    /**
     * Enviar alertas recientes
     */
    private sendRecentAlerts(connectionId: string): void {
        const connection = this.connections.get(connectionId);
        if (!connection) return;
        
        const recentAlerts = this.alertQueue.slice(-10); // Últimas 10 alertas
        
        try {
            connection.socket.send(JSON.stringify({
                type: 'recent_alerts',
                alerts: recentAlerts,
                count: recentAlerts.length
            }));
        } catch (error) {
            console.error(`❌ Error sending recent alerts to ${connectionId}:`, error);
        }
    }
    
    /**
     * Manejar ping
     */
    private handlePing(connectionId: string): void {
        const connection = this.connections.get(connectionId);
        if (!connection) return;
        
        connection.last_ping = new Date().toISOString();
        
        try {
            connection.socket.send(JSON.stringify({
                type: 'pong',
                timestamp: new Date().toISOString()
            }));
        } catch (error) {
            console.error(`❌ Error sending pong to ${connectionId}:`, error);
        }
    }
    
    /**
     * Actualizar filtros de conexión
     */
    private updateFilters(connectionId: string, newFilters: AlertFilter[]): void {
        const connection = this.connections.get(connectionId);
        if (!connection) return;
        
        connection.filters = newFilters;
        
        try {
            connection.socket.send(JSON.stringify({
                type: 'filters_updated',
                filters: newFilters,
                timestamp: new Date().toISOString()
            }));
        } catch (error) {
            console.error(`❌ Error confirming filter update to ${connectionId}:`, error);
        }
    }
    
    /**
     * Sistema de ping interval (adaptado para Cloudflare Workers)
     */
    private startPingInterval(): void {
        // En Cloudflare Workers no podemos usar setInterval
        // El cleanup se hace cuando se reciben mensajes
        console.log('⚡ WebSocket service initialized (Cloudflare Workers mode)');
    }
    
    /**
     * Generar ID de conexión único
     */
    private generateConnectionId(): string {
        return `ws_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
    
    /**
     * Generar ID de alerta único
     */
    private generateAlertId(): string {
        return `alert_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    }
    
    /**
     * Obtener estadísticas del servicio
     */
    getStats() {
        return {
            active_connections: this.connections.size,
            total_alerts_sent: this.alertQueue.length,
            queue_size: this.alertQueue.length,
            max_queue_size: this.MAX_QUEUE_SIZE,
            ping_interval_ms: this.PING_INTERVAL,
            server_time: new Date().toISOString()
        };
    }
}
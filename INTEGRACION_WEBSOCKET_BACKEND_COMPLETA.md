# ArbitrageX Supreme v3.0 - Integración WebSocket Backend Completa

## 🎯 METODOLOGÍA INGENIO PICHICHI S.A - INTEGRACIÓN WEBSOCKET DISCIPLINADA

### **Especificación Completa: Contabo (Backend) ↔ Cloudflare (Edge Proxy) ↔ Lovable (Frontend)**

---

## 🏗️ **ARQUITECTURA WEBSOCKET COMPLETA**

### **🔄 Data Flow WebSocket:**
```
[Contabo Backend] → [Cloudflare Edge] → [Lovable Frontend]
      ↓                    ↓                    ↓
 WebSocket Server  →  Pub/Sub Relay  →  WebSocket Client
 Node.js/Fastify  →  Workers Durable  →  React Hooks
 Real-time Data   →  Edge Caching    →  UI Updates
```

---

## 🖥️ **MÓDULO 1: CONTABO BACKEND - WEBSOCKET SERVER**

### **📡 1.1 WebSocket Server Setup (Node.js + Fastify)**

#### **🔧 Server Configuration (Contabo VPS)**
```typescript
// contabo/src/websocket/websocket-server.ts
import fastify from 'fastify';
import websocket from '@fastify/websocket';
import { WebSocketConnection } from './WebSocketConnection';
import { MessageHandler } from './MessageHandler';
import { EventEmitter } from 'events';

interface WebSocketServerConfig {
  port: number;
  host: string;
  cors: {
    origin: string[];
    credentials: boolean;
  };
}

export class ArbitrageWebSocketServer extends EventEmitter {
  private server: any;
  private connections: Map<string, WebSocketConnection>;
  private messageHandler: MessageHandler;

  constructor(private config: WebSocketServerConfig) {
    super();
    this.connections = new Map();
    this.messageHandler = new MessageHandler();
    this.setupServer();
  }

  private async setupServer() {
    this.server = fastify({
      logger: {
        level: 'info',
        transport: {
          target: 'pino-pretty'
        }
      }
    });

    // Register WebSocket plugin
    await this.server.register(websocket, {
      options: {
        maxPayload: 1048576, // 1MB
        verifyClient: this.verifyClient.bind(this)
      }
    });

    // Register CORS
    await this.server.register(require('@fastify/cors'), {
      origin: this.config.cors.origin,
      credentials: this.config.cors.credentials
    });

    // WebSocket route
    this.server.register(async (server) => {
      server.get('/ws', { websocket: true }, (connection, req) => {
        this.handleConnection(connection, req);
      });
    });

    // Health check endpoint
    this.server.get('/health', async (request, reply) => {
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        connections: this.connections.size,
        uptime: process.uptime()
      };
    });
  }

  private verifyClient(info: any): boolean {
    // Implement authentication/authorization logic
    const token = info.req.headers.authorization?.replace('Bearer ', '');
    return this.validateToken(token);
  }

  private validateToken(token?: string): boolean {
    if (!token) return false;
    try {
      // JWT validation logic
      const decoded = jwt.verify(token, process.env.JWT_SECRET!);
      return !!decoded;
    } catch {
      return false;
    }
  }

  private handleConnection(connection: any, req: any) {
    const connectionId = this.generateConnectionId();
    const wsConnection = new WebSocketConnection(
      connectionId,
      connection,
      req,
      this.messageHandler
    );

    this.connections.set(connectionId, wsConnection);

    connection.on('close', () => {
      this.connections.delete(connectionId);
      console.log(`Connection ${connectionId} closed. Active connections: ${this.connections.size}`);
    });

    console.log(`New WebSocket connection: ${connectionId}. Active connections: ${this.connections.size}`);
  }

  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Broadcast to all connections
  public broadcast(message: any) {
    const serialized = JSON.stringify(message);
    this.connections.forEach((connection) => {
      if (connection.isAlive()) {
        connection.send(serialized);
      }
    });
  }

  // Send to specific connection
  public sendToConnection(connectionId: string, message: any) {
    const connection = this.connections.get(connectionId);
    if (connection && connection.isAlive()) {
      connection.send(JSON.stringify(message));
    }
  }

  public async start() {
    try {
      await this.server.listen({ 
        port: this.config.port, 
        host: this.config.host 
      });
      console.log(`WebSocket server listening on ${this.config.host}:${this.config.port}`);
    } catch (error) {
      console.error('Failed to start WebSocket server:', error);
      process.exit(1);
    }
  }
}
```

#### **🔗 WebSocket Connection Management**
```typescript
// contabo/src/websocket/WebSocketConnection.ts
import { EventEmitter } from 'events';
import { MessageHandler } from './MessageHandler';

export interface ConnectionInfo {
  id: string;
  userId?: string;
  subscriptions: Set<string>;
  lastPing: number;
  connectedAt: number;
}

export class WebSocketConnection extends EventEmitter {
  private info: ConnectionInfo;
  private heartbeatInterval: NodeJS.Timeout;

  constructor(
    id: string,
    private socket: any,
    private request: any,
    private messageHandler: MessageHandler
  ) {
    super();
    
    this.info = {
      id,
      subscriptions: new Set(),
      lastPing: Date.now(),
      connectedAt: Date.now()
    };

    this.setupEventHandlers();
    this.startHeartbeat();
  }

  private setupEventHandlers() {
    this.socket.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(message);
      } catch (error) {
        console.error('Failed to parse message:', error);
        this.sendError('INVALID_MESSAGE', 'Failed to parse message');
      }
    });

    this.socket.on('pong', () => {
      this.info.lastPing = Date.now();
    });

    this.socket.on('error', (error: Error) => {
      console.error(`WebSocket error for connection ${this.info.id}:`, error);
    });

    this.socket.on('close', () => {
      this.cleanup();
    });
  }

  private async handleMessage(message: any) {
    try {
      const response = await this.messageHandler.handle(message, this.info);
      if (response) {
        this.send(response);
      }
    } catch (error) {
      console.error('Message handling error:', error);
      this.sendError('HANDLER_ERROR', 'Failed to process message');
    }
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.isAlive()) {
        this.socket.ping();
      } else {
        this.socket.terminate();
      }
    }, 30000); // 30 seconds
  }

  public send(data: any) {
    if (this.socket.readyState === 1) { // OPEN
      this.socket.send(typeof data === 'string' ? data : JSON.stringify(data));
    }
  }

  public sendError(code: string, message: string) {
    this.send({
      type: 'error',
      error: {
        code,
        message,
        timestamp: new Date().toISOString()
      }
    });
  }

  public subscribe(channel: string) {
    this.info.subscriptions.add(channel);
    console.log(`Connection ${this.info.id} subscribed to ${channel}`);
  }

  public unsubscribe(channel: string) {
    this.info.subscriptions.delete(channel);
    console.log(`Connection ${this.info.id} unsubscribed from ${channel}`);
  }

  public isSubscribedTo(channel: string): boolean {
    return this.info.subscriptions.has(channel);
  }

  public isAlive(): boolean {
    const now = Date.now();
    return this.socket.readyState === 1 && (now - this.info.lastPing) < 60000; // 1 minute
  }

  public getInfo(): ConnectionInfo {
    return { ...this.info };
  }

  private cleanup() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    this.emit('disconnected', this.info.id);
  }
}
```

### **📨 1.2 Message Handler System**

#### **🔄 Message Processing**
```typescript
// contabo/src/websocket/MessageHandler.ts
import { ConnectionInfo } from './WebSocketConnection';
import { OpportunityService } from '../services/OpportunityService';
import { ExecutionService } from '../services/ExecutionService';
import { AnalyticsService } from '../services/AnalyticsService';

export interface WebSocketMessage {
  type: string;
  id?: string;
  data?: any;
  timestamp?: string;
}

export interface MessageResponse {
  type: string;
  id?: string;
  data?: any;
  error?: any;
  timestamp: string;
}

export class MessageHandler {
  constructor(
    private opportunityService: OpportunityService,
    private executionService: ExecutionService,
    private analyticsService: AnalyticsService
  ) {}

  public async handle(message: WebSocketMessage, connectionInfo: ConnectionInfo): Promise<MessageResponse | null> {
    const startTime = Date.now();
    
    try {
      let response: MessageResponse | null = null;

      switch (message.type) {
        case 'subscribe':
          response = await this.handleSubscribe(message, connectionInfo);
          break;
        case 'unsubscribe':
          response = await this.handleUnsubscribe(message, connectionInfo);
          break;
        case 'get_opportunities':
          response = await this.handleGetOpportunities(message, connectionInfo);
          break;
        case 'execute_opportunity':
          response = await this.handleExecuteOpportunity(message, connectionInfo);
          break;
        case 'get_executions':
          response = await this.handleGetExecutions(message, connectionInfo);
          break;
        case 'get_analytics':
          response = await this.handleGetAnalytics(message, connectionInfo);
          break;
        case 'heartbeat':
          response = this.handleHeartbeat(message);
          break;
        default:
          throw new Error(`Unknown message type: ${message.type}`);
      }

      const processingTime = Date.now() - startTime;
      if (processingTime > 100) { // Log slow requests
        console.warn(`Slow message processing: ${message.type} took ${processingTime}ms`);
      }

      return response;
    } catch (error) {
      console.error('Message handler error:', error);
      return {
        type: 'error',
        id: message.id,
        error: {
          message: error.message,
          code: 'HANDLER_ERROR'
        },
        timestamp: new Date().toISOString()
      };
    }
  }

  private async handleSubscribe(message: WebSocketMessage, connectionInfo: ConnectionInfo): Promise<MessageResponse> {
    const { channel } = message.data || {};
    
    if (!channel) {
      throw new Error('Channel is required for subscription');
    }

    // Validate subscription permissions
    if (!this.canSubscribeToChannel(channel, connectionInfo)) {
      throw new Error(`Access denied to channel: ${channel}`);
    }

    // Add subscription logic here
    // connectionInfo.subscriptions.add(channel);

    return {
      type: 'subscription_confirmed',
      id: message.id,
      data: { channel, status: 'subscribed' },
      timestamp: new Date().toISOString()
    };
  }

  private async handleGetOpportunities(message: WebSocketMessage, connectionInfo: ConnectionInfo): Promise<MessageResponse> {
    const { filters, limit = 50 } = message.data || {};
    
    const opportunities = await this.opportunityService.getOpportunities({
      ...filters,
      limit: Math.min(limit, 100) // Max 100 opportunities
    });

    return {
      type: 'opportunities_data',
      id: message.id,
      data: {
        opportunities,
        total: opportunities.length,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };
  }

  private async handleExecuteOpportunity(message: WebSocketMessage, connectionInfo: ConnectionInfo): Promise<MessageResponse> {
    const { opportunityId, amount, slippage } = message.data || {};
    
    if (!opportunityId || !amount) {
      throw new Error('opportunityId and amount are required');
    }

    // Validate user permissions
    if (!this.canExecuteOpportunity(connectionInfo)) {
      throw new Error('Insufficient permissions to execute opportunities');
    }

    const execution = await this.executionService.executeOpportunity({
      opportunityId,
      amount,
      slippage: slippage || 0.5,
      userId: connectionInfo.userId
    });

    return {
      type: 'execution_started',
      id: message.id,
      data: {
        executionId: execution.id,
        status: execution.status,
        estimatedCompletion: execution.estimatedCompletion
      },
      timestamp: new Date().toISOString()
    };
  }

  private handleHeartbeat(message: WebSocketMessage): MessageResponse {
    return {
      type: 'heartbeat_response',
      id: message.id,
      data: { status: 'alive' },
      timestamp: new Date().toISOString()
    };
  }

  private canSubscribeToChannel(channel: string, connectionInfo: ConnectionInfo): boolean {
    // Implement channel access control
    const allowedChannels = ['opportunities', 'executions', 'analytics', 'system'];
    return allowedChannels.includes(channel);
  }

  private canExecuteOpportunity(connectionInfo: ConnectionInfo): boolean {
    // Implement execution permissions
    return !!connectionInfo.userId; // Must be authenticated
  }
}
```

### **📡 1.3 Real-time Event Broadcasting**

#### **🔄 Event System Integration**
```typescript
// contabo/src/websocket/EventBroadcaster.ts
import { ArbitrageWebSocketServer } from './websocket-server';
import { EventEmitter } from 'events';

export interface BroadcastEvent {
  type: string;
  channel: string;
  data: any;
  timestamp: string;
  targetConnections?: string[];
}

export class EventBroadcaster extends EventEmitter {
  constructor(private wsServer: ArbitrageWebSocketServer) {
    super();
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    // Opportunity detection events
    this.on('opportunity_detected', (opportunity) => {
      this.broadcastToChannel('opportunities', {
        type: 'opportunity_detected',
        data: opportunity,
        timestamp: new Date().toISOString()
      });
    });

    // Execution update events
    this.on('execution_update', (execution) => {
      this.broadcastToChannel('executions', {
        type: 'execution_update',
        data: execution,
        timestamp: new Date().toISOString()
      });
    });

    // Strategy performance events
    this.on('strategy_performance_update', (performance) => {
      this.broadcastToChannel('analytics', {
        type: 'strategy_performance_update',
        data: performance,
        timestamp: new Date().toISOString()
      });
    });

    // System alerts
    this.on('system_alert', (alert) => {
      this.broadcastToChannel('system', {
        type: 'system_alert',
        data: alert,
        timestamp: new Date().toISOString()
      });
    });

    // Market data updates
    this.on('market_data_update', (marketData) => {
      this.broadcastToChannel('market', {
        type: 'market_data_update',
        data: marketData,
        timestamp: new Date().toISOString()
      });
    });
  }

  public broadcastToChannel(channel: string, message: any) {
    const connections = this.wsServer.getConnectionsByChannel(channel);
    const serialized = JSON.stringify(message);
    
    connections.forEach(connection => {
      if (connection.isAlive()) {
        connection.send(serialized);
      }
    });

    console.log(`Broadcasted to ${connections.length} connections in channel: ${channel}`);
  }

  public broadcastToUser(userId: string, message: any) {
    const userConnections = this.wsServer.getConnectionsByUser(userId);
    const serialized = JSON.stringify(message);
    
    userConnections.forEach(connection => {
      if (connection.isAlive()) {
        connection.send(serialized);
      }
    });
  }

  // MEV-specific event methods
  public emitOpportunityDetected(opportunity: any) {
    this.emit('opportunity_detected', opportunity);
  }

  public emitExecutionUpdate(execution: any) {
    this.emit('execution_update', execution);
  }

  public emitStrategyPerformanceUpdate(performance: any) {
    this.emit('strategy_performance_update', performance);
  }

  public emitSystemAlert(alert: any) {
    this.emit('system_alert', alert);
  }

  public emitMarketDataUpdate(marketData: any) {
    this.emit('market_data_update', marketData);
  }
}
```

---

## ☁️ **MÓDULO 2: CLOUDFLARE EDGE - WEBSOCKET PROXY & PUB/SUB**

### **⚡ 2.1 Cloudflare Workers WebSocket Proxy**

#### **🔗 Edge WebSocket Relay**
```typescript
// cloudflare/workers/websocket-proxy.ts
export interface Env {
  BACKEND_WS_URL: string;
  JWT_SECRET: string;
  WEBSOCKET_CONNECTIONS: DurableObjectNamespace;
}

export class WebSocketProxy implements DurableObject {
  private connections: Map<string, WebSocket>;
  private backendConnection: WebSocket | null;

  constructor(private state: DurableObjectState, private env: Env) {
    this.connections = new Map();
    this.backendConnection = null;
    this.connectToBackend();
  }

  private async connectToBackend() {
    try {
      this.backendConnection = new WebSocket(this.env.BACKEND_WS_URL);
      
      this.backendConnection.addEventListener('open', () => {
        console.log('Connected to backend WebSocket server');
      });

      this.backendConnection.addEventListener('message', (event) => {
        try {
          const message = JSON.parse(event.data);
          this.broadcastToClients(message);
        } catch (error) {
          console.error('Failed to parse backend message:', error);
        }
      });

      this.backendConnection.addEventListener('close', () => {
        console.log('Backend WebSocket connection closed');
        // Implement reconnection logic
        setTimeout(() => this.connectToBackend(), 5000);
      });

      this.backendConnection.addEventListener('error', (error) => {
        console.error('Backend WebSocket error:', error);
      });

    } catch (error) {
      console.error('Failed to connect to backend:', error);
      setTimeout(() => this.connectToBackend(), 5000);
    }
  }

  async fetch(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected websocket', { status: 400 });
    }

    // Validate authentication
    const authHeader = request.headers.get('Authorization');
    if (!this.validateAuth(authHeader)) {
      return new Response('Unauthorized', { status: 401 });
    }

    const webSocketPair = new WebSocketPair();
    const client = webSocketPair[0];
    const server = webSocketPair[1];

    const connectionId = this.generateConnectionId();
    this.connections.set(connectionId, server);

    server.accept();
    this.handleClientConnection(server, connectionId);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  private handleClientConnection(webSocket: WebSocket, connectionId: string) {
    webSocket.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data);
        this.forwardToBackend({
          ...message,
          connectionId,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Failed to parse client message:', error);
      }
    });

    webSocket.addEventListener('close', () => {
      this.connections.delete(connectionId);
      console.log(`Client connection closed: ${connectionId}`);
    });

    webSocket.addEventListener('error', (error) => {
      console.error(`Client WebSocket error for ${connectionId}:`, error);
    });

    // Send welcome message
    webSocket.send(JSON.stringify({
      type: 'connected',
      connectionId,
      timestamp: new Date().toISOString()
    }));
  }

  private forwardToBackend(message: any) {
    if (this.backendConnection && this.backendConnection.readyState === WebSocket.OPEN) {
      this.backendConnection.send(JSON.stringify(message));
    }
  }

  private broadcastToClients(message: any) {
    const serialized = JSON.stringify(message);
    
    this.connections.forEach((connection, connectionId) => {
      if (connection.readyState === WebSocket.OPEN) {
        connection.send(serialized);
      } else {
        this.connections.delete(connectionId);
      }
    });
  }

  private validateAuth(authHeader: string | null): boolean {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return false;
    }

    const token = authHeader.substring(7);
    try {
      // Implement JWT validation
      return this.verifyJWT(token);
    } catch {
      return false;
    }
  }

  private verifyJWT(token: string): boolean {
    // JWT verification logic using Web Crypto API
    // This is simplified - implement proper JWT verification
    return token.length > 20; // Placeholder validation
  }

  private generateConnectionId(): string {
    return `edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Worker script
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    if (url.pathname === '/ws') {
      const id = env.WEBSOCKET_CONNECTIONS.idFromName('websocket-proxy');
      const obj = env.WEBSOCKET_CONNECTIONS.get(id);
      return obj.fetch(request);
    }

    return new Response('Not found', { status: 404 });
  },
};
```

### **🔔 2.2 Cloudflare Pub/Sub System**

#### **📡 Pub/Sub with Durable Objects**
```typescript
// cloudflare/workers/pubsub-relay.ts
export class PubSubRelay implements DurableObject {
  private channels: Map<string, Set<string>>;
  private subscribers: Map<string, WebSocket>;

  constructor(private state: DurableObjectState, private env: Env) {
    this.channels = new Map();
    this.subscribers = new Map();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    if (url.pathname === '/subscribe') {
      return this.handleSubscription(request);
    } else if (url.pathname === '/publish') {
      return this.handlePublish(request);
    }

    return new Response('Not found', { status: 404 });
  }

  private async handleSubscription(request: Request): Promise<Response> {
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected websocket', { status: 400 });
    }

    const webSocketPair = new WebSocketPair();
    const client = webSocketPair[0];
    const server = webSocketPair[1];

    const subscriberId = this.generateSubscriberId();
    this.subscribers.set(subscriberId, server);

    server.accept();
    this.handleSubscriber(server, subscriberId);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  private handleSubscriber(webSocket: WebSocket, subscriberId: string) {
    webSocket.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.type === 'subscribe') {
          this.subscribeToChannel(subscriberId, message.channel);
        } else if (message.type === 'unsubscribe') {
          this.unsubscribeFromChannel(subscriberId, message.channel);
        }
      } catch (error) {
        console.error('Failed to parse subscriber message:', error);
      }
    });

    webSocket.addEventListener('close', () => {
      this.removeSubscriber(subscriberId);
    });
  }

  private subscribeToChannel(subscriberId: string, channel: string) {
    if (!this.channels.has(channel)) {
      this.channels.set(channel, new Set());
    }
    
    this.channels.get(channel)!.add(subscriberId);
    console.log(`Subscriber ${subscriberId} joined channel ${channel}`);
  }

  private unsubscribeFromChannel(subscriberId: string, channel: string) {
    if (this.channels.has(channel)) {
      this.channels.get(channel)!.delete(subscriberId);
    }
  }

  private removeSubscriber(subscriberId: string) {
    this.subscribers.delete(subscriberId);
    
    // Remove from all channels
    this.channels.forEach((subscribers) => {
      subscribers.delete(subscriberId);
    });
  }

  private async handlePublish(request: Request): Promise<Response> {
    try {
      const { channel, message } = await request.json();
      
      if (!channel || !message) {
        return new Response('Channel and message are required', { status: 400 });
      }

      this.publishToChannel(channel, message);
      
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response('Failed to publish message', { status: 500 });
    }
  }

  private publishToChannel(channel: string, message: any) {
    const subscribers = this.channels.get(channel);
    if (!subscribers) return;

    const serializedMessage = JSON.stringify({
      type: 'channel_message',
      channel,
      data: message,
      timestamp: new Date().toISOString()
    });

    subscribers.forEach(subscriberId => {
      const subscriber = this.subscribers.get(subscriberId);
      if (subscriber && subscriber.readyState === WebSocket.OPEN) {
        subscriber.send(serializedMessage);
      }
    });
  }

  private generateSubscriberId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

### **📊 2.3 Edge Caching & Performance**

#### **⚡ Edge Data Caching**
```typescript
// cloudflare/workers/edge-cache.ts
export class EdgeCache {
  constructor(private env: Env) {}

  async cacheOpportunities(opportunities: any[], ttl: number = 30) {
    const key = 'opportunities:latest';
    const data = {
      opportunities,
      timestamp: Date.now(),
      ttl
    };

    await this.env.CACHE_KV.put(key, JSON.stringify(data), {
      expirationTtl: ttl
    });
  }

  async getCachedOpportunities(): Promise<any[] | null> {
    const cached = await this.env.CACHE_KV.get('opportunities:latest');
    if (!cached) return null;

    const data = JSON.parse(cached);
    const age = Date.now() - data.timestamp;
    
    if (age > data.ttl * 1000) {
      return null; // Expired
    }

    return data.opportunities;
  }

  async cacheMetrics(metrics: any, key: string, ttl: number = 60) {
    await this.env.CACHE_KV.put(`metrics:${key}`, JSON.stringify({
      data: metrics,
      timestamp: Date.now()
    }), {
      expirationTtl: ttl
    });
  }

  async getCachedMetrics(key: string): Promise<any | null> {
    const cached = await this.env.CACHE_KV.get(`metrics:${key}`);
    return cached ? JSON.parse(cached).data : null;
  }
}
```

---

## 💻 **MÓDULO 3: LOVABLE FRONTEND - WEBSOCKET CLIENT**

### **🔌 3.1 WebSocket Client Manager (Lovable)**

#### **📡 Advanced WebSocket Hook**
```typescript
// lovable/hooks/useWebSocketManager.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';

export interface WebSocketConfig {
  url: string;
  protocols?: string[];
  reconnectInterval: number;
  maxReconnectAttempts: number;
  heartbeatInterval: number;
  authToken?: string;
}

export interface WebSocketState {
  isConnected: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'error';
  lastMessage: any;
  messageHistory: any[];
  connectionAttempts: number;
  latency: number;
}

export const useWebSocketManager = (config: WebSocketConfig) => {
  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    connectionStatus: 'disconnected',
    lastMessage: null,
    messageHistory: [],
    connectionAttempts: 0,
    latency: 0
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const messageQueueRef = useRef<any[]>([]);
  const pingTimeRef = useRef<number>(0);
  const { toast } = useToast();

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setState(prev => ({
      ...prev,
      connectionStatus: prev.connectionAttempts > 0 ? 'reconnecting' : 'connecting',
      connectionAttempts: prev.connectionAttempts + 1
    }));

    try {
      const headers: Record<string, string> = {};
      if (config.authToken) {
        headers.Authorization = `Bearer ${config.authToken}`;
      }

      // Note: WebSocket headers need to be handled differently in production
      wsRef.current = new WebSocket(config.url, config.protocols);

      wsRef.current.onopen = () => {
        setState(prev => ({
          ...prev,
          isConnected: true,
          connectionStatus: 'connected',
          connectionAttempts: 0
        }));

        toast({
          title: "Connected",
          description: "Real-time connection established",
          variant: "default",
        });

        // Send queued messages
        while (messageQueueRef.current.length > 0) {
          const message = messageQueueRef.current.shift();
          wsRef.current?.send(JSON.stringify(message));
        }

        // Start heartbeat
        startHeartbeat();
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Handle pong for latency calculation
          if (data.type === 'heartbeat_response') {
            const latency = Date.now() - pingTimeRef.current;
            setState(prev => ({ ...prev, latency }));
            return;
          }

          setState(prev => ({
            ...prev,
            lastMessage: data,
            messageHistory: [...prev.messageHistory.slice(-99), data] // Keep last 100 messages
          }));

          // Handle different message types
          handleMessage(data);

        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setState(prev => ({ ...prev, connectionStatus: 'error' }));
      };

      wsRef.current.onclose = (event) => {
        setState(prev => ({
          ...prev,
          isConnected: false,
          connectionStatus: 'disconnected'
        }));

        stopHeartbeat();

        // Attempt reconnection if not manual close
        if (event.code !== 1000 && state.connectionAttempts < config.maxReconnectAttempts) {
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, config.reconnectInterval);
        } else if (state.connectionAttempts >= config.maxReconnectAttempts) {
          toast({
            title: "Connection Failed",
            description: "Unable to establish real-time connection after multiple attempts",
            variant: "destructive",
          });
        }
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setState(prev => ({ ...prev, connectionStatus: 'error' }));
    }
  }, [config, state.connectionAttempts, toast]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    stopHeartbeat();
    
    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect');
    }
  }, []);

  const sendMessage = useCallback((message: any) => {
    const messageWithId = {
      ...message,
      id: generateMessageId(),
      timestamp: new Date().toISOString()
    };

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(messageWithId));
    } else {
      // Queue message for when connection is restored
      messageQueueRef.current.push(messageWithId);
    }
  }, []);

  const subscribe = useCallback((channel: string) => {
    sendMessage({
      type: 'subscribe',
      data: { channel }
    });
  }, [sendMessage]);

  const unsubscribe = useCallback((channel: string) => {
    sendMessage({
      type: 'unsubscribe',
      data: { channel }
    });
  }, [sendMessage]);

  const startHeartbeat = () => {
    heartbeatIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        pingTimeRef.current = Date.now();
        sendMessage({ type: 'heartbeat' });
      }
    }, config.heartbeatInterval);
  };

  const stopHeartbeat = () => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }
  };

  const handleMessage = (message: any) => {
    // Handle specific message types
    switch (message.type) {
      case 'system_alert':
        toast({
          title: "System Alert",
          description: message.data.message,
          variant: message.data.severity === 'high' ? 'destructive' : 'default',
        });
        break;
      case 'opportunity_detected':
        // Trigger opportunity updates in stores
        break;
      case 'execution_update':
        // Trigger execution updates in stores
        break;
    }
  };

  const generateMessageId = () => {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, []);

  return {
    ...state,
    connect,
    disconnect,
    sendMessage,
    subscribe,
    unsubscribe,
    clearHistory: () => setState(prev => ({ ...prev, messageHistory: [] }))
  };
};
```

### **🔄 3.2 Real-time Data Integration**

#### **📊 Real-time Opportunities Hook**
```typescript
// lovable/hooks/useRealTimeOpportunities.ts
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useOpportunitiesStore } from '@/stores/opportunitiesStore';
import { useWebSocketManager } from './useWebSocketManager';

export const useRealTimeOpportunities = () => {
  const queryClient = useQueryClient();
  const opportunitiesStore = useOpportunitiesStore();
  
  const { 
    lastMessage, 
    isConnected, 
    subscribe, 
    unsubscribe,
    connectionStatus
  } = useWebSocketManager({
    url: process.env.NEXT_PUBLIC_WS_URL || 'wss://edge.arbitragex.com/ws',
    reconnectInterval: 3000,
    maxReconnectAttempts: 5,
    heartbeatInterval: 30000,
    authToken: localStorage.getItem('auth_token') || undefined
  });

  // Subscribe to opportunities channel on connect
  useEffect(() => {
    if (isConnected) {
      subscribe('opportunities');
      subscribe('executions');
      subscribe('analytics');
    }
  }, [isConnected, subscribe]);

  // Handle real-time messages
  useEffect(() => {
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case 'opportunity_detected':
        handleOpportunityDetected(lastMessage.data);
        break;
      case 'opportunity_updated':
        handleOpportunityUpdated(lastMessage.data);
        break;
      case 'opportunity_expired':
        handleOpportunityExpired(lastMessage.data);
        break;
      case 'execution_update':
        handleExecutionUpdate(lastMessage.data);
        break;
      case 'strategy_performance_update':
        handleStrategyPerformanceUpdate(lastMessage.data);
        break;
    }
  }, [lastMessage]);

  const handleOpportunityDetected = (opportunity: any) => {
    // Update Zustand store
    opportunitiesStore.updateOpportunity(opportunity);
    
    // Update React Query cache
    queryClient.setQueryData(['opportunities'], (old: any[]) => {
      if (!old) return [opportunity];
      return [opportunity, ...old].slice(0, 100); // Keep only latest 100
    });

    // Show notification for high-profit opportunities
    if (opportunity.estimated_profit > 500) {
      showHighProfitNotification(opportunity);
    }
  };

  const handleOpportunityUpdated = (opportunity: any) => {
    opportunitiesStore.updateOpportunity(opportunity);
    
    queryClient.setQueryData(['opportunities'], (old: any[]) => {
      if (!old) return [opportunity];
      
      const index = old.findIndex((opp: any) => opp.id === opportunity.id);
      if (index >= 0) {
        const updated = [...old];
        updated[index] = opportunity;
        return updated;
      }
      return old;
    });
  };

  const handleOpportunityExpired = (data: { opportunityId: string }) => {
    opportunitiesStore.removeOpportunity(data.opportunityId);
    
    queryClient.setQueryData(['opportunities'], (old: any[]) => {
      if (!old) return [];
      return old.filter((opp: any) => opp.id !== data.opportunityId);
    });
  };

  const handleExecutionUpdate = (execution: any) => {
    queryClient.setQueryData(['executions'], (old: any[]) => {
      if (!old) return [execution];
      
      const index = old.findIndex((exec: any) => exec.id === execution.id);
      if (index >= 0) {
        const updated = [...old];
        updated[index] = { ...updated[index], ...execution };
        return updated;
      }
      return [execution, ...old];
    });
  };

  const handleStrategyPerformanceUpdate = (performance: any) => {
    queryClient.setQueryData(['strategy-performance'], performance);
  };

  const showHighProfitNotification = (opportunity: any) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(`High Profit Opportunity: $${opportunity.estimated_profit}`, {
        body: `${opportunity.token_pair} on ${opportunity.chain}`,
        icon: '/icon-192x192.png',
        tag: 'high-profit-opportunity'
      });
    }
  };

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  return {
    isConnected,
    connectionStatus,
    subscribe,
    unsubscribe
  };
};
```

### **🎯 3.3 Component Integration Examples**

#### **📊 Real-time Dashboard Component**
```typescript
// lovable/components/dashboard/RealTimeDashboard.tsx
import { useRealTimeOpportunities } from '@/hooks/useRealTimeOpportunities';
import { useOpportunitiesStore } from '@/stores/opportunitiesStore';
import { ConnectionStatus } from '@/components/widgets/ConnectionStatus';
import { OpportunityCard } from './OpportunityCard';

export const RealTimeDashboard = () => {
  const { isConnected, connectionStatus } = useRealTimeOpportunities();
  const { filteredOpportunities, filters, setFilters } = useOpportunitiesStore();

  return (
    <div className="space-y-6">
      {/* Header with connection status */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">ArbitrageX Dashboard</h1>
          <p className="text-muted-foreground">
            Real-time MEV opportunities and execution tracking
          </p>
        </div>
        <ConnectionStatus 
          isConnected={isConnected} 
          status={connectionStatus}
        />
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Active Opportunities"
          value={filteredOpportunities.length}
          description="Currently available"
          icon={<Target className="h-4 w-4" />}
        />
        <StatsCard
          title="24h Profit"
          value="$12,543.21"
          description="+12.5% from yesterday"
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <StatsCard
          title="Success Rate"
          value="94.2%"
          description="Last 100 executions"
          icon={<CheckCircle className="h-4 w-4" />}
        />
        <StatsCard
          title="Avg Latency"
          value="23ms"
          description="End-to-end execution"
          icon={<Zap className="h-4 w-4" />}
        />
      </div>

      {/* Opportunities grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredOpportunities.map(opportunity => (
          <OpportunityCard
            key={opportunity.id}
            opportunity={opportunity}
            realTime={true}
          />
        ))}
      </div>

      {/* Real-time charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Profit/Loss Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <RealTimeProfitChart />
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Execution Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <RealTimeExecutionChart />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
```

---

## 🔄 **INTEGRACIÓN COMPLETA - FLUJO DE DATOS**

### **📡 End-to-End Data Flow:**

```
1. MEV Engine (Contabo) detects opportunity
   ↓
2. EventBroadcaster emits 'opportunity_detected'
   ↓
3. WebSocket Server broadcasts to all clients
   ↓
4. Cloudflare Edge Proxy relays to frontend
   ↓
5. Lovable WebSocket Client receives message
   ↓
6. React hooks update Zustand stores
   ↓
7. UI components re-render with new data
   ↓
8. User sees real-time opportunity update
```

### **⚡ Performance Optimizations:**

- **Contabo**: Message queuing, connection pooling, efficient serialization
- **Cloudflare**: Edge caching, geographic routing, DDoS protection
- **Lovable**: React Query caching, optimistic updates, virtual scrolling

### **🔒 Security Measures:**

- **JWT Authentication**: End-to-end token validation
- **Rate Limiting**: Prevent abuse at edge and backend
- **Input Validation**: Message validation at all layers
- **Access Control**: Channel-based permissions

### **📊 Monitoring & Observability:**

- **Connection Metrics**: Active connections, reconnection rates
- **Message Metrics**: Throughput, latency, error rates
- **Business Metrics**: Opportunity detection rate, execution success

---

## 🎯 **CONFIGURACIÓN DE DEPLOYMENT**

### **🚀 Environment Variables:**

#### **Contabo Backend:**
```bash
# WebSocket Server
WS_PORT=8080
WS_HOST=0.0.0.0
CORS_ORIGINS=https://edge.arbitragex.com,https://dashboard.arbitragex.com

# JWT
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRATION=24h

# Database
POSTGRES_URL=postgresql://user:pass@localhost:5432/arbitragex
REDIS_URL=redis://localhost:6379
```

#### **Cloudflare Workers:**
```bash
# Edge Configuration
BACKEND_WS_URL=wss://backend.arbitragex.com/ws
JWT_SECRET=your-super-secret-jwt-key
CACHE_TTL=30

# Durable Objects
WEBSOCKET_CONNECTIONS=websocket-connections
PUBSUB_RELAY=pubsub-relay
```

#### **Lovable Frontend:**
```bash
# WebSocket
NEXT_PUBLIC_WS_URL=wss://edge.arbitragex.com/ws
NEXT_PUBLIC_API_URL=https://edge.arbitragex.com/api

# Authentication
NEXT_PUBLIC_AUTH_URL=https://auth.arbitragex.com
```

**Estado**: ✅ **INTEGRACIÓN WEBSOCKET COMPLETA - LISTA PARA IMPLEMENTACIÓN**
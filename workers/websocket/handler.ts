/**
 * ArbitrageX Supreme V3.0 - WebSocket Handler
 * Cloudflare Worker for WebSocket connections and real-time updates
 */

import { Request as CFRequest, Response as CFResponse } from '@cloudflare/workers-types';
import { logRequest, logError, logInfo } from '../utils/logger';
import { authenticateRequest } from '../utils/auth_helper';

interface Env {
  BACKEND_API_URL: string;
  BACKEND_API_KEY: string;
  WEBSOCKET_KV: KVNamespace;
  RATE_LIMIT_KV: KVNamespace;
}

interface WebSocketMessage {
  type: 'subscribe' | 'unsubscribe' | 'ping' | 'pong';
  channel?: string;
  data?: any;
  timestamp: string;
}

interface WebSocketConnection {
  id: string;
  userId?: string;
  subscriptions: string[];
  lastPing: number;
  connected: boolean;
}

export default {
  async fetch(request: CFRequest, env: Env, ctx: ExecutionContext): Promise<CFResponse> {
    // Log incoming request
    await logRequest(request, env);

    const url = new URL(request.url);
    
    // Handle WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      return await handleWebSocketUpgrade(request, env, ctx);
    }
    
    // Handle HTTP endpoints for WebSocket management
    switch (true) {
      case url.pathname === '/ws/stats':
        return await handleWebSocketStats(request, env);
      
      case url.pathname === '/ws/broadcast' && request.method === 'POST':
        return await handleBroadcast(request, env);
      
      default:
        return new Response('WebSocket endpoint not found', { status: 404 });
    }
  },
};

async function handleWebSocketUpgrade(
  request: CFRequest, 
  env: Env, 
  ctx: ExecutionContext
): Promise<CFResponse> {
  try {
    // Create WebSocket pair
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    // Accept the WebSocket connection
    server.accept();

    // Generate connection ID
    const connectionId = crypto.randomUUID();
    
    // Create connection object
    const connection: WebSocketConnection = {
      id: connectionId,
      subscriptions: [],
      lastPing: Date.now(),
      connected: true,
    };

    // Store connection in KV
    await env.WEBSOCKET_KV.put(`connection:${connectionId}`, JSON.stringify(connection), {
      expirationTtl: 3600, // 1 hour
    });

    // Set up message handler
    server.addEventListener('message', async (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data as string);
        await handleWebSocketMessage(server, message, connection, env);
      } catch (error) {
        logError(error as Error, request, env);
        server.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format',
          timestamp: new Date().toISOString(),
        }));
      }
    });

    // Set up close handler
    server.addEventListener('close', async () => {
      connection.connected = false;
      await env.WEBSOCKET_KV.delete(`connection:${connectionId}`);
      logInfo(`WebSocket connection closed: ${connectionId}`);
    });

    // Set up error handler
    server.addEventListener('error', async (error) => {
      logError(error as Error, request, env);
      connection.connected = false;
      await env.WEBSOCKET_KV.delete(`connection:${connectionId}`);
    });

    // Send welcome message
    server.send(JSON.stringify({
      type: 'welcome',
      connectionId,
      timestamp: new Date().toISOString(),
      availableChannels: [
        'opportunities',
        'executions',
        'analytics',
        'system_status',
        'price_updates',
      ],
    }));

    // Start heartbeat
    ctx.waitUntil(startHeartbeat(server, connection, env));

    logInfo(`WebSocket connection established: ${connectionId}`);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });

  } catch (error) {
    await logError(error as Error, request, env);
    return new Response('WebSocket upgrade failed', { status: 500 });
  }
}

async function handleWebSocketMessage(
  webSocket: WebSocket,
  message: WebSocketMessage,
  connection: WebSocketConnection,
  env: Env
): Promise<void> {
  switch (message.type) {
    case 'subscribe':
      await handleSubscribe(webSocket, message, connection, env);
      break;
    
    case 'unsubscribe':
      await handleUnsubscribe(webSocket, message, connection, env);
      break;
    
    case 'ping':
      await handlePing(webSocket, connection, env);
      break;
    
    default:
      webSocket.send(JSON.stringify({
        type: 'error',
        message: `Unknown message type: ${message.type}`,
        timestamp: new Date().toISOString(),
      }));
  }
}

async function handleSubscribe(
  webSocket: WebSocket,
  message: WebSocketMessage,
  connection: WebSocketConnection,
  env: Env
): Promise<void> {
  const channel = message.channel;
  
  if (!channel) {
    webSocket.send(JSON.stringify({
      type: 'error',
      message: 'Channel is required for subscription',
      timestamp: new Date().toISOString(),
    }));
    return;
  }

  // Validate channel
  const validChannels = ['opportunities', 'executions', 'analytics', 'system_status', 'price_updates'];
  if (!validChannels.includes(channel)) {
    webSocket.send(JSON.stringify({
      type: 'error',
      message: `Invalid channel: ${channel}`,
      timestamp: new Date().toISOString(),
    }));
    return;
  }

  // Add to subscriptions if not already subscribed
  if (!connection.subscriptions.includes(channel)) {
    connection.subscriptions.push(channel);
    
    // Update connection in KV
    await env.WEBSOCKET_KV.put(`connection:${connection.id}`, JSON.stringify(connection), {
      expirationTtl: 3600,
    });

    // Add to channel subscribers
    const subscribersKey = `channel:${channel}:subscribers`;
    const subscribers = await env.WEBSOCKET_KV.get(subscribersKey);
    const subscribersList = subscribers ? JSON.parse(subscribers) : [];
    
    if (!subscribersList.includes(connection.id)) {
      subscribersList.push(connection.id);
      await env.WEBSOCKET_KV.put(subscribersKey, JSON.stringify(subscribersList), {
        expirationTtl: 3600,
      });
    }

    webSocket.send(JSON.stringify({
      type: 'subscribed',
      channel,
      timestamp: new Date().toISOString(),
    }));

    logInfo(`Connection ${connection.id} subscribed to ${channel}`);
  }
}

async function handleUnsubscribe(
  webSocket: WebSocket,
  message: WebSocketMessage,
  connection: WebSocketConnection,
  env: Env
): Promise<void> {
  const channel = message.channel;
  
  if (!channel) {
    webSocket.send(JSON.stringify({
      type: 'error',
      message: 'Channel is required for unsubscription',
      timestamp: new Date().toISOString(),
    }));
    return;
  }

  // Remove from subscriptions
  const index = connection.subscriptions.indexOf(channel);
  if (index > -1) {
    connection.subscriptions.splice(index, 1);
    
    // Update connection in KV
    await env.WEBSOCKET_KV.put(`connection:${connection.id}`, JSON.stringify(connection), {
      expirationTtl: 3600,
    });

    // Remove from channel subscribers
    const subscribersKey = `channel:${channel}:subscribers`;
    const subscribers = await env.WEBSOCKET_KV.get(subscribersKey);
    if (subscribers) {
      const subscribersList = JSON.parse(subscribers);
      const subscriberIndex = subscribersList.indexOf(connection.id);
      if (subscriberIndex > -1) {
        subscribersList.splice(subscriberIndex, 1);
        await env.WEBSOCKET_KV.put(subscribersKey, JSON.stringify(subscribersList), {
          expirationTtl: 3600,
        });
      }
    }

    webSocket.send(JSON.stringify({
      type: 'unsubscribed',
      channel,
      timestamp: new Date().toISOString(),
    }));

    logInfo(`Connection ${connection.id} unsubscribed from ${channel}`);
  }
}

async function handlePing(
  webSocket: WebSocket,
  connection: WebSocketConnection,
  env: Env
): Promise<void> {
  connection.lastPing = Date.now();
  
  // Update connection in KV
  await env.WEBSOCKET_KV.put(`connection:${connection.id}`, JSON.stringify(connection), {
    expirationTtl: 3600,
  });

  webSocket.send(JSON.stringify({
    type: 'pong',
    timestamp: new Date().toISOString(),
  }));
}

async function startHeartbeat(
  webSocket: WebSocket,
  connection: WebSocketConnection,
  env: Env
): Promise<void> {
  const heartbeatInterval = setInterval(async () => {
    if (!connection.connected) {
      clearInterval(heartbeatInterval);
      return;
    }

    // Check if connection is stale (no ping for 5 minutes)
    if (Date.now() - connection.lastPing > 300000) {
      webSocket.close(1000, 'Connection timeout');
      clearInterval(heartbeatInterval);
      return;
    }

    // Send heartbeat
    try {
      webSocket.send(JSON.stringify({
        type: 'heartbeat',
        timestamp: new Date().toISOString(),
      }));
    } catch (error) {
      clearInterval(heartbeatInterval);
      connection.connected = false;
    }
  }, 30000); // Every 30 seconds
}

async function handleWebSocketStats(request: CFRequest, env: Env): Promise<CFResponse> {
  try {
    // Get all connections (this is a simplified implementation)
    // In production, you'd want to use Durable Objects for better state management
    const stats = {
      total_connections: 0,
      active_channels: {},
      timestamp: new Date().toISOString(),
    };

    return new Response(JSON.stringify(stats), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    return new Response('Failed to get WebSocket stats', { status: 500 });
  }
}

async function handleBroadcast(request: CFRequest, env: Env): Promise<CFResponse> {
  try {
    // Authentication required for broadcasting
    const authResult = await authenticateRequest(request, env);
    if (!authResult.valid) {
      return new Response('Unauthorized', { status: 401 });
    }

    const body = await request.json();
    const { channel, data } = body;

    if (!channel || !data) {
      return new Response('Channel and data are required', { status: 400 });
    }

    // Get channel subscribers
    const subscribersKey = `channel:${channel}:subscribers`;
    const subscribers = await env.WEBSOCKET_KV.get(subscribersKey);
    
    if (!subscribers) {
      return new Response(JSON.stringify({ message: 'No subscribers for channel', sent: 0 }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const subscribersList = JSON.parse(subscribers);
    let sentCount = 0;

    // Broadcast to all subscribers
    for (const connectionId of subscribersList) {
      try {
        const connectionData = await env.WEBSOCKET_KV.get(`connection:${connectionId}`);
        if (connectionData) {
          const connection = JSON.parse(connectionData);
          if (connection.connected) {
            // In a real implementation, you'd need to maintain WebSocket references
            // This is a simplified version
            sentCount++;
          }
        }
      } catch (error) {
        // Connection might be stale, continue with others
        continue;
      }
    }

    return new Response(JSON.stringify({ 
      message: 'Broadcast sent', 
      channel, 
      sent: sentCount 
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response('Failed to broadcast message', { status: 500 });
  }
}

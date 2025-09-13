/**
 * 🤖 MULTIAGENT SYSTEM HOOK - ArbitrageX Supreme V3.0
 * 
 * METODOLOGÍA INGENIO PICHICHI S.A.:
 * - Disciplinado: Gestión centralizada del estado multiagente
 * - Organizado: Hooks especializados para cada funcionalidad  
 * - Metodológico: Manejo robusto de errores y reconexiones
 * 
 * FUNCIONALIDADES:
 * ├── Conexión SSE para comunicación en tiempo real
 * ├── Control de workflow (start/stop/pause/resume)
 * ├── Monitoreo de agentes IA y métricas
 * ├── Gestión de configuración y parámetros
 * └── Sistema de notificaciones y alertas
 * 
 * @version 3.0.0 - MULTIAGENT HOOKS
 * @author ArbitrageX Supreme Engineering Team
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// ================================================================
// TYPES
// ================================================================

interface MultiAgentConfig {
  enabled: boolean;
  minProfitThreshold: string;
  maxGasPrice: string;
  slippageTolerance: number;
  aiAgentsEnabled: boolean;
  flashLoanEnabled: boolean;
  autoExecution: boolean;
  maxConcurrentExecutions: number;
  relayUrls: string[];
}

interface AgentMetrics {
  agentId: string;
  name: string;
  type: string;
  status: 'active' | 'idle' | 'processing' | 'error' | 'disabled';
  lastActivity: number;
  processingTimeMs?: number;
  confidence?: number;
  totalProcessed: number;
  successRate: number;
  averageProcessingTime: number;
  error?: string;
}

interface SystemMetrics {
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  successRate: number;
  totalProfitETH: string;
  totalProfitUSD: string;
  averageLatencyMs: number;
  lastExecutionTimestamp: number;
  dailyStats: {
    executionsToday: number;
    profitTodayETH: string;
    profitTodayUSD: string;
  };
  weeklyStats: {
    executionsThisWeek: number;
    profitThisWeekETH: string;
    profitThisWeekUSD: string;
  };
}

interface WorkflowState {
  status: string;
  currentOpportunityId?: string;
  isPaused: boolean;
  executionCount: number;
  uptime: number;
  startedAt: number;
  lastActivity: number;
}

interface SSEMessage {
  type: string;
  payload: any;
  timestamp: number;
}

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: number;
  autoClose?: boolean;
}

// ================================================================
// MULTIAGENT SYSTEM HOOK
// ================================================================

export const useMultiAgentSystem = () => {
  
  // ============================================================
  // STATE MANAGEMENT
  // ============================================================
  
  const [config, setConfig] = useState<MultiAgentConfig>({
    enabled: false,
    minProfitThreshold: '0.001',
    maxGasPrice: '50',
    slippageTolerance: 0.5,
    aiAgentsEnabled: true,
    flashLoanEnabled: true,
    autoExecution: false,
    maxConcurrentExecutions: 5,
    relayUrls: [
      'https://relay.flashbots.net',
      'https://api.edennetwork.io/v1/bundle'
    ]
  });
  
  const [workflowState, setWorkflowState] = useState<WorkflowState>({
    status: 'idle',
    isPaused: false,
    executionCount: 0,
    uptime: 0,
    startedAt: 0,
    lastActivity: 0
  });
  
  const [agentMetrics, setAgentMetrics] = useState<AgentMetrics[]>([
    {
      agentId: 'flashbots-agent',
      name: 'Flashbots Detective',
      type: 'opportunity_detector',
      status: 'idle',
      lastActivity: Date.now(),
      totalProcessed: 0,
      successRate: 0,
      averageProcessingTime: 0
    },
    {
      agentId: 'risk-agent',
      name: 'Risk Guardian',
      type: 'risk_assessor',
      status: 'idle',
      lastActivity: Date.now(),
      totalProcessed: 0,
      successRate: 0,
      averageProcessingTime: 0
    },
    {
      agentId: 'strategy-agent',
      name: 'Strategy Optimizer',
      type: 'strategy_optimizer',
      status: 'idle',
      lastActivity: Date.now(),
      totalProcessed: 0,
      successRate: 0,
      averageProcessingTime: 0
    },
    {
      agentId: 'execution-engine',
      name: 'Rust Execution Engine',
      type: 'executor',
      status: 'idle',
      lastActivity: Date.now(),
      totalProcessed: 0,
      successRate: 0,
      averageProcessingTime: 0
    }
  ]);
  
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics>({
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    successRate: 0,
    totalProfitETH: '0.0',
    totalProfitUSD: '0.00',
    averageLatencyMs: 0,
    lastExecutionTimestamp: 0,
    dailyStats: {
      executionsToday: 0,
      profitTodayETH: '0.0',
      profitTodayUSD: '0.00'
    },
    weeklyStats: {
      executionsThisWeek: 0,
      profitThisWeekETH: '0.0',
      profitThisWeekUSD: '0.00'
    }
  });
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const uptimeIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ============================================================
  // SERVER-SENT EVENTS MANAGEMENT
  // ============================================================
  
  const connectSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }
    
    try {
      console.log('🔗 Connecting to multiagent SSE stream...');
      
      eventSourceRef.current = new EventSource('/api/sse/multiagent');
      
      eventSourceRef.current.onopen = () => {
        setIsConnected(true);
        setConnectionError(null);
        console.log('✅ Connected to multiagent SSE stream');
        
        addNotification({
          type: 'success',
          title: 'System Connected',
          message: 'Successfully connected to multiagent monitoring system',
          autoClose: true
        });
        
        // Clear any pending reconnect timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };
      
      eventSourceRef.current.onmessage = (event) => {
        try {
          const message: SSEMessage = JSON.parse(event.data);
          handleSSEMessage(message);
        } catch (error) {
          console.error('❌ Error parsing SSE message:', error);
        }
      };
      
      eventSourceRef.current.onerror = (error) => {
        console.error('❌ SSE connection error:', error);
        setIsConnected(false);
        setConnectionError('Connection lost. Attempting to reconnect...');
        
        // Attempt reconnection after 5 seconds
        if (!reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('🔄 Attempting SSE reconnection...');
            connectSSE();
          }, 5000);
        }
      };
      
    } catch (error) {
      console.error('❌ Failed to establish SSE connection:', error);
      setConnectionError('Failed to establish connection to monitoring system');
      
      // Retry after 10 seconds on initialization failure
      if (!reconnectTimeoutRef.current) {
        reconnectTimeoutRef.current = setTimeout(connectSSE, 10000);
      }
    }
  }, []);
  
  // Handle incoming SSE messages
  const handleSSEMessage = useCallback((message: SSEMessage) => {
    const { type, payload, timestamp } = message;
    
    switch (type) {
      case 'workflow:state_update':
        setWorkflowState(prev => ({
          ...prev,
          ...payload,
          lastActivity: timestamp
        }));
        break;
        
      case 'agent:metrics_update':
        setAgentMetrics(prev => prev.map(agent =>
          agent.agentId === payload.agentId
            ? { ...agent, ...payload, lastActivity: timestamp }
            : agent
        ));
        break;
        
      case 'system:metrics_update':
        setSystemMetrics(prev => ({
          ...prev,
          ...payload
        }));
        break;
        
      case 'opportunity:detected':
        addNotification({
          type: 'info',
          title: 'New Opportunity',
          message: `${payload.tokens} on ${payload.chain} (+${payload.expectedProfitETH} ETH)`,
          autoClose: true
        });
        break;
        
      case 'execution:success':
        setSystemMetrics(prev => ({
          ...prev,
          successfulExecutions: prev.successfulExecutions + 1,
          totalExecutions: prev.totalExecutions + 1,
          totalProfitETH: (parseFloat(prev.totalProfitETH) + parseFloat(payload.actualProfitETH)).toString(),
          lastExecutionTimestamp: timestamp
        }));
        
        addNotification({
          type: 'success',
          title: 'Execution Successful',
          message: `Profit: ${payload.actualProfitETH} ETH (${payload.latencyMs}ms)`,
          autoClose: true
        });
        break;
        
      case 'execution:failed':
        setSystemMetrics(prev => ({
          ...prev,
          failedExecutions: prev.failedExecutions + 1,
          totalExecutions: prev.totalExecutions + 1
        }));
        
        addNotification({
          type: 'error',
          title: 'Execution Failed',
          message: payload.error || 'Unknown execution error',
          autoClose: false
        });
        break;
        
      case 'system:alert':
        addNotification({
          type: payload.severity === 'high' || payload.severity === 'critical' ? 'error' : 'warning',
          title: `System Alert: ${payload.type}`,
          message: payload.message,
          autoClose: payload.severity === 'low'
        });
        break;
        
      case 'config:updated':
        setConfig(prev => ({ ...prev, ...payload }));
        
        addNotification({
          type: 'info',
          title: 'Configuration Updated',
          message: 'System configuration has been updated successfully',
          autoClose: true
        });
        break;
        
      default:
        console.log('🔔 Unknown SSE message type:', type, payload);
    }
  }, []);

  // ============================================================
  // WORKFLOW CONTROL FUNCTIONS
  // ============================================================
  
  const startArbitrageSystem = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/multiagent/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to start arbitrage system');
      }
      
      const result = await response.json();
      
      setConfig(prev => ({ ...prev, enabled: true }));
      setWorkflowState(prev => ({
        ...prev,
        status: 'running',
        startedAt: Date.now(),
        isPaused: false
      }));
      
      addNotification({
        type: 'success',
        title: 'System Started',
        message: `Arbitrage system started successfully (Workflow ID: ${result.workflowId})`,
        autoClose: true
      });
      
      // Start uptime counter
      if (uptimeIntervalRef.current) {
        clearInterval(uptimeIntervalRef.current);
      }
      
      uptimeIntervalRef.current = setInterval(() => {
        setWorkflowState(prev => ({
          ...prev,
          uptime: Date.now() - prev.startedAt
        }));
      }, 1000);
      
      return result;
      
    } catch (error: any) {
      console.error('❌ Error starting arbitrage system:', error);
      
      addNotification({
        type: 'error',
        title: 'Start Failed',
        message: error.message || 'Failed to start arbitrage system',
        autoClose: false
      });
      
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [config]);
  
  const stopArbitrageSystem = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/multiagent/stop', {
        method: 'POST'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to stop arbitrage system');
      }
      
      setConfig(prev => ({ ...prev, enabled: false }));
      setWorkflowState(prev => ({
        ...prev,
        status: 'stopped',
        isPaused: false
      }));
      
      // Clear uptime counter
      if (uptimeIntervalRef.current) {
        clearInterval(uptimeIntervalRef.current);
        uptimeIntervalRef.current = null;
      }
      
      addNotification({
        type: 'info',
        title: 'System Stopped',
        message: 'Arbitrage system stopped successfully',
        autoClose: true
      });
      
    } catch (error: any) {
      console.error('❌ Error stopping arbitrage system:', error);
      
      addNotification({
        type: 'error',
        title: 'Stop Failed',
        message: error.message || 'Failed to stop arbitrage system',
        autoClose: false
      });
      
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  const pauseWorkflow = useCallback(async () => {
    try {
      const response = await fetch('/api/multiagent/pause', {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error('Failed to pause workflow');
      }
      
      setWorkflowState(prev => ({
        ...prev,
        isPaused: true,
        status: 'paused'
      }));
      
      addNotification({
        type: 'info',
        title: 'Workflow Paused',
        message: 'Arbitrage workflow has been paused',
        autoClose: true
      });
      
    } catch (error: any) {
      console.error('❌ Error pausing workflow:', error);
      
      addNotification({
        type: 'error',
        title: 'Pause Failed',
        message: error.message || 'Failed to pause workflow',
        autoClose: false
      });
      
      throw error;
    }
  }, []);
  
  const resumeWorkflow = useCallback(async () => {
    try {
      const response = await fetch('/api/multiagent/resume', {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error('Failed to resume workflow');
      }
      
      setWorkflowState(prev => ({
        ...prev,
        isPaused: false,
        status: 'running'
      }));
      
      addNotification({
        type: 'success',
        title: 'Workflow Resumed',
        message: 'Arbitrage workflow has been resumed',
        autoClose: true
      });
      
    } catch (error: any) {
      console.error('❌ Error resuming workflow:', error);
      
      addNotification({
        type: 'error',
        title: 'Resume Failed',
        message: error.message || 'Failed to resume workflow',
        autoClose: false
      });
      
      throw error;
    }
  }, []);
  
  const emergencyStop = useCallback(async (reason: string = 'Manual emergency stop from dashboard') => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/multiagent/emergency-stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason })
      });
      
      if (!response.ok) {
        throw new Error('Failed to execute emergency stop');
      }
      
      setConfig(prev => ({ ...prev, enabled: false }));
      setWorkflowState(prev => ({
        ...prev,
        status: 'emergency_stopped',
        isPaused: true
      }));
      
      // Clear uptime counter
      if (uptimeIntervalRef.current) {
        clearInterval(uptimeIntervalRef.current);
        uptimeIntervalRef.current = null;
      }
      
      addNotification({
        type: 'error',
        title: 'EMERGENCY STOP',
        message: `Emergency stop activated: ${reason}`,
        autoClose: false
      });
      
    } catch (error: any) {
      console.error('❌ Error executing emergency stop:', error);
      
      addNotification({
        type: 'error',
        title: 'Emergency Stop Failed',
        message: error.message || 'Failed to execute emergency stop',
        autoClose: false
      });
      
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ============================================================
  // CONFIGURATION MANAGEMENT
  // ============================================================
  
  const updateConfig = useCallback(async (newConfig: Partial<MultiAgentConfig>) => {
    try {
      const response = await fetch('/api/multiagent/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig)
      });
      
      if (!response.ok) {
        throw new Error('Failed to update configuration');
      }
      
      setConfig(prev => ({ ...prev, ...newConfig }));
      
      addNotification({
        type: 'success',
        title: 'Configuration Updated',
        message: 'System configuration updated successfully',
        autoClose: true
      });
      
    } catch (error: any) {
      console.error('❌ Error updating configuration:', error);
      
      addNotification({
        type: 'error',
        title: 'Config Update Failed',
        message: error.message || 'Failed to update configuration',
        autoClose: false
      });
      
      throw error;
    }
  }, []);

  // ============================================================
  // NOTIFICATION MANAGEMENT  
  // ============================================================
  
  const addNotification = useCallback((notification: Omit<Notification, 'id' | 'timestamp'>) => {
    const id = `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newNotification: Notification = {
      ...notification,
      id,
      timestamp: Date.now()
    };
    
    setNotifications(prev => [newNotification, ...prev.slice(0, 19)]); // Keep last 20
    
    // Auto-remove notification if specified
    if (notification.autoClose !== false) {
      setTimeout(() => {
        removeNotification(id);
      }, notification.autoClose === true ? 5000 : 10000);
    }
  }, []);
  
  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id));
  }, []);
  
  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // ============================================================
  // EFFECT HOOKS
  // ============================================================
  
  // Initialize SSE connection
  useEffect(() => {
    connectSSE();
    
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (uptimeIntervalRef.current) {
        clearInterval(uptimeIntervalRef.current);
      }
    };
  }, [connectSSE]);
  
  // Load initial configuration
  useEffect(() => {
    const loadInitialConfig = async () => {
      try {
        const response = await fetch('/api/multiagent/config');
        if (response.ok) {
          const configData = await response.json();
          setConfig(prev => ({ ...prev, ...configData }));
        }
      } catch (error) {
        console.error('❌ Error loading initial configuration:', error);
      }
    };
    
    loadInitialConfig();
  }, []);

  // ============================================================
  // COMPUTED VALUES
  // ============================================================
  
  const systemHealth = {
    overall: isConnected && !connectionError ? 'healthy' : 'unhealthy',
    agents: {
      active: agentMetrics.filter(agent => agent.status === 'active').length,
      total: agentMetrics.length,
      errors: agentMetrics.filter(agent => agent.status === 'error').length
    },
    performance: {
      successRate: systemMetrics.successRate,
      averageLatency: systemMetrics.averageLatencyMs,
      isOptimal: systemMetrics.averageLatencyMs < 300 && systemMetrics.successRate > 90
    }
  };

  // ============================================================
  // RETURN HOOK INTERFACE
  // ============================================================
  
  return {
    // State
    config,
    workflowState,
    agentMetrics,
    systemMetrics,
    notifications,
    isConnected,
    connectionError,
    isLoading,
    systemHealth,
    
    // Control Functions
    startArbitrageSystem,
    stopArbitrageSystem,
    pauseWorkflow,
    resumeWorkflow,
    emergencyStop,
    
    // Configuration
    updateConfig,
    
    // Notifications
    addNotification,
    removeNotification,
    clearAllNotifications,
    
    // Connection Management
    reconnectSSE: connectSSE
  };
};
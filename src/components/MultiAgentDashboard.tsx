/**
 * 🤖 MULTIAGENT DASHBOARD - ArbitrageX Supreme V3.0
 * 
 * METODOLOGÍA INGENIO PICHICHI S.A.:
 * - Disciplinado: Monitoreo en tiempo real de todos los agentes
 * - Organizado: Interface clara para control y supervisión
 * - Metodológico: Métricas detalladas y control granular
 * 
 * FUNCIONALIDADES:
 * ├── Control ON/OFF del sistema de arbitraje
 * ├── Monitoreo de agentes IA en tiempo real
 * ├── Visualización de oportunidades detectadas
 * ├── Métricas de performance y ROI
 * ├── Sistema de alertas y notificaciones
 * └── Control de configuración avanzada
 * 
 * @version 3.0.0 - MULTIAGENT DASHBOARD
 * @author ArbitrageX Supreme Engineering Team
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Play, 
  Pause, 
  AlertTriangle, 
  TrendingUp, 
  Zap, 
  Bot, 
  Shield, 
  Target,
  Activity,
  DollarSign,
  Clock,
  BarChart3,
  Settings,
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2
} from 'lucide-react';

// ================================================================
// TYPES PARA EL DASHBOARD
// ================================================================

interface AgentStatus {
  id: string;
  name: string;
  type: 'flashbots' | 'risk_assessment' | 'strategy_optimizer' | 'rust_engine';
  status: 'active' | 'idle' | 'processing' | 'error' | 'disabled';
  lastActivity: number;
  processingTimeMs?: number;
  confidence?: number;
  error?: string;
}

interface Opportunity {
  id: string;
  timestamp: number;
  tokens: string;
  chain: string;
  expectedProfitETH: string;
  expectedProfitUSD: string;
  status: 'detected' | 'validating' | 'executing' | 'completed' | 'failed' | 'rejected';
  riskScore?: number;
  confidence?: number;
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
  dailyProfitETH: string;
  dailyProfitUSD: string;
}

interface ArbitrageConfig {
  enabled: boolean;
  minProfitThreshold: string;
  maxGasPrice: string;
  slippageTolerance: number;
  aiAgentsEnabled: boolean;
  flashLoanEnabled: boolean;
  autoExecution: boolean;
}

interface WorkflowState {
  status: string;
  currentOpportunity: Opportunity | null;
  isPaused: boolean;
  executionCount: number;
  uptime: number;
}

// ================================================================
// MAIN DASHBOARD COMPONENT
// ================================================================

export const MultiAgentDashboard: React.FC = () => {
  // ============================================================
  // STATE MANAGEMENT
  // ============================================================
  
  const [config, setConfig] = useState<ArbitrageConfig>({
    enabled: false,
    minProfitThreshold: '0.001',
    maxGasPrice: '50',
    slippageTolerance: 0.5,
    aiAgentsEnabled: true,
    flashLoanEnabled: true,
    autoExecution: false
  });
  
  const [workflowState, setWorkflowState] = useState<WorkflowState>({
    status: 'idle',
    currentOpportunity: null,
    isPaused: false,
    executionCount: 0,
    uptime: 0
  });
  
  const [agents, setAgents] = useState<AgentStatus[]>([
    {
      id: 'flashbots-agent',
      name: 'Flashbots Detective',
      type: 'flashbots',
      status: 'idle',
      lastActivity: Date.now()
    },
    {
      id: 'risk-agent',
      name: 'Risk Guardian',
      type: 'risk_assessment',
      status: 'idle', 
      lastActivity: Date.now()
    },
    {
      id: 'strategy-agent',
      name: 'Strategy Optimizer',
      type: 'strategy_optimizer',
      status: 'idle',
      lastActivity: Date.now()
    },
    {
      id: 'rust-engine',
      name: 'Rust Execution Engine',
      type: 'rust_engine',
      status: 'idle',
      lastActivity: Date.now()
    }
  ]);
  
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [metrics, setMetrics] = useState<SystemMetrics>({
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    successRate: 0,
    totalProfitETH: '0.0',
    totalProfitUSD: '0.00',
    averageLatencyMs: 0,
    lastExecutionTimestamp: 0,
    dailyProfitETH: '0.0',
    dailyProfitUSD: '0.00'
  });
  
  const [notifications, setNotifications] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // ============================================================
  // SERVER-SENT EVENTS CONNECTION
  // ============================================================
  
  useEffect(() => {
    let eventSource: EventSource | null = null;
    
    const connectToSSE = () => {
      try {
        // Conectar al SSE handler de Cloudflare Workers
        eventSource = new EventSource('/api/sse/stream');
        
        eventSource.onopen = () => {
          setIsConnected(true);
          setConnectionError(null);
          console.log('🔗 Connected to multiagent SSE stream');
        };
        
        eventSource.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            handleSSEMessage(data);
          } catch (error) {
            console.error('❌ Error parsing SSE message:', error);
          }
        };
        
        eventSource.onerror = (error) => {
          setIsConnected(false);
          setConnectionError('Connection lost. Attempting to reconnect...');
          console.error('❌ SSE connection error:', error);
          
          // Reconectar después de 5 segundos
          setTimeout(connectToSSE, 5000);
        };
        
      } catch (error) {
        setConnectionError('Failed to establish connection');
        console.error('❌ SSE setup error:', error);
      }
    };
    
    connectToSSE();
    
    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);

  // ============================================================
  // SSE MESSAGE HANDLER
  // ============================================================
  
  const handleSSEMessage = useCallback((message: any) => {
    const { type, payload } = message;
    
    switch (type) {
      case 'workflow:started':
        setWorkflowState(prev => ({
          ...prev,
          status: 'running',
          uptime: 0
        }));
        addNotification('🚀 Arbitrage workflow started');
        break;
        
      case 'opportunity:detected':
        const newOpportunity: Opportunity = {
          id: payload.id,
          timestamp: payload.timestamp,
          tokens: `${payload.tokens.tokenA.symbol}/${payload.tokens.tokenB.symbol}`,
          chain: payload.chain,
          expectedProfitETH: payload.expectedProfitETH,
          expectedProfitUSD: payload.expectedProfitUSD,
          status: 'detected',
          confidence: payload.confidence
        };
        
        setOpportunities(prev => [newOpportunity, ...prev.slice(0, 9)]); // Keep last 10
        setWorkflowState(prev => ({ ...prev, currentOpportunity: newOpportunity }));
        
        // Update Flashbots agent status
        setAgents(prev => prev.map(agent => 
          agent.type === 'flashbots' 
            ? { ...agent, status: 'active', lastActivity: Date.now(), confidence: payload.confidence }
            : agent
        ));
        
        addNotification(`💰 New opportunity: ${newOpportunity.tokens} (+${payload.expectedProfitETH} ETH)`);
        break;
        
      case 'opportunity:rejected':
        setOpportunities(prev => 
          prev.map(opp => 
            opp.id === payload.opportunityId 
              ? { ...opp, status: 'rejected' }
              : opp
          )
        );
        
        addNotification(`❌ Opportunity rejected: ${payload.reason}`);
        break;
        
      case 'opportunity:high_risk':
        setOpportunities(prev => 
          prev.map(opp => 
            opp.id === payload.opportunityId 
              ? { ...opp, status: 'rejected', riskScore: payload.riskAssessment.riskScore }
              : opp
          )
        );
        
        // Update Risk agent status
        setAgents(prev => prev.map(agent => 
          agent.type === 'risk_assessment' 
            ? { ...agent, status: 'active', lastActivity: Date.now() }
            : agent
        ));
        
        addNotification(`🚨 High risk opportunity blocked (${(payload.riskAssessment.riskScore * 100).toFixed(1)}%)`);
        break;
        
      case 'execution:success':
        setOpportunities(prev => 
          prev.map(opp => 
            opp.id === payload.opportunityId 
              ? { ...opp, status: 'completed' }
              : opp
          )
        );
        
        // Update metrics
        setMetrics(prev => ({
          ...prev,
          totalExecutions: payload.metrics.totalExecutions,
          successfulExecutions: payload.metrics.successfulExecutions,
          failedExecutions: payload.metrics.failedExecutions,
          successRate: (payload.metrics.successfulExecutions / payload.metrics.totalExecutions * 100),
          totalProfitETH: payload.metrics.totalProfitETH,
          averageLatencyMs: payload.metrics.averageLatencyMs,
          lastExecutionTimestamp: payload.metrics.lastExecutionTimestamp
        }));
        
        setWorkflowState(prev => ({ 
          ...prev, 
          executionCount: payload.metrics.totalExecutions,
          currentOpportunity: null
        }));
        
        addNotification(`✅ Execution successful! Profit: ${payload.actualProfitETH} ETH`);
        break;
        
      case 'execution:failed':
        setOpportunities(prev => 
          prev.map(opp => 
            opp.id === payload.opportunityId 
              ? { ...opp, status: 'failed' }
              : opp
          )
        );
        
        addNotification(`❌ Execution failed: ${payload.error}`);
        break;
        
      case 'agent:status_update':
        setAgents(prev => prev.map(agent => 
          agent.id === payload.agentId 
            ? { 
                ...agent, 
                status: payload.status,
                lastActivity: Date.now(),
                processingTimeMs: payload.processingTimeMs,
                confidence: payload.confidence,
                error: payload.error
              }
            : agent
        ));
        break;
        
      default:
        console.log('🔔 Unknown SSE message type:', type);
    }
  }, []);

  // ============================================================
  // CONTROL FUNCTIONS
  // ============================================================
  
  const toggleArbitrage = async () => {
    try {
      const newEnabled = !config.enabled;
      
      const response = await fetch('/api/arbitrage/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newEnabled })
      });
      
      if (!response.ok) throw new Error('Failed to toggle arbitrage');
      
      setConfig(prev => ({ ...prev, enabled: newEnabled }));
      setWorkflowState(prev => ({ 
        ...prev, 
        status: newEnabled ? 'running' : 'stopped',
        isPaused: !newEnabled
      }));
      
      addNotification(newEnabled ? '▶️ Arbitrage system STARTED' : '⏹️ Arbitrage system STOPPED');
      
    } catch (error) {
      console.error('❌ Error toggling arbitrage:', error);
      addNotification('❌ Failed to toggle arbitrage system');
    }
  };
  
  const pauseWorkflow = async () => {
    try {
      const response = await fetch('/api/workflow/pause', { method: 'POST' });
      if (!response.ok) throw new Error('Failed to pause workflow');
      
      setWorkflowState(prev => ({ ...prev, isPaused: true, status: 'paused' }));
      addNotification('⏸️ Workflow paused');
    } catch (error) {
      console.error('❌ Error pausing workflow:', error);
    }
  };
  
  const resumeWorkflow = async () => {
    try {
      const response = await fetch('/api/workflow/resume', { method: 'POST' });
      if (!response.ok) throw new Error('Failed to resume workflow');
      
      setWorkflowState(prev => ({ ...prev, isPaused: false, status: 'running' }));
      addNotification('▶️ Workflow resumed');
    } catch (error) {
      console.error('❌ Error resuming workflow:', error);
    }
  };
  
  const emergencyStop = async () => {
    try {
      const response = await fetch('/api/workflow/emergency-stop', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Manual emergency stop from dashboard' })
      });
      
      if (!response.ok) throw new Error('Failed to emergency stop');
      
      setConfig(prev => ({ ...prev, enabled: false }));
      setWorkflowState(prev => ({ 
        ...prev, 
        status: 'emergency_stopped',
        isPaused: true 
      }));
      
      addNotification('🚨 EMERGENCY STOP activated');
    } catch (error) {
      console.error('❌ Error emergency stopping:', error);
    }
  };

  // ============================================================
  // UTILITY FUNCTIONS
  // ============================================================
  
  const addNotification = (message: string) => {
    setNotifications(prev => [message, ...prev.slice(0, 4)]); // Keep last 5
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(notif => notif !== message));
    }, 10000);
  };
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': case 'running': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'processing': case 'executing': return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'error': case 'failed': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'paused': return <Pause className="w-4 h-4 text-yellow-500" />;
      default: return <Activity className="w-4 h-4 text-gray-400" />;
    }
  };
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': case 'running': case 'completed': return 'bg-green-500';
      case 'processing': case 'executing': case 'validating': return 'bg-blue-500';
      case 'error': case 'failed': return 'bg-red-500';
      case 'paused': case 'rejected': return 'bg-yellow-500';
      default: return 'bg-gray-400';
    }
  };
  
  const formatUptime = (uptimeMs: number) => {
    const hours = Math.floor(uptimeMs / 3600000);
    const minutes = Math.floor((uptimeMs % 3600000) / 60000);
    const seconds = Math.floor((uptimeMs % 60000) / 1000);
    return `${hours}h ${minutes}m ${seconds}s`;
  };

  // ============================================================
  // RENDER DASHBOARD
  // ============================================================
  
  return (
    <div className="p-6 space-y-6 bg-gradient-to-br from-gray-50 to-gray-100 min-h-screen">
      
      {/* ========================================================== */}
      {/* HEADER WITH MAIN CONTROLS */}
      {/* ========================================================== */}
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Bot className="w-8 h-8 text-blue-600" />
            ArbitrageX Supreme V3.0
            <Badge variant="secondary" className="text-xs">MULTIAGENT</Badge>
          </h1>
          <p className="text-gray-600 mt-1">
            Sistema Autónomo de Arbitraje con Agentes IA • Ingenio Pichichi S.A.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Connection Status */}
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
            <span className="text-sm text-gray-600">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          
          {/* Emergency Stop */}
          <Button 
            variant="destructive" 
            size="sm"
            onClick={emergencyStop}
            disabled={!config.enabled}
          >
            <AlertTriangle className="w-4 h-4 mr-2" />
            Emergency Stop
          </Button>
          
          {/* Main Toggle */}
          <div className="flex items-center gap-3 p-3 bg-white rounded-lg shadow-sm border">
            <Switch
              checked={config.enabled}
              onCheckedChange={toggleArbitrage}
              className="data-[state=checked]:bg-green-600"
            />
            <span className="text-sm font-medium">
              {config.enabled ? 'Sistema Activo' : 'Sistema Inactivo'}
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================== */}
      {/* CONNECTION ERROR ALERT */}  
      {/* ========================================================== */}
      
      {connectionError && (
        <Alert className="border-yellow-200 bg-yellow-50">
          <AlertCircle className="w-4 h-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            {connectionError}
          </AlertDescription>
        </Alert>
      )}

      {/* ========================================================== */}
      {/* SYSTEM OVERVIEW CARDS */}
      {/* ========================================================== */}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Workflow Status */}
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              {getStatusIcon(workflowState.status)}
              Workflow Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Badge className={getStatusColor(workflowState.status)}>
                {workflowState.status.replace('_', ' ').toUpperCase()}
              </Badge>
              <p className="text-xs text-gray-600">
                Executions: {workflowState.executionCount}
              </p>
              <p className="text-xs text-gray-600">
                Uptime: {formatUptime(workflowState.uptime)}
              </p>
            </div>
          </CardContent>
        </Card>
        
        {/* Total Profit */}
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Total Profit
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <p className="text-2xl font-bold text-green-600">
                {parseFloat(metrics.totalProfitETH).toFixed(4)} ETH
              </p>
              <p className="text-sm text-gray-600">
                ${metrics.totalProfitUSD}
              </p>
              <p className="text-xs text-green-600">
                Today: {metrics.dailyProfitETH} ETH
              </p>
            </div>
          </CardContent>
        </Card>
        
        {/* Success Rate */}
        <Card className="border-l-4 border-l-purple-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="w-4 h-4" />
              Success Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-2xl font-bold">
                {metrics.successRate.toFixed(1)}%
              </p>
              <Progress value={metrics.successRate} className="h-2" />
              <p className="text-xs text-gray-600">
                {metrics.successfulExecutions}/{metrics.totalExecutions} executions
              </p>
            </div>
          </CardContent>
        </Card>
        
        {/* Average Latency */}
        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Avg Latency
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <p className="text-2xl font-bold">
                {metrics.averageLatencyMs}ms
              </p>
              <p className="text-xs text-gray-600">
                Target: &lt;300ms
              </p>
              <div className={`w-2 h-2 rounded-full ${metrics.averageLatencyMs < 300 ? 'bg-green-500' : 'bg-red-500'}`} />
            </div>
          </CardContent>
        </Card>
        
      </div>

      {/* ========================================================== */}
      {/* AGENTS MONITORING GRID */}
      {/* ========================================================== */}
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* AI Agents Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5" />
              AI Agents Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {agents.map((agent) => (
                <div key={agent.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(agent.status)}
                    <div>
                      <p className="font-medium text-sm">{agent.name}</p>
                      <p className="text-xs text-gray-600 capitalize">{agent.type.replace('_', ' ')}</p>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${getStatusColor(agent.status).replace('bg-', 'border-')}`}
                    >
                      {agent.status}
                    </Badge>
                    {agent.confidence && (
                      <p className="text-xs text-gray-600 mt-1">
                        Confidence: {(agent.confidence * 100).toFixed(0)}%
                      </p>
                    )}
                    {agent.processingTimeMs && (
                      <p className="text-xs text-gray-600">
                        {agent.processingTimeMs}ms
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        
        {/* Recent Opportunities */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Recent Opportunities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {opportunities.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  No opportunities detected yet...
                </p>
              ) : (
                opportunities.slice(0, 5).map((opp) => (
                  <div key={opp.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{opp.tokens}</p>
                      <p className="text-xs text-gray-600">{opp.chain}</p>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-sm font-medium text-green-600">
                        +{parseFloat(opp.expectedProfitETH).toFixed(4)} ETH
                      </p>
                      <Badge 
                        variant="outline" 
                        className={`text-xs ${getStatusColor(opp.status).replace('bg-', 'border-')}`}
                      >
                        {opp.status}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
        
      </div>

      {/* ========================================================== */}
      {/* CURRENT OPPORTUNITY & WORKFLOW CONTROLS */}
      {/* ========================================================== */}
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Current Opportunity */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Current Opportunity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {workflowState.currentOpportunity ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-bold">
                      {workflowState.currentOpportunity.tokens}
                    </p>
                    <p className="text-sm text-gray-600">
                      {workflowState.currentOpportunity.chain} • ID: {workflowState.currentOpportunity.id.slice(0, 8)}
                    </p>
                  </div>
                  <Badge className={getStatusColor(workflowState.currentOpportunity.status)}>
                    {workflowState.currentOpportunity.status}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-600">Expected Profit (ETH)</p>
                    <p className="text-lg font-bold text-green-600">
                      {workflowState.currentOpportunity.expectedProfitETH}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600">Expected Profit (USD)</p>
                    <p className="text-lg font-bold text-green-600">
                      ${workflowState.currentOpportunity.expectedProfitUSD}
                    </p>
                  </div>
                </div>
                
                {workflowState.currentOpportunity.riskScore && (
                  <div>
                    <p className="text-xs text-gray-600">Risk Score</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Progress value={workflowState.currentOpportunity.riskScore * 100} className="h-2" />
                      <span className="text-sm font-medium">
                        {(workflowState.currentOpportunity.riskScore * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Scanning for opportunities...</p>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Workflow Controls */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Workflow Controls
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              
              {/* Pause/Resume */}
              <div className="flex flex-col gap-2">
                <Button
                  variant={workflowState.isPaused ? "default" : "outline"}
                  onClick={workflowState.isPaused ? resumeWorkflow : pauseWorkflow}
                  disabled={!config.enabled}
                  className="w-full"
                >
                  {workflowState.isPaused ? (
                    <>
                      <Play className="w-4 h-4 mr-2" />
                      Resume Workflow
                    </>
                  ) : (
                    <>
                      <Pause className="w-4 h-4 mr-2" />
                      Pause Workflow
                    </>
                  )}
                </Button>
              </div>
              
              <Separator />
              
              {/* Configuration Toggles */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">AI Agents</span>
                  <Switch
                    checked={config.aiAgentsEnabled}
                    onCheckedChange={(checked) => 
                      setConfig(prev => ({ ...prev, aiAgentsEnabled: checked }))
                    }
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm">Flash Loans</span>
                  <Switch
                    checked={config.flashLoanEnabled}
                    onCheckedChange={(checked) => 
                      setConfig(prev => ({ ...prev, flashLoanEnabled: checked }))
                    }
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm">Auto Execution</span>
                  <Switch
                    checked={config.autoExecution}
                    onCheckedChange={(checked) => 
                      setConfig(prev => ({ ...prev, autoExecution: checked }))
                    }
                  />
                </div>
              </div>
              
              <Separator />
              
              {/* Configuration Values */}
              <div className="space-y-2 text-xs text-gray-600">
                <p>Min Profit: {config.minProfitThreshold} ETH</p>
                <p>Max Gas: {config.maxGasPrice} Gwei</p>
                <p>Slippage: {config.slippageTolerance}%</p>
              </div>
              
            </div>
          </CardContent>
        </Card>
        
      </div>

      {/* ========================================================== */}
      {/* NOTIFICATIONS PANEL */}
      {/* ========================================================== */}
      
      {notifications.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Recent Notifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {notifications.map((notification, index) => (
                <Alert key={index} className="py-2">
                  <AlertDescription className="text-sm">
                    {notification}
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
};
# 📡 ArbitrageX Supreme V3.0 - Backend API Documentation

## 🖥️ **CONTABO Backend API Endpoints**

**Base URL**: `https://your-contabo-ip:8081/api`  
**WebSocket**: `wss://your-contabo-ip:8081/ws`

---

## 🔐 **Authentication**

### **JWT Token Authentication**
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure_password"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "admin",
    "permissions": ["read", "write", "execute"]
  }
}
```

### **API Key Authentication**
```http
GET /api/opportunities
Authorization: Bearer your-jwt-token
X-API-Key: your-api-key
```

---

## 🎯 **MEV Opportunities**

### **Get Live Opportunities**
```http
GET /api/opportunities?limit=100&chain=ethereum&status=pending
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "opportunity_id": "uuid",
      "chain": "ethereum",
      "dex_a": "uniswap_v3",
      "dex_b": "sushiswap",
      "token_pair": "ETH/USDC",
      "price_difference": "0.00245",
      "volume": "10000.50",
      "estimated_profit": "24.50",
      "risk_score": "2.1",
      "timestamp": "2024-09-08T10:30:00Z",
      "expiry_time": "2024-09-08T10:35:00Z",
      "execution_status": "pending"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 100,
    "total": 15420,
    "hasNext": true
  }
}
```

### **Execute Opportunity**
```http
POST /api/opportunities/{opportunityId}/execute
Authorization: Bearer {token}
Content-Type: application/json

{
  "strategy_id": "uuid",
  "max_gas_price": "30000000000",
  "slippage_tolerance": "0.005",
  "confirmation_blocks": 1
}
```

**Response:**
```json
{
  "success": true,
  "execution_id": "uuid",
  "transaction_hash": "0x1234567890abcdef...",
  "estimated_gas": "285000",
  "estimated_profit": "24.50",
  "status": "pending"
}
```

---

## ⚙️ **Strategy Management**

### **Get All Strategies**
```http
GET /api/strategies?active=true
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "strategy_id": "uuid",
      "name": "DEX_ARBITRAGE",
      "type": "arbitrage",
      "is_active": true,
      "parameters": {
        "min_profit": "0.01",
        "max_slippage": "0.005",
        "chains": ["ethereum", "arbitrum", "polygon"]
      },
      "risk_limits": {
        "max_exposure": "1000",
        "max_gas_price": "50000000000"
      },
      "performance_metrics": {
        "total_executions": 2450,
        "success_rate": "94.7%",
        "avg_profit": "15.2",
        "total_profit": "37240.80"
      }
    }
  ]
}
```

### **Update Strategy Configuration**
```http
PUT /api/strategies/{strategyId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "parameters": {
    "min_profit": "0.015",
    "max_slippage": "0.004"
  },
  "risk_limits": {
    "max_exposure": "1500"
  },
  "is_active": true
}
```

---

## 📊 **Execution History**

### **Get Execution History**
```http
GET /api/executions?limit=50&status=completed&strategy_id=uuid
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "execution_id": "uuid",
      "opportunity_id": "uuid",
      "strategy_id": "uuid",
      "transaction_hash": "0x1234567890abcdef...",
      "block_number": 18450892,
      "gas_used": "285432",
      "actual_profit": "23.45",
      "execution_time": 1250,
      "status": "completed",
      "created_at": "2024-09-08T10:32:15Z"
    }
  ]
}
```

### **Get Execution Details**
```http
GET /api/executions/{executionId}
Authorization: Bearer {token}
```

---

## 📈 **Analytics & Performance**

### **Get Performance Metrics**
```http
GET /api/analytics/performance?period=24h&strategy_id=uuid
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "period": "24h",
    "strategy_id": "uuid",
    "metrics": {
      "total_opportunities": 1240,
      "executed_opportunities": 987,
      "success_rate": "94.7%",
      "total_profit": "15420.80",
      "avg_profit_per_execution": "15.62",
      "avg_execution_time": "1.2s",
      "gas_efficiency": "92.3%"
    },
    "hourly_breakdown": [
      {
        "hour": "2024-09-08T10:00:00Z",
        "opportunities": 52,
        "executions": 48,
        "profit": "742.30"
      }
    ]
  }
}
```

### **Get Real-time System Health**
```http
GET /api/analytics/health
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "system_status": "healthy",
    "uptime": "99.94%",
    "services": {
      "searcher_engine": {
        "status": "active",
        "latency_p99": "4.2ms",
        "throughput": "1240/min"
      },
      "database": {
        "status": "active",
        "connections": 45,
        "query_time_avg": "12ms"
      },
      "redis_cache": {
        "status": "active",
        "hit_ratio": "96.8%",
        "memory_usage": "45%"
      }
    },
    "blockchain_connections": [
      {
        "chain": "ethereum",
        "status": "connected",
        "latency": "85ms",
        "block_height": 18450892
      }
    ]
  }
}
```

---

## 🌍 **Blockchain Integration**

### **Get Supported Chains**
```http
GET /api/chains
Authorization: Bearer {token}
```

### **Get Chain Configuration**
```http
GET /api/chains/{chainId}/config
Authorization: Bearer {token}
```

---

## 🔔 **WebSocket Real-time Events**

### **Connection**
```javascript
const ws = new WebSocket('wss://your-contabo-ip:8081/ws/realtime');
ws.onopen = () => {
  // Send authentication
  ws.send(JSON.stringify({
    type: 'authenticate',
    token: 'your-jwt-token'
  }));
};
```

### **Subscribe to Opportunities**
```javascript
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'opportunities',
  filters: {
    chain: 'ethereum',
    min_profit: '10.0'
  }
}));
```

**Real-time Events:**
```json
{
  "type": "opportunity_detected",
  "data": {
    "opportunity_id": "uuid",
    "chain": "ethereum",
    "estimated_profit": "45.20",
    "expiry_time": "2024-09-08T10:35:00Z"
  }
}

{
  "type": "execution_completed",
  "data": {
    "execution_id": "uuid",
    "transaction_hash": "0x...",
    "actual_profit": "43.15",
    "status": "completed"
  }
}

{
  "type": "system_alert",
  "data": {
    "level": "warning",
    "message": "High gas prices detected",
    "timestamp": "2024-09-08T10:32:00Z"
  }
}
```

---

## 🔧 **Rate Limiting**

- **Default**: 1000 requests per 15 minutes per API key
- **Burst**: Up to 100 requests per minute
- **WebSocket**: 50 messages per minute per connection

**Headers:**
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 847
X-RateLimit-Reset: 1694172000
```

---

## ❌ **Error Handling**

### **Error Response Format**
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_BALANCE",
    "message": "Insufficient balance for execution",
    "details": {
      "required": "1000.00",
      "available": "750.50"
    }
  },
  "timestamp": "2024-09-08T10:32:00Z",
  "request_id": "uuid"
}
```

### **Common Error Codes**
- `UNAUTHORIZED`: Invalid or expired token
- `RATE_LIMIT_EXCEEDED`: Rate limit exceeded
- `OPPORTUNITY_EXPIRED`: Opportunity no longer available
- `INSUFFICIENT_BALANCE`: Insufficient funds
- `EXECUTION_FAILED`: Transaction execution failed
- `INVALID_PARAMETERS`: Invalid request parameters
- `CHAIN_UNAVAILABLE`: Blockchain network unavailable

---

## 🚀 **SDK Examples**

### **Node.js Example**
```javascript
const ArbitrageXAPI = require('@arbitragex/sdk');

const client = new ArbitrageXAPI({
  baseURL: 'https://your-contabo-ip:8081/api',
  apiKey: 'your-api-key',
  token: 'your-jwt-token'
});

// Get live opportunities
const opportunities = await client.opportunities.list({
  chain: 'ethereum',
  min_profit: '10.0'
});

// Execute opportunity
const execution = await client.opportunities.execute(
  opportunities[0].opportunity_id,
  {
    strategy_id: 'your-strategy-id',
    slippage_tolerance: '0.005'
  }
);
```

### **Python Example**
```python
from arbitragex import ArbitrageXClient

client = ArbitrageXClient(
    base_url="https://your-contabo-ip:8081/api",
    api_key="your-api-key",
    token="your-jwt-token"
)

# Get opportunities
opportunities = client.opportunities.list(
    chain="ethereum",
    min_profit="10.0"
)

# Execute opportunity
execution = client.opportunities.execute(
    opportunities[0]["opportunity_id"],
    strategy_id="your-strategy-id",
    slippage_tolerance="0.005"
)
```
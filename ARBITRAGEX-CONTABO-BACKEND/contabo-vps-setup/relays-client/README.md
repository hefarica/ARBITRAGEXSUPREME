# ArbitrageX Supreme V3.0 - Multi-Relay Client (relays-client)

## 📖 Descripción

**relays-client** es el componente de envío de bundles MEV de ArbitrageX Supreme V3.0, diseñado para gestionar múltiples relays privados (Flashbots, bloXroute, Eden Network) con failover automático, tracking de inclusión en tiempo real, y enforcement estricto de la **Real-Only Policy**.

## 🏗️ Arquitectura MEV

### Componentes Principales

- **RelayManager**: Gestión completa de múltiples relays con health monitoring
- **BundleEngine**: Motor de envío con failover automático y selección inteligente  
- **InclusionTracker**: Tracking en tiempo real de inclusión de bundles en bloques
- **RelayMetricsService**: Métricas Prometheus específicas para MEV operations

### Relays Soportados

| Relay | Descripción | Chain Principal | Autenticación |
|-------|-------------|-----------------|---------------|
| **Flashbots** | Líder en MEV protection | Ethereum | Private Key |
| **bloXroute** | Max profit routing | Multi-chain | API Key |
| **Eden Network** | Staking-based MEV | Ethereum | Public/API Key |
| **Beaver Build** | Community builder | Ethereum | Public |
| **Titan Builder** | High-performance builder | Ethereum | Public |

## 🚀 Configuración e Inicio

### Desarrollo Local

1. **Preparar variables de entorno:**
```bash
cp .env.development.example .env.development
# CRÍTICO: Configurar RPCs reales y API keys
```

2. **Variables esenciales (Real-Only Policy):**
```bash
# OBLIGATORIOS
RPC_URL_1=https://eth-mainnet.alchemyapi.io/v2/YOUR_KEY
FLASHBOTS_SIGNING_KEY=0x1234...  # Private key para Flashbots
EXECUTION_PRIVATE_KEY=0xabcd...  # Wallet para firmar transacciones

# RECOMENDADOS  
BLOXROUTE_API_KEY=your_key_here
EDEN_API_KEY=your_key_here
```

3. **Iniciar con Docker Compose:**
```bash
docker-compose -f docker-compose.dev.yml up -d
```

4. **Verificar estado:**
```bash
curl http://localhost:3004/health/detailed
```

### Configuración Manual (sin Docker)

```bash
# Instalar dependencias
npm install

# Compilar TypeScript  
npm run build

# Iniciar servidor
npm start
```

## 🔧 API Endpoints

### 📊 Documentación Interactiva
- **Swagger UI**: `http://localhost:3004/docs`

### 📦 Bundle Management

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/bundles/submit` | POST | Enviar bundle MEV a múltiples relays |
| `/bundles/result/:id` | GET | Obtener resultado y tracking de bundle |
| `/bundles/cancel/:id` | DELETE | Cancelar bundle activo |
| `/bundles/active` | GET | Listar bundles activos |

### 🔗 Relay Management

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/relays` | GET | Listar todos los relays configurados |
| `/relays` | POST | Agregar nuevo relay personalizado |
| `/relays/:id` | GET | Obtener información de relay específico |
| `/relays/:id/action` | POST | Habilitar/deshabilitar/resetear relay |

### 🎯 Inclusion Tracking

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/tracking/statistics` | GET | Estadísticas de inclusión global |
| `/tracking/bundle/:id/events` | GET | Eventos de tracking de bundle |
| `/tracking/bundle/:id/force-check` | POST | Forzar verificación de inclusión |

### 📈 Métricas MEV

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/metrics` | GET | Métricas Prometheus |
| `/metrics/report` | GET | Reporte detallado de performance |
| `/metrics/top-relays` | GET | Ranking de relays por performance |

## 📝 Ejemplos de Uso

### Enviar Bundle de Arbitraje DEX

```bash
curl -X POST http://localhost:3004/bundles/submit \
  -H "Content-Type: application/json" \
  -d '{
    "bundle_id": "123e4567-e89b-12d3-a456-426614174000",
    "strategy": "A",
    "chain_id": 1,
    "target_block": 19123456,
    "transactions": [
      {
        "to": "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
        "data": "0x791ac947...",
        "value": "1000000000000000000",
        "gas_limit": "200000",
        "max_fee_per_gas": "50000000000",
        "max_priority_fee_per_gas": "2000000000"
      }
    ],
    "relay_preferences": ["flashbots", "bloxroute", "eden"],
    "min_relay_count": 2,
    "mev_protection": true,
    "timeout_seconds": 30,
    "real_only": true
  }'
```

### Verificar Estado de Bundle

```bash
# Obtener resultado con tracking events
curl http://localhost:3004/bundles/result/123e4567-e89b-12d3-a456-426614174000

# Forzar verificación de inclusión
curl -X POST http://localhost:3004/tracking/bundle/123e4567-e89b-12d3-a456-426614174000/force-check
```

### Gestionar Relays

```bash
# Listar todos los relays y su estado
curl http://localhost:3004/relays

# Deshabilitar relay temporal
curl -X POST http://localhost:3004/relays/RELAY_ID/action \
  -H "Content-Type: application/json" \
  -d '{"action": "disable"}'

# Agregar relay personalizado
curl -X POST http://localhost:3004/relays \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Custom Builder",
    "type": "beaver", 
    "endpoint": "https://custom-builder.xyz",
    "priority": 7,
    "timeout_ms": 5000
  }'
```

## 📊 Métricas MEV y Monitoreo

### Métricas Prometheus Disponibles

- `relays_client_bundle_submissions_total`: Total bundles por relay y resultado
- `relays_client_bundle_submission_duration_ms`: Duración de submissions
- `relays_client_relay_response_time_ms`: Tiempo de respuesta por relay
- `relays_client_relay_success_rate_percentage`: Tasa de éxito por relay
- `relays_client_bundle_inclusions_total`: Inclusiones por relay y outcome
- `relays_client_inclusion_delay_blocks`: Delay de inclusión en bloques
- `relays_client_relay_health_status`: Estado de salud (1=healthy, 0=unhealthy)

### Dashboard de Performance

```bash
# Obtener top relays por performance
curl http://localhost:3004/metrics/top-relays

# Reporte completo de métricas
curl http://localhost:3004/metrics/report

# Estadísticas de tracking
curl http://localhost:3004/tracking/statistics
```

## 🎯 Configuración por Estrategia

### Estrategia A - DEX Arbitrage
```json
{
  "relay_preferences": ["flashbots", "bloxroute"],
  "min_relay_count": 2,
  "timeout_seconds": 15,
  "mev_protection": true
}
```

### Estrategia F - Flash Loan Arbitrage  
```json
{
  "relay_preferences": ["flashbots", "eden", "bloxroute"],
  "min_relay_count": 3,
  "timeout_seconds": 30,
  "private_mempool_only": true
}
```

## 🔐 Seguridad y Real-Only Policy

### Real-Only Policy Enforcement

- ✅ **Solo RPCs Mainnet**: Validación estricta de chain IDs de producción
- ✅ **Bundles Reales**: Prohibido uso de transacciones mock o simuladas
- ✅ **API Keys Válidas**: Verificación de autenticación con relays reales
- ✅ **Inclusion Tracking**: Monitoreo real de inclusión en blockchain

### Configuración de Seguridad

```bash
# Variables críticas de seguridad
MEV_PROTECTION=true                # Protección MEV obligatoria
PRIVATE_MEMPOOL_ONLY=true         # Solo mempool privado
REAL_ONLY_POLICY=true            # Enforcement Real-Only
CIRCUIT_BREAKER_THRESHOLD=0.1     # 10% success rate mínimo
```

### Manejo de Private Keys

```bash
# DESARROLLO (usar wallets de prueba)
FLASHBOTS_SIGNING_KEY=0x1234...   # Key específica para Flashbots
EXECUTION_PRIVATE_KEY=0xabcd...   # Wallet para firmar txs

# PRODUCCIÓN (usar secret manager)
# Nunca hardcodear keys en variables de entorno
```

## 🏥 Health Checks y Troubleshooting

### Verificar Estado del Sistema

```bash
# Health check básico
curl http://localhost:3004/health

# Health check detallado con relays
curl http://localhost:3004/health/detailed

# Readiness probe
curl http://localhost:3004/health/ready
```

### Diagnóstico de Relays

```bash
# Estado de todos los relays
curl http://localhost:3004/relays | jq '.by_status'

# Performance de relays
curl http://localhost:3004/metrics/top-relays | jq '.top_relays'

# Estadísticas de bundles activos
curl http://localhost:3004/bundles/active | jq '.tracking_statistics'
```

### Problemas Comunes

1. **Bundle Submission Failed**
   - Verificar API keys de relays: `curl /relays`
   - Comprobar RPC connectivity: revisar logs
   - Validar gas prices y limits

2. **Relay Authentication Error**
   - Flashbots: Verificar `FLASHBOTS_SIGNING_KEY`
   - bloXroute: Verificar `BLOXROUTE_API_KEY`
   - Eden: API key opcional pero mejora limits

3. **Bundle Never Included**
   - Verificar tracking: `curl /tracking/bundle/:id/events`
   - Comprobar gas prices competitivas
   - Revisar target block vs current block

4. **High Relay Failures**
   - Revisar circuit breaker: configurar `CIRCUIT_BREAKER_THRESHOLD`
   - Comprobar network connectivity
   - Verificar rate limiting

## 🔄 Failover y Circuit Breaker

### Estrategias de Failover

```bash
# Priority-based (por defecto)
FAILOVER_STRATEGY=priority_based

# Success rate based  
FAILOVER_STRATEGY=success_rate_based

# Response time based
FAILOVER_STRATEGY=response_time_based
```

### Circuit Breaker Configuration

```bash
MAX_CONSECUTIVE_FAILURES=3        # Fallas antes de circuit breaker
CIRCUIT_BREAKER_THRESHOLD=0.1     # 10% success rate mínimo
RECOVERY_TIME_SECONDS=300         # Tiempo para recovery
HEALTH_CHECK_INTERVAL=30          # Health checks cada 30s
```

## 🔄 Integración con Otros Componentes

### Upstream (Recibe de)
- **searcher-rs**: Requests de bundle submission via HTTP
- **sim-ctl**: Bundles simulados y validados para envío

### Downstream (Envía a)
- **Flashbots**: Bundles via eth_sendBundle
- **bloXroute**: Bundles via mev_sendBundle  
- **Eden Network**: Bundles via eth_sendBundle
- **Prometheus**: Métricas de relay performance
- **Redis**: Estado de bundles y tracking events

## 📋 Comandos de Desarrollo

```bash
# Desarrollo con hot reload
npm run dev

# Build de producción
npm run build

# Linting específico MEV
npm run lint
npm run lint:fix

# Docker development
docker-compose -f docker-compose.dev.yml up -d

# Ver logs de relay operations
docker-compose -f docker-compose.dev.yml logs -f relays-client

# Testing de conectividad con mock relay
docker-compose -f docker-compose.dev.yml up mock-relay-server
```

## 🎯 Performance Optimization

### Bundle Submission Optimization

- **Parallel Relay Submission**: Envío simultáneo a múltiples relays
- **Intelligent Failover**: Selección basada en success rate y response time  
- **Circuit Breaker**: Auto-exclude relays con poor performance
- **Retry Logic**: Retry automático con exponential backoff

### Inclusion Rate Optimization

- **Real-time Tracking**: Monitoring de inclusión cada 12 segundos
- **Multi-block Tracking**: Seguimiento hasta 10 bloques post-target
- **Relay Performance Metrics**: Ranking dinámico de relays
- **Gas Price Intelligence**: Análisis de fee market para mejor inclusión

## 🚀 Roadmap MEV

- [ ] **Dynamic Gas Pricing**: Análisis ML de fee market
- [ ] **Cross-Chain Bundles**: Support para bundles multi-chain
- [ ] **Advanced MEV Protection**: Integration con MEV-Share
- [ ] **Flashloan Integration**: Direct integration con Aave Flash Loans
- [ ] **Sandwich Protection**: Advanced anti-sandwich mechanisms

---

**ArbitrageX Supreme V3.0** - Disciplinado, Organizado, Cumplidor  
**MEV-Ready** - Real-Only Policy Enforced
# ArbitrageX Supreme V3.0 - Simulation Controller (sim-ctl)

## 📖 Descripción

**sim-ctl** es el controlador de simulaciones Anvil-Real de ArbitrageX Supreme V3.0, diseñado para gestionar múltiples instancias de Anvil y ejecutar simulaciones de estrategias de arbitraje con datos completamente reales bajo la **Real-Only Policy**.

## 🏗️ Arquitectura

### Componentes Principales

- **AnvilManager**: Gestión completa de instancias Anvil por estrategia
- **SimulationEngine**: Ejecución de simulaciones con análisis de rentabilidad
- **MetricsService**: Sistema de métricas Prometheus y monitoreo
- **Fastify Server**: API REST completa con Swagger documentation

### Estrategias Soportadas

| Estrategia | Descripción | Puertos | Chain por Defecto |
|------------|-------------|---------|-------------------|
| **A** | DEX Arbitrage | 8545-8554 | Ethereum (1) |
| **C** | Cross-Chain Arbitrage | 8555-8564 | Polygon (137) |
| **D** | Lending Arbitrage | 8565-8574 | Arbitrum (42161) |
| **F** | Flash Loan Arbitrage | 8575-8584 | Ethereum (1) |

## 🚀 Configuración e Inicio

### Desarrollo Local

1. **Preparar variables de entorno:**
```bash
cp .env.development.example .env.development
# Editar .env.development con RPCs reales
```

2. **Iniciar con Docker Compose:**
```bash
docker-compose -f docker-compose.dev.yml up -d
```

3. **Verificar estado:**
```bash
curl http://localhost:3002/health/detailed
```

### Configuración Manual (sin Docker)

1. **Instalar dependencias:**
```bash
npm install
```

2. **Instalar Foundry/Anvil:**
```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

3. **Compilar TypeScript:**
```bash
npm run build
```

4. **Iniciar servidor:**
```bash
npm start
```

## 🔧 API Endpoints

### 📊 Documentación Interactiva
- **Swagger UI**: `http://localhost:3002/docs`

### 🔬 Simulaciones

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/simulation/execute` | POST | Ejecutar simulación de arbitraje |
| `/simulation/result/:id` | GET | Obtener resultado de simulación |
| `/simulation/cancel/:id` | DELETE | Cancelar simulación activa |

### 🖥️ Gestión de Instancias

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/instances` | GET | Listar todas las instancias Anvil |
| `/instances` | POST | Crear nueva instancia |
| `/instances/:id` | GET | Obtener instancia específica |
| `/instances/:id/action` | POST | Ejecutar acción (start/stop/restart) |

### 📈 Métricas y Monitoreo

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/metrics` | GET | Métricas Prometheus |
| `/metrics/report` | GET | Reporte detallado de métricas |
| `/metrics/performance` | GET | Summary de performance |

### 💚 Health Checks

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/health` | GET | Health check básico |
| `/health/detailed` | GET | Health check detallado con servicios |
| `/health/ready` | GET | Readiness probe (Kubernetes) |

## 📝 Ejemplo de Uso

### Ejecutar Simulación DEX Arbitrage

```bash
curl -X POST http://localhost:3002/simulation/execute \\
  -H "Content-Type: application/json" \\
  -d '{
    "simulation_id": "123e4567-e89b-12d3-a456-426614174000",
    "strategy": "A",
    "chain_id": 1,
    "transactions": [
      {
        "to": "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
        "data": "0x...",
        "value": "0",
        "gas_limit": "200000"
      }
    ],
    "timeout_seconds": 60,
    "real_only": true
  }'
```

### Crear Instancia Anvil para Estrategia C

```bash
curl -X POST http://localhost:3002/instances \\
  -H "Content-Type: application/json" \\
  -d '{
    "strategy": "C",
    "chain_id": 137
  }'
```

### Obtener Métricas de Performance

```bash
curl http://localhost:3002/metrics/performance
```

## ⚙️ Configuración de Variables de Entorno

### Variables Críticas (Real-Only Policy)

```bash
# RPCs Reales - OBLIGATORIOS
RPC_URL_1=https://eth-mainnet.alchemyapi.io/v2/YOUR_KEY
RPC_URL_137=https://polygon-mainnet.alchemyapi.io/v2/YOUR_KEY
RPC_URL_42161=https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY
RPC_URL_10=https://opt-mainnet.g.alchemy.com/v2/YOUR_KEY

# Redis Connection
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=2

# Server Configuration  
PORT=3002
HOST=0.0.0.0
LOG_LEVEL=info
```

## 📊 Métricas y Monitoreo

### Métricas Prometheus Disponibles

- `sim_ctl_simulations_total`: Total de simulaciones por estrategia
- `sim_ctl_simulation_duration_ms`: Duración de simulaciones
- `sim_ctl_simulation_gas_used`: Gas usado en simulaciones
- `sim_ctl_active_instances`: Instancias Anvil activas
- `sim_ctl_simulation_errors_total`: Errores por estrategia
- `sim_ctl_simulation_profit_eth`: Profit en ETH por simulación
- `sim_ctl_instance_health`: Estado de salud de instancias

### Integración con Grafana

Las métricas están listas para ser consumidas por Prometheus y visualizadas en Grafana usando los dashboards del stack de observabilidad.

## 🏥 Health Checks y Troubleshooting

### Verificar Estado del Sistema

```bash
# Health check básico
curl http://localhost:3002/health

# Health check detallado
curl http://localhost:3002/health/detailed

# Readiness probe
curl http://localhost:3002/health/ready
```

### Logs y Debugging

```bash
# Ver logs en tiempo real (Docker)
docker logs -f arbitragex-sim-ctl-dev

# Ver métricas de instancias
curl http://localhost:3002/instances | jq '.by_status'

# Ver simulaciones activas  
curl http://localhost:3002/metrics/report | jq '.system'
```

### Problemas Comunes

1. **Instancias Anvil no inician**
   - Verificar que Foundry/Anvil esté instalado: `anvil --version`
   - Comprobar RPCs reales en variables de entorno
   - Revisar logs: `docker logs arbitragex-sim-ctl-dev`

2. **Simulaciones fallan**
   - Validar Real-Only Policy: solo RPCs de mainnet
   - Verificar formato de transacciones
   - Comprobar límites de gas y timeout

3. **Redis connection error**
   - Verificar Redis esté corriendo: `docker ps | grep redis`
   - Comprobar variables REDIS_HOST y REDIS_PORT
   - Testear conexión: `redis-cli -h localhost -p 6382 ping`

## 🔐 Seguridad y Best Practices

### Real-Only Policy Enforcement

- ✅ **Solo RPCs reales**: Mainnet endpoints únicamente
- ✅ **Validación de chains**: Chain IDs de producción
- ✅ **No mocks**: Prohibido usar datos simulados
- ✅ **Auditoría**: Logging completo de todas las operaciones

### Seguridad Operacional

- 🔒 **Usuario no-root** en containers
- 🔒 **Rate limiting** en API endpoints
- 🔒 **CORS configuration** restrictiva
- 🔒 **Input validation** con Zod schemas
- 🔒 **Health checks** para auto-recovery

## 🔄 Integración con Otros Componentes

### Upstream (Recibe de)
- **searcher-rs**: Requests de simulación via HTTP
- **selector-api**: Candidatos pre-filtrados para simular

### Downstream (Envía a)
- **Prometheus**: Métricas de performance
- **Redis**: Cache de resultados y estado
- **Grafana**: Dashboards via Prometheus

## 📋 Comandos de Desarrollo

```bash
# Desarrollo con hot reload
npm run dev

# Build de producción
npm run build

# Linting
npm run lint
npm run lint:fix

# Testing
npm test

# Docker development
docker-compose -f docker-compose.dev.yml up -d

# Docker logs
docker-compose -f docker-compose.dev.yml logs -f sim-ctl
```

## 🎯 Roadmap y Próximas Mejoras

- [ ] **Pool dinámico**: Auto-scaling de instancias Anvil
- [ ] **Simulación paralela**: Ejecución concurrente de múltiples estrategias  
- [ ] **Advanced profitability**: Algoritmos ML para predicción de profit
- [ ] **Cross-chain simulation**: Simulación atómica entre múltiples chains
- [ ] **MEV Protection**: Integración con relays privados para simulación

---

**ArbitrageX Supreme V3.0** - Disciplinado, Organizado, Cumplidor
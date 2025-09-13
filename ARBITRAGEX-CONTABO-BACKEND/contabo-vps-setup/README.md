# ArbitrageX Supreme V3.0 - Contabo VPS Backend

## 🎯 Project Overview
**ArbitrageX Supreme V3.0** es un sistema de trading MEV (Maximal Extractable Value) de alta frecuencia implementado bajo la **política Real-Only**. Este repositorio contiene la arquitectura completa del backend diseñada para despliegue en producción en Contabo VPS.

### 📋 Características Principales
- **Política Real-Only**: Sin simulaciones ni datos mock, solo operaciones con datos reales de producción
- **Sub-200ms de Latencia**: Optimización extrema para ejecución competitiva de MEV
- **Soporte Multi-Cadena**: 20+ blockchains con validación matemática de 13+ estrategias de arbitraje
- **Sistema Anti-Rugpull**: Protección integral contra ataques y manipulaciones
- **Flash Loans Universales**: Capital ilimitado para todas las estrategias mediante flash loans
- **Reconciliación PnL**: Sistema avanzado de análisis de varianza sim↔exec con investigación automatizada

## 🏗️ Arquitectura del Sistema

### Componentes Principales

#### 🔍 **Recon** (Puerto 8001)
Sistema de Reconciliación PnL con análisis avanzado de varianza
- **ReconciliationEngine**: Motor de reconciliación sim↔exec
- **VarianceAnalyzer**: Análisis estadístico avanzado con detección de outliers
- **DeviationInvestigator**: Investigación automatizada de causas de varianza
- **API Fastify**: Endpoints RESTful y webhooks para eventos en tiempo real

#### ⏰ **Cron** (Puerto 8005)  
Servicio de Actualizaciones de Datos Programadas
- **TokenPriceUpdater**: Precios de tokens desde múltiples fuentes (CoinGecko, DexScreener)
- **LiquidityPoolUpdater**: Liquidez de pools DEX via subgrafos
- **GasPriceUpdater**: Precios de gas para ejecución óptima
- **JobScheduler**: Programador con prioridades, dependencias y reintentos

#### 📊 **Observability Stack**
Sistema completo de monitoreo y alertas
- **Prometheus**: Métricas y alertas especializadas para trading
- **Grafana**: Dashboards personalizados para MEV y rendimiento
- **Loki**: Agregación centralizada de logs
- **AlertManager**: Gestión avanzada de alertas con canales múltiples

#### ⛽ **Geth** (Puerto 8545/8546)
Nodo Ethereum optimizado para MEV
- Configuración de alta performance para RPC/WebSocket  
- Métricas integradas para monitoreo
- Optimización de caché y memoria para latencia mínima

### 🗄️ Infraestructura Base
- **PostgreSQL 15**: Base de datos principal con esquema optimizado
- **Redis 7**: Cache de alta velocidad y coordinación entre servicios
- **Docker + Compose**: Orquestación containerizada para producción

## 🚀 Despliegue en Contabo VPS

### Requisitos Mínimos del Sistema
- **CPU**: 8 cores / 16 threads (recomendado)
- **RAM**: 16GB (mínimo 8GB)
- **Almacenamiento**: 100GB SSD NVMe
- **Red**: 1Gbps conexión estable
- **OS**: Ubuntu 20.04/22.04 LTS

### Despliegue Rápido

```bash
# 1. Clonar el repositorio
git clone https://github.com/hefarica/ARBITRAGEXSUPREME.git
cd ARBITRAGEXSUPREME/contabo-vps-setup

# 2. Despliegue completo con un comando
sudo ./deploy-arbitragex.sh

# 3. Despliegue por componentes (opcional)
sudo ./deploy-arbitragex.sh --observability-only  # Solo monitoreo
sudo ./deploy-arbitragex.sh --system-only         # Solo ArbitrageX
```

### Configuración Post-Despliegue

1. **Configurar API Keys** en `.env`:
```bash
# Editar configuración
nano .env

# Variables críticas:
COINGECKO_API_KEY=tu_api_key_aqui
ETHERSCAN_API_KEY=tu_api_key_aqui
SLACK_WEBHOOK_URL=tu_webhook_aqui
```

2. **Verificar Estado del Sistema**:
```bash
# Verificar salud de servicios
./deploy-arbitragex.sh --check-health

# Ver logs en tiempo real
docker-compose logs -f recon
docker-compose logs -f cron
```

## 📊 Interfaces de Acceso

### 🔍 Dashboards de Monitoreo
- **Grafana**: `http://TU_VPS_IP:3000`
  - Usuario: `admin` 
  - Contraseña: Ver `GRAFANA_ADMIN_PASSWORD` en `.env`
  
- **Prometheus**: `http://TU_VPS_IP:9090`
- **AlertManager**: `http://TU_VPS_IP:9093`

### 🔌 APIs de ArbitrageX
- **Recon API**: `http://TU_VPS_IP:8001`
  - Health: `/health`
  - Reconciliación: `POST /reconcile`
  - Webhooks: `POST /events/execution`
  
- **Cron Service**: `http://TU_VPS_IP:8005`
  - Health: `/health` 
  - Jobs: `/jobs`
  - Métricas: `/metrics`

### 💾 Infraestructura
- **Geth RPC**: `http://TU_VPS_IP:8545`
- **Geth WebSocket**: `ws://TU_VPS_IP:8546`
- **PostgreSQL**: `TU_VPS_IP:5432`
- **Redis**: `TU_VPS_IP:6379`

## 📋 Gestión Operacional

### Comandos Útiles

```bash
# Gestión de servicios
docker-compose ps                    # Estado de servicios
docker-compose restart recon        # Reiniciar servicio específico
docker-compose logs -f --tail=100   # Logs en tiempo real
docker stats                        # Uso de recursos

# Monitoreo de salud
curl http://localhost:8001/health    # Salud del Recon
curl http://localhost:8005/health    # Salud del Cron
curl http://localhost:8545           # Test Geth RPC

# Base de datos
docker-compose exec postgres psql -U arbitragex -d arbitragex_recon
```

### Alertas Configuradas

#### 🚨 Críticas (Notificación Inmediata)
- **Searcher Latency > 200ms**: Impacto en competitividad MEV
- **Database Down**: Pérdida de datos de reconciliación
- **Geth Sync Lag > 3 blocks**: Datos desactualizados
- **High Variance Rate**: Problemas de integridad de datos

#### ⚠️ Advertencias 
- **Low Profitability Rate < 15%**: Revisión de estrategias
- **High Gas Usage**: Optimización de costos
- **Reconciliation Backlog**: Degradación de performance
- **Memory Usage > 90%**: Riesgo de OOM

### Mantenimiento

#### Actualizaciones
```bash
# Actualizar servicios
docker-compose pull
docker-compose up -d

# Actualizar solo monitoreo
cd observability && ./setup-observability.sh
```

#### Backup
```bash
# Backup automático de PostgreSQL
docker-compose exec postgres pg_dump -U arbitragex arbitragex_recon > backup_$(date +%Y%m%d).sql

# Backup de configuración
tar -czf config_backup_$(date +%Y%m%d).tar.gz .env docker-compose.yml
```

## 🔧 Configuración Avanzada

### Variables de Entorno Clave

```bash
# Performance
MAX_CONCURRENT_JOBS=5                    # Trabajos simultáneos del cron
PRICE_UPDATE_INTERVAL_MINUTES=2         # Frecuencia actualización precios
GAS_UPDATE_INTERVAL_MINUTES=1           # Frecuencia actualización gas

# Blockchain
ENABLED_CHAINS=1,137,56,42161,10         # Cadenas activas
ETH_RPC_URL=http://geth:8545            # RPC Ethereum local

# Alertas
SLACK_WEBHOOK_URL=                       # Webhook Slack
DISCORD_WEBHOOK_URL=                     # Webhook Discord
PAGERDUTY_KEY=                          # Clave PagerDuty
```

### Optimización de Performance

#### Para VPS de 8GB RAM:
```yaml
# docker-compose.override.yml
services:
  geth:
    command: [..., "--cache=1024"]  # Reducir caché Geth
  
  postgres:
    environment:
      - POSTGRES_SHARED_BUFFERS=1GB
      - POSTGRES_EFFECTIVE_CACHE_SIZE=4GB
```

#### Para VPS de 16GB+ RAM:
```yaml
services:
  geth:
    command: [..., "--cache=4096"]  # Maximizar caché Geth
  
  postgres:
    environment:
      - POSTGRES_SHARED_BUFFERS=4GB
      - POSTGRES_EFFECTIVE_CACHE_SIZE=12GB
```

## 🛡️ Seguridad y Hardening

### Firewall Recomendado (ufw)
```bash
# Permitir solo puertos necesarios
ufw allow 22/tcp      # SSH
ufw allow 3000/tcp    # Grafana
ufw allow 8001/tcp    # Recon API  
ufw allow 8005/tcp    # Cron API
ufw allow 8545/tcp    # Geth RPC (opcional, solo si necesario externamente)
ufw enable
```

### SSL/HTTPS Setup
```bash
# Instalar Nginx como proxy reverso
apt install nginx certbot python3-certbot-nginx

# Configurar certificados SSL
certbot --nginx -d tu-dominio.com

# Configuración nginx para servicios
# /etc/nginx/sites-available/arbitragex
```

### Respaldos Automatizados
```bash
# Cron job para backup diario (crontab -e)
0 2 * * * /path/to/backup-script.sh >> /var/log/backup.log 2>&1
```

## 📊 Métricas y KPIs

### Métricas de Trading
- **Profit/Loss en tiempo real** por estrategia y cadena
- **Latencia de ejecución** (objetivo: < 200ms)
- **Tasa de profitabilidad** por oportunidad detectada
- **Varianza sim↔exec** con análisis estadístico

### Métricas de Sistema  
- **Uptime de servicios** (objetivo: 99.9%+)
- **Uso de recursos** (CPU, RAM, disco)
- **Latencia de RPC** por cadena
- **Tasa de errores** por componente

### Alertas de Negocio
- **ROI diario/semanal** por debajo de umbrales
- **Competencia MEV** alta detectada
- **Condiciones de red** adversas
- **Oportunidades perdidas** por latencia

## 🚀 Roadmap y Futuras Mejoras

### V3.1 (Q2 2024)
- [ ] Integración con más relays MEV (Eden, BloXroute)
- [ ] Soporte para Solana y otras chains alternativas  
- [ ] Machine Learning para optimización de estrategias
- [ ] Dashboard mobile para monitoreo 24/7

### V3.2 (Q3 2024)
- [ ] Clustering multi-VPS para alta disponibilidad
- [ ] Integración con DeFi protocols avanzados
- [ ] API pública para terceros
- [ ] Marketplace de estrategias

## 🆘 Soporte y Troubleshooting

### Problemas Comunes

#### Geth no sincroniza
```bash
# Verificar peers y estado de sync
docker-compose exec geth geth attach --exec "admin.peers.length"
docker-compose exec geth geth attach --exec "eth.syncing"

# Reiniciar con snapshot fresco
docker-compose stop geth
docker volume rm arbitragex_geth-data
docker-compose up -d geth
```

#### Alta latencia en reconciliación
```bash
# Verificar conexiones DB
docker-compose exec postgres psql -U arbitragex -c "SELECT * FROM pg_stat_activity;"

# Optimizar índices
docker-compose exec postgres psql -U arbitragex -d arbitragex_recon -c "REINDEX DATABASE arbitragex_recon;"
```

#### Servicios con memoria insuficiente
```bash
# Verificar uso de memoria
docker stats --no-stream

# Ajustar límites en docker-compose.yml
services:
  recon:
    deploy:
      resources:
        limits:
          memory: 2G
```

### Contacto y Soporte
- **GitHub Issues**: [https://github.com/hefarica/ARBITRAGEXSUPREME/issues](https://github.com/hefarica/ARBITRAGEXSUPREME/issues)
- **Documentación**: Ver `/docs` en el repositorio
- **Logs**: Siempre incluir logs relevantes en reportes de bugs

---

## 📄 Licencia
Código propietario - ArbitrageX Team © 2024

**Real-Only Policy**: Este sistema opera exclusivamente con datos de producción reales. No se utilizan simulaciones, mocks o datos sintéticos en el entorno de producción.

---

*Última actualización: 2024-01-15*
*Versión: 3.0.0*  
*Estado: ✅ Producción*
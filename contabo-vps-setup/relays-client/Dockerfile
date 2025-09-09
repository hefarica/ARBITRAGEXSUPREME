# ArbitrageX Supreme V3.0 - Multi-Relay Client (relays-client)
# Multi-stage build para MEV bundle submission optimizada

# ============================================================================
# Stage 1: Build Environment
# ============================================================================
FROM node:20-alpine AS builder

# Instalar dependencias del sistema
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    curl

# Crear directorio de trabajo
WORKDIR /app

# Copiar archivos de configuración
COPY package*.json ./
COPY tsconfig.json ./
COPY .eslintrc.cjs ./

# Instalar dependencias (incluye devDependencies para build)
RUN npm ci --only=production=false

# Copiar código fuente
COPY src/ ./src/

# Compilar TypeScript a JavaScript
RUN npm run build

# Verificar que la compilación fue exitosa
RUN test -d ./dist && echo "✅ Build exitoso" || (echo "❌ Build falló" && exit 1)

# ============================================================================
# Stage 2: Production Runtime Environment  
# ============================================================================
FROM node:20-alpine AS runtime

# Instalar dependencias del sistema para MEV operations
RUN apk add --no-cache \
    curl \
    bash \
    git \
    openssl \
    ca-certificates

# Crear usuario no-root para seguridad
RUN addgroup -g 1001 -S relays && \
    adduser -S relays -u 1001 -G relays

# Crear directorios necesarios
RUN mkdir -p /app/logs /app/data && \
    chown -R relays:relays /app

# Cambiar a usuario no-root
USER relays

WORKDIR /app

# Copiar package.json para instalar solo dependencias de producción
COPY --chown=relays:relays package*.json ./

# Instalar solo dependencias de producción
RUN npm ci --only=production && npm cache clean --force

# Copiar archivos compilados desde build stage
COPY --from=builder --chown=relays:relays /app/dist ./dist

# Copiar otros archivos necesarios
COPY --from=builder --chown=relays:relays /app/tsconfig.json ./

# Configuración de variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=3004
ENV HOST=0.0.0.0
ENV LOG_LEVEL=info
ENV REDIS_HOST=redis
ENV REDIS_PORT=6379
ENV REDIS_DB=0

# MEV-specific environment variables
ENV FAILOVER_STRATEGY=priority_based
ENV MAX_CONSECUTIVE_FAILURES=3
ENV HEALTH_CHECK_INTERVAL=30
ENV CIRCUIT_BREAKER_THRESHOLD=0.1

# Real-Only Policy enforcement
ENV REAL_ONLY_POLICY=true
ENV MEV_PROTECTION=true
ENV PRIVATE_MEMPOOL_ONLY=true

# Health check específico para relay operations
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Exponer puerto
EXPOSE 3004

# Labels para metadata
LABEL \
    org.opencontainers.image.title="ArbitrageX Supreme V3.0 - Multi-Relay Client" \
    org.opencontainers.image.description="Cliente para envío de bundles MEV a múltiples relays (Flashbots/bloXroute/Eden)" \
    org.opencontainers.image.version="3.0.0" \
    org.opencontainers.image.vendor="ArbitrageX Supreme Team" \
    org.opencontainers.image.source="https://github.com/hefarica/ARBITRAGEXSUPREME" \
    arbitragex.component="relays-client" \
    arbitragex.tier="core" \
    arbitragex.real-only="true" \
    arbitragex.mev-ready="true" \
    arbitragex.supported-relays="flashbots,bloxroute,eden,beaver,titan"

# Comando de inicio
CMD ["node", "dist/server.js"]

# ============================================================================
# Stage 3: Development Environment (opcional)
# ============================================================================
FROM runtime AS development

# Cambiar a root temporalmente
USER root

# Instalar herramientas de desarrollo
RUN apk add --no-cache \
    vim \
    htop \
    procps \
    netcat-openbsd

# Volver a usuario relays
USER relays

# Reinstalar todas las dependencias (incluye devDependencies)
RUN npm ci

# Variables de desarrollo
ENV NODE_ENV=development
ENV LOG_LEVEL=debug

# Comando para desarrollo (con hot reload)
CMD ["npm", "run", "dev"]
# ArbitrageX Supreme V3.0 - Simulation Controller (sim-ctl)
# Multi-stage build para optimización de imagen de producción

# ============================================================================
# Stage 1: Build Environment
# ============================================================================
FROM node:20-alpine AS builder

# Instalar dependencias del sistema necesarias para compilación
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git

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

# Instalar Foundry (incluye Anvil) para simulaciones
RUN apk add --no-cache \
    curl \
    bash \
    git \
    && curl -L https://foundry.paradigm.xyz | bash \
    && source ~/.bashrc \
    && foundryup

# Añadir Foundry al PATH
ENV PATH="/root/.foundry/bin:${PATH}"

# Verificar instalación de Anvil
RUN anvil --version || (echo "❌ Error instalando Anvil" && exit 1)

# Crear usuario no-root para seguridad
RUN addgroup -g 1001 -S simctl && \
    adduser -S simctl -u 1001 -G simctl

# Crear directorios necesarios
RUN mkdir -p /app/logs /app/data && \
    chown -R simctl:simctl /app

# Cambiar a usuario no-root
USER simctl

WORKDIR /app

# Copiar package.json para instalar solo dependencias de producción
COPY --chown=simctl:simctl package*.json ./

# Instalar solo dependencias de producción
RUN npm ci --only=production && npm cache clean --force

# Copiar archivos compilados desde build stage
COPY --from=builder --chown=simctl:simctl /app/dist ./dist

# Copiar otros archivos necesarios
COPY --from=builder --chown=simctl:simctl /app/tsconfig.json ./

# Configuración de variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=3002
ENV HOST=0.0.0.0
ENV LOG_LEVEL=info
ENV REDIS_HOST=redis
ENV REDIS_PORT=6379
ENV REDIS_DB=0

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

# Exponer puerto
EXPOSE 3002

# Labels para metadata
LABEL \
    org.opencontainers.image.title="ArbitrageX Supreme V3.0 - Simulation Controller" \
    org.opencontainers.image.description="Anvil-Real Simulation Controller para estrategias de arbitraje" \
    org.opencontainers.image.version="3.0.0" \
    org.opencontainers.image.vendor="ArbitrageX Supreme Team" \
    org.opencontainers.image.source="https://github.com/hefarica/ARBITRAGEXSUPREME" \
    arbitragex.component="sim-ctl" \
    arbitragex.tier="core" \
    arbitragex.real-only="true"

# Comando de inicio
CMD ["node", "dist/server.js"]

# ============================================================================
# Stage 3: Development Environment (opcional)
# ============================================================================
FROM runtime AS development

# Cambiar a root temporalmente para instalar dependencias de desarrollo
USER root

# Instalar dependencias adicionales para desarrollo
RUN apk add --no-cache \
    vim \
    htop \
    procps

# Volver a usuario simctl
USER simctl

# Reinstalar todas las dependencias (incluye devDependencies)
RUN npm ci

# Comando para desarrollo (con hot reload)
CMD ["npm", "run", "dev"]
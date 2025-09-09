# ArbitrageX Supreme V3.0 - Recon Service Dockerfile
# Real-Only Policy - Production-ready container for PnL Reconciliation System

# Use Node.js 20 LTS Alpine for smaller image size and security
FROM node:20-alpine AS base

# Set working directory
WORKDIR /app

# Install system dependencies for native modules and security
RUN apk add --no-cache \
    dumb-init \
    curl \
    ca-certificates \
    && addgroup -g 1001 -S nodejs \
    && adduser -S arbitragex -u 1001

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Development/Build stage
FROM base AS builder

# Install all dependencies (including dev)
RUN npm ci

# Copy source code
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Production stage
FROM base AS production

# Copy built application
COPY --from=builder --chown=arbitragex:nodejs /app/dist ./dist
COPY --from=builder --chown=arbitragex:nodejs /app/node_modules ./node_modules

# Create log directory with proper permissions
RUN mkdir -p /var/log/recon && chown arbitragex:nodejs /var/log/recon

# Health check script
COPY --chown=arbitragex:nodejs <<EOF /usr/local/bin/health-check.sh
#!/bin/sh
exec node dist/index.js --health-check
EOF

RUN chmod +x /usr/local/bin/health-check.sh

# Set environment variables
ENV NODE_ENV=production
ENV RECON_PORT=8001
ENV RECON_HOST=0.0.0.0

# Expose port
EXPOSE 8001

# Switch to non-root user
USER arbitragex

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD /usr/local/bin/health-check.sh

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/index.js"]

# Metadata labels
LABEL maintainer="ArbitrageX Team"
LABEL component="recon"
LABEL version="3.0.0"
LABEL description="PnL Reconciliation System for ArbitrageX Supreme V3.0"
LABEL policy="real-only"
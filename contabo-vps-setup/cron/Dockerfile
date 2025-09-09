# ArbitrageX Supreme V3.0 - Cron Service Dockerfile
# Real-Only Policy - Production-ready container for data updates and scheduling

# Use Node.js 20 LTS Alpine for smaller image size and security
FROM node:20-alpine AS base

# Set working directory
WORKDIR /app

# Install system dependencies for native modules and cron functionality
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
RUN mkdir -p /var/log/arbitragex && chown arbitragex:nodejs /var/log/arbitragex

# Create config directory
RUN mkdir -p /app/config && chown arbitragex:nodejs /app/config

# Health check script
COPY --chown=arbitragex:nodejs <<EOF /usr/local/bin/health-check.sh
#!/bin/sh
# Health check for cron service
curl -f http://localhost:8005/health || exit 1
EOF

RUN chmod +x /usr/local/bin/health-check.sh

# Set environment variables
ENV NODE_ENV=production
ENV CRON_PORT=8005
ENV CRON_HOST=0.0.0.0
ENV CRON_LOG_LEVEL=info

# Expose port
EXPOSE 8005

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
LABEL component="cron"
LABEL version="3.0.0"
LABEL description="Cron Service for ArbitrageX Supreme V3.0 - Data Updates and Scheduling"
LABEL policy="real-only"
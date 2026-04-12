# ── Build Stage ────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Copy dependency manifests first (layer caching optimization)
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# ── Production Stage ──────────────────────────────────────
FROM node:20-alpine AS production
LABEL maintainer="printforge-devops"
LABEL service="product-service"

# Security: run as non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

WORKDIR /app

# Copy production dependencies from builder
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules

# Copy application source
COPY --chown=appuser:appgroup src/ ./src/
COPY --chown=appuser:appgroup package.json ./

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 3001

# Health check — matches K8s probe configuration
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/healthz || exit 1

# Graceful shutdown: Node.js handles SIGTERM
STOPSIGNAL SIGTERM

ENV NODE_ENV=production
ENV PORT=3001

CMD ["node", "src/server.js"]

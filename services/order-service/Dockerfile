# ── Build Stage ────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Copy dependency manifests first (layer caching optimization)
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# ── Production Stage ──────────────────────────────────────
FROM node:20-alpine AS production
LABEL maintainer="printforge-devops"
LABEL service="order-service"

# Install wget for K8s probes (busybox wget)
RUN apk add --no-cache wget

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

EXPOSE 3003

# Health check — matches K8s probe configuration
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3003/healthz || exit 1

# Graceful shutdown: Node.js handles SIGTERM
STOPSIGNAL SIGTERM

ENV NODE_ENV=production
ENV PORT=3003

CMD ["node", "src/server.js"]

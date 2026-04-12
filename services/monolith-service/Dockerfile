# PrintForge Legacy Monolith Dockerfile
# NOTE: This is intentionally less optimized than the K8s service Dockerfiles.
# The monolith predates our containerization best-practices guide.

FROM node:20

# TODO(tech-debt): switch to alpine and multi-stage like the other services
# TODO(tech-debt): add .dockerignore

WORKDIR /app

# Install ALL dependencies (no separate build stage)
COPY package.json package-lock.json* ./
RUN npm install

# Copy everything
COPY . .

# No non-root user setup -- another thing to fix
# TODO(security): add non-root user like the K8s services

EXPOSE 4000

ENV NODE_ENV=production
ENV PORT=4000

# Simple health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD curl -f http://localhost:4000/healthz || exit 1

CMD ["node", "src/server.js"]

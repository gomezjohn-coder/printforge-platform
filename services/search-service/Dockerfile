## Build stage -- install production dependencies only
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev 2>/dev/null || npm install --omit=dev

COPY src/ ./src/

## Runtime stage
FROM node:20-alpine

RUN apk add --no-cache tini curl

# Non-root user
RUN addgroup -S printforge && adduser -S searchsvc -G printforge
WORKDIR /app

COPY --from=builder --chown=searchsvc:printforge /app /app

USER searchsvc

EXPOSE 3002

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3002/healthz || exit 1

ENTRYPOINT ["tini", "--"]
CMD ["node", "src/server.js"]

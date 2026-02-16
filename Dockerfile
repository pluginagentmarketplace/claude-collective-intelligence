# Multi-stage build for optimized Docker image
# Stage 1: Builder
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++ curl

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy application source
COPY . .

# Build if needed (e.g., TypeScript compilation, bundling)
RUN npm run build 2>/dev/null || true

# Stage 2: Runtime
FROM node:20-alpine

WORKDIR /app

# Install runtime dependencies only
RUN apk add --no-cache \
    curl \
    netcat-openbsd \
    bash \
    tini \
    ca-certificates

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy built application from builder
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package*.json ./
COPY --from=builder --chown=nodejs:nodejs /app/src ./src
COPY --from=builder --chown=nodejs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nodejs:nodejs /app/.env.example ./.env.example

# Create directories with proper permissions
RUN mkdir -p logs backups && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT:-3000}/health || exit 1

# Expose port
EXPOSE 3000 5672 6379 5432

# Use tini as init process to handle signals properly
ENTRYPOINT ["/sbin/tini", "--"]

# Default command
CMD ["node", "scripts/orchestrator.js"]

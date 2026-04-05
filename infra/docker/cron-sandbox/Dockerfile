# docker/cron-sandbox/Dockerfile
# Minimal, hardened Node.js container for CRON script execution
# UNI-1730 [C12] — Sandboxing

FROM node:20-alpine

# Create non-root user
RUN addgroup -g 1001 -S cronuser && \
    adduser -u 1001 -S cronuser -G cronuser

WORKDIR /app

# Copy package files and install production deps only
COPY package*.json ./
RUN npm ci --production --ignore-scripts 2>/dev/null || npm install --production --ignore-scripts 2>/dev/null || true

# Copy required scripts
COPY scripts/ ./scripts/
COPY hooks/ ./hooks/ 2>/dev/null || true
COPY agents/ ./agents/ 2>/dev/null || true

# Switch to non-root user
USER cronuser

ENV NODE_ENV=production

# Default entrypoint
CMD ["node", "scripts/cron-entry.js"]

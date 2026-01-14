# ============================================
# Frontend Dockerfile - Optimized Multi-Stage Build
# ============================================
#
# Features:
# - Multi-stage build to reduce final image size (~150MB vs ~1GB)
# - Next.js standalone output for minimal dependencies
# - Non-root user for security
# - Optimized layer caching
# - Production-ready configuration
#
# Build: docker build -t ccw-erp-frontend:latest .
# Run: docker run -p 3000:3000 ccw-erp-frontend:latest
# ============================================

# ============================================
# Stage 1: Dependencies - Install all dependencies
# ============================================
FROM node:20-alpine AS deps

# Check https://github.com/nodejs/docker-node/tree/main/docs/BestPractices.md#node-version
# for best practices

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# ============================================
# Stage 2: Builder - Build the application
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY . .

# Set environment for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build Next.js app with standalone output
RUN pnpm build

# ============================================
# Stage 3: Runtime - Final production image
# ============================================
FROM node:20-alpine AS runtime

WORKDIR /app

# Set environment variables
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy necessary files from builder
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); })"

# Start the application
CMD ["node", "server.js"]

# ============================================
# Stage 4: Development - For local development
# ============================================
FROM node:20-alpine AS development

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install all dependencies (including dev)
RUN pnpm install

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Run development server
CMD ["pnpm", "dev"]

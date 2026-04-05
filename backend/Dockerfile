# CCW-ERP-CRM — Backend Dockerfile (monorepo-aware)
# Build context MUST be the apps/backend directory:
#   docker build -f apps/backend/Dockerfile apps/backend/
# OR use the compose file which sets context: ./apps/backend
#
# uv.lock lives inside apps/backend — no monorepo root needed.
# Multi-stage build for optimised production image.

# ==============================================================================
# Stage 1: Dependencies
# ==============================================================================
FROM python:3.12-slim AS deps

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv (fast Python package installer)
RUN pip install --no-cache-dir uv==0.5.5

# Copy dependency manifest files
COPY pyproject.toml uv.lock ./

# Install production dependencies only (no dev extras)
RUN uv sync --frozen --no-dev

# ==============================================================================
# Stage 2: Runner (Production)
# ==============================================================================
FROM python:3.12-slim AS runner

WORKDIR /app

# Install runtime system deps only
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Re-install uv in runner for CMD usage
RUN pip install --no-cache-dir uv==0.5.5

# Copy installed venv from deps stage
COPY --from=deps /app/.venv /app/.venv

# Copy application source
COPY pyproject.toml uv.lock ./
COPY src/ ./src/

# Ensure the venv is on PATH
ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Create non-root user
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --ingroup appgroup appuser

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

CMD ["uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]

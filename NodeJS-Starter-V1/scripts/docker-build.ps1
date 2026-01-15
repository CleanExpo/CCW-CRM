# ============================================
# Docker Build Script - Build optimized images (PowerShell)
# ============================================
#
# This script builds optimized Docker images for production deployment
#
# Usage:
#   .\scripts\docker-build.ps1 [-NoCache] [-Push] [-Tag "v1.0.0"]
#
# Options:
#   -NoCache    Build without using cache
#   -Push       Push images to registry after building
#   -Tag        Custom tag (default: latest)
# ============================================

param(
    [switch]$NoCache,
    [switch]$Push,
    [string]$Tag = "latest"
)

# Configuration
$REGISTRY = $env:DOCKER_REGISTRY
$IMAGE_PREFIX = if ($env:IMAGE_PREFIX) { $env:IMAGE_PREFIX } else { "ccw-erp" }

# Function to print colored messages
function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Check if Docker is running
try {
    docker info | Out-Null
} catch {
    Write-Error-Custom "Docker is not running. Please start Docker and try again."
    exit 1
}

Write-Info "Starting Docker build process..."
Write-Info "Tag: $Tag"
Write-Info "No cache: $NoCache"
Write-Info "Push: $Push"

# Prepare build args
$NoCacheArg = if ($NoCache) { "--no-cache" } else { "" }

# Build backend image
Write-Info "Building backend image..."
$backendImage = if ($REGISTRY) { "$REGISTRY/$IMAGE_PREFIX-backend:$Tag" } else { "$IMAGE_PREFIX-backend:$Tag" }

$buildCmd = "docker build $NoCacheArg -f apps/backend/Dockerfile.optimized -t $backendImage --target runtime apps/backend"
Invoke-Expression $buildCmd

if ($LASTEXITCODE -eq 0) {
    Write-Info "✓ Backend image built successfully"
} else {
    Write-Error-Custom "Failed to build backend image"
    exit 1
}

# Build frontend image
Write-Info "Building frontend image..."
$frontendImage = if ($REGISTRY) { "$REGISTRY/$IMAGE_PREFIX-frontend:$Tag" } else { "$IMAGE_PREFIX-frontend:$Tag" }

$buildCmd = "docker build $NoCacheArg -f apps/web/Dockerfile -t $frontendImage --target runtime apps/web"
Invoke-Expression $buildCmd

if ($LASTEXITCODE -eq 0) {
    Write-Info "✓ Frontend image built successfully"
} else {
    Write-Error-Custom "Failed to build frontend image"
    exit 1
}

# Display image sizes
Write-Info "Image sizes:"
docker images $backendImage --format "table {{.Repository}}:{{.Tag}}`t{{.Size}}"
docker images $frontendImage --format "table {{.Repository}}:{{.Tag}}`t{{.Size}}"

# Push images if requested
if ($Push) {
    if (-not $REGISTRY) {
        Write-Warn "No registry specified. Set DOCKER_REGISTRY environment variable to push images."
    } else {
        Write-Info "Pushing backend image..."
        docker push $backendImage

        Write-Info "Pushing frontend image..."
        docker push $frontendImage

        Write-Info "✓ Images pushed successfully"
    }
}

Write-Info "✓ Build process completed successfully!"
Write-Info ""
Write-Info "To run the images locally:"
Write-Info "  docker-compose -f docker-compose.prod.yml up -d"
Write-Info ""
Write-Info "To view logs:"
Write-Info "  docker-compose -f docker-compose.prod.yml logs -f"

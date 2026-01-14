#!/bin/bash
# ============================================
# Docker Build Script - Build optimized images
# ============================================
#
# This script builds optimized Docker images for production deployment
#
# Usage:
#   ./scripts/docker-build.sh [--no-cache] [--push]
#
# Options:
#   --no-cache    Build without using cache
#   --push        Push images to registry after building
#   --tag TAG     Custom tag (default: latest)
# ============================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
REGISTRY=${DOCKER_REGISTRY:-""}
IMAGE_PREFIX=${IMAGE_PREFIX:-"ccw-erp"}
TAG=${TAG:-"latest"}
NO_CACHE=""
PUSH=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --no-cache)
      NO_CACHE="--no-cache"
      shift
      ;;
    --push)
      PUSH=true
      shift
      ;;
    --tag)
      TAG="$2"
      shift 2
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      exit 1
      ;;
  esac
done

# Function to print colored messages
log_info() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  log_error "Docker is not running. Please start Docker and try again."
  exit 1
fi

log_info "Starting Docker build process..."
log_info "Tag: $TAG"
log_info "No cache: ${NO_CACHE:-false}"
log_info "Push: $PUSH"

# Build backend image
log_info "Building backend image..."
docker build $NO_CACHE \
  -f apps/backend/Dockerfile.optimized \
  -t ${REGISTRY:+$REGISTRY/}${IMAGE_PREFIX}-backend:${TAG} \
  --target runtime \
  apps/backend

if [ $? -eq 0 ]; then
  log_info "✓ Backend image built successfully"
else
  log_error "Failed to build backend image"
  exit 1
fi

# Build frontend image
log_info "Building frontend image..."
docker build $NO_CACHE \
  -f apps/web/Dockerfile \
  -t ${REGISTRY:+$REGISTRY/}${IMAGE_PREFIX}-frontend:${TAG} \
  --target runtime \
  apps/web

if [ $? -eq 0 ]; then
  log_info "✓ Frontend image built successfully"
else
  log_error "Failed to build frontend image"
  exit 1
fi

# Display image sizes
log_info "Image sizes:"
docker images ${REGISTRY:+$REGISTRY/}${IMAGE_PREFIX}-backend:${TAG} --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}"
docker images ${REGISTRY:+$REGISTRY/}${IMAGE_PREFIX}-frontend:${TAG} --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}"

# Push images if requested
if [ "$PUSH" = true ]; then
  if [ -z "$REGISTRY" ]; then
    log_warn "No registry specified. Set DOCKER_REGISTRY environment variable to push images."
  else
    log_info "Pushing backend image..."
    docker push ${REGISTRY}/${IMAGE_PREFIX}-backend:${TAG}

    log_info "Pushing frontend image..."
    docker push ${REGISTRY}/${IMAGE_PREFIX}-frontend:${TAG}

    log_info "✓ Images pushed successfully"
  fi
fi

log_info "✓ Build process completed successfully!"
log_info ""
log_info "To run the images locally:"
log_info "  docker-compose -f docker-compose.prod.yml up -d"
log_info ""
log_info "To view logs:"
log_info "  docker-compose -f docker-compose.prod.yml logs -f"

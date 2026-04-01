#!/bin/bash
# ============================================
# Kubernetes Deployment Script
# ============================================
#
# This script deploys the CCW-Online ERP system to Kubernetes
#
# Usage:
#   ./scripts/k8s-deploy.sh [--dry-run] [--delete]
#
# Options:
#   --dry-run     Show what would be deployed without actually deploying
#   --delete      Delete all resources
#   --namespace   Specify namespace (default: ccw-erp)
# ============================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="ccw-erp"
DRY_RUN=false
DELETE=false
K8S_DIR="k8s"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --delete)
      DELETE=true
      shift
      ;;
    --namespace)
      NAMESPACE="$2"
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

log_step() {
  echo -e "${BLUE}[STEP]${NC} $1"
}

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
  log_error "kubectl is not installed. Please install kubectl and try again."
  exit 1
fi

# Check if cluster is accessible
if ! kubectl cluster-info &> /dev/null; then
  log_error "Cannot connect to Kubernetes cluster. Please check your kubeconfig."
  exit 1
fi

log_info "Connected to Kubernetes cluster:"
kubectl cluster-info | head -1

# Delete resources if requested
if [ "$DELETE" = true ]; then
  log_warn "Deleting all resources in namespace: $NAMESPACE"
  read -p "Are you sure? (yes/no): " confirm
  if [ "$confirm" = "yes" ]; then
    kubectl delete namespace $NAMESPACE --ignore-not-found=true
    log_info "Resources deleted successfully"
  else
    log_info "Deletion cancelled"
  fi
  exit 0
fi

# Dry run check
DRY_RUN_FLAG=""
if [ "$DRY_RUN" = true ]; then
  DRY_RUN_FLAG="--dry-run=client"
  log_info "DRY RUN MODE - No changes will be made"
fi

# Deploy resources
log_step "Deploying CCW-Online ERP to Kubernetes..."

# 1. Create namespace
log_step "1/10 Creating namespace..."
kubectl apply -f $K8S_DIR/namespace.yaml $DRY_RUN_FLAG

# 2. Create ConfigMap
log_step "2/10 Creating ConfigMap..."
kubectl apply -f $K8S_DIR/configmap.yaml $DRY_RUN_FLAG

# 3. Create Secrets
log_step "3/10 Creating Secrets..."
log_warn "Make sure you've updated secret.yaml with your actual secrets!"
kubectl apply -f $K8S_DIR/secret.yaml $DRY_RUN_FLAG

# 4. Create PersistentVolumeClaims
log_step "4/10 Creating PersistentVolumeClaims..."
kubectl apply -f $K8S_DIR/persistent-volumes.yaml $DRY_RUN_FLAG

# 5. Deploy PostgreSQL
log_step "5/10 Deploying PostgreSQL..."
kubectl apply -f $K8S_DIR/postgres-statefulset.yaml $DRY_RUN_FLAG

# Wait for PostgreSQL to be ready (skip in dry-run)
if [ "$DRY_RUN" = false ]; then
  log_info "Waiting for PostgreSQL to be ready..."
  kubectl wait --for=condition=ready pod -l component=database -n $NAMESPACE --timeout=300s
fi

# 6. Deploy Redis
log_step "6/10 Deploying Redis..."
kubectl apply -f $K8S_DIR/redis-deployment.yaml $DRY_RUN_FLAG

# Wait for Redis to be ready (skip in dry-run)
if [ "$DRY_RUN" = false ]; then
  log_info "Waiting for Redis to be ready..."
  kubectl wait --for=condition=ready pod -l component=cache -n $NAMESPACE --timeout=300s
fi

# 7. Deploy Backend
log_step "7/10 Deploying Backend API..."
kubectl apply -f $K8S_DIR/backend-deployment.yaml $DRY_RUN_FLAG

# 8. Deploy Celery Workers
log_step "8/10 Deploying Celery Workers..."
kubectl apply -f $K8S_DIR/celery-worker-deployment.yaml $DRY_RUN_FLAG

# 9. Deploy Frontend
log_step "9/10 Deploying Frontend..."
kubectl apply -f $K8S_DIR/frontend-deployment.yaml $DRY_RUN_FLAG

# 10. Deploy Ingress
log_step "10/10 Deploying Ingress..."
log_warn "Make sure you've updated ingress.yaml with your domain names!"
kubectl apply -f $K8S_DIR/ingress.yaml $DRY_RUN_FLAG

# Summary
if [ "$DRY_RUN" = false ]; then
  log_info ""
  log_info "✓ Deployment completed successfully!"
  log_info ""
  log_info "Checking deployment status..."
  kubectl get pods -n $NAMESPACE
  log_info ""
  log_info "To view logs:"
  log_info "  kubectl logs -f deployment/backend -n $NAMESPACE"
  log_info "  kubectl logs -f deployment/frontend -n $NAMESPACE"
  log_info ""
  log_info "To access services:"
  log_info "  kubectl port-forward svc/frontend-service 3000:3000 -n $NAMESPACE"
  log_info "  kubectl port-forward svc/backend-service 8000:8000 -n $NAMESPACE"
  log_info ""
  log_info "To view ingress:"
  log_info "  kubectl get ingress -n $NAMESPACE"
else
  log_info ""
  log_info "✓ Dry run completed successfully!"
  log_info "Run without --dry-run to apply changes."
fi

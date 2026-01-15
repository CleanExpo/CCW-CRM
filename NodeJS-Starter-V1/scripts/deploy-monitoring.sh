#!/bin/bash
# ============================================
# Monitoring Stack Deployment Script
# ============================================
#
# This script deploys Prometheus + Grafana to Kubernetes
#
# Usage:
#   ./scripts/deploy-monitoring.sh [--dry-run] [--delete]
#
# Options:
#   --dry-run     Show what would be deployed without actually deploying
#   --delete      Delete all monitoring resources
# ============================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE="monitoring"
DRY_RUN=false
DELETE=false
MONITORING_DIR="k8s/monitoring"

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
  log_warn "Deleting all monitoring resources in namespace: $NAMESPACE"
  read -p "Are you sure? (yes/no): " confirm
  if [ "$confirm" = "yes" ]; then
    kubectl delete namespace $NAMESPACE --ignore-not-found=true
    log_info "Monitoring stack deleted successfully"
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

# Deploy monitoring stack
log_step "Deploying Prometheus + Grafana Monitoring Stack..."

# 1. Create namespace
log_step "1/6 Creating monitoring namespace..."
kubectl apply -f $MONITORING_DIR/namespace.yaml $DRY_RUN_FLAG

# 2. Deploy Prometheus
log_step "2/6 Deploying Prometheus..."
kubectl apply -f $MONITORING_DIR/prometheus-config.yaml $DRY_RUN_FLAG
kubectl apply -f $MONITORING_DIR/prometheus-deployment.yaml $DRY_RUN_FLAG

# Wait for Prometheus to be ready (skip in dry-run)
if [ "$DRY_RUN" = false ]; then
  log_info "Waiting for Prometheus to be ready..."
  kubectl wait --for=condition=ready pod -l app=prometheus -n $NAMESPACE --timeout=300s || true
fi

# 3. Deploy Grafana
log_step "3/6 Deploying Grafana..."
kubectl apply -f $MONITORING_DIR/grafana-deployment.yaml $DRY_RUN_FLAG
kubectl apply -f $MONITORING_DIR/grafana-dashboards.yaml $DRY_RUN_FLAG

# Wait for Grafana to be ready (skip in dry-run)
if [ "$DRY_RUN" = false ]; then
  log_info "Waiting for Grafana to be ready..."
  kubectl wait --for=condition=ready pod -l app=grafana -n $NAMESPACE --timeout=300s || true
fi

# 4. Deploy Ingress
log_step "4/6 Deploying Ingress..."
log_warn "Make sure you've updated domain names in ingress.yaml!"
kubectl apply -f $MONITORING_DIR/ingress.yaml $DRY_RUN_FLAG

# 5. Configure RBAC for Prometheus
log_step "5/6 Configuring RBAC..."
log_info "RBAC already configured in prometheus-deployment.yaml"

# 6. Summary
log_step "6/6 Deployment complete!"

if [ "$DRY_RUN" = false ]; then
  log_info ""
  log_info "✓ Monitoring stack deployed successfully!"
  log_info ""
  log_info "Checking deployment status..."
  kubectl get pods -n $NAMESPACE
  log_info ""
  log_info "Access URLs (after DNS is configured):"
  log_info "  Prometheus: https://prometheus.your-domain.com"
  log_info "  Grafana:    https://grafana.your-domain.com"
  log_info ""
  log_info "Default Grafana credentials:"
  log_info "  Username: admin"
  log_info "  Password: admin (CHANGE THIS IMMEDIATELY!)"
  log_info ""
  log_info "To access locally (port-forward):"
  log_info "  kubectl port-forward svc/prometheus 9090:9090 -n $NAMESPACE"
  log_info "  kubectl port-forward svc/grafana 3000:3000 -n $NAMESPACE"
  log_info ""
  log_info "To view logs:"
  log_info "  kubectl logs -f deployment/prometheus -n $NAMESPACE"
  log_info "  kubectl logs -f deployment/grafana -n $NAMESPACE"
  log_info ""
  log_info "Next steps:"
  log_info "  1. Update domain names in ingress.yaml"
  log_info "  2. Change Grafana admin password"
  log_info "  3. Configure alert notification channels"
  log_info "  4. Import additional dashboards from grafana.com"
else
  log_info ""
  log_info "✓ Dry run completed successfully!"
  log_info "Run without --dry-run to apply changes."
fi

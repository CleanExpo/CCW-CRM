# ============================================
# Monitoring Stack Deployment Script (PowerShell)
# ============================================
#
# This script deploys Prometheus + Grafana to Kubernetes
#
# Usage:
#   .\scripts\deploy-monitoring.ps1 [-DryRun] [-Delete]
#
# Options:
#   -DryRun      Show what would be deployed without actually deploying
#   -Delete      Delete all monitoring resources
# ============================================

param(
    [switch]$DryRun,
    [switch]$Delete
)

$Namespace = "monitoring"
$MonitoringDir = "k8s/monitoring"

# Function to print colored messages
function Write-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Green
}

function Write-Warn-Custom {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-Error-Custom {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Write-Step {
    param([string]$Message)
    Write-Host "[STEP] $Message" -ForegroundColor Blue
}

# Check if kubectl is installed
try {
    kubectl version --client | Out-Null
} catch {
    Write-Error-Custom "kubectl is not installed. Please install kubectl and try again."
    exit 1
}

# Check if cluster is accessible
try {
    kubectl cluster-info | Out-Null
} catch {
    Write-Error-Custom "Cannot connect to Kubernetes cluster. Please check your kubeconfig."
    exit 1
}

Write-Info "Connected to Kubernetes cluster:"
kubectl cluster-info | Select-Object -First 1

# Delete resources if requested
if ($Delete) {
    Write-Warn-Custom "Deleting all monitoring resources in namespace: $Namespace"
    $confirm = Read-Host "Are you sure? (yes/no)"
    if ($confirm -eq "yes") {
        kubectl delete namespace $Namespace --ignore-not-found=true
        Write-Info "Monitoring stack deleted successfully"
    } else {
        Write-Info "Deletion cancelled"
    }
    exit 0
}

# Dry run check
$DryRunFlag = ""
if ($DryRun) {
    $DryRunFlag = "--dry-run=client"
    Write-Info "DRY RUN MODE - No changes will be made"
}

# Deploy monitoring stack
Write-Step "Deploying Prometheus + Grafana Monitoring Stack..."

# 1. Create namespace
Write-Step "1/6 Creating monitoring namespace..."
kubectl apply -f "$MonitoringDir/namespace.yaml" $DryRunFlag

# 2. Deploy Prometheus
Write-Step "2/6 Deploying Prometheus..."
kubectl apply -f "$MonitoringDir/prometheus-config.yaml" $DryRunFlag
kubectl apply -f "$MonitoringDir/prometheus-deployment.yaml" $DryRunFlag

# Wait for Prometheus to be ready (skip in dry-run)
if (-not $DryRun) {
    Write-Info "Waiting for Prometheus to be ready..."
    kubectl wait --for=condition=ready pod -l app=prometheus -n $Namespace --timeout=300s
}

# 3. Deploy Grafana
Write-Step "3/6 Deploying Grafana..."
kubectl apply -f "$MonitoringDir/grafana-deployment.yaml" $DryRunFlag
kubectl apply -f "$MonitoringDir/grafana-dashboards.yaml" $DryRunFlag

# Wait for Grafana to be ready (skip in dry-run)
if (-not $DryRun) {
    Write-Info "Waiting for Grafana to be ready..."
    kubectl wait --for=condition=ready pod -l app=grafana -n $Namespace --timeout=300s
}

# 4. Deploy Ingress
Write-Step "4/6 Deploying Ingress..."
Write-Warn-Custom "Make sure you've updated domain names in ingress.yaml!"
kubectl apply -f "$MonitoringDir/ingress.yaml" $DryRunFlag

# 5. Configure RBAC
Write-Step "5/6 Configuring RBAC..."
Write-Info "RBAC already configured in prometheus-deployment.yaml"

# 6. Summary
Write-Step "6/6 Deployment complete!"

if (-not $DryRun) {
    Write-Info ""
    Write-Info "✓ Monitoring stack deployed successfully!"
    Write-Info ""
    Write-Info "Checking deployment status..."
    kubectl get pods -n $Namespace
    Write-Info ""
    Write-Info "Access URLs (after DNS is configured):"
    Write-Info "  Prometheus: https://prometheus.your-domain.com"
    Write-Info "  Grafana:    https://grafana.your-domain.com"
    Write-Info ""
    Write-Info "Default Grafana credentials:"
    Write-Info "  Username: admin"
    Write-Info "  Password: admin (CHANGE THIS IMMEDIATELY!)"
    Write-Info ""
    Write-Info "To access locally (port-forward):"
    Write-Info "  kubectl port-forward svc/prometheus 9090:9090 -n $Namespace"
    Write-Info "  kubectl port-forward svc/grafana 3000:3000 -n $Namespace"
    Write-Info ""
    Write-Info "To view logs:"
    Write-Info "  kubectl logs -f deployment/prometheus -n $Namespace"
    Write-Info "  kubectl logs -f deployment/grafana -n $Namespace"
    Write-Info ""
    Write-Info "Next steps:"
    Write-Info "  1. Update domain names in ingress.yaml"
    Write-Info "  2. Change Grafana admin password"
    Write-Info "  3. Configure alert notification channels"
    Write-Info "  4. Import additional dashboards from grafana.com"
} else {
    Write-Info ""
    Write-Info "✓ Dry run completed successfully!"
    Write-Info "Run without -DryRun to apply changes."
}

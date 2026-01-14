# ============================================
# Kubernetes Deployment Script (PowerShell)
# ============================================
#
# This script deploys the CCW-Online ERP system to Kubernetes
#
# Usage:
#   .\scripts\k8s-deploy.ps1 [-DryRun] [-Delete] [-Namespace "ccw-erp"]
#
# Options:
#   -DryRun      Show what would be deployed without actually deploying
#   -Delete      Delete all resources
#   -Namespace   Specify namespace (default: ccw-erp)
# ============================================

param(
    [switch]$DryRun,
    [switch]$Delete,
    [string]$Namespace = "ccw-erp"
)

$K8sDir = "k8s"

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
    Write-Warn-Custom "Deleting all resources in namespace: $Namespace"
    $confirm = Read-Host "Are you sure? (yes/no)"
    if ($confirm -eq "yes") {
        kubectl delete namespace $Namespace --ignore-not-found=true
        Write-Info "Resources deleted successfully"
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

# Deploy resources
Write-Step "Deploying CCW-Online ERP to Kubernetes..."

# 1. Create namespace
Write-Step "1/10 Creating namespace..."
kubectl apply -f "$K8sDir/namespace.yaml" $DryRunFlag

# 2. Create ConfigMap
Write-Step "2/10 Creating ConfigMap..."
kubectl apply -f "$K8sDir/configmap.yaml" $DryRunFlag

# 3. Create Secrets
Write-Step "3/10 Creating Secrets..."
Write-Warn-Custom "Make sure you've updated secret.yaml with your actual secrets!"
kubectl apply -f "$K8sDir/secret.yaml" $DryRunFlag

# 4. Create PersistentVolumeClaims
Write-Step "4/10 Creating PersistentVolumeClaims..."
kubectl apply -f "$K8sDir/persistent-volumes.yaml" $DryRunFlag

# 5. Deploy PostgreSQL
Write-Step "5/10 Deploying PostgreSQL..."
kubectl apply -f "$K8sDir/postgres-statefulset.yaml" $DryRunFlag

# Wait for PostgreSQL to be ready (skip in dry-run)
if (-not $DryRun) {
    Write-Info "Waiting for PostgreSQL to be ready..."
    kubectl wait --for=condition=ready pod -l component=database -n $Namespace --timeout=300s
}

# 6. Deploy Redis
Write-Step "6/10 Deploying Redis..."
kubectl apply -f "$K8sDir/redis-deployment.yaml" $DryRunFlag

# Wait for Redis to be ready (skip in dry-run)
if (-not $DryRun) {
    Write-Info "Waiting for Redis to be ready..."
    kubectl wait --for=condition=ready pod -l component=cache -n $Namespace --timeout=300s
}

# 7. Deploy Backend
Write-Step "7/10 Deploying Backend API..."
kubectl apply -f "$K8sDir/backend-deployment.yaml" $DryRunFlag

# 8. Deploy Celery Workers
Write-Step "8/10 Deploying Celery Workers..."
kubectl apply -f "$K8sDir/celery-worker-deployment.yaml" $DryRunFlag

# 9. Deploy Frontend
Write-Step "9/10 Deploying Frontend..."
kubectl apply -f "$K8sDir/frontend-deployment.yaml" $DryRunFlag

# 10. Deploy Ingress
Write-Step "10/10 Deploying Ingress..."
Write-Warn-Custom "Make sure you've updated ingress.yaml with your domain names!"
kubectl apply -f "$K8sDir/ingress.yaml" $DryRunFlag

# Summary
if (-not $DryRun) {
    Write-Info ""
    Write-Info "✓ Deployment completed successfully!"
    Write-Info ""
    Write-Info "Checking deployment status..."
    kubectl get pods -n $Namespace
    Write-Info ""
    Write-Info "To view logs:"
    Write-Info "  kubectl logs -f deployment/backend -n $Namespace"
    Write-Info "  kubectl logs -f deployment/frontend -n $Namespace"
    Write-Info ""
    Write-Info "To access services:"
    Write-Info "  kubectl port-forward svc/frontend-service 3000:3000 -n $Namespace"
    Write-Info "  kubectl port-forward svc/backend-service 8000:8000 -n $Namespace"
    Write-Info ""
    Write-Info "To view ingress:"
    Write-Info "  kubectl get ingress -n $Namespace"
} else {
    Write-Info ""
    Write-Info "✓ Dry run completed successfully!"
    Write-Info "Run without -DryRun to apply changes."
}

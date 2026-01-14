###############################################################################
# Pre-Deployment Validation Script (PowerShell)
#
# Validates that all prerequisites are met before deploying to production.
# Run this script before executing the deployment to catch issues early.
#
# Usage:
#   .\scripts\pre-deployment-check.ps1
#
# Exit codes:
#   0 - All checks passed
#   1 - One or more checks failed
###############################################################################

# Counters
$Script:Passed = 0
$Script:Failed = 0
$Script:Warnings = 0

# Print functions
function Print-Header {
    param([string]$Message)
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Blue
    Write-Host $Message -ForegroundColor Blue
    Write-Host "========================================" -ForegroundColor Blue
    Write-Host ""
}

function Print-Check {
    param([string]$Message)
    Write-Host "→ Checking: $Message" -ForegroundColor Yellow
}

function Print-Success {
    param([string]$Message)
    Write-Host "✓ PASS: $Message" -ForegroundColor Green
    $Script:Passed++
}

function Print-Failure {
    param([string]$Message)
    Write-Host "✗ FAIL: $Message" -ForegroundColor Red
    $Script:Failed++
}

function Print-Warning {
    param([string]$Message)
    Write-Host "⚠ WARNING: $Message" -ForegroundColor Yellow
    $Script:Warnings++
}

function Print-Info {
    param([string]$Message)
    Write-Host "ℹ INFO: $Message" -ForegroundColor Cyan
}

# Check functions
function Check-Command {
    param(
        [string]$Command,
        [string]$Name
    )

    try {
        $version = & $Command --version 2>&1 | Select-Object -First 1
        Print-Success "$Name is installed ($version)"
        return $true
    }
    catch {
        Print-Failure "$Name is not installed"
        return $false
    }
}

function Check-KubectlAccess {
    try {
        $clusterInfo = kubectl cluster-info 2>&1
        if ($LASTEXITCODE -eq 0) {
            $context = kubectl config current-context
            Print-Success "kubectl can access cluster (context: $context)"
            return $true
        }
        else {
            Print-Failure "kubectl cannot access cluster"
            return $false
        }
    }
    catch {
        Print-Failure "kubectl cannot access cluster"
        return $false
    }
}

function Check-KubernetesVersion {
    try {
        $versionOutput = kubectl version --short 2>&1 | Select-String "Server Version"
        $version = ($versionOutput -split "v")[1].Trim()
        $parts = $version -split '\.'
        $major = [int]$parts[0]
        $minor = [int]$parts[1]

        if ($major -ge 1 -and $minor -ge 28) {
            Print-Success "Kubernetes version $version (>= 1.28 required)"
            return $true
        }
        else {
            Print-Failure "Kubernetes version $version is too old (>= 1.28 required)"
            return $false
        }
    }
    catch {
        Print-Failure "Could not determine Kubernetes version"
        return $false
    }
}

function Check-Nodes {
    try {
        $nodes = kubectl get nodes --no-headers 2>&1
        $nodeCount = ($nodes | Measure-Object).Count

        if ($nodeCount -ge 3) {
            Print-Success "$nodeCount nodes available (3+ recommended)"
        }
        elseif ($nodeCount -ge 1) {
            Print-Warning "$nodeCount node(s) available (3+ recommended for production)"
        }
        else {
            Print-Failure "No nodes available"
            return $false
        }

        # Check node readiness
        $readyNodes = ($nodes | Select-String "Ready" | Measure-Object).Count
        if ($readyNodes -eq $nodeCount) {
            Print-Success "All nodes are Ready"
        }
        else {
            Print-Failure "Not all nodes are Ready ($readyNodes/$nodeCount)"
            return $false
        }

        return $true
    }
    catch {
        Print-Failure "Could not check nodes"
        return $false
    }
}

function Check-StorageClass {
    try {
        $storageClasses = kubectl get storageclass --no-headers 2>&1
        $scCount = ($storageClasses | Measure-Object).Count

        if ($scCount -gt 0) {
            $defaultSc = $storageClasses | Select-String "\(default\)"
            if ($defaultSc) {
                $scName = ($defaultSc -split '\s+')[0]
                Print-Success "StorageClass configured (default: $scName)"
            }
            else {
                Print-Warning "StorageClass exists but no default set"
            }
            return $true
        }
        else {
            Print-Failure "No StorageClass configured"
            return $false
        }
    }
    catch {
        Print-Failure "Could not check StorageClass"
        return $false
    }
}

function Check-IngressController {
    try {
        $pods = kubectl get pods -n ingress-nginx --no-headers 2>&1
        if ($pods -match "Running") {
            Print-Success "Nginx Ingress Controller is running"
            return $true
        }
        else {
            Print-Failure "Nginx Ingress Controller is not running"
            Print-Info "Install with: kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.10.0/deploy/static/provider/cloud/deploy.yaml"
            return $false
        }
    }
    catch {
        Print-Failure "Nginx Ingress Controller is not running"
        return $false
    }
}

function Check-CertManager {
    try {
        $pods = kubectl get pods -n cert-manager --no-headers 2>&1
        if ($pods -match "Running") {
            Print-Success "cert-manager is running"
            return $true
        }
        else {
            Print-Failure "cert-manager is not running"
            Print-Info "Install with: kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.14.0/cert-manager.yaml"
            return $false
        }
    }
    catch {
        Print-Failure "cert-manager is not running"
        return $false
    }
}

function Check-MetricsServer {
    try {
        $deployment = kubectl get deployment metrics-server -n kube-system 2>&1
        if ($LASTEXITCODE -eq 0) {
            Print-Success "Metrics Server is installed (required for HPA)"
            return $true
        }
        else {
            Print-Warning "Metrics Server not found (required for HPA)"
            Print-Info "HPA will not work without Metrics Server"
            return $false
        }
    }
    catch {
        Print-Warning "Metrics Server not found (required for HPA)"
        return $false
    }
}

function Check-Namespace {
    try {
        $ns = kubectl get namespace ccw-erp 2>&1
        if ($LASTEXITCODE -eq 0) {
            Print-Warning "Namespace 'ccw-erp' already exists"
        }
        else {
            Print-Success "Namespace 'ccw-erp' does not exist (will be created)"
        }
        return $true
    }
    catch {
        Print-Success "Namespace 'ccw-erp' does not exist (will be created)"
        return $true
    }
}

function Check-DockerImages {
    $backendImage = $env:BACKEND_IMAGE
    if (-not $backendImage) { $backendImage = "your-registry/ccw-erp-backend:latest" }

    $frontendImage = $env:FRONTEND_IMAGE
    if (-not $frontendImage) { $frontendImage = "your-registry/ccw-erp-frontend:latest" }

    Print-Info "Checking Docker images..."
    Print-Info "Backend: $backendImage"
    Print-Info "Frontend: $frontendImage"

    Print-Warning "Remember to push images to registry before deployment"
    return $true
}

function Check-SecretsFile {
    if (Test-Path "k8s\secret.yaml") {
        $content = Get-Content "k8s\secret.yaml" -Raw
        if ($content -match "changeme" -or $content -match "your-") {
            Print-Failure "k8s\secret.yaml contains default values (changeme, your-*)"
            Print-Info "Update secrets with real production values"
            return $false
        }
        else {
            Print-Success "k8s\secret.yaml exists and appears to be configured"
        }
    }
    else {
        Print-Failure "k8s\secret.yaml not found"
        return $false
    }
    return $true
}

function Check-ConfigMapFile {
    if (Test-Path "k8s\configmap.yaml") {
        $content = Get-Content "k8s\configmap.yaml" -Raw
        if ($content -match "your-domain.com") {
            Print-Failure "k8s\configmap.yaml contains default domain (your-domain.com)"
            Print-Info "Update with production domain"
            return $false
        }
        else {
            Print-Success "k8s\configmap.yaml exists and appears to be configured"
        }
    }
    else {
        Print-Failure "k8s\configmap.yaml not found"
        return $false
    }
    return $true
}

function Check-DNS {
    $domain = $env:PRODUCTION_DOMAIN
    if (-not $domain) { $domain = "your-domain.com" }

    if ($domain -eq "your-domain.com") {
        Print-Warning "Production domain not set (`$env:PRODUCTION_DOMAIN='your-domain.com')"
        return $true
    }

    Print-Info "Checking DNS for $domain..."

    try {
        $result = Resolve-DnsName $domain -ErrorAction SilentlyContinue
        if ($result) {
            Print-Success "DNS resolves for $domain"
        }
        else {
            Print-Warning "DNS does not resolve for $domain yet"
            Print-Info "Configure DNS records before deployment"
        }
    }
    catch {
        Print-Warning "DNS does not resolve for $domain yet"
        Print-Info "Configure DNS records before deployment"
    }

    return $true
}

function Check-DiskSpace {
    Print-Info "Checking local disk space..."

    $drive = Get-PSDrive -Name C
    $freeSpace = [math]::Round($drive.Free / 1GB, 2)

    Print-Info "Available disk space: $freeSpace GB"
    return $true
}

# Main execution
function Main {
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════════════╗"
    Write-Host "║     CCW-Online ERP Pre-Deployment Validation Script       ║"
    Write-Host "╚════════════════════════════════════════════════════════════╝"
    Write-Host ""

    Print-Header "1. Checking Required Tools"
    Check-Command "kubectl" "kubectl"
    Check-Command "docker" "Docker"
    $helmInstalled = Check-Command "helm" "Helm"
    if (-not $helmInstalled) {
        Print-Info "Helm is optional but recommended"
    }

    Print-Header "2. Checking Kubernetes Cluster"
    Check-KubectlAccess
    Check-KubernetesVersion
    Check-Nodes

    Print-Header "3. Checking Kubernetes Add-ons"
    Check-StorageClass
    Check-IngressController
    Check-CertManager
    Check-MetricsServer

    Print-Header "4. Checking Configuration Files"
    Check-Namespace
    Check-SecretsFile
    Check-ConfigMapFile

    Print-Header "5. Checking Docker Images"
    Check-DockerImages

    Print-Header "6. Checking DNS Configuration"
    Check-DNS

    Print-Header "7. System Information"
    Check-DiskSpace

    # Print summary
    Print-Header "Validation Summary"
    Write-Host "✓ Passed:   $Script:Passed" -ForegroundColor Green
    Write-Host "✗ Failed:   $Script:Failed" -ForegroundColor Red
    Write-Host "⚠ Warnings: $Script:Warnings" -ForegroundColor Yellow
    Write-Host ""

    if ($Script:Failed -gt 0) {
        Write-Host "❌ Pre-deployment validation FAILED" -ForegroundColor Red
        Write-Host "Please fix the failed checks before deploying to production." -ForegroundColor Red
        Write-Host ""
        exit 1
    }
    elseif ($Script:Warnings -gt 0) {
        Write-Host "⚠️  Pre-deployment validation passed with warnings" -ForegroundColor Yellow
        Write-Host "Review warnings before proceeding." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Press Enter to continue or Ctrl+C to abort..." -ForegroundColor Cyan
        Read-Host
        exit 0
    }
    else {
        Write-Host "✅ Pre-deployment validation PASSED" -ForegroundColor Green
        Write-Host "All checks passed! Ready to deploy to production." -ForegroundColor Green
        Write-Host ""
        exit 0
    }
}

# Run main function
Main

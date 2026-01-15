#!/bin/bash

###############################################################################
# Pre-Deployment Validation Script
#
# Validates that all prerequisites are met before deploying to production.
# Run this script before executing the deployment to catch issues early.
#
# Usage:
#   ./scripts/pre-deployment-check.sh
#
# Exit codes:
#   0 - All checks passed
#   1 - One or more checks failed
###############################################################################

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# Print functions
print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_check() {
    echo -e "${YELLOW}→ Checking: $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ PASS:${NC} $1"
    ((PASSED++))
}

print_failure() {
    echo -e "${RED}✗ FAIL:${NC} $1"
    ((FAILED++))
}

print_warning() {
    echo -e "${YELLOW}⚠ WARNING:${NC} $1"
    ((WARNINGS++))
}

print_info() {
    echo -e "${BLUE}ℹ INFO:${NC} $1"
}

# Check functions
check_command() {
    local cmd=$1
    local name=$2

    if command -v "$cmd" &> /dev/null; then
        local version=$(eval "$cmd --version" 2>&1 | head -n 1)
        print_success "$name is installed ($version)"
        return 0
    else
        print_failure "$name is not installed"
        return 1
    fi
}

check_kubectl_access() {
    if kubectl cluster-info &> /dev/null; then
        local context=$(kubectl config current-context)
        print_success "kubectl can access cluster (context: $context)"
        return 0
    else
        print_failure "kubectl cannot access cluster"
        return 1
    fi
}

check_kubernetes_version() {
    local version=$(kubectl version --short 2>/dev/null | grep "Server Version" | awk '{print $3}' | sed 's/v//')
    local major=$(echo "$version" | cut -d. -f1)
    local minor=$(echo "$version" | cut -d. -f2)

    if [[ $major -ge 1 ]] && [[ $minor -ge 28 ]]; then
        print_success "Kubernetes version $version (>= 1.28 required)"
        return 0
    else
        print_failure "Kubernetes version $version is too old (>= 1.28 required)"
        return 1
    fi
}

check_nodes() {
    local node_count=$(kubectl get nodes --no-headers 2>/dev/null | wc -l)

    if [[ $node_count -ge 3 ]]; then
        print_success "$node_count nodes available (3+ recommended)"
    elif [[ $node_count -ge 1 ]]; then
        print_warning "$node_count node(s) available (3+ recommended for production)"
    else
        print_failure "No nodes available"
        return 1
    fi

    # Check node resources
    local ready_nodes=$(kubectl get nodes --no-headers 2>/dev/null | grep " Ready" | wc -l)
    if [[ $ready_nodes -eq $node_count ]]; then
        print_success "All nodes are Ready"
    else
        print_failure "Not all nodes are Ready ($ready_nodes/$node_count)"
        return 1
    fi

    return 0
}

check_storage_class() {
    local storage_classes=$(kubectl get storageclass --no-headers 2>/dev/null | wc -l)

    if [[ $storage_classes -gt 0 ]]; then
        local default_sc=$(kubectl get storageclass --no-headers 2>/dev/null | grep "(default)" | awk '{print $1}')
        if [[ -n "$default_sc" ]]; then
            print_success "StorageClass configured (default: $default_sc)"
        else
            print_warning "StorageClass exists but no default set"
        fi
        return 0
    else
        print_failure "No StorageClass configured"
        return 1
    fi
}

check_ingress_controller() {
    if kubectl get pods -n ingress-nginx --no-headers 2>/dev/null | grep -q "Running"; then
        print_success "Nginx Ingress Controller is running"
        return 0
    else
        print_failure "Nginx Ingress Controller is not running"
        print_info "Install with: kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.10.0/deploy/static/provider/cloud/deploy.yaml"
        return 1
    fi
}

check_cert_manager() {
    if kubectl get pods -n cert-manager --no-headers 2>/dev/null | grep -q "Running"; then
        print_success "cert-manager is running"
        return 0
    else
        print_failure "cert-manager is not running"
        print_info "Install with: kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.14.0/cert-manager.yaml"
        return 1
    fi
}

check_metrics_server() {
    if kubectl get deployment metrics-server -n kube-system &> /dev/null; then
        print_success "Metrics Server is installed (required for HPA)"
        return 0
    else
        print_warning "Metrics Server not found (required for HPA)"
        print_info "HPA will not work without Metrics Server"
        return 1
    fi
}

check_namespace() {
    if kubectl get namespace ccw-erp &> /dev/null; then
        print_warning "Namespace 'ccw-erp' already exists"
    else
        print_success "Namespace 'ccw-erp' does not exist (will be created)"
    fi
    return 0
}

check_docker_images() {
    local backend_image="${BACKEND_IMAGE:-your-registry/ccw-erp-backend:latest}"
    local frontend_image="${FRONTEND_IMAGE:-your-registry/ccw-erp-frontend:latest}"

    print_info "Checking Docker images..."
    print_info "Backend: $backend_image"
    print_info "Frontend: $frontend_image"

    # Note: Can't actually check without credentials, so just warn
    print_warning "Remember to push images to registry before deployment"
    return 0
}

check_secrets_file() {
    if [[ -f "k8s/secret.yaml" ]]; then
        # Check if secrets are still default/example values
        if grep -q "changeme" "k8s/secret.yaml" || grep -q "your-" "k8s/secret.yaml"; then
            print_failure "k8s/secret.yaml contains default values (changeme, your-*)"
            print_info "Update secrets with real production values"
            return 1
        else
            print_success "k8s/secret.yaml exists and appears to be configured"
        fi
    else
        print_failure "k8s/secret.yaml not found"
        return 1
    fi
    return 0
}

check_configmap_file() {
    if [[ -f "k8s/configmap.yaml" ]]; then
        # Check if domains are still default
        if grep -q "your-domain.com" "k8s/configmap.yaml"; then
            print_failure "k8s/configmap.yaml contains default domain (your-domain.com)"
            print_info "Update with production domain"
            return 1
        else
            print_success "k8s/configmap.yaml exists and appears to be configured"
        fi
    else
        print_failure "k8s/configmap.yaml not found"
        return 1
    fi
    return 0
}

check_dns() {
    local domain="${PRODUCTION_DOMAIN:-your-domain.com}"

    if [[ "$domain" == "your-domain.com" ]]; then
        print_warning "Production domain not set (export PRODUCTION_DOMAIN=your-domain.com)"
        return 0
    fi

    print_info "Checking DNS for $domain..."

    if host "$domain" &> /dev/null; then
        print_success "DNS resolves for $domain"
    else
        print_warning "DNS does not resolve for $domain yet"
        print_info "Configure DNS records before deployment"
    fi

    return 0
}

check_disk_space() {
    print_info "Checking local disk space..."

    local available=$(df -h . | tail -n 1 | awk '{print $4}')
    print_info "Available disk space: $available"

    # Just informational, don't fail
    return 0
}

# Main execution
main() {
    echo ""
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║     CCW-Online ERP Pre-Deployment Validation Script       ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo ""

    print_header "1. Checking Required Tools"
    check_command "kubectl" "kubectl"
    check_command "docker" "Docker"
    check_command "helm" "Helm" || print_info "Helm is optional but recommended"

    print_header "2. Checking Kubernetes Cluster"
    check_kubectl_access
    check_kubernetes_version
    check_nodes

    print_header "3. Checking Kubernetes Add-ons"
    check_storage_class
    check_ingress_controller
    check_cert_manager
    check_metrics_server

    print_header "4. Checking Configuration Files"
    check_namespace
    check_secrets_file
    check_configmap_file

    print_header "5. Checking Docker Images"
    check_docker_images

    print_header "6. Checking DNS Configuration"
    check_dns

    print_header "7. System Information"
    check_disk_space

    # Print summary
    print_header "Validation Summary"
    echo -e "${GREEN}✓ Passed:${NC}   $PASSED"
    echo -e "${RED}✗ Failed:${NC}   $FAILED"
    echo -e "${YELLOW}⚠ Warnings:${NC} $WARNINGS"
    echo ""

    if [[ $FAILED -gt 0 ]]; then
        echo -e "${RED}❌ Pre-deployment validation FAILED${NC}"
        echo -e "${RED}Please fix the failed checks before deploying to production.${NC}"
        echo ""
        exit 1
    elif [[ $WARNINGS -gt 0 ]]; then
        echo -e "${YELLOW}⚠️  Pre-deployment validation passed with warnings${NC}"
        echo -e "${YELLOW}Review warnings before proceeding.${NC}"
        echo ""
        echo -e "${BLUE}Press Enter to continue or Ctrl+C to abort...${NC}"
        read -r
        exit 0
    else
        echo -e "${GREEN}✅ Pre-deployment validation PASSED${NC}"
        echo -e "${GREEN}All checks passed! Ready to deploy to production.${NC}"
        echo ""
        exit 0
    fi
}

# Run main function
main

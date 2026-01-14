# Kubernetes Deployment Guide

**Date:** January 14, 2026
**Status:** Complete ✅
**Component:** Week 7 - Kubernetes Manifests & Auto-Scaling

---

## Overview

This document provides a complete guide for deploying the CCW-Online ERP system to Kubernetes with production-grade configuration including auto-scaling, health checks, and high availability.

**What's Included:**
- Complete Kubernetes manifests for all services
- Horizontal Pod Autoscalers (HPA) for automatic scaling
- Pod Disruption Budgets (PDB) for high availability
- Ingress configuration with TLS
- Automated deployment scripts
- Monitoring and troubleshooting guides

---

## Architecture

### Service Topology

```
┌─────────────────────────────────────────────┐
│             Ingress (Nginx)                  │
│         TLS Termination + Routing            │
└──────────────┬─────────────┬────────────────┘
               │             │
       ┌───────┴──────┐  ┌──┴──────────┐
       │   Frontend   │  │   Backend    │
       │  (Next.js)   │  │  (FastAPI)   │
       │  2-10 pods   │  │  2-10 pods   │
       └──────────────┘  └──────┬───────┘
                                │
                    ┌───────────┼───────────┐
                    │           │           │
             ┌──────┴──┐   ┌───┴────┐  ┌──┴─────────┐
             │ Celery  │   │ Celery │  │  WebSocket │
             │ Worker  │   │  Beat  │  │  Mgr       │
             │ 2-8 pods│   │ 1 pod  │  │ (in backend│
             └────┬────┘   └───┬────┘  └────────────┘
                  │            │
          ┌───────┴────────────┴───────┐
          │                            │
    ┌─────┴──────┐              ┌─────┴─────┐
    │ PostgreSQL │              │   Redis   │
    │ StatefulSet│              │ 1 replica │
    │  1 replica │              └───────────┘
    └────────────┘
```

### Resource Distribution

| Service | Min Replicas | Max Replicas | CPU Request | Memory Request |
|---------|-------------|--------------|-------------|----------------|
| Backend | 2 | 10 | 500m | 512Mi |
| Frontend | 2 | 10 | 250m | 256Mi |
| Celery Worker | 2 | 8 | 500m | 256Mi |
| Celery Beat | 1 | 1 | 100m | 128Mi |
| PostgreSQL | 1 | 1 | 500m | 512Mi |
| Redis | 1 | 1 | 250m | 128Mi |

---

## File Structure

```
k8s/
├── namespace.yaml                  # Namespace definition
├── configmap.yaml                  # Application configuration
├── secret.yaml                     # Sensitive data (base64 encoded)
├── persistent-volumes.yaml         # PVCs for data persistence
├── postgres-statefulset.yaml       # PostgreSQL database
├── redis-deployment.yaml           # Redis cache
├── backend-deployment.yaml         # FastAPI backend
├── celery-worker-deployment.yaml   # Celery workers & beat
├── frontend-deployment.yaml        # Next.js frontend
├── ingress.yaml                    # External access + TLS
├── hpa.yaml                        # Auto-scaling configuration
├── kustomization.yaml              # Kustomize template
└── README.md                       # Quick start guide
```

---

## Prerequisites

### 1. Kubernetes Cluster

**Cloud Options:**
- **Google Cloud**: GKE (Recommended)
- **AWS**: EKS
- **Azure**: AKS
- **DigitalOcean**: Kubernetes
- **Linode**: LKE

**Local Options:**
- **Minikube**: Good for testing
- **Kind**: Fast local clusters
- **k3s**: Lightweight production
- **Docker Desktop**: Easy setup

**Minimum Requirements:**
- **Nodes**: 3 worker nodes (for high availability)
- **CPU**: 8 cores total (across all nodes)
- **Memory**: 16GB RAM total
- **Storage**: 50GB

### 2. Required Add-ons

**Nginx Ingress Controller:**
```bash
# Cloud provider
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.10.0/deploy/static/provider/cloud/deploy.yaml

# Verify installation
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=120s
```

**cert-manager (for automatic TLS):**
```bash
# Install cert-manager
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.14.0/cert-manager.yaml

# Verify installation
kubectl get pods --namespace cert-manager
```

**Metrics Server (for HPA):**
```bash
# Install metrics server
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# Verify metrics are available
kubectl top nodes
```

### 3. Tools

```bash
# kubectl (required)
kubectl version --client

# Optional but recommended
kustomize version  # For templating
helm version       # For dependency management
k9s                # Terminal UI for Kubernetes
```

---

## Configuration

### Step 1: Docker Images

Build and push Docker images to a registry:

```bash
# Build images
./scripts/docker-build.sh --tag v1.0.0

# Push to registry
export DOCKER_REGISTRY=your-registry.azurecr.io
docker push $DOCKER_REGISTRY/ccw-erp-backend:v1.0.0
docker push $DOCKER_REGISTRY/ccw-erp-frontend:v1.0.0
```

Update image references in deployment files or use kustomize:

```bash
cd k8s
kustomize edit set image ccw-erp-backend=your-registry/ccw-erp-backend:v1.0.0
kustomize edit set image ccw-erp-frontend=your-registry/ccw-erp-frontend:v1.0.0
```

### Step 2: Secrets

Encode secrets with base64 and update `k8s/secret.yaml`:

```bash
# PostgreSQL password
echo -n "your-strong-password" | base64

# Anthropic API key
echo -n "sk-ant-api03-..." | base64

# Other secrets
echo -n "your-xero-client-id" | base64
echo -n "your-shopify-token" | base64
```

**IMPORTANT Security Notes:**
- Never commit `secret.yaml` with real secrets to git
- Use a secrets management solution in production:
  - **Sealed Secrets** (encrypts secrets for git)
  - **External Secrets Operator** (syncs from AWS/Azure/GCP)
  - **HashiCorp Vault** (centralized secrets)
- Rotate secrets regularly (every 90 days minimum)

### Step 3: Configuration

Update `k8s/configmap.yaml`:

```yaml
# Update these values
NEXT_PUBLIC_API_URL: "https://api.your-domain.com"
NEXT_PUBLIC_FRONTEND_URL: "https://your-domain.com"
NEXT_PUBLIC_WS_URL: "wss://api.your-domain.com"
CORS_ORIGINS: "https://your-domain.com,https://www.your-domain.com"
```

### Step 4: Ingress & DNS

Update `k8s/ingress.yaml`:

```yaml
# Update domain names
hosts:
  - your-domain.com
  - www.your-domain.com
  - api.your-domain.com

# Update email for Let's Encrypt
email: admin@your-domain.com
```

Configure DNS records:

```
# A Records pointing to Load Balancer IP
your-domain.com         -> <LOAD_BALANCER_IP>
www.your-domain.com     -> <LOAD_BALANCER_IP>
api.your-domain.com     -> <LOAD_BALANCER_IP>
```

Get Load Balancer IP after deployment:

```bash
kubectl get svc -n ingress-nginx
```

---

## Deployment

### Automated Deployment

**Linux/Mac:**
```bash
# Dry run to preview
./scripts/k8s-deploy.sh --dry-run

# Deploy to Kubernetes
./scripts/k8s-deploy.sh

# Check status
kubectl get pods -n ccw-erp
```

**Windows:**
```powershell
# Dry run
.\scripts\k8s-deploy.ps1 -DryRun

# Deploy
.\scripts\k8s-deploy.ps1

# Check status
kubectl get pods -n ccw-erp
```

### Manual Deployment Steps

```bash
# 1. Create namespace
kubectl apply -f k8s/namespace.yaml

# 2. Configuration
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml

# 3. Storage
kubectl apply -f k8s/persistent-volumes.yaml

# 4. Database & Cache
kubectl apply -f k8s/postgres-statefulset.yaml
kubectl apply -f k8s/redis-deployment.yaml

# Wait for databases to be ready
kubectl wait --for=condition=ready pod -l component=database -n ccw-erp --timeout=300s
kubectl wait --for=condition=ready pod -l component=cache -n ccw-erp --timeout=300s

# 5. Application services
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/celery-worker-deployment.yaml
kubectl apply -f k8s/frontend-deployment.yaml

# 6. Auto-scaling
kubectl apply -f k8s/hpa.yaml

# 7. External access
kubectl apply -f k8s/ingress.yaml

# 8. Verify deployment
kubectl get all -n ccw-erp
```

### Using Kustomize

```bash
# Deploy everything at once
kubectl apply -k k8s/

# Or preview first
kustomize build k8s/ | less

# Then apply
kustomize build k8s/ | kubectl apply -f -
```

---

## Auto-Scaling Configuration

### Horizontal Pod Autoscaler (HPA)

**Backend HPA:**
- **Min Replicas**: 2
- **Max Replicas**: 10
- **Scale Up**: Immediately when CPU > 70% or Memory > 80%
- **Scale Down**: After 5 minutes of low usage
- **Scale Up Policy**: Double pods (100%) or add 4 pods, whichever is more aggressive
- **Scale Down Policy**: Reduce by 50% or 2 pods, whichever is more conservative

**Frontend HPA:**
- **Min Replicas**: 2
- **Max Replicas**: 10
- **Same scaling policies as backend**

**Celery Worker HPA:**
- **Min Replicas**: 2
- **Max Replicas**: 8
- **Scale Up**: Quick response (30s stabilization)
- **Scale Down**: Slower (10 minutes) to prevent task interruption
- **Scale Up Policy**: Aggressive (100% or 3 pods)
- **Scale Down Policy**: Conservative (1 pod every 2 minutes)

### Pod Disruption Budgets (PDB)

Ensures high availability during:
- Node maintenance
- Cluster upgrades
- Voluntary disruptions

**Configuration:**
- **Backend**: Always keep at least 1 pod running
- **Frontend**: Always keep at least 1 pod running
- **Celery Worker**: Always keep at least 1 worker running

### Monitoring HPA

```bash
# View HPA status
kubectl get hpa -n ccw-erp

# Watch HPA in real-time
kubectl get hpa -n ccw-erp --watch

# Describe HPA details
kubectl describe hpa backend-hpa -n ccw-erp

# View current metrics
kubectl top pods -n ccw-erp
```

### Testing Auto-Scaling

**Load Test Backend:**
```bash
# Install Apache Bench
apt-get install apache2-utils  # Ubuntu/Debian
brew install httpd             # macOS

# Generate load (adjust URL and concurrency)
ab -n 10000 -c 100 https://api.your-domain.com/health

# Watch pods scale up
kubectl get pods -n ccw-erp --watch
```

**Manual Scale for Testing:**
```bash
# Force scale up
kubectl scale deployment backend --replicas=5 -n ccw-erp

# Let HPA take over again
kubectl autoscale deployment backend --cpu-percent=70 --min=2 --max=10 -n ccw-erp
```

---

## Verification & Health Checks

### Check Deployment Status

```bash
# View all resources
kubectl get all -n ccw-erp

# View pods with more details
kubectl get pods -n ccw-erp -o wide

# View pod events
kubectl get events -n ccw-erp --sort-by='.lastTimestamp'

# Check health of specific pod
kubectl describe pod <pod-name> -n ccw-erp
```

### Test Health Endpoints

```bash
# Port forward backend
kubectl port-forward svc/backend-service 8000:8000 -n ccw-erp

# Test endpoints
curl http://localhost:8000/health
curl http://localhost:8000/ready
curl http://localhost:8000/health/detailed | jq

# Check dependencies
curl http://localhost:8000/health/detailed | jq '.dependencies'
```

### Database Connectivity

```bash
# Connect to PostgreSQL
kubectl exec -it postgres-0 -n ccw-erp -- psql -U ccw_user -d ccw_erp_db

# Run test query
SELECT current_database(), current_user, version();

# Check connections
SELECT count(*) FROM pg_stat_activity;
```

### Redis Connectivity

```bash
# Connect to Redis
kubectl exec -it deployment/redis -n ccw-erp -- redis-cli

# Test commands
PING
INFO server
DBSIZE
```

---

## Operations

### Viewing Logs

```bash
# Stream logs from deployment
kubectl logs -f deployment/backend -n ccw-erp

# Logs from all pods with label
kubectl logs -l component=backend -n ccw-erp --tail=100 --follow

# Logs from specific pod
kubectl logs backend-abc123-xyz -n ccw-erp

# Previous pod logs (if crashed)
kubectl logs backend-abc123-xyz -n ccw-erp --previous

# Logs from multiple pods
stern backend -n ccw-erp  # Requires stern tool
```

### Executing Commands

```bash
# Open shell in pod
kubectl exec -it deployment/backend -n ccw-erp -- /bin/bash

# Run single command
kubectl exec deployment/backend -n ccw-erp -- python --version

# Run database migrations
kubectl exec deployment/backend -n ccw-erp -- python -m alembic upgrade head
```

### Scaling

```bash
# Manual scale
kubectl scale deployment backend --replicas=5 -n ccw-erp

# Check current scale
kubectl get deployment backend -n ccw-erp

# Scale multiple deployments
kubectl scale deployment backend frontend celery-worker --replicas=3 -n ccw-erp
```

### Rolling Updates

```bash
# Update image
kubectl set image deployment/backend backend=ccw-erp-backend:v1.1.0 -n ccw-erp

# Check rollout status
kubectl rollout status deployment/backend -n ccw-erp

# Pause rollout
kubectl rollout pause deployment/backend -n ccw-erp

# Resume rollout
kubectl rollout resume deployment/backend -n ccw-erp

# View rollout history
kubectl rollout history deployment/backend -n ccw-erp
```

### Rollback

```bash
# Rollback to previous version
kubectl rollout undo deployment/backend -n ccw-erp

# Rollback to specific revision
kubectl rollout undo deployment/backend --to-revision=3 -n ccw-erp

# Check revision history
kubectl rollout history deployment/backend -n ccw-erp
```

---

## Troubleshooting

### Common Issues

**1. Pods Not Starting (ImagePullBackOff)**

```bash
# Check pod events
kubectl describe pod <pod-name> -n ccw-erp

# Common fixes:
# - Verify image name and tag are correct
# - Check image registry authentication
# - Ensure image exists in registry

# Add image pull secret if needed
kubectl create secret docker-registry regcred \
  --docker-server=<registry-url> \
  --docker-username=<username> \
  --docker-password=<password> \
  -n ccw-erp
```

**2. CrashLoopBackOff**

```bash
# View logs to see error
kubectl logs <pod-name> -n ccw-erp

# View previous container logs
kubectl logs <pod-name> -n ccw-erp --previous

# Common causes:
# - Application startup failure
# - Missing environment variables
# - Database connection failure
# - Port already in use
```

**3. Pending Pods**

```bash
# Check why pod is pending
kubectl describe pod <pod-name> -n ccw-erp

# Common causes:
# - Insufficient resources (CPU/memory)
# - PVC not bound
# - Node selector mismatch
# - Pod affinity rules

# Check node resources
kubectl top nodes
kubectl describe nodes
```

**4. Service Not Accessible**

```bash
# Check service
kubectl get svc -n ccw-erp
kubectl describe svc backend-service -n ccw-erp

# Test service from within cluster
kubectl run test-pod --rm -it --image=curlimages/curl -n ccw-erp -- sh
curl http://backend-service:8000/health

# Check endpoints
kubectl get endpoints backend-service -n ccw-erp
```

**5. Ingress Not Working**

```bash
# Check ingress
kubectl get ingress -n ccw-erp
kubectl describe ingress ccw-erp-ingress -n ccw-erp

# Check ingress controller
kubectl get pods -n ingress-nginx
kubectl logs -n ingress-nginx deployment/ingress-nginx-controller

# Check TLS certificate
kubectl get certificates -n ccw-erp
kubectl describe certificate ccw-erp-tls-cert -n ccw-erp
```

**6. HPA Not Scaling**

```bash
# Check metrics server
kubectl top nodes
kubectl top pods -n ccw-erp

# Check HPA status
kubectl get hpa -n ccw-erp
kubectl describe hpa backend-hpa -n ccw-erp

# Common issues:
# - Metrics server not installed
# - Resource requests not set
# - Metrics not available yet (wait 1-2 minutes)
```

---

## Cleanup

### Delete Deployment

```bash
# Using script
./scripts/k8s-deploy.sh --delete  # Linux/Mac
.\scripts\k8s-deploy.ps1 -Delete  # Windows

# Manual deletion
kubectl delete namespace ccw-erp

# Or delete individual resources
kubectl delete -f k8s/
```

**WARNING**: Deleting PersistentVolumeClaims will delete all data permanently!

### Backup Before Deletion

```bash
# Backup PostgreSQL
kubectl exec postgres-0 -n ccw-erp -- pg_dump -U ccw_user ccw_erp_db > backup.sql

# Backup Redis (if needed)
kubectl exec deployment/redis -n ccw-erp -- redis-cli --rdb /data/dump.rdb
kubectl cp redis-<pod-id>:/data/dump.rdb ./redis-backup.rdb -n ccw-erp
```

---

## Best Practices

### 1. Resource Management
- Always set resource requests and limits
- Use PodDisruptionBudgets for high availability
- Configure appropriate HPA thresholds

### 2. Security
- Run containers as non-root
- Use NetworkPolicies to restrict traffic
- Store secrets in external secrets manager
- Enable RBAC and use service accounts
- Scan images for vulnerabilities

### 3. Monitoring
- Set up Prometheus + Grafana (Week 7 Task 5)
- Configure alerting for critical metrics
- Monitor HPA behavior and adjust thresholds
- Track application metrics (requests, latency, errors)

### 4. High Availability
- Run multiple replicas (min 2 for stateless services)
- Use PodDisruptionBudgets
- Configure liveness and readiness probes
- Use anti-affinity rules for pod distribution

### 5. Backup & Recovery
- Regular database backups (automated)
- Test restore procedures
- Document recovery playbook
- Use snapshots for PersistentVolumes

### 6. Updates & Rollouts
- Use rolling updates (default)
- Always test in staging first
- Have rollback plan ready
- Monitor during rollouts

---

## Next Steps

- **Week 7 Task 5**: Prometheus + Grafana monitoring
- **Week 8**: Production deployment and load testing

---

## Resources

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [HPA Documentation](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/)
- [Nginx Ingress](https://kubernetes.github.io/ingress-nginx/)
- [cert-manager](https://cert-manager.io/docs/)
- [kubectl Cheat Sheet](https://kubernetes.io/docs/reference/kubectl/cheatsheet/)

---

*Document Version: 1.0*
*Last Updated: January 14, 2026*

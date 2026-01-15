# Kubernetes Deployment Guide

This directory contains Kubernetes manifests for deploying the CCW-Online ERP system to a Kubernetes cluster.

## Prerequisites

### 1. Kubernetes Cluster

You need a running Kubernetes cluster. Options:
- **Cloud**: GKE, EKS, AKS, DigitalOcean Kubernetes
- **Local**: Minikube, Kind, k3s, Docker Desktop with Kubernetes

### 2. Required Tools

```bash
# kubectl (Kubernetes CLI)
kubectl version --client

# Optional: kustomize (for templating)
kustomize version

# Optional: helm (for dependency management)
helm version
```

### 3. Nginx Ingress Controller

Install the Nginx Ingress Controller:

```bash
# For cloud providers
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.10.0/deploy/static/provider/cloud/deploy.yaml

# For bare metal
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.10.0/deploy/static/provider/baremetal/deploy.yaml
```

### 4. cert-manager (for TLS certificates)

Install cert-manager for automatic TLS certificate management:

```bash
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.14.0/cert-manager.yaml
```

## Configuration Steps

### Step 1: Update Secrets

Edit `secret.yaml` and encode your secrets with base64:

```bash
# Encode a secret
echo -n "your-password" | base64

# Example for multiple secrets
echo -n "postgres-password" | base64
echo -n "sk-ant-api03-..." | base64
```

Update the base64-encoded values in `secret.yaml`.

**IMPORTANT**: Never commit actual secrets to version control!

### Step 2: Update ConfigMap

Edit `configmap.yaml` and set your configuration:

- `NEXT_PUBLIC_API_URL`: Your API domain (e.g., `https://api.your-domain.com`)
- `NEXT_PUBLIC_FRONTEND_URL`: Your frontend domain (e.g., `https://your-domain.com`)
- `NEXT_PUBLIC_WS_URL`: Your WebSocket URL (e.g., `wss://api.your-domain.com`)
- `CORS_ORIGINS`: Allowed CORS origins

### Step 3: Update Ingress

Edit `ingress.yaml` and set your domain names:

- Replace `your-domain.com` with your actual domain
- Replace `admin@your-domain.com` with your email (for Let's Encrypt)

### Step 4: Update Docker Images

Edit the deployment files or use kustomize to set your registry:

```bash
# Using kustomize
cd k8s
kustomize edit set image ccw-erp-backend=your-registry/ccw-erp-backend:v1.0.0
kustomize edit set image ccw-erp-frontend=your-registry/ccw-erp-frontend:v1.0.0
```

Or manually edit:
- `backend-deployment.yaml`
- `celery-worker-deployment.yaml`
- `frontend-deployment.yaml`

## Deployment

### Quick Deploy (Automated Script)

**Linux/Mac:**
```bash
# Dry run (see what would be deployed)
./scripts/k8s-deploy.sh --dry-run

# Deploy
./scripts/k8s-deploy.sh
```

**Windows:**
```powershell
# Dry run
.\scripts\k8s-deploy.ps1 -DryRun

# Deploy
.\scripts\k8s-deploy.ps1
```

### Manual Deploy

```bash
# 1. Create namespace
kubectl apply -f namespace.yaml

# 2. Create ConfigMap and Secrets
kubectl apply -f configmap.yaml
kubectl apply -f secret.yaml

# 3. Create PersistentVolumeClaims
kubectl apply -f persistent-volumes.yaml

# 4. Deploy PostgreSQL
kubectl apply -f postgres-statefulset.yaml

# Wait for PostgreSQL to be ready
kubectl wait --for=condition=ready pod -l component=database -n ccw-erp --timeout=300s

# 5. Deploy Redis
kubectl apply -f redis-deployment.yaml

# Wait for Redis to be ready
kubectl wait --for=condition=ready pod -l component=cache -n ccw-erp --timeout=300s

# 6. Deploy Backend
kubectl apply -f backend-deployment.yaml

# 7. Deploy Celery Workers
kubectl apply -f celery-worker-deployment.yaml

# 8. Deploy Frontend
kubectl apply -f frontend-deployment.yaml

# 9. Deploy Ingress
kubectl apply -f ingress.yaml
```

### Using Kustomize

```bash
# Deploy with kustomize
kubectl apply -k k8s/

# Or build and apply
kustomize build k8s/ | kubectl apply -f -
```

## Verification

### Check Deployment Status

```bash
# View all resources
kubectl get all -n ccw-erp

# View pods
kubectl get pods -n ccw-erp

# View services
kubectl get svc -n ccw-erp

# View ingress
kubectl get ingress -n ccw-erp

# Check pod logs
kubectl logs -f deployment/backend -n ccw-erp
kubectl logs -f deployment/frontend -n ccw-erp
```

### Health Checks

```bash
# Port forward to backend
kubectl port-forward svc/backend-service 8000:8000 -n ccw-erp

# Test health endpoints
curl http://localhost:8000/health
curl http://localhost:8000/ready
curl http://localhost:8000/health/detailed
```

### Access Services Locally

```bash
# Frontend
kubectl port-forward svc/frontend-service 3000:3000 -n ccw-erp
# Visit http://localhost:3000

# Backend API
kubectl port-forward svc/backend-service 8000:8000 -n ccw-erp
# Visit http://localhost:8000/docs (API documentation)

# PostgreSQL
kubectl port-forward svc/postgres-service 5432:5432 -n ccw-erp
# Connect with: psql -h localhost -U ccw_user -d ccw_erp_db

# Redis
kubectl port-forward svc/redis-service 6379:6379 -n ccw-erp
# Connect with: redis-cli -h localhost
```

## Scaling

### Manual Scaling

```bash
# Scale backend
kubectl scale deployment backend --replicas=3 -n ccw-erp

# Scale frontend
kubectl scale deployment frontend --replicas=3 -n ccw-erp

# Scale Celery workers
kubectl scale deployment celery-worker --replicas=4 -n ccw-erp
```

### Auto-Scaling (HPA)

See the HPA documentation in the main deployment plan. Auto-scaling will be configured in Week 7 Task 4.

## Monitoring

### View Logs

```bash
# All backend logs
kubectl logs -f deployment/backend -n ccw-erp

# All frontend logs
kubectl logs -f deployment/frontend -n ccw-erp

# Specific pod
kubectl logs -f pod/backend-xxxxx -n ccw-erp

# Previous pod logs (if pod crashed)
kubectl logs --previous pod/backend-xxxxx -n ccw-erp

# Logs from all pods with label
kubectl logs -l component=backend -n ccw-erp --tail=100
```

### Debugging

```bash
# Describe pod
kubectl describe pod backend-xxxxx -n ccw-erp

# Execute command in pod
kubectl exec -it backend-xxxxx -n ccw-erp -- /bin/bash

# View events
kubectl get events -n ccw-erp --sort-by='.lastTimestamp'

# Check resource usage
kubectl top pods -n ccw-erp
kubectl top nodes
```

## Updating Deployment

### Rolling Update

```bash
# Update backend image
kubectl set image deployment/backend backend=ccw-erp-backend:v1.1.0 -n ccw-erp

# Update frontend image
kubectl set image deployment/frontend frontend=ccw-erp-frontend:v1.1.0 -n ccw-erp

# Check rollout status
kubectl rollout status deployment/backend -n ccw-erp

# View rollout history
kubectl rollout history deployment/backend -n ccw-erp
```

### Rollback

```bash
# Rollback to previous version
kubectl rollout undo deployment/backend -n ccw-erp

# Rollback to specific revision
kubectl rollout undo deployment/backend --to-revision=2 -n ccw-erp
```

### Zero-Downtime Deployment

The deployments are configured with:
- Rolling update strategy
- Readiness probes
- Liveness probes
- Pod disruption budgets (to be added in HPA config)

This ensures zero-downtime deployments.

## Cleanup

### Delete All Resources

**Using script:**
```bash
# Linux/Mac
./scripts/k8s-deploy.sh --delete

# Windows
.\scripts\k8s-deploy.ps1 -Delete
```

**Manual:**
```bash
# Delete namespace (deletes everything)
kubectl delete namespace ccw-erp

# Or delete individual resources
kubectl delete -f k8s/
```

**IMPORTANT**: Deleting PersistentVolumeClaims will delete all data!

## Troubleshooting

### Pods Not Starting

```bash
# Check pod status
kubectl get pods -n ccw-erp

# View pod events
kubectl describe pod <pod-name> -n ccw-erp

# Check logs
kubectl logs <pod-name> -n ccw-erp

# Common issues:
# - Image pull errors: Check image name and registry credentials
# - CrashLoopBackOff: Check logs for application errors
# - Pending: Check resource availability and PVC binding
```

### Database Connection Errors

```bash
# Check PostgreSQL pod
kubectl get pods -l component=database -n ccw-erp

# Check PostgreSQL logs
kubectl logs -l component=database -n ccw-erp

# Test connectivity from backend pod
kubectl exec -it deployment/backend -n ccw-erp -- python -c "from src.db.session import get_db; print('OK')"
```

### Ingress Not Working

```bash
# Check ingress
kubectl get ingress -n ccw-erp
kubectl describe ingress ccw-erp-ingress -n ccw-erp

# Check ingress controller
kubectl get pods -n ingress-nginx

# Check cert-manager (for TLS)
kubectl get certificates -n ccw-erp
kubectl describe certificate ccw-erp-tls-cert -n ccw-erp
```

## Monitoring

### Deploy Monitoring Stack (Prometheus + Grafana)

**Quick Deploy:**
```bash
# Linux/Mac
./scripts/deploy-monitoring.sh

# Windows
.\scripts\deploy-monitoring.ps1
```

**What's Included:**
- Prometheus (metrics collection + storage)
- Grafana (dashboards + visualization)
- 4 pre-configured dashboards
- 15+ alert rules
- PostgreSQL and Redis exporters (optional)

**Access:**
```bash
# Port-forward for local access
kubectl port-forward svc/prometheus 9090:9090 -n monitoring
kubectl port-forward svc/grafana 3000:3000 -n monitoring
```

**Default Grafana Credentials:**
- Username: admin
- Password: admin (⚠️ CHANGE IMMEDIATELY!)

**Documentation:**
- Quick Start: [monitoring/README.md](monitoring/README.md)
- Comprehensive Guide: [docs/MONITORING-SETUP.md](../docs/MONITORING-SETUP.md)

**Metrics Endpoint:**
All CCW-ERP services expose metrics at `/metrics`:
```bash
# Test backend metrics
kubectl port-forward svc/backend-service 8000:8000 -n ccw-erp
curl http://localhost:8000/metrics
```

## Best Practices

1. **Secrets Management**: Use external secrets management (Sealed Secrets, External Secrets Operator, or Vault)
2. **Resource Limits**: Always set resource requests and limits
3. **Health Checks**: Configure liveness, readiness, and startup probes
4. **Monitoring**: Set up Prometheus and Grafana (completed in Week 7)
5. **Backups**: Regularly backup PostgreSQL data
6. **Updates**: Use rolling updates with proper health checks
7. **Security**: Run containers as non-root, use NetworkPolicies
8. **Namespaces**: Use namespaces to separate environments (dev, staging, prod)

## Next Steps

- **Week 8 Task 1**: Deploy to production Kubernetes cluster
- **Week 8 Task 2**: Perform load testing with k6/Locust
- **Week 8 Task 3**: Verify auto-scaling behavior under load
- **Week 8 Task 4**: Monitor production metrics and tune resource limits

## Resources

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [kubectl Cheat Sheet](https://kubernetes.io/docs/reference/kubectl/cheatsheet/)
- [Nginx Ingress Controller](https://kubernetes.github.io/ingress-nginx/)
- [cert-manager](https://cert-manager.io/docs/)
- [Kustomize](https://kustomize.io/)

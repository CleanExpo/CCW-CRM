# Auto-Scaling Configuration Guide

**Document Version**: 1.0
**Last Updated**: 2026-02-02
**Related Issues**: ISS-D045

---

## Overview

This document provides comprehensive guidance on implementing auto-scaling for CCW-Online ERP across different deployment platforms: AWS Auto Scaling, Docker Swarm, and Kubernetes. Auto-scaling ensures the application can handle variable traffic loads efficiently.

## Scaling Strategy

### Scaling Metrics and Thresholds

| Metric | Scale Out (Add Instances) | Scale In (Remove Instances) | Cool-down |
|--------|---------------------------|----------------------------|-----------|
| **CPU Usage** | > 70% for 3 minutes | < 30% for 10 minutes | 5 minutes |
| **Memory Usage** | > 80% for 3 minutes | < 40% for 10 minutes | 5 minutes |
| **Request Rate** | > 1000 req/min | < 300 req/min | 3 minutes |
| **Response Time** | > 2 seconds (p95) | < 500ms (p95) | 5 minutes |

### Instance Limits

- **Minimum Instances**: 2 (for high availability)
- **Maximum Instances**: 10 (cost control and resource limits)
- **Desired Capacity**: 3 (normal operation)
- **Scale-out Step**: +1 or +2 instances (based on urgency)
- **Scale-in Step**: -1 instance (gradual reduction)

### Architecture Overview

```
                    ┌──────────────────┐
                    │  Load Balancer   │
                    │     (Nginx)      │
                    └────────┬─────────┘
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
    ┌─────▼─────┐      ┌─────▼─────┐    ┌─────▼─────┐
    │  App      │      │  App      │    │  App      │
    │ Instance 1│      │ Instance 2│... │ Instance N│
    │ (Min: 2)  │      │           │    │ (Max: 10) │
    └───────────┘      └───────────┘    └───────────┘
```

## Option 1: AWS Auto Scaling (Recommended for AWS Deployments)

### Prerequisites

- AWS account with appropriate permissions
- EC2 instances in VPC
- Application Load Balancer (ALB) configured
- CloudWatch agent installed on instances

### Step 1: Create Launch Template

#### Create Launch Template via AWS CLI

```bash
# Create launch template
aws ec2 create-launch-template \
    --launch-template-name ccw-online-erp-template \
    --version-description "v1.0" \
    --launch-template-data '{
        "ImageId": "ami-0c55b159cbfafe1f0",
        "InstanceType": "t3.xlarge",
        "KeyName": "ccw-keypair",
        "SecurityGroupIds": ["sg-xxxxxxxxx"],
        "IamInstanceProfile": {
            "Name": "ccw-ec2-role"
        },
        "UserData": "IyEvYmluL2Jhc2gKY2QgL29wdC9jY3ctb25saW5lLWVycApkb2NrZXIgY29tcG9zZSB1cCAtZA==",
        "TagSpecifications": [{
            "ResourceType": "instance",
            "Tags": [
                {"Key": "Name", "Value": "ccw-online-erp-instance"},
                {"Key": "Environment", "Value": "production"}
            ]
        }]
    }'
```

#### Launch Template Configuration

```yaml
# UserData script (base64 encoded in template above)
#!/bin/bash
set -e

# Update system
apt-get update
apt-get upgrade -y

# Pull latest code
cd /opt/ccw-online-erp
git pull origin main

# Start application
docker compose up -d

# Wait for health check
sleep 30

# Register with load balancer happens automatically
```

### Step 2: Create Auto Scaling Group

```bash
# Create Auto Scaling Group
aws autoscaling create-auto-scaling-group \
    --auto-scaling-group-name ccw-online-erp-asg \
    --launch-template LaunchTemplateName=ccw-online-erp-template,Version='$Latest' \
    --min-size 2 \
    --max-size 10 \
    --desired-capacity 3 \
    --default-cooldown 300 \
    --health-check-type ELB \
    --health-check-grace-period 300 \
    --vpc-zone-identifier "subnet-xxxxxx,subnet-yyyyyy,subnet-zzzzzz" \
    --target-group-arns "arn:aws:elasticloadbalancing:region:account:targetgroup/ccw-tg/xxxxxxxxx" \
    --tags Key=Name,Value=ccw-online-erp-instance Key=Environment,Value=production
```

### Step 3: Configure Scaling Policies

#### CPU-Based Scaling Policy

```bash
# Scale out when CPU > 70%
aws autoscaling put-scaling-policy \
    --auto-scaling-group-name ccw-online-erp-asg \
    --policy-name scale-out-cpu-policy \
    --policy-type TargetTrackingScaling \
    --target-tracking-configuration '{
        "PredefinedMetricSpecification": {
            "PredefinedMetricType": "ASGAverageCPUUtilization"
        },
        "TargetValue": 70.0,
        "ScaleOutCooldown": 300,
        "ScaleInCooldown": 600
    }'
```

#### Memory-Based Scaling Policy

```bash
# Scale out when Memory > 80%
aws autoscaling put-scaling-policy \
    --auto-scaling-group-name ccw-online-erp-asg \
    --policy-name scale-out-memory-policy \
    --policy-type TargetTrackingScaling \
    --target-tracking-configuration '{
        "CustomizedMetricSpecification": {
            "MetricName": "MemoryUtilization",
            "Namespace": "System/Linux",
            "Dimensions": [
                {
                    "Name": "AutoScalingGroupName",
                    "Value": "ccw-online-erp-asg"
                }
            ],
            "Statistic": "Average",
            "Unit": "Percent"
        },
        "TargetValue": 80.0
    }'
```

#### Request Rate Scaling Policy

```bash
# Scale based on request count
aws autoscaling put-scaling-policy \
    --auto-scaling-group-name ccw-online-erp-asg \
    --policy-name scale-out-requests-policy \
    --policy-type TargetTrackingScaling \
    --target-tracking-configuration '{
        "PredefinedMetricSpecification": {
            "PredefinedMetricType": "ALBRequestCountPerTarget"
        },
        "TargetValue": 1000.0
    }'
```

#### Step Scaling Policy (Aggressive)

```bash
# Create step scaling for rapid response to traffic spikes
aws autoscaling put-scaling-policy \
    --auto-scaling-group-name ccw-online-erp-asg \
    --policy-name scale-out-step-policy \
    --policy-type StepScaling \
    --adjustment-type PercentChangeInCapacity \
    --metric-aggregation-type Average \
    --step-adjustments '[
        {
            "MetricIntervalLowerBound": 0,
            "MetricIntervalUpperBound": 10,
            "ScalingAdjustment": 1
        },
        {
            "MetricIntervalLowerBound": 10,
            "ScalingAdjustment": 2
        }
    ]'
```

### Step 4: Configure CloudWatch Alarms

```bash
# High CPU alarm
aws cloudwatch put-metric-alarm \
    --alarm-name ccw-high-cpu-alarm \
    --alarm-description "Trigger scale-out when CPU > 70%" \
    --metric-name CPUUtilization \
    --namespace AWS/EC2 \
    --statistic Average \
    --period 180 \
    --threshold 70 \
    --comparison-operator GreaterThanThreshold \
    --evaluation-periods 2 \
    --dimensions Name=AutoScalingGroupName,Value=ccw-online-erp-asg \
    --alarm-actions arn:aws:autoscaling:region:account:scalingPolicy:policy-id

# High memory alarm
aws cloudwatch put-metric-alarm \
    --alarm-name ccw-high-memory-alarm \
    --alarm-description "Trigger scale-out when Memory > 80%" \
    --metric-name MemoryUtilization \
    --namespace System/Linux \
    --statistic Average \
    --period 180 \
    --threshold 80 \
    --comparison-operator GreaterThanThreshold \
    --evaluation-periods 2 \
    --dimensions Name=AutoScalingGroupName,Value=ccw-online-erp-asg \
    --alarm-actions arn:aws:autoscaling:region:account:scalingPolicy:policy-id
```

### Step 5: Configure CloudWatch Agent for Memory Metrics

Create `/opt/aws/amazon-cloudwatch-agent/etc/cloudwatch-config.json`:

```json
{
  "metrics": {
    "namespace": "System/Linux",
    "metrics_collected": {
      "mem": {
        "measurement": [
          {
            "name": "mem_used_percent",
            "rename": "MemoryUtilization",
            "unit": "Percent"
          }
        ],
        "metrics_collection_interval": 60
      },
      "cpu": {
        "measurement": [
          {
            "name": "cpu_usage_active",
            "rename": "CPUUtilization",
            "unit": "Percent"
          }
        ],
        "metrics_collection_interval": 60
      }
    },
    "append_dimensions": {
      "AutoScalingGroupName": "${aws:AutoScalingGroupName}"
    }
  }
}
```

Start CloudWatch agent:

```bash
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
    -a fetch-config \
    -m ec2 \
    -s \
    -c file:/opt/aws/amazon-cloudwatch-agent/etc/cloudwatch-config.json
```

## Option 2: Docker Swarm (For Self-Hosted Deployments)

### Prerequisites

- Docker Swarm cluster initialized
- Manager and worker nodes configured
- Shared storage for stateful services (if needed)

### Step 1: Initialize Docker Swarm

```bash
# On manager node
docker swarm init --advertise-addr <MANAGER-IP>

# On worker nodes
docker swarm join --token <TOKEN> <MANAGER-IP>:2377
```

### Step 2: Create Docker Stack File

Create `docker-stack.yml`:

```yaml
version: '3.8'

services:
  backend:
    image: ccw-online-erp-backend:latest
    deploy:
      replicas: 3
      update_config:
        parallelism: 1
        delay: 10s
        order: start-first
      rollback_config:
        parallelism: 1
        delay: 10s
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '1.0'
          memory: 2G
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    image: ccw-online-erp-frontend:latest
    deploy:
      replicas: 3
      update_config:
        parallelism: 1
        delay: 10s
      resources:
        limits:
          cpus: '1.0'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 1G
    environment:
      - NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000"]
      interval: 30s
      timeout: 10s
      retries: 3

networks:
  app-network:
    driver: overlay
```

### Step 3: Deploy Stack

```bash
# Deploy stack
docker stack deploy -c docker-stack.yml ccw-erp

# Verify deployment
docker service ls
docker stack ps ccw-erp
```

### Step 4: Manual Scaling

```bash
# Scale backend service
docker service scale ccw-erp_backend=5

# Scale frontend service
docker service scale ccw-erp_frontend=5

# Or use script (see scripts/scale-services.sh)
./scripts/scale-services.sh backend 5
```

### Step 5: Automated Scaling (Using Orbiter)

Install Orbiter for auto-scaling:

```bash
# Deploy Orbiter service
docker service create \
    --name orbiter \
    --constraint node.role==manager \
    --mount type=bind,source=/var/run/docker.sock,target=/var/run/docker.sock \
    gianarb/orbiter:latest \
    --swarm \
    --interval 60s
```

Configure scaling rules in `orbiter-config.yml`:

```yaml
autoscalers:
  - name: backend-autoscaler
    service: ccw-erp_backend
    min: 2
    max: 10
    metrics:
      - type: cpu
        target: 70
      - type: memory
        target: 80

  - name: frontend-autoscaler
    service: ccw-erp_frontend
    min: 2
    max: 10
    metrics:
      - type: cpu
        target: 70
```

## Option 3: Kubernetes (For Advanced Deployments)

### Prerequisites

- Kubernetes cluster (EKS, GKE, or self-hosted)
- kubectl configured
- Helm installed (optional)

### Step 1: Create Kubernetes Deployment

Create `k8s/deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ccw-backend
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ccw-backend
  template:
    metadata:
      labels:
        app: ccw-backend
    spec:
      containers:
      - name: backend
        image: ccw-online-erp-backend:latest
        ports:
        - containerPort: 8000
        resources:
          requests:
            cpu: 1000m
            memory: 2Gi
          limits:
            cpu: 2000m
            memory: 4Gi
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: ccw-secrets
              key: database-url
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8000
          initialDelaySeconds: 10
          periodSeconds: 5
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ccw-frontend
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ccw-frontend
  template:
    metadata:
      labels:
        app: ccw-frontend
    spec:
      containers:
      - name: frontend
        image: ccw-online-erp-frontend:latest
        ports:
        - containerPort: 3000
        resources:
          requests:
            cpu: 500m
            memory: 1Gi
          limits:
            cpu: 1000m
            memory: 2Gi
```

### Step 2: Create Horizontal Pod Autoscaler (HPA)

Create `k8s/hpa.yaml`:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ccw-backend-hpa
  namespace: production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ccw-backend
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
      - type: Pods
        value: 1
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
      - type: Percent
        value: 100
        periodSeconds: 30
      - type: Pods
        value: 2
        periodSeconds: 30
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ccw-frontend-hpa
  namespace: production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ccw-frontend
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

### Step 3: Deploy to Kubernetes

```bash
# Create namespace
kubectl create namespace production

# Deploy application
kubectl apply -f k8s/deployment.yaml

# Deploy HPA
kubectl apply -f k8s/hpa.yaml

# Verify HPA
kubectl get hpa -n production

# Watch scaling events
kubectl get hpa -n production -w
```

### Step 4: Install Metrics Server (if not installed)

```bash
# Install metrics server
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# Verify metrics server
kubectl top nodes
kubectl top pods -n production
```

## Manual Scaling Procedures

### Using the Scaling Script

```bash
# Scale backend service
./scripts/scale-services.sh backend 5

# Scale frontend service
./scripts/scale-services.sh frontend 3

# Get current scale
./scripts/scale-services.sh backend status

# Auto-scale based on current metrics
./scripts/scale-services.sh backend auto
```

### Direct Docker Commands

```bash
# For Docker Swarm
docker service scale ccw-erp_backend=5

# For Docker Compose (individual instances)
docker compose up -d --scale backend=5
```

### AWS Console

1. Navigate to EC2 → Auto Scaling Groups
2. Select `ccw-online-erp-asg`
3. Click "Edit" on desired capacity
4. Change min/desired/max values
5. Click "Update"

## Monitoring Auto-Scaling

### CloudWatch Metrics (AWS)

```bash
# Get scaling activity
aws autoscaling describe-scaling-activities \
    --auto-scaling-group-name ccw-online-erp-asg \
    --max-records 20

# Get current capacity
aws autoscaling describe-auto-scaling-groups \
    --auto-scaling-group-names ccw-online-erp-asg \
    --query 'AutoScalingGroups[0].[MinSize,DesiredCapacity,MaxSize,CurrentCapacity]'
```

### Prometheus Metrics

Monitor these metrics:

```promql
# Current instance count
count(up{job="ccw-backend"})

# Average CPU usage
avg(rate(process_cpu_seconds_total[5m])) * 100

# Average memory usage
avg(process_resident_memory_bytes) / avg(node_memory_MemTotal_bytes) * 100

# Request rate
rate(http_requests_total[5m])
```

### Grafana Dashboard

Create dashboard with panels for:
1. Current instance count (time series)
2. CPU utilization by instance (gauge)
3. Memory utilization by instance (gauge)
4. Request rate (time series)
5. Scaling events (table)
6. Response time p95 (time series)

## Testing Auto-Scaling

### Load Testing with Apache Bench

```bash
# Generate load to trigger scale-out
ab -n 100000 -c 100 https://ccw-online.com/

# Monitor scaling
watch -n 5 'docker service ls | grep ccw-erp'
```

### Load Testing with Hey

```bash
# Install hey
go install github.com/rakyll/hey@latest

# Generate load
hey -z 10m -c 50 -q 10 https://ccw-online.com/api/products

# Expected result: Auto-scaler should add instances after 3 minutes
```

### Simulated CPU Load

```bash
# SSH into instance and generate CPU load
stress --cpu 8 --timeout 600s

# Monitor auto-scaling response
aws autoscaling describe-scaling-activities --auto-scaling-group-name ccw-online-erp-asg
```

## Cost Optimization

### Instance Sizing Recommendations

| Traffic Level | Instance Type | Count | Monthly Cost (approx) |
|---------------|---------------|-------|----------------------|
| **Low** (< 1000 req/min) | t3.medium | 2 | $60 |
| **Medium** (1000-5000 req/min) | t3.large | 3-5 | $150-250 |
| **High** (5000-10000 req/min) | t3.xlarge | 5-8 | $400-650 |
| **Very High** (> 10000 req/min) | t3.2xlarge | 8-10 | $800-1000 |

### Savings Strategies

1. **Use Reserved Instances** for minimum capacity (save 40-60%)
2. **Use Spot Instances** for burst capacity (save 70-90%)
3. **Schedule scaling** for predictable traffic patterns
4. **Right-size instances** based on actual usage
5. **Use Graviton instances** (ARM) for 20% cost savings

## Troubleshooting

### Issue: Instances not scaling out

**Diagnosis**:
```bash
# Check scaling policies
aws autoscaling describe-policies --auto-scaling-group-name ccw-online-erp-asg

# Check CloudWatch alarms
aws cloudwatch describe-alarms --state-value ALARM
```

**Solution**: Verify metrics are being published and thresholds are correct.

### Issue: Instances scaling in too aggressively

**Solution**: Increase scale-in cooldown period or lower scale-in threshold.

```bash
# Update policy
aws autoscaling put-scaling-policy \
    --auto-scaling-group-name ccw-online-erp-asg \
    --policy-name scale-in-policy \
    --target-tracking-configuration '{"TargetValue": 30.0, "ScaleInCooldown": 900}'
```

### Issue: New instances fail health checks

**Diagnosis**: Check instance logs and health check configuration.

**Solution**: Increase health check grace period or fix application startup issues.

## Verification Checklist

- [ ] Auto-scaling group created with min=2, max=10
- [ ] Launch template configured with correct AMI and user data
- [ ] Scaling policies configured (CPU, Memory, Request Rate)
- [ ] CloudWatch alarms configured
- [ ] CloudWatch agent installed and publishing metrics
- [ ] Load balancer health checks configured
- [ ] Scaling tested with load testing tool
- [ ] Scale-in behavior verified (instances removed gracefully)
- [ ] Monitoring dashboard created
- [ ] Alerts configured for scaling events
- [ ] Cost monitoring enabled
- [ ] Documentation updated with instance details

## References

- [AWS Auto Scaling Documentation](https://docs.aws.amazon.com/autoscaling/)
- [Docker Swarm Scaling](https://docs.docker.com/engine/swarm/swarm-tutorial/scale-service/)
- [Kubernetes HPA](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/)
- [CloudWatch Metrics](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/working_with_metrics.html)

---

**Document Owner**: DevOps Team
**Review Frequency**: Quarterly or when traffic patterns change
**Last Load Test**: [Date]

# Kubernetes Infrastructure (Future Implementation)

**Claude Collective Intelligence - Multi-Agent RabbitMQ Orchestrator**
**Status:** 🚧 **PLANNED** - Not yet implemented
**Last Updated:** December 7, 2025 (Week 2 Phase 4)

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Planned Directory Structure](#planned-directory-structure)
3. [Kustomize Overlay Pattern](#kustomize-overlay-pattern)
4. [Planned Services](#planned-services)
5. [Deployment Strategy](#deployment-strategy)
6. [Helm Charts (Future)](#helm-charts-future)
7. [Migration from Docker Compose](#migration-from-docker-compose)
8. [Next Steps](#next-steps)

---

## Overview

This directory is reserved for **Kubernetes manifests** for deploying the AI Agent RabbitMQ Orchestrator platform to Kubernetes clusters.

**Current Status:** 🚧 Directory structure created, implementation pending

**Why Kubernetes?**
- Horizontal pod autoscaling
- Rolling updates and rollbacks
- Self-healing containers
- Service discovery and load balancing
- Secrets and configuration management
- Multi-cluster deployment support

---

## Planned Directory Structure

```
infrastructure/kubernetes/
├── base/
│   ├── namespace.yaml                  # Namespace definition
│   ├── statefulsets/
│   │   ├── postgres.yaml
│   │   ├── rabbitmq.yaml
│   │   └── redis.yaml
│   ├── deployments/
│   │   ├── orchestrator.yaml
│   │   ├── mcp-server.yaml
│   │   └── worker.yaml
│   ├── services/
│   │   ├── postgres-service.yaml
│   │   ├── rabbitmq-service.yaml
│   │   └── redis-service.yaml
│   ├── configmaps/
│   │   ├── rabbitmq-config.yaml
│   │   └── prometheus-config.yaml
│   ├── secrets/
│   │   └── credentials.yaml (template)
│   ├── persistentvolumeclaims/
│   │   ├── postgres-pvc.yaml
│   │   ├── rabbitmq-pvc.yaml
│   │   └── redis-pvc.yaml
│   └── kustomization.yaml
│
├── overlays/
│   ├── dev/
│   │   ├── kustomization.yaml
│   │   ├── replicas-patch.yaml
│   │   └── resources-patch.yaml
│   ├── staging/
│   │   ├── kustomization.yaml
│   │   ├── replicas-patch.yaml
│   │   └── ingress.yaml
│   └── production/
│       ├── kustomization.yaml
│       ├── replicas-patch.yaml
│       ├── hpa.yaml (HorizontalPodAutoscaler)
│       ├── pdb.yaml (PodDisruptionBudget)
│       └── ingress.yaml
│
└── helm/
    ├── Chart.yaml
    ├── values.yaml
    ├── values-dev.yaml
    ├── values-staging.yaml
    ├── values-production.yaml
    └── templates/
        ├── deployment.yaml
        ├── service.yaml
        ├── ingress.yaml
        ├── configmap.yaml
        ├── secret.yaml
        ├── hpa.yaml
        └── NOTES.txt
```

---

## Kustomize Overlay Pattern

**Base:** Common configurations shared across all environments
**Overlays:** Environment-specific patches and additions

### Base Configuration

```yaml
# base/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: ai-agent-orchestrator

resources:
  - namespace.yaml
  - statefulsets/postgres.yaml
  - statefulsets/rabbitmq.yaml
  - statefulsets/redis.yaml
  - deployments/orchestrator.yaml
  - services/postgres-service.yaml
  - services/rabbitmq-service.yaml
  - services/redis-service.yaml
  - configmaps/rabbitmq-config.yaml
  - persistentvolumeclaims/postgres-pvc.yaml

commonLabels:
  app: ai-agent-orchestrator
  managed-by: kustomize
```

### Development Overlay

```yaml
# overlays/dev/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

bases:
  - ../../base

patchesStrategicMerge:
  - replicas-patch.yaml
  - resources-patch.yaml

replicas:
  - name: orchestrator
    count: 1
  - name: worker
    count: 2
```

### Production Overlay

```yaml
# overlays/production/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

bases:
  - ../../base

patchesStrategicMerge:
  - replicas-patch.yaml
  - hpa.yaml
  - pdb.yaml

replicas:
  - name: orchestrator
    count: 3
  - name: worker
    count: 10

resources:
  - ingress.yaml
```

---

## Planned Services

### 1. PostgreSQL (StatefulSet)

**Replicas:** 1 (dev), 3 (production - HA cluster)
**Storage:** PersistentVolumeClaim (100GB SSD)
**Resource Requests:**
- CPU: 2 cores
- Memory: 4GB
**Resource Limits:**
- CPU: 4 cores
- Memory: 8GB

**ConfigMap:**
- `postgresql.conf` settings
- `pg_hba.conf` authentication rules

**Secret:**
- `POSTGRES_PASSWORD`
- `REPLICATION_PASSWORD` (for HA)

---

### 2. RabbitMQ (StatefulSet)

**Replicas:** 3 (clustered)
**Storage:** PersistentVolumeClaim (50GB)
**Resource Requests:**
- CPU: 1 core
- Memory: 2GB
**Resource Limits:**
- CPU: 2 cores
- Memory: 4GB

**ConfigMap:**
- `rabbitmq.conf`
- `enabled_plugins`

**Secret:**
- `RABBITMQ_DEFAULT_USER`
- `RABBITMQ_DEFAULT_PASS`
- `RABBITMQ_ERLANG_COOKIE`

---

### 3. Redis (StatefulSet)

**Replicas:** 1 (dev), 3 (production - Redis Sentinel)
**Storage:** PersistentVolumeClaim (20GB)
**Resource Requests:**
- CPU: 0.5 cores
- Memory: 2GB
**Resource Limits:**
- CPU: 1 core
- Memory: 6GB

**ConfigMap:**
- `redis.conf`
- `sentinel.conf` (HA mode)

**Secret:**
- `REDIS_PASSWORD`

---

### 4. Orchestrator (Deployment)

**Replicas:** 1 (dev), 3 (production)
**Resource Requests:**
- CPU: 1 core
- Memory: 1GB
**Resource Limits:**
- CPU: 2 cores
- Memory: 2GB

**HorizontalPodAutoscaler:**
- Min replicas: 3
- Max replicas: 10
- Target CPU utilization: 70%

**ConfigMap:**
- Application configuration
- Environment-specific settings

**Secret:**
- Database credentials
- RabbitMQ credentials
- Redis credentials

---

### 5. Worker (Deployment)

**Replicas:** 2 (dev), 10 (production)
**Resource Requests:**
- CPU: 0.5 cores
- Memory: 512MB
**Resource Limits:**
- CPU: 1 core
- Memory: 1GB

**HorizontalPodAutoscaler:**
- Min replicas: 10
- Max replicas: 50
- Target CPU utilization: 80%

---

## Deployment Strategy

### Development Environment

```bash
# Apply base + dev overlay
kubectl apply -k overlays/dev

# Verify deployment
kubectl get pods -n ai-agent-orchestrator
kubectl get svc -n ai-agent-orchestrator

# Port-forward for local access
kubectl port-forward -n ai-agent-orchestrator svc/rabbitmq 15672:15672
kubectl port-forward -n ai-agent-orchestrator svc/postgres 5432:5432
```

### Staging Environment

```bash
# Apply base + staging overlay
kubectl apply -k overlays/staging

# Verify
kubectl get all -n ai-agent-orchestrator

# Check ingress
kubectl get ingress -n ai-agent-orchestrator
```

### Production Environment

```bash
# Apply base + production overlay
kubectl apply -k overlays/production

# Verify HA components
kubectl get statefulsets -n ai-agent-orchestrator
kubectl get hpa -n ai-agent-orchestrator
kubectl get pdb -n ai-agent-orchestrator

# Check rollout status
kubectl rollout status deployment/orchestrator -n ai-agent-orchestrator
```

### Rolling Updates

```bash
# Update image version
kubectl set image deployment/orchestrator \
  orchestrator=ai-agent-orchestrator:v2.0.0 \
  -n ai-agent-orchestrator

# Monitor rollout
kubectl rollout status deployment/orchestrator -n ai-agent-orchestrator

# Rollback if needed
kubectl rollout undo deployment/orchestrator -n ai-agent-orchestrator
```

---

## Helm Charts (Future)

**Why Helm?**
- Parameterized deployments
- Version management
- Easy upgrades and rollbacks
- Chart repositories

### Planned Chart Structure

```yaml
# Chart.yaml
apiVersion: v2
name: ai-agent-orchestrator
description: Multi-Agent RabbitMQ Orchestrator Platform
version: 1.0.0
appVersion: "2.0.0"

dependencies:
  - name: postgresql
    version: 12.x.x
    repository: https://charts.bitnami.com/bitnami
  - name: rabbitmq
    version: 11.x.x
    repository: https://charts.bitnami.com/bitnami
  - name: redis
    version: 17.x.x
    repository: https://charts.bitnami.com/bitnami
```

### Installation

```bash
# Add Helm repository (future)
helm repo add ai-agent https://charts.example.com/ai-agent
helm repo update

# Install development
helm install ai-agent ai-agent/orchestrator \
  -f values-dev.yaml \
  --namespace ai-agent-orchestrator \
  --create-namespace

# Install production
helm install ai-agent ai-agent/orchestrator \
  -f values-production.yaml \
  --namespace ai-agent-orchestrator

# Upgrade
helm upgrade ai-agent ai-agent/orchestrator \
  -f values-production.yaml

# Rollback
helm rollback ai-agent
```

---

## Migration from Docker Compose

### Conversion Tools

**Kompose:** Convert Docker Compose to Kubernetes manifests

```bash
# Install kompose
curl -L https://github.com/kubernetes/kompose/releases/download/v1.31.0/kompose-linux-amd64 -o kompose
chmod +x kompose
sudo mv kompose /usr/local/bin/

# Convert Docker Compose
cd infrastructure/docker/compose
kompose convert -f docker-compose.yml -o ../../kubernetes/base/

# Review and adjust generated files
```

### Manual Migration Steps

1. **Convert Services → Deployments/StatefulSets**
   - Stateless services → Deployments
   - Stateful services (databases) → StatefulSets

2. **Convert Volumes → PersistentVolumeClaims**
   - Named volumes → PVCs
   - Bind mounts → ConfigMaps or Secrets

3. **Convert Environment Variables → ConfigMaps/Secrets**
   - Non-sensitive → ConfigMaps
   - Sensitive → Secrets

4. **Convert Networks → Services**
   - Docker networks → Kubernetes Services

5. **Add Kubernetes-Specific Resources**
   - Ingress for external access
   - HPA for autoscaling
   - PDB for high availability
   - NetworkPolicies for security

---

## Next Steps

### Phase 1: Basic Deployment (Week 3)

- [ ] Create base manifests for PostgreSQL, RabbitMQ, Redis
- [ ] Create Deployment manifests for orchestrator and worker
- [ ] Create Service manifests for networking
- [ ] Create ConfigMaps for configuration
- [ ] Create Secret templates (values from .env)
- [ ] Test deployment in local Kubernetes (minikube/kind)

### Phase 2: Environment Overlays (Week 4)

- [ ] Create dev overlay with reduced resources
- [ ] Create staging overlay with production-like config
- [ ] Create production overlay with HA settings
- [ ] Implement HorizontalPodAutoscaler
- [ ] Implement PodDisruptionBudget

### Phase 3: Monitoring & Observability (Week 5)

- [ ] Deploy Prometheus Operator
- [ ] Deploy Grafana with pre-configured dashboards
- [ ] Deploy ELK stack for logging
- [ ] Deploy Jaeger for distributed tracing
- [ ] Configure ServiceMonitors for metrics

### Phase 4: Helm Charts (Week 6)

- [ ] Convert base manifests to Helm templates
- [ ] Create values.yaml with all parameters
- [ ] Create environment-specific values files
- [ ] Package Helm chart
- [ ] Publish to chart repository

### Phase 5: Production Hardening (Week 7)

- [ ] Implement NetworkPolicies
- [ ] Configure RBAC (Role-Based Access Control)
- [ ] Enable Pod Security Standards
- [ ] Implement cert-manager for TLS
- [ ] Configure Ingress with WAF

---

## Useful Commands

### Debugging

```bash
# Get pod logs
kubectl logs -n ai-agent-orchestrator <pod-name> -f

# Execute command in pod
kubectl exec -it -n ai-agent-orchestrator <pod-name> -- /bin/sh

# Describe resource
kubectl describe pod -n ai-agent-orchestrator <pod-name>

# Get events
kubectl get events -n ai-agent-orchestrator --sort-by='.lastTimestamp'
```

### Scaling

```bash
# Manual scaling
kubectl scale deployment orchestrator --replicas=5 -n ai-agent-orchestrator

# Autoscaling
kubectl autoscale deployment orchestrator \
  --min=3 --max=10 --cpu-percent=70 \
  -n ai-agent-orchestrator
```

### Resource Management

```bash
# View resource usage
kubectl top pods -n ai-agent-orchestrator
kubectl top nodes

# View resource limits
kubectl describe quota -n ai-agent-orchestrator
kubectl describe limitrange -n ai-agent-orchestrator
```

---

## References

- **Kubernetes Documentation:** https://kubernetes.io/docs/
- **Kustomize Documentation:** https://kustomize.io/
- **Helm Documentation:** https://helm.sh/docs/
- **Bitnami Charts:** https://github.com/bitnami/charts
- **Docker Compose → Kubernetes:** Use Kompose (https://kompose.io/)

---

## Contributing

When implementing Kubernetes infrastructure:

1. Follow **12-Factor App** principles
2. Use **Kustomize overlays** for environment separation
3. Implement **health checks** (liveness, readiness, startup)
4. Set **resource requests/limits** for all containers
5. Use **PodDisruptionBudgets** for critical services
6. Enable **horizontal pod autoscaling** where appropriate
7. Implement **NetworkPolicies** for security
8. Document all configuration in this README

---

**Status:** 🚧 **PLANNED** - Implementation starts Week 3
**Last Updated:** December 7, 2025
**Maintained By:** Infrastructure Team
**Version:** 1.0.0 (Template)

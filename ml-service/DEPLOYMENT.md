# ML Service Deployment Guide

This guide covers deployment scenarios for the RPA Team Manager ML Service, from development to production.

## Deployment Options

### 1. Local Development

**Use Case**: Development, testing, and debugging

```bash
# Install dependencies
pip install -r requirements.txt

# Start development server
python -m uvicorn src.api.main:app --host 0.0.0.0 --port 8001 --reload

# With environment variables
ML_API_HOST=0.0.0.0 ML_API_PORT=8001 DEBUG=true python -m uvicorn src.api.main:app --reload
```

**Features**:
- Hot reloading on code changes
- Debug mode with detailed error messages
- Direct database access
- No containerization overhead

### 2. Docker Development

**Use Case**: Development with consistent environment

```bash
# Build and run development container
docker-compose --profile dev up ml-service-dev

# With background services
docker-compose --profile dev up -d ml-service-dev mlflow-server
```

**Features**:
- Consistent Python environment
- Volume-mounted source code for hot reloading
- Integrated with MLflow and database services
- Network isolation and port mapping

### 3. Docker Production

**Use Case**: Production deployment with full MLOps stack

```bash
# Full production stack
docker-compose up -d

# Just ML service
docker-compose up -d ml-service

# With monitoring
docker-compose --profile monitoring up -d
```

**Features**:
- Multi-stage Docker builds for optimization
- Health checks and restart policies
- Persistent volumes for data
- Production WSGI server (Gunicorn)
- Monitoring and alerting stack

## Environment Configuration

### Development (.env.dev)
```bash
# API Configuration
ML_API_HOST=0.0.0.0
ML_API_PORT=8001
DEBUG=true
LOG_LEVEL=DEBUG

# Database (relative to development environment)
DATABASE_URL=sqlite:///../../backend/data/database.sqlite

# MLflow (local SQLite)
MLFLOW_TRACKING_URI=sqlite:///mlruns.db
MLFLOW_EXPERIMENT_NAME=rpa-dev-experiments

# Model Storage (local filesystem)
MODEL_STORAGE_PATH=./models/trained
FEATURE_STORE_PATH=./features

# Training (fast for development)
ENABLE_HYPERPARAMETER_TUNING=false
MAX_TRIALS=10
MIN_TRAINING_SAMPLES=20

# Monitoring (disabled for dev)
ENABLE_MODEL_MONITORING=false

# Security (no auth for dev)
ML_API_KEY=
ALLOWED_HOSTS=["*"]
```

### Production (.env.prod)
```bash
# API Configuration
ML_API_HOST=0.0.0.0
ML_API_PORT=8001
DEBUG=false
LOG_LEVEL=INFO

# Database (Docker network or external DB)
DATABASE_URL=sqlite:////app/data/database.sqlite

# MLflow (dedicated server)
MLFLOW_TRACKING_URI=http://mlflow-server:5000
MLFLOW_EXPERIMENT_NAME=rpa-production

# Model Storage (persistent volumes)
MODEL_STORAGE_PATH=/app/models/trained
FEATURE_STORE_PATH=/app/features
MLFLOW_ARTIFACT_PATH=/app/artifacts

# Training (full optimization)
ENABLE_HYPERPARAMETER_TUNING=true
MAX_TRIALS=100
MIN_TRAINING_SAMPLES=50

# Performance Thresholds
COMPLETION_TIME_MAE_THRESHOLD=5.0
BUDGET_VARIANCE_MAE_THRESHOLD=0.15
RISK_SCORE_ACCURACY_THRESHOLD=0.75

# Monitoring (full monitoring)
ENABLE_MODEL_MONITORING=true
DRIFT_DETECTION_WINDOW=30
RETRAINING_THRESHOLD=0.1

# Security
ML_API_KEY=your-production-secret-key
ALLOWED_HOSTS=["your-domain.com", "api.your-domain.com"]

# Performance
MAX_WORKERS=4
PREDICTION_TIMEOUT=30
BATCH_SIZE=1000
```

## Docker Deployment Details

### Multi-stage Build

The Dockerfile uses multi-stage builds for optimization:

1. **Base Stage**: Common dependencies and user setup
2. **Development Stage**: Includes dev tools and hot reloading
3. **Production Stage**: Optimized for production with Gunicorn

### Volume Management

```yaml
volumes:
  ml-models:          # Trained models
  ml-features:        # Feature store
  ml-artifacts:       # MLflow artifacts
  ml-mlruns:         # MLflow tracking database
  ml-logs:           # Application logs
```

### Health Checks

```dockerfile
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1
```

### Service Dependencies

```yaml
depends_on:
  - mlflow-server    # MLflow tracking server
  - prometheus       # Metrics collection (if monitoring enabled)
```

## Integration with Main Application

### Docker Compose Integration

Add ML service to main `docker-compose.yml`:

```yaml
services:
  # Existing services...
  backend:
    # ... existing backend config
    environment:
      - ML_SERVICE_URL=http://ml-service:8001
      - ML_API_KEY=your-secret-key
    depends_on:
      - ml-service

  ml-service:
    build:
      context: ./ml-service
      dockerfile: Dockerfile
      target: production
    container_name: rpa-ml-service
    ports:
      - "8001:8001"
    environment:
      - DATABASE_URL=sqlite:////app/data/database.sqlite
      - MLFLOW_TRACKING_URI=http://mlflow-server:5000
    volumes:
      - ./backend/data:/app/data:ro  # Read-only access to main database
      - ml-models:/app/models
    networks:
      - rpa-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

### Network Configuration

```yaml
networks:
  rpa-network:
    driver: bridge
```

This allows services to communicate using service names (e.g., `http://ml-service:8001`).

## Kubernetes Deployment

For large-scale production deployments, consider Kubernetes:

### Namespace
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: rpa-ml
```

### Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ml-service
  namespace: rpa-ml
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ml-service
  template:
    metadata:
      labels:
        app: ml-service
    spec:
      containers:
      - name: ml-service
        image: rpa-ml-service:latest
        ports:
        - containerPort: 8001
        env:
        - name: ML_API_HOST
          value: "0.0.0.0"
        - name: ML_API_PORT
          value: "8001"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: ml-secrets
              key: database-url
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8001
          initialDelaySeconds: 30
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health
            port: 8001
          initialDelaySeconds: 5
          periodSeconds: 10
```

### Service
```yaml
apiVersion: v1
kind: Service
metadata:
  name: ml-service
  namespace: rpa-ml
spec:
  selector:
    app: ml-service
  ports:
  - protocol: TCP
    port: 8001
    targetPort: 8001
  type: ClusterIP
```

### Persistent Volumes
```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: ml-models-pvc
  namespace: rpa-ml
spec:
  accessModes:
    - ReadWriteMany
  resources:
    requests:
      storage: 10Gi
```

## Performance Tuning

### Resource Allocation

**Development**:
- CPU: 1 core
- Memory: 1-2 GB
- Storage: 5-10 GB

**Production**:
- CPU: 2-4 cores
- Memory: 4-8 GB
- Storage: 20-50 GB

### Gunicorn Configuration

```python
# gunicorn.conf.py
bind = "0.0.0.0:8001"
workers = 4  # CPU cores * 2
worker_class = "uvicorn.workers.UvicornWorker"
worker_connections = 1000
max_requests = 1000
max_requests_jitter = 50
preload_app = True
timeout = 30
keepalive = 30
```

### Database Optimization

```python
# Connection pool settings
DATABASE_POOL_SIZE = 20
DATABASE_MAX_OVERFLOW = 0
DATABASE_POOL_TIMEOUT = 30
```

## Monitoring and Observability

### Logging Configuration

```yaml
logging:
  version: 1
  disable_existing_loggers: false
  formatters:
    standard:
      format: "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
  handlers:
    console:
      class: logging.StreamHandler
      level: INFO
      formatter: standard
      stream: ext://sys.stdout
    file:
      class: logging.handlers.RotatingFileHandler
      level: INFO
      formatter: standard
      filename: /app/logs/ml_service.log
      maxBytes: 10485760  # 10MB
      backupCount: 5
  loggers:
    "":
      level: INFO
      handlers: [console, file]
```

### Prometheus Metrics

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'ml-service'
    static_configs:
      - targets: ['ml-service:8001']
    metrics_path: '/metrics'
    scrape_interval: 30s
```

### Grafana Dashboard

Import the provided dashboard configuration:
```bash
docker cp monitoring/grafana/dashboards/ml-service.json grafana_container:/etc/grafana/provisioning/dashboards/
```

## Security Configuration

### API Key Management

**Development**:
```bash
# No API key required
ML_API_KEY=
```

**Production**:
```bash
# Generate secure API key
ML_API_KEY=$(openssl rand -hex 32)
```

### Network Security

```yaml
# Docker Compose network isolation
networks:
  rpa-network:
    driver: bridge
    internal: false  # Allow external access to API
  ml-internal:
    driver: bridge
    internal: true   # Internal services only
```

### HTTPS Configuration

For production, use a reverse proxy like nginx:

```nginx
server {
    listen 443 ssl;
    server_name ml-api.yourdomain.com;
    
    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    
    location / {
        proxy_pass http://ml-service:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Backup and Recovery

### Model Backup

```bash
# Backup trained models
docker run --rm -v ml-models:/source -v $(pwd)/backup:/backup alpine tar czf /backup/ml-models-$(date +%Y%m%d).tar.gz -C /source .

# Restore models
docker run --rm -v ml-models:/target -v $(pwd)/backup:/backup alpine tar xzf /backup/ml-models-20240101.tar.gz -C /target
```

### MLflow Backup

```bash
# Backup MLflow database
docker exec mlflow-server sqlite3 /mlflow/mlflow.db ".backup /mlflow/mlflow_backup_$(date +%Y%m%d).db"

# Backup artifacts
docker run --rm -v ml-mlflow-db:/source -v $(pwd)/backup:/backup alpine tar czf /backup/mlflow-$(date +%Y%m%d).tar.gz -C /source .
```

## Troubleshooting

### Common Issues

1. **Service Won't Start**
```bash
# Check logs
docker logs rpa-ml-service

# Check configuration
docker exec rpa-ml-service env | grep ML_

# Test database connection
docker exec rpa-ml-service python -c "from src.data.database import DatabaseManager; db = DatabaseManager(); print('DB OK')"
```

2. **Models Not Loading**
```bash
# Check model directory
docker exec rpa-ml-service ls -la /app/models/trained/

# Check permissions
docker exec rpa-ml-service ls -la /app/models/

# Test model loading
docker exec rpa-ml-service python -c "from src.models.completion_time_model import CompletionTimePredictor; CompletionTimePredictor()"
```

3. **High Memory Usage**
```bash
# Monitor resource usage
docker stats rpa-ml-service

# Check for memory leaks
docker exec rpa-ml-service python -c "import psutil; print(f'Memory: {psutil.virtual_memory().percent}%')"

# Restart service
docker restart rpa-ml-service
```

### Performance Issues

1. **Slow Predictions**
```bash
# Check prediction latency
curl -w "@curl-format.txt" -X POST http://localhost:8001/api/v1/predict/completion-time -H "Content-Type: application/json" -d '{"project_ids": [1]}'

# Profile database queries
docker exec rpa-ml-service python -c "import time; from src.data.database import DatabaseManager; db = DatabaseManager(); start = time.time(); db.execute_query('SELECT COUNT(*) FROM projects'); print(f'Query time: {time.time() - start:.2f}s')"
```

2. **High CPU Usage**
```bash
# Check worker processes
docker exec rpa-ml-service ps aux

# Monitor CPU usage
docker stats --no-stream rpa-ml-service

# Reduce worker count if needed
docker-compose down
# Edit docker-compose.yml to reduce workers
docker-compose up -d ml-service
```

## Maintenance

### Regular Tasks

1. **Model Retraining** (Weekly)
```bash
# Trigger retraining
curl -X POST http://localhost:8001/api/v1/models/retrain -H "Authorization: Bearer your-api-key"
```

2. **Performance Monitoring** (Daily)
```bash
# Check model performance
curl http://localhost:8001/api/v1/monitoring/metrics

# Check for drift
curl http://localhost:8001/api/v1/monitoring/drift
```

3. **Log Rotation** (Daily)
```bash
# Rotate logs
docker exec rpa-ml-service find /app/logs -name "*.log" -mtime +7 -delete
```

4. **Cleanup Old Models** (Monthly)
```bash
# Remove old model versions (keep last 5)
docker exec rpa-ml-service python -c "
import os
from pathlib import Path
model_dir = Path('/app/models/trained')
for model_file in sorted(model_dir.glob('*.joblib'), key=os.path.getmtime)[:-5]:
    model_file.unlink()
"
```

### Updates and Upgrades

1. **Application Updates**
```bash
# Pull latest code
git pull origin main

# Rebuild and deploy
docker-compose build ml-service
docker-compose up -d ml-service
```

2. **Dependency Updates**
```bash
# Update requirements.txt
pip-compile --upgrade requirements.in

# Test in development
docker-compose --profile dev build ml-service-dev
docker-compose --profile dev up ml-service-dev

# Deploy to production
docker-compose build ml-service
docker-compose up -d ml-service
```

3. **Configuration Updates**
```bash
# Update environment variables
# Edit .env.prod

# Restart service to pick up changes
docker-compose restart ml-service
```
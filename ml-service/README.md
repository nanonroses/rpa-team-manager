# RPA Team Manager - ML Service

## Overview

The ML Service provides predictive analytics and AI-powered insights for the RPA Team Manager application. It implements 3 core predictive models to enhance project management decision-making:

1. **Project Completion Time Prediction** - Predicts project delivery dates with 90% confidence intervals
2. **Budget Variance Prediction** - Predicts cost overruns 15 days in advance  
3. **Risk Scoring System** - Overall project health assessment (0-100 score)

## Architecture

### Technology Stack
- **API Framework**: FastAPI with async support
- **ML Libraries**: scikit-learn, XGBoost, LightGBM
- **Experiment Tracking**: MLflow with SQLite backend
- **Model Interpretation**: SHAP for explainable AI
- **Monitoring**: Prometheus metrics + custom drift detection
- **Deployment**: Docker containers with health checks

### Model Architecture
- **Ensemble Approach**: Random Forest + XGBoost + LightGBM + Linear models
- **Feature Engineering**: Automated feature extraction from SQLite database
- **Cross-Validation**: Time-based splits for realistic validation
- **Hyperparameter Tuning**: Automated optimization with Optuna
- **Confidence Intervals**: Quantile regression + bootstrap methods

## Quick Start

### Local Development

1. **Install Dependencies**
```bash
cd ml-service
pip install -r requirements.txt
```

2. **Configure Environment**
```bash
cp .env.example .env
# Edit .env with your settings
```

3. **Start Development Server**
```bash
python -m uvicorn src.api.main:app --host 0.0.0.0 --port 8001 --reload
```

4. **Access API Documentation**
- API Docs: http://localhost:8001/docs
- Health Check: http://localhost:8001/health

### Docker Deployment

1. **Production Deployment**
```bash
docker-compose up -d ml-service
```

2. **Development with Hot Reload**
```bash
docker-compose --profile dev up ml-service-dev
```

3. **Full MLOps Stack**
```bash
docker-compose --profile monitoring up -d
```

## API Endpoints

### Core Predictions

#### Project Completion Time
```bash
POST /api/v1/predict/completion-time
{
  "project_ids": [1, 2, 3],
  "confidence_level": 0.90
}
```

#### Budget Variance
```bash
POST /api/v1/predict/budget-variance
{
  "project_ids": [1, 2, 3],
  "prediction_horizon": 15,
  "confidence_level": 0.90
}
```

#### Risk Score
```bash
POST /api/v1/predict/risk-score
{
  "project_ids": [1, 2, 3],
  "confidence_level": 0.90
}
```

### Batch Processing
```bash
POST /api/v1/predict/batch
{
  "project_ids": [1, 2, 3],
  "prediction_types": ["completion_time", "budget_variance", "risk_score"]
}
```

### Model Interpretation
```bash
POST /api/v1/explain
{
  "project_id": 1,
  "model_type": "completion_time"
}
```

### Monitoring & Management
```bash
GET /api/v1/health                    # Service health
GET /api/v1/models                    # Model information
POST /api/v1/models/validate          # Model validation
GET /api/v1/monitoring/drift          # Data drift detection
GET /api/v1/monitoring/metrics        # Performance metrics
```

## Model Details

### 1. Project Completion Time Prediction

**Objective**: Predict project delivery dates with confidence intervals

**Features**:
- Current progress percentage, team velocity, remaining tasks
- Historical completion times for similar projects
- Team member availability and skill levels
- Project complexity factors

**Output**:
- Predicted completion days
- 90% confidence intervals
- Risk factors identification
- Feature importance scores

**Performance Targets**: 
- MAE < 5 days
- 90% of predictions within confidence intervals

### 2. Budget Variance Prediction

**Objective**: Predict cost overruns 15 days in advance

**Features**:
- Current budget utilization, burn rate
- Remaining scope vs timeline
- Historical cost patterns
- Resource allocation changes

**Output**:
- Predicted variance percentage
- Risk level (Low/Medium/High/Critical)
- Actionable recommendations
- Contributing factors analysis

**Performance Targets**:
- MAE < 15% variance
- Early warning 15+ days before overrun

### 3. Risk Scoring System

**Objective**: Overall project health assessment (0-100 score)

**Features**:
- Schedule variance, cost variance, scope changes
- Team performance metrics, issue frequency
- Client communication sentiment
- Dependencies and blockers

**Output**:
- Overall risk score (0-100)
- Risk category (Low/Medium/High/Critical)
- Detailed risk factors breakdown
- Trend analysis (increasing/decreasing/stable)
- Mitigation recommendations

**Performance Targets**:
- Accuracy > 75% for risk categories
- Early identification of high-risk projects

## MLOps Features

### Experiment Tracking
- **MLflow Integration**: All training runs logged with parameters, metrics, and artifacts
- **Model Registry**: Versioned models with stage management (Staging/Production)
- **Artifact Storage**: Models, plots, and feature importance stored automatically

### Model Monitoring
- **Performance Tracking**: Continuous evaluation against ground truth
- **Data Drift Detection**: KS tests on feature distributions
- **Prediction Drift**: Model output distribution monitoring
- **Alert System**: Automatic notifications when drift detected

### Automated Retraining
- **Trigger Conditions**: Performance degradation or significant drift
- **Hyperparameter Optimization**: Automated tuning with Optuna
- **A/B Testing**: Champion/challenger model comparison
- **Rollback Capability**: Safe deployment with quick rollback

### Model Interpretation
- **SHAP Values**: Feature contribution analysis for individual predictions
- **Global Importance**: Aggregated feature importance across all predictions
- **Visualization**: Waterfall plots and summary plots
- **Explainable Reports**: Human-readable explanations for stakeholders

## Configuration

### Environment Variables

```bash
# API Configuration
ML_API_HOST=0.0.0.0
ML_API_PORT=8001
DEBUG=false

# Database
DATABASE_URL=sqlite:///../../backend/data/database.sqlite

# MLflow
MLFLOW_TRACKING_URI=sqlite:///mlruns.db
MLFLOW_EXPERIMENT_NAME=rpa-team-manager-predictions

# Model Storage
MODEL_STORAGE_PATH=./models/trained
FEATURE_STORE_PATH=./features

# Training Configuration
ENABLE_HYPERPARAMETER_TUNING=true
MAX_TRIALS=100
MIN_TRAINING_SAMPLES=50

# Performance Thresholds
COMPLETION_TIME_MAE_THRESHOLD=5.0
BUDGET_VARIANCE_MAE_THRESHOLD=0.15
RISK_SCORE_ACCURACY_THRESHOLD=0.75

# Monitoring
ENABLE_MODEL_MONITORING=true
DRIFT_DETECTION_WINDOW=30
RETRAINING_THRESHOLD=0.1

# Security
ML_API_KEY=your-secret-key
ALLOWED_HOSTS=["localhost", "127.0.0.1"]
```

### Model Configuration

Models can be configured in `src/config/settings.py`:

- Feature selection parameters
- Hyperparameter search spaces
- Cross-validation settings
- Performance thresholds

## Development

### Project Structure
```
ml-service/
├── src/
│   ├── api/                 # FastAPI application
│   ├── models/              # ML model implementations
│   ├── features/            # Feature engineering
│   ├── data/               # Data access layer
│   ├── utils/              # Utilities (SHAP, monitoring, etc.)
│   └── config/             # Configuration management
├── tests/                   # Test suite
├── docker/                 # Docker configurations
├── monitoring/             # Prometheus/Grafana configs
├── notebooks/              # Jupyter notebooks for development
└── artifacts/              # Model artifacts and plots
```

### Adding New Models

1. **Create Model Class**: Inherit from base predictor class
2. **Implement Methods**: `train()`, `predict()`, `explain_prediction()`
3. **Add Feature Processor**: Create corresponding feature engineering class
4. **Register Endpoints**: Add API routes in `src/api/main.py`
5. **Add Tests**: Create comprehensive test suite
6. **Update Documentation**: Document API endpoints and model details

### Testing

```bash
# Run all tests
pytest tests/

# Run specific test file
pytest tests/test_models.py -v

# Run with coverage
pytest --cov=src tests/

# Run integration tests
pytest tests/integration/ -v
```

### Code Quality

```bash
# Format code
black src/ tests/

# Lint code
flake8 src/ tests/

# Type checking
mypy src/
```

## Monitoring & Alerting

### Metrics Available
- **Prediction Latency**: Response time per prediction
- **Throughput**: Predictions per second
- **Model Accuracy**: Validation metrics over time
- **Data Drift Score**: Distribution changes in features
- **Error Rate**: Failed predictions percentage

### Dashboards
- **Grafana Dashboard**: http://localhost:3001 (admin/admin123)
- **MLflow UI**: http://localhost:5000
- **Prometheus Metrics**: http://localhost:9090

### Alert Conditions
- Model accuracy drops below threshold
- Data drift detected (p-value < 0.05)
- Prediction latency > 200ms
- Error rate > 5%

## Integration with Node.js Backend

The ML service integrates with the existing Node.js backend through REST API calls:

```typescript
// Example usage in Node.js
const mlClient = new MLServiceClient('http://ml-service:8001');

// Get completion time prediction
const prediction = await mlClient.predictCompletionTime({
  project_ids: [1, 2, 3],
  confidence_level: 0.90
});

// Get comprehensive analytics
const analytics = await mlClient.getProjectAnalytics(projectId);
```

## Security Considerations

- **API Key Authentication**: Protect sensitive endpoints
- **Rate Limiting**: Prevent abuse and overload
- **Input Validation**: Sanitize all inputs
- **HTTPS Only**: Encrypt all communications
- **Audit Logging**: Track all API calls and model usage

## Performance Optimization

### Model Serving
- **Model Caching**: Keep models in memory
- **Batch Processing**: Process multiple predictions together
- **Feature Caching**: Cache expensive feature computations
- **Connection Pooling**: Efficient database connections

### Scalability
- **Horizontal Scaling**: Multiple service instances behind load balancer
- **Model Sharding**: Distribute models across instances
- **Async Processing**: Non-blocking prediction requests
- **Queue-based Training**: Background model retraining

## Troubleshooting

### Common Issues

1. **Models Not Loading**
   - Check model file paths in configuration
   - Verify database connectivity
   - Check MLflow tracking URI

2. **Poor Model Performance**
   - Increase training data size
   - Tune hyperparameters
   - Check for data quality issues
   - Verify feature engineering logic

3. **High Prediction Latency**
   - Enable model caching
   - Optimize feature computation
   - Consider model compression
   - Profile database queries

4. **Data Drift Alerts**
   - Investigate data source changes
   - Retrain models with recent data
   - Update feature engineering logic
   - Check data pipeline health

### Debugging

```bash
# Check service logs
docker logs rpa-ml-service

# Debug mode
DEBUG=true python -m uvicorn src.api.main:app --reload

# Database connection test
python -c "from src.data.database import DatabaseManager; db = DatabaseManager(); print(db.get_connection())"

# Model prediction test
python -c "from src.models.completion_time_model import CompletionTimePredictor; model = CompletionTimePredictor(); print('Model initialized')"
```

## Support

For issues, questions, or contributions:

1. **Bug Reports**: Create GitHub issue with reproduction steps
2. **Feature Requests**: Describe use case and expected behavior
3. **Documentation**: Contribute to README and API docs
4. **Code Contributions**: Follow testing and code quality standards

## License

MIT License - see LICENSE file for details.
# Guía del ML Service

## Visión General

Servicio Python con FastAPI que provee predicciones ML para:
1. **Tiempo de completación** de proyectos
2. **Varianza de presupuesto** (sobre/sub costos)
3. **Score de riesgo** (0-100 con categoría)

## Stack

- **FastAPI** para API REST
- **scikit-learn** para modelos base
- **XGBoost** y **LightGBM** para ensemble
- **SHAP** para explicabilidad
- **MLflow** para tracking de experimentos

## Estructura

```
ml-service/
├── src/
│   ├── api/
│   │   ├── main.py          # FastAPI app
│   │   └── schemas.py       # Pydantic schemas
│   ├── models/
│   │   ├── predictor_service.py    # Orquestador
│   │   ├── completion_time_model.py
│   │   ├── budget_variance_model.py
│   │   └── risk_score_model.py
│   ├── data/
│   │   └── database.py      # Conexión SQLite
│   ├── features/
│   │   └── feature_engineering.py
│   ├── config/
│   │   └── settings.py      # Configuración
│   └── utils/
│       ├── logger.py
│       ├── mlflow_manager.py
│       ├── monitoring.py
│       └── shap_explainer.py
├── requirements.txt
└── pyproject.toml
```

## Comandos

```bash
# Instalar dependencias
cd ml-service
pip install -r requirements.txt

# Ejecutar en desarrollo
python -m uvicorn src.api.main:app --host 0.0.0.0 --port 8002 --reload

# Ejecutar tests
pytest

# Linting
black src/
mypy src/
```

## Endpoints API

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/models/info` | Info de modelos |
| POST | `/predict/completion-time` | Predecir tiempo |
| POST | `/predict/budget-variance` | Predecir varianza |
| POST | `/predict/risk-score` | Predecir riesgo |
| POST | `/predict/batch` | Predicciones batch |
| POST | `/explain/{model_type}` | SHAP explanation |
| POST | `/train/{model_type}` | Re-entrenar modelo |

## Hacer Predicción

```python
import requests

# Predicción de tiempo de completación
response = requests.post(
    'http://localhost:8002/predict/completion-time',
    json={
        'project_id': 1,
        'features': {
            'budgeted_hours': 100,
            'team_size': 3,
            'complexity': 'medium',
            'has_dependencies': True
        }
    }
)
result = response.json()
# {
#   'predicted_days': 45,
#   'confidence_interval': [40, 52],
#   'confidence': 0.85
# }
```

## Agregar Nuevo Modelo

```python
# ml-service/src/models/nuevo_modelo.py
from sklearn.ensemble import RandomForestRegressor
import numpy as np

class NuevoPredictor:
    def __init__(self):
        self.model = None
        self.is_trained = False
    
    def train(self, X: np.ndarray, y: np.ndarray) -> dict:
        """Entrenar modelo"""
        self.model = RandomForestRegressor(n_estimators=100)
        self.model.fit(X, y)
        self.is_trained = True
        return {'status': 'trained', 'samples': len(y)}
    
    def predict(self, X: np.ndarray) -> dict:
        """Hacer predicción"""
        if not self.is_trained:
            raise ValueError("Modelo no entrenado")
        
        prediction = self.model.predict(X)
        return {
            'prediction': float(prediction[0]),
            'confidence': 0.8
        }
    
    def save(self, path: str):
        """Guardar modelo"""
        import joblib
        joblib.dump(self.model, path)
    
    def load(self, path: str):
        """Cargar modelo"""
        import joblib
        self.model = joblib.load(path)
        self.is_trained = True
```

## Feature Engineering

```python
# ml-service/src/features/feature_engineering.py
class FeatureProcessor:
    def process(self, raw_data: dict) -> np.ndarray:
        features = []
        
        # Numéricas
        features.append(raw_data.get('budgeted_hours', 0))
        features.append(raw_data.get('team_size', 1))
        
        # Categóricas (one-hot encoding)
        complexity = raw_data.get('complexity', 'medium')
        features.append(1 if complexity == 'low' else 0)
        features.append(1 if complexity == 'medium' else 0)
        features.append(1 if complexity == 'high' else 0)
        
        # Booleanas
        features.append(1 if raw_data.get('has_dependencies') else 0)
        
        return np.array(features).reshape(1, -1)
```

## Conexión a Base de Datos

```python
# El ML service lee datos de la misma SQLite del backend
from src.data.database import DatabaseManager

db = DatabaseManager()
projects = db.execute_query("""
    SELECT p.*, pf.budgeted_hours, pf.actual_cost
    FROM projects p
    LEFT JOIN project_financials pf ON p.id = pf.project_id
    WHERE p.status = 'completed'
""")
```

## SHAP Explanations

```python
# Obtener explicación de predicción
response = requests.post(
    'http://localhost:8002/explain/completion-time',
    json={'project_id': 1, 'features': {...}}
)
# {
#   'shap_values': {...},
#   'feature_importance': [
#     {'feature': 'team_size', 'importance': 0.35},
#     {'feature': 'complexity', 'importance': 0.25},
#     ...
#   ]
# }
```

## Logging

```python
from src.utils.logger import MLLogger

logger = MLLogger()
logger.log_training_start('completion_time', {'samples': 100})
logger.log_prediction('completion_time', prediction=45, confidence=0.85)
logger.log_error('Error en predicción', exception=e)
```

## Monitoreo

```python
from src.utils.monitoring import ModelMonitor

monitor = ModelMonitor()
monitor.log_prediction(prediction, actual=None)  # Cuando hay ground truth
monitor.check_drift()  # Detectar drift en predicciones
monitor.get_performance_metrics()
```

## Configuración

```python
# ml-service/src/config/settings.py
from pydantic_settings import BaseSettings

class MLSettings(BaseSettings):
    DATABASE_PATH: str = "../backend/database.sqlite"
    MODEL_DIR: str = "./models"
    MLFLOW_TRACKING_URI: str = "./mlruns"
    
    class Config:
        env_file = ".env"
```

## Archivos Relacionados

- API principal: `ml-service/src/api/main.py`
- Schemas: `ml-service/src/api/schemas.py`
- Modelos: `ml-service/src/models/`
- Features: `ml-service/src/features/`
- Config: `ml-service/src/config/settings.py`
- Documentación: `ml-service/README.md`
